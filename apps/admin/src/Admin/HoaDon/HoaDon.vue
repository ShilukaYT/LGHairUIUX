<script setup lang="ts">
import { ref, onMounted, watch, computed, reactive, onUnmounted } from 'vue'
import axios from 'axios'
import {
  Search, FileDown, Eye, X, Printer, ShoppingBag, Scissors,
  FileText, RotateCcw, Filter, CheckCircle, AlertCircle, Clock, XCircle,
  PackageCheck, PackageX, AlertTriangle, ChevronDown, QrCode, MapPin, User, Truck
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { logActivity } from '@/utils/activityLogger'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'
import ModalVietQRHoanTien from './ModalVietQRHoanTien.vue'
import ModalChiTietHoaDon from './ModalChiTietHoaDon.vue'

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
  d.setDate(d.getDate() - 60) // Lấy mặc định 60 ngày gần nhất để không bị ẩn hóa đơn khi sang tháng mới
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const statusFilterOptions = computed(() => {
  if (activeTab.value === 'dichVu') {
    return [
      { title: 'Tất cả trạng thái', value: '' },
      { title: 'Đã cọc 10%', value: '1' },
      { title: 'Đã thanh toán', value: '2' },
      { title: 'Hoàn thành', value: '3' },
      { title: 'Tạm hủy (Trễ hẹn)', value: '4' },
      { title: 'Chờ hoàn tiền', value: '5' },
      { title: 'Đã hoàn tiền', value: '6' },
      { title: 'Đã dời lịch', value: '9' },
      { title: 'Đã Hủy', value: '0' },
      { title: 'Đơn Hủy & Hoàn tiền (0, 4, 5, 6)', value: 'CANCEL_GROUP' }
    ]
  }
  return [
    { title: 'Tất cả trạng thái', value: '' },
    { title: 'Chờ xử lý', value: '1' },
    { title: 'Đang giao hàng', value: '2' },
    { title: 'Đã giao hàng (Hoàn thành)', value: '3' },
    { title: 'Đang hoàn hàng (Chờ về kho)', value: '4' },
    { title: 'Đã nhận hàng (Chờ hoàn tiền)', value: '5' },
    { title: 'Đã hoàn tiền (Hoàn tất 100%)', value: '6' },
    { title: 'Đã Hủy', value: '0' },
    { title: 'Tất cả đơn Hủy & Hoàn hàng (0, 4, 5, 6)', value: 'CANCEL_GROUP' }
  ]
})

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
      const allData = [
        ...(res.data.hoaDonSanPham || []),
        ...(res.data.hoaDonDichVu || [])
      ]

      allData.forEach((h: any) => {
        const ma = String(h.maHd || '').toUpperCase()
        const localStatus = localStorage.getItem(`hoan_hang_status_${ma}`)
        if (localStatus) {
          h.trangThai = Number(localStatus)
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

      // Tải chi tiết sản phẩm chạy ngầm ở nền sau, hiển thị bảng ngay lập tức không bị giật/chậm
      axios.get(`${API}/api/ThongKe/admin-dashboard`, {
        params: {
          startDate: filter.value.tuNgay,
          endDate: filter.value.denNgay,
          searchMaHd: searchQuery.value
        },
        headers: getAuthHeaders()
      }).then((dbRes) => {
        if (dbRes.data && dbRes.data.hoaDonSanPham) {
          const dashboardSpMap = new Map()
          dbRes.data.hoaDonSanPham.forEach((hd: any) => {
            const ma = String(hd.maHd || hd.MaHd || '').toUpperCase()
            dashboardSpMap.set(ma, hd.chiTiet || hd.ChiTiet)
          })
          hoaDonSanPham.value.forEach((h: any) => {
            const ma = String(h.maHd || '').toUpperCase()
            if (dashboardSpMap.has(ma)) {
              h.chiTiet = dashboardSpMap.get(ma)
            }
          })
        }
      }).catch(() => {})
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

const handleRefresh = async () => {
  await fetchHoaDons()
  showNotification('Đã làm mới danh sách hóa đơn!', 'success')
}

// ── STATUS DISPLAY & CHIP COLORS ──
const getStatusText = (status: number, maHd: string = '') => {
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')
  if (laDonSp) {
    const mapSp: Record<number, string> = {
      0: 'Đã Hủy',
      1: 'Chờ xử lý',
      2: 'Đang giao hàng',
      3: 'Đã giao hàng',
      4: 'Đang hoàn hàng',
      5: 'Đã nhận hàng (Chờ hoàn tiền)',
      6: 'Đã hoàn tiền'
    }
    return mapSp[status] || 'N/A'
  }
  const mapDv: Record<number, string> = {
    0: 'Đã Hủy',
    1: 'Đã cọc 10%',
    2: 'Đã thanh toán',
    3: 'Hoàn thành',
    4: 'Tạm hủy (Trễ hẹn)',
    5: 'Chờ hoàn tiền',
    6: 'Đã hoàn tiền',
    9: 'Đã dời lịch'
  }
  return mapDv[status] || 'N/A'
}

const getStatusBadgeConfig = (status: number, maHd: string = '') => {
  const isDark = theme.global.current.value.dark || document.documentElement.classList.contains('dark')
  const laDonSp = maHd.startsWith('SP') || maHd.startsWith('HDSP')

  switch (status) {
    case 0: // Đã Hủy (Đỏ)
      return {
        label: 'Đã Hủy',
        color: 'error',
        bgColor: isDark ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2',
        textColor: isDark ? '#fca5a5' : '#b91c1c',
        borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#fca5a5',
        dotColor: '#ef4444'
      }
    case 1: // Chờ xử lý / Đã cọc (Vàng Cam)
      return {
        label: laDonSp ? 'Chờ xử lý' : 'Đã cọc 10%',
        color: 'warning',
        bgColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#fef3c7',
        textColor: isDark ? '#fde68a' : '#b45309',
        borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#fde68a',
        dotColor: '#f59e0b'
      }
    case 2: // Đang giao / Đã thanh toán (Xanh dương)
      return {
        label: laDonSp ? 'Đang giao hàng' : 'Đã thanh toán',
        color: 'info',
        bgColor: isDark ? 'rgba(14, 165, 233, 0.18)' : '#e0f2fe',
        textColor: isDark ? '#7dd3fc' : '#0369a1',
        borderColor: isDark ? 'rgba(14, 165, 233, 0.35)' : '#bae6fd',
        dotColor: '#0ea5e9'
      }
    case 3: // Đã giao hàng / Hoàn thành (Xanh lá)
      return {
        label: laDonSp ? 'Đã giao hàng' : 'Hoàn thành',
        color: 'success',
        bgColor: isDark ? 'rgba(34, 197, 94, 0.18)' : '#dcfce7',
        textColor: isDark ? '#86efac' : '#15803d',
        borderColor: isDark ? 'rgba(34, 197, 94, 0.35)' : '#bbf7d0',
        dotColor: '#22c55e'
      }
    case 4: // Đang hoàn hàng (SP) / Tạm hủy (DV)
      return {
        label: laDonSp ? 'Đang hoàn hàng' : 'Tạm hủy (Trễ hẹn)',
        color: 'error',
        bgColor: isDark ? 'rgba(244, 63, 94, 0.18)' : '#ffe4e6',
        textColor: isDark ? '#fda4af' : '#be123c',
        borderColor: isDark ? 'rgba(244, 63, 94, 0.35)' : '#fecdd3',
        dotColor: '#e11d48'
      }
    case 5: // Chờ hoàn tiền (Cam)
      return {
        label: laDonSp ? 'Đã nhận hàng (Chờ hoàn tiền)' : 'Chờ hoàn tiền',
        color: 'orange',
        bgColor: isDark ? 'rgba(249, 115, 22, 0.18)' : '#ffedd5',
        textColor: isDark ? '#fed7aa' : '#c2410c',
        borderColor: isDark ? 'rgba(249, 115, 22, 0.35)' : '#fed7aa',
        dotColor: '#f97316'
      }
    case 6: // Đã hoàn tiền (Xanh ngọc Emerald)
      return {
        label: 'Đã hoàn tiền',
        color: 'emerald',
        bgColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#d1fae5',
        textColor: isDark ? '#6ee7b7' : '#047857',
        borderColor: isDark ? 'rgba(16, 185, 129, 0.35)' : '#a7f3d0',
        dotColor: '#10b981'
      }
    case 9: // Đã dời lịch (Tím Indigo)
      return {
        label: 'Đã dời lịch',
        color: 'indigo',
        bgColor: isDark ? 'rgba(99, 102, 241, 0.18)' : '#e0e7ff',
        textColor: isDark ? '#a5b4fc' : '#4338ca',
        borderColor: isDark ? 'rgba(99, 102, 241, 0.35)' : '#c7d2fe',
        dotColor: '#6366f1'
      }
    default:
      return {
        label: 'N/A',
        color: 'grey',
        bgColor: isDark ? 'rgba(148, 163, 184, 0.18)' : '#f1f5f9',
        textColor: isDark ? '#cbd5e1' : '#475569',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.35)' : '#cbd5e1',
        dotColor: '#94a3b8'
      }
  }
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
    { title: 'Tạm hủy (Trễ hẹn)', value: 4 },
    { title: 'Chờ hoàn tiền', value: 5 },
    { title: 'Đã hoàn tiền', value: 6 },
    { title: 'Đã dời lịch', value: 9 },
    { title: 'Đã Hủy', value: 0 }
  ]
}

const changeInvoiceStatus = async (maHd: string, newStatus: number) => {
  const allData = [...hoaDonSanPham.value, ...hoaDonDichVu.value]
  const currentHd =
    allData.find((h) => h.maHd === maHd) ||
    (selectedHd.value && selectedHd.value.maHd === maHd ? selectedHd.value : null)

  if (currentHd) {
    const ma = String(currentHd.maHd || maHd).toUpperCase()
    const laDonSp = ma.startsWith('SP') || ma.startsWith('HDSP')

    if (!laDonSp) {
      showNotification('Hóa đơn dịch vụ không được phép thay đổi trạng thái.', 'warning')
      return
    }

    if (laDonSp && currentHd.trangThai !== 1 && currentHd.trangThai !== 2) {
      if (newStatus !== currentHd.trangThai) {
        showNotification('Trạng thái đã nhận hàng, đã hoàn hàng và đã hoàn tiền không được phép chỉnh sửa.', 'warning')
        return
      }
    }
  }

  let ghiChuLyDo = ''

  if (newStatus === 4) {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Xác nhận Đang hoàn hàng?',
      input: 'text',
      inputLabel: 'Lý do hoàn hàng (Khách bom hàng, không nghe máy, từ chối nhận...):',
      inputPlaceholder: 'Nhập lý do quay đầu hàng...',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận Đang hoàn',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#d97706',
      inputValidator: (val) => {
        if (!val || !val.trim()) return 'Vui lòng nhập lý do hoàn hàng!'
      }
    })
    if (!isConfirmed) return
    ghiChuLyDo = reason || ''
  } else if (newStatus === 5) {
    const result = await Swal.fire({
      title: 'Xác nhận Đã nhận hàng hoàn?',
      html: `Bạn xác nhận <b>Salon đã nhận lại kiện hàng #${maHd}</b> từ Shipper và tiến hành <b>tự động nhập lại số lượng vào kho</b>?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Đã nhận hàng & Nhập kho',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#7c3aed'
    })
    if (!result.isConfirmed) return
    ghiChuLyDo = 'Đã nhận lại kiện hàng hoàn và nhập kho'
  } else if (newStatus === 0) {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Xác nhận Hủy hóa đơn?',
      input: 'text',
      inputLabel: 'Lý do hủy đơn hàng:',
      inputPlaceholder: 'Nhập lý do hủy...',
      showCancelButton: true,
      confirmButtonText: 'Xác nhận Hủy đơn',
      cancelButtonText: 'Đóng',
      confirmButtonColor: '#dc2626'
    })
    if (!isConfirmed) return
    ghiChuLyDo = reason || 'Hủy đơn hàng'
  }

  try {
    const payload = { 
      trangThai: newStatus,
      ghiChu: ghiChuLyDo
    }

    const res = await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, payload, {
      headers: getAuthHeaders()
    })

    if (res.data.success) {
      logActivity(
        'Đổi trạng thái hóa đơn',
        `Đã chuyển trạng thái hóa đơn ${maHd} sang "${getStatusText(newStatus, maHd)}"`,
        'Hóa đơn'
      )
      await Swal.fire({
        title: 'Thành công!',
        text: `Đã cập nhật trạng thái hóa đơn #${maHd} sang "${getStatusText(newStatus, maHd)}"`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      })
      showNotification(`Đã cập nhật trạng thái hóa đơn ${maHd} thành công!`, 'success')
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
    showNotification(e.response?.data?.message || 'Lỗi khi cập nhật trạng thái đơn hàng.', 'error')
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
const selectedMaHd = ref('')
const selectedHd = ref<any>(null)

// ── STATE MODAL VIETQR HOÀN TIỀN RIÊNG BIỆT ──
const isVietQRModalOpen = ref(false)
const vietQRSelectedMaHd = ref('')
const vietQRSelectedAmount = ref(0)

const openVietQRRefundModal = (maHd: string, amount: number = 0) => {
  vietQRSelectedMaHd.value = maHd
  vietQRSelectedAmount.value = amount
  isVietQRModalOpen.value = true
}

const handleVietQRUpdated = (updatedMaHd?: string) => {
  if (updatedMaHd) {
    const all = [...hoaDonDichVu.value, ...hoaDonSanPham.value]
    const target = all.find((h) => h.maHd === updatedMaHd)
    if (target) {
      target.trangThai = 6
    }
  }
  // Tải ngầm danh sách mới nhất ở nền sau, không kích hoạt spinner loading làm giật trang
  axios.get(`${API_BASE_URL}/danh-sach`, {
    params: {
      tuNgay: filter.value.tuNgay,
      denNgay: filter.value.denNgay,
      search: searchQuery.value
    },
    headers: getAuthHeaders()
  }).then((res) => {
    if (res.data.success) {
      hoaDonSanPham.value = res.data.hoaDonSanPham || []
      hoaDonDichVu.value = res.data.hoaDonDichVu || []
    }
  }).catch(() => {})
}

const viewDetail = (maHd: string) => {
  if (!maHd) return
  selectedMaHd.value = maHd
  const match = [...hoaDonSanPham.value, ...hoaDonDichVu.value].find(
    (h) => String(h.maHd || '').toUpperCase() === String(maHd).toUpperCase()
  )
  selectedHd.value = match || null
  isModalOpen.value = true
}

onMounted(fetchHoaDons)
watch([() => filter.value.tuNgay, () => filter.value.denNgay], fetchHoaDons)

// ── FILTERED INVOICES & PAGINATION ──
const filteredInvoices = computed(() => {
  const list = activeTab.value === 'dichVu' ? [...hoaDonDichVu.value] : [...hoaDonSanPham.value]
  const filtered = list.filter((h) => {
    if (selectedStatusFilter.value !== '') {
      if (selectedStatusFilter.value === 'CANCEL_GROUP') {
        if (![0, 4, 5, 6].includes(Number(h.trangThai))) return false
      } else if (String(h.trangThai) !== selectedStatusFilter.value) {
        return false
      }
    }
    return true
  })

  // SẮP XẾP THEO THỜI GIAN TẠO: MỚI NHẤT ĐƯỢC ƯU TIÊN LÊN ĐẦU
  return filtered.sort((a, b) => {
    const timeA = a.ngayTao ? new Date(a.ngayTao).getTime() : 0
    const timeB = b.ngayTao ? new Date(b.ngayTao).getTime() : 0
    return timeB - timeA
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
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <FileText class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h1 class="text-h5 font-weight-bold mb-1">Quản Lý Hóa Đơn</h1>
            <p class="text-subtitle-2 text-medium-emphasis mb-0">
              Quản lý danh mục Hóa đơn dịch vụ Salon và Hóa đơn bán Sản phẩm lẻ
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
            :loading="isLoading"
            @click="handleRefresh"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="exportExcel"
          >
            <template v-slot:prepend>
              <FileDown class="w-4 h-4 mr-1" />
            </template>
            Xuất Excel
          </v-btn>
        </div>
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
      <v-table class="rounded-xl border" hover>
        <thead>
          <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 140px;">Mã HD</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3">Khách hàng</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 140px;">Ngày tạo</th>
            <th v-if="activeTab === 'sanPham'" class="font-weight-bold text-caption uppercase text-center py-3" style="width: 110px;">Số lượng</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 160px;">Thành tiền</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 210px;">Trạng thái đơn hàng</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 90px;">Thao tác</th>
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
                <div class="d-flex justify-center align-center">
                  <!-- TH 1: Đơn không được phép đổi trạng thái => Chip tĩnh màu sắc rõ nét -->
                  <div
                    v-if="!canEditStatus(hd)"
                    class="status-chip d-inline-flex align-center px-3 py-1 rounded-pill font-weight-bold text-caption text-no-wrap"
                    :style="{
                      backgroundColor: getStatusBadgeConfig(hd.trangThai, hd.maHd).bgColor,
                      color: getStatusBadgeConfig(hd.trangThai, hd.maHd).textColor,
                      border: '1px solid ' + getStatusBadgeConfig(hd.trangThai, hd.maHd).borderColor
                    }"
                  >
                    {{ getStatusText(hd.trangThai, hd.maHd) }}
                  </div>

                  <!-- TH 2: Đơn được phép đổi trạng thái (Dịch vụ: Đã cọc 10%; Sản phẩm: Chờ xử lý/Đang giao) => Nút menu chuyển trạng thái -->
                  <v-menu v-else location="bottom center" transition="scale-transition">
                    <template v-slot:activator="{ props }">
                      <button
                        v-bind="props"
                        type="button"
                        class="status-btn d-inline-flex align-center px-3 py-1.5 rounded-pill font-weight-bold text-caption text-no-wrap cursor-pointer"
                        :style="{
                          backgroundColor: getStatusBadgeConfig(hd.trangThai, hd.maHd).bgColor,
                          color: getStatusBadgeConfig(hd.trangThai, hd.maHd).textColor,
                          border: '1px solid ' + getStatusBadgeConfig(hd.trangThai, hd.maHd).borderColor
                        }"
                      >
                        <span>{{ getStatusText(hd.trangThai, hd.maHd) }}</span>
                        <ChevronDown class="w-3.5 h-3.5 ml-1 opacity-80" />
                      </button>
                    </template>

                    <v-list density="compact" rounded="xl" class="py-1.5 border elevation-4" min-width="200">
                      <div class="px-3 py-1 text-caption text-medium-emphasis font-weight-bold border-b mb-1">
                        CHUYỂN TRẠNG THÁI
                      </div>
                      <v-list-item
                        v-for="opt in getStatusSelectOptions(hd.maHd)"
                        :key="opt.value"
                        :value="opt.value"
                        :active="opt.value === hd.trangThai"
                        @click="changeInvoiceStatus(hd.maHd, Number(opt.value))"
                        rounded="lg"
                        class="mx-1 my-0.5"
                      >
                        <template v-slot:prepend>
                          </template>
                        <v-list-item-title class="text-caption font-weight-bold">
                          {{ opt.title }}
                        </v-list-item-title>
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
              </td>

              <td class="py-3 text-center">
                <div class="d-inline-flex align-center gap-1">
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

                  <!-- Nút mở nhanh Modal VietQR Hoàn tiền cho các đơn 4 hoặc 5 -->
                  <v-btn
                    v-if="hd.trangThai === 4 || hd.trangThai === 5"
                    icon
                    variant="tonal"
                    color="amber-darken-3"
                    size="small"
                    title="Quét VietQR chuyển tiền hoàn"
                    @click="openVietQRRefundModal(hd.maHd, hd.soTienHoan || hd.tienDaTra || hd.thanhTien)"
                  >
                    <QrCode class="w-4 h-4" />
                  </v-btn>
                </div>
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

    <!-- ═══════ MODAL: CHI TIẾT HÓA ĐƠN DÙNG CHUNG ═══════ -->
    <ModalChiTietHoaDon
      v-model="isModalOpen"
      :ma-hd="selectedMaHd"
      :initial-data="selectedHd"
      @status-updated="fetchHoaDons"
      @closed="fetchHoaDons"
      @refresh="fetchHoaDons"
    />

    <!-- ═══════ MODAL VIETQR HOÀN TIỀN RIÊNG BIỆT ═══════ -->
    <ModalVietQRHoanTien
      :is-open="isVietQRModalOpen"
      :ma-hd="vietQRSelectedMaHd"
      :tong-tien="vietQRSelectedAmount"
      @close="() => { isVietQRModalOpen = false; fetchHoaDons(); }"
      @updated="() => { isVietQRModalOpen = false; fetchHoaDons(); }"
    />
  </v-container>
</template>

<style scoped>
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

.status-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-chip {
  line-height: 1.2;
  transition: all 0.2s ease;
  user-select: none;
  font-weight: 700;
  letter-spacing: 0.2px;
}

.status-btn {
  line-height: 1.2;
  transition: all 0.2s ease;
  user-select: none;
  font-weight: 700;
  letter-spacing: 0.2px;
  outline: none;
}

.status-btn:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.08);
}

.status-btn:active {
  transform: translateY(0);
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