import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

export interface BatchReviewDialogProps {
  batchId: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirmSuccess: () => void;
}

export function BatchReviewDialog({
  batchId,
  onOpenChange,
  onConfirmSuccess,
}: BatchReviewDialogProps) {
  const { isAdminOrSubAdmin } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [batch, setBatch] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<
    "all" | "valid" | "invalid" | "duplicate" | "skip" | "imported"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 50;

  useEffect(() => {
    if (!batchId) {
      setBatch(null);
      setRows([]);
      setFilter("all");
      setSearchQuery("");
      setCurrentPage(1);
      return;
    }

    const fetchBatchData = async () => {
      setLoading(true);
      try {
        const [{ data: batchData, error: batchError }, { data: rowsData, error: rowsError }] =
          await Promise.all([
            supabase.from("customer_import_batches").select("*").eq("id", batchId).single(),
            supabase
              .from("customer_import_rows")
              .select("*")
              .eq("batch_id", batchId)
              .order("row_number", { ascending: true }),
          ]);

        if (batchError) throw batchError;
        if (rowsError) throw rowsError;

        setBatch(batchData);
        setRows(rowsData || []);
      } catch (e: any) {
        console.error("Fetch batch error:", e);
        toast.error("Không thể tải thông tin lô import: " + e.message);
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    };

    fetchBatchData();
  }, [batchId, onOpenChange]);

  const handleConfirm = async () => {
    if (!batchId) return;

    setConfirming(true);
    try {
      const { data, error } = await supabase.rpc("confirm_customer_import_batch", {
        p_batch_id: batchId,
      });

      if (error) {
        throw error;
      }

      toast.success("Xác nhận import thành công!");
      onConfirmSuccess();
      onOpenChange(false);
    } catch (e: any) {
      console.error("Confirm batch error:", e);
      toast.error("Lỗi khi xác nhận import: " + e.message);
    } finally {
      setConfirming(false);
    }
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    setCurrentPage(1);
  };

  const filteredRows = rows.filter((row) => {
    if (filter !== "all") {
      if (filter === "skip" && row.import_action !== "skip") return false;
      if (filter === "imported" && row.import_action !== "imported") return false;
      if (
        filter === "valid" &&
        row.validation_status !== "valid" &&
        row.validation_status !== "warning"
      )
        return false;
      if (
        filter === "invalid" &&
        row.validation_status !== "error" &&
        row.validation_status !== "invalid"
      )
        return false;
      if (filter === "duplicate" && row.validation_status !== "duplicate") return false;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const rawData = row.raw_data || {};
      return Object.values(rawData).some((val) => String(val).toLowerCase().includes(q));
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  const eligibleRows = rows.filter(
    (r) =>
      (r.validation_status === "valid" || r.validation_status === "warning") &&
      r.import_action === "create_new" &&
      !r.imported_customer_id,
  );

  return (
    <Dialog open={!!batchId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Import Batch</DialogTitle>
          <DialogDescription>
            Kiểm tra dữ liệu trước khi xác nhận import vào hệ thống.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          </div>
        ) : batch ? (
          <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-hidden">
            {/* Summary Panel */}
            <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col">
                <span className="text-sm text-slate-500 font-medium">Tổng số dòng</span>
                <span className="text-2xl font-bold text-slate-900">{batch.total_rows}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Hợp lệ
                </span>
                <span className="text-2xl font-bold text-emerald-600">{batch.valid_rows}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Trùng lặp
                </span>
                <span className="text-2xl font-bold text-amber-600">{batch.duplicate_rows}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-slate-500 font-medium flex items-center gap-1">
                  <XCircle className="w-4 h-4 text-rose-500" /> Lỗi
                </span>
                <span className="text-2xl font-bold text-rose-600">{batch.invalid_rows}</span>
              </div>
            </div>

            {batch.status === "completed" && (
              <div className="p-3 bg-indigo-50 text-indigo-700 rounded-lg flex items-center gap-2 border border-indigo-200">
                <Info className="w-5 h-5" />
                <span className="font-medium text-sm">
                  Lô dữ liệu này đã được import thành công.
                </span>
              </div>
            )}

            {/* Filter and Search */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex bg-slate-100 p-1 rounded-lg flex-wrap gap-1">
                <button
                  onClick={() => handleFilterChange("all")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${filter === "all" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Tất cả ({rows.length})
                </button>
                <button
                  onClick={() => handleFilterChange("valid")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${filter === "valid" ? "bg-emerald-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Hợp lệ ({batch.valid_rows})
                </button>
                <button
                  onClick={() => handleFilterChange("duplicate")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${filter === "duplicate" ? "bg-amber-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <AlertCircle className="w-3.5 h-3.5" /> Trùng lặp ({batch.duplicate_rows})
                </button>
                <button
                  onClick={() => handleFilterChange("invalid")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${filter === "invalid" ? "bg-rose-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <XCircle className="w-3.5 h-3.5" /> Lỗi ({batch.invalid_rows})
                </button>
                <button
                  onClick={() => handleFilterChange("skip")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${filter === "skip" ? "bg-slate-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <Info className="w-3.5 h-3.5" /> Bỏ qua
                </button>
                <button
                  onClick={() => handleFilterChange("imported")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${filter === "imported" ? "bg-indigo-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Đã import
                </button>
              </div>

              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Tìm kiếm dữ liệu..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 flex flex-col min-h-0 border border-slate-200 rounded-lg overflow-hidden">
              <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm relative">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-bold w-16">Row</th>
                      <th className="px-4 py-3 font-bold w-32">Trạng thái</th>
                      <th className="px-4 py-3 font-bold w-48">Hành động</th>
                      <th className="px-4 py-3 font-bold">Dữ liệu thô (JSON)</th>
                      <th className="px-4 py-3 font-bold">Ghi chú lỗi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-600">{row.row_number}</td>
                        <td className="px-4 py-3">
                          {row.validation_status === "valid" ||
                          row.validation_status === "warning" ? (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                              Valid
                            </Badge>
                          ) : row.validation_status === "duplicate" ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">
                              Duplicate
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-none">
                              Invalid
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.import_action === "create_new" && (
                            <span className="text-emerald-600 font-medium text-xs">Create New</span>
                          )}
                          {row.import_action === "skip" && (
                            <span className="text-slate-500 font-medium text-xs">Skip</span>
                          )}
                          {row.import_action === "imported" && (
                            <span className="text-indigo-600 font-medium text-xs">Imported</span>
                          )}
                          {row.import_action === "update_existing" && (
                            <span className="text-blue-600 font-medium text-xs">
                              Update (Unsupported)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-h-24 overflow-y-auto text-xs text-slate-600 font-mono bg-slate-50 p-2 rounded border border-slate-100 whitespace-pre-wrap">
                            {JSON.stringify(row.raw_data, null, 2)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-rose-600">
                          {row.validation_errors?.length > 0
                            ? row.validation_errors.join(", ")
                            : "—"}
                          {row.duplicate_reason && (
                            <span className="text-amber-600 block mt-1">
                              {row.duplicate_reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {paginatedRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          Không tìm thấy dữ liệu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm shrink-0">
                  <div className="text-slate-500">
                    Hiển thị{" "}
                    <span className="font-bold text-slate-700">{paginatedRows.length}</span> trên
                    tổng số <span className="font-bold text-slate-700">{filteredRows.length}</span>{" "}
                    dòng
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="h-8"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Trước
                    </Button>
                    <span className="text-slate-600 font-medium px-2">
                      Trang {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8"
                    >
                      Sau
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500">
            Không tìm thấy dữ liệu lô.
          </div>
        )}

        <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex-1 flex flex-col justify-center">
            {batch?.status !== "completed" &&
              batch?.status !== "processing" &&
              eligibleRows.length > 0 &&
              isAdminOrSubAdmin && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Hệ thống chỉ tạo khách hàng mới từ dòng hợp lệ. Không cập nhật khách cũ. Dòng
                  lỗi/trùng sẽ bị bỏ qua.
                </p>
              )}
          </div>

          <div className="flex items-center gap-2 pl-4 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
              Đóng
            </Button>

            {batch?.status === "processing" && isAdminOrSubAdmin && (
              <Button disabled className="bg-indigo-400 text-white font-bold cursor-not-allowed">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang xử lý...
              </Button>
            )}

            {batch?.status !== "completed" &&
              batch?.status !== "processing" &&
              eligibleRows.length > 0 &&
              isAdminOrSubAdmin && (
                <Button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    `Xác nhận Import (${eligibleRows.length} dòng)`
                  )}
                </Button>
              )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
