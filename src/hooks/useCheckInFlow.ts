/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateDistanceMeters, isWithinRadius, hasValidCoordinates } from "@/lib/geo";
import { toast } from "sonner";

export interface GpsCoord {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export function useCheckInFlow(user: any, onCheckInSuccess?: () => void) {
  const [currentGps, setCurrentGps] = useState<GpsCoord | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [checkinNote, setCheckinNote] = useState("");
  const [checkinPhotos, setCheckinPhotos] = useState<File[]>([]);
  const [checkinSubmitting, setCheckinSubmitting] = useState(false);
  const [showCheckinDialog, setShowCheckinDialog] = useState(false);

  const getIsException = (customer: any) => {
    if (!currentGps || !customer) return false;
    const hasCoords = hasValidCoordinates(customer);
    if (!hasCoords) return true;
    const distance = calculateDistanceMeters(
      currentGps.latitude,
      currentGps.longitude,
      Number(customer.latitude),
      Number(customer.longitude),
    );
    return !isWithinRadius(distance, 200);
  };

  const handleGetGpsForCheckin = () => {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt của bạn không hỗ trợ định vị Geolocation.");
      return;
    }

    setGpsLoading(true);
    const toastId = toast.loading("Đang xác định vị trí của bạn để check-in...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        toast.dismiss(toastId);
        setGpsLoading(false);
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentGps({ latitude, longitude, accuracy });
        setShowCheckinDialog(true);
        toast.success("Đã định vị vị trí GPS thành công!");
      },
      (error) => {
        toast.dismiss(toastId);
        setGpsLoading(false);
        console.error("Lỗi định vị check-in:", error);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(
              "Quyền vị trí bị từ chối! Vui lòng cho phép quyền truy cập Vị trí trong cài đặt trình duyệt và thử lại.",
            );
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error("Không lấy được tín hiệu GPS. Vui lòng kiểm tra cài đặt định vị.");
            break;
          case error.TIMEOUT:
            toast.error(
              "Thời gian định vị GPS quá hạn. Vui lòng kiểm tra tín hiệu mạng hoặc thử lại ở khu vực thoáng hơn.",
            );
            break;
          default:
            toast.error("Không lấy được vị trí GPS hiện tại.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const compressPhoto = (file: File): Promise<File> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(
                  new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                    type: "image/webp",
                    lastModified: Date.now(),
                  }),
                );
              } else {
                resolve(file);
              }
            },
            "image/webp",
            0.8,
          );
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleCheckIn = async (customer: any) => {
    if (!customer) {
      toast.error("Vui lòng chọn khách hàng.");
      return;
    }
    if (!currentGps) {
      toast.error("Thiếu tọa độ định vị GPS hiện tại.");
      return;
    }

    const hasCoords = hasValidCoordinates(customer);
    let distance: number | null = null;
    let isValid = false;

    if (hasCoords) {
      distance = calculateDistanceMeters(
        currentGps.latitude,
        currentGps.longitude,
        Number(customer.latitude),
        Number(customer.longitude),
      );
      isValid = isWithinRadius(distance, 200);
    }

    const isException = getIsException(customer);

    if (isException && !checkinNote.trim()) {
      toast.error(
        "Vui lòng nhập lý do check-in ngoại lệ (khoảng cách > 200m hoặc chưa định vị Spa).",
      );
      return;
    }

    setCheckinSubmitting(true);
    const toastId = toast.loading("Đang ghi nhận lượt check-in...");

    try {
      // 1. Insert customer_visit_checkins
      const { data: checkinData, error: checkinErr } = await supabase
        .from("customer_visit_checkins")
        .insert({
          customer_id: customer.id,
          checked_in_by: user?.id,
          latitude: currentGps.latitude,
          longitude: currentGps.longitude,
          accuracy_meters: currentGps.accuracy,
          customer_latitude: hasCoords ? Number(customer.latitude) : null,
          customer_longitude: hasCoords ? Number(customer.longitude) : null,
          distance_meters: distance,
          is_valid_location: isValid,
          valid_radius_meters: 200,
          note: checkinNote,
        })
        .select("id")
        .single();

      if (checkinErr) throw checkinErr;
      if (!checkinData) throw new Error("Không thể khởi tạo mã check-in.");

      // 2. Upload photos if any selected
      const uploadedPaths: string[] = [];
      const photoMetadataRecords: any[] = [];

      if (checkinPhotos.length > 0) {
        for (let i = 0; i < checkinPhotos.length; i++) {
          toast.loading(`Đang nén và tải lên hình ảnh (${i + 1}/${checkinPhotos.length})...`, {
            id: toastId,
          });
          const originalFile = checkinPhotos[i];
          const compressedFile = await compressPhoto(originalFile);

          const photoId = crypto.randomUUID();
          const storagePath = `${customer.id}/${checkinData.id}/${photoId}.webp`;

          const { error: uploadErr } = await supabase.storage
            .from("visit-photos")
            .upload(storagePath, compressedFile, {
              cacheControl: "3600",
              upsert: false,
            });

          if (uploadErr) {
            // Rollback already uploaded files
            for (const path of uploadedPaths) {
              await supabase.storage.from("visit-photos").remove([path]);
            }
            // Cascade delete checkin record
            await supabase.from("customer_visit_checkins").delete().eq("id", checkinData.id);
            throw new Error(`Lỗi tải ảnh lên Storage: ${uploadErr.message}`);
          }

          uploadedPaths.push(storagePath);

          const dimensions = await new Promise<{ width: number; height: number } | null>(
            (resolve) => {
              const r = new FileReader();
              r.readAsDataURL(compressedFile);
              r.onload = (e) => {
                const im = new Image();
                im.src = e.target?.result as string;
                im.onload = () => resolve({ width: im.width, height: im.height });
                im.onerror = () => resolve(null);
              };
              r.onerror = () => resolve(null);
            },
          );

          photoMetadataRecords.push({
            id: photoId,
            checkin_id: checkinData.id,
            customer_id: customer.id,
            uploaded_by: user?.id,
            storage_bucket: "visit-photos",
            storage_path: storagePath,
            file_name: originalFile.name,
            mime_type: compressedFile.type,
            file_size_bytes: compressedFile.size,
            width: dimensions?.width || null,
            height: dimensions?.height || null,
            photo_type: i === 0 ? "storefront" : "other",
          });
        }

        // Insert metadata records into public.customer_visit_photos
        const { error: metaErr } = await supabase
          .from("customer_visit_photos")
          .insert(photoMetadataRecords);

        if (metaErr) {
          // Metadata fail rollback: Delete uploaded storage files
          for (const path of uploadedPaths) {
            await supabase.storage.from("visit-photos").remove([path]);
          }
          // Delete checkin record to maintain consistency
          await supabase.from("customer_visit_checkins").delete().eq("id", checkinData.id);
          throw new Error(`Lỗi lưu thông tin ảnh vào DB: ${metaErr.message}`);
        }
      }

      // 3. Insert customer_activities (direct_visit)
      const distanceLabel = distance !== null ? `${Math.round(distance)}m` : "Chưa xác định";
      const statusLabel = isValid ? "Đúng vị trí (< 200m)" : "Ngoại lệ (Sai lệch hoặc chưa ghim)";
      const { error: actErr } = await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        created_by: user?.id,
        activity_type: "direct_visit",
        title: `Check-in tại khách hàng${isValid ? "" : " (Ngoại lệ)"}`,
        content: `Nhân viên check-in: ${user?.email || "Staff"}\nKhoảng cách: ${distanceLabel}\nTrạng thái: ${statusLabel}\nSố ảnh đính kèm: ${checkinPhotos.length}\nGhi chú: ${checkinNote || "Không có"}`,
        metadata: { checkin_id: checkinData.id },
      });

      if (actErr) throw actErr;

      // 4. Update customer last interaction metadata
      await supabase
        .from("customers")
        .update({
          last_owner_activity_at: new Date().toISOString(),
        })
        .eq("id", customer.id);

      toast.dismiss(toastId);
      toast.success("Check-in và lưu hình ảnh thành công!");
      setShowCheckinDialog(false);
      setCurrentGps(null);
      setCheckinNote("");
      setCheckinPhotos([]); // Reset files

      if (onCheckInSuccess) {
        onCheckInSuccess();
      }
    } catch (err: any) {
      toast.dismiss(toastId);
      toast.error("Không thể hoàn tất check-in: " + err.message);
    } finally {
      setCheckinSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setCurrentGps(null);
    setCheckinNote("");
    setCheckinPhotos([]);
    setShowCheckinDialog(false);
  };

  return {
    currentGps,
    setCurrentGps,
    gpsLoading,
    checkinNote,
    setCheckinNote,
    checkinPhotos,
    setCheckinPhotos,
    checkinSubmitting,
    showCheckinDialog,
    setShowCheckinDialog,
    getIsException,
    handleGetGpsForCheckin,
    handleCheckIn,
    handleResetForm,
  };
}
