// @ts-nocheck
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getAudienceStats } from "@/lib/marketing/segmentRules";
import { MarketingSegment, AudienceStats } from "@/lib/marketing/types";
import { Loader2, Download, AlertTriangle, Users, Archive, ArrowLeft, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/marketing/audiences/$id")({
  component: AudienceEditPage,
});

function AudienceEditPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const [segment, setSegment] = useState<MarketingSegment | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AudienceStats | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [exporting, setExporting] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    if (segment && customers.length > 0) {
      evaluateRules();
    }
  }, [segment, customers]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: segData, error: segError } = await supabase.from("marketing_segments").select("*").eq("id", id).single();
      if (segError) throw segError;
      setSegment(segData);

      const { data: custData, error: custError } = await supabase.from("customers").select("*");
      if (custError) throw custError;
      setCustomers(custData || []);
    } catch (e: any) {
      toast.error("Failed to load segment: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const evaluateRules = () => {
    setEvaluating(true);
    setTimeout(() => {
      try {
        const newStats = getAudienceStats(customers, segment!.filter_rules_json);
        setStats(newStats);
        
        // Update the last_preview_count silently
        supabase.from("marketing_segments").update({
          last_preview_count: newStats.matched_customers,
          last_previewed_at: new Date().toISOString()
        }).eq("id", id).then();
        
      } catch (e) {
        console.error(e);
      } finally {
        setEvaluating(false);
      }
    }, 100);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // In a real app, we would dynamic import customerExportBuilder here and run the 4-sheet export
      // For this MVP, we simulate the export action matching the architectural plan
      const { generateCustomerExport } = await import("@/lib/customers/customerExportBuilder");
      
      // We need to re-evaluate the full list to get the matching customer records, not just stats
      const { evaluateAudience } = await import("@/lib/marketing/segmentRules");
      const matchedCustomers = evaluateAudience(customers, segment!.filter_rules_json);
      
      if (matchedCustomers.length === 0) {
        toast.error("No customers to export");
        return;
      }
      
      await generateCustomerExport(matchedCustomers, `Segment_${segment!.name.replace(/\\s+/g, '_')}`);
      toast.success("Export completed successfully");
    } catch (e: any) {
      toast.error("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const handleArchive = async () => {
    try {
      const { error } = await supabase.from("marketing_segments").update({
        archived_at: new Date().toISOString(),
        archived_by: user?.id
      }).eq("id", id);
      if (error) throw error;
      toast.success("Segment archived");
      navigate({ to: "/marketing/audiences" });
    } catch (e: any) {
      toast.error("Failed to archive: " + e.message);
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!segment) return <div>Segment not found.</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/marketing/audiences" })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{segment.name}</h1>
            <Badge variant="outline">{segment.visibility}</Badge>
            {segment.archived_at && <Badge variant="destructive">Archived</Badge>}
          </div>
          <p className="text-muted-foreground mt-1">{segment.description || "No description."}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Preview */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Xem trước kết quả ({stats?.sample.length || 0} khách mẫu)</CardTitle>
              <CardDescription>Đây là kết quả mô phỏng khách hàng thỏa mãn các điều kiện đã lưu.</CardDescription>
            </CardHeader>
            <CardContent>
              {evaluating ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : stats?.sample.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-muted text-muted-foreground text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3">Tên khách hàng</th>
                        <th className="px-4 py-3">Số điện thoại</th>
                        <th className="px-4 py-3">Cảnh báo dữ liệu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {stats.sample.map((c: any) => (
                        <tr key={c.id}>
                          <td className="px-4 py-3 font-medium">{c.name || c.contact_name || "Khách chưa có tên"}</td>
                          <td className="px-4 py-3">{c.phone || "-"}</td>
                          <td className="px-4 py-3 flex gap-1 flex-wrap">
                            {(!c.phone) && <Badge variant="destructive" className="text-[10px]">THIẾU SĐT</Badge>}
                            {(c.phone?.length > 12 && c.phone.startsWith("100")) && <Badge variant="destructive" className="text-[10px]">FB UID KHÔNG PHẢI SĐT</Badge>}
                            {(c.phone?.length === 9 && !c.phone.startsWith("0")) && <Badge variant="destructive" className="text-[10px]">CÓ THỂ THIẾU SỐ 0</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted-foreground py-4 text-center">Không có khách hàng nào thỏa mãn điều kiện này.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Actions & Stats */}
        <div className="space-y-6 lg:sticky lg:top-24 h-max">
          <Card className="border-primary/50 bg-primary/5">
            <CardHeader>
              <CardTitle>Thống kê nhóm</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {evaluating ? (
                <div className="flex items-center justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <div className="bg-background rounded-lg p-4 border text-center">
                    <p className="text-sm text-muted-foreground">Khách phù hợp</p>
                    <p className="text-4xl font-bold text-primary">{stats?.matched_customers || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">trong tổng số {stats?.total_customers || 0} khách</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex flex-col bg-background p-2 rounded border">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/> Có thể gọi</span>
                      <span className="font-semibold">{stats?.callable_count || 0}</span>
                    </div>
                    <div className="flex flex-col bg-background p-2 rounded border">
                      <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3"/> Có thể Zalo</span>
                      <span className="font-semibold">{stats?.zalo_count || 0}</span>
                    </div>
                  </div>
                  
                  {stats && stats.data_quality_issue_count > 0 && (
                    <div className="bg-destructive/10 text-destructive p-3 rounded-lg border border-destructive/20 text-sm mt-4">
                      <div className="flex items-center gap-2 font-medium mb-1">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Cảnh báo dữ liệu ({stats.data_quality_issue_count})</span>
                      </div>
                      <ul className="list-disc pl-5 text-xs opacity-90 space-y-1 mt-2">
                        {Object.entries(stats.skipped_reasons).map(([reason, count]) => (
                          <li key={reason}>{reason}: {count}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Thao tác</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-[11px] font-medium text-amber-600 bg-amber-50 p-2 rounded border border-amber-100 mb-2 leading-relaxed">
                <AlertCircle className="w-3 h-3 inline mr-1 mb-[2px]" />
                Module này chỉ tạo nhóm và xuất file, không gửi chiến dịch.
              </div>
              <Button className="w-full" onClick={handleExport} disabled={exporting || evaluating || !stats?.matched_customers}>
                {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Xuất tệp khách hàng
              </Button>
              <Button variant="outline" className="w-full" disabled>
                Chỉnh sửa điều kiện (Sắp ra mắt)
              </Button>
              {!segment.archived_at && (
                <Button variant="destructive" className="w-full" onClick={handleArchive}>
                  <Archive className="mr-2 h-4 w-4" /> Lưu trữ nhóm
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
