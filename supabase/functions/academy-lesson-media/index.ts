import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

export interface AppEnv {
  getEnv: (key: string) => string | undefined;
  createClient: (url: string, key: string, options?: any) => any;
}

export const handleRequest = async (req: Request, env: AppEnv): Promise<Response> => {
  const origin = req.headers.get("origin") || "";

  const rawOrigins = env.getEnv("ACADEMY_ALLOWED_ORIGINS");
  const ALLOWED_ORIGINS = rawOrigins ? rawOrigins.split(",").map(o => o.trim()) : [];

  let corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  const isAllowedOrigin = ALLOWED_ORIGINS.includes(origin);
  if (isAllowedOrigin) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
  }

  // Preflight
  if (req.method === "OPTIONS") {
    if (!isAllowedOrigin) {
      return new Response("forbidden", { status: 403 });
    }
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or malformed Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Malformed JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { courseSlug, lessonId } = body;

    if (!courseSlug || typeof courseSlug !== "string") {
      return new Response(JSON.stringify({ error: "Invalid courseSlug" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!lessonId || typeof lessonId !== "string" || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(lessonId)) {
      return new Response(JSON.stringify({ error: "Invalid or malformed lessonId" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseUrl = env.getEnv("SUPABASE_URL")!;
    const supabaseAnonKey = env.getEnv("SUPABASE_ANON_KEY")!;
    const supabaseServiceRoleKey = env.getEnv("SUPABASE_SERVICE_ROLE_KEY")!;

    // 2. User-scoped client
    const supabaseUser = env.createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // 3. Call public RPC
    const { data: contentData, error: contentError } = await supabaseUser.rpc("get_academy_lesson_content", {
      p_course_slug: courseSlug,
      p_lesson_id: lessonId,
    });

    if (contentError) {
      // Sanitize db error
      console.error("Database error during content check");
      return new Response(JSON.stringify({ error: "Internal server error during authorization" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 4. Require conditions
    if (!contentData || contentData.state !== "AVAILABLE") {
      return new Response(JSON.stringify({ error: "Access denied or content unavailable" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const content = contentData.content;
    if (!content || (content.kind !== "video" && content.kind !== "document") || !content.media_ref) {
      return new Response(JSON.stringify({ error: "Lesson does not have protected media content" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 5. Service-role client
    const supabaseAdmin = env.createClient(supabaseUrl, supabaseServiceRoleKey);

    // 6. Call locator
    const { data: locatorData, error: locatorError } = await supabaseAdmin.rpc("get_academy_lesson_media_locator", {
      p_content_id: content.media_ref,
    });

    if (locatorError) {
      console.error("Database error during media locator");
      return new Response(JSON.stringify({ error: "Internal server error fetching media" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!locatorData || !locatorData.bucket || !locatorData.path) {
      return new Response(JSON.stringify({ error: "Media locator missing or invalid" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 7. Sign exact bucket/path
    // 8. Fixed TTL 300s
    const expiresIn = 300;
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from(locatorData.bucket)
      .createSignedUrl(locatorData.path, expiresIn);

    if (signError) {
      console.error("Storage signing error");
      return new Response(JSON.stringify({ error: "Internal server error signing media" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // 9. Return safely
    return new Response(
      JSON.stringify({
        signed_url: signedData.signedUrl,
        expires_in: expiresIn,
        mime_type: locatorData.mime_type,
        original_filename: locatorData.original_filename,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (err) {
    console.error("Unhandled exception");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

// Start server if not running in test mode
if (import.meta.main) {
  serve(async (req) => {
    return handleRequest(req, {
      getEnv: (key) => Deno.env.get(key),
      createClient,
    });
  });
}
