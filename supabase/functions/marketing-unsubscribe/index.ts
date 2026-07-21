import { serve } from "https://deno.land/std@0.182.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { verifyUnsubscribeToken } from "../_shared/marketing-token.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function maskEmail(email: string): string {
  if (!email || !email.includes("@")) return "email của bạn";
  const [name, domain] = email.split("@");
  if (name.length <= 2) return `${name[0]}***@${domain}`;
  return `${name.slice(0, 2)}***@${domain}`;
}

const HTML_TEMPLATE = (title: string, message: string, showButton: boolean, token?: string) => `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Hủy đăng ký nhận Email</title>
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
        <button type="submit" class="btn" id="submitBtn" onclick="this.disabled=true; this.form.submit();">Xác nhận Hủy Đăng Ký</button>
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
        return new Response(HTML_TEMPLATE("Lỗi", "Liên kết không hợp lệ hoặc đã hết hạn.", false), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      const payload = await verifyUnsubscribeToken(token, encKey);
      if (!payload) {
        return new Response(HTML_TEMPLATE("Lỗi", "Liên kết không hợp lệ hoặc đã hết hạn.", false), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      return new Response(
        HTML_TEMPLATE(
          "Xác nhận hủy đăng ký",
          `Bạn có chắc chắn muốn ngừng nhận email quảng cáo tới <strong>${maskEmail(payload.email)}</strong> không? Bạn có thể bỏ qua trang này nếu không muốn thay đổi.`,
          true,
          token
        ),
        {
          headers: { "Content-Type": "text/html" },
        }
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
        return new Response(HTML_TEMPLATE("Lỗi", "Không tìm thấy token.", false), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      const payload = await verifyUnsubscribeToken(token, encKey);
      if (!payload) {
        return new Response(HTML_TEMPLATE("Lỗi", "Liên kết không hợp lệ hoặc đã hết hạn.", false), {
          status: 400,
          headers: { "Content-Type": "text/html" },
        });
      }

      // Update customer_consents
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

      // Insert into marketing_suppression_list
      // We use upsert on (channel, normalized_contact_value) if the unique index handles it.
      // Or we simply check if it exists first.
      
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
          customer_id: payload.customerId,
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
            source: "email_unsubscribe",
            is_active: true,
            metadata: metadata,
          });

        if (supErr) {
          console.error("[marketing-unsubscribe] Failed to insert suppression list for masked email", maskEmail(payload.email));
        }
      }

      // Write Audit log if possible or delivery log update?
      // For now, consent and suppression list are enough.

      return new Response(
        HTML_TEMPLATE(
          "Hủy đăng ký thành công",
          "Bạn đã được xóa khỏi danh sách nhận email quảng cáo. Xin cảm ơn!",
          false
        ),
        {
          headers: { "Content-Type": "text/html" },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[marketing-unsubscribe] error", {
      name: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return new Response(HTML_TEMPLATE("Lỗi hệ thống", "Đã có lỗi xảy ra. Vui lòng thử lại sau.", false), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }
});
