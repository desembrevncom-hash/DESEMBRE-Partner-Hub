# Release Notes

## Version: v0.9.0-pre-pilot

- **Release Date**: 2026-05-27
- **Commit Hash**: `be82b43c48b3da646ae3ac95f81f5df19102fdc9`

### Migrations

- Dữ liệu tĩnh và cấu trúc DB hiện tại (Customers, Orders, Tasks, Activities). Không có migration schema mới trong bản này.

### Edge Functions

- Các RPC functions như `get_customer_interaction_summary` và rule engine AI.
- Supabase triggers đã được deploy trước đó.

### Known Issues

- `CustomerPreviewDrawer`: Z-index overlay của Dialog lồng nhau thỉnh thoảng làm mờ Toast message.
- `TemplateDispatcher`: Chỉ có thể dùng chuột chọn template, chưa hỗ trợ Navigation bằng phím mũi tên.

### Rollback Instructions

Vui lòng tham khảo tài liệu chi tiết: `docs/releases/pilot_rollback_plan.md`.
