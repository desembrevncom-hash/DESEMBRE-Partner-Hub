import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { M9SafetyBanner } from "@/features/marketing/m9-send-control/components/M9SafetyBanner";
import { BatchIdInput } from "@/features/marketing/m9-send-control/components/BatchIdInput";
import { DispatchPreviewCard } from "@/features/marketing/m9-send-control/components/DispatchPreviewCard";
import { DispatchStatusCard } from "@/features/marketing/m9-send-control/components/DispatchStatusCard";
import { DispatchActionPanel } from "@/features/marketing/m9-send-control/components/DispatchActionPanel";
import { GatewayControlsPanel } from "@/features/marketing/m9-send-control/components/GatewayControlsPanel";
import { ConfirmCancelDispatchModal } from "@/features/marketing/m9-send-control/components/ConfirmCancelDispatchModal";
import { m9SendControlApi } from "@/features/marketing/m9-send-control/api/m9SendControlApi";
import { AdminMockDispatchWorkerPanel } from "@/features/marketing/mock-dispatch/AdminMockDispatchWorkerPanel";
import { MockDispatchAttemptsPanel } from "@/features/marketing/mock-dispatch/MockDispatchAttemptsPanel";

export const Route = createFileRoute("/marketing/send-control/")({
  component: SendControlRoute,
});

function SendControlRoute() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const navigate = useNavigate();

  const [batchId, setBatchId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);

  useEffect(() => {
    if (user && !isAdmin && !isSubAdmin) {
      navigate({ to: "/" });
    }
  }, [user, isAdmin, isSubAdmin, navigate]);

  if (!isAdmin && !isSubAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800">Từ chối truy cập</h2>
          <p className="text-slate-500 mt-2">Bạn không có quyền truy cập trang này.</p>
        </div>
      </div>
    );
  }

  const handlePreview = async () => {
    if (!batchId) return;
    setLoadingPreview(true);
    try {
      const data = await m9SendControlApi.previewDispatchPlan(batchId);
      setPreviewData(data);
      toast.success("Đã tạo dữ liệu xem trước thành công.");
    } catch (e: any) {
      toast.error(`Lỗi tạo xem trước: ${e.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCreate = async () => {
    if (!batchId) return;
    setIsProcessing(true);
    try {
      await m9SendControlApi.createDispatchPlan(batchId);
      toast.success("Duyệt Kịch Bản: Đã duyệt kịch bản gửi thành công.");
      handleRefreshStatus();
    } catch (e: any) {
      toast.error(`Lỗi duyệt kịch bản: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRefreshStatus = async () => {
    if (!batchId) return;
    setLoadingStatus(true);
    try {
      const data = await m9SendControlApi.getDispatchStatus(batchId);
      setStatusData(data);
    } catch (e: any) {
      toast.error(`Lỗi tải trạng thái: ${e.message}`);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleCancel = async () => {
    if (!batchId) return;
    setIsProcessing(true);
    try {
      await m9SendControlApi.cancelDispatchPlan(batchId);
      toast.success("Hủy Kịch Bản: Đã hủy kịch bản gửi thành công.");
      handleRefreshStatus();
      setCancelModalOpen(false);
    } catch (e: any) {
      toast.error(`Lỗi hủy kịch bản: ${e.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <div className="container mx-auto px-6 max-w-6xl pt-10 space-y-8">
        <M9SafetyBanner />

        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">M9A-2 Bảng Điều Khiển</h1>
          <p className="text-slate-500 mt-2 font-medium">Giao diện nội bộ chuẩn bị kịch bản gửi tin an toàn.</p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <BatchIdInput
            onBatchIdSelect={(id) => {
              setBatchId(id);
              setPreviewData(null);
              setStatusData(null);
            }}
          />
          {batchId && <p className="text-sm font-medium text-emerald-600 mt-2">Batch đang chọn: {batchId}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <DispatchPreviewCard previewData={previewData} loading={loadingPreview} />
            <DispatchStatusCard statusData={statusData} loading={loadingStatus} />
            <GatewayControlsPanel />
          </div>

          <div className="lg:col-span-1">
            <DispatchActionPanel
              batchId={batchId}
              isProcessing={isProcessing || loadingPreview || loadingStatus}
              onPreview={handlePreview}
              onCreate={handleCreate}
              onRefreshStatus={handleRefreshStatus}
              onCancel={() => setCancelModalOpen(true)}
            />
          </div>
        </div>

        {/* Mock Environment / M10B Dispatch Worker */}
        <div className="pt-8 mt-8 border-t border-slate-200 space-y-8">
          <AdminMockDispatchWorkerPanel initialBatchId={batchId} />
          <MockDispatchAttemptsPanel batchId={batchId} />
        </div>
      </div>

      <ConfirmCancelDispatchModal
        isOpen={cancelModalOpen}
        onOpenChange={setCancelModalOpen}
        onConfirm={handleCancel}
        isProcessing={isProcessing}
      />
    </div>
  );
}
