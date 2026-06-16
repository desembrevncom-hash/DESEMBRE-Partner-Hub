import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { M7SendBatchStatus, M7SendBatch, M7PreviewResult } from '@/types/marketing_m7';

export type UIState = 'idle' | 'previewing' | 'previewed' | 'creating' | 'created' | 'enqueueing' | 'enqueued' | 'processing' | 'completed' | 'cancelling' | 'cancelled' | 'error';

export function useM7SendControl() {
  const [uiState, setUiState] = useState<UIState>('idle');
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<M7PreviewResult | null>(null);
  const [batchStatus, setBatchStatus] = useState<M7SendBatch | null>(null);
  
  const cancelledRef = useRef(false);
  const isProcessing = useRef(false);

  // Reset state
  const reset = () => {
    setUiState('idle');
    setCurrentBatchId(null);
    setPreviewResult(null);
    setBatchStatus(null);
    cancelledRef.current = false;
    isProcessing.current = false;
  };

  const previewBatch = async (campaignId: string, providerAccountId: string, templateMappingId: string, channel: string) => {
    setUiState('previewing');
    try {
      const { data, error } = await supabase.rpc('m7_preview_send_batch', {
        p_campaign_id: campaignId,
        p_provider_account_id: providerAccountId,
        p_marketing_template_id: null, // Note: The UI Pack 1.2 spec mentioned m7_preview_send_batch(uuid, uuid, uuid, text)
        p_provider_template_mapping_id: templateMappingId,
        p_channel: channel
      });
      if (error) throw error;
      
      setPreviewResult({
        total_valid: data.total_valid,
        total_skipped: data.total_skipped,
        skip_reasons_summary: data.skip_reasons_summary || {}
      });
      setUiState('previewed');
    } catch (err: any) {
      toast.error('Preview failed: ' + err.message);
      setUiState('error');
    }
  };

  const createBatch = async (campaignId: string, providerAccountId: string, templateMappingId: string, channel: string) => {
    setUiState('creating');
    try {
      const { data, error } = await supabase.rpc('m7_create_send_batch', {
        p_campaign_id: campaignId,
        p_provider_account_id: providerAccountId,
        p_marketing_template_id: null,
        p_provider_template_mapping_id: templateMappingId,
        p_channel: channel
      });
      if (error) throw error;
      
      setCurrentBatchId(data);
      setUiState('created');
      toast.success('Batch created successfully.');
      await pollStatus(data);
    } catch (err: any) {
      toast.error('Create Batch failed: ' + err.message);
      setUiState('error');
    }
  };

  const enqueueSnapshot = async () => {
    if (!currentBatchId) return;
    setUiState('enqueueing');
    try {
      const { error } = await supabase.rpc('m7_enqueue_approved_snapshot', {
        p_batch_id: currentBatchId
      });
      if (error) throw error;
      
      setUiState('enqueued');
      toast.success('Snapshot enqueued successfully.');
      await pollStatus(currentBatchId);
    } catch (err: any) {
      toast.error('Enqueue failed: ' + err.message);
      setUiState('error');
    }
  };

  const pollStatus = async (batchId: string) => {
    try {
      const { data, error } = await supabase.rpc('m7_get_send_batch_status', {
        p_batch_id: batchId
      });
      if (error) throw error;
      setBatchStatus(data as unknown as M7SendBatch);
      return data as unknown as M7SendBatch;
    } catch (err) {
      console.error("Poll status error", err);
      return null;
    }
  };

  const processDryRun = async () => {
    if (!currentBatchId || isProcessing.current) return;
    
    setUiState('processing');
    isProcessing.current = true;
    cancelledRef.current = false;

    let iterations = 0;
    const maxIterations = 1000;

    try {
      while (iterations < maxIterations && !cancelledRef.current) {
        iterations++;
        
        const { data: rowsProcessed, error } = await supabase.rpc('m7_process_send_queue_dry_run', {
          p_batch_id: currentBatchId,
          p_limit: 100
        });

        if (error) throw error;

        const currentStatus = await pollStatus(currentBatchId);
        
        if (currentStatus) {
          if (currentStatus.status === 'completed' || currentStatus.status === 'cancelled') {
            setUiState(currentStatus.status);
            break;
          }
          if (rowsProcessed === 0 && currentStatus.total_queued > 0) {
            throw new Error('Zombie loop detected: 0 rows processed but queue is not empty.');
          }
          if (currentStatus.total_queued === 0 && currentStatus.total_processing === 0) {
             setUiState('completed');
             break;
          }
        }

        // Delay 400ms
        await new Promise(r => setTimeout(r, 400));
      }
      
      if (iterations >= maxIterations) {
         toast.error('Max iterations reached');
         setUiState('error');
      }
    } catch (err: any) {
      toast.error('Dry-Run error: ' + err.message);
      setUiState('error');
    } finally {
      isProcessing.current = false;
      await pollStatus(currentBatchId);
    }
  };

  const cancelBatch = async () => {
    if (!currentBatchId) return;
    cancelledRef.current = true;
    setUiState('cancelling');
    try {
      const { error } = await supabase.rpc('m7_cancel_send_batch', {
        p_batch_id: currentBatchId
      });
      if (error) throw error;
      
      setUiState('cancelled');
      toast.success('Batch cancelled.');
      await pollStatus(currentBatchId);
    } catch (err: any) {
      toast.error('Cancel failed: ' + err.message);
      setUiState('error');
    }
  };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      isProcessing.current = false;
    };
  }, []);

  return {
    uiState,
    currentBatchId,
    previewResult,
    batchStatus,
    previewBatch,
    createBatch,
    enqueueSnapshot,
    processDryRun,
    cancelBatch,
    reset
  };
}
