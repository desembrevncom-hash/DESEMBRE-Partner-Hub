import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Info,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Mail,
  MessageCircle,
  Shield,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface AddSenderWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddSenderWizard({ open, onOpenChange, onSuccess }: AddSenderWizardProps) {
  const [step, setStep] = useState(1);
  const [provider, setProvider] = useState<"gmail/google" | "resend" | "zalo_oa">("gmail/google");
  
  // Fields Form
  const [name, setName] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [domain, setDomain] = useState("");
  const [zaloAppId, setZaloAppId] = useState("");
  const [zaloOaId, setZaloOaId] = useState("");
  const [resendApiKey, setResendApiKey] = useState("");
  const [gmailClientId, setGmailClientId] = useState("");
  const [gmailClientSecret, setGmailClientSecret] = useState("");
  const [gmailRefreshToken, setGmailRefreshToken] = useState("");
  
  // Created sender ID (from step 2)
  const [createdSenderId, setCreatedSenderId] = useState<string | null>(null);
  
  // States
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  
  // Verify states: 'healthy' | 'warning' | 'error' | 'requires_setup'
  const [verifyState, setVerifyState] = useState<"healthy" | "warning" | "error" | "requires_setup" | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const resetForm = () => {
    setStep(1);
    setName("");
    setSenderEmail("");
    setSenderName("");
    setDomain("");
    setZaloAppId("");
    setZaloOaId("");
    setCreatedSenderId(null);
    setResendApiKey("");
    setGmailClientId("");
    setGmailClientSecret("");
    setGmailRefreshToken("");
    setVerifyState(null);
    setVerifyError(null);
  };

  // Step 1 -> Step 2
  const handleSelectProvider = (prov: "gmail/google" | "resend" | "zalo_oa") => {
    setProvider(prov);
    setStep(2);
  };

  // Step 2 -> Step 3 (Provision Temp record)
  const handleCreateMetadata = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng điền tên gợi nhớ cấu hình");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Phiên làm việc hết hạn");

      // Build payload for provisioning
      const payload: any = {
        provider,
        name: name.trim(),
        channel: provider === "zalo_oa" ? "zalo" : "email",
        auth_type: provider === "resend" ? "api_key" : "oauth_refresh_token",
        status: "pending_verification",
        health_status: "unknown",
        sender_email: provider === "resend" ? senderEmail.trim() : (provider === "gmail/google" ? senderEmail.trim() : null),
        sender_name: senderName.trim() || null,
        domain: provider === "resend" ? domain.trim() : null,
        secret_prefix: provider === "gmail/google" ? "GOOGLE_DEFAULT" : null,
        provider_secret: provider === "resend" ? resendApiKey.trim() : 
                         (provider === "gmail/google" ? JSON.stringify({
                           clientId: gmailClientId.trim(),
                           clientSecret: gmailClientSecret.trim(),
                           refreshToken: gmailRefreshToken.trim()
                         }) : null)
      };

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/provision-sender`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Lỗi tạo tài khoản");

      setCreatedSenderId(json.data.id);
      
      // Chuyển bước
      if (provider === "zalo_oa") {
        // Zalo OA đi thẳng sang luồng OAuth sau đó
        setVerifyState("requires_setup");
      } else {
        setVerifyState(null);
      }
      
      setStep(3);
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Run verify probe
  const handleVerifyConnection = async () => {
    if (!createdSenderId) return;
    setVerifying(true);
    setVerifyError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Phiên làm việc hết hạn");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-sender-connection`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sender_id: createdSenderId, sender_type: "business" }),
        }
      );
      
      const json = await res.json();
      
      // Nếu API không phản hồi tốt
      if (!res.ok) {
        // Check nếu thiếu cấu hình secret
        if (json.error && (json.error.includes("không tồn tại") || json.error.includes("thiếu") || json.error.includes("oauth_refresh_token") || json.error.includes("OAuth"))) {
          setVerifyState("requires_setup");
          setVerifyError(json.error);
        } else {
          setVerifyState("error");
          setVerifyError(json.error || "Kết nối thất bại");
        }
      } else {
        // Dựa vào health_status trả về từ Edge Function
        if (json.health_status === "healthy") {
          setVerifyState("healthy");
        } else if (json.health_status === "warning") {
          setVerifyState("warning");
          setVerifyError(json.last_error || "Cảnh báo kết nối");
        } else {
          // Check nếu lỗi cấu hình thì chuyển sang setup
          if (json.last_error && (json.last_error.includes("không tồn tại") || json.last_error.includes("thiếu"))) {
            setVerifyState("requires_setup");
          } else {
            setVerifyState("error");
          }
          setVerifyError(json.last_error || "Cấu hình chưa đúng");
        }
      }
    } catch (e: any) {
      setVerifyState("error");
      setVerifyError(e.message || "Lỗi mạng kết nối");
    } finally {
      setVerifying(false);
    }
  };

  // Step 3 -> Step 4 (Activate matching rule)
  const handleActivateSender = async () => {
    if (!createdSenderId) return;
    setSubmitting(true);

    let targetStatus = "pending_verification";
    let targetHealth = "unknown";

    if (verifyState === "healthy" || verifyState === "warning") {
      targetStatus = "active";
      targetHealth = verifyState;
    } else if (verifyState === "requires_setup") {
      targetStatus = "pending_verification";
      targetHealth = "warning";
    } else if (verifyState === "error") {
      targetStatus = "error";
      targetHealth = "error";
    }

    try {
      const { error } = await supabase
        .from("sender_accounts")
        .update({
          status: targetStatus,
          health_status: targetHealth,
          last_error: verifyError,
          updated_at: new Date().toISOString()
        })
        .eq("id", createdSenderId);

      if (error) throw error;

      toast.success(`Đã thiết lập Sender trạng thái: ${targetStatus.toUpperCase()}`);
      onSuccess();
      setStep(4);
    } catch (e: any) {
      toast.error("Lỗi kích hoạt: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Trích xuất Zalo OA OAuth flow
  const handleStartZaloOAuth = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Không tìm thấy session");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zalo-oauth-start`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender_name: name.trim(),
            app_id: zaloAppId.trim(),
            oa_id: zaloOaId.trim(),
            redirect_uri: window.location.origin + "/admin/sender-accounts",
          }),
        },
      );

      const json = await res.json();
      if (!res.ok || !json.oauth_url) {
        throw new Error(json.error || "Không nhận được OAuth URL");
      }

      onOpenChange(false);
      toast.success("Đang chuyển hướng sang Zalo để uỷ quyền...", { duration: 2000 });
      window.location.href = json.oauth_url;
    } catch (e: any) {
      toast.error("Lỗi kết Zalo OAuth: " + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-xl bg-white rounded-3xl p-6 border-none shadow-2xl">
        <DialogHeader className="border-b border-slate-100 pb-3">
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            🚀 Cấu hình Sender mới
          </DialogTitle>
          <DialogDescription className="text-xs">
            Thêm mới và kết nối tài khoản hạ tầng gửi tin nhắn doanh nghiệp
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 rounded-xl mb-4 text-[11px] font-bold text-slate-400">
          <span className={step === 1 ? "text-indigo-600 font-black" : step > 1 ? "text-slate-600" : ""}>1. Chọn loại</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={step === 2 ? "text-indigo-600 font-black" : step > 2 ? "text-slate-600" : ""}>2. Điền thông tin</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={step === 3 ? "text-indigo-600 font-black" : step > 3 ? "text-slate-600" : ""}>3. Xác thực</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
          <span className={step === 4 ? "text-indigo-600 font-black" : ""}>4. Hoàn tất</span>
        </div>

        {/* STEP 1: SELECT SENDER TYPE */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <p className="text-xs font-bold text-slate-500">Chọn nhà cung cấp tài khoản gửi:</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Gmail Card */}
              <button
                type="button"
                onClick={() => handleSelectProvider("gmail/google")}
                className="flex flex-col items-center text-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-2 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-slate-800">Gmail / Google</span>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Calendar Invite, Email Test, Gửi email giới hạn</p>
              </button>

              {/* Resend Card */}
              <button
                type="button"
                onClick={() => handleSelectProvider("resend")}
                className="flex flex-col items-center text-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-2 group-hover:scale-105 transition-transform">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-slate-800">Resend Email</span>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Email Campaign, tiếp thị hàng loạt hiệu năng cao</p>
              </button>

              {/* Zalo OA Card */}
              <button
                type="button"
                onClick={() => handleSelectProvider("zalo_oa")}
                className="flex flex-col items-center text-center p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 mb-2 group-hover:scale-105 transition-transform">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-black text-slate-800">Zalo OA</span>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">ZNS, OA Campaign, tiếp thị Zalo có kiểm soát</p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FILL INFORMATION */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 mb-1">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              Cấu hình: {provider === "gmail/google" ? "Gmail Sender" : provider === "resend" ? "Resend Email" : "Zalo OA"}
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Tên cấu hình hiển thị *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="vd: Gmail Marketing Admin"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              {provider === "resend" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Địa chỉ Email gửi đi (From Email) *</Label>
                    <Input
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="vd: newsletter@domain.com"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Tên hiển thị người gửi (Sender Name)</Label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="vd: Desembre News"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Tên miền xác thực (Domain) *</Label>
                    <Input
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="vd: desembrevn.com"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Khóa API Resend (API Key) *</Label>
                    <Input
                      type="password"
                      value={resendApiKey}
                      onChange={(e) => setResendApiKey(e.target.value)}
                      placeholder="vd: re_123456789..."
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>
                </>
              )}

              {provider === "gmail/google" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Địa chỉ Gmail gửi đi *</Label>
                    <Input
                      value={senderEmail}
                      onChange={(e) => setSenderEmail(e.target.value)}
                      placeholder="vd: desembrevn@gmail.com"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl space-y-2.5">
                    <p className="text-[11px] font-black text-purple-800 flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5" /> Google OAuth 2.0 Credentials
                    </p>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Client ID *</Label>
                      <Input
                        value={gmailClientId}
                        onChange={(e) => setGmailClientId(e.target.value)}
                        placeholder="xxxxxxxx.apps.googleusercontent.com"
                        className="h-10 text-xs rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Client Secret *</Label>
                      <Input
                        type="password"
                        value={gmailClientSecret}
                        onChange={(e) => setGmailClientSecret(e.target.value)}
                        placeholder="GOCSPX-..."
                        className="h-10 text-xs rounded-xl font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">Refresh Token *</Label>
                      <Input
                        type="password"
                        value={gmailRefreshToken}
                        onChange={(e) => setGmailRefreshToken(e.target.value)}
                        placeholder="1//0g..."
                        className="h-10 text-xs rounded-xl font-mono"
                      />
                    </div>
                    <p className="text-[10px] text-purple-600 leading-relaxed">
                      Lấy từ Google Cloud Console → OAuth 2.0 → Credentials. Refresh Token lấy qua OAuth Playground.
                    </p>
                  </div>
                </>
              )}

              {provider === "zalo_oa" && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Zalo App ID *</Label>
                    <Input
                      value={zaloAppId}
                      onChange={(e) => setZaloAppId(e.target.value)}
                      placeholder="vd: 482938192039281"
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Zalo OA ID (Tùy chọn)</Label>
                    <Input
                      value={zaloOaId}
                      onChange={(e) => setZaloOaId(e.target.value)}
                      placeholder="vd: 4820391290382918"
                      className="h-10 text-xs rounded-xl font-mono"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl text-xs font-bold h-10"
              >
                Quay lại
              </Button>
              {provider === "zalo_oa" ? (
                <Button
                  onClick={handleStartZaloOAuth}
                  disabled={submitting || !name.trim() || !zaloAppId.trim()}
                  className="flex-1 rounded-xl text-xs font-bold h-10 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Liên kết Zalo OAuth
                </Button>
              ) : (
                <Button
                  onClick={handleCreateMetadata}
                  disabled={submitting || !name.trim() || !senderEmail.trim() || (provider === "resend" && !domain.trim())}
                  className="flex-1 rounded-xl text-xs font-bold h-10 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Tạo cấu hình & Verify
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 3: VERIFY CONNECTION */}
        {step === 3 && (
          <div className="space-y-4 py-2 text-center">
            <p className="text-xs font-bold text-slate-500">Chạy kiểm nghiệm kết nối tài khoản gửi:</p>
            
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 flex flex-col items-center justify-center space-y-3">
              {verifyState === null && (
                <>
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Info className="w-6 h-6 animate-pulse" />
                  </div>
                  <p className="text-xs font-bold text-slate-700">Nhấn nút bên dưới để chạy xác thực</p>
                  <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">Chúng tôi sẽ gọi thử các kết nối OAuth/API Key để kiểm nghiệm trạng thái kết nối.</p>
                </>
              )}

              {verifyState === "healthy" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-emerald-700">KẾT NỐI HOÀN HẢO (HEALTHY)</p>
                  <p className="text-[10px] text-emerald-600/80">Tài khoản kết nối tốt và sẵn sàng gửi tin.</p>
                </>
              )}

              {verifyState === "warning" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-amber-700">KẾT NỐI CÓ CẢNH BÁO (WARNING)</p>
                  <p className="text-[10px] text-amber-600/80">{verifyError}</p>
                </>
              )}

              {verifyState === "requires_setup" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <Shield className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-blue-700">CẦN THIẾT LẬP EDGE SECRETS (REQUIRES SETUP)</p>
                  <p className="text-[10px] text-blue-600/80">Tài khoản đã tạo nhưng cần cấu hình khóa API hoặc OAuth tương ứng trên backend secrets.</p>
                  {verifyError && <p className="text-[9px] font-mono text-slate-400 bg-slate-100 p-1.5 rounded-lg w-full max-w-sm truncate">{verifyError}</p>}
                </>
              )}

              {verifyState === "error" && (
                <>
                  <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                    <XCircle className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-rose-700">LỖI KẾT NỐI (FAILED/ERROR)</p>
                  <p className="text-[10px] text-rose-600/80">{verifyError || "Kiểm nghiệm kết nối không thành công."}</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleVerifyConnection}
                disabled={verifying || submitting}
                className="flex-1 rounded-xl text-xs font-bold h-10 border-indigo-200 text-indigo-600"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Đang verify...
                  </>
                ) : (
                  "Chạy Verify Connection"
                )}
              </Button>
              <Button
                onClick={handleActivateSender}
                disabled={submitting || verifying || verifyState === null}
                className="flex-1 rounded-xl text-xs font-bold h-10 bg-slate-900 hover:bg-slate-800 text-white"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Tiếp tục kích hoạt
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: COMPLETED */}
        {step === 4 && (
          <div className="space-y-4 py-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-sm font-black text-slate-800">Cấu hình hoàn tất!</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Tài khoản gửi tin đã được khởi tạo trong hệ thống. Trạng thái của tài khoản đã được đồng bộ tương ứng dựa trên kết quả xác thực.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-600 max-w-xs mx-auto border border-slate-100 font-medium">
              <div className="flex justify-between py-1">
                <span>Tên:</span>
                <span className="font-bold text-slate-800">{name}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Kênh:</span>
                <span className="font-bold text-slate-800 uppercase">{provider}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Xác thực:</span>
                <span className={`font-black uppercase ${
                  verifyState === "healthy" || verifyState === "warning" ? "text-emerald-600" :
                  verifyState === "requires_setup" ? "text-blue-600" : "text-rose-600"
                }`}>
                  {verifyState || "unknown"}
                </span>
              </div>
            </div>

            <Button
              onClick={() => {
                resetForm();
                onOpenChange(false);
              }}
              className="w-full rounded-xl text-xs font-bold h-10 bg-indigo-600 hover:bg-indigo-700 text-white mt-2"
            >
              Đóng Wizard & Quay về Danh sách
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
