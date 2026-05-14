import { Users, ShieldCheck, UserCheck, ShieldAlert, Headset } from "lucide-react";
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
  const subAdminCount = profiles.filter((p) =>
    roles.some((r) => r.user_id === p.id && r.role === "sub_admin")
  ).length;
  const saleCount = profiles.filter((p) =>
    roles.some((r) => r.user_id === p.id && r.role === "sale")
  ).length;
  const telesaleCount = profiles.filter((p) =>
    roles.some((r) => r.user_id === p.id && r.role === "telesale")
  ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Tổng nhân sự
          </p>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalUsers}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Users className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Admin
          </p>
          <p className="text-xl sm:text-2xl font-bold text-primary">{adminCount}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Phó Admin
          </p>
          <p className="text-xl sm:text-2xl font-bold text-purple-600 dark:text-purple-400">
            {subAdminCount}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Nhân viên Telesale
          </p>
          <p className="text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400">
            {telesaleCount}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
          <Headset className="w-5 h-5" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
        <div className="space-y-1">
          <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Nhân viên SALE
          </p>
          <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
            {saleCount}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0">
          <UserCheck className="w-5 h-5" />
        </div>
      </div>
    </div>
  );
}
