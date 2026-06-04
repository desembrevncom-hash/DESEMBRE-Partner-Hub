import React from "react";
import { cn } from "@/lib/utils";

export interface CRMPageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode | React.ElementType | any;
  breadcrumbs?: any;
  actions?: React.ReactNode;
  actionButtons?: React.ReactNode;
  badgeText?: string;
  description?: string;
  backTo?: string;
}

export const CRMPageHeader: React.FC<CRMPageHeaderProps> = ({
  title,
  subtitle,
  action,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2 md:mb-4",
        className,
      )}
      {...props}
    >
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-950">{title}</h1>
        {subtitle && (
          <p className="text-xs md:text-sm font-bold uppercase tracking-[0.18em] text-slate-400">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
};
