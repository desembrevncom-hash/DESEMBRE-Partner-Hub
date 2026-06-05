import React from "react";
import { cn } from "@/lib/utils";

export interface CRMTableWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CRMTableWrapper: React.FC<CRMTableWrapperProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div className={cn("w-full max-w-full overflow-x-auto", className)} {...props}>
      <div className="min-w-max">{children}</div>
    </div>
  );
};
