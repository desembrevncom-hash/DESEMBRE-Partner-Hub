import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptApiKey, decryptApiKey } from "../_shared/crypto-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: corsHeaders,
    });
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
      return new Response(JSON.stringify({ status: "error", message: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: Check Role Admin/Sub-admin via RPC
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: isAdminResult, error: roleError } = await adminClient.rpc(
      "is_admin_or_sub_admin",
      { user_id: user.id },
    );
    if (roleError || !isAdminResult) {
      return new Response(JSON.stringify({ status: "error", message: "Forbidden: Admins only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ─── Actions ─────────────────────────────────────────────────────────────

    if (action === "save_ai_provider_settings") {
      const {
        provider = "openai",
        api_key,
        api_base_url,
        chat_model,
        embedding_model,
        rag_use_rpc_brand_filter,
      } = body;

      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      };

      if (chat_model) updateData.chat_model = chat_model;
      if (embedding_model) updateData.embedding_model = embedding_model;
      if (api_base_url !== undefined) updateData.api_base_url = api_base_url;
      if (rag_use_rpc_brand_filter !== undefined)
        updateData.rag_use_rpc_brand_filter = rag_use_rpc_brand_filter;

      if (api_key && typeof api_key === "string" && api_key.trim() !== "") {
        const cleanedKey = api_key.trim().replace(/^["']|["']$/g, "").trim();
        const { ciphertext, mask } = await encryptApiKey(cleanedKey);
        updateData.encrypted_api_key = ciphertext;
        updateData.key_mask = mask;
      } else if (body.clear_key === true) {
        updateData.encrypted_api_key = null;
        updateData.key_mask = null;
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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "clear_ai_provider_key") {
      const { provider = "openai" } = body;
      await adminClient
        .from("system_ai_provider_settings")
        .update({
          encrypted_api_key: null,
          key_mask: null,
          last_tested_at: null,
          last_test_status: "untested",
          last_test_message: null,
          updated_at: new Date().toISOString(),
          updated_by: user.id,
        })
        .eq("provider", provider);

      return new Response(
        JSON.stringify({ status: "success", message: "Đã xóa API key đã lưu trong Database." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "get_ai_settings_status") {
      const { provider = "openai" } = body;
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select(
          "provider, api_base_url, key_mask, chat_model, embedding_model, rag_use_rpc_brand_filter, last_tested_at, last_test_status, encrypted_api_key",
        )
        .eq("provider", provider)
        .single();

      const hasDbKey = !!settings?.encrypted_api_key;
      const hasSecretKey = !!Deno.env.get("OPENAI_API_KEY");
      const keySource = hasDbKey ? "database" : hasSecretKey ? "secret" : "none";

      return new Response(
        JSON.stringify({
          status: "success",
          provider: settings?.provider || provider,
          api_base_url: settings?.api_base_url || "",
          key_configured: hasDbKey || hasSecretKey,
          key_source: keySource,
          key_mask: settings?.key_mask || "",
          chat_model: settings?.chat_model || "gpt-4o-mini",
          embedding_model: settings?.embedding_model || "text-embedding-3-small",
          rag_use_rpc_brand_filter: settings?.rag_use_rpc_brand_filter || false,
          last_tested_at: settings?.last_tested_at,
          last_test_status: settings?.last_test_status || "untested",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "test_openai_connection") {
      const { provider = "openai" } = body;
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("id, encrypted_api_key, api_base_url, chat_model")
        .eq("provider", provider)
        .single();

      let key: string | null = null;
      let keySource: "database" | "secret" | "none" = "none";

      // 1. Check database encrypted key first
      if (settings?.encrypted_api_key) {
        try {
          const decrypted = await decryptApiKey(settings.encrypted_api_key);
          if (decrypted && decrypted.trim()) {
            key = decrypted.trim().replace(/^["']|["']$/g, "").trim();
            keySource = "database";
          }
        } catch (decErr) {
          console.error("[admin-ai-settings] Failed to decrypt DB key:", decErr);
        }
      }

      // 2. Fallback to Supabase Secret OPENAI_API_KEY ONLY if database key is absent
      if (!key) {
        const envKey = Deno.env.get("OPENAI_API_KEY");
        if (envKey && envKey.trim()) {
          key = envKey.trim().replace(/^["']|["']$/g, "").trim();
          keySource = "secret";
        }
      }

      // 3. Masked diagnostics (Never log full key)
      const keyPrefix = key ? key.slice(0, 7) : "";
      const keySuffix = key ? key.slice(-4) : "";
      const keyLength = key ? key.length : 0;
      const keyExists = Boolean(key);

      console.log("[admin-ai-settings] Testing OpenAI connection:", {
        keySource,
        keyExists,
        keyPrefix,
        keySuffix,
        keyLength,
      });

      if (!key) {
        return new Response(
          JSON.stringify({
            status: "error",
            message: "OPENAI_API_KEY chưa được cấu hình trong Database hoặc Supabase Secrets.",
            diagnostic: {
              keySource: "none",
              keyExists: false,
              keyPrefix: "",
              keySuffix: "",
              keyLength: 0,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const rawBaseUrl = settings?.api_base_url?.trim() || "https://api.openai.com/v1";
      const baseUrl = rawBaseUrl.replace(/\/+$/, "");

      try {
        // Probe 1: GET /v1/models
        let resp = await fetch(`${baseUrl}/models`, {
          method: "GET",
          headers: { Authorization: `Bearer ${key}` },
        });

        let resStatus = resp.status;
        let openAiErrMsg = "";

        if (!resp.ok) {
          try {
            const errJson = await resp.json();
            openAiErrMsg = errJson?.error?.message || JSON.stringify(errJson);
          } catch {
            openAiErrMsg = await resp.text().catch(() => "");
          }

          // Probe 2: If /models returned 401/403, test chat completions (some restricted keys have no models:read)
          if (resp.status === 401 || resp.status === 403) {
            try {
              const chatProbe = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: settings?.chat_model || "gpt-4o-mini",
                  messages: [{ role: "user", content: "ping" }],
                  max_tokens: 1,
                }),
              });
              if (chatProbe.ok) {
                resp = chatProbe;
                resStatus = 200;
                openAiErrMsg = "";
              } else {
                resStatus = chatProbe.status;
                const chatErrJson = await chatProbe.json().catch(() => null);
                if (chatErrJson?.error?.message) {
                  openAiErrMsg = chatErrJson.error.message;
                }
              }
            } catch (_) {
              // keep /models error
            }
          }
        }

        const isSuccess = resp.ok || resStatus === 200;
        let clientMsg = "";
        if (isSuccess) {
          clientMsg = "Kết nối OpenAI thành công!";
        } else if (resStatus === 401) {
          clientMsg =
            "API key OpenAI không hợp lệ hoặc không thuộc project có quyền dùng model. Hãy tạo key mới trên OpenAI Platform và lưu lại.";
        } else {
          clientMsg = `OpenAI trả về mã lỗi ${resStatus}: ${openAiErrMsg}`;
        }

        console.log("[admin-ai-settings] OpenAI test result:", {
          isSuccess,
          resStatus,
          openAiErrMsg,
          keySource,
          keyPrefix,
          keyLength,
        });

        if (settings?.id) {
          await adminClient
            .from("system_ai_provider_settings")
            .update({
              last_tested_at: new Date().toISOString(),
              last_test_status: isSuccess ? "success" : "failed",
              last_test_message: isSuccess
                ? "Connection successful"
                : `[${resStatus}] ${openAiErrMsg || clientMsg}`,
            })
            .eq("id", settings.id);
        }

        return new Response(
          JSON.stringify({
            status: isSuccess ? "success" : "error",
            message: clientMsg,
            diagnostic: {
              keySource,
              keyExists,
              keyPrefix,
              keySuffix,
              keyLength,
              openAiStatus: resStatus,
              openAiError: openAiErrMsg,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err: any) {
        if (settings?.id) {
          await adminClient
            .from("system_ai_provider_settings")
            .update({
              last_tested_at: new Date().toISOString(),
              last_test_status: "failed",
              last_test_message: err.message,
            })
            .eq("id", settings.id);
        }
        return new Response(
          JSON.stringify({
            status: "error",
            message: "Lỗi mạng hoặc không thể kết nối tới OpenAI: " + err.message,
            diagnostic: {
              keySource,
              keyExists,
              keyPrefix,
              keySuffix,
              keyLength,
              openAiStatus: 0,
              openAiError: err.message,
            },
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (action === "test_rag_retrieval") {
      // For now, simulate success
      return new Response(
        JSON.stringify({
          status: "success",
          message: "RAG Retrieval test simulated (No DB interaction in MVP)",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (action === "trigger_staging_reindex") {
      const { data: settings } = await adminClient
        .from("system_ai_provider_settings")
        .select("encrypted_api_key")
        .eq("provider", "openai")
        .single();

      const key = settings?.encrypted_api_key
        ? await decryptApiKey(settings.encrypted_api_key)
        : Deno.env.get("OPENAI_API_KEY");
      if (!key) {
        return new Response(
          JSON.stringify({ status: "error", message: "OPENAI_API_KEY chưa được cấu hình." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
              Authorization: authHeader,
            },
            body: JSON.stringify({ productKnowledgeId: pk.id, rebuild: true }),
          });
          if (res.ok) successCount++;
        } catch (e) {
          console.error("Reindex error for pk", pk.id, e);
        }
      }

      return new Response(
        JSON.stringify({
          status: "success",
          message: `Đã reindex thành công ${successCount} sản phẩm.`,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ status: "error", message: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ status: "error", message: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
