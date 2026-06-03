import React, { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Search,
  Activity,
  BugPlay,
  DatabaseZap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Code,
  RefreshCw,
  AlertOctagon,
  ShieldX,
  Star,
  Clock,
  GitFork,
  FlaskConical,
  Play,
  TrendingUp,
  Coins,
  Gauge,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/ai-debug")({
  component: AIDebugAdmin,
});

function AIDebugAdmin() {
  const { isAdminOrSubAdmin } = useAuth();

  const [sandboxQuery, setSandboxQuery] = useState("");
  const [sandboxResult, setSandboxResult] = useState<any>(null);
  const [isLoadingSandbox, setIsLoadingSandbox] = useState(false);

  const [healthMetrics, setHealthMetrics] = useState<any>({
    total_chunks: 0,
    avg_chunk_size: 0,
    missing_embeddings: 0,
    duplicate_chunks: 0,
  });
  const [staleChunks, setStaleChunks] = useState<any[]>([]);

  const [conversations, setConversations] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any[]>([]);
  const [safetyEvents, setSafetyEvents] = useState<any[]>([]);
  const [notifiedEventIds, setNotifiedEventIds] = useState<string[]>([]);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  // Phase 10: Search QA Tests
  const [searchQaTests, setSearchQaTests] = useState<any[]>([]);
  const [searchQaResults, setSearchQaResults] = useState<
    Record<string, "pass" | "fail" | "running">
  >({});
  const [isRunningQa, setIsRunningQa] = useState(false);

  // Phase P4: Performance Analytics
  const [performanceSummary, setPerformanceSummary] = useState<any>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(false);

  const fetchPerformanceSummary = async () => {
    setIsLoadingPerformance(true);
    try {
      const { data, error } = await supabase.rpc("get_ai_performance_summary");
      if (error) throw error;
      setPerformanceSummary(data);
    } catch (e: any) {
      console.error(e);
      toast.error("Lỗi tải dữ liệu hiệu suất: " + e.message);
    } finally {
      setIsLoadingPerformance(false);
    }
  };

  useEffect(() => {
    fetchHealthMetrics();
    fetchStaleChunks();
    fetchConversations();
    fetchAuditStats();
    fetchSafetyEvents();
    fetchSearchQaTests();
    fetchPerformanceSummary();
  }, []);

  // Poll safety events every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSafetyEvents();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealthMetrics = async () => {
    try {
      const { data, error } = await supabase.rpc("get_embedding_health_metrics");
      if (error) throw error;
      if (data && data.length > 0) setHealthMetrics(data[0]);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchStaleChunks = async () => {
    try {
      const { data, error } = await supabase.rpc("get_stale_chunks");
      if (error) throw error;
      setStaleChunks(data || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select(
          "id, mode, status, hallucination_flag, feedback_score, total_tokens, created_at, customers(name)",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      setConversations(data || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchAuditStats = async () => {
    try {
      const { data, error } = await supabase.from("ai_conversation_analytics").select("*");
      if (error) throw error;
      setAuditStats(data || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const fetchSafetyEvents = async () => {
    try {
      const { data, error } = await supabase
        .from("ai_safety_events")
        .select("id, event_type, phrase, severity, original_response_preview, handled, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const events = data || [];
      setSafetyEvents(events);

      // Find new unhandled events that we haven't notified about yet
      const newUnhandled = events.filter(
        (ev: any) => !ev.handled && !notifiedEventIds.includes(ev.id),
      );
      if (newUnhandled.length > 0) {
        toast.warning("Có cảnh báo AI Safety mới cần xử lý.");
        // Add their IDs to the notified list
        setNotifiedEventIds((prev) => [...prev, ...newUnhandled.map((ev: any) => ev.id)]);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  const runSandbox = async () => {
    if (!sandboxQuery.trim()) return;
    setIsLoadingSandbox(true);
    setSandboxResult(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sales-assistant`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ mode: "debug_rag", debugQuery: sandboxQuery }),
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Lỗi gọi Sandbox");
      setSandboxResult(result);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsLoadingSandbox(false);
    }
  };

  const handleFlagHallucination = async (conversationId: string) => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-conversation-feedback`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            action: "flag_hallucination",
            conversation_id: conversationId,
            hallucination_note: "Flagged by Admin",
          }),
        },
      );
      if (res.ok) {
        toast.success("Đã gắn cờ ảo giác");
        fetchConversations();
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Phase 10: Search QA Tests
  const fetchSearchQaTests = async () => {
    try {
      const { data } = await supabase
        .from("ai_search_qa_tests")
        .select("*")
        .eq("is_active", true)
        .order("created_at");
      setSearchQaTests(data || []);
    } catch (e: any) {
      console.error(e);
    }
  };

  const runSearchQaTests = async () => {
    if (!searchQaTests.length) return;
    setIsRunningQa(true);
    setSearchQaResults({});
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;

    for (const test of searchQaTests) {
      setSearchQaResults((prev) => ({ ...prev, [test.id]: "running" }));
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-sales-assistant`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ mode: "debug_rag", debugQuery: test.query }),
          },
        );
        const result = await res.json();
        // Check if any retrieved chunk content contains the expected keyword
        const chunks: any[] = result.retrieved_chunks || [];
        const matched = chunks.some((c: any) =>
          c.content?.toLowerCase().includes(test.expected_keyword.toLowerCase()),
        );
        setSearchQaResults((prev) => ({ ...prev, [test.id]: matched ? "pass" : "fail" }));
      } catch {
        setSearchQaResults((prev) => ({ ...prev, [test.id]: "fail" }));
      }
      // Small delay to avoid rate limiting
      await new Promise((r) => setTimeout(r, 300));
    }
    setIsRunningQa(false);
  };

  if (!isAdminOrSubAdmin) {
    return (
      <div className="p-8 text-center text-rose-500 font-bold">
        Bạn không có quyền truy cập trang này.
      </div>
    );
  }

  const duplicateRate =
    healthMetrics.total_chunks > 0
      ? (healthMetrics.duplicate_chunks / healthMetrics.total_chunks) * 100
      : 0;
  const isHealthy =
    healthMetrics.missing_embeddings === 0 && duplicateRate < 5 && staleChunks.length === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
          <BugPlay className="w-6 h-6 text-indigo-500" />
          AI & RAG Debug Center
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          RAG Quality Control · Embedding Health · Knowledge Versioning · Conversation Audit
        </p>
      </div>

      <Tabs defaultValue="sandbox" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="sandbox" className="flex items-center gap-2">
            <Search className="w-4 h-4" /> RAG Sandbox
          </TabsTrigger>
          <TabsTrigger value="health" className="flex items-center gap-2">
            <Activity className="w-4 h-4" /> Health Check
            {!isHealthy && <span className="w-2 h-2 rounded-full bg-rose-500 ml-1"></span>}
          </TabsTrigger>
          <TabsTrigger value="versioning" className="flex items-center gap-2">
            <GitFork className="w-4 h-4" /> Versioning
            {staleChunks.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-1"></span>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4" /> Conversation Audit
          </TabsTrigger>
          <TabsTrigger value="safety" className="flex items-center gap-2">
            <ShieldX className="w-4 h-4" /> Safety Events
          </TabsTrigger>
          <TabsTrigger value="search_qa" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" /> Search QA Test
          </TabsTrigger>
          <TabsTrigger
            value="performance"
            onClick={fetchPerformanceSummary}
            className="flex items-center gap-2"
          >
            <TrendingUp className="w-4 h-4" /> Performance & Cost
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: SANDBOX */}
        <TabsContent value="sandbox" className="space-y-6">
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-100">
              <CardTitle className="text-lg text-indigo-900">
                Mô phỏng RAG Retrieval (Sandbox)
              </CardTitle>
              <CardDescription>
                Nhập truy vấn để kiểm tra AI bốc đúng Knowledge Chunks không.{" "}
                <strong>Không tốn token AI Chat.</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="flex gap-4">
                <Input
                  placeholder='VD: "Khách da dầu bị mụn viêm, đang treatment laser"'
                  className="flex-1"
                  value={sandboxQuery}
                  onChange={(e) => setSandboxQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSandbox()}
                />
                <Button
                  onClick={runSandbox}
                  disabled={isLoadingSandbox}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isLoadingSandbox ? "Đang băm vector..." : "Test Retrieval"}
                </Button>
              </div>

              {sandboxResult && (
                <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <DatabaseZap className="w-5 h-5 text-emerald-500" />
                      Retrieved Chunks ({sandboxResult.retrieved_chunks?.length || 0})
                    </h3>
                    <div className="grid gap-3">
                      {sandboxResult.retrieved_chunks?.map((chunk: any, i: number) => (
                        <div
                          key={i}
                          className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative overflow-hidden"
                        >
                          <div
                            className={`absolute top-0 right-0 px-3 py-1 text-xs font-bold rounded-bl-xl ${chunk.score > 0.8 ? "bg-emerald-100 text-emerald-700" : chunk.score > 0.5 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}
                          >
                            {chunk.score?.toFixed(3)}
                          </div>
                          <div className="font-semibold text-indigo-900 text-sm mb-1">
                            Product #{chunk.product_id} · {chunk.chunk_type}
                          </div>
                          <p className="text-sm text-slate-600 font-mono mt-2 bg-white p-2 rounded border border-slate-100">
                            {chunk.content}
                          </p>
                        </div>
                      ))}
                      {(!sandboxResult.retrieved_chunks ||
                        sandboxResult.retrieved_chunks.length === 0) && (
                        <div className="p-6 text-center bg-rose-50 border border-rose-200 rounded-xl">
                          <XCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
                          <p className="font-bold text-rose-700">Không tìm thấy Chunk nào!</p>
                          <p className="text-sm text-rose-600 mt-1">
                            Cần nhập thêm dữ liệu vào Product Knowledge và chạy lại Embedding.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="font-bold text-slate-700 flex items-center gap-2">
                      <Code className="w-5 h-5 text-indigo-500" /> Final Prompt Preview
                    </h3>
                    <div className="p-4 bg-slate-900 text-slate-300 font-mono text-xs rounded-xl overflow-x-auto whitespace-pre-wrap max-h-64">
                      {sandboxResult.final_prompt_preview}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: HEALTH CHECK */}
        <TabsContent value="health" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Chunks", value: healthMetrics.total_chunks, unit: "", alert: null },
              {
                label: "Avg Chunk Size",
                value: healthMetrics.avg_chunk_size,
                unit: " chars",
                alert:
                  healthMetrics.avg_chunk_size > 800 ||
                  (healthMetrics.avg_chunk_size > 0 && healthMetrics.avg_chunk_size < 100)
                    ? "amber"
                    : null,
              },
              {
                label: "Missing Embeddings",
                value: healthMetrics.missing_embeddings,
                unit: "",
                alert: healthMetrics.missing_embeddings > 0 ? "red" : null,
              },
              {
                label: "Duplicate Rate",
                value: `${duplicateRate.toFixed(1)}%`,
                unit: ` (${healthMetrics.duplicate_chunks})`,
                alert: duplicateRate >= 5 ? "amber" : null,
              },
            ].map((m, i) => (
              <Card
                key={i}
                className={`shadow-sm ${m.alert === "red" ? "border-rose-300 bg-rose-50" : m.alert === "amber" ? "border-amber-300 bg-amber-50" : ""}`}
              >
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">{m.label}</p>
                  <p
                    className={`text-3xl font-black mt-2 ${m.alert === "red" ? "text-rose-600" : m.alert === "amber" ? "text-amber-600" : "text-slate-800"}`}
                  >
                    {m.value}
                    <span className="text-sm font-normal text-slate-400">{m.unit}</span>
                  </p>
                  {m.alert === "red" && (
                    <p className="text-xs text-rose-500 mt-2 flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Nghiêm trọng
                    </p>
                  )}
                  {m.alert === "amber" && (
                    <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Cần chú ý
                    </p>
                  )}
                  {!m.alert && (
                    <p className="text-xs text-emerald-500 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Bình thường
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Activity className="w-5 h-5" /> Chẩn đoán tổng thể
            </h3>
            <div
              className={`flex items-center gap-3 p-4 rounded-xl ${isHealthy ? "bg-emerald-50 border border-emerald-200" : "bg-rose-50 border border-rose-200"}`}
            >
              {isHealthy ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              )}
              <p className="text-sm font-medium">
                {isHealthy
                  ? "Hệ thống Vector Database đang hoạt động ổn định."
                  : "Phát hiện có vấn đề. Kiểm tra các cảnh báo ở trên và Tab Versioning."}
              </p>
            </div>
            <Button
              onClick={() => {
                fetchHealthMetrics();
                fetchStaleChunks();
              }}
              variant="outline"
              size="sm"
              className="bg-white mt-4 gap-2"
            >
              <RefreshCw className="w-3 h-3" /> Làm mới
            </Button>
          </div>
        </TabsContent>

        {/* TAB 3: VERSIONING */}
        <TabsContent value="versioning" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="pb-4 border-b border-slate-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <GitFork className="w-5 h-5 text-amber-500" /> Knowledge Versioning & Stale Chunks
              </CardTitle>
              <CardDescription>
                Khi Admin sửa sản phẩm, trigger tự động tăng <code>knowledge_version</code>. Các
                Chunks cũ sẽ hiển thị tại đây và cần Re-embed lại.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              {staleChunks.length === 0 ? (
                <div className="py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="font-bold text-emerald-700">
                    Tất cả Chunks đang đồng bộ với phiên bản mới nhất!
                  </p>
                  <p className="text-sm text-slate-500 mt-1">Không có chunk nào bị lỗi version.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-700">
                      Tìm thấy <strong>{staleChunks.length}</strong> sản phẩm có chunks lỗi thời.
                      Cần re-embed để AI không đọc kiến thức cũ.
                    </p>
                  </div>
                  {staleChunks.map((row: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-4 bg-amber-50/50 border border-amber-100 rounded-xl"
                    >
                      <div>
                        <p className="font-bold text-slate-800">Sản phẩm #{row.product_id}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Chunk version:{" "}
                          <span className="text-rose-600 font-bold">v{row.chunk_version}</span> →
                          Current:{" "}
                          <span className="text-emerald-600 font-bold">
                            v{row.current_knowledge_version}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.stale_chunk_count} chunks lỗi thời
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-amber-300 text-amber-700 bg-amber-50"
                      >
                        Cần Re-embed
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CONVERSATION AUDIT */}
        <TabsContent value="audit" className="space-y-6">
          {/* Analytics Summary */}
          {auditStats.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {auditStats.map((stat: any, i: number) => (
                <Card key={i} className="shadow-sm">
                  <CardContent className="p-5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                      {stat.mode}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-xl font-black text-slate-800">{stat.total_calls}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Avg Rating</p>
                        <p
                          className={`text-xl font-black ${!stat.avg_feedback_score ? "text-slate-400" : stat.avg_feedback_score >= 4 ? "text-emerald-600" : "text-amber-600"}`}
                        >
                          {stat.avg_feedback_score ? `${stat.avg_feedback_score}★` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Hallucinations</p>
                        <p
                          className={`text-xl font-black ${stat.hallucination_count > 0 ? "text-rose-600" : "text-slate-400"}`}
                        >
                          {stat.hallucination_count}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Hallu Rate</p>
                        <p
                          className={`text-xl font-black ${stat.hallucination_rate_pct > 5 ? "text-rose-600" : "text-emerald-600"}`}
                        >
                          {stat.hallucination_rate_pct || 0}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Conversation Log Table */}
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg">Log Conversations Gần Đây</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {conversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${conv.status === "error" ? "bg-rose-500" : conv.hallucination_flag ? "bg-amber-500" : "bg-emerald-500"}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {conv.customers?.name || "Unknown"}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400">{conv.mode}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span className="text-xs text-slate-400">
                            {new Date(conv.created_at).toLocaleString("vi-VN")}
                          </span>
                          {conv.total_tokens && (
                            <span className="text-xs text-slate-400">
                              · {conv.total_tokens} tokens
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {conv.feedback_score && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          <span className="text-xs font-bold text-amber-700">
                            {conv.feedback_score}
                          </span>
                        </div>
                      )}
                      {conv.hallucination_flag ? (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <ShieldX className="w-3 h-3" /> Ảo giác
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFlagHallucination(conv.id)}
                          className="h-7 px-2 text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50"
                        >
                          Flag
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {conversations.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    Chưa có AI conversation nào được ghi nhận.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: SAFETY EVENTS */}
        <TabsContent value="safety" className="space-y-6">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-lg">Safety Events</CardTitle>
              <CardDescription>
                AI safety guard detections (banned phrases, risky content)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {safetyEvents.map((ev: any) => {
                  const isExpanded = !!expandedEvents[ev.id];
                  return (
                    <div
                      key={ev.id}
                      className="p-5 hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Severity Badge */}
                          {ev.severity === "high" && (
                            <Badge variant="destructive" className="font-bold">
                              HIGH
                            </Badge>
                          )}
                          {ev.severity === "medium" && (
                            <Badge
                              variant="outline"
                              className="bg-amber-50 text-amber-700 border-amber-200 font-bold dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                            >
                              MEDIUM
                            </Badge>
                          )}
                          {ev.severity === "low" && (
                            <Badge
                              variant="outline"
                              className="bg-slate-50 text-slate-600 border-slate-200 font-bold dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                            >
                              LOW
                            </Badge>
                          )}

                          {/* Event Type Badge */}
                          {ev.event_type === "no_retrieval" && (
                            <Badge
                              variant="outline"
                              className="bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800"
                            >
                              No Retrieval
                            </Badge>
                          )}
                          {ev.event_type === "low_confidence_retrieval" && (
                            <Badge
                              variant="outline"
                              className="bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800"
                            >
                              Low Confidence
                            </Badge>
                          )}
                          {ev.event_type === "medical_claim_blocked" && (
                            <Badge
                              variant="outline"
                              className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800"
                            >
                              Medical Claim Blocked
                            </Badge>
                          )}
                          {ev.event_type === "unsupported_product_mention" && (
                            <Badge
                              variant="outline"
                              className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-300 dark:border-yellow-800"
                            >
                              Unsupported Product
                            </Badge>
                          )}
                          {![
                            "no_retrieval",
                            "low_confidence_retrieval",
                            "medical_claim_blocked",
                            "unsupported_product_mention",
                          ].includes(ev.event_type) && (
                            <Badge variant="outline">{ev.event_type}</Badge>
                          )}

                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />{" "}
                            {new Date(ev.created_at).toLocaleString("vi-VN")}
                          </span>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {ev.original_response_preview && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedEvents((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))
                              }
                              className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-800"
                            >
                              {isExpanded ? "Ẩn Preview" : "Xem Preview"}
                            </Button>
                          )}
                          {ev.handled ? (
                            <Badge
                              variant="outline"
                              className="bg-emerald-50 text-emerald-700 border-emerald-200 font-medium"
                            >
                              Đã xử lý
                            </Badge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from("ai_safety_events")
                                    .update({ handled: true })
                                    .eq("id", ev.id);
                                  if (error) throw error;
                                  toast.success("Đã đánh dấu đã xử lý");
                                  fetchSafetyEvents();
                                } catch (e: any) {
                                  toast.error(e.message);
                                }
                              }}
                              className="h-7 px-2 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              Đánh dấu xử lý
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        <div className="text-sm">
                          <span className="font-semibold text-slate-700">Chi tiết phát hiện: </span>
                          <code className="px-2 py-0.5 bg-slate-100 rounded text-rose-600 font-mono text-xs break-all">
                            {ev.phrase || "N/A"}
                          </code>
                        </div>

                        {isExpanded && ev.original_response_preview && (
                          <div className="mt-3 p-4 bg-slate-900 text-slate-300 font-mono text-xs rounded-lg whitespace-pre-wrap max-h-64 overflow-y-auto border border-slate-800">
                            <div className="text-slate-500 border-b border-slate-800 pb-2 mb-2 uppercase text-[10px] font-bold tracking-wider">
                              Original Response Generated by AI (Blocked):
                            </div>
                            {ev.original_response_preview}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {safetyEvents.length === 0 && (
                  <div className="py-12 text-center text-slate-400">No safety events logged.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: SEARCH QA TEST */}
        <TabsContent value="search_qa" className="space-y-4">
          <Card className="shadow-sm">
            <CardHeader className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-indigo-500" /> Search Quality Test Suite
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Chạy bộ test tự động để xác nhận RAG retrieve đúng thông tin theo keyword. Pass
                    = ✅, Fail = ❌.
                  </CardDescription>
                </div>
                <Button
                  onClick={runSearchQaTests}
                  disabled={isRunningQa}
                  className="bg-indigo-600 hover:bg-indigo-700 gap-2"
                >
                  {isRunningQa ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  {isRunningQa ? "Đang chạy..." : "Chạy Tất cả Tests"}
                </Button>
              </div>
              {Object.keys(searchQaResults).length > 0 && (
                <div className="mt-3 flex items-center gap-4 text-sm">
                  <span className="font-bold text-emerald-600">
                    ✅ Pass: {Object.values(searchQaResults).filter((r) => r === "pass").length}
                  </span>
                  <span className="font-bold text-rose-600">
                    ❌ Fail: {Object.values(searchQaResults).filter((r) => r === "fail").length}
                  </span>
                  <span className="font-bold text-slate-400">
                    ⏳ Chờ: {Object.values(searchQaResults).filter((r) => r === "running").length}
                  </span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100">
                {searchQaTests.map((test: any) => {
                  const result = searchQaResults[test.id];
                  return (
                    <div
                      key={test.id}
                      className={`flex items-center gap-4 px-5 py-4 transition-colors ${result === "pass" ? "bg-emerald-50/30" : result === "fail" ? "bg-rose-50/30" : ""}`}
                    >
                      <div className="w-7 h-7 flex items-center justify-center rounded-full shrink-0">
                        {result === "pass" && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                        {result === "fail" && <XCircle className="w-5 h-5 text-rose-500" />}
                        {result === "running" && (
                          <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
                        )}
                        {!result && (
                          <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 text-sm">"{test.query}"</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {test.description} — expected keyword:{" "}
                          <code className="bg-slate-100 px-1 rounded">{test.expected_keyword}</code>
                        </p>
                      </div>
                      {result && (
                        <Badge
                          variant={
                            result === "pass"
                              ? "default"
                              : result === "fail"
                                ? "destructive"
                                : "secondary"
                          }
                          className={
                            result === "pass"
                              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                              : ""
                          }
                        >
                          {result === "pass" ? "PASS ✅" : result === "fail" ? "FAIL ❌" : "⏳"}
                        </Badge>
                      )}
                    </div>
                  );
                })}
                {searchQaTests.length === 0 && (
                  <div className="py-12 text-center text-slate-400">
                    Không có test case nào. Vui lòng chạy migration seed data.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6: PERFORMANCE & COST */}
        <TabsContent value="performance" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-indigo-500" />
                AI Cost & Performance Analytics
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Số liệu tổng hợp token, chi phí và độ trễ AI trong 30 ngày qua.
              </p>
            </div>
            <Button
              onClick={fetchPerformanceSummary}
              disabled={isLoadingPerformance}
              variant="outline"
              size="sm"
              className="gap-2 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPerformance ? "animate-spin" : ""}`} />
              Làm mới số liệu
            </Button>
          </div>

          {performanceSummary ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Today's Overview Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  {
                    label: "Hôm nay: Số request",
                    value: performanceSummary.today?.total_requests ?? 0,
                    sub: "lần gọi AI",
                    color: "text-indigo-600",
                    bg: "bg-indigo-50/40 border-indigo-100",
                  },
                  {
                    label: "Hôm nay: Tokens tiêu thụ",
                    value: performanceSummary.today?.total_tokens?.toLocaleString() ?? 0,
                    sub: "tokens",
                    color: "text-sky-600",
                    bg: "bg-sky-50/40 border-sky-100",
                  },
                  {
                    label: "Hôm nay: Chi phí ước tính",
                    value: `$${(performanceSummary.today?.total_cost_usd ?? 0).toFixed(4)}`,
                    sub: `Tuần này: $${(performanceSummary.this_week?.total_cost_usd ?? 0).toFixed(3)}`,
                    color: "text-emerald-600 font-mono",
                    bg: "bg-emerald-50/40 border-emerald-100",
                  },
                  {
                    label: "Độ trễ trung bình",
                    value: `${performanceSummary.today?.avg_latency_ms ? (performanceSummary.today.avg_latency_ms / 1000).toFixed(2) : "—"}s`,
                    sub: `${performanceSummary.today?.avg_latency_ms ?? 0} ms`,
                    color: "text-amber-600 font-mono",
                    bg: "bg-amber-50/40 border-amber-100",
                  },
                  {
                    label: "Cache Hit Rate (Hôm nay)",
                    value: `${performanceSummary.today?.cache_hit_rate ?? 0}%`,
                    sub: `${performanceSummary.today?.cache_hits ?? 0} hits`,
                    color: "text-violet-600",
                    bg: "bg-violet-50/40 border-violet-100",
                  },
                ].map((item, idx) => (
                  <Card key={idx} className={`shadow-sm border ${item.bg}`}>
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                      <p className={`text-xl font-black mt-2 ${item.color}`}>{item.value}</p>
                      <p className="text-[10px] text-slate-400 mt-1">{item.sub}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Mode Breakdown Table */}
              <Card className="shadow-sm border-slate-200">
                <CardHeader className="bg-slate-50/60 pb-3 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" /> Hiệu suất chi tiết theo tính năng (30
                    ngày gần đây)
                  </CardTitle>
                  <CardDescription>
                    Chi tiết chi phí, latency và tỷ lệ cache hit của từng mode trợ lý.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                          <th className="p-3 pl-4">Chế độ (Mode)</th>
                          <th className="p-3">Số Requests</th>
                          <th className="p-3">Tokens TB / Req</th>
                          <th className="p-3">Độ trễ TB</th>
                          <th className="p-3">Chi phí TB / Req</th>
                          <th className="p-3">Tổng Chi phí</th>
                          <th className="p-3">Tỉ lệ Cache Hit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {performanceSummary.by_mode?.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                            <td className="p-3 pl-4 font-bold text-slate-800">
                              <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[11px]">
                                {item.mode}
                              </code>
                            </td>
                            <td className="p-3 font-semibold text-slate-600">
                              {item.total_requests?.toLocaleString()}
                            </td>
                            <td className="p-3 text-slate-600 font-mono">
                              {item.avg_tokens?.toLocaleString()}
                            </td>
                            <td className="p-3 text-slate-600 font-mono">
                              {(item.avg_latency_ms / 1000).toFixed(2)}s ({item.avg_latency_ms} ms)
                            </td>
                            <td className="p-3 text-emerald-600 font-bold font-mono">
                              ${(item.avg_cost_usd ?? 0).toFixed(5)}
                            </td>
                            <td className="p-3 text-emerald-700 font-black font-mono">
                              ${(item.total_cost_usd ?? 0).toFixed(3)}
                            </td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.cache_hit_rate > 50
                                    ? "bg-emerald-100 text-emerald-700"
                                    : item.cache_hit_rate > 20
                                      ? "bg-indigo-100 text-indigo-700"
                                      : item.cache_hit_rate > 0
                                        ? "bg-amber-100 text-amber-700"
                                        : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {item.cache_hit_rate ?? 0}% ({item.cache_hit_count} hits)
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!performanceSummary.by_mode ||
                          performanceSummary.by_mode.length === 0) && (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                              Chưa ghi nhận logs sử dụng AI nào trong 30 ngày qua.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* Grid 2 columns: Expensive Queries & Active Caches */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top 5 Expensive Single Requests */}
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-rose-500" /> Top 5 cuộc gọi AI đắt nhất (7 ngày
                      gần đây)
                    </CardTitle>
                    <CardDescription>
                      Danh sách truy vấn tiêu tốn nhiều token nhất để audit payload.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-slate-100">
                    {performanceSummary.top_expensive?.map((req: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-3.5 hover:bg-slate-50/20 transition-colors flex items-center justify-between text-xs"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700 uppercase tracking-wider">
                              {req.mode}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1 rounded">
                              {req.model}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {new Date(req.created_at).toLocaleString("vi-VN")} · Độ trễ:{" "}
                            {(req.latency_ms / 1000).toFixed(2)}s
                          </p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="text-rose-600 font-black font-mono text-sm">
                            ${(req.estimated_cost_usd ?? 0).toFixed(4)}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {req.total_tokens?.toLocaleString()} tokens
                          </p>
                        </div>
                      </div>
                    ))}
                    {(!performanceSummary.top_expensive ||
                      performanceSummary.top_expensive.length === 0) && (
                      <div className="p-8 text-center text-slate-400">Không có dữ liệu.</div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Cache Stats */}
                <Card className="shadow-sm border-slate-200">
                  <CardHeader className="pb-3 border-b border-slate-100">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                      <DatabaseZap className="w-4 h-4 text-indigo-500" /> Trạng thái bộ nhớ đệm (AI
                      Cache Table)
                    </CardTitle>
                    <CardDescription>
                      Số lượng bản ghi và số lần cache hit được lưu trữ.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50/40 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="p-3 pl-4">Loại Cache</th>
                            <th className="p-3">Tổng Bản ghi</th>
                            <th className="p-3">Đang Hoạt động</th>
                            <th className="p-3 text-right pr-4">Số lượt Hit</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {performanceSummary.cache_stats?.map((cache: any, idx: number) => (
                            <tr key={idx} className="hover:bg-slate-50/30 transition-colors">
                              <td className="p-3 pl-4 font-bold text-slate-800">
                                <code className="bg-slate-100 px-1.5 py-0.5 rounded text-indigo-700 font-mono text-[11px]">
                                  {cache.cache_type}
                                </code>
                              </td>
                              <td className="p-3 text-slate-600 font-medium">
                                {cache.total_entries?.toLocaleString()}
                              </td>
                              <td className="p-3">
                                <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold text-[10px]">
                                  {cache.active_entries?.toLocaleString()}
                                </span>
                              </td>
                              <td className="p-3 text-right pr-4 text-indigo-600 font-bold font-mono">
                                {cache.total_hits?.toLocaleString() ?? 0} hits
                              </td>
                            </tr>
                          ))}
                          {(!performanceSummary.cache_stats ||
                            performanceSummary.cache_stats.length === 0) && (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-slate-400">
                                Chưa có bản ghi cache nào trong database.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-2" />
              Đang tải dữ liệu Performance AI...
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
