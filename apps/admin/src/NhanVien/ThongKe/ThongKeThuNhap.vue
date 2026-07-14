<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import {
  CalendarDays,
  Trophy,
  Sparkles,
  Search,
  Printer,
  CheckCircle2,
  TrendingUp,
  ChevronDown
} from 'lucide-vue-next'
import Swal from 'sweetalert2'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196'
axios.defaults.withCredentials = true

// State
const isLoading = ref(true)
const dashboardData = ref<any>(null)
const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(new Date().getFullYear())

// Dropdown data
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

// Fetch employee info
const getCurrentUser = () => {
  const raw = sessionStorage.getItem("staffUser") || sessionStorage.getItem("nhanVienUser") || sessionStorage.getItem("adminUser")
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

const user = getCurrentUser()
const maNV = user?.maNv || user?.MaNv || ''

// Fetch income data
const fetchIncomeData = async (isFilter = false) => {
  if (!maNV) {
    Swal.fire({ icon: 'error', title: 'Lỗi xác thực', text: 'Không tìm thấy thông tin nhân viên.', confirmButtonColor: '#10b981' })
    isLoading.value = false; return
  }

  isLoading.value = true
  try {
    let url = `${API_BASE_URL}/api/ThongKeThuNhap/thang-hien-tai/${maNV}`
    if (isFilter) url = `${API_BASE_URL}/api/ThongKeThuNhap/loc-theo-thang/${maNV}?month=${selectedMonth.value}&year=${selectedYear.value}`

    const res = await axios.get(url)
    const data = res.data

    const rawThangHienTai = data.thangHienTai || data.ThangHienTai
    dashboardData.value = {
      maNv: data.maNV || data.maNv || data.MaNv || data.MaNV || '',
      hoTenNv: data.hoTenNV || data.hoTenNv || data.HoTenNv || data.HoTenNV || '',
      chucVu: data.chucVu || data.ChucVu || '',
      luongCoBan: data.luongCoBan !== undefined ? data.luongCoBan : (data.LuongCoBan || 0),
      xepHangTrongThang: data.xepHangTrongThang !== undefined ? data.xepHangTrongThang : (data.XepHangTrongThang || null),
      thangHienTai: rawThangHienTai ? {
        thangNam: rawThangHienTai.thangNam || rawThangHienTai.ThangNam || '',
        soNgayDiLam: rawThangHienTai.soNgayDiLam !== undefined ? rawThangHienTai.soNgayDiLam : (rawThangHienTai.SoNgayDiLam || 0),
        soNgayNghi: rawThangHienTai.soNgayNghi !== undefined ? rawThangHienTai.soNgayNghi : (rawThangHienTai.SoNgayNghi || 0),
        luongThucTeTheoNgay: rawThangHienTai.luongThucTeTheoNgay !== undefined ? rawThangHienTai.luongThucTeTheoNgay : (rawThangHienTai.LuongThucTeTheoNgay || 0),
        hoaHongSanPham: rawThangHienTai.hoaHongSanPham !== undefined ? rawThangHienTai.hoaHongSanPham : (rawThangHienTai.HoaHongSanPham || 0),
        hoaHongDichVu: rawThangHienTai.hoaHongDichVu !== undefined ? rawThangHienTai.hoaHongDichVu : (rawThangHienTai.HoaHongDichVu || 0),
        tongThuNhap: rawThangHienTai.tongThuNhap !== undefined ? rawThangHienTai.tongThuNhap : (rawThangHienTai.TongThuNhap || 0)
      } : null
    }

    if (!isFilter && dashboardData.value?.thangHienTai?.thangNam) {
      const parts = dashboardData.value.thangHienTai.thangNam.split('/')
      if (parts.length === 2) { selectedMonth.value = parseInt(parts[0]); selectedYear.value = parseInt(parts[1]) }
    }
  } catch (error: any) {
    Swal.fire({ icon: 'info', title: 'Thông báo', text: error.response?.data?.message || 'Chưa sẵn sàng dữ liệu.', confirmButtonColor: '#10b981' })
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
  return {
    chart: { type: 'donut', fontFamily: '"Inter", sans-serif', sparkline: { enabled: true } },
    labels: ['Lương cơ bản', 'Hoa hồng dịch vụ', 'Hoa hồng sản phẩm'],
    colors: ['#10B981', '#F43F5E', '#F59E0B'],
    stroke: { width: 0 },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: {
      theme: 'light',
      y: { formatter: (val: number) => formatVND(val) }
    },
    plotOptions: {
      pie: {
        donut: {
          size: '80%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', fontWeight: 600, color: '#64748B', offsetY: -4, textTransform: 'uppercase' },
            value: { show: true, fontSize: '24px', fontWeight: 700, color: '#0F172A', offsetY: 8, formatter: (val: any) => formatVND(val) },
            total: { show: true, label: 'Thực nhận', color: '#64748B', formatter: (w: any) => formatVND(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)) }
          }
        }
      }
    }
  }
})

const chartSeries = computed(() => {
  const details = dashboardData.value?.thangHienTai
  if (!details) return [0, 0, 0]
  return [details.luongThucTeTheoNgay || 0, details.hoaHongDichVu || 0, details.hoaHongSanPham || 0]
})

const onApplyFilter = () => fetchIncomeData(true)

onMounted(() => fetchIncomeData())
</script>

<template>
  <div class="th-app">
    <div class="th-container">

      <!-- HEADER -->
      <header class="th-header print-hide">
        <div class="th-header-titles">
          <h1 class="th-page-title">Thu nhập của bạn.</h1>
          <p class="th-page-desc">Theo dõi hiệu suất và chiết khấu hoa hồng Minh Tâm Hair</p>
        </div>

        <!-- BỘ LỌC TÌM KIẾM -->
        <div class="th-filter-bar">
          <div class="th-date-pill">
            <CalendarDays class="th-icon-sm th-text-slate" />
            <div class="th-select-wrap">
              <select v-model="selectedMonth" class="th-select">
                <option v-for="m in months" :key="m" :value="m">Tháng {{ m }}</option>
              </select>
              <ChevronDown class="th-chevron" />
            </div>
            <div class="th-divider"></div>
            <div class="th-select-wrap">
              <select v-model="selectedYear" class="th-select">
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
              <ChevronDown class="th-chevron" />
            </div>
          </div>

          <button @click="onApplyFilter" class="th-btn-search">
            <Search class="th-icon-sm" /> Tìm kiếm
          </button>

          <button v-if="dashboardData?.thangHienTai" @click="handlePrint" class="th-btn-print" title="In phiếu">
            <Printer class="th-icon-sm" />
          </button>
        </div>
      </header>

      <!-- SKELETON LOADING -->
      <div v-if="isLoading" class="th-loader">
        <div class="th-skeleton" style="height: 240px; border-radius: 16px;"></div>
        <div class="th-grid-3">
          <div v-for="i in 3" :key="i" class="th-skeleton" style="height: 120px; border-radius: 16px;"></div>
        </div>
      </div>

      <!-- KẾT QUẢ THỐNG KÊ -->
      <main v-else-if="dashboardData && dashboardData.thangHienTai" class="th-dashboard">

        <!-- Dòng 1: Thẻ Doanh Thu & Thẻ Mục Tiêu -->
        <div class="th-grid-top">

          <!-- THẺ DOANH THU -->
          <div class="th-card-revenue">
            <!-- Biểu đồ đà tăng trưởng in chìm -->
            <div class="th-trend-bg">
              <svg viewBox="0 0 400 150" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0,150 L50,120 L100,130 L180,70 L250,90 L380,20 L400,0 L400,150 Z"
                  fill="rgba(16, 185, 129, 0.06)" />
                <path d="M0,150 L50,120 L100,130 L180,70 L250,90 L380,20 L400,0" fill="none"
                  stroke="rgba(16, 185, 129, 0.25)" stroke-width="3" />
              </svg>
            </div>

            <div class="th-rev-content">
              <div class="th-rev-head">
                <span class="th-rev-brand">MINH TÂM HAIR</span>
                <span class="th-rev-period">Kỳ lương: {{ dashboardData.thangHienTai.thangNam }}</span>
              </div>

              <div class="th-rev-main">
                <div class="th-flex-align">
                  <span class="th-rev-label">TỔNG THU NHẬP THỰC NHẬN</span>
                  <TrendingUp class="th-icon-sm th-text-emerald" style="margin-left: 8px;" />
                </div>
                <h2 class="th-rev-amount">{{ formatVND(dashboardData.thangHienTai.tongThuNhap) }}</h2>
              </div>

              <div class="th-rev-foot">
                <div class="th-rev-user">
                  <span class="th-rev-sub">NHÂN VIÊN STYLIST</span>
                  <span class="th-rev-name">{{ dashboardData.hoTenNv }}</span>
                </div>
                <div class="th-rev-badges">
                  <div class="th-badge-outline">
                    <span class="th-badge-lbl">MÃ NV</span>
                    <span class="th-badge-val">{{ dashboardData.maNv }}</span>
                  </div>
                  <div class="th-badge-outline">
                    <span class="th-badge-lbl">CHỨC VỤ</span>
                    <span class="th-badge-val">{{ dashboardData.chucVu }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- THẺ MỤC TIÊU THÁNG -->
          <div class="th-card-goals print-hide">
            <div class="th-goals-header">
              <h3 class="th-goals-title">MỤC TIÊU THÁNG</h3>
              <span class="th-goals-counter">{{ completedGoalsCount }}/{{ computedGoalsList.length }}</span>
            </div>

            <div class="th-goals-list">
              <div v-for="goal in computedGoalsList" :key="goal.id" class="th-goal-item">
                <div class="th-goal-check" :class="{ 'is-active': goal.done }">
                  <CheckCircle2 v-if="goal.done" class="th-icon-sm" />
                </div>
                <div class="th-goal-info">
                  <p class="th-goal-name">{{ goal.text }}</p>
                  <p class="th-goal-desc">{{ goal.subtext }}</p>
                </div>
                <div class="th-goal-score">{{ goal.current }}</div>
              </div>
            </div>

            <!-- BẢNG THƯỞNG KHI HOÀN THÀNH -->
            <div class="th-bonus-banner" :class="{ 'is-earned': completedGoalsCount === computedGoalsList.length }">
              <div class="th-bonus-info">
                <span class="th-bonus-title">Thưởng hoàn thành</span>
                <span class="th-bonus-amount">+500.000đ</span>
              </div>
              <div class="th-bonus-status">
                <span v-if="completedGoalsCount === computedGoalsList.length" class="th-text-emerald" style="font-weight: 700;">Đã đạt</span>
                <span v-else class="th-text-slate" style="font-size: 0.8rem; font-weight: 600;">Chưa đạt</span>
              </div>
            </div>
          </div>

        </div>

        <!-- Dòng 2: 3 Chỉ số phụ -->
        <div class="th-grid-3">

          <div class="th-stat-box">
            <div class="th-stat-head">
              <span class="th-stat-title">CHUYÊN CẦN</span>
              <CalendarDays class="th-icon-sm th-text-slate" />
            </div>
            <div class="th-stat-body">
              <h3 class="th-stat-val">{{ dashboardData.thangHienTai.soNgayDiLam }}</h3>
              <span class="th-stat-unit">/ 26</span>
            </div>
            <div class="th-stat-foot">
              <span class="th-dot" style="background: #10B981;"></span> Làm: {{ dashboardData.thangHienTai.soNgayDiLam
              }}
              <span class="th-spacer"></span>
              <span class="th-dot" style="background: #CBD5E1;"></span> Nghỉ: {{ dashboardData.thangHienTai.soNgayNghi
              }}
            </div>
          </div>

          <div class="th-stat-box">
            <div class="th-stat-head">
              <span class="th-stat-title">THI ĐUA</span>
              <Trophy class="th-icon-sm th-text-amber" />
            </div>
            <div class="th-stat-body">
              <h3 class="th-stat-val">#{{ dashboardData.xepHangTrongThang || '--' }}</h3>
              <span class="th-stat-unit">hệ thống</span>
            </div>
            <div class="th-stat-foot" style="color: #F59E0B;">
              <Sparkles class="th-icon-xs" style="margin-right: 4px;" /> Hiệu suất xuất sắc
            </div>
          </div>

          <div class="th-stat-box">
            <div class="th-stat-head">
              <span class="th-stat-title">BÌNH QUÂN NGÀY</span>
              <TrendingUp class="th-icon-sm th-text-slate" />
            </div>
            <div class="th-stat-body">
              <h3 class="th-stat-val-sm">{{ formatVND(averageIncomePerDay) }}</h3>
            </div>
            <div class="th-stat-foot">
              Giá trị tạo ra trên mỗi ngày làm
            </div>
          </div>

        </div>

        <!-- Dòng 3: Biểu đồ chiếm full chiều rộng (Đã bỏ trợ lý) -->
        <div class="th-chart-box-full">
          <div class="th-chart-left">
            <apexchart v-if="chartSeries.some(v => v > 0)" type="donut" width="100%" height="250"
              :options="chartOptions" :series="chartSeries" />
            <div v-else class="th-empty-text">Chưa có số liệu</div>
          </div>

          <div class="th-chart-right">
            <h3 class="th-section-title">CẤU TRÚC DOANH THU</h3>

            <div class="th-bar-row">
              <div class="th-bar-head">
                <span class="th-bar-name"><span class="th-dot" style="background: #10B981;"></span> Lương cứng</span>
                <span class="th-bar-val">{{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}</span>
              </div>
              <div class="th-bar-track">
                <div class="th-bar-fill" style="background: #10B981;"
                  :style="{ width: breakdownPercentages.luongCoBan + '%' }"></div>
              </div>
            </div>

            <div class="th-bar-row">
              <div class="th-bar-head">
                <span class="th-bar-name"><span class="th-dot" style="background: #F43F5E;"></span> Dịch vụ</span>
                <span class="th-bar-val">{{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}</span>
              </div>
              <div class="th-bar-track">
                <div class="th-bar-fill" style="background: #F43F5E;"
                  :style="{ width: breakdownPercentages.hoaHongDV + '%' }"></div>
              </div>
            </div>

            <div class="th-bar-row">
              <div class="th-bar-head">
                <span class="th-bar-name"><span class="th-dot" style="background: #F59E0B;"></span> Sản phẩm</span>
                <span class="th-bar-val">{{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}</span>
              </div>
              <div class="th-bar-track">
                <div class="th-bar-fill" style="background: #F59E0B;"
                  :style="{ width: breakdownPercentages.hoaHongSP + '%' }"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- BẢNG CHI TIẾT GIAO DỊCH -->
        <div class="th-table-box">
          <h3 class="th-section-title" style="margin-bottom: 1rem;">CHI TIẾT GIAO DỊCH (VND)</h3>

          <div class="th-tbl-container">
            <div class="th-tbl-header">
              <div class="th-col-main">KHOẢN MỤC</div>
              <div class="th-col-sub">KHỐI LƯỢNG</div>
              <div class="th-col-sub">ĐƠN GIÁ / TỶ LỆ</div>
              <div class="th-col-tot">THÀNH TIỀN</div>
            </div>

            <div class="th-tbl-row">
              <div class="th-col-main">
                <span class="th-tbl-item">Lương cơ bản</span>
                <span class="th-mobile-val">{{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}</span>
              </div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Ngày công: </span>{{
                dashboardData.thangHienTai.soNgayDiLam }} ngày</div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Đơn giá: </span>{{ formatVND(dashboardData.luongCoBan
                / 26) }}/ng</div>
              <div class="th-col-tot">{{ formatVND(dashboardData.thangHienTai.luongThucTeTheoNgay) }}</div>
            </div>

            <div class="th-tbl-row">
              <div class="th-col-main">
                <span class="th-tbl-item">Chiết khấu dịch vụ</span>
                <span class="th-mobile-val">{{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}</span>
              </div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Khối lượng: </span>Theo HĐ</div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Tỷ lệ: </span>Định mức</div>
              <div class="th-col-tot">{{ formatVND(dashboardData.thangHienTai.hoaHongDichVu) }}</div>
            </div>

            <div class="th-tbl-row">
              <div class="th-col-main">
                <span class="th-tbl-item">Chiết khấu Sản phẩm</span>
                <span class="th-mobile-val">{{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}</span>
              </div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Khối lượng: </span>Theo HĐ</div>
              <div class="th-col-sub"><span class="th-mobile-lbl">Tỷ lệ: </span>10%</div>
              <div class="th-col-tot">{{ formatVND(dashboardData.thangHienTai.hoaHongSanPham) }}</div>
            </div>
          </div>

          <div class="th-tbl-footer">
            <span class="th-footer-lbl">TỔNG THU NHẬP</span>
            <span class="th-footer-val">{{ formatVND(dashboardData.thangHienTai.tongThuNhap) }}</span>
          </div>
        </div>

      </main>

      <!-- EMPTY STATE -->
      <div v-else class="th-empty-box">
        <div class="th-empty-icon">
          <Search class="th-icon-lg" />
        </div>
        <h3 class="th-empty-title">Không có dữ liệu</h3>
        <p class="th-empty-desc">Chưa có thông tin đối soát cho kỳ lương được chọn.</p>
        <button @click="fetchIncomeData(false)" class="th-btn-search" style="margin-top: 1rem;">Về tháng hiện
          tại</button>
      </div>

    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ==========================================================================
   CSS FIREWALL (CHỐNG VỠ BOOTSTRAP BẰNG !IMPORTANT)
   ========================================================================== */
.th-app {
  background-color: #F8FAFC !important;
  min-height: 100vh !important;
  padding: 2rem 1rem 4rem !important;
  font-family: 'Inter', sans-serif !important;
  color: #0F172A !important;
}

.th-app * {
  box-sizing: border-box !important;
  margin: 0 !important;
  padding: 0 !important;
  line-height: 1.5 !important;
}

.th-app select {
  appearance: none !important;
  -webkit-appearance: none !important;
  background: transparent !important;
  border: none !important;
  outline: none !important;
  font-family: inherit !important;
}

.th-app button {
  background: none !important;
  border: none !important;
  cursor: pointer !important;
}

/* TIỆN ÍCH CƠ BẢN */
.font-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace !important;
}

.th-icon-xs {
  width: 14px !important;
  height: 14px !important;
}

.th-icon-sm {
  width: 18px !important;
  height: 18px !important;
}

.th-icon-lg {
  width: 32px !important;
  height: 32px !important;
}

.th-text-slate {
  color: #64748B !important;
}

.th-text-emerald {
  color: #10B981 !important;
}

.th-text-amber {
  color: #F59E0B !important;
}

.th-dot {
  width: 6px !important;
  height: 6px !important;
  border-radius: 50% !important;
  display: inline-block !important;
  margin-right: 6px !important;
}

.th-spacer {
  margin: 0 12px !important;
}

.th-flex-align {
  display: flex !important;
  align-items: center !important;
}

/* BỐ CỤC */
.th-container {
  max-width: 1080px !important;
  margin: 0 auto !important;
}

.th-dashboard {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.5rem !important;
}

.th-grid-top {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 1.5rem !important;
}

@media (min-width: 1024px) {
  .th-grid-top {
    grid-template-columns: 1.6fr 1.1fr !important;
  }
}

.th-grid-3 {
  display: grid !important;
  grid-template-columns: 1fr !important;
  gap: 1.5rem !important;
}

@media (min-width: 768px) {
  .th-grid-3 {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}

/* HEADER & BỘ LỌC */
.th-header {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.25rem !important;
  margin-bottom: 2rem !important;
}

@media (min-width: 768px) {
  .th-header {
    flex-direction: row !important;
    justify-content: space-between !important;
    align-items: flex-end !important;
  }
}

.th-header-titles {
  display: flex !important;
  flex-direction: column !important;
}

.th-page-title {
  font-size: 2rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
  letter-spacing: -0.02em !important;
}

.th-page-desc {
  font-size: 0.875rem !important;
  color: #64748B !important;
  margin-top: 0.25rem !important;
}

.th-filter-bar {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.75rem !important;
}

@media (min-width: 640px) {
  .th-filter-bar {
    flex-direction: row !important;
    align-items: center !important;
    flex-wrap: wrap !important;
  }
}

/* DATE PILL */
.th-date-pill {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  background: #FFFFFF !important;
  border: 1px solid #E2E8F0 !important;
  border-radius: 99px !important;
  padding: 0.25rem 0.5rem 0.25rem 1rem !important;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02) !important;
}

.th-select-wrap {
  position: relative !important;
  display: flex !important;
  align-items: center !important;
  flex-direction: row !important;
}

.th-select {
  padding: 0.5rem 1.75rem 0.5rem 0.5rem !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  color: #1E293B !important;
  cursor: pointer !important;
  width: auto !important;
  display: inline-block !important;
}

.th-chevron {
  position: absolute !important;
  right: 0.5rem !important;
  width: 14px !important;
  height: 14px !important;
  color: #94A3B8 !important;
  pointer-events: none !important;
}

.th-divider {
  width: 1px !important;
  height: 16px !important;
  background-color: #E2E8F0 !important;
  margin: 0 4px !important;
  display: block !important;
}

/* NÚT TÌM KIẾM - MÀU TƯƠNG PHẢN ĐẬM ĐỂ KHÔNG BỊ CHÌM */
.th-app .th-btn-search {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 0.5rem !important;
  height: 2.75rem !important;
  border-radius: 99px !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  background-color: #0F172A !important;
  color: #FFFFFF !important;
  padding: 0 1.5rem !important;
  box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2) !important;
  transition: all 0.2s !important;
}

.th-app .th-btn-search:hover {
  background-color: #334155 !important;
}

.th-btn-print {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  width: 2.75rem !important;
  height: 2.75rem !important;
  background-color: #FFFFFF !important;
  border: 1px solid #E2E8F0 !important;
  color: #475569 !important;
  border-radius: 50% !important;
}

.th-btn-print:hover {
  background-color: #F1F5F9 !important;
}

/* THẺ DOANH THU (NỀN TRẮNG, VIỀN XANH NGỌC, CHỮ XANH NGỌC) */
.th-card-revenue {
  background-color: #FFFFFF !important;
  border: 2px solid #10B981 !important;
  border-radius: 20px !important;
  position: relative !important;
  overflow: hidden !important;
  padding: 2rem !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
  min-height: 260px !important;
  box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.15) !important;
}

.th-trend-bg {
  position: absolute !important;
  left: 0 !important;
  bottom: 0 !important;
  width: 100% !important;
  height: 150px !important;
  z-index: 1 !important;
  pointer-events: none !important;
}

.th-rev-content {
  position: relative !important;
  z-index: 2 !important;
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  justify-content: space-between !important;
}

.th-rev-head {
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 2rem !important;
  flex-direction: row !important;
}

.th-rev-brand {
  font-size: 0.875rem !important;
  font-weight: 800 !important;
  color: #10B981 !important;
  letter-spacing: 0.1em !important;
}

.th-rev-period {
  font-size: 0.75rem !important;
  font-weight: 600 !important;
  background-color: #ECFDF5 !important;
  color: #059669 !important;
  padding: 0.25rem 0.75rem !important;
  border-radius: 99px !important;
}

.th-rev-main {
  display: flex !important;
  flex-direction: column !important;
}

.th-rev-label {
  font-size: 0.75rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  font-weight: 700 !important;
  color: #64748B !important;
}

.th-rev-amount {
  font-size: 3.5rem !important;
  font-weight: 800 !important;
  color: #10B981 !important;
  letter-spacing: -0.03em !important;
  margin-top: 0.25rem !important;
  text-shadow: 0 1px 2px rgba(16, 185, 129, 0.1) !important;
}

.th-rev-foot {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: flex-end !important;
  margin-top: 2rem !important;
  padding-top: 1.5rem !important;
  border-top: 1px solid #E2E8F0 !important;
}

.th-rev-user {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.25rem !important;
}

.th-rev-sub {
  font-size: 0.65rem !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  color: #64748B !important;
  font-weight: 600 !important;
}

.th-rev-name {
  font-size: 1.25rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
}

.th-rev-badges {
  display: flex !important;
  flex-direction: row !important;
  gap: 1rem !important;
}

.th-badge-outline {
  display: flex !important;
  flex-direction: column !important;
  background-color: #F8FAFC !important;
  padding: 0.4rem 0.75rem !important;
  border-radius: 8px !important;
  border: 1px solid #E2E8F0 !important;
}

.th-badge-lbl {
  font-size: 0.6rem !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
  color: #94A3B8 !important;
  margin-bottom: 0.1rem !important;
}

.th-badge-val {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  color: #1E293B !important;
}

/* THẺ MỤC TIÊU */
.th-card-goals {
  background-color: #F9F8F6 !important;
  border-radius: 20px !important;
  padding: 1.75rem !important;
  border: 1px solid #EAE6DF !important;
  display: flex !important;
  flex-direction: column !important;
}

.th-goals-header {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 1.5rem !important;
}

.th-goals-title {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  color: #1C1C1E !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

.th-goals-counter {
  background-color: #EAE6DF !important;
  color: #1C1C1E !important;
  font-size: 0.825rem !important;
  font-weight: 700 !important;
  padding: 0.25rem 0.6rem !important;
  border-radius: 6px !important;
}

.th-goals-list {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.25rem !important;
}

.th-goal-item {
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
  gap: 1rem !important;
}

.th-goal-check {
  width: 26px !important;
  height: 26px !important;
  background-color: #FFFFFF !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  flex-shrink: 0 !important;
  border: 1px solid #EAE6DF !important;
  color: transparent !important;
}

.th-goal-check.is-active {
  background-color: #10B981 !important;
  border-color: #10B981 !important;
  color: #FFFFFF !important;
}

.th-goal-info {
  flex: 1 !important;
  display: flex !important;
  flex-direction: column !important;
}

.th-goal-name {
  font-size: 0.95rem !important;
  font-weight: 600 !important;
  color: #1C1C1E !important;
}

.th-goal-desc {
  font-size: 0.825rem !important;
  color: #8E8E93 !important;
  margin-top: 2px !important;
}

.th-goal-score {
  background-color: #FFFFFF !important;
  padding: 0.3rem 0.6rem !important;
  border-radius: 6px !important;
  font-size: 0.825rem !important;
  font-weight: 600 !important;
  color: #1C1C1E !important;
  border: 1px solid #EAE6DF !important;
  font-family: monospace !important;
}

.th-bonus-banner {
  margin-top: 1.5rem !important;
  padding: 1rem 1.25rem !important;
  border-radius: 12px !important;
  background-color: #F1F5F9 !important;
  display: flex !important;
  justify-content: space-between !important;
  align-items: center !important;
  border: 1px dashed #CBD5E1 !important;
  transition: all 0.3s ease !important;
}

.th-bonus-banner.is-earned {
  background-color: #ECFDF5 !important;
  border-color: #10B981 !important;
  border-style: solid !important;
}

.th-bonus-info {
  display: flex !important;
  flex-direction: column !important;
}

.th-bonus-title {
  font-size: 0.8rem !important;
  font-weight: 600 !important;
  color: #64748B !important;
}

.th-bonus-banner.is-earned .th-bonus-title {
  color: #059669 !important;
}

.th-bonus-amount {
  font-size: 1.1rem !important;
  font-weight: 800 !important;
  color: #1E293B !important;
}

.th-bonus-banner.is-earned .th-bonus-amount {
  color: #10B981 !important;
}

.th-bonus-status {
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* CHỈ SỐ NHỎ */
.th-stat-box {
  background-color: #FFFFFF !important;
  border-radius: 16px !important;
  padding: 1.5rem !important;
  border: 1px solid #E2E8F0 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: space-between !important;
}

.th-stat-head {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: center !important;
  margin-bottom: 1rem !important;
}

.th-stat-title {
  font-size: 0.75rem !important;
  font-weight: 700 !important;
  color: #1E293B !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
}

.th-stat-body {
  display: flex !important;
  flex-direction: row !important;
  align-items: baseline !important;
  gap: 0.25rem !important;
  margin-bottom: 0.75rem !important;
}

.th-stat-val {
  font-size: 2.25rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
  letter-spacing: -0.03em !important;
}

.th-stat-val-sm {
  font-size: 1.75rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
  letter-spacing: -0.02em !important;
}

.th-stat-unit {
  font-size: 0.825rem !important;
  color: #64748B !important;
  font-weight: 500 !important;
}

.th-stat-foot {
  font-size: 0.75rem !important;
  font-weight: 500 !important;
  color: #64748B !important;
  display: flex !important;
  flex-direction: row !important;
  align-items: center !important;
}

/* BIỂU ĐỒ FULL WIDTH THAY VÌ 2 CỘT */
.th-chart-box-full {
  background-color: #FFFFFF !important;
  border-radius: 16px !important;
  padding: 1.5rem !important;
  border: 1px solid #E2E8F0 !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 2rem !important;
}

@media (min-width: 768px) {
  .th-chart-box-full {
    flex-direction: row !important;
    align-items: center !important;
    padding: 2.5rem !important;
  }
}

.th-chart-left {
  width: 100% !important;
  display: flex !important;
  justify-content: center !important;
}

@media (min-width: 768px) {
  .th-chart-left {
    width: 45% !important;
  }
}

.th-chart-right {
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
  gap: 1rem !important;
}

@media (min-width: 768px) {
  .th-chart-right {
    width: 55% !important;
  }
}

.th-chart-render {
  display: block !important;
  width: 100% !important;
}

.th-empty-text {
  padding: 3rem 0 !important;
  color: #94A3B8 !important;
  font-size: 0.875rem !important;
  text-align: center !important;
}

.th-section-title {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
  text-transform: uppercase !important;
  letter-spacing: 0.05em !important;
  margin-bottom: 0.5rem !important;
}

.th-bar-row {
  display: flex !important;
  flex-direction: column !important;
  gap: 0.5rem !important;
  margin-bottom: 0.75rem !important;
}

.th-bar-head {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: flex-end !important;
}

.th-bar-name {
  font-size: 0.875rem !important;
  color: #475569 !important;
  font-weight: 600 !important;
  display: flex !important;
  align-items: center !important;
}

.th-bar-val {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  color: #0F172A !important;
}

.th-bar-track {
  height: 6px !important;
  background-color: #F1F5F9 !important;
  border-radius: 99px !important;
  overflow: hidden !important;
  width: 100% !important;
}

.th-bar-fill {
  height: 100% !important;
  border-radius: 99px !important;
  transition: width 0.8s ease !important;
  display: block !important;
}

/* BẢNG CHI TIẾT */
.th-table-box {
  background-color: #FFFFFF !important;
  border-radius: 16px !important;
  padding: 1.5rem !important;
  border: 1px solid #E2E8F0 !important;
}

@media (min-width: 768px) {
  .th-table-box {
    padding: 2rem !important;
  }
}

.th-tbl-container {
  display: flex !important;
  flex-direction: column !important;
}

.th-tbl-header {
  display: none !important;
  padding-bottom: 0.75rem !important;
  border-bottom: 1px solid #E2E8F0 !important;
  font-size: 0.65rem !important;
  text-transform: uppercase !important;
  font-weight: 700 !important;
  color: #64748B !important;
  letter-spacing: 0.05em !important;
}

@media (min-width: 768px) {
  .th-tbl-header {
    display: flex !important;
    flex-direction: row !important;
  }
}

.th-col-main {
  width: 100% !important;
  display: flex !important;
  flex-direction: column !important;
}

.th-col-sub {
  width: 100% !important;
  display: flex !important;
  flex-direction: row !important;
}

.th-col-tot {
  display: none !important;
}

@media (min-width: 768px) {
  .th-col-main {
    width: 35% !important;
    display: block !important;
  }

  .th-col-sub {
    width: 25% !important;
    display: block !important;
    font-size: 0.875rem !important;
    color: #475569 !important;
    font-weight: 500 !important;
  }

  .th-col-tot {
    display: block !important;
    width: 15% !important;
    text-align: right !important;
    font-weight: 700 !important;
    font-family: monospace !important;
    font-size: 0.875rem !important;
    color: #0F172A !important;
  }
}

.th-tbl-row {
  display: flex !important;
  flex-direction: column !important;
  padding: 1.25rem 0 !important;
  border-bottom: 1px solid #F1F5F9 !important;
  gap: 0.5rem !important;
}

@media (min-width: 768px) {
  .th-tbl-row {
    flex-direction: row !important;
    align-items: center !important;
    gap: 0 !important;
  }
}

.th-tbl-item {
  font-size: 0.875rem !important;
  font-weight: 600 !important;
  color: #0F172A !important;
}

.th-mobile-val {
  font-weight: 700 !important;
  font-family: monospace !important;
  color: #0F172A !important;
  margin-top: 0.25rem !important;
}

@media (min-width: 768px) {
  .th-mobile-val {
    display: none !important;
  }
}

.th-mobile-lbl {
  display: inline-block !important;
  width: 85px !important;
  color: #64748B !important;
  font-weight: 500 !important;
  font-size: 0.825rem !important;
}

@media (min-width: 768px) {
  .th-mobile-lbl {
    display: none !important;
  }
}

@media (max-width: 767px) {
  .th-col-sub {
    align-items: baseline !important;
    font-size: 0.875rem !important;
    color: #475569 !important;
  }
}

.th-tbl-footer {
  display: flex !important;
  flex-direction: row !important;
  justify-content: space-between !important;
  align-items: center !important;
  padding: 1.25rem 1.5rem !important;
  margin-top: 1rem !important;
  background-color: #ECFDF5 !important;
  border-radius: 12px !important;
  border: 1px solid #A7F3D0 !important;
}

.th-footer-lbl {
  font-size: 0.875rem !important;
  font-weight: 700 !important;
  color: #065F46 !important;
  text-transform: uppercase !important;
}

.th-footer-val {
  font-size: 1.5rem !important;
  font-weight: 800 !important;
  color: #10B981 !important;
  letter-spacing: -0.02em !important;
}

/* LOADING & EMPTY */
.th-loader {
  display: flex !important;
  flex-direction: column !important;
  gap: 1.5rem !important;
}

.th-skeleton {
  background-color: #E2E8F0 !important;
  animation: pulse 1.5s infinite !important;
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

.th-empty-box {
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  padding: 5rem 1rem !important;
  background-color: #FFFFFF !important;
  border-radius: 20px !important;
  border: 1px solid #E2E8F0 !important;
}

.th-empty-icon {
  width: 64px !important;
  height: 64px !important;
  background-color: #F1F5F9 !important;
  border-radius: 50% !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  color: #94A3B8 !important;
  margin-bottom: 1.5rem !important;
}

.th-empty-title {
  font-size: 1.25rem !important;
  font-weight: 700 !important;
  margin-bottom: 0.5rem !important;
  color: #0F172A !important;
}

.th-empty-desc {
  color: #64748B !important;
  font-size: 0.875rem !important;
}

/* IN ẤN */
@media print {
  .print-hide {
    display: none !important;
  }

  .th-app {
    background: white !important;
    padding: 0 !important;
  }

  .th-card-revenue,
  .th-card-stat,
  .th-chart-box-full,
  .th-table-box {
    border: 1px solid #CBD5E1 !important;
    box-shadow: none !important;
    break-inside: avoid !important;
  }

  .th-trend-bg {
    display: none !important;
  }
}
</style>