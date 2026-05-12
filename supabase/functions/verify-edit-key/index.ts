const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EDIT_PASSWORD = Deno.env.get("EDIT_PASSWORD");

// Constant-time string comparison to mitigate timing attacks
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!EDIT_PASSWORD) {
    return new Response(
      JSON.stringify({ error: "Server password not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const password =
    typeof body === "object" && body !== null && "password" in body
      ? String((body as Record<string, unknown>).password ?? "")
      : "";

  if (!password || password.length > 256) {
    return new Response(
      JSON.stringify({ valid: false, error: "Mật khẩu không hợp lệ" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const valid = safeEqual(password, EDIT_PASSWORD);

  // Small delay to slow brute-force attempts
  await new Promise((r) => setTimeout(r, 250));

  return new Response(JSON.stringify({ valid }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
