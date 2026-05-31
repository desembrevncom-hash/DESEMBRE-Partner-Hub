import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildAudiencePreview } from "@/lib/marketing/readiness";
import { AudiencePreviewTable } from "./AudiencePreviewTable";
import { Loader2, AlertTriangle } from "lucide-react";

interface CampaignDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  userId?: string;
}

export function CampaignDraftDialog({ open, onOpenChange, onSuccess, userId }: CampaignDraftDialogProps) {
  const [formName, setFormName] = useState("");
  const [channel, setChannel] = useState<"email" | "zalo">("email");
  const [draftSubject, setDraftSubject] = useState("");
  const [draftBody, setDraftBody] = useState("");
  
  const [previewing, setPreviewing] = useState(false);
  const [audienceList, setAudienceList] = useState<any[] | null>(null);
  const [totalAudience, setTotalAudience] = useState(0);
  const [saving, setSaving] = useState(false);

  const resetForm = () => {
    setFormName("");
    setChannel("email");
    setDraftSubject("");
    setDraftBody("");
    setAudienceList(null);
    setTotalAudience(0);
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const [
        { data: customers },
        { data: consents },
        { data: zaloProfiles },
        { data: dupPhones },
        { data: dupEmails }
      ] = await Promise.all([
        supabase.from("customers").select("id, name, phone, email, status, last_contacted_at").limit(5000),
        supabase.from("customer_consents").select("*"),
        supabase.from("customer_zalo_profiles").select("*"),
        supabase.from("v_customers_duplicate_phone").select("customer_ids").limit(1000),
        supabase.from("v_customers_duplicate_email").select("customer_ids").limit(1000)
      ]);

      const duplicateIds = new Set<string>();
      dupPhones?.forEach((d: any) => d.customer_ids?.forEach((id: string) => duplicateIds.add(id)));
      dupEmails?.forEach((d: any) => d.customer_ids?.forEach((id: string) => duplicateIds.add(id)));

      const consentMap = new Map<string, any[]>();
      consents?.forEach(c => {
        if (!consentMap.has(c.customer_id)) consentMap.set(c.customer_id, []);
        consentMap.get(c.customer_id)!.push(c);
      });

      const zaloProfileMap = new Map<string, any>();
      zaloProfiles?.forEach(zp => zaloProfileMap.set(zp.customer_id, zp));

      const readyAudience = buildAudiencePreview(
        customers || [],
        channel,
        duplicateIds,
        consentMap,
        zaloProfileMap
      );

      setTotalAudience(readyAudience.length);
      setAudienceList(readyAudience.slice(0, 100)); // Lấy 100 dòng đầu để preview
    } catch (e: any) {
      toast.error("Lỗi preview: " + e.message);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!formName.trim()) {
      toast.error("Vui lòng nhập tên chiến dịch");
      return;
    }

    setSaving(true);
    try {
      const targetCriteria = {
        type: "readiness",
        channel: channel,
        segment: channel === "email" ? "email_ready" : "zalo_ready",
        excluded: ["no_consent", "blocked", "inactive", "lost", "duplicate"]
      };

      const { error } = await supabase.from("marketing_campaigns").insert([{
        name: formName.trim(),
        channel: channel,
        draft_subject: draftSubject,
        draft_body: draftBody,
        status: "draft",
        approval_status: "draft",
        target_criteria: targetCriteria,
        audience_count: totalAudience,
        last_previewed_at: new Date().toISOString(),
        created_by: userId
      }]);

      if (error) throw error;
      
      toast.success("Đã tạo chiến dịch nháp thành công!");
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (e: any) {
      toast.error("Lỗi khi lưu chiến dịch: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if(!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo chiến dịch mới (Bản Nháp)</DialogTitle>
        </DialogHeader>

        <div className="bg-amber-50 text-amber-800 p-3 rounded-md border border-amber-200 text-sm flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <p><strong>Phase này chỉ tạo chiến dịch nháp.</strong> Hệ thống chưa kích hoạt tính năng gửi Email/Zalo thật để bảo đảm an toàn dữ liệu.</p>
        </div>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Tên chiến dịch</Label>
            <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nhập tên chiến dịch..." />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Kênh gửi</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={channel} 
                onChange={(e) => {
                  setChannel(e.target.value as any);
                  setAudienceList(null);
                  setTotalAudience(0);
                }}
              >
                <option value="email">Email</option>
                <option value="zalo">Zalo OA</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Phân khúc đích (Segment)</Label>
              <Input disabled value={channel === "email" ? "Email Ready (Đã Consent)" : "Zalo Ready (Đã Consent/Follow)"} className="bg-slate-50 text-slate-500 font-medium" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{channel === "email" ? "Tiêu đề Email (Subject)" : "Tiêu đề nội bộ Zalo"}</Label>
            <Input value={draftSubject} onChange={e => setDraftSubject(e.target.value)} placeholder="Nhập tiêu đề..." />
          </div>

          <div className="space-y-1">
            <Label>Nội dung thư (Draft)</Label>
            <Textarea rows={4} value={draftBody} onChange={e => setDraftBody(e.target.value)} placeholder="Soạn nội dung nháp tại đây..." />
          </div>

          {audienceList !== null && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <AudiencePreviewTable data={audienceList} audienceCount={totalAudience} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-end border-t pt-4 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Hủy bỏ</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={previewing || saving}>
            {previewing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Tính toán & Xem trước
          </Button>
          <Button onClick={handleSaveDraft} disabled={saving || audienceList === null}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Lưu bản nháp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
