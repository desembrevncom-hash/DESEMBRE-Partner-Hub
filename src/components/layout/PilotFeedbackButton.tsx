import React, { useState } from "react";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLocation } from "@tanstack/react-router";

export function PilotFeedbackButton() {
  const { isAdmin, isSubAdmin } = useAuth();
  const { pilotModeEnabled } = useSystemSettings();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState('bug');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  // Show only if Pilot Mode is enabled OR user is Admin
  if (!isAdmin && !isSubAdmin && !pilotModeEnabled) return null;

  const handleSubmit = async () => {
    if (!note.trim()) {
      toast.error("Vui lòng nhập nội dung góp ý!");
      return;
    }
    setLoading(true);
    try {
      await supabase.rpc('log_pilot_feedback', {
        p_page_key: location.pathname,
        p_feedback_type: feedbackType,
        p_feedback_note: note
      });
      toast.success("Cảm ơn bạn đã gửi góp ý!");
      setIsOpen(false);
      setNote('');
      setFeedbackType('bug');
    } catch (e: any) {
      toast.error("Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-24 rounded-full h-12 px-5 shadow-xl shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700 text-white z-50 transition-all hover:scale-105 flex items-center gap-2"
      >
        <MessageSquarePlus className="w-5 h-5" />
        <span className="font-bold text-sm">Báo lỗi / Góp ý</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[24px]">
          <DialogHeader>
            <DialogTitle>Góp ý & Báo lỗi (Pilot)</DialogTitle>
            <DialogDescription>
              Góp ý của bạn giúp đội ngũ cải thiện phần mềm tốt hơn.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'bug', label: 'Lỗi hệ thống' },
                { id: 'slow', label: 'Thao tác chậm' },
                { id: 'confusing', label: 'Giao diện rối' },
                { id: 'missing_feature', label: 'Thiếu tính năng' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setFeedbackType(f.id)}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-colors text-center ${feedbackType === f.id ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="space-y-2 mt-2">
              <Textarea 
                placeholder="Mô tả chi tiết vấn đề bạn gặp phải..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="h-24 resize-none rounded-xl text-sm p-3"
              />
              <p className="text-[10px] text-rose-500 font-bold uppercase tracking-wider mt-2 bg-rose-50 p-2 rounded-lg text-center">
                ⚠️ Không nhập mật khẩu / API key / thông tin nhạy cảm
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl">Hủy</Button>
            <Button onClick={handleSubmit} disabled={loading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Gửi góp ý
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
