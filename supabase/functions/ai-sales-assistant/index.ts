import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- AI Provider Abstraction ----------

interface AIResponse {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

async function callOpenAI(prompt: string, systemPrompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";
  if (!apiKey) throw new Error("Chưa cấu hình AI provider. Thiếu OPENAI_API_KEY.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  return {
    content: data.choices?.[0]?.message?.content || "{}",
    prompt_tokens: data.usage?.prompt_tokens || 0,
    completion_tokens: data.usage?.completion_tokens || 0,
    total_tokens: data.usage?.total_tokens || 0,
  };
}

async function callGemini(prompt: string, systemPrompt: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.0-flash";
  if (!apiKey) throw new Error("Chưa cấu hình AI provider. Thiếu GEMINI_API_KEY.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n---\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errBody}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  const usage = data.usageMetadata || {};
  return {
    content: text,
    prompt_tokens: usage.promptTokenCount || 0,
    completion_tokens: usage.candidatesTokenCount || 0,
    total_tokens: usage.totalTokenCount || 0,
  };
}

async function callAI(prompt: string, systemPrompt: string): Promise<AIResponse> {
  const provider = (Deno.env.get("AI_PROVIDER") || "").toLowerCase();
  if (provider === "openai") return callOpenAI(prompt, systemPrompt);
  if (provider === "gemini") return callGemini(prompt, systemPrompt);
  throw new Error("Chưa cấu hình AI provider. Vui lòng set secret AI_PROVIDER = 'openai' hoặc 'gemini'.");
}

// ---------- Main Handler ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    // 1. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing authorization" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // 2. Parse input
    const body = await req.json();
    const { customerId, mode, taskId } = body;

    if (!customerId) {
      return json({ error: "customerId is required" }, 400);
    }
    if (mode !== "summary") {
      return json({ error: "Only mode='summary' is supported" }, 400);
    }

    // 3. Check user permission to view this customer
    const { data: customerData, error: customerError } = await userClient
      .from("customers")
      .select("*")
      .eq("id", customerId)
      .single();

    if (customerError || !customerData) {
      return json({ error: "Không có quyền xem khách hàng này hoặc khách hàng không tồn tại." }, 403);
    }

    // 4. Load related data using adminClient for completeness
    const [activitiesResult, ordersResult, tasksResult, productKnowledgeResult] = await Promise.all([
      adminClient
        .from("customer_activities")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(10),
      adminClient
        .from("orders")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5),
      adminClient
        .from("customer_tasks")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false })
        .limit(5),
      adminClient
        .from("product_knowledge")
        .select("*")
        .eq("is_active", true)
        .limit(20),
    ]);

    const activities = activitiesResult.data || [];
    const orders = ordersResult.data || [];
    const tasks = tasksResult.data || [];
    const productKnowledge = productKnowledgeResult.data || [];

    // 5. Build prompt
    const systemPrompt = `Bạn là AI trợ lý bán hàng cho hệ thống CRM Desembre Partner Hub.

NGUYÊN TẮC BẮT BUỘC (GUARDRAILS):
- Bạn CHỈ ĐƯỢC tóm tắt và phân tích dựa trên DỮ LIỆU ĐƯỢC CUNG CẤP bên dưới.
- KHÔNG ĐƯỢC bịa ra sản phẩm, công dụng, hoặc thông tin nào không có trong dữ liệu.
- KHÔNG ĐƯỢC đề xuất hành động ngoài phạm vi quyền của nhân viên bán hàng (ví dụ: không đề xuất xoá khách, sửa giá, truy cập admin).
- KHÔNG ĐƯỢC đề cập đến AI hoặc "tôi là AI" trong kết quả trả về.
- Trả lời bằng tiếng Việt, chuyên nghiệp, ngắn gọn.
- Sử dụng dữ liệu product_knowledge nếu có để nhận diện sản phẩm khách đã mua.

Trả về kết quả dạng JSON với cấu trúc:
{
  "summary": "Tóm tắt tổng quan về khách hàng trong 2-3 câu",
  "current_status": "Tình trạng hiện tại của khách hàng (VD: Đang hoạt động, Cần chăm sóc lại, Nguy cơ mất khách...)",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3"],
  "risks": ["Rủi ro 1", "Rủi ro 2"],
  "suggested_next_actions": ["Hành động 1", "Hành động 2", "Hành động 3"]
}

Nếu dữ liệu ít, hãy nêu rõ thay vì bịa thêm. Ví dụ: "Chưa đủ dữ liệu để đánh giá rủi ro."`;

    const userPrompt = `=== THÔNG TIN KHÁCH HÀNG ===
Tên: ${customerData.name || "N/A"}
Loại: ${customerData.customer_type || "N/A"}
Hạng: ${customerData.tier || "N/A"}
Kênh tiếp cận: ${customerData.channel || "N/A"}
Lifecycle: ${customerData.lifecycle_stage || "N/A"}
Ghi chú: ${customerData.notes || "Không có"}
Skin concern focus: ${customerData.skin_concern_focus || "Không rõ"}
Địa chỉ: ${customerData.address || "N/A"}
Ngày tạo: ${customerData.created_at || "N/A"}

=== HOẠT ĐỘNG CHĂM SÓC GẦN ĐÂY (${activities.length} hoạt động) ===
${activities.length > 0
  ? activities.map((a: any, i: number) => 
      `${i + 1}. [${a.activity_type || "note"}] ${a.title || ""} - ${a.content || ""} (${a.created_at})`
    ).join("\n")
  : "Chưa có hoạt động nào."}

=== ĐƠN HÀNG GẦN ĐÂY (${orders.length} đơn) ===
${orders.length > 0
  ? orders.map((o: any, i: number) =>
      `${i + 1}. Đơn #${o.id?.slice(0, 8)} - Tổng: ${o.total?.toLocaleString() || 0}đ - Trạng thái: ${o.status || "N/A"} (${o.created_at})`
    ).join("\n")
  : "Chưa có đơn hàng."}

=== TASK/CÔNG VIỆC GẦN ĐÂY (${tasks.length} task) ===
${tasks.length > 0
  ? tasks.map((t: any, i: number) =>
      `${i + 1}. [${t.status || "pending"}] ${t.title || ""} - Ưu tiên: ${t.priority || "normal"} - Hạn: ${t.due_at || "Không có"} (${t.created_at})`
    ).join("\n")
  : "Chưa có task."}

=== CƠ SỞ TRI THỨC SẢN PHẨM (${productKnowledge.length} sản phẩm) ===
${productKnowledge.length > 0
  ? productKnowledge.map((pk: any, i: number) =>
      `${i + 1}. Product ID ${pk.product_id}: ${pk.benefits?.slice(0, 100) || "N/A"}... | Skin concerns: ${(pk.skin_concerns || []).join(", ")} | Restock: ${pk.restock_cycle_days || 60} ngày`
    ).join("\n")
  : "Chưa có tri thức sản phẩm."}

Hãy tóm tắt tổng quan khách hàng này cho nhân viên bán hàng.`;

    // 6. Call AI
    let aiResponse: AIResponse;
    try {
      aiResponse = await callAI(userPrompt, systemPrompt);
    } catch (aiError: any) {
      // Log failed attempt
      await adminClient.from("ai_assistant_logs").insert({
        user_id: user.id,
        customer_id: customerId,
        task_id: taskId || null,
        mode: "summary",
        status: "error",
        error_message: aiError.message || "Unknown AI error",
      });
      return json({ error: aiError.message || "Lỗi khi gọi AI provider." }, 500);
    }

    // 7. Parse AI response
    let parsed: any;
    try {
      parsed = JSON.parse(aiResponse.content);
    } catch {
      parsed = {
        summary: aiResponse.content,
        current_status: "Không xác định",
        key_insights: [],
        risks: [],
        suggested_next_actions: [],
      };
    }

    // 8. Log success
    await adminClient.from("ai_assistant_logs").insert({
      user_id: user.id,
      customer_id: customerId,
      task_id: taskId || null,
      mode: "summary",
      status: "success",
      prompt_tokens: aiResponse.prompt_tokens,
      completion_tokens: aiResponse.completion_tokens,
      total_tokens: aiResponse.total_tokens,
    });

    // 9. Return structured response
    return json({
      summary: parsed.summary || "",
      current_status: parsed.current_status || "",
      key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      suggested_next_actions: Array.isArray(parsed.suggested_next_actions) ? parsed.suggested_next_actions : [],
    });

  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});
