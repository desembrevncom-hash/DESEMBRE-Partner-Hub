import { User as UserIcon } from "lucide-react";
import { ProfileRow } from "./types";
import { UserStatusBadge } from "./UserStatusBadge";
import { UserRoleBadge } from "./UserRoleBadge";
import { UserActionsMenu } from "./UserActionsMenu";

interface UserRowProps {
  profile: ProfileRow;
  roles: ("admin" | "sub_admin" | "sale")[];
  currentUserEmail?: string | null;
  currentUserId?: string;
  onToggleRole: (uid: string, role: "admin" | "sub_admin" | "sale") => Promise<void>;
  onDeleteRequest: (candidate: ProfileRow) => void;
  canCreateSubAdmin?: boolean;
}

export function UserRow({
  profile,
  roles,
  currentUserEmail,
  currentUserId,
  onToggleRole,
  onDeleteRequest,
  canCreateSubAdmin,
}: UserRowProps) {
  return (
    <tr className="hover:bg-accent/5 transition-colors group">
      <td className="px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <UserIcon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-foreground truncate text-xs sm:text-sm">
              {profile.display_name || "—"}
            </div>
            <div className="text-[10px] text-muted-foreground font-mono">
              ID: {profile.id.slice(0, 8)}...
            </div>
          </div>
        </div>
      </td>

      <td className="px-4 py-3.5 sm:px-6 text-xs text-muted-foreground truncate max-w-[150px] sm:max-w-none">
        {profile.email || "—"}
      </td>

      <td className="px-4 py-3.5 sm:px-6 hidden md:table-cell">
        <UserStatusBadge />
      </td>

      <td className="px-4 py-3.5 sm:px-6 hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {roles.map((r) => (
            <UserRoleBadge key={r} role={r} />
          ))}
          {roles.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Chưa phân quyền</span>
          )}
        </div>
      </td>

      <td className="px-4 py-3.5 sm:px-6 text-right">
        <UserActionsMenu
          userId={profile.id}
          userEmail={profile.email}
          currentRoles={roles}
          currentUserEmail={currentUserEmail}
          currentUserId={currentUserId}
          onToggleRole={onToggleRole}
          onDeleteRequest={() => onDeleteRequest(profile)}
          canCreateSubAdmin={canCreateSubAdmin}
        />
      </td>
    </tr>
  );
}
