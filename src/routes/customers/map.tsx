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
  RefreshCw,
  Check,
  ChevronsUpDown
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  VIETNAM_PROVINCES,
  stripAccents,
  findProvinceByName,
} from "@/lib/vietnamProvinces";
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
  hasValidCoordinates,
  calculateDistanceMeters,
  parseGoogleMapsUrlToCoordinates
} from "@/lib/geo";
import { RouteScheduleDialog } from "@/components/customers/RouteScheduleDialog";
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

// Custom L.divIcon helper for default company landmark office
const getOfficeIcon = () => {
  return L.divIcon({
    className: "custom-leaflet-marker-office",
    html: `
      <div class="relative flex items-center justify-center w-9 h-9">
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-20"></span>
        <div class="w-7 h-7 rounded-full bg-rose-600 border-2 border-white shadow-lg flex items-center justify-center text-white ring-4 ring-rose-100">
          <svg class="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
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

  const [cityFilter, setCityFilter] = useState<string>("all");
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState("");

  // States cho tính năng Lập tuyến đi
  const [routeMode, setRouteMode] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [routeOrigin, setRouteOrigin] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [returnToOrigin, setReturnToOrigin] = useState(false);

  // States cho cấu hình mốc mặc định doanh nghiệp
  const [defaultLocation, setDefaultLocation] = useState<any>(null);
  const [loadingLocation, setLoadingLocation] = useState(true);

  // Lấy mốc văn phòng mặc định từ company_locations
  useEffect(() => {
    async function fetchDefaultLocation() {
      try {
        setLoadingLocation(true);
        const { data, error } = await supabase
          .from("company_locations" as any)
          .select("*")
          .eq("is_default", true)
          .eq("is_active", true)
          .limit(1);

        if (error) {
          console.error("Error loading default company location:", error);
        } else if (data && data.length > 0) {
          setDefaultLocation(data[0]);
        } else {
          setDefaultLocation(null);
        }
      } catch (err) {
        console.error("Failed to fetch default company location:", err);
      } finally {
        setLoadingLocation(false);
      }
    }
    fetchDefaultLocation();
  }, []);


  // States cho tính năng Lập tuyến đi nâng cấp (Phase 4 & Phase 5)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [startPointType, setStartPointType] = useState<'office' | 'current' | 'manual'>('office');
  const [routeOriginLabel, setRouteOriginLabel] = useState<string | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [manualLat, setManualLat] = useState<string>("");
  const [manualLng, setManualLng] = useState<string>("");
  const [pasteInput, setPasteInput] = useState<string>("");

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị vị trí GPS.");
      return;
    }

    setGettingLocation(true);
    setGpsAccuracy(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setGpsAccuracy(accuracy);

        const applyGps = () => {
          setRouteOrigin({ latitude, longitude });
          setRouteOriginLabel(`Vị trí hiện tại (Sai số: ${Math.round(accuracy)}m)`);
          setGettingLocation(false);
          toast.success(`Đã nhận vị trí GPS xuất phát! (Sai số: ${Math.round(accuracy)}m)`);
        };

        if (accuracy > 1000) {
          const confirmUse = window.confirm(
            `Vị trí hiện tại có độ chính xác rất thấp (sai số khoảng ${Math.round(accuracy)}m > 1000m). Bạn có chắc chắn muốn dùng tọa độ này để lập tuyến không?`
          );
          if (confirmUse) {
            applyGps();
          } else {
            setGettingLocation(false);
            // Quay về văn phòng mặc định nếu có
            if (defaultLocation?.latitude && defaultLocation?.longitude) {
              handleStartPointTypeChange('office');
            } else {
              setRouteOrigin(null);
              setRouteOriginLabel(null);
            }
          }
        } else {
          applyGps();
        }
      },
      (error) => {
        console.error("GPS fetching error:", error);
        setGettingLocation(false);
        toast.warning("Không thể truy cập định vị vị trí GPS của bạn.");
        // Quay về văn phòng mặc định nếu có
        if (defaultLocation?.latitude && defaultLocation?.longitude) {
          handleStartPointTypeChange('office');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleStartPointTypeChange = (type: 'office' | 'current' | 'manual') => {
    setStartPointType(type);
    setGpsAccuracy(null);

    if (type === 'office') {
      if (defaultLocation && defaultLocation.latitude && defaultLocation.longitude) {
        setRouteOrigin({
          latitude: Number(defaultLocation.latitude),
          longitude: Number(defaultLocation.longitude)
        });
        setRouteOriginLabel(defaultLocation.name);
      } else {
        toast.error("Không có văn phòng mặc định được cấu hình.");
        setRouteOrigin(null);
        setRouteOriginLabel(null);
      }
    } else if (type === 'current') {
      getCurrentLocation();
    } else if (type === 'manual') {
      setRouteOrigin(null);
      setRouteOriginLabel(null);
      setManualLat("");
      setManualLng("");
      setPasteInput("");
    }
  };

  const handlePasteCoordinates = (val: string) => {
    setPasteInput(val);
    if (!val) return;

    const parsed = parseGoogleMapsUrlToCoordinates(val);
    if (parsed) {
      setManualLat(parsed.latitude.toString());
      setManualLng(parsed.longitude.toString());
      setRouteOrigin({
        latitude: parsed.latitude,
        longitude: parsed.longitude
      });
      setRouteOriginLabel(`Tọa độ thủ công: ${parsed.latitude.toFixed(6)}, ${parsed.longitude.toFixed(6)}`);
      toast.success("Đã phân tích tọa độ thành công!");
    } else {
      const parts = val.split(/[\s,]+/);
      if (parts.length === 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setManualLat(lat.toString());
          setManualLng(lng.toString());
          setRouteOrigin({ latitude: lat, longitude: lng });
          setRouteOriginLabel(`Tọa độ thủ công: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        }
      }
    }
  };

  const handleManualCoordsChange = (latStr: string, lngStr: string) => {
    setManualLat(latStr);
    setManualLng(lngStr);

    if (!latStr || !lngStr) {
      setRouteOrigin(null);
      setRouteOriginLabel(null);
      return;
    }

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    if (isNaN(lat) || isNaN(lng)) {
      setRouteOrigin(null);
      setRouteOriginLabel(null);
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setRouteOrigin(null);
      setRouteOriginLabel(null);
      return;
    }

    setRouteOrigin({ latitude: lat, longitude: lng });
    setRouteOriginLabel(`Tọa độ thủ công: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
  };

  // Lấy vị trí GPS xuất phát khi bật chế độ Lập tuyến đi nâng cấp
  useEffect(() => {
    if (routeMode) {
      if (!canRoute) {
        setRouteMode(false);
        return;
      }
      
      if (defaultLocation && defaultLocation.latitude && defaultLocation.longitude) {
        setStartPointType('office');
        setRouteOrigin({
          latitude: Number(defaultLocation.latitude),
          longitude: Number(defaultLocation.longitude)
        });
        setRouteOriginLabel(defaultLocation.name);
      } else {
        setStartPointType('current');
        getCurrentLocation();
        toast.warning("Không tìm thấy văn phòng mặc định. Hệ thống tự động chuyển sang Vị trí hiện tại.");
      }
    } else {
      setRouteOrigin(null);
      setRouteOriginLabel(null);
      setSelectedCustomerIds([]);
      setStartPointType('office');
      setGpsAccuracy(null);
      setManualLat("");
      setManualLng("");
      setPasteInput("");
    }
  }, [routeMode, canRoute, defaultLocation]);

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
            tasks.forEach((t: any) => {
              if (t.customer_id) assignedCustomerIds.add(t.customer_id);
            });
          }
        }

        // Apply strict role-based visibility filter on loaded customers
        const filteredByRole = (data || []).filter((c: any) => {
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

        (c.address || "").toLowerCase().includes(searchLower);

      if (!matchSearch) return false;
      if (cityFilter !== "all" && c.city !== cityFilter) return false;

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
  }, [customers, searchQuery, activeFilter, user, cityFilter]);

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
          {/* LANDMARK OFFICE BANNER */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/30">
            {loadingLocation ? (
              <div className="py-2 flex items-center justify-center">
                <RefreshCw className="h-4 w-4 animate-spin text-slate-400 mr-2" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest animate-pulse">Đang tải mốc định vị...</span>
              </div>
            ) : defaultLocation ? (
              <div className="p-3 bg-rose-50/70 border border-rose-100 rounded-2xl flex items-center gap-2.5 shadow-2xs">
                <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <MapPin className="w-4.5 h-4.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-rose-750 uppercase tracking-wider">Mốc định vị đang dùng</p>
                  <p className="text-xs font-bold text-slate-900 truncate mt-0.5">Mốc: {defaultLocation.name}</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-2xl flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 leading-tight">Chưa cấu hình văn phòng mặc định.</p>
                  <p className="text-[9px] text-amber-600 font-bold uppercase tracking-wide">
                    Hãy cập nhật trong Cấu hình hệ thống.
                  </p>
                </div>
              </div>
            )}
          </div>

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

            <div className="relative w-full z-50">
             <Popover open={cityOpen} onOpenChange={(o) => { setCityOpen(o); if (!o) setCitySearch(""); }}>
               <PopoverTrigger asChild>
                 <button
                   type="button"
                   role="combobox"
                   aria-expanded={cityOpen}
                   className="w-full text-sm h-10 rounded-xl border border-slate-200 bg-slate-50 shadow-inner px-3 flex items-center justify-between gap-2 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                 >
                   <div className="flex items-center gap-2 overflow-hidden">
                     <Map className="w-4 h-4 text-slate-400 shrink-0" />
                     <span className={cityFilter !== "all" ? "text-slate-800 font-medium truncate" : "text-slate-400 truncate"}>
                       {cityFilter === "all" ? "Tất cả tỉnh/thành" : cityFilter}
                     </span>
                   </div>
                   <ChevronsUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                 </button>
               </PopoverTrigger>
               <PopoverContent
                 className="p-0 rounded-2xl shadow-xl border border-slate-100 overflow-hidden"
                 style={{ width: "var(--radix-popover-trigger-width)", zIndex: 9999 }}
                 align="start"
                 sideOffset={4}
               >
                 <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/80">
                   <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                   <input
                     autoFocus
                     value={citySearch}
                     onChange={(e) => setCitySearch(e.target.value)}
                     placeholder="Gõ tìm tỉnh/thành..."
                     className="flex-1 text-sm bg-transparent outline-none placeholder:text-slate-300 text-slate-800"
                   />
                   {citySearch && (
                     <button
                       type="button"
                       onClick={() => setCitySearch("")}
                       className="text-slate-300 hover:text-slate-500 text-xs font-bold"
                     >
                       ✕
                     </button>
                   )}
                 </div>
                 <div className="max-h-52 overflow-y-auto">
                   <button
                     type="button"
                     onClick={() => {
                       setCityFilter("all");
                       setCitySearch("");
                       setCityOpen(false);
                     }}
                     className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                   >
                     <Check
                       className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                         cityFilter === "all" ? "opacity-100 text-slate-900" : "opacity-0"
                       }`}
                     />
                     <span className={`font-medium ${cityFilter === "all" ? "text-slate-900" : "text-slate-600"}`}>
                       Tất cả tỉnh/thành
                     </span>
                   </button>
                   {(() => {
                     const q = stripAccents(citySearch);
                     const matched = VIETNAM_PROVINCES.filter((p) => {
                       if (!q) return true;
                       const alias = findProvinceByName(citySearch);
                       if (alias === p) return true;
                       return stripAccents(p).includes(q);
                     });
                     if (matched.length === 0) {
                       return (
                         <div className="py-4 text-center text-xs text-slate-400 font-semibold">
                           Không tìm thấy.
                         </div>
                       );
                     }
                     return matched.map((province) => (
                       <button
                         key={province}
                         type="button"
                         onClick={() => {
                           setCityFilter(province);
                           setCitySearch("");
                           setCityOpen(false);
                         }}
                         className="w-full text-left flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                       >
                         <Check
                           className={`w-3.5 h-3.5 shrink-0 transition-opacity ${
                             cityFilter === province ? "opacity-100 text-slate-900" : "opacity-0"
                           }`}
                         />
                         <span className={`font-medium ${
                           cityFilter === province ? "text-slate-900" : "text-slate-600"
                         }`}>
                           {province}
                         </span>
                       </button>
                     ));
                   })()}
                 </div>
               </PopoverContent>
             </Popover>
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

              {/* Selector điểm xuất phát (Phase 4) */}
              <div className="space-y-1.5 bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs">
                <label className="text-[10px] font-black text-slate-450 uppercase tracking-wider block">
                  Điểm xuất phát
                </label>
                <select
                  value={startPointType}
                  onChange={(e) => handleStartPointTypeChange(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white h-9 px-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="office" disabled={!defaultLocation}>
                    🏢 {defaultLocation ? defaultLocation.name : "Văn phòng mặc định (chưa có)"}
                  </option>
                  <option value="current">📍 Vị trí hiện tại (GPS)</option>
                  <option value="manual">🌐 Nhập tọa độ thủ công</option>
                </select>

                {startPointType === 'manual' && (
                  <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
                    <Input
                      placeholder="Dán tọa độ / URL Google Maps..."
                      value={pasteInput}
                      onChange={(e) => handlePasteCoordinates(e.target.value)}
                      className="h-8 text-xs rounded-xl border-slate-200"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Latitude"
                        value={manualLat}
                        onChange={(e) => handleManualCoordsChange(e.target.value, manualLng)}
                        className="h-8 text-xs rounded-xl border-slate-200 text-center"
                      />
                      <Input
                        placeholder="Longitude"
                        value={manualLng}
                        onChange={(e) => handleManualCoordsChange(manualLat, e.target.value)}
                        className="h-8 text-xs rounded-xl border-slate-200 text-center"
                      />
                    </div>
                  </div>
                )}

                {startPointType === 'current' && gpsAccuracy !== null && (
                  <div className={`px-2 py-1 rounded-lg text-[9px] font-bold mt-1.5 ${
                    gpsAccuracy > 1000 
                      ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                      : gpsAccuracy > 200 
                        ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                        : 'bg-emerald-50 text-emerald-750'
                  }`}>
                    Sai số GPS: {Math.round(gpsAccuracy)}m
                    {gpsAccuracy > 1000 && " (Rất thấp - Cảnh báo)"}
                    {gpsAccuracy > 200 && gpsAccuracy <= 1000 && " (Trung bình)"}
                  </div>
                )}
              </div>

              {gettingLocation && (
                <div className="p-2.5 bg-slate-100 rounded-xl flex items-center justify-center gap-2 text-[10px] text-slate-500 font-bold">
                  <Compass className="w-4.5 h-4.5 animate-spin text-slate-400" />
                  <span>Đang định vị GPS của bạn...</span>
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
                      <span>Xuất phát từ:</span>
                      <span className="text-slate-900 font-black truncate max-w-[170px]">
                        {routeOrigin ? routeOriginLabel : "Chưa xác định"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tổng số khách đã chọn:</span>
                      <span className="text-slate-900 font-black">{selectedCustomerIds.length} khách</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Tổng khoảng cách ước tính:</span>
                      <span className="text-slate-900 font-black font-mono">
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
            
            {/* Marker văn phòng / mốc mặc định */}
            {defaultLocation && defaultLocation.latitude && defaultLocation.longitude && (
              <Marker
                position={[Number(defaultLocation.latitude), Number(defaultLocation.longitude)]}
                icon={getOfficeIcon()}
              >
                <Popup className="custom-leaflet-popup">
                  <div className="p-1 space-y-2 max-w-[240px]">
                    <div className="border-b border-rose-100 pb-1.5">
                      <div className="flex items-center gap-1">
                        <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-black text-[8px] uppercase">
                          Mốc định vị mặc định
                        </Badge>
                      </div>
                      <h4 className="font-black text-xs text-slate-900 leading-tight mt-1">
                        {defaultLocation.name}
                      </h4>
                      {defaultLocation.code && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">Mã: {defaultLocation.code}</p>
                      )}
                    </div>

                    <div className="space-y-1 text-[9px] text-slate-500 font-bold">
                      {defaultLocation.address && (
                        <p className="line-clamp-2 leading-relaxed">
                          📍 {defaultLocation.address}
                        </p>
                      )}
                      {(defaultLocation.district || defaultLocation.city) && (
                        <p>
                          🏙️ {defaultLocation.district ? `${defaultLocation.district}, ` : ""}{defaultLocation.city || ""}
                        </p>
                      )}
                      <p className="text-[8px] text-slate-400">
                        🌐 Tọa độ: {defaultLocation.latitude}, {defaultLocation.longitude}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[8px] font-black rounded-lg border-slate-200"
                        onClick={() => {
                          const url = `https://www.google.com/maps/search/?api=1&query=${defaultLocation.latitude},${defaultLocation.longitude}`;
                          window.open(url, "_blank");
                        }}
                      >
                        Mở Google Maps
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[8px] font-black rounded-lg bg-rose-600 hover:bg-rose-700 text-white"
                        onClick={() => {
                          const url = `https://www.google.com/maps/dir/?api=1&destination=${defaultLocation.latitude},${defaultLocation.longitude}`;
                          window.open(url, "_blank");
                        }}
                      >
                        Chỉ đường
                      </Button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )}

            {mapCustomers.map(customer => {
              const isTeleSales = customer.customer_channel === "tele_sales";
              const isFilterTeleActive = activeFilter === "tele_sales";
              const isSelected = selectedCustomerIds.includes(customer.id);
              const icon = getMarkerIcon(customer.ownership_status, isTeleSales || isFilterTeleActive, isSelected);
              
              // Tính khoảng cách đến văn phòng mặc định
              let distanceText = "";
              if (defaultLocation && defaultLocation.latitude && defaultLocation.longitude && customer.latitude && customer.longitude) {
                const distMeters = calculateDistanceMeters(
                  Number(customer.latitude),
                  Number(customer.longitude),
                  Number(defaultLocation.latitude),
                  Number(defaultLocation.longitude)
                );
                distanceText = formatDistance(distMeters);
              }

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
                        {distanceText && (
                          <div className="mt-1">
                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md inline-block">
                              📍 Cách {defaultLocation.name}: {distanceText}
                            </span>
                          </div>
                        )}
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
              supabase.from("customers").select("*, orders(id, total, status)").is("deleted_at", null).then(({ data }: any) => {
                if (data) {
                  // Re-apply same role visibility filters
                  const filteredByRole = data.filter((c: any) => {
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

      {/* ROUTE SCHEDULE BATCH DIALOG (Phase 5) */}
      <RouteScheduleDialog
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        orderedCustomers={orderedRouteCustomers}
        routeOrigin={routeOrigin}
        routeOriginLabel={routeOriginLabel}
        currentUser={user}
        isAdminOrSubAdmin={isAdmin || isSubAdmin}
        onSuccess={(succeededIds) => {
          setSelectedCustomerIds(prev => prev.filter(id => !succeededIds.includes(id)));
        }}
      />
    </div>
  );
}
