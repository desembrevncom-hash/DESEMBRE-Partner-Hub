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
  let p = phone.toString().replace(/[^0-9+]/g, "");
  if (p.startsWith("+84")) p = "0" + p.slice(3);
  if (p.startsWith("84") && p.length > 9) p = "0" + p.slice(2);
  return p.length >= 9 ? p : null;
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
    phone: phone,
    normalized_phone: nPhone,
    email: email,
    normalized_email: nEmail,
    address: address,
    city: city,
    source: source,
    customer_channel: source,
    status: status,
    lifecycle_stage: status,
    note: note,
    owner_sale_id: null,
    owner_sale_email: owner_sale_email,
    validation_status: "pending",
    validation_errors: [],
    warning_message: null,
    error_message: null,
    import_action: "skip",
    matched_customer_id: null,
    duplicate_reason: null,
  };
}

export function validateImportRow(row: ParsedImportRow): ParsedImportRow {
  const errors: string[] = [];
  const warnings: string[] = [];

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
  const phone = mappedData.phone || null;
  const email = mappedData.email || null;
  const nPhone = normalizePhone(phone);
  const nEmail = normalizeEmail(email);

  return {
    row_number: index + 1,
    raw_data: rawData,
    parsed_data: mappedData,
    name: mappedData.contact_name || mappedData.business_name || null,
    contact_name: mappedData.contact_name || null,
    business_name: mappedData.business_name || null,
    facility_name: mappedData.business_name || null,
    phone: phone,
    normalized_phone: nPhone,
    email: email,
    normalized_email: nEmail,
    address: null, // mapped from province/city usually
    city: mappedData.city || null,
    source: mappedData.source || null,
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
    // extra mapped fields for customers table
    ...mappedData
  };
}
