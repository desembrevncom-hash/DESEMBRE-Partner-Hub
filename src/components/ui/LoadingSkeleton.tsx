import React from "react";

export default function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="h-6 bg-slate-200 rounded w-3/4" />
      <div className="h-4 bg-slate-200 rounded w-1/2" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-24 bg-slate-200 rounded" />
        <div className="h-24 bg-slate-200 rounded" />
      </div>
    </div>
  );
}
