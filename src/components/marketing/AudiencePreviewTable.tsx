import React from "react";
import { format } from "date-fns";

interface AudiencePreviewTableProps {
  data: any[];
  audienceCount: number;
}

export function AudiencePreviewTable({ data, audienceCount }: AudiencePreviewTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-slate-500">
        Không có khách hàng nào trong tập này.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-700">
        Preview 100 khách hàng đầu tiên (Tổng số: {audienceCount})
      </div>
      <div className="rounded-md border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
            <tr>
              <th className="px-4 py-2 font-semibold">Tên KH</th>
              <th className="px-4 py-2 font-semibold">SĐT</th>
              <th className="px-4 py-2 font-semibold">Email</th>
              <th className="px-4 py-2 font-semibold">Lý do nhận</th>
              <th className="px-4 py-2 font-semibold">Tương tác cuối</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((c, i) => (
              <tr key={c.id || i} className="hover:bg-slate-50">
                <td className="px-4 py-2 font-medium">{c.name || "Không rõ"}</td>
                <td className="px-4 py-2 text-slate-600">{c.phone || "—"}</td>
                <td className="px-4 py-2 text-slate-600">{c.email || "—"}</td>
                <td className="px-4 py-2 text-emerald-600">{c.reason}</td>
                <td className="px-4 py-2 text-slate-500">
                  {c.last_contacted_at ? format(new Date(c.last_contacted_at), "dd/MM/yyyy") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
