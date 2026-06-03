import React, { useState } from "react";
import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { TimelineFilters } from "./TimelineFilters";
import { TimelineItem as TimelineItemComponent } from "./TimelineItem";
import { TimelineSource, TimelineItem } from "@/types/customerTimeline";
import { Loader2, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

interface Props {
  customerId: string;
}

export const CustomerTimelineFeed: React.FC<Props> = ({ customerId }) => {
  const { data, loading, error, refetch } = useCustomerTimeline(customerId);
  const [activeFilter, setActiveFilter] = useState<TimelineSource | "all">("all");
  const navigate = useNavigate();

  React.useEffect(() => {
    const handleRefresh = () => refetch();
    window.addEventListener("customer_timeline_refresh", handleRefresh);
    return () => window.removeEventListener("customer_timeline_refresh", handleRefresh);
  }, [refetch]);

  const filteredData = data.filter((item) =>
    activeFilter === "all" ? true : item.source === activeFilter,
  );

  const handleItemClick = (item: TimelineItem) => {
    switch (item.source) {
      case "order":
        // Cần đảm bảo có related_id
        if (item.related_id) {
          navigate({ to: "/orders/$orderId", params: { orderId: item.related_id } });
        } else {
          toast.error("Không tìm thấy ID đơn hàng");
        }
        break;
      case "calendar":
        // Mở popup lịch hẹn hoặc navigate (MVP: chỉ show toast hoặc copy link)
        toast.info(`Mở sự kiện lịch: ${item.title}`);
        break;
      case "channel":
        if (item.description) {
          navigator.clipboard.writeText(item.description);
          toast.success("Đã copy kênh liên hệ!");
        }
        break;
      case "task":
        toast.info(`Mở công việc: ${item.title}`);
        break;
      default:
        break;
    }
  };

  if (error) {
    return (
      <div className="py-12 text-center bg-red-50 rounded-2xl border border-red-100">
        <p className="text-sm font-bold text-red-600">Đã có lỗi xảy ra khi tải lịch sử.</p>
        <button onClick={refetch} className="mt-2 text-xs text-red-500 hover:underline">
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <TimelineFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      {loading && data.length === 0 ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border-2 border-slate-100 mb-4">
            <Zap className="w-6 h-6 text-slate-300" />
          </div>
          <h3 className="text-sm font-black text-slate-800 mb-1">Chưa có hoạt động nào</h3>
          <p className="text-xs text-slate-500 max-w-[250px]">
            {activeFilter === "all"
              ? "Hãy bắt đầu tương tác bằng cách tạo ghi chú, lịch hẹn hoặc thêm kênh liên hệ đầu tiên."
              : "Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."}
          </p>
        </div>
      ) : (
        <div className="space-y-0 pl-1 pb-10">
          {filteredData.map((item) => (
            <TimelineItemComponent key={item.id} item={item} onClick={handleItemClick} />
          ))}
        </div>
      )}
    </div>
  );
};
