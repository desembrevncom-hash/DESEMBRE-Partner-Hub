import React from "react";
import { Loader2 } from "lucide-react";

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
    <div className="bg-white rounded-[32px] border border-slate-200/60 shadow-xl shadow-slate-200/40 p-6 mb-8 relative">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            {icon}
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">{title}</h2>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Màn hình làm việc hằng ngày
            </p>
          </div>
        </div>
        {loading && <Loader2 className="w-5 h-5 text-primary animate-spin" />}
      </div>

      {children}
    </div>
  );
};
