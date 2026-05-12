import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RotateCcw, Plus, Pencil, Trash2, Undo2, LogOut, ShoppingCart, Users, User, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, PRODUCTS } from "@/data/products";
import { formatCurrencyVND, getDisplayPrice } from "@/lib/pricing";
import type { Product, Category, ProductVariant } from "@/types/product";
import ProductImageCell from "@/components/ProductImageCell";
import ProductLinkCell from "@/components/ProductLinkCell";
import ProductEditDialog, { type ProductDialogInitial } from "@/components/ProductEditDialog";
import { EditUnlockProvider, useEditUnlock } from "@/hooks/useEditUnlock";
import { EditHistoryProvider, useEditHistory } from "@/hooks/useEditHistory";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveProductOverride, type OverrideRow } from "@/lib/saveOverride";
import { toast } from "sonner";
import { FullCatalogPDF } from "@/components/FullCatalogPDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Page,
});

const ALL = "ALL";

const VAT_RATE = 0.08;
type VatMode = "with" | "without";

function IndexInner({
  overrides,
  setOverrides,
}: {
  overrides: Record<number, OverrideRow>;
  setOverrides: React.Dispatch<React.SetStateAction<Record<number, OverrideRow>>>;
}) {
  const { unlocked } = useEditUnlock();
  const { user, isAdmin, isSale, signOut } = useAuth();
  const history = useEditHistory();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [section, setSection] = useState<string>(ALL);
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<ProductDialogInitial | null>(null);
  const [vatMode, setVatMode] = useState<VatMode>("without");

  const role = isAdmin ? "admin" : isSale ? "sale" : "user";

  const canOrder = true;
  type PickupItem = { no: number; sizeType: "retail" | "salon" };
  const PICKUP_KEY = "pickupCart";
  const [pickup, setPickup] = useState<PickupItem[]>([]);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PICKUP_KEY);
      if (raw) setPickup(JSON.parse(raw));
    } catch {/* ignore */}
  }, []);
  const savePickup = (next: PickupItem[]) => {
    setPickup(next);
    try { sessionStorage.setItem(PICKUP_KEY, JSON.stringify(next)); } catch {/* ignore */}
  };
  const isPicked = (no: number, st: "retail" | "salon") =>
    pickup.some((p) => p.no === no && p.sizeType === st);
  const togglePick = (no: number, st: "retail" | "salon") => {
    if (isPicked(no, st)) savePickup(pickup.filter((p) => !(p.no === no && p.sizeType === st)));
    else savePickup([...pickup, { no, sizeType: st }]);
  };
  const clearPickup = () => savePickup([]);
  const goCreateOrder = () => navigate({ to: "/orders/new" });

  const upsertOverride = useCallback(
    (row: OverrideRow, options?: { snapshotLabel?: string }) => {
      if (options?.snapshotLabel) {
        history.snapshot(row.no, overrides[row.no], options.snapshotLabel);
      }
      setOverrides((p) => ({ ...p, [row.no]: row }));
    },
    [history, overrides, setOverrides],
  );

  const [isSyncing, setIsSyncing] = useState(false);
  const syncToSupabase = async () => {
    const mockData = localStorage.getItem("mock_overrides");
    if (!mockData) {
      toast.error("Không có dữ liệu ảo để đồng bộ");
      return;
    }
    
    if (!confirm("Bạn có muốn đẩy toàn bộ dữ liệu đang có ở máy này lên Database thật không?")) return;

    setIsSyncing(true);
    try {
      const data = JSON.parse(mockData);
      let successCount = 0;
      for (const row of data) {
        const res = await saveProductOverride(row);
        if (res.ok) successCount++;
      }
      toast.success(`Đã đồng bộ thành công ${successCount} mục lên Database!`);
      // Sau khi đồng bộ xong, xoá mock để dùng data thật
      if (confirm("Đồng bộ xong! Bạn có muốn chuyển sang dùng dữ liệu thật từ Database không? (Sẽ xoá dữ liệu tạm thời ở máy này)")) {
        localStorage.removeItem("mock_overrides");
        localStorage.removeItem("mock_session");
        window.location.reload();
      }
    } catch (error) {
      toast.error("Lỗi đồng bộ: " + (error as Error).message);
    } finally {
      setIsSyncing(false);
    }
  };

  const setImage = useCallback(async (no: number, src: string | undefined) => {
    history.snapshot(no, overrides[no], `Ảnh #${String(no).padStart(2, "0")}`);
    setOverrides((p) => ({
      ...p,
      [no]: { ...(p[no] ?? { no, deleted: false, is_custom: false }), image_url: src ?? null },
    }));
  }, [history, overrides, setOverrides]);

  const setLink = useCallback(async (no: number, href: string | undefined) => {
    history.snapshot(no, overrides[no], `Liên kết #${String(no).padStart(2, "0")}`);
    setOverrides((p) => ({
      ...p,
      [no]: { ...(p[no] ?? { no, deleted: false, is_custom: false }), link_url: href ?? null },
    }));
  }, [history, overrides, setOverrides]);

  const merged: Product[] = useMemo(() => {
    const list: Product[] = [];
    for (const p of PRODUCTS) {
      const o = overrides[p.id];
      if (o?.deleted) continue;
      
      const mergedProduct = {
        ...p,
        name: o?.name ?? p.name,
        description: o?.desc ?? p.description,
        categoryId: o?.section ?? p.categoryId,
        linkUrl: o?.link_url ?? p.linkUrl,
        imageUrl: o?.image_url ?? p.imageUrl,
      };

      // Update variant prices if overrides exist
      if (o) {
        mergedProduct.variants = p.variants.map(v => {
          if (v.type === "retail" && o.retail_price !== null && o.retail_price !== undefined) {
            return { ...v, price: o.retail_price, size: o.retail_size ?? v.size };
          }
          if (v.type === "salon" && o.salon_price !== null && o.salon_price !== undefined) {
            return { ...v, price: o.salon_price, size: o.salon_size ?? v.size };
          }
          return v;
        });
      }
      
      list.push(mergedProduct);
    }

    // Add custom products from overrides
    for (const o of Object.values(overrides)) {
      if (!o.is_custom || o.deleted) continue;
      
      const variants: ProductVariant[] = [];
      if (o.retail_price != null) {
        variants.push({ id: `${o.no}-retail`, type: "retail", size: o.retail_size ?? "", price: o.retail_price });
      }
      if (o.salon_price != null) {
        variants.push({ id: `${o.no}-salon`, type: "salon", size: o.salon_size ?? "", price: o.salon_price });
      }

      list.push({
        id: o.no,
        name: o.name ?? "(Chưa có tên)",
        description: o.desc ?? "",
        categoryId: o.section ?? "OTHER",
        linkUrl: o.link_url ?? undefined,
        imageUrl: o.image_url ?? undefined,
        variants,
        isCustom: true
      });
    }
    return list;
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((p) => {
      const matchesSection = section === ALL || p.categoryId === section;
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      return matchesSection && matchesQuery;
    });
  }, [query, section, merged]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const p of filtered) {
      const arr = map.get(p.categoryId) ?? [];
      arr.push(p);
      map.set(p.categoryId, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const sectionTitles = useMemo(() => {
    const set = new Set<string>(CATEGORIES.map((s) => s.id));
    for (const o of Object.values(overrides)) if (o.section) set.add(o.section);
    return Array.from(set);
  }, [overrides]);

  const reset = () => {
    setQuery("");
    setSection(ALL);
  };

  const openCreate = useCallback(() => {
    setEditInitial({ section: section === ALL ? "" : section, name: "", desc: "" });
    setEditOpen(true);
  }, [section]);

  const openEdit = useCallback((p: Product) => {
    const retail = p.variants.find(v => v.type === "retail");
    const salon = p.variants.find(v => v.type === "salon");
    setEditInitial({
      no: p.id,
      section: p.categoryId,
      name: p.name,
      desc: p.description,
      retail_size: retail?.size ?? null,
      retail_price: retail?.price ?? null,
      salon_size: salon?.size ?? null,
      salon_price: salon?.price ?? null,
    });
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback(async (p: Product) => {
    if (!isAdmin) return toast.error("Cần đăng nhập ADMIN");
    if (!confirm(`Xoá sản phẩm "${p.name}"?`)) return;
    const prev = overrides[p.id];
    const isCustom = !!p.isCustom;
    if (isCustom) {
      const res = await saveProductOverride({ action: "hard_delete", no: p.id });
      if (!res.ok) return toast.error(res.error ?? "Xoá thất bại");
      history.snapshot(p.id, prev, `Xoá "${p.name}"`);
      setOverrides((prev2) => {
        const n = { ...prev2 };
        delete n[p.id];
        return n;
      });
    } else {
      const res = await saveProductOverride({ no: p.id, deleted: true });
      if (!res.ok || !res.row) return toast.error(res.error ?? "Xoá thất bại");
      upsertOverride(res.row, { snapshotLabel: `Xoá "${p.name}"` });
    }
    toast.success("Đã xoá — có thể hoàn tác");
  }, [isAdmin, overrides, history, setOverrides, upsertOverride]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border transition-all">
        <div className="container mx-auto px-4 md:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-sm">
              D
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">DESEMBRE Partner Hub</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Professional Pricing & Ordering System</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {history.canUndo && isAdmin && (
              <Button variant="outline" size="sm" onClick={() => history.undo()}>
                <Undo2 className="w-4 h-4" />
                Hoàn tác ({history.count})
              </Button>
            )}
            {(isSale || isAdmin) && (
              <>
                {/* {isAdmin && (
                  <PDFDownloadLink
                    document={<FullCatalogPDF products={filtered} />}
                    fileName={`Bang_Gia_Desembre_${new Date().toISOString().slice(0, 10)}.pdf`}
                    className="inline-block cursor-pointer"
                  >
                    {({ loading: pdfLoading }) => (
                      <div className="inline-flex h-8 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-3 text-xs font-medium text-primary shadow-sm hover:bg-primary/10 transition-colors">
                        <FileText className="w-4 h-4 mr-2" />
                        {pdfLoading ? "Đang tạo PDF..." : "XUẤT PDF BẢNG GIÁ"}
                      </div>
                    )}
                  </PDFDownloadLink>
                )} */}
                
                <Button asChild variant="outline" size="sm">
                  <Link to="/customers"><Users className="w-4 h-4 mr-2" /> Khách hàng</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/orders"><ShoppingCart className="w-4 h-4 mr-2" /> Đơn hàng</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/profile"><User className="w-4 h-4 mr-2" /> Profile</Link>
                </Button>
                {isAdmin && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/admin/users"><Users className="w-4 h-4" /> Người dùng</Link>
                  </Button>
                )}
              </>
            )}
            {isAdmin && (
              <Button 
                size="sm" 
                variant="destructive" 
                onClick={syncToSupabase} 
                disabled={isSyncing}
                className="animate-pulse"
              >
                <RotateCcw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? "Đang đồng bộ..." : "ĐỒNG BỘ DATABASE"}
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" onClick={openCreate}>
                <Plus className="w-4 h-4" /> Thêm
              </Button>
            )}
            {user ? (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
                <span className="text-xs">
                  <span className="font-semibold">{user.email}</span>
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                    {isAdmin ? "ADMIN" : isSale ? "SALE" : "USER"}
                  </span>
                </span>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to="/login">Đăng nhập</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 md:px-6 py-4 w-full">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sản phẩm…"
              className="pl-9"
            />
          </div>
          <Select value={section} onValueChange={setSection}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Tất cả nhóm</SelectItem>
              {sectionTitles.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={reset} title="Đặt lại">
            <RotateCcw className="w-4 h-4" />
          </Button>
          <div className="inline-flex rounded-md border border-border overflow-hidden ml-auto">
            <button
              type="button"
              onClick={() => setVatMode("without")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${vatMode === "without" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              Chưa VAT
            </button>
            <button
              type="button"
              onClick={() => setVatMode("with")}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-border ${vatMode === "with" ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
            >
              Đã VAT (+8%)
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Hiển thị <span className="font-semibold text-foreground">{filtered.length}</span> /{" "}
          {merged.length} sản phẩm
        </p>
      </section>

      <main className="container mx-auto px-4 md:px-6 pb-10 flex-1 w-full">
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="table-wrap">
            <table className="product-table">
              <thead>
                <tr>
                  <th rowSpan={2} style={{ width: "140px" }}>Section</th>
                  <th rowSpan={2} style={{ width: "60px" }}>No.</th>
                  <th rowSpan={2} style={{ width: "100px" }}>Hình ảnh</th>
                  <th rowSpan={2}>Product</th>
                  <th colSpan={2}>Retail size</th>
                  <th colSpan={2}>Salon size</th>
                  {canOrder && <th rowSpan={2} style={{ width: "110px" }}>Chọn</th>}
                  {unlocked && <th rowSpan={2} style={{ width: "90px" }}>Thao tác</th>}
                </tr>
                <tr>
                  <th style={{ width: "90px" }}>Size</th>
                  <th style={{ width: "140px" }}>{isSale && !isAdmin ? "Giá SALE (-40%)" : "Consumer (100%)"}{vatMode === "with" ? " · VAT" : ""}</th>
                  <th style={{ width: "90px" }}>Size</th>
                  <th style={{ width: "140px" }}>{isSale && !isAdmin ? "Giá SALE (-40%)" : "Consumer (100%)"}{vatMode === "with" ? " · VAT" : ""}</th>
                </tr>
              </thead>
              <tbody>
                {grouped.length === 0 && (
                  <tr>
                    <td colSpan={8 + (canOrder ? 1 : 0) + (unlocked ? 1 : 0)} className="text-center py-12 text-muted-foreground text-sm">
                      Không tìm thấy sản phẩm phù hợp.
                    </td>
                  </tr>
                )}
                {(() => {
                  let seq = 0;
                  return grouped.map(([categoryId, productsInCat]: [string, Product[]]) =>
                    productsInCat.map((p: Product, idx: number) => {
                      seq += 1;
                      const category = CATEGORIES.find((c) => c.id === categoryId);
                      const retail = p.variants.find((v: ProductVariant) => v.type === "retail");
                      const salon = p.variants.find((v: ProductVariant) => v.type === "salon");

                      return (
                        <tr key={p.id}>
                          {idx === 0 && (
                            <td rowSpan={productsInCat.length} className="section-cell">
                              <div>{category?.name ?? categoryId}</div>
                              {category?.nameVi && (
                                <div className="text-[11px] font-normal text-muted-foreground mt-1 normal-case tracking-normal">
                                  {category.nameVi}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="text-center font-semibold">
                            {String(seq).padStart(2, "0")}
                          </td>
                          <td className="overflow-visible">
                            <ProductImageCell
                              productNo={p.id}
                              src={p.imageUrl}
                              onChange={(src) => setImage(p.id, src)}
                            />
                          </td>
                          <td>
                            <div className="product-name">{p.name}</div>
                            <div className="product-desc">{p.description}</div>
                            {p.linkUrl && (
                              <div className="mt-1">
                                <ProductLinkCell
                                  productNo={p.id}
                                  href={p.linkUrl}
                                  onChange={(href) => setLink(p.id, href)}
                                />
                              </div>
                            )}
                          </td>
                          <td className="price-cell">{retail?.size ?? ""}</td>
                          <td className="price-cell">{formatCurrencyVND(getDisplayPrice(retail?.price, vatMode, role))}</td>
                          <td className="price-cell">{salon?.size ?? ""}</td>
                          <td className="price-cell">{formatCurrencyVND(getDisplayPrice(salon?.price, vatMode, role))}</td>
                          {canOrder && (
                            <td className="text-center">
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={!retail || retail.price === 0}
                                  onClick={() => togglePick(p.id, "retail")}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border ${isPicked(p.id, "retail") ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"} disabled:opacity-30 disabled:cursor-not-allowed`}
                                  title="Thêm Retail vào đơn"
                                >
                                  R{isPicked(p.id, "retail") ? " ✓" : ""}
                                </button>
                                <button
                                  type="button"
                                  disabled={!salon || salon.price === 0}
                                  onClick={() => togglePick(p.id, "salon")}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border ${isPicked(p.id, "salon") ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"} disabled:opacity-30 disabled:cursor-not-allowed`}
                                  title="Thêm Salon vào đơn"
                                >
                                  S{isPicked(p.id, "salon") ? " ✓" : ""}
                                </button>
                              </div>
                            </td>
                          )}
                          {unlocked && (
                            <td className="text-center">
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(p)}
                                  className="w-7 h-7 inline-flex items-center justify-center rounded border border-border hover:bg-accent"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(p)}
                                  className="w-7 h-7 inline-flex items-center justify-center rounded border border-border hover:bg-destructive/10 text-destructive"
                                  title="Xoá"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    }),
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ProductEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={editInitial}
        sectionOptions={sectionTitles}
        onSaved={(row) => upsertOverride(row, { snapshotLabel: `Sửa #${String(row.no).padStart(2, "0")}` })}
      />

      {canOrder && pickup.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-card border border-border shadow-lg rounded-full pl-5 pr-2 py-2 flex items-center gap-3">
          <span className="text-sm">
            Đã chọn <span className="font-bold text-primary">{pickup.length}</span> mục
          </span>
          <Button size="sm" onClick={goCreateOrder}>
            <ShoppingCart className="w-4 h-4" /> Tạo đơn
          </Button>
          <button
            type="button"
            onClick={clearPickup}
            className="w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground"
            title="Bỏ chọn tất cả"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function Page() {
  const [overrides, setOverrides] = useState<Record<number, OverrideRow>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasMockOverrides = localStorage.getItem("mock_overrides");
      const hasMockUsers = localStorage.getItem("mock_users");
      
      if (hasMockOverrides || hasMockUsers) {
        const mockData = JSON.parse(hasMockOverrides || "[]");
        if (cancelled) return;
        const map: Record<number, OverrideRow> = {};
        for (const r of mockData) map[r.no] = r as OverrideRow;
        setOverrides(map);
        return;
      }

      const { data, error } = await supabase.from("product_overrides").select("*");
      if (error || cancelled) return;
      const map: Record<number, OverrideRow> = {};
      for (const r of data ?? []) map[r.no] = r as OverrideRow;
      setOverrides(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyRestore = useCallback((no: number, row: OverrideRow | null) => {
    setOverrides((prev) => {
      const next = { ...prev };
      if (row === null) delete next[no];
      else next[no] = row;
      return next;
    });
  }, []);

  return (
    <EditUnlockProvider>
      <EditHistoryProvider applyRestore={applyRestore}>
        <IndexInner overrides={overrides} setOverrides={setOverrides} />
      </EditHistoryProvider>
    </EditUnlockProvider>
  );
}
