/**
 * ProductPagination — Task 3
 * Real client-side pagination footer.
 * 20 products per page, PREV/NEXT with disabled state, compact page pills.
 */
import { Button } from "@/components/ui/button";

interface Props {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
  onPageChange?: (page: number) => void;
}

export function ProductPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
  onPageChange,
}: Props) {
  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  /** Compute visible page numbers: show at most 5 pills around current page */
  const pagePills = (): (number | "…")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pills: (number | "…")[] = [1];
    const left = Math.max(2, currentPage - 2);
    const right = Math.min(totalPages - 1, currentPage + 2);

    if (left > 2) pills.push("…");
    for (let p = left; p <= right; p++) pills.push(p);
    if (right < totalPages - 1) pills.push("…");
    pills.push(totalPages);
    return pills;
  };

  if (totalItems === 0) {
    return (
      <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Không có sản phẩm nào
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 border-t border-slate-50 bg-slate-50/50 flex items-center justify-between gap-4 flex-wrap">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        Hiển thị{" "}
        <span className="text-slate-900">
          {startItem}–{endItem}
        </span>{" "}
        / {totalItems} sản phẩm
      </p>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={currentPage <= 1}
          className="text-[10px] font-black text-slate-500 disabled:opacity-40 h-8 px-3"
        >
          PREV
        </Button>

        <div className="flex items-center gap-1">
          {pagePills().map((pill, i) =>
            pill === "…" ? (
              <span key={`ellipsis-${i}`} className="w-6 text-center text-xs text-slate-400">
                …
              </span>
            ) : (
              <button
                key={pill}
                onClick={() => onPageChange?.(pill)}
                disabled={pill === currentPage}
                className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${
                  pill === currentPage
                    ? "bg-indigo-600 text-white shadow-sm cursor-default"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-900 cursor-pointer"
                }`}
              >
                {pill}
              </button>
            ),
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          className="text-[10px] font-black text-slate-500 disabled:opacity-40 h-8 px-3"
        >
          NEXT
        </Button>
      </div>
    </div>
  );
}
