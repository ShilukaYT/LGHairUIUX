const fs = require('fs');
let c = fs.readFileSync('src/Admin/NhanVien/QuanLyChucVu.vue', 'utf8');

const regexes = [
  [/Quá..n LÃ½/g, 'Quản Lý'],
  [/Chá..c Vá../g, 'Chức Vụ'],
  [/LÆ.Æ.ng CÆ. Bá..n/g, 'Lương Cơ Bản'],
  [/Thiá..t lá..p/g, 'Thiết lập'],
  [/đ..9nh mức/g, 'định mức'],
  [/h..! th..ng/g, 'hệ thống'],
  [/T.\"ng Chức Vụ/g, 'Tổng Chức Vụ'],
  [/Đang Hoạt Đ.\"ng/g, 'Đang Hoạt Động'],
  [/T.\"ng Nhân Sự/g, 'Tổng Nhân Sự'],
  [/Thợ d.9ch vụ \(Được .ặt l.9ch\)/g, 'Thợ dịch vụ (Được đặt lịch)'],
  [/Nhân viên n.\"i b.\"/g, 'Nhân viên nội bộ'],
  [/Hoạt .\"ng/g, 'Hoạt động'],
  [/Ch.nh sửa/g, 'Chỉnh sửa'],
  [/Hi.n th.9/g, 'Hiển thị'],
  [/Trư..c/g, 'Trước'],
  [/. Ồ tránh/g, 'để tránh'],
  [/💡 Đ. tr.ng nếu mu.n h.. th.ng tự .\"ng/g, '💡 Để trống nếu muốn hệ thống tự động'],
  [/đ.nh danh duy nhất không th. thay .\"i/g, 'định danh duy nhất không thể thay đổi'],
  [/Mô Tả Công Vi..c/g, 'Mô Tả Công Việc'],
  [/Được .ặt l.9ch/g, 'Được đặt lịch'],
  [/Được Đặt L.9ch/g, 'Được Đặt Lịch'],
  [/🟢 Hoạt .\"ng/g, '🟢 Hoạt động'],
  [/🔴 Khóa \/ Tạm dừng/g, '🔴 Khóa / Tạm dừng']
];

for (const [r, v] of regexes) {
  c = c.replace(r, v);
}
fs.writeFileSync('src/Admin/NhanVien/QuanLyChucVu.vue', c, 'utf8');
console.log('Fixed regex');
