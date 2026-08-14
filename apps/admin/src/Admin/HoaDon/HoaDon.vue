<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive, onUnmounted } from 'vue'
import axios from 'axios'
import {
  Search, FileDown, Eye, X, Printer, ShoppingBag, Scissors,
  FileText, RotateCcw, Filter, CheckCircle, AlertCircle, Clock, XCircle
} from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/hoa-don`

// ── THEME SYNC ──
const theme = useTheme()
const customizer = useCustomizerStore()

watch(
  [() => theme.global.name.value, () => customizer.actTheme],
  ([vTheme, cTheme]) => {
    const current = vTheme || cTheme
    if (current === 'dark') {
      document.documentElement.classList.add('dark')
      document.body.style.backgroundColor = '#141416'
    } else {
      document.documentElement.classList.remove('dark')
      document.body.style.backgroundColor = ''
    }
  },
  { immediate: true }
)

onUnmounted(() => {
  document.body.style.backgroundColor = ''
})

// ── HIGH PRIORITY NOTIFICATION SNACKBAR ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success'
})

const showNotification = (text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

// ── STATE ──
const hoaDonSanPham = ref<any[]>([])
const hoaDonDichVu = ref<any[]>([])

const isLoading = ref(false)
const searchQuery = ref('')
const selectedStatusFilter = ref<string>('')
const activeTab = ref<'dichVu' | 'sanPham'>('dichVu')
const errorMessage = ref('')

const getFirstDayOfMonthString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

const getLocalDateString = () => {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const filter = ref({
  tuNgay: getFirstDayOfMonthString(),
  denNgay: getLocalDateString()
})

const statusFilterOptions = [
  { title: 'Tất cả trạng thái', value: '' },
  { title: 'Chờ xử lý / Đã cọc 10%', value: '1' },
  { title: 'Đang giao / Đã thanh toán', value: '2' },
  { title: 'Đã giao hàng / Hoàn thành', value: '3' },
  { title: 'Đã Hủy', value: '0' }
]

const getAuthHeaders = () => {
  const token =
    sessionStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('accessToken') ||
    sessionStorage.getItem('token')
  return { Authorization: `Bearer ${token}` }
}

const fetchHoaDons = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const params = {
      tuNgay: filter.value.tuNgay,
      denNgay: filter.value.denNgay,
      search: searchQuery.value
    }
    const res = await axios.get(`${API_BASE_URL}/danh-sach`, {
      params,
      headers: getAuthHeaders()
    })

    if (res.data.success) {
      let dashboardSpMap = new Map()
      try {
        const dbRes = await axios.get(`${API}/api/ThongKe/admin-dashboard`, {
          params: {
            startDate: filter.value.tuNgay,
            endDate: filter.value.denNgay,
            searchMaHd: searchQuery.value
          },
          headers: getAuthHeaders()
        })
        if (dbRes.data && dbRes.data.hoaDonSanPham) {
          dbRes.data.hoaDonSanPham.forEach((hd: any) => {
            const ma = String(hd.maHd || hd.MaHd || '').toUpperCase()
            dashboardSpMap.set(ma, hd.chiTiet || hd.ChiTiet)
          })
        }
      } catch (err) {
        console.error('Lỗi khi tải thông tin chi tiết từ dashboard:', err)
      }

      const allData = [
        ...(res.data.hoaDonSanPham || []),
        ...(res.data.hoaDonDichVu || [])
      ]

      allData.forEach((h: any) => {
        const ma = String(h.maHd || '').toUpperCase()
        if (dashboardSpMap.has(ma)) {
          h.chiTiet = dashboardSpMap.get(ma)
        }
      })

      hoaDonSanPham.value = allData.filter((h: any) => {
        const ma = String(h.maHd || '').toUpperCase()
        return ma.startsWith('SP') || ma.startsWith('HDSP')
      })

      hoaDonDichVu.value = allData.filter((h: any) => {
        const ma = String(h.maHd || '').toUpperCase()
        return !ma.startsWith('SP') && !ma.startsWith('HDSP')
      })
    }
  } catch (e: any) {
    console.error(e)
    errorMessage.value =
      e.response?.status === 403
        ? 'Lỗi 403: Tài khoản hiện tại không có quyền truy cập module này hoặc Token hết hạn.'
        : e.response?.data?.message || 'Không thể kết nối đến máy chủ hệ thống.'
    showNotification(errorMessage.value, 'error')
  } finally {
    isLoading.value = false
  }
}

// ── STATUS DISPLAY & CHIP COLORS ──
const getStatusText = (status: number, maHd: string = '') => {
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')
  const map: Record<number, string> = {
    0: 'Đã Hủy',
    1: laDonSp ? 'Chờ xử lý' : 'Đã cọc 10%',
    2: laDonSp ? 'Đang giao' : 'Đã thanh toán',
    3: laDonSp ? 'Đã giao hàng' : 'Hoàn thành'
  }
  return map[status] || 'N/A'
}

const getStatusSelectOptions = (maHd: string = '') => {
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')
  return [
    { title: laDonSp ? 'Chờ xử lý' : 'Đã cọc 10%', value: 1 },
    { title: laDonSp ? 'Đang giao' : 'Đã thanh toán', value: 2 },
    { title: laDonSp ? 'Đã giao hàng' : 'Hoàn thành', value: 3 },
    { title: 'Đã Hủy', value: 0 }
  ]
}

const changeInvoiceStatus = async (maHd: string, newStatus: number) => {
  const allData = [...hoaDonSanPham.value, ...hoaDonDichVu.value]
  const currentHd =
    allData.find((h) => h.maHd === maHd) ||
    (selectedHd.value && selectedHd.value.maHd === maHd ? selectedHd.value : null)

  if (currentHd && (currentHd.trangThai === 3 || currentHd.trangThai === 0)) {
    showNotification('Đơn hàng đã hoàn thành hoặc đã hủy. Không thể thay đổi trạng thái.', 'warning')
    return
  }

  try {
    const payload = { trangThai: newStatus }

    const res = await axios
      .patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, payload, {
        headers: getAuthHeaders()
      })
      .catch(async () => {
        return await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, newStatus, {
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
        })
      })

    if (res.data.success) {
      logActivity(
        'Đổi trạng thái hóa đơn',
        `Đã chuyển trạng thái hóa đơn ${maHd} sang "${getStatusText(newStatus, maHd)}"`,
        'Hóa đơn'
      )
      showNotification(`Đã cập nhật trạng thái hóa đơn ${maHd} sang "${getStatusText(newStatus, maHd)}"`, 'success')
      await fetchHoaDons()
      if (selectedHd.value && selectedHd.value.maHd === maHd) {
        selectedHd.value.trangThai = newStatus
      }
    }
  } catch (e: any) {
    logActivity(
      'Đổi trạng thái hóa đơn',
      `Thất bại khi chuyển trạng thái hóa đơn ${maHd} - Lỗi: ${e.message || ''}`,
      'Hóa đơn',
      'Thất bại'
    )
    showNotification('Lỗi khi cập nhật trạng thái đơn hàng. Vui lòng kiểm tra lại quyền hạn tài khoản.', 'error')
  }
}

const exportExcel = async () => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('HoaDon')
  worksheet.addRow(['Mã HD', 'Khách hàng', 'Ngày tạo', 'Thành tiền', 'Trạng thái']).font = { bold: true }

  const targetList = filteredInvoices.value
  targetList.forEach((h) => {
    worksheet.addRow([
      h.maHd,
      h.tenKhachHang,
      h.ngayTao,
      h.thanhTien,
      getStatusText(h.trangThai, h.maHd)
    ])
  })
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `Bao_Cao_Hoa_Don_${activeTab.value}.xlsx`)

  logActivity(
    'Xuất Excel hóa đơn',
    `Đã xuất tệp Excel danh sách hóa đơn phân hệ ${activeTab.value === 'dichVu' ? 'Dịch vụ' : 'Sản phẩm'} (${targetList.length} hóa đơn)`,
    'Hóa đơn'
  )
  showNotification(`Đã xuất tệp Excel danh sách hóa đơn thành công!`, 'success')
}

const isModalOpen = ref(false)
const selectedHd = ref<any>(null)

const viewDetail = async (maHd: string) => {
  try {
    const res = await axios.get(`${API_BASE_URL}/chi-tiet/${maHd}`, {
      headers: getAuthHeaders()
    })
    if (res.data.success) {
      const detail = res.data.data
      const match = [...hoaDonSanPham.value, ...hoaDonDichVu.value].find(
        (h) => String(h.maHd || '').toUpperCase() === String(maHd).toUpperCase()
      )
      if (match && match.chiTiet) {
        detail.chiTiet = match.chiTiet
      }
      selectedHd.value = detail
      isModalOpen.value = true
    }
  } catch (e) {
    showNotification('Không thể tải chi tiết hóa đơn', 'error')
  }
}

const printInvoice = () => {
  if (!selectedHd.value) return

  const hd = selectedHd.value
  logActivity(
    'In hóa đơn',
    `Đã in chi tiết hóa đơn ${hd.maHd} cho khách hàng ${hd.tenKh || ''}`,
    'Hóa đơn'
  )

  const isSp = String(hd.maHd || '').toUpperCase().startsWith('SP') || String(hd.maHd || '').toUpperCase().startsWith('HDSP')
  const items = isSp ? (hd.chiTiet || hd.chiTietDichVu || []) : (hd.chiTietDichVu || [])

  const itemsHtml = items.length > 0 ? items.map((item: any) => {
    const ten = item.ten || item.Ten || item.tenHangMuc || item.tenSP || item.tenSp || 'Dịch vụ Salon'
    const sl = item.soLuong || item.SoLuong || item.soluong || 1
    const gia = item.thanhTien || item.ThanhTien || ((item.gia || item.Gia || item.giaBan || 0) * sl)
    const ghiChu = isSp ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống')
    return `
      <tr>
        <td style="padding: 6px 4px; text-align: left; word-break: break-word;">${ten}</td>
        <td style="padding: 6px 4px; text-align: center;">${sl}</td>
        <td style="padding: 6px 4px; text-align: center;">${ghiChu}</td>
        <td style="padding: 6px 4px; text-align: right; font-weight: bold;">${Number(gia).toLocaleString()}₫</td>
      </tr>
    `
  }).join('') : `<tr><td colspan="4" style="text-align: center; padding: 10px;">Không có mục chi tiết</td></tr>`

  const printWindow = window.open('', '_blank', 'width=750,height=750,top=100,left=200')
  if (!printWindow) {
    showNotification('Trình duyệt đang chặn Cửa sổ Popup. Vui lòng cho phép Popup để in hóa đơn.', 'warning')
    return
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="utf-8">
      <title>In Hóa Đơn #${hd.maHd}</title>
      <style>
        * { box-sizing: border-box; }
        html, body {
          width: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          background-color: #f1f5f9;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        body {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .receipt-card {
          width: 100%;
          max-width: 500px;
          margin: 0 auto;
          padding: 24px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border: 1px solid #cbd5e1;
          font-size: 12px;
          line-height: 1.5;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #cbd5e1;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .salon-name {
          font-size: 17px;
          font-weight: 800;
          text-transform: uppercase;
          color: #0284c7;
          margin-bottom: 4px;
        }
        .salon-info {
          font-size: 11px;
          color: #475569;
        }
        .doc-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          margin-top: 8px;
          color: #0f172a;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          margin-bottom: 4px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
          font-size: 11px;
        }
        th {
          border-top: 2px dashed #cbd5e1;
          border-bottom: 2px dashed #cbd5e1;
          padding: 6px 4px;
          text-transform: uppercase;
          font-weight: bold;
          color: #334155;
        }
        td {
          border-bottom: 1px dotted #e2e8f0;
          padding: 6px 4px;
        }
        .totals {
          border-top: 2px dashed #cbd5e1;
          padding-top: 8px;
          margin-top: 8px;
        }
        .total-main {
          font-size: 15px;
          font-weight: 800;
          color: #0284c7;
        }
        .footer {
          text-align: center;
          border-top: 2px dashed #cbd5e1;
          margin-top: 12px;
          padding-top: 8px;
          font-size: 11px;
          color: #64748b;
        }

        @media print {
          @page {
            margin: 4mm;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            display: block !important;
          }
          .receipt-card {
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 4mm 6mm !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
            font-size: 12px !important;
          }
          .salon-name, .total-main {
            color: #000000 !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-card">
        <div class="header">
          <div class="salon-name">LGHAIR SALON</div>
          <div class="salon-info">Địa chỉ: 123 Đường ABC, Phường Buôn Ma Thuột, tỉnh Đắk Lắk</div>
          <div class="salon-info">Hotline: 0123.456.789</div>
          <div class="doc-title">PHIẾU THANH TOÁN HÓA ĐƠN</div>
        </div>

        <div class="info-row"><span>Mã hóa đơn:</span> <strong>#${hd.maHd}</strong></div>
        <div class="info-row"><span>Ngày tạo:</span> <span>${new Date(hd.ngayTao).toLocaleString('vi-VN')}</span></div>
        <div class="info-row"><span>Khách hàng:</span> <strong>${hd.tenKh || 'Khách vãng lai'}</strong></div>
        <div class="info-row"><span>Thu ngân:</span> <span>${hd.tenThuNgan || 'Hệ thống'}</span></div>

        <table>
          <thead>
            <tr>
              <th style="text-align: left;">Sản phẩm / Dịch vụ</th>
              <th style="text-align: center; width: 28px;">SL</th>
              <th style="text-align: center; width: 60px;">Thợ làm việc</th>
              <th style="text-align: right; width: 70px;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="info-row"><span>Tạm tính gốc:</span> <span>${Number(hd.tongTien || 0).toLocaleString()}₫</span></div>
          ${hd.giamGiaVip ? `<div class="info-row"><span>Giảm giá VIP:</span> <span>-${hd.giamGiaVip}%</span></div>` : ''}
          <div class="info-row total-main" style="margin-top: 4px;"><span>TỔNG THANH TOÁN:</span> <span>${Number(hd.thanhTien || 0).toLocaleString()}₫</span></div>
        </div>

        <div class="footer">
          <p style="margin: 0; font-weight: bold;">Cảm ơn Quý khách & Hẹn gặp lại!</p>
          <p style="margin: 2px 0 0 0;">Hotline CSKH: 0123.456.789 - Website: lghair.netlify.app</p>
        </div>
      </div>

      <script>
        window.onload = function() {
          window.focus();
          setTimeout(function() {
            window.print();
            window.close();
          }, 250);
        };
      <\/script>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}

onMounted(fetchHoaDons)
watch([() => filter.value.tuNgay, () => filter.value.denNgay], fetchHoaDons)

// ── FILTERED INVOICES & PAGINATION ──
const filteredInvoices = computed(() => {
  const list = activeTab.value === 'dichVu' ? hoaDonDichVu.value : hoaDonSanPham.value
  return list.filter((h) => {
    if (selectedStatusFilter.value !== '') {
      if (String(h.trangThai) !== selectedStatusFilter.value) return false
    }
    return true
  })
})

const currentPage = ref(1)
const perPage = ref(10)

watch(
  [activeTab, searchQuery, selectedStatusFilter, () => filter.value.tuNgay, () => filter.value.denNgay],
  () => {
    currentPage.value = 1
  }
)

const pagedInvoices = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredInvoices.value.slice(start, start + perPage.value)
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredInvoices.value.length / perPage.value))
})
</script>

<template>
  <v-container fluid class="pa-4 pa-md-6 print:hidden">
    <!-- HIGH PRIORITY SNACKBAR -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="top right"
      :timeout="3500"
      elevation="6"
      style="z-index: 99999;"
    >
      <div class="d-flex align-center font-weight-bold">
        <span>{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="comfortable" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- ═══════ HEADER CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6">
      <div class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between gap-4">
        <div class="d-flex align-center gap-4">
          <v-avatar color="primary" size="56" rounded="lg" elevation="3">
            <FileText class="w-7 h-7 text-white" />
          </v-avatar>
          <div>
            <h1 class="text-h5 font-weight-bold mb-1">Quản Lý Hóa Đơn</h1>
            <p class="text-caption text-medium-emphasis mb-0">
              Quản lý danh mục Hóa đơn dịch vụ Salon và Hóa đơn bán Sản phẩm lẻ
            </p>
          </div>
        </div>

        <v-btn
          color="primary"
          variant="flat"
          size="large"
          rounded="xl"
          elevation="3"
          class="text-none font-weight-bold"
          @click="exportExcel"
        >
          <template v-slot:prepend>
            <FileDown class="w-5 h-5 mr-1" />
          </template>
          Xuất Excel
        </v-btn>
      </div>
    </v-card>

    <!-- ═══════ FILTERS CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6">
      <v-row>
        <!-- Từ ngày -->
        <v-col cols="12" sm="6" md="3">
          <v-text-field
            v-model="filter.tuNgay"
            type="date"
            label="Từ ngày"
            variant="outlined"
            density="compact"
            hide-details="auto"
            @change="fetchHoaDons"
          ></v-text-field>
        </v-col>

        <!-- Đến ngày -->
        <v-col cols="12" sm="6" md="3">
          <v-text-field
            v-model="filter.denNgay"
            type="date"
            label="Đến ngày"
            variant="outlined"
            density="compact"
            hide-details="auto"
            @change="fetchHoaDons"
          ></v-text-field>
        </v-col>

        <!-- Trạng thái -->
        <v-col cols="12" sm="6" md="3">
          <v-select
            v-model="selectedStatusFilter"
            :items="statusFilterOptions"
            item-title="title"
            item-value="value"
            label="Trạng thái đơn hàng"
            variant="outlined"
            density="compact"
            hide-details="auto"
          ></v-select>
        </v-col>

        <!-- Tìm kiếm -->
        <v-col cols="12" sm="6" md="3">
          <v-text-field
            v-model="searchQuery"
            label="Tìm kiếm hóa đơn"
            placeholder="Mã HD hoặc tên khách..."
            variant="outlined"
            density="compact"
            hide-details="auto"
            clearable
            @keyup.enter="fetchHoaDons"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis" />
            </template>
          </v-text-field>
        </v-col>
      </v-row>
    </v-card>

    <!-- ═══════ TABS ═══════ -->
    <v-tabs v-model="activeTab" color="primary" class="mb-4">
      <v-tab value="dichVu" class="text-none font-weight-bold">
        <Scissors class="w-4 h-4 mr-2" />
        Hóa đơn Dịch vụ Salon ({{ hoaDonDichVu.length }})
      </v-tab>
      <v-tab value="sanPham" class="text-none font-weight-bold">
        <ShoppingBag class="w-4 h-4 mr-2" />
        Hóa đơn Mua Sản phẩm ({{ hoaDonSanPham.length }})
      </v-tab>
    </v-tabs>

    <!-- ═══════ DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6">
      <v-table class="rounded-xl border">
        <thead>
          <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200" style="width: 140px;">Mã HD</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200">Khách hàng</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200" style="width: 140px;">Ngày tạo</th>
            <th v-if="activeTab === 'sanPham'" class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 110px;">Số lượng</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200" style="width: 160px;">Thành tiền</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 210px;">Trạng thái đơn hàng</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 90px;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <tr v-if="isLoading">
            <td :colspan="activeTab === 'sanPham' ? 7 : 6" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
              <div class="text-caption text-medium-emphasis">Đang nạp danh sách hóa đơn hệ thống...</div>
            </td>
          </tr>

          <!-- Error -->
          <tr v-else-if="errorMessage">
            <td :colspan="activeTab === 'sanPham' ? 7 : 6" class="text-center py-6">
              <v-alert type="error" variant="tonal" class="rounded-xl font-weight-bold text-caption ma-0">
                {{ errorMessage }}
              </v-alert>
            </td>
          </tr>

          <!-- Data rows -->
          <template v-else-if="pagedInvoices.length > 0">
            <tr v-for="hd in pagedInvoices" :key="hd.maHd" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <td class="py-3 font-mono font-weight-bold text-primary">
                {{ hd.maHd }}
              </td>

              <td class="py-3 font-weight-bold">
                {{ hd.tenKhachHang }}
              </td>

              <td class="py-3 text-caption font-mono text-medium-emphasis">
                {{ new Date(hd.ngayTao).toLocaleDateString('vi-VN') }}
              </td>

              <td v-if="activeTab === 'sanPham'" class="py-3 text-center">
                <v-chip color="primary" size="x-small" variant="tonal" class="font-weight-bold">
                  {{ hd.soLuong || hd.SoLuong || hd.chiTiet?.reduce((sum: number, ct: any) => sum + (ct.soLuong || ct.SoLuong || 0), 0) || 0 }} sp
                </v-chip>
              </td>

              <td class="py-3 font-weight-black font-mono text-body-2">
                {{ hd.thanhTien?.toLocaleString() }}₫
              </td>

              <td class="py-3 text-center">
                <div class="d-flex justify-center">
                  <v-select
                    :model-value="hd.trangThai"
                    :items="getStatusSelectOptions(hd.maHd)"
                    item-title="title"
                    item-value="value"
                    variant="outlined"
                    density="compact"
                    hide-details
                    style="max-width: 190px;"
                    :disabled="hd.trangThai === 3 || hd.trangThai === 0"
                    @update:model-value="(val: any) => changeInvoiceStatus(hd.maHd, Number(val))"
                  ></v-select>
                </div>
              </td>

              <td class="py-3 text-center">
                <v-btn
                  icon
                  variant="text"
                  color="primary"
                  size="small"
                  title="Xem chi tiết hóa đơn"
                  @click="viewDetail(hd.maHd)"
                >
                  <Eye class="w-4 h-4" />
                </v-btn>
              </td>
            </tr>
          </template>

          <!-- Empty State -->
          <tr v-else>
            <td :colspan="activeTab === 'sanPham' ? 7 : 6" class="text-center py-12">
              <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                <FileText class="w-7 h-7 text-medium-emphasis" />
              </v-avatar>
              <div class="text-subtitle-2 font-weight-bold mb-1">Không tìm thấy dữ liệu hóa đơn</div>
              <div class="text-caption text-medium-emphasis">
                Không có hóa đơn nào trùng khớp với từ khóa tìm kiếm hoặc bộ lọc trạng thái.
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex flex-column flex-sm-row align-center justify-space-between gap-4 mt-6 pt-4 border-t">
        <div class="text-caption text-medium-emphasis font-weight-bold">
          Hiển thị trang <span class="text-primary font-weight-black">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ filteredInvoices.length }} đơn)
        </div>
        <v-pagination
          v-model="currentPage"
          :length="totalPages"
          total-visible="5"
          rounded="circle"
          size="small"
          color="primary"
        ></v-pagination>
      </div>
    </v-card>

    <!-- ═══════ MODAL: CHI TIẾT HÓA ĐƠN & IN PHIẾU POS ═══════ -->
    <v-dialog v-model="isModalOpen" max-width="850px" persistent scrollable>
      <v-card v-if="selectedHd" rounded="xl">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between bg-primary text-white border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar color="white" size="42" rounded="lg" elevation="2">
              <FileText class="w-5 h-5 text-primary" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0 text-white">
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
              variant="outlined"
              size="small"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="printInvoice"
            >
              <template v-slot:prepend>
                <Printer class="w-4 h-4 mr-1" />
              </template>
              In Hóa Đơn (Máy in POS)
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
                Địa chỉ: 123 Đường ABC, Phường Buôn Ma Thuột, Tỉnh Đắk Lắk
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
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 print:hidden">
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
                <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenKh || 'Khách vãng lai' }}</span>
              </div>

              <div class="d-flex flex-column gap-1">
                <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">THU NGÂN</span>
                <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span>
              </div>
            </div>

            <!-- POS Print Header Info -->
            <div class="hidden print:flex flex-column gap-1 text-caption border-b border-dashed border-black pb-2 font-mono">
              <div class="d-flex justify-space-between"><span>Mã hóa đơn:</span> <strong>#{{ selectedHd.maHd }}</strong></div>
              <div class="d-flex justify-space-between"><span>Ngày tạo:</span> <span>{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></div>
              <div class="d-flex justify-space-between"><span>Khách hàng:</span> <strong>{{ selectedHd.tenKh || 'Khách vãng lai' }}</strong></div>
              <div class="d-flex justify-space-between"><span>Thu ngân:</span> <span>{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span></div>
            </div>

            <!-- Invoice Items Table -->
            <v-table density="compact" class="border rounded-xl print:border-none">
              <thead>
                <tr class="bg-slate-100 dark:bg-slate-800 border-b print:bg-transparent print:border-t print:border-b print:border-dashed print:border-black">
                  <th class="font-weight-bold text-caption uppercase text-left py-2">Tên Sản phẩm / Dịch vụ</th>
                  <th class="font-weight-bold text-caption uppercase text-center py-2" style="width: 70px;">SL</th>
                  <th class="font-weight-bold text-caption uppercase text-left py-2 print:hidden" style="width: 140px;">Thợ làm việc</th>
                  <th class="font-weight-bold text-caption uppercase text-right py-2" style="width: 140px;">Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(item, index) in (selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? (selectedHd.chiTiet || selectedHd.chiTietDichVu || []) : (selectedHd.chiTietDichVu || []))"
                  :key="index"
                >
                  <td class="py-2 font-weight-bold">
                    {{ item.ten || item.Ten || item.tenHangMuc || item.tenSP || item.tenSp || 'Dịch vụ Salon' }}
                  </td>
                  <td class="py-2 text-center font-mono font-weight-bold">
                    {{ item.soLuong || item.SoLuong || item.soluong || 1 }}
                  </td>
                  <td class="py-2 print:hidden">
                    <v-chip size="x-small" variant="tonal" color="grey-darken-1" class="font-weight-bold">
                      {{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}
                    </v-chip>
                  </td>
                  <td class="py-2 text-right font-mono font-weight-black text-body-2">
                    {{ (item.thanhTien || item.ThanhTien || (item.gia || item.Gia || item.giaBan || 0) * (item.soLuong || item.SoLuong || 1)).toLocaleString() }}₫
                  </td>
                </tr>
              </tbody>
            </v-table>

            <!-- Quick Status Update Row in Modal -->
            <div class="print:hidden border-t border-dashed pt-4 d-flex flex-column flex-sm-row align-center justify-space-between gap-3">
              <span class="text-caption font-weight-bold uppercase text-medium-emphasis">CẬP NHẬT TRẠNG THÁI NHANH:</span>
              <v-select
                :model-value="selectedHd.trangThai"
                :items="getStatusSelectOptions(selectedHd.maHd)"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="compact"
                hide-details
                style="max-width: 220px;"
                :disabled="selectedHd.trangThai === 3 || selectedHd.trangThai === 0"
                @update:model-value="(val: any) => changeInvoiceStatus(selectedHd.maHd, Number(val))"
              ></v-select>
            </div>

            <!-- Revenue Totals -->
            <div class="d-flex flex-column align-end gap-2 pt-4 border-t print:border-dashed print:border-black">
              <div class="d-flex align-center justify-space-between w-100 text-caption text-medium-emphasis">
                <span>Tạm tính gốc:</span>
                <strong class="font-mono text-body-2 text-high-emphasis">{{ selectedHd.tongTien?.toLocaleString() }}₫</strong>
              </div>
              <div v-if="selectedHd.giamGiaVip" class="d-flex align-center justify-space-between w-100 text-caption font-weight-bold text-error">
                <span>Giảm giá VIP:</span>
                <span>-{{ selectedHd.giamGiaVip }}%</span>
              </div>
              <div class="d-flex align-center justify-space-between w-100 text-h6 font-weight-bold pt-2 border-t">
                <span class="font-weight-black">TỔNG THANH TOÁN:</span>
                <span class="font-weight-black text-primary font-mono text-h5">{{ selectedHd.thanhTien?.toLocaleString() }}₫</span>
              </div>
            </div>

            <!-- POS Receipt Thank you Message -->
            <div class="hidden print:flex flex-column align-center justify-center text-center mt-3 pt-3 border-t border-dashed border-black gap-1">
              <p class="text-caption font-weight-bold mb-0">Cảm ơn Quý khách & Hẹn gặp lại!</p>
              <p class="text-caption mb-0">Hotline CSKH: 0123.456.789 - Website: lghair.vn</p>
            </div>
          </div>
        </v-card-text>

        <!-- Dialog Footer -->
        <v-card-actions class="pa-6 pt-4 border-t print:hidden d-flex justify-center">
          <v-btn
            color="primary"
            height="44"
            variant="flat"
            rounded="xl"
            elevation="4"
            class="text-none font-weight-black px-10"
            @click="isModalOpen = false"
          >
            Đóng cửa sổ
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}
</style>

<style>
/* Print Styles for thermal POS receipt printer */
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
  
  #app, .hoadon-container, .v-application, .v-overlay-container, .v-layout {
    display: none !important;
  }

  .print\:hidden {
    display: none !important;
  }

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