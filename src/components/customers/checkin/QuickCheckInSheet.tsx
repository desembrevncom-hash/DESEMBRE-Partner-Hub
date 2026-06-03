/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerClose,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Calendar, ListTodo, Check, Loader2, Compass, X, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistanceMeters, hasValidCoordinates } from "@/lib/geo";
import { useCheckInFlow } from "@/hooks/useCheckInFlow";
import { CheckInFlow } from "./CheckInFlow";
import { toast } from "sonner";

interface QuickCheckInSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
  userRoles: {
    isAdmin: boolean;
    isSubAdmin: boolean;
    isTeleLead: boolean;
    isTelesale: boolean;
    isSale: boolean;
  };
}

export const QuickCheckInSheet: React.FC<QuickCheckInSheetProps> = ({
  open,
  onOpenChange,
  user,
  userRoles,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);

  // States for filters & recommendations
  const [todayApptCustIds, setTodayApptCustIds] = useState<Set<string>>(new Set());
  const [taskCustIds, setTaskCustIds] = useState<Set<string>>(new Set());
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsLocating, setGpsLocating] = useState(false);

  // Initialize the shared check-in flow hook
  const {
    currentGps,
    setCurrentGps,
    gpsLoading,
    checkinNote,
    setCheckinNote,
    checkinPhotos,
    setCheckinPhotos,
    checkinSubmitting,
    showCheckinDialog,
    setShowCheckinDialog,
    handleGetGpsForCheckin,
    handleCheckIn,
    handleResetForm,
  } = useCheckInFlow(user, () => {
    // Check-in success callback
    setSelectedCustomer(null);
    onOpenChange(false);
  });

  // Get current user location silently for sorting if allowed
  const getSilentLocation = () => {
    if (!navigator.geolocation) return;
    setGpsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setGpsLocating(false);
      },
      () => {
        // Fail silently
        setGpsLocating(false);
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );
  };

  // Fetch recommendation data & customers
  useEffect(() => {
    if (!open || !user) return;

    // Fetch GPS coordinates for ordering
    getSilentLocation();

    async function fetchRecommendationAndCustomers() {
      setLoading(true);
      try {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // 1. Fetch Today Appointments
        let apptsQuery = supabase
          .from("calendar_events")
          .select("customer_id")
          .gte("starts_at", startOfToday.toISOString())
          .lte("starts_at", endOfToday.toISOString());

        if (userRoles.isSale) {
          apptsQuery = apptsQuery.eq("assigned_sale_id", user.id);
        }

        const { data: appts } = await apptsQuery;
        const apptIds = new Set(appts?.map((a) => a.customer_id).filter(Boolean) as string[]);
        setTodayApptCustIds(apptIds);

        // 2. Fetch Tasks (check_in/visit/pending)
        const tasksQuery = supabase
          .from("customer_tasks")
          .select("customer_id")
          .eq("assigned_to", user.id)
          .neq("status", "completed")
          .neq("status", "cancelled");

        const { data: tasks } = await tasksQuery;
        const tIds = new Set(tasks?.map((t) => t.customer_id).filter(Boolean) as string[]);
        setTaskCustIds(tIds);

        // 3. Fetch Customers based on User Role (RLS-friendly scoping)
        let customersQuery = supabase
          .from("customers")
          .select(
            "id, name, facility_name, phone, address, city, latitude, longitude, owner_sale_id, owner_tele_id, ownership_status",
          )
          .is("deleted_at", null);

        if (userRoles.isAdmin || userRoles.isSubAdmin) {
          // Admin sees all
        } else if (userRoles.isSale) {
          // Sale sees owned or free pool
          customersQuery = customersQuery.or(
            `owner_sale_id.eq.${user.id},ownership_status.eq.free_pool`,
          );
        } else if (userRoles.isTelesale || userRoles.isTeleLead) {
          // Telesales sees owned
          customersQuery = customersQuery.eq("owner_tele_id", user.id);
        } else {
          // Default fallbacks to prevent RLS bypass
          customersQuery = customersQuery.eq("owner_sale_id", user.id);
        }

        const { data: custs, error: custsError } = await customersQuery;
        if (custsError) throw custsError;

        setCustomers(custs || []);
      } catch (err: any) {
        console.error("Error fetching check-in customers:", err);
        toast.error("Không thể tải danh sách khách hàng.");
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendationAndCustomers();
  }, [open, user, userRoles]);

  // Compute sorting & filtering
  const processedCustomers = useMemo(() => {
    if (!customers || customers.length === 0) return [];

    // Filter by search query
    const filtered = customers.filter((c) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name?.toLowerCase().includes(q) ||
        c.facility_name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q)
      );
    });

    // Map distances & group properties
    const mapped = filtered.map((c) => {
      const hasCoords = hasValidCoordinates(c);
      let distance: number | null = null;
      if (hasCoords && gpsCoords) {
        distance = calculateDistanceMeters(
          gpsCoords.latitude,
          gpsCoords.longitude,
          Number(c.latitude),
          Number(c.longitude),
        );
      }

      // Calculate priority score (Lower score = higher priority)
      let score = 999;
      const isTodayAppt = todayApptCustIds.has(c.id);
      const isPendingTask = taskCustIds.has(c.id);

      if (isTodayAppt) {
        score = 1; // Top priority: Appointment today
      } else if (isPendingTask) {
        score = 2; // Second: Outstanding tasks
      } else if (distance !== null && distance <= 500) {
        score = 3; // Third: Nearby (< 500m)
      } else if (c.owner_sale_id === user?.id || c.owner_tele_id === user?.id) {
        score = 4; // Fourth: Assigned to user
      } else {
        score = 5; // Fifth: Free pool or others
      }

      return {
        ...c,
        distance,
        priorityScore: score,
        isTodayAppt,
        isPendingTask,
      };
    });

    // Sort by priorityScore, then distance, then name
    return mapped.sort((a, b) => {
      if (a.priorityScore !== b.priorityScore) {
        return a.priorityScore - b.priorityScore;
      }
      if (a.distance !== null && b.distance !== null) {
        return a.distance - b.distance;
      }
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return (a.facility_name || a.name || "").localeCompare(b.facility_name || b.name || "");
    });
  }, [customers, searchQuery, gpsCoords, todayApptCustIds, taskCustIds, user]);

  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
  };

  const handleStartCheckIn = () => {
    if (!selectedCustomer) {
      toast.error("Vui lòng chọn một khách hàng.");
      return;
    }
    // Set GPS coords for shared checkin if we already have it from silent fetch
    if (gpsCoords) {
      setCurrentGps({
        latitude: gpsCoords.latitude,
        longitude: gpsCoords.longitude,
        accuracy: 15, // estimated from silent
      });
      setShowCheckinDialog(true);
    } else {
      // Trigger full GPS loading
      handleGetGpsForCheckin();
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh] flex flex-col p-4 bg-slate-50">
          <DrawerHeader className="p-0 mb-4 text-left">
            <DrawerTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Compass className="w-5 h-5 text-indigo-600 animate-pulse" />
              CHỌN KHÁCH HÀNG CHECK-IN NHANH
            </DrawerTitle>
            <DrawerDescription className="text-xs text-slate-500 font-medium">
              Vui lòng chọn cơ sở Spa/Thẩm mỹ viện để bắt đầu quy trình check-in GPS.
            </DrawerDescription>
          </DrawerHeader>

          {/* Search box & GPS Status */}
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:bg-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <Input
                placeholder="Tìm tên Spa, số điện thoại, địa chỉ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 rounded-xl h-11 bg-white border-slate-200 text-xs font-semibold focus-visible:ring-indigo-500 focus-visible:border-indigo-500"
              />
            </div>

            {gpsLocating && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
                <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                Đang xác định vị trí để lọc Spa gần bạn...
              </div>
            )}
          </div>

          {/* Customer list container */}
          <div className="flex-1 overflow-y-auto min-h-[250px] max-h-[45vh] space-y-2 pr-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500 font-bold">Đang quét danh mục Spa...</span>
              </div>
            ) : processedCustomers.length === 0 ? (
              <div className="text-center py-10 bg-white rounded-2xl border border-slate-100 p-4">
                <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Không tìm thấy khách hàng</p>
                <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                  Không tìm thấy dữ liệu phù hợp với bộ lọc hoặc phạm vi phụ trách của bạn.
                </p>
              </div>
            ) : (
              processedCustomers.map((cust) => {
                const isSelected = selectedCustomer?.id === cust.id;
                return (
                  <div
                    key={cust.id}
                    onClick={() => handleSelectCustomer(cust)}
                    className={`flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer bg-white ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-600/10 shadow-sm"
                        : "border-slate-100 hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        <span className="font-extrabold text-slate-900 text-xs truncate leading-snug">
                          {cust.facility_name || cust.name}
                        </span>

                        {/* Badges for priority */}
                        {cust.isTodayAppt && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            <Calendar className="w-2.5 h-2.5" />
                            Lịch hẹn
                          </span>
                        )}
                        {cust.isPendingTask && !cust.isTodayAppt && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            <ListTodo className="w-2.5 h-2.5" />
                            Task cần làm
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-bold truncate">
                        SĐT: {cust.phone || "—"} | {cust.name}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        Đ/C: {cust.address || "—"}
                      </p>

                      {cust.distance !== null && (
                        <p className="text-[9px] text-indigo-600 font-extrabold mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          Khoảng cách: {Math.round(cust.distance)}m
                        </p>
                      )}
                    </div>

                    <div className="shrink-0 flex items-center self-center justify-center">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "border-slate-200"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer actions */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col gap-2">
            {selectedCustomer && (
              <div className="bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-xl text-center text-[11px] font-bold text-indigo-800 flex items-center justify-center gap-1.5">
                <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                Đang chọn:{" "}
                <span className="font-black text-indigo-900 truncate max-w-[240px]">
                  {selectedCustomer.facility_name || selectedCustomer.name}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <DrawerClose asChild>
                <Button
                  variant="outline"
                  className="rounded-xl h-11 text-xs font-black uppercase tracking-wider text-slate-700"
                >
                  Đóng
                </Button>
              </DrawerClose>
              <Button
                disabled={!selectedCustomer || gpsLoading}
                onClick={handleStartCheckIn}
                className="rounded-xl h-11 text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-black text-white"
              >
                {gpsLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Đang tìm GPS...
                  </>
                ) : (
                  "Bắt đầu Check-in"
                )}
              </Button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Shared CheckInFlow Modal popup */}
      <CheckInFlow
        open={showCheckinDialog}
        onOpenChange={setShowCheckinDialog}
        customer={selectedCustomer}
        currentGps={currentGps}
        setCurrentGps={setCurrentGps}
        gpsLoading={gpsLoading}
        checkinNote={checkinNote}
        setCheckinNote={setCheckinNote}
        checkinPhotos={checkinPhotos}
        setCheckinPhotos={setCheckinPhotos}
        checkinSubmitting={checkinSubmitting}
        handleGetGpsForCheckin={handleGetGpsForCheckin}
        handleCheckIn={handleCheckIn}
        handleResetForm={handleResetForm}
      />
    </>
  );
};
