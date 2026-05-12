import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { signIn, user, loading, mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      if (mustChangePassword) {
        // Let's redirect to password update flow or homepage if custom handling exists
      }
      navigate({ to: "/" });
    }
  }, [user, loading, navigate, mustChangePassword]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) {
      toast.error(error === "Invalid login credentials" ? "Sai email hoặc mật khẩu" : error);
      return;
    }
    toast.success("Đăng nhập thành công");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm space-y-6 bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-center">Đăng nhập</h1>
          <p className="text-xs text-center text-muted-foreground">
            Hệ thống tự động nhận diện phân quyền tài khoản
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="name@example.com"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Mật khẩu</Label>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" className="w-full h-10 font-bold" disabled={busy}>
          {busy ? "Đang xử lý…" : "Đăng nhập hệ thống"}
        </Button>

        <div className="text-xs text-center text-muted-foreground">
          <Link to="/" className="hover:underline">← Về trang chủ</Link>
          <span className="mx-2">·</span>
          <Link to="/signup" className="hover:underline">Tạo tài khoản</Link>
        </div>
      </form>
    </div>
  );
}
