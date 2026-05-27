import React from 'react';
            <Button variant="ghost" onClick={() => setIsDispatchDialogOpen(false)}>Hủy</Button>
            <Button 
               disabled={isDispatching || !dispatchReason.trim() || (dispatchAction !== 'revoke' && dispatchStaffId === 'none')} 
               onClick={handleBulkDispatch}
               className={dispatchAction === 'revoke' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}
            >
               {isDispatching ? 'Đang xử lý...' : 'Xác nhận'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomerCard({ customer, stage, isAdmin, isManager, onQuickLog, draggable, onDragStart, onPreview, staffMap, isSelected, onToggleSelect, onQuickDispatch }: any) {
  // Logic hành động nhanh tùy theo giai đoạn và vai trò người dùng
  const getAction = () => {
    // Nếu là Admin hoặc Phó Admin (Manager), họ không gọi điện/nhắc chốt/log ship, mà chỉ có 2 tác vụ: "CHIA LEAD" ở cột new_lead và "CHI TIẾT" ở các cột còn lại
    if (isManager) {
      if (stage === 'new_lead') {
        return { label: 'CHIA LEAD', icon: UserPlus, color: 'bg-indigo-600' };
      }
      return { label: 'CHI TIẾT', icon: ArrowRight, color: 'bg-slate-900' };
    }

    switch (stage) {
      case 'new_lead': return { label: 'CHIA LEAD', icon: UserPlus, color: 'bg-indigo-600' };
      case 'assigned': return { label: 'GỌI ĐIỆN', icon: Phone, color: 'bg-amber-500' };
      case 'quoted': return { label: 'NHẮC CHỐT', icon: BadgeCheck, color: 'bg-emerald-600' };
      case 'ordered': return { label: 'LOG SHIP', icon: Package, color: 'bg-indigo-600' };
      default: return { label: 'CHI TIẾT', icon: ArrowRight, color: 'bg-slate-900' };
    }
  };

  const { leadOverdueDays } = useSystemSettings();
  const action = getAction();
  const totalValue = customer.orders?.reduce((sum: number, o: any) => sum + (o.total || 0), 0) || 0;
  
  const getTierBadge = () => {
    if (totalValue >= 100000000) {
      return <Badge className="bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">💎 DIAMOND</Badge>;
    }
    if (totalValue >= 50000000) {
      return <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">🥇 GOLD</Badge>;
    }
    if (totalValue > 0) {
      return <Badge className="bg-gradient-to-r from-slate-400 to-slate-600 text-white shadow-sm border-none text-[8px] px-1.5 py-0 h-4 font-black">🥈 SILVER</Badge>;
    }
    return null;
  };

  const { getRiskFlags, getCustomerHealth } = require('@/lib/customerHealth');
  const riskFlags = getRiskFlags(customer);
  
  // Cảnh báo khách hàng báo giá quá X ngày (Đỏ) - thay bằng cờ Overdue Follow-up chung
  const isQuotedOverdue = riskFlags.includes('Overdue Follow-up');

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);
  const saleInitials = getStaffInitials(customer.owner_sale_id, staffMap);
  const teleInitials = getStaffInitials(customer.owner_tele_id, staffMap);
  
  const channelIntel = customer.channel_summary || {};
  const getChannelIcons = () => {
     const icons = [];
     if (channelIntel.has_facebook) icons.push(<Facebook key="fb" className="w-3 h-3 text-blue-600" />);
     if (channelIntel.has_zalo) icons.push(<MessageSquare key="zl" className="w-3 h-3 text-blue-500" />);
     if (channelIntel.has_email) icons.push(<Mail key="em" className="w-3 h-3 text-slate-500" />);
     if (channelIntel.has_tiktok) icons.push(<Video key="tt" className="w-3 h-3 text-slate-900" />);
     if (channelIntel.has_website) icons.push(<Globe key="wb" className="w-3 h-3 text-emerald-500" />);
     return icons;
  };

  return (
    <div className="relative group/card">
       {isManager && (
         <div className={`absolute -top-2 -left-2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover/card:opacity-100'}`}>
           <Checkbox 
             checked={isSelected} 
             onCheckedChange={onToggleSelect} 
             onClick={(e) => e.stopPropagation()}
             className="w-5 h-5 bg-white border-2 border-indigo-500 data-[state=checked]:bg-indigo-600 data-[state=checked]:text-white shadow-md rounded-md"
           />
         </div>
       )}
    <Card 
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => onPreview && onPreview(customer)}
      className={`rounded-[24px] shadow-sm hover:shadow-xl transition-all duration-300 bg-white overflow-hidden group border cursor-grab active:cursor-grabbing relative ${isQuotedOverdue ? 'border-red-400 shadow-red-100 ring-1 ring-red-400/50' : 'border-transparent hover:border-slate-200'}`}
    >
       <CardContent className="p-5 space-y-4">
          <div className="flex justify-between items-start">
             <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                   <h4 className="text-sm font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">{customer.business_name || customer.facility_name || customer.contact_name || customer.name}</h4>
                   {getTierBadge()}
                   {stage === 'new_lead' && <Badge className="bg-red-100 text-red-700 hover:bg-red-200 text-[8px] px-1.5 py-0 border-none h-4">HOT</Badge>}
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                   {riskFlags.filter((f: string) => f !== 'VIP').map((flag: string) => (
                      <Badge key={flag} className={`text-[8px] px-1.5 py-0 border-none h-4 uppercase font-black ${
                         flag === 'At Risk' || flag === 'No Follow-up' || flag === 'Overdue Follow-up' ? 'bg-rose-100 text-rose-700' :
                         flag === 'Unassigned' || flag === 'Inactive 7d' || flag === 'Missing Phone' || flag === 'Missing Social' ? 'bg-amber-100 text-amber-700' :
                         'bg-slate-100 text-slate-600'
                      }`}>{flag}</Badge>
                   ))}
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{customer.city || "Toàn quốc"}</p>
             </div>
             {isQuotedOverdue ? (
                <div title={`Overdue Follow-up!`}>
                   <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse shrink-0" />
                </div>
             ) : (
                <DropdownMenu>
                   <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-200 group-hover:text-slate-400 shrink-0" onClick={e => e.stopPropagation()}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                   </DropdownMenuTrigger>
                   <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onQuickDispatch('assign_sale'); }}>
                         <UserPlus className="w-4 h-4 mr-2 text-indigo-500" />
                         Chia lead / Đổi Sale
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onQuickDispatch('assign_tele'); }}>
                         <PhoneCall className="w-4 h-4 mr-2 text-teal-500" />
                         Gán Tele hỗ trợ
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onQuickDispatch('revoke'); }}>
                         <XCircle className="w-4 h-4 mr-2 text-red-500" />
                         Thu hồi khách hàng
                      </DropdownMenuItem>
                   </DropdownMenuContent>
                </DropdownMenu>
             )}
          </div>

          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                <div className="flex -space-x-2">
                   {customer.owner_sale_id && <div className="w-5 h-5 rounded-full bg-indigo-100 border border-white flex items-center justify-center text-[8px] text-indigo-600 font-bold" title={`Sale: ${saleName}`}>{saleInitials}</div>}
                   {customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-teal-100 border border-white flex items-center justify-center text-[8px] text-teal-600 font-bold" title={`Tele: ${teleName}`}>{teleInitials}</div>}
                   {!customer.owner_sale_id && !customer.owner_tele_id && <div className="w-5 h-5 rounded-full bg-slate-100 border border-white" />}
                </div>
                <span>• {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}</span>
                <div className="flex items-center gap-1 ml-auto">
                    {getChannelIcons()}
                 </div>
             </div>
             
             <div className="flex justify-between items-center text-[9px] font-bold bg-slate-50 p-2 rounded-xl">