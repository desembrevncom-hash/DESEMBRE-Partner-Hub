import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { academyAdminEnrollmentApi, AcademyEnrollment, AcademyEnrollmentStatus } from "@/features/academy/services/academyAdminEnrollmentApi";
import { Search, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/academy-enrollments")({
  component: AcademyEnrollmentsAdmin,
});

function AcademyEnrollmentsAdmin() {
  const [enrollments, setEnrollments] = useState<AcademyEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<AcademyEnrollmentStatus | "all">("all");
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const data = await academyAdminEnrollmentApi.listEnrollments(
        statusFilter === "all" ? null : statusFilter,
        search
      );
      setEnrollments(data);
    } catch (error) {
      toast.error("Failed to load enrollments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
  }, [statusFilter, search]);

  const handleApprove = async (id: string) => {
    if (!confirm("Are you sure you want to approve this enrollment?")) return;
    setProcessingId(id);
    try {
      await academyAdminEnrollmentApi.approveEnrollment(id);
      toast.success("Enrollment approved");
      fetchEnrollments();
    } catch (error) {
      toast.error("Failed to approve enrollment");
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (!reason) return;
    setProcessingId(id);
    try {
      await academyAdminEnrollmentApi.rejectEnrollment(id, reason);
      toast.success("Enrollment rejected");
      fetchEnrollments();
    } catch (error) {
      toast.error("Failed to reject enrollment");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Academy Enrollments</h1>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-lg shadow-sm border border-slate-100">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student, email, or course..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="active">Active</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Course</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                    Loading enrollments...
                  </td>
                </tr>
              ) : enrollments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No enrollments found.
                  </td>
                </tr>
              ) : (
                enrollments.map((enrollment) => (
                  <tr key={enrollment.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">{enrollment.student.id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900">{enrollment.course.title}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          enrollment.status === "active"
                            ? "bg-green-100 text-green-800"
                            : enrollment.status === "pending"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {enrollment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(enrollment.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {enrollment.status === "pending" && (
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleApprove(enrollment.id)}
                            disabled={processingId === enrollment.id}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleReject(enrollment.id)}
                            disabled={processingId === enrollment.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
