<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import {
  FolderKanban,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  Check,
  X,
  RotateCcw,
  ImagePlus,
  ImageOff,
  Image as ImageIcon,
  Layers,
  Sparkles,
  AlertCircle,
  Scissors
} from 'lucide-vue-next'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

// ── DATA ──────────────────────────────────────────────────────────
const danhMucs = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const isDeleting = ref(false)

const search = ref('')
const filterStatus = ref('')
const curPage = ref(1)
const PER_PAGE = 8

const editingId = ref<string | null>(null)
const selectedItemToDelete = ref<any | null>(null)

const modal = reactive({
  open: false,
  mode: 'form', // 'form' | 'view'
  title: '',
})

const showDeleteModal = ref(false)

const form = reactive({
  maDM: '',
  tenDanhMuc: '',
  trangThai: 1,
  hinhAnh: null as string | null,
  soDichVu: 0,
  ngayTao: null as string | null,
})

const errors = reactive({
  tenDanhMuc: '',
})

// ── ẢNH DANH MỤC ──────────────────────────────────────────────────
const fileInput = ref<HTMLInputElement | null>(null)
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const removeImage = ref(false)
const MAX_IMAGE_MB = 5
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

// ── NOTIFICATION (SNACKBAR) ───────────────────────────────────────
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
})

function showToast(msg: string, type: 'success' | 'error' | 'warning' = 'success') {
  snackbar.text = msg
  snackbar.color = type === 'success' ? 'success' : type === 'error' ? 'error' : 'warning'
  snackbar.show = true
}

// ── LOAD DATA ─────────────────────────────────────────────────────
async function loadData() {
  loading.value = true
  try {
    const res = await axios.get(`${API}/api/DanhMuc`, {
      params: {
        keyword: search.value || null,
        trangThai: filterStatus.value === '' ? null : filterStatus.value,
      },
    })
    const mapped = res.data.map((d: any) => ({
      maDM: d.maDM,
      tenDanhMuc: d.tenDanhMuc,
      hinhAnh: d.hinhAnh ?? null,
      ngayTao: d.ngayTao,
      trangThai: d.trangThai,
      soDichVu: d.soDichVu ?? 0,
    }))

    const dmNum = (maDM: string) => {
      const n = parseInt(String(maDM || '').replace(/^DM/i, ''), 10)
      return isNaN(n) ? -1 : n
    }
    mapped.sort((a: any, b: any) => dmNum(b.maDM) - dmNum(a.maDM))

    danhMucs.value = mapped
  } catch {
    showToast('Lỗi tải danh mục dịch vụ!', 'error')
  } finally {
    loading.value = false
  }
}

// ── COMPUTED ───────────────────────────────────────────────────────
const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim()
  return danhMucs.value.filter((d: any) => {
    const mq =
      !q ||
      d.tenDanhMuc?.toLowerCase().includes(q) ||
      d.maDM?.toLowerCase().includes(q)
    const ms =
      filterStatus.value === '' || String(d.trangThai) === filterStatus.value
    return mq && ms
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredData.value.length / PER_PAGE)))

const paginatedData = computed(() => {
  const start = (curPage.value - 1) * PER_PAGE
  return filteredData.value.slice(start, start + PER_PAGE)
})

const statActive = computed(() => danhMucs.value.filter((d: any) => d.trangThai === 1 || d.trangThai === true).length)
const statInactive = computed(() => danhMucs.value.filter((d: any) => d.trangThai === 0 || d.trangThai === false).length)
const statTotalDV = computed(() => danhMucs.value.reduce((a: number, b: any) => a + (b.soDichVu || 0), 0))

function fmtDate(val: any) {
  if (!val) return '---'
  const d = new Date(val)
  return isNaN(d.getTime()) ? val : d.toLocaleDateString('vi-VN')
}

// ── ẢNH ACTIONS ───────────────────────────────────────────────────
function resetImageState() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = null
  imagePreview.value = null
  removeImage.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function triggerFilePicker() {
  fileInput.value?.click()
}

function onImageSelected(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    showToast('Chỉ chấp nhận ảnh JPG, PNG, WEBP, GIF.', 'error')
    target.value = ''
    return
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    showToast(`Dung lượng ảnh tối đa ${MAX_IMAGE_MB}MB.`, 'error')
    target.value = ''
    return
  }

  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  removeImage.value = false
}

function clearNewImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imageFile.value = null
  imagePreview.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function markRemoveExistingImage() {
  clearNewImage()
  removeImage.value = true
  form.hinhAnh = null
}

// ── VALIDATE ───────────────────────────────────────────────────────
function validate() {
  errors.tenDanhMuc = ''
  if (!form.tenDanhMuc.trim()) {
    errors.tenDanhMuc = 'Tên danh mục không được để trống.'
    return false
  }
  if (form.tenDanhMuc.trim().length < 2) {
    errors.tenDanhMuc = 'Tên tối thiểu 2 ký tự.'
    return false
  }
  return true
}

// ── MODAL OPEN / CLOSE ─────────────────────────────────────────────
function openAdd() {
  editingId.value = null
  errors.tenDanhMuc = ''
  resetImageState()
  Object.assign(form, {
    maDM: '',
    tenDanhMuc: '',
    trangThai: 1,
    hinhAnh: null,
    soDichVu: 0,
    ngayTao: null,
  })
  modal.mode = 'form'
  modal.title = 'Thêm Danh Mục Dịch Vụ'
  modal.open = true
}

function openEdit(d: any) {
  editingId.value = d.maDM
  errors.tenDanhMuc = ''
  resetImageState()
  Object.assign(form, {
    maDM: d.maDM,
    tenDanhMuc: d.tenDanhMuc,
    trangThai: d.trangThai ? 1 : 0,
    hinhAnh: d.hinhAnh ?? null,
    soDichVu: d.soDichVu ?? 0,
    ngayTao: d.ngayTao,
  })
  modal.mode = 'form'
  modal.title = 'Chỉnh Sửa Danh Mục'
  modal.open = true
}

function openView(d: any) {
  Object.assign(form, { ...d })
  modal.mode = 'view'
  modal.title = 'Chi Tiết Danh Mục Dịch Vụ'
  modal.open = true
}

function closeModal() {
  modal.open = false
  editingId.value = null
  resetImageState()
}

// ── SAVE / DELETE ──────────────────────────────────────────────────
async function saveItem() {
  if (!validate() || saving.value) return
  saving.value = true
  try {
    const fd = new FormData()
    fd.append('TenDanhMuc', form.tenDanhMuc.trim())
    fd.append('TrangThai', String(form.trangThai))

    if (imageFile.value) {
      fd.append('HinhAnh', imageFile.value)
    } else if (editingId.value && removeImage.value) {
      fd.append('XoaHinh', 'true')
    }

    if (editingId.value) {
      await axios.put(`${API}/api/DanhMuc/${editingId.value}`, fd)
      logActivity('Cập nhật danh mục', `Đã cập nhật danh mục dịch vụ ${form.tenDanhMuc} (Mã: ${editingId.value})`, 'Dịch vụ')
      showToast('Cập nhật danh mục thành công!')
    } else {
      const res = await axios.post(`${API}/api/DanhMuc`, fd)
      const newMaDM = res.data?.maDM || ''
      logActivity('Thêm danh mục', `Đã thêm danh mục dịch vụ mới ${form.tenDanhMuc} (Mã: ${newMaDM})`, 'Dịch vụ')
      showToast('Thêm danh mục thành công!')
    }
    await loadData()
    closeModal()
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Lỗi khi lưu danh mục!'
    showToast(msg, 'error')
  } finally {
    saving.value = false
  }
}

function askDelete(d: any) {
  selectedItemToDelete.value = d
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!selectedItemToDelete.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await axios.delete(`${API}/api/DanhMuc/${selectedItemToDelete.value.maDM}`)
    logActivity('Xóa danh mục', `Đã xóa danh mục dịch vụ ${selectedItemToDelete.value.tenDanhMuc} (Mã: ${selectedItemToDelete.value.maDM})`, 'Dịch vụ')
    showToast(`Đã xóa danh mục "${selectedItemToDelete.value.tenDanhMuc}" thành công!`)
    showDeleteModal.value = false
    selectedItemToDelete.value = null
    await loadData()
  } catch (err: any) {
    const msg = err.response?.data?.message || 'Lỗi khi xóa danh mục!'
    showToast(msg, 'error')
  } finally {
    isDeleting.value = false
  }
}

async function toggleStatus(d: any) {
  const newStatus = d.trangThai ? 0 : 1
  try {
    await axios.patch(`${API}/api/DanhMuc/${d.maDM}/trangthai`, {
      trangThai: newStatus,
    })
    logActivity(
      'Đổi trạng thái danh mục',
      `Đã chuyển trạng thái danh mục dịch vụ ${d.tenDanhMuc} sang ${newStatus ? 'Hoạt động' : 'Ngừng hoạt động'}`,
      'Dịch vụ'
    )
    d.trangThai = newStatus
    showToast(newStatus ? 'Đã kích hoạt danh mục.' : 'Đã ngừng hoạt động danh mục.')
  } catch {
    showToast('Lỗi cập nhật trạng thái!', 'error')
  }
}

onMounted(loadData)
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start">
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
        <AlertCircle v-else class="w-5 h-5 shrink-0" />
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
          <h2 class="text-h5 font-weight-bold d-flex align-center gap-2 mb-1">
            <!-- <FolderKanban class="w-6 h-6 text-primary shrink-0" /> -->
            <span>Quản Lý Danh Mục Dịch Vụ</span>
          </h2>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Quản lý và phân nhóm danh mục dịch vụ làm tóc, bảng giá và phân loại chuyên nghiệp
          </p>
        </div>

        <div class="d-flex align-center gap-3 flex-grow-1 justify-lg-end flex-wrap">
          <!-- Search input -->
          <v-text-field
            v-model="search"
            placeholder="Tìm kiếm danh mục, mã DM..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="flex-grow-1"
            style="max-width: 320px; width: 100%; min-width: 220px;"
            @update:model-value="curPage = 1"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis mr-1 shrink-0" />
            </template>
          </v-text-field>

          <!-- Status select -->
          <v-select
            v-model="filterStatus"
            :items="[
              { title: 'Tất cả trạng thái', value: '' },
              { title: '🟢 Hoạt động', value: '1' },
              { title: '🔴 Ngừng hoạt động', value: '0' }
            ]"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            style="max-width: 190px; min-width: 160px;"
            @update:model-value="curPage = 1"
          ></v-select>

          <!-- Reload button -->
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            width="40"
            icon
            rounded="xl"
            :loading="loading"
            @click="loadData"
            title="Tải lại"
          >
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <!-- Add Button -->
          <v-btn
            color="primary"
            height="40"
            rounded="xl"
            elevation="2"
            class="text-none font-weight-bold px-5"
            @click="openAdd"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Thêm Danh Mục
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ STATS CARDS (4 CARDS) ═══════ -->
    <v-row class="mb-6 w-full">
      <!-- Card 1: Tổng danh mục -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Danh Mục</p>
              <h3 class="text-h4 font-weight-black">{{ danhMucs.length }}</h3>
              <p class="text-caption text-primary font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Layers class="w-3.5 h-3.5" /> <span>{{ statActive }} đang hoạt động</span>
              </p>
            </div>
            <!-- <v-avatar color="primary" variant="tonal" size="52" rounded="xl">
              <FolderKanban class="w-6 h-6" />
            </v-avatar> -->
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
                <Check class="w-3.5 h-3.5" /> <span>Hiển thị trên hệ thống</span>
              </p>
            </div>
            <!-- <v-avatar color="success" variant="tonal" size="52" rounded="xl">
              <Check class="w-6 h-6" />
            </v-avatar> -->
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Ngừng hoạt động -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Ngừng Hoạt Động</p>
              <h3 class="text-h4 font-weight-black">{{ statInactive }}</h3>
              <p class="text-caption text-error font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <AlertCircle class="w-3.5 h-3.5" /> <span>Tạm ẩn danh mục</span>
              </p>
            </div>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Tổng dịch vụ -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Dịch Vụ</p>
              <h3 class="text-h4 font-weight-black text-info">{{ statTotalDV }}</h3>
              <p class="text-caption text-info font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Scissors class="w-3.5 h-3.5" /> <span>Trong tất cả danh mục</span>
              </p>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════ DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 w-full">
      <div class="overflow-x-auto w-full">
        <v-table class="rounded-xl border w-full" hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 10%;">Ảnh</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 14%;">Mã DM</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 30%;">Tên Danh Mục</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 16%;">Số Dịch Vụ</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 14%;">Trạng Thái</th>
              <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 16%;">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <tr v-if="loading">
              <td colspan="6" class="text-center py-10">
                <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
                <div class="text-caption text-medium-emphasis font-weight-bold uppercase tracking-wider">Đang tải danh mục dịch vụ...</div>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="filteredData.length === 0">
              <td colspan="6" class="text-center py-10">
                <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                  <FolderKanban class="w-7 h-7 text-grey" />
                </v-avatar>
                <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy danh mục nào</div>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-else
              v-for="item in paginatedData"
              :key="item.maDM"
              class="transition-colors"
            >
              <!-- Ảnh -->
              <td class="py-3 text-center">
                <v-avatar size="48" rounded="xl" class="border">
                  <img v-if="item.hinhAnh" :src="item.hinhAnh" alt="Category" class="w-100 h-100 object-cover" />
                  <div v-else class="w-100 h-100 d-flex align-center justify-center" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                    <ImageIcon class="w-5 h-5 text-medium-emphasis" />
                  </div>
                </v-avatar>
              </td>

              <!-- Mã DM -->
              <td class="py-3 text-center">
                <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold font-mono">
                  {{ item.maDM }}
                </v-chip>
              </td>

              <!-- Tên Danh Mục -->
              <td class="py-3 text-left">
                <div class="font-weight-bold text-subtitle-2 leading-tight">
                  {{ item.tenDanhMuc }}
                </div>
                <div class="text-caption text-medium-emphasis mt-0.5">
                  Ngày tạo: {{ fmtDate(item.ngayTao) }}
                </div>
              </td>

              <!-- Số Dịch Vụ -->
              <td class="py-3 text-center">
                <v-chip size="small" variant="tonal" color="info" class="font-weight-bold">
                  <Scissors class="w-3.5 h-3.5 mr-1" />
                  {{ item.soDichVu }} dịch vụ
                </v-chip>
              </td>

              <!-- Trạng Thái -->
              <td class="py-3 text-center">
                <v-chip
                  :color="item.trangThai ? 'success' : 'grey'"
                  variant="flat"
                  size="small"
                  class="font-weight-bold cursor-pointer"
                  :title="item.trangThai ? 'Bấm để ngừng hoạt động' : 'Bấm để kích hoạt'"
                  @click="toggleStatus(item)"
                >
                  <template v-slot:prepend>
                    <Check v-if="item.trangThai" class="w-3.5 h-3.5 mr-1" />
                    <X v-else class="w-3.5 h-3.5 mr-1" />
                  </template>
                  {{ item.trangThai ? 'Hoạt động' : 'Tạm ngưng' }}
                </v-chip>
              </td>

              <!-- Thao Tác -->
              <td class="py-3 text-right">
                <div class="d-flex align-center justify-end gap-1">
                  <v-btn
                    icon
                    variant="text"
                    color="primary"
                    size="small"
                    @click="openView(item)"
                    title="Xem chi tiết"
                  >
                    <Eye class="w-4 h-4" />
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    color="warning"
                    size="small"
                    @click="openEdit(item)"
                    title="Chỉnh sửa"
                  >
                    <Pencil class="w-4 h-4" />
                  </v-btn>
                  <v-btn
                    icon
                    variant="text"
                    color="error"
                    size="small"
                    @click="askDelete(item)"
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
          Hiển thị {{ paginatedData.length }} / {{ filteredData.length }} danh mục
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

    <!-- ═══════ VUETIFY MODAL: THÊM / SỬA / XEM ═══════ -->
    <v-dialog v-model="modal.open" max-width="580px" persistent scrollable>
      <v-card rounded="2xl" class="overflow-hidden">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar :color="modal.mode === 'view' ? 'info' : (editingId ? 'warning' : 'primary')" size="42" rounded="lg" elevation="2">
              <Eye v-if="modal.mode === 'view'" class="w-5 h-5 text-white" />
              <Pencil v-else-if="editingId" class="w-5 h-5 text-white" />
              <Plus v-else class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">{{ modal.title }}</h3>
              <p class="text-caption text-medium-emphasis mb-0">
                {{ modal.mode === 'view' ? 'Xem đầy đủ thông tin danh mục dịch vụ' : 'Điền thông tin danh mục dịch vụ để lưu vào hệ thống' }}
              </p>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeModal">
            <X class="w-4 h-4" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <!-- VIEW MODE -->
          <template v-if="modal.mode === 'view'">
            <div class="d-flex flex-column align-center mb-6">
              <v-avatar size="100" rounded="2xl" class="border mb-3 shadow-xs">
                <img v-if="form.hinhAnh" :src="form.hinhAnh" alt="preview" class="w-100 h-100 object-cover" />
                <div v-else class="w-100 h-100 d-flex align-center justify-center" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <ImageIcon class="w-8 h-8 text-medium-emphasis" />
                </div>
              </v-avatar>
              <h4 class="text-h6 font-weight-bold mb-1">{{ form.tenDanhMuc }}</h4>
              <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold font-mono">
                {{ form.maDM }}
              </v-chip>
            </div>

            <v-row dense>
              <v-col cols="6">
                <div class="pa-3 rounded-xl border" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
                  <span class="text-caption text-medium-emphasis d-block mb-1">Trạng thái</span>
                  <v-chip :color="form.trangThai ? 'success' : 'grey'" size="small" variant="flat" class="font-weight-bold">
                    {{ form.trangThai ? 'Hoạt động' : 'Tạm ngưng' }}
                  </v-chip>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="pa-3 rounded-xl border" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
                  <span class="text-caption text-medium-emphasis d-block mb-1">Số dịch vụ</span>
                  <span class="font-weight-bold text-subtitle-2 text-primary">{{ form.soDichVu || 0 }} dịch vụ</span>
                </div>
              </v-col>
              <v-col cols="12" class="mt-2">
                <div class="pa-3 rounded-xl border" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
                  <span class="text-caption text-medium-emphasis d-block mb-1">Ngày tạo danh mục</span>
                  <span class="font-weight-bold text-body-2">{{ fmtDate(form.ngayTao) }}</span>
                </div>
              </v-col>
            </v-row>
          </template>

          <!-- FORM MODE (ADD/EDIT) -->
          <v-form v-else @submit.prevent="saveItem">
            <!-- Ảnh danh mục -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                HÌNH ẢNH DANH MỤC <span class="text-caption font-weight-normal text-medium-emphasis">(Tùy chọn)</span>
              </label>
              <div class="d-flex align-center gap-4 mt-2">
                <v-avatar size="80" rounded="xl" class="border">
                  <img v-if="imagePreview" :src="imagePreview" alt="preview" class="w-100 h-100 object-cover" />
                  <img v-else-if="form.hinhAnh" :src="form.hinhAnh" alt="current" class="w-100 h-100 object-cover" />
                  <div v-else class="w-100 h-100 d-flex align-center justify-center" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                    <ImageIcon class="w-6 h-6 text-medium-emphasis" />
                  </div>
                </v-avatar>
                <div>
                  <input ref="fileInput" type="file" accept="image/*" class="d-none" @change="onImageSelected" />
                  <div class="d-flex align-center gap-2">
                    <v-btn
                      variant="outlined"
                      color="primary"
                      rounded="lg"
                      size="small"
                      class="text-none font-weight-bold"
                      @click="triggerFilePicker"
                    >
                      <template v-slot:prepend><ImagePlus class="w-4 h-4 mr-1" /></template>
                      {{ imagePreview || form.hinhAnh ? 'Đổi ảnh' : 'Tải ảnh lên' }}
                    </v-btn>
                    <v-btn
                      v-if="imagePreview"
                      variant="text"
                      color="grey-darken-1"
                      size="small"
                      rounded="lg"
                      class="text-none"
                      @click="clearNewImage"
                    >
                      Hủy ảnh mới
                    </v-btn>
                    <v-btn
                      v-else-if="editingId && form.hinhAnh"
                      variant="text"
                      color="error"
                      size="small"
                      rounded="lg"
                      class="text-none"
                      @click="markRemoveExistingImage"
                    >
                      <template v-slot:prepend><ImageOff class="w-4 h-4 mr-1" /></template>
                      Xóa ảnh
                    </v-btn>
                  </div>
                  <p class="text-caption text-medium-emphasis mt-1 mb-0">Hỗ trợ JPG, PNG, WEBP, GIF tối đa 5MB</p>
                </div>
              </div>
            </div>

              <!-- <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã danh mục</div>
                <v-text-field
                  :model-value="editingId ? form.maDM : 'Tự động sinh mã'"
                  variant="outlined" density="comfortable" rounded="lg"
                  readonly
                  disabled
                  hint="Mã danh mục được hệ thống tự động sinh (DM01, DM02, ...)"
                  persistent-hint
                ></v-text-field>
              </v-col> -->
              <!-- <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Tên danh mục *</div>
                <v-text-field
                  v-model="form.tenDanhMuc"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: Cắt tóc" maxlength="100"
                  :error-messages="errors.tenDanhMuc"
                  @update:model-value="errors.tenDanhMuc = ''"
                ></v-text-field>
              </v-col> -->

            <!-- Tên danh mục -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
                TÊN DANH MỤC <span class="text-error">*</span>
              </label>
              <v-text-field
                v-model="form.tenDanhMuc"
                placeholder="VD: Cắt tóc nam, Nhuộm tóc thời trang, Uốn tóc..."
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="errors.tenDanhMuc"
                @update:model-value="errors.tenDanhMuc = ''"
              ></v-text-field>
              <p v-if="errors.tenDanhMuc" class="text-caption text-error font-weight-bold mt-1">{{ errors.tenDanhMuc }}</p>
            </div>

            <!-- Trạng thái -->
            <div class="mb-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TRẠNG THÁI HOẠT ĐỘNG</label>
              <v-select
                v-model="form.trangThai"
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
          </v-form>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t d-flex justify-end gap-3">
          <template v-if="modal.mode === 'view'">
            <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" @click="closeModal">
              Đóng
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              rounded="lg"
              class="text-none font-weight-bold px-6"
              @click="openEdit({ maDM: form.maDM, tenDanhMuc: form.tenDanhMuc, trangThai: form.trangThai, ngayTao: form.ngayTao, soDichVu: form.soDichVu, hinhAnh: form.hinhAnh })"
            >
              Chỉnh Sửa
            </v-btn>
          </template>
          <template v-else>
            <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" :disabled="saving" @click="closeModal">
              Hủy Bỏ
            </v-btn>
            <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold px-6" :loading="saving" @click="saveItem">
              {{ editingId ? 'Lưu Thay Đổi' : 'Tạo Danh Mục' }}
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ VUETIFY MODAL: XÁC NHẬN XÓA ═══════ -->
    <v-dialog v-model="showDeleteModal" max-width="440px" persistent>
      <v-card rounded="2xl" class="pa-6 text-center">
        <div class="d-flex justify-center mb-4">
          <v-avatar color="error-lighten-4" size="64" rounded="circle">
            <Trash2 class="w-8 h-8 text-error" />
          </v-avatar>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa danh mục?</h3>
        <p class="text-body-2 text-medium-emphasis mb-2">
          Bạn có chắc chắn muốn xóa danh mục 
          <strong>"{{ selectedItemToDelete?.tenDanhMuc }}"</strong> không?
        </p>
        <p class="text-caption text-warning mb-6">
          ⚠️ Danh mục có chứa dịch vụ liên kết sẽ không thể xóa trực tiếp.
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            :disabled="isDeleting"
            @click="showDeleteModal = false"
          >
            Hủy
          </v-btn>
          <v-btn
            color="error"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-6"
            :loading="isDeleting"
            @click="confirmDelete"
          >
            Xóa vĩnh viễn
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>