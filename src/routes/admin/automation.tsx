import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Clock, 
  Search, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  LayoutDashboard,
  Activity,
  Heart,
  TrendingUp,
  ToggleLeft,
  Bell,
  FileText,
  XCircle,
  AlertTriangle,
  BarChart3,
  HelpCircle,
  DollarSign,
  Users,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

export const Route = createFileRoute("/admin/automation")({
  component: AutomationCenterPage,
});

function TabTrigger({ value, icon: Icon, label }: any) {
  return (
    <TabsTrigger 
      value={value} 
      className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg shadow-indigo-200 rounded-xl px-6 h-12 text-xs font-black transition-all flex items-center gap-2 text-slate-500"
    >
       <Icon className="w-4 h-4" />
       {label}
    </TabsTrigger>
  );
}

function AutomationCenterPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [togglingRuleId, setTogglingRuleId] = useState<string | null>(null);
  
  const [configValues, setConfigValues] = useState<Record<string, { threshold_value: number; threshold_unit: string }>>({});
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  // Health Dashboard States
  const [dashboardLogs, setDashboardLogs] = useState<any[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<any[]>([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<"today" | "7days" | "30days">("7days");
  const [selectedRuleId, setSelectedRuleId] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  // Business Impact States
  const [impactOrders, setImpactOrders] = useState<any[]>([]);
  const [impactActivities, setImpactActivities] = useState<any[]>([]);
  const [profilesList, setProfilesList] = useState<any[]>([]);
  const [selectedImpactRuleId, setSelectedImpactRuleId] = useState("all");
  const [selectedImpactStaffId, setSelectedImpactStaffId] = useState("all");
  const [selectedImpactStatus, setSelectedImpactStatus] = useState("all");
  
  const [activeTab, setActiveTab] = useState<string>("rules");

  const handleScrollToRule = (ruleId: string) => {
    setActiveTab("rules");
    setTimeout(() => {
      const element = document.getElementById(ruleId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        element.classList.add("ring-4", "ring-amber-400", "scale-[1.01]");
        setTimeout(() => {
          element.classList.remove("ring-4", "ring-amber-400", "scale-[1.01]");
        }, 2000);
      }
    }, 150);
  };

  const isAuthorized = isAdmin || isSubAdmin;

  // Important rules config
  const IMPORTANT_RULES = useMemo(() => [
    "lead_assigned",
    "quote_follow_up",
    "post_purchase_checkin",
    "customer_at_risk",
    "reorder_reminder"
  ], []);

  const disabledImportantRules = useMemo(() => {
    return rules.filter(r => IMPORTANT_RULES.includes(r.id) && !r.is_enabled);
  }, [rules, IMPORTANT_RULES]);

  const reloadRules = async () => {
    try {
      setBusy(true);
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        toast.error("Lỗi khi tải danh sách rules: " + error.message);
      } else if (data) {
        setRules(data);
        
        // Khởi tạo giá trị cấu hình local
        const initialConfigs: Record<string, { threshold_value: number; threshold_unit: string }> = {};
        data.forEach((r: any) => {
          if (r.is_configurable) {
            initialConfigs[r.id] = {
              threshold_value: r.threshold_value || 0,
              threshold_unit: r.threshold_unit || "days"
            };
          }
        });
        setConfigValues(initialConfigs);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi hệ thống: " + err.message);
    } finally {
      setBusy(false);
    }
  };

  const reloadLogs = async () => {
    try {
      setLogsLoading(true);
      const { data, error } = await supabase
        .from("automation_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        toast.error("Lỗi khi tải nhật ký: " + error.message);
      } else if (data) {
        setLogs(data);
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi hệ thống: " + err.message);
    } finally {
      setLogsLoading(false);
    }
  };

  const reloadDashboardLogs = async (range: "today" | "7days" | "30days") => {
    try {
      setDashboardLoading(true);
      let query = supabase
        .from("automation_logs")
        .select("id, rule_id, automation_type, status, created_at, error_message, task_id, notification_id, customer_id");
      
      let startDate = new Date();
      if (range === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (range === "7days") {
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
      } else if (range === "30days") {
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
      }
      
      query = query.gte("created_at", startDate.toISOString());
      
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) {
        toast.error("Lỗi khi tải dữ liệu dashboard: " + error.message);
      } else if (data) {
        setDashboardLogs(data);
        
        // Fetch associated tasks to calculate completion/overdue statistics
        const taskIds = data.map(log => log.task_id).filter(Boolean) as string[];
        if (taskIds.length > 0) {
          const { data: tasksData, error: tasksError } = await supabase
            .from("customer_tasks")
            .select("id, status, due_at, assigned_to")
            .in("id", taskIds);
          if (!tasksError && tasksData) {
            setDashboardTasks(tasksData);
          } else {
            setDashboardTasks([]);
          }
        } else {
          setDashboardTasks([]);
        }

        // Fetch orders since startDate (status != cancelled, refunded, void)
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, customer_id, total, status, created_at, sale_user_id")
          .gte("created_at", startDate.toISOString());
        if (!ordersError && ordersData) {
          const filteredOrders = ordersData.filter(o => !["cancelled", "refunded", "void"].includes(o.status));
          setImpactOrders(filteredOrders);
        } else {
          setImpactOrders([]);
        }

        // Fetch activities since startDate
        const { data: actsData, error: actsError } = await supabase
          .from("customer_activities")
          .select("id, customer_id, created_at, created_by")
          .gte("created_at", startDate.toISOString());
        if (!actsError && actsData) {
          setImpactActivities(actsData);
        } else {
          setImpactActivities([]);
        }

        // Fetch profiles list for staff name resolution
        const { data: profsData, error: profsError } = await supabase
          .from("profiles")
          .select("id, display_name, email");
        if (!profsError && profsData) {
          setProfilesList(profsData);
        } else {
          setProfilesList([]);
        }
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setDashboardLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAuthorized) {
      return;
    }
    reloadRules();
    reloadLogs();
    reloadDashboardLogs(timeRange);
  }, [user, isAuthorized, authLoading, timeRange]);

  const filteredRules = useMemo(() => {
    return rules.filter(r => {
      const matchSearch = (r.name || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (r.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (r.description || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = categoryFilter === "all" || r.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [rules, searchQuery, categoryFilter]);

  const configurableRules = useMemo(() => {
    // Chỉ tải các quy tắc có thể cấu hình (is_configurable = true) và không phải db_trigger
    return rules.filter(r => r.is_configurable && r.category !== "db_trigger");
  }, [rules]);

  const IMPACT_RULES = useMemo(() => [
    "quote_follow_up",
    "post_purchase_checkin",
    "reorder_reminder",
    "customer_at_risk",
    "lead_assigned"
  ], []);

  const impactData = useMemo(() => {
    const sortedLogs = [...dashboardLogs]
      .filter(log => log.customer_id && IMPACT_RULES.includes(log.rule_id || log.automation_type))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const sortedOrders = [...impactOrders]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const sortedActivities = [...impactActivities]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    const logAttribution: Record<string, {
      task: any | null;
      orders: any[];
      activities: any[];
    }> = {};

    sortedLogs.forEach(log => {
      logAttribution[log.id] = {
        task: dashboardTasks.find(t => t.id === log.task_id) || null,
        orders: [],
        activities: []
      };
    });

    sortedOrders.forEach(order => {
      let bestLog: any = null;
      let minDiff = Infinity;
      
      sortedLogs.forEach(log => {
        if (log.customer_id !== order.customer_id) return;
        
        const logTime = new Date(log.created_at).getTime();
        const orderTime = new Date(order.created_at).getTime();
        const diff = orderTime - logTime;
        
        if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) {
          if (diff < minDiff) {
            minDiff = diff;
            bestLog = log;
          }
        }
      });

      if (bestLog) {
        logAttribution[bestLog.id].orders.push(order);
      }
    });

    sortedActivities.forEach(act => {
      let bestLog: any = null;
      let minDiff = Infinity;

      sortedLogs.forEach(log => {
        if (log.customer_id !== act.customer_id) return;

        const logTime = new Date(log.created_at).getTime();
        const actTime = new Date(act.created_at).getTime();
        const diff = actTime - logTime;

        if (diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000) {
          if (diff < minDiff) {
            minDiff = diff;
            bestLog = log;
          }
        }
      });

      if (bestLog) {
        logAttribution[bestLog.id].activities.push(act);
      }
    });

    return logAttribution;
  }, [dashboardLogs, dashboardTasks, impactOrders, impactActivities, IMPACT_RULES]);

  const businessImpactMetrics = useMemo(() => {
    const rulesMap = new Map(rules.map(r => [r.id, r]));

    let totalTasksCreated = 0;
    let completedTasksCount = 0;
    let overdueTasksCount = 0;
    const customersWithActivity = new Set<string>();
    const attributedOrders: any[] = [];
    let totalRevenue = 0;

    const ruleMetrics: Record<string, {
      rule_id: string;
      rule_name: string;
      task_created_count: number;
      task_completed_count: number;
      task_overdue_count: number;
      activity_after_count: number;
      orders_after_count: number;
      revenue_after: number;
    }> = {};

    IMPACT_RULES.forEach(ruleId => {
      const rObj = rulesMap.get(ruleId);
      ruleMetrics[ruleId] = {
        rule_id: ruleId,
        rule_name: rObj ? rObj.name : ruleId,
        task_created_count: 0,
        task_completed_count: 0,
        task_overdue_count: 0,
        activity_after_count: 0,
        orders_after_count: 0,
        revenue_after: 0
      };
    });

    const staffMetrics: Record<string, {
      staff_id: string;
      staff_name: string;
      assigned_tasks_from_automation: number;
      completed_tasks: number;
      overdue_tasks: number;
      orders_after: number;
      revenue_after: number;
    }> = {};

    profilesList.forEach(p => {
      staffMetrics[p.id] = {
        staff_id: p.id,
        staff_name: p.display_name || p.email?.split("@")[0] || "Nhân viên",
        assigned_tasks_from_automation: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        orders_after: 0,
        revenue_after: 0
      };
    });

    const UNKNOWN_STAFF_ID = "unknown";
    staffMetrics[UNKNOWN_STAFF_ID] = {
      staff_id: UNKNOWN_STAFF_ID,
      staff_name: "Chưa xác định",
      assigned_tasks_from_automation: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      orders_after: 0,
      revenue_after: 0
    };

    dashboardLogs.forEach(log => {
      const ruleId = log.rule_id || log.automation_type;
      if (!ruleId || !IMPACT_RULES.includes(ruleId)) return;

      if (selectedImpactRuleId !== "all" && ruleId !== selectedImpactRuleId) return;
      if (selectedImpactStatus !== "all" && log.status !== selectedImpactStatus) return;

      const attr = impactData[log.id];
      if (!attr) return;

      const task = attr.task;
      const orders = attr.orders;
      const activities = attr.activities;

      let attributedStaffId = UNKNOWN_STAFF_ID;
      if (task && task.assigned_to) {
        attributedStaffId = task.assigned_to;
      } else if (orders.length > 0) {
        const orderWithSale = orders.find(o => o.sale_user_id);
        if (orderWithSale) {
          attributedStaffId = orderWithSale.sale_user_id;
        }
      }

      if (selectedImpactStaffId !== "all" && attributedStaffId !== selectedImpactStaffId) return;

      if (task) {
        totalTasksCreated++;
        if (task.status === "completed") {
          completedTasksCount++;
        } else {
          const isOverdue = task.due_at && new Date(task.due_at) < new Date();
          if (isOverdue) {
            overdueTasksCount++;
          }
        }
      }

      if (activities.length > 0 && log.customer_id) {
        customersWithActivity.add(log.customer_id);
      }

      orders.forEach(o => {
        attributedOrders.push(o);
        totalRevenue += o.total || 0;
      });

      const rMet = ruleMetrics[ruleId];
      if (rMet) {
        if (task) {
          rMet.task_created_count++;
          if (task.status === "completed") {
            rMet.task_completed_count++;
          } else {
            const isOverdue = task.due_at && new Date(task.due_at) < new Date();
            if (isOverdue) {
              rMet.task_overdue_count++;
            }
          }
        }
        rMet.activity_after_count += activities.length;
        rMet.orders_after_count += orders.length;
        rMet.revenue_after += orders.reduce((sum, o) => sum + (o.total || 0), 0);
      }

      const sMet = staffMetrics[attributedStaffId];
      if (sMet) {
        if (task) {
          sMet.assigned_tasks_from_automation++;
          if (task.status === "completed") {
            sMet.completed_tasks++;
          } else {
            const isOverdue = task.due_at && new Date(task.due_at) < new Date();
            if (isOverdue) {
              sMet.overdue_tasks++;
            }
          }
        }
        sMet.orders_after += orders.length;
        sMet.revenue_after += orders.reduce((sum, o) => sum + (o.total || 0), 0);
      }
    });

    const ruleTable = Object.values(ruleMetrics).map(r => {
      const runs = dashboardLogs.filter(log => {
        const id = log.rule_id || log.automation_type;
        const matchRule = id === r.rule_id;
        const matchStatus = selectedImpactStatus === "all" || log.status === selectedImpactStatus;
        return matchRule && matchStatus;
      }).length;

      const conversionRate = runs > 0 ? Math.round((r.orders_after_count / runs) * 100) : 0;
      return {
        ...r,
        conversion_rate: conversionRate
      };
    });

    let topRevenueRuleName = "N/A";
    let maxRuleRevenue = 0;
    ruleTable.forEach(r => {
      if (r.revenue_after > maxRuleRevenue) {
        maxRuleRevenue = r.revenue_after;
        topRevenueRuleName = `${r.rule_name} (${new Intl.NumberFormat("vi-VN").format(Math.round(r.revenue_after))}đ)`;
      }
    });

    let bestStaffName = "N/A";
    let maxStaffRevenue = 0;
    Object.values(staffMetrics).forEach(s => {
      if (s.revenue_after > maxStaffRevenue) {
        maxStaffRevenue = s.revenue_after;
        bestStaffName = `${s.staff_name} (${new Intl.NumberFormat("vi-VN").format(Math.round(s.revenue_after))}đ)`;
      }
    });

    const staffTable = Object.values(staffMetrics)
      .filter(s => s.assigned_tasks_from_automation > 0 || s.orders_after > 0)
      .sort((a, b) => b.revenue_after - a.revenue_after);

    return {
      totalTasksCreated,
      completionRate: totalTasksCreated > 0 ? Math.round((completedTasksCount / totalTasksCreated) * 100) : 0,
      overdueRate: totalTasksCreated > 0 ? Math.round((overdueTasksCount / totalTasksCreated) * 100) : 0,
      customersWithActivityCount: customersWithActivity.size,
      ordersCount: attributedOrders.length,
      totalRevenue,
      topRevenueRule: topRevenueRuleName,
      bestStaff: bestStaffName,
      ruleTable,
      staffTable
    };
  }, [dashboardLogs, impactData, rules, profilesList, selectedImpactRuleId, selectedImpactStaffId, selectedImpactStatus, IMPACT_RULES]);

  const handleSaveConfig = async (ruleId: string, ruleName: string) => {
    const config = configValues[ruleId];
    if (!config) return;

    const value = Number(config.threshold_value);
    const unit = config.threshold_unit;

    if (isNaN(value) || value <= 0) {
      toast.error(`Giá trị cấu hình cho "${ruleName}" phải là số lớn hơn 0`);
      return;
    }

    if (unit !== "hours" && unit !== "days") {
      toast.error("Đơn vị thời gian chỉ được chọn Giờ hoặc Ngày");
      return;
    }

    try {
      setSavingRuleId(ruleId);
      const { error } = await supabase
        .from("automation_rules")
        .update({
          threshold_value: value,
          threshold_unit: unit,
          updated_at: new Date().toISOString(),
          updated_by: user?.id
        })
        .eq("id", ruleId);

      if (error) {
        toast.error(`Lỗi khi lưu cấu hình: ${error.message}`);
      } else {
        toast.success(`Đã cập nhật cấu hình quy tắc "${ruleName}"`);
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, threshold_value: value, threshold_unit: unit, updated_at: new Date().toISOString(), updated_by: user?.id } : r));
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi kết nối database");
    } finally {
      setSavingRuleId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">Bạn không có quyền truy cập Automation Center.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  // Dashboard Aggregates & Calculations
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayLogs = useMemo(() => {
    return dashboardLogs.filter(log => new Date(log.created_at) >= todayStart);
  }, [dashboardLogs, todayStart]);

  // KPIs
  const totalRunsToday = todayLogs.length;

  const successCount = useMemo(() => {
    return dashboardLogs.filter(log => log.status === "success").length;
  }, [dashboardLogs]);

  const skippedCount = useMemo(() => {
    return dashboardLogs.filter(log => log.status === "skipped").length;
  }, [dashboardLogs]);

  const partialFailedCount = useMemo(() => {
    return dashboardLogs.filter(log => log.status === "partial_failed").length;
  }, [dashboardLogs]);

  const failedCount = useMemo(() => {
    return dashboardLogs.filter(log => log.status === "failed").length;
  }, [dashboardLogs]);

  const disabledRulesCount = useMemo(() => {
    return rules.filter(r => !r.is_enabled).length;
  }, [rules]);

  const mostRunRule = useMemo(() => {
    if (dashboardLogs.length === 0) return "N/A";
    const counts: Record<string, number> = {};
    dashboardLogs.forEach(log => {
      const id = log.rule_id || log.automation_type;
      counts[id] = (counts[id] || 0) + 1;
    });
    let maxId = "N/A";
    let maxCount = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxId = id;
      }
    });
    const ruleObj = rules.find(r => r.id === maxId);
    return ruleObj ? `${ruleObj.name} (${maxCount} lượt)` : `${maxId} (${maxCount} lượt)`;
  }, [dashboardLogs, rules]);

  const mostFailedRule = useMemo(() => {
    const errorLogs = dashboardLogs.filter(log => log.status === "failed" || log.status === "partial_failed");
    if (errorLogs.length === 0) return "N/A";
    const counts: Record<string, number> = {};
    errorLogs.forEach(log => {
      const id = log.rule_id || log.automation_type;
      counts[id] = (counts[id] || 0) + 1;
    });
    let maxId = "N/A";
    let maxCount = 0;
    Object.entries(counts).forEach(([id, count]) => {
      if (count > maxCount) {
        maxCount = count;
        maxId = id;
      }
    });
    const ruleObj = rules.find(r => r.id === maxId);
    return ruleObj ? `${ruleObj.name} (${maxCount} lỗi)` : `${maxId} (${maxCount} lỗi)`;
  }, [dashboardLogs, rules]);

  const tasksCreatedToday = useMemo(() => {
    return todayLogs.filter(log => log.task_id).length;
  }, [todayLogs]);

  const notificationsCreatedToday = useMemo(() => {
    return todayLogs.filter(log => log.notification_id).length;
  }, [todayLogs]);

  const filteredDashboardLogs = useMemo(() => {
    return dashboardLogs.filter(log => {
      const id = log.rule_id || log.automation_type;
      const matchRule = selectedRuleId === "all" || id === selectedRuleId;
      const matchStatus = selectedStatus === "all" || log.status === selectedStatus;
      return matchRule && matchStatus;
    });
  }, [dashboardLogs, selectedRuleId, selectedStatus]);

  const detailedTableData = useMemo(() => {
    const dataMap: Record<string, {
      rule_id: string;
      rule_name: string;
      total_runs: number;
      success_count: number;
      skipped_count: number;
      failed_count: number;
      last_run_at: string | null;
      last_error_message: string | null;
      is_enabled: boolean;
    }> = {};

    rules.forEach(r => {
      if (selectedRuleId !== "all" && r.id !== selectedRuleId) return;
      dataMap[r.id] = {
        rule_id: r.id,
        rule_name: r.name,
        total_runs: 0,
        success_count: 0,
        skipped_count: 0,
        failed_count: 0,
        last_run_at: null,
        last_error_message: null,
        is_enabled: r.is_enabled
      };
    });

    filteredDashboardLogs.forEach(log => {
      const rId = log.rule_id || log.automation_type;
      if (!dataMap[rId]) {
        dataMap[rId] = {
          rule_id: rId,
          rule_name: rId,
          total_runs: 0,
          success_count: 0,
          skipped_count: 0,
          failed_count: 0,
          last_run_at: null,
          last_error_message: null,
          is_enabled: false
        };
      }

      const row = dataMap[rId];
      row.total_runs += 1;
      if (log.status === "success") {
        row.success_count += 1;
      } else if (log.status === "skipped") {
        row.skipped_count += 1;
      } else if (log.status === "failed" || log.status === "partial_failed") {
        row.failed_count += 1;
        if (!row.last_error_message && log.error_message) {
          row.last_error_message = log.error_message;
        }
      }

      if (!row.last_run_at || new Date(log.created_at) > new Date(row.last_run_at)) {
        row.last_run_at = log.created_at;
      }
    });

    return Object.values(dataMap).sort((a, b) => b.total_runs - a.total_runs);
  }, [rules, filteredDashboardLogs, selectedRuleId]);

  const efficiencyReportData = useMemo(() => {
    const PRIORITY_RULES = [
      "quote_follow_up",
      "post_purchase_checkin",
      "reorder_reminder",
      "customer_at_risk"
    ];

    const dataMap: Record<string, {
      rule_id: string;
      rule_name: string;
      task_created_count: number;
      task_completed_count: number;
      task_overdue_count: number;
      notification_created_count: number;
    }> = {};

    rules.forEach(r => {
      dataMap[r.id] = {
        rule_id: r.id,
        rule_name: r.name,
        task_created_count: 0,
        task_completed_count: 0,
        task_overdue_count: 0,
        notification_created_count: 0
      };
    });

    dashboardLogs.forEach(log => {
      const id = log.rule_id || log.automation_type;
      if (!id || !dataMap[id]) return;

      if (log.task_id) {
        dataMap[id].task_created_count++;
        const task = dashboardTasks.find(t => t.id === log.task_id);
        if (task) {
          if (task.status === "completed") {
            dataMap[id].task_completed_count++;
          } else {
            const isOverdue = task.due_at && new Date(task.due_at) < new Date();
            if (isOverdue) {
              dataMap[id].task_overdue_count++;
            }
          }
        }
      }

      if (log.notification_id) {
        dataMap[id].notification_created_count++;
      }
    });

    return Object.values(dataMap).sort((a, b) => {
      const aPri = PRIORITY_RULES.indexOf(a.rule_id);
      const bPri = PRIORITY_RULES.indexOf(b.rule_id);

      if (aPri !== -1 && bPri !== -1) return aPri - bPri;
      if (aPri !== -1) return -1;
      if (bPri !== -1) return 1;

      return b.task_created_count - a.task_created_count;
    });
  }, [rules, dashboardLogs, dashboardTasks]);

  const efficiencySummary = useMemo(() => {
    let totalTasks = 0;
    let completedTasks = 0;
    let overdueTasks = 0;
    let totalNotifications = 0;

    efficiencyReportData.forEach(row => {
      totalTasks += row.task_created_count;
      completedTasks += row.task_completed_count;
      overdueTasks += row.task_overdue_count;
      totalNotifications += row.notification_created_count;
    });

    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      totalNotifications,
      completionRate
    };
  }, [efficiencyReportData]);

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "app_flow": return "Ứng dụng (App Flow)";
      case "db_trigger": return "Database Trigger";
      case "db_cron": return "Định kỳ (Scheduled)";
      default: return category;
    }
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "app_flow": return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case "db_trigger": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "db_cron": return "bg-amber-50 text-amber-600 border-amber-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success": return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "partial_failed": return "bg-amber-50 text-amber-700 border-amber-100";
      case "failed": return "bg-rose-50 text-rose-700 border-rose-100";
      case "skipped": return "bg-slate-100 text-slate-600 border-slate-200";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "success": return "Thành công";
      case "partial_failed": return "Lỗi một phần";
      case "failed": return "Thất bại";
      case "skipped": return "Bỏ qua";
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* HEADER */}
      <header className="bg-white/80 border-b border-slate-200/60 sticky top-0 z-30 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link to="/workspace" className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200">
              <LayoutDashboard className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Automation Center</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 fill-indigo-500" /> Quản lý các luồng tự động hoá CRM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={() => { reloadRules(); reloadLogs(); reloadDashboardLogs(timeRange); }}
              variant="ghost" 
              size="icon" 
              className="rounded-xl text-slate-400 hover:text-slate-900"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* BANNER FOR IMPORTANT RULES DISABLED */}
        {disabledImportantRules.length > 0 && (
          <div className="mb-6 p-5 bg-gradient-to-r from-amber-50/90 to-orange-50/95 border border-amber-200/60 rounded-[32px] flex items-start gap-4 backdrop-blur-sm shadow-sm">
            <div className="w-10 h-10 bg-amber-100/80 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-amber-600 animate-bounce" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest flex items-center gap-1.5">
                Cảnh báo: Tự động hóa cốt lõi tạm ngưng
              </h4>
              <p className="text-xs text-amber-600 mt-1 font-semibold leading-relaxed">
                Hệ thống phát hiện quy trình tự động hóa quan trọng đang bị tắt. Vui lòng click vào các rule dưới đây để kiểm tra và kích hoạt lại:
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {disabledImportantRules.map(r => (
                  <button
                    key={r.id}
                    onClick={() => handleScrollToRule(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white hover:bg-amber-100 text-amber-700 hover:text-amber-800 border border-amber-200 shadow-sm transition-all hover:scale-105 active:scale-95 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-2 rounded-[24px] shadow-sm border border-slate-100 overflow-x-auto">
            <TabsList className="bg-transparent h-auto p-0 flex gap-2 flex-wrap">
              <TabTrigger value="rules" icon={Zap} label="Tất cả Rules" />
              <TabTrigger value="runs" icon={Activity} label="Nhật ký chạy" />
              <TabTrigger value="config" icon={Settings} label="Trình cấu hình" />
              <TabTrigger value="dashboard" icon={LayoutDashboard} label="Sức khỏe hệ thống" />
              <TabTrigger value="impact" icon={TrendingUp} label="Hiệu quả kinh doanh" />
            </TabsList>
          </div>

          {/* TAB 1: ALL RULES */}
          <TabsContent value="rules" className="space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text"
                  placeholder="Tìm kiếm rules..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium outline-none focus:border-indigo-500 bg-slate-50/50"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <select 
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500 flex-1 sm:flex-none"
                  value={categoryFilter}
                  onChange={e => setCategoryFilter(e.target.value)}
                >
                  <option value="all">Tất cả phân loại</option>
                  <option value="app_flow">Ứng dụng (App Flow)</option>
                  <option value="db_trigger">Database Trigger</option>
                  <option value="db_cron">Định kỳ (Scheduled)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {busy ? (
                <div className="col-span-full py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  Đang đồng bộ cấu hình rules...
                </div>
              ) : filteredRules.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                  Không tìm thấy rule nào
                </div>
              ) : (
                filteredRules.map(rule => (
                  <Card id={rule.id} key={rule.id} className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all flex flex-col justify-between duration-300">
                    <CardHeader className="p-6 pb-3">
                      <div className="flex justify-between items-start gap-4 flex-wrap">
                        <div className="flex gap-2 flex-wrap">
                          <Badge className={`rounded-xl px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider ${getCategoryBadgeColor(rule.category)}`}>
                            {getCategoryLabel(rule.category)}
                          </Badge>
                          {!rule.is_enabled && rule.category === "app_flow" && (
                            <Badge className="rounded-xl px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider bg-rose-50 text-rose-600 border-rose-100 font-extrabold animate-pulse">
                              Đang tắt
                            </Badge>
                          )}
                        </div>
                        <Badge variant="outline" className={`rounded-xl px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${rule.is_configurable ? 'bg-emerald-50/30 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          {rule.is_configurable ? "Cấu hình: Có" : "Cấu hình: Không"}
                        </Badge>
                      </div>
                      <CardTitle className="text-sm font-black text-slate-900 mt-4 leading-tight">
                        {rule.name}
                      </CardTitle>
                      <CardDescription className="text-[10px] font-mono text-slate-400 font-bold mt-1">
                        ID: {rule.id}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 pt-3 flex-1 flex flex-col justify-between gap-6">
                      <div>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                          {rule.description || "Chưa có mô tả."}
                        </p>
                        
                        {/* WARNING IF OFFLINE OVER 24 HOURS */}
                        {!rule.is_enabled && rule.category === "app_flow" && rule.updated_at && (
                          (() => {
                            const offlineMs = new Date().getTime() - new Date(rule.updated_at).getTime();
                            const isOver24h = offlineMs > 24 * 60 * 60 * 1000;
                            if (isOver24h) {
                              return (
                                <div className="mt-3 text-[10px] text-rose-600 bg-rose-50/50 border border-rose-100 rounded-xl p-2.5 flex items-center gap-2 font-bold animate-pulse">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  Rule này đã bị tắt hơn 24h
                                </div>
                              );
                            }
                            return null;
                          })()
                        )}
                      </div>
                      
                      <div className="border-t border-slate-100 pt-4 mt-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {rule.updated_at ? new Date(rule.updated_at).toLocaleDateString("vi-VN") : "N/A"}
                          </span>
                          
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={rule.is_enabled} 
                                disabled={rule.category !== "app_flow" || togglingRuleId === rule.id} 
                                onCheckedChange={async () => {
                                  if (rule.category !== "app_flow") return;
                                  try {
                                    setTogglingRuleId(rule.id);
                                    const newValue = !rule.is_enabled;
                                    const { error } = await supabase
                                      .from("automation_rules")
                                      .update({ is_enabled: newValue })
                                      .eq("id", rule.id);
                                    
                                    if (error) {
                                      toast.error(`Lỗi khi cập nhật rule: ${error.message}`);
                                    } else {
                                      toast.success(`Đã ${newValue ? "bật" : "tắt"} automation "${rule.name}"`);
                                      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_enabled: newValue } : r));
                                    }
                                  } catch (err: any) {
                                    console.error(err);
                                    toast.error("Lỗi kết nối database");
                                  } finally {
                                    setTogglingRuleId(null);
                                  }
                                }}
                                className={rule.category !== "app_flow" ? "opacity-80 cursor-not-allowed" : ""} 
                              />
                              <span className={`text-[9px] font-black uppercase tracking-wider ${rule.is_enabled ? 'text-indigo-600' : 'text-slate-400'}`}>
                                {togglingRuleId === rule.id ? "Đang xử lý..." : (rule.is_enabled ? "Bật" : "Tắt")}
                              </span>
                            </div>
                            {rule.category === "db_trigger" && (
                              <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 rounded-lg px-2 py-0.5 text-[8px] font-bold">
                                Hệ thống lõi - chỉ đọc
                              </Badge>
                            )}
                            {rule.category === "db_cron" && (
                              <Badge variant="outline" className="bg-slate-50 text-slate-400 border-slate-200 rounded-lg px-2 py-0.5 text-[8px] font-bold">
                                Định kỳ - cấu hình sau
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* TAB 2: RUN LOGS */}
          <TabsContent value="runs" className="space-y-6">
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">Nhật ký hoạt động Automation</CardTitle>
                <CardDescription>Lịch sử 100 lượt thực thi tự động hóa gần nhất</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {logsLoading ? (
                  <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Đang tải nhật ký...
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Chưa có nhật ký automation.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <th className="px-8 py-4 text-left">Mã Rule (Rule ID)</th>
                          <th className="px-8 py-4 text-center">Trạng thái</th>
                          <th className="px-8 py-4 text-center">Đối tượng liên quan</th>
                          <th className="px-8 py-4 text-left">Chi tiết lỗi / Metadata</th>
                          <th className="px-8 py-4 text-right">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {logs.map((log) => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-4 font-mono text-xs font-black text-slate-700">
                              {log.rule_id || log.automation_type}
                            </td>
                            <td className="px-8 py-4 text-center">
                              <Badge className={`rounded-xl px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider ${getStatusBadgeColor(log.status)}`}>
                                {getStatusLabel(log.status)}
                              </Badge>
                            </td>
                            <td className="px-8 py-4 text-center text-xs font-bold text-slate-500">
                              {log.entity_type ? `${log.entity_type} (#${log.entity_id?.slice(0, 8)})` : (log.customer_id ? `Customer (#${log.customer_id?.slice(0, 8)})` : "—")}
                            </td>
                            <td className="px-8 py-4 text-xs font-medium text-slate-600 max-w-xs truncate">
                              {log.status === "skipped" ? (
                                <span className="text-slate-500 flex items-center gap-1 font-semibold">
                                  <Clock className="w-3.5 h-3.5 shrink-0" /> Bỏ qua: {log.metadata?.reason || "Duplicate prevention"}
                                </span>
                              ) : log.error_message ? (
                                <span className="text-rose-600 flex items-center gap-1 font-semibold">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {log.error_message}
                                </span>
                              ) : (
                                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Thành công ổn định
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-4 text-right text-xs font-bold text-slate-400">
                              {log.created_at ? new Date(log.created_at).toLocaleString("vi-VN") : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: CONFIGURATION */}
          <TabsContent value="config" className="space-y-6">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-600" />
                  Trình cấu hình tham số Automation
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Điều chỉnh các mốc thời gian, chu kỳ nhắc nhở của các quy tắc tự động hóa ứng dụng.
                </p>
              </div>

              {configurableRules.length === 0 ? (
                <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wider bg-white rounded-[24px] border border-slate-100 shadow-sm">
                  Không có quy tắc cấu hình nào
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6">
                  {configurableRules.map(rule => {
                    const isAppFlow = rule.category === "app_flow";
                    const isSaving = savingRuleId === rule.id;
                    const val = configValues[rule.id]?.threshold_value ?? 0;
                    const unit = configValues[rule.id]?.threshold_unit ?? "days";

                    return (
                      <Card key={rule.id} className="rounded-[24px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all">
                        <div className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm font-black text-slate-900">{rule.name}</span>
                              <Badge className={`rounded-xl px-2.5 py-0.5 text-[8px] font-black uppercase border tracking-wider ${getCategoryBadgeColor(rule.category)}`}>
                                {getCategoryLabel(rule.category)}
                              </Badge>
                              {!isAppFlow && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-100 rounded-xl px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider">
                                  Chỉ đọc - Định kỳ
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 font-medium max-w-xl">
                              {rule.description || "Chưa có mô tả quy tắc."}
                            </p>
                            <div className="text-[10px] font-mono text-slate-400 font-bold">
                              ID: {rule.id}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                            {/* Value Input */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Giá trị</label>
                              <input 
                                type="number" 
                                min="1"
                                disabled={!isAppFlow || isSaving}
                                value={val || ""}
                                onChange={e => {
                                  const newVal = Number(e.target.value);
                                  setConfigValues(prev => ({
                                    ...prev,
                                    [rule.id]: {
                                      ...prev[rule.id],
                                      threshold_value: newVal
                                    }
                                  }));
                                }}
                                className="w-full sm:w-24 h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50/50 focus:bg-white focus:border-indigo-500 outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              />
                            </div>

                            {/* Unit Select */}
                            <div className="flex flex-col gap-1.5">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đơn vị</label>
                              <select
                                disabled={!isAppFlow || isSaving}
                                value={unit}
                                onChange={e => {
                                  const newUnit = e.target.value;
                                  setConfigValues(prev => ({
                                    ...prev,
                                    [rule.id]: {
                                      ...prev[rule.id],
                                      threshold_unit: newUnit
                                    }
                                  }));
                                }}
                                className="w-full sm:w-28 h-11 px-3 rounded-xl border border-slate-200 text-xs font-black bg-white outline-none focus:border-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                              >
                                <option value="hours">Giờ (hours)</option>
                                <option value="days">Ngày (days)</option>
                              </select>
                            </div>

                            {/* Save Button */}
                            <div className="flex flex-col justify-end pt-5 sm:pt-0">
                              <Button
                                disabled={!isAppFlow || isSaving}
                                onClick={() => handleSaveConfig(rule.id, rule.name)}
                                className="h-11 px-6 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 font-black text-xs shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none"
                              >
                                {isSaving ? (
                                  <>
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    Đang lưu...
                                  </>
                                ) : "Lưu cấu hình"}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB 4: AUTOMATION HEALTH DASHBOARD */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* KPI GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* KPI 1 */}
              <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-indigo-50/50 to-indigo-100/10 p-5 hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Chạy hôm nay</span>
                  <Activity className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{totalRunsToday}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Lượt chạy trong ngày</p>
                </div>
              </Card>

              {/* KPI 2 */}
              <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-emerald-50/50 to-emerald-100/10 p-5 hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Thành công</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{successCount}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Trong chu kỳ lọc</p>
                </div>
              </Card>

              {/* KPI 3 */}
              <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Bỏ qua (Skipped)</span>
                  <Clock className="w-5 h-5 text-slate-400" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{skippedCount}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Do tắt/chống trùng</p>
                </div>
              </Card>

              {/* KPI 4 */}
              <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-amber-50/50 to-amber-100/10 p-5 hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Lỗi một phần</span>
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{partialFailedCount}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Thất bại một vài bước</p>
                </div>
              </Card>

              {/* KPI 5 */}
              <Card className="rounded-2xl border-none shadow-sm bg-gradient-to-br from-rose-50/50 to-rose-100/10 p-5 hover:scale-[1.02] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Thất bại (Failed)</span>
                  <XCircle className="w-5 h-5 text-rose-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{failedCount}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Lỗi thực thi nghiêm trọng</p>
                </div>
              </Card>

              {/* KPI 6 */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-5 hover:scale-[1.02] transition-all duration-300 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rule bị tắt</span>
                  <ToggleLeft className="w-5 h-5 text-slate-400" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{disabledRulesCount}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Không hoạt động</p>
                </div>
              </Card>

              {/* KPI 7 */}
              <Card className="col-span-1 sm:col-span-2 rounded-2xl border-none shadow-sm bg-white p-5 hover:scale-[1.01] transition-all duration-300 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-indigo-500 uppercase tracking-wider">Chạy nhiều nhất</span>
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-black text-slate-800 truncate">{mostRunRule}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Rule hoạt động nhiều nhất</p>
                </div>
              </Card>

              {/* KPI 8 */}
              <Card className="col-span-1 sm:col-span-2 rounded-2xl border-none shadow-sm bg-white p-5 hover:scale-[1.01] transition-all duration-300 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider">Lỗi nhiều nhất</span>
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                </div>
                <div className="mt-4">
                  <p className="text-sm font-black text-rose-600 truncate">{mostFailedRule}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Cần kiểm tra kỹ thuật</p>
                </div>
              </Card>

              {/* KPI 9 */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-5 hover:scale-[1.02] transition-all duration-300 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Task tạo hôm nay</span>
                  <FileText className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{tasksCreatedToday}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Công việc phát sinh</p>
                </div>
              </Card>

              {/* KPI 10 */}
              <Card className="rounded-2xl border-none shadow-sm bg-white p-5 hover:scale-[1.02] transition-all duration-300 border border-slate-100">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider">Notif tạo hôm nay</span>
                  <Bell className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="mt-4">
                  <span className="text-2xl font-black text-slate-800">{notificationsCreatedToday}</span>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase">Thông báo phát sinh</p>
                </div>
              </Card>
            </div>

            {/* FILTERS */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm mt-6">
              <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-500 fill-rose-500 animate-pulse" />
                Bộ lọc chỉ số sức khỏe
              </div>
              <div className="flex flex-wrap gap-3 w-full sm:w-auto">
                {/* Time Range Filter */}
                <select 
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500 flex-1 sm:flex-none"
                  value={timeRange}
                  onChange={e => setTimeRange(e.target.value as any)}
                >
                  <option value="today">Hôm nay</option>
                  <option value="7days">7 ngày qua</option>
                  <option value="30days">30 ngày qua</option>
                </select>

                {/* Rule Filter */}
                <select 
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500 flex-1 sm:flex-none max-w-xs"
                  value={selectedRuleId}
                  onChange={e => setSelectedRuleId(e.target.value)}
                >
                  <option value="all">Tất cả Rules</option>
                  {rules.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select 
                  className="h-10 px-4 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500 flex-1 sm:flex-none"
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                >
                  <option value="all">Tất cả Trạng thái</option>
                  <option value="success">Thành công</option>
                  <option value="skipped">Bỏ qua</option>
                  <option value="failed">Thất bại</option>
                  <option value="partial_failed">Lỗi một phần</option>
                </select>
              </div>
            </div>

            {/* DETAILED TABLE */}
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white mt-6">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  Bảng phân tích chi tiết quy tắc
                </CardTitle>
                <CardDescription>
                  Thống kê hiệu năng của từng quy tắc tự động hóa dựa trên bộ lọc đã chọn
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {dashboardLoading ? (
                  <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Đang tính toán dữ liệu sức khỏe...
                  </div>
                ) : detailedTableData.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Không tìm thấy dữ liệu phù hợp với bộ lọc.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <th className="px-8 py-4 text-left">Quy tắc (Rule)</th>
                          <th className="px-6 py-4 text-center">Trạng thái hoạt động</th>
                          <th className="px-6 py-4 text-center">Tổng lượt chạy</th>
                          <th className="px-6 py-4 text-center">Thành công</th>
                          <th className="px-6 py-4 text-center">Bỏ qua</th>
                          <th className="px-6 py-4 text-center">Thất bại</th>
                          <th className="px-6 py-4 text-left">Lần chạy cuối cùng</th>
                          <th className="px-8 py-4 text-left">Thông điệp lỗi gần nhất</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {detailedTableData.map((row) => (
                          <tr key={row.rule_id} className="hover:bg-slate-50/50 transition-all">
                            <td className="px-8 py-4">
                              <div className="font-black text-slate-800 text-xs">{row.rule_name}</div>
                              <div className="text-[10px] text-slate-400 font-mono font-bold">ID: {row.rule_id}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge className={`rounded-xl px-2.5 py-1 text-[9px] font-black uppercase border tracking-wider ${row.is_enabled ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                {row.is_enabled ? "Đang bật" : "Đang tắt"}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-slate-700 text-xs">
                              {row.total_runs}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-emerald-600 text-xs">
                              {row.success_count}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-slate-500 text-xs">
                              {row.skipped_count}
                            </td>
                            <td className="px-6 py-4 text-center font-bold text-rose-600 text-xs">
                              {row.failed_count}
                            </td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">
                              {row.last_run_at ? new Date(row.last_run_at).toLocaleString("vi-VN") : "Chưa từng chạy"}
                            </td>
                            <td className="px-8 py-4 text-xs font-medium text-rose-600 max-w-xs truncate">
                              {row.last_error_message ? (
                                <span className="flex items-center gap-1">
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                  {row.last_error_message}
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* EFFICIENCY REPORT */}
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white mt-6">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Báo cáo hiệu quả Tự động hóa
                </CardTitle>
                <CardDescription>
                  Thống kê số lượng Task, Notification được tạo, hoàn thành hoặc quá hạn cho từng quy tắc
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {/* GLOBAL EFFICIENCY KPI GRID */}
                {!dashboardLoading && efficiencyReportData.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 mb-6 mt-2 px-8">
                    {/* KPI 1: Total Tasks Created */}
                    <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Tổng Task đã tạo</span>
                      <span className="text-xl font-black text-slate-800 mt-2">{efficiencySummary.totalTasks}</span>
                    </div>

                    {/* KPI 2: Completed Tasks */}
                    <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100/30 flex flex-col justify-between">
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Task Hoàn thành</span>
                      <span className="text-xl font-black text-emerald-700 mt-2">{efficiencySummary.completedTasks}</span>
                    </div>

                    {/* KPI 3: Overdue Tasks */}
                    <div className={`p-4 rounded-2xl border flex flex-col justify-between transition-all ${
                      efficiencySummary.overdueTasks > 0 
                        ? 'bg-rose-50/30 border-rose-100/50 text-rose-700 font-extrabold animate-pulse' 
                        : 'bg-slate-50/60 border-slate-100'
                    }`}>
                      <span className={`text-[9px] font-black uppercase tracking-wider ${efficiencySummary.overdueTasks > 0 ? 'text-rose-600' : 'text-slate-500'}`}>Task Quá hạn</span>
                      <span className="text-xl font-black mt-2">{efficiencySummary.overdueTasks}</span>
                    </div>

                    {/* KPI 4: Completion Rate */}
                    <div className="p-4 bg-indigo-50/30 rounded-2xl border border-indigo-100/30 flex flex-col justify-between">
                      <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider">Hiệu suất hoàn thành</span>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xl font-black text-indigo-700">{efficiencySummary.completionRate}%</span>
                        <div className="w-12 bg-indigo-100 rounded-full h-1.5 overflow-hidden shrink-0">
                          <div 
                            className="h-full bg-indigo-600 rounded-full" 
                            style={{ width: `${efficiencySummary.completionRate}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* KPI 5: Notifications Sent */}
                    <div className="p-4 bg-slate-50/60 rounded-2xl border border-slate-100 flex flex-col justify-between">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Notification đã gửi</span>
                      <span className="text-xl font-black text-slate-800 mt-2">{efficiencySummary.totalNotifications}</span>
                    </div>
                  </div>
                )}

                {dashboardLoading ? (
                  <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Đang tính toán dữ liệu hiệu quả...
                  </div>
                ) : efficiencyReportData.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    Không tìm thấy dữ liệu báo cáo phù hợp.
                  </div>
                ) : (
                  <div className="overflow-x-auto border-t border-slate-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                          <th className="px-8 py-4 text-left">Quy tắc (Rule)</th>
                          <th className="px-6 py-4 text-center">Task Đã tạo</th>
                          <th className="px-6 py-4 text-center">Task Hoàn thành</th>
                          <th className="px-6 py-4 text-center">Task Quá hạn</th>
                          <th className="px-6 py-4 text-center">Tỷ lệ hoàn thành</th>
                          <th className="px-8 py-4 text-center">Notification đã gửi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {efficiencyReportData.map((row) => {
                          const hasTasks = row.task_created_count > 0;
                          const completionRate = hasTasks 
                            ? Math.round((row.task_completed_count / row.task_created_count) * 100)
                            : 0;
                          const PRIORITY_RULES = [
                            "quote_follow_up",
                            "post_purchase_checkin",
                            "reorder_reminder",
                            "customer_at_risk"
                          ];
                          const isPriority = PRIORITY_RULES.includes(row.rule_id);

                          return (
                            <tr key={row.rule_id} className={`hover:bg-slate-50/50 transition-all ${isPriority ? 'bg-indigo-50/10' : ''}`}>
                              <td className="px-8 py-4">
                                <div className="flex items-center gap-2">
                                  <div className="font-black text-slate-800 text-xs">{row.rule_name}</div>
                                  {isPriority && (
                                    <Badge className="rounded-xl px-2 py-0.5 text-[8px] font-black uppercase tracking-wider bg-indigo-500 text-white border-none">
                                      Ưu tiên
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono font-bold">ID: {row.rule_id}</div>
                              </td>
                              <td className="px-6 py-4 text-center font-black text-slate-700 text-xs">
                                {row.task_created_count}
                              </td>
                              <td className="px-6 py-4 text-center font-bold text-emerald-600 text-xs">
                                {row.task_completed_count}
                              </td>
                              <td className={`px-6 py-4 text-center font-bold text-xs ${row.task_overdue_count > 0 ? 'text-rose-600 font-black animate-pulse' : 'text-slate-400'}`}>
                                {row.task_overdue_count}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="text-[10px] font-bold text-slate-600">{completionRate}%</span>
                                  {hasTasks ? (
                                    <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          completionRate >= 80 ? 'bg-emerald-500' :
                                          completionRate >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${completionRate}%` }}
                                      />
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-slate-300 font-normal">—</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-4 text-center font-bold text-indigo-600 text-xs">
                                {row.notification_created_count}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: BUSINESS IMPACT */}
          <TabsContent value="impact" className="space-y-6">
            {/* DISCLAIMER BANNER */}
            <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-[24px] flex items-start gap-3 shadow-xs">
              <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-indigo-700 font-bold leading-relaxed">
                  Lưu ý ước tính phân bổ doanh thu
                </p>
                <p className="text-[11px] text-indigo-600 font-medium mt-0.5 leading-relaxed">
                  Doanh thu này là ước tính theo đơn phát sinh trong vòng 7 ngày sau automation gần nhất của cùng khách, không phải doanh thu được gán chính thức. Số liệu này đóng vai trò chỉ số tham khảo đánh giá hiệu suất.
                </p>
              </div>
            </div>

            {/* FILTERS FOR BUSINESS IMPACT */}
            <div className="flex flex-col sm:flex-row items-center gap-4 justify-between bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center w-full">
                {/* FILTER: Rule */}
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lọc theo quy tắc</label>
                  <select 
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500"
                    value={selectedImpactRuleId}
                    onChange={e => setSelectedImpactRuleId(e.target.value)}
                  >
                    <option value="all">Tất cả quy tắc kinh doanh</option>
                    <option value="lead_assigned">lead_assigned (Hạn gọi lead)</option>
                    <option value="quote_follow_up">quote_follow_up (Theo dõi báo giá)</option>
                    <option value="post_purchase_checkin">post_purchase_checkin (Thăm hỏi đơn hàng)</option>
                    <option value="reorder_reminder">reorder_reminder (Nhắc đặt hàng lại)</option>
                    <option value="customer_at_risk">customer_at_risk (Khách có rủi ro rời bỏ)</option>
                  </select>
                </div>

                {/* FILTER: Staff */}
                <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lọc theo nhân sự</label>
                  <select 
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500"
                    value={selectedImpactStaffId}
                    onChange={e => setSelectedImpactStaffId(e.target.value)}
                  >
                    <option value="all">Tất cả nhân sự</option>
                    <option value="unknown">Chưa xác định</option>
                    {profilesList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name || p.email?.split("@")[0] || p.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </div>

                {/* FILTER: Automation Status */}
                <div className="flex flex-col gap-1 flex-1 min-w-[150px]">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Trạng thái Automation</label>
                  <select 
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-white outline-none focus:border-indigo-500"
                    value={selectedImpactStatus}
                    onChange={e => setSelectedImpactStatus(e.target.value)}
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="success">Thành công</option>
                    <option value="skipped">Bỏ qua</option>
                    <option value="failed">Thất bại</option>
                    <option value="partial_failed">Lỗi một phần</option>
                  </select>
                </div>

                {/* FILTER: Time Range */}
                <div className="flex flex-col gap-1 flex-none w-32">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Mốc thời gian</label>
                  <select 
                    className="h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold bg-indigo-50 text-indigo-700 outline-none focus:border-indigo-500"
                    value={timeRange}
                    onChange={e => {
                      const newRange = e.target.value as any;
                      setTimeRange(newRange);
                      reloadDashboardLogs(newRange);
                    }}
                  >
                    <option value="today">Hôm nay</option>
                    <option value="7days">7 ngày qua</option>
                    <option value="30days">30 ngày qua</option>
                  </select>
                </div>
              </div>
            </div>

            {dashboardLoading ? (
              <div className="py-20 text-center animate-pulse text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                Đang tính toán hiệu quả kinh doanh...
              </div>
            ) : dashboardLogs.length === 0 ? (
              <Card className="rounded-[32px] border-none shadow-sm p-12 text-center bg-white">
                <CardContent className="space-y-3">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                  <p className="text-sm font-black text-slate-400 uppercase tracking-widest">
                    Chưa có dữ liệu automation.
                  </p>
                  <p className="text-xs text-slate-400">
                    Không tìm thấy dữ liệu lượt chạy nào của tự động hóa trong khoảng thời gian được lọc.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* KPI CARDS GRID */}
                <TooltipProvider>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {/* KPI 1: Tasks created */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tổng Task đã tạo</span>
                            <Tooltip>
                              <TooltipTrigger className="text-slate-400 hover:text-slate-600 outline-none">
                                <HelpCircle className="w-3.5 h-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Số lượng công việc tự động tạo cho Sale/Tele chăm sóc khách hàng</span>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mt-2">{businessImpactMetrics.totalTasksCreated}</h3>
                          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mt-1">Từ các quy tắc chính</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
                          <FileText className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 2: Task Completion Rate */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Hiệu suất hoàn thành</span>
                          <h3 className="text-2xl font-black text-emerald-700 mt-2">{businessImpactMetrics.completionRate}%</h3>
                          <div className="w-24 bg-emerald-50 rounded-full h-1.5 overflow-hidden mt-2">
                            <div 
                              className="h-full bg-emerald-500 rounded-full" 
                              style={{ width: `${businessImpactMetrics.completionRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 3: Task Overdue Rate */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ quá hạn</span>
                          <h3 className={`text-2xl font-black mt-2 ${businessImpactMetrics.overdueRate > 15 ? 'text-rose-600 animate-pulse' : 'text-slate-800'}`}>
                            {businessImpactMetrics.overdueRate}%
                          </h3>
                          <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden mt-2">
                            <div 
                              className={`h-full rounded-full ${businessImpactMetrics.overdueRate > 15 ? 'bg-rose-500' : 'bg-slate-400'}`} 
                              style={{ width: `${businessImpactMetrics.overdueRate}%` }}
                            />
                          </div>
                        </div>
                        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500">
                          <XCircle className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 4: Customers Active After */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Khách được tương tác</span>
                            <Tooltip>
                              <TooltipTrigger className="text-slate-400 hover:text-slate-600 outline-none">
                                <HelpCircle className="w-3.5 h-3.5" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <span>Số khách hàng phát sinh hoạt động chăm sóc thực tế trong vòng 7 ngày sau khi nhận được tự động hóa</span>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <h3 className="text-2xl font-black text-slate-800 mt-2">{businessImpactMetrics.customersWithActivityCount}</h3>
                          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mt-1">Được chăm sóc thành công</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                          <Users className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 5: Orders closed after */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Đơn hàng phát sinh</span>
                          <h3 className="text-2xl font-black text-slate-800 mt-2">{businessImpactMetrics.ordersCount} đơn</h3>
                          <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider mt-1">Đạt điều kiện 7 ngày</p>
                        </div>
                        <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                          <Target className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 6: Attributed revenue */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-slate-900 text-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-1">
                            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Doanh thu phát sinh</span>
                            <Tooltip>
                              <TooltipTrigger className="text-slate-300 hover:text-white outline-none">
                                <HelpCircle className="w-3.5 h-3.5" />
                              </TooltipTrigger>
                              <TooltipContent className="bg-slate-800 text-white">
                                <span>Doanh thu từ các đơn hàng được tạo trong vòng 7 ngày sau tự động hóa</span>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                          <h3 className="text-xl font-black mt-2 text-indigo-300">
                            {new Intl.NumberFormat("vi-VN").format(Math.round(businessImpactMetrics.totalRevenue))}đ
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">Ước tính hiệu quả</p>
                        </div>
                        <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                          <DollarSign className="w-6 h-6" />
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 7: Top Revenue Rule */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Quy tắc hiệu quả nhất</span>
                          <h3 className="text-xs font-black text-slate-800 mt-2 truncate" title={businessImpactMetrics.topRevenueRule}>
                            {businessImpactMetrics.topRevenueRule}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">Đóng góp doanh số cao nhất</p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* KPI 8: Top Staff */}
                    <Card className="rounded-[24px] border-none shadow-sm bg-white hover:shadow-md transition-all">
                      <CardContent className="p-6 flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">Nhân sự chăm sóc tốt nhất</span>
                          <h3 className="text-xs font-black text-slate-800 mt-2 truncate" title={businessImpactMetrics.bestStaff}>
                            {businessImpactMetrics.bestStaff}
                          </h3>
                          <p className="text-[9px] font-bold text-slate-400 mt-1">Dựa trên doanh số mang lại</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TooltipProvider>

                {/* Attributed Orders Empty State Check */}
                {businessImpactMetrics.ordersCount === 0 && (
                  <div className="p-6 bg-amber-50/50 border border-amber-100 rounded-[24px] text-center text-xs text-amber-700 font-bold my-4">
                    ⚠️ Chưa có đơn hàng phát sinh sau automation trong khoảng thời gian này.
                  </div>
                )}

                {/* RULE PERFORMANCE TABLE */}
                <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      Phân tích hiệu quả theo Quy tắc tự động hóa
                    </CardTitle>
                    <CardDescription>
                      Bảng xếp hạng đóng góp doanh thu và hiệu suất phản hồi của từng quy tắc cốt lõi
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <th className="px-8 py-4 text-left">Quy tắc (Rule Name)</th>
                            <th className="px-6 py-4 text-center">Task đã tạo</th>
                            <th className="px-6 py-4 text-center">Task hoàn thành</th>
                            <th className="px-6 py-4 text-center">Task quá hạn</th>
                            <th className="px-6 py-4 text-center">Hoạt động CSKH sau đó</th>
                            <th className="px-6 py-4 text-center">Số đơn hàng phát sinh</th>
                            <th className="px-6 py-4 text-right">Doanh thu phát sinh</th>
                            <th className="px-8 py-4 text-center">Tỷ lệ chuyển đổi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {businessImpactMetrics.ruleTable.map((row) => (
                            <tr key={row.rule_id} className="hover:bg-slate-50/50 transition-all font-medium text-slate-650">
                              <td className="px-8 py-4">
                                <div className="font-black text-slate-800 text-xs">{row.rule_name}</div>
                                <div className="text-[9px] text-slate-400 font-mono font-bold">ID: {row.rule_id}</div>
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-black text-slate-700">
                                {row.task_created_count}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-emerald-600">
                                {row.task_completed_count}
                              </td>
                              <td className={`px-6 py-4 text-center text-xs font-bold ${row.task_overdue_count > 0 ? 'text-rose-600 font-black animate-pulse' : 'text-slate-400'}`}>
                                {row.task_overdue_count}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-slate-650">
                                {row.activity_after_count}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-slate-700">
                                {row.orders_after_count}
                              </td>
                              <td className="px-6 py-4 text-right text-xs font-black text-slate-900 font-mono">
                                {new Intl.NumberFormat("vi-VN").format(Math.round(row.revenue_after))}đ
                              </td>
                              <td className="px-8 py-4 text-center text-xs font-black text-indigo-600">
                                {row.conversion_rate}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* STAFF PERFORMANCE TABLE */}
                <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
                  <CardHeader className="p-8 pb-4">
                    <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Users className="w-5 h-5 text-indigo-600" />
                      Hiệu suất xử lý & đóng góp của Nhân sự
                    </CardTitle>
                    <CardDescription>
                      Theo dõi khả năng chuyển đổi đơn hàng và tốc độ hoàn thành công việc được giao từ automation
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                            <th className="px-8 py-4 text-left">Nhân sự (Staff Name)</th>
                            <th className="px-6 py-4 text-center">Số Task được giao</th>
                            <th className="px-6 py-4 text-center">Đã hoàn thành</th>
                            <th className="px-6 py-4 text-center">Quá hạn</th>
                            <th className="px-6 py-4 text-center">Đơn hàng mang lại</th>
                            <th className="px-8 py-4 text-right">Doanh thu mang lại</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {businessImpactMetrics.staffTable.map((row) => (
                            <tr key={row.staff_id} className="hover:bg-slate-50/50 transition-all font-medium text-slate-650">
                              <td className="px-8 py-4 font-black text-slate-800 text-xs">
                                {row.staff_name}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-slate-700">
                                {row.assigned_tasks_from_automation}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-emerald-600">
                                {row.completed_tasks}
                              </td>
                              <td className={`px-6 py-4 text-center text-xs font-bold ${row.overdue_tasks > 0 ? 'text-rose-600 font-black animate-pulse' : 'text-slate-400'}`}>
                                {row.overdue_tasks}
                              </td>
                              <td className="px-6 py-4 text-center text-xs font-bold text-slate-700">
                                {row.orders_after}
                              </td>
                              <td className="px-8 py-4 text-right text-xs font-black text-slate-900 font-mono">
                                {new Intl.NumberFormat("vi-VN").format(Math.round(row.revenue_after))}đ
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
