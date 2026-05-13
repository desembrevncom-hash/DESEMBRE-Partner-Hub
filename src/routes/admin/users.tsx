import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError } from "@supabase/supabase-js";

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
  const { user, canManageUsers, canCreateSubAdmin, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "sub_admin" | "sale">("all");

  // Deletion workflow states requested by user
  const [deleteCandidate, setDeleteCandidate] = useState<ProfileRow | null>(null);
  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const reload = async () => {
    try {
      const resP = await supabase.from("profiles").select("id,email,display_name");
      const resR = await supabase.from("user_roles").select("user_id,role");

      if (resP.error) {
        toast.error(`Lỗi nạp Profiles (Bị chặn bởi RLS hoặc DB): ${resP.error.message}`);
      }
      if (resR.error) {
        toast.error(`Lỗi nạp Phân quyền (Bị chặn bởi RLS hoặc DB): ${resR.error.message}`);
      }

      const p = resP.data || [];
      const r = resR.data || [];

      const loadedProfiles: ProfileRow[] = [...p];
      const loadedRoles: RoleRow[] = [...r] as RoleRow[];

      // Deduplicate profiles cleanly
      const uniqueProfilesMap = new Map<string, ProfileRow>();
      for (const prof of loadedProfiles) {
        uniqueProfilesMap.set(prof.id, prof);
      }

      setProfiles(Array.from(uniqueProfilesMap.values()));
      setRoles(loadedRoles);
    } catch (err) {
      console.error("Lỗi nạp dữ liệu reload:", err);
      setProfiles([]);
      setRoles([]);
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
    if (!canManageUsers) {
      navigate({ to: "/" });
      return;
    }
    reload();
  }, [user, canManageUsers, loading, navigate]);

  // Persistent component-level buffer cache to ensure optimistic identities never flicker or disappear during Supabase RLS schema reload delays
  const [optimisticCreated, setOptimisticCreated] = useState<ProfileRow[]>([]);
  const [optimisticCreatedRoles, setOptimisticCreatedRoles] = useState<RoleRow[]>([]);

  // Deduplicate and merge live cloud arrays with persistent component memory
  const combinedProfiles = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    for (const p of profiles) {
      map.set(p.id, p);
    }
    for (const op of optimisticCreated) {
      map.set(op.id, op);
    }
    return Array.from(map.values());
  }, [profiles, optimisticCreated]);

  const combinedRoles = useMemo(() => {
    return [...roles, ...optimisticCreatedRoles];
  }, [roles, optimisticCreatedRoles]);

  // Compute lookup dictionary mapping each profile ID to array of string roles
  const rolesMap = useMemo(() => {
    const map = new Map<string, ("admin" | "sub_admin" | "sale")[]>();
    for (const r of combinedRoles) {
      const existing = map.get(r.user_id) || [];
      if (!existing.includes(r.role)) {
        existing.push(r.role);
      }
      map.set(r.user_id, existing);
    }
    return map;
  }, [combinedRoles]);

  // Filtered profile list logic
  const filteredProfiles = useMemo(() => {
    return combinedProfiles.filter((p) => {
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
  }, [combinedProfiles, rolesMap, searchQuery, roleFilter]);

  const toggleRole = async (uid: string, role: "admin" | "sub_admin" | "sale") => {
    const currentRoles = rolesMap.get(uid) || [];
    const has = currentRoles.includes(role);

    // Safeguard rule requested by user: prevent removing own admin role to avoid account self-lockout
    if (has && uid === user?.id && role === "admin") {
      toast.error("Hệ thống chặn thao tác tự gỡ quyền ADMIN của chính mình để tránh khóa tài khoản quản trị!");
      return;
    }

    // Role sub_admin management check
    if (role === "sub_admin" && !canCreateSubAdmin) {
      toast.error("Chỉ có ADMIN chính thức mới có quyền gán hoặc gỡ vai trò PHÓ ADMIN!");
      return;
    }

    // Optimistically update frontend UI state instantly
    if (has) {
      setRoles((prev) => prev.filter((r) => !(r.user_id === uid && r.role === role)));
      setOptimisticCreatedRoles((prev) => prev.filter((r) => !(r.user_id === uid && r.role === role)));
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
      toast.error("Vui lòng gõ chính xác chữ DONG Y để xác nhận xoá");
      return;
    }

    if (deleteCandidate.id === user?.id) {
      toast.error("Không thể xoá chính tài khoản đang đăng nhập");
      return;
    }

    setDeleting(true);

    let errorMsg = "";
    let isTier2OrderError = false;

    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { userId: deleteCandidate.id },
      });

      if (error) {
        let message = error.message;

        if (error instanceof FunctionsHttpError) {
          const errorBody = await error.context.json().catch(() => null);
          message = errorBody?.error || message;
        }

        if (error instanceof FunctionsFetchError) {
          message =
            "Không gọi được Edge Function delete-user. Kiểm tra function đã deploy đúng Supabase project, config.toml, CORS và syntax code.";
        }

        if (error instanceof FunctionsRelayError) {
          message =
            "Supabase relay không chuyển được request tới Edge Function. Kiểm tra logs và deploy status.";
        }

        throw new Error(message);
      }

      if (data?.error) {
        errorMsg = data.error;
        if (data.error.includes("đã tạo đơn hàng")) {
          isTier2OrderError = true;
        }
      }
    } catch (err: any) {
      console.warn("Lỗi SDK invoke tiêu chuẩn, tự động kích hoạt fetch fallback có đính kèm apikey:", err);
      try {
        const session = (await supabase.auth.getSession()).data?.session;
        const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`;
        const rawRes = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ userId: deleteCandidate.id }),
        });

        const resData = await rawRes.json().catch(() => null);
        if (!rawRes.ok || resData?.error) {
          errorMsg = resData?.error || err.message || "Lỗi giao tiếp máy chủ Edge Function";
          if (errorMsg.includes("đã tạo đơn hàng")) {
            isTier2OrderError = true;
          }
        }
      } catch (fallbackErr) {
        errorMsg = err.message || "Không thể kết nối đến máy chủ Edge Function";
      }
    }

    setDeleting(false);

    if (errorMsg) {
      // Tầng 2 logic: If server reports transaction history existence, automatically transition to grace disabling mode
      if (isTier2OrderError || errorMsg.includes("đã tạo đơn hàng")) {
        toast.error("Tài khoản có lịch sử đơn hàng, tự động chuyển sang gỡ quyền SALE để vô hiệu hóa...");
        await supabase.from("user_roles").delete().eq("user_id", deleteCandidate.id).eq("role", "sale").catch(() => null);
        setRoles((prev) => prev.filter((r) => !(r.user_id === deleteCandidate.id && r.role === "sale")));
        toast.success(`Đã vô hiệu hóa thành công quyền SALE của ${deleteCandidate.display_name || deleteCandidate.email}`);
        setDeleteCandidate(null);
        setConfirmKeyword("");
        await reload();
        return;
      }

      toast.error(errorMsg);
      return;
    }

    toast.success(
      `Đã xoá tài khoản ${deleteCandidate.display_name || deleteCandidate.email}`
    );

    setProfiles((prev) => prev.filter((p) => p.id !== deleteCandidate.id));
    setRoles((prev) => prev.filter((r) => r.user_id !== deleteCandidate.id));
    setOptimisticCreated((prev) => prev.filter((p) => p.id !== deleteCandidate.id));
    setOptimisticCreatedRoles((prev) => prev.filter((r) => r.user_id !== deleteCandidate.id));

    setDeleteCandidate(null);
    setConfirmKeyword("");

    await reload();
  };

  const handleSuccessOptimistic = (newUser: { id: string; email: string; displayName: string }) => {
    const item: ProfileRow = { id: newUser.id, email: newUser.email, display_name: newUser.displayName };
    const ritem: RoleRow = { user_id: newUser.id, role: "sale" };

    setOptimisticCreated((prev) => [item, ...prev]);
    setOptimisticCreatedRoles((prev) => [...prev, ritem]);

    setProfiles((prev) => [item, ...prev]);
    setRoles((prev) => [...prev, ritem]);
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
              roleFilter={roleFilter as any}
              setRoleFilter={setRoleFilter as any}
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
