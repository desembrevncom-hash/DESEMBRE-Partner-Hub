/**
 * CUSTOMER RECLAMATION RULES & UTILITIES - DESEMBRE PARTNER HUB
 * Bộ helper tính toán cảnh báo / thu hồi khách hàng không tương tác.
 */

export const getLastValidInteraction = (customer: any): Date => {
  if (customer.last_owner_activity_at) return new Date(customer.last_owner_activity_at);
  if (customer.last_contacted_at) return new Date(customer.last_contacted_at);
  return new Date(customer.created_at || Date.now());
};

export const getHoursSinceLastInteraction = (customer: any): number => {
  const lastInteraction = getLastValidInteraction(customer);
  const diffMs = Date.now() - lastInteraction.getTime();
  return diffMs / (1000 * 60 * 60);
};

export const getDaysSinceLastInteraction = (customer: any): number => {
  return getHoursSinceLastInteraction(customer) / 24;
};

/**
 * Phân nhóm quy tắc tương ứng dựa trên lifecycle_stage và đặc thù khách hàng.
 */
export const getCustomerReclaimCategory = (customer: any): 'new_lead' | 'consulting' | 'proposal' | 'won_active' | 'vip_loyal' => {
  const stage = (customer.lifecycle_stage || "").toLowerCase();
  
  // 1. Khách VIP/Loyal
  if (
    stage === "loyal_customer" || 
    stage === "loyal" || 
    stage === "vip" || 
    Number(customer.total_order_amount || 0) >= 50000000
  ) {
    return "vip_loyal";
  }
  
  // 2. Lead nóng / new_lead
  if (stage === "new_lead" || stage === "lead" || stage === "") {
    return "new_lead";
  }
  
  // 3. Đã báo giá / proposal
  if (stage === "proposal" || stage === "quoted") {
    return "proposal";
  }
  
  // 4. Khách đã mua / won / active
  if (
    stage === "ordered" || 
    stage === "won" || 
    stage === "active" || 
    stage === "active_customer" || 
    Number(customer.total_orders_count || 0) > 0
  ) {
    return "won_active";
  }
  
  // 5. Đang tư vấn / consulting (Mặc định cho các trường hợp còn lại)
  return "consulting";
};

/**
 * 1. getCustomerReclaimStage(customer)
 * Trả về trạng thái thu hồi hiện tại: 'assigned' | 'at_risk' | 'reclaimable'
 */
export const getCustomerReclaimStage = (customer: any): 'assigned' | 'at_risk' | 'reclaimable' => {
  // Nếu đã ở Free Pool hoặc đã bị xóa mềm, giữ nguyên hoặc bỏ qua
  if (customer.ownership_status === "free_pool" || customer.deleted_at) {
    return customer.ownership_status || "assigned";
  }

  const category = getCustomerReclaimCategory(customer);
  const hours = getHoursSinceLastInteraction(customer);
  const days = hours / 24;

  switch (category) {
    case "new_lead":
      if (hours >= 48) return "reclaimable";
      if (hours >= 24) return "at_risk";
      break;
    case "consulting":
      if (days >= 10) return "reclaimable";
      if (days >= 7) return "at_risk";
      break;
    case "proposal":
      if (days >= 7) return "reclaimable";
      if (days >= 5) return "at_risk";
      break;
    case "won_active":
      if (days >= 90) return "reclaimable";
      if (days >= 60) return "at_risk";
      break;
    case "vip_loyal":
      if (days >= 120) return "reclaimable";
      if (days >= 90) return "at_risk";
      break;
  }

  return "assigned";
};

/**
 * 2. isCustomerAtRisk(customer)
 */
export const isCustomerAtRisk = (customer: any): boolean => {
  return getCustomerReclaimStage(customer) === "at_risk";
};

/**
 * 3. isCustomerReclaimable(customer)
 */
export const isCustomerReclaimable = (customer: any): boolean => {
  return getCustomerReclaimStage(customer) === "reclaimable";
};

/**
 * 4. getCustomerReclaimReason(customer)
 * Trả về lý do thu hồi chi tiết dựa trên tình trạng tương tác
 */
export const getCustomerReclaimReason = (customer: any): string => {
  const stage = getCustomerReclaimStage(customer);
  if (stage === "assigned") return "";

  const category = getCustomerReclaimCategory(customer);
  const hours = getHoursSinceLastInteraction(customer);
  const days = Math.floor(hours / 24);

  const categoryLabel = {
    new_lead: "Lead nóng",
    consulting: "Đang tư vấn",
    proposal: "Đã báo giá",
    won_active: "Khách đã mua",
    vip_loyal: "Khách VIP/Thân thiết"
  }[category];

  const timeText = category === "new_lead" 
    ? `${Math.floor(hours)} giờ` 
    : `${days} ngày`;

  return `${categoryLabel} quá hạn không tương tác chăm sóc (${timeText})`;
};

/**
 * 5. getReclaimDeadlineLabel(customer)
 * Trả về thông tin hạn chót đếm ngược hỗ trợ hiển thị trên UI
 */
export const getReclaimDeadlineLabel = (customer: any): { text: string; hoursLeft: number; variant: 'normal' | 'warning' | 'danger' } => {
  const stage = getCustomerReclaimStage(customer);
  const category = getCustomerReclaimCategory(customer);
  const hoursSince = getHoursSinceLastInteraction(customer);

  let limitHours = 0;
  switch (category) {
    case "new_lead":
      limitHours = 48;
      break;
    case "consulting":
      limitHours = 10 * 24;
      break;
    case "proposal":
      limitHours = 7 * 24;
      break;
    case "won_active":
      limitHours = 90 * 24;
      break;
    case "vip_loyal":
      limitHours = 120 * 24;
      break;
  }

  const hoursLeft = Math.max(0, limitHours - hoursSince);
  const daysLeft = Math.floor(hoursLeft / 24);

  if (stage === "reclaimable" || hoursLeft <= 0) {
    return {
      text: "Đủ điều kiện thu hồi",
      hoursLeft: 0,
      variant: "danger"
    };
  }

  if (stage === "at_risk") {
    const text = category === "new_lead"
      ? `Sắp bị thu hồi: Còn ${Math.floor(hoursLeft)} giờ`
      : `Sắp bị thu hồi: Còn ${daysLeft} ngày`;
    return {
      text,
      hoursLeft,
      variant: "warning"
    };
  }

  const text = category === "new_lead"
    ? `An toàn: Còn ${Math.floor(hoursLeft)} giờ`
    : `An toàn: Còn ${daysLeft} ngày`;

  return {
    text,
    hoursLeft,
    variant: "normal"
  };
};
