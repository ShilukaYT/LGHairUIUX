<script setup lang="ts">
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { useTheme } from 'vuetify'
import axios from 'axios'
import { 
  Search, 
  FileDown, 
  Eye, 
  Printer, 
  Users, 
  Coins, 
  TrendingUp, 
  Calendar, 
  X, 
  UserCheck, 
  RotateCcw,
  Award,
  Info,
  Check,
  AlertCircle,
  CheckCircle2,
  DollarSign
} from 'lucide-vue-next'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { logActivity } from '@/utils/activityLogger'
import { useCustomizerStore } from '@/stores/customizer'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

// ── THEME SYNC ──
const theme = useTheme()
const customizer = useCustomizerStore()

// ── NOTIFICATION (SNACKBAR) ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
})

const showNotification = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = msg
  snackbar.color = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
  snackbar.show = true
}

// ── STATE ──
const isLoading = ref(false)
const month = ref(new Date().getMonth() + 1)
const year = ref(new Date().getFullYear())
const searchQuery = ref('')
const curPage = ref(1)
const PER_PAGE = 8

const payrollSummary = ref<any>({
  thang: 0,
  nam: 0,
  tongNhanVien: 0,
  tongQuyLuong: 0,
  danhSachLuong: []
})

// Detail modal state
const isDetailOpen = ref(false)
const selectedSalary = ref<any>(null)

// Dropdown options
const months = Array.from({ length: 12 }, (_, i) => ({ title: `Tháng ${i + 1}`, value: i + 1 }))
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => ({ title: `Năm ${currentYear - 2 + i}`, value: currentYear - 2 + i }))

// ── FETCH PAYROLL SUMMARY ──
const fetchPayroll = async () => {
  isLoading.value = true
  try {
    const token = sessionStorage.getItem('adminToken')
    const response = await axios.get(`${API}/api/salary/summary`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      params: {
        month: month.value,
        year: year.value
      },
      withCredentials: true
    })
    
    if (response.data.success) {
      payrollSummary.value = response.data.data
    } else {
      showNotification(response.data.message || 'Không thể tải bảng lương.', 'error')
    }
  } catch (error: any) {
    console.error('Error fetching payroll:', error)
    let errorMsg = 'Đã xảy ra lỗi khi kết nối tới máy chủ.'
    if (error.response) {
      const status = error.response.status
      if (status === 401 || status === 403) {
        errorMsg = 'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền truy cập.'
      } else if (status === 404) {
        errorMsg = 'Không tìm thấy API bảng lương (404).'
      } else {
        errorMsg = error.response.data?.message || `Lỗi máy chủ: Mã lỗi ${status}`
      }
    } else if (error.message) {
      errorMsg = `Lỗi kết nối: ${error.message}`
    }
    showNotification(errorMsg, 'error')
  } finally {
    isLoading.value = false
  }
}

// ── COMPUTED ──
const averageSalary = computed(() => {
  const count = payrollSummary.value.tongNhanVien || 0
  const total = payrollSummary.value.tongQuyLuong || 0
  return count > 0 ? Math.round(total / count) : 0
})

const filteredPayroll = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const list = payrollSummary.value.danhSachLuong || []
  if (!query) return list
  return list.filter((item: any) => 
    (item.hoTenNv && item.hoTenNv.toLowerCase().includes(query)) || 
    (item.maNv && item.maNv.toLowerCase().includes(query)) ||
    (item.tenLoaiNv && item.tenLoaiNv.toLowerCase().includes(query))
  )
})

const totalPages = computed(() => Math.ceil(filteredPayroll.value.length / PER_PAGE) || 1)

const pageData = computed(() => {
  const s = (curPage.value - 1) * PER_PAGE
  return filteredPayroll.value.slice(s, s + PER_PAGE)
})

watch([searchQuery, month, year], () => {
  curPage.value = 1
})

// ── FORMATTERS ──
const formatVND = (value?: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
}

const toAbsUrl = (path: string) => {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `${API}${path}`
}

// ── ACTIONS ──
const openDetail = (item: any) => {
  selectedSalary.value = item
  isDetailOpen.value = true
}

const closeDetail = () => {
  selectedSalary.value = null
  isDetailOpen.value = false
}

const printPayslip = () => {
  if (selectedSalary.value) {
    logActivity(
      "In phiếu lương",
      `Đã in phiếu lương chi tiết cho nhân viên ${selectedSalary.value.hoTenNv} (Mã: ${selectedSalary.value.maNv}) - Tháng ${selectedSalary.value.thang}/${selectedSalary.value.nam}`,
      "Lương"
    )
  }
  window.print()
}

const resetFilters = () => {
  searchQuery.value = ''
  month.value = new Date().getMonth() + 1
  year.value = new Date().getFullYear()
  fetchPayroll()
}

// ── EXPORT EXCEL ──
const exportExcel = async () => {
  const dataList = filteredPayroll.value
  if (!dataList || dataList.length === 0) {
    showNotification('Không có thông tin lương để xuất file Excel!', 'warning')
    return
  }

  isLoading.value = true
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(`BangLuong_T${month.value}_${year.value}`)

    // 1. Title Block
    worksheet.mergeCells('A1:M1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `BẢNG LƯƠNG NHÂN VIÊN - THÁNG ${month.value}/${year.value}`
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } }
    worksheet.getRow(1).height = 40

    // Subtitle
    worksheet.mergeCells('A2:M2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Tổng số nhân viên: ${payrollSummary.value.tongNhanVien} | Tổng quỹ lương: ${formatVND(payrollSummary.value.tongQuyLuong)}`
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF374151' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(2).height = 20

    worksheet.addRow([])

    // 2. Header Row
    const headers = [
      'STT',
      'Mã Nhân Viên',
      'Họ và Tên',
      'Chức Vụ',
      'Lương Cơ Bản',
      'Công Chuẩn',
      'Ca Fulltime',
      'Ca Part-time',
      'Công Quy Đổi',
      'Lương Ngày Công',
      'HH Dịch Vụ',
      'HH Sản Phẩm',
      'Thực Lĩnh'
    ]
    const headerRow = worksheet.addRow(headers)
    headerRow.height = 28
    
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFBFA77A' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'medium' },
        right: { style: 'thin' }
      }
    })

    // 3. Add Data Rows
    dataList.forEach((item: any, idx: number) => {
      const row = worksheet.addRow([
        idx + 1,
        item.maNv,
        item.hoTenNv,
        item.tenLoaiNv,
        parseFloat(item.luongCoBan),
        item.soNgayCongQuyDinh,
        item.soCaFulltime,
        item.soCaParttime,
        item.soCaChuanQuyDoi,
        parseFloat(item.luongTheoNgayCong),
        parseFloat(item.tongHoaHongDv || 0),
        parseFloat(item.tongHoaHongSp || 0),
        parseFloat(item.tongThuNhap)
      ])
      row.height = 22

      // Alignments & formats
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'center' }
      row.getCell(5).numFmt = '#,##0 "₫"'
      row.getCell(6).alignment = { horizontal: 'center' }
      row.getCell(7).alignment = { horizontal: 'center' }
      row.getCell(8).alignment = { horizontal: 'center' }
      row.getCell(9).alignment = { horizontal: 'center' }
      row.getCell(10).numFmt = '#,##0 "₫"'
      row.getCell(11).numFmt = '#,##0 "₫"'
      row.getCell(12).numFmt = '#,##0 "₫"'
      row.getCell(13).numFmt = '#,##0 "₫"'
      row.getCell(13).font = { bold: true, color: { argb: 'FF0D9488' } }
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Bang_Luong_Thang_${month.value}_${year.value}.xlsx`)
    
    logActivity(
      "Xuất Excel bảng lương",
      `Đã xuất thành công tệp Excel bảng lương Tháng ${month.value}/${year.value} (${dataList.length} nhân viên)`,
      "Lương"
    )

    showNotification('Đã xuất và tải xuống bảng lương dạng Excel thành công!', 'success')
  } catch (err: any) {
    console.error('Excel export error:', err)
    showNotification('Không thể tạo file Excel!', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchPayroll()
})
</script>

<template>
  <v-container fluid class="pa-6">
    <!-- ═══════ HIGH-PRIORITY SNACKBAR NOTIFICATION ═══════ -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="top right"
      elevation="24"
      :timeout="3500"
      style="z-index: 99999 !important;"
    >
      <div class="d-flex align-center gap-3">
        <Check v-if="snackbar.color === 'success'" class="w-5 h-5 shrink-0" />
        <AlertCircle v-else class="w-5 h-5 shrink-0" />
        <span class="text-subtitle-2 font-weight-medium">{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- ═══════ HEADER CARD (MATCHING SALE.VUE / CHUCVU) ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6 print:hidden">
      <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between gap-4">
        <div>
          <h2 class="text-h5 font-weight-bold d-flex align-center gap-2 mb-1">
            <Coins class="w-6 h-6 text-primary shrink-0" />
            <span>Quản Lý Bảng Lương &amp; Quyết Toán</span>
          </h2>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Theo dõi bảng lương, định mức công chuẩn và hoa hồng của {{ payrollSummary.tongNhanVien || 0 }} nhân sự
          </p>
        </div>

        <div class="d-flex align-center gap-3 flex-grow-1 justify-lg-end flex-wrap">
          <!-- Month select -->
          <v-select
            v-model="month"
            :items="months"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="fetchPayroll"
            style="max-width: 140px; min-width: 120px;"
          ></v-select>

          <!-- Year select -->
          <v-select
            v-model="year"
            :items="years"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            @update:model-value="fetchPayroll"
            style="max-width: 130px; min-width: 110px;"
          ></v-select>

          <!-- Search input -->
          <v-text-field
            v-model="searchQuery"
            placeholder="Tìm theo tên thợ, mã NV..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="flex-grow-1"
            style="max-width: 280px; width: 100%; min-width: 200px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-slate-400 mr-1 shrink-0" />
            </template>
          </v-text-field>

          <!-- Reload button -->
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            width="40"
            icon
            rounded="xl"
            :loading="isLoading"
            @click="fetchPayroll"
            title="Tải lại"
          >
            <RotateCcw class="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </v-btn>

          <!-- Export Excel button -->
          <v-btn
            color="primary"
            height="40"
            rounded="xl"
            elevation="2"
            class="text-none font-weight-bold px-5"
            :disabled="isLoading || !payrollSummary.danhSachLuong?.length"
            @click="exportExcel"
          >
            <template v-slot:prepend>
              <FileDown class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Xuất Excel
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ STATS CARDS (MATCHING SALE.VUE) ═══════ -->
    <v-row class="mb-6 print:hidden">
      <!-- Card 1: Tổng nhân viên -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Số Nhân Viên</p>
              <h3 class="text-h4 font-weight-black">{{ payrollSummary.tongNhanVien || 0 }}</h3>
              <p class="text-caption text-primary font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <UserCheck class="w-3.5 h-3.5" /> <span>Đang hoạt động tháng {{ month }}</span>
              </p>
            </div>
            <v-avatar color="primary" variant="tonal" size="52" rounded="xl">
              <Users class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Tổng quỹ lương dự chi -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Quỹ Lương Dự Chi</p>
              <h3 class="text-h5 font-weight-black text-success truncate max-w-[180px]">
                {{ formatVND(payrollSummary.tongQuyLuong) }}
              </h3>
              <p class="text-caption text-success font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Coins class="w-3.5 h-3.5" /> <span>Theo ca làm &amp; hoa hồng</span>
              </p>
            </div>
            <v-avatar color="success" variant="tonal" size="52" rounded="xl">
              <Coins class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Thực lĩnh trung bình -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Thực Lĩnh Trung Bình</p>
              <h3 class="text-h5 font-weight-black text-warning truncate max-w-[180px]">
                {{ formatVND(averageSalary) }}
              </h3>
              <p class="text-caption text-warning font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <TrendingUp class="w-3.5 h-3.5" /> <span>Tính theo nhân sự xếp ca</span>
              </p>
            </div>
            <v-avatar color="warning" variant="tonal" size="52" rounded="xl">
              <TrendingUp class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Kỳ quyết toán -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Kỳ Quyết Toán</p>
              <h3 class="text-h4 font-weight-black text-info">T{{ month }}/{{ year }}</h3>
              <p class="text-caption text-info font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Calendar class="w-3.5 h-3.5" /> <span>Chu kỳ tính lương</span>
              </p>
            </div>
            <v-avatar color="info" variant="tonal" size="52" rounded="xl">
              <Calendar class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════ DATA TABLE CARD (MATCHING SALE.VUE) ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 print:hidden">
      <v-table class="rounded-xl border" hover>
        <thead>
          <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 5%;">STT</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 22%;">Nhân Viên</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 13%;">Lương Cơ Bản</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 10%;">Công Chuẩn</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 14%;">Ca Thực Tế</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 13%;">Lương Theo Công</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 11%;">Hoa Hồng</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 13%;">Thực Lĩnh</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 7%;">Chi Tiết</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <tr v-if="isLoading">
            <td colspan="9" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
              <div class="text-caption text-medium-emphasis">Đang tải dữ liệu bảng lương...</div>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-else-if="filteredPayroll.length === 0">
            <td colspan="9" class="text-center py-10">
              <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                <Coins class="w-7 h-7 text-grey" />
              </v-avatar>
              <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy dữ liệu bảng lương</div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr
            v-else
            v-for="(item, index) in pageData"
            :key="item.maNv"
            @click="openDetail(item)"
            class="cursor-pointer transition-colors"
          >
            <!-- STT -->
            <td class="py-4 text-center text-medium-emphasis font-weight-bold">
              {{ (curPage - 1) * PER_PAGE + Number(index) + 1 }}
            </td>

            <!-- Nhân viên -->
            <td class="py-4">
              <div class="d-flex align-center gap-3">
                <v-avatar size="38" rounded="circle" class="border">
                  <img v-if="item.hinhAnh" :src="toAbsUrl(item.hinhAnh)" alt="avatar" class="w-100 h-100 object-cover" />
                  <span v-else class="font-weight-bold text-caption text-primary">
                    {{ item.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
                  </span>
                </v-avatar>
                <div>
                  <div class="font-weight-bold text-subtitle-2 leading-tight">
                    {{ item.hoTenNv }}
                  </div>
                  <div class="d-flex align-center gap-1.5 mt-0.5">
                    <span class="text-caption text-medium-emphasis font-weight-medium">{{ item.maNv }}</span>
                    <v-chip
                      :color="item.tenLoaiNv.toUpperCase().includes('STYLIST') ? 'primary' : 'grey'"
                      size="x-small"
                      variant="tonal"
                      class="font-weight-bold"
                    >
                      {{ item.tenLoaiNv }}
                    </v-chip>
                  </div>
                </div>
              </div>
            </td>

            <!-- Lương cơ bản -->
            <td class="py-4 text-right font-weight-bold text-body-2">
              {{ formatVND(item.luongCoBan) }}
            </td>

            <!-- Công chuẩn -->
            <td class="py-4 text-center font-weight-bold text-body-2 text-medium-emphasis">
              {{ item.soNgayCongQuyDinh }}
            </td>

            <!-- Ca thực tế -->
            <td class="py-4 text-center">
              <div class="d-flex flex-column align-center gap-1">
                <div class="d-flex align-center gap-1">
                  <v-chip v-if="item.soCaFulltime > 0" color="info" size="x-small" variant="flat" class="font-weight-bold">
                    {{ item.soCaFulltime }} FT
                  </v-chip>
                  <v-chip v-if="item.soCaParttime > 0" color="warning" size="x-small" variant="flat" class="font-weight-bold">
                    {{ item.soCaParttime }} PT
                  </v-chip>
                  <span v-if="!item.soCaFulltime && !item.soCaParttime" class="text-caption text-medium-emphasis">0 ca</span>
                </div>
                <div class="text-caption font-weight-bold text-primary">
                  = {{ item.soCaChuanQuyDoi }} công
                </div>
              </div>
            </td>

            <!-- Lương theo công -->
            <td class="py-4 text-right font-weight-bold text-body-2">
              {{ formatVND(item.luongTheoNgayCong) }}
            </td>

            <!-- Hoa hồng -->
            <td class="py-4 text-right">
              <div class="d-flex flex-column align-end gap-1">
                <v-chip v-if="item.tongHoaHongDv > 0" color="success" size="x-small" variant="tonal" class="font-weight-bold">
                  DV +{{ formatVND(item.tongHoaHongDv) }}
                </v-chip>
                <v-chip v-if="item.laThoChinh && item.tongHoaHongSp > 0" color="info" size="x-small" variant="tonal" class="font-weight-bold">
                  SP +{{ formatVND(item.tongHoaHongSp) }}
                </v-chip>
                <span v-if="!item.tongHoaHongDv && !item.tongHoaHongSp" class="text-caption text-medium-emphasis">0 ₫</span>
              </div>
            </td>

            <!-- Thực lĩnh -->
            <td class="py-4 text-right">
              <v-chip color="success" variant="flat" size="small" class="font-weight-black text-body-2">
                {{ formatVND(item.tongThuNhap) }}
              </v-chip>
            </td>

            <!-- Chi tiết -->
            <td class="py-4 text-center" @click.stop>
              <v-btn
                icon
                variant="text"
                color="primary"
                size="small"
                @click="openDetail(item)"
                title="Xem phiếu lương"
              >
                <Eye class="w-4 h-4" />
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination footer (Matching sale.vue) -->
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between mt-4 px-2 gap-3">
        <span class="text-caption text-medium-emphasis font-weight-semibold">
          Hiển thị {{ pageData.length }} / {{ filteredPayroll.length }} nhân sự
        </span>
        <v-pagination
          v-if="totalPages > 1"
          v-model="curPage"
          :length="totalPages"
          rounded="xl"
          active-color="primary"
          density="compact"
          :total-visible="5"
        ></v-pagination>
      </div>
    </v-card>

    <!-- ═══════ MODAL: PHIẾU LƯƠNG CHI TIẾT ═══════ -->
    <v-dialog v-model="isDetailOpen" max-width="480px" scrollable>
      <v-card v-if="selectedSalary" rounded="xl" id="payslip-print-card">
        <!-- Dialog Header -->
        <v-card-title class="pa-5 pb-3 text-center border-b d-flex flex-column align-center relative">
          <v-btn icon variant="text" density="comfortable" class="position-absolute top-2 right-2 print:hidden" @click="closeDetail">
            <X class="w-4 h-4" />
          </v-btn>
          <v-avatar color="primary" variant="tonal" size="44" class="mb-2">
            <Award class="w-6 h-6 text-primary" />
          </v-avatar>
          <div class="text-caption font-weight-bold uppercase tracking-widest text-medium-emphasis">SALON TÓC MINH TÂM</div>
          <h3 class="text-subtitle-1 font-weight-bold mb-0">PHIẾU LƯƠNG CHI TIẾT</h3>
          <p class="text-caption text-medium-emphasis mb-0 italic">Tháng {{ selectedSalary.thang }} / Năm {{ selectedSalary.nam }}</p>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-5 space-y-4">
          <!-- Employee Card -->
          <div class="d-flex align-center gap-3 pa-3 rounded-xl border" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
            <v-avatar size="40" rounded="circle" class="border">
              <img v-if="selectedSalary.hinhAnh" :src="toAbsUrl(selectedSalary.hinhAnh)" alt="avatar" class="w-100 h-100 object-cover" />
              <span v-else class="font-weight-bold text-caption text-primary">
                {{ selectedSalary.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
              </span>
            </v-avatar>
            <div>
              <div class="font-weight-bold text-subtitle-2 leading-tight">
                {{ selectedSalary.hoTenNv }}
              </div>
              <div class="d-flex align-center gap-2 mt-0.5 text-caption text-medium-emphasis">
                <span class="font-weight-medium">Mã: {{ selectedSalary.maNv }}</span>
                <span>•</span>
                <span class="font-weight-bold text-primary">{{ selectedSalary.tenLoaiNv }}</span>
              </div>
            </div>
          </div>

          <!-- Breakdown List -->
          <div class="space-y-2 text-body-2">
            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Mức lương cơ bản:</span>
              <span class="font-weight-bold">{{ formatVND(selectedSalary.luongCoBan) }}</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Công chuẩn quy định:</span>
              <span class="font-weight-bold">{{ selectedSalary.soNgayCongQuyDinh }} ngày công</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Ca làm thực tế:</span>
              <span class="font-weight-bold">{{ selectedSalary.soCaLamThucTe }} ca</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b pl-3 text-caption text-medium-emphasis">
              <span>↳ Ca full-time (× 1.0):</span>
              <span class="font-weight-bold text-info">{{ selectedSalary.soCaFulltime }} ca</span>
            </div>

            <div v-if="selectedSalary.soCaParttime > 0" class="d-flex justify-space-between py-1 border-b pl-3 text-caption text-medium-emphasis">
              <span>↳ Ca part-time (× 0.5):</span>
              <span class="font-weight-bold text-warning">{{ selectedSalary.soCaParttime }} ca</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Công quy đổi thực tế:</span>
              <span class="font-weight-bold text-primary">{{ selectedSalary.soCaChuanQuyDoi }} công</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Lương ca thực tế:</span>
              <span class="font-weight-bold">{{ formatVND(selectedSalary.luongTheoNgayCong) }}</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Hoa hồng dịch vụ:</span>
              <span class="font-weight-bold text-success">+{{ formatVND(selectedSalary.tongHoaHongDv) }}</span>
            </div>

            <div class="d-flex justify-space-between py-1 border-b">
              <span class="text-medium-emphasis">Hoa hồng sản phẩm:</span>
              <span v-if="selectedSalary.laThoChinh" class="font-weight-bold text-info">
                +{{ formatVND(selectedSalary.tongHoaHongSp) }}
              </span>
              <span v-else class="text-caption text-medium-emphasis">Không áp dụng</span>
            </div>
          </div>

          <!-- Total Receipts Box -->
          <v-card variant="tonal" color="primary" border rounded="xl" class="pa-4">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption font-weight-bold text-primary uppercase tracking-wider">THỰC LĨNH NHẬN</div>
                <div class="text-caption text-medium-emphasis">Lương ca + Hoa hồng</div>
              </div>
              <div class="text-h6 font-weight-black text-primary">
                {{ formatVND(selectedSalary.tongThuNhap) }}
              </div>
            </div>
          </v-card>
        </v-card-text>

        <!-- Actions -->
        <v-card-actions class="pa-4 border-t d-flex justify-end gap-3 print:hidden">
          <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" @click="closeDetail">
            Đóng
          </v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold px-5" @click="printPayslip">
            <template v-slot:prepend>
              <Printer class="w-4 h-4 mr-1 shrink-0" />
            </template>
            In Phiếu Lương
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
@media print {
  body {
    visibility: hidden;
    background-color: white !important;
  }
  
  #payslip-print-card {
    visibility: visible !important;
    position: fixed !important;
    left: 50% !important;
    top: 50px !important;
    transform: translateX(-50%) !important;
    width: 480px !important;
    border: 1px solid #cbd5e1 !important;
    background-color: white !important;
  }

  #payslip-print-card * {
    visibility: visible !important;
  }

  .print\:hidden {
    display: none !important;
  }
}
</style>
