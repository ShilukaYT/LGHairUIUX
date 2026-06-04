<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import axios from 'axios'
import { FileDown, Search, Check, X, LogOut, ArrowRightToLine } from 'lucide-vue-next'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const API_BASE_URL = 'https://localhost:7196/api/admin/lich-lam-viec'
const tableContainer = ref<HTMLElement | null>(null)
const lichSuData = ref<any[]>([])
const nhanViens = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

// 1. Tạo 60 ngày gần nhất
const allDates = computed(() => {
  const dates = []
  const today = new Date()
  for (let i = 60; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    dates.push(d.toLocaleDateString('sv-SE'))
  }
  return dates
})

// 2. BỔ SUNG: Lọc nhân viên
const filteredNhanViens = computed(() => {
  if (!searchQuery.value.trim()) return nhanViens.value
  const q = searchQuery.value.toLowerCase()
  return nhanViens.value.filter(nv => nv.hoTenNv?.toLowerCase().includes(q))
})

// 3. Map dữ liệu để truy xuất nhanh O(1)
const historyMap = computed(() => {
  const map = new Map()
  lichSuData.value.forEach(item => map.set(`${item.maNv}_${item.ngayLamViec}`, item))
  return map
})

// 4. TỐI ƯU: Thống kê không cần filter nhiều lần
const statsMap = computed(() => {
  const sMap = new Map()
  nhanViens.value.forEach(nv => {
    const items = lichSuData.value.filter(l => l.maNv === nv.maNv)
    sMap.set(nv.maNv, {
      v: items.filter(l => l.trangThai === 2).length,
      r: items.filter(l => l.trangThai === 3).length,
      x: items.filter(l => l.trangThai === 1).length
    })
  })
  return sMap
})

const getStats = (maNv: string) => statsMap.value.get(maNv) || { v: 0, r: 0, x: 0 }

// 5. FIX LỖI: Hàm xuất Excel 60 ngày
const exportExcel = async () => {
  if (filteredNhanViens.value.length === 0) return
  isLoading.value = true
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('DiemDanh60Ngay')

  // Header 60 ngày
  const headerRow = ["Nhân viên", ...allDates.value.map(d => d.split('-').reverse().join('/')), "V", "R", "X"]
  const header = worksheet.addRow(headerRow)
  
  header.eachCell((cell) => {
    cell.font = { bold: true }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.alignment = { horizontal: 'center' }; cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} };
  })

  // Data rows
  filteredNhanViens.value.forEach(nv => {
    const rowData = [nv.hoTenNv]
    allDates.value.forEach(date => {
      const shift = historyMap.value.get(`${nv.maNv}_${date}`)
      if (!shift) rowData.push("-")
      else rowData.push(shift.trangThai === 2 ? "V" : (shift.trangThai === 3 ? "R" : "X"))
    })
    // Thêm stats vào cuối dòng Excel
    const s = getStats(nv.maNv)
    rowData.push(s.v, s.r, s.x)
    
    const row = worksheet.addRow(rowData)
    row.eachCell((cell, colNum) => {
      if (colNum > 1) cell.alignment = { horizontal: 'center' }
      cell.border = { top: {style:'thin'}, left: {style:'thin'}, bottom: {style:'thin'}, right: {style:'thin'} }
    })
  })

  worksheet.columns.forEach((col, i) => { col.width = i === 0 ? 25 : 6 })
  const buffer = await workbook.xlsx.writeBuffer()
  saveAs(new Blob([buffer]), `Lich_Su_60_Ngay.xlsx`)
  isLoading.value = false
}

// Các hàm phụ khác
const isWeekend = (dateStr: string) => [0, 6].includes(new Date(dateStr).getDay())
const isToday = (dateStr: string) => dateStr === new Date().toLocaleDateString('sv-SE')
const getDayName = (dateStr: string) => ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][new Date(dateStr).getDay()]

const fetchHistory = async () => {
  isLoading.value = true
  try {
    const [resNv, resLs] = await Promise.all([
      axios.get(`${API_BASE_URL}/nhan-vien-hop-le`),
      axios.get(`${API_BASE_URL}/danh-sach`, { params: { tuNgay: allDates.value[0], denNgay: allDates.value[60] } })
    ])
    if (resNv.data.success) nhanViens.value = resNv.data.data
    if (resLs.data.success) lichSuData.value = resLs.data.data
    await nextTick(); scrollToToday();
  } catch (e) { console.error(e) } finally { isLoading.value = false }
}

const scrollToToday = () => { if (tableContainer.value) tableContainer.value.scrollLeft = tableContainer.value.scrollWidth }
onMounted(fetchHistory)
</script>

<template>
  <div class="h-[calc(100vh-64px)] w-full flex flex-col bg-slate-50 overflow-hidden p-4 md:p-6">
    
    <div class="flex-shrink-0 w-full flex flex-wrap justify-between items-center gap-4 bg-white p-4 rounded-2xl border shadow-sm mb-4">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="relative flex-1 max-w-md">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="searchQuery" placeholder="Tìm tên thợ..." 
            class="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500">
        </div>
        <button @click="scrollToToday" class="h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold flex-shrink-0 flex items-center gap-2">
          <ArrowRightToLine class="w-4 h-4"/> Hôm nay
        </button>
      </div>

      <button @click="exportExcel" class="h-10 px-6 bg-emerald-600 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 flex-shrink-0">
        <FileDown class="w-4 h-4" /> Xuất Excel 60 ngày
      </button>
    </div>

    <div class="flex-1 w-full bg-white rounded-2xl border shadow-xl relative isolate">
      
      <div ref="tableContainer" class="absolute inset-0 overflow-auto custom-scrollbar rounded-2xl">
        
        <table class="w-max min-w-full text-sm border-separate border-spacing-0">
          <thead class="sticky top-0 z-[100] bg-slate-50">
            <tr>
              <th class="p-4 text-left font-black text-slate-700 sticky left-0 bg-slate-50 z-[110] border-r border-b w-[180px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                NHÂN VIÊN
              </th>
              
              <th v-for="date in allDates" :key="date" 
                  class="p-2 text-center min-w-[50px] border-r border-b text-[10px] font-bold"
                  :class="[isWeekend(date) ? 'text-rose-500' : 'text-slate-400', isToday(date) ? 'bg-emerald-50 text-emerald-600' : '']">
                <div class="uppercase">{{ getDayName(date) }}</div>
                <div class="text-xs">{{ date.split('-')[2] }}</div>
              </th>

              <th class="p-2 text-center w-[50px] sticky right-[100px] bg-slate-100 z-[110] border-l border-b font-black text-emerald-600 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">V</th>
              <th class="p-2 text-center w-[50px] sticky right-[50px] bg-slate-100 z-[110] border-l border-b font-black text-amber-600 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">R</th>
              <th class="p-2 text-center w-[50px] sticky right-0 bg-slate-100 z-[110] border-l border-b font-black text-rose-500 shadow-[-2px_0_5px_rgba(0,0,0,0.03)]">X</th>
            </tr>
          </thead>
          <tbody class="bg-white">
            <tr v-for="nv in filteredNhanViens" :key="nv.maNv" class="hover:bg-slate-50/80 transition-colors">
              <td class="p-4 sticky left-0 bg-white z-[80] border-r border-b font-bold text-slate-900 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                <div class="truncate w-[140px]">{{ nv.hoTenNv }}</div>
                <div class="text-[9px] text-slate-400 font-medium uppercase truncate">{{ nv.loaiNhanVien }}</div>
              </td>
              
              <td v-for="date in allDates" :key="date" class="p-2 border-r border-b text-center">
                <div v-if="historyMap.get(`${nv.maNv}_${date}`)" class="flex justify-center">
                  <Check v-if="historyMap.get(`${nv.maNv}_${date}`).trangThai === 2" class="w-4 h-4 text-emerald-500 stroke-[3px]" />
                  <LogOut v-else-if="historyMap.get(`${nv.maNv}_${date}`).trangThai === 3" class="w-4 h-4 text-amber-500 stroke-[3px]" />
                  <X v-else-if="historyMap.get(`${nv.maNv}_${date}`).trangThai === 1" class="w-4 h-4 text-rose-400 stroke-[3px]" />
                </div>
                <div v-else class="text-[10px] text-slate-100">-</div>
              </td>

              <td class="p-2 text-center font-black text-emerald-600 bg-emerald-50/20 sticky right-[100px] z-[80] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">{{ getStats(nv.maNv).v }}</td>
              <td class="p-2 text-center font-black text-amber-600 bg-amber-50/20 sticky right-[50px] z-[80] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">{{ getStats(nv.maNv).r }}</td>
              <td class="p-2 text-center font-black text-rose-500 bg-rose-50/20 sticky right-0 z-[80] border-l border-b shadow-[-2px_0_5px_rgba(0,0,0,0.02)]">{{ getStats(nv.maNv).x }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Chặn rò rỉ layout */
.isolate {
  isolation: isolate;
}

/* Đảm bảo border không bị mất khi kéo qua lại */
th, td {
  background-clip: padding-box;
}

/* Tạo thanh cuộn gọn gàng */
.custom-scrollbar::-webkit-scrollbar { height: 10px; width: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: #f8fafc; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
</style>