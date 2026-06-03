import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  Copy,
  Check,
  Filter,
  Layers,
  Clock,
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { resolveSenderForMessage, PersonalSenderAccount } from "@/lib/senderResolver";

export interface MarketingTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  channel: string;
}

// Giả lập danh sách Template nếu chưa có DB
export const MOCK_TEMPLATES: MarketingTemplate[] = [
  {
    id: "1",
    name: "Bảng giá điều trị Nám 2026",
    category: "Báo giá",
    channel: "Zalo",
    content: "Kính gửi Quý Spa, Desembre xin gửi bảng giá phác đồ điều trị Nám mới nhất...",
  },
  {
    id: "2",
    name: "Phác đồ Siêu vi tảo",
    category: "Phác đồ",
    channel: "Zalo",
    content: "Hướng dẫn chi tiết các bước trong phác đồ Siêu vi tảo Desembre...",
  },
  {
    id: "3",
    name: "Mời Workshop Hà Nội T6",
    category: "Workshop",
    channel: "Zalo",
    content: "Trân trọng mời anh/chị tham gia sự kiện Workshop Đào tạo kỹ thuật tại Hà Nội...",
  },
  {
    id: "4",
    name: "Hỏi thăm định kỳ",
    category: "CSKH",
    channel: "Zalo",
    content: "Chào chị, dạo này Spa mình lượng khách ổn định không ạ? Em gửi chị thông tin...",
  },
  {
    id: "5",
    name: "Giới thiệu sp mới (Upsell)",
    category: "Upsell",
    channel: "Zalo",
    content:
      "Sắp tới bên em ra mắt dòng tinh chất phục hồi cao cấp, chị có muốn nhận sample dùng thử không ạ?",
  },
  {
    id: "6",
    name: "Nhắc lịch lấy hàng",
    category: "Chăm sóc lại",
    channel: "Zalo",
    content:
      "Chị ơi, sản phẩm X đợt trước chị lấy sắp hết rồi đúng không ạ? Em lên đơn mới cho chị nhé!",
  },
];

const CATEGORIES = ["Tất cả", "Báo giá", "Phác đồ", "Workshop", "Chăm sóc lại", "Upsell", "CSKH"];

interface SaleTemplatePickerProps {
  customerId?: string;
  customer?: {
    id: string;
    marketing_opt_out_at?: string | null;
    marketing_opt_in?: boolean;
  };
  onCopy?: (text: string) => void;
}

export function SaleTemplatePicker({ customerId, customer, onCopy }: SaleTemplatePickerProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copying, setCopying] = useState<string | null>(null);

  // Sender state
  const [personalSenders, setPersonalSenders] = useState<PersonalSenderAccount[]>([]);
  const [senderLoaded, setSenderLoaded] = useState(false);

  // Load personal senders for current user
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_communication_accounts")
      .select("id, user_id, platform, account_name, is_active, health_status")
      .eq("user_id", user.id)
      .then(({ data }: any) => {
        setPersonalSenders((data ?? []) as PersonalSenderAccount[]);
        setSenderLoaded(true);
      });
  }, [user?.id]);

  // Load recents từ localStorage
  const [recentIds, setRecentIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("recent_marketing_templates") || "[]");
    } catch {
      return [];
    }
  });

  const filteredTemplates = useMemo(() => {
    return MOCK_TEMPLATES.filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.content.toLowerCase().includes(search.toLowerCase());
      const matchCategory = category === "Tất cả" || t.category === category;
      return matchSearch && matchCategory;
    });
  }, [search, category]);

  const recentTemplates = useMemo(() => {
    return recentIds
      .map((id) => MOCK_TEMPLATES.find((t) => t.id === id))
      .filter(Boolean) as MarketingTemplate[];
  }, [recentIds]);

  const handleCopy = async (template: MarketingTemplate) => {
    if (copying) return;
    setCopying(template.id);

    const effectiveCustomer = customer ?? (customerId ? { id: customerId } : null);
    const channel = template.channel?.toLowerCase().includes("email") ? "email" : "zalo";

    // ── 1. Opt-out hard block — log blocked + early return ───────────────────
    if (effectiveCustomer && (effectiveCustomer as any).marketing_opt_out_at) {
      toast.error("Không thể copy: Khách hàng đã Opt-out. Không gửi tin Marketing cho khách này.");
      setCopying(null);

      if (effectiveCustomer.id && user?.id) {
        try {
          await supabase.rpc("log_marketing_delivery_event", {
            p_customer_id: effectiveCustomer.id,
            p_campaign_id: null,
            p_template_id: null,
            p_sender_account_id: null,
            p_personal_sender_id: null,
            p_channel: channel,
            p_mode: "copy",
            p_status: "blocked",
            p_reason: "opt_out_marketing",
          });
        } catch (err) {
          console.error("Failed to log blocked event", err);
        }
      }
      return;
    }

    // ── 2. Sender resolution — non-blocking, warning toast only ──────────────
    let resolvedSenderId: string | null = null;
    let logReason: string | null = null;

    if (senderLoaded && effectiveCustomer) {
      const resolution = resolveSenderForMessage({
        channel: "zalo",
        mode: "sale_followup",
        customer: {
          id: effectiveCustomer.id,
          marketing_opt_out_at: (effectiveCustomer as any).marketing_opt_out_at ?? null,
        },
        ownerUserId: user?.id,
        personalSenders,
      });

      if ((resolution as any).senderType === "personal") {
        resolvedSenderId = (resolution as any).senderId || null;
      }

      if (!resolution.allowed) {
        // Non-blocking: show warning but still allow copy
        toast.warning(`⚠️ Lưu ý: ${resolution.reason}`, { duration: 5000 });
        logReason = resolution.reason || null;
      } else if (resolution.warnings.length > 0) {
        resolution.warnings.forEach((w) => toast.warning(w, { duration: 4000 }));
      }
    }

    // ── 3. Perform clipboard copy ────────────────────────────────────────────
    try {
      await navigator.clipboard.writeText(template.content);
    } catch {
      // Fallback for browsers that block clipboard API
      const el = document.createElement("textarea");
      el.value = template.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopiedId(template.id);
    setCopying(null);
    toast.success("Đã copy nội dung — dán vào Zalo/Messenger để gửi khách");
    setTimeout(() => setCopiedId(null), 2000);

    // Update recents
    const newRecents = [template.id, ...recentIds.filter((id) => id !== template.id)].slice(0, 3);
    setRecentIds(newRecents);
    localStorage.setItem("recent_marketing_templates", JSON.stringify(newRecents));
    if (onCopy) onCopy(template.content);

    // ── 4. Double-log: marketing_delivery_logs + customer_activities ─────────
    if (effectiveCustomer?.id && user?.id) {
      try {
        // Log #1 — delivery event via RPC (status = copied)
        await supabase.rpc("log_marketing_delivery_event", {
          p_customer_id: effectiveCustomer.id,
          p_campaign_id: null,
          p_template_id: null,
          p_sender_account_id: null,
          p_personal_sender_id: resolvedSenderId,
          p_channel: channel,
          p_mode: "copy",
          p_status: "copied",
          p_reason: logReason,
        });

        // Log #2 — customer_activities (existing pattern)
        await supabase.from("customer_activities").insert({
          customer_id: effectiveCustomer.id,
          created_by: user.id,
          activity_type: "marketing_template_used",
          title: "Đã dùng mẫu marketing",
          content: `Template: ${template.name} | Category: ${template.category} | Channel: ${template.channel} | User ID: ${user.id}`,
        });
      } catch (err) {
        console.error("Failed to log delivery event", err);
      }
    }
  };

  // Derive sender health badge for picker header
  const senderStatus = useMemo(() => {
    if (!senderLoaded) return null;
    const zaloSender = personalSenders.find(
      (s) => s.platform?.toLowerCase().includes("zalo") && s.is_active,
    );
    if (!zaloSender) return "missing";
    if (zaloSender.health_status === "error") return "error";
    if (zaloSender.health_status === "warning") return "warning";
    return "ok";
  }, [personalSenders, senderLoaded]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden text-sm">
      <div className="p-4 border-b border-slate-100 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-600" /> Chọn Mẫu Marketing (Toolkit)
          </h3>
          {/* Sender health micro-badge */}
          {senderLoaded && senderStatus === "ok" && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" /> Zalo OK
            </div>
          )}
          {senderLoaded && senderStatus === "warning" && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> Cần kiểm tra Zalo
            </div>
          )}
          {senderLoaded && (senderStatus === "error" || senderStatus === "missing") && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
              <ShieldAlert className="w-3 h-3" /> Chưa cấu hình Zalo
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Tìm kiếm mẫu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-xs bg-slate-50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors ${
                category === cat
                  ? "bg-purple-100 text-purple-700"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1 p-4 bg-slate-50/50">
        {recentTemplates.length > 0 && category === "Tất cả" && !search && (
          <div className="mb-4">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-2">
              <Clock className="w-3 h-3" /> Dùng gần đây
            </span>
            <div className="grid grid-cols-1 gap-2">
              {recentTemplates.map((t) => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onCopy={() => handleCopy(t)}
                  isCopied={copiedId === t.id}
                  isLoading={copying === t.id}
                />
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">
            Danh sách Mẫu ({filteredTemplates.length})
          </span>
          {filteredTemplates.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              Không tìm thấy mẫu phù hợp.
            </div>
          ) : (
            filteredTemplates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                onCopy={() => handleCopy(t)}
                isCopied={copiedId === t.id}
                isLoading={copying === t.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function TemplateCard({
  template,
  onCopy,
  isCopied,
  isLoading,
}: {
  template: MarketingTemplate;
  onCopy: () => void;
  isCopied: boolean;
  isLoading: boolean;
}) {
  return (
    <div className="p-3 bg-white rounded-xl border border-slate-200 hover:border-purple-300 hover:shadow-sm transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Badge variant="secondary" className="text-[9px] bg-slate-100 text-slate-600 mb-1">
            {template.category}
          </Badge>
          <h4 className="font-bold text-xs text-slate-800">{template.name}</h4>
        </div>
        <Button
          size="sm"
          variant={isCopied ? "default" : "outline"}
          onClick={onCopy}
          disabled={isLoading}
          className={`h-7 px-2 text-[10px] ${isCopied ? "bg-emerald-500 hover:bg-emerald-600 border-none" : "text-purple-600 border-purple-200 hover:bg-purple-50"}`}
        >
          {isCopied ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
          {isCopied ? "Copied" : isLoading ? "..." : "Copy"}
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 mt-2 line-clamp-2 leading-relaxed">
        {template.content}
      </p>
    </div>
  );
}
