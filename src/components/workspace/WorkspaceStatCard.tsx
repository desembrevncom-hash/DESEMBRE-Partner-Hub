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
    <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between group hover:bg-white hover:border-primary/20 transition-all hover:shadow-lg hover:shadow-slate-200/50">
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className={`text-2xl font-black mt-1 ${color}`}>
          {loading ? "..." : value}
        </p>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${color.replace('text-', 'bg-').replace('600', '50').replace('500', '50')}`}>
        {icon}
      </div>
    </div>
  );
};
