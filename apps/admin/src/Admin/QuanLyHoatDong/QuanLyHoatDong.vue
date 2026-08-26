<script setup lang="ts">
import { ref, onMounted, computed, watch, reactive } from 'vue'
import { 
  Search, 
  Trash2, 
  Calendar, 
  X, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  RotateCcw,
  Clock,
  User,
  ShieldAlert,
  FileText,
  Eye,
  Layers,
  ArrowRight
} from 'lucide-vue-next'

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
const startDate = ref('')
const endDate = ref('')

const rawLogs = ref<ActivityLog[]>([])

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

// Clear Dialog State
const showClearDialog = ref(false)

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})
const showSnackbar = (text: string, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

interface ParsedChangeItem {
  field: string;
  oldVal: string;
  newVal: string;
  isDiff: boolean;
}

// Smart parser for activity log detail text
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

// Dynamic & comprehensive module options
const moduleOptions = computed(() => {
  const fromLogs = Array.from(new Set(rawLogs.value.map(l => (l.module || '').trim()).filter(Boolean)))
  const defaults = [
    'Hóa đơn',
    'Khách hàng',
    'Hỗ trợ khách hàng',
    'Dịch vụ',
    'Sản phẩm',
    'Quản lý kho',
    'Lương',
    'Điểm danh',
    'Ca làm',
    'Đánh giá',
    'Khuyến mãi',
    'Voucher',
    'Nhân sự',
    'Kiểu & Màu tóc',
    'Nhà cung cấp',
    'Thông báo',
    'Tài khoản',
    'Check-in / Check-out',
    'Đối soát',
    'Danh mục'
  ]
  const allModules = Array.from(new Set([...fromLogs, ...defaults])).filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'))
  return [
    { value: '', label: 'Tất cả phân hệ' },
    ...allModules.map(m => ({ value: m, label: m }))
  ]
})

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

// Filtered and searched logs with precise, robust module matching
const filteredLogs = computed(() => {
  return rawLogs.value.filter(log => {
    // Search filter
    const matchesSearch = !searchQuery.value.trim() || 
      log.username.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      log.role.toLowerCase().includes(searchQuery.value.toLowerCase())

    // Precise Module filter
    let matchesModule = true
    if (selectedModule.value) {
      const sel = selectedModule.value.trim().toLowerCase()
      const logMod = (log.module || '').trim().toLowerCase()

      if (logMod === sel) {
        matchesModule = true
      } else if (sel === 'khách hàng') {
        matchesModule = logMod === 'khách hàng' || logMod === 'quản lý khách hàng'
      } else if (sel === 'hỗ trợ khách hàng') {
        matchesModule = logMod === 'hỗ trợ khách hàng' || logMod.includes('hỗ trợ') || logMod.includes('chat')
      } else if (sel === 'điểm danh') {
        matchesModule = logMod === 'điểm danh'
      } else if (sel === 'ca làm') {
        matchesModule = logMod === 'ca làm' || logMod === 'ca làm việc'
      } else if (sel === 'quản lý kho') {
        matchesModule = logMod === 'quản lý kho' || logMod === 'kho'
      } else if (sel === 'lương') {
        matchesModule = logMod === 'lương' || logMod === 'bảng lương' || logMod === 'quản lý lương'
      } else {
        matchesModule = logMod.includes(sel) || sel.includes(logMod)
      }
    }

    // Status filter
    const matchesStatus = !selectedStatus.value || log.status === selectedStatus.value

    // Date range filter
    let matchesDate = true
    if (startDate.value) {
      const start = new Date(startDate.value + 'T00:00:00')
      const logDate = new Date(log.timestamp)
      if (!isNaN(start.getTime()) && !isNaN(logDate.getTime())) {
        matchesDate = matchesDate && logDate >= start
      }
    }
    if (endDate.value) {
      const end = new Date(endDate.value + 'T23:59:59')
      const logDate = new Date(log.timestamp)
      if (!isNaN(end.getTime()) && !isNaN(logDate.getTime())) {
        matchesDate = matchesDate && logDate <= end
      }
    }

    return matchesSearch && matchesModule && matchesStatus && matchesDate
  })
})

// Pagination
const currentPage = ref(1)
const perPage = ref(10)

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredLogs.value.length / perPage.value))
})

const pagedLogs = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredLogs.value.slice(start, start + perPage.value)
})

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

const getInitials = (name: string) => {
  if (!name) return 'AD'
  const parts = name.trim().split(' ')
  if (parts.length === 1 && parts[0]) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  const first = parts[parts.length - 2]?.substring(0, 1) || ''
  const second = parts[parts.length - 1]?.substring(0, 1) || ''
  return (first + second).toUpperCase() || 'AD'
}

const getModuleColor = (module: string) => {
  const modLower = (module || '').toLowerCase().trim()
  if (modLower === 'hỗ trợ khách hàng') return 'indigo'
  if (modLower.includes('nhân sự') || modLower.includes('chức vụ')) return 'info'
  if (modLower.includes('lương')) return 'success'
  if (modLower.includes('tài khoản')) return 'primary'
  if (modLower.includes('dịch vụ') || modLower.includes('combo')) return 'purple'
  if (modLower === 'điểm danh') return 'cyan'
  if (modLower.includes('ca làm')) return 'blue'
  if (modLower.includes('hóa đơn') || modLower.includes('thanh toán')) return 'teal'
  if (modLower === 'khách hàng') return 'light-blue'
  if (modLower.includes('sản phẩm') || modLower.includes('kho')) return 'warning'
  if (modLower.includes('voucher') || modLower.includes('khuyến mãi') || modLower.includes('sale')) return 'pink'
  if (modLower.includes('đánh giá')) return 'amber'
  if (modLower.includes('thông báo')) return 'deep-purple'
  if (modLower.includes('nhà cung cấp')) return 'orange'
  if (modLower.includes('kiểu') || modLower.includes('màu tóc')) return 'lime-darken-3'
  if (modLower.includes('check-in') || modLower.includes('check-out')) return 'light-green-darken-2'
  if (modLower.includes('đối soát')) return 'deep-orange'
  if (modLower.includes('danh mục')) return 'brown'
  return 'blue-grey'
}

// Clear all logs
const handleConfirmClear = () => {
  rawLogs.value = []
  localStorage.setItem('lghair_activities', '[]')
  showClearDialog.value = false
  showSnackbar("Đã dọn sạch toàn bộ nhật ký hoạt động!", "success")
}

const resetFilters = () => {
  searchQuery.value = ''
  selectedModule.value = ''
  selectedStatus.value = ''
  startDate.value = ''
  endDate.value = ''
  loadLogs()
}

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <div class="d-flex flex-column gap-6 w-100">
      
      <!-- Snackbar -->
      <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" :timeout="3000">
        {{ snackbar.text }}
        <template v-slot:actions>
          <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
            <X class="w-4 h-4" />
          </v-btn>
        </template>
      </v-snackbar>

      <!-- ── HEADER BANNER CARD ── -->
      <v-card width="100%" elevation="2" rounded="xl" class="pa-6">
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
          <div class="d-flex align-center gap-3">
            <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
              <Activity class="w-6 h-6 text-primary" />
            </v-avatar>
            <div>
              <div class="d-flex align-center gap-2">
                <h2 class="text-h5 font-weight-bold mb-0">Nhật Ký Hoạt Động</h2>
                <v-chip size="x-small" color="primary" variant="tonal" class="font-weight-bold">
                  LGHair Admin
                </v-chip>
              </div>
              <div class="text-subtitle-2 text-medium-emphasis mt-1">
                Theo dõi, truy vết và ghi nhận lịch sử thao tác hệ thống tự động
              </div>
            </div>
          </div>

          <div class="d-flex align-center gap-2 flex-wrap">
            <v-btn
              variant="outlined"
              color="grey-darken-1"
              rounded="lg"
              class="text-none font-weight-bold"
              height="40"
              :loading="isLoading"
              @click="loadLogs"
            >
              <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
              Làm mới
            </v-btn>

            <v-btn
              color="error"
              variant="tonal"
              rounded="lg"
              class="text-none font-weight-bold"
              height="40"
              :disabled="rawLogs.length === 0"
              @click="showClearDialog = true"
            >
              <template v-slot:prepend><Trash2 class="w-4 h-4 mr-1" /></template>
              Dọn sạch nhật ký
            </v-btn>
          </div>
        </div>
      </v-card>

      <!-- ── KPI STATS CARDS ── -->
      <v-row dense>
        <!-- Card 1: Today Logs -->
        <v-col cols="12" sm="6" md="3">
          <v-card elevation="1" rounded="xl" class="pa-5 border">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Hoạt động hôm nay</div>
                <div class="d-flex align-baseline gap-2 mt-1">
                  <span class="text-h4 font-weight-bold font-mono">{{ stats.today }}</span>
                  <span class="text-caption text-medium-emphasis">bản ghi</span>
                </div>
              </div>
              <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
                <Activity class="w-6 h-6 text-primary" />
              </v-avatar>
            </div>
          </v-card>
        </v-col>

        <!-- Card 2: Total Logs -->
        <v-col cols="12" sm="6" md="3">
          <v-card elevation="1" rounded="xl" class="pa-5 border">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Tổng số hoạt động</div>
                <div class="d-flex align-baseline gap-2 mt-1">
                  <span class="text-h4 font-weight-bold font-mono">{{ stats.total }}</span>
                  <span class="text-caption text-medium-emphasis">thao tác</span>
                </div>
              </div>
              <v-avatar color="info" variant="tonal" size="48" rounded="lg">
                <FileText class="w-6 h-6 text-info" />
              </v-avatar>
            </div>
          </v-card>
        </v-col>

        <!-- Card 3: Success Logs -->
        <v-col cols="12" sm="6" md="3">
          <v-card elevation="1" rounded="xl" class="pa-5 border">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Thành công</div>
                <div class="d-flex align-baseline gap-2 mt-1">
                  <span class="text-h4 font-weight-bold font-mono text-success">{{ stats.success }}</span>
                  <span class="text-caption text-medium-emphasis">được duyệt</span>
                </div>
              </div>
              <v-avatar color="success" variant="tonal" size="48" rounded="lg">
                <CheckCircle2 class="w-6 h-6 text-success" />
              </v-avatar>
            </div>
          </v-card>
        </v-col>

        <!-- Card 4: Failed Logs -->
        <v-col cols="12" sm="6" md="3">
          <v-card elevation="1" rounded="xl" class="pa-5 border">
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase">Thất bại / Bị chặn</div>
                <div class="d-flex align-baseline gap-2 mt-1">
                  <span class="text-h4 font-weight-bold font-mono text-error">{{ stats.failed }}</span>
                  <span class="text-caption text-medium-emphasis">cảnh báo</span>
                </div>
              </div>
              <v-avatar color="error" variant="tonal" size="48" rounded="lg">
                <ShieldAlert class="w-6 h-6 text-error" />
              </v-avatar>
            </div>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── FILTERS & TOOLBAR ── -->
      <v-card variant="outlined" rounded="xl" class="pa-4 bg-surface">
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
          <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
            <!-- Search -->
            <v-text-field
              v-model="searchQuery"
              placeholder="Tìm theo người thực hiện, thao tác, chi tiết..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="min-width: 280px; max-width: 360px;"
            >
              <template v-slot:prepend-inner>
                <Search class="w-4 h-4 text-medium-emphasis mr-1" />
              </template>
            </v-text-field>

            <!-- Module Filter -->
            <v-select
              v-model="selectedModule"
              :items="moduleOptions"
              item-title="label"
              item-value="value"
              label="Phân hệ"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 200px;"
            ></v-select>

            <!-- Status Filter -->
            <v-select
              v-model="selectedStatus"
              :items="[
                { label: 'Tất cả trạng thái', value: '' },
                { label: 'Thành công', value: 'Thành công' },
                { label: 'Thất bại', value: 'Thất bại' }
              ]"
              item-title="label"
              item-value="value"
              label="Trạng thái"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="width: 170px;"
            ></v-select>

            <!-- Date Range -->
            <v-text-field
              v-model="startDate"
              type="date"
              label="Từ ngày"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="width: 155px;"
            ></v-text-field>

            <v-text-field
              v-model="endDate"
              type="date"
              label="Đến ngày"
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="width: 155px;"
            ></v-text-field>
          </div>

          <v-btn
            variant="text"
            color="primary"
            rounded="lg"
            class="text-none font-weight-bold"
            height="40"
            @click="resetFilters"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Đặt lại lọc
          </v-btn>
        </div>
      </v-card>

      <!-- ── LOGS DATA TABLE ── -->
      <v-card variant="outlined" rounded="xl" class="overflow-hidden">
        <div v-if="isLoading" class="d-flex justify-center align-center py-16">
          <v-progress-circular indeterminate color="primary" size="48" />
        </div>

        <div v-else class="overflow-x-auto">
          <v-table hover>
            <thead>
              <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="font-weight-bold text-caption text-left py-3" style="width: 170px;">THỜI GIAN</th>
                <th class="font-weight-bold text-caption text-left py-3" style="width: 220px;">NGƯỜI THỰC HIỆN</th>
                <th class="font-weight-bold text-caption text-left py-3" style="width: 160px;">PHÂN HỆ</th>
                <th class="font-weight-bold text-caption text-left py-3" style="width: 220px;">THAO TÁC</th>
                <th class="font-weight-bold text-caption text-left py-3" style="min-width: 260px;">CHI TIẾT VẮN TẮT</th>
                <th class="font-weight-bold text-caption text-center py-3" style="width: 130px;">TRẠNG THÁI</th>
                <th class="font-weight-bold text-caption text-center py-3" style="width: 100px;">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="log in pagedLogs"
                :key="log.id"
                class="border-b cursor-pointer"
                @click="openLogDetail(log)"
              >
                <!-- Timestamp -->
                <td class="text-caption font-mono text-medium-emphasis">
                  <div class="d-flex align-center gap-1.5">
                    <Clock class="w-3.5 h-3.5 text-medium-emphasis" />
                    {{ formatDate(log.timestamp) }}
                  </div>
                </td>

                <!-- User & Role -->
                <td>
                  <div class="d-flex align-center gap-3">
                    <v-avatar color="primary" variant="tonal" size="36" rounded="lg" class="font-weight-bold text-caption">
                      {{ getInitials(log.username) }}
                    </v-avatar>
                    <div>
                      <div class="font-weight-bold text-body-2">{{ log.username }}</div>
                      <div class="text-caption text-medium-emphasis">{{ log.role }}</div>
                    </div>
                  </div>
                </td>

                <!-- Module -->
                <td>
                  <v-chip size="small" :color="getModuleColor(log.module)" variant="tonal" class="font-weight-bold text-caption">
                    {{ log.module }}
                  </v-chip>
                </td>

                <!-- Action -->
                <td>
                  <div class="font-weight-bold text-body-2">{{ log.action }}</div>
                </td>

                <!-- Short Details -->
                <td>
                  <div class="text-caption text-medium-emphasis text-truncate font-italic" style="max-width: 320px;" :title="log.details">
                    {{ log.details.split('\n')[0] }}
                  </div>
                </td>

                <!-- Status -->
                <td class="text-center">
                  <v-chip
                    size="small"
                    :color="log.status === 'Thành công' ? 'success' : 'error'"
                    variant="tonal"
                    class="font-weight-bold text-caption text-uppercase"
                  >
                    <template v-slot:prepend>
                      <CheckCircle2 v-if="log.status === 'Thành công'" class="w-3.5 h-3.5 mr-1" />
                      <XCircle v-else class="w-3.5 h-3.5 mr-1" />
                    </template>
                    {{ log.status }}
                  </v-chip>
                </td>

                <!-- Actions -->
                <td class="text-center" @click.stop>
                  <v-btn
                    variant="outlined"
                    color="primary"
                    size="small"
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="openLogDetail(log)"
                  >
                    Chi tiết
                  </v-btn>
                </td>
              </tr>

              <tr v-if="pagedLogs.length === 0">
                <td colspan="7" class="text-center py-16 text-medium-emphasis">
                  <Activity class="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-50" />
                  <div class="font-weight-bold text-body-2">Không tìm thấy nhật ký hoạt động nào phù hợp</div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <!-- Pagination -->
        <v-divider></v-divider>
        <div class="pa-4 d-flex align-center justify-space-between flex-wrap gap-2">
          <div class="text-caption text-medium-emphasis">
            Hiển thị <strong class="text-high-emphasis">{{ pagedLogs.length }}</strong> trên tổng số <strong class="text-high-emphasis">{{ filteredLogs.length }}</strong> hoạt động
          </div>
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="5"
            density="comfortable"
            rounded="lg"
            size="small"
          ></v-pagination>
        </div>
      </v-card>

      <!-- ── DETAIL DIALOG ── -->
      <v-dialog v-model="showDetailModal" max-width="640px" scrollable>
        <v-card v-if="selectedLogDetail" rounded="xl" class="overflow-hidden">
          <!-- Header -->
          <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
            <div class="d-flex align-center gap-3">
              <v-avatar
                :color="selectedLogDetail.status === 'Thành công' ? 'success' : 'error'"
                variant="tonal"
                size="44"
                rounded="lg"
              >
                <component
                  :is="selectedLogDetail.status === 'Thành công' ? CheckCircle2 : ShieldAlert"
                  class="w-5 h-5"
                />
              </v-avatar>
              <div>
                <h3 class="text-h6 font-weight-bold mb-0">Chi Tiết Hoạt Động</h3>
                <div class="text-caption font-mono text-medium-emphasis">ID: {{ selectedLogDetail.id }}</div>
              </div>
            </div>
            <v-btn icon variant="text" density="comfortable" @click="closeLogDetail">
              <X class="w-5 h-5" />
            </v-btn>
          </v-card-title>

          <!-- Body -->
          <v-card-text class="pa-6 d-flex flex-column gap-4">
            <!-- Metadata Row -->
            <v-row dense>
              <v-col cols="12" sm="6">
                <v-card variant="tonal" rounded="lg" class="pa-3">
                  <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-1">Người thực hiện</div>
                  <div class="font-weight-bold text-body-2">{{ selectedLogDetail.username }}</div>
                  <div class="text-caption text-medium-emphasis">{{ selectedLogDetail.role }}</div>
                </v-card>
              </v-col>
              <v-col cols="12" sm="6">
                <v-card variant="tonal" rounded="lg" class="pa-3">
                  <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-1">Thời gian ghi nhận</div>
                  <div class="font-weight-bold text-body-2 font-mono">{{ formatDate(selectedLogDetail.timestamp) }}</div>
                  <div class="mt-1">
                    <v-chip size="x-small" :color="getModuleColor(selectedLogDetail.module)" variant="flat" class="font-weight-bold mr-1">
                      {{ selectedLogDetail.module }}
                    </v-chip>
                    <v-chip size="x-small" :color="selectedLogDetail.status === 'Thành công' ? 'success' : 'error'" variant="flat" class="font-weight-bold">
                      {{ selectedLogDetail.status }}
                    </v-chip>
                  </div>
                </v-card>
              </v-col>
            </v-row>

            <!-- Action Name -->
            <div>
              <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-1">Hành động</div>
              <v-text-field
                :model-value="selectedLogDetail.action"
                variant="outlined"
                density="compact"
                readonly
                rounded="lg"
                hide-details
              ></v-text-field>
            </div>

            <!-- Structured Changes / Details -->
            <div>
              <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-2">Chi tiết thay đổi</div>

              <!-- If we have parsed diff items -->
              <div v-if="logDetailParsed.items.length > 0" class="d-flex flex-column gap-2">
                <div v-if="logDetailParsed.title" class="text-caption font-weight-bold text-high-emphasis mb-1">
                  {{ logDetailParsed.title }}
                </div>

                <v-card
                  v-for="(item, idx) in logDetailParsed.items"
                  :key="idx"
                  variant="outlined"
                  rounded="lg"
                  class="pa-3"
                >
                  <div class="d-flex align-center justify-space-between mb-1">
                    <span class="text-caption font-weight-bold text-primary">{{ item.field }}</span>
                  </div>

                  <div v-if="item.isDiff" class="d-flex align-center gap-2 flex-wrap">
                    <v-chip size="small" color="error" variant="tonal" class="text-caption text-decoration-line-through">
                      {{ item.oldVal }}
                    </v-chip>
                    <ArrowRight class="w-4 h-4 text-medium-emphasis" />
                    <v-chip size="small" color="success" variant="tonal" class="text-caption font-weight-bold">
                      {{ item.newVal }}
                    </v-chip>
                  </div>
                  <div v-else class="text-body-2 font-weight-medium">
                    {{ item.newVal }}
                  </div>
                </v-card>
              </div>

              <!-- Fallback to plain textarea -->
              <v-textarea
                v-else
                :model-value="selectedLogDetail.details"
                variant="outlined"
                density="compact"
                readonly
                rounded="lg"
                rows="4"
                hide-details
              ></v-textarea>
            </div>
          </v-card-text>

          <!-- Footer -->
          <v-divider></v-divider>
          <v-card-actions class="pa-4 justify-end">
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold px-5" @click="closeLogDetail">
              Đóng
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>

      <!-- ── CONFIRM CLEAR DIALOG ── -->
      <v-dialog v-model="showClearDialog" max-width="440px">
        <v-card rounded="xl" class="pa-6">
          <div class="d-flex align-center gap-3 mb-4">
            <v-avatar color="error" variant="tonal" size="48" rounded="lg">
              <Trash2 class="w-6 h-6 text-error" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">Xác Nhận Dọn Dẹp?</h3>
              <p class="text-caption text-medium-emphasis mb-0">Hành động không thể hoàn tác</p>
            </div>
          </div>

          <p class="text-body-2 mb-6 text-medium-emphasis">
            Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký hoạt động này khỏi hệ thống không?
          </p>

          <div class="d-flex justify-end gap-2">
            <v-btn
              variant="outlined"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="showClearDialog = false"
            >
              Hủy bỏ
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              rounded="lg"
              class="text-none font-weight-bold text-white"
              @click="handleConfirmClear"
            >
              Đồng ý xóa
            </v-btn>
          </div>
        </v-card>
      </v-dialog>

    </div>
  </v-container>
</template>
