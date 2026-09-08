import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptApiKey } from "../_shared/crypto-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  if (!apiKey) {
    throw new Error(
      "Chưa cấu hình OPENAI_API_KEY trong Supabase Secret. Vui lòng thiết lập secret.",
    );
  }

  // Diagnostic logging without exposing the key
  console.log("[generate-product-sales-sheet] Calling OpenAI with config:", {
    hasKey: Boolean(apiKey),
    keyPrefix: apiKey.slice(0, 7),
    keyLength: apiKey.length,
    model,
  });

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
    console.error(
      `[generate-product-sales-sheet] OpenAI API error ${res.status}:`,
      errBody,
    );

    if (res.status === 401 || errBody.includes("invalid_api_key")) {
      throw new Error(
        "OPENAI_API_KEY trong Supabase Secret không hợp lệ hoặc đã hết hiệu lực. Vui lòng cập nhật secret.",
      );
    }
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
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user is Admin or Sub Admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: isAdmin, error: roleError } = await adminClient.rpc("is_admin_or_sub_admin", {
      user_id: user.id,
    });

    if (roleError || !isAdmin) {
      return new Response(
        JSON.stringify({
          error: "Access denied. Only Admin or Sub Admin can generate sales sheets.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Parse request payload
    const body = await req.json();
    const { catalogProductId, templateId } = body;
    if (!catalogProductId) {
      return new Response(JSON.stringify({ error: "catalogProductId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load product catalog data
    const { data: product, error: productErr } = await adminClient
      .from("catalog_products")
      .select(
        `
        id, 
        name, 
        product_code, 
        description, 
        image_url, 
        brand_id, 
        brand:product_brands(name), 
        category:product_categories(name)
      `,
      )
      .eq("id", catalogProductId)
      .single();

    if (productErr || !product) {
      return new Response(JSON.stringify({ error: "Catalog product not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load variants
    const { data: variants } = await adminClient
      .from("catalog_product_variants")
      .select("sku, channel, size_label, price")
      .eq("product_id", catalogProductId)
      .eq("is_active", true);

    // ─── GATE 1 & 2: Verify Source Documents (Guidebook) ─────────────────────
    // Rule 1: product_source_documents là nguồn gốc bắt buộc.
    // Rule 2: Nếu sản phẩm không có source document => Chặn tạo Sales Sheet.
    // Rule 3: Nếu source document có nhưng extraction_status != completed => Chặn tạo Sales Sheet.
    const { data: sourceDocs, error: srcDocErr } = await adminClient
      .from("product_source_documents")
      .select(
        "id, document_type, extraction_status, extracted_data, file_name, source_type, raw_text, extracted_text",
      )
      .eq("catalog_product_id", catalogProductId);

    if (srcDocErr) {
      console.error("[generate-product-sales-sheet] Error querying source documents:", srcDocErr);
    }

    if (!sourceDocs || sourceDocs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Chưa có Guidebook. Vui lòng nhập Guidebook/Text nguồn trước khi tạo Sales Sheet.",
          code: "MISSING_GUIDEBOOK",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const completedDocs = sourceDocs.filter((d: any) => d.extraction_status === "completed");
    if (completedDocs.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Guidebook chưa trích xuất. Vui lòng hoàn tất trích xuất Guidebook trước khi tạo Sales Sheet.",
          code: "GUIDEBOOK_NOT_EXTRACTED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ─── GATE 3: Verify Approved & Active Product Knowledge ──────────────────
    // Rule 4: Nếu đã trích xuất nhưng product_knowledge chưa approved => Chặn tạo Sales Sheet.
    // Rule 5: Chỉ tạo khi extraction_status = completed AND qa_status = approved AND is_active = true.
    let knowledgeQuery = adminClient
      .from("product_knowledge")
      .select(
        "benefits, skin_concerns, suitable_spa_types, usage_instructions, sales_pitch, warnings, skin_types, ingredient_highlights, qa_status, is_active, full_ingredients, product_characteristics, key_ingredients_functions",
      );

    if (product.product_code && !isNaN(Number(product.product_code))) {
      knowledgeQuery = knowledgeQuery.or(
        `catalog_product_id.eq.${catalogProductId},product_id.eq.${Number(product.product_code)}`,
      );
    } else {
      knowledgeQuery = knowledgeQuery.eq("catalog_product_id", catalogProductId);
    }

    const { data: knowledge } = await knowledgeQuery.maybeSingle();

    if (!knowledge || knowledge.qa_status !== "approved" || !knowledge.is_active) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Tri thức AI chưa duyệt. Vui lòng duyệt Tri thức AI trước khi tạo Sales Sheet.",
          code: "KNOWLEDGE_NOT_APPROVED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 4. Retrieve OpenAI API Key: Priority #1 DB encrypted key, Priority #2 Supabase secret
    let openaiApiKey = "";
    let keySource = "none";
    let chatModel = "gpt-4o-mini";
    try {
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("encrypted_api_key, chat_model, is_enabled")
        .eq("provider", "openai")
        .single();

      if (settings?.encrypted_api_key) {
        const decrypted = await decryptApiKey(settings.encrypted_api_key);
        if (decrypted && decrypted.trim()) {
          openaiApiKey = decrypted.trim().replace(/^["']|["']$/g, "").trim();
          keySource = "database";
        }
      }
      if (settings?.chat_model) {
        chatModel = settings.chat_model;
      }
    } catch (e) {
      console.error("[generate-product-sales-sheet] Failed to read key from DB:", e);
    }

    // Fallback to Supabase secret ONLY if database has no valid key
    if (!openaiApiKey) {
      const envKey = Deno.env.get("OPENAI_API_KEY") || "";
      if (envKey && envKey.trim()) {
        openaiApiKey = envKey.trim().replace(/^["']|["']$/g, "").trim();
        keySource = "secret";
      }
    }

    console.log("[generate-product-sales-sheet] Resolved API key:", {
      keySource,
      hasKey: Boolean(openaiApiKey),
      keyPrefix: openaiApiKey ? openaiApiKey.slice(0, 7) : "",
      keySuffix: openaiApiKey ? openaiApiKey.slice(-4) : "",
      keyLength: openaiApiKey ? openaiApiKey.length : 0,
      chatModel,
    });

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Chưa cấu hình OPENAI_API_KEY. Vui lòng thiết lập trong Cấu hình AI (/admin/ai-settings).",
          code: "MISSING_OPENAI_KEY",
        }),
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
      .map(
        (v: any) =>
          `- SKU: ${v.sku}, Dung tích: ${v.size_label || "Mặc định"}, Giá: ${formatCurrencyVND(v.price)}`,
      );

    const salonVariants = (variants || [])
      .filter((v: any) => v.channel === "salon")
      .map(
        (v: any) =>
          `- SKU: ${v.sku}, Dung tích: ${v.size_label || "Mặc định"}, Giá: ${formatCurrencyVND(v.price)}`,
      );

    // Extract raw guidebook texts and extracted_data
    const rawGuidebookTexts = completedDocs
      .map((d: any) => d.raw_text || d.extracted_text || "")
      .filter((t: string) => Boolean(t && t.trim()));

    const guidebookExtractedDataList = completedDocs
      .map((d: any) => d.extracted_data)
      .filter((ed: any) => ed && typeof ed === "object");

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
      approved_knowledge: {
        benefits: knowledge.benefits || "",
        skin_concerns: knowledge.skin_concerns || [],
        suitable_spa_types: knowledge.suitable_spa_types || [],
        usage_instructions: knowledge.usage_instructions || "",
        sales_pitch: knowledge.sales_pitch || "",
        warnings: knowledge.warnings || "",
        skin_types: knowledge.skin_types || [],
        ingredient_highlights: knowledge.ingredient_highlights || [],
        full_ingredients: (knowledge as any).full_ingredients || "",
        product_characteristics: (knowledge as any).product_characteristics || "",
        key_ingredients_functions: (knowledge as any).key_ingredients_functions || [],
      },
      raw_guidebook_texts: rawGuidebookTexts,
      extracted_guidebook_data: guidebookExtractedDataList,
    };

    const systemPrompt = `Bạn là chuyên gia tư vấn sản phẩm và xây dựng tài liệu bán hàng (Product Sales Sheet) cho thương hiệu mỹ phẩm cao cấp Desembre.
Nhiệm vụ của bạn là tổng hợp và viết nội dung tài liệu bán hàng A4 cho sản phẩm dưới đây CHỈ DỰA TRÊN thông tin chính xác từ Tri thức AI đã duyệt và Tài liệu nguồn (Guidebook) đã trích xuất.

QUY TẮC BẮT BUỘC (CHỐNG BỊA ĐẶT & CHỐNG TRÙNG LẶP THÀNH PHẦN):
1. TUYỆT ĐỐI KHÔNG tự bịa đặt hay suy diễn thông tin ngoài dữ liệu được cung cấp.
2. QUY TẮC BẢO VỆ PHÂN TẦNG THÀNH PHẦN (CHỐNG TRÙNG LẶP NỘI DUNG):
   - "key_ingredients": BẮT BUỘC là danh sách chi tiết thành phần chính kèm chức năng theo cấu trúc "Tên thành phần: Chức năng/Lợi ích" (Ví dụ: ["Tinh dầu hạt mắc ca: Cung cấp độ ẩm sâu và làm mềm mượt da", "Glycerin: Giữ nước và duy trì độ ẩm tự nhiên cho da", "Allantoin: Làm dịu da và thúc đẩy tái tạo tế bào"]). Lấy từ key_ingredients_functions.
   - "ingredient_highlights": CHỈ CHỨA danh sách tên thành phần ngắn gọn / tags (Ví dụ: ["Tinh dầu hạt mắc ca", "Glycerin", "Allantoin"]). TUYỆT ĐỐI KHÔNG sao chép mô tả chức năng vào đây. TUYỆT ĐỐI KHÔNG sao chép key_ingredients vào ingredient_highlights.
   - "full_ingredients": Toàn bộ bảng thành phần đầy đủ dưới dạng văn bản (text), chỉ hiển thị một lần duy nhất. Nếu không có trong tài liệu, ghi rõ: "Chưa có thông tin trong tài liệu nguồn."
3. NẾU một phần thông tin KHÔNG có trong dữ liệu nguồn (ví dụ không có cảnh báo/chống chỉ định, không có danh sách thành phần đầy đủ, hoặc trường tương ứng bị rỗng):
   - BẮT BUỘC ghi rõ: "Chưa có thông tin trong tài liệu nguồn."
   - TUYỆT ĐỐI KHÔNG để mảng rỗng [] hay chuỗi trống "", KHÔNG để trống ô (No empty boxes).
4. Không quảng cáo quá đà, không đưa ra cam kết y khoa/chữa khỏi bệnh (no medical claims).
5. Phản hồi của bạn PHẢI là một đối tượng JSON hợp lệ có định dạng như sau:
{
  "product": {
    "name": "Tên sản phẩm",
    "brand_name": "Tên thương hiệu",
    "category_name": "Tên danh mục",
    "short_description": "Tóm tắt ngắn gọn mô tả và đặc tính sản phẩm (1-2 câu)"
  },
  "pricing": {
    "retail": [
      { "sku": "SKU", "size_label": "Dung tích/kích thước", "price": "Giá niêm yết" }
    ],
    "salon": [
      { "sku": "SKU", "size_label": "Dung tích/kích thước", "price": "Giá chuyên dụng" }
    ]
  },
  "knowledge": {
    "benefits": ["Công dụng 1", "Công dụng 2"],
    "key_ingredients": ["Tên thành phần A: chức năng...", ...],
    "ingredient_highlights": ["Tên thành phần ngắn 1", "Tên thành phần ngắn 2"],
    "full_ingredients": "Danh sách thành phần đầy đủ nếu có trong guidebook, hoặc 'Chưa có thông tin trong tài liệu nguồn.'",
    "skin_types": ["Loại da phù hợp 1", ...],
    "usage": ["Bước 1...", "Bước 2..."],
    "sales_notes": ["Lưu ý tư vấn (nếu có)...", ...],
    "warnings": ["Cảnh báo / chống chỉ định an toàn...", ...]
  },
  "footer_note": "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam."
}`;

    const userPrompt = `=== DỮ LIỆU ĐẦU VÀO TỪ TRI THỨC ĐÃ DUYỆT & GUIDEBOOK ĐÃ TRÍCH XUẤT ===\n${JSON.stringify(inputData, null, 2)}`;

    // 6. Call OpenAI
    const aiResult = await callOpenAI(userPrompt, systemPrompt, aiConfig);
    let contentJson: any = {};
    try {
      contentJson = JSON.parse(aiResult.content);
    } catch (parseErr) {
      console.error("Failed to parse AI JSON content:", aiResult.content);
      throw new Error("AI returned invalid JSON structure.");
    }

    // Defensive Post-processing: Ensure no empty sections remain (No empty boxes)
    const NO_INFO_MSG = "Chưa có thông tin trong tài liệu nguồn.";
    if (!contentJson.knowledge) contentJson.knowledge = {};
    const k = contentJson.knowledge;

    const sanitizeList = (val: any) => {
      if (!Array.isArray(val) || val.length === 0) return [NO_INFO_MSG];
      const valid = val.filter((item: any) => typeof item === "string" && item.trim() !== "");
      return valid.length > 0 ? valid : [NO_INFO_MSG];
    };

    k.benefits = sanitizeList(k.benefits);
    k.skin_types = sanitizeList(k.skin_types);
    k.usage = sanitizeList(k.usage);
    k.sales_notes = sanitizeList(k.sales_notes);
    k.warnings = sanitizeList(k.warnings);
    k.ingredient_highlights = sanitizeList(k.ingredient_highlights);
    k.key_ingredients = sanitizeList(k.key_ingredients);

    // Fallback full_ingredients from guidebook source if AI missed it
    if (!k.full_ingredients || typeof k.full_ingredients !== "string" || !k.full_ingredients.trim() || k.full_ingredients === NO_INFO_MSG) {
      const sourceFull =
        (knowledge as any).full_ingredients ||
        guidebookExtractedDataList.find((ed: any) => ed?.full_ingredients)?.full_ingredients;
      k.full_ingredients = sourceFull || NO_INFO_MSG;
    }

    // Fallback key_ingredients from guidebook source if AI returned NO_INFO_MSG
    if (k.key_ingredients.length === 1 && k.key_ingredients[0] === NO_INFO_MSG) {
      const sourceKeyFuncs =
        Array.isArray((knowledge as any).key_ingredients_functions) &&
        (knowledge as any).key_ingredients_functions.length > 0
          ? (knowledge as any).key_ingredients_functions
          : guidebookExtractedDataList.find(
              (ed: any) =>
                Array.isArray(ed?.key_ingredients_functions) &&
                ed.key_ingredients_functions.length > 0,
            )?.key_ingredients_functions;

      if (sourceKeyFuncs && sourceKeyFuncs.length > 0) {
        k.key_ingredients = sourceKeyFuncs.map((item: any) =>
          item.function ? `${item.name}: ${item.function}` : item.name,
        );
      }
      // REMOVED: do not copy ingredient_highlights into key_ingredients to prevent duplication
    }

    // Dedupe Guard: normalize ingredient_highlights to short tags only (strip function if included)
    if (Array.isArray(k.ingredient_highlights)) {
      k.ingredient_highlights = k.ingredient_highlights
        .map((item: string) => {
          if (typeof item === "string") {
            const colonIdx = item.indexOf(":");
            if (colonIdx !== -1) {
              return item.slice(0, colonIdx).replace(/^[-*•\d.]+\s*/, "").trim();
            }
            return item.replace(/^[-*•\d.]+\s*/, "").trim();
          }
          return item;
        })
        .filter((item: string) => Boolean(item && item !== NO_INFO_MSG));

      if (k.ingredient_highlights.length === 0) {
        k.ingredient_highlights = [NO_INFO_MSG];
      }
    }

    // Fallback short_description from characteristics or description
    if (!contentJson.product?.short_description?.trim() || contentJson.product.short_description === NO_INFO_MSG) {
      if (!contentJson.product) contentJson.product = {};
      const sourceChar =
        (knowledge as any).product_characteristics ||
        guidebookExtractedDataList.find((ed: any) => ed?.product_characteristics)?.product_characteristics;
      contentJson.product.short_description = sourceChar || product.description || NO_INFO_MSG;
    }

    // Customer-facing Footer Note fallback
    if (!contentJson.footer_note || typeof contentJson.footer_note !== "string" || !contentJson.footer_note.trim() || contentJson.footer_note.includes("nội bộ")) {
      contentJson.footer_note = "Thông tin sản phẩm được cung cấp bởi Desembre Vietnam.";
    }

    return new Response(
      JSON.stringify({
        success: true,
        catalog_product_id: catalogProductId,
        template_id: templateId || null,
        title: `Sales Sheet - ${product.name}`,
        content_json: contentJson,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
