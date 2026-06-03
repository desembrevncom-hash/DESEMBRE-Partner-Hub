import { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface CreateSaleUserFormProps {
  onSuccessOptimistic: (user: {
    id: string;
    email: string;
    displayName: string;
    role?: "sale" | "sub_admin" | "tele_lead" | "telesale";
  }) => void;
  reload: () => Promise<void>;
  canCreateSubAdmin?: boolean;
}

export function CreateSaleUserForm({
  onSuccessOptimistic,
  reload,
  canCreateSubAdmin,
}: CreateSaleUserFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [targetRole, setTargetRole] = useState<"sale" | "sub_admin" | "tele_lead" | "telesale">(
    "sale",
  );
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const email = newEmail.trim().toLowerCase();
    const fullName = newName.trim();

    if (!email || !fullName) {
      toast.error("Vui lòng nhập tên và email");
      return;
    }

    setCreating(true);

    // Tối ưu hóa: Ưu tiên gọi create-staff-user cho luồng nhân viên mới, bảo lưu create-sale-user cho luồng Phó Admin
    const targetFunction = targetRole === "sub_admin" ? "create-sale-user" : "create-staff-user";
    const { data, error } = await supabase.functions.invoke(targetFunction, {
      body: {
        email,
        fullName,
        role: targetRole,
      },
    });

    setCreating(false);

    if (error) {
      let message = error.message;
      if (error instanceof FunctionsHttpError) {
        try {
          const errBody = await error.context.json();
          message = errBody?.error || message;
        } catch {
          /* ignore */
        }
      }

      toast.error(message || "Không thể tạo tài khoản nhân sự");
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    const roleNameDisplay =
      targetRole === "sub_admin"
        ? "PHÓ ADMIN"
        : targetRole === "tele_lead"
          ? "TRƯỞNG TELE"
          : targetRole === "telesale"
            ? "TELESALE"
            : "SALE";

    if (data?.user?.recoveredOrphan) {
      toast.success(
        `Tài khoản email này đã tồn tại từ trước. Đã tự động khôi phục và liên kết chuẩn xác quyền ${roleNameDisplay}!`,
      );
    } else {
      toast.success(`Đã tạo tài khoản ${roleNameDisplay}. Mật khẩu: 12345678`);
    }

    if (data?.user) {
      onSuccessOptimistic({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || fullName,
        role: targetRole,
      });
    }

    setNewEmail("");
    setNewName("");
    setTargetRole("sale");

    await reload();
  };

  const getRoleLabel = () => {
    if (targetRole === "sub_admin") return "PHÓ ADMIN";
    if (targetRole === "tele_lead") return "TRƯỞNG TELE";
    if (targetRole === "telesale") return "TELESALE";
    return "SALE";
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <UserPlus className="w-5 h-5" />
          <h2 className="font-bold">Thêm nhân sự mới</h2>
        </div>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-name">Tên hiển thị</Label>
            <Input
              id="new-name"
              placeholder="VD: Nguyễn Văn A"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="nhansu@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2 pt-1 border-t border-border">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Vai trò gán cho tài khoản
            </Label>
            <div className="grid grid-cols-1 gap-2 pt-1">
              <label
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                  targetRole === "sale"
                    ? "bg-indigo-600/10 border-indigo-600 text-indigo-600"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="targetRole"
                  value="sale"
                  checked={targetRole === "sale"}
                  onChange={() => setTargetRole("sale")}
                  className="sr-only"
                />
                <span>👤 SALE</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                  targetRole === "tele_lead"
                    ? "bg-amber-600/10 border-amber-600 text-amber-600"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="targetRole"
                  value="tele_lead"
                  checked={targetRole === "tele_lead"}
                  onChange={() => setTargetRole("tele_lead")}
                  className="sr-only"
                />
                <span>🎧 TRƯỞNG TELE</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                  targetRole === "telesale"
                    ? "bg-orange-600/10 border-orange-600 text-orange-600"
                    : "border-border text-muted-foreground hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="targetRole"
                  value="telesale"
                  checked={targetRole === "telesale"}
                  onChange={() => setTargetRole("telesale")}
                  className="sr-only"
                />
                <span>📞 TELESALE</span>
              </label>

              {canCreateSubAdmin && (
                <label
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                    targetRole === "sub_admin"
                      ? "bg-purple-600/10 border-purple-600 text-purple-600"
                      : "border-border text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="targetRole"
                    value="sub_admin"
                    checked={targetRole === "sub_admin"}
                    onChange={() => setTargetRole("sub_admin")}
                    className="sr-only"
                  />
                  <span>👑 PHÓ ADMIN</span>
                </label>
              )}
            </div>
          </div>

          <div className="pt-2">
            <Button type="submit" className="w-full font-bold" disabled={creating}>
              {creating ? "Đang xử lý…" : `Tạo tài khoản ${getRoleLabel()}`}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center italic">
            * Mật khẩu mặc định: 12345678 (Bắt buộc đổi khi đăng nhập lần đầu)
          </p>
        </form>
      </div>

      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
          <Shield className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Quy mô quản lý</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {canCreateSubAdmin
            ? "Bạn là Quản trị viên gốc. Bạn có toàn quyền cấp phát tài khoản vào các nhóm SALE, TRƯỞNG TELE, TELESALE hoặc PHÓ ADMIN."
            : "Bạn là Phó Admin. Bạn được quyền tạo và quản lý tài khoản nhân sự thuộc phễu SALE Thị trường và khối TELE trực tuyến."}
        </p>
      </div>
    </div>
  );
}
