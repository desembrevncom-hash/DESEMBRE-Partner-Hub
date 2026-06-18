import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

interface ConfirmCancelDispatchModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isProcessing: boolean;
}

export function ConfirmCancelDispatchModal({
  isOpen,
  onOpenChange,
  onConfirm,
  isProcessing,
}: ConfirmCancelDispatchModalProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-red-600 text-xl font-bold">Bạn có chắc chắn muốn hủy Kịch bản này?</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600 mt-2 font-medium">
            Hành động này sẽ thay đổi toàn bộ trạng thái trong hàng chờ (queue) từ <strong className="text-slate-800">Sẵn sàng (Ready)</strong> thành <strong className="text-slate-800">Đã hủy (Cancelled)</strong>. Các tiến trình đang gửi cũng sẽ bị cưỡng chế dừng lại.<br /><br />Hành động này không thể hoàn tác.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel disabled={isProcessing} className="rounded-xl font-bold">
            Quay lại
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isProcessing}
            className="rounded-xl bg-red-600 hover:bg-red-700 font-bold"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Xác nhận Hủy Kịch bản
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
