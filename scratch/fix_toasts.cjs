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

const replacements = [
    { regex: /Thêm khách hàng thành công!?/gi, replace: 'Đã tạo khách hàng mới.' },
    { regex: /Lưu thành công!?/gi, replace: 'Đã lưu thay đổi.' },
    { regex: /Đã lưu thành công!?/gi, replace: 'Đã lưu thay đổi.' },
    { regex: /Cập nhật thành công!?/gi, replace: 'Đã cập nhật.' },
    { regex: /Đã cập nhật thành công!?/gi, replace: 'Đã cập nhật.' },
    { regex: /Thêm thành công!?/gi, replace: 'Đã thêm dữ liệu.' },
    { regex: /Xóa thành công!?/gi, replace: 'Đã xóa dữ liệu.' },
    { regex: /Đã xóa thành công!?/gi, replace: 'Đã xóa dữ liệu.' },
    { regex: /Tạo thành công!?/gi, replace: 'Đã tạo.' },
    { regex: /Hoàn thành công việc thành công!?/gi, replace: 'Đã hoàn thành công việc.' },
    { regex: /Lỗi hệ thống/gi, replace: 'Lỗi' },
    { regex: /Lỗi xảy ra/gi, replace: 'Lỗi' },
    { regex: /Lỗi khi/gi, replace: 'Không thể' },
    { regex: /Thêm việc cần làm thành công!?/gi, replace: 'Đã thêm công việc.' },
    { regex: /Đã thêm việc cần làm thành công!?/gi, replace: 'Đã thêm công việc.' },
    { regex: /Import hoàn tất![^\"']*/gi, replace: 'Đã nhập dữ liệu xong.' },
    { regex: /Import thành công!?/gi, replace: 'Đã nhập dữ liệu.' },
    { regex: /Đã lưu ghi chú thành công!?/gi, replace: 'Đã lưu ghi chú.' },
    { regex: /Lưu ghi chú thành công!?/gi, replace: 'Đã lưu ghi chú.' },
    { regex: /Đã copy mẫu gửi khách thành công!?/gi, replace: 'Đã copy mẫu gửi khách.' },
    { regex: /Success!/g, replace: 'Đã hoàn tất.' },
    { regex: /Completed successfully/g, replace: 'Đã hoàn thành.' },
    { regex: /Error occurred/g, replace: 'Lỗi.' },
    { regex: /Đã gửi thư mời Google Calendar thành công/gi, replace: 'Đã gửi thư mời.' },
    { regex: /Đã lên lịch Follow-up sau/gi, replace: 'Đã hẹn lại sau' },
    { regex: /Đã đồng bộ Google Calendar/gi, replace: 'Đã đồng bộ lịch.' },
];

files.forEach(f => {
    let content = fs.readFileSync(f, 'utf8');
    let original = content;
    
    replacements.forEach(r => {
        content = content.replace(r.regex, r.replace);
    });
    
    // Also strip out exclamation marks in toast calls
    content = content.replace(/(toast\.(success|error|warning|info)\(.*?)!/g, '$1');
    content = content.replace(/(toast\.(success|error|warning|info)\(.*?)!/g, '$1'); // sometimes double !!
    
    if (content !== original) {
        fs.writeFileSync(f, content);
        modifiedCount++;
    }
});

console.log('Modified files:', modifiedCount);
