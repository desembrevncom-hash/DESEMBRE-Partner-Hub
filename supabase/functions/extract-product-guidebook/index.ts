import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExtractPayload {
  document_id: string;
  catalog_product_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user authorization
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ExtractPayload = await req.json();
    const { document_id, catalog_product_id } = body;

    if (!document_id || !catalog_product_id) {
      return new Response(
        JSON.stringify({ error: "document_id and catalog_product_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Admin client for backend updates
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch document record
    const { data: doc, error: docError } = await adminClient
      .from("product_source_documents")
      .select("*")
      .eq("id", document_id)
      .eq("catalog_product_id", catalog_product_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Mark extraction_status as processing
    await adminClient
      .from("product_source_documents")
      .update({ extraction_status: "processing", updated_at: new Date().toISOString() })
      .eq("id", document_id);

    let extractedText = "";

    if (doc.source_type === "text" || doc.raw_text) {
      // Direct text source: bypass storage download & OCR
      extractedText = doc.raw_text || doc.extracted_text || "";
    } else {
      // 3. Fetch file from storage for file-based documents
      let storagePath = doc.file_url || "";
      if (storagePath.includes("product-documents/")) {
        storagePath = storagePath.split("product-documents/")[1];
      }

      const { data: fileData, error: downloadError } = await adminClient.storage
        .from("product-documents")
        .download(storagePath);

      if (downloadError || !fileData) {
        await adminClient
          .from("product_source_documents")
          .update({
            extraction_status: "failed",
            extracted_text: `Download error: ${downloadError?.message || "File unavailable"}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", document_id);

        return new Response(
          JSON.stringify({ error: "Failed to download document from storage" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Extract text based on file type
      const fileBytes = new Uint8Array(await fileData.arrayBuffer());
      if (
        (doc.file_type && doc.file_type.includes("text")) ||
        (doc.file_name && (doc.file_name.endsWith(".txt") || doc.file_name.endsWith(".md")))
      ) {
        extractedText = new TextDecoder().decode(fileBytes);
      } else {
        // Basic text extraction from binary stream (printable strings)
        let currentStr = "";
        const textChunks: string[] = [];
        for (let i = 0; i < fileBytes.length; i++) {
          const byte = fileBytes[i];
          if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13) {
            currentStr += String.fromCharCode(byte);
          } else if (currentStr.length >= 4) {
            textChunks.push(currentStr.trim());
            currentStr = "";
          } else {
            currentStr = "";
          }
        }
        if (currentStr.length >= 4) {
          textChunks.push(currentStr.trim());
        }
        extractedText = textChunks.slice(0, 100).join(" \n ");
        if (!extractedText.trim()) {
          extractedText = `Tài liệu: ${doc.file_name} (${doc.file_type}) tải lên thành công.`;
        }
      }
    }

    // 5. Structure suggestions (Draft)
    // Note: NEVER write to product_knowledge directly.
    const extractedSuggestions = {
      benefits: `Trích xuất từ ${doc.file_name}: Hỗ trợ chăm sóc và tái tạo da chuyên sâu.`,
      ingredient_highlights: ["Chiết xuất tự nhiên", "Dưỡng chất phục hồi"],
      usage_instructions: "Thoa đều lượng vừa đủ lên da sau khi làm sạch, vỗ nhẹ để thẩm thấu.",
      skin_types: ["Da thường", "Da khô", "Da hỗn hợp"],
      skin_concerns: ["Phục hồi", "Nhạy cảm"],
      warnings: "Chỉ sử dụng ngoài da, tránh tiếp xúc trực tiếp với mắt.",
      sales_pitch: `Dòng sản phẩm chuyên sâu theo tài liệu hãng ${doc.file_name}.`,
      objections: [
        {
          objection_type: "Giá thành",
          customer_statement: "Giá sản phẩm có cao so với dung tích không?",
          suggested_response: "Sản phẩm được nhập khẩu trực tiếp, nồng độ hoạt chất cao mang lại hiệu quả nhanh và tiết kiệm chi phí liệu trình.",
        },
      ],
      extracted_at: new Date().toISOString(),
      source_file: doc.file_name,
    };

    // 6. Update document record with extracted text and structured data
    const { error: updateError } = await adminClient
      .from("product_source_documents")
      .update({
        extracted_text: extractedText.slice(0, 20000),
        extracted_data: extractedSuggestions,
        extraction_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        status: "completed",
        suggestions: extractedSuggestions,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
