import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { getEditableFields, CustomerPermissionContext } from "./customerPermissions";

type Customer = Database["public"]["Tables"]["customers"]["Row"];

export type UpdateCustomerParams = {
  customerId: string;
  originalCustomer: Customer;
  formValues: Record<string, any>;
  permissionCtx: CustomerPermissionContext;
  reason?: string;
};

/**
 * Lọc lấy các trường có sự thay đổi thực tế so với bản gốc và nằm trong whitelist.
 */
function getChangedFields(
  originalCustomer: Customer,
  formValues: Record<string, any>,
  permissionCtx: CustomerPermissionContext
): Record<string, any> {
  const editableFields = getEditableFields(originalCustomer, permissionCtx);
  const changes: Record<string, any> = {};

  editableFields.forEach((field) => {
    if (formValues.hasOwnProperty(field)) {
      let newValue = formValues[field];
      let originalValue = (originalCustomer as any)[field];

      // Trim string values
      if (typeof newValue === "string") {
        newValue = newValue.trim();
      }
      
      // Xử lý null
      if (newValue === "") {
        // Chỉ convert empty string sang null với các trường cho phép null
        // Nếu UI rule bắt buộc, ta có thể refine tại đây. Nhưng RPC sẽ tự xử lý (nullif(btrim, '')).
        // Ta cứ gửi empty string hoặc null. RPC sẽ quy ra null nếu là text.
      }

      // Check diff
      if (newValue !== originalValue) {
        // Cần cẩn thận với Date/Number so sánh
        if (newValue === "" && originalValue === null) {
          // No-op (empty string form matches null DB for text)
        } else if (field === 'historical_revenue_total') {
            const numNew = newValue ? Number(newValue) : null;
            if (numNew !== originalValue) changes[field] = numNew;
        } else if (field === 'historical_order_count') {
            const numNew = newValue ? Number(newValue) : null;
            if (numNew !== originalValue) changes[field] = numNew;
        } else {
          changes[field] = newValue === "" ? null : newValue;
        }
      }
    }
  });

  return changes;
}

export async function updateCustomerProfile({
  customerId,
  originalCustomer,
  formValues,
  permissionCtx,
  reason,
}: UpdateCustomerParams): Promise<{ data?: Customer; error?: string }> {
  const changes = getChangedFields(originalCustomer, formValues, permissionCtx);

  if (Object.keys(changes).length === 0) {
    return { data: originalCustomer }; // No-op
  }

  try {
    const { data, error } = await supabase.rpc("update_customer_profile", {
      p_customer_id: customerId,
      p_updates: changes,
      p_current_updated_at: originalCustomer.updated_at,
      p_reason: reason || null,
    });

    if (error) {
      return { error: parsePostgresError(error.message) };
    }

    const updatedCustomer = Array.isArray(data) ? data[0] : data;
    if (!updatedCustomer) {
      return { error: "Dữ liệu trả về trống. Vui lòng thử lại (EMPTY_RPC_RESPONSE)." };
    }

    return { data: updatedCustomer as unknown as Customer };
  } catch (err: any) {
    return { error: parsePostgresError(err?.message || "Lỗi không xác định") };
  }
}

function parsePostgresError(message: string): string {
  if (!message) return "Có lỗi xảy ra khi lưu dữ liệu.";
  
  if (message.includes("CUSTOMER_STALE_VERSION")) {
    return "Dữ liệu khách hàng đã bị thay đổi bởi người khác. Vui lòng tải lại trang.";
  }
  if (message.includes("FIELD_NOT_ALLOWED")) {
    return "Bạn không có quyền cập nhật trường thông tin này.";
  }
  if (message.includes("DUPLICATE_PHONE")) {
    return "Số điện thoại này đã tồn tại trong hệ thống.";
  }
  if (message.includes("DUPLICATE_EMAIL")) {
    return "Email này đã tồn tại trong hệ thống.";
  }
  if (message.includes("INVALID_PHONE")) {
    return "Số điện thoại không hợp lệ (cần ít nhất 9 chữ số).";
  }
  if (message.includes("INVALID_CITY")) {
    return "Tỉnh/Thành phố không hợp lệ.";
  }
  if (message.includes("FORBIDDEN_EDIT")) {
    return "Bạn không có quyền chỉnh sửa khách hàng này.";
  }
  if (message.includes("INVALID_SALE_OWNER")) {
    return "Người phụ trách Sale không hợp lệ.";
  }
  if (message.includes("INVALID_TELE_OWNER")) {
    return "Người phụ trách Telesale không hợp lệ.";
  }
  if (message.includes("INVALID_UPDATES_PAYLOAD") || message.includes("INVALID_SCALAR_VALUE")) {
    return "Dữ liệu đầu vào không hợp lệ.";
  }
  if (message.includes("INVALID_NEGATIVE_METRIC")) {
    return "Chỉ số không được là số âm.";
  }

  return message; // Fallback
}
