import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SystemSettingsProvider } from "@/hooks/useSystemSettings";
import { 
  LayoutDashboard, 
  Users, 
  Package, 
  Calendar, 
  Settings, 
  Bell, 
  LogOut, 
  Sparkles,
  Zap,
  ShieldCheck,
  ChevronDown,
  UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/NotificationBell";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { user, signOut, isAdmin, isTeleLead } = useAuth();
  const [branding, setBranding] = useState({ primary: "", accent: "", logoLight: "", logoDark: "" });

  useEffect(() => {
    supabase.from('system_settings').select('primary_color, accent_color, logo_light_url, logo_dark_url').maybeSingle()
      .then(({data}) => {
        if (data) {
          setBranding({ 
             primary: data.primary_color, 
             accent: data.accent_color,
             logoLight: data.logo_light_url,
             logoDark: data.logo_dark_url
          });
        }
      });
  }, []);

  if (!user) {
    return (
      <>
        <Outlet />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  return (
    <SystemSettingsProvider>
      <div className="min-h-screen bg-[#f8fafc] font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      <style>{`
        :root {
          ${branding.primary ? `--brand-primary: ${branding.primary};` : ''}
          ${branding.accent ? `--brand-accent: ${branding.accent};` : ''}
        }
        
        ${branding.primary ? `
          .bg-indigo-600, .bg-indigo-500, .bg-primary { background-color: var(--brand-primary) !important; }
          .text-indigo-600, .text-indigo-500, .text-primary { color: var(--brand-primary) !important; }
          .border-indigo-600, .border-indigo-500 { border-color: var(--brand-primary) !important; }
          .bg-indigo-50 { background-color: color-mix(in srgb, var(--brand-primary) 10%, white) !important; }
          .text-indigo-900 { color: color-mix(in srgb, var(--brand-primary) 80%, black) !important; }
          .shadow-indigo-100 { box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--brand-primary) 20%, transparent), 0 2px 4px -2px color-mix(in srgb, var(--brand-primary) 20%, transparent) !important; }
          .shadow-indigo-200 { box-shadow: 0 10px 15px -3px color-mix(in srgb, var(--brand-primary) 30%, transparent), 0 4px 6px -4px color-mix(in srgb, var(--brand-primary) 30%, transparent) !important; }
          .fill-indigo-500 { fill: var(--brand-primary) !important; }
          .group:hover\\:text-indigo-500:hover { color: var(--brand-primary) !important; }
          .hover\\:bg-indigo-600:hover { background-color: color-mix(in srgb, var(--brand-primary) 90%, black) !important; }
          .hover\\:bg-indigo-50:hover { background-color: color-mix(in srgb, var(--brand-primary) 10%, white) !important; }
        ` : ''}

        ${branding.accent ? `
          .bg-pink-500, .bg-rose-500 { background-color: var(--brand-accent) !important; }
          .text-pink-500, .text-rose-500 { color: var(--brand-accent) !important; }
          .bg-pink-50, .bg-rose-50 { background-color: color-mix(in srgb, var(--brand-accent) 10%, white) !important; }
          .shadow-pink-100 { box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--brand-accent) 20%, transparent) !important; }
        ` : ''}
      `}</style>

      {/* ELITE GLOBAL NAVIGATION */}
      <nav className="bg-white/80 border-b border-slate-200 sticky top-0 z-50 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-10">
             {/* LOGO AREA */}
             <Link to="/" className="flex items-center gap-3 group">
                <img 
                  src={branding.logoLight || "/logo.svg"}
                  alt="Desembre Logo" 
                  className="w-10 h-10 rounded-xl object-contain shadow-lg shadow-slate-200 transition-transform group-hover:scale-110" 
                />
                <div className="hidden md:block">
                   <span className="text-lg font-black text-slate-900 tracking-tighter">DESEMBRE</span>
                   <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-0.5">Partner Hub OS</p>
                </div>
             </Link>

             {/* MAIN MENU */}
             <div className="hidden lg:flex items-center gap-1">
                <NavButton to="/workspace" icon={LayoutDashboard} label="Workspace" />
                <NavButton to="/customers" icon={Users} label="Khách hàng" />
                <NavButton to="/orders" icon={Package} label="Đơn hàng" />
                <NavButton to="/admin/products" icon={Zap} label="Sản phẩm" />
                <NavButton to="/calendar" icon={Calendar} label="Lịch hẹn" />
                {(isAdmin || isTeleLead) && (
                   <NavButton to="/marketing" icon={Sparkles} label="Marketing" highlight />
                )}
             </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
                <NotificationBell />
                {isAdmin && (
                  <Link to="/admin/settings">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl text-slate-400 hover:text-slate-900">
                       <Settings className="w-5 h-5" />
                    </Button>
                  </Link>
                )}
             </div>

             {/* USER PROFILE */}
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <button className="flex items-center gap-3 p-1.5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs uppercase shadow-inner">
                         {user.email?.slice(0, 1) || "U"}
                      </div>
                      <div className="hidden md:block text-left mr-2">
                         <p className="text-xs font-black text-slate-900 leading-none">{user.email?.split('@')[0]}</p>
                         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                            {isAdmin ? "Administrator" : "Staff Member"}
                         </p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300" />
                   </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-none shadow-2xl p-2 mt-2 bg-white/95 backdrop-blur-xl">
                   <DropdownMenuItem asChild className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer">
                      <Link to="/profile" className="flex items-center gap-3">
                         <UserCircle className="w-4 h-4 text-slate-400" />
                         <span className="text-xs font-bold text-slate-700">Hồ sơ cá nhân</span>
                      </Link>
                   </DropdownMenuItem>
                   <DropdownMenuItem onClick={() => signOut()} className="rounded-xl focus:bg-rose-50 p-3 cursor-pointer group">
                      <div className="flex items-center gap-3">
                         <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                         <span className="text-xs font-bold text-slate-700 group-hover:text-rose-600">Đăng xuất</span>
                      </div>
                   </DropdownMenuItem>
                </DropdownMenuContent>
             </DropdownMenu>
          </div>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <main className="relative z-0">
        <Outlet />
      </main>

      <Toaster position="top-right" richColors />
    </div>
    </SystemSettingsProvider>
  );
}

function NavButton({ to, icon: Icon, label, highlight }: any) {
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all
        ${highlight ? 'text-indigo-600 hover:bg-indigo-50' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
      activeProps={{
        className: highlight ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-slate-900 text-white shadow-lg shadow-slate-200"
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}
