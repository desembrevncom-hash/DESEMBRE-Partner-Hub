// @ts-nocheck
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Archive, Copy, Download, Search, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MarketingSegment } from "@/lib/marketing/types";

export const Route = createFileRoute("/marketing/audiences/")({
  component: AudiencesListPage,
});

function AudiencesListPage() {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const [segments, setSegments] = useState<MarketingSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const navigate = useNavigate();

  const fetchSegments = async () => {
    setLoading(true);
    try {
      let query = supabase.from("marketing_segments").select("*").order("created_at", { ascending: false });
      
      if (!showArchived) {
        query = query.is("archived_at", null);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      setSegments(data || []);
    } catch (error: any) {
      toast.error("Lỗi tải danh sách: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSegments();
  }, [showArchived]);

  const handleArchive = async (id: string, currentlyArchived: boolean) => {
    try {
      const payload = currentlyArchived 
        ? { archived_at: null, archived_by: null }
        : { archived_at: new Date().toISOString(), archived_by: user?.id };
        
      const { error } = await supabase.from("marketing_segments").update(payload).eq("id", id);
      if (error) throw error;
      
      toast.success(currentlyArchived ? "Đã khôi phục nhóm" : "Đã lưu trữ nhóm");
      fetchSegments();
    } catch (error: any) {
      toast.error("Lỗi cập nhật: " + error.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nhóm khách hàng (Audience)</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý và tạo tệp khách hàng. Hệ thống chưa hỗ trợ gửi tin nhắn tự động.
          </p>
        </div>
        <div className="flex items-center gap-4">
          {(isAdmin || isSubAdmin) && (
            <div className="flex items-center space-x-2 mr-4">
              <Switch id="show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
              <Label htmlFor="show-archived">Hiện nhóm đã lưu trữ</Label>
            </div>
          )}
          <Button onClick={() => navigate({ to: "/marketing/audiences/new" })}>
            <Plus className="mr-2 h-4 w-4" /> Tạo nhóm mới
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p>Đang tải danh sách...</p>
        ) : segments.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            Chưa có nhóm khách hàng nào. Hãy tạo nhóm đầu tiên!
          </div>
        ) : (
          segments.map((seg) => (
            <Card key={seg.id} className={`hover:shadow-md transition-all ${seg.archived_at ? 'opacity-60 grayscale' : ''}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg line-clamp-1" title={seg.name}>{seg.name}</CardTitle>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline">{seg.visibility}</Badge>
                      {seg.archived_at && <Badge variant="destructive">Đã lưu trữ</Badge>}
                    </div>
                  </div>
                  <div className="bg-primary/10 text-primary p-2 rounded-full flex-shrink-0">
                    <Users className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px] mb-4">
                  {seg.description || "Không có mô tả."}
                </p>
                <div className="flex items-center justify-between text-sm mb-4">
                  <span className="text-muted-foreground">Quy mô dự kiến:</span>
                  <span className="font-medium">{seg.last_preview_count || 0} khách</span>
                </div>
                
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="ghost" size="sm" onClick={() => navigate({ to: `/marketing/audiences/${seg.id}` })}>
                    Mở
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleArchive(seg.id, !!seg.archived_at)}>
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
