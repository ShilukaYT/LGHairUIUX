<script setup lang="ts">
import { ref, watch, computed, reactive, shallowRef } from 'vue'
import axios from 'axios'
import {
  FileText, X, Printer, PackageCheck, QrCode, ChevronDown, CheckCircle2, Ban, HelpCircle, AlertCircle
} from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import { useTheme } from 'vuetify'
import ModalVietQRHoanTien from './ModalVietQRHoanTien.vue'

const props = defineProps<{
  modelValue: boolean
  maHd?: string | null
  initialData?: any
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'status-updated', payload: { maHd: string; newStatus: number }): void
}>()

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/hoa-don`

const theme = useTheme()
const isDark = computed(() => {
  try {
    return theme.global.current.value.dark || document.documentElement.classList.contains('dark')
  } catch {
    return document.documentElement.classList.contains('dark')
  }
})

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const isLoading = ref(false)
const selectedHd = ref<any>(null)

// ── NOTIFICATION SNACKBAR ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success'
})

const showSnackbar = (text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

// ── VUETIFY 3 CONFIRMATION DIALOG ──
const confirmDialog = reactive({
  show: false,
  title: '',
  subtitle: '',
  description: '',
  icon: shallowRef<any>(HelpCircle),
  iconColor: 'primary',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy bỏ',
  confirmColor: 'primary',
  requireInput: false,
  inputLabel: '',
  inputPlaceholder: '',
  inputValue: '',
  inputError: '',
  loading: false,
  onConfirm: null as null | (() => Promise<void> | void)
})

// ── STATE MODAL VIETQR HOÀN TIỀN ──
const isVietQRModalOpen = ref(false)
const vietQRSelectedMaHd = ref('')
const vietQRSelectedAmount = ref(0)

const openVietQRRefundModal = (maHd: string, amount: number = 0) => {
  vietQRSelectedMaHd.value = maHd
  vietQRSelectedAmount.value = amount
  isVietQRModalOpen.value = true
}

const handleVietQRUpdated = () => {
  if (selectedHd.value) {
    selectedHd.value.trangThai = 6
  }
  if (props.maHd) {
    emit('status-updated', { maHd: props.maHd, newStatus: 6 })
  }
}

const getAuthHeaders = () => {
  const token =
    sessionStorage.getItem('adminToken') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') ||
    sessionStorage.getItem('accessToken') ||
    sessionStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('access_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const fetchDetail = async (maHd: string) => {
  if (!maHd) return
  isLoading.value = true

  // Gán tạm dữ liệu initial có sẵn nếu có để giao diện xuất hiện tức thì
  if (props.initialData && (props.initialData.maHd === maHd || props.initialData.MaHd === maHd)) {
    selectedHd.value = { ...props.initialData }
  }

  try {
    const res = await axios.get(`${API_BASE_URL}/chi-tiet/${maHd}`, {
      headers: getAuthHeaders()
    })
    if (res.data && res.data.success && res.data.data) {
      const detail = res.data.data

      // Nếu initialData có mảng chi tiết phong phú hơn, bổ sung thêm
      if (props.initialData) {
        if (!detail.chiTiet && props.initialData.chiTiet) {
          detail.chiTiet = props.initialData.chiTiet
        }
        if (!detail.tenKh && props.initialData.khachHang) {
          detail.tenKh = props.initialData.khachHang
        }
      }

      selectedHd.value = detail
    }
  } catch (err: any) {
    console.warn('Lỗi khi tải chi tiết hóa đơn từ API:', err)
    if (!selectedHd.value && props.initialData) {
      selectedHd.value = { ...props.initialData }
    }
  } finally {
    isLoading.value = false
  }
}

watch(
  [() => props.modelValue, () => props.maHd],
  ([newOpen, newMaHd]) => {
    if (newOpen && newMaHd) {
      fetchDetail(newMaHd)
    } else if (!newOpen) {
      selectedHd.value = null
    }
  },
  { immediate: true }
)

// ── BADGE CONFIGS & STATUS HELPERS ──
const getStatusBadgeConfig = (status: number, maHd: string = '') => {
  const dark = isDark.value
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')

  switch (status) {
    case 0:
      return {
        label: 'Đã Hủy',
        color: 'error',
        bgColor: dark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
        textColor: dark ? '#fca5a5' : '#b91c1c',
        borderColor: dark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
        dotColor: '#ef4444'
      }
    case 1:
      return {
        label: laDonSp ? 'Chờ xử lý' : 'Đã cọc 10%',
        color: 'warning',
        bgColor: dark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
        textColor: dark ? '#fde68a' : '#b45309',
        borderColor: dark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
        dotColor: '#f59e0b'
      }
    case 2:
      return {
        label: laDonSp ? 'Đang giao hàng' : 'Đã thanh toán',
        color: 'info',
        bgColor: dark ? 'rgba(14, 165, 233, 0.18)' : '#e0f2fe',
        textColor: dark ? '#7dd3fc' : '#0369a1',
        borderColor: dark ? 'rgba(14, 165, 233, 0.35)' : '#bae6fd',
        dotColor: '#0ea5e9'
      }
    case 3:
      return {
        label: laDonSp ? 'Đã giao hàng' : 'Hoàn thành',
        color: 'success',
        bgColor: dark ? 'rgba(34, 197, 94, 0.18)' : '#dcfce7',
        textColor: dark ? '#86efac' : '#15803d',
        borderColor: dark ? 'rgba(34, 197, 94, 0.35)' : '#bbf7d0',
        dotColor: '#22c55e'
      }
    case 4:
      return {
        label: 'Đang hoàn hàng',
        color: 'orange',
        bgColor: dark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5',
        textColor: dark ? '#fed7aa' : '#c2410c',
        borderColor: dark ? 'rgba(249, 115, 22, 0.35)' : '#fed7aa',
        dotColor: '#f97316'
      }
    case 5:
      return {
        label: 'Đã nhận hàng',
        color: 'purple',
        bgColor: dark ? 'rgba(168, 85, 247, 0.18)' : '#f3e8ff',
        textColor: dark ? '#d8b4fe' : '#7e22ce',
        borderColor: dark ? 'rgba(168, 85, 247, 0.35)' : '#e9d5ff',
        dotColor: '#a855f7'
      }
    case 6:
      return {
        label: 'Đã hoàn tiền',
        color: 'emerald',
        bgColor: dark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5',
        textColor: dark ? '#6ee7b7' : '#047857',
        borderColor: dark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
        dotColor: '#10b981'
      }
    default:
      return {
        label: 'N/A',
        color: 'grey',
        bgColor: dark ? 'rgba(148, 163, 184, 0.18)' : '#f1f5f9',
        textColor: dark ? '#cbd5e1' : '#475569',
        borderColor: dark ? 'rgba(148, 163, 184, 0.35)' : '#cbd5e1',
        dotColor: '#94a3b8'
      }
  }
}

const getStatusText = (status: number, maHd: string = '') => {
  return getStatusBadgeConfig(status, maHd).label
}

const getStatusSelectOptions = (maHd: string = '') => {
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')
  if (laDonSp) {
    return [
      { title: 'Chờ xử lý', value: 1 },
      { title: 'Đang giao hàng', value: 2 },
      { title: 'Đã giao hàng (Hoàn thành)', value: 3 },
      { title: 'Đang hoàn hàng (Chờ về kho)', value: 4 },
      { title: 'Đã nhận hàng (Chờ hoàn tiền)', value: 5 },
      { title: 'Đã hoàn tiền (Hoàn tất 100%)', value: 6 },
      { title: 'Đã Hủy', value: 0 }
    ]
  }
  return [
    { title: 'Đã cọc 10%', value: 1 },
    { title: 'Đã thanh toán', value: 2 },
    { title: 'Hoàn thành', value: 3 },
    { title: 'Đã Hủy', value: 0 }
  ]
}

const canEditStatus = (hd: any) => {
  if (!hd) return false
  const ma = String(hd.maHd || '').toUpperCase()
  const laDonSp = ma.startsWith('SP') || ma.startsWith('HDSP')

  if (!laDonSp) {
    // Hóa đơn dịch vụ: không được chỉnh trạng thái
    return false
  }

  // Hóa đơn sản phẩm: chỉ cho phép chỉnh trạng thái khi đơn ở "Chờ xử lý" (1) hoặc "Đang giao hàng" (2)
  // Các trạng thái: Đã nhận hàng (3), Đang/Đã hoàn hàng (4, 5), Đã hoàn tiền (6), Đã hủy (0) KHÔNG ĐƯỢC CHỈNH TRẠNG THÁI
  return hd.trangThai === 1 || hd.trangThai === 2
}

const getInvoiceItems = (hd: any) => {
  if (!hd) return []
  const laDonSp = String(hd.maHd || '').toUpperCase().startsWith('SP') || String(hd.maHd || '').toUpperCase().startsWith('HDSP')
  if (laDonSp) {
    return hd.chiTiet || hd.ChiTiet || hd.chiTietDichVu || hd.ChiTietDichVu || []
  }
  return hd.chiTietDichVu || hd.ChiTietDichVu || hd.chiTiet || hd.ChiTiet || []
}

// ── ĐỔI TRẠNG THÁI HÓA ĐƠN TRONG MODAL ──
const executeStatusChange = async (maHd: string, newStatus: number, ghiChuLyDo: string = '') => {
  try {
    confirmDialog.loading = true
    const payload = {
      trangThai: newStatus,
      ghiChu: ghiChuLyDo
    }

    const res = await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, payload, {
      headers: getAuthHeaders()
    })

    if (res.data && res.data.success) {
      logActivity(
        'Đổi trạng thái hóa đơn',
        `Đã chuyển trạng thái hóa đơn #${maHd} sang "${getStatusText(newStatus, maHd)}"`,
        'Hóa đơn'
      )
      selectedHd.value.trangThai = newStatus
      emit('status-updated', { maHd, newStatus })
      confirmDialog.show = false
      showSnackbar(`Đã cập nhật trạng thái hóa đơn #${maHd} sang "${getStatusText(newStatus, maHd)}"`, 'success')
    }
  } catch (e: any) {
    logActivity(
      'Đổi trạng thái hóa đơn',
      `Thất bại khi chuyển trạng thái hóa đơn #${maHd} - Lỗi: ${e.message || ''}`,
      'Hóa đơn',
      'Thất bại'
    )
    showSnackbar(e.response?.data?.message || 'Lỗi khi cập nhật trạng thái đơn hàng.', 'error')
  } finally {
    confirmDialog.loading = false
  }
}

const changeInvoiceStatus = async (maHd: string, newStatus: number) => {
  if (!selectedHd.value) return
  const currentStatus = selectedHd.value.trangThai ?? 1

  if (currentStatus !== 1 && currentStatus !== 2) {
    if (newStatus !== currentStatus) {
      showSnackbar('Trạng thái đã nhận hàng, đã hoàn hàng và đã hoàn tiền không được phép chỉnh sửa trạng thái.', 'warning')
      return
    }
  }

  if (newStatus === 4) {
    confirmDialog.title = 'Xác nhận Đang hoàn hàng?'
    confirmDialog.subtitle = `Đơn hàng #${maHd}`
    confirmDialog.description = 'Vui lòng nhập lý do hoàn hàng (Khách bom hàng, không nghe máy, từ chối nhận...):'
    confirmDialog.icon = shallowRef(AlertCircle)
    confirmDialog.iconColor = 'amber-darken-2'
    confirmDialog.confirmText = 'Xác nhận Đang hoàn'
    confirmDialog.cancelText = 'Đóng'
    confirmDialog.confirmColor = 'amber-darken-3'
    confirmDialog.requireInput = true
    confirmDialog.inputLabel = 'Lý do hoàn hàng (bắt buộc)'
    confirmDialog.inputPlaceholder = 'Nhập lý do quay đầu hàng...'
    confirmDialog.inputValue = ''
    confirmDialog.inputError = ''
    confirmDialog.onConfirm = () => {
      if (!confirmDialog.inputValue.trim()) {
        confirmDialog.inputError = 'Vui lòng nhập lý do hoàn hàng!'
        return
      }
      executeStatusChange(maHd, newStatus, confirmDialog.inputValue.trim())
    }
    confirmDialog.show = true
  } else if (newStatus === 5) {
    confirmDialog.title = 'Xác nhận Đã nhận hàng hoàn?'
    confirmDialog.subtitle = `Đơn hàng #${maHd}`
    confirmDialog.description = 'Bạn xác nhận Salon đã nhận lại kiện hàng từ Shipper và tiến hành tự động nhập lại số lượng vào kho?'
    confirmDialog.icon = shallowRef(PackageCheck)
    confirmDialog.iconColor = 'purple-darken-1'
    confirmDialog.confirmText = 'Đã nhận hàng & Nhập kho'
    confirmDialog.cancelText = 'Đóng'
    confirmDialog.confirmColor = 'purple-darken-1'
    confirmDialog.requireInput = false
    confirmDialog.onConfirm = () => {
      executeStatusChange(maHd, newStatus, 'Đã nhận lại kiện hàng hoàn và nhập kho')
    }
    confirmDialog.show = true
  } else if (newStatus === 0) {
    confirmDialog.title = 'Xác nhận Hủy hóa đơn?'
    confirmDialog.subtitle = `Đơn hàng #${maHd}`
    confirmDialog.description = 'Vui lòng nhập lý do hủy đơn hàng này:'
    confirmDialog.icon = shallowRef(Ban)
    confirmDialog.iconColor = 'error'
    confirmDialog.confirmText = 'Xác nhận Hủy đơn'
    confirmDialog.cancelText = 'Đóng'
    confirmDialog.confirmColor = 'error'
    confirmDialog.requireInput = true
    confirmDialog.inputLabel = 'Lý do hủy đơn (bắt buộc)'
    confirmDialog.inputPlaceholder = 'Nhập lý do hủy...'
    confirmDialog.inputValue = ''
    confirmDialog.inputError = ''
    confirmDialog.onConfirm = () => {
      if (!confirmDialog.inputValue.trim()) {
        confirmDialog.inputError = 'Vui lòng nhập lý do hủy đơn!'
        return
      }
      executeStatusChange(maHd, newStatus, confirmDialog.inputValue.trim())
    }
    confirmDialog.show = true
  } else {
    executeStatusChange(maHd, newStatus)
  }
}

// ── IN HÓA ĐƠN POS CHUYÊN NGHIỆP ──
const printInvoice = () => {
  if (!selectedHd.value) return

  const hd = selectedHd.value
  logActivity(
    'In hóa đơn',
    `Đã in chi tiết hóa đơn #${hd.maHd} cho khách hàng "${hd.tenKh || hd.khachHang || 'Khách vãng lai'}"`,
    'Hóa đơn'
  )

  const isSp = String(hd.maHd || '').toUpperCase().startsWith('SP') || String(hd.maHd || '').toUpperCase().startsWith('HDSP')
  const items = getInvoiceItems(hd)

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
    showSnackbar('Trình duyệt đang chặn cửa sổ Popup. Vui lòng cho phép Popup để in hóa đơn.', 'warning')
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
        .pos-card {
          width: 380px;
          background: #ffffff;
          padding: 24px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        }
        .text-center { text-align: center; }
        .salon-title {
          font-size: 20px;
          font-weight: 900;
          text-transform: uppercase;
          margin: 0 0 4px 0;
          color: #0f172a;
        }
        .salon-sub {
          font-size: 11px;
          color: #475569;
          margin: 0 auto 2px auto;
          line-height: 1.35;
          text-wrap: balance;
          max-width: 320px;
        }
        .divider-dashed {
          border-bottom: 1px dashed #94a3b8;
          margin: 12px 0;
        }
        .pos-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }
        .info-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          font-family: monospace;
          margin-bottom: 4px;
        }
        .items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin: 10px 0;
        }
        .items-table th {
          border-top: 1px dashed #000;
          border-bottom: 1px dashed #000;
          padding: 6px 2px;
          text-transform: uppercase;
        }
        .total-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #94a3b8;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
        }
        .total-main {
          font-size: 15px;
          font-weight: 900;
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px solid #000;
        }
        .footer-thank {
          font-size: 11px;
          text-align: center;
          margin-top: 16px;
          padding-top: 10px;
          border-top: 1px dashed #94a3b8;
          color: #475569;
        }
        @media print {
          body {
            background: transparent;
            padding: 0;
            display: block;
          }
          .pos-card {
            width: 100%;
            max-width: 80mm;
            padding: 0;
            border-radius: 0;
            box-shadow: none;
            margin: 0 auto;
          }
        }
      </style>
    </head>
    <body>
      <div class="pos-card">
        <div class="text-center">
          <div class="salon-title">LGHAIR SALON</div>
          <div class="salon-sub">Địa chỉ: 123 Nguyễn Tất Thành, Phường Buôn Ma Thuột, Đắk Lắk</div>
          <div class="salon-sub" style="font-weight: bold; color: #0f172a; margin-top: 2px;">Hotline: 0123.456.789</div>
        </div>

        <div class="divider-dashed"></div>
        <div class="text-center pos-title">PHIẾU THANH TOÁN HÓA ĐƠN</div>

        <div class="info-row"><span>Mã hóa đơn:</span> <strong>#${hd.maHd}</strong></div>
        <div class="info-row"><span>Ngày tạo:</span> <span>${new Date(hd.ngayTao || new Date()).toLocaleString('vi-VN')}</span></div>
        <div class="info-row"><span>Khách hàng:</span> <strong>${hd.tenKh || hd.khachHang || 'Khách vãng lai'}</strong></div>
        <div class="info-row"><span>Người thực hiện:</span> <span>${hd.tenThuNgan || 'Hệ thống'}</span></div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="text-align: left;">Mục</th>
              <th style="text-align: center; width: 35px;">SL</th>
              <th style="text-align: center; width: 65px;">Thực hiện</th>
              <th style="text-align: right; width: 75px;">T.Tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row"><span>Tạm tính:</span> <strong>${Number(hd.tongTien || 0).toLocaleString()}₫</strong></div>
          ${hd.giamGiaVip ? `<div class="total-row" style="color: #dc2626;"><span>Giảm giá VIP:</span> <span>-${hd.giamGiaVip}%</span></div>` : ''}
          <div class="total-row total-main"><span>TỔNG CỘNG:</span> <span>${Number(hd.thanhTien || hd.tongTien || 0).toLocaleString()}₫</span></div>
        </div>

        <div class="footer-thank">
          <div style="font-weight: bold;">Cảm ơn Quý khách & Hẹn gặp lại!</div>
          <div style="font-size: 10px; margin-top: 2px;">Hotline CSKH: 0123.456.789 - Website: lghair.vn</div>
        </div>
      </div>
      <script>
        window.onload = function() {
          window.focus();
          window.onafterprint = function() {
            setTimeout(function() {
              window.close();
            }, 50);
          };
          window.addEventListener('afterprint', function() {
            setTimeout(function() {
              window.close();
            }, 50);
          });
          setTimeout(function() {
            window.print();
          }, 150);
        };
      <\/script>
    </body>
    </html>
  `

  printWindow.document.open()
  printWindow.document.write(htmlContent)
  printWindow.document.close()
}
</script>

<template>
  <v-dialog v-model="isOpen" max-width="850px" persistent scrollable>
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

          <v-btn icon variant="text" density="comfortable" color="white" @click="isOpen = false">
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
            <p class="text-caption text-medium-emphasis mb-0 print:text-black" style="text-wrap: balance; max-width: 420px; margin: 0 auto;">
              Địa chỉ: 123 Nguyễn Tất Thành, Phường Buôn Ma Thuột, Đắk Lắk
            </p>
            <p class="text-caption font-weight-bold text-primary print:text-black mb-0 mt-1">
              Hotline: 0123.456.789
            </p>
          </div>

          <!-- Header Máy in POS khi In thực tế -->
          <div class="hidden print:block text-center font-weight-bold text-caption text-uppercase border-b border-dashed border-black pb-2">
            PHIẾU THANH TOÁN HÓA ĐƠN
          </div>

          <!-- Cảnh báo trạng thái Hoàn hàng / Đã Hủy -->
          <v-alert
            v-if="selectedHd.trangThai === 4"
            type="warning"
            variant="tonal"
            rounded="xl"
            class="print:hidden my-2"
          >
            <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between gap-3">
              <div>
                <div class="font-weight-black text-subtitle-2 text-amber-900">📦 ĐƠN HÀNG ĐANG HOÀN VỀ (ĐANG QUAY ĐẦU)</div>
                <div class="text-caption text-amber-800">
                  Kiện hàng đang được Shipper vận chuyển quay về Salon. Sau khi đã nhận và kiểm tra hàng, hãy bấm xác nhận để tự động nhập kho lại.
                </div>
              </div>
              <div class="d-flex align-center gap-2 flex-wrap flex-shrink-0">
                <v-btn
                  color="amber-darken-3"
                  variant="flat"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  @click="openVietQRRefundModal(selectedHd.maHd, selectedHd.thanhTien)"
                >
                  <QrCode class="w-4 h-4 mr-1.5" />
                  Quét VietQR Hoàn Tiền
                </v-btn>
                <v-btn
                  color="purple"
                  variant="flat"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  @click="changeInvoiceStatus(selectedHd.maHd, 5)"
                >
                  <PackageCheck class="w-4 h-4 mr-1.5" />
                  Đã nhận hàng &amp; Nhập kho
                </v-btn>
              </div>
            </div>
          </v-alert>

          <v-alert
            v-else-if="selectedHd.trangThai === 5"
            color="purple"
            variant="tonal"
            rounded="xl"
            class="print:hidden my-2"
          >
            <div class="d-flex align-center justify-space-between flex-wrap gap-2">
              <div class="d-flex align-center gap-2">
                <PackageCheck class="w-5 h-5 text-purple" />
                <div>
                  <div class="font-weight-black text-subtitle-2 text-purple-900">🟣 ĐÃ NHẬN HÀNG HOÀN &amp; NHẬP KHO</div>
                  <div class="text-caption text-purple-800">Kiện hàng đã được kiểm tra và cộng trả lại số lượng vào kho thành công.</div>
                </div>
              </div>
              <v-btn
                color="purple-darken-1"
                variant="outlined"
                rounded="lg"
                class="text-none font-weight-bold"
                @click="openVietQRRefundModal(selectedHd.maHd, selectedHd.thanhTien)"
              >
                <QrCode class="w-4 h-4 mr-1.5" />
                Xem VietQR Hoàn Tiền
              </v-btn>
            </div>
          </v-alert>

          <v-alert
            v-else-if="selectedHd.trangThai === 0"
            type="error"
            variant="tonal"
            rounded="xl"
            class="print:hidden my-2"
          >
            <div class="font-weight-black text-subtitle-2">🔴 ĐƠN HÀNG ĐÃ HỦY</div>
          </v-alert>

          <!-- Info Cards Grid (Desktop View) -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl border print:hidden" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">MÃ HÓA ĐƠN</span>
              <span class="text-body-2 font-weight-black font-mono text-primary">#{{ selectedHd.maHd }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">NGÀY TẠO</span>
              <span class="text-body-2 font-weight-bold font-mono">{{ selectedHd.ngayTao ? new Date(selectedHd.ngayTao).toLocaleString('vi-VN') : '—' }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">KHÁCH HÀNG</span>
              <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenKh || selectedHd.khachHang || selectedHd.tenKhachHang || 'Khách vãng lai' }}</span>
            </div>

            <div class="d-flex flex-column gap-1">
              <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis">THU NGÂN</span>
              <span class="text-body-2 font-weight-bold text-truncate">{{ selectedHd.tenThuNgan || selectedHd.thuNgan || 'Hệ thống' }}</span>
            </div>
          </div>

          <!-- POS Print Header Info -->
          <div class="hidden print:flex flex-column gap-1 text-caption border-b border-dashed border-black pb-2 font-mono">
            <div class="d-flex justify-space-between"><span>Mã hóa đơn:</span> <strong>#{{ selectedHd.maHd }}</strong></div>
            <div class="d-flex justify-space-between"><span>Ngày tạo:</span> <span>{{ selectedHd.ngayTao ? new Date(selectedHd.ngayTao).toLocaleString('vi-VN') : '—' }}</span></div>
            <div class="d-flex justify-space-between"><span>Khách hàng:</span> <strong>{{ selectedHd.tenKh || selectedHd.khachHang || selectedHd.tenKhachHang || 'Khách vãng lai' }}</strong></div>
            <div class="d-flex justify-space-between"><span>Người thực hiện:</span> <span>{{ selectedHd.tenThuNgan || selectedHd.thuNgan || 'Hệ thống' }}</span></div>
          </div>

          <!-- Invoice Items Table -->
          <v-table density="compact" class="border rounded-xl print:border-none" hover>
            <thead>
              <tr class="border-b print:bg-transparent print:border-t print:border-b print:border-dashed print:border-black" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="font-weight-bold text-caption uppercase text-left py-2.5">Tên Sản phẩm / Dịch vụ</th>
                <th class="font-weight-bold text-caption uppercase text-center py-2.5" style="width: 70px;">SL</th>
                <th class="font-weight-bold text-caption uppercase text-left py-2.5 print:hidden" style="width: 140px;">
                  {{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Loại' : 'Người thực hiện' }}
                </th>
                <th class="font-weight-bold text-caption uppercase text-right py-2.5" style="width: 140px;">Thành tiền</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, index) in getInvoiceItems(selectedHd)"
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
                <td class="py-2 text-right font-mono font-weight-black text-body-2 text-primary">
                  {{ (item.thanhTien || item.ThanhTien || ((item.gia || item.Gia || item.giaBan || 0) * (item.soLuong || item.SoLuong || 1))).toLocaleString() }}₫
                </td>
              </tr>
              <tr v-if="getInvoiceItems(selectedHd).length === 0">
                <td colspan="4" class="text-center py-6 text-medium-emphasis">
                  Không có mục chi tiết nào
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Quick Status Update Row in Modal -->
          <div class="print:hidden border-t border-dashed pt-4 d-flex flex-column flex-sm-row align-center justify-space-between gap-3">
            <span class="text-caption font-weight-bold uppercase text-medium-emphasis">TRẠNG THÁI HIỆN TẠI:</span>
            
            <div class="d-flex align-center gap-2">
              <!-- Đơn không được phép đổi trạng thái (Hóa đơn Dịch vụ hoặc Sản phẩm đã chốt) -->
              <div
                v-if="!canEditStatus(selectedHd)"
                class="status-chip d-inline-flex align-center px-4 py-2 rounded-pill font-weight-bold text-body-2"
                :style="{
                  backgroundColor: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).bgColor,
                  color: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).textColor,
                  border: '1px solid ' + getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).borderColor
                }"
              >
                <span class="status-dot mr-2" :style="{ backgroundColor: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).dotColor }"></span>
                {{ getStatusText(selectedHd.trangThai, selectedHd.maHd) }}
              </div>

              <!-- Đơn sản phẩm được phép đổi trạng thái -->
              <v-menu v-else location="bottom end" transition="scale-transition">
                <template v-slot:activator="{ props: menuProps }">
                  <button
                    v-bind="menuProps"
                    type="button"
                    class="status-btn d-inline-flex align-center px-4 py-2 rounded-pill font-weight-bold text-body-2 cursor-pointer"
                    :style="{
                      backgroundColor: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).bgColor,
                      color: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).textColor,
                      border: '1px solid ' + getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).borderColor
                    }"
                  >
                    <span class="status-dot mr-2" :style="{ backgroundColor: getStatusBadgeConfig(selectedHd.trangThai, selectedHd.maHd).dotColor }"></span>
                    <span>{{ getStatusText(selectedHd.trangThai, selectedHd.maHd) }}</span>
                    <ChevronDown class="w-4 h-4 ml-1.5 opacity-80" />
                  </button>
                </template>

                <v-list density="compact" rounded="xl" class="py-1.5 border elevation-4" min-width="220">
                  <div class="px-3 py-1 text-caption text-medium-emphasis font-weight-bold border-b mb-1">
                    CHỌN TRẠNG THÁI MỚI
                  </div>
                  <v-list-item
                    v-for="opt in getStatusSelectOptions(selectedHd.maHd)"
                    :key="opt.value"
                    :value="opt.value"
                    :active="opt.value === selectedHd.trangThai"
                    @click="changeInvoiceStatus(selectedHd.maHd, Number(opt.value))"
                    rounded="lg"
                    class="mx-1 my-0.5"
                  >
                    <template v-slot:prepend>
                      <span class="status-dot mr-2" :style="{ backgroundColor: getStatusBadgeConfig(opt.value, selectedHd.maHd).dotColor }"></span>
                    </template>
                    <v-list-item-title class="text-caption font-weight-bold">
                      {{ opt.title }}
                    </v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </div>
          </div>

          <!-- Revenue Totals -->
          <div class="d-flex flex-column align-end gap-2 pt-4 border-t print:border-dashed print:border-black">
            <div class="d-flex align-center justify-space-between w-100 text-caption text-medium-emphasis">
              <span>Tạm tính gốc:</span>
              <strong class="font-mono text-body-2 text-high-emphasis">{{ Number(selectedHd.tongTien || 0).toLocaleString() }}₫</strong>
            </div>
            <div v-if="selectedHd.giamGiaVip" class="d-flex align-center justify-space-between w-100 text-caption font-weight-bold text-error">
              <span>Giảm giá VIP:</span>
              <span>-{{ selectedHd.giamGiaVip }}%</span>
            </div>
            <div class="d-flex align-center justify-space-between w-100 text-h6 font-weight-bold pt-2 border-t">
              <span class="font-weight-black">TỔNG THANH TOÁN:</span>
              <span class="font-weight-black text-primary font-mono text-h5">{{ Number(selectedHd.thanhTien || selectedHd.tongTien || 0).toLocaleString() }}₫</span>
            </div>
          </div>

          <!-- POS Receipt Thank you Message -->
          <div class="hidden print:flex flex-column align-center justify-center text-center mt-3 pt-3 border-t border-dashed border-black gap-1">
            <p class="text-caption font-weight-bold mb-0">Cảm ơn Quý khách &amp; Hẹn gặp lại!</p>
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
          @click="isOpen = false"
        >
          Đóng cửa sổ
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <!-- ═══════ MODAL VIETQR HOÀN TIỀN RIÊNG BIỆT ═══════ -->
  <ModalVietQRHoanTien
    :is-open="isVietQRModalOpen"
    :ma-hd="vietQRSelectedMaHd"
    :tong-tien="vietQRSelectedAmount"
    @close="isVietQRModalOpen = false"
    @updated="handleVietQRUpdated"
  />

  <!-- ═══════ HỘP THOẠI XÁC NHẬN VUETIFY 3 CHUẨN ĐẸP ═══════ -->
  <v-dialog v-model="confirmDialog.show" max-width="480px" style="z-index: 10000005;">
    <v-card rounded="2xl" class="pa-6 text-center elevation-12 bg-surface">
      <div class="d-flex justify-center mb-4">
        <v-avatar size="64" :color="confirmDialog.iconColor" variant="tonal" class="rounded-circle">
          <component :is="confirmDialog.icon" class="w-8 h-8" />
        </v-avatar>
      </div>

      <h3 class="text-h6 font-weight-black mb-2 text-slate-800 dark:text-white">
        {{ confirmDialog.title }}
      </h3>

      <div v-if="confirmDialog.subtitle" class="mb-3">
        <span class="text-caption font-weight-bold text-primary font-mono bg-primary/10 py-1 px-3 rounded-lg d-inline-block">
          {{ confirmDialog.subtitle }}
        </span>
      </div>

      <p class="text-body-2 text-medium-emphasis mb-4 px-2 leading-relaxed">
        {{ confirmDialog.description }}
      </p>

      <!-- Input lý do nếu cần -->
      <div v-if="confirmDialog.requireInput" class="mb-4 text-left">
        <v-textarea
          v-model="confirmDialog.inputValue"
          :label="confirmDialog.inputLabel"
          :placeholder="confirmDialog.inputPlaceholder"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          rows="3"
          :error-messages="confirmDialog.inputError"
          @update:model-value="confirmDialog.inputError = ''"
          hide-details="auto"
          auto-grow
        ></v-textarea>
      </div>

      <div class="d-flex gap-3 justify-center pt-2">
        <v-btn
          variant="outlined"
          color="grey-darken-1"
          rounded="xl"
          height="42"
          class="text-none font-weight-bold px-6 flex-1"
          :disabled="confirmDialog.loading"
          @click="confirmDialog.show = false"
        >
          {{ confirmDialog.cancelText }}
        </v-btn>

        <v-btn
          :color="confirmDialog.confirmColor"
          variant="flat"
          rounded="xl"
          height="42"
          class="text-none font-weight-bold px-6 flex-1 text-white"
          :loading="confirmDialog.loading"
          @click="confirmDialog.onConfirm && confirmDialog.onConfirm()"
        >
          {{ confirmDialog.confirmText }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>

  <!-- ═══════ SNACKBAR THÔNG BÁO VUETIFY 3 ═══════ -->
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    location="top right"
    :timeout="3000"
    elevation="6"
    style="z-index: 10000010;"
  >
    <div class="d-flex align-center font-weight-bold text-caption">
      <span>{{ snackbar.text }}</span>
    </div>
    <template v-slot:actions>
      <v-btn variant="text" icon density="comfortable" @click="snackbar.show = false">
        <X class="w-4 h-4" />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity, 0.12)) !important;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-btn {
  border: 1px solid transparent;
  transition: all 0.2s ease;
  outline: none;
}

.status-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}
</style>
