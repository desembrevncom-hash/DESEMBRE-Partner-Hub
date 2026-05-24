import React from 'react';
import { TimelineItem as ITimelineItem } from '@/types/customerTimeline';
import { 
  FileText, 
  Calendar, 
  CheckSquare, 
  Package, 
  Link2,
  Clock,
  User,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Props {
  item: ITimelineItem;
  onClick?: (item: ITimelineItem) => void;
}

export const TimelineItem: React.FC<Props> = ({ item, onClick }) => {
  const isClickable = !!onClick && ['order', 'calendar', 'channel', 'task'].includes(item.source);

  const getIconConfig = () => {
    switch (item.source) {
      case 'activity':
        return { icon: <FileText className="w-4 h-4 text-blue-500" />, bg: 'bg-blue-100', border: 'border-blue-200' };
      case 'calendar':
        return { icon: <Calendar className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-100', border: 'border-purple-200' };
      case 'task':
        return { icon: <CheckSquare className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-100', border: 'border-emerald-200' };
      case 'order':
        return { icon: <Package className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-100', border: 'border-amber-200' };
      case 'channel':
        return { icon: <Link2 className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-100', border: 'border-indigo-200' };
      case 'interaction':
        return { icon: <MessageSquare className="w-4 h-4 text-rose-500" />, bg: 'bg-rose-100', border: 'border-rose-200' };
      default:
        return { icon: <FileText className="w-4 h-4 text-slate-500" />, bg: 'bg-slate-100', border: 'border-slate-200' };
    }
  };

  const config = getIconConfig();
  const timeRelative = formatDistanceToNow(new Date(item.occurred_at), { addSuffix: true, locale: vi });
  const timeExact = format(new Date(item.occurred_at), 'HH:mm dd/MM/yyyy');

  return (
    <div className="relative flex gap-4 group">
      {/* Timeline Line */}
      <div className="absolute left-[19px] top-10 bottom-[-16px] w-0.5 bg-slate-100 group-last:hidden"></div>

      {/* Icon */}
      <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${config.bg} ${config.border}`}>
        {config.icon}
      </div>

      {/* Content */}
      <div 
        className={`flex-1 pb-6 ${isClickable ? 'cursor-pointer' : ''}`}
        onClick={() => isClickable && onClick && onClick(item)}
      >
        <div className={`bg-white border rounded-2xl p-4 transition-all ${isClickable ? 'hover:border-slate-300 hover:shadow-sm' : 'border-slate-150'}`}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900 leading-snug">{item.title}</h4>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                <span className="flex items-center gap-1" title={timeExact}>
                  <Clock className="w-3 h-3" />
                  {timeRelative}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.created_by_name || 'Hệ thống'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {item.status && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-slate-50">
                  {item.status.replace(/_/g, ' ')}
                </Badge>
              )}
              {isClickable && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />}
            </div>
          </div>

          {item.description && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
              {item.description}
            </div>
          )}

          {/* Metadata Badges if needed */}
          {item.source === 'channel' && item.metadata?.channel_type && (
            <div className="mt-2 flex gap-1">
              <Badge className="text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200">
                {item.metadata.channel_type}
              </Badge>
              {item.metadata.scope === 'official' && (
                <Badge className="text-[9px] bg-green-50 text-green-700 border-green-200">Official</Badge>
              )}
            </div>
          )}

          {item.source === 'interaction' && item.metadata?.platform && (
            <div className="mt-2 flex gap-1 flex-wrap">
              <Badge className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 capitalize">
                {item.metadata.platform}
              </Badge>
              {item.metadata.template_title && (
                <Badge className="text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                  Mẫu: {item.metadata.template_title}
                </Badge>
              )}
              {item.metadata.result === 'failed' && (
                <Badge className="text-[9px] bg-red-50 text-red-700 border-red-200">Lỗi</Badge>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
