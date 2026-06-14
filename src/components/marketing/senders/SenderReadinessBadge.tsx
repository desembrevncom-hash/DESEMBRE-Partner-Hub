import { Badge } from "@/components/ui/badge";

interface SenderReadinessBadgeProps {
  status: string | null;
}

export function SenderReadinessBadge({ status }: SenderReadinessBadgeProps) {
  switch (status) {
    case "ready":
      return <Badge className="bg-emerald-500 hover:bg-emerald-600">Sẵn sàng (Ready)</Badge>;
    case "needs_review":
      return <Badge className="bg-amber-500 hover:bg-amber-600">Cần kiểm tra (Needs Review)</Badge>;
    case "not_configured":
      return <Badge variant="secondary" className="text-slate-600">Chưa cấu hình (Not Configured)</Badge>;
    case "disabled":
      return <Badge variant="destructive">Đã vô hiệu (Disabled)</Badge>;
    default:
      return <Badge variant="outline">Không xác định</Badge>;
  }
}
