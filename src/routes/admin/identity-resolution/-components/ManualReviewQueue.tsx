import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useManualReviewJobsQuery, useResolveManualReviewJobMutation, ManualReviewJob } from "@/lib/customers/facebookIdentityApi";
import { toast } from "sonner";
import { Copy, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";

export function ManualReviewQueue() {
  const { data: jobs, isLoading, error } = useManualReviewJobsQuery();

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
              <JobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function JobRow({ job }: { job: ManualReviewJob }) {
  const [uidInput, setUidInput] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const resolveMutation = useResolveManualReviewJobMutation();

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Đã copy: " + text);
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
        {job.customers ? (
          <div>
            <Link
              to="/customers/$id"
              params={{ id: job.customers.id }}
              className="font-bold text-indigo-600 hover:text-indigo-800"
              target="_blank"
            >
              {job.customers.name}
            </Link>
            {job.customers.phone && <div className="text-slate-500 mt-1">{job.customers.phone}</div>}
            <div className="text-xs text-slate-400 mt-1" title={new Date(job.created_at).toLocaleString()}>
              {new Date(job.created_at).toLocaleDateString()}
            </div>
          </div>
        ) : (
          <span className="text-slate-400">Khách hàng đã xóa</span>
        )}
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2 max-w-xs break-all">
            <span className="text-slate-700 font-medium bg-slate-100 px-2 py-1 rounded">{job.raw_url}</span>
          </div>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </td>
      <td className="px-4 py-3 align-top">
        <div className="flex flex-col gap-2">
          <div>
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
        </div>
      </td>
    </tr>
  );
}
