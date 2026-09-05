import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  hasMore: boolean;
  onLoadMore: () => void;
  currentCount: number;
  totalCount: number;
}

export function CatalogLoadMore({ hasMore, onLoadMore, currentCount, totalCount }: Props) {
  if (totalCount === 0) return null;

  return (
    <div className="pt-8 pb-4 flex flex-col items-center justify-center gap-3 text-center">
      <div className="text-xs text-slate-500 font-medium">
        Đang hiển thị <span className="font-bold text-slate-900">{currentCount}</span> trên tổng số{" "}
        <span className="font-bold text-slate-900">{totalCount}</span> sản phẩm
      </div>

      {hasMore ? (
        <Button
          onClick={onLoadMore}
          variant="outline"
          className="h-11 px-8 rounded-2xl bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-300 text-indigo-700 font-bold text-xs shadow-sm hover:shadow-md transition-all cursor-pointer group"
        >
          <span>Xem thêm sản phẩm</span>
          <ChevronDown className="w-4 h-4 ml-2 text-indigo-500 group-hover:translate-y-0.5 transition-transform" />
        </Button>
      ) : (
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider py-2">
          Đã hiển thị toàn bộ {totalCount} sản phẩm
        </div>
      )}
    </div>
  );
}
