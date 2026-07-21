# DESEMBRE Partner Hub - M6 Onboarding Summary & Roadmap

Tài liệu này tổng hợp toàn bộ kiến trúc, tiến độ và bối cảnh của dự án **DESEMBRE Partner Hub** tính đến Milestone 6 (M6) nhằm giúp Developer mới có thể nắm bắt nhanh chóng và tiếp tục triển khai các Phase tiếp theo (6G.2 - 6I).

## 1. Tổng quan Kiến trúc (Architecture Overview)

Dự án là một hệ thống B2B Partner Hub dành cho DESEMBRE, được chia thành hai Frontend chính (Partner Hub & Academy) và sử dụng chung một Backend Supabase.

- **Frontend**: React (Vite), TypeScript, Tailwind CSS, TanStack Router.
  - *Partner Hub*: Dành cho Admin/Nhân viên nội bộ quản lý CRM, Marketing, và hệ thống Academy.
  - *Desembre Academy*: Dành cho Học viên (Khách hàng Spa) học các khóa học nghiệp vụ.
- **Backend**: Supabase
  - *Database*: PostgreSQL với Row Level Security (RLS) phân quyền nghiêm ngặt theo roles (`admin`, `sub_admin`, `sale`, v.v.).
  - *Edge Functions*: Deno, dùng để xử lý các logic nhạy cảm (Gửi Email, Gửi Zalo, xử lý OTP, đồng bộ Google Calendar).
  - *Auth*: Supabase Auth (Sử dụng Phone Auth kết hợp Zalo ZNS để gửi OTP).

## 2. Các Module Chính đã hoàn thiện (Đến M6)

### 2.1. CRM & Core
- Quản lý Khách hàng (Customers), Đơn hàng (Orders), Check-in hiện trường (Field Visits).
- Phân quyền theo khu vực (Locations/Map Owner).
- Cơ chế bảo mật PII (Che giấu thông tin nhạy cảm của khách hàng trên UI).

### 2.2. Desembre Academy (Đào tạo)
- **Quản lý Nội dung (Content Studio)**: Khóa học, Module, Bài học (Video, Article, Quiz).
- **Quyền lợi & Ghi danh (Enrollment)**: Khách hàng yêu cầu tham gia khóa học -> Admin duyệt -> Mở khóa nội dung.
- **Phone Auth & Zalo OTP**: Đã hoàn thiện luồng đăng nhập bằng số điện thoại. Sử dụng custom SMS webhook của Supabase (`send-otp-zalo-zns`) để gọi API Zalo ZNS gửi mã OTP (Sử dụng secret `ACADEMY_SMS_HOOK_SECRET`).

### 2.3. Marketing Automation & Senders (Trọng tâm hiện tại)
Hệ thống Marketing đang ở giai đoạn chuẩn bị Release Production (M6), với cơ chế an toàn cực kỳ khắt khe:
- **Sender Accounts (`sender_accounts`)**: Quản lý thông tin cấu hình gửi (Resend cho Email, Zalo OA cho Zalo). Hỗ trợ OAuth và tự động refresh token (`zalo-token-refresh`). Mật khẩu/Token được mã hóa AES-GCM trong database (`sender_account_tokens`).
- **Marketing Campaigns**: Quản lý chiến dịch, phân tập khách hàng (Segments/Audiences).
- **Execution & Sandboxing**: Mọi chiến dịch trước khi chạy thực tế đều phải qua bước Dry-run, PII Masking, và tuân thủ nguyên tắc "không gửi bừa bãi" (hiện tại đang bị giới hạn bằng Whitelist ở môi trường staging).

---

## 3. Trạng thái hiện tại (Cuối M6G.1)

Chúng ta vừa hoàn thành:
1. **Academy Release Prep**: Đã chuẩn bị Checklist, Runbook, và Smoke test cho việc đưa Academy lên Production (sau khi Zalo cấp phép template OTP).
2. **Email Pilot (Resend)**: Đã triển khai khung gửi Email qua Resend, có lưu log (`marketing_delivery_logs`), nhưng **chưa** cho phép gửi thật tới khách hàng mass.

=> **Chúng ta đang dừng ở bước quyết định (Go/No-Go) sau khi chạy thử nghiệm (Pilot) hệ thống gửi Email, trước khi chuyển sang xây dựng cơ chế Unsubscribe/Bounces để bảo vệ Domain.**

---

## 4. Roadmap Tiếp theo (Nhiệm vụ của Developer mới)

Dưới đây là định hướng các Phase tiếp theo bạn cần thực hiện theo thứ tự (tập trung vào Marketing Email & Zalo Readiness):

### Phase 6G.2 — Pilot Report & Go/No-Go
**Mục tiêu**: Tổng kết đợt pilot gửi email nội bộ/whitelist và quyết định có đủ điều kiện đi tiếp chưa.
- **Cần báo cáo**: Số lượng email đã gửi, gửi tới ai, có lọt email ngoài whitelist không, Resend `message_id`, trạng thái Inbox, lỗi Domain/Sender, tính chính xác của DB log, kiểm tra leak secret. Đã test rollback chưa?
- **Action**: Dựa trên báo cáo, nếu đạt (Go) mới sang Phase 6H.

### Phase 6H.0 — Unsubscribe & Opt-out Foundation *(Quan trọng nhất trước khi gửi khách thật)*
**Mục tiêu**: Khách có thể từ chối nhận email, và CRM ghi nhận opt-out đúng.
- Xây dựng Unsubscribe link/token cho email marketing.
- Viết Edge Function xử lý unsubscribe.
- Cập nhật bảng `customer_consents`: `is_opt_in=false`, `opt_out_at=now()`.
- Thêm record vào `marketing_suppression_list` (reason=unsubscribe).
- Tạo trang xác nhận Unsubscribe (Không cần login, không lộ data khách).

### Phase 6H.1 — Resend Webhook: Bounce / Complaint / Failed
**Mục tiêu**: Tự động đưa các email bị bounce/complaint vào suppression list để bảo vệ Domain Reputation.
- Viết Edge Function nhận Webhook từ Resend.
- Verify webhook signature.
- Lắng nghe event: `delivered`, `bounced`, `complained`, `failed`.
- Update bảng `marketing_delivery_logs`.
- Nếu bounced/complaint → tự động chui vào `marketing_suppression_list`. Không retry hard fail.

### Phase 6H.2 — Limited Customer Audience Pilot
**Mục tiêu**: Gửi production thật cho nhóm **5–10 khách** đã opt-in rõ ràng.
- Điều kiện chạy: Campaign approved, Dry-run pass, Suppression & Consent được check, email có link Unsubscribe, Webhook đã hoạt động.
- Batch size: 5-10. Bật cờ `MARKETING_PRODUCTION_SENDING_ENABLED` tạm thời, bắt Admin gõ `CONFIRM`.

### Phase 6H.3 — Delivery Monitoring Dashboard
**Mục tiêu**: UI quản lý giám sát sau khi gửi.
- Thống kê các chỉ số: `sent`, `delivered`, `failed`, `bounced`, `complained`, `unsubscribed`, `suppressed`. (Đặt trong route `/marketing/logs` hoặc `/marketing/reports`).

### Phase 6H.4 — Controlled Scale-up
**Mục tiêu**: Tăng dần quy mô gửi nếu batch 5-10 ổn định.
- Lộ trình: Batch 2 (20) -> Batch 3 (50) -> Batch 4 (100).
- Tiêu chí theo dõi: Bounce rate, Complaint rate, Unsubscribe rate, Failed rate. Nếu tỷ lệ lỗi tăng, hệ thống phải dừng ngay.

### Phase 6I — Zalo Production Readiness
**Mục tiêu**: Chuẩn hóa Zalo sau khi Email đã ổn định. Tách bạch rõ 2 hình thức:
- **Zalo OA Message**: Cần `zalo_user_id`, khách phải follow OA, không gửi trực tiếp bằng số điện thoại.
- **Zalo ZNS**: Chỉ gửi các template đã được Zalo duyệt (như OTP, thông báo đơn hàng), truyền đúng params, không gửi `draft_body` tự do.
- **Yêu cầu kỹ thuật**: Test whitelist, hoàn thiện chính sách OA/ZNS, đảm bảo cron/logic refresh token chạy mượt, quản lý quota/rate limit và tách biệt delivery log cho Zalo.

---

> **Lưu ý tối quan trọng dành cho Dev mới:** Tuyệt đối không bypass Phase 6H.0 (Unsubscribe) và 6H.1 (Webhook). Nếu gửi email marketing hàng loạt mà không có chức năng Unsubscribe hoặc không xử lý Bounce/Complaint, Domain Resend sẽ bị đánh sập Reputation và đưa vào Blacklist lập tức. Tôn trọng thiết kế Sandboxing và Whitelist hiện tại.
