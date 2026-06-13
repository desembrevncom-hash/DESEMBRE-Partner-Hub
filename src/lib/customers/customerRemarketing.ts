import { getCustomerContactSummary } from "./contactChannelClassifier";

export type RemarketingStatus = "ready" | "partial" | "not_ready";
export type RemarketingSegment = 
  | "CALL_READY"
  | "ZALO_READY"
  | "FACEBOOK_READY"
  | "EMAIL_READY"
  | "NEEDS_PHONE"
  | "HAS_FACEBOOK_NO_PHONE"
  | "UNASSIGNED"
  | "NO_RECENT_INTERACTION"
  | "DATA_CLEANUP_REQUIRED";

export interface CustomerRemarketingProfile {
  status: RemarketingStatus;
  channels: {
    phone: boolean;
    zalo: boolean;
    facebook: boolean;
    email: boolean;
  };
  recommendedSegments: RemarketingSegment[];
  missingRequirements: string[];
  warnings: string[];
}

export function getCustomerRemarketingProfile(customer: any): CustomerRemarketingProfile {
  const summary = getCustomerContactSummary(customer);
  
  const profile: CustomerRemarketingProfile = {
    status: "not_ready",
    channels: {
      phone: false,
      zalo: false,
      facebook: false,
      email: false,
    },
    recommendedSegments: [],
    missingRequirements: [],
    warnings: summary.warnings,
  };

  if (!customer) return profile;

  // Channels capabilities
  if (summary.availableChannels.includes("phone")) profile.channels.phone = true;
  if (summary.availableChannels.includes("zalo")) profile.channels.zalo = true;
  if (summary.availableChannels.includes("facebook")) profile.channels.facebook = true;
  if (summary.availableChannels.includes("email")) profile.channels.email = true;

  // Evaluate Segments
  if (profile.channels.phone) profile.recommendedSegments.push("CALL_READY");
  if (profile.channels.zalo) profile.recommendedSegments.push("ZALO_READY");
  if (profile.channels.facebook) profile.recommendedSegments.push("FACEBOOK_READY");
  if (profile.channels.email) profile.recommendedSegments.push("EMAIL_READY");

  if (!profile.channels.phone) {
    profile.recommendedSegments.push("NEEDS_PHONE");
    profile.missingRequirements.push("Missing valid phone number");
    if (profile.channels.facebook) {
      profile.recommendedSegments.push("HAS_FACEBOOK_NO_PHONE");
    }
  }

  // Check data cleanup needs from summary
  const needsCleanup = summary.dataQualityIssues.some(iss => 
    iss.code === "PHONE_IS_FACEBOOK_UID" || 
    iss.code === "PHONE_IS_FACEBOOK_URL" ||
    iss.code === "NAME_IS_FACEBOOK_UID" ||
    iss.code === "NAME_IS_FACEBOOK_URL"
  );
  if (needsCleanup) {
    profile.recommendedSegments.push("DATA_CLEANUP_REQUIRED");
  }

  // Check unassigned
  if (!customer.owner_sale_id && !customer.sale_owner_id) {
    profile.recommendedSegments.push("UNASSIGNED");
    profile.missingRequirements.push("No Sales Owner Assigned");
  }

  // Evaluate Overall Status
  const hasAnyChannel = profile.channels.phone || profile.channels.facebook || profile.channels.email;
  
  if (!hasAnyChannel) {
    profile.status = "not_ready";
  } else if (profile.channels.phone) {
    // If we have a valid phone, we consider it fully ready for core remarketing
    profile.status = "ready";
  } else {
    // Has Facebook or Email but no phone
    profile.status = "partial";
  }

  return profile;
}
