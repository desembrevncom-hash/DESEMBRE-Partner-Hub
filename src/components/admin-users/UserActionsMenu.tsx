import { Trash2 } from "lucide-react";

interface UserActionsMenuProps {
  userId: string;
  userEmail: string | null;
  currentRoles: ("admin" | "sub_admin" | "sale" | "tele_lead" | "telesale")[];
  currentUserEmail?: string | null;
  currentUserId?: string;
  onToggleRole: (
    uid: string,
    role: "admin" | "sub_admin" | "sale" | "tele_lead" | "telesale",
  ) => Promise<void>;
  onDeleteRequest: () => void;
  canCreateSubAdmin?: boolean;
}

export function UserActionsMenu({
  userId,
  userEmail,
  currentRoles,
  currentUserId,
  onToggleRole,
  onDeleteRequest,
  canCreateSubAdmin,
}: UserActionsMenuProps) {
  const isAdmin = currentRoles.includes("admin");
  const isSubAdmin = currentRoles.includes("sub_admin");
  const isSale = currentRoles.includes("sale");
  const isTeleLead = currentRoles.includes("tele_lead");
  const isTelesale = currentRoles.includes("telesale");

  const isPrimary = userEmail === "desembrevn.com@gmail.com";
  const isSelf = userId === currentUserId;

  // Nếu người dùng hiện tại chỉ là Phó Admin (không có canCreateSubAdmin), ẩn hoàn toàn các thao tác phân quyền cấp cao
  const canManageSuperiorRoles = !!canCreateSubAdmin;

  // Phó Admin không được quyền xóa tài khoản Admin gốc hoặc Phó Admin khác
  const isTargetSuperior = isAdmin || isSubAdmin;
  const canDelete = !isPrimary && !isSelf && (canManageSuperiorRoles || !isTargetSuperior);

  return (
    <div className="flex items-center gap-1.5 justify-end flex-wrap">
      {canManageSuperiorRoles && (
        <>
          <button
            onClick={() => onToggleRole(userId, "admin")}
            className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${
              isAdmin
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            ADMIN
          </button>

          <button
            onClick={() => onToggleRole(userId, "sub_admin")}
            className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${
              isSubAdmin
                ? "bg-purple-600 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            PHÓ ADMIN
          </button>
        </>
      )}

      <button
        onClick={() => onToggleRole(userId, "tele_lead")}
        className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${
          isTeleLead
            ? "bg-amber-600 text-white shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        TRƯỞNG TELE
      </button>

      <button
        onClick={() => onToggleRole(userId, "telesale")}
        className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all border ${
          isTelesale
            ? "bg-amber-100 text-amber-900 border-amber-300 shadow-2xs"
            : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        TELESALE
      </button>

      <button
        onClick={() => onToggleRole(userId, "sale")}
        className={`px-2 py-1 text-[9px] sm:text-[10px] font-bold rounded transition-all ${
          isSale
            ? "bg-green-600 text-white shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
      >
        SALE
      </button>

      {canDelete && (
        <button
          onClick={onDeleteRequest}
          className="p-1.5 ml-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
          title="Xóa tài khoản này"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
