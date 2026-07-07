import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ACADEMY_ALLOWED_ORIGINS") || "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUserClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "").trim();
    const { data: { user }, error: authError } = await supabaseUserClient.auth
      .getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({
          error: { code: "UNAUTHORIZED", message: "Authentication required" },
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const actorId = user.id;

    const supabaseAdminClient = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
    );

    const { data: roleData, error: roleError } = await supabaseAdminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", actorId)
      .in("role", ["admin", "sub_admin"]);

    if (roleError) {
      return new Response(
        JSON.stringify({
          error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!roleData || roleData.length === 0) {
      return new Response(
        JSON.stringify({
          error: { code: "FORBIDDEN", message: "Insufficient permissions" },
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let payload: RequestPayload;
    try {
      payload = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          error: { code: "INVALID_REQUEST", message: "Malformed JSON" },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { action } = payload;

    if (action === "request_upload") {
      const { lessonId, contentType, mimeType, sizeBytes, originalFilename } =
        payload;
      if (
        !lessonId || !contentType || !mimeType || !sizeBytes ||
        !originalFilename
      ) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing required fields for request_upload",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: sessionData, error: sessionError } =
        await supabaseAdminClient.rpc(
          "admin_create_academy_media_upload_session",
          {
            p_actor_user_id: actorId,
            p_lesson_id: lessonId,
            p_content_type: contentType,
            p_mime_type: mimeType,
            p_size_bytes: sizeBytes,
            p_original_filename: originalFilename,
          },
        );

      if (sessionError) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Database operation failed",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { uploadSessionId, objectPath, expiresIn } = sessionData as {
        uploadSessionId: string;
        objectPath: string;
        expiresIn: number;
      };

      const { data: signedData, error: signedError } = await supabaseAdminClient
        .storage
        .from("academy-content")
        .createSignedUploadUrl(objectPath);

      if (signedError || !signedData) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INTERNAL_ERROR",
              message: "Failed to generate upload URL",
            },
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(
        JSON.stringify({
          uploadSessionId,
          uploadUrl: signedData.signedUrl,
          expiresIn,
          mimeType,
          maxSizeBytes: contentType === "video" ? 1048576000 : 52428800,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    } else if (action === "finalize_upload") {
      const { uploadSessionId } = payload;
      if (!uploadSessionId) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing uploadSessionId",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: finalData, error: finalError } = await supabaseAdminClient
        .rpc(
          "admin_finalize_academy_media_upload_session",
          { p_actor_user_id: actorId, p_upload_session_id: uploadSessionId },
        );

      if (finalError) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Database operation failed",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(finalData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "cancel_upload") {
      const { uploadSessionId } = payload;
      if (!uploadSessionId) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Missing uploadSessionId",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const { data: cancelData, error: cancelError } = await supabaseAdminClient
        .rpc(
          "admin_cancel_academy_media_upload_session",
          { p_actor_user_id: actorId, p_upload_session_id: uploadSessionId },
        );

      if (cancelError) {
        return new Response(
          JSON.stringify({
            error: {
              code: "INVALID_REQUEST",
              message: "Database operation failed",
            },
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(cancelData), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        error: { code: "INVALID_REQUEST", message: "Invalid action" },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};

if (import.meta.main) {
  serve(handler);
}
