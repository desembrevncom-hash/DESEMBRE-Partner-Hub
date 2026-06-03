import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  AlertTriangle,
  Clock,
  Copy,
  ChevronRight,
  Check,
  Sparkles,
  Filter,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  CustomerQueueStatus,
  getQueueStatusLabel,
  getSuggestedTemplateCategory,
} from "@/lib/marketingTemplateRules";
import { MOCK_TEMPLATES } from "./SaleTemplatePicker";
import { CustomerPreviewDrawer } from "../customers/CustomerPreviewDrawer";
import { resolveSenderForMessage, PersonalSenderAccount } from "@/lib/senderResolver";

interface QueueItem {
  id: string;
  name: string;
  contact_name: string;
  phone: string;
  lifecycle_stage: string;
  opt_out_marketing: boolean;
  customer_channel: string;
  queue_status: CustomerQueueStatus;
  last_interaction_date: string | null;
}

export function SaleMarketingQueue() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<string>("Tất cả");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sender state
  const [personalSenders, setPersonalSenders] = useState<PersonalSenderAccount[]>([]);
  const [senderLoaded, setSenderLoaded] = useState(false);

  const CATEGORIES = ["Tất cả", "Chăm sóc lại", "Báo giá", "Upsell", "Chưa liên hệ"];

  useEffect(() => {
    if (user?.id) {
      fetchQueueItems(user.id);

      // Load personal senders for current user
      supabase
        .from("user_communication_accounts")
        .select("id, user_id, platform, account_name, is_active, health_status")
        .eq("user_id", user.id)
        .then(({ data }: any) => {
          setPersonalSenders((data ?? []) as PersonalSenderAccount[]);
          setSenderLoaded(true);
        });
    }
  }, [user?.id]);

  // Derive sender status indicator for the queue header
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

  const fetchQueueItems = async (userId: string) => {
    setLoading(true);
    try {
      // Lấy danh sách khách hàng Sale phụ trách
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .or(`owner_sale_id.eq.${userId},owner_tele_id.eq.${userId}`);

      if (error) throw error;

      // Mock logic phân loại queue (trong thực tế sẽ có complex query hoặc trigger)
      if (data) {
        const processedItems: QueueItem[] = data.map((c: any) => {
          // Fallback simple rule mapping
          let status: CustomerQueueStatus = "new_lead_no_touch";
          if (c.lifecycle_stage === "proposal") status = "quoted_not_closed";
          else if (c.lifecycle_stage === "won") status = "purchased_old";
          else if (c.last_interaction_date) {
            const diffDays = Math.floor(
              (new Date().getTime() - new Date(c.last_interaction_date).getTime()) /
                (1000 * 3600 * 24),
            );
            if (diffDays > 14) status = "inactive_14d";
            else status = "no_follow_up";
          }

          return {
            id: c.id,
            name: c.business_name || c.name || "Khách hàng mới",
            contact_name: c.contact_name,
            phone: c.phone,
            lifecycle_stage: c.lifecycle_stage || "new",
            opt_out_marketing: c.opt_out_marketing || false,
            customer_channel: c.customer_channel || "Bỏ trống",
            queue_status: status,
            last_interaction_date: c.last_interaction_date,
          };
        });

        // Chỉ ưu tiên những khách cần tương tác (giả lập 10 khách đầu)
        setItems(processedItems.slice(0, 15));
      }
    } catch (error) {
      console.error("Không thể tải Queue:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (filter === "Tất cả") return items;
    // Map filter text to internal logic
    const categoryMap: Record<string, CustomerQueueStatus[]> = {
      "Chăm sóc lại": ["no_follow_up", "inactive_14d"],
      "Báo giá": ["quoted_not_closed"],
      Upsell: ["purchased_old"],
      "Chưa liên hệ": ["new_lead_no_touch"],
    };
    const validStatuses = categoryMap[filter] || [];
    return items.filter((i) => validStatuses.includes(i.queue_status));
  }, [items, filter]);

  const handleCopyTemplate = async (item: QueueItem) => {
    if (item.opt_out_marketing) {
      toast.error("Không thể gửi tin: Khách hàng đã từ chối nhận tin nhắn Marketing (Opt-out).");

      if (user?.id) {
        try {
          await supabase.rpc("log_marketing_delivery_event", {
            p_customer_id: item.id,
            p_campaign_id: null,
            p_template_id: null,
            p_sender_account_id: null,
            p_personal_sender_id: null,
            p_channel: "zalo",
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

    if (!item.phone && !item.customer_channel) {
      toast.warning("Khách hàng này đang thiếu thông tin kênh liên hệ");
      return; // Khuyên cập nhật nhưng không block cứng
    }

    const suggestedCategory = getSuggestedTemplateCategory(item.queue_status);
    const template =
      MOCK_TEMPLATES.find((t) => t.category === suggestedCategory) || MOCK_TEMPLATES[0];

    if (!template || !template.content) {
      toast.error("Chưa có mẫu phù hợp cho nhóm khách hàng này.");
      return;
    }

    // ── Sender Resolution Gate ───────────────────────────────────────────────
    let resolvedSenderId = null;
    let logReason = null;
    if (senderLoaded) {
      const resolution = resolveSenderForMessage({
        channel: "zalo",
        mode: "sale_followup",
        customer: {
          id: item.id,
          marketing_opt_out_at: item.opt_out_marketing ? new Date().toISOString() : null,
        },
        ownerUserId: user?.id,
        personalSenders,
      });

      if (resolution.senderType === "personal") {
        resolvedSenderId = resolution.senderId || null;
      }

      if (!resolution.allowed) {
        toast.warning(`⚠️ Lưu ý: ${resolution.reason}`, { duration: 5000 });
        logReason = resolution.reason || null;
      } else if (resolution.warnings.length > 0) {
        resolution.warnings.forEach((w) => toast.warning(w, { duration: 4000 }));
      }
    }

    // ── Perform copy ─────────────────────────────────────────────────────────
    try {
      await navigator.clipboard.writeText(template.content);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = template.content;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopiedId(item.id);
    toast.success("Đã copy mẫu. Hãy dán vào Zalo/Facebook để gửi khách.");

    setTimeout(() => setCopiedId(null), 2500);

    // Ghi Log cả marketing_delivery_logs (via RPC) và customer_activities
    try {
      if (user?.id) {
        // 1. Log delivery event via RPC
        await supabase.rpc("log_marketing_delivery_event", {
          p_customer_id: item.id,
          p_campaign_id: null,
          p_template_id: null,
          p_sender_account_id: null,
          p_personal_sender_id: resolvedSenderId,
          p_channel: "zalo",
          p_mode: "copy",
          p_status: "copied",
          p_reason: logReason,
        });

        // 2. Log to customer_activities (existing pattern)
        await supabase.from("customer_activities").insert({
          customer_id: item.id,
          created_by: user.id,
          activity_type: "marketing_template_used",
          source: "personal_marketing_queue",
          title: "Đã dùng mẫu marketing",
          content: `Template: ${template.name} | Category: ${template.category} | Channel: ${template.channel} | User ID: ${user.id}`,
        });
      }
    } catch (err) {
      console.error("Failed to log delivery event/activity", err);
    }
  };

  const openCustomer = async (id: string) => {
    const { data } = await supabase.from("customers").select("*").eq("id", id).single();
    if (data) {
      setSelectedCustomer(data);
      setDrawerOpen(true);
    }
  };

  return (
    <Card className="rounded-3xl border border-indigo-100 shadow-sm bg-white overflow-hidden flex flex-col h-full max-h-[600px]">
      <CardHeader className="bg-indigo-50/50 p-5 border-b border-indigo-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-[13px] font-black text-indigo-900 uppercase tracking-widest">
                Personal Marketing Queue
              </CardTitle>
              <p className="text-[10px] font-bold text-indigo-400 mt-0.5">
                Danh sách cần tương tác ưu tiên
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
            <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200">
              {items.length} Khách hàng
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-4">
          <Filter className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                filter === cat
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-indigo-300"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-xs animate-pulse">
              Đang tải danh sách ưu tiên...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6 text-slate-300" />
              </div>
              <p className="text-xs font-bold text-slate-500">
                Tuyệt vời! Bạn không có khách hàng nào đang tồn đọng cần tương tác gấp.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filteredItems.map((item) => (
                <div key={item.id} className="p-4 hover:bg-slate-50 transition-colors group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-sm text-slate-800 truncate block">
                          {item.name}
                        </span>
                        {item.opt_out_marketing && (
                          <Badge
                            variant="outline"
                            className="bg-rose-50 text-rose-600 border-none text-[9px] px-1.5 py-0"
                          >
                            Opt-out
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium text-slate-500">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" /> {item.lifecycle_stage}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm">
                          <Clock className="w-3 h-3" /> {getQueueStatusLabel(item.queue_status)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant={copiedId === item.id ? "default" : "outline"}
                        onClick={() => handleCopyTemplate(item)}
                        disabled={item.opt_out_marketing}
                        className={`h-8 px-3 text-[10px] ${copiedId === item.id ? "bg-emerald-500 hover:bg-emerald-600" : "text-indigo-600 border-indigo-200 hover:bg-indigo-50"}`}
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3 h-3 mr-1.5" />
                        ) : (
                          <Copy className="w-3 h-3 mr-1.5" />
                        )}
                        {copiedId === item.id
                          ? "Copied"
                          : `Mẫu ${getSuggestedTemplateCategory(item.queue_status)}`}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openCustomer(item.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {!item.phone && (
                    <div className="mt-2 text-[9px] text-rose-500 flex items-center gap-1 font-bold">
                      <AlertTriangle className="w-3 h-3" /> Thiếu kênh liên hệ
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>

      {drawerOpen && selectedCustomer && (
        <CustomerPreviewDrawer
          customer={selectedCustomer}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </Card>
  );
}
