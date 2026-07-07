import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ACADEMY_ALLOWED_ORIGINS") || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  action: string;
  lessonId?: string;
  contentType?: string;
  mimeType?: string;
  sizeBytes?: number;
  originalFilename?: string;
  uploadSessionId?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      throw new Error("Missing environment configuration");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Dual Security Context
    // A. User-scoped anon client
    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUserClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actorId = user.id;

    // B. Internal service-role client
    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Malformed JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = payload;

    if (action === "request_upload") {
      const { lessonId, contentType, mimeType, sizeBytes, originalFilename } = payload;
      if (!lessonId || !contentType || !mimeType || !sizeBytes || !originalFilename) {
        return new Response(JSON.stringify({ error: "Missing required fields for request_upload" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call internal RPC via service_role to validate admin and generate session
      const { data: sessionData, error: sessionError } = await supabaseAdminClient.rpc(
        "admin_create_academy_media_upload_session",
        {
          p_actor_user_id: actorId,
          p_lesson_id: lessonId,
          p_content_type: contentType,
          p_mime_type: mimeType,
          p_size_bytes: sizeBytes,
          p_original_filename: originalFilename,
        }
      );

      if (sessionError) {
        // Sanitize error
        const msg = sessionError.message || "Unknown DB error";
        return new Response(JSON.stringify({ error: "Failed to create upload session: " + msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { uploadSessionId, objectPath, expiresIn } = sessionData as {
        uploadSessionId: string;
        objectPath: string;
        expiresIn: number;
      };

      // Create signed upload URL
      const { data: signedData, error: signedError } = await supabaseAdminClient
        .storage
        .from("academy-content")
        .createSignedUploadUrl(objectPath, expiresIn);

      if (signedError || !signedData) {
        return new Response(JSON.stringify({ error: "Failed to generate upload URL" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Return EXACT safe metadata payload (no objectPath, no bucket)
      return new Response(JSON.stringify({
        uploadSessionId,
        uploadUrl: signedData.signedUrl,
        expiresIn,
        mimeType,
        maxSizeBytes: contentType === 'video' ? 1048576000 : 52428800
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } 
    
    else if (action === "finalize_upload") {
      const { uploadSessionId } = payload;
      if (!uploadSessionId) {
        return new Response(JSON.stringify({ error: "Missing uploadSessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: finalData, error: finalError } = await supabaseAdminClient.rpc(
        "admin_finalize_academy_media_upload_session",
        {
          p_actor_user_id: actorId,
          p_upload_session_id: uploadSessionId,
        }
      );

      if (finalError) {
        const msg = finalError.message || "Unknown DB error";
        return new Response(JSON.stringify({ error: "Failed to finalize: " + msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(finalData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } 
    
    else if (action === "cancel_upload") {
      const { uploadSessionId } = payload;
      if (!uploadSessionId) {
        return new Response(JSON.stringify({ error: "Missing uploadSessionId" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: cancelData, error: cancelError } = await supabaseAdminClient.rpc(
        "admin_cancel_academy_media_upload_session",
        {
          p_actor_user_id: actorId,
          p_upload_session_id: uploadSessionId,
        }
      );

      if (cancelError) {
        const msg = cancelError.message || "Unknown DB error";
        return new Response(JSON.stringify({ error: "Failed to cancel: " + msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(cancelData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
