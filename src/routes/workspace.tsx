import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { ManagerWorkspace } from "@/components/workspace/ManagerWorkspace";
import { TeleLeadWorkspace } from "@/components/workspace/TeleLeadWorkspace";
import { SaleWorkspace } from "@/components/workspace/SaleWorkspace";
import { TelesaleWorkspace } from "@/components/workspace/TelesaleWorkspace";

export const Route = createFileRoute("/workspace")({
  component: WorkspacePage,
});

function WorkspacePage() {
  const { loading, isAdmin, isSubAdmin, isTeleLead, isSale, isTelesale } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-900 flex items-center justify-center shadow-2xl shadow-slate-200">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p className="text-sm font-bold text-slate-400 animate-pulse uppercase tracking-widest">
            Đang khởi tạo CRM OS...
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin || isSubAdmin) return <ManagerWorkspace />;
  if (isTeleLead) return <TeleLeadWorkspace />;
  if (isSale) return <SaleWorkspace />;

  return <TelesaleWorkspace />;
}
