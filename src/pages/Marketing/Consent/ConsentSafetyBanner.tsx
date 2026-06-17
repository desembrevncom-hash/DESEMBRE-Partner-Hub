import { AlertTriangle, Lock } from "lucide-react";

export function ConsentSafetyBanner() {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl shadow-sm">
      <div className="flex items-start">
        <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
        <div className="ml-3">
          <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4" /> ⚠️ Consent Registry Admin Only
          </h3>
          <div className="mt-2 text-sm text-amber-700 space-y-1">
            <p>This screen records consent metadata only. It does not send messages.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
