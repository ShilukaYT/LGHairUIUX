<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useTheme } from 'vuetify'
import axios from 'axios'
import apexchart from 'vue3-apexcharts'
import {
  CalendarDays,
  Trophy,
  Sparkles,
  Search,
  Printer,
  CheckCircle2,
  TrendingUp,
  RotateCcw
} from 'lucide-vue-next'
import Swal from 'sweetalert2'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196'
axios.defaults.withCredentials = true

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

// State
const isLoading = ref(true)
const dashboardData = ref<any>(null)
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(new Date().getFullYear())

// Dropdown data
const months = Array.from({ length: 12 }, (_, i) => ({
  title: `Tháng ${i + 1}`,
  value: i + 1
}))
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => ({
  title: `Năm ${currentYear - 2 + i}`,
  value: currentYear - 2 + i
}))

// Fetch employee info
const getCurrentUser = () => {
  const raw =
    sessionStorage.getItem('staffUser') ||
    sessionStorage.getItem('nhanVienUser') ||
    localStorage.getItem('staffUser') ||
    localStorage.getItem('nhanVienUser') ||
    sessionStorage.getItem('adminUser') ||
    localStorage.getItem('adminUser')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const user = getCurrentUser()
const maNV = user?.maNv || user?.MaNv || ''

// Fetch income data
const fetchIncomeData = async (isFilter = false) => {
  if (!maNV) {
    Swal.fire({
      icon: 'error',
      title: 'Lỗi xác thực',
      text: 'Không tìm thấy thông tin nhân viên.',
      confirmButtonColor: '#10b981'
    })
    isLoading.value = false
    return
  }

  isLoading.value = true
  try {
    let url = `${API_BASE_URL}/api/ThongKeThuNhap/thang-hien-tai/${maNV}`
    if (isFilter) {
      url = `${API_BASE_URL}/api/ThongKeThuNhap/loc-theo-thang/${maNV}?month=${selectedMonth.value}&year=${selectedYear.value}`
    }

    const res = await axios.get(url)
    const data = res.data

    const rawThangHienTai = data.thangHienTai || data.ThangHienTai
    dashboardData.value = {
      maNv: data.maNV || data.maNv || data.MaNv || data.MaNV || '',
      hoTenNv: data.hoTenNV || data.hoTenNv || data.HoTenNv || data.HoTenNV || '',
      chucVu: data.chucVu || data.ChucVu || '',
      luongCoBan: data.luongCoBan !== undefined ? data.luongCoBan : (data.LuongCoBan || 0),
      xepHangTrongThang: data.xepHangTrongThang !== undefined ? data.xepHangTrongThang : (data.XepHangTrongThang || null),
      luotYeuThich: data.luotYeuThich !== undefined ? data.luotYeuThich : (data.LuotYeuThich || 0),
      thangHienTai: rawThangHienTai
        ? {
            thangNam: rawThangHienTai.thangNam || rawThangHienTai.ThangNam || '',
            soNgayDiLam: rawThangHienTai.soNgayDiLam !== undefined ? rawThangHienTai.soNgayDiLam : (rawThangHienTai.SoNgayDiLam || 0),
            soNgayNghi: rawThangHienTai.soNgayNghi !== undefined ? rawThangHienTai.soNgayNghi : (rawThangHienTai.SoNgayNghi || 0),
            luongThucTeTheoNgay: rawThangHienTai.luongThucTeTheoNgay !== undefined ? rawThangHienTai.luongThucTeTheoNgay : (rawThangHienTai.LuongThucTeTheoNgay || 0),
            hoaHongSanPham: rawThangHienTai.hoaHongSanPham !== undefined ? rawThangHienTai.hoaHongSanPham : (rawThangHienTai.HoaHongSanPham || 0),
            hoaHongDichVu: rawThangHienTai.hoaHongDichVu !== undefined ? rawThangHienTai.hoaHongDichVu : (rawThangHienTai.HoaHongDichVu || 0),
            tongThuNhap: rawThangHienTai.tongThuNhap !== undefined ? rawThangHienTai.tongThuNhap : (rawThangHienTai.TongThuNhap || 0)
          }
        : null
    }

    if (!isFilter && dashboardData.value?.thangHienTai?.thangNam) {
      const parts = dashboardData.value.thangHienTai.thangNam.split('/')
      if (parts.length === 2) {
        selectedMonth.value = parseInt(parts[0])
        selectedYear.value = parseInt(parts[1])
      }
    }
  } catch (error: any) {
    Swal.fire({
      icon: 'info',
      title: 'Thông báo',
      text: error.response?.data?.message || 'Chưa sẵn sàng dữ liệu.',
      confirmButtonColor: '#10b981'
    })
    dashboardData.value = null
  } finally {
    isLoading.value = false
  }
}

// Format currency
const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
}

// Compute percentage
const breakdownPercentages = computed(() => {
  const details = dashboardData.value?.thangHienTai
  if (!details || details.tongThuNhap <= 0) return { luongCoBan: 0, hoaHongDV: 0, hoaHongSP: 0 }
  const total = details.tongThuNhap
  return {
    luongCoBan: Math.round((details.luongThucTeTheoNgay / total) * 100),
    hoaHongDV: Math.round((details.hoaHongDichVu / total) * 100),
    hoaHongSP: Math.round((details.hoaHongSanPham / total) * 100)
  }
})

// Average income per worked day
const averageIncomePerDay = computed(() => {
  const details = dashboardData.value?.thangHienTai
  if (!details || details.soNgayDiLam <= 0) return 0
  return Math.round(details.tongThuNhap / details.soNgayDiLam)
})

// Interactive Goals Checklist
const computedGoalsList = computed(() => {
  const details = dashboardData.value?.thangHienTai
  const workedDays = details?.soNgayDiLam || 0
  const prodComm = details?.hoaHongSanPham || 0
  const servComm = details?.hoaHongDichVu || 0
  const totalComm = prodComm + servComm
  const rank = dashboardData.value?.xepHangTrongThang || 0
  const likes = dashboardData.value?.luotYeuThich || 0

  return [
    { id: 1, text: 'Ngày công chuẩn', subtext: 'Tối thiểu 22 ngày', done: workedDays >= 22, current: `${workedDays}/22` },
    { id: 2, text: 'Hoa hồng DV & SP', subtext: 'Mục tiêu 5.000.000đ', done: totalComm >= 5000000, current: totalComm > 0 ? formatVND(totalComm) : '0 đ' },
    { id: 3, text: 'Xếp hạng nhân viên', subtext: 'Đạt Top 3', done: rank > 0 && rank <= 3, current: rank > 0 ? `Top ${rank}` : '--' },
    { id: 4, text: 'Lượt yêu thích', subtext: 'Đạt 5 đánh giá tốt', done: likes >= 5, current: `${likes}/5` }
  ]
})

const completedGoalsCount = computed(() => computedGoalsList.value.filter(g => g.done).length)

const handlePrint = () => window.print()

// ApexCharts options
const chartOptions = computed(() => {
  const dark = isDark.value
  return {
    chart: {
      type: 'donut',
      fontFamily: 'inherit',
      sparkline: { enabled: true },
      background: 'transparent'
    },
    labels: ['Lương cơ bản', 'Hoa hồng dịch vụ', 'Hoa hồng sản phẩm'],
    colors: ['#10B981', '#F43F5E', '#F59E0B'],
    stroke: { width: 2, colors: [dark ? '#1f1f1f' : '#ffffff'] },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: {
      theme: dark ? 'dark' : 'light',
      y: { formatter: (val: number) => formatVND(val) }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '78%',
          labels: {
            show: true,
            name: {
              show: true,
              fontSize: '12px',
              fontWeight: 600,
              color: dark ? '#94A3B8' : '#64748B',
              offsetY: -4
            },
            value: {
              show: true,
              fontSize: '22px',
              fontWeight: 700,
              color: dark ? '#F8FAFC' : '#0F172A',
              offsetY: 8,
              formatter: (val: any) => formatVND(val)
            },
            total: {
              show: true,
              label: 'Thực nhận',
              color: dark ? '#94A3B8' : '#64748B',
              formatter: (w: any) =>
                formatVND(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0))
            }
          }
        }
      }
    }
  }
})

const chartSeries = computed(() => {
  const details = dashboardData.value?.thangHienTai
  if (!details) return [0, 0, 0]
  return [
    details.luongThucTeTheoNgay || 0,
    details.hoaHongDichVu || 0,
    details.hoaHongSanPham || 0
  ]
})

const onApplyFilter = () => fetchIncomeData(true)

onMounted(() => fetchIncomeData())
</script>

<template>
  <v-container fluid class="pa-4 pa-md-6 th-page-container">

    <!-- ═══════ HEADER & BỘ LỌC TÌM KIẾM ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-5 pa-md-6 mb-6 print-hide border">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div>
          <h1 class="text-h4 font-weight-bold text-high-emphasis mb-1">
            Thu nhập của bạn.
          </h1>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Theo dõi hiệu suất và chiết khấu hoa hồng Minh Tâm Hair
          </p>
        </div>

        <!-- BỘ LỌC NGÀY THÁNG VUETIFY -->
        <div class="d-flex align-center gap-3 flex-wrap">
          <!-- DATE PILL SELECTOR -->
          <div class="th-date-pill-wrapper d-flex align-center px-4 py-1.5 rounded-pill border">
            <CalendarDays class="w-5 h-5 text-medium-emphasis shrink-0 mr-2" />
            <v-select
              v-model="selectedMonth"
              :items="months"
              item-title="title"
              item-value="value"
              density="compact"
              variant="plain"
              hide-details
              class="th-pill-select"
              style="width: 120px;"
            ></v-select>

            <v-divider vertical class="mx-2 my-1" style="height: 20px;"></v-divider>

            <v-select
              v-model="selectedYear"
              :items="years"
              item-title="title"
              item-value="value"
              density="compact"
              variant="plain"
              hide-details
              class="th-pill-select"
              style="width: 110px;"
            ></v-select>
          </div>

          <!-- NÚT TÌM KIẾM -->
          <v-btn
            color="primary"
            rounded="pill"
            elevation="2"
            height="44"
            class="text-none font-weight-bold px-6"
            :loading="isLoading"
            @click="onApplyFilter"
          >
            <template v-slot:prepend>
              <Search class="w-4 h-4 mr-1" />
            </template>
            Tìm kiếm
          </v-btn>

          <!-- NÚT IN PHIẾU -->
          <v-btn
            v-if="dashboardData?.thangHienTai"
            variant="outlined"
            color="grey"
            rounded="circle"
            icon
            height="44"
            width="44"
            @click="handlePrint"
            title="In phiếu"
          >
            <Printer class="w-4 h-4" />
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ SKELETON LOADING ═══════ -->
    <div v-if="isLoading" class="d-flex flex-column gap-6">
      <v-row>
        <v-col cols="12" lg="7">
          <v-skeleton-loader type="card" height="260" rounded="xl" elevation="2" />
        </v-col>
        <v-col cols="12" lg="5">
          <v-skeleton-loader type="card" height="260" rounded="xl" elevation="2" />
        </v-col>
      </v-row>
      <v-row>
        <v-col v-for="i in 3" :key="i" cols="12" md="4">
          <v-skeleton-loader type="card" height="130" rounded="xl" elevation="2" />
        </v-col>
      </v-row>
      <v-skeleton-loader type="table" height="240" rounded="xl" elevation="2" />
    </div>

    <!-- ═══════ KẾT QUẢ THỐNG KÊ ═══════ -->
    <div v-else-if="dashboardData && dashboardData.thangHienTai" class="d-flex flex-column gap-6">

      <!-- Dòng 1: Thẻ Doanh Thu & Thẻ Mục Tiêu -->
      <v-row>
        <!-- THẺ DOANH THU -->
        <v-col cols="12" lg="7">
          <v-card
            elevation="3"
            rounded="xl"
            class="pa-6 pa-md-7 position-relative overflow-hidden h-100 th-revenue-card d-flex flex-column justify-space-between"
          >
            <!-- Biểu đồ đà tăng trưởng in chìm -->
            <div class="th-trend-bg position-absolute">
              <svg viewBox="0 0 400 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M0,150 L50,120 L100,130 L180,70 L250,90 L380,20 L400,0 L400,150 Z"
                  fill="rgba(16, 185, 129, 0.08)"
                />
                <path
                  d="M0,150 L50,120 L100,130 L180,70 L250,90 L380,20 L400,0"
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.35)"
                  stroke-width="3"
                />
              </svg>
            </div>

            <!-- Header Thẻ Doanh Thu -->
            <div class="d-flex justify-space-between align-center mb-6 position-relative z-index-2">
              <span class="text-subtitle-2 font-weight-black text-success letter-spacing-1">
                LGHAIR SALON
              </span>
              <v-chip
                color="success"
                variant="flat"
                size="small"
                class="font-weight-bold text-caption px-3.5"
              >
                Kỳ lương: {{ dashboardData.thangHienTai.thangNam }}
              </v-chip>
            </div>

            <!-- Nội dung chính: Số tiền thu nhập -->
            <div class="position-relative z-index-2 my-2">
              <div class="d-flex align-center mb-1.5">
                <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis letter-spacing-05">
                  TỔNG THU NHẬP THỰC NHẬN
                </span>
                <TrendingUp class="w-4 h-4 text-success ml-2" />
              </div>
              <div class="text-h3 font-weight-black text-success th-revenue-amount">
                {{ formatVND(dashboardData.thangHienTai.tongThuNhap) }}
              </div>
            </div>

            <!-- Footer Thẻ Doanh Thu: Thông tin nhân viên -->
            <div class="d-flex flex-column flex-sm-row justify-space-between align-sm-end gap-3 pt-5 border-t position-relative z-index-2">
              <div>
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-0.5">
                  NHÂN VIÊN STYLIST
                </div>
                <div class="text-h6 font-weight-bold text-high-emphasis">
                  {{ dashboardData.hoTenNv }}
                </div>
              </div>

              <div class="d-flex align-center gap-2">
                <v-chip variant="outlined" color="success" size="small" class="font-weight-medium px-3">
                  <span class="text-caption text-medium-emphasis mr-1">MÃ NV:</span>
                  <strong>{{ dashboardData.maNv }}</strong>
                </v-chip>
                <v-chip variant="outlined" color="primary" size="small" class="font-weight-medium px-3">
                  <span class="text-caption text-medium-emphasis mr-1">CHỨC VỤ:</span>
                  <strong>{{ dashboardData.chucVu }}</strong>
                </v-chip>
              </div>
            </div>
          </v-card>
        </v-col>

        <!-- THẺ MỤC TIÊU THÁNG -->
        <v-col cols="12" lg="5">
          <v-card
            elevation="2"
            rounded="xl"
            class="pa-6 pa-md-7 h-100 d-flex flex-column justify-space-between print-hide border"
          >
            <div>
              <div class="d-flex justify-space-between align-center mb-5">
                <h3 class="text-subtitle-1 font-weight-bold text-uppercase text-high-emphasis">
                  MỤC TIÊU THÁNG
                </h3>
                <v-chip
                  color="primary"
                  variant="tonal"
                  size="small"
                  class="font-weight-bold px-3"
                >
                  {{ completedGoalsCount }}/{{ computedGoalsList.length }}
                </v-chip>
              </div>

              <!-- DANH SÁCH MỤC TIÊU (PADDED & AIRY) -->
              <div class="d-flex flex-column gap-3.5">
                <div
                  v-for="goal in computedGoalsList"
                  :key="goal.id"
                  class="d-flex align-center justify-space-between px-4 py-3.5 rounded-lg th-goal-item border"
                  :class="{ 'th-goal-done': goal.done }"
                >
                  <div class="d-flex align-center gap-3.5">
                    <div
                      class="th-goal-check-icon rounded-circle d-flex align-center justify-center"
                      :class="goal.done ? 'bg-success text-white' : 'th-goal-icon-pending'"
                    >
                      <CheckCircle2 v-if="goal.done" class="w-4 h-4" />
                      <span v-else class="text-caption font-weight-bold">{{ goal.id }}</span>
                    </div>
                    <div>
                      <div class="text-body-2 font-weight-bold text-high-emphasis">
                        {{ goal.text }}
                      </div>
                      <div class="text-caption text-medium-emphasis mt-0.5">
                        {{ goal.subtext }}
                      </div>
                    </div>
                  </div>

                  <v-chip
                    :color="goal.done ? 'success' : 'default'"
                    :variant="goal.done ? 'flat' : 'tonal'"
                    size="small"
                    class="font-weight-bold text-caption px-3"
                  >
                    {{ goal.current }}
                  </v-chip>
                </div>
              </div>
            </div>

            <!-- BẢNG THƯỞNG KHI HOÀN THÀNH (PADDED & SPACIOUS) -->
            <div
              class="px-4 py-4 mt-5 d-flex align-center justify-space-between rounded-lg border th-bonus-box"
              :class="completedGoalsCount === computedGoalsList.length ? 'border-success th-bonus-earned-border' : ''"
            >
              <div>
                <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-0.5">
                  THƯỞNG HOÀN THÀNH
                </div>
                <div class="text-subtitle-1 font-weight-black text-success">
                  +500.000đ
                </div>
              </div>

              <div>
                <v-chip
                  v-if="completedGoalsCount === computedGoalsList.length"
                  color="success"
                  variant="flat"
                  size="small"
                  class="font-weight-bold px-3"
                >
                  Đã đạt
                </v-chip>
                <v-chip
                  v-else
                  color="grey"
                  variant="tonal"
                  size="small"
                  class="font-weight-medium px-3"
                >
                  Chưa đạt
                </v-chip>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Dòng 2: 3 Chỉ số phụ -->
      <v-row>
        <!-- Thẻ Chuyên Cần -->
        <v-col cols="12" sm="4">
          <v-card elevation="2" rounded="xl" class="pa-6 h-100 border">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                CHUYÊN CẦN
              </span>
              <CalendarDays class="w-4 h-4 text-medium-emphasis" />
            </div>

            <div class="d-flex align-baseline gap-1.5 my-2">
              <span class="text-h4 font-weight-black text-high-emphasis">
                {{ dashboardData.thangHienTai.soNgayDiLam }}
              </span>
              <span class="text-subtitle-1 text-medium-emphasis">/ 26</span>
            </div>

            <div class="text-caption text-medium-emphasis d-flex align-center gap-2 mt-3 pt-3 border-t">
              <span class="d-flex align-center gap-1.5">
                <span class="th-dot bg-success"></span> Làm: <strong class="text-high-emphasis">{{ dashboardData.thangHienTai.soNgayDiLam }}</strong>
              </span>
              <span class="text-disabled">|</span>
              <span class="d-flex align-center gap-1.5">
                <span class="th-dot bg-grey"></span> Nghỉ: <strong class="text-high-emphasis">{{ dashboardData.thangHienTai.soNgayNghi }}</strong>
              </span>
            </div>
          </v-card>
        </v-col>

        <!-- Thẻ Thi Đua -->
        <v-col cols="12" sm="4">
          <v-card elevation="2" rounded="xl" class="pa-6 h-100 border">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                THI ĐUA
              </span>
              <Trophy class="w-4 h-4 text-warning" />
            </div>

            <div class="d-flex align-baseline gap-1.5 my-2">
              <span class="text-h4 font-weight-black text-warning">
                #{{ dashboardData.xepHangTrongThang || '--' }}
              </span>
              <span class="text-subtitle-1 text-medium-emphasis">hệ thống</span>
            </div>

            <div class="text-caption text-warning font-weight-bold d-flex align-center gap-1.5 mt-3 pt-3 border-t">
              <Sparkles class="w-3.5 h-3.5 mr-0.5" /> Hiệu suất xuất sắc
            </div>
          </v-card>
        </v-col>

        <!-- Thẻ Bình Quân Ngày -->
        <v-col cols="12" sm="4">
          <v-card elevation="2" rounded="xl" class="pa-6 h-100 border">
            <div class="d-flex justify-space-between align-center mb-3">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">
                BÌNH QUÂN NGÀY
              </span>
              <TrendingUp class="w-4 h-4 text-medium-emphasis" />
            </div>

            <div class="d-flex align-baseline my-2">
              <span class="text-h5 font-weight-black text-high-emphasis">
                {{ formatVND(averageIncomePerDay) }}
              </span>
            </div>

            <div class="text-caption text-medium-emphasis mt-3 pt-3 border-t">
              Giá trị tạo ra trên mỗi ngày làm
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Dòng 3: Biểu đồ Cấu Trúc Doanh Thu -->
      <v-card elevation="2" rounded="xl" class="pa-6 pa-md-7 border">
        <v-row align="center">
          <!-- Apex Donut Chart -->
          <v-col cols="12" md="5" class="d-flex justify-center align-center">
            <div class="w-100 text-center py-2" style="max-width: 320px;">
              <apexchart
                v-if="chartSeries.some(v => v > 0)"
                type="donut"
                width="100%"
                height="250"
                :options="chartOptions"
                :series="chartSeries"
              />
              <div v-else class="text-medium-emphasis pa-6 font-italic">
                Chưa có số liệu biểu đồ
              </div>
            </div>
          </v-col>

          <!-- Thanh tỷ lệ ngang Cấu Trúc Doanh Thu -->
          <v-col cols="12" md="7">
            <h3 class="text-subtitle-1 font-weight-bold mb-5 uppercase text-high-emphasis">
              CẤU TRÚC DOANH THU
            </h3>

            <div class="d-flex flex-column gap-5">
              <!-- Lương cứng -->
              <div>
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <span class="text-body-2 font-weight-medium d-flex align-center gap-2 text-high-emphasis">
                    <span class="th-dot bg-success"></span> Lương cứng
                  </span>
                  <span class="text-body-2 font-weight-bold text-high-emphasis">
                    {{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}
                    <span class="text-caption text-medium-emphasis ml-1">({{ breakdownPercentages.luongCoBan }}%)</span>
                  </span>
                </div>
                <v-progress-linear
                  :model-value="breakdownPercentages.luongCoBan"
                  color="success"
                  height="9"
                  rounded
                  class="th-progress-bg"
                ></v-progress-linear>
              </div>

              <!-- Dịch vụ -->
              <div>
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <span class="text-body-2 font-weight-medium d-flex align-center gap-2 text-high-emphasis">
                    <span class="th-dot bg-error"></span> Dịch vụ
                  </span>
                  <span class="text-body-2 font-weight-bold text-high-emphasis">
                    {{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}
                    <span class="text-caption text-medium-emphasis ml-1">({{ breakdownPercentages.hoaHongDV }}%)</span>
                  </span>
                </div>
                <v-progress-linear
                  :model-value="breakdownPercentages.hoaHongDV"
                  color="error"
                  height="9"
                  rounded
                  class="th-progress-bg"
                ></v-progress-linear>
              </div>

              <!-- Sản phẩm -->
              <div>
                <div class="d-flex justify-space-between align-center mb-1.5">
                  <span class="text-body-2 font-weight-medium d-flex align-center gap-2 text-high-emphasis">
                    <span class="th-dot bg-warning"></span> Sản phẩm
                  </span>
                  <span class="text-body-2 font-weight-bold text-high-emphasis">
                    {{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}
                    <span class="text-caption text-medium-emphasis ml-1">({{ breakdownPercentages.hoaHongSP }}%)</span>
                  </span>
                </div>
                <v-progress-linear
                  :model-value="breakdownPercentages.hoaHongSP"
                  color="warning"
                  height="9"
                  rounded
                  class="th-progress-bg"
                ></v-progress-linear>
              </div>
            </div>
          </v-col>
        </v-row>
      </v-card>

      <!-- Dòng 4: Bảng Chi Tiết Giao Dịch -->
      <v-card elevation="2" rounded="xl" class="pa-6 pa-md-7 border">
        <h3 class="text-subtitle-1 font-weight-bold mb-5 uppercase text-high-emphasis">
          CHI TIẾT GIAO DỊCH (VND)
        </h3>

        <div class="border rounded-lg overflow-hidden">
          <v-table class="th-detail-table" hover>
            <thead>
              <tr class="th-table-header">
                <th class="text-uppercase text-caption font-weight-bold text-high-emphasis py-3 px-4">KHOẢN MỤC</th>
                <th class="text-uppercase text-caption font-weight-bold text-high-emphasis py-3 px-4">KHỐI LƯỢNG</th>
                <th class="text-uppercase text-caption font-weight-bold text-high-emphasis py-3 px-4">ĐƠN GIÁ / TỶ LỆ</th>
                <th class="text-uppercase text-caption font-weight-bold text-right text-high-emphasis py-3 px-4">THÀNH TIỀN</th>
              </tr>
            </thead>
            <tbody>
              <!-- Dòng 1: Lương cơ bản -->
              <tr>
                <td class="py-3.5 px-4">
                  <div class="font-weight-bold text-high-emphasis">Lương cơ bản</div>
                  <div class="d-md-none text-caption text-success font-weight-bold mt-1">
                    {{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}
                  </div>
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Ngày công: </span>
                  <strong>{{ dashboardData.thangHienTai.soNgayDiLam }}</strong> ngày
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Đơn giá: </span>
                  {{ formatVND(dashboardData.luongCoBan / 26) }}/ng
                </td>
                <td class="py-3.5 px-4 text-right font-weight-bold text-high-emphasis">
                  {{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}
                </td>
              </tr>

              <!-- Dòng 2: Chiết khấu dịch vụ -->
              <tr>
                <td class="py-3.5 px-4">
                  <div class="font-weight-bold text-high-emphasis">Chiết khấu dịch vụ</div>
                  <div class="d-md-none text-caption text-error font-weight-bold mt-1">
                    {{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}
                  </div>
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Khối lượng: </span>
                  Theo HĐ
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Tỷ lệ: </span>
                  Định mức
                </td>
                <td class="py-3.5 px-4 text-right font-weight-bold text-error">
                  {{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}
                </td>
              </tr>

              <!-- Dòng 3: Chiết khấu sản phẩm -->
              <tr>
                <td class="py-3.5 px-4">
                  <div class="font-weight-bold text-high-emphasis">Chiết khấu Sản phẩm</div>
                  <div class="d-md-none text-caption text-warning font-weight-bold mt-1">
                    {{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}
                  </div>
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Khối lượng: </span>
                  Theo HĐ
                </td>
                <td class="py-3.5 px-4 text-high-emphasis">
                  <span class="text-caption text-medium-emphasis d-md-none">Tỷ lệ: </span>
                  10%
                </td>
                <td class="py-3.5 px-4 text-right font-weight-bold text-warning">
                  {{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Footer Bảng tổng thu nhập -->
          <div class="d-flex justify-space-between align-center pa-4 pa-md-5 th-table-footer border-t font-weight-bold">
            <span class="text-subtitle-2 text-uppercase font-weight-black text-high-emphasis">TỔNG THU NHẬP</span>
            <span class="text-h6 font-weight-black text-success">
              {{ formatVND(dashboardData.thangHienTai.tongThuNhap) }}
            </span>
          </div>
        </div>
      </v-card>

    </div>

    <!-- ═══════ EMPTY STATE ═══════ -->
    <v-card v-else elevation="2" rounded="xl" class="pa-12 text-center border">
      <v-avatar color="surface" size="72" class="mb-4 border">
        <Search class="w-8 h-8 text-medium-emphasis" />
      </v-avatar>
      <h3 class="text-h6 font-weight-bold mb-1 text-high-emphasis">Không có dữ liệu</h3>
      <p class="text-body-2 text-medium-emphasis mb-4">
        Chưa có thông tin đối soát cho kỳ lương được chọn.
      </p>
      <v-btn
        color="primary"
        rounded="pill"
        elevation="1"
        class="text-none font-weight-bold px-6"
        @click="fetchIncomeData(false)"
      >
        <template v-slot:prepend>
          <RotateCcw class="w-4 h-4 mr-1" />
        </template>
        Về tháng hiện tại
      </v-btn>
    </v-card>

  </v-container>
</template>

<style scoped>
.th-page-container {
  max-width: 1140px;
  margin: 0 auto;
}

/* THẺ DOANH THU */
.th-revenue-card {
  border: 2px solid #10B981 !important;
  min-height: 260px;
  box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.15) !important;
}

.th-trend-bg {
  left: 0;
  bottom: 0;
  width: 100%;
  height: 140px;
  pointer-events: none;
  z-index: 1;
}

.th-revenue-amount {
  letter-spacing: -0.03em;
  text-shadow: 0 1px 2px rgba(16, 185, 129, 0.15);
}

/* THẺ MỤC TIÊU */
.th-goal-item {
  transition: all 0.2s ease;
  background: transparent !important;
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}

.th-goal-item:hover {
  border-color: rgba(var(--v-theme-on-surface), 0.28) !important;
}

.th-goal-done {
  border-color: rgba(16, 185, 129, 0.5) !important;
}

.th-goal-check-icon {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
}

.th-goal-icon-pending {
  background: transparent !important;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.25) !important;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

/* HỘP THƯỞNG HOÀN THÀNH */
.th-bonus-box {
  transition: all 0.2s ease;
  background: transparent !important;
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}

.th-bonus-earned-border {
  border-color: rgba(16, 185, 129, 0.8) !important;
}

/* BỘ LỌC NGÀY THÁNG */
.th-date-pill-wrapper {
  background: transparent !important;
  border-color: rgba(var(--v-theme-on-surface), 0.15) !important;
}

.th-pill-select :deep(.v-field__input) {
  padding: 0 4px;
  font-weight: 600;
  font-size: 0.875rem;
}

.th-pill-select :deep(.v-field__append-inner) {
  padding-left: 2px;
}

/* DOT CHỈ SỐ */
.th-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

/* BẢNG CHI TIẾT */
.th-table-header {
  background: transparent !important;
}

.th-table-footer {
  background: transparent !important;
}

.th-progress-bg :deep(.v-progress-linear__background) {
  opacity: 0.15 !important;
}

.letter-spacing-1 {
  letter-spacing: 0.1em !important;
}

.letter-spacing-05 {
  letter-spacing: 0.05em !important;
}

.z-index-2 {
  z-index: 2;
}

/* MEDIA PRINT */
@media print {
  .print-hide {
    display: none !important;
  }

  .th-page-container {
    padding: 0 !important;
    max-width: 100% !important;
  }

  .th-revenue-card {
    box-shadow: none !important;
    border: 1px solid #ccc !important;
  }
}
</style>