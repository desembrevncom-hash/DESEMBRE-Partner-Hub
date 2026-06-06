import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptApiKey } from "../_shared/crypto-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AIConfig {
  provider: string;
  chatModel: string;
  embeddingModel: string;
  openAiKey: string;
}

interface AIResponse {
  content: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

function formatCurrencyVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

async function callOpenAI(
  prompt: string,
  systemPrompt: string,
  config: AIConfig,
): Promise<AIResponse> {
  const apiKey = config.openAiKey;
  const model = config.chatModel || "gpt-4o-mini";
  if (!apiKey) throw new Error("Missing OpenAI API Key in configuration.");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.1, // low temperature for high precision and compliance
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // 1. JWT authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify user is Admin or Sub Admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    
    const { data: isAdmin, error: roleError } = await adminClient.rpc(
      "is_admin_or_sub_admin",
      { user_id: user.id }
    );
    
    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Access denied. Only Admin or Sub Admin can generate sales sheets." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request payload
    const body = await req.json();
    const { catalogProductId, templateId } = body;
    if (!catalogProductId) {
      return new Response(
        JSON.stringify({ error: "catalogProductId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Load product catalog data
    const { data: product, error: productErr } = await adminClient
      .from("catalog_products")
      .select(`
        id, 
        name, 
        product_code, 
        description, 
        image_url, 
        brand_id, 
        brand:product_brands(name), 
        category:product_categories(name)
      `)
      .eq("id", catalogProductId)
      .single();

    if (productErr || !product) {
      return new Response(
        JSON.stringify({ error: "Catalog product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Load variants
    const { data: variants } = await adminClient
      .from("catalog_product_variants")
      .select("sku, channel, size_label, price")
      .eq("product_id", catalogProductId)
      .eq("is_active", true);

    // Load approved product knowledge
    const { data: knowledge } = await adminClient
      .from("product_knowledge")
      .select("benefits, skin_concerns, suitable_spa_types, usage_instructions, sales_pitch, warnings")
      .eq("catalog_product_id", catalogProductId)
      .eq("is_active", true)
      .eq("qa_status", "approved")
      .maybeSingle();

    // 4. Retrieve and decrypt OpenAI API Key from DB
    let openaiApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    let chatModel = "gpt-4o-mini";
    try {
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("encrypted_api_key, chat_model")
        .eq("provider", "openai")
        .single();
      
      if (settings?.encrypted_api_key) {
        openaiApiKey = await decryptApiKey(settings.encrypted_api_key);
      }
      if (settings?.chat_model) {
        chatModel = settings.chat_model;
      }
    } catch (e) {
      console.error("Failed to read OPENAI_API_KEY from DB, fallback to env", e);
    }

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key is not configured in settings." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiConfig: AIConfig = {
      provider: "openai",
      chatModel,
      embeddingModel: "text-embedding-3-small",
      openAiKey: openaiApiKey,
    };

    // 5. Structure AI prompt
    const brandName = (product.brand as any)?.name || "Desembre";
    const categoryName = (product.category as any)?.name || "Chưa có danh mục";

    const retailVariants = (variants || [])
      .filter((v: any) => v.channel === "retail")
      .map((v: any) => `- SKU: ${v.sku}, Dung tích: ${v.size_label || "Mặc định"}, Giá: ${formatCurrencyVND(v.price)}`);

    const salonVariants = (variants || [])
      .filter((v: any) => v.channel === "salon")
      .map((v: any) => `- SKU: ${v.sku}, Dung tích: ${v.size_label || "Mặc định"}, Giá: ${formatCurrencyVND(v.price)}`);

    const inputData = {
      product: {
        name: product.name,
        brand_name: brandName,
        category_name: categoryName,
        description: product.description || "",
        product_code: product.product_code || "",
      },
      pricing: {
        retail: retailVariants,
        salon: salonVariants,
      },
      knowledge: knowledge ? {
        benefits: knowledge.benefits || "",
        skin_concerns: knowledge.skin_concerns || [],
        suitable_spa_types: knowledge.suitable_spa_types || [],
        usage_instructions: knowledge.usage_instructions || "",
        sales_pitch: knowledge.sales_pitch || "",
        warnings: knowledge.warnings || "",
      } : null,
    };

    const systemPrompt = `Bạn là chuyên gia tư vấn sản phẩm và xây dựng tài liệu bán hàng (Product Sales Sheet) cho thương hiệu mỹ phẩm cao cấp Desembre.
Nhiệm vụ của bạn là tổng hợp và viết nội dung tài liệu bán hàng A4 cho sản phẩm dưới đây dựa trên thông tin chính xác được cung cấp.

QUY TẮC BẮT BUỘC:
1. KHÔNG bịa đặt thông tin (No hallucination). Chỉ viết dựa trên dữ liệu thật được cung cấp.
2. Nếu một thông tin nào đó bị thiếu hoặc không được cung cấp trong phần dữ liệu sản phẩm đầu vào (ví dụ: phần knowledge là null hoặc các trường trong đó rỗng), bạn BẮT BUỘC phải điền chính xác cụm từ "Chưa có dữ liệu đã duyệt." vào trường đó. Không được tự ý suy luận hay bịa ra công dụng khác.
3. Không quảng cáo quá đà hoặc cam kết chữa khỏi các bệnh da liễu nặng (no medical claims).
4. Phản hồi của bạn PHẢI là một đối tượng JSON hợp lệ có định dạng như sau:
{
  "product": {
    "name": "Tên sản phẩm",
    "brand_name": "Tên thương hiệu",
    "category_name": "Tên danh mục",
    "short_description": "Tóm tắt ngắn gọn mô tả sản phẩm (tối đa 2-3 câu)"
  },
  "pricing": {
    "retail": [
      { "sku": "SKU", "size_label": "Dung tích/kích thước", "price": "Giá lẻ" }
    ],
    "salon": [
      { "sku": "SKU", "size_label": "Dung tích/kích thước", "price": "Giá chuyên dụng" }
    ]
  },
  "knowledge": {
    "benefits": ["Công dụng 1", "Công dụng 2", ...],
    "skin_types": ["Loại da phù hợp 1", ...],
    "usage": ["Bước 1...", "Bước 2...", ...],
    "sales_notes": ["Lưu ý bán hàng 1...", ...],
    "warnings": ["Cảnh báo 1...", ...]
  },
  "footer_note": "Ghi chú chân trang chuyên nghiệp (ví dụ: Tài liệu lưu hành nội bộ Desembre...)"
}`;

    const userPrompt = `=== DỮ LIỆU ĐẦU VÀO SẢN PHẨM ===\n${JSON.stringify(inputData, null, 2)}`;

    // 6. Call OpenAI
    const aiResult = await callOpenAI(userPrompt, systemPrompt, aiConfig);
    let contentJson = {};
    try {
      contentJson = JSON.parse(aiResult.content);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON content:", aiResult.content);
      throw new Error("AI returned invalid JSON structure.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        catalog_product_id: catalogProductId,
        template_id: templateId || null,
        title: `Sales Sheet - ${product.name}`,
        content_json: contentJson,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
