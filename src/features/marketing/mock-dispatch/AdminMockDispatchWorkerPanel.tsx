import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminMockDispatchWorker } from './useAdminMockDispatchWorker';
import { AlertTriangle, Play, CheckCircle2, XCircle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface AdminMockDispatchWorkerPanelProps {
  initialBatchId?: string | null;
}

export function AdminMockDispatchWorkerPanel({ initialBatchId }: AdminMockDispatchWorkerPanelProps) {
  const { isAdmin, isSubAdmin } = useAuth();
  const { invokeWorker, loading, result, error, resetState } = useAdminMockDispatchWorker();
  
  const [batchId, setBatchId] = useState('');
  const [limit, setLimit] = useState<number>(50);
  const [forceResult, setForceResult] = useState<'auto' | 'delivered' | 'failed'>('auto');

  useEffect(() => {
    if (initialBatchId) {
      setBatchId(initialBatchId);
      resetState();
    }
  }, [initialBatchId]);

  if (!isAdmin && !isSubAdmin) {
    return null; // Do not render if not admin/sub-admin
  }

  const handleRunMock = async () => {
    if (!batchId) return;
    
    // Prepare payload
    const payloadResult = forceResult === 'auto' ? null : forceResult;
    
    await invokeWorker({
      send_batch_id: batchId,
      limit: limit,
      force_result: payloadResult,
    });
  };

  return (
    <Card className="border-indigo-200 shadow-sm bg-indigo-50/30">
      <CardHeader className="pb-4 border-b border-indigo-100">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-indigo-600" />
          <CardTitle className="text-lg font-bold text-indigo-900">M10B Dispatch Worker (Mock Environment)</CardTitle>
        </div>
        <CardDescription className="text-indigo-700 font-medium">
          Môi trường mô phỏng (Sandbox). Dùng để claim và finalize các dispatch nội bộ mà không gửi tin thật ra Zalo/Email.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="pt-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label htmlFor="mock-batch-id" className="text-indigo-900 font-bold">Send Batch ID</Label>
            <Input 
              id="mock-batch-id"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="UUID của batch"
              className="bg-white border-indigo-200 focus-visible:ring-indigo-500"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="mock-limit" className="text-indigo-900 font-bold">Limit (1-100)</Label>
            <Input 
              id="mock-limit"
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-white border-indigo-200 focus-visible:ring-indigo-500"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-indigo-900 font-bold">Force Result (Deterministic)</Label>
            <Select 
              value={forceResult} 
              onValueChange={(val: any) => setForceResult(val)}
            >
              <SelectTrigger className="bg-white border-indigo-200 focus:ring-indigo-500">
                <SelectValue placeholder="Chọn kết quả" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Tự động (Random 95% Delivered)</SelectItem>
                <SelectItem value="delivered">Ép thành công (Delivered)</SelectItem>
                <SelectItem value="failed">Ép thất bại (Failed)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-rose-500 mt-0.5" />
            <div>
              <p className="font-bold text-rose-800 text-sm">Lỗi Worker</p>
              <p className="text-rose-600 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {result && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-white border border-emerald-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h4 className="font-bold text-emerald-900">Kết Quả Thực Thi: {result.execution_id}</h4>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                  <p className="text-xs font-bold text-slate-500 uppercase">Total Claimed</p>
                  <p className="text-2xl font-black text-slate-800">{result.summary?.total_claimed || 0}</p>
                </div>
                <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center">
                  <p className="text-xs font-bold text-emerald-600 uppercase">Success</p>
                  <p className="text-2xl font-black text-emerald-700">{result.summary?.successfully_finalized || 0}</p>
                </div>
                <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-center">
                  <p className="text-xs font-bold text-rose-600 uppercase">Failed</p>
                  <p className="text-2xl font-black text-rose-700">{result.summary?.failed_to_finalize || 0}</p>
                </div>
              </div>

              {result.details && result.details.length > 0 && (
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 font-bold text-slate-700">Dispatch ID</th>
                          <th className="px-4 py-2 font-bold text-slate-700">Simulated Status</th>
                          <th className="px-4 py-2 font-bold text-slate-700">Finalize Result</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.details.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono text-xs text-slate-600">{row.dispatch_id}</td>
                            <td className="px-4 py-2">
                              {row.simulated_status === 'delivered' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Delivered</Badge>
                              ) : row.simulated_status === 'failed' ? (
                                <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">Failed</Badge>
                              ) : (
                                <Badge variant="outline">{row.simulated_status}</Badge>
                              )}
                            </td>
                            <td className="px-4 py-2">
                              {row.finalize_result === 'success' ? (
                                <span className="text-emerald-600 font-medium text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Success</span>
                              ) : (
                                <span className="text-rose-600 font-medium text-xs flex items-center gap-1" title={row.error || ''}><XCircle className="w-3 h-3"/> Error</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </CardContent>
      
      <CardFooter className="bg-indigo-100/50 border-t border-indigo-100 pt-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-indigo-600 text-xs font-medium">
          <Info className="w-4 h-4" />
          Production mode is completely blocked.
        </div>
        <Button 
          onClick={handleRunMock} 
          disabled={loading || !batchId}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
        >
          {loading ? (
             <span className="flex items-center gap-2">Đang thực thi...</span>
          ) : (
             <span className="flex items-center gap-2"><Play className="w-4 h-4" /> Chạy Mock Worker</span>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
