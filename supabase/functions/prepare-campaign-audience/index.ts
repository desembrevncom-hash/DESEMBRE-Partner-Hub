import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { buildSuppressionSet, buildEligibleAudience } from "../_shared/audience-filter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAdminKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseAdminKey);

    // 1. Auth & Role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing authorization", step: "auth" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authErr,
    } = await adminClient.auth.getUser(token);

    if (authErr || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized", step: "auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const role = roleData?.role;

    if (role !== "admin" && role !== "sub_admin") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Forbidden: Admin/SubAdmin only",
          step: "role_check",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Body
    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing campaign_id", step: "validation" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Campaign Check
    const { data: campaign, error: campErr } = await adminClient
      .from("marketing_campaigns")
      .select("id, channel, approval_status, segment_id")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) {
      return new Response(
        JSON.stringify({ success: false, error: "Campaign not found", step: "campaign_check" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (campaign.approval_status !== "approved") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Campaign phải được duyệt (approved) mới có thể chạy Dry-run.",
          step: "approval_check",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 4. Kill switch state (Read-only for reporting)
    const productionSendingEnabled =
      Deno.env.get("MARKETING_PRODUCTION_SENDING_ENABLED") === "true";

    // 5. Load Suppression List
    const { data: suppressions } = await adminClient
      .from("marketing_suppression_list")
      .select("channel, normalized_contact_value, is_active")
      .eq("is_active", true);

    const suppressionSet = buildSuppressionSet(suppressions);

    // 6. Query Customers (Max 10000)
    let customers: any[] = [];
    if (campaign.segment_id) {
      const { data: mapData } = await adminClient
        .from("customer_segments_map")
        .select("customer_id")
        .eq("segment_id", campaign.segment_id);
      if (mapData && mapData.length > 0) {
        const cIds = mapData.map((m: any) => m.customer_id);
        const { data: cData } = await adminClient
          .from("customers")
          .select("id, name, email, phone, marketing_opt_in, marketing_opt_out_at, is_active")
          .in("id", cIds)
          .limit(10000);
        if (cData) customers = cData;
      }
    } else {
      const { data: cData } = await adminClient
        .from("customers")
        .select("id, name, email, phone, marketing_opt_in, marketing_opt_out_at, is_active")
        .limit(10000);
      if (cData) customers = cData;
    }

    const truncated = customers.length === 10000;

    // Load Zalo Profiles if needed
    const customerIds = customers.map((c) => c.id);
    let zaloProfilesMap = new Map<string, any>();

    if (
      campaign.channel === "zalo" ||
      campaign.channel === "zalo_oa" ||
      campaign.channel === "zalo_zns"
    ) {
      // Chunking if too many
      for (let i = 0; i < customerIds.length; i += 1000) {
        const chunk = customerIds.slice(i, i + 1000);
        const { data: zData } = await adminClient
          .from("customer_zalo_profiles")
          .select("customer_id, zalo_id, is_following_oa, zalo_phone")
          .in("customer_id", chunk);
        if (zData) {
          for (const z of zData) {
            zaloProfilesMap.set(z.customer_id, z);
          }
        }
      }
    }

    // 7. Filtering (Sử dụng Shared Audience Filter)
    const preview_limit = 10;
    const { eligible_count, excluded_counts, preview_recipients } = buildEligibleAudience(
      customers,
      campaign.channel,
      zaloProfilesMap,
      suppressionSet,
      preview_limit,
    );

    // 8. Rate Limit Logic
    const max_batch_size =
      campaign.channel === "email" || campaign.channel === "email_campaign" ? 100 : 10;
    const exceeds_limit = eligible_count > max_batch_size;

    // Output JSON
    return new Response(
      JSON.stringify({
        success: true,
        campaign_id: campaign.id,
        channel: campaign.channel,
        approved: true,
        production_sending_enabled: productionSendingEnabled,
        provider_mode: Deno.env.get("MARKETING_PROVIDER_MODE") || "unknown",
        can_send_production: false, // Always false in 6F.2
        eligible_count,
        preview_limit,
        preview_recipients,
        excluded_counts,
        rate_limit: {
          max_batch_size,
          exceeds_limit,
        },
        metadata: {
          truncated,
          duplicate_strategy: "in-memory-set",
        },
        message: "Dry-run only. No messages were sent.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ success: false, error: err.message, step: "fatal" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
