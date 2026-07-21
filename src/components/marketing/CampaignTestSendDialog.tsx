import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CampaignTestSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string | null;
  channel: string;
}

export function CampaignTestSendDialog({ open, onOpenChange, campaignId, channel }: CampaignTestSendDialogProps) {
  const [loading, setLoading] = useState(false);
  const [testRecipient, setTestRecipient] = useState<string>("");

  const handleSendTest = async () => {
    if (!campaignId) return;
    if (!testRecipient) {
      return toast.error("Vui lòng nhập email/Zalo User ID nhận test");
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Chưa đăng nhập");

      const payload: any = { campaign_id: campaignId };
      if (channel.includes("email")) {
        payload.test_recipient = testRecipient;
      } else {
        payload.test_zalo_user_id = testRecipient;
      }

      const res = await fetch(`${supabase.supabaseUrl}/functions/v1/send-campaign-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Lỗi gửi test");
      }

      toast.success("Gửi test thành công!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-white">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-800">Gửi Test Chiến Dịch</DialogTitle>
              <DialogDescription className="text-xs">
                Sandbox Test sẽ chỉ gửi được đến các {channel.includes("email") ? "Email" : "Zalo User ID"} có trong Whitelist của hệ thống.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-bold text-slate-700">
              {channel.includes("email") ? "Email nhận Test" : "Zalo User ID nhận Test"}
            </Label>
            <Input
              value={testRecipient}
              onChange={(e) => setTestRecipient(e.target.value)}
              placeholder={channel.includes("email") ? "hello@desembre.vn" : "Nhập Zalo User ID..."}
              className="h-10 rounded-xl border-slate-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl h-10 font-bold"
            disabled={loading}
          >
            Hủy
          </Button>

          <Button
            onClick={handleSendTest}
            className="rounded-xl h-10 font-bold bg-blue-600 hover:bg-blue-700 text-white"
            disabled={loading || !testRecipient}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Gửi Test
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
