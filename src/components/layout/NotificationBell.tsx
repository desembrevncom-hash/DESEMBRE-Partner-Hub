import { useState, useEffect } from "react";
import { Bell, Check, Loader2, ExternalLink, Phone, UserPlus, CheckSquare, Target, AlertTriangle } from "lucide-react";
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
    
    // Fetch unread count
    const count = await getUnreadNotificationCount(user.id);
    setUnreadCount(count);

    // Fetch last 10 notifications
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("recipient_user_id", user.id)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching notifications:", error);
    } else {
      setNotifications(data || []);
    }
  };

  useEffect(() => {
    fetchNotifications();

    if (!user) return;

    // Thiết lập Realtime subscription cho bảng notifications
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          const newNotif = payload.new;
          
          // Cập nhật state ngay lập tức
          setNotifications(prev => [newNotif, ...prev].slice(0, 10));
          setUnreadCount(prev => prev + 1);
          
          // Hiển thị toast thông báo
          toast(newNotif.title, {
            description: newNotif.message,
            action: newNotif.action_url ? {
              label: "Xem ngay",
              onClick: () => navigate({ to: newNotif.action_url })
            } : undefined,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleMarkAllRead = async () => {
    if (!user) return;
    setLoading(true);
    const { success } = await markAllNotificationsAsRead(user.id);
    if (success) {
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      toast.success("Đã đánh dấu tất cả là đã đọc");
    }
    setLoading(false);
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.read_at) {
      await markNotificationAsRead(n.id);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read_at: new Date().toISOString() } : item));
    }

    if (n.action_url) {
      navigate({ to: n.action_url });
    }
  };

  const getNotificationIcon = (type: string, priority: string) => {
    const iconClass = "w-4 h-4";
    switch (type) {
      case 'task_assigned': return <CheckSquare className={`${iconClass} text-blue-500`} />;
      case 'customer_assigned': return <UserPlus className={`${iconClass} text-emerald-500`} />;
      case 'lead_assigned': return <Target className={`${iconClass} text-purple-500`} />;
      case 'follow_up_reminder': return <Phone className={`${iconClass} text-amber-500`} />;
      default: return priority === 'urgent' ? <AlertTriangle className={`${iconClass} text-red-500`} /> : <Bell className={`${iconClass} text-slate-400`} />;
    }
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && fetchNotifications()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 rounded-full transition-all">
          <Bell className={`w-5 h-5 ${unreadCount > 0 ? "text-primary animate-pulse" : "text-slate-500"}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white ring-2 ring-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 sm:w-96 rounded-2xl border-slate-200 shadow-2xl p-0 overflow-hidden bg-white/95 backdrop-blur-xl">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/50 border-b border-slate-100">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
            Thông báo
            {unreadCount > 0 && <span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full">{unreadCount} mới</span>}
          </h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleMarkAllRead}
              disabled={loading}
              className="text-[10px] font-bold h-7 px-2 text-primary hover:bg-primary/5 rounded-lg"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
              Đọc tất cả
            </Button>
          )}
        </div>

        <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-4 p-4 cursor-pointer transition-colors focus:bg-slate-50 border-b border-slate-50 last:border-0 ${!n.read_at ? "bg-primary/5" : ""}`}
              >
                <div className="mt-0.5 shrink-0">
                  {getNotificationIcon(n.type, n.priority)}
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex items-start justify-between w-full gap-2">
                    <span className={`text-[13px] leading-tight font-bold ${!n.read_at ? "text-slate-900" : "text-slate-600"}`}>
                      {n.title}
                    </span>
                    {!n.read_at && <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0" />}
                  </div>
                  {n.message && (
                    <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                  )}
                  <div className="flex items-center justify-between w-full mt-1.5">
                    <span className="text-[10px] font-medium text-slate-400">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: vi })}
                    </span>
                    {n.action_url && (
                      <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                        Chi tiết <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    )}
                  </div>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <Bell className="w-8 h-8 opacity-20 mb-3" />
              <p className="text-xs font-medium uppercase tracking-widest">Không có thông báo mới</p>
            </div>
          )}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <Button 
          variant="ghost" 
          className="w-full h-11 rounded-none text-xs font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50"
          onClick={() => navigate({ to: "/notifications" })}
        >
          Xem tất cả thông báo
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
