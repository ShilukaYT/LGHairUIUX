<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import ThongKeNhanVienModal from './ThongKeNhanVienModal.vue';
import { Search, Plus, Edit3, Trash2, X, Award, Camera, Users, Phone, Mail, MapPin, Calendar, Eye, Filter, Star } from 'lucide-vue-next';
import { logActivity } from '@/utils/activityLogger';
import Swal from 'sweetalert2';
import { useCustomizerStore } from '@/stores/customizer';

const customizer = useCustomizerStore();
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

function toAbsUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${API}${cleanPath}`;
}


const getAuthHeaders = () => {
  const token = sessionStorage.getItem('adminToken')
             || localStorage.getItem('staffToken')
             || sessionStorage.getItem('staffToken')
             || localStorage.getItem('accessToken') 
             || localStorage.getItem('token') 
             || sessionStorage.getItem('accessToken') 
             || sessionStorage.getItem('token')
             || '';
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// â”€â”€ Theme State Detection (Light / Dark Mode Sync) â”€â”€
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
  trangThai: 1, tenDangNhap: '', matKhau: '', matKhauCu: ''
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

// â”€â”€ PhÃ¢n trang (Pagination) â”€â”€
const currentPage = ref(1);
const perPage = ref(10); // 10 nhÃ¢n viÃªn trÃªn má»—i trang

// Reset trang vá» 1 khi Ä‘á»•i bá»™ lá»c hoáº·c tÃ¬m kiáº¿m
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

// --- HÃ€M Táº¢I OPTION ÄÃƒ ÄÆ¯á»¢C CHá»NG Lá»–I ---
const fetchOptions = async () => {
  try {
    const resRole = await fetch(`${API}/api/NhanVien/roles`, { headers: getAuthHeaders() });
    if (resRole.ok) {
        roles.value = await resRole.json();
    } else {
        console.error("Lá»—i API táº£i Roles:", await resRole.text());
    }
  } catch(e) { console.error("Máº¥t káº¿t ná»‘i khi táº£i Roles: ", e); }

  try {
    const resLoai = await fetch(`${API}/api/NhanVien/loai-nv`, { headers: getAuthHeaders() });
    if (resLoai.ok) {
        loaiNvs.value = await resLoai.json();
    } else {
        console.error("Lá»—i API táº£i Loáº¡i NV:", await resLoai.text());
    }
  } catch(e) { console.error("Máº¥t káº¿t ná»‘i khi táº£i Loáº¡i NV: ", e); }
};

const fetchNhanViens = async () => {
  loading.value = true;
  try {
    const params = new URLSearchParams();
    if (searchQuery.value) params.append('search', searchQuery.value);
    if (filterTrangThai.value !== '') params.append('trangThai', filterTrangThai.value);
    if (filterGioiTinh.value) params.append('gioiTinh', filterGioiTinh.value);

    const res = await fetch(`${API}/api/NhanVien?${params.toString()}`, { headers: getAuthHeaders() });
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
      trangThai: 1, tenDangNhap: '', matKhau: '', matKhauCu: '' 
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
  formData.value = { ...nv, matKhau: '', matKhauCu: '' };
  
  if (nv.ngayVaoLam) {
      formData.value.ngayVaoLam = nv.ngayVaoLam.split('T')[0];
  }

  selectedImageFile.value = null;
  imagePreviewUrl.value = nv.hinhAnh ? toAbsUrl(nv.hinhAnh) : null;
  errors.value = {}; 
  showModal.value = true;
};

const closeModal = () => { showModal.value = false; };

const toTitleCase = (str) => {
  if (!str) return '';
  return str.trim().toLowerCase().split(/\s+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const vnLettersPattern = 'a-zA-ZÃ¡Ã áº£Ã£áº¡Äƒáº¯áº±áº³áºµáº·Ã¢áº¥áº§áº©áº«áº­Ã©Ã¨áº»áº½áº¹Ãªáº¿á»á»ƒá»…á»‡Ã­Ã¬á»‰Ä©á»‹Ã³Ã²á»Ãµá»Ã´á»‘á»“á»•á»—á»™Æ¡á»›á»á»Ÿá»¡á»£ÃºÃ¹á»§Å©á»¥Æ°á»©á»«á»­á»¯á»±Ã½á»³á»·á»¹á»µÄ‘ÄÃÃ€áº¢Ãƒáº Ä‚áº®áº°áº²áº´áº¶Ã‚áº¤áº¦áº¨áºªáº¬Ã‰Ãˆáººáº¼áº¸ÃŠáº¾á»€á»‚á»„á»†ÃÃŒá»ˆÄ¨á»ŠÃ“Ã’á»ŽÃ•á»ŒÃ”á»á»’á»”á»–á»˜Æ á»šá»œá»žá» á»¢ÃšÃ™á»¦Å¨á»¤Æ¯á»¨á»ªá»¬á»®á»°Ãá»²á»¶á»¸á»´';
const vnLettersRegex = new RegExp(`^[${vnLettersPattern}\\d\\s,.\\-\\/()\\'\\"â€™â€œâ€:]*$`);

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
  if (lower.includes('cÃ³ giÃ¡ trá»‹ Ä‘áº¿n') || lower.includes('date of expiry') || lower.includes('ngÃ y cáº¥p') || lower.includes('date of issue') || lower.includes('quá»‘c tá»‹ch') || lower.includes('nationality')) return false;
  
  return true;
};

const cleanAddressTypos = (address) => {
  return address
    .replace(/\b(?:Tnon|Thá»™n|Thá»n|Trá»n|Tnon\d+)\b/gi, 'ThÃ´n')
    .replace(/\b(?:dá»©i|dÃºi|dá»­i)\b/gi, 'JÃºt')
    .replace(/\b(?:Dáº¯k|DÄƒk|Dak)\b/gi, 'Äáº¯k')
    .replace(/\bNÃ´ngâ€”\b/gi, 'NÃ´ng')
    .trim();
};

const isAddressLabel = (line) => {
  if (!line) return false;
  const lower = line.toLowerCase().normalize('NFC');
  const hasIndicator = 
    lower.includes('trÃº') || 
    lower.includes('tru') || 
    lower.includes('resid') || 
    lower.includes('resen') || 
    lower.includes('resld') ||
    lower.includes('thÆ°á»ng') || 
    lower.includes('thuong') || 
    lower.includes('thÆ°Ã²ng');
    
  const isOtherField = 
    lower.includes('quÃª') || 
    lower.includes('que') || 
    lower.includes('origin') || 
    lower.includes('quá»‘c') || 
    lower.includes('quoc') || 
    lower.includes('nation') || 
    lower.includes('name') || 
    lower.includes('tÃªn') || 
    lower.includes('ten') || 
    lower.includes('birth') || 
    lower.includes('sinh') || 
    lower.includes('sex') || 
    lower.includes('tÃ­nh') || 
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
      console.error("Lá»—i khi dá»«ng camera:", err);
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
          console.error("Lá»—i khi xá»­ lÃ½ thÃ´ng tin mÃ£ QR:", err);
        }
      };

      try {
        await cameraScanner.value.start(
          cameraConfig,
          scannerConfig,
          onScanSuccess
        );
      } catch (startError) {
        console.warn("Khá»Ÿi Ä‘á»™ng camera vá»›i cáº¥u hÃ¬nh HD tháº¥t báº¡i, Ä‘ang chuyá»ƒn sang cáº¥u hÃ¬nh máº·c Ä‘á»‹nh (fallback)...", startError);
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
      console.error("Lá»—i khá»Ÿi táº¡o camera:", err);
      cameraError.value = "KhÃ´ng thá»ƒ khá»Ÿi Ä‘á»™ng camera. Vui lÃ²ng cáº¥p quyá»n truy cáº­p camera!";
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

const compressImage = (file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * maxHeight / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(blob => {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        }, 'image/jpeg', quality);
      };
      img.onerror = error => reject(error);
    };
    reader.onerror = error => reject(error);
  });
};

const processIdCardImage = async (event) => {
  const originalFile = event.target.files[0];
  if (!originalFile) return;

  isScanning.value = true;
  // Cáº­p nháº­t thÃ´ng bÃ¡o cho ngÆ°á»i dÃ¹ng
  scanProgress.value = 'Äang nÃ©n áº£nh Ä‘á»ƒ quÃ©t nhanh hÆ¡n...';

  try {
    const file = await compressImage(originalFile, 800, 800, 0.6);
    scanProgress.value = 'Äang gá»­i áº£nh nháº¹ lÃªn AI phÃ¢n tÃ­ch...';

    // ÄÃ³ng gÃ³i file áº£nh
    const formDataUpload = new FormData();
    formDataUpload.append('image', file);

    // Gá»­i áº£nh lÃªn Backend API .NET báº¡n vá»«a táº¡o
    const response = await fetch(`${API}/api/NhanVien/scan-cccd`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formDataUpload
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Lá»—i tá»« Backend khi phÃ¢n tÃ­ch áº£nh.');
    }

    // Láº¥y chuá»—i JSON chuáº©n tá»« AI tráº£ vá»
    const aiData = await response.json();

    scanProgress.value = 'Äá»c thÃ nh cÃ´ng! Äang tá»± Ä‘á»™ng Ä‘iá»n...';
    
    // Äá»£i 1 chÃºt Ä‘á»ƒ user tháº¥y thÃ´ng bÃ¡o thÃ nh cÃ´ng rá»“i má»›i má»Ÿ form
    setTimeout(() => {
      closeScannerModal();
      openAddForm();
      
      // BÃ³c tÃ¡ch JSON Ä‘á»• tháº³ng vÃ o form
      // LÆ°u Ã½: CÃ¡c key nÃ y (hoTen, soCccd...) pháº£i khá»›p vá»›i Prompt báº¡n Ä‘Ã£ viáº¿t á»Ÿ Backend
      if (aiData.hoTen) formData.value.hoTenNv = toTitleCase(aiData.hoTen);
      if (aiData.namSinh) formData.value.namSinh = aiData.namSinh;
      if (aiData.soCccd) formData.value.cccd = aiData.soCccd;
      if (aiData.diaChi) formData.value.diaChi = aiData.diaChi;
      if (aiData.gioiTinh) formData.value.gioiTinh = aiData.gioiTinh;
      
    }, 800);

  } catch (err) {
    console.error("Lá»—i quÃ©t CCCD báº±ng AI:", err);
    scanProgress.value = 'Lá»—i khi Ä‘á»c áº£nh. Äáº£m báº£o áº£nh rÃµ nÃ©t vÃ  thá»­ láº¡i!';
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
    const res = await fetch(`${API}/api/NhanVien/${nv.maNv}/danh-gia`, { headers: getAuthHeaders() });
    if (res.ok) reviewsList.value = await res.json();
    else alert("Lá»—i táº£i Ä‘Ã¡nh giÃ¡!");
  } catch (err) { console.error(err); } 
  finally { loadingReviews.value = false; }
};

const closeReviewModal = () => { showReviewModal.value = false; };

const handleImageUpload = (event) => {
  const file = event.target.files[0];
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      Swal.fire({
        icon: 'error',
        title: 'áº¢nh quÃ¡ lá»›n',
        text: 'Dung lÆ°á»£ng áº£nh Ä‘áº¡i diá»‡n khÃ´ng Ä‘Æ°á»£c vÆ°á»£t quÃ¡ 2MB!',
        confirmButtonColor: '#0284c7'
      });
      event.target.value = ''; // clear input
      selectedImageFile.value = null;
      return;
    }
    selectedImageFile.value = file;
    imagePreviewUrl.value = URL.createObjectURL(file); 
  }
};

const validateForm = () => {
  errors.value = {}; 
  let isValid = true;

  if (!formData.value.maNv?.trim()) { errors.value.maNv = 'Báº¯t buá»™c nháº­p.'; isValid = false; }
  if (!formData.value.hoTenNv?.trim()) { errors.value.hoTenNv = 'Báº¯t buá»™c nháº­p.'; isValid = false; }
  
  if (formData.value.cccd?.trim() && !/^\d{12}$/.test(formData.value.cccd)) {
    errors.value.cccd = 'CCCD pháº£i Ä‘á»§ 12 chá»¯ sá»‘.'; isValid = false;
  }

  const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})\b/;
  if (!formData.value.sdt?.trim()) { 
    errors.value.sdt = 'Báº¯t buá»™c nháº­p SÄT.'; isValid = false; 
  } else if (!phoneRegex.test(formData.value.sdt)) {
    errors.value.sdt = 'SÄT pháº£i lÃ  10 sá»‘, báº¯t Ä‘áº§u báº±ng 0.'; isValid = false;
  }

  if (formData.value.namSinh) {
    const currentYear = new Date().getFullYear();
    const birthYear = parseInt(formData.value.namSinh);
    if (birthYear < currentYear - 70 || birthYear > currentYear - 15) {
      errors.value.namSinh = `NÄƒm sinh pháº£i tá»« ${currentYear - 70} Ä‘áº¿n ${currentYear - 15}.`; isValid = false;
    }
  }
  
  if (formData.value.tenDangNhap && /\s/.test(formData.value.tenDangNhap)) {
    errors.value.tenDangNhap = 'KhÃ´ng chá»©a khoáº£ng tráº¯ng.'; isValid = false;
  }
  if (!isEditMode.value && formData.value.tenDangNhap && !formData.value.matKhau) {
    errors.value.matKhau = 'Vui lÃ²ng cáº¥p máº­t kháº©u.'; isValid = false;
  }
  if (isEditMode.value && formData.value.matKhau && formData.value.matKhau.trim()) {
    if (!formData.value.matKhauCu || !formData.value.matKhauCu.trim()) {
      errors.value.matKhauCu = 'Báº¯t buá»™c nháº­p máº­t kháº©u cÅ© Ä‘á»ƒ xÃ¡c thá»±c.';
      isValid = false;
    }
  }
  return isValid;
};

const saveNhanVien = async () => {
  if (!validateForm()) return; 

  const method = isEditMode.value ? 'PUT' : 'POST';
  const url = isEditMode.value ? `${API}/api/NhanVien/${formData.value.maNv}` : `${API}/api/NhanVien`;

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
  submitData.append('MatKhauCu', formData.value.matKhauCu || '');
  if (selectedImageFile.value) submitData.append('HinhAnhFile', selectedImageFile.value);

  try {
    const res = await fetch(url, { method: method, body: submitData, headers: getAuthHeaders() });
    if (res.ok) {
      let detailText = `ÄÃ£ ${isEditMode.value ? 'cáº­p nháº­t thÃ´ng tin' : 'thÃªm tÃ i khoáº£n'} nhÃ¢n viÃªn ${formData.value.hoTenNv} (MÃ£: ${formData.value.maNv})`;
      
      if (isEditMode.value && originalStaffData.value) {
        const orig = originalStaffData.value;
        const changes = [];
        
        if ((formData.value.hoTenNv || '').trim() !== (orig.hoTenNv || '').trim()) {
          changes.push(`Há» tÃªn: "${orig.hoTenNv || 'ChÆ°a nháº­p'}" âž” "${formData.value.hoTenNv.trim()}"`);
        }
        if ((formData.value.sdt || '').trim() !== (orig.sdt || '').trim()) {
          changes.push(`Sá»‘ Ä‘iá»‡n thoáº¡i: "${orig.sdt || 'ChÆ°a cÃ³'}" âž” "${formData.value.sdt.trim()}"`);
        }
        if ((formData.value.email || '').trim() !== (orig.email || '').trim()) {
          changes.push(`Email: "${orig.email || 'ChÆ°a cÃ³'}" âž” "${formData.value.email.trim()}"`);
        }
        if ((formData.value.diaChi || '').trim() !== (orig.diaChi || '').trim()) {
          changes.push(`Äá»‹a chá»‰: "${orig.diaChi || 'ChÆ°a nháº­p'}" âž” "${formData.value.diaChi.trim()}"`);
        }
        if ((formData.value.gioiTinh || '').trim() !== (orig.gioiTinh || '').trim()) {
          changes.push(`Giá»›i tÃ­nh: "${orig.gioiTinh || 'Nam'}" âž” "${formData.value.gioiTinh.trim()}"`);
        }
        if ((formData.value.cccd || '').trim() !== (orig.cccd || '').trim()) {
          changes.push(`Sá»‘ CCCD: "${orig.cccd || 'ChÆ°a cÃ³'}" âž” "${formData.value.cccd.trim()}"`);
        }
        if (String(formData.value.namSinh || '') !== String(orig.namSinh || '')) {
          changes.push(`NÄƒm sinh: "${orig.namSinh || 'ChÆ°a chá»n'}" âž” "${formData.value.namSinh || 'ChÆ°a chá»n'}"`);
        }
        
        const origTT = String(orig.trangThai != null ? orig.trangThai : 1);
        const newTT = String(formData.value.trangThai != null ? formData.value.trangThai : 1);
        if (origTT !== newTT) {
          const ttLabel = v => (String(v) === '1' ? 'Äang lÃ m viá»‡c' : 'ÄÃ£ nghá»‰ / KhÃ³a tÃ i khoáº£n');
          changes.push(`Tráº¡ng thÃ¡i tÃ i khoáº£n: "${ttLabel(origTT)}" âž” "${ttLabel(newTT)}"`);
        }

        if (formData.value.matKhau && formData.value.matKhau.trim()) {
          changes.push(`Máº­t kháº©u: ÄÃ£ Ä‘á»•i máº­t kháº©u tÃ i khoáº£n má»›i`);
        }

        if (selectedImageFile.value) {
          changes.push(`áº¢nh Ä‘áº¡i diá»‡n: ÄÃ£ táº£i lÃªn áº£nh Ä‘áº¡i diá»‡n nhÃ¢n viÃªn má»›i`);
        }

        if (changes.length > 0) {
          detailText = `Cáº­p nháº­t thÃ´ng tin nhÃ¢n viÃªn ${formData.value.hoTenNv} (MÃ£: ${formData.value.maNv}):\nâ€¢ ` + changes.join('\nâ€¢ ');
        }
      }

      logActivity(
        isEditMode.value ? "Cáº­p nháº­t nhÃ¢n viÃªn" : "ThÃªm nhÃ¢n viÃªn má»›i",
        detailText,
        "NhÃ¢n sá»±"
      );
      Swal.fire({
        icon: 'success',
        title: 'ThÃ nh cÃ´ng',
        text: isEditMode.value ? "Cáº­p nháº­t nhÃ¢n viÃªn thÃ nh cÃ´ng!" : "ThÃªm nhÃ¢n viÃªn thÃ nh cÃ´ng!",
        confirmButtonColor: '#0284c7'
      });
      closeModal(); fetchNhanViens(); 
    } else { 
      logActivity(
        isEditMode.value ? "Cáº­p nháº­t nhÃ¢n viÃªn" : "ThÃªm nhÃ¢n viÃªn má»›i",
        `Tháº¥t báº¡i khi ${isEditMode.value ? 'cáº­p nháº­t' : 'thÃªm'} nhÃ¢n viÃªn ${formData.value.hoTenNv} (MÃ£: ${formData.value.maNv})`,
        "NhÃ¢n sá»±",
        "Tháº¥t báº¡i"
      );
      const errorMsg = await res.text();
      let textToShow = errorMsg;
      try {
        const json = JSON.parse(errorMsg);
        if (json.message) textToShow = json.message;
      } catch(e) {}
      Swal.fire({
        icon: 'error',
        title: 'Lá»—i',
        text: textToShow || 'Thao tÃ¡c tháº¥t báº¡i!',
        confirmButtonColor: '#0284c7'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Lá»—i káº¿t ná»‘i',
      text: 'KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n mÃ¡y chá»§.',
      confirmButtonColor: '#0284c7'
    });
  }
};

const deleteNhanVien = async (id) => {
  const nv = nhanViens.value.find(n => n.maNv === id);
  const name = nv ? nv.hoTenNv : id;
  
  const result = await Swal.fire({
    title: 'XÃ¡c nháº­n xÃ³a?',
    text: `Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a há»“ sÆ¡ nhÃ¢n viÃªn ${name} (MÃ£: ${id})?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Äá»“ng Ã½ xÃ³a',
    cancelButtonText: 'Há»§y bá»'
  });
  
  if (!result.isConfirmed) return;
  
  try {
    const res = await fetch(`${API}/api/NhanVien/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
    if (res.ok) {
      logActivity("XÃ³a nhÃ¢n viÃªn", `ÄÃ£ xÃ³a há»“ sÆ¡ nhÃ¢n viÃªn ${name} (MÃ£: ${id})`, "NhÃ¢n sá»±");
      Swal.fire({
        icon: 'success',
        title: 'ÄÃ£ xÃ³a',
        text: `ÄÃ£ xÃ³a nhÃ¢n viÃªn ${name} thÃ nh cÃ´ng.`,
        confirmButtonColor: '#0284c7'
      });
      fetchNhanViens(); 
    } else { 
      const errMsg = await res.text();
      let textToShow = errMsg;
      try {
        const json = JSON.parse(errMsg);
        if (json.message) textToShow = json.message;
      } catch(e) {}
      logActivity("XÃ³a nhÃ¢n viÃªn", `XÃ³a tháº¥t báº¡i nhÃ¢n viÃªn ${name} (MÃ£: ${id}) - LÃ½ do: ${errMsg}`, "NhÃ¢n sá»±", "Tháº¥t báº¡i");
      Swal.fire({
        icon: 'error',
        title: 'Lá»—i',
        text: textToShow || 'XÃ³a nhÃ¢n viÃªn tháº¥t báº¡i.',
        confirmButtonColor: '#0284c7'
      });
    }
  } catch (err) {
    Swal.fire({
      icon: 'error',
      title: 'Lá»—i káº¿t ná»‘i',
      text: 'KhÃ´ng thá»ƒ káº¿t ná»‘i Ä‘áº¿n mÃ¡y chá»§.',
      confirmButtonColor: '#0284c7'
    });
  }
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
  <v-container fluid class="pa-6 fill-height align-start" :class="isDarkMode ? 'bg-[#141416]' : 'bg-slate-50'" style="min-height: 100vh;">
    <!-- Temporary hidden QR Code reader container -->
    <div id="qr-reader-temp" style="display: none;"></div>

    <v-card width="100%" elevation="2" rounded="xl" :color="isDarkMode ? '#1e1e2d' : undefined" class="mb-6">
      <!-- Header -->
      <v-card-title class="d-flex flex-column flex-lg-row align-lg-center justify-space-between pa-6" style="white-space: normal;">
        <div class="d-flex align-center gap-4">
          <v-avatar size="64" rounded="lg" color="primary" variant="tonal" class="mr-4">
            <Users class="w-8 h-8" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1" :class="isDarkMode ? 'text-white' : 'text-slate-900'">Quản Lý Nhân Viên</h2>
            <div class="text-subtitle-2" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">Quản lý hồ sơ, chức vụ và tài khoản đăng nhập nội bộ</div>
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-lg-0 flex-wrap">
          <v-btn color="warning" variant="tonal" height="48" rounded="lg" @click="showThongKeModal = true">
            <Award class="w-5 h-5 mr-2" />
            Bảng xếp hạng
          </v-btn>
          <v-btn color="info" variant="tonal" height="48" rounded="lg" @click="openScannerModal">
            <Camera class="w-5 h-5 mr-2" />
            Quét CCCD (Ảnh)
          </v-btn>
          <v-btn color="primary" variant="flat" height="48" rounded="lg" @click="openAddForm">
            <Plus class="w-5 h-5 mr-2" />
            Thêm thủ công
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Filters -->
      <v-card-text class="pa-6 pb-2">
        <v-row>
          <v-col cols="12" md="6" lg="3">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">TÌM KIẾM NHÂN VIÊN</div>
            <v-text-field
              v-model="searchQuery"
              @keyup.enter="fetchNhanViens"
              placeholder="Tên, mã NV, SĐT, CCCD..."
              density="comfortable"
              variant="outlined"
              hide-details
              rounded="lg"
              clearable
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey" />
              </template>
            </v-text-field>
          </v-col>

          <v-col cols="12" md="6" lg="3">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">TRẠNG THÁI</div>
            <v-select
              v-model="filterTrangThai"
              @update:modelValue="fetchNhanViens"
              :items="[{ title: 'Tất cả trạng thái', value: '' }, { title: 'Đang làm việc', value: '1' }, { title: 'Đã nghỉ', value: '0' }]"
              item-title="title"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
              rounded="lg"
            ></v-select>
          </v-col>

          <v-col cols="12" md="6" lg="3">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">GIỚI TÍNH</div>
            <v-select
              v-model="filterGioiTinh"
              @update:modelValue="fetchNhanViens"
              :items="[{ title: 'Tất cả giới tính', value: '' }, { title: 'Nam', value: 'Nam' }, { title: 'Nữ', value: 'Nữ' }]"
              item-title="title"
              item-value="value"
              density="comfortable"
              variant="outlined"
              hide-details
              rounded="lg"
            ></v-select>
          </v-col>

          <v-col cols="12" md="6" lg="3" class="d-flex align-end">
            <v-btn color="primary" variant="flat" height="48" width="100%" rounded="lg" @click="fetchNhanViens">
              <Filter class="w-5 h-5 mr-2" />
              Lọc Dữ Liệu
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <v-card width="100%" elevation="2" rounded="xl" :color="isDarkMode ? '#1e1e2d' : undefined">
      <!-- Loading Indicator -->
      <div v-if="loading" class="d-flex flex-column align-center justify-center py-12">
        <v-progress-circular indeterminate color="primary" size="40" class="mb-3"></v-progress-circular>
        <div class="text-caption font-weight-bold text-primary text-uppercase">Đang đồng bộ nạp danh sách nhân viên hệ thống...</div>
      </div>

      <!-- Data Table -->
      <v-table v-else hover class="border-top overflow-hidden" :class="isDarkMode ? 'bg-[#1e1e2d]' : ''">
        <thead :class="isDarkMode ? 'bg-[#252536]' : 'bg-slate-50 border-b border-slate-200'">
          <tr>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Nhân viên</th>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Nội bộ & Tài khoản</th>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Liên hệ & Định danh</th>
            <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Trạng thái</th>
            <th class="text-center py-4 px-4 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="nv in pagedNhanViens" :key="nv.maNv">
            <td class="py-4 px-6">
              <div class="d-flex align-center gap-3">
                <v-avatar size="44" :image="nv.hinhAnh ? toAbsUrl(nv.hinhAnh) : undefined" :color="!nv.hinhAnh ? 'primary' : undefined">
                  <span v-if="!nv.hinhAnh" class="text-h6 text-white">{{ nv.hoTenNv?.charAt(0).toUpperCase() || '?' }}</span>
                </v-avatar>
                <div class="d-flex flex-column">
                  <span class="font-weight-bold text-body-2" :class="isDarkMode ? 'text-white' : 'text-slate-900'">{{ nv.hoTenNv }}</span>
                  <span class="text-caption font-weight-bold text-primary">Mã: {{ nv.maNv }}</span>
                  <v-chip size="x-small" color="info" variant="tonal" class="mt-1 font-weight-bold" style="width: fit-content">{{ nv.tenChucVu }}</v-chip>
                </div>
              </div>
            </td>
            <td class="py-4 px-6">
              <div class="font-weight-bold text-body-2" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">
                {{ nv.tenDangNhap || '-- Chưa cấp TK --' }}
              </div>
              <div v-if="nv.ngayVaoLam" class="text-caption mt-1 d-flex align-center gap-1" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
                <Calendar class="w-4 h-4 text-primary" />
                <span>Ngày làm: {{ formatDate(nv.ngayVaoLam) }}</span>
              </div>
            </td>
            <td class="py-4 px-6">
              <div class="font-weight-bold text-body-2 d-flex align-center gap-1" :class="isDarkMode ? 'text-slate-200' : 'text-slate-900'">
                <Phone class="w-4 h-4 text-primary" />
                <span>{{ nv.sdt }}</span>
              </div>
              <div v-if="nv.cccd" class="text-caption mt-1" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
                CCCD: <span class="font-weight-bold">{{ nv.cccd }}</span> - SN: <span class="font-weight-bold">{{ nv.namSinh }}</span>
              </div>
              <div v-if="nv.diaChi" class="text-caption mt-1 d-flex align-start gap-1" style="max-width: 250px" :title="nv.diaChi" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
                <MapPin class="w-4 h-4 text-primary mt-1" />
                <span class="text-truncate">{{ nv.diaChi }}</span>
              </div>
            </td>
            <td class="text-center py-4 px-6">
              <v-chip size="small" :color="nv.trangThai === 1 ? 'success' : 'error'" variant="tonal" class="font-weight-bold">
                {{ nv.trangThai === 1 ? 'Đang làm việc' : 'Đã nghỉ' }}
              </v-chip>
            </td>
            <td class="text-center py-4 px-4">
              <div class="d-flex align-center justify-center gap-2">
                <v-btn icon size="small" variant="outlined" color="warning" @click="openReviewModal(nv)" title="Xem đánh giá">
                  <Eye class="w-4 h-4" />
                </v-btn>
                <v-btn icon size="small" variant="outlined" color="info" @click="openEditForm(nv)" title="Sửa thông tin">
                  <Edit3 class="w-4 h-4" />
                </v-btn>
                <v-btn icon size="small" variant="outlined" color="error" @click="deleteNhanVien(nv.maNv)" title="Xóa nhân viên">
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </div>
            </td>
          </tr>
          <tr v-if="nhanViens.length === 0">
            <td colspan="5" class="text-center py-12">
              <Users class="w-10 h-10 mx-auto mb-3 opacity-30 text-medium-emphasis" />
              <div class="text-body-2 font-weight-bold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Không tìm thấy dữ liệu nhân viên</div>
              <div class="text-caption" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">Không có nhân viên nào trùng khớp với bộ lọc tìm kiếm.</div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination Controls -->
      <div v-if="totalPages > 1" class="d-flex flex-column flex-sm-row align-center justify-space-between pa-4 border-t">
        <div class="text-caption font-weight-bold mb-3 mb-sm-0" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
          Hiển thị trang <span class="text-primary">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ nhanViens.length }} nhân viên)
        </div>
        <div class="d-flex align-center gap-1">
          <v-btn variant="outlined" size="small" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">Trước</v-btn>
          <div class="d-flex gap-1 mx-2">
            <v-btn 
              v-for="p in visiblePages" 
              :key="p" 
              :color="currentPage === p ? 'primary' : undefined"
              :variant="currentPage === p ? 'flat' : 'outlined'"
              size="small"
              class="min-w-0 px-2"
              @click="changePage(p)"
            >
              {{ p }}
            </v-btn>
          </div>
          <v-btn variant="outlined" size="small" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">Sau</v-btn>
        </div>
      </div>
    </v-card>
  </v-container>

  <!-- Modals -->
  <v-dialog v-model="showScanner" max-width="500" persistent>
    <v-card rounded="xl" :color="isDarkMode ? '#1b1b28' : undefined">
      <v-card-title class="d-flex align-center justify-space-between pa-6 pb-4 border-b">
        <span class="text-h6 font-weight-bold" :class="isDarkMode ? 'text-white' : 'text-slate-900'">Quét Thông Tin CCCD</span>
        <v-btn icon variant="text" size="small" @click="closeScannerModal">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>
      <v-card-text class="pa-6 text-center">
        <p class="text-body-2 mb-4" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
          Tải lên hình ảnh mặt trước của CCCD để hệ thống tự động trích xuất thông tin nhân viên.
        </p>
        
        <v-alert type="warning" variant="tonal" class="text-left text-caption mb-6">
          <strong>⚠️ QUAN TRỌNG:</strong> Ảnh chụp CCCD phải nằm ngang và không bị lóa sáng.
        </v-alert>

        <v-btn color="primary" height="48" block rounded="lg" class="position-relative overflow-hidden">
          <Camera class="w-5 h-5 mr-2" /> Chọn ảnh / Chụp ảnh CCCD
          <input type="file" accept="image/*" @change="processIdCardImage" class="position-absolute opacity-0 w-100 h-100" style="cursor: pointer; left: 0; top: 0;">
        </v-btn>

        <div v-if="isScanning" class="mt-6 d-flex flex-column align-center">
          <v-progress-circular indeterminate color="primary" size="32" class="mb-2"></v-progress-circular>
          <div class="text-caption font-weight-bold text-primary">{{ scanProgress }}</div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Review Modal -->
  <v-dialog v-model="showReviewModal" max-width="1000" scrollable>
    <v-card rounded="xl" :color="isDarkMode ? '#1b1b28' : undefined" height="80vh">
      <v-card-title class="d-flex align-center justify-space-between pa-6 border-b" :class="isDarkMode ? 'bg-[#242436]' : 'bg-slate-50'">
        <div class="d-flex align-center gap-4">
          <v-avatar color="warning" variant="tonal" rounded="lg" size="56">
            <Award class="w-7 h-7" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold" :class="isDarkMode ? 'text-white' : 'text-slate-900'">Đánh Giá Khách Hàng</h3>
            <div class="text-caption mt-1" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
              Đánh giá của khách hàng cho: 
              <v-chip size="small" color="info" class="font-weight-bold ml-1">{{ selectedNvName }}</v-chip>
            </div>
          </div>
        </div>
        <v-btn icon variant="outlined" size="small" @click="closeReviewModal">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>
      <v-card-text class="pa-0">
        <div v-if="loadingReviews" class="d-flex flex-column align-center justify-center h-100 py-12">
          <v-progress-circular indeterminate color="primary" class="mb-3"></v-progress-circular>
          <span class="text-caption font-weight-bold text-primary">Đang nạp dữ liệu đánh giá...</span>
        </div>
        <div v-else-if="reviewsList.length === 0" class="d-flex align-center justify-center h-100 text-body-2 font-italic py-12" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
          Nhân viên này chưa có phản hồi đánh giá nào từ khách hàng.
        </div>
        <v-table v-else hover class="h-100 border-top" :class="isDarkMode ? 'bg-[#1b1b28]' : ''">
          <thead :class="isDarkMode ? 'bg-[#1e1e2d]' : 'bg-slate-900'">
            <tr>
              <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-white'">STT</th>
              <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-white'">ĐIỂM ĐÁNH GIÁ</th>
              <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-white'">NỘI DUNG LỜI BÌNH</th>
              <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-white'">LOẠI DỊCH VỤ</th>
              <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-white'">TRẠNG THÁI</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(review, index) in reviewsList" :key="index">
              <td class="text-center py-4">
                <v-avatar size="32" variant="outlined" color="primary" class="text-caption font-weight-bold">{{ index + 1 }}</v-avatar>
              </td>
              <td class="text-center py-4">
                <v-chip color="warning" variant="outlined" class="font-weight-bold px-4">
                  {{ review.diem || review.soSao || 5 }}.0
                  ⭐
                </v-chip>
              </td>
              <td class="py-4">
                <div class="text-body-2 font-italic font-weight-medium" :class="isDarkMode ? 'text-slate-200' : 'text-slate-900'">
                  "{{ review.noiDung || review.binhLuan || 'Khách hàng không để lại bình luận chi tiết.' }}"
                </div>
              </td>
              <td class="text-center py-4">
                <v-chip size="small" variant="tonal" class="font-weight-bold">Dịch vụ Salon</v-chip>
              </td>
              <td class="text-center py-4">
                <v-chip size="small" color="success" variant="flat" class="font-weight-bold text-caption">ĐÃ XÁC MINH</v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Add/Edit Form Modal -->
  <v-dialog v-model="showModal" max-width="900" scrollable persistent>
    <v-card rounded="xl" :color="isDarkMode ? '#1b1b28' : undefined">
      <v-card-title class="d-flex align-center justify-space-between pa-6 border-b" :class="isDarkMode ? 'bg-[#242436]' : 'bg-slate-50'">
        <div class="d-flex align-center gap-4">
          <v-avatar color="info" variant="tonal" rounded="lg" size="48">
            <Users class="w-6 h-6" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
              {{ isEditMode ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới' }}
            </h3>
            <div class="text-caption mt-1" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
              {{ isEditMode ? 'Sửa thông tin hồ sơ, chức vụ và tài khoản nhân viên' : 'Nhập đầy đủ thông tin để cấp tài khoản nhân viên mới' }}
            </div>
          </div>
        </div>
        <v-btn icon variant="text" size="small" @click="closeModal">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>
      
      <v-card-text class="pa-6">
        <v-form @submit.prevent="saveNhanVien" id="nhanVienForm">
          <v-row>
            <!-- Avatar Upload -->
            <v-col cols="12" md="4" lg="3" class="d-flex flex-column align-center gap-4">
              <v-avatar size="140" rounded="circle" class="elevation-3 border" :color="!imagePreviewUrl ? (isDarkMode ? 'grey-darken-3' : 'grey-lighten-3') : undefined">
                <v-img v-if="imagePreviewUrl" :src="imagePreviewUrl" cover></v-img>
                <span v-else class="text-caption font-weight-bold text-medium-emphasis">Chưa có ảnh</span>
              </v-avatar>
              <v-btn variant="outlined" color="primary" class="position-relative" rounded="lg">
                Chọn ảnh đại diện
                <input type="file" accept="image/*" @change="handleImageUpload" class="position-absolute opacity-0 w-100 h-100" style="cursor: pointer; left: 0; top: 0;">
              </v-btn>
            </v-col>

            <!-- Form Fields -->
            <v-col cols="12" md="8" lg="9">
              <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Thông Tin Cá Nhân</div>
              <v-row>
                <v-col cols="12" sm="8">
                  <v-text-field v-model="formData.hoTenNv" label="Họ Tên *" :error-messages="errors.hoTenNv" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="4">
                  <v-select v-model="formData.gioiTinh" :items="['Nam', 'Nữ']" label="Giới tính" variant="outlined" density="comfortable" rounded="lg"></v-select>
                </v-col>
                <v-col cols="12" sm="4">
                  <v-text-field v-model="formData.namSinh" type="number" label="Năm sinh *" :error-messages="errors.namSinh" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="8">
                  <v-text-field v-model="formData.cccd" label="Số CCCD" :error-messages="errors.cccd" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.sdt" label="Số Điện Thoại *" :error-messages="errors.sdt" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.email" label="Email" type="email" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12">
                  <v-text-field v-model="formData.diaChi" label="Địa chỉ thường trú" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
              </v-row>

              <v-divider class="my-4"></v-divider>
              <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Thông Tin Công Việc</div>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.maNv" label="Mã NV *" :disabled="isEditMode" :error-messages="errors.maNv" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select v-model="formData.maRole" :items="roles" :item-title="item => item.tenChucVu || item.TenChucVu" :item-value="item => item.maRole || item.MaRole" label="Chức vụ" variant="outlined" density="comfortable" rounded="lg"></v-select>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select v-model="formData.maLoaiNv" :items="loaiNvs" :item-title="item => item.tenLoai || item.TenLoai" :item-value="item => item.maLoaiNv || item.MaLoaiNv" label="Phân loại NV" variant="outlined" density="comfortable" rounded="lg"></v-select>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field :model-value="formatVND(currentLoaiLuong)" label="Lương cơ bản" readonly disabled variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.ngayVaoLam" type="date" label="Ngày vào làm" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-select v-model="formData.trangThai" :items="[{title:'Đang làm việc', value: 1}, {title:'Đã nghỉ', value: 0}]" item-title="title" item-value="value" label="Trạng thái công việc" variant="outlined" density="comfortable" rounded="lg"></v-select>
                </v-col>
              </v-row>

              <v-divider class="my-4"></v-divider>
              <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Tài Khoản Đăng Nhập</div>
              <v-row>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.tenDangNhap" label="Tên đăng nhập" :error-messages="errors.tenDangNhap" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" sm="6">
                  <v-text-field v-model="formData.matKhau" type="password" :label="isEditMode ? 'Mật khẩu mới (Bỏ trống nếu giữ nguyên)' : 'Mật khẩu đăng nhập'" :error-messages="errors.matKhau" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
                <v-col cols="12" v-if="isEditMode">
                  <v-text-field v-model="formData.matKhauCu" type="password" label="Mật khẩu cũ (Yêu cầu khi đổi mật khẩu mới)" :error-messages="errors.matKhauCu" variant="outlined" density="comfortable" rounded="lg"></v-text-field>
                </v-col>
              </v-row>
            </v-col>
          </v-row>
        </v-form>
      </v-card-text>
      
      <v-card-actions class="pa-4 pt-0 border-t" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
        <v-spacer></v-spacer>
        <v-btn variant="outlined" color="secondary" size="large" rounded="lg" class="mr-3" @click="closeModal">Hủy bỏ</v-btn>
        <v-btn variant="flat" color="primary" size="large" rounded="lg" type="submit" form="nhanVienForm">Lưu thông tin</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- Leaderboard Modal -->
  <ThongKeNhanVienModal :isOpen="showThongKeModal" @close="showThongKeModal = false" />
</template>

<style scoped>
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}
</style>

<style>
.swal2-container {
  z-index: 3000 !important;
}
</style>
