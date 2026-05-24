import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TimelineItem } from '@/types/customerTimeline';
import { toast } from 'sonner';

export const useCustomerTimeline = (customerId: string | undefined) => {
  const [data, setData] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTimeline = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    setError(null);
    try {
      const { data: timelineData, error: rpcError } = await supabase.rpc(
        'get_customer_timeline',
        { p_customer_id: customerId }
      );

      if (rpcError) {
        throw rpcError;
      }

      // Supabase RPC returns JSONB array, we can safely cast it to TimelineItem[]
      setData((timelineData as unknown as TimelineItem[]) || []);
    } catch (err: any) {
      console.error('Error fetching customer timeline:', err);
      setError(err);
      toast.error(`Lỗi: ${err?.message || JSON.stringify(err) || 'Không rõ'}`);
      setData([]); // Fallback empty
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  return {
    data,
    loading,
    error,
    refetch: fetchTimeline
  };
};
