import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function requireAdmin(
  req: Request,
): Promise<{ ok: true; userId: string } | { ok: false; res: Response }> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return { ok: false, res: json(401, { error: "Chưa đăng nhập" }) };
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user)
    return { ok: false, res: json(401, { error: "Phiên không hợp lệ" }) };
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const isAdmin = (roles ?? []).some((r) => r.role === "admin");
  if (!isAdmin) return { ok: false, res: json(403, { error: "Cần quyền ADMIN" }) };
  return { ok: true, userId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const action = String(body.action ?? "upsert");

  // Hard delete a custom product (or unset deleted flag — handled via upsert)
  if (action === "hard_delete") {
    const no = Number(body.no);
    if (!Number.isInteger(no)) return json(400, { error: "no không hợp lệ" });
    const { error } = await supabase.from("product_overrides").delete().eq("no", no);
    if (error) return json(500, { error: error.message });
    return json(200, { ok: true });
  }

  // Upsert / create
  let no: number;
  if (action === "create") {
    // Allocate next no >= 1000 for custom items
    const { data: maxRow } = await supabase
      .from("product_overrides")
      .select("no")
      .gte("no", 1000)
      .order("no", { ascending: false })
      .limit(1)
      .maybeSingle();
    no = (maxRow?.no ?? 999) + 1;
  } else {
    no = Number(body.no);
    if (!Number.isInteger(no) || no < 1 || no > 99999) {
      return json(400, { error: "Sản phẩm không hợp lệ" });
    }
  }

  // Optional image upload
  let image_url: string | null | undefined = undefined;
  if ("image_data_url" in body) {
    const dataUrl = body.image_data_url as string | null;
    if (dataUrl === null || dataUrl === "") {
      image_url = null;
    } else if (typeof dataUrl === "string" && dataUrl.startsWith("data:")) {
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) return json(400, { error: "Ảnh không hợp lệ" });
      const mime = match[1];
      const ext = mime.split("/")[1].split("+")[0].replace("jpeg", "jpg");
      const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
      if (bytes.length > 2 * 1024 * 1024) return json(400, { error: "Ảnh quá lớn (tối đa 2MB)" });
      const path = `product-${no}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("product-images")
        .upload(path, bytes, { contentType: mime, upsert: true });
      if (upErr) {
        console.error("Storage upload error:", upErr);
        return json(500, {
          error: `Không thể tải ảnh lên Storage. Hãy đảm bảo Bucket 'product-images' đã được tạo và ở chế độ Public. Chi tiết: ${upErr.message}`,
        });
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      image_url = pub.publicUrl;
    }
  } else if ("image_url" in body) {
    const v = body.image_url;
    image_url = v === null || v === "" ? null : String(v);
  }

  const pickStr = (k: string): string | null | undefined => {
    if (!(k in body)) return undefined;
    const v = body[k];
    if (v === null || v === "") return null;
    return String(v);
  };
  const pickNum = (k: string): number | null | undefined => {
    if (!(k in body)) return undefined;
    const v = body[k];
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const link_url = pickStr("link_url");
  const section = pickStr("section");
  const name = pickStr("name");
  const desc = pickStr("desc");
  const retail_size = pickStr("retail_size");
  const salon_size = pickStr("salon_size");
  const retail_price = pickNum("retail_price");
  const salon_price = pickNum("salon_price");

  const deleted = "deleted" in body ? Boolean(body.deleted) : undefined;
  const is_custom =
    action === "create" ? true : "is_custom" in body ? Boolean(body.is_custom) : undefined;

  const { data: existing } = await supabase
    .from("product_overrides")
    .select("*")
    .eq("no", no)
    .maybeSingle();

  const row: Record<string, unknown> = {
    no,
    image_url: image_url === undefined ? (existing?.image_url ?? null) : image_url,
    link_url: link_url === undefined ? (existing?.link_url ?? null) : link_url,
    section: section === undefined ? (existing?.section ?? null) : section,
    name: name === undefined ? (existing?.name ?? null) : name,
    desc: desc === undefined ? (existing?.desc ?? null) : desc,
    retail_size: retail_size === undefined ? (existing?.retail_size ?? null) : retail_size,
    retail_price: retail_price === undefined ? (existing?.retail_price ?? null) : retail_price,
    salon_size: salon_size === undefined ? (existing?.salon_size ?? null) : salon_size,
    salon_price: salon_price === undefined ? (existing?.salon_price ?? null) : salon_price,
    deleted: deleted === undefined ? (existing?.deleted ?? false) : deleted,
    is_custom: is_custom === undefined ? (existing?.is_custom ?? false) : is_custom,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await supabase
    .from("product_overrides")
    .upsert(row, { onConflict: "no" })
    .select()
    .maybeSingle();
  if (error) return json(500, { error: error.message });

  return json(200, { ok: true, row: saved });
});
