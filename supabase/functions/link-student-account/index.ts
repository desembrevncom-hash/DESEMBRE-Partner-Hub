import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// A lightweight version of the phone normalizer for Deno environment
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+84')) digits = digits.substring(3);
  else if (digits.startsWith('84') && digits.length === 11) digits = digits.substring(2);
  else if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.length !== 9) return null;
  const validPrefixes = ['3', '5', '7', '8', '9'];
  if (!validPrefixes.includes(digits[0])) return null;
  return `+84${digits}`;
}

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

    if (!user.phone) {
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const normalizedPhone = normalizePhone(user.phone);
    if (!normalizedPhone) {
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Check if the user is already linked
    const { data: existingLink } = await supabaseAdmin
      .from('student_accounts')
      .select('customer_id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLink) {
      if (existingLink.status === 'blocked') {
        return new Response(JSON.stringify({ status: 'blocked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
      return new Response(JSON.stringify({ status: 'linked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 2. Find customers by phone
    const { data: matchingCustomers, error: customerErr } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('normalized_phone', normalizedPhone)
      .is('deleted_at', null);

    if (customerErr) {
       console.error(customerErr);
       return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Zero matches or Multiple matches -> pending_review
    if (!matchingCustomers || matchingCustomers.length !== 1) {
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const customerId = matchingCustomers[0].id;

    // 3. Check if this customer is already linked to ANOTHER user
    const { data: otherLink } = await supabaseAdmin
      .from('student_accounts')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (otherLink) {
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // 4. Exactly one match, not linked -> create student account
    const { error: insertErr } = await supabaseAdmin
      .from('student_accounts')
      .insert({
        user_id: user.id,
        customer_id: customerId
      });

    if (insertErr) {
      console.error(insertErr);
      return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Ensure we write to audit log if the model supports it - currently relying on Supabase generic logs for Edge Functions, but can expand.

    return new Response(JSON.stringify({ status: 'linked' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ status: 'pending_review' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
