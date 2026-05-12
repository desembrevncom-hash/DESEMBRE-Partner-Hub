import { Users, ShieldCheck, UserCheck } from "lucide-react";
import { ProfileRow, RoleRow } from "./types";

interface UserStatsProps {
  profiles: ProfileRow[];
  roles: RoleRow[];
}

export function UserStats({ profiles, roles }: UserStatsProps) {
  const totalUsers = profiles.length;
  const adminCount = profiles.filter((p) =>
    roles.some((r) => r.user_id === p.id && r.role === "admin")
  ).length;
  const saleCount = profiles.filter((p) =>
    roles.some((r) => r.user_id === p.id && r.role === "sale")
  ).length;

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tổng nhân sự
          </p>
          <p className="text-2xl font-bold text-foreground">{totalUsers}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <Users className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Quản trị viên
          </p>
          <p className="text-2xl font-bold text-primary">{adminCount}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Nhân viên SALE
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {saleCount}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400">
          <UserCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
