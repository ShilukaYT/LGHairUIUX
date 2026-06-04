<script setup>
import { ref, onMounted } from 'vue';
import Tesseract from 'tesseract.js';
import ThongKeNhanVienModal from './ThongKeNhanVienModal.vue';

const nhanViens = ref([]);
const loading = ref(false);

const roles = ref([]);
const loaiNvs = ref([]);

const showModal = ref(false);
const isEditMode = ref(false);
const showThongKeModal = ref(false);
const formData = ref({
  maNv: '', hoTenNv: '', maRole: '', maLoaiNv: '', 
  gioiTinh: 'Nam', cccd: '', namSinh: '', sdt: '', 
  email: '', diaChi: '', ngayVaoLam: '', 
  trangThai: 1, tenDangNhap: '', matKhau: ''
});

const selectedImageFile = ref(null);
const imagePreviewUrl = ref(null); 
const errors = ref({});

const searchQuery = ref('');
const filterTrangThai = ref(''); 
const filterGioiTinh = ref('');  

const showReviewModal = ref(false);
const reviewsList = ref([]);
const loadingReviews = ref(false);
const selectedNvName = ref('');

const showScanner = ref(false);
const isScanning = ref(false);
const scanProgress = ref('');

// --- HÀM TẢI OPTION ĐÃ ĐƯỢC CHỐNG LỖI ---
const fetchOptions = async () => {
  try {
    const resRole = await fetch('https://localhost:7196/api/NhanVien/roles');
    if (resRole.ok) {
        roles.value = await resRole.json();
    } else {
        console.error("Lỗi API tải Roles:", await resRole.text());
    }
  } catch(e) { console.error("Mất kết nối khi tải Roles: ", e); }

  try {
    const resLoai = await fetch('https://localhost:7196/api/NhanVien/loai-nv');
    if (resLoai.ok) {
        loaiNvs.value = await resLoai.json();
    } else {
        console.error("Lỗi API tải Loại NV:", await resLoai.text());
    }
  } catch(e) { console.error("Mất kết nối khi tải Loại NV: ", e); }
};
// ----------------------------------------

const fetchNhanViens = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filterTrangThai.value !== '') params.append('trangThai', filterTrangThai.value);
    if (filterGioiTinh.value) params.append('gioiTinh', filterGioiTinh.value);

    const res = await fetch(`https://localhost:7196/api/NhanVien?${params.toString()}`);
    if (res.ok) nhanViens.value = await res.json();
  } catch (err) { console.error(err); } 
  finally { loading.value = false; }
};

const openAddForm = () => {
  isEditMode.value = false;
  formData.value = { 
      maNv: '', hoTenNv: '', maRole: '', maLoaiNv: '', 
      gioiTinh: 'Nam', cccd: '', namSinh: '', sdt: '', 
      email: '', diaChi: '', ngayVaoLam: '', 
      trangThai: 1, tenDangNhap: '', matKhau: '' 
  };
  selectedImageFile.value = null;
  imagePreviewUrl.value = null;
  errors.value = {}; 
  showModal.value = true;
};

const openEditForm = (nv) => {
  isEditMode.value = true;
  formData.value = { ...nv, matKhau: '' };
  
  if (nv.ngayVaoLam) {
      formData.value.ngayVaoLam = nv.ngayVaoLam.split('T')[0];
  }

  selectedImageFile.value = null;
  imagePreviewUrl.value = nv.hinhAnh ? `https://localhost:7196${nv.hinhAnh}` : null;
  errors.value = {}; 
  showModal.value = true;
};

const closeModal = () => { showModal.value = false; };

const openScannerModal = () => {
  showScanner.value = true;
  isScanning.value = false;
  scanProgress.value = '';
};

const closeScannerModal = () => { showScanner.value = false; };

const toTitleCase = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const processIdCardImage = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isScanning.value = true;
  scanProgress.value = 'Đang tải AI và phân tích ảnh... (Sẽ mất 5-10s)';

  try {
    const result = await Tesseract.recognize(file, 'vie', { 
        logger: m => {
          if (m.status === 'recognizing text') scanProgress.value = `Đang đọc chữ: ${Math.round(m.progress * 100)}%`;
        }
    });

    const text = result.data.text;

    let namSinhExtracted = '';
    let gioiTinhExtracted = 'Nam';
    let hoTenExtracted = '';
    let cccdExtracted = '';

    const cccdMatch = text.match(/\b(0\d{11})\b/);
    if (cccdMatch) cccdExtracted = cccdMatch[1];

    const dobRegex = /(\d{2})\s*[\/\-\.]\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/;
    const dobMatch = text.match(dobRegex);
    if (dobMatch) namSinhExtracted = dobMatch[3]; 

    if (/\b(Nữ|Nu|N[uưứữ])\b/i.test(text)) gioiTinhExtracted = 'Nữ';

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 2);
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (lineLower.includes('tên') || lineLower.includes('name')) {
        let potentialName = lines[i].replace(/.*(?:tên|name)[\s:;\/\|]*/i, '').trim();
        if (potentialName.length < 4 && i + 1 < lines.length) potentialName = lines[i+1].trim();
        hoTenExtracted = potentialName;
        break;
      }
    }

    if (!hoTenExtracted) {
        const ignoreWords = ['CỘNG', 'HÒA', 'XÃ', 'HỘI', 'CHỦ', 'NGHĨA', 'VIỆT', 'NAM', 'ĐỘC', 'LẬP', 'TỰ', 'DO', 'HẠNH', 'PHÚC', 'CĂN', 'CƯỚC', 'CÔNG', 'DÂN'];
        for (let line of lines) {
            if (ignoreWords.some(w => line.toUpperCase().includes(w))) continue;
            if (/[0-9]/.test(line)) continue; 
            let letters = line.replace(/[^a-zA-ZÀ-Ỹà-ỹ]/g, '');
            let uppers = line.replace(/[^A-ZÀ-Ỹ]/g, '');
            if (letters.length > 5 && uppers.length / letters.length > 0.6) {
                hoTenExtracted = line; break;
            }
        }
    }

    if (hoTenExtracted) {
        hoTenExtracted = hoTenExtracted.replace(/[^a-zA-ZÀ-Ỹà-ỹ\s]/g, ' ');
        let words = hoTenExtracted.split(/\s+/).filter(w => w.length > 0);
        if (words.length > 0 && /^(sm|so|s|no|n|số)$/i.test(words[0])) words.shift();
        hoTenExtracted = toTitleCase(words.join(' '));
    }

    scanProgress.value = 'Đọc thành công! Đang tự động điền...';
    
    setTimeout(() => {
      closeScannerModal();
      openAddForm();
      
      if (hoTenExtracted) formData.value.hoTenNv = hoTenExtracted;
      if (namSinhExtracted) formData.value.namSinh = namSinhExtracted;
      if (cccdExtracted) formData.value.cccd = cccdExtracted;
      formData.value.gioiTinh = gioiTinhExtracted;
      
    }, 800);

  } catch (err) {
    console.error(err);
    scanProgress.value = 'Lỗi khi đọc ảnh. Vui lòng thử lại!';
  } finally {
    setTimeout(() => { isScanning.value = false; }, 2000);
  }
};

const openReviewModal = async (nv) => {
  selectedNvName.value = nv.hoTenNv;
  reviewsList.value = [];
  showReviewModal.value = true;
  loadingReviews.value = true;
  try {
    const res = await fetch(`https://localhost:7196/api/NhanVien/${nv.maNv}/danh-gia`);
    if (res.ok) reviewsList.value = await res.json();
    else alert("Lỗi tải đánh giá!");
  } catch (err) { console.error(err); } 
  finally { loadingReviews.value = false; }
};

const closeReviewModal = () => { showReviewModal.value = false; };

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    selectedImageFile.value = file;
    imagePreviewUrl.value = URL.createObjectURL(file); 
  }
};

const validateForm = () => {
  errors.value = {}; 
  let isValid = true;

  if (!formData.value.maNv?.trim()) { errors.value.maNv = 'Bắt buộc nhập.'; isValid = false; }
  if (!formData.value.hoTenNv?.trim()) { errors.value.hoTenNv = 'Bắt buộc nhập.'; isValid = false; }
  
  if (formData.value.cccd?.trim() && !/^\d{12}$/.test(formData.value.cccd)) {
    errors.value.cccd = 'CCCD phải đủ 12 chữ số.'; isValid = false;
  }

  const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!formData.value.sdt?.trim()) { 
    errors.value.sdt = 'Bắt buộc nhập SĐT.'; isValid = false; 
  } else if (!phoneRegex.test(formData.value.sdt)) {
    errors.value.sdt = 'SĐT phải là 10 số, bắt đầu bằng 0.'; isValid = false;
  }

  if (formData.value.namSinh) {
    const currentYear = new Date().getFullYear();
    const birthYear = parseInt(formData.value.namSinh);
    if (birthYear < currentYear - 70 || birthYear > currentYear - 15) {
      errors.value.namSinh = `Năm sinh phải từ ${currentYear - 70} đến ${currentYear - 15}.`; isValid = false;
    }
  }
  
  if (formData.value.tenDangNhap && /\s/.test(formData.value.tenDangNhap)) {
    errors.value.tenDangNhap = 'Không chứa khoảng trắng.'; isValid = false;
  }
  if (!isEditMode.value && formData.value.tenDangNhap && !formData.value.matKhau) {
    errors.value.matKhau = 'Vui lòng cấp mật khẩu.'; isValid = false;
  }
  return isValid;
};

const saveNhanVien = async () => {
  if (!validateForm()) return; 

  const method = isEditMode.value ? 'PUT' : 'POST';
  const url = isEditMode.value ? `https://localhost:7196/api/NhanVien/${formData.value.maNv}` : 'https://localhost:7196/api/NhanVien';

  const submitData = new FormData();
  submitData.append('MaNv', formData.value.maNv || '');
  submitData.append('MaRole', formData.value.maRole || '');
  submitData.append('MaLoaiNv', formData.value.maLoaiNv || '');
  submitData.append('HoTenNv', formData.value.hoTenNv || '');
  submitData.append('GioiTinh', formData.value.gioiTinh || '');
  submitData.append('Cccd', formData.value.cccd || '');
  if (formData.value.namSinh) submitData.append('NamSinh', formData.value.namSinh);
  submitData.append('Sdt', formData.value.sdt || '');
  submitData.append('Email', formData.value.email || '');
  submitData.append('DiaChi', formData.value.diaChi || '');
  if (formData.value.ngayVaoLam) submitData.append('NgayVaoLam', formData.value.ngayVaoLam);
  
  submitData.append('TrangThai', formData.value.trangThai);
  submitData.append('TenDangNhap', formData.value.tenDangNhap || '');
  submitData.append('MatKhau', formData.value.matKhau || '');
  if (selectedImageFile.value) submitData.append('HinhAnhFile', selectedImageFile.value);

  try {
    const res = await fetch(url, { method: method, body: submitData });
    if (res.ok) {
      alert(isEditMode.value ? "Cập nhật thành công!" : "Thêm thành công!");
      closeModal(); fetchNhanViens(); 
    } else { alert("Lỗi từ máy chủ: " + await res.text()); }
  } catch (err) { alert("Không thể kết nối đến máy chủ."); }
};

const deleteNhanVien = async (id) => {
  if (!confirm(`Xóa nhân viên ${id}?`)) return;
  try {
    const res = await fetch(`https://localhost:7196/api/NhanVien/${id}`, { method: 'DELETE' });
    if (res.ok) fetchNhanViens(); else alert("Lỗi: " + await res.text());
  } catch (err) {}
};

const formatDate = (dateString) => {
  if(!dateString) return '';
  return new Date(dateString).toLocaleDateString('vi-VN');
};

onMounted(() => {
  fetchOptions();
  fetchNhanViens();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="flex justify-between items-center mb-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Quản lý Nhân Viên</h1>
        <p class="text-gray-500 text-sm mt-1">Quản lý hồ sơ và tài khoản nội bộ</p>
      </div>
      
      <div class="flex gap-3">
        <button @click="showThongKeModal = true" class="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 text-sm font-bold rounded-md hover:bg-indigo-600 hover:text-white transition shadow-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20v-6M6 20V10M18 20V4"/></svg>
          Bảng xếp hạng
        </button>
        <button @click="openScannerModal" class="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 shadow-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
            <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          </svg>
          Quét CCCD (Ảnh)
        </button>
        
        <button @click="openAddForm" class="px-4 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 shadow-sm">
          + Thêm thủ công
        </button>
      </div>
    </div>

    <div class="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end mb-6 shadow-sm">
      <div class="flex-1 min-w-[250px]">
        <label class="block text-xs font-medium text-gray-700 mb-1">Tìm kiếm nhân viên</label>
        <input type="text" v-model="searchQuery" @keyup.enter="fetchNhanViens" placeholder="Nhập tên, mã NV, SĐT, CCCD" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Trạng thái</label>
        <select v-model="filterTrangThai" @change="fetchNhanViens" class="w-40 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white">
          <option value="">Tất cả</option>
          <option value="1">Đang làm việc</option>
          <option value="0">Đã nghỉ</option>
        </select>
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Giới tính</label>
        <select v-model="filterGioiTinh" @change="fetchNhanViens" class="w-32 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white">
          <option value="">Tất cả</option>
          <option value="Nam">Nam</option>
          <option value="Nữ">Nữ</option>
        </select>
      </div>
      <button @click="fetchNhanViens" class="px-5 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition shadow-sm h-[38px]">
        Lọc Dữ Liệu
      </button>
    </div>

    <div class="bg-white rounded-lg border border-gray-200 shadow-sm">
      <div v-if="loading" class="p-8 text-center text-gray-500">Đang tải...</div>
      
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="bg-gray-50 text-gray-600 border-b">
            <tr>
              <th class="px-6 py-3 font-semibold">Nhân viên</th>
              <th class="px-6 py-3 font-semibold">Nội bộ & Tài khoản</th>
              <th class="px-6 py-3 font-semibold">Liên hệ & Định danh</th>
              <th class="px-6 py-3 font-semibold">Trạng thái</th>
              <th class="px-6 py-3 font-semibold text-right">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="nv in nhanViens" :key="nv.maNv" class="hover:bg-gray-50/50">
              <td class="px-6 py-4 flex items-center gap-3">
                <img v-if="nv.hinhAnh" :src="`https://localhost:7196${nv.hinhAnh}`" class="w-10 h-10 rounded-full object-cover border border-gray-200" />
                <div v-else class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 font-bold">
                  {{ nv.hoTenNv?.charAt(0) || '?' }}
                </div>
                <div>
                  <div class="font-medium text-gray-900">{{ nv.hoTenNv }} ({{ nv.maNv }})</div>
                  <div class="text-xs text-blue-600 font-semibold mt-0.5">{{ nv.tenChucVu }}</div>
                </div>
              </td>
              <td class="px-6 py-4 text-gray-600">
                <div class="font-medium">{{ nv.tenDangNhap || '-- Chưa cấp TK --' }}</div>
                <div class="text-xs text-gray-400 mt-0.5" v-if="nv.ngayVaoLam">
                  Ngày làm: {{ formatDate(nv.ngayVaoLam) }}
                </div>
              </td>
              <td class="px-6 py-4 text-gray-600">
                <div class="font-medium text-gray-900">{{ nv.sdt }}</div>
                <div class="text-xs text-gray-500 mt-0.5" v-if="nv.cccd">CCCD: {{ nv.cccd }} - SN: {{ nv.namSinh }}</div>
                <div class="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]" :title="nv.diaChi" v-if="nv.diaChi">{{ nv.diaChi }}</div>
              </td>
              <td class="px-6 py-4">
                <span v-if="nv.trangThai === 1" class="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">Đang làm việc</span>
                <span v-else class="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">Đã nghỉ</span>
              </td>
              <td class="px-6 py-4 text-right space-x-3">
                <button @click="openReviewModal(nv)" class="text-amber-600 font-medium text-sm hover:underline">Đánh giá</button>
                <button @click="openEditForm(nv)" class="text-blue-600 font-medium text-sm hover:underline">Sửa</button>
                <button @click="deleteNhanVien(nv.maNv)" class="text-red-600 font-medium text-sm hover:underline">Xóa</button>
              </td>
            </tr>
            <tr v-if="nhanViens.length === 0">
              <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                Không có dữ liệu.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="showScanner" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
      <div class="bg-white w-full max-w-md rounded-xl shadow-xl overflow-hidden flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <h3 class="text-lg font-bold text-gray-900">Quét thông tin CCCD</h3>
          <button @click="closeScannerModal" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <div class="p-6 flex flex-col items-center">
          <p class="text-sm text-gray-500 text-center mb-4">Tải lên hoặc chụp ảnh mặt trước thẻ CCCD để hệ thống tự động trích xuất thông tin.</p>
          <p class="text-xs text-red-500 font-bold mb-6 text-center">⚠️ QUAN TRỌNG: Hãy đảm bảo ảnh chụp CCCD NẰM NGANG (chữ đọc từ trái qua phải).</p>
          
          <label class="cursor-pointer px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 shadow-md flex items-center gap-2 mb-4 w-full justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
              <path d="M15 12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h1.172a3 3 0 0 0 2.12-.879l.83-.828A1 1 0 0 1 6.827 3h2.344a1 1 0 0 1 .707.293l.828.828A3 3 0 0 0 12.828 5H14a1 1 0 0 1 1 1v6zM2 4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1.172a2 2 0 0 1-1.414-.586l-.828-.828A2 2 0 0 0 9.172 2H6.828a2 2 0 0 0-1.414.586l-.828.828A2 2 0 0 1 3.172 4H2z"/>
              <path d="M8 11a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5zm0 1a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            </svg>
            Chọn ảnh / Chụp ảnh CCCD
            <input type="file" accept="image/*" @change="processIdCardImage" class="hidden">
          </label>

          <div v-if="isScanning" class="w-full text-center mt-2">
             <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
             <p class="text-sm font-medium text-blue-600">{{ scanProgress }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white w-full max-w-4xl rounded-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-white z-10">
          <h3 class="text-lg font-bold text-gray-900">{{ isEditMode ? 'Sửa thông tin NV' : 'Thêm Nhân Viên Mới' }}</h3>
          <button @click="closeModal" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>
        
        <form @submit.prevent="saveNhanVien" class="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-8">
          <div class="w-full md:w-1/4 flex flex-col items-center space-y-3">
            <div class="w-36 h-36 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
               <img v-if="imagePreviewUrl" :src="imagePreviewUrl" class="w-full h-full object-cover" />
               <span v-else class="text-gray-400 text-xs text-center p-2">Chưa có<br>ảnh</span>
            </div>
            <label class="cursor-pointer bg-white border border-gray-300 px-4 py-2 rounded-md text-xs font-medium hover:bg-gray-50 shadow-sm">
              Chọn ảnh
              <input type="file" class="hidden" accept="image/*" @change="handleImageUpload">
            </label>
          </div>

          <div class="w-full md:w-3/4 space-y-5">
            <div>
              <h4 class="text-sm font-bold text-gray-800 border-b pb-2 mb-3">Thông Tin Cá Nhân</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="sm:col-span-2">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Họ Tên *</label>
                  <input v-model="formData.hoTenNv" type="text" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.hoTenNv ? 'border-red-500' : 'border-gray-300']" placeholder="Tên đầy đủ">
                  <p v-if="errors.hoTenNv" class="text-red-500 text-xs mt-1">{{ errors.hoTenNv }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Giới tính</label>
                  <select v-model="formData.gioiTinh" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Năm sinh *</label>
                  <input v-model="formData.namSinh" type="number" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.namSinh ? 'border-red-500' : 'border-gray-300']" placeholder="VD: 1995">
                  <p v-if="errors.namSinh" class="text-red-500 text-xs mt-1">{{ errors.namSinh }}</p>
                </div>
                <div class="sm:col-span-2">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Số CCCD</label>
                  <input v-model="formData.cccd" type="text" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.cccd ? 'border-red-500' : 'border-gray-300']" placeholder="12 chữ số">
                  <p v-if="errors.cccd" class="text-red-500 text-xs mt-1">{{ errors.cccd }}</p>
                </div>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">SĐT *</label>
                  <input v-model="formData.sdt" type="text" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.sdt ? 'border-red-500' : 'border-gray-300']" placeholder="09xxxxxxx">
                  <p v-if="errors.sdt" class="text-red-500 text-xs mt-1">{{ errors.sdt }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input v-model="formData.email" type="email" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="email@gmail.com">
                </div>
              </div>

              <div class="mt-4">
                <label class="block text-xs font-medium text-gray-700 mb-1">Địa chỉ</label>
                <input v-model="formData.diaChi" type="text" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="Số nhà, Tỉnh thành...">
              </div>
            </div>

            <div>
              <h4 class="text-sm font-bold text-gray-800 border-b pb-2 mb-3 mt-2">Thông Tin Công Việc</h4>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div v-if="!isEditMode">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Mã NV *</label>
                  <input v-model="formData.maNv" type="text" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.maNv ? 'border-red-500' : 'border-gray-300']" placeholder="NV001">
                  <p v-if="errors.maNv" class="text-red-500 text-xs mt-1">{{ errors.maNv }}</p>
                </div>
                
                <div :class="isEditMode ? 'sm:col-span-1' : ''">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Chức vụ</label>
                  <select v-model="formData.maRole" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">-- Chọn chức vụ --</option>
                    <option v-for="r in roles" :key="r.maRole || r.MaRole" :value="r.maRole || r.MaRole">{{ r.tenChucVu || r.TenChucVu }}</option>
                  </select>
                </div>
                
                <div :class="isEditMode ? 'sm:col-span-1' : ''">
                  <label class="block text-xs font-medium text-gray-700 mb-1">Phân loại NV</label>
                  <select v-model="formData.maLoaiNv" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option value="">-- Chọn loại --</option>
                    <option v-for="l in loaiNvs" :key="l.maLoaiNv || l.MaLoaiNv" :value="l.maLoaiNv || l.MaLoaiNv">{{ l.tenLoai || l.TenLoai }}</option>
                  </select>
                </div>
                </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Ngày vào làm</label>
                  <input v-model="formData.ngayVaoLam" type="date" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Trạng thái</label>
                  <select v-model="formData.trangThai" class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
                    <option :value="1">Đang làm việc</option>
                    <option :value="0">Đã nghỉ</option>
                  </select>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 p-4 rounded-md border border-gray-200 mt-4">
              <p class="text-xs font-semibold text-gray-500 uppercase mb-3 tracking-wider">Tài khoản Đăng nhập</p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Tên đăng nhập</label>
                  <input v-model="formData.tenDangNhap" type="text" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.tenDangNhap ? 'border-red-500' : 'border-gray-300']" placeholder="Tên đăng nhập">
                  <p v-if="errors.tenDangNhap" class="text-red-500 text-xs mt-1">{{ errors.tenDangNhap }}</p>
                </div>
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Mật khẩu</label>
                  <input v-model="formData.matKhau" type="password" :class="['w-full border rounded-md px-3 py-2 text-sm', errors.matKhau ? 'border-red-500' : 'border-gray-300']" :placeholder="isEditMode ? '(Giữ nguyên)' : 'Nhập mật khẩu'">
                  <p v-if="errors.matKhau" class="text-red-500 text-xs mt-1">{{ errors.matKhau }}</p>
                </div>
              </div>
            </div>

            <div class="pt-4 flex justify-end space-x-3 border-t mt-6">
              <button type="button" @click="closeModal" class="px-5 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">Hủy</button>
              <button type="submit" class="px-5 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800">Lưu dữ liệu</button>
            </div>
            
          </div>
        </form>
      </div>
    </div>

    <div v-if="showReviewModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div class="bg-white w-full max-w-lg rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
        <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
          <div>
            <h3 class="text-lg font-bold text-gray-900">Đánh giá khách hàng</h3>
            <p class="text-sm text-gray-500">Nhân viên: <span class="font-medium text-black">{{ selectedNvName }}</span></p>
          </div>
          <button @click="closeReviewModal" class="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
        </div>

        <div class="p-6 overflow-y-auto flex-1 bg-white">
          <div v-if="loadingReviews" class="text-center text-gray-500 py-10">Đang tải đánh giá...</div>
          <div v-else-if="reviewsList.length === 0" class="text-center text-gray-500 py-10">Nhân viên này chưa có đánh giá nào.</div>
          <div v-else class="space-y-4">
            <div v-for="(review, index) in reviewsList" :key="index" class="p-4 border border-gray-100 rounded-lg bg-gray-50 shadow-sm">
              <div class="flex items-center gap-1 mb-2">
                <span class="text-yellow-400 text-lg">★</span>
                <span class="font-medium text-gray-800">{{ review.diem || review.soSao || 5 }} / 5</span>
              </div>
              <p class="text-gray-700 text-sm italic">"{{ review.noiDung || review.binhLuan || 'Không có bình luận...' }}"</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ThongKeNhanVienModal :isOpen="showThongKeModal" @close="showThongKeModal = false" />
</template>
