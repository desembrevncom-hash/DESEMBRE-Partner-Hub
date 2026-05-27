import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  UploadCloud, CheckCircle2, AlertCircle, FileSpreadsheet,
  Download, RefreshCw, Users, ArrowRight, Loader2, Play,
  ShieldAlert, XCircle, SkipForward, FileDown
} from "lucide-react";
import * as XLSX from "xlsx";
import { normalizePhone } from "@/lib/phone";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getStaffDisplayName, buildStaffMap } from "@/lib/staffDisplay";
import { createNotification } from "@/lib/notifications";
import { Progress } from "@/components/ui/progress";

interface BulkLeadImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Row result tracking
interface RowResult {
  originalRow: any;           // raw excel row
  status: "imported" | "duplicate" | "invalid" | "db_error";
  reason: string;
  rowIndex: number;
}

export function BulkLeadImportDialog({ open, onOpenChange, onSuccess }: BulkLeadImportDialogProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);

  // Parsed rows
  const [parsedRows, setParsedRows] = useState<any[]>([]);

  // Validated categories
  const [validRows, setValidRows] = useState<any[]>([]);          // rows ready to insert
  const [validRowsOriginal, setValidRowsOriginal] = useState<any[]>([]); // original excel rows for valid
  const [duplicateRows, setDuplicateRows] = useState<any[]>([]);  // original excel rows for dups
  const [invalidRows, setInvalidRows] = useState<any[]>([]);      // original excel rows for invalids

  // Post-import row-level results
  const [rowResults, setRowResults] = useState<RowResult[]>([]);

  // Options
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, any>>({});
  const [selectedStaff, setSelectedStaff] = useState<string>("none");

  // Import state
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState({ success: 0, dbError: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setFile(null);
      setParsedRows([]);
      setValidRows([]);
      setValidRowsOriginal([]);
      setDuplicateRows([]);
      setInvalidRows([]);
      setRowResults([]);
      setSelectedStaff("none");
      setImporting(false);
      setProgress(0);
      setImportResult({ success: 0, dbError: 0 });
      fetchStaff();
    }
  }, [open]);

  const fetchStaff = async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['sale', 'tele_lead', 'admin', 'subadmin']);
      if (data) {
        setStaffList(data);
        setStaffMap(buildStaffMap(data));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["spa_name", "customer_name", "phone", "email", "city", "address", "facebook", "zalo", "tiktok", "source", "note"],
      ["Spa Tắm Trắng", "Chị Lan", "0901234567", "lan@example.com", "Hà Nội", "123 Cầu Giấy", "fb.com/lan", "", "", "FACEBOOK", "Quan tâm máy triệt lông"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "DESEMBRE_Lead_Import_Template.xlsx");
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setStep(2);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        await validateData(jsonData);
      } catch (err: any) {
        toast.error("Lỗi đọc file: " + err.message);
        setStep(1);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const validateData = async (data: any[]) => {
    const valid: any[] = [];
    const validOriginal: any[] = [];
    const invalid: any[] = [];
    const dups: any[] = [];

    // Fetch existing phones/emails for duplicate check
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, phone, email, normalized_phone');

    const existingPhones = new Map();
    const existingEmails = new Map();
    
    existingCustomers?.forEach((c: any) => {
      if (c.phone) existingPhones.set(c.phone, c.id);
      if (c.normalized_phone) existingPhones.set(c.normalized_phone, c.id);
      if (c.email) existingEmails.set(c.email, c.id);
    });

    for (const row of data) {
      const phone = row.phone ? normalizePhone(String(row.phone)) : null;
      const email = row.email ? String(row.email).trim().toLowerCase() : null;

      // Validation: must have phone or email
      if (!phone && !email) {
        invalid.push({ ...row, _error: "Thiếu cả Phone và Email" });
        continue;
      }

      // Duplicate check
      const matchedPhoneId = phone ? existingPhones.get(phone) : null;
      const matchedEmailId = email ? existingEmails.get(email) : null;
      const matchedId = matchedPhoneId || matchedEmailId;

      if (matchedId) {
        dups.push({
          ...row,
          _error: matchedPhoneId ? `SĐT ${phone} đã tồn tại` : `Email ${email} đã tồn tại`,
          _matched_customer_id: matchedId
        });
        continue;
      }

      // Valid row — build insert payload
      const payload = {
        facility_name: row.spa_name || null,
        name: row.customer_name || row.spa_name || 'Khách hàng từ Excel',
        contact_name: row.customer_name || row.spa_name || 'Khách hàng từ Excel',
        business_name: row.spa_name || null,
        phone: phone,
        normalized_phone: phone,
        email: email,
        city: row.city || null,
        address: row.address || null,
        source: row.source || 'FACEBOOK',
        note: row.note || null,
        facebook_url: row.facebook || null,
        zalo_number: row.zalo || null,
        tiktok_url: row.tiktok || null,
        status: 'new',
      };

      valid.push(payload);
      validOriginal.push(row);
    }

    setParsedRows(data);
    setValidRows(valid);
    setValidRowsOriginal(validOriginal);
    setInvalidRows(invalid);
    setDuplicateRows(dups);
  };

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("Không có dòng hợp lệ để import");
      return;
    }

    setImporting(true);
    setStep(4);

    const ownerId = selectedStaff !== "none" ? selectedStaff : null;
    const stage = ownerId ? 'lead_received' : 'lead_new';

    let successCount = 0;
    let dbErrorCount = 0;
    const results: RowResult[] = [];

    // Pre-fill duplicate results
    for (let i = 0; i < duplicateRows.length; i++) {
      results.push({
        originalRow: duplicateRows[i],
        status: "duplicate",
        reason: duplicateRows[i]._error || "Trùng lặp",
        rowIndex: i,
      });
    }

    // Pre-fill invalid results
    for (let i = 0; i < invalidRows.length; i++) {
      results.push({
        originalRow: invalidRows[i],
        status: "invalid",
        reason: invalidRows[i]._error || "Thiếu dữ liệu",
        rowIndex: i,
      });
    }

    // Insert valid rows — ROW BY ROW for accurate tracking
    // Use batches of 10 for performance but track individually on error
    const batchSize = 10;
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batchPayloads = validRows.slice(i, i + batchSize).map(row => ({
        ...row,
        owner_sale_id: ownerId,
        lifecycle_stage: stage,
        created_by: user?.id
      }));
      const batchOriginal = validRowsOriginal.slice(i, i + batchSize);

      try {
        const { data: inserted, error } = await supabase
          .from('customers')
          .insert(batchPayloads)
          .select('id');

        if (error) throw error;

        // Success — log activities
        successCount += batchPayloads.length;
        for (let j = 0; j < batchOriginal.length; j++) {
          results.push({
            originalRow: batchOriginal[j],
            status: "imported",
            reason: ownerId ? `Đã phân công cho ${getStaffDisplayName(ownerId, staffMap)}` : "Đã thêm vào Incoming Queue",
            rowIndex: i + j,
          });
        }

        // Log activities
        if (inserted && inserted.length > 0) {
          const activityPayload = inserted.map((c: any) => ({
            customer_id: c.id,
            type: ownerId ? 'lead_imported_assigned' : 'lead_imported',
            activity_type: ownerId ? 'lead_imported_assigned' : 'lead_imported',
            title: 'Import từ Excel',
            content: ownerId
              ? `Import và phân công cho ${getStaffDisplayName(ownerId, staffMap)}`
              : 'Import vào Incoming Queue',
            created_by: user?.id
          }));
          await supabase.from('customer_activities').insert(activityPayload);
        }

      } catch (err: any) {
        console.error("Batch insert error:", err);

        // Fallback: try row-by-row to isolate which ones failed
        for (let j = 0; j < batchPayloads.length; j++) {
          try {
            const { data: singleInserted, error: singleError } = await supabase
              .from('customers')
              .insert([batchPayloads[j]])
              .select('id');

            if (singleError) throw singleError;

            successCount++;
            results.push({
              originalRow: batchOriginal[j],
              status: "imported",
              reason: ownerId ? `Đã phân công cho ${getStaffDisplayName(ownerId, staffMap)}` : "Đã thêm vào Incoming Queue",
              rowIndex: i + j,
            });

            if (singleInserted?.[0]) {
              await supabase.from('customer_activities').insert([{
                customer_id: singleInserted[0].id,
                type: ownerId ? 'lead_imported_assigned' : 'lead_imported',
                activity_type: ownerId ? 'lead_imported_assigned' : 'lead_imported',
                title: 'Import từ Excel',
                content: ownerId
                  ? `Import và phân công cho ${getStaffDisplayName(ownerId, staffMap)}`
                  : 'Import vào Incoming Queue',
                created_by: user?.id
              }]);
            }
          } catch (rowErr: any) {
            dbErrorCount++;
            results.push({
              originalRow: batchOriginal[j],
              status: "db_error",
              reason: rowErr.message || "Lỗi ghi DB",
              rowIndex: i + j,
            });
          }
        }
      }

      setProgress(Math.min(100, Math.round(((i + batchSize) / validRows.length) * 100)));
    }

    // Send one summary notification if assigned to someone else
    if (ownerId && ownerId !== user?.id && successCount > 0) {
      await createNotification({
        recipient_user_id: ownerId,
        title: `Bạn nhận được ${successCount} lead mới từ Excel`,
        message: `Hệ thống vừa phân công ${successCount} lead mới cho bạn từ đợt import Excel.`,
        type: 'lead_assigned',
        priority: 'high',
        created_by: user?.id
      });
    }

    setRowResults(results);
    setImportResult({ success: successCount, dbError: dbErrorCount });
    setImporting(false);
    setProgress(100);
    toast.success(`Import hoàn tất! ✅ ${successCount} thành công`);
  };

  // --- Download Result File ---
  const handleDownloadResult = () => {
    const statusLabel: Record<string, string> = {
      imported: "✅ Imported",
      duplicate: "⚠️ Duplicate (Bỏ qua)",
      invalid: "❌ Invalid (Lỗi dữ liệu)",
      db_error: "🔴 DB Error",
    };

    const rows = rowResults.map(r => ({
      spa_name: r.originalRow.spa_name || "",
      customer_name: r.originalRow.customer_name || "",
      phone: r.originalRow.phone || "",
      email: r.originalRow.email || "",
      city: r.originalRow.city || "",
      source: r.originalRow.source || "",
      import_status: statusLabel[r.status] || r.status,
      import_reason: r.reason,
      matched_customer_id: r.originalRow._matched_customer_id || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    // Column widths
    ws["!cols"] = [
      { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 30 },
      { wch: 15 }, { wch: 15 }, { wch: 28 }, { wch: 40 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import Result");

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `DESEMBRE_Import_Result_${today}.xlsx`);
    toast.success("Đã tải file kết quả import!");
  };

  // Counts from rowResults
  const resultImported = rowResults.filter(r => r.status === "imported").length;
  const resultDuplicate = rowResults.filter(r => r.status === "duplicate").length;
  const resultInvalid = rowResults.filter(r => r.status === "invalid").length;
  const resultDbError = rowResults.filter(r => r.status === "db_error").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden font-sans bg-slate-50 border-slate-200">
        <DialogHeader className="p-6 pb-4 bg-white border-b border-slate-100">
          <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            Bulk Lead Intake
          </DialogTitle>
          <DialogDescription className="font-medium text-slate-500">
            Nhập dữ liệu khách hàng hàng loạt từ Excel / CSV
          </DialogDescription>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-3">
            {[1, 2, 3, 4].map((s) => (
              <React.Fragment key={s}>
                <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-black transition-all ${
                  step === s
                    ? "bg-indigo-600 text-white scale-110"
                    : step > s
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}>
                  {step > s ? "✓" : s}
                </div>
                {s < 4 && <div className={`flex-1 h-0.5 transition-all ${step > s ? "bg-emerald-400" : "bg-slate-200"}`} />}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase mt-1 px-0.5">
            <span>Tải file</span>
            <span>Preview</span>
            <span>Cấu hình</span>
            <span>Kết quả</span>
          </div>
        </DialogHeader>

        <div className="p-6">
          {/* ─── STEP 1: UPLOAD ─── */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                <div className="text-sm">
                  <p className="font-bold text-indigo-900">Tải file mẫu (Template)</p>
                  <p className="text-indigo-600/80 font-medium">Bắt buộc dùng format chuẩn để hệ thống nhận diện đúng cột.</p>
                </div>
                <Button variant="outline" className="bg-white shrink-0" onClick={handleDownloadTemplate}>
                  <Download className="w-4 h-4 mr-2" /> Tải Template
                </Button>
              </div>

              <div
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-white rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
                  <UploadCloud className="w-8 h-8 text-indigo-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900 text-lg">Click để tải file lên</p>
                  <p className="text-sm font-medium text-slate-500 mt-1">Hỗ trợ .xlsx, .xls, .csv</p>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processFile(e.target.files[0]);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* ─── STEP 2: PREVIEW ─── */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-900 text-lg">Preview Dữ Liệu</h3>
                  <p className="text-sm font-medium text-slate-500">{file?.name}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(1)}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Chọn file khác
                </Button>
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-2xl font-black text-slate-900">{parsedRows.length}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase mt-1">Tổng dòng</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 text-center">
                  <div className="text-2xl font-black text-emerald-600">{validRows.length}</div>
                  <div className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Sẽ import</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 text-center">
                  <div className="text-2xl font-black text-amber-600">{duplicateRows.length}</div>
                  <div className="text-[10px] font-bold text-amber-600 uppercase mt-1">Trùng (skip)</div>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 text-center">
                  <div className="text-2xl font-black text-rose-600">{invalidRows.length}</div>
                  <div className="text-[10px] font-bold text-rose-600 uppercase mt-1">Lỗi dữ liệu</div>
                </div>
              </div>

              {/* Duplicate info */}
              {duplicateRows.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-4 text-sm">
                  <p className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                    <SkipForward className="w-4 h-4" /> Trùng lặp — Sẽ bỏ qua ({duplicateRows.length})
                  </p>
                  <p className="text-xs text-amber-700 font-medium mb-2">
                    Các lead này đã tồn tại trong hệ thống. Owner và stage hiện tại sẽ <strong>không bị thay đổi</strong>.
                  </p>
                  <ul className="list-disc pl-5 text-amber-700/80 font-medium space-y-0.5">
                    {duplicateRows.slice(0, 3).map((r, i) => (
                      <li key={i}>{r.customer_name || r.spa_name || 'Ẩn danh'}: {r._error}</li>
                    ))}
                    {duplicateRows.length > 3 && <li>...và {duplicateRows.length - 3} dòng khác</li>}
                  </ul>
                </div>
              )}

              {/* Invalid info */}
              {invalidRows.length > 0 && (
                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 text-sm">
                  <p className="font-bold text-rose-800 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Dữ liệu không hợp lệ ({invalidRows.length})
                  </p>
                  <ul className="list-disc pl-5 text-rose-600/80 font-medium space-y-0.5">
                    {invalidRows.slice(0, 3).map((r, i) => (
                      <li key={i}>{r.customer_name || r.spa_name || 'Ẩn danh'}: {r._error}</li>
                    ))}
                    {invalidRows.length > 3 && <li>...và {invalidRows.length - 3} dòng khác</li>}
                  </ul>
                </div>
              )}

              {validRows.length === 0 && (
                <div className="bg-slate-100 rounded-xl p-4 text-center text-sm text-slate-500 font-medium">
                  Không có dòng hợp lệ. Kiểm tra lại file hoặc tải template mới.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Hủy</Button>
                <Button className="bg-indigo-600 hover:bg-indigo-700" disabled={validRows.length === 0} onClick={() => setStep(3)}>
                  Tiếp tục <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: OPTIONS ─── */}
          {step === 3 && (
            <div className="space-y-6">
              <h3 className="font-black text-slate-900 text-lg">Cấu hình Import</h3>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-500" />
                    Assign to Sale (Tùy chọn)
                  </label>
                  <p className="text-xs text-slate-500 font-medium pb-1">
                    Nếu để trống, lead sẽ được đẩy vào <strong>Incoming Queue</strong> chờ chia.
                  </p>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Chọn nhân viên..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">-- Không phân công ngay (vào Incoming Queue) --</SelectItem>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-4 border-t border-slate-100 space-y-2">
                  <label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                    Xử lý trùng lặp
                  </label>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-xs font-medium text-amber-800">
                    <strong>Skip Duplicate (mặc định):</strong> Các lead trùng số điện thoại hoặc email sẽ bị bỏ qua hoàn toàn.
                    Owner và stage hiện tại của lead cũ sẽ không bị thay đổi.
                  </div>
                </div>

                {/* Summary */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-500 uppercase mb-3">Tóm tắt sẽ thực hiện</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Sẽ import:</span>
                      <span className="font-black text-emerald-600">{validRows.length} lead</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bỏ qua (duplicate):</span>
                      <span className="font-black text-amber-600">{duplicateRows.length} lead</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Bỏ qua (invalid):</span>
                      <span className="font-black text-rose-600">{invalidRows.length} dòng</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <Button variant="ghost" onClick={() => setStep(2)}>Quay lại</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleImport}>
                  <Play className="w-4 h-4 mr-1.5" fill="currentColor" />
                  Bắt đầu Import {validRows.length} Lead
                </Button>
              </div>
            </div>
          )}

          {/* ─── STEP 4: RESULT ─── */}
          {step === 4 && (
            <div className="space-y-6">
              {importing ? (
                /* Loading state */
                <div className="flex flex-col items-center justify-center gap-4 py-12">
                  <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
                  <div className="space-y-2 w-full max-w-xs text-center">
                    <p className="font-bold text-slate-900 text-lg">Đang ghi dữ liệu...</p>
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs font-medium text-slate-500">{progress}%</p>
                    <p className="text-xs text-slate-400">Không đóng cửa sổ này</p>
                  </div>
                </div>
              ) : (
                /* Done state */
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex flex-col items-center gap-2 py-4 text-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-1 ${
                      resultDbError > 0 ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {resultDbError > 0
                        ? <AlertCircle className="w-7 h-7" />
                        : <CheckCircle2 className="w-7 h-7" />
                      }
                    </div>
                    <h3 className="font-black text-slate-900 text-2xl">Import Hoàn Tất</h3>
                    <p className="text-sm text-slate-500 font-medium">
                      {resultDbError > 0 ? "Một số dòng gặp lỗi khi ghi — xem chi tiết bên dưới." : "Tất cả dòng hợp lệ đã được xử lý thành công."}
                    </p>
                  </div>

                  {/* Result breakdown */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 text-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-emerald-600">{resultImported}</div>
                      <div className="text-[10px] font-bold text-emerald-600 uppercase mt-1">Imported</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                      <SkipForward className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-amber-600">{resultDuplicate}</div>
                      <div className="text-[10px] font-bold text-amber-600 uppercase mt-1">Duplicate</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-center">
                      <XCircle className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                      <div className="text-2xl font-black text-rose-600">{resultInvalid}</div>
                      <div className="text-[10px] font-bold text-rose-600 uppercase mt-1">Invalid</div>
                    </div>
                    <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
                      <AlertCircle className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <div className="text-2xl font-black text-slate-600">{resultDbError}</div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase mt-1">DB Error</div>
                    </div>
                  </div>

                  {/* Detail table — show failed rows if any */}
                  {(resultDuplicate > 0 || resultInvalid > 0 || resultDbError > 0) && (
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <p className="text-sm font-bold text-slate-700">Chi tiết các dòng không import</p>
                        <span className="text-xs font-medium text-slate-400">
                          {resultDuplicate + resultInvalid + resultDbError} dòng
                        </span>
                      </div>
                      <div className="divide-y divide-slate-50 max-h-48 overflow-y-auto">
                        {rowResults
                          .filter(r => r.status !== "imported")
                          .slice(0, 20)
                          .map((r, i) => (
                            <div key={i} className="px-4 py-2.5 flex items-start gap-3 text-xs">
                              <span className={`shrink-0 mt-0.5 font-bold ${
                                r.status === "duplicate" ? "text-amber-500"
                                : r.status === "invalid" ? "text-rose-500"
                                : "text-slate-400"
                              }`}>
                                {r.status === "duplicate" ? "⚠ DUP"
                                  : r.status === "invalid" ? "✗ INV"
                                  : "✗ ERR"}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold text-slate-800 truncate">
                                  {r.originalRow.customer_name || r.originalRow.spa_name || "Ẩn danh"}
                                  {r.originalRow.phone && <span className="text-slate-400 font-normal ml-1">· {r.originalRow.phone}</span>}
                                </p>
                                <p className="text-slate-500 truncate">{r.reason}</p>
                              </div>
                            </div>
                          ))}
                        {(resultDuplicate + resultInvalid + resultDbError) > 20 && (
                          <div className="px-4 py-2 text-xs text-slate-400 font-medium text-center">
                            ...và {(resultDuplicate + resultInvalid + resultDbError) - 20} dòng khác. Tải file kết quả để xem đầy đủ.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="flex-1 border-slate-200"
                      onClick={handleDownloadResult}
                    >
                      <FileDown className="w-4 h-4 mr-2" />
                      Tải file kết quả (.xlsx)
                    </Button>
                    <Button
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      onClick={() => {
                        if (onSuccess) onSuccess();
                        else onOpenChange(false);
                      }}
                    >
                      Đóng & Xem Danh Sách
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
