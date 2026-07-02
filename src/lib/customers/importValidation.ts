import { normalizePhone as libNormalizePhone } from "../phone";

export interface ParsedImportRow {
  row_number: number;
  raw_data: any;
  parsed_data: any;
  name: string | null;
  contact_name: string | null;
  business_name: string | null;
  facility_name: string | null;
  phone: string | null;
  normalized_phone: string | null;
  email: string | null;
  normalized_email: string | null;
  address: string | null;
  city: string | null;
  source: string | null;
  customer_channel: string | null;
  status: string | null;
  lifecycle_stage: string | null;
  note: string | null;
  owner_sale_id: string | null;
  owner_sale_email: string | null;
  historical_revenue_total?: number | null;
  historical_order_count?: number | null;
  historical_last_purchase_at?: string | null;
  historical_revenue_note?: string | null;
  validation_status: "pending" | "valid" | "invalid" | "duplicate" | "warning";
  validation_errors: string[];
  warning_message: string | null;
  error_message: string | null;
  import_action: "skip" | "create_new" | "update_existing";
  matched_customer_id: string | null;
  duplicate_reason: string | null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let p = phone.toString();
  // Remove leading apostrophe if any
  if (p.startsWith("'")) {
    p = p.slice(1);
  }
  // Remove spaces, dots, dashes, parentheses (keep + for country code check)
  p = p.replace(/[\s.\-()]/g, "");
  
  if (p.startsWith("+84")) {
    p = "0" + p.slice(3);
  } else if (p.startsWith("84") && p.length === 11) {
    p = "0" + p.slice(2);
  } else if (p.length === 9 && /^[35789]/.test(p)) {
    p = "0" + p;
  }
  
  // Final validation: must be 10 digits starting with 0
  if (p.length === 10 && p.startsWith("0")) {
    // Ensure it contains only digits
    if (/^\d{10}$/.test(p)) {
      return p;
    }
  }
  
  return null;
}

export function parseHistoricalRevenue(val: unknown): number | null | "INVALID_NUMBER" {
  if (val === null || val === undefined || val === "") return null;
  const str = String(val).toLowerCase().trim();
  if (str === "null" || str === "undefined" || str === "-" || str === "n/a") return null;
  
  let numStr = str;
  let multiplier = 1;
  if (numStr.includes("triệu") || numStr.includes("trieu") || numStr.includes("tr")) {
    multiplier = 1000000;
  }
  numStr = numStr.replace(/[^0-9.,\-]/g, "");
  numStr = numStr.replace(/,/g, ".");
  if (multiplier === 1000000) {
    const parsed = parseFloat(numStr);
    if (!isNaN(parsed)) return Math.floor(parsed * multiplier);
  } else {
    numStr = numStr.replace(/[.,]/g, "");
    const parsed = parseInt(numStr, 10);
    if (!isNaN(parsed)) return parsed;
  }
  return "INVALID_NUMBER";
}

export function normalizeText(text: unknown): string | null {
  if (text === null || text === undefined || text === "") return null;
  const str = String(text).trim();
  if (!str || str.toLowerCase() === "null" || str.toLowerCase() === "undefined") return null;
  return str.normalize("NFC").replace(/\s+/g, " ");
}

export function parseHistoricalDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  const lowerStr = str.toLowerCase();
  if (!str || lowerStr === "null" || lowerStr === "undefined" || lowerStr === "-" || lowerStr === "n/a") return null;

  // Handle Excel serial numbers (from 1900-01-01 to 2073-10-14 approx)
  const num = Number(str);
  if (!isNaN(num) && num > 10000 && num < 100000) {
    const epoch = new Date(1899, 11, 30); // Excel epoch considering 1900 leap year bug
    const date = new Date(epoch.getTime() + num * 86400000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // Handle JS Date object
  if (value instanceof Date) {
    if (!isNaN(value.getTime())) {
      return value.toISOString().split("T")[0];
    }
  }

  // Handle common string formats
  // YYYY-MM-DD
  let match = str.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    const day = parseInt(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date.toISOString().split("T")[0];
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  match = str.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    const year = parseInt(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      return date.toISOString().split("T")[0];
    }
  }
  
  // Try default JS parser as last resort for standard strings like "Dec 20, 2025"
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
     return d.toISOString().split("T")[0];
  }

  return "INVALID_DATE";
}

export function detectMojibake(text: unknown): boolean {
  if (!text) return false;
  const str = String(text);
  if (str.includes("\uFFFD")) return true; // Replacement character 
  if (str.includes("??")) return true;
  if (/[a-zA-Z]\?[a-zA-Z]/.test(str)) return true;
  if (/[a-zA-Z]\?\s/.test(str)) return true;
  if (/\s\?[a-zA-Z]/.test(str)) return true;
  return false;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.toString().trim().toLowerCase();
}

export function validateEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toString());
}

export function isEmptyImportRow(row: any): boolean {
  if (!row) return true;
  return Object.values(row).every((v) => v === null || v === undefined || v === "");
}

export function mapImportRow(row: any, index: number): ParsedImportRow {
  const getVal = (keys: string[]) => {
    for (const key of keys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
        return row[key].toString().trim();
      }
    }
    return null;
  };

  const name = getVal(["name", "Name", "Tên", "tên", "contact_name", "Contact Name"]);
  const business_name = getVal([
    "business_name",
    "Business Name",
    "Cơ sở",
    "facility_name",
    "spa_name",
  ]);
  const phone = getVal(["phone", "Phone", "SĐT", "Số điện thoại", "tel", "mobile"]);
  const email = getVal(["email", "Email", "Thư điện tử"]);
  const address = getVal(["address", "Address", "Địa chỉ"]);
  const city = getVal(["city", "City", "Thành phố", "Tỉnh/TP"]);
  const source = getVal(["source", "Source", "Nguồn", "customer_channel"]);
  const status = getVal(["status", "Status", "Trạng thái", "lifecycle_stage"]);
  const note = getVal(["note", "Note", "Ghi chú"]);
  const owner_sale_email = getVal([
    "owner_sale_email",
    "Sale Email",
    "Người phụ trách",
    "email_phu_trach",
  ]);

  const nPhone = normalizePhone(phone);
  const nEmail = normalizeEmail(email);

  return {
    row_number: index + 1,
    raw_data: row,
    parsed_data: {
      name,
      business_name,
      phone,
      email,
      address,
      city,
      source,
      status,
      note,
      owner_sale_email,
    },
    name: name,
    contact_name: name,
    business_name: business_name,
    facility_name: business_name,
    phone: nPhone || phone,
    normalized_phone: nPhone,
    email: email,
    normalized_email: normalizeEmail(email),
    city: city || province, // fallback
    address,
    source: source,
    customer_channel: source,
    status: null,
    lifecycle_stage: null,
    note: note,
    owner_sale_id: mappedData.owner_sale_id || null,
    owner_sale_email: mappedData.owner_sale_email || null,
    validation_status: "pending",
    validation_errors: [],
    warning_message: null,
    error_message: null,
    import_action: "skip",
    matched_customer_id: null,
    duplicate_reason: null,
    // extra mapped fields
    ...mappedData,
    province,
  };
}

export function validateImportRow(row: ParsedImportRow): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 0. Detect encoding errors
  const textsToCheck = [
    row.business_name,
    row.contact_name,
    (row as any).province,
    row.city,
    row.address,
    row.note,
  ];
  if (textsToCheck.some((t) => detectMojibake(t))) {
    errors.push("Tên/địa chỉ có dấu hiệu lỗi font tiếng Việt.");
  }

  // 1 & 2. Required info
  if (!row.name && !row.contact_name && !row.business_name && !row.facility_name) {
    errors.push("Thiếu tên khách hàng hoặc tên cơ sở.");
  }

  // 3. Contact info
  if (!row.phone) {
    errors.push("Số điện thoại là bắt buộc.");
  }

  // 4 & 6. Format
  if (row.phone && !row.normalized_phone) {
    errors.push("Số điện thoại sai định dạng.");
  }
  if (row.email && !validateEmail(row.email)) {
    errors.push("Email sai định dạng.");
  }

  if (row.owner_sale_email && !validateEmail(row.owner_sale_email)) {
    warnings.push("Email người phụ trách sai định dạng.");
  }

  if (row.historical_last_purchase_at === "INVALID_DATE") {
    errors.push("Ngày mua cuối lịch sử không hợp lệ");
  }

  if (row.historical_revenue_total === "INVALID_NUMBER") {
    errors.push("Doanh số lịch sử không hợp lệ.");
  } else if (row.historical_revenue_total !== null && row.historical_revenue_total < 0) {
    errors.push("Doanh số lịch sử không được âm.");
  }

  if (row.historical_order_count === "INVALID_NUMBER") {
    errors.push("Số đơn lịch sử không hợp lệ.");
  } else if (row.historical_order_count !== null && row.historical_order_count < 0) {
    errors.push("Số đơn lịch sử không được âm.");
  }

  let status: "valid" | "invalid" | "warning" | "duplicate" = "valid";
  let action: "skip" | "create_new" | "update_existing" = "create_new";

  if (errors.length > 0) {
    status = "invalid";
    action = "skip";
  } else if (warnings.length > 0) {
    status = "warning";
  }

  return {
    ...row,
    validation_status: status,
    validation_errors: errors,
    warning_message: warnings.length > 0 ? warnings.join(" | ") : null,
    error_message: errors.length > 0 ? errors.join(" | ") : null,
    import_action: action,
  };
}

export function detectDuplicateInFile(rows: ParsedImportRow[]): ParsedImportRow[] {
  const phoneSet = new Set<string>();
  const emailSet = new Set<string>();

  return rows.map((row) => {
    if (row.validation_status === "invalid") return row;

    let isDup = false;
    const errors = [...(row.validation_errors || [])];

    if (row.normalized_phone) {
      if (phoneSet.has(row.normalized_phone)) {
        isDup = true;
        errors.push("Trùng sđt trong file upload.");
      } else {
        phoneSet.add(row.normalized_phone);
      }
    }

    if (row.normalized_email) {
      if (emailSet.has(row.normalized_email)) {
        isDup = true;
        errors.push("Trùng email trong file upload.");
      } else {
        emailSet.add(row.normalized_email);
      }
    }

    if (isDup) {
      return {
        ...row,
        validation_status: "duplicate",
        validation_errors: errors,
        error_message: errors.join(" | "),
        duplicate_reason: "Trùng lặp trong file upload",
        import_action: "skip",
      };
    }
    return row;
  });
}

export function buildImportSummary(rows: ParsedImportRow[]) {
  return {
    total_rows: rows.length,
    valid_rows: rows.filter((r) => r.validation_status === "valid").length,
    invalid_rows: rows.filter((r) => r.validation_status === "invalid").length,
    duplicate_rows: rows.filter((r) => r.validation_status === "duplicate").length,
    warning_rows: rows.filter((r) => r.validation_status === "warning").length,
  };
}

export function adaptMappedRow(mappedData: any, rawData: any, index: number): ParsedImportRow {
  const phone = mappedData.phone ? mappedData.phone.toString() : null;
  const email = mappedData.email ? mappedData.email.toString() : null;
  const nPhone = normalizePhone(phone);
  const nEmail = normalizeEmail(email);

  // Normalize texts
  const business_name = normalizeText(mappedData.business_name);
  const contact_name = normalizeText(mappedData.contact_name);
  const city = normalizeText(mappedData.city);
  const province = normalizeText(mappedData.province);
  const address = normalizeText(mappedData.address);
  const source = normalizeText(mappedData.source);
  const note = normalizeText(mappedData.note);
  const historical_revenue_total = parseHistoricalRevenue(mappedData.historical_revenue_total);
  const historical_order_count = mappedData.historical_order_count ? parseInt(mappedData.historical_order_count, 10) : null;
  const historical_last_purchase_at = parseHistoricalDate(mappedData.historical_last_purchase_at);
  const historical_revenue_note = normalizeText(mappedData.historical_revenue_note);

  return {
    row_number: index + 1,
    raw_data: rawData,
    parsed_data: mappedData,
    // extra mapped fields for customers table
    ...mappedData,
    name: contact_name || business_name || null,
    contact_name: contact_name,
    business_name: business_name,
    facility_name: business_name,
    phone: nPhone || phone,
    normalized_phone: nPhone,
    email: email,
    normalized_email: nEmail,
    address: address || null,
    city: city || province || null,
    source: source,
    customer_channel: mappedData.source || null,
    status: null,
    lifecycle_stage: null,
    note: mappedData.note || null,
    owner_sale_id: mappedData.owner_sale_id || null,
    owner_sale_email: mappedData.owner_sale_email || null,
    validation_status: "pending",
    validation_errors: [],
    warning_message: null,
    error_message: null,
    import_action: "skip",
    matched_customer_id: null,
    duplicate_reason: null,
    historical_revenue_total,
    historical_order_count: Number.isNaN(historical_order_count as any) ? "INVALID_NUMBER" : historical_order_count,
    historical_last_purchase_at,
    historical_revenue_note,
  };
}
