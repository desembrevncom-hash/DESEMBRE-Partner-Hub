import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStaffName } from "@/lib/customerOwnership";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
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
  UploadCloud
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
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
const getMarkerIcon = (status: string, isTeleSales: boolean) => {
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
  
  return L.divIcon({
    className: "custom-leaflet-marker",
    html: `
      <div class="relative flex items-center justify-center w-8 h-8">
        ${isAtRisk ? `<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60"></span>` : ''}
        <div class="w-6.5 h-6.5 rounded-full ${color} border-2 border-white shadow-lg flex items-center justify-center text-white ring-4 ${ringColor}">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
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
  
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);
  const [focusCustomer, setFocusCustomer] = useState<any | null>(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

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

  // Handle clicking a customer card in the sidebar
  const handleSelectCustomer = (customer: any) => {
    if (customer.latitude && customer.longitude) {
      setFocusCustomer(customer);
    } else {
      // Open preview drawer directly if they have no coordinates so they can pin it
      setPreviewCustomer(customer);
      toast.info(`Khách hàng "${customer.facility_name || customer.name}" chưa có vị trí bản đồ. Hãy ghim vị trí ở bảng điều khiển.`);
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

          {/* LIST ITEMS */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {loading ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Compass className="w-8 h-8 animate-spin text-slate-350" />
                <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Đang tải khách hàng...</p>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl">
                <HelpCircle className="w-8 h-8 text-slate-300" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Không tìm thấy khách hàng nào</p>
              </div>
            ) : (
              <>
                {/* Section title */}
                <div className="text-[10px] font-black text-slate-450 uppercase tracking-widest flex justify-between">
                  <span>DANH SÁCH BẢN ĐỒ</span>
                  <span>{filteredCustomers.length} KẾT QUẢ</span>
                </div>

                {filteredCustomers.map(customer => {
                  const hasCoords = customer.latitude && customer.longitude;
                  return (
                    <Card
                      key={customer.id}
                      onClick={() => handleSelectCustomer(customer)}
                      className={`rounded-2xl border border-slate-100 hover:border-slate-350 shadow-2xs hover:shadow-md transition-all cursor-pointer bg-white group overflow-hidden ${focusCustomer?.id === customer.id ? "ring-2 ring-slate-900 border-transparent bg-slate-50" : ""}`}
                    >
                      <CardContent className="p-4 space-y-2.5">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="text-xs font-black text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                              {customer.facility_name || customer.name}
                            </h4>
                            <p className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{customer.city || "Toàn quốc"}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
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
                          <Badge 
                            variant="outline" 
                            className={`text-[8px] font-bold ${hasCoords ? "bg-indigo-50 border-indigo-150 text-indigo-750" : "bg-rose-50 border-rose-150 text-rose-700 border-dashed"}`}
                          >
                            {hasCoords ? "📍 Đã định vị" : "⚠️ Chưa định vị"}
                          </Badge>

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
              const icon = getMarkerIcon(customer.ownership_status, isTeleSales || isFilterTeleActive);
              
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

                      <div className="flex items-center justify-between pt-1">
                        <Badge className="text-[8px] font-bold bg-slate-100 text-slate-600 border-none uppercase">
                          {customer.ownership_status}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={() => setPreviewCustomer(customer)}
                          className="h-6 text-[8px] font-black bg-slate-900 hover:bg-black text-white px-2.5 rounded-md"
                        >
                          Chăm sóc
                        </Button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

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
    </div>
  );
}
