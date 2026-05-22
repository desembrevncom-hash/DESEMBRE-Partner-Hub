import { createFileRoute, Link } from '@tanstack/react-router';
import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Lock,
  Database,
  Zap,
  Globe,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  RefreshCw,
} from 'lucide-react';

export const Route = createFileRoute('/admin/security-audit')({
  component: SecurityAuditPage,
});

// ─── Data ────────────────────────────────────────────────────────────────────

type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type Status = 'PASS' | 'HARDENED' | 'PARTIAL' | 'OPEN';

interface AuditItem {
  id: string;
  module: string;
  check: string;
  status: Status;
  risk: RiskLevel;
  finding: string;
  remediation: string;
}

const AUDIT_ITEMS: AuditItem[] = [
  // ── Database RLS ─────────────────────────────────────────────────────────
  {
    id: 'db-ai-settings-select',
    module: 'DB: ai_settings',
    check: 'SELECT — Sales không đọc được',
    status: 'PASS',
    risk: 'critical',
    finding: 'RLS bật; policy chỉ cho phép admin/sub_admin.',
    remediation: 'Migration 20260601000000. Không cần thêm hành động.',
  },
  {
    id: 'db-ai-settings-update',
    module: 'DB: ai_settings',
    check: 'UPDATE — Sales không thay đổi được',
    status: 'PASS',
    risk: 'critical',
    finding: 'RLS + SECURITY DEFINER RPC update_ai_settings kiểm tra is_admin_or_sub_admin.',
    remediation: 'Migration 20260603000000 + 20260606000000. Đã đủ.',
  },
  {
    id: 'db-rag-audit-logs',
    module: 'DB: rag_audit_logs',
    check: 'ALL — chỉ admin quản lý',
    status: 'PASS',
    risk: 'high',
    finding: 'RLS bật; policy FOR ALL kiểm tra is_admin_or_sub_admin.',
    remediation: 'Migration 20260607000000. Không cần thêm hành động.',
  },
  {
    id: 'db-ai-conversation-logs-rls',
    module: 'DB: ai_conversation_logs',
    check: 'RLS được bật',
    status: 'HARDENED',
    risk: 'critical',
    finding: 'Table tạo không có RLS. Sales có thể đọc conversation log của người dùng khác.',
    remediation: 'Migration 20260608000000 (Phase P3) kích hoạt RLS + policies.',
  },
  {
    id: 'db-ai-conversation-logs-select',
    module: 'DB: ai_conversation_logs',
    check: 'SELECT — Sales chỉ thấy log của mình',
    status: 'HARDENED',
    risk: 'high',
    finding: 'Không có policy — mọi authenticated user đều đọc được.',
    remediation: 'Phase P3 thêm policy: user_id = auth.uid() OR is_admin_or_sub_admin.',
  },
  {
    id: 'db-ai-safety-events-rls',
    module: 'DB: ai_safety_events',
    check: 'RLS được bật',
    status: 'HARDENED',
    risk: 'critical',
    finding: 'Table tạo không có RLS. Safety events (PII + nội dung nhạy cảm) bị lộ.',
    remediation: 'Migration 20260608000000 (Phase P3) kích hoạt RLS + admin-only policy.',
  },
  {
    id: 'db-product-knowledge-draft',
    module: 'DB: product_knowledge',
    check: 'Sales không đọc draft/review',
    status: 'HARDENED',
    risk: 'medium',
    finding: 'Policy cũ chỉ lọc is_active=true, không lọc qa_status.',
    remediation: 'Phase P3 update policy: is_active=true AND qa_status=\'approved\'.',
  },
  {
    id: 'db-product-knowledge-chunks-inactive',
    module: 'DB: product_knowledge_chunks',
    check: 'Sales không đọc inactive chunks',
    status: 'HARDENED',
    risk: 'medium',
    finding: 'Policy cũ không filter is_active trên chunks.',
    remediation: 'Phase P3: policy mới lọc is_active=true và join product_knowledge approved.',
  },
  {
    id: 'db-ai-usage-logs',
    module: 'DB: ai_usage_logs',
    check: 'Sales không xem được usage logs',
    status: 'PASS',
    risk: 'medium',
    finding: 'RLS bật; policy SELECT chỉ cho is_admin_or_sub_admin.',
    remediation: 'Migration 20260521050000. Không cần thêm hành động.',
  },
  {
    id: 'db-ai-assistant-logs-insert',
    module: 'DB: ai_assistant_logs',
    check: 'INSERT — chỉ log của user mình',
    status: 'PASS',
    risk: 'low',
    finding: 'Policy INSERT WITH CHECK (user_id = auth.uid()).',
    remediation: 'Migration 20260521010000. Không cần thêm hành động.',
  },

  // ── RPC ──────────────────────────────────────────────────────────────────
  {
    id: 'rpc-update-ai-settings',
    module: 'RPC: update_ai_settings',
    check: 'Sales không gọi được',
    status: 'PASS',
    risk: 'critical',
    finding: 'SECURITY DEFINER + kiểm tra is_admin_or_sub_admin bên trong.',
    remediation: 'Migration 20260603000000. Không cần thêm hành động.',
  },
  {
    id: 'rpc-get-embedding-health',
    module: 'RPC: get_embedding_health_metrics',
    check: 'Sales không gọi được',
    status: 'HARDENED',
    risk: 'high',
    finding: 'SECURITY DEFINER nhưng không có kiểm tra role — mọi authenticated user đều gọi được.',
    remediation: 'Phase P3: thêm IF NOT is_admin_or_sub_admin THEN RAISE EXCEPTION.',
  },
  {
    id: 'rpc-get-stale-chunks',
    module: 'RPC: get_stale_chunks',
    check: 'Sales không gọi được',
    status: 'HARDENED',
    risk: 'high',
    finding: 'SECURITY DEFINER nhưng không có kiểm tra role.',
    remediation: 'Phase P3: thêm admin guard bên trong function.',
  },
  {
    id: 'rpc-cleanup-cache',
    module: 'RPC: cleanup_expired_cache',
    check: 'Sales không gọi được',
    status: 'HARDENED',
    risk: 'medium',
    finding: 'SECURITY DEFINER nhưng không có kiểm tra role.',
    remediation: 'Phase P3: thêm admin guard bên trong function.',
  },
  {
    id: 'rpc-get-cache-stats',
    module: 'RPC: get_cache_stats',
    check: 'Sales không gọi được',
    status: 'HARDENED',
    risk: 'medium',
    finding: 'SECURITY DEFINER nhưng không có kiểm tra role.',
    remediation: 'Phase P3: thêm admin guard bên trong function.',
  },

  // ── Edge Functions ────────────────────────────────────────────────────────
  {
    id: 'ef-embed-product-knowledge',
    module: 'Edge: embed-product-knowledge',
    check: 'Sales không invoke được',
    status: 'PASS',
    risk: 'critical',
    finding: 'Kiểm tra JWT + kiểm tra role admin trong body của function.',
    remediation: 'Đã đủ. Không cần thêm.',
  },
  {
    id: 'ef-test-ai-connection',
    module: 'Edge: test-ai-connection',
    check: 'Unauthenticated không gọi được',
    status: 'HARDENED',
    risk: 'critical',
    finding: 'Function không xác thực JWT — bất kỳ ai biết URL đều gọi được.',
    remediation: 'Phase P3: thêm JWT verify + admin role check (401/403).',
  },
  {
    id: 'ef-sales-debug-rag',
    module: 'Edge: ai-sales-assistant (debug_rag mode)',
    check: 'Sales không dùng debug_rag mode',
    status: 'HARDENED',
    risk: 'high',
    finding: 'Mode debug_rag thiếu role check — Sales có thể dùng để probe internal chunk data.',
    remediation: 'Phase P3: thêm is_admin_or_sub_admin check trước khi xử lý debug_rag.',
  },
  {
    id: 'ef-sales-rag-audit',
    module: 'Edge: ai-sales-assistant (rag_audit mode)',
    check: 'Sales không dùng rag_audit mode',
    status: 'PASS',
    risk: 'high',
    finding: 'Mode rag_audit đã có kiểm tra is_admin_or_sub_admin.',
    remediation: 'Đã đủ. Không cần thêm.',
  },

  // ── Frontend Routes ───────────────────────────────────────────────────────
  {
    id: 'fe-rag-audit-route',
    module: 'Route: /admin/rag-audit',
    check: 'Sales không thấy trang',
    status: 'PASS',
    risk: 'medium',
    finding: 'Có guard isAdminOrSubAdmin trong rag-audit.tsx.',
    remediation: 'Đã đủ.',
  },
  {
    id: 'fe-ai-debug-route',
    module: 'Route: /admin/ai-debug',
    check: 'Sales không thấy trang',
    status: 'PARTIAL',
    risk: 'high',
    finding: 'ai-debug.tsx dùng { isAdminOrSubAdmin } từ useAuth() — trước P3 biến này undefined.',
    remediation: 'Phase P3: useAuth.tsx export isAdminOrSubAdmin → guard hoạt động đúng.',
  },
  {
    id: 'fe-product-knowledge-route',
    module: 'Route: /admin/product-knowledge',
    check: 'Sales không thấy trang (write access)',
    status: 'PARTIAL',
    risk: 'medium',
    finding: 'product-knowledge.tsx dùng { isSalesMember, isAdminOrSubAdmin } — trước P3 là undefined.',
    remediation: 'Phase P3: useAuth.tsx export isSalesMember → guard hoạt động đúng.',
  },
  {
    id: 'fe-ai-settings-route',
    module: 'Route: /admin/ai-settings',
    check: 'Sales không thấy trang',
    status: 'HARDENED',
    risk: 'critical',
    finding: 'ai-settings.tsx không có page-level guard — Sales có thể navigate trực tiếp.',
    remediation: 'Phase P3: thêm if (!isAdminOrSubAdmin) return <LockScreen/>.',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ElementType }> = {
  PASS: { label: 'PASS', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  HARDENED: { label: 'HARDENED (P3)', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: ShieldCheck },
  PARTIAL: { label: 'PARTIAL (P3)', color: 'bg-amber-100 text-amber-800 border-amber-200', icon: AlertTriangle },
  OPEN: { label: 'OPEN', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

const RISK_CONFIG: Record<RiskLevel, { label: string; dot: string }> = {
  critical: { label: 'CRITICAL', dot: 'bg-red-500' },
  high: { label: 'HIGH', dot: 'bg-orange-500' },
  medium: { label: 'MEDIUM', dot: 'bg-amber-400' },
  low: { label: 'LOW', dot: 'bg-emerald-400' },
};

const MODULE_ICONS: Record<string, React.ElementType> = {
  'DB:': Database,
  'RPC:': Zap,
  'Edge:': Globe,
  'Route:': Lock,
};

function getModuleIcon(module: string) {
  for (const [prefix, Icon] of Object.entries(MODULE_ICONS)) {
    if (module.startsWith(prefix)) return Icon;
  }
  return Info;
}

// ─── Components ──────────────────────────────────────────────────────────────

function AuditRow({ item }: { item: AuditItem }) {
  const [open, setOpen] = useState(false);
  const StatusIcon = STATUS_CONFIG[item.status].icon;
  const ModuleIcon = getModuleIcon(item.module);
  const risk = RISK_CONFIG[item.risk];

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden transition-shadow hover:shadow-md">
      <button
        id={`audit-row-${item.id}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-white text-left group"
        onClick={() => setOpen(v => !v)}
      >
        {/* Module Icon */}
        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
          <ModuleIcon className="w-4 h-4 text-slate-500" />
        </div>

        {/* Module + Check */}
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{item.module}</p>
          <p className="text-sm font-semibold text-slate-800 truncate">{item.check}</p>
        </div>

        {/* Risk Badge */}
        <div className="hidden sm:flex items-center gap-1.5 shrink-0">
          <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
          <span className="text-[10px] font-bold text-slate-500 uppercase">{risk.label}</span>
        </div>

        {/* Status Badge */}
        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-bold ${STATUS_CONFIG[item.status].color}`}>
          <StatusIcon className="w-3 h-3" />
          {STATUS_CONFIG[item.status].label}
        </span>

        {/* Expand */}
        <div className="shrink-0 text-slate-400 group-hover:text-slate-700 transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-100 space-y-3 text-sm">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phát hiện</p>
            <p className="text-slate-700">{item.finding}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Biện pháp khắc phục</p>
            <p className="text-slate-700">{item.remediation}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: React.ElementType }) {
  return (
    <div className={`rounded-2xl p-5 flex items-center gap-4 ${color}`}>
      <div className="w-12 h-12 rounded-xl bg-white/40 flex items-center justify-center shrink-0">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-3xl font-black text-white">{value}</p>
        <p className="text-xs font-bold text-white/80 uppercase tracking-wider">{label}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SecurityAuditPage() {
  const { isAdminOrSubAdmin, loading: authLoading } = useAuth();
  const [filter, setFilter] = useState<Status | 'ALL'>('ALL');

  // Auth guard
  if (!authLoading && !isAdminOrSubAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Trang Kiểm tra Bảo mật chỉ dành riêng cho Admin hoặc Phó Admin.
        </p>
        <Link
          to="/workspace"
          className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all"
        >
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  // Stats
  const counts: Record<Status, number> = { PASS: 0, HARDENED: 0, PARTIAL: 0, OPEN: 0 };
  AUDIT_ITEMS.forEach(i => counts[i.status]++);

  const filtered = filter === 'ALL' ? AUDIT_ITEMS : AUDIT_ITEMS.filter(i => i.status === filter);

  // Group by module category
  const dbItems = filtered.filter(i => i.module.startsWith('DB:'));
  const rpcItems = filtered.filter(i => i.module.startsWith('RPC:'));
  const efItems = filtered.filter(i => i.module.startsWith('Edge:'));
  const feItems = filtered.filter(i => i.module.startsWith('Route:'));

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans antialiased">
      {/* Header */}
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-20 flex items-center justify-between max-w-6xl">
          <div className="flex items-center gap-4">
            <Link
              to="/workspace"
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-slate-900 border border-transparent hover:border-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600" />
                <h1 className="text-lg font-black text-slate-900 tracking-tight">Security Audit Report</h1>
              </div>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Phase P3 — Permission Penetration Test & Hardening</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 uppercase tracking-widest">
              {AUDIT_ITEMS.length} checks total
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 max-w-6xl py-8 space-y-8">

        {/* Summary Cards */}
        <section>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-4">Tổng quan</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="PASS" value={counts.PASS} color="bg-emerald-500" icon={CheckCircle2} />
            <StatCard label="HARDENED (P3)" value={counts.HARDENED} color="bg-blue-600" icon={ShieldCheck} />
            <StatCard label="PARTIAL (P3)" value={counts.PARTIAL} color="bg-amber-500" icon={AlertTriangle} />
            <StatCard label="OPEN" value={counts.OPEN} color="bg-red-500" icon={XCircle} />
          </div>
        </section>

        {/* Legend */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-2 text-sm text-slate-600">
          <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">Chú thích</h3>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" /><span><strong>PASS</strong> — Đã bảo mật từ trước, không cần thêm hành động.</span></div>
            <div className="flex items-start gap-2"><ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" /><span><strong>HARDENED</strong> — Lỗ hổng được phát hiện và vá trong Phase P3.</span></div>
            <div className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" /><span><strong>PARTIAL</strong> — Bug frontend được fix trong P3 (biến undefined).</span></div>
            <div className="flex items-start gap-2"><XCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" /><span><strong>OPEN</strong> — Chưa xử lý (hiện không có).</span></div>
          </div>
        </section>

        {/* Filter */}
        <section>
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'PASS', 'HARDENED', 'PARTIAL', 'OPEN'] as const).map(s => (
              <button
                key={s}
                id={`filter-${s.toLowerCase()}`}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  filter === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                }`}
              >
                {s === 'ALL' ? `Tất cả (${AUDIT_ITEMS.length})` : `${STATUS_CONFIG[s].label} (${counts[s]})`}
              </button>
            ))}
          </div>
        </section>

        {/* Groups */}
        {[
          { label: '🗄️ Database RLS & Policies', items: dbItems },
          { label: '⚡ RPC Functions', items: rpcItems },
          { label: '🌐 Edge Functions', items: efItems },
          { label: '🔒 Frontend Route Guards', items: feItems },
        ].map(({ label, items }) =>
          items.length === 0 ? null : (
            <section key={label}>
              <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-3">{label}</h2>
              <div className="space-y-2">
                {items.map(item => <AuditRow key={item.id} item={item} />)}
              </div>
            </section>
          )
        )}

        {/* Footer note */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-5 flex gap-3 items-start">
          <Info className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
          <div className="text-sm text-indigo-700">
            <p className="font-bold mb-1">Phạm vi kiểm tra Phase P3</p>
            <p>
              Audit bao gồm toàn bộ 8 bảng AI (ai_settings, rag_audit_logs, ai_safety_events, ai_conversation_logs,
              product_knowledge, product_knowledge_chunks, ai_usage_logs, ai_assistant_logs), 5 RPCs, 2 Edge Functions
              và 4 Frontend Routes. Không thêm AI feature mới trong phase này.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
