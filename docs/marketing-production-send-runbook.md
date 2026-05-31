# Marketing Production Send Runbook

## 1. Mục đích tài liệu
Tài liệu này quy định các bước vận hành, tiêu chuẩn an toàn, và quy trình xử lý rủi ro khi kích hoạt tính năng gửi tin nhắn Marketing thật (Production Sending) thông qua hệ thống DESEMBRE Partner Hub (Resend, SMTP, Zalo OA, ZNS).

## 2. Trạng thái hiện tại
🚨 **PRODUCTION SENDING ĐANG KHÓA (LOCKED)** 🚨
Hiện tại hệ thống đang ở Phase 6F.3. Tính năng gửi tin thật bị khóa cứng ở cấp độ Edge Function và UI. Chỉ có tính năng Dry-run (Tính toán Audience) là được phép hoạt động.

## 3. Điều kiện tối thiểu trước khi bật gửi thật
Để một chiến dịch có thể thực sự gửi tin ra ngoài, hệ thống và quy trình phải thỏa mãn **TẤT CẢ** các điều kiện sau:
- [ ] Campaign đã được duyệt (`approval_status = 'approved'`).
- [ ] Tính năng Dry-run đã chạy thành công và báo cáo không có lỗi.
- [ ] Đã kiểm tra Suppression List (không gửi cho danh sách đen).
- [ ] Re-check Consent thành công (người dùng đã Opt-in).
- [ ] Không có người dùng nào Opt-out (`opt_out_at = null`).
- [ ] Dữ liệu không bị trùng lặp (Duplicate excluded).
- [ ] Cấu hình Provider hợp lệ (Sender, Domain).
- [ ] Domain đã xác thực (Verified SPF/DKIM/DMARC) hoặc OA/ZNS Template đã duyệt.
- [ ] Rate Limit đã được thiết lập chặt chẽ (VD: 100 email/lô, 10 zalo/lô).
- [ ] Kill Switch `MARKETING_PRODUCTION_SENDING_ENABLED` đã được bật thủ công trong cấu hình môi trường.
- [ ] Xác nhận tay bằng chữ "CONFIRM" từ Admin.

## 4. Quy trình gửi thật đề xuất sau này
1. **Create Draft**: Tạo chiến dịch với nội dung bản nháp.
2. **Preview Audience**: Xem trước Segment.
3. **Request Approval**: Yêu cầu phê duyệt.
4. **Approve**: Cấp quản lý phê duyệt.
5. **Run Dry-run**: Bấm chạy Production Readiness Check.
6. **Review Counts**: Kiểm tra kỹ số lượng Eligible và các nhóm bị loại (Excluded).
7. **Review Suppression**: Kiểm tra cẩn thận nhóm Suppressed.
8. **Enable Production Flag**: Bật biến môi trường `MARKETING_PRODUCTION_SENDING_ENABLED=true`.
9. **Send first small batch**: Gửi mẻ nhỏ đầu tiên để đánh giá tình hình.
10. **Monitor logs**: Theo dõi Delivery Logs và tỷ lệ Bounce.
11. **Pause/Rollback**: Ngưng gửi ngay lập tức nếu tỷ lệ lỗi cao.

## 5. Rollback / Stop Strategy
Nếu phát hiện sự cố (Spam rate cao, gửi nhầm đối tượng):
- Tắt ngay ENV `MARKETING_PRODUCTION_SENDING_ENABLED=false` (Đây là Global Kill Switch).
- Vô hiệu hóa các Scheduled Jobs (nếu có ở các phase sau).
- Bổ sung ngay các liên hệ khiếu nại vào `marketing_suppression_list`.
- Kiểm tra báo cáo Failed/Bounced trong Logs.

## 6. Chính sách Loại trừ (Không gửi cho ai?)
Tuyệt đối không bao giờ gửi tin nhắn cho các nhóm sau:
- **No Consent**: Khách hàng chưa từng đồng ý nhận tin.
- **Opt-out**: Khách hàng đã hủy đăng ký.
- **Blocked/Lost/Inactive**: Khách hàng bị khóa, đã mất hoặc không còn hoạt động.
- **Duplicate**: Số điện thoại hoặc Email trùng lặp trong một chiến dịch.
- **Suppressed**: Địa chỉ nằm trong danh sách đen của hệ thống.

## 7. Ghi chú đặc biệt cho Provider
- **Email (Resend/SMTP)**: Phải đảm bảo Domain đã được cài đặt SPF/DKIM/DMARC để tránh bị đưa vào hòm Spam. Luôn theo dõi tỷ lệ Bounce/Complaint để cập nhật Suppression List.
- **Zalo**:
  - Zalo OA: Chỉ gửi tin được cho Follower (Khách hàng đã quan tâm OA) hoặc khách đã tương tác trong 7 ngày (tùy chính sách hiện hành của Zalo).
  - ZNS: Template bắt buộc phải được Zalo duyệt trước khi dùng làm biến gửi.

## 8. Nguyên tắc Bảo mật
- KHÔNG BAO GIỜ commit secrets (API Keys, Tokens) vào Source Code.
- KHÔNG BAO GIỜ để lộ secret cho Frontend.
- TẤT CẢ các lệnh gọi API gửi tin (Provider Request) phải đi qua Backend (Supabase Edge Functions).

## 9. Checklist Trọng yếu Trước Mỗi Lượt Gửi Production
- [ ] Kiểm tra nội dung tin nhắn không có lỗi chính tả/format.
- [ ] Kiểm tra Biến nội dung (Merge tags `{{name}}` v.v...) đã được map chính xác.
- [ ] Chạy Dry-run và xác nhận số lượng khớp với dự tính.
- [ ] Test thử (Sandbox Test) bằng Admin email/zalo.
- [ ] Sẵn sàng trực chiến để giám sát sau khi bấm Send.
