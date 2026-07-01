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
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    Papa.parse(selected, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.meta.fields || results.meta.fields.length === 0) {
          toast.error("Không tìm thấy tiêu đề cột trong file CSV.");
          return;
        }
        setCsvHeaders(results.meta.fields);
        setCsvData(results.data);

        // Auto guess mapping
        const initialMap: Record<string, string | null> = {};
        const usedTargets = new Set<string>();

        results.meta.fields.forEach((header) => {
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
      },
      error: (error) => {
        toast.error("Lỗi đọc file: " + error.message);
      },
    });
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
    // Check if phone is mapped
    const hasPhoneMap = Object.values(columnMap).includes("phone");
    if (!hasPhoneMap) {
      toast.error("Bạn phải map ít nhất 1 cột vào trường 'Số điện thoại (*)'");
      return;
    }

    setIsValidating(true);
    setStep(3);

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

    try {
      const [dbPhones, dbEmails, sales] = await Promise.all([
        phoneSet.size > 0
          ? supabase.from("customers").select("phone, id").in("phone", Array.from(phoneSet))
          : { data: [] },
        emailSet.size > 0
          ? supabase.from("customers").select("email, id").in("email", Array.from(emailSet))
          : { data: [] },
        ownerEmailSet.size > 0
          ? supabase.from("profiles").select("id, email").in("email", Array.from(ownerEmailSet))
          : { data: [] },
      ]);

      const existingPhones = new Set((dbPhones.data || []).map((x: any) => x.phone));
      const existingEmails = new Set((dbEmails.data || []).map((x: any) => x.email));
      const saleEmailToId: Record<string, string> = {};
      (sales.data || []).forEach((s: any) => {
        saleEmailToId[s.email] = s.id;
      });

      rows = rows.map((row) => {
        if (row.validation_status === "invalid" || row.validation_status === "duplicate")
          return row;

        const errors = [...(row.validation_errors || [])];
        let isDup = false;

        if (row.normalized_phone && existingPhones.has(row.normalized_phone)) {
          isDup = true;
          errors.push("Trùng SĐT trong Database");
        }
        if (!isDup && row.normalized_email && existingEmails.has(row.normalized_email)) {
          isDup = true;
          errors.push("Trùng Email trong Database");
        }

        if (isDup) {
          return {
            ...row,
            validation_status: "duplicate",
            validation_errors: errors,
            error_message: errors.join(" | "),
            duplicate_reason: "Đã có trong DB",
            import_action: "skip",
          };
        }

        // Handle sale email mapping
        if (row.owner_sale_email) {
          const saleId = saleEmailToId[row.owner_sale_email];
          if (saleId) {
            row.owner_sale_id = saleId;
          } else {
            errors.push("Không tìm thấy Sale với email này");
            return {
              ...row,
              validation_status: "invalid",
              validation_errors: errors,
              error_message: errors.join(" | "),
              import_action: "skip",
            };
          }
        }

        return row;
      });
    } catch (err) {
      console.error("DB Validation Error", err);
      toast.error("Lỗi khi kiểm tra dữ liệu với DB");
    }

    setParsedRows(rows);
    setSummary(buildImportSummary(rows));
    setIsValidating(false);
  };

  // --- Step 3: Import ---
  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => r.import_action === "create_new");
    if (validRows.length === 0) {
      toast.error("Không có dữ liệu hợp lệ để import.");
      return;
    }

    setIsProcessing(true);
    let importedCount = 0;
    let failedCount = 0;
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
          customer_type: "retail",
          lifecycle_stage: "new_lead",
        };
      });

      try {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) {
          console.error("Import chunk error", error);
          for (let j = 0; j < payload.length; j++) {
            const rowPayload = payload[j];
            const { error: rowError } = await supabase.from("customers").insert([rowPayload]);
            if (rowError) {
              failedCount++;
              failedReasons.push({ reason: `Dòng ${chunk[j].row_number} - SĐT ${rowPayload.phone}: ${rowError.message || rowError.details || rowError.code}` });
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

    setImportReport({
      imported: importedCount,
      skipped: parsedRows.filter((r) => r.import_action === "skip").length,
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
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Tải lên file CSV</h3>
              <p className="text-sm text-slate-500 max-w-sm mb-6">
                Chọn file chứa danh sách khách hàng. Chắc chắn rằng file của bạn có dòng tiêu đề (header row).
              </p>
              <input
                type="file"
                accept=".csv"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <div className="flex items-center gap-3">
                <Button onClick={() => fileInputRef.current?.click()}>
                  <UploadCloud className="w-4 h-4 mr-2" /> Chọn file từ máy tính
                </Button>
                <Button variant="outline" onClick={() => {
                  const csvContent = "phone,business_name,contact_name,email,province,city,source,facebook,zalo,website,tiktok,note,owner_sale_email,owner_sale_id\n0961234567,Demo Spa 1,Chị Lan,lan1@example.com,Hà Nội,Hà Nội,Facebook,https://facebook.com/demo1,0961234567,,,Khách quan tâm treatment,sale@example.com,";
                  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "customers_import_template.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                  <Download className="w-4 h-4 mr-2" /> Tải file mẫu
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
