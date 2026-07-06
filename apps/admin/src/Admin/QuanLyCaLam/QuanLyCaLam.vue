<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Check, X, Search, CalendarDays, Plus, Edit, RotateCcw, AlertTriangle } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'

// --- CẤU HÌNH API ---
const API_BASE_URL = 'https://localhost:7196/api/admin/lich-lam-viec'
axios.defaults.withCredentials = true

// --- STATE QUẢN LÝ DỮ LIỆU ---
const lichLamViecs = ref<any[]>([])
const nhanViens = ref<any[]>([])
const isLoading = ref(false)
const isSubmitting = ref(false)

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
const route = useRoute()
const searchQuery = ref('')

// --- LOGIC THỜI GIAN ---
const getTodayLocal = () => new Date().toLocaleDateString('sv-SE')
const todayStr = ref(getTodayLocal())

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '-'
  const parts = dateStr.split('-')
  return parts.length < 3 ? dateStr : `${parts[2]}/${parts[1]}/${parts[0]}`
}

// --- LOGIC CA LÀM ---
const getEmployeeScheduleInfo = (maNv: string) => {
  const allShifts = lichLamViecs.value.filter(s => s.maNv === maNv);
  const shifts = allShifts.filter(s => s.caLam !== 'Chưa xếp' && s.caLam !== 'Nghỉ (Chưa xếp)' && s.caLam !== 'Nghỉ lễ');
  
  if (shifts.length === 0) return { start: null, end: null, status: 'Chưa xếp', shifts: allShifts };
  
  // Sắp xếp ngày tăng dần
  shifts.sort((a, b) => new Date(a.ngayLamViec).getTime() - new Date(b.ngayLamViec).getTime());
  
  // Lọc lấy các ngày từ hôm nay trở đi (để biết lịch tương lai)
  const futureShifts = shifts.filter(s => s.ngayLamViec >= todayStr.value);
  
  if (futureShifts.length === 0) {
    return { start: shifts[0].ngayLamViec, end: shifts[shifts.length - 1].ngayLamViec, status: 'Đã qua', shifts: allShifts };
  }

  const start = futureShifts[0].ngayLamViec;
  const end = futureShifts[futureShifts.length - 1].ngayLamViec;
  
  const todayTime = new Date(todayStr.value).getTime();
  const endTime = new Date(end).getTime();
  const daysDiff = (endTime - todayTime) / (1000 * 3600 * 24);
  
  let status = 'Đã xếp';
  if (daysDiff <= 5) status = 'Sắp hết hạn';

  return { start, end, status, shifts: allShifts };
}

const tableData = computed(() => {
  return nhanViens.value.map(nv => {
    const info = getEmployeeScheduleInfo(nv.maNv);
    return {
      ...nv,
      ngayBatDau: info.start,
      ngayKetThuc: info.end,
      trangThaiLich: info.status,
      shifts: info.shifts
    }
  })
})

const filteredTableData = computed(() => {
  if (!searchQuery.value) return tableData.value;
  const q = searchQuery.value.toLowerCase();
  return tableData.value.filter(item => 
    (item.hoTenNv && item.hoTenNv.toLowerCase().includes(q)) || 
    (item.maNv && item.maNv.toLowerCase().includes(q))
  );
})

const headers = [
  { title: 'Nhân viên', key: 'nhanvien', align: 'start', sortable: true },
  { title: 'Ngày bắt đầu lịch', key: 'ngayBatDau', align: 'center', sortable: true },
  { title: 'Ngày kết thúc', key: 'ngayKetThuc', align: 'center', sortable: true },
  { title: 'Trạng thái', key: 'trangThaiLich', align: 'center', sortable: true },
  { title: 'Hành động', key: 'actions', align: 'center', sortable: false },
] as const

const openCreateModal = (item: any) => {
  editState.value.maNv = item.maNv;
  editState.value.tenNv = item.hoTenNv;
  editState.value.isCreating = true;
  
  let startDate = new Date();
  if (item.ngayKetThuc && item.trangThaiLich !== 'Đã qua') {
     const lastEnd = new Date(item.ngayKetThuc);
     if (lastEnd >= new Date()) {
        startDate = new Date(lastEnd);
        startDate.setDate(startDate.getDate() + 1); // Tiếp nối lịch hiện tại
     }
  }

  editState.value.ngayBatDauSua = startDate.toLocaleDateString('sv-SE');
  editState.value.khoangThoiGian = 30;
  editState.value.caLamApDung = 'Ca sáng (7h-17h)';
  editState.value.selectedDaysOfWeek = [1, 2, 3, 4, 5, 6, 0];
  generateEditRows();
  isEditModalOpen.value = true;
  const confirm = await Swal.fire({
      title: 'Tạo lịch 30 ngày',
      text: `Hệ thống sẽ tạo lịch 30 ngày cho thợ ${item.hoTenNv} bắt đầu từ ${startDate.toLocaleDateString('vi-VN')}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Tạo ngay',
      cancelButtonText: 'Hủy'
  });

  if (!confirm.isConfirmed) return;

  isSubmitting.value = true;
  try {
    const dates = [];
    for(let i=0; i<30; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      dates.push(d.toLocaleDateString('sv-SE'));
    }

    const chunkSize = 5;
    for (let i = 0; i < dates.length; i += chunkSize) {
        const chunk = dates.slice(i, i + chunkSize);
        await Promise.all(chunk.map(dateStr => 
            axios.post(`${API_BASE_URL}/tao-moi`, { maNv: item.maNv, ngayLamViec: dateStr, caLam: 'Ca ngày' })
        ));
    }

    logActivity("Xếp lịch ca làm", `Đã tạo/gia hạn lịch làm việc 30 ngày cho thợ ${item.hoTenNv} (Mã: ${item.maNv}) từ ngày ${startDate.toLocaleDateString('vi-VN')}`, "Ca làm");
    showSnackbar(`Đã tạo lịch 30 ngày cho thợ!`);
    await fetchLichLamViec();
  } catch (error: any) {
    logActivity("Xếp lịch ca làm", `Thất bại khi xếp lịch làm việc cho thợ ${item.hoTenNv} - Lỗi: ${error.message || ''}`, "Ca làm", "Thất bại");
    showSnackbar('Có lỗi xảy ra khi tạo lịch', 'error');
  } finally {
    isSubmitting.value = false;
  }
}

// --- HÀNH ĐỘNG SỬA LỊCH ---
const isEditModalOpen = ref(false)
const editState = ref({
  maNv: '',
  tenNv: '',
  ngayBatDauSua: todayStr.value,
  khoangThoiGian: 1, // 1, 7, 14
  caLamApDung: 'Ca sáng (7h-17h)',
  selectedDaysOfWeek: [1, 2, 3, 4, 5, 6, 0] as number[],
  affectedDates: [] as string[],
  isCreating: false
})

const khoangThoiGianOptions = [
  { title: 'Trong ngày (1 ngày)', value: 1 },
  { title: '7 ngày tới', value: 7 },
  { title: '14 ngày tới', value: 14 },
  { title: '30 ngày tới', value: 30 }
]

const dayOfWeekOptions = [
  { title: 'T2', value: 1 },
  { title: 'T3', value: 2 },
  { title: 'T4', value: 3 },
  { title: 'T5', value: 4 },
  { title: 'T6', value: 5 },
  { title: 'T7', value: 6 },
  { title: 'CN', value: 0 }
]

const caLamOptions = [
  'Ca sáng (7h-17h)',
  'Ca tối (13h-20h)',
  'Ca sáng (Part-time)',
  'Ca chiều (Part-time)',
  'Ca tối (Part-time)',
  'Nghỉ lễ',
  'Chưa xếp'
]

const generateEditRows = () => {
  if (!editState.value.ngayBatDauSua) return;
  
  let endLimit = null;
  if (!editState.value.isCreating) {
    const info = getEmployeeScheduleInfo(editState.value.maNv);
    endLimit = info.end ? new Date(info.end) : null;
  }
  
  const dates = [];
  const start = new Date(editState.value.ngayBatDauSua);
  for (let i=0; i<editState.value.khoangThoiGian; i++) {
     const d = new Date(start);
     d.setDate(start.getDate() + i);
     
     if (endLimit && d > endLimit) break;
     
     if (editState.value.khoangThoiGian === 1 || editState.value.selectedDaysOfWeek.includes(d.getDay())) {
         dates.push(d.toLocaleDateString('sv-SE'));
     }
  }
  editState.value.affectedDates = dates;
}

watch([() => editState.value.ngayBatDauSua, () => editState.value.khoangThoiGian, () => editState.value.selectedDaysOfWeek], () => {
  if (isEditModalOpen.value) {
    generateEditRows()
  }
}, { deep: true })

const openEditModal = (item: any) => {
  editState.value.maNv = item.maNv
  editState.value.tenNv = item.hoTenNv
  editState.value.isCreating = false
  editState.value.ngayBatDauSua = todayStr.value > (item.ngayBatDau || todayStr.value) ? todayStr.value : (item.ngayBatDau || todayStr.value)
  editState.value.khoangThoiGian = 1
  editState.value.caLamApDung = 'Ca sáng (7h-17h)'
  editState.value.selectedDaysOfWeek = [1, 2, 3, 4, 5, 6, 0]
  generateEditRows()
  isEditModalOpen.value = true
}

const submitEditSchedule = async () => {
  isSubmitting.value = true;
  try {
     const chunkSize = 5;
     for (let i = 0; i < editState.value.affectedDates.length; i += chunkSize) {
        const chunk = editState.value.affectedDates.slice(i, i + chunkSize);
        await Promise.all(chunk.map(dateStr => {
            return axios.post(`${API_BASE_URL}/tao-moi`, { 
               maNv: editState.value.maNv, 
               ngayLamViec: dateStr, 
               caLam: editState.value.caLamApDung
            });
        }));
     }
     logActivity("Sửa lịch ca làm", `Đã sửa lịch làm việc của thợ ${editState.value.tenNv} (Mã: ${editState.value.maNv}) trong ${editState.value.affectedDates.length} ngày từ ${editState.value.ngayBatDauSua} thành ${editState.value.caLamApDung}`, "Ca làm");
     showSnackbar("Cập nhật lịch làm việc thành công!");
     isEditModalOpen.value = false;
     await fetchLichLamViec();
  } catch (error: any) {
     logActivity("Sửa lịch ca làm", `Thất bại khi sửa lịch làm việc của thợ ${editState.value.tenNv} - Lỗi: ${error.message || ''}`, "Ca làm", "Thất bại");
     showSnackbar("Lỗi cập nhật ca làm.", "error");
  } finally {
     isSubmitting.value = false;
  }
}

// --- HÀNH ĐỘNG NGHỈ LỄ CHUNG ---
const isHolidayModalOpen = ref(false)
const isSubmittingHoliday = ref(false)
const holidayState = ref({
  tuNgay: todayStr.value,
  denNgay: todayStr.value,
  lyDo: ''
})

const submitHoliday = async () => {
  if (!holidayState.value.lyDo) {
    showSnackbar("Vui lòng nhập lý do nghỉ", "error");
    return;
  }
  isSubmittingHoliday.value = true;
  try {
    const res = await axios.post(`${API_BASE_URL}/nghi-le-chung`, {
      tuNgay: holidayState.value.tuNgay,
      denNgay: holidayState.value.denNgay,
      lyDo: holidayState.value.lyDo
    });
    if (res.data.success) {
      showSnackbar(res.data.message);
      isHolidayModalOpen.value = false;
      holidayState.value.lyDo = '';
      await fetchLichLamViec();
    }
  } catch (error: any) {
    showSnackbar(error.response?.data?.message || "Lỗi khi thiết lập nghỉ chung.", "error");
  } finally {
    isSubmittingHoliday.value = false;
  }
}

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

const loadData = async () => {
  isLoading.value = true
  todayStr.value = getTodayLocal()
  // Ensure the date filter on backend is ready
  try { await axios.post(`${API_BASE_URL}/khoi-tao-ngay`, { date: todayStr.value }, { withCredentials: false }) } catch (e) {}
  await fetchNhanViens()
  await fetchLichLamViec()
  isLoading.value = false
}

onMounted(() => {
  if (route.query.search) {
    searchQuery.value = route.query.search as string
  }
  loadData()
})

watch(() => route.query.search, (newSearch) => {
  if (newSearch !== undefined) {
    searchQuery.value = newSearch as string;
  }
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Ca Làm</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Quản lý lịch làm việc của {{ nhanViens.length }} thợ</div>
        </div>
        
        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            color="error"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="isHolidayModalOpen = true"
          >
            Nghỉ Lễ Chung
          </v-btn>

          <v-text-field
            v-model="searchQuery"
            label="Tìm tên thợ..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            prepend-inner-icon="mdi-magnify"
            rounded="lg"
            bg-color="white"
            class="flex-grow-1"
            style="min-width: 250px;"
          ></v-text-field>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadData">
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <v-data-table
        :headers="headers"
        :items="filteredTableData"
        :loading="isLoading"
        items-per-page="10"
        hover
      >
        <template v-slot:item.nhanvien="{ item }">
          <div class="py-2">
            <div class="font-weight-bold">{{ item.hoTenNv }}</div>
            <div class="text-caption text-uppercase font-weight-medium text-medium-emphasis">{{ item.loaiNhanVien }}</div>
          </div>
        </template>

        <template v-slot:item.ngayBatDau="{ item }">
          <div class="font-weight-medium">{{ formatDate(item.ngayBatDau) }}</div>
        </template>

        <template v-slot:item.ngayKetThuc="{ item }">
          <div class="font-weight-medium">{{ formatDate(item.ngayKetThuc) }}</div>
        </template>

        <template v-slot:item.trangThaiLich="{ item }">
          <v-chip
            v-if="item.trangThaiLich === 'Đã xếp'"
            color="success" size="small" variant="flat" class="font-weight-bold"
          >Đã xếp lịch</v-chip>
          <v-chip
            v-else-if="item.trangThaiLich === 'Sắp hết hạn'"
            color="warning" size="small" variant="flat" class="font-weight-bold"
          >Sắp hết hạn</v-chip>
          <v-chip
            v-else
            color="grey-darken-2" size="small" variant="tonal" class="font-weight-bold"
          >Chưa xếp (hoặc Đã qua)</v-chip>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-2">
            <v-btn
              v-if="item.trangThaiLich === 'Đã xếp' || item.trangThaiLich === 'Sắp hết hạn'"
              color="primary"
              variant="tonal"
              size="small"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="openEditModal(item)"
            >
              <template v-slot:prepend><Edit class="w-4 h-4 mr-1" /></template>
              Sửa lịch
            </v-btn>

            <v-btn
              v-if="item.trangThaiLich === 'Chưa xếp' || item.trangThaiLich === 'Đã qua'"
              color="success"
              variant="flat"
              size="small"
              rounded="lg"
              class="text-none font-weight-bold"
              :loading="isSubmitting"
              @click="openCreateModal(item)"
            >
              <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
              Thêm lịch
            </v-btn>

            <v-btn
              v-if="item.trangThaiLich === 'Sắp hết hạn'"
              color="warning"
              variant="flat"
              size="small"
              rounded="lg"
              class="text-none font-weight-bold ml-2"
              :loading="isSubmitting"
              title="Gia hạn thêm 30 ngày nối tiếp"
              @click="openCreateModal(item)"
            >
              <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
              Gia hạn
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- Modal Sửa Lịch -->
    <v-dialog v-model="isEditModalOpen" max-width="500" transition="dialog-bottom-transition">
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b">
          <div class="text-h6 font-weight-bold">Thiết lập Lịch Làm Việc</div>
          <div class="text-subtitle-2 text-medium-emphasis mt-1">Thợ: <span class="text-primary font-weight-bold">{{ editState.tenNv }}</span></div>
        </v-card-title>
        
        <v-card-text class="pa-6">
          <v-form @submit.prevent="submitEditSchedule">
            <v-row>
              <v-col cols="12" sm="6" class="pb-0">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Ngày bắt đầu sửa</div>
                <v-text-field
                  v-model="editState.ngayBatDauSua"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  :min="todayStr"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" class="pb-0">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Khoảng thời gian</div>
                <v-select
                  v-model="editState.khoangThoiGian"
                  :items="khoangThoiGianOptions"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                ></v-select>
              </v-col>
              <v-col cols="12" class="pb-0 pt-2">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Ca làm áp dụng chung</div>
                <v-select
                  v-model="editState.caLamApDung"
                  :items="caLamOptions"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                ></v-select>
              </v-col>
              <v-col cols="12" class="pb-0" v-if="editState.khoangThoiGian > 1">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Các ngày áp dụng trong tuần</div>
                <v-chip-group
                  v-model="editState.selectedDaysOfWeek"
                  multiple
                  selected-class="bg-primary text-white"
                >
                  <v-chip v-for="day in dayOfWeekOptions" :key="day.value" :value="day.value" filter>
                    {{ day.title }}
                  </v-chip>
                </v-chip-group>
              </v-col>
            </v-row>

            <v-alert
              v-if="editState.affectedDates.length === 0"
              type="info"
              variant="tonal"
              class="mt-4"
              density="compact"
            >
              Không có ngày nào trong phạm vi lịch hiện tại.
            </v-alert>

            <div v-if="editState.affectedDates.length > 0" class="mt-4">
              <div class="text-subtitle-2 font-weight-bold text-grey-darken-2 mb-2">Các ngày sẽ được cập nhật ({{ editState.affectedDates.length }} ngày)</div>
              <div class="d-flex flex-wrap gap-2">
                <v-chip
                  v-for="(date, index) in editState.affectedDates"
                  :key="index"
                  size="small"
                  variant="outlined"
                  color="primary"
                  class="font-weight-bold"
                >
                  {{ formatDate(date) }}
                </v-chip>
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn
            variant="outlined"
            rounded="lg"
            class="text-none font-weight-bold mr-2"
            color="grey-darken-2"
            @click="isEditModalOpen = false"
          >Hủy</v-btn>
          <v-btn
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            color="primary"
            :loading="isSubmitting"
            @click="submitEditSchedule"
            :disabled="editState.affectedDates.length === 0"
          >Lưu thay đổi</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Modal Nghỉ Lễ Chung -->
    <v-dialog v-model="isHolidayModalOpen" max-width="500" transition="dialog-bottom-transition">
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b">
          <div class="text-h6 font-weight-bold text-error">Thiết lập Nghỉ Lễ Chung</div>
          <div class="text-subtitle-2 text-medium-emphasis mt-1">Cập nhật ca làm của TOÀN BỘ nhân viên thành "Nghỉ lễ"</div>
        </v-card-title>
        
        <v-card-text class="pa-6">
          <v-form @submit.prevent="submitHoliday">
            <v-row>
              <v-col cols="12" sm="6" class="pb-0">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Từ ngày</div>
                <v-text-field
                  v-model="holidayState.tuNgay"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  :min="todayStr"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" class="pb-0">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Đến ngày</div>
                <v-text-field
                  v-model="holidayState.denNgay"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  :min="holidayState.tuNgay"
                ></v-text-field>
              </v-col>
              <v-col cols="12" class="pb-0 pt-2">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Lý do nghỉ (Tên ngày lễ)</div>
                <v-text-field
                  v-model="holidayState.lyDo"
                  placeholder="VD: Nghỉ Tết Nguyên Đán"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn
            variant="outlined"
            rounded="lg"
            class="text-none font-weight-bold mr-2"
            color="grey-darken-2"
            @click="isHolidayModalOpen = false"
          >Hủy</v-btn>
          <v-btn
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            color="error"
            :loading="isSubmittingHoliday"
            @click="submitHoliday"
          >Áp dụng cho toàn tiệm</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

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
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
</style>