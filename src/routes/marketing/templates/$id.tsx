import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Save, Archive, PlayCircle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/marketing/templates/$id")({
  component: TemplateEditPage,
});

function TemplateEditPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supportedVariables = [
    "{customer_name}",
    "{phone}",
    "{spa_name}",
    "{province}",
    "{product_interest}",
    "{sale_owner}"
  ];

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("marketing_templates")
      .select("*")
      .eq("id", id)
      .single();
    
    if (data) setFormData(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.body) {
      return toast.error("Vui lòng nhập tên mẫu và nội dung mẫu.");
    }
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    
    const { error } = await supabase
      .from("marketing_templates")
      .update({
        name: formData.name,
        channel: formData.channel,
        subject: formData.subject,
        body: formData.body,
        updated_by: user?.id,
      })
      .eq("id", id);

    setSaving(false);
    if (error) {
      toast.error("Lỗi khi lưu mẫu: " + error.message);
    } else {
      toast.success("Đã lưu mẫu thành công");
      fetchTemplate();
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    const user = (await supabase.auth.getUser()).data.user;
    const updateData: any = { status: newStatus, updated_by: user?.id };
    
    if (newStatus === "archived") {
      updateData.archived_at = new Date().toISOString();
      updateData.archived_by = user?.id;
    }

    const { error } = await supabase
      .from("marketing_templates")
      .update(updateData)
      .eq("id", id);
      
    setSaving(false);
    if (error) {
      toast.error("Lỗi cập nhật trạng thái: " + error.message);
    } else {
      toast.success("Đã cập nhật trạng thái thành công");
      if (newStatus === "archived") {
        navigate({ to: "/marketing/templates" });
      } else {
        fetchTemplate();
      }
    }
  };

  const renderPreview = (text: string) => {
    if (!text) return "";
    let parsed = text;
    // Replace known variables
    parsed = parsed.replace(/{customer_name}/g, "Nguyễn Văn A");
    parsed = parsed.replace(/{phone}/g, "0901234567");
    parsed = parsed.replace(/{spa_name}/g, "Spa Hoa Hồng");
    parsed = parsed.replace(/{province}/g, "Hà Nội");
    parsed = parsed.replace(/{product_interest}/g, "Máy Laser");
    parsed = parsed.replace(/{sale_owner}/g, "Trần B");
    
    // Replace any unknown variables with warning
    parsed = parsed.replace(/\{[^}]+\}/g, "[Biến chưa được hỗ trợ]");
    return parsed;
  };

  if (loading || !formData) return <div className="p-8 text-white">Đang tải...</div>;

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Chỉnh sửa mẫu"
        backTo="/marketing/templates"
      />
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-center gap-3 mt-6">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">Thư viện mẫu chỉ dùng để soạn nội dung. Hệ thống chưa gửi tin tự động.</p>
      </div>
      
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="p-6 bg-slate-900 border-slate-800">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label className="text-slate-300">Tiêu đề mẫu</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Kênh</Label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white"
              >
                <option value="email">Email</option>
                <option value="zalo_manual">Zalo (Thủ công)</option>
                <option value="facebook_manual">Facebook (Thủ công)</option>
                <option value="call_script">Kịch bản Telesale</option>
                <option value="export_only">Chỉ xuất file</option>
              </select>
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Tiêu đề tin nhắn / Email</Label>
              <Input
                value={formData.subject || ""}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Nội dung mẫu</Label>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white min-h-[200px]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Biến cá nhân hóa</Label>
              <div className="flex flex-wrap gap-2">
                {supportedVariables.map((v) => (
                  <button
                    key={v}
                    onClick={() => setFormData({ ...formData, body: formData.body + " " + v })}
                    className="px-2 py-1 text-xs font-mono bg-slate-800 text-slate-300 rounded hover:bg-slate-700"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="pt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800">
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white">
                  <Save className="w-4 h-4 mr-2" /> Lưu mẫu
                </Button>
                {formData.status !== "active" && (
                  <Button onClick={() => handleStatusChange("active")} disabled={saving} variant="outline" className="text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10">
                    <PlayCircle className="w-4 h-4 mr-2" /> Kích hoạt mẫu
                  </Button>
                )}
                {formData.status === "active" && (
                  <Button onClick={() => handleStatusChange("draft")} disabled={saving} variant="outline">
                    Chuyển về Bản nháp
                  </Button>
                )}
              </div>
              <Button onClick={() => handleStatusChange("archived")} disabled={saving} variant="ghost" className="text-red-500 hover:bg-red-500/10">
                <Archive className="w-4 h-4 mr-2" /> Lưu trữ mẫu
              </Button>
            </div>
          </div>
        </Card>

        {/* Preview Panel */}
        <Card className="p-6 bg-slate-900 border-slate-800 h-fit sticky top-24">
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-purple-400" />
            <h3 className="text-lg font-bold text-white">Xem trước nội dung</h3>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 mt-4">
            {formData.subject && (
              <div className="mb-4 pb-4 border-b border-slate-800">
                <span className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1 block">Tiêu đề:</span>
                <div className="text-white font-medium whitespace-pre-wrap">{renderPreview(formData.subject)}</div>
              </div>
            )}
            <div>
              <span className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1 block">Nội dung:</span>
              <div className="text-slate-300 whitespace-pre-wrap">{renderPreview(formData.body) || "Chưa có nội dung"}</div>
            </div>
          </div>
        </Card>
      </div>
    </CRMPageContainer>
  );
}
