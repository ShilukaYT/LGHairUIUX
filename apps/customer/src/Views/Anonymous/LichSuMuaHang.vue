<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { User, Package, Calendar, LogOut, Star, Award, ShieldAlert } from 'lucide-vue-next';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/useAuthStore';

const router = useRouter();
const authStore = useAuthStore();

const profileForm = ref({
  firstName: '',
  lastName: ''
});

const greetingName = computed(() => {
  return profileForm.value.lastName || profileForm.value.firstName || 'Khách hàng';
});

const customerInfo = ref<any>(null);

const rankKey = computed(() => {
  const r = (customerInfo.value?.tenRank || '').toLowerCase().trim();
  if (r.includes('kim cương') || r.includes('diamond')) return 'kimcuong';
  if (r.includes('vàng') || r.includes('gold')) return 'vang';
  if (r.includes('bạc') || r.includes('silver')) return 'bac';
  return 'dong';
});

const sidebarBadgeClass = computed(() => {
  const key = rankKey.value;
  if (key === 'kimcuong') return 'bg-[#0284c7] text-white';
  if (key === 'vang') return 'bg-[#b45309] text-white';
  if (key === 'bac') return 'bg-slate-600 text-white';
  return 'bg-[#5c381c] text-white'; // đồng
});

const isLoading = ref(false);
const isModalLoading = ref(false);
const invoices = ref<any[]>([]);

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const searchQuery = ref('');
const filterDate = ref(getLocalDateString());
const sortBy = ref('newest');
const currentTab = ref('all');

const currentPage = ref(1);
const itemsPerPage = 5;

const isModalOpen = ref(false);
const selectedOrderId = ref('');
const orderDetail = ref<any>(null);

// Cancel modal states
const isCancelModalOpen = ref(false);
const selectedCancelId = ref('');
const cancelForm = ref({
  reason: 'Tôi muốn đổi ý',
  customReason: '',
  bankName: '',
  bankAccountNumber: '',
  bankAccountHolder: ''
});

// Product cache for images
const productImagesMap = ref<Record<string, string>>({});

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || sessionStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const formatPrice = (price?: number | null) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const statusText = (status?: string) => {
  const map: Record<string, string> = {
    'pending': 'Chờ xử lý',
    'shipping': 'Đang giao hàng',
    'completed': 'Đã hoàn thành',
    'cancelled': 'Đã hủy'
  };
  return map[status?.toLowerCase() || ''] || 'Đang xử lý';
};

const getStatusBadgeClass = (status?: string) => {
  const s = status?.toLowerCase() || '';
  if (s === 'pending') return 'bg-yellow-500 text-yellow-950 border-yellow-600/50 shadow-sm font-extrabold';
  if (s === 'shipping') return 'bg-blue-600 text-white border-blue-700/50 shadow-sm font-extrabold';
  if (s === 'completed') return 'bg-green-600 text-white border-green-700/50 shadow-sm font-extrabold';
  if (s === 'cancelled') return 'bg-red-600 text-white border-red-700/50 shadow-sm font-extrabold';
  return 'bg-gray-500 text-white border-gray-600/50 shadow-sm font-extrabold';
};

const getStatusDotClass = (status?: string) => {
  const s = status?.toLowerCase() || '';
  if (s === 'pending') return 'bg-yellow-950';
  return 'bg-white';
};

const getTabClass = (tabKey: string) => {
  if (currentTab.value !== tabKey) {
    return 'border-transparent text-gray-400 hover:text-black';
  }
  
  if (tabKey === 'all') return 'border-black text-black font-extrabold';
  if (tabKey === 'pending') return 'border-yellow-500 text-yellow-600 font-extrabold';
  if (tabKey === 'shipping') return 'border-blue-600 text-blue-600 font-extrabold';
  if (tabKey === 'completed') return 'border-green-600 text-green-600 font-extrabold';
  if (tabKey === 'cancelled') return 'border-red-600 text-red-600 font-extrabold';
  return 'border-black text-black font-extrabold';
};

const getImageUrl = (path?: string) => {
  if (!path) return `${API_BASE_URL}/assets/images/default.jpg`;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
};

const getProductImage = (summaryOrName?: string) => {
  if (!summaryOrName) return getImageUrl();
  const cleanStr = ((summaryOrName || '').split('...')[0] || '').trim().toLowerCase();
  
  for (const [key, value] of Object.entries(productImagesMap.value)) {
    if (cleanStr.includes(key) || key.includes(cleanStr)) {
      return getImageUrl(value);
    }
  }
  return getImageUrl();
};

const getItemQuantity = (item: any) => {
  if (item.soLuong != null && item.soLuong > 0) return item.soLuong;
  if (item.SoLuong != null && item.SoLuong > 0) return item.SoLuong;
  if (item.quantity != null && item.quantity > 0) return item.quantity;
  if (item.Quantity != null && item.Quantity > 0) return item.Quantity;
  if (item.totalQuantity != null && item.totalQuantity > 0) return item.totalQuantity;
  if (item.TotalQuantity != null && item.TotalQuantity > 0) return item.TotalQuantity;
  
  const children = item.chiTiet || item.ChiTiet || item.items || item.Items || item.details || item.Details;
  if (Array.isArray(children)) {
    return children.reduce((sum: number, subItem: any) => {
      const qty = subItem.soLuong ?? subItem.SoLuong ?? subItem.quantity ?? subItem.Quantity ?? 0;
      return sum + qty;
    }, 0);
  }
  return null;
};

const loadProductCache = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/api/SanPham/filter`, {
      params: {
        search: "",
        danhMuc: "all",
        thuongHieu: "all",
        priceRange: "all",
        page: 1,
        pageSize: 100
      }
    });
    if (res.data && res.data.data) {
      const cache: Record<string, string> = {};
      res.data.data.forEach((prod: any) => {
        if (prod.tenSp && prod.hinhAnhDaiDien) {
          cache[prod.tenSp.toLowerCase()] = prod.hinhAnhDaiDien;
        }
      });
      productImagesMap.value = cache;
    }
  } catch (err) {
    console.error("Lỗi khi tải cache ảnh sản phẩm:", err);
  }
};

const fetchPurchaseHistory = async () => {
  if (!customerInfo.value || customerInfo.value.maKH === 'GUEST') {
    return;
  }

  isLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/DonHangSanPham/lich-su/${customerInfo.value.maKH}`, {
      headers: getAuthHeaders()
    });
    invoices.value = res.data || [];
  } catch (error) {
    console.error("Lỗi khi tải lịch sử mua hàng sản phẩm:", error);
    Swal.fire({
      icon: 'error',
      title: 'Lỗi tải dữ liệu',
      text: 'Không thể kết nối đến hệ thống máy chủ để lấy danh sách đơn hàng.',
      confirmButtonColor: '#000'
    });
  } finally {
    isLoading.value = false;
  }
};

// Reset page to 1 when filters change
watch([searchQuery, filterDate, sortBy, currentTab], () => {
  currentPage.value = 1;
});

const filteredData = computed(() => {
  let data = [...invoices.value];

  if (currentTab.value !== 'all') {
    data = data.filter(i => i.status?.toLowerCase() === currentTab.value.toLowerCase());
  }

  if (filterDate.value) {
    data = data.filter(i => {
      if (!i.date) return false;
      const itemDate = new Date(i.date).toISOString().split('T')[0];
      return itemDate === filterDate.value;
    });
  }

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(i =>
      (i.id && String(i.id).toLowerCase().includes(q)) ||
      (i.productSummary && i.productSummary.toLowerCase().includes(q))
    );
  }

  data.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return sortBy.value === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return data;
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1);
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredData.value.slice(start, start + itemsPerPage);
});

const openDetail = async (id: string) => {
  selectedOrderId.value = id;
  isModalOpen.value = true;
  isModalLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/DonHangSanPham/chi-tiet/${id}`, {
      headers: getAuthHeaders()
    });
    orderDetail.value = res.data;
  } catch (error) {
    console.error("Lỗi khi tải chi tiết sản phẩm đơn hàng từ hệ thống:", error);
    Swal.fire({
      icon: 'error',
      title: 'Thất bại',
      text: 'Không thể tải thông tin chi tiết đơn hàng này.',
      confirmButtonColor: '#000'
    });
    closeModal();
  } finally {
    isModalLoading.value = false;
  }
};

const closeModal = () => {
  isModalOpen.value = false;
  orderDetail.value = null;
};

const requestCancel = (id: string) => {
  selectedCancelId.value = id;
  cancelForm.value = {
    reason: 'Tôi muốn đổi ý',
    customReason: '',
    bankName: '',
    bankAccountNumber: '',
    bankAccountHolder: (profileForm.value.firstName + ' ' + profileForm.value.lastName).trim().toUpperCase()
  };
  isCancelModalOpen.value = true;
};

const confirmCancelOrder = async () => {
  const form = cancelForm.value;
  if (!form.bankName.trim()) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập tên ngân hàng để nhận hoàn tiền.', confirmButtonColor: '#000' });
    return;
  }
  if (!form.bankAccountNumber.trim()) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập số tài khoản ngân hàng.', confirmButtonColor: '#000' });
    return;
  }
  if (!form.bankAccountHolder.trim()) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng nhập tên chủ tài khoản.', confirmButtonColor: '#000' });
    return;
  }

  const finalReason = form.reason === 'Lý do khác' ? form.customReason.trim() : form.reason;
  if (!finalReason) {
    Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng điền lý do hủy đơn hàng.', confirmButtonColor: '#000' });
    return;
  }

  isCancelModalOpen.value = false;

  Swal.fire({
    title: 'Đang xử lý...',
    text: 'Đang gửi yêu cầu hủy đơn hàng đến máy chủ.',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const payload = {
      maLd: selectedCancelId.value,
      stk: form.bankAccountNumber,
      nganHang: form.bankName,
      chuTk: form.bankAccountHolder
    };

    const res = await axios.post(`${API_BASE_URL}/api/LichSuHoaDon/submit-refund`, payload, {
      headers: getAuthHeaders()
    });
    
    const isSuccess = res.status === 200 || (res.data && (res.data.success || res.data.message?.toLowerCase().includes('thành công')));
    
    if (isSuccess) {
      Swal.fire({
        icon: 'success',
        title: 'Hủy đơn thành công!',
        html: `
          <div class="text-left text-xs space-y-2 border-t pt-3 mt-3">
            <p><strong>Mã đơn hàng:</strong> #${selectedCancelId.value}</p>
            <p><strong>Lý do hủy:</strong> ${finalReason}</p>
            <p><strong>Thông tin hoàn tiền:</strong></p>
            <ul class="list-disc pl-5">
              <li>Ngân hàng: ${form.bankName}</li>
              <li>Số tài khoản: ${form.bankAccountNumber}</li>
              <li>Chủ tài khoản: ${form.bankAccountHolder}</li>
            </ul>
            <p class="text-gray-500 mt-2 text-[10px] italic">Số tiền hoàn trả sẽ được đối soát và chuyển vào tài khoản trên trong vòng 24h - 48h làm việc.</p>
          </div>
        `,
        confirmButtonColor: '#000'
      });
      await fetchPurchaseHistory();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Thất bại',
        text: res.data ? res.data.message : 'Có lỗi xảy ra khi hủy đơn hàng.',
        confirmButtonColor: '#000'
      });
    }
  } catch (error: any) {
    console.error("Lỗi khi hủy đơn hàng:", error);
    const msg = error.response?.data?.message || 'Lỗi hệ thống khi hủy đơn hàng.';
    Swal.fire({
      icon: 'error',
      title: 'Lỗi',
      text: msg,
      confirmButtonColor: '#000'
    });
  }
};

onMounted(() => {
  const info = getCustomerInfo();
  customerInfo.value = info;

  if (info && info.maKH !== 'GUEST') {
    const names = info.hoTen.split(' ');
    profileForm.value.firstName = names[0] || '';
    profileForm.value.lastName = names.slice(1).join(' ') || '';

    loadProductCache();
    fetchPurchaseHistory();
  } else {
    profileForm.value = {
      firstName: 'Khách',
      lastName: 'Hàng'
    };
  }
});

const executeLogout = async () => {
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    window.dispatchEvent(new Event('user-updated'));
    window.location.href = '/login';
  }
};

const handleLogout = () => {
  authStore.triggerLogoutConfirm(
    executeLogout,
    'Xác Nhận Đăng Xuất',
    'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?'
  );
};

const executeLogoutAll = async () => {
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
    window.dispatchEvent(new Event('user-updated'));
    window.location.href = '/login';
  }
};

const handleLogoutAll = () => {
  authStore.triggerLogoutConfirm(
    executeLogoutAll,
    'Đăng Xuất Mọi Thiết Bị',
    'Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị đang đăng nhập không? Tất cả các phiên làm việc trên trình duyệt và thiết bị khác sẽ kết thúc ngay lập tức.'
  );
};
</script>

<template>
  <div class="w-full bg-[#fcfcfc] min-h-screen py-10 lg:py-16 animate-in fade-in duration-500">
    <div class="max-w-[1440px] mx-auto px-4 lg:px-8">
      
      <!-- Breadcrumbs -->
      

      <div class="flex flex-col lg:flex-row gap-8 lg:gap-12">

        <!-- Sidebar Navigation (Consistent with Profile.vue) -->
        <aside class="w-full lg:w-64 shrink-0">
          <div class="mb-8 hidden lg:block">
            <h2 class="font-heading text-base uppercase tracking-widest text-black mb-1.5 font-bold truncate">
              {{ customerInfo?.hoTen || 'Khách Hàng' }}
            </h2>
            <div :class="['inline-flex items-center gap-1.5 px-3 py-1 text-[9px] uppercase tracking-widest font-semibold rounded-sm shadow-sm transition-colors duration-300', sidebarBadgeClass]">
              <Award :size="10" />
              <span>{{ customerInfo?.tenRank || 'Mới' }}</span>
            </div>
          </div>

          <!-- Mobile Profile Header -->
          <div class="mb-6 lg:hidden flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <span class="text-[9px] text-gray-400 uppercase tracking-widest font-bold">Xin chào</span>
              <h2 class="font-heading text-sm uppercase tracking-widest text-black font-bold">
                {{ customerInfo?.hoTen || 'Khách' }}
              </h2>
            </div>
            <div :class="['inline-flex items-center gap-1 px-2.5 py-1 text-[8px] uppercase tracking-widest font-semibold rounded-sm shadow-sm transition-colors duration-300', sidebarBadgeClass]">
              <Award :size="10" />
              <span>{{ customerInfo?.tenRank || 'Mới' }}</span>
            </div>
          </div>

          <nav class="flex flex-row lg:flex-col gap-1 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide whitespace-nowrap border-b border-gray-200 lg:border-b-0">
            <button @click="router.push({ name: 'profile', query: { tab: 'profile' } })"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent">
              <User :size="15" :stroke-width="1.8" />
              Hồ Sơ Của Tôi
            </button>
            <button @click="router.push({ name: 'lich_su_mua_hang' })"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm bg-white border-l-2 border-black text-black shadow-sm font-semibold">
              <Package :size="15" :stroke-width="1.8" />
              Lịch Sử Đơn Hàng
            </button>
            <button @click="router.push({ name: 'profile', query: { tab: 'appointments' } })"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent">
              <Calendar :size="15" :stroke-width="1.8" />
              Lịch Hẹn & Hóa Đơn
            </button>
            <button @click="router.push({ name: 'profile', query: { tab: 'reviews' } })"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm text-gray-500 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent">
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
          <div class="bg-white p-6 lg:p-10 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
            
            <!-- Guest state -->
            <div v-if="!customerInfo || customerInfo.maKH === 'GUEST'" class="text-center py-16">
              <Package class="w-12 h-12 mx-auto text-gray-200 mb-6" :stroke-width="1" />
              <h3 class="font-heading text-lg uppercase tracking-widest mb-2">Yêu Cầu Đăng Nhập</h3>
              <p class="text-xs tracking-widest text-gray-400 mb-8">Vui lòng đăng nhập tài khoản để kiểm tra quản lý lịch sử mua hàng cá nhân!</p>
              <router-link to="/login"
                class="inline-block bg-black text-white px-8 py-3 text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors rounded-sm">
                Đăng nhập ngay
              </router-link>
            </div>

            <!-- Logged user state -->
            <div v-else>
              <div class="mb-8 border-b border-gray-100 pb-4">
                <h2 class="font-heading text-xl uppercase tracking-widest text-black mb-1">Lịch Sử Mua Hàng</h2>
                <p class="text-xs text-gray-500">Quản lý và theo dõi trạng thái các đơn hàng sản phẩm của bạn tại <span class="text-black font-semibold">LG Hair</span></p>
              </div>

              <!-- Toolbar / Filters -->
              <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
                <div class="relative flex-1 max-w-md">
                  <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path>
                    </svg>
                  </span>
                  <input type="text" 
                    placeholder="Tìm theo mã đơn hoặc tên sản phẩm..." 
                    v-model="searchQuery" 
                    class="w-full bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-9 pr-4 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm"
                  />
                </div>
                <div class="flex items-center gap-3">
                  <div class="relative flex items-center">
                    <input type="date" 
                      v-model="filterDate" 
                      class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none px-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm"
                    />
                    <button 
                      v-if="filterDate"
                      @click="filterDate = ''"
                      class="absolute right-2.5 text-gray-400 hover:text-red-500 transition-colors text-[10px] font-bold px-1 py-0.5 rounded-full hover:bg-gray-100"
                      title="Xóa bộ lọc ngày"
                    >
                      ✕
                    </button>
                  </div>
                  <div class="relative">
                    <select v-model="sortBy" 
                      class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black appearance-none shadow-sm cursor-pointer"
                    >
                      <option value="newest">Mới nhất</option>
                      <option value="oldest">Cũ nhất</option>
                    </select>
                    <span class="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
                      <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"></path>
                      </svg>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Status Tabs -->
              <div class="flex flex-wrap gap-8 mb-8 border-b border-gray-100 pb-px">
                <button 
                  v-for="tab in [
                    { key: 'all', label: 'Tất cả' },
                    { key: 'pending', label: 'Chờ xử lý' },
                    { key: 'shipping', label: 'Đang giao' },
                    { key: 'completed', label: 'Đã giao' },
                    { key: 'cancelled', label: 'Đã hủy' }
                  ]"
                  :key="tab.key"
                  @click="currentTab = tab.key"
                  :class="['pb-3.5 text-[11px] uppercase tracking-widest font-semibold transition-all relative border-b-2 -mb-px', getTabClass(tab.key)]"
                >
                  {{ tab.label }}
                </button>
              </div>

              <!-- Loader -->
              <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
                <div class="w-8 h-8 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
                <p class="mt-4 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Đang tải đơn hàng...</p>
              </div>

              <!-- Content Table -->
              <div v-else>
                <div class="overflow-x-auto">
                  <table class="w-full text-left border-collapse min-w-[750px]">
                    <thead>
                      <tr class="border-b border-gray-200 bg-gray-50/30">
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Mã đơn hàng</th>
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Ngày mua</th>
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Sản phẩm</th>
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Tổng tiền</th>
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500">Trạng thái</th>
                        <th class="py-4 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      <tr v-if="paginatedData.length === 0">
                        <td colspan="6" class="py-16 text-center">
                          <Package class="w-8 h-8 mx-auto text-gray-200 mb-3" :stroke-width="1" />
                          <p class="text-xs tracking-widest text-gray-400 mb-4">Không tìm thấy đơn hàng sản phẩm nào.</p>
                          <router-link :to="{ name: 'shop' }"
                            class="inline-block bg-black text-white px-6 py-2.5 text-[9px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors rounded-sm">
                            Bắt đầu mua sắm
                          </router-link>
                        </td>
                      </tr>
                      
                      <tr v-for="item in paginatedData" :key="item.id" class="hover:bg-gray-50/30 transition-colors">
                        <td class="py-5 px-5 text-xs font-bold text-black tracking-wider">#{{ item.id }}</td>
                        <td class="py-5 px-5 text-xs text-gray-500">{{ formatDate(item.date) }}</td>
                        <td class="py-5 px-5 text-xs text-gray-900 max-w-[450px]">
                          <div class="flex items-center gap-3.5 min-w-0">
                            <img :src="getProductImage(item.productSummary)" class="w-11 h-11 rounded-sm object-cover border border-gray-200 shrink-0 shadow-sm" />
                            <span class="truncate font-medium block" :title="item.productSummary">
                              {{ item.productSummary }}
                              <span v-if="getItemQuantity(item)" class="text-gray-400 font-normal text-[10px] ml-1">
                                (x{{ getItemQuantity(item) }})
                              </span>
                            </span>
                          </div>
                        </td>
                        <td class="py-5 px-5 text-xs font-bold text-black">{{ formatPrice(item.amount) }}</td>
                        <td class="py-5 px-5 text-xs">
                          <span :class="['inline-flex items-center px-3 py-1 text-[9px] uppercase tracking-widest font-bold rounded-full border', getStatusBadgeClass(item.status)]">
                            <span class="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" :class="getStatusDotClass(item.status)"></span>
                            {{ statusText(item.status) }}
                          </span>
                        </td>
                        <td class="py-5 px-5 text-xs text-right whitespace-nowrap">
                          <button 
                            @click="openDetail(item.id)"
                            class="border border-black hover:bg-black hover:text-white text-black px-4 py-2 text-[9px] uppercase tracking-widest font-bold transition-all duration-200 rounded-sm"
                          >
                            Chi tiết
                          </button>
                          <button 
                            v-if="item.status?.toLowerCase() === 'pending'" 
                            @click="requestCancel(item.id)"
                            class="border border-red-200 hover:bg-red-50 hover:border-red-300 text-red-600 px-4 py-2 text-[9px] uppercase tracking-widest font-bold transition-all duration-200 rounded-sm ml-2.5"
                          >
                            Hủy đơn
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <!-- Pagination -->
                <div v-if="totalPages > 1" class="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
                  <button 
                    :disabled="currentPage === 1" 
                    @click="currentPage--"
                    class="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-black px-4 py-2 text-[10px] uppercase tracking-widest transition-colors rounded-sm"
                  >
                    Trước
                  </button>
                  <span class="text-xs text-gray-500 tracking-widest">Trang {{ currentPage }} / {{ totalPages }}</span>
                  <button 
                    :disabled="currentPage === totalPages" 
                    @click="currentPage++"
                    class="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-black px-4 py-2 text-[10px] uppercase tracking-widest transition-colors rounded-sm"
                  >
                    Sau
                  </button>
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  </div>

  <!-- Modal Xem Chi Tiết Hóa Đơn Sản Phẩm -->
  <Transition name="modal-fade">
    <div v-if="isModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="closeModal">
      <div class="bg-white w-full max-w-lg rounded-sm shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-heading text-sm uppercase tracking-widest text-black font-bold">Chi Tiết Đơn Hàng</h3>
            <span class="text-[10px] text-gray-400 font-semibold tracking-wider">MÃ ĐƠN: #{{ selectedOrderId }}</span>
          </div>
          <button @click="closeModal" class="text-gray-400 hover:text-black transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6">
          <div v-if="isModalLoading" class="flex flex-col items-center justify-center py-8">
            <div class="w-6 h-6 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
          </div>
          <div v-else-if="orderDetail" class="space-y-6">
            <!-- Delivery info & Status -->
            <div class="bg-gray-50/80 p-4 border border-gray-100 rounded-sm flex justify-between items-start">
              <div class="space-y-1">
                <p class="text-[9px] uppercase tracking-widest text-gray-400 font-bold">Thông tin giao nhận</p>
                <p class="text-xs text-black font-semibold">
                  Người nhận: {{ orderDetail.tenNguoiNhan }}
                </p>
                <p class="text-xs text-gray-500 leading-relaxed">
                  Địa chỉ: {{ orderDetail.diaChiGiao }}
                </p>
              </div>
              <span :class="['inline-block px-2.5 py-1 text-[8px] uppercase tracking-widest font-bold rounded-sm border', getStatusBadgeClass(orderDetail.trangThai)]">
                {{ statusText(orderDetail.trangThai) }}
              </span>
            </div>

            <!-- Product Items -->
            <div>
              <h6 class="text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-3">Danh sách sản phẩm</h6>
              <div class="border border-gray-100 rounded-sm divide-y divide-gray-100 max-h-64 overflow-y-auto">
                <div v-for="pro in orderDetail.items" :key="pro.maSP || pro.maSp || pro.id" class="flex justify-between items-center p-3 text-xs">
                  <div class="flex items-center gap-3 max-w-[70%]">
                    <img :src="getProductImage(pro.tenSP || pro.tenSp || pro.ten || pro.name)" class="w-10 h-10 rounded-sm object-cover border border-gray-200 shrink-0" />
                    <div class="space-y-0.5 min-w-0">
                      <span class="text-black font-medium block truncate" :title="pro.tenSP || pro.tenSp || pro.ten || pro.name">{{ pro.tenSP || pro.tenSp || pro.ten || pro.name }}</span>
                      <span class="text-[10px] text-gray-400 font-medium">Số lượng: x{{ pro.soLuong ?? pro.SoLuong ?? pro.quantity ?? pro.Quantity ?? 1 }}</span>
                    </div>
                  </div>
                  <span class="text-black font-bold">{{ formatPrice(pro.thanhTien ?? pro.ThanhTien ?? ((pro.giaBan || pro.gia || pro.price || 0) * (pro.soLuong ?? pro.SoLuong ?? pro.quantity ?? pro.Quantity ?? 1))) }}</span>
                </div>
              </div>
            </div>

            <!-- Pricing Breakdown -->
            <div class="border-t border-gray-100 pt-4 space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-500">Tổng tiền hàng:</span>
                <span class="text-black font-medium">{{ formatPrice(orderDetail.tongTienHang) }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Phí vận chuyển:</span>
                <span class="text-black font-medium">{{ formatPrice(orderDetail.phiVanChuyen) }}</span>
              </div>
              <div v-if="orderDetail.giamGiaVoucher > 0" class="flex justify-between text-red-600">
                <span class="font-medium">Voucher giảm giá:</span>
                <span class="font-bold">-{{ formatPrice(orderDetail.giamGiaVoucher) }}</span>
              </div>
              <div class="flex justify-between items-center border-t border-gray-100 pt-3 mt-1">
                <span class="text-xs uppercase tracking-widest text-black font-bold">Số tiền thanh toán:</span>
                <span class="text-lg font-bold text-[#b8860b]">{{ formatPrice(orderDetail.tongThanhToan) }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Modal Footer -->
        <div class="bg-gray-50/50 px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button @click="closeModal" class="bg-black hover:bg-gray-900 text-white px-5 py-2 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Modal Hủy Đơn Hàng Hoàn Tiền -->
  <Transition name="modal-fade">
    <div v-if="isCancelModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="isCancelModalOpen = false">
      <div class="bg-white w-full max-w-md rounded-sm shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-black">
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-heading text-sm uppercase tracking-widest text-black font-bold">Yêu Cầu Hủy Đơn Hàng</h3>
            <span class="text-[10px] text-gray-400 font-semibold tracking-wider">ĐƠN HÀNG: #{{ selectedCancelId }}</span>
          </div>
          <button @click="isCancelModalOpen = false" class="text-gray-400 hover:text-black transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 space-y-4">
          <!-- Reason -->
          <div class="space-y-1">
            <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Lý do hủy đơn</label>
            <select v-model="cancelForm.reason" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2 text-xs transition-all rounded-sm text-black">
              <option value="Tôi muốn đổi ý">Tôi muốn đổi ý</option>
              <option value="Đặt trùng đơn">Đặt trùng đơn</option>
              <option value="Thời gian giao hàng quá lâu">Thời gian giao hàng quá lâu</option>
              <option value="Tìm thấy giá rẻ hơn ở nơi khác">Tìm thấy giá rẻ hơn ở nơi khác</option>
              <option value="Lý do khác">Lý do khác</option>
            </select>
          </div>
          <div v-if="cancelForm.reason === 'Lý do khác'" class="space-y-1 animate-in fade-in duration-200">
            <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Nhập lý do khác</label>
            <textarea v-model="cancelForm.customReason" placeholder="Nhập lý do chi tiết của bạn..." rows="2" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2 text-xs transition-all rounded-sm text-black resize-none"></textarea>
          </div>

          <!-- Refund Bank Info Title -->
          <div class="border-t border-gray-100 pt-3 mt-3">
            <h4 class="text-[11px] uppercase tracking-widest text-black font-bold mb-2">Thông tin tài khoản hoàn tiền</h4>
            <p class="text-[9px] text-gray-400 leading-normal mb-3">Vui lòng điền đúng thông tin tài khoản ngân hàng để hệ thống tự động hoàn tiền cho đơn hàng này.</p>
          </div>

          <!-- Bank Name -->
          <div class="space-y-1">
            <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Tên ngân hàng</label>
            <input type="text" v-model="cancelForm.bankName" placeholder="Ví dụ: Vietcombank, Techcombank..." class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black" />
          </div>

          <!-- Bank Account Number -->
          <div class="space-y-1">
            <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Số tài khoản</label>
            <input type="text" v-model="cancelForm.bankAccountNumber" placeholder="Nhập số tài khoản ngân hàng..." class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black" />
          </div>

          <!-- Bank Account Holder -->
          <div class="space-y-1">
            <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Tên chủ tài khoản (Không dấu)</label>
            <input type="text" v-model="cancelForm.bankAccountHolder" placeholder="Ví dụ: NGUYEN VAN A" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black uppercase font-semibold" />
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50/50 px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button @click="isCancelModalOpen = false" class="bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 px-4 py-2 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors">
            Đóng
          </button>
          <button @click="confirmCancelOrder" class="bg-black hover:bg-gray-900 text-white px-5 py-2 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors">
            Xác nhận hủy đơn
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
