import { differenceInDays, differenceInHours } from 'date-fns';

export type Temperature = 'HOT' | 'WARM' | 'STALE' | 'COLD' | 'UNKNOWN';
export type Urgency = 'overdue' | 'today' | 'recent' | 'inactive';

export interface ConversationState {
  temperature: Temperature;
  urgency: Urgency;
  lastInteractionSummary: string | null;
  lastInteractionTime: string | null;
  nextFollowUpTime: string | null;
}

export function getCustomerConversationState(customer: any): ConversationState {
  const now = new Date();
  
  // Last Interaction
  let lastInteractionTime = customer.last_interaction_at || customer.last_contacted_at || customer.last_activity_at;
  let lastInteractionSummary = customer.last_interaction_summary || customer.sales_intelligence?.last_activity_summary || null;
  
  // Next Follow-up
  const nextFollowUpTime = customer.next_follow_up_at;
  
  // Temperature
  let temperature: Temperature = 'UNKNOWN';
  if (lastInteractionTime) {
      const interactionDate = new Date(lastInteractionTime);
      const diffHours = differenceInHours(now, interactionDate);
      const diffDays = differenceInDays(now, interactionDate);
      
      if (diffHours < 24) temperature = 'HOT';
      else if (diffDays <= 7) temperature = 'WARM';
      else if (diffDays <= 14) temperature = 'STALE';
      else temperature = 'COLD';
  }
  
  // Urgency
  let urgency: Urgency = 'inactive';
  if (nextFollowUpTime) {
      const followUpDate = new Date(nextFollowUpTime);
      const isOverdue = now.getTime() > followUpDate.getTime();
      const diffDays = differenceInDays(now, followUpDate);
      
      if (isOverdue) {
          urgency = 'overdue';
      } else if (diffDays === 0) {
          urgency = 'today';
      } else {
          urgency = 'recent';
      }
  } else if (temperature === 'HOT' || temperature === 'WARM') {
      urgency = 'recent';
  } else {
      urgency = 'inactive';
  }
  
  return {
    temperature,
    urgency,
    lastInteractionSummary,
    lastInteractionTime,
    nextFollowUpTime
  };
}
