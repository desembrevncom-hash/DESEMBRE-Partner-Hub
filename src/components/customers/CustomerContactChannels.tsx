import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Plus, ExternalLink, Copy, Target, CheckCircle2, AlertCircle,
  RefreshCw, XCircle, Star, StarOff, ShoppingCart, HeadphonesIcon,
  FileText, User, HelpCircle, Lock, Globe, Phone
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createContactChannel } from "@/lib/contactChannels";

interface CustomerContactChannelsProps {
  customerId: string;
}

const CHANNEL_TYPE_ICONS: Record<string, string> = {
  zalo: "💬",
  facebook: "📘",
  email: "📧",
  tiktok: "🎵",
  instagram: "📸",
  website: "🌐",
  phone: "📞",
  other: "🔗",
};

const PURPOSE_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  sales:       { label: "Sales",       color: "bg-blue-100 text-blue-700",    Icon: ShoppingCart },
  support:     { label: "Hỗ trợ",      color: "bg-teal-100 text-teal-700",    Icon: HeadphonesIcon },
  remarketing: { label: "Remarketing", color: "bg-amber-100 text-amber-700",   Icon: Target },
  invoice:     { label: "Hóa đơn",     color: "bg-violet-100 text-violet-700", Icon: FileText },
  personal:    { label: "Cá nhân",     color: "bg-pink-100 text-pink-700",     Icon: User },
  other:       { label: "Khác",        color: "bg-slate-100 text-slate-500",   Icon: HelpCircle },
};

export function CustomerContactChannels({ customerId }: CustomerContactChannelsProps) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [togglingPrimary, setTogglingPrimary] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    channelType: "zalo",
    value: "",
    scope: isAdmin || isSubAdmin ? "official" : "private",
    channelPurpose: "sales",
    isPrimary: false,
    notes: ""
  });

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customer_contact_channels")
        .select("*")
        .eq("customer_id", customerId)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      setChannels(data || []);

      // Fetch user profiles for created_by
      const uids = [...new Set(data?.map((c: any) => c.created_by).filter(Boolean))];
      if (uids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", uids as string[]);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach((p: any) => (map[p.id] = p.display_name || p.email || "Unknown"));
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
      const { data, error } = await createContactChannel({
        customerId,
        channelType: form.channelType,
        value: form.value,
        scope: form.scope,
        channel_purpose: form.channelPurpose,
        is_primary: form.isPrimary,
        notes: form.notes,
        user
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Thêm kênh liên hệ thành công!");
      setForm((prev) => ({ ...prev, value: "", notes: "", isPrimary: false }));
      fetchChannels();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi thêm kênh liên hệ");
    } finally {
      setAdding(false);
    }
  };

  const handleSetPrimary = async (channel: any) => {
    if (togglingPrimary) return;
    setTogglingPrimary(channel.id);
    try {
      const newVal = !channel.is_primary;

      if (newVal) {
        // Unset all other primaries for same customer + scope + owner
        const { error: unsetErr } = await supabase
          .from("customer_contact_channels")
          .update({ is_primary: false })
          .eq("customer_id", customerId)
          .eq("scope", channel.scope)
          .eq("owner_user_id", channel.owner_user_id || user?.id)
          .neq("id", channel.id);
        if (unsetErr) throw unsetErr;
      }

      const { error } = await supabase
        .from("customer_contact_channels")
        .update({ is_primary: newVal })
        .eq("id", channel.id);
      if (error) throw error;

      toast.success(newVal ? "Đã đặt làm kênh chính!" : "Đã bỏ kênh chính");
      // Optimistic update
      setChannels((prev) =>
        prev
          .map((c) => {
            if (c.id === channel.id) return { ...c, is_primary: newVal };
            if (
              newVal &&
              c.scope === channel.scope &&
              (c.owner_user_id || user?.id) === (channel.owner_user_id || user?.id) &&
              c.id !== channel.id
            )
              return { ...c, is_primary: false };
            return c;
          })
          .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0))
      );
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setTogglingPrimary(null);
    }
  };

  const handlePromoteChannel = async (channel: any) => {
    const setPrimary = window.confirm("Bạn có muốn đặt kênh này làm KÊNH CHÍNH chính thức luôn không?\n\n- Bấm OK: Duyệt + Đặt làm kênh chính\n- Bấm Cancel: Chỉ duyệt thành chính thức");

    try {
      if (setPrimary) {
        // Unset all other official primaries
        await supabase
          .from("customer_contact_channels")
          .update({ is_primary: false })
          .eq("customer_id", customerId)
          .eq("scope", "official");
      }

      const { error } = await supabase
        .from("customer_contact_channels")
        .update({
          scope: "official",
          visibility: "official",
          owner_user_id: null,
          updated_by: user?.id,
          is_primary: setPrimary ? true : channel.is_primary
        })
        .eq("id", channel.id);
      
      if (error) throw error;

      await supabase.from("customer_activities").insert({
         customer_id: customerId,
         created_by: user?.id,
         activity_type: "system_update",
         content: `Đã duyệt kênh liên hệ ${channel.channel_type} (${channel.channel_value}) thành chính thức`,
         title: "Duyệt kênh liên hệ thành chính thức"
      });

      toast.success("Đã duyệt thành kênh chính thức");
      fetchChannels();
    } catch (err: any) {
      toast.error("Lỗi duyệt kênh: " + err.message);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy!");
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "verified":
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none text-[10px] px-2 py-0.5">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Đã xác thực
          </Badge>
        );
      case "failed":
        return (
          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-200 border-none text-[10px] px-2 py-0.5">
            <XCircle className="w-3 h-3 mr-1" /> Lỗi xác thực
          </Badge>
        );
      case "manual":
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[10px] px-2 py-0.5">
            <AlertCircle className="w-3 h-3 mr-1" /> Thủ công
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-none text-[10px] px-2 py-0.5">
            <RefreshCw className="w-3 h-3 mr-1" /> Chờ xử lý
          </Badge>
        );
    }
  };

  const renderPurpose = (purpose: string) => {
    const cfg = PURPOSE_CONFIG[purpose] || PURPOSE_CONFIG.other;
    const { label, color, Icon } = cfg;
    return (
      <Badge className={`${color} border-none text-[10px] px-2 py-0.5`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const renderChannelCard = (c: any, isOfficial: boolean) => {
    const icon = CHANNEL_TYPE_ICONS[c.channel_type] || "🔗";
    const isPrimary = !!c.is_primary;
    const canTogglePrimary =
      isOfficial
        ? isAdmin || isSubAdmin
        : c.owner_user_id === user?.id || isAdmin || isSubAdmin;

    return (
      <div
        key={c.id}
        className={`relative p-3 rounded-2xl border shadow-sm transition-all overflow-hidden
          ${isPrimary
            ? "bg-white border-indigo-300 ring-2 ring-indigo-200 shadow-indigo-100"
            : isOfficial
              ? "bg-white border-indigo-100 hover:shadow"
              : "bg-slate-50 border-slate-100 hover:bg-white hover:shadow-sm"
          }`}
      >
        {/* Left accent bar */}
        <div
          className={`absolute top-0 left-0 w-1 h-full rounded-l-2xl
            ${isPrimary ? "bg-indigo-500" : isOfficial ? "bg-indigo-300" : "bg-slate-300"}`}
        />

        <div className="flex items-start justify-between gap-3 ml-2">
          {/* Left: info */}
          <div className="min-w-0 flex-1">
            {/* Top row: type + badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-base leading-none">{icon}</span>
              <span className="text-xs font-bold text-slate-800 capitalize">{c.channel_type}</span>
              {isPrimary && (
                <Badge className="bg-indigo-600 text-white border-none text-[10px] px-2 py-0.5">
                  <Star className="w-2.5 h-2.5 mr-1 fill-white" /> Chính
                </Badge>
              )}
              {renderStatus(c.resolve_status)}
              {c.channel_purpose && renderPurpose(c.channel_purpose)}
              {c.remarketing_enabled && (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none text-[10px] px-2 py-0.5">
                  <Target className="w-3 h-3 mr-1" /> Remarketing
                </Badge>
              )}
            </div>

            {/* Value */}
            <div
              className="text-sm font-medium text-slate-700 mt-1.5 truncate max-w-[220px]"
              title={c.channel_value}
            >
              {c.normalized_value || c.channel_value}
            </div>

            {/* External ID (Facebook Page ID) */}
            {c.external_id && (
              <div className="text-[10px] text-slate-400 mt-0.5">
                ID: <span className="font-mono">{c.external_id}</span>
              </div>
            )}

            {/* Creator (admin view) */}
            {(isAdmin || isSubAdmin) && c.created_by && (
              <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                {isOfficial ? (
                  <Globe className="w-2.5 h-2.5" />
                ) : (
                  <Lock className="w-2.5 h-2.5" />
                )}
                Bởi: <strong>{profiles[c.created_by] || "Unknown"}</strong>
              </div>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            {/* Set Primary */}
            {canTogglePrimary && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 transition-colors
                        ${isPrimary
                          ? "text-indigo-500 hover:text-slate-400"
                          : "text-slate-300 hover:text-indigo-500"
                        }`}
                      disabled={togglingPrimary === c.id}
                      onClick={() => handleSetPrimary(c)}
                    >
                      {togglingPrimary === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isPrimary ? (
                        <Star className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <StarOff className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPrimary ? "Bỏ kênh chính" : "Đặt làm kênh chính"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Copy */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-300 hover:text-primary"
              onClick={() => copyToClipboard(c.normalized_value || c.channel_value)}
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>

            {/* Promote to Official */}
            {!isOfficial && (isAdmin || isSubAdmin) && (
               <TooltipProvider>
                 <Tooltip>
                   <TooltipTrigger asChild>
                     <Button
                       variant="ghost"
                       size="icon"
                       className="h-7 w-7 text-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                       onClick={() => handlePromoteChannel(c)}
                     >
                       <Globe className="w-3.5 h-3.5" />
                     </Button>
                   </TooltipTrigger>
                   <TooltipContent>Chuyển thành chính thức</TooltipContent>
                 </Tooltip>
               </TooltipProvider>
            )}

            {/* External link */}
            {(c.channel_type === "facebook" ||
              c.channel_type === "instagram" ||
              c.channel_type === "tiktok" ||
              c.channel_type === "website" ||
              c.normalized_value?.includes("zalo.me")) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-slate-300 hover:text-primary"
                onClick={() =>
                  window.open(
                    (c.normalized_value || c.channel_value).startsWith("http")
                      ? c.normalized_value || c.channel_value
                      : `https://${c.normalized_value || c.channel_value}`,
                    "_blank"
                  )
                }
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const officialChannels = channels.filter((c) => c.scope === "official");
  const privateChannels = channels.filter((c) => c.scope === "private");

  return (
    <div className="space-y-6">
      {/* ── Add channel form ── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Thêm kênh liên hệ mới
        </h4>

        <div className="grid grid-cols-12 gap-3 items-end">
          {/* Channel type */}
          <div className="col-span-12 sm:col-span-3 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Loại kênh</Label>
            <Select
              value={form.channelType}
              onValueChange={(v) => setForm({ ...form, channelType: v })}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zalo">💬 Zalo</SelectItem>
                <SelectItem value="facebook">📘 Facebook</SelectItem>
                <SelectItem value="email">📧 Email</SelectItem>
                <SelectItem value="tiktok">🎵 TikTok</SelectItem>
                <SelectItem value="instagram">📸 Instagram</SelectItem>
                <SelectItem value="website">🌐 Website</SelectItem>
                <SelectItem value="phone">📞 Điện thoại</SelectItem>
                <SelectItem value="other">🔗 Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Value */}
          <div className="col-span-12 sm:col-span-4 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">
              Giá trị (Link / SĐT / Email)
            </Label>
            <Input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="Nhập link hoặc số..."
              className="h-9 text-xs rounded-xl"
              onKeyDown={(e) => e.key === "Enter" && handleAddChannel()}
            />
          </div>

          {/* Purpose */}
          <div className="col-span-12 sm:col-span-3 space-y-1.5">
            <Label className="text-[10px] font-black text-slate-500 uppercase">Mục đích</Label>
            <Select
              value={form.channelPurpose}
              onValueChange={(v) => setForm({ ...form, channelPurpose: v })}
            >
              <SelectTrigger className="h-9 text-xs rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">🛒 Sales</SelectItem>
                <SelectItem value="support">🎧 Hỗ trợ</SelectItem>
                <SelectItem value="remarketing">🎯 Remarketing</SelectItem>
                <SelectItem value="invoice">🧾 Hóa đơn</SelectItem>
                <SelectItem value="personal">👤 Cá nhân</SelectItem>
                <SelectItem value="other">🔹 Khác</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Scope (admin only) */}
          {(isAdmin || isSubAdmin) && (
            <div className="col-span-12 sm:col-span-3 space-y-1.5">
              <Label className="text-[10px] font-black text-slate-500 uppercase">Phạm vi</Label>
              <Select
                value={form.scope}
                onValueChange={(v) => setForm({ ...form, scope: v })}
              >
                <SelectTrigger className="h-9 text-xs rounded-xl bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="official" className="font-bold text-indigo-700">
                    🌐 Official (Hệ thống)
                  </SelectItem>
                  <SelectItem value="private">🔒 Private (Riêng tư)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Set as primary toggle */}
          <div className="col-span-12 sm:col-span-3 flex items-end gap-2">
            <label className="flex items-center gap-2 cursor-pointer h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-all w-full">
              <input
                type="checkbox"
                checked={form.isPrimary}
                onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
                className="accent-indigo-600 w-4 h-4"
              />
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-1">
                <Star className="w-3.5 h-3.5 text-indigo-400" /> Kênh chính
              </span>
            </label>
          </div>

          {/* Add button */}
          <div className="col-span-12 sm:col-span-3">
            <Button
              onClick={handleAddChannel}
              disabled={adding || !form.value.trim()}
              className="w-full h-9 rounded-xl text-xs font-bold bg-slate-900 hover:bg-primary text-white"
            >
              {adding ? (
                <Loader2 className="w-3 h-3 animate-spin mr-1" />
              ) : (
                <Plus className="w-3 h-3 mr-1" />
              )}
              Thêm
            </Button>
          </div>
        </div>
      </div>

      {/* ── Channel lists ── */}
      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Official Channels */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Kênh chính thức ({officialChannels.length})
            </h4>
            {officialChannels.length === 0 ? (
              <div className="text-xs text-slate-400 italic px-2 py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                Chưa có kênh chính thức
              </div>
            ) : (
              officialChannels.map((c) => renderChannelCard(c, true))
            )}
          </div>

          {/* Private Channels */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Kênh riêng tư ({privateChannels.length})
            </h4>
            {privateChannels.length === 0 ? (
              <div className="text-xs text-slate-400 italic px-2 py-6 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
                Chưa có kênh riêng tư
              </div>
            ) : (
              privateChannels.map((c) => renderChannelCard(c, false))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
