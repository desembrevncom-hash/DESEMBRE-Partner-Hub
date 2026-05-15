import React from "react";

interface WorkspaceStatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

export const WorkspaceStatCard: React.FC<WorkspaceStatCardProps> = ({ label, value, icon, color, loading }) => {
  return (
    <div className="bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-primary/20 transition-all hover:shadow-md h-full min-w-[120px]">
      <div>
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{label}</p>
        <p className={`text-lg font-black leading-tight ${color}`}>
          {loading ? "..." : value}
        </p>
      </div>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
      </div>
    </div>
  );
};
