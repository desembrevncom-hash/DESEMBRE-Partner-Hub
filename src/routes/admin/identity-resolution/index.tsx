import { createFileRoute } from "@tanstack/react-router";
import React, { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/admin/identity-resolution/")({
  component: IdentityResolutionPage,
});

function IdentityResolutionPage() {
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState<"unresolved" | "duplicate_candidates">("unresolved");

  if (!isManager) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-800">Không có quyền truy cập</h2>
          <p className="text-slate-500 mt-2">Tính năng này dành cho Quản lý.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800">Identity Resolution Queue</h1>
          <p className="text-slate-500 mt-1">
            Xử lý các liên kết Facebook không xác định, lỗi phân giải, hoặc có khả năng trùng lặp cao.
          </p>
        </div>

        <div className="flex gap-2 border-b border-slate-200 pb-px">
          <button
            onClick={() => setActiveTab("unresolved")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "unresolved"
                ? "border-indigo-500 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Cần Xử Lý (Unresolved/Manual)
          </button>
          <button
            onClick={() => setActiveTab("duplicate_candidates")}
            className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
              activeTab === "duplicate_candidates"
                ? "border-amber-500 text-amber-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Nghi Ngờ Trùng Lặp (Duplicate Candidates)
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-2xl text-slate-400">🕵️</span>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            Hàng chờ trống. Các hồ sơ mồ côi (Unlinked PSID) hoặc Link URL bị lỗi phân giải sẽ xuất hiện ở đây.
          </p>
        </div>
      </div>
    </div>
  );
}
