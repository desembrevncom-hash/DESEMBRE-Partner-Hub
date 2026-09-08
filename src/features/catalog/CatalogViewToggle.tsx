import { LayoutGrid, TableProperties } from "lucide-react";
import type { CatalogViewMode } from "./types";

interface Props {
  viewMode: CatalogViewMode;
  onViewModeChange: (mode: CatalogViewMode) => void;
  className?: string;
}

export function CatalogViewToggle({ viewMode, onViewModeChange, className = "" }: Props) {
  return (
    <div
      role="group"
      aria-label="Chế độ hiển thị"
      className={`min-h-[44px] inline-flex items-center bg-slate-100/90 p-1 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-3xs shrink-0 ${className}`}
    >
      <button
        type="button"
        onClick={() => onViewModeChange("grid")}
        className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
          viewMode === "grid"
            ? "bg-white text-indigo-700 shadow-sm font-black"
            : "text-slate-500 hover:text-slate-900"
        }`}
        title="Chế độ hiển thị dạng lưới"
      >
        <LayoutGrid className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">Dạng lưới</span>
      </button>

      <button
        type="button"
        onClick={() => onViewModeChange("table")}
        className={`min-h-[36px] flex items-center justify-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-lg sm:rounded-xl text-xs font-bold transition-all cursor-pointer ${
          viewMode === "table"
            ? "bg-white text-indigo-700 shadow-sm font-black"
            : "text-slate-500 hover:text-slate-900"
        }`}
        title="Chế độ hiển thị dạng bảng"
      >
        <TableProperties className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        <span className="hidden sm:inline">Dạng bảng</span>
      </button>
    </div>
  );
}
