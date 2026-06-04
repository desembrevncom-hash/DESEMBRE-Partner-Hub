import React from "react";
import { cn } from "@/lib/utils";
import { Inbox } from "lucide-react";

export interface CRMEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const CRMEmptyState: React.FC<CRMEmptyStateProps> = ({
  title,
  message,
  description,
  icon = <Inbox className="w-10 h-10 text-slate-300" />,
  action,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 md:p-12 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200",
        className,
      )}
      {...props}
    >
      <div className="mb-4">{icon}</div>
      <h3 className="text-sm font-bold text-slate-700">{title || message || "Không có dữ liệu"}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
};
