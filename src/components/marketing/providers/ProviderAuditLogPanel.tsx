import { useProviderReadiness } from "@/hooks/useProviderReadiness";
import { Loader2 } from "lucide-react";

export function ProviderAuditLogPanel({ entityId }: { entityId: string }) {
  const { getAuditLogs } = useProviderReadiness();
  const { data: logs, isLoading } = getAuditLogs(entityId);

  if (isLoading) return <Loader2 className="animate-spin w-4 h-4" />;
  if (!logs?.length) return <div className="text-sm text-slate-500">Chưa có lịch sử thay đổi.</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-slate-900">Lịch sử thay đổi (Audit Log)</h3>
      <div className="space-y-2">
        {logs.map(log => (
          <div key={log.id} className="p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
            <div className="font-medium text-slate-700">Hành động: {log.action}</div>
            <div className="text-xs text-slate-500">Lúc: {new Date(log.created_at).toLocaleString('vi-VN')}</div>
            <pre className="mt-2 text-xs bg-white p-2 rounded border border-slate-200 overflow-auto">
              {JSON.stringify(log.changes_json, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}
