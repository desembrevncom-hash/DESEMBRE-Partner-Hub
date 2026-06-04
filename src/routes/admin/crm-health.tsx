import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldAlert,
  RefreshCw,
  Download,
  ActivitySquare,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Phone,
  UserX,
  Copy,
  Zap,
  ShoppingCart,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMTableWrapper } from "@/components/crm/CRMTableWrapper";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";

export const Route = createFileRoute("/admin/crm-health")({
  component: CRMHealthPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface HealthCheck {
  id: string;
  label: string;
  description: string;
  status: "loading" | "ok" | "warning" | "error" | "unavailable";
  count: number | null;
  detail?: string;
  sql?: string;
}

interface HealthModule {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  checks: HealthCheck[];
  expanded: boolean;
  loading: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function severityFromCount(count: number | null, warnAt = 0): HealthCheck["status"] {
  if (count === null) return "unavailable";
  if (count === 0) return "ok";
  if (count > warnAt) return "warning";
  return "ok";
}

// ─── Initial module structure ─────────────────────────────────────────────────

function buildInitialModules(): HealthModule[] {
  return [
    {
      id: "customers",
      name: "Customer Data Quality",
      icon: <Users className="w-4 h-4" />,
      color: "text-blue-600",
      expanded: true,
      loading: false,
      checks: [
        {
          id: "no_gps",
          label: "Khách thiếu GPS",
          description: "latitude IS NULL hoặc longitude IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customers WHERE (latitude IS NULL OR longitude IS NULL) AND deleted_at IS NULL",
        },
        {
          id: "no_owner",
          label: "Khách thiếu owner",
          description: "owner_sale_id IS NULL và owner_tele_id IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customers WHERE owner_sale_id IS NULL AND owner_tele_id IS NULL AND deleted_at IS NULL",
        },
        {
          id: "no_phone",
          label: "Khách thiếu SĐT",
          description: "phone IS NULL hoặc rỗng",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customers WHERE (phone IS NULL OR phone = '') AND deleted_at IS NULL",
        },
        {
          id: "no_norm_phone",
          label: "Thiếu normalized_phone",
          description: "normalized_phone IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customers WHERE normalized_phone IS NULL AND deleted_at IS NULL",
        },
        {
          id: "dup_phone",
          label: "Số điện thoại trùng lặp",
          description: "Nhiều KH có cùng normalized_phone",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM (SELECT normalized_phone FROM customers WHERE deleted_at IS NULL GROUP BY normalized_phone HAVING count(*) > 1) t",
        },
        {
          id: "no_name",
          label: "Khách thiếu tên",
          description: "name IS NULL hoặc rỗng",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customers WHERE (name IS NULL OR name = '') AND deleted_at IS NULL",
        },
      ],
    },
    {
      id: "tasks",
      name: "Task Integrity",
      icon: <ClipboardList className="w-4 h-4" />,
      color: "text-purple-600",
      expanded: false,
      loading: false,
      checks: [
        {
          id: "overdue_tasks",
          label: "Task quá hạn chưa xử lý",
          description: "due_at < now() và status != 'done'",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customer_tasks WHERE due_at < now() AND status != 'done'",
        },
        {
          id: "orphan_tasks",
          label: "Task không có khách",
          description: "customer_id bị NULL hoặc KH đã xoá",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customer_tasks WHERE customer_id IS NULL OR NOT EXISTS (SELECT 1 FROM customers c WHERE c.id = customer_tasks.customer_id AND c.deleted_at IS NULL)",
        },
        {
          id: "no_assignee_tasks",
          label: "Task chưa assign",
          description: "assigned_to IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM customer_tasks WHERE assigned_to IS NULL",
        },
      ],
    },
    {
      id: "orders",
      name: "Order Integrity",
      icon: <ShoppingCart className="w-4 h-4" />,
      color: "text-emerald-600",
      expanded: false,
      loading: false,
      checks: [
        {
          id: "orders_no_customer",
          label: "Orders không có KH",
          description: "customer_id IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM orders WHERE customer_id IS NULL",
        },
        {
          id: "orders_no_product",
          label: "Orders không có sản phẩm",
          description: "Không có order_items liên kết",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM orders o WHERE NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id)",
        },
        {
          id: "orders_invalid_status",
          label: "Orders trạng thái không hợp lệ",
          description: "status NULL hoặc ngoài enum",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM orders WHERE status IS NULL",
        },
      ],
    },
    {
      id: "automation",
      name: "Automation Rules",
      icon: <Zap className="w-4 h-4" />,
      color: "text-amber-600",
      expanded: false,
      loading: false,
      checks: [
        {
          id: "broken_conditions",
          label: "Rules thiếu điều kiện",
          description: "conditions IS NULL hoặc mảng rỗng",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM automation_rules WHERE is_active = true AND (conditions IS NULL OR conditions = '[]'::jsonb)",
        },
        {
          id: "broken_actions",
          label: "Rules thiếu action",
          description: "actions IS NULL hoặc mảng rỗng",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM automation_rules WHERE is_active = true AND (actions IS NULL OR actions = '[]'::jsonb)",
        },
        {
          id: "rules_no_target",
          label: "Rules không có trigger event",
          description: "trigger_event IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM automation_rules WHERE trigger_event IS NULL AND is_active = true",
        },
      ],
    },
    {
      id: "notifications",
      name: "Notifications & Logs",
      icon: <Clock className="w-4 h-4" />,
      color: "text-rose-600",
      expanded: false,
      loading: false,
      checks: [
        {
          id: "unread_old",
          label: "Thông báo cũ chưa đọc (>7 ngày)",
          description: "read_at IS NULL và created_at < 7 ngày trước",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM notifications WHERE read_at IS NULL AND created_at < now() - interval '7 days'",
        },
        {
          id: "notif_no_recipient",
          label: "Thông báo không có người nhận",
          description: "recipient_user_id IS NULL",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM notifications WHERE recipient_user_id IS NULL",
        },
      ],
    },
    {
      id: "system",
      name: "System Health (Production)",
      icon: <ActivitySquare className="w-4 h-4" />,
      color: "text-indigo-600",
      expanded: true,
      loading: false,
      checks: [
        {
          id: "app_error_logs",
          label: "App Error Logs mới (24h)",
          description: "Errors sinh ra trong 24h qua",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM app_error_logs WHERE created_at > now() - interval '24 hours'",
        },
        {
          id: "retry_queue_failed",
          label: "Retry Queue Failed",
          description: "Các job failed trong retry_queue",
          status: "loading",
          count: null,
          sql: "SELECT count(*) FROM retry_queue WHERE status = 'failed'",
        },
      ],
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

function CRMHealthPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [modules, setModules] = useState<HealthModule[]>(buildInitialModules);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  const isAuthorized = isAdmin || isSubAdmin;

  // ── Fetch logic ──────────────────────────────────────────────────────────

  const runCheckForModule = useCallback(async (moduleId: string) => {
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, loading: true } : m)));

    const moduleTemplate = buildInitialModules().find((m) => m.id === moduleId);
    if (!moduleTemplate) return;

    const results = await Promise.all(
      moduleTemplate.checks.map(async (check) => {
        try {
          let count: number | null = null;

          // Map check IDs to actual Supabase queries
          if (moduleId === "customers") {
            const table = "customers";
            if (check.id === "no_gps") {
              const { count: c, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true })
                .or("latitude.is.null,longitude.is.null")
                .is("deleted_at", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "no_owner") {
              const { count: c, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true })
                .is("owner_sale_id", null)
                .is("owner_tele_id", null)
                .is("deleted_at", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "no_phone") {
              const { count: c, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true })
                .or("phone.is.null,phone.eq.")
                .is("deleted_at", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "no_norm_phone") {
              const { count: c, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true })
                .is("normalized_phone", null)
                .is("deleted_at", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "no_name") {
              const { count: c, error } = await supabase
                .from(table)
                .select("id", { count: "exact", head: true })
                .or("name.is.null,name.eq.")
                .is("deleted_at", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "dup_phone") {
              // We need to count distinct normalized_phones that appear more than once
              const { data, error } = await supabase
                .from(table)
                .select("normalized_phone")
                .not("normalized_phone", "is", null)
                .is("deleted_at", null);
              if (!error && data) {
                const freq: Record<string, number> = {};
                data.forEach((r: any) => {
                  if (r.normalized_phone)
                    freq[r.normalized_phone] = (freq[r.normalized_phone] || 0) + 1;
                });
                count = Object.values(freq).filter((v) => v > 1).length;
              }
            }
          } else if (moduleId === "tasks") {
            if (check.id === "overdue_tasks") {
              const { count: c, error } = await supabase
                .from("customer_tasks")
                .select("id", { count: "exact", head: true })
                .lt("due_at", new Date().toISOString())
                .neq("status", "done");
              if (!error) count = c ?? 0;
            } else if (check.id === "no_assignee_tasks") {
              const { count: c, error } = await supabase
                .from("customer_tasks")
                .select("id", { count: "exact", head: true })
                .is("assigned_to", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "orphan_tasks") {
              const { count: c, error } = await supabase
                .from("customer_tasks")
                .select("id", { count: "exact", head: true })
                .is("customer_id", null);
              if (!error) count = c ?? 0;
            }
          } else if (moduleId === "orders") {
            if (check.id === "orders_no_customer") {
              const { count: c, error } = await supabase
                .from("orders")
                .select("id", { count: "exact", head: true })
                .is("customer_id", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "orders_invalid_status") {
              const { count: c, error } = await supabase
                .from("orders")
                .select("id", { count: "exact", head: true })
                .is("status", null);
              if (!error) count = c ?? 0;
            } else if (check.id === "orders_no_product") {
              // Will return unavailable if order_items table doesn't exist
              count = null;
            }
          } else if (moduleId === "automation") {
            if (check.id === "broken_conditions") {
              try {
                const { count: c, error } = await supabase
                  .from("automation_rules")
                  .select("id", { count: "exact", head: true })
                  .eq("is_active", true)
                  .is("conditions", null);
                if (!error) count = c ?? 0;
              } catch {
                count = null;
              }
            } else if (check.id === "broken_actions") {
              try {
                const { count: c, error } = await supabase
                  .from("automation_rules")
                  .select("id", { count: "exact", head: true })
                  .eq("is_active", true)
                  .is("actions", null);
                if (!error) count = c ?? 0;
              } catch {
                count = null;
              }
            } else if (check.id === "rules_no_target") {
              try {
                const { count: c, error } = await supabase
                  .from("automation_rules")
                  .select("id", { count: "exact", head: true })
                  .is("trigger_event", null)
                  .eq("is_active", true);
                if (!error) count = c ?? 0;
              } catch {
                count = null;
              }
            }
          } else if (moduleId === "notifications") {
            if (check.id === "unread_old") {
              const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
              const { count: c, error } = await supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .is("read_at", null)
                .lt("created_at", sevenDaysAgo);
              if (!error) count = c ?? 0;
            } else if (check.id === "notif_no_recipient") {
              const { count: c, error } = await supabase
                .from("notifications")
                .select("id", { count: "exact", head: true })
                .is("recipient_user_id", null);
              if (!error) count = c ?? 0;
            }
          } else if (moduleId === "system") {
            if (check.id === "app_error_logs") {
              try {
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { count: c, error } = await supabase
                  .from("app_error_logs")
                  .select("id", { count: "exact", head: true })
                  .gt("created_at", oneDayAgo);
                if (!error) count = c ?? 0;
              } catch {
                count = null;
              }
            } else if (check.id === "retry_queue_failed") {
              try {
                const { count: c, error } = await supabase
                  .from("retry_queue")
                  .select("id", { count: "exact", head: true })
                  .eq("status", "failed");
                if (!error) count = c ?? 0;
              } catch {
                count = null;
              }
            }
          }

          const status = count === null ? "unavailable" : count === 0 ? "ok" : "warning";
          return { ...check, count, status } as HealthCheck;
        } catch (e: any) {
          return { ...check, count: null, status: "unavailable" as const, detail: e.message };
        }
      }),
    );

    setModules((prev) =>
      prev.map((m) => (m.id === moduleId ? { ...m, loading: false, checks: results } : m)),
    );
  }, []);

  const runAllChecks = useCallback(async () => {
    if (!isAuthorized) return;
    setGlobalLoading(true);
    const ids = buildInitialModules().map((m) => m.id);
    await Promise.all(ids.map((id) => runCheckForModule(id)));
    setLastRefreshed(new Date());
    setGlobalLoading(false);
    toast.success("Đã làm mới toàn bộ CRM Health Data");
  }, [isAuthorized, runCheckForModule]);

  // ── Summary ──────────────────────────────────────────────────────────────

  const allChecks = modules.flatMap((m) => m.checks);
  const totalChecks = allChecks.length;
  const okCount = allChecks.filter((c) => c.status === "ok").length;
  const warnCount = allChecks.filter((c) => c.status === "warning").length;
  const unavailableCount = allChecks.filter((c) => c.status === "unavailable").length;
  const totalIssues = allChecks.reduce((sum, c) => sum + (c.count ?? 0), 0);

  // ── Export ───────────────────────────────────────────────────────────────

  const handleExport = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      lastRefreshed: lastRefreshed?.toISOString() ?? null,
      summary: { totalChecks, okCount, warnCount, unavailableCount, totalIssues },
      modules: modules.map((m) => ({
        id: m.id,
        name: m.name,
        checks: m.checks.map((c) => ({
          id: c.id,
          label: c.label,
          status: c.status,
          count: c.count,
          sql: c.sql,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-health-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã xuất báo cáo CRM Health JSON");
  };

  // ── Toggle module expand ─────────────────────────────────────────────────

  const toggleExpand = (id: string) => {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  };

  // ── Auth guard ───────────────────────────────────────────────────────────

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
          CRM Health Dashboard chỉ dành cho Admin và Sub Admin.
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

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <CRMPageContainer>
      {/* Header */}
      <CRMPageHeader
        title="CRM Health Dashboard"
        icon={<ActivitySquare className="w-7 h-7 text-rose-500" />}
        description="Kiểm tra chất lượng dữ liệu trước khi rollout nội bộ. Chỉ đọc — không tự sửa dữ liệu."
        breadcrumbs={[{ label: "Admin Hub", href: "/admin/hub" }, { label: "CRM Health" }]}
        actionButtons={
          <div className="flex items-center gap-2">
            {lastRefreshed && (
              <span className="text-[11px] text-slate-400 font-medium hidden md:block">
                Cập nhật: {lastRefreshed.toLocaleTimeString("vi-VN")}
              </span>
            )}
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={lastRefreshed === null}
              className="rounded-xl border-slate-200 text-slate-700"
            >
              <Download className="w-4 h-4 mr-2" /> Export JSON
            </Button>
            <Button
              onClick={runAllChecks}
              disabled={globalLoading}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-lg shadow-rose-200"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${globalLoading ? "animate-spin" : ""}`} />
              {globalLoading ? "Đang kiểm tra..." : "Chạy kiểm tra"}
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <CRMCard className="border-slate-200 shadow-none p-0">
          <div className="p-4 flex flex-col items-center text-center">
            <span className="text-3xl font-black text-slate-800">{totalChecks}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">
              Total Checks
            </span>
          </div>
        </CRMCard>
        <CRMCard className="border-emerald-100 bg-emerald-50/50 shadow-none p-0">
          <div className="p-4 flex flex-col items-center text-center">
            <span className="text-3xl font-black text-emerald-600">{okCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mt-1">
              Passed
            </span>
          </div>
        </CRMCard>
        <CRMCard className="border-amber-100 bg-amber-50/50 shadow-none p-0">
          <div className="p-4 flex flex-col items-center text-center">
            <span className="text-3xl font-black text-amber-600">{warnCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 mt-1">
              Warnings
            </span>
          </div>
        </CRMCard>
        <CRMCard className="border-rose-100 bg-rose-50/50 shadow-none p-0 relative overflow-hidden">
          <div className="p-4 flex flex-col items-center text-center">
            <span className="text-3xl font-black text-rose-600">{totalIssues}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70 mt-1">
              Total Issues
            </span>
          </div>
        </CRMCard>
      </div>

      {/* CTA if never run */}
      {lastRefreshed === null && (
        <div className="mb-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 flex flex-col items-center text-center gap-3">
          <ActivitySquare className="w-10 h-10 text-slate-300" />
          <p className="text-slate-500 font-semibold text-sm">
            Chưa có dữ liệu. Nhấn <strong>"Chạy kiểm tra"</strong> để bắt đầu phân tích sức khỏe
            CRM.
          </p>
        </div>
      )}

      {/* Health Modules */}
      <div className="flex flex-col gap-4">
        {modules.map((mod) => {
          const modIssues = mod.checks.reduce((sum, c) => sum + (c.count ?? 0), 0);
          const modOk = mod.checks.every((c) => c.status === "ok" || c.status === "loading");
          const modHasWarn = mod.checks.some((c) => c.status === "warning");
          const modLoading = mod.loading || globalLoading;

          return (
            <CRMCard key={mod.id} className="border-slate-200 shadow-sm overflow-hidden p-0">
              {/* Module header */}
              <button className="w-full text-left" onClick={() => toggleExpand(mod.id)}>
                <div className="py-4 px-5 flex flex-row items-center justify-between gap-2 cursor-pointer hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center bg-slate-100 ${mod.color}`}
                    >
                      {mod.icon}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-800">{mod.name}</h3>
                      <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                        {mod.checks.length} checks
                        {lastRefreshed !== null && (
                          <span
                            className={`ml-2 font-bold ${modHasWarn ? "text-amber-600" : modOk ? "text-emerald-600" : "text-slate-400"}`}
                          >
                            — {modHasWarn ? `⚠ ${modIssues} vấn đề` : "✓ Ổn"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {modLoading && (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-400" />
                    )}
                    {mod.expanded ? (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* Module checks */}
              {mod.expanded && (
                <div className="p-0 border-t border-slate-100 overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Table header */}
                    <div className="grid grid-cols-12 gap-3 px-5 py-2 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <div className="col-span-1">Status</div>
                      <div className="col-span-4">Check</div>
                      <div className="col-span-4">Mô tả</div>
                      <div className="col-span-2 text-center">Số lượng</div>
                      <div className="col-span-1 text-right">SQL</div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {mod.checks.map((check) => {
                        const isLoading = check.status === "loading" || modLoading;
                        const isOk = check.status === "ok";
                        const isWarn = check.status === "warning";
                        const isUnavail = check.status === "unavailable";

                        return (
                          <div
                            key={check.id}
                            className="grid grid-cols-12 gap-3 px-5 py-3 items-center hover:bg-slate-50/50 transition-colors"
                          >
                            {/* Status icon */}
                            <div className="col-span-1">
                              {isLoading ? (
                                <RefreshCw className="w-4 h-4 animate-spin text-slate-300" />
                              ) : isOk ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              ) : isWarn ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              ) : (
                                <div title="Module chưa khả dụng">
                                  <Info className="w-4 h-4 text-slate-300" />
                                </div>
                              )}
                            </div>

                            {/* Label */}
                            <div className="col-span-4">
                              <span className="text-sm font-semibold text-slate-800">
                                {check.label}
                              </span>
                            </div>

                            {/* Description */}
                            <div className="col-span-4">
                              <span className="text-xs text-slate-400 font-mono">
                                {check.description}
                              </span>
                            </div>

                            {/* Count badge */}
                            <div className="col-span-2 flex justify-center">
                              {isLoading ? (
                                <span className="text-xs text-slate-300 font-bold">—</span>
                              ) : isUnavail ? (
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">
                                  N/A
                                </span>
                              ) : (
                                <span
                                  className={`px-3 py-0.5 rounded-full text-xs font-black ${
                                    check.count === 0
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-amber-100 text-amber-700"
                                  }`}
                                >
                                  {check.count?.toLocaleString("vi-VN")}
                                </span>
                              )}
                            </div>

                            {/* SQL tooltip / copy */}
                            <div className="col-span-1 flex justify-end">
                              {check.sql && (
                                <button
                                  title={check.sql}
                                  onClick={() => {
                                    navigator.clipboard.writeText(check.sql!);
                                    toast.success("Đã copy SQL");
                                  }}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Per-module refresh */}
                    <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/30 flex justify-end">
                      <button
                        onClick={() => runCheckForModule(mod.id)}
                        disabled={mod.loading || globalLoading}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1.5 transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 ${mod.loading ? "animate-spin" : ""}`} />
                        Làm mới module này
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </CRMCard>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-400 font-medium gap-1">
        <p>Chỉ đọc — Không tự sửa dữ liệu. Phase C - CRM Rollout Readiness.</p>
        {lastRefreshed && <p>Lần cuối: {lastRefreshed.toLocaleString("vi-VN")}</p>}
      </div>
    </CRMPageContainer>
  );
}
