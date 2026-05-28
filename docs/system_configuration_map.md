# Pre-Pilot System Configuration Reconciliation Map

Bản đồ này liệt kê trạng thái của toàn bộ cài đặt hệ thống (System Configuration) trước khi thực hiện Pilot, để theo dõi độ đồng bộ giữa DB, Runtime và Giao diện (UI).

## Status Definitions
- **ACTIVE**: Đang được hệ thống sử dụng thật ở Runtime.
- **HARDCODED**: Logic đang được code cứng trong source code, chưa đọc từ DB.
- **MISSING**: Code cần thông số này nhưng DB chưa có (thường dẫn đến hardcode ngầm định).
- **UI_ONLY**: Cấu hình có trên giao diện nhưng chưa có ảnh hưởng/runtime không đọc.
- **DISABLED FOR PILOT**: Thông số đang bị ghi đè hoặc vô hiệu hóa bắt buộc trong kỳ Pilot.

---

## Bảng Cấu hình

| Nhóm Setting | Setting Name | Bảng (Source Table) | Trạng Thái | Default | Pilot Value | Ghi Chú / Runtime Effect |
| --- | --- | --- | --- | --- | --- | --- |
| **AI Governance** | `ai_enabled` | `system_settings` | **ACTIVE** | `false` | `false` | Tắt/bật toàn bộ luồng gọi LLM. Tác động thật đến Edge Functions. |
| | `ai_customer_suggestions_enabled` | `system_settings` | **ACTIVE** | `false` | `false` | Tắt/bật AI tự động gợi ý hành động/chăm sóc. |
| | `ai_sales_assistant_enabled` | `system_settings` | **ACTIVE** | `false` | `true` | Bật/tắt AI cho Assistant. Đang active. |
| | `ai_rag_enabled` | `system_settings` | **ACTIVE** | `false` | `true` | Bật/tắt Module RAG (Knowledge). |
| | `ai_rewrite_enabled` | `system_settings` | **ACTIVE** | `false` | `false` | Rewrite text module. |
| | `ai_daily_limit` | `system_settings` | **ACTIVE** | `0` | `100` | Giới hạn gọi LLM mỗi ngày (Tránh lạm dụng token). |
| | `ai_cache_minutes` | `system_settings` | **ACTIVE** | `0` | `15` | Cache response giảm cost. |
| | `product_copilot_enabled` | `system_settings` | **ACTIVE** | `true` | `true` | Floating Chatbot UI. |
| | `product_copilot_sale_enabled` | - | **MISSING** | - | `true` | Phân quyền Copilot cho Sale. (Thiếu cột DB). |
| | `product_copilot_admin_enabled` | - | **MISSING** | - | `true` | Phân quyền Copilot cho Admin. (Thiếu cột DB). |
| | `product_copilot_require_context` | - | **MISSING** | - | `false` | Ép Copilot dùng Context hay không. (Thiếu cột DB). |
| | `product_copilot_daily_limit` | - | **MISSING** | - | `50` | Giới hạn Copilot (Thiếu cột DB). |
| **Automation** | `pilot_mode_enabled` | `system_settings` | **ACTIVE** | `true` | `true` | Bypass các rule chặt trong thời gian pilot. |
| | `automation_enabled` | `system_settings` | **ACTIVE** | `false` | `false` | **DISABLED FOR PILOT** (đề xuất tắt để an toàn). |
| | `due_generator_enabled` | `system_settings` | **ACTIVE** | `false` | `false` | **DISABLED FOR PILOT** (tránh sinh rác task ảo). |
| | `notification_enabled` | `system_settings` | **ACTIVE** | `false` | `true` | `create_notification_safe` insert vào DB. |
| | `automation_daily_limit` | `system_settings` | **ACTIVE** | `200` | `50` | Giới hạn số trigger rule. |
| | `notification_daily_limit` | `system_settings` | **ACTIVE** | `500` | `100` | Giới hạn notification push. |
| **Pilot Modules** | `ai_customer_suggestions` | `pilot_modules` | **ACTIVE** | - | `off` | Trạng thái Rollout của module trong bảng `pilot_modules`. |
| | `communication_os` | `pilot_modules` | **ACTIVE** | - | `on` | |
| | `message_templates` | `pilot_modules` | **ACTIVE** | - | `on` | |
| | `interaction_tracking` | `pilot_modules` | **ACTIVE** | - | `on` | |
| | `automation_rules` | `pilot_modules` | **ACTIVE** | - | `admin_only` | |
| | `due_generator` | `pilot_modules` | **ACTIVE** | - | `off` | |
| **Dispatch / CRM Ops** | `lead capacity limit` | - | **HARDCODED** | `30` | `30` | `src/routes/admin/crm-ops.tsx` (dòng 186) đang code chết là chia cho 30. |
| | `SLA overdue threshold` | - | **HARDCODED** | `now()` | - | `src/routes/tasks.tsx` check `due_at < Date.now()`. |
| | `stale lead threshold` | - | **HARDCODED** | `14 days`| - | `src/lib/operationalRules.ts` (dòng 90). |
| | `quote stale threshold` | - | **HARDCODED** | `3 days` | - | `src/lib/operationalRules.ts` (dòng 95). |
| | `first touch SLA` | - | **HARDCODED** | `No touch` | - | `src/lib/operationalRules.ts`. |
| | `recovery threshold` | - | **HARDCODED** | `30 days`| - | Lãng quên 30 ngày `src/lib/operationalRules.ts` (dòng 101). |
