import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { MockAttemptLog } from '@/types/mockDispatches';

interface AttemptLogsModalProps {
  dispatchId: string;
  onClose: () => void;
}

export function AttemptLogsModal({ dispatchId, onClose }: AttemptLogsModalProps) {
  const [logs, setLogs] = useState<MockAttemptLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [dispatchId]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-mock-dispatch?resource=attempts&dispatch_id=${encodeURIComponent(dispatchId)}`;
      const res = await fetch(functionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch logs');
      }

      const data = await res.json();
      setLogs(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Attempt Logs (Sanitized)</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div>Loading logs...</div>
          ) : error ? (
            <div className="text-red-500">Error: {error}</div>
          ) : logs.length === 0 ? (
            <div className="text-gray-500">No logs found for this dispatch.</div>
          ) : (
            <div className="space-y-4">
              {logs.map((log, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-md bg-gray-50">
                  <div className="font-semibold text-sm mb-2 text-gray-700">
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-2">{log.event_type}</span>
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                  <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
                    {JSON.stringify(log.event_json_safe, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
