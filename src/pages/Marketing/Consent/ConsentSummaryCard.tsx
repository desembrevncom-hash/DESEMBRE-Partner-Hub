import { ConsentSummary } from "@/types/marketing_m8";
import { format } from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

export function ConsentSummaryCard({ summary }: { summary: ConsentSummary[] }) {
  if (!summary || summary.length === 0) {
    return (
      <div className="p-6 border rounded-xl bg-white text-center text-slate-500">
        No consent records found for this customer.
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "opt_in":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "opt_out":
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case "pending":
      default:
        return <Clock className="w-5 h-5 text-amber-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "opt_in":
        return "Opt In";
      case "opt_out":
        return "Opt Out";
      case "pending":
      default:
        return "Pending";
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {summary.map((s, idx) => (
        <div key={idx} className="p-4 border rounded-xl bg-white flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            {getStatusIcon(s.consent_status)}
            <div>
              <p className="font-bold text-slate-900 uppercase tracking-wider text-xs">
                {s.channel === "email" ? "Email" : "Zalo ZNS"}
              </p>
              <p className="text-sm font-medium text-slate-700">{getStatusText(s.consent_status)}</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <p>Effective At:</p>
            <p className="font-medium">{format(new Date(s.effective_at), "PP p")}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
