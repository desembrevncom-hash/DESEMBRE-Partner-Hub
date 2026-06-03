# Sender Accounts Technical Runbook (Phase 6G.0)

## Mục đích

Quản lý các tài khoản/kênh gửi tin (Email, Zalo, SMS) trong CRM. Hướng dẫn cách phân tách rõ ràng giữa **Platform Secrets** (cấu hình kỹ thuật) và **Sender Account Metadata** (trạng thái hiển thị trong CRM).

## Phân biệt Platform Secrets vs Sender Account Metadata

**1. Platform Secrets:**

- Nơi lưu trữ: `Supabase Edge Functions / Secrets`.
- Đối tượng thao tác: **Technical Owner / DevOps**.
- Bao gồm: `RESEND_API_KEY`, `ZALO_OA_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`.
- Lý do: Không bao giờ được lộ lên giao diện Frontend (CRM) hay lưu thô trong Database vì lý do bảo mật.

**2. Sender Account Metadata:**

- Nơi lưu trữ: Bảng `sender_accounts` trong Supabase Database.
- Đối tượng thao tác: **CRM Admin / Quản lý vận hành**.
- Bao gồm: `provider`, `sender_name`, `sender_email`, `status`, `health_status`, `channel`.
- Lý do: Giúp Admin theo dõi trực quan cấu hình nào đang "healthy", cấu hình nào đang "bị lỗi", từ đó yêu cầu technical hỗ trợ khi cần thiết.

---

## Các bước Setup / Cấu hình

### 1. Resend Email (Dành cho Technical Owner)

CRM Admin tuyệt đối không nhập Resend API Key trên giao diện. Bất kỳ khi nào có cảnh báo lỗi, Technical Owner phải làm các bước sau:

**Bước 1: Setup Supabase Secrets**
Chạy CLI hoặc vào Dashboard Supabase -> Settings -> Edge Functions để cấu hình:

```bash
npx supabase secrets set RESEND_API_KEY=re_xxxxxx
npx supabase secrets set EMAIL_FROM_ADDRESS=hello@desembrevn.com
```

_(Optional: Để phục vụ Pilot Testing)_

```bash
npx supabase secrets set INTERNAL_PILOT_RECIPIENTS=admin@desembrevn.com
```

**Bước 2: Verify Domain trên Resend**

- Phải đảm bảo domain của `EMAIL_FROM_ADDRESS` đã được khai báo trên Resend.
- Thêm các bản ghi DNS (SPF, DKIM, DMARC) vào trình quản lý DNS (Cloudflare, Mắt Bão).
- Đợi đến khi trạng thái domain trên Resend là `Verified`.

**Bước 3: Kiểm tra (Dành cho CRM Admin)**

- Vào `CRM -> Admin Hub -> Sender Accounts`.
- Tìm thẻ **Resend Email Sender**.
- Bấm **"Test / Check Health"**. Nút này sẽ gọi Edge Function đọc bí mật tại backend và kiểm tra domain trên Resend. Nếu xanh lá `✅` -> Sẵn sàng.

### 2. Zalo OA (Dành cho Technical Owner)

Hiện tại hệ thống Zalo OA tuân thủ nghiêm ngặt **Source-of-truth Rule**:

**2.1. Kết nối qua OAuth 2.0 (Khuyên dùng)**

- CRM Admin click "Bắt đầu Zalo OAuth" trên giao diện `/admin/sender-accounts`.
- Token (Access Token & Refresh Token) được tự động mã hóa bằng thuật toán `AES-GCM` và lưu vào bảng `sender_account_tokens`.
- Edge Functions (Health Check, Send Test) sẽ ưu tiên gọi bộ giải mã trên RAM (thông qua `_shared/sender-credentials.ts`) để sử dụng Access Token này. Dữ liệu tuyệt đối **không** được trả về frontend hay lưu dạng plaintext.

**2.2. Kết nối cấu hình hệ thống (Platform Secret Legacy)**

- Dùng trong trường hợp hệ thống chỉ có 1 Zalo OA mặc định.
- Bắt buộc cấu hình Zalo OA Access Token ở Supabase Secrets:

```bash
npx supabase secrets set ZALO_OA_ACCESS_TOKEN=xxxxxx
```

- Khi `auth_type` là `platform_secret`, Edge Functions sẽ tự động fallback về biến môi trường này.
- Khi chọn Sender riêng cho từng Campaign, ưu tiên OAuth. Thiếu token ném lỗi `ZALO_TOKEN_FOR_SENDER_MISSING`.

---

## 3. Gửi Test An Toàn (Sandbox)

Việc gửi Test Email/Zalo từ màn hình Sender Accounts / Campaigns sẽ chỉ gửi tới các địa chỉ thuộc `TEST_RECIPIENT_WHITELIST` hoặc `INTERNAL_PILOT_RECIPIENTS` đối với Email, và `ZALO_TEST_ZALO_USER_ID_WHITELIST` đối với Zalo.

- Tuyệt đối không gửi vào danh sách (audience) của khách hàng.
- Riêng với Zalo, KHÔNG cho phép ZNS production chạy ngầm.
- KHÔNG gửi audience thật ở môi trường Test.
- Tuyệt đối không bật cờ gửi Production khi chưa qua các bước (Approval, Dry-run, Final Confirm).
- Khi muốn tắt tính năng gửi Production trên toàn bộ module Marketing, hãy chạy:
  ```bash
  npx supabase secrets set MARKETING_PRODUCTION_SENDING_ENABLED=false
  ```
