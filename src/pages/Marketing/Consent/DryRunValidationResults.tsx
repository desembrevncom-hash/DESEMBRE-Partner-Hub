import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  results: any;
}

export function DryRunValidationResults({ results }: Props) {
  if (!results) return null;

  const validCount = results.valid_rows || 0;
  const invalidCount = results.invalid_rows || 0;
  const errors = results.errors || [];

  return (
    <div className="mt-4 p-4 border rounded-xl bg-slate-50 space-y-4">
      <h4 className="font-bold text-slate-900 text-sm">Dry-Run Validation Results</h4>
      
      <div className="flex gap-6 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span className="font-medium text-slate-700">{validCount} Valid Rows</span>
        </div>
        <div className="flex items-center gap-2">
          {invalidCount > 0 ? (
            <XCircle className="w-4 h-4 text-rose-500" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          <span className="font-medium text-slate-700">{invalidCount} Invalid Rows</span>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="bg-rose-50 border border-rose-100 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3" /> Errors Detected
          </div>
          <ul className="list-disc list-inside text-xs text-rose-700 space-y-1">
            {errors.map((err: any, idx: number) => (
              <li key={idx}>Row {err.row_index + 1}: {err.error}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
