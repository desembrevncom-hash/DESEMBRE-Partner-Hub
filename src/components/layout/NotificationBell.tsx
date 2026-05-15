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
  ChevronRight
} from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
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

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

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

    const channel = supabase
      .channel(`notif-${user.id}-${Date.now()}`)
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
    await markAllNotificationsAsRead(user.id);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
    toast.success("Đã đọc tất cả thông báo");
    setLoading(false);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'task_assigned': return <div className="p-2 bg-blue-50 rounded-xl"><CheckSquare className={`${iconClass} text-blue-500`} /></div>;
      case 'customer_assigned': return <div className="p-2 bg-emerald-50 rounded-xl"><UserPlus className={`${iconClass} text-emerald-500`} /></div>;
      case 'order_update': return <div className="p-2 bg-indigo-50 rounded-xl"><Package className={`${iconClass} text-indigo-500`} /></div>;
      case 'automation_alert': return <div className="p-2 bg-amber-50 rounded-xl"><Zap className={`${iconClass} text-amber-500`} /></div>;
      default: return <div className="p-2 bg-slate-50 rounded-xl"><Bell className={`${iconClass} text-slate-400`} /></div>;
    }
  };

  return (
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
      <DropdownMenuContent align="end" className="w-96 rounded-[32px] border-none shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-6 py-5 bg-slate-50/50 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
              Trung tâm Nhiệm vụ
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bạn có {unreadCount} cập nhật mới</p>
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

        <div className="max-h-[450px] overflow-y-auto no-scrollbar">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => {
                  if (n.action_url) navigate({ to: n.action_url });
                }}
                className={`flex items-start gap-4 px-6 py-5 cursor-pointer transition-all focus:bg-slate-50 border-b border-slate-50 last:border-0 ${!n.read_at ? "bg-indigo-50/30" : ""}`}
              >
                <div className="shrink-0">{getNotificationIcon(n.type, n.priority)}</div>
                <div className="flex-1 space-y-1">
                   <div className="flex justify-between items-start gap-2">
                      <span className={`text-xs leading-tight font-black ${!n.read_at ? "text-slate-900" : "text-slate-600"}`}>
                        {n.title}
                      </span>
                      {!n.read_at && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5" />}
                   </div>
                   <p className="text-[11px] text-slate-500 font-medium line-clamp-2 leading-relaxed">
                      {n.message}
                   </p>
                   <div className="flex items-center justify-between pt-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1">
                         <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                      </span>
                      {n.action_url && (
                        <span className="text-[9px] font-black text-indigo-600 uppercase flex items-center gap-1">
                           XỬ LÝ NGAY <ChevronRight className="w-3 h-3" />
                        </span>
                      )}
                   </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-slate-300">
              <Bell className="w-12 h-12 opacity-10 mb-4" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Hệ thống đã sẵn sàng</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-50">
           <Button variant="ghost" className="w-full rounded-xl text-[10px] font-black text-slate-400 hover:text-slate-900 uppercase tracking-widest">
              Lịch sử tất cả thông báo
           </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
