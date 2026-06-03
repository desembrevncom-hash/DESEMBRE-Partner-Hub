/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, Loader2, Crosshair, AlertCircle, CheckCircle2, Camera, X } from "lucide-react";
import { hasValidCoordinates, calculateDistanceMeters, isWithinRadius } from "@/lib/geo";
import { toast } from "sonner";

interface GpsCoord {
  latitude: number;
  longitude: number;
  accuracy: number;
}

interface CheckInFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  currentGps: GpsCoord | null;
  setCurrentGps: (gps: GpsCoord | null) => void;
  gpsLoading: boolean;
  checkinNote: string;
  setCheckinNote: (note: string) => void;
  checkinPhotos: File[];
  setCheckinPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  checkinSubmitting: boolean;
  handleGetGpsForCheckin: () => void;
  handleCheckIn: (customer: any) => Promise<void>;
  handleResetForm: () => void;
}

export const CheckInFlow: React.FC<CheckInFlowProps> = ({
  open,
  onOpenChange,
  customer,
  currentGps,
  gpsLoading,
  checkinNote,
  setCheckinNote,
  checkinPhotos,
  setCheckinPhotos,
  checkinSubmitting,
  handleGetGpsForCheckin,
  handleCheckIn,
  handleResetForm,
}) => {
  if (!customer) return null;

  const hasCoords = hasValidCoordinates(customer);
  const getDistance = () => {
    if (!currentGps || !hasCoords) return null;
    return calculateDistanceMeters(
      currentGps.latitude,
      currentGps.longitude,
      Number(customer.latitude),
      Number(customer.longitude),
    );
  };

  const distance = getDistance();
  const isCheckinException = currentGps ? !hasCoords || !isWithinRadius(distance, 200) : false;

  const handleClose = () => {
    handleResetForm();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
    >
      <DialogContent className="max-w-md w-[calc(100%-32px)] rounded-2xl p-5 gap-4 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600 animate-pulse" />
            HOÀN TẤT CHECK-IN THỰC ĐỊA
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500 font-medium">
            Hệ thống sẽ lưu lại tọa độ thực địa của bạn để đối chiếu với địa chỉ định vị của Spa.
          </DialogDescription>
        </DialogHeader>

        {currentGps && (
          <div className="space-y-3.5 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Độ chính xác GPS
              </span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">
                  +/- {Math.round(currentGps.accuracy)} mét
                </span>
                <button
                  onClick={handleGetGpsForCheckin}
                  disabled={gpsLoading}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 border border-primary/20 px-2 py-0.5 rounded bg-white"
                >
                  {gpsLoading ? (
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  ) : (
                    <Crosshair className="w-2.5 h-2.5" />
                  )}
                  Thử lại vị trí
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Tọa độ thực tế
              </span>
              <span className="font-mono text-slate-800">
                {currentGps.latitude.toFixed(5)}, {currentGps.longitude.toFixed(5)}
              </span>
            </div>

            {hasCoords ? (
              <>
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Khoảng cách đến Spa
                  </span>
                  <span className="font-bold text-slate-800">
                    {distance !== null ? Math.round(distance) : "—"} mét
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                    Trạng thái vị trí
                  </span>
                  {distance !== null && isWithinRadius(distance, 200) ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 text-[10px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Hợp lệ (&lt; 200m)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-700 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100 text-[10px] animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Ngoại lệ (&gt; 200m)
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                  Trạng thái vị trí
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Chưa ghim Spa (Ngoại lệ)
                </span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4">
          {/* Form ghi chú check-in */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span>Nội dung / Lý do check-in</span>
              {isCheckinException && (
                <span className="text-rose-500 font-bold lowercase">
                  * (bắt buộc vì check-in ngoại lệ)
                </span>
              )}
            </label>
            <Textarea
              placeholder={
                isCheckinException
                  ? "Nhập lý do check-in ngoại lệ (bắt buộc)..."
                  : "Mô tả công việc thực địa tại spa (không bắt buộc)..."
              }
              value={checkinNote}
              onChange={(e) => setCheckinNote(e.target.value)}
              className={`min-h-[80px] text-xs ${
                isCheckinException && !checkinNote.trim()
                  ? "border-amber-500 focus-visible:ring-amber-500 bg-amber-50/10"
                  : ""
              }`}
            />
            {isCheckinException && !checkinNote.trim() && (
              <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />* Đây là lượt check-in ngoại lệ. Bạn bắt buộc
                phải điền lý do/ghi chú viếng thăm.
              </p>
            )}
          </div>

          {/* Tải ảnh minh chứng check-in (Tối đa 2 ảnh) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex justify-between">
              <span>Hình ảnh ({checkinPhotos.length}/2)</span>
              <span className="text-slate-400 font-normal lowercase">tối đa 2 ảnh</span>
            </label>

            <div className="grid grid-cols-3 gap-2">
              {checkinPhotos.length < 2 && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    id="shared-checkin-photo-upload"
                    onChange={(e) => {
                      const selectedFiles = Array.from(e.target.files || []);
                      const totalFiles = checkinPhotos.length + selectedFiles.length;
                      if (totalFiles > 2) {
                        toast.error("Mỗi lần check-in chỉ được tải tối đa 2 ảnh.");
                        return;
                      }
                      setCheckinPhotos((prev) => [...prev, ...selectedFiles]);
                    }}
                  />
                  <label
                    htmlFor="shared-checkin-photo-upload"
                    className="aspect-square rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/20 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer text-slate-400 hover:text-indigo-600"
                  >
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px] font-bold uppercase">Thêm ảnh</span>
                  </label>
                </div>
              )}

              {checkinPhotos.map((file, idx) => {
                const objectUrl = URL.createObjectURL(file);
                return (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-100 group shadow-sm bg-slate-100"
                  >
                    <img
                      src={objectUrl}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setCheckinPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center text-white hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <Button
            variant="outline"
            onClick={handleClose}
            className="flex-1 rounded-xl h-11 text-xs font-black uppercase tracking-wider"
          >
            Hủy
          </Button>
          <Button
            onClick={() => handleCheckIn(customer)}
            disabled={
              checkinSubmitting || !currentGps || (isCheckinException && !checkinNote.trim())
            }
            className="flex-1 rounded-xl h-11 text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-black text-white"
          >
            {checkinSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                Đang xử lý
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Xác nhận Check-in
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
