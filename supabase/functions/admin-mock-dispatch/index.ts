import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/authGuard.ts";
import { sanitizeAttemptResponse } from "../_shared/piiSanitizer.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const adminClient = await requireAdmin(req);
    const url = new URL(req.url);
    const resource = url.searchParams.get('resource');

    if (resource === 'batches') {
      const { data, error } = await adminClient
        .from('marketing_send_batches')
        .select('id, channel, status, total_recipients, total_queued, total_skipped, total_simulated_success, total_simulated_failed, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (resource === 'dispatches') {
      const batchId = url.searchParams.get('batch_id');
      if (!batchId) throw new Error('Missing batch_id');

      const { data, error } = await adminClient
        .from('marketing_send_dispatches')
        .select('id, send_batch_id, send_queue_id, channel, status, mock_execution_id, mock_claimed_at, mock_finalized_at')
        .eq('send_batch_id', batchId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (resource === 'attempts') {
      const dispatchId = url.searchParams.get('dispatch_id');
      if (!dispatchId) throw new Error('Missing dispatch_id');

      const { data, error } = await adminClient
        .from('marketing_send_dispatch_attempts')
        .select('dispatch_id, event_type, created_at, event_json')
        .eq('dispatch_id', dispatchId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const safeData = data.map(sanitizeAttemptResponse);
      return new Response(JSON.stringify(safeData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid resource' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const message = error?.message || 'Internal Server Error';

    let status = 500;

    if (message.includes('Unauthorized')) {
      status = 401;
    } else if (message.includes('Forbidden')) {
      status = 403;
    } else if (message.includes('Missing') || message.includes('Invalid')) {
      status = 400;
    }

    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
