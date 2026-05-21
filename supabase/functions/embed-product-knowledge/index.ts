import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";

    if (!openAiKey) {
      throw new Error("Missing OPENAI_API_KEY environment variable");
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { productId, chunkType, content, metadata = {} } = body;

    if (!productId || !chunkType || !content) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: productId, chunkType, content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call OpenAI Embeddings API
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: content,
        model: "text-embedding-3-small" // 1536 dimensions
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`OpenAI API error: ${err}`);
    }

    const result = await response.json();
    const embedding = result.data[0].embedding;

    // Insert into DB
    const { data, error } = await adminClient
      .from("product_knowledge_chunks")
      .insert({
        product_id: productId,
        chunk_type: chunkType,
        content: content,
        embedding: embedding,
        metadata: metadata
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, chunkId: data.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Embedding Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
