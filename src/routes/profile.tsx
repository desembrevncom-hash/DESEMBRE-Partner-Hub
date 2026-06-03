import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, User, Save, Loader2, Edit2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, updateProfile, roles, isAdmin, isSubAdmin, isManager } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    async function fetchOwnProfile() {
      if (!user) return;
      try {
        setLoadingProfile(true);
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          setProfile(data);
          setDisplayName(data.display_name || "");
          setEmail(data.email || user.email || "");
          setPhone(user.user_metadata?.phone || "");
          setAvatar(user.user_metadata?.avatar_url || null);
        }
      } catch (err) {
        console.error("Error loading profile from DB:", err);
      } finally {
        setLoadingProfile(false);
      }
    }
    fetchOwnProfile();
  }, [user, isEditing]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_SIZE = 200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        setAvatar(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (isManager && !displayName.trim()) return toast.error("Họ và tên không được để trống");
    if (!email.trim()) return toast.error("Email không được để trống");

    setLoading(true);
    const { error } = await updateProfile({
      display_name: isManager ? displayName.trim() : undefined,
      email: email.trim(),
      phone: phone.trim(),
      avatar_url: avatar || undefined,
    });

    if (error) {
      setLoading(false);
      toast.error(error);
      return;
    }

    if (isManager && user) {
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ display_name: displayName.trim() })
        .eq("id", user.id);

      if (dbError) {
        setLoading(false);
        toast.error("Lỗi cập nhật Profiles DB: " + dbError.message);
        return;
      }
    }

    setLoading(false);
    toast.success("Cập nhật thông tin thành công!");
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container mx-auto px-4 md:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Quay lại
            </Link>
            <h1 className="text-xl font-bold">Hồ sơ cá nhân</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 md:px-6 py-8 flex-1">
        <div className="max-w-xl mx-auto bg-card border border-border rounded-lg p-6 md:p-8 shadow-sm">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary overflow-hidden border-2 border-transparent group-hover:border-primary/50 transition-all">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12" />
                )}
              </div>

              {isEditing && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <span className="text-xs font-semibold">Đổi ảnh</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </label>
              )}
            </div>
            {!isEditing && (
              <div className="text-center">
                <h2 className="text-2xl font-bold">
                  {profile?.display_name || user?.email || "Người dùng"}
                </h2>
                <p className="text-muted-foreground">{user?.email}</p>
                <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-primary/10 text-primary border border-primary/20">
                  {roles.length > 0 ? roles.join(", ") : "Khách"}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <h3 className="text-lg font-semibold">Thông tin liên hệ</h3>
              {!isEditing ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                  <Edit2 className="w-4 h-4 mr-2" /> Chỉnh sửa
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4 mr-2" /> Hủy
                </Button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="space-y-2">
                  <Label htmlFor="display_name">Họ và tên</Label>
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    disabled={!isManager}
                  />
                  {!isManager && (
                    <p className="text-[10px] text-muted-foreground">
                      Tên hiển thị nghiệp vụ do Admin/Phó Admin quản lý.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email liên hệ</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Lưu ý: Thay đổi email có thể ảnh hưởng đến tài khoản đăng nhập của bạn.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Số điện thoại</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09xx..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <Button onClick={handleSave} disabled={loading} className="w-full">
                    {loading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Lưu thông tin
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Họ và tên
                    </span>
                    <p className="font-medium text-base">
                      {profile?.display_name || "Chưa cập nhật"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Email
                    </span>
                    <p className="font-medium text-base">{user?.email}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Số điện thoại
                    </span>
                    <p className="font-medium text-base">
                      {user?.user_metadata?.phone || "Chưa cập nhật"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
                      Mã QR Zalo
                    </span>
                    <div>
                      {user?.user_metadata?.phone ? (
                        <div className="mt-2 inline-block bg-white p-2 border border-border rounded shadow-sm">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://zalo.me/${user.user_metadata.phone.replace(/\D/g, "")}`}
                            alt="Zalo QR"
                            className="w-24 h-24"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic mt-1">
                          Cập nhật SĐT để có QR
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
