import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, Play, Undo, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function CampaignApprovalPanel({ campaign, refetch }: { campaign: any, refetch: () => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [actionType, setActionType] = useState<string | null>(null);

  const { data: userRole } = useQuery({
    queryKey: ["user-role-approval"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      return data?.role;
    }
  });

  const isAdminOrSubAdmin = userRole === "admin" || userRole === "sub_admin";

  const handleAction = async (action: string) => {
    try {
      setIsSubmitting(true);
      setActionType(action);
      
      let rpcName = "";
      let params: any = { p_campaign_id: campaign.id, p_note: note };

      if (action === "submit") rpcName = "submit_marketing_campaign_for_review";
      if (action === "approve") {
        rpcName = "approve_marketing_campaign_with_recipients";
        // Pre-fetch live customers using segment rules to pass to RPC
        const { data: customers } = await supabase.from("customers").select("*");
        if (!customers) throw new Error("Could not fetch customers");
        
        // Dynamically evaluate locally first
        const { evaluateAudience } = await import("@/lib/marketing/segmentRules");
        const matched = evaluateAudience(customers, campaign.segment_rules_snapshot_json);
        const matchedIds = matched.map((c: any) => c.id);
        
        if (matchedIds.length === 0) {
          throw new Error("Không có khách hàng nào khớp điều kiện để chốt.");
        }
        params.p_customer_ids = matchedIds;
      }
      if (action === "reject") rpcName = "reject_marketing_campaign";
      if (action === "reopen") rpcName = "reopen_marketing_campaign";

      const { error } = await supabase.rpc(rpcName as any, params);
      
      if (error) {
        throw error;
      }

      toast.success("Thao tác thành công");
      setNote("");
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Đã xảy ra lỗi");
    } finally {
      setIsSubmitting(false);
      setActionType(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {campaign.approval_status === "draft" && (
          <Button 
            onClick={() => handleAction("submit")} 
            disabled={isSubmitting}
            className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all hover:-translate-y-0.5"
          >
            {isSubmitting && actionType === "submit" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Gửi duyệt
          </Button>
        )}
        
        {campaign.approval_status === "pending_review" && isAdminOrSubAdmin && (
          <>
            <Button 
              onClick={() => handleAction("approve")} 
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all hover:-translate-y-0.5"
            >
              {isSubmitting && actionType === "approve" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Duyệt chiến dịch
            </Button>
            <Button 
              variant="destructive"
              onClick={() => handleAction("reject")} 
              disabled={isSubmitting}
              className="rounded-xl font-bold shadow-md transition-all hover:-translate-y-0.5"
            >
              {isSubmitting && actionType === "reject" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
              Từ chối
            </Button>
          </>
        )}

        {(campaign.approval_status === "approved" || campaign.approval_status === "rejected") && isAdminOrSubAdmin && (
          <Button 
            variant="outline"
            onClick={() => handleAction("reopen")} 
            disabled={isSubmitting}
            className="rounded-xl border-slate-300 font-bold hover:bg-slate-50 transition-all"
          >
            {isSubmitting && actionType === "reopen" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Undo className="w-4 h-4 mr-2" />}
            Mở lại bản nháp
          </Button>
        )}
      </div>

      {(campaign.approval_status === "draft" || campaign.approval_status === "pending_review" || campaign.approval_status === "rejected") && (
        <Textarea 
          placeholder="Ghi chú duyệt (không bắt buộc)..." 
          value={note}
          onChange={e => setNote(e.target.value)}
          className="rounded-xl border-slate-200 resize-none min-h-[80px]"
        />
      )}
    </div>
  );
}
