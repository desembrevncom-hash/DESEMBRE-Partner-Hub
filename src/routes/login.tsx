import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { 
  ShieldCheck, 
  Zap, 
  ArrowRight, 
  LayoutDashboard, 
  Lock, 
  Mail,
  Sparkles,
  ChevronLeft
} from "lucide-react";

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
      navigate({ to: "/" });
    }
  }, [user, loading, navigate]);

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
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] relative overflow-hidden font-sans antialiased">
      {/* DECORATIVE BACKGROUND ELEMENTS */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-600/10 blur-[120px] rounded-full"></div>
      
      <div className="w-full max-w-[1100px] grid grid-cols-1 lg:grid-cols-2 gap-0 bg-white/5 backdrop-blur-2xl rounded-[48px] border border-white/10 shadow-2xl overflow-hidden relative z-10 m-4">
        
        {/* LEFT: BRAND & VISUAL */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-indigo-600 to-indigo-900 relative overflow-hidden">
           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
           
           <div className="relative z-10">
              <img 
                 src="/logo.png" 
                 alt="Desembre Logo" 
                 className="w-16 h-16 rounded-2xl object-contain bg-white/10 backdrop-blur-md border border-white/20 shadow-xl mb-10 transition-transform hover:scale-110" 
              />
              <h2 className="text-4xl font-black text-white tracking-tight leading-tight mb-6">
                 DESEMBRE <br />
                 <span className="text-indigo-300">CRM Operating System</span>
              </h2>
              <p className="text-indigo-100/70 text-lg font-medium max-w-sm leading-relaxed">
                 Nền tảng quản trị đối tác Spa và chuỗi cung ứng mỹ phẩm chuyên nghiệp hàng đầu Việt Nam.
              </p>
           </div>

           <div className="relative z-10 space-y-6">
              <div className="flex items-center gap-4 text-white/60">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><ShieldCheck className="w-5 h-5" /></div>
                 <p className="text-sm font-bold uppercase tracking-widest">Row-Level Security Active</p>
              </div>
              <div className="flex items-center gap-4 text-white/60">
                 <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10"><Zap className="w-5 h-5" /></div>
                 <p className="text-sm font-bold uppercase tracking-widest">Real-time Data Sync</p>
              </div>
           </div>
        </div>

        {/* RIGHT: LOGIN FORM */}
        <div className="p-10 lg:p-20 bg-white flex flex-col justify-center">
           <div className="max-w-sm mx-auto w-full">
              <div className="mb-10">
                 <Badge className="bg-indigo-50 text-indigo-600 border-none font-black text-[10px] uppercase tracking-[0.2em] px-3 mb-4">Secure Access</Badge>
                 <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Đăng nhập hệ thống</h1>
                 <p className="text-slate-400 text-sm font-medium mt-2">Vui lòng nhập tài khoản nhân sự được cấp.</p>
              </div>

              <form onSubmit={submit} className="space-y-6">
                 <div className="space-y-2">
                    <Label htmlFor="email" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Địa chỉ Email</Label>
                    <div className="relative">
                       <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <Input
                         id="email"
                         type="email"
                         value={email}
                         onChange={(e) => setEmail(e.target.value)}
                         required
                         className="h-14 rounded-2xl border-slate-100 bg-slate-50 pl-12 text-sm font-bold focus:ring-2 focus:ring-indigo-600/20 focus:bg-white transition-all shadow-inner"
                         placeholder="name@desembre.com"
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-center ml-1">
                       <Label htmlFor="password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mật khẩu</Label>
                       <button type="button" className="text-[10px] font-bold text-indigo-600 hover:underline">Quên mật khẩu?</button>
                    </div>
                    <div className="relative">
                       <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                       <Input
                         id="password"
                         type="password"
                         value={password}
                         onChange={(e) => setPassword(e.target.value)}
                         required
                         className="h-14 rounded-2xl border-slate-100 bg-slate-50 pl-12 text-sm font-bold focus:ring-2 focus:ring-indigo-600/20 focus:bg-white transition-all shadow-inner"
                         placeholder="••••••••"
                       />
                    </div>
                 </div>

                 <Button 
                    type="submit" 
                    className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50" 
                    disabled={busy}
                 >
                    {busy ? "Đang xác thực…" : (
                       <>Truy cập Dashboard <ArrowRight className="ml-2 w-4 h-4" /></>
                    )}
                 </Button>

                 <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                    <Link to="/" className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-900 flex items-center gap-2">
                       <ChevronLeft className="w-4 h-4" /> Quay lại trang chủ
                    </Link>
                 </div>
              </form>
           </div>
        </div>
      </div>
      
      {/* FOOTER CREDITS */}
      <div className="absolute bottom-8 left-0 right-0 text-center">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em]">© 2024 DESEMBRE GLOBAL • ALL RIGHTS RESERVED</p>
      </div>
    </div>
  );
}
