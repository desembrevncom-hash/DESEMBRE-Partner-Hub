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
import { sections, flatProducts, type FlatProduct } from "@/data/desembreProducts";
import ProductImageCell from "@/components/ProductImageCell";
import ProductLinkCell from "@/components/ProductLinkCell";
import ProductEditDialog, { type ProductDialogInitial } from "@/components/ProductEditDialog";
import { EditUnlockProvider, useEditUnlock } from "@/hooks/useEditUnlock";
import { EditHistoryProvider, useEditHistory } from "@/hooks/useEditHistory";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { saveProductOverride, type OverrideRow } from "@/lib/saveOverride";
import { toast } from "sonner";
import { PRODUCT_DEFAULTS } from "@/data/productDefaults";
import { FullCatalogPDF } from "@/components/FullCatalogPDF";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { FileText } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Page,
});

const ALL = "ALL";

const defaultOverride = (no: number): OverrideRow => ({
  no,
  image_url: null,
  link_url: null,
  section: null,
  name: null,
  desc: null,
  retail_size: null,
  retail_price: null,
  salon_size: null,
  salon_price: null,
  deleted: false,
  is_custom: false,
});

const formatPrice = (n: number | null | undefined) => {
  if (n == null) return "";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
};

const VAT_RATE = 0.08;
type VatMode = "without" | "with";
const applyVat = (n: number | null | undefined, mode: VatMode) => {
  if (n == null) return null;
  return mode === "with" ? n * (1 + VAT_RATE) : n;
};

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

  const SALE_DISCOUNT = 0.4;
  const applyDiscount = (n: number | null | undefined) => {
    if (n == null) return null;
    return isSale && !isAdmin ? n * (1 - SALE_DISCOUNT) : n;
  };

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

  const setImage = async (no: number, src: string | undefined) => {
    history.snapshot(no, overrides[no], `Ảnh #${String(no).padStart(2, "0")}`);
    setOverrides((p) => ({
      ...p,
      [no]: { ...(p[no] ?? defaultOverride(no)), image_url: src ?? null },
    }));
  };

  const setLink = async (no: number, href: string | undefined) => {
    history.snapshot(no, overrides[no], `Liên kết #${String(no).padStart(2, "0")}`);
    setOverrides((p) => ({
      ...p,
      [no]: { ...(p[no] ?? defaultOverride(no)), link_url: href ?? null },
    }));
  };

  const merged: FlatProduct[] = useMemo(() => {
    const list: FlatProduct[] = [];
    for (const p of flatProducts) {
      const o = overrides[p.no];
      if (o?.deleted) continue;
      list.push({
        ...p,
        name: o?.name ?? p.name,
        desc: o?.desc ?? p.desc,
        section: o?.section ?? p.section,
        link: o?.link_url ?? p.link,
      });
    }
    for (const o of Object.values(overrides)) {
      if (!o.is_custom || o.deleted) continue;
      const sec = sections.find((s) => s.title === (o.section ?? ""));
      list.push({
        no: o.no,
        name: o.name ?? "(Chưa có tên)",
        desc: o.desc ?? "",
        section: o.section ?? "OTHER",
        sectionVi: sec?.vi,
        link: o.link_url ?? undefined,
      });
    }
    return list;
  }, [overrides]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((p) => {
      const matchesSection = section === ALL || p.section === section;
      const matchesQuery =
        !q || p.name.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q);
      return matchesSection && matchesQuery;
    });
  }, [query, section, merged]);

  const grouped = useMemo(() => {
    const map = new Map<string, FlatProduct[]>();
    for (const p of filtered) {
      const arr = map.get(p.section) ?? [];
      arr.push(p);
      map.set(p.section, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const sectionTitles = useMemo(() => {
    const set = new Set<string>(sections.map((s) => s.title));
    for (const o of Object.values(overrides)) if (o.section) set.add(o.section);
    return Array.from(set);
  }, [overrides]);

  const reset = () => {
    setQuery("");
    setSection(ALL);
  };

  const openCreate = () => {
    setEditInitial({ section: section === ALL ? "" : section, name: "", desc: "" });
    setEditOpen(true);
  };

  const openEdit = (p: FlatProduct) => {
    const o = overrides[p.no];
    setEditInitial({
      no: p.no,
      section: p.section,
      name: p.name,
      desc: p.desc,
      retail_size: o?.retail_size ?? null,
      retail_price: o?.retail_price ?? null,
      salon_size: o?.salon_size ?? null,
      salon_price: o?.salon_price ?? null,
    });
    setEditOpen(true);
  };

  const handleDelete = async (p: FlatProduct) => {
    if (!isAdmin) return toast.error("Cần đăng nhập ADMIN");
    if (!confirm(`Xoá sản phẩm "${p.name}"?`)) return;
    const prev = overrides[p.no];
    const isCustom = !!prev?.is_custom;
    if (isCustom) {
      const res = await saveProductOverride({ action: "hard_delete", no: p.no });
      if (!res.ok) return toast.error(res.error ?? "Xoá thất bại");
      history.snapshot(p.no, prev, `Xoá "${p.name}"`);
      setOverrides((prev2) => {
        const n = { ...prev2 };
        delete n[p.no];
        return n;
      });
    } else {
      const res = await saveProductOverride({ no: p.no, deleted: true });
      if (!res.ok || !res.row) return toast.error(res.error ?? "Xoá thất bại");
      upsertOverride(res.row, { snapshotLabel: `Xoá "${p.name}"` });
    }
    toast.success("Đã xoá — có thể hoàn tác");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-wide">DESEMBRE Partner Hub</h1>
            <p className="text-xs text-muted-foreground mt-1">Professional Pricing & Ordering System</p>
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
                {isAdmin && (
                  <PDFDownloadLink
                    document={<FullCatalogPDF products={filtered} overrides={overrides} />}
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
                )}
                
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
                  return grouped.map(([sectionTitle, rows]) =>
                    rows.map((row, idx) => {
                      seq += 1;
                      const sec = sections.find((s) => s.title === sectionTitle);
                      const dbOverride = overrides[row.no];
                      const defaultOverrideData = PRODUCT_DEFAULTS[row.no];
                      const o = { ...defaultOverrideData, ...dbOverride } as OverrideRow;

                      return (
                        <tr key={row.no}>
                          {idx === 0 && (
                            <td rowSpan={rows.length} className="section-cell">
                              <div>{sectionTitle}</div>
                              {sec?.vi && (
                                <div className="text-[11px] font-normal text-muted-foreground mt-1 normal-case tracking-normal">
                                  {sec.vi}
                                </div>
                              )}
                            </td>
                          )}
                          <td className="text-center font-semibold">
                            {String(seq).padStart(2, "0")}
                          </td>
                          <td className="overflow-visible">
                            <ProductImageCell
                              productNo={row.no}
                              src={o?.image_url ?? undefined}
                              onChange={(src) => setImage(row.no, src)}
                            />
                          </td>
                          <td>
                            <div className="product-name">{row.name}</div>
                            <div className="product-desc">{row.desc}</div>
                            {row.link && (
                              <div className="mt-1">
                                <ProductLinkCell
                                  productNo={row.no}
                                  href={row.link}
                                  onChange={(href) => setLink(row.no, href)}
                                />
                              </div>
                            )}
                          </td>
                          <td className="price-cell">{o?.retail_size ?? ""}</td>
                          <td className="price-cell">{formatPrice(applyVat(applyDiscount(o?.retail_price), vatMode))}</td>
                          <td className="price-cell">{o?.salon_size ?? ""}</td>
                          <td className="price-cell">{formatPrice(applyVat(applyDiscount(o?.salon_price), vatMode))}</td>
                          {canOrder && (
                            <td className="text-center">
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  disabled={o?.retail_price == null}
                                  onClick={() => togglePick(row.no, "retail")}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border ${isPicked(row.no, "retail") ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"} disabled:opacity-30 disabled:cursor-not-allowed`}
                                  title="Thêm Retail vào đơn"
                                >
                                  R{isPicked(row.no, "retail") ? " ✓" : ""}
                                </button>
                                <button
                                  type="button"
                                  disabled={o?.salon_price == null}
                                  onClick={() => togglePick(row.no, "salon")}
                                  className={`text-[10px] font-bold px-2 py-1 rounded border ${isPicked(row.no, "salon") ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"} disabled:opacity-30 disabled:cursor-not-allowed`}
                                  title="Thêm Salon vào đơn"
                                >
                                  S{isPicked(row.no, "salon") ? " ✓" : ""}
                                </button>
                              </div>
                            </td>
                          )}
                          {unlocked && (
                            <td className="text-center">
                              <div className="inline-flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => openEdit(row)}
                                  className="w-7 h-7 inline-flex items-center justify-center rounded border border-border hover:bg-accent"
                                  title="Chỉnh sửa"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDelete(row)}
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
