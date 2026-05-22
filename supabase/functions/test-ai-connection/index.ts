import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider, model, openai_api_key } = await req.json();
    // Currently only OpenAI is supported for connection test
    if (provider !== "openai") {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "Provider not supported in MVP" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let openAiKey = openai_api_key;

    // If key contains mask indicator or is empty, try loading it from DB
    if (!openAiKey || openAiKey.includes("...") || openAiKey === "••••••••") {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (supabaseUrl && supabaseServiceKey) {
          const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          const { data } = await supabaseClient
            .from("ai_settings")
            .select("openai_api_key")
            .eq("id", "default")
            .single();
          if (data?.openai_api_key) {
            openAiKey = data.openai_api_key;
          }
        }
      } catch (err) {
        console.error("Failed to load key from DB:", err);
      }
    }

    // Fallback to Deno.env if still not set
    if (!openAiKey) {
      openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    }

    if (!openAiKey) {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "OPENAI_API_KEY not configured. Vui lòng nhập API Key." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simple health check: call OpenAI models list endpoint
    const resp = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { "Authorization": `Bearer ${openAiKey}` },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = errText;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.error?.message) {
          errMsg = errObj.error.message;
        }
      } catch (_) {
        // fallback to raw text if not valid JSON
      }
      return new Response(
        JSON.stringify({ configured: true, status: "fail", message: `OpenAI API error: ${errMsg}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Optionally verify requested model exists (basic check)
    const modelsData = await resp.json();
    const hasModel = modelsData.data?.some((m: any) => m.id === model);
    const message = hasModel
      ? `Connection successful, model ${model} is available.`
      : `Connection successful, but model ${model} not found.`;

    return new Response(
      JSON.stringify({ configured: true, status: "pass", message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(
      JSON.stringify({ configured: false, status: "fail", message: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
