import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptApiKey, decryptApiKey } from "../_shared/crypto-utils.ts";

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

    // Security: Require JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ status: "error", message: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ status: "error", message: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Security: Check Role Admin/Sub-admin via RPC
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdminResult, error: roleError } = await adminClient.rpc(
      "is_admin_or_sub_admin",
      { user_id: user.id }
    );
    if (roleError || !isAdminResult) {
      return new Response(
        JSON.stringify({ status: "error", message: "Forbidden: Admins only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action } = body;

    // ─── Actions ─────────────────────────────────────────────────────────────

    if (action === "save_ai_provider_settings") {
      const { provider = 'openai', api_key, api_base_url, chat_model, embedding_model, rag_use_rpc_brand_filter } = body;
      
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: user.id
      };
      
      if (chat_model) updateData.chat_model = chat_model;
      if (embedding_model) updateData.embedding_model = embedding_model;
      if (api_base_url !== undefined) updateData.api_base_url = api_base_url;
      if (rag_use_rpc_brand_filter !== undefined) updateData.rag_use_rpc_brand_filter = rag_use_rpc_brand_filter;

      if (api_key && api_key.trim() !== "") {
        const { ciphertext, mask } = await encryptApiKey(api_key);
        updateData.encrypted_api_key = ciphertext;
        updateData.key_mask = mask;
      }

      const { data: existing } = await adminClient
        .from("system_ai_provider_settings")
        .select("id")
        .eq("provider", provider)
        .single();

      if (existing) {
        const { error: updateError } = await adminClient
          .from("system_ai_provider_settings")
          .update(updateData)
          .eq("id", existing.id);
        if (updateError) throw updateError;
      } else {
        updateData.provider = provider;
        const { error: insertError } = await adminClient
          .from("system_ai_provider_settings")
          .insert(updateData);
        if (insertError) throw insertError;
      }

      return new Response(
        JSON.stringify({ status: "success", message: "Cấu hình AI đã được lưu an toàn." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "get_ai_settings_status") {
      const { provider = 'openai' } = body;
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("provider, api_base_url, key_mask, chat_model, embedding_model, rag_use_rpc_brand_filter, last_tested_at, last_test_status, encrypted_api_key")
        .eq("provider", provider)
        .single();
      
      const isConfigured = !!settings?.encrypted_api_key;

      return new Response(
        JSON.stringify({
          status: "success",
          provider: settings?.provider || provider,
          api_base_url: settings?.api_base_url || "",
          key_configured: isConfigured,
          key_mask: settings?.key_mask || "",
          chat_model: settings?.chat_model || "gpt-4o-mini",
          embedding_model: settings?.embedding_model || "text-embedding-3-small",
          rag_use_rpc_brand_filter: settings?.rag_use_rpc_brand_filter || false,
          last_tested_at: settings?.last_tested_at,
          last_test_status: settings?.last_test_status || "untested",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "test_openai_connection") {
      const { provider = 'openai' } = body;
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("id, encrypted_api_key, api_base_url")
        .eq("provider", provider)
        .single();
      
      let key = null;
      if (settings?.encrypted_api_key) {
        key = await decryptApiKey(settings.encrypted_api_key);
      } else {
        key = Deno.env.get("OPENAI_API_KEY");
      }
      
      if (!key) {
        return new Response(
          JSON.stringify({ status: "error", message: "OPENAI_API_KEY chưa được cấu hình." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const baseUrl = settings?.api_base_url || "https://api.openai.com/v1";
      
      try {
        const resp = await fetch(`${baseUrl}/models`, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });

        const isSuccess = resp.ok;
        const msg = isSuccess ? "Connection successful" : `Provider API returned ${resp.status}`;
        
        if (settings?.id) {
          await adminClient.from("system_ai_provider_settings").update({
            last_tested_at: new Date().toISOString(),
            last_test_status: isSuccess ? 'success' : 'failed',
            last_test_message: msg
          }).eq("id", settings.id);
        }

        if (!isSuccess) {
          return new Response(
            JSON.stringify({ status: "error", message: msg }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ status: "success", message: msg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (err: any) {
        if (settings?.id) {
          await adminClient.from("system_ai_provider_settings").update({
            last_tested_at: new Date().toISOString(),
            last_test_status: 'failed',
            last_test_message: err.message
          }).eq("id", settings.id);
        }
        throw err;
      }
    }

    if (action === "test_rag_retrieval") {
      // For now, simulate success
      return new Response(
        JSON.stringify({ status: "success", message: "RAG Retrieval test simulated (No DB interaction in MVP)" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "trigger_staging_reindex") {
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("encrypted_api_key")
        .eq("provider", "openai")
        .single();
        
      const key = settings?.encrypted_api_key ? await decryptApiKey(settings.encrypted_api_key) : Deno.env.get("OPENAI_API_KEY");
      if (!key) {
        return new Response(
          JSON.stringify({ status: "error", message: "OPENAI_API_KEY chưa được cấu hình." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Loop through all approved product_knowledge and call embed-product-knowledge
      const { data: pks } = await adminClient
        .from("product_knowledge")
        .select("id")
        .eq("qa_status", "approved");

      let successCount = 0;
      const authHeader = req.headers.get("Authorization") || "";

      for (const pk of pks || []) {
        try {
          const res = await fetch(`${supabaseUrl}/functions/v1/embed-product-knowledge`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader
            },
            body: JSON.stringify({ productKnowledgeId: pk.id, rebuild: true })
          });
          if (res.ok) successCount++;
        } catch (e) {
          console.error("Reindex error for pk", pk.id, e);
        }
      }

      return new Response(
        JSON.stringify({ status: "success", message: `Đã reindex thành công ${successCount} sản phẩm.` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "error", message: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(JSON.stringify({ status: "error", message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
