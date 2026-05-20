import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  AlertTriangle, 
  MapPin, 
  UserPlus, 
  PhoneCall, 
  ChevronRight,
  ShieldAlert
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";

export function RoutingAlertsWidget() {
  const { isManager } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [missingSale, setMissingSale] = useState<any[]>([]);
  const [missingTele, setMissingTele] = useState<any[]>([]);
  const [missingGeo, setMissingGeo] = useState<any[]>([]);

  useEffect(() => {
    if (!isManager) return;

    const fetchAlerts = async () => {
      setLoading(true);
      try {
        // Query 1: Khách gần cần gán Sale (near_company / same_city) mà chưa có owner_sale_id
        const { data: saleData } = await supabase
          .from("customers")
          .select("id, name, facility_name, customer_distance_type")
          .is("deleted_at", null)
          .is("owner_sale_id", null)
          .in("customer_distance_type", ["near_company", "same_city"])
          .limit(10);
          
        // Query 2: Khách xa cần gán Trưởng Tele (province / far_city) mà chưa có owner_tele_id
        const { data: teleData } = await supabase
          .from("customers")
          .select("id, name, facility_name, customer_distance_type")
          .is("deleted_at", null)
          .is("owner_tele_id", null)
          .in("customer_distance_type", ["province", "far_city"])
          .limit(10);
          
        // Query 3: Khách chưa có latitude/longitude
        const { data: geoData } = await supabase
          .from("customers")
          .select("id, name, facility_name")
          .is("deleted_at", null)
          .or("latitude.is.null,longitude.is.null")
          .limit(10);

        setMissingSale(saleData || []);
        setMissingTele(teleData || []);
        setMissingGeo(geoData || []);
      } catch (err) {
        console.error("Error fetching routing alerts:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [isManager]);

  if (!isManager) return null;

  const totalAlerts = missingSale.length + missingTele.length + missingGeo.length;

  if (loading) {
    return (
      <Card className="rounded-[40px] border-none shadow-sm bg-white p-8 animate-pulse">
        <div className="h-6 w-1/3 bg-slate-200 rounded-lg mb-6"></div>
        <div className="space-y-4">
          <div className="h-16 w-full bg-slate-100 rounded-2xl"></div>
          <div className="h-16 w-full bg-slate-100 rounded-2xl"></div>
        </div>
      </Card>
    );
  }

  if (totalAlerts === 0) {
    return null; // Không hiện widget nếu không có cảnh báo nào
  }

  return (
    <Card className="rounded-[40px] border-none shadow-sm bg-white p-8">
      <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Cảnh báo Phân tuyến</CardTitle>
        </div>
        <Badge className="bg-rose-50 text-rose-600 border-none font-black text-[10px] px-2.5">
          {totalAlerts} Cần xử lý
        </Badge>
      </CardHeader>
      
      <CardContent className="p-0 space-y-4">
        
        {/* Missing Sale */}
        {missingSale.length > 0 && (
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
            <div className="flex items-center gap-2 mb-3">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wider">Khách gần cần gán Sale ({missingSale.length})</h4>
            </div>
            <div className="space-y-2">
              {missingSale.map(c => (
                <Link key={c.id} to={`/customers`} search={{ q: c.name }} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-indigo-50 hover:border-indigo-200 transition-colors group">
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">{c.customer_distance_type === 'near_company' ? 'Gần công ty' : 'Cùng tỉnh/thành'}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Missing Tele */}
        {missingTele.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-100">
            <div className="flex items-center gap-2 mb-3">
              <PhoneCall className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">Khách xa cần gán Trưởng Tele ({missingTele.length})</h4>
            </div>
            <div className="space-y-2">
              {missingTele.map(c => (
                <Link key={c.id} to={`/customers`} search={{ q: c.name }} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-amber-50 hover:border-amber-200 transition-colors group">
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                    <p className="text-[9px] text-slate-400 font-medium mt-0.5">{c.customer_distance_type === 'province' ? 'Ngoại tỉnh' : 'Vùng sâu/xa'}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Missing Geo */}
        {missingGeo.length > 0 && (
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">Cần ghim vị trí ({missingGeo.length})</h4>
            </div>
            <div className="space-y-2">
              {missingGeo.map(c => (
                <Link key={c.id} to={`/customers/map`} search={{}} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-rose-50 hover:border-rose-200 transition-colors group">
                  <div>
                    <p className="text-[11px] font-bold text-slate-800">{c.facility_name || c.name}</p>
                    <p className="text-[9px] text-rose-400 font-medium mt-0.5">Chưa có tọa độ bản đồ</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
