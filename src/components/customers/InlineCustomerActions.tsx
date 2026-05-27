import React, { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, StickyNote, Clock, ArrowRightLeft, UserMinus, Eye, History, Users, PhoneCall } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import { InlineQuickNote } from './InlineQuickNote';
import { InlineFollowUpScheduler } from './InlineFollowUpScheduler';
import { InlineStageMove } from './InlineStageMove';
import { MiniTimelinePeek } from './MiniTimelinePeek';
import { InlineOwnerControl } from '../admin/InlineOwnerControl';

interface InlineCustomerActionsProps {
  customer: any;
  onOpenDrawer?: (id: string) => void;
  onRefresh?: () => void;
  onAssignSale?: () => void;
  onAssignTele?: () => void;
}

export function InlineCustomerActions({ customer, onOpenDrawer, onRefresh, onAssignSale, onAssignTele }: InlineCustomerActionsProps) {
  const { isManager } = useAuth();
  
  const [noteOpen, setNoteOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  const handleRefresh = () => {
    onRefresh?.();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          
          <DropdownMenuItem onClick={() => setNoteOpen(true)}>
            <StickyNote className="mr-2 h-4 w-4 text-amber-500" /> Ghi chú nhanh
          </DropdownMenuItem>
          
          <DropdownMenuItem onClick={() => setFollowUpOpen(true)}>
            <Clock className="mr-2 h-4 w-4 text-indigo-500" /> Hẹn gọi lại
          </DropdownMenuItem>
          
          <InlineStageMove customer={customer} onSaved={handleRefresh}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <ArrowRightLeft className="mr-2 h-4 w-4 text-blue-500" /> Đổi trạng thái (Stage)
            </DropdownMenuItem>
          </InlineStageMove>

          <MiniTimelinePeek customer={customer}>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <History className="mr-2 h-4 w-4 text-slate-500" /> Xem nhanh lịch sử
            </DropdownMenuItem>
          </MiniTimelinePeek>

          {isManager && (
            <>
              <DropdownMenuSeparator />
              {onAssignSale && (
                <DropdownMenuItem onClick={() => onAssignSale()}>
                  <Users className="mr-2 h-4 w-4" /> Gán cho Sale
                </DropdownMenuItem>
              )}
              {onAssignTele && (
                <DropdownMenuItem onClick={() => onAssignTele()}>
                  <PhoneCall className="mr-2 h-4 w-4" /> Gán cho Tele
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setRevokeOpen(true)} className="text-rose-600 focus:text-rose-600 focus:bg-rose-50">
                <UserMinus className="mr-2 h-4 w-4" /> Thu hồi Lead
              </DropdownMenuItem>
            </>
          )}

          {onOpenDrawer && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onOpenDrawer(customer.id)}>
                <Eye className="mr-2 h-4 w-4 text-slate-500" /> Mở hồ sơ nhanh
              </DropdownMenuItem>
            </>
          )}
          
        </DropdownMenuContent>
      </DropdownMenu>

      <InlineQuickNote customer={customer} open={noteOpen} onOpenChange={setNoteOpen} onSaved={handleRefresh} />
      <InlineFollowUpScheduler customer={customer} open={followUpOpen} onOpenChange={setFollowUpOpen} onSaved={handleRefresh} />
      {isManager && <InlineOwnerControl customer={customer} open={revokeOpen} onOpenChange={setRevokeOpen} onSaved={handleRefresh} />}
    </>
  );
}
