export interface MockDispatchRow {
  id: string;
  send_batch_id: string;
  idempotency_key: string | null;
  channel: string;
  provider_account_id: string;
  contact_value: string;
  payload_snapshot_json: any;
  provider_payload_json: any;
  status: string;
  attempt_count: number;
}

export const mockDispatchRows: MockDispatchRow[] = [
  {
    id: "disp-001",
    send_batch_id: "batch-1",
    idempotency_key: "idem-custom-001",
    channel: "ZALO_ZNS",
    provider_account_id: "acc-zalo-1",
    contact_value: "+84901234567",
    payload_snapshot_json: { simulate: "success" },
    provider_payload_json: {},
    status: "ready",
    attempt_count: 0
  },
  {
    id: "disp-002",
    send_batch_id: "batch-1",
    idempotency_key: null,
    channel: "EMAIL",
    provider_account_id: "acc-email-1",
    contact_value: "customer@example.com",
    payload_snapshot_json: { simulate: "failure" },
    provider_payload_json: {},
    status: "ready",
    attempt_count: 1
  },
  {
    id: "disp-003",
    send_batch_id: "batch-1",
    idempotency_key: null,
    channel: "ZALO_ZNS",
    provider_account_id: "acc-zalo-1",
    contact_value: "+84987654321",
    payload_snapshot_json: { simulate: "timeout" },
    provider_payload_json: {},
    status: "ready",
    attempt_count: 0
  }
];
