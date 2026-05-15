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
    <div className="bg-white p-4 rounded-2xl border border-slate-200/60 flex items-center justify-between group hover:bg-slate-50 transition-all hover:shadow-md h-full">
      <div className="min-w-0">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</p>
        <p className={`text-xl font-black mt-1 leading-none ${color}`}>
          {loading ? "..." : value}
        </p>
      </div>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0 ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
      </div>
    </div>
  );
};
