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
  ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  calculateDistanceMeters
} from "@/lib/geo";
import { 
  getRecommendedRoutingByDistance,
  getCustomerChannelLabel,
  getCustomerDistanceLabel,
  getCareModelLabel
} from "@/lib/customerRouting";

export const Route = createFileRoute("/reports/routing")({
  component: RoutingReportPage,
});

function RoutingReportPage() {
  const { isManager } = useAuth();
  const [loading, setLoading] = useState(true);
  const [companyLocation, setCompanyLocation] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isManager) return;
    loadData();
  }, [isManager]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [
        { data: locData },
        { data: custData },
        { data: staffData }
      ] = await Promise.all([
        supabase.from("company_locations").select("*").eq("is_default", true).eq("is_active", true).limit(1).maybeSingle(),
        supabase.from("customers").select("id, name, facility_name, latitude, longitude, customer_distance_type, customer_channel, care_model, owner_sale_id, owner_tele_id").is("deleted_at", null),
        supabase.from("profiles").select("id, display_name")
      ]);

      setCompanyLocation(locData || null);
      setCustomers(custData || []);

      if (staffData) {
        const map: Record<string, string> = {};
        staffData.forEach(s => map[s.id] = s.display_name);
        setStaffMap(map);
      }
    } catch (err) {
      console.error("Error loading routing report:", err);
    } finally {
      setLoading(false);
    }
  };

  const reportData = useMemo(() => {
    let withCoordsCount = 0;
    let withoutCoordsCount = 0;
    let missingSaleCount = 0;
    let missingTeleCount = 0;
    let matchedCount = 0;
    let mismatchedCount = 0;

    const items = customers.map(c => {
      const hasCoords = c.latitude && c.longitude;
      if (hasCoords) withCoordsCount++;
      else withoutCoordsCount++;

      if ((c.customer_distance_type === 'near_company' || c.customer_distance_type === 'same_city') && !c.owner_sale_id) {
        missingSaleCount++;
      }
      if ((c.customer_distance_type === 'province' || c.customer_distance_type === 'far_city') && !c.owner_tele_id) {
        missingTeleCount++;
      }

      let distMeters = 0;
      let routing: any = null;
      let isMatch = false;
      let status = "Thiếu dữ liệu";

      if (hasCoords && companyLocation) {
        distMeters = calculateDistanceMeters(
          Number(c.latitude),
          Number(c.longitude),
          Number(companyLocation.latitude),
          Number(companyLocation.longitude)
        );
        
        routing = getRecommendedRoutingByDistance(distMeters);
        
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
        mismatchedCount++; // Tính là lệch/thiếu nếu ko có tọa độ
      }

      return {
        customer: c,
        hasCoords,
        distanceMeters: distMeters,
        distanceKm: distMeters > 0 ? (distMeters / 1000).toFixed(1) : "-",
        currentRouting: {
          channel: c.customer_channel,
          careModel: c.care_model,
          distanceType: c.customer_distance_type
        },
        suggestedRouting: routing,
        isMatch,
        status
      };
    });

    return {
      items,
      stats: {
        total: customers.length,
        withCoords: withCoordsCount,
        withoutCoords: withoutCoordsCount,
        missingSale: missingSaleCount,
        missingTele: missingTeleCount,
        matched: matchedCount,
        mismatched: mismatchedCount
      }
    };
  }, [customers, companyLocation]);

  if (!isManager) {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không có quyền xem báo cáo này.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">Báo cáo Chất lượng Phân tuyến</h1>
              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mt-1">
                Routing & Territory Intelligence
              </p>
            </div>
          </div>
          {companyLocation && (
            <Badge className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] px-3 py-1.5 shadow-sm flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5" /> Mốc: {companyLocation.name}
            </Badge>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {loading ? (
          <div className="flex justify-center p-20">
            <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          </div>
        ) : !companyLocation ? (
          <Card className="rounded-3xl border-none shadow-sm bg-white p-12 text-center text-amber-600">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <h2 className="text-lg font-black">Chưa thiết lập Văn phòng mặc định</h2>
            <p className="text-sm font-medium mt-2">Cần thiết lập 1 company_location is_default=true để tính toán khoảng cách.</p>
          </Card>
        ) : (
          <>
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
                total={reportData.stats.withCoords}
                icon={UserPlus} 
                color="blue" 
              />
              <KpiCard 
                title="Khách xa chưa có Tele" 
                value={reportData.stats.missingTele} 
                total={reportData.stats.withCoords}
                icon={PhoneCall} 
                color="amber" 
              />
              <KpiCard 
                title="Phân tuyến chuẩn" 
                value={reportData.stats.matched} 
                total={reportData.stats.withCoords}
                icon={CheckCircle2} 
                color="emerald" 
              />
              <KpiCard 
                title="Lệch phân tuyến / Thiếu" 
                value={reportData.stats.mismatched} 
                total={reportData.stats.total}
                icon={AlertTriangle} 
                color="orange" 
              />
            </div>

            {/* TABLE */}
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4">
                <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Chi tiết Phân tuyến Khách hàng</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {reportData.items.map((item, idx) => {
                        const c = item.customer;
                        return (
                          <tr key={c.id || idx} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900 line-clamp-1">{c.facility_name || c.name}</div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.hasCoords ? (
                                <span className="font-black text-indigo-600">{item.distanceKm} km</span>
                              ) : (
                                <span className="text-slate-300 italic font-medium">Chưa có GPS</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1 text-[9px] font-bold text-slate-600">
                                <div>{getCustomerDistanceLabel(item.currentRouting.distanceType)}</div>
                                <div>{getCustomerChannelLabel(item.currentRouting.channel)}</div>
                                <div>{getCareModelLabel(item.currentRouting.careModel)}</div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <ArrowRight className="w-4 h-4 mx-auto text-slate-300" />
                            </td>
                            <td className="px-6 py-4">
                              {item.suggestedRouting ? (
                                <div className="space-y-1 text-[9px] font-bold text-emerald-700 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100/50">
                                  <div>{getCustomerDistanceLabel(item.suggestedRouting.distanceType)}</div>
                                  <div>{getCustomerChannelLabel(item.suggestedRouting.customerChannel)}</div>
                                  <div>{getCareModelLabel(item.suggestedRouting.careModel)}</div>
                                </div>
                              ) : (
                                <span className="text-slate-300 italic">Không thể tính</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="space-y-1 text-[10px]">
                                {c.owner_sale_id ? (
                                  <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[8px] px-1 text-indigo-600 border-indigo-200">Sale</Badge> <span className="font-bold text-slate-700 truncate max-w-[100px] block">{staffMap[c.owner_sale_id] || "ID..."}</span></div>
                                ) : (
                                  <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[8px] px-1 text-slate-400 border-slate-200">Sale</Badge> <span className="text-slate-400 italic">Trống</span></div>
                                )}
                                {c.owner_tele_id ? (
                                  <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[8px] px-1 text-amber-600 border-amber-200">Tele</Badge> <span className="font-bold text-slate-700 truncate max-w-[100px] block">{staffMap[c.owner_tele_id] || "ID..."}</span></div>
                                ) : (
                                  <div className="flex items-center gap-1.5"><Badge variant="outline" className="text-[8px] px-1 text-slate-400 border-slate-200">Tele</Badge> <span className="text-slate-400 italic">Trống</span></div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              {item.status === "Đúng" ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100 shadow-none">Đúng</Badge>
                              ) : item.status === "Lệch phân tuyến" ? (
                                <Badge className="bg-amber-100 text-amber-700 border-none hover:bg-amber-100 shadow-none">Lệch</Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 border-none hover:bg-rose-100 shadow-none">Thiếu</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {reportData.items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium text-sm">
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
    </div>
  );
}

function KpiCard({ title, value, total, icon: Icon, color }: any) {
  const colorClasses: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
  };

  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
       <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
             <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${colorClasses[color]}`}>
                <Icon className="w-6 h-6" />
             </div>
             {total > 0 && (
               <div className="text-[10px] font-black px-2 py-1 rounded-lg text-slate-500 bg-slate-50 border border-slate-100">
                  {percentage}%
               </div>
             )}
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <div className="flex items-baseline gap-1 mt-1">
             <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{value}</h3>
          </div>
       </CardContent>
    </Card>
  );
}
