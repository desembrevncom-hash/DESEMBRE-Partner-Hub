import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook lắng nghe sự kiện thay đổi dữ liệu theo thời gian thực (Realtime) trên bảng calendar_events.
 * Tự động gọi lại hàm reloadEvents khi có tác vụ INSERT, UPDATE hoặc DELETE từ bất kỳ thiết bị/tài khoản nào.
 */
export function useCalendarRealtime(reloadEvents: () => void) {
  useEffect(() => {
    const channel = supabase
      .channel("calendar_enterprise_channel")
      // Lắng nghe Lịch cá nhân
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "calendar_events" },
        () => reloadEvents()
      )
      // Lắng nghe Sự kiện công ty
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_events" },
        () => reloadEvents()
      )
      // Lắng nghe Đăng ký tham dự (để cập nhật ROI/Stats trong modal)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_registrations" },
        () => reloadEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [reloadEvents]);
}
