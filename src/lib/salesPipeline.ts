
export type PipelineStage = 
  | "lead_new"
  | "lead_received"
  | "contacting"
  | "consulting"
  | "closing"
  | "purchased"
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
  { value: "lead_new", label: "Lead mới", color: "text-blue-700", bgColor: "bg-blue-50", borderColor: "border-blue-200", order: 1 },
  { value: "lead_received", label: "Đã nhận lead", color: "text-cyan-700", bgColor: "bg-cyan-50", borderColor: "border-cyan-200", order: 2 },
  { value: "contacting", label: "Đang liên hệ", color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", order: 3 },
  { value: "consulting", label: "Đang tư vấn", color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200", order: 4 },
  { value: "closing", label: "Chờ chốt", color: "text-pink-700", bgColor: "bg-pink-50", borderColor: "border-pink-200", order: 5 },
  { value: "purchased", label: "Đã mua", color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", order: 6 },
  { value: "lost", label: "Mất lead", color: "text-red-700", bgColor: "bg-red-50", borderColor: "border-red-200", order: 7 },
];

export const LOST_REASON_OPTIONS = [
  { value: "no_budget", label: "Không có ngân sách" },
  { value: "no_response", label: "Không phản hồi" },
  { value: "competitor", label: "Chọn đối thủ" },
  { value: "wrong_number", label: "Sai số/Không tồn tại" },
  { value: "spam", label: "Spam/Rác" },
  { value: "duplicate", label: "Trùng lặp" },
  { value: "not_interested", label: "Không có nhu cầu" },
];

export const mapLegacyStageToNew = (stage?: string): PipelineStage | string => {
  if (!stage) return "lead_new";
  
  // New stages pass through
  if (SALES_PIPELINE_STAGES.some(s => s.value === stage)) {
    return stage;
  }

  // Legacy mappings
  switch (stage) {
    case "new_lead": return "lead_new";
    case "assigned": return "lead_received";
    case "contacted": return "contacting";
    case "quoted":
    case "quote_follow_up": return "closing";
    case "ordered":
    case "post_purchase_checkin":
    case "active_customer":
    case "loyal_customer": return "purchased";
    case "inactive": return "lost";
    default: return stage;
  }
};

export const getPipelineStageLabel = (stage?: string): string => {
  const mappedStage = mapLegacyStageToNew(stage);
  const found = SALES_PIPELINE_STAGES.find(s => s.value === mappedStage);
  return found?.label || "Không rõ";
};

export const getPipelineStageConfig = (stage?: string): PipelineStageConfig => {
  const mappedStage = mapLegacyStageToNew(stage);
  const found = SALES_PIPELINE_STAGES.find(s => s.value === mappedStage);
  return found || SALES_PIPELINE_STAGES[0];
};

export const getPipelineStageOrder = (stage?: string): number => {
  const mappedStage = mapLegacyStageToNew(stage);
  const found = SALES_PIPELINE_STAGES.find(s => s.value === mappedStage);
  return found?.order || 0;
};

export const getPipelineStageColor = (stage?: string): string => {
  const mappedStage = mapLegacyStageToNew(stage);
  const found = SALES_PIPELINE_STAGES.find(s => s.value === mappedStage);
  return found?.bgColor || "bg-slate-50";
};
