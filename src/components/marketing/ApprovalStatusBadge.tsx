import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Play, XCircle } from "lucide-react";

export function ApprovalStatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return (
      <Badge variant="outline" className="rounded-lg bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[11px] uppercase flex items-center gap-1">
        <CheckCircle2 className="w-3 h-3" /> Đã duyệt
      </Badge>
    );
  }
  if (status === "pending_review") {
    return (
      <Badge variant="outline" className="rounded-lg bg-blue-50 text-blue-600 border-blue-200 font-bold text-[11px] uppercase flex items-center gap-1">
        <Clock className="w-3 h-3" /> Chờ duyệt
      </Badge>
    );
  }
  if (status === "rejected") {
    return (
      <Badge variant="outline" className="rounded-lg bg-rose-50 text-rose-600 border-rose-200 font-bold text-[11px] uppercase flex items-center gap-1">
        <XCircle className="w-3 h-3" /> Từ chối
      </Badge>
    );
  }
  
  return (
    <Badge variant="outline" className="rounded-lg bg-slate-50 text-slate-600 border-slate-200 font-bold text-[11px] uppercase flex items-center gap-1">
      <Play className="w-3 h-3" /> Bản nháp
    </Badge>
  );
}
