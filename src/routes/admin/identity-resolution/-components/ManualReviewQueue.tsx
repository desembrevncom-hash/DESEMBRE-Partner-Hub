import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { useManualReviewJobsQuery, useResolveManualReviewJobMutation, ManualReviewJob, useTriggerAutoResolveMutation } from "@/lib/customers/facebookIdentityApi";
import { toast } from "sonner";
import { Copy, ExternalLink, AlertCircle, CheckCircle2, RefreshCw, Clock, AlertTriangle, XCircle, Search } from "lucide-react";

export function ManualReviewQueue() {
  const { data: jobs, isLoading, error, refetch } = useManualReviewJobsQuery();

  useEffect(() => {
    if (!jobs) return;
    const hasResolving = jobs.some(j => j.auto_resolve_status === 'resolving' || j.auto_resolve_status === 'queued');
    if (hasResolving) {
      const timer = setInterval(() => {
        refetch();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [jobs, refetch]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8 text-slate-500">
        Đang tải dữ liệu...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-lg">
        Lỗi tải dữ liệu: {error.message}
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <span className="text-2xl text-slate-400">🕵️</span>
        </div>
        <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu</h3>
        <p className="text-slate-500 text-sm max-w-sm mx-auto">
          Hàng chờ trống. Không có link Facebook nào cần phân giải thủ công.
        </p>
      </div>
    );
  }

  return (
    <SafeManualReviewQueueWrapper>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Link / Username</th>
                <th className="px-4 py-3 w-72">Thao tác xử lý UID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <SafeJobRow key={job.id} job={job} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </SafeManualReviewQueueWrapper>
  );
}

class SafeManualReviewQueueWrapper extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 text-red-600 rounded-lg">
          Lỗi render Queue: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}

class SafeJobRow extends React.Component<{ job: ManualReviewJob }, { hasError: boolean; error: any }> {
  state = { hasError: false, error: null };
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <tr>
          <td colSpan={3} className="px-4 py-3 text-red-500 bg-red-50">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Lỗi render Row: {this.state.error?.message}
          </td>
        </tr>
      );
    }
    return <JobRow job={this.props.job} />;
  }
}

function JobRow({ job }: { job: ManualReviewJob }) {
  const [uidInput, setUidInput] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const resolveMutation = useResolveManualReviewJobMutation();
  const autoResolveMutation = useTriggerAutoResolveMutation();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy: " + text);
  };

  const handleTriggerAuto = () => {
    autoResolveMutation.mutate(job.id, {
      onSuccess: () => {
        toast.success("Đã gửi yêu cầu tự động phân giải ở chế độ nền.");
      },
      onError: (err) => {
        toast.error("Không thể kích hoạt tự động phân giải: " + err.message);
      }
    });
  };

  const renderAutoStatus = () => {
    const status = job.auto_resolve_status || "not_attempted";
    if (status === "not_attempted") return null;
    
    let color = "bg-slate-100 text-slate-600 border-slate-200";
    let Icon = Clock;
    let label = "Chờ xử lý";

    switch (status) {
      case "queued":
      case "resolving":
        color = "bg-blue-50 text-blue-600 border-blue-200";
        Icon = RefreshCw;
        label = "Đang tìm tự động...";
        break;
      case "failed":
      case "not_found":
        color = "bg-amber-50 text-amber-600 border-amber-200";
        Icon = AlertTriangle;
        label = "Tự động tìm thất bại";
        break;
      case "timeout":
        color = "bg-orange-50 text-orange-600 border-orange-200";
        Icon = Clock;
        label = "Tự động tìm quá hạn";
        break;
      case "rate_limited":
        color = "bg-rose-50 text-rose-600 border-rose-200";
        Icon = AlertCircle;
        label = "Quá giới hạn API";
        break;
      case "disabled":
        color = "bg-slate-50 text-slate-500 border-slate-200";
        Icon = XCircle;
        label = "Tính năng tự động đang tắt";
        break;
    }

    return (
      <div className="mt-2 text-xs">
        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${color}`}>
          <Icon className={`w-3 h-3 ${status === "resolving" || status === "queued" ? "animate-spin" : ""}`} />
          <span className="font-medium">{label}</span>
        </div>
        {job.last_auto_resolve_error && (
          <div className="text-red-500 mt-1 italic break-words max-w-xs">
            Lỗi: {job.last_auto_resolve_error}
          </div>
        )}
      </div>
    );
  };

  const handleResolve = () => {
    setErrorMsg("");
    const trimmedUid = uidInput.trim();
    if (!trimmedUid) {
      setErrorMsg("Vui lòng nhập UID.");
      return;
    }
    if (!/^\d+$/.test(trimmedUid)) {
      setErrorMsg("UID phải là chuỗi số (chỉ chứa các chữ số).");
      return;
    }

    resolveMutation.mutate(
      { jobId: job.id, status: "resolved", numericUid: trimmedUid, note: note.trim() },
      {
        onSuccess: () => {
          toast.success("Đã cập nhật UID thành công");
        },
        onError: (err) => {
          toast.error("Lỗi cập nhật: " + err.message);
        },
      }
    );
  };

  const handleFail = () => {
    if (!confirm("Bạn có chắc chắn link này không thể phân giải hoặc bị lỗi?")) return;

    resolveMutation.mutate(
      { jobId: job.id, status: "failed", note: note.trim() },
      {
        onSuccess: () => {
          toast.success("Đã đánh dấu không xử lý được");
        },
        onError: (err) => {
          toast.error("Lỗi đánh dấu: " + err.message);
        },
      }
    );
  };

  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3 align-top">
        {(() => {
          const mainCustomer = Array.isArray(job.customers) ? job.customers[0] : job.customers;
          
          if (mainCustomer) {
            return (
              <div>
                {mainCustomer.id ? (
                  <Link
                    to="/customers/$id"
                    params={{ id: mainCustomer.id }}
                    className="font-bold text-indigo-600 hover:text-indigo-800"
                    target="_blank"
                  >
                    {mainCustomer.name}
                  </Link>
                ) : (
                  <span className="font-bold text-indigo-600">{mainCustomer.name}</span>
                )}
                {mainCustomer.phone && <div className="text-slate-500 mt-1">{mainCustomer.phone}</div>}
                <div className="text-xs text-slate-400 mt-1" title={new Date(job.created_at).toLocaleString()}>
                  {new Date(job.created_at).toLocaleDateString()}
                </div>
              </div>
            );
          }
          
          return <span className="text-slate-400">Khách hàng đã xóa</span>;
        })()}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2 max-w-xs break-all">
            <span className="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded">{job.raw_url || "Chưa có Link"}</span>
          </div>
          <div className="flex items-center gap-2">
            {job.raw_url ? (
              <>
                <a
                  href={job.raw_url.startsWith('http') ? job.raw_url : `https://${job.raw_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded"
                >
                  <ExternalLink className="w-3 h-3" /> Mở Link
                </a>
                <button
                  onClick={() => handleCopy(job.raw_url)}
                  className="flex items-center gap-1 text-xs text-slate-600 hover:bg-slate-200 bg-slate-100 px-2 py-1 rounded transition-colors"
                >
                  <Copy className="w-3 h-3" /> Copy Link
                </button>
              </>
            ) : (
              <span className="text-xs text-slate-400 italic">Không có link</span>
            )}
          </div>
          {renderAutoStatus()}
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
              placeholder="Nhập UID số..."
              value={uidInput}
              onChange={(e) => setUidInput(e.target.value)}
              className={`w-full text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                errorMsg ? "border-red-300 focus:ring-red-200" : "border-slate-300 focus:ring-indigo-100 focus:border-indigo-400"
              }`}
              disabled={resolveMutation.isPending}
            />
            {errorMsg && <div className="text-red-500 text-xs mt-1">{errorMsg}</div>}
            </div>
            <button
              onClick={handleTriggerAuto}
              disabled={autoResolveMutation.isPending || resolveMutation.isPending || job.auto_resolve_status === "resolving" || job.auto_resolve_status === "queued"}
              className="flex items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 text-xs font-bold px-3 rounded shadow-sm disabled:opacity-50 transition-colors whitespace-nowrap"
              title="Tìm UID tự động (nền)"
            >
              <Search className={`w-3 h-3 ${(autoResolveMutation.isPending || job.auto_resolve_status === "resolving") ? "animate-spin" : ""}`} /> Tìm tự động
            </button>
          </div>
          <input
            type="text"
            placeholder="Ghi chú (tùy chọn)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400"
            disabled={resolveMutation.isPending}
          />
          <div className="flex gap-2">
            <button
              onClick={handleResolve}
              disabled={resolveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-2 px-3 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3 h-3" /> Cập nhật UID
            </button>
            <button
              onClick={handleFail}
              disabled={resolveMutation.isPending}
              className="flex-1 flex items-center justify-center gap-1 bg-white hover:bg-red-50 text-red-600 border border-red-200 text-xs font-bold py-2 px-3 rounded shadow-sm disabled:opacity-50 transition-colors"
            >
              <AlertCircle className="w-3 h-3" /> Đánh dấu lỗi
            </button>
          </div>
          
          {/* Duplicate candidate warning & link */}
          {(job.status === 'duplicate_candidate' || job.auto_resolve_status === 'duplicate_detected') && (
            <div className="mt-2 bg-rose-50 border border-rose-200 p-3 rounded-lg text-xs text-rose-700">
              <div className="flex items-start gap-1 font-bold mb-2">
                <AlertCircle className="w-4 h-4 mt-0.5" /> Phát hiện trùng lặp UID!
              </div>
              <div className="mb-2">UID phân giải được đã thuộc về một khách hàng khác. Bạn cần kiểm tra xem đây là khách cũ hay khách mới bị trùng.</div>
              {(() => {
                const dupCustomer = Array.isArray(job.duplicate_profile?.customers) 
                  ? job.duplicate_profile?.customers[0] 
                  : job.duplicate_profile?.customers;
                  
                if (!dupCustomer) return null;
                
                return (
                  <div className="bg-white p-2 rounded border border-rose-100 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-800 truncate">{dupCustomer.name}</div>
                      <div className="text-slate-500 text-[10px] truncate">{dupCustomer.phone || 'Không có SĐT'}</div>
                    </div>
                    {dupCustomer.id && (
                      <Link
                        to="/customers/$id"
                        params={{ id: dupCustomer.id }}
                        target="_blank"
                        className="flex-shrink-0 flex items-center gap-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold px-2 py-1.5 rounded transition-colors whitespace-nowrap"
                      >
                        Mở khách cũ <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
