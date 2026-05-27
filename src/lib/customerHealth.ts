import { differenceInDays, isBefore } from "date-fns";

export interface HealthDataInput {
  created_at?: string | null;
  last_interaction_at?: string | null;
  next_follow_up_at?: string | null;
  owner_sale_id?: string | null;
  owner_tele_id?: string | null;
  lifecycle_stage?: string | null;
  total_orders?: number;
  total_revenue?: number;
  contact_channels?: any[];
  channel_summary?: any;
  task_summary?: any;
  open_tasks?: number;
  overdue_tasks?: number;
}

export type CustomerHealth = "good" | "warning" | "critical" | "unknown";
export type HeatLevel = "hot" | "warm" | "cold" | "frozen";

export function getCustomerHealth(customer: HealthDataInput): CustomerHealth {
  const flags = getRiskFlags(customer);
  if (flags.includes("At Risk") || flags.includes("No Follow-up") || flags.includes("Overdue Follow-up")) {
    return "critical";
  }
  if (
    flags.includes("Missing Social") || 
    flags.includes("Missing Phone") || 
    flags.includes("Inactive 7d") || 
    flags.includes("Unassigned")
  ) {
    return "warning";
  }
  if (!customer.created_at) return "unknown";
  return "good";
}

export function getRiskFlags(customer: HealthDataInput): string[] {
  const flags: string[] = [];
  const now = new Date();

  // 1. VIP
  if (customer.total_revenue && customer.total_revenue >= 50000000) {
    flags.push("VIP");
  }

  // 2. Unassigned
  if (!customer.owner_sale_id && !customer.owner_tele_id) {
    flags.push("Unassigned");
  }

  // 3. Interaction Status (Inactive 7d, At Risk, No Follow-up)
  if (customer.last_interaction_at) {
    const daysSince = differenceInDays(now, new Date(customer.last_interaction_at));
    if (daysSince >= 30) flags.push("At Risk");
    else if (daysSince >= 7) flags.push("Inactive 7d");
  } else if (customer.created_at) {
    const daysSinceCreated = differenceInDays(now, new Date(customer.created_at));
    if (daysSinceCreated >= 3) flags.push("No Follow-up");
  }

  // 4. Overdue Follow-up
  const overdueTasksCount = customer.task_summary?.overdue_tasks || customer.overdue_tasks || 0;
  if (overdueTasksCount > 0) {
    flags.push("Overdue Follow-up");
  } else if (customer.next_follow_up_at && isBefore(new Date(customer.next_follow_up_at), now)) {
    flags.push("Overdue Follow-up");
  }

  // 5. Missing Contact Info
  // If we have channel_summary, use it
  if (customer.channel_summary) {
    if (!customer.channel_summary.has_phone) {
      flags.push("Missing Phone");
    }
    if (!customer.channel_summary.has_facebook && !customer.channel_summary.has_zalo && !customer.channel_summary.has_tiktok) {
      flags.push("Missing Social");
    }
  } else {
    // Fallback to array check
    const channels = customer.contact_channels || [];
    const hasPhone = channels.some(c => c.channel_type === 'phone');
    const hasSocial = channels.some(c => ["facebook", "zalo", "tiktok", "instagram"].includes(c.channel_type));
    
    if (!hasPhone) flags.push("Missing Phone");
    if (!hasSocial) flags.push("Missing Social");
    
    if (channels.length === 0 && !flags.includes("Missing Phone") && !flags.includes("Missing Social")) {
      flags.push("Weak"); // Legacy fallback
    }
  }

  // 6. Duplicate Suspected
  // Placeholder, typically calculated at DB level using normalized_phone grouping

  // 7. Pending Revoke (Chờ thu hồi)
  if (customer.owner_sale_id) {
    if (customer.last_interaction_at) {
      const daysSince = differenceInDays(now, new Date(customer.last_interaction_at));
      if (daysSince > 14) flags.push("Pending Revoke");
    } else if (customer.created_at) {
      const daysSince = differenceInDays(now, new Date(customer.created_at));
      if (daysSince > 14) flags.push("Pending Revoke");
    }
  }

  return flags;
}

export function getInteractionHeatLevel(customer: HealthDataInput): HeatLevel {
  if (!customer.last_interaction_at) {
    if (customer.created_at && differenceInDays(new Date(), new Date(customer.created_at)) < 3) return "warm";
    return "frozen";
  }
  
  const daysSince = differenceInDays(new Date(), new Date(customer.last_interaction_at));
  if (daysSince <= 2) return "hot";
  if (daysSince <= 7) return "warm";
  if (daysSince <= 30) return "cold";
  return "frozen";
}
