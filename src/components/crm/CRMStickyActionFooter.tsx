import React from "react";
import { cn } from "@/lib/utils";

export interface CRMStickyActionFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CRMStickyActionFooter: React.FC<CRMStickyActionFooterProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-40 bg-white/80 backdrop-blur-md border-t border-slate-200 p-4 pb-safe flex items-center gap-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
