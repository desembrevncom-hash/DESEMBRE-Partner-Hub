import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIES, PRODUCTS } from "@/data/products";
import { formatCurrencyVND } from "@/lib/pricing";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import type { Product, Category, ProductVariant } from "@/types/product";
import type { OverrideRow } from "@/lib/saveOverride";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Plus, Trash2, Search, ShoppingCart, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { CatalogPDF } from "@/components/CatalogPDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { useRef } from "react";

type OrderSearch = {
  edit?: string;
};

export const Route = createFileRoute("/orders/new")({
  component: NewOrderPage,
  validateSearch: (search: Record<string, unknown>): OrderSearch => {
    return {
      edit: search.edit as string | undefined,
    };
  },
});

const fmt = formatCurrencyVND;

type LineItem = {
  product_no: number;
  product_name: string;
  image_url?: string | null;
  size: string;
  size_type: "retail" | "salon";
  unit_price: number; // already discounted
  quantity: number;
};

function NewOrderPage() {
  const { user, isAdmin, isSale, loading } = useAuth();
  const { vatRate, defaultDiscount } = useSystemSettings();
  const navigate = useNavigate();
  const [overrides, setOverrides] = useState<Record<number, OverrideRow>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [note, setNote] = useState("");
  const [vatOn, setVatOn] = useState(false);
  const [items, setItems] = useState<LineItem[]>([]);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isGiftMode, setIsGiftMode] = useState(false);
  const { edit: editId } = Route.useSearch();
  const [busy, setBusy] = useState(!!editId); // Start busy if we need to load editId
  const printRef = useRef<HTMLDivElement>(null);
  const isGuest = !user;
  const quoterName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || "Admin Desembre";
  const quoterEmail = user?.email || "contact@desembre.vn";
  const quoterPhone = user?.user_metadata?.phone || "";
  const [step, setStep] = useState<1 | 2>(1);
  const [showPdf, setShowPdf] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customersList, setCustomersList] = useState<any[]>([]);

  useEffect(() => {
    setShowPdf(false);
  }, [items, customerName]);

  useEffect(() => {
    if (loading) return;
    // ALLOW VIEWERS: Proceed even if user is null
    (async () => {
      let map: Record<number, OverrideRow> = {};
      const hasMockOverrides = localStorage.getItem("mock_overrides");
      const hasMockUsers = localStorage.getItem("mock_users");
      
      if (hasMockOverrides || hasMockUsers) {
        const mockData = JSON.parse(hasMockOverrides || "[]");
        for (const r of mockData) map[r.no] = r as OverrideRow;
      } else {
        try {
          const fetchPromise = supabase.from("product_overrides").select("*");
          const timeoutPromise = new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error("Supabase timeout")), 3000)
          );
          const { data } = await Promise.race([fetchPromise, timeoutPromise]);
          for (const r of data ?? []) map[r.no] = r as OverrideRow;
        } catch (err) {
          console.warn("Supabase load timed out on new order page", err);
        }
      }
      setOverrides(map);

      if (editId) {
        let loadedOrder = null;
        let loadedItems = [];
        const { data: o } = await supabase.from("orders").select("*").eq("id", editId).maybeSingle();
        if (o) {
          loadedOrder = o;
          const { data: it } = await supabase.from("order_items").select("*").eq("order_id", editId).order("created_at");
          loadedItems = it ?? [];
        } else {
          const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
          const localOrder = guestOrders.find((go: any) => go.id === editId);
          if (localOrder) {
            loadedOrder = localOrder;
            loadedItems = localOrder.items || [];
          }
        }
        
        if (loadedOrder) {
          setSelectedCustomerId(loadedOrder.customer_id || null);
          setCustomerName(loadedOrder.customer_name || "");
          setCustomerPhone(loadedOrder.customer_phone || "");
          setCustomerAddress(loadedOrder.customer_address || "");
          setNote(loadedOrder.note || "");
          setVatOn(Number(loadedOrder.vat_rate) > 0);
          setItems(loadedItems.map((it: any) => ({
            product_no: it.product_no,
            product_name: it.product_name,
            image_url: null,
            size: it.size || "",
            size_type: it.size_type,
            unit_price: it.unit_price,
            quantity: it.quantity,
          })));
        }
        setBusy(false);
      }

      // Tải danh sách khách hàng CRM để liên kết
      try {
        const localC = JSON.parse(localStorage.getItem("mock_customers") || "[]");
        if (localC.length > 0) {
          setCustomersList(localC);
        } else {
          const { data: cData } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
          if (cData) setCustomersList(cData);
        }
      } catch {}

      // Seed items from pickup cart in sessionStorage
      try {
        const raw = sessionStorage.getItem("pickupCart");
        if (!raw) return;
        const picks: { no: number; sizeType: "retail" | "salon" }[] = JSON.parse(raw);
        if (!Array.isArray(picks) || picks.length === 0) return;
        const seeded: LineItem[] = [];
        for (const pk of picks) {
          const staticP = PRODUCTS.find((p: Product) => p.id === pk.no);
          const o = map[pk.no];
          
          // If it's not a static product and not a custom product, skip
          if (!staticP && (!o || !o.is_custom)) continue;
          
          let productName = staticP?.name ?? o?.name ?? "(Chưa có tên)";
          let imageUrl = o?.image_url ?? staticP?.imageUrl;
          let basePrice = 0;
          let size = "";

          const staticVariant = staticP?.variants.find((v: ProductVariant) => v.type === pk.sizeType);
          basePrice = staticVariant?.price ?? 0;
          size = staticVariant?.size ?? "";

          // Apply overrides (for both static and custom products)
          if (o) {
            productName = o.name ?? productName;
            if (pk.sizeType === "retail") {
              if (o.retail_price != null) basePrice = o.retail_price;
              if (o.retail_size != null) size = o.retail_size;
            } else {
              if (o.salon_price != null) basePrice = o.salon_price;
              if (o.salon_size != null) size = o.salon_size;
            }
          }
          
          if (basePrice === 0) continue;

          const existing = seeded.find(it => it.product_no === pk.no && it.size_type === pk.sizeType);
          if (existing) {
            existing.quantity += 1;
            continue;
          }

          seeded.push({
            product_no: pk.no,
            product_name: productName,
            image_url: imageUrl,
            size,
            size_type: pk.sizeType,
            unit_price: basePrice * (isSale && !isAdmin ? (1 - defaultDiscount) : 1),
            quantity: 1,
          });
        }
        if (seeded.length > 0) {
          setItems(prev => {
            const merged = [...prev];
            for (const s of seeded) {
               const idx = merged.findIndex(i => i.product_no === s.product_no && i.size_type === s.size_type);
               if (idx >= 0) merged[idx].quantity += s.quantity;
               else merged.push(s);
            }
            return merged;
          });
          toast.success(`Đã thêm ${seeded.length} sản phẩm từ danh sách chọn`);
        }
        sessionStorage.removeItem("pickupCart");
      } catch {/* ignore */}
    })();
  }, [user, isAdmin, isSale, loading, navigate]);

  const merged: Product[] = useMemo(() => {
    const list: Product[] = [];
    for (const p of PRODUCTS) {
      const o = overrides[p.id];
      if (o?.deleted) continue;
      list.push({
        ...p,
        name: o?.name ?? p.name,
        description: o?.desc ?? p.description,
        categoryId: o?.section ?? p.categoryId,
        imageUrl: o?.image_url ?? p.imageUrl,
      });
    }
    for (const o of Object.values(overrides)) {
      if (!o.is_custom || o.deleted) continue;
      list.push({
        id: o.no,
        name: o.name ?? "(Chưa có tên)",
        description: o.desc ?? "",
        categoryId: o.section ?? "OTHER",
        imageUrl: o.image_url ?? undefined,
        variants: [
          ...(o.retail_price != null ? [{ id: `${o.no}-retail`, type: "retail" as const, size: o.retail_size ?? "", price: o.retail_price }] : []),
          ...(o.salon_price != null ? [{ id: `${o.no}-salon`, type: "salon" as const, size: o.salon_size ?? "", price: o.salon_price }] : []),
        ],
        isCustom: true
      });
    }
    return list;
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merged.filter((p) => !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }, [search, merged]);

  const addLine = useCallback((product: Product, sizeType: "retail" | "salon", isGift: boolean = false) => {
    const o = overrides[product.id];
    const variant = product.variants.find((v: ProductVariant) => v.type === sizeType);
    
    let size = variant?.size ?? "";
    let basePrice = variant?.price ?? 0;

    if (o) {
      if (sizeType === "retail" && o.retail_size != null) size = o.retail_size;
      if (sizeType === "salon" && o.salon_size != null) size = o.salon_size;
      if (sizeType === "retail" && o.retail_price != null) basePrice = o.retail_price;
      if (sizeType === "salon" && o.salon_price != null) basePrice = o.salon_price;
    }

    if (basePrice === 0 && !isGift) {
      toast.error("Sản phẩm này chưa có giá. Hãy nhờ ADMIN cập nhật.");
      return;
    }

    const discounted = isGift ? 0 : basePrice * (isSale && !isAdmin ? (1 - defaultDiscount) : 1);
    const finalName = isGift ? `[Quà tặng] ${product.name}` : product.name;
    
    setItems((prev) => {
      const idx = prev.findIndex(it => it.product_no === product.id && it.size_type === sizeType && it.unit_price === discounted);
      if (idx >= 0) {
        const next = [...prev];
        next[idx].quantity += 1;
        return next;
      }
      return [
        ...prev,
        {
          product_no: product.id,
          product_name: finalName,
          image_url: o?.image_url ?? product.imageUrl,
          size: size,
          size_type: sizeType,
          unit_price: discounted,
          quantity: 1,
        },
      ];
    });
    setPickerOpen(false);
    setSearch("");
  }, [overrides, isSale, isAdmin]);

  const updateQty = useCallback((idx: number, qty: number) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, qty) } : it)));
  }, []);

  const removeLine = useCallback((idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx)), []);

  const save = async (status: "draft" | "confirmed") => {
    if (!customerName.trim()) return toast.error("Cần nhập tên khách hàng");
    if (items.length === 0) return toast.error("Đơn hàng phải có ít nhất 1 sản phẩm");
    setBusy(true);

    const updateLocalOrder = () => {
      const guestOrders = JSON.parse(localStorage.getItem("guest_orders") || "[]");
      if (editId) {
        const idx = guestOrders.findIndex((o: any) => o.id === editId);
        if (idx >= 0) {
          guestOrders[idx] = {
            ...guestOrders[idx],
            customer_id: selectedCustomerId || null,
            customer_name: customerName.trim(),
            customer_phone: customerPhone.trim() || null,
            customer_address: customerAddress.trim() || null,
            note: note.trim() || null,
            subtotal,
            vat_rate: vatOn ? vatRate : 0,
            total,
            status,
            items: items.map(it => ({ ...it, line_total: it.unit_price * it.quantity }))
          };
          localStorage.setItem("guest_orders", JSON.stringify(guestOrders));
          return guestOrders[idx];
        }
      }
      
      const newOrder = {
        id: crypto.randomUUID(),
        order_no: 3000 + guestOrders.length,
        sale_user_id: user?.id || "guest",
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        note: note.trim() || null,
        subtotal,
        discount_rate: user && isSale && !isAdmin ? defaultDiscount : 0,
        vat_rate: vatOn ? vatRate : 0,
        total,
        status,
        created_at: new Date().toISOString(),
        items: items.map(it => ({ ...it, line_total: it.unit_price * it.quantity }))
      };
      guestOrders.push(newOrder);
      localStorage.setItem("guest_orders", JSON.stringify(guestOrders));
      return newOrder;
    };

    if (!user) {
      const saved = updateLocalOrder();
      setBusy(false);
      toast.success(editId ? "Đã cập nhật đơn nháp (Local)" : "Đã lưu đơn (Local)");
      navigate({ to: "/orders" }); 
      return;
    }

    let orderId = editId;
    let order = null;

    if (editId) {
      // Bổ sung luồng thử ghi kèm customer_id trước, nếu DB chưa có cột thì fallback bỏ qua
      const payloadWithCid = {
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        note: note.trim() || null,
        subtotal,
        vat_rate: vatOn ? vatRate : 0,
        total,
        status,
      };
      
      let updRes = await supabase.from("orders").update(payloadWithCid).eq("id", editId).select().maybeSingle();
      if (updRes.error && (updRes.error.code === '42703' || updRes.error.message?.includes("column"))) {
        // Fallback bỏ customer_id
        const fallbackPayload = { ...payloadWithCid };
        delete (fallbackPayload as any).customer_id;
        updRes = await supabase.from("orders").update(fallbackPayload).eq("id", editId).select().maybeSingle();
      }

      const { error: updErr, data: updData } = updRes;
      
      if (updErr) {
        if (updErr.message?.includes("row-level security")) {
          updateLocalOrder();
          toast.success(editId ? "Đã cập nhật đơn nháp" : "Đã lưu nháp");
          navigate({ to: "/orders" });
          setBusy(false);
          return;
        }
        setBusy(false);
        return toast.error(updErr.message);
      }
      
      if (!updData) {
        updateLocalOrder();
        toast.success(editId ? "Đã cập nhật đơn nháp" : "Đã lưu nháp");
        navigate({ to: "/orders" });
        setBusy(false);
        return;
      }
      
      order = updData;
      await supabase.from("order_items").delete().eq("order_id", editId);
    } else {
      const payloadWithCid = {
        sale_user_id: user.id,
        customer_id: selectedCustomerId || null,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim() || null,
        customer_address: customerAddress.trim() || null,
        note: note.trim() || null,
        subtotal,
        discount_rate: isSale && !isAdmin ? defaultDiscount : 0,
        vat_rate: vatOn ? vatRate : 0,
        total,
        status,
      };

      let insRes = await supabase.from("orders").insert(payloadWithCid).select().single();
      if (insRes.error && (insRes.error.code === '42703' || insRes.error.message?.includes("column"))) {
        const fallbackPayload = { ...payloadWithCid };
        delete (fallbackPayload as any).customer_id;
        insRes = await supabase.from("orders").insert(fallbackPayload).select().single();
      }

      const { data: insData, error } = insRes;
      
      if (error || !insData) {
        if (error?.message?.includes("row-level security")) {
          updateLocalOrder();
          toast.success("Đã lưu nháp");
          navigate({ to: "/orders" });
          setBusy(false);
          return;
        }
        setBusy(false);
        return toast.error(error?.message ?? "Lưu đơn thất bại");
      }
      order = insData;
      orderId = order.id;
    }

    if (!orderId) {
      setBusy(false);
      return toast.error("Lỗi: Không tìm thấy ID đơn hàng");
    }

    const { error: itemsErr } = await supabase.from("order_items").insert(
      items.map((it) => ({
        order_id: orderId as string,
        product_no: it.product_no,
        product_name: it.product_name,
        size: it.size || null,
        size_type: it.size_type,
        unit_price: it.unit_price,
        quantity: it.quantity,
        line_total: it.unit_price * it.quantity,
      })),
    );
    setBusy(false);
    if (itemsErr) return toast.error(itemsErr.message);
    
    toast.success(editId ? "Đã cập nhật đơn" : "Đã lưu nháp");
    navigate({ to: "/orders/$id", params: { id: order.id } });
  };

  const subtotal = items.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const vatAmount = vatOn ? subtotal * vatRate : 0;
  const total = subtotal + vatAmount;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </Link>
            <h1 className="text-xl font-bold">
              {step === 1 ? "Kiểm tra đơn hàng (Draft)" : "Thông tin khách hàng"}
            </h1>
            {isGuest && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-bold uppercase border border-orange-500/20">
                Khách vãng lai
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tổng tiền {vatOn ? "(Đã có VAT)" : ""}</div>
              <div className="text-lg font-bold text-primary font-mono">{fmt(total)}</div>
            </div>
            {step === 1 ? (
              <Button onClick={() => setStep(2)} disabled={items.length === 0}>
                Tiếp theo <ArrowLeft className="w-4 h-4 rotate-180 ml-2" />
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStep(1)}>
                Quay lại bảng kê
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 flex-1">
        {step === 1 ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Danh sách sản phẩm được chọn</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setPickerOpen(true); setIsGiftMode(false); }}>
                  <Plus className="w-4 h-4 mr-2" /> Thêm sản phẩm
                </Button>
                <Button variant="outline" size="sm" onClick={() => { setPickerOpen(true); setIsGiftMode(true); }} className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 bg-white shadow-sm">
                  <Plus className="w-4 h-4 mr-2" /> Thêm quà tặng
                </Button>
              </div>
            </div>

            {pickerOpen && (
              <div className={`border rounded-md p-3 shadow-lg space-y-2 mb-4 animate-in fade-in slide-in-from-top-2 ${isGiftMode ? "border-orange-200 bg-orange-50/50" : "border-border bg-card"}`}>
                <div className="flex justify-between items-center pb-2 border-b border-border/50">
                   <span className={`font-bold text-sm flex items-center gap-2 ${isGiftMode ? "text-orange-700" : ""}`}>
                     {isGiftMode ? "🎁 Tìm quà tặng (Miễn phí)" : "Tìm thêm sản phẩm"}
                   </span>
                   <button onClick={() => setPickerOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm kiếm…" className="pl-9 bg-white" autoFocus />
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
                  {filtered.slice(0, 30).map((p: Product) => (
                    <div key={p.id} className="py-2 flex items-center justify-between gap-2 hover:bg-white/50 px-2 rounded transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{p.description}</div>
                      </div>
                      <div className="flex gap-1">
                        {p.variants.some((v: ProductVariant) => v.type === "retail") && (
                          <button onClick={() => addLine(p, "retail", isGiftMode)} className={`text-[10px] font-bold px-2 py-1 rounded ${isGiftMode ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"} hover:opacity-90`}>
                            {isGiftMode ? "TẶNG" : "CHỌN"} RETAIL {p.variants.find((v: ProductVariant) => v.type === "retail")?.size ?? ""}
                          </button>
                        )}
                        {p.variants.some((v: ProductVariant) => v.type === "salon") && (
                          <button onClick={() => addLine(p, "salon", isGiftMode)} className={`text-[10px] font-bold px-2 py-1 rounded ${isGiftMode ? "bg-orange-500 text-white" : "bg-primary text-primary-foreground"} hover:opacity-90`}>
                            {isGiftMode ? "TẶNG" : "CHỌN"} SALON {p.variants.find((v: ProductVariant) => v.type === "salon")?.size ?? ""}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="product-table w-full">
                  <thead>
                    <tr>
                      <th className="w-16">No.</th>
                      <th className="w-24">Hình ảnh</th>
                      <th>Sản phẩm</th>
                      <th className="w-24">Size</th>
                      <th className="w-32 text-right">Đơn giá</th>
                      <th className="w-32 text-center">Số lượng</th>
                      <th className="w-32 text-right">Thành tiền</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-20 text-center text-muted-foreground">
                          Chưa có sản phẩm nào. Quay lại trang chủ để chọn sản phẩm.
                        </td>
                      </tr>
                    ) : (
                      items.map((it, i) => (
                        <tr key={`${it.product_no}-${it.size_type}`}>
                          <td className="text-center font-semibold">{String(i + 1).padStart(2, "0")}</td>
                          <td>
                            <div className="w-16 h-16 rounded bg-muted overflow-hidden border border-border mx-auto">
                              {it.image_url ? (
                                <img src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground font-bold">NO IMG</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="product-name">{it.product_name}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              #{it.product_no} · {it.size_type === "retail" ? "Dòng bán lẻ" : "Dòng chuyên nghiệp"}
                            </div>
                          </td>
                          <td className="text-center font-medium">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${it.size_type === "retail" ? "bg-blue-500/10 text-blue-600" : "bg-purple-500/10 text-purple-600"}`}>
                              {it.size}
                            </span>
                          </td>
                          <td className="text-right font-mono font-medium">{fmt(it.unit_price)}</td>
                          <td>
                            <div className="flex items-center justify-center">
                              <div className="flex items-center border border-border rounded overflow-hidden bg-background">
                                <button onClick={() => updateQty(i, it.quantity - 1)} className="w-8 h-8 flex items-center justify-center hover:bg-accent border-r border-border">-</button>
                                <input 
                                  type="number" 
                                  value={it.quantity} 
                                  onChange={(e) => updateQty(i, Number(e.target.value))}
                                  className="w-10 text-center text-xs font-bold bg-transparent focus:outline-none"
                                />
                                <button onClick={() => updateQty(i, it.quantity + 1)} className="w-8 h-8 flex items-center justify-center hover:bg-accent border-l border-border">+</button>
                              </div>
                            </div>
                          </td>
                          <td className="text-right font-mono font-bold text-primary">{fmt(it.unit_price * it.quantity)}</td>
                          <td className="text-center">
                            <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive p-1">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {items.length > 0 && (
                    <tfoot className="bg-muted/30 font-bold border-t-2 border-border">
                      <tr>
                        <td colSpan={6} className="text-right px-6 py-3 text-muted-foreground">Tạm tính (Chưa VAT)</td>
                        <td className="text-right px-6 py-3 font-mono">{fmt(subtotal)}</td>
                        <td></td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="text-right px-6 py-3">
                          <label className="inline-flex items-center gap-2 cursor-pointer group">
                            <span className="text-muted-foreground group-hover:text-foreground transition-colors">Tính VAT ({Math.round(vatRate * 100)}%)</span>
                            <div className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" className="sr-only peer" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} />
                              <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                            </div>
                          </label>
                        </td>
                        <td className="text-right px-6 py-3 font-mono text-orange-600">
                          {vatOn ? `+${fmt(vatAmount)}` : "0"}
                        </td>
                        <td></td>
                      </tr>
                      <tr className="bg-primary/5 text-primary">
                        <td colSpan={6} className="text-right px-6 py-4 text-lg">TỔNG CỘNG</td>
                        <td className="text-right px-6 py-4 font-mono text-2xl">{fmt(total)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="md:col-span-2 space-y-6">
              <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">2</div>
                  Thông tin giao hàng
                </h2>

                {/* Chọn khách hàng CRM để tự điền thông tin */}
                <div className="space-y-2 pb-3 border-b border-border/60">
                  <Label className="text-xs font-bold text-primary flex items-center gap-1.5">
                    🔗 Chọn khách hàng từ Mini CRM:
                  </Label>
                  <select
                    value={selectedCustomerId || ""}
                    onChange={(e) => {
                      const cid = e.target.value;
                      setSelectedCustomerId(cid || null);
                      if (cid) {
                        const found = customersList.find(c => c.id === cid);
                        if (found) {
                          setCustomerName(found.contact_name || found.name || "");
                          setCustomerPhone(found.phone || "");
                          setCustomerAddress([found.address, found.city || found.province].filter(Boolean).join(", "));
                          toast.success(`Đã liên kết đơn hàng với "${found.contact_name || found.name}"`);
                        }
                      }
                    }}
                    className="w-full h-9 px-3 bg-white border border-border rounded-md text-xs font-bold text-slate-800 shadow-2xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">-- Chọn khách hàng có sẵn hoặc điền tự do bên dưới --</option>
                    {customersList.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.contact_name || c.name} {c.facility_name ? `(${c.facility_name})` : ""} - {c.phone}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="c-name">Tên khách hàng *</Label>
                    <Input id="c-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nhập họ và tên" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="c-phone">Số điện thoại</Label>
                    <Input id="c-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="09xx..." />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-addr">Địa chỉ nhận hàng</Label>
                  <Input id="c-addr" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} placeholder="Số nhà, tên đường, phường/xã..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="c-note">Ghi chú đơn hàng</Label>
                  <Textarea id="c-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Yêu cầu đặc biệt..." />
                </div>
              </div>

              {/* Thông tin người báo giá (Quoter Info) */}
              <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">3</div>
                  Thông tin người lập báo giá
                </h2>
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Họ và tên</Label>
                    <p className="font-bold">{quoterName}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Số điện thoại</Label>
                    <p className="font-medium">{quoterPhone || "Chưa cập nhật"}</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">Email liên hệ</Label>
                    <p className="font-medium">{quoterEmail}</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase tracking-wider">QR Zalo</Label>
                    <div>
                      {quoterPhone ? (
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://zalo.me/${quoterPhone.replace(/\D/g, '')}`} 
                          alt="Zalo QR" 
                          className="w-16 h-16 rounded border border-border" 
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Cập nhật SĐT để có QR</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="bg-card border border-border rounded-lg p-6 shadow-md space-y-4 sticky top-24">
                <h2 className="font-bold">Tổng kết thanh toán</h2>
                <div className="space-y-3 pt-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tạm tính ({items.length} sp)</span>
                    <span className="font-mono">{fmt(subtotal)}</span>
                  </div>
                  <label className="flex items-center justify-between gap-2 p-2 rounded bg-muted/50 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} className="w-4 h-4 accent-primary" />
                      <span className="text-xs font-bold uppercase tracking-tight">Xuất hóa đơn VAT ({Math.round(vatRate * 100)}%)</span>
                    </div>
                  </label>
                  {vatOn && (
                    <div className="flex justify-between text-sm text-blue-600 font-medium">
                      <span>Thuế VAT ({Math.round(vatRate * 100)}%)</span>
                      <span className="font-mono">+{fmt(vatAmount)}</span>
                    </div>
                  )}
                  <div className="pt-4 border-t border-border flex justify-between items-end">
                    <span className="text-sm font-bold uppercase">Tổng cộng</span>
                    <span className="text-2xl font-bold text-primary font-mono">{fmt(total)}</span>
                  </div>
                </div>
                <div className="pt-4 space-y-3">
                  {!showPdf ? (
                    <button
                      type="button"
                      onClick={() => setShowPdf(true)}
                      disabled={items.length === 0}
                      className={`w-full py-4 font-bold uppercase tracking-wider border-2 border-primary text-primary hover:bg-primary/10 flex items-center justify-center gap-2 rounded-md transition-colors ${items.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <FileText className="w-4 h-4" />
                      CHUẨN BỊ FILE PDF BÁO GIÁ
                    </button>
                  ) : (
                    <PDFDownloadLink
                      document={
                        <CatalogPDF 
                          items={items} 
                          customerName={customerName} 
                          subtotal={subtotal} 
                          vatAmount={vatAmount} 
                          total={total} 
                          orderNo={items.length > 0 ? "TEMP-" + Date.now().toString().slice(-6) : "000"} 
                          quoterName={quoterName}
                          quoterEmail={quoterEmail}
                          quoterPhone={quoterPhone}
                          vatRate={vatRate}
                        />
                      }
                      fileName={`Bao_Gia_Desembre_${customerName || 'Khach'}.pdf`}
                      className="w-full inline-block cursor-pointer"
                    >
                      {({ loading: pdfLoading }) => (
                        <div 
                          className={`w-full py-4 font-bold uppercase tracking-wider bg-primary text-primary-foreground hover:opacity-90 flex items-center justify-center gap-2 rounded-md transition-colors`}
                        >
                          <FileText className="w-4 h-4" />
                          {pdfLoading ? "Đang dựng file PDF..." : "📥 TẢI XUỐNG PDF NGAY"}
                        </div>
                      )}
                    </PDFDownloadLink>
                  )}

                  <Button 
                    variant="ghost" 
                    className="w-full py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground" 
                    onClick={() => save("draft")} 
                    disabled={busy}
                  >
                    LƯU BẢN NHÁP
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed px-4">
                  Bằng cách nhấn xác nhận, bạn đồng ý với các điều khoản bán hàng của Desembre.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
