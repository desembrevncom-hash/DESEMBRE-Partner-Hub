
export type PipelineStage = 
  | "new_lead"
  | "assigned"
  | "contacted"
  | "consulting"
  | "quoted"
  | "quote_follow_up"
  | "ordered"
  | "post_purchase_checkin"
  | "active_customer"
  | "loyal_customer"
  | "inactive"
  | "lost";

export interface PipelineStageConfig {
  value: PipelineStage;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  order: number;
}

export const SALES_PIPELINE_STAGES: PipelineStageConfig[] = [
  { value: "new_lead", label: "Lead mới", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200", order: 1 },
  { value: "assigned", label: "Đã nhận lead", color: "text-cyan-700", bgColor: "bg-cyan-50", borderColor: "border-cyan-200", order: 2 },
  { value: "contacted", label: "Đã liên hệ", color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", order: 3 },
  { value: "consulting", label: "Đang tư vấn", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200", order: 4 },
  { value: "quoted", label: "Đã báo giá", color: "text-pink-700", bgColor: "bg-pink-50", borderColor: "border-pink-200", order: 5 },
  { value: "quote_follow_up", label: "Follow-up báo giá", color: "text-orange-700", bgColor: "bg-orange-50", borderColor: "border-orange-200", order: 6 },
  { value: "ordered", label: "Đã chốt đơn", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", order: 7 },
  { value: "post_purchase_checkin", label: "Check-in sau mua", color: "text-teal-700", bgColor: "bg-teal-50", borderColor: "border-teal-200", order: 8 },
  { value: "active_customer", label: "Khách hoạt động", color: "text-green-700", bgColor: "bg-green-50", borderColor: "border-green-200", order: 9 },
  { value: "loyal_customer", label: "Khách thân thiết", color: "text-amber-700", bgColor: "bg-amber-50", borderColor: "border-amber-200", order: 10 },
  { value: "inactive", label: "Ngưng hoạt động", color: "text-slate-500", bgColor: "bg-slate-50", borderColor: "border-slate-200", order: 11 },
  { value: "lost", label: "Mất khách", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200", order: 12 },
];

export const getPipelineStageLabel = (stage?: string): string => {
  const found = SALES_PIPELINE_STAGES.find(s => s.value === stage);
  return found?.label || "Không rõ";
};

export const getPipelineStageConfig = (stage?: string): PipelineStageConfig => {
  const found = SALES_PIPELINE_STAGES.find(s => s.value === stage);
  return found || SALES_PIPELINE_STAGES[0];
};

export const getPipelineStageOrder = (stage?: string): number => {
  const found = SALES_PIPELINE_STAGES.find(s => s.value === stage);
  return found?.order || 0;
};

export const getPipelineStageColor = (stage?: string): string => {
  const found = SALES_PIPELINE_STAGES.find(s => s.value === stage);
  return found?.bgColor || "bg-slate-50";
};
