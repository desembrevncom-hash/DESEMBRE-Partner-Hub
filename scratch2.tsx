import React from 'react';
                <span className="text-slate-400 flex items-center gap-1">
                   <Clock className="w-3 h-3" /> 
                   {customer.updated_at || customer.created_at ? formatDistanceToNow(new Date(customer.updated_at || customer.created_at), { addSuffix: true, locale: vi }) : 'Mới đây'}
                </span>
                {totalValue > 0 && <span className="text-emerald-600 font-black tracking-widest">{new Intl.NumberFormat('vi-VN').format(totalValue)}đ</span>}
             </div>
          </div>

          <div className="pt-1 flex gap-2">
             <Button 
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview && onPreview(customer);
                }}
                className={`flex-1 rounded-xl h-8 text-[9px] font-black tracking-widest text-white shadow-sm transition-all hover:scale-105 ${action.color}`}
             >
                <action.icon className="w-3 h-3 mr-1.5" /> {action.label}
             </Button>
             <Button 
                variant="outline" 
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickLog();
                }}
                className="w-8 h-8 rounded-xl border-slate-100 p-0 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-100 transition-all"
             >
                <MessageSquare className="w-3.5 h-3.5" />
             </Button>
           </div>
       </CardContent>
    </Card>
    </div>
  );
}

function CustomerIntelligenceRow({ customer, staffMap, onPreview, onQuickLog, isManager, isSelected, onToggleSelect, onQuickDispatch }: any) {
  const salesIntel = customer.sales_intelligence || {};
  const channelIntel = customer.channel_summary || {};
  
  const { getRiskFlags, getCustomerHealth } = require('@/lib/customerHealth');
  const riskFlags = getRiskFlags(customer);
  const healthStatus = getCustomerHealth(customer);
  
  const dupRisk = channelIntel.duplicate_risk;
  const hasRisk = dupRisk && (dupRisk.has_value_duplicates || dupRisk.has_external_id_duplicates || dupRisk.has_primary_duplicates);

  const getHealthColor = () => {
    if (healthStatus === 'good') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (healthStatus === 'warning') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (healthStatus === 'critical') return 'bg-rose-100 text-rose-700 border-rose-200';
    return 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const getChannelIcon = (type: string) => {
    switch (type) {
       case 'facebook': return <Facebook className="w-3.5 h-3.5" />;
       case 'zalo': return <MessageSquare className="w-3.5 h-3.5" />;
       case 'email': return <Mail className="w-3.5 h-3.5" />;
       case 'tiktok': return <Video className="w-3.5 h-3.5" />;
       case 'website': return <Globe className="w-3.5 h-3.5" />;
       default: return <Globe className="w-3.5 h-3.5" />;
    }
  };

  const renderChannelAction = (ch: any) => {
     let href = "#";
     if (ch.type === 'facebook') href = ch.value.includes('http') ? ch.value : `https://facebook.com/${ch.value}`;
     else if (ch.type === 'zalo') href = `https://zalo.me/${ch.value}`;
     else if (ch.type === 'website') href = ch.value.includes('http') ? ch.value : `https://${ch.value}`;
     else if (ch.type === 'email') href = `mailto:${ch.value}`;
     
     return (
        <a 
           key={`${ch.type}-${ch.value}`} 
           href={href} 
           target="_blank" 
           rel="noreferrer"
           className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
           title={ch.value}
           onClick={(e) => e.stopPropagation()}
        >
           {getChannelIcon(ch.type)}
           {ch.is_primary && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 border-2 border-white rounded-full flex items-center justify-center text-white"><Star className="w-2 h-2 fill-white" /></div>}
           {ch.is_verified && <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-full flex items-center justify-center text-white"><CheckCircle2 className="w-2 h-2" /></div>}
        </a>
     );
  };

  const saleName = getStaffDisplayName(customer.owner_sale_id, staffMap);
  const teleName = getStaffDisplayName(customer.owner_tele_id, staffMap);

  return (
    <div className="relative group bg-white border border-slate-100 rounded-[24px] p-4 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm hover:shadow-md transition-all cursor-pointer" onClick={onPreview}>
       {isManager && (
         <div className={`absolute -left-3 top-1/2 -translate-y-1/2 z-10 transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
           <Checkbox 
             checked={isSelected} 
             onCheckedChange={onToggleSelect} 
             onClick={(e) => e.stopPropagation()}
             className="w-5 h-5 bg-white border-2 border-indigo-500 data-[state=checked]:bg-indigo-600 data-[state=checked]:text-white shadow-md rounded-md"
           />
         </div>
       )}
       {/* Col 1: Info & Health */}
       <div className="w-full md:w-3/12 flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-slate-400 uppercase shrink-0">
             {(customer.contact_name || customer.name || customer.business_name || customer.facility_name || "C").slice(0, 1)}
          </div>
          <div>
             <h4 className="text-sm font-black text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">{customer.business_name || customer.facility_name || "Khách lẻ"}</h4>
             <p className="text-xs font-bold text-slate-500 mt-0.5 flex items-center gap-1">
                {customer.contact_name || customer.name} • {customer.phone ? customer.phone.slice(-4).padStart(customer.phone.length, '*') : 'Chưa có SĐT'}
             </p>
             <div className="flex flex-col mt-2 gap-1.5">
                <div className="flex items-center">
                   <Badge className={`text-[8px] px-1.5 py-0 h-4 uppercase font-black border ${getHealthColor()}`}>
                      {healthStatus}
                   </Badge>
                   {hasRisk && (
                      <TooltipProvider>
                         <Tooltip>
                            <TooltipTrigger asChild>
                               <AlertCircle className="w-4 h-4 text-rose-500 animate-pulse ml-2" />
                            </TooltipTrigger>
                            <TooltipContent>
                               Phát hiện trùng lặp kênh liên hệ. Cần kiểm tra!
                            </TooltipContent>
                         </Tooltip>
                      </TooltipProvider>
                   )}
                </div>
                <div className="flex flex-wrap gap-1">
                   {riskFlags.filter((f: string) => f !== 'VIP').map((flag: string) => (
                      <Badge key={flag} className={`text-[8px] px-1.5 py-0 border-none h-4 uppercase font-black ${
                         flag === 'At Risk' || flag === 'No Follow-up' || flag === 'Overdue Follow-up' ? 'bg-rose-100 text-rose-700' :
                         flag === 'Unassigned' || flag === 'Inactive 7d' || flag === 'Missing Phone' || flag === 'Missing Social' ? 'bg-amber-100 text-amber-700' :
                         'bg-slate-100 text-slate-600'
                      }`}>{flag}</Badge>
                   ))}
                </div>
              </div>
           </div>
       </div>

       {/* Col 2: Omnichannel */}
       <div className="w-full md:w-2/12 flex flex-wrap gap-2">
          {channelIntel.channels_summary?.length > 0 ? (
             channelIntel.channels_summary.map((ch: any) => renderChannelAction(ch))
          ) : (
             <span className="text-xs text-slate-400 italic">Chưa có kênh liên hệ</span>
          )}
       </div>

       {/* Col 3: Priority & Stage */}
       <div className="w-full md:w-2/12 flex flex-col gap-2">
          <div className="flex items-center gap-2 mb-1">
             <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                   className={`h-full rounded-full ${salesIntel.priority_score >= 80 ? 'bg-rose-500' : salesIntel.priority_score >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                   style={{ width: `${Math.min(salesIntel.priority_score || 0, 100)}%` }}
                />
             </div>
             <span className="text-[10px] font-black text-slate-600" title="Priority Score">{salesIntel.priority_score || 0}</span>
          </div>
          <Badge variant="outline" className={`rounded-lg font-black text-[9px] uppercase border-none ${getPipelineStageColor(customer.lifecycle_stage)} bg-opacity-10 text-opacity-100 w-fit`}>
             {getPipelineStageLabel(customer.lifecycle_stage)}
          </Badge>
          {customer.task_summary?.open_tasks > 0 && (
             <span className="text-[10px] font-black text-rose-500 uppercase">
                {customer.task_summary.open_tasks} Open Tasks
             </span>
          )}
       </div>

       {/* Col 4: Last Activity */}
       <div className="w-full md:w-3/12">
          {salesIntel.latest_activity ? (
             <>
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{salesIntel.latest_activity}</p>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase flex items-center gap-1">
                   <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(salesIntel.activity_at), { addSuffix: true, locale: vi })}
                </p>
             </>
          ) : (
             <span className="text-xs text-slate-400 italic">Chưa có tương tác</span>
          )}
       </div>

       {/* Col 5: Quick Actions */}
       <div className="w-full md:w-2/12 flex items-center justify-end gap-2">
          {customer.phone && (
             <a href={`tel:${customer.phone}`} onClick={e => e.stopPropagation()} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
                <PhoneCall className="w-4 h-4" />
             </a>
          )}
          <button onClick={(e) => { e.stopPropagation(); onQuickLog(); }} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
             <FileText className="w-4 h-4" />
          </button>
          
          <DropdownMenu>
             <DropdownMenuTrigger asChild>
               <button onClick={(e) => e.stopPropagation()} className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                  <MoreVertical className="w-4 h-4" />
               </button>
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
       </div>
    </div>
  );
}