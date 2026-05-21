import React, { useState, useEffect, useRef } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ShieldAlert, 
  RefreshCw, 
  Database, 
  ArrowRight, 
  Download, 
  Table, 
  Play, 
  ChevronRight,
  Sparkles,
  HelpCircle,
  Undo
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { 
  Table as TableComponent, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableCell, 
  TableHead 
} from '@/components/ui/table';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  parseRawText,
  getNormalizedKey,
  validateRow,
  executeImport,
  DuplicateAction,
  SourceType,
  ValidationError,
  ImportResult
} from '@/lib/productKnowledgeImport';

export const Route = createFileRoute('/admin/product-import')({
  component: ProductImportPage,
});

const SCHEMA_FIELDS = [
  { key: 'product_id', label: 'ID Sản phẩm (Mã)', required: true, description: 'Số nguyên dương liên kết với sản phẩm' },
  { key: 'benefits', label: 'Lợi ích sản phẩm', required: true, description: 'Mô tả chi tiết các lợi ích' },
  { key: 'usage_instructions', label: 'Hướng dẫn sử dụng', required: true, description: 'Cách dùng, liều lượng, tần suất' },
  { key: 'sales_pitch', label: 'Lời khuyên bán hàng', required: true, description: 'Kịch bản/pitch bán hàng nhanh' },
  { key: 'skin_concerns', label: 'Tình trạng da phù hợp', required: false, description: 'Mảng/Danh sách tình trạng da' },
  { key: 'suitable_spa_types', label: 'Loại hình Spa phù hợp', required: false, description: 'Mảng/Danh sách loại hình Spa' },
  { key: 'cross_sell_products', label: 'Sản phẩm bán kèm (ID)', required: false, description: 'Mảng số nguyên ID sản phẩm' },
  { key: 'restock_cycle_days', label: 'Chu kỳ đặt hàng (ngày)', required: false, description: 'Số ngày chu kỳ mua hàng' },
  { key: 'warnings', label: 'Lưu ý & Chống chỉ định', required: false, description: 'Các cảnh báo sử dụng' },
  { key: 'is_active', label: 'Đang hoạt động (Kích hoạt)', required: false, description: 'Đánh dấu bản ghi có hiệu lực' },
  { key: 'ingredient_highlights', label: 'Thành phần nổi bật', required: false, description: 'Mảng/Danh sách thành phần chính' },
  { key: 'skin_types', label: 'Loại da phù hợp', required: false, description: 'Mảng/Danh sách loại da' },
  { key: 'pregnancy_safe', label: 'An toàn cho bà bầu', required: false, description: 'Giá trị boolean có/không' },
  { key: 'routine_position', label: 'Vị trí chu trình skincare', required: false, description: 'Thứ tự trong chu trình' },
];

function ProductImportPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  
  // Wizard Steps
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Input states
  const [sourceType, setSourceType] = useState<SourceType>('csv');
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [parsedRawData, setParsedRawData] = useState<any[]>([]);
  const [sourceHeaders, setSourceHeaders] = useState<string[]>([]);
  
  // Mapping state: schema_field_key -> source_header_name
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [duplicateAction, setDuplicateAction] = useState<DuplicateAction>('overwrite');
  
  // Status and Results
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAuthorized = isAdmin || isSubAdmin;

  // Auto-map headers when parsed data changes
  useEffect(() => {
    if (parsedRawData.length > 0) {
      // Get all unique keys in the parsed data
      const headers = Array.from(
        new Set(parsedRawData.flatMap(row => Object.keys(row)))
      ).filter(h => h.trim() !== '');

      setSourceHeaders(headers);

      // Auto map logic based on normalized matches
      const newMappings: Record<string, string> = {};
      
      SCHEMA_FIELDS.forEach(field => {
        // Try to find a header that matches
        const match = headers.find(h => getNormalizedKey(h) === field.key);
        if (match) {
          newMappings[field.key] = match;
        }
      });
      setMappings(newMappings);
    } else {
      setSourceHeaders([]);
      setMappings({});
    }
  }, [parsedRawData]);

  if (authLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-slate-50/50">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang xác thực quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-2xl flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">
          Giao diện Import Tri thức sản phẩm chỉ dành cho quản trị viên (Admin/Sub Admin). Nhân sự Sale hoặc Telesale không được phép truy cập.
        </p>
        <Link to="/workspace" className="mt-6">
          <Button className="bg-slate-900 hover:bg-black rounded-xl text-xs font-bold px-6 py-2.5">
            Quay lại Workspace
          </Button>
        </Link>
      </div>
    );
  }

  // Handle file select and parsing
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    
    if (file.type === 'application/json' || file.name.endsWith('.json')) {
      setSourceType('json');
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          const arrayData = Array.isArray(json) ? json : [json];
          setParsedRawData(arrayData);
          toast.success(`Đã tải file JSON: ${arrayData.length} dòng`);
          setStep(2);
        } catch (err: any) {
          toast.error('Lỗi cú pháp JSON: ' + err.message);
        }
      };
      reader.readAsText(file);
    } else {
      setSourceType('csv');
      Papa.parse(file, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (results.errors.length > 0) {
            console.warn('Cảnh báo CSV parse:', results.errors);
          }
          if (results.data && results.data.length > 0) {
            setParsedRawData(results.data);
            toast.success(`Đã đọc file CSV: ${results.data.length} dòng`);
            setStep(2);
          } else {
            toast.error('File CSV trống hoặc định dạng không hợp lệ.');
          }
        },
        error: (err) => {
          toast.error('Lỗi đọc file CSV: ' + err.message);
        }
      });
    }
  };

  // Handle pasted text parsing
  const handleParseText = () => {
    if (!rawText.trim()) {
      toast.error('Vui lòng nhập/dán dữ liệu trước.');
      return;
    }

    try {
      const data = parseRawText(rawText);
      if (data && data.length > 0) {
        setParsedRawData(data);
        toast.success(`Đã phân tích text block: ${data.length} sản phẩm`);
        setStep(2);
      } else {
        toast.error('Không tìm thấy dữ liệu hợp lệ trong nội dung đã dán.');
      }
    } catch (e: any) {
      toast.error('Lỗi phân tích cú pháp: ' + e.message);
    }
  };

  // Build the mapped data object for validation and previews
  const getMappedRow = (rawRow: any) => {
    const mapped: Record<string, any> = {};
    Object.keys(mappings).forEach(schemaKey => {
      const sourceHeader = mappings[schemaKey];
      if (sourceHeader) {
        mapped[schemaKey] = rawRow[sourceHeader];
      }
    });
    return mapped;
  };

  // Reset import center state to Step 1
  const handleReset = () => {
    setStep(1);
    setFileName('');
    setRawText('');
    setParsedRawData([]);
    setSourceHeaders([]);
    setMappings({});
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Execute DB import
  const handleStartImport = async () => {
    // 1. Confirm required fields are mapped
    const unmappedRequired = SCHEMA_FIELDS.filter(f => f.required && !mappings[f.key]);
    if (unmappedRequired.length > 0) {
      toast.error(`Cần ánh xạ các trường bắt buộc: ${unmappedRequired.map(f => f.label).join(', ')}`);
      return;
    }

    setIsProcessing(true);
    toast.info('Đang tiến hành import dữ liệu...');

    try {
      // Convert raw parsed data rows using mapping
      const mappedRows = parsedRawData.map(raw => getMappedRow(raw));
      
      const result = await executeImport(
        mappedRows,
        duplicateAction,
        sourceType,
        fileName || 'raw_text_input'
      );

      setImportResult(result);
      setIsProcessing(false);
      setStep(3);

      if (result.errorCount > 0) {
        toast.warning(`Import hoàn tất: ${result.successCount} thành công, ${result.errorCount} lỗi.`);
      } else {
        toast.success(`Đã import thành công ${result.successCount} sản phẩm!`);
      }
    } catch (err: any) {
      setIsProcessing(false);
      toast.error('Lỗi nghiêm trọng khi import: ' + err.message);
    }
  };

  // Generate and download validation/database error CSV
  const handleDownloadErrorCsv = () => {
    if (!importResult || importResult.errors.length === 0) return;

    const errorCsvData = importResult.errors.map(err => ({
      'Dòng': err.rowNumber === -1 ? 'DB Error' : err.rowNumber,
      'Mã Sản Phẩm': err.productId || 'N/A',
      'Trường lỗi': err.field || 'N/A',
      'Chi tiết lỗi': err.message,
      'Dữ liệu gốc': JSON.stringify(err.rawRow),
    }));

    const csv = Papa.unparse(errorCsvData);
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `import_errors_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Database className="w-7 h-7 text-indigo-600" />
            Trung Tâm Import Tri Thức Sản Phẩm
          </h1>
          <p className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">
            Phase G — Product Knowledge Import/Upload Center
          </p>
        </div>
        <div className="flex items-center gap-2">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={handleReset} className="rounded-xl border-slate-200">
              <Undo className="w-3.5 h-3.5 mr-1.5" /> Làm lại từ đầu
            </Button>
          )}
          <Link to="/workspace">
            <Button variant="outline" size="sm" className="rounded-xl border-slate-200">
              Về Workspace
            </Button>
          </Link>
        </div>
      </div>

      {/* Process Pipeline Notice Card */}
      <Card className="bg-slate-50 border-slate-200/80 shadow-sm overflow-hidden">
        <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500" />
              Quy Trình Kiểm Soát Tri Thức Sản Phẩm
            </div>
            <p className="text-xs text-slate-650 leading-relaxed max-w-3xl">
              Dữ liệu được nhập sẽ mặc định ở trạng thái <strong>Draft (Nháp)</strong>. AI Product Tutor chỉ có thể tra cứu và truy xuất (retrieval) đối với các thông tin đã được kiểm duyệt và chuyển trạng thái sang <strong>Approved (Đã duyệt)</strong>. Quá trình sinh chunk và tạo vector embedding chỉ được thực hiện sau bước duyệt.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-800 uppercase tracking-widest shrink-0 self-stretch bg-indigo-50/50 rounded-xl px-4 py-2 justify-center border border-indigo-100">
            <span>Import (Draft)</span>
            <ChevronRight className="w-3 h-3 text-indigo-400" />
            <span>Duyệt (Approved)</span>
            <ChevronRight className="w-3 h-3 text-indigo-400" />
            <span>AI Retrieve</span>
          </div>
        </CardContent>
      </Card>

      {/* Step Indicators */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-3 rounded-2xl border text-center transition-all ${step === 1 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-150' : 'bg-white text-slate-500 border-slate-200'}`}>
          <div className="text-[10px] font-black uppercase tracking-wider">Bước 1</div>
          <div className="text-xs font-bold mt-1">Chọn nguồn & Tải file</div>
        </div>
        <div className={`p-3 rounded-2xl border text-center transition-all ${step === 2 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-150' : 'bg-white text-slate-500 border-slate-200'}`}>
          <div className="text-[10px] font-black uppercase tracking-wider">Bước 2</div>
          <div className="text-xs font-bold mt-1">Ánh xạ & Xem trước</div>
        </div>
        <div className={`p-3 rounded-2xl border text-center transition-all ${step === 3 ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-150' : 'bg-white text-slate-500 border-slate-200'}`}>
          <div className="text-[10px] font-black uppercase tracking-wider">Bước 3</div>
          <div className="text-xs font-bold mt-1">Kết quả Import</div>
        </div>
      </div>

      {/* Step 1 Content: Source Selector & Upload */}
      {step === 1 && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-800">Chọn nguồn dữ liệu tri thức</CardTitle>
            <CardDescription>Nhập dữ liệu tri thức hàng loạt thông qua File Excel/CSV, JSON hoặc văn bản tự do.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="file" className="w-full">
              <TabsList className="grid grid-cols-2 mb-6">
                <TabsTrigger value="file" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" /> Upload File (CSV / JSON)
                </TabsTrigger>
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Copy / Paste Text Block
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-indigo-200 bg-indigo-50/20 hover:bg-indigo-50/50 hover:border-indigo-400 transition-all rounded-3xl p-10 text-center cursor-pointer flex flex-col items-center justify-center"
                >
                  <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 mb-3 shadow-inner">
                    <Upload className="w-6 h-6 animate-pulse" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Chọn file CSV hoặc JSON</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">
                    Hỗ trợ file CSV mã hóa UTF-8, ngăn cách bằng dấu phẩy, hoặc file JSON dạng mảng sản phẩm.
                  </p>
                  <Button variant="outline" className="bg-white border-slate-200 text-xs font-bold shadow-sm rounded-xl">
                    Tìm file máy tính
                  </Button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange}
                    accept=".csv,.json,text/csv,application/json" 
                    className="hidden" 
                  />
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="rawText" className="text-xs font-bold text-slate-700">Dán khối văn bản tri thức (JSON, TSV hoặc Key-Value)</Label>
                  <textarea
                    id="rawText"
                    rows={12}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Cách 1: Định dạng JSON mảng
[
  { "product_id": 101, "benefits": "Giảm mụn nhang chóng", "usage_instructions": "Bôi tối", "sales_pitch": "Mua ngay đi" }
]

Cách 2: Định dạng Key-Value (Thích hợp copy từ chatbot/docs)
product_id: 102
benefits: Chống lão hoá chuyên sâu
usage_instructions: Dùng ngày 2 lần sáng tối
sales_pitch: Thích hợp cho da trung niên.`}
                    className="w-full rounded-2xl border border-slate-200 p-4 text-xs font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleParseText} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-5 text-xs font-bold">
                    Phân tích dữ liệu <ArrowRight className="w-4 h-4 ml-1.5" />
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Step 2 Content: Column Mappings & Previews */}
      {step === 2 && parsedRawData.length > 0 && (
        <div className="space-y-6">
          
          {/* Mapping settings card */}
          <Card className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Table className="w-5 h-5 text-indigo-600" />
                Thiết lập ánh xạ cột (Field Mapping)
              </CardTitle>
              <CardDescription>
                Hệ thống tự động phát hiện cột trùng tên viết tắt. Hãy cấu hình thủ công nếu tên cột trong file khác với cấu trúc dữ liệu tri thức.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              
              {/* Target Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                {SCHEMA_FIELDS.map(field => {
                  const isMapped = !!mappings[field.key];
                  return (
                    <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/30">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800">{field.label}</span>
                          {field.required && (
                            <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-1.5 py-0.2 rounded uppercase">Bắt buộc</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">{field.description}</p>
                      </div>
                      <div className="w-full sm:w-56 shrink-0">
                        <Select 
                          value={mappings[field.key] || 'unmapped'} 
                          onValueChange={(val) => {
                            setMappings(prev => {
                              const copy = { ...prev };
                              if (val === 'unmapped') {
                                delete copy[field.key];
                              } else {
                                copy[field.key] = val;
                              }
                              return copy;
                            });
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg border-slate-200">
                            <SelectValue placeholder="--- Không ánh xạ ---" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unmapped" className="text-xs text-rose-600 font-medium">--- Không ánh xạ ---</SelectItem>
                            {sourceHeaders.map(header => (
                              <SelectItem key={header} value={header} className="text-xs">
                                {header}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Duplicate handling settings */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <Label className="text-xs font-black text-slate-700 uppercase tracking-wide">Xử lý ID sản phẩm đã tồn tại:</Label>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm"
                      type="button"
                      variant={duplicateAction === 'skip' ? 'default' : 'outline'}
                      onClick={() => setDuplicateAction('skip')}
                      className={`h-8 rounded-lg text-xs font-bold ${duplicateAction === 'skip' ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-slate-200 text-slate-700'}`}
                    >
                      Bỏ qua (Skip)
                    </Button>
                    <Button 
                      size="sm"
                      type="button"
                      variant={duplicateAction === 'overwrite' ? 'default' : 'outline'}
                      onClick={() => setDuplicateAction('overwrite')}
                      className={`h-8 rounded-lg text-xs font-bold ${duplicateAction === 'overwrite' ? 'bg-indigo-600 hover:bg-indigo-700' : 'border-slate-200 text-slate-700'}`}
                    >
                      Ghi đè (Overwrite / Reset Draft)
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleReset} className="rounded-xl border-slate-200 text-xs font-bold">
                    Huỷ
                  </Button>
                  <Button 
                    onClick={handleStartImport} 
                    disabled={isProcessing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-6 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-indigo-150"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Đang import...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Bắt đầu Import
                      </>
                    )}
                  </Button>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* Data Preview Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Table className="w-4 h-4 text-indigo-500" />
                Xem trước dữ liệu ánh xạ (Tối đa 10 dòng)
              </CardTitle>
              <CardDescription>
                Bảng hiển thị cách dữ liệu nguồn sẽ được chuẩn hóa trước khi đẩy vào database. Cột có nhãn màu đỏ biểu thị trường bắt buộc chưa được ánh xạ.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <TableComponent>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="w-12 text-center text-xs font-black text-slate-650">Dòng</TableHead>
                    {SCHEMA_FIELDS.map(f => (
                      <TableHead key={f.key} className="text-xs font-black text-slate-650 min-w-36">
                        {f.label}
                        {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRawData.slice(0, 10).map((raw, idx) => {
                    const rowNumber = idx + 1;
                    const mapped = getMappedRow(raw);
                    const { error, parsedRow } = validateRow(mapped, rowNumber);

                    return (
                      <TableRow key={idx} className={error ? 'bg-rose-50/30' : ''}>
                        <TableCell className="text-center font-bold text-xs text-slate-400">{rowNumber}</TableCell>
                        
                        {/* Map each schema field value */}
                        {SCHEMA_FIELDS.map(field => {
                          const isMapped = !!mappings[field.key];
                          const rawVal = mapped[field.key];
                          
                          let displayVal = rawVal !== undefined && rawVal !== null ? String(rawVal) : '';
                          
                          // Truncate long texts for preview
                          if (displayVal.length > 50) {
                            displayVal = displayVal.substring(0, 50) + '...';
                          }

                          // Highlighting validation status
                          if (!isMapped) {
                            return (
                              <TableCell key={field.key} className="text-xs text-slate-450 italic bg-slate-50/40">
                                {field.required ? (
                                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50/80 px-1 py-0.5 rounded">Chưa cấu hình cột</span>
                                ) : (
                                  'Trống'
                                )}
                              </TableCell>
                            );
                          }

                          // If this specific field causes a validation error
                          const isFieldError = error?.field === field.key;

                          return (
                            <TableCell key={field.key} className={`text-xs font-medium text-slate-700 ${isFieldError ? 'text-rose-600 font-bold bg-rose-50/50' : ''}`}>
                              {displayVal || <span className="text-slate-400 italic">Trống</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </TableComponent>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Step 3 Content: Import Results */}
      {step === 3 && importResult && (
        <Card className="border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" /> Báo cáo kết quả Import
            </CardTitle>
            <CardDescription>Quá trình nhập dữ liệu tri thức vào cơ sở dữ liệu đã hoàn tất.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50 text-center">
                <div className="text-xs font-medium text-slate-500">Tổng số dòng xử lý</div>
                <div className="text-2xl font-black text-slate-800 mt-1">{importResult.totalRows}</div>
              </div>
              <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 text-center">
                <div className="text-xs font-medium text-emerald-600">Thành công (Draft)</div>
                <div className="text-2xl font-black text-emerald-700 mt-1">{importResult.successCount}</div>
              </div>
              <div className="p-4 rounded-2xl border border-amber-100 bg-amber-50/40 text-center">
                <div className="text-xs font-medium text-amber-600">Bỏ qua (Trùng lặp)</div>
                <div className="text-2xl font-black text-amber-700 mt-1">{importResult.warningCount}</div>
              </div>
              <div className="p-4 rounded-2xl border border-rose-100 bg-rose-50/40 text-center">
                <div className="text-xs font-medium text-rose-600">Lỗi biên dịch / DB</div>
                <div className="text-2xl font-black text-rose-700 mt-1">{importResult.errorCount}</div>
              </div>
            </div>

            {/* Error display if any */}
            {importResult.errors.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
                    <AlertCircle className="w-4 h-4 text-rose-500" /> Danh sách lỗi ({importResult.errors.length})
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    onClick={handleDownloadErrorCsv}
                    className="border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold rounded-xl h-8"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Tải CSV báo lỗi
                  </Button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-rose-100 rounded-2xl divide-y divide-rose-50/50 bg-rose-50/10">
                  {importResult.errors.map((err, idx) => (
                    <div key={idx} className="p-3 text-xs flex items-start gap-2.5">
                      <span className="font-extrabold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded text-[10px]">
                        {err.rowNumber === -1 ? 'DB' : `Dòng ${err.rowNumber}`}
                      </span>
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-800">
                          {err.productId ? `Sản phẩm ID: ${err.productId}` : ''} 
                          {err.field ? ` [Cột: ${err.field}]` : ''}
                        </p>
                        <p className="text-rose-750 font-medium leading-relaxed">{err.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings list if any */}
            {importResult.warnings.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  ⚠️ Danh sách cảnh báo ({importResult.warnings.length})
                </div>
                <div className="max-h-40 overflow-y-auto border border-amber-100 rounded-2xl divide-y divide-amber-50/50 bg-amber-50/10 p-2 space-y-1">
                  {importResult.warnings.map((warn, idx) => (
                    <div key={idx} className="p-2 text-xs text-amber-800 font-medium">
                      {warn}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Operations complete options */}
            <div className="border-t border-slate-100 pt-5 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                Mã log audit: <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{importResult.logId || 'Không ghi nhận'}</code>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleReset} className="rounded-xl border-slate-200 text-xs font-bold">
                  Import thêm file khác
                </Button>
                <Link to="/admin/products">
                  <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold">
                    Tới trang Quản lý tri thức
                  </Button>
                </Link>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

    </div>
  );
}
