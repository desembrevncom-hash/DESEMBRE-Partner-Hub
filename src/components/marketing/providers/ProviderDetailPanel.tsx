import { useProviderReadiness } from "@/hooks/useProviderReadiness";
import { ProviderAuditLogPanel } from "./ProviderAuditLogPanel";
import { Loader2, CheckCircle, FileJson } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
export function ProviderDetailPanel({ accountId }: { accountId: string }) {
  const { accounts, loadingAccounts } = useProviderReadiness();
  const account = accounts?.find(a => a.id === accountId);

  if (loadingAccounts) return <Loader2 className="animate-spin w-6 h-6" />;
  if (!account) return <div>Không tìm thấy Provider.</div>;

  const queryClient = useQueryClient();

  const handleUpdateMetadata = async () => {
    try {
      const { error } = await supabase.rpc('m6_update_provider_external_config_status', {
        p_provider_id: accountId,
        p_readiness_status: 'pending_manual_verification',
        p_secret_status: 'not_required_yet',
        p_secret_reference: null,
        p_configured_externally: true,
        p_manual_verification_notes: 'QA test metadata update'
      });
      if (error) throw error;
      toast.success("Cập nhật metadata thành công!");
      queryClient.invalidateQueries({ queryKey: ["m6-provider-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["m6-provider-logs"] });
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

  const handleAddMapping = async () => {
    // Lấy đại 1 template ID từ DB để map
    const { data: templates } = await supabase.from('marketing_templates').select('id').limit(1);
    if (!templates || templates.length === 0) {
      toast.error("Không tìm thấy template nào ở module M2 để map.");
      return;
    }
    
    try {
      const { error } = await supabase.rpc('m6_upsert_template_mapping', {
        p_marketing_template_id: templates[0].id,
        p_provider_account_id: accountId,
        p_provider_template_id: 'ZALO_TEMPLATE_123',
        p_param_mapping_json: { "name": "customer_name" },
        p_mapping_status: 'draft',
        p_readiness_status: 'not_configured',
        p_verification_notes: 'QA map test'
      });
      if (error) throw error;
      toast.success("Tạo Template Mapping thành công!");
      queryClient.invalidateQueries({ queryKey: ["m6-provider-logs"] });
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    }
  };

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
          
          <div className="mt-6 pt-6 border-t border-slate-100 flex gap-3">
            <button onClick={handleUpdateMetadata} className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium transition-colors">
              <CheckCircle className="w-4 h-4" /> Cập nhật Metadata (QA)
            </button>
            <button onClick={handleAddMapping} className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 text-sm font-medium transition-colors">
              <FileJson className="w-4 h-4" /> Tạo Template Mapping (QA)
            </button>
          </div>
        </div>
      </div>
      <div className="col-span-1">
        <ProviderAuditLogPanel entityId={account.id} />
      </div>
    </div>
  );
}
