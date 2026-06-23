import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MockDispatch } from '@/types/mockDispatches';
import { AttemptLogsModal } from './AttemptLogsModal';

interface DispatchDataTableProps {
  batchId: string;
}

export function DispatchDataTable({ batchId }: DispatchDataTableProps) {
  const [dispatches, setDispatches] = useState<MockDispatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);

  useEffect(() => {
    fetchDispatches();
  }, [batchId]);

  const fetchDispatches = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mock-dispatch?resource=dispatches&batch_id=${encodeURIComponent(batchId)}`;
      const res = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch dispatches');
      }

      const data = await res.json();
      setDispatches(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="mt-4">Loading dispatches...</div>;
  if (error) return <div className="mt-4 text-red-500">Error: {error}</div>;
  if (dispatches.length === 0) return <div className="mt-4 text-gray-500">No dispatches found for this batch.</div>;

  return (
    <div className="mt-6">
      <h2 className="text-xl font-bold mb-4">Dispatches for Batch</h2>
      <div className="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dispatch ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Claimed At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Finalized At</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {dispatches.map((dispatch) => (
              <tr key={dispatch.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{dispatch.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{dispatch.status}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dispatch.mock_claimed_at ? new Date(dispatch.mock_claimed_at).toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {dispatch.mock_finalized_at ? new Date(dispatch.mock_finalized_at).toLocaleString() : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button 
                    onClick={() => setSelectedDispatchId(dispatch.id)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    View Logs
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedDispatchId && (
        <AttemptLogsModal 
          dispatchId={selectedDispatchId} 
          onClose={() => setSelectedDispatchId(null)} 
        />
      )}
    </div>
  );
}
