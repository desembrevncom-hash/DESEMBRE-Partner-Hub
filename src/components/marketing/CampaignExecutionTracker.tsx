import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  PhoneMissed, 
  PhoneOff, 
  UserPlus, 
  CheckSquare, 
  LayoutGrid,
  Filter
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export function CampaignExecutionTracker({ campaign }: { campaign: any }) {
  const { user, isAdmin, isSubAdmin } = useAuth();
  const queryClient = useQueryClient();
  const isManager = isAdmin || isSubAdmin;
  
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: staffList } = useQuery({
    queryKey: ["staff-list-m5"],
    queryFn: async () => {
      const [resRoles, resProfiles] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("role", ["sale", "tele_lead", "telesale", "admin", "sub_admin"]),
        supabase.from("profiles").select("id, email, display_name")
      ]);
      if (resRoles.error) throw resRoles.error;
      const roles = resRoles.data || [];
      const profiles = resProfiles.data || [];
      return roles.map(r => {
        const p = profiles.find((prof: any) => prof.id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          email: p?.email || p?.display_name || r.user_id
        };
      });
    },
    enabled: isManager
  });

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["manual-execution-rows", campaign.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_manual_execution_rows", {
        p_campaign_id: campaign.id
      });
      if (error) throw error;
      return data;
    },
    enabled: campaign.manual_execution_status !== "not_started"
  });

  const initializeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("initialize_manual_campaign_execution", {
        p_campaign_id: campaign.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã khởi tạo dữ liệu thực thi chiến dịch!");
      queryClient.invalidateQueries({ queryKey: ["marketing-campaign", campaign.id] });
      refetch();
    },
    onError: (err: any) => toast.error(`Lỗi: ${err.message}`)
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assigneeId) throw new Error("Vui lòng chọn nhân viên");
      if (selectedIds.length === 0) throw new Error("Vui lòng chọn ít nhất 1 dòng");
      const { error } = await supabase.rpc("assign_manual_execution_rows", {
        p_execution_ids: selectedIds,
        p_assigned_to: assigneeId
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã phân công thành công");
      setSelectedIds([]);
      setAssigneeId("");
      refetch();
    },
    onError: (err: any) => toast.error(`Lỗi phân công: ${err.message}`)
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      if (!bulkStatus) throw new Error("Vui lòng chọn trạng thái");
      if (selectedIds.length === 0) throw new Error("Vui lòng chọn ít nhất 1 dòng");
      const { error } = await supabase.rpc("bulk_update_manual_execution_status", {
        p_execution_ids: selectedIds,
        p_status: bulkStatus,
        p_note: ""
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      setSelectedIds([]);
      setBulkStatus("");
      refetch();
    },
    onError: (err: any) => toast.error(`Lỗi cập nhật: ${err.message}`)
  });

  const updateSingleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string, status: string }) => {
      const { error } = await supabase.rpc("update_manual_execution_status", {
        p_execution_id: id,
        p_status: status,
        p_note: ""
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cập nhật trạng thái thành công");
      refetch();
    },
    onError: (err: any) => toast.error(`Lỗi cập nhật: ${err.message}`)
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_manual_campaign_execution", {
        p_campaign_id: campaign.id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Đã hoàn tất chiến dịch!");
      queryClient.invalidateQueries({ queryKey: ["marketing-campaign", campaign.id] });
    },
    onError: (err: any) => toast.error(`Lỗi: ${err.message}`)
  });

  const filteredRows = useMemo(() => {
    if (!rows) return [];
    if (statusFilter === "all") return rows;
    return rows.filter((r: any) => r.execution_status === statusFilter);
  }, [rows, statusFilter]);

  const stats = useMemo(() => {
    if (!rows) return null;
    const s = {
      total: rows.length,
      pending: 0,
      in_progress: 0,
      contacted: 0,
      no_answer: 0,
      unreachable: 0,
      success: 0,
      failed: 0
    };
    rows.forEach((r: any) => {
      if (s[r.execution_status as keyof typeof s] !== undefined) {
        s[r.execution_status as keyof typeof s]++;
      }
    });
    return s;
  }, [rows]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredRows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredRows.map((r: any) => r.execution_id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { label: string, color: string }> = {
      pending: { label: "Chờ xử lý", color: "bg-slate-100 text-slate-700" },
      in_progress: { label: "Đang xử lý", color: "bg-blue-100 text-blue-700" },
      contacted: { label: "Đã liên hệ", color: "bg-indigo-100 text-indigo-700" },
      no_answer: { label: "Không nghe máy", color: "bg-amber-100 text-amber-700" },
      unreachable: { label: "Không liên lạc được", color: "bg-orange-100 text-orange-700" },
      success: { label: "Thành công", color: "bg-emerald-100 text-emerald-700" },
      failed: { label: "Thất bại", color: "bg-rose-100 text-rose-700" }
    };
    const mapped = map[status] || { label: status, color: "bg-slate-100" };
    return <Badge className={`whitespace-nowrap ${mapped.color}`}>{mapped.label}</Badge>;
  };

  if (campaign.manual_execution_status === "not_started") {
    return (
      <Card className="rounded-[24px] border-none shadow-sm mt-6">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <LayoutGrid className="w-16 h-16 text-indigo-200 mb-4" />
          <h3 className="text-xl font-black text-slate-900 mb-2">Sẵn sàng thực thi chiến dịch</h3>
          <p className="text-slate-500 mb-6 max-w-md text-sm">
            Chiến dịch đã được duyệt. Hãy bắt đầu để hệ thống tạo danh sách tương tác thủ công dựa trên tệp khách hàng đã lưu.
          </p>
          {isManager ? (
            <Button 
              size="lg" 
              onClick={() => initializeMutation.mutate()}
              disabled={initializeMutation.isPending}
              className="rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700"
            >
              {initializeMutation.isPending ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Play className="w-5 h-5 mr-2 fill-current" />}
              Bắt đầu chiến dịch
            </Button>
          ) : (
            <p className="text-sm font-bold text-amber-600">Vui lòng chờ Admin khởi tạo chiến dịch.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  const isCompleted = campaign.manual_execution_status === "completed";

  return (
    <div className="space-y-6 mt-6">
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-none shadow-sm bg-slate-50">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-slate-500 uppercase">Tổng cộng</span>
              <span className="text-2xl font-black text-slate-900">{stats.total}</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-blue-50">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-blue-600 uppercase">Đang / Chờ xử lý</span>
              <span className="text-2xl font-black text-blue-900">{stats.pending + stats.in_progress}</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-amber-50">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-amber-600 uppercase">Chưa kết nối được</span>
              <span className="text-2xl font-black text-amber-900">{stats.no_answer + stats.unreachable}</span>
            </CardContent>
          </Card>
          <Card className="rounded-2xl border-none shadow-sm bg-emerald-50">
            <CardContent className="p-4 flex flex-col justify-center">
              <span className="text-xs font-bold text-emerald-600 uppercase">Thành công</span>
              <span className="text-2xl font-black text-emerald-900">{stats.success}</span>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="rounded-[24px] border-none shadow-sm">
        <CardHeader className="p-6 pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            Danh sách tương tác
            {isCompleted && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 ml-2">Đã hoàn tất chiến dịch</Badge>}
          </CardTitle>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
              <Filter className="w-4 h-4 text-slate-400 ml-2" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs border-none bg-transparent shadow-none focus:ring-0 font-bold">
                  <SelectValue placeholder="Lọc trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả</SelectItem>
                  <SelectItem value="pending">Chờ xử lý</SelectItem>
                  <SelectItem value="in_progress">Đang xử lý</SelectItem>
                  <SelectItem value="contacted">Đã liên hệ</SelectItem>
                  <SelectItem value="no_answer">Không nghe máy</SelectItem>
                  <SelectItem value="unreachable">Không liên lạc được</SelectItem>
                  <SelectItem value="success">Thành công</SelectItem>
                  <SelectItem value="failed">Thất bại</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isManager && !isCompleted && (
              <Button 
                variant="outline" 
                className="rounded-xl border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 font-bold"
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
              >
                {completeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                Hoàn tất chiến dịch
              </Button>
            )}
          </div>
        </CardHeader>
        
        {!isCompleted && selectedIds.length > 0 && (
          <div className="bg-indigo-50 px-6 py-3 flex items-center justify-between border-b border-indigo-100">
            <span className="text-sm font-bold text-indigo-900">
              Đã chọn {selectedIds.length} khách hàng
            </span>
            <div className="flex items-center gap-2">
              {isManager && (
                <div className="flex items-center gap-2 mr-4 pr-4 border-r border-indigo-200">
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger className="w-[180px] h-9 bg-white border-indigo-200 rounded-xl">
                      <SelectValue placeholder="Chọn nhân viên" />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList?.map((staff: any) => (
                        <SelectItem key={staff.user_id} value={staff.user_id}>
                          {staff.email} ({staff.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    size="sm" 
                    className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold"
                    onClick={() => assignMutation.mutate()}
                    disabled={assignMutation.isPending || !assigneeId}
                  >
                    <UserPlus className="w-4 h-4 mr-2" /> Phân công
                  </Button>
                </div>
              )}
              
              <Select value={bulkStatus} onValueChange={setBulkStatus}>
                <SelectTrigger className="w-[160px] h-9 bg-white border-indigo-200 rounded-xl">
                  <SelectValue placeholder="Cập nhật trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Chờ xử lý</SelectItem>
                  <SelectItem value="in_progress">Đang xử lý</SelectItem>
                  <SelectItem value="contacted">Đã liên hệ</SelectItem>
                  <SelectItem value="no_answer">Không nghe máy</SelectItem>
                  <SelectItem value="unreachable">Không liên lạc được</SelectItem>
                  <SelectItem value="success">Thành công</SelectItem>
                  <SelectItem value="failed">Thất bại</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                size="sm" 
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-bold"
                onClick={() => bulkUpdateMutation.mutate()}
                disabled={bulkUpdateMutation.isPending || !bulkStatus}
              >
                Áp dụng
              </Button>
            </div>
          </div>
        )}

        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-slate-300" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-slate-50 border-b-slate-100">
                  <TableHead className="w-12 text-center py-4">
                    <Checkbox 
                      checked={selectedIds.length > 0 && selectedIds.length === filteredRows?.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="font-black text-slate-500 uppercase text-[11px] tracking-widest py-4">Khách hàng</TableHead>
                  <TableHead className="font-black text-slate-500 uppercase text-[11px] tracking-widest py-4">Liên hệ</TableHead>
                  {isManager && <TableHead className="font-black text-slate-500 uppercase text-[11px] tracking-widest py-4">Phân công</TableHead>}
                  <TableHead className="font-black text-slate-500 uppercase text-[11px] tracking-widest py-4">Trạng thái</TableHead>
                  <TableHead className="font-black text-slate-500 uppercase text-[11px] tracking-widest py-4 whitespace-nowrap text-right pr-6">Cập nhật</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-500 font-medium">
                      Không có dữ liệu
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRows?.map((row: any) => (
                    <TableRow key={row.execution_id} className="group hover:bg-slate-50/50">
                      <TableCell className="text-center py-3">
                        <Checkbox 
                          checked={selectedIds.includes(row.execution_id)}
                          onCheckedChange={() => toggleSelect(row.execution_id)}
                        />
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="font-bold text-slate-900 text-sm">{row.customer_name_snapshot || "Không tên"}</p>
                      </TableCell>
                      <TableCell className="py-3">
                        <p className="text-sm font-medium text-slate-600">{row.phone_snapshot}</p>
                        {row.email_snapshot && <p className="text-xs text-slate-400">{row.email_snapshot}</p>}
                      </TableCell>
                      {isManager && (
                        <TableCell className="py-3">
                          <p className="text-sm font-medium text-slate-600 truncate max-w-[150px]" title={row.assigned_to}>
                            {row.assigned_to ? (
                              staffList?.find((s: any) => s.user_id === row.assigned_to)?.email || row.assigned_to.substring(0,8)
                            ) : (
                              <span className="text-slate-400 italic">Chưa phân công</span>
                            )}
                          </p>
                        </TableCell>
                      )}
                      <TableCell className="py-3">
                        {isCompleted ? (
                          getStatusBadge(row.execution_status)
                        ) : (
                          <Select 
                            value={row.execution_status} 
                            onValueChange={(val) => updateSingleMutation.mutate({ id: row.execution_id, status: val })}
                          >
                            <SelectTrigger className="w-[130px] h-8 text-xs font-bold border-slate-200">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Chờ xử lý</SelectItem>
                              <SelectItem value="in_progress">Đang xử lý</SelectItem>
                              <SelectItem value="contacted">Đã liên hệ</SelectItem>
                              <SelectItem value="no_answer">Không nghe máy</SelectItem>
                              <SelectItem value="unreachable">Không liên lạc được</SelectItem>
                              <SelectItem value="success">Thành công</SelectItem>
                              <SelectItem value="failed">Thất bại</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-slate-500 font-medium whitespace-nowrap text-right pr-6">
                        {new Date(row.updated_at).toLocaleString("vi-VN", { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
