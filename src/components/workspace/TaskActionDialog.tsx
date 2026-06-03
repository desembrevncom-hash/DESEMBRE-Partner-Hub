import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2,
  AlertTriangle,
  CheckCircle,
  PhoneOff,
  UserX,
  Heart,
  CalendarClock,
  ArrowRightLeft,
  Play,
} from "lucide-react";
import {
  handleStartTaskAction,
  handleCompleteTaskAction,
  handleNoAnswerTaskAction,
  handleWrongNumberTaskAction,
  handleInterestedTaskAction,
  handleRescheduleTaskAction,
  handleTransferToSaleTaskAction,
} from "@/lib/taskActions";

interface TaskActionDialogProps {
  taskAction: { task: any; action: string } | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const TaskActionDialog: React.FC<TaskActionDialogProps> = ({
  taskAction,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  // Date time state for reschedule / no answer reschedule
  const [dateTimeValue, setDateTimeValue] = useState("");

  // Next action selection for interested
  const [nextActionValue, setNextActionValue] = useState<"follow_up" | "transfer_to_sale">(
    "follow_up",
  );

  if (!taskAction) return null;

  const { task, action } = taskAction;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (action === "start") {
        await handleStartTaskAction(task.id);
        toast.success("Đã bắt đầu xử lý công việc");
      } else if (action === "completed") {
        await handleCompleteTaskAction(task, user?.id);
        toast.success("Đã hoàn thành công việc");
      } else if (action === "no_answer") {
        await handleNoAnswerTaskAction(task, user?.id, dateTimeValue || null);
        toast.success(dateTimeValue ? "Đã đặt lịch hẹn gọi lại" : "Đã ghi nhận không nghe máy");
      } else if (action === "wrong_number") {
        await handleWrongNumberTaskAction(task, user?.id);
        toast.success("Đã ghi nhận sai số");
      } else if (action === "interested") {
        await handleInterestedTaskAction(task, user?.id, nextActionValue);
        toast.success("Đã ghi nhận khách hàng quan tâm");
      } else if (action === "call_back_later") {
        if (!dateTimeValue) {
          toast.error("Vui lòng chọn thời gian hẹn gọi lại");
          setLoading(false);
          return;
        }
        await handleRescheduleTaskAction(task, user?.id, dateTimeValue);
        toast.success("Đã hẹn gọi lại thành công");
      } else if (action === "transfer_to_sale") {
        await handleTransferToSaleTaskAction(task, user?.id);
        toast.success("Đã gửi yêu cầu bàn giao Sale");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error("Lỗi xử lý: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHeaderIconAndTitle = () => {
    switch (action) {
      case "start":
        return {
          icon: <Play className="w-5 h-5 text-blue-500" />,
          title: "Bắt đầu xử lý công việc",
        };
      case "completed":
        return {
          icon: <CheckCircle className="w-5 h-5 text-emerald-500" />,
          title: "Xác nhận hoàn thành",
        };
      case "no_answer":
        return {
          icon: <PhoneOff className="w-5 h-5 text-red-500" />,
          title: "Xử lý: Không nghe máy",
        };
      case "wrong_number":
        return {
          icon: <UserX className="w-5 h-5 text-slate-500" />,
          title: "Xử lý: Sai số điện thoại",
        };
      case "interested":
        return {
          icon: <Heart className="w-5 h-5 text-pink-500 fill-pink-50" />,
          title: "Xử lý: Khách hàng quan tâm",
        };
      case "call_back_later":
        return {
          icon: <CalendarClock className="w-5 h-5 text-amber-500" />,
          title: "Hẹn gọi lại sau",
        };
      case "transfer_to_sale":
        return {
          icon: <ArrowRightLeft className="w-5 h-5 text-indigo-500" />,
          title: "Yêu cầu chuyển giao Sale",
        };
      default:
        return {
          icon: <AlertTriangle className="w-5 h-5 text-slate-500" />,
          title: "Xử lý công việc",
        };
    }
  };

  const { icon, title } = getHeaderIconAndTitle();

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="flex flex-row items-center gap-3 space-y-0">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            {icon}
          </div>
          <div>
            <DialogTitle className="text-sm font-black uppercase tracking-wider text-slate-900">
              {title}
            </DialogTitle>
            <p className="text-[10px] text-slate-450 font-bold uppercase truncate max-w-[300px]">
              Công việc: {task.title}
            </p>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* start confirm */}
          {action === "start" && (
            <p className="text-xs text-slate-600 font-medium">
              Bạn có chắc chắn muốn chuyển trạng thái công việc này sang{" "}
              <span className="font-bold text-blue-600">Đang xử lý</span>?
            </p>
          )}

          {/* completed confirm */}
          {action === "completed" && (
            <p className="text-xs text-slate-600 font-medium">
              Bạn xác nhận đã <span className="font-bold text-emerald-600">Hoàn thành</span> công
              việc này? Hệ thống sẽ ghi nhận lịch sử hoạt động tương ứng.
            </p>
          )}

          {/* no_answer form */}
          {action === "no_answer" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Hệ thống sẽ cập nhật trạng thái kết quả thành{" "}
                <span className="font-bold text-red-600">Không nghe máy</span>. Bạn có muốn đặt thêm
                lịch hẹn gọi lại không?
              </p>
              <div className="space-y-1.5 pt-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">
                  Lịch gọi lại (Tùy chọn)
                </Label>
                <Input
                  type="datetime-local"
                  value={dateTimeValue}
                  onChange={(e) => setDateTimeValue(e.target.value)}
                  className="text-xs h-9 bg-white"
                />
              </div>
            </div>
          )}

          {/* wrong_number confirm */}
          {action === "wrong_number" && (
            <div className="space-y-2">
              <p className="text-xs text-slate-600 font-medium">
                Xác nhận số điện thoại của khách hàng bị{" "}
                <span className="font-bold text-red-650">Sai số / Liên lạc lỗi</span>?
              </p>
              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-[10px] text-amber-800 font-bold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  Lưu ý: Hệ thống sẽ tự động chuyển trạng thái của khách hàng liên kết sang Lost.
                </span>
              </div>
            </div>
          )}

          {/* interested form */}
          {action === "interested" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Ghi nhận khách hàng quan tâm. Vui lòng chọn bước xử lý tiếp theo:
              </p>
              <div className="space-y-1.5 pt-2">
                <Label className="text-[10px] font-black uppercase text-slate-500">
                  Bước xử lý tiếp theo
                </Label>
                <Select
                  value={nextActionValue}
                  onValueChange={(val: any) => setNextActionValue(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_up">Đặt lịch tự chăm sóc (Follow-up)</SelectItem>
                    <SelectItem value="transfer_to_sale">
                      Đạt chất lượng - Bàn giao cho Sale chăm sóc
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* call_back_later form */}
          {action === "call_back_later" && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 font-medium">
                Vui lòng chọn ngày giờ hẹn gọi lại để hệ thống tự động dời lịch:
              </p>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-slate-500">
                  Thời gian gọi lại <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="datetime-local"
                  value={dateTimeValue}
                  onChange={(e) => setDateTimeValue(e.target.value)}
                  className="text-xs h-9 bg-white"
                />
              </div>
            </div>
          )}

          {/* transfer_to_sale confirm */}
          {action === "transfer_to_sale" && (
            <p className="text-xs text-slate-600 font-medium">
              Xác nhận gửi yêu cầu bàn giao khách hàng này cho{" "}
              <span className="font-bold text-indigo-600">Sale phụ trách</span>? Hệ thống sẽ cập
              nhật trạng thái khách hàng sang Qualified.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={loading}
            className="text-xs font-bold"
          >
            Hủy
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading}
            className={`text-xs font-bold px-4 ${
              action === "wrong_number" || action === "no_answer"
                ? "bg-red-600 hover:bg-red-500"
                : action === "completed"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-slate-900 hover:bg-primary"
            }`}
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            Xác nhận
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
