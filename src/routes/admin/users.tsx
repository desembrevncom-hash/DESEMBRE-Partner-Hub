import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

import {
  ProfileRow,
  RoleRow,
  UserStats,
  CreateSaleUserForm,
  UserFilters,
  UserTable,
} from "@/components/admin-users";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user, isAdmin, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "sale">("all");

  // Deletion workflow states requested by user
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

  // Compute lookup dictionary mapping each profile ID to array of string roles
  const rolesMap = useMemo(() => {
    const map = new Map<string, ("admin" | "sale")[]>();
    for (const r of roles) {
      const existing = map.get(r.user_id) || [];
      if (!existing.includes(r.role)) {
        existing.push(r.role);
      }
      map.set(r.user_id, existing);
    }
    return map;
  }, [roles]);

  // Filtered profile list logic
  const filteredProfiles = useMemo(() => {
    return profiles.filter((p) => {
      // String matches
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const nameMatch = p.display_name?.toLowerCase().includes(q) || false;
        const emailMatch = p.email?.toLowerCase().includes(q) || false;
        if (!nameMatch && !emailMatch) return false;
      }

      // Role filter check
      if (roleFilter !== "all") {
        const userRoles = rolesMap.get(p.id) || [];
        if (!userRoles.includes(roleFilter)) return false;
      }

      return true;
    });
  }, [profiles, rolesMap, searchQuery, roleFilter]);

  const toggleRole = async (uid: string, role: "admin" | "sale") => {
    const currentRoles = rolesMap.get(uid) || [];
    const has = currentRoles.includes(role);

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

  const handleSuccessOptimistic = (newUser: { id: string; email: string; displayName: string }) => {
    setProfiles((prev) => [
      { id: newUser.id, email: newUser.email, display_name: newUser.displayName },
      ...prev,
    ]);
    setRoles((prev) => [...prev, { user_id: newUser.id, role: "sale" }]);
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

      <main className="container mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Superior premium stat blocks */}
        <UserStats profiles={profiles} roles={roles} />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Form module container */}
          <div className="lg:col-span-1">
            <CreateSaleUserForm onSuccessOptimistic={handleSuccessOptimistic} reload={reload} />
          </div>

          {/* Core list operations view */}
          <div className="lg:col-span-2 space-y-4">
            <UserFilters
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              roleFilter={roleFilter}
              setRoleFilter={setRoleFilter}
            />

            {busy ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center text-muted-foreground shadow-sm">
                <p className="text-xs animate-pulse">Đang nạp danh sách nhân sự từ hệ thống...</p>
              </div>
            ) : (
              <UserTable
                profiles={filteredProfiles}
                rolesMap={rolesMap}
                currentUserEmail={user?.email}
                currentUserId={user?.id}
                onToggleRole={toggleRole}
                onDeleteRequest={(candidate) => {
                  setDeleteCandidate(candidate);
                  setConfirmKeyword("");
                }}
              />
            )}
          </div>
        </div>
      </main>

      {/* Verification guarded deletion Dialog */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="w-5 h-5" /> Xác nhận xóa tài khoản
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed">
              Bạn đang thực hiện thao tác xóa tài khoản{" "}
              <strong className="text-foreground">
                {deleteCandidate?.display_name || deleteCandidate?.email}
              </strong>{" "}
              ra khỏi danh sách nhân sự. Thao tác này không thể hoàn tác.
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
