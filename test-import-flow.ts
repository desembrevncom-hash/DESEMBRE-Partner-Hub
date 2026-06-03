import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  mapImportRow,
  validateImportRow,
  detectDuplicateInFile,
  buildImportSummary,
} from "./src/lib/customers/importValidation";

const envText = fs.readFileSync(".env", "utf8");
const env: Record<string, string> = {};
envText.split("\n").forEach((line) => {
  const [k, ...v] = line.split("=");
  if (k && v.length) {
    env[k.trim()] = v.join("=").replace(/"/g, "").trim();
  }
});

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY);

async function runTest() {
  console.log("=== BẮT ĐẦU TEST PHASE 4B.5 ===");

  // 1. Get existing customers count
  const { count: initialCount, error: countErr1 } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });
  console.log(`Số lượng customers hiện tại: ${initialCount}`);

  // 2. Fetch a real customer to test DB duplicate
  const { data: existingData } = await supabase
    .from("customers")
    .select("phone, normalized_phone, email, normalized_email")
    .not("normalized_phone", "is", null)
    .not("normalized_email", "is", null)
    .limit(1);

  let existingPhone = "0999999999";
  let existingEmail = "dup@example.com";
  if (existingData && existingData.length > 0) {
    existingPhone = existingData[0].normalized_phone || existingPhone;
    existingEmail = existingData[0].normalized_email || existingEmail;
  }

  console.log(`Dùng DB data để test trùng lặp: Phone: ${existingPhone}, Email: ${existingEmail}`);

  // 3. Prepare mock data mapping user's requirements
  const mockData = [
    { Name: "Valid 1", Phone: "0901111111", Email: "valid1@example.com" }, // valid
    { Name: "Valid 2", Phone: "0902222222", Email: "valid2@example.com" }, // valid
    { Phone: "0903333333", Email: "missingname@example.com" }, // invalid (missing name)
    { Name: "Missing Contact", Address: "Ha Noi" }, // invalid (missing both phone & email)
    { Name: "Invalid Email", Phone: "0904444444", Email: "not-an-email" }, // invalid email
    { Name: "Dup In-File 1", Phone: "0905555555" }, // will be duplicate
    { Name: "Dup In-File 2", Phone: "0905555555" }, // duplicate of above
    { Name: "Dup DB Phone", Phone: existingPhone }, // DB duplicate
    { Name: "Dup DB Email", Email: existingEmail }, // DB duplicate
  ];

  // 4. Validate Flow
  let rows = mockData.map((r, i) => mapImportRow(r, i));
  rows = rows.map(validateImportRow);
  rows = detectDuplicateInFile(rows);

  // DB Duplicate Detection
  const phonesToCheck = rows.filter((r) => r.normalized_phone).map((r) => r.normalized_phone!);
  const emailsToCheck = rows.filter((r) => r.normalized_email).map((r) => r.normalized_email!);

  let existingCustomers: any[] = [];
  if (phonesToCheck.length > 0) {
    const { data: pData } = await supabase
      .from("customers")
      .select("id, normalized_phone")
      .in("normalized_phone", phonesToCheck);
    if (pData) existingCustomers = [...existingCustomers, ...pData];
  }
  if (emailsToCheck.length > 0) {
    const { data: eData } = await supabase
      .from("customers")
      .select("id, normalized_email")
      .in("normalized_email", emailsToCheck);
    if (eData) existingCustomers = [...existingCustomers, ...eData];
  }

  rows = rows.map((r) => {
    if (r.validation_status === "invalid" || r.validation_status === "duplicate") return r;

    let matchedId = null;
    if (r.normalized_phone) {
      const match = existingCustomers.find((ec) => ec.normalized_phone === r.normalized_phone);
      if (match) matchedId = match.id;
    }
    if (!matchedId && r.normalized_email) {
      const match = existingCustomers.find((ec) => ec.normalized_email === r.normalized_email);
      if (match) matchedId = match.id;
    }

    if (matchedId) {
      const errors = [...r.validation_errors];
      errors.push("Trùng lặp DB");
      return {
        ...r,
        validation_status: "duplicate",
        validation_errors: errors,
        error_message: errors.join(" | "),
        duplicate_reason: "DB Match",
        matched_customer_id: matchedId,
        import_action: "skip",
      };
    }
    return r;
  });

  const summary = buildImportSummary(rows);
  console.log("Summary: ", summary);

  // 5. Insert to batches
  const { data: batchData, error: batchError } = await supabase
    .from("customer_import_batches")
    .insert({
      file_name: "test-import-flow.xlsx",
      total_rows: summary.total_rows,
      valid_rows: summary.valid_rows,
      invalid_rows: summary.invalid_rows,
      duplicate_rows: summary.duplicate_rows,
      status: "staging",
      import_mode: "staging_only",
    })
    .select("id")
    .single();

  if (batchError) {
    console.error("Batch error: ", batchError);
    return;
  }
  const batchId = batchData.id;
  console.log("Created batch: ", batchId);

  // 6. Insert to rows
  const rowsPayload = rows.map((r) => ({
    batch_id: batchId,
    row_number: r.row_number,
    raw_data: r.raw_data,
    parsed_data: r.parsed_data,
    name: r.name,
    phone: r.phone,
    normalized_phone: r.normalized_phone,
    email: r.email,
    normalized_email: r.normalized_email,
    validation_status: r.validation_status,
    validation_errors: r.validation_errors,
    import_action: r.import_action,
    matched_customer_id: r.matched_customer_id,
    duplicate_reason: r.duplicate_reason,
    error_message: r.error_message,
    is_valid: r.validation_status === "valid",
  }));

  const { error: chunkError } = await supabase.from("customer_import_rows").insert(rowsPayload);
  if (chunkError) {
    console.error("Row error: ", chunkError);
    return;
  }
  console.log("Inserted rows into staging successfully.");

  // 7. Verify no customers added
  const { count: finalCount } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true });
  console.log(`Số lượng customers lúc sau: ${finalCount}`);
  if (initialCount === finalCount) {
    console.log("✅ Customers table data safety verified.");
  } else {
    console.log("❌ Customers table was mutated!");
  }

  // 8. SQL query equivalents (Outputting the results)
  const { data: batchQuery } = await supabase
    .from("customer_import_batches")
    .select(
      "id, file_name, total_rows, valid_rows, invalid_rows, duplicate_rows, status, import_mode, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1);
  console.log("Batch Staging Data:");
  console.log(batchQuery);

  const { data: rowsQuery } = await supabase
    .from("customer_import_rows")
    .select(
      "row_number, name, phone, email, validation_status, import_action, matched_customer_id, duplicate_reason",
    )
    .eq("batch_id", batchId)
    .order("row_number");
  console.log("Rows Staging Data:");
  console.log(rowsQuery);
}

runTest().catch(console.error);
