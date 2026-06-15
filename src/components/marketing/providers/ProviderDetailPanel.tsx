import { useProviderReadiness } from "@/hooks/useProviderReadiness";
import { ProviderAuditLogPanel } from "./ProviderAuditLogPanel";
import { Loader2 } from "lucide-react";

export function ProviderDetailPanel({ accountId }: { accountId: string }) {
  const { accounts, loadingAccounts } = useProviderReadiness();
  const account = accounts?.find(a => a.id === accountId);

  if (loadingAccounts) return <Loader2 className="animate-spin w-6 h-6" />;
  if (!account) return <div>Không tìm thấy Provider.</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="col-span-2 space-y-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200">
          <h2 className="text-xl font-bold mb-4">{account.account_name}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Loại: </span>
              <span className="font-medium">{account.provider_type}</span>
            </div>
            <div>
              <span className="text-slate-500">Trạng thái Readiness: </span>
              <span className="font-medium px-2 py-1 bg-amber-50 text-amber-700 rounded">{account.readiness_status}</span>
            </div>
            <div>
              <span className="text-slate-500">Configured Externally: </span>
              <span className="font-medium">{account.configured_externally ? 'Có' : 'Không'}</span>
            </div>
            <div>
              <span className="text-slate-500">Secret Status: </span>
              <span className="font-medium">{account.secret_status}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="col-span-1">
        <ProviderAuditLogPanel entityId={account.id} />
      </div>
    </div>
  );
}
