import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { handleResendWebhook } from "./handler.ts";

serve(async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  const envVars = {
    get: (name: string) => Deno.env.get(name),
  };

  try {
    const { status, body } = await handleResendWebhook(req as any, envVars, supabaseAdmin);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    // Top-level catch to ensure no internal errors leak full stack traces or secrets
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
