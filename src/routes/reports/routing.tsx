/* eslint-disable */
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  MapPin,
  MapPinOff,
  UserPlus,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  ShieldAlert,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { buildStaffMap, getStaffDisplayName, StaffMap } from "@/lib/staffDisplay";
import { calculateDistanceMeters } from "@/lib/geo";
import { getRecommendedRoutingByDistance } from "@/lib/customerRouting";
import {
  getCustomerChannelLabel,
  getCustomerDistanceLabel,
  getCareModelLabel,
} from "@/lib/customerOwnership";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { getCustomerCardTitle } from "@/lib/customers/customerDisplayName";

export const Route = createFileRoute("/reports/routing")({
  component: RoutingReportPage,
});

function RoutingReportPage() {
  const { user, isManager } = useAuth();
  const settings = useSystemSettings();
  const [loading, setLoading] = useState(true);
  const [companyLocation, setCompanyLocation] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<StaffMap>({});

  // For Quick Actions
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);

  // Dialog States
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState<any>(null);
  const [assignType, setAssignType] = useState<"sale" | "tele" | null>(null);
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});

  const [previewCustomer, setPreviewCustomer] = useState<any>(null);

  useEffect(() => {
    if (!isManager) return;
    loadData();
  }, [isManager]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: locData }, { data: custData }, { data: staffData }, { data: rolesData }] =
        await Promise.all([
          supabase
            .from("company_locations")
            .select("*")
            .eq("is_default", true)
            .eq("is_active", true)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("customers")
            .select(
              "id, name, facility_name, latitude, longitude, customer_distance_type, customer_channel, care_model, owner_sale_id, owner_tele_id",
            )
            .is("deleted_at", null),
          supabase.from("profiles").select("id, display_name, email"),
          supabase.from("user_roles").select("*"),
        ]);

      setCompanyLocation(locData || null);
      setCustomers(custData || []);

      if (staffData) {
        setStaffMap(buildStaffMap(staffData));
        setStaffList(staffData);
      }

      if (rolesData) {
        setRolesList(rolesData);
      }
    } catch (err) {
      console.error("Error loading routing report:", err);
    } finally {
      setLoading(false);
    }
  };

  const salesStaff = useMemo(() => {
    return staffList.filter((staff) =>
      rolesList.some((r) => r.user_id === staff.id && r.role === "sale"),
    );
  }, [staffList, rolesList]);

  const teleStaff = useMemo(() => {
    return staffList.filter((staff) =>
      rolesList.some((r) => r.user_id === staff.id && r.role === "tele_lead"),
    );
  }, [staffList, rolesList]);

  const reportData = useMemo(() => {
    let withCoordsCount = 0;
    let withoutCoordsCount = 0;
    let missingSaleCount = 0;
    let missingTeleCount = 0;
    let matchedCount = 0;
    let mismatchedCount = 0;

    const items = customers.map((c) => {
      const hasCoords = c.latitude && c.longitude;
      if (hasCoords) withCoordsCount++;
      else withoutCoordsCount++;

      const isMissingSale =
        (c.customer_distance_type === "near_company" || c.customer_distance_type === "same_city") &&
        !c.owner_sale_id;
      const isMissingTele =
        (c.customer_distance_type === "province" || c.customer_distance_type === "far_city") &&
        !c.owner_tele_id;

      if (isMissingSale) missingSaleCount++;
      if (isMissingTele) missingTeleCount++;

      let distMeters = 0;
      let routing: any = null;
      let isMatch = false;
      let status = "Thiếu dữ liệu";

      if (!companyLocation) {
        status = "Chưa tính";
      } else if (hasCoords) {
        distMeters = calculateDistanceMeters(
          Number(c.latitude),
          Number(c.longitude),
          Number(companyLocation.latitude),
          Number(companyLocation.longitude),
        );

        const thresholds = {
          nearKm: settings.routingNearKm,
          cityKm: settings.routingCityKm,
          farKm: settings.routingFarKm,
        };
        routing = getRecommendedRoutingByDistance(distMeters, thresholds);

        isMatch =
          routing.customerChannel === c.customer_channel &&
          routing.careModel === c.care_model &&
          routing.distanceType === c.customer_distance_type;

        if (!c.customer_channel && !c.care_model && !c.customer_distance_type) {
          status = "Thiếu dữ liệu";
          mismatchedCount++;
        } else if (!isMatch) {
          status = "Lệch phân tuyến";
          mismatchedCount++;
        } else {
          status = "Đúng";
          matchedCount++;
        }
      } else {
        mismatchedCount++;
      }

      return {
        customer: c,
        hasCoords,
        distanceMeters: distMeters,
        distanceKm: companyLocation
          ? distMeters > 0
            ? (distMeters / 1000).toFixed(1)
            : "-"
          : "Chưa có mốc",
        currentRouting: {
          channel: c.customer_channel,
          careModel: c.care_model,
          distanceType: c.customer_distance_type,
        },
        suggestedRouting: routing,
        isMatch,
        status,
        isMissingSale,
        isMissingTele,
      };
    });

    return {
      items,
      stats: {
        total: customers.length,
        withCoords: withCoordsCount,
        withoutCoords: withoutCoordsCount,
        missingSale: companyLocation ? missingSaleCount : "Chưa có mốc",
        missingTele: companyLocation ? missingTeleCount : "Chưa có mốc",
        matched: companyLocation ? matchedCount : "Chưa có mốc",
        mismatched: companyLocation ? mismatchedCount : "Chưa có mốc",
      },
    };
  }, [customers, companyLocation]);

  // ACTIONS
  const handleOpenAssignModal = (item: any, type: "sale" | "tele") => {
    setAssignTarget(item);
    setAssignType(type);
    setSelectedStaffId("");
    setAssignModalOpen(true);
  };

  const handleAssignConfirm = async () => {
    if (!selectedStaffId) return toast.error("Vui lòng chọn nhân sự");
    if (!assignTarget) return;

    const customer = assignTarget.customer;
    const isSale = assignType === "sale";
    const actionKey = `${customer.id}-assign`;

    setSaving(true);
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const updates: any = {};
      if (isSale) {
        updates.owner_sale_id = selectedStaffId;
        updates.customer_channel = "direct_sales";
        updates.care_model = "sale_owned";
      } else {
        updates.owner_tele_id = selectedStaffId;
        updates.customer_channel = "tele_sales";
        updates.care_model = "tele_owned";
      }

      const { error: updErr } = await supabase
        .from("customers")
        .update(updates)
        .eq("id", customer.id);

      if (updErr) throw updErr;

      const staffName =
        staffList.find((s) => s.id === selectedStaffId)?.display_name ||
        staffList.find((s) => s.id === selectedStaffId)?.email ||
        "Nhân sự";
      const title = isSale
        ? "Gán Sale theo phân tuyến địa lý"
        : "Gán Trưởng Tele theo phân tuyến địa lý";
      const distanceStr =
        assignTarget.distanceKm && assignTarget.distanceKm !== "-"
          ? `, khoảng cách ${assignTarget.distanceKm} km`
          : "";
      const content = `${isSale ? "Sale" : "Trưởng Tele"} được gán: ${staffName}. Lý do: Gán ${isSale ? "Sale" : "Trưởng Tele"} theo phân tuyến địa lý${distanceStr}.`;

      const { error: actErr } = await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        activity_type: "handoff",
        title,
        content,
        created_by: user?.id,
      });
      if (actErr) throw actErr;

      const { error: notiErr } = await supabase.from("notifications").insert({
        recipient_user_id: selectedStaffId,
        title: "Bạn được giao khách hàng mới",
        message: `Khách hàng ${getCustomerCardTitle(customer)} vừa được chia cho bạn từ báo cáo phân tuyến.`,
        type: "customer_assigned",
        priority: "high",
        entity_type: "customer",
        entity_id: customer.id,
        action_url: `/customers/${customer.id}`,
        created_by: user?.id,
      });
      if (notiErr) throw notiErr;

      const { error: taskErr } = await supabase.from("customer_tasks").insert({
        customer_id: customer.id,
        title: "Chăm sóc khách mới được phân tuyến",
        note: `Liên hệ và chăm sóc khách hàng mới được phân tuyến dựa trên địa lý.`,
        due_at: new Date(Date.now() + 86400000).toISOString(),
        assigned_to: selectedStaffId,
        assigned_by: user?.id,
        task_type: "call",
        priority: "high",
        status: "pending",
      });
      if (taskErr) throw taskErr;

      toast.success(`Đã gán ${isSale ? "Sale" : "Trưởng Tele"} thành công!`);
      setAssignModalOpen(false);
      setAssignTarget(null);
      setSelectedStaffId("");

      await loadData();
    } catch (err: any) {
      console.error("Error assigning:", err);
      toast.error("Lỗi cập nhật: " + err.message);
    } finally {
      setSaving(false);
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  const handleApplySuggest = async (item: any) => {
    const c = item.customer;
    if (!window.confirm(`Áp dụng gợi ý phân tuyến cho khách hàng ${getCustomerCardTitle(c)}?`))
      return;

    const actionKey = `${c.id}-suggest`;
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }));

    try {
      const suggested = item.suggestedRouting;

      const { error: updateErr } = await supabase
        .from("customers")
        .update({
          customer_distance_type: suggested.distanceType,
          customer_channel: suggested.customerChannel,
          care_model: suggested.careModel,
        })
        .eq("id", c.id);

      if (updateErr) throw updateErr;

      const content = `Khoảng cách: ${item.distanceKm} km\n\nPhân tuyến cũ:\n- Khoảng cách: ${c.customer_distance_type || "Chưa có"}\n- Kênh: ${c.customer_channel || "Chưa có"}\n- Mô hình: ${c.care_model || "Chưa có"}\n\nPhân tuyến mới:\n- Khoảng cách: ${suggested.distanceType}\n- Kênh: ${suggested.customerChannel}\n- Mô hình: ${suggested.careModel}`;

      const { error: actErr } = await supabase.from("customer_activities").insert({
        customer_id: c.id,
        created_by: user?.id,
        activity_type: "note",
        title: "Cập nhật phân tuyến theo báo cáo",
        content: content,
      });

      if (actErr) throw actErr;

      toast.success("Đã áp dụng gợi ý phân tuyến thành công!");
      await loadData();
    } catch (err: any) {
      console.error("Error applying suggestion:", err);
      toast.error("Lỗi áp dụng gợi ý: " + err.message);
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }));
    }
  };

  if (!isManager) {
    return (
      <div className="p-8 text-center text-slate-500">Bạn không có quyền xem báo cáo này.</div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 h-auto md:h-20 flex flex-col md:flex-row md:items-center justify-between gap-4 max-w-7xl">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Báo cáo Chất lượng Phân tuyến</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                Routing & Territory Intelligence
              </p>
            </div>
          </div>
          {companyLocation ? (
            <div className="flex flex-col md:flex-row md:items-center gap-3 w-full md:w-auto text-left md:text-right items-start md:items-end justify-end">
              <div className="text-[10px] font-bold text-slate-500 flex flex-col items-start md:items-end">
                <div className="flex items-center gap-1 font-extrabold text-slate-900 justify-start md:justify-end">
                  <Building2 className="w-3.5 h-3.5 text-indigo-500" />
                  Mốc: {companyLocation.name}
                </div>
                <div
                  className="text-[9px] text-slate-400 mt-0.5 line-clamp-1 max-w-[250px] text-left md:text-right"
                  title={companyLocation.address}
                >
                  {companyLocation.address}
                </div>
                <div className="text-[8px] font-mono text-indigo-500/80 mt-0.5 text-left md:text-right">
                  Tọa độ: {Number(companyLocation.latitude).toFixed(6)},{" "}
                  {Number(companyLocation.longitude).toFixed(6)}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-[9px] font-black uppercase tracking-wider text-indigo-600 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all rounded-lg flex items-center gap-1 shrink-0"
                onClick={() => {
                  window.open(
                    `https://www.google.com/maps/search/?api=1&query=${companyLocation.latitude},${companyLocation.longitude}`,
                    "_blank",
                  );
                }}
              >
                <MapPin className="w-3 h-3" /> Mở Google Maps
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-rose-500 bg-rose-50 border border-rose-100 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider w-full md:w-auto justify-center md:justify-start">
              <AlertTriangle className="w-3.5 h-3.5 animate-pulse" /> Chưa thiết lập mốc mặc định
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          </div>
        ) : (
          <>
            {!companyLocation && (
              <div className="bg-rose-50 border border-rose-100 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 shadow-md shadow-rose-100/50">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-900">
                      Chưa cấu hình mốc văn phòng mặc định
                    </h3>
                    <p className="text-xs font-medium text-rose-700/80 mt-1">
                      Hệ thống không thể tính toán khoảng cách và phân tuyến tự động. Vui lòng thiết
                      lập mốc văn phòng mặc định trong cấu hình hệ thống.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => (window.location.href = "/admin/settings")}
                  className="rounded-2xl text-xs font-black uppercase bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-200/50 px-6 py-2.5 h-auto self-stretch md:self-auto"
                >
                  Đến cấu hình hệ thống
                </Button>
              </div>
            )}

            {/* KPI CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <KpiCard
                title="Có tọa độ bản đồ"
                value={reportData.stats.withCoords}
                total={reportData.stats.total}
                icon={MapPin}
                color="indigo"
              />
              <KpiCard
                title="Chưa ghim vị trí"
                value={reportData.stats.withoutCoords}
                total={reportData.stats.total}
                icon={MapPinOff}
                color="rose"
              />
              <KpiCard
                title="Khách gần chưa có Sale"
                value={reportData.stats.missingSale}
                total={companyLocation ? reportData.stats.withCoords : 0}
                icon={UserPlus}
                color="blue"
              />
              <KpiCard
                title="Khách xa chưa có Tele"
                value={reportData.stats.missingTele}
                total={companyLocation ? reportData.stats.withCoords : 0}
                icon={PhoneCall}
                color="amber"
              />
              <KpiCard
                title="Phân tuyến chuẩn"
                value={reportData.stats.matched}
                total={companyLocation ? reportData.stats.withCoords : 0}
                icon={CheckCircle2}
                color="emerald"
              />
              <KpiCard
                title="Lệch / Thiếu dữ liệu phân tuyến"
                value={reportData.stats.mismatched}
                total={companyLocation ? reportData.stats.total : 0}
                icon={AlertTriangle}
                color="orange"
                description="Bao gồm khách có tọa độ nhưng lệch rule phân tuyến, hoặc khách thiếu GPS nên chưa thể tính tuyến."
              />
            </div>

            {/* TABLE */}
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-black text-slate-900 tracking-tight">
                  Chi tiết Phân tuyến Khách hàng
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto w-full max-w-full">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-y border-slate-100 uppercase text-[9px] font-black text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-6 py-4 whitespace-nowrap">Khách hàng</th>
                        <th className="px-6 py-4 whitespace-nowrap text-center">Khoảng cách</th>
                        <th className="px-6 py-4 whitespace-nowrap">Hiện tại</th>
                        <th className="px-6 py-4 whitespace-nowrap text-center"> </th>
                        <th className="px-6 py-4 whitespace-nowrap">Gợi ý</th>
                        <th className="px-6 py-4 whitespace-nowrap">Owner</th>
                        <th className="px-6 py-4 whitespace-nowrap text-center">Trạng thái</th>
                        <th className="px-6 py-4 whitespace-nowrap text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reportData.items.map((item, idx) => {
                        const c = item.customer;
                        return (
                          <tr key={c.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 line-clamp-1">
                                {getCustomerCardTitle(c)}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {!companyLocation ? (
                                <Badge className="bg-rose-50 text-rose-600 border border-rose-100/50 hover:bg-rose-50 shadow-none font-bold">
                                  Chưa có mốc
                                </Badge>
                              ) : item.hasCoords ? (
                                <span className="font-black text-indigo-600">
                                  {item.distanceKm} km
                                </span>
                              ) : (
                                <span className="text-slate-300 italic font-medium">
                                  Chưa có GPS
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1 text-[9px] font-bold text-slate-600">
                                <div>
                                  {getCustomerDistanceLabel(item.currentRouting.distanceType)}
                                </div>
                                <div>{getCustomerChannelLabel(item.currentRouting.channel)}</div>
                                <div>{getCareModelLabel(item.currentRouting.careModel)}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <ArrowRight className="w-4 h-4 mx-auto text-slate-300" />
                            </td>
                            <td className="px-6 py-4">
                              {!companyLocation ? (
                                <Badge className="bg-rose-50 text-rose-600 border border-rose-100/50 hover:bg-rose-50 shadow-none font-bold">
                                  Chưa có mốc
                                </Badge>
                              ) : item.suggestedRouting ? (
                                <div className="space-y-1 text-[9px] font-bold text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                                  <div>
                                    {getCustomerDistanceLabel(item.suggestedRouting.distanceType)}
                                  </div>
                                  <div>
                                    {getCustomerChannelLabel(item.suggestedRouting.customerChannel)}
                                  </div>
                                  <div>{getCareModelLabel(item.suggestedRouting.careModel)}</div>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">Không thể tính</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1 text-[10px]">
                                {c.owner_sale_id ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1 text-indigo-600 border-indigo-200"
                                    >
                                      Sale
                                    </Badge>{" "}
                                    <span className="font-bold text-slate-700 truncate max-w-[100px] block">
                                      {getStaffDisplayName(c.owner_sale_id, staffMap)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1 text-slate-400 border-slate-200"
                                    >
                                      Sale
                                    </Badge>{" "}
                                    <span className="text-slate-400 italic">Trống</span>
                                  </div>
                                )}
                                {c.owner_tele_id ? (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1 text-amber-600 border-amber-200"
                                    >
                                      Tele
                                    </Badge>{" "}
                                    <span className="font-bold text-slate-700 truncate max-w-[100px] block">
                                      {getStaffDisplayName(c.owner_tele_id, staffMap)}
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Badge
                                      variant="outline"
                                      className="text-[8px] px-1 text-slate-400 border-slate-200"
                                    >
                                      Tele
                                    </Badge>{" "}
                                    <span className="text-slate-400 italic">Trống</span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.status === "Đúng" ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100 shadow-none">
                                  Đúng
                                </Badge>
                              ) : item.status === "Lệch phân tuyến" ? (
                                <Badge className="bg-amber-100 text-amber-700 border-none hover:bg-amber-100 shadow-none">
                                  Lệch
                                </Badge>
                              ) : item.status === "Chưa tính" ? (
                                <Badge className="bg-slate-100 text-slate-600 border-none hover:bg-slate-100 shadow-none">
                                  Chưa tính
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 border-none hover:bg-rose-100 shadow-none">
                                  Thiếu
                                </Badge>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right space-y-2">
                              {!item.hasCoords && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[9px] font-black uppercase text-rose-600 border-rose-200 hover:bg-rose-50"
                                  onClick={() => setPreviewCustomer(c)}
                                >
                                  Mở khách
                                </Button>
                              )}
                              {item.isMissingSale && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[9px] font-black uppercase text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                  onClick={() => handleOpenAssignModal(item, "sale")}
                                  disabled={actionLoading[`${c.id}-assign`]}
                                >
                                  {actionLoading[`${c.id}-assign`] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-indigo-600" />
                                  ) : (
                                    "Gán Sale"
                                  )}
                                </Button>
                              )}
                              {item.isMissingTele && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[9px] font-black uppercase text-amber-600 border-amber-200 hover:bg-amber-50"
                                  onClick={() => handleOpenAssignModal(item, "tele")}
                                  disabled={actionLoading[`${c.id}-assign`]}
                                >
                                  {actionLoading[`${c.id}-assign`] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-amber-600" />
                                  ) : (
                                    "Gán Trưởng Tele"
                                  )}
                                </Button>
                              )}
                              {item.status === "Lệch phân tuyến" && item.hasCoords && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full h-7 text-[9px] font-black uppercase text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                                  onClick={() => handleApplySuggest(item)}
                                  disabled={actionLoading[`${c.id}-suggest`]}
                                >
                                  {actionLoading[`${c.id}-suggest`] ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto text-emerald-600" />
                                  ) : (
                                    "Áp dụng gợi ý"
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {reportData.items.length === 0 && (
                        <tr>
                          <td
                            colSpan={8}
                            className="px-6 py-12 text-center text-slate-400 font-medium text-sm"
                          >
                            Chưa có dữ liệu khách hàng
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>

      {/* CUSTOMER PREVIEW (For missing GEO) */}
      {previewCustomer && (
        <CustomerPreviewDrawer
          open={!!previewCustomer}
          onOpenChange={(open) => !open && setPreviewCustomer(null)}
          customer={previewCustomer}
          staffMap={staffMap}
        />
      )}

      {/* ASSIGN MODAL */}
      <Dialog open={assignModalOpen} onOpenChange={(open) => !saving && setAssignModalOpen(open)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black tracking-tight text-slate-900">
              {assignType === "sale" ? "Gán Sale Phụ Trách" : "Gán Trưởng Tele"}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500 uppercase mt-1 tracking-widest">
              {getCustomerCardTitle(assignTarget?.customer || {})}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Chọn nhân sự
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl h-12 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
              disabled={saving}
            >
              <option value="">-- Chọn nhân sự --</option>
              {(assignType === "sale" ? salesStaff : teleStaff).length === 0 && (
                <option value="" disabled>
                  Chưa có nhân sự phù hợp để gán.
                </option>
              )}
              {(assignType === "sale" ? salesStaff : teleStaff).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || s.email || "Chưa rõ tên"}
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              onClick={() => setAssignModalOpen(false)}
              disabled={saving}
              className="rounded-xl text-xs font-bold"
            >
              Hủy
            </Button>
            <Button
              onClick={handleAssignConfirm}
              disabled={saving || !selectedStaffId}
              className="rounded-xl text-xs font-black uppercase bg-slate-900 hover:bg-black px-6"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Xác nhận gán"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ title, value, total, icon: Icon, color, description }: any) {
  const isString = typeof value === "string";
  const displayColor = isString ? "rose" : color;

  const colorClasses: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    orange: "bg-orange-50 text-orange-600 border-orange-100",
  };

  const percentage = typeof value === "number" && total > 0 ? Math.round((value / total) * 100) : 0;

  const cardContent = (
    <Card
      className={`rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group ${description ? "cursor-help" : ""}`}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${colorClasses[displayColor]}`}
          >
            <Icon className="w-6 h-6" />
          </div>
          {!isString && total > 0 && (
            <div className="text-[10px] font-black px-2 py-1 rounded-lg text-slate-500 bg-slate-50 border border-slate-100">
              {percentage}%
            </div>
          )}
        </div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <div className="flex items-baseline gap-1 mt-1">
          <h3
            className={`font-black text-slate-900 tracking-tighter ${isString ? "text-xs text-rose-500 font-bold uppercase tracking-wider" : "text-3xl"}`}
          >
            {value}
          </h3>
        </div>
      </CardContent>
    </Card>
  );

  if (description) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
          <TooltipContent className="max-w-[280px] p-3 text-center bg-slate-900 text-white rounded-xl text-xs font-semibold leading-relaxed shadow-lg z-[9999]">
            {description}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return cardContent;
}
