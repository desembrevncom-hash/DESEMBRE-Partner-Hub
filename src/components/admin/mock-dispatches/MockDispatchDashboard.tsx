import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { BatchDataTable } from './BatchDataTable';
import { DispatchDataTable } from './DispatchDataTable';
import { MockBatch } from '@/types/mockDispatches';

export function MockDispatchDashboard() {
  const [batches, setBatches] = useState<MockBatch[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Fetch securely using standard fetch with auth headers
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mock-dispatch?resource=batches`;
      const res = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch batches');
      }

      const batchData = await res.json();
      setBatches(batchData);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="space-y-6">
      <BatchDataTable 
        batches={batches} 
        onSelectBatch={(id) => setSelectedBatchId(id)} 
        selectedId={selectedBatchId}
      />
      {selectedBatchId && (
        <DispatchDataTable batchId={selectedBatchId} />
      )}
    </div>
  );
}
