import React from "react";
import { cn } from "@/lib/utils";

export interface CRMLoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  rows?: number;
  type?: "card" | "list" | "table";
  message?: string;
}

export const CRMLoadingState: React.FC<CRMLoadingStateProps> = ({
  rows = 3,
  type = "list",
  message,
  className,
  ...props
}) => {
  if (type === "card") {
    return (
      <div
        className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4", className)}
        {...props}
      >
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm animate-pulse h-40 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="h-4 bg-slate-200 rounded w-1/3"></div>
              <div className="h-6 bg-slate-100 rounded w-2/3"></div>
            </div>
            <div className="h-10 bg-slate-50 rounded-xl w-full mt-4"></div>
          </div>
        ))}
      </div>
    );
  }

  if (type === "table") {
    return (
      <div
        className={cn("w-full border border-slate-100 rounded-2xl overflow-hidden", className)}
        {...props}
      >
        <div className="bg-slate-50 h-12 w-full border-b border-slate-100"></div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="bg-white h-16 w-full border-b border-slate-50 animate-pulse flex items-center px-4 gap-4"
          >
            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
            <div className="h-4 bg-slate-100 rounded w-1/4"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} {...props}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm animate-pulse flex items-center gap-4"
        >
          <div className="w-10 h-10 bg-slate-100 rounded-full shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-1/3"></div>
            <div className="h-3 bg-slate-100 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </div>
  );
};
