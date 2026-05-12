import { Trash2 } from "lucide-react";

interface UserActionsMenuProps {
  userId: string;
  userEmail: string | null;
  currentRoles: ("admin" | "sale")[];
  currentUserEmail?: string | null;
  currentUserId?: string;
  onToggleRole: (uid: string, role: "admin" | "sale") => Promise<void>;
  onDeleteRequest: () => void;
}

export function UserActionsMenu({
  userId,
  userEmail,
  currentRoles,
  currentUserId,
  onToggleRole,
  onDeleteRequest,
}: UserActionsMenuProps) {
  const isAdmin = currentRoles.includes("admin");
  const isSale = currentRoles.includes("sale");

  const isPrimary = userEmail === "desembrevn.com@gmail.com";
  const isSelf = userId === currentUserId;

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        onClick={() => onToggleRole(userId, "admin")}
        className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
          isAdmin
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        ADMIN
      </button>

      <button
        onClick={() => onToggleRole(userId, "sale")}
        className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
          isSale
            ? "bg-green-600 text-white shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        SALE
      </button>

      {!isPrimary && !isSelf && (
        <button
          onClick={onDeleteRequest}
          className="p-1.5 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
          title="Xóa tài khoản này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
