import { SupabaseClient } from "@supabase/supabase-js";

export interface SegmentRules {
  has_email?: boolean;
  has_phone?: boolean;
  exclude_opt_outs?: boolean;
  created_after?: string; // YYYY-MM-DD
  created_before?: string; // YYYY-MM-DD
  lifecycle_stages?: string[];
  lead_sources?: string[];
}

/**
 * Applies the given rules to a Supabase query builder.
 * Use this for counting or fetching samples.
 */
export function applySegmentRulesToQuery(query: any, rules: SegmentRules) {
  if (rules.has_email) {
    query = query.not("email", "is", null).neq("email", "");
  }
  
  if (rules.has_phone) {
    query = query.not("phone", "is", null).neq("phone", "");
  }
  
  if (rules.exclude_opt_outs) {
    // Exclude those who have opted out.
    query = query.is("marketing_opt_out_at", null);
  }
  
  if (rules.created_after) {
    query = query.gte("created_at", rules.created_after + "T00:00:00.000Z");
  }
  
  if (rules.created_before) {
    query = query.lte("created_at", rules.created_before + "T23:59:59.999Z");
  }
  
  if (rules.lifecycle_stages && rules.lifecycle_stages.length > 0) {
    query = query.in("lifecycle_stage", rules.lifecycle_stages);
  }
  
  if (rules.lead_sources && rules.lead_sources.length > 0) {
    query = query.in("lead_source", rules.lead_sources);
  }
  
  return query;
}
/**
 * Backward-compatible helper for legacy campaign creation page.
 * Used by src/routes/marketing/campaigns/new.tsx.
 */
/**
 * Legacy-compatible segment rules helpers.
 * These are required by existing campaign routes and tests on master.
 */

type LegacySegmentRule = {
  field?: string;
  operator?: string;
  value?: unknown;
  type?: "AND" | "OR";
  rules?: LegacySegmentRule[];
};

type LegacyFilterRulesJson = {
  group?: LegacySegmentRule;
  rules?: LegacySegmentRule[];
};

const ALLOWED_SEGMENT_FIELDS = new Set([
  "stage",
  "has_valid_phone",
  "phone_is_facebook_uid",
  "has_email",
  "UNASSIGNED",
]);

const ALLOWED_SEGMENT_OPERATORS = new Set([
  "equals",
  "not_equals",
  "contains",
  "in",
]);

function getRootGroup(rules: any): LegacySegmentRule | null {
  if (!rules || typeof rules !== "object") return null;

  if (rules.group && typeof rules.group === "object") {
    return rules.group;
  }

  if (Array.isArray(rules.rules)) {
    return {
      type: rules.type === "OR" ? "OR" : "AND",
      rules: rules.rules,
    };
  }

  return null;
}

function isFacebookUidLikePhone(phone: unknown): boolean {
  const value = String(phone ?? "").trim();
  return /^\d{13,20}$/.test(value);
}

function hasValidPhone(phone: unknown): boolean {
  const value = String(phone ?? "").trim();
  if (!value) return false;
  if (isFacebookUidLikePhone(value)) return false;

  const digits = value.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 12;
}

function getDerivedCustomerField(customer: any, field: string): unknown {
  switch (field) {
    case "has_valid_phone":
      return hasValidPhone(customer?.phone);

    case "phone_is_facebook_uid":
      return isFacebookUidLikePhone(customer?.phone);

    case "has_email":
      return Boolean(String(customer?.email ?? "").trim());

    case "UNASSIGNED":
      return !customer?.owner_sale_id && !customer?.owner_tele_id;

    default:
      return customer?.[field];
  }
}

function evaluateCondition(customer: any, rule: LegacySegmentRule): boolean {
  const field = rule.field ?? "";
  const operator = rule.operator ?? "";
  const expectedValue = rule.value;
  const actualValue = getDerivedCustomerField(customer, field);

  switch (operator) {
    case "equals":
      if (typeof expectedValue === "boolean") {
        return Boolean(actualValue) === expectedValue;
      }
      return String(actualValue ?? "").toLowerCase() === String(expectedValue ?? "").toLowerCase();

    case "not_equals":
      if (typeof expectedValue === "boolean") {
        return Boolean(actualValue) !== expectedValue;
      }
      return String(actualValue ?? "").toLowerCase() !== String(expectedValue ?? "").toLowerCase();

    case "contains":
      return String(actualValue ?? "").toLowerCase().includes(String(expectedValue ?? "").toLowerCase());

    case "in":
      return Array.isArray(expectedValue) && expectedValue.includes(actualValue);

    default:
      return false;
  }
}

function validateRuleNode(node: LegacySegmentRule, depth: number): boolean {
  if (!node || typeof node !== "object") return false;

  if (Array.isArray(node.rules)) {
    if (depth > 2) return false;
    if (node.type !== "AND" && node.type !== "OR") return false;
    return node.rules.every((child) => validateRuleNode(child, depth + 1));
  }

  if (!node.field || !ALLOWED_SEGMENT_FIELDS.has(node.field)) return false;
  if (!node.operator || !ALLOWED_SEGMENT_OPERATORS.has(node.operator)) return false;

  return true;
}

export function validateSegmentRules(rules: LegacyFilterRulesJson): boolean {
  const rootGroup = getRootGroup(rules);
  if (!rootGroup) return false;

  return validateRuleNode(rootGroup, 1);
}

function evaluateRuleNode(customer: any, node: LegacySegmentRule): boolean {
  if (Array.isArray(node.rules)) {
    const results = node.rules.map((child) => evaluateRuleNode(customer, child));

    if (node.type === "OR") {
      return results.some(Boolean);
    }

    return results.every(Boolean);
  }

  return evaluateCondition(customer, node);
}

export function evaluateCustomerAgainstSegment(customer: any, rules: LegacyFilterRulesJson): boolean {
  const rootGroup = getRootGroup(rules);
  if (!rootGroup) return true;

  return evaluateRuleNode(customer, rootGroup);
}

export function evaluateAudience(customers: any[] = [], rules: LegacyFilterRulesJson = {}) {
  const customerList = Array.isArray(customers) ? customers : [];

  return customerList.filter((customer) => evaluateCustomerAgainstSegment(customer, rules));
}

export function getAudienceStats(customers: any[] = [], rules: LegacyFilterRulesJson = {}) {
  const customerList = Array.isArray(customers) ? customers : [];
  const matchedCustomers = evaluateAudience(customerList, rules);

  const skippedReasons: Record<string, number> = {};

  const callableCount = matchedCustomers.filter((customer) => hasValidPhone(customer?.phone)).length;
  const emailCount = matchedCustomers.filter((customer) => Boolean(String(customer?.email ?? "").trim())).length;
  const facebookCount = matchedCustomers.filter((customer) => Boolean(String(customer?.facebook_uid ?? "").trim())).length;
  const missingPhoneCount = matchedCustomers.filter((customer) => !hasValidPhone(customer?.phone)).length;
  const dataQualityIssueCount = matchedCustomers.filter((customer) => isFacebookUidLikePhone(customer?.phone)).length;
  const unassignedCount = matchedCustomers.filter((customer) => !customer?.owner_sale_id && !customer?.owner_tele_id).length;

  if (dataQualityIssueCount > 0) {
    skippedReasons["Phone contains Facebook UID"] = dataQualityIssueCount;
  }

  return {
    total_customers: customerList.length,
    matched_customers: matchedCustomers.length,
    unmatched_customers: customerList.length - matchedCustomers.length,
    match_rate:
      customerList.length > 0
        ? Math.round((matchedCustomers.length / customerList.length) * 100)
        : 0,
    callable_count: callableCount,
    email_count: emailCount,
    facebook_count: facebookCount,
    missing_phone_count: missingPhoneCount,
    data_quality_issue_count: dataQualityIssueCount,
    unassigned_count: unassignedCount,
    skipped_reasons: skippedReasons,
  };
}