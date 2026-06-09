import { supabase } from "@/integrations/supabase/client";
import { normalizePhone } from "../utils";

export interface DuplicateCheckParams {
  phone?: string;
  email?: string;
  facebookUid?: string;
  facebookPageId?: string;
  facebookPsid?: string;
  facebookLeadgenId?: string;
  normalizedUrl?: string;
  facebookUsername?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchedCustomerId: string | null;
  matchReason: string | null;
  customerData?: any;
}

export async function checkCustomerDuplicate(params: DuplicateCheckParams): Promise<DuplicateCheckResult> {
  const result: DuplicateCheckResult = {
    isDuplicate: false,
    matchedCustomerId: null,
    matchReason: null,
  };

  // 1. Check Phone
  if (params.phone) {
    const normPhone = normalizePhone(params.phone);
    if (normPhone && normPhone.length >= 9) {
      const { data } = await supabase
        .from("customers")
        .select("id, name, facility_name, owner_sale_id, owner_tele_id, lifecycle_stage")
        .eq("normalized_phone", normPhone)
        .is("deleted_at", null)
        .limit(1);
      
      if (data && data.length > 0) {
        return {
          isDuplicate: true,
          matchedCustomerId: data[0].id,
          matchReason: "phone",
          customerData: data[0],
        };
      }
    }
  }

  // 2. Check Email
  if (params.email) {
    const { data } = await supabase
      .from("customers")
      .select("id, name, facility_name, owner_sale_id, owner_tele_id, lifecycle_stage")
      .ilike("email", params.email.trim())
      .is("deleted_at", null)
      .limit(1);
    
    if (data && data.length > 0) {
      return {
        isDuplicate: true,
        matchedCustomerId: data[0].id,
        matchReason: "email",
        customerData: data[0],
      };
    }
  }

  // Define social profile queries
  const checkSocialProfile = async (column: string, value: string): Promise<DuplicateCheckResult | null> => {
    const { data } = await supabase
      .from("customer_social_profiles")
      .select("customer_id, customers:customer_id(id, name, facility_name, owner_sale_id, owner_tele_id, lifecycle_stage)")
      .eq(column, value)
      .limit(1);
      
    if (data && data.length > 0 && data[0].customers) {
      const customer = Array.isArray(data[0].customers) ? data[0].customers[0] : data[0].customers;
      return {
        isDuplicate: true,
        matchedCustomerId: customer.id,
        matchReason: column,
        customerData: customer,
      };
    }
    return null;
  };

  // 3. facebook_uid
  if (params.facebookUid) {
    const res = await checkSocialProfile("facebook_uid", params.facebookUid);
    if (res) return res;
  }

  // 4. facebook_page_id + facebook_psid
  if (params.facebookPageId && params.facebookPsid) {
    const { data } = await supabase
      .from("customer_social_profiles")
      .select("customer_id, customers:customer_id(id, name, facility_name, owner_sale_id, owner_tele_id, lifecycle_stage)")
      .eq("facebook_page_id", params.facebookPageId)
      .eq("facebook_psid", params.facebookPsid)
      .limit(1);
      
    if (data && data.length > 0 && data[0].customers) {
      const customer = Array.isArray(data[0].customers) ? data[0].customers[0] : data[0].customers;
      return {
        isDuplicate: true,
        matchedCustomerId: customer.id,
        matchReason: "facebook_psid",
        customerData: customer,
      };
    }
  }

  // 5. facebook_leadgen_id
  if (params.facebookLeadgenId) {
    const res = await checkSocialProfile("facebook_leadgen_id", params.facebookLeadgenId);
    if (res) return res;
  }

  // 6. normalized_url
  if (params.normalizedUrl) {
    const res = await checkSocialProfile("normalized_url", params.normalizedUrl);
    if (res) return res;
  }

  // 7. facebook_username
  if (params.facebookUsername) {
    const res = await checkSocialProfile("facebook_username", params.facebookUsername);
    if (res) return res;
  }

  return result;
}
