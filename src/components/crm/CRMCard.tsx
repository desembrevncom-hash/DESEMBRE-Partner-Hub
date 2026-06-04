import React from "react";
import { cn } from "@/lib/utils";

export interface CRMCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "main" | "inner" | "compact";
  children: React.ReactNode;
}

export const CRMCard: React.FC<CRMCardProps> = ({
  variant = "main",
  children,
  className,
  ...props
}) => {
  const variantClasses = {
    main: "bg-white rounded-3xl border border-slate-200/70 shadow-sm p-4 md:p-6",
    inner: "bg-slate-50/70 rounded-2xl border border-slate-100 p-4 md:p-6",
    compact: "bg-white rounded-xl border border-slate-100 p-3 md:p-4",
  };

  return (
    <div className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </div>
  );
};
