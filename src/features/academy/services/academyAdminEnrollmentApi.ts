import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AcademyEnrollmentStatus = "pending" | "active" | "rejected";

export interface AcademyStudentAccount {
  id: string;
  user_id: string;
  customer_id: string;
  status: string;
  created_at: string;
  email: string | null;
  display_name: string | null;
  phone: string | null;
  enrollment_count: number;
}

export interface AcademyEnrollment {
  id: string;
  status: AcademyEnrollmentStatus;
  source: string;
  created_at: string;
  student: {
    id: string;
    user_id: string;
    customer_id: string;
  };
  course: {
    id: string;
    title: string;
    slug: string;
  };
}

export const academyAdminEnrollmentApi = {
  /**
   * List enrollments with optional status and search filters
   */
  async listEnrollments(
    status?: AcademyEnrollmentStatus | null,
    search?: string | null,
    courseId?: string | null
  ): Promise<AcademyEnrollment[]> {
    const { data, error } = await supabase.rpc("admin_list_academy_enrollments", {
      p_status: status || null,
      p_search: search || null,
      p_course_id: courseId || null,
    });

    if (error) {
      console.error("Error fetching academy enrollments:", error);
      throw error;
    }

    return (data as unknown) as AcademyEnrollment[];
  },

  /**
   * Approve a pending or active enrollment
   */
  async approveEnrollment(enrollmentId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("admin_approve_academy_enrollment", {
      p_enrollment_id: enrollmentId,
    });

    if (error) {
      console.error("Error approving enrollment:", error);
      throw error;
    }

    // @ts-ignore
    return !!data?.success;
  },

  /**
   * Reject a pending or active enrollment
   */
  async rejectEnrollment(enrollmentId: string, reason: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("admin_reject_academy_enrollment", {
      p_enrollment_id: enrollmentId,
      p_reason: reason,
    });

    if (error) {
      console.error("Error rejecting enrollment:", error);
      throw error;
    }

    // @ts-ignore
    return !!data?.success;
  },

  /**
   * List students with optional status and search filters
   */
  async listStudents(
    status?: string | null,
    search?: string | null
  ): Promise<AcademyStudentAccount[]> {
    const { data, error } = await supabase.rpc("admin_list_academy_students", {
      p_status: status || null,
      p_search: search || null,
    });

    if (error) {
      console.error("Error fetching academy students:", error);
      throw error;
    }

    return (data as unknown) as AcademyStudentAccount[];
  },

  /**
   * Get student details including active and past enrollments
   */
  async getStudentDetails(studentId: string): Promise<any> {
    const { data, error } = await supabase.rpc("admin_get_academy_student_details", {
      p_student_id: studentId,
    });

    if (error) {
      console.error("Error fetching student details:", error);
      throw error;
    }

    return data;
  },

  /**
   * Manually assign a course to a student
   */
  async assignCourseToStudent(studentId: string, courseId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc("admin_assign_academy_course_to_student", {
      p_student_id: studentId,
      p_course_id: courseId,
    });

    if (error) {
      console.error("Error assigning course to student:", error);
      throw error;
    }

    // @ts-ignore
    return !!data?.success;
  },
};
