import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAdmin } from '../_shared/authGuard.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const isProd = Deno.env.get('MARKETING_PRODUCTION_SENDING_ENABLED') === 'true';
    if (isProd) {
      throw new Error('Forbidden: Mock Worker cannot run in Production environment');
    }

    await requireAdmin(req);

    if (req.method !== 'POST') {
      throw new Error('Method Not Allowed: Expected POST');
    }

    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      throw new Error('Unauthorized: Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Server misconfigured: Missing SUPABASE_URL or SUPABASE_ANON_KEY');
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const body = await req.json();
    const { send_batch_id, limit = 50, force_result } = body;

    const allowedResults = ['delivered', 'failed'];

    if (force_result && !allowedResults.includes(force_result)) {
      throw new Error('Bad Request: force_result must be delivered or failed');
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);

    if (!send_batch_id) {
      throw new Error('Bad Request: Missing send_batch_id');
    }

    const { data: claimData, error: claimError } = await userClient.rpc(
      'm10_claim_mock_dispatches',
      {
        p_send_batch_id: send_batch_id,
        p_limit: safeLimit,
      }
    );

    if (claimError) {
      throw new Error(`Claim RPC Error: ${claimError.message}`);
    }

    if (!claimData || claimData.claimed_count === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pending dispatches to claim', claimed_count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { execution_id, claimed_count, rows } = claimData;
    
    const rowDetails: any[] = [];
    let successCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      const dispatchId = row.dispatch_id ?? row.id;

      if (!dispatchId) {
        failedCount++;
        rowDetails.push({
          dispatch_id: null,
          simulated_status: null,
          finalize_result: 'error',
          error: 'Missing dispatch_id from claim row',
        });
        continue;
      }

      const delayMs = Math.floor(Math.random() * 50) + 10;
      await new Promise((resolve) => setTimeout(resolve, delayMs));

      const simulated_status = force_result || (Math.random() > 0.05 ? 'delivered' : 'failed');

      const mockResultPayload = {
        simulated_status,
        reason: 'M10B-B Mock Worker Executed',
        mock_provider: true,
        mock_execution: true,
        worker_timestamp: new Date().toISOString(),
      };

      const { data: finalizeData, error: finalizeError } = await userClient.rpc(
        'm10_finalize_mock_dispatch_result',
        {
          p_dispatch_id: dispatchId,
          p_execution_id: execution_id,
          p_result: mockResultPayload,
        }
      );

      if (finalizeError) {
        failedCount++;
        rowDetails.push({
          dispatch_id: dispatchId,
          simulated_status,
          finalize_result: 'error',
          error: finalizeError.message,
        });
      } else {
        successCount++;
        rowDetails.push({
          dispatch_id: dispatchId,
          simulated_status,
          finalize_result: 'success',
          rpc_result: finalizeData,
          error: null,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mock execution completed',
        execution_id,
        summary: {
          total_claimed: claimed_count,
          successfully_finalized: successCount,
          failed_to_finalize: failedCount
        },
        details: rowDetails
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: err.message?.startsWith('Unauthorized') || err.message?.startsWith('Forbidden') ? 401 : 400 }
    );
  }
});
