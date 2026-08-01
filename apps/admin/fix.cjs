const fs = require('fs');
let c = fs.readFileSync('src/Admin/NhanVien/QuanLyChucVu.vue', 'utf8');
const replacements = [
  ['  ', '──'],
  ['L i', 'Lỗi'],
  ['li!u', 'liệu'],
  ['thỒ', 'thể'],
  ['h! th ng', 'hệ thống'],
  ['M:i', 'Mới'],
  ['l!', 'lệ'],
  ['mu n', 'muốn'],
  [' ang', 'đang'],
  [' ã', 'đã'],
  [' ược', 'được'],
  [' 9nh', 'định'],
  [' "ng', 'động'],
  ['Đ"ng', 'Động'],
  ['T"ng', 'Tổng'],
  ['d9ch', 'dịch'],
  [' ặt', 'đặt'],
  ['l9ch', 'lịch'],
  ['L9ch', 'Lịch'],
  ['n"i b"', 'nội bộ'],
  ['Ch0nh', 'Chỉnh'],
  ['HiỒn th9', 'Hiển thị'],
  ['Trư:c', 'Trước'],
  [' Ồ', 'để'],
  ['ĐỒ', 'Để'],
  ['tr ng', 'trống'],
  [' "i', 'đổi'],
  ['Vi!c', 'Việc'],
  ['xx', '🟢'],
  ['x  Khóa', '🔴 Khóa'],
  ['x  ĐỒ', '💡 ĐỒ'],
  ['Đ Ồ', 'Để']
];
for (const [k, v] of replacements) {
  c = c.split(k).join(v);
}
fs.writeFileSync('src/Admin/NhanVien/QuanLyChucVu.vue', c, 'utf8');
console.log('Fix script complete');
