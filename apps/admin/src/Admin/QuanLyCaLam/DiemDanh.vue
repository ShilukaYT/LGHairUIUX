<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Check, X, RotateCcw, Search, LogOut, Fingerprint, CalendarDays } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'

// --- CẤU HÌNH API ---
const API_BASE_URL = 'https://localhost:7196/api/admin/lich-lam-viec'
axios.defaults.withCredentials = true

// --- STATE QUẢN LÝ DỮ LIỆU ---
const lichLamViecs = ref<any[]>([])
const nhanViens = ref<any[]>([])
const isLoading = ref(false)

// Vuetify Snackbar State
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})
const showSnackbar = (text: string, color: string = 'success') => {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
}

// --- LOGIC TÌM KIẾM ---
const searchQuery = ref('')

// --- LOGIC THỜI GIAN & ĐỒNG HỒ ---
const getTodayLocal = () => new Date().toLocaleDateString('sv-SE')
const todayStr = ref(getTodayLocal())
let timer: any = null

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

const updateRealTime = async () => {
  const newToday = getTodayLocal()
  if (newToday !== todayStr.value) {
    todayStr.value = newToday
    tableDays.value = getDaysOfWeek()
    await resetFilter()
  }
}

// --- DATA TABLE HEADERS (DYNAMIC) ---
const headers = computed(() => {
  const h: any[] = [
    { title: 'Nhân viên', key: 'nhanvien', align: 'start', sortable: false, minWidth: '220px' }
  ];
  tableDays.value.forEach(date => {
     h.push({ 
       title: date,
       key: date, 
       align: 'center', 
       sortable: false, 
       minWidth: '130px'
     });
  });
  return h;
})

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  return parts.length < 3 ? dateStr : `${parts[2]}/${parts[1]}`
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
    "Ca ngày": { start: 7 * 60, end: 17 * 60 },
    "Ca tối": { start: 13 * 60, end: 20 * 60 }
  };
  const s = shifts[caLam];
  if (!s) return 'NO_SHIFT';
  if (currentMin < s.start) return 'TOO_EARLY';
  if (currentMin > s.end) return 'TOO_LATE';
  return 'ON_TIME';
}

// --- FORM CẬP NHẬT TRẠNG THÁI ĐIỂM DANH ---
const isAttendanceModalOpen = ref(false)
const isSubmittingAttendance = ref(false)
const attendanceForm = ref({
  maLich: 0,
  maNv: '',
  hoTenNv: '',
  caLam: '',
  ngayLamViec: '',
  trangThai: 2,
  ghiChu: '',
  trangThaiGoc: 1
})

const attendanceStatusOptions = computed(() => {
  if (attendanceForm.value.trangThaiGoc === 2) {
    // Nếu đã có mặt thì mới hiện Rời ca
    return [
      { title: 'Rời ca', value: 3 },
      { title: 'Vắng mặt', value: 5 },
      { title: 'Muộn', value: 6 }
    ]
  } else {
    // Nếu chưa có mặt thì không thể Rời ca
    return [
      { title: 'Có mặt', value: 2 },
      { title: 'Vắng mặt', value: 5 },
      { title: 'Muộn', value: 6 }
    ]
  }
})

// --- FETCH DỮ LIỆU ---
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

const handleCheckIn = (lich: any) => {
  if (lich.trangThai !== 1 || getShiftStatus(lich.caLam, lich.ngayLamViec) !== 'ON_TIME') return

  attendanceForm.value = {
    maLich: lich.maLich,
    maNv: lich.maNv,
    hoTenNv: lich.hoTenNv,
    caLam: lich.caLam,
    ngayLamViec: lich.ngayLamViec,
    trangThai: 2, // Mặc định là Có mặt
    ghiChu: lich.ghiChu || '',
    trangThaiGoc: lich.trangThai
  }
  isAttendanceModalOpen.value = true
}

const resetFilter = async () => {
  await axios.post(`${API_BASE_URL}/khoi-tao-ngay`, { date: todayStr.value })
  fetchLichLamViec()
}

const handleLeaveEarly = (lich: any) => {
  if (lich.ngayLamViec !== todayStr.value) {
    Swal.fire('Cảnh báo', "Chỉ có thể ghi nhận rời ca sớm cho dữ liệu của ngày hôm nay.", 'warning')
    return
  }

  attendanceForm.value = {
    maLich: lich.maLich,
    maNv: lich.maNv,
    hoTenNv: lich.hoTenNv,
    caLam: lich.caLam,
    ngayLamViec: lich.ngayLamViec,
    trangThai: 3, // Mặc định là Rời ca
    ghiChu: lich.ghiChu || '',
    trangThaiGoc: lich.trangThai
  }
  isAttendanceModalOpen.value = true
}

const submitAttendance = async () => {
  // Validate lý do
  if (attendanceForm.value.trangThai !== 2 && !attendanceForm.value.ghiChu?.trim()) {
    showSnackbar('Vui lòng nhập lý do (Ghi chú)', 'error')
    return
  }

  isSubmittingAttendance.value = true
  const statusLabels: Record<number, string> = {
    2: "Có mặt",
    3: "Rời ca",
    5: "Vắng mặt",
    6: "Muộn"
  };
  const label = statusLabels[attendanceForm.value.trangThai] || String(attendanceForm.value.trangThai);
  try {
    const res = await axios.patch(`${API_BASE_URL}/cap-nhat-diem-danh/${attendanceForm.value.maLich}`, {
      trangThai: attendanceForm.value.trangThai,
      ghiChu: attendanceForm.value.ghiChu
    })
    
    if (res.data.success) {
      logActivity(
        "Điểm danh nhân viên",
        `Đã cập nhật trạng thái điểm danh của nhân viên ${attendanceForm.value.hoTenNv} (Mã: ${attendanceForm.value.maNv}) trong ngày ${attendanceForm.value.ngayLamViec} (Ca: ${attendanceForm.value.caLam}) thành "${label}"`,
        "Điểm danh"
      );
      isAttendanceModalOpen.value = false
      showSnackbar("Cập nhật điểm danh thành công!")
      fetchLichLamViec()
    }
  } catch (error: any) {
    logActivity(
      "Điểm danh nhân viên",
      `Thất bại khi cập nhật trạng thái điểm danh của nhân viên ${attendanceForm.value.hoTenNv} (Mã: ${attendanceForm.value.maNv}) thành "${label}" - Lỗi: ${error.message || ''}`,
      "Điểm danh",
      "Thất bại"
    );
    showSnackbar(error.response?.data?.message || "Lỗi cập nhật.", "error")
  } finally {
    isSubmittingAttendance.value = false
  }
}

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
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6" style="white-space: normal;">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Điểm Danh Ca Làm</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Điểm danh sự hiện diện của {{ nhanViens.length }} thợ</div>
        </div>
        
        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-text-field
            v-model="searchQuery"
            label="Tìm tên thợ hoặc loại thợ..."
            density="compact"
            variant="outlined"
            hide-details
            min-width="280"
            rounded="lg"
          >
            <template v-slot:prepend-inner>
              <Search class="w-5 h-5 text-grey" />
            </template>
          </v-text-field>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            size="40"
            rounded="lg"
            @click="resetFilter"
          >
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <v-data-table
        :headers="headers"
        :items="nhanViens"
        :search="searchQuery"
        :loading="isLoading"
        items-per-page="10"
        hover
      >
        <!-- Custom Header for Dates -->
        <template v-for="date in tableDays" :key="'header_'+date" v-slot:[`header.${date}`]="{ column }">
           <div class="text-center py-2">
             <div class="text-caption text-uppercase opacity-60">{{ date === todayStr ? 'Hôm nay' : 'Ngày' }}</div>
             <div class="text-subtitle-1 font-weight-bold" :class="date === todayStr ? 'text-amber-darken-4' : ''">{{ formatDate(date) }}</div>
           </div>
        </template>

        <template v-slot:item.nhanvien="{ item }">
          <div class="py-2">
            <div class="font-weight-bold">{{ item.hoTenNv }}</div>
            <div class="text-caption text-uppercase font-weight-medium text-medium-emphasis">{{ item.loaiNhanVien }}</div>
          </div>
        </template>

        <!-- Custom Columns for Dates -->
        <template v-for="date in tableDays" :key="'item_'+date" v-slot:[`item.${date}`]="{ item }">
          <div class="d-flex flex-column align-center justify-center gap-1 py-2 h-100">
            <template v-if="getShiftData(item.maNv, date)">
               <v-chip
                 size="small"
                 class="font-weight-bold mb-1"
                 variant="tonal"
                 color="grey-darken-4"
               >
                 {{ getShiftData(item.maNv, date).caLam }}
               </v-chip>

               <v-tooltip v-if="getShiftData(item.maNv, date).trangThai === 2" text="Bấm để cập nhật (Rời ca, Vắng mặt, Muộn)" location="top">
                 <template v-slot:activator="{ props }">
                    <v-btn
                      v-bind="props"
                      color="success"
                      variant="flat"
                      size="40"
                      class="rounded-lg elevation-2"
                      @click="handleLeaveEarly(getShiftData(item.maNv, date))"
                    >
                      <Check class="w-5 h-5" />
                    </v-btn>
                 </template>
               </v-tooltip>

               <v-btn
                  v-else-if="getShiftData(item.maNv, date).trangThai === 3 || getShiftData(item.maNv, date).trangThai === 5 || getShiftData(item.maNv, date).trangThai === 6"
                  color="warning"
                  variant="flat"
                  size="40"
                  class="rounded-lg elevation-2 bg-grey-darken-4 text-warning"
                  disabled
                >
                  <LogOut class="w-5 h-5" />
                </v-btn>

                <v-btn
                  v-else-if="getShiftData(item.maNv, date).trangThai === 1 && (getShiftStatus(getShiftData(item.maNv, date).caLam, date) === 'TOO_LATE' || getShiftStatus(getShiftData(item.maNv, date).caLam, date) === 'PAST')"
                  color="error"
                  variant="tonal"
                  size="40"
                  class="rounded-lg"
                  disabled
                >
                  <X class="w-5 h-5" />
                </v-btn>

                <v-btn
                  v-else-if="getShiftData(item.maNv, date).trangThai === 1 && getShiftStatus(getShiftData(item.maNv, date).caLam, date) === 'ON_TIME'"
                  variant="tonal"
                  color="warning"
                  size="40"
                  class="rounded-lg"
                  @click="handleCheckIn(getShiftData(item.maNv, date))"
                >
                  <Fingerprint class="w-5 h-5" />
                </v-btn>
                
                <v-btn
                  v-else-if="getShiftData(item.maNv, date).caLam === 'Chưa xếp'"
                  variant="text"
                  size="40"
                  class="rounded-lg opacity-20"
                  disabled
                >---</v-btn>

                <div v-else class="rounded-lg border bg-grey-lighten-4" style="width: 40px; height: 40px; opacity: 0.5;"></div>

                <div v-if="getShiftData(item.maNv, date).ghiChu" class="text-caption text-error px-1 text-truncate mt-1" style="max-width: 90px; font-size: 0.65rem !important;" :title="getShiftData(item.maNv, date).ghiChu">
                  {{ getShiftData(item.maNv, date).ghiChu }}
                </div>
            </template>
            <span v-else class="text-caption opacity-20">---</span>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Modal Cập nhật Điểm danh -->
    <v-dialog v-model="isAttendanceModalOpen" max-width="450" transition="dialog-bottom-transition">
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b" style="white-space: normal;">
          <div class="text-h6 font-weight-bold">Cập Nhật Trạng Thái</div>
          <div class="text-subtitle-2 text-medium-emphasis font-weight-medium mt-1">
            Nhân viên: {{ attendanceForm.hoTenNv }}
          </div>
          <div class="text-subtitle-2 text-warning font-weight-medium mt-1 d-flex align-center">
            <CalendarDays class="w-4 h-4 mr-1" /> 
            Ca {{ attendanceForm.caLam }} - {{ formatDate(attendanceForm.ngayLamViec) }}
          </div>
        </v-card-title>
        
        <v-card-text class="pa-6">
          <v-form @submit.prevent="submitAttendance">
            <template v-if="attendanceForm.trangThaiGoc !== 2">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Chọn trạng thái</div>
              <v-select
                v-model="attendanceForm.trangThai"
                :items="attendanceStatusOptions"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </template>
            <template v-else>
              <div class="mb-2 text-subtitle-2 font-weight-bold text-primary">Xác nhận Rời ca</div>
            </template>

            <div v-if="attendanceForm.trangThai !== 2" class="mb-2 mt-4 text-subtitle-2 font-weight-bold text-error">Lý do (Bắt buộc)</div>
            <div v-else class="mb-2 mt-4 text-subtitle-2 font-weight-bold text-grey-darken-2">Ghi chú (Tùy chọn)</div>
            <v-textarea
              v-model="attendanceForm.ghiChu"
              placeholder="Nhập ghi chú hoặc lý do..."
              variant="outlined"
              density="comfortable"
              rounded="lg"
              rows="3"
              auto-grow
            ></v-textarea>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn
            variant="outlined"
            rounded="lg"
            class="text-none font-weight-bold mr-2"
            color="grey-darken-2"
            @click="isAttendanceModalOpen = false"
          >Hủy</v-btn>
          <v-btn
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            color="primary"
            :loading="isSubmittingAttendance"
            @click="submitAttendance"
          >Xác nhận</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" timeout="3000" rounded="lg">
      <div class="font-weight-bold d-flex align-center">
        <Check v-if="snackbar.color === 'success'" class="w-5 h-5 mr-2" />
        <X v-else class="w-5 h-5 mr-2" />
        {{ snackbar.text }}
      </div>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.gap-1 { gap: 4px; }
.gap-3 { gap: 12px; }
</style>
