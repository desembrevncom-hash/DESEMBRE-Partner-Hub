import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, 
  Megaphone, 
  Plus, 
  Pencil, 
  Trash2, 
  Send, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Layers, 
  Eye, 
  Sparkles,
  HelpCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { renderTemplate, SUPPORTED_TEMPLATE_VARIABLES } from "@/lib/templateRenderer";

export const Route = createFileRoute("/admin/templates")({
  component: AdminTemplatesPage,
});

// Kiểu dữ liệu chuẩn hóa
interface MessageTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  channel: string;
  purpose: string;
  requires_opt_in: boolean;
  include_unsubscribe: boolean;
  max_send_frequency_days: number | null;
  subject_template: string | null;
  body_template: string;
  sample_variables: Record<string, any> | null;
  is_active: boolean;
  updated_at: string;
}

interface CalendarAccount {
  id: string;
  name: string;
  calendar_id: string;
  owner_email: string | null;
  is_default: boolean;
  is_active: boolean;
}

interface TestLog {
  id: string;
  test_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
  template_name?: string;
  account_name?: string;
}

function AdminTemplatesPage() {
  const { user, isManager } = useAuth();
  const navigate = useNavigate();

  // Dữ liệu DB
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [accounts, setAccounts] = useState<CalendarAccount[]>([]);
  const [testLogs, setTestLogs] = useState<TestLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Trạng thái modal form
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);

  // Form Fields cho việc tạo/sửa Template
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formChannel, setFormChannel] = useState("calendar_invite");
  const [formPurpose, setFormPurpose] = useState("transactional");
  const [formRequiresOptIn, setFormRequiresOptIn] = useState(false);
  const [formIncludeUnsubscribe, setFormIncludeUnsubscribe] = useState(false);
  const [formMaxFrequency, setFormMaxFrequency] = useState<string>("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");


  // Trạng thái Form Gửi Test
  const [testTemplateId, setTestTemplateId] = useState("");
  const [testAccountId, setTestAccountId] = useState("");
  const [testEmailInput, setTestEmailInput] = useState("");
  const [testing, setTesting] = useState(false);

  // Trạng thái Preview nhanh
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Tải danh sách templates
      const { data: tpls, error: errTpl } = await supabase
        .from("message_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (errTpl) throw errTpl;
      setTemplates(tpls || []);

      // 2. Tải danh sách tài khoản lịch
      const { data: accs, error: errAcc } = await supabase
        .from("google_calendar_accounts")
        .select("*")
        .eq("is_active", true)
        .order("is_default", { ascending: false });

      if (errAcc) throw errAcc;
      setAccounts(accs || []);

      // 3. Tải lịch sử test gần đây
      const { data: logs, error: errLog } = await supabase
        .from("template_test_logs")
        .select(`
          id, test_email, status, error_message, created_at,
          message_templates ( name ),
          google_calendar_accounts ( name )
        `)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!errLog && logs) {
        setTestLogs(logs.map((l: any) => ({
          id: l.id,
          test_email: l.test_email,
          status: l.status,
          error_message: l.error_message,
          created_at: l.created_at,
          template_name: l.message_templates?.name,
          account_name: l.google_calendar_accounts?.name,
        })));
      }

      // Khởi tạo giá trị mặc định cho dropdown test nếu có
      if (tpls && tpls.length > 0) setTestTemplateId(tpls[0].id);
      if (accs && accs.length > 0) setTestAccountId(accs[0].id);

    } catch (err: any) {
      toast.error("Lỗi nạp dữ liệu: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    if (!isManager) {
      toast.error("Chỉ Admin / Phó Admin mới có quyền quản lý mẫu tin nhắn");
      navigate({ to: "/" });
      return;
    }
    loadData();
  }, [user, isManager]);

  // Bật / tắt Template
  const handleToggleActive = async (tpl: MessageTemplate) => {
    try {
      const nextState = !tpl.is_active;
      // Độc quyền kích hoạt trên kênh (tùy chọn để tránh sale nhầm lẫn)
      if (nextState && tpl.channel === 'calendar_invite') {
        await supabase
          .from("message_templates")
          .update({ is_active: false })
          .eq("channel", 'calendar_invite')
          .neq("id", tpl.id);
      }

      const { error } = await supabase
        .from("message_templates")
        .update({ is_active: nextState })
        .eq("id", tpl.id);

      if (error) throw error;
      toast.success(`Đã ${nextState ? 'kích hoạt' : 'tạm dừng'} mẫu "${tpl.name}"`);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật trạng thái: " + err.message);
    }
  };

  // Mở form thêm mới
  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setFormKey(`template_${Date.now()}`);
    setFormName("");
    setFormDesc("");
    setFormChannel("calendar_invite");
    setFormPurpose("transactional");
    setFormRequiresOptIn(false);
    setFormIncludeUnsubscribe(false);
    setFormMaxFrequency("");
    setFormSubject("[DESEMBRE] Thư mời: {{event_title}}");
    setFormBody(`Kính gửi Quý đối tác / Khách mời: {{customer_name}}\n\nCông ty {{company_name}} trân trọng kính mời Quý khách tham dự chương trình đào tạo và chuyển giao phác đồ chuyên sâu.\n\n📌 THÔNG TIN SỰ KIỆN:\n- Chủ đề: {{event_title}}\n- Thời gian: {{event_time}}\n- Địa điểm: {{event_location}}\n- Link trực tuyến: {{meeting_url}}\n\nChuyên viên phụ trách: {{sale_name}}\nLink nạp nhanh vào Lịch Google: {{calendar_link}}\n\nSự hiện diện của Quý khách là niềm vinh hạnh lớn cho công ty chúng tôi.\nTrân trọng,\nBan Giám Đốc DESEMBRE Partner Hub`);
    setEditModalOpen(true);
  };

  // Mở form chỉnh sửa
  const handleOpenEdit = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl);
    setFormKey(tpl.key);
    setFormName(tpl.name);
    setFormDesc(tpl.description || "");
    setFormChannel(tpl.channel);
    setFormPurpose(tpl.purpose || "transactional");
    setFormRequiresOptIn(tpl.requires_opt_in || false);
    setFormIncludeUnsubscribe(tpl.include_unsubscribe || false);
    setFormMaxFrequency(tpl.max_send_frequency_days ? String(tpl.max_send_frequency_days) : "");
    setFormSubject(tpl.subject_template || "");
    setFormBody(tpl.body_template);
    setEditModalOpen(true);
  };

  // Lưu dữ liệu Template
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKey.trim() || !formName.trim() || !formBody.trim()) {
      toast.error("Vui lòng điền đầy đủ Mã Key, Tên mẫu và Nội dung");
      return;
    }

    setSaving(true);
    try {
      const freqVal = parseInt(formMaxFrequency, 10);
      const payload = {
        key: formKey.trim(),
        name: formName.trim(),
        description: formDesc.trim() || null,
        channel: formChannel,
        purpose: formPurpose,
        requires_opt_in: formRequiresOptIn,
        include_unsubscribe: formIncludeUnsubscribe,
        max_send_frequency_days: !isNaN(freqVal) && freqVal > 0 ? freqVal : null,
        subject_template: formSubject.trim() || null,
        body_template: formBody.trim(),
        sample_variables: {
          customer_name: "Chị Lan Anh",
          event_title: "Chuyển giao Phác đồ Điều trị Nám",
          event_time: "09:00 ngày 20/05/2026",
          event_location: "53 Triều Khúc, Hà Nội",
          meeting_url: "https://zoom.us/j/demo123",
          sale_name: "Hà Trần",
          company_name: "DESEMBRE Việt Nam",
          calendar_link: "https://calendar.google.com/..."
        }
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from("message_templates")
          .update(payload)
          .eq("id", editingTemplate.id);
        if (error) throw error;
        toast.success("Đã cập nhật mẫu tin nhắn thành công");
      } else {
        const { error } = await supabase
          .from("message_templates")
          .insert([payload]);
        if (error) throw error;
        toast.success("Đã tạo mới mẫu tin nhắn thành công");
      }

      setEditModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi lưu dữ liệu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Xóa Template
  const handleDeleteTemplate = async (tpl: MessageTemplate) => {
    if (tpl.key === 'calendar_invite_default') {
      toast.error("Hệ thống bảo vệ từ chối xóa mẫu mặc định gốc!");
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn mẫu "${tpl.name}"?`)) return;

    try {
      const { error } = await supabase
        .from("message_templates")
        .delete()
        .eq("id", tpl.id);
      if (error) throw error;
      toast.success("Đã xóa mẫu tin nhắn");
      loadData();
    } catch (err: any) {
      toast.error("Lỗi xóa: " + err.message);
    }
  };

  // Thực thi Gửi Lời Mời Kiểm Thử qua Edge Function
  const handleSendTestInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testTemplateId || !testAccountId || !testEmailInput.trim()) {
      toast.error("Vui lòng chọn đủ Mẫu tin nhắn, Lịch nguồn gửi và nhập Email test");
      return;
    }

    setTesting(true);
    const tid = toast.loading("Đang biên dịch mẫu và phát hành thiệp mời kiểm thử qua Google Calendar...");
    
    try {
      const payload = {
        templateId: testTemplateId,
        calendarAccountId: testAccountId,
        testEmail: testEmailInput.trim()
      };

      let successData: any = null;

      try {
        const { data, error } = await supabase.functions.invoke("send-template-test-invite", {
          body: payload
        });

        if (error) {
          let msg = error.message;
          if (error.context && typeof error.context.json === 'function') {
            try {
              const errCtx = await error.context.json();
              if (errCtx && errCtx.error) msg = errCtx.error;
            } catch (_) {}
          }
          const customErr = new Error(msg);
          (customErr as any)._isBusinessError = true;
          throw customErr;
        }

        if (data?.error) {
          const customErr = new Error(data.error);
          (customErr as any)._isBusinessError = true;
          throw customErr;
        }

        successData = data;
      } catch (sdkErr: any) {
        if (sdkErr._isBusinessError) {
          throw sdkErr;
        }

        console.warn("Lỗi định tuyến Invoke, tự động kích hoạt HTTP fetch fallback cho luồng Test:", sdkErr);
        const session = (await supabase.auth.getSession()).data?.session;
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-template-test-invite`;
        const rawRes = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const resData = await rawRes.json().catch(() => null);
        if (!rawRes.ok || resData?.error) {
          throw new Error(resData?.error || sdkErr.message || "Lỗi giao tiếp trực tiếp với máy chủ Edge Function");
        }
        successData = resData;
      }

      toast.success("Gửi thư mời kiểm thử thành công! Kiểm tra ngay hộp thư của bạn.", { id: tid });
      setTestEmailInput("");
      loadData();
    } catch (err: any) {
      toast.error(`Gửi test thất bại: ${err.message}`, { id: tid });
      loadData();
    } finally {
      setTesting(false);
    }
  };

  // Nạp chuỗi mô phỏng
  const renderSamplePreview = (tpl: MessageTemplate) => {
    const vars = tpl.sample_variables || {
      customer_name: "Chị Lan Anh",
      event_title: "Chuyển giao Công nghệ Siêu vi tảo",
      event_time: "14:00 Chiều mai",
      event_location: "Trụ sở DESEMBRE Hà Nội",
      meeting_url: "https://meet.google.com/abc-defg-hij",
      sale_name: "Hà Trần",
      company_name: "DESEMBRE Partner Hub",
      calendar_link: "https://calendar.google.com/..."
    };
    return {
      subject: renderTemplate(tpl.subject_template || "", vars),
      body: renderTemplate(tpl.body_template, vars)
    };
  };

  // Chèn nhanh từ khóa vào vùng text
  const insertVariableToBody = (varName: string) => {
    setFormBody(prev => prev + `{{${varName}}}`);
    toast.success(`Đã chèn từ khóa {{${varName}}} vào cuối nội dung`);
  };

  const activeTemplatesCount = useMemo(() => templates.filter(t => t.is_active).length, [templates]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-12 flex flex-col">
      {/* Header trang chủ chuyên dụng */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
              <Link to="/" className="hover:text-purple-600 inline-flex items-center gap-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                Trang chủ
              </Link>
              <span>/</span>
              <span className="text-slate-800">Cấu hình</span>
            </div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Megaphone className="w-6 h-6 text-purple-600" /> Quản lý Mẫu Thư Mời & Tin Nhắn
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              onClick={handleOpenCreate} 
              className="bg-purple-600 hover:bg-purple-700 shadow-sm font-bold text-white h-10 px-4 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2.5" /> Thêm mẫu mới
            </Button>
          </div>
        </div>
      </header>

      {/* Dải thông số cao cấp */}
      <section className="container mx-auto px-4 md:px-6 pt-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-24 h-24 bg-purple-50 rounded-full -z-0"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Kho mẫu khả dụng</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{templates.length}</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {activeTemplatesCount} đang kích hoạt
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-24 h-24 bg-blue-50 rounded-full -z-0"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Lịch Google Nguồn</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900">{accounts.length}</span>
              <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                Service Account
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs relative overflow-hidden">
            <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 w-24 h-24 bg-amber-50 rounded-full -z-0"></div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Cơ chế phát hành</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-black text-slate-800">Tự động & Sao chép</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">Tích hợp sẵn bộ từ khóa động CRM</p>
          </div>
        </div>
      </section>

      {/* Main Content Layout */}
      <main className="container mx-auto px-4 md:px-6 pt-6 flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Lưới Quản lý Danh sách Mẫu (2 cột lớn) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" /> Danh sách Template đã triển khai
            </h2>
            <span className="text-xs text-slate-500">Tự động ánh xạ sang màn hình Xem trước của Sale</span>
          </div>

          {loading ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs font-medium">Đang kéo dữ liệu cấu hình từ Supabase...</p>
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
              <p className="text-sm font-bold mb-1">Chưa có Mẫu tin nhắn nào</p>
              <p className="text-xs text-slate-400 mb-4">Bấm nút "Thêm mẫu mới" ở góc trên để bắt đầu khởi tạo cấu trúc.</p>
              <Button onClick={handleOpenCreate} size="sm" className="bg-purple-600 hover:bg-purple-700 text-white">
                Khởi tạo ngay
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {templates.map(tpl => {
                const isActive = tpl.is_active;
                const isDefault = tpl.key === 'calendar_invite_default';

                return (
                  <div 
                    key={tpl.id} 
                    className={`bg-white rounded-2xl border transition-all p-5 ${
                      isActive 
                        ? 'border-purple-200 shadow-xs ring-1 ring-purple-100' 
                        : 'border-slate-200 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100">
                            {tpl.channel === 'calendar_invite' ? 'Google Calendar Invite' : tpl.channel}
                          </span>
                          {isDefault && (
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              Gốc
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-black text-slate-900 mt-1">{tpl.name}</h3>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">Mã key: {tpl.key}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Switch trạng thái */}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tpl)}
                          className={`h-8 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                            isActive 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          title="Bấm để chuyển đổi trạng thái"
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                          {isActive ? 'Đang kích hoạt' : 'Đang tắt'}
                        </button>

                        {/* Nút Xem thử mô phỏng */}
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewTemplate(tpl);
                            setPreviewOpen(true);
                          }}
                          className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center transition-all"
                          title="Xem trước kết xuất mẫu"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Nút Sửa */}
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(tpl)}
                          className="w-8 h-8 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-600 flex items-center justify-center transition-all"
                          title="Chỉnh sửa nội dung"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Nút Xóa */}
                        {!isDefault && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="w-8 h-8 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all"
                            title="Xóa mẫu"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {tpl.description && (
                      <p className="text-xs text-slate-600 italic py-2 border-b border-dashed border-slate-100">
                        {tpl.description}
                      </p>
                    )}

                    <div className="pt-3 space-y-2">
                      <div className="text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Tiêu đề xuất bản:</span>
                        <p className="font-bold text-slate-800">{tpl.subject_template || "[Không có tiêu đề]"}</p>
                      </div>
                      <div className="text-xs">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Nội dung động (Body preview):</span>
                        <p className="font-mono text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-3 whitespace-pre-wrap leading-relaxed">
                          {tpl.body_template}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Phân hệ Test Gửi Thiệp Mời Thực Tế (1 cột phải) */}
        <div className="space-y-6">
          
          {/* Bảng điều khiển Gửi Test */}
          <div className="bg-white rounded-2xl border border-purple-200 p-5 shadow-sm relative">
            <div className="absolute top-0 right-0 translate-x-2 -translate-y-2">
              <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-sm uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Test Engine
              </span>
            </div>

            <h2 className="text-base font-black text-slate-900 mb-1 flex items-center gap-1.5">
              🚀 Phát hành Lời mời Kiểm thử
            </h2>
            <p className="text-xs text-slate-500 mb-4">
              Gọi trực tiếp Edge Function để tạo một sự kiện GCal test trên Lịch công ty thực tế.
            </p>

            <form onSubmit={handleSendTestInvite} className="space-y-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">1. Chọn Mẫu kết xuất</Label>
                <select
                  value={testTemplateId}
                  onChange={e => setTestTemplateId(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 mt-1 font-medium focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.is_active ? 'Bật' : 'Tắt'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">2. Lịch Google nguồn gửi</Label>
                <select
                  value={testAccountId}
                  onChange={e => setTestAccountId(e.target.value)}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 mt-1 font-medium focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.calendar_id === 'primary' ? 'Gốc' : 'Khác'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">3. Email người nhận Test</Label>
                <Input
                  placeholder="admin-test@gmail.com"
                  value={testEmailInput}
                  onChange={e => setTestEmailInput(e.target.value)}
                  className="h-10 text-xs rounded-xl border-slate-200 mt-1"
                />
                <p className="text-[10px] text-slate-400 mt-1">Hệ thống sẽ đặt lịch hẹn test sau 1 ngày từ mốc hiện tại.</p>
              </div>

              <Button
                type="submit"
                disabled={testing || !testTemplateId || !testAccountId || !testEmailInput.trim()}
                className="w-full h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs mt-2 shadow-2xs"
              >
                {testing ? "Đang phát hành thiệp mời..." : "🚀 Bấm Gửi Thiệp Mời Test"}
              </Button>
            </form>
          </div>

          {/* Nhật ký bắn thử gần đây */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-400" /> Nhật ký Test gần đây
            </h3>

            {testLogs.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-6 italic">Chưa có lịch sử bắn test nào được ghi lại.</p>
            ) : (
              <div className="space-y-2.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
                {testLogs.map(log => {
                  const isSuccess = log.status === 'sent';
                  return (
                    <div key={log.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 truncate max-w-[150px]">{log.test_email}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                          isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isSuccess ? '✓ Thành công' : '✕ Thất bại'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate max-w-[120px]">Mẫu: {log.template_name || 'N/A'}</span>
                        <span>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {!isSuccess && log.error_message && (
                        <p className="text-[10px] text-rose-600 font-mono bg-rose-50 p-1 rounded mt-1 line-clamp-2">
                          Lý do: {log.error_message}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Khối tài liệu hướng dẫn nhanh */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-sm space-y-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Từ khóa hỗ trợ</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Các từ khóa dưới đây sẽ tự động lấp đầy dữ liệu thực tế khi gửi lời mời cho Khách hàng:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {SUPPORTED_TEMPLATE_VARIABLES.map(v => (
                <span key={v} className="text-[10px] font-mono bg-white/10 text-purple-200 px-2 py-0.5 rounded border border-white/5">
                  {"{{"}{v}{"}}"}
                </span>
              ))}
            </div>
          </div>

        </div>

      </main>

      {/* Modal Form Tạo/Sửa Template */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[640px] p-6 rounded-2xl border-none shadow-2xl bg-white">
          <form onSubmit={handleSaveTemplate}>
            <DialogHeader className="space-y-1 pb-3 border-b border-slate-100">
              <DialogTitle className="text-lg font-black text-slate-900">
                {editingTemplate ? "Chỉnh sửa Mẫu Tin Nhắn" : "Tạo Mẫu Tin Nhắn Mới"}
              </DialogTitle>
              <p className="text-xs text-slate-500">
                Định nghĩa khuôn mẫu truyền thông đồng nhất trên toàn hệ thống DESEMBRE.
              </p>
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Mã định danh (Key) *</Label>
                  <Input
                    value={formKey}
                    onChange={e => setFormKey(e.target.value)}
                    disabled={editingTemplate?.key === 'calendar_invite_default'}
                    placeholder="vd: calendar_invite_workshop"
                    className="h-10 text-xs rounded-xl mt-1 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Phải viết liền không dấu.</span>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Kênh hỗ trợ</Label>
                  <select
                    value={formChannel}
                    onChange={e => setFormChannel(e.target.value)}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 bg-slate-50 mt-1 font-medium focus:outline-none"
                  >
                    <option value="calendar_invite">Google Calendar Invite</option>
                    <option value="zalo_sms">Tin nhắn Zalo/SMS</option>
                    <option value="email_campaign">Email Sự Kiện</option>
                    <option value="marketing_email">Email Tiếp Thị</option>
                  </select>
                </div>
              </div>

              {/* Khối cấu hình Mục đích & Chống Spam Marketing */}
              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-100 space-y-3 mt-1">
                <span className="text-[10px] font-black text-purple-950 uppercase tracking-wider block">
                  ⚙️ Phân loại Tiếp thị & Chống Spam
                </span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-slate-700">Mục đích (Purpose)</Label>
                    <select
                      value={formPurpose}
                      onChange={e => setFormPurpose(e.target.value)}
                      className="w-full h-9 px-2 text-xs rounded-lg border border-purple-200 bg-white mt-1 font-medium focus:outline-none"
                    >
                      <option value="transactional">Giao dịch (Transactional)</option>
                      <option value="reminder">Nhắc nhở (Reminder)</option>
                      <option value="event_invite">Mời sự kiện (Event Invite)</option>
                      <option value="event_follow_up">Sau sự kiện (Event Follow-up)</option>
                      <option value="marketing_campaign">Chiến dịch Marketing</option>
                      <option value="product_launch">Ra mắt sản phẩm</option>
                      <option value="quote_follow_up">Theo dõi Báo giá</option>
                      <option value="reorder_reminder">Nhắc mua lại</option>
                      <option value="post_purchase_checkin">Hỏi thăm sau mua</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-700">Tần suất tối đa (Ngày/Lần)</Label>
                    <Input
                      type="number"
                      placeholder="vd: 30"
                      value={formMaxFrequency}
                      onChange={e => setFormMaxFrequency(e.target.value)}
                      className="h-9 text-xs rounded-lg bg-white mt-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequiresOptIn}
                      onChange={e => setFormRequiresOptIn(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 border-purple-300 focus:ring-purple-500"
                    />
                    Bắt buộc Opt-in
                  </label>

                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIncludeUnsubscribe}
                      onChange={e => setFormIncludeUnsubscribe(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 border-purple-300 focus:ring-purple-500"
                    />
                    Kèm link Hủy đăng ký
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Tên hiển thị nội bộ *</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="vd: Thư mời chuẩn sự kiện Chuyển giao Nám"
                  className="h-10 text-xs rounded-xl mt-1"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Mô tả công năng (Tùy chọn)</Label>
                <Input
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="Ghi chú nội bộ dành cho bộ phận Quản lý..."
                  className="h-9 text-xs rounded-xl mt-1 text-slate-600"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Tiêu đề Gửi đi (Subject Template)</Label>
                <Input
                  value={formSubject}
                  onChange={e => setFormSubject(e.target.value)}
                  placeholder="vd: [DESEMBRE] Thư mời tham dự: {{event_title}}"
                  className="h-10 text-xs rounded-xl mt-1 font-bold text-purple-950 bg-purple-50/50 border-purple-100"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">Nội dung thư chính (Body Template) *</Label>
                  <span className="text-[10px] text-slate-400">Hỗ trợ ngắt dòng tự động</span>
                </div>

                {/* Thanh tiện ích chèn biến */}
                <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 px-1">Chèn nhanh:</span>
                  {SUPPORTED_TEMPLATE_VARIABLES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => insertVariableToBody(v)}
                      className="text-[10px] font-mono bg-white hover:bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-slate-200 transition-all"
                    >
                      +{v}
                    </button>
                  ))}
                </div>

                <Textarea
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  placeholder="Kính gửi {{customer_name}},..."
                  className="min-h-[180px] text-xs font-mono rounded-xl p-3 leading-relaxed mt-1"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditModalOpen(false)}
                className="h-9 px-4 rounded-xl text-xs font-bold"
              >
                Hủy bỏ
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-9 px-6 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-2xs"
              >
                {saving ? "Đang lưu..." : "✓ Xác nhận lưu mẫu"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Xem Trực Quan Mô Phỏng Nhanh */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl border-none shadow-2xl bg-white">
          <DialogHeader className="space-y-1 pb-3 border-b border-slate-100">
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-600" /> Mô phỏng Đầu ra Mẫu tin nhắn
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Kết xuất giả định dựa trên bộ dữ liệu Khách hàng mẫu.
            </p>
          </DialogHeader>

          {previewTemplate && (() => {
            const res = renderSamplePreview(previewTemplate);
            return (
              <div className="space-y-3 py-2 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Tiêu đề (Subject):</span>
                  <p className="font-bold text-slate-900">{res.subject || "[Trống]"}</p>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-2xs font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-slate-800 max-h-[320px] overflow-y-auto custom-scrollbar">
                  {res.body}
                </div>
              </div>
            );
          })()}

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
            <Button
              onClick={() => setPreviewOpen(false)}
              className="h-9 px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl"
            >
              Đóng giao diện
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
