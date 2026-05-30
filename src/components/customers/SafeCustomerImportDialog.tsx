import React, { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, ShieldAlert, ArrowRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  ParsedImportRow, mapImportRow, validateImportRow, detectDuplicateInFile, buildImportSummary
} from "@/lib/customers/importValidation";
import { Badge } from "@/components/ui/badge";

interface SafeCustomerImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReviewBatch?: (batchId: string) => void;
}

export function SafeCustomerImportDialog({ open, onOpenChange, onReviewBatch }: SafeCustomerImportDialogProps) {
  const { isAdminOrSubAdmin } = useAuth();
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState<'all' | 'valid' | 'invalid' | 'duplicate' | 'warning'>('all');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const [batchId, setBatchId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStep(1);
      setFile(null);
      setParsedRows([]);
      setSummary(null);
      setFilter('all');
      setIsProcessing(false);
      setProgress(0);
      setBatchId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  if (!isAdminOrSubAdmin) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <ShieldAlert className="w-5 h-5" /> Truy cập bị từ chối
            </DialogTitle>
            <DialogDescription>
              Bạn không có quyền import dữ liệu khách hàng. Chức năng này chỉ dành cho Quản lý.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end mt-4">
            <Button onClick={() => onOpenChange(false)}>Đóng</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Name", "Business Name", "Phone", "Email", "City", "Address", "Source", "Status", "Note"],
      ["Nguyễn Văn A", "Spa A", "0901234567", "a@example.com", "Hà Nội", "123 Cầu Giấy", "FACEBOOK", "Tiềm năng", "Cần tư vấn"]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Customer_Import_Template.xlsx");
  };

  const processFile = (selectedFile: File) => {
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File quá lớn. Vui lòng chọn file nhỏ hơn 10MB.");
      return;
    }
    
    setFile(selectedFile);
    setIsProcessing(true);
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        
        if (jsonData.length > 2000) {
          toast.error("File quá lớn, vui lòng chia nhỏ dưới 2.000 dòng.");
          setIsProcessing(false);
          setFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        if (jsonData.length === 0) {
          toast.error("File không có dữ liệu.");
          setIsProcessing(false);
          return;
        }

        // 1. Parse & basic map
        let rows = jsonData.map((r, i) => mapImportRow(r, i));
        
        // 2. Validate
        rows = rows.map(validateImportRow);
        
        // 3. Detect duplicate in file
        rows = detectDuplicateInFile(rows);

        // 4. Detect duplicate in database
        const phonesToCheck = rows.filter(r => r.normalized_phone).map(r => r.normalized_phone!);
        const emailsToCheck = rows.filter(r => r.normalized_email).map(r => r.normalized_email!);
        
        let existingCustomers: any[] = [];
        
        // Batch checking
        if (phonesToCheck.length > 0) {
          const { data: pData } = await supabase.from('customers').select('id, phone, normalized_phone').in('normalized_phone', phonesToCheck);
          if (pData) existingCustomers = [...existingCustomers, ...pData];
        }
        
        if (emailsToCheck.length > 0) {
          const { data: eData } = await supabase.from('customers').select('id, email, normalized_email').in('normalized_email', emailsToCheck);
          if (eData) existingCustomers = [...existingCustomers, ...eData];
        }

        // Check against existing
        rows = rows.map(r => {
          if (r.validation_status === 'invalid' || r.validation_status === 'duplicate') return r;
          
          let matchedId = null;
          if (r.normalized_phone) {
             const match = existingCustomers.find(ec => ec.normalized_phone === r.normalized_phone);
             if (match) matchedId = match.id;
          }
          if (!matchedId && r.normalized_email) {
             const match = existingCustomers.find(ec => ec.normalized_email === r.normalized_email);
             if (match) matchedId = match.id;
          }

          if (matchedId) {
             const errors = [...r.validation_errors];
             errors.push("Trùng lặp với dữ liệu trong hệ thống");
             return {
                ...r,
                validation_status: 'duplicate',
                validation_errors: errors,
                error_message: errors.join(" | "),
                duplicate_reason: "Trùng khách hàng đã có",
                matched_customer_id: matchedId,
                import_action: 'skip'
             };
          }
          return r;
        });

        setParsedRows(rows);
        setSummary(buildImportSummary(rows));
        setStep(2);
      } catch (err: any) {
        toast.error("Lỗi đọc file: " + err.message);
      } finally {
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      toast.error("Không thể đọc file.");
      setIsProcessing(false);
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSaveToStaging = async () => {
    setIsProcessing(true);
    setProgress(10);
    
    try {
      // Create batch
      const { data: batchData, error: batchError } = await supabase
        .from('customer_import_batches')
        .insert({
          file_name: file?.name || 'unknown_file.xlsx',
          total_rows: summary.total_rows,
          valid_rows: summary.valid_rows,
          invalid_rows: summary.invalid_rows,
          duplicate_rows: summary.duplicate_rows,
          status: 'staging',
          import_mode: 'staging_only'
        })
        .select('id')
        .single();
        
      if (batchError) throw batchError;
      
      const newBatchId = batchData.id;
      setBatchId(newBatchId);
      
      setProgress(30);

      // Chunk insert rows
      const chunkSize = 200;
      for (let i = 0; i < parsedRows.length; i += chunkSize) {
         const chunk = parsedRows.slice(i, i + chunkSize);
         const rowsPayload = chunk.map(r => ({
            batch_id: newBatchId,
            row_number: r.row_number,
            raw_data: r.raw_data,
            parsed_data: r.parsed_data,
            name: r.name,
            contact_name: r.contact_name,
            business_name: r.business_name,
            facility_name: r.facility_name,
            phone: r.phone,
            normalized_phone: r.normalized_phone,
            email: r.email,
            normalized_email: r.normalized_email,
            address: r.address,
            city: r.city,
            source: r.source,
            customer_channel: r.customer_channel,
            status: r.status,
            lifecycle_stage: r.lifecycle_stage,
            note: r.note,
            owner_sale_email: r.owner_sale_email,
            validation_status: r.validation_status,
            validation_errors: r.validation_errors,
            warning_message: r.warning_message,
            error_message: r.error_message,
            import_action: r.import_action,
            matched_customer_id: r.matched_customer_id,
            duplicate_reason: r.duplicate_reason,
            is_valid: r.validation_status === 'valid'
         }));
         
         const { error: chunkError } = await supabase.from('customer_import_rows').insert(rowsPayload);
         if (chunkError) throw chunkError;
         
         setProgress(30 + Math.floor((i / parsedRows.length) * 70));
      }
      
      setProgress(100);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi ghi staging: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRows = parsedRows.filter(r => {
    if (filter === 'all') return true;
    return r.validation_status === filter;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col overflow-hidden bg-slate-50">
        <DialogHeader className="bg-white p-6 border-b border-slate-200 -mx-6 -mt-6">
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-indigo-600" />
            Nhập dữ liệu khách hàng (Safe Import)
          </DialogTitle>
          <DialogDescription>
             Luồng import an toàn 3 bước. Hệ thống sẽ phân tích, kiểm tra trùng lặp và đưa vào Staging.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-2">
          {step === 1 && (
            <div className="p-8">
               <div className="max-w-lg mx-auto bg-white border border-dashed border-slate-300 rounded-2xl p-10 text-center shadow-sm">
                  <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <FileSpreadsheet className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2">Tải lên file dữ liệu</h3>
                  <p className="text-sm text-slate-500 mb-6">
                     Hỗ trợ file CSV, XLSX (Tối đa 2.000 dòng).<br/>
                     Cột bắt buộc: Name (hoặc Contact Name), Phone hoặc Email.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                     <input 
                       type="file" 
                       accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                       className="hidden" 
                       ref={fileInputRef}
                       onChange={(e) => {
                         if (e.target.files && e.target.files.length > 0) {
                           processFile(e.target.files[0]);
                         }
                       }}
                     />
                     <Button 
                       disabled={isProcessing}
                       onClick={() => fileInputRef.current?.click()}
                       className="bg-indigo-600 hover:bg-indigo-700 w-full"
                     >
                       {isProcessing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
                       {isProcessing ? "Đang xử lý..." : "Chọn file Upload"}
                     </Button>
                     <Button variant="outline" onClick={handleDownloadTemplate} className="w-full text-slate-600">
                        <Download className="w-4 h-4 mr-2" /> Tải Template Mẫu
                     </Button>
                  </div>
               </div>
            </div>
          )}

          {step === 2 && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-center">
                    <div className="text-xs font-bold text-slate-500 uppercase">Tổng dòng</div>
                    <div className="text-2xl font-black text-slate-800">{summary.total_rows}</div>
                 </div>
                 <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm text-center">
                    <div className="text-xs font-bold text-emerald-600 uppercase">Hợp lệ</div>
                    <div className="text-2xl font-black text-emerald-700">{summary.valid_rows}</div>
                 </div>
                 <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 shadow-sm text-center">
                    <div className="text-xs font-bold text-rose-600 uppercase">Lỗi (Invalid)</div>
                    <div className="text-2xl font-black text-rose-700">{summary.invalid_rows}</div>
                 </div>
                 <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm text-center">
                    <div className="text-xs font-bold text-amber-600 uppercase">Trùng lặp</div>
                    <div className="text-2xl font-black text-amber-700">{summary.duplicate_rows}</div>
                 </div>
                 <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm text-center">
                    <div className="text-xs font-bold text-blue-600 uppercase">Cảnh báo</div>
                    <div className="text-2xl font-black text-blue-700">{summary.warning_rows}</div>
                 </div>
              </div>
              
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px]">
                 <div className="p-3 border-b border-slate-100 bg-slate-50 flex gap-2">
                    {(['all', 'valid', 'invalid', 'duplicate', 'warning'] as const).map(f => (
                       <Button 
                         key={f} 
                         variant={filter === f ? 'default' : 'outline'} 
                         size="sm"
                         className={`text-xs h-7 ${filter === f ? 'bg-indigo-600 text-white' : 'bg-white'}`}
                         onClick={() => setFilter(f)}
                       >
                          {f === 'all' && 'Tất cả'}
                          {f === 'valid' && 'Hợp lệ'}
                          {f === 'invalid' && 'Lỗi'}
                          {f === 'duplicate' && 'Trùng lặp'}
                          {f === 'warning' && 'Cảnh báo'}
                       </Button>
                    ))}
                 </div>
                 <div className="flex-1 overflow-auto p-0">
                    <table className="w-full text-left text-[11px] whitespace-nowrap">
                       <thead className="bg-slate-100 sticky top-0 text-slate-500 font-bold uppercase z-10">
                          <tr>
                             <th className="px-4 py-2 border-b">Row</th>
                             <th className="px-4 py-2 border-b">Name / Business</th>
                             <th className="px-4 py-2 border-b">Phone</th>
                             <th className="px-4 py-2 border-b">Email</th>
                             <th className="px-4 py-2 border-b">Status</th>
                             <th className="px-4 py-2 border-b">Action</th>
                             <th className="px-4 py-2 border-b w-full">Ghi chú</th>
                          </tr>
                       </thead>
                       <tbody>
                          {filteredRows.slice(0, 50).map((r, i) => (
                             <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                <td className="px-4 py-2 font-medium text-slate-500">{r.row_number}</td>
                                <td className="px-4 py-2">
                                   <div className="font-bold text-slate-800">{r.name || r.contact_name || '-'}</div>
                                   <div className="text-slate-500">{r.business_name || r.facility_name}</div>
                                </td>
                                <td className="px-4 py-2">{r.phone || '-'}</td>
                                <td className="px-4 py-2">{r.email || '-'}</td>
                                <td className="px-4 py-2">
                                   {r.validation_status === 'valid' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 shadow-none border-none">Valid</Badge>}
                                   {r.validation_status === 'invalid' && <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 shadow-none border-none">Invalid</Badge>}
                                   {r.validation_status === 'duplicate' && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 shadow-none border-none">Duplicate</Badge>}
                                   {r.validation_status === 'warning' && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 shadow-none border-none">Warning</Badge>}
                                </td>
                                <td className="px-4 py-2">
                                   <span className="uppercase text-[9px] font-bold text-slate-400">{r.import_action}</span>
                                </td>
                                <td className="px-4 py-2">
                                   {r.error_message && <div className="text-rose-600 flex items-center gap-1"><XCircle className="w-3 h-3"/> {r.error_message}</div>}
                                   {r.warning_message && <div className="text-blue-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> {r.warning_message}</div>}
                                </td>
                             </tr>
                          ))}
                       </tbody>
                    </table>
                    {filteredRows.length > 50 && (
                       <div className="text-center py-4 text-[11px] text-slate-500 bg-slate-50 border-t border-slate-100">
                          Hiển thị 50 dòng đầu tiên. (Còn {filteredRows.length - 50} dòng)
                       </div>
                    )}
                 </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="p-8">
               <div className="max-w-lg mx-auto bg-white border border-emerald-200 rounded-2xl p-10 text-center shadow-sm">
                  <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                     <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-emerald-800 mb-2">Đã lưu vào Staging thành công</h3>
                  <p className="text-sm text-slate-500 mb-6">
                     Batch ID: <span className="font-mono bg-slate-100 px-1 py-0.5 rounded text-xs">{batchId}</span>
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 mb-6 text-left">
                     <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tổng số dòng</span>
                        <span className="text-sm font-black text-slate-700">{summary?.total_rows}</span>
                     </div>
                     <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase block mb-1">Sẵn sàng import</span>
                        <span className="text-sm font-black text-emerald-700">{summary?.valid_rows}</span>
                     </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-[11px] text-amber-800 text-left mb-6">
                     <AlertTriangle className="w-4 h-4 inline-block mr-1 mb-0.5" />
                     <strong>Lưu ý:</strong> Dữ liệu đang ở vùng đệm chờ duyệt. Vui lòng chuyển sang bước Review để kiểm tra lại và Confirm Import.
                  </div>

                  <div className="flex gap-3">
                     <Button onClick={() => onOpenChange(false)} variant="outline" className="flex-1">
                        Đóng cửa sổ
                     </Button>
                     {onReviewBatch && (
                        <Button 
                           onClick={() => {
                              onOpenChange(false);
                              if (batchId) onReviewBatch(batchId);
                           }} 
                           className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                           Review & Confirm <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                     )}
                  </div>
               </div>
            </div>
          )}
        </div>

        {step === 2 && (
          <DialogFooter className="bg-white p-4 border-t border-slate-200 -mx-6 -mb-6 mt-0">
             <div className="w-full flex justify-between items-center">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={isProcessing}>Quay lại</Button>
                <div className="flex gap-2 items-center">
                   {isProcessing && <div className="text-[11px] font-medium text-slate-500 mr-2 flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1"/> Đang lưu Staging {progress}%</div>}
                   <Button onClick={handleSaveToStaging} disabled={isProcessing || parsedRows.length === 0} className="bg-indigo-600 hover:bg-indigo-700">
                      Lưu vào Staging <ArrowRight className="w-4 h-4 ml-2" />
                   </Button>
                </div>
             </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
