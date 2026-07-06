<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { Check, X, LogOut, CalendarDays, AlertTriangle, Clock, MessageSquare } from 'lucide-vue-next'

const filterType = ref('all') // 'all', 'issues'
const API_BASE_URL = 'https://localhost:7196/api/admin/lich-lam-viec'

const nhanViens = ref<any[]>([])
const selectedNhanVien = ref<string>('')

const currentDate = new Date()
const selectedMonth = ref<number>(currentDate.getMonth() + 1)
const selectedYear = ref<number>(currentDate.getFullYear())

const months = Array.from({ length: 12 }, (_, i) => ({ title: `Tháng ${i + 1}`, value: i + 1 }))
const years = computed(() => {
  const current = new Date().getFullYear()
  // Cho phép chọn từ năm ngoái đến năm sau
  return [current - 1, current, current + 1]
})

const isLoading = ref(false)
const lichSuData = ref<any[]>([])

const formatYYYYMMDD = (year: number, month: number, day: number) => {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const fetchLichSu = async () => {
  if (!selectedNhanVien.value) return
  
  isLoading.value = true
  const tuNgay = formatYYYYMMDD(selectedYear.value, selectedMonth.value, 1)
  const lastDay = new Date(selectedYear.value, selectedMonth.value, 0).getDate()
  const denNgay = formatYYYYMMDD(selectedYear.value, selectedMonth.value, lastDay)
  
  try {
    const res = await axios.get(`${API_BASE_URL}/danh-sach`, {
      params: { tuNgay, denNgay }
    })
    if (res.data.success) {
      lichSuData.value = res.data.data.filter((x: any) => x.maNv === selectedNhanVien.value)
    } else {
      lichSuData.value = []
    }
  } catch (e) {
    console.error(e)
    lichSuData.value = []
  } finally {
    isLoading.value = false
  }
}

watch([selectedNhanVien, selectedMonth, selectedYear], () => {
  fetchLichSu()
})

onMounted(async () => {
  isLoading.value = true
  try {
    const res = await axios.get(`${API_BASE_URL}/nhan-vien-hop-le`)
    if (res.data.success) {
      nhanViens.value = res.data.data
      if (nhanViens.value.length > 0) {
        selectedNhanVien.value = nhanViens.value[0].maNv
        // Watcher will automatically trigger fetchLichSu
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    isLoading.value = false
  }
})

const historyMap = computed(() => {
  const map = new Map<string, any>()
  lichSuData.value.forEach(item => map.set(item.ngayLamViec, item))
  return map
})

const stats = computed(() => {
  let v = 0, m = 0, x = 0, c = 0
  lichSuData.value.forEach(item => {
    if (item.caLam === 'Chưa xếp') return
    if (item.trangThai === 2) v++ // Có mặt
    else if (item.trangThai === 3 || item.trangThai === 6) m++ // Rời sớm / Muộn
    else if (item.trangThai === 5) x++ // Vắng
    else if (item.trangThai === 1) {
      const todayStr = formatYYYYMMDD(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
      if (item.ngayLamViec < todayStr) x++ // Past and not checked in -> Vắng
      else c++ // Future or today not yet checked in -> Chưa ĐD
    }
  })
  return { v, m, x, c }
})

const getDaysInMonth = (year: number, month: number) => {
  const date = new Date(year, month - 1, 1)
  const days = []
  while (date.getMonth() === month - 1) {
    days.push(new Date(date))
    date.setDate(date.getDate() + 1)
  }
  return days
}

const isToday = (dateStr: string) => {
  return dateStr === formatYYYYMMDD(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())
}

const calendarGrid = computed(() => {
  const year = selectedYear.value
  const month = selectedMonth.value
  const days = getDaysInMonth(year, month)
  
  const firstDay = days[0]
  let startOffset = 0
  if (firstDay) {
    startOffset = firstDay.getDay() - 1
    if (startOffset === -1) startOffset = 6 // Sunday is 0, we want Monday=0, Sunday=6
  }
  
  const grid = []
  let currentWeek: any[] = []
  
  for (let i = 0; i < startOffset; i++) {
    currentWeek.push(null)
  }
  
  days.forEach(d => {
    const dateStr = formatYYYYMMDD(d.getFullYear(), d.getMonth() + 1, d.getDate())
    const shift = historyMap.value.get(dateStr)
    currentWeek.push({
      date: d.getDate(),
      dateStr,
      shift
    })
    if (currentWeek.length === 7) {
      grid.push(currentWeek)
      currentWeek = []
    }
  })
  
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null)
    }
    grid.push(currentWeek)
  }
  
  return grid
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl" :loading="isLoading">
      <v-card-title class="pa-6 border-b d-flex flex-column flex-md-row align-md-center justify-space-between gap-4" style="white-space: normal;">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Lịch Sử Điểm Danh</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Tra cứu điểm danh theo tháng của từng nhân viên</div>
        </div>
        
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select
            v-model="selectedNhanVien"
            :items="nhanViens"
            item-title="hoTenNv"
            item-value="maNv"
            label="Chọn nhân viên"
            variant="outlined"
            density="compact"
            hide-details
            min-width="220"
            rounded="lg"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props" :title="item.raw.hoTenNv" :subtitle="item.raw.loaiNhanVien"></v-list-item>
            </template>
          </v-select>

          <v-select
            v-model="selectedMonth"
            :items="months"
            label="Tháng"
            variant="outlined"
            density="compact"
            hide-details
            min-width="120"
            rounded="lg"
          ></v-select>

          <v-select
            v-model="selectedYear"
            :items="years"
            label="Năm"
            variant="outlined"
            density="compact"
            hide-details
            min-width="120"
            rounded="lg"
          ></v-select>
        </div>
      </v-card-title>

      <v-card-text class="pa-6 cal-wrapper bg-slate-50" style="min-height: 600px;">
        <div v-if="selectedNhanVien">
          <!-- Stats summary -->
          <div class="d-flex flex-wrap gap-4 mb-6">
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-emerald-50 to-white" elevation="0" min-width="150">
                <div class="d-flex align-center justify-center mb-1 text-success"><Check class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-success">{{ stats.v }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-emerald-700 mt-1">Có mặt</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-amber-50 to-white" elevation="0" min-width="150">
                <div class="d-flex align-center justify-center mb-1 text-warning"><AlertTriangle class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-warning">{{ stats.m }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-amber-700 mt-1">Muộn / Rời sớm</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-rose-50 to-white" elevation="0" min-width="150">
                <div class="d-flex align-center justify-center mb-1 text-error"><X class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-error">{{ stats.x }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-rose-700 mt-1">Vắng mặt</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-slate-50 to-white" elevation="0" min-width="150">
                <div class="d-flex align-center justify-center mb-1 text-grey-darken-1"><Clock class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-grey-darken-1 cal-text-muted">{{ stats.c }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-slate-600 mt-1">Chưa ĐD</div>
             </v-card>
          </div>

          <div class="d-flex justify-space-between align-center mb-4">
            <h3 class="text-h6 font-weight-bold text-slate-700">Lịch chi tiết</h3>
            <v-btn-toggle v-model="filterType" mandatory rounded="lg" color="primary" density="compact" variant="outlined">
              <v-btn value="all" class="text-none font-weight-bold">Tất cả</v-btn>
              <v-btn value="issues" class="text-none font-weight-bold">Chỉ hiển thị Vắng / Muộn</v-btn>
            </v-btn-toggle>
          </div>

          <!-- Calendar -->
          <div class="grid grid-cols-7 gap-px cal-grid bg-slate-200 border rounded-2xl overflow-hidden shadow-sm">
            <div v-for="day in ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']" :key="day" class="cal-cell bg-white py-3 text-center text-sm font-bold cal-text text-slate-700">
              {{ day }}
            </div>
            
            <template v-for="(week, wIdx) in calendarGrid" :key="wIdx">
              <div v-for="(day, dIdx) in week" :key="dIdx" class="min-h-[140px] p-2 flex flex-col gap-1 relative transition-all duration-300"
                :class="[
                  !day ? 'bg-slate-50/50' : 'cal-cell bg-white hover:bg-slate-50',
                  (filterType === 'issues' && day && (!day.shift || (day.shift.trangThai !== 3 && day.shift.trangThai !== 5 && day.shift.trangThai !== 6))) ? 'opacity-30 grayscale' : ''
                ]">
                <template v-if="day">
                  <div class="text-right text-sm font-bold mb-2" :class="isToday(day.dateStr) ? 'text-primary' : 'cal-text-muted text-slate-600'">
                    <span v-if="isToday(day.dateStr)" class="bg-primary text-white rounded-full w-8 h-8 inline-flex items-center justify-center shadow-lg font-black" style="outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px;">{{ day.date }}</span>
                    <span v-else class="w-8 h-8 inline-flex items-center justify-center">{{ day.date }}</span>
                  </div>
                  
                  <div v-if="day.shift && day.shift.caLam !== 'Chưa xếp'" class="flex-1 flex flex-col items-center justify-start gap-2 w-full px-1">
                    <div class="text-[11px] font-bold px-3 py-1 rounded-pill w-[85%] max-w-[120px] text-center truncate mx-auto"
                         :class="day.shift.caLam === 'Ca ngày' || day.shift.caLam === 'Ca sáng' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-purple-50 text-purple-700 border border-purple-100'">
                      {{ day.shift.caLam }}
                    </div>
                    
                    <div class="w-[85%] max-w-[120px] mx-auto">
                       <div v-if="day.shift.trangThai === 2" class="cal-status-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold py-2 px-3 rounded-pill flex items-center justify-center gap-1 shadow-sm">
                         <Check class="w-3.5 h-3.5"/> Có mặt
                       </div>
                       <div v-else-if="day.shift.trangThai === 3" class="cal-status-2 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold py-2 px-3 rounded-pill flex items-center justify-center gap-1 shadow-sm">
                         <LogOut class="w-3.5 h-3.5"/> Rời ca
                       </div>
                       <div v-else-if="day.shift.trangThai === 5" class="cal-status-3 bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold py-2 px-3 rounded-pill flex items-center justify-center gap-1 shadow-sm">
                         <X class="w-3.5 h-3.5"/> Vắng
                       </div>
                       <div v-else-if="day.shift.trangThai === 6" class="cal-status-4 bg-orange-50 text-orange-700 border border-orange-200 text-[11px] font-bold py-2 px-3 rounded-pill flex items-center justify-center gap-1 shadow-sm">
                         Muộn
                       </div>
                       <div v-else-if="day.shift.trangThai === 1" class="cal-status-5 bg-slate-50 text-slate-500 border border-slate-200 text-[11px] font-bold py-2 px-3 rounded-pill flex items-center justify-center gap-1 shadow-sm">
                         Chưa ĐD
                       </div>
                    </div>

                    <div v-if="day.shift.ghiChu" class="mt-1 w-full flex justify-center">
                      <v-tooltip location="top" :text="day.shift.ghiChu">
                        <template v-slot:activator="{ props }">
                          <div v-bind="props" class="cursor-help inline-flex items-center justify-center bg-rose-50 text-rose-500 rounded-full w-6 h-6 hover:bg-rose-100 transition-colors border border-rose-100">
                            <MessageSquare class="w-3.5 h-3.5" />
                          </div>
                        </template>
                      </v-tooltip>
                    </div>
                  </div>
                  <div v-else class="flex-1 flex items-center justify-center rounded-xl m-1">
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="h-full d-flex align-center justify-center text-slate-400">
          Vui lòng chọn nhân viên để xem lịch sử điểm danh
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style>
/* Đè màu Tailwind khi Vuetify bật chế độ tối (.v-theme--dark) - Sử dụng biến CSS chuẩn của Vuetify để đồng bộ layout */
.v-theme--dark .cal-wrapper {
  background-color: transparent !important; /* Để lộ nền của v-card */
}
.v-theme--dark .cal-grid {
  background-color: rgba(var(--v-theme-on-surface), 0.12) !important; /* Đường kẻ lưới */
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}
.v-theme--dark .cal-cell {
  background-color: rgb(var(--v-theme-surface)) !important; /* Nền ô ngày bình thường */
}
.v-theme--dark .cal-cell:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04) !important; /* Hiệu ứng hover chuẩn Material */
}
.v-theme--dark .cal-cell-empty {
  background-color: rgba(var(--v-theme-on-surface), 0.02) !important; /* Nền ô ngày trống */
}
.v-theme--dark .cal-text {
  color: rgba(var(--v-theme-on-surface), 0.87) !important; /* Text chính */
}
.v-theme--dark .cal-text-muted {
  color: rgba(var(--v-theme-on-surface), 0.6) !important; /* Text phụ */
}
.v-theme--dark .cal-chip-bg {
  background-color: rgba(var(--v-theme-on-surface), 0.08) !important;
  color: rgba(var(--v-theme-on-surface), 0.87) !important;
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
}
.v-theme--dark .cal-stat-card {
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
  background-color: transparent !important;
}
.v-theme--dark .cal-status-1 { /* Có mặt - Success */
  background-color: rgba(76, 175, 80, 0.15) !important;
  color: #4CAF50 !important;
  border-color: rgba(76, 175, 80, 0.3) !important;
}
.v-theme--dark .cal-status-2 { /* Rời ca - Warning */
  background-color: rgba(251, 140, 0, 0.15) !important;
  color: #FB8C00 !important;
  border-color: rgba(251, 140, 0, 0.3) !important;
}
.v-theme--dark .cal-status-3 { /* Vắng - Error */
  background-color: rgba(244, 67, 54, 0.15) !important;
  color: #F44336 !important;
  border-color: rgba(244, 67, 54, 0.3) !important;
}
.v-theme--dark .cal-status-4 { /* Muộn - Orange */
  background-color: rgba(255, 152, 0, 0.15) !important;
  color: #FF9800 !important;
  border-color: rgba(255, 152, 0, 0.3) !important;
}
.v-theme--dark .cal-status-5 { /* Chưa ĐD - Muted */
  background-color: rgba(158, 158, 158, 0.15) !important;
  color: #9E9E9E !important;
  border-color: rgba(158, 158, 158, 0.3) !important;
}
.v-theme--dark .cal-empty-dash {
  border-color: rgba(var(--v-theme-on-surface), 0.12) !important;
  color: rgba(var(--v-theme-on-surface), 0.38) !important;
  background-color: transparent !important;
}
</style>

<style scoped>
.gap-px { gap: 1px; }
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.gap-4 { gap: 16px; }
</style>