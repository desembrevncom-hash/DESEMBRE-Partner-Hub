import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw, Database, TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { MockDispatchAttempt } from './types';

interface MockDispatchAttemptsPanelProps {
  batchId?: string | null;
}

export function MockDispatchAttemptsPanel({ batchId }: MockDispatchAttemptsPanelProps) {
  const { isAdmin, isSubAdmin } = useAuth();
  const [attempts, setAttempts] = useState<MockDispatchAttempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAdmin && !isSubAdmin) return null;

  const fetchAttempts = async () => {
    if (!batchId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('marketing_send_dispatch_attempts')
        .select('*')
        .eq('send_batch_id', batchId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      setAttempts(data || []);
    } catch (err: any) {
      console.error('Lỗi tải attempts:', err);
      setError(err.message || 'Không thể tải danh sách attempts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchAttempts();
    } else {
      setAttempts([]);
    }
  }, [batchId]);

  return (
    <Card className="border-slate-200 shadow-sm mt-8">
      <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-lg font-bold text-slate-900">Observability: Mock Dispatch Attempts</CardTitle>
          </div>
          <CardDescription className="text-slate-500 font-medium">
            Giám sát các thao tác ghi Log của hệ thống đối với Batch ID hiện tại (hiển thị 50 bản ghi mới nhất).
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchAttempts} 
          disabled={loading || !batchId}
          className="flex items-center gap-2 font-bold"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Làm mới
        </Button>
      </CardHeader>
      
      <CardContent className="pt-0 p-0">
        {!batchId ? (
          <div className="p-8 text-center text-slate-400 font-medium">
            <TerminalSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Hãy chọn một Batch ID từ Bảng Điều Khiển để xem log attempts.</p>
          </div>
        ) : error ? (
          <div className="p-4 m-4 rounded-lg bg-rose-50 text-rose-600 font-medium text-sm">
            {error}
          </div>
        ) : attempts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 font-medium text-sm">
            Không tìm thấy bản ghi attempt nào cho Batch {batchId}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3 font-bold text-slate-700 whitespace-nowrap">Thời gian</th>
                  <th className="px-6 py-3 font-bold text-slate-700">Loại Attempt (Action)</th>
                  <th className="px-6 py-3 font-bold text-slate-700 whitespace-nowrap">Dispatch ID</th>
                  <th className="px-6 py-3 font-bold text-slate-700">Idempotency Key</th>
                  <th className="px-6 py-3 font-bold text-slate-700">Payload Snapshot / Result JSON</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {attempts.map((attempt) => (
                  <tr key={attempt.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-600">
                      {new Date(attempt.created_at).toLocaleString('vi-VN')}
                    </td>
                    <td className="px-6 py-4">
                      {attempt.attempt_type.includes('finalize') ? (
                        attempt.attempt_type.includes('rejected') || attempt.attempt_type.includes('fail') ? (
                           <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">{attempt.attempt_type}</Badge>
                        ) : (
                           <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">{attempt.attempt_type}</Badge>
                        )
                      ) : attempt.attempt_type.includes('claim') ? (
                        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">{attempt.attempt_type}</Badge>
                      ) : (
                        <Badge variant="outline">{attempt.attempt_type}</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{attempt.dispatch_id}</td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">{attempt.idempotency_key}</td>
                    <td className="px-6 py-4">
                       <div className="max-w-sm overflow-hidden text-ellipsis whitespace-nowrap text-slate-400 hover:whitespace-normal hover:break-all cursor-help" title={JSON.stringify(attempt.result_json || attempt.payload_snapshot_json, null, 2)}>
                         {JSON.stringify(attempt.result_json || attempt.payload_snapshot_json)}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
