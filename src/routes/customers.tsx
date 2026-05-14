import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Plus, Pencil, Trash2, Search, Loader2, Download } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/customers")({
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  facility_name: string;
  phone: string;
  address: string;
  user_id?: string;
  created_at?: string;
};

function CustomersPage() {
  const { user, isSale, isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", facility_name: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  
  const isMock = !!localStorage.getItem("mock_session") || !!localStorage.getItem("mock_users");
  const [useLocalFallback, setUseLocalFallback] = useState(isMock);

  const loadData = async () => {
    setLoading(true);

    // Baseline sample client records to ensure the dashboard initializes gracefully with functional examples
    const defaultBaselineData = [
      { id: "sample-1", name: "Chị Lan Anh", facility_name: "Lan Anh Beauty & Spa", phone: "0912345678", address: "Quận Hoàn Kiếm, Hà Nội" },
      { id: "sample-2", name: "Anh Minh Tuấn", facility_name: "Tuấn Premium Clinic", phone: "0987654321", address: "Quận 1, TP. Hồ Chí Minh" },
    ];

    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (data.length === 0) {
        data = [...defaultBaselineData];
        try { localStorage.setItem("mock_customers", JSON.stringify(data)); } catch { /* ignore */ }
      }
      setCustomers(data.filter((c: any) => isAdmin || !c.user_id || c.user_id === user?.id));
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from("customers").select("*").order('created_at', { ascending: false });
    if (error) {
      const msg = error.message?.toLowerCase() || "";
      if (error.code === '42P01' || msg.includes("find the table") || msg.includes("schema cache") || msg.includes("does not exist")) {
        setUseLocalFallback(true);
        let localData = JSON.parse(localStorage.getItem("mock_customers") || "[]");
        if (localData.length === 0) {
          localData = [...defaultBaselineData];
          try { localStorage.setItem("mock_customers", JSON.stringify(localData)); } catch { /* ignore */ }
        }
        setCustomers(localData);
        toast.success("Đã kích hoạt CSDL Khách hàng dự phòng cục bộ (Do Database chưa chạy Migration bảng customers)");
      } else {
        toast.error("Lỗi tải khách hàng: " + error.message);
        // Fallback gracefully
        setCustomers([...defaultBaselineData]);
      }
    } else {
      setCustomers(data as Customer[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [useLocalFallback, user?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      c.facility_name?.toLowerCase().includes(q) || 
      c.phone?.includes(q)
    );
  }, [customers, query]);

  const handleOpen = (c?: Customer) => {
    if (c) {
      setEditingId(c.id);
      setForm({ name: c.name || "", facility_name: c.facility_name || "", phone: c.phone || "", address: c.address || "" });
    } else {
      setEditingId(null);
      setForm({ name: "", facility_name: "", phone: "", address: "" });
    }
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Vui lòng nhập họ và tên");
      return;
    }
    
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      facility_name: form.facility_name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
      user_id: user?.id,
    };

    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      if (editingId) {
        const idx = data.findIndex((c: any) => c.id === editingId);
        if (idx >= 0) data[idx] = { ...data[idx], ...payload };
      } else {
        data.unshift({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...payload });
      }
      localStorage.setItem("mock_customers", JSON.stringify(data));
      setCustomers(data.filter((c: any) => isAdmin || !c.user_id || c.user_id === user?.id));
      setSaving(false);
      setOpen(false);
      toast.success(editingId ? "Đã cập nhật" : "Đã thêm mới");
      return;
    }

    if (editingId) {
      const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
      if (error) toast.error("Lỗi: " + error.message);
      else {
        toast.success("Đã cập nhật");
        setOpen(false);
        loadData();
      }
    } else {
      const { error } = await supabase.from("customers").insert([payload]);
      if (error) toast.error("Lỗi: " + error.message);
      else {
        toast.success("Đã thêm mới");
        setOpen(false);
        loadData();
      }
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa khách hàng này?")) return;
    
    if (useLocalFallback) {
      let data = JSON.parse(localStorage.getItem("mock_customers") || "[]");
      data = data.filter((c: any) => c.id !== id);
      localStorage.setItem("mock_customers", JSON.stringify(data));
      setCustomers(data.filter((c: any) => isAdmin || !c.user_id || c.user_id === user?.id));
      toast.success("Đã xóa");
      return;
    }

    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) toast.error("Lỗi xóa: " + error.message);
    else {
      toast.success("Đã xóa");
      loadData();
    }
  };

  const handleExportCsv = () => {
    if (filtered.length === 0) {
      toast.error("Không có dữ liệu khách hàng để xuất CSV");
      return;
    }

    // Tiêu đề cột chuẩn theo yêu cầu CRM
    const headers = [
      "contact_name", 
      "business_name", 
      "phone", 
      "email", 
      "address", 
      "city", 
      "status", 
      "source", 
      "assigned_sale_id", 
      "note", 
      "created_at"
    ];

    // Hàm escape chuỗi CSV an toàn
    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filtered.map((c: any) => {
      return [
        escapeCsv(c.name || c.contact_name || ""),
        escapeCsv(c.facility_name || c.business_name || ""),
        escapeCsv(c.phone || ""),
        escapeCsv(c.email || ""),
        escapeCsv(c.address || ""),
        escapeCsv(c.city || ""),
        escapeCsv(c.status || "active"),
        escapeCsv(c.source || "manual"),
        escapeCsv(c.user_id || c.assigned_sale_id || ""),
        escapeCsv(c.note || ""),
        escapeCsv(c.created_at || new Date().toISOString())
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    
    // Thêm BOM UTF-8 để Excel đọc tiếng Việt chuẩn xác không bị lỗi font
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Đã xuất thành công ${filtered.length} khách hàng ra file CSV`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              <span>Trang chủ</span>
            </Link>
            <h1 className="text-xl font-bold">Khách hàng</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handleExportCsv} 
              size="sm"
              className="border-slate-200 hover:bg-slate-100 font-bold"
            >
              <Download className="w-4 h-4 mr-2 text-emerald-600" /> Export CSV
            </Button>
            <Button onClick={() => handleOpen()} size="sm" className="font-bold">
              <Plus className="w-4 h-4 mr-2" /> Thêm khách hàng
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8">
        <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Tìm tên, cơ sở, số điện thoại..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 h-10 w-full"
              />
            </div>
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              Tổng số: <span className="font-bold text-foreground">{filtered.length}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Họ và tên</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Tên cơ sở</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Số điện thoại</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Địa chỉ</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-24">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 opacity-50" />
                      Đang tải danh sách...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted-foreground">
                      Không tìm thấy khách hàng nào.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-accent/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3">{c.facility_name || <span className="text-muted-foreground italic">Trống</span>}</td>
                      <td className="px-4 py-3">{c.phone || <span className="text-muted-foreground italic">Trống</span>}</td>
                      <td className="px-4 py-3">{c.address || <span className="text-muted-foreground italic">Trống</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpen(c)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded border border-border hover:bg-accent hover:text-foreground text-muted-foreground transition-colors"
                            title="Sửa"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="w-8 h-8 inline-flex items-center justify-center rounded border border-border hover:bg-destructive/10 text-destructive transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa thông tin khách hàng" : "Thêm khách hàng mới"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Họ và tên <span className="text-destructive">*</span></Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Nguyễn Văn A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facility">Tên cơ sở (Spa/Clinic)</Label>
              <Input
                id="facility"
                value={form.facility_name}
                onChange={(e) => setForm({ ...form, facility_name: e.target.value })}
                placeholder="VD: Desembre Spa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Số điện thoại</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="09..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Địa chỉ</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Hủy</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingId ? "Lưu thay đổi" : "Thêm mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

