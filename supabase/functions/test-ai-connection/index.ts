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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // ── Phase P3: Require valid JWT ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the token and get user identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify caller is Admin or Sub Admin using admin client (service role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdminResult, error: roleError } = await adminClient.rpc("is_admin_or_sub_admin", {
      user_id: user.id,
    });
    if (roleError || !isAdminResult) {
      return new Response(
        JSON.stringify({ configured: false, status: "fail", message: "Forbidden: only Admin or Sub Admin can test AI connection" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    // ── End Phase P3 guard ─────────────────────────────────────────────────────

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
        if (supabaseUrl && supabaseServiceKey) {
          const { data } = await adminClient
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
