import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { verifyUnsubscribeToken } from "../_shared/marketing-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const token = body.token;

    if (!token) {
      return new Response(JSON.stringify({ error: "Thiếu token xác thực." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = await verifyUnsubscribeToken(token, encKey);
    if (!payload) {
      return new Response(JSON.stringify({ error: "Liên kết không hợp lệ hoặc đã hết hạn." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (payload.customerId && payload.customerId !== "test-sandbox-customer") {
      const { error: consentErr } = await adminClient
        .from("customer_consents")
        .update({
          is_opt_in: false,
          opt_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("customer_id", payload.customerId)
        .eq("channel", "email");

      if (consentErr) {
        console.error("[marketing-unsubscribe] Failed to update consent for customer", payload.customerId);
      }
    }

    const normalizedEmail = payload.email.trim().toLowerCase();
    
    const { data: existingSuppression } = await adminClient
      .from("marketing_suppression_list")
      .select("id")
      .eq("channel", "email")
      .eq("normalized_contact_value", normalizedEmail)
      .eq("is_active", true)
      .maybeSingle();

    if (!existingSuppression) {
      const metadata = {
        customer_id: payload.customerId === "test-sandbox-customer" ? null : payload.customerId,
        campaign_id: payload.campaignId,
        delivery_log_id: payload.deliveryLogId,
      };

      const { error: supErr } = await adminClient
        .from("marketing_suppression_list")
        .insert({
          channel: "email",
          contact_value: payload.email,
          normalized_contact_value: normalizedEmail,
          reason: "unsubscribe",
          source: "marketing_unsubscribe",
          is_active: true,
          metadata: metadata,
        });

      if (supErr) {
        console.error("[marketing-unsubscribe] Failed to insert suppression list");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[marketing-unsubscribe] error", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(JSON.stringify({ error: "Đã có lỗi xảy ra. Vui lòng thử lại sau." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
