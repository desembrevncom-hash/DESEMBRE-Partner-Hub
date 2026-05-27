import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InlineOwnerControlProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function InlineOwnerControl({ customer, open, onOpenChange, onSaved }: InlineOwnerControlProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRevoke = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc('revoke_lead', {
        p_customer_id: customer.id,
        p_reason: reason
      });
      if (error) throw error;
      toast.success('Đã thu hồi khách hàng');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Lỗi khi thu hồi', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Thu hồi Lead: {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="Nhập lý do thu hồi (bắt buộc)..." 
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button variant="destructive" onClick={handleRevoke} disabled={loading || !reason.trim()}>
            {loading ? 'Đang xử lý...' : 'Thu hồi ngay'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
