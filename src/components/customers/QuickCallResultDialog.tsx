import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  PhoneOff,
  Heart,
  Clock,
  FileText,
  AlertCircle,
  PhoneMissed,
  Loader2,
  Calendar,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { trackQuickLog } from "@/lib/uxTracking";

export interface QuickCallResultDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string | null;
  onSuccess?: () => void;
  onOptimisticUpdate?: (updates: any) => void;
  onOptimisticRevert?: () => void;
}

type ResultType =
  | "no_answer"
  | "interested"
  | "call_back"
  | "sent_quote"
  | "wrong_number"
  | "unreachable";

export const QuickCallResultDialog: React.FC<QuickCallResultDialogProps> = ({
  isOpen,
  onOpenChange,
  customerId,
  onSuccess,
  onOptimisticUpdate,
  onOptimisticRevert,
}) => {
  const [loading, setLoading] = useState(false);
  const [resultType, setResultType] = useState<ResultType>("no_answer");
  const [note, setNote] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [nextFollowUpTime, setNextFollowUpTime] = useState("09:00");

  const [selectedPreset, setSelectedPreset] = useState<string>("sang_mai");

  const datePresets = [
    { id: "chieu_nay", label: "Chiều nay" },
    { id: "sang_mai", label: "Sáng mai" },
    { id: "chieu_mai", label: "Chiều mai" },
    { id: "sau_2_ngay", label: "Sau 2 ngày" },
    { id: "thu_2", label: "Thứ 2 tuần sau" },
    { id: "tu_chon", label: "Tự chọn" },
  ];

  const results = [
    { id: "no_answer", label: "Không nghe máy", icon: <PhoneOff className="w-4 h-4" /> },
    { id: "interested", label: "Quan tâm", icon: <Heart className="w-4 h-4" /> },
    { id: "call_back", label: "Hẹn gọi lại", icon: <Clock className="w-4 h-4" /> },
    { id: "sent_quote", label: "Gửi báo giá", icon: <FileText className="w-4 h-4" /> },
    { id: "wrong_number", label: "Sai số", icon: <AlertCircle className="w-4 h-4" /> },
    { id: "unreachable", label: "Không liên lạc được", icon: <PhoneMissed className="w-4 h-4" /> },
  ];

  const handleSave = async () => {
    if (!customerId) return;

    setLoading(true);
    try {
      let nextFollowUpAt = null;
      let labelText = "";

      if (resultType === "call_back" || resultType === "no_answer" || resultType === "interested") {
        const now = new Date();
        let targetDate = new Date(now);

        if (selectedPreset === "tu_chon") {
          if (nextFollowUpDate && nextFollowUpTime) {
            targetDate = new Date(`${nextFollowUpDate}T${nextFollowUpTime}:00`);
            labelText = `vào lúc ${nextFollowUpTime} ${format(targetDate, "dd/MM")}`;
          } else if (resultType === "call_back") {
            toast.error("Vui lòng chọn ngày và giờ hẹn lại!");
            setLoading(false);
            return;
          } else {
            // Default if custom is incomplete but it's no_answer
            targetDate.setDate(now.getDate() + 1);
            targetDate.setHours(9, 0, 0, 0);
            labelText = "sáng mai";
          }
        } else {
          if (selectedPreset === "chieu_nay") {
            targetDate.setHours(15, 0, 0, 0); // 3 PM
            labelText = "chiều nay";
          } else if (selectedPreset === "sang_mai") {
            targetDate.setDate(now.getDate() + 1);
            targetDate.setHours(9, 0, 0, 0);
            labelText = "sáng mai";
          } else if (selectedPreset === "chieu_mai") {
            targetDate.setDate(now.getDate() + 1);
            targetDate.setHours(15, 0, 0, 0);
            labelText = "chiều mai";
          } else if (selectedPreset === "sau_2_ngay") {
            targetDate.setDate(now.getDate() + 2);
            targetDate.setHours(9, 0, 0, 0);
            labelText = "sau 2 ngày";
          } else if (selectedPreset === "thu_2") {
            const daysUntilMonday = (1 + 7 - now.getDay()) % 7 || 7;
            targetDate.setDate(now.getDate() + daysUntilMonday);
            targetDate.setHours(9, 0, 0, 0);
            labelText = "thứ 2 tuần sau";
          }
        }
        nextFollowUpAt = targetDate.toISOString();
      }

      if (onOptimisticUpdate) {
        onOptimisticUpdate({
          last_contacted_at: new Date().toISOString(),
          next_follow_up_at: nextFollowUpAt,
          status: resultType === "wrong_number" ? "trash" : undefined,
        });
      }

      const { data, error } = await supabase.rpc("log_quick_call_result", {
        p_customer_id: customerId,
        p_result_type: resultType,
        p_note: note,
        p_next_follow_up_at: nextFollowUpAt,
      });

      if (error) {
        if (onOptimisticRevert) onOptimisticRevert();
        throw error;
      }

      if (resultType === "interested") {
        toast.success(`Đã lưu tương tác với khách. Đã hẹn lại ${labelText}.`);
      } else if (resultType === "call_back") {
        toast.success(`Đã ghi nhận cuộc gọi. Đã hẹn lại ${labelText}.`);
      } else if (resultType === "no_answer") {
        toast.success(`Khách không nghe máy. Hệ thống tự động hẹn gọi lại ${labelText}.`);
      } else if (resultType === "wrong_number") {
        toast.success("Đã đánh dấu khách hàng sai số.");
      } else {
        toast.success("Đã ghi nhận kết quả cuộc gọi.");
      }

      trackQuickLog(resultType);

      onOpenChange(false);

      // Reset form
      setResultType("no_answer");
      setNote("");
      setNextFollowUpDate("");

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error("Error logging call:", error);
      toast.error(error.message || "Có lỗi xảy ra khi lưu!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ghi nhận nhanh cuộc gọi</DialogTitle>
          <DialogDescription>Lưu nhanh kết quả vừa gọi điện cho khách hàng.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-3">
            <Label>Kết quả cuộc gọi</Label>
            <div className="grid grid-cols-2 gap-2">
              {results.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setResultType(r.id as ResultType)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm font-medium cursor-pointer transition-colors ${
                    resultType === r.id
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 hover:border-slate-300 text-slate-600"
                  }`}
                >
                  {r.icon}
                  <span>{r.label}</span>
                </div>
              ))}
            </div>
          </div>

          {(resultType === "call_back" ||
            resultType === "no_answer" ||
            resultType === "interested") && (
            <div className="space-y-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
              <Label className="flex items-center gap-1.5 text-xs text-indigo-600">
                <Calendar className="w-3.5 h-3.5" /> Hẹn gọi lại vào lúc nào?
              </Label>
              <div className="flex flex-wrap gap-2">
                {datePresets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant={selectedPreset === preset.id ? "default" : "outline"}
                    size="sm"
                    className={`h-7 px-3 text-[10px] rounded-full font-bold shadow-none ${selectedPreset === preset.id ? "bg-indigo-600 text-white" : "bg-white text-slate-500 border-slate-200"}`}
                    onClick={() => setSelectedPreset(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              {selectedPreset === "tu_chon" && (
                <div className="grid grid-cols-2 gap-4 mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Ngày hẹn
                    </Label>
                    <Input
                      type="date"
                      value={nextFollowUpDate}
                      onChange={(e) => setNextFollowUpDate(e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Giờ hẹn
                    </Label>
                    <Input
                      type="time"
                      value={nextFollowUpTime}
                      onChange={(e) => setNextFollowUpTime(e.target.value)}
                      className="h-8 text-xs font-medium"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Ghi chú thêm (Tùy chọn)</Label>
            <Textarea
              placeholder="Ghi chú chi tiết trao đổi..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="resize-none h-20 rounded-xl"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={loading} className="rounded-xl">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Lưu kết quả
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
