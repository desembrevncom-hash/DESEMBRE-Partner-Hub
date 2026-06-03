import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowLeft,
  Trash2,
  Shield,
  ShoppingBag,
  Phone,
  Users,
  UserPlus,
  ShieldCheck,
  Search,
  Filter,
  MoreVertical,
  Zap,
  CheckCircle2,
  Clock,
  AlertCircle,
  LayoutDashboard,
  ShieldAlert,
  UserCircle,
  Edit2,
} from "lucide-react";
import { toast } from "sonner";
import {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import { useAuth, getRoleLabel } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

import { ProfileRow, RoleRow, CreateSaleUserForm } from "@/components/admin-users";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user, canManageUsers, canCreateSubAdmin, loading, refreshRoles } = useAuth();
  const navigate = useNavigate();

  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [busy, setBusy] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const [deleteCandidate, setDeleteCandidate] = useState<ProfileRow | null>(null);
  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [editCandidate, setEditCandidate] = useState<ProfileRow | null>(null);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [updatingDisplayName, setUpdatingDisplayName] = useState(false);

  const reload = async () => {
    setBusy(true);
    try {
      const [resP, resR] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      if (resP.data) setProfiles(resP.data);
      if (resR.data) setRoles(resR.data as RoleRow[]);
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    if (!user || !canManageUsers) {
      navigate({ to: "/login" });
      return;
    }
    reload();
  }, [user, canManageUsers, loading]);

  const rolesMap = useMemo(() => {
    const map = new Map<string, string[]>();
    roles.forEach((r) => {
      const existing = map.get(r.user_id) || [];
      map.set(r.user_id, [...existing, r.role]);
    });
    return map;
  }, [roles]);

  const filteredProfiles = profiles.filter((p) => {
    const matchSearch = (p.display_name || p.email || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const userRoles = rolesMap.get(p.id) || [];
    const matchRole = roleFilter === "all" || userRoles.includes(roleFilter);
    return matchSearch && matchRole;
  });

  const toggleRole = async (uid: string, role: string) => {
    const currentRoles = rolesMap.get(uid) || [];
    const has = currentRoles.includes(role);

    if (has && uid === user?.id && role === "admin") {
      toast.error("Bạn không thể tự gỡ quyền Admin của chính mình.");
      return;
    }

    try {
      if (has) {
        await supabase.from("user_roles").delete().eq("user_id", uid).eq("role", role);
        setRoles((prev) => prev.filter((r) => !(r.user_id === uid && r.role === role)));
      } else {
        await supabase.from("user_roles").insert({ user_id: uid, role });
        setRoles((prev) => [...prev, { user_id: uid, role: role as any }]);
      }
      toast.success("Cập nhật quyền thành công");
      if (uid === user?.id) await refreshRoles();
    } catch (e) {
      toast.error("Lỗi cập nhật quyền");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCandidate || confirmKeyword !== "DONG Y") return;
    setDeleting(true);
    try {
      await supabase.functions.invoke("delete-user", { body: { userId: deleteCandidate.id } });
      toast.success("Đã xóa nhân sự");
      setProfiles((prev) => prev.filter((p) => p.id !== deleteCandidate.id));
      setDeleteCandidate(null);
    } catch (e) {
      toast.error("Không thể xóa nhân sự");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editCandidate) return;
    if (!newDisplayName.trim()) return toast.error("Họ và tên không được để trống");

    setUpdatingDisplayName(true);
    try {
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ display_name: newDisplayName.trim() })
        .eq("id", editCandidate.id);

      if (dbError) throw dbError;

      setProfiles((prev) =>
        prev.map((p) =>
          p.id === editCandidate.id ? { ...p, display_name: newDisplayName.trim() } : p,
        ),
      );
      toast.success("Cập nhật tên hiển thị thành công");
      setEditCandidate(null);
    } catch (e: any) {
      console.error("Error updating profile display_name:", e);
      toast.error("Lỗi cập nhật tên: " + e.message);
    } finally {
      setUpdatingDisplayName(false);
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="w-3.5 h-3.5" />;
      case "sale":
        return <ShoppingBag className="w-3.5 h-3.5" />;
      case "telesale":
        return <Phone className="w-3.5 h-3.5" />;
      case "tele_lead":
        return <Users className="w-3.5 h-3.5" />;
      default:
        return <UserCircle className="w-3.5 h-3.5" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-rose-50 text-rose-600 border-rose-100";
      case "sub_admin":
        return "bg-purple-50 text-purple-600 border-purple-100";
      case "sale":
        return "bg-indigo-50 text-indigo-600 border-indigo-100";
      case "tele_lead":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "telesale":
        return "bg-orange-50 text-orange-600 border-orange-100";
      default:
        return "bg-slate-50 text-slate-500 border-slate-100";
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      <header className="bg-white/80 border-b border-slate-200/60 sticky top-0 z-30 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace"
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <LayoutDashboard className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight">
                Nhân sự & Phân quyền
              </h1>
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Identity & Access Management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={reload}
              variant="ghost"
              size="icon"
              className="rounded-xl text-slate-400"
            >
              <Zap className="w-4 h-4" />
            </Button>
            <Button className="rounded-xl bg-slate-900 hover:bg-black font-black text-xs h-10 px-6 shadow-lg shadow-slate-200 transition-all hover:scale-105">
              <UserPlus className="w-4 h-4 mr-2" /> Thêm nhân sự
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* TEAM STATS */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatBox title="Tổng nhân sự" value={profiles.length} icon={Users} color="indigo" />
          <StatBox
            title="Admin"
            value={roles.filter((r) => r.role === "admin").length}
            icon={Shield}
            color="rose"
          />
          <StatBox
            title="Phó Admin"
            value={roles.filter((r) => r.role === "sub_admin").length}
            icon={ShieldCheck}
            color="purple"
          />
          <StatBox
            title="Sale"
            value={roles.filter((r) => r.role === "sale").length}
            icon={ShoppingBag}
            color="indigo"
          />
          <StatBox
            title="Trưởng Tele"
            value={roles.filter((r) => r.role === "tele_lead").length}
            icon={Users}
            color="amber"
          />
          <StatBox
            title="Telesale"
            value={roles.filter((r) => r.role === "telesale").length}
            icon={Phone}
            color="orange"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* CREATE FORM */}
          <div className="lg:col-span-1">
            <CreateSaleUserForm
              onSuccessOptimistic={reload}
              reload={reload}
              canCreateSubAdmin={canCreateSubAdmin}
            />
          </div>

          {/* STAFF LIST */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="rounded-[32px] border-none shadow-sm overflow-hidden bg-white">
              <CardHeader className="p-8 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <CardTitle className="text-base font-black text-slate-900 uppercase tracking-widest">
                  Danh sách Đội ngũ
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      placeholder="Tìm nhân viên..."
                      className="pl-9 h-9 text-xs rounded-xl border-slate-100 bg-slate-50 focus:bg-white transition-all w-48"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="h-9 px-3 text-xs font-bold rounded-xl border-slate-100 bg-slate-50 outline-none"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">Tất cả vai trò</option>
                    <option value="admin">Admin</option>
                    <option value="sub_admin">Phó Admin</option>
                    <option value="sale">Sale</option>
                    <option value="tele_lead">Trưởng Tele</option>
                    <option value="telesale">Telesale</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                        <th className="px-8 py-4 text-left">Nhân sự</th>
                        <th className="px-8 py-4 text-center">Vai trò hiện tại</th>
                        <th className="px-8 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {busy ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-8 py-20 text-center animate-pulse text-slate-300 font-bold uppercase text-[10px]"
                          >
                            Đang đồng bộ dữ liệu...
                          </td>
                        </tr>
                      ) : filteredProfiles.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-8 py-20 text-center text-slate-300 font-bold uppercase text-[10px]"
                          >
                            Không tìm thấy nhân sự
                          </td>
                        </tr>
                      ) : (
                        filteredProfiles.map((profile) => {
                          const userRoles = rolesMap.get(profile.id) || [];
                          return (
                            <tr
                              key={profile.id}
                              className="hover:bg-slate-50/50 transition-all group"
                            >
                              <td className="px-8 py-5">
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                                    {profile.display_name?.slice(0, 1) ||
                                      profile.email?.slice(0, 1)}
                                  </div>
                                  <div>
                                    <p className="text-sm font-black text-slate-900">
                                      {profile.display_name || "Chưa đặt tên"}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-400">
                                      {profile.email}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                  {["admin", "sub_admin", "sale", "tele_lead", "telesale"].map(
                                    (role) => {
                                      const isActive = userRoles.includes(role);
                                      return (
                                        <button
                                          key={role}
                                          onClick={() => toggleRole(profile.id, role)}
                                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 border ${
                                            isActive
                                              ? getRoleColor(role)
                                              : "bg-white text-slate-300 border-slate-100 opacity-40 hover:opacity-100"
                                          }`}
                                        >
                                          {getRoleIcon(role)} {getRoleLabel(role as any)}
                                        </button>
                                      );
                                    },
                                  )}
                                </div>
                              </td>
                              <td className="px-8 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-300 hover:text-indigo-600 rounded-lg"
                                    onClick={() => {
                                      setEditCandidate(profile);
                                      setNewDisplayName(profile.display_name || "");
                                    }}
                                    title="Sửa tên hiển thị"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-300 hover:text-rose-500 rounded-lg"
                                    onClick={() => setDeleteCandidate(profile)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* PERMISSION LEGEND */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-[24px] border-none shadow-sm bg-slate-900 text-white p-6">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" /> Lưu ý quan trọng
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed font-medium">
                  Quyền **Admin** cho phép truy cập toàn bộ dữ liệu tài chính và báo cáo. Hãy cẩn
                  thận khi cấp quyền này cho nhân sự mới. Quyền **Sale** và **Telesale** sẽ giới hạn
                  dữ liệu theo từng cá nhân phụ trách.
                </p>
              </Card>
              <Card className="rounded-[24px] border-none shadow-sm bg-white p-6 border border-slate-100">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Trạng thái đồng bộ
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                  Hệ thống sử dụng cơ chế đồng bộ thời gian thực. Mọi thay đổi về phân quyền sẽ có
                  hiệu lực ngay lập tức khi nhân viên tải lại trang hoặc thực hiện thao tác mới.
                </p>
              </Card>
            </div>
          </div>
        </div>
      </main>

      {/* EDIT DISPLAY NAME DIALOG */}
      <Dialog
        open={!!editCandidate}
        onOpenChange={(open) => !updatingDisplayName && !open && setEditCandidate(null)}
      >
        <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-8 bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-3 text-lg font-black uppercase tracking-tight">
              <UserCircle className="w-6 h-6 text-indigo-600" /> Sửa tên hiển thị
            </DialogTitle>
            <DialogDescription className="text-sm pt-4 leading-relaxed font-medium text-slate-500">
              Nhập tên hiển thị nghiệp vụ mới cho nhân sự{" "}
              <strong className="text-slate-900">{editCandidate?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-2">
            <Label
              htmlFor="edit_display_name"
              className="text-[10px] font-black text-slate-500 uppercase tracking-widest block"
            >
              Họ và tên
            </Label>
            <Input
              id="edit_display_name"
              placeholder="Nguyễn Văn A"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="rounded-2xl h-12 border-slate-200 focus:border-indigo-500 transition-all font-bold px-4"
              disabled={updatingDisplayName}
            />
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="ghost"
              onClick={() => setEditCandidate(null)}
              className="rounded-xl font-bold text-slate-400"
              disabled={updatingDisplayName}
            >
              Hủy bỏ
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updatingDisplayName || !newDisplayName.trim()}
              className="rounded-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white px-8 h-12 shadow-lg shadow-indigo-100"
            >
              {updatingDisplayName ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <Dialog open={!!deleteCandidate} onOpenChange={(open) => !open && setDeleteCandidate(null)}>
        <DialogContent className="sm:max-w-[425px] rounded-[32px] border-none shadow-2xl p-8">
          <DialogHeader>
            <DialogTitle className="text-rose-600 flex items-center gap-3 text-lg font-black uppercase tracking-tight">
              <ShieldAlert className="w-6 h-6" /> Xác nhận xóa nhân sự
            </DialogTitle>
            <DialogDescription className="text-sm pt-4 leading-relaxed font-medium text-slate-500">
              Bạn đang thực hiện thao tác xóa vĩnh viễn tài khoản{" "}
              <strong className="text-slate-900 underline decoration-rose-500 decoration-2">
                {deleteCandidate?.display_name || deleteCandidate?.email}
              </strong>
              . Hành động này không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <Label className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 block">
              Gõ "DONG Y" để tiếp tục
            </Label>
            <Input
              placeholder="DONG Y"
              value={confirmKeyword}
              onChange={(e) => setConfirmKeyword(e.target.value)}
              className="font-mono text-center tracking-[0.3em] font-black border-2 border-rose-100 focus:border-rose-500 transition-all rounded-2xl h-12"
            />
          </div>
          <DialogFooter className="gap-3">
            <Button
              variant="ghost"
              onClick={() => setDeleteCandidate(null)}
              className="rounded-xl font-bold text-slate-400"
            >
              Hủy bỏ
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleting || confirmKeyword !== "DONG Y"}
              className="rounded-xl font-black px-8 h-12 shadow-lg shadow-rose-200"
            >
              {deleting ? "Đang xử lý..." : "Xác nhận Xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatBox({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    rose: "bg-rose-50 text-rose-600 border-rose-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <Card className="rounded-[28px] border-none shadow-sm overflow-hidden bg-white hover:shadow-md transition-all group">
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter mt-1">{value}</h3>
        </div>
        <div
          className={`w-14 h-14 rounded-2xl flex items-center justify-center border transition-all group-hover:scale-110 ${colors[color]}`}
        >
          <Icon className="w-6 h-6" />
        </div>
      </CardContent>
    </Card>
  );
}
