import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ManualReviewQueue } from "./-components/ManualReviewQueue";

export const Route = createFileRoute("/admin/identity-resolution/")({
  component: IdentityResolutionPage,
});

function IdentityResolutionPage() {
  const { isManager } = useAuth();
  const [activeTab, setActiveTab] = useState<"unresolved" | "duplicate_candidates">("unresolved");
  const [unlinkedEvents, setUnlinkedEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isManager && activeTab === "unresolved") {
      fetchUnlinkedEvents();
    }
  }, [isManager, activeTab]);

  const fetchUnlinkedEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("facebook_identity_events")
      .select("*")
      .eq("processing_status", "unlinked")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setUnlinkedEvents(data);
    }
    setLoading(false);
  };

  const handleIgnore = async (id: string) => {
    const { error } = await supabase
      .from("facebook_identity_events")
      .update({ processing_status: "ignored" })
      .eq("id", id);
      
    if (!error) {
      setUnlinkedEvents((prev) => prev.filter((e) => e.id !== id));
    }
  };

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

        {activeTab === "unresolved" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-700 mb-4 px-1">1. Phân giải Link thủ công</h2>
              <ManualReviewQueue />
            </div>

            <div>
              <h2 className="text-lg font-bold text-slate-700 mb-4 px-1">2. Tin nhắn Mồ côi (Unlinked PSID)</h2>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                {loading ? (
                  <div className="text-center py-10 text-slate-500">Đang tải...</div>
                ) : unlinkedEvents.length === 0 ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <span className="text-2xl text-slate-400">🕵️</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu</h3>
                    <p className="text-slate-500 text-sm max-w-sm mx-auto">
                      Hàng chờ trống. Không có sự kiện Messenger nào bị mồ côi.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 text-slate-500 uppercase text-xs">
                          <th className="py-3 px-4 font-bold">Thời gian</th>
                          <th className="py-3 px-4 font-bold">Page ID</th>
                          <th className="py-3 px-4 font-bold">PSID</th>
                          <th className="py-3 px-4 font-bold">Nội dung</th>
                          <th className="py-3 px-4 font-bold text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unlinkedEvents.map((event) => {
                          const snippet = event.source_payload?._extracted_snippet || event.source_payload?.message?.text || "Không có nội dung";
                          const maskedPsid = event.facebook_psid ? String(event.facebook_psid).substring(0, 4) + "..." + String(event.facebook_psid).slice(-4) : "N/A";
                          
                          return (
                            <tr key={event.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                              <td className="py-3 px-4 text-slate-600">
                                {new Date(event.created_at).toLocaleString("vi-VN")}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-700">
                                {event.facebook_page_id || "N/A"}
                              </td>
                              <td className="py-3 px-4 font-mono text-xs text-slate-700 font-bold">
                                {maskedPsid}
                              </td>
                              <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={snippet}>
                                {snippet}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => handleIgnore(event.id)}
                                  className="text-xs font-bold text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors border border-rose-200"
                                >
                                  Bỏ qua
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === "duplicate_candidates" && (
           <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center min-h-[400px] flex flex-col items-center justify-center">
             <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <span className="text-2xl text-slate-400">🕵️</span>
             </div>
             <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa có dữ liệu</h3>
             <p className="text-slate-500 text-sm max-w-sm mx-auto">
               Chưa có tính năng này trong MVP.
             </p>
           </div>
        )}
      </div>
    </div>
  );
}
