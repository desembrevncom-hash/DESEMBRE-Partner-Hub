import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SalesPerformanceMetrics } from "@/types/salesReports";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, TrendingUp, Users, ShoppingCart, Activity } from "lucide-react";

export function SalesMonthlyTab({ selectedSaleId }: { selectedSaleId: string }) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<SalesPerformanceMetrics | null>(null);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [manualInput, setManualInput] = useState({
    variable_cost: 0,
    expected_orders_next_period: 0,
    notes: "",
  });

  // Default to current month
  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    setPeriodStart(firstDay.toISOString().split("T")[0]);
    setPeriodEnd(lastDay.toISOString().split("T")[0]);
  }, [user]);

  useEffect(() => {
    if (periodStart && periodEnd && selectedSaleId) {
      fetchReport();
    }
  }, [periodStart, periodEnd, selectedSaleId]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_sales_performance_report", {
        p_sale_user_id: isAdmin ? (selectedSaleId || user?.id) : user?.id,
        p_report_type: "monthly",
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      if (error) throw error;
      setMetrics(data as unknown as SalesPerformanceMetrics);
      
      if (data && (data as any).manual_inputs) {
        const mi = (data as any).manual_inputs;
        setManualInput({
          variable_cost: mi.variable_cost || 0,
          expected_orders_next_period: mi.expected_orders_next_period || 0,
          notes: mi.notes || "",
        });
      } else {
        setManualInput({ variable_cost: 0, expected_orders_next_period: 0, notes: "" });
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const saveManualInputs = async () => {
    setSaving(true);
    try {
      const inputData = {
        sale_user_id: selectedSaleId,
        report_type: "monthly",
        period_start: periodStart,
        period_end: periodEnd,
        variable_cost: manualInput.variable_cost,
        expected_orders_next_period: manualInput.expected_orders_next_period,
        notes: manualInput.notes,
      };

      const { error } = await supabase
        .from("sales_report_inputs")
        .upsert(inputData, { onConflict: "sale_user_id,report_type,period_start,period_end" });

      if (error) throw error;
      toast.success("Cập nhật số liệu thủ công thành công");
      setIsUpdateModalOpen(false);
      fetchReport();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to save inputs");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
        <div>
          <Label className="text-xs mb-1 block text-slate-500">Từ ngày</Label>
          <Input 
            type="date" 
            value={periodStart} 
            onChange={(e) => setPeriodStart(e.target.value)} 
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block text-slate-500">Đến ngày</Label>
          <Input 
            type="date" 
            value={periodEnd} 
            onChange={(e) => setPeriodEnd(e.target.value)} 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : metrics ? (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard title="Doanh thu (VNĐ)" value={metrics.total_revenue?.toLocaleString() || "0"} icon={<TrendingUp />} color="text-amber-600" bg="bg-amber-50" />
            <MetricCard title="Tổng đơn hàng" value={metrics.order_count || 0} icon={<ShoppingCart />} color="text-blue-600" bg="bg-blue-50" />
            <MetricCard title="Khách mua hàng" value={metrics.customers_who_ordered || 0} icon={<Users />} color="text-emerald-600" bg="bg-emerald-50" />
            <MetricCard title="Khách mua (90 Ngày)" value={metrics.active_90_day_customers || 0} icon={<Users />} color="text-pink-600" bg="bg-pink-50" />
            <MetricCard title="Khách mới" value={metrics.new_customers || 0} icon={<Users />} color="text-purple-600" bg="bg-purple-50" />
            <MetricCard title="Khách đang Follow" value={metrics.customers_followed || 0} icon={<Activity />} color="text-indigo-600" bg="bg-indigo-50" />
            <MetricCard title="Viếng thăm trực tiếp" value={metrics.direct_visits || 0} icon={<Activity />} color="text-rose-600" bg="bg-rose-50" />
            <MetricCard title="Chi phí Variable (Thủ công)" value={manualInput.variable_cost?.toLocaleString() || "0"} icon={<TrendingUp />} color="text-slate-600" bg="bg-slate-50" />
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">Thông tin cập nhật thủ công</h3>
              <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Cập nhật số liệu</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Cập nhật số liệu tháng</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div>
                      <Label>Chi phí Variable (VNĐ)</Label>
                      <Input 
                        type="number" 
                        value={manualInput.variable_cost} 
                        onChange={(e) => setManualInput({...manualInput, variable_cost: Number(e.target.value)})} 
                      />
                    </div>
                    <div>
                      <Label>Dự kiến số đơn tháng tới</Label>
                      <Input 
                        type="number" 
                        value={manualInput.expected_orders_next_period} 
                        onChange={(e) => setManualInput({...manualInput, expected_orders_next_period: Number(e.target.value)})} 
                      />
                    </div>
                    <div>
                      <Label>Ghi chú / Kế hoạch</Label>
                      <Textarea 
                        value={manualInput.notes} 
                        onChange={(e) => setManualInput({...manualInput, notes: e.target.value})} 
                        rows={4}
                      />
                    </div>
                    <Button onClick={saveManualInputs} disabled={saving} className="w-full">
                      {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Lưu thông tin
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold w-40 inline-block">Dự kiến đơn tháng tới:</span> {manualInput.expected_orders_next_period}</p>
              <p><span className="font-semibold w-40 inline-block">Ghi chú:</span> {manualInput.notes || <span className="text-slate-400 italic">Không có ghi chú</span>}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-500">Không có dữ liệu báo cáo cho khoảng thời gian này.</div>
      )}
    </div>
  );
}

function MetricCard({ title, value, icon, color, bg }: { title: string, value: string | number, icon: any, color: string, bg: string }) {
  return (
    <div className={`p-4 rounded-xl border border-slate-100 ${bg}`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-600 uppercase">{title}</h4>
        <div className={`${color}`}>{icon}</div>
      </div>
      <div className={`text-2xl font-black ${color}`}>{value}</div>
    </div>
  );
}
