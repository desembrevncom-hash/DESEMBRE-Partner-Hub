import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ArrowLeft, 
  ShieldCheck, 
  AlertCircle, 
  Clock, 
  Trash2, 
  Users, 
  UserCheck, 
  Search, 
  Mail, 
  CalendarDays,
  CalendarCheck,
  TrendingUp,
  Inbox,
  UserPlus,
  RefreshCw,
  MoreVertical,
  Check,
  Phone,
  Settings,
  AlertTriangle,
  Zap,
  Info
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  getDaysSinceLastInteraction, 
  getLastValidInteraction,
  getCustomerReclaimStage,
  getCustomerReclaimReason
} from "@/lib/customerReclaimRules";
import { createCustomerAtRiskAutomation } from "@/lib/automation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export const Route = createFileRoute("/admin/reclamation")({
  component: AdminReclamationPage,
});

function AdminReclamationPage() {
  const { user, isAdmin, isSubAdmin, loading } = useAuth();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<any[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({});
  const [staffList, setStaffList] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Reassignment modal state
  const [reassignCustomer, setReassignCustomer] = useState<any | null>(null);
  const [reassignType, setReassignType] = useState<'sale' | 'tele' | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [selectedCareModel, setSelectedCareModel] = useState<'tele_owned' | 'tele_qualified_then_sale'>("tele_owned");

  // Reclaim modal state
  const [reclaimCustomer, setReclaimCustomer] = useState<any | null>(null);
  const [reclaimReason, setReclaimReason] = useState<string>("Quá hạn tương tác chăm sóc, thu hồi về kho tự do.");

  const [scanSummary, setScanSummary] = useState<{
    totalScanned: number;
    atRiskCount: number;
    reclaimableCount: number;
    ignoredCount: number;
    errorsCount: number;
  } | null>(null);

  const isAuthorized = isAdmin || isSubAdmin;

  useEffect(() => {
    if (loading) return;
    if (!user || !isAuthorized) {
      navigate({ to: "/login" });
      return;
    }
    loadData();
  }, [user, isAuthorized, loading]);

  const loadData = async () => {
    setBusy(true);
    try {
      // 1. Fetch customers
      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (custErr) throw custErr;
      setCustomers(custData || []);

      // 2. Fetch profiles
      const { data: profData } = await supabase
        .from("profiles")
        .select("id, display_name, email");

      if (profData) {
        const map: Record<string, string> = {};
        profData.forEach(p => {
          map[p.id] = p.display_name || p.email?.split("@")[0] || "Chưa đặt tên";
        });
        setProfilesMap(map);
      }

      // 3. Fetch user roles for reassignment list
      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (profData && rolesData) {
        const rolesMap = new Map<string, string[]>();
        rolesData.forEach((r: any) => {
          const existing = rolesMap.get(r.user_id) || [];
          rolesMap.set(r.user_id, [...existing, r.role]);
        });

        const staff = profData.map((p: any) => {
          const userRoles = rolesMap.get(p.id) || [];
          let role = "staff";
          if (userRoles.includes("admin")) role = "admin";
          else if (userRoles.includes("sub_admin")) role = "sub_admin";
          else if (userRoles.includes("sale")) role = "sale";
          else if (userRoles.includes("tele_lead")) role = "tele_lead";
          else if (userRoles.includes("telesale")) role = "telesale";

          return {
            id: p.id,
            display_name: p.display_name || p.email?.split("@")[0] || "Chưa đặt tên",
            email: p.email,
            role
          };
        });
        setStaffList(staff);
      }
    } catch (err: any) {
      toast.error("Lỗi đồng bộ dữ liệu: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleScanReclamation = async () => {
    setScanning(true);
    const loadingToastId = toast.loading("Bắt đầu quét danh sách khách hàng cần cảnh báo/thu hồi...");
    try {
      // 1. Load active customers (deleted_at is null)
      const { data: activeCustomers, error } = await supabase
        .from("customers")
        .select("*")
        .is("deleted_at", null);

      if (error) throw error;

      if (!activeCustomers || activeCustomers.length === 0) {
        toast.dismiss(loadingToastId);
        toast.success("Không có khách hàng nào hoạt động để quét.");
        return;
      }

      let totalScanned = activeCustomers.length;
      let atRiskCount = 0;
      let reclaimableCount = 0;
      let ignoredCount = 0;
      let errorsCount = 0;

      for (const customer of activeCustomers) {
        try {
          const stage = getCustomerReclaimStage(customer);

          if (stage === "at_risk") {
            // Update customer
            const { error: updateErr } = await supabase
              .from("customers")
              .update({
                ownership_status: "at_risk",
                at_risk_at: customer.at_risk_at || new Date().toISOString(),
                reclaim_reason: getCustomerReclaimReason(customer)
              })
              .eq("id", customer.id);

            if (updateErr) throw updateErr;

            // Automation
            const ownerId = customer.owner_sale_id || customer.owner_tele_id;
            if (ownerId) {
              const reason = getCustomerReclaimReason(customer);
              await createCustomerAtRiskAutomation(customer, ownerId, reason);
            }
            atRiskCount++;
          } else if (stage === "reclaimable") {
            // Update customer
            const { error: updateErr } = await supabase
              .from("customers")
              .update({
                ownership_status: "reclaimable",
                reclaimable_at: customer.reclaimable_at || new Date().toISOString(),
                reclaim_reason: getCustomerReclaimReason(customer)
              })
              .eq("id", customer.id);

            if (updateErr) throw updateErr;

            // Notification for admin (avoid duplicate notifications within 24h)
            const { data: existingNotif } = await supabase
              .from("notifications")
              .select("id")
              .eq("recipient_user_id", user?.id)
              .eq("customer_id", customer.id)
              .eq("type", "customer_reclaimable")
              .is("read_at", null)
              .limit(1);

            if (!existingNotif || existingNotif.length === 0) {
              await supabase.from("notifications").insert({
                recipient_user_id: user?.id,
                customer_id: customer.id,
                type: "customer_reclaimable",
                priority: "high",
                title: "Khách hàng đủ điều kiện thu hồi 🚨",
                message: `Khách hàng "${customer.name || customer.contact_name}" đã đủ điều kiện thu hồi về kho tự do do quá hạn chăm sóc.`,
                action_url: `/admin/reclamation`
              });
            }
            reclaimableCount++;
          } else {
            ignoredCount++;
          }
        } catch (itemErr) {
          console.error("Lỗi khi xử lý khách hàng ID: " + customer.id, itemErr);
          errorsCount++;
        }
      }

      toast.dismiss(loadingToastId);
      setScanSummary({
        totalScanned,
        atRiskCount,
        reclaimableCount,
        ignoredCount,
        errorsCount
      });
      loadData();
    } catch (err: any) {
      toast.dismiss(loadingToastId);
      toast.error("Lỗi khi quét khách hàng: " + err.message);
    } finally {
      setScanning(false);
    }
  };

  const logActivity = async (customerId: string, title: string, content: string) => {
    try {
      await supabase.from("customer_activities").insert({
        customer_id: customerId,
        created_by: user?.id,
        activity_type: "note",
        title,
        content
      });
    } catch (err) {
      console.error("Lỗi ghi log hoạt động:", err);
    }
  };

  // Action 1: Send reminder to owner
  const handleSendReminder = async (customer: any) => {
    const ownerId = customer.owner_sale_id || customer.owner_tele_id;
    if (!ownerId) {
      toast.error("Khách hàng này hiện chưa có nhân sự phụ trách để nhắc nhở.");
      return;
    }

    try {
      const ownerName = profilesMap[ownerId] || "Nhân sự phụ trách";
      const { error } = await supabase.from("notifications").insert({
        recipient_user_id: ownerId,
        customer_id: customer.id,
        type: "reclaim_reminder",
        priority: "high",
        title: "⚠️ CẢNH BÁO CHĂM SÓC KHÁCH HÀNG",
        message: `Admin nhắc bạn chăm sóc khách hàng "${customer.name || customer.contact_name}" ngay để tránh bị thu hồi về Kho Tự Do.`,
        action_url: `/customers/${customer.id}`
      });

      if (error) throw error;
      
      await logActivity(
        customer.id, 
        "Nhắc nhở nhân sự phụ trách", 
        `Admin đã gửi thông báo nhắc nhở chăm sóc đến ${ownerName}.`
      );

      toast.success(`Đã gửi nhắc nhở chăm sóc thành công tới ${ownerName}!`);
    } catch (err: any) {
      toast.error("Lỗi gửi nhắc nhở: " + err.message);
    }
  };

  // Action 2: Extend by 3 days
  const handleExtend3Days = async (customer: any) => {
    try {
      const currentLastInteraction = getLastValidInteraction(customer);
      const newInteractionTime = new Date(currentLastInteraction.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await supabase
        .from("customers")
        .update({
          ownership_status: "assigned",
          last_owner_activity_at: newInteractionTime,
          at_risk_at: customer.at_risk_at ? new Date(new Date(customer.at_risk_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
          reclaimable_at: customer.reclaimable_at ? new Date(new Date(customer.reclaimable_at).getTime() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
          reclaim_reason: `Được gia hạn thêm 3 ngày bởi Admin.`
        })
        .eq("id", customer.id);

      if (error) throw error;

      await logActivity(
        customer.id,
        "Gia hạn 3 ngày chăm sóc",
        "Admin gia hạn thêm 3 ngày chăm sóc trước nguy cơ thu hồi."
      );

      toast.success(`Đã gia hạn 3 ngày chăm sóc thành công cho khách hàng "${customer.name || customer.contact_name}".`);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi gia hạn: " + err.message);
    }
  };

  // Action 3: Reclaim to Free Pool
  const handleReclaimToFreePool = async (customer: any, reason: string) => {
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do thu hồi.");
      return;
    }
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          owner_sale_id: null,
          owner_tele_id: null,
          ownership_status: "free_pool",
          free_pool_at: new Date().toISOString(),
          reclaim_reason: reason
        })
        .eq("id", customer.id);

      if (error) throw error;

      // Tạo customer_activity
      const { error: activityError } = await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        created_by: user?.id,
        activity_type: "handoff",
        title: "Khách được thu hồi về kho tự do",
        content: reason
      });

      if (activityError) console.error("Lỗi tạo activity log:", activityError);

      toast.success(`Đã thu hồi khách hàng "${customer.name || customer.contact_name}" về kho tự do.`);
      setReclaimCustomer(null);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi thu hồi: " + err.message);
    }
  };

  const openReclaimDialog = (customer: any) => {
    setReclaimCustomer(customer);
    setReclaimReason("Quá hạn tương tác chăm sóc, thu hồi về kho tự do.");
  };

  // Actions 4 & 5: Open Reassign Dialog
  const openReassignDialog = (customer: any, type: 'sale' | 'tele') => {
    setReassignCustomer(customer);
    setReassignType(type);
    setSelectedStaffId("");
    setSelectedCareModel("tele_owned");
  };

  const handleConfirmReassign = async () => {
    if (!reassignCustomer || !reassignType) return;
    
    if (!selectedStaffId) {
      toast.error("Vui lòng chọn nhân sự nhận khách hàng.");
      return;
    }
    
    try {
      const staffMember = staffList.find(s => s.id === selectedStaffId);
      const staffName = staffMember ? staffMember.display_name : "Nhân sự mới";

      const updates: any = {
        ownership_status: "assigned",
        last_reassigned_at: new Date().toISOString(),
        reassigned_by: user?.id,
        reclaim_reason: null,
        last_owner_activity_at: new Date().toISOString()
      };

      if (reassignType === 'sale') {
        updates.owner_sale_id = selectedStaffId;
        if (reassignCustomer.care_model === 'sale_owned') {
          updates.owner_tele_id = null;
        } else {
          updates.owner_tele_id = reassignCustomer.owner_tele_id;
        }
      } else {
        updates.owner_tele_id = selectedStaffId;
        updates.care_model = selectedCareModel;
        updates.owner_sale_id = reassignCustomer.owner_sale_id;
      }

      const { error } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", reassignCustomer.id);

      if (error) throw error;

      // 1. Notify the new owner
      await supabase.from("notifications").insert({
        recipient_user_id: selectedStaffId,
        customer_id: reassignCustomer.id,
        type: "customer_assigned",
        priority: "high",
        title: "Khách hàng mới được phân bổ",
        message: "Admin đã chia lại khách hàng cho bạn chăm sóc.",
        action_url: `/customers/${reassignCustomer.id}`
      });

      // 2. Tạo customer_task (now + 24h)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 1);

      const taskPayload: any = {
        customer_id: reassignCustomer.id,
        assigned_to: selectedStaffId,
        assigned_by: user?.id,
        task_type: "follow_up",
        title: "Liên hệ chăm sóc khách hàng mới nhận",
        note: reassignType === 'sale' 
          ? "Khách hàng mới được phân bổ từ Admin. Hãy liên hệ và chăm sóc ngay."
          : "Khách hàng được chia lại cho Tele Lead từ Admin.",
        priority: "high",
        status: "pending",
        due_at: dueDate.toISOString(),
      };

      if (reassignType === 'tele') {
        taskPayload.owner_tele_id = selectedStaffId;
      }

      await supabase.from("customer_tasks").insert(taskPayload);

      // 3. Tạo customer_activity
      await supabase.from("customer_activities").insert({
        customer_id: reassignCustomer.id,
        created_by: user?.id,
        activity_type: "handoff",
        title: reassignType === 'sale' ? "Chia lại khách hàng cho Sale" : "Chia lại khách hàng cho Trưởng Tele",
        content: reassignType === 'sale'
          ? `Chia lại khách hàng cho Sale: ${staffName}`
          : `Chia lại khách hàng cho Trưởng Tele: ${staffName} (Mô hình: ${selectedCareModel === 'tele_owned' ? 'Trưởng Tele phụ trách chính' : 'Tele lọc nhu cầu rồi chuyển Sale'})`
      });

      toast.success(`Đã chia lại khách hàng thành công cho ${staffName}!`);
      setReassignCustomer(null);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi chia lại khách hàng: " + err.message);
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchSearch = (
        (c.name || "") + 
        (c.contact_name || "") + 
        (c.business_name || "") + 
        (c.facility_name || "") + 
        (c.phone || "")
      ).toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [customers, searchQuery]);

  const atRiskCustomers = useMemo(() => filteredCustomers.filter(c => c.ownership_status === 'at_risk'), [filteredCustomers]);
  const reclaimableCustomers = useMemo(() => filteredCustomers.filter(c => c.ownership_status === 'reclaimable'), [filteredCustomers]);
  const freePoolCustomers = useMemo(() => filteredCustomers.filter(c => c.ownership_status === 'free_pool'), [filteredCustomers]);

  const getLifecycleStageLabel = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case "new_lead": return "Lead mới";
      case "consulting": return "Đang tư vấn";
      case "proposal": return "Đã báo giá";
      case "ordered":
      case "won": return "Đã mua hàng";
      case "loyal":
      case "vip": return "Khách VIP";
      default: return stage || "Chưa phân nhóm";
    }
  };

  const getLifecycleStageBadge = (stage: string) => {
    switch (stage?.toLowerCase()) {
      case "new_lead": return "bg-sky-50 text-sky-600 border border-sky-100";
      case "consulting": return "bg-indigo-50 text-indigo-600 border border-indigo-100";
      case "proposal": return "bg-purple-50 text-purple-600 border border-purple-100";
      case "ordered":
      case "won": return "bg-emerald-50 text-emerald-600 border border-emerald-100";
      case "loyal":
      case "vip": return "bg-rose-50 text-rose-600 border border-rose-100";
      default: return "bg-slate-50 text-slate-500 border border-slate-100";
    }
  };

  const availableStaffOptions = useMemo(() => {
    if (!reassignType) return [];
    if (reassignType === 'sale') {
      return staffList.filter(s => s.role === 'sale');
    } else {
      return staffList.filter(s => s.role === 'tele_lead' || s.role === 'telesale');
    }
  }, [staffList, reassignType]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "Chưa có";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: vi });
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200/60 sticky top-0 z-35 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link to="/workspace" className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">Quản lý Thu hồi Khách hàng</h1>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Customer Reclamation Queue
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleScanReclamation} 
              disabled={scanning || busy}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 h-10 shadow-lg shadow-indigo-100 transition-all hover:scale-105 flex items-center gap-2"
            >
              <Zap className={`w-4 h-4 ${scanning ? 'animate-pulse' : ''}`} />
              {scanning ? "Đang quét..." : "Quét khách cần thu hồi"}
            </Button>
            <Button onClick={loadData} variant="ghost" size="icon" className="rounded-xl text-slate-400">
              <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="rounded-[28px] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sắp bị thu hồi</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{customers.filter(c => c.ownership_status === 'at_risk').length}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-amber-50 text-amber-600 border-amber-100">
                <AlertCircle className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cần thu hồi</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{customers.filter(c => c.ownership_status === 'reclaimable').length}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-red-50 text-red-600 border-red-100">
                <AlertTriangle className="w-5 h-5 animate-bounce" />
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-none shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kho khách tự do</p>
                <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{customers.filter(c => c.ownership_status === 'free_pool').length}</h3>
              </div>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center border bg-indigo-50 text-indigo-600 border-indigo-100">
                <Inbox className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[24px] shadow-sm border border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Tìm kiếm khách hàng, cơ sở, SĐT..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 text-xs rounded-xl border-slate-150 bg-slate-50 focus:bg-white transition-all"
            />
          </div>
        </div>

        {/* TABS CONTAINER */}
        <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
          <Tabs defaultValue="at_risk" className="w-full">
            <div className="bg-slate-50/50 border-b border-slate-100 px-8 py-4">
              <TabsList className="bg-slate-100 p-1 h-auto rounded-xl flex w-fit gap-2">
                <TabsTrigger value="at_risk" className="rounded-lg text-xs font-black px-4 py-2 uppercase">
                  ⚠️ Sắp bị thu hồi ({atRiskCustomers.length})
                </TabsTrigger>
                <TabsTrigger value="reclaimable" className="rounded-lg text-xs font-black px-4 py-2 uppercase">
                  🚨 Cần thu hồi ({reclaimableCustomers.length})
                </TabsTrigger>
                <TabsTrigger value="free_pool" className="rounded-lg text-xs font-black px-4 py-2 uppercase">
                  📦 Kho tự do ({freePoolCustomers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="at_risk" className="m-0">
              <CustomersTable 
                items={atRiskCustomers} 
                profilesMap={profilesMap} 
                getLifecycleStageLabel={getLifecycleStageLabel}
                getLifecycleStageBadge={getLifecycleStageBadge}
                formatDate={formatDate}
                busy={busy}
                onReminder={handleSendReminder}
                onExtend={handleExtend3Days}
                onReclaim={openReclaimDialog}
                onReassignSale={(c) => openReassignDialog(c, 'sale')}
                onReassignTele={(c) => openReassignDialog(c, 'tele')}
              />
            </TabsContent>

            <TabsContent value="reclaimable" className="m-0">
              <CustomersTable 
                items={reclaimableCustomers} 
                profilesMap={profilesMap} 
                getLifecycleStageLabel={getLifecycleStageLabel}
                getLifecycleStageBadge={getLifecycleStageBadge}
                formatDate={formatDate}
                busy={busy}
                onReminder={handleSendReminder}
                onExtend={handleExtend3Days}
                onReclaim={openReclaimDialog}
                onReassignSale={(c) => openReassignDialog(c, 'sale')}
                onReassignTele={(c) => openReassignDialog(c, 'tele')}
              />
            </TabsContent>

            <TabsContent value="free_pool" className="m-0">
              <CustomersTable 
                items={freePoolCustomers} 
                profilesMap={profilesMap} 
                getLifecycleStageLabel={getLifecycleStageLabel}
                getLifecycleStageBadge={getLifecycleStageBadge}
                formatDate={formatDate}
                busy={busy}
                isFreePool
                onReminder={handleSendReminder}
                onExtend={handleExtend3Days}
                onReclaim={openReclaimDialog}
                onReassignSale={(c) => openReassignDialog(c, 'sale')}
                onReassignTele={(c) => openReassignDialog(c, 'tele')}
              />
            </TabsContent>
          </Tabs>
        </Card>
      </main>

      {/* SCAN SUMMARY DIALOG */}
      <Dialog open={!!scanSummary} onOpenChange={(o) => !o && setScanSummary(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-[32px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-3 text-base font-black uppercase tracking-tight">
              <Zap className="w-5 h-5 text-indigo-500" /> Kết quả quét hệ thống
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed font-semibold text-slate-500">
              Chi tiết thống kê dữ liệu khách hàng sau khi chạy bộ quy tắc kiểm tra thu hồi tự động.
            </DialogDescription>
          </DialogHeader>

          {scanSummary && (
            <div className="py-6 space-y-3.5">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-600">Tổng số khách đã quét:</span>
                <span className="text-sm font-black text-slate-900">{scanSummary.totalScanned}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-2xl border border-amber-100">
                <span className="text-xs font-bold text-amber-800">Sắp bị thu hồi (At Risk):</span>
                <span className="text-sm font-black text-amber-900">+{scanSummary.atRiskCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-2xl border border-red-100">
                <span className="text-xs font-bold text-red-800">Đủ điều kiện thu hồi (Reclaimable):</span>
                <span className="text-sm font-black text-red-900">+{scanSummary.reclaimableCount}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
                <span className="text-xs font-bold text-indigo-800">Bỏ qua / Bình thường:</span>
                <span className="text-sm font-black text-indigo-900">{scanSummary.ignoredCount}</span>
              </div>
              {scanSummary.errorsCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-rose-50 rounded-2xl border border-rose-100 text-rose-750 font-bold">
                  <span className="text-xs">Số lỗi gặp phải:</span>
                  <span className="text-sm">{scanSummary.errorsCount}</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setScanSummary(null)}
              className="w-full rounded-xl bg-slate-900 hover:bg-black font-black h-12 shadow-lg shadow-slate-200 transition-all hover:scale-105"
            >
              Hoàn thành
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RECLAIM DIALOG */}
      <Dialog open={!!reclaimCustomer} onOpenChange={(o) => !o && setReclaimCustomer(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-3 text-base font-black uppercase tracking-tight text-red-600">
              <AlertTriangle className="w-5 h-5 animate-pulse text-red-650" /> Thu hồi khách hàng
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed font-semibold text-slate-500">
              Bạn đang thực hiện thu hồi khách hàng <strong className="text-slate-950">{reclaimCustomer?.name || reclaimCustomer?.contact_name}</strong> về Kho khách tự do. Hành động này sẽ hủy gán tất cả người phụ trách hiện tại.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Lý do thu hồi (Reclaim Reason)
              </Label>
              <Input 
                placeholder="Nhập lý do thu hồi..." 
                value={reclaimReason}
                onChange={(e) => setReclaimReason(e.target.value)}
                className="h-12 rounded-2xl border-slate-200 text-xs font-bold"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReclaimCustomer(null)} className="rounded-xl font-bold text-slate-400">Hủy bỏ</Button>
            <Button
              onClick={() => handleReclaimToFreePool(reclaimCustomer, reclaimReason)}
              disabled={!reclaimReason.trim()}
              className="rounded-xl bg-red-600 hover:bg-red-750 text-white font-black px-6 h-12 shadow-lg shadow-red-200 transition-all hover:scale-105"
            >
              Thu hồi ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* REASSIGN STAFF DIALOG */}
      <Dialog open={!!reassignCustomer} onOpenChange={(o) => !o && setReassignCustomer(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-3 text-base font-black uppercase tracking-tight">
              <UserPlus className="w-5 h-5 text-indigo-500" /> Phân bổ nhân sự phụ trách
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed font-semibold text-slate-500">
              Chia lại khách hàng <strong className="text-slate-950">{reassignCustomer?.name || reassignCustomer?.contact_name}</strong> cho {reassignType === 'sale' ? 'nhân viên Sale' : 'nhân viên Telesale'} phù hợp để chăm sóc.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Chọn nhân sự phụ trách
              </Label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                  <SelectValue placeholder="Chọn thành viên..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-slate-100">
                  {availableStaffOptions.map(staff => (
                    <SelectItem key={staff.id} value={staff.id} className="rounded-lg text-xs font-bold py-2.5">
                      {staff.display_name} ({staff.email})
                    </SelectItem>
                  ))}
                  {availableStaffOptions.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400 font-semibold">
                      Không tìm thấy nhân sự có vai trò phù hợp
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {reassignType === 'tele' && (
              <div className="space-y-2 pt-2">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Mô hình chăm sóc (Care Model)
                </Label>
                <Select value={selectedCareModel} onValueChange={(val: any) => setSelectedCareModel(val)}>
                  <SelectTrigger className="h-12 rounded-2xl border-slate-200">
                    <SelectValue placeholder="Chọn mô hình..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    <SelectItem value="tele_owned" className="rounded-lg text-xs font-bold py-2.5">
                      Trưởng Tele phụ trách chính (tele_owned)
                    </SelectItem>
                    <SelectItem value="tele_qualified_then_sale" className="rounded-lg text-xs font-bold py-2.5">
                      Tele lọc nhu cầu rồi chuyển Sale (tele_qualified_then_sale)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setReassignCustomer(null)} className="rounded-xl font-bold text-slate-400">Hủy bỏ</Button>
            <Button
              onClick={handleConfirmReassign}
              disabled={!selectedStaffId}
              className="rounded-xl bg-slate-900 hover:bg-black font-black px-6 h-12 shadow-lg shadow-slate-200 transition-all hover:scale-105"
            >
              Phân bổ ngay
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CustomersTableProps {
  items: any[];
  profilesMap: Record<string, string>;
  getLifecycleStageLabel: (stage: string) => string;
  getLifecycleStageBadge: (stage: string) => string;
  formatDate: (d?: string | null) => string;
  busy: boolean;
  isFreePool?: boolean;
  onReminder: (c: any) => void;
  onExtend: (c: any) => void;
  onReclaim: (c: any) => void;
  onReassignSale: (c: any) => void;
  onReassignTele: (c: any) => void;
}

function CustomersTable({
  items,
  profilesMap,
  getLifecycleStageLabel,
  getLifecycleStageBadge,
  formatDate,
  busy,
  isFreePool = false,
  onReminder,
  onExtend,
  onReclaim,
  onReassignSale,
  onReassignTele
}: CustomersTableProps) {
  if (busy) {
    return (
      <div className="py-32 text-center animate-pulse text-slate-400 font-black uppercase text-[10px] tracking-wider">
        Đang đồng bộ dữ liệu khách hàng...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <Inbox className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Danh sách trống</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
            <th className="px-8 py-4 text-left">Khách hàng / Cơ sở</th>
            <th className="px-8 py-4 text-left">Liên hệ</th>
            <th className="px-8 py-4 text-left">Phụ trách</th>
            <th className="px-8 py-4 text-center">Lifecycle</th>
            <th className="px-8 py-4 text-left">Hoạt động cuối</th>
            <th className="px-8 py-4 text-left">Đơn cuối</th>
            <th className="px-8 py-4 text-left">Lý do thu hồi</th>
            <th className="px-8 py-4 text-right">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map(c => {
            const daysSince = getDaysSinceLastInteraction(c);
            const daysFloor = Math.floor(daysSince);
            
            const saleName = c.owner_sale_id ? profilesMap[c.owner_sale_id] : null;
            const teleName = c.owner_tele_id ? profilesMap[c.owner_tele_id] : null;

            return (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-all font-medium text-slate-700">
                <td className="px-8 py-5">
                  <div>
                    <p className="text-xs font-black text-slate-900 leading-snug">{c.name || c.contact_name || "Chủ Spa"}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                      🏢 {c.facility_name || c.business_name || "Cơ sở tự do"}
                    </p>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="text-[11px] font-bold text-slate-600 block">{c.phone || "Chưa cập nhật"}</span>
                </td>
                <td className="px-8 py-5 text-xs">
                  <div className="space-y-1">
                    {saleName && (
                      <p className="text-[10px] font-semibold text-indigo-600 flex items-center gap-1">
                        <span className="font-black bg-indigo-50 px-1.5 py-0.5 rounded text-[8px] uppercase">Sale</span> {saleName}
                      </p>
                    )}
                    {teleName && (
                      <p className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                        <span className="font-black bg-amber-50 px-1.5 py-0.5 rounded text-[8px] uppercase">Tele</span> {teleName}
                      </p>
                    )}
                    {!saleName && !teleName && (
                      <span className="text-[10px] font-bold text-slate-400 italic">Chưa phân bổ</span>
                    )}
                  </div>
                </td>
                <td className="px-8 py-5 text-center">
                  <Badge className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 ${getLifecycleStageBadge(c.lifecycle_stage)}`}>
                    {getLifecycleStageLabel(c.lifecycle_stage)}
                  </Badge>
                </td>
                <td className="px-8 py-5 text-xs">
                  <div>
                    <p className="text-slate-600 font-semibold">{formatDate(c.last_owner_activity_at || c.last_contacted_at)}</p>
                    <Badge className="bg-red-50 text-red-600 border border-red-100 font-black text-[9px] uppercase tracking-wider mt-1 px-1.5 py-0.5">
                      ⏳ {daysFloor} ngày chưa chăm
                    </Badge>
                  </div>
                </td>
                <td className="px-8 py-5 text-xs font-semibold text-slate-500">
                  {c.last_order_at ? format(new Date(c.last_order_at), "dd/MM/yyyy") : "Chưa lên đơn"}
                </td>
                <td className="px-8 py-5 text-xs">
                  <p className="text-red-700 font-bold max-w-xs leading-normal">{c.reclaim_reason || "Lâu ngày chưa chăm sóc."}</p>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex items-center justify-end gap-1.5 flex-wrap max-w-[280px]">
                    {!isFreePool && (
                      <>
                        <Button 
                          onClick={() => onReminder(c)} 
                          variant="outline" 
                          size="sm" 
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide border-slate-200 text-slate-700 hover:bg-slate-50"
                          title="Nhắc nhở Sale/Tele"
                        >
                          Nhắc
                        </Button>
                        <Button 
                          onClick={() => onExtend(c)} 
                          variant="outline" 
                          size="sm" 
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide border-amber-200 text-amber-700 hover:bg-amber-50"
                          title="Gia hạn thêm 3 ngày chăm sóc"
                        >
                          Hạn +3d
                        </Button>
                        <Button 
                          onClick={() => onReclaim(c)} 
                          variant="destructive" 
                          size="sm" 
                          className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide bg-red-600 hover:bg-red-700 text-white"
                          title="Thu hồi ngay về kho tự do"
                        >
                          Thu hồi
                        </Button>
                      </>
                    )}
                    <Button 
                      onClick={() => onReassignSale(c)} 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      title="Giao cho nhân viên Sale"
                    >
                      Chia Sale
                    </Button>
                    <Button 
                      onClick={() => onReassignTele(c)} 
                      variant="outline" 
                      size="sm" 
                      className="h-8 rounded-lg text-[10px] font-black uppercase tracking-wide border-amber-250 text-amber-700 hover:bg-amber-50"
                      title="Giao cho nhân sự Tele"
                    >
                      Chia Tele
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
