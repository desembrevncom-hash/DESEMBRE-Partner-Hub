-- Migration: Observability Core Tables (Phase A)
-- Created for AI Observability, Safety & Quality Phase A

-- 1. ai_conversation_logs
CREATE TABLE IF NOT EXISTS ai_conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID,
  task_id UUID,
  mode TEXT NOT NULL,
  request_preview TEXT,
  response_preview TEXT,
  retrieved_chunks JSONB,
  prompt_tokens INT,
  completion_tokens INT,
  total_tokens INT,
  estimated_cost_usd NUMERIC(10,4),
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_user ON ai_conversation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_customer ON ai_conversation_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversation_logs_created ON ai_conversation_logs(created_at);

-- 2. ai_safety_events
CREATE TABLE IF NOT EXISTS ai_safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID,
  event_type TEXT NOT NULL,
  phrase TEXT NOT NULL,
  severity TEXT NOT NULL,
  original_response_preview TEXT,
  handled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_safety_events_user ON ai_safety_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_safety_events_customer ON ai_safety_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_safety_events_created ON ai_safety_events(created_at);

-- 3. ai_feedback
CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  customer_id UUID,
  rating TEXT CHECK (rating IN ('up','down')),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_user ON ai_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_customer ON ai_feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_feedback(created_at);
