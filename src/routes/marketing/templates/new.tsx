import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LayoutTemplate, AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { toast } from "sonner";

export const Route = createFileRoute("/marketing/templates/new")({
  component: TemplateNewPage,
});

function TemplateNewPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    channel: "email",
    subject: "",
    body: "",
  });
  const [loading, setLoading] = useState(false);

  const supportedVariables = [
    "{customer_name}",
    "{phone}",
    "{spa_name}",
    "{province}",
    "{product_interest}",
    "{sale_owner}"
  ];

  const handleSave = async () => {
    if (!formData.name || !formData.body) {
      return toast.error("Vui lòng nhập tên mẫu và nội dung mẫu.");
    }
    setLoading(true);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;

    const { data, error } = await supabase
      .from("marketing_templates")
      .insert({
        name: formData.name,
        channel: formData.channel,
        subject: formData.subject,
        body: formData.body,
        created_by: user.id,
        updated_by: user.id,
        status: "draft",
      })
      .select()
      .single();

    setLoading(false);
    if (error) {
      toast.error("Lỗi khi lưu mẫu: " + error.message);
    } else {
      toast.success("Đã tạo mẫu thành công");
      navigate({ to: `/marketing/templates/${data.id}` });
    }
  };

  return (
    <CRMPageContainer>
      <CRMPageHeader
        title="Tạo mẫu nội dung"
        backTo="/marketing/templates"
      />
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 p-4 rounded-xl flex items-center gap-3 mt-6">
        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
        <p className="text-sm font-medium">Thư viện mẫu chỉ dùng để soạn nội dung. Hệ thống chưa gửi tin tự động.</p>
      </div>
      <div className="mt-8 max-w-3xl">
        <Card className="p-6 bg-slate-900 border-slate-800">
          <div className="space-y-6">
            <div className="grid gap-2">
              <Label className="text-slate-300">Tiêu đề mẫu (Tên gọi nội bộ)</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white"
                placeholder="VD: Chăm sóc khách hàng VIP"
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
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white"
                placeholder="Nhập tiêu đề (nếu có)"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-slate-300">Nội dung mẫu</Label>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="bg-slate-950 border-slate-800 text-white min-h-[200px]"
                placeholder="Nhập nội dung mẫu..."
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
            <div className="pt-4 flex justify-end">
              <Button onClick={handleSave} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
                <Save className="w-4 h-4 mr-2" /> Lưu mẫu
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </CRMPageContainer>
  );
}
