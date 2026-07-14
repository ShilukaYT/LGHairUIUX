<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import Tesseract from 'tesseract.js';
import { Html5Qrcode } from 'html5-qrcode';
import ThongKeNhanVienModal from './ThongKeNhanVienModal.vue';
import { Search, Plus, Edit3, Trash2, X, Award, Camera, Users, Phone, Mail, MapPin, Calendar, Eye } from 'lucide-vue-next';
import { logActivity } from '@/utils/activityLogger';

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
const activeScanTab = ref('camera');
const cameraScanner = ref(null);
const isCameraLoading = ref(false);
const cameraError = ref('');

// ── Phân trang (Pagination) ──
const currentPage = ref(1);
const perPage = ref(10); // 10 nhân viên trên mỗi trang

// Reset trang về 1 khi đổi bộ lọc hoặc tìm kiếm
watch([searchQuery, filterTrangThai, filterGioiTinh], () => {
    currentPage.value = 1;
});

const pagedNhanViens = computed(() => {
    const start = (currentPage.value - 1) * perPage.value;
    return nhanViens.value.slice(start, start + perPage.value);
});

const totalPages = computed(() => {
    return Math.ceil(nhanViens.value.length / perPage.value);
});

const visiblePages = computed(() => {
    const pages = [];
    const total = totalPages.value;
    const current = currentPage.value;
    
    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);
    
    if (end - start + 1 < 5) {
        if (start === 1) {
            end = Math.min(total, start + 4);
        } else if (end === total) {
            start = Math.max(1, end - 4);
        }
    }
    
    for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= total) {
            pages.push(i);
        }
    }
    return pages;
});

const changePage = (p) => {
    if (p >= 1 && p <= totalPages.value) {
        currentPage.value = p;
    }
};

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

const toTitleCase = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const vnLettersPattern = 'a-zA-ZáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđĐÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÉÈẺẼẸÊẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÚÙỦŨỤƯỨỪỬỮỰÝỲỶỸỴ';
const vnLettersRegex = new RegExp(`^[${vnLettersPattern}\\d\\s,.\\-\\/()\\'\\"’“”:]*$`);

const isUppercaseWord = (word) => {
  const hasLetter = new RegExp(`[${vnLettersPattern}]`).test(word);
  const isUpper = word === word.toUpperCase();
  return hasLetter && isUpper;
};

const cleanNameLine = (line) => {
  const words = line.split(/\s+/);
  const upperWords = words.filter(isUppercaseWord);
  return upperWords.join(' ');
};

const cleanAddressLine = (line) => {
  if (!line) return '';
  // Loại bỏ nhiễu dấu chấm liên tiếp nếu có (Ví dụ: "Thôn 2... “7v" -> "Thôn 2")
  let cleaned = line.normalize('NFC').split('..')[0];

  const leadingNoiseRegex = /^(?:\d{5,}\b|\d+[\s\d)]*[)]\s*|\d+\s+\d+\s*)/;
  cleaned = cleaned.replace(leadingNoiseRegex, '');
  
  const cleanRegexStart = new RegExp(`^[^${vnLettersPattern}\\d]*`);
  const cleanRegexEnd = new RegExp(`[^${vnLettersPattern}\\d]*$`);
  
  return cleaned
    .replace(cleanRegexStart, '') 
    .replace(cleanRegexEnd, '') 
    .trim();
};

const isValidAddressLine = (line) => {
  if (!line) return false;
  const normalizedRaw = line.normalize('NFC');
  const cleanedLine = cleanAddressLine(normalizedRaw);
  if (!vnLettersRegex.test(cleanedLine)) return false;
  if (/\/\//.test(cleanedLine) || /\\\\/.test(cleanedLine) || /[|%~*_\u2044#@$^+=\[\]{}]/.test(cleanedLine)) return false;

  const cleaned = cleanedLine.replace(/[\s,.\-\/]/g, '');
  if (cleaned.length === 0) return false;
  
  const letterCount = (cleaned.match(new RegExp(`[${vnLettersPattern}]`, 'g')) || []).length;
  const ratio = letterCount / cleaned.length;
  
  if (ratio < 0.6) return false;
  if (/\d{4,}/.test(cleanedLine)) return false; 
  
  const lower = cleanedLine.toLowerCase();
  if (lower.includes('có giá trị đến') || lower.includes('date of expiry') || lower.includes('ngày cấp') || lower.includes('date of issue') || lower.includes('quốc tịch') || lower.includes('nationality')) return false;
  
  return true;
};

const cleanAddressTypos = (address) => {
  return address
    .replace(/\b(?:Tnon|Thộn|Thỏn|Trỏn|Tnon\d+)\b/gi, 'Thôn')
    .replace(/\b(?:dứi|dúi|dửi)\b/gi, 'Jút')
    .replace(/\b(?:Dắk|Dăk|Dak)\b/gi, 'Đắk')
    .replace(/\bNông—\b/gi, 'Nông')
    .trim();
};

const isAddressLabel = (line) => {
  if (!line) return false;
  const lower = line.toLowerCase().normalize('NFC');
  const hasIndicator = 
    lower.includes('trú') || 
    lower.includes('tru') || 
    lower.includes('resid') || 
    lower.includes('resen') || 
    lower.includes('resld') ||
    lower.includes('thường') || 
    lower.includes('thuong') || 
    lower.includes('thưòng');
    
  const isOtherField = 
    lower.includes('quê') || 
    lower.includes('que') || 
    lower.includes('origin') || 
    lower.includes('quốc') || 
    lower.includes('quoc') || 
    lower.includes('nation') || 
    lower.includes('name') || 
    lower.includes('tên') || 
    lower.includes('ten') || 
    lower.includes('birth') || 
    lower.includes('sinh') || 
    lower.includes('sex') || 
    lower.includes('tính') || 
    lower.includes('tinh');
    
  return hasIndicator && !isOtherField;
};

// --- LIVE CAMERA SCANNER CONTROLLERS ---
const stopCameraScanner = async () => {
  if (cameraScanner.value && cameraScanner.value.isScanning) {
    try {
      await cameraScanner.value.stop();
      cameraScanner.value.clear();
      cameraScanner.value = null;
    } catch (err) {
      console.error("Lỗi khi dừng camera:", err);
    }
  }
};

const startCameraScanner = async () => {
  await stopCameraScanner();
  isCameraLoading.value = true;
  cameraError.value = '';
  
  setTimeout(async () => {
    try {
      const container = document.getElementById("camera-scanner-view");
      if (!container) {
        isCameraLoading.value = false;
        return;
      }
      
      cameraScanner.value = new Html5Qrcode("camera-scanner-view");
      
      // Ưu tiên chất lượng HD và camera sau (non-mandatory bằng cách dùng "ideal")
      const cameraConfig = {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      };

      const scannerConfig = {
        fps: 20, 
        qrbox: (width, height) => {
          const size = Math.min(width, height) * 0.75;
          return { width: size, height: size };
        },
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      };
      
      const onScanSuccess = async (decodedText) => {
        console.log("CCCD QR Decoded:", decodedText);
        try {
          const parts = decodedText.split('|');
          if (parts.length >= 5) {
            const cccd = parts[0] ? parts[0].trim() : '';
            const name = parts[2] ? toTitleCase(parts[2].trim()) : '';
            
            let namSinh = '';
            if (parts[3] && parts[3].length === 8) {
              namSinh = parts[3].substring(4, 8);
            }
            
            const gioiTinh = parts[4] ? parts[4].trim() : 'Nam';
            const address = parts[5] ? cleanAddressTypos(parts[5].trim()) : '';
            
            await stopCameraScanner();
            closeScannerModal();
            
            openAddForm();
            if (name) formData.value.hoTenNv = name;
            if (namSinh) formData.value.namSinh = namSinh;
            if (cccd) formData.value.cccd = cccd;
            if (address) formData.value.diaChi = address;
            formData.value.gioiTinh = gioiTinh;
          }
        } catch (err) {
          console.error("Lỗi khi xử lý thông tin mã QR:", err);
        }
      };

      try {
        await cameraScanner.value.start(
          cameraConfig,
          scannerConfig,
          onScanSuccess
        );
      } catch (startError) {
        console.warn("Khởi động camera với cấu hình HD thất bại, đang chuyển sang cấu hình mặc định (fallback)...", startError);
        // Fallback tối đa: không áp dụng bất kỳ ràng buộc độ phân giải nào và dùng camera mặc định của trình duyệt
        await cameraScanner.value.start(
          { facingMode: "user" },
          { 
            fps: 20, 
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.75;
              return { width: size, height: size };
            }
          },
          onScanSuccess
        );
      }
      
      isCameraLoading.value = false;
    } catch (err) {
      console.error("Lỗi khởi tạo camera:", err);
      cameraError.value = "Không thể khởi động camera. Vui lòng cấp quyền truy cập camera!";
      isCameraLoading.value = false;
    }
  }, 150);
};

const selectScanTab = async (tab) => {
  activeScanTab.value = tab;
  if (tab === 'camera') {
    await startCameraScanner();
  } else {
    await stopCameraScanner();
  }
};

const openScannerModal = () => {
  showScanner.value = true;
  isScanning.value = false;
  scanProgress.value = '';
  activeScanTab.value = 'file';
};

const closeScannerModal = () => {
  showScanner.value = false;
};

const processIdCardImage = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  isScanning.value = true;
  scanProgress.value = 'Đang quét mã QR từ ảnh...';

  try {
    // 1. Thử quét mã QR từ ảnh trước (Chính xác 100% cho mọi CCCD có QR)
    const html5QrCode = new Html5Qrcode("qr-reader-temp");
    try {
      const decodedText = await html5QrCode.scanFile(file, true);
      const parts = decodedText.split('|');
      if (parts.length >= 5) {
        const cccd = parts[0] ? parts[0].trim() : '';
        const name = parts[2] ? toTitleCase(parts[2].trim()) : '';
        
        let namSinh = '';
        if (parts[3] && parts[3].length === 8) {
          namSinh = parts[3].substring(4, 8);
        }
        
        const gioiTinh = parts[4] ? parts[4].trim() : 'Nam';
        const address = parts[5] ? cleanAddressTypos(parts[5].trim()) : '';
        
        scanProgress.value = 'Đọc mã QR thành công! Đang tự động điền...';
        setTimeout(() => {
          closeScannerModal();
          openAddForm();
          if (name) formData.value.hoTenNv = name;
          if (namSinh) formData.value.namSinh = namSinh;
          if (cccd) formData.value.cccd = cccd;
          if (address) formData.value.diaChi = address;
          formData.value.gioiTinh = gioiTinh;
        }, 800);
        return;
      }
    } catch (qrError) {
      console.log('Không tìm thấy hoặc không đọc được mã QR từ ảnh, chuyển sang quét văn bản bằng OCR...', qrError);
    }

    // 2. Fallback: Dùng Tesseract OCR nếu không quét được QR
    scanProgress.value = 'Đang phân tích văn bản ảnh bằng OCR... (Sẽ mất 5-10s)';
    const result = await Tesseract.recognize(file, 'vie', { 
        logger: m => {
          if (m.status === 'recognizing text') scanProgress.value = `Đang đọc chữ: ${Math.round(m.progress * 100)}%`;
        }
    });

    const text = result.data.text;
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    let namSinhExtracted = '';
    let gioiTinhExtracted = 'Nam';
    let hoTenExtracted = '';
    let cccdExtracted = '';
    let addressParts = [];

    // 1. Số CCCD
    const cccdMatch = text.match(/\b\d{12}\b/) || text.match(/\d{12}/);
    if (cccdMatch) cccdExtracted = cccdMatch[0];

    // 2. Ngày sinh / Năm sinh
    const dobRegex = /(\d{2})\s*[\/\-\.]\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/;
    const dobMatch = text.match(dobRegex);
    if (dobMatch) namSinhExtracted = dobMatch[3]; 

    // 3. Giới tính
    const genderMatch = text.match(/(?:giới tính|sex|gioi tinh)[\s:;\/\|]*([^\n]*)/i);
    if (genderMatch) {
      const genderText = genderMatch[1].toLowerCase();
      if (genderText.includes('nữ') || genderText.includes('female') || genderText.includes(' f ')) gioiTinhExtracted = 'Nữ';
      else if (genderText.includes('nam') || genderText.includes('male') || genderText.includes(' m ')) gioiTinhExtracted = 'Nam';
    } else {
      if (/\b(Nữ|Nu|N[uưứữ])\b/i.test(text)) gioiTinhExtracted = 'Nữ';
    }

    // 4. Họ tên và Địa chỉ
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Đọc tên
      if (line.toLowerCase().includes('họ và tên') || line.toLowerCase().includes('full name') || line.toLowerCase().includes('họ tên') || line.toLowerCase().includes('ho ten')) {
        let potentialName = line.replace(/.*(?:tên|name|tên|ten)[\s:;\/\|]*/i, '').trim();
        potentialName = cleanNameLine(potentialName);
        
        if (potentialName.length < 3 && i + 1 < lines.length) {
          potentialName = cleanNameLine(lines[i+1]);
        }
        if (potentialName) hoTenExtracted = toTitleCase(potentialName);
      }

      // Đọc địa chỉ (Nơi thường trú)
      if (isAddressLabel(line)) {
        let restOfLine = '';
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          restOfLine = line.substring(colonIndex + 1).trim();
        } else {
          restOfLine = line.replace(/.*(?:trú|residence|tru|residenee)[\s:;\/\|]*/i, '').trim();
        }
        
        const cleanedFirstLine = cleanAddressLine(restOfLine);
        if (isValidAddressLine(cleanedFirstLine)) {
          addressParts.push(cleanedFirstLine);
        }
        
        // Đọc tiếp 5 dòng dưới
        for (let j = 1; j <= 5; j++) {
          if (i + j >= lines.length) break;
          const nextLine = lines[i+j];
          const nextLower = nextLine.toLowerCase();
          
          if (nextLower.includes('có giá trị') || nextLower.includes('expiry') || nextLower.includes('ngày cấp') || nextLower.includes('quốc tịch')) {
            continue;
          }
          
          const cleanedNextLine = cleanAddressLine(nextLine);
          if (isValidAddressLine(cleanedNextLine)) {
            addressParts.push(cleanedNextLine);
          }
        }
      }
    }

    // Fallback Đọc tên nếu không tìm thấy label
    if (!hoTenExtracted) {
      const ignoreList = ['CỘNG HÒA', 'ĐỘC LẬP', 'CĂN CƯỚC', 'SOCIALIST', 'INDEPENDENCE', 'CITIZEN'];
      for (let line of lines) {
        if (ignoreList.some(w => line.toUpperCase().includes(w))) continue;
        const cleaned = cleanNameLine(line);
        if (cleaned && cleaned.split(/\s+/).length >= 2) {
          hoTenExtracted = toTitleCase(cleaned);
          break;
        }
      }
    }

    let addressExtracted = addressParts.join(', ');
    addressExtracted = cleanAddressTypos(addressExtracted);

    scanProgress.value = 'Đọc thành công! Đang tự động điền...';
    
    setTimeout(() => {
      closeScannerModal();
      openAddForm();
      
      if (hoTenExtracted) formData.value.hoTenNv = hoTenExtracted;
      if (namSinhExtracted) formData.value.namSinh = namSinhExtracted;
      if (cccdExtracted) formData.value.cccd = cccdExtracted;
      if (addressExtracted) formData.value.diaChi = addressExtracted;
      formData.value.gioiTinh = gioiTinhExtracted;
      
    }, 800);

  } catch (err) {
    console.error(err);
    scanProgress.value = 'Lỗi khi đọc ảnh. Vui lòng thử lại!';
  } finally {
    setTimeout(() => { isScanning.value = false; }, 2000);
  }
};

onUnmounted(async () => {
  await stopCameraScanner();
});

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
      logActivity(
        isEditMode.value ? "Cập nhật nhân viên" : "Thêm nhân viên mới",
        `Đã ${isEditMode.value ? 'cập nhật thông tin' : 'thêm tài khoản'} nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv})`,
        "Nhân sự"
      );
      alert(isEditMode.value ? "Cập nhật thành công!" : "Thêm thành công!");
      closeModal(); fetchNhanViens(); 
    } else { 
      logActivity(
        isEditMode.value ? "Cập nhật nhân viên" : "Thêm nhân viên mới",
        `Thất bại khi ${isEditMode.value ? 'cập nhật' : 'thêm'} nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv})`,
        "Nhân sự",
        "Thất bại"
      );
      alert("Lỗi từ máy chủ: " + await res.text()); 
    }
  } catch (err) { alert("Không thể kết nối đến máy chủ."); }
};

const deleteNhanVien = async (id) => {
  const nv = nhanViens.value.find(n => n.maNv === id);
  const name = nv ? nv.hoTenNv : id;
  if (!confirm(`Xóa nhân viên ${id}?`)) return;
  try {
    const res = await fetch(`https://localhost:7196/api/NhanVien/${id}`, { method: 'DELETE' });
    if (res.ok) {
      logActivity("Xóa nhân viên", `Đã xóa hồ sơ nhân viên ${name} (Mã: ${id})`, "Nhân sự");
      fetchNhanViens(); 
    } else { 
      const errMsg = await res.text();
      logActivity("Xóa nhân viên", `Xóa thất bại nhân viên ${name} (Mã: ${id}) - Lý do: ${errMsg}`, "Nhân sự", "Thất bại");
      alert("Lỗi: " + errMsg); 
    }
  } catch (err) {}
};

const formatDate = (dateString) => {
  if(!dateString) return '';
  return new Date(dateString).toLocaleDateString('vi-VN');
};

const formatVND = (value) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0);
};

const currentLoaiLuong = computed(() => {
  if (!formData.value.maLoaiNv) return 0;
  const loai = loaiNvs.value.find(l => (l.maLoaiNv || l.MaLoaiNv) === formData.value.maLoaiNv);
  if (loai && (loai.luong !== undefined || loai.Luong !== undefined)) {
    return loai.luong || loai.Luong || 0;
  }
  const fallbackSalaries = {
    'LNV01': 15000000,
    'LNV02': 7000000,
    'LNV03': 12000000
  };
  return fallbackSalaries[formData.value.maLoaiNv] || 0;
});

onMounted(() => {
  fetchOptions();
  fetchNhanViens();
});
</script>

<template>
  <div class="hoadon-container">
    <!-- Temporary hidden QR Code reader container -->
    <div id="qr-reader-temp" style="display: none;"></div>
    <!-- Header -->
    <div class="hd-header">
      <div class="hd-header-left">
        <div class="hd-header-icon">
          <Users class="w-6 h-6" />
        </div>
        <div>
          <h2 class="hd-header-title">Quản Lý Nhân Viên</h2>
          <p class="hd-header-subtitle">Quản lý hồ sơ, chức vụ và tài khoản đăng nhập nội bộ</p>
        </div>
      </div>
      
      <div style="display: flex; gap: 8px;">
        <button @click="showThongKeModal = true" class="hd-btn-secondary">
          <Award class="w-4 h-4" /> Bảng xếp hạng
        </button>
        <button @click="openScannerModal" class="hd-btn-secondary">
          <Camera class="w-4 h-4" /> Quét CCCD (Ảnh)
        </button>
        <button @click="openAddForm" class="hd-btn-export">
          <Plus class="w-4 h-4" /> Thêm thủ công
        </button>
      </div>
    </div>

    <!-- Filters Grid -->
    <div class="hd-filters-grid">
      <div class="hd-filter-item">
        <label class="hd-filter-label">Tìm kiếm nhân viên</label>
        <div class="hd-search-wrapper">
          <Search class="hd-search-icon" />
          <input type="text" v-model="searchQuery" @keyup.enter="fetchNhanViens" placeholder="Nhập tên, mã NV, SĐT, CCCD..." class="hd-input hd-search-input">
        </div>
      </div>
      <div class="hd-filter-item">
        <label class="hd-filter-label">Trạng thái</label>
        <div class="hd-status-wrapper" style="max-width: 100%;">
          <select v-model="filterTrangThai" @change="fetchNhanViens" class="hd-status-select select-filter">
            <option value="">Tất cả</option>
            <option value="1">Đang làm việc</option>
            <option value="0">Đã nghỉ</option>
          </select>
          <div class="hd-dropdown-arrow">
            <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
      </div>
      <div class="hd-filter-item">
        <label class="hd-filter-label">Giới tính</label>
        <div class="hd-status-wrapper" style="max-width: 100%;">
          <select v-model="filterGioiTinh" @change="fetchNhanViens" class="hd-status-select select-filter">
            <option value="">Tất cả</option>
            <option value="Nam">Nam</option>
            <option value="Nữ">Nữ</option>
          </select>
          <div class="hd-dropdown-arrow">
            <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
          </div>
        </div>
      </div>
      <div class="hd-filter-item" style="justify-content: flex-end;">
        <button @click="fetchNhanViens" class="hd-btn-export" style="height: 44px; width: 100%; justify-content: center; box-shadow: none;">
          Lọc Dữ Liệu
        </button>
      </div>
    </div>

    <!-- Table Section -->
    <div class="hd-table-wrapper">
      <div v-if="loading" style="text-align: center; padding: 48px; font-weight: 500; color: #2563eb;">Đang đồng bộ nạp danh sách nhân viên hệ thống...</div>
      <table v-else class="hd-table">
        <thead>
          <tr>
            <th style="width: 25%;">Nhân viên</th>
            <th style="width: 22%;">Nội bộ & Tài khoản</th>
            <th style="width: 28%;">Liên hệ & Định danh</th>
            <th style="width: 15%; text-align: center;">Trạng thái</th>
            <th style="width: 10%; text-align: center;">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="nv in pagedNhanViens" :key="nv.maNv">
            <td>
              <div style="display: flex; align-items: center; gap: 12px;">
                <img v-if="nv.hinhAnh" :src="`https://localhost:7196${nv.hinhAnh}`" class="avatar-img" />
                <div v-else class="avatar-fallback bg-gradient-to-tr from-blue-500 to-indigo-600">
                  {{ nv.hoTenNv?.charAt(0).toUpperCase() || '?' }}
                </div>
                <div>
                  <div style="font-weight: 700; color: #0f172a; font-size: 15px;">{{ nv.hoTenNv }}</div>
                  <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Mã: <span style="font-weight: 600; color: #2563eb;">{{ nv.maNv }}</span></div>
                  <span class="role-badge">{{ nv.tenChucVu }}</span>
                </div>
              </div>
            </td>
            <td>
              <div style="font-weight: 600; color: #334155;">{{ nv.tenDangNhap || '-- Chưa cấp TK --' }}</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px; display: flex; align-items: center; gap: 4px;" v-if="nv.ngayVaoLam">
                <Calendar class="w-3.5 h-3.5 text-slate-400" /> Ngày làm: {{ formatDate(nv.ngayVaoLam) }}
              </div>
            </td>
            <td>
              <div style="font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                <Phone class="w-3.5 h-3.5 text-slate-400" /> {{ nv.sdt }}
              </div>
              <div style="font-size: 12px; color: #475569; margin-top: 4px;" v-if="nv.cccd">
                CCCD: <span style="font-weight: 500;">{{ nv.cccd }}</span> - SN: <span style="font-weight: 500;">{{ nv.namSinh }}</span>
              </div>
              <div style="font-size: 11px; color: #64748b; margin-top: 4px; display: flex; align-items: flex-start; gap: 4px; max-w: 220px;" v-if="nv.diaChi" :title="nv.diaChi">
                <MapPin class="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                <span class="truncate">{{ nv.diaChi }}</span>
              </div>
            </td>
            <td style="text-align: center;">
              <span v-if="nv.trangThai === 1" class="status-badge status-badge-active">Đang làm việc</span>
              <span v-else class="status-badge status-badge-inactive">Đã nghỉ</span>
            </td>
            <td>
              <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                <button @click="openReviewModal(nv)" class="hd-btn-action" style="color: #d97706;" title="Đánh giá">
                  <Eye class="w-5 h-5" />
                </button>
                <button @click="openEditForm(nv)" class="hd-btn-action" style="color: #2563eb;" title="Sửa">
                  <Edit3 class="w-5 h-5" />
                </button>
                <button @click="deleteNhanVien(nv.maNv)" class="hd-btn-action" style="color: #ef4444;" title="Xóa">
                  <Trash2 class="w-5 h-5" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="nhanViens.length === 0">
            <td colspan="5" style="padding: 40px; text-align: center; color: #94a3b8; background-color: #f8fafc; border-style: dashed;">Không tìm thấy nhân viên nào phù hợp với bộ lọc.</td>
          </tr>
        </tbody>
      </table>
      
      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="hd-pagination print:hidden">
        <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1" class="hd-page-btn">
          Trước
        </button>
        <div class="hd-page-numbers">
          <button v-for="p in visiblePages" :key="p" @click="changePage(p)" :class="{ active: currentPage === p }" class="hd-page-number-btn">
            {{ p }}
          </button>
        </div>
        <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages" class="hd-page-btn">
          Sau
        </button>
      </div>
    </div>
  </div>

  <!-- Teleport Modals to Body -->
  <Teleport to="body">
    <!-- Scanner Modal -->
    <div v-if="showScanner" class="hd-modal-overlay">
      <div class="hd-modal-container" style="max-width: 480px; overflow: hidden;">
        <div class="hd-modal-header">
          <h3 class="hd-modal-title">Quét Thông Tin CCCD Từ Ảnh</h3>
          <button @click="closeScannerModal" class="hd-btn-close">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="hd-modal-body" style="padding: 20px;">
          <!-- File/Image Scan only -->
          <div style="text-align: center;">
            <p style="font-size: 13px; color: #64748b; margin-top: 0; margin-bottom: 12px; line-height: 1.5;">
              Tải lên hình ảnh mặt trước của CCCD để tự động trích xuất thông tin.
            </p>
            <div style="background-color: #fffbeb; border: 1px solid #fef3c7; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
              <p style="font-size: 11px; color: #d97706; font-weight: 700; margin: 0; display: flex; align-items: center; justify-content: center; gap: 6px;">
                ⚠️ QUAN TRỌNG: Ảnh chụp CCCD phải nằm ngang (chữ đọc từ trái qua phải) và không bị lóa sáng.
              </p>
            </div>
            
            <label class="cursor-pointer" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; height: 48px; background-color: #2563eb; color: #ffffff; border-radius: 10px; font-weight: 600; font-size: 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15); margin-top: 8px;">
              <Camera class="w-5 h-5" />
              Chọn ảnh / Chụp ảnh CCCD
              <input type="file" accept="image/*" @change="processIdCardImage" class="hidden">
            </label>

            <div v-if="isScanning" style="margin-top: 20px; text-align: center;">
               <div class="animate-spin" style="margin: 0 auto 12px auto; width: 32px; height: 32px; border: 3px solid #dbeafe; border-top-color: #2563eb; border-radius: 50%;"></div>
               <p style="font-size: 13px; font-weight: 600; color: #2563eb; margin: 0;">{{ scanProgress }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Modal -->
    <div v-if="showReviewModal" class="hd-modal-overlay">
      <div class="hd-modal-container" style="max-width: 520px;">
        <div class="hd-modal-header">
          <div>
            <h3 class="hd-modal-title">Đánh Giá Khách Hàng</h3>
            <p style="font-size: 12px; color: #64748b; margin-top: 4px; margin-bottom: 0;">
              Nhân viên: <span style="font-weight: 700; color: #0f172a;">{{ selectedNvName }}</span>
            </p>
          </div>
          <button @click="closeReviewModal" class="hd-btn-close">
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="hd-modal-body" style="padding: 24px; max-height: 60vh; overflow-y: auto;">
          <div v-if="loadingReviews" style="text-align: center; padding: 24px; color: #64748b; font-weight: 500;">
            <div class="animate-spin" style="margin: 0 auto 12px auto; width: 28px; height: 28px; border: 3px solid #dbeafe; border-top-color: #2563eb; border-radius: 50%;"></div>
            Đang tải đánh giá...
          </div>
          <div v-else-if="reviewsList.length === 0" style="text-align: center; padding: 32px; color: #94a3b8; font-style: italic;">
            Nhân viên này chưa có đánh giá nào từ khách hàng.
          </div>
          <div v-else style="display: flex; flex-direction: column; gap: 16px;">
            <div v-for="(review, index) in reviewsList" :key="index" class="review-card">
              <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
                <span style="color: #fbbf24; font-size: 16px;">★</span>
                <span style="font-weight: 700; color: #1e293b; font-size: 14px;">{{ review.diem || review.soSao || 5 }} / 5</span>
              </div>
              <p style="margin: 0; font-size: 13.5px; color: #475569; font-style: italic; line-height: 1.5;">
                "{{ review.noiDung || review.binhLuan || 'Không có bình luận...' }}"
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="hd-modal-overlay">
      <div class="hd-modal-container" style="max-width: 800px; width: 100%;">
        <div class="hd-modal-header">
          <h3 class="hd-modal-title">
            {{ isEditMode ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới' }}
          </h3>
          <button @click="closeModal" class="hd-btn-close">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <form @submit.prevent="saveNhanVien" class="hd-modal-body" style="padding: 24px; display: flex; flex-direction: column; gap: 20px; max-height: 75vh; overflow-y: auto;">
          <div style="display: flex; gap: 24px; flex-wrap: wrap;">
            <!-- Left Side: Image Preview & Selection -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; width: 180px; flex-shrink: 0; margin: 0 auto;">
              <div style="width: 140px; height: 140px; border-radius: 50%; border: 3px solid #e2e8f0; overflow: hidden; background-color: #f8fafc; display: flex; align-items: center; justify-content: center; position: relative; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <img v-if="imagePreviewUrl" :src="imagePreviewUrl" style="width: 100%; height: 100%; object-fit: cover;" />
                <span v-else style="color: #94a3b8; font-size: 12px; font-weight: 500; text-align: center; padding: 12px;">Chưa có ảnh</span>
              </div>
              <label class="cursor-pointer" style="display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; font-weight: 600; color: #475569; hover:bg-slate-50 transition: all 0.2s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);">
                Chọn ảnh đại diện
                <input type="file" class="hidden" accept="image/*" @change="handleImageUpload">
              </label>
            </div>

            <!-- Right Side: Fields Grid -->
            <div style="flex: 1; min-width: 300px; display: flex; flex-direction: column; gap: 20px;">
              <!-- Section 1: Thông tin cá nhân -->
              <div>
                <h4 class="form-section-title">Thông Tin Cá Nhân</h4>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
                  <div style="grid-column: span 2;">
                    <label class="form-label">Họ Tên <span style="color: #ef4444;">*</span></label>
                    <input v-model="formData.hoTenNv" type="text" class="hd-input" :style="errors.hoTenNv ? 'border-color: #ef4444;' : ''" placeholder="Họ và tên đầy đủ">
                    <p v-if="errors.hoTenNv" class="error-text">{{ errors.hoTenNv }}</p>
                  </div>
                  <div>
                    <label class="form-label">Giới tính</label>
                    <div class="hd-status-wrapper" style="max-width: 100%;">
                      <select v-model="formData.gioiTinh" class="hd-status-select select-filter">
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                      </select>
                      <div class="hd-dropdown-arrow">
                        <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-top: 16px;">
                  <div>
                    <label class="form-label">Năm sinh *</label>
                    <input v-model="formData.namSinh" type="number" class="hd-input" :style="errors.namSinh ? 'border-color: #ef4444;' : ''" placeholder="VD: 1998">
                    <p v-if="errors.namSinh" class="error-text">{{ errors.namSinh }}</p>
                  </div>
                  <div>
                    <label class="form-label">Số CCCD</label>
                    <input v-model="formData.cccd" type="text" class="hd-input" :style="errors.cccd ? 'border-color: #ef4444;' : ''" placeholder="12 chữ số">
                    <p v-if="errors.cccd" class="error-text">{{ errors.cccd }}</p>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                  <div>
                    <label class="form-label">Số Điện Thoại <span style="color: #ef4444;">*</span></label>
                    <input v-model="formData.sdt" type="text" class="hd-input" :style="errors.sdt ? 'border-color: #ef4444;' : ''" placeholder="Số điện thoại di động">
                    <p v-if="errors.sdt" class="error-text">{{ errors.sdt }}</p>
                  </div>
                  <div>
                    <label class="form-label">Email</label>
                    <input v-model="formData.email" type="email" class="hd-input" placeholder="example@domain.com">
                  </div>
                </div>

                <div style="margin-top: 16px;">
                  <label class="form-label">Địa chỉ thường trú</label>
                  <input v-model="formData.diaChi" type="text" class="hd-input" placeholder="Số nhà, tên đường, khu vực...">
                </div>
              </div>

              <!-- Section 2: Thông tin công việc -->
              <div>
                <h4 class="form-section-title">Thông Tin Công Việc</h4>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;">
                  <div>
                    <label class="form-label">Mã NV <span style="color: #ef4444;">*</span></label>
                    <input v-model="formData.maNv" type="text" :disabled="isEditMode" class="hd-input" :style="errors.maNv ? 'border-color: #ef4444;' : ''" placeholder="NV001">
                    <p v-if="errors.maNv" class="error-text">{{ errors.maNv }}</p>
                  </div>
                  <div>
                    <label class="form-label">Chức vụ</label>
                    <div class="hd-status-wrapper" style="max-width: 100%;">
                      <select v-model="formData.maRole" class="hd-status-select select-filter">
                        <option value="">-- Chọn chức vụ --</option>
                        <option v-for="r in roles" :key="r.maRole || r.MaRole" :value="r.maRole || r.MaRole">{{ r.tenChucVu || r.TenChucVu }}</option>
                      </select>
                      <div class="hd-dropdown-arrow">
                        <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="form-label">Phân loại NV</label>
                    <div class="hd-status-wrapper" style="max-width: 100%;">
                      <select v-model="formData.maLoaiNv" class="hd-status-select select-filter">
                        <option value="">-- Chọn loại --</option>
                        <option v-for="l in loaiNvs" :key="l.maLoaiNv || l.MaLoaiNv" :value="l.maLoaiNv || l.MaLoaiNv">{{ l.tenLoai || l.TenLoai }}</option>
                      </select>
                      <div class="hd-dropdown-arrow">
                        <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label class="form-label">Lương cơ bản</label>
                    <input :value="formatVND(currentLoaiLuong)" type="text" class="hd-input" readonly disabled style="background-color: #f8fafc; font-weight: 600; color: #475569;" />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
                  <div>
                    <label class="form-label">Ngày vào làm</label>
                    <input v-model="formData.ngayVaoLam" type="date" class="hd-input">
                  </div>
                  <div>
                    <label class="form-label">Trạng thái công việc</label>
                    <div class="hd-status-wrapper" style="max-width: 100%;">
                      <select v-model="formData.trangThai" class="hd-status-select select-filter" :class="formData.trangThai === 1 ? 'status-completed' : 'status-canceled'">
                        <option :value="1" class="text-slate-700 bg-white">Đang làm việc</option>
                        <option :value="0" class="text-slate-700 bg-white">Đã nghỉ</option>
                      </select>
                      <div class="hd-dropdown-arrow">
                        <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 3: Tài khoản hệ thống -->
              <div style="background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #f1f5f9;">
                <h4 class="form-section-title" style="margin-top: 0; color: #475569; font-size: 12px; letter-spacing: 0.05em;">Tài Khoản Đăng Nhập</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div>
                    <label class="form-label">Tên đăng nhập</label>
                    <input v-model="formData.tenDangNhap" type="text" class="hd-input" :style="errors.tenDangNhap ? 'border-color: #ef4444;' : ''" placeholder="Không chứa khoảng trắng">
                    <p v-if="errors.tenDangNhap" class="error-text">{{ errors.tenDangNhap }}</p>
                  </div>
                  <div>
                    <label class="form-label">Mật khẩu đăng nhập</label>
                    <input v-model="formData.matKhau" type="password" class="hd-input" :style="errors.matKhau ? 'border-color: #ef4444;' : ''" :placeholder="isEditMode ? '(Giữ nguyên mật khẩu cũ)' : 'Mật khẩu khởi tạo'">
                    <p v-if="errors.matKhau" class="error-text">{{ errors.matKhau }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Form Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <button type="button" @click="closeModal" class="hd-btn-close-modal">Hủy bỏ</button>
            <button type="submit" class="hd-btn-export" style="box-shadow: none;">Lưu thông tin</button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- Leaderboard Modal -->
  <ThongKeNhanVienModal :isOpen="showThongKeModal" @close="showThongKeModal = false" />
</template>

<style scoped>
/* ── Container ── */
.hoadon-container {
    padding: 24px;
    background-color: #f8fafc;
    min-height: 100vh;
    border-radius: 16px;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
}

/* ── Header ── */
.hd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
    flex-wrap: wrap;
    gap: 16px;
}
.hd-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}
.hd-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background-color: #2563eb;
    color: #ffffff !important;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
    flex-shrink: 0;
}
.hd-header-icon :deep(svg) {
    width: 24px;
    height: 24px;
    stroke: currentColor;
}
.hd-header-title {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
}
.hd-header-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0 0;
}

/* ── Premium Buttons ── */
.hd-btn-export {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
.hd-btn-export:hover {
    background-color: #1d4ed8 !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
}
.hd-btn-export:active {
    transform: translateY(0);
}

.hd-btn-secondary {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #ffffff !important;
    color: #475569 !important;
    border: 1px solid #cbd5e1;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.hd-btn-secondary:hover {
    background-color: #f8fafc !important;
    color: #0f172a !important;
    border-color: #94a3b8;
    transform: translateY(-1px);
}
.hd-btn-secondary:active {
    transform: translateY(0);
}

/* ── Filters Grid ── */
.hd-filters-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    background-color: #ffffff;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid #edf2f7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
@media (max-width: 1024px) {
    .hd-filters-grid {
        grid-template-columns: repeat(2, 1fr);
    }
}
@media (max-width: 640px) {
    .hd-filters-grid {
        grid-template-columns: 1fr;
    }
}
.hd-filter-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.hd-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.hd-input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    font-size: 14px;
    color: #1e293b;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
}
.hd-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

/* ── Search Input ── */
.hd-search-wrapper {
    position: relative;
    width: 100%;
}
.hd-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    width: 18px;
    height: 18px;
    pointer-events: none;
}
.hd-search-input {
    padding-left: 40px !important;
}

/* ── Table Wrapper ── */
.hd-table-wrapper {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow-x: auto;
    width: 100%;
}

/* ── Table ── */
.hd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
    min-width: 800px;
}
.hd-table th {
    padding: 14px 16px;
    background-color: #f8fafc;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
}
.hd-table td {
    padding: 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
}
.hd-table tbody tr:hover {
    background-color: rgba(37, 99, 235, 0.01);
}
.hd-table tbody tr:last-child td {
    border-bottom: none;
}

/* ── Dropdown Select style ── */
.hd-status-wrapper {
    display: inline-flex;
    position: relative;
    min-width: 120px;
    width: 100%;
}
.hd-status-select {
    width: 100%;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 8px 32px 8px 12px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.hd-status-select:focus {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.hd-dropdown-arrow {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    width: 16px;
    height: 16px;
    color: currentColor;
    opacity: 0.8;
}

.select-filter {
    background-color: #ffffff !important;
    color: #1e293b !important;
    border: 1px solid #cbd5e1 !important;
    height: 44px;
    padding-right: 36px;
    font-size: 14px;
    font-weight: 500;
}

/* ── Status Colors ── */
.status-canceled {
    background-color: #fef2f2 !important;
    color: #ef4444 !important;
    border-color: #fecaca !important;
}
.status-completed {
    background-color: #f0fdf4 !important;
    color: #16a34a !important;
    border-color: #bbf7d0 !important;
}

/* ── Action Buttons ── */
.hd-btn-action {
    background: none;
    border: none;
    color: #64748b;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.hd-btn-action:hover {
    background-color: rgba(37, 99, 235, 0.05);
}

/* ── Modal Overlay ── */
.hd-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}
.hd-modal-container {
    background-color: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    overflow: hidden;
    animation: hdModalShow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes hdModalShow {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.hd-modal-header {
    padding: 16px 24px;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.hd-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}
.hd-btn-close {
    background: none;
    border: none;
    color: #94a3b8;
    padding: 6px;
    border-radius: 9999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}
.hd-btn-close:hover {
    color: #475569;
    background-color: #e2e8f0;
}

.hd-modal-body {
    padding: 24px;
}

/* ── Pagination ── */
.hd-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-top: 1px solid #f1f5f9;
    background-color: #ffffff;
    border-radius: 0 0 14px 14px;
}
.hd-page-btn {
    background-color: #ffffff;
    border: 1px solid #cbd5e1;
    color: #475569;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
}
.hd-page-btn:hover:not(:disabled) {
    background-color: #f8fafc;
    border-color: #94a3b8;
    color: #0f172a;
}
.hd-page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.hd-page-numbers {
    display: flex;
    gap: 6px;
}
.hd-page-number-btn {
    background: none;
    border: 1px solid transparent;
    color: #475569;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
}
.hd-page-number-btn:hover {
    background-color: #f1f5f9;
    color: #0f172a;
}
.hd-page-number-btn.active {
    background-color: #2563eb;
    color: #ffffff;
    border-color: #2563eb;
}

/* ── Custom Elements for Employees ── */
.avatar-img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #e2e8f0;
}
.avatar-fallback {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    font-weight: 700;
    font-size: 16px;
    border: 2px solid #e2e8f0;
}
.role-badge {
    display: inline-block;
    padding: 2px 8px;
    background-color: #eff6ff;
    color: #2563eb;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 4px;
}
.status-badge {
    display: inline-block;
    padding: 6px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
}
.status-badge-active {
    background-color: #f0fdf4;
    color: #16a34a;
    border: 1px solid #bbf7d0;
}
.status-badge-inactive {
    background-color: #fef2f2;
    color: #ef4444;
    border: 1px solid #fecaca;
}

.review-card {
    padding: 16px;
    border-radius: 12px;
    border: 1px solid #f1f5f9;
    background-color: #f8fafc;
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.02);
}

.form-section-title {
    font-size: 13px;
    font-weight: 800;
    color: #1e293b;
    border-bottom: 2px solid #f1f5f9;
    padding-bottom: 6px;
    margin: 20px 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.form-section-title:first-of-type {
    margin-top: 0;
}
.form-label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    margin-bottom: 6px;
}
.error-text {
    color: #ef4444;
    font-size: 11px;
    font-weight: 600;
    margin: 4px 0 0 0;
}
.hd-btn-close-modal {
    background-color: #ffffff !important;
    color: #475569 !important;
    border: 1px solid #cbd5e1;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
}
.hd-btn-close-modal:hover {
    background-color: #f8fafc !important;
    color: #0f172a !important;
    border-color: #94a3b8;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
.animate-spin {
    animation: spin 1s linear infinite;
}

/* ── Live Scanner Styles ── */
.scanner-tabs {
  display: flex;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.scanner-tab-btn {
  flex: 1;
  border: none;
  background: none;
  padding: 12px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s ease;
}
.scanner-tab-btn:hover {
  color: #1e293b;
  background-color: #f1f5f9;
}
.scanner-tab-btn.active {
  color: #2563eb;
  border-bottom-color: #2563eb;
  background-color: #ffffff;
}

.scan-laser-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 2px;
  background-color: #2563eb;
  box-shadow: 0 0 8px #2563eb, 0 0 12px #2563eb;
  z-index: 10;
  animation: laserScan 2s linear infinite;
}

@keyframes laserScan {
  0% { top: 0%; }
  50% { top: 100%; }
  100% { top: 0%; }
}
</style>