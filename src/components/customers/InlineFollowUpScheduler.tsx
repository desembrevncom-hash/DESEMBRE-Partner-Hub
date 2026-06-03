import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { addHours, addDays, nextMonday, startOfDay, setHours } from "date-fns";

interface InlineFollowUpSchedulerProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

const presets = [
  { label: "Chiều nay (14:00)", getValue: () => setHours(new Date(), 14) },
  { label: "Sáng mai (09:00)", getValue: () => setHours(addDays(new Date(), 1), 9) },
  { label: "Chiều mai (14:00)", getValue: () => setHours(addDays(new Date(), 1), 14) },
  { label: "2 ngày nữa (09:00)", getValue: () => setHours(addDays(new Date(), 2), 9) },
  { label: "Thứ 2 tuần sau (09:00)", getValue: () => setHours(nextMonday(new Date()), 9) },
];

export function InlineFollowUpScheduler({
  customer,
  open,
  onOpenChange,
  onSaved,
}: InlineFollowUpSchedulerProps) {
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleSave = async () => {
    if (!selectedDate) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("customer_tasks").insert({
        customer_id: customer.id,
        title: "Follow-up / Chăm sóc",
        due_date: selectedDate.toISOString(),
        assigned_to: (await supabase.auth.getUser()).data.user?.id,
      });
      if (error) throw error;
      toast.success("Đã đặt lịch hẹn");
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Không thể đặt lịch", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Hẹn gọi lại: {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4 grid grid-cols-2 gap-2">
          {presets.map((p, idx) => (
            <Button
              key={idx}
              variant={selectedDate?.getTime() === p.getValue().getTime() ? "default" : "outline"}
              className="w-full text-xs"
              onClick={() => setSelectedDate(p.getValue())}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={loading || !selectedDate}>
            {loading ? "Đang lưu..." : "Lưu lại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
