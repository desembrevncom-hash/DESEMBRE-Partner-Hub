import { useState, useEffect } from "react";
import { 
  Bell, 
  Check, 
  Loader2, 
  ExternalLink, 
  Phone, 
  UserPlus, 
  CheckSquare, 
  Target, 
  AlertTriangle,
  Zap,
  Package,
  MessageSquare,
  Clock,
  ChevronRight,
  User,
  Users
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  getUnreadNotificationCount, 
  markAllNotificationsAsRead,
  markNotificationAsRead 
} from "@/lib/notifications";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { CustomerPreviewDrawer } from "@/components/customers/CustomerPreviewDrawer";
import { getStaffName } from "@/lib/customerOwnership";

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Customer Preview Drawer state
  const [previewCustomerId, setPreviewCustomerId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!user) return;
    const count = await getUnreadNotificationCount(user.id);
    setUnreadCount(count);

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (data) setNotifications(data);
  };

  useEffect(() => {
    fetchNotifications();
    if (!user) return;

    // Use a unique channel name to avoid subscription collisions
    const channel = supabase
      .channel(`notif-bell-${user.id}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new;
          setNotifications(prev => [newNotif, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          toast.info(newNotif.title, { description: newNotif.message });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await markAllNotificationsAsRead(user.id);
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success("Đã đọc tất cả thông báo");
    } catch (e: any) {
      toast.error("Lỗi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNotifClick = async (n: any) => {
    try {
      if (!n.read_at) {
        await markNotificationAsRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      if (n.customer_id) {
        setPreviewCustomerId(n.customer_id);
      } else if (n.action_url) {
        navigate({ to: n.action_url });
      }
    } catch (e: any) {
      console.error("Error handling notification click:", e);
    }
  };

  const getNotificationIcon = (type: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'lead_assigned':
      case 'customer_assigned':
        return (
          <div className="p-2 bg-emerald-50 rounded-xl">
            <UserPlus className={`${iconClass} text-emerald-500`} />
          </div>
        );
      case 'task_assigned':
      case 'task_reminder':
        return (
          <div className="p-2 bg-blue-50 rounded-xl">
            <CheckSquare className={`${iconClass} text-blue-500`} />
          </div>
        );
      case 'order_update':
      case 'order_created':
        return (
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Package className={`${iconClass} text-indigo-500`} />
          </div>
        );
      case 'automation_alert':
      case 'system_alert':
        return (
          <div className="p-2 bg-amber-50 rounded-xl">
            <Zap className={`${iconClass} text-amber-500`} />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-slate-50 rounded-xl">
            <Bell className={`${iconClass} text-slate-400`} />
          </div>
        );
    }
  };

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10 hover:bg-slate-100 rounded-xl transition-all border border-transparent hover:border-slate-200">
            <Bell className={`w-5 h-5 ${unreadCount > 0 ? "text-indigo-600 animate-pulse" : "text-slate-400"}`} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96 rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl z-50">
          <div className="flex items-center justify-between px-6 py-5 bg-slate-50/50 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                Thông báo mới
              </h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bạn có {unreadCount} cập nhật chưa đọc</p>
            </div>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleMarkAllRead}
                disabled={loading}
                className="text-[10px] font-black h-8 px-3 text-indigo-600 hover:bg-indigo-50 rounded-xl"
              >
                ĐỌC TẤT CẢ
              </Button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto no-scrollbar">
            {notifications.length > 0 ? (
              notifications.map((n) => (
                <DropdownMenuItem
                  key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`flex items-start gap-4 px-6 py-4 cursor-pointer transition-all focus:bg-slate-50 border-b border-slate-55 last:border-0 ${!n.read_at ? "bg-indigo-50/20" : ""}`}
                >
                  <div className="shrink-0">{getNotificationIcon(n.type)}</div>
                  <div className="flex-1 space-y-1">
                     <div className="flex justify-between items-start gap-2">
                        <span className={`text-xs leading-tight font-bold ${!n.read_at ? "text-slate-950 font-black" : "text-slate-600"}`}>
                          {n.title}
                        </span>
                        {!n.read_at && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />}
                     </div>
                     <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                        {n.message}
                     </p>
                     <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
                           <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                        </span>
                        {(n.customer_id || n.action_url) && (
                          <span className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1">
                             Xử lý ngay <ChevronRight className="w-3 h-3" />
                          </span>
                        )}
                     </div>
                  </div>
                </DropdownMenuItem>
              ))
            ) : (
              <div className="py-16 flex flex-col items-center justify-center text-slate-300">
                <Bell className="w-10 h-10 opacity-10 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Chưa có thông báo mới</p>
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <CustomerPreviewDrawer 
        customer={{ id: previewCustomerId }}
        open={!!previewCustomerId}
        onOpenChange={(o) => !o && setPreviewCustomerId(null)}
        getStaffName={getStaffName}
      />
    </>
  );
}
