<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
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
  Eye
} from 'lucide-vue-next'
import Swal from 'sweetalert2'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'

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

const customizer = useCustomizerStore()

// ── Theme State Detection (Light / Dark Mode Sync) ──
const isDarkMode = computed(() => {
  if (customizer?.actTheme === 'dark') return true
  try {
    const vuetifyTheme = useTheme()
    if (vuetifyTheme?.global?.name?.value === 'dark' || vuetifyTheme?.global?.current?.value?.dark) {
      return true
    }
  } catch (e) {}
  return localStorage.getItem('theme_selection') === 'dark' 
      || localStorage.getItem('actTheme') === 'dark'
      || document.documentElement.classList.contains('dark') 
      || document.body.classList.contains('v-theme--dark')
})

const isLoading = ref(false)
const searchQuery = ref('')
const selectedModule = ref('')
const selectedStatus = ref('')
const startDate = ref('')
const endDate = ref('')

const rawLogs = ref<ActivityLog[]>([])

// Generate realistic dummy logs if localStorage is empty
const generateDummyLogs = () => {
  const dummy: ActivityLog[] = [
    {
      id: 'act1',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon',
      action: 'In phiếu lương',
      details: 'Đã in phiếu lương chi tiết cho nhân viên Nguyễn Minh Tâm (Mã: NV002) - Tháng 7/2026',
      module: 'Lương',
      status: 'Thành công'
    },
    {
      id: 'act2',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon',
      action: 'Cập nhật nhân viên',
      details: 'Đã cập nhật thông tin nhân viên Đinh Hoàng Phúc (Mã: NV001) - Cập nhật ô lương cơ bản',
      module: 'Nhân sự',
      status: 'Thành công'
    },
    {
      id: 'act3',
      timestamp: new Date(Date.now() - 1000 * 3600 * 2).toISOString(), // 2 hours ago
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Sửa hồ sơ tài khoản',
      details: 'Đã cập nhật thông tin cá nhân tài khoản Nguyễn Minh Tâm (Mã: NV002)',
      module: 'Tài khoản',
      status: 'Thành công'
    },
    {
      id: 'act4',
      timestamp: new Date(Date.now() - 1000 * 3600 * 4).toISOString(), // 4 hours ago
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon',
      action: 'Xuất Excel bảng lương',
      details: 'Đã xuất thành công tệp Excel bảng lương Tháng 7/2026 (5 nhân viên)',
      module: 'Lương',
      status: 'Thành công'
    },
    {
      id: 'act5',
      timestamp: new Date(Date.now() - 1000 * 3600 * 24).toISOString(), // 1 day ago
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon',
      action: 'Thêm nhân viên mới',
      details: 'Đã thêm tài khoản nhân viên Ronaldo (Mã: NV004) - Chức vụ: Stylist chính',
      module: 'Nhân sự',
      status: 'Thành công'
    },
    {
      id: 'act6',
      timestamp: new Date(Date.now() - 1000 * 3600 * 26).toISOString(), // 1 day ago
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Xếp ca làm việc',
      details: 'Xếp lịch làm việc ca Sáng cho nhân viên Phạm Quang Thọ ngày 02/07/2026',
      module: 'Ca làm',
      status: 'Thành công'
    },
    {
      id: 'act7',
      timestamp: new Date(Date.now() - 1000 * 3600 * 48).toISOString(), // 2 days ago
      username: 'Nguyễn Minh Tâm',
      role: 'Stylist chính / Quản lý',
      action: 'Xóa nhân viên',
      details: 'Xóa thất bại nhân viên Trần Văn B (Mã: NV099) - Lý do: Nhân viên đã có dữ liệu lịch đặt',
      module: 'Nhân sự',
      status: 'Thất bại'
    },
    {
      id: 'act8',
      timestamp: new Date(Date.now() - 1000 * 3600 * 72).toISOString(), // 3 days ago
      username: 'Đinh Hoàng Phúc',
      role: 'Chủ Salon',
      action: 'Cập nhật dịch vụ',
      details: 'Đã chỉnh sửa giá dịch vụ "Cắt tạo kiểu uốn Hàn Quốc" từ 350.000đ thành 380.000đ',
      module: 'Dịch vụ',
      status: 'Thành công'
    }
  ]
  return dummy
}

const loadLogs = () => {
  isLoading.value = true
  try {
    const stored = localStorage.getItem('lghair_activities')
    if (stored) {
      rawLogs.value = JSON.parse(stored)
    } else {
      const dummy = generateDummyLogs()
      rawLogs.value = dummy
      localStorage.setItem('lghair_activities', JSON.stringify(dummy))
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
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
    const matchesModule = !selectedModule.value || log.module === selectedModule.value

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
  return Math.ceil(filteredLogs.value.length / perPage.value)
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
  const d = date.getDate().toString().padStart(2, '0')
  const m = (date.getMonth() + 1).toString().padStart(2, '0')
  const y = date.getFullYear()
  const h = date.getHours().toString().padStart(2, '0')
  const min = date.getMinutes().toString().padStart(2, '0')
  const sec = date.getSeconds().toString().padStart(2, '0')
  return `${d}/${m}/${y} ${h}:${min}:${sec}`
}

const getModuleBadgeColor = (module: string) => {
  switch (module) {
    case 'Nhân sự':
      return 'primary'
    case 'Lương':
      return 'success'
    case 'Tài khoản':
      return 'info'
    case 'Dịch vụ':
      return 'deep-purple-accent-2'
    case 'Ca làm':
      return 'warning'
    default:
      return 'grey'
  }
}

const clearLogs = () => {
  Swal.fire({
    title: 'Xác nhận xóa?',
    text: 'Bạn có chắc chắn muốn xóa toàn bộ nhật ký hoạt động này không?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#0F172A',
    cancelButtonColor: '#64748b',
    confirmButtonText: 'Đồng ý xóa',
    cancelButtonText: 'Hủy bỏ',
    background: isDarkMode.value ? '#1b1b28' : '#ffffff',
    color: isDarkMode.value ? '#ffffff' : '#000000',
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
        background: isDarkMode.value ? '#1b1b28' : '#ffffff',
        color: isDarkMode.value ? '#ffffff' : '#000000',
      })
    }
  })
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

const moduleOptions = [
  { title: 'Tất cả phân hệ', value: '' },
  { title: 'Nhân sự', value: 'Nhân sự' },
  { title: 'Lương', value: 'Lương' },
  { title: 'Tài khoản', value: 'Tài khoản' },
  { title: 'Dịch vụ', value: 'Dịch vụ' },
  { title: 'Ca làm', value: 'Ca làm' },
]

const statusOptions = [
  { title: 'Tất cả trạng thái', value: '' },
  { title: 'Thành công', value: 'Thành công' },
  { title: 'Thất bại', value: 'Thất bại' },
]

</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" :class="isDarkMode ? 'bg-[#141416]' : 'bg-slate-50'" style="min-height: 100vh;">
    
    <!-- CARD 1: Header + Stats + Filters -->
    <v-card width="100%" elevation="2" rounded="xl" :color="isDarkMode ? '#1e1e2d' : undefined" class="mb-6">
      
      <!-- Header Area -->
      <v-card-title class="d-flex flex-column flex-lg-row align-lg-center justify-space-between pa-6" style="white-space: normal;">
        <div class="d-flex align-center gap-4">
          <v-avatar size="64" color="primary" variant="tonal" rounded="lg">
            <Activity class="w-8 h-8" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1" :class="isDarkMode ? 'text-white' : 'text-slate-900'">Nhật Ký Hoạt Động</h2>
            <div class="text-subtitle-2" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">Hệ thống tự động ghi nhận và lưu vết hoạt động vận hành salon Minh Tâm.</div>
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-lg-0 flex-wrap">
          <v-btn 
            color="error" 
            variant="flat" 
            prepend-icon="mdi-delete"
            @click="clearLogs"
            :disabled="rawLogs.length === 0"
            height="48"
            rounded="lg"
            class="font-weight-bold text-none"
          >
            Dọn sạch nhật ký
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Quick Stats -->
      <v-card-text class="pa-6 pb-2">
        <v-row class="mb-4">
          <v-col cols="12" sm="6" md="3">
            <div class="d-flex flex-column px-4 py-3 rounded-lg border" :class="isDarkMode ? 'bg-[#252536] border-slate-700' : 'bg-white border-slate-200'">
              <div class="text-[10px] font-weight-black text-uppercase mb-1 tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">HOẠT ĐỘNG HÔM NAY</div>
              <div class="text-h4 font-weight-black d-flex align-end gap-1" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                {{ stats.today }} <span class="text-caption font-weight-bold mb-1 opacity-70">mục</span>
              </div>
            </div>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <div class="d-flex flex-column px-4 py-3 rounded-lg border" :class="isDarkMode ? 'bg-[#252536] border-slate-700' : 'bg-white border-slate-200'">
              <div class="text-[10px] font-weight-black text-uppercase mb-1 tracking-wider" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">TỔNG GHI NHẬN</div>
              <div class="text-h4 font-weight-black d-flex align-end gap-1" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                {{ stats.total }} <span class="text-caption font-weight-bold mb-1 opacity-70">mục</span>
              </div>
            </div>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <div class="d-flex flex-column px-4 py-3 rounded-lg border" :class="isDarkMode ? 'bg-[#252536] border-slate-700' : 'bg-white border-slate-200'">
              <div class="text-[10px] font-weight-black text-uppercase mb-1 tracking-wider text-success">THÀNH CÔNG</div>
              <div class="text-h4 font-weight-black text-success">{{ stats.success }}</div>
            </div>
          </v-col>
          <v-col cols="12" sm="6" md="3">
            <div class="d-flex flex-column px-4 py-3 rounded-lg border" :class="isDarkMode ? 'bg-[#252536] border-slate-700' : 'bg-white border-slate-200'">
              <div class="text-[10px] font-weight-black text-uppercase mb-1 tracking-wider text-error">THẤT BẠI / LỖI</div>
              <div class="text-h4 font-weight-black text-error">{{ stats.failed }}</div>
            </div>
          </v-col>
        </v-row>

        <!-- Filters -->
        <v-row>
          <v-col cols="12" md="6" lg="3">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">TÌM KIẾM NHẬT KÝ</div>
            <v-text-field
              v-model="searchQuery"
              placeholder="Tìm người, mô tả..."
              variant="outlined"
              density="comfortable"
              hide-details
              rounded="lg"
              clearable
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey" />
              </template>
            </v-text-field>
          </v-col>
          
          <v-col cols="12" md="6" lg="2">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">PHÂN HỆ</div>
            <v-select
              v-model="selectedModule"
              :items="moduleOptions"
              variant="outlined"
              density="comfortable"
              hide-details
              rounded="lg"
            ></v-select>
          </v-col>
          
          <v-col cols="12" md="6" lg="2">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">TRẠNG THÁI</div>
            <v-select
              v-model="selectedStatus"
              :items="statusOptions"
              variant="outlined"
              density="comfortable"
              hide-details
              rounded="lg"
            ></v-select>
          </v-col>

          <v-col cols="12" md="6" lg="2">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">TỪ NGÀY</div>
            <v-text-field
              v-model="startDate"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
              rounded="lg"
            ></v-text-field>
          </v-col>

          <v-col cols="12" md="6" lg="2">
            <div class="text-caption font-weight-bold mb-2 text-uppercase" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">ĐẾN NGÀY</div>
            <v-text-field
              v-model="endDate"
              type="date"
              variant="outlined"
              density="comfortable"
              hide-details
              rounded="lg"
            ></v-text-field>
          </v-col>
          
          <v-col cols="12" md="1" lg="1" class="d-flex align-end">
            <v-btn 
              color="primary" 
              variant="tonal" 
              height="48" 
              block 
              rounded="lg"
              @click="resetFilters"
              class="font-weight-bold"
            >
              <RefreshCw class="w-5 h-5" />
            </v-btn>
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>

    <!-- CARD 2: Table + Pagination -->
    <v-card width="100%" elevation="2" rounded="xl" :color="isDarkMode ? '#1e1e2d' : undefined">
      <div v-if="isLoading" class="d-flex flex-column align-center justify-center py-12">
        <v-progress-circular indeterminate color="primary" size="40" class="mb-3"></v-progress-circular>
        <div class="text-caption font-weight-bold text-primary text-uppercase">Đang tải nhật ký hoạt động...</div>
      </div>
      
      <v-table v-else hover class="border-top overflow-hidden" :class="isDarkMode ? 'bg-[#1e1e2d]' : ''">
        <thead :class="isDarkMode ? 'bg-[#252536]' : 'bg-slate-50 border-b border-slate-200'">
          <tr>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Thời Gian</th>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Người Thực Hiện</th>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Hành Động</th>
            <th class="text-left py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Chi Tiết Thao Tác</th>
            <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Phân Hệ</th>
            <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Trạng Thái</th>
            <th class="text-center py-4 px-6 font-weight-bold text-uppercase" :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'">Chi Tiết</th>
          </tr>
        </thead>
        <tbody>
          <!-- Empty State -->
          <tr v-if="pagedLogs.length === 0">
            <td colspan="6" class="text-center py-12">
              <Activity class="w-10 h-10 mx-auto mb-3 opacity-30 text-medium-emphasis" />
              <div class="text-body-2 font-weight-bold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Không tìm thấy bản ghi nào</div>
              <div class="text-caption" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">Không có hoạt động nào trùng khớp với bộ lọc.</div>
            </td>
          </tr>
          
          <!-- Data Rows -->
          <tr v-for="log in pagedLogs" :key="log.id">
            <td class="py-4 px-6">
              <div class="d-flex align-center gap-2 font-weight-bold text-caption font-mono" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
                <Clock class="w-4 h-4 text-info" />
                <span>{{ formatDate(log.timestamp) }}</span>
              </div>
            </td>
            <td class="py-4 px-6">
              <div class="d-flex align-center gap-3">
                <v-avatar size="44" color="info" variant="tonal" class="font-weight-black border">
                  <User class="w-5 h-5" />
                </v-avatar>
                <div>
                  <div class="font-weight-bold text-body-2" :class="isDarkMode ? 'text-white' : 'text-slate-800'">{{ log.username }}</div>
                  <div class="text-[10px] font-weight-black text-uppercase text-info tracking-wider mt-0.5">{{ log.role }}</div>
                </div>
              </div>
            </td>
            <td class="font-weight-bold text-body-2 py-4 px-6" :class="isDarkMode ? 'text-slate-200' : 'text-slate-900'">{{ log.action }}</td>
            <td class="text-caption font-weight-medium py-4 px-6" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'" style="max-width: 300px;">
              <span class="d-inline-block text-truncate w-100" :title="log.details">{{ log.details }}</span>
            </td>
            <td class="text-center py-4 px-6">
              <span class="font-weight-black text-[11px] text-uppercase tracking-wider" :class="isDarkMode ? 'text-warning' : 'text-[#b45309]'">
                {{ log.module }}
              </span>
            </td>
            <td class="text-center py-4 px-6">
              <div class="d-flex align-center justify-center gap-2" :class="log.status === 'Thành công' ? 'text-success' : 'text-error'">
                <div class="rounded-circle" style="width: 6px; height: 6px;" :class="log.status === 'Thành công' ? 'bg-success' : 'bg-error'"></div>
                <span class="font-weight-bold text-caption">{{ log.status === 'Thành công' ? 'Thành công' : 'Thất bại' }}</span>
              </div>
            </td>
            <td class="text-center py-4 px-6">
              <v-btn icon size="x-small" variant="outlined" color="primary" class="border-slate-300">
                <Eye class="w-4 h-4" />
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination Controls -->
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between pa-4 border-t" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
        <div class="text-caption font-weight-bold mb-3 mb-sm-0" :class="isDarkMode ? 'text-slate-400' : 'text-medium-emphasis'">
          Hiển thị trang <span class="text-primary">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ filteredLogs.length }} mục)
        </div>
        <div class="d-flex align-center gap-1">
          <v-btn variant="outlined" size="small" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">Trước</v-btn>
          <div class="d-flex gap-1 mx-2">
            <v-btn 
              v-for="p in visiblePages" 
              :key="p" 
              :color="currentPage === p ? 'primary' : undefined"
              :variant="currentPage === p ? 'flat' : 'outlined'"
              size="small"
              class="min-w-0 px-2"
              @click="changePage(p)"
            >
              {{ p }}
            </v-btn>
          </div>
          <v-btn variant="outlined" size="small" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">Sau</v-btn>
        </div>
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: #0284c7; border-radius: 4px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: #0369a1; }
</style>
