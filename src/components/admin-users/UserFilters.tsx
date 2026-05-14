import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface UserFiltersProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  roleFilter: "all" | "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale";
  setRoleFilter: (val: "all" | "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale") => void;
}

export function UserFilters({
  searchQuery,
  setSearchQuery,
  roleFilter,
  setRoleFilter,
}: UserFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card border border-border rounded-lg p-3 shadow-sm overflow-x-auto">
      <div className="relative w-full sm:w-64 shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Tìm kiếm tên hoặc email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-xs"
        />
      </div>

      <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 shrink-0">
        <button
          onClick={() => setRoleFilter("all")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap ${
            roleFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => setRoleFilter("admin")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap ${
            roleFilter === "admin"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Admin
        </button>
        <button
          onClick={() => setRoleFilter("sub_admin")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap ${
            roleFilter === "sub_admin"
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Phó Admin
        </button>
        <button
          onClick={() => setRoleFilter("tele_lead")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap ${
            roleFilter === "tele_lead"
              ? "bg-amber-600 text-white shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Trưởng Tele
        </button>
        <button
          onClick={() => setRoleFilter("telesale")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap border ${
            roleFilter === "telesale"
              ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
              : "border-transparent bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          Telesale
        </button>
        <button
          onClick={() => setRoleFilter("sale")}
          className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all whitespace-nowrap ${
            roleFilter === "sale"
              ? "bg-green-600 text-white shadow-sm"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          }`}
        >
          SALE
        </button>
      </div>
    </div>
  );
}
