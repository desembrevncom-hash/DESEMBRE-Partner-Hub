import React from "react";
import { cn } from "@/lib/utils";

export type CRMStatusBadgeVariant =
  | "success"
  | "warning"
  | "danger"
  | "error"
  | "info"
  | "neutral"
  | "premium";

export interface CRMStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: CRMStatusBadgeVariant;
  status?: string;
  label?: string | React.ReactNode;
  children?: React.ReactNode;
}

export const CRMStatusBadge: React.FC<CRMStatusBadgeProps> = ({
  variant,
  status,
  label,
  children,
  className,
  ...props
}) => {
  const variantClasses = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-blue-50 text-blue-700 border-blue-200",
    neutral: "bg-slate-50 text-slate-600 border-slate-200",
    premium: "bg-indigo-50 text-indigo-700 border-indigo-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
        variantClasses[variant || (status as CRMStatusBadgeVariant) || "neutral"] ||
          variantClasses["neutral"],
        className,
      )}
      {...props}
    >
      {label || children}
    </span>
  );
};
