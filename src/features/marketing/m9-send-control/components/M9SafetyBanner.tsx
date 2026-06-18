import { AlertTriangle } from "lucide-react";
import { M9_SAFETY_COPY } from "../utils/m9SafetyCopy";

export function M9SafetyBanner() {
  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded-r-md flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div>
        <h3 className="text-red-800 font-bold text-sm">CRITICAL SAFETY NOTICE</h3>
        <p className="text-red-700 text-sm mt-1">{M9_SAFETY_COPY.BANNER_TEXT}</p>
      </div>
    </div>
  );
}
