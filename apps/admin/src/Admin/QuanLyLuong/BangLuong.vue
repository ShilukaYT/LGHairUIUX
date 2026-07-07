<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
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
  ArrowUpRight,
  UserCheck,
  Percent,
  TrendingDown,
  Info,
  Award,
  RotateCcw
} from 'lucide-vue-next'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import Swal from 'sweetalert2'

// Hoạt động log tạm thời (stub) do hệ thống thiếu file logger gốc
const logActivity = (action: string, description: string, category: string, status?: string) => {
  console.log(`[Activity Log] Action: ${action} | Description: ${description} | Category: ${category} | Status: ${status || 'Thành công'}`)
}

const API = import.meta.env.VITE_API_URL

// State variables
const isLoading = ref(false)
const month = ref(new Date().getMonth() + 1)
const year = ref(new Date().getFullYear())
const searchQuery = ref('')

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

// Generate months and years for dropdown
const months = Array.from({ length: 12 }, (_, i) => i + 1)
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

// Fetch payroll summary from API
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
      }
    })
    
    if (response.data.success) {
      payrollSummary.value = response.data.data
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Thất bại',
        text: response.data.message || 'Không thể tải bảng lương.',
        confirmButtonColor: '#9d804e',
        background: '#ffffff',
        color: '#1e293b'
      })
    }
  } catch (error: any) {
    console.error('Error fetching payroll:', error)
    let errorMsg = 'Đã xảy ra lỗi khi kết nối tới máy chủ.'
    if (error.response) {
      const status = error.response.status
      if (status === 401 || status === 403) {
        errorMsg = 'Phiên đăng nhập đã hết hạn hoặc bạn không có quyền truy cập. Vui lòng đăng nhập lại.'
      } else if (status === 404) {
        errorMsg = 'Phiên đăng nhập đã hết hạn hoặc không tìm thấy API bảng lương (404). Vui lòng đăng nhập lại.'
      } else {
        errorMsg = error.response.data?.message || `Lỗi máy chủ: Mã lỗi ${status}`
      }
    } else if (error.message) {
      errorMsg = `Lỗi kết nối: ${error.message}`
    }
    Swal.fire({
      icon: 'error',
      title: 'Lỗi hệ thống',
      text: errorMsg,
      confirmButtonColor: '#9d804e',
      background: '#ffffff',
      color: '#1e293b'
    })
  } finally {
    isLoading.value = false
  }
}

// Compute average salary
const averageSalary = computed(() => {
  const count = payrollSummary.value.tongNhanVien || 0
  const total = payrollSummary.value.tongQuyLuong || 0
  return count > 0 ? Math.round(total / count) : 0
})

// Filter employees based on search query
const filteredPayroll = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return payrollSummary.value.danhSachLuong || []
  return (payrollSummary.value.danhSachLuong || []).filter((item: any) => 
    item.hoTenNv.toLowerCase().includes(query) || 
    item.maNv.toLowerCase().includes(query) ||
    item.tenLoaiNv.toLowerCase().includes(query)
  )
})

// Formatting helpers
const formatVND = (value: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
}

const toAbsUrl = (path: string) => {
  if (!path) return ""
  if (path.startsWith("http")) return path
  return `${API}${path}`
}

// Open detail modal
const openDetail = (item: any) => {
  selectedSalary.value = item
  isDetailOpen.value = true
}

// Close detail modal
const closeDetail = () => {
  selectedSalary.value = null
  isDetailOpen.value = false
}

// Print payslip
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

// Reset filters
const resetFilters = () => {
  searchQuery.value = ''
  month.value = new Date().getMonth() + 1
  year.value = new Date().getFullYear()
  fetchPayroll()
}

// Export to Excel using exceljs
const exportExcel = async () => {
  const dataList = filteredPayroll.value
  if (!dataList || dataList.length === 0) {
    Swal.fire({
      icon: 'warning',
      title: 'Không có dữ liệu',
      text: 'Không có thông tin lương để xuất file Excel.',
      confirmButtonColor: '#9d804e',
      background: '#ffffff',
      color: '#1e293b'
    })
    return
  }

  isLoading.value = true
  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(`BangLuong_T${month.value}_${year.value}`)

    // 1. Add Title Block
    worksheet.mergeCells('A1:M1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `BẢNG LƯƠNG NHÂN VIÊN - THÁNG ${month.value}/${year.value}`
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } } // Dark header
    worksheet.getRow(1).height = 40

    // Subtitle
    worksheet.mergeCells('A2:M2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Tổng số nhân viên: ${payrollSummary.value.tongNhanVien} | Tổng quỹ lương: ${formatVND(payrollSummary.value.tongQuyLuong)}`
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF374151' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(2).height = 20

    worksheet.addRow([])

    // 2. Add Header Row
    const headers = [
      'STT',              // A: col 1
      'Mã Nhân Viên',    // B: col 2
      'Họ và Tên',       // C: col 3
      'Chức Vụ',         // D: col 4
      'Lương Cơ Bản',    // E: col 5
      'Công Chuẩn',       // F: col 6
      'Ca Fulltime',      // G: col 7
      'Ca Part-time',     // H: col 8
      'Công Quy Đổi',    // I: col 9
      'Lương Ngày Công',  // J: col 10
      'HH Dịch Vụ',       // K: col 11
      'HH Sản Phẩm',     // L: col 12
      'Thực Lĩnh'         // M: col 13
    ]
    const headerRow = worksheet.addRow(headers)
    headerRow.height = 28
    
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFBFA77A' } } // Gold text
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
        item.soCaFulltime ?? 0,
        item.soCaParttime ?? 0,
        parseFloat(item.soCaChuanQuyDoi ?? 0),
        parseFloat(item.luongTheoNgayCong),
        parseFloat(item.tongHoaHongDv ?? 0),      // HOA HỒNG DỌCH VỤ
        parseFloat(item.tongHoaHongSp ?? 0),      // HOA HỒNG SẢN PHẨM
        parseFloat(item.tongThuNhap)
      ])
      row.height = 24

      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'center' }
      row.getCell(4).alignment = { horizontal: 'left' }
      row.getCell(6).alignment = { horizontal: 'center' }
      row.getCell(7).alignment = { horizontal: 'center' }  // Ca FT
      row.getCell(8).alignment = { horizontal: 'center' }  // Ca PT
      row.getCell(9).alignment = { horizontal: 'center' }  // Công QĐ

      row.getCell(5).numFmt  = '#,##0" ₫"'   // Lương CB
      row.getCell(10).numFmt = '#,##0" ₫"'   // Lương ngày công
      row.getCell(11).numFmt = '#,##0" ₫"'   // HH DV
      row.getCell(12).numFmt = '#,##0" ₫"'   // HH SP
      row.getCell(13).numFmt = '#,##0" ₫"'   // Thực lĩnh

      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 }
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        }
      })
    })

    // 4. Add Summary Row
    const summaryRowIdx = dataList.length + 5
    worksheet.addRow([])
    
    const summaryRow = worksheet.addRow([
      'Tổng cộng', '', '', '', '', '', '', '', '',
      { formula: `=SUM(J5:J${summaryRowIdx - 1})` },   // Lương ngày công
      { formula: `=SUM(K5:K${summaryRowIdx - 1})` },   // HH DV
      { formula: `=SUM(L5:L${summaryRowIdx - 1})` },   // HH SP
      { formula: `=SUM(M5:M${summaryRowIdx - 1})` }    // Thực lĩnh
    ])
    summaryRow.height = 28

    worksheet.mergeCells(`A${summaryRowIdx}:I${summaryRowIdx}`)
    const totalLabelCell = worksheet.getCell(`A${summaryRowIdx}`)
    totalLabelCell.value = 'TỔNG CỘNG'
    totalLabelCell.alignment = { horizontal: 'right', vertical: 'middle' }

    summaryRow.eachCell((cell, colNum) => {
      cell.font = { name: 'Segoe UI', size: 11, bold: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
      cell.border = {
        top: { style: 'medium' },
        left: { style: 'thin' },
        bottom: { style: 'double' },
        right: { style: 'thin' }
      }
      if (colNum >= 10) {
        cell.numFmt = '#,##0" ₫"'
      }
    })

    worksheet.columns.forEach((col) => {
      let maxLen = 0
      col.eachCell!((cell) => {
        if (cell.value) {
          const cellStr = cell.value.toString()
          if (cellStr.length > maxLen) maxLen = cellStr.length
        }
      })
      col.width = Math.max(maxLen + 4, 12)
    })
    worksheet.getColumn(1).width = 6
    worksheet.getColumn(3).width = 25
    worksheet.getColumn(4).width = 18
    worksheet.getColumn(7).width = 12  // Ca FT
    worksheet.getColumn(8).width = 13  // Ca PT
    worksheet.getColumn(9).width = 14  // Công QĐ

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Bang_Luong_Thang_${month.value}_${year.value}.xlsx`)
    
    logActivity(
      "Xuất Excel bảng lương",
      `Đã xuất thành công tệp Excel bảng lương Tháng ${month.value}/${year.value} (${dataList.length} nhân viên)`,
      "Lương"
    )

    Swal.fire({
      icon: 'success',
      title: 'Xuất file thành công',
      text: 'Đã tải xuống bảng lương dạng Excel.',
      timer: 1500,
      showConfirmButton: false,
      background: '#ffffff',
      color: '#1e293b'
    })
  } catch (err: any) {
    console.error('Excel export error:', err)
    let errorMsg = 'Không thể tạo file Excel.'
    if (err.response) {
      const status = err.response.status
      if (status === 401 || status === 403) {
        errorMsg = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để xuất file.'
      } else if (status === 404) {
        errorMsg = 'Phiên đăng nhập đã hết hạn hoặc không tìm thấy API bảng lương (404). Vui lòng đăng nhập lại để xuất file.'
      } else {
        errorMsg = err.response.data?.message || errorMsg
      }
    } else if (err.message) {
      errorMsg = `Lỗi: ${err.message}`
    }

    logActivity(
      "Xuất Excel bảng lương",
      "Lương",
      "Thất bại"
    )

    Swal.fire({
      icon: 'error',
      title: 'Lỗi xuất file',
      text: errorMsg,
      confirmButtonColor: '#9d804e',
      background: '#ffffff',
      color: '#1e293b'
    })
  } finally {
    isLoading.value = false
  }
}

// Initial fetch on mount
onMounted(() => {
  fetchPayroll()
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) {
    wrapper.classList.add('full-width-layout')
  }
})

onUnmounted(() => {
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) {
    wrapper.classList.remove('full-width-layout')
  }
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start font-sans select-none-print" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl" class="d-flex flex-column w-full print:shadow-none print:border-none">
      
      <!-- Card Header: Title & Filters (Synchronized layout style) -->
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6 print:hidden">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Bảng Lương</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Quản lý lương và thu nhập của {{ payrollSummary.tongNhanVien || 0 }} nhân sự</div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <!-- Month & Year Select -->
          <div class="h-10 flex items-center gap-2 bg-slate-50 px-3 rounded-lg border border-slate-300">
            <Calendar class="w-4 h-4 text-slate-500" />
            <select 
              v-model="month" 
              @change="fetchPayroll"
              class="appearance-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1 pr-4"
            >
              <option v-for="m in months" :key="m" :value="m">Tháng {{ m }}</option>
            </select>
            <span class="text-slate-300 font-light select-none">|</span>
            <select 
              v-model="year" 
              @change="fetchPayroll"
              class="appearance-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1 pr-4"
            >
              <option v-for="y in years" :key="y" :value="y">Năm {{ y }}</option>
            </select>
          </div>

          <!-- Search input -->
          <div class="relative w-full sm:w-48">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              v-model="searchQuery" 
              placeholder="Tìm thợ, mã..." 
              class="w-full h-10 pl-10 pr-8 rounded-lg border border-slate-300 text-xs font-medium outline-none focus:border-primary bg-white text-slate-800"
            >
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Reset button -->
          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="resetFilters" title="Đặt lại">
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <!-- Export Excel button -->
          <v-btn
            color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold"
            height="40"
            :disabled="isLoading || !payrollSummary.danhSachLuong?.length"
            @click="exportExcel"
          >
            <template v-slot:prepend><FileDown class="w-4 h-4 mr-1" /></template>
            Xuất Excel
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Quick Stats Cards (Synchronized layout style, padding and alignment fixes) -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 px-6 py-6 border-b border-slate-100 bg-slate-50/30 print:hidden w-full">
        <!-- Card 1: Total staff -->
        <div 
          class="bg-white border border-slate-200/60 rounded-xl shadow-xs animate-slideup"
          style="padding: 20px; min-height: 90px; display: flex; align-items: center; justify-content: space-between;"
        >
          <div>
            <p class="text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1">Tổng số nhân viên</p>
            <h2 class="text-2xl font-bold text-slate-800 leading-tight">{{ payrollSummary.tongNhanVien || 0 }} <span class="text-sm font-normal text-slate-500">người</span></h2>
            <div class="flex items-center gap-1 mt-2 text-slate-400 text-[10px] font-semibold">
              <UserCheck class="w-3.5 h-3.5 text-primary"/>
              <span>Đang hoạt động tháng này</span>
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <Users class="w-6 h-6 text-primary" />
          </div>
        </div>

        <!-- Card 2: Total Payroll Budget -->
        <div 
          class="bg-white border border-slate-200/60 rounded-xl shadow-xs animate-slideup"
          style="padding: 20px; min-height: 90px; display: flex; align-items: center; justify-content: space-between;"
        >
          <div>
            <p class="text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1">Tổng quỹ lương dự chi</p>
            <h2 class="text-2xl font-bold text-primary leading-tight">{{ formatVND(payrollSummary.tongQuyLuong) }}</h2>
            <div class="flex items-center gap-1 mt-2 text-slate-400 text-[10px] font-semibold">
              <ArrowUpRight class="w-3.5 h-3.5 text-emerald-500"/>
              <span>Tự động cập nhật theo ca làm</span>
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <Coins class="w-6 h-6 text-primary" />
          </div>
        </div>

        <!-- Card 3: Avg Pay slip -->
        <div 
          class="bg-white border border-slate-200/60 rounded-xl shadow-xs animate-slideup"
          style="padding: 20px; min-height: 90px; display: flex; align-items: center; justify-content: space-between;"
        >
          <div>
            <p class="text-[11px] font-bold text-slate-550 uppercase tracking-wider mb-1">Thực lĩnh trung bình</p>
            <h2 class="text-2xl font-bold text-slate-800 leading-tight">{{ formatVND(averageSalary) }}</h2>
            <div class="flex items-center gap-1 mt-2 text-slate-400 text-[10px] font-semibold">
              <Percent class="w-3.5 h-3.5 text-primary"/>
              <span>Tính trên nhân sự có ca xếp</span>
            </div>
          </div>
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center">
            <TrendingUp class="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      <!-- Table Container -->
      <div class="flex-1 w-full relative p-6 pt-2 print:p-0">
        <!-- Loader Overlay -->
        <div v-if="isLoading" class="absolute inset-0 bg-white/85 backdrop-blur-xs z-50 flex items-center justify-center transition-all">
          <div class="flex flex-col items-center gap-3">
            <div class="w-12 h-12 border-[3px] border-slate-200 border-t-primary rounded-full animate-spin"></div>
            <span class="text-xs font-bold text-slate-500 tracking-widest mt-2">ĐANG TẢI DỮ LIỆU BẢNG LƯƠNG...</span>
          </div>
        </div>

        <div class="overflow-x-auto rounded-xl border border-slate-200">
            <table class="w-full text-left text-xs border-separate border-spacing-0">
              <thead class="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th class="py-3.5 px-6 font-bold text-center w-14 whitespace-nowrap bg-slate-50">STT</th>
                  <th class="py-3.5 px-6 font-bold whitespace-nowrap bg-slate-50">NHÂN VIÊN</th>
                  <th class="py-3.5 px-6 font-bold text-right whitespace-nowrap bg-slate-50">LƯƠNG CƠ BẢN</th>
                  <th class="py-3.5 px-6 font-bold text-center whitespace-nowrap bg-slate-50">CÔNG CHUẨN</th>
                  <th class="py-3.5 px-6 font-bold text-center whitespace-nowrap bg-slate-50">CA THỰC TẾ</th>
                  <th class="py-3.5 px-6 font-bold text-right whitespace-nowrap bg-slate-50">LƯƠNG THEO CÔNG</th>
                  <th class="py-3.5 px-6 font-bold text-right whitespace-nowrap bg-slate-50">HOA HỒNG</th>
                  <th class="py-3.5 px-6 font-bold text-right whitespace-nowrap bg-slate-50">THỰC LĨNH</th>
                  <th class="py-3.5 px-6 font-bold text-center whitespace-nowrap bg-slate-50">CHI TIẾT</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                <!-- Empty state element -->
                <tr v-if="!isLoading && filteredPayroll.length === 0">
                  <td colspan="9" class="p-20 text-center text-slate-500 bg-white">
                    <div class="flex flex-col items-center gap-3.5 max-w-sm mx-auto">
                      <div class="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 mb-2">
                        <TrendingDown class="w-7 h-7 stroke-[1.5px]" />
                      </div>
                      <p class="font-bold text-slate-800 text-sm">Không tìm thấy dữ liệu bảng lương</p>
                      <p class="text-xs text-slate-400 leading-relaxed">Không tìm thấy nhân viên nào phù hợp với bộ lọc và từ khóa tìm kiếm hiện tại.</p>
                      <button @click="resetFilters" class="mt-2 text-xs font-bold text-primary hover:text-primary-dark transition-colors">Đặt lại bộ lọc</button>
                    </div>
                  </td>
                </tr>

                <!-- Table Rows (Explicit alignments on <td> matching headers) -->
                <tr 
                  v-for="(item, index) in filteredPayroll" 
                  :key="item.maNv"
                  @click="openDetail(item)"
                  class="hover:bg-slate-50 border-b border-slate-100 transition-all duration-150 group cursor-pointer"
                >
                  <!-- Index (Aligned Center) -->
                  <td class="py-5 px-6 text-center text-slate-400 font-bold font-mono">{{ Number(index) + 1 }}</td>
                  
                  <!-- Employee (Aligned Left) -->
                  <td class="py-5 px-6 text-left min-w-[180px]">
                    <div class="flex items-center gap-3.5 whitespace-nowrap">
                      <div class="relative flex-shrink-0">
                        <img 
                          v-if="item.hinhAnh" 
                          :src="toAbsUrl(item.hinhAnh)" 
                          class="w-10 h-10 rounded-full object-cover border border-slate-200 shadow-none transition-colors" 
                          alt="avatar"
                        />
                        <div 
                          v-else 
                          class="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 text-primary flex items-center justify-center font-bold text-xs uppercase"
                        >
                          {{ item.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
                        </div>
                      </div>
                      <div class="flex flex-col">
                        <div class="font-semibold text-slate-850 text-xs group-hover:text-primary transition-colors mb-1 whitespace-nowrap">{{ item.hoTenNv }}</div>
                        
                        <!-- Badges (Soft matching standard palette) -->
                        <div class="flex">
                          <span 
                            v-if="item.tenLoaiNv.toUpperCase().includes('STYLIST')" 
                            class="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
                          >
                            {{ item.tenLoaiNv }}
                          </span>
                          <span 
                            v-else-if="item.tenLoaiNv.toUpperCase().includes('PHỤ')" 
                            class="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-amber-50 text-amber-605 border border-amber-200 whitespace-nowrap"
                          >
                            {{ item.tenLoaiNv }}
                          </span>
                          <span 
                            v-else 
                            class="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-slate-55 text-slate-600 border border-slate-200 whitespace-nowrap"
                          >
                            {{ item.tenLoaiNv }}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <!-- Base Salary (Aligned Right) -->
                  <td class="py-5 px-6 text-right font-bold text-slate-700 font-mono whitespace-nowrap">
                    {{ formatVND(item.luongCoBan) }}
                  </td>
                  
                  <!-- Standard shifts target (Aligned Center) -->
                  <td class="py-5 px-6 text-center font-bold text-slate-450 font-mono whitespace-nowrap">
                    {{ item.soNgayCongQuyDinh }}
                  </td>
                  
                  <!-- Worked Shifts (Aligned Center) -->
                  <td class="py-5 px-6 text-center whitespace-nowrap">
                    <div class="flex flex-col items-center justify-center gap-1">
                      <!-- FT / PT badges -->
                      <div class="flex items-center gap-1 flex-wrap justify-center">
                        <span
                          v-if="item.soCaFulltime > 0"
                          class="text-blue-700 font-extrabold text-[10px] font-mono bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded whitespace-nowrap"
                          title="Ca full-time (× 1.0 công)"
                        >{{ item.soCaFulltime }} FT</span>
                        <span
                          v-if="item.soCaParttime > 0"
                          class="text-amber-700 font-extrabold text-[10px] font-mono bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap"
                          title="Ca part-time (× 0.5 công)"
                        >{{ item.soCaParttime }} PT</span>
                        <span
                          v-if="item.soCaFulltime === 0 && item.soCaParttime === 0"
                          class="text-slate-400 font-mono text-[10px]"
                        >0 ca</span>
                      </div>
                      <!-- Effective days label -->
                      <div class="text-slate-500 text-[10px] font-semibold whitespace-nowrap">
                        = <span class="text-primary font-bold">{{ item.soCaChuanQuyDoi }}</span> công
                      </div>
                      <!-- Progress bar based on quy doi -->
                      <div class="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden border border-slate-150" title="Tiến độ công chuẩn">
                        <div
                          class="h-full rounded-full transition-all duration-500"
                          :class="item.soCaChuanQuyDoi >= item.soNgayCongQuyDinh ? 'bg-emerald-500' : 'bg-primary'"
                          :style="{ width: Math.min((item.soCaChuanQuyDoi / item.soNgayCongQuyDinh) * 100, 100) + '%' }"
                        ></div>
                      </div>
                    </div>
                  </td>
                  
                  <!-- Calculate Shift Base pay (Aligned Right) -->
                  <td class="py-5 px-6 text-right font-bold text-slate-700 font-mono whitespace-nowrap">
                    {{ formatVND(item.luongTheoNgayCong) }}
                  </td>
                  
                  <!-- Service commission (Aligned Right) -->
                  <td class="py-5 px-6 text-right font-bold whitespace-nowrap">
                    <div class="flex flex-col items-end gap-0.5">
                      <!-- Hoa hồng dịch vụ -->
                      <span v-if="item.tongHoaHongDv > 0" class="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono text-[11px] whitespace-nowrap">
                        DV +{{ formatVND(item.tongHoaHongDv) }}
                      </span>
                      <!-- Hoa hồng sản phẩm (chỉ thợ chính) -->
                      <span v-if="item.laThoChinh && item.tongHoaHongSp > 0" class="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 font-mono text-[11px] whitespace-nowrap">
                        SP +{{ formatVND(item.tongHoaHongSp) }}
                      </span>
                      <!-- Không có hoa hồng -->
                      <span v-if="!item.tongHoaHongDv && !item.tongHoaHongSp" class="text-slate-450 font-mono">0 ₫</span>
                    </div>
                  </td>
                  
                  <!-- Net pay receipt (Simple Text, Aligned Right) -->
                  <td class="py-5 px-6 text-right font-bold text-slate-800 font-mono text-[13px] whitespace-nowrap">
                    {{ formatVND(item.tongThuNhap) }}
                  </td>
                  
                  <!-- Action detail view with primary hover style (Aligned Center) -->
                  <td class="py-5 px-6 text-center" @click.stop>
                    <v-btn
                      color="info" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                      @click="openDetail(item)"
                    >
                      <template v-slot:prepend><Eye class="w-4 h-4 mr-1" /></template>
                      Chi tiết
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </v-card>

    <Teleport to="body">
      <div 
        v-if="isDetailOpen && selectedSalary" 
        id="payslip-modal-overlay"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0 print:backdrop-blur-none"
      >
      <div 
        id="payslip-print-card"
        class="bg-white w-full max-w-[460px] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 relative animate-slideup"
      >
        <!-- Close Button (Hidden on printing) -->
        <button 
          @click="closeDetail" 
          class="absolute top-4 right-4 p-2 bg-slate-50 hover:bg-slate-100 text-slate-450 hover:text-slate-700 rounded-full transition-colors print:hidden border border-slate-200 focus:outline-none"
        >
          <X class="w-4 h-4" />
        </button>

        <!-- Payslip Header Receipt Style -->
        <div class="!px-6 !py-3 bg-slate-50 text-slate-800 flex flex-col items-center text-center border-b border-slate-100">
          <div class="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center mb-1.5 border border-slate-150 shadow-none">
            <Award class="w-4.5 h-4.5 text-primary" />
          </div>
          <h3 class="text-[8px] font-bold tracking-[0.2em] text-slate-450 uppercase mb-0.5">SALON TÓC MINH TÂM</h3>
          <h2 class="text-sm font-bold tracking-wide text-slate-800 font-sans">PHIẾU LƯƠNG CHI TIẾT</h2>
          <p class="text-[11px] text-slate-500 mt-1 font-sans italic">Tháng {{ selectedSalary.thang }} / Năm {{ selectedSalary.nam }}</p>
        </div>

        <!-- Receipt Body Details -->
        <div class="!px-6 !py-3 flex-1 flex flex-col gap-3 text-xs">
          <!-- Mini employee ID Card card -->
          <div class="flex items-center gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-150">
            <img 
              v-if="selectedSalary.hinhAnh" 
              :src="toAbsUrl(selectedSalary.hinhAnh)" 
              class="w-9 h-9 rounded-full object-cover border border-slate-200 shadow-none" 
              alt="avatar"
            />
            <div 
              v-else 
              class="w-9 h-9 rounded-full bg-white border border-slate-200 text-primary flex items-center justify-center font-bold text-xs"
            >
              {{ selectedSalary.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
            </div>
            <div>
              <div class="font-bold text-slate-800 text-xs leading-tight">{{ selectedSalary.hoTenNv }}</div>
              <div class="flex items-center gap-1.5 mt-0.5 text-[9px] text-slate-500 font-semibold">
                <span>Mã NV: {{ selectedSalary.maNv }}</span>
                <span>•</span>
                <span class="text-primary font-bold uppercase tracking-wider text-[8px]">{{ selectedSalary.tenLoaiNv }}</span>
              </div>
            </div>
          </div>

          <!-- Breakdown list -->
          <div class="flex flex-col gap-1">
            <h4 class="text-[9px] font-bold uppercase text-slate-450 tracking-widest mb-1.5 flex items-center gap-1">
              <Info class="w-3 h-3 text-slate-400"/> CHI TIẾT LƯƠNG
            </h4>
            
            <!-- Base Month Salary -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <span class="text-slate-600 font-medium">Mức lương cơ bản:</span>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ formatVND(selectedSalary.luongCoBan) }}</span>
            </div>

            <!-- Standard shifts -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <span class="text-slate-600 font-medium">Công chuẩn quy định:</span>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ selectedSalary.soNgayCongQuyDinh }} ngày công</span>
            </div>

            <!-- Finished shifts (total raw) -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <span class="text-slate-600 font-medium">Ca làm thực tế:</span>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ selectedSalary.soCaLamThucTe }} ca</span>
            </div>

            <!-- Ca Fulltime breakdown -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60 pl-3">
              <span class="text-slate-500 font-medium text-[11px]">↳ Ca full-time:</span>
              <span class="font-bold text-blue-600 font-mono text-[11px] whitespace-nowrap"
                title="Mỗi ca full-time = 1.0 ngày công"
              >{{ selectedSalary.soCaFulltime }} ca × 1.0</span>
            </div>

            <!-- Ca Parttime breakdown (only if > 0) -->
            <div v-if="selectedSalary.soCaParttime > 0" class="flex justify-between items-center py-1 border-b border-slate-100/60 pl-3">
              <span class="text-slate-500 font-medium text-[11px]">↳ Ca part-time:</span>
              <span class="font-bold text-amber-600 font-mono text-[11px] whitespace-nowrap"
                title="Mỗi ca part-time (4 giờ) = 0.5 ngày công"
              >{{ selectedSalary.soCaParttime }} ca × 0.5</span>
            </div>

            <!-- Effective work days after conversion -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <span class="text-slate-600 font-medium">Công quy đổi thực tế:</span>
              <span class="font-bold text-primary font-mono whitespace-nowrap">{{ selectedSalary.soCaChuanQuyDoi }} công</span>
            </div>

            <!-- Wage calculated from converted shifts -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <div class="flex flex-col">
                <span class="text-slate-600 font-medium">Lương ca thực tế:</span>
                <span class="text-[10px] text-slate-400">(Cơ bản / {{ selectedSalary.soNgayCongQuyDinh }}) × {{ selectedSalary.soCaChuanQuyDoi }} công</span>
              </div>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ formatVND(selectedSalary.luongTheoNgayCong) }}</span>
            </div>

            <!-- Commissions (tách DV và SP) -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <span class="text-slate-600 font-medium">Hoa hồng dịch vụ:</span>
              <span class="font-bold text-emerald-600 font-mono whitespace-nowrap">+{{ formatVND(selectedSalary.tongHoaHongDv) }}</span>
            </div>
            <!-- Hoa hồng SP: chỉ hiện cho thợ chính -->
            <div class="flex justify-between items-center py-1 border-b border-slate-100/60">
              <div class="flex items-center gap-1.5">
                <span class="text-slate-600 font-medium">Hoa hồng sản phẩm:</span>
                <span
                  v-if="selectedSalary.laThoChinh"
                  class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded"
                >Thợ chính</span>
                <span
                  v-else
                  class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-slate-100 text-slate-500 border border-slate-200 rounded"
                >Thợ phụ</span>
              </div>
              <span
                v-if="selectedSalary.laThoChinh"
                class="font-bold text-blue-600 font-mono whitespace-nowrap"
              >+{{ formatVND(selectedSalary.tongHoaHongSp) }}</span>
              <span v-else class="text-slate-400 font-mono text-[11px]">Không áp dụng</span>
            </div>
          </div>

          <!-- Total Receipts box - elegant background glow ticket design -->
          <div class="mt-1 bg-primary/5 py-2.5 px-3 rounded-xl flex items-center justify-between border border-primary/10 shadow-none">
            <div>
              <div class="text-[9px] font-bold text-primary uppercase tracking-widest">THỰC LĨNH NHẬN</div>
              <div class="text-[8px] text-slate-500 font-medium">Lương ca + Hoa hồng</div>
            </div>
            <div class="text-right">
              <span class="text-base font-bold text-primary font-mono whitespace-nowrap">{{ formatVND(selectedSalary.tongThuNhap) }}</span>
            </div>
          </div>

          <!-- Note details -->
          <div class="mt-1 text-center text-[9px] text-slate-400 leading-normal border-t border-slate-100 pt-2">
            <p>Mọi thắc mắc vui lòng liên hệ Kế toán trước ngày 05 hàng tháng.</p>
            <p class="mt-0.5 font-bold text-slate-400">MinhTamHair © 2026</p>
          </div>
        </div>

        <!-- Actions Close/Print -->
        <div class="!px-6 !py-3 bg-slate-50 border-t border-slate-100 flex gap-2.5 print:hidden">
          <button 
            @click="closeDetail"
            class="flex-1 h-9 bg-transparent hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 hover:border-slate-300 focus:outline-none text-xs"
          >
            Đóng
          </button>
          
          <button 
            @click="printPayslip"
            class="flex-1 h-9 bg-primary text-white hover:bg-primary-dark font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-none focus:outline-none text-xs"
          >
            <Printer class="w-3.5 h-3.5 text-white flex-shrink-0" /> In Phiếu Lương
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </v-container>
</template>
<style scoped>
/* Scoped custom classes for scrollbar and print overrides */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f8fafc;
  border-radius: 0px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 0px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.animate-slideup {
  animation: slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom print media configuration */
@media print {
  /* Ensure backgrounds and colors are printed exactly as styled */
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    box-shadow: none !important;
  }

  /* Hide the rest of the application layout */
  body {
    visibility: hidden;
    background-color: white !important;
  }
  
  /* Style and isolate only the specific payslip modal overlay */
  #payslip-modal-overlay {
    visibility: visible !important;
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    width: 100% !important;
    height: 100% !important;
    background: white !important; /* Pure white background page for print */
    backdrop-filter: none !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    justify-content: center !important;
    align-items: flex-start !important;
    z-index: 99999 !important;
    overflow: visible !important;
  }
  
  /* Format the payslip print card exactly like the screen card */
  #payslip-print-card {
    visibility: visible !important;
    display: flex !important;
    flex-direction: column !important;
    width: 460px !important;
    max-w: 95% !important;
    margin: 40px auto !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 16px !important; /* Round corner ticket */
    background-color: white !important;
    overflow: hidden !important;
  }

  /* Ensure all nested elements within the card are visible */
  #payslip-print-card * {
    visibility: visible !important;
  }

  /* Specifically force the gold/gray colors to look good in print */
  span[class*="text-[#8c734b]"],
  h3[class*="text-[#8c734b]"],
  div[class*="text-[#8c734b]"] {
    color: #8c734b !important;
  }

  /* Hide close button and footer action buttons */
  .print\:hidden,
  button,
  .absolute.top-4.right-4 {
    display: none !important;
  }
}
</style>
