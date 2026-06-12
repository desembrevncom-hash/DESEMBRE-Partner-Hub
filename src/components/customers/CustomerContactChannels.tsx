import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plus,
  ExternalLink,
  Copy,
  Target,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  XCircle,
  Star,
  StarOff,
  ShoppingCart,
  HeadphonesIcon,
  FileText,
  User,
  HelpCircle,
  Lock,
  Globe,
  Phone,
  Facebook,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { createContactChannel } from "@/lib/contactChannels";
import {
  useCustomerFacebookIdentityQuery,
  useApplyFacebookNameMutation,
  useFetchMissingFacebookNameMutation,
  useTriggerAutoResolveMutation
} from "@/lib/customers/facebookIdentityApi";
import { FacebookIdentityBadge } from "./FacebookIdentityBadge";

interface CustomerContactChannelsProps {
  customerId: string;
  customer?: any;
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
  sales: { label: "Sales", color: "bg-blue-100 text-blue-700", Icon: ShoppingCart },
  support: { label: "Hỗ trợ", color: "bg-teal-100 text-teal-700", Icon: HeadphonesIcon },
  remarketing: { label: "Remarketing", color: "bg-amber-100 text-amber-700", Icon: Target },
  invoice: { label: "Hóa đơn", color: "bg-violet-100 text-violet-700", Icon: FileText },
  personal: { label: "Cá nhân", color: "bg-pink-100 text-pink-700", Icon: User },
  other: { label: "Khác", color: "bg-slate-100 text-slate-500", Icon: HelpCircle },
};

export function CustomerContactChannels({ customerId, customer }: CustomerContactChannelsProps) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [togglingPrimary, setTogglingPrimary] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  const { data: identityData, refetch: refetchIdentity } = useCustomerFacebookIdentityQuery(customerId);
  const profilesData = identityData?.profiles || [];
  const jobsData = identityData?.jobs || [];
  const resultsData = (identityData as any)?.results || [];
  const applyNameMutation = useApplyFacebookNameMutation();
  const fetchMissingNameMutation = useFetchMissingFacebookNameMutation();
  const retryResolve = useTriggerAutoResolveMutation();

  const canApplyName = isAdmin || isSubAdmin || (customer && (customer.owner_sale_id === user?.id || (!customer.owner_sale_id && customer.created_by === user?.id)));

  useEffect(() => {
    const hasResolving = jobsData.some((j: any) => j.auto_resolve_status === "resolving");
    if (hasResolving) {
      const interval = setInterval(() => refetchIdentity(), 5000);
      return () => clearInterval(interval);
    }
  }, [jobsData, refetchIdentity]);

  const [form, setForm] = useState({
    channelType: "zalo",
    value: "",
    scope: isAdmin || isSubAdmin ? "official" : "private",
    channelPurpose: "sales",
    isPrimary: false,
    notes: "",
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
        user,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (form.scope === "private") {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .in("role", ["admin", "sub_admin"]);

        if (admins) {
          for (const admin of admins) {
            await supabase.rpc("create_notification_safe", {
              p_recipient_user_id: admin.id,
              p_notification_type: "channel_approval_required",
              p_title: "Cần duyệt kênh liên hệ",
              p_message: `Nhân viên vừa thêm kênh cá nhân: ${form.value}`,
              p_customer_id: customerId,
              p_actor_user_id: user?.id,
              p_deep_link: `/customers?id=${customerId}`,
            });
          }
        }
      }

      toast.success("Thêm kênh liên hệ thành công!");
      setForm((prev) => ({ ...prev, value: "", notes: "", isPrimary: false }));
      setShowAddForm(false);
      fetchChannels();
      window.dispatchEvent(new Event("customer_timeline_refresh"));
    } catch (err: any) {
      toast.error(err.message || "Không thể thêm kênh liên hệ");
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
          .sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)),
      );
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setTogglingPrimary(null);
    }
  };

  const handlePromoteChannel = async (channel: any) => {
    const setPrimary = window.confirm(
      "Bạn có muốn đặt kênh này làm KÊNH CHÍNH chính thức luôn không?\n\n- Bấm OK: Duyệt + Đặt làm kênh chính\n- Bấm Cancel: Chỉ duyệt thành chính thức",
    );

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
          is_primary: setPrimary ? true : channel.is_primary,
        })
        .eq("id", channel.id);

      if (error) throw error;

      await supabase.from("customer_activities").insert({
        customer_id: customerId,
        created_by: user?.id,
        activity_type: "system_update",
        content: `Đã duyệt kênh liên hệ ${channel.channel_type} (${channel.channel_value}) thành chính thức`,
        title: "Duyệt kênh liên hệ thành chính thức",
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
      default:
        // Ẩn nhãn "Thủ công" và "Chờ xử lý" cho gọn UI
        return null;
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

  const renderChannelCard = (c: any) => {
    const icon = CHANNEL_TYPE_ICONS[c.channel_type] || "🔗";
    const isPrimary = !!c.is_primary;
    const isOfficial = c.scope === "official";
    const canTogglePrimary = isOfficial
      ? isAdmin || isSubAdmin
      : c.owner_user_id === user?.id || isAdmin || isSubAdmin;

    return (
      <div
        key={c.id}
        className={`relative p-3.5 rounded-2xl border shadow-sm transition-all overflow-hidden bg-white hover:shadow-md
          ${isPrimary ? "border-indigo-300 ring-2 ring-indigo-200" : "border-slate-200"}`}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              {c.channel_type === "facebook" ? (
                <Facebook className="w-[1.125rem] h-[1.125rem] text-[#1877F2] shrink-0 fill-current" />
              ) : (
                <span className="text-xl leading-none">{icon}</span>
              )}
              <div className="text-lg font-black text-slate-800 truncate" title={c.channel_value}>
                {c.normalized_value || c.channel_value}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {isPrimary && (
                <Badge className="bg-indigo-600 text-white border-none text-[10px] px-2 py-0.5">
                  <Star className="w-2.5 h-2.5 mr-1 fill-white" /> Kênh chính
                </Badge>
              )}
              {!isOfficial && (
                <Badge className="bg-slate-100 text-slate-600 border-none text-[10px] px-2 py-0.5">
                  <Lock className="w-2.5 h-2.5 mr-1" /> Riêng tư
                  {(isAdmin || isSubAdmin) &&
                    c.created_by &&
                    ` (${profiles[c.created_by] || "Ẩn danh"})`}
                </Badge>
              )}
              <span className="opacity-80 flex gap-1.5 items-center">
                {renderStatus(c.resolve_status)}
                {c.remarketing_enabled && (
                  <Badge className="bg-amber-50 text-amber-600 border-none text-[10px] px-2 py-0.5">
                    <Target className="w-2.5 h-2.5 mr-1" /> Remarketing
                  </Badge>
                )}
              </span>
              
              {c.channel_type === "facebook" && (() => {
                const profile = profilesData.find((p: any) => 
                  (c.social_profile_id && p.id === c.social_profile_id) || 
                  (!c.social_profile_id && (p.raw_url === c.channel_value || p.normalized_url === c.normalized_value || p.facebook_username === c.channel_value))
                );
                const job = jobsData.find((j: any) => 
                  (c.identity_job_id && j.id === c.identity_job_id) || 
                  (!c.identity_job_id && (j.raw_url === c.channel_value))
                );
                
                return (
                  <FacebookIdentityBadge
                    facebookUid={profile?.facebook_uid}
                    resolverMethod={profile?.resolver_method}
                    confidenceScore={profile?.confidence_score}
                    autoResolveStatus={job?.auto_resolve_status}
                    lastAutoResolveError={job?.last_auto_resolve_error}
                    jobStatus={job?.status}
                    facebookDisplayName={profile?.facebook_display_name}
                    displayNameSource={profile?.display_name_source}
                    displayNameConfidenceScore={profile?.display_name_confidence_score}
                    canApplyName={!!canApplyName}
                    currentCustomerName={customer?.name}
                    currentCustomerContactName={customer?.contact_name}
                    isApplyPending={applyNameMutation.isPending}
                    onApplyName={(name, forceOverwrite) => {
                      applyNameMutation.mutate({ customerId, socialProfileId: profile.id, forceOverwrite }, {
                        onSuccess: () => {
                          toast.success("Đã áp dụng tên Facebook vào tên khách hàng.");
                        },
                        onError: (err: any) => {
                          toast.error("Lỗi", { description: err.message });
                        }
                      });
                    }}
                    onForceRetry={job?.id ? () => retryResolve.mutate(job.id, {
                      onSuccess: () => {
                        toast.success("Đã đưa vào hàng đợi phân giải lại");
                      },
                      onError: (err: any) => {
                        toast.error("Lỗi", { description: err.message });
                      }
                    }) : undefined}
                    isRetryPending={retryResolve.isPending && retryResolve.variables === job?.id}
                    onFetchMissingName={() => {
                        fetchMissingNameMutation.mutate({ customerId, rawUrl: c.channel_value }, {
                          onSuccess: () => {
                            toast.success("Đã đưa vào hàng đợi", {
                              description: "Hệ thống đang thử tìm UID và tên Facebook trong nền. Tên sẽ hiển thị nếu provider trả về.",
                            });
                          },
                          onError: (err: any) => {
                            toast.error("Lỗi", {
                              description: err.message,
                            });
                          }
                        });
                      }}
                      isFetchPending={(fetchMissingNameMutation.isPending && fetchMissingNameMutation.variables?.rawUrl === c.channel_value) || job?.status === "manual_review_required"}
                    onApplyName={(name, forceOverwrite) => {
                      if (!customer) return;
                      
                      const currentName = customer.name || "";
                      const isNameUrl = !currentName.trim() || currentName.includes("facebook.com") || currentName.includes("http") || currentName.includes("profile.php");
                      
                      const currentContactName = customer.contact_name || "";
                      const isContactUrl = !currentContactName.trim() || currentContactName.includes("facebook.com") || currentContactName.includes("http") || currentContactName.includes("profile.php");

                      if (!isNameUrl || !isContactUrl) {
                        const existingNames = Array.from(new Set([currentName, currentContactName].filter(n => n && !n.includes("facebook.com") && !n.includes("http")))).join(" / ");
                        if (existingNames && !confirm(`Khách hàng đang có tên là "${existingNames}". Bạn có chắc chắn muốn cập nhật thành "${name}" không?`)) {
                          return;
                        }
                      }

                      applyNameMutation.mutate({ customerId, socialProfileId: profile.id, forceOverwrite }, {
                        onSuccess: () => toast.success(`Đã áp dụng tên Facebook vào tên khách hàng.`),
                        onError: (err: any) => toast.error("Lỗi", { description: err.message })
                      });
                    }}
                    duplicateProfile={job?.duplicate_profile}
                  />
                );
              })()}
            </div>
          </div>

          {/* Right actions */}
          <div className="flex flex-row items-center gap-1 shrink-0 bg-slate-50 p-1 rounded-xl">
            {/* Copy */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-slate-800 hover:bg-slate-200"
                    onClick={() => copyToClipboard(c.normalized_value || c.channel_value)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* External link */}
            {(c.channel_type === "facebook" ||
              c.channel_type === "instagram" ||
              c.channel_type === "tiktok" ||
              c.channel_type === "website" ||
              c.normalized_value?.includes("zalo.me")) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-slate-200"
                onClick={() =>
                  window.open(
                    (c.normalized_value || c.channel_value).startsWith("http")
                      ? c.normalized_value || c.channel_value
                      : `https://${c.normalized_value || c.channel_value}`,
                    "_blank",
                  )
                }
              >
                <ExternalLink className="w-4 h-4" />
              </Button>
            )}

            {/* Set Primary */}
            {canTogglePrimary && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-8 w-8 transition-colors hover:bg-slate-200
                        ${isPrimary ? "text-indigo-500" : "text-slate-300 hover:text-indigo-500"}`}
                      disabled={togglingPrimary === c.id}
                      onClick={() => handleSetPrimary(c)}
                    >
                      {togglingPrimary === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isPrimary ? (
                        <Star className="w-4 h-4 fill-current" />
                      ) : (
                        <StarOff className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isPrimary ? "Bỏ kênh chính" : "Đặt làm kênh chính"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Promote to Official */}
            {!isOfficial && (isAdmin || isSubAdmin) && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2.5 ml-1 text-xs font-bold text-indigo-700 border-indigo-200 bg-indigo-50 hover:bg-indigo-100"
                onClick={() => handlePromoteChannel(c)}
              >
                Duyệt kênh
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const sortedChannels = [...channels].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1;
    if (!a.is_primary && b.is_primary) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      {/* ── Header & Add Button ── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-black text-slate-800 uppercase flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-primary" /> KÊNH LIÊN HỆ ({channels.length})
        </h3>
        <Button
          variant={showAddForm ? "outline" : "default"}
          size="sm"
          onClick={() => setShowAddForm(!showAddForm)}
          className={`h-8 text-xs font-bold rounded-xl ${!showAddForm && "bg-slate-900 text-white hover:bg-primary"}`}
        >
          {showAddForm ? "Hủy" : "+ Thêm kênh"}
        </Button>
      </div>

      {/* ── Add channel form (Collapsible) ── */}
      {showAddForm && (
        <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm space-y-3 animate-in slide-in-from-top-2 fade-in">
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
                <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
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
      )}

      {/* ── Channel lists (Merged 1 Column) ── */}
      {loading ? (
        <div className="flex justify-center p-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="space-y-3">
          {sortedChannels.length === 0 ? (
            <div className="text-sm text-slate-400 italic px-4 py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed text-center">
              Chưa có kênh liên hệ nào.
            </div>
          ) : (
            sortedChannels.map((c) => renderChannelCard(c))
          )}
        </div>
      )}
    </div>
  );
}
