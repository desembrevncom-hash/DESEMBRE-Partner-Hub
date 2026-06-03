import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { getPipelineStageLabel } from "@/lib/salesPipeline";

interface InlineStageMoveProps {
  customer: any;
  onSaved: () => void;
  children: React.ReactNode;
}

const STAGES = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won", "lost"];

export function InlineStageMove({ customer, onSaved, children }: InlineStageMoveProps) {
  const [loading, setLoading] = useState(false);

  const handleMove = async (newStage: string) => {
    if (newStage === customer.lifecycle_stage) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ lifecycle_stage: newStage })
        .eq("id", customer.id);
      if (error) throw error;

      await supabase.from("customer_activities").insert({
        customer_id: customer.id,
        activity_type: "stage_changed",
        metadata: { from: customer.lifecycle_stage, to: newStage },
      });

      toast.success("Đã đổi trạng thái");
      onSaved();
    } catch (err: any) {
      toast.error("Không thể đổi trạng thái", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={loading}>
        {children}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STAGES.map((stage) => (
          <DropdownMenuItem
            key={stage}
            onClick={() => handleMove(stage)}
            className={stage === customer.lifecycle_stage ? "font-bold bg-slate-50" : ""}
          >
            {getPipelineStageLabel(stage)}
            {stage === customer.lifecycle_stage && <ChevronRight className="w-4 h-4 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
