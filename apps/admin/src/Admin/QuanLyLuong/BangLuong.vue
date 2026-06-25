<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
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
  Award
} from 'lucide-vue-next'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import Swal from 'sweetalert2'

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
    const response = await axios.get(`${API}/api/salary/summary`, {
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
    worksheet.mergeCells('A1:J1')
    const titleCell = worksheet.getCell('A1')
    titleCell.value = `BẢNG LƯƠNG NHÂN VIÊN - THÁNG ${month.value}/${year.value}`
    titleCell.font = { name: 'Segoe UI', size: 16, bold: true, color: { argb: 'FFFFFFFF' } }
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111111' } } // Dark header
    worksheet.getRow(1).height = 40

    // Subtitle
    worksheet.mergeCells('A2:J2')
    const subtitleCell = worksheet.getCell('A2')
    subtitleCell.value = `Tổng số nhân viên: ${payrollSummary.value.tongNhanVien} | Tổng quỹ lương: ${formatVND(payrollSummary.value.tongQuyLuong)}`
    subtitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF374151' } }
    subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.getRow(2).height = 20

    worksheet.addRow([])

    // 2. Add Header Row
    const headers = [
      'STT', 
      'Mã Nhân Viên', 
      'Họ và Tên', 
      'Chức Vụ', 
      'Lương Cơ Bản', 
      'Công Chuẩn', 
      'Số Ca Làm', 
      'Lương Ngày Công', 
      'Hoa Hồng Dịch Vụ', 
      'Thực Lĩnh'
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
        item.soCaLamThucTe,
        parseFloat(item.luongTheoNgayCong),
        parseFloat(item.tongHoaHong),
        parseFloat(item.tongThuNhap)
      ])
      row.height = 24
      
      row.getCell(1).alignment = { horizontal: 'center' }
      row.getCell(2).alignment = { horizontal: 'center' }
      row.getCell(4).alignment = { horizontal: 'left' }
      row.getCell(6).alignment = { horizontal: 'center' }
      row.getCell(7).alignment = { horizontal: 'center' }

      row.getCell(5).numFmt = '#,##0" ₫"'
      row.getCell(8).numFmt = '#,##0" ₫"'
      row.getCell(9).numFmt = '#,##0" ₫"'
      row.getCell(10).numFmt = '#,##0" ₫"'

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
      'Tổng cộng', '', '', '',
      '', '', '', 
      { formula: `=SUM(H5:H${summaryRowIdx - 1})` }, 
      { formula: `=SUM(I5:I${summaryRowIdx - 1})` }, 
      { formula: `=SUM(J5:J${summaryRowIdx - 1})` }
    ])
    summaryRow.height = 28
    
    worksheet.mergeCells(`A${summaryRowIdx}:G${summaryRowIdx}`)
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
      
      if (colNum >= 8) {
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

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Bang_Luong_Thang_${month.value}_${year.value}.xlsx`)
    
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
})
</script>

<template>
  <div class="payroll-container min-h-[calc(100vh-64px)] w-full flex flex-col bg-[#fcfbfc] text-slate-850 overflow-hidden p-4 md:p-6 select-none-print font-sans antialiased relative">
    
    <!-- Decorative Ambient Glows for luxury feel -->
    <div class="absolute top-12 left-1/4 w-[350px] h-[350px] bg-[#bfa77a]/8 rounded-full blur-[100px] pointer-events-none -translate-y-1/2"></div>
    <div class="absolute bottom-24 right-1/4 w-[350px] h-[350px] bg-[#bfa77a]/5 rounded-full blur-[120px] pointer-events-none translate-y-1/2"></div>

    <!-- Top Filter Area - Fixed deformation issues, added relative positioning and robust alignments -->
    <div class="flex-shrink-0 w-full bg-transparent py-4 px-1 mb-6 print:hidden z-10">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <!-- Title & slogan -->
        <div class="pl-1">
          <h1 class="text-2xl md:text-3xl font-serif text-[#8c734b] tracking-wider font-light flex items-center gap-3">
            <Award class="w-8 h-8 text-[#8c734b] flex-shrink-0" />
            <span>BẢNG LƯƠNG NHÂN SỰ</span>
          </h1>
          <p class="text-[10px] text-slate-500 mt-2 font-serif italic tracking-wide">
            "Nơi kỹ nghệ kéo vàng giao thoa cùng cảm hứng thời trang đương đại."
          </p>
        </div>

        <!-- Controls aligned horizontally with individual relative arrow wrappers -->
        <div class="flex flex-wrap items-center gap-4 lg:justify-end">
          
          <!-- Month/Year select boxes with clear separate styling & absolute position scopes -->
          <div class="h-11 flex items-center gap-2 bg-slate-50 px-3 rounded-none border border-slate-200/80 shadow-none hover:border-[#bfa77a]/40 transition-colors">
            <Calendar class="w-4 h-4 text-slate-400 flex-shrink-0" />
            
            <!-- Month dropdown wrapper with specific relative scope -->
            <div class="relative flex items-center">
              <select 
                v-model="month" 
                @change="fetchPayroll"
                class="appearance-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1.5 pl-1 pr-6 rounded-none hover:text-slate-900 transition-colors"
              >
                <option v-for="m in months" :key="m" :value="m" class="bg-white text-slate-700">Tháng {{ m }}</option>
              </select>
              <span class="pointer-events-none absolute right-1.5 text-[8px] text-[#8c734b]">▼</span>
            </div>
            
            <span class="text-slate-300 font-light select-none">|</span>
            
            <!-- Year dropdown wrapper with specific relative scope -->
            <div class="relative flex items-center">
              <select 
                v-model="year" 
                @change="fetchPayroll"
                class="appearance-none bg-transparent text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer py-1.5 pl-1 pr-6 rounded-none hover:text-slate-900 transition-colors"
              >
                <option v-for="y in years" :key="y" :value="y" class="bg-white text-slate-700">Năm {{ y }}</option>
              </select>
              <span class="pointer-events-none absolute right-1.5 text-[8px] text-[#8c734b]">▼</span>
            </div>
          </div>

          <!-- Search Input -->
          <div class="relative w-full sm:w-48">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              v-model="searchQuery" 
              placeholder="Tìm thợ, mã..." 
              class="w-full h-11 pl-10 pr-8 rounded-none border border-slate-200/80 text-xs font-medium outline-none focus:border-[#8c734b] focus:ring-1 focus:ring-[#8c734b]/15 bg-slate-50 focus:bg-white text-slate-800 placeholder:text-slate-400 transition-all shadow-none hover:border-[#bfa77a]/40"
            >
            <button 
              v-if="searchQuery" 
              @click="searchQuery = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-650 transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Actions Grouped (Reset & Export button in one line) -->
          <div class="flex items-center gap-3 w-full sm:w-auto">
            <button 
              @click="resetFilters" 
              class="flex-1 sm:flex-initial h-11 px-4 bg-transparent hover:bg-slate-50 text-[#8c734b] text-xs font-bold rounded-none border border-[#8c734b]/30 hover:border-[#8c734b]/60 transition-all cursor-pointer shadow-none"
            >
              Đặt lại
            </button>
            <button 
              @click="exportExcel" 
              :disabled="isLoading || !payrollSummary.danhSachLuong?.length"
              class="flex-1 sm:flex-initial h-11 px-5 !bg-[#9d804e] !text-white disabled:!bg-slate-100 disabled:!text-slate-400 disabled:!border-slate-200 disabled:!cursor-not-allowed transition-all duration-300 text-xs font-bold flex items-center justify-center gap-2 rounded-none border !border-[#9d804e] cursor-pointer shadow-none tracking-wider flex-shrink-0"
            >
              <FileDown class="w-4 h-4 flex-shrink-0" /> Xuất Excel
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Stats Cards (Light luxury, Fixed letter clipping bug, pl-2) -->
    <div class="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-6 mb-6 print:hidden z-10">
      <!-- Card 1: Total staff -->
      <div class="p-6 rounded-none bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-none">
        <div class="z-10 pl-2">
          <p class="text-[10px] font-bold text-slate-400 tracking-wider mb-2 select-none">TỔNG SỐ NHÂN VIÊN</p>
          <h2 class="text-3xl font-bold text-slate-800 leading-tight tracking-tight font-mono">{{ payrollSummary.tongNhanVien || 0 }} <span class="text-lg font-sans font-normal text-slate-450">người</span></h2>
          <div class="flex items-center gap-1.5 mt-3 text-slate-500 text-xs font-semibold">
            <span class="inline-flex items-center justify-center w-4 h-4 rounded-none bg-[#bfa77a]/15 text-[9px] text-[#8c734b]"><UserCheck class="w-2.5 h-2.5"/></span>
            <span>Đang hoạt động trong tháng này</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-none z-10 border border-slate-150 mr-1">
          <Users class="w-7 h-7 text-[#8c734b]" />
        </div>
      </div>

      <!-- Card 2: Total Payroll Budget -->
      <div class="p-6 rounded-none bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-none">
        <div class="z-10 pl-2">
          <p class="text-[10px] font-bold text-slate-400 tracking-wider mb-2 select-none">TỔNG QUỸ LƯƠNG DỰ CHI</p>
          <h2 class="text-3xl font-bold text-[#8c734b] leading-tight tracking-tight font-mono">{{ formatVND(payrollSummary.tongQuyLuong) }}</h2>
          <div class="flex items-center gap-1.5 mt-3 text-slate-500 text-xs font-semibold">
            <span class="inline-flex items-center justify-center w-4 h-4 rounded-none bg-emerald-50 text-[9px] text-emerald-600 border border-emerald-100"><ArrowUpRight class="w-2.5 h-2.5"/></span>
            <span>Tự động cập nhật theo ca hoàn thành</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-none z-10 border border-slate-150 mr-1">
          <Coins class="w-7 h-7 text-[#8c734b]" />
        </div>
      </div>

      <!-- Card 3: Avg Pay slip -->
      <div class="p-6 rounded-none bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01] hover:shadow-none">
        <div class="z-10 pl-2">
          <p class="text-[10px] font-bold text-slate-400 tracking-wider mb-2 select-none">THỰC LĨNH TRUNG BÌNH</p>
          <h2 class="text-3xl font-bold text-slate-800 leading-tight tracking-tight font-mono">{{ formatVND(averageSalary) }}</h2>
          <div class="flex items-center gap-1.5 mt-3 text-slate-500 text-xs font-semibold">
            <span class="inline-flex items-center justify-center w-4 h-4 rounded-none bg-[#bfa77a]/15 text-[9px] text-[#8c734b]"><Percent class="w-2.5 h-2.5"/></span>
            <span>Tính dựa trên số nhân viên đã xếp ca</span>
          </div>
        </div>
        <div class="p-4 bg-slate-50 rounded-none z-10 border border-slate-150 mr-1">
          <TrendingUp class="w-7 h-7 text-[#8c734b]" />
        </div>
      </div>
    </div>

    <!-- Table Container Card (Light Luxury White, Spacing & Hover bg-[#bfa77a]/5, Luxury role badges) -->
    <div class="flex-1 w-full bg-white rounded-none border border-slate-150 shadow-none relative overflow-hidden flex flex-col print:hidden z-10">
      <!-- Loader Overlay -->
      <div v-if="isLoading" class="absolute inset-0 bg-white/85 backdrop-blur-xs z-50 flex items-center justify-center transition-all">
        <div class="flex flex-col items-center gap-3">
          <div class="w-12 h-12 border-[3px] border-slate-200 border-t-[#8c734b] rounded-full animate-spin"></div>
          <span class="text-xs font-bold text-slate-500 tracking-widest mt-2">ĐANG TẢI DỮ LIỆU BẢNG LƯƠNG...</span>
        </div>
      </div>

      <!-- Table Body -->
      <div class="flex-1 overflow-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-separate border-spacing-0">
          <thead class="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-[#bfa77a]/20">
            <tr class="border-b border-[#bfa77a]/20">
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 w-14 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">STT</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 bg-slate-50/95 tracking-wider select-none whitespace-nowrap">NHÂN VIÊN</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-right bg-slate-50/95 tracking-wider select-none whitespace-nowrap">LƯƠNG CƠ BẢN</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">CÔNG CHUẨN</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">CA THỰC TẾ</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-right bg-slate-50/95 tracking-wider select-none whitespace-nowrap">LƯƠNG THEO CÔNG</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-right bg-slate-50/95 tracking-wider select-none whitespace-nowrap">HOA HỒNG</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-right bg-slate-50/95 tracking-wider select-none whitespace-nowrap">THỰC LĨNH</th>
              <th class="py-5 px-6 font-bold text-[#8c734b] border-b border-[#bfa77a]/20 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">CHI TIẾT</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- Empty state element -->
            <tr v-if="!isLoading && filteredPayroll.length === 0">
              <td colspan="9" class="p-20 text-center text-slate-500">
                <div class="flex flex-col items-center gap-3.5 max-w-sm mx-auto">
                  <div class="w-14 h-14 bg-slate-50 rounded-none flex items-center justify-center text-slate-400 border border-slate-200 mb-2">
                    <TrendingDown class="w-7 h-7 stroke-[1.5px]" />
                  </div>
                  <p class="font-bold text-slate-800 text-sm">Không tìm thấy dữ liệu bảng lương</p>
                  <p class="text-xs text-slate-400 leading-relaxed">Không tìm thấy nhân viên nào phù hợp với bộ lọc và từ khóa tìm kiếm hiện tại.</p>
                  <button @click="resetFilters" class="mt-2 text-xs font-bold text-[#8c734b] hover:text-[#6a532e] transition-colors">Đặt lại bộ lọc</button>
                </div>
              </td>
            </tr>

            <!-- Table Rows (Explicit alignments on <td> matching headers, hover effect bg-[#bfa77a]/5) -->
            <tr 
              v-for="(item, index) in filteredPayroll" 
              :key="item.maNv"
              @click="openDetail(item)"
              class="hover:bg-[#bfa77a]/5 border-b border-slate-100 transition-all duration-150 group cursor-pointer"
            >
              <!-- Index (Aligned Center) -->
              <td class="py-5 px-6 text-center text-slate-400 font-bold font-mono">{{ Number(index) + 1 }}</td>
              
              <!-- Employee (Aligned Left) -->
              <td class="py-5 px-6 text-left">
                <div class="flex items-center gap-3.5">
                  <div class="relative flex-shrink-0">
                    <img 
                      v-if="item.hinhAnh" 
                      :src="toAbsUrl(item.hinhAnh)" 
                      class="w-10 h-10 rounded-none object-cover border border-[#bfa77a]/30 shadow-none group-hover:border-[#bfa77a] transition-colors" 
                      alt="avatar"
                    />
                    <div 
                      v-else 
                      class="w-10 h-10 rounded-none bg-slate-50 border border-slate-200 text-[#8c734b] flex items-center justify-center font-bold text-xs uppercase"
                    >
                      {{ item.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
                    </div>
                  </div>
                  <div>
                    <div class="font-semibold text-slate-800 text-xs group-hover:text-[#8c734b] transition-colors mb-1.5">{{ item.hoTenNv }}</div>
                    
                    <!-- Badges (Soft luxury tones aligned with customer palette) -->
                    <span 
                      v-if="item.tenLoaiNv.toUpperCase().includes('STYLIST')" 
                      class="inline-flex items-center px-2 py-0.5 rounded-none text-[8px] font-extrabold uppercase tracking-widest bg-[#bfa77a]/15 text-[#8c734b] border border-[#bfa77a]/25"
                    >
                      {{ item.tenLoaiNv }}
                    </span>
                    <span 
                      v-else-if="item.tenLoaiNv.toUpperCase().includes('PHỤ')" 
                      class="inline-flex items-center px-2 py-0.5 rounded-none text-[8px] font-extrabold uppercase tracking-widest bg-amber-55 text-amber-600 border border-amber-200"
                    >
                      {{ item.tenLoaiNv }}
                    </span>
                    <span 
                      v-else 
                      class="inline-flex items-center px-2 py-0.5 rounded-none text-[8px] font-extrabold uppercase tracking-widest bg-slate-55 text-slate-600 border border-slate-200"
                    >
                      {{ item.tenLoaiNv }}
                    </span>
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
                <div class="flex flex-col items-center justify-center">
                  <span class="text-slate-700 font-bold text-[11px] font-mono whitespace-nowrap">{{ item.soCaLamThucTe }} ca</span>
                  <!-- Micro luxury progress bar -->
                  <div class="w-16 bg-slate-100 h-1 rounded-none mt-1.5 overflow-hidden border border-slate-150" title="Tiến độ công chuẩn">
                    <div 
                      class="h-full rounded-none transition-all duration-500" 
                      :class="item.soCaLamThucTe >= item.soNgayCongQuyDinh ? 'bg-emerald-500' : 'bg-[#9d804e]'"
                      :style="{ width: Math.min((item.soCaLamThucTe / item.soNgayCongQuyDinh) * 100, 100) + '%' }"
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
                <span v-if="item.tongHoaHong > 0" class="inline-flex items-center px-2 py-0.5 rounded-none bg-emerald-50 text-emerald-600 border border-emerald-100 font-mono whitespace-nowrap">
                  +{{ formatVND(item.tongHoaHong) }}
                </span>
                <span v-else class="text-slate-400 font-mono">0 ₫</span>
              </td>
              
              <!-- Net pay receipt (Simple Text, Aligned Right) -->
              <td class="py-5 px-6 text-right font-bold text-slate-800 font-mono text-[13px] whitespace-nowrap">
                {{ formatVND(item.tongThuNhap) }}
              </td>
              
              <!-- Action detail view with gold hover style (Aligned Center) -->
              <td class="py-5 px-6 text-center" @click.stop>
                <button 
                  @click="openDetail(item)"
                  class="w-8 h-8 rounded-none bg-slate-50 hover:bg-[#bfa77a]/20 text-slate-400 hover:text-[#8c734b] flex items-center justify-center transition-all mx-auto border border-slate-200 hover:border-[#bfa77a]/30"
                  title="Xem Phiếu Lương Chi Tiết"
                >
                  <Eye class="w-4 h-4" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- PAYSPLIP DETAIL MODAL (HIGH-END INVOICE SLIP UX) -->
    <div 
      v-if="isDetailOpen && selectedSalary" 
      id="payslip-modal-overlay"
      class="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto print:fixed print:inset-0 print:bg-white print:p-0 print:backdrop-blur-none"
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
        <div class="!px-8 !py-4 bg-slate-50 text-slate-800 flex flex-col items-center text-center border-b border-slate-100">
          <div class="w-12 h-12 bg-[#bfa77a]/10 rounded-full flex items-center justify-center mb-3 border border-slate-150 shadow-none">
            <Award class="w-6 h-6 text-[#8c734b]" />
          </div>
          <h3 class="text-[9px] font-bold tracking-[0.25em] text-[#8c734b] uppercase mb-1">SALON TÓC MINH TÂM</h3>
          <h2 class="text-base font-bold tracking-wide text-slate-800 font-sans">PHIẾU LƯƠNG CHI TIẾT</h2>
          <p class="text-xs text-slate-500 mt-1.5 font-serif italic">Tháng {{ selectedSalary.thang }} / Năm {{ selectedSalary.nam }}</p>
        </div>

        <!-- Receipt Body Details -->
        <div class="!px-8 !py-4 flex-1 flex flex-col gap-4 text-xs">
          <!-- Mini employee ID Card card -->
          <div class="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
            <img 
              v-if="selectedSalary.hinhAnh" 
              :src="toAbsUrl(selectedSalary.hinhAnh)" 
              class="w-11 h-11 rounded-full object-cover border border-[#bfa77a]/30 shadow-none" 
              alt="avatar"
            />
            <div 
              v-else 
              class="w-11 h-11 rounded-full bg-white border border-slate-200 text-[#8c734b] flex items-center justify-center font-bold text-sm"
            >
              {{ selectedSalary.hoTenNv.split(' ').pop()?.[0] || 'NV' }}
            </div>
            <div>
              <div class="font-bold text-slate-800 text-sm leading-tight">{{ selectedSalary.hoTenNv }}</div>
              <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-semibold">
                <span>Mã NV: {{ selectedSalary.maNv }}</span>
                <span>•</span>
                <span class="text-[#8c734b] font-bold uppercase tracking-wider">{{ selectedSalary.tenLoaiNv }}</span>
              </div>
            </div>
          </div>

          <!-- Breakdown list -->
          <div class="flex flex-col gap-1.5">
            <h4 class="text-[10px] font-bold uppercase text-slate-500 tracking-widest mb-1 flex items-center gap-1.5">
              <Info class="w-3.5 h-3.5 text-slate-450"/> CHI TIẾT CÁC MỤC TÍNH LƯƠNG
            </h4>
            
            <!-- Base Month Salary -->
            <div class="flex justify-between items-center py-1.5 border-b border-slate-100/80">
              <span class="text-slate-600 font-medium">Mức lương cơ bản (Tháng):</span>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ formatVND(selectedSalary.luongCoBan) }}</span>
            </div>

            <!-- Standard shifts -->
            <div class="flex justify-between items-center py-1.5 border-b border-slate-100/80">
              <span class="text-slate-600 font-medium">Số ngày công quy định:</span>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ selectedSalary.soNgayCongQuyDinh }} ngày công</span>
            </div>

            <!-- Finished shifts -->
            <div class="flex justify-between items-center py-1.5 border-b border-slate-100/80">
              <span class="text-slate-600 font-medium">Số ca hoàn thành thực tế:</span>
              <span class="font-bold text-[#8c734b] font-mono whitespace-nowrap">{{ selectedSalary.soCaLamThucTe }} ca làm</span>
            </div>

            <!-- Wage calculated from shifts -->
            <div class="flex justify-between items-center py-1.5 border-b border-slate-100/80">
              <div class="flex flex-col">
                <span class="text-slate-600 font-medium">Lương ca thực tế:</span>
                <span class="text-[9px] text-slate-400 font-medium italic mt-0.5">(Lương cơ bản / công chuẩn * ca)</span>
              </div>
              <span class="font-bold text-slate-900 font-mono whitespace-nowrap">{{ formatVND(selectedSalary.luongTheoNgayCong) }}</span>
            </div>

            <!-- Commissions -->
            <div class="flex justify-between items-center py-1.5 border-b border-slate-100/80">
              <span class="text-slate-600 font-medium">Hoa hồng dịch vụ:</span>
              <span class="font-bold text-emerald-600 font-mono whitespace-nowrap">+{{ formatVND(selectedSalary.tongHoaHong) }}</span>
            </div>
          </div>

          <!-- Total Receipts box - elegant gold background glow ticket design -->
          <div class="mt-2.5 bg-[#bfa77a]/12 p-4 rounded-xl flex items-center justify-between border border-[#bfa77a]/20 shadow-none">
            <div>
              <div class="text-[10px] font-bold text-[#8c734b] uppercase tracking-widest">THỰC LĨNH NHẬN</div>
              <div class="text-[9px] text-slate-600 font-medium mt-0.5">Lương ca + Hoa hồng</div>
            </div>
            <div class="text-right">
              <span class="text-xl font-bold text-[#8c734b] font-mono whitespace-nowrap">{{ formatVND(selectedSalary.tongThuNhap) }}</span>
            </div>
          </div>

          <!-- Note details -->
          <div class="mt-2.5 text-center text-[10px] text-slate-450 leading-relaxed border-t border-slate-100 pt-2.5">
            <p>Mọi thắc mắc liên quan đến tính toán phiếu lương vui lòng gửi phản hồi tới ban quản trị hoặc bộ phận Kế toán trước ngày 05 hàng tháng.</p>
            <p class="mt-2 font-bold text-slate-400">MinhTamHair © 2026 - Sự cống hiến của bạn là giá trị của chúng tôi.</p>
          </div>
        </div>

        <!-- Actions Close/Print -->
        <div class="!px-8 !py-4 bg-slate-50 border-t border-slate-100 flex gap-3 print:hidden">
          <button 
            @click="closeDetail"
            class="flex-1 h-11 bg-transparent hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 hover:border-slate-300 focus:outline-none"
          >
            Đóng
          </button>
          
          <button 
            @click="printPayslip"
            class="flex-1 h-11 !bg-[#9d804e] !text-white hover:!bg-[#866a3d] font-bold rounded-xl flex items-center justify-center gap-2 transition-all border !border-[#9d804e] cursor-pointer shadow-none focus:outline-none"
          >
            <Printer class="w-4 h-4 !text-white flex-shrink-0" /> In Phiếu Lương
          </button>
        </div>
      </div>
    </div>
  </div>
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
