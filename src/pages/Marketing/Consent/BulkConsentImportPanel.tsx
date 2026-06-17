import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useM8ConsentRegistry } from "@/hooks/marketing/useM8ConsentRegistry";
import { DryRunValidationResults } from "./DryRunValidationResults";
import { UploadCloud, Loader2, Play, Check } from "lucide-react";
import Papa from "papaparse";
import { BulkImportRow, ConsentChannel, ConsentStatus } from "@/types/marketing_m8";
import { toast } from "sonner";

export function BulkConsentImportPanel() {
  const { bulkImportConsent, loading } = useM8ConsentRegistry();
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<BulkImportRow[]>([]);
  const [dryRunResults, setDryRunResults] = useState<any>(null);
  const [isCommitted, setIsCommitted] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setDryRunResults(null);
    setIsCommitted(false);

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows: BulkImportRow[] = results.data.map((row: any) => ({
          customer_id: row.customer_id,
          channel: row.channel as ConsentChannel,
          consent_status: row.consent_status as ConsentStatus,
          proof_type: row.proof_type || null,
          proof_reference: row.proof_reference || null,
          proof_note: row.proof_note || null,
          effective_at: row.effective_at || new Date().toISOString(),
          idempotency_key: row.idempotency_key || crypto.randomUUID(),
        }));
        setParsedRows(rows);
      },
      error: (error) => {
        toast.error("Failed to parse CSV file: " + error.message);
      }
    });
  };

  const handleDryRun = async () => {
    if (parsedRows.length === 0) return;
    try {
      const results = await bulkImportConsent({
        p_rows: parsedRows,
        p_source: "csv_import",
        p_dry_run: true,
        p_import_batch_id: null,
        p_idempotency_key: crypto.randomUUID(),
      });
      setDryRunResults(results);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCommit = async () => {
    if (!dryRunResults || dryRunResults.invalid_rows > 0) return;
    try {
      await bulkImportConsent({
        p_rows: parsedRows,
        p_source: "csv_import",
        p_dry_run: false,
        p_import_batch_id: null,
        p_idempotency_key: crypto.randomUUID(),
      });
      setIsCommitted(true);
      setFile(null);
      setParsedRows([]);
      setDryRunResults(null);
    } catch (err) {
      console.error(err);
    }
  };

  const hasBlockingErrors = dryRunResults && dryRunResults.invalid_rows > 0;
  const canCommit = dryRunResults && !hasBlockingErrors && !isCommitted;

  return (
    <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50">
        <h3 className="font-bold text-slate-900">Bulk Consent Import</h3>
        <p className="text-xs text-slate-500 mt-1">Upload a CSV to process multiple consent updates. A dry-run is required before committing.</p>
      </div>
      
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <label className="relative flex-1 cursor-pointer">
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
              <UploadCloud className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="text-sm font-medium text-slate-700">
                {file ? file.name : "Click to upload CSV"}
              </span>
            </div>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          </label>
        </div>

        {parsedRows.length > 0 && !isCommitted && (
          <div className="flex justify-end gap-3">
            <Button 
              onClick={handleDryRun} 
              disabled={loading} 
              variant="outline"
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              Dry-Run Import
            </Button>
            
            <Button 
              onClick={handleCommit} 
              disabled={!canCommit || loading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
              Commit Import
            </Button>
          </div>
        )}

        {dryRunResults && <DryRunValidationResults results={dryRunResults} />}
        
        {isCommitted && (
          <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-center text-sm font-medium border border-emerald-100">
            ? Import committed successfully!
          </div>
        )}
      </div>
    </div>
  );
}
