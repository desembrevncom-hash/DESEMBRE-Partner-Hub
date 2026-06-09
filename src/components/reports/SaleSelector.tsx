import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface SaleUser {
  id: string;
  email: string;
  display_name: string | null;
}

interface SaleSelectorProps {
  selectedSaleId: string;
  onChange: (id: string) => void;
}

export function SaleSelector({ selectedSaleId, onChange }: SaleSelectorProps) {
  const { user, isAdmin } = useAuth();
  const [sales, setSales] = useState<SaleUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch if admin
    if (isAdmin) {
      fetchSales();
    } else {
      setLoading(false);
      if (user?.id && selectedSaleId !== user.id) {
        onChange(user.id);
      }
    }
  }, [isAdmin, user]);

  const fetchSales = async () => {
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, display_name"),
        supabase.from("user_roles").select("user_id, role").eq("role", "sale"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const saleUserIds = new Set(rolesRes.data.map((r) => r.user_id));
      const saleProfiles = profilesRes.data.filter((p) => saleUserIds.has(p.id));
      
      setSales(saleProfiles);
    } catch (error) {
      console.error("Error fetching sales:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return null; // Hide completely for non-admins

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" /> Đang tải Sale...
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-slate-700 whitespace-nowrap">Chọn Sale:</span>
      <Select value={selectedSaleId} onValueChange={onChange}>
        <SelectTrigger className="w-[250px] bg-white">
          <SelectValue placeholder="-- Chọn tài khoản Sale --" />
        </SelectTrigger>
        <SelectContent>
          {sales.map((sale) => (
            <SelectItem key={sale.id} value={sale.id}>
              {sale.display_name || sale.email.split("@")[0]} ({sale.email})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
