export function sanitizeEventJson(rawJson: any): Record<string, any> {
  if (!rawJson || typeof rawJson !== 'object') {
    return {};
  }

  const safeKeys = [
    'reason',
    'mock_phase',
    'mock_provider',
    'mock_execution',
    'mock_execution_id',
    'execution_id',
    'finalized_at'
  ];

  const sanitized: Record<string, any> = {};

  for (const key of safeKeys) {
    if (key in rawJson) {
      sanitized[key] = rawJson[key];
    }
  }

  return sanitized;
}

export function sanitizeAttemptResponse(attempt: any) {
  const eventJsonSafe = sanitizeEventJson(attempt.event_json);

  return {
    dispatch_id: attempt.dispatch_id,
    execution_id:
      attempt.execution_id ??
      eventJsonSafe.execution_id ??
      eventJsonSafe.mock_execution_id ??
      null,
    event_type: attempt.event_type,
    created_at: attempt.created_at,
    event_json_safe: eventJsonSafe
  };
}
