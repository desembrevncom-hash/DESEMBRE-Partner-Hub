import { Search, SlidersHorizontal, X, RotateCcw, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import type { CatalogBrand, CatalogCategory, CatalogViewMode } from "./types";
import { CatalogViewToggle } from "./CatalogViewToggle";

interface Props {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  brands: CatalogBrand[];
  selectedBrand: string;
  onSelectBrand: (brand: string) => void;
  categories: CatalogCategory[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  totalResults: number;
  isDrawerOpen: boolean;
  onToggleDrawer: (open: boolean) => void;
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
}

export function CatalogFilterBar({
  searchQuery,
  onSearchChange,
  brands,
  selectedBrand,
  onSelectBrand,
  categories,
  selectedCategory,
  onSelectCategory,
  hasActiveFilters,
  onClearFilters,
  totalResults,
  isDrawerOpen,
  onToggleDrawer,
  viewMode,
  onViewModeChange,
}: Props) {
  const activeCount =
    (searchQuery ? 1 : 0) +
    (selectedBrand !== "all" ? 1 : 0) +
    (selectedCategory !== "all" ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar + Mobile Filter Trigger */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
          <Input
            placeholder="Tìm theo tên sản phẩm, công dụng (Serum, Làm sạch, Mụn, Cấp ẩm...)"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-12 pl-11 pr-10 rounded-2xl bg-white border-slate-200/80 focus:border-indigo-500 shadow-sm text-sm placeholder:text-slate-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter Button */}
        <Button
          onClick={() => onToggleDrawer(true)}
          variant="outline"
          className="lg:hidden h-12 px-4 rounded-2xl border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs shrink-0 flex items-center gap-2 shadow-sm"
        >
          <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
          <span>Bộ lọc</span>
          {activeCount > 0 && (
            <Badge className="bg-indigo-600 text-white rounded-full px-1.5 py-0 text-[10px] font-black h-5">
              {activeCount}
            </Badge>
          )}
        </Button>

        {/* Desktop Clear Filters */}
        {hasActiveFilters && (
          <Button
            onClick={onClearFilters}
            variant="ghost"
            className="hidden lg:flex h-12 px-4 text-xs font-bold text-rose-500 hover:bg-rose-50 hover:text-rose-700 rounded-2xl shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Đặt lại
          </Button>
        )}

        {/* View Mode Toggle: Grid vs Table */}
        <CatalogViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
      </div>

      {/* Desktop Brand Chips */}
      {brands.length > 1 && (
        <div className="hidden lg:flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
            Thương hiệu:
          </span>
          <button
            onClick={() => onSelectBrand("all")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedBrand === "all"
                ? "bg-slate-900 text-white border-transparent shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            Tất cả
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              onClick={() => onSelectBrand(b.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                selectedBrand === b.id
                  ? "bg-slate-900 text-white border-transparent shadow-sm"
                  : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Desktop Category Chips */}
      <div className="hidden lg:flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider mr-1">
          Danh mục:
        </span>
        <button
          onClick={() => onSelectCategory("all")}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
            selectedCategory === "all"
              ? "bg-indigo-600 text-white border-transparent shadow-sm"
              : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50"
          }`}
        >
          Tất cả ({totalResults})
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectCategory(c.name)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
              selectedCategory === c.name
                ? "bg-indigo-600 text-white border-transparent shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/50"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Mobile Drawer (Sheet) */}
      <Sheet open={isDrawerOpen} onOpenChange={onToggleDrawer}>
        <SheetContent side="bottom" className="rounded-t-[32px] max-h-[85vh] p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b border-slate-100 text-left">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-black text-slate-900">
                Bộ lọc sản phẩm
              </SheetTitle>
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  className="text-xs font-bold text-rose-500 hover:text-rose-700"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            {/* Brand Filter (Mobile) */}
            {brands.length > 1 && (
              <div className="space-y-2.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                  Thương hiệu
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => onSelectBrand("all")}
                    className={`p-3 rounded-xl text-xs font-bold text-left border flex items-center justify-between ${
                      selectedBrand === "all"
                        ? "bg-slate-900 text-white border-transparent"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    <span>Tất cả thương hiệu</span>
                    {selectedBrand === "all" && <Check className="w-4 h-4" />}
                  </button>
                  {brands.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onSelectBrand(b.id)}
                      className={`p-3 rounded-xl text-xs font-bold text-left border flex items-center justify-between ${
                        selectedBrand === b.id
                          ? "bg-slate-900 text-white border-transparent"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <span>{b.name}</span>
                      {selectedBrand === b.id && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Category Filter (Mobile) */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                Danh mục sản phẩm
              </h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onSelectCategory("all")}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${
                    selectedCategory === "all"
                      ? "bg-indigo-600 text-white border-transparent"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  }`}
                >
                  Tất cả danh mục
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => onSelectCategory(c.name)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${
                      selectedCategory === c.name
                        ? "bg-indigo-600 text-white border-transparent"
                        : "bg-slate-50 border-slate-200 text-slate-700"
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SheetFooter className="p-4 border-t border-slate-100 bg-slate-50">
            <Button
              onClick={() => onToggleDrawer(false)}
              className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm"
            >
              Áp dụng ({totalResults} sản phẩm)
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
