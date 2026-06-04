import React from "react";
import { cn } from "@/lib/utils";

export interface CRMSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  gap?: "sm" | "md" | "lg";
  stepNumber?: number;
}

export const CRMSection: React.FC<CRMSectionProps> = ({
  title,
  subtitle,
  action,
  children,
  gap = "md",
  className,
  ...props
}) => {
  const gapClasses = {
    sm: "space-y-4",
    md: "space-y-4 md:space-y-6",
    lg: "space-y-6 md:space-y-8",
  };

  return (
    <section className={cn(gapClasses[gap], "w-full", className)} {...props}>
      {(title || subtitle || action) && (
        <div className="flex items-center justify-between gap-4">
          <div>
            {title && (
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                {title}
              </h2>
            )}
            {subtitle && <p className="text-xs font-medium text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
