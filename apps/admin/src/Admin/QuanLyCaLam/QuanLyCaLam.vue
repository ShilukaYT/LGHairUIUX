<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import axios from 'axios'
import { Check, X, RotateCcw, Plus, Search, ChevronLeft, ChevronRight, LogOut } from 'lucide-vue-next'



// --- CẤU HÌNH API ---
const API_BASE_URL = 'https://localhost:7196/api/admin/lich-lam-viec'
axios.defaults.withCredentials = true

// --- STATE QUẢN LÝ DỮ LIỆU ---
const lichLamViecs = ref<any[]>([])
const nhanViens = ref<any[]>([])
const isLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const isGenerating = ref(false);

// --- LOGIC TÌM KIẾM & PHÂN TRANG ---
const searchQuery = ref('')
const currentPage = ref(1)
const itemsPerPage = 10


// 1. Lọc nhân viên theo tên hoặc loại thợ (Real-time)
const filteredNhanViens = computed(() => {
  if (!searchQuery.value.trim()) return nhanViens.value
  const q = searchQuery.value.toLowerCase()
  return nhanViens.value.filter(nv =>
    nv.hoTenNv?.toLowerCase().includes(q) ||
    nv.loaiNhanVien?.toLowerCase().includes(q)
  )
})

// 2. Tính tổng số trang
const totalPages = computed(() => Math.ceil(filteredNhanViens.value.length / itemsPerPage))

// 3. Lấy dữ liệu của trang hiện tại để hiển thị
const paginatedNhanViens = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredNhanViens.value.slice(start, start + itemsPerPage)
})

const changePage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    // Cuộn nhẹ lên đầu bảng khi chuyển trang
    document.querySelector('.overflow-x-auto')?.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Reset về trang 1 khi gõ tìm kiếm mới
watch(searchQuery, () => {
  currentPage.value = 1
})

// --- LOGIC THỜI GIAN & ĐỒNG HỒ ---
const getTodayLocal = () => new Date().toLocaleDateString('sv-SE')
const todayStr = ref(getTodayLocal())
let timer: any = null

const updateRealTime = async () => {
  const newToday = getTodayLocal()
  if (newToday !== todayStr.value) {
    todayStr.value = newToday
    tableDays.value = getDaysOfWeek()
    await resetFilter() // Tự động load lại khi qua ngày mới
  }
}

// --- LOGIC CA LÀM & ĐIỂM DANH ---
const shiftMap = computed(() => {
  const map = new Map<string, any>()
  lichLamViecs.value.forEach(lich => {
    map.set(`${lich.maNv}_${lich.ngayLamViec}`, lich)
  })
  return map
})

const getShiftData = (maNv: string, date: string) => {
  return shiftMap.value.get(`${maNv}_${date}`)
}

const getShiftStatus = (caLam: string, ngayLam: string) => {
  const now = new Date();
  const currentDay = now.toLocaleDateString('sv-SE');
  if (ngayLam < currentDay) return 'PAST';
  if (ngayLam > currentDay) return 'FUTURE';

  const currentMin = now.getHours() * 60 + now.getMinutes();
  const shifts: any = {
    "Sáng": { start: 8 * 60, end: 12 * 60 },
    "Chiều": { start: 13 * 60, end: 17 * 60 },
    "Tối": { start: 17 * 60, end: 21 * 60 },
    "Cả ngày": { start: 8 * 60, end: 21 * 60 }
  };
  const s = shifts[caLam];
  if (!s) return 'NO_SHIFT';
  if (currentMin < s.start) return 'TOO_EARLY';
  if (currentMin > s.end) return 'TOO_LATE';
  return 'ON_TIME';
}

// --- FORM SỬA CA LÀM (CHỈ CHO HÔM NAY) ---
const isAddModalOpen = ref(false)
const isSubmitting = ref(false)
const formData = ref({
  maNv: '',
  ngayLamViec: todayStr.value,
  caLam: 'Sáng'
})

const openEditModal = (maNv?: string, caHienTai?: string) => {
  formData.value.maNv = maNv || ''
  formData.value.caLam = caHienTai || 'Sáng'
  formData.value.ngayLamViec = todayStr.value // Khóa chặt ngày hiện tại
  isAddModalOpen.value = true
}

const handleUpdateShift = async () => {
  if (!formData.value.maNv) return
  isSubmitting.value = true
  try {
    const res = await axios.post(`${API_BASE_URL}/tao-moi`, { ...formData.value })
    if (res.data.success) {
      isAddModalOpen.value = false
      fetchLichLamViec()
    }
  } catch (error: any) {
    errorMessage.value = error.response?.data?.message || "Lỗi cập nhật."
  } finally {
    isSubmitting.value = false
  }
}

// --- DỮ LIỆU BẢNG ---
const getDaysOfWeek = () => {
  const dates = []
  for (let i = -3; i <= 3; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    dates.push(d.toLocaleDateString('sv-SE'))
  }
  return dates
}
const tableDays = ref(getDaysOfWeek())

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  return parts.length < 3 ? dateStr : `${parts[2]}/${parts[1]}`
}

const fetchNhanViens = async () => {
  try {
    const res = await axios.get(`${API_BASE_URL}/nhan-vien-hop-le`)
    if (res.data.success) nhanViens.value = res.data.data
  } catch (e) { console.error(e) }
}

const fetchLichLamViec = async () => {
  isLoading.value = true
  try {
    const res = await axios.get(`${API_BASE_URL}/danh-sach`)
    if (res.data.success) lichLamViecs.value = res.data.data
  } catch (e) { console.error(e) }
  finally { isLoading.value = false }
}

const handleCheckIn = async (lich: any) => {
  // Chỉ cho điểm danh nếu đang trong giờ làm
  if (lich.trangThai !== 1 || getShiftStatus(lich.caLam, lich.ngayLamViec) !== 'ON_TIME') return

  try {
    const res = await axios.patch(`${API_BASE_URL}/diem-danh/${lich.maLich}`)
    if (res.data.success) {
      lich.trangThai = 2
      successMessage.value = "Điểm danh hoàn tất!"
      setTimeout(() => successMessage.value = '', 2000)
    }
  } catch (e: any) { alert(e.response?.data?.message) }
}

const resetFilter = async () => {
  await axios.post(`${API_BASE_URL}/khoi-tao-ngay`, { date: todayStr.value })
  fetchLichLamViec()
}

const handleLeaveEarly = async (lich: any) => {
  // RÀNG BUỘC: Chỉ cho phép rời ca nếu là ngày hôm nay
  if (lich.ngayLamViec !== todayStr.value) {
    alert("Chỉ có thể ghi nhận rời ca sớm cho dữ liệu của ngày hôm nay.")
    return
  }

  if (!confirm(`Xác nhận thợ ${lich.hoTenNv} rời ca sớm / bỏ về?`)) return

  try {
    const res = await axios.patch(`${API_BASE_URL}/roi-ca-som/${lich.maLich}`)
    if (res.data.success) {
      lich.trangThai = 3
      successMessage.value = "Đã ghi nhận rời ca sớm!"
      setTimeout(() => successMessage.value = '', 2000)
    }
  } catch (e: any) {
    alert(e.response?.data?.message || "Lỗi xử lý.")
  }
}

const generate30Days = async () => {
  if (!confirm("Hệ thống sẽ tự động tạo lịch làm việc cho tất cả nhân viên trong 30 ngày tới. Bạn có chắc chắn không?")) return;

  isGenerating.value = true;
  try {
    const res = await axios.post(`${API_BASE_URL}/tao-lich-30-ngay`);
    alert(res.data.message);
    await fetchLichLamViec(); // Load lại bảng
  } catch (error: any) {
    alert(error.response?.data?.message || "Lỗi khi tạo lịch 30 ngày.");
    console.error(error);
  } finally {
    isGenerating.value = false;
  }
};

// --- LIFECYCLE ---
onMounted(async () => {
  isLoading.value = true
  todayStr.value = getTodayLocal()
  await resetFilter()
  await fetchNhanViens()
  tableDays.value = getDaysOfWeek()
  isLoading.value = false
  timer = setInterval(updateRealTime, 60000)
})

onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<template>
  <div class="p-6 space-y-6 bg-slate-50 min-h-screen">
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex-1">
        <h2 class="text-2xl font-bold text-slate-900">Sổ Điểm Danh Ca Làm</h2>
        <p class="text-sm text-slate-500">Quản lý sự hiện diện của {{ filteredNhanViens.length }} thợ</p>
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <div class="relative min-w-[280px]">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input v-model="searchQuery" type="text" placeholder="Tìm tên thợ hoặc loại thợ..."
            class="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-slate-900 outline-none shadow-sm transition-all">
        </div>

        <button @click="resetFilter"
          class="p-2 text-slate-500 hover:bg-white rounded-lg transition-all shadow-sm border">
          <RotateCcw class="w-5 h-5" />
        </button>

        <button @click="generate30Days" :disabled="isGenerating"
          class="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-sm">
          <i class="fas" :class="isGenerating ? 'fa-spinner fa-spin' : 'fa-calendar-plus'"></i>
          {{ isGenerating ? 'Đang tạo lịch...' : 'Tự động tạo lịch 30 ngày' }}
        </button>
        <button @click="openEditModal()"
          class="flex items-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 transition-all shadow-md">
          <Plus class="w-4 h-4" /> Sửa ca làm
        </button>
      </div>
    </div>

    <Transition name="fade">
      <div v-if="successMessage"
        class="fixed top-5 right-5 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-2xl z-[100] font-bold">
        {{ successMessage }}
      </div>
    </Transition>

    <div class="rounded-2xl border bg-white shadow-xl overflow-hidden flex flex-col">
      <div v-if="filteredNhanViens.length > itemsPerPage"
        class="p-4 border-b bg-slate-50/50 flex items-center justify-between">
        <span class="text-xs font-medium text-slate-500">Trang {{ currentPage }} / {{ totalPages }}</span>
        <div class="flex items-center gap-2">
          <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1"
            class="p-1.5 rounded-lg border bg-white disabled:opacity-30 transition-all hover:bg-slate-100">
            <ChevronLeft class="w-4 h-4" />
          </button>
          <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages"
            class="p-1.5 rounded-lg border bg-white disabled:opacity-30 transition-all hover:bg-slate-100">
            <ChevronRight class="w-4 h-4" />
          </button>
        </div>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-sm">
          <thead>
            <tr class="bg-slate-50/80 border-b">
              <th class="p-4 text-left font-bold text-slate-700 sticky left-0 bg-slate-50 z-20 border-r w-64">Nhân viên
              </th>
              <th v-for="date in tableDays" :key="date" class="p-4 text-center min-w-[130px] border-r last:border-r-0"
                :class="date === todayStr ? 'bg-amber-50 text-amber-900' : 'text-slate-500'">
                <div class="text-[10px] uppercase opacity-60">{{ date === todayStr ? 'Hôm nay' : 'Ngày' }}</div>
                <div class="font-bold text-base">{{ formatDate(date) }}</div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td :colspan="tableDays.length + 1" class="p-20 text-center text-slate-400">Đang tải...</td>
            </tr>
            <tr v-else-if="paginatedNhanViens.length === 0">
              <td :colspan="tableDays.length + 1" class="p-20 text-center text-slate-400 font-medium italic">Không tìm
                thấy thợ.</td>
            </tr>

            <tr v-for="nv in paginatedNhanViens" :key="nv.maNv"
              class="border-b last:border-b-0 hover:bg-slate-50/50 transition-colors">
              <td class="p-4 sticky left-0 bg-white z-10 border-r shadow-[4px_0_10px_rgba(0,0,0,0.02)]">
                <div class="font-bold text-slate-900">{{ nv.hoTenNv }}</div>
                <div class="text-[10px] text-slate-400 font-medium uppercase">{{ nv.loaiNhanVien }}</div>
              </td>

              <td v-for="date in tableDays" :key="date" class="p-3 border-r last:border-r-0 text-center">
                <div v-if="getShiftData(nv.maNv, date)" class="flex flex-col items-center gap-2">

                  <span class="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border">
                    {{ getShiftData(nv.maNv, date).caLam }}
                  </span>

                  <button @click="getShiftData(nv.maNv, date).trangThai === 2
                    ? handleLeaveEarly(getShiftData(nv.maNv, date))
                    : handleCheckIn(getShiftData(nv.maNv, date))"
                    :disabled="getShiftData(nv.maNv, date).trangThai === 3 ||
                      (getShiftData(nv.maNv, date).trangThai === 1 && getShiftStatus(getShiftData(nv.maNv, date).caLam, date) !== 'ON_TIME')"
                    class="group relative w-12 h-12 rounded-2xl border-2 flex items-center justify-center transition-all duration-300"
                    :class="{
                      // 1. Đã có mặt (Xanh) - Click được để rời ca
                      'bg-emerald-500 border-emerald-500 text-white shadow-lg cursor-pointer hover:bg-emerald-600': getShiftData(nv.maNv, date).trangThai === 2,

                      // 2. Chờ điểm danh (Vàng)
                      'border-amber-400 bg-amber-50 hover:bg-amber-500': getShiftData(nv.maNv, date).trangThai === 1 && getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'ON_TIME',

                      // 3. Đã rời ca sớm (Đen/Hổ phách)
                      'bg-slate-900 text-amber-400 border-amber-400 shadow-lg': getShiftData(nv.maNv, date).trangThai === 3,

                      // 4. Quá giờ/Vắng mặt (Đỏ)
                      'bg-rose-50 border-rose-200 text-rose-500': getShiftData(nv.maNv, date).trangThai === 1 && (getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'TOO_LATE' || getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'PAST'),

                      // 5. Chưa đến giờ/Chưa xếp (Mờ)
                      'bg-slate-50 border-slate-100 text-slate-300 opacity-50': getShiftData(nv.maNv, date).trangThai === 0 || (getShiftData(nv.maNv, date).trangThai === 1 && getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'TOO_EARLY')
                    }">
                    <Check v-if="getShiftData(nv.maNv, date).trangThai === 2" class="w-6 h-6" />
                    <LogOut v-else-if="getShiftData(nv.maNv, date).trangThai === 3" class="w-6 h-6" />
                    <X v-else-if="getShiftData(nv.maNv, date).trangThai === 1 && (getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'TOO_LATE' || getShiftStatus(getShiftData(nv.maNv, date).caLam, date) === 'PAST')"
                      class="w-6 h-6" />
                    <span v-else-if="getShiftData(nv.maNv, date).caLam === 'Chưa xếp'"
                      class="opacity-20 text-[8px]">---</span>
                    <span v-else></span>

                    <div v-if="getShiftData(nv.maNv, date).trangThai === 2"
                      class="absolute bottom-full mb-2 hidden group-hover:block bg-slate-800 text-[8px] text-white px-2 py-1 rounded whitespace-nowrap z-30">
                      Bấm để rời ca sớm
                    </div>
                  </button>
                </div>

                <div v-else class="opacity-5 text-xs">---</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="filteredNhanViens.length > itemsPerPage"
        class="p-4 border-t bg-slate-50 flex items-center justify-between">
        <div class="flex items-center gap-1">
          <button v-for="p in totalPages" :key="p" @click="changePage(p)"
            class="min-w-[32px] h-8 rounded-lg text-xs font-bold transition-all"
            :class="p === currentPage ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:bg-slate-100'">
            {{ p }}
          </button>
        </div>
        <span class="text-xs font-medium text-slate-500">Tổng cộng {{ filteredNhanViens.length }} thợ</span>
      </div>
    </div>

    <div v-if="isAddModalOpen"
      class="fixed inset-0 z-[110] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        class="bg-white rounded-3xl shadow-2xl w-full max-w-md border overflow-hidden animate-in fade-in zoom-in duration-300">
        <div class="p-6 border-b bg-slate-50">
          <h3 class="font-bold text-xl text-slate-900">Sửa Ca Làm Hôm Nay</h3>
          <p class="text-sm text-amber-600 font-medium">📅 Ngày: {{ formatDate(todayStr) }}</p>
        </div>

        <div class="p-6 space-y-5">
          <div v-if="errorMessage"
            class="p-3 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-sm font-medium">{{ errorMessage
            }}</div>

          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700">Chọn thợ</label>
            <select v-model="formData.maNv"
              class="w-full rounded-xl border border-slate-200 bg-white px-4 h-12 text-sm focus:ring-2 focus:ring-slate-900 outline-none">
              <option value="" disabled>-- Chọn thợ để xếp ca --</option>
              <option v-for="nv in nhanViens" :key="nv.maNv" :value="nv.maNv">{{ nv.hoTenNv }} ({{ nv.loaiNhanVien }})
              </option>
            </select>
          </div>

          <div class="space-y-2">
            <label class="text-sm font-bold text-slate-700">Phân ca làm việc</label>
            <select v-model="formData.caLam"
              class="w-full rounded-xl border border-slate-200 px-4 h-12 text-sm focus:ring-2 focus:ring-slate-900 outline-none">
              <option value="Sáng">Ca Sáng (08:00 - 12:00)</option>
              <option value="Chiều">Ca Chiều (13:00 - 17:00)</option>
              <option value="Tối">Ca Tối (17:00 - 21:00)</option>
              <option value="Cả ngày">Cả ngày (08:00 - 21:00)</option>
            </select>
          </div>
        </div>

        <div class="p-6 bg-slate-50 flex justify-end gap-3">
          <button @click="isAddModalOpen = false"
            class="px-6 py-2.5 rounded-xl border bg-white font-bold text-slate-600 hover:bg-slate-100 transition-all">Hủy</button>
          <button @click="handleUpdateShift" :disabled="isSubmitting"
            class="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg disabled:opacity-50 transition-all">
            {{ isSubmitting ? 'Đang lưu...' : 'Xác nhận sửa ca' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sticky {
  z-index: 20;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>