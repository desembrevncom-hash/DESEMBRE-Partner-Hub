import React, { useState } from "react";
import { useCustomerTimeline } from "@/hooks/useCustomerTimeline";
import { TimelineFilters } from "./TimelineFilters";
import { TimelineItem as TimelineItemComponent } from "./TimelineItem";
import { TimelineSource, TimelineItem } from "@/types/customerTimeline";
import { Loader2, Zap } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { CRMLoadingState } from "@/components/crm/CRMLoadingState";
import { CRMEmptyState } from "@/components/crm/CRMEmptyState";

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
        <div className="py-12">
          <CRMLoadingState type="list" rows={3} />
        </div>
      ) : filteredData.length === 0 ? (
        <CRMEmptyState
          icon={<Zap className="w-10 h-10 text-slate-300" />}
          title="Chưa có hoạt động nào"
          description={
            activeFilter === "all"
              ? "Hãy bắt đầu tương tác bằng cách tạo ghi chú, lịch hẹn hoặc thêm kênh liên hệ đầu tiên."
              : "Không tìm thấy dữ liệu phù hợp với bộ lọc hiện tại."
          }
          className="mt-4"
        />
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
