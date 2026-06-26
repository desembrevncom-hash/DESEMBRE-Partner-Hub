import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MockWorkerRequest, MockWorkerResponse } from './types';

export function useAdminMockDispatchWorker() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MockWorkerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invokeWorker = async (request: MockWorkerRequest) => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Clean up payload (remove force_result if it's auto/random)
      const payload = {
        send_batch_id: request.send_batch_id,
        limit: request.limit,
        ...(request.force_result ? { force_result: request.force_result } : {}),
      };

      const { data, error: invokeError } = await supabase.functions.invoke<MockWorkerResponse>(
        'admin-mock-dispatch-worker',
        {
          body: payload,
        }
      );

      if (invokeError) {
        throw new Error(invokeError.message || 'Lỗi khi gọi admin-mock-dispatch-worker');
      }

      if (data && !data.success) {
        throw new Error(data.error || 'Mock worker execution failed');
      }

      setResult(data as MockWorkerResponse);
      return data;
    } catch (err: any) {
      console.error('Mock worker error:', err);
      const errorMessage = err.message || 'Lỗi không xác định';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setResult(null);
    setError(null);
  };

  return {
    invokeWorker,
    loading,
    result,
    error,
    resetState,
  };
}
