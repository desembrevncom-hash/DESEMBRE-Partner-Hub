import React, { useState, useEffect } from "react";
import { TimelineItem as ITimelineItem } from "@/types/customerTimeline";
import {
  FileText,
  Calendar,
  CheckSquare,
  Package,
  Link2,
  Clock,
  User,
  ChevronRight,
  MessageSquare,
  Eye,
  Loader2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { CRMCard } from "@/components/crm/CRMCard";

interface Props {
  item: ITimelineItem;
  onClick?: (item: ITimelineItem) => void;
}

export const TimelineItem: React.FC<Props> = ({ item, onClick }) => {
  const isClickable = !!onClick && ["order", "calendar", "channel", "task"].includes(item.source);
  const [photos, setPhotos] = useState<{ id: string; file_name: string; url: string }[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const checkinId =
    item.source === "activity" && item.metadata && typeof item.metadata === "object"
      ? (item.metadata as any).checkin_id
      : null;

  useEffect(() => {
    if (!checkinId) return;

    const fetchSignedPhotos = async () => {
      setLoadingPhotos(true);
      try {
        const { data: dbPhotos, error: dbErr } = await supabase
          .from("customer_visit_photos")
          .select("id, storage_path, file_name")
          .eq("checkin_id", checkinId);

        if (dbErr) throw dbErr;

        if (dbPhotos && dbPhotos.length > 0) {
          const loadedPhotos = [];
          for (const p of dbPhotos) {
            const { data: signData, error: signErr } = await supabase.storage
              .from("visit-photos")
              .createSignedUrl(p.storage_path, 900);

            if (!signErr && signData?.signedUrl) {
              loadedPhotos.push({
                id: p.id,
                file_name: p.file_name,
                url: signData.signedUrl,
              });
            }
          }
          setPhotos(loadedPhotos);
        }
      } catch (err) {
        console.error("Error fetching checkin photos:", err);
      } finally {
        setLoadingPhotos(false);
      }
    };

    fetchSignedPhotos();
  }, [checkinId]);

  const getIconConfig = () => {
    switch (item.source) {
      case "activity":
        return {
          icon: <FileText className="w-4 h-4 text-blue-500" />,
          bg: "bg-blue-100",
          border: "border-blue-200",
        };
      case "calendar":
        return {
          icon: <Calendar className="w-4 h-4 text-purple-500" />,
          bg: "bg-purple-100",
          border: "border-purple-200",
        };
      case "task":
        return {
          icon: <CheckSquare className="w-4 h-4 text-emerald-500" />,
          bg: "bg-emerald-100",
          border: "border-emerald-200",
        };
      case "order":
        return {
          icon: <Package className="w-4 h-4 text-amber-500" />,
          bg: "bg-amber-100",
          border: "border-amber-200",
        };
      case "channel":
        return {
          icon: <Link2 className="w-4 h-4 text-indigo-500" />,
          bg: "bg-indigo-100",
          border: "border-indigo-200",
        };
      case "interaction":
        return {
          icon: <MessageSquare className="w-4 h-4 text-rose-500" />,
          bg: "bg-rose-100",
          border: "border-rose-200",
        };
      default:
        return {
          icon: <FileText className="w-4 h-4 text-slate-500" />,
          bg: "bg-slate-100",
          border: "border-slate-200",
        };
    }
  };

  const config = getIconConfig();
  const timeRelative = formatDistanceToNow(new Date(item.occurred_at), {
    addSuffix: true,
    locale: vi,
  });
  const timeExact = format(new Date(item.occurred_at), "HH:mm dd/MM/yyyy");

  return (
    <div className="relative flex gap-4 group">
      {/* Timeline Line */}
      <div className="absolute left-[19px] top-10 bottom-[-16px] w-0.5 bg-slate-100 group-last:hidden"></div>

      {/* Icon */}
      <div
        className={`relative z-10 z-index-timeline-icon w-10 h-10 rounded-full flex items-center justify-center border-2 shrink-0 ${config.bg} ${config.border}`}
      >
        {config.icon}
      </div>

      {/* Content */}
      <div
        className={`flex-1 pb-6 ${isClickable ? "cursor-pointer" : ""}`}
        onClick={() => isClickable && onClick && onClick(item)}
      >
        <CRMCard
          className={`p-4 transition-all ${isClickable ? "hover:border-slate-300 hover:shadow-sm cursor-pointer" : "border-slate-150"}`}
        >
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
                  {item.created_by_name || "Hệ thống"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {item.status && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold uppercase tracking-wider bg-slate-50"
                >
                  {item.status.replace(/_/g, " ")}
                </Badge>
              )}
              {isClickable && (
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
              )}
            </div>
          </div>

          {item.description && (
            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 whitespace-pre-wrap">
              {item.description}
            </div>
          )}

          {/* Ảnh minh chứng check-in di động */}
          {checkinId && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              {loadingPhotos ? (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-bold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải hình ảnh...
                </div>
              ) : photos.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Hình ảnh ({photos.length}/2)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
                    {photos.map((p, index) => (
                      <div
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPhoto(p.url);
                        }}
                        className="relative group rounded-xl overflow-hidden aspect-video border border-slate-200 cursor-pointer shadow-3xs bg-slate-900"
                      >
                        <img
                          src={p.url}
                          alt={p.file_name}
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-100 group-hover:scale-103 transition-all duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="w-5 h-5 text-white animate-pulse" />
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black text-white px-1 py-0.5 rounded bg-black/45 backdrop-blur-3xs">
                          {index === 0 ? "Mặt tiền" : "Bổ sung"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Hộp xem ảnh phóng to Lightbox */}
          {selectedPhoto && (
            <div
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPhoto(null);
              }}
            >
              <div
                className="relative max-w-2xl w-full max-h-[85dvh] rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={selectedPhoto}
                  alt="Hình ảnh phóng to"
                  className="w-full h-auto max-h-[85dvh] object-contain rounded-2xl"
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPhoto(null);
                  }}
                  className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 text-white rounded-full h-11 px-4 text-xs font-black shadow-lg transition-transform hover:scale-105 flex items-center justify-center"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* Metadata Badges if needed */}
          {item.source === "channel" && item.metadata?.channel_type && (
            <div className="mt-2 flex gap-1">
              <Badge className="text-[9px] bg-indigo-50 text-indigo-700 border-indigo-200">
                {item.metadata.channel_type}
              </Badge>
              {item.metadata.scope === "official" && (
                <Badge className="text-[9px] bg-green-50 text-green-700 border-green-200">
                  Official
                </Badge>
              )}
            </div>
          )}

          {item.source === "interaction" && item.metadata?.platform && (
            <div className="mt-2 flex gap-1 flex-wrap">
              <Badge className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 capitalize">
                {item.metadata.platform}
              </Badge>
              {item.metadata.template_title && (
                <Badge className="text-[9px] bg-slate-100 text-slate-600 border-slate-200">
                  Mẫu: {item.metadata.template_title}
                </Badge>
              )}
              {item.metadata.result === "failed" && (
                <Badge className="text-[9px] bg-red-50 text-red-700 border-red-200">Lỗi</Badge>
              )}
            </div>
          )}
        </CRMCard>
      </div>
    </div>
  );
};
