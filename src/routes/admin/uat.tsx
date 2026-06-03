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
  ChevronRight,
  ClipboardCopy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/uat")({
  component: UATChecklistPage,
});

type ItemStatus = "NOT TESTED" | "PASS" | "FAIL";

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
  evidence?: string;
  timestamp: string;
}

interface UATData {
  uatVersion: string;
  updatedAt: string;
  items: Record<string, ItemData>;
}

const LEGACY_CHECKLIST_GROUPS: ChecklistGroup[] = [
  // ── Legacy modules ──
  {
    id: "customers",
    name: "Customers",
    items: [
      {
        id: "customers_crud",
        name: "CRUD khách hàng",
        expected: "Tạo, sửa, xem, xoá KH hoạt động đúng.",
      },
      {
        id: "customers_search",
        name: "Tìm kiếm / lọc",
        expected: "Tìm theo tên, phone, email, city, segment.",
      },
    ],
  },
  {
    id: "routing",
    name: "Routing",
    items: [
      { id: "routing_assign", name: "Phân tuyến KH", expected: "Admin phân KH cho Sale đúng." },
    ],
  },
  {
    id: "map_checkin",
    name: "Map Check-in",
    items: [
      {
        id: "map_display",
        name: "Bản đồ hiển thị",
        expected: "Bản đồ load, pin KH hiển thị đúng vị trí.",
      },
    ],
  },
  {
    id: "automation",
    name: "Automation",
    items: [
      { id: "automation_rules", name: "Automation Rules", expected: "Tạo, sửa, bật/tắt rule." },
    ],
  },
  {
    id: "ai_rag",
    name: "AI RAG",
    items: [
      { id: "ai_rag_query", name: "RAG query", expected: "Hỏi đáp tri thức sản phẩm trả kết quả." },
    ],
  },
  {
    id: "product_knowledge",
    name: "Product Knowledge QA",
    items: [
      { id: "pk_embed", name: "Embed Knowledge", expected: "Upload và embed tài liệu sản phẩm." },
    ],
  },
  {
    id: "notifications",
    name: "Notifications",
    items: [
      {
        id: "notif_display",
        name: "Hiển thị notification",
        expected: "Notification hiện đúng, đếm badge đúng.",
      },
    ],
  },
  {
    id: "permissions",
    name: "Permissions",
    items: [
      {
        id: "perm_role",
        name: "Phân quyền role",
        expected: "Admin/SubAdmin/Sale/TeleLead/Telesale có đúng quyền.",
      },
    ],
  },
  {
    id: "tasks",
    name: "Tasks",
    items: [{ id: "tasks_crud", name: "CRUD tasks", expected: "Tạo, sửa, hoàn tất task." }],
  },
  {
    id: "orders",
    name: "Orders",
    items: [{ id: "orders_crud", name: "CRUD orders", expected: "Tạo, sửa, xem đơn hàng." }],
  },

  // ── New modules ──
  {
    id: "communication_accounts",
    name: "A. Communication Accounts",
    items: [
      {
        id: "ca_access",
        name: "Quyền truy cập /settings/communication",
        expected: "Admin/Sale vào được đúng quyền.",
      },
      {
        id: "ca_add",
        name: "Sale thêm account",
        expected: "Thêm Zalo/Facebook/Email/Phone/TikTok thành công.",
      },
      {
        id: "ca_default",
        name: "Chọn default account",
        expected: "Sale chọn default theo từng platform.",
      },
      {
        id: "ca_isolation",
        name: "Cô lập dữ liệu Sale",
        expected: "Sale không xem/sửa account của Sale khác.",
      },
      {
        id: "ca_admin_gov",
        name: "Admin governance",
        expected: "Admin xem governance/usage account nếu có.",
      },
    ],
  },
  {
    id: "smart_launcher",
    name: "B. Smart Launcher",
    items: [
      { id: "sl_call", name: "Call launcher", expected: "Customer có phone → Call mở tel: link." },
      {
        id: "sl_zalo",
        name: "Zalo launcher",
        expected: "Customer có Zalo → mở đúng link zalo.me.",
      },
      {
        id: "sl_facebook",
        name: "Facebook launcher",
        expected: "Customer có Facebook → mở đúng link m.me.",
      },
      {
        id: "sl_missing",
        name: "Thiếu channel",
        expected: "UI báo thiếu channel rõ ràng (disabled/greyed).",
      },
      {
        id: "sl_comm_off",
        name: "Communication OS = off",
        expected: "Launcher bị disabled/ẩn hoàn toàn.",
      },
    ],
  },
  {
    id: "message_templates",
    name: "C. Message Templates",
    items: [
      {
        id: "mt_admin_create",
        name: "Admin tạo shared template",
        expected: "Tạo template shared thành công.",
      },
      {
        id: "mt_sale_view",
        name: "Sale thấy shared template",
        expected: "Sale nhìn thấy template shared trong picker.",
      },
      {
        id: "mt_sale_private",
        name: "Sale tạo private template",
        expected: "Sale tạo template private thành công.",
      },
      {
        id: "mt_isolation",
        name: "Cô lập private template",
        expected: "Sale khác không thấy private template.",
      },
      {
        id: "mt_platform_all",
        name: "Chặn platform=all cho Sale",
        expected: "Sale không tạo được platform=all.",
      },
      {
        id: "mt_copy_open",
        name: "Copy & Open App",
        expected: "Copy nội dung và mở app hoạt động.",
      },
      {
        id: "mt_off",
        name: "Message Templates = off",
        expected: "Template picker ẩn trong launcher dialog.",
      },
    ],
  },
  {
    id: "interaction_tracking",
    name: "D. Interaction Tracking",
    items: [
      {
        id: "it_copy_open",
        name: "Copy & Open tạo interaction",
        expected: "Tạo row trong customer_interactions.",
      },
      {
        id: "it_copy_save",
        name: "Copy & Save Log",
        expected: "Tạo result=copied trong interactions.",
      },
      {
        id: "it_no_dup",
        name: "Không duplicate",
        expected: "Timeline chỉ hiện 1 dòng, không trùng.",
      },
      {
        id: "it_off",
        name: "Interaction Tracking = off",
        expected: "Launcher mở nhưng không insert interaction.",
      },
      {
        id: "it_admin_view",
        name: "Admin xem toàn bộ",
        expected: "Admin xem được toàn bộ interaction.",
      },
      {
        id: "it_sale_iso",
        name: "Sale cô lập metadata",
        expected: "Sale không thấy private account metadata Sale khác.",
      },
    ],
  },
  {
    id: "ai_suggestion",
    name: "E. AI Suggestion",
    items: [
      {
        id: "ais_disabled",
        name: "AI disabled → chặn",
        expected: "AI globally off → tạo gợi ý bị chặn an toàn.",
      },
      {
        id: "ais_pilot_off",
        name: "Pilot module off → chặn",
        expected: "AI enabled nhưng pilot module off → bị chặn.",
      },
      {
        id: "ais_admin_only",
        name: "admin_only → phân quyền",
        expected: "Admin dùng được, Sale bị chặn.",
      },
      {
        id: "ais_pilot_only",
        name: "pilot_only → phân quyền",
        expected: "Pilot user dùng được, non-pilot bị chặn.",
      },
      {
        id: "ais_json",
        name: "Output JSON đúng field",
        expected: "Response có next_best_action, risk_flags, confidence.",
      },
      {
        id: "ais_use_action",
        name: "Use Action mở Launcher",
        expected: "Nhấn Use Action mở Smart Launcher, không auto gửi.",
      },
      {
        id: "ais_status",
        name: "Dismiss/Accept cập nhật",
        expected: "Dismiss → status=dismissed, Accept → status=accepted.",
      },
    ],
  },
  {
    id: "automation_governance",
    name: "F. Automation Governance",
    items: [
      {
        id: "ag_safe_mode",
        name: "Safe Mode hiển thị",
        expected: "Production Safe Mode hiển thị đúng trạng thái.",
      },
      { id: "ag_auto_off", name: "automation_enabled=false", expected: "Run Rule không tạo task." },
      {
        id: "ag_due_off",
        name: "due_generator_enabled=false",
        expected: "Due Generator return no-op.",
      },
      {
        id: "ag_notif_off",
        name: "notification_enabled=false",
        expected: "create_notification_safe trả no-op reason.",
      },
      {
        id: "ag_emergency",
        name: "Emergency Stop",
        expected: "Tắt automation + due, giữ notification.",
      },
      {
        id: "ag_hub_status",
        name: "Admin Hub trạng thái thật",
        expected: "Card Automation hiển thị đúng ON/OFF.",
      },
    ],
  },
  {
    id: "pilot_mode_rollout",
    name: "G. Pilot Mode Rollout",
    items: [
      {
        id: "pm_modules",
        name: "6 module mới",
        expected: "/admin/pilot hiển thị đủ 6 module mới.",
      },
      {
        id: "pm_sale_block",
        name: "Sale không sửa settings",
        expected: "Sale không sửa được pilot settings.",
      },
      { id: "pm_comm_off", name: "communication_os=off", expected: "Quick Launcher bị disabled." },
      { id: "pm_tpl_off", name: "message_templates=off", expected: "Template picker ẩn." },
      {
        id: "pm_track_off",
        name: "interaction_tracking=off",
        expected: "Không ghi customer_interactions.",
      },
      {
        id: "pm_due_off",
        name: "due_generator=off",
        expected: "generate_due_notifications return no-op.",
      },
      {
        id: "pm_hub_stats",
        name: "Admin Hub thống kê",
        expected: "Đúng số module On/Pilot/Admin/Off.",
      },
    ],
  },
  {
    id: "admin_control_hub",
    name: "H. Admin Control Hub",
    items: [
      {
        id: "ach_access",
        name: "Admin/SubAdmin thấy Hub",
        expected: "Admin/SubAdmin truy cập Admin Hub thành công.",
      },
      {
        id: "ach_sale_block",
        name: "Sale không vào được",
        expected: "Sale không thấy menu và bị chặn route.",
      },
      {
        id: "ach_ai_card",
        name: "AI Control card",
        expected: "Đọc trạng thái thật từ DB (ai_enabled, limit...).",
      },
      {
        id: "ach_auto_card",
        name: "Automation Control card",
        expected: "Đọc trạng thái thật từ DB (pilot, auto, due...).",
      },
      {
        id: "ach_no_404",
        name: "Không link 404",
        expected: "Tất cả link trong Hub dẫn đúng trang.",
      },
    ],
  },
];
const ALL_LEGACY_ITEMS = LEGACY_CHECKLIST_GROUPS.flatMap((g) => g.items);

const CHECKLIST_GROUPS_V1_0_0B: ChecklistGroup[] = [
  {
    id: "admin_route_smoke",
    name: "1. Admin Route Smoke",
    items: [
      { id: "rs_workspace", name: "/workspace load được", expected: "Load nhanh, không lỗi 500" },
      { id: "rs_customers", name: "/customers load được", expected: "Load danh sách khách hàng" },
      { id: "rs_products", name: "/products load được", expected: "Load danh mục sản phẩm" },
      { id: "rs_orders", name: "/orders load được", expected: "Load danh sách đơn hàng" },
      { id: "rs_calendar", name: "/calendar load được", expected: "Load lịch làm việc" },
      { id: "rs_marketing", name: "/marketing load được", expected: "Load dashboard marketing" },
      { id: "rs_admin", name: "/admin load được", expected: "Load Admin Hub" },
    ],
  },
  {
    id: "sale_tele_perm",
    name: "2. Sale/Tele Permission Smoke",
    items: [
      {
        id: "perm_admin",
        name: "Sale/Tele không vào /admin",
        expected: "Chặn truy cập 403 / Redirect",
      },
      {
        id: "perm_sender",
        name: "Sale/Tele không vào Sender Accounts",
        expected: "Không truy cập được config",
      },
      {
        id: "perm_cust",
        name: "Sale/Tele chỉ thấy customers thuộc quyền",
        expected: "RLS hoạt động, không thấy khách của người khác",
      },
      {
        id: "perm_mkt",
        name: "Sale/Tele không chạy marketing",
        expected: "Không có quyền send campaign",
      },
    ],
  },
  {
    id: "provider_safety",
    name: "3. Provider Safety",
    items: [
      {
        id: "ps_audience",
        name: "Marketing Send to Audience locked",
        expected: "Nút Send bị xám/disabled",
      },
      { id: "ps_zns", name: "Không gọi ZNS", expected: "Luồng Zalo trả về lỗi hoặc chạy Sandbox" },
      {
        id: "ps_email",
        name: "Không gửi production email",
        expected: "Send test chỉ nhận email whitelist",
      },
      {
        id: "ps_gcal",
        name: "Calendar không gửi GCal invite nếu không tick",
        expected: "Không gọi Google API",
      },
    ],
  },
  {
    id: "external_watch",
    name: "4. External Provider Watch",
    items: [
      {
        id: "ew_gcal",
        name: "Không có GCal invite tự động",
        expected: "Kiểm tra network tab: Clean",
      },
      {
        id: "ew_resend",
        name: "Không gọi Resend production",
        expected: "Network tab không có request",
      },
      { id: "ew_zns", name: "Không gọi ZNS", expected: "Network tab không có request ZNS" },
      {
        id: "ew_ai",
        name: "Không gọi AI khi chưa bấm Generate",
        expected: "Network sạch khi load form",
      },
      {
        id: "ew_secret",
        name: "Không có token/secret trong Network",
        expected: "Responses không chứa credential thô",
      },
    ],
  },
  {
    id: "admin_hub_safety",
    name: "5. Admin Hub Safety",
    items: [
      { id: "ahs_ai", name: "AI toggle không tự gọi provider", expected: "Bật/tắt chỉ lưu DB" },
      {
        id: "ahs_auto",
        name: "Automation toggle an toàn",
        expected: "Không tự bật/trigger job ngoài ý muốn",
      },
      {
        id: "ahs_flags",
        name: "Feature flag lưu chính xác",
        expected: "Lưu đúng giá trị, không đổi cờ khác",
      },
      {
        id: "ahs_warn",
        name: "Có warning trước toggle nguy hiểm",
        expected: "Hiển thị modal/confirm dialog",
      },
    ],
  },
  {
    id: "data_integrity",
    name: "6. Data Integrity",
    items: [
      { id: "di_cust", name: "Customer detail mở được", expected: "Data hiển thị đúng" },
      { id: "di_prod", name: "Product catalog mở được", expected: "Data hiển thị đúng" },
      { id: "di_order", name: "Order detail mở được", expected: "Data hiển thị đúng" },
      { id: "di_cal", name: "Calendar event mở được", expected: "Data hiển thị đúng" },
      { id: "di_logs", name: "Logs không lộ secret", expected: "Delivery Logs không chứa token" },
    ],
  },
  {
    id: "perf",
    name: "7. Performance",
    items: [
      { id: "pf_load", name: "Các Route load < 3s", expected: "Tốc độ load ổn định" },
      { id: "pf_err", name: "Console không có error đỏ", expected: "Sạch lỗi crash" },
      {
        id: "pf_401",
        name: "Không có 401/403 bất thường",
        expected: "Network không bị chặn vô cớ",
      },
      {
        id: "pf_req",
        name: "Network provider request hợp lý",
        expected: "Chỉ call khi user action",
      },
    ],
  },
];

const ALL_V1_0_0B_ITEMS = CHECKLIST_GROUPS_V1_0_0B.flatMap((g) => g.items);

const DEFAULT_LEGACY_DATA: UATData = {
  uatVersion: "2026-05-v2",
  updatedAt: new Date().toISOString(),
  items: {},
};
ALL_LEGACY_ITEMS.forEach((item) => {
  DEFAULT_LEGACY_DATA.items[item.id] = {
    status: "NOT TESTED",
    tester: "",
    note: "",
    timestamp: "",
  };
});

const DEFAULT_V1_DATA: UATData = {
  uatVersion: "v1.0.0B",
  updatedAt: new Date().toISOString(),
  items: {},
};
ALL_V1_0_0B_ITEMS.forEach((item) => {
  DEFAULT_V1_DATA.items[item.id] = {
    status: "NOT TESTED",
    tester: "",
    note: "",
    evidence: "",
    timestamp: "",
  };
});

function UATChecklistPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("v1.0.0B");

  const [legacyData, setLegacyData] = useState<UATData>(DEFAULT_LEGACY_DATA);
  const [v1Data, setV1Data] = useState<UATData>(DEFAULT_V1_DATA);

  const [hasLegacyChanges, setHasLegacyChanges] = useState(false);
  const [hasV1Changes, setHasV1Changes] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Load Legacy Data
    const storedLegacy = localStorage.getItem("uatChecklist_v2");
    if (storedLegacy) {
      try {
        const parsed = JSON.parse(storedLegacy);
        const merged = {
          ...DEFAULT_LEGACY_DATA,
          ...parsed,
          items: { ...DEFAULT_LEGACY_DATA.items, ...(parsed.items || {}) },
        };
        setLegacyData(merged);
      } catch (e) {
        console.error("Failed to parse Legacy UAT checklist", e);
      }
    }

    // Load v1.0.0B Data
    const storedV1 = localStorage.getItem("desembre:uat:v1.0.0B:smoke-test");
    if (storedV1) {
      try {
        const parsed = JSON.parse(storedV1);
        const merged = {
          ...DEFAULT_V1_DATA,
          ...parsed,
          items: { ...DEFAULT_V1_DATA.items, ...(parsed.items || {}) },
        };
        setV1Data(merged);
      } catch (e) {
        console.error("Failed to parse v1.0.0B checklist", e);
      }
    }
  }, []);

  const isAuthorized = isAdmin || isSubAdmin;

  // Render logic for Checklist
  const renderChecklist = (
    groups: ChecklistGroup[],
    data: UATData,
    setData: React.Dispatch<React.SetStateAction<UATData>>,
    setHasChanges: React.Dispatch<React.SetStateAction<boolean>>,
    storageKey: string,
    hasChanges: boolean,
    isV1: boolean,
  ) => {
    const handleItemChange = (id: string, field: keyof ItemData, value: string) => {
      setData((prev) => ({
        ...prev,
        items: {
          ...prev.items,
          [id]: {
            ...(prev.items[id] || {
              status: "NOT TESTED",
              tester: "",
              note: "",
              evidence: "",
              timestamp: "",
            }),
            [field]: value,
            timestamp: new Date().toISOString(),
          },
        },
      }));
      setHasChanges(true);
    };

    const handleSave = () => {
      const allItems = groups.flatMap((g) => g.items);
      for (const item of allItems) {
        const d = data.items[item.id];
        if (!d) continue;
        if ((d.status === "PASS" || d.status === "FAIL") && !d.tester.trim()) {
          toast.error(`Vui lòng nhập tên Tester cho: ${item.name}`);
          return;
        }
        if (d.status === "FAIL" && !d.note.trim()) {
          toast.error(`Vui lòng nhập Ghi chú cho lỗi: ${item.name}`);
          return;
        }
      }
      const toSave = { ...data, updatedAt: new Date().toISOString() };
      localStorage.setItem(storageKey, JSON.stringify(toSave));
      setData(toSave);
      setHasChanges(false);
      toast.success("Đã lưu kết quả thành công!");
    };

    const handleReset = () => {
      if (
        window.confirm(
          "Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu test không? Hành động này không thể hoàn tác!",
        )
      ) {
        localStorage.removeItem(storageKey);
        setData(isV1 ? DEFAULT_V1_DATA : DEFAULT_LEGACY_DATA);
        setHasChanges(false);
        toast.success("Đã reset toàn bộ checklist");
      }
    };

    const handleExport = () => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${isV1 ? "v1-smoke-test" : "uat-checklist"}-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Đã xuất file JSON");
    };

    const handleCopyReport = () => {
      const allItems = groups.flatMap((g) => g.items);
      let passCount = 0,
        failCount = 0,
        notTestedCount = 0;
      allItems.forEach((i) => {
        const d = data.items[i.id];
        if (d?.status === "PASS") passCount++;
        else if (d?.status === "FAIL") failCount++;
        else notTestedCount++;
      });

      let md = `# CRM v1.0.0B Manual Smoke Test Report\n\n`;
      md += `- **Tester:** ${(allItems[0] && data.items[allItems[0].id]?.tester) || "Admin"}\n`;
      md += `- **Environment:** Production/UAT\n`;
      md += `- **Timestamp:** ${new Date().toLocaleString("vi-VN")}\n`;
      md += `- **Summary:** ${passCount} Pass / ${failCount} Fail / ${notTestedCount} Not Tested\n\n`;

      groups.forEach((group) => {
        md += `## ${group.name}\n`;
        md += `| Test Case | Expected Result | Status | Notes | Evidence |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- |\n`;
        group.items.forEach((item) => {
          const d = data.items[item.id] || { status: "NOT TESTED", note: "", evidence: "" };
          md += `| ${item.name} | ${item.expected} | **${d.status}** | ${d.note || "-"} | ${d.evidence || "-"} |\n`;
        });
        md += `\n`;
      });

      md += `### Final Conclusion\n`;
      md += `- **Go to v1.0.0C:** ${failCount === 0 && notTestedCount === 0 ? "Yes" : "No"}\n`;
      md += `- **Blockers:** ${failCount > 0 ? "Found " + failCount + " fails" : "None"}\n`;
      md += `- **Bugs to fix:** ...\n`;

      navigator.clipboard
        .writeText(md)
        .then(() => {
          toast.success("Đã copy báo cáo Markdown vào Clipboard!");
        })
        .catch((err) => {
          toast.error("Không thể copy báo cáo: " + err.message);
        });
    };

    const toggleGroup = (groupId: string) => {
      setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
    };

    const getGroupSummary = (group: ChecklistGroup) => {
      let pass = 0,
        fail = 0,
        notTested = 0;
      for (const item of group.items) {
        const d = data.items[item.id];
        if (d?.status === "PASS") pass++;
        else if (d?.status === "FAIL") fail++;
        else notTested++;
      }
      return { pass, fail, notTested, total: group.items.length };
    };

    const total = groups.flatMap((g) => g.items).length;
    let pass = 0,
      fail = 0,
      notTested = 0;
    groups
      .flatMap((g) => g.items)
      .forEach((item) => {
        const d = data.items[item.id];
        if (d?.status === "PASS") pass++;
        else if (d?.status === "FAIL") fail++;
        else notTested++;
      });
    const completion = total > 0 ? Math.round(((pass + fail) / total) * 100) : 0;

    return (
      <div className="animate-in fade-in duration-500 mt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-indigo-600" />
              {isV1 ? "v1.0 Smoke Test Checklist" : "Legacy UAT Acceptance Checklist"}
            </h1>
            <p className="text-sm text-slate-500 font-medium mt-1">
              Nghiệm thu nội bộ — {total} items / {groups.length} groups. Version: {data.uatVersion}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Reset
            </Button>
            <Button
              variant="outline"
              onClick={handleExport}
              className="rounded-xl border-slate-200"
            >
              <Download className="w-4 h-4 mr-2" /> Export JSON
            </Button>
            {isV1 && (
              <Button
                variant="outline"
                onClick={handleCopyReport}
                className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 rounded-xl"
              >
                <ClipboardCopy className="w-4 h-4 mr-2" /> Copy Report
              </Button>
            )}
            <Button
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 relative"
            >
              <Save className="w-4 h-4 mr-2" /> Save Changes
              {hasChanges && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />
              )}
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="shadow-none border-slate-200 bg-white">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-slate-800">{total}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
                Total Items
              </span>
            </CardContent>
          </Card>
          <Card className="shadow-none border-emerald-100 bg-emerald-50/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-emerald-600">{pass}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mt-1">
                Passed
              </span>
            </CardContent>
          </Card>
          <Card className="shadow-none border-rose-100 bg-rose-50/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-rose-600">{fail}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70 mt-1">
                Failed
              </span>
            </CardContent>
          </Card>
          <Card className="shadow-none border-amber-100 bg-amber-50/50">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-black text-amber-600">{notTested}</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 mt-1">
                Not Tested
              </span>
            </CardContent>
          </Card>
          <Card className="shadow-none border-indigo-100 bg-indigo-50/50 relative overflow-hidden">
            <CardContent className="p-4 flex flex-col items-center justify-center text-center z-10 relative">
              <span className="text-3xl font-black text-indigo-600">{completion}%</span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/70 mt-1">
                Completion
              </span>
            </CardContent>
            <div
              className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000"
              style={{ width: `${completion}%` }}
            />
          </Card>
        </div>

        {/* Checklist Groups */}
        <div className="space-y-4">
          {groups.map((group) => {
            const gs = getGroupSummary(group);
            const isCollapsed = collapsedGroups[group.id];
            const allPassed = gs.pass === gs.total;
            const hasFails = gs.fail > 0;

            return (
              <div
                key={group.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50/80 border-b border-slate-100 hover:bg-slate-100/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
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
                    {allPassed && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    {hasFails && <XCircle className="w-5 h-5 text-rose-500" />}
                  </div>
                </button>

                {!isCollapsed && (
                  <div className="divide-y divide-slate-100">
                    <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-slate-50/40 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <div className="col-span-3">Test Case</div>
                      <div className="col-span-2">Expected Result</div>
                      <div className="col-span-2">Status & Tester</div>
                      <div className="col-span-2">Notes</div>
                      {isV1 ? (
                        <div className="col-span-2">Evidence</div>
                      ) : (
                        <div className="col-span-2">Updated</div>
                      )}
                      <div className="col-span-1 text-right">{isV1 ? "Updated" : ""}</div>
                    </div>

                    {group.items.map((item) => {
                      const d = data.items[item.id] || {
                        status: "NOT TESTED",
                        tester: "",
                        note: "",
                        evidence: "",
                        timestamp: "",
                      };
                      const isPassed = d.status === "PASS";
                      const isFailed = d.status === "FAIL";
                      const isUntested = d.status === "NOT TESTED";

                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-12 gap-3 px-4 py-3 items-start hover:bg-slate-50/50 transition-colors ${isFailed ? "bg-rose-50/30" : ""}`}
                        >
                          <div className="col-span-3 flex items-start gap-2">
                            {isPassed && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                            )}
                            {isFailed && (
                              <XCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                            )}
                            {isUntested && (
                              <HelpCircle className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />
                            )}
                            <span className="text-sm font-semibold text-slate-800">
                              {item.name}
                            </span>
                          </div>

                          <div className="col-span-2 text-xs text-slate-500 leading-relaxed">
                            {item.expected}
                          </div>

                          <div className="col-span-2 flex flex-col gap-2">
                            <select
                              className={`w-full p-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border outline-none transition-all
                                ${
                                  isPassed
                                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                    : isFailed
                                      ? "bg-rose-50 border-rose-200 text-rose-700"
                                      : "bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300"
                                }`}
                              value={d.status}
                              onChange={(e) => handleItemChange(item.id, "status", e.target.value)}
                            >
                              <option value="NOT TESTED">—</option>
                              <option value="PASS">PASS</option>
                              <option value="FAIL">FAIL</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Tester..."
                              className="w-full p-1.5 px-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-500 outline-none transition-all bg-transparent"
                              value={d.tester}
                              onChange={(e) => handleItemChange(item.id, "tester", e.target.value)}
                            />
                            {(isPassed || isFailed) && !d.tester.trim() && (
                              <span className="text-[9px] text-rose-500 font-bold mt-0.5 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Required
                              </span>
                            )}
                          </div>

                          <div className="col-span-2">
                            <input
                              type="text"
                              placeholder="Ghi chú..."
                              className="w-full p-1.5 px-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-500 outline-none transition-all bg-transparent"
                              value={d.note}
                              onChange={(e) => handleItemChange(item.id, "note", e.target.value)}
                            />
                            {isFailed && !d.note.trim() && (
                              <span className="text-[9px] text-rose-500 font-bold mt-0.5 flex items-center gap-0.5">
                                <AlertTriangle className="w-2.5 h-2.5" /> Required
                              </span>
                            )}
                          </div>

                          {isV1 ? (
                            <div className="col-span-2">
                              <input
                                type="text"
                                placeholder="VD: Console clean..."
                                className="w-full p-1.5 px-2 rounded-lg border border-slate-200 text-xs focus:border-indigo-500 outline-none transition-all bg-transparent"
                                value={d.evidence || ""}
                                onChange={(e) =>
                                  handleItemChange(item.id, "evidence", e.target.value)
                                }
                              />
                            </div>
                          ) : (
                            <div className="col-span-2 text-[10px] font-medium text-slate-400">
                              {d.timestamp
                                ? new Date(d.timestamp).toLocaleDateString("vi-VN")
                                : "—"}
                            </div>
                          )}

                          <div className="col-span-1 text-right text-[10px] font-medium text-slate-400 flex flex-col items-end">
                            {isV1 && d.timestamp
                              ? new Date(d.timestamp).toLocaleDateString("vi-VN")
                              : isV1
                                ? "—"
                                : ""}
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
      </div>
    );
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
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Tính năng UAT Checklist chỉ dành cho Administrator.
        </p>
        <Link
          to="/workspace"
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
        >
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="v1.0.0B" className="font-bold text-sm">
            v1.0 Smoke Test
          </TabsTrigger>
          <TabsTrigger value="legacy" className="font-bold text-sm">
            Legacy UAT
          </TabsTrigger>
        </TabsList>
        <TabsContent value="v1.0.0B">
          {renderChecklist(
            CHECKLIST_GROUPS_V1_0_0B,
            v1Data,
            setV1Data,
            setHasV1Changes,
            "desembre:uat:v1.0.0B:smoke-test",
            hasV1Changes,
            true,
          )}
        </TabsContent>
        <TabsContent value="legacy">
          {renderChecklist(
            LEGACY_CHECKLIST_GROUPS,
            legacyData,
            setLegacyData,
            setHasLegacyChanges,
            "uatChecklist_v2",
            hasLegacyChanges,
            false,
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
