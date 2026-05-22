const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testInsert() {
  console.log("Testing insert...");
  
  // Insert temporary customer
  const { data: customer, error: custError } = await supabase
    .from('customers')
    .insert({ name: 'Test Customer Temp' })
    .select('id')
    .single();

  if (custError) {
    console.error("Failed to insert temporary customer:", custError.message);
    return;
  }
  const customerId = customer.id;
  console.log("Using Customer ID:", customerId);

  // Insert into ai_conversation_logs
  const logObj = {
    request_id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    mode: 'summary',
    customer_id: customerId,
    status: 'success'
  };

  const { data: insertedLog, error: logError } = await supabase
    .from('ai_conversation_logs')
    .insert(logObj)
    .select('*')
    .single();

  if (logError) {
    console.error("Failed to insert to ai_conversation_logs:", logError.message);
    // Cleanup customer
    await supabase.from('customers').delete().eq('id', customerId);
    return;
  }
  console.log("Successfully inserted to ai_conversation_logs! Log ID:", insertedLog.id);

  // Check if it appears in ai_conversations
  const { data: convSample, error: convError } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('id', insertedLog.id);
  
  console.log("Checking in ai_conversations table for that ID:", convSample);

  // Try to insert feedback pointing to that ID
  const { data: fbRow, error: fbError } = await supabase
    .from('ai_feedback')
    .insert({
      conversation_id: insertedLog.id, // wait, what if conversation_id doesn't match?
      customer_id: customerId,
      feedback_type: 'thumbs_up',
      mode: 'summary',
      content_shown: 'Test summary content'
    })
    .select('*')
    .single();

  if (fbError) {
    console.error("Failed to insert to ai_feedback pointing to log ID:", fbError.message);
  } else {
    console.log("Successfully inserted to ai_feedback! Feedback ID:", fbRow.id);
    // Clean up feedback
    await supabase.from('ai_feedback').delete().eq('id', fbRow.id);
  }

  // Clean up log
  await supabase.from('ai_conversation_logs').delete().eq('id', insertedLog.id);
  // Clean up customer
  await supabase.from('customers').delete().eq('id', customerId);
}

testInsert();
