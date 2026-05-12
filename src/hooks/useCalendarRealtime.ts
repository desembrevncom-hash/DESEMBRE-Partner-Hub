import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook lắng nghe sự kiện thay đổi dữ liệu theo thời gian thực (Realtime) trên bảng calendar_events.
 * Tự động gọi lại hàm reloadEvents khi có tác vụ INSERT, UPDATE hoặc DELETE từ bất kỳ thiết bị/tài khoản nào.
 */
export function useCalendarRealtime(reloadEvents: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel("calendar_events_channel")
      .on(
        "postgres_changes",
        {
          event: "*", // Lắng nghe toàn bộ các loại sự kiện (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "calendar_events",
        },
        (payload) => {
          // Log nhẹ để hỗ trợ theo dõi/debug trong môi trường development theo đúng yêu cầu
          if (import.meta.env.DEV) {
            console.log("[Calendar Realtime] Nhận tín hiệu đồng bộ từ DB:", payload);
          }
          // Kích hoạt nạp lại danh sách sự kiện
          reloadEvents();
        }
      )
      .subscribe();

    // Hủy đăng ký lắng nghe (Cleanup) khi component bị gỡ bỏ (unmount)
    return () => {
      supabase.removeChannel(channel);
    };
  }, [reloadEvents]);
}
