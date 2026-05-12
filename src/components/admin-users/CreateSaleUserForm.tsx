import { useState } from "react";
import { UserPlus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface CreateSaleUserFormProps {
  onSuccessOptimistic: (user: { id: string; email: string; displayName: string }) => void;
  reload: () => Promise<void>;
}

export function CreateSaleUserForm({ onSuccessOptimistic, reload }: CreateSaleUserFormProps) {
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
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

    const { data, error } = await supabase.functions.invoke("create-sale-user", {
      body: {
        email,
        fullName,
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

      if (
        message.toLowerCase().includes("already been registered") ||
        message.toLowerCase().includes("already exists")
      ) {
        const { data: existingProf } = await supabase
          .from("profiles")
          .select("id,display_name")
          .eq("email", email)
          .maybeSingle();

        const targetId = existingProf?.id;
        if (targetId) {
          await supabase.from("user_roles").insert({ user_id: targetId, role: "sale" }).catch(() => null);
          toast.success("Tài khoản email này đã tồn tại. Đã tự động liên kết vào danh sách nhân viên SALE!");
          setNewEmail("");
          setNewName("");
          await reload();
          return;
        } else {
          toast.error(
            "Email này đã tồn tại trong hệ thống Auth nhưng chưa có hồ sơ Profile. Vui lòng liên hệ Admin để cấp quyền."
          );
          return;
        }
      }

      toast.error(message || "Không thể tạo tài khoản SALE");
      return;
    }

    if (data?.error) {
      toast.error(data.error);
      return;
    }

    toast.success("Đã tạo tài khoản SALE. Mật khẩu mặc định: 12345678");

    if (data?.user) {
      onSuccessOptimistic({
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || fullName,
      });
    }

    setNewEmail("");
    setNewName("");

    await reload();
  };

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-primary">
          <UserPlus className="w-5 h-5" />
          <h2 className="font-bold">Thêm nhân viên SALE</h2>
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
              placeholder="sale@example.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <div className="pt-2">
            <Button type="submit" className="w-full font-bold" disabled={creating}>
              {creating ? "Đang tạo tài khoản…" : "Tạo tài khoản SALE"}
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
          <span className="text-xs font-bold uppercase tracking-wider">Bảo mật</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Tài khoản được cấp quyền qua luồng bảo mật trực tiếp ở tầng server. Mọi tài khoản mới mặc định thuộc nhóm <strong>SALE</strong>.
        </p>
      </div>
    </div>
  );
}
