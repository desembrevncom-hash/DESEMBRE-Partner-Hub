import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useState, useEffect, useMemo } from "react";
import { format, formatDistanceToNow, differenceInDays } from "date-fns";
import { vi } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Plus,
  Search,
  Filter,
  Layers,
  Zap,
  TrendingUp,
  ChevronRight,
  MoreVertical,
  LayoutDashboard,
  Phone,
  MessageSquare,
  Facebook,
  MapPin,
  FileText,
  BadgeCheck,
  PhoneCall,
  Star,
  Activity,
  CheckSquare,
  ArrowRight,
  ShieldCheck,
  XCircle,
  BarChart3,
  Calendar,
  MoreHorizontal,
  Download,
  AlertCircle,
  Mail,
  Lock,
  UserPlus,
  AlertTriangle,
  Clock,
  Play,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  SALES_PIPELINE_STAGES,
  getPipelineStageColor,
  getPipelineStageLabel,
  mapLegacyStageToNew,
} from "@/lib/salesPipeline";
import { customerRiskLabels } from "@/lib/workspaceFilterMapping";
import { classifyCustomerLifecycle } from "@/lib/customerOwnership";
import { getCustomerVisualState } from "@/lib/customerVisualState";
import { getCustomerConversationState } from "@/lib/customerConversationState";
import { getCustomerCardBadges } from "@/lib/customers/cardBadges";
import { getPriorityScore, getStaleSignals, getSuggestedNextAction } from "@/lib/operationalRules";
import { buildStaffMap, getStaffDisplayName, getStaffInitials, StaffMap } from "@/lib/staffDisplay";
import { QuickCallResultDialog } from "@/components/customers/QuickCallResultDialog";
import { AddCustomerDialog } from "@/components/customers/AddCustomerDialog";
import { getCustomerCardTitle, getCustomerPersonDisplayName } from "@/lib/customers/customerDisplayName";
import { formatPhoneForDisplay, formatPhoneForCallHref, formatPhoneForZalo, getCustomerPrimaryPhone } from "@/lib/customers/phoneUtils";
import { toSafeString, safeLower, safeIncludes } from "@/lib/utils/safeString";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VIETNAM_PROVINCES, stripAccents, findProvinceByName } from "@/lib/vietnamProvinces";
import { Check, ChevronsUpDown, Map as MapIcon } from "lucide-react";
import { trackKanbanDrag, trackSearch, trackFilterUsage, trackDrawerOpen } from "@/lib/uxTracking";
import { useCRMShortcuts } from "@/lib/keyboardShortcuts";
import { FocusQueueBar } from "@/components/customers/FocusQueueBar";
import { InlineCustomerActions } from "@/components/customers/InlineCustomerActions";
import { DataHealthBadge } from "@/components/customers/DataHealthBadge";
import { getCustomerDataHealth } from "@/lib/customers/dataHealth";

import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";
import { CRMCard } from "@/components/crm/CRMCard";
import { CRMStatusBadge } from "@/components/crm/CRMStatusBadge";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";

export const Route = createFileRoute("/customers/")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      stage: search.stage as string | undefined,
      risk: search.risk as string | undefined,
    };
  },
  component: CustomersPage,
});

function CustomersPage() {
  const { user, isAdmin, isSubAdmin, isTeleLead, isTelesale, isSale } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<StaffMap>({});
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [customerTasks, setCustomerTasks] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "list">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("crm_customers_view_mode");
      if (saved === "list" || saved === "kanban") return saved;
      return window.innerWidth < 768 ? "list" : "kanban";
    }
    return "kanban";
  });
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.id });

  const activeStage = search.stage || "all";
  const smartFilter = search.risk || "all";
  const [cityFilter, setCityFilter] = useState<string>("all");

  const setActiveStage = (val: string) =>
    navigate({
      search: (prev: any) => ({ ...prev, stage: val === "all" ? undefined : val }),
      replace: true,
    });
  const setSmartFilter = (val: string) => {
    trackFilterUsage(val);
    navigate({
      search: (prev: any) => ({ ...prev, risk: val === "all" ? undefined : val }),
      replace: true,
    });
  };

  const topScrollRef = React.useRef<HTMLDivElement>(null);
  const bottomScrollRef = React.useRef<HTMLDivElement>(null);

  const handleTopScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
  };

  const handleBottomScroll = () => {
    if (bottomScrollRef.current && topScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
  };

  const [draggedCustomerId, setDraggedCustomerId] = useState<string | null>(null);

  // Bulk selection and dispatch state
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [dispatchAction, setDispatchAction] = useState<
    "assign_sale" | "assign_tele" | "revoke" | "change_stage"
  >("assign_sale");
  const [dispatchStaffId, setDispatchStaffId] = useState<string>("none");
  const [dispatchReason, setDispatchReason] = useState("");
  const [isDispatching, setIsDispatching] = useState(false);

  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // Quick Log State
  const [logTarget, setLogTarget] = useState<any | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [previewCustomer, _setPreviewCustomer] = useState<any | null>(null);

  const setPreviewCustomer = (customer: any | null) => {
    _setPreviewCustomer(customer);
    if (customer) {
      trackDrawerOpen(customer.id);
    }
  };

  const handleNextCustomer = () => {
    if (!previewCustomer) return;
    const idx = filteredCustomers.findIndex((c) => c.id === previewCustomer.id);
    if (idx !== -1 && idx < filteredCustomers.length - 1) {
      setPreviewCustomer(filteredCustomers[idx + 1]);
    }
  };

  const handlePrevCustomer = () => {
    if (!previewCustomer) return;
    const idx = filteredCustomers.findIndex((c) => c.id === previewCustomer.id);
    if (idx !== -1 && idx > 0) {
      setPreviewCustomer(filteredCustomers[idx - 1]);
    }
  };

  useCRMShortcuts(
    {
      onSearchFocus: () => document.getElementById("search-customers-input")?.focus(),
      onNextCustomer: handleNextCustomer,
      onPrevCustomer: handlePrevCustomer,
      onClose: () => {
        setPreviewCustomer(null);
        setIsAddDialogOpen(false);
      },
    },
    true,
  );

  // Kanban Optimization States
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCustomerId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, newStage: string) => {
    e.preventDefault();
    if (!draggedCustomerId) return;

    const customer = customers.find((c) => c.id === draggedCustomerId);
    if (!customer) return;

    if (newStage === "lead_new") {
      toast.error("Không thể kéo về Lead Mới. Vui lòng chọn khách hàng và dùng nút Thu hồi.");
      setDraggedCustomerId(null);
      return;
    }

    if (!customer.owner_sale_id && !customer.owner_tele_id) {
      toast.error(
        "Khách hàng chưa được phân công. Vui lòng dùng nút Chia Lead trước khi chuyển giai đoạn.",
      );
      setDraggedCustomerId(null);
      return;
    }

    // Optimistic update
    setCustomers((prev) =>
      prev.map((c) => (c.id === draggedCustomerId ? { ...c, lifecycle_stage: newStage } : c)),
    );

    try {
      const { error } = await supabase
        .from("customers")
        .update({ lifecycle_stage: newStage })
        .eq("id", draggedCustomerId);
      if (error) throw error;
      toast.success("Đã cập nhật giai đoạn khách hàng");
      trackKanbanDrag(newStage, true);
    } catch (error: any) {
      toast.error("Lỗi cập nhật: " + error.message);
      fetchCustomers(); // revert
      trackKanbanDrag(newStage, false);
    }
    setDraggedCustomerId(null);
  };

  const toggleColumn = (stageValue: string) => {
    setCollapsedColumns((prev) => ({ ...prev, [stageValue]: !prev[stageValue] }));
  };

  useEffect(() => {
    fetchCustomers();
  }, [user]);

  useEffect(() => {
    const handleOpenPreview = (e: CustomEvent) => {
      const { customerId } = e.detail;
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setPreviewCustomer(customer);
      }
    };

    const handleRefresh = () => {
      fetchCustomers();
    };

    window.addEventListener("open-customer-preview" as any, handleOpenPreview);
    window.addEventListener("refresh_customers_list", handleRefresh);

    return () => {
      window.removeEventListener("open-customer-preview" as any, handleOpenPreview);
      window.removeEventListener("refresh_customers_list", handleRefresh);
    };
  }, [customers]);

  const handleExport = async (exportType: "active" | "deleted" = "active") => {
    try {
      let query = supabase.from("customers").select("*");
      if (exportType === "active") {
        query = query.is("deleted_at", null);
      } else {
        query = query.not("deleted_at", "is", null);
      }

      // Role-based logic (Strict ownership)
      if (!isAdmin) {
        if (isSale) query = query.eq("owner_sale_id", user?.id);
        if (isTelesale || isTeleLead) query = query.eq("owner_tele_id", user?.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Không có dữ liệu để xuất!");
        return;
      }

      // Convert to CSV
      const headers = [
        "ID",
        "Tên cơ sở",
        "Tên liên hệ",
        "Số điện thoại",
        "Số ĐT chuẩn hóa",
        "Địa chỉ",
        "Kênh tiếp cận",
        "Mô hình chăm sóc",
        "Báo giá/Tiềm năng",
        "Hạng mức",
        "Sale phụ trách ID",
        "Tele phụ trách ID",
        "Ngày tạo",
        "Lý do xóa",
        "Người xóa ID",
        "Ngày xóa",
      ];

      const csvRows = [
        headers.join(","),
        ...data.map((c: any) =>
          [
            toSafeString(c.id),
            `"${toSafeString(c.facility_name).replace(/"/g, '""')}"`,
            `"${toSafeString(c.name).replace(/"/g, '""')}"`,
            `"${toSafeString(c.phone)}"`,
            `"${toSafeString(c.normalized_phone)}"`,
            `"${toSafeString(c.address).replace(/"/g, '""')}"`,
            toSafeString(c.customer_channel),
            toSafeString(c.care_model),
            toSafeString(c.status),
            toSafeString(c.lifecycle_stage),
            toSafeString(c.owner_sale_id),
            toSafeString(c.owner_tele_id),
            toSafeString(c.created_at),
            `"${toSafeString(c.delete_reason).replace(/"/g, '""')}"`,
            toSafeString(c.deleted_by),
            toSafeString(c.deleted_at),
          ].join(","),
        ),
      ];

      const csvContent = "\uFEFF" + csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `DESEMBRE_Customers_${exportType}_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success(`Đã xuất thành công ${data.length} dòng dữ liệu (${exportType})!`);
    } catch (e: any) {
      toast.error("Không thể xuất dữ liệu: " + e.message);
    }
  };

  const handleBulkDispatch = async () => {
    if (dispatchAction === "revoke" && !dispatchReason.trim()) {
      toast.error("Vui lòng nhập lý do thu hồi.");
      return;
    }
    if (dispatchAction !== "revoke" && dispatchStaffId === "none") {
      toast.error("Vui lòng chọn nhân viên/giai đoạn.");
      return;
    }

    setIsDispatching(true);
    try {
      if (dispatchAction === "change_stage") {
        const { error } = await supabase
          .from("customers")
          .update({ lifecycle_stage: dispatchStaffId })
          .in("id", selectedCustomers);
        if (error) throw error;
        toast.success(`Đã chuyển giai đoạn cho ${selectedCustomers.length} khách hàng.`);
      } else if (dispatchAction === "revoke") {
        const { error } = await supabase.rpc("revoke_customer_assignment", {
          p_customer_ids: selectedCustomers,
          p_reason: dispatchReason,
        });
        if (error) throw error;
        toast.success(`Đã thu hồi ${selectedCustomers.length} khách hàng.`);
      } else {
        const { error } = await supabase.rpc("bulk_assign_customers", {
          p_customer_ids: selectedCustomers,
          p_sale_id: dispatchAction === "assign_sale" ? dispatchStaffId : null,
          p_update_sale: dispatchAction === "assign_sale",
          p_tele_id: dispatchAction === "assign_tele" ? dispatchStaffId : null,
          p_update_tele: dispatchAction === "assign_tele",
          p_reason: dispatchReason || null,
        });
        if (error) throw error;
        toast.success(`Đã gán thành công ${selectedCustomers.length} khách hàng.`);
      }

      setIsDispatchDialogOpen(false);
      setSelectedCustomers([]);
      setDispatchReason("");
      setDispatchStaffId("none");
      fetchCustomers();
    } catch (err: any) {
      console.error(err);
      toast.error("Có lỗi xảy ra: " + err.message);
    } finally {
      setIsDispatching(false);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("customers")
        .select(
          "id, created_at, name, facility_name, contact_name, business_name, email, phone, city, address, owner_sale_id, owner_tele_id, lifecycle_stage, ownership_status, customer_channel, source, status, customer_distance_type, next_follow_up_at, last_contacted_at, last_activity_at, latitude, longitude, orders(id, total, status)",
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Role-based logic (Strict ownership)
      if (!isAdmin) {
        if (!user?.id) {
          setCustomers([]);
          setLoading(false);
          return;
        }
        if (isSale && (isTelesale || isTeleLead)) {
          query = query.or(`owner_sale_id.eq.${user.id},owner_tele_id.eq.${user.id}`);
        } else if (isSale) {
          query = query.eq("owner_sale_id", user.id);
        } else if (isTelesale || isTeleLead) {
          query = query.eq("owner_tele_id", user.id);
        }
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch pending tasks to support KPI filter linkage
      if (user?.id) {
        let tasksQuery = supabase
          .from("customer_tasks")
          .select("customer_id, task_type, title, status")
          .eq("status", "pending");

        if (!isAdmin && !isSubAdmin) {
          tasksQuery = tasksQuery.eq("assigned_to", user.id);
        }

        const { data: tasksData } = await tasksQuery;
        setCustomerTasks(tasksData || []);
      }

      // Apply hierarchical lifecycle classification to ensure data integrity
      const processed = (data || []).map((c: any) => ({
        ...c,
        lifecycle_stage: classifyCustomerLifecycle(c, c.orders || []),
      }));

      // --- ADD INTELLIGENCE FETCH HERE ---
      const cIds = processed.map((c: any) => c.id);
      if (cIds.length > 0) {
        const { data: intelData, error: intelError } = await supabase.rpc(
          "get_customer_list_intelligence",
          {
            p_customer_ids: cIds,
          },
        );
        if (!intelError && intelData) {
          const intelMap = new Map(intelData.map((i: any) => [i.customer_id, i] as [string, any]));
          processed.forEach((c: any) => {
            const intel = intelMap.get(c.id);
            if (intel) {
              c.sales_intelligence = intel;
            }
          });
        } else if (intelError) {
          console.error("fetch intelligence error:", intelError);
        }

        const { data: channelData, error: channelError } = await supabase.rpc(
          "get_customer_channel_summary",
          {
            p_customer_ids: cIds,
          },
        );
        if (!channelError && channelData) {
          const channelMap = new Map(
            channelData.map((i: any) => [i.customer_id, i] as [string, any]),
          );
          processed.forEach((c: any) => {
            const channel = channelMap.get(c.id);
            if (channel) {
              c.channel_summary = channel;
            }
          });
        } else if (channelError) {
          console.error("fetch channel summary error:", channelError);
        }
      }

      setCustomers(processed);

      // Fetch user profiles to build staffMap
      // Fetch user profiles to build staffMap
      const userIds = new Set<string>();
      processed.forEach((c: any) => {
        if (c.owner_sale_id) userIds.add(c.owner_sale_id);
        if (c.owner_tele_id) userIds.add(c.owner_tele_id);
      });
      if (userIds.size > 0) {
        const { data: profiles, error: profError } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", Array.from(userIds));
        if (!profError && profiles) {
          setStaffMap(buildStaffMap(profiles));
        }
      }

      // Fetch ALL staff and roles for the Assign modal (if manager)
      if (isManager) {
        const [{ data: allStaffData }, { data: rolesData }] = await Promise.all([
          supabase.from("profiles").select("id, display_name, email"),
          supabase.from("user_roles").select("*"),
        ]);
        if (allStaffData) setStaffList(allStaffData);
        if (rolesData) setRolesList(rolesData);
      }
    } catch (e) {
      console.error("fetchCustomers error:", e);
      toast.error("Lỗi tải KH: " + ((e as any).message || String(e)));
    } finally {
      setLoading(false);
    }
  };
  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (searchQuery) {
      const q = stripAccents(safeLower(searchQuery));
      result = result.filter((c) => {
        const nameMatch =
          safeIncludes(stripAccents(safeLower(c.contact_name)), q) ||
          safeIncludes(stripAccents(safeLower(c.business_name)), q) ||
          safeIncludes(stripAccents(safeLower(c.facility_name)), q) ||
          safeIncludes(stripAccents(safeLower(c.name)), q);
        const phoneMatch = safeIncludes(c.phone, q);
        const emailMatch = safeIncludes(safeLower(c.email), q);
        return nameMatch || phoneMatch || emailMatch;
      });
    }

    if (activeStage !== "all") {
      result = result.filter((c) => mapLegacyStageToNew(c.lifecycle_stage) === activeStage);
    }

    if (cityFilter !== "all") {
      result = result.filter((c) => c.city === cityFilter);
    }

    // SMART FILTERS LOGIC
    if (smartFilter === "unassigned") {
      result = result.filter((c) => !c.owner_sale_id && !c.owner_tele_id);
    } else if (smartFilter === "data_ok") {
      result = result.filter((c) => getCustomerDataHealth(c).severity === "ok");
    } else if (smartFilter === "data_warning") {
      result = result.filter((c) => getCustomerDataHealth(c).severity === "warning");
    } else if (smartFilter === "data_danger") {
      result = result.filter((c) => getCustomerDataHealth(c).severity === "danger");
    } else if (smartFilter === "data_unassigned") {
      result = result.filter((c) => !c.owner_sale_id && !c.owner_tele_id);
    } else if (smartFilter === "data_stale") {
      result = result.filter((c) =>
        getCustomerDataHealth(c).reasons.some((r) => r.includes("Bỏ quên")),
      );
    } else if (smartFilter === "focus") {
      result = result.filter((c) => {
        const conv = getCustomerConversationState(c);
        return conv.temperature === "HOT" || conv.temperature === "WARM";
      });
    } else if (smartFilter === "overdue") {
      result = result.filter((c) => {
        const conv = getCustomerConversationState(c);
        return conv.urgency === "overdue";
      });
    } else if (smartFilter === "today") {
      result = result.filter((c) => {
        const conv = getCustomerConversationState(c);
        return conv.urgency === "today";
      });
    } else if (smartFilter === "no_interaction") {
      result = result.filter((c) => {
        const conv = getCustomerConversationState(c);
        return !conv.lastInteractionTime;
      });
    } else if (smartFilter === "hot") {
      result = result.filter((c) => getCustomerConversationState(c).temperature === "HOT");
    } else if (smartFilter === "cold") {
      result = result.filter((c) => getCustomerConversationState(c).temperature === "COLD");
    } else if (smartFilter === "vip") {
      result = result.filter((c) => {
        const total = c.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
        return total >= 50000000;
      });
    } else if (smartFilter === "no_social") {
      result = result.filter((c) => {
        return (
          !c.channel_summary?.has_facebook &&
          !c.channel_summary?.has_zalo &&
          !c.channel_summary?.has_tiktok
        );
      });
    } else if (smartFilter === "leads_to_call") {
      // Customers that have at least one pending call/phone task assigned to current user
      const callCustomerIds = new Set(
        customerTasks
          .filter((t) => ["call", "phone_call", "cold_call"].includes(t.task_type))
          .map((t) => t.customer_id),
      );
      result = result.filter((c) => callCustomerIds.has(c.id));
    } else if (smartFilter === "checkin_today") {
      // Customers with pending visit / check-in task
      const checkinCustomerIds = new Set(
        customerTasks
          .filter((t) => ["visit", "check_in", "checkin"].includes(t.task_type))
          .map((t) => t.customer_id),
      );
      result = result.filter((c) => checkinCustomerIds.has(c.id));
    } else if (smartFilter === "quotation_pending") {
      // Customers with pending quotation / quote_follow_up task
      const quotationCustomerIds = new Set(
        customerTasks
          .filter((t) =>
            ["quotation", "quote", "quote_follow_up", "quotation_follow_up"].includes(t.task_type),
          )
          .map((t) => t.customer_id),
      );
      result = result.filter((c) => quotationCustomerIds.has(c.id));
    } else if (smartFilter === "duplicate_phone") {
      // Customers flagged as having duplicate channel risk
      result = result.filter((c) => {
        const intel = c.sales_intelligence;
        return intel?.duplicate_phone_risk || intel?.duplicate_channel_risk;
      });
    } else if (smartFilter.startsWith("has_") || smartFilter === "no_primary") {
      result = result.filter((c) => {
        if (!c.channel_summary) return false;
        if (smartFilter === "has_phone") return !!c.phone;
        if (smartFilter === "has_facebook") return !!c.channel_summary.has_facebook;
        if (smartFilter === "has_zalo") return !!c.channel_summary.has_zalo;
        if (smartFilter === "has_email") return !!c.channel_summary.has_email;
        if (smartFilter === "has_tiktok") return !!c.channel_summary.has_tiktok;
        if (smartFilter === "has_website") return !!c.channel_summary.has_website;
        if (smartFilter === "has_primary") return !!c.channel_summary.primary_channel;
        if (smartFilter === "no_primary") return !c.channel_summary.primary_channel;
        if (smartFilter === "has_remarketing") return !!c.channel_summary.last_remarketing_at;
        return true;
      });
    }

    return result.sort((a, b) => getPriorityScore(b) - getPriorityScore(a));
  }, [customers, searchQuery, activeStage, cityFilter, smartFilter, customerTasks]);

  useEffect(() => {
    trackSearch(searchQuery, filteredCustomers.length);
  }, [searchQuery, filteredCustomers.length]);

  // Executive Admin & SubAdmin Stats
  const adminStats = useMemo(() => {
    if (!isManager) return null;
    const totalRevenue = customers.reduce((sum, c) => {
      const cValue = c.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
      return sum + cValue;
    }, 0);
    const unassignedLeads = customers.filter((c) => !c.owner_sale_id && !c.owner_tele_id).length;
    const vipCount = customers.filter((c) => {
      const cValue = c.orders?.reduce((s: number, o: any) => s + (o.total || 0), 0) || 0;
      return cValue >= 50000000;
    }).length;

    let hasPhone = 0,
      hasFb = 0,
      hasZalo = 0,
      hasEmail = 0,
      hasPrimary = 0,
      noSocial = 0,
      privateChannels = 0;

    customers.forEach((c) => {
      const cs = c.channel_summary;
      if (cs) {
        if (cs.has_phone) hasPhone++;
        if (cs.has_facebook) hasFb++;
        if (cs.has_zalo) hasZalo++;
        if (cs.has_email) hasEmail++;
        if (cs.has_primary) hasPrimary++;
        if (!cs.has_facebook && !cs.has_zalo && !cs.has_tiktok) noSocial++;
        privateChannels += cs.private_count || 0;
      }
    });

    return {
      totalRevenue,
      unassignedLeads,
      vipCount,
      totalCustomers: customers.length,
      channels: { hasPhone, hasFb, hasZalo, hasEmail, hasPrimary, noSocial, privateChannels },
    };
  }, [customers, isManager]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* MASTER HEADER */}
      <div className="bg-white/80 border-b border-slate-200 relative z-30 backdrop-blur-md px-4 py-4 md:py-6">
        <div className="mx-auto w-full max-w-7xl">
          <CRMPageHeader
            title="Quản trị Khách hàng"
            subtitle={isAdmin ? "Danh sách đang xử lý" : "Personal Workspace"}
            action={
              <div className="flex items-center gap-3">
                <div className="hidden md:flex bg-slate-100 p-1 rounded-xl">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-[10px] font-black ${viewMode === "kanban" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                    onClick={() => {
                      setViewMode("kanban");
                      localStorage.setItem("crm_customers_view_mode", "kanban");
                    }}
                  >
                    KANBAN
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-lg text-[10px] font-black ${viewMode === "list" ? "bg-white shadow-sm text-slate-900" : "text-slate-400"}`}
                    onClick={() => {
                      setViewMode("list");
                      localStorage.setItem("crm_customers_view_mode", "list");
                    }}
                  >
                    DANH SÁCH
                  </Button>
                  <Link to="/customers/map">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-lg text-[10px] font-black text-slate-400 hover:text-slate-900"
                    >
                      BẢN ĐỒ 🗺️
                    </Button>
                  </Link>
                </div>
                {isManager ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 shadow-3xs hover:bg-slate-50 bg-white transition-all flex items-center gap-1.5"
                      >
                        <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-2xl border-slate-100 shadow-xl w-52">
                      <DropdownMenuItem
                        onClick={() => handleExport("active")}
                        className="text-xs font-bold text-slate-700 py-2.5 cursor-pointer"
                      >
                        📂 Xuất Spa hoạt động
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleExport("deleted")}
                        className="text-xs font-bold text-rose-600 hover:text-rose-700 py-2.5 cursor-pointer"
                      >
                        🗑️ Xuất danh sách đã xóa
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => handleExport("active")}
                    className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 shadow-3xs bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4 text-slate-500" /> Xuất Excel
                  </Button>
                )}
                {isAdmin ? (
                  /* Admin: Tạo Lead → vào Intake Queue ở CRM Ops */
                  <Button
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-5 shadow-lg shadow-indigo-200 transition-all hover:scale-105 text-white flex items-center gap-1.5"
                    onClick={() => setIsAddDialogOpen(true)}
                  >
                    <Plus className="w-4 h-4" /> Tạo Lead mới
                  </Button>
                ) : (
                  /* Sale: nút Thêm nhanh giữ nguyên */
                  <Button
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 font-black text-xs h-10 px-6 shadow-lg shadow-indigo-200 transition-all hover:scale-105 text-white"
                    onClick={() => setIsAddDialogOpen(true)}
                  >
                    <Zap className="w-4 h-4 mr-1.5 fill-white/20" /> Thêm khách nhanh
                  </Button>
                )}
              </div>
            }
          />
        </div>
      </div>
      <CRMPageContainer>
        {/* ACTIVE SMART FILTER LABEL BANNER */}
        {smartFilter !== "all" && customerRiskLabels[smartFilter] && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-bold">
            <Filter className="w-3.5 h-3.5 shrink-0" />
            <span>Đang lọc: {customerRiskLabels[smartFilter]}</span>
            <button
              onClick={() => setSmartFilter("all")}
              className="ml-auto text-indigo-400 hover:text-indigo-700 transition-colors text-[10px] font-black uppercase tracking-wider"
            >
              Xoá lọc ✕
            </button>
          </div>
        )}
        {/* EXECUTIVE CONTROL CENTER (ADMIN & SUB-ADMIN ONLY) */}
        {isManager && adminStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Tổng khách hàng / Spa
                </span>
                <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 border border-slate-100">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  {adminStats.totalCustomers}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                  Cơ sở đăng ký hệ thống
                </p>
              </div>
            </div>

            <button
              onClick={() => setSmartFilter(smartFilter === "unassigned" ? "all" : "unassigned")}
              className={`p-6 rounded-3xl text-left border flex flex-col justify-between h-36 transition-all duration-300 ${smartFilter === "unassigned" ? "bg-indigo-600 border-transparent text-white shadow-xl scale-105 shadow-indigo-100" : "bg-white border-slate-100 shadow-sm hover:border-slate-200"}`}
            >
              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest ${smartFilter === "unassigned" ? "text-white/80" : "text-slate-400"}`}
                >
                  Lead chưa phân công
                </span>
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border ${smartFilter === "unassigned" ? "bg-white/20 border-white/10 text-white" : "bg-rose-50 border-rose-100 text-rose-500"}`}
                >
                  <AlertCircle className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3
                  className={`text-2xl font-black leading-none ${smartFilter === "unassigned" ? "text-white" : "text-slate-900"}`}
                >
                  {adminStats.unassignedLeads}
                </h3>
                <p
                  className={`text-[9px] font-bold mt-1 uppercase ${smartFilter === "unassigned" ? "text-white/60" : "text-slate-400"}`}
                >
                  {smartFilter === "unassigned"
                    ? "Đang lọc xem Lead chưa chia 🎯"
                    : "Click để lọc nhanh chia lead"}
                </p>
              </div>
            </button>

            <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Spa đạt hạng VIP (Gold+)
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500 border border-amber-100">
                  <Star className="w-4 h-4 fill-amber-500" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900 leading-none">
                  {adminStats.vipCount}
                </h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase">
                  Đạt mức LTV &gt;= 50Mđ
                </p>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 border-none shadow-xl shadow-indigo-100 text-white flex flex-col justify-between h-36">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">
                  Tổng doanh thu hệ thống
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white border border-white/10">
                  <Zap className="w-4 h-4 fill-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-black leading-none">
                  {adminStats.totalRevenue.toLocaleString("vi-VN")} đ
                </h3>
                <p className="text-[9px] font-bold text-white/60 mt-1 uppercase">
                  Tổng giá trị đơn hàng đã chốt
                </p>
              </div>
            </div>
          </div>
        )}

        {isManager && adminStats && (
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-wrap gap-4 items-center text-xs font-bold text-slate-600">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 bg-slate-50 px-2 py-1 rounded-md">
              Channel Intelligence
            </span>
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-blue-500" /> {adminStats.channels.hasPhone}
            </div>
            <div className="flex items-center gap-1.5">
              <Facebook className="w-3.5 h-3.5 text-blue-600" /> {adminStats.channels.hasFb}
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" /> {adminStats.channels.hasZalo}
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-500" /> {adminStats.channels.hasEmail}
            </div>
            <div className="flex items-center gap-1.5 text-emerald-600">
              <Star className="w-3.5 h-3.5 fill-emerald-500" /> {adminStats.channels.hasPrimary}{" "}
              Kênh chính
            </div>
            <div className="flex items-center gap-1.5 text-rose-500">
              <AlertCircle className="w-3.5 h-3.5" /> {adminStats.channels.noSocial} Thiếu Social
            </div>
            <div className="flex items-center gap-1.5 text-indigo-500 ml-auto">
              <Lock className="w-3.5 h-3.5" /> {adminStats.channels.privateChannels} Kênh Private
            </div>
          </div>
        )}

        {/* COMPACT CONTROL BAR */}
        <CRMCard className="p-1.5 rounded-xl flex flex-col lg:flex-row items-center gap-2 shadow-sm sticky top-20 z-20 overflow-visible">
          {/* Search */}
          <div className="relative w-full lg:w-72 shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <Input
              id="search-customers-input"
              placeholder="Tìm tên, SĐT, ID... ('/')"
              className="pl-9 h-8 bg-slate-50 border-none rounded-lg text-[11px] font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:font-medium placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="h-4 w-px bg-slate-200 hidden lg:block" />

          {/* Province Filter */}
          <div className="relative w-full lg:w-48 shrink-0">
            <Popover
              open={cityOpen}
              onOpenChange={(o) => {
                setCityOpen(o);
                if (!o) setCitySearch("");
              }}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  role="combobox"
                  aria-expanded={cityOpen}
                  className="w-full text-[11px] h-8 rounded-lg bg-slate-50 px-2.5 flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors focus:outline-none"
                >
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <MapIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span
                      className={
                        cityFilter !== "all"
                          ? "text-slate-800 font-bold truncate"
                          : "text-slate-500 font-medium truncate"
                      }
                    >
                      {cityFilter === "all" ? "Tất cả tỉnh/thành" : cityFilter}
                    </span>
                  </div>
                  <ChevronsUpDown className="w-3 h-3 text-slate-400 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="p-0 rounded-xl shadow-lg border border-slate-100 overflow-hidden w-56"
                align="start"
                sideOffset={4}
              >
                <div className="flex items-center gap-2 px-2 py-1.5 border-b border-slate-100 bg-slate-50">
                  <Search className="w-3 h-3 text-slate-400 shrink-0" />
                  <input
                    autoFocus
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    placeholder="Tìm tỉnh/thành..."
                    className="flex-1 text-[11px] bg-transparent outline-none placeholder:text-slate-400 text-slate-800"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setCityFilter("all");
                      setCitySearch("");
                      setCityOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2 py-1.5 text-[11px] hover:bg-slate-50"
                  >
                    <Check
                      className={`w-3 h-3 shrink-0 ${cityFilter === "all" ? "text-slate-900" : "opacity-0"}`}
                    />
                    <span
                      className={`font-medium ${cityFilter === "all" ? "text-slate-900" : "text-slate-500"}`}
                    >
                      Tất cả tỉnh/thành
                    </span>
                  </button>
                  {/* Simplified Province List mapping... */}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-4 w-px bg-slate-200 hidden lg:block" />

          {/* Quick Filters */}
          <div className="flex items-center gap-1 overflow-x-auto w-full no-scrollbar pb-1">
            <Button
              variant={smartFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase ${smartFilter === "all" ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-50"}`}
              onClick={() => setSmartFilter("all")}
            >
              Tất cả
            </Button>
            <Button
              variant={smartFilter === "data_ok" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "data_ok" ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-emerald-50/50"}`}
              onClick={() => setSmartFilter("data_ok")}
            >
              🟢 OK
            </Button>
            <Button
              variant={smartFilter === "data_warning" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "data_warning" ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:bg-amber-50/50"}`}
              onClick={() => setSmartFilter("data_warning")}
            >
              🟡 Cần chú ý
            </Button>
            <Button
              variant={smartFilter === "data_danger" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "data_danger" ? "bg-rose-100 text-rose-700" : "text-slate-500 hover:bg-rose-50/50"}`}
              onClick={() => setSmartFilter("data_danger")}
            >
              🔴 Lỗi dữ liệu
            </Button>
            <Button
              variant={smartFilter === "data_unassigned" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "data_unassigned" ? "bg-purple-100 text-purple-700" : "text-slate-500 hover:bg-purple-50/50"}`}
              onClick={() => setSmartFilter("data_unassigned")}
            >
              ⭕ Chưa chia
            </Button>
            <Button
              variant={smartFilter === "data_stale" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "data_stale" ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:bg-orange-50/50"}`}
              onClick={() => setSmartFilter("data_stale")}
            >
              ⏳ Bỏ quên {">"}7d
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
            <Button
              variant={smartFilter === "focus" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase transition-colors ${smartFilter === "focus" ? "bg-indigo-100 text-indigo-700" : "text-slate-500 hover:bg-indigo-50/50"}`}
              onClick={() => setSmartFilter("focus")}
            >
              🎯 Focus
            </Button>
            <Button
              variant={smartFilter === "overdue" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase ${smartFilter === "overdue" ? "bg-rose-100 text-rose-700" : "text-slate-500 hover:bg-rose-50/50"}`}
              onClick={() => setSmartFilter("overdue")}
            >
              🔴 Quá hạn
            </Button>
            <Button
              variant={smartFilter === "today" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase ${smartFilter === "today" ? "bg-orange-100 text-orange-700" : "text-slate-500 hover:bg-orange-50/50"}`}
              onClick={() => setSmartFilter("today")}
            >
              🟠 Hôm nay
            </Button>
            <Button
              variant={smartFilter === "no_interaction" ? "default" : "ghost"}
              size="sm"
              className={`rounded-lg text-[10px] h-8 font-black uppercase ${smartFilter === "no_interaction" ? "bg-amber-100 text-amber-700" : "text-slate-500 hover:bg-amber-50/50"}`}
              onClick={() => setSmartFilter("no_interaction")}
            >
              ⚠️ Chưa TT
            </Button>
          </div>

          {/* Advanced Filters */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg h-8 text-[10px] font-black uppercase border-slate-200 text-slate-600 shadow-sm shrink-0"
              >
                Lọc nâng cao +
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2 rounded-xl shadow-xl border-slate-100" align="end">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 mb-1">
                  Signals
                </p>
                {[
                  { id: "hot", label: "🔥 HOT Leads" },
                  { id: "vip", label: "👑 Khách VIP" },
                  { id: "no_social", label: "🟡 Thiếu Social" },
                ].map((f) => (
                  <Button
                    key={f.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => setSmartFilter(f.id)}
                    className={`w-full justify-start text-[11px] font-semibold ${smartFilter === f.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600"}`}
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </CRMCard>

        <FocusQueueBar
          customers={filteredCustomers}
          onStartQueue={(id) => setPreviewCustomer(customers.find((c) => c.id === id) || null)}
        />

        {viewMode === "kanban" ? (
          /* PERFECT KANBAN UX */
          <>
            <div
              ref={topScrollRef}
              onScroll={handleTopScroll}
              className="w-full overflow-x-auto overflow-y-hidden h-3 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full mb-2"
            >
              <div
                style={{
                  width: `${
                    SALES_PIPELINE_STAGES.filter((s) => !collapsedColumns[s.value]).length * 304 +
                    SALES_PIPELINE_STAGES.filter((s) => collapsedColumns[s.value]).length * 84 - 24
                  }px`,
                }}
                className="h-1"
              />
            </div>
            <div
              ref={bottomScrollRef}
              onScroll={handleBottomScroll}
              className="flex gap-6 overflow-x-auto pb-6 min-h-[600px] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-slate-100/50 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb]:rounded-full"
            >
            {loading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="min-w-[280px] w-[280px] flex flex-col relative bg-slate-50/50 rounded-2xl border border-slate-100/50 animate-pulse transition-opacity duration-300"
                  >
                    <div className="sticky top-0 z-10 flex items-center justify-between p-3 border-b border-slate-100/50 bg-slate-50/30 rounded-t-[24px]">
                      <div className="w-24 h-4 bg-slate-200 rounded"></div>
                      <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                    </div>
                    <div className="flex flex-col gap-y-5 p-2 min-h-[500px]">
                      <div className="w-full h-36 bg-white rounded-2xl border border-slate-100"></div>
                      <div className="w-full h-24 bg-white rounded-2xl border border-slate-100"></div>
                      <div className="w-full h-40 bg-white rounded-2xl border border-slate-100"></div>
                    </div>
                  </div>
                ))
              : SALES_PIPELINE_STAGES.map((stage) => {
                  const isCollapsed = collapsedColumns[stage.value];
                  const stageCustomers = filteredCustomers.filter(
                    (c) => mapLegacyStageToNew(c.lifecycle_stage) === stage.value,
                  );

                  if (isCollapsed) {
                    return (
                      <div
                        key={stage.value}
                        className="min-w-[60px] w-[60px] flex flex-col items-center border-r border-slate-200/50 cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleColumn(stage.value)}
                      >
                        <div className="flex flex-col items-center gap-4 py-4 h-full">
                          <div
                            className={`w-3 h-3 rounded-full ${getPipelineStageColor(stage.value).replace("bg-", "bg-").replace("50", "500")}`}
                          />
                          <div
                            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
                            className="text-xs font-black text-slate-400 tracking-widest whitespace-nowrap mt-4"
                          >
                            {stage.label} ({stageCustomers.length})
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={stage.value}
                      className={`min-w-[280px] w-[280px] flex flex-col relative bg-slate-50/40 rounded-2xl border-x border-b border-t-2 ${draggedCustomerId ? "border-dashed border-indigo-300 bg-indigo-50/20" : "border-x-slate-100/60 border-b-slate-100/60"} ${getPipelineStageColor(stage.value).replace("bg-", "border-t-")}`}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, stage.value)}
                    >
                      {/* Column Header */}
                      <div
                        className={`flex items-center justify-between p-2 border-b border-slate-100/80 bg-slate-50/95 rounded-t-xl shadow-sm z-10 relative`}
                      >
                        <div
                          className="flex items-center gap-1.5 cursor-pointer"
                          onClick={() => toggleColumn(stage.value)}
                        >
                          <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                            {stage.label}
                          </h3>
                          {stageCustomers.length > 20 && (
                            <span title="Tồn đọng lớn" className="text-[10px]">
                              ⚠️
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge
                            variant="secondary"
                            className={`text-[9px] font-bold px-1.5 py-0 rounded-md bg-white border border-slate-200 text-slate-500`}
                          >
                            {stageCustomers.length}
                          </Badge>
                          {isManager && stage.value === "lead_new" && stageCustomers.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-5 px-1.5 text-[9px] font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 ml-1 bg-white"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCustomers(stageCustomers.map((c) => c.id));
                                setDispatchAction("assign_sale");
                                setIsDispatchDialogOpen(true);
                              }}
                              title="Chia tất cả Lead trong cột này"
                            >
                              Chia Lead
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-slate-400 hover:bg-slate-200/50"
                            onClick={() => toggleColumn(stage.value)}
                          >
                            <ChevronRight className="w-3.5 h-3.5 transition-transform hover:-translate-x-0.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Column Content */}
                      <div className="flex flex-col gap-y-3 p-2 min-h-[500px]">
                        {stageCustomers.map((customer) =>
                          isManager ? (
                            <ManagerCustomerCard
                              key={customer.id}
                              customer={customer}
                              stage={stage.value}
                              onPreview={() => setPreviewCustomer(customer)}
                              draggable={false}
                              onDragStart={(e: React.DragEvent) => e.preventDefault()}
                              staffMap={staffMap}
                              isSelected={selectedCustomers.includes(customer.id)}
                              onToggleSelect={(checked: boolean) => {
                                setSelectedCustomers((prev) =>
                                  checked
                                    ? [...prev, customer.id]
                                    : prev.filter((id) => id !== customer.id),
                                );
                              }}
                              onQuickDispatch={(action: string) => {
                                setSelectedCustomers([customer.id]);
                                setDispatchAction(action as any);
                                setIsDispatchDialogOpen(true);
                              }}
                              isSaving={logTarget?.id === customer.id}
                            />
                          ) : (
                            <SalesCustomerCard
                              key={customer.id}
                              customer={customer}
                              stage={stage.value}
                              onQuickLog={() => setLogTarget(customer)}
                              onPreview={() => setPreviewCustomer(customer)}
                              draggable={true}
                              onDragStart={(e: React.DragEvent) => handleDragStart(e, customer.id)}
                              isSaving={logTarget?.id === customer.id}
                            />
                          ),
                        )}
                        {stageCustomers.length === 0 && (
                          <CRMEmptyState
                            className="h-32 p-4 m-1 bg-white/50 rounded-[20px]"
                            icon={<div className="hidden" />}
                            title="Chưa có khách ở stage này"
                            description="Kéo khách vào đây"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </>
        ) : (
          /* CUSTOMER INTELLIGENCE CENTER (L1) */
          <div className="flex flex-col gap-3">
            {loading ? (
              <CRMLoadingState type="list" rows={5} />
            ) : filteredCustomers.length === 0 ? (
              <CRMEmptyState
                icon={<Search className="w-6 h-6 text-slate-300" />}
                title="Không tìm thấy khách phù hợp"
                description="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm"
              />
            ) : (
              filteredCustomers.map((customer) => (
                <CustomerIntelligenceRow
                  key={customer.id}
                  customer={customer}
                  staffMap={staffMap}
                  onPreview={() => setPreviewCustomer(customer)}
                  onQuickLog={() => setLogTarget(customer)}
                  isManager={isManager}
                  isSelected={selectedCustomers.includes(customer.id)}
                  onToggleSelect={(checked: boolean) => {
                    setSelectedCustomers((prev) =>
                      checked ? [...prev, customer.id] : prev.filter((id) => id !== customer.id),
                    );
                  }}
                  onQuickDispatch={(action: string) => {
                    setSelectedCustomers([customer.id]);
                    setDispatchAction(action as any);
                    setIsDispatchDialogOpen(true);
                  }}
                />
              ))
            )}
          </div>
        )}
      </CRMPageContainer>

      <QuickCallResultDialog
        isOpen={!!logTarget}
        onOpenChange={(open) => !open && setLogTarget(null)}
        customerId={logTarget?.id || null}
        onSuccess={fetchCustomers}
        onOptimisticUpdate={(updates) => {
          setCustomers((prev) =>
            prev.map((c) => (c.id === logTarget?.id ? { ...c, ...updates } : c)),
          );
        }}
        onOptimisticRevert={fetchCustomers}
      />

      <AddCustomerDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onSuccess={() => {
          if (isAdmin) {
            // Admin: sau khi tạo lead → đi thẳng đến CRM Ops Center (Intake Queue)
            setIsAddDialogOpen(false);
            navigate({ to: "/admin/crm-ops" });
          } else {
            // Sale: refresh bình thường
            fetchCustomers();
          }
        }}
      />

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}
        staffMap={staffMap}
        onNextCustomer={handleNextCustomer}
      />
      {/* BULK ACTION FLOATING BAR */}
      {isManager && selectedCustomers.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white p-2 rounded-2xl shadow-2xl border border-slate-200 flex items-center gap-2 animate-in slide-in-from-bottom-5">
          <div className="px-3 py-1 bg-indigo-50 text-indigo-700 font-black text-xs rounded-xl flex items-center gap-2 border border-indigo-100">
            <CheckSquare className="w-4 h-4" /> Đã chọn {selectedCustomers.length}
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs font-bold hover:bg-slate-100"
            onClick={() => setSelectedCustomers([])}
          >
            Hủy chọn
          </Button>

          <div className="w-px h-6 bg-slate-200 mx-1" />

          <Button
            size="sm"
            className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={() => {
              setDispatchAction("assign_sale");
              setIsDispatchDialogOpen(true);
            }}
          >
            <UserPlus className="w-3.5 h-3.5 mr-1" /> Gán Sale
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-sm"
            onClick={() => {
              setDispatchAction("assign_tele");
              setIsDispatchDialogOpen(true);
            }}
          >
            <PhoneCall className="w-3.5 h-3.5 mr-1" /> Gán Tele
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs font-bold"
            onClick={() => {
              setDispatchAction("revoke");
              setIsDispatchDialogOpen(true);
            }}
          >
            <XCircle className="w-3.5 h-3.5 mr-1" /> Thu hồi
          </Button>
        </div>
      )}

      <Dialog open={isDispatchDialogOpen} onOpenChange={setIsDispatchDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">
              {dispatchAction === "assign_sale" && "Phân công Sale phụ trách"}
              {dispatchAction === "assign_tele" && "Phân công Tele hỗ trợ"}
              {dispatchAction === "change_stage" && "Chuyển giai đoạn chăm sóc"}
              {dispatchAction === "revoke" && "Thu hồi Khách hàng"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-xl text-sm font-medium text-slate-600 flex items-center gap-2 border border-slate-100">
              <CheckSquare className="w-4 h-4 text-indigo-500" />
              Đang xử lý <strong>{selectedCustomers.length}</strong> khách hàng
            </div>

            {dispatchAction !== "revoke" && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase">
                  {dispatchAction === "change_stage" ? "Chọn giai đoạn mới" : "Chọn nhân viên"}
                </label>
                <select
                  className={`w-full h-12 px-4 rounded-xl border ${
                    dispatchStaffId === "none" && dispatchAction !== "change_stage"
                      ? "border-rose-300 ring-1 ring-rose-100"
                      : "border-slate-200 focus:ring-2 focus:ring-indigo-500"
                  } bg-white outline-none text-sm font-medium text-slate-900 transition-all`}
                  value={dispatchStaffId}
                  onChange={(e) => setDispatchStaffId(e.target.value)}
                >
                  {dispatchAction === "change_stage" ? (
                    <>
                      <option value="none">-- Chọn giai đoạn --</option>
                      {SALES_PIPELINE_STAGES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </>
                  ) : (
                    <>
                      <option value="none" disabled>
                        -- Vui lòng chọn nhân viên --
                      </option>
                      {(dispatchAction === "assign_sale"
                        ? staffList.filter((staff) =>
                            rolesList.some((r) => r.user_id === staff.id && r.role === "sale"),
                          )
                        : staffList.filter((staff) =>
                            rolesList.some((r) => r.user_id === staff.id && r.role === "tele_lead"),
                          )
                      ).map((staff: any) => (
                        <option key={staff.id} value={staff.id} className="py-2">
                          {staff.display_name || "Chưa cập nhật tên"} • {staff.email}
                        </option>
                      ))}
                      {/* Fallback if staffList is empty (e.g. not loaded) */}
                      {staffList.length === 0 &&
                        Object.entries(staffMap).map(([id, staff]: [string, any]) => (
                          <option key={id} value={id}>
                            {staff.display_name} • {staff.email}
                          </option>
                        ))}
                    </>
                  )}
                </select>
                {dispatchStaffId === "none" &&
                  dispatchAction !== "revoke" &&
                  dispatchAction !== "change_stage" && (
                    <p className="text-xs font-bold text-rose-500 mt-1">
                      Vui lòng chọn nhân viên phụ trách.
                    </p>
                  )}
                {selectedCustomers.length === 0 && (
                  <p className="text-xs font-bold text-rose-500 mt-1">Chưa chọn khách hàng.</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase">
                Lý do {dispatchAction === "revoke" ? "thu hồi" : "điều phối"}{" "}
                {dispatchAction === "revoke" ? (
                  <span className="text-red-500">*</span>
                ) : (
                  "(không bắt buộc)"
                )}
              </label>
              <textarea
                className="w-full p-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px]"
                placeholder="Nhập lý do thực hiện thao tác này..."
                value={dispatchReason}
                onChange={(e) => setDispatchReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setIsDispatchDialogOpen(false)}
              className="rounded-xl text-xs font-bold"
              disabled={isDispatching}
            >
              Hủy
            </Button>
            <Button
              disabled={
                isDispatching ||
                selectedCustomers.length === 0 ||
                (dispatchAction === "revoke" && !dispatchReason.trim()) ||
                (dispatchAction !== "revoke" && dispatchStaffId === "none")
              }
              onClick={handleBulkDispatch}
              className={`rounded-xl text-xs font-black px-6 shadow-md transition-all ${
                dispatchAction === "revoke"
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200"
              }`}
            >
              {isDispatching ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Đang xử lý...
                </>
              ) : (
                "Xác nhận"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- SHARED COMPONENTS ---
function CustomerCardActivityInfo({ customer, isManager }: { customer: any; isManager?: boolean }) {
  const state = getCustomerConversationState(customer);
  const suggestedAction = getSuggestedNextAction(customer);

  let managerAction = "";
  let managerActionColor = "text-indigo-600 bg-indigo-50/80 border-indigo-100/50";
  let ManagerIcon = Play;

  if (isManager) {
    if (!customer.owner_sale_id) {
      managerAction = "Cần phân bổ Lead";
      managerActionColor = "text-amber-600 bg-amber-50/80 border-amber-100/50";
      ManagerIcon = AlertCircle;
    } else if (customer.ownership_status === "pending_revoke") {
      managerAction = "Cần duyệt thu hồi";
      managerActionColor = "text-purple-600 bg-purple-50/80 border-purple-100/50";
      ManagerIcon = AlertCircle;
    } else if (state.urgency === "overdue") {
      managerAction = "Cần đôn đốc Sale";
      managerActionColor = "text-rose-600 bg-rose-50/80 border-rose-100/50";
      ManagerIcon = AlertCircle;
    } else if (suggestedAction) {
      managerAction = "Quản lý & Theo dõi";
managerActionColor = "text-slate-600 bg-slate-100/80 border-slate-200/50";
      ManagerIcon = CheckSquare;
    }
  }

  const getMemoryIcon = (summary: unknown) => {
    if (!summary) return "⚡";
    const lower = safeLower(summary);
    if (lower.includes("zalo") || lower.includes("nhắn") || lower.includes("sms")) return "💬";
    if (lower.includes("gọi") || lower.includes("phone") || lower.includes("không nghe máy"))
      return "📞";
    if (lower.includes("báo giá") || lower.includes("quote") || lower.includes("form")) return "📄";
    if (lower.includes("hẹn") || lower.includes("lịch") || lower.includes("meeting")) return "📅";
    if (lower.includes("facebook") || lower.includes("fb")) return "📘";
    if (lower.includes("email") || lower.includes("mail")) return "📧";
    return "⚡";
  };

  return (
    <div className="flex flex-col gap-1 text-[10px] text-slate-500 font-medium pt-1">
      {state.lastInteractionTime ? (
        <div className="flex items-start gap-1.5 bg-slate-50/80 rounded-lg p-1.5 border border-slate-100/60 transition-colors hover:bg-slate-50">
          <span className="shrink-0 mt-0.5">
            {getMemoryIcon(state.lastInteractionSummary || "")}
          </span>
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">
              Tương tác cuối
            </span>
            <span className="text-[10px] text-slate-700 font-medium line-clamp-1 leading-tight">
              <span className="font-bold">{state.lastInteractionSummary || "Có tương tác"}</span> ·{" "}
              {formatDistanceToNow(new Date(state.lastInteractionTime), {
                addSuffix: true,
                locale: vi,
              })}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 bg-amber-50/50 rounded-lg p-1.5 border border-amber-100/50 text-amber-600 font-bold">
          <span className="text-[10px]">⚠️ Chưa có tương tác</span>
        </div>
      )}

      {state.nextFollowUpTime && (
        <div
          className={`flex items-start gap-1.5 rounded-lg p-1.5 border transition-colors ${state.urgency === "overdue" ? "bg-rose-50/80 border-rose-100 hover:bg-rose-50" : "bg-orange-50/80 border-orange-100 hover:bg-orange-50"}`}
        >
          <span className="shrink-0 mt-0.5">{state.urgency === "overdue" ? "🔴" : "📅"}</span>
          <div className="flex flex-col">
            <span
              className={`text-[8px] font-bold uppercase tracking-wider ${state.urgency === "overdue" ? "text-rose-400" : "text-orange-400"}`}
            >
              Next Action
            </span>
            <span
              className={`text-[10px] font-bold leading-tight ${state.urgency === "overdue" ? "text-rose-600" : "text-orange-600"}`}
            >
              {state.urgency === "overdue" ? "Quá hạn" : "Hẹn lại"} ·{" "}
              {format(new Date(state.nextFollowUpTime), "HH:mm dd/MM")}
            </span>
          </div>
        </div>
      )}
      {!state.nextFollowUpTime && state.temperature === "COLD" && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 font-bold">
            ⚫ {">"} 14 ngày chưa tương tác
          </span>
        </div>
      )}
      {suggestedAction && !isManager && (
        <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[9px] text-indigo-500 font-bold flex items-center gap-1">
            <span className="animate-pulse">💡</span> Gợi ý: {suggestedAction}
          </span>
        </div>
      )}
      {isManager && managerAction && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`text-[10px] font-black flex items-center gap-1 px-1.5 py-0.5 rounded border ${managerActionColor}`}
          >
            <ManagerIcon className={`w-2.5 h-2.5 ${managerActionColor.split(" ")[0]}`} />
            {managerAction}
          </span>
        </div>
      )}
    </div>
  );
}

// --- SALES CUSTOMER CARD (Optimized for quick actions) ---
const SalesCustomerCard = React.memo(function SalesCustomerCard({
  customer,
  stage,
  onQuickLog,
  draggable,
  onDragStart,
  onPreview,
  isSaving,
}: any) {
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  const isVip = totalValue >= 50000000;
  const isAtRisk = customer.ownership_status === "at_risk";
  const hasSocial =
    customer.channel_summary?.has_facebook ||
    customer.channel_summary?.has_zalo ||
    customer.channel_summary?.has_tiktok;

  const visualState = getCustomerVisualState(customer);
  const convState = getCustomerConversationState(customer);

  const hasZalo = !!customer.channel_summary?.has_zalo;
  const primaryPhone = getCustomerPrimaryPhone(customer);

  const normalizedBadges = getCustomerCardBadges(customer);
  const topBadges = normalizedBadges.slice(0, 2);
  const overflowCount = normalizedBadges.length > 2 ? normalizedBadges.length - 2 : 0;

  return (
    <CRMCard
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onPreview && onPreview(customer)}
      className={`p-3 space-y-2 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 bg-white overflow-hidden group border cursor-grab active:cursor-grabbing hover:-translate-y-0.5 relative ${visualState.borderColor} ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-0.5 max-w-[85%]">
          <div className="flex items-center gap-1 mb-1 flex-wrap">
            {topBadges.map((b) => (
              <Badge
                key={b.id}
                variant="secondary"
                title={b.tooltip}
                className={`border-none px-1.5 py-0 text-[9px] h-4 uppercase font-bold ${
                  b.type === "danger"
                    ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                    : b.type === "warning"
                      ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                      : b.type === "priority" && b.label.includes("Hot")
                        ? "bg-rose-50 text-rose-600 hover:bg-rose-100"
                        : b.type === "priority" && b.label.includes("Warm")
                          ? "bg-orange-50 text-orange-600 hover:bg-orange-100"
                          : b.type === "vip"
                            ? "bg-amber-50 text-amber-600 hover:bg-amber-100"
                            : "bg-slate-100 text-slate-600"
                }`}
              >
                {b.label}
              </Badge>
            ))}
            {overflowCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-slate-100 text-slate-500 border-none px-1.5 py-0 text-[9px] h-4 font-bold cursor-help"
                title={normalizedBadges
                  .slice(2)
                  .map((b) => b.label)
                  .join(", ")}
              >
                +{overflowCount} lỗi
              </Badge>
            )}
          </div>
          <h4
            className="text-[13px] font-bold text-slate-800 tracking-tight leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1"
            title={getCustomerCardTitle(customer)}
          >
            {getCustomerCardTitle(customer)}
          </h4>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
              {customer.city || "Toàn quốc"} •{" "}
              {customer.customer_channel || customer.source || "N/A"}
            </p>
          </div>
        </div>
        <div className="shrink-0 z-10" onClick={(e) => e.stopPropagation()}>
          <InlineCustomerActions
            customer={customer}
            onOpenDrawer={(id) => onPreview && onPreview(customer)}
            onRefresh={() => {}}
          />
        </div>
      </div>

      {/* Contact Info (No owner initials) */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold text-slate-600">
          {primaryPhone
            ? formatPhoneForDisplay(primaryPhone)
            : customer.email
            ? toSafeString(customer.email).split("@")[0] + "@..."
            : "Chưa có SĐT/Email"}
        </span>
        <div className="flex gap-1 ml-auto">
          {hasZalo && (
            <div title="Có Zalo">
              <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
            </div>
          )}
          {!hasSocial && (
            <div title="Thiếu kênh MXH">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            </div>
          )}
        </div>
      </div>

      {customer.notes && (
        <div className="bg-amber-50/50 rounded-lg p-2 border border-amber-100/50">
          <p className="text-[10px] text-amber-900 font-medium line-clamp-2 leading-relaxed whitespace-pre-wrap">
            <span className="font-bold mr-1 text-amber-700">📝 Ghi chú:</span>
            {customer.notes}
          </p>
        </div>
      )}

      <CustomerCardActivityInfo customer={customer} />

      {/* Action Row - Primary Action + Quick Shortcuts + Action Icons */}
      <div className="flex items-center gap-1 pt-2 border-t border-slate-50">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              {primaryPhone ? (
                <Button
                  asChild
                  className="inline-flex items-center justify-center rounded-lg h-8 w-8 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-sm transition-colors p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <a href={formatPhoneForCallHref(primaryPhone) || "#"}>
                    <Phone className="w-4 h-4" />
                  </a>
                </Button>
              ) : (
                <div
                  className="inline-flex items-center justify-center rounded-lg h-8 w-8 bg-slate-100 text-slate-300 cursor-not-allowed shrink-0 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="w-4 h-4" />
                </div>
              )}
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-[10px]">{primaryPhone ? "Gọi điện" : "Thiếu SĐT"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <div className="flex items-center gap-0.5 ml-1">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg transition-colors ${hasZalo ? "text-blue-500 hover:text-blue-600 hover:bg-blue-50" : "text-slate-300 hover:text-blue-500 hover:bg-slate-50"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    const href = formatPhoneForZalo(primaryPhone);
                    if (href) window.open(href, "_blank");
                  }}
                >
                  <MessageSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Nhắn Zalo</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg transition-colors ${customer.channel_summary?.has_facebook ? "text-blue-600 hover:text-blue-700 hover:bg-blue-50" : "text-slate-300 hover:text-blue-600 hover:bg-slate-50"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://facebook.com/search/top/?q=${encodeURIComponent(customer.phone || getCustomerCardTitle(customer))}`,
                      "_blank",
                    );
                  }}
                >
                  <Facebook className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Tìm Facebook</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 rounded-lg transition-colors ${customer.city && customer.city !== "Toàn quốc" ? "text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" : "text-slate-300 hover:text-emerald-500 hover:bg-slate-50"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(
                      `https://maps.google.com/?q=${encodeURIComponent(customer.city || getCustomerCardTitle(customer))}`,
                      "_blank",
                    );
                  }}
                >
                  <MapPin className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Xem Bản đồ</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center shrink-0 ml-auto">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickLog();
                  }}
                  className={`h-8 w-8 rounded-lg ${convState.urgency === "overdue" ? "text-rose-500 hover:text-rose-600 hover:bg-rose-50" : "text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"}`}
                >
                  <CheckSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-[10px]">Đã gọi (Quick log)</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </CRMCard>
  );
});

const ManagerCustomerCard = React.memo(function ManagerCustomerCard({
  customer,
  stage,
  onPreview,
  staffMap,
  isSelected,
  onToggleSelect,
  onQuickDispatch,
  draggable,
  onDragStart,
  isSaving,
}: any) {
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  const isVip = totalValue >= 50000000;
  const isAtRisk = customer.ownership_status === "at_risk";
  const hasSocial =
    customer.channel_summary?.has_facebook ||
    customer.channel_summary?.has_zalo ||
    customer.channel_summary?.has_tiktok;

  const visualState = getCustomerVisualState(customer);
  const convState = getCustomerConversationState(customer);

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);
  const saleInitials = getStaffInitials(customer.owner_sale_id, staffMap);
  const teleInitials = getStaffInitials(customer.owner_tele_id, staffMap);

  return (
    <CRMCard
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onPreview && onPreview(customer)}
      className={`p-3 space-y-2 rounded-3xl shadow-sm hover:shadow-md transition-all duration-200 bg-white overflow-hidden group border cursor-grab active:cursor-grabbing hover:-translate-y-0.5 relative ${visualState.borderColor} ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div onClick={(e) => e.stopPropagation()} className="cursor-pointer z-10 shrink-0 mt-0.5">
            <CheckSquare
              className={`w-4 h-4 transition-colors ${isSelected ? "text-indigo-600 fill-indigo-50" : "text-slate-300 hover:text-indigo-400"}`}
              onClick={() => onToggleSelect(!isSelected)}
            />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 mb-1">
              <DataHealthBadge customer={customer} mode="compact" />
            </div>
            <h4 className="text-[13px] font-bold tracking-tight text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-1">
              {getCustomerCardTitle(customer)}
            </h4>
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10px] text-slate-500 font-medium">
                {customer.city || "Toàn quốc"} •{" "}
                {customer.customer_channel || customer.source || "N/A"}
              </p>

              {/* Dispatch Signals (Max 2 badges) */}
              <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                {!customer.owner_sale_id && !customer.owner_tele_id && (
                  <Badge
                    variant="secondary"
                    className="bg-rose-50 text-rose-600 hover:bg-rose-100 border-none px-1.5 py-0 text-[8px] h-4 uppercase font-bold"
                  >
                    ⭕ Unassigned
                  </Badge>
                )}
                {!hasSocial && (customer.owner_sale_id || customer.owner_tele_id) && (
                  <Badge
                    variant="secondary"
                    className="bg-amber-50 text-amber-600 hover:bg-amber-100 border-none px-1.5 py-0 text-[8px] h-4 uppercase font-bold"
                  >
                    No Social
                  </Badge>
                )}
                {customer.ownership_status === "pending_revoke" && (
                  <Badge
                    variant="secondary"
                    className="bg-purple-50 text-purple-600 hover:bg-purple-100 border-none px-1.5 py-0 text-[8px] h-4 uppercase font-bold"
                  >
                    Revoke
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <div
          className="flex flex-col items-end gap-2 shrink-0 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <InlineCustomerActions
            customer={customer}
            onOpenDrawer={(id) => onPreview && onPreview(customer)}
            onRefresh={() => {}}
            onAssignSale={() => onQuickDispatch("assign_sale")}
            onAssignTele={() => onQuickDispatch("assign_tele")}
          />
        </div>
      </div>

      {customer.notes && (
        <div className="bg-amber-50/50 rounded-lg p-2 border border-amber-100/50 mt-1">
          <p className="text-[10px] text-amber-900 font-medium line-clamp-2 leading-relaxed whitespace-pre-wrap">
            <span className="font-bold mr-1 text-amber-700">📝 Ghi chú:</span>
            {customer.notes}
          </p>
        </div>
      )}

      {/* Staff Info (Owner Block) -> Changed to Chips */}
      <div className="flex items-center gap-1.5 border-t border-slate-50 pt-2.5">
        {customer.owner_sale_id ? (
          <div
            className="flex items-center gap-1 bg-indigo-50/50 rounded-full pr-2 pl-0.5 py-0.5 border border-indigo-100/50"
            title={`Sale: ${saleName}`}
          >
            <div className="w-4 h-4 rounded-full bg-indigo-100 flex items-center justify-center text-[8px] font-bold text-indigo-600">
              {saleInitials}
            </div>
            <span className="text-[9px] font-semibold text-slate-600 truncate max-w-[60px]">
              {saleName.split(" ")[0]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-slate-50 rounded-full px-2 py-0.5 border border-slate-100">
            <span className="text-[9px] font-medium text-slate-400">Chưa có Sale</span>
          </div>
        )}

        {customer.owner_tele_id ? (
          <div
            className="flex items-center gap-1 bg-teal-50/50 rounded-full pr-2 pl-0.5 py-0.5 border border-teal-100/50"
            title={`Tele: ${teleName}`}
          >
            <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center text-[8px] font-bold text-teal-600">
              {teleInitials}
            </div>
            <span className="text-[9px] font-semibold text-slate-600 truncate max-w-[60px]">
              {teleName.split(" ")[0]}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1 bg-slate-50 rounded-full px-2 py-0.5 border border-slate-100">
            <span className="text-[9px] font-medium text-slate-400">Chưa có Tele</span>
          </div>
        )}
      </div>

      <CustomerCardActivityInfo customer={customer} isManager={true} />

      {/* Action Row for Manager */}
      {(!customer.owner_sale_id || stage === "lead_new") && (
        <div className="flex items-center gap-2 pt-2 border-t border-slate-50 mt-1">
          <Button
            className="rounded-xl h-8 w-full text-[11px] font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onQuickDispatch("assign_sale");
            }}
          >
            Chia Lead Nhanh
          </Button>
        </div>
      )}
    </CRMCard>
  );
});

function CustomerIntelligenceRow({
  customer,
  staffMap,
  onPreview,
  onQuickLog,
  isSelected,
  onToggleSelect,
  isManager,
  onQuickDispatch,
}: any) {
  const channelIntel = customer.channel_summary || {};
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  const isVip = totalValue >= 50000000;
  const isAtRisk = customer.ownership_status === "at_risk";
  const hasSocial = channelIntel.has_facebook || channelIntel.has_zalo || channelIntel.has_tiktok;

  const visualState = getCustomerVisualState(customer);

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);
  const saleInitials = getStaffInitials(customer.owner_sale_id, staffMap);
  const teleInitials = getStaffInitials(customer.owner_tele_id, staffMap);

  const hasZalo = !!customer.channel_summary?.has_zalo;
  const primaryPhone = getCustomerPrimaryPhone(customer);

  return (
    <div
      className={`group bg-white border-2 rounded-2xl p-4 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm hover:shadow-md transition-all cursor-pointer ${visualState.borderColor} ${visualState.animation || ""}`}
      onClick={onPreview}
    >
      {/* Col 1: Info & Health */}
      <div className="w-full md:w-4/12 flex items-start gap-4">
        {isManager && onToggleSelect && (
          <div onClick={(e) => e.stopPropagation()} className="cursor-pointer pt-3 shrink-0">
            <CheckSquare
              className={`w-4 h-4 transition-colors ${isSelected ? "text-indigo-600 fill-indigo-50" : "text-slate-300 hover:text-indigo-400"}`}
              onClick={() => onToggleSelect(!isSelected)}
            />
          </div>
        )}
        <div className="flex -space-x-2 shrink-0 pt-2">
          {customer.owner_sale_id && (
            <div
              className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] text-indigo-600 font-bold shadow-sm"
              title={`Sale: ${saleName}`}
            >
              {saleInitials}
            </div>
          )}
          {customer.owner_tele_id && (
            <div
              className="w-8 h-8 rounded-full bg-teal-100 border-2 border-white flex items-center justify-center text-[10px] text-teal-600 font-bold shadow-sm"
              title={`Tele: ${teleName}`}
            >
              {teleInitials}
            </div>
          )}
          {!customer.owner_sale_id && !customer.owner_tele_id && (
            <div
              className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] text-slate-400 font-bold"
              title="Chưa phân công"
            >
              ?
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <DataHealthBadge customer={customer} mode="compact" />
          </div>
          <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
            {getCustomerCardTitle(customer)}
          </h4>
          <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
            {customer.city || "Toàn quốc"} • {customer.customer_channel || customer.source || "N/A"}{" "}
            •{" "}
            {primaryPhone
              ? formatPhoneForDisplay(primaryPhone)
              : customer.email
              ? toSafeString(customer.email).split("@")[0] + "@..."
              : "Chưa có SĐT"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge
              className={`${visualState.bgColor} ${visualState.textColor} text-[8px] px-2 py-0 h-5 uppercase font-black`}
            >
              {visualState.badgeText}
            </Badge>
            {isVip && (
              <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm border-none text-[8px] px-2 py-0 h-5 font-black">
                VIP
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Col 2: Activity Intel */}
      <div className="w-full md:w-3/12 flex flex-col gap-1.5 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6">
        <div className="flex justify-between items-center text-xs">
          <span className="font-medium text-slate-400">Tương tác cuối:</span>
          <span className="font-bold text-slate-700">
            {customer.last_activity_at
              ? formatDistanceToNow(new Date(customer.last_activity_at), {
                  addSuffix: true,
                  locale: vi,
                })
              : "Chưa có"}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs">
          <span className="font-medium text-slate-400">Next Follow-up:</span>
          <span
            className={`font-bold ${getCustomerConversationState(customer).urgency === "overdue" ? "text-orange-600" : "text-slate-700"}`}
          >
            {customer.next_follow_up_at
              ? format(new Date(customer.next_follow_up_at), "HH:mm dd/MM")
              : "Chưa hẹn"}
          </span>
        </div>
      </div>

      {/* Col 3: Stage & Value */}
      <div className="w-full md:w-2/12 border-t border-slate-100 pt-4 md:border-t-0 md:pt-0 md:border-l md:pl-6">
        <Badge
          variant="outline"
          className={`rounded-lg font-black text-[10px] uppercase border-none ${getPipelineStageColor(customer.lifecycle_stage)} bg-opacity-10 text-opacity-100`}
        >
          {getPipelineStageLabel(customer.lifecycle_stage)}
        </Badge>
        {totalValue > 0 && (
          <div className="mt-2 text-xs font-black text-emerald-650">
            {new Intl.NumberFormat("vi-VN").format(totalValue)}đ
          </div>
        )}
      </div>

      {/* Col 4: Quick Actions */}
      <div className="w-full md:w-3/12 flex items-center justify-start md:justify-end gap-2 pt-4 md:pt-0 border-t border-slate-100 md:border-t-0 md:border-l md:pl-6">
        {hasZalo && (
          <Button
            size="icon"
            className="rounded-xl bg-blue-500 hover:bg-blue-600 text-white shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              const href = formatPhoneForZalo(primaryPhone);
              if (href) window.open(href, "_blank");
            }}
            title="Mở Zalo"
          >
            <MessageSquare className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="icon"
          className={`rounded-xl shadow-sm ${!hasZalo ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-100 hover:bg-slate-200 text-slate-700"}`}
          onClick={(e) => {
            e.stopPropagation();
            const href = formatPhoneForCallHref(primaryPhone);
            if (href) window.location.href = href;
          }}
          title="Gọi điện"
        >
          <Phone className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          className={`rounded-xl font-black border-slate-200 shadow-sm ${getCustomerConversationState(customer).urgency === "overdue" ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-slate-600 hover:bg-slate-50"}`}
          onClick={(e) => {
            e.stopPropagation();
            onQuickLog();
          }}
        >
          <Check className="w-4 h-4 mr-2" /> Đã gọi
        </Button>
      </div>
    </div>
  );
}
