# Pilot Rollback Plan (Kế hoạch Khôi phục sự cố)

Tài liệu hướng dẫn khôi phục hệ thống trong trường hợp đợt Pilot gặp lỗi nghiêm trọng (Blocker runtime, hỏng data, leak role).

## 1. Rollback Source Code (Quay lại phiên bản Code cũ)

Nếu lỗi nằm ở giao diện hoặc logic phía Client/Server mới update, chạy lệnh sau ở máy chủ để quay về mốc an toàn:

```bash
# Dừng ứng dụng
git fetch --tags
git checkout v0.9.0-pre-pilot
# Chạy lại build và restart
npm run build
npm start
```

## 2. Restore Database (Phục hồi Dữ liệu)

Trường hợp data bị rác hoặc sai lệch đồng loạt:

- Trích xuất dữ liệu từ các file CSV/SQL đã export trước đó.
- Hoặc sử dụng tính năng **Point-in-Time Recovery** (PITR) của Supabase để tua ngược database về thời điểm chuẩn (ví dụ: ngày 2026-05-27).
- Danh sách các bảng ưu tiên nằm ở: `pilot_backup_checklist.md`

## 3. Fallback AI & Automation (Vô hiệu hoá Tự động hoá)

Nếu tính năng AI Suggestion hoặc Routing Automation gợi ý sai:

- Truy cập vào **Admin -> System Settings -> Automation**.
- Tạm tắt (Disable) các rule engine.
- Chuyển khách hàng về trạng thái phân công thủ công (Manual Assignment).

## 4. Bật Safe Mode / Maintenance Mode

Nếu không thể fix ngay lập tức:

- Đẩy flag `NEXT_PUBLIC_MAINTENANCE_MODE=true` vào Vercel (hoặc server).
- Toàn bộ Sale/Tele sẽ bị khóa phiên đăng nhập hiển thị màn hình "Hệ thống đang bảo trì", để ngăn người dùng thao tác sinh thêm lỗi.
