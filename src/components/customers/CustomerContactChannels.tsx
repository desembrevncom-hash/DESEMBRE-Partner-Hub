import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, ExternalLink, Copy, Target, CheckCircle2, AlertCircle, RefreshCw, XCircle } from "lucide-react";

interface CustomerContactChannelsProps {
  customerId: string;
}

export function CustomerContactChannels({ customerId }: CustomerContactChannelsProps) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    channelType: "zalo",
    value: "",
    scope: isAdmin || isSubAdmin ? "official" : "private",
    remarketingEnabled: false,
    notes: ""
  });

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);

      // Fetch user profiles for created_by
      const uids = [...new Set(data?.map(c => c.created_by).filter(Boolean))];
      if (uids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, display_name, email").in("id", uids);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach(p => map[p.id] = p.display_name || p.email || 'Unknown');
          setProfiles(map);
        }
      }

    } catch (err: any) {
      console.error("Error fetching channels:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customerId) fetchChannels();
  }, [customerId]);

  const handleAddChannel = async () => {
    if (!form.value.trim()) {
      toast.error("Vui lòng nhập giá trị/link/số điện thoại");
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("resolve-contact-channel", {
        body: {
          customerId,
          channelType: form.channelType,
          value: form.value,
          scope: form.scope,
          remarketing_enabled: form.remarketingEnabled,
          notes: form.notes
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Thêm kênh liên hệ thành công!");
      setForm(prev => ({ ...prev, value: "", notes: "" }));
      fetchChannels();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi thêm kênh liên hệ");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleRemarketing = async (id: string, currentVal: boolean) => {
    try {
      const { error } = await supabase
        .from("customer_contact_channels")
        .update({ remarketing_enabled: !currentVal })
        .eq("id", id);
      if (error) throw error;
      toast.success("Đã cập nhật trạng thái remarketing");
      setChannels(prev => prev.map(c => c.id === id ? { ...c, remarketing_enabled: !currentVal } : c));
    } catch (err: any) {
      toast.error("Lỗi cập nhật: " + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy!");
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'verified': return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none"><CheckCircle2 className="w-3 h-3 mr-1"/> Đã xác thực</Badge>;
      case 'failed': return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none"><XCircle className="w-3 h-3 mr-1"/> Lỗi xác thực</Badge>;
      case 'manual': return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none"><AlertCircle className="w-3 h-3 mr-1"/> Thủ công</Badge>;
      default: return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-200 border-none"><RefreshCw className="w-3 h-3 mr-1"/> Chờ xử lý</Badge>;
    }
  };

  const officialChannels = channels.filter(c => c.scope === "official");
  const privateChannels = channels.filter(c => c.scope === "private");

  return (
    <div className="space-y-6">
      
      {/* Thêm kênh mới Form */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Thêm kênh liên hệ mới
        </h4>
        <div className="grid grid-cols-12 gap-3 items-end">
          <div className="col-span-12 sm:col-span-3 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Loại kênh</Label>
            <Select value={form.channelType} onValueChange={(v) => setForm({...form, channelType: v})}>
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zalo">Zalo</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="other">Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-4 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Giá trị (Link/SĐT/Email)</Label>
            <Input 
              value={form.value}
              onChange={(e) => setForm({...form, value: e.target.value})}
              placeholder="Nhập link hoặc số..."
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <div className="col-span-12 sm:col-span-3 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Phạm vi</Label>
            <Select 
              value={form.scope} 
              onValueChange={(v) => setForm({...form, scope: v})}
              disabled={!(isAdmin || isSubAdmin)}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(isAdmin || isSubAdmin) && <SelectItem value="official" className="font-bold text-indigo-700">Official (Hệ thống)</SelectItem>}
                <SelectItem value="private">Private (Riêng tư)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-12 sm:col-span-2">
            <Button 
              onClick={handleAddChannel} 
              disabled={adding || !form.value.trim()}
              className="w-full h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-primary text-white"
            >
              {adding ? <Loader2 className="w-3 h-3 animate-spin mr-1"/> : <Plus className="w-3 h-3 mr-1" />}
              Thêm
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-300" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Official Channels */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Kênh chính thức (Official)</h4>
            {officialChannels.length === 0 ? (
              <div className="text-xs text-slate-400 italic px-2 py-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">Chưa có kênh chính thức</div>
            ) : (
              officialChannels.map(c => (
                <div key={c.id} className="p-3 bg-white border border-indigo-100 rounded-2xl shadow-sm hover:shadow transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
                  <div className="flex items-start justify-between gap-3 ml-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 capitalize">{c.channel_type}</span>
                        {renderStatus(c.resolve_status)}
                        {c.remarketing_enabled && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none"><Target className="w-3 h-3 mr-1"/> Remarketing</Badge>}
                      </div>
                      <div className="text-sm font-medium text-slate-600 mt-1 truncate max-w-[200px]" title={c.channel_value}>
                        {c.normalized_value || c.channel_value}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => copyToClipboard(c.normalized_value || c.channel_value)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      {(c.channel_type !== 'zalo' || c.normalized_value?.includes('zalo.me')) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => window.open(c.channel_value.startsWith('http') ? c.channel_value : `https://${c.channel_value}`, '_blank')}>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Private Channels */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Kênh riêng tư (Private)</h4>
            {privateChannels.length === 0 ? (
              <div className="text-xs text-slate-400 italic px-2 py-4 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">Chưa có kênh riêng tư</div>
            ) : (
              privateChannels.map(c => (
                <div key={c.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>
                  <div className="flex items-start justify-between gap-3 ml-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800 capitalize">{c.channel_type}</span>
                        {renderStatus(c.resolve_status)}
                      </div>
                      <div className="text-sm font-medium text-slate-600 mt-1 truncate max-w-[200px]" title={c.channel_value}>
                        {c.normalized_value || c.channel_value}
                      </div>
                      {(isAdmin || isSubAdmin) && (
                        <div className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
                          Bởi: <strong>{profiles[c.created_by] || 'Unknown'}</strong>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-primary" onClick={() => copyToClipboard(c.normalized_value || c.channel_value)}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
