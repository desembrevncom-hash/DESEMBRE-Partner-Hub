import { getCustomerContactSummary } from "./contactChannelClassifier";
import { getCustomerRemarketingProfile } from "./customerRemarketing";
import { getCustomerCardTitle } from "./customerDisplayName";
import { toSafeString } from "../utils/safeString";

function applyTextFormatToSheet(ws: any) {
  // Iterate all cells and if it's a string that looks like a number, force it to be text
  if (!ws || !ws['!ref']) return;
  const range = (window as any).XLSX?.utils?.decode_range?.(ws['!ref']) || { s: { c: 0, r: 0 }, e: { c: 100, r: 10000 } }; // fallback
  
  // Note: Since XLSX is loaded dynamically, we might not have decode_range handy easily without the import
  // But we can just loop over Object.keys
  for (const key of Object.keys(ws)) {
    if (key.startsWith("!")) continue;
    const cell = ws[key];
    if (cell && cell.v !== undefined) {
      // Force all string values to remain strings in Excel
      if (typeof cell.v === "string") {
        cell.t = "s";
        cell.z = "@";
      }
    }
  }
}

export async function buildCustomerExportWorkbook(customers: any[]): Promise<any> {
  const XLSX = await import("xlsx");

  const basicData: any[] = [];
  const channelsData: any[] = [];
  const remarketingData: any[] = [];
  const dataQualityData: any[] = [];

  for (const customer of customers) {
    const summary = getCustomerContactSummary(customer);
    const remarketing = getCustomerRemarketingProfile(customer);
    const displayName = getCustomerCardTitle(customer);
    const customerId = toSafeString(customer.id);

    // 1. Customers Basic
    basicData.push({
      customer_id: customerId,
      display_name: displayName,
      business_name: toSafeString(customer.business_name || customer.name),
      contact_name: toSafeString(customer.contact_name),
      valid_phone: summary.callablePhone,
      phone_raw: toSafeString(customer.phone),
      email: summary.email,
      facebook_url: summary.facebookUrl,
      facebook_uid: summary.facebookUid,
      province_city: toSafeString(customer.province || customer.city),
      address: toSafeString(customer.address),
      source: toSafeString(customer.source),
      stage_status: toSafeString(customer.stage || customer.status),
      sale_owner_name: toSafeString(customer.owner_sale_name || customer.sale_owner_name),
      tele_owner_name: toSafeString(customer.owner_tele_name || customer.tele_owner_name),
      created_at: toSafeString(customer.created_at),
    });

    // 2. Contact Channels
    // We add the primary ones from summary. We could iterate available channels if detailed.
    if (summary.primaryPhone || customer.phone) {
      channelsData.push({
        customer_id: customerId,
        display_name: displayName,
        channel_type: "phone_field",
        raw_value: toSafeString(customer.phone),
        normalized_value: summary.callablePhone || summary.facebookUid || "", // depends on classification
        is_primary: true,
        is_callable: !!summary.callablePhone,
        is_zalo_capable: !!summary.zaloPhone,
        is_remarketing_capable: !!summary.callablePhone || !!summary.facebookUid,
        warning: summary.warnings.join("; "),
      });
    }

    if (summary.facebookUrl || summary.facebookUid) {
      channelsData.push({
        customer_id: customerId,
        display_name: displayName,
        channel_type: "facebook",
        raw_value: summary.facebookUrl || summary.facebookUid,
        normalized_value: summary.facebookUid || summary.facebookUrl,
        is_primary: false,
        is_callable: false,
        is_zalo_capable: false,
        is_remarketing_capable: true,
        warning: "",
      });
    }

    if (summary.email) {
      channelsData.push({
        customer_id: customerId,
        display_name: displayName,
        channel_type: "email",
        raw_value: toSafeString(customer.email),
        normalized_value: summary.email,
        is_primary: false,
        is_callable: false,
        is_zalo_capable: false,
        is_remarketing_capable: true,
        warning: "",
      });
    }

    // 3. Remarketing
    remarketingData.push({
      customer_id: customerId,
      display_name: displayName,
      remarketing_phone: summary.callablePhone,
      remarketing_zalo: summary.zaloPhone,
      facebook_url: summary.facebookUrl,
      facebook_uid: summary.facebookUid,
      email: summary.email,
      source: toSafeString(customer.source),
      stage_status: toSafeString(customer.stage || customer.status),
      last_interaction_at: toSafeString(customer.last_interaction_at),
      owner_sale: toSafeString(customer.owner_sale_name || customer.sale_owner_name),
      owner_tele: toSafeString(customer.owner_tele_name || customer.tele_owner_name),
      remarketing_status: remarketing.status,
      recommended_segment: remarketing.recommendedSegments.join(", "),
      missing_requirements: remarketing.missingRequirements.join(", "),
    });

    // 4. Data Quality
    for (const issue of summary.dataQualityIssues) {
      dataQualityData.push({
        customer_id: customerId,
        display_name: displayName,
        issue_code: issue.code,
        issue_label: issue.label,
        raw_value: issue.rawValue,
        recommended_fix: "Review contact info and update in CRM",
      });
    }
  }

  const wb = XLSX.utils.book_new();

  const wsBasic = XLSX.utils.json_to_sheet(basicData);
  applyTextFormatToSheet(wsBasic);
  XLSX.utils.book_append_sheet(wb, wsBasic, "Customers Basic");

  const wsChannels = XLSX.utils.json_to_sheet(channelsData);
  applyTextFormatToSheet(wsChannels);
  XLSX.utils.book_append_sheet(wb, wsChannels, "Contact Channels");

  const wsRemarketing = XLSX.utils.json_to_sheet(remarketingData);
  applyTextFormatToSheet(wsRemarketing);
  XLSX.utils.book_append_sheet(wb, wsRemarketing, "Remarketing");

  const wsDataQuality = XLSX.utils.json_to_sheet(dataQualityData);
  applyTextFormatToSheet(wsDataQuality);
  XLSX.utils.book_append_sheet(wb, wsDataQuality, "Data Quality");

  return wb;
}

export async function downloadCustomerExport(customers: any[], type: "active" | "deleted") {
  const XLSX = await import("xlsx");
  const wb = await buildCustomerExportWorkbook(customers);
  const dateStr = new Date().toISOString().slice(0, 10);
  const fileName = `DESEMBRE_Customers_${type}_v2_${dateStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
