import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple text chunking helper
function splitTextIntoChunks(text: string, maxTokens = 500): string[] {
  // Rough estimate: 1 token ~= 4 characters
  const maxChars = maxTokens * 4;
  if (!text) return [];

  const paragraphs = text.split("\n\n").filter((p) => p.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const p of paragraphs) {
    if (currentChunk.length + p.length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = p;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + p;
    }
  }
  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // 1. Kiểm tra user auth (The request must contain a valid auth header)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    // Client for verifying user (RLS restricted)
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Admin client for DB operations bypassing RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // --- Phase I: Load AI settings and check module toggle ---
    const { data: aiSettings, error: aiError } = await adminClient
      .from("ai_settings")
      .select("*")
      .eq("id", "default")
      .single();
    if (aiError || !aiSettings) {
      throw new Error("Failed to load AI settings");
    }

    const openAiKey = aiSettings.openai_api_key || Deno.env.get("OPENAI_API_KEY") || "";
    if (!openAiKey) {
      throw new Error("Chưa cấu hình OpenAI API Key. Vui lòng thiết lập trong Cấu hình AI.");
    }

    // Ensure provider is openai (MVP)
    if (aiSettings.provider !== "openai") {
      throw new Error("Embedding provider must be OpenAI in MVP");
    }
    // Check module toggle: product tutor must be enabled for embedding
    if (!aiSettings.module_product_tutor) {
      return new Response(JSON.stringify({ error: "AI module này đang bị Admin tắt." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Use embedding model from settings
    const embeddingModel = aiSettings.embedding_model || "text-embedding-3-small";

    // 2. Kiểm tra Admin/Sub Admin
    const { data: rolesData, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = rolesData?.some((r) => r.role === "admin" || r.role === "sub_admin");
    const isMasterAdmin = user.email === "desembrevn.com@gmail.com"; // from seed

    if (!isAdmin && !isMasterAdmin) {
      throw new Error("Forbidden: Only Admin or Sub Admin can build embeddings");
    }

    const body = await req.json();
    const { productKnowledgeId, rebuild = false } = body;

    if (!productKnowledgeId) {
      throw new Error("Missing required field: productKnowledgeId");
    }

    // 3. Load product_knowledge
    let pkQuery = adminClient.from("product_knowledge").select("*");
    // Support either UUID or Integer product_id
    if (
      String(productKnowledgeId).match(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      )
    ) {
      pkQuery = pkQuery.eq("id", productKnowledgeId);
    } else {
      pkQuery = pkQuery.eq("product_id", parseInt(productKnowledgeId));
    }

    const { data: pkData, error: pkError } = await pkQuery.single();

    if (pkError || !pkData) {
      throw new Error(`Product knowledge not found: ${pkError?.message || ""}`);
    }

    // 4. Kiểm tra qa_status = 'approved' và is_active = true
    if (pkData.qa_status !== "approved" || pkData.is_active !== true) {
      throw new Error("Only approved and active product knowledge can be embedded");
    }

    // 5. Set build_status = processing
    await adminClient
      .from("product_knowledge")
      .update({ build_status: "processing" })
      .eq("id", pkData.id);

    try {
      let currentVersion = pkData.knowledge_version || 1;

      // 6. Nếu rebuild
      if (rebuild) {
        // mark old chunks is_active = false
        await adminClient
          .from("product_knowledge_chunks")
          .update({ is_active: false })
          .eq("product_id", pkData.product_id)
          .eq("is_active", true);

        currentVersion += 1;

        // update knowledge_version
        await adminClient
          .from("product_knowledge")
          .update({ knowledge_version: currentVersion })
          .eq("id", pkData.id);
      }

      // 7. Chunk text từ các field
      const fieldsToChunk = [
        {
          name: "Sản phẩm",
          text: pkData.product_name || `Sản phẩm ID ${pkData.product_id}`,
          type: "general",
        },
        { name: "Mô tả ngắn", text: pkData.short_description, type: "general" },
        { name: "Công dụng", text: pkData.benefits, type: "benefit" },
        {
          name: "Thành phần nổi bật",
          text: pkData.ingredient_highlights ? pkData.ingredient_highlights.join(", ") : "",
          type: "ingredient",
        },
        {
          name: "Loại da phù hợp",
          text: pkData.skin_types ? pkData.skin_types.join(", ") : "",
          type: "instruction",
        },
        {
          name: "Vấn đề da",
          text: pkData.skin_concerns ? pkData.skin_concerns.join(", ") : "",
          type: "instruction",
        },
        { name: "Hướng dẫn sử dụng", text: pkData.usage_instructions, type: "instruction" },
        { name: "Sales pitch (Tư vấn)", text: pkData.sales_pitch, type: "sales_pitch" },
        { name: "Cảnh báo", text: pkData.warnings, type: "instruction" },
        { name: "Chống chỉ định", text: pkData.contraindications, type: "instruction" },
      ];

      // Format text blocks clearly
      const chunksToEmbed: { text: string; type: string }[] = [];

      let generalText = "";
      fieldsToChunk.forEach((field) => {
        if (field.text && String(field.text).trim().length > 0) {
          generalText += `[${field.name}]\n${field.text}\n\n`;
        }
      });

      const textChunks = splitTextIntoChunks(generalText, 500);
      textChunks.forEach((text) => {
        chunksToEmbed.push({ text, type: "document" });
      });

      // Also get product_objections if any
      const { data: objectionsData } = await adminClient
        .from("product_objections")
        .select("*")
        .eq("product_id", pkData.product_id)
        .eq("is_active", true);

      if (objectionsData && objectionsData.length > 0) {
        for (const obj of objectionsData) {
          const objText = `[Từ chối/Khách hỏi]\nLoại: ${obj.objection_type}\nKhách hàng: ${obj.customer_statement}\nPhản hồi đề xuất: ${obj.suggested_response}`;
          chunksToEmbed.push({ text: objText, type: "objection" });
        }
      }

      if (chunksToEmbed.length === 0) {
        throw new Error("No text content available to chunk");
      }

      // 8. Generate embedding for each chunk
      const insertedChunks = [];

      // We process sequentially or in small batches to avoid rate limits
      for (const chunk of chunksToEmbed) {
        const response = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openAiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            input: chunk.text,
            model: embeddingModel, // use model from ai_settings
          }),
        });

        if (!response.ok) {
          const err = await response.text();
          throw new Error(`OpenAI API error: ${err}`);
        }

        const result = await response.json();
        const embedding = result.data[0].embedding;

        // 9. Insert chunks vào product_knowledge_chunks
        const { data: insertedChunk, error: insertError } = await adminClient
          .from("product_knowledge_chunks")
          .insert({
            product_id: pkData.product_id,
            chunk_type: chunk.type,
            content: chunk.text,
            embedding: embedding,
            metadata: {
              product_name: pkData.product_name,
              source: "product_knowledge",
              knowledge_version: currentVersion,
            },
            knowledge_version: currentVersion,
            is_active: true,
          })
          .select("id")
          .single();

        if (insertError) {
          throw new Error(`DB Insert Error: ${insertError.message}`);
        }

        insertedChunks.push(insertedChunk.id);
      }

      // 10. Set build_status = completed
      await adminClient
        .from("product_knowledge")
        .update({
          build_status: "completed",
          last_embedded_at: new Date().toISOString(),
          embedding_error: null,
        })
        .eq("id", pkData.id);

      return new Response(
        JSON.stringify({
          success: true,
          chunkCount: insertedChunks.length,
          knowledgeVersion: currentVersion,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (processError: any) {
      // 11. Nếu lỗi: set build_status = failed
      console.error("Processing Error:", processError);

      await adminClient
        .from("product_knowledge")
        .update({
          build_status: "failed",
          embedding_error: processError.message || String(processError),
        })
        .eq("id", pkData.id);

      throw processError; // Re-throw to be caught by outer catch block
    }
  } catch (error: any) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
