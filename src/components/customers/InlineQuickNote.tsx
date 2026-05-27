import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface InlineQuickNoteProps {
  customer: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function InlineQuickNote({ customer, open, onOpenChange, onSaved }: InlineQuickNoteProps) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('customer_activities').insert({
        customer_id: customer.id,
        activity_type: 'note',
        content: note,
        created_by: (await supabase.auth.getUser()).data.user?.id
      });
      if (error) throw error;
      toast.success('Đã lưu ghi chú');
      setNote('');
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Lỗi khi lưu ghi chú', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ghi chú nhanh: {customer?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="Nhập nội dung ghi chú..." 
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-[100px]"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button onClick={handleSave} disabled={loading || !note.trim()}>
            {loading ? 'Đang lưu...' : 'Lưu lại'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
