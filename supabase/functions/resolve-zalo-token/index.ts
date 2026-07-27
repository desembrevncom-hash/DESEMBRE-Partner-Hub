import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { getSenderCredential } from "../_shared/sender-credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-key",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("[resolve-zalo-token] invoked");

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const internalKey = req.headers.get("x-internal-key") || req.headers.get("X-Internal-Key");
  const expectedKey = Deno.env.get("HUB_INTERNAL_FUNCTION_KEY") || Deno.env.get("INTERNAL_FUNCTION_KEY");

  if (!internalKey || !expectedKey || internalKey !== expectedKey) {
    console.warn("[resolve-zalo-token] auth failed", {
      hasInternalKey: Boolean(internalKey),
      hasExpectedKey: Boolean(expectedKey),
    });
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log("[resolve-zalo-token] auth ok");

  console.log("[resolve-zalo-token] env check", {
    hasSupabaseUrl: Boolean(Deno.env.get("SUPABASE_URL")),
    hasServiceRole: Boolean(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")),
    hasTokenEncryptionKey: Boolean(Deno.env.get("TOKEN_ENCRYPTION_KEY")),
    hasInternalKey: Boolean(Deno.env.get("INTERNAL_FUNCTION_KEY") || Deno.env.get("PARTNER_HUB_INTERNAL_FUNCTION_KEY")),
  });

  try {
    const reqData = await req.json().catch(() => ({}));
    const senderKey = reqData.sender_key;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[resolve-zalo-token] selecting sender", { senderKey });
    
    let query = adminClient
      .from("sender_accounts")
      .select("id, name, provider")
      .in("provider", ["zalo", "zalo_oa"])
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    const { data: senders, error: dbErr } = await query;

    if (dbErr || !senders || senders.length === 0) {
      console.warn("[resolve-zalo-token] error { message: 'No active Zalo OA sender found' }");
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sender = senders[0];
    if (senderKey === 'oa_desembre' || !senderKey) {
      sender = senders.find((s) => s.name === "OA Desembre") || senders[0];
    } else {
      // If a specific sender_key (like ID or exact name) is requested
      sender = senders.find((s) => s.id === senderKey || s.name === senderKey) || senders[0];
    }

    console.log("[resolve-zalo-token] selected sender", {
      senderId: sender.id,
      senderName: sender.name,
      provider: sender.provider,
      channel: sender.provider,
    });

    console.log("[resolve-zalo-token] resolving credential");
    const creds = await getSenderCredential(adminClient, "zalo_oa", sender.id);

    if (!creds || !creds.access_token) {
      throw new Error("Resolution returned empty access token");
    }

    console.log("[resolve-zalo-token] credential resolved", {
      hasAccessToken: Boolean(creds.access_token),
      expiresAt: "unknown",
    });

    return new Response(
      JSON.stringify({
        access_token: creds.access_token,
        sender_id: sender.id,
        sender_name: sender.name,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[resolve-zalo-token] error", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: "TOKEN_RESOLUTION_FAILED", message: "Unable to resolve Zalo token" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
