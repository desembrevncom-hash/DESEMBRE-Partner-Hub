import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `
Bạn là trợ lý AI phân tích khách hàng cho phần mềm CRM Spa (DESEMBRE).
Mục tiêu: Đưa ra 1 gợi ý hành động tiếp theo, kênh liên lạc phù hợp, mẫu tin nhắn nếu cần, và nhận diện các rủi ro (risk flags).

Nguyên tắc bắt buộc:
1. Bạn CHỈ GỢI Ý. Người dùng sẽ tự thực hiện.
2. KHÔNG TỰ BỊA RA dữ liệu không có trong phần context.
3. KHÔNG KHẲNG ĐỊNH các cam kết y khoa (như "chữa khỏi hẳn", "đảm bảo hết nám").
4. Nếu thiếu dữ liệu để gợi ý, hãy cung cấp risk flag "Thiếu dữ liệu" và gợi ý an toàn (ví dụ: Gọi điện hỏi thăm).
5. Output BẮT BUÓC phải là định dạng JSON chính xác như sau (không kèm markdown \`\`\`json):
{
  "next_best_action": {
    "action": "call|zalo|facebook|email|schedule|quote|update_profile",
    "reason": "Giải thích ngắn gọn tại sao",
    "priority": "high|medium|low"
  },
  "recommended_channel": {
    "platform": "zalo|facebook|email|phone|tiktok",
    "reason": "Giải thích tại sao chọn kênh này"
  },
  "message_suggestion": {
    "platform": "zalo",
    "text": "Nội dung tin nhắn gợi ý, để sale có thể copy",
    "template_id": null
  },
  "risk_flags": [
    { "type": "stale", "severity": "high", "message": "10 ngày chưa chăm sóc" }
  ],
  "confidence": 0.8
}
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Lấy token của user để xác thực
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const reqData = await req.json();
    if (reqData.test === true) {
      return new Response(JSON.stringify({ status: "pass", message: "Ping successful" }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { customerId, includeMessageSuggestion } = reqData;
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'Missing customerId' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Kiểm tra ai_settings xem module có bật không
    const { data: aiSettings } = await supabaseAdmin.from('ai_settings').select('*').eq('id', 'default').single();
    if (!aiSettings || !aiSettings.ai_enabled || !aiSettings.ai_customer_suggestions_enabled) {
      return new Response(JSON.stringify({ 
        error: 'AI is globally disabled or Customer Suggestions are disabled in AI Settings',
        safe_disabled: true
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1b. Kiểm tra quyền Pilot Mode
    const { data: hasPilotAccess } = await supabaseUser.rpc('check_pilot_access', { p_module_key: 'ai_customer_suggestions', p_user_id: user.id });
    if (!hasPilotAccess) {
      return new Response(JSON.stringify({ 
        error: 'Access denied by pilot mode settings (ai_customer_suggestions).',
        safe_disabled: true
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI key not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 2. Kiểm tra quyền truy cập customer (User RPC)
    const { data: hasAccess } = await supabaseUser.rpc('can_view_customer', { p_customer_id: customerId, p_user_id: user.id });
    const { data: isAdmin } = await supabaseUser.rpc('is_admin_or_sub_admin', { p_user_id: user.id });
    
    if (!hasAccess && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Access denied to this customer' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 3. Fetch dữ liệu khách hàng
    const { data: customer } = await supabaseAdmin.from('customers').select('*').eq('id', customerId).single();
    const { data: timeline } = await supabaseAdmin.rpc('get_customer_timeline', { p_customer_id: customerId });
    const { data: channels } = await supabaseAdmin.from('customer_contact_channels').select('*').eq('customer_id', customerId);

    // Xây dựng context JSON string
    const customerContext = {
      profile: {
        name: customer?.name,
        health_score: customer?.health_score,
        tier: customer?.tier,
        lifecycle_stage: customer?.lifecycle_stage
      },
      channels: channels?.map((c: any) => ({ type: c.channel_type, purpose: c.channel_purpose, status: c.resolve_status })),
      recent_timeline: Array.isArray(timeline) ? timeline.slice(0, 15).map((t: any) => ({
        source: t.source,
        type: t.type,
        title: t.title,
        occurred_at: t.occurred_at,
        status: t.status
      })) : []
    };

    const promptText = `
Hãy phân tích dữ liệu khách hàng dưới đây và đưa ra gợi ý hành động tiếp theo:
Dữ liệu khách hàng (JSON):
${JSON.stringify(customerContext)}
`;

    // 4. Gọi OpenAI API
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: aiSettings.chat_model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptText }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('OpenAI error:', errText);
      throw new Error('Failed to generate AI suggestion');
    }

    const aiData = await res.json();
    const contentStr = aiData.choices[0].message.content;
    const tokenUsage = aiData.usage;

    let suggestionJson = {};
    try {
      suggestionJson = JSON.parse(contentStr);
    } catch(e) {
      console.error("Parse JSON error", contentStr);
      throw new Error('AI returned invalid JSON');
    }

    // 5. Lưu vào ai_customer_suggestions
    const { data: savedSuggestion, error: insertErr } = await supabaseAdmin.from('ai_customer_suggestions').insert({
      customer_id: customerId,
      generated_for: user.id,
      suggestion_type: 'next_best_action',
      suggestion_json: suggestionJson,
      confidence: (suggestionJson as any).confidence || 0.8,
      status: 'active',
      source_snapshot: customerContext,
      model: aiSettings.chat_model || 'gpt-4o-mini',
      provider: 'openai',
      token_usage: tokenUsage
    }).select().single();

    if (insertErr) {
      console.error("Lỗi insert ai_customer_suggestions:", insertErr);
    }

    return new Response(JSON.stringify(savedSuggestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
