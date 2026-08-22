<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import axios from 'axios'
import { Check, X, LogOut, CalendarDays, AlertTriangle, Clock, MessageSquare, History } from 'lucide-vue-next'

const filterType = ref('all') // 'all', 'issues'
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = API + '/api/admin/lich-lam-viec'

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
      lichSuData.value = res.data.data.filter((x: any) => x.maNv?.toLowerCase() === selectedNhanVien.value?.toLowerCase())
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
      nhanViens.value = res.data.data.map((nv: any) => ({
        ...nv,
        displayName: `${nv.hoTenNv} - ${nv.loaiNhanVien || 'Nhân viên'}`
      }))
      // Mặc định không chọn trước nhân viên nào (để ô chọn trống)
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
  let v = 0, m = 0, x = 0, c = 0, np = 0
  const todayStr = formatYYYYMMDD(currentDate.getFullYear(), currentDate.getMonth() + 1, currentDate.getDate())

  lichSuData.value.forEach(item => {
    if (item.caLam === 'Chưa xếp' || item.caLam === 'Nghỉ lễ' || item.trangThai === 7) return
    if (item.caLam === 'Nghỉ phép' || item.trangThai === 4) {
      np++
      return
    }

    const itemDateStr = item.ngayLamViec ? item.ngayLamViec.substring(0, 10) : ''

    if (item.trangThai === 2) {
      v++ // Có mặt
    } else if (item.trangThai === 3 || item.trangThai === 6) {
      m++ // Rời sớm / Muộn
    } else if (item.trangThai === 5) {
      x++ // Vắng mặt
    } else if (item.trangThai === 1) {
      if (itemDateStr < todayStr) {
        x++ // Ca trong quá khứ chưa điểm danh -> Tính là Vắng mặt
      } else {
        c++ // Ca trong tương lai hoặc hôm nay (ngayLamViec >= todayStr) -> Đếm vào "Chưa ĐD"
      }
    }
  })
  return { v, m, x, c, np }
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
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <History class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1">Lịch Sử Điểm Danh</h2>
            <div class="text-subtitle-2 text-medium-emphasis">Tra cứu điểm danh theo tháng của từng nhân viên</div>
          </div>
        </div>
        
        <div class="d-flex align-center gap-3 flex-wrap">
          <v-select
            v-model="selectedNhanVien"
            :items="nhanViens"
            item-title="displayName"
            item-value="maNv"
            label="Chọn nhân viên"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            min-width="260"
            rounded="lg"
          >
            <template v-slot:item="{ props, item }">
              <v-list-item v-bind="props">
                <template v-slot:title>
                  <span class="font-weight-bold">{{ item.raw.hoTenNv }}</span>
                </template>
                <template v-slot:subtitle>
                  <span class="text-caption text-primary font-weight-bold">{{ item.raw.loaiNhanVien || 'Nhân viên' }}</span>
                </template>
              </v-list-item>
            </template>
            <template v-slot:selection="{ item }">
              <span><strong class="font-weight-bold">{{ item.raw.hoTenNv }}</strong> <small class="text-primary font-weight-bold">({{ item.raw.loaiNhanVien || 'Nhân viên' }})</small></span>
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

      <v-card-text class="pa-6 cal-wrapper bg-slate-50 position-relative" style="min-height: 600px;">
        <!-- Overlay Loading Spinner khi đổi Tháng/Năm hoặc Nhân viên (Tự động blur sáng trên nền sáng, blur tối trên nền tối) -->
        <v-overlay :model-value="isLoading" contained class="align-center justify-center cal-loading-overlay" style="z-index: 10;">
          <div class="d-flex flex-column align-center gap-2 pa-4 rounded-xl shadow-md cal-loading-content">
            <v-progress-circular indeterminate color="primary" size="52" width="5"></v-progress-circular>
            <span class="text-caption font-weight-bold text-primary">Đang tải dữ liệu điểm danh...</span>
          </div>
        </v-overlay>

        <div v-if="selectedNhanVien">
          <!-- Stats summary -->
          <div class="d-flex flex-wrap gap-4 mb-6">
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-emerald-50 to-white" elevation="0" min-width="140">
                <div class="d-flex align-center justify-center mb-1 text-success"><Check class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-success">{{ stats.v }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-emerald-700 mt-1">Có mặt</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-amber-50 to-white" elevation="0" min-width="140">
                <div class="d-flex align-center justify-center mb-1 text-warning"><AlertTriangle class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-warning">{{ stats.m }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-amber-700 mt-1">Muộn / Rời sớm</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-purple-50 to-white" elevation="0" min-width="140">
                <div class="d-flex align-center justify-center mb-1 text-purple"><CalendarDays class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-purple">{{ stats.np }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-purple-darken-2 mt-1">Nghỉ phép</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-rose-50 to-white" elevation="0" min-width="140">
                <div class="d-flex align-center justify-center mb-1 text-error"><X class="w-5 h-5 mr-1" /></div>
                <div class="text-h4 font-weight-black text-error">{{ stats.x }}</div>
                <div class="text-caption text-uppercase font-weight-bold text-rose-700 mt-1">Vắng mặt</div>
             </v-card>
             <v-card class="flex-1 pa-4 text-center rounded-xl border bg-white cal-stat-card bg-gradient-to-br from-slate-50 to-white" elevation="0" min-width="140">
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

          <!-- Thông báo Tháng hoàn hảo khi bật bộ lọc Vắng/Muộn mà không có vi phạm -->
          <v-alert
            v-if="filterType === 'issues' && stats.m === 0 && stats.x === 0"
            type="success"
            variant="tonal"
            class="mb-4 rounded-xl font-weight-bold"
            density="comfortable"
          >
            🎉 <strong>Tháng làm việc hoàn hảo!</strong> Nhân viên đi làm đầy đủ 100%, không có ngày nào bị Vắng mặt, Rời ca sớm hoặc Đi muộn.
          </v-alert>

          <!-- Calendar -->
          <div class="grid grid-cols-7 gap-px cal-grid bg-slate-200 border rounded-2xl overflow-hidden shadow-sm">
            <div v-for="day in ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật']" :key="day" class="cal-cell bg-white py-3 text-center text-sm font-bold cal-text text-slate-700">
              {{ day }}
            </div>
            
            <template v-for="(week, wIdx) in calendarGrid" :key="wIdx">
              <div v-for="(day, dIdx) in week" :key="dIdx" class="min-h-[140px] p-2 flex flex-col gap-1 relative transition-all duration-300"
                :class="[
                  !day ? 'bg-slate-50/50' : 'cal-cell bg-white hover:bg-slate-50',
                  (filterType === 'issues' && day && (!day.shift || (day.shift.trangThai !== 3 && day.shift.trangThai !== 5 && day.shift.trangThai !== 6))) ? 'opacity-20 grayscale pointer-events-none' : ''
                ]">
                <template v-if="day">
                  <div class="text-right text-sm font-bold mb-2" :class="isToday(day.dateStr) ? 'text-primary' : 'cal-text-muted text-slate-600'">
                    <span v-if="isToday(day.dateStr)" class="bg-primary text-white rounded-full w-8 h-8 inline-flex items-center justify-center shadow-lg font-black" style="outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px;">{{ day.date }}</span>
                    <span v-else class="w-8 h-8 inline-flex items-center justify-center">{{ day.date }}</span>
                  </div>
                  
                  <div v-if="day.shift && day.shift.caLam !== 'Chưa xếp' && day.shift.caLam !== 'Nghỉ lễ' && day.shift.caLam !== 'Nghỉ phép' && day.shift.trangThai !== 4 && day.shift.trangThai !== 7" class="flex-1 flex flex-col items-center justify-start gap-2 w-full px-1">
                    <div class="text-[11px] font-bold px-3 py-1 rounded-pill w-[85%] max-w-[120px] text-center truncate mx-auto"
                         :class="(day.shift.caLam || '').toLowerCase().includes('sáng') || (day.shift.caLam || '').toLowerCase().includes('chiều') ? 'bg-blue-50 text-blue-700 border border-blue-200 shadow-xs' : ((day.shift.caLam || '').toLowerCase().includes('tối') ? 'bg-purple-50 text-purple-700 border border-purple-200 shadow-xs' : 'bg-amber-50 text-amber-700 border border-amber-200 shadow-xs')">
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

                    <div v-if="day.shift.ghiChu" class="text-[10px] text-rose-500 flex items-start gap-1 leading-tight px-1 max-w-full overflow-hidden mt-1 line-clamp-2">
                      <MessageSquare class="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span :title="day.shift.ghiChu">{{ day.shift.ghiChu }}</span>
                    </div>
                  </div>

                  <div v-else-if="day.shift && (day.shift.caLam === 'Nghỉ phép' || day.shift.trangThai === 4)" class="flex-1 flex flex-col items-center justify-start gap-2 w-full px-1">
                    <div class="text-[11px] font-bold px-3 py-1 rounded-pill w-[85%] max-w-[120px] text-center truncate mx-auto bg-purple text-white shadow-sm">
                      Nghỉ phép
                    </div>
                    <div v-if="day.shift.ghiChu" class="text-[10px] text-purple flex items-start gap-1 leading-tight px-1 max-w-full overflow-hidden mt-1 line-clamp-2">
                      <MessageSquare class="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span :title="day.shift.ghiChu">{{ day.shift.ghiChu }}</span>
                    </div>
                  </div>

                  <div v-else-if="day.shift && (day.shift.caLam === 'Nghỉ lễ' || day.shift.trangThai === 7)" class="flex-1 flex flex-col items-center justify-start gap-2 w-full px-1">
                    <div class="text-[11px] font-bold px-3 py-1 rounded-pill w-[85%] max-w-[120px] text-center truncate mx-auto bg-error text-white shadow-sm">
                      Nghỉ lễ
                    </div>
                    <div v-if="day.shift.ghiChu" class="text-[10px] text-error flex items-start gap-1 leading-tight px-1 max-w-full overflow-hidden mt-1 line-clamp-2">
                      <MessageSquare class="w-3 h-3 flex-shrink-0 mt-0.5" />
                      <span :title="day.shift.ghiChu">{{ day.shift.ghiChu }}</span>
                    </div>
                  </div>
                  
                  <div v-else class="flex-1 flex flex-col items-center justify-center gap-1 opacity-40">
                    <div class="w-20 h-1.5 bg-gray-200 rounded-full"></div>
                    <div class="w-16 h-1.5 bg-gray-200 rounded-full"></div>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </div>
        <div v-else class="h-full min-h-[450px] d-flex flex-column align-center justify-center text-slate-400 py-16">
          <CalendarDays class="w-16 h-16 text-slate-300 mb-3" />
          <h3 class="text-h6 font-weight-bold text-slate-600 mb-1">Chưa chọn nhân viên</h3>
          <p class="text-caption text-slate-400">Vui lòng chọn một nhân viên từ danh sách để xem lịch sử điểm danh chi tiết.</p>
        </div>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style>
/* CSS Loading Overlay thích ứng theo chế độ Sáng / Tối */
.cal-loading-overlay .v-overlay__scrim {
  background-color: #ffffff !important;
  opacity: 0.75 !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.cal-loading-content {
  background-color: #ffffff !important;
  border: 1px solid rgba(226, 232, 240, 0.9) !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04) !important;
}

.v-theme--dark .cal-loading-overlay .v-overlay__scrim {
  background-color: #121212 !important; /* Màu đen trung tính chuẩn dark theme, không bị ám xanh */
  opacity: 0.8 !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.v-theme--dark .cal-loading-content {
  background-color: #1e1e1e !important; /* Hộp spinner đen trung tính đồng bộ v-card */
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5) !important;
}

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