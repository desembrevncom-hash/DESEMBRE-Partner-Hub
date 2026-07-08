import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getSupabaseAdminClient } from "../_shared/supabaseAdmin.ts";
import { normalizePhone } from "../../src/lib/phoneNormalization.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid JWT' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const supabaseAdmin = getSupabaseAdminClient();

    // 1. Check if the user is already linked or pending
    const { data: existingLink } = await supabaseAdmin
      .from('student_accounts')
      .select('customer_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLink) {
      if (existingLink.status === 'blocked') {
        return new Response(JSON.stringify({ status: 'blocked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      if (existingLink.status === 'pending_review') {
        return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      // Assuming 'active' implies linked if customer_id exists
      return new Response(JSON.stringify({ status: 'linked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const setPendingReview = async () => {
      await supabaseAdmin.from('student_accounts').insert({
        user_id: user.id,
        status: 'pending_review'
      });
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    };

    if (!user.phone) {
      return setPendingReview();
    }

    const normalizedPhone = normalizePhone(user.phone);
    if (!normalizedPhone) {
      return setPendingReview();
    }

    // 2. Find customers by phone
    const { data: matchingCustomers, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
      // Assuming missing deleted_at is represented via NULL, though not all tables have it
      // Let's rely on the unique index condition or just check it without deleted_at since it wasn't specified broadly
      .maybeSingle();

    if (customerErr || !matchingCustomers) {
      // 0 Matches or >1 Match (maybeSingle throws error if multiple)
      return setPendingReview();
    }

    const customerId = matchingCustomers.id;

    // 3. Check if this customer is already linked to ANOTHER user
    const { data: otherLink } = await supabaseAdmin
      .from('student_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (otherLink) {
      return setPendingReview();
    }

    // 4. Exactly one match, not linked -> create student account
    const { error: insertErr } = await supabaseAdmin
      .from('student_accounts')
      .insert({
        user_id: user.id,
        customer_id: customerId,
        status: 'active'
      });

    if (insertErr) {
      console.error(insertErr);
      return setPendingReview();
    }

    // Ensure we write to audit log if the model supports it - currently relying on Supabase generic logs for Edge Functions, but can expand.

    return new Response(JSON.stringify({ status: 'linked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
