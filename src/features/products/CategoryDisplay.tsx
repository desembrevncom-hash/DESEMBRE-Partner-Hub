/**
 * CategoryDisplay — Tasks 5 & 6
 *
 * Task 6: When brand = "all" in DB mode, show ALL dbCategories instead of empty.
 *         When a brand is selected, show only that brand's categories.
 * Task 5: Category name fix lives in ProductRow/ProductMobileCard (badge label).
 */
import { Filter } from "lucide-react";
import { CRMCard } from "@/components/crm/CRMCard";

interface CategoryItem {
  id: string;
  name: string;
  slug?: string;
  brand_id?: string;
}

interface Props {
  isUsingDbCatalogData: boolean;
  selectedBrandFilter: string;
  dbBrands: { id: string; name: string }[];
  activeCategoriesToDisplay: CategoryItem[];
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  isCategoryExpanded: boolean;
  setIsCategoryExpanded: (val: boolean) => void;
}

export function CategoryDisplay({
  isUsingDbCatalogData,
  selectedBrandFilter,
  dbBrands,
  activeCategoriesToDisplay,
  categoryFilter,
  setCategoryFilter,
  isCategoryExpanded,
  setIsCategoryExpanded,
}: Props) {
  const brandName =
    selectedBrandFilter !== "all"
      ? (dbBrands.find((b) => b.id === selectedBrandFilter)?.name ?? "thương hiệu")
      : null;

  const subtitle =
    selectedBrandFilter === "all"
      ? isUsingDbCatalogData
        ? "Đang hiển thị tất cả danh mục. Chọn một thương hiệu để lọc."
        : "Chọn danh mục để lọc sản phẩm."
      : `Danh mục của ${brandName}`;

  const visibleCategories = isCategoryExpanded
    ? activeCategoriesToDisplay
    : activeCategoriesToDisplay.slice(0, 10);

  return (
    <CRMCard className="p-4 lg:p-5 border-slate-200 bg-white">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div>
            <h4 className="text-sm font-bold text-slate-900">Danh mục sản phẩm</h4>
            <p className="text-[11px] font-medium text-slate-500">{subtitle}</p>
          </div>
        </div>

        {activeCategoriesToDisplay.length === 0 && selectedBrandFilter !== "all" ? (
          <div className="text-xs text-slate-500 italic mt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
            Thương hiệu này chưa có danh mục.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border
                ${categoryFilter === "all" ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"}`}
            >
              Tất cả sản phẩm
            </button>
            {visibleCategories.map((cat) => {
              const filterValue = isUsingDbCatalogData ? cat.slug || cat.id : cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(filterValue)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm border
                    ${categoryFilter === filterValue ? "bg-indigo-600 text-white border-transparent" : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50"}`}
                >
                  {cat.name}
                </button>
              );
            })}
            {activeCategoriesToDisplay.length > 10 && (
              <button
                onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                {isCategoryExpanded
                  ? "Thu gọn"
                  : `Xem thêm danh mục (+${activeCategoriesToDisplay.length - 10})`}
              </button>
            )}
          </div>
        )}
      </div>
    </CRMCard>
  );
}
