import { useProviderReadiness } from "@/hooks/useProviderReadiness";
import { Loader2, Plus, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ProviderReadinessDashboard() {
  const { accounts, loadingAccounts } = useProviderReadiness();

  if (loadingAccounts) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Provider Readiness (M6)</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý cấu hình metadata & trạng thái sẵn sàng của các nhà cung cấp gửi tin.</p>
        </div>
        <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors">
          <Plus className="w-4 h-4" /> Thêm Provider
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 font-semibold">Tên tài khoản</th>
              <th className="px-6 py-4 font-semibold">Loại</th>
              <th className="px-6 py-4 font-semibold">Readiness Status</th>
              <th className="px-6 py-4 font-semibold">Secret Status</th>
              <th className="px-6 py-4 font-semibold text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts?.map(acc => (
              <tr key={acc.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-900">{acc.account_name}</td>
                <td className="px-6 py-4 text-slate-600">{acc.provider_type}</td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${acc.readiness_status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {acc.readiness_status}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600">{acc.secret_status}</td>
                <td className="px-6 py-4 text-right">
                  <Link to="/marketing/providers/readiness/$id" params={{ id: acc.id }} className="text-blue-600 hover:text-blue-700 font-medium text-sm flex items-center justify-end gap-1">
                    <Settings className="w-4 h-4" /> Cấu hình
                  </Link>
                </td>
              </tr>
            ))}
            {(!accounts || accounts.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Chưa có Provider nào được cấu hình.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
