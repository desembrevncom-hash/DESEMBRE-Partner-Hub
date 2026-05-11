import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Plus, UserPlus, Shield, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  const reload = async () => {
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("id,email,display_name"),
      supabase.from("user_roles").select("user_id,role"),
    ]);
    
    let allProfiles = (p ?? []) as ProfileRow[];
    let allRoles = (r ?? []) as RoleRow[];

    // Merge Mock Data
    const mockUsers = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
    
    // Sync real DB users to mock storage for passwordless login
    let updatedMockUsers = [...mockUsers];
    let updatedMockRoles = [...mockRoles];
    
    allProfiles.forEach(ap => {
      if (!updatedMockUsers.find(mu => mu.email === ap.email)) {
        updatedMockUsers.push({ id: ap.id, email: ap.email, display_name: ap.display_name });
      }
    });
    
    allRoles.forEach(ar => {
      if (!updatedMockRoles.find(mr => mr.user_id === ar.user_id && mr.role === ar.role)) {
        updatedMockRoles.push(ar);
      }
    });
    
    localStorage.setItem("mock_users", JSON.stringify(updatedMockUsers));
    localStorage.setItem("mock_roles", JSON.stringify(updatedMockRoles));

    // For display, merge any mock-only users
    const uniqueMockOnly = updatedMockUsers.filter((mu: any) => !allProfiles.find(ap => ap.email === mu.email));
    allProfiles = [...allProfiles, ...uniqueMockOnly];
    allRoles = [...allRoles, ...updatedMockRoles];

    setProfiles(allProfiles);
    setRoles(allRoles);
    setBusy(false);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate({ to: "/login" }); return; }
    if (!isAdmin) { navigate({ to: "/" }); return; }
    reload();
  }, [user, isAdmin, loading, navigate]);

  const rolesOf = (uid: string) => roles.filter((r) => r.user_id === uid).map((r) => r.role);

  const toggleRole = async (uid: string, role: "admin" | "sale") => {
    const isMock = uid.includes("-") && !profiles.find(p => p.id === uid && !p.id.includes("-")); 
    // Actually, simpler check: if it's in localStorage, it's mock
    const mockUsers = JSON.parse(localStorage.getItem("mock_users") || "[]");
    const isMockUser = mockUsers.find((u: any) => u.id === uid);

    const has = rolesOf(uid).includes(role);

    if (isMockUser) {
      let mockRoles = JSON.parse(localStorage.getItem("mock_roles") || "[]");
      if (has) {
        mockRoles = mockRoles.filter((r: any) => !(r.user_id === uid && r.role === role));
      } else {
        mockRoles.push({ user_id: uid, role });
      }
      localStorage.setItem("mock_roles", JSON.stringify(mockRoles));
    } else {
      if (has) {
        const { error } = await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
        if (error) return toast.error(error.message);
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: uid, role });
        if (error) return toast.error(error.message);
      }
    }

    toast.success("Đã cập nhật quyền");
    await reload();
    if (uid === user?.id) await refreshRoles();
  };

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const { signUp, signOut } = useAuth();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;
    setCreating(true);
    const { error } = await signUp(newEmail, "12345678", newName);
    setCreating(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("Đã tạo người dùng mới (Mật khẩu mặc định: 12345678)");
      setNewEmail("");
      setNewName("");
      await reload();
    }
  };

  const impersonate = async (p: ProfileRow) => {
    const sess = { 
      ...MOCK_SESSION, 
      user: { 
        ...MOCK_USER, 
        id: p.id, 
        email: p.email || "", 
        user_metadata: { display_name: p.display_name || p.email } 
      } 
    } as any;
    
    localStorage.setItem("mock_session", JSON.stringify(sess));
    toast.success(`Đang đăng nhập dưới quyền: ${p.display_name || p.email}`);
    window.location.href = "/";
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
                <h2 className="font-bold">Thêm nhân viên mới</h2>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Tên hiển thị</Label>
                  <Input 
                    id="new-name" 
                    placeholder="VD: Nguyễn Văn A" 
                    value={newName} 
                    onChange={e => setNewName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input 
                    id="new-email" 
                    type="email" 
                    placeholder="sale@desembrevn.com" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="pt-2">
                  <Button type="submit" className="w-full" disabled={creating}>
                    {creating ? "Đang tạo..." : "Tạo tài khoản SALE"}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center italic">
                  * Mật khẩu mặc định cho nhân viên mới là: 12345678
                </p>
              </form>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Shield className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Thông tin</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tài khoản mới tạo sẽ có vai trò <strong>SALE</strong> mặc định. Bạn có thể nâng cấp lên <strong>ADMIN</strong> bằng cách nhấn nút trong danh sách.
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            {busy ? (
              <p className="text-sm text-muted-foreground">Đang tải…</p>
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
                        const isMock = p.id.includes("-"); // Simple check for mock UUID
                        return (
                          <tr key={p.id} className="hover:bg-accent/5 transition-colors">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                  <UserIcon className="w-4 h-4" />
                                </div>
                                <div>
                                  <div className="font-bold text-foreground flex items-center gap-2">
                                    {p.display_name ?? "—"}
                                    {isMock && (
                                      <span className="text-[9px] px-1 bg-yellow-500/10 text-yellow-600 rounded">
                                        LOCAL
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground font-mono">
                                    {p.id.slice(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-muted-foreground">{p.email}</td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5 items-center">
                                <div className="flex gap-1 w-full">
                                  <button
                                    onClick={() => toggleRole(p.id, "admin")}
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${
                                      rs.includes("admin")
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    }`}
                                  >
                                    ADMIN
                                  </button>
                                  <button
                                    onClick={() => toggleRole(p.id, "sale")}
                                    className={`flex-1 text-[10px] font-bold py-1 rounded transition-all ${
                                      rs.includes("sale")
                                        ? "bg-green-600 text-white"
                                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    }`}
                                  >
                                    SALE
                                  </button>
                                </div>
                                <button 
                                  onClick={() => impersonate(p)}
                                  className="w-full text-[9px] font-bold py-1 rounded bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-all border border-orange-500/20"
                                >
                                  ĐĂNG NHẬP NHANH
                                </button>
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
    </div>
  );
}
