import { ProfileRow, RoleRow } from "./types";
import { UserRow } from "./UserRow";

interface UserTableProps {
  profiles: ProfileRow[];
  rolesMap: Map<string, ("admin" | "sale")[]>;
  currentUserEmail?: string | null;
  currentUserId?: string;
  onToggleRole: (uid: string, role: "admin" | "sale") => Promise<void>;
  onDeleteRequest: (candidate: ProfileRow) => void;
}

export function UserTable({
  profiles,
  rolesMap,
  currentUserEmail,
  currentUserId,
  onToggleRole,
  onDeleteRequest,
}: UserTableProps) {
  if (profiles.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground shadow-sm">
        <p className="text-xs">Không tìm thấy tài khoản nhân viên nào khớp với bộ lọc.</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead className="bg-muted/40 text-[10px] sm:text-xs uppercase tracking-wider text-muted-foreground font-bold border-b border-border">
            <tr>
              <th className="px-4 py-3 sm:px-6">Nhân viên</th>
              <th className="px-4 py-3 sm:px-6">Liên hệ</th>
              <th className="px-4 py-3 sm:px-6 hidden md:table-cell">Trạng thái</th>
              <th className="px-4 py-3 sm:px-6 hidden sm:table-cell">Vai trò</th>
              <th className="px-4 py-3 sm:px-6 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-xs sm:text-sm">
            {profiles.map((p) => (
              <UserRow
                key={p.id}
                profile={p}
                roles={rolesMap.get(p.id) || []}
                currentUserEmail={currentUserEmail}
                currentUserId={currentUserId}
                onToggleRole={onToggleRole}
                onDeleteRequest={onDeleteRequest}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
