<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { 
  Search, 
  Trash2, 
  Calendar, 
  X, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Filter, 
  RefreshCw,
  Clock,
  User,
  ShieldAlert,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  FileText,
  SlidersHorizontal,
  Eye,
  Info,
  ArrowRight,
  Sparkles,
  Layers,
  Tag,
  Check
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { useTheme } from 'vuetify'

// Helper for default date strings (YYYY-MM-DD)
const getTodayDateStr = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  const d = now.getDate().toString().padStart(2, '0')
  return `${y}-${m}-${d}`
}

const getFirstDayOfMonthStr = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = (now.getMonth() + 1).toString().padStart(2, '0')
  return `${y}-${m}-01`
}

// ── Theme State Detection (Light / Dark Mode Sync) ──
let isDarkMode = computed(() => false)
try {
  const vuetifyTheme = useTheme()
  isDarkMode = computed(() => vuetifyTheme.global.name.value === 'dark')
} catch (e) {
  isDarkMode = computed(() => {
    return localStorage.getItem('theme_selection') === 'dark'
  })
}

// Watch theme change and update body background to prevent white bottom area
watch(isDarkMode, (dark) => {
  if (dark) {
    document.body.style.backgroundColor = '#141416'
  } else {
    document.body.style.backgroundColor = ''
  }
}, { immediate: true })

onUnmounted(() => {
  document.body.style.backgroundColor = ''
})

interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  details: string;
  module: string;
  status: string;
}

const isLoading = ref(false)
const searchQuery = ref('')
const selectedModule = ref('')
const selectedStatus = ref('')

// Modal Detail State
const selectedLogDetail = ref<ActivityLog | null>(null)
const showDetailModal = ref(false)

const openLogDetail = (log: ActivityLog) => {
  selectedLogDetail.value = log
  showDetailModal.value = true
}

const closeLogDetail = () => {
  showDetailModal.value = false
  selectedLogDetail.value = null
}

interface ParsedChangeItem {
  field: string;
  oldVal: string;
  newVal: string;
  isDiff: boolean;
}

// Smart parser for ANY activity log detail text
const logDetailParsed = computed(() => {
  if (!selectedLogDetail.value?.details) {
    return { title: '', items: [] as ParsedChangeItem[] }
  }

  const rawText = selectedLogDetail.value.details.trim()
  const items: ParsedChangeItem[] = []

  // Case A: Multiline text with bullets (•) or newline changes
  if (rawText.includes('\n')) {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean)
    const title = (lines[0] || '').replace(/^•\s*/, '').replace(/:\s*$/, '')

    for (let i = 1; i < lines.length; i++) {
      const line = (lines[i] || '').replace(/^•\s*/, '')
      if (line.includes('➔')) {
        const parts = line.split('➔')
        const left = (parts[0] || '').trim()
        const right = (parts[1] || '').trim()
        const colonIdx = left.indexOf(':')
        if (colonIdx !== -1) {
          items.push({
            field: left.substring(0, colonIdx).trim(),
            oldVal: left.substring(colonIdx + 1).trim(),
            newVal: right,
            isDiff: true
          })
        } else {
          items.push({ field: 'Thay đổi', oldVal: left, newVal: right, isDiff: true })
        }
      } else if (line.includes(':')) {
        const colonIdx = line.indexOf(':')
        items.push({
          field: line.substring(0, colonIdx).trim(),
          oldVal: '',
          newVal: line.substring(colonIdx + 1).trim(),
          isDiff: false
        })
      } else {
        items.push({ field: 'Nội dung', oldVal: '', newVal: line, isDiff: false })
      }
    }
    return { title, items }
  }

  // Case B: Single line string with hyphen (-) separators
  if (rawText.includes(' - ')) {
    const parts = rawText.split(' - ')
    const title = (parts[0] || '').trim()
    const rest = parts.slice(1).join(' - ')
    const pairs = rest.split(',')

    pairs.forEach(pair => {
      const pTrim = pair.trim()
      if (pTrim.includes(':')) {
        const cIdx = pTrim.indexOf(':')
        const key = pTrim.substring(0, cIdx).trim()
        const val = pTrim.substring(cIdx + 1).trim()
        if (val.includes('từ') && val.includes('lên')) {
          const match = val.match(/từ\s+(.*?)\s+lên\s+(.*)/i)
          if (match && match[1] !== undefined && match[2] !== undefined) {
            items.push({ field: key, oldVal: match[1], newVal: match[2], isDiff: true })
            return
          }
        }
        items.push({ field: key, oldVal: '', newVal: val, isDiff: false })
      } else {
        items.push({ field: 'Thông tin', oldVal: '', newVal: pTrim, isDiff: false })
      }
    })
    return { title, items }
  }

  // Case C: Plain text single line
  return {
    title: rawText,
    items: []
  }
})

// Initialize with default date strings (First day of month to today)
const startDate = ref(getFirstDayOfMonthStr())
const endDate = ref(getTodayDateStr())

const rawLogs = ref<ActivityLog[]>([])

// Module options (Removed 'Cấu hình Hệ thống')
const moduleOptions = [
  { value: '', label: 'Tất cả phân hệ' },
  { value: 'Khách hàng', label: 'Quản lý Khách hàng' },
  { value: 'Hóa đơn', label: 'Hóa đơn & Thanh toán' },
  { value: 'Sản phẩm', label: 'Sản phẩm & Kho hàng' },
  { value: 'Dịch vụ', label: 'Dịch vụ & Bảng giá' },
  { value: 'Voucher', label: 'Khuyến mãi & Voucher' },
  { value: 'Nhân sự', label: 'Nhân sự & Chức vụ' },
  { value: 'Lương', label: 'Lương & Tiền thưởng' },
  { value: 'Ca làm', label: 'Ca làm & Điểm danh' },
  { value: 'Đánh giá', label: 'Đánh giá & Phản hồi' },
  { value: 'Thông báo', label: 'Thông báo & Gửi Mail' },
  { value: 'Nhà cung cấp', label: 'Nhà cung cấp & Nhập hàng' },
  { value: 'Tài khoản', label: 'Tài khoản & Phân quyền' }
]

// Generate rich, structured dummy logs
const generateDummyLogs = () => {
  const dummy: ActivityLog[] = [
    {
      id: 'act1',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon / Quản trị viên',
      action: 'Sửa thông tin khách hàng',
      details: 'Cập nhật thông tin khách hàng Ngô Bá Khá (Mã KH: KH0836991):\n• Số điện thoại: "0905123456" ➔ "0836286122"\n• Email: "khachhang_old@gmail.com" ➔ "latuthien2005@gmail.com"\n• Điểm tích lũy: "120 điểm" ➔ "0 điểm"\n• Trạng thái tài khoản: "Khóa" ➔ "Hoạt động"',
      module: 'Khách hàng',
      status: 'Thành công'
    },
    {
      id: 'act2',
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon / Quản trị viên',
      action: 'In phiếu lương',
      details: 'In phiếu lương chi tiết nhân viên Nguyễn Minh Tâm (Mã: NV002) - Tháng 7/2026:\n• Lương cơ bản: "12.000.000đ"\n• Phụ cấp trách nhiệm: "2.000.000đ"\n• Hoa hồng làm ca: "4.500.000đ" (15% uốn nhuộm)\n• Tổng thực nhận: "18.500.000đ"',
      module: 'Lương',
      status: 'Thành công'
    },
    {
      id: 'act3',
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString(),
      username: 'Phạm Quang Thọ',
      role: 'Thu ngân / Lễ tân',
      action: 'Tạo hóa đơn dịch vụ',
      details: 'Thanh toán thành công hóa đơn #HD-9082 cho KH Nguyễn Thị Mai:\n• Dịch vụ sử dụng: "Cắt tạo kiểu + Nhuộm Balayage Hàn Quốc"\n• Áp dụng Mã Voucher: "HE2026 (Giảm 20%)"\n• Phương thức thanh toán: "Chuyển khoản QR MoMo" (650.000đ)',
      module: 'Hóa đơn',
      status: 'Thành công'
    },
    {
      id: 'act4',
      timestamp: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon / Quản trị viên',
      action: 'Cập nhật nhân viên',
      details: 'Cập nhật hồ sơ nhân viên Đinh Hoàng Phúc (Mã: NV001):\n• Lương cơ bản: "12.000.000đ" ➔ "15.000.000đ"\n• Phân quyền hệ thống: "Nhân viên chính" ➔ "Quản trị viên toàn quyền"',
      module: 'Nhân sự',
      status: 'Thành công'
    },
    {
      id: 'act5',
      timestamp: new Date(Date.now() - 1000 * 3600 * 1.5).toISOString(),
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Cập nhật sản phẩm kho',
      details: 'Nhập kho sản phẩm Dầu gội Olaplex No.4 (Mã SP: SP089):\n• Số lượng tồn kho: "15 chai" ➔ "65 chai (+50 chai mới)"\n• Đơn giá nhập: "450.000đ/chai" từ Nhà cung cấp Mỹ phẩm Minh Anh',
      module: 'Sản phẩm',
      status: 'Thành công'
    },
    {
      id: 'act6',
      timestamp: new Date(Date.now() - 1000 * 3600 * 2.2).toISOString(),
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Sửa hồ sơ tài khoản',
      details: 'Cập nhật tài khoản quản trị Nguyễn Minh Tâm (Mã: NV002):\n• Ảnh đại diện: "Tải lên ảnh mới avatar_2026.png"\n• Mật khẩu đăng nhập: "Đã cập nhật mật khẩu mới thành công"',
      module: 'Tài khoản',
      status: 'Thành công'
    },
    {
      id: 'act7',
      timestamp: new Date(Date.now() - 1000 * 3600 * 3.8).toISOString(),
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon / Quản trị viên',
      action: 'Tạo Mã Voucher mới',
      details: 'Khởi tạo chương trình khuyến mãi Hè 2026:\n• Mã Voucher: "HE2026"\n• Mức ưu đãi: "Giảm 20% tổng hóa đơn uốn nhuộm"\n• Thời gian hiệu lực: "01/07/2026 ➔ 31/08/2026"',
      module: 'Voucher',
      status: 'Thành công'
    },
    {
      id: 'act8',
      timestamp: new Date(Date.now() - 1000 * 3600 * 48).toISOString(),
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Xóa nhân viên',
      details: 'Xóa hồ sơ nhân viên Trần Văn B (Mã: NV099):\n• Trạng thái xử lý: "Thất bại / Hệ thống chặn"\n• Lý do: "Nhân viên đã phát sinh dữ liệu trong 14 hóa đơn và ca làm việc, không được phép xóa để đảm bảo toàn vẹn dữ liệu."',
      module: 'Nhân sự',
      status: 'Thất bại'
    }
  ]
  return dummy
}

const loadLogs = () => {
  isLoading.value = true
  try {
    const stored = localStorage.getItem('lghair_activities')
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed && Array.isArray(parsed) && parsed.length > 0) {
        const hasLegacyDummy = parsed.some((l: ActivityLog) => l.id === 'act1' && !l.details.includes('➔'))
        if (hasLegacyDummy) {
          const dummy = generateDummyLogs()
          rawLogs.value = dummy
          localStorage.setItem('lghair_activities', JSON.stringify(dummy))
        } else {
          rawLogs.value = parsed
        }
      } else {
        const dummy = generateDummyLogs()
        rawLogs.value = dummy
        localStorage.setItem('lghair_activities', JSON.stringify(dummy))
      }
    } else {
      const dummy = generateDummyLogs()
      rawLogs.value = dummy
      localStorage.setItem('lghair_activities', JSON.stringify(dummy))
    }
  } catch (e) {
    console.error(e)
  } finally {
    setTimeout(() => {
      isLoading.value = false
    }, 200)
  }
}

// Stats computed properties
const stats = computed(() => {
  const total = rawLogs.value.length
  const success = rawLogs.value.filter(l => l.status === 'Thành công').length
  const failed = rawLogs.value.filter(l => l.status === 'Thất bại').length
  
  // Today's activities
  const todayStr = new Date().toDateString()
  const today = rawLogs.value.filter(l => new Date(l.timestamp).toDateString() === todayStr).length
  
  return { total, success, failed, today }
})

// Active filters count
const activeFilterCount = computed(() => {
  let count = 0
  if (searchQuery.value.trim()) count++
  if (selectedModule.value) count++
  if (selectedStatus.value) count++
  if (startDate.value !== getFirstDayOfMonthStr()) count++
  if (endDate.value !== getTodayDateStr()) count++
  return count
})

// Filtered and searched logs
const filteredLogs = computed(() => {
  return rawLogs.value.filter(log => {
    // Search filter
    const matchesSearch = !searchQuery.value.trim() || 
      log.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.role.toLowerCase().includes(searchQuery.value.toLowerCase())

    // Module filter
    const matchesModule = !selectedModule.value || log.module.toLowerCase().includes(selectedModule.value.toLowerCase()) || selectedModule.value.toLowerCase().includes(log.module.toLowerCase())

    // Status filter
    const matchesStatus = !selectedStatus.value || log.status === selectedStatus.value

    // Date range filter
    let matchesDate = true
    if (startDate.value) {
      const start = new Date(startDate.value + 'T00:00:00')
      const logDate = new Date(log.timestamp)
      matchesDate = matchesDate && logDate >= start
    }
    if (endDate.value) {
      const end = new Date(endDate.value + 'T23:59:59')
      const logDate = new Date(log.timestamp)
      matchesDate = matchesDate && logDate <= end
    }

    return matchesSearch && matchesModule && matchesStatus && matchesDate
  })
})

// Pagination variables
const currentPage = ref(1)
const perPage = ref(10)

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredLogs.value.length / perPage.value))
})

const pagedLogs = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredLogs.value.slice(start, start + perPage.value)
})

const visiblePages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = currentPage.value
  
  let start = Math.max(1, current - 2)
  let end = Math.min(total, current + 2)
  
  if (end - start + 1 < 5) {
    if (start === 1) {
      end = Math.min(total, start + 4)
    } else if (end === total) {
      start = Math.max(1, end - 4)
    }
  }
  
  for (let i = start; i <= end; i++) {
    if (i >= 1 && i <= total) pages.push(i)
  }
  return pages
})

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

watch([searchQuery, selectedModule, selectedStatus, startDate, endDate], () => {
  currentPage.value = 1
})

// Format helpers
const formatDate = (isoString: string) => {
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return isoString
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  const h = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  const sec = date.getSeconds().toString().padStart(2, '0')
  return `${d}/${m}/${y} ${h}:${min}:${sec}`
}

const getModuleBadgeClass = (module: string) => {
  const modLower = module.toLowerCase()

  if (isDarkMode.value) {
    if (modLower.includes('nhân sự')) return 'bg-sky-950/80 text-sky-300 border-sky-800/70'
    if (modLower.includes('lương')) return 'bg-emerald-950/80 text-emerald-300 border-emerald-800/70'
    if (modLower.includes('tài khoản')) return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/70'
    if (modLower.includes('dịch vụ')) return 'bg-purple-950/80 text-purple-300 border-purple-800/70'
    if (modLower.includes('ca làm') || modLower.includes('điểm danh')) return 'bg-blue-950/80 text-blue-300 border-blue-800/70'
    if (modLower.includes('hóa đơn') || modLower.includes('thanh toán')) return 'bg-teal-950/80 text-teal-300 border-teal-800/70'
    if (modLower.includes('khách hàng')) return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/70'
    if (modLower.includes('sản phẩm') || modLower.includes('kho')) return 'bg-amber-950/80 text-amber-300 border-amber-800/70'
    if (modLower.includes('voucher') || modLower.includes('khuyến mãi')) return 'bg-rose-950/80 text-rose-300 border-rose-800/70'
    if (modLower.includes('đánh giá')) return 'bg-yellow-950/80 text-yellow-300 border-yellow-800/70'
    if (modLower.includes('thông báo')) return 'bg-violet-950/80 text-violet-300 border-violet-800/70'
    if (modLower.includes('nhà cung cấp')) return 'bg-orange-950/80 text-orange-300 border-orange-800/70'
    return 'bg-slate-800 text-slate-300 border-slate-700'
  }

  if (modLower.includes('nhân sự')) return 'bg-sky-100/80 text-sky-800 border-sky-300/70'
  if (modLower.includes('lương')) return 'bg-emerald-100/80 text-emerald-800 border-emerald-300/70'
  if (modLower.includes('tài khoản')) return 'bg-indigo-100/80 text-indigo-800 border-indigo-300/70'
  if (modLower.includes('dịch vụ')) return 'bg-purple-100/80 text-purple-800 border-purple-300/70'
  if (modLower.includes('ca làm') || modLower.includes('điểm danh')) return 'bg-blue-100/80 text-blue-800 border-blue-300/70'
  if (modLower.includes('hóa đơn') || modLower.includes('thanh toán')) return 'bg-teal-100/80 text-teal-800 border-teal-300/70'
  if (modLower.includes('khách hàng')) return 'bg-cyan-100/80 text-cyan-800 border-cyan-300/70'
  if (modLower.includes('sản phẩm') || modLower.includes('kho')) return 'bg-amber-100/80 text-amber-800 border-amber-300/70'
  if (modLower.includes('voucher') || modLower.includes('khuyến mãi')) return 'bg-rose-100/80 text-rose-800 border-rose-300/70'
  if (modLower.includes('đánh giá')) return 'bg-yellow-100/80 text-yellow-800 border-yellow-300/70'
  if (modLower.includes('thông báo')) return 'bg-violet-100/80 text-violet-800 border-violet-300/70'
  if (modLower.includes('nhà cung cấp')) return 'bg-orange-100/80 text-orange-800 border-orange-300/70'
  return 'bg-slate-100 text-slate-700 border-slate-200'
}

const clearLogs = () => {
  Swal.fire({
    title: 'Xác nhận dọn dẹp?',
    text: 'Bạn có chắc chắn muốn xóa toàn bộ nhật ký hoạt động này không? Hành động này không thể hoàn tác.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#0284c7',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Đồng ý xóa',
    cancelButtonText: 'Hủy bỏ',
    customClass: {
      popup: 'rounded-xl',
      confirmButton: 'rounded-lg px-5 py-2.5 font-bold',
      cancelButton: 'rounded-lg px-5 py-2.5 font-bold'
    }
  }).then((result) => {
    if (result.isConfirmed) {
      rawLogs.value = []
      localStorage.setItem('lghair_activities', '[]')
      Swal.fire({
        icon: 'success',
        title: 'Đã xóa',
        text: 'Đã dọn dẹp sạch nhật ký hoạt động.',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-xl' }
      })
    }
  })
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedModule.value = ''
  selectedStatus.value = ''
  startDate.value = getFirstDayOfMonthStr()
  endDate.value = getTodayDateStr()
  loadLogs()
}

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <div 
    class="activity-page min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans antialiased relative transition-colors duration-300"
    :class="isDarkMode ? 'bg-[#141416] text-slate-100' : 'bg-slate-50 text-slate-800'"
  >
    
    <!-- Header Area -->
    <div class="flex-shrink-0 w-full mb-6 z-10">
      <div 
        class="act-header-card flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-xl border shadow-xs transition-colors duration-300"
        :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
      >
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/25 flex-shrink-0">
            <Activity class="w-7 h-7 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 
              class="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3"
              :class="isDarkMode ? 'text-white' : 'text-slate-900'"
            >
              NHẬT KÝ HOẠT ĐỘNG
              <span 
                class="inline-flex items-center px-3 py-0.5 rounded-full text-xs font-extrabold border"
                :class="isDarkMode ? 'bg-sky-950/80 text-sky-300 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'"
              >
                LGHair Admin
              </span>
            </h1>
            <p class="text-xs md:text-sm mt-1 font-medium" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
              Theo dõi, truy vết và ghi nhận lịch sử thao tác hệ thống tự động
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Refresh Button (Icon-only) -->
          <button 
            @click="loadLogs" 
            title="Làm mới dữ liệu"
            class="w-11 h-11 rounded-lg border transition-all duration-200 cursor-pointer shadow-2xs flex items-center justify-center"
            :class="isDarkMode ? 'bg-[#282836] border-slate-700 hover:border-slate-600 text-slate-200' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-sky-400'"
          >
            <RefreshCw class="w-5 h-5 text-sky-500" :class="{ 'animate-spin': isLoading }" />
          </button>
          
          <button 
            @click="clearLogs" 
            :disabled="rawLogs.length === 0"
            class="h-11 px-5 text-xs font-bold rounded-lg border transition-all duration-200 cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            :class="isDarkMode ? 'bg-rose-950/40 border-rose-800/80 text-rose-300 hover:bg-rose-900/50' : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 hover:border-rose-300'"
          >
            <Trash2 class="w-4 h-4" />
            <span>Dọn sạch nhật ký</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="flex-shrink-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-6 z-10">
      
      <!-- Card 1: Today Logs -->
      <div 
        class="py-6 px-6 min-h-[115px] rounded-xl border shadow-2xs transition-all duration-200 flex items-center justify-between"
        :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90 hover:border-sky-300'"
      >
        <div class="flex flex-col justify-center my-auto">
          <p class="text-xs font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">HOẠT ĐỘNG HÔM NAY</p>
          <div class="flex items-center gap-2.5">
            <span class="text-3xl font-black font-mono tracking-tight leading-none" :class="isDarkMode ? 'text-white' : 'text-slate-900'">{{ stats.today }}</span>
            <span class="text-xs font-bold px-2.5 py-1 rounded-md border" :class="isDarkMode ? 'bg-sky-950 text-sky-300 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'">bản ghi</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-lg border flex items-center justify-center shadow-2xs flex-shrink-0 my-auto" :class="isDarkMode ? 'bg-sky-950/60 border-sky-800/80 text-sky-400' : 'bg-sky-50 border-sky-200 text-sky-600'">
          <Clock class="w-6 h-6 stroke-[2.25px]" />
        </div>
      </div>

      <!-- Card 2: Total Logs -->
      <div 
        class="py-6 px-6 min-h-[115px] rounded-xl border shadow-2xs transition-all duration-200 flex items-center justify-between"
        :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90 hover:border-blue-300'"
      >
        <div class="flex flex-col justify-center my-auto">
          <p class="text-xs font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">TỔNG GHI NHẬN</p>
          <div class="flex items-center gap-2.5">
            <span class="text-3xl font-black text-sky-600 font-mono tracking-tight leading-none">{{ stats.total }}</span>
            <span class="text-xs font-bold" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">thao tác</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-lg border flex items-center justify-center shadow-2xs flex-shrink-0 my-auto" :class="isDarkMode ? 'bg-blue-950/60 border-blue-800/80 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600'">
          <Activity class="w-6 h-6 stroke-[2.25px]" />
        </div>
      </div>

      <!-- Card 3: Success Logs -->
      <div 
        class="py-6 px-6 min-h-[115px] rounded-xl border shadow-2xs transition-all duration-200 flex items-center justify-between"
        :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90 hover:border-emerald-300'"
      >
        <div class="flex flex-col justify-center my-auto">
          <p class="text-xs font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">THÀNH CÔNG</p>
          <div class="flex items-center gap-2.5">
            <span class="text-3xl font-black text-emerald-600 font-mono tracking-tight leading-none">{{ stats.success }}</span>
            <span class="text-xs font-bold px-2.5 py-1 rounded-md border" :class="isDarkMode ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-emerald-50 text-emerald-700 border-emerald-200'">bản ghi</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-lg border flex items-center justify-center shadow-2xs flex-shrink-0 my-auto" :class="isDarkMode ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'">
          <CheckCircle2 class="w-6 h-6 stroke-[2.25px]" />
        </div>
      </div>

      <!-- Card 4: Failed Logs -->
      <div 
        class="py-6 px-6 min-h-[115px] rounded-xl border shadow-2xs transition-all duration-200 flex items-center justify-between"
        :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90 hover:border-rose-300'"
      >
        <div class="flex flex-col justify-center my-auto">
          <p class="text-xs font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">THẤT BẠI / CẢNH BÁO</p>
          <div class="flex items-center gap-2.5">
            <span class="text-3xl font-black text-rose-600 font-mono tracking-tight leading-none">{{ stats.failed }}</span>
            <span class="text-xs font-bold px-2.5 py-1 rounded-md border" :class="isDarkMode ? 'bg-rose-950 text-rose-300 border-rose-800' : 'bg-rose-50 text-rose-700 border-rose-200'">sự cố</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-lg border flex items-center justify-center shadow-2xs flex-shrink-0 my-auto" :class="isDarkMode ? 'bg-rose-950/60 border-rose-800/80 text-rose-400' : 'bg-rose-50 border-rose-200 text-rose-600'">
          <ShieldAlert class="w-6 h-6 stroke-[2.25px]" />
        </div>
      </div>

    </div>

    <!-- Filters Block -->
    <div 
      class="act-filter-card flex-shrink-0 rounded-xl border shadow-xs mb-6 z-10 transition-colors duration-300"
      :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
    >
      <div class="flex flex-col gap-6">
        
        <!-- Filter Header -->
        <div class="flex items-center justify-between border-b pb-4" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-150'">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg border flex items-center justify-center text-sky-600" :class="isDarkMode ? 'bg-sky-950/80 border-sky-800' : 'bg-sky-50 border-sky-200'">
              <SlidersHorizontal class="w-4.5 h-4.5" />
            </div>
            <span class="text-xs md:text-sm font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">Bộ lọc tìm kiếm nâng cao</span>
            <span v-if="activeFilterCount > 0" class="px-3 py-0.5 text-xs font-extrabold bg-sky-600 text-white rounded-full">
              Đang lọc ({{ activeFilterCount }})
            </span>
          </div>

          <button 
            v-if="activeFilterCount > 0"
            @click="resetFilters" 
            class="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-500 transition-colors cursor-pointer"
          >
            <RotateCcw class="w-3.5 h-3.5" /> Đặt lại tất cả
          </button>
        </div>
        
        <!-- Filter Controls Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 md:gap-6">
          
          <!-- Text Search Field -->
          <div class="flex flex-col gap-2 md:col-span-2">
            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Tìm kiếm thông tin</label>
            <div class="relative flex items-center">
              <Search class="absolute left-4 w-4 h-4 pointer-events-none z-10" :class="isDarkMode ? 'text-slate-400' : 'text-slate-400'" />
              <input 
                v-model="searchQuery" 
                placeholder="Nhập tên người thực hiện, nội dung thao tác, vai trò..." 
                class="act-input act-input-styled w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
              >
              <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-4 text-slate-400 hover:text-slate-600 p-1 rounded-md z-10">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Module Select Field -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Phân hệ hoạt động</label>
            <div class="relative flex items-center">
              <select 
                v-model="selectedModule" 
                class="act-select act-select-styled w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
              >
                <option 
                  v-for="opt in moduleOptions" 
                  :key="opt.value" 
                  :value="opt.value"
                  :class="isDarkMode ? 'bg-[#2b2b36] text-white py-1.5' : 'text-slate-800 py-1.5'"
                >
                  {{ opt.label }}
                </option>
              </select>
              <span class="pointer-events-none absolute right-4 text-xs text-sky-600 font-bold z-10">▼</span>
            </div>
          </div>

          <!-- Status Select Field -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Trạng thái kết quả</label>
            <div class="relative flex items-center">
              <select 
                v-model="selectedStatus" 
                class="act-select act-select-styled w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
              >
                <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Tất cả trạng thái</option>
                <option value="Thành công" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Thành công</option>
                <option value="Thất bại" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Thất bại / Cảnh báo</option>
              </select>
              <span class="pointer-events-none absolute right-4 text-xs text-sky-600 font-bold z-10">▼</span>
            </div>
          </div>

          <!-- Start Date Field -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Từ ngày</label>
            <div class="relative flex items-center">
              <input 
                type="date" 
                v-model="startDate" 
                class="act-date-input act-date-styled w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                :class="isDarkMode ? 'dark-mode-input [color-scheme:dark]' : 'light-mode-input'"
              >
            </div>
          </div>

          <!-- End Date Field -->
          <div class="flex flex-col gap-2">
            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Đến ngày</label>
            <div class="relative flex items-center">
              <input 
                type="date" 
                v-model="endDate" 
                class="act-date-input act-date-styled w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                :class="isDarkMode ? 'dark-mode-input [color-scheme:dark]' : 'light-mode-input'"
              >
            </div>
          </div>

          <!-- Action Buttons Area -->
          <div class="flex items-end justify-end md:col-span-2">
            <button 
              @click="resetFilters" 
              class="act-reset-btn h-11 px-6 text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
              <RotateCcw class="w-4 h-4 stroke-[2.2px]" />
              <span>Đặt lại bộ lọc</span>
            </button>
          </div>

        </div>

        <!-- Filter Counter Status -->
        <div class="border-t pt-3 flex items-center justify-between text-xs font-medium" :class="isDarkMode ? 'border-slate-700/80 text-slate-150' : 'border-slate-150 text-slate-500'">
          <div>
            Hiển thị <span class="font-bold text-sky-600">{{ filteredLogs.length }}</span> / {{ rawLogs.length }} bản ghi trùng khớp
          </div>
        </div>
      </div>
    </div>

    <!-- Main Table Container -->
    <div 
      class="act-table-card flex-1 w-full rounded-xl border shadow-xs relative overflow-hidden flex flex-col z-10 min-h-[400px] transition-colors duration-300"
      :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
    >
      
      <!-- Loader Overlay -->
      <div 
        v-if="isLoading" 
        class="absolute inset-0 z-50 flex items-center justify-center transition-all"
        :class="isDarkMode ? 'bg-[#141416]/90' : 'bg-white/90 backdrop-blur-xs'"
      >
        <div class="flex flex-col items-center gap-3 p-6 rounded-xl shadow-lg border" :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700' : 'bg-white border-sky-100'">
          <div class="w-10 h-10 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin"></div>
          <span class="text-xs font-extrabold text-sky-600 tracking-wider uppercase">Đang nạp dữ liệu nhật ký...</span>
        </div>
      </div>

      <!-- Table Scroll Wrapper -->
      <div class="flex-grow overflow-x-auto custom-scrollbar">
        <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[900px]">
          <thead>
            <tr :class="isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-900 text-white'">
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 whitespace-nowrap">Thời Gian</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-56 whitespace-nowrap">Người Thực Hiện</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-48 whitespace-nowrap">Hành Động</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider">Chi Tiết Thao Tác</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-32 text-center whitespace-nowrap">Phân Hệ</th>
              <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-32 text-center whitespace-nowrap">Trạng Thái</th>
              <th class="py-4 px-4 font-extrabold uppercase tracking-wider w-24 text-center whitespace-nowrap">Chi Tiết</th>
            </tr>
          </thead>
          <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'">
            
            <!-- Empty State -->
            <tr v-if="!isLoading && pagedLogs.length === 0">
              <td colspan="7" class="p-14 text-center text-slate-500">
                <div class="flex flex-col items-center gap-3 max-w-md mx-auto">
                  <div class="w-14 h-14 rounded-xl flex items-center justify-center text-sky-600 border shadow-2xs" :class="isDarkMode ? 'bg-sky-950/60 border-sky-800' : 'bg-sky-50 border-sky-100'">
                    <FileText class="w-7 h-7 stroke-[1.5px]" />
                  </div>
                  <div>
                    <h3 class="font-extrabold text-base mb-1" :class="isDarkMode ? 'text-white' : 'text-slate-800'">Không tìm thấy bản ghi phù hợp</h3>
                    <p class="text-xs leading-relaxed" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Không có nhật ký nào trùng khớp với từ khóa hoặc điều kiện bộ lọc của bạn.</p>
                  </div>
                  <button 
                    @click="resetFilters" 
                    class="mt-1 h-9 px-4 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw class="w-3.5 h-3.5" /> Đặt lại bộ lọc
                  </button>
                </div>
              </td>
            </tr>

            <!-- Log Items Rows -->
            <tr 
              v-for="log in pagedLogs" 
              :key="log.id"
              @click="openLogDetail(log)"
              class="transition-colors duration-150 group cursor-pointer"
              :class="isDarkMode ? 'hover:bg-slate-800/70 text-slate-200' : 'hover:bg-sky-50/70 text-slate-700'"
            >
              <!-- Timestamp -->
              <td class="py-4 px-6 font-medium font-mono text-xs whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                <div class="flex items-center gap-2">
                  <Clock class="w-3.5 h-3.5 text-sky-600 flex-shrink-0" />
                  <span>{{ formatDate(log.timestamp) }}</span>
                </div>
              </td>

              <!-- Actor -->
              <td class="py-4 px-6">
                <div class="flex items-center gap-3">
                  <div 
                    class="w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs"
                    :class="isDarkMode ? 'bg-sky-950/80 border-sky-800 text-sky-300' : 'bg-sky-50 border-sky-200 text-sky-700'"
                  >
                    <User class="w-4 h-4" />
                  </div>
                  <div class="min-w-0">
                    <div class="font-bold text-xs md:text-sm truncate" :class="isDarkMode ? 'text-white' : 'text-slate-800'">{{ log.username }}</div>
                    <div class="text-[10px] font-bold uppercase tracking-wider truncate" :class="isDarkMode ? 'text-sky-400' : 'text-sky-700'">{{ log.role }}</div>
                  </div>
                </div>
              </td>

              <!-- Action -->
              <td class="py-4 px-6 font-extrabold whitespace-nowrap">
                <span 
                  class="inline-block px-2.5 py-1 rounded-md border text-xs"
                  :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'"
                >
                  {{ log.action }}
                </span>
              </td>

              <!-- Details -->
              <td class="py-4 px-6 leading-relaxed font-medium text-xs md:text-sm" :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'">
                <div class="line-clamp-2 hover:text-sky-600 transition-colors">
                  {{ log.details }}
                </div>
              </td>

              <!-- Module Badge -->
              <td class="py-4 px-6 text-center whitespace-nowrap">
                <span 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-2xs"
                  :class="getModuleBadgeClass(log.module)"
                >
                  {{ log.module }}
                </span>
              </td>

              <!-- Status -->
              <td class="py-4 px-6 text-center whitespace-nowrap">
                <span 
                  v-if="log.status === 'Thành công'" 
                  class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                  :class="isDarkMode ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800/80' : 'text-emerald-700 bg-emerald-50 border-emerald-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Thành công
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full border shadow-2xs"
                  :class="isDarkMode ? 'text-rose-300 bg-rose-950/80 border-rose-800/80' : 'text-rose-700 bg-rose-50 border-rose-200'"
                >
                  <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                  Thất bại
                </span>
              </td>

              <!-- Action button -->
              <td class="py-4 px-4 text-center whitespace-nowrap">
                <button 
                  @click.stop="openLogDetail(log)"
                  title="Xem chi tiết thao tác"
                  class="w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-all cursor-pointer shadow-2xs"
                  :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-sky-500 text-sky-400' : 'bg-white border-slate-200 hover:border-sky-400 text-sky-600 hover:bg-sky-50'"
                >
                  <Eye class="w-4 h-4" />
                </button>
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div 
        v-if="totalPages > 1" 
        class="flex-shrink-0 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t"
        :class="isDarkMode ? 'bg-[#252536] border-slate-700/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'"
      >
        <div class="text-xs font-bold">
          Hiển thị trang <span class="text-sky-600">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ filteredLogs.length }} dòng)
        </div>

        <div class="flex items-center gap-2">
          <button 
            @click="changePage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'"
          >
            <ChevronLeft class="w-3.5 h-3.5" />
            <span class="hidden sm:inline">Trước</span>
          </button>

          <div class="flex items-center gap-1">
            <button 
              v-for="p in visiblePages" 
              :key="p" 
              @click="changePage(p)"
              class="w-8 h-8 text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center justify-center cursor-pointer"
              :class="currentPage === p ? 'bg-sky-600 text-white font-extrabold shadow-sm' : (isDarkMode ? 'bg-[#2b2b36] text-slate-200 border border-slate-700 hover:border-slate-600' : 'bg-white text-slate-700 border border-slate-300 hover:border-slate-400')"
            >
              {{ p }}
            </button>
          </div>

          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
            :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 text-slate-200 hover:border-slate-600' : 'bg-white border-slate-300 text-slate-700 hover:border-slate-400'"
          >
            <span class="hidden sm:inline">Sau</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>

    <!-- ── Perfectly Balanced Activity Log Detail Modal (Enforced 44px side padding & Non-overlapping Old vs New diff layout) ── -->
    <Teleport to="body">
      <div 
        v-if="showDetailModal && selectedLogDetail" 
        class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all"
        @click="closeLogDetail"
      >
        <div 
          class="act-modal-container relative w-full max-w-3xl rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
          :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
          @click.stop
        >
          
          <!-- Premium Header (Enforced 44px side padding via Scoped CSS) -->
          <div class="act-modal-header border-b flex items-center justify-between relative overflow-hidden bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 text-white">
            <div class="flex items-center gap-4 z-10">
              <div class="w-11 h-11 rounded-lg bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-md flex-shrink-0">
                <Sparkles class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-extrabold text-base md:text-lg text-white tracking-wide">
                  CHI TIẾT NHẬT KÝ THAO TÁC
                </h3>
                <p class="text-xs text-sky-100 font-mono opacity-90">
                  Mã bản ghi hệ thống: #{{ selectedLogDetail.id }}
                </p>
              </div>
            </div>

            <button 
              @click="closeLogDetail" 
              class="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer z-10"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Body Content Scroll Area (Enforced 44px side padding via Scoped CSS) -->
          <div class="act-modal-body flex flex-col gap-6 max-h-[78vh] overflow-y-auto custom-scrollbar">
            
            <!-- Metadata Cards Grid (Equal height cards) -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <!-- Card 1: Performer -->
              <div class="act-meta-card p-4 rounded-lg border flex flex-col justify-between" :class="isDarkMode ? 'bg-[#242436] border-slate-700/70' : 'bg-slate-50 border-slate-200'">
                <div class="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                  <User class="w-4 h-4 text-sky-500" />
                  <span>NGƯỜI THỰC HIỆN</span>
                </div>
                <div>
                  <div class="font-black text-sm md:text-base leading-tight mb-1" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                    {{ selectedLogDetail.username }}
                  </div>
                  <span class="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-extrabold text-sky-600 border" :class="isDarkMode ? 'bg-sky-950/80 border-sky-800' : 'bg-sky-50 border-sky-200'">
                    {{ selectedLogDetail.role }}
                  </span>
                </div>
              </div>

              <!-- Card 2: Module & Action -->
              <div class="act-meta-card p-4 rounded-lg border flex flex-col justify-between" :class="isDarkMode ? 'bg-[#242436] border-slate-700/70' : 'bg-slate-50 border-slate-200'">
                <div class="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                  <Layers class="w-4 h-4 text-blue-500" />
                  <span>PHÂN HỆ & HÀNH ĐỘNG</span>
                </div>
                <div>
                  <div class="font-extrabold text-sm mb-1.5" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                    {{ selectedLogDetail.action }}
                  </div>
                  <span 
                    class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border"
                    :class="getModuleBadgeClass(selectedLogDetail.module)"
                  >
                    {{ selectedLogDetail.module }}
                  </span>
                </div>
              </div>

              <!-- Card 3: Status & Time -->
              <div class="act-meta-card p-4 rounded-lg border flex flex-col justify-between" :class="isDarkMode ? 'bg-[#242436] border-slate-700/70' : 'bg-slate-50 border-slate-200'">
                <div class="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wider mb-2" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                  <Clock class="w-4 h-4 text-emerald-500" />
                  <span>THỜI GIAN & KẾT QUẢ</span>
                </div>
                <div>
                  <div class="font-bold font-mono text-xs mb-1.5" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">
                    {{ formatDate(selectedLogDetail.timestamp) }}
                  </div>
                  <span 
                    v-if="selectedLogDetail.status === 'Thành công'"
                    class="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500 text-white shadow-2xs"
                  >
                    <CheckCircle2 class="w-3.5 h-3.5" /> THÀNH CÔNG
                  </span>
                  <span 
                    v-else
                    class="inline-flex items-center gap-1.5 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500 text-white shadow-2xs"
                  >
                    <XCircle class="w-3.5 h-3.5" /> THẤT BẠI
                  </span>
                </div>
              </div>

            </div>

            <!-- Structured Field Changes Section -->
            <div class="flex flex-col gap-4">
              
              <div class="flex items-center justify-between border-b pb-3" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
                <label class="text-xs md:text-sm font-extrabold uppercase tracking-wider flex items-center gap-2" :class="isDarkMode ? 'text-sky-400' : 'text-sky-700'">
                  <FileText class="w-4.5 h-4.5" />
                  CHI TIẾT NỘI DUNG ĐÃ CHỈNH SỬA / THAY ĐỔI
                </label>
              </div>

              <!-- Main Action Summary Title -->
              <div class="p-4 px-5 rounded-lg border text-xs md:text-sm font-extrabold tracking-wide" :class="isDarkMode ? 'bg-[#252536] border-sky-900/60 text-sky-300' : 'bg-sky-50/80 border-sky-200 text-sky-900'">
                {{ logDetailParsed.title }}
              </div>

              <!-- Structured Diff Items Cards (Clean 3-column non-overlapping layout: Old Box + Arrow Circle + New Box) -->
              <div v-if="logDetailParsed.items.length > 0" class="flex flex-col gap-4">
                <div 
                  v-for="(item, idx) in logDetailParsed.items" 
                  :key="idx"
                  class="act-diff-card rounded-lg border transition-all"
                  :class="isDarkMode ? 'bg-[#222233] border-slate-700/80' : 'bg-white border-slate-200 shadow-2xs'"
                >
                  <!-- Side-by-side Diff Row for modified fields -->
                  <div v-if="item.isDiff" class="flex flex-col gap-3">
                    <div class="text-xs font-black uppercase tracking-wider text-sky-500 flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full bg-sky-500"></span>
                      TRƯỜNG DỮ LIỆU CHỈNH SỬA: {{ item.field }}
                    </div>

                    <!-- Clean 3-part layout (Old Box, Arrow Badge, New Box) without any overlap -->
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      
                      <!-- Old Value Box -->
                      <div class="flex-1 p-4 rounded-lg border flex flex-col gap-1" :class="isDarkMode ? 'bg-rose-950/30 border-rose-900/60 text-rose-300' : 'bg-rose-50/80 border-rose-200 text-rose-800'">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider opacity-75">GIÁ TRỊ CŨ (TRƯỚC SỬA)</span>
                        <div class="font-mono text-xs font-bold break-all leading-normal">{{ item.oldVal }}</div>
                      </div>

                      <!-- Arrow Badge in Middle -->
                      <div class="flex-shrink-0 flex items-center justify-center py-1 sm:py-0">
                        <div class="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center shadow-sm">
                          <ArrowRight class="w-4 h-4" />
                        </div>
                      </div>

                      <!-- New Value Box -->
                      <div class="flex-1 p-4 rounded-lg border flex flex-col gap-1" :class="isDarkMode ? 'bg-emerald-950/30 border-emerald-900/60 text-emerald-300' : 'bg-emerald-50/80 border-emerald-200 text-emerald-800'">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider opacity-75">GIÁ TRỊ MỚI (ĐÃ CẬP NHẬT)</span>
                        <div class="font-mono text-xs font-extrabold break-all leading-normal">{{ item.newVal }}</div>
                      </div>

                    </div>
                  </div>

                  <!-- Single Field Value Item -->
                  <div v-else class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1">
                    <span class="text-xs font-extrabold uppercase tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                      {{ item.field || 'Nội dung' }}:
                    </span>
                    <span class="text-xs md:text-sm font-bold font-mono px-3 py-1.5 rounded-lg border" :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700 text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'">
                      {{ item.newVal }}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          <!-- Modal Footer (Enforced 44px side padding via Scoped CSS) -->
          <div 
            class="act-modal-footer border-t flex items-center justify-end"
            :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
          >
            <button 
              @click="closeLogDetail" 
              class="act-modal-close-btn h-11 px-7 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-2"
            >
              <Check class="w-4 h-4 stroke-[2.5px]" />
              <span>Đóng cửa sổ</span>
            </button>
          </div>

        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
/* Enforce dark background on parent containers */
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Header & Filter Card Padding Enforced via Scoped CSS to override any Bootstrap/Vuetify defaults */
.act-header-card {
  padding: 1.75rem 2.25rem !important; /* 28px top/bottom, 36px left/right */
}

.act-filter-card {
  padding: 2rem 2.75rem !important; /* 32px top/bottom, 44px left/right side padding */
}

/* Modal Side Padding Enforcement via Scoped CSS to guarantee 44px margins */
.act-modal-container {
  border-radius: 14px !important; /* Clean square-ish corners */
  width: 92% !important;
  max-width: 820px !important;
}

.act-modal-header {
  padding-left: 2.75rem !important; /* 44px side padding */
  padding-right: 2.75rem !important; /* 44px side padding */
  padding-top: 1.5rem !important;
  padding-bottom: 1.5rem !important;
}

.act-modal-body {
  padding-left: 2.75rem !important; /* 44px side padding */
  padding-right: 2.75rem !important; /* 44px side padding */
  padding-top: 2rem !important;
  padding-bottom: 2rem !important;
}

.act-modal-footer {
  padding-left: 2.75rem !important; /* 44px side padding */
  padding-right: 2.75rem !important; /* 44px side padding */
  padding-top: 1.25rem !important;
  padding-bottom: 1.25rem !important;
}

.act-diff-card {
  padding-left: 1.75rem !important; /* 28px inside card */
  padding-right: 1.75rem !important;
  padding-top: 1.25rem !important;
  padding-bottom: 1.25rem !important;
}

/* Close Button Styling - High contrast in both light & dark mode */
.act-modal-close-btn {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35) !important;
  font-weight: 800 !important;
  opacity: 1 !important;
}

.act-modal-close-btn:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
  color: #ffffff !important;
}

.act-modal-close-btn * {
  color: #ffffff !important;
}

/* Light Mode Input Styling - High Contrast & Clean Borders */
.light-mode-input {
  background-color: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03) !important;
}
.light-mode-input:focus {
  background-color: #ffffff !important;
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
}

/* Dark Mode Input Styling */
.dark-mode-input {
  background-color: #2b2b36 !important;
  border: 1px solid #475569 !important;
  color: #ffffff !important;
}
.dark-mode-input:focus {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
}

/* Input Padding & Dimensions Overriding Bootstrap/Global Resets */
.act-input {
  padding-left: 3.25rem !important; /* 52px left padding for search icon */
  padding-right: 2.5rem !important;
  height: 44px !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  font-size: 13px !important;
}

.act-select {
  padding-left: 1.5rem !important; /* 24px left padding so dropdown text sits well away from left border */
  padding-right: 3rem !important; /* 48px right padding for arrow */
  height: 44px !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  font-size: 13px !important;
}

.act-date-input {
  padding-left: 1.5rem !important; /* 24px left padding so date text sits well away from left border */
  padding-right: 1.5rem !important;
  height: 44px !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  font-size: 13px !important;
}

/* Reset button styling prominent in BOTH light & dark modes */
.act-reset-btn {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
  border-radius: 8px !important;
  font-weight: 700 !important;
}

.act-reset-btn:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
}

/* Custom styled scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #0284c7;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #0369a1;
}
</style>
