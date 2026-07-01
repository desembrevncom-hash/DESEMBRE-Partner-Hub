import React, { useState, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Download,
} from "lucide-react";
import {
  ParsedImportRow,
  adaptMappedRow,
  validateImportRow,
  detectDuplicateInFile,
  buildImportSummary,
} from "@/lib/customers/importValidation";
import { Badge } from "@/components/ui/badge";

const TARGET_FIELDS = [
  { id: "business_name", label: "Tên cơ sở / Spa" },
  { id: "contact_name", label: "Người liên hệ" },
  { id: "phone", label: "Số điện thoại (*)", required: true },
  { id: "email", label: "Email" },
  { id: "province", label: "Tỉnh" },
  { id: "city", label: "Thành phố / Quận huyện" },
  { id: "source", label: "Nguồn khách" },
  { id: "facebook", label: "Facebook" },
  { id: "zalo", label: "Zalo" },
  { id: "website", label: "Website" },
  { id: "tiktok", label: "TikTok" },
  { id: "note", label: "Ghi chú" },
  { id: "owner_sale_id", label: "Owner Sale ID" },
  { id: "owner_sale_email", label: "Owner Sale Email" },
  { id: "historical_revenue_total", label: "Doanh số lịch sử" },
  { id: "historical_order_count", label: "Số đơn lịch sử" },
  { id: "historical_last_purchase_at", label: "Ngày mua cuối (lịch sử)" },
  { id: "historical_revenue_note", label: "Ghi chú doanh số" },
];

function guessTargetField(csvHeader: string): string | null {
  const h = csvHeader.toLowerCase().trim();
  if (h.includes("phone") || h.includes("sdt") || h.includes("điện thoại") || h.includes("mobile"))
    return "phone";
  if (h.includes("email")) return "email";
  if (h.includes("spa") || h.includes("clinic") || h.includes("business") || h.includes("cơ sở"))
    return "business_name";
  if (h.includes("contact") || h.includes("người liên hệ") || h.includes("tên khách"))
    return "contact_name";
  if (h.includes("province") || h.includes("tỉnh")) return "province";
  if (h.includes("city") || h.includes("thành phố") || h.includes("quận")) return "city";
  if (h.includes("source") || h.includes("nguồn")) return "source";
  if (h.includes("facebook") || h.includes("fb")) return "facebook";
  if (h.includes("zalo")) return "zalo";
  if (h.includes("website") || h.includes("web")) return "website";
  if (h.includes("tiktok")) return "tiktok";
  if (h.includes("note") || h.includes("ghi chú")) return "note";
  if (h === "owner_sale_id" || h.includes("sale id")) return "owner_sale_id";
  if (h.includes("sale_email") || h.includes("email sale")) return "owner_sale_email";
  if (h.includes("doanh số lịch sử") || h.includes("historical_revenue_total") || h.includes("doanh so")) return "historical_revenue_total";
  if (h.includes("số đơn lịch sử") || h.includes("historical_order_count") || h.includes("so don")) return "historical_order_count";
  if (h.includes("ngày mua cuối") || h.includes("historical_last_purchase_at") || h.includes("ngay mua")) return "historical_last_purchase_at";
  if (h.includes("ghi chú doanh số") || h.includes("historical_revenue_note")) return "historical_revenue_note";
  return null;
}

export function CustomerImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1 states
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);

  // Step 2 states
  const [columnMap, setColumnMap] = useState<Record<string, string | null>>({});

  // Step 3 states
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "valid" | "invalid" | "duplicate" | "warning">("all");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Step 4 states
  const [importReport, setImportReport] = useState<{
    imported: number;
    skipped: number;
    failed: number;
    failed_reasons?: { reason: string }[];
  } | null>(null);
  const [progress, setProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Step 1: Upload ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const processData = (headers: string[], data: any[]) => {
      if (!headers || headers.length === 0) {
        toast.error("Không tìm thấy tiêu đề cột trong file.");
        return;
      }
      setCsvHeaders(headers);
      setCsvData(data);

      const initialMap: Record<string, string | null> = {};
      const usedTargets = new Set<string>();

      headers.forEach((header) => {
        const guessed = guessTargetField(header);
        if (guessed && !usedTargets.has(guessed)) {
          initialMap[header] = guessed;
          usedTargets.add(guessed);
        } else {
          initialMap[header] = null;
        }
      });
      setColumnMap(initialMap);
      setStep(2);
    };

    if (selected.name.endsWith(".xlsx") || selected.name.endsWith(".xls")) {
      try {
        const data = await selected.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        if (jsonData.length < 1) {
          toast.error("File Excel trống.");
          return;
        }
        
        const headers = jsonData[0].map((h: any) => h?.toString()?.trim() || "");
        const rows = jsonData.slice(1).map((rowArr) => {
          const rowObj: any = {};
          headers.forEach((h, i) => {
            rowObj[h] = rowArr[i] !== undefined ? rowArr[i] : null;
          });
          return rowObj;
        }).filter(row => Object.values(row).some(v => v !== null && v !== ""));
        
        processData(headers, rows);
      } catch (err: any) {
        toast.error("Lỗi đọc file Excel: " + err.message);
      }
    } else {
      Papa.parse(selected, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          processData(results.meta.fields || [], results.data);
        },
        error: (error) => {
          toast.error("Lỗi đọc file CSV: " + error.message);
        },
      });
    }
  };

  // --- Step 2: Mapping ---
  const handleMapChange = (csvHeader: string, targetField: string | null) => {
    setColumnMap((prev) => {
      const next = { ...prev };
      // If targetField is already mapped to another header, unmap it there
      if (targetField !== "none" && targetField !== null) {
        Object.keys(next).forEach((k) => {
          if (next[k] === targetField) next[k] = null;
        });
      }
      next[csvHeader] = targetField === "none" ? null : targetField;
      return next;
    });
  };

  const handlePreview = async () => {
    // 0. Initial check
    const requiredKeys = Object.values(columnMap);
    if (!requiredKeys.includes("phone")) {
      toast.error("Vui lòng ghép cột cho trường bắt buộc: Số điện thoại.");
      return;
    }

    setIsValidating(true);
    setStep(3);

    try {
      // 1. Build mapped rows
      let rows = csvData.map((row, idx) => {
        const mappedData: any = {};
        Object.keys(columnMap).forEach((header) => {
          const target = columnMap[header];
          if (target) {
            mappedData[target] = row[header] !== undefined && row[header] !== "" ? String(row[header]).trim() : null;
          }
        });
        return adaptMappedRow(mappedData, row, idx);
      });

      // 2. Validate basic rules (phone, format)
      rows = rows.map(validateImportRow);

      // 3. Detect duplicate within file
      rows = detectDuplicateInFile(rows);

      // 4. Resolve DB duplicates and sale emails
      const phoneSet = new Set(rows.map((r) => r.normalized_phone).filter(Boolean) as string[]);
      const emailSet = new Set(rows.map((r) => r.normalized_email).filter(Boolean) as string[]);
      const ownerEmailSet = new Set(rows.map((r) => r.owner_sale_email).filter(Boolean) as string[]);

      const phoneArray = Array.from(phoneSet);
      const emailArray = Array.from(emailSet);
      const ownerEmailArray = Array.from(ownerEmailSet);

      const [dbPhones, dbPhonesNorm, dbEmails, sales] = await Promise.all([
        phoneArray.length > 0
          ? supabase.from("customers").select("id, phone, normalized_phone").in("phone", phoneArray)
          : { data: [] },
        phoneArray.length > 0
          ? supabase.from("customers").select("id, phone, normalized_phone").in("normalized_phone", phoneArray)
          : { data: [] },
        emailArray.length > 0
          ? supabase.from("customers").select("email, id").in("email", emailArray)
          : { data: [] },
        ownerEmailArray.length > 0
          ? supabase.from("profiles").select("id, email").in("email", ownerEmailArray)
          : { data: [] },
      ]);

      const existingPhones = new Set<string>();
      (dbPhones?.data || []).forEach((x: any) => {
        if (x.phone) existingPhones.add(x.phone);
        if (x.normalized_phone) existingPhones.add(x.normalized_phone);
      });
      (dbPhonesNorm?.data || []).forEach((x: any) => {
        if (x.phone) existingPhones.add(x.phone);
        if (x.normalized_phone) existingPhones.add(x.normalized_phone);
      });
      const existingEmails = new Set((dbEmails.data || []).map((x: any) => x.email));
      const saleEmailToId: Record<string, string> = {};
      (sales.data || []).forEach((s: any) => {
        saleEmailToId[s.email] = s.id;
      });

      rows = rows.map((row) => {
        if (row.validation_status === "invalid" || row.validation_status === "duplicate") {
          return row;
        }

        if (row.normalized_phone && existingPhones.has(row.normalized_phone)) {
          row.validation_status = "duplicate";
          row.validation_errors.push(`Số điện thoại ${row.normalized_phone} đã tồn tại trong hệ thống.`);
          row.import_action = "skip";
          return row;
        }

        if (row.normalized_email && existingEmails.has(row.normalized_email)) {
          row.validation_status = "duplicate";
          row.validation_errors.push(`Email ${row.normalized_email} đã tồn tại trong hệ thống.`);
          row.import_action = "skip";
          return row;
        }

        if (row.owner_sale_email) {
          const sid = saleEmailToId[row.owner_sale_email];
          if (sid) {
            row.owner_sale_id = sid;
          } else {
            row.warning_message = "Không tìm thấy Sale phụ trách với Email này. Khách sẽ không được gán sale.";
          }
        }

        if (row.validation_status === "pending") {
          row.validation_status = "valid";
          row.import_action = "create_new";
        }
        return row;
      });

      setParsedRows(rows);
      setSummary(buildImportSummary(rows));
      setIsValidating(false);
    } catch (error) {
      console.warn("Import validation failed", error);
      toast.error("Không thể kiểm tra file import. Vui lòng kiểm tra lại định dạng file.");
      setStep(2); // Go back to step 2 so user is not stuck in step 3 skeleton
      setIsValidating(false);
    }
  };

  // --- Step 3: Import ---
  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.import_action === "create_new");
    if (validRows.length === 0) {
      toast.error("Không có dữ liệu hợp lệ để import.");
      return;
    }

    const toNullableHistoricalDate = (value: any) => {
      const parsed = parseHistoricalDate(value);
      if (parsed === "INVALID_DATE") {
        throw new Error("Ngày mua cuối lịch sử không hợp lệ");
      }
      return parsed ?? null;
    };

    setIsProcessing(true);
    let importedCount = 0;
    let failedCount = 0;
    let duplicateCount = 0;
    const failedReasons: { reason: string }[] = [];

    const chunkSize = 100;
    const totalChunks = Math.ceil(validRows.length / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const chunk = validRows.slice(i * chunkSize, (i + 1) * chunkSize);
      const payload = chunk.map((r: any) => {
        const extraNote = [];
        if (r.province) extraNote.push(`Tỉnh/Thành: ${r.province}`);
        if (r.parsed_data?.website) extraNote.push(`Website: ${r.parsed_data.website}`);
        if (r.parsed_data?.tiktok) extraNote.push(`TikTok: ${r.parsed_data.tiktok}`);
        
        let finalNote = r.note || "";
        if (extraNote.length > 0) {
          finalNote = finalNote ? `${finalNote}\n${extraNote.join(" | ")}` : extraNote.join(" | ");
        }

        return {
          name: r.name || r.contact_name || r.business_name || r.phone,
          facility_name: r.business_name || null,
          business_name: r.business_name || null,
          contact_name: r.contact_name || null,
          phone: r.phone || null,
          normalized_phone: r.normalized_phone || null,
          email: r.email || null,
          normalized_email: r.normalized_email || null,
          city: r.city || null,
          source: r.source || null,
          facebook: r.parsed_data?.facebook || null,
          zalo: r.parsed_data?.zalo || null,
          note: finalNote || null,
          owner_sale_id: r.owner_sale_id || null,
          status: "new",
          lifecycle_stage: "new_lead",
          historical_revenue_total: r.historical_revenue_total ?? 0,
          historical_order_count: r.historical_order_count ?? 0,
          historical_last_purchase_at: toNullableHistoricalDate(r.historical_last_purchase_at),
          historical_revenue_note: r.historical_revenue_note || null,
        };
      });

      // Final guard check
      for (const p of payload) {
        if (p.historical_last_purchase_at === "null" || p.historical_last_purchase_at === "undefined") {
          setIsProcessing(false);
          toast.error("Ngày mua cuối lịch sử không hợp lệ (lỗi hệ thống gửi raw string).");
          return;
        }
      }

      try {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) {
          if (error.code === "PGRST204" || error.code === "400" || (error.message && error.message.includes("column") && error.message.includes("historical_"))) {
             toast.error("Staging schema chưa có historical revenue columns. Hãy chạy M55_SQL_Staging_Plan.sql trên Staging.");
             setIsProcessing(false);
             return;
          }
          console.error("Import chunk error", error);
          for (let j = 0; j < payload.length; j++) {
            const rowPayload = payload[j];
            const { error: rowError } = await supabase.from("customers").insert([rowPayload]);
            if (rowError) {
              if (rowError.code === "23505" || (rowError.message && (rowError.message.includes("duplicate key value") || rowError.message.includes("idx_customers_unique_normalized_phone")))) {
                duplicateCount++;
              } else {
                failedCount++;
                failedReasons.push({ reason: `Dòng ${chunk[j].row_number} - SĐT ${rowPayload.phone}: ${rowError.message || rowError.details || rowError.code}` });
              }
            } else {
              importedCount++;
            }
          }
        } else {
          importedCount += chunk.length;
        }
      } catch (err: any) {
        console.error("Import chunk exception", err);
        failedCount += chunk.length;
        failedReasons.push({ reason: err.message || "Lỗi Exception" });
      }
      setProgress(Math.round(((i + 1) / totalChunks) * 100));
    }

    const skippedActionCount = parsedRows.filter((r) => r.import_action === "skip").length;

    setImportReport({
      imported: importedCount,
      skipped: skippedActionCount + duplicateCount,
      failed: failedCount,
      failed_reasons: failedReasons,
    });
    setStep(4);
    setIsProcessing(false);
  };

  // --- UI Render ---
  const filteredRows = parsedRows.filter((r) => (filter === "all" ? true : r.validation_status === filter));

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nhập Khách hàng Hàng loạt</h1>
          <p className="text-slate-500 mt-1">Hỗ trợ định dạng CSV</p>
        </div>
        {step < 4 && (
          <Button variant="outline" onClick={() => navigate({ to: "/customers" })}>
            Hủy
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-6">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                <FileSpreadsheet className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Tải lên file dữ liệu</h3>
              <p className="text-sm text-slate-500 max-w-md mb-2">
                Hỗ trợ định dạng CSV và Excel (.xlsx). Chắc chắn rằng file của bạn có dòng tiêu đề (header row).
              </p>
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md border border-amber-200 mb-6">
                💡 Khuyến nghị dùng CSV UTF-8. Nếu dùng Excel bị lỗi font tiếng Việt, hãy lưu bằng: Save As → CSV UTF-8.
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud className="w-4 h-4 mr-2" /> Chọn file từ máy tính
                </Button>
                <Button variant="outline" onClick={() => {
                  const csvContent = "phone,business_name,contact_name,email,province,city,address,source,facebook,zalo,website,tiktok,note,owner_sale_email,owner_sale_id,historical_revenue_total,historical_order_count,historical_last_purchase_at\n0961234567,Thu Hà Spa,Chị Phương,phuong@example.com,Hải Phòng,Hồng Bàng,\"12 Lạch Tray\",Facebook,,,,,\"Khách quan tâm chăm sóc da\",,,55000000,10,2023-12-01";
                  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "customers_import_template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-4 h-4 mr-2" /> Tải file mẫu CSV
                </Button>
                <Button variant="outline" onClick={() => {
                  const wsData = [
                    ["phone", "business_name", "contact_name", "email", "province", "city", "address", "source", "facebook", "zalo", "website", "tiktok", "note", "owner_sale_email", "owner_sale_id", "historical_revenue_total", "historical_order_count", "historical_last_purchase_at"],
                    ["0961234567", "Thu Hà Spa", "Chị Phương", "phuong@example.com", "Hải Phòng", "Hồng Bàng", "12 Lạch Tray", "Facebook", "", "", "", "", "Khách quan tâm chăm sóc da", "", "", "55000000", "10", "2023-12-01"]
                  ];
                  const ws = XLSX.utils.aoa_to_sheet(wsData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Template");
                  XLSX.writeFile(wb, "customers_import_template.xlsx");
                }}>
                  <Download className="w-4 h-4 mr-2" /> Tải file mẫu Excel
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <h3 className="text-lg font-medium">Ghép cột dữ liệu</h3>
                  <p className="text-sm text-slate-500">
                    Hệ thống đã tự động ghép những cột có tên tương ứng. Vui lòng kiểm tra lại.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-2">
                {csvHeaders.map((header) => (
                  <div key={header} className="flex items-center gap-4 bg-slate-50 p-3 rounded-lg">
                    <div className="flex-1 font-medium text-sm text-slate-700 truncate" title={header}>
                      {header}
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                    <div className="flex-1">
                      <Select
                        value={columnMap[header] || "none"}
                        onValueChange={(val) => handleMapChange(header, val)}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Bỏ qua cột này" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-slate-500 italic">-- Bỏ qua --</SelectItem>
                          {TARGET_FIELDS.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Quay lại
                </Button>
                <Button onClick={handlePreview}>
                  Xem trước dữ liệu <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {isValidating ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
                  <p className="text-slate-600">Đang kiểm tra và đối chiếu dữ liệu...</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <p className="text-sm font-medium text-slate-500 mb-1">Tổng cộng</p>
                      <p className="text-2xl font-bold text-slate-900">{summary?.total_rows || 0}</p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                      <p className="text-sm font-medium text-emerald-600 mb-1">Hợp lệ (Sẵn sàng)</p>
                      <p className="text-2xl font-bold text-emerald-700">{summary?.valid_rows || 0}</p>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-xl border border-rose-100">
                      <p className="text-sm font-medium text-rose-600 mb-1">Lỗi dữ liệu</p>
                      <p className="text-2xl font-bold text-rose-700">{summary?.invalid_rows || 0}</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                      <p className="text-sm font-medium text-amber-600 mb-1">Bị trùng lặp</p>
                      <p className="text-2xl font-bold text-amber-700">{summary?.duplicate_rows || 0}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {(["all", "valid", "invalid", "duplicate", "warning"] as const).map((f) => (
                      <Button
                        key={f}
                        variant={filter === f ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFilter(f)}
                        className="capitalize"
                      >
                        {f}
                      </Button>
                    ))}
                  </div>

                  <div className="border rounded-xl overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 sticky top-0 shadow-sm">
                          <tr>
                            <th className="px-4 py-3 font-medium text-slate-600 w-[60px]">Dòng</th>
                            <th className="px-4 py-3 font-medium text-slate-600 w-[100px]">Trạng thái</th>
                            <th className="px-4 py-3 font-medium text-slate-600">Tên KH/Cơ sở</th>
                            <th className="px-4 py-3 font-medium text-slate-600">SĐT</th>
                            <th className="px-4 py-3 font-medium text-slate-600">Email</th>
                            <th className="px-4 py-3 font-medium text-slate-600">Thông báo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {filteredRows.slice(0, 50).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-slate-500">{r.row_number}</td>
                              <td className="px-4 py-3">
                                {r.validation_status === "valid" && (
                                  <Badge className="bg-emerald-100 text-emerald-700 border-none hover:bg-emerald-100">Hợp lệ</Badge>
                                )}
                                {r.validation_status === "invalid" && (
                                  <Badge variant="destructive" className="border-none">Lỗi</Badge>
                                )}
                                {r.validation_status === "duplicate" && (
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none">Trùng</Badge>
                                )}
                                {r.validation_status === "warning" && (
                                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-none">Cảnh báo</Badge>
                                )}
                              </td>
                              <td className="px-4 py-3 font-medium">{r.name || "-"}</td>
                              <td className="px-4 py-3">{r.phone || "-"}</td>
                              <td className="px-4 py-3 text-slate-500">{r.email || "-"}</td>
                              <td className="px-4 py-3 text-xs text-rose-600 max-w-[200px] truncate" title={r.error_message || ""}>
                                {r.error_message || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {filteredRows.length > 50 && (
                      <div className="bg-slate-50 p-3 text-center text-sm text-slate-500 border-t">
                        Hiển thị 50 dòng đầu tiên. Còn {filteredRows.length - 50} dòng khác bị ẩn.
                      </div>
                    )}
                  </div>

                  <div className="flex justify-between pt-4 border-t">
                    <Button variant="outline" onClick={() => setStep(2)} disabled={isProcessing}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> Chọn lại cột
                    </Button>
                    <div className="flex items-center gap-4">
                      {isProcessing && (
                        <div className="text-sm font-medium text-slate-600 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" /> {progress}%
                        </div>
                      )}
                      <Button onClick={handleImport} disabled={isProcessing || summary?.valid_rows === 0}>
                        {isProcessing ? "Đang xử lý..." : `Bắt đầu Import (${summary?.valid_rows || 0} dòng)`}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 4 && importReport && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="bg-emerald-100 p-4 rounded-full mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Hoàn tất Import!</h3>
              <p className="text-slate-500 mb-8 max-w-md">
                Quá trình nhập dữ liệu khách hàng đã hoàn thành. Hãy kiểm tra lại danh sách.
              </p>

              <div className="flex justify-center gap-6 mb-8 text-center max-w-2xl mx-auto">
                <div className="bg-white border rounded-xl p-6 shadow-sm flex-1">
                  <div className="text-sm font-medium text-slate-500 mb-1">Thành công</div>
                  <div className="text-3xl font-black text-emerald-600">
                    {importReport?.imported || 0}
                  </div>
                </div>
                <div className="bg-white border rounded-xl p-6 shadow-sm flex-1">
                  <div className="text-sm font-medium text-slate-500 mb-1">Bỏ qua (Trùng/Lỗi)</div>
                  <div className="text-3xl font-black text-slate-600">
                    {importReport?.skipped || 0}
                  </div>
                </div>
                <div className="bg-white border border-rose-100 rounded-xl p-6 shadow-sm flex-1 bg-rose-50/30">
                  <div className="text-sm font-medium text-rose-500 mb-1">Thất bại (Server)</div>
                  <div className="text-3xl font-black text-rose-600">
                    {importReport?.failed || 0}
                  </div>
                </div>
              </div>
              
              {importReport?.failed_reasons && importReport.failed_reasons.length > 0 && (
                <div className="max-w-2xl mx-auto mb-8 text-left bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold mb-3">
                    <AlertTriangle className="w-5 h-5" /> Chi tiết lỗi Server:
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2 text-sm text-rose-700 font-mono bg-white p-3 rounded border border-rose-100">
                    {importReport.failed_reasons.map((r, i) => (
                      <div key={i} className="pb-1 border-b border-rose-50 last:border-0">{r.reason}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Import file khác
                </Button>
                <Button onClick={() => navigate({ to: "/customers" })}>
                  Về danh sách khách hàng
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
