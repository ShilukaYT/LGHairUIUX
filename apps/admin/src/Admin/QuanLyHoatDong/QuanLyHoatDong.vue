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
  ShieldAlert
} from 'lucide-vue-next'
import Swal from 'sweetalert2'

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

const getModuleBadgeClass = (module: string) => {
  switch (module) {
    case 'Nhân sự':
      return 'bg-[#1677ff]/15 text-[#0F172A] border-[#1677ff]/25'
    case 'Lương':
      return 'bg-emerald-50 text-emerald-600 border-emerald-200'
    case 'Tài khoản':
      return 'bg-blue-50 text-blue-600 border-blue-200'
    case 'Dịch vụ':
      return 'bg-purple-50 text-purple-600 border-purple-200'
    case 'Ca làm':
      return 'bg-amber-50 text-amber-600 border-amber-200'
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200'
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
    cancelButtonText: 'Hủy bỏ'
  }).then((result) => {
    if (result.isConfirmed) {
      rawLogs.value = []
      localStorage.setItem('lghair_activities', '[]')
      Swal.fire({
        icon: 'success',
        title: 'Đã xóa',
        text: 'Đã dọn dẹp sạch nhật ký hoạt động.',
        timer: 1500,
        showConfirmButton: false
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
</script>

<template>
  <div class="activity-container min-h-[calc(100vh-64px)] w-full flex flex-col bg-[#fcfbfc] text-slate-850 overflow-hidden p-4 md:p-6 select-none-print font-sans antialiased relative">
    
    <!-- Decorative Ambient Glows for luxury feel -->
    <div class="absolute top-12 left-1/4 w-[350px] h-[350px] bg-[#1677ff]/8 rounded-full blur-[100px] pointer-events-none -translate-y-1/2"></div>
    <div class="absolute bottom-24 right-1/4 w-[350px] h-[350px] bg-[#1677ff]/5 rounded-full blur-[120px] pointer-events-none translate-y-1/2"></div>

    <!-- Header area -->
    <div class="flex-shrink-0 w-full bg-transparent py-4 px-1 mb-6 print:hidden z-10">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="pl-1">
          <h1 class="text-2xl md:text-3xl font-sans text-[#0F172A] font-black tracking-tight flex items-center gap-3">
            <Activity class="w-8 h-8 text-[#0F172A] flex-shrink-0" />
            <span>NHẬT KÝ HOẠT ĐỘNG</span>
          </h1>
          <p class="text-[10px] text-slate-500 mt-2 font-sans  tracking-wide">
            "Hệ thống tự động ghi nhận và lưu vết hoạt động vận hành salon Minh Tâm."
          </p>
        </div>

        <div class="flex items-center gap-3 w-full sm:w-auto">
          <button 
            @click="clearLogs" 
            :disabled="rawLogs.length === 0"
            class="flex-1 sm:flex-initial h-11 px-4 bg-transparent hover:bg-red-50 text-red-600 text-xs font-bold rounded-md border border-red-200 hover:border-red-400 transition-all cursor-pointer shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div class="flex items-center justify-center gap-2">
              <Trash2 class="w-4 h-4" /> Dọn sạch nhật ký
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 z-10">
      <!-- Card 1: Today Logs -->
      <div class="p-5 rounded-md bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
        <div class="z-10">
          <p class="text-[9px] font-bold text-slate-400 tracking-wider mb-2">HOẠT ĐỘNG HÔM NAY</p>
          <h2 class="text-2xl font-bold text-slate-800 leading-tight font-mono">{{ stats.today }} <span class="text-xs font-sans font-normal text-slate-450">mục</span></h2>
        </div>
        <div class="p-3 bg-slate-50 border border-slate-150 hidden sm:block">
          <Clock class="w-5 h-5 text-[#0F172A]" />
        </div>
      </div>

      <!-- Card 2: Total Logs -->
      <div class="p-5 rounded-md bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
        <div class="z-10">
          <p class="text-[9px] font-bold text-slate-400 tracking-wider mb-2">TỔNG GHI NHẬN</p>
          <h2 class="text-2xl font-bold text-[#0F172A] leading-tight font-mono">{{ stats.total }} <span class="text-xs font-sans font-normal text-slate-450">mục</span></h2>
        </div>
        <div class="p-3 bg-slate-50 border border-slate-150 hidden sm:block">
          <Activity class="w-5 h-5 text-[#0F172A]" />
        </div>
      </div>

      <!-- Card 3: Success Logs -->
      <div class="p-5 rounded-md bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
        <div class="z-10">
          <p class="text-[9px] font-bold text-slate-400 tracking-wider mb-2">THÀNH CÔNG</p>
          <h2 class="text-2xl font-bold text-emerald-600 leading-tight font-mono">{{ stats.success }}</h2>
        </div>
        <div class="p-3 bg-emerald-50 border border-emerald-100 hidden sm:block">
          <CheckCircle2 class="w-5 h-5 text-emerald-600" />
        </div>
      </div>

      <!-- Card 4: Failed Logs -->
      <div class="p-5 rounded-md bg-white border border-slate-150 shadow-none flex items-center justify-between relative overflow-hidden transition-all duration-300 hover:scale-[1.01]">
        <div class="z-10">
          <p class="text-[9px] font-bold text-slate-400 tracking-wider mb-2">THẤT BẠI / CẢNH BÁO</p>
          <h2 class="text-2xl font-bold text-red-600 leading-tight font-mono">{{ stats.failed }}</h2>
        </div>
        <div class="p-3 bg-red-50 border border-red-100 hidden sm:block">
          <ShieldAlert class="w-5 h-5 text-red-600" />
        </div>
      </div>
    </div>

    <!-- Filters Block -->
    <div class="flex-shrink-0 bg-white p-5 border border-slate-150 mb-6 z-10">
      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-2 border-b border-slate-100 pb-2 mb-1">
          <Filter class="w-4 h-4 text-[#0F172A]" />
          <span class="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Bộ lọc tìm kiếm</span>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <!-- Text Search -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Tìm kiếm</label>
            <div class="relative">
              <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                v-model="searchQuery" 
                placeholder="Người thực hiện, mô tả..." 
                class="w-full h-10 pl-9 pr-7 rounded-md border border-slate-200 text-xs font-medium outline-none focus:border-[#0F172A] bg-slate-50 focus:bg-white text-slate-800"
              >
              <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-450 hover:text-slate-700">
                <X class="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <!-- Module Select -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Phân hệ</label>
            <div class="relative flex items-center">
              <select v-model="selectedModule" class="w-full h-10 px-3 rounded-md border border-slate-200 text-xs font-medium outline-none focus:border-[#0F172A] bg-slate-50 appearance-none cursor-pointer text-slate-800">
                <option value="">Tất cả phân hệ</option>
                <option value="Nhân sự">Nhân sự</option>
                <option value="Lương">Lương</option>
                <option value="Tài khoản">Tài khoản</option>
                <option value="Dịch vụ">Dịch vụ</option>
                <option value="Ca làm">Ca làm việc</option>
              </select>
              <span class="pointer-events-none absolute right-3 text-[8px] text-[#0F172A]">▼</span>
            </div>
          </div>

          <!-- Status Select -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Trạng thái</label>
            <div class="relative flex items-center">
              <select v-model="selectedStatus" class="w-full h-10 px-3 rounded-md border border-slate-200 text-xs font-medium outline-none focus:border-[#0F172A] bg-slate-50 appearance-none cursor-pointer text-slate-800">
                <option value="">Tất cả trạng thái</option>
                <option value="Thành công">Thành công</option>
                <option value="Thất bại">Thất bại / Lỗi</option>
              </select>
              <span class="pointer-events-none absolute right-3 text-[8px] text-[#0F172A]">▼</span>
            </div>
          </div>

          <!-- Date filters -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Từ ngày</label>
            <input type="date" v-model="startDate" class="w-full h-10 px-3 rounded-md border border-slate-200 text-xs font-medium outline-none focus:border-[#0F172A] bg-slate-50 text-slate-800">
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase">Đến ngày</label>
            <input type="date" v-model="endDate" class="w-full h-10 px-3 rounded-md border border-slate-200 text-xs font-medium outline-none focus:border-[#0F172A] bg-slate-50 text-slate-800">
          </div>
        </div>

        <div class="flex justify-end gap-3 border-t border-slate-100 pt-3 mt-1">
          <button 
            @click="resetFilters" 
            class="h-9 px-4 text-xs font-bold rounded-md border transition-all cursor-pointer shadow-none hover:opacity-90"
            style="background-color: #1677ff !important; color: #000000 !important; border-color: #1677ff !important;"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </div>
    </div>

    <!-- Table content -->
    <div class="flex-1 w-full bg-white rounded-md border border-slate-150 shadow-none relative overflow-hidden flex flex-col z-10">
      <!-- Loader Overlay -->
      <div v-if="isLoading" class="absolute inset-0 bg-white/85 backdrop-blur-xs z-50 flex items-center justify-center transition-all">
        <div class="flex flex-col items-center gap-3">
          <div class="w-10 h-10 border-2 border-slate-200 border-t-[#0F172A] rounded-full animate-spin"></div>
          <span class="text-[10px] font-bold text-slate-500 tracking-wider">ĐANG NẠP NHẬT KÝ...</span>
        </div>
      </div>

      <!-- Table Body -->
      <div class="flex-grow overflow-auto custom-scrollbar">
        <table class="w-full text-left text-xs border-separate border-spacing-0">
          <thead class="sticky top-0 bg-slate-50/95 backdrop-blur-xs z-10 border-b border-[#1677ff]/20">
            <tr class="border-b border-[#1677ff]/20">
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 w-32 bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Thời Gian</th>
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 w-44 bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Người Thực Hiện</th>
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 w-36 bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Hành Động</th>
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Chi Tiết</th>
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 w-28 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Phân Hệ</th>
              <th class="py-4 px-5 font-bold text-[#0F172A] border-b border-[#1677ff]/20 w-24 text-center bg-slate-50/95 tracking-wider select-none whitespace-nowrap">Kết Quả</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="!isLoading && pagedLogs.length === 0">
              <td colspan="6" class="p-16 text-center text-slate-500">
                <div class="flex flex-col items-center gap-3 max-w-sm mx-auto">
                  <div class="w-12 h-12 bg-slate-50 rounded-md flex items-center justify-center text-slate-400 border border-slate-200 mb-1">
                    <Activity class="w-6 h-6 stroke-[1.5px]" />
                  </div>
                  <p class="font-bold text-slate-800 text-xs">Không tìm thấy bản ghi nào</p>
                  <p class="text-[11px] text-slate-400 leading-relaxed">Không tìm thấy hoạt động nào trùng khớp với bộ lọc tìm kiếm hiện tại của bạn.</p>
                  <button @click="resetFilters" class="mt-2 text-xs font-bold text-[#0F172A] hover:text-[#334155] transition-colors">Đặt lại</button>
                </div>
              </td>
            </tr>

            <tr 
              v-for="log in pagedLogs" 
              :key="log.id"
              class="hover:bg-[#1677ff]/3 border-b border-slate-100 transition-all duration-150"
            >
              <!-- Time -->
              <td class="py-4 px-5 text-slate-450 font-medium font-mono whitespace-nowrap">
                {{ formatDate(log.timestamp) }}
              </td>

              <!-- Actor -->
              <td class="py-4 px-5">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-md bg-slate-50 border border-slate-200 text-[#0F172A] flex items-center justify-center font-bold text-xs">
                    <User class="w-4 h-4" />
                  </div>
                  <div>
                    <div class="font-semibold text-slate-800 text-xs mb-0.5">{{ log.username }}</div>
                    <div class="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{{ log.role }}</div>
                  </div>
                </div>
              </td>

              <!-- Action -->
              <td class="py-4 px-5 font-bold text-slate-700 whitespace-nowrap">
                {{ log.action }}
              </td>

              <!-- Details -->
              <td class="py-4 px-5 text-slate-550 leading-relaxed font-medium">
                {{ log.details }}
              </td>

              <!-- Module Badge -->
              <td class="py-4 px-5 text-center">
                <span 
                  class="inline-flex items-center px-2 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest border"
                  :class="getModuleBadgeClass(log.module)"
                >
                  {{ log.module }}
                </span>
              </td>

              <!-- Status -->
              <td class="py-4 px-5 text-center whitespace-nowrap">
                <span 
                  v-if="log.status === 'Thành công'" 
                  class="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 border border-emerald-100"
                >
                  ● Thành công
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 border border-red-100"
                >
                  ● Thất bại
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div v-if="totalPages > 1" class="flex-shrink-0 bg-slate-50/80 px-6 py-4 flex items-center justify-between border-t border-slate-150 print:hidden">
        <div class="text-[10px] font-bold text-slate-450 uppercase">
          Trang {{ currentPage }} / {{ totalPages }} (Tổng {{ filteredLogs.length }} dòng)
        </div>
        <div class="flex items-center gap-2">
          <button 
            @click="changePage(currentPage - 1)" 
            :disabled="currentPage === 1"
            class="h-8 px-3 text-[11px] font-bold text-slate-650 bg-white border border-slate-200 hover:border-slate-350 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Trước
          </button>
          <div class="flex items-center gap-1">
            <button 
              v-for="p in visiblePages" 
              :key="p" 
              @click="changePage(p)"
              class="w-8 h-8 text-[11px] font-bold transition-all"
              :class="currentPage === p ? 'bg-[#0F172A] text-white border border-[#0F172A]' : 'bg-white text-slate-650 border border-slate-200 hover:border-slate-350'"
            >
              {{ p }}
            </button>
          </div>
          <button 
            @click="changePage(currentPage + 1)" 
            :disabled="currentPage === totalPages"
            class="h-8 px-3 text-[11px] font-bold text-slate-655 bg-white border border-slate-200 hover:border-slate-355 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scoped custom classes for scrollbar */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #f8fafc;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
