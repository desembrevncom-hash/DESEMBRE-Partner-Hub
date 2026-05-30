const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('./src');
let modifiedCount = 0;

// Safe replacements using very specific string patterns to avoid greedy matches
const replacements = [
    { regex: /"Thêm khách hàng thành công!?"/g, replace: '"Đã tạo khách hàng mới."' },
    { regex: /"Lưu thành công!?"/g, replace: '"Đã lưu thay đổi."' },
    { regex: /"Đã lưu thành công!?"/g, replace: '"Đã lưu thay đổi."' },
    { regex: /"Cập nhật thành công!?"/g, replace: '"Đã cập nhật."' },
    { regex: /"Đã cập nhật thành công!?"/g, replace: '"Đã cập nhật."' },
    { regex: /"Thêm thành công!?"/g, replace: '"Đã thêm dữ liệu."' },
    { regex: /"Xóa thành công!?"/g, replace: '"Đã xóa dữ liệu."' },
    { regex: /"Đã xóa thành công!?"/g, replace: '"Đã xóa dữ liệu."' },
    { regex: /"Tạo thành công!?"/g, replace: '"Đã tạo."' },
    { regex: /"Hoàn thành công việc thành công!?"/g, replace: '"Đã hoàn thành công việc."' },
    { regex: /"Lỗi hệ thống/g, replace: '"Lỗi' },
    { regex: /"Lỗi xảy ra/g, replace: '"Lỗi' },
    { regex: /"Lỗi khi/g, replace: '"Không thể' },
    { regex: /"Thêm việc cần làm thành công!?"/g, replace: '"Đã thêm công việc."' },
    { regex: /"Đã thêm việc cần làm thành công!?"/g, replace: '"Đã thêm công việc."' },
    { regex: /"Import thành công!?"/g, replace: '"Đã nhập dữ liệu."' },
    { regex: /"Đã lưu ghi chú thành công!?"/g, replace: '"Đã lưu ghi chú."' },
    { regex: /"Lưu ghi chú thành công!?"/g, replace: '"Đã lưu ghi chú."' },
    { regex: /"Đã copy mẫu gửi khách thành công!?"/g, replace: '"Đã copy mẫu gửi khách."' },
    { regex: /"Success!"/g, replace: '"Đã hoàn tất."' },
    { regex: /"Completed successfully"/g, replace: '"Đã hoàn thành."' },
    { regex: /"Error occurred"/g, replace: '"Lỗi."' },
    { regex: /"Đã gửi thư mời Google Calendar thành công"/g, replace: '"Đã gửi thư mời."' },
    { regex: /"Đã đồng bộ Google Calendar"/g, replace: '"Đã đồng bộ lịch."' },
    
    // For single quotes
    { regex: /'Thêm khách hàng thành công!?'/g, replace: "'Đã tạo khách hàng mới.'" },
    { regex: /'Lưu thành công!?'/g, replace: "'Đã lưu thay đổi.'" },
    { regex: /'Đã lưu thành công!?'/g, replace: "'Đã lưu thay đổi.'" },
    { regex: /'Cập nhật thành công!?'/g, replace: "'Đã cập nhật.'" },
    { regex: /'Đã cập nhật thành công!?'/g, replace: "'Đã cập nhật.'" },
    { regex: /'Thêm thành công!?'/g, replace: "'Đã thêm dữ liệu.'" },
    { regex: /'Xóa thành công!?'/g, replace: "'Đã xóa dữ liệu.'" },
    { regex: /'Đã xóa thành công!?'/g, replace: "'Đã xóa dữ liệu.'" },
    { regex: /'Tạo thành công!?'/g, replace: "'Đã tạo.'" },
    { regex: /'Hoàn thành công việc thành công!?'/g, replace: "'Đã hoàn thành công việc.'" },
    { regex: /'Lỗi hệ thống/g, replace: "'Lỗi" },
    { regex: /'Lỗi xảy ra/g, replace: "'Lỗi" },
    { regex: /'Lỗi khi/g, replace: "'Không thể" },
    { regex: /'Thêm việc cần làm thành công!?'/g, replace: "'Đã thêm công việc.'" },
    { regex: /'Đã thêm việc cần làm thành công!?'/g, replace: "'Đã thêm công việc.'" },
    { regex: /'Import thành công!?'/g, replace: "'Đã nhập dữ liệu.'" },
    { regex: /'Đã lưu ghi chú thành công!?'/g, replace: "'Đã lưu ghi chú.'" },
    { regex: /'Lưu ghi chú thành công!?'/g, replace: "'Đã lưu ghi chú.'" },
    { regex: /'Đã copy mẫu gửi khách thành công!?'/g, replace: "'Đã copy mẫu gửi khách.'" },
    { regex: /'Success!'/g, replace: "'Đã hoàn tất.'" },
    { regex: /'Completed successfully'/g, replace: "'Đã hoàn thành.'" },
    { regex: /'Error occurred'/g, replace: "'Lỗi.'" },
    { regex: /'Đã gửi thư mời Google Calendar thành công'/g, replace: "'Đã gửi thư mời.'" },
    { regex: /'Đã đồng bộ Google Calendar'/g, replace: "'Đã đồng bộ lịch.'" }
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    replacements.forEach(r => {
        content = content.replace(r.regex, r.replace);
    });
    
    if (content !== original) {
        fs.writeFileSync(f, content);
        modifiedCount++;
    }
});

console.log('Modified files safely:', modifiedCount);
