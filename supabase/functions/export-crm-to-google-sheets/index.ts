import { JWT } from "https://esm.sh/google-auth-library@9.14.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json(
        { success: false, error: "Method not allowed", step: "init", details: "Only POST allowed" },
        405,
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(
        {
          success: false,
          error: "Missing Authorization header",
          step: "auth",
          details: "No token provided",
        },
        401,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return json(
        {
          success: false,
          error: "Missing Supabase server configuration",
          step: "env",
          details: "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing",
        },
        500,
      );
    }

    // Create client with service role for full DB access, but verify user first
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return json(
        {
          success: false,
          error: "Unauthorized",
          step: "auth",
          details: userError?.message || "Invalid user token",
        },
        401,
      );
    }

    // Check role
    const { data: userRoles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    if (rolesError) {
      return json(
        {
          success: false,
          error: "Failed to check permissions",
          step: "role",
          details: rolesError.message,
        },
        500,
      );
    }

    const roles = (userRoles || []).map((r) => r.role);
    const isAdminOrSubAdmin = roles.includes("admin") || roles.includes("sub_admin");

    if (!isAdminOrSubAdmin) {
      return json(
        {
          success: false,
          error: "Forbidden: Admins only",
          step: "role",
          details: "User is not admin or sub_admin",
        },
        403,
      );
    }

    // Concurrency Check
    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: processingLogs } = await supabase
      .from("crm_sync_logs")
      .select("id, created_at")
      .eq("status", "processing")
      .gte("created_at", fiveMinsAgo)
      .order("created_at", { ascending: false })
      .limit(1);

    if (processingLogs && processingLogs.length > 0) {
      return json(
        {
          success: false,
          error: "Đang có phiên đồng bộ khác đang chạy",
          step: "concurrency",
          details: "Please try again later",
        },
        409,
      );
    }

    // Initialize Log
    const { data: syncLog, error: logError } = await supabase
      .from("crm_sync_logs")
      .insert({
        status: "processing",
        created_by: user.id,
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to create log:", logError);
      return json(
        {
          success: false,
          error: "Failed to initialize sync log",
          step: "log",
          details: logError.message,
        },
        500,
      );
    }

    const syncLogId = syncLog.id;

    // Async block for DB logging capability
    try {
      const serviceAccountEmail = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_EMAIL") || "";
      let privateKey =
        Deno.env.get("GOOGLE_PRIVATE_KEY") ||
        Deno.env.get("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY") ||
        "";
      const spreadsheetId = Deno.env.get("GOOGLE_SPREADSHEET_ID") || "";

      const missing = [];
      if (!serviceAccountEmail) missing.push("GOOGLE_SERVICE_ACCOUNT_EMAIL");
      if (!privateKey) missing.push("GOOGLE_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)");
      if (!spreadsheetId) missing.push("GOOGLE_SPREADSHEET_ID");

      if (missing.length > 0) {
        throw {
          step: "env",
          error: "Missing Google Sheets configuration",
          details: `Missing: ${missing.join(", ")}`,
        };
      }

      privateKey = privateKey.replace(/\\n/g, "\n");

      const client = new JWT({
        email: serviceAccountEmail,
        key: privateKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      let tokenResponse;
      try {
        tokenResponse = await client.getAccessToken();
      } catch (e: any) {
        throw {
          step: "google_auth",
          error: "Failed to authenticate with Google API",
          details: e.message || "Invalid Private Key or Service Account",
        };
      }

      const accessToken = tokenResponse.token;

      if (!accessToken) {
        throw {
          step: "google_auth",
          error: "Failed to negotiate access token",
          details: "Token is empty",
        };
      }

      // =====================================
      // 1. Customers_Master (limit 10000)
      // =====================================
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select(
          `
          id, name, business_name, contact_name, phone, email, city, source, status,
          lifecycle_stage, owner_sale_id, owner_tele_id, last_contacted_at, last_activity_at,
          created_at
        `,
        )
        .order("created_at", { ascending: false })
        .limit(10000);

      if (customersError)
        throw {
          step: "db_query",
          error: "Failed to fetch customers",
          details: customersError.message,
        };

      const customersValues = [
        [
          "customer_id",
          "name",
          "business_name",
          "contact_name",
          "phone",
          "email",
          "city",
          "source_or_channel",
          "status",
          "lifecycle_stage",
          "owner_sale_id",
          "owner_tele_id",
          "last_contacted_at",
          "last_activity_at",
          "created_at",
          "data_health",
        ],
      ];

      (customers || []).forEach((c) => {
        let health = "Good";
        if (!c.phone && !c.email) health = "Missing Contact";
        else if (!c.owner_sale_id && !c.owner_tele_id) health = "Unassigned";

        customersValues.push([
          c.id,
          c.name,
          c.business_name || "",
          c.contact_name || "",
          c.phone || "",
          c.email || "",
          c.city || "",
          c.source || "",
          c.status || "",
          c.lifecycle_stage || "",
          c.owner_sale_id || "",
          c.owner_tele_id || "",
          c.last_contacted_at || "",
          c.last_activity_at || "",
          c.created_at || "",
          health,
        ]);
      });

      // =====================================
      // 2. Data_Quality
      // =====================================
      const totalCustomers = customers?.length || 0;
      const missingContact = customers?.filter((c) => !c.phone && !c.email).length || 0;
      const unassigned = customers?.filter((c) => !c.owner_sale_id && !c.owner_tele_id).length || 0;

      const dataQualityValues = [
        ["metric", "count", "description"],
        ["total_customers", totalCustomers.toString(), "Total evaluated customers (up to 10k)"],
        ["missing_contact", missingContact.toString(), "Missing both phone and email"],
        ["unassigned", unassigned.toString(), "No sale or tele owner assigned"],
        ["not_contacted_7_days", "N/A", "Requires deeper query"],
      ];

      // =====================================
      // 3. Import_Logs
      // =====================================
      const { data: importLogs, error: logsError } = await supabase
        .from("customer_import_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (logsError)
        throw {
          step: "db_query",
          error: "Failed to fetch import logs",
          details: logsError.message,
        };

      const importLogsValues = [
        [
          "batch_id",
          "file_name",
          "status",
          "total_rows",
          "valid_rows",
          "invalid_rows",
          "duplicate_rows",
          "inserted_rows",
          "skipped_rows",
          "failed_rows",
          "created_at",
          "completed_at",
          "error_message",
        ],
      ];

      (importLogs || []).forEach((log) => {
        importLogsValues.push([
          log.id,
          log.file_name,
          log.status,
          String(log.total_rows || 0),
          String(log.valid_rows || 0),
          String(log.invalid_rows || 0),
          String(log.duplicate_rows || 0),
          String(log.inserted_rows || 0),
          String(log.skipped_rows || 0),
          String(log.failed_rows || 0),
          log.created_at || "",
          log.completed_at || "",
          log.error_message || "",
        ]);
      });

      // =====================================
      // 4. Unassigned_Customers (limit 5000)
      // =====================================
      const { data: unassignedCustomers, error: unassignedError } = await supabase
        .from("customers")
        .select(
          `
          id, name, business_name, contact_name, phone, email, city, source, status,
          lifecycle_stage, created_at, last_contacted_at
        `,
        )
        .is("owner_sale_id", null)
        .is("owner_tele_id", null)
        .order("created_at", { ascending: false })
        .limit(5000);

      if (unassignedError)
        throw {
          step: "db_query",
          error: "Failed to fetch unassigned customers",
          details: unassignedError.message,
        };

      const unassignedValues = [
        [
          "customer_id",
          "name",
          "business_name",
          "contact_name",
          "phone",
          "email",
          "city",
          "source_or_channel",
          "status",
          "lifecycle_stage",
          "created_at",
          "last_contacted_at",
          "data_health",
        ],
      ];

      (unassignedCustomers || []).forEach((c) => {
        let health = "Good";
        if (!c.phone && !c.email) health = "Missing Contact";
        unassignedValues.push([
          c.id,
          c.name,
          c.business_name || "",
          c.contact_name || "",
          c.phone || "",
          c.email || "",
          c.city || "",
          c.source || "",
          c.status || "",
          c.lifecycle_stage || "",
          c.created_at || "",
          c.last_contacted_at || "",
          health,
        ]);
      });

      // =====================================
      // 5. Duplicate_Check
      // =====================================
      const { data: dupPhones, error: dupPhonesError } = await supabase
        .from("v_customers_duplicate_phone")
        .select("*")
        .limit(1000);
      const { data: dupEmails, error: dupEmailsError } = await supabase
        .from("v_customers_duplicate_email")
        .select("*")
        .limit(1000);

      if (dupPhonesError)
        throw {
          step: "db_query",
          error: "Failed to fetch duplicate phones",
          details: dupPhonesError.message,
        };
      if (dupEmailsError)
        throw {
          step: "db_query",
          error: "Failed to fetch duplicate emails",
          details: dupEmailsError.message,
        };

      const duplicateValues = [
        ["duplicate_type", "duplicate_value", "total", "customer_ids", "names", "phones", "emails"],
      ];

      const allDupIds = new Set<string>();
      (dupPhones || []).forEach((d) =>
        (d.customer_ids || []).forEach((id: string) => allDupIds.add(id)),
      );
      (dupEmails || []).forEach((d) =>
        (d.customer_ids || []).forEach((id: string) => allDupIds.add(id)),
      );

      const dupDetailsMap = new Map<string, any>();
      const dupIdsArray = Array.from(allDupIds);
      for (let i = 0; i < dupIdsArray.length; i += 500) {
        const chunk = dupIdsArray.slice(i, i + 500);
        const { data: chunkDetails, error: chunkError } = await supabase
          .from("customers")
          .select("id, name, phone, email")
          .in("id", chunk);
        if (chunkError)
          throw {
            step: "db_query",
            error: "Failed to fetch customer duplicates details",
            details: chunkError.message,
          };
        (chunkDetails || []).forEach((d) => dupDetailsMap.set(d.id, d));
      }

      const processDuplicates = (type: string, list: any[]) => {
        (list || []).forEach((d) => {
          const ids = d.customer_ids || [];
          const details = ids.map((id: string) => dupDetailsMap.get(id)).filter(Boolean);

          let displayIds = ids.slice(0, 10).join(", ");
          let displayNames = details
            .map((x: any) => x.name)
            .slice(0, 10)
            .join(", ");
          let displayPhones = details
            .map((x: any) => x.phone || "")
            .slice(0, 10)
            .join(", ");
          let displayEmails = details
            .map((x: any) => x.email || "")
            .slice(0, 10)
            .join(", ");

          if (ids.length > 10) {
            displayIds += ", ...";
            displayNames += ", ...";
            displayPhones += ", ...";
            displayEmails += ", ...";
          }

          duplicateValues.push([
            type,
            type === "Phone" ? d.normalized_phone : d.normalized_email,
            String(d.duplicate_count),
            displayIds,
            displayNames,
            displayPhones,
            displayEmails,
          ]);
        });
      };

      processDuplicates("Phone", dupPhones || []);
      processDuplicates("Email", dupEmails || []);

      // =====================================
      // 6. Daily_Summary
      // =====================================
      const todayStr = new Date().toISOString().split("T")[0];
      const d7 = new Date();
      d7.setDate(d7.getDate() - 7);

      const [
        { count: totalCustomersCount, error: err1 },
        { count: newCustomersTodayCount, error: err2 },
        { count: newCustomers7DaysCount, error: err3 },
        { count: unassignedCountAgg, error: err4 },
        { count: totalBatchesCount, error: err5 },
        { count: completedBatchesCount, error: err6 },
        { count: failedBatchesCount, error: err7 },
        { data: lastImportData, error: err8 },
        { data: lastSyncData, error: err9 },
      ] = await Promise.all([
        supabase.from("customers").select("*", { count: "exact", head: true }),
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .gte("created_at", todayStr),
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .gte("created_at", d7.toISOString()),
        supabase
          .from("customers")
          .select("*", { count: "exact", head: true })
          .is("owner_sale_id", null)
          .is("owner_tele_id", null),
        supabase.from("customer_import_batches").select("*", { count: "exact", head: true }),
        supabase
          .from("customer_import_batches")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("customer_import_batches")
          .select("*", { count: "exact", head: true })
          .eq("status", "failed"),
        supabase
          .from("customer_import_batches")
          .select("created_at")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("crm_sync_logs")
          .select("completed_at")
          .eq("status", "success")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (err1 || err2 || err3 || err4 || err5 || err6 || err7 || err8 || err9) {
        throw {
          step: "db_query",
          error: "Failed to fetch daily summary metrics",
          details: "Multiple queries failed",
        };
      }

      const dailySummaryValues = [
        ["metric", "value", "description"],
        ["total_customers", String(totalCustomersCount || 0), "Total customers in database"],
        ["new_customers_today", String(newCustomersTodayCount || 0), "Customers created today"],
        [
          "new_customers_7_days",
          String(newCustomers7DaysCount || 0),
          "Customers created in last 7 days",
        ],
        ["imported_customers_7_days", "N/A", "Requires complex join, skipping for performance"],
        ["unassigned_customers", String(unassignedCountAgg || 0), "Customers without any owner"],
        ["duplicate_phone_groups", String(dupPhones?.length || 0), "Groups of duplicate phones"],
        ["duplicate_email_groups", String(dupEmails?.length || 0), "Groups of duplicate emails"],
        ["not_contacted_7_days", "N/A", "Requires activity log join"],
        ["total_import_batches", String(totalBatchesCount || 0), "Total batches uploaded"],
        [
          "completed_import_batches",
          String(completedBatchesCount || 0),
          "Batches successfully confirmed",
        ],
        ["failed_import_batches", String(failedBatchesCount || 0), "Batches failed processing"],
        ["last_import_at", lastImportData?.created_at || "N/A", "Last import batch created"],
        [
          "last_google_sheet_sync_at",
          lastSyncData?.completed_at || "N/A",
          "Last successful Google Sheet sync",
        ],
      ];

      // =====================================
      // 7. Remarketing Email Ready & 8. Remarketing Zalo Ready
      // =====================================
      const { data: consents, error: consentsError } = await supabase
        .from("customer_consents")
        .select("*");
      const { data: zaloProfiles, error: zaloError } = await supabase
        .from("customer_zalo_profiles")
        .select("*");

      if (consentsError)
        throw {
          step: "db_query",
          error: "Failed to fetch consents",
          details: consentsError.message,
        };
      if (zaloError)
        throw {
          step: "db_query",
          error: "Failed to fetch zalo profiles",
          details: zaloError.message,
        };

      const consentMap = new Map<string, any[]>();
      (consents || []).forEach((c) => {
        if (!consentMap.has(c.customer_id)) consentMap.set(c.customer_id, []);
        consentMap.get(c.customer_id)!.push(c);
      });

      const zaloProfileMap = new Map<string, any>();
      (zaloProfiles || []).forEach((zp) => zaloProfileMap.set(zp.customer_id, zp));

      const emailReadyValues = [
        [
          "customer_id",
          "name",
          "email",
          "phone",
          "source_or_channel",
          "status",
          "lifecycle_stage",
          "consent_status",
          "opt_in_at",
          "consent_source",
          "last_contacted_at",
          "reason",
        ],
      ];

      const zaloReadyValues = [
        [
          "customer_id",
          "name",
          "phone",
          "email",
          "zalo_user_id",
          "oa_follow_status",
          "source_or_channel",
          "status",
          "lifecycle_stage",
          "consent_status",
          "opt_in_at",
          "consent_source",
          "last_contacted_at",
          "reason",
        ],
      ];

      (customers || []).forEach((c) => {
        const isBlocked = c.status === "blocked" || c.status === "lost" || c.status === "inactive";
        const isDuplicate = allDupIds.has(c.id);
        const cConsents = consentMap.get(c.id) || [];

        const emailConsent = cConsents.find((x) => x.channel === "email");
        const zaloConsent = cConsents.find((x) => x.channel === "zalo" || x.channel === "zalo_oa");
        const hasOptOut = cConsents.some((x) => x.opt_out_at != null);

        // Email Ready Check
        if (
          !isBlocked &&
          !isDuplicate &&
          !hasOptOut &&
          emailConsent &&
          emailConsent.is_opt_in === true &&
          c.email &&
          c.email.includes("@")
        ) {
          if (emailReadyValues.length <= 5000) {
            emailReadyValues.push([
              c.id,
              c.name,
              c.email || "",
              c.phone || "",
              c.source || "",
              c.status || "",
              c.lifecycle_stage || "",
              "opt_in",
              emailConsent.opt_in_at || "",
              emailConsent.source || "",
              c.last_contacted_at || "",
              "Đủ điều kiện",
            ]);
          }
        }

        // Zalo Ready Check
        const profile = zaloProfileMap.get(c.id);
        const hasZaloReady =
          (zaloConsent && zaloConsent.is_opt_in === true) || (profile && profile.zalo_id);
        if (
          !isBlocked &&
          !isDuplicate &&
          !hasOptOut &&
          hasZaloReady &&
          c.phone &&
          c.phone.length >= 9
        ) {
          if (zaloReadyValues.length <= 5000) {
            zaloReadyValues.push([
              c.id,
              c.name,
              c.phone || "",
              c.email || "",
              profile?.zalo_id || "",
              profile?.oa_follow_status || "",
              c.source || "",
              c.status || "",
              c.lifecycle_stage || "",
              "opt_in",
              zaloConsent?.opt_in_at || "",
              zaloConsent?.source || "",
              c.last_contacted_at || "",
              "Đủ điều kiện",
            ]);
          }
        }
      });

      // =====================================
      // Google Sheets Push Updates
      // =====================================
      const updates = [
        { range: "Customers_Master!A1", values: customersValues },
        { range: "Data_Quality!A1", values: dataQualityValues },
        { range: "Import_Logs!A1", values: importLogsValues },
        { range: "Unassigned_Customers!A1", values: unassignedValues },
        { range: "Duplicate_Check!A1", values: duplicateValues },
        { range: "Daily_Summary!A1", values: dailySummaryValues },
        { range: "Remarketing_Email_Ready!A1", values: emailReadyValues },
        { range: "Remarketing_Zalo_Ready!A1", values: zaloReadyValues },
      ];

      // Auto-create tabs if they don't exist
      const requiredTabs = [
        "Customers_Master",
        "Data_Quality",
        "Import_Logs",
        "Unassigned_Customers",
        "Duplicate_Check",
        "Daily_Summary",
        "Remarketing_Email_Ready",
        "Remarketing_Zalo_Ready",
      ];
      const getSheetUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      let getSheetRes;
      try {
        getSheetRes = await fetch(getSheetUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (e: any) {
        throw { step: "tabs", error: "Failed to connect to Google Sheets API", details: e.message };
      }

      if (getSheetRes.ok) {
        const spreadsheetData = await getSheetRes.json();
        const existingTabs = spreadsheetData.sheets.map((s: any) => s.properties.title);
        const tabsToCreate = requiredTabs.filter((t) => !existingTabs.includes(t));

        if (tabsToCreate.length > 0) {
          const createTabsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
          const createTabsRes = await fetch(createTabsUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: tabsToCreate.map((title) => ({
                addSheet: { properties: { title } },
              })),
            }),
          });
          if (!createTabsRes.ok) {
            const errData = await createTabsRes.json();
            throw {
              step: "tabs",
              error: "Failed to auto-create missing tabs",
              details: errData.error?.message || "Unknown error",
            };
          }
        }
      } else {
        const errData = await getSheetRes.json();
        throw {
          step: "tabs",
          error: "Failed to fetch spreadsheet info",
          details: errData.error?.message || "Spreadsheet might not exist or no permission",
        };
      }

      const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;

      let sheetResponse;
      try {
        sheetResponse = await fetch(updateUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            valueInputOption: "USER_ENTERED",
            data: updates,
          }),
        });
      } catch (e: any) {
        throw {
          step: "write",
          error: "Network error writing to Google Sheets",
          details: e.message,
        };
      }

      const responseData = await sheetResponse.json();

      if (!sheetResponse.ok) {
        let errMsg = responseData.error?.message || "Lỗi giao tiếp Google Sheets API";

        if (errMsg.includes("Unable to parse range")) {
          const match = errMsg.match(/range: ([^!]+)!/);
          const tabName = match ? match[1] : "Customers_Master";
          errMsg = `Google Sheet của bạn đang thiếu Tab (Trang tính) tên là "${tabName}". Vui lòng tạo tab này ở dưới đáy màn hình Google Sheet!`;
        }

        throw { step: "write", error: "Failed to write data to Google Sheets", details: errMsg };
      }

      // Success
      const rowCounts = {
        Customers_Master: customersValues.length - 1,
        Data_Quality: dataQualityValues.length - 1,
        Import_Logs: importLogsValues.length - 1,
        Unassigned_Customers: unassignedValues.length - 1,
        Duplicate_Check: duplicateValues.length - 1,
        Daily_Summary: dailySummaryValues.length - 1,
        Remarketing_Email_Ready: emailReadyValues.length - 1,
        Remarketing_Zalo_Ready: zaloReadyValues.length - 1,
      };

      await supabase
        .from("crm_sync_logs")
        .update({
          status: "success",
          completed_at: new Date().toISOString(),
          metadata: {
            row_counts: rowCounts,
            spreadsheet_id: spreadsheetId,
            service_account: serviceAccountEmail,
          },
        })
        .eq("id", syncLogId);

      return json({
        success: true,
        sync_log_id: syncLogId,
        spreadsheet_id: spreadsheetId,
        tabs: requiredTabs,
        row_counts: rowCounts,
        message: "Sync completed successfully with 8 tabs",
      });
    } catch (errPayload: any) {
      console.error("Sync Error Payload:", errPayload);

      const step = errPayload.step || "unknown";
      const errorMsg = errPayload.error || errPayload.message || "Unknown Error";
      const details = errPayload.details || "";

      await supabase
        .from("crm_sync_logs")
        .update({
          status: "failed",
          error_message: `${errorMsg}${details ? " - " + details : ""}`,
          completed_at: new Date().toISOString(),
        })
        .eq("id", syncLogId);

      return json(
        {
          success: false,
          error: errorMsg,
          step: step,
          details: details,
        },
        400,
      );
    }
  } catch (error: any) {
    console.error("Function fatal error:", error);
    return json(
      {
        success: false,
        error: "Internal Server Error",
        step: "fatal",
        details: error.message || "Unknown fatal error",
      },
      500,
    );
  }
});
