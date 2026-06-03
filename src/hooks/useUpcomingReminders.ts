import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { PersonalEvent } from "@/types/calendar";

/**
 * Hook truy vấn và cảnh báo các sự kiện lịch trình sắp diễn ra trong vòng 30 phút tới.
 * Tự động hiển thị Toast thông báo một lần duy nhất khi nạp danh sách thành công.
 */
export function useUpcomingReminders(userId: string | undefined, isAdmin: boolean) {
  const [upcomingEvents, setUpcomingEvents] = useState<PersonalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const notifiedRef = useRef(false);

  const loadReminders = async () => {
    if (!userId) return;
    setLoading(true);

    try {
      const now = new Date();
      const thirtyMinsLater = new Date(now.getTime() + 30 * 60 * 1000);

      // Truy vấn các sự kiện pending nằm trong khung 30 phút tới
      // RLS tự động giới hạn Sale theo dữ liệu của riêng họ, Admin thấy tất cả
      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("status", "pending")
        .gte("starts_at", now.toISOString())
        .lte("starts_at", thirtyMinsLater.toISOString())
        .order("starts_at", { ascending: true });

      if (error) throw error;

      const events = (data || []) as PersonalEvent[];
      setUpcomingEvents(events);

      // Kích hoạt thông báo Toast nhắc việc 1 lần duy nhất khi vào trang
      if (events.length > 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        toast.warning(
          `🔔 Nhắc nhở: Bạn có ${events.length} lịch hẹn sắp diễn ra trong vòng 30 phút tới!`,
          {
            duration: 8000,
            position: "top-right",
          },
        );
      }
    } catch (err) {
      console.warn("Lỗi nạp danh sách nhắc việc:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
    // Tự động kiểm tra lại sau mỗi 2 phút để cập nhật các dải nhắc nhở sát giờ
    const interval = setInterval(loadReminders, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [userId]);

  return { upcomingEvents, loadingReminders: loading, reloadReminders: loadReminders };
}
