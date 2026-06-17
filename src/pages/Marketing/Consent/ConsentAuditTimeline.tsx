import { ConsentHistoryRecord } from "@/types/marketing_m8";
import { format } from "date-fns";

export function ConsentAuditTimeline({ history }: { history: ConsentHistoryRecord[] }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-slate-900 mb-4">Audit History</h3>
      <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
        {history.map((record) => (
          <div key={record.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-slate-100 group-[.is-active]:bg-indigo-50 text-indigo-500 group-[.is-active]:text-indigo-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2">
              <span className="text-[10px] font-bold uppercase">{record.channel === 'email' ? 'EM' : 'ZN'}</span>
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-slate-900 text-sm">
                  {record.consent_status.toUpperCase()}
                </div>
                <time className="font-mono text-xs text-slate-500">
                  {format(new Date(record.created_at), "MMM d, yyyy HH:mm")}
                </time>
              </div>
              <div className="text-xs text-slate-600 mb-2">
                Source: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded">{record.source}</span>
              </div>
              {(record.proof_type || record.proof_reference || record.proof_note) && (
                <div className="bg-slate-50 p-2 rounded text-xs text-slate-700 space-y-1 border border-slate-100">
                  {record.proof_type && <div><span className="font-semibold">Type:</span> {record.proof_type}</div>}
                  {record.proof_reference && <div><span className="font-semibold">Ref:</span> {record.proof_reference}</div>}
                  {record.proof_note && <div><span className="font-semibold">Note:</span> {record.proof_note}</div>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
