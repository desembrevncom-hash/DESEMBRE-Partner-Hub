import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  ShieldAlert, 
  RefreshCw, 
  Save, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/uat")({
  component: UATChecklistPage,
});

type ItemStatus = 'NOT TESTED' | 'PASS' | 'FAIL';

interface ChecklistItem {
  id: string;
  name: string;
  expected: string;
}

interface ChecklistGroup {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface ItemData {
  status: ItemStatus;
  tester: string;
  note: string;
  timestamp: string;
}

interface UATData {
  uatVersion: string;
  updatedAt: string;
  items: Record<string, ItemData>;
}

const CHECKLIST_GROUPS: ChecklistGroup[] = [
  // ── Legacy modules ──
  {
    id: 'customers', name: 'Customers', items: [
      { id: 'customers_crud', name: 'CRUD khách hàng', expected: 'Tạo, sửa, xem, xoá KH hoạt động đúng.' },
      { id: 'customers_search', name: 'Tìm kiếm / lọc', expected: 'Tìm theo tên, phone, email, city, segment.' },
    ]
  },
  {
    id: 'routing', name: 'Routing', items: [
      { id: 'routing_assign', name: 'Phân tuyến KH', expected: 'Admin phân KH cho Sale đúng.' },
    ]
  },
  {
    id: 'map_checkin', name: 'Map Check-in', items: [
      { id: 'map_display', name: 'Bản đồ hiển thị', expected: 'Bản đồ load, pin KH hiển thị đúng vị trí.' },
    ]
  },
  {
    id: 'automation', name: 'Automation', items: [
      { id: 'automation_rules', name: 'Automation Rules', expected: 'Tạo, sửa, bật/tắt rule.' },
    ]
  },
  {
    id: 'ai_rag', name: 'AI RAG', items: [
      { id: 'ai_rag_query', name: 'RAG query', expected: 'Hỏi đáp tri thức sản phẩm trả kết quả.' },
    ]
  },
  {
    id: 'product_knowledge', name: 'Product Knowledge QA', items: [
      { id: 'pk_embed', name: 'Embed Knowledge', expected: 'Upload và embed tài liệu sản phẩm.' },
    ]
  },
  {
    id: 'notifications', name: 'Notifications', items: [
      { id: 'notif_display', name: 'Hiển thị notification', expected: 'Notification hiện đúng, đếm badge đúng.' },
    ]
  },
  {
    id: 'permissions', name: 'Permissions', items: [
      { id: 'perm_role', name: 'Phân quyền role', expected: 'Admin/SubAdmin/Sale/TeleLead/Telesale có đúng quyền.' },
    ]
  },
  {
    id: 'tasks', name: 'Tasks', items: [
      { id: 'tasks_crud', name: 'CRUD tasks', expected: 'Tạo, sửa, hoàn tất task.' },
    ]
  },
  {
    id: 'orders', name: 'Orders', items: [
      { id: 'orders_crud', name: 'CRUD orders', expected: 'Tạo, sửa, xem đơn hàng.' },
    ]
  },

  // ── New modules ──
  {
    id: 'communication_accounts', name: 'A. Communication Accounts', items: [
      { id: 'ca_access', name: 'Quyền truy cập /settings/communication', expected: 'Admin/Sale vào được đúng quyền.' },
      { id: 'ca_add', name: 'Sale thêm account', expected: 'Thêm Zalo/Facebook/Email/Phone/TikTok thành công.' },
      { id: 'ca_default', name: 'Chọn default account', expected: 'Sale chọn default theo từng platform.' },
      { id: 'ca_isolation', name: 'Cô lập dữ liệu Sale', expected: 'Sale không xem/sửa account của Sale khác.' },
      { id: 'ca_admin_gov', name: 'Admin governance', expected: 'Admin xem governance/usage account nếu có.' },
    ]
  },
  {
    id: 'smart_launcher', name: 'B. Smart Launcher', items: [
      { id: 'sl_call', name: 'Call launcher', expected: 'Customer có phone → Call mở tel: link.' },
      { id: 'sl_zalo', name: 'Zalo launcher', expected: 'Customer có Zalo → mở đúng link zalo.me.' },
      { id: 'sl_facebook', name: 'Facebook launcher', expected: 'Customer có Facebook → mở đúng link m.me.' },
      { id: 'sl_missing', name: 'Thiếu channel', expected: 'UI báo thiếu channel rõ ràng (disabled/greyed).' },
      { id: 'sl_comm_off', name: 'Communication OS = off', expected: 'Launcher bị disabled/ẩn hoàn toàn.' },
    ]
  },
  {
    id: 'message_templates', name: 'C. Message Templates', items: [
      { id: 'mt_admin_create', name: 'Admin tạo shared template', expected: 'Tạo template shared thành công.' },
      { id: 'mt_sale_view', name: 'Sale thấy shared template', expected: 'Sale nhìn thấy template shared trong picker.' },
      { id: 'mt_sale_private', name: 'Sale tạo private template', expected: 'Sale tạo template private thành công.' },
      { id: 'mt_isolation', name: 'Cô lập private template', expected: 'Sale khác không thấy private template.' },
      { id: 'mt_platform_all', name: 'Chặn platform=all cho Sale', expected: 'Sale không tạo được platform=all.' },
      { id: 'mt_copy_open', name: 'Copy & Open App', expected: 'Copy nội dung và mở app hoạt động.' },
      { id: 'mt_off', name: 'Message Templates = off', expected: 'Template picker ẩn trong launcher dialog.' },
    ]
  },
  {
    id: 'interaction_tracking', name: 'D. Interaction Tracking', items: [
      { id: 'it_copy_open', name: 'Copy & Open tạo interaction', expected: 'Tạo row trong customer_interactions.' },
      { id: 'it_copy_save', name: 'Copy & Save Log', expected: 'Tạo result=copied trong interactions.' },
      { id: 'it_no_dup', name: 'Không duplicate', expected: 'Timeline chỉ hiện 1 dòng, không trùng.' },
      { id: 'it_off', name: 'Interaction Tracking = off', expected: 'Launcher mở nhưng không insert interaction.' },
      { id: 'it_admin_view', name: 'Admin xem toàn bộ', expected: 'Admin xem được toàn bộ interaction.' },
      { id: 'it_sale_iso', name: 'Sale cô lập metadata', expected: 'Sale không thấy private account metadata Sale khác.' },
    ]
  },
  {
    id: 'ai_suggestion', name: 'E. AI Suggestion', items: [
      { id: 'ais_disabled', name: 'AI disabled → chặn', expected: 'AI globally off → tạo gợi ý bị chặn an toàn.' },
      { id: 'ais_pilot_off', name: 'Pilot module off → chặn', expected: 'AI enabled nhưng pilot module off → bị chặn.' },
      { id: 'ais_admin_only', name: 'admin_only → phân quyền', expected: 'Admin dùng được, Sale bị chặn.' },
      { id: 'ais_pilot_only', name: 'pilot_only → phân quyền', expected: 'Pilot user dùng được, non-pilot bị chặn.' },
      { id: 'ais_json', name: 'Output JSON đúng field', expected: 'Response có next_best_action, risk_flags, confidence.' },
      { id: 'ais_use_action', name: 'Use Action mở Launcher', expected: 'Nhấn Use Action mở Smart Launcher, không auto gửi.' },
      { id: 'ais_status', name: 'Dismiss/Accept cập nhật', expected: 'Dismiss → status=dismissed, Accept → status=accepted.' },
    ]
  },
  {
    id: 'automation_governance', name: 'F. Automation Governance', items: [
      { id: 'ag_safe_mode', name: 'Safe Mode hiển thị', expected: 'Production Safe Mode hiển thị đúng trạng thái.' },
      { id: 'ag_auto_off', name: 'automation_enabled=false', expected: 'Run Rule không tạo task.' },
      { id: 'ag_due_off', name: 'due_generator_enabled=false', expected: 'Due Generator return no-op.' },
      { id: 'ag_notif_off', name: 'notification_enabled=false', expected: 'create_notification_safe trả no-op reason.' },
      { id: 'ag_emergency', name: 'Emergency Stop', expected: 'Tắt automation + due, giữ notification.' },
      { id: 'ag_hub_status', name: 'Admin Hub trạng thái thật', expected: 'Card Automation hiển thị đúng ON/OFF.' },
    ]
  },
  {
    id: 'pilot_mode_rollout', name: 'G. Pilot Mode Rollout', items: [
      { id: 'pm_modules', name: '6 module mới', expected: '/admin/pilot hiển thị đủ 6 module mới.' },
      { id: 'pm_sale_block', name: 'Sale không sửa settings', expected: 'Sale không sửa được pilot settings.' },
      { id: 'pm_comm_off', name: 'communication_os=off', expected: 'Quick Launcher bị disabled.' },
      { id: 'pm_tpl_off', name: 'message_templates=off', expected: 'Template picker ẩn.' },
      { id: 'pm_track_off', name: 'interaction_tracking=off', expected: 'Không ghi customer_interactions.' },
      { id: 'pm_due_off', name: 'due_generator=off', expected: 'generate_due_notifications return no-op.' },
      { id: 'pm_hub_stats', name: 'Admin Hub thống kê', expected: 'Đúng số module On/Pilot/Admin/Off.' },
    ]
  },
  {
    id: 'admin_control_hub', name: 'H. Admin Control Hub', items: [
      { id: 'ach_access', name: 'Admin/SubAdmin thấy Hub', expected: 'Admin/SubAdmin truy cập Admin Hub thành công.' },
      { id: 'ach_sale_block', name: 'Sale không vào được', expected: 'Sale không thấy menu và bị chặn route.' },
      { id: 'ach_ai_card', name: 'AI Control card', expected: 'Đọc trạng thái thật từ DB (ai_enabled, limit...).' },
      { id: 'ach_auto_card', name: 'Automation Control card', expected: 'Đọc trạng thái thật từ DB (pilot, auto, due...).' },
      { id: 'ach_no_404', name: 'Không link 404', expected: 'Tất cả link trong Hub dẫn đúng trang.' },
    ]
  },
];

const ALL_ITEMS = CHECKLIST_GROUPS.flatMap(g => g.items);

const DEFAULT_DATA: UATData = {
  uatVersion: "2026-05-v2",
  updatedAt: new Date().toISOString(),
  items: {}
};

ALL_ITEMS.forEach(item => {
  DEFAULT_DATA.items[item.id] = { status: 'NOT TESTED', tester: '', note: '', timestamp: '' };
});

function UATChecklistPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<UATData>(DEFAULT_DATA);
  const [hasChanges, setHasChanges] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem("uatChecklist_v2");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_DATA, ...parsed, items: { ...DEFAULT_DATA.items, ...(parsed.items || {}) } };
        setData(merged);
      } catch (e) {
        console.error("Failed to parse UAT checklist", e);
      }
    } else {
      // Migrate from v1 if exists
      const v1 = localStorage.getItem("uatChecklist");
      if (v1) {
        try {
          const parsed = JSON.parse(v1);
          // Map old module-level statuses to new item IDs where possible
          const migratedItems: Record<string, ItemData> = { ...DEFAULT_DATA.items };
          if (parsed.modules) {
            for (const [oldKey, oldVal] of Object.entries(parsed.modules)) {
              const group = CHECKLIST_GROUPS.find(g => g.id === oldKey);
              if (group && group.items.length > 0) {
                // Apply old module status to first item of that group
                migratedItems[group.items[0].id] = oldVal as ItemData;
              }
            }
          }
          setData({ ...DEFAULT_DATA, items: migratedItems });
        } catch (e) { /* ignore */ }
      } else {
        setData(DEFAULT_DATA);
      }
    }
  }, []);

  const isAuthorized = isAdmin || isSubAdmin;

  const handleItemChange = (id: string, field: keyof ItemData, value: string) => {
    setData(prev => ({
      ...prev,
      items: {
        ...prev.items,
        [id]: {
          ...(prev.items[id] || { status: 'NOT TESTED', tester: '', note: '', timestamp: '' }),
          [field]: value,
          timestamp: new Date().toISOString()
        }
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    for (const item of ALL_ITEMS) {
      const d = data.items[item.id];
      if (!d) continue;
      if ((d.status === 'PASS' || d.status === 'FAIL') && !d.tester.trim()) {
        toast.error(`Vui lòng nhập tên Tester cho: ${item.name}`);
        return;
      }
      if (d.status === 'FAIL' && !d.note.trim()) {
        toast.error(`Vui lòng nhập Ghi chú cho lỗi: ${item.name}`);
        return;
      }
    }

    const toSave = { ...data, updatedAt: new Date().toISOString() };
    localStorage.setItem("uatChecklist_v2", JSON.stringify(toSave));
    setData(toSave);
    setHasChanges(false);
    toast.success("Đã lưu kết quả UAT Checklist thành công!");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uat-checklist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file JSON");
  };

  const handleReset = () => {
    if (window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu test không? Hành động này không thể hoàn tác!")) {
      localStorage.removeItem("uatChecklist_v2");
      setData(DEFAULT_DATA);
      setHasChanges(false);
      toast.success("Đã reset toàn bộ checklist");
    }
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const summary = useMemo(() => {
    const total = ALL_ITEMS.length;
    let pass = 0, fail = 0, notTested = 0;
    for (const item of ALL_ITEMS) {
      const d = data.items[item.id];
      if (d?.status === 'PASS') pass++;
      else if (d?.status === 'FAIL') fail++;
      else notTested++;
    }
    const completion = total > 0 ? Math.round(((pass + fail) / total) * 100) : 0;
    return { total, pass, fail, notTested, completion };
  }, [data]);

  const getGroupSummary = (group: ChecklistGroup) => {
    let pass = 0, fail = 0, notTested = 0;
    for (const item of group.items) {
      const d = data.items[item.id];
      if (d?.status === 'PASS') pass++;
      else if (d?.status === 'FAIL') fail++;
      else notTested++;
    }
    return { pass, fail, notTested, total: group.items.length };
  };

  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">Tính năng UAT Checklist chỉ dành cho Administrator.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-indigo-600" />
            UAT Acceptance Checklist
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Nghiệm thu nội bộ — {ALL_ITEMS.length} items / {CHECKLIST_GROUPS.length} groups. Version: {data.uatVersion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl">
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
          <Button variant="outline" onClick={handleExport} className="rounded-xl border-slate-200">
            <Download className="w-4 h-4 mr-2" /> Export JSON
          </Button>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 relative">
            <Save className="w-4 h-4 mr-2" /> Save Changes
            {hasChanges && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="shadow-none border-slate-200 bg-white">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-slate-800">{summary.total}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Total Items</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-emerald-100 bg-emerald-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-emerald-600">{summary.pass}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mt-1">Passed</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-rose-100 bg-rose-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-rose-600">{summary.fail}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70 mt-1">Failed</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-amber-100 bg-amber-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-amber-600">{summary.notTested}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 mt-1">Not Tested</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-indigo-100 bg-indigo-50/50 relative overflow-hidden">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center z-10 relative">
            <span className="text-3xl font-black text-indigo-600">{summary.completion}%</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/70 mt-1">Completion</span>
          </CardContent>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000" 
            style={{ width: `${summary.completion}%` }} 
          />
        </Card>
      </div>

      {/* Checklist Groups */}
      <div className="space-y-4">
        {CHECKLIST_GROUPS.map(group => {
          const gs = getGroupSummary(group);
          const isCollapsed = collapsedGroups[group.id];
          const allPassed = gs.pass === gs.total;
          const hasFails = gs.fail > 0;

          return (
            <div key={group.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between p-4 bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed 
                    ? <ChevronRight className="w-4 h-4 text-slate-400" /> 
                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  <span className="text-sm font-bold text-slate-800">{group.name}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {group.items.length} items
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {gs.pass > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-700 rounded-full">
                      {gs.pass} PASS
                    </span>
                  )}
                  {gs.fail > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-700 rounded-full">
                      {gs.fail} FAIL
                    </span>
                  )}
                  {gs.notTested > 0 && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-500 rounded-full">
                      {gs.notTested} PENDING
                    </span>
                  )}
                  {allPassed && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {hasFails && (
                    <XCircle className="w-5 h-5 text-rose-500" />
                  )}
                </div>
              </button>

              {/* Group Items */}
              {!isCollapsed && (
                <div className="divide-y divide-slate-100">
                  {/* Table Header */}
                  <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <div className="col-span-3">Test Case</div>
                    <div className="col-span-3">Expected Result</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2">Tester</div>
                    <div className="col-span-2">Notes</div>
                    <div className="col-span-1 text-right">Updated</div>
                  </div>
                  
                  {group.items.map(item => {
                    const d = data.items[item.id] || { status: 'NOT TESTED', tester: '', note: '', timestamp: '' };
                    const isPassed = d.status === 'PASS';
                    const isFailed = d.status === 'FAIL';
                    const isUntested = d.status === 'NOT TESTED';

                    return (
                      <div key={item.id} className={`grid grid-cols-12 gap-3 px-4 py-3 items-start hover:bg-slate-50/50 transition-colors ${isFailed ? 'bg-rose-50/30' : ''}`}>
                        {/* Test Case Name */}
                        <div className="col-span-3 flex items-start gap-2">
                          {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
                          {isFailed && <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />}
                          {isUntested && <HelpCircle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />}
                          <span className="text-sm font-semibold text-slate-800">{item.name}</span>
                        </div>

                        {/* Expected */}
                        <div className="col-span-3 text-xs text-slate-500 leading-relaxed">
                          {item.expected}
                        </div>

                        {/* Status */}
                        <div className="col-span-1">
                          <select 
                            className={`w-full p-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border outline-none transition-all
                              ${isPassed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                isFailed ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                                'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                            value={d.status}
                            onChange={(e) => handleItemChange(item.id, 'status', e.target.value)}
                          >
                            <option value="NOT TESTED">—</option>
                            <option value="PASS">PASS</option>
                            <option value="FAIL">FAIL</option>
                          </select>
                        </div>

                        {/* Tester */}
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="Tester..."
                            className="w-full p-1.5 px-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-500 outline-none transition-all bg-transparent"
                            value={d.tester}
                            onChange={(e) => handleItemChange(item.id, 'tester', e.target.value)}
                          />
                          {(isPassed || isFailed) && !d.tester.trim() && (
                            <span className="text-[9px] text-rose-500 font-bold mt-0.5 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Required
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        <div className="col-span-2">
                          <input 
                            type="text" 
                            placeholder="Ghi chú..."
                            className="w-full p-1.5 px-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-500 outline-none transition-all bg-transparent"
                            value={d.note}
                            onChange={(e) => handleItemChange(item.id, 'note', e.target.value)}
                          />
                          {isFailed && !d.note.trim() && (
                            <span className="text-[9px] text-rose-500 font-bold mt-0.5 flex items-center gap-0.5">
                              <AlertTriangle className="w-2.5 h-2.5" /> Required
                            </span>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="col-span-1 text-right text-[10px] font-medium text-slate-400">
                          {d.timestamp ? new Date(d.timestamp).toLocaleDateString('vi-VN') : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="mt-6 flex justify-between items-center text-xs text-slate-400 font-medium">
        <p>Lưu trữ nội bộ: localStorage. Cập nhật lần cuối: {new Date(data.updatedAt).toLocaleString('vi-VN')}</p>
        <p>Phase B — Pre-Production UAT</p>
      </div>
    </div>
  );
}
