import { supabase } from "@/integrations/supabase/client";

/**
 * Lấy cấu hình chi tiết của một Automation Rule theo ID
 */
export async function getAutomationRule(ruleId: string) {
  try {
    const { data, error } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("id", ruleId)
      .maybeSingle();

    if (error) {
      console.error(`Error querying automation rule ${ruleId}:`, error);
      return null;
    }
    return data;
  } catch (err) {
    console.error(`Unexpected error getting automation rule ${ruleId}:`, err);
    return null;
  }
}

/**
 * Kiểm tra xem một Automation Rule có đang hoạt động hay không.
 * Nếu có lỗi hoặc không tìm thấy rule, mặc định trả về true để tránh làm hỏng luồng cũ.
 */
export async function isAutomationEnabled(ruleId: string): Promise<boolean> {
  try {
    const rule = await getAutomationRule(ruleId);
    if (!rule) {
      return true; // Fallback an toàn nếu không tìm thấy rule
    }
    return rule.is_enabled;
  } catch (err) {
    console.error(`Error checking isAutomationEnabled for ${ruleId}:`, err);
    return true; // Fallback an toàn nếu lỗi
  }
}

/**
 * Lấy cấu hình ngưỡng (threshold) của một Rule
 */
export async function getAutomationRuleConfig(ruleId: string) {
  try {
    const rule = await getAutomationRule(ruleId);
    if (!rule) return null;
    return {
      threshold_value: rule.threshold_value,
      threshold_unit: rule.threshold_unit,
      metadata: rule.metadata,
    };
  } catch (err) {
    console.error(`Error getting config for rule ${ruleId}:`, err);
    return null;
  }
}

interface ParsedThreshold {
  value: number;
  unit: "hours" | "days";
  source: "config" | "fallback";
}

/**
 * Lấy cấu hình ngưỡng (threshold) đã phân tích cú pháp an toàn.
 * Nếu cấu hình không hợp lệ hoặc truy vấn lỗi, trả về giá trị mặc định (fallback).
 */
export async function getParsedThreshold(
  ruleId: string,
  defaultValue: number,
  defaultUnit: "hours" | "days",
): Promise<ParsedThreshold> {
  try {
    const config = await getAutomationRuleConfig(ruleId);
    if (config && config.threshold_value != null && config.threshold_unit) {
      const val = Number(config.threshold_value);
      const unit = config.threshold_unit.toLowerCase();
      if (!isNaN(val) && val > 0 && (unit === "hours" || unit === "days")) {
        return {
          value: val,
          unit: unit as "hours" | "days",
          source: "config",
        };
      }
      console.warn(
        `[AutomationConfig] Invalid threshold config for rule '${ruleId}': value=${config.threshold_value}, unit=${config.threshold_unit}. Using fallback: ${defaultValue} ${defaultUnit}.`,
      );
    }
  } catch (err) {
    console.error(`Error parsing threshold for rule ${ruleId}:`, err);
  }
  return {
    value: defaultValue,
    unit: defaultUnit,
    source: "fallback",
  };
}
