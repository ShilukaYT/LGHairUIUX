<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import Tesseract from 'tesseract.js';
import { Html5Qrcode } from 'html5-qrcode';
import ThongKeNhanVienModal from './ThongKeNhanVienModal.vue';
import { Search, Plus, Edit3, Trash2, X, Award, Camera, Users, Phone, Mail, MapPin, Calendar, Eye, Filter } from 'lucide-vue-next';
import { logActivity } from '@/utils/activityLogger';
import { useCustomizerStore } from '@/stores/customizer';

const customizer = useCustomizerStore();

// ── Theme State Detection (Light / Dark Mode Sync) ──
const isDarkMode = computed(() => {
  if (customizer?.actTheme === 'dark') return true;
  try {
    const vuetifyTheme = useTheme();
    if (vuetifyTheme?.global?.name?.value === 'dark' || vuetifyTheme?.global?.current?.value?.dark) {
      return true;
    }
  } catch (e) {}
  return localStorage.getItem('theme_selection') === 'dark' 
      || localStorage.getItem('actTheme') === 'dark'
      || document.documentElement.classList.contains('dark') 
      || document.body.classList.contains('v-theme--dark');
});

// Watch theme change and update body background to prevent white bottom area
watch(isDarkMode, (dark) => {
  if (dark) {
    document.body.style.backgroundColor = '#141416';
  } else {
    document.body.style.backgroundColor = '';
  }
}, { immediate: true });

onUnmounted(() => {
  document.body.style.backgroundColor = '';
});

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

const originalStaffData = ref(null);

const openEditForm = (nv) => {
  isEditMode.value = true;
  originalStaffData.value = { ...nv };
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

    const cccdMatch = text.match(/\b\d{12}\b/) || text.match(/\d{12}/);
    if (cccdMatch) cccdExtracted = cccdMatch[0];

    const dobRegex = /(\d{2})\s*[\/\-\.]\s*(\d{2})\s*[\/\-\.]\s*(\d{4})/;
    const dobMatch = text.match(dobRegex);
    if (dobMatch) namSinhExtracted = dobMatch[3]; 

    const genderMatch = text.match(/(?:giới tính|sex|gioi tinh)[\s:;\/\|]*([^\n]*)/i);
    if (genderMatch) {
      const genderText = genderMatch[1].toLowerCase();
      if (genderText.includes('nữ') || genderText.includes('female') || genderText.includes(' f ')) gioiTinhExtracted = 'Nữ';
      else if (genderText.includes('nam') || genderText.includes('male') || genderText.includes(' m ')) gioiTinhExtracted = 'Nam';
    } else {
      if (/\b(Nữ|Nu|N[uưứữ])\b/i.test(text)) gioiTinhExtracted = 'Nữ';
    }

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('họ và tên') || line.toLowerCase().includes('full name') || line.toLowerCase().includes('họ tên') || line.toLowerCase().includes('ho ten')) {
        let potentialName = line.replace(/.*(?:tên|name|tên|ten)[\s:;\/\|]*/i, '').trim();
        potentialName = cleanNameLine(potentialName);
        
        if (potentialName.length < 3 && i + 1 < lines.length) {
          potentialName = cleanNameLine(lines[i+1]);
        }
        if (potentialName) hoTenExtracted = toTitleCase(potentialName);
      }

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
      let detailText = `Đã ${isEditMode.value ? 'cập nhật thông tin' : 'thêm tài khoản'} nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv})`;
      
      if (isEditMode.value && originalStaffData.value) {
        const orig = originalStaffData.value;
        const changes = [];
        
        if ((formData.value.hoTenNv || '').trim() !== (orig.hoTenNv || '').trim()) {
          changes.push(`Họ tên: "${orig.hoTenNv || 'Chưa nhập'}" ➔ "${formData.value.hoTenNv.trim()}"`);
        }
        if ((formData.value.sdt || '').trim() !== (orig.sdt || '').trim()) {
          changes.push(`Số điện thoại: "${orig.sdt || 'Chưa có'}" ➔ "${formData.value.sdt.trim()}"`);
        }
        if ((formData.value.email || '').trim() !== (orig.email || '').trim()) {
          changes.push(`Email: "${orig.email || 'Chưa có'}" ➔ "${formData.value.email.trim()}"`);
        }
        if ((formData.value.diaChi || '').trim() !== (orig.diaChi || '').trim()) {
          changes.push(`Địa chỉ: "${orig.diaChi || 'Chưa nhập'}" ➔ "${formData.value.diaChi.trim()}"`);
        }
        if ((formData.value.gioiTinh || '').trim() !== (orig.gioiTinh || '').trim()) {
          changes.push(`Giới tính: "${orig.gioiTinh || 'Nam'}" ➔ "${formData.value.gioiTinh.trim()}"`);
        }
        if ((formData.value.cccd || '').trim() !== (orig.cccd || '').trim()) {
          changes.push(`Số CCCD: "${orig.cccd || 'Chưa có'}" ➔ "${formData.value.cccd.trim()}"`);
        }
        if (String(formData.value.namSinh || '') !== String(orig.namSinh || '')) {
          changes.push(`Năm sinh: "${orig.namSinh || 'Chưa chọn'}" ➔ "${formData.value.namSinh || 'Chưa chọn'}"`);
        }
        
        const origTT = String(orig.trangThai != null ? orig.trangThai : 1);
        const newTT = String(formData.value.trangThai != null ? formData.value.trangThai : 1);
        if (origTT !== newTT) {
          const ttLabel = v => (String(v) === '1' ? 'Đang làm việc' : 'Đã nghỉ / Khóa tài khoản');
          changes.push(`Trạng thái tài khoản: "${ttLabel(origTT)}" ➔ "${ttLabel(newTT)}"`);
        }

        if (formData.value.matKhau && formData.value.matKhau.trim()) {
          changes.push(`Mật khẩu: Đã đổi mật khẩu tài khoản mới`);
        }

        if (selectedImageFile.value) {
          changes.push(`Ảnh đại diện: Đã tải lên ảnh đại diện nhân viên mới`);
        }

        if (changes.length > 0) {
          detailText = `Cập nhật thông tin nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv}):\n• ` + changes.join('\n• ');
        }
      }

      logActivity(
        isEditMode.value ? "Cập nhật nhân viên" : "Thêm nhân viên mới",
        detailText,
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
  <div 
    class="nhanvien-container min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans antialiased relative transition-colors duration-300 print:hidden"
    :class="isDarkMode ? 'bg-[#141416] text-slate-100' : 'bg-slate-50 text-slate-800'"
  >
    <!-- Temporary hidden QR Code reader container -->
    <div id="qr-reader-temp" style="display: none;"></div>

    <!-- Header Section (To ra, rộng rãi, cân đối) -->
    <div 
      class="hd-header flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-2xl border p-7 md:p-8 mb-8 shadow-sm transition-colors duration-300"
      :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
    >
      <div class="flex items-center gap-6">
        <div class="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-sky-500/25 flex-shrink-0">
          <Users class="w-8 h-8 md:w-10 md:h-10" />
        </div>
        <div>
          <h2 class="text-2xl md:text-3xl lg:text-4xl font-extrabold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
            Quản Lý Nhân Viên
          </h2>
          <p class="text-sm md:text-base mt-1.5 font-medium" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
            Quản lý hồ sơ, chức vụ và tài khoản đăng nhập nội bộ
          </p>
        </div>
      </div>
      
      <div class="flex flex-wrap items-center gap-3.5 md:gap-4">
        <button 
          @click="showThongKeModal = true" 
          class="h-12 md:h-[50px] px-5 md:px-6 text-sm font-extrabold rounded-xl border transition-all cursor-pointer shadow-xs flex items-center gap-2.5"
          :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'"
        >
          <Award class="w-4.5 h-4.5 text-amber-500 shrink-0" /> 
          <span>Bảng xếp hạng</span>
        </button>

        <button 
          @click="openScannerModal" 
          class="h-12 md:h-[50px] px-5 md:px-6 text-sm font-extrabold rounded-xl border transition-all cursor-pointer shadow-xs flex items-center gap-2.5"
          :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:bg-slate-700 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'"
        >
          <Camera class="w-4.5 h-4.5 text-sky-500 shrink-0" /> 
          <span>Quét CCCD (Ảnh)</span>
        </button>

        <button 
          @click="openAddForm" 
          class="hd-btn-export h-12 md:h-[50px] px-6 md:px-7 text-sm md:text-base font-extrabold rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-2.5"
        >
          <Plus class="w-5 h-5 shrink-0" /> 
          <span>Thêm thủ công</span>
        </button>
      </div>
    </div>

    <!-- Filters Grid Section (To rộng rãi, cao 50px cân đối) -->
    <div 
      class="hd-filters-grid rounded-2xl border p-7 md:p-8 mb-8 shadow-sm transition-colors duration-300"
      :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
    >
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Col 1: Tìm kiếm -->
        <div class="flex flex-col gap-2.5">
          <label class="text-xs md:text-sm font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">TÌM KIẾM NHÂN VIÊN</label>
          <div class="relative flex items-center">
            <Search class="absolute left-4.5 w-5 h-5 pointer-events-none z-10 text-slate-400" />
            <input 
              type="text" 
              v-model="searchQuery" 
              @keyup.enter="fetchNhanViens" 
              placeholder="Nhập tên, mã NV, SĐT, CCCD..." 
              class="hd-input hd-search-input w-full h-[50px] text-sm md:text-base font-medium outline-none transition-all box-border rounded-xl"
              :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
            >
          </div>
        </div>

        <!-- Col 2: Trạng thái -->
        <div class="flex flex-col gap-2.5">
          <label class="text-xs md:text-sm font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">TRẠNG THÁI</label>
          <div class="relative flex items-center">
            <select 
              v-model="filterTrangThai" 
              @change="fetchNhanViens" 
              class="hd-select hd-input w-full h-[50px] text-sm md:text-base font-medium outline-none appearance-none cursor-pointer transition-all box-border rounded-xl"
              :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
            >
              <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Tất cả trạng thái</option>
              <option value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Đang làm việc</option>
              <option value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Đã nghỉ</option>
            </select>
            <span class="pointer-events-none absolute right-5 text-sm text-sky-500 font-bold z-10">▼</span>
          </div>
        </div>

        <!-- Col 3: Giới tính -->
        <div class="flex flex-col gap-2.5">
          <label class="text-xs md:text-sm font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">GIỚI TÍNH</label>
          <div class="relative flex items-center">
            <select 
              v-model="filterGioiTinh" 
              @change="fetchNhanViens" 
              class="hd-select hd-input w-full h-[50px] text-sm md:text-base font-medium outline-none appearance-none cursor-pointer transition-all box-border rounded-xl"
              :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
            >
              <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Tất cả giới tính</option>
              <option value="Nam" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Nam</option>
              <option value="Nữ" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Nữ</option>
            </select>
            <span class="pointer-events-none absolute right-5 text-sm text-sky-500 font-bold z-10">▼</span>
          </div>
        </div>

        <!-- Col 4: Nút Lọc Dữ Liệu -->
        <div class="flex flex-col justify-end">
          <button 
            @click="fetchNhanViens" 
            class="hd-btn-export h-[50px] w-full text-sm md:text-base font-extrabold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
          >
            <Filter class="w-4.5 h-4.5" />
            <span>Lọc Dữ Liệu</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Table Section -->
    <div 
      class="hd-table-wrapper flex-1 w-full rounded-2xl border shadow-xs relative overflow-hidden flex flex-col z-10 min-h-[400px] transition-colors duration-300"
      :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
    >
      <div v-if="loading" class="p-12 text-center text-xs font-extrabold text-sky-600 tracking-wider uppercase">
        <div class="w-8 h-8 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-3"></div>
        Đang đồng bộ nạp danh sách nhân viên hệ thống...
      </div>
      
      <div v-else class="flex-grow overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[900px]">
          <thead>
            <tr :class="isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-900 text-white'">
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-64 whitespace-nowrap">Nhân viên</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-56 whitespace-nowrap">Nội bộ & Tài khoản</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider">Liên hệ & Định danh</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 text-center whitespace-nowrap">Trạng thái</th>
              <th class="py-4 px-4 font-extrabold uppercase tracking-wider w-36 text-center whitespace-nowrap">Hành động</th>
            </tr>
          </thead>
          <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'">
            <tr 
              v-for="nv in pagedNhanViens" 
              :key="nv.maNv"
              class="transition-colors duration-150"
              :class="isDarkMode ? 'hover:bg-slate-800/60 text-slate-200' : 'hover:bg-sky-50/60 text-slate-700'"
            >
              <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                  <img v-if="nv.hinhAnh" :src="`https://localhost:7196${nv.hinhAnh}`" class="w-11 h-11 rounded-full object-cover border-2 border-slate-200 flex-shrink-0 shadow-xs" />
                  <div v-else class="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center font-black text-white text-base flex-shrink-0 border-2 border-slate-200 shadow-xs">
                    {{ nv.hoTenNv?.charAt(0).toUpperCase() || '?' }}
                  </div>
                  <div class="flex flex-col gap-0.5">
                    <span class="font-extrabold text-sm" :class="isDarkMode ? 'text-white' : 'text-slate-900'">{{ nv.hoTenNv }}</span>
                    <span class="text-xs font-mono font-extrabold text-sky-500">Mã: {{ nv.maNv }}</span>
                    <span class="inline-block px-2 py-0.5 text-[10px] font-extrabold rounded-md border w-fit" :class="isDarkMode ? 'bg-sky-950/80 text-sky-300 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'">
                      {{ nv.tenChucVu }}
                    </span>
                  </div>
                </div>
              </td>

              <td class="py-4 px-6">
                <div class="font-extrabold text-xs" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">
                  {{ nv.tenDangNhap || '-- Chưa cấp TK --' }}
                </div>
                <div v-if="nv.ngayVaoLam" class="text-xs font-medium opacity-75 mt-1 flex items-center gap-1.5" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                  <Calendar class="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>Ngày làm: {{ formatDate(nv.ngayVaoLam) }}</span>
                </div>
              </td>

              <td class="py-4 px-6">
                <div class="font-extrabold text-xs flex items-center gap-1.5" :class="isDarkMode ? 'text-slate-200' : 'text-slate-900'">
                  <Phone class="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>{{ nv.sdt }}</span>
                </div>
                <div v-if="nv.cccd" class="text-xs font-medium opacity-75 mt-1" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                  CCCD: <span class="font-mono font-bold">{{ nv.cccd }}</span> - SN: <span class="font-mono font-bold">{{ nv.namSinh }}</span>
                </div>
                <div v-if="nv.diaChi" class="text-xs opacity-75 mt-1 flex items-start gap-1.5 max-w-[220px] truncate" :title="nv.diaChi" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                  <MapPin class="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
                  <span class="truncate">{{ nv.diaChi }}</span>
                </div>
              </td>

              <td class="py-4 px-6 text-center whitespace-nowrap">
                <span 
                  class="inline-block px-3 py-1 text-xs font-extrabold rounded-full border"
                  :class="nv.trangThai === 1 
                    ? (isDarkMode ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200')
                    : (isDarkMode ? 'bg-rose-950/80 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200')"
                >
                  {{ nv.trangThai === 1 ? 'Đang làm việc' : 'Đã nghỉ' }}
                </span>
              </td>

              <td class="py-4 px-4 text-center whitespace-nowrap">
                <div class="flex items-center justify-center gap-2">
                  <button 
                    @click="openReviewModal(nv)" 
                    title="Xem đánh giá khách hàng"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-amber-500 text-amber-400' : 'bg-white border-slate-200 hover:border-amber-400 text-amber-600 hover:bg-amber-50'"
                  >
                    <Eye class="w-4 h-4" />
                  </button>

                  <button 
                    @click="openEditForm(nv)" 
                    title="Chỉnh sửa thông tin nhân viên"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-sky-500 text-sky-400' : 'bg-white border-slate-200 hover:border-sky-400 text-sky-600 hover:bg-sky-50'"
                  >
                    <Edit3 class="w-4 h-4" />
                  </button>

                  <button 
                    @click="deleteNhanVien(nv.maNv)" 
                    title="Xóa hồ sơ nhân viên"
                    class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                    :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-rose-500 text-rose-400' : 'bg-white border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50'"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-if="nhanViens.length === 0">
              <td colspan="5" class="p-12 text-center text-slate-500">
                <div class="flex flex-col items-center gap-2 max-w-sm mx-auto">
                  <Users class="w-8 h-8 text-slate-400 stroke-[1.5px]" />
                  <span class="font-extrabold text-sm" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Không tìm thấy dữ liệu nhân viên</span>
                  <span class="text-xs" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Không có nhân viên nào trùng khớp với bộ lọc tìm kiếm.</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      
      <!-- Pagination Controls -->
      <div 
        v-if="totalPages > 1" 
        class="flex-shrink-0 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t print:hidden"
        :class="isDarkMode ? 'bg-[#252536] border-slate-700/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'"
      >
        <div class="text-xs font-bold">
          Hiển thị trang <span class="text-sky-600">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ nhanViens.length }} nhân viên)
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="changePage(currentPage - 1)" 
            :disabled="currentPage === 1" 
            class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'"
          >
            <span>Trước</span>
          </button>

          <div class="flex items-center gap-1">
            <button 
              v-for="p in visiblePages" 
              :key="p" 
              @click="changePage(p)" 
              class="w-8 h-8 text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center justify-center cursor-pointer"
              :class="currentPage === p ? 'bg-sky-600 text-white font-extrabold shadow-sm' : (isDarkMode ? 'bg-[#2b2b36] text-slate-200 border border-slate-700 hover:border-slate-600' : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400')"
            >
              {{ p }}
            </button>
          </div>

          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages" 
            class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'"
          >
            <span>Sau</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Teleport Modals to Body -->
  <Teleport to="body">
    <!-- Scanner Modal -->
    <div 
      v-if="showScanner" 
      class="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-all"
      @click="closeScannerModal"
    >
      <div 
        class="act-modal-container relative w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
        :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
        @click.stop
      >
        <div 
          class="px-6 py-4 border-b flex items-center justify-between relative overflow-hidden transition-colors"
          :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
        >
          <h3 class="font-extrabold text-base tracking-wide" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
            Quét Thông Tin CCCD Từ Ảnh
          </h3>
          <button 
            @click="closeScannerModal" 
            class="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
            :class="isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <div class="p-6 flex flex-col items-center text-center gap-4">
          <p class="text-xs leading-relaxed" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
            Tải lên hình ảnh mặt trước của CCCD để hệ thống tự động trích xuất thông tin nhân viên.
          </p>
          
          <div class="w-full p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2" :class="isDarkMode ? 'bg-amber-950/40 text-amber-300 border-amber-800' : 'bg-amber-50 text-amber-700 border-amber-200'">
            <span>⚠️ QUAN TRỌNG: Ảnh chụp CCCD phải nằm ngang và không bị lóa sáng.</span>
          </div>
          
          <label class="hd-btn-export h-11 w-full text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md flex items-center justify-center gap-2">
            <Camera class="w-4 h-4" />
            <span>Chọn ảnh / Chụp ảnh CCCD</span>
            <input type="file" accept="image/*" @change="processIdCardImage" class="hidden">
          </label>

          <div v-if="isScanning" class="mt-4 flex flex-col items-center gap-2">
             <div class="w-8 h-8 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin"></div>
             <p class="text-xs font-extrabold text-sky-500">{{ scanProgress }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Review Modal (Cấu trúc Bảng chuẩn đẹp 100% đồng bộ với trang Xếp hạng nhân viên) -->
    <div 
      v-if="showReviewModal" 
      class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all"
      @click="closeReviewModal"
    >
      <div 
        class="relative w-full max-w-5xl rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
        :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-300 text-slate-900'"
        @click.stop
      >
        <!-- Modal Header (Đồng bộ chuẩn 100% với Modal Xếp Hạng) -->
        <div 
          class="px-8 py-6 border-b flex items-center justify-between relative overflow-hidden transition-colors"
          :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-100 border-slate-300'"
        >
          <div class="flex items-center gap-5">
            <div class="w-13 h-13 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
              <Award class="w-7 h-7" />
            </div>
            <div>
              <h3 class="text-xl md:text-2xl font-black tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                Phản Hồi & Đánh Giá Của Khách Hàng
              </h3>
              <p class="text-xs md:text-sm mt-1 font-semibold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'">
                Tổng hợp ý kiến đánh giá thực tế của khách hàng dành cho nhân viên: 
                <span class="inline-block ml-1 px-3 py-1 rounded-md font-black text-xs md:text-sm" :class="isDarkMode ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-sky-100 text-sky-900 border border-sky-300'">
                  {{ selectedNvName }}
                </span>
              </p>
            </div>
          </div>

          <button 
            @click="closeReviewModal" 
            class="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border"
            :class="isDarkMode ? 'text-slate-400 hover:text-white bg-slate-800/80 border-slate-700 hover:bg-slate-700' : 'text-slate-700 hover:text-slate-900 bg-white border-slate-300 hover:bg-slate-200'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Modal Body (Cấu trúc Bảng Data Table đồng bộ 100%) -->
        <div class="p-8 flex flex-col gap-6 max-h-[82vh] overflow-y-auto custom-scrollbar">
          
          <div v-if="loadingReviews" class="p-16 text-center text-xs font-extrabold text-sky-500 flex flex-col items-center justify-center gap-3">
            <div class="w-8 h-8 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-1"></div>
            <span>Đang nạp dữ liệu đánh giá từ khách hàng...</span>
          </div>

          <div v-else-if="reviewsList.length === 0" class="p-16 text-center text-sm font-semibold italic" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
            Nhân viên này chưa có phản hồi đánh giá nào từ khách hàng.
          </div>

          <template v-else>
            <!-- Bảng hiển thị danh sách đánh giá chuẩn như trang Xếp hạng nhân viên -->
            <div 
              class="rounded-xl border shadow-xs overflow-hidden transition-colors"
              :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-white border-slate-300'"
            >
              <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[700px]">
                <thead>
                  <tr :class="isDarkMode ? 'bg-[#1e1e2d] text-slate-100 border-b border-slate-700' : 'bg-slate-900 text-white'">
                    <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-20 text-center whitespace-nowrap">STT</th>
                    <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 text-center whitespace-nowrap">ĐIỂM ĐÁNH GIÁ</th>
                    <th class="py-4 px-6 font-extrabold uppercase tracking-wider whitespace-nowrap">NỘI DUNG LỜI BÌNH</th>
                    <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 text-center whitespace-nowrap">LOẠI DỊCH VỤ</th>
                    <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 text-center whitespace-nowrap">TRẠNG THÁI</th>
                  </tr>
                </thead>
                <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200'">
                  <tr 
                    v-for="(review, index) in reviewsList" 
                    :key="index"
                    class="transition-colors duration-150"
                    :class="isDarkMode ? 'hover:bg-slate-800/60 text-slate-100' : 'hover:bg-sky-50/60 text-slate-900'"
                  >
                    <!-- STT -->
                    <td class="py-4 px-6 text-center whitespace-nowrap font-extrabold">
                      <span 
                        class="inline-flex w-8 h-8 rounded-lg items-center justify-center font-black text-xs shadow-2xs mx-auto"
                        :class="isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-300'"
                      >
                        {{ index + 1 }}
                      </span>
                    </td>

                    <!-- Điểm đánh giá -->
                    <td class="py-4 px-6 text-center whitespace-nowrap">
                      <div 
                        class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-black text-sm"
                        :class="isDarkMode ? 'bg-slate-800/90 border-slate-700 text-amber-300' : 'bg-amber-100 border-amber-300 text-amber-900'"
                      >
                        <span>{{ review.diem || review.soSao || 5 }}.0</span>
                        <Star class="w-4 h-4 fill-amber-500 text-amber-500" />
                      </div>
                    </td>

                    <!-- Nội dung lời bình -->
                    <td class="py-4 px-6">
                      <div class="font-bold text-sm md:text-base leading-relaxed italic" :class="isDarkMode ? 'text-slate-100' : 'text-slate-900'">
                        "{{ review.noiDung || review.binhLuan || 'Khách hàng không để lại bình luận chi tiết.' }}"
                      </div>
                    </td>

                    <!-- Loại dịch vụ -->
                    <td class="py-4 px-6 text-center whitespace-nowrap font-semibold">
                      <span class="px-3 py-1 rounded-md text-xs font-bold" :class="isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-300'">
                        Dịch vụ Salon
                      </span>
                    </td>

                    <!-- Trạng thái -->
                    <td class="py-4 px-6 text-center whitespace-nowrap">
                      <span class="inline-block px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border bg-emerald-100 text-emerald-800 border-emerald-400">
                        ĐÃ XÁC MINH
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal (Thiết kế rộng rãi max-w-3xl, lề lùi px-8 md:px-10) -->
    <div 
      v-if="showModal" 
      class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all"
      @click="closeModal"
    >
      <div 
        class="act-modal-container relative w-full max-w-3xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
        :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
        @click.stop
      >
        <!-- Modal Header -->
        <div 
          class="px-8 md:px-10 py-5 border-b flex items-center justify-between relative overflow-hidden transition-colors"
          :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
        >
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center font-bold flex-shrink-0">
              <Users class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-extrabold text-base md:text-lg tracking-wide" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                {{ isEditMode ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới' }}
              </h3>
              <p class="text-xs mt-0.5" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                {{ isEditMode ? 'Sửa thông tin hồ sơ, chức vụ và tài khoản nhân viên' : 'Nhập đầy đủ thông tin để cấp tài khoản nhân viên mới' }}
              </p>
            </div>
          </div>
          <button 
            @click="closeModal" 
            class="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
            :class="isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'"
          >
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <form @submit.prevent="saveNhanVien" class="p-8 md:px-10 md:py-8 flex flex-col gap-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          <div class="flex flex-col lg:flex-row gap-8">
            
            <!-- Left Side: Image Preview & Selection -->
            <div class="flex flex-col items-center gap-3 w-full lg:w-44 flex-shrink-0">
              <div class="w-32 h-32 md:w-36 md:h-36 rounded-full border-3 overflow-hidden flex items-center justify-center relative shadow-md" :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700' : 'bg-slate-100 border-slate-200'">
                <img v-if="imagePreviewUrl" :src="imagePreviewUrl" class="w-full h-full object-cover" />
                <span v-else class="text-xs font-semibold text-center px-3" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Chưa có ảnh</span>
              </div>
              <label 
                class="cursor-pointer h-9 px-4 text-xs font-bold rounded-lg border flex items-center justify-center transition-all shadow-2xs"
                :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'"
              >
                <span>Chọn ảnh đại diện</span>
                <input type="file" class="hidden" accept="image/*" @change="handleImageUpload">
              </label>
            </div>

            <!-- Right Side: Form Fields Grid -->
            <div class="flex-1 flex flex-col gap-6">
              
              <!-- Section 1: Thông tin cá nhân -->
              <div class="flex flex-col gap-4">
                <h4 class="text-xs font-extrabold uppercase tracking-wider border-b pb-2" :class="isDarkMode ? 'text-sky-400 border-slate-700/80' : 'text-sky-700 border-slate-200'">
                  Thông Tin Cá Nhân
                </h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div class="sm:col-span-2 flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                      Họ Tên <span class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="formData.hoTenNv" 
                      type="text" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.hoTenNv ? 'border-rose-500!' : '']" 
                      placeholder="Họ và tên đầy đủ"
                    >
                    <p v-if="errors.hoTenNv" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.hoTenNv }}</p>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Giới tính</label>
                    <div class="relative flex items-center">
                      <select 
                        v-model="formData.gioiTinh" 
                        class="hd-select hd-input w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                      >
                        <option value="Nam" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Nam</option>
                        <option value="Nữ" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Nữ</option>
                      </select>
                      <span class="pointer-events-none absolute right-4 text-xs text-sky-500 font-bold z-10">▼</span>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Năm sinh *</label>
                    <input 
                      v-model="formData.namSinh" 
                      type="number" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.namSinh ? 'border-rose-500!' : '']" 
                      placeholder="VD: 1998"
                    >
                    <p v-if="errors.namSinh" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.namSinh }}</p>
                  </div>

                  <div class="sm:col-span-2 flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Số CCCD</label>
                    <input 
                      v-model="formData.cccd" 
                      type="text" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.cccd ? 'border-rose-500!' : '']" 
                      placeholder="12 chữ số"
                    >
                    <p v-if="errors.cccd" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.cccd }}</p>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                      Số Điện Thoại <span class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="formData.sdt" 
                      type="text" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.sdt ? 'border-rose-500!' : '']" 
                      placeholder="Số điện thoại di động"
                    >
                    <p v-if="errors.sdt" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.sdt }}</p>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Email</label>
                    <input 
                      v-model="formData.email" 
                      type="email" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'" 
                      placeholder="example@domain.com"
                    >
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Địa chỉ thường trú</label>
                  <input 
                    v-model="formData.diaChi" 
                    type="text" 
                    class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                    :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'" 
                    placeholder="Số nhà, tên đường, khu vực..."
                  >
                </div>
              </div>

              <!-- Section 2: Thông tin công việc -->
              <div class="flex flex-col gap-4">
                <h4 class="text-xs font-extrabold uppercase tracking-wider border-b pb-2" :class="isDarkMode ? 'text-sky-400 border-slate-700/80' : 'text-sky-700 border-slate-200'">
                  Thông Tin Công Việc
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                      Mã NV <span class="text-rose-500">*</span>
                    </label>
                    <input 
                      v-model="formData.maNv" 
                      type="text" 
                      :disabled="isEditMode" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border disabled:opacity-60 disabled:cursor-not-allowed"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.maNv ? 'border-rose-500!' : '']" 
                      placeholder="NV001"
                    >
                    <p v-if="errors.maNv" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.maNv }}</p>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Chức vụ</label>
                    <div class="relative flex items-center">
                      <select 
                        v-model="formData.maRole" 
                        class="hd-select hd-input w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                      >
                        <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">-- Chọn chức vụ --</option>
                        <option v-for="r in roles" :key="r.maRole || r.MaRole" :value="r.maRole || r.MaRole" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">{{ r.tenChucVu || r.TenChucVu }}</option>
                      </select>
                      <span class="pointer-events-none absolute right-4 text-xs text-sky-500 font-bold z-10">▼</span>
                    </div>
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Phân loại NV</label>
                    <div class="relative flex items-center">
                      <select 
                        v-model="formData.maLoaiNv" 
                        class="hd-select hd-input w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                      >
                        <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">-- Chọn loại --</option>
                        <option v-for="l in loaiNvs" :key="l.maLoaiNv || l.MaLoaiNv" :value="l.maLoaiNv || l.MaLoaiNv" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">{{ l.tenLoai || l.TenLoai }}</option>
                      </select>
                      <span class="pointer-events-none absolute right-4 text-xs text-sky-500 font-bold z-10">▼</span>
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Lương cơ bản</label>
                    <input 
                      :value="formatVND(currentLoaiLuong)" 
                      type="text" 
                      class="hd-input w-full text-xs md:text-sm font-bold font-mono outline-none transition-all box-border opacity-80 cursor-not-allowed"
                      :class="isDarkMode ? 'bg-[#242436] border-slate-700 text-sky-400' : 'bg-slate-100 border-slate-300 text-slate-700'" 
                      readonly 
                      disabled
                    />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Ngày vào làm</label>
                    <input 
                      v-model="formData.ngayVaoLam" 
                      type="date" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="isDarkMode ? 'dark-mode-input [color-scheme:dark]' : 'light-mode-input'"
                    >
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Trạng thái công việc</label>
                    <div class="relative flex items-center">
                      <select 
                        v-model="formData.trangThai" 
                        class="hd-status-select text-xs md:text-sm font-extrabold rounded-lg px-4 py-2.5 outline-none cursor-pointer transition-all box-border border w-full"
                        :class="[
                          formData.trangThai === 1 ? (isDarkMode ? 'dark-status-completed' : 'light-status-completed') : (isDarkMode ? 'dark-status-canceled' : 'light-status-canceled'),
                          isDarkMode ? 'dark-status-dropdown' : 'light-status-dropdown'
                        ]"
                      >
                        <option :value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đang làm việc</option>
                        <option :value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đã nghỉ</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Section 3: Tài khoản hệ thống -->
              <div class="p-5 rounded-xl border flex flex-col gap-4" :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'">
                <h4 class="text-xs font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                  Tài Khoản Đăng Nhập Hệ Thống
                </h4>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Tên đăng nhập</label>
                    <input 
                      v-model="formData.tenDangNhap" 
                      type="text" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.tenDangNhap ? 'border-rose-500!' : '']" 
                      placeholder="Không chứa khoảng trắng"
                    >
                    <p v-if="errors.tenDangNhap" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.tenDangNhap }}</p>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Mật khẩu đăng nhập</label>
                    <input 
                      v-model="formData.matKhau" 
                      type="password" 
                      class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                      :class="[isDarkMode ? 'dark-mode-input' : 'light-mode-input', errors.matKhau ? 'border-rose-500!' : '']" 
                      :placeholder="isEditMode ? '(Giữ nguyên mật khẩu cũ)' : 'Mật khẩu khởi tạo'"
                    >
                    <p v-if="errors.matKhau" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.matKhau }}</p>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Form Actions -->
          <div 
            class="pt-5 border-t flex items-center justify-end gap-3 transition-colors mt-2"
            :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'"
          >
            <button 
              type="button" 
              @click="closeModal" 
              class="h-11 px-8 text-xs font-extrabold rounded-lg transition-all cursor-pointer border"
              :class="isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'"
            >
              Hủy bỏ
            </button>
            <button 
              type="submit" 
              class="hd-btn-export h-11 px-8 text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md"
            >
              Lưu thông tin
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>

  <!-- Leaderboard Modal -->
  <ThongKeNhanVienModal :isOpen="showThongKeModal" @close="showThongKeModal = false" />
</template>

<style scoped>
/* Enforce dark background on parent containers */
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Light Mode Input Styling */
.light-mode-input {
  background-color: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03) !important;
}
.light-mode-input:focus {
  background-color: #ffffff !important;
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
}

/* Dark Mode Input Styling */
.dark-mode-input {
  background-color: #2b2b36 !important;
  border: 1px solid #475569 !important;
  color: #ffffff !important;
}
.dark-mode-input:focus {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
}

/* Input Dimensions - Tăng chiều cao lên 50px, bo góc 12px rộng rãi */
.hd-input {
  height: 50px !important;
  border-radius: 12px !important;
  box-sizing: border-box !important;
  padding-left: 1.25rem !important;
  padding-right: 1.25rem !important;
  font-size: 14px !important;
}

.hd-select {
  padding-left: 1.25rem !important;
  padding-right: 3rem !important;
}

.hd-search-input {
  padding-left: 3rem !important;
}

/* Primary Button Styling */
.hd-btn-export {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
  font-weight: 800 !important;
}
.hd-btn-export:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
}

/* Status Badge Classes - Light Mode */
.light-status-completed {
  background-color: #f0fdf4 !important;
  color: #16a34a !important;
  border-color: #bbf7d0 !important;
}
.light-status-canceled {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
  border-color: #fecaca !important;
}

/* Status Badge Classes - Dark Mode */
.dark-status-completed {
  background-color: #052e16 !important;
  color: #86efac !important;
  border-color: #166534 !important;
}
.dark-status-canceled {
  background-color: #450a0a !important;
  color: #fca5a5 !important;
  border-color: #991b1b !important;
}

/* Custom styled scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #0284c7;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #0369a1;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>