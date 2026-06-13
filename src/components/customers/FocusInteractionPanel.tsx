import React from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Phone, Calendar, CheckCircle2 } from "lucide-react";
import { getCustomerConversationState } from "@/lib/customerConversationState";
import { getCustomerCardTitle } from "@/lib/customers/customerDisplayName";

interface FocusInteractionPanelProps {
  customer: any;
  onNextCustomer?: () => void;
  onQuickLog?: () => void;
  onFollowUp?: () => void;
}

export function FocusInteractionPanel({
  customer,
  onNextCustomer,
  onQuickLog,
  onFollowUp,
}: FocusInteractionPanelProps) {
  if (!customer) return null;
  const state = getCustomerConversationState(customer);

  return (
    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-500/20 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0 shadow-inner">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-indigo-100 opacity-80">
            Focus Action
          </p>
          <p className="text-sm font-black truncate max-w-[200px] leading-tight mt-0.5">
            {getCustomerCardTitle(customer || {})}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 w-full sm:w-auto">
        {onNextCustomer && (
          <Button
            onClick={onNextCustomer}
            size="sm"
            className="bg-white text-indigo-600 hover:bg-slate-50 font-black ml-auto shrink-0 shadow-sm rounded-xl px-6 py-4"
          >
            Next Khách <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
