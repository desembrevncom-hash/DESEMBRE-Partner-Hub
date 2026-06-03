import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // We use service role to check permissions securely, but we need the auth header to know who the user is.
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify JWT
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const reqData = await req.json();
    if (reqData.test === true) {
      return new Response(JSON.stringify({ status: "pass", message: "Ping successful" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { customerId, channelType, value, scope, remarketing_enabled, notes, is_primary } =
      reqData;

    if (!customerId || !channelType || !value || !scope) {
      throw new Error("Missing required fields");
    }

    // Check role by querying user_roles directly since we are using service role key
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const roles = (roleData || []).map((r) => r.role);
    const isAdminOrSubAdmin = roles.includes("admin") || roles.includes("sub_admin");

    if (scope === "official" && !isAdminOrSubAdmin) {
      throw new Error("Only Admin/Sub Admin can create official channels");
    }

    // Check can_view_customer for both official and private creations
    const { data: canView } = await supabase.rpc("can_view_customer", {
      p_customer_id: customerId,
      p_user_id: user.id,
    });

    if (!canView) {
      throw new Error("You do not have permission to view or modify this customer");
    }

    // Normalize values
    let normalizedValue = value.trim();
    let resolveStatus = "pending";
    let profileType = "unknown";
    let externalId = null;

    if (channelType === "email") {
      normalizedValue = normalizedValue.toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedValue)) {
        throw new Error("Invalid email format");
      }
      resolveStatus = "verified"; // Emails are considered manually verified by formatting
    } else if (channelType === "zalo") {
      // If it's a zalome link, extract phone
      if (normalizedValue.includes("zalo.me/")) {
        normalizedValue = normalizedValue.split("zalo.me/")[1].split("?")[0].trim();
      }
      // Remove non-numeric if it looks like a phone number
      if (/^[\d\s\-\+\.]+$/.test(normalizedValue)) {
        normalizedValue = normalizedValue.replace(/\D/g, "");
      }
      resolveStatus = "manual";
    } else if (
      channelType === "tiktok" ||
      channelType === "instagram" ||
      channelType === "facebook"
    ) {
      // very basic normalization, mostly stripping query params
      try {
        const url = new URL(
          normalizedValue.startsWith("http") ? normalizedValue : `https://${normalizedValue}`,
        );
        normalizedValue = url.origin + url.pathname;

        // Basic Facebook domain validation
        if (channelType === "facebook") {
          if (
            !url.hostname.includes("facebook.com") &&
            !url.hostname.includes("fb.com") &&
            !url.hostname.includes("fb.watch")
          ) {
            throw new Error("Invalid Facebook domain");
          }
        }
      } catch (e: any) {
        if (e.message.includes("Invalid Facebook domain")) throw e;
        // If it's just a username, keep it as is
      }
      resolveStatus = "manual";
    } else if (channelType === "website") {
      try {
        const url = new URL(
          normalizedValue.startsWith("http") ? normalizedValue : `https://${normalizedValue}`,
        );
        normalizedValue = url.hostname;
      } catch (e) {
        // keep as is
      }
      resolveStatus = "manual";
    }

    // Attempt Facebook Graph API if token exists and it's facebook
    const metaToken = Deno.env.get("META_GRAPH_ACCESS_TOKEN");
    if (channelType === "facebook" && metaToken) {
      // We only try to resolve page IDs for official channels or if we want to be helpful.
      // Without scraping, we can only query Graph API.
      // Graph API usually requires the page username or ID directly.
      const match = normalizedValue.match(
        /(?:facebook\.com|fb\.com)\/(?:profile\.php\?id=)?([a-zA-Z0-9.\-]+)/,
      );
      if (match && match[1]) {
        const idOrUsername = match[1];
        try {
          const fbRes = await fetch(
            `https://graph.facebook.com/v19.0/${idOrUsername}?access_token=${metaToken}`,
          );
          const fbData = await fbRes.json();
          if (fbData.id) {
            externalId = fbData.id;
            profileType = fbData.name ? "page" : "unknown"; // Very naive check, Graph API typically returns Page info if it's a page and token has access
            resolveStatus = "verified";
          } else {
            resolveStatus = "failed";
          }
        } catch (err) {
          resolveStatus = "failed";
        }
      }
    } else if (channelType === "facebook") {
      // If no token, we just keep it manual
      resolveStatus = "manual";
    }

    const visibility = scope === "official" ? "official" : "private";

    // Insert or update DB (avoid upsert due to partial index ON CONFLICT errors)
    const payload = {
      customer_id: customerId,
      channel_type: channelType,
      channel_value: value.trim(),
      normalized_value: normalizedValue,
      scope: scope,
      visibility: visibility,
      resolve_status: resolveStatus,
      profile_type: profileType,
      external_id: externalId,
      owner_user_id: scope === "private" ? user.id : null,
      created_by: user.id,
      updated_by: user.id,
      remarketing_enabled: remarketing_enabled || false,
      notes: notes || null,
      is_primary: !!is_primary,
      channel_purpose: "sales", // default purpose, UI can override later
      phone_verified: false,
      preferred_call_time: null,
      do_not_call: false,
      last_contacted_at: null,
      last_verified_at: null,
      engagement_score: 0,
    };

    let query = supabase
      .from("customer_contact_channels")
      .select("id, external_id, normalized_value")
      .eq("customer_id", customerId)
      .eq("channel_type", channelType)
      .eq("scope", scope);

    if (scope === "private") {
      query = query.eq("owner_user_id", user.id);
    } else {
      query = query.is("owner_user_id", null);
    }

    const { data: existingRows, error: searchError } = await query;
    if (searchError) throw searchError;

    // Duplicate detection for Facebook using external_id when resolved
    if (channelType === "facebook") {
      const duplicate = existingRows?.find(
        (row) =>
          (externalId && row.external_id === externalId) ||
          (!externalId && row.normalized_value === normalizedValue),
      );
      if (duplicate) {
        throw new Error("Duplicate Facebook channel for this customer");
      }
    } else {
      // Generic duplicate check on normalized_value
      const duplicate = existingRows?.find((row) => row.normalized_value === normalizedValue);
      if (duplicate) {
        throw new Error("Duplicate channel for this customer");
      }
    }

    let channelData;
    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (existing) {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      channelData = data;
    } else {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      channelData = data;
    }

    // If this channel is marked as primary, unset other primary channels for same customer, scope, and owner
    if (payload.is_primary) {
      await supabase
        .from("customer_contact_channels")
        .update({ is_primary: false })
        .eq("customer_id", customerId)
        .eq("scope", scope)
        .eq("owner_user_id", payload.owner_user_id)
        .neq("id", channelData.id);
    }

    // Log Activity
    const activityTitle =
      scope === "official" ? "Cập nhật kênh liên hệ chính thức" : "Thêm kênh liên hệ riêng";
    await supabase.from("customer_activities").insert({
      customer_id: customerId,
      user_id: user.id,
      activity_type: "profile_updated",
      title: activityTitle,
      content: `${channelType.toUpperCase()} (${scope})`,
      metadata: { channel_id: channelData.id },
    });

    return new Response(JSON.stringify({ success: true, data: channelData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Return 200 so supabase-js doesn't mask the error message with a generic HttpError
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
