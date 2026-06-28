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
export function getAudienceStats(customers: any[] = [], rules: any = {}) {
  const customerList = Array.isArray(customers) ? customers : [];

  const normalizedRules = rules?.rules ?? rules ?? {};
  const hasRules =
    normalizedRules &&
    typeof normalizedRules === "object" &&
    Object.keys(normalizedRules).length > 0;

  if (!hasRules) {
    return {
      total_customers: customerList.length,
      matched_customers: customerList.length,
      unmatched_customers: 0,
      match_rate: customerList.length > 0 ? 100 : 0,
    };
  }

  const matchedCustomers = customerList.filter((customer) => {
    return Object.entries(normalizedRules).every(([key, value]) => {
      if (value === undefined || value === null || value === "" || value === "all") {
        return true;
      }

      const customerValue = customer?.[key];

      if (Array.isArray(value)) {
        if (value.length === 0) return true;
        return value.includes(customerValue);
      }

      if (typeof value === "boolean") {
        return Boolean(customerValue) === value;
      }

      return String(customerValue ?? "").toLowerCase() === String(value).toLowerCase();
    });
  }).length;

  return {
    total_customers: customerList.length,
    matched_customers: matchedCustomers,
    unmatched_customers: customerList.length - matchedCustomers,
    match_rate:
      customerList.length > 0
        ? Math.round((matchedCustomers / customerList.length) * 100)
        : 0,
  };
}
/**
 * Backward-compatible helper for legacy campaign detail export page.
 * Used by src/routes/marketing/campaigns/$id.tsx.
 */
export function evaluateAudience(customers: any[] = [], rules: any = {}) {
  const customerList = Array.isArray(customers) ? customers : [];

  const normalizedRules = rules?.rules ?? rules ?? {};
  const hasRules =
    normalizedRules &&
    typeof normalizedRules === "object" &&
    Object.keys(normalizedRules).length > 0;

  if (!hasRules) {
    return customerList;
  }

  return customerList.filter((customer) => {
    return Object.entries(normalizedRules).every(([key, value]) => {
      if (value === undefined || value === null || value === "" || value === "all") {
        return true;
      }

      const customerValue = customer?.[key];

      if (Array.isArray(value)) {
        if (value.length === 0) return true;
        return value.includes(customerValue);
      }

      if (typeof value === "boolean") {
        return Boolean(customerValue) === value;
      }

      return String(customerValue ?? "").toLowerCase() === String(value).toLowerCase();
    });
  });
}