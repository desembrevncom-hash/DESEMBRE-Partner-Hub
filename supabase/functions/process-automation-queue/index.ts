import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { processQueueHandler } from "./handler.ts";

const STAGING_REF = 'wmhfvggbthyikqvlyqup';
const PROD_REF = 'xhfqjupiidexvlltstal';

Deno.serve(async (req) => {
  // Hard block production
  const projectRef = Deno.env.get("SUPABASE_PROJECT_REF") || "";
  
  if (projectRef === PROD_REF || projectRef !== STAGING_REF) {
    return new Response(
      JSON.stringify({ error: "Forbidden: This function can only run on the specified Staging environment." }),
      { headers: { "Content-Type": "application/json" }, status: 403 }
    );
  }

  // Ensure it's a POST request (manual invocation)
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { headers: { "Content-Type": "application/json" }, status: 405 }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    // Avoid leaking which secret is missing
    return new Response(
      JSON.stringify({ error: "Internal Server Error: Missing required environment configurations." }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  try {
    const result = await processQueueHandler(supabaseUrl, supabaseServiceKey);
    return new Response(
      JSON.stringify(result),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    // Do not leak secrets in error message
    console.error("Critical error in processAutomationQueue:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error during queue processing." }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
