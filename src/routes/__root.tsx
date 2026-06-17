/* eslint-disable */
import { createRootRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
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
  UserCircle,
  FileText,
  Menu,
  BarChart,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { PilotFeedbackButton } from "@/components/layout/PilotFeedbackButton";
import { AppErrorBoundary } from "@/components/system/AppErrorBoundary";
import { CommandPalette } from "@/components/crm/CommandPalette";
import { ProductCopilot } from "@/components/chat/ProductCopilot";
import { ProductCopilotProvider } from "@/components/chat/ProductCopilotContext";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { user, signOut, isAdmin, isSubAdmin, isTeleLead, isSale } = useAuth();
  const [branding, setBranding] = useState({
    primary: "",
    accent: "",
    logoLight: "",
    logoDark: "",
  });
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const showCopilot = currentPath.startsWith("/customers") || currentPath.startsWith("/workspace");

  useEffect(() => {
    supabase
      .from("system_settings")
      .select("primary_color, accent_color, logo_light_url, logo_dark_url")
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (data) {
          setBranding({
            primary: data.primary_color,
            accent: data.accent_color,
            logoLight: data.logo_light_url,
            logoDark: data.logo_dark_url,
          });
        }
      });
  }, []);

  if (!user) {
    return (
      <AppErrorBoundary>
        <Outlet />
        <Toaster position="top-right" richColors />
      </AppErrorBoundary>
    );
  }

  return (
    <SystemSettingsProvider>
      <ProductCopilotProvider>
        <div className="min-h-screen bg-[#f8fafc] font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
          <style>{`
        :root {
          ${branding.primary ? `--brand-primary: ${branding.primary};` : ""}
          ${branding.accent ? `--brand-accent: ${branding.accent};` : ""}
        }
        
        ${
          branding.primary
            ? `
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
        `
            : ""
        }

        ${
          branding.accent
            ? `
          .bg-pink-500, .bg-rose-500 { background-color: var(--brand-accent) !important; }
          .text-pink-500, .text-rose-500 { color: var(--brand-accent) !important; }
          .bg-pink-50, .bg-rose-50 { background-color: color-mix(in srgb, var(--brand-accent) 10%, white) !important; }
          .shadow-pink-100 { box-shadow: 0 4px 6px -1px color-mix(in srgb, var(--brand-accent) 20%, transparent) !important; }
        `
            : ""
        }
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
                  <div className="hidden md:flex flex-col justify-center">
                    <span className="text-lg font-black text-slate-900 tracking-tighter leading-none whitespace-nowrap">
                      DESEMBRE
                    </span>
                    <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest leading-none mt-1 whitespace-nowrap">
                      Partner Hub OS
                    </p>
                  </div>
                </Link>

                {/* MAIN MENU */}
                <div className="hidden lg:flex items-center gap-1">
                  <NavButton to="/workspace" icon={LayoutDashboard} label="Workspace" />
                  <NavButton to="/customers" icon={Users} label="Khách hàng" />
                  <NavButton to="/orders" icon={Package} label="Đơn hàng" />
                  <NavButton to="/admin/products" icon={Zap} label="Sản phẩm" />
                  <NavButton to="/calendar" icon={Calendar} label="Lịch hẹn" />
                  <NavButton to="/reports/sales" icon={BarChart} label="Báo cáo" />
                  {(isAdmin || isSubAdmin || isTeleLead || isSale) && (
                    <NavButton to="/marketing" icon={Sparkles} label="Marketing" highlight />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 pr-4 lg:border-r border-slate-100">
                  <NotificationBell />
                </div>

                {/* USER PROFILE */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="hidden lg:flex items-center gap-3 p-1.5 rounded-2xl hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-xs uppercase shadow-inner">
                        {user.email?.slice(0, 1) || "U"}
                      </div>
                      <div className="hidden md:block text-left mr-2">
                        <p className="text-xs font-black text-slate-900 leading-none">
                          {user.email?.split("@")[0]}
                        </p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                          {isAdmin ? "Administrator" : "Staff Member"}
                        </p>
                      </div>
                      <ChevronDown className="w-4 h-4 text-slate-300" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-56 rounded-2xl border-none shadow-2xl p-2 mt-2 bg-white/95 backdrop-blur-xl"
                  >
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/profile" className="flex items-center gap-3">
                        <UserCircle className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Hồ sơ cá nhân</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/settings/communication" className="flex items-center gap-3">
                        <Settings className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Tài khoản liên hệ</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/settings/message-templates" className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Mẫu tin nhắn</span>
                      </Link>
                    </DropdownMenuItem>
                    {(isAdmin || isSubAdmin) && (
                      <>
                        <DropdownMenuItem
                          asChild
                          className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                        >
                          <Link to="/admin/templates" className="flex items-center gap-3">
                            <FileText className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">
                              Mẫu Tài Liệu (Templates)
                            </span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                        >
                          <Link to="/admin/ai-settings" className="flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">
                              Cấu hình AI / RAG
                            </span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          asChild
                          className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                        >
                          <Link to="/marketing/consent" className="flex items-center gap-3">
                            <ShieldCheck className="w-4 h-4 text-slate-400" />
                            <span className="text-xs font-bold text-slate-700">
                              Consent Registry
                            </span>
                          </Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem
                      onClick={() => signOut()}
                      className="rounded-xl focus:bg-rose-50 p-3 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-500" />
                        <span className="text-xs font-bold text-slate-700 group-hover:text-rose-600">
                          Đăng xuất
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </nav>

          {/* PAGE CONTENT */}
          <main
            className={`relative z-0 lg:pb-0 ${currentPath === "/customers/map" ? "pb-0" : "pb-[calc(env(safe-area-inset-bottom,0px)+96px)]"}`}
          >
            <AppErrorBoundary>
              <Outlet />
            </AppErrorBoundary>
          </main>

          {/* MOBILE BOTTOM NAVIGATION */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-xl lg:hidden flex justify-around items-center h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-2 shadow-lg">
            <MobileNavButton to="/workspace" icon={LayoutDashboard} label="Workspace" />
            <MobileNavButton to="/customers" icon={Users} label="Khách hàng" />
            <MobileNavButton to="/calendar" icon={Calendar} label="Lịch hẹn" />
            <MobileNavButton to="/orders" icon={Package} label="Đơn hàng" />
            <MobileNavButton to="/reports/sales" icon={BarChart} label="Báo cáo" />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex flex-col items-center justify-center flex-1 h-full text-slate-500 hover:text-slate-900 transition-colors focus:outline-none">
                  <Menu className="w-5 h-5 mb-0.5" />
                  <span className="text-[10px] font-black uppercase tracking-wider">Thêm</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 rounded-2xl border-none shadow-2xl p-2 mb-2 bg-white/95 backdrop-blur-xl z-50"
              >
                <DropdownMenuItem
                  asChild
                  className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                >
                  <Link to="/admin/products" className="flex items-center gap-3">
                    <Zap className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Sản phẩm</span>
                  </Link>
                </DropdownMenuItem>
                {(isAdmin || isSubAdmin || isTeleLead || isSale) && (
                  <DropdownMenuItem
                    asChild
                    className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                  >
                    <Link to="/marketing" className="flex items-center gap-3">
                      <Sparkles className="w-4 h-4 text-slate-400" />
                      <span className="text-xs font-bold text-slate-700">Marketing</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  asChild
                  className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                >
                  <Link to="/profile" className="flex items-center gap-3">
                    <UserCircle className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Hồ sơ cá nhân</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                >
                  <Link to="/settings/communication" className="flex items-center gap-3">
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Tài khoản liên hệ</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  asChild
                  className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                >
                  <Link to="/settings/message-templates" className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Mẫu tin nhắn</span>
                  </Link>
                </DropdownMenuItem>
                {(isAdmin || isSubAdmin) && (
                  <>
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/admin/templates" className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">
                          Mẫu Tài Liệu (Templates)
                        </span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/admin/ai-settings" className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Cấu hình AI / RAG</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      asChild
                      className="rounded-xl focus:bg-slate-50 p-3 cursor-pointer"
                    >
                      <Link to="/marketing/consent" className="flex items-center gap-3">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-700">Consent Registry</span>
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className="rounded-xl focus:bg-rose-50 p-3 cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <LogOut className="w-4 h-4 text-slate-450 group-hover:text-rose-500" />
                    <span className="text-xs font-bold text-slate-700 group-hover:text-rose-600">
                      Đăng xuất
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <PilotFeedbackButton />
          <Toaster position="top-right" richColors />
          <CommandPalette />
          {showCopilot && <ProductCopilot />}
        </div>
      </ProductCopilotProvider>
    </SystemSettingsProvider>
  );
}

function NavButton({ to, icon: Icon, label, highlight }: any) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
        highlight
          ? "text-indigo-600 hover:bg-indigo-50"
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
      }`}
      activeProps={{
        className: highlight
          ? "bg-indigo-600 !text-white shadow-lg shadow-indigo-200"
          : "bg-slate-900 !text-white shadow-lg shadow-slate-200",
      }}
    >
      <Icon className="w-4 h-4" />
      {label}
    </Link>
  );
}

function MobileNavButton({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center flex-1 h-full text-slate-500 hover:text-slate-900 transition-colors"
      activeProps={{
        className: "!text-indigo-600 font-bold",
      }}
    >
      <Icon className="w-5 h-5 mb-0.5" />
      <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
    </Link>
  );
}
