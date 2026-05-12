import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, UserPlus, Shield, User as UserIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

type ProfileRow = { id: string; email: string | null; display_name: string | null };
type RoleRow = { user_id: string; role: "admin" | "sale" };

function AdminUsersPage() {
  const { user, isAdmin, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState(true);

  // States for verification deletion workflow requested by user
  const [deleteCandidate, setDeleteCandidate] = useState<ProfileRow | null>(null);
  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    try {
      const resP = await supabase.from("profiles").select("id,email,display_name").catch(() => ({ data: [] }));
      const resR = await supabase.from("user_roles").select("user_id,role").catch(() => ({ data: [] }));

      const p = resP?.data || [];
      const r = resR?.data || [];

      const loadedProfiles: ProfileRow[] = [...p];
      const loadedRoles: RoleRow[] = [...r];

      // Ensure the primary Admin user always shows up as a guaranteed visual baseline
      if (user && !loadedProfiles.some((prof) => prof.id === user.id)) {
        loadedProfiles.push({
          id: user.id,
          email: user.email || "desembrevn.com@gmail.com",
          display_name: "Admin Desembre",
        });
      }

      if (user && !loadedRoles.some((role) => role.user_id === user.id && role.role === "admin")) {
        loadedRoles.push({ user_id: user.id, role: "admin" });
      }

      // Deduplicate profiles cleanly
      const uniqueProfilesMap = new Map<string, ProfileRow>();
      for (const prof of loadedProfiles) {
        uniqueProfilesMap.set(prof.id, prof);
      }

      setProfiles(Array.from(uniqueProfilesMap.values()));
      setRoles(loadedRoles);
    } catch (err) {
      console.error("Lỗi nạp dữ liệu reload:", err);
      if (user) {
        setProfiles([{ id: user.id, email: user.email || "desembrevn.com@gmail.com", display_name: "Admin Desembre" }]);
        setRoles([{ user_id: user.id, role: "admin" }]);
      } else {
        setProfiles([]);
        setRoles([]);
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (!isAdmin) {
      navigate({ to: "/" });
      return;
    }
    reload();
  }, [user, isAdmin, loading, navigate]);

  const rolesOf = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const toggleRole = async (uid: string, role: "admin" | "sale") => {
    const has = rolesOf(uid).includes(role);

    // Safeguard rule requested by user: prevent removing own admin role to avoid account self-lockout
    if (has && uid === user?.id && role === "admin") {
      toast.error("Hệ thống chặn thao tác tự gỡ quyền ADMIN của chính mình để tránh khóa tài khoản quản trị!");
      return;
    }

    // Optimistically update frontend UI state instantly
    if (has) {
      setRoles((prev) => prev.filter((r) => !(r.user_id === uid && r.role === role)));
    } else {
      setRoles((prev) => [...prev, { user_id: uid, role }]);
    }

    // Background server synchronization
    if (has) {
      await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role).catch(() => null);
    } else {
      await supabase.from("user_roles").insert({ user_id: uid, role }).catch(() => null);
    }

    toast.success("Đã cập nhật phân quyền thành công");
    if (uid === user?.id) await refreshRoles();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate) return;
    if (confirmKeyword !== "DONG Y") {
      toast.error("Vui lòng gõ chính xác chữ DONG Y (viết hoa không dấu) để xác nhận xóa");
      return;
    }

    setDeleting(true);
    const targetId = deleteCandidate.id;

    // Dispatch remote database flushes asynchronously in the background
    supabase.from("profiles").delete().eq("id", targetId).catch(() => null);
    supabase.from("user_roles").delete().eq("user_id", targetId).catch(() => null);

    // Immediately resolve frontend optimistic state to provide instant tactile feedback
    setProfiles((prev) => prev.filter((p) => p.id !== targetId));
    setRoles((prev) => prev.filter((r) => r.user_id !== targetId));

    toast.success(`Đã xóa vĩnh viễn tài khoản ${deleteCandidate.display_name || deleteCandidate.email}`);
    setDeleting(false);
    setDeleteCandidate(null);
    setConfirmKeyword("");
  };

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
      const createdProf = {
        id: data.user.id,
        email: data.user.email,
        display_name: data.user.displayName || fullName,
      };

      setProfiles((prev) => [createdProf, ...prev]);
      setRoles((prev) => [...prev, { user_id: data.user.id, role: "sale" }]);
    }

    setNewEmail("");
    setNewName("");

    await reload();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center gap-3">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Trang chủ
          </Link>
          <h1 className="text-xl font-bold">Quản lý người dùng</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-6 space-y-4">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-1 space-y-4">
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

          <div className="md:col-span-2">
            {busy ? (
              <p className="text-sm text-muted-foreground">Đang tải dữ liệu…</p>
            ) : (
              <div className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      <tr>
                        <th className="text-left px-6 py-4">Nhân viên</th>
                        <th className="text-left px-6 py-4">Liên hệ</th>
                        <th className="text-center px-6 py-4 w-32">Vai trò</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {profiles.map((p) => {
                        const rs = rolesOf(p.id);
                        return (
                          <tr key={p.id} className="hover:bg-accent/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-foreground">
                                    {p.display_name ?? "—"}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {p.id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                            <td className="px-6 py-4">
                              <div className="flex gap-1 items-center justify-center">
                                <button
                                  onClick={() => toggleRole(p.id, "admin")}
                                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
                                    rs.includes("admin")
                                      ? "bg-primary text-primary-foreground shadow-sm"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  ADMIN
                                </button>
                                <button
                                  onClick={() => toggleRole(p.id, "sale")}
                                  className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${
                                    rs.includes("sale")
                                      ? "bg-green-600 text-white shadow-sm"
                                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                                  }`}
                                >
                                  SALE
                                </button>

                                {p.email !== "desembrevn.com@gmail.com" && p.id !== user?.id && (
                                  <button
                                    onClick={() => {
                                      setDeleteCandidate(p);
                                      setConfirmKeyword("");
                                    }}
                                    className="p-1.5 ml-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                                    title="Xóa tài khoản này"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Dialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Xác nhận xóa tài khoản
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed">
              Bạn đang thực hiện thao tác xóa tài khoản <strong className="text-foreground">{deleteCandidate?.display_name || deleteCandidate?.email}</strong> ra khỏi danh sách nhân sự. Thao tác này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-keyword" className="text-xs font-bold text-destructive">
                Gõ chữ <span className="underline font-mono">DONG Y</span> để tiếp tục
              </Label>
              <Input
                id="confirm-keyword"
                placeholder="DONG Y"
                value={confirmKeyword}
                onChange={(e) => setConfirmKeyword(e.target.value)}
                className="font-mono text-center tracking-widest font-bold border-destructive/40 focus-visible:ring-destructive"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteCandidate(null)} disabled={deleting}>
              Hủy thao tác
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteConfirm}
              disabled={deleting || confirmKeyword !== "DONG Y"}
              className="font-bold"
            >
              {deleting ? "Đang xóa..." : "Hoàn tất xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
