import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { OpportunityCustomer } from "@/types/salesReports";
import { Input } from "@/components/ui/input";
import { Loader2, DollarSign, Calendar, Star } from "lucide-react";

export function SalesOpportunitiesTab({ selectedSaleId }: { selectedSaleId: string }) {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [opportunities, setOpportunities] = useState<OpportunityCustomer[]>([]);

  useEffect(() => {
    if (user && selectedSaleId) {
      fetchOpportunities();
    }
  }, [user, selectedSaleId]);

  const fetchOpportunities = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("customers")
        .select(`
          id, name, contact_name, facility_name, city, district, source,
          lifecycle_stage, created_at, last_reassigned_at, last_activity_at,
          last_contacted_at, delete_reason, reclaim_reason,
          opportunity_expected_revenue, opportunity_expected_close_date, opportunity_potential_score
        `)
        .not("lifecycle_stage", "in", '("won","lost","deleted")')
        .order("created_at", { ascending: false });

      if (isAdmin && selectedSaleId) {
        query = query.eq("owner_sale_id", selectedSaleId);
      } else if (!isAdmin) {
        query = query.eq("owner_sale_id", user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOpportunities((data as unknown) as OpportunityCustomer[]);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to load opportunities");
    } finally {
      setLoading(false);
    }
  };

  const updateOpportunityField = async (id: string, field: string, value: any) => {
    try {
      // Optimistic update locally
      setOpportunities((prev) =>
        prev.map((opt) => (opt.id === id ? { ...opt, [field]: value } : opt))
      );

      const { error } = await supabase
        .from("customers")
        .update({ [field]: value })
        .eq("id", id);

      if (error) {
        // Rollback on error - re-fetch to be safe
        fetchOpportunities();
        throw error;
      }
      toast.success("Đã lưu thông tin opportunity");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Không thể lưu trường này");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
          Bảng theo dõi Cơ hội bán hàng
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          {opportunities.length} cơ hội đang mở
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <th className="p-3 pl-6">Khách hàng / Spa</th>
              <th className="p-3">Giai đoạn</th>
              <th className="p-3 w-48"><div className="flex items-center gap-1"><DollarSign className="w-4 h-4"/> Dự kiến (VNĐ)</div></th>
              <th className="p-3 w-40"><div className="flex items-center gap-1"><Calendar className="w-4 h-4"/> Ngày chốt</div></th>
              <th className="p-3 w-32"><div className="flex items-center gap-1"><Star className="w-4 h-4"/> Tiềm năng (1-10)</div></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {opportunities.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
                  Không có cơ hội bán hàng nào đang mở.
                </td>
              </tr>
            ) : (
              opportunities.map((opt) => (
                <tr key={opt.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3 pl-6">
                    <div className="font-bold text-slate-900">{opt.facility_name || opt.name}</div>
                    <div className="text-xs text-slate-500">{opt.city || opt.district || "Chưa có địa chỉ"}</div>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md">
                      {opt.lifecycle_stage}
                    </span>
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      value={opt.opportunity_expected_revenue || ""}
                      onChange={(e) => updateOpportunityField(opt.id, "opportunity_expected_revenue", Number(e.target.value))}
                      placeholder="VD: 50000000"
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="date"
                      className="h-8 text-sm"
                      value={opt.opportunity_expected_close_date || ""}
                      onChange={(e) => updateOpportunityField(opt.id, "opportunity_expected_close_date", e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      min="1"
                      max="10"
                      value={opt.opportunity_potential_score || ""}
                      onChange={(e) => updateOpportunityField(opt.id, "opportunity_potential_score", Number(e.target.value))}
                      placeholder="1-10"
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
