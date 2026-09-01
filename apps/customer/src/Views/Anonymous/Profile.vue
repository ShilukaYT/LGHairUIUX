<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import {
  User,
  Package,
  Calendar,
  LogOut,
  Camera,
  Lock,
  Award,
  Loader2,
  Sparkles,
  TrendingUp,
  Star,
  ShieldAlert,
  CheckCircle2,
  Crown,
  Gem,
  Shield,
  X,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  Check
} from 'lucide-vue-next';
import axios from 'axios';
import { useRouter, useRoute } from 'vue-router';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/useAuthStore';

// @ts-ignore
import LichSuDanhGia from './Profile/lichsudanhgia.vue';
// @ts-ignore
import LichSuDanhGiaSanPham from './Profile/lichsudanhgiasanpham.vue';
// @ts-ignore
import LichSuHoaDon from './Profile/LichSuHoaDon.vue';
// @ts-ignore
import LichSuDonHangSanPham from './Profile/LichSuDonHangSanPham.vue';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const activeTab = ref('profile');
const reviewSubTab = ref('services_staff');

// Tự động đồng bộ tab từ URL query (?tab=orders / ?tab=appointments ...)
watch(
  () => route.query.tab,
  (newTab) => {
    if (newTab && typeof newTab === 'string') {
      activeTab.value = newTab;
    } else {
      activeTab.value = 'profile';
    }
  },
  { immediate: true }
);

const changeTab = (tab: string) => {
  activeTab.value = tab;
  if (tab === 'profile') {
    if (route.query.tab) {
      router.push({ name: 'profile' });
    }
  } else {
    if (route.query.tab !== tab) {
      router.push({ name: 'profile', query: { tab } });
    }
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';

// Loading states
const isPageLoading = ref(true);
const isSavingProfile = ref(false);
const isUploadingAvatar = ref(false);

// Local User Info fallback
const customerInfo = ref<any>(null);

// Profile state from server /api/Profile/me
interface ProfileData {
  hoTen: string;
  email: string;
  sdt: string;
  hinhAnh: string | null;
  gioiTinh: string | null;
  diemTichLuy: number;
  tongTienDaChi: number;
  tenRank: string;
  isGoogleAccount?: boolean;
  hasPassword?: boolean;
}

const profileData = ref<ProfileData | null>(null);

// Form Fields (Mockup layout has separate Họ and Tên fields)
const lastNameInput = ref('');
const firstNameInput = ref('');
const newPasswordInput = ref('');

const profileForm = ref({
  email: '',
  sdt: '',
  gioiTinh: 'Nam'
});

// Password verification modal state
const showPasswordVerifyModal = ref(false);
const verifyMethod = ref<'google' | 'password'>('google');
const oldPasswordInput = ref('');
const showOldPassword = ref(false);
const showNewPassword = ref(false);
const isVerifyingPassword = ref(false);
const newPasswordPending = ref('');

// Ranks List
interface RankItem {
  maRank: string;
  tenRank: string;
  diemToiThieu: number;
  phanTramGiamGia: number;
}
const ranksList = ref<RankItem[]>([]);

// Hidden file input ref for avatar selection
const fileInputRef = ref<HTMLInputElement | null>(null);

// Helper for auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Formats prices to VND
const formatPrice = (price?: number | null) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

// Computed properties for progress and ranks
const currentRankInfo = computed(() => {
  if (!ranksList.value.length || !profileData.value) return null;
  return ranksList.value.find(r => r.tenRank.trim().toLowerCase() === profileData.value?.tenRank.trim().toLowerCase()) || null;
});

const nextRankInfo = computed(() => {
  if (!ranksList.value.length || !profileData.value) return null;
  const currentPoints = profileData.value.diemTichLuy || 0;
  // Sort ascending and find the first rank with points higher than current
  const sorted = [...ranksList.value].sort((a, b) => a.diemToiThieu - b.diemToiThieu);
  return sorted.find(r => r.diemToiThieu > currentPoints) || null;
});

const rankProgress = computed(() => {
  if (!profileData.value || !ranksList.value.length) return 0;
  const currentPoints = profileData.value.diemTichLuy || 0;

  if (!nextRankInfo.value) {
    return 100; // max rank reached
  }

  const minPointsCurrent = currentRankInfo.value ? currentRankInfo.value.diemToiThieu : 0;
  const minPointsNext = nextRankInfo.value.diemToiThieu;

  if (minPointsNext <= minPointsCurrent) return 100;

  const progress = ((currentPoints - minPointsCurrent) / (minPointsNext - minPointsCurrent)) * 100;
  return Math.min(Math.max(progress, 0), 100);
});

const pointsToNextRank = computed(() => {
  if (!profileData.value || !nextRankInfo.value) return 0;
  const currentPoints = profileData.value.diemTichLuy || 0;
  return Math.max(nextRankInfo.value.diemToiThieu - currentPoints, 0);
});

const moneyToNextRank = computed(() => {
  return pointsToNextRank.value * 10000;
});

const rankKey = computed(() => {
  const rank = profileData.value?.tenRank?.toLowerCase().trim() || '';
  if (rank.includes('kim cương') || rank.includes('diamond')) return 'kimcuong';
  if (rank.includes('vàng') || rank.includes('gold')) return 'vang';
  if (rank.includes('bạc') || rank.includes('silver')) return 'bac';
  return 'dong'; // default to Đồng
});

const topCardClass = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') {
    return 'bg-gradient-to-tr from-[#bae6fd] via-[#7dd3fc] to-[#e0f2fe] border-[#7dd3fc]/30 text-[#0369a1]';
  }
  if (key === 'vang') {
    return 'bg-gradient-to-tr from-[#f59e0b] via-[#b45309] to-[#fcd34d] border-[#b45309]/40 text-white';
  }
  if (key === 'bac') {
    return 'bg-gradient-to-tr from-[#94a3b8] via-[#475569] to-[#cbd5e1] border-[#475569]/40 text-white';
  }
  // dong
  return 'bg-gradient-to-tr from-[#a16238] via-[#7c3f1a] to-[#b46d3e] border-[#7c3f1a]/40 text-white';
});

const topCardBadgeClass = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') {
    return 'bg-black/10 text-[#0369a1]';
  }
  return 'bg-white/10 text-white';
});

const sidebarBadgeClass = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') return 'bg-[#0284c7] text-white';
  if (key === 'vang') return 'bg-[#b45309] text-white';
  if (key === 'bac') return 'bg-slate-600 text-white';
  return 'bg-[#5c381c] text-white'; // đồng
});

const topCardPatternClass = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') {
    return 'absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.15)_25%,transparent_25%),linear-gradient(-45deg,rgba(255,255,255,0.15)_25%,transparent_25%),linear-gradient(135deg,rgba(255,255,255,0.15)_25%,transparent_25%),linear-gradient(-135deg,rgba(255,255,255,0.15)_25%,transparent_25%)] bg-[size:30px_30px] opacity-40 pointer-events-none';
  }
  if (key === 'vang') {
    return 'absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] bg-[size:10px_10px] opacity-35 pointer-events-none';
  }
  if (key === 'bac') {
    return 'absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.2)_1.5px,transparent_1.5px)] bg-[size:16px_16px] opacity-55 pointer-events-none';
  }
  return 'absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.1)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.1)_50%,rgba(255,255,255,0.1)_75%,transparent_75%,transparent)] bg-[size:24px_24px] opacity-45 pointer-events-none';
});

const rankIcon = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') return Gem;
  if (key === 'vang') return Crown;
  if (key === 'bac') return Shield;
  return Award;
});

const isRankUnlocked = (rankName: string) => {
  if (!profileData.value) return false;
  const normalized = rankName.toLowerCase().trim();
  const currentPoints = profileData.value.diemTichLuy || 0;
  if (normalized.includes('đồng') || normalized.includes('bronze')) return true;
  if (normalized.includes('bạc') || normalized.includes('silver')) return currentPoints >= 1000;
  if (normalized.includes('vàng') || normalized.includes('gold')) return currentPoints >= 5000;
  if (normalized.includes('kim cương') || normalized.includes('diamond')) return currentPoints >= 10000;
  return false;
};

const isRankActive = (rankName: string) => {
  if (!profileData.value) return false;
  const normalized = rankName.toLowerCase().trim();
  const currentRank = profileData.value.tenRank?.toLowerCase().trim() || '';
  return currentRank.includes(normalized);
};

const getRankCardClass = (rankName: string) => {
  const normalized = rankName.toLowerCase().trim();
  const unlocked = isRankUnlocked(normalized);

  if (normalized.includes('đồng') || normalized.includes('bronze')) {
    return 'bg-gradient-to-tr from-[#5c381c] via-[#462812] to-[#341d0b] border-orange-950/20 text-white';
  }

  if (normalized.includes('bạc') || normalized.includes('silver')) {
    return unlocked
      ? 'bg-gradient-to-tr from-[#475569] via-[#334155] to-[#1e293b] border-slate-600 text-white'
      : 'bg-[#ebf0f5] border-slate-200/80 text-slate-700';
  }

  if (normalized.includes('vàng') || normalized.includes('gold')) {
    return unlocked
      ? 'bg-gradient-to-tr from-[#b45309] via-[#78350f] to-[#451a03] border-amber-700 text-white'
      : 'bg-[#fffbeb] border-amber-200/60 text-amber-900';
  }

  if (normalized.includes('kim cương') || normalized.includes('diamond')) {
    return unlocked
      ? 'bg-gradient-to-tr from-[#0284c7] via-[#0369a1] to-[#0f172a] border-sky-600 text-white'
      : 'bg-[#f0f9ff] border-sky-200/60 text-sky-950';
  }

  return 'bg-gray-50 border-gray-200 text-gray-700';
};

const avatarUrl = computed(() => {
  if (profileData.value?.hinhAnh) {
    const path = profileData.value.hinhAnh;
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
    return `${API_BASE_URL}/${path}`;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.value?.hoTen || 'User')}&background=1a1a1a&color=fff&size=128`;
});

// Load ranks lists
const fetchRanks = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/Profile/ranks`, {
      headers: getAuthHeaders()
    });
    if (res.data && res.data.success) {
      ranksList.value = res.data.data || [];
    }
  } catch (error: any) {
    console.error("Lỗi khi lấy danh sách hạng thành viên:", error);
    if (error.response && error.response.status === 401) {
      forceLogout();
    }
  }
};

// Fetch profile data
const fetchProfileData = async () => {
  isPageLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/Profile/me`, {
      headers: getAuthHeaders()
    });
    if (res.data && res.data.success) {
      profileData.value = res.data.data;

      // Update form
      profileForm.value.email = profileData.value?.email || '';
      profileForm.value.sdt = profileData.value?.sdt || '';
      profileForm.value.gioiTinh = profileData.value?.gioiTinh || 'Nam';

      // Split Ho & Ten for mockup input representation
      const hoTenVal = profileData.value?.hoTen || '';
      const names = hoTenVal.trim().split(/\s+/);
      if (names.length > 1) {
        lastNameInput.value = names[0] || ''; // first word as Họ
        firstNameInput.value = names.slice(1).join(' ') || ''; // remaining as Tên
      } else {
        lastNameInput.value = '';
        firstNameInput.value = hoTenVal;
      }

      // Update local storage credentials
      if (profileData.value) {
        updateLocalStorageUser(profileData.value);
      }
    }
  } catch (error: any) {
    console.error("Lỗi khi tải thông tin cá nhân từ server:", error);
    if (error.response && error.response.status === 401) {
      Swal.fire({
        icon: 'error',
        title: 'Phiên đăng nhập hết hạn',
        text: 'Vui lòng đăng nhập lại.',
        confirmButtonColor: '#000'
      }).then(() => {
        forceLogout();
      });
      return;
    }
    const msg = error.response?.data?.message || "Không thể kết nối đến máy chủ để tải thông tin.";
    Swal.fire({
      icon: 'error',
      title: 'Lỗi tải dữ liệu',
      text: msg,
      confirmButtonColor: '#000'
    });
  } finally {
    isPageLoading.value = false;
  }
};

const updateLocalStorageUser = (data: ProfileData) => {
  const localUserStr = localStorage.getItem('user');
  if (localUserStr) {
    try {
      const userObj = JSON.parse(localUserStr);
      userObj.hoTen = data.hoTen;
      userObj.email = data.email;
      userObj.sdt = data.sdt;
      userObj.hinhAnh = data.hinhAnh;
      userObj.tenRank = data.tenRank;
      userObj.gioiTinh = data.gioiTinh;
      localStorage.setItem('user', JSON.stringify(userObj));
      // Dispatch events to trigger Header component updates
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new Event('user-updated'));
    } catch (e) {
      console.error(e);
    }
  }
};

onMounted(async () => {
  const info = getCustomerInfo();
  customerInfo.value = info;

  if (route.query.tab) {
    activeTab.value = route.query.tab as string;
  }

  if (info && info.maKH !== 'GUEST') {
    await fetchRanks();
    await fetchProfileData();
  } else {
    isPageLoading.value = false;
  }
});

// Save all changes (updates profile info and optionally updates password in one save action)
const handleSaveAllChanges = async () => {
  if (!firstNameInput.value.trim()) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập tên của bạn.', confirmButtonColor: '#000' });
    return;
  }
  if (!profileForm.value.sdt.trim()) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập số điện thoại.', confirmButtonColor: '#000' });
    return;
  }
  // Nếu người dùng xóa trống Email nhưng trong hệ thống đã có Email -> Tự động giữ nguyên Email cũ
  let submitEmail = profileForm.value.email?.trim() || '';
  if (!submitEmail && profileData.value?.email) {
    submitEmail = profileData.value.email.trim();
    profileForm.value.email = submitEmail;
  }

  // Regex validation
  const phoneRegex = /^[0-9]{10,11}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!phoneRegex.test(profileForm.value.sdt)) {
    Swal.fire({ icon: 'error', title: 'Lỗi định dạng', text: 'Số điện thoại không hợp lệ (phải từ 10-11 chữ số).', confirmButtonColor: '#000' });
    return;
  }
  if (submitEmail && !emailRegex.test(submitEmail)) {
    Swal.fire({ icon: 'error', title: 'Lỗi định dạng', text: 'Địa chỉ Email không đúng định dạng.', confirmButtonColor: '#000' });
    return;
  }

  const mergedHoTen = (lastNameInput.value.trim() + " " + firstNameInput.value.trim()).trim();

  isSavingProfile.value = true;
  try {
    // 1. Update basic profile info
    const updateRes = await axios.put(`${API_BASE_URL}/api/Profile/update`, {
      hoTen: mergedHoTen,
      sdt: profileForm.value.sdt,
      email: submitEmail,
      gioiTinh: profileForm.value.gioiTinh
    }, {
      headers: getAuthHeaders()
    });

    if (!updateRes.data || !updateRes.data.success) {
      throw new Error(updateRes.data?.message || 'Không thể cập nhật hồ sơ.');
    }

    // 2. Handle password change if filled
    if (newPasswordInput.value.trim() !== '') {
      const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
      if (!passwordRegex.test(newPasswordInput.value.trim())) {
        throw new Error('Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số.');
      }

      isSavingProfile.value = false;
      openPasswordVerifyModal();
      return;
    }

    Swal.fire({
      icon: 'success',
      title: 'Thành công!',
      text: 'Đã lưu thông tin cá nhân thành công.',
      timer: 1500,
      showConfirmButton: false
    });

    await fetchProfileData();
  } catch (error: any) {
    console.error(error);
    const serverMessage = error.response?.data?.message || error.message || "Lỗi hệ thống khi lưu thay đổi.";
    Swal.fire({
      icon: 'error',
      title: 'Có lỗi xảy ra',
      text: serverMessage,
      confirmButtonColor: '#000'
    });
  } finally {
    isSavingProfile.value = false;
  }
};

const openPasswordVerifyModal = () => {
  if (!newPasswordInput.value.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Chưa nhập mật khẩu mới',
      text: 'Vui lòng nhập mật khẩu mới cần đổi trước khi xác minh.',
      confirmButtonColor: '#000'
    });
    return;
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(newPasswordInput.value.trim())) {
    Swal.fire({
      icon: 'error',
      title: 'Mật khẩu không hợp lệ',
      text: 'Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số.',
      confirmButtonColor: '#000'
    });
    return;
  }

  newPasswordPending.value = newPasswordInput.value.trim();
  oldPasswordInput.value = '';
  // Nếu tài khoản tạo qua Google -> mặc định mở tab Google
  if (profileData.value?.isGoogleAccount) {
    verifyMethod.value = 'google';
  } else {
    verifyMethod.value = 'password';
  }

  showPasswordVerifyModal.value = true;
};

const closePasswordVerifyModal = () => {
  showPasswordVerifyModal.value = false;
  oldPasswordInput.value = '';
};

// Xác minh danh tính bằng Google OAuth để đổi mật khẩu
const handleGoogleVerifyForPassword = async (response: any) => {
  if (!response?.credential) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi xác thực',
      text: 'Không nhận được thông tin xác thực từ Google.',
      confirmButtonColor: '#000'
    });
    return;
  }

  isVerifyingPassword.value = true;
  try {
    const res = await axios.put(`${API_BASE_URL}/api/Profile/change-password`, {
      googleCredential: response.credential,
      newPassword: newPasswordPending.value
    }, {
      headers: getAuthHeaders()
    });

    if (res.data && res.data.success) {
      showPasswordVerifyModal.value = false;
      newPasswordInput.value = '';
      newPasswordPending.value = '';
      oldPasswordInput.value = '';
      Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: res.data.message || 'Xác minh Google thành công! Đã đổi mật khẩu mới.',
        confirmButtonColor: '#000'
      });
      await fetchProfileData();
    } else {
      throw new Error(res.data?.message || 'Không thể đổi mật khẩu qua Google.');
    }
  } catch (err: any) {
    console.error(err);
    const serverMessage = err.response?.data?.message || err.message || 'Xác minh Google thất bại.';
    Swal.fire({
      icon: 'error',
      title: 'Xác thực thất bại',
      text: serverMessage,
      confirmButtonColor: '#000'
    });
  } finally {
    isVerifyingPassword.value = false;
  }
};

// Xác minh bằng mật khẩu cũ thông thường
const handleOldPasswordVerifySubmit = async () => {
  if (!oldPasswordInput.value.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu thông tin',
      text: 'Vui lòng nhập mật khẩu hiện tại.',
      confirmButtonColor: '#000'
    });
    return;
  }

  isVerifyingPassword.value = true;
  try {
    const res = await axios.put(`${API_BASE_URL}/api/Profile/change-password`, {
      oldPassword: oldPasswordInput.value.trim(),
      newPassword: newPasswordPending.value
    }, {
      headers: getAuthHeaders()
    });

    if (res.data && res.data.success) {
      showPasswordVerifyModal.value = false;
      newPasswordInput.value = '';
      newPasswordPending.value = '';
      oldPasswordInput.value = '';
      Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: res.data.message || 'Đổi mật khẩu thành công!',
        confirmButtonColor: '#000'
      });
      await fetchProfileData();
    } else {
      throw new Error(res.data?.message || 'Mật khẩu cũ không chính xác.');
    }
  } catch (err: any) {
    console.error(err);
    const serverMessage = err.response?.data?.message || err.message || 'Đổi mật khẩu thất bại.';
    Swal.fire({
      icon: 'error',
      title: 'Đổi mật khẩu thất bại',
      text: serverMessage,
      confirmButtonColor: '#000'
    });
  } finally {
    isVerifyingPassword.value = false;
  }
};

// Trigger hidden file picker
const triggerAvatarUpload = () => {
  fileInputRef.value?.click();
};

// Avatar Upload
const handleAvatarChange = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (!target.files || target.files.length === 0) return;

  const file = target.files?.[0];
  if (!file) return;

  const allowedExtensions = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!allowedExtensions.includes(file.type)) {
    Swal.fire({
      icon: 'error',
      title: 'Định dạng file không hỗ trợ',
      text: 'Chỉ chấp nhận file ảnh định dạng .jpg, .jpeg, .png.',
      confirmButtonColor: '#000'
    });
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    Swal.fire({
      icon: 'error',
      title: 'File quá lớn',
      text: 'Vui lòng chọn ảnh dung lượng dưới 5MB.',
      confirmButtonColor: '#000'
    });
    return;
  }

  // Show image preview before changing/uploading the avatar
  const previewUrl = URL.createObjectURL(file);
  const confirmResult = await Swal.fire({
    title: 'Xác nhận đổi ảnh đại diện',
    text: 'Bạn có chắc chắn muốn cập nhật ảnh đại diện sang hình ảnh này không?',
    html: `
      <div class="flex flex-col items-center justify-center my-4">
        <img src="${previewUrl}" class="w-56 h-56 rounded-full object-cover border-2 border-gray-250 shadow-md mb-3" />
        <span class="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Xem trước ảnh đại diện</span>
      </div>
    `,
    showCancelButton: true,
    confirmButtonColor: '#000',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Đồng ý',
    cancelButtonText: 'Hủy'
  });

  // Clean up object URL to prevent memory leaks
  URL.revokeObjectURL(previewUrl);

  if (!confirmResult.isConfirmed) {
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  isUploadingAvatar.value = true;
  try {
    const res = await axios.post(`${API_BASE_URL}/api/Profile/upload-avatar`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    if (res.data && res.data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Thành công!',
        text: res.data.message || 'Cập nhật ảnh đại diện thành công.',
        timer: 1500,
        showConfirmButton: false
      });
      await fetchProfileData();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Thất bại',
        text: res.data?.message || 'Cập nhật ảnh đại diện thất bại.',
        confirmButtonColor: '#000'
      });
    }
  } catch (error: any) {
    console.error(error);
    const serverMessage = error.response?.data?.message || "Lỗi hệ thống khi cập nhật ảnh đại diện.";
    Swal.fire({
      icon: 'error',
      title: 'Lỗi tải ảnh lên',
      text: serverMessage,
      confirmButtonColor: '#000'
    });
  } finally {
    isUploadingAvatar.value = false;
    if (fileInputRef.value) {
      fileInputRef.value.value = '';
    }
  }
};

const forceLogout = async () => {
  try {
    const refreshToken = localStorage.getItem('refreshToken') || localStorage.getItem('refresh_token') || '';
    await axios.post(`${API_BASE_URL}/api/account/logout`, { refreshToken: refreshToken || undefined }, { withCredentials: true });
  } catch (err) {
    console.warn('Lỗi gọi API đăng xuất:', err);
  } finally {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    authStore.setSessionExpiredBanner(false);
    window.dispatchEvent(new Event('user-updated'));
    window.location.href = '/login';
  }
};

const handleLogout = () => {
  authStore.triggerLogoutConfirm(
    forceLogout,
    'Xác Nhận Đăng Xuất',
    'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?'
  );
};

const forceLogoutAll = async () => {
  try {
    await axios.post(`${API_BASE_URL}/api/account/logout-all`, {}, { withCredentials: true });
  } catch (err) {
    console.warn('Lỗi gọi API đăng xuất tất cả thiết bị:', err);
  } finally {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    authStore.setSessionExpiredBanner(false);
    window.dispatchEvent(new Event('user-updated'));
    window.location.href = '/login';
  }
};

const handleLogoutAll = () => {
  authStore.triggerLogoutConfirm(
    forceLogoutAll,
    'Đăng Xuất Mọi Thiết Bị',
    'Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị đang đăng nhập không? Tất cả các phiên làm việc trên trình duyệt và thiết bị khác sẽ kết thúc ngay lập tức.'
  );
};
</script>

<template>
  <div class="w-full bg-[#fcfcfc] min-h-screen py-8 lg:py-12 animate-in fade-in duration-500">
    <div class="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">


      <!-- Guest / Not logged in State -->
      <div v-if="!customerInfo || customerInfo.maKH === 'GUEST'"
        class="bg-white p-12 border border-gray-200 shadow-sm text-center py-20 rounded-sm">
        <ShieldAlert class="w-14 h-14 mx-auto text-gray-300 mb-6" :stroke-width="1.2" />
        <h3 class="font-heading text-lg uppercase tracking-widest mb-3 font-semibold text-black">Yêu Cầu Đăng Nhập</h3>
        <p class="text-xs tracking-widest text-gray-400 mb-8 max-w-sm mx-auto leading-relaxed">Vui lòng đăng nhập tài
          khoản của bạn để truy cập và quản lý hồ sơ cá nhân cũng như các đặc quyền thành viên.</p>
        <router-link to="/login"
          class="inline-block bg-black text-white px-8 py-3.5 text-[10px] uppercase tracking-[0.2em] hover:bg-gray-900 transition-all hover:shadow-md rounded-sm font-semibold">
          Đăng nhập ngay
        </router-link>
      </div>

      <!-- Logged In User Layout -->
      <div v-else class="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">

        <!-- Sidebar Navigation -->
        <aside class="w-full lg:w-56 shrink-0">
          <div class="mb-8 hidden lg:block">
            <h2 class="font-heading text-base uppercase tracking-widest text-black mb-1.5 font-bold truncate">
              {{ profileData?.hoTen || customerInfo?.hoTen || 'Khách Hàng' }}
            </h2>
            <div
              :class="['inline-flex items-center gap-1.5 px-3 py-1 text-[9px] uppercase tracking-widest font-semibold rounded-sm shadow-sm transition-colors duration-300', sidebarBadgeClass]">
              <Award :size="10" />
              <span>{{ profileData?.tenRank || 'Mới' }}</span>
            </div>
          </div>

          <!-- Mobile Profile Header -->
          <div class="mb-6 lg:hidden flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Xin chào</span>
              <h2 class="font-heading text-sm uppercase tracking-widest text-black font-bold">
                {{ profileData?.hoTen || customerInfo?.hoTen || 'Khách' }}
              </h2>
            </div>
            <div
              :class="['inline-flex items-center gap-1 px-2.5 py-1 text-[8px] uppercase tracking-widest font-semibold rounded-sm shadow-sm transition-colors duration-300', sidebarBadgeClass]">
              <Award :size="10" />
              <span>{{ profileData?.tenRank || 'Mới' }}</span>
            </div>
          </div>

          <!-- Vertical Nav Menu -->
          <nav
            class="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide whitespace-nowrap border-b border-gray-200 lg:border-b-0">
            <button @click="changeTab('profile')"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'profile' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <User :size="15" :stroke-width="1.8" />
              Hồ Sơ Của Tôi
            </button>
            <button @click="changeTab('orders')"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'orders' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Package :size="15" :stroke-width="1.8" />
              Lịch Sử Đơn Hàng
            </button>
            <button @click="changeTab('appointments')"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'appointments' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Calendar :size="15" :stroke-width="1.8" />
              Lịch Hẹn & Hóa Đơn
            </button>
            <button @click="changeTab('reviews')"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'reviews' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Star :size="15" :stroke-width="1.8" />
              Đánh Giá Của Tôi
            </button>

            <div class="w-px h-6 lg:w-full lg:h-px bg-gray-200 my-auto lg:my-3 shrink-0 mx-2 lg:mx-0"></div>

            <button @click="handleLogout"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest text-gray-700 hover:text-black hover:bg-gray-100 transition-colors border-l-2 border-transparent rounded-sm">
              <LogOut :size="15" :stroke-width="1.8" />
              Đăng Xuất
            </button>

            <button @click="handleLogoutAll"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors border-l-2 border-transparent rounded-sm">
              <ShieldAlert :size="15" :stroke-width="1.8" />
              Đăng Xuất Mọi Thiết Bị
            </button>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 min-w-0">

          <!-- Loading State Overlay -->
          <div v-if="isPageLoading"
            class="bg-white p-20 border border-gray-200 shadow-sm text-center py-32 flex flex-col items-center justify-center rounded-sm">
            <Loader2 class="w-10 h-10 animate-spin text-black mb-4" />
            <p class="text-xs uppercase tracking-widest text-gray-400 font-semibold">Đang tải hồ sơ thành viên...</p>
          </div>

          <div v-else>
            <!-- Tab: Profile (Hồ sơ của tôi) -->
            <div v-if="activeTab === 'profile'"
              class="bg-white p-6 lg:p-10 border border-gray-200 shadow-sm rounded-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

              <!-- Main Title Header -->
              <div class="border-b border-gray-150 pb-4 mb-2">
                <h1 class="font-heading text-sm uppercase tracking-[0.25em] font-extrabold text-black">Thông tin khách
                  hàng</h1>
              </div>

              <!-- GRID HEADER: 3 Columns like the mockup -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

                <!-- Box 1: Avatar -->
                <div
                  :class="['p-6 rounded-sm text-center border shadow-sm flex flex-col items-center justify-center relative min-h-[190px]', topCardClass]">
                  <div :class="topCardPatternClass"></div>

                  <div
                    class="relative group cursor-pointer w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-md mb-3 flex items-center justify-center bg-gray-100"
                    @click="triggerAvatarUpload">
                    <img :src="avatarUrl" alt="Avatar" class="w-full h-full object-cover" />
                    <div
                      class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                      <Camera class="w-5 h-5 mb-0.5" />
                      <span class="text-[7px] uppercase tracking-widest font-bold">Cập nhật</span>
                    </div>
                    <div v-if="isUploadingAvatar" class="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <Loader2 class="w-6 h-6 animate-spin text-white" />
                    </div>
                  </div>
                  <input type="file" ref="fileInputRef" class="hidden" accept=".jpg,.jpeg,.png"
                    @change="handleAvatarChange" />

                  <h3
                    :class="['font-heading text-sm uppercase tracking-widest font-bold mt-1 max-w-[200px] truncate', rankKey === 'kimcuong' ? 'text-[#0369a1]' : 'text-white']"
                    :title="profileData?.hoTen">
                    {{ profileData?.hoTen || 'Khách hàng' }}
                  </h3>
                  <div
                    :class="['mt-2 inline-flex items-center gap-1.5 px-4 py-1 text-[11px] uppercase tracking-widest font-extrabold rounded-full backdrop-blur-sm shadow-sm border border-white/10', topCardBadgeClass]">
                    <component :is="rankIcon" :size="12" class="shrink-0" />
                    <span>{{ profileData?.tenRank || 'Mới' }}</span>
                  </div>
                </div>

                <!-- Box 2: Points -->
                <div
                  class="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col justify-between min-h-[190px] relative">
                  <div
                    class="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.012)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none">
                  </div>
                  <div class="flex justify-between items-start">
                    <div>
                      <span class="text-[9px] uppercase tracking-widest text-gray-400 font-bold block">Điểm tích
                        lũy</span>
                      <div class="text-3xl font-extrabold text-black font-heading mt-2">
                        {{ profileData?.diemTichLuy || 0 }} <span
                          class="text-xs uppercase font-normal text-gray-500 tracking-wider">Điểm</span>
                      </div>
                      <p class="text-[8px] text-gray-400 font-bold uppercase tracking-wider mt-1.5">100.000đ = 10 điểm
                        (SP & Dịch vụ)</p>
                    </div>
                    <Award class="w-5 h-5 text-gray-300" />
                  </div>

                  <div class="flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                    <span class="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Tổng chi tiêu:</span>
                    <span class="text-sm font-bold text-[#b45309] font-mono">{{ formatPrice(profileData?.tongTienDaChi)
                      }}</span>
                  </div>
                </div>

                <!-- Box 3: Progress State -->
                <div
                  class="bg-white p-6 border border-gray-200 shadow-sm rounded-sm flex flex-col items-center justify-center min-h-[190px] relative text-center">
                  <div
                    class="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.012)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.012)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none">
                  </div>
                  <div class="absolute top-4 left-6 text-[9px] uppercase tracking-widest text-gray-400 font-bold">Tiến
                    trình thăng hạng</div>
                  <TrendingUp class="w-4 h-4 text-gray-300 absolute top-4 right-6" />

                  <!-- Highest member tier reached -->
                  <div v-if="!nextRankInfo" class="mt-4">
                    <div
                      class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-2 border border-emerald-100 shadow-sm">
                      <CheckCircle2 :size="20" class="text-emerald-500" />
                    </div>
                    <div class="text-[10px] uppercase tracking-widest font-bold text-emerald-600">Thành viên cao nhất
                    </div>
                    <p class="text-[9px] text-gray-400 max-w-[200px] mx-auto mt-1 leading-relaxed">Bạn đang giữ vị thế
                      hạng thành viên cao nhất tại LGHair!</p>
                  </div>

                  <!-- In progress -->
                  <div v-else class="mt-4 w-full">
                    <div class="relative w-12 h-12 mx-auto mb-2 flex items-center justify-center">
                      <svg class="w-full h-full transform -rotate-90">
                        <circle cx="24" cy="24" r="20" stroke="#f3f4f6" stroke-width="3" fill="transparent" />
                        <circle cx="24" cy="24" r="20" stroke="#d97706" stroke-width="3" fill="transparent"
                          :stroke-dasharray="2 * Math.PI * 20"
                          :stroke-dashoffset="2 * Math.PI * 20 * (1 - rankProgress / 100)" />
                      </svg>
                      <span class="absolute text-[10px] font-bold text-gray-700 font-mono">{{ Math.round(rankProgress)
                        }}%</span>
                    </div>
                    <div class="text-[9px] uppercase tracking-widest font-bold text-amber-700">Lên hạng {{
                      nextRankInfo.tenRank }}</div>
                    <p class="text-[8px] text-gray-400 mt-1">Cần tích lũy thêm {{ pointsToNextRank }} điểm</p>
                    <p class="text-[8px] text-gray-400 mt-0.5 font-semibold">Tương đương {{ formatPrice(moneyToNextRank)
                      }}</p>
                  </div>
                </div>
              </div>

              <!-- FORM CONTAINER -->
              <div class="pt-8 border-t border-gray-150">
                <form @submit.prevent="handleSaveAllChanges" class="space-y-6">

                  <!-- Họ and Tên splits inputs -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Họ</label>
                      <input v-model="lastNameInput" type="text" placeholder="Nhập họ..."
                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-sm text-black shadow-sm" />
                    </div>
                    <div>
                      <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Tên</label>
                      <input v-model="firstNameInput" type="text" placeholder="Nhập tên..." required
                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-sm text-black shadow-sm" />
                    </div>
                  </div>

                  <!-- Email & SĐT side-by-side -->
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label
                        class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Email</label>
                      <input v-model="profileForm.email" type="email" placeholder="email@example.com (không bắt buộc)"
                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-sm text-black shadow-sm" />
                    </div>
                    <div>
                      <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Số điện
                        thoại</label>
                      <input v-model="profileForm.sdt" type="tel" placeholder="03xxxxxxxx" required
                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-sm text-black shadow-sm" />
                    </div>
                  </div>

                  <!-- Gender selection horizontally -->
                  <div>
                    <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Giới
                      tính</label>
                    <div class="flex items-center gap-6">
                      <label v-for="g in ['Nam', 'Nữ', 'Khác']" :key="g"
                        class="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                        <input type="radio" :value="g" v-model="profileForm.gioiTinh"
                          class="w-4 h-4 text-black border-gray-300 focus:ring-black accent-black cursor-pointer" />
                        <span>{{ g }}</span>
                      </label>
                    </div>
                  </div>

                  <!-- Security Section -->
                  <div class="pt-8 border-t border-gray-150">
                    <div class="flex items-center justify-between mb-4">
                      <h3 class="font-heading text-xs uppercase tracking-widest text-black font-bold">Tài khoản & bảo
                        mật</h3>

                      <!-- Google account indicator -->
                      <div v-if="profileData?.isGoogleAccount"
                        class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[10.5px] font-medium rounded-full shadow-2xs">
                        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                          <path fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                        </svg>
                        <span>Đã liên kết với tài khoản Google</span>
                      </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-2">Tên đăng
                          nhập</label>
                        <input :value="profileForm.email || profileForm.sdt" type="text" readonly disabled
                          class="w-full bg-gray-50 border border-gray-200 outline-none px-4 py-3 text-xs rounded-sm text-gray-400 shadow-sm cursor-not-allowed" />
                        <span class="text-[8px] uppercase tracking-wider text-gray-400 block mt-1 font-semibold">Mặc
                          định dùng Email hoặc SĐT đăng nhập</span>
                      </div>
                      <div>
                        <div class="flex items-center justify-between mb-2">
                          <label class="block text-[9px] uppercase tracking-widest text-gray-500 font-bold">Mật khẩu
                            mới</label>
                          <button v-if="profileData?.isGoogleAccount && newPasswordInput.trim()" type="button"
                            @click="openPasswordVerifyModal"
                            class="text-[9px] uppercase tracking-widest text-amber-700 hover:text-black font-bold flex items-center gap-1 transition-colors">
                            <Sparkles :size="12" />
                            <span>Xác minh Google ngay</span>
                          </button>
                        </div>
                        <div class="relative">
                          <input :type="showNewPassword ? 'text' : 'password'" v-model="newPasswordInput"
                            placeholder="Bỏ trống nếu không đổi..."
                            class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 pr-10 text-xs transition-all rounded-sm text-black shadow-sm" />
                          <button type="button" @click="showNewPassword = !showNewPassword"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                            <Eye v-if="!showNewPassword" :size="14" />
                            <EyeOff v-else :size="14" />
                          </button>
                        </div>
                        <p v-if="profileData?.isGoogleAccount" class="text-[8px] text-gray-400 mt-1 font-medium">
                          Tài khoản đã liên kết Google: Bạn có thể đổi hoặc đặt mật khẩu mới dễ dàng bằng cách bấm nút
                          <strong>Xác minh Google</strong>.
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- Save Button -->
                  <div class="pt-6">
                    <button type="submit" :disabled="isSavingProfile"
                      class="bg-black text-white px-10 py-3.5 text-[10px] uppercase tracking-[0.2em] font-semibold transition-all hover:bg-gray-900 active:scale-[0.98] disabled:opacity-50 rounded-sm hover:shadow-md flex items-center justify-center gap-2">
                      <Loader2 v-if="isSavingProfile" class="w-3.5 h-3.5 animate-spin" />
                      Lưu thay đổi
                    </button>
                  </div>

                  <!-- Session & Device Management Section -->
                  <div class="pt-8 border-t border-gray-150">
                    <h3 class="font-heading text-xs uppercase tracking-widest text-black font-bold mb-2">Quản lý phiên
                      đăng nhập</h3>
                    <p class="text-xs text-gray-400 font-light mb-5">Bảo vệ tài khoản của bạn bằng cách đăng xuất khỏi
                      thiết bị này hoặc hủy bỏ phiên làm việc trên mọi thiết bị khác.</p>

                    <div class="flex flex-wrap gap-4">
                      <button type="button" @click="handleLogout"
                        class="bg-transparent border border-gray-300 text-gray-800 hover:border-black hover:text-black px-6 py-3 text-[10px] uppercase tracking-widest font-semibold transition-all hover:bg-gray-50 rounded-sm flex items-center gap-2">
                        <LogOut class="w-3.5 h-3.5" />
                        Đăng xuất thiết bị này
                      </button>

                      <button type="button" @click="handleLogoutAll"
                        class="bg-[#852121] text-white px-6 py-3 text-[10px] uppercase tracking-widest font-semibold transition-all hover:bg-[#6b1a1a] rounded-sm flex items-center gap-2 hover:shadow-md">
                        <ShieldAlert class="w-3.5 h-3.5" />
                        Đăng xuất trên mọi thiết bị
                      </button>
                    </div>
                  </div>
                </form>
              </div>

              <!-- MEMBERSHIP RANKS GRID SYSTEM -->
              <div class="pt-8 border-t border-gray-150">
                <h3 class="font-heading text-xs uppercase tracking-widest text-black font-bold mb-8">Bảng Hạng Thành
                  Viên</h3>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <!-- Rank Card 1: ĐỒNG -->
                  <div
                    :class="['relative rounded-sm p-6 flex flex-col justify-between min-h-[165px] border transition-all duration-300', getRankCardClass('đồng')]">
                    <div class="absolute inset-0 bg-white/[0.015] pointer-events-none"></div>
                    <div class="flex justify-between items-start">
                      <h4 class="font-heading text-xs uppercase tracking-widest font-bold text-white">Đồng</h4>
                      <Award class="w-4 h-4 text-amber-500/80" />
                    </div>

                    <div class="space-y-1.5 py-4">
                      <div class="flex justify-between text-xs text-white/80">
                        <span>Điểm tối thiểu:</span>
                        <span class="font-bold text-white">0 điểm</span>
                      </div>
                      <div class="flex justify-between text-xs text-white/80">
                        <span>Ưu đãi giảm giá:</span>
                        <span class="font-bold text-emerald-300">0%</span>
                      </div>
                    </div>

                    <div
                      class="border-t border-white/10 pt-3 flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-400">
                      <CheckCircle2 :size="12" class="text-emerald-400" />
                      <span v-if="isRankActive('đồng')">Hạng của bạn</span>
                      <span v-else>Bạn đã đạt hạng này</span>
                    </div>
                  </div>

                  <!-- Rank Card 2: BẠC -->
                  <div
                    :class="['relative rounded-sm p-6 overflow-hidden shadow-sm flex flex-col justify-between min-h-[165px] border transition-all duration-300', getRankCardClass('bạc')]">
                    <div class="absolute inset-0 bg-white/[0.01] pointer-events-none"></div>
                    <div class="flex justify-between items-start">
                      <h4
                        :class="['font-heading text-xs uppercase tracking-widest font-bold', isRankUnlocked('bạc') ? 'text-white' : 'text-slate-700']">
                        Bạc</h4>
                      <Award class="w-4 h-4" :class="isRankUnlocked('bạc') ? 'text-slate-200' : 'text-slate-400'" />
                    </div>

                    <div class="space-y-1.5 py-4">
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('bạc') ? 'text-white/80' : 'text-slate-500'">
                        <span>Điểm tối thiểu:</span>
                        <span :class="['font-bold', isRankUnlocked('bạc') ? 'text-white' : 'text-slate-800']">1000
                          điểm</span>
                      </div>
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('bạc') ? 'text-white/80' : 'text-slate-500'">
                        <span>Ưu đãi giảm giá:</span>
                        <span
                          :class="['font-bold', isRankUnlocked('bạc') ? 'text-emerald-300' : 'text-emerald-600']">5%</span>
                      </div>
                    </div>

                    <div class="border-t pt-3 flex items-center justify-between"
                      :class="isRankUnlocked('bạc') ? 'border-white/10' : 'border-slate-200/80'">
                      <div v-if="isRankActive('bạc')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-400">
                        <CheckCircle2 :size="12" class="text-emerald-400" />
                        <span>Hạng của bạn</span>
                      </div>
                      <div v-else-if="isRankUnlocked('bạc')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-300">
                        <CheckCircle2 :size="12" class="text-emerald-300" />
                        <span>Bạn đã đạt hạng này</span>
                      </div>
                      <div v-else class="flex flex-col gap-0.5">
                        <span
                          class="inline-flex items-center gap-1 text-[8px] uppercase tracking-widest font-bold text-red-500">
                          <Lock :size="9" /> Chưa đạt hạng
                        </span>
                        <span class="text-[8px] text-gray-400 uppercase tracking-widest font-bold">Cần chi thêm:
                          10.000.000đ</span>
                      </div>
                    </div>
                  </div>

                  <!-- Rank Card 3: VÀNG -->
                  <div
                    :class="['relative rounded-sm p-6 overflow-hidden shadow-sm flex flex-col justify-between min-h-[165px] border transition-all duration-300', getRankCardClass('vàng')]">
                    <div class="absolute inset-0 bg-white/[0.01] pointer-events-none"></div>
                    <div class="flex justify-between items-start">
                      <h4
                        :class="['font-heading text-xs uppercase tracking-widest font-bold', isRankUnlocked('vàng') ? 'text-white' : 'text-amber-800']">
                        Vàng</h4>
                      <Award class="w-4 h-4" :class="isRankUnlocked('vàng') ? 'text-amber-200' : 'text-amber-500'" />
                    </div>

                    <div class="space-y-1.5 py-4">
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('vàng') ? 'text-white/80' : 'text-amber-800/80'">
                        <span>Điểm tối thiểu:</span>
                        <span :class="['font-bold', isRankUnlocked('vàng') ? 'text-white' : 'text-amber-955']">5000
                          điểm</span>
                      </div>
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('vàng') ? 'text-white/80' : 'text-amber-800/80'">
                        <span>Ưu đãi giảm giá:</span>
                        <span
                          :class="['font-bold', isRankUnlocked('vàng') ? 'text-emerald-300' : 'text-emerald-600']">10%</span>
                      </div>
                    </div>

                    <div class="border-t pt-3 flex items-center justify-between"
                      :class="isRankUnlocked('vàng') ? 'border-white/10' : 'border-amber-200/80'">
                      <div v-if="isRankActive('vàng')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-400">
                        <CheckCircle2 :size="12" class="text-emerald-400" />
                        <span>Hạng của bạn</span>
                      </div>
                      <div v-else-if="isRankUnlocked('vàng')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-300">
                        <CheckCircle2 :size="12" class="text-emerald-300" />
                        <span>Bạn đã đạt hạng này</span>
                      </div>
                      <div v-else class="flex flex-col gap-0.5">
                        <span
                          class="inline-flex items-center gap-1 text-[8px] uppercase tracking-widest font-bold text-red-500">
                          <Lock :size="9" /> Chưa đạt hạng
                        </span>
                        <span class="text-[8px] text-gray-400 uppercase tracking-widest font-bold">Cần chi thêm:
                          50.000.000đ</span>
                      </div>
                    </div>
                  </div>

                  <!-- Rank Card 4: KIM CƯƠNG -->
                  <div
                    :class="['relative rounded-sm p-6 overflow-hidden shadow-sm flex flex-col justify-between min-h-[165px] border transition-all duration-300', getRankCardClass('kim cương')]">
                    <div class="absolute inset-0 bg-white/[0.01] pointer-events-none"></div>
                    <div class="flex justify-between items-start">
                      <h4
                        :class="['font-heading text-xs uppercase tracking-widest font-bold', isRankUnlocked('kim cương') ? 'text-white' : 'text-sky-800']">
                        Kim Cương</h4>
                      <Award class="w-4 h-4" :class="isRankUnlocked('kim cương') ? 'text-sky-200' : 'text-sky-400'" />
                    </div>

                    <div class="space-y-1.5 py-4">
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('kim cương') ? 'text-white/80' : 'text-sky-800/80'">
                        <span>Điểm tối thiểu:</span>
                        <span :class="['font-bold', isRankUnlocked('kim cương') ? 'text-white' : 'text-sky-950']">10000
                          điểm</span>
                      </div>
                      <div class="flex justify-between text-xs"
                        :class="isRankUnlocked('kim cương') ? 'text-white/80' : 'text-sky-800/80'">
                        <span>Ưu đãi giảm giá:</span>
                        <span
                          :class="['font-bold', isRankUnlocked('kim cương') ? 'text-emerald-300' : 'text-emerald-600']">15%</span>
                      </div>
                    </div>

                    <div class="border-t pt-3 flex items-center justify-between"
                      :class="isRankUnlocked('kim cương') ? 'border-white/10' : 'border-sky-200/85'">
                      <div v-if="isRankActive('kim cương')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-400">
                        <CheckCircle2 :size="12" class="text-emerald-400" />
                        <span>Hạng của bạn</span>
                      </div>
                      <div v-else-if="isRankUnlocked('kim cương')"
                        class="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-emerald-300">
                        <CheckCircle2 :size="12" class="text-emerald-300" />
                        <span>Bạn đã đạt hạng này</span>
                      </div>
                      <div v-else class="flex flex-col gap-0.5">
                        <span
                          class="inline-flex items-center gap-1 text-[8px] uppercase tracking-widest font-bold text-red-500">
                          <Lock :size="9" /> Chưa đạt hạng
                        </span>
                        <span class="text-[8px] text-gray-400 uppercase tracking-widest font-bold">Cần chi thêm:
                          100.000.000đ</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Tab: Orders (Lịch sử đơn hàng sản phẩm) -->
            <div v-else-if="activeTab === 'orders'">
              <div
                class="bg-white p-5 sm:p-7 lg:p-8 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
                <LichSuDonHangSanPham />
              </div>
            </div>

            <!-- Tab: Appointments (Lịch hẹn & Hóa đơn) -->
            <div v-else-if="activeTab === 'appointments'">
              <div
                class="bg-white p-5 sm:p-7 lg:p-8 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
                <LichSuHoaDon />
              </div>
            </div>

            <!-- Tab: Reviews (Đánh giá của tôi) -->
            <div v-else-if="activeTab === 'reviews'">
              <div
                class="bg-white p-5 sm:p-7 lg:p-8 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
                <div
                  class="mb-8 border-b border-gray-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 class="font-heading text-lg uppercase tracking-widest text-black mb-1 font-semibold">Đánh Giá
                      Của Tôi</h2>
                    <p class="text-xs text-gray-500">Xem và quản lý lịch sử đánh giá dịch vụ, nhân viên & sản phẩm của
                      bạn.</p>
                  </div>
                  <div
                    class="flex border border-gray-200 p-0.5 bg-gray-50/50 self-start sm:self-auto rounded-sm shrink-0">
                    <button @click="reviewSubTab = 'services_staff'"
                      :class="['text-[9px] uppercase tracking-widest px-4 py-2 transition-all font-semibold rounded-sm', reviewSubTab === 'services_staff' ? 'bg-black text-white' : 'text-gray-500 hover:text-black']">
                      Dịch vụ & Nhân viên
                    </button>
                    <button @click="reviewSubTab = 'products'"
                      :class="['text-[9px] uppercase tracking-widest px-4 py-2 transition-all font-semibold rounded-sm', reviewSubTab === 'products' ? 'bg-black text-white' : 'text-gray-500 hover:text-black']">
                      Sản phẩm
                    </button>
                  </div>
                </div>

                <LichSuDanhGia v-if="reviewSubTab === 'services_staff'" />
                <LichSuDanhGiaSanPham v-else />
              </div>
            </div>

          </div>

        </main>
      </div>

    </div>

    <!-- MODAL XÁC THỰC DANH TÍNH ĐỔI MẬT KHẨU (HỖ TRỢ GOOGLE VÀ MẬT KHẨU CŨ) -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="showPasswordVerifyModal"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          @click.self="closePasswordVerifyModal">
          <div
            class="bg-white w-full max-w-[480px] border border-gray-200 shadow-2xl relative overflow-hidden rounded-sm animate-in fade-in zoom-in-95 duration-200">
            <!-- Header -->
            <div class="bg-black px-6 py-5 text-white flex items-center justify-between relative">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20">
                  <KeyRound :size="18" class="text-amber-400" />
                </div>
                <div>
                  <h3 class="text-sm font-heading uppercase tracking-[0.15em] font-bold text-white">Xác thực đổi mật
                    khẩu</h3>
                  <p class="text-white/60 text-[10px] tracking-wide mt-0.5">Bảo vệ an toàn tài khoản của bạn</p>
                </div>
              </div>
              <button @click="closePasswordVerifyModal" class="text-white/70 hover:text-white transition-colors p-1">
                <X :size="18" />
              </button>
            </div>

            <!-- Body -->
            <div class="p-6">
              <div class="mb-5">
                <p class="text-xs text-gray-600 leading-relaxed font-light">
                  Bạn đang yêu cầu đặt mật khẩu mới cho tài khoản: <strong class="text-black font-semibold">{{
                    profileData?.email || profileData?.sdt }}</strong>
                </p>
              </div>

              <!-- Verification Method Selector -->
              <div class="flex border border-gray-200 p-1 bg-gray-50 rounded-sm mb-6">
                <!-- Tab 1: Google Verify (Khuyên dùng) -->
                <button type="button" @click="verifyMethod = 'google'" :class="[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-[10px] uppercase tracking-wider font-bold transition-all rounded-xs',
                  verifyMethod === 'google' ? 'bg-white text-black shadow-xs border border-gray-200' : 'text-gray-500 hover:text-black'
                ]">
                  <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Xác minh Google</span>
                </button>

                <!-- Tab 2: Mật khẩu cũ -->
                <button type="button" @click="verifyMethod = 'password'" :class="[
                  'flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-[10px] uppercase tracking-wider font-bold transition-all rounded-xs',
                  verifyMethod === 'password' ? 'bg-white text-black shadow-xs border border-gray-200' : 'text-gray-500 hover:text-black'
                ]">
                  <Lock :size="13" />
                  <span>Mật khẩu cũ</span>
                </button>
              </div>

              <!-- VIEW 1: XÁC MINH QUA GOOGLE (Cực kỳ tiện cho tài khoản Google) -->
              <div v-if="verifyMethod === 'google'" class="space-y-4 text-center py-2">
                <div class="bg-amber-50/60 border border-amber-200/80 p-4 rounded-sm text-left">
                  <div class="flex items-start gap-2.5">
                    <Sparkles :size="16" class="text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p class="text-[11px] text-amber-900 font-medium">Xác thực 1 chạm với Google</p>
                      <p class="text-[10px] text-amber-700 font-light mt-0.5 leading-relaxed">
                        Bạn chỉ cần bấm nút bên dưới và chọn đúng tài khoản Google <strong class="font-semibold">{{
                          profileData?.email }}</strong> để hệ thống xác nhận và đặt mật khẩu mới ngay.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="flex justify-center pt-2 pb-1 min-h-[44px]">
                  <GoogleLogin :callback="handleGoogleVerifyForPassword"
                    :button-config="{ width: 300, shape: 'rectangular', text: 'continue_with' }" />
                </div>

                <div v-if="isVerifyingPassword"
                  class="flex items-center justify-center gap-2 text-xs text-gray-500 pt-2">
                  <Loader2 class="w-4 h-4 animate-spin text-black" />
                  <span>Đang kiểm tra xác thực Google...</span>
                </div>
              </div>

              <!-- VIEW 2: XÁC MINH BẰNG MẬT KHẨU HIỆN TẠI -->
              <div v-else class="space-y-4">
                <div>
                  <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2">Nhập mật khẩu
                    hiện tại</label>
                  <div class="relative">
                    <input :type="showOldPassword ? 'text' : 'password'" v-model="oldPasswordInput"
                      @keyup.enter="handleOldPasswordVerifySubmit" placeholder="Mật khẩu đang sử dụng..."
                      class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 pr-10 text-xs transition-all rounded-sm text-black shadow-sm" />
                    <button type="button" @click="showOldPassword = !showOldPassword"
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black">
                      <Eye v-if="!showOldPassword" :size="14" />
                      <EyeOff v-else :size="14" />
                    </button>
                  </div>
                </div>

                <div class="pt-2">
                  <button type="button" :disabled="isVerifyingPassword || !oldPasswordInput.trim()"
                    @click="handleOldPasswordVerifySubmit"
                    class="w-full bg-black text-white py-3.5 text-[10px] uppercase tracking-[0.2em] font-semibold transition-all hover:bg-gray-900 active:scale-[0.98] disabled:opacity-40 rounded-sm flex items-center justify-center gap-2 shadow-sm">
                    <Loader2 v-if="isVerifyingPassword" class="w-3.5 h-3.5 animate-spin" />
                    <span>Xác nhận & Cập nhật mật khẩu</span>
                  </button>
                </div>
              </div>

              <!-- Footer note -->
              <div
                class="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-[10px] text-gray-400">
                <span>LGHair Security System</span>
                <button type="button" @click="closePasswordVerifyModal"
                  class="hover:text-black underline uppercase tracking-wider">
                  Hủy thao tác
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
