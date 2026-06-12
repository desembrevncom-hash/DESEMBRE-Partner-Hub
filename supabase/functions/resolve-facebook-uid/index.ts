import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResolveFacebookUidPayload {
  job_id: string;
}

const ENABLED = Deno.env.get("FACEBOOK_UID_AUTO_RESOLVE_ENABLED") === "true";
const APIFY_TOKEN = Deno.env.get("APIFY_TOKEN");
const ACTOR = Deno.env.get("APIFY_FACEBOOK_URL_TO_ID_ACTOR") || "apify/facebook-url-to-id";
const TIMEOUT_MS = parseInt(Deno.env.get("FACEBOOK_UID_PROVIDER_TIMEOUT_MS") || "15000");
const DAILY_LIMIT = parseInt(Deno.env.get("FACEBOOK_UID_PROVIDER_DAILY_LIMIT") || "50");
const COOLDOWN_MINUTES = parseInt(Deno.env.get("FACEBOOK_UID_PROVIDER_COOLDOWN_MINUTES") || "10");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "unauthenticated",
          message: "Bạn cần đăng nhập để tìm UID Facebook.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    // Create admin client for internal ops
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify user JWT
    const supabaseUserClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabaseUserClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "unauthenticated",
          message: "Bạn cần đăng nhập để tìm UID Facebook.",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Get user roles
    const { data: userData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();
    const role = userData?.role || "sale";
    const isAdmin =
      role === "admin" || role === "sub_admin" || role === "administrator" || role === "manager";

    const { job_id } = (await req.json()) as ResolveFacebookUidPayload;
    if (!job_id) {
      return new Response(
        JSON.stringify({ success: false, code: "invalid_request", message: "Thiếu job_id." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch Job securely
    const { data: job, error: jobErr } = await supabaseAdmin
      .from("facebook_identity_resolution_jobs")
      .select("*, customers(owner_sale_id, owner_tele_id, created_by)")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return new Response(
        JSON.stringify({ success: false, code: "job_not_found", message: "Không tìm thấy job." }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Authorize
    if (!isAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "resolver_admin_only",
          message: "Chỉ Admin/Sub-admin/Manager có quyền tìm UID Facebook.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Validate Status - Allow retrying from failed or ignored or duplicate states as well
    if (
      job.status !== "manual_review_required" &&
      job.status !== "failed" &&
      job.status !== "ignored" &&
      job.status !== "duplicate_candidate"
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          code: "invalid_job_state",
          message: "Job is not in a retryable state",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate and Normalize URL
    let raw = (job.raw_url || "").trim();
    if (raw.startsWith("facebook.com/") || raw.startsWith("www.facebook.com/")) {
      raw = "https://" + raw;
    } else if (!raw.startsWith("http://") && !raw.startsWith("https://")) {
      raw = "https://www.facebook.com/" + raw;
    }

    const normalizedUrl = raw;
    try {
      const parsed = new URL(normalizedUrl);
      if (!parsed.hostname.endsWith("facebook.com") && !parsed.hostname.endsWith("fb.com")) {
        throw new Error("Not a facebook domain");
      }
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          code: "invalid_facebook_url",
          message: "Link Facebook không hợp lệ.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("Sanitized normalizedUrl:", normalizedUrl);

    // Feature Flag Check
    if (!ENABLED) {
      await supabaseAdmin
        .from("facebook_identity_resolution_jobs")
        .update({
          auto_resolve_status: "disabled",
          last_auto_resolve_at: new Date().toISOString(),
          last_auto_resolve_error: "Feature disabled by admin",
        })
        .eq("id", job_id);

      await insertResult(supabaseAdmin, job, "disabled", null, 0, "Feature flag is OFF");

      return new Response(
        JSON.stringify({ status: "disabled", message: "Auto-resolver is currently disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Cooldown & Cache check
    const { data: previousResults } = await supabaseAdmin
      .from("facebook_uid_resolver_results")
      .select("provider_status, created_at, returned_uid, returned_name, response_json")
      .eq("raw_url", job.raw_url)
      .order("created_at", { ascending: false })
      .limit(1);

    if (previousResults && previousResults.length > 0) {
      const last = previousResults[0];

      if (last.provider_status === "resolved" && last.returned_uid) {
        let cachedName = last.returned_name;
        if (!cachedName && last.response_json && Object.keys(last.response_json).length > 0) {
          cachedName = extractFacebookDisplayName(last.response_json);
        }

        await updateSuccess(supabaseAdmin, job, last.returned_uid, 80, cachedName);
        await insertResult(
          supabaseAdmin,
          job,
          "cached",
          last.returned_uid,
          0,
          null,
          last.response_json,
          cachedName,
        );
        return new Response(JSON.stringify({ status: "cached", uid: last.returned_uid }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (
        last.provider_status === "failed" ||
        last.provider_status === "timeout" ||
        last.provider_status === "not_found"
      ) {
        const lastTime = new Date(last.created_at).getTime();
        const now = Date.now();
        if (now - lastTime < COOLDOWN_MINUTES * 60 * 1000) {
          return new Response(
            JSON.stringify({ status: "cooldown", message: "Cooling down from recent failure" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    // Check daily limit
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: todayJobs, error: tlErr } = await supabaseAdmin
      .from("facebook_uid_resolver_results")
      .select("id", { count: "exact" })
      .gte("created_at", startOfDay.toISOString());

    if (tlErr) throw tlErr;
    if (todayJobs && todayJobs.length >= DAILY_LIMIT) {
      await updateFailure(
        supabaseAdmin,
        job_id,
        "rate_limited",
        `Daily limit of ${DAILY_LIMIT} reached`,
      );
      return new Response(
        JSON.stringify({ accepted: false, status: "rate_limited", message: "Daily limit reached" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Acknowledge and process in background
    await supabaseAdmin
      .from("facebook_identity_resolution_jobs")
      .update({
        auto_resolve_status: "resolving",
        auto_resolve_attempts: (job.auto_resolve_attempts || 0) + 1,
        last_auto_resolve_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    // Background Processing
    const backgroundTask = async () => {
      const startedAt = Date.now();
      let latencyMs = 0;
      let finalStatus = "failed";
      let finalError = "Unknown error";
      let itemToLog = null;

      try {
        const actorId = ACTOR.includes("~") ? ACTOR : ACTOR.replace("/", "~");
        const apifyUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?format=json&clean=true&token=${APIFY_TOKEN}`;

        const payloadsToTry = [
          { fbUrls: [normalizedUrl] },
          { fbUrls: [{ url: normalizedUrl }] },
          { startUrls: [{ url: normalizedUrl }] },
          { urls: [{ url: normalizedUrl }] },
          { fbUrls: [`${normalizedUrl}/`] },
          { startUrls: [{ url: `${normalizedUrl}/` }] },
        ];

        const timeoutMs = parseInt(Deno.env.get("FACEBOOK_UID_PROVIDER_TIMEOUT_MS") || "45000", 10);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let res;
        let successfulPayloadShape = "none";
        let lastErrorText = "";

        for (const payload of payloadsToTry) {
          try {
            res = await fetch(apifyUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...payload,
                extractMetadata: true,
                checkAdsLibrary: false,
              }),
              signal: controller.signal,
            });

            if (res.status === 200 || res.status === 201) {
              const key = Object.keys(payload)[0];
              const val = (payload as any)[key][0];
              successfulPayloadShape = `${key}_${typeof val === "string" ? "string" : "object"}`;
              break;
            }

            lastErrorText = await res.text();

            if (res.status !== 400) {
              break;
            }
          } catch (fetchErr: any) {
            if (fetchErr.name === "AbortError") throw fetchErr;
            break;
          }
        }

        clearTimeout(timeoutId);

        latencyMs = Date.now() - startedAt;

        if (!res || !res.ok) {
          let providerErrorType = "unknown";
          let message = lastErrorText || "Unknown fetch failure";
          try {
            const json = JSON.parse(lastErrorText);
            providerErrorType = json.error?.type || "unknown";
            message = json.error?.message || lastErrorText;
          } catch {}

          console.log(
            JSON.stringify({
              actorId,
              normalizedUrl,
              payloadShape: "failed_all_fallbacks",
              httpStatus: res?.status || 0,
              providerErrorType,
              message,
              latencyMs,
            }),
          );

          if (res?.status === 400 && providerErrorType === "invalid-input") {
            finalStatus = "failed";
            finalError = "Apify invalid input: normalized URL rejected";
            return;
          }

          throw new Error(`Apify HTTP ${res?.status || 0}: ${message}`);
        }

        const items = await res.json();
        const item = items[0];
        itemToLog = item;

        console.log(
          JSON.stringify({
            actorId,
            normalizedUrl,
            payloadShape: successfulPayloadShape,
            httpStatus: res.status,
            providerErrorType: "none",
            message: "success",
            latencyMs,
          }),
        );

        const { data: currentJob } = await supabaseAdmin
          .from("facebook_identity_resolution_jobs")
          .select("status")
          .eq("id", job_id)
          .single();
        if (
          currentJob?.status !== "manual_review_required" &&
          currentJob?.status !== "failed" &&
          currentJob?.status !== "ignored" &&
          currentJob?.status !== "duplicate_candidate"
        ) {
          console.log("Job already resolved manually while Apify was running.");
          finalStatus = "skipped_invalid_type";
          finalError = "Job no longer requires manual review";

          await supabaseAdmin
            .from("facebook_identity_resolution_jobs")
            .update({
              auto_resolve_status: "skipped_invalid_type",
              last_auto_resolve_error: finalError,
            })
            .eq("id", job_id);

          return;
        }

        let returnedUid = null;
        let isNumeric = false;
        let returnedName = null;
        if (item) {
          returnedUid =
            item.facebookId || item.facebook_id || item.id || item.uid || item.userId || null;
          if (returnedUid) {
            returnedUid = String(returnedUid);
            isNumeric = /^\d+$/.test(returnedUid);
          }

          returnedName = extractFacebookDisplayName(item);
        }

        if (returnedUid && isNumeric) {
          const resolveStatus = await updateSuccess(
            supabaseAdmin,
            job,
            returnedUid,
            80,
            returnedName,
          );
          finalStatus = resolveStatus;
          finalError = "";
          await insertResult(
            supabaseAdmin,
            job,
            resolveStatus,
            returnedUid,
            latencyMs,
            null,
            itemToLog,
            returnedName,
          );
        } else {
          finalStatus = "not_found";
          finalError = "No numeric UID returned";
          await insertResult(
            supabaseAdmin,
            job,
            "not_found",
            null,
            latencyMs,
            finalError,
            itemToLog,
            null,
          );
        }
      } catch (err: any) {
        latencyMs = Date.now() - startedAt;
        if (err.name === "AbortError") {
          finalStatus = "timeout";
          const tMs = parseInt(Deno.env.get("FACEBOOK_UID_PROVIDER_TIMEOUT_MS") || "45000", 10);
          finalError = `Provider timeout after ${tMs}ms`;
        } else {
          finalStatus = "failed";
          finalError = err.message;
        }
        console.error("Auto-resolve background error:", err);
        console.log(
          JSON.stringify({
            actorId: ACTOR,
            normalizedUrl,
            payloadShape: "unknown",
            httpStatus: 0,
            providerErrorType: "exception",
            message: err.message,
            latencyMs,
          }),
        );
        await insertResult(supabaseAdmin, job, finalStatus, null, latencyMs, finalError, itemToLog);
      } finally {
        if (
          finalStatus !== "resolved" &&
          finalStatus !== "duplicate_detected" &&
          finalStatus !== "skipped_invalid_type"
        ) {
          await updateFailure(supabaseAdmin, job_id, finalStatus, finalError);
        }
      }
    };

    if (typeof EdgeRuntime !== 'undefined' && typeof EdgeRuntime.waitUntil === 'function') {
      EdgeRuntime.waitUntil(backgroundTask());
    } else {
      // Fallback for environments without EdgeRuntime
      backgroundTask().catch(console.error);
    }

    return new Response(
      JSON.stringify({ status: "processed", message: "Job processed successfully" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    console.error("Critical Edge Function Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        code: "provider_error",
        message: "Nhà cung cấp UID đang lỗi, vui lòng thử lại sau.",
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function extractFacebookDisplayName(item: any): string | null {
  if (!item || typeof item !== "object") return null;

  const rawName =
    item.openGraph?.title ||
    item.openGraph?.alt ||
    item.name ||
    item.title ||
    item.fullName ||
    item.profileName ||
    item.displayName ||
    item.facebookName ||
    item.pageName ||
    item.user?.name ||
    item.user?.title ||
    item.page?.name ||
    null;

  let cleanName = null;

  if (typeof rawName === "string") {
    cleanName = rawName.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim();
    if (cleanName.includes(" | Facebook")) {
      cleanName = cleanName.split(" | Facebook")[0].trim();
    }
  }

  // Fallback to directory tile if still null
  if (!cleanName && typeof item.user?.directory_tile_section_truncation_string?.text === "string") {
    const text = item.user.directory_tile_section_truncation_string.text.trim();
    if (text.startsWith("See more about ")) {
      cleanName = text.substring("See more about ".length).trim();
    }
  }

  if (!cleanName || cleanName.length > 120) return null;

  // Rejection rules
  const lowerName = cleanName.toLowerCase();

  if (lowerName === "facebook" || lowerName === "com.facebook.katana") {
    return null; // Rejected values
  }
  if (
    lowerName.includes("facebook.com") ||
    lowerName.startsWith("http://") ||
    lowerName.startsWith("https://")
  ) {
    return null; // No URLs
  }
  if (
    lowerName === "instagram" ||
    lowerName === "whatsapp" ||
    lowerName === "meta" ||
    lowerName.startsWith("log in") ||
    lowerName.startsWith("sign up") ||
    lowerName.length <= 1
  ) {
    return null;
  }
  // Clean " | Facebook"
  if (cleanName.endsWith(" | Facebook")) {
    cleanName = cleanName.substring(0, cleanName.length - " | Facebook".length).trim();
  }

  if (cleanName.length === 0) return null;

  return cleanName.substring(0, 120);
}

async function updateSuccess(
  supabaseAdmin: any,
  job: any,
  uid: string,
  confidence: number,
  returnedName: string | null = null,
): Promise<string> {
  // Check for duplicate
  const { data: existingProfiles, error: dupErr } = await supabaseAdmin
    .from("customer_social_profiles")
    .select("id")
    .eq("facebook_uid", uid)
    .limit(1);

  if (existingProfiles && existingProfiles.length > 0) {
    const duplicateProfileId = existingProfiles[0].id;
    // Update job to duplicate_candidate
    await supabaseAdmin
      .from("facebook_identity_resolution_jobs")
      .update({
        status: "duplicate_candidate",
        auto_resolve_status: "duplicate_detected",
        duplicate_social_profile_id: duplicateProfileId,
        last_auto_resolve_at: new Date().toISOString(),
        last_auto_resolve_error: "Duplicate UID detected",
      })
      .eq("id", job.id);
    return "duplicate_detected";
  }

  // First update social profile if we have customer ID
  if (job.customer_id) {
    const updateData: any = {
      facebook_uid: uid,
      resolver_status: "resolved",
      resolver_method: "external_apify",
      confidence_score: confidence,
    };

    if (returnedName) {
      updateData.facebook_display_name = returnedName;
      updateData.display_name_source = "external_apify";
      updateData.display_name_confidence_score = 70;
      updateData.display_name_updated_at = new Date().toISOString();
    }

    await supabaseAdmin
      .from("customer_social_profiles")
      .update(updateData)
      .eq("customer_id", job.customer_id)
      .eq("platform", "facebook");
  }

  // Update job
  await supabaseAdmin
    .from("facebook_identity_resolution_jobs")
    .update({
      status: "resolved",
      auto_resolve_status: "resolved",
      last_auto_resolve_at: new Date().toISOString(),
      last_auto_resolve_error: null,
    })
    .eq("id", job.id);

  return "resolved";
}

async function updateFailure(supabaseAdmin: any, job_id: string, status: string, errorMsg: string) {
  await supabaseAdmin
    .from("facebook_identity_resolution_jobs")
    .update({
      auto_resolve_status: status,
      last_auto_resolve_at: new Date().toISOString(),
      last_auto_resolve_error: errorMsg.substring(0, 200),
    })
    .eq("id", job_id);
}

async function insertResult(
  supabaseAdmin: any,
  job: any,
  status: string,
  uid: string | null,
  latency: number,
  errorMsg: string | null,
  responseJson: any = {},
  returnedName: string | null = null,
) {
  // sanitize responseJson
  if (responseJson && Array.isArray(responseJson)) {
    responseJson = responseJson[0] || {};
  }
  await supabaseAdmin.from("facebook_uid_resolver_results").insert({
    job_id: job.id,
    customer_id: job.customer_id,
    raw_url: job.raw_url,
    returned_uid: uid,
    returned_name: returnedName,
    provider_status: status,
    latency_ms: latency,
    error_message: errorMsg,
    response_json: responseJson,
    created_by: job.created_by,
  });
}
