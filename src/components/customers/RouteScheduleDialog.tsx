import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  PlusCircle,
  User,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  CalendarCheck,
} from "lucide-react";
import { calculateDistanceMeters, formatDistance, buildGoogleMapsRouteUrl } from "@/lib/geo";

interface RouteScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderedCustomers: any[];
  routeOrigin: { latitude: number; longitude: number } | null;
  routeOriginLabel: string | null;
  currentUser: any;
  isAdminOrSubAdmin: boolean;
  onSuccess: (succeededIds: string[]) => void;
}

export function RouteScheduleDialog({
  isOpen,
  onClose,
  orderedCustomers,
  routeOrigin,
  routeOriginLabel,
  currentUser,
  isAdminOrSubAdmin,
  onSuccess,
}: RouteScheduleDialogProps) {
  // Staff states (For Admin/Sub Admin selection)
  const [staffList, setStaffList] = useState<any[]>([]);
  const [rolesList, setRolesList] = useState<any[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState<string>("");

  // Form states
  const [visitDate, setVisitDate] = useState<string>(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0], // default tomorrow
  );
  const [startTime, setStartTime] = useState<string>("08:30");
  const [defaultDuration, setDefaultDuration] = useState<number>(60);
  const [bufferMinutes, setBufferMinutes] = useState<number>(15);
  const [generalNote, setGeneralNote] = useState<string>("");
  const [createTask, setCreateTask] = useState<boolean>(true);

  // Individual chặng duration overrides & ignored selections
  const [individualDurations, setIndividualDurations] = useState<Record<string, number>>({});
  const [ignoredCustomerIds, setIgnoredCustomerIds] = useState<string[]>([]);

  // Duplicate checks state
  const [duplicateEventCustomerIds, setDuplicateEventCustomerIds] = useState<string[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState<boolean>(false);

  // Processing & Summary states
  const [saving, setSaving] = useState<boolean>(false);
  const [showSummary, setShowSummary] = useState<boolean>(false);
  const [summary, setSummary] = useState<{
    successEvents: number;
    successTasks: number;
    successActivities: number;
    failedCount: number;
    failedList: Array<{ name: string; error: string }>;
    succeededIds: string[];
  }>({
    successEvents: 0,
    successTasks: 0,
    successActivities: 0,
    failedCount: 0,
    failedList: [],
    succeededIds: [],
  });

  // Query duplicate calendar events for selected day
  useEffect(() => {
    const checkDuplicateEvents = async () => {
      if (!isOpen || !visitDate || orderedCustomers.length === 0) {
        setDuplicateEventCustomerIds([]);
        return;
      }
      setCheckingDuplicates(true);
      try {
        const customerIds = orderedCustomers.map((c) => c.id).filter(Boolean);
        if (customerIds.length === 0) {
          setDuplicateEventCustomerIds([]);
          return;
        }

        const startOfDay = `${visitDate}T00:00:00.000Z`;
        const endOfDay = `${visitDate}T23:59:59.999Z`;

        const { data, error } = await supabase
          .from("calendar_events")
          .select("customer_id")
          .eq("event_type", "direct_visit")
          .in("customer_id", customerIds)
          .gte("starts_at", startOfDay)
          .lte("starts_at", endOfDay);

        if (error) {
          console.error("Error checking duplicate events:", error);
        } else if (data) {
          const dupIds = Array.from(new Set(data.map((evt: any) => evt.customer_id)));
          setDuplicateEventCustomerIds(dupIds as string[]);
        }
      } catch (err) {
        console.error("Failed checking duplicate events:", err);
      } finally {
        setCheckingDuplicates(false);
      }
    };

    checkDuplicateEvents();
  }, [isOpen, visitDate, orderedCustomers]);

  // Load Sales staff list if user is Admin/Sub Admin
  useEffect(() => {
    if (isOpen && isAdminOrSubAdmin) {
      fetchStaff();
    }
  }, [isOpen, isAdminOrSubAdmin]);

  // Set default sale if regular Sale user
  useEffect(() => {
    if (isOpen && !isAdminOrSubAdmin && currentUser) {
      setSelectedSaleId(currentUser.id);
    }
  }, [isOpen, isAdminOrSubAdmin, currentUser]);

  // Reset states on open
  useEffect(() => {
    if (isOpen) {
      setShowSummary(false);
      setSaving(false);
      setIndividualDurations({});
      setIgnoredCustomerIds([]);
      setGeneralNote("");
    }
  }, [isOpen]);

  const fetchStaff = async () => {
    setLoadingStaff(true);
    try {
      const [resP, resR] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      if (resP.data) setStaffList(resP.data);
      if (resR.data) setRolesList(resR.data);
    } catch (e) {
      console.error("Error fetching staff roles:", e);
      toast.error("Không thể tải danh sách nhân sự phụ trách.");
    } finally {
      setLoadingStaff(false);
    }
  };

  // Filter profiles that have the 'sale' role or are admin/sub_admin (since they can also be assigned)
  const salesStaff = useMemo(() => {
    return staffList.filter((staff) => {
      const staffRoles = rolesList.filter((r) => r.user_id === staff.id).map((r) => r.role);
      return staffRoles.some((role) => role === "sale" || role === "admin");
    });
  }, [staffList, rolesList]);

  // Handle changing individual duration
  const handleIndividualDurationChange = (customerId: string, value: number) => {
    const val = isNaN(value) || value < 1 ? 1 : value;
    setIndividualDurations((prev) => ({
      ...prev,
      [customerId]: val,
    }));
  };

  const handleToggleCustomer = (customerId: string) => {
    setIgnoredCustomerIds((prev) =>
      prev.includes(customerId) ? prev.filter((id) => id !== customerId) : [...prev, customerId],
    );
  };

  // Compute live timeline previews dynamically
  const previewTimeline = useMemo(() => {
    const timeline: any[] = [];
    if (orderedCustomers.length === 0) return timeline;

    const activeRouteCustomers = orderedCustomers.filter(
      (c) => c.id && c.latitude && c.longitude && !ignoredCustomerIds.includes(c.id),
    );

    let lastCoordinates = routeOrigin;

    orderedCustomers.forEach((customer, index) => {
      const hasCoords = !!(customer.latitude && customer.longitude && customer.id);
      const isIgnored = ignoredCustomerIds.includes(customer.id);

      let startsAt: Date | null = null;
      let endsAt: Date | null = null;
      let duration = individualDurations[customer.id] ?? defaultDuration;
      let distanceText = "";

      if (hasCoords && !isIgnored) {
        const activeIdx = activeRouteCustomers.findIndex((c) => c.id === customer.id);
        if (activeIdx !== -1) {
          let tempPointer = new Date(`${visitDate}T${startTime}:00`);
          if (isNaN(tempPointer.getTime())) tempPointer = new Date();

          let tempCoords = routeOrigin;

          for (let i = 0; i <= activeIdx; i++) {
            const activeCust = activeRouteCustomers[i];
            const activeDuration = individualDurations[activeCust.id] ?? defaultDuration;

            const itemStarts = new Date(tempPointer.getTime());
            const itemEnds = new Date(tempPointer.getTime() + activeDuration * 60 * 1000);

            if (i === activeIdx) {
              startsAt = itemStarts;
              endsAt = itemEnds;
              duration = activeDuration;

              if (tempCoords && activeCust.latitude && activeCust.longitude) {
                const dist = calculateDistanceMeters(
                  tempCoords.latitude,
                  tempCoords.longitude,
                  Number(activeCust.latitude),
                  Number(activeCust.longitude),
                );
                distanceText = formatDistance(dist);
              }
            }

            tempCoords = {
              latitude: Number(activeCust.latitude),
              longitude: Number(activeCust.longitude),
            };
            tempPointer = new Date(itemEnds.getTime() + bufferMinutes * 60 * 1000);
          }
        }
      }

      timeline.push({
        customer,
        startsAt,
        endsAt,
        duration,
        distanceText,
        hasCoords,
        isIgnored,
        isDuplicate: duplicateEventCustomerIds.includes(customer.id),
        title: `Viếng thăm ${customer.facility_name || customer.name || "Khách hàng"}`,
      });
    });

    return timeline;
  }, [
    orderedCustomers,
    ignoredCustomerIds,
    duplicateEventCustomerIds,
    visitDate,
    startTime,
    defaultDuration,
    bufferMinutes,
    individualDurations,
    routeOrigin,
  ]);

  // Compute active scheduling stops
  const activeStops = useMemo(() => {
    return previewTimeline.filter((item) => item.startsAt && item.endsAt);
  }, [previewTimeline]);

  // Compute total accumulated distance of the scheduled route
  const totalRouteDistance = useMemo(() => {
    let totalMeters = 0;
    let lastCoordinates = routeOrigin;
    const activeRouteCustomers = orderedCustomers.filter(
      (c) => c.id && c.latitude && c.longitude && !ignoredCustomerIds.includes(c.id),
    );

    activeRouteCustomers.forEach((customer) => {
      if (lastCoordinates && customer.latitude && customer.longitude) {
        const dist = calculateDistanceMeters(
          lastCoordinates.latitude,
          lastCoordinates.longitude,
          Number(customer.latitude),
          Number(customer.longitude),
        );
        totalMeters += dist;
      }
      lastCoordinates = {
        latitude: Number(customer.latitude),
        longitude: Number(customer.longitude),
      };
    });

    return totalMeters;
  }, [orderedCustomers, ignoredCustomerIds, routeOrigin]);

  // Generate Google Maps Waypoints Route Link
  const googleMapsUrl = useMemo(() => {
    if (!routeOrigin || activeStops.length === 0) return null;
    const mappedStops = activeStops.map((item) => item.customer);
    return buildGoogleMapsRouteUrl(routeOrigin, mappedStops);
  }, [routeOrigin, activeStops]);

  const handleSaveSchedule = async () => {
    if (saving) return; // Prevent double creation

    if (activeStops.length === 0) {
      toast.error("Không có khách hàng hợp lệ để xếp lịch viếng thăm.");
      return;
    }

    if (!selectedSaleId) {
      toast.error("Vui lòng chọn nhân viên Sale phụ trách chặng này.");
      return;
    }

    if (!visitDate || !startTime) {
      toast.error("Vui lòng nhập đầy đủ ngày đi và giờ bắt đầu.");
      return;
    }

    // Checking duplicates before saving
    const duplicateStops = activeStops.filter((item) => item.isDuplicate);
    if (duplicateStops.length > 0) {
      const confirmSave = window.confirm(
        `Phát hiện ${duplicateStops.length} khách hàng đã có lịch hẹn trùng ngày ${visitDate}. Bạn có muốn tiếp tục tạo lịch trùng lắp không?`,
      );
      if (!confirmSave) {
        return;
      }
    }

    setSaving(true);

    let successEvents = 0;
    let successTasks = 0;
    let successActivities = 0;
    let failedCount = 0;
    const failedList: Array<{ name: string; error: string }> = [];
    const succeededIds: string[] = [];

    // Process chặng dừng sequentially
    for (let index = 0; index < activeStops.length; index++) {
      const item = activeStops[index];
      const { customer, startsAt, endsAt, title } = item;
      if (!startsAt || !endsAt) continue;

      let stepSuccess = true;

      try {
        // 1. Tạo sự kiện lịch viếng thăm (calendar_events)
        const { error: eventError } = await supabase.from("calendar_events" as any).insert({
          customer_id: customer.id,
          title: title,
          event_type: "direct_visit",
          status: "pending",
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          assigned_sale_id: selectedSaleId,
          created_by: currentUser?.id || selectedSaleId,
          description: generalNote ? generalNote.trim() : null,
        } as any);

        if (eventError) throw eventError;
        successEvents++;

        // 2. Tạo công việc đi kèm nếu được lựa chọn (customer_tasks)
        if (createTask) {
          const { error: taskError } = await supabase.from("customer_tasks" as any).insert({
            customer_id: customer.id,
            assigned_to: selectedSaleId,
            assigned_by: currentUser?.id || selectedSaleId,
            task_type: "direct_visit",
            title: title,
            note: generalNote ? generalNote.trim() : null,
            status: "pending",
            due_at: startsAt.toISOString(),
          } as any);

          if (taskError) throw taskError;
          successTasks++;
        }
      } catch (err: any) {
        console.error(`Error saving stop for ${customer.name}:`, err);
        stepSuccess = false;
        failedCount++;
        failedList.push({
          name: customer.facility_name || customer.name || "Khách hàng",
          error: err.message || "Lỗi lưu trữ bản ghi sự kiện chính.",
        });
      }

      // 3. Tạo lịch sử hoạt động chăm sóc thực địa (customer_activities)
      if (stepSuccess) {
        succeededIds.push(customer.id);
        try {
          const formattedTimeStr = `${startsAt.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })} - ${endsAt.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`;
          const formattedDateStr = startsAt.toLocaleDateString("vi-VN");

          const { error: activityError } = await supabase
            .from("customer_activities" as any)
            .insert({
              customer_id: customer.id,
              created_by: currentUser?.id || selectedSaleId,
              activity_type: "follow_up",
              title: "Đã lên lịch viếng thăm theo tuyến",
              content: `Lịch viếng thăm chặng ${index + 1} lúc ${formattedTimeStr}, ngày ${formattedDateStr}. Ghi chú: ${
                generalNote ? generalNote.trim() : "Không có"
              }`,
            } as any);

          if (activityError) {
            console.warn("Activity logger error:", activityError);
          } else {
            successActivities++;
          }
        } catch (actErr) {
          console.error("Failed to write activity logs:", actErr);
        }
      }
    }

    setSummary({
      successEvents,
      successTasks,
      successActivities,
      failedCount,
      failedList,
      succeededIds,
    });
    setSaving(false);
    setShowSummary(true);

    if (failedCount === 0) {
      toast.success(`Đã tạo thành công tuyến lịch viếng thăm cho ${succeededIds.length} khách!`);
    } else {
      toast.warning(
        `Xếp lịch hoàn tất: ${succeededIds.length} chặng thành công, ${failedCount} chặng bị lỗi.`,
      );
    }
  };

  const handleFinish = (clearAll: boolean) => {
    if (clearAll) {
      onSuccess(summary.succeededIds);
    }
    onClose();
  };

  // Render Empty State if no customers loaded
  if (orderedCustomers.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border-slate-100 shadow-2xl flex flex-col items-center justify-center text-center space-y-4">
          <DialogHeader className="w-full flex flex-col items-center">
            <span className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-650 flex items-center justify-center animate-pulse">
              <MapPin className="w-6 h-6" />
            </span>
            <DialogTitle className="text-base font-black text-slate-900 tracking-tight mt-3">
              Chưa Chọn Tuyến Khách Hàng
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed max-w-xs">
            Hãy chọn các khách hàng trên bản đồ trong chế độ **Lập tuyến đi** để lên danh sách lộ
            trình tối ưu và xếp lịch hàng loạt.
          </p>
          <DialogFooter className="w-full pt-2">
            <Button
              onClick={onClose}
              className="w-full rounded-xl bg-slate-900 hover:bg-black text-white font-black text-xs h-10 px-5 shadow-lg shadow-slate-200"
            >
              Quay lại bản đồ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl rounded-3xl p-6 border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
              <CalendarCheck className="w-4.5 h-4.5" />
            </span>
            Lên lịch viếng thăm theo tuyến
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
            Tự động lên lịch chặng dừng tối ưu và phân phối đầu việc thực địa
          </DialogDescription>
        </DialogHeader>

        {showSummary ? (
          /* TRÌNH BÀO CÁO KẾT QUẢ TÓM TẮT (SUMMARY VIEW) */
          <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-5">
            <div className="text-center py-4 space-y-2">
              {summary.failedCount === 0 ? (
                <div className="mx-auto w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle2 className="w-6.5 h-6.5" />
                </div>
              ) : (
                <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 text-amber-650 flex items-center justify-center shadow-sm">
                  <AlertCircle className="w-6.5 h-6.5" />
                </div>
              )}
              <h3 className="text-sm font-black text-slate-955">
                {summary.failedCount === 0
                  ? "Tạo Tuyến Lịch Thành Công!"
                  : "Hoàn Tất Tạo Lịch Với Một Số Lỗi"}
              </h3>
              <p className="text-xs text-slate-400 font-medium font-semibold">
                Đã đồng bộ hóa các đầu việc thực địa thời gian thực
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="rounded-2xl border-slate-100 shadow-2xs text-center bg-slate-50/50 p-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Lịch Sự Kiện</p>
                <p className="text-base font-black text-indigo-650 mt-1">{summary.successEvents}</p>
                <Badge
                  variant="outline"
                  className="mt-1 text-[8px] font-bold bg-white text-indigo-750 border-indigo-100"
                >
                  Thành công
                </Badge>
              </Card>
              <Card className="rounded-2xl border-slate-100 shadow-2xs text-center bg-slate-50/50 p-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Công Việc Giao</p>
                <p className="text-base font-black text-indigo-650 mt-1">{summary.successTasks}</p>
                <Badge
                  variant="outline"
                  className="mt-1 text-[8px] font-bold bg-white text-indigo-755 border-indigo-100"
                >
                  Thành công
                </Badge>
              </Card>
              <Card className="rounded-2xl border-slate-100 shadow-2xs text-center bg-slate-50/50 p-2.5">
                <p className="text-[9px] font-bold text-slate-400 uppercase">Nhật Ký Chăm Sóc</p>
                <p className="text-base font-black text-indigo-650 mt-1">
                  {summary.successActivities}
                </p>
                <Badge
                  variant="outline"
                  className="mt-1 text-[8px] font-bold bg-white text-indigo-750 border-indigo-100"
                >
                  Thành công
                </Badge>
              </Card>
            </div>

            {summary.failedCount > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Khách hàng bị lỗi tạo lịch (
                  {summary.failedCount})
                </div>
                <div className="border border-rose-100 rounded-2xl bg-rose-50/20 p-3.5 space-y-2.5 max-h-[160px] overflow-y-auto">
                  {summary.failedList.map((err, idx) => (
                    <div key={idx} className="flex gap-2 text-xs">
                      <span className="w-4 h-4 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 leading-tight">{err.name}</p>
                        <p className="text-[10px] text-rose-600 font-semibold leading-relaxed mt-0.5">
                          Lỗi: {err.error}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Actions Navigation Section */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => window.open("/calendar", "_blank")}
                className="rounded-xl border-slate-200 font-bold text-xs h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 shadow-2xs"
              >
                📅 Mở lịch hẹn
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open("/tasks", "_blank")}
                className="rounded-xl border-slate-200 font-bold text-xs h-10 px-4 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 shadow-2xs"
              >
                💼 Mở Workspace
              </Button>
              {googleMapsUrl && (
                <Button
                  variant="outline"
                  onClick={() => window.open(googleMapsUrl, "_blank")}
                  className="rounded-xl border-rose-200 text-rose-700 font-bold text-xs h-10 px-4 bg-rose-50/20 hover:bg-rose-50 flex items-center justify-center gap-1.5 col-span-2 shadow-2xs"
                >
                  🗺️ Mở Google Maps tuyến đường ({activeStops.length} điểm)
                </Button>
              )}
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0 flex-row justify-end space-x-2 border-t border-slate-50 mt-2">
              <Button
                variant="outline"
                onClick={() => handleFinish(false)}
                className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 bg-white hover:bg-slate-50 text-slate-700 shrink-0"
              >
                Chỉ đóng (Giữ lại chặng)
              </Button>
              <Button
                onClick={() => handleFinish(true)}
                className="rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-black text-xs h-10 px-5 shadow-lg shadow-indigo-100 shrink-0"
              >
                🧹 Xoá lựa chọn & Đóng
              </Button>
            </DialogFooter>
          </div>
        ) : (
          /* PHẦN NHẬP FORM & PREVIEW BẢNG */
          <>
            <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
              {/* Premium Route Summary Header Card */}
              <div className="bg-indigo-50/50 rounded-2xl border border-indigo-100/40 p-3.5 grid grid-cols-3 gap-2.5 shadow-2xs">
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                    Điểm xuất phát
                  </span>
                  <div className="text-[11px] font-black text-slate-800 flex items-center gap-1 mt-0.5 truncate">
                    <span className="shrink-0 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    <span className="truncate">{routeOriginLabel || "Vị trí hiện tại (GPS)"}</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                    Khách hàng lập lịch
                  </span>
                  <p className="text-[11px] font-black text-indigo-750 mt-0.5 font-semibold">
                    {activeStops.length} / {orderedCustomers.length} chặng dừng
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">
                    Tổng khoảng cách
                  </span>
                  <p className="text-[11px] font-black text-rose-650 mt-0.5 font-semibold">
                    🚗 ~{formatDistance(totalRouteDistance)}
                  </p>
                </div>
              </div>

              {/* Grid 4 fields chính */}
              <div className="grid grid-cols-2 gap-4">
                {/* Chọn ngày đi */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Ngày đi viếng thăm
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="date"
                      value={visitDate}
                      onChange={(e) => setVisitDate(e.target.value)}
                      className="pl-10 rounded-xl border-slate-200 h-10 text-xs font-bold bg-white"
                    />
                  </div>
                </div>

                {/* Chọn giờ bắt đầu */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                    Giờ xuất phát
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="pl-10 rounded-xl border-slate-200 h-10 text-xs font-bold bg-white"
                    />
                  </div>
                </div>

                {/* Thời lượng chặng mặc định */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                    Thời lượng mỗi điểm (phút)
                  </label>
                  <Input
                    type="number"
                    min="5"
                    step="5"
                    value={defaultDuration}
                    onChange={(e) => setDefaultDuration(Math.max(5, Number(e.target.value)))}
                    className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                  />
                </div>

                {/* Thời gian di chuyển */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                    Di chuyển/Nghỉ giữa chặng (phút)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="5"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(Math.max(0, Number(e.target.value)))}
                    className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Section giao cho sale (Đối với Admin/Sub Admin) */}
              {isAdminOrSubAdmin ? (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                    Giao cho Sale phụ trách
                  </label>
                  {loadingStaff ? (
                    <div className="h-10 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center">
                      <RefreshCw className="h-4 w-4 animate-spin text-slate-400 mr-2" />
                      <span className="text-[10px] font-bold text-slate-455 uppercase">
                        Đang tải danh sách Sale...
                      </span>
                    </div>
                  ) : (
                    <select
                      value={selectedSaleId}
                      onChange={(e) => setSelectedSaleId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white h-10 px-3.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                    >
                      <option value="">-- Chọn nhân viên Sale --</option>
                      {salesStaff.map((staff) => (
                        <option key={staff.id} value={staff.id}>
                          👤 {staff.display_name || staff.email}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-slate-50/60 rounded-2xl border border-slate-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-[11px] font-bold text-slate-650">
                    Người viếng thăm phụ trách:{" "}
                    <span className="text-slate-950 font-black">
                      Bản thân ({currentUser?.email})
                    </span>
                  </span>
                </div>
              )}

              {/* Ô ghi chú chung */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-455 uppercase tracking-wider block">
                  Ghi chú chung cho chuyến đi
                </label>
                <textarea
                  placeholder="Kế hoạch thực địa, tài liệu bàn giao, mục tiêu viếng thăm..."
                  value={generalNote}
                  onChange={(e) => setGeneralNote(e.target.value)}
                  className="w-full min-h-[60px] rounded-xl border border-slate-200 p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white text-slate-800"
                />
              </div>

              {/* Switch checkbox công việc kèm theo */}
              <div className="flex items-center gap-2.5 px-1 py-0.5">
                <input
                  type="checkbox"
                  id="createTaskCheck"
                  checked={createTask}
                  onChange={(e) => setCreateTask(e.target.checked)}
                  className="rounded border-slate-350 text-indigo-650 focus:ring-indigo-500 h-4 w-4 cursor-pointer animate-pulse"
                />
                <label
                  htmlFor="createTaskCheck"
                  className="text-[10px] text-slate-650 font-bold uppercase tracking-wider cursor-pointer select-none"
                >
                  Tạo task chăm sóc đi kèm vào Đầu việc của Sale (Tương ứng starts_at)
                </label>
              </div>

              {/* Khối xem trước dòng thời gian (Live Timetable Preview Table) */}
              <div className="space-y-2">
                <div className="text-[10px] font-black text-slate-450 uppercase tracking-widest block flex justify-between items-center">
                  <span>Dòng thời gian dự kiến ({activeStops.length} chặng được chọn)</span>
                  {checkingDuplicates && (
                    <span className="text-[9px] text-slate-400 flex items-center gap-1 font-bold animate-pulse">
                      <RefreshCw className="w-3 h-3 animate-spin" /> Đang quét lịch trùng...
                    </span>
                  )}
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-450 font-black text-[9px] uppercase tracking-wider sticky top-0 z-10">
                      <tr>
                        <th className="p-2 text-center w-8">Chọn</th>
                        <th className="p-2 text-center w-8">STT</th>
                        <th className="p-2">Khách hàng / Spa</th>
                        <th className="p-2">SĐT</th>
                        <th className="p-2">Bắt đầu</th>
                        <th className="p-2">Kết thúc</th>
                        <th className="p-2 text-center w-16">Dừng (phút)</th>
                        <th className="p-2 text-right pr-3">Kiểm tra</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {previewTimeline.map((item, idx) => {
                        const cust = item.customer;
                        const stopDuration = item.duration;
                        const isMissingIdOrCoords = !item.hasCoords;
                        const isMissingPhone = !cust.phone;

                        return (
                          <tr
                            key={cust.id || `skipped-${idx}`}
                            className={`hover:bg-slate-50/50 transition-colors ${
                              item.isIgnored ? "opacity-60 bg-slate-50/20" : ""
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={!item.isIgnored && !isMissingIdOrCoords}
                                disabled={isMissingIdOrCoords}
                                onChange={() => handleToggleCustomer(cust.id)}
                                className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer disabled:cursor-not-allowed"
                              />
                            </td>

                            {/* STT */}
                            <td className="p-2 text-center font-bold text-slate-500">{idx + 1}</td>

                            {/* Khách hàng */}
                            <td className="p-2 min-w-[140px]">
                              <div className="font-bold text-slate-900 leading-tight">
                                {cust.name || "Khách hàng ẩn danh"}
                              </div>
                              <div className="text-[10px] text-slate-450 font-semibold truncate max-w-[160px] mt-0.5">
                                🏢 {cust.facility_name || "Chưa cập nhật Spa"}
                              </div>
                              {item.distanceText && !item.isIgnored && (
                                <div className="text-[8px] font-black text-rose-600 bg-rose-50/50 px-1 py-0.5 rounded inline-block mt-0.5">
                                  🚗 +{item.distanceText}
                                </div>
                              )}
                            </td>

                            {/* SĐT */}
                            <td className="p-2">
                              {isMissingPhone ? (
                                <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold border-none text-[8.5px] px-1 py-0.5 rounded shrink-0">
                                  Thiếu SĐT
                                </Badge>
                              ) : (
                                <span className="font-bold text-slate-650 tracking-tight">
                                  {cust.phone}
                                </span>
                              )}
                            </td>

                            {/* Bắt đầu */}
                            <td className="p-2 font-bold text-indigo-700">
                              {item.startsAt ? (
                                item.startsAt.toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              ) : (
                                <span className="text-slate-350">—</span>
                              )}
                            </td>

                            {/* Kết thúc */}
                            <td className="p-2 font-bold text-slate-700">
                              {item.endsAt ? (
                                item.endsAt.toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              ) : (
                                <span className="text-slate-350">—</span>
                              )}
                            </td>

                            {/* Override Dừng */}
                            <td className="p-2 text-center">
                              {!item.isIgnored && !isMissingIdOrCoords ? (
                                <div className="flex items-center justify-center gap-0.5">
                                  <Input
                                    type="number"
                                    min="1"
                                    value={stopDuration}
                                    onChange={(e) =>
                                      handleIndividualDurationChange(
                                        cust.id,
                                        parseInt(e.target.value),
                                      )
                                    }
                                    className="w-10 h-6 text-[10px] font-bold px-0.5 text-center rounded border-slate-200 focus:ring-1 focus:ring-indigo-500"
                                  />
                                </div>
                              ) : (
                                <span className="text-slate-350">—</span>
                              )}
                            </td>

                            {/* Kiểm tra */}
                            <td className="p-2 text-right pr-3 shrink-0">
                              {isMissingIdOrCoords ? (
                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[8.5px] border-none px-1.5 py-0.5 rounded leading-tight shrink-0">
                                  Thiếu vị trí
                                </Badge>
                              ) : item.isIgnored ? (
                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 font-bold text-[8.5px] border-none px-1.5 py-0.5 rounded leading-tight shrink-0">
                                  Bỏ qua
                                </Badge>
                              ) : item.isDuplicate ? (
                                <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[8.5px] border-none px-1.5 py-0.5 rounded leading-tight shrink-0">
                                  Trùng lịch
                                </Badge>
                              ) : (
                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold text-[8.5px] border-none px-1.5 py-0.5 rounded leading-tight shrink-0">
                                  Sẵn sàng
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-slate-100 pt-4 mt-2">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={saving}
                className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 bg-white hover:bg-slate-50 text-slate-700"
              >
                Hủy
              </Button>
              <Button
                onClick={handleSaveSchedule}
                disabled={saving || activeStops.length === 0}
                className="rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-150 text-white font-black text-xs h-10 px-5 shadow-lg shadow-indigo-100 flex items-center gap-1.5"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Đang tạo lịch viếng thăm...
                  </>
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4" /> Lưu tuyến lịch ({activeStops.length} điểm)
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
