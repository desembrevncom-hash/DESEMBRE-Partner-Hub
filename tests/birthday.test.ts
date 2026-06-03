import { describe, it, expect } from "vitest";

// Frontend validation logic to be tested
function validateBirthday(
  day: number | null,
  month: number | null,
  year: number | null,
): { valid: boolean; error?: string } {
  // Both present or both null rule
  if ((day === null && month !== null) || (day !== null && month === null)) {
    return { valid: false, error: "Ngày và tháng sinh nhật phải cùng có giá trị hoặc cùng trống" };
  }

  if (month !== null && day !== null) {
    if (month < 1 || month > 12) {
      return { valid: false, error: "Tháng sinh nhật không hợp lệ (phải từ 1 đến 12)" };
    }
    if (day < 1 || day > 31) {
      return { valid: false, error: "Ngày sinh nhật không hợp lệ (phải từ 1 đến 31)" };
    }

    // Check day limit for months
    if ([4, 6, 9, 11].includes(month) && day > 30) {
      return { valid: false, error: `Tháng ${month} chỉ có tối đa 30 ngày` };
    }

    if (month === 2 && day > 29) {
      return { valid: false, error: "Tháng 2 chỉ có tối đa 29 ngày (năm nhuận)" };
    }
  }

  if (year !== null) {
    const currentYear = new Date().getFullYear();
    if (year < 1900 || year > currentYear) {
      return { valid: false, error: `Năm sinh nhật phải từ 1900 đến ${currentYear}` };
    }
  }

  return { valid: true };
}

// Preferred channel validation
function validatePreferredChannel(channel: string): boolean {
  return ["none", "zalo", "phone", "email", "other"].includes(channel);
}

describe("E. Birthday Reminder & Contacts MVP Validations", () => {
  describe("1. Birthday Month/Day Validation Rules", () => {
    it("birthday_month invalid (>12) should block", () => {
      const res = validateBirthday(1, 13, 2026);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Tháng sinh nhật không hợp lệ");
    });

    it("birthday_month invalid (<1) should block", () => {
      const res = validateBirthday(1, 0, 2026);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Tháng sinh nhật không hợp lệ");
    });

    it("April 31 should block", () => {
      const res = validateBirthday(31, 4, 2026);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("chỉ có tối đa 30 ngày");
    });

    it("February 30 should block", () => {
      const res = validateBirthday(30, 2, 2026);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("Tháng 2 chỉ có tối đa 29 ngày");
    });

    it("February 29 should be allowed", () => {
      const res = validateBirthday(29, 2, 2026);
      expect(res.valid).toBe(true);
    });

    it("month/day both null should be allowed", () => {
      const res = validateBirthday(null, null, null);
      expect(res.valid).toBe(true);
    });

    it("month present, day null should block", () => {
      const res = validateBirthday(null, 5, null);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("phải cùng có giá trị hoặc cùng trống");
    });

    it("month null, day present should block", () => {
      const res = validateBirthday(12, null, null);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("phải cùng có giá trị hoặc cùng trống");
    });
  });

  describe("2. Preferred Channel Enum Rules", () => {
    it("preferred_channel standard values should be valid", () => {
      expect(validatePreferredChannel("none")).toBe(true);
      expect(validatePreferredChannel("zalo")).toBe(true);
      expect(validatePreferredChannel("phone")).toBe(true);
      expect(validatePreferredChannel("email")).toBe(true);
      expect(validatePreferredChannel("other")).toBe(true);
    });

    it("preferred_channel invalid values should be blocked", () => {
      expect(validatePreferredChannel("sms")).toBe(false);
      expect(validatePreferredChannel("telegram")).toBe(false);
      expect(validatePreferredChannel("")).toBe(false);
    });
  });

  describe("3. Worker Dry-run and Execution Safety Rules", () => {
    // Mock simulation for SQL stored procedure
    function runBirthdayWorkerProcedure(
      p_dry_run: boolean,
      p_confirm_phrase: string,
      system_setting_worker_enabled: boolean,
    ) {
      // If worker disabled in system settings and not dry-run => Error
      if (!system_setting_worker_enabled && !p_dry_run) {
        return {
          status: "error",
          message: "Birthday reminder worker is disabled in system_settings.",
          dbWrites: false,
        };
      }

      // If dry-run, always return success without DB writes
      if (p_dry_run) {
        return {
          status: "success",
          dry_run: true,
          processed_reminders_count: 1,
          created_tasks_count: 0,
          dbWrites: false,
        };
      }

      // If not dry-run and wrong phrase => Error
      if (p_confirm_phrase !== "PROCESS_BIRTHDAY_REMINDERS") {
        return {
          status: "error",
          message: "Invalid confirmation phrase for actual metadata database writes.",
          dbWrites: false,
        };
      }

      // Real execution
      return {
        status: "success",
        dry_run: false,
        processed_reminders_count: 1,
        created_tasks_count: 1,
        dbWrites: true,
      };
    }

    it("worker dry-run=true creates no DB writes", () => {
      const res = runBirthdayWorkerProcedure(true, "", false);
      expect(res.status).toBe("success");
      expect(res.dbWrites).toBe(false);
      expect(res.created_tasks_count).toBe(0);
    });

    it("worker confirm without settings enabled blocks execution", () => {
      const res = runBirthdayWorkerProcedure(false, "PROCESS_BIRTHDAY_REMINDERS", false);
      expect(res.status).toBe("error");
      expect(res.message).toContain("disabled in system_settings");
      expect(res.dbWrites).toBe(false);
    });

    it("worker confirm with correct phrase and settings enabled allows DB writes", () => {
      const res = runBirthdayWorkerProcedure(false, "PROCESS_BIRTHDAY_REMINDERS", true);
      expect(res.status).toBe("success");
      expect(res.dbWrites).toBe(true);
      expect(res.created_tasks_count).toBe(1);
    });

    it("worker confirm with wrong phrase blocks DB writes", () => {
      const res = runBirthdayWorkerProcedure(false, "WRONG_PHRASE", true);
      expect(res.status).toBe("error");
      expect(res.message).toContain("Invalid confirmation phrase");
      expect(res.dbWrites).toBe(false);
    });
  });
});
