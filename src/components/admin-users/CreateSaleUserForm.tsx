import { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface CreateSaleUserFormProps {
  onSuccessOptimistic: (user: { id: string; email: string; displayName: string; role?: "sale" | "sub_admin" }) => void;
  reload: () => Promise<void>;
  canCreateSubAdmin?: boolean;
}

export function CreateSaleUserForm({ onSuccessOptimistic, reload, canCreateSubAdmin }: CreateSaleUserFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [targetRole, setTargetRole] = useState<"sale" | "sub_admin">("sale");
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

    // Ủy thác trọn vẹn việc phân quyền atomic và tự sửa lỗi mồ côi (self-healing) cho Edge Function
    const { data, error } = await supabase.functions.invoke("create-sale-user", {
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

    if (data?.user?.recoveredOrphan) {
      toast.success(
        `Tài khoản email này đã tồn tại từ trước. Đã tự động khôi phục và liên kết chuẩn xác quyền ${targetRole.toUpperCase()}!`
      );
    } else {
      toast.success(`Đã tạo tài khoản ${targetRole === "sub_admin" ? "PHÓ ADMIN" : "SALE"}. Mật khẩu: 12345678`);
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

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <UserPlus className="w-5 h-5" />
          <h2 className="font-bold">
            Thêm nhân sự mới
          </h2>
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

          {canCreateSubAdmin && (
            <div className="space-y-2 pt-1 border-t border-border">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Vai trò gán cho tài khoản
              </Label>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <label
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                    targetRole === "sale"
                      ? "bg-green-600/10 border-green-600 text-green-600 dark:text-green-400"
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
                  <span>Nhân viên SALE</span>
                </label>

                <label
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer text-xs font-bold transition-all ${
                    targetRole === "sub_admin"
                      ? "bg-purple-600/10 border-purple-600 text-purple-600 dark:text-purple-400"
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
                  <span>Phó Admin</span>
                </label>
              </div>
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" className="w-full font-bold" disabled={creating}>
              {creating
                ? "Đang xử lý…"
                : `Tạo tài khoản ${targetRole === "sub_admin" ? "PHÓ ADMIN" : "SALE"}`}
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
          <span className="text-xs font-bold uppercase tracking-wider">Phân quyền</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {canCreateSubAdmin
            ? "Bạn là Quản trị viên gốc. Bạn có toàn quyền cấp phát hoặc liên kết tài khoản vào nhóm SALE hoặc PHÓ ADMIN tự động."
            : "Bạn là Phó Admin. Bạn được ủy quyền tạo tài khoản và phân bổ trực tiếp vào danh sách nhân viên SALE."}
        </p>
      </div>
    </div>
  );
}
