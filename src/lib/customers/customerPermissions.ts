import { Database } from "@/integrations/supabase/types";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

export type CustomerPermissionContext = {
  isAdmin: boolean;
  isSale: boolean;
  isTele: boolean;
  userId: string;
};

/**
 * Kiểm tra xem user có quyền Edit ít nhất 1 field của customer này không.
 */
export const canEditCustomer = (
  customer: Customer,
  ctx: CustomerPermissionContext
): boolean => {
  if (ctx.isAdmin) return true;
  if (
    ctx.isSale &&
    (customer.owner_sale_id === ctx.userId ||
      (!customer.owner_sale_id &&
        !customer.owner_tele_id &&
        customer.created_by === ctx.userId))
  ) {
    return true;
  }
  if (ctx.isTele && customer.owner_tele_id === ctx.userId) return true;
  return false;
};

/**
 * Lấy danh sách các fields được phép chỉnh sửa tùy theo role và ownership.
 * (Nguồn phân quyền chính vẫn nằm ở Database RPC update_customer_profile).
 */
export const getEditableFields = (
  customer: Customer,
  ctx: CustomerPermissionContext
): string[] => {
  if (ctx.isAdmin) {
    return [
      "business_name",
      "contact_name",
      "phone",
      "email",
      "city",
      "address",
      "district",
      "note",
      "status",
      "lifecycle_stage",
      "potential_level",
      "source",
      "facebook",
      "zalo",
      "owner_sale_id",
      "owner_tele_id",
      "historical_revenue_total",
      "historical_order_count",
      "historical_last_purchase_at",
      "historical_revenue_note",
      "historical_revenue_source",
    ];
  }

  if (
    ctx.isSale &&
    (customer.owner_sale_id === ctx.userId ||
      (!customer.owner_sale_id &&
        !customer.owner_tele_id &&
        customer.created_by === ctx.userId))
  ) {
    return [
      "business_name",
      "contact_name",
      "phone",
      "email",
      "city",
      "address",
      "district",
      "note",
      "status",
      "lifecycle_stage",
      "potential_level",
    ];
  }

  if (ctx.isTele && customer.owner_tele_id === ctx.userId) {
    return ["phone", "email", "note", "status", "lifecycle_stage"];
  }

  return [];
};
