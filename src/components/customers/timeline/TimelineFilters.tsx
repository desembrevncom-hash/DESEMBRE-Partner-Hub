import React from 'react';
import { TimelineSource } from '@/types/customerTimeline';
import { Badge } from '@/components/ui/badge';

interface Props {
  activeFilter: TimelineSource | 'all';
  onFilterChange: (filter: TimelineSource | 'all') => void;
}

export const TimelineFilters: React.FC<Props> = ({ activeFilter, onFilterChange }) => {
  const filters: { value: TimelineSource | 'all'; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'interaction', label: 'Liên hệ' },
    { value: 'activity', label: 'Ghi chú' },
    { value: 'calendar', label: 'Lịch hẹn' },
    { value: 'task', label: 'Công việc' },
    { value: 'order', label: 'Đơn hàng' },
    { value: 'channel', label: 'Kênh liên hệ' },
  ];

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {filters.map(filter => (
        <Badge
          key={filter.value}
          variant="outline"
          className={`cursor-pointer px-3 py-1.5 text-[11px] font-bold transition-colors ${
            activeFilter === filter.value 
              ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800' 
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-700'
          }`}
          onClick={() => onFilterChange(filter.value)}
        >
          {filter.label}
        </Badge>
      ))}
    </div>
  );
};
