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

    <!-- ── Tiêu đề ──────────────────────────────────────────────────────── -->
    <div class="mb-6">
      <h1 class="text-h5 font-weight-bold">Tổng quan Salon</h1>
      <p class="text-body-2 text-medium-emphasis mt-1">Báo cáo hiệu suất kinh doanh theo khoảng thời gian</p>
    </div>

    <!-- ── Bộ lọc ────────────────────────────────────────────────────────── -->
    <v-card elevation="0" border class="mb-6">
      <v-card-text class="pa-4">
        <v-row align="center" dense>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="startDate"
              label="Từ ngày"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
              color="primary"
            >
              <template #prepend-inner>
                <Calendar class="w-4 h-4 text-slate-400 mr-1" />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="endDate"
              label="Đến ngày"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
              color="primary"
            >
              <template #prepend-inner>
                <Calendar class="w-4 h-4 text-slate-400 mr-1" />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="searchMaHd"
              label="Tìm theo mã hóa đơn"
              variant="outlined"
              density="comfortable"
              hide-details
              clearable
              placeholder="VD: SP001, HD002..."
              color="primary"
              @keyup.enter="fetchAdminData"
            >
              <template #prepend-inner>
                <Search class="w-4 h-4 text-slate-400 mr-1" />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="12" sm="2" class="d-flex align-center gap-2">
            <v-btn
              color="primary"
              variant="elevated"
              :loading="loading"
              @click="fetchAdminData"
              style="flex: 1; height: 44px;"
            >
              <template #prepend>
                <Filter class="w-4 h-4" />
              </template>
              Lọc
            </v-btn>
            <v-btn
              variant="tonal"
              icon
              @click="resetFilter"
              :title="'Đặt lại'"
              style="width: 44px; height: 44px; min-width: 44px;"
            >
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
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

            <v-table v-else fixed-header hover>
              <thead>
                <tr>
                  <th class="text-left">Mã HĐ</th>
                  <th class="text-left">Khách hàng</th>
                  <th class="text-left">Ngày tạo</th>
                  <th class="text-right">Tổng tiền</th>
                  <th class="text-right">Thành tiền</th>
                  <th class="text-center">Trạng thái</th>
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

            <v-table v-else fixed-header hover>
              <thead>
                <tr>
                  <th class="text-left">Mã HĐ</th>
                  <th class="text-left">Khách hàng</th>
                  <th class="text-left">Ngày tạo</th>
                  <th class="text-left">Chi tiết</th>
                  <th class="text-right">Tổng tiền</th>
                  <th class="text-right">Thành tiền</th>
                  <th class="text-center">Trạng thái</th>
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

  <!-- Detail Modal & Thermal Receipt Print Template (Đồng bộ 100% với HoaDon.vue) -->
  <Teleport to="body">
    <div 
      v-if="isModalOpen && selectedHd" 
      class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 lg:p-8 bg-slate-950/80 backdrop-blur-md transition-all print:p-0 print:bg-white print:static print:inset-auto"
      @click="isModalOpen = false"
    >
      <div 
        class="act-modal-container relative w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 print:shadow-none print:border-none print:max-w-full print:w-full print:bg-white"
        :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
        @click.stop
      >
        <!-- Modal Header -->
        <div class="px-8 md:px-12 py-5 border-b flex items-center justify-between relative overflow-hidden bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 text-white print:hidden">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-md flex-shrink-0">
              <Receipt class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-extrabold text-base md:text-lg text-white tracking-wide">
                HÓA ĐƠN CHI TIẾT
              </h3>
              <p class="text-xs text-sky-100 font-mono opacity-90">
                Mã hóa đơn: #{{ selectedHd.maHd }}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <button 
              @click="printInvoice" 
              class="h-9 px-4 text-xs font-extrabold bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Printer class="w-4 h-4" /> In Hóa Đơn (Máy in POS)
            </button>
            <button 
              @click="isModalOpen = false" 
              class="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Modal Body -->
        <div class="p-6 md:p-10 flex flex-col items-center justify-center max-h-[80vh] overflow-y-auto custom-scrollbar print:max-h-none print:p-0 print:overflow-visible">
          
          <div id="invoice-print" class="w-full max-w-3xl mx-auto px-4 md:px-8 py-2 flex flex-col gap-6 print:max-w-full print:px-0 print:py-0 print:gap-2.5">
            
            <!-- Header Tiêu Đề Salon -->
            <div class="text-center border-b pb-4 print:border-b print:border-black print:pb-1.5">
              <h1 class="text-2xl print:text-base font-black uppercase tracking-wider text-sky-500 print:text-black mb-1">MINH TÂM HAIR SALON</h1>
              <p class="text-xs font-medium print:text-[10px] print:text-black" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
              <p class="text-xs font-extrabold text-sky-600 print:text-[10px] print:text-black mt-0.5">Hotline: 0123.456.789</p>
            </div>

            <!-- Tiêu đề Phiếu thanh toán khi in máy in thực tế -->
            <div class="hidden print:block text-center font-extrabold text-xs uppercase tracking-wider border-b border-dashed border-black pb-1.5">
              PHIẾU THANH TOÁN HÓA ĐƠN
            </div>

            <!-- Invoice Info Cards Grid -->
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border print:hidden" :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'">
              
              <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">MÃ HÓA ĐƠN</span>
                <span class="text-xs md:text-sm font-extrabold font-mono text-sky-500 whitespace-nowrap">#{{ selectedHd.maHd }}</span>
              </div>

              <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">NGÀY TẠO</span>
                <span class="text-xs font-bold font-mono whitespace-nowrap" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span>
              </div>

              <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">KHÁCH HÀNG</span>
                <span class="text-xs md:text-sm font-black truncate w-full" :class="isDarkMode ? 'text-white' : 'text-slate-900'">{{ selectedHd.tenKh || selectedHd.khachHang || 'Khách vãng lai' }}</span>
              </div>

              <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">THU NGÂN</span>
                <span class="text-xs font-bold truncate w-full" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span>
              </div>

            </div>

            <!-- Khung thông tin hóa đơn DÀNH RIÊNG CHO MÁY IN POS -->
            <div class="hidden print:flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2 font-mono">
              <div class="flex justify-between"><span>Mã hóa đơn:</span> <strong>#{{ selectedHd.maHd }}</strong></div>
              <div class="flex justify-between"><span>Ngày tạo:</span> <span>{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></div>
              <div class="flex justify-between"><span>Khách hàng:</span> <strong>{{ selectedHd.tenKh || selectedHd.khachHang || 'Khách vãng lai' }}</strong></div>
              <div class="flex justify-between"><span>Thu ngân:</span> <span>{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span></div>
            </div>

            <!-- Invoice Items Table -->
            <div class="overflow-x-auto rounded-xl border print:border-none print:rounded-none print:overflow-visible print:w-full" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
              <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[550px] print:min-w-0 print:w-full print:text-[10px] print:table-fixed">
                <thead>
                  <tr :class="[isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-100 text-slate-700 border-b border-slate-200', 'print:bg-transparent print:text-black print:border-t print:border-b print:border-dashed print:border-black']">
                    <th class="py-3.5 px-6 font-extrabold uppercase print:py-1 print:px-0 print:w-[50%] print:text-left">Tên Sản phẩm / Dịch vụ</th>
                    <th class="py-3.5 px-6 font-extrabold uppercase text-center w-20 print:w-[15%] print:py-1 print:px-0 print:text-center">SL</th>
                    <th class="py-3.5 px-6 font-extrabold uppercase print:py-1 print:px-0 print:hidden">Ghi chú</th>
                    <th class="py-3.5 px-6 font-extrabold uppercase text-right print:w-[35%] print:py-1 print:px-0 print:text-right">Thành tiền</th>
                  </tr>
                </thead>
                <tbody class="divide-y print:divide-y-0" :class="isDarkMode ? 'divide-slate-800' : 'divide-slate-100'">
                  <tr 
                    v-for="(item, index) in getInvoiceItems(selectedHd)" 
                    :key="index"
                    :class="[isDarkMode ? 'text-slate-200' : 'text-slate-800', 'print:text-black']"
                  >
                    <td class="py-4 px-6 font-bold print:py-1 print:px-0 print:font-normal print:w-[50%] print:break-words text-left" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                      {{ getItemName(item) }}
                    </td>
                    <td class="py-4 px-6 text-center font-bold font-mono print:py-1 print:px-0 print:font-normal print:w-[15%] print:text-center">
                      {{ getItemQty(item) }}
                    </td>
                    <td class="py-4 px-6 print:hidden">
                      <span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border" :class="isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'">
                        {{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}
                      </span>
                    </td>
                    <td class="py-4 px-6 text-right font-black font-mono print:py-1 print:px-0 print:font-bold print:w-[35%] print:text-right" :class="isDarkMode ? 'text-sky-400' : 'text-slate-900'">
                      {{ getItemPrice(item).toLocaleString() }}₫
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Total Revenue Footer -->
            <div class="flex flex-col items-end gap-2 pt-5 px-2 border-t print:pt-2 print:border-t print:border-dashed print:border-black print:items-stretch" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
              <div class="flex items-center justify-between w-full text-xs print:text-[11px]" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                <span>Tạm tính gốc:</span>
                <strong :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'" class="print:text-black">{{ selectedHd.tongTien?.toLocaleString() }}₫</strong>
              </div>
              <div v-if="selectedHd.giamGiaVip" class="flex items-center justify-between w-full text-xs font-bold text-rose-500 print:text-[11px] print:text-black">
                <span>Giảm giá VIP:</span>
                <span>-{{ selectedHd.giamGiaVip }}%</span>
              </div>
              <div class="flex items-center justify-between w-full text-base md:text-lg font-bold print:text-xs print:pt-1 print:border-t print:border-black">
                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'" class="print:text-black font-extrabold">TỔNG THANH TOÁN:</span>
                <span class="font-black text-sky-500 font-mono text-lg md:text-xl print:text-black print:text-sm print:font-extrabold">{{ selectedHd.thanhTien?.toLocaleString() }}₫</span>
              </div>
            </div>

            <!-- Lời cảm ơn dành riêng cho trang in hóa đơn máy in nhiệt POS K80 -->
            <div class="hidden print:flex flex-col items-center justify-center text-center mt-3 pt-3 border-t border-dashed border-black gap-1">
              <p class="text-[11px] font-bold">Cảm ơn Quý khách & Hẹn gặp lại!</p>
              <p class="text-[9px]">Hotline CSKH: 0123.456.789 - Website: lghair.vn</p>
            </div>

          </div>
        </div>

        <!-- Modal Footer -->
        <div 
          class="px-8 md:px-12 py-4 border-t flex items-center justify-center print:hidden transition-colors"
          :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
        >
          <button 
            @click="isModalOpen = false" 
            class="act-modal-close-btn h-11 px-10 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center"
          >
            <span>Đóng cửa sổ</span>
          </button>
        </div>

      </div>
    </div>
  </Teleport>
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