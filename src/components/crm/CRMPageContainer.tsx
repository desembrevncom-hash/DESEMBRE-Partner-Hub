import React from "react";
import { cn } from "@/lib/utils";

export interface CRMPageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CRMPageContainer: React.FC<CRMPageContainerProps> = ({
  children,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "px-4 py-4 md:py-6 lg:px-8 xl:max-w-7xl mx-auto w-full space-y-6 md:space-y-8",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};
