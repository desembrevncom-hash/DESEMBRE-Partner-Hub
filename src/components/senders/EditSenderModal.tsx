import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, Shield } from "lucide-react";
import { toast } from "sonner";

interface EditSenderModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sender: any | null;
  onSuccess: () => void;
}

export function EditSenderModal({ open, onOpenChange, sender, onSuccess }: EditSenderModalProps) {
  const [submitting, setSubmitting] = useState(false);

  // Shared fields
  const [name, setName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [domain, setDomain] = useState("");

  // Resend fields
  const [resendApiKey, setResendApiKey] = useState("");

  // Gmail / Google OAuth fields
  const [gmailClientId, setGmailClientId] = useState("");
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [gmailRefreshToken, setGmailRefreshToken] = useState("");

  useEffect(() => {
    if (sender && open) {
      setName(sender.name || "");
      setSenderEmail(sender.sender_email || "");
      setSenderName(sender.sender_name || "");
      setDomain(sender.domain || "");
      setResendApiKey(""); // Không load secret lên UI
      setGmailClientId("");
      setGmailClientSecret("");
      setGmailRefreshToken("");
    }
  }, [sender, open]);

  const handleUpdate = async () => {
    if (!sender) return;
    if (!name.trim()) {
      toast.error("Vui lòng điền tên gợi nhớ cấu hình");
      return;
    }

    setSubmitting(true);
    try {
      const updates: any = {
        name: name.trim(),
        sender_email: senderEmail.trim() || null,
        sender_name: senderName.trim() || null,
        domain: domain.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Resend: chỉ cập nhật nếu nhập key mới
      if (isResend && resendApiKey.trim() !== "") {
        updates.provider_secret = resendApiKey.trim();
      }

      // Gmail: cập nhật nếu có ít nhất 1 trường được nhập
      if (isGmail) {
        const hasNewCreds =
          gmailClientId.trim() || gmailClientSecret.trim() || gmailRefreshToken.trim();
        if (hasNewCreds) {
          // Đọc giá trị cũ từ DB nếu người dùng chỉ điền một phần
          let oldCreds: any = {};
          if (sender.provider_secret) {
            try {
              oldCreds = JSON.parse(sender.provider_secret);
            } catch {
              /* ignore */
            }
          }
          updates.provider_secret = JSON.stringify({
            clientId: gmailClientId.trim() || oldCreds.clientId || "",
            clientSecret: gmailClientSecret.trim() || oldCreds.clientSecret || "",
            refreshToken: gmailRefreshToken.trim() || oldCreds.refreshToken || "",
          });
          // Sau khi sửa creds, chuyển về pending_verification để test lại
          updates.status = "pending_verification";
          updates.health_status = "unknown";
        }
      }

      const { error } = await supabase.from("sender_accounts").update(updates).eq("id", sender.id);

      if (error) throw error;

      toast.success("Đã cập nhật thông tin Sender! Hãy nhấn Test để xác minh kết nối.");
      onSuccess();
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Lỗi cập nhật: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!sender) return null;

  const isResend = sender.provider === "resend";
  const isGmail = sender.provider === "gmail/google" || sender.provider === "google_calendar";
  const isZalo = sender.provider === "zalo_oa" || sender.provider === "zalo";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white border-slate-100 rounded-3xl shadow-2xl p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <DialogHeader className="bg-slate-50 px-6 py-4 border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-black text-slate-800">
                Chỉnh sửa cấu hình Sender
              </DialogTitle>
              <p className="text-[11px] text-slate-500 font-medium">
                Cập nhật thông tin kênh gửi {sender.provider}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          {/* Tên cấu hình */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-700">Tên cấu hình hiển thị *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
          </div>

          {/* Email gửi đi */}
          {(isResend || isGmail) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700">
                Địa chỉ Email gửi đi (From Email) *
              </Label>
              <Input
                value={senderEmail}
                onChange={(e) => setSenderEmail(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          )}

          {/* Resend fields */}
          {isResend && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Tên hiển thị người gửi (Sender Name)
                </Label>
                <Input
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Tên miền xác thực (Domain) *
                </Label>
                <Input
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="h-10 text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">
                  Khóa API Resend (Nhập để thay đổi)
                </Label>
                <Input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="Để trống nếu không muốn đổi API Key..."
                  className="h-10 text-xs rounded-xl font-mono"
                />
              </div>
            </>
          )}

          {/* Gmail OAuth fields */}
          {isGmail && (
            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-3">
              <p className="text-[11px] font-black text-purple-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Google OAuth 2.0 Credentials
              </p>
              <p className="text-[10px] text-purple-600 leading-relaxed">
                Để trống các ô bên dưới nếu không muốn thay đổi. Chỉ điền vào trường nào bạn muốn
                cập nhật.
              </p>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Client ID</Label>
                <Input
                  value={gmailClientId}
                  onChange={(e) => setGmailClientId(e.target.value)}
                  placeholder="Để trống = giữ nguyên hiện tại..."
                  className="h-10 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Client Secret</Label>
                <Input
                  type="password"
                  value={gmailClientSecret}
                  onChange={(e) => setGmailClientSecret(e.target.value)}
                  placeholder="Để trống = giữ nguyên hiện tại..."
                  className="h-10 text-xs rounded-xl font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Refresh Token</Label>
                <Input
                  type="password"
                  value={gmailRefreshToken}
                  onChange={(e) => setGmailRefreshToken(e.target.value)}
                  placeholder="Để trống = giữ nguyên hiện tại..."
                  className="h-10 text-xs rounded-xl font-mono"
                />
              </div>
              <p className="text-[10px] text-purple-500 leading-relaxed">
                📌 Lấy từ <strong>Google Cloud Console</strong> → APIs & Services → Credentials.
                Refresh Token lấy qua <strong>OAuth Playground</strong>{" "}
                (oauth2.google.com/playground).
              </p>
            </div>
          )}

          {/* Zalo notice */}
          {isZalo && (
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-[11px] text-blue-700 font-medium">
                Tài khoản Zalo OA chỉ có thể thay đổi tên cấu hình hiển thị. Để đổi App ID hoặc Zalo
                OA ID, bạn cần dùng nút <strong>"Reconnect"</strong> (Kết nối lại).
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 rounded-xl text-xs font-bold h-10"
            >
              Hủy
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={submitting || !name.trim()}
              className="flex-1 rounded-xl text-xs font-bold h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Lưu thay đổi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
