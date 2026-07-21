import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { verifyUnsubscribeToken } from "../_shared/marketing-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function htmlResponse(html: string, status = 200) {
  const headers = new Headers(corsHeaders);
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store, max-age=0");
  return new Response(html, { status, headers });
}

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "email cua ban";
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

const HTML_TEMPLATE = (title: string, message: string, showButton: boolean, token?: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Huy dang ky nhan Email</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f9fafb;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      color: #111827;
    }
    .container {
      background-color: #ffffff;
      padding: 2.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      text-align: center;
      max-width: 400px;
      width: 90%;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #1f2937;
    }
    p {
      color: #4b5563;
      margin-bottom: 2rem;
      line-height: 1.5;
    }
    .btn {
      background-color: #ef4444;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 0.375rem;
      font-size: 1rem;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .btn:hover {
      background-color: #dc2626;
    }
    .btn:disabled {
      background-color: #fca5a5;
      cursor: not-allowed;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <p>${message}</p>
    ${
      showButton
        ? `
      <form method="POST">
        <input type="hidden" name="token" value="${token}" />
        <button type="submit" class="btn" id="submitBtn" onclick="this.disabled=true; this.form.submit();">Xac nhan Huy Dang Ky</button>
      </form>
    `
        : ""
    }
  </div>
</body>
</html>
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encKey = Deno.env.get("TOKEN_ENCRYPTION_KEY") || supabaseServiceKey;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    if (req.method === "GET") {
      const token = url.searchParams.get("token");
      if (!token) {
        console.log("[marketing-unsubscribe] html response", { method: req.method, status: 400, contentType: "text/html" });
        return htmlResponse(HTML_TEMPLATE("Loi", "Lien ket khong hop le hoac da het han.", false), 400);
      }

      const payload = await verifyUnsubscribeToken(token, encKey);
      if (!payload) {
        console.log("[marketing-unsubscribe] html response", { method: req.method, status: 400, contentType: "text/html" });
        return htmlResponse(HTML_TEMPLATE("Loi", "Lien ket khong hop le hoac da het han.", false), 400);
      }

      console.log("[marketing-unsubscribe] html response", { method: req.method, status: 200, contentType: "text/html" });
      return htmlResponse(
        HTML_TEMPLATE(
          "Xac nhan huy dang ky",
          `Ban co chac chan muon ngung nhan email quang cao toi <strong>${maskEmail(payload.email)}</strong> khong? Ban co the bo qua trang nay neu khong muon thay doi.`,
          true,
          token
        )
      );
    }

    if (req.method === "POST") {
      let token: string | null = url.searchParams.get("token");

      if (!token) {
        // Try parsing form data
        const formData = await req.formData().catch(() => null);
        if (formData) {
          token = formData.get("token") as string | null;
        }
      }

      if (!token) {
        console.log("[marketing-unsubscribe] html response", { method: req.method, status: 400, contentType: "text/html" });
        return htmlResponse(HTML_TEMPLATE("Loi", "Khong tim thay token.", false), 400);
      }

      const payload = await verifyUnsubscribeToken(token, encKey);
      if (!payload) {
        console.log("[marketing-unsubscribe] html response", { method: req.method, status: 400, contentType: "text/html" });
        return htmlResponse(HTML_TEMPLATE("Loi", "Lien ket khong hop le hoac da het han.", false), 400);
      }

      if (payload.customerId && payload.customerId !== "test-sandbox-customer") {
        const { error: consentErr } = await adminClient
          .from("customer_consents")
          .update({
            is_opt_in: false,
            opt_out_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("customer_id", payload.customerId)
          .eq("channel", "email");

        if (consentErr) {
          console.error("[marketing-unsubscribe] Failed to update consent for masked email", maskEmail(payload.email));
        }
      }

      const normalizedEmail = payload.email.trim().toLowerCase();
      
      const { data: existingSuppression } = await adminClient
        .from("marketing_suppression_list")
        .select("id")
        .eq("channel", "email")
        .eq("normalized_contact_value", normalizedEmail)
        .eq("is_active", true)
        .maybeSingle();

      if (!existingSuppression) {
        const metadata = {
          customer_id: payload.customerId === "test-sandbox-customer" ? null : payload.customerId,
          campaign_id: payload.campaignId,
          delivery_log_id: payload.deliveryLogId,
        };

        const { error: supErr } = await adminClient
          .from("marketing_suppression_list")
          .insert({
            channel: "email",
            contact_value: payload.email,
            normalized_contact_value: normalizedEmail,
            reason: "unsubscribe",
            source: "marketing_unsubscribe",
            is_active: true,
            metadata: metadata,
          });

        if (supErr) {
          console.error("[marketing-unsubscribe] Failed to insert suppression list for masked email", maskEmail(payload.email));
        }
      }

      console.log("[marketing-unsubscribe] html response", { method: req.method, status: 200, contentType: "text/html" });
      return htmlResponse(
        HTML_TEMPLATE(
          "Da huy dang ky thanh cong",
          "Ban da duoc xoa khoi danh sach nhan email quang cao. Xin cam on!",
          false
        )
      );
    }

    return htmlResponse(HTML_TEMPLATE("Loi", "Method not allowed.", false), 405);

  } catch (error: any) {
    console.error("[marketing-unsubscribe] error", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    console.log("[marketing-unsubscribe] html response", { method: req.method, status: 500, contentType: "text/html" });
    return htmlResponse(HTML_TEMPLATE("Loi he thong", "Da co loi xay ra. Vui long thu lai sau.", false), 500);
  }
});
