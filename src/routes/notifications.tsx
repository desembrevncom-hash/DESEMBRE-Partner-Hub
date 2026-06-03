import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell,
  Check,
  Trash2,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Filter,
  CheckCircle,
  Inbox,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { markAllNotificationsAsRead, markNotificationAsRead } from "@/lib/notifications";
import { toast } from "sonner";
import { useNavigate, Link } from "@tanstack/react-router";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";

export const Route = createFileRoute("/notifications")({
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [previewCustomer, setPreviewCustomer] = useState<any | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false });

    if (filter === "unread") {
      query = query.is("read_at", null);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notifications:", error);
      toast.error("Không thể tải thông báo");
    } else {
      setNotifications(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user, filter]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    const { success } = await markAllNotificationsAsRead(user.id);
    if (success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read_at: new Date().toISOString() })));
      toast.success("Đã đánh dấu tất cả là đã đọc");
    }
  };

  const handleRead = async (id: string) => {
    const { success } = await markNotificationAsRead(id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
      );
    }
  };

  const handleDismiss = async (id: string) => {
    const { error } = await supabase
      .from("notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Đã xóa thông báo");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <header className="bg-white border-b border-slate-200/60 sticky top-0 z-10">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="rounded-full">
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase">
              Trung tâm thông báo
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs font-bold border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl"
            >
              <CheckCircle className="w-3.5 h-3.5 mr-2" />
              Đọc tất cả
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-2 mb-6 bg-white p-1 rounded-2xl border border-slate-200 w-fit">
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className={`text-xs font-bold rounded-xl px-6 ${filter === "all" ? "shadow-lg shadow-primary/20" : ""}`}
          >
            Tất cả
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("unread")}
            className={`text-xs font-bold rounded-xl px-6 ${filter === "unread" ? "shadow-lg shadow-primary/20" : ""}`}
          >
            Chưa đọc
          </Button>
        </div>

        <div className="bg-white rounded-[28px] border border-slate-200/60 shadow-sm overflow-hidden">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-xs font-bold text-slate-400 mt-4 uppercase tracking-widest">
                Đang tải thông báo...
              </p>
            </div>
          ) : notifications.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-6 flex items-start gap-4 transition-all hover:bg-slate-50/80 group ${!n.read_at ? "bg-primary/[0.02] border-l-4 border-l-primary" : "border-l-4 border-l-transparent"}`}
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${!n.read_at ? "bg-primary text-white" : "bg-slate-100 text-slate-400"}`}
                  >
                    <Bell className="w-5 h-5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3
                          className={`text-base font-bold mb-1 ${!n.read_at ? "text-slate-900" : "text-slate-600"}`}
                        >
                          {n.title}
                        </h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-3">{n.message}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold text-slate-400 border-slate-200 whitespace-nowrap"
                      >
                        {format(new Date(n.created_at), "HH:mm, dd/MM/yyyy")}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap">
                      {n.customer_id && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await handleRead(n.id);
                            setPreviewCustomer({ id: n.customer_id });
                          }}
                          className="h-8 text-[11px] font-black uppercase tracking-wider px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          Xem Khách Hàng 👤
                        </Button>
                      )}
                      {n.action_url && (
                        <Button
                          size="sm"
                          onClick={async () => {
                            await handleRead(n.id);
                            if (n.action_url.startsWith("http")) {
                              window.open(n.action_url, "_blank");
                            } else {
                              navigate({ to: n.action_url });
                            }
                          }}
                          className="h-8 text-[11px] font-black uppercase tracking-wider px-4 rounded-lg bg-slate-900 hover:bg-primary"
                        >
                          Xử lý ngay <ExternalLink className="w-3 h-3 ml-2" />
                        </Button>
                      )}
                      {!n.read_at && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRead(n.id)}
                          className="h-8 text-[11px] font-bold text-slate-500 hover:text-primary hover:bg-primary/5 px-3 rounded-lg"
                        >
                          Đánh dấu đã đọc
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDismiss(n.id)}
                        className="h-8 text-[11px] font-bold text-slate-400 hover:text-red-600 hover:bg-red-50 px-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 className="w-3 h-3 mr-1.5" />
                        Gỡ bỏ
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-32 flex flex-col items-center justify-center text-slate-300">
              <div className="w-20 h-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                <Inbox className="w-10 h-10 opacity-20" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">
                Hộp thư trống
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-2">
                Bạn chưa có thông báo nào trong danh sách này.
              </p>
            </div>
          )}
        </div>
      </main>

      <CustomerPreviewDrawer
        customer={previewCustomer}
        open={!!previewCustomer}
        onOpenChange={(open) => !open && setPreviewCustomer(null)}
      />
    </div>
  );
}
