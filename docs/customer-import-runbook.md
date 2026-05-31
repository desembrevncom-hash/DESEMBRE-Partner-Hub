# Hướng Dẫn Vận Hành Hệ Thống Customer Import (Safe Import)

Tài liệu này cung cấp hướng dẫn đầy đủ về tính năng Import khách hàng an toàn (Safe Import) từ file Excel/CSV vào hệ thống CRM. Tính năng này được thiết kế theo Phase 4D để đảm bảo tính an toàn dữ liệu, tránh ghi đè sai lầm và kiểm soát rủi ro ở mức tối đa.

## 1. Mục đích
Hệ thống **Safe Import** nhằm mục đích nhập liệu hàng loạt khách hàng mới vào hệ thống mà **KHÔNG** làm thay đổi (ghi đè) bất kỳ thông tin nào của khách hàng hiện tại.
- Cho phép xác thực, kiểm tra lỗi, trùng lặp trước khi lưu.
- Hỗ trợ lưu trữ nháp (Staging) để xem trước, từ đó Admin/Quản lý có thể Review và Confirm.
- Đảm bảo tính toàn vẹn thông qua Audit Log (ghi chép lại mọi hành động).

## 2. Format File Mẫu
File upload hỗ trợ định dạng **.xlsx** hoặc **.csv**. File nên bao gồm các cột sau (cột có dấu * là bắt buộc phải có ít nhất 1 trong 2 để nhận diện liên lạc):

| Cột | Ý nghĩa | Lưu ý |
|---|---|---|
| Tên Spa | Tên cơ sở/doanh nghiệp | Bắt buộc nếu không có Tên Liên Hệ |
| Tên Liên Hệ | Tên người phụ trách | Bắt buộc nếu không có Tên Spa |
| Điện thoại* | Số điện thoại di động | Hỗ trợ bắt trùng lặp (Unique) |
| Email* | Email liên hệ | Hỗ trợ bắt trùng lặp (Unique) |
| Địa chỉ | Địa chỉ khách hàng | |
| Tỉnh/Thành | Tỉnh thành | Cần ghi rõ ràng theo tên hành chính |
| Nguồn | Nguồn khách hàng | Bắt buộc (ví dụ: `facebook`, `offline`, v.v.) |
| Ghi chú | Lưu ý thêm | |

*(Lưu ý: Hệ thống **KHÔNG** hỗ trợ import file vượt quá **2.000 dòng** trong 1 lần để đảm bảo an toàn bộ nhớ và hiệu suất kiểm duyệt của UI).*

## 3. Quy trình Import 5 Bước

1. **Upload File**: Truy cập mục **CRM Ops** -> Bấm **Nhập Lead Excel**. Tải file dữ liệu lên hệ thống.
2. **Validate (Kiểm tra dữ liệu)**: Frontend sẽ tự động đọc file và xác thực các thông tin bắt buộc, cấu trúc email, SĐT.
3. **Save Staging (Lưu nháp)**: Sau khi kiểm tra, nhấn lưu vào bảng Staging. Lúc này dữ liệu nằm trên nháp, CHƯA vào bảng `customers`. Hệ thống sinh ra 1 Batch ID.
4. **Review Batch (Đánh giá)**: Tại phần *Lịch sử Import*, tìm lô dữ liệu vừa tạo (trạng thái: `Staging`). Bấm **Review** để xem chi tiết các dòng hợp lệ, bị trùng, hoặc lỗi.
5. **Confirm Import (Xác nhận)**:
   - Nếu thấy dữ liệu hợp lệ (`valid_rows` > 0), Admin bấm **Xác nhận Import**.
   - RPC ở Backend sẽ duyệt qua các dòng `create_new` và lưu vào Database.
   - Các dòng Lỗi/Trùng/Bỏ qua sẽ bị loại trừ hoàn toàn.
   - Hệ thống không hỗ trợ tự động ghi đè (`update_existing`).

## 4. Ý nghĩa các trạng thái (Status)

### 4.1. Trạng thái của Lô Import (Batch Status)
- 🟡 **Staging / Pending**: Lô dữ liệu đang nằm trên nháp, chờ Review và Confirm.
- 🔵 **Processing**: Đang trong quá trình Confirm vào hệ thống (Backend đang chạy, không thể can thiệp lúc này).
- 🟢 **Completed**: Đã hoàn tất import. Không thể confirm lại (đảm bảo Idempotency).
- 🔴 **Failed**: Có lỗi hệ thống nghiêm trọng khiến giao dịch Import thất bại, cần liên hệ kỹ thuật để check `error_message`.

### 4.2. Trạng thái Dòng dữ liệu (Validation Status)
- **Valid (Hợp lệ)**: Đủ dữ liệu chuẩn, sẵn sàng import mới (`create_new`).
- **Warning (Cảnh báo)**: Dữ liệu chưa chuẩn 100% (ví dụ: thiếu tỉnh thành) nhưng vẫn đủ điều kiện để tạo mới.
- **Invalid (Lỗi)**: Dữ liệu bị thiếu thông tin cốt lõi (SĐT, Tên) hoặc sai định dạng. Sẽ không được import.
- **Duplicate (Trùng lặp)**: SĐT hoặc Email bị phát hiện đã tồn tại trong DB, hoặc trùng lặp với một dòng khác ngay trong cùng 1 file. Sẽ bị bỏ qua (`skip`).

## 5. Hướng dẫn dọn dẹp Test Data trên Staging

Để tránh lãng phí dung lượng và gây rối mắt, Admin nên dọn dẹp dữ liệu test:
1. **Cách nhận diện**: Các Batch test thường có `file_name` chứa "test", "demo" hoặc có tổng số dòng nhỏ (< 10 dòng).
2. **Xóa an toàn**: Hiện tại xóa qua câu lệnh SQL trên DB Console (chỉ nhân sự Dev/Data được thao tác):
   ```sql
   -- Xóa nguyên 1 Batch Nháp (tự động cascade xóa các row nháp)
   DELETE FROM public.customer_import_batches WHERE status = 'staging' AND id = 'MÃ_BATCH_CẦN_XÓA';
   ```
3. **NGUYÊN TẮC QUAN TRỌNG**:
   - **Tuyệt đối KHÔNG** tạo script/cronjob tự động xóa dữ liệu Staging/Production khi chưa có yêu cầu từ Ban Giám đốc.
   - Không được dùng `DELETE FROM customers` để xóa test data trên Production. Nếu đã lỡ Confirm, hãy chuyển Status của khách test đó thành `blocked` hoặc `inactive` thay vì hard-delete.

## 6. Các vấn đề đã biết (Known Issues) và Rủi ro

1. **Giới hạn số lượng**: Pagination đã được áp dụng, nhưng nếu file quá lớn (> 5.000 dòng), việc parse file JS ngay trên máy khách (trình duyệt) có thể gây lag tạm thời trước khi upload.
2. **BulkLeadImportDialog**: Component cũ `BulkLeadImportDialog` đã bị loại bỏ khỏi luồng chính. KHÔNG sử dụng lại Component này vì nó đi thẳng vào DB thiếu an toàn.
3. **Security**: Tính năng này đã được khóa ở cả tầng Frontend và Backend (RLS/RPC). **Telesale/Sale KHÔNG thể truy cập** hoặc tìm cách gõ lệnh ngầm để đẩy dữ liệu.
4. **Lịch sử hoạt động (Audit Log)**: Giai đoạn Phase 4C có issue lưu log lỗi do Check Constraint. Giai đoạn 4D đã fix (ghi chú với `activity_type` = 'note'). Tuy nhiên cần kiểm tra kỹ lại trong mục "Ghi chú khách hàng" sau khi import thành công.
