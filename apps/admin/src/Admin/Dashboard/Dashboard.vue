<script setup>
import { ref, onMounted, computed } from 'vue';
import { Line } from 'vue-chartjs';
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

    const res = await fetch(`https://localhost:7196/api/ThongKe/admin-dashboard?${qs}`, {
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
    const res = await fetch('https://localhost:7196/api/QuanLyDanhGiaDichVu/thong-ke-nhan-vien', {
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

const viewDetail = async (maHd) => {
  try {
    const tokenHeaders = getAuthHeaders();
    const res = await fetch(`https://localhost:7196/api/admin/hoa-don/chi-tiet/${maHd}`, {
      method: 'GET',
      headers: {
        ...tokenHeaders,
        'Content-Type': 'application/json'
      }
    });
    const result = await res.json();
    if (result.success) {
      const detail = result.data;
      const match = stats.value.hoaDonSanPham?.find(h => String(h.maHd || h.MaHd || '').toUpperCase() === String(maHd).toUpperCase());
      if (match && (match.chiTiet || match.ChiTiet)) {
        detail.chiTiet = match.chiTiet || match.ChiTiet;
      }
      selectedHd.value = detail;
      isModalOpen.value = true;
    } else {
      alert("Không thể tải chi tiết hóa đơn: " + (result.message || ""));
    }
  } catch (e) {
    alert("Không thể tải chi tiết hóa đơn");
  }
};

const printInvoice = () => { window.print(); };

const resetFilter = () => {
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

  <!-- Detail Modal -->
  <Teleport to="body">
    <div v-if="isModalOpen" class="hd-modal-overlay">
      <div class="hd-modal-container">
        <div class="hd-modal-header print:hidden">
          <h3 class="hd-modal-title">Hóa đơn chi tiết: #{{ selectedHd.maHd }}</h3>
          <div class="hd-modal-header-actions">
            <button @click="printInvoice" class="hd-btn-print">
              <Printer class="w-4 h-4" /> In Hóa Đơn
            </button>
            <button @click="isModalOpen = false" class="hd-btn-close">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <div class="hd-modal-body">
          <div id="invoice-print" class="hd-invoice-print">
            <div class="hd-invoice-print-header">
              <h1>Minh Tâm Hair Salon</h1>
              <p>Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
              <p style="font-weight: 700;">Hotline: 0123.456.789</p>
            </div>

            <div class="hd-invoice-info-grid">
              <div class="hd-invoice-info-left">
                <p><span class="hd-invoice-info-label">Mã HĐ:</span> <span class="hd-invoice-info-value">#{{ selectedHd.maHd }}</span></p>
                <p><span class="hd-invoice-info-label">Ngày tạo:</span> <span class="hd-invoice-info-value" style="color: #334155;">{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></p>
              </div>
              <div class="hd-invoice-info-right">
                <p><span class="hd-invoice-info-label">Khách hàng:</span> <span class="hd-invoice-info-value">{{ selectedHd.tenKh }}</span></p>
                <p><span class="hd-invoice-info-label">Tổng thu ngân:</span> <span class="hd-invoice-info-value" style="color: #334155;">{{ selectedHd.tenThuNgan }}</span></p>
              </div>
            </div>

            <table class="hd-invoice-table">
              <thead>
                <tr>
                  <th style="text-align: left;">Tên Sản phẩm / Dịch vụ</th>
                  <th style="text-align: center; width: 80px;">Số lượng</th>
                  <th style="text-align: left;">Người thực hiện / Ghi chú</th>
                  <th style="text-align: right;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, index) in (selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? (selectedHd.chiTiet || selectedHd.chiTietDichVu || []) : (selectedHd.chiTietDichVu || []))" :key="index">
                  <td style="font-weight: 500;">{{ item.ten || item.Ten || item.tenHangMuc || item.tenSP || item.tenSp }}</td>
                  <td style="text-align: center; font-weight: 600;">{{ item.soLuong || item.SoLuong || item.soluong || 1 }}</td>
                  <td><span class="hd-invoice-badge">{{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}</span></td>
                  <td style="text-align: right; font-weight: 700; color: #0f172a;">{{ (item.gia || item.Gia || item.giaBan || 0).toLocaleString() }}₫</td>
                </tr>
              </tbody>
            </table>

            <div class="print:hidden hd-invoice-quick-update">
              <span class="hd-invoice-quick-update-label">Trạng thái hóa đơn:</span>
              <span class="hd-invoice-badge" style="font-size: 12px; font-weight: 700; text-transform: uppercase;">
                {{ trangThaiLabel(selectedHd.trangThai) }}
              </span>
            </div>

            <div class="hd-invoice-total">
              <p class="hd-invoice-total-sub">Tạm tính gốc: <strong>{{ selectedHd.tongTien?.toLocaleString() }}₫</strong></p>
              <p v-if="selectedHd.giamGiaVip" class="hd-invoice-total-vip">Giảm giá VIP: -{{ selectedHd.giamGiaVip }}%</p>
              <p class="hd-invoice-total-main">Tổng doanh thu nhận về: {{ selectedHd.thanhTien?.toLocaleString() }}₫</p>
            </div>
          </div>
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

/* ── Modal overlay for detail view ── */
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
    max-width: 680px;
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
.hd-modal-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}
.hd-btn-print {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
}
.hd-btn-print:hover {
    background-color: #1d4ed8 !important;
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
    max-height: 80vh;
    overflow-y: auto;
}

.hd-invoice-print {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    color: #1e293b;
}
.hd-invoice-print-header {
    text-align: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
}
.hd-invoice-print-header h1 {
    font-size: 22px;
    font-weight: 800;
    text-transform: uppercase;
    color: #2563eb;
    margin: 0 0 4px 0;
    letter-spacing: 0.05em;
}
.hd-invoice-print-header p {
    font-size: 13px;
    color: #64748b;
    margin: 2px 0;
}
.hd-invoice-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background-color: #f8fafc;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid #edf2f7;
    font-size: 13px;
}
.hd-invoice-info-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.hd-invoice-info-right {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: right;
}
.hd-invoice-info-label {
    color: #94a3b8;
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
    margin-right: 4px;
}
.hd-invoice-info-value {
    color: #334155;
    font-weight: 700;
}
.hd-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
}
.hd-invoice-table th {
    padding: 10px 14px;
    background-color: #f8fafc;
    color: #475569;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
}
.hd-invoice-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
}
.hd-invoice-table tbody tr:last-child td {
    border-bottom: none;
}
.hd-invoice-badge {
    padding: 2px 8px;
    border-radius: 4px;
    background-color: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
}
.hd-invoice-total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
}
.hd-invoice-total-sub {
    font-size: 13px;
    color: #64748b;
}
.hd-invoice-total-vip {
    font-size: 13px;
    color: #ef4444;
    font-weight: 600;
}
.hd-invoice-total-main {
    font-size: 18px;
    font-weight: 800;
    color: #2563eb;
}
</style>

<style>
@media print {
    #app {
        display: none !important;
    }
    body {
        background-color: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    .hd-modal-overlay {
        position: static !important;
        background: none !important;
        backdrop-filter: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: auto !important;
        display: block !important;
    }
    .hd-modal-container {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
    }
    .hd-invoice-print {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
    }
    .hd-modal-overlay,
    .hd-modal-overlay *,
    .hd-modal-container,
    .hd-modal-container * {
        visibility: visible !important;
    }
    .print\:hidden,
    .hd-modal-header {
        display: none !important;
    }
}
</style>