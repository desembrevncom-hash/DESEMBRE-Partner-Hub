import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function SimulationBanner() {
  return (
    <div className="sticky top-0 z-50 bg-red-500/10 border-b-2 border-red-500 py-3 px-6 shadow-sm backdrop-blur-md">
      <div className="container mx-auto max-w-5xl flex items-center justify-center gap-3">
        <AlertTriangle className="text-red-600 w-5 h-5 animate-pulse" />
        <span className="font-black text-red-700 tracking-widest text-sm">
          ⚠️ DRY-RUN / SIMULATION MODE. No real messages will be sent.
        </span>
      </div>
    </div>
  );
}
