import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, FileSpreadsheet, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface ExportGoogleSheetButtonProps {
  saleId: string;
  reportType: "weekly" | "monthly" | string;
  periodStart: string;
  periodEnd: string;
}

export function ExportGoogleSheetButton({ saleId, reportType, periodStart, periodEnd }: ExportGoogleSheetButtonProps) {
  const { user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [latestUrl, setLatestUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (saleId && reportType && periodStart && periodEnd) {
      checkLatestExport();
    }
  }, [saleId, reportType, periodStart, periodEnd]);

  const checkLatestExport = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase
        .from("sales_report_exports")
        .select("google_sheet_url, export_status")
        .eq("sale_user_id", saleId)
        .eq("report_type", reportType)
        .eq("period_start", periodStart)
        .eq("period_end", periodEnd)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data && data.export_status === "success") {
        setLatestUrl(data.google_sheet_url);
      } else {
        setLatestUrl(null);
      }
    } catch (error) {
      console.error("Error checking export", error);
      setLatestUrl(null);
    } finally {
      setChecking(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setLatestUrl(null); // hide during export
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Chưa đăng nhập");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-sales-report-to-google-sheet`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            saleId,
            reportType,
            periodStart,
            periodEnd
          }),
        }
      );

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || result.details || "Xuất thất bại");
      }

      toast.success("Xuất Google Sheet thành công!");
      setLatestUrl(result.url);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Đã xảy ra lỗi khi xuất báo cáo");
      checkLatestExport(); // refresh to see if there's an older successful one
    } finally {
      setExporting(false);
    }
  };

  if (checking) return <div className="w-8" />; // placeholder

  return (
    <div className="flex items-center gap-2">
      {latestUrl && (
        <Button variant="outline" size="sm" className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" asChild>
          <a href={latestUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="w-4 h-4 mr-2" />
            Mở Google Sheet
          </a>
        </Button>
      )}
      <Button 
        variant="default" 
        size="sm" 
        onClick={handleExport} 
        disabled={exporting || !saleId || !periodStart || !periodEnd}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {exporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
        {exporting ? "Đang xuất..." : "Xuất Google Sheet"}
      </Button>
    </div>
  );
}
