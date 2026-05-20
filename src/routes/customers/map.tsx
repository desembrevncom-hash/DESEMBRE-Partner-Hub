import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStaffName } from "@/lib/customerOwnership";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { RoutingReviewDialog } from "@/components/customers/RoutingReviewDialog";
import { 
  MapPin, 
  Search, 
  Filter, 
  Compass, 
  User, 
  Layers, 
  Phone, 
  Navigation, 
  AlertCircle, 
  CheckCircle2, 
  HelpCircle,
  Maximize2,
  ListFilter,
  Grid,
  Download,
  Map,
  PlusCircle,
  UploadCloud,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { 
  optimizeRouteByNearestNeighbor, 
  buildGoogleMapsRouteUrl, 
  getRouteDistanceEstimate, 
  formatDistance, 
  hasValidCoordinates 
} from "@/lib/geo";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

export const Route = createFileRoute("/customers/map")({
  component: CustomerMapPage,
});

// Custom L.divIcon helper based on ownership status and channel
const getMarkerIcon = (status: string, isTeleSales: boolean, isSelected: boolean = false) => {
  let color = "bg-blue-600";
  let ringColor = "ring-blue-100";
  
  if (isTeleSales) {
    color = "bg-purple-600";
    ringColor = "ring-purple-100";
  } else {
    switch (status) {
      case "at_risk":
        color = "bg-amber-500";
        ringColor = "ring-amber-100";
        break;
      case "reclaimable":
        color = "bg-rose-600";
        ringColor = "ring-rose-100";
        break;
      case "free_pool":
        color = "bg-emerald-600";
        ringColor = "ring-emerald-100";
        break;
      default:
        color = "bg-blue-600";
        ringColor = "ring-blue-100";
        break;
    }
  }

  const isAtRisk = status === "at_risk";
  const sizeClasses = isSelected ? "w-10 h-10 scale-125 z-[100]" : "w-8 h-8";
  const innerSizeClasses = isSelected ? "w-8.5 h-8.5 border-3 border-indigo-200" : "w-6.5 h-6.5 border-2 border-white";
  const selectedRing = isSelected ? "ring-indigo-400 ring-4 ring-offset-1" : `ring-4 ${ringColor}`;
  
  return L.divIcon({
    className: `custom-leaflet-marker ${isSelected ? 'z-[1000]' : ''}`,
    html: `
      <div class="relative flex items-center justify-center ${sizeClasses}">
        ${isAtRisk ? `<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60"></span>` : ''}
        ${isSelected ? `<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-50"></span>` : ''}
        <div class="${innerSizeClasses} rounded-full ${color} shadow-lg flex items-center justify-center text-white ${selectedRing}">
          <svg class="${isSelected ? 'w-4 h-4' : 'w-3.5 h-3.5'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: isSelected ? [40, 40] : [32, 32],
    iconAnchor: isSelected ? [20, 40] : [16, 32],
    popupAnchor: [0, isSelected ? -40 : -32],
  });
};

// Icon for start point (origin)
const getStartIcon = () => {
  return L.divIcon({
    className: "custom-leaflet-marker-start",
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-900 opacity-30"></span>
        <div class="w-6.5 h-6.5 rounded-full bg-slate-900 border-2 border-white shadow-lg flex items-center justify-center text-white ring-4 ring-slate-100">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

// Map controller to fit bounds
function MapController({ customers, selectedCustomer }: { customers: any[]; selectedCustomer: any | null }) {
  const map = useMap();
  
  // Center on selected customer
  useEffect(() => {
    if (selectedCustomer && selectedCustomer.latitude && selectedCustomer.longitude) {
      map.setView([Number(selectedCustomer.latitude), Number(selectedCustomer.longitude)], 15, {
        animate: true,
        duration: 1.5
      });
    }
  }, [selectedCustomer, map]);

  // Fit bounds when all customers load
  useEffect(() => {
    if (customers.length === 0) return;
    
    const validCoords = customers
      .filter(c => c.latitude && c.longitude)
      .map(c => [Number(c.latitude), Number(c.longitude)] as [number, number]);
      
    if (validCoords.length > 0) {
      const bounds = L.latLngBounds(validCoords);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
  }, [customers, map]);
  
  return null;
}

function CustomerMapPage() {
  const { user, isAdmin, isSubAdmin, isTeleLead, isTelesale, isSale } = useAuth();
  const isManager = isAdmin || isSubAdmin;
  const canRoute = isSale || isAdmin || isSubAdmin;
  
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);
  const [focusCustomer, setFocusCustomer] = useState<any | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // States cho tính năng Lập tuyến đi
  const [routeMode, setRouteMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [routeOrigin, setRouteOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [returnToOrigin, setReturnToOrigin] = useState(false);

  // States cho tính năng Lên lịch viếng thăm hàng loạt (Phase 4)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("08:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [bufferMinutes, setBufferMinutes] = useState(15);
  const [generalNote, setGeneralNote] = useState("");

  // Lấy vị trí GPS xuất phát khi bật chế độ Lập tuyến đi
  useEffect(() => {
    if (routeMode) {
      if (!canRoute) {
        setRouteMode(false);
        return;
      }
      if (navigator.geolocation) {
        setGettingLocation(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setRouteOrigin({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            });
            setGettingLocation(false);
            toast.success("Đã xác định vị trí GPS xuất phát!");
          },
          (error) => {
            console.error("GPS error:", error);
            setGettingLocation(false);
            toast.warning("Chưa có vị trí xuất phát. Tuyến đường sẽ được vẽ theo thứ tự chọn.");
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        toast.warning("Trình duyệt không hỗ trợ định vị vị trí.");
      }
    } else {
      setRouteOrigin(null);
      setSelectedCustomerIds([]);
    }
  }, [routeMode, canRoute]);

  // Lấy các khách hàng được chọn
  const selectedCustomers = useMemo(() => {
    return customers.filter(c => selectedCustomerIds.includes(c.id));
  }, [customers, selectedCustomerIds]);

  // Sắp xếp danh sách khách hàng được chọn theo láng giềng gần nhất nếu có origin
  const orderedRouteCustomers = useMemo(() => {
    if (routeOrigin) {
      return optimizeRouteByNearestNeighbor(routeOrigin, selectedCustomers);
    }
    return selectedCustomers.filter(c => hasValidCoordinates(c));
  }, [routeOrigin, selectedCustomers]);

  // Tính tổng quãng đường tuyến đường
  const routeDistance = useMemo(() => {
    if (!routeOrigin) return 0;
    return getRouteDistanceEstimate(routeOrigin, orderedRouteCustomers);
  }, [routeOrigin, orderedRouteCustomers]);

  const parsedVisitDate = visitDate || new Date().toISOString().split('T')[0];
  const parsedStartTime = startTime || "08:00";
  const parsedDuration = Number(durationMinutes) || 60;
  const parsedBuffer = Number(bufferMinutes) || 15;

  const previewEvents = useMemo(() => {
    const list: any[] = [];
    if (orderedRouteCustomers.length === 0) return list;

    let currentPointer = new Date(`${parsedVisitDate}T${parsedStartTime}:00`);
    if (isNaN(currentPointer.getTime())) {
      currentPointer = new Date();
    }

    orderedRouteCustomers.forEach((customer, index) => {
      const startsAt = new Date(currentPointer.getTime());
      const endsAt = new Date(currentPointer.getTime() + parsedDuration * 60 * 1000);
      list.push({
        customer,
        startsAt,
        endsAt,
        title: `Viếng thăm ${customer.facility_name || customer.name}`
      });
      // Advance pointer
      currentPointer = new Date(endsAt.getTime() + parsedBuffer * 60 * 1000);
    });

    return list;
  }, [orderedRouteCustomers, parsedVisitDate, parsedStartTime, parsedDuration, parsedBuffer]);

  const handleSaveSchedule = async () => {
    if (previewEvents.length === 0 || !user) return;
    setSavingSchedule(true);
    try {
      // Loop over events and insert to database
      for (const ev of previewEvents) {
        const { customer, startsAt, endsAt, title } = ev;

        // 1. Insert calendar event
        const { data: eventData, error: eventError } = await supabase
          .from("calendar_events")
          .insert({
            customer_id: customer.id,
            title: title,
            event_type: 'direct_visit',
            status: 'pending',
            starts_at: startsAt.toISOString(),
            ends_at: endsAt.toISOString(),
            assigned_sale_id: isSale ? user.id : (customer.owner_sale_id || null),
            created_by: user.id,
            description: generalNote || null
          })
          .select()
          .single();

        if (eventError) throw eventError;

        // 2. Insert customer task
        const { data: taskData, error: taskError } = await supabase
          .from("customer_tasks")
          .insert({
            customer_id: customer.id,
            assigned_to: customer.owner_sale_id || user.id,
            assigned_by: user.id,
            task_type: 'direct_visit',
            status: 'pending',
            due_at: startsAt.toISOString(),
            title: title,
            note: generalNote || null
          })
          .select()
          .single();

        if (taskError) throw taskError;

        // 3. Insert customer activity
        const { error: activityError } = await supabase
          .from("customer_activities")
          .insert({
            customer_id: customer.id,
            created_by: user.id,
            activity_type: 'follow_up',
            title: 'Đã lên lịch viếng thăm theo tuyến',
            content: `Lịch hẹn lúc: ${startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - ${endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}, ngày ${startsAt.toLocaleDateString('vi-VN')}. Ghi chú: ${generalNote || 'Không có'}`
          });

        if (activityError) throw activityError;
      }

      toast.success(`Đã tạo lịch viếng thăm cho ${previewEvents.length} khách!`);
      
      // Ask user to clear route
      const clearRoute = window.confirm("Bạn có muốn xóa danh sách khách đã chọn trong tuyến không?");
      if (clearRoute) {
        setSelectedCustomerIds([]);
      }
      setIsScheduleModalOpen(false);
      
      // Reset form
      setGeneralNote("");
    } catch (err: any) {
      console.error("Save schedule error:", err);
      toast.error("Lỗi khi lưu lịch viếng thăm: " + err.message);
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleExportGoogleMyMapsCSV = () => {
    if (mapCustomers.length === 0) {
      toast.error("Không có khách hàng nào có tọa độ để xuất!");
      return;
    }

    try {
      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return "";
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      const csvHeaders = [
        "ID",
        "Name",
        "Facility_Name",
        "Phone",
        "Address",
        "Latitude",
        "Longitude",
        "Owner_Name",
        "Ownership_Status",
        "Customer_Channel",
        "Care_Model",
        "Total_Order_Amount",
        "CRM_Link"
      ].join(",");

      const csvRows = mapCustomers.map(c => {
        const ownerName = getStaffName(c.owner_sale_id) || getStaffName(c.owner_tele_id) || "Chưa phân công";
        const crmLink = `${window.location.origin}/customers/${c.id}`;
        
        const totalOrderAmount = c.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
        
        return [
          escapeCSV(c.id),
          escapeCSV(c.name),
          escapeCSV(c.facility_name),
          escapeCSV(c.phone),
          escapeCSV(c.address),
          escapeCSV(c.latitude),
          escapeCSV(c.longitude),
          escapeCSV(ownerName),
          escapeCSV(c.ownership_status),
          escapeCSV(c.customer_channel),
          escapeCSV(c.care_model),
          escapeCSV(totalOrderAmount),
          escapeCSV(crmLink)
        ].join(",");
      });

      const csvContent = "\uFEFF" + [csvHeaders, ...csvRows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `DESEMBRE_MyMaps_Export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsGuideOpen(true);
      toast.success(`Đã xuất thành công ${mapCustomers.length} khách hàng!`);
    } catch (err: any) {
      console.error("Export My Maps CSV error:", err);
      toast.error("Lỗi xuất CSV: " + err.message);
    }
  };

  // Load customers
  useEffect(() => {
    async function fetchCustomers() {
      setLoading(true);
      try {
        // Query active customers with orders
        let query = supabase.from("customers").select("*, orders(id, total, status)").is("deleted_at", null);
        
        const { data, error } = await query;
        if (error) throw error;
        
        // Load assigned tasks to evaluate visibility for Telesales
        let assignedCustomerIds = new Set<string>();
        if (isTelesale && user) {
          const { data: tasks } = await supabase
            .from("customer_tasks")
            .select("customer_id")
            .eq("assigned_to", user.id);
          if (tasks) {
            tasks.forEach(t => {
              if (t.customer_id) assignedCustomerIds.add(t.customer_id);
            });
          }
        }

        // Apply strict role-based visibility filter on loaded customers
        const filteredByRole = (data || []).filter(c => {
          if (isManager) return true; // Admin/Sub Admin see all
          if (isTeleLead && user) return c.owner_tele_id === user.id; // Tele Lead see their tele queue
          if (isSale && user) {
            return c.owner_sale_id === user.id || c.ownership_status === 'free_pool';
          }
          if (isTelesale && user) {
            return c.owner_tele_id === user.id || assignedCustomerIds.has(c.id);
          }
          return false;
        });

        setCustomers(filteredByRole);
      } catch (err: any) {
        console.error("fetchCustomers error:", err);
        toast.error("Lỗi tải danh sách khách hàng: " + err.message);
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      fetchCustomers();
    }
  }, [user, isManager, isTeleLead, isSale, isTelesale]);

  // Compute filtered customers based on selected filter and search query
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // 1. Search Query
      const searchLower = searchQuery.toLowerCase();
      const matchSearch = 
        (c.facility_name || "").toLowerCase().includes(searchLower) ||
        (c.name || "").toLowerCase().includes(searchLower) ||
        (c.phone || "").toLowerCase().includes(searchLower) ||
        (c.address || "").toLowerCase().includes(searchLower);

      if (!matchSearch) return false;

      // 2. Active Filter
      switch (activeFilter) {
        case "my_customers":
          return c.owner_sale_id === user?.id || c.owner_tele_id === user?.id;
        case "free_pool":
          return c.ownership_status === "free_pool";
        case "at_risk":
          return c.ownership_status === "at_risk";
        case "reclaimable":
          return c.ownership_status === "reclaimable";
        case "direct_sales":
          return c.customer_channel === "direct_sales";
        case "tele_sales":
          return c.customer_channel === "tele_sales";
        case "route_priority":
          const isDirect = c.customer_channel === "direct_sales";
          const isNear = c.customer_distance_type === "near_company" || c.customer_distance_type === "same_city";
          const isMine = isSale && user ? c.owner_sale_id === user.id : true;
          return isDirect && isNear && isMine;
        case "no_geo":
          return !c.latitude || !c.longitude;
        default:
          return true;
      }
    });
  }, [customers, searchQuery, activeFilter, user]);

  // Split filtered customers into geo (has coordinates) and non-geo (lacks coordinates)
  const mapCustomers = useMemo(() => {
    return filteredCustomers.filter(c => c.latitude && c.longitude);
  }, [filteredCustomers]);

  const unlocatedCustomers = useMemo(() => {
    return filteredCustomers.filter(c => !c.latitude || !c.longitude);
  }, [filteredCustomers]);

  // Danh sách hiển thị ở Sidebar (Lập tuyến đưa các điểm tối ưu lên trước)
  const sidebarCustomers = useMemo(() => {
    if (!routeMode) return filteredCustomers;
    const orderedIds = orderedRouteCustomers.map(c => c.id);
    const remaining = filteredCustomers.filter(c => !orderedIds.includes(c.id));
    return [...orderedRouteCustomers, ...remaining];
  }, [routeMode, filteredCustomers, orderedRouteCustomers]);

  // Helper to safely select/deselect a customer for route planning
  const toggleCustomerSelection = (customer: any) => {
    if (!hasValidCoordinates(customer)) {
      toast.error("Khách hàng chưa có tọa độ, hãy ghim vị trí trong chi tiết trước!");
      return;
    }
    setSelectedCustomerIds(prev => {
      if (prev.includes(customer.id)) {
        return prev.filter(id => id !== customer.id);
      } else {
        if (prev.length >= 10) {
          toast.warning("Tối đa 10 khách / một tuyến đường ở giai đoạn này.");
          return prev;
        }
        return [...prev, customer.id];
      }
    });
  };

  // Handle clicking a customer card in the sidebar
  const handleSelectCustomer = (customer: any) => {
    if (routeMode) {
      toggleCustomerSelection(customer);
    } else {
      if (customer.latitude && customer.longitude) {
        setFocusCustomer(customer);
      } else {
        // Open preview drawer directly if they have no coordinates so they can pin it
        setPreviewCustomer(customer);
        toast.info(`Khách hàng "${customer.facility_name || customer.name}" chưa có vị trí bản đồ. Hãy ghim vị trí ở bảng điều khiển.`);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "at_risk":
        return <Badge className="bg-amber-100 text-amber-700 border-none font-bold text-[9px] uppercase">At Risk</Badge>;
      case "reclaimable":
        return <Badge className="bg-rose-100 text-rose-700 border-none font-bold text-[9px] uppercase">Reclaimable</Badge>;
      case "free_pool":
        return <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px] uppercase">Tự do</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-none font-bold text-[9px] uppercase">Assigned</Badge>;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc] font-sans antialiased overflow-hidden">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white shadow-md">
            <Compass className="w-5.5 h-5.5 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-md font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              Bản đồ Khách hàng
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Định vị hoạt động & check-in spa thực địa
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold px-2.5 py-1">
            Đang lọc: {filteredCustomers.length} / {customers.length} KH
          </Badge>
          {canRoute && (
            <Button
              variant={routeMode ? "default" : "outline"}
              onClick={() => {
                const newMode = !routeMode;
                setRouteMode(newMode);
                if (newMode) setActiveFilter("route_priority");
                else setActiveFilter("all");
              }}
              className={`rounded-xl font-black text-[10px] uppercase h-10 px-4 shadow-sm transition-all flex items-center gap-1.5 ${
                routeMode 
                  ? "bg-indigo-650 hover:bg-indigo-700 text-white border-transparent" 
                  : "border-slate-200 bg-white hover:bg-slate-50 text-slate-800"
              }`}
            >
              <Navigation className="w-4 h-4" /> {routeMode ? "Tắt Lập tuyến" : "Lập tuyến đi"}
            </Button>
          )}
          {isManager && (
            <Button
              variant="outline"
              onClick={() => setIsReviewModalOpen(true)}
              className="rounded-xl border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-black text-[10px] uppercase h-10 px-4 shadow-sm transition-all flex items-center gap-1.5"
            >
              <RefreshCw className="w-4 h-4" /> Rà soát tuyến
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleExportGoogleMyMapsCSV}
            className="rounded-xl border-slate-200 font-black text-[10px] uppercase h-10 px-4 shadow-sm bg-white hover:bg-slate-50 transition-all flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-550" /> Export My Maps CSV
          </Button>
        </div>
      </header>

      {/* WORKSPACE CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* SIDEBAR */}
        <aside className="w-80 sm:w-96 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20 shadow-lg">
          {/* SEARCH & FILTERS */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Tìm Spa, chủ spa, SĐT, địa chỉ..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 bg-slate-50 shadow-inner focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* QUICK FILTERS LIST */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <ListFilter className="w-3.5 h-3.5 text-slate-400" /> Bộ lọc vị trí & trạng thái
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Button
                  variant={activeFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("all")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  🌐 Tất cả ({customers.length})
                </Button>
                <Button
                  variant={activeFilter === "my_customers" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("my_customers")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  👤 Khách của tôi ({customers.filter(c => c.owner_sale_id === user?.id || c.owner_tele_id === user?.id).length})
                </Button>
                <Button
                  variant={activeFilter === "free_pool" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("free_pool")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  🟢 Khách tự do ({customers.filter(c => c.ownership_status === "free_pool").length})
                </Button>
                <Button
                  variant={activeFilter === "at_risk" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("at_risk")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  🟡 At Risk ({customers.filter(c => c.ownership_status === "at_risk").length})
                </Button>
                <Button
                  variant={activeFilter === "reclaimable" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("reclaimable")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  🔴 Cần thu hồi ({customers.filter(c => c.ownership_status === "reclaimable").length})
                </Button>
                <Button
                  variant={activeFilter === "direct_sales" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("direct_sales")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5"
                >
                  🔵 Sale trực tiếp ({customers.filter(c => c.customer_channel === "direct_sales").length})
                </Button>
                <Button
                  variant={activeFilter === "tele_sales" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("tele_sales")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5 col-span-2"
                >
                  🟣 Tuyến Tele/Online ({customers.filter(c => c.customer_channel === "tele_sales").length})
                </Button>
                {canRoute && (
                  <Button
                    variant={activeFilter === "route_priority" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveFilter("route_priority")}
                    className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5 col-span-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                  >
                    🔥 Ưu tiên đi tuyến ({customers.filter(c => c.customer_channel === "direct_sales" && (c.customer_distance_type === "near_company" || c.customer_distance_type === "same_city") && (isSale && user ? c.owner_sale_id === user.id : true)).length})
                  </Button>
                )}
                <Button
                  variant={activeFilter === "no_geo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveFilter("no_geo")}
                  className="rounded-lg text-[10px] font-black h-8 text-left justify-start px-2.5 col-span-2 border-dashed border-rose-300 hover:bg-rose-50 text-rose-700"
                >
                  ⚠️ Chưa có tọa độ ({customers.filter(c => !c.latitude || !c.longitude).length})
                </Button>
              </div>
            </div>
          </div>

          {/* ROUTE PLANNING PANEL (Chỉ hiển thị khi bật Lập tuyến) */}
          {routeMode && (
            <div className="p-4 border-b border-slate-200 bg-indigo-50/40 space-y-3 shrink-0">
              <div className="flex justify-between items-center">
                <div className="text-[10px] font-black text-indigo-750 uppercase tracking-widest flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-indigo-600 animate-pulse" /> Lộ trình tối ưu
                </div>
                <Badge className="bg-indigo-650 text-white font-black text-[9px] px-2 py-0.5 rounded-md">
                  Đang chọn {selectedCustomerIds.length} khách
                </Badge>
              </div>

              {!routeOrigin && !gettingLocation && (
                <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2 text-[10px] text-amber-800 font-bold leading-normal">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p>Chưa có vị trí xuất phát.</p>
                    <p className="text-[9px] text-amber-600 font-medium mt-0.5">Tuyến đường sẽ được vẽ theo thứ tự chọn thay vì khoảng cách tối ưu.</p>
                  </div>
                </div>
              )}

              {gettingLocation && (
                <div className="p-2.5 bg-slate-100 rounded-xl flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Compass className="w-4.5 h-4.5 animate-spin text-slate-400" />
                  <span>Đang định vị GPS của bạn...</span>
                </div>
              )}

              {routeOrigin && (
                <div className="p-2.5 bg-indigo-100/50 border border-indigo-100 rounded-xl flex items-start gap-2 text-[10px] text-indigo-900 font-bold leading-normal">
                  <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-indigo-600 mt-0.5" />
                  <div>
                    <p>Đã nhận vị trí của bạn.</p>
                    <p className="text-[9px] text-indigo-600 font-medium mt-0.5">
                      Thứ tự tuyến đường được sắp xếp tối ưu (Nearest Neighbor).
                    </p>
                  </div>
                </div>
              )}

              {selectedCustomerIds.length > 10 && (
                <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-[10px] text-rose-800 font-bold leading-normal">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-black text-rose-900">Giới hạn số điểm dừng</p>
                    <p className="text-[9px] text-rose-600 font-medium mt-0.5">
                      Google Maps chỉ phù hợp với số điểm giới hạn. Hệ thống sẽ mở 10 điểm đầu tiên.
                    </p>
                  </div>
                </div>
              )}

              {selectedCustomerIds.length > 0 && (
                <div className="space-y-3">
                  <div className="space-y-1.5 text-[10px] font-bold text-slate-500 px-1 pt-1">
                    <div className="flex justify-between items-center">
                      <span>Tổng số khách đã chọn:</span>
                      <span className="text-slate-900 font-black">{selectedCustomerIds.length} khách</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tổng khoảng cách ước tính:</span>
                      <span className="text-slate-900 font-black">
                        {routeOrigin ? formatDistance(routeDistance) : "Chưa xác định"}
                      </span>
                    </div>
                  </div>

                  {/* Option khứ hồi */}
                  {routeOrigin && (
                    <div className="flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        id="returnToOriginCheck"
                        checked={returnToOrigin}
                        onChange={(e) => setReturnToOrigin(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-650 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <label htmlFor="returnToOriginCheck" className="text-[9px] text-slate-500 font-black uppercase tracking-wider cursor-pointer select-none">
                        Quay lại điểm xuất phát (Khứ hồi)
                      </label>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Button
                      onClick={() => {
                        if (!routeOrigin) return;
                        const url = buildGoogleMapsRouteUrl(
                          routeOrigin,
                          orderedRouteCustomers,
                          { returnToOrigin }
                        );
                        if (url) window.open(url, "_blank");
                        else toast.error("Không thể tạo liên kết chỉ đường.");
                      }}
                      disabled={!routeOrigin}
                      className="w-full rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white font-black text-[10px] uppercase h-10 px-4 flex items-center justify-center gap-1.5 shadow-md transition-all disabled:cursor-not-allowed"
                    >
                      <Navigation className="w-4 h-4" /> Mở Google Maps
                    </Button>

                    <Button
                      onClick={() => setIsScheduleModalOpen(true)}
                      variant="outline"
                      className="w-full rounded-xl border-indigo-200 bg-white hover:bg-indigo-50 text-indigo-750 font-black text-[10px] uppercase h-10 px-4 flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <PlusCircle className="w-4 h-4" /> Lên lịch viếng thăm
                    </Button>
                    
                    {!routeOrigin && (
                      <p className="text-[9.5px] text-amber-700 font-bold text-center mt-1 leading-normal">
                        ⚠️ Yêu cầu lấy vị trí hiện tại để kích hoạt chỉ đường.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedCustomerIds.length === 0 && (
                <div className="p-3 bg-white border border-dashed border-indigo-150 rounded-xl text-center text-[10px] text-slate-400 font-bold">
                  Bật checkbox hoặc nhấp marker để thêm khách vào tuyến đi.
                </div>
              )}
            </div>
          )}

          {/* LIST ITEMS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Compass className="w-8 h-8 animate-spin text-slate-350" />
                <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Đang tải khách hàng...</p>
              </div>
            ) : sidebarCustomers.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
                <HelpCircle className="w-8 h-8 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Không tìm thấy khách hàng nào</p>
              </div>
            ) : (
              <>
                {/* Section title */}
                <div className="text-[10px] font-black text-slate-450 uppercase tracking-widest flex justify-between">
                  <span>{routeMode ? "TUYẾN ĐƯỜNG ĐỀ XUẤT" : "DANH SÁCH BẢN ĐỒ"}</span>
                  <span>{sidebarCustomers.length} KẾT QUẢ</span>
                </div>

                {sidebarCustomers.map(customer => {
                  const hasCoords = customer.latitude && customer.longitude;
                  const routeIndex = orderedRouteCustomers.findIndex(c => c.id === customer.id);
                  const isSelectedInRoute = routeIndex !== -1;

                  return (
                    <Card
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className={`rounded-2xl border border-slate-100 hover:border-slate-350 shadow-2xs hover:shadow-md transition-all cursor-pointer bg-white group overflow-hidden ${
                        isSelectedInRoute 
                          ? "ring-2 ring-indigo-650 border-transparent bg-indigo-50/20" 
                          : focusCustomer?.id === customer.id 
                            ? "ring-2 ring-slate-900 border-transparent bg-slate-50" 
                            : ""
                      } ${routeMode && !hasCoords ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <CardContent className="p-4 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex items-start gap-2.5">
                            {routeMode && (
                              <input
                                type="checkbox"
                                checked={isSelectedInRoute}
                                disabled={!hasCoords}
                                onChange={() => handleSelectCustomer(customer)}
                                onClick={e => e.stopPropagation()}
                                className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 shrink-0 transition-all cursor-pointer disabled:cursor-not-allowed"
                              />
                            )}
                            <div>
                              <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                                {customer.facility_name || customer.name}
                              </h4>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{customer.city || "Toàn quốc"}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {getStatusBadge(customer.ownership_status)}
                          </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-1 text-[10px] text-slate-500 font-bold">
                          <p className="flex items-center gap-1"><User className="w-3.5 h-3.5 text-slate-400" /> {customer.contact_name || customer.name}</p>
                          {customer.phone && <p className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" /> {customer.phone}</p>}
                          {customer.address && <p className="line-clamp-2 leading-relaxed"><MapPin className="w-3.5 h-3.5 inline text-slate-400 mr-0.5" /> {customer.address}</p>}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                          <div className="flex gap-1.5">
                            <Badge 
                              variant="outline" 
                              className={`text-[8px] font-bold ${hasCoords ? "bg-indigo-50 border-indigo-150 text-indigo-750" : "bg-rose-50 border-rose-150 text-rose-700 border-dashed"}`}
                            >
                              {hasCoords ? "📍 Đã định vị" : "⚠️ Chưa có tọa độ — hãy ghim vị trí trước"}
                            </Badge>
                            {routeMode && isSelectedInRoute && (
                              <Badge className="bg-indigo-600 text-white border-none font-bold text-[8px] uppercase">
                                Chặng {routeIndex + 1}
                              </Badge>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewCustomer(customer);
                            }}
                            className="h-6 text-[9px] font-black text-indigo-650 hover:bg-indigo-50 px-2 rounded-md"
                          >
                            XEM CHI TIẾT →
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        {/* MAP PANEL */}
        <main className="flex-1 h-full relative z-10">
          <MapContainer
            center={[16.047079, 108.206230]}
            zoom={6}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CartoDB</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />
            
            {mapCustomers.map(customer => {
              const isTeleSales = customer.customer_channel === "tele_sales";
              const isFilterTeleActive = activeFilter === "tele_sales";
              const isSelected = selectedCustomerIds.includes(customer.id);
              const icon = getMarkerIcon(customer.ownership_status, isTeleSales || isFilterTeleActive, isSelected);
              
              return (
                <Marker
                  key={customer.id}
                  position={[Number(customer.latitude), Number(customer.longitude)]}
                  icon={icon}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="p-1 space-y-2">
                      <div className="border-b border-slate-100 pb-1.5">
                        <h4 className="font-black text-xs text-slate-900 leading-tight">
                          {customer.facility_name || customer.name}
                        </h4>
                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{customer.city || "Toàn quốc"}</p>
                      </div>

                      <div className="space-y-1 text-[9px] text-slate-500 font-bold">
                        <p>👤 {customer.contact_name || customer.name}</p>
                        {customer.phone && <p>📞 {customer.phone}</p>}
                        {customer.address && <p className="line-clamp-2 leading-relaxed">📍 {customer.address}</p>}
                      </div>

                      <div className="flex items-center justify-between pt-1 gap-1.5">
                        <Badge className="text-[8px] font-bold bg-slate-100 text-slate-600 border-none uppercase shrink-0">
                          {customer.ownership_status}
                        </Badge>
                        <div className="flex gap-1">
                          {routeMode && (
                            <Button
                              size="sm"
                              variant={isSelected ? "destructive" : "default"}
                              onClick={() => toggleCustomerSelection(customer)}
                              className="h-6 text-[8px] font-black px-2 rounded-md"
                            >
                              {isSelected ? "Bỏ tuyến" : "Thêm tuyến"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => setPreviewCustomer(customer)}
                            className="h-6 text-[8px] font-black bg-slate-900 hover:bg-black text-white px-2 rounded-md"
                          >
                            Chăm sóc
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Polyline vẽ tuyến đi */}
            {routeMode && (routeOrigin || orderedRouteCustomers.length > 0) && (
              <Polyline
                positions={
                  routeOrigin
                    ? [
                        [routeOrigin.latitude, routeOrigin.longitude] as [number, number],
                        ...orderedRouteCustomers.map(c => [Number(c.latitude), Number(c.longitude)] as [number, number])
                      ]
                    : orderedRouteCustomers.map(c => [Number(c.latitude), Number(c.longitude)] as [number, number])
                }
                color="#4f46e5"
                weight={4}
                opacity={0.8}
                dashArray="6, 6"
              />
            )}

            {/* Marker vị trí hiện tại của user */}
            {routeMode && routeOrigin && (
              <Marker
                position={[routeOrigin.latitude, routeOrigin.longitude]}
                icon={getStartIcon()}
              >
                <Popup>
                  <div className="p-1.5 font-bold text-xs">Vị trí của bạn (Điểm xuất phát)</div>
                </Popup>
              </Marker>
            )}

            <MapController
              customers={mapCustomers}
              selectedCustomer={focusCustomer}
            />
          </MapContainer>
        </main>
      </div>

      {/* PREVIEW CUSTOMER DRAWER */}
      {previewCustomer && (
        <CustomerPreviewDrawer
          customer={previewCustomer}
          open={!!previewCustomer}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewCustomer(null);
              // Refresh customers in map to get coordinates updates if the user pinned them inside the drawer
              supabase.from("customers").select("*, orders(id, total, status)").is("deleted_at", null).then(({ data }) => {
                if (data) {
                  // Re-apply same role visibility filters
                  const filteredByRole = data.filter(c => {
                    if (isManager) return true;
                    if (isTeleLead && user) return c.owner_tele_id === user.id;
                    if (isSale && user) return c.owner_sale_id === user.id || c.ownership_status === 'free_pool';
                    return false;
                  });
                  setCustomers(filteredByRole);
                }
              });
            }
          }}
          getStaffName={getStaffName}
        />
      )}

      {isManager && (
        <RoutingReviewDialog 
          open={isReviewModalOpen} 
          onOpenChange={setIsReviewModalOpen} 
          user={user} 
        />
      )}

      {/* GOOGLE MY MAPS IMPORT GUIDE DIALOG */}
      <Dialog open={isGuideOpen} onOpenChange={setIsGuideOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 border-slate-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
                <Map className="w-4 h-4" />
              </span>
              Hướng dẫn nhập bản đồ Google My Maps
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              Định vị khách hàng hàng loạt trên bản đồ Google
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              Tệp CSV chứa thông tin tọa độ khách hàng đã được tải xuống thiết bị của bạn. Để hiển thị các điểm này trên Google My Maps, hãy làm theo các bước sau:
            </p>

            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                  1
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Truy cập Google My Maps</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Mở trình duyệt và truy cập trang web <a href="https://mymaps.google.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-bold">Google My Maps</a>.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                  2
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Tạo bản đồ mới</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Nhấp vào nút <span className="font-bold text-slate-800">Tạo bản đồ mới (Create a new map)</span> ở góc trên bên trái.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                  3
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Nhập dữ liệu CSV</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Trong bảng điều khiển bên trái, tại phần lớp chưa có tiêu đề, bấm nút <span className="font-bold text-slate-800">Nhập (Import)</span> và chọn tệp CSV vừa tải xuống.
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                  4
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Chọn cột định vị</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Đánh dấu chọn cột <span className="font-bold text-slate-800">Latitude</span> và <span className="font-bold text-slate-800">Longitude</span> để xác định vị trí các điểm trên bản đồ.
                  </p>
                </div>
              </div>

              {/* Step 5 */}
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs font-black text-slate-700 shrink-0">
                  5
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900">Chọn cột tiêu đề</p>
                  <p className="text-[11px] text-slate-500 leading-relaxed font-semibold">
                    Chọn cột <span className="font-bold text-slate-800">Facility_Name</span> (Tên cơ sở Spa) hoặc <span className="font-bold text-slate-800">Name</span> để làm nhãn hiển thị cho các marker.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-5 shadow-lg shadow-slate-200">
                Đã hiểu & Đóng
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL LÊN LỊCH VIẾNG THĂM HÀNG LOẠT (Phase 4) */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-2xl rounded-3xl p-6 border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-650 flex items-center justify-center">
                <PlusCircle className="w-4 h-4" />
              </span>
              Lên lịch viếng thăm hàng loạt
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
              Tự động tạo sự kiện và đầu việc chăm sóc khách hàng theo chặng tối ưu
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Ngày đi */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày đi thăm</label>
                <Input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                />
              </div>

              {/* Giờ bắt đầu */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giờ xuất phát</label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                />
              </div>

              {/* Thời lượng mỗi điểm */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời lượng mỗi điểm (phút)</label>
                <Input
                  type="number"
                  min="5"
                  step="5"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                  className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                />
              </div>

              {/* Khoảng nghỉ */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian di chuyển/nghỉ (phút)</label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={bufferMinutes}
                  onChange={(e) => setBufferMinutes(Number(e.target.value))}
                  className="rounded-xl border-slate-200 h-10 text-xs font-bold"
                />
              </div>
            </div>

            {/* Ghi chú chung */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ghi chú chung</label>
              <textarea
                placeholder="Nội dung, kế hoạch làm việc, chuẩn bị tài liệu..."
                value={generalNote}
                onChange={(e) => setGeneralNote(e.target.value)}
                className="w-full min-h-[70px] rounded-xl border border-slate-200 p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>

            {/* Preview các chặng dừng */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block">Xem trước lịch trình ({previewEvents.length} chặng)</label>
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50 p-3 space-y-2 max-h-[220px] overflow-y-auto">
                {previewEvents.map((ev, idx) => (
                  <div key={ev.customer.id} className="flex items-start justify-between bg-white border border-slate-100 p-2.5 rounded-xl gap-2 shadow-2xs">
                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-md bg-indigo-50 text-indigo-750 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div>
                        <h5 className="text-[11px] font-bold text-slate-900 leading-normal">
                          {ev.customer.facility_name || ev.customer.name}
                        </h5>
                        <p className="text-[9px] text-slate-455 font-bold">
                          📍 {ev.customer.address || "Chưa cập nhật địa chỉ"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <Badge className="bg-emerald-50 text-emerald-750 hover:bg-emerald-100 border-none font-bold text-[9px]">
                        {ev.startsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {ev.endsAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                      <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wide mt-1">
                        {ev.startsAt.toLocaleDateString('vi-VN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="border-t border-slate-100 pt-4 mt-2 col-span-2">
            <DialogClose asChild>
              <Button variant="outline" className="rounded-xl border-slate-200 font-black text-xs h-10 px-5 bg-white hover:bg-slate-50 text-slate-700">
                Hủy
              </Button>
            </DialogClose>
            <Button
              onClick={handleSaveSchedule}
              disabled={savingSchedule || previewEvents.length === 0}
              className="rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:bg-slate-100 text-white font-black text-xs h-10 px-5 shadow-lg shadow-indigo-100 flex items-center gap-1.5"
            >
              {savingSchedule ? (
                <>
                  <Compass className="w-4 h-4 animate-spin" /> Đang tạo lịch...
                </>
              ) : (
                <>
                  Lưu tuyến lịch ({previewEvents.length} điểm)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
