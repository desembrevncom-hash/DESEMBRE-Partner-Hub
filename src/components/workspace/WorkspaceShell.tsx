import React from "react";
import { Loader2 } from "lucide-react";
import { CRMPageContainer } from "@/components/crm/CRMPageContainer";
import { CRMPageHeader } from "@/components/crm/CRMPageHeader";

interface WorkspaceShellProps {
  title: string;
  icon: React.ReactNode;
  loading?: boolean;
  children: React.ReactNode;
}

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  title,
  icon,
  loading,
  children,
}) => {
  return (
    <CRMPageContainer>
      <CRMPageHeader
        title={title}
        subtitle="Màn hình làm việc hằng ngày"
        action={loading && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
      />
      {children}
    </CRMPageContainer>
  );
};
