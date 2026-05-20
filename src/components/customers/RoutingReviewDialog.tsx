import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Map, 
  Building2, 
  Phone,
  CheckSquare,
  AlertCircle
} from "lucide-react";
import { 
  calculateDistanceMeters, 
  hasValidCoordinates 
} from "@/lib/geo";
import { 
  getDistanceTypeFromMeters, 
  getRecommendedRoutingByDistance,
  getCustomerChannelLabel,
  getCustomerDistanceLabel,
  getCareModelLabel
} from "@/lib/customerRouting";

interface RoutingReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: any;
}

export function RoutingReviewDialog({ open, onOpenChange, user }: RoutingReviewDialogProps) {
  const [loading, setLoading] = useState(false);
  const [companyLocation, setCompanyLocation] = useState<any | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
    } else {
      setCustomers([]);
      setCompanyLocation(null);
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load company location
      const { data: locData, error: locErr } = await supabase
        .from("company_locations")
        .select("*")
        .eq("is_default", true)
        .eq("is_active", true)
        .limit(1)
        .single();
        
      if (locErr && locErr.code !== 'PGRST116') throw locErr;
      if (locData) {
        setCompanyLocation(locData);
      } else {
        toast.error("Chưa có văn phòng mặc định. Vui lòng cấu hình trước.");
        setLoading(false);
        return;
      }

      // 2. Load active customers with coordinates
      const { data: custData, error: custErr } = await supabase
        .from("customers")
        .select("id, name, facility_name, phone, latitude, longitude, customer_distance_type, customer_channel, care_model")
        .is("deleted_at", null)
        .not("latitude", "is", null)
        .not("longitude", "is", null);

      if (custErr) throw custErr;
      
      setCustomers(custData || []);
    } catch (err: any) {
      console.error("Error loading data:", err);
      toast.error("Lỗi tải dữ liệu rà soát: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Tính toán kết quả so sánh
  const reviewedData = useMemo(() => {
    if (!companyLocation || customers.length === 0) return [];

    return customers.map(c => {
      if (!c.latitude || !c.longitude) return null;
      
      const distMeters = calculateDistanceMeters(
        Number(c.latitude),
        Number(c.longitude),
        Number(companyLocation.latitude),
        Number(companyLocation.longitude)
      );
      
      const routing = getRecommendedRoutingByDistance(distMeters);
      
      const isMatch = 
        routing.customerChannel === c.customer_channel && 
        routing.careModel === c.care_model && 
        routing.distanceType === c.customer_distance_type;

      // Status classification
      let status = "Đúng";
      if (!c.customer_channel && !c.care_model && !c.customer_distance_type) {
        status = "Thiếu dữ liệu";
      } else if (!isMatch) {
        status = "Lệch phân tuyến";
      }

      return {
        customer: c,
        distanceMeters: distMeters,
        distanceKm: (distMeters / 1000).toFixed(1),
        currentRouting: {
          channel: c.customer_channel,
          careModel: c.care_model,
          distanceType: c.customer_distance_type
        },
        suggestedRouting: routing,
        isMatch,
        status
      };
    }).filter(Boolean);
  }, [customers, companyLocation]);

  const mismatchedCount = reviewedData.filter((d: any) => d.status === "Lệch phân tuyến" || d.status === "Thiếu dữ liệu").length;

  const handleApplySingle = async (item: any) => {
    if (!window.confirm(`Áp dụng gợi ý phân tuyến cho khách hàng ${item.customer.facility_name || item.customer.name}?`)) return;
    
    setProcessing(true);
    try {
      await updateCustomerRouting(item);
      toast.success("Đã cập nhật phân tuyến khách hàng!");
      loadData(); // Reload to refresh list
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleApplyAllMismatched = async () => {
    const toUpdate = reviewedData.filter((d: any) => d.status === "Lệch phân tuyến" || d.status === "Thiếu dữ liệu");
    if (toUpdate.length === 0) return;
    
    if (!window.confirm(`Bạn có chắc chắn muốn áp dụng đồng loạt gợi ý cho ${toUpdate.length} khách hàng bị lệch?`)) return;

    setProcessing(true);
    try {
      // Execute sequentially to avoid rate limiting or large payload issues for activities
      for (const item of toUpdate) {
        await updateCustomerRouting(item);
      }
      toast.success(`Đã cập nhật phân tuyến cho ${toUpdate.length} khách hàng!`);
      loadData();
    } catch (err: any) {
      toast.error("Lỗi cập nhật hàng loạt: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const updateCustomerRouting = async (item: any) => {
    const c = item.customer;
    const suggested = item.suggestedRouting;
    
    // 1. Update customer
    const { error: updateErr } = await supabase
      .from("customers")
      .update({
        customer_distance_type: suggested.distanceType,
        customer_channel: suggested.customerChannel,
        care_model: suggested.careModel
      })
      .eq("id", c.id);
      
    if (updateErr) throw updateErr;

    // 2. Insert activity
    const content = `Khoảng cách tính được: ${Math.round(item.distanceMeters)} mét\n\nPhân tuyến cũ:\n- Khoảng cách: ${c.customer_distance_type || 'Chưa có'}\n- Kênh: ${c.customer_channel || 'Chưa có'}\n- Mô hình: ${c.care_model || 'Chưa có'}\n\nPhân tuyến mới:\n- Khoảng cách: ${suggested.distanceType}\n- Kênh: ${suggested.customerChannel}\n- Mô hình: ${suggested.careModel}`;
    
    const { error: actErr } = await supabase
      .from("customer_activities")
      .insert({
        customer_id: c.id,
        created_by: user?.id,
        activity_type: "note",
        title: "Cập nhật phân tuyến theo rà soát khoảng cách",
        content: content
      });

    if (actErr) throw actErr;
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !processing && onOpenChange(val)}>
      <DialogContent className="sm:max-w-5xl rounded-3xl p-6 border-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-blue-50 text-blue-650 flex items-center justify-center">
                  <RefreshCw className="w-4 h-4" />
                </span>
                Công cụ rà soát phân tuyến
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-1">
                Kiểm tra đối soát khách hàng so với văn phòng trung tâm
              </DialogDescription>
            </div>
            
            {companyLocation && (
              <Badge className="bg-slate-100 text-slate-600 font-bold uppercase text-[9px] px-2 py-1 shadow-sm">
                Mốc: {companyLocation.name}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pt-2 pb-4">
          {loading ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Đang phân tích tọa độ...</p>
            </div>
          ) : !companyLocation ? (
            <div className="h-40 flex flex-col items-center justify-center text-amber-500 gap-2">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-[11px] font-bold">Vui lòng thiết lập văn phòng mặc định trước.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-900">
                    Tìm thấy <strong className="text-blue-700">{mismatchedCount}</strong> khách hàng có phân tuyến chưa chuẩn so với gợi ý.
                  </span>
                </div>
                
                {mismatchedCount > 0 && (
                  <Button 
                    onClick={handleApplyAllMismatched}
                    disabled={processing}
                    className="h-8 text-[10px] font-black uppercase rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5"
                  >
                    {processing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckSquare className="w-3.5 h-3.5" />}
                    Áp dụng tất cả ({mismatchedCount})
                  </Button>
                )}
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[9px] font-black text-slate-500 tracking-wider">
                      <tr>
                        <th className="px-3 py-2.5 whitespace-nowrap">Khách hàng</th>
                        <th className="px-3 py-2.5 whitespace-nowrap text-center">Khoảng cách</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Phân tuyến hiện tại</th>
                        <th className="px-3 py-2.5 whitespace-nowrap">Gợi ý phân tuyến</th>
                        <th className="px-3 py-2.5 whitespace-nowrap text-center">Trạng thái</th>
                        <th className="px-3 py-2.5 whitespace-nowrap text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reviewedData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-8 text-center text-slate-400 font-medium">
                            Không có khách hàng nào có tọa độ để đối soát.
                          </td>
                        </tr>
                      ) : (
                        reviewedData.map((item: any) => (
                          <tr key={item.customer.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-3 py-2">
                              <div className="font-bold text-slate-900 line-clamp-1">{item.customer.facility_name || item.customer.name}</div>
                              <div className="text-[10px] text-slate-500 mt-0.5 flex gap-2">
                                <span>{item.customer.contact_name}</span>
                                {item.customer.phone && <span className="text-slate-400">{item.customer.phone}</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className="font-black text-blue-600">{item.distanceKm} km</span>
                            </td>
                            <td className="px-3 py-2">
                              {item.status === "Thiếu dữ liệu" ? (
                                <span className="text-slate-400 italic font-medium">Chưa có</span>
                              ) : (
                                <div className="space-y-0.5 text-[9px] font-bold text-slate-600">
                                  <div>Khoảng cách: {getCustomerDistanceLabel(item.currentRouting.distanceType)}</div>
                                  <div>Kênh: {getCustomerChannelLabel(item.currentRouting.channel)}</div>
                                  <div>Mô hình: {getCareModelLabel(item.currentRouting.careModel)}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="space-y-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 p-1.5 rounded-md border border-emerald-100">
                                <div>Khoảng cách: {getCustomerDistanceLabel(item.suggestedRouting.distanceType)}</div>
                                <div>Kênh: {getCustomerChannelLabel(item.suggestedRouting.customerChannel)}</div>
                                <div>Mô hình: {getCareModelLabel(item.suggestedRouting.careModel)}</div>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.status === "Đúng" ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100 cursor-default shadow-none">Đúng</Badge>
                              ) : item.status === "Lệch phân tuyến" ? (
                                <Badge className="bg-amber-100 text-amber-700 border-none hover:bg-amber-100 cursor-default shadow-none animate-pulse">Lệch</Badge>
                              ) : (
                                <Badge className="bg-rose-100 text-rose-700 border-none hover:bg-rose-100 cursor-default shadow-none">Thiếu</Badge>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {item.status !== "Đúng" ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={processing}
                                  onClick={() => handleApplySingle(item)}
                                  className="h-7 text-[9px] font-black uppercase text-blue-600 border-blue-200 hover:bg-blue-50 px-2"
                                >
                                  Áp dụng
                                </Button>
                              ) : (
                                <span className="text-slate-300 text-[10px] font-bold">Đã chuẩn</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-100 pt-3">
          <DialogClose asChild>
            <Button 
              variant="outline" 
              disabled={processing}
              className="rounded-xl border-slate-200 font-black text-xs h-9 px-5 bg-white hover:bg-slate-50 text-slate-700"
            >
              Đóng
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
