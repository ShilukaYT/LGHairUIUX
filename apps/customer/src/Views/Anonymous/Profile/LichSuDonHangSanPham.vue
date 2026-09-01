<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import {
  Search, Package, RotateCcw, Truck, Eye, X, AlertCircle,
  CheckCircle, Clock, XCircle, ArrowRight, ShieldCheck, ChevronLeft, ChevronRight, MapPin
} from 'lucide-vue-next';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import Swal from 'sweetalert2';
import ModalYeuCauHoanHang from '../ModalYeuCauHoanHang.vue';
import ModalCapNhatVanDon from '../ModalCapNhatVanDon.vue';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const isLoading = ref(true);
const invoices = ref<any[]>([]);
const customerInfo = ref<any>(null);

// Filters & Pagination states
const searchQuery = ref('');
const filterDate = ref('');
const sortBy = ref('newest');
const currentTab = ref('all');
const currentPage = ref(1);
const itemsPerPage = 6;

// Modal States
const isModalOpen = ref(false);
const isModalLoading = ref(false);
const selectedOrderId = ref('');
const orderDetail = ref<any>(null);

// Cancel Order Modal
const isCancelModalOpen = ref(false);
const selectedCancelId = ref('');
const cancelReason = ref('Thay đổi ý định mua hàng');
const customCancelReason = ref('');
const isCancelling = ref(false);

// Return / Refund Modals
const isReturnModalOpen = ref(false);
const selectedReturnOrder = ref<any>(null);

const isTrackingModalOpen = ref(false);
const selectedTrackingOrderId = ref('');

const cancelReasonsList = [
  'Thay đổi ý định mua hàng',
  'Tìm thấy giá tốt hơn ở nơi khác',
  'Đặt nhầm số lượng / sản phẩm',
  'Thời gian giao hàng quá lâu',
  'Muốn đổi sang sản phẩm khác',
  'Lý do khác'
];

// Product cache for images
const productImagesMap = ref<Record<string, string>>({});

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('access_token') ||
    sessionStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const formatPrice = (price?: number | null) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '--/--/----';
  if (dateStr.includes('/') && !dateStr.includes('T')) return dateStr;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
};

const DEFAULT_PRODUCT_IMG = 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=120';

const getImageUrl = (path?: string) => {
  if (!path) return DEFAULT_PRODUCT_IMG;
  if (path.startsWith('http')) return path;
  if (path.startsWith('/')) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
};

const getProductImage = (summaryOrName?: string) => {
  if (!summaryOrName) return DEFAULT_PRODUCT_IMG;
  const cleanStr = ((summaryOrName || '').split('...')[0] || '').trim().toLowerCase();

  for (const [key, value] of Object.entries(productImagesMap.value)) {
    if (cleanStr.includes(key) || key.includes(cleanStr)) {
      return getImageUrl(value);
    }
  }
  return DEFAULT_PRODUCT_IMG;
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
  let maKh = customerInfo.value?.maKH;

  if (!maKh || maKh === 'GUEST') {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    if (token) {
      try {
        const pRes = await axios.get(`${API_BASE_URL}/api/Profile/me`, { headers: getAuthHeaders() });
        if (pRes.data && pRes.data.success && pRes.data.data) {
          maKh = pRes.data.data.maKh || pRes.data.data.maKH || pRes.data.data.id;
          customerInfo.value = { ...customerInfo.value, maKH: maKh, hoTen: pRes.data.data.hoTen };
          localStorage.setItem('user', JSON.stringify(customerInfo.value));
        }
      } catch (e) {
        console.warn("Không thể lấy profile me:", e);
      }
    }
  }

  if (!maKh || maKh === 'GUEST') {
    isLoading.value = false;
    return;
  }

  isLoading.value = true;
  try {
    const res = await axios.get(`${API_BASE_URL}/api/DonHangSanPham/lich-su/${maKh}`, {
      headers: getAuthHeaders()
    });
    if (Array.isArray(res.data)) {
      invoices.value = res.data;
    } else if (res.data && Array.isArray(res.data.data)) {
      invoices.value = res.data.data;
    } else {
      invoices.value = [];
    }

    // Đồng bộ tức thời từ fallback localStorage nếu có
    invoices.value.forEach((inv: any) => {
      const ls = localStorage.getItem(`hoan_hang_status_${inv.id}`);
      if (ls === '6') {
        inv.status = 'refunded';
        inv.trangThai = 6;
      } else if (ls === '5') {
        inv.status = 'returned';
        inv.trangThai = 5;
      }
    });
  } catch (error) {
    console.error("Lỗi khi tải lịch sử mua hàng sản phẩm:", error);
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
    if (currentTab.value === 'returning') {
      data = data.filter(i => ['returning', 'returned', 'refunded'].includes(i.status?.toLowerCase() || ''));
    } else {
      data = data.filter(i => i.status?.toLowerCase() === currentTab.value.toLowerCase());
    }
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

const openDetail = async (id: string, fallbackItem?: any) => {
  selectedOrderId.value = id;
  isModalOpen.value = true;
  isModalLoading.value = true;

  if (fallbackItem) {
    orderDetail.value = { ...fallbackItem };
  }

  try {
    const res = await axios.get(`${API_BASE_URL}/api/DonHangSanPham/chi-tiet/${id}`, {
      headers: getAuthHeaders()
    });

    let raw = res.data;
    if (raw && raw.data && !raw.id && !raw.maHd) {
      raw = raw.data;
    }

    orderDetail.value = {
      ...(fallbackItem || {}),
      ...(raw || {})
    };
  } catch (error) {
    console.error("Lỗi khi tải chi tiết sản phẩm:", error);
    if (!fallbackItem) {
      Swal.fire({
        icon: 'error',
        title: 'Thất bại',
        text: 'Không thể tải thông tin chi tiết đơn hàng này.',
        confirmButtonColor: '#000'
      });
      closeModal();
    }
  } finally {
    isModalLoading.value = false;
  }
};

const closeModal = () => {
  isModalOpen.value = false;
  orderDetail.value = null;
  fetchPurchaseHistory();
};

// =========================================================================
// KIỂM TRA ĐIỀU KIỆN ĐỔI TRẢ (TRONG VÒNG 3 NGÀY - 72 GIỜ)
// =========================================================================
const isEligibleForReturn = (item: any) => {
  const st = item.status?.toLowerCase();
  if (st !== 'completed' && item.trangThai !== 3) return false;

  if (!item.date) return true;
  const orderDate = new Date(item.date).getTime();
  const now = new Date().getTime();
  const diffHours = (now - orderDate) / (1000 * 60 * 60);

  return diffHours <= 72;
};

const openReturnModal = (item: any) => {
  selectedReturnOrder.value = {
    id: item.id,
    amount: item.amount,
    date: item.date
  };
  isReturnModalOpen.value = true;
};

const hasTrackingCode = (item: any) => {
  if (!item) return false;
  if (item.maVanDon || item.MaVanDon) return true;
  const saved = localStorage.getItem(`hoan_hang_vandon_${item.id}`);
  if (saved) {
    try {
      const data = JSON.parse(saved);
      if (data.maVanDon) return true;
    } catch (e) {}
  }
  return false;
};

const openTrackingModal = (item: any) => {
  if (hasTrackingCode(item)) {
    Swal.fire({
      icon: 'info',
      title: 'Đã cập nhật mã vận đơn',
      text: `Đơn hàng #${item.id} đã được cập nhật mã vận đơn thành công. Salon đang theo dõi bưu phẩm gửi về!`,
      confirmButtonColor: '#000'
    });
    return;
  }
  selectedTrackingOrderId.value = String(item.id);
  isTrackingModalOpen.value = true;
};

const handleReturnSuccess = () => {
  fetchPurchaseHistory();
};

const handleTrackingSuccess = () => {
  fetchPurchaseHistory();
};

const openCancelModal = (id: string) => {
  selectedCancelId.value = id;
  cancelReason.value = 'Thay đổi ý định mua hàng';
  customCancelReason.value = '';
  isCancelModalOpen.value = true;
};

const handleCancelOrder = async () => {
  const finalReason = cancelReason.value === 'Lý do khác' ? customCancelReason.value : cancelReason.value;
  if (!finalReason) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu thông tin',
      text: 'Vui lòng nhập lý do hủy đơn hàng.',
      confirmButtonColor: '#000'
    });
    return;
  }

  isCancelling.value = true;
  try {
    const res = await axios.post(`${API_BASE_URL}/api/DonHangSanPham/cancel-order`, {
      maHd: selectedCancelId.value,
      lyDo: finalReason
    }, {
      headers: getAuthHeaders()
    });

    if (res.data && res.data.success) {
      Swal.fire({
        icon: 'success',
        title: 'Hủy đơn hàng thành công!',
        text: `Đơn hàng #${selectedCancelId.value} đã được hủy.`,
        confirmButtonColor: '#000'
      });
      isCancelModalOpen.value = false;
      await fetchPurchaseHistory();
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Không thể hủy đơn',
        text: res.data?.message || 'Có lỗi xảy ra khi hủy đơn hàng.',
        confirmButtonColor: '#000'
      });
    }
  } catch (err: any) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi',
      text: err.response?.data?.message || 'Lỗi khi hủy đơn hàng.',
      confirmButtonColor: '#000'
    });
  } finally {
    isCancelling.value = false;
  }
};

const getTabClass = (tabKey: string) => {
  if (currentTab.value === tabKey) {
    return 'border-black text-black font-bold';
  }
  return 'border-transparent text-gray-400 hover:text-black hover:border-gray-300';
};

const normalizeProductStatus = (status: any): string => {
  if (status === null || status === undefined) return 'pending';
  const str = String(status).trim().toLowerCase();
  if (str === '0' || str === '-1' || str === 'cancelled' || str === 'da huy' || str === 'dahuy' || str === 'da_huy') return 'cancelled';
  if (str === '1' || str === 'pending' || str === 'cho xu ly' || str === 'choxuly' || str === 'cho_xu_ly') return 'pending';
  if (str === '2' || str === 'shipping' || str === 'dang giao' || str === 'danggiao' || str === 'dang_giao' || str === 'dang giao hang') return 'shipping';
  if (str === '3' || str === 'completed' || str === 'da giao' || str === 'dagiao' || str === 'da_giao' || str === 'da giao hang' || str === 'hoan thanh' || str === 'hoanthanh') return 'completed';
  if (str === '4' || str === 'returning' || str === 'dang hoan hang' || str === 'danghoanhang' || str === 'yeu cau hoan tien' || str === 'cho hoan tien') return 'returning';
  if (str === '5' || str === 'returned' || str === 'da nhan hang' || str === 'danhanhang' || str === 'cho salon hoan tien') return 'returned';
  if (str === '6' || str === 'refunded' || str === 'da hoan tien' || str === 'dahoantien') return 'refunded';
  return str;
};

const getStatusBadgeClass = (status?: any) => {
  const s = normalizeProductStatus(status);
  if (s === 'pending') return 'bg-amber-50 text-amber-900 border-amber-200';
  if (s === 'shipping') return 'bg-blue-50 text-blue-900 border-blue-200';
  if (s === 'completed') return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  if (s === 'returning') return 'bg-orange-50 text-orange-900 border-orange-200';
  if (s === 'returned') return 'bg-purple-50 text-purple-900 border-purple-200';
  if (s === 'refunded') return 'bg-teal-50 text-teal-900 border-teal-200';
  if (s === 'cancelled') return 'bg-rose-50 text-rose-900 border-rose-200';
  return 'bg-gray-50 text-gray-800 border-gray-200';
};

const getStatusDotClass = (status?: any) => {
  const s = normalizeProductStatus(status);
  if (s === 'pending') return 'bg-amber-500';
  if (s === 'shipping') return 'bg-blue-500';
  if (s === 'completed') return 'bg-emerald-500';
  if (s === 'returning') return 'bg-orange-500';
  if (s === 'returned') return 'bg-purple-500';
  if (s === 'refunded') return 'bg-teal-500';
  if (s === 'cancelled') return 'bg-rose-500';
  return 'bg-gray-400';
};

const statusText = (status?: any) => {
  const s = normalizeProductStatus(status);
  if (s === 'pending') return 'Chờ xử lý';
  if (s === 'shipping') return 'Đang giao hàng';
  if (s === 'completed') return 'Đã giao hàng';
  if (s === 'returning') return 'Đang hoàn hàng';
  if (s === 'returned') return 'Đã nhận hàng (Chờ hoàn tiền)';
  if (s === 'refunded') return 'Đã hoàn tiền';
  if (s === 'cancelled') return 'Đã hủy';
  return String(status || 'Đang xử lý');
};

onMounted(async () => {
  customerInfo.value = getCustomerInfo();
  loadProductCache();
  await fetchPurchaseHistory();
});
</script>

<template>
  <div class="space-y-6">
    <!-- Header Title -->
    <div class="border-b border-gray-100 pb-4">
      <h2 class="font-heading text-lg uppercase tracking-widest text-black mb-1 font-bold">Lịch Sử Đơn Hàng</h2>
      <p class="text-xs text-gray-500">Quản lý và theo dõi các đơn hàng sản phẩm của bạn tại <span
          class="text-black font-semibold">LGHair</span></p>
    </div>

    <!-- Toolbar / Filters -->
    <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4">
      <div class="relative flex-1 max-w-md">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search class="w-4 h-4 text-gray-400" />
        </span>
        <input type="text" placeholder="Tìm theo mã đơn hoặc tên sản phẩm..." v-model="searchQuery"
          class="w-full bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-9 pr-4 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm" />
      </div>
      <div class="flex items-center gap-3">
        <div class="relative flex items-center">
          <input type="date" v-model="filterDate"
            class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none px-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm" />
          <button v-if="filterDate" @click="filterDate = ''"
            class="absolute right-2.5 text-gray-400 hover:text-red-500 transition-colors text-[10px] font-bold px-1 py-0.5 rounded-full hover:bg-gray-100"
            title="Xóa bộ lọc ngày">
            ✕
          </button>
        </div>
        <div class="relative">
          <select v-model="sortBy"
            class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black appearance-none shadow-sm cursor-pointer">
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="flex flex-wrap gap-6 border-b border-gray-100 pb-px">
      <button v-for="tab in [
        { key: 'all', label: 'Tất cả' },
        { key: 'pending', label: 'Chờ xử lý' },
        { key: 'shipping', label: 'Đang giao' },
        { key: 'completed', label: 'Đã giao' },
        { key: 'returning', label: 'Hoàn hàng' },
        { key: 'cancelled', label: 'Đã hủy' }
      ]" :key="tab.key" @click="currentTab = tab.key"
        :class="['pb-3.5 text-[11px] uppercase tracking-widest font-semibold transition-all relative border-b-2 -mb-px', getTabClass(tab.key)]">
        {{ tab.label }}
      </button>
    </div>

    <!-- Loader -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
      <p class="mt-4 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Đang tải đơn hàng...</p>
    </div>

    <!-- Table -->
    <div v-else>
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr
              class="border-b border-gray-200 bg-gray-50/40 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th class="py-3.5 px-3 whitespace-nowrap">Mã đơn</th>
              <th class="py-3.5 px-3 whitespace-nowrap">Ngày mua</th>
              <th class="py-3.5 px-3 min-w-[200px]">Sản phẩm</th>
              <th class="py-3.5 px-3 whitespace-nowrap">Tổng tiền</th>
              <th class="py-3.5 px-3 text-center whitespace-nowrap">Trạng thái</th>
              <th class="py-3.5 px-3 text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="paginatedData.length === 0">
              <td colspan="6" class="py-16 text-center">
                <Package class="w-8 h-8 mx-auto text-gray-200 mb-3" :stroke-width="1" />
                <p class="text-xs tracking-widest text-gray-400 mb-4">Không tìm thấy đơn hàng sản phẩm nào.</p>
                <router-link :to="{ name: 'shop' }"
                  class="inline-block bg-black text-white px-6 py-2.5 text-[9px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors rounded-sm font-semibold">
                  Bắt đầu mua sắm
                </router-link>
              </td>
            </tr>

            <tr v-for="item in paginatedData" :key="item.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="py-4 px-3 text-xs font-bold text-black whitespace-nowrap">#{{ item.id }}</td>
              <td class="py-4 px-3 text-xs text-gray-500 whitespace-nowrap">{{ formatDate(item.date) }}</td>
              <td class="py-4 px-3 text-xs text-gray-900">
                <div class="flex items-center gap-3 min-w-0">
                  <img :src="getProductImage(item.productSummary)"
                    @error="(e: any) => { e.target.src = DEFAULT_PRODUCT_IMG; }"
                    class="w-10 h-10 rounded-sm object-cover border border-gray-200 shrink-0 shadow-sm" />
                  <span class="truncate font-medium block max-w-[240px] xl:max-w-none" :title="item.productSummary">
                    {{ item.productSummary }}
                    <span v-if="getItemQuantity(item)" class="text-gray-400 font-normal text-[10px] ml-1">
                      (x{{ getItemQuantity(item) }})
                    </span>
                  </span>
                </div>
              </td>
              <td class="py-4 px-3 text-xs font-bold text-black whitespace-nowrap font-mono">{{ formatPrice(item.amount)
                }}</td>
              <td class="py-4 px-3 text-xs text-center whitespace-nowrap">
                <span
                  :class="['inline-flex items-center px-2.5 py-1 text-[9px] uppercase tracking-wider font-bold rounded-full border', getStatusBadgeClass(item.status)]">
                  <span class="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" :class="getStatusDotClass(item.status)"></span>
                  {{ statusText(item.status) }}
                </span>
              </td>
              <td class="py-4 px-3 text-xs text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">

                  <!-- Nút Trả hàng / Hoàn tiền -->
                  <button v-if="isEligibleForReturn(item)" @click="openReturnModal(item)"
                    class="bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold rounded-lg transition-all duration-200 shadow-sm flex items-center gap-1 shrink-0"
                    title="Yêu cầu trả hàng & hoàn tiền trong vòng 3 ngày">
                    <RotateCcw class="w-3 h-3" />
                    <span>Hoàn tiền</span>
                  </button>

                  <!-- Khi đang hoàn hàng (Trạng thái 4) -->
                  <template v-else-if="item.status?.toLowerCase() === 'returning'">
                    <span v-if="hasTrackingCode(item)"
                      class="inline-flex items-center px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-[9px] font-bold tracking-wider uppercase shrink-0"
                      title="Kiện hàng đang được Shipper chuyển về Salon">
                      Đã cập nhật vận đơn
                    </span>
                    <button v-else @click="openTrackingModal(item)"
                      class="bg-orange-600 hover:bg-orange-700 text-white px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold rounded-lg transition-all duration-200 shadow-sm flex items-center gap-1 shrink-0"
                      title="Cập nhật mã vận đơn gửi hàng về Salon">
                      <Truck class="w-3 h-3" />
                      <span>Mã vận đơn</span>
                    </button>
                  </template>

                  <!-- Tag thông tin khi Đã nhận hàng về kho (Trạng thái 5) -->
                  <span v-else-if="item.status?.toLowerCase() === 'returned'"
                    class="inline-flex items-center px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-[9px] font-bold tracking-wider uppercase shrink-0">
                    Chờ Salon hoàn tiền
                  </span>

                  <!-- Tag thông tin khi Đã hoàn tiền xong 100% (Trạng thái 6) -->
                  <span v-else-if="item.status?.toLowerCase() === 'refunded'"
                    class="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[9px] font-bold tracking-wider uppercase shrink-0">
                    Đã hoàn tiền ✓
                  </span>

                  <!-- Nút Hủy đơn nếu Chờ xử lý -->
                  <button v-if="item.status?.toLowerCase() === 'pending'" @click="openCancelModal(item.id)"
                    class="text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold rounded-lg transition-all duration-200 shrink-0">
                    Hủy
                  </button>

                  <!-- Nút Chi tiết -->
                  <button @click="openDetail(item.id, item)"
                    class="bg-gray-100 hover:bg-black hover:text-white text-gray-700 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-semibold rounded-lg transition-all duration-200 border border-gray-200 shrink-0">
                    Chi tiết
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-gray-100 pt-5 mt-4">
        <span class="text-xs text-gray-400">
          Trang {{ currentPage }} / {{ totalPages }} (Tổng {{ filteredData.length }} đơn)
        </span>
        <div class="flex items-center gap-2">
          <button @click="currentPage--" :disabled="currentPage === 1"
            class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-black transition-colors">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <span class="text-xs font-bold px-2 text-black">{{ currentPage }}</span>
          <button @click="currentPage++" :disabled="currentPage === totalPages"
            class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed text-black transition-colors">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Modals -->
    <ModalYeuCauHoanHang :is-open="isReturnModalOpen" :order="selectedReturnOrder"
      :default-account-holder="customerInfo?.hoTen" @close="() => { isReturnModalOpen = false; fetchPurchaseHistory(); }" @success="handleReturnSuccess" />

    <ModalCapNhatVanDon :is-open="isTrackingModalOpen" :order-id="selectedTrackingOrderId"
      @close="() => { isTrackingModalOpen = false; fetchPurchaseHistory(); }" @success="handleTrackingSuccess" />

    <!-- Order Detail Modal -->
    <Teleport to="body">
      <div v-if="isModalOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto"
        @click.self="closeModal">
        <div
          class="relative bg-white w-full max-w-lg rounded-xl shadow-2xl border border-gray-100 flex flex-col max-h-[85vh] my-auto overflow-hidden text-neutral-900 animate-in fade-in zoom-in-95 duration-200 text-black">
          <!-- Modal Header -->
          <div
            class="flex justify-between items-center px-5 py-3.5 border-b border-gray-100 bg-white sticky top-0 z-10 shrink-0">
            <div>
              <h3 class="text-sm uppercase tracking-wide text-gray-900 font-bold flex items-center gap-1.5">
                <Package :size="16" class="text-gray-900" /> Chi Tiết Đơn Hàng Sản Phẩm
              </h3>
              <span class="text-[10.5px] text-gray-400 font-mono font-medium tracking-wide">
                MÃ ĐƠN: <strong class="text-gray-800 font-bold">#{{ selectedOrderId }}</strong>
              </span>
            </div>
            <button @click="closeModal"
              class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition-all cursor-pointer">
              <X :size="14" />
            </button>
          </div>

          <div class="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1" v-if="orderDetail">
            <!-- 1. Thông tin tóm tắt đơn hàng -->
            <div
              class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-gray-50/80 rounded-lg border border-gray-200/80 text-xs">
              <div class="space-y-0.5">
                <span class="text-[9.5px] uppercase tracking-wider text-gray-500 font-bold block">Ngày đặt</span>
                <span class="font-bold text-gray-900">
                  {{ formatDate(orderDetail.ngayTao || orderDetail.ngayDat || orderDetail.date || orderDetail.createdAt
                    || orderDetail.NgayTao || orderDetail.NgayDat) }}
                </span>
              </div>
              <div class="space-y-0.5">
                <span class="text-[9.5px] uppercase tracking-wider text-gray-500 font-bold block mb-0.5">Trạng
                  thái</span>
                <span
                  :class="['inline-flex items-center px-2 py-0.5 text-[8.5px] uppercase tracking-wider font-bold rounded border shadow-xs', getStatusBadgeClass(orderDetail.status ?? orderDetail.trangThai ?? orderDetail.TrangThai ?? orderDetail.trangThaiText)]">
                  <span class="w-1.5 h-1.5 rounded-full mr-1 shrink-0"
                    :class="getStatusDotClass(orderDetail.status ?? orderDetail.trangThai ?? orderDetail.TrangThai ?? orderDetail.trangThaiText)"></span>
                  {{ statusText(orderDetail.status ?? orderDetail.trangThai ?? orderDetail.TrangThai ??
                    orderDetail.trangThaiText) }}
                </span>
              </div>
              <div class="space-y-0.5">
                <span class="text-[9.5px] uppercase tracking-wider text-gray-500 font-bold block">Thanh toán</span>
                <span class="font-bold text-gray-900">{{ orderDetail.phuongThucThanhToan ||
                  orderDetail.PhuongThucThanhToan || orderDetail.phuongThuc || orderDetail.paymentMethod || 'Tiền mặt'
                  }}</span>
              </div>
              <div class="space-y-0.5">
                <span class="text-[9.5px] uppercase tracking-wider text-gray-500 font-bold block">Tổng thanh toán</span>
                <span
                  :class="['font-bold text-xs font-mono', (normalizeProductStatus(orderDetail.status ?? orderDetail.trangThai ?? orderDetail.TrangThai) === 'completed' || normalizeProductStatus(orderDetail.status ?? orderDetail.trangThai ?? orderDetail.TrangThai) === 'refunded') ? 'text-emerald-600' : 'text-red-600']">
                  {{ formatPrice(orderDetail.thanhTien ?? orderDetail.ThanhTien ?? orderDetail.tongTien ??
                    orderDetail.TongTien ?? orderDetail.amount ?? orderDetail.Amount ?? orderDetail.tongThanhToan) }}
                </span>
              </div>
            </div>

            <!-- 2. Thông tin giao hàng & Vận đơn -->
            <div
              v-if="orderDetail.tenNguoiNhan || orderDetail.diaChiGiao || orderDetail.diaChi || orderDetail.sdt || orderDetail.donViVanChuyen"
              class="p-3 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 text-amber-950 font-bold">
                  <MapPin :size="14" class="text-amber-700 shrink-0" />
                  <span class="text-[10px] uppercase tracking-wider">Thông tin giao nhận</span>
                </div>
                <span v-if="orderDetail.donViVanChuyen || orderDetail.DonViVanChuyen"
                  class="text-[9.5px] px-2 py-0.5 bg-white border border-amber-200 text-amber-900 rounded-full font-semibold shadow-2xs">
                  {{ orderDetail.donViVanChuyen || orderDetail.DonViVanChuyen }} <span
                    v-if="orderDetail.maVanDon || orderDetail.MaVanDon">| {{ orderDetail.maVanDon ||
                    orderDetail.MaVanDon }}</span>
                </span>
              </div>
              <div class="text-gray-800 text-xs leading-relaxed space-y-0.5">
                <p class="font-bold text-gray-900" v-if="orderDetail.tenNguoiNhan || orderDetail.hoTen">
                  Người nhận: <span class="font-semibold text-gray-800">{{ orderDetail.tenNguoiNhan || orderDetail.hoTen
                    }}</span>
                  <span v-if="orderDetail.sdtNhan || orderDetail.sdt || orderDetail.soDienThoai"
                    class="text-gray-500 font-normal ml-1">({{ orderDetail.sdtNhan || orderDetail.sdt ||
                    orderDetail.soDienThoai }})</span>
                </p>
                <p class="text-gray-600 font-medium"
                  v-if="orderDetail.diaChiGiao || orderDetail.diaChiNhan || orderDetail.diaChi">
                  Địa chỉ: <span class="text-gray-800">{{ orderDetail.diaChiGiao || orderDetail.diaChiNhan ||
                    orderDetail.diaChi }}</span>
                </p>
              </div>
            </div>

            <!-- 3. Danh sách sản phẩm -->
            <div>
              <h4 class="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1">
                <Package :size="11" class="text-gray-700" /> Danh sách sản phẩm trong đơn
              </h4>
              <div
                class="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden bg-white shadow-xs">
                <div
                  v-for="(prod, idx) in (orderDetail.chiTiet || orderDetail.ChiTiet || orderDetail.chiTietDonHangs || orderDetail.ChiTietDonHangs || orderDetail.items || orderDetail.Items || [])"
                  :key="idx" class="flex items-center justify-between p-2.5 px-3 hover:bg-gray-50/50 transition-colors">
                  <div class="flex items-center gap-2.5">
                    <img :src="getImageUrl(prod.hinhAnh || prod.HinhAnh || prod.hinhAnhDaiDien || prod.HinhAnhDaiDien)"
                      @error="(e: any) => { e.target.src = DEFAULT_PRODUCT_IMG; }"
                      class="w-10 h-10 rounded-md object-cover border border-gray-200 shrink-0" />
                    <div>
                      <h5 class="text-xs font-bold text-gray-900 leading-snug">{{ prod.tenSp || prod.TenSp || prod.tenSP
                        || prod.TenSP || prod.ten || prod.Ten || 'Sản phẩm' }}</h5>
                      <span class="text-[10px] text-gray-400 font-medium">Số lượng: x{{ prod.soLuong || prod.SoLuong ||
                        prod.quantity || 1 }}</span>
                    </div>
                  </div>
                  <div class="text-right">
                    <span class="text-xs font-bold text-gray-900 font-mono">{{ formatPrice(prod.thanhTien ||
                      prod.ThanhTien || ((prod.giaBan || prod.GiaBan || prod.gia || 0) * (prod.soLuong || prod.SoLuong
                      || 1))) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 4. Chi tiết tiền / Voucher -->
            <div class="border-t border-gray-100 pt-3 space-y-1.5 text-xs">
              <div class="flex justify-between text-gray-500">
                <span>Tiền hàng:</span>
                <span class="font-mono text-gray-800 font-medium">{{ formatPrice(orderDetail.tongTienHang ||
                  orderDetail.tongTien || orderDetail.TongTien) }}</span>
              </div>
              <div v-if="orderDetail.phiVanChuyen || orderDetail.phiShip || orderDetail.PhiVanChuyen"
                class="flex justify-between text-gray-500">
                <span>Phí vận chuyển:</span>
                <span class="font-mono text-gray-800 font-medium">+{{ formatPrice(orderDetail.phiVanChuyen ||
                  orderDetail.phiShip || orderDetail.PhiVanChuyen) }}</span>
              </div>
              <div v-if="(orderDetail.giamGiaVoucher || orderDetail.GiamGiaVoucher) > 0"
                class="flex justify-between text-emerald-600 font-medium">
                <span>Giảm giá Voucher:</span>
                <span class="font-mono">-{{ formatPrice(orderDetail.giamGiaVoucher || orderDetail.GiamGiaVoucher)
                  }}</span>
              </div>
            </div>
          </div>

          <div class="bg-gray-50/80 px-5 py-3 border-t border-gray-100 flex justify-end shrink-0">
            <button @click="closeModal"
              class="bg-black hover:bg-neutral-800 text-white px-5 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all shadow-xs cursor-pointer">
              Đóng
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Cancel Modal -->
    <Teleport to="body">
      <div v-if="isCancelModalOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="isCancelModalOpen = false">
        <div
          class="bg-white w-full max-w-md rounded-sm shadow-2xl border border-gray-100 flex flex-col my-auto overflow-hidden text-black">
          <div class="px-6 py-4 border-b border-gray-100 bg-rose-50/60 flex justify-between items-center">
            <h3 class="font-heading text-sm uppercase tracking-widest text-rose-950 font-bold">Xác Nhận Hủy Đơn Hàng
            </h3>
            <button @click="isCancelModalOpen = false" class="text-gray-400 hover:text-black">
              <X class="w-5 h-5" />
            </button>
          </div>
          <div class="p-6 space-y-4">
            <p class="text-xs text-gray-600 leading-relaxed">
              Bạn có chắc chắn muốn hủy đơn hàng <strong>#{{ selectedCancelId }}</strong> không?
            </p>
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-600 font-bold">Lý do hủy đơn *</label>
              <select v-model="cancelReason" class="w-full border border-gray-200 px-3 py-2 text-xs rounded-sm">
                <option v-for="r in cancelReasonsList" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div v-if="cancelReason === 'Lý do khác'" class="space-y-1">
              <textarea v-model="customCancelReason" placeholder="Nhập lý do cụ thể..." rows="2"
                class="w-full border border-gray-200 p-2 text-xs rounded-sm"></textarea>
            </div>
          </div>
          <div class="bg-gray-50/70 px-6 py-3 border-t border-gray-100 flex justify-end gap-2">
            <button @click="isCancelModalOpen = false"
              class="px-4 py-2 border text-[10px] uppercase tracking-wider font-semibold rounded-sm">Đóng</button>
            <button @click="handleCancelOrder" :disabled="isCancelling"
              class="bg-rose-600 hover:bg-rose-700 text-white px-5 py-2 text-[10px] uppercase tracking-wider font-bold rounded-sm disabled:opacity-50">
              <span v-if="isCancelling">Đang hủy...</span>
              <span v-else>Xác Nhận Hủy Đơn</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
