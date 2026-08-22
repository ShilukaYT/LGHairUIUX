<script setup>
import { ref, onMounted, computed } from 'vue';
import { logActivity } from '@/utils/activityLogger';
import { Line } from 'vue-chartjs';
import { useCustomizerStore } from '@/stores/customizer';
import { useTheme } from 'vuetify';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js';
import { 
  Calendar, 
  Search, 
  Filter, 
  RotateCcw, 
  TrendingUp, 
  Trophy, 
  LayoutDashboard,
  Users, 
  ShoppingBag, 
  Scissors, 
  Printer, 
  X, 
  Coins, 
  Receipt, 
  Percent,
  Star
} from 'lucide-vue-next';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler);

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

const customizer = useCustomizerStore();
const isDarkMode = computed(() => {
  if (customizer?.actTheme === 'dark') return true;
  try {
    const vuetifyTheme = useTheme();
    if (vuetifyTheme?.global?.name?.value === 'dark' || vuetifyTheme?.global?.current?.value?.dark) return true;
  } catch (e) {}
  return localStorage.getItem('theme_selection') === 'dark' 
      || localStorage.getItem('actTheme') === 'dark'
      || document.documentElement.classList.contains('dark') 
      || document.body.classList.contains('v-theme--dark');
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const today   = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

const pad = (n) => String(n).padStart(2, '0');
const fmtInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatCurrency = (v) =>
  v == null ? '0 ₫' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

const formatDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN') : '';

const trangThaiLabel = (t) => {
  const map = { 0: 'Hủy', 1: 'Chờ xử lý', 2: 'Đang xử lý', 3: 'Hoàn thành' };
  return map[t] ?? 'Không rõ';
};
const trangThaiColor = (t) => {
  const map = { 0: 'error', 1: 'warning', 2: 'info', 3: 'success' };
  return map[t] ?? 'default';
};

// ── State ─────────────────────────────────────────────────────────────────────
const startDate  = ref(fmtInput(firstDay));
const endDate    = ref(fmtInput(today));
const searchMaHd = ref('');
const loading    = ref(true);
const error      = ref(null);
const activeTab  = ref('dichvu');
const staffTab   = ref('revenue');
const topYeuThich = ref([]);
const loadingYeuThich = ref(false);

const stats = ref({
  doanhThuThangNay : 0,
  soHoaDonThangNay : 0,
  soVoucherDaDung  : 0,
  topNhanVien      : [],
  hoaDonSanPham    : [],
  hoaDonDichVu     : [],
  bieuDo           : []
});

// ── Pagination ────────────────────────────────────────────────────────────────
const pageSP  = ref(1);
const pageDV  = ref(1);
const perPage = 8;

const pagedSP = computed(() => {
  const s = (pageSP.value - 1) * perPage;
  return stats.value.hoaDonSanPham.slice(s, s + perPage);
});
const pagedDV = computed(() => {
  const s = (pageDV.value - 1) * perPage;
  return stats.value.hoaDonDichVu.slice(s, s + perPage);
});
const totalPagesSP = computed(() => Math.ceil(stats.value.hoaDonSanPham.length / perPage));
const totalPagesDV = computed(() => Math.ceil(stats.value.hoaDonDichVu.length  / perPage));

const totalRevenue = computed(() => {
  const spSum = stats.value.hoaDonSanPham
    ?.filter(hd => hd.trangThai === 3)
    ?.reduce((sum, hd) => sum + (hd.thanhTien || 0), 0) || 0;
  const dvSum = stats.value.hoaDonDichVu
    ?.filter(hd => hd.trangThai === 3)
    ?.reduce((sum, hd) => sum + (hd.thanhTien || 0), 0) || 0;
  return spSum + dvSum;
});

// ── Stat card definitions ─────────────────────────────────────────────────────
const statCards = computed(() => [
  {
    label : 'Doanh thu giai đoạn',
    value : formatCurrency(totalRevenue.value),
    iconComponent : Coins,
    iconColor : '#2563eb',
    bg    : '#eff6ff'
  },
  {
    label : 'Số hóa đơn',
    value : (stats.value.hoaDonSanPham?.length || 0) + (stats.value.hoaDonDichVu?.length || 0),
    iconComponent : Receipt,
    iconColor : '#16a34a',
    bg    : '#f0fdf4'
  },
  {
    label : 'Voucher đã dùng',
    value : stats.value.soVoucherDaDung,
    iconComponent : Percent,
    iconColor : '#d97706',
    bg    : '#fffbeb'
  }
]);

// ── Chart ─────────────────────────────────────────────────────────────────────
const chartData = computed(() => ({
  labels  : stats.value.bieuDo?.map(i => i.ngay) ?? [],
  datasets: [{
    label          : 'Doanh thu (₫)',
    data           : stats.value.bieuDo?.map(i => i.doanhThu) ?? [],
    borderColor    : '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth    : 3,
    pointBackgroundColor: '#2563eb',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    fill           : true,
    tension        : 0.3
  }]
}));

const chartOptions = {
  responsive           : true,
  maintainAspectRatio  : false,
  plugins: {
    legend : { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ' Doanh thu: ' + formatCurrency(ctx.parsed.y)
      }
    }
  },
  scales: {
    x: { 
      grid: { display: false }, 
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } 
    },
    y: { 
      beginAtZero: true, 
      grid: { color: 'rgba(226, 232, 240, 0.6)' }, 
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: (v) => formatCurrency(v) } 
    }
  }
};

// ── API ───────────────────────────────────────────────────────────────────────
const fetchAdminData = async () => {
  try {
    loading.value = true;
    error.value   = null;
    pageSP.value  = 1;
    pageDV.value  = 1;

    const params = {
      startDate : startDate.value,
      endDate   : endDate.value
    };
    if (searchMaHd.value && searchMaHd.value.trim() !== '') {
      params.searchMaHd = searchMaHd.value.trim();
    }
    const qs = new URLSearchParams(params).toString();

    const res = await fetch(API + `/api/ThongKe/admin-dashboard?${qs}`, {
      method : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error(`Lỗi ${res.status}: Không thể tải dữ liệu thống kê`);
    stats.value = await res.json();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchTopYeuThich = async () => {
  try {
    loadingYeuThich.value = true;
    const res = await fetch(API + '/api/QuanLyDanhGiaDichVu/thong-ke-nhan-vien', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      data.sort((a, b) => {
        if (b.diemTrungBinh !== a.diemTrungBinh) {
          return b.diemTrungBinh - a.diemTrungBinh;
        }
        return b.luotDanhGia - a.luotDanhGia;
      });
      topYeuThich.value = data.slice(0, 5);
    }
  } catch (err) {
    console.error('Lỗi lấy top nhân viên yêu thích:', err);
  } finally {
    loadingYeuThich.value = false;
  }
};

// ── Invoice Details Modal Logic ──
const isModalOpen = ref(false);
const selectedHd = ref(null);

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('adminToken')
             || localStorage.getItem('accessToken') 
             || localStorage.getItem('token') 
             || sessionStorage.getItem('accessToken') 
             || sessionStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}` };
};

const getInvoiceItems = (hd) => {
  if (!hd) return [];
  const list = hd.chiTiet || hd.ChiTiet || hd.chiTietDichVu || hd.ChiTietDichVu || [];
  if (Array.isArray(list) && list.length > 0) return list;
  return [];
};

const getItemName = (item) => {
  if (!item) return 'Hạng mục Salon';
  return item.ten || item.Ten || item.tenHangMuc || item.TenHangMuc || item.tenSP || item.tenSp || item.tenDichVu || item.TenDichVu || 'Dịch vụ Salon';
};

const getItemQty = (item) => {
  if (!item) return 1;
  return item.soLuong || item.SoLuong || item.soluong || 1;
};

const getItemPrice = (item) => {
  if (!item) return 0;
  if (item.thanhTien != null) return Number(item.thanhTien);
  if (item.ThanhTien != null) return Number(item.ThanhTien);
  const gia = Number(item.gia || item.Gia || item.giaBan || item.GiaBan || 0);
  const sl = getItemQty(item);
  return gia * sl;
};

const viewDetail = async (maHd) => {
  try {
    // Tìm dữ liệu hóa đơn đã có sẵn từ stats (fallback)
    const allInvoices = [...(stats.value.hoaDonSanPham || []), ...(stats.value.hoaDonDichVu || [])];
    const localMatch = allInvoices.find(h => String(h.maHd || h.MaHd || '').toUpperCase() === String(maHd).toUpperCase());

    let detail = null;

    // Thử gọi API chi tiết trước
    try {
      const tokenHeaders = getAuthHeaders();
      const res = await fetch( API + `/api/admin/hoa-don/chi-tiet/${maHd}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          ...tokenHeaders,
          'Content-Type': 'application/json'
        }
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success && result.data) {
          detail = result.data;
        }
      }
    } catch (apiErr) {
      console.warn('API chi tiết hóa đơn không phản hồi, sử dụng dữ liệu có sẵn:', apiErr);
    }

    // Nếu API không trả dữ liệu, fallback sang dữ liệu local
    if (!detail) {
      if (localMatch) {
        detail = { ...localMatch };
      } else {
        alert("Không thể tải chi tiết hóa đơn");
        return;
      }
    }

    // Bổ sung dữ liệu từ local nếu thiếu
    if (localMatch) {
      if (!detail.chiTiet && !detail.chiTietDichVu) {
        detail.chiTiet = localMatch.chiTiet || localMatch.ChiTiet || localMatch.chiTietDichVu || localMatch.ChiTietDichVu;
      }
      if (!detail.tenKh && (localMatch.khachHang || localMatch.tenKhachHang || localMatch.tenKh)) {
        detail.tenKh = localMatch.khachHang || localMatch.tenKhachHang || localMatch.tenKh;
      }
      if (!detail.tenThuNgan && (localMatch.tenThuNgan || localMatch.thuNgan)) {
        detail.tenThuNgan = localMatch.tenThuNgan || localMatch.thuNgan;
      }
      if (detail.tongTien == null && localMatch.tongTien != null) {
        detail.tongTien = localMatch.tongTien;
      }
      if (detail.thanhTien == null && localMatch.thanhTien != null) {
        detail.thanhTien = localMatch.thanhTien;
      }
      if (!detail.maHd) {
        detail.maHd = localMatch.maHd || localMatch.MaHd;
      }
      if (!detail.ngayTao && localMatch.ngayTao) {
        detail.ngayTao = localMatch.ngayTao;
      }
    }

    selectedHd.value = detail;
    isModalOpen.value = true;
    logActivity('Xem chi tiết hóa đơn', `Xem chi tiết hóa đơn #${maHd}:\n• Khách hàng: "${detail.tenKh || detail.khachHang || 'Khách vãng lai'}"\n• Thu ngân: "${detail.tenThuNgan || 'Hệ thống'}"\n• Tổng thanh toán: "${(detail.thanhTien || 0).toLocaleString()}₫"`, 'Hóa đơn');
  } catch (e) {
    logActivity('Xem chi tiết hóa đơn', `Thất bại khi tải chi tiết hóa đơn #${maHd} - Lỗi: ${e.message || 'Không xác định'}`, 'Hóa đơn', 'Thất bại');
    alert("Không thể tải chi tiết hóa đơn");
  }
};

const printInvoice = () => {
  const maHd = selectedHd.value?.maHd || 'N/A';
  const tenKh = selectedHd.value?.tenKh || selectedHd.value?.khachHang || 'Khách vãng lai';
  const thanhTien = (selectedHd.value?.thanhTien || 0).toLocaleString();
  logActivity('In hóa đơn', `In phiếu thanh toán hóa đơn #${maHd}:\n• Khách hàng: "${tenKh}"\n• Tổng thanh toán: "${thanhTien}₫"\n• Phương thức in: "Máy in POS K80"`, 'Hóa đơn');
  window.print();
};

const resetFilter = () => {
  logActivity('Đặt lại bộ lọc Dashboard', `Đặt lại toàn bộ bộ lọc trang Tổng quan Salon về mặc định:\n• Ngày bắt đầu: "${fmtInput(firstDay)}"\n• Ngày kết thúc: "${fmtInput(today)}"\n• Từ khóa tìm kiếm: "Đã xóa"`, 'Hóa đơn');
  startDate.value  = fmtInput(firstDay);
  endDate.value    = fmtInput(today);
  searchMaHd.value = '';
  fetchAdminData();
  fetchTopYeuThich();
};

onMounted(() => {
  fetchAdminData();
  fetchTopYeuThich();
});
</script>

<template>
  <v-container fluid class="pa-5">

    <!-- ═══════ HEADER CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <LayoutDashboard class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h1 class="text-h5 font-weight-bold mb-1">Tổng Quan Salon</h1>
            <p class="text-subtitle-2 text-medium-emphasis mb-0">
              Báo cáo hiệu suất kinh doanh, doanh thu và xếp hạng theo khoảng thời gian
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="() => { fetchAdminData(); fetchTopYeuThich(); }"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ FILTERS CARD ═══════ -->
    <v-card variant="outlined" rounded="xl" class="pa-4 mb-6 bg-surface">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
        <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
          <!-- Từ ngày -->
          <v-text-field
            v-model="startDate"
            label="Từ ngày"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="width: 160px;"
          ></v-text-field>

          <!-- Đến ngày -->
          <v-text-field
            v-model="endDate"
            label="Đến ngày"
            type="date"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="width: 160px;"
          ></v-text-field>

          <!-- Tìm mã HD -->
          <v-text-field
            v-model="searchMaHd"
            placeholder="Tìm theo mã hóa đơn (VD: SP001, HD002)..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            style="min-width: 280px; max-width: 420px;"
            @keyup.enter="fetchAdminData"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis mr-1 shrink-0" />
            </template>
          </v-text-field>

          <v-btn
            color="primary"
            variant="flat"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold px-4"
            :loading="loading"
            @click="fetchAdminData"
          >
            <template v-slot:prepend>
              <Filter class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Lọc Dữ Liệu
          </v-btn>
        </div>

        <v-btn
          variant="text"
          color="primary"
          rounded="lg"
          class="text-none font-weight-bold"
          height="40"
          @click="resetFilter"
        >
          <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
          Đặt lại lọc
        </v-btn>
      </div>
    </v-card>

    <!-- ── Loading / Error ─────────────────────────────────────────────────── -->
    <div v-if="loading" class="d-flex justify-center align-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal" class="mb-5" border="start">
      <strong>Lỗi tải dữ liệu:</strong> {{ error }}
      <template #append>
        <v-btn size="small" variant="text" @click="fetchAdminData">Thử lại</v-btn>
      </template>
    </v-alert>

    <!-- ── Nội dung chính ──────────────────────────────────────────────────── -->
    <template v-else>

      <!-- ── Stat Cards ──────────────────────────────────────────────────── -->
      <v-row class="mb-4">
        <v-col v-for="(card, i) in statCards" :key="i" cols="12" sm="4">
          <v-card elevation="0" border>
            <v-card-text class="pa-5">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <p class="text-body-2 text-medium-emphasis mb-1">{{ card.label }}</p>
                  <p class="text-h5 font-weight-bold">{{ card.value }}</p>
                </div>
                <v-avatar :color="card.bg" size="52" rounded="lg">
                  <component :is="card.iconComponent" class="w-6 h-6" :style="{ color: card.iconColor }" />
                </v-avatar>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── Biểu đồ + Top NV ────────────────────────────────────────────── -->
      <v-row class="mb-4">

        <!-- Biểu đồ doanh thu theo ngày -->
        <v-col cols="12" lg="8">
          <v-card elevation="0" border height="100%">
            <v-card-item class="px-5 py-4 border-b">
              <template #prepend>
                <TrendingUp class="w-5 h-5 text-blue-600 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Doanh thu theo ngày</v-card-title>
              <template #append>
                <v-chip size="x-small" color="primary" variant="tonal">
                  {{ stats.bieuDo?.length ?? 0 }} ngày
                </v-chip>
              </template>
            </v-card-item>
            <v-card-text class="pa-5">
              <div style="height: 280px; position: relative;">
                <Line
                  v-if="stats.bieuDo && stats.bieuDo.length > 0"
                  :data="chartData"
                  :options="chartOptions"
                />
                <div
                  v-else
                  class="d-flex flex-column align-center justify-center text-medium-emphasis"
                  style="height: 100%;"
                >
                  <TrendingUp class="w-10 h-10 text-slate-300" />
                  <p class="mt-3 text-body-2">Không có dữ liệu trong khoảng thời gian này</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Top Nhân viên (Doanh thu & Yêu thích) -->
        <v-col cols="12" lg="4">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-tabs v-model="staffTab" color="primary" class="border-b" align-tabs="center">
              <v-tab value="revenue" class="text-none font-weight-bold">
                <template #prepend>
                  <Trophy class="w-4 h-4 text-amber-500 mr-1.5" />
                </template>
                Top Doanh Thu
              </v-tab>
              <v-tab value="rating" class="text-none font-weight-bold">
                <template #prepend>
                  <Star class="w-4 h-4 text-primary mr-1.5" />
                </template>
                Top Yêu Thích
              </v-tab>
            </v-tabs>

            <v-card-text class="pa-4 flex-grow-1">
              <v-window v-model="staffTab">
                
                <!-- Tab: Top theo Doanh thu -->
                <v-window-item value="revenue">
                  <div
                    v-if="!stats.topNhanVien || stats.topNhanVien.length === 0"
                    class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis"
                  >
                    <Users class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(nv, idx) in stats.topNhanVien"
                      :key="idx"
                      class="px-0 py-2"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ nv.tenNhanVien }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ nv.soHoaDonPhuTrach }} hóa đơn
                      </v-list-item-subtitle>

                      <template #append>
                        <span class="text-body-2 font-weight-bold text-primary">
                          {{ formatCurrency(nv.doanhThuMangLai) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>

                <!-- Tab: Top theo Yêu thích (Đánh giá) -->
                <v-window-item value="rating">
                  <div
                    v-if="loadingYeuThich"
                    class="d-flex justify-center align-center py-16"
                  >
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                  <div
                    v-else-if="!topYeuThich || topYeuThich.length === 0"
                    class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis"
                  >
                    <Users class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu đánh giá</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(nv, idx) in topYeuThich"
                      :key="idx"
                      class="px-0 py-2"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ nv.tenNhanVien }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ nv.luotDanhGia }} lượt đánh giá
                      </v-list-item-subtitle>

                      <template #append>
                        <div class="d-flex align-center">
                          <span class="text-body-2 font-weight-bold text-amber-600 mr-1">
                            {{ nv.diemTrungBinh }}
                          </span>
                          <Star class="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── Bảng hóa đơn (tab SP / DV) ────────────────────────────────── -->
      <v-card elevation="0" border>
        <v-card-item class="px-5 py-4 border-b">
          <template #prepend>
            <Receipt class="w-5 h-5 text-blue-500 mr-2" />
          </template>
          <v-card-title class="text-body-1 font-weight-bold">Danh sách hóa đơn</v-card-title>
          <template #append>
            <v-chip size="x-small" color="info" variant="tonal">
              Tổng: {{ (stats.hoaDonSanPham?.length ?? 0) + (stats.hoaDonDichVu?.length ?? 0) }} đơn
            </v-chip>
          </template>
        </v-card-item>

        <v-tabs v-model="activeTab" color="primary" class="border-b">
          <v-tab value="dichvu">
            <template #prepend>
              <Scissors class="w-4 h-4 mr-1.5" />
            </template>
            Dịch vụ Salon
            <v-chip size="x-small" class="ml-2" color="success" variant="tonal">
              {{ stats.hoaDonDichVu?.length ?? 0 }}
            </v-chip>
          </v-tab>
          <v-tab value="sanpham">
            <template #prepend>
              <ShoppingBag class="w-4 h-4 mr-1.5" />
            </template>
            Sản phẩm
            <v-chip size="x-small" class="ml-2" color="primary" variant="tonal">
              {{ stats.hoaDonSanPham?.length ?? 0 }}
            </v-chip>
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">

          <!-- Tab: Hóa đơn Dịch vụ -->
          <v-window-item value="dichvu">
            <div v-if="pagedDV.length === 0" class="d-flex flex-column align-center py-12 text-medium-emphasis">
              <Scissors class="w-10 h-10 text-slate-300" />
              <p class="mt-3 text-body-2">Không có hóa đơn dịch vụ nào</p>
            </div>

            <v-table v-else fixed-header hover class="border rounded-xl">
              <thead>
                <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Mã HĐ</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Khách hàng</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Ngày tạo</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Tổng tiền</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Thành tiền</th>
                  <th class="text-center font-weight-bold text-caption text-uppercase py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hd in pagedDV" :key="hd.maHd" @click="viewDetail(hd.maHd)" style="cursor: pointer;">
                  <td>
                    <span class="font-weight-medium text-success">{{ hd.maHd }}</span>
                  </td>
                  <td>{{ hd.khachHang }}</td>
                  <td>{{ formatDate(hd.ngayTao) }}</td>
                  <td class="text-right">{{ formatCurrency(hd.tongTien) }}</td>
                  <td class="text-right font-weight-semibold">{{ formatCurrency(hd.thanhTien) }}</td>
                  <td class="text-center">
                    <v-chip :color="trangThaiColor(hd.trangThai)" size="x-small" variant="tonal">
                      {{ trangThaiLabel(hd.trangThai) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="totalPagesDV > 1" class="d-flex justify-center pa-4">
              <v-pagination
                v-model="pageDV"
                :length="totalPagesDV"
                :total-visible="6"
                density="compact"
                color="success"
              />
            </div>
          </v-window-item>

          <!-- Tab: Hóa đơn Sản phẩm -->
          <v-window-item value="sanpham">
            <div v-if="pagedSP.length === 0" class="d-flex flex-column align-center py-12 text-medium-emphasis">
              <ShoppingBag class="w-10 h-10 text-slate-300" />
              <p class="mt-3 text-body-2">Không có hóa đơn sản phẩm nào</p>
            </div>

            <v-table v-else fixed-header hover class="border rounded-xl">
              <thead>
                <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Mã HĐ</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Khách hàng</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Ngày tạo</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Chi tiết</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Tổng tiền</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Thành tiền</th>
                  <th class="text-center font-weight-bold text-caption text-uppercase py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hd in pagedSP" :key="hd.maHd" @click="viewDetail(hd.maHd)" style="cursor: pointer;">
                  <td>
                    <span class="font-weight-medium text-primary">{{ hd.maHd }}</span>
                  </td>
                  <td>{{ hd.khachHang }}</td>
                  <td>{{ formatDate(hd.ngayTao) }}</td>
                  <td>
                    <v-tooltip location="right" :disabled="!(hd.chiTiet || hd.ChiTiet) || (hd.chiTiet || hd.ChiTiet).length === 0">
                      <template #activator="{ props }">
                        <v-chip v-bind="props" size="x-small" variant="tonal" color="info" prepend-icon="mdi-package-variant" @click.stop>
                          {{ (hd.chiTiet || hd.ChiTiet)?.reduce((sum, ct) => sum + (ct.soLuong || ct.SoLuong || 0), 0) ?? 0 }} sp
                        </v-chip>
                      </template>
                      <div>
                        <div v-for="(ct, ci) in (hd.chiTiet || hd.ChiTiet)" :key="ci" class="text-caption py-1">
                          • {{ ct.ten || ct.Ten }} &times; {{ ct.soLuong || ct.SoLuong }} — {{ formatCurrency(ct.gia || ct.Gia) }}
                        </div>
                      </div>
                    </v-tooltip>
                  </td>
                  <td class="text-right">{{ formatCurrency(hd.tongTien) }}</td>
                  <td class="text-right font-weight-semibold">{{ formatCurrency(hd.thanhTien) }}</td>
                  <td class="text-center">
                    <v-chip :color="trangThaiColor(hd.trangThai)" size="x-small" variant="tonal">
                      {{ trangThaiLabel(hd.trangThai) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="totalPagesSP > 1" class="d-flex justify-center pa-4">
              <v-pagination
                v-model="pageSP"
                :length="totalPagesSP"
                :total-visible="6"
                density="compact"
                color="primary"
              />
            </div>
          </v-window-item>

        </v-window>
      </v-card>

    </template>
  </v-container>

  <!-- ═══════ MODAL: CHI TIẾT HÓA ĐƠN ═══════ -->
  <v-dialog v-model="isModalOpen" max-width="850px" persistent scrollable>
    <v-card v-if="selectedHd" rounded="xl">
      <!-- Dialog Header -->
      <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b bg-primary text-white">
        <div class="d-flex align-center gap-3">
          <v-avatar color="white" variant="tonal" size="42" rounded="lg">
            <Receipt class="w-5 h-5 text-white" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold text-white mb-0">
              HÓA ĐƠN CHI TIẾT
            </h3>
            <p class="text-caption text-white opacity-80 mb-0 font-mono">
              Mã hóa đơn: #{{ selectedHd.maHd }}
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2">
          <v-btn
            color="white"
            variant="tonal"
            height="36"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="printInvoice"
          >
            <template v-slot:prepend>
              <Printer class="w-4 h-4 mr-1" />
            </template>
            In POS K80
          </v-btn>

          <v-btn icon variant="text" density="comfortable" color="white" @click="isModalOpen = false">
            <X class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <!-- Dialog Body -->
      <v-card-text class="pa-6">
        <div id="invoice-print" class="w-100 max-w-3xl mx-auto px-2 py-2 d-flex flex-column gap-4">
          <!-- Header Tiêu Đề Salon -->
          <div class="text-center border-b pb-4 print:border-b print:border-black print:pb-1">
            <h1 class="text-h5 font-weight-black uppercase text-primary print:text-black mb-1">
              LGHAIR SALON
            </h1>
            <p class="text-caption text-medium-emphasis mb-0 print:text-black">
              Địa chỉ: 123 Cư M'gar, Tỉnh Đắk Lắk
            </p>
            <p class="text-caption font-weight-bold text-primary print:text-black mb-0">
              Hotline: 0123.456.789
            </p>
          </div>

          <!-- Header Máy in POS khi In thực tế -->
          <div class="hidden print:block text-center font-weight-bold text-caption text-uppercase border-b border-dashed border-black pb-2">
            PHIẾU THANH TOÁN HÓA ĐƠN
          </div>

          <!-- Info Cards Grid (Desktop View) -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border print:hidden" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">MÃ HÓA ĐƠN</span>
              <span class="text-body-2 font-weight-black font-mono text-primary">#{{ selectedHd.maHd }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">NGÀY TẠO</span>
              <span class="text-body-2 font-weight-bold font-mono">{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">KHÁCH HÀNG</span>
              <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenKh || selectedHd.khachHang || 'Khách vãng lai' }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">THU NGÂN</span>
              <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span>
            </div>
          </div>

          <!-- Invoice Info print for POS -->
          <div class="hidden print:flex flex-column gap-1 text-caption border-b border-dashed border-black pb-2 font-mono">
            <div class="d-flex justify-space-between"><span>Mã hóa đơn:</span> <strong>#{{ selectedHd.maHd }}</strong></div>
            <div class="d-flex justify-space-between"><span>Ngày tạo:</span> <span>{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></div>
            <div class="d-flex justify-space-between"><span>Khách hàng:</span> <strong>{{ selectedHd.tenKh || selectedHd.khachHang || 'Khách vãng lai' }}</strong></div>
            <div class="d-flex justify-space-between"><span>Thu ngân:</span> <span>{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span></div>
          </div>

          <!-- Invoice Items Table -->
          <v-table density="compact" class="border rounded-xl print:border-none" hover>
            <thead>
              <tr class="border-b print:bg-transparent print:border-t print:border-b print:border-dashed print:border-black" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="py-2.5 px-4 font-weight-bold text-caption text-uppercase text-left print:w-[50%]">Tên Sản phẩm / Dịch vụ</th>
                <th class="py-2.5 px-4 font-weight-bold text-caption text-uppercase text-center w-20 print:w-[15%]">SL</th>
                <th class="py-2.5 px-4 font-weight-bold text-caption text-uppercase text-left print:hidden">Ghi chú</th>
                <th class="py-2.5 px-4 font-weight-bold text-caption text-uppercase text-right print:w-[35%]">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="(item, index) in getInvoiceItems(selectedHd)" 
                :key="index"
              >
                <td class="py-2.5 px-4 font-weight-bold print:py-1 print:px-0">
                  {{ getItemName(item) }}
                </td>
                <td class="py-2.5 px-4 text-center font-mono font-weight-bold print:py-1 print:px-0">
                  {{ getItemQty(item) }}
                </td>
                <td class="py-2.5 px-4 print:hidden">
                  <v-chip size="x-small" variant="tonal" color="grey-darken-1" class="font-weight-bold">
                    {{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}
                  </v-chip>
                </td>
                <td class="py-2.5 px-4 text-right font-mono font-weight-bold text-primary print:py-1 print:px-0">
                  {{ getItemPrice(item).toLocaleString() }}₫
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Total Revenue Footer -->
          <div class="d-flex flex-column align-end gap-2 pt-4 px-2 border-t print:pt-2 print:border-t print:border-dashed print:border-black">
            <div class="d-flex justify-space-between w-100 text-body-2">
              <span class="text-medium-emphasis">Tạm tính gốc:</span>
              <strong class="font-mono">{{ selectedHd.tongTien?.toLocaleString() }}₫</strong>
            </div>
            <div v-if="selectedHd.giamGiaVip" class="d-flex justify-space-between w-100 text-body-2 font-weight-bold text-error">
              <span>Giảm giá VIP:</span>
              <span>-{{ selectedHd.giamGiaVip }}%</span>
            </div>
            <div class="d-flex justify-space-between w-100 text-h6 font-weight-bold pt-1 border-t">
              <span class="font-weight-black">TỔNG THANH TOÁN:</span>
              <span class="font-weight-black font-mono text-primary text-h5">{{ selectedHd.thanhTien?.toLocaleString() }}₫</span>
            </div>
          </div>

          <!-- Lời cảm ơn dành riêng cho trang in hóa đơn máy in nhiệt POS K80 -->
          <div class="hidden print:flex flex-column align-center justify-center text-center mt-3 pt-3 border-t border-dashed border-black gap-1">
            <p class="text-caption font-weight-bold mb-0">Cảm ơn Quý khách &amp; Hẹn gặp lại!</p>
            <p class="text-caption text-medium-emphasis mb-0">Hotline CSKH: 0123.456.789 - Website: lghair.vn</p>
          </div>
        </div>
      </v-card-text>

      <!-- Modal Footer -->
      <v-card-actions class="pa-4 px-6 border-t d-flex justify-end print:hidden">
        <v-btn
          variant="outlined"
          color="grey-darken-1"
          rounded="lg"
          class="text-none font-weight-bold px-6"
          @click="isModalOpen = false"
        >
          Đóng cửa sổ
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
}
th {
  font-size: 0.75rem !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888 !important;
  white-space: nowrap;
}
td {
  font-size: 0.855rem;
}

/* Nút Đóng Cửa Sổ khóa cố định màu nền xanh Sky sáng chữ Trắng 100% trong cả sáng và tối */
.act-modal-close-btn {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
}
.act-modal-close-btn:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
}
.act-modal-close-btn span {
  color: #ffffff !important;
}
</style>

<style>
/* Style dành riêng cho máy in hóa đơn nhiệt POS K80 / Máy in thực tế (Đồng bộ chuẩn 100% với HoaDon.vue) */
@media print {
    @page {
        size: 80mm auto;
        margin: 0;
    }
    
    html, body {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        font-family: Arial, Helvetica, sans-serif !important;
    }
    
    #app, .v-application, .v-overlay-container, .v-layout {
        display: none !important;
    }

    .print\:hidden {
        display: none !important;
    }

    .act-modal-container {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        border-radius: 0 !important;
    }

    /* Reset toàn bộ nền đen/xám của Dark Mode thành màu trắng tinh khi in giấy nhiệt */
    #invoice-print,
    #invoice-print * {
        background-color: transparent !important;
        background: transparent !important;
        color: #000000 !important;
        border-color: #000000 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        text-shadow: none !important;
    }

    #invoice-print {
        width: 76mm !important;
        max-width: 76mm !important;
        margin: 0 auto !important;
        padding: 3mm 2mm !important;
        box-sizing: border-box !important;
    }

    /* Force table to fit within 76mm print width - no scrollbar, no overflow, all columns visible */
    #invoice-print table {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        font-size: 10px !important;
    }

    #invoice-print th,
    #invoice-print td {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        padding: 2px 1px !important;
        font-size: 10px !important;
    }

    #invoice-print div[class*="overflow"] {
        overflow: visible !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
    }
}
</style>