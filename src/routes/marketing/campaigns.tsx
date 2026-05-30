// @ts-nocheck
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Rocket,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Search,
  Filter,
  Layers,
  FileText,
  Users,
  Send,
  Loader2,
  Calendar
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { canSendMarketingMessage, ComplianceCustomer, ComplianceTemplate } from "@/lib/messagingRules";
import { resolveSenderForMessage } from "@/lib/senderResolver";

export const Route = createFileRoute("/marketing/campaigns")({
  component: MarketingCampaignsPage,
});

interface Campaign {
  id: string;
  name: string;
  template_id?: string;
  zns_template_id?: string;
  sender_account_id?: string;
  segment_id?: string;
  status: 'draft' | 'pending_review' | 'approved' | 'queued' | 'sending' | 'paused' | 'completed' | 'partially_failed' | 'cancelled' | 'failed';
  target_criteria?: any;
  override_variables?: any;
  scheduled_at?: string | null;
  metrics?: {
    total_targets: number;
    sent: number;
    failed: number;
    capped?: number;
  };
  created_at: string;
  message_templates?: { name: string; channel: string; purpose: string };
  zns_templates?: { template_name: string; category: string; purpose: string };
  sender_accounts?: { id: string; name: string; sender_email: string; health_status?: string; daily_limit?: number; daily_usage?: number };
  customer_segments?: { name: string; total_count?: number };
  approved_by?: string;
  approved_at?: string;
  started_at?: string;
  completed_at?: string;
  paused_at?: string;
  cancelled_at?: string;
  failure_reason?: string;
  estimated_recipients?: number;
  processed_recipients?: number;
  successful_recipients?: number;
  failed_recipients?: number;
  created_by?: string;
}

interface MessageTemplateRef {
  id: string;
  name: string;
  channel: string;
  purpose: string;
  subject_template?: string;
  body_template: string;
  banner_image_url?: string;
  cta_label?: string;
  cta_url?: string;
  footer_template?: string;
  requires_opt_in?: boolean;
  include_unsubscribe?: boolean;
  max_send_frequency_days?: number;
}

interface SenderAccountRef {
  id: string;
  name: string;
  sender_email: string;
  channel: string;
  is_active?: boolean;
  health_status?: string;
  daily_usage?: number;
  daily_limit?: number;
}

interface SegmentRef {
  id: string;
  name: string;
  description?: string;
  segment_type: string;
}

function MarketingCampaignsPage() {
  const { user, isAdmin, isSubAdmin, isAdminOrSubAdmin, isSale } = useAuth();
  const canManageCampaign = (camp: Campaign | null) => camp ? (isAdminOrSubAdmin || (isSale && camp.created_by === user?.id)) : false;
  // Đọc template_id từ URL params (khi click "Tạo Campaign" từ Template Library)
  const searchParams = useSearch({ strict: false }) as any;
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplateRef[]>([]);
  const [znsTemplates, setZnsTemplates] = useState<any[]>([]);
  const [senders, setSenders] = useState<SenderAccountRef[]>([]);
  const [segments, setSegments] = useState<SegmentRef[]>([]);
  const [customers, setCustomers] = useState<ComplianceCustomer[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // State Trình tạo chiến dịch Wizard Modal
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Payload Form
  const [campaignType, setCampaignType] = useState<"zns" | "general">("zns");
  const [formName, setFormName] = useState("");
  const [formTemplateId, setFormTemplateId] = useState("");
  const [formZnsTemplateId, setFormZnsTemplateId] = useState("");
  const [formSenderId, setFormSenderId] = useState("");
  const [formSegmentId, setFormSegmentId] = useState("");
  const [formScheduleType, setFormScheduleType] = useState<"now" | "later">("now");
  const [formScheduleTime, setFormScheduleTime] = useState("");

  // Bổ sung State Kiểm soát gửi & Chi tiết chiến dịch
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [isSendingLoopActive, setIsSendingLoopActive] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Dữ liệu giả lập cao cấp khi chưa chạy DB Cloud
  const isMock = !!localStorage.getItem("mock_marketing_session");
  const [useLocalFallback, setUseLocalFallback] = useState(isMock);

  const baselineCampaigns: Campaign[] = [
    {
      id: "camp-1",
      name: "🔥 Chuyển giao Phác đồ Điều trị Nám Siêu Vi Tảo T5/2026",
      status: "completed",
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      metrics: { total_targets: 150, sent: 142, failed: 2, capped: 6 },
      message_templates: { name: "Mẫu thư mời chuẩn Hội thảo Nám", channel: "email_campaign", purpose: "marketing_campaign" },
      sender_accounts: { id: "snd-1", name: "Email Marketing Tổng", sender_email: "marketing@desembrevn.com" },
      customer_segments: { name: "Khách VIP Hà Nội & Tỉnh phía Bắc" }
    },
    {
      id: "camp-2",
      name: "💎 Công bố Chính sách Chiết khấu Đại lý Quý 3/2026",
      status: "sending",
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      metrics: { total_targets: 320, sent: 185, failed: 0, capped: 12 },
      message_templates: { name: "Mẫu thông báo Chính sách Đại lý", channel: "email_campaign", purpose: "monthly_campaign" },
      sender_accounts: { id: "snd-2", name: "Email Chăm sóc Đại lý", sender_email: "partners@desembrevn.com" },
      customer_segments: { name: "Toàn bộ Đại lý chính thức" }
    },
    {
      id: "camp-3",
      name: "🎁 Chuỗi Nuôi dưỡng Leads Khách Hàng Tiềm Năng",
      status: "queued",
      scheduled_at: new Date(Date.now() + 18 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      metrics: { total_targets: 85, sent: 0, failed: 0 },
      message_templates: { name: "Chuỗi bài học Vận hành Spa Bài 1", channel: "email_campaign", purpose: "lead_nurturing" },
      sender_accounts: { id: "snd-1", name: "Email Marketing Tổng", sender_email: "marketing@desembrevn.com" },
      customer_segments: { name: "Leads từ Quảng cáo Facebook" }
    }
  ];

  const loadAllData = async () => {
    setLoading(true);

    if (useLocalFallback) {
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      if (localCamps.length === 0) {
        localCamps = [...baselineCampaigns];
        try { localStorage.setItem("mock_campaigns", JSON.stringify(localCamps)); } catch {}
      }
      setCampaigns(localCamps);

      // Cấp dữ liệu giả lập cho Senders, Templates
      setTemplates([
        { id: "tpl-1", name: "Mẫu thư mời chuẩn Hội thảo Nám", channel: "email_campaign", purpose: "marketing_campaign", body_template: "Kính gửi quý Đối tác,...", requires_opt_in: true, include_unsubscribe: true, max_send_frequency_days: 30, banner_image_url: "https://picsum.photos/600/200", cta_label: "Đăng ký Slot", cta_url: "https://desembrevn.com/register" },
        { id: "tpl-2", name: "Mẫu thông báo Chính sách Đại lý", channel: "email_campaign", purpose: "monthly_campaign", body_template: "Thông tin chiết khấu...", requires_opt_in: false }
      ]);
      setZnsTemplates([
        { id: "zns-tpl-1", zalo_template_id: "123456", template_name: "🔔 Xác nhận Đơn hàng Mỹ phẩm", category: "transactional", purpose: "order_status", required_params: ["customer_name", "order_id"], sample_payload: { customer_name: "Spa Lan Vy", order_id: "DH-1002" }, is_active: true, sender_account_id: "snd-zalo" },
        { id: "zns-tpl-2", zalo_template_id: "789012", template_name: "💎 Thư mời Hội thảo Chuyển giao Phác đồ", category: "transactional", purpose: "event_invitation", required_params: ["customer_name", "event_name", "event_time"], sample_payload: { customer_name: "Spa Lan Vy", event_name: "Chuyển Giao Vy Tảo C", event_time: "09:00 - 30/05" }, is_active: true, sender_account_id: "snd-zalo" }
      ]);
      setSenders([
        { id: "snd-1", name: "Email Marketing Tổng", sender_email: "marketing@desembrevn.com", channel: "email", is_active: true, health_status: "healthy", daily_usage: 120, daily_limit: 5000 },
        { id: "snd-2", name: "Email Chăm sóc Đại lý", sender_email: "partners@desembrevn.com", channel: "email", is_active: true, health_status: "healthy", daily_usage: 45, daily_limit: 1000 },
        { id: "snd-zalo", name: "Zalo OA DESEMBRE Official", sender_email: "oa@desembrevn.com", channel: "zalo_oa", is_active: true, health_status: "healthy", daily_usage: 150, daily_limit: 1000 }
      ]);
      setSegments([
        { id: "seg-1", name: "Khách VIP Hà Nội & Tỉnh phía Bắc", segment_type: "static" },
        { id: "seg-2", name: "Toàn bộ Đại lý chính thức", segment_type: "dynamic" },
        { id: "seg-3", name: "Leads từ Quảng cáo Facebook", segment_type: "dynamic" }
      ]);
      setCustomers([
        { id: "cust-1", email: "spa1@gmail.com", phone: "0912345678", marketing_opt_in: true },
        { id: "cust-2", email: "spa2@gmail.com", phone: "0987654321", marketing_opt_in: true },
        { id: "cust-3", email: "spa3_optout@gmail.com", phone: "0900000000", marketing_opt_in: false, marketing_opt_out_at: new Date().toISOString() }
      ]);
      setLoading(false);
      return;
    }

    try {
      // 1. Tải chiến dịch
      let queryCamps = supabase
        .from("marketing_campaigns")
        .select(`
          *,
          message_templates ( name, channel, purpose ),
          zns_templates ( template_name, category, purpose ),
          sender_accounts ( name, sender_email, health_status, daily_limit, daily_usage ),
          customer_segments ( name )
        `);

      if (isSale && !isAdmin && !isSubAdmin) {
        queryCamps = queryCamps.eq("created_by", user?.id);
      }

      const { data: cData, error: cErr } = await queryCamps.order("created_at", { ascending: false });

      if (cErr) throw cErr;
      setCampaigns(cData || []);

      // 2. Tải danh sách mẫu Email/SMS
      const { data: tData } = await supabase.from("message_templates").select("*").eq("is_active", true);
      if (tData) setTemplates(tData);

      // 2.5 Tải danh sách ZNS Templates
      const { data: znsData } = await supabase.from("zns_templates").select("*").eq("is_active", true).eq("status", "approved");
      if (znsData) setZnsTemplates(znsData);

      // 3. Tải senders
      let availableSenders: any[] = [];
      if (isSale && !isAdmin && !isSubAdmin) {
        // Sale chỉ tải email cá nhân
        const { data: personalAccs } = await supabase
          .from("user_communication_accounts")
          .select("id, account_name, account_identifier, platform, provider_secret, is_active")
          .eq("user_id", user?.id)
          .eq("platform", "email")
          .eq("is_active", true);
        if (personalAccs) {
          availableSenders = personalAccs.filter((a: any) => !!a.provider_secret).map((a: any) => ({
            id: a.id,
            name: a.account_name,
            sender_email: a.account_identifier,
            channel: 'email',
            is_active: true,
            health_status: 'healthy'
          }));
        }
      } else {
        // Admin tải email tổng
        const { data: sData } = await supabase.from("sender_accounts").select("*").eq("is_active", true);
        if (sData) availableSenders = sData;
      }
      setSenders(availableSenders as any[]);

      // 4. Tải segments
      const { data: segData } = await supabase.from("customer_segments").select("*");
      if (segData) setSegments(segData);

      // 5. Tải dải khách hàng tuân thủ
      const { data: custData } = await supabase.from("customers").select("id, email, phone, marketing_opt_in, marketing_opt_out_at, last_marketing_sent_at");
      if (custData) setCustomers(custData);

    } catch (err: any) {
      console.warn("Chưa đồng bộ DB Cloud, kích hoạt giao diện mô phỏng Dispatcher:", err.message);
      setUseLocalFallback(true);
      setCampaigns([...baselineCampaigns]);
      setTemplates([
        { id: "tpl-1", name: "Mẫu thư mời chuẩn Hội thảo Nám", channel: "email_campaign", purpose: "marketing_campaign", body_template: "Kính gửi quý Đối tác,...", requires_opt_in: true, include_unsubscribe: true, max_send_frequency_days: 30, banner_image_url: "https://picsum.photos/600/200", cta_label: "Đăng ký Slot", cta_url: "https://desembrevn.com/register" }
      ]);
      setSenders([{ id: "snd-1", name: "Email Marketing Tổng", sender_email: "marketing@desembrevn.com", channel: "email" }]);
      setSegments([{ id: "seg-1", name: "Khách VIP Hà Nội & Tỉnh phía Bắc", segment_type: "static" }]);
      setCustomers([{ id: "cust-1", email: "spa1@gmail.com", marketing_opt_in: true }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [useLocalFallback]);

  // Auto-open wizard nếu URL có template_id (từ Template Library)
  useEffect(() => {
    if (!searchParams?.template_id || loading || templates.length === 0) return;
    const tpl = templates.find(t => t.id === searchParams.template_id);
    if (!tpl) return;
    // Pre-select template và mở wizard
    setWizardStep(1);
    setCampaignType("general");
    setFormName(`Chiến dịch từ "${tpl.name}"`);
    setFormTemplateId(tpl.id);
    const firstEmailSender = senders.find(s => s.channel?.toLowerCase().includes('email'))?.id || senders[0]?.id || "";
    setFormSenderId(firstEmailSender);
    setFormSegmentId(segments[0]?.id || "");
    setFormScheduleType("now");
    setFormScheduleTime("");
    setWizardOpen(true);
  }, [searchParams?.template_id, loading, templates]);

  // Bộ lọc
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c: Campaign) => {
      const matchQuery = c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (c.message_templates?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (c.zns_templates?.template_name || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchStatus = statusFilter === "all" || c.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [campaigns, searchQuery, statusFilter]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = campaigns.length;
    const completed = campaigns.filter(c => c.status === 'completed').length;
    const sending = campaigns.filter(c => c.status === 'sending').length;
    const paused = campaigns.filter(c => c.status === 'paused').length;
    const draft = campaigns.filter(c => c.status === 'draft').length;
    const pendingReview = campaigns.filter(c => c.status === 'pending_review').length;
    const approved = campaigns.filter(c => c.status === 'approved').length;

    let totalSentTargets = 0;
    let totalCappedTargets = 0;
    campaigns.forEach(c => {
      if (c.metrics) {
        totalSentTargets += (c.metrics.sent || 0);
        totalCappedTargets += (c.metrics.capped || 0);
      }
    });

    return { total, completed, sending, paused, draft, pendingReview, approved, totalSentTargets, totalCappedTargets };
  }, [campaigns]);

  // Mở trình khởi tạo
  const handleOpenWizard = () => {
    setWizardStep(1);
    setCampaignType("zns");
    setFormName("");
    setFormTemplateId(templates[0]?.id || "");
    setFormZnsTemplateId(znsTemplates[0]?.id || "");
    
    // Default to ZNS sender if channel is zns
    const firstZnsSender = senders.find(s => s.channel === "zalo_oa" || s.channel === "zalo")?.id || senders[0]?.id || "";
    setFormSenderId(firstZnsSender);
    setFormSegmentId(segments[0]?.id || "");
    setFormScheduleType("now");
    setFormScheduleTime("");
    setWizardOpen(true);
  };

  // Auto-open wizard nếu URL có new=true (từ nút Tạo chiến dịch ở Dashboard)
  useEffect(() => {
    if (searchParams?.new === "true" && !loading && !wizardOpen) {
      handleOpenWizard();
    }
  }, [searchParams?.new, loading]);

  // Tìm mẫu đang chọn để render Preview
  const selectedTemplate = useMemo(() => {
    if (campaignType === "zns") {
      const ztpl = znsTemplates.find(t => t.id === formZnsTemplateId);
      if (!ztpl) return null;
      return {
        id: ztpl.id,
        name: ztpl.template_name,
        channel: "zns",
        purpose: ztpl.purpose || "transactional",
        body_template: `[XEM TRƯỚC TIN ZNS]\nMẫu: ${ztpl.template_name}\nZalo Template ID: ${ztpl.zalo_template_id}\n\nTham số yêu cầu: ${ztpl.required_params?.join(", ") || "Không có"}\n\nDữ liệu mẫu thử:\n${JSON.stringify(ztpl.sample_payload, null, 2)}`,
        requires_opt_in: false,
        max_send_frequency_days: 0
      } as any;
    }
    return templates.find(t => t.id === formTemplateId);
  }, [campaignType, templates, znsTemplates, formTemplateId, formZnsTemplateId]);

  // Check if chosen sender is valid and healthy
  const isSelectedSenderAllowed = useMemo(() => {
    if (!formSenderId) return false;
    const sender = senders.find(s => s.id === formSenderId);
    if (!sender) return false;
    
    const resolution = resolveSenderForMessage({
      channel: campaignType === "zns" ? "zalo_oa" : (selectedTemplate?.channel || 'email').toLowerCase().includes('email') ? 'email' : 'zalo_oa',
      mode: 'campaign',
      customer: { id: 'temp-check' },
      businessSenders: [
        {
          id: sender.id,
          name: sender.name,
          channel: sender.channel,
          is_active: sender.is_active ?? true,
          health_status: sender.health_status ?? 'healthy',
          daily_usage: sender.daily_usage ?? 0,
          daily_limit: sender.daily_limit ?? 1000,
        }
      ]
    });
    return resolution.allowed;
  }, [formSenderId, senders, selectedTemplate, campaignType]);

  // Ước tính tuân thủ cho tập đích
  const complianceEstimate = useMemo(() => {
    if (!selectedTemplate) return { total: 0, valid: 0, capped: 0, optOut: 0, missingPhone: 0 };
    
    let validCount = 0;
    let cappedCount = 0;
    let optOutCount = 0;
    let missingPhoneCount = 0;

    const tplObj: ComplianceTemplate = {
      channel: selectedTemplate.channel,
      purpose: selectedTemplate.purpose,
      requires_opt_in: selectedTemplate.requires_opt_in,
      include_unsubscribe: selectedTemplate.include_unsubscribe,
      max_send_frequency_days: selectedTemplate.max_send_frequency_days
    };

    customers.forEach(c => {
      if (campaignType === "zns") {
        if (!c.phone) {
          missingPhoneCount++;
        } else if (c.marketing_opt_out_at) {
          optOutCount++;
        } else {
          validCount++;
        }
      } else {
        const mockRecentLogs = [
          { channel: 'email_campaign', purpose: 'marketing_campaign', status: 'delivered', created_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString() }
        ];
        const res = canSendMarketingMessage(c, tplObj, mockRecentLogs);
        if (res.allowed) {
          validCount++;
        } else {
          if (res.reason === 'frequency_capped') cappedCount++;
          else optOutCount++;
        }
      }
    });

    const effTotal = customers.length > 0 ? customers.length : 120;
    const effValid = customers.length > 0 ? validCount : 105;
    const effCapped = customers.length > 0 ? cappedCount : 12;
    const effOptOut = customers.length > 0 ? optOutCount : 3;
    const effMissingPhone = customers.length > 0 ? missingPhoneCount : 0;

    return { total: effTotal, valid: effValid, capped: effCapped, optOut: effOptOut, missingPhone: effMissingPhone };
  }, [selectedTemplate, customers, campaignType]);

  // Lưu và Phát hành dưới dạng Draft
  const handleDispatchCampaign = async () => {
    if (!formName.trim()) {
      toast.error("Vui lòng đặt tên cho Chiến dịch");
      return;
    }

    setSaving(true);
    const isScheduled = formScheduleType === "later" && formScheduleTime.trim();

    const newCampPayload: any = {
      name: formName.trim(),
      template_id: campaignType === "general" ? (formTemplateId || null) : null,
      zns_template_id: campaignType === "zns" ? (formZnsTemplateId || null) : null,
      sender_account_id: formSenderId || null,
      segment_id: formSegmentId || null,
      status: "draft",
      created_by: user?.id,
      scheduled_at: isScheduled ? new Date(formScheduleTime).toISOString() : null,
      estimated_recipients: complianceEstimate.total,
      metrics: {
        total_targets: complianceEstimate.total,
        sent: 0,
        failed: 0,
        capped: complianceEstimate.capped
      }
    };

    if (useLocalFallback) {
      setTimeout(() => {
        let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
        const createdObj: Campaign = {
          id: `camp-${Date.now()}`,
          created_by: user?.id || "admin",
          created_at: new Date().toISOString(),
          ...newCampPayload,
          message_templates: campaignType === "general" ? { name: selectedTemplate?.name || "Mẫu tùy chỉnh", channel: selectedTemplate?.channel || "email", purpose: selectedTemplate?.purpose || "marketing" } : undefined,
          zns_templates: campaignType === "zns" ? { template_name: selectedTemplate?.name || "Mẫu ZNS", category: "transactional", purpose: "order_confirmation" } : undefined,
          sender_accounts: { id: formSenderId, name: senders.find((s: any) => s.id === formSenderId)?.name || "OA Hệ thống", sender_email: "oa@desembrevn.com" },
          customer_segments: { name: segments.find((s: any) => s.id === formSegmentId)?.name || "Tập khách hàng tùy chọn" }
        };

        localCamps.unshift(createdObj);
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSaving(false);
        setWizardOpen(false);
        toast.success("Đã tạo chiến dịch nháp thành công! Hãy gửi yêu cầu duyệt chiến dịch.");
      }, 1000);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("marketing_campaigns")
        .insert([newCampPayload])
        .select()
        .single();

      if (error) throw error;

      toast.success("Đã tạo chiến dịch nháp thành công! Vui lòng gửi yêu cầu duyệt chiến dịch.");
      setWizardOpen(false);
      loadAllData();
    } catch (err: any) {
      toast.error("Lỗi khởi tạo: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSnapshots = async (campaignId: string) => {
    if (useLocalFallback) {
      const mockSnaps = customers.map((c, index) => ({
        id: `snap-${index}`,
        campaign_id: campaignId,
        customers: { name: `Đối tác Spa ${index + 1}`, phone: c.phone || "0912345678" },
        customer_id: c.id,
        status: index % 7 === 0 ? "blocked" : index % 13 === 0 ? "failed" : "queued",
        failure_reason: index % 7 === 0 ? "Opt-out" : index % 13 === 0 ? "Chặn tần suất gửi" : null,
        processed_at: null
      }));
      setSnapshots(mockSnaps);
      return;
    }

    setSnapshotLoading(true);
    try {
      const { data, error } = await supabase
        .from("campaign_recipient_snapshots")
        .select(`
          id, campaign_id, customer_id, status, failure_reason, processed_at,
          customers:customer_id ( name, phone )
        `)
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (err: any) {
      toast.error("Lỗi tải snapshot: " + err.message);
    } finally {
      setSnapshotLoading(false);
    }
  };

  const handleApproveCampaign = async (campaign: Campaign) => {
    if (useLocalFallback) {
      toast.success("Phê duyệt và đóng băng danh sách người nhận thành công (Sandbox)");
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      const idx = localCamps.findIndex((c: any) => c.id === campaign.id);
      if (idx !== -1) {
        localCamps[idx].status = "approved";
        localCamps[idx].approved_by = user?.email || "admin@desembrevn.com";
        localCamps[idx].approved_at = new Date().toISOString();
        localCamps[idx].estimated_recipients = 100; // Mock total targets
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSelectedCampaign(localCamps[idx]);
      }
      setApprovalDialogOpen(false);
      return;
    }

    try {
      let recipientIds: string[] = [];
      if (campaign.segment_id) {
        const { data: mapData } = await supabase
          .from("customer_segments_map")
          .select("customer_id")
          .eq("segment_id", campaign.segment_id);
        if (mapData) recipientIds = mapData.map(m => m.customer_id);
      }
      
      if (recipientIds.length === 0) {
        const queryFallback = supabase.from("customers").select("id").limit(100);
        if (isSale && !isAdmin && !isSubAdmin) {
          queryFallback.eq("owner_sale_id", user?.id);
        }
        const { data: fallbackCusts } = await queryFallback;
        if (fallbackCusts) recipientIds = fallbackCusts.map(c => c.id);
      }

      if (recipientIds.length === 0) {
        toast.error("Không tìm thấy khách hàng nào thuộc Phân khúc đã chọn.");
        return;
      }

      const query = supabase
        .from("customers")
        .select("id, phone, marketing_opt_in, marketing_opt_out_at");

      if (isSale && !isAdmin && !isSubAdmin) {
        query.eq("owner_sale_id", user?.id);
      }

      const { data: fullCusts, error: custErr } = await query.in("id", recipientIds);

      if (custErr || !fullCusts || fullCusts.length === 0) {
        toast.error("Lỗi lấy thông tin chi tiết người nhận");
        return;
      }

      const znsTplId = campaign.zns_template_id || "";
      const senderId = campaign.sender_account_id || "";
      
      const snapshotInserts = fullCusts.map(c => {
        const isBlocked = !c.phone || c.marketing_opt_out_at || (campaign.zns_template_id && c.marketing_opt_in === false);
        let failureReason = null;
        if (!c.phone) failureReason = "Thiếu số điện thoại";
        else if (c.marketing_opt_out_at) failureReason = "Khách hàng đã Opt-out";

        return {
          campaign_id: campaign.id,
          customer_id: c.id,
          sender_account_id: senderId,
          zns_template_id: znsTplId,
          status: isBlocked ? "blocked" : "queued",
          failure_reason: failureReason,
          payload_preview: campaign.override_variables || {}
        };
      });

      for (let i = 0; i < snapshotInserts.length; i += 100) {
        const chunk = snapshotInserts.slice(i, i + 100);
        const { error: insErr } = await supabase.from("campaign_recipient_snapshots").insert(chunk);
        if (insErr) throw insErr;
      }

      const { error: updErr } = await supabase
        .from("marketing_campaigns")
        .update({
          status: "approved",
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          estimated_recipients: snapshotInserts.filter(s => s.status === "queued").length
        })
        .eq("id", campaign.id);

      if (updErr) throw updErr;

      toast.success("Phê duyệt và đóng băng danh sách người nhận thành công!");
      setApprovalDialogOpen(false);
      loadAllData();
      
      const { data: updatedCamp } = await supabase
        .from("marketing_campaigns")
        .select(`
          *,
          message_templates ( name, channel, purpose ),
          zns_templates ( template_name, category, purpose ),
          sender_accounts ( name, sender_email, health_status, daily_limit, daily_usage ),
          customer_segments ( name )
        `)
        .eq("id", campaign.id)
        .single();
      if (updatedCamp) setSelectedCampaign(updatedCamp);
    } catch (err: any) {
      toast.error("Lỗi duyệt chiến dịch: " + err.message);
    }
  };

  const startSendingCampaign = async (campaignId: string) => {
    if (isSendingLoopActive) return;
    
    // Check snapshot check (mandatory snapshot check)
    const total = selectedCampaign?.metrics?.total_targets || selectedCampaign?.estimated_recipients || 0;
    if (total === 0) {
      toast.error("Chiến dịch bắt buộc phải có danh sách người nhận (snapshot) đã đóng băng. Vui lòng duyệt chiến dịch trước khi gửi.");
      return;
    }
    
    (window as any).stopZnsCampaignSend = false;
    setIsSendingLoopActive(true);
    setConsoleLogs([`[${new Date().toLocaleTimeString()}] Bắt đầu gửi chiến dịch...`]);

    if (useLocalFallback) {
      let currentProcessed = 0;
      const mockLoop = setInterval(() => {
        if ((window as any).stopZnsCampaignSend) {
          clearInterval(mockLoop);
          setIsSendingLoopActive(false);
          setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đã tạm dừng gửi.`]);
          return;
        }

        currentProcessed += 10;
        setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Gửi thành công lô mock (10/10) - Tiến trình: ${currentProcessed}%`]);
        
        let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
        const idx = localCamps.findIndex((c: any) => c.id === campaignId);
        if (idx !== -1) {
          const camp = localCamps[idx];
          camp.status = currentProcessed >= 100 ? "completed" : "sending";
          camp.processed_recipients = currentProcessed;
          camp.successful_recipients = currentProcessed;
          camp.metrics = {
            total_targets: 100,
            sent: currentProcessed,
            failed: 0,
            capped: 0
          };
          localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
          setCampaigns(localCamps);
          setSelectedCampaign(camp);
        }

        if (currentProcessed >= 100) {
          clearInterval(mockLoop);
          setIsSendingLoopActive(false);
          setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Chiến dịch hoàn thành! 🎉`]);
          toast.success("Chiến dịch hoàn thành gửi (Sandbox)");
        }
      }, 1500);
      return;
    }

    try {
      let finished = false;
      let lastStatus = "sending";
      
      while (!finished && lastStatus === "sending") {
        if ((window as any).stopZnsCampaignSend) {
          setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Phát hiện yêu cầu tạm dừng từ Admin.`]);
          break;
        }

        setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Đang gọi process-zns-campaign gửi lô 30 tin tiếp theo...`]);

        const { data, error } = await supabase.functions.invoke("process-zns-campaign", {
          body: { campaign_id: campaignId, batch_size: 30 }
        });

        if (error) {
          setConsoleLogs(prev => [...prev, `[LỖI] Edge function error: ${error.message}`]);
          toast.error("Lỗi gửi chiến dịch: " + error.message);
          break;
        }

        if (data.success) {
          setConsoleLogs(prev => [
            ...prev, 
            `[KẾT QUẢ LÔ] Đã xử lý: ${data.processed}, Thành công: ${data.successful}, Thất bại: ${data.failed}, Chặn: ${data.blocked}. Còn lại trong queue: ${data.remaining}`
          ]);
          
          finished = data.finished;
          lastStatus = data.campaign_status;

          if (data.paused) {
            setConsoleLogs(prev => [...prev, `[TẠM DỪNG] Tự động tạm dừng do lỗi sender: ${data.error}`]);
            toast.warning("Chiến dịch tự động tạm dừng do vấn đề sender.");
            break;
          }

          loadAllData();
          loadSnapshots(campaignId);

          // Cool-down pause 1.5s
          await new Promise(r => setTimeout(r, 1500));
        } else {
          setConsoleLogs(prev => [...prev, `[LỖI APIS] ${data.error || "Gặp sự cố khi gửi"}`]);
          toast.error(data.error || "Gặp sự cố khi gửi");
          break;
        }
      }

      setIsSendingLoopActive(false);
      if (finished) {
        setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Chiến dịch gửi hoàn tất vĩnh viễn! 🎉`]);
      }
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `[LỖI HỆ THỐNG] ${err.message}`]);
      setIsSendingLoopActive(false);
    }
  };

  const processSingleBatch = async (campaignId: string) => {
    if (isSendingLoopActive) return;
    
    // Check snapshot check (mandatory snapshot check)
    const total = selectedCampaign?.metrics?.total_targets || selectedCampaign?.estimated_recipients || 0;
    if (total === 0) {
      toast.error("Chiến dịch bắt buộc phải có danh sách người nhận (snapshot) đã đóng băng. Vui lòng duyệt chiến dịch trước khi gửi.");
      return;
    }
    
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Thực hiện gửi thủ công 1 lô tiếp theo (Tối đa 30 tin)...`]);

    if (useLocalFallback) {
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      const idx = localCamps.findIndex((c: any) => c.id === campaignId);
      if (idx !== -1) {
        const camp = localCamps[idx];
        const currentProcessed = Math.min((camp.processed_recipients || 0) + 10, 100);
        camp.status = currentProcessed >= 100 ? "completed" : "paused";
        camp.processed_recipients = currentProcessed;
        camp.successful_recipients = currentProcessed;
        camp.metrics = {
          total_targets: 100,
          sent: currentProcessed,
          failed: 0,
          capped: 0
        };
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSelectedCampaign(camp);
        
        setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Gửi thành công lô thủ công mock (10/10) - Tiến trình: ${currentProcessed}%`]);
        if (currentProcessed >= 100) {
          toast.success("Chiến dịch hoàn thành gửi (Sandbox)");
          setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Chiến dịch hoàn thành! 🎉`]);
        } else {
          toast.success("Đã hoàn thành gửi 1 lô. Nhấn tiếp để gửi lô tiếp theo.");
        }
      }
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("process-zns-campaign", {
        body: { campaign_id: campaignId, batch_size: 30 }
      });

      if (error) {
        setConsoleLogs(prev => [...prev, `[LỖI] Edge function error: ${error.message}`]);
        toast.error("Lỗi gửi lô: " + error.message);
        return;
      }

      if (data.success) {
        setConsoleLogs(prev => [
          ...prev, 
          `[KẾT QUẢ LÔ THỦ CÔNG] Đã xử lý: ${data.processed}, Thành công: ${data.successful}, Thất bại: ${data.failed}, Chặn: ${data.blocked}. Còn lại trong queue: ${data.remaining}`
        ]);
        
        if (data.paused) {
          setConsoleLogs(prev => [...prev, `[TẠM DỪNG] Tự động tạm dừng do lỗi sender: ${data.error}`]);
          toast.warning("Chiến dịch tự động tạm dừng do vấn đề sender.");
        } else if (data.finished) {
          setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Chiến dịch gửi hoàn tất vĩnh viễn! 🎉`]);
          toast.success("Chiến dịch gửi hoàn tất vĩnh viễn!");
        } else {
          toast.success(`Đã gửi thành công 1 lô (${data.processed} tin).`);
        }

        loadAllData();
        loadSnapshots(campaignId);
        
        const { data: updatedCamp } = await supabase.from("marketing_campaigns").select("*, message_templates(*), zns_templates(*), sender_accounts(*), customer_segments(*)").eq("id", campaignId).single();
        if (updatedCamp) setSelectedCampaign(updatedCamp);
      } else {
        setConsoleLogs(prev => [...prev, `[LỖI APIS] ${data.error || "Gặp sự cố khi gửi"}`]);
        toast.error(data.error || "Gặp sự cố khi gửi");
      }
    } catch (err: any) {
      setConsoleLogs(prev => [...prev, `[LỖI HỆ THỐNG] ${err.message}`]);
    }
  };

  const handlePauseCampaign = async (campaignId: string) => {
    (window as any).stopZnsCampaignSend = true;
    setIsSendingLoopActive(false);

    if (useLocalFallback) {
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      const idx = localCamps.findIndex((c: any) => c.id === campaignId);
      if (idx !== -1) {
        localCamps[idx].status = "paused";
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSelectedCampaign(localCamps[idx]);
      }
      toast.success("Đã tạm dừng chiến dịch (Sandbox)");
      return;
    }

    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ status: "paused", paused_at: new Date().toISOString() })
        .eq("id", campaignId);

      if (error) throw error;
      toast.success("Chiến dịch đã được tạm dừng.");
      loadAllData();
      
      const { data } = await supabase.from("marketing_campaigns").select("*, message_templates(*), zns_templates(*), sender_accounts(*), customer_segments(*)").eq("id", campaignId).single();
      if (data) setSelectedCampaign(data);
    } catch (err: any) {
      toast.error("Lỗi tạm dừng: " + err.message);
    }
  };

  const handleCancelCampaign = async (campaignId: string) => {
    (window as any).stopZnsCampaignSend = true;
    setIsSendingLoopActive(false);

    if (useLocalFallback) {
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      const idx = localCamps.findIndex((c: any) => c.id === campaignId);
      if (idx !== -1) {
        localCamps[idx].status = "cancelled";
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSelectedCampaign(localCamps[idx]);
      }
      toast.success("Đã hủy chiến dịch (Sandbox)");
      return;
    }

    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", campaignId);

      if (error) throw error;
      toast.success("Chiến dịch đã bị hủy bỏ vĩnh viễn.");
      loadAllData();

      const { data } = await supabase.from("marketing_campaigns").select("*, message_templates(*), zns_templates(*), sender_accounts(*), customer_segments(*)").eq("id", campaignId).single();
      if (data) setSelectedCampaign(data);
    } catch (err: any) {
      toast.error("Lỗi hủy chiến dịch: " + err.message);
    }
  };

  const handleRequestReview = async (campaignId: string) => {
    if (useLocalFallback) {
      let localCamps = JSON.parse(localStorage.getItem("mock_campaigns") || "[]");
      const idx = localCamps.findIndex((c: any) => c.id === campaignId);
      if (idx !== -1) {
        localCamps[idx].status = "pending_review";
        localStorage.setItem("mock_campaigns", JSON.stringify(localCamps));
        setCampaigns(localCamps);
        setSelectedCampaign(localCamps[idx]);
      }
      toast.success("Đã gửi yêu cầu duyệt chiến dịch (Sandbox)");
      return;
    }

    try {
      const { error } = await supabase
        .from("marketing_campaigns")
        .update({ status: "pending_review" })
        .eq("id", campaignId);

      if (error) throw error;
      toast.success("Đã gửi yêu cầu duyệt chiến dịch.");
      loadAllData();

      const { data } = await supabase.from("marketing_campaigns").select("*, message_templates(*), zns_templates(*), sender_accounts(*), customer_segments(*)").eq("id", campaignId).single();
      if (data) setSelectedCampaign(data);
    } catch (err: any) {
      toast.error("Lỗi gửi yêu cầu duyệt: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-16 font-sans antialiased selection:bg-purple-500 selection:text-white">
      {/* Thanh Header Điều hướng Siêu cấp */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto px-4 md:px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/marketing/templates" className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 text-white">
                  B2B Automation
                </span>
                <span className="text-xs text-slate-500 font-mono">v2.4-Compliance</span>
              </div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2 mt-0.5">
                Bộ điều khiển Chiến dịch Tiếp thị <span className="text-purple-400">(Dispatch Engine)</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={loadAllData}
              className="h-10 px-3 bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleOpenWizard}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-purple-900/20"
            >
              <Rocket className="w-4 h-4 mr-2" /> Khởi tạo Chiến dịch
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 mt-8 space-y-8">
        {/* Dải Banner Thống kê Hiệu năng Toàn hệ thống */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-xl group-hover:bg-purple-500/10 transition-all" />
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Tổng số Chiến dịch</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black tracking-tight text-white">{stats.total}</span>
              <span className="text-xs font-medium text-slate-500">lịch sử</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
              <span className="w-2 h-2 rounded-full bg-purple-500" /> Cập nhật tự động
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Đã Phát hành Hoàn tất</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black tracking-tight text-emerald-400">{stats.completed}</span>
              <span className="text-xs font-medium text-slate-500">campaigns</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-emerald-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Tiếp cận {stats.totalSentTargets} đối tác
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Đang gửi / Đã duyệt / Tạm dừng</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black tracking-tight text-amber-400">{stats.sending + stats.paused + stats.approved}</span>
              <span className="text-xs font-medium text-slate-500">luồng</span>
            </div>
            <div className="mt-3 flex items-center gap-3 text-[11px] text-amber-400/90 font-medium">
              <span className="flex items-center gap-1"><Play className="w-3 h-3 animate-pulse" /> {stats.sending} Đang gửi</span>
              <span className="flex items-center gap-1"><Pause className="w-3 h-3" /> {stats.paused} Tạm dừng</span>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 relative overflow-hidden">
            <span className="text-xs font-bold text-slate-400 block uppercase tracking-wider">Bản nháp / Chờ duyệt</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-black tracking-tight text-purple-400">{stats.draft + stats.pendingReview}</span>
              <span className="text-xs font-medium text-slate-500">campaigns</span>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-purple-400 font-medium">
              <FileText className="w-3.5 h-3.5" /> Chờ Admin duyệt: {stats.pendingReview}
            </div>
          </div>
        </div>

        {/* Khu vực Bộ lọc & Danh sách Chiến dịch */}
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Tìm kiếm chiến dịch..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 rounded-xl w-full"
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
              <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                <Filter className="w-3.5 h-3.5" /> Lọc:
              </span>
              {[
                { label: "Tất cả", value: "all" },
                { label: "Nháp", value: "draft" },
                { label: "Chờ duyệt", value: "pending_review" },
                { label: "Đã duyệt", value: "approved" },
                { label: "Đang gửi", value: "sending" },
                { label: "Tạm dừng", value: "paused" },
                { label: "Hoàn tất", value: "completed" },
                { label: "Đã hủy", value: "cancelled" }
              ].map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    statusFilter === tab.value
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-slate-900 text-slate-400 hover:text-white border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Dải thẻ danh sách */}
          <div className="space-y-3">
            {loading ? (
              <div className="p-12 text-center text-slate-500 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                <p className="text-xs">Đang truy xuất nhật ký hệ thống phát hành...</p>
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/50 rounded-2xl border border-slate-800/80 space-y-2">
                <Layers className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs font-bold text-slate-400">Không tìm thấy chiến dịch nào tương thích</p>
                <p className="text-[11px] text-slate-600">Thử thay đổi từ khóa tìm kiếm hoặc tạo mới chiến dịch đầu tiên.</p>
              </div>
            ) : (
              filteredCampaigns.map((c: any) => {
                const totalTargets = c.metrics?.total_targets || c.estimated_recipients || 0;
                const sentCount = c.successful_recipients || c.metrics?.sent || 0;
                const failedCount = c.failed_recipients || c.metrics?.failed || 0;
                const progressPercent = totalTargets > 0 ? Math.min(Math.round((sentCount / totalTargets) * 100), 100) : 0;

                const templateName = c.zns_template_id ? c.zns_templates?.template_name : c.message_templates?.name;
                const channelLabel = c.zns_template_id ? "ZNS" : c.message_templates?.channel?.toUpperCase() || "EMAIL";

                const getStatusBadgeClass = (status: string) => {
                  switch (status) {
                    case 'completed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    case 'sending': return 'bg-purple-500/10 text-purple-400 border border-purple-500/20 animate-pulse';
                    case 'paused': return 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                    case 'pending_review': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
                    case 'approved': return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20';
                    case 'cancelled': return 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                    case 'failed': return 'bg-rose-600/15 text-rose-500 border border-rose-600/25';
                    default: return 'bg-slate-800 text-slate-400 border border-slate-700';
                  }
                };

                const getStatusLabel = (status: string) => {
                  switch (status) {
                    case 'completed': return 'Hoàn tất';
                    case 'sending': return 'Đang gửi';
                    case 'paused': return 'Tạm dừng';
                    case 'pending_review': return 'Chờ duyệt';
                    case 'approved': return 'Đã duyệt';
                    case 'cancelled': return 'Đã hủy';
                    case 'failed': return 'Thất bại';
                    case 'draft': return 'Bản nháp';
                    default: return status;
                  }
                };

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCampaign(c);
                      loadSnapshots(c.id);
                      setDetailDialogOpen(true);
                    }}
                    className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 hover:bg-slate-900 transition-all space-y-4 cursor-pointer relative group"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${getStatusBadgeClass(c.status)}`}>
                            {getStatusLabel(c.status)}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono">
                            {new Date(c.created_at).toLocaleDateString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white tracking-wide group-hover:text-purple-400 transition-colors">{c.name}</h3>
                      </div>

                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block uppercase">Nguồn phát hành</span>
                          <span className="font-medium text-slate-300">{c.sender_accounts?.name || "Hệ thống CRM"}</span>
                        </div>
                        <div className="text-right hidden sm:block">
                          <span className="text-[10px] text-slate-500 block uppercase">Kênh / Khuôn mẫu</span>
                          <span className="font-medium text-purple-400 font-mono">
                            [{channelLabel}] {templateName || "Tùy chỉnh"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Thanh tiến độ */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-500" /> Phân khúc đích: <strong className="text-slate-200">{c.customer_segments?.name || "Tùy chọn"}</strong> ({totalTargets} Đối tác)
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-medium">{sentCount} Đã gửi</span>
                          {failedCount > 0 && <span className="text-rose-400 font-medium">{failedCount} Lỗi</span>}
                          <span className="text-slate-500 font-mono">{progressPercent}%</span>
                        </div>
                      </div>

                      <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            c.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                            c.status === 'sending' ? 'bg-gradient-to-r from-purple-500 to-indigo-500' :
                            c.status === 'paused' ? 'bg-amber-500' : 'bg-slate-800'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    {c.scheduled_at && c.status === 'draft' && (
                      <div className="p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" /> Hẹn kích hoạt tự động vào: <strong className="font-mono">{new Date(c.scheduled_at).toLocaleString("vi-VN")}</strong>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Modal Khởi tạo Chiến dịch Đa tầng (Wizard Dialog) */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="sm:max-w-[700px] bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden rounded-3xl shadow-2xl">
          {/* Thanh Tiến độ Wizard */}
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">Dispatch Setup Wizard</span>
              <DialogTitle className="text-base font-black text-white">Khởi tạo Chiến dịch Tiếp thị Mới</DialogTitle>
            </div>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(st => (
                <div key={st} className="flex items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    wizardStep === st ? "bg-purple-500 text-white ring-4 ring-purple-500/20" :
                    wizardStep > st ? "bg-slate-800 text-purple-400" : "bg-slate-900 text-slate-600 border border-slate-800"
                  }`}>
                    {st}
                  </div>
                  {st < 4 && <span className={`w-4 h-0.5 mx-0.5 ${wizardStep > st ? "bg-purple-500/50" : "bg-slate-800"}`} />}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
            {/* BƯỚC 1: Đặt tên & Chọn khuôn mẫu */}
            {wizardStep === 1 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Tên Chiến dịch định danh *</Label>
                  <Input
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="vd: Chuyển giao Phác đồ Điều trị Nám Tháng 6..."
                    className="h-10 bg-slate-900 border-slate-800 text-white rounded-xl focus-visible:ring-purple-500"
                  />
                  <span className="text-[10px] text-slate-500 block">Sử dụng tên tường minh để tra cứu hiệu quả gửi về sau.</span>
                </div>

                <div className="space-y-1.5 pb-1">
                  <Label className="text-xs font-bold text-slate-300">Loại Chiến dịch Tiếp thị</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignType("zns");
                        setFormZnsTemplateId(znsTemplates[0]?.id || "");
                        const firstZnsSender = senders.find(s => s.channel === "zalo_oa" || s.channel === "zalo")?.id || "";
                        setFormSenderId(firstZnsSender);
                      }}
                      className={`h-10 rounded-xl text-xs font-bold transition-all border ${
                        campaignType === "zns"
                          ? "bg-purple-600/20 text-purple-300 border-purple-500/50"
                          : "bg-slate-900 text-slate-400 border-transparent hover:text-white"
                      }`}
                    >
                      💬 Tin nhắn Zalo ZNS
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCampaignType("general");
                        setFormTemplateId(templates[0]?.id || "");
                        const firstEmailSender = senders.find(s => s.channel === "email")?.id || "";
                        setFormSenderId(firstEmailSender);
                      }}
                      className={`h-10 rounded-xl text-xs font-bold transition-all border ${
                        campaignType === "general"
                          ? "bg-purple-600/20 text-purple-300 border-purple-500/50"
                          : "bg-slate-900 text-slate-400 border-transparent hover:text-white"
                      }`}
                    >
                      ✉️ Email / SMS Marketing
                    </button>
                  </div>
                </div>

                {campaignType === "zns" ? (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Mẫu Tin ZNS Đã Đăng Ký (Approved ZNS Templates) *</Label>
                    <select
                      value={formZnsTemplateId}
                      onChange={e => setFormZnsTemplateId(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-xs rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {znsTemplates.length === 0 ? (
                        <option value="">Không có mẫu ZNS nào đã duyệt</option>
                      ) : (
                        znsTemplates.map(t => (
                          <option key={t.id} value={t.id}>
                            [{t.category.toUpperCase()}] — {t.template_name} (OA: {senders.find(s => s.id === t.sender_account_id)?.name || "OA"})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-300">Khuôn mẫu Email/SMS gốc *</Label>
                    <select
                      value={formTemplateId}
                      onChange={e => setFormTemplateId(e.target.value)}
                      className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-xs rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>
                          [{t.channel.toUpperCase()}] — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedTemplate && (
                  <div className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 text-xs">
                    <span className="text-[10px] font-bold text-purple-400 block uppercase">Thuộc tính Mẫu đang chọn:</span>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>• Phân loại: <strong className="text-slate-300">{selectedTemplate.purpose}</strong></div>
                      <div>• Kênh: <strong className="text-slate-300">{selectedTemplate.channel}</strong></div>
                      <div>• Bắt buộc Opt-in: <strong className={selectedTemplate.requires_opt_in ? "text-amber-400" : "text-slate-500"}>{selectedTemplate.requires_opt_in ? "Có" : "Không"}</strong></div>
                      <div>• Giới hạn chu kỳ: <strong className="text-purple-400">{selectedTemplate.max_send_frequency_days ? `${selectedTemplate.max_send_frequency_days} ngày` : "Không giới hạn"}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* BƯỚC 2: Cấu hình Tài khoản gửi */}
            {wizardStep === 2 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Tài khoản Nguồn Phát hành (Sender Account) *</Label>
                  <div className="grid grid-cols-1 gap-2.5">
                    {senders
                      .filter(s => {
                        if (campaignType === "zns") {
                          return s.channel === "zalo_oa" || s.channel === "zalo";
                        }
                        return s.channel === "email" || s.channel === "sms";
                      })
                      .map(s => {
                        const resolution = resolveSenderForMessage({
                          channel: campaignType === "zns" ? "zalo_oa" : (selectedTemplate?.channel || 'email').toLowerCase().includes('email') ? 'email' : 'zalo_oa',
                          mode: 'campaign',
                        customer: { id: 'temp-check' },
                        businessSenders: [
                          {
                            id: s.id,
                            name: s.name,
                            channel: s.channel,
                            is_active: s.is_active ?? true,
                            health_status: s.health_status ?? 'healthy',
                            daily_usage: s.daily_usage ?? 0,
                            daily_limit: s.daily_limit ?? 1000,
                          }
                        ]
                      });

                      const health = s.health_status ?? 'healthy';

                      return (
                        <label
                          key={s.id}
                          onClick={() => {
                            if (resolution.allowed) {
                              setFormSenderId(s.id);
                            } else {
                              toast.error(`Không thể chọn sender này: ${resolution.reason}`);
                            }
                          }}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            formSenderId === s.id
                              ? "bg-purple-500/10 border-purple-500 text-white"
                              : !resolution.allowed
                              ? "bg-slate-950 border-rose-950/40 text-slate-500 opacity-60 cursor-not-allowed"
                              : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          <div>
                            <span className="text-xs font-bold block text-slate-200">{s.name}</span>
                            <span className="text-[10px] font-mono text-slate-500">{s.sender_email}</span>
                            {!resolution.allowed && (
                              <span className="text-[10px] text-rose-500 font-bold block mt-1">
                                ⚠️ Chặn: {resolution.reason}
                              </span>
                            )}
                            {resolution.allowed && resolution.warnings.length > 0 && (
                              <span className="text-[10px] text-amber-500 font-bold block mt-1">
                                ⚠️ Cảnh báo: {resolution.warnings[0]}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                              {s.channel}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              health === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                              health === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-rose-500/20 text-rose-400'
                            }`}>
                              {health.toUpperCase()}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* BƯỚC 3: Chọn Phân khúc đích */}
            {wizardStep === 3 && (
              <div className="space-y-4 animate-fade-in">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-300">Tập Khách hàng Đích (Target Audience Segment) *</Label>
                  <select
                    value={formSegmentId}
                    onChange={e => setFormSegmentId(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-900 border border-slate-800 text-xs rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {segments.map(seg => (
                      <option key={seg.id} value={seg.id}>
                        {seg.name} ({seg.segment_type === 'static' ? 'Danh sách ghim tĩnh' : 'Bộ lọc truy vấn động'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Chấm điểm tuân thủ thời gian thực */}
                <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/30 space-y-3">
                  <span className="text-[10px] font-bold text-purple-400 block uppercase">
                    🛡️ Phân tích Tuân thủ Tiếp thị (Compliance Engine Forecast)
                  </span>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <span className="text-[10px] text-slate-500 block">Tổng tập đích</span>
                      <span className="text-sm font-bold text-slate-200">{complianceEstimate.total}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <span className="text-[10px] text-emerald-500 block">Hợp lệ gửi</span>
                      <span className="text-sm font-bold text-emerald-400">{complianceEstimate.valid}</span>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      {campaignType === "zns" ? (
                        <>
                          <span className="text-[10px] text-amber-500 block">Thiếu SĐT</span>
                          <span className="text-sm font-bold text-amber-400">{complianceEstimate.missingPhone}</span>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] text-amber-500 block">Chặn tần suất</span>
                          <span className="text-sm font-bold text-amber-400">{complianceEstimate.capped}</span>
                        </>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-slate-900/80">
                      <span className="text-[10px] text-rose-500 block">Khách Opt-out</span>
                      <span className="text-sm font-bold text-rose-400">{complianceEstimate.optOut}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 leading-relaxed italic">
                    💡 Engine tự động gạt bỏ các Spa đã từ chối nhận tin hoặc vừa nhận thông điệp cùng mục đích trong chu kỳ giới hạn. Hệ thống đảm bảo an toàn tuyệt đối cho uy tín tên miền gửi đi.
                  </p>
                </div>
              </div>
            )}

            {/* BƯỚC 4: Kiểm tra trực quan & Đặt lịch */}
            {wizardStep === 4 && (
              <div className="space-y-5 animate-fade-in">
                {/* Xem trước thông điệp */}
                <div className="border border-slate-800 rounded-xl overflow-hidden bg-white text-slate-900">
                  <div className="bg-slate-100 p-2 border-b border-slate-200 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                    <span>{campaignType === "zns" ? "Live ZNS Content Preview" : "Live Email Content Preview"}</span>
                    <span className="text-purple-600 font-mono">{campaignType === "zns" ? "Chế độ Tin ZNS B2B" : "Chế độ Chiến dịch B2B"}</span>
                  </div>

                  {selectedTemplate?.banner_image_url && (
                    <div className="w-full h-28 bg-slate-100 overflow-hidden">
                      <img src={selectedTemplate.banner_image_url} alt="Banner" className="w-full h-full object-cover" />
                    </div>
                  )}

                  <div className="p-3 space-y-2 text-xs">
                    <div className="font-bold text-purple-950 border-b pb-1">
                      {campaignType === "zns" ? `Mẫu ZNS: ${selectedTemplate?.name}` : (selectedTemplate?.subject_template || "[DESEMBRE] Thông tin Chương trình Đào tạo Chuyên sâu")}
                    </div>

                    <div className="text-slate-700 whitespace-pre-wrap font-sans leading-relaxed text-[11px]">
                      {selectedTemplate?.body_template || "Nội dung thông điệp chính..."}
                    </div>

                    {selectedTemplate?.cta_url && (
                      <div className="pt-2">
                        <span className="inline-block px-4 py-1.5 bg-purple-600 text-white font-bold rounded text-[10px]">
                          {selectedTemplate.cta_label || "Xem chi tiết"}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t mt-2 text-[9px] text-slate-400 italic">
                      {campaignType === "zns" ? (
                        <span>Hệ thống tự động gửi qua Zalo OA chính thức của doanh nghiệp sau khi được phê duyệt.</span>
                      ) : (
                        <span>Hệ thống tự động chèn liên kết: <span className="underline text-purple-600 cursor-pointer">Hủy đăng ký nhận bản tin (Unsubscribe)</span> theo chuẩn CAN-SPAM.</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Chọn Lập lịch */}
                <div className="space-y-3 pt-2">
                  <Label className="text-xs font-bold text-slate-300">Thời gian Kích hoạt Phát hành</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <label
                      onClick={() => setFormScheduleType("now")}
                      className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        formScheduleType === "now" ? "bg-purple-500/10 border-purple-500 text-purple-300 font-bold" : "bg-slate-900 border-slate-800 text-slate-500"
                      }`}
                    >
                      <Send className="w-4 h-4 text-purple-500" /> Gửi ngay lập tức
                    </label>

                    <label
                      onClick={() => setFormScheduleType("later")}
                      className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                        formScheduleType === "later" ? "bg-amber-500/10 border-amber-500 text-amber-300 font-bold" : "bg-slate-900 border-slate-800 text-slate-500"
                      }`}
                    >
                      <Calendar className="w-4 h-4 text-amber-500" /> Lên lịch Hẹn giờ
                    </label>
                  </div>

                  {formScheduleType === "later" && (
                    <div className="pt-2 animate-fade-in">
                      <Input
                        type="datetime-local"
                        value={formScheduleTime}
                        onChange={e => setFormScheduleTime(e.target.value)}
                        className="h-10 bg-slate-900 border-slate-800 text-white rounded-xl"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex items-center justify-between">
            {wizardStep > 1 ? (
              <Button
                variant="outline"
                onClick={() => setWizardStep(prev => prev - 1)}
                className="h-9 px-4 bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
              >
                Quay lại
              </Button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => setWizardOpen(false)}
                className="h-9 text-slate-500 hover:text-slate-300"
              >
                Hủy
              </Button>

              {wizardStep < 4 ? (
                <Button
                  onClick={() => setWizardStep(prev => prev + 1)}
                  disabled={wizardStep === 2 && !isSelectedSenderAllowed}
                  className="h-9 px-5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tiếp tục
                </Button>
              ) : (
                <Button
                  onClick={handleDispatchCampaign}
                  disabled={saving}
                  className="h-9 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-md"
                >
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Lưu nháp Chiến dịch
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PHÊ DUYỆT CHIẾN DỊCH (APPROVAL GATE) */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="sm:max-w-[550px] bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden rounded-3xl shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-800">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">Compliance Check & Gate</span>
            <DialogTitle className="text-base font-black text-white">Kiểm duyệt & Phê duyệt Chiến dịch</DialogTitle>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-1.5 text-xs">
              <span className="text-slate-400 block font-bold">Chiến dịch kiểm duyệt:</span>
              <strong className="text-white text-sm font-black">{selectedCampaign?.name}</strong>
              <div className="grid grid-cols-2 gap-2 mt-3 p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-[11px]">
                <div>• Kênh: <strong className="text-purple-400">{selectedCampaign?.zns_template_id ? "Tin ZNS Zalo" : "Email/SMS"}</strong></div>
                <div>• Tài khoản gửi: <strong className="text-slate-300">{selectedCampaign?.sender_accounts?.name}</strong></div>
              </div>
            </div>

            {/* Dải báo cáo compliance trước phê duyệt */}
            <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/30 space-y-3">
              <span className="text-[10px] font-bold text-purple-400 block uppercase">
                🛡️ Dự báo tuân thủ (Compliance Forecast)
              </span>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <span className="text-[10px] text-slate-500 block">Tổng tập</span>
                  <span className="font-bold text-slate-200">{complianceEstimate.total}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <span className="text-[10px] text-emerald-500 block">Hợp lệ</span>
                  <span className="font-bold text-emerald-400">{complianceEstimate.valid}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <span className="text-[10px] text-amber-500 block">Thiếu SĐT</span>
                  <span className="font-bold text-amber-400">{complianceEstimate.missingPhone}</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-900/80">
                  <span className="text-[10px] text-rose-500 block">Opt-out</span>
                  <span className="font-bold text-rose-400">{complianceEstimate.optOut}</span>
                </div>
              </div>

              {selectedCampaign?.sender_accounts?.health_status && selectedCampaign.sender_accounts.health_status !== "healthy" && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span><strong>Cảnh báo:</strong> Tài khoản gửi có trạng thái sức khỏe không tốt ({selectedCampaign.sender_accounts.health_status})!</span>
                </div>
              )}
            </div>

            {isAdminOrSubAdmin ? (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <input
                  type="checkbox"
                  id="chkConfirmApprove"
                  checked={approvalConfirmed}
                  onChange={e => setApprovalConfirmed(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-purple-500 rounded cursor-pointer"
                />
                <label htmlFor="chkConfirmApprove" className="text-[11px] text-slate-300 leading-normal cursor-pointer select-none">
                  Xác nhận phê duyệt chiến dịch này. Hệ thống sẽ tiến hành <strong>đóng băng (snapshot) danh sách người nhận</strong> tại thời điểm này để chuẩn bị gửi.
                </label>
              </div>
            ) : (
              <div className="p-3.5 text-center text-xs rounded-xl bg-rose-500/5 border border-rose-500/10 text-rose-400">
                ⚠️ Tài khoản của bạn không có vai trò Admin/SubAdmin. Bạn không có quyền phê duyệt chiến dịch này.
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-900 px-6 py-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setApprovalDialogOpen(false)} className="h-9 text-slate-400 hover:text-slate-200">
              Hủy bỏ
            </Button>
            {isAdminOrSubAdmin && (
              <Button
                onClick={() => selectedCampaign && handleApproveCampaign(selectedCampaign)}
                disabled={!approvalConfirmed}
                className="h-9 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Xác nhận Phê duyệt
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CHI TIẾT CHIẾN DỊCH & BẢNG ĐIỀU KHIỂN GỬI (PROGRESS CONSOLE) */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[900px] bg-slate-950 text-slate-100 border-slate-800 p-0 overflow-hidden rounded-3xl shadow-2xl">
          <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">Campaign Control Panel</span>
              <DialogTitle className="text-base font-black text-white">{selectedCampaign?.name}</DialogTitle>
            </div>
            <Button
              variant="outline"
              onClick={() => selectedCampaign && loadSnapshots(selectedCampaign.id)}
              className="h-8 px-2.5 bg-slate-950 border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white"
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Làm mới
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-800 max-h-[75vh] overflow-hidden">
            {/* CỘT TRÁI: ĐIỀU KHIỂN & TIẾN ĐỘ & CONSOLE */}
            <div className="md:col-span-7 p-6 overflow-y-auto space-y-5 flex flex-col h-full">
              {/* Thống kê tiến độ */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-bold uppercase block tracking-wider">Tiến trình Gửi</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wide border ${
                    selectedCampaign?.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    selectedCampaign?.status === 'sending' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20 animate-pulse' :
                    selectedCampaign?.status === 'paused' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {selectedCampaign?.status}
                  </span>
                </div>

                {/* Progress bar */}
                {(() => {
                  const total = selectedCampaign?.metrics?.total_targets || selectedCampaign?.estimated_recipients || 0;
                  const sent = selectedCampaign?.successful_recipients || selectedCampaign?.metrics?.sent || 0;
                  const failed = selectedCampaign?.failed_recipients || selectedCampaign?.metrics?.failed || 0;
                  const progress = total > 0 ? Math.min(Math.round((sent / total) * 100), 100) : 0;

                  return (
                    <div className="space-y-1.5">
                      <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                        <div className="p-1 rounded bg-slate-900">
                          <span className="text-slate-500 block">Tổng số</span>
                          <strong className="text-slate-200">{total}</strong>
                        </div>
                        <div className="p-1 rounded bg-slate-900">
                          <span className="text-emerald-500 block">Đã gửi</span>
                          <strong className="text-emerald-400">{sent}</strong>
                        </div>
                        <div className="p-1 rounded bg-slate-900">
                          <span className="text-rose-500 block">Thất bại</span>
                          <strong className="text-rose-400">{failed}</strong>
                        </div>
                        <div className="p-1 rounded bg-slate-900">
                          <span className="text-slate-500 block">Tiến độ</span>
                          <strong className="text-purple-400">{progress}%</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Console log window */}
              <div className="flex-1 flex flex-col min-h-[160px] bg-black rounded-xl border border-slate-800 p-3 font-mono text-[10px] text-slate-300 overflow-hidden relative">
                <div className="absolute top-1 right-2 text-[9px] text-slate-600 select-none uppercase font-sans">Edge Function Terminal</div>
                <div className="flex-1 overflow-y-auto space-y-1 select-text scrollbar-thin">
                  {consoleLogs.length === 0 ? (
                    <span className="text-slate-600 italic">Sẵn sàng kích hoạt operational batch sending... Click "Bắt đầu gửi" để khởi chạy lô đầu tiên.</span>
                  ) : (
                    consoleLogs.map((log, i) => (
                      <div key={i} className={log.includes("[LỖI]") ? "text-rose-400" : log.includes("[TẠM DỪNG]") ? "text-amber-400" : log.includes("thành công") ? "text-emerald-400" : "text-slate-300"}>
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Nút Điều khiển / Hành động */}
              <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2 justify-end">
                {/* Hành động 1: Request Review (Chỉ Admin/SubAdmin hoặc người tạo có quyền) */}
                {selectedCampaign?.status === "draft" && canManageCampaign(selectedCampaign) && (
                  <Button
                    onClick={() => handleRequestReview(selectedCampaign?.id || "")}
                    className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                  >
                    🚀 Gửi Yêu cầu Phê duyệt
                  </Button>
                )}

                {/* Hành động 2: Phê duyệt (Cho Admin hoặc người tạo tự phê duyệt chiến dịch của mình) */}
                {selectedCampaign?.status === "pending_review" && canManageCampaign(selectedCampaign) && (
                  <Button
                    onClick={() => {
                      setApprovalConfirmed(false);
                      setApprovalDialogOpen(true);
                    }}
                    className="h-9 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs"
                  >
                    🛡️ Phê duyệt Chiến dịch
                  </Button>
                )}

                {/* Hành động 3: Bắt đầu Gửi / Tiếp tục gửi & Gửi thủ công (Cho Admin hoặc người tạo) */}
                {["approved", "paused"].includes(selectedCampaign?.status || "") && canManageCampaign(selectedCampaign) && (
                  <>
                    <Button
                      onClick={() => selectedCampaign && startSendingCampaign(selectedCampaign.id)}
                      disabled={isSendingLoopActive}
                      className="h-9 px-5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs"
                    >
                      <Play className="w-3.5 h-3.5 mr-1" /> {selectedCampaign?.status === "paused" ? "Gửi tự động (Loop)" : "Bắt đầu Gửi tự động"}
                    </Button>
                    
                    <Button
                      onClick={() => selectedCampaign && processSingleBatch(selectedCampaign.id)}
                      disabled={isSendingLoopActive}
                      className="h-9 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Gửi 1 lô thủ công
                    </Button>
                  </>
                )}

                {/* Hành động 4: Tạm dừng gửi */}
                {selectedCampaign?.status === "sending" && canManageCampaign(selectedCampaign) && (
                  <Button
                    onClick={() => handlePauseCampaign(selectedCampaign.id)}
                    className="h-9 px-5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-black text-xs"
                  >
                    <Pause className="w-3.5 h-3.5 mr-1" /> Tạm dừng gửi
                  </Button>
                )}

                {/* Hành động 5: Hủy chiến dịch (Vĩnh viễn) */}
                {!["completed", "cancelled", "failed", "draft"].includes(selectedCampaign?.status || "") && canManageCampaign(selectedCampaign) && (
                  <Button
                    variant="outline"
                    onClick={() => handleCancelCampaign(selectedCampaign.id)}
                    className="h-9 px-4 rounded-xl bg-transparent border-slate-800 text-rose-500 hover:bg-rose-950/20 hover:text-rose-400 text-xs"
                  >
                    Hủy bỏ vĩnh viễn
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setDetailDialogOpen(false)}
                  className="h-9 px-4 rounded-xl bg-slate-900 border-slate-800 text-slate-400 hover:text-white text-xs"
                >
                  Đóng
                </Button>
              </div>
            </div>

            {/* CỘT PHẢI: RECIPIENT SNAPSHOTS TABLE */}
            <div className="md:col-span-5 p-5 overflow-hidden flex flex-col h-[55vh] md:h-full max-h-[70vh]">
              <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mb-2">Danh sách người nhận (Snapshot)</span>
              
              {snapshotLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                  <span className="text-[10px]">Đang nạp snapshot...</span>
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 border border-dashed border-slate-800/80 rounded-2xl bg-slate-900/10 text-slate-600 text-center">
                  <Users className="w-6 h-6 mb-1.5" />
                  <span className="text-xs font-bold block">Chưa đóng băng danh sách</span>
                  <span className="text-[10px] mt-0.5 leading-relaxed">Danh sách sẽ được đóng băng snapshot cố định ngay khi chiến dịch được Admin phê duyệt.</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-2.5 scrollbar-thin select-none pr-1">
                  {snapshots.map(snap => {
                    const name = snap.customers?.name || "Khách hàng ẩn danh";
                    const phone = snap.customers?.phone || "Không có SĐT";
                    
                    const getSnapStatusClass = (status: string) => {
                      switch (status) {
                        case 'sent': return 'bg-emerald-500/20 text-emerald-400';
                        case 'failed': return 'bg-rose-500/20 text-rose-400';
                        case 'blocked': return 'bg-amber-500/20 text-amber-400';
                        default: return 'bg-slate-900 text-slate-500';
                      }
                    };

                    const getSnapStatusLabel = (status: string) => {
                      switch (status) {
                        case 'sent': return 'Đã gửi';
                        case 'failed': return 'Lỗi';
                        case 'blocked': return 'Chặn';
                        case 'queued': return 'Chờ';
                        default: return status;
                      }
                    };

                    return (
                      <div key={snap.id} className="p-3 rounded-xl bg-slate-900/50 border border-slate-900/80 flex items-center justify-between gap-2 text-xs">
                        <div className="space-y-0.5">
                          <strong className="text-slate-200 block text-[11px] truncate max-w-[150px]">{name}</strong>
                          <span className="text-[10px] font-mono text-slate-500">{phone}</span>
                          {snap.failure_reason && (
                            <span className="text-[9px] text-rose-400 block font-sans truncate max-w-[160px]">
                              ⚠️ {snap.failure_reason}
                            </span>
                          )}
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${getSnapStatusClass(snap.status)}`}>
                          {getSnapStatusLabel(snap.status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
