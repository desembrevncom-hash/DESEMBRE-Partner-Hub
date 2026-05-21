import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { 
  ShieldAlert, 
  RefreshCw, 
  Save, 
  Download, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  HelpCircle,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/uat")({
  component: UATChecklistPage,
});

type ModuleStatus = 'NOT TESTED' | 'PASS' | 'FAIL';

interface ModuleData {
  status: ModuleStatus;
  tester: string;
  note: string;
  timestamp: string;
}

interface UATData {
  uatVersion: string;
  updatedAt: string;
  modules: Record<string, ModuleData>;
}

const MODULE_LIST = [
  { id: 'customers', name: 'Customers' },
  { id: 'routing', name: 'Routing' },
  { id: 'map_checkin', name: 'Map Check-in' },
  { id: 'automation', name: 'Automation' },
  { id: 'ai_suggestion', name: 'AI Suggestion' },
  { id: 'ai_rag', name: 'AI RAG' },
  { id: 'product_knowledge', name: 'Product Knowledge QA' },
  { id: 'notifications', name: 'Notifications' },
  { id: 'permissions', name: 'Permissions' },
  { id: 'tasks', name: 'Tasks' },
  { id: 'orders', name: 'Orders' },
];

const DEFAULT_DATA: UATData = {
  uatVersion: "2026-05-v1",
  updatedAt: new Date().toISOString(),
  modules: {}
};

MODULE_LIST.forEach(m => {
  DEFAULT_DATA.modules[m.id] = { status: 'NOT TESTED', tester: '', note: '', timestamp: '' };
});

function UATChecklistPage() {
  const { user, isAdmin, isSubAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<UATData>(DEFAULT_DATA);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("uatChecklist");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const merged = { ...DEFAULT_DATA, ...parsed, modules: { ...DEFAULT_DATA.modules, ...(parsed.modules || {}) } };
        setData(merged);
      } catch (e) {
        console.error("Failed to parse UAT checklist", e);
      }
    } else {
        setData(DEFAULT_DATA);
    }
  }, []);

  const isAuthorized = isAdmin || isSubAdmin;

  const handleModuleChange = (id: string, field: keyof ModuleData, value: string) => {
    setData(prev => ({
      ...prev,
      modules: {
        ...prev.modules,
        [id]: {
          ...prev.modules[id],
          [field]: value,
          timestamp: new Date().toISOString()
        }
      }
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    for (const m of MODULE_LIST) {
      const mData = data.modules[m.id];
      if ((mData.status === 'PASS' || mData.status === 'FAIL') && !mData.tester.trim()) {
        toast.error(`Vui lòng nhập tên Tester cho module: ${m.name}`);
        return;
      }
      if (mData.status === 'FAIL' && !mData.note.trim()) {
        toast.error(`Vui lòng nhập Ghi chú (Note) cho lỗi của module: ${m.name}`);
        return;
      }
    }

    const toSave = {
      ...data,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem("uatChecklist", JSON.stringify(toSave));
    setData(toSave);
    setHasChanges(false);
    toast.success("Đã lưu kết quả UAT Checklist thành công!");
  };

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `uat-checklist-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Đã xuất file JSON");
  };

  const handleReset = () => {
    if (window.confirm("Bạn có chắc chắn muốn XÓA TOÀN BỘ dữ liệu test không? Hành động này không thể hoàn tác!")) {
      localStorage.removeItem("uatChecklist");
      setData(DEFAULT_DATA);
      setHasChanges(false);
      toast.success("Đã reset toàn bộ checklist");
    }
  };

  const summary = useMemo(() => {
    const total = MODULE_LIST.length;
    let pass = 0;
    let fail = 0;
    let notTested = 0;

    Object.values(data.modules).forEach(m => {
      if (m.status === 'PASS') pass++;
      else if (m.status === 'FAIL') fail++;
      else notTested++;
    });

    const completion = total > 0 ? Math.round(((pass + fail) / total) * 100) : 0;

    return { total, pass, fail, notTested, completion };
  }, [data]);

  if (authLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin text-slate-400" />
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAuthorized) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center bg-slate-50 p-4 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mb-4">
          <ShieldAlert className="w-8 h-8 text-rose-600" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
        <p className="text-slate-500 text-sm max-w-sm mt-2">Tính năng UAT Checklist chỉ dành cho Administrator.</p>
        <Link to="/workspace" className="mt-6 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
          Quay lại Workspace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-7 h-7 text-indigo-600" />
            UAT Acceptance Checklist
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Theo dõi tiến độ nghiệm thu nội bộ (Phase A). Version: {data.uatVersion}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} className="text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl">
            <RotateCcw className="w-4 h-4 mr-2" /> Reset
          </Button>
          <Button variant="outline" onClick={handleExport} className="rounded-xl border-slate-200">
            <Download className="w-4 h-4 mr-2" /> Export JSON
          </Button>
          <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 relative">
            <Save className="w-4 h-4 mr-2" /> Save Changes
            {hasChanges && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full border-2 border-white" />}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card className="shadow-none border-slate-200 bg-white">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-slate-800">{summary.total}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Total Modules</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-emerald-100 bg-emerald-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-emerald-600">{summary.pass}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600/70 mt-1">Passed</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-rose-100 bg-rose-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-rose-600">{summary.fail}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-rose-600/70 mt-1">Failed</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-amber-100 bg-amber-50/50">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-3xl font-black text-amber-600">{summary.notTested}</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600/70 mt-1">Not Tested</span>
          </CardContent>
        </Card>
        <Card className="shadow-none border-indigo-100 bg-indigo-50/50 relative overflow-hidden">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center z-10 relative">
            <span className="text-3xl font-black text-indigo-600">{summary.completion}%</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-600/70 mt-1">Completion</span>
          </CardContent>
          <div 
            className="absolute bottom-0 left-0 h-1 bg-indigo-600 transition-all duration-1000" 
            style={{ width: `${summary.completion}%` }} 
          />
        </Card>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 bg-slate-50/80 text-xs font-black uppercase tracking-wider text-slate-500">
          <div className="col-span-3">Module Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Tester</div>
          <div className="col-span-3">Notes / Issues</div>
          <div className="col-span-2 text-right">Last Updated</div>
        </div>
        <div className="divide-y divide-slate-100">
          {MODULE_LIST.map((m) => {
            const mData = data.modules[m.id];
            
            const isFailed = mData.status === 'FAIL';
            const isPassed = mData.status === 'PASS';
            const isUntested = mData.status === 'NOT TESTED';

            return (
              <div key={m.id} className="grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-slate-50/50">
                <div className="col-span-3 font-bold text-slate-800 flex items-center gap-2 text-sm">
                  {isPassed && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {isFailed && <XCircle className="w-4 h-4 text-rose-500" />}
                  {isUntested && <HelpCircle className="w-4 h-4 text-slate-300" />}
                  {m.name}
                </div>
                
                <div className="col-span-2">
                  <select 
                    className={`w-full p-2 rounded-xl text-xs font-bold uppercase tracking-wider border outline-none transition-all
                      ${isPassed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                        isFailed ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                        'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'}`}
                    value={mData.status}
                    onChange={(e) => handleModuleChange(m.id, 'status', e.target.value)}
                  >
                    <option value="NOT TESTED">Not Tested</option>
                    <option value="PASS">Pass</option>
                    <option value="FAIL">Fail</option>
                  </select>
                </div>

                <div className="col-span-2 relative">
                  <input 
                    type="text" 
                    placeholder="Tên tester..."
                    className="w-full p-2 px-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-transparent"
                    value={mData.tester}
                    onChange={(e) => handleModuleChange(m.id, 'tester', e.target.value)}
                  />
                  {(isPassed || isFailed) && !mData.tester.trim() && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Required
                    </span>
                  )}
                </div>

                <div className="col-span-3 relative">
                  <input 
                    type="text" 
                    placeholder="Ghi chú lỗi, issue link..."
                    className="w-full p-2 px-3 rounded-xl border border-slate-200 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all bg-transparent"
                    value={mData.note}
                    onChange={(e) => handleModuleChange(m.id, 'note', e.target.value)}
                  />
                  {isFailed && !mData.note.trim() && (
                    <span className="text-[10px] text-rose-500 font-bold mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Required for FAIL
                    </span>
                  )}
                </div>

                <div className="col-span-2 text-right text-[11px] font-medium text-slate-400">
                  {mData.timestamp ? new Date(mData.timestamp).toLocaleString('vi-VN') : 'Never'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div className="mt-6 flex justify-between items-center text-xs text-slate-400 font-medium">
        <p>Lưu trữ nội bộ: localStorage. Cập nhật lần cuối: {new Date(data.updatedAt).toLocaleString('vi-VN')}</p>
        <p>Phase A - Tái cấu trúc CRM</p>
      </div>
    </div>
  );
}
