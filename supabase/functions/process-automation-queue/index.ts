import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { processQueueHandler } from "./handler.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.2";

const STAGING_REF = 'wmhfvggbthyikqvlyqup';
const PROD_REF = 'xhfqjupiidexvlltstal';

Deno.serve(async (req) => {
  // Ensure it's a POST request
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: "Method not allowed. Use POST." }),
      { headers: { "Content-Type": "application/json" }, status: 405 }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // 1. Environment Gate
  const reqUrl = req.url || "";
  
  const isProd = supabaseUrl.includes(PROD_REF) || reqUrl.includes(PROD_REF);
  const isStaging = supabaseUrl.includes(STAGING_REF) || reqUrl.includes(STAGING_REF);

  if (isProd) {
    return new Response(
      JSON.stringify({ error: "Forbidden: This function can only run on the specified Staging environment." }),
      { headers: { "Content-Type": "application/json" }, status: 403 }
    );
  }

  if (!isStaging) {
    return new Response(
      JSON.stringify({ error: "Forbidden: environment verification failed" }),
      { headers: { "Content-Type": "application/json" }, status: 403 }
    );
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error: Missing required environment configurations." }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }

  // 2. Role Gate
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Missing Authorization header." }),
      { headers: { "Content-Type": "application/json" }, status: 401 }
    );
  }

  // Create a supabase client with the caller's JWT to verify their identity and role
  const supabaseCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") || "", {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: userData, error: userError } = await supabaseCaller.auth.getUser();
  if (userError || !userData?.user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized: Invalid JWT." }),
      { headers: { "Content-Type": "application/json" }, status: 401 }
    );
  }

  // Fetch role
  const { data: roles } = await supabaseCaller
    .from('user_roles')
    .select('role')
    .eq('user_id', userData.user.id);

  const hasAdminRole = roles?.some(r => r.role === 'admin' || r.role === 'sub_admin');
  
  if (!hasAdminRole) {
    return new Response(
      JSON.stringify({ error: "Forbidden: admin/sub_admin required." }),
      { headers: { "Content-Type": "application/json" }, status: 403 }
    );
  }

  // 3. Execution
  try {
    const result = await processQueueHandler(supabaseUrl, supabaseServiceKey);
    return new Response(
      JSON.stringify(result),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    );
  } catch (err: any) {
    console.error("Critical error in processAutomationQueue:", err);
    return new Response(
      JSON.stringify({ error: "Internal Server Error during queue processing." }),
      { headers: { "Content-Type": "application/json" }, status: 500 }
    );
  }
});
