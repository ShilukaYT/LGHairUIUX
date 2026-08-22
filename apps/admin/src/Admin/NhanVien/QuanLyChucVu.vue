<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import { useCustomizerStore } from '@/stores/customizer'
import {
  Search, Plus, Edit3, Trash2, X, Check,
  RotateCcw, AlertCircle, Briefcase, Layers,
  ShieldCheck, Users, Award, DollarSign, Scissors,
  Sparkles, CheckCircle2
} from 'lucide-vue-next'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_URL = API + '/api/LoaiNhanVien'

// ── THEME SYNC ──
const theme = useTheme()
const customizer = useCustomizerStore()

const isDark = computed(() => {
  const vTheme = theme.global.name.value
  const cTheme = customizer.actTheme
  return vTheme === 'dark' || cTheme === 'dark' || document.documentElement.classList.contains('dark')
})

watch(
  [() => theme.global.name.value, () => customizer.actTheme],
  ([vTheme, cTheme]) => {
    const current = vTheme || cTheme
    if (current === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  },
  { immediate: true }
)

// ── DATA INTERFACES & STATE ──
export interface ChucVuItem {
  maLoaiNv: string
  tenLoai: string
  luong: number
  moTa?: string | null
  duocDatLich?: boolean
  trangThai?: number
  soNhanVien?: number
}

const dataList = ref<ChucVuItem[]>([])
const searchQuery = ref('')
const filterStatus = ref<string>('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const selectedItemToDelete = ref<ChucVuItem | null>(null)

// ── HIGH-PRIORITY NOTIFICATION SYSTEM (SNACKBAR) ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
})

const showNotification = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = msg
  snackbar.color = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
  snackbar.show = true
}

const form = reactive({
  maLoaiNv: '',
  tenLoai: '',
  luong: 5000000,
  moTa: '',
  duocDatLich: false,
  trangThai: 1,
})

const errors = reactive({ tenLoai: '', luong: '' })
const curPage = ref(1)
const PER_PAGE = 8

// ── FETCH DATA ──
const fetchData = async () => {
  try {
    isLoading.value = true
    const res = await axios.get<ChucVuItem[]>(API_URL, {
      params: {
        keyword: searchQuery.value || null,
        trangThai: filterStatus.value === '' ? null : filterStatus.value,
      },
      withCredentials: true,
    })
    dataList.value = Array.isArray(res.data) ? res.data : []
  } catch (error: any) {
    console.error('Lỗi fetch:', error)
    showNotification(error.response?.data?.message || 'Lỗi khi lấy dữ liệu chức vụ!', 'error')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchData()
})

// ── COMPUTED ──
const filteredData = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return dataList.value.filter((d) => {
    const matchQ =
      !q ||
      (d.tenLoai && d.tenLoai.toLowerCase().includes(q)) ||
      (d.maLoaiNv && d.maLoaiNv.toLowerCase().includes(q))
    const matchS =
      filterStatus.value === '' || String(d.trangThai) === filterStatus.value
    return matchQ && matchS
  })
})

const totalPages = computed(() => Math.ceil(filteredData.value.length / PER_PAGE) || 1)

const pageData = computed(() => {
  const s = (curPage.value - 1) * PER_PAGE
  return filteredData.value.slice(s, s + PER_PAGE)
})

const statTotal = computed(() => dataList.value.length)
const statActive = computed(() => dataList.value.filter((x) => x.trangThai === 1).length)
const statInactive = computed(() => dataList.value.filter((x) => x.trangThai === 0).length)
const statTotalStaff = computed(() => dataList.value.reduce((acc, curr) => acc + (curr.soNhanVien || 0), 0))

watch([searchQuery, filterStatus], () => {
  curPage.value = 1
})

// ── FORMATTERS ──
const formatVND = (val?: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0)
}

const getStatusChipProps = (status?: number) => {
  if (status === 1) return { label: 'Hoạt động', color: 'success' }
  return { label: 'Khóa / Tạm dừng', color: 'error' }
}

// ── ACTIONS ──
const openCreateDialog = () => {
  dialogMode.value = 'create'
  Object.assign(form, {
    maLoaiNv: '',
    tenLoai: '',
    luong: 5000000,
    moTa: '',
    duocDatLich: false,
    trangThai: 1,
  })
  errors.tenLoai = ''
  errors.luong = ''
  showFormModal.value = true
}

const openEditDialog = (item: ChucVuItem) => {
  dialogMode.value = 'edit'
  Object.assign(form, {
    maLoaiNv: item.maLoaiNv,
    tenLoai: item.tenLoai,
    luong: item.luong || 0,
    moTa: item.moTa || '',
    duocDatLich: item.duocDatLich || false,
    trangThai: item.trangThai ?? 1,
  })
  errors.tenLoai = ''
  errors.luong = ''
  showFormModal.value = true
}

const openDeleteConfirm = (item: ChucVuItem) => {
  selectedItemToDelete.value = item
  showDeleteModal.value = true
}

const validateForm = () => {
  let valid = true
  errors.tenLoai = ''
  errors.luong = ''

  if (!form.tenLoai || !form.tenLoai.trim()) {
    errors.tenLoai = 'Vui lòng nhập tên chức vụ'
    valid = false
  }
  if (form.luong === null || form.luong === undefined || form.luong < 0) {
    errors.luong = 'Lương cơ bản không hợp lệ (phải >= 0)'
    valid = false
  }
  return valid
}

const saveForm = async () => {
  if (!validateForm() || isSubmitting.value) return
  try {
    isSubmitting.value = true
    let res
    if (dialogMode.value === 'edit') {
      res = await axios.put(`${API_URL}/${form.maLoaiNv}`, form, { withCredentials: true })
      logActivity('Cập nhật chức vụ', `Đã cập nhật chức vụ ${form.tenLoai}`, 'Nhân sự')
    } else {
      res = await axios.post(API_URL, form, { withCredentials: true })
      logActivity('Thêm chức vụ', `Đã tạo chức vụ mới: ${form.tenLoai}`, 'Nhân sự')
    }

    showFormModal.value = false
    showNotification(res.data?.message || 'Lưu chức vụ thành công!', 'success')
    fetchData()
  } catch (error: any) {
    console.error('Lỗi save:', error)
    const errorMsg = error.response?.data?.message || 'Lưu chức vụ thất bại!'
    showNotification(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  if (!selectedItemToDelete.value || isSubmitting.value) return
  try {
    isSubmitting.value = true
    const res = await axios.delete(`${API_URL}/${selectedItemToDelete.value.maLoaiNv}`, { withCredentials: true })
    logActivity('Xóa chức vụ', `Đã xóa chức vụ ${selectedItemToDelete.value.tenLoai}`, 'Nhân sự')
    showDeleteModal.value = false
    showNotification(res.data?.message || 'Đã xóa chức vụ thành công!', 'success')
    fetchData()
  } catch (error: any) {
    console.error('Lỗi delete:', error)
    const errorMsg = error.response?.data?.message || 'Không thể xóa chức vụ này!'
    showNotification(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
    selectedItemToDelete.value = null
  }
}
</script>

<template>
  <v-container fluid class="pa-6">
    <!-- ═══════ HIGH-PRIORITY SNACKBAR NOTIFICATION ═══════ -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="top right"
      elevation="24"
      :timeout="3500"
      style="z-index: 99999 !important;"
    >
      <div class="d-flex align-center gap-3">
        <Check v-if="snackbar.color === 'success'" class="w-5 h-5 shrink-0" />
        <AlertCircle v-else-if="snackbar.color === 'error' || snackbar.color === 'warning'" class="w-5 h-5 shrink-0" />
        <Briefcase v-else class="w-5 h-5 shrink-0" />
        <span class="text-subtitle-2 font-weight-medium">{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- ═══════ HEADER CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <Briefcase class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1">
              Quản Lý Chức Vụ &amp; Lương Cơ Bản
            </h2>
            <p class="text-subtitle-2 text-medium-emphasis mb-0">
              Cấu hình danh mục chức vụ, định mức lương cơ bản và phân quyền dịch vụ cho nhân sự
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold"
            :loading="isLoading"
            @click="fetchData"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>

          <v-btn
            color="primary"
            variant="flat"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="openCreateDialog"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Thêm Chức Vụ
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ STATS CARDS (MATCHING SALE.VUE) ═══════ -->
    <v-row class="mb-6">
      <!-- Card 1: Tổng -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Chức Vụ</p>
              <h3 class="text-h4 font-weight-black">{{ statTotal }}</h3>
              <p class="text-caption text-primary font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Layers class="w-3.5 h-3.5" /> <span>Danh mục chức danh</span>
              </p>
            </div>
            <v-avatar color="primary" variant="tonal" size="52" rounded="xl">
              <Briefcase class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Đang hoạt động -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Đang Hoạt Động</p>
              <h3 class="text-h4 font-weight-black text-success">{{ statActive }}</h3>
              <p class="text-caption text-success font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Check class="w-3.5 h-3.5" /> <span>Khả dụng phân công</span>
              </p>
            </div>
            <v-avatar color="success" variant="tonal" size="52" rounded="xl">
              <ShieldCheck class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Khóa / Tạm dừng -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Khóa / Tạm Dừng</p>
              <h3 class="text-h4 font-weight-black">{{ statInactive }}</h3>
              <p class="text-caption text-error font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <AlertCircle class="w-3.5 h-3.5" /> <span>Ngừng xếp lịch</span>
              </p>
            </div>
            <v-avatar color="error" variant="tonal" size="52" rounded="xl">
              <X class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Tổng Nhân Sự -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Nhân Sự</p>
              <h3 class="text-h4 font-weight-black text-info">{{ statTotalStaff }}</h3>
              <p class="text-caption text-info font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Users class="w-3.5 h-3.5" /> <span>Đang làm tại salon</span>
              </p>
            </div>
            <v-avatar color="info" variant="tonal" size="52" rounded="xl">
              <Award class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════ FILTERS CARD ═══════ -->
    <v-card variant="outlined" rounded="xl" class="pa-4 mb-6 bg-surface">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
        <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
          <v-text-field
            v-model="searchQuery"
            placeholder="Tìm kiếm theo mã hoặc tên chức vụ..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            style="min-width: 320px; max-width: 460px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis mr-1 shrink-0" />
            </template>
          </v-text-field>

          <v-select
            v-model="filterStatus"
            :items="[
              { title: 'Tất cả trạng thái', value: '' },
              { title: '🟢 Hoạt động', value: '1' },
              { title: '🔴 Khóa / Tạm dừng', value: '0' }
            ]"
            item-title="title"
            item-value="value"
            label="Trạng thái"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="width: 165px;"
          ></v-select>
        </div>

        <v-btn
          variant="text"
          color="primary"
          rounded="lg"
          class="text-none font-weight-bold"
          height="40"
          @click="() => { searchQuery = ''; filterStatus = ''; }"
        >
          Đặt lại lọc
        </v-btn>
      </div>
    </v-card>

    <!-- ═══════ DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6">
      <v-table class="rounded-xl border" hover>
        <thead>
          <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 14%;">Mã Chức Vụ</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 26%;">Tên Chức Vụ &amp; Mô Tả</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 18%;">Lương Cơ Bản</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 18%;">Phân Loại</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 10%;">Nhân Sự</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 14%;">Trạng Thái</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 10%;">Thao Tác</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <tr v-if="isLoading">
            <td colspan="7" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
              <div class="text-caption text-medium-emphasis">Đang tải dữ liệu chức vụ...</div>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-else-if="filteredData.length === 0">
            <td colspan="7" class="text-center py-10">
              <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                <Briefcase class="w-7 h-7 text-grey" />
              </v-avatar>
              <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy chức vụ nào</div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr v-else v-for="item in pageData" :key="item.maLoaiNv" class="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
            <td class="py-4">
              <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold font-mono">
                {{ item.maLoaiNv }}
              </v-chip>
            </td>

            <td class="py-4">
              <div class="font-weight-bold text-subtitle-2 text-slate-900 dark:text-white leading-tight">
                {{ item.tenLoai }}
              </div>
              <div v-if="item.moTa" class="text-caption text-medium-emphasis mt-0.5 line-clamp-1">
                {{ item.moTa }}
              </div>
            </td>

            <td class="py-4">
              <v-chip color="primary" variant="tonal" size="small" class="font-weight-black">
                {{ formatVND(item.luong) }}
              </v-chip>
            </td>

            <td class="py-4 text-center">
              <v-chip
                v-if="item.duocDatLich"
                color="purple"
                variant="tonal"
                size="small"
                class="font-weight-bold"
              >
                <template v-slot:prepend>
                  <Scissors class="w-3.5 h-3.5 mr-1" />
                </template>
                Thợ làm tóc (Được đặt lịch)
              </v-chip>
              <v-chip v-else color="grey" variant="tonal" size="small" class="font-weight-medium">
                Nhân viên nội bộ
              </v-chip>
            </td>

            <td class="py-4 text-center">
              <v-chip color="info" variant="tonal" size="small" class="font-weight-black">
                {{ item.soNhanVien || 0 }} NV
              </v-chip>
            </td>

            <td class="py-4">
              <v-chip
                :color="getStatusChipProps(item.trangThai).color"
                variant="flat"
                size="small"
                class="font-weight-bold"
              >
                <template v-slot:prepend>
                  <Sparkles v-if="item.trangThai === 1" class="w-3.5 h-3.5 mr-1" />
                  <X v-else class="w-3.5 h-3.5 mr-1" />
                </template>
                {{ getStatusChipProps(item.trangThai).label }}
              </v-chip>
            </td>

            <td class="py-4 text-right">
              <div class="d-flex align-center justify-end gap-1">
                <v-btn
                  icon
                  variant="text"
                  color="warning"
                  size="small"
                  @click="openEditDialog(item)"
                  title="Chỉnh sửa"
                >
                  <Edit3 class="w-4 h-4" />
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  color="error"
                  size="small"
                  @click="openDeleteConfirm(item)"
                  title="Xóa"
                >
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Pagination footer (Matching sale.vue) -->
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between mt-4 px-2 gap-3">
        <span class="text-caption text-medium-emphasis font-weight-semibold">
          Hiển thị {{ pageData.length }} / {{ filteredData.length }} chức vụ
        </span>
        <v-pagination
          v-if="totalPages > 1"
          v-model="curPage"
          :length="totalPages"
          rounded="xl"
          active-color="primary"
          density="compact"
          :total-visible="5"
        ></v-pagination>
      </div>
    </v-card>

    <!-- ═══════ MODAL: TẠO / CHỈNH SỬA CHỨC VỤ (MATCHING SALE.VUE) ═══════ -->
    <v-dialog v-model="showFormModal" max-width="600px" persistent scrollable>
      <v-card rounded="xl">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar :color="dialogMode === 'create' ? 'primary' : 'warning'" size="42" rounded="lg" elevation="2">
              <Plus v-if="dialogMode === 'create'" class="w-5 h-5 text-white" />
              <Edit3 v-else class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">
                {{ dialogMode === 'create' ? 'Thêm Chức Vụ Mới' : 'Cập Nhật Chức Vụ' }}
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Thiết lập thông tin chức danh và định mức lương
              </p>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="showFormModal = false">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveForm">
            <!-- Mã chức vụ -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                Mã Chức Vụ <span class="font-weight-normal text-medium-emphasis">(Tùy chọn)</span>:
              </label>
              <v-text-field
                v-model="form.maLoaiNv"
                :disabled="dialogMode === 'edit'"
                placeholder="VD: LNV01 (Để trống nếu muốn tự động sinh mã)"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
              <p v-if="dialogMode === 'create'" class="text-caption text-medium-emphasis mt-1">
                💡 Để trống nếu muốn hệ thống tự động sinh mã
              </p>
            </div>

            <!-- Tên chức vụ -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                Tên Chức Vụ <span class="text-error">*</span>:
              </label>
              <v-text-field
                v-model="form.tenLoai"
                placeholder="Nhập tên chức vụ (VD: Stylist chính, Thợ phụ...)"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="errors.tenLoai"
              ></v-text-field>
              <p v-if="errors.tenLoai" class="text-caption text-error font-weight-bold mt-1">{{ errors.tenLoai }}</p>
            </div>

            <!-- Lương cơ bản -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                Lương Cơ Bản (VNĐ) <span class="text-error">*</span>:
              </label>
              <v-text-field
                v-model.number="form.luong"
                type="number"
                min="0"
                step="500000"
                placeholder="Nhập định mức lương cơ bản..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="errors.luong"
              ></v-text-field>
              <p v-if="errors.luong" class="text-caption text-error font-weight-bold mt-1">{{ errors.luong }}</p>
              <div class="text-caption text-success font-weight-bold mt-1 d-flex align-center gap-1">
                <DollarSign class="w-4 h-4" />
                <span>Định dạng hiển thị: {{ formatVND(form.luong) }}</span>
              </div>
            </div>

            <!-- Mô tả công việc -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                Mô Tả Nhiệm Vụ Công Việc:
              </label>
              <v-textarea
                v-model="form.moTa"
                placeholder="Nhập tóm tắt mô tả công việc..."
                variant="outlined"
                rounded="lg"
                rows="3"
                hide-details
              ></v-textarea>
            </div>

            <!-- Tùy chọn phân loại & Trạng thái -->
            <v-card variant="flat" border rounded="lg" class="pa-4" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
              <v-switch
                v-model="form.duocDatLich"
                :true-value="true"
                :false-value="false"
                color="primary"
                hide-details
                density="comfortable"
                inset
              >
                <template v-slot:label>
                  <div class="d-flex align-center justify-space-between w-100 font-weight-bold text-body-2">
                    <span>Được Đặt Lịch Hẹn (Dành cho thợ làm tóc)</span>
                  </div>
                </template>
              </v-switch>

              <v-divider class="my-3"></v-divider>

              <div>
                <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">Trạng Thái Chức Vụ:</label>
                <v-select
                  v-model="form.trangThai"
                  :items="[
                    { title: 'Hoạt động', value: 1 },
                    { title: 'Khóa / Tạm dừng', value: 0 }
                  ]"
                  item-title="title"
                  item-value="value"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  hide-details
                ></v-select>
              </div>
            </v-card>
          </v-form>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t d-flex justify-end gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="showFormModal = false"
          >
            Hủy Bỏ
          </v-btn>
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-6"
            :loading="isSubmitting"
            @click="saveForm"
          >
            {{ dialogMode === 'create' ? 'Lưu Chức Vụ' : 'Cập Nhật' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ MODAL: XÁC NHẬN XÓA (MATCHING SALE.VUE) ═══════ -->
    <v-dialog v-model="showDeleteModal" max-width="450px" persistent>
      <v-card rounded="xl" class="pa-6 text-center">
        <div class="d-flex justify-center mb-4">
          <v-avatar color="error-lighten-4" size="64" rounded="circle">
            <Trash2 class="w-8 h-8 text-error" />
          </v-avatar>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa chức vụ?</h3>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Bạn có chắc chắn muốn xóa chức vụ <strong>"{{ selectedItemToDelete?.tenLoai }}"</strong>?
          <br />
          <span class="text-error text-caption font-weight-bold">
            Lưu ý: Không thể xóa nếu đang có nhân viên giữ chức vụ này.
          </span>
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="showDeleteModal = false"
          >
            Hủy Bỏ
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-6"
            :loading="isSubmitting"
            @click="confirmDelete"
          >
            Xóa Ngay
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Ensure Vuetify 3 Switch track has clear, vivid color when toggled ON */
:deep(.v-switch .v-selection-control--dirty .v-switch__track) {
  background-color: rgb(var(--v-theme-primary)) !important;
  opacity: 1 !important;
}

:deep(.v-switch .v-selection-control--dirty .v-switch__thumb) {
  background-color: #ffffff !important;
}
</style>
