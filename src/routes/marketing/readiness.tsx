// @ts-nocheck
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  ShieldAlert, UserCheck, AlertOctagon, Mail, MessageCircle, AlertTriangle, 
  Search, Shield, Users, CheckCircle2, XCircle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { getReadinessStatus, getExclusionReason } from "@/lib/marketing/readiness";

export const Route = createFileRoute("/marketing/readiness")({
  component: MarketingDashboardPage,
});

function MarketingDashboardPage() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [audienceList, setAudienceList] = useState<any[]>([]);
  const [limitWarning, setLimitWarning] = useState(false);

  // Filters
  const [channelFilter, setChannelFilter] = useState<'email' | 'zalo'>('email');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'no_consent' | 'excluded' | 'invalid_contact'>('all');
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [
        { data: customers },
        { data: consents },
        { data: zaloProfiles },
        { data: dupPhones },
        { data: dupEmails }
      ] = await Promise.all([
        supabase.from("customers").select("*").order('created_at', { ascending: false }).limit(5000),
        supabase.from("customer_consents").select("*"),
        supabase.from("customer_zalo_profiles").select("*"),
        supabase.from("v_customers_duplicate_phone").select("customer_ids").limit(1000),
        supabase.from("v_customers_duplicate_email").select("customer_ids").limit(1000)
      ]);

      if (customers && customers.length >= 5000) {
        setLimitWarning(true);
      }

      const duplicateIds = new Set<string>();
      dupPhones?.forEach((d: any) => d.customer_ids?.forEach((id: string) => duplicateIds.add(id)));
      dupEmails?.forEach((d: any) => d.customer_ids?.forEach((id: string) => duplicateIds.add(id)));

      const consentMap = new Map<string, any[]>();
      consents?.forEach(c => {
        if (!consentMap.has(c.customer_id)) consentMap.set(c.customer_id, []);
        consentMap.get(c.customer_id)!.push(c);
      });

      const zaloProfileMap = new Map<string, any>();
      zaloProfiles?.forEach(zp => zaloProfileMap.set(zp.customer_id, zp));

      const processed = (customers || []).map(c => {
        const isBlocked = c.status === 'blocked' || c.status === 'lost' || c.status === 'inactive';
        const isDuplicate = duplicateIds.has(c.id);
        const cConsents = consentMap.get(c.id) || [];
        
        const emailConsent = cConsents.find(x => x.channel === 'email');
        const zaloConsent = cConsents.find(x => x.channel === 'zalo' || x.channel === 'zalo_oa');
        const hasOptOut = cConsents.some(x => x.opt_out_at != null);

        const emailReadiness = getReadinessStatus(c, 'email', isDuplicate, consentMap, zaloProfileMap);
        const emailReason = getExclusionReason(c, 'email', isDuplicate, consentMap, zaloProfileMap);
        const zaloReadiness = getReadinessStatus(c, 'zalo', isDuplicate, consentMap, zaloProfileMap);
        const zaloReason = getExclusionReason(c, 'zalo', isDuplicate, consentMap, zaloProfileMap);

        return {
          ...c,
          emailReadiness,
          emailReason,
          zaloReadiness,
          zaloReason,
          emailConsent,
          zaloConsent
        };
      });

      setAudienceList(processed);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredAudience = useMemo(() => {
    return audienceList.filter(c => {
      // 1. Channel readiness filter
      const readiness = channelFilter === 'email' ? c.emailReadiness : c.zaloReadiness;
      if (statusFilter !== 'all' && readiness !== statusFilter) return false;

      // 2. Search query
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchEmail = c.email?.toLowerCase().includes(q);
        const matchPhone = c.phone?.includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }

      return true;
    });
  }, [audienceList, channelFilter, statusFilter, searchQuery]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredAudience.slice(start, start + PAGE_SIZE);
  }, [filteredAudience, currentPage]);

  const totalPages = Math.ceil(filteredAudience.length / PAGE_SIZE);

  // Compute Summary Metrics
  const summary = useMemo(() => {
    const s = {
      emailReady: 0, emailNoConsent: 0, emailExcluded: 0, emailInvalid: 0,
      zaloReady: 0, zaloNoConsent: 0, zaloExcluded: 0, zaloInvalid: 0,
    };
    audienceList.forEach(c => {
      if (c.emailReadiness === 'ready') s.emailReady++;
      else if (c.emailReadiness === 'no_consent') s.emailNoConsent++;
      else if (c.emailReadiness === 'excluded') s.emailExcluded++;
      else if (c.emailReadiness === 'invalid_contact') s.emailInvalid++;

      if (c.zaloReadiness === 'ready') s.zaloReady++;
      else if (c.zaloReadiness === 'no_consent') s.zaloNoConsent++;
      else if (c.zaloReadiness === 'excluded') s.zaloExcluded++;
      else if (c.zaloReadiness === 'invalid_contact') s.zaloInvalid++;
    });
    return s;
  }, [audienceList]);

  if (loading) {
    return <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-8 text-slate-500 font-medium animate-pulse">Đang tải dữ liệu Marketing Readiness...</div>;
  }

  const currentSummary = {
    ready: channelFilter === 'email' ? summary.emailReady : summary.zaloReady,
    noConsent: channelFilter === 'email' ? summary.emailNoConsent : summary.zaloNoConsent,
    excluded: channelFilter === 'email' ? summary.emailExcluded : summary.zaloExcluded,
    invalid: channelFilter === 'email' ? summary.emailInvalid : summary.zaloInvalid
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20 font-sans">
      <header className="bg-white/80 border-b border-slate-200 sticky top-0 z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between max-w-7xl">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
                <Shield className="w-5 h-5" />
             </div>
             <div>
                <h1 className="text-lg font-black text-slate-900 tracking-tight">Marketing Readiness Dashboard</h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1">
                   Khảo sát & Phân tích chất lượng dữ liệu Remarketing
                </p>
             </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl space-y-6">
        
        {/* WARNING BANNER */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-bold text-amber-800 text-sm">Dashboard này chỉ đo lường mức độ sẵn sàng (Readiness)</h3>
            <p className="text-amber-700 text-xs mt-1">Hệ thống tuân thủ chặt chẽ các chính sách bảo vệ quyền riêng tư & chống Spam hiện hành. Chỉ những khách hàng đã Opt-in và có thông tin hợp lệ mới được đưa vào nhóm "Ready". Lưu ý: Hiện tại hệ thống chưa kích hoạt tính năng gửi Email/Zalo thực tế.</p>
          </div>
        </div>

        {limitWarning && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-3 items-center text-xs text-blue-700">
            <AlertOctagon className="w-4 h-4 shrink-0" />
            <span>Dữ liệu preview hiện đang bị giới hạn ở mức 5.000 khách hàng mới nhất để đảm bảo hiệu suất MVP.</span>
          </div>
        )}

        {/* TABS FOR CHANNEL */}
        <div className="flex bg-white p-1 rounded-xl w-max border border-slate-200 shadow-sm">
          <button 
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${channelFilter === 'email' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => { setChannelFilter('email'); setStatusFilter('all'); setCurrentPage(1); }}
          >
            <Mail className="w-4 h-4" /> Phân tích Kênh Email
          </button>
          <button 
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${channelFilter === 'zalo' ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            onClick={() => { setChannelFilter('zalo'); setStatusFilter('all'); setCurrentPage(1); }}
          >
            <MessageCircle className="w-4 h-4" /> Phân tích Kênh Zalo
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
           <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-emerald-50">
             <CardContent className="p-5 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{channelFilter} Ready</p>
                 <h3 className="text-2xl font-black text-emerald-900 mt-1">{currentSummary.ready.toLocaleString()}</h3>
               </div>
               <div className="w-10 h-10 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700"><CheckCircle2 className="w-5 h-5" /></div>
             </CardContent>
           </Card>
           
           <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-amber-50">
             <CardContent className="p-5 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">No Consent</p>
                 <h3 className="text-2xl font-black text-amber-900 mt-1">{currentSummary.noConsent.toLocaleString()}</h3>
               </div>
               <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center text-amber-700"><ShieldAlert className="w-5 h-5" /></div>
             </CardContent>
           </Card>

           <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-rose-50">
             <CardContent className="p-5 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Excluded / Blocked</p>
                 <h3 className="text-2xl font-black text-rose-900 mt-1">{currentSummary.excluded.toLocaleString()}</h3>
               </div>
               <div className="w-10 h-10 rounded-full bg-rose-200 flex items-center justify-center text-rose-700"><XCircle className="w-5 h-5" /></div>
             </CardContent>
           </Card>

           <Card className="rounded-2xl border-none shadow-sm overflow-hidden bg-slate-100">
             <CardContent className="p-5 flex items-center justify-between">
               <div>
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Invalid Contact</p>
                 <h3 className="text-2xl font-black text-slate-800 mt-1">{currentSummary.invalid.toLocaleString()}</h3>
               </div>
               <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-500"><AlertOctagon className="w-5 h-5" /></div>
             </CardContent>
           </Card>
        </div>

        {/* AUDIENCE PREVIEW TABLE */}
        <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-500" /> Preview Audience ({filteredAudience.length})
            </h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input 
                  placeholder="Tìm Tên, SĐT, Email..." 
                  className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50 focus-visible:ring-indigo-500"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>
              <select 
                className="h-9 px-3 rounded-xl border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-500"
                value={statusFilter}
                onChange={e => { setStatusFilter(e.target.value as any); setCurrentPage(1); }}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="ready">Ready (Đủ đk)</option>
                <option value="no_consent">No Consent</option>
                <option value="excluded">Excluded</option>
                <option value="invalid_contact">Invalid Contact</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-5 py-4">Khách hàng</th>
                  <th className="px-5 py-4">Liên hệ</th>
                  <th className="px-5 py-4">Channel</th>
                  <th className="px-5 py-4 text-center">Readiness</th>
                  <th className="px-5 py-4">Reason / Consent</th>
                  <th className="px-5 py-4">Last Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-700">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">Không tìm thấy khách hàng nào khớp với bộ lọc.</td>
                  </tr>
                ) : (
                  paginatedData.map(c => {
                    const readiness = channelFilter === 'email' ? c.emailReadiness : c.zaloReadiness;
                    const reason = channelFilter === 'email' ? c.emailReason : c.zaloReason;
                    
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <p className="font-bold text-slate-900">{c.name}</p>
                          <p className="text-[10px] text-slate-400">ID: {c.id.split('-')[0]}...</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className={!c.phone ? 'text-slate-300' : ''}>{c.phone || 'N/A'}</p>
                          <p className={!c.email ? 'text-slate-300' : ''}>{c.email || 'N/A'}</p>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 border-none font-bold uppercase text-[9px]">
                            {channelFilter}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-center">
                          {readiness === 'ready' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold">READY</Badge>}
                          {readiness === 'no_consent' && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-bold">NO CONSENT</Badge>}
                          {readiness === 'excluded' && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none font-bold">EXCLUDED</Badge>}
                          {readiness === 'invalid_contact' && <Badge className="bg-slate-200 text-slate-600 hover:bg-slate-200 border-none font-bold">INVALID</Badge>}
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-slate-600 font-semibold">{reason}</p>
                          <p className="text-[10px] text-slate-400">{c.source || 'Unknown source'}</p>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-slate-500">
                          {c.last_contacted_at ? format(new Date(c.last_contacted_at), 'dd/MM/yyyy') : 'Never'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">
                Trang {currentPage} / {totalPages} (Tổng {filteredAudience.length})
              </span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                >
                  Trước
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-600 disabled:opacity-50 hover:bg-slate-50"
                >
                  Tiếp
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
