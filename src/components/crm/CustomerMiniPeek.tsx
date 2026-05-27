import React from 'react';
import { getCustomerConversationState } from '@/lib/customerConversationState';
import { getStaleSignals } from '@/lib/operationalRules';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar, Phone, Activity, Clock, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CustomerMiniPeekProps {
  customer: any;
}

export function CustomerMiniPeek({ customer }: CustomerMiniPeekProps) {
  if (!customer) return null;

  const state = getCustomerConversationState(customer);
  const signals = getStaleSignals(customer);
  
  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xl shadow-slate-200/50 flex flex-col gap-3 min-w-[280px]">
      <div className="flex justify-between items-start gap-4">
        <div>
          <h4 className="font-bold text-slate-900 text-sm truncate max-w-[200px]">{customer.name}</h4>
          <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" /> {customer.phone || customer.email || 'Không có liên hệ'}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase bg-slate-50 font-bold border-slate-200">
          {customer.lifecycle_stage?.replace(/_/g, ' ') || 'NEW'}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-50 rounded p-1.5 flex flex-col gap-0.5">
          <span className="text-[10px] text-slate-400 font-bold uppercase">Lần cuối</span>
          <span className="text-slate-700 font-medium flex items-center gap-1">
            <Activity className="w-3 h-3 text-slate-400" /> 
            {state.lastInteractionTime ? format(new Date(state.lastInteractionTime), 'dd/MM/yyyy') : 'Chưa có'}
          </span>
        </div>
        <div className={`rounded p-1.5 flex flex-col gap-0.5 ${state.urgency === 'overdue' ? 'bg-rose-50' : 'bg-slate-50'}`}>
          <span className={`text-[10px] font-bold uppercase ${state.urgency === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`}>Hẹn tiếp theo</span>
          <span className={`font-medium flex items-center gap-1 ${state.urgency === 'overdue' ? 'text-rose-700' : 'text-slate-700'}`}>
            <Calendar className={`w-3 h-3 ${state.urgency === 'overdue' ? 'text-rose-500' : 'text-slate-400'}`} /> 
            {state.nextFollowUpTime ? format(new Date(state.nextFollowUpTime), 'dd/MM') : 'Trống'}
          </span>
        </div>
      </div>

      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {signals.slice(0, 2).map((sig: any, idx: number) => (
            <Badge key={idx} variant="outline" className="text-[9px] px-1 py-0 bg-amber-50 text-amber-700 border-amber-200 flex items-center gap-1">
              <ShieldAlert className="w-2.5 h-2.5" />
              {sig.message}
            </Badge>
          ))}
          {signals.length > 2 && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 bg-slate-50 text-slate-500">+{signals.length - 2}</Badge>
          )}
        </div>
      )}
    </div>
  );
}
