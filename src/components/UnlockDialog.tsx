import { Lock } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUnlocked?: () => void;
};

const UnlockDialog = ({ open, onOpenChange }: Props) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-card border border-border rounded-xl shadow-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 inline-flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight">Cần đăng nhập ADMIN</h2>
            <p className="text-xs text-muted-foreground">
              Chỉ tài khoản ADMIN mới có quyền sửa sản phẩm
            </p>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="h-10 px-4 rounded-md border border-border text-sm hover:bg-muted/50"
          >
            Huỷ
          </button>
          <Link
            to="/login"
            className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center"
          >
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
};

export default UnlockDialog;
