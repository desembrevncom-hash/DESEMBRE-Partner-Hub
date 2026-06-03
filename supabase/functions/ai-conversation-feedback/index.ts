import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action, conversation_id } = body;

    if (!conversation_id) return json({ error: "conversation_id is required" }, 400);

    // Check is admin
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isAdmin = roles?.some((r) => ["admin", "sub_admin"].includes(r.role));

    // --- ACTION: Sale rates a response ---
    if (action === "rate") {
      const { feedback_score, feedback_note } = body;
      if (!feedback_score || feedback_score < 1 || feedback_score > 5) {
        return json({ error: "feedback_score must be 1-5" }, 400);
      }
      // Ensure the conversation belongs to this user
      const { data: conv } = await adminClient
        .from("ai_conversations")
        .select("user_id")
        .eq("id", conversation_id)
        .single();

      if (!conv) return json({ error: "Conversation not found" }, 404);
      if (!isAdmin && conv.user_id !== user.id) return json({ error: "Forbidden" }, 403);

      const { error: updateErr } = await adminClient
        .from("ai_conversations")
        .update({ feedback_score, feedback_note: feedback_note || null })
        .eq("id", conversation_id);

      if (updateErr) throw updateErr;
      return json({ success: true, message: "Đã lưu đánh giá" });
    }

    // --- ACTION: Admin flags hallucination ---
    if (action === "flag_hallucination") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { hallucination_note } = body;
      const { error: updateErr } = await adminClient
        .from("ai_conversations")
        .update({
          hallucination_flag: true,
          hallucination_note: hallucination_note || null,
        })
        .eq("id", conversation_id);

      if (updateErr) throw updateErr;
      return json({ success: true, message: "Đã gắn flag ảo giác" });
    }

    // --- ACTION: Admin unflags hallucination ---
    if (action === "unflag_hallucination") {
      if (!isAdmin) return json({ error: "Admin only" }, 403);
      const { error: updateErr } = await adminClient
        .from("ai_conversations")
        .update({ hallucination_flag: false, hallucination_note: null })
        .eq("id", conversation_id);

      if (updateErr) throw updateErr;
      return json({ success: true, message: "Đã gỡ flag ảo giác" });
    }

    return json(
      { error: "Unknown action. Use: rate | flag_hallucination | unflag_hallucination" },
      400,
    );
  } catch (err: any) {
    return json({ error: err.message || "Unknown error" }, 500);
  }
});
