import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { provider, model } = await req.json();
    // Currently only OpenAI is supported for connection test
    if (provider !== "openai") {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "Provider not supported in MVP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
    if (!openAiKey) {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "OPENAI_API_KEY not configured in Supabase Secrets" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Simple health check: call OpenAI models list endpoint
    const resp = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: { "Authorization": `Bearer ${openAiKey}` },
    });
    if (!resp.ok) {
      const err = await resp.text();
      return new Response(
        JSON.stringify({ configured: true, status: "fail", message: `OpenAI API error: ${err}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
