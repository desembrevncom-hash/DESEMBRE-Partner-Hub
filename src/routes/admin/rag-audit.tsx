import React, { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Search, Database, MessageSquare, ClipboardCheck, BarChart3, AlertTriangle, 
  CheckCircle2, XCircle, Info, Sparkles, HelpCircle, ArrowRight
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const Route = createFileRoute('/admin/rag-audit')({
  component: RAGAuditPage
});

const presetGroups = [
  {
    id: "skin_type",
    label: "Nhóm: Loại da",
    questions: [
      "Khách da dầu nhiều mụn đầu đen nên dùng sữa rửa mặt nào?",
      "Da khô bong tróc vào mùa đông cần dưỡng ẩm như thế nào?",
      "Khách da cực kỳ nhạy cảm và mỏng yếu có dùng được sữa rửa mặt không?",
      "Da hỗn hợp thiên dầu lỗ chân lông to nên chăm sóc bằng sản phẩm gì?",
      "Da không đều màu và sạm nên kết hợp các sản phẩm nào?"
    ]
  },
  {
    id: "concern",
    label: "Nhóm: Vấn đề da",
    questions: [
      "Liệu trình cho da mụn ẩn và mụn viêm đỏ nên dùng gì?",
      "Spa trị nám nên dùng sản phẩm nào để ức chế sắc tố hiệu quả?",
      "Sản phẩm nào tốt nhất để phục hồi da sau khi lăn kim, phi kim?",
      "Kem dưỡng nào giúp mờ nếp nhăn và săn chắc da cho tuổi 40?",
      "Làm thế nào để thu nhỏ lỗ chân lông hiệu quả với sản phẩm Desembre?"
    ]
  },
  {
    id: "safety",
    label: "Nhóm: An toàn",
    questions: [
      "Bà bầu có dùng được nước tẩy trang và sữa rửa mặt này không?",
      "Da đang dùng retinol/tre và bị đỏ rát thì nên thoa gì?",
      "Khách bị kích ứng nổi mẩn đỏ sau khi test mỹ phẩm nên xử lý sao?",
      "Học sinh dậy thì da dầu mụn có dùng sữa rửa mặt dịu nhẹ được không?",
      "Có sản phẩm nào bôi được lên vết thương hở sau nặn mụn không?"
    ]
  },
  {
    id: "sales",
    label: "Nhóm: Bán hàng & Xử lý từ chối",
    questions: [
      "Khách mua sữa rửa mặt, làm thế nào để upsell thêm toner cấp ẩm?",
      "Sản phẩm nào thường được bán kèm với serum trị mụn để tăng hiệu quả?",
      "Khách bảo sản phẩm Desembre đắt quá, dùng loại khác rẻ hơn?",
      "Khách chê sữa rửa mặt không bọt rửa cảm giác không sạch?",
      "Cách tư vấn gói combo chăm sóc da tại spa để giữ chân khách hàng?"
    ]
  }
];

function RAGAuditPage() {
  const { isAdminOrSubAdmin } = useAuth();
  
  // Test controls
  const [query, setQuery] = useState('');
  const [selectedMode, setSelectedMode] = useState('product_tutor');
  const [threshold, setThreshold] = useState(0.5);
  const [isLoading, setIsLoading] = useState(false);

  // Result state
  const [retrievedChunks, setRetrievedChunks] = useState<any[]>([]);
  const [finalAnswer, setFinalAnswer] = useState('');
  const [tokenUsage, setTokenUsage] = useState<any>(null);
  const [modelUsed, setModelUsed] = useState('');
  const [provider, setProvider] = useState('');

  // Evaluation state
  const [evaluation, setEvaluation] = useState({
    correct_retrieve: false,
    wrong_retrieve: false,
    hallucination: false,
    partial_answer: false,
    missing_knowledge: false,
    notes: ''
  });

  // Logging & Summary stats
  const [logs, setLogs] = useState<any[]>([]);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  // Mode label map
  const modeLabels: Record<string, string> = {
    product_tutor: "Product Tutor",
    objection_handling: "Objection Handling",
    usage_script: "Usage Script",
    compare_products: "Compare Products"
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setIsStatsLoading(true);
    try {
      const { data, error } = await supabase
        .from('rag_audit_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (e: any) {
      console.error(e);
      toast.error('Lỗi khi tải lịch sử audit.');
    } finally {
      setIsStatsLoading(false);
    }
  };

  const handleRunAudit = async () => {
    if (!query.trim()) {
      toast.warning('Vui lòng nhập câu hỏi để test.');
      return;
    }

    setIsLoading(true);
    // Reset states
    setRetrievedChunks([]);
    setFinalAnswer('');
    setTokenUsage(null);
    setModelUsed('');
    setProvider('');
    setEvaluation({
      correct_retrieve: false,
      wrong_retrieve: false,
      hallucination: false,
      partial_answer: false,
      missing_knowledge: false,
      notes: ''
    });

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sales-assistant`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          mode: 'rag_audit', 
          query, 
          auditMode: selectedMode, 
          threshold 
        })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Lỗi gọi Edge Function RAG Audit');

      setRetrievedChunks(result.retrieved_chunks || []);
      setFinalAnswer(result.final_answer || '');
      setTokenUsage({
        prompt: result.prompt_tokens || 0,
        completion: result.completion_tokens || 0,
        total: result.total_tokens || 0
      });
      setModelUsed(result.model_used || 'N/A');
      setProvider(result.provider || 'N/A');
      
      toast.success('Băm vector và truy vấn AI thành công!');
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Lỗi hệ thống khi gọi AI.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvaluation = async () => {
    if (!finalAnswer && retrievedChunks.length === 0) {
      toast.warning('Chưa chạy test câu hỏi, không có dữ liệu để lưu log.');
      return;
    }

    // Check if at least one checkbox is ticked (optional, but good practice)
    const isAnyTicked = Object.values(evaluation).some(val => val === true);
    if (!isAnyTicked) {
      toast.warning('Vui lòng đánh dấu ít nhất một tiêu chí đánh giá.');
      return;
    }

    setIsSavingLog(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const logData = {
        query,
        selected_mode: selectedMode,
        similarity_threshold: threshold,
        retrieved_chunks: retrievedChunks,
        final_answer: finalAnswer,
        evaluation: evaluation,
        created_by: user?.id || null
      };

      const { error } = await supabase
        .from('rag_audit_logs')
        .insert(logData);

      if (error) throw error;

      toast.success('Đã lưu kết quả đánh giá audit!');
      // Reset evaluations
      setEvaluation({
        correct_retrieve: false,
        wrong_retrieve: false,
        hallucination: false,
        partial_answer: false,
        missing_knowledge: false,
        notes: ''
      });
      fetchLogs(); // Reload statistics
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Lỗi lưu log đánh giá.');
    } finally {
      setIsSavingLog(false);
    }
  };

  // Compute stats
  const stats = (() => {
    if (logs.length === 0) {
      return {
        total: 0,
        correctRate: 0,
        wrongRate: 0,
        hallucinationCount: 0,
        missingKnowledgeCount: 0,
        bestThreshold: "N/A",
        worstThreshold: "N/A",
        mostBuggyMode: "N/A",
        byThreshold: [],
        byMode: []
      };
    }

    const total = logs.length;
    let correctCount = 0;
    let wrongCount = 0;
    let hallucinationCount = 0;
    let missingKnowledgeCount = 0;

    const thresholdGroups: Record<number, { total: number; correct: number; wrong: number; hallucination: number; missing: number }> = {
      0.5: { total: 0, correct: 0, wrong: 0, hallucination: 0, missing: 0 },
      0.7: { total: 0, correct: 0, wrong: 0, hallucination: 0, missing: 0 },
      0.8: { total: 0, correct: 0, wrong: 0, hallucination: 0, missing: 0 },
      0.9: { total: 0, correct: 0, wrong: 0, hallucination: 0, missing: 0 },
    };

    const modeGroups: Record<string, { total: number; correct: number; wrong: number; hallucination: number; missing: number; errors: number }> = {};

    logs.forEach((log) => {
      const evalData = log.evaluation || {};
      const isCorrect = !!evalData.correct_retrieve;
      const isWrong = !!evalData.wrong_retrieve;
      const isHallu = !!evalData.hallucination;
      const isMissing = !!evalData.missing_knowledge;
      
      if (isCorrect) correctCount++;
      if (isWrong) wrongCount++;
      if (isHallu) hallucinationCount++;
      if (isMissing) missingKnowledgeCount++;

      const th = log.similarity_threshold;
      if (thresholdGroups[th] !== undefined) {
        thresholdGroups[th].total++;
        if (isCorrect) thresholdGroups[th].correct++;
        if (isWrong) thresholdGroups[th].wrong++;
        if (isHallu) thresholdGroups[th].hallucination++;
        if (isMissing) thresholdGroups[th].missing++;
      } else {
        thresholdGroups[th] = {
          total: 1,
          correct: isCorrect ? 1 : 0,
          wrong: isWrong ? 1 : 0,
          hallucination: isHallu ? 1 : 0,
          missing: isMissing ? 1 : 0
        };
      }

      const mode = log.selected_mode;
      if (!modeGroups[mode]) {
        modeGroups[mode] = { total: 0, correct: 0, wrong: 0, hallucination: 0, missing: 0, errors: 0 };
      }
      modeGroups[mode].total++;
      if (isCorrect) modeGroups[mode].correct++;
      if (isWrong) modeGroups[mode].wrong++;
      if (isHallu) modeGroups[mode].hallucination++;
      if (isMissing) modeGroups[mode].missing++;
      
      if (isWrong || isHallu || isMissing) {
        modeGroups[mode].errors++;
      }
    });

    const correctRate = (correctCount / total) * 100;
    const wrongRate = (wrongCount / total) * 100;

    // Compute best & worst threshold
    let bestTh = "N/A";
    let maxCorrectRate = -1;
    let worstTh = "N/A";
    let minCorrectRate = 101;

    Object.entries(thresholdGroups).forEach(([thStr, data]) => {
      if (data.total > 0) {
        const thRate = (data.correct / data.total) * 100;
        if (thRate > maxCorrectRate) {
          maxCorrectRate = thRate;
          bestTh = thStr;
        }
        if (thRate < minCorrectRate) {
          minCorrectRate = thRate;
          worstTh = thStr;
        }
      }
    });

    // Compute most buggy mode
    let mostBuggy = "None";
    let maxErrors = -1;
    Object.entries(modeGroups).forEach(([mName, data]) => {
      if (data.errors > maxErrors) {
        maxErrors = data.errors;
        mostBuggy = mName;
      }
    });

    const byThreshold = Object.entries(thresholdGroups).map(([th, data]) => ({
      threshold: parseFloat(th),
      ...data
    })).sort((a, b) => a.threshold - b.threshold);

    const byMode = Object.entries(modeGroups).map(([mode, data]) => ({
      selected_mode: mode,
      ...data
    }));

    return {
      total,
      correctRate,
      wrongRate,
      hallucinationCount,
      missingKnowledgeCount,
      bestThreshold: bestTh,
      worstThreshold: worstTh,
      mostBuggyMode: modeLabels[mostBuggy] || mostBuggy,
      byThreshold,
      byMode
    };
  })();

  if (!isAdminOrSubAdmin) {
    return <div className="p-8 text-center text-rose-500 font-bold">Bạn không có quyền truy cập trang này.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" />
            RAG Accuracy Audit Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">Đo độ chính xác của Vector Retrieval & AI response theo các kịch bản thực tế.</p>
        </div>
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 py-1.5 px-3 font-semibold text-xs rounded-lg">
          QA Audit Mode Enabled
        </Badge>
      </div>

      <Tabs defaultValue="sandbox" className="w-full">
        <TabsList className="mb-6 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="sandbox" className="flex items-center gap-2 py-2 px-4 rounded-lg"><Search className="w-4 h-4"/> RAG Sandbox & Test Tool</TabsTrigger>
          <TabsTrigger value="summary" className="flex items-center gap-2 py-2 px-4 rounded-lg"><BarChart3 className="w-4 h-4"/> Audit Summary & Analytics</TabsTrigger>
        </TabsList>

        {/* TAB 1: RAG SANDBOX & TEST TOOL */}
        <TabsContent value="sandbox" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Side: Preset questions and controls */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Presets Card */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-emerald-600"/> 20 Câu hỏi mẫu (Preset Cases)
                  </CardTitle>
                  <CardDescription className="text-xs">Bấm vào câu hỏi để đưa vào hộp nhập liệu.</CardDescription>
                </CardHeader>
                <CardContent className="p-3">
                  <Accordion type="single" collapsible className="w-full">
                    {presetGroups.map((group, index) => (
                      <AccordionItem key={group.id} value={group.id} className={index === presetGroups.length - 1 ? 'border-b-0' : ''}>
                        <AccordionTrigger className="text-xs font-semibold hover:no-underline py-2.5 px-2 text-slate-700 hover:bg-slate-50 rounded-lg">
                          {group.label}
                        </AccordionTrigger>
                        <AccordionContent className="pt-1 pb-2 px-2 space-y-1.5">
                          {group.questions.map((q, idx) => (
                            <button
                              key={idx}
                              onClick={() => setQuery(q)}
                              className="w-full text-left text-[11px] p-2 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 rounded-md border border-transparent hover:border-emerald-100 transition-colors flex items-start gap-1"
                            >
                              <ArrowRight className="w-3 h-3 mt-0.5 shrink-0 text-emerald-500" />
                              <span>{q}</span>
                            </button>
                          ))}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>

              {/* Controls Card */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-3">
                  <CardTitle className="text-sm font-bold text-slate-800">Cấu hình tham số RAG</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  
                  {/* Select Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Chọn kịch bản (Mode):</label>
                    <select
                      value={selectedMode}
                      onChange={(e) => setSelectedMode(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="product_tutor">Product Tutor (Đào tạo)</option>
                      <option value="objection_handling">Objection Handling (Từ chối)</option>
                      <option value="usage_script">Usage Script (Kịch bản dùng)</option>
                      <option value="compare_products">Compare Products (So sánh)</option>
                    </select>
                  </div>

                  {/* Threshold Buttons */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-600">Similarity Threshold:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[0.5, 0.7, 0.8, 0.9].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setThreshold(val)}
                          className={`py-1.5 text-xs font-bold rounded-lg border transition-all ${threshold === val ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                </CardContent>
              </Card>

            </div>

            {/* Right Side: Input & Outputs */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Question Test Box */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800">Search & Generate Test Box</CardTitle>
                    <CardDescription className="text-xs">Nhập câu hỏi như một nhân viên sales thực tế.</CardDescription>
                  </div>
                  <Button 
                    onClick={handleRunAudit} 
                    disabled={isLoading} 
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2 h-9 px-4 text-xs"
                  >
                    {isLoading ? 'Đang truy vấn...' : 'Run Audit Test'}
                    <Search className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-4">
                  <Textarea
                    placeholder="VD: Khách da dầu nhạy cảm nên dùng gì?..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full text-xs font-medium placeholder:text-slate-400 focus-visible:ring-emerald-500 rounded-lg min-h-20"
                  />
                </CardContent>
              </Card>

              {/* Retrieved Chunks Viewer */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-3">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-4 h-4 text-indigo-500" /> Retrieved Chunks ({retrievedChunks.length})
                  </CardTitle>
                  <CardDescription className="text-xs">Chỉ bốc các chunks ĐÃ DUYỆT (Approved) và ĐANG HOẠT ĐỘNG (Active).</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {retrievedChunks.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/70 hover:bg-slate-50/70">
                            <TableHead className="w-24 text-xs font-bold text-slate-600">ID / SP</TableHead>
                            <TableHead className="w-24 text-xs font-bold text-slate-600">Similarity</TableHead>
                            <TableHead className="w-16 text-xs font-bold text-slate-600">Version</TableHead>
                            <TableHead className="text-xs font-bold text-slate-600">Nội dung</TableHead>
                            <TableHead className="w-24 text-xs font-bold text-slate-600">Trạng thái</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {retrievedChunks.map((chunk, idx) => (
                            <TableRow key={idx} className="hover:bg-slate-50/50 text-[11px] font-medium">
                              <TableCell className="font-semibold text-slate-700">
                                <div>ID: {chunk.chunk_id?.slice(0, 6)}...</div>
                                <div className="text-[10px] text-indigo-600 truncate max-w-28 mt-0.5">{chunk.product_name}</div>
                              </TableCell>
                              <TableCell>
                                <span className={`font-bold text-xs ${chunk.similarity_score >= 0.8 ? 'text-emerald-600' : chunk.similarity_score >= 0.7 ? 'text-indigo-600' : 'text-slate-600'}`}>
                                  {chunk.similarity_score ? chunk.similarity_score.toFixed(4) : '—'}
                                </span>
                              </TableCell>
                              <TableCell className="font-bold text-slate-500">v{chunk.knowledge_version}</TableCell>
                              <TableCell className="text-slate-600 leading-relaxed font-normal font-mono max-w-sm whitespace-pre-wrap truncate hover:whitespace-normal transition-all duration-300">
                                {chunk.content}
                              </TableCell>
                              <TableCell className="space-y-1">
                                <div className="flex gap-1 items-center">
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-50 text-[9px] px-1 py-0 font-bold rounded">
                                    Approved
                                  </Badge>
                                </div>
                                <div className="flex gap-1 items-center">
                                  <Badge className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-50 text-[9px] px-1 py-0 font-bold rounded">
                                    Active
                                  </Badge>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {isLoading ? 'Đang thực hiện vector search...' : 'Không có chunks nào được retrieve.'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Final Answer */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-emerald-600" /> AI Final Answer
                    </CardTitle>
                    <CardDescription className="text-xs">Phản hồi của AI dựa trên kịch bản và dữ liệu RAG.</CardDescription>
                  </div>
                  {tokenUsage && (
                    <div className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 py-1 px-2.5 rounded-lg flex items-center gap-1.5">
                      <span>Model: <strong>{modelUsed}</strong></span>
                      <span>·</span>
                      <span>Tokens: <strong>{tokenUsage.total}</strong> ({tokenUsage.prompt}i / {tokenUsage.completion}o)</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  {finalAnswer ? (
                    <div className="text-xs text-slate-700 font-medium whitespace-pre-wrap bg-emerald-50/30 p-4 border border-emerald-100 rounded-xl leading-relaxed">
                      {finalAnswer}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      {isLoading ? 'AI đang soạn thảo câu trả lời...' : 'Hộp kết quả trống.'}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Evaluation Panel */}
              <Card className="border-slate-200 shadow-sm bg-emerald-50/10">
                <CardHeader className="bg-emerald-50/20 border-b border-emerald-100/50 pb-3">
                  <CardTitle className="text-sm font-bold text-emerald-900 flex items-center gap-2">
                    <ClipboardCheck className="w-4 h-4 text-emerald-700" /> Evaluation Panel
                  </CardTitle>
                  <CardDescription className="text-xs text-emerald-800/80">Lưu kết quả đánh giá chất lượng RAG cho câu hỏi hiện tại.</CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  
                  {/* Grid Checkboxes */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    
                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      <Checkbox
                        checked={evaluation.correct_retrieve}
                        onCheckedChange={(checked) => setEvaluation(prev => ({ ...prev, correct_retrieve: !!checked }))}
                        className="text-emerald-600 focus-visible:ring-emerald-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-emerald-800">Correct Retrieve</span>
                        <span className="text-[8px] text-slate-400">Bốc đúng dữ liệu</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      <Checkbox
                        checked={evaluation.wrong_retrieve}
                        onCheckedChange={(checked) => setEvaluation(prev => ({ ...prev, wrong_retrieve: !!checked }))}
                        className="text-rose-600 focus-visible:ring-rose-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-rose-800">Wrong Retrieve</span>
                        <span className="text-[8px] text-slate-400">Bốc sai sản phẩm</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      <Checkbox
                        checked={evaluation.hallucination}
                        onCheckedChange={(checked) => setEvaluation(prev => ({ ...prev, hallucination: !!checked }))}
                        className="text-amber-600 focus-visible:ring-amber-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-amber-800">Hallucination</span>
                        <span className="text-[8px] text-slate-400">AI bịa thông tin</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      <Checkbox
                        checked={evaluation.partial_answer}
                        onCheckedChange={(checked) => setEvaluation(prev => ({ ...prev, partial_answer: !!checked }))}
                        className="text-indigo-600 focus-visible:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-indigo-800">Partial Answer</span>
                        <span className="text-[8px] text-slate-400">Thiếu một phần ý</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm">
                      <Checkbox
                        checked={evaluation.missing_knowledge}
                        onCheckedChange={(checked) => setEvaluation(prev => ({ ...prev, missing_knowledge: !!checked }))}
                        className="text-slate-600 focus-visible:ring-slate-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-800">Missing Knowledge</span>
                        <span className="text-[8px] text-slate-400">Chưa có tri thức</span>
                      </div>
                    </label>

                  </div>

                  {/* Notes Textarea */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Ghi chú chi tiết (nếu có):</label>
                    <Textarea
                      placeholder="Ghi chú vì sao đúng, sai, hoặc thiếu tri thức nào..."
                      value={evaluation.notes}
                      onChange={(e) => setEvaluation(prev => ({ ...prev, notes: e.target.value }))}
                      className="w-full text-xs font-medium focus-visible:ring-emerald-500 rounded-lg min-h-16"
                    />
                  </div>

                  {/* Save button */}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleSaveEvaluation}
                      disabled={isSavingLog || (!finalAnswer && retrievedChunks.length === 0)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2 text-xs"
                    >
                      {isSavingLog ? 'Đang lưu...' : 'Save Evaluation Log'}
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                </CardContent>
              </Card>

            </div>

          </div>
        </TabsContent>

        {/* TAB 2: AUDIT SUMMARY & ANALYTICS */}
        <TabsContent value="summary" className="space-y-6">
          
          {/* Key Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Audits</span>
                <p className="text-3xl font-black text-slate-800 mt-2">{stats.total}</p>
                <p className="text-[10px] text-slate-400 mt-1">Tổng số lượt đánh giá đã lưu</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-l-4 border-l-emerald-500">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Correct Retrieve Rate</span>
                <p className="text-3xl font-black text-emerald-600 mt-2">{stats.correctRate.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-1">Tỷ lệ bốc đúng tri thức</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm border-l-4 border-l-rose-500">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Wrong Retrieve Rate</span>
                <p className="text-3xl font-black text-rose-600 mt-2">{stats.wrongRate.toFixed(1)}%</p>
                <p className="text-[10px] text-slate-400 mt-1">Tỷ lệ bốc sai sản phẩm</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hallucination Count</span>
                <p className="text-3xl font-black text-amber-600 mt-2">{stats.hallucinationCount}</p>
                <p className="text-[10px] text-slate-400 mt-1">Số ca phát hiện ảo giác</p>
              </CardContent>
            </Card>

          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Missing Knowledge</span>
                <p className="text-3xl font-black text-slate-600 mt-2">{stats.missingKnowledgeCount}</p>
                <p className="text-[10px] text-slate-400 mt-1">Số ca thiếu tri thức nguồn</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Best Threshold</span>
                <p className="text-3xl font-black text-indigo-600 mt-2">{stats.bestThreshold}</p>
                <p className="text-[10px] text-slate-400 mt-1">Ngưỡng bốc chính xác nhất</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Worst Threshold</span>
                <p className="text-3xl font-black text-amber-700 mt-2">{stats.worstThreshold}</p>
                <p className="text-[10px] text-slate-400 mt-1">Ngưỡng kém hiệu quả nhất</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Most Buggy Mode</span>
                <p className="text-xl font-black text-rose-700 mt-2 truncate">{stats.mostBuggyMode}</p>
                <p className="text-[10px] text-slate-400 mt-2">Kịch bản có nhiều lỗi nhất</p>
              </CardContent>
            </Card>

          </div>

          {/* Statistics tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Table by Threshold */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">Thống kê theo Similarity Threshold</CardTitle>
                <CardDescription className="text-xs">Tỷ lệ chính xác của từng ngưỡng thử nghiệm (0.5, 0.7, 0.8, 0.9).</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-xs font-bold">Threshold</TableHead>
                      <TableHead className="text-xs font-bold">Total</TableHead>
                      <TableHead className="text-xs font-bold text-emerald-600">Correct</TableHead>
                      <TableHead className="text-xs font-bold text-rose-600">Wrong</TableHead>
                      <TableHead className="text-xs font-bold text-amber-600">Hallucination</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Missing Knowledge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.byThreshold.map((item: any, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 text-xs font-medium">
                        <TableCell className="font-bold text-slate-800">{item.threshold}</TableCell>
                        <TableCell className="text-slate-600">{item.total}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 bg-emerald-50/20">{item.correct}</TableCell>
                        <TableCell className="font-semibold text-rose-600 bg-rose-50/20">{item.wrong}</TableCell>
                        <TableCell className="text-amber-600">{item.hallucination}</TableCell>
                        <TableCell className="text-slate-500">{item.missing}</TableCell>
                      </TableRow>
                    ))}
                    {stats.byThreshold.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Table by Mode */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="bg-slate-50/50 border-b pb-3">
                <CardTitle className="text-sm font-bold text-slate-800">Thống kê theo Kịch bản (Mode)</CardTitle>
                <CardDescription className="text-xs">Đánh giá chất lượng sinh nội dung theo từng module Sales AI.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/30">
                      <TableHead className="text-xs font-bold">Selected Mode</TableHead>
                      <TableHead className="text-xs font-bold">Total</TableHead>
                      <TableHead className="text-xs font-bold text-emerald-600">Correct</TableHead>
                      <TableHead className="text-xs font-bold text-rose-600">Wrong</TableHead>
                      <TableHead className="text-xs font-bold text-amber-600">Hallucination</TableHead>
                      <TableHead className="text-xs font-bold text-slate-500">Missing Knowledge</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.byMode.map((item: any, idx) => (
                      <TableRow key={idx} className="hover:bg-slate-50/50 text-xs font-medium">
                        <TableCell className="font-bold text-slate-800">{modeLabels[item.selected_mode] || item.selected_mode}</TableCell>
                        <TableCell className="text-slate-600">{item.total}</TableCell>
                        <TableCell className="font-semibold text-emerald-600 bg-emerald-50/20">{item.correct}</TableCell>
                        <TableCell className="font-semibold text-rose-600 bg-rose-50/20">{item.wrong}</TableCell>
                        <TableCell className="text-amber-600">{item.hallucination}</TableCell>
                        <TableCell className="text-slate-500">{item.missing}</TableCell>
                      </TableRow>
                    ))}
                    {stats.byMode.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="p-8 text-center text-slate-400">Không có dữ liệu</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

          </div>

          {/* Audit History Logs List */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-800">Lịch sử đánh giá RAG Audit Logs</CardTitle>
                <CardDescription className="text-xs">Chi tiết tất cả lượt test và đánh giá đã lưu trong cơ sở dữ liệu.</CardDescription>
              </div>
              <Button onClick={fetchLogs} variant="outline" size="sm" className="bg-white gap-1.5 h-8 text-xs border-slate-200">
                Làm mới
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {logs.map((log) => {
                  const ev = log.evaluation || {};
                  return (
                    <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex gap-2 items-center flex-wrap">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {modeLabels[log.selected_mode] || log.selected_mode}
                          </span>
                          <span className="font-semibold text-slate-500">
                            Threshold: <strong>{log.similarity_threshold}</strong>
                          </span>
                          <span className="text-slate-300">|</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(log.created_at).toLocaleString('vi-VN')}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          {ev.correct_retrieve && <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] rounded font-bold">Correct</Badge>}
                          {ev.wrong_retrieve && <Badge className="bg-rose-50 text-rose-700 border-rose-100 text-[9px] rounded font-bold">Wrong</Badge>}
                          {ev.hallucination && <Badge className="bg-amber-50 text-amber-700 border-amber-100 text-[9px] rounded font-bold">Hallucination</Badge>}
                          {ev.partial_answer && <Badge className="bg-indigo-50 text-indigo-700 border-indigo-100 text-[9px] rounded font-bold">Partial</Badge>}
                          {ev.missing_knowledge && <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[9px] rounded font-bold">Missing Info</Badge>}
                        </div>
                      </div>
                      <p className="text-[11px] font-bold text-slate-800">Q: "{log.query}"</p>
                      {log.final_answer && (
                        <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md font-mono border border-slate-100">
                          {log.final_answer}
                        </p>
                      )}
                      {ev.notes && (
                        <p className="text-[10px] text-slate-500 bg-amber-50/50 p-1.5 px-2.5 rounded border border-amber-100/50">
                          <strong>Ghi chú:</strong> {ev.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
                {logs.length === 0 && (
                  <div className="py-12 text-center text-slate-400 text-xs">Chưa có bản ghi audit nào.</div>
                )}
              </div>
            </CardContent>
          </Card>

        </TabsContent>
      </Tabs>
    </div>
  );
}
