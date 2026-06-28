import { FilterRulesJson, SegmentRule, SegmentRuleGroup, AudienceStats } from "./types";
import { getCustomerContactSummary } from "../customers/contactChannelClassifier";
import { getCustomerRemarketingProfile } from "../customers/customerRemarketing";

const MAX_NESTING_DEPTH = 2;
const MAX_RULES = 20;

export function validateSegmentRules(filterRules: FilterRulesJson): boolean {
  if (!filterRules || !filterRules.group) return false;
  
  let ruleCount = 0;
  
  function walkGroup(group: SegmentRuleGroup, depth: number): boolean {
    if (depth > MAX_NESTING_DEPTH) return false;
    if (!["AND", "OR"].includes(group.type)) return false;
    if (!Array.isArray(group.rules)) return false;
    
    for (const item of group.rules) {
      if ('type' in item) {
        if (!walkGroup(item as SegmentRuleGroup, depth + 1)) return false;
      } else {
        ruleCount++;
        if (ruleCount > MAX_RULES) return false;
        
        const rule = item as SegmentRule;
        const validOperators = ["equals", "not_equals", "in", "not_in", "contains", "exists", "not_exists", "before", "after", "between"];
        if (!validOperators.includes(rule.operator)) return false;
        
        // whitelist fields
        const validFields = [
          "stage", "status", "source", "province", "city", "owner_sale_id", "owner_tele_id", "created_at",
          "has_valid_phone", "has_zalo_capable_phone", "has_email", "has_facebook_url", "has_facebook_uid",
          "has_any_contact_channel", "has_data_quality_issue", "phone_possibly_missing_leading_zero", "phone_is_facebook_uid",
          "CALL_READY", "ZALO_READY", "FACEBOOK_READY", "EMAIL_READY", "HAS_FACEBOOK_NO_PHONE", "NEEDS_PHONE", "DATA_CLEANUP_REQUIRED", "UNASSIGNED"
        ];
        if (!validFields.includes(rule.field)) return false;
      }
    }
    return true;
  }
  
  return walkGroup(filterRules.group, 1);
}

function evaluateRule(customer: any, rule: SegmentRule, summary: any, remarketing: any): boolean {
  let actualValue: any;
  
  // Extract actual value based on field type
  switch (rule.field) {
    case "stage":
    case "status":
      actualValue = customer.stage || customer.status; break;
    case "source": actualValue = customer.source; break;
    case "province":
    case "city":
      actualValue = customer.province || customer.city; break;
    case "owner_sale_id": actualValue = customer.owner_sale_id; break;
    case "owner_tele_id": actualValue = customer.owner_tele_id; break;
    case "created_at": actualValue = customer.created_at; break;
      
    case "has_valid_phone": actualValue = !!summary.callablePhone; break;
    case "has_zalo_capable_phone": actualValue = !!summary.zaloPhone; break;
    case "has_email": actualValue = !!summary.email; break;
    case "has_facebook_url": actualValue = !!summary.facebookUrl; break;
    case "has_facebook_uid": actualValue = !!summary.facebookUid; break;
    case "has_any_contact_channel": actualValue = !!summary.primaryPhone || !!summary.email || !!summary.facebookUrl || !!summary.facebookUid; break;
    case "has_data_quality_issue": actualValue = summary.dataQualityIssues.length > 0; break;
    case "phone_possibly_missing_leading_zero": 
      actualValue = summary.dataQualityIssues.some((i: any) => i.code === "PHONE_POSSIBLY_MISSING_LEADING_ZERO"); break;
    case "phone_is_facebook_uid":
      actualValue = summary.dataQualityIssues.some((i: any) => i.code === "PHONE_IS_FACEBOOK_UID"); break;
      
    case "CALL_READY":
    case "ZALO_READY":
    case "FACEBOOK_READY":
    case "EMAIL_READY":
    case "HAS_FACEBOOK_NO_PHONE":
    case "NEEDS_PHONE":
    case "DATA_CLEANUP_REQUIRED":
    case "UNASSIGNED":
      actualValue = remarketing.recommendedSegments.includes(rule.field); break;
    default:
      return false; // Unknown field
  }

  // Evaluate operator
  switch (rule.operator) {
    case "equals": return String(actualValue).toLowerCase() === String(rule.value).toLowerCase();
    case "not_equals": return String(actualValue).toLowerCase() !== String(rule.value).toLowerCase();
    case "in": return Array.isArray(rule.value) && rule.value.some(v => String(v).toLowerCase() === String(actualValue).toLowerCase());
    case "not_in": return Array.isArray(rule.value) && !rule.value.some(v => String(v).toLowerCase() === String(actualValue).toLowerCase());
    case "contains": return String(actualValue).toLowerCase().includes(String(rule.value).toLowerCase());
    case "exists": return actualValue !== null && actualValue !== undefined && actualValue !== false && actualValue !== "";
    case "not_exists": return actualValue === null || actualValue === undefined || actualValue === false || actualValue === "";
    case "before": return new Date(actualValue) < new Date(rule.value);
    case "after": return new Date(actualValue) > new Date(rule.value);
    case "between": 
      if (!Array.isArray(rule.value) || rule.value.length !== 2) return false;
      const d = new Date(actualValue);
      return d >= new Date(rule.value[0]) && d <= new Date(rule.value[1]);
    default:
      return false;
  }
}

function evaluateGroup(customer: any, group: SegmentRuleGroup, summary: any, remarketing: any): boolean {
  if (group.rules.length === 0) return true; // Empty group matches all
  
  if (group.type === "AND") {
    for (const item of group.rules) {
      if ('type' in item) {
        if (!evaluateGroup(customer, item as SegmentRuleGroup, summary, remarketing)) return false;
      } else {
        if (!evaluateRule(customer, item as SegmentRule, summary, remarketing)) return false;
      }
    }
    return true;
  } else { // OR
    for (const item of group.rules) {
      if ('type' in item) {
        if (evaluateGroup(customer, item as SegmentRuleGroup, summary, remarketing)) return true;
      } else {
        if (evaluateRule(customer, item as SegmentRule, summary, remarketing)) return true;
      }
    }
    return false;
  }
}

export function evaluateCustomerAgainstSegment(customer: any, filterRules: FilterRulesJson): boolean {
  if (!validateSegmentRules(filterRules)) return false;
  const summary = getCustomerContactSummary(customer);
  const remarketing = getCustomerRemarketingProfile(customer);
  return evaluateGroup(customer, filterRules.group, summary, remarketing);
}

export function evaluateAudience(customers: any[], filterRules: FilterRulesJson): any[] {
  return customers.filter(c => evaluateCustomerAgainstSegment(c, filterRules));
}

export function getAudienceStats(customers: any[], filterRules: FilterRulesJson): AudienceStats {
  const stats: AudienceStats = {
    total_customers: customers.length,
    matched_customers: 0,
    callable_count: 0,
    zalo_count: 0,
    email_count: 0,
    facebook_count: 0,
    data_quality_issue_count: 0,
    missing_phone_count: 0,
    unassigned_count: 0,
    skipped_reasons: {},
    sample: []
  };

  if (!validateSegmentRules(filterRules)) return stats;

  for (const customer of customers) {
    const summary = getCustomerContactSummary(customer);
    const remarketing = getCustomerRemarketingProfile(customer);
    
    if (evaluateGroup(customer, filterRules.group, summary, remarketing)) {
      stats.matched_customers++;
      if (summary.callablePhone) stats.callable_count++;
      if (summary.zaloPhone) stats.zalo_count++;
      if (summary.email) stats.email_count++;
      if (summary.facebookUid || summary.facebookUrl) stats.facebook_count++;
      if (summary.dataQualityIssues.length > 0) {
        stats.data_quality_issue_count++;
        // track specific reasons
        for (const issue of summary.dataQualityIssues) {
          stats.skipped_reasons[issue.label] = (stats.skipped_reasons[issue.label] || 0) + 1;
        }
      }
      if (!summary.callablePhone) stats.missing_phone_count++;
      if (!customer.owner_sale_id && !customer.owner_tele_id) stats.unassigned_count++;
      
      if (stats.sample.length < 50) {
        stats.sample.push(customer);
      }
    }
  }
  
  return stats;
}
