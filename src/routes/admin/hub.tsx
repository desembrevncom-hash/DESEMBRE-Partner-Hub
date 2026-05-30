import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Bot, 
  Settings2, 
  Activity, 
  ShieldCheck, 
  Zap, 
  Lock, 
  HeartPulse, 
  ShieldAlert,
  BarChart,
  BrainCircuit,
  DatabaseZap,
  ListTodo,
  Wrench,
  BookOpen,
  Shield,
  Radio
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/hub")({
  component: AdminControlHub,
});

function AdminControlHub() {
  const { isAdmin, isSubAdmin, loading, pilotModules } = useAuth();
  const [aiSettings, setAiSettings] = useState<any>(null);
  const [autoSettings, setAutoSettings] = useState<any>(null);

  useEffect(() => {
    if (isAdmin || isSubAdmin) {
      supabase.rpc("get_ai_settings_masked").then(({ data }: any) => {
        if (data) setAiSettings(data);
      });
      supabase.rpc("get_automation_governance_summary").then(({ data }: any) => {
        if (data?.settings) setAutoSettings(data.settings);
      });
    }
  }, [isAdmin, isSubAdmin]);

  if (loading) return <div className="p-8">Loading...</div>;

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">Trang Admin Control Hub chỉ dành riêng cho Quản trị viên.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  const groups = [
    {
      title: "System Configuration",
      icon: <Settings2 className="w-6 h-6 text-blue-500" />,
      description: "Cấu hình chung, thông tin pháp lý, mốc định vị và phân tuyến",
      links: [
        { label: "Global System Settings", to: "/admin/settings", icon: <Settings2 className="w-4 h-4" /> },
      ]
    },
    {
      title: "AI Control",
      icon: <BrainCircuit className="w-6 h-6 text-indigo-500" />,
      description: "Quản lý cài đặt AI, Suggestion Toggles và RAG",
      links: [
        { label: "AI Settings (Toggles)", to: "/admin/ai-settings", icon: <Settings2 className="w-4 h-4" /> },
        { label: "Product Knowledge (RAG Data)", to: "/admin/product-knowledge", icon: <BookOpen className="w-4 h-4" /> },
        { label: "Product Copilot Control", to: "/admin/product-copilot", icon: <Bot className="w-4 h-4" /> },
        { label: "AI Usage / Cost", to: "/admin/ai-debug", icon: <BarChart className="w-4 h-4" /> },
        { label: "RAG Audit", to: "/admin/rag-audit", icon: <DatabaseZap className="w-4 h-4" /> },
      ]
    },
    {
      title: "Automation Control",
      icon: <Zap className="w-6 h-6 text-amber-500" />,
      description: "Quy tắc tự động hóa, due generator & notification",
      links: [
        { label: "Automation Center", to: "/admin/automation", icon: <Activity className="w-4 h-4" /> },
        { label: "Automation Governance", to: "/admin/automation-governance", icon: <ShieldAlert className="w-4 h-4" /> },
        { label: "Due Generator", to: "/admin/automation-rules", icon: <ListTodo className="w-4 h-4" /> },
        { label: "Notification Switches", to: "/admin/automation-governance", icon: <BellIcon className="w-4 h-4" /> },
      ]
    },
    {
      title: "Safety & Rollout",
      icon: <ShieldCheck className="w-6 h-6 text-emerald-500" />,
      description: "Quản lý bảo mật, phân quyền và triển khai tính năng",
      links: [
        { label: "Production Health", to: "/admin/production-health", icon: <ShieldAlert className="w-4 h-4" /> },
        { label: "Security Audit", to: "/admin/security-audit", icon: <Lock className="w-4 h-4" /> },
        { label: "Internal Pilot Mode", to: "/admin/pilot", icon: <Wrench className="w-4 h-4" /> },
        { label: "UAT Checklist", to: "/admin/uat", icon: <CheckSquare className="w-4 h-4" /> },
      ]
    },
    {
      title: "CRM Health & Ops",
      icon: <HeartPulse className="w-6 h-6 text-rose-500" />,
      description: "Đánh giá sức khỏe hệ thống, chất lượng dữ liệu và điều phối luồng CRM",
      links: [
        { label: "CRM Ops Center", to: "/admin/crm-ops", icon: <Activity className="w-4 h-4" /> },
        { label: "CRM Health Dashboard", to: "/admin/crm-health", icon: <HeartPulse className="w-4 h-4" /> },
        { label: "Lead Performance", to: "/admin/lead-performance", icon: <BarChart className="w-4 h-4" /> },
        { label: "Data Quality", to: "/admin/crm-health", icon: <DatabaseZap className="w-4 h-4" /> },
        { label: "AI Readiness", to: "/admin/crm-health", icon: <Bot className="w-4 h-4" /> },
      ]
    },
    {
      title: "Marketing Infra",
      icon: <Shield className="w-6 h-6 text-violet-500" />,
      description: "Quản trị tài khoản gửi tin, health kênh và phân tuyến chiến dịch",
      links: [
        { label: "Sender Accounts", to: "/admin/sender-accounts", icon: <Radio className="w-4 h-4" /> },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 pb-20 font-sans antialiased">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Admin Control Hub</h1>
          <p className="text-sm text-slate-500 mt-1">Trung tâm điều khiển và cấu hình hệ thống dành cho Quản trị viên</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {groups.map((group, idx) => (
            <Card key={idx} className="rounded-2xl border-none shadow-sm hover:shadow-md transition-all bg-white overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                    {group.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-slate-800">{group.title}</CardTitle>
                    <CardDescription className="text-xs">{group.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              {group.title === "AI Control" && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Global AI</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
                      <span className={aiSettings?.ai_enabled ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {aiSettings?.ai_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Suggestions</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
                      <span className={aiSettings?.ai_customer_suggestions_enabled ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {aiSettings?.ai_customer_suggestions_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Daily Limit</span>
                    <span className="font-bold text-slate-900">{aiSettings?.ai_daily_limit || 0}</span>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Cache</span>
                    <span className="font-bold text-slate-900">{aiSettings?.ai_cache_minutes || 0}m</span>
                  </div>
                </div>
              )}

              {group.title === "Automation Control" && autoSettings && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Pilot Mode</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
                      <span className={autoSettings.pilot_mode_enabled ? "text-indigo-600 font-bold" : "text-amber-600 font-bold"}>
                        {autoSettings.pilot_mode_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Automation</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-rose-50 text-rose-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Disabled for Pilot</span>
                      <span className={autoSettings.automation_enabled ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {autoSettings.automation_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Due Gen</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-rose-50 text-rose-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Disabled for Pilot</span>
                      <span className={autoSettings.due_generator_enabled ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {autoSettings.due_generator_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>Notifications</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase tracking-wider">Active</span>
                      <span className={autoSettings.notification_enabled ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>
                        {autoSettings.notification_enabled ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {group.title === "Safety & Rollout" && pilotModules && pilotModules.length > 0 && (
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-600">
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>ON</span>
                    <span className="text-emerald-600 font-bold">
                      {pilotModules.filter(m => m.rollout_state === 'on').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>PILOT ONLY</span>
                    <span className="text-indigo-600 font-bold">
                      {pilotModules.filter(m => m.rollout_state === 'pilot_only').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>ADMIN ONLY</span>
                    <span className="text-amber-600 font-bold">
                      {pilotModules.filter(m => m.rollout_state === 'admin_only').length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded border border-slate-100">
                    <span>OFF</span>
                    <span className="text-rose-600 font-bold">
                      {pilotModules.filter(m => m.rollout_state === 'off').length}
                    </span>
                  </div>
                </div>
              )}
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {group.links.map((link, lIdx) => (
                    <li key={lIdx}>
                      <Link 
                        to={link.to}
                        className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors group/link"
                      >
                        <div className="text-slate-400 group-hover/link:text-indigo-600 transition-colors">
                          {link.icon}
                        </div>
                        <span className="text-sm font-medium text-slate-700 group-hover/link:text-slate-900">
                          {link.label}
                        </span>
                        <div className="ml-auto opacity-0 group-hover/link:opacity-100 text-indigo-400 transition-opacity">
                          &rarr;
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function BellIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CheckSquare(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}
