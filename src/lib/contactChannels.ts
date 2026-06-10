import { supabase } from "@/integrations/supabase/client";

export const normalizeContactChannel = (channelType: string, value: string) => {
  let normalizedValue = value.trim();
  let resolveStatus = "pending";

  if (channelType === "email") {
    normalizedValue = normalizedValue.toLowerCase();
    resolveStatus = "verified";
  } else if (channelType === "zalo") {
    if (normalizedValue.includes("zalo.me/")) {
      normalizedValue = normalizedValue.split("zalo.me/")[1].split("?")[0].trim();
    }
    if (/^[\d\s\-\+\.]+$/.test(normalizedValue)) {
      normalizedValue = normalizedValue.replace(/\D/g, "");
    }
    resolveStatus = "manual";
  } else if (
    channelType === "tiktok" ||
    channelType === "instagram" ||
    channelType === "facebook"
  ) {
    try {
      const url = new URL(
        normalizedValue.startsWith("http") ? normalizedValue : `https://${normalizedValue}`,
      );
      normalizedValue = url.origin + url.pathname;
    } catch (e) {
      // Keep as is if invalid URL
    }
    resolveStatus = "manual";
  } else if (channelType === "website") {
    try {
      const url = new URL(
        normalizedValue.startsWith("http") ? normalizedValue : `https://${normalizedValue}`,
      );
      normalizedValue = url.hostname;
    } catch (e) {
      // Keep as is
    }
    resolveStatus = "manual";
  }

  return { normalizedValue, resolveStatus };
};

export const createContactChannel = async ({
  customerId,
  channelType,
  value,
  scope,
  channel_purpose,
  is_primary,
  notes,
  user,
}: {
  customerId: string;
  channelType: string;
  value: string;
  scope: string;
  channel_purpose: string;
  is_primary: boolean;
  notes?: string;
  user: any;
  social_profile_id?: string;
}) => {
  const { normalizedValue, resolveStatus } = normalizeContactChannel(channelType, value);
  const visibility = scope === "official" ? "official" : "private";

  const payload = {
    customer_id: customerId,
    channel_type: channelType,
    channel_value: value.trim(),
    normalized_value: normalizedValue,
    scope,
    visibility,
    resolve_status: resolveStatus,
    owner_user_id: scope === "private" ? user?.id : null,
    created_by: user?.id,
    updated_by: user?.id,
    is_primary: !!is_primary,
    channel_purpose: channel_purpose || "sales",
    notes: notes || null,
    social_profile_id: social_profile_id || null,
  };

  // 1. Check for duplicates
  let query = supabase
    .from("customer_contact_channels")
    .select("id, normalized_value")
    .eq("customer_id", customerId)
    .eq("channel_type", channelType)
    .eq("scope", scope);

  if (scope === "private") {
    query = query.eq("owner_user_id", user?.id || "");
  } else {
    query = query.is("owner_user_id", null);
  }

  const { data: existingRows, error: searchError } = await query;
  if (searchError) throw new Error(searchError.message);

  const duplicate = existingRows?.find((row: any) => row.normalized_value === normalizedValue);

  if (duplicate) {
    if (channelType === "phone") {
      // For phone, if duplicate in same scope/owner, just silently ignore/return the existing one
      return { data: duplicate, error: null };
    }
    throw new Error("Kênh liên hệ này đã tồn tại trong danh sách của bạn.");
  }

  // 2. Unset previous primary if needed
  if (payload.is_primary) {
    let unsetQuery = supabase
      .from("customer_contact_channels")
      .update({ is_primary: false })
      .eq("customer_id", customerId)
      .eq("scope", scope);

    if (scope === "private") {
      unsetQuery = unsetQuery.eq("owner_user_id", payload.owner_user_id || "");
    } else {
      unsetQuery = unsetQuery.is("owner_user_id", null);
    }

    await unsetQuery;
  }

  // 3. Insert the new channel
  const { data, error } = await supabase
    .from("customer_contact_channels")
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  // 4. Log Activity
  let activityTitle = "Cập nhật kênh liên hệ";
  if (channelType === "phone") {
    activityTitle = "Tạo kênh liên hệ điện thoại";
  } else if (payload.is_primary) {
    activityTitle = "Tạo kênh liên hệ chính";
  }

  await supabase.from("customer_activities").insert({
    customer_id: customerId,
    user_id: user?.id,
    created_by: user?.id,
    activity_type: "profile_updated",
    title: activityTitle,
    content: `${channelType.toUpperCase()} (${scope}) - ${payload.normalized_value}`,
    metadata: { channel_id: data.id },
  });

  return { data, error: null };
};
