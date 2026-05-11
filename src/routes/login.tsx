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
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("desembrevn.com@gmail.com");
  const [password, setPassword] = useState("12345678");
  const [mode, setMode] = useState<"admin" | "sale">("admin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await signIn(email.trim(), mode === "admin" ? password : undefined);
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
        className="w-full max-w-sm space-y-4 bg-card border border-border rounded-lg p-6 shadow-sm"
      >
        <div className="space-y-4">
          <h1 className="text-2xl font-bold text-center">Đăng nhập</h1>
          
          <div className="flex p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => { setMode("admin"); setEmail("desembrevn.com@gmail.com"); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "admin" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              ADMIN
            </button>
            <button
              type="button"
              onClick={() => { setMode("sale"); setEmail(""); }}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${mode === "sale" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              SALE
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder={mode === "admin" ? "admin@desembrevn.com" : "sale@desembrevn.com"}
          />
        </div>

        {mode === "admin" && (
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
            />
          </div>
        )}

        <Button type="submit" className="w-full h-10" disabled={busy}>
          {busy ? "Đang đăng nhập…" : mode === "admin" ? "Đăng nhập Admin" : "Đăng nhập Sale"}
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
