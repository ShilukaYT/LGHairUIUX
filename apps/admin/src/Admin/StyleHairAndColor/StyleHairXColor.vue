<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import {
  Scissors,
  Palette,
  Search,
  Plus,
  Pencil,
  Trash2,
  RotateCcw,
  Check,
  X,
  Upload,
  Image as ImageIcon,
  Sparkles,
  AlertCircle
} from 'lucide-vue-next'

// ==========================================
// CẤU HÌNH API URL
// ==========================================
const baseUrrl = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_URL = `${baseUrrl}/api/StyleHairAndColor`

// --- States: Dữ liệu ---
const styleList = ref<any[]>([])
const colorList = ref<any[]>([])
const isLoading = ref(false)
const isSubmitting = ref(false)

// --- States: Tabs & Tìm kiếm ---
const activeTab = ref<'styles' | 'colors'>('styles')
const searchQuery = ref('')
const curPage = ref(1)
const PER_PAGE = 8

// --- States: Dialog Form ---
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')

// Biến lưu trữ item đang thao tác
const currentItem = reactive<any>({
  maKt: '',
  tenKieuToc: '',
  moTa: '',
  hinhAnh: '',
  maMau: '',
  tenMau: '',
  trangThai: 1,
})

const selectedFile = ref<File | null>(null)
const previewImage = ref<string | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// --- COLOR PICKER STATE & PRESETS ---
const isColorMenuOpen = ref(false)
const pickedHexColor = ref('#8B5A2B')

const hairColorPresets = [
  { name: 'Nâu Hạt Dẻ', hex: '#5C4033' },
  { name: 'Nâu Tây', hex: '#8B5A2B' },
  { name: 'Nâu Lạnh', hex: '#4A3728' },
  { name: 'Xám Khói', hex: '#708090' },
  { name: 'Bạch Kim', hex: '#E5E4E2' },
  { name: 'Đỏ Rượu Vang', hex: '#722F37' },
  { name: 'Đỏ Cherry', hex: '#DE3163' },
  { name: 'Tím Khói', hex: '#663399' },
  { name: 'Xanh Rêu', hex: '#2E8B57' },
  { name: 'Vàng Khói', hex: '#D4AF37' },
  { name: 'Đen Tự Nhiên', hex: '#1A1A1A' },
  { name: 'Đen Ánh Xanh', hex: '#0B0B2A' },
  { name: 'Hồng Pastel', hex: '#FFB6C1' },
  { name: 'Cam Đồng', hex: '#B87333' }
]

function isValidHex(hex: string): boolean {
  return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(hex)
}

function onHexColorChosen(val: string) {
  if (val) {
    currentItem.maMau = val.toUpperCase()
  }
}

function selectPresetColor(preset: { name: string; hex: string }) {
  currentItem.maMau = preset.hex.toUpperCase()
  pickedHexColor.value = preset.hex
  if (!currentItem.tenMau.trim()) {
    currentItem.tenMau = preset.name
  }
  isColorMenuOpen.value = false
}

// --- NOTIFICATION (SNACKBAR) ---
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

// ==========================================
// COMPUTED & FILTER
// ==========================================
const filteredStyles = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return styleList.value
  return styleList.value.filter(item =>
    item.tenKieuToc?.toLowerCase().includes(q) ||
    item.maKt?.toLowerCase().includes(q) ||
    item.moTa?.toLowerCase().includes(q)
  )
})

const filteredColors = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return colorList.value
  return colorList.value.filter(item =>
    item.tenMau?.toLowerCase().includes(q) ||
    item.maMau?.toLowerCase().includes(q)
  )
})

const currentListData = computed(() => {
  return activeTab.value === 'styles' ? filteredStyles.value : filteredColors.value
})

const totalPages = computed(() => Math.max(1, Math.ceil(currentListData.value.length / PER_PAGE)))

const paginatedData = computed(() => {
  const start = (curPage.value - 1) * PER_PAGE
  return currentListData.value.slice(start, start + PER_PAGE)
})

// Stats
const statActiveStyles = computed(() => styleList.value.filter(s => s.trangThai === 1).length)
const statActiveColors = computed(() => colorList.value.filter(c => c.trangThai === 1).length)

// ==========================================
// GỌI API FETCH DỮ LIỆU
// ==========================================
const fetchStyles = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(API_URL)
    styleList.value = res.data.data || []
  } catch (error: any) {
    showNotification('Lỗi lấy danh sách Kiểu tóc!', 'error')
  } finally {
    isLoading.value = false
  }
}

const fetchColors = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(`${API_URL}/color`)
    colorList.value = res.data.data || []
  } catch (error: any) {
    showNotification('Lỗi lấy danh sách Màu tóc!', 'error')
  } finally {
    isLoading.value = false
  }
}

const refreshData = () => {
  curPage.value = 1
  if (activeTab.value === 'styles') fetchStyles()
  else fetchColors()
}

onMounted(() => {
  fetchStyles()
  fetchColors()
})

// ==========================================
// ACTIONS: XỬ LÝ FILE & MODAL
// ==========================================
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showNotification('Vui lòng chọn file hình ảnh (JPG, PNG, WEBP).', 'warning')
      return
    }
    selectedFile.value = file
    previewImage.value = URL.createObjectURL(file)
  }
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  selectedFile.value = null
  previewImage.value = null
  pickedHexColor.value = '#8B5A2B'

  if (activeTab.value === 'styles') {
    Object.assign(currentItem, {
      maKt: '',
      tenKieuToc: '',
      moTa: '',
      hinhAnh: '',
      trangThai: 1,
    })
  } else {
    Object.assign(currentItem, {
      maMau: '#8B5A2B',
      tenMau: '',
      trangThai: 1,
    })
  }
  isFormDialogOpen.value = true
}

const openEditDialog = (item: any) => {
  dialogMode.value = 'edit'
  Object.assign(currentItem, JSON.parse(JSON.stringify(item)))
  selectedFile.value = null
  previewImage.value = activeTab.value === 'styles' ? item.hinhAnh : null
  if (activeTab.value === 'colors' && isValidHex(item.maMau)) {
    pickedHexColor.value = item.maMau
  }
  isFormDialogOpen.value = true
}

const openDeleteConfirm = (item: any) => {
  Object.assign(currentItem, JSON.parse(JSON.stringify(item)))
  isDeleteDialogOpen.value = true
}

// ==========================================
// ACTIONS: LƯU & XÓA DỮ LIỆU
// ==========================================
const saveForm = async () => {
  if (isSubmitting.value) return

  try {
    isSubmitting.value = true
    const formData = new FormData()

    if (activeTab.value === 'styles') {
      if (!currentItem.tenKieuToc.trim()) {
        showNotification('Vui lòng nhập tên kiểu tóc!', 'warning')
        isSubmitting.value = false
        return
      }

      formData.append('TenKieuToc', currentItem.tenKieuToc.trim())
      formData.append('MoTa', currentItem.moTa || '')
      formData.append('TrangThai', currentItem.trangThai.toString())
      if (selectedFile.value) formData.append('HinhAnh', selectedFile.value)
      if (dialogMode.value === 'edit') formData.append('id', currentItem.maKt)

      let res
      if (dialogMode.value === 'edit') {
        res = await axios.put(`${API_URL}/${currentItem.maKt}`, formData)
        logActivity('Cập nhật kiểu tóc', `Đã cập nhật kiểu tóc ${currentItem.tenKieuToc}`, 'Kiểu & Màu tóc')
      } else {
        if (!selectedFile.value) {
          showNotification('Vui lòng chọn hình ảnh cho kiểu tóc!', 'warning')
          isSubmitting.value = false
          return
        }
        res = await axios.post(API_URL, formData)
        logActivity('Thêm kiểu tóc', `Đã thêm kiểu tóc mới ${currentItem.tenKieuToc}`, 'Kiểu & Màu tóc')
      }
      showNotification(res.data?.message || 'Lưu kiểu tóc thành công!', 'success')
      fetchStyles()
    } else {
      if (!currentItem.tenMau.trim()) {
        showNotification('Vui lòng nhập tên màu!', 'warning')
        isSubmitting.value = false
        return
      }
      if (dialogMode.value === 'create' && !currentItem.maMau.trim()) {
        showNotification('Vui lòng chọn hoặc nhập mã màu!', 'warning')
        isSubmitting.value = false
        return
      }

      formData.append('MaMau', currentItem.maMau.trim())
      formData.append('TenMau', currentItem.tenMau.trim())
      formData.append('TrangThai', currentItem.trangThai.toString())
      if (dialogMode.value === 'edit') formData.append('id', currentItem.maMau)

      let res
      if (dialogMode.value === 'edit') {
        res = await axios.put(`${API_URL}/color/${currentItem.maMau}`, formData)
        logActivity('Cập nhật màu tóc', `Đã cập nhật màu tóc ${currentItem.tenMau}`, 'Kiểu & Màu tóc')
      } else {
        res = await axios.post(`${API_URL}/color`, formData)
        logActivity('Thêm màu tóc', `Đã thêm màu tóc mới ${currentItem.tenMau}`, 'Kiểu & Màu tóc')
      }
      showNotification(res.data?.message || 'Lưu màu tóc thành công!', 'success')
      fetchColors()
    }

    isFormDialogOpen.value = false
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Lưu thất bại!'
    showNotification(errorMsg, 'error')
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  if (isSubmitting.value) return

  try {
    isSubmitting.value = true
    const formData = new FormData()
    const id = activeTab.value === 'styles' ? currentItem.maKt : currentItem.maMau
    formData.append('id', id)

    let res
    if (activeTab.value === 'styles') {
      res = await axios.delete(`${API_URL}/${id}`, { data: formData })
      logActivity('Xóa kiểu tóc', `Đã xóa kiểu tóc ${currentItem.tenKieuToc}`, 'Kiểu & Màu tóc')
      fetchStyles()
    } else {
      res = await axios.delete(`${API_URL}/color/${id}`, { data: formData })
      logActivity('Xóa màu tóc', `Đã xóa màu tóc ${currentItem.tenMau}`, 'Kiểu & Màu tóc')
      fetchColors()
    }

    showNotification(res.data?.message || 'Đã xóa thành công!', 'success')
    isDeleteDialogOpen.value = false
  } catch (error: any) {
    showNotification(error.response?.data?.message || 'Xóa thất bại!', 'error')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start">
    <!-- ═══════ SNACKBAR NOTIFICATION ═══════ -->
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
        <span class="text-subtitle-2 font-weight-medium">{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- ═══════ HEADER CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6 w-full">
      <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between gap-4">
        <div>
          <h2 class="text-h5 font-weight-bold text-slate-900 dark:text-white d-flex align-center gap-2 mb-1">
            <Scissors class="w-6 h-6 text-primary shrink-0" />
            <span>Quản Lý Style &amp; Màu Tóc</span>
          </h2>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Quản lý danh mục kiểu tóc mẫu và bảng màu nhuộm tóc cho salon
          </p>
        </div>

        <div class="d-flex align-center gap-3 flex-grow-1 justify-lg-end flex-wrap">
          <!-- Search input -->
          <v-text-field
            v-model="searchQuery"
            :placeholder="activeTab === 'styles' ? 'Tìm theo tên kiểu tóc, mã KT...' : 'Tìm theo tên màu, mã màu...'"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="flex-grow-1"
            style="max-width: 320px; width: 100%; min-width: 220px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-slate-400 mr-1 shrink-0" />
            </template>
          </v-text-field>

          <!-- Reload button -->
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            width="40"
            icon
            rounded="xl"
            :loading="isLoading"
            @click="refreshData"
            title="Tải lại"
          >
            <RotateCcw class="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </v-btn>

          <!-- Add Button -->
          <v-btn
            color="primary"
            height="40"
            rounded="xl"
            elevation="2"
            class="text-none font-weight-bold px-5"
            @click="openCreateDialog"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            {{ activeTab === 'styles' ? 'Thêm Kiểu Tóc' : 'Thêm Màu Tóc' }}
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ STATS CARDS (4 CARDS) ═══════ -->
    <v-row class="mb-6 w-full">
      <!-- Card 1: Tổng kiểu tóc -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Kiểu Tóc</p>
              <h3 class="text-h4 font-weight-black">{{ styleList.length }}</h3>
              <p class="text-caption text-primary font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Scissors class="w-3.5 h-3.5" /> <span>Mẫu tóc thiết kế</span>
              </p>
            </div>
            <v-avatar color="primary" variant="tonal" size="52" rounded="xl">
              <Scissors class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Kiểu tóc hoạt động -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Kiểu Tóc Đang Phục Vụ</p>
              <h3 class="text-h4 font-weight-black text-success">{{ statActiveStyles }}</h3>
              <p class="text-caption text-success font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Check class="w-3.5 h-3.5" /> <span>Khả dụng cho khách chọn</span>
              </p>
            </div>
            <v-avatar color="success" variant="tonal" size="52" rounded="xl">
              <Check class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Tổng màu nhuộm -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Bảng Màu Nhuộm</p>
              <h3 class="text-h4 font-weight-black text-warning">{{ colorList.length }}</h3>
              <p class="text-caption text-warning font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Palette class="w-3.5 h-3.5" /> <span>Mã màu trong hệ thống</span>
              </p>
            </div>
            <v-avatar color="warning" variant="tonal" size="52" rounded="xl">
              <Palette class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Màu đang hoạt động -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Màu Đang Phục Vụ</p>
              <h3 class="text-h4 font-weight-black text-info">{{ statActiveColors }}</h3>
              <p class="text-caption text-info font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Sparkles class="w-3.5 h-3.5" /> <span>Sẵn sàng pha chế</span>
              </p>
            </div>
            <v-avatar color="info" variant="tonal" size="52" rounded="xl">
              <Sparkles class="w-6 h-6" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════ TABS & DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 w-full">
      <!-- Tabs bar -->
      <div class="border-b mb-6">
        <v-tabs v-model="activeTab" color="primary" @update:model-value="curPage = 1">
          <v-tab value="styles" class="text-none font-weight-bold px-6">
            <template v-slot:prepend>
              <Scissors class="w-4 h-4 mr-1" />
            </template>
            Danh Mục Kiểu Tóc ({{ styleList.length }})
          </v-tab>
          <v-tab value="colors" class="text-none font-weight-bold px-6">
            <template v-slot:prepend>
              <Palette class="w-4 h-4 mr-1" />
            </template>
            Bảng Màu Nhuộm ({{ colorList.length }})
          </v-tab>
        </v-tabs>
      </div>

      <!-- ── TAB 1: KIỂU TÓC TABLE ── -->
      <div v-if="activeTab === 'styles'" class="overflow-x-auto w-full">
        <v-table class="rounded-xl border w-full" hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 10%;">Hình Ảnh</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 14%;">Mã Kiểu Tóc</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 24%;">Tên Kiểu Tóc</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 28%;">Mô Tả</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 12%;">Trạng Thái</th>
              <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 12%;">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-10">
                <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
                <div class="text-caption text-medium-emphasis font-weight-bold uppercase tracking-wider">Đang tải danh sách kiểu tóc...</div>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="filteredStyles.length === 0">
              <td colspan="6" class="text-center py-10">
                <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                  <Scissors class="w-7 h-7 text-grey" />
                </v-avatar>
                <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy kiểu tóc nào</div>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-else
              v-for="item in paginatedData"
              :key="item.maKt"
            >
              <!-- Hình ảnh -->
              <td class="py-3 text-center">
                <v-avatar size="52" rounded="xl" class="border">
                  <img v-if="item.hinhAnh" :src="item.hinhAnh" alt="hair" class="w-100 h-100 object-cover" />
                  <div v-else class="w-100 h-100 d-flex align-center justify-center bg-slate-100 dark:bg-slate-800">
                    <ImageIcon class="w-5 h-5 text-slate-400" />
                  </div>
                </v-avatar>
              </td>

              <!-- Mã KT -->
              <td class="py-3 text-center">
                <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold">
                  {{ item.maKt }}
                </v-chip>
              </td>

              <!-- Tên kiểu tóc -->
              <td class="py-3 text-left">
                <div class="font-weight-bold text-subtitle-2 text-slate-900 dark:text-white leading-tight">
                  {{ item.tenKieuToc }}
                </div>
              </td>

              <!-- Mô tả -->
              <td class="py-3 text-left">
                <div class="text-body-2 text-medium-emphasis truncate max-w-sm">
                  {{ item.moTa || '—' }}
                </div>
              </td>

              <!-- Trạng thái -->
              <td class="py-3 text-center">
                <v-chip
                  :color="item.trangThai === 1 ? 'success' : 'grey'"
                  variant="flat"
                  size="small"
                  class="font-weight-bold"
                >
                  <template v-slot:prepend>
                    <Check v-if="item.trangThai === 1" class="w-3.5 h-3.5 mr-1" />
                    <X v-else class="w-3.5 h-3.5 mr-1" />
                  </template>
                  {{ item.trangThai === 1 ? 'Hoạt động' : 'Tạm ngưng' }}
                </v-chip>
              </td>

              <!-- Thao tác -->
              <td class="py-3 text-right">
                <div class="d-flex align-center justify-end gap-1">
                  <v-btn
                    icon
                    variant="text"
                    color="warning"
                    size="small"
                    @click="openEditDialog(item)"
                    title="Chỉnh sửa"
                  >
                    <Pencil class="w-4 h-4" />
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
      </div>

      <!-- ── TAB 2: MÀU TÓC TABLE ── -->
      <div v-else class="overflow-x-auto w-full">
        <v-table class="rounded-xl border w-full" hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 20%;">Mã Màu / Gam Màu</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 44%;">Tên Màu Nhuộm</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 18%;">Trạng Thái</th>
              <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 18%;">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <tr v-if="isLoading">
              <td colspan="4" class="text-center py-10">
                <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
                <div class="text-caption text-medium-emphasis font-weight-bold uppercase tracking-wider">Đang tải danh sách màu tóc...</div>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="filteredColors.length === 0">
              <td colspan="4" class="text-center py-10">
                <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                  <Palette class="w-7 h-7 text-grey" />
                </v-avatar>
                <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy màu tóc nào</div>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-else
              v-for="item in paginatedData"
              :key="item.maMau"
              class="transition-colors"
            >
              <!-- Mã màu + Visual Swatch -->
              <td class="py-4 text-center">
                <div class="d-inline-flex align-center gap-2">
                  <div
                    class="w-5 h-5 rounded-md border shadow-xs"
                    :style="{ backgroundColor: isValidHex(item.maMau) ? item.maMau : '#8B5A2B' }"
                  ></div>
                  <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold">
                    {{ item.maMau }}
                  </v-chip>
                </div>
              </td>

              <!-- Tên màu -->
              <td class="py-4 text-left">
                <div class="d-flex align-center gap-2.5">
                  <span class="font-weight-bold text-subtitle-2">{{ item.tenMau }}</span>
                </div>
              </td>

              <!-- Trạng thái -->
              <td class="py-4 text-center">
                <v-chip
                  :color="item.trangThai === 1 ? 'success' : 'grey'"
                  variant="flat"
                  size="small"
                  class="font-weight-bold"
                >
                  <template v-slot:prepend>
                    <Check v-if="item.trangThai === 1" class="w-3.5 h-3.5 mr-1" />
                    <X v-else class="w-3.5 h-3.5 mr-1" />
                  </template>
                  {{ item.trangThai === 1 ? 'Hoạt động' : 'Tạm ngưng' }}
                </v-chip>
              </td>

              <!-- Thao tác -->
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
                    <Pencil class="w-4 h-4" />
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
      </div>

      <!-- Pagination Footer -->
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between mt-4 px-2 gap-3">
        <span class="text-caption text-medium-emphasis font-weight-semibold">
          Hiển thị {{ paginatedData.length }} / {{ currentListData.length }} mục
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

    <!-- ═══════ VUETIFY MODAL: THÊM / SỬA ═══════ -->
    <v-dialog v-model="isFormDialogOpen" max-width="620px" persistent scrollable>
      <v-card rounded="2xl" class="overflow-hidden">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar :color="dialogMode === 'create' ? 'primary' : 'warning'" size="42" rounded="lg" elevation="2">
              <component :is="activeTab === 'styles' ? Scissors : Palette" class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">
                {{ dialogMode === 'create' ? 'Thêm Mới' : 'Cập Nhật' }} {{ activeTab === 'styles' ? 'Kiểu Tóc' : 'Màu Tóc' }}
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Điền đầy đủ thông tin bên dưới để lưu dữ liệu vào hệ thống
              </p>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="isFormDialogOpen = false">
            <X class="w-4 h-4" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <!-- Form Kiểu Tóc -->
          <div v-if="activeTab === 'styles'">
            <!-- Hình ảnh -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                HÌNH ẢNH KIỂU TÓC <span v-if="dialogMode === 'create'" class="text-error">*</span>
              </label>
              <div class="d-flex align-center gap-4 mt-2">
                <v-avatar size="80" rounded="xl" class="border">
                  <img v-if="previewImage" :src="previewImage" alt="preview" class="w-100 h-100 object-cover" />
                  <div v-else class="w-100 h-100 d-flex align-center justify-center" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                    <ImageIcon class="w-6 h-6 text-medium-emphasis" />
                  </div>
                </v-avatar>
                <div>
                  <input ref="fileInputRef" type="file" accept="image/*" class="d-none" @change="handleFileChange" />
                  <v-btn
                    variant="outlined"
                    color="primary"
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="fileInputRef?.click()"
                  >
                    <template v-slot:prepend><Upload class="w-4 h-4 mr-1" /></template>
                    Chọn hình ảnh
                  </v-btn>
                  <p class="text-caption text-medium-emphasis mt-1 mb-0">Hỗ trợ JPG, PNG, WEBP tối đa 5MB</p>
                </div>
              </div>
            </div>

            <!-- Tên kiểu tóc -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TÊN KIỂU TÓC <span class="text-error">*</span></label>
              <v-text-field
                v-model="currentItem.tenKieuToc"
                placeholder="VD: Undercut, Mullet, Layer..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </div>

            <!-- Mô tả -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">MÔ TẢ CHI TIẾT</label>
              <v-textarea
                v-model="currentItem.moTa"
                placeholder="Nhập mô tả đặc điểm kiểu tóc..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                rows="3"
                hide-details
              ></v-textarea>
            </div>

            <!-- Trạng thái -->
            <div v-if="dialogMode === 'edit'">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TRẠNG THÁI</label>
              <v-select
                v-model="currentItem.trangThai"
                :items="[
                  { title: 'Hoạt động', value: 1 },
                  { title: 'Tạm ngưng', value: 0 }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-select>
            </div>
          </div>

          <!-- Form Màu Tóc -->
          <div v-else>
            <!-- Mã màu (Color Picker) -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                MÃ MÀU (HEX / MÃ ĐỊNH DANH) <span class="text-error">*</span>
              </label>
              <v-text-field
                v-model="currentItem.maMau"
                :disabled="dialogMode === 'edit'"
                placeholder="VD: #8B5A2B, #3B2219, #A52A2A..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              >
                <!-- Prepend swatch and color picker button -->
                <template v-slot:prepend-inner>
                  <v-menu :close-on-content-click="false" location="bottom start" transition="scale-transition">
                    <template v-slot:activator="{ props: menuProps }">
                      <div
                        v-bind="menuProps"
                        class="d-flex align-center gap-1.5 cursor-pointer mr-2 pa-1 rounded-md border"
                        style="background-color: rgba(var(--v-theme-on-surface), 0.04);"
                        title="Bấm để chọn bảng màu"
                      >
                        <div
                          class="w-5 h-5 rounded-sm border shadow-xs"
                          :style="{ backgroundColor: isValidHex(currentItem.maMau) ? currentItem.maMau : '#8B5A2B' }"
                        ></div>
                        <Palette class="w-3.5 h-3.5 text-medium-emphasis" />
                      </div>
                    </template>

                    <v-card rounded="xl" elevation="8" class="pa-4" min-width="300" max-width="320">
                      <div class="d-flex align-center justify-space-between mb-2">
                        <span class="text-subtitle-2 font-weight-bold">Bảng Chọn Màu Tóc</span>
                      </div>

                      <v-color-picker
                        v-model="pickedHexColor"
                        mode="hex"
                        hide-inputs
                        show-swatches
                        class="mb-3 w-100 rounded-lg"
                        @update:model-value="onHexColorChosen"
                      ></v-color-picker>

                      <!-- Quick presets -->
                      <div class="text-caption font-weight-bold text-medium-emphasis mb-2">Màu Nhuộm Thịnh Hành:</div>
                      <div class="d-flex flex-wrap gap-1.5 mb-2">
                        <v-tooltip v-for="preset in hairColorPresets" :key="preset.hex" :text="preset.name" location="top">
                          <template v-slot:activator="{ props: tipProps }">
                            <div
                              v-bind="tipProps"
                              class="w-7 h-7 rounded-lg border cursor-pointer transition-transform hover:scale-110 shadow-xs"
                              :style="{ backgroundColor: preset.hex }"
                              @click="selectPresetColor(preset)"
                            ></div>
                          </template>
                        </v-tooltip>
                      </div>
                    </v-card>
                  </v-menu>
                </template>
              </v-text-field>
            </div>

            <!-- Tên màu -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TÊN MÀU NHUỘM <span class="text-error">*</span></label>
              <v-text-field
                v-model="currentItem.tenMau"
                placeholder="VD: Xám khói, Nâu hạt dẻ, Đỏ rượu vang..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </div>

            <!-- Trạng thái -->
            <div v-if="dialogMode === 'edit'">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TRẠNG THÁI</label>
              <v-select
                v-model="currentItem.trangThai"
                :items="[
                  { title: 'Hoạt động', value: 1 },
                  { title: 'Tạm ngưng', value: 0 }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-select>
            </div>
          </div>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t d-flex justify-end gap-3">
          <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" :disabled="isSubmitting" @click="isFormDialogOpen = false">
            Hủy Bỏ
          </v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold px-6" :loading="isSubmitting" @click="saveForm">
            {{ dialogMode === 'create' ? 'Lưu Dữ Liệu' : 'Cập Nhật' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ VUETIFY MODAL: XÁC NHẬN XÓA ═══════ -->
    <v-dialog v-model="isDeleteDialogOpen" max-width="440px" persistent>
      <v-card rounded="2xl" class="pa-6 text-center">
        <div class="d-flex justify-center mb-4">
          <v-avatar color="error-lighten-4" size="64" rounded="circle">
            <Trash2 class="w-8 h-8 text-error" />
          </v-avatar>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa?</h3>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa 
          <strong>"{{ activeTab === 'styles' ? currentItem.tenKieuToc : currentItem.tenMau }}"</strong> không?
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            :disabled="isSubmitting"
            @click="isDeleteDialogOpen = false"
          >
            Hủy
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-6"
            :loading="isSubmitting"
            @click="confirmDelete"
          >
            Xóa vĩnh viễn
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>