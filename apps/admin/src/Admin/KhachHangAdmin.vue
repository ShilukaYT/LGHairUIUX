<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  ChevronLeft,
  ChevronRight,
  Upload,
  Eye,
  EyeOff,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  Users
} from 'lucide-vue-next'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const BASE = `${API}/api/admin/khach-hang`

interface KhachHangRow {
  maKh: string
  hoTen: string | null
  sdt: string | null
  email: string | null
  maRank: string | null
  tenRank: string | null
  diemTichLuy: number | null
  trangThai: number | null
  ngayTao: string | null
}

interface DetailRow extends KhachHangRow {
  gioiTinh: string | null
  hinhAnh: string | null
  /** Mật khẩu hiện tại (API admin; DB plain text). */
  matKhau?: string | null
}

const list = ref<KhachHangRow[]>([])
const totalCount = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const trangThaiFilter = ref<string>('all')
const loading = ref(false)

const editOpen = ref(false)
const createOpen = ref(false)
const saving = ref(false)
const editingMaKh = ref<string | null>(null)
/** Giá trị mật khẩu lúc mở form sửa (để chỉ gửi API khi thật sự đổi). */
const editMatKhauBanDau = ref('')

// ── DELETE DIALOG STATE ──
const showDeleteModal = ref(false)
const selectedItemToDelete = ref<KhachHangRow | null>(null)
const isDeleting = ref(false)

// ── PASSWORD RESULT MODAL ──
const passwordResultModal = reactive({
  show: false,
  title: '',
  message: '',
})

// ── NOTIFICATION (SNACKBAR) ──
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

const editForm = ref({
  hoTen: '',
  email: '',
  sdt: '',
  gioiTinh: '',
  diemTichLuy: '' as string,
  trangThai: '1',
  hinhAnh: '',
  matKhauMoi: '',
  tenRank: '' as string,
})

/** Mặc định khi thêm khách: tên hiển thị cho khách không lưu hồ sơ / tới trực tiếp. */
const TEN_KHACH_VANG_LAI = 'Khách vãng lai'

const createLoaiKhach = ref<'vang_lai' | 'ten_cu_the'>('vang_lai')

const createForm = ref({
  hoTen: TEN_KHACH_VANG_LAI,
  sdt: '',
  email: '',
  gioiTinh: '',
  matKhau: '',
  hinhAnh: '',
})

const avatarUploading = ref(false)
const editAvatarFileRef = ref<HTMLInputElement | null>(null)
const createAvatarFileRef = ref<HTMLInputElement | null>(null)

/** Mặc định hiện ký tự mật khẩu khi tạo/sửa (có nút ẩn nếu cần). */
const showCreatePassword = ref(true)
const showEditPassword = ref(true)
const createSdtError = ref('')
const createEmailError = ref('')
const createGioiTinhError = ref('')
const createAvatarError = ref('')

function normalizeSdtVn(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('84') && d.length >= 10) d = `0${d.slice(2)}`
  return d
}

/** SĐT VN: 10–11 chữ số, bắt đầu bằng 0 (sau chuẩn hóa +84 → 0). */
function validateSdtVn(raw: string): { ok: true; sdt: string } | { ok: false; message: string } {
  const sdt = normalizeSdtVn(raw)
  if (!sdt) return { ok: false, message: 'Vui lòng nhập số điện thoại.' }
  if (!/^\d+$/.test(sdt)) return { ok: false, message: 'Số điện thoại chỉ được chứa chữ số.' }
  if (sdt.length < 10 || sdt.length > 11)
    return { ok: false, message: 'Số điện thoại không hợp lệ (cần 10–11 số, ví dụ 09xxxxxxxx).' }
  if (!sdt.startsWith('0')) return { ok: false, message: 'Số điện thoại Việt Nam phải bắt đầu bằng 0.' }
  return { ok: true, sdt }
}

function validateEmail(raw: string): { ok: true; email: string } | { ok: false; message: string } {
  const email = raw.trim()
  if (!email) return { ok: false, message: 'Vui lòng nhập email.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Email không hợp lệ.' }
  return { ok: true, email }
}

function toggleCreatePassword() {
  showCreatePassword.value = !showCreatePassword.value
}

function toggleEditPassword() {
  showEditPassword.value = !showEditPassword.value
}

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize.value)))

function mediaUrl(path: string | null | undefined) {
  const p = path?.trim()
  if (!p) return ''
  if (p.startsWith('http')) return p
  const base = API.replace(/\/$/, '')
  return `${base}${p.startsWith('/') ? '' : '/'}${p}`
}

async function uploadAvatarFile(file: File, target: 'edit' | 'create') {
  const fd = new FormData()
  fd.append('file', file)
  avatarUploading.value = true
  try {
    const res = await axios.post<{ duongDan: string }>(`${BASE}/upload-avatar`, fd, {
      withCredentials: true,
    })
    const path = res.data.duongDan
    if (target === 'edit') editForm.value.hinhAnh = path
    else createForm.value.hinhAnh = path
    showNotification('Đã tải ảnh lên thành công.', 'success')
    if (target === 'create') createAvatarError.value = ''
  } catch {
    showNotification('Không upload được ảnh.', 'error')
  } finally {
    avatarUploading.value = false
  }
}

function onPickAvatar(e: Event, target: 'edit' | 'create') {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showNotification('Chỉ chọn file ảnh (JPG, PNG, WEBP).', 'warning')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Ảnh tối đa 5MB.', 'warning')
    return
  }
  uploadAvatarFile(file, target)
}

function clearAvatar(target: 'edit' | 'create') {
  if (target === 'edit') editForm.value.hinhAnh = ''
  else createForm.value.hinhAnh = ''
}

async function fetchList() {
  loading.value = true
  try {
    const params: Record<string, string | number> = {
      page: page.value,
      pageSize: pageSize.value,
    }
    if (keyword.value.trim()) params.keyword = keyword.value.trim()
    if (trangThaiFilter.value !== 'all') params.trangThai = Number(trangThaiFilter.value)

    const res = await axios.get<{
      items: KhachHangRow[]
      totalCount: number
      page: number
      pageSize: number
    }>(BASE, { params, withCredentials: true })

    list.value = res.data.items ?? []
    totalCount.value = res.data.totalCount ?? 0
  } catch {
    list.value = []
    showNotification('Không tải được danh sách khách hàng.', 'error')
  } finally {
    loading.value = false
  }
}

async function handleRefresh() {
  await fetchList()
  showNotification('Đã làm mới danh sách khách hàng!', 'success')
}

function onCreateLoaiChange(v: string) {
  if (v === 'vang_lai') {
    createLoaiKhach.value = 'vang_lai'
    createForm.value.hoTen = TEN_KHACH_VANG_LAI
  } else {
    createLoaiKhach.value = 'ten_cu_the'
    if (createForm.value.hoTen === TEN_KHACH_VANG_LAI) createForm.value.hoTen = ''
  }
}

function openCreate() {
  createLoaiKhach.value = 'vang_lai'
  createForm.value = {
    hoTen: TEN_KHACH_VANG_LAI,
    sdt: '',
    email: '',
    gioiTinh: 'Nam',
    matKhau: '',
    hinhAnh: '',
  }
  createSdtError.value = ''
  createEmailError.value = ''
  createGioiTinhError.value = ''
  createAvatarError.value = ''
  showCreatePassword.value = true
  createOpen.value = true
}

async function openEdit(row: KhachHangRow) {
  editingMaKh.value = row.maKh
  editOpen.value = true
  saving.value = false
  showEditPassword.value = false
  try {
    const res = await axios.get<DetailRow>(`${BASE}/${encodeURIComponent(row.maKh)}`, {
      withCredentials: true,
    })
    const d = res.data
    editForm.value = {
      hoTen: d.hoTen ?? '',
      email: d.email ?? '',
      sdt: d.sdt ?? '',
      gioiTinh: d.gioiTinh ?? 'Nam',
      diemTichLuy: d.diemTichLuy != null ? String(d.diemTichLuy) : '0',
      trangThai: d.trangThai != null ? String(d.trangThai) : '1',
      hinhAnh: d.hinhAnh ?? '',
      matKhauMoi: '',
      tenRank: d.tenRank ?? d.maRank ?? '',
    }
  } catch {
    showNotification('Không tải được chi tiết khách hàng.', 'error')
    editOpen.value = false
  }
}

async function saveEdit() {
  if (!editingMaKh.value) return
  const emailChk = validateEmail(editForm.value.email)
  if (!emailChk.ok) {
    showNotification(emailChk.message, 'warning')
    return
  }
  editForm.value.email = emailChk.email
  const sdtRaw = editForm.value.sdt.trim()
  if (sdtRaw) {
    const chk = validateSdtVn(sdtRaw)
    if (!chk.ok) {
      showNotification(chk.message, 'warning')
      return
    }
    editForm.value.sdt = chk.sdt
  }
  saving.value = true
  try {
    const diem = parseInt(editForm.value.diemTichLuy, 10)
    const mkTrim = editForm.value.matKhauMoi.trim()
    const matKhauMoiPayload = mkTrim === '' ? null : mkTrim
    const res = await axios.put<{ message?: string; matKhau?: string | null }>(
      `${BASE}/${encodeURIComponent(editingMaKh.value)}`,
      {
        hoTen: editForm.value.hoTen.trim() || null,
        email: emailChk.email,
        sdt: editForm.value.sdt.trim() || null,
        gioiTinh: editForm.value.gioiTinh.trim() || null,
        diemTichLuy: Number.isNaN(diem) ? null : diem,
        trangThai: parseInt(editForm.value.trangThai, 10),
        hinhAnh: editForm.value.hinhAnh.trim() || null,
        matKhauMoi: matKhauMoiPayload,
      },
      { withCredentials: true },
    )
    const mkMoi = res.data?.matKhau
    if (mkMoi) {
      passwordResultModal.title = 'Đã Cập Nhật Khách Hàng'
      passwordResultModal.message = `Mật khẩu mới (đăng nhập khách): <strong class="text-primary">${mkMoi}</strong>`
      passwordResultModal.show = true
    } else {
      showNotification('Đã cập nhật khách hàng thành công.', 'success')
    }
    logActivity('Cập nhật khách hàng', `Đã cập nhật khách hàng ${editForm.value.hoTen || editingMaKh.value}`, 'Khách hàng')
    editOpen.value = false
    await fetchList()
  } catch (e: any) {
    const msg = e.response?.data?.message || 'Lưu thất bại.'
    showNotification(msg, 'error')
  } finally {
    saving.value = false
  }
}

async function saveCreate() {
  if (!createForm.value.hoTen.trim()) {
    showNotification('Vui lòng nhập họ tên.', 'warning')
    return
  }
  const sdtCheck = validateSdtVn(createForm.value.sdt)
  if (!sdtCheck.ok) {
    createSdtError.value = sdtCheck.message
    showNotification(sdtCheck.message, 'warning')
    return
  }
  createSdtError.value = ''
  const emailCheck = validateEmail(createForm.value.email)
  if (!emailCheck.ok) {
    createEmailError.value = emailCheck.message
    showNotification(emailCheck.message, 'warning')
    return
  }
  createEmailError.value = ''
  if (!createForm.value.gioiTinh.trim()) {
    const msg = 'Vui lòng chọn giới tính.'
    createGioiTinhError.value = msg
    showNotification(msg, 'warning')
    return
  }
  createGioiTinhError.value = ''
  if (!createForm.value.hinhAnh.trim()) {
    const msg = 'Vui lòng tải ảnh đại diện.'
    createAvatarError.value = msg
    showNotification(msg, 'warning')
    return
  }
  createAvatarError.value = ''
  createForm.value.sdt = sdtCheck.sdt
  createForm.value.email = emailCheck.email
  saving.value = true
  try {
    const res = await axios.post<{ maKh?: string; message?: string; matKhau?: string }>(
      BASE,
      {
        hoTen: createForm.value.hoTen.trim(),
        sdt: sdtCheck.sdt,
        email: emailCheck.email,
        gioiTinh: createForm.value.gioiTinh.trim(),
        matKhau: createForm.value.matKhau.trim() || null,
        hinhAnh: createForm.value.hinhAnh.trim(),
      },
      { withCredentials: true },
    )
    const mk = res.data?.matKhau
    const maKh = res.data?.maKh
    if (mk) {
      passwordResultModal.title = 'Tạo Khách Hàng Thành Công'
      passwordResultModal.message = `${maKh ? `Mã KH: <strong>${maKh}</strong><br>` : ''}Mật khẩu đăng nhập: <strong class="text-primary">${mk}</strong>`
      passwordResultModal.show = true
    } else {
      showNotification('Đã tạo khách hàng mới thành công.', 'success')
    }
    logActivity('Thêm khách hàng', `Đã thêm khách hàng mới: ${createForm.value.hoTen} (${maKh})`, 'Khách hàng')
    createOpen.value = false
    page.value = 1
    await fetchList()
  } catch (e: any) {
    const msg = e.response?.data?.message || 'Tạo thất bại.'
    showNotification(msg, 'error')
  } finally {
    saving.value = false
  }
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 350)
}

function openDelete(row: KhachHangRow) {
  selectedItemToDelete.value = row
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!selectedItemToDelete.value) return
  isDeleting.value = true
  try {
    await axios.delete(`${BASE}/${encodeURIComponent(selectedItemToDelete.value.maKh)}`, { withCredentials: true })
    showNotification('Đã xóa khách hàng thành công.', 'success')
    logActivity('Xóa khách hàng', `Đã xóa khách hàng ${selectedItemToDelete.value.hoTen || selectedItemToDelete.value.maKh}`, 'Quản lý khách hàng')
    showDeleteModal.value = false
    selectedItemToDelete.value = null
    await fetchList()
  } catch (e: any) {
    const msg = e.response?.data?.message || 'Xóa khách hàng thất bại.'
    showNotification(msg, 'error')
  } finally {
    isDeleting.value = false
  }
}

watch(trangThaiFilter, () => {
  page.value = 1
  fetchList()
})

watch(page, () => {
  fetchList()
})

onMounted(() => {
  fetchList()
})
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

    <v-card width="100%" elevation="2" rounded="xl" class="d-flex flex-column w-full">
      <!-- Card Header -->
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6 pb-4 gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <Users class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold text-slate-900 dark:text-white mb-1">
              Quản Lý Khách Hàng
            </h2>
            <div class="text-subtitle-2 text-medium-emphasis">
              Quản lý danh sách, tìm kiếm và chỉnh sửa thông tin khách hàng thân thiết
            </div>
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap justify-md-end">
          <!-- Search input -->
          <v-text-field
            v-model="keyword"
            placeholder="Mã KH, họ tên, SĐT, email…"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            style="min-width: 220px; max-width: 300px;"
            @input="onSearchInput"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-slate-400 mr-1 shrink-0" />
            </template>
          </v-text-field>

          <!-- Status Filter -->
          <div class="d-flex align-center gap-2">
            <span class="text-caption font-weight-bold text-medium-emphasis text-no-wrap">TRẠNG THÁI:</span>
            <v-select
              v-model="trangThaiFilter"
              :items="[
                { title: 'Tất cả', value: 'all' },
                { title: 'Hoạt động', value: '1' },
                { title: 'Khóa', value: '0' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              style="width: 130px;"
            ></v-select>
          </div>

          <!-- Refresh Button -->
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="handleRefresh"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>

          <!-- Add Button -->
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-4"
            height="40"
            @click="openCreate"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Thêm khách hàng
          </v-btn>
        </div>
      </div>

      <v-divider></v-divider>

      <!-- Table Section -->
      <div class="pa-6 pt-4 overflow-x-auto w-full">
        <v-table class="rounded-xl border w-full" hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 12%;">MÃ KH</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3 text-medium-emphasis" style="width: 20%;">HỌ TÊN</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 14%;">SỐ ĐIỆN THOẠI</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3 text-medium-emphasis" style="width: 20%;">EMAIL</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 10%;">HẠNG</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 10%;">ĐIỂM TÍCH LŨY</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 10%;">TRẠNG THÁI</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3 text-medium-emphasis" style="width: 14%;">THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading -->
            <tr v-if="loading">
              <td colspan="8" class="text-center py-10">
                <v-progress-circular indeterminate color="primary" size="32" class="mb-2"></v-progress-circular>
                <div class="text-caption text-medium-emphasis font-weight-bold uppercase tracking-wider">Đang tải dữ liệu khách hàng...</div>
              </td>
            </tr>

            <!-- Empty -->
            <tr v-else-if="!list.length">
              <td colspan="8" class="text-center py-10 text-caption text-medium-emphasis font-weight-medium">
                Không có dữ liệu khách hàng.
              </td>
            </tr>

            <!-- Data Rows -->
            <tr
              v-else
              v-for="row in list"
              :key="row.maKh"
              class="transition-colors"
            >
              <!-- Mã KH -->
              <td class="py-4 text-center font-weight-bold text-body-2">
                {{ row.maKh }}
              </td>

              <!-- Họ tên -->
              <td class="py-4 text-left font-weight-semibold text-body-2">
                {{ row.hoTen || '—' }}
              </td>

              <!-- SĐT -->
              <td class="py-4 text-center text-body-2 whitespace-nowrap">
                {{ row.sdt || '—' }}
              </td>

              <!-- Email -->
              <td class="py-4 text-left text-body-2 text-medium-emphasis truncate max-w-xs">
                {{ row.email || '—' }}
              </td>

              <!-- Hạng -->
              <td class="py-4 text-center">
                <v-chip
                  v-if="row.tenRank?.toUpperCase().includes('KIM CƯƠNG') || row.maRank?.toUpperCase().includes('KIM CƯƠNG')"
                  color="cyan"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  {{ row.tenRank || row.maRank }}
                </v-chip>
                <v-chip
                  v-else-if="row.tenRank?.toUpperCase().includes('VÀNG') || row.maRank?.toUpperCase().includes('VÀNG') || row.tenRank?.toUpperCase().includes('GOLD')"
                  color="amber-darken-2"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  {{ row.tenRank || row.maRank }}
                </v-chip>
                <v-chip
                  v-else-if="row.tenRank?.toUpperCase().includes('BẠC') || row.maRank?.toUpperCase().includes('BẠC') || row.tenRank?.toUpperCase().includes('SILVER')"
                  color="grey"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  {{ row.tenRank || row.maRank }}
                </v-chip>
                <v-chip
                  v-else
                  color="brown-darken-1"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  {{ row.tenRank || row.maRank || 'Đồng' }}
                </v-chip>
              </td>

              <!-- Điểm -->
              <td class="py-4 text-center font-weight-bold text-body-2 text-slate-800 dark:text-slate-200">
                {{ row.diemTichLuy ?? 0 }}
              </td>

              <!-- Trạng thái -->
              <td class="py-4 text-center">
                <v-chip
                  v-if="row.trangThai === 1"
                  color="success"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  Hoạt động
                </v-chip>
                <v-chip
                  v-else
                  color="error"
                  size="x-small"
                  variant="tonal"
                  class="font-weight-bold uppercase tracking-wider"
                >
                  Khóa
                </v-chip>
              </td>

              <!-- Thao tác -->
              <td class="py-4 text-center">
                <div class="d-flex align-center justify-center gap-2">
                  <v-btn
                    color="primary"
                    variant="tonal"
                    size="small"
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="openEdit(row)"
                  >
                    <template v-slot:prepend><Pencil class="w-3.5 h-3.5 mr-1" /></template>
                    Sửa
                  </v-btn>
                  <v-btn
                    color="error"
                    variant="tonal"
                    size="small"
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="openDelete(row)"
                  >
                    <template v-slot:prepend><Trash2 class="w-3.5 h-3.5 mr-1" /></template>
                    Xóa
                  </v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Pagination Footer -->
      <div class="d-flex flex-column flex-sm-row align-center justify-space-between px-6 py-4 border-t gap-3">
        <span class="text-caption text-medium-emphasis font-weight-semibold">
          Tổng số <strong>{{ totalCount }}</strong> khách hàng · Trang {{ page }} / {{ totalPages }}
        </span>
        <div class="d-flex align-center gap-2">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            size="36"
            rounded="lg"
            :disabled="page <= 1 || loading"
            @click="page = Math.max(1, page - 1)"
          >
            <ChevronLeft class="w-4 h-4" />
          </v-btn>
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            size="36"
            rounded="lg"
            :disabled="page >= totalPages || loading"
            @click="page = Math.min(totalPages, page + 1)"
          >
            <ChevronRight class="w-4 h-4" />
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ VUETIFY MODAL: SỬA KHÁCH HÀNG ═══════ -->
    <v-dialog v-model="editOpen" max-width="680px" persistent scrollable>
      <v-card rounded="2xl" class="overflow-hidden">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">SỬA THÔNG TIN KHÁCH HÀNG</h3>
            <p class="text-caption text-medium-emphasis mb-0 mt-0.5">
              Hạng thành viên được hệ thống tự cập nhật theo điểm.
              <span v-if="editForm.tenRank" class="font-weight-bold ml-1 text-primary">Hiện tại: {{ editForm.tenRank }}</span>
            </p>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="editOpen = false">
            <X class="w-4 h-4" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <v-row>
            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">HỌ TÊN</label>
              <v-text-field
                v-model="editForm.hoTen"
                placeholder="Nhập họ tên"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">SỐ ĐIỆN THOẠI</label>
              <v-text-field
                v-model="editForm.sdt"
                placeholder="VD: 09xxxxxxxx"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">EMAIL <span class="text-error">*</span></label>
              <v-text-field
                v-model="editForm.email"
                type="email"
                placeholder="vidu@email.com"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">GIỚI TÍNH</label>
              <v-select
                v-model="editForm.gioiTinh"
                :items="['Nam', 'Nữ', 'Khác']"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-select>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">ĐIỂM TÍCH LŨY</label>
              <v-text-field
                v-model="editForm.diemTichLuy"
                type="number"
                min="0"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">TRẠNG THÁI</label>
              <v-select
                v-model="editForm.trangThai"
                :items="[
                  { title: 'Hoạt động', value: '1' },
                  { title: 'Khóa', value: '0' }
                ]"
                item-title="title"
                item-value="value"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-select>
            </v-col>
          </v-row>

          <!-- Ảnh đại diện -->
          <div class="border-t mt-4 pt-4">
            <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">ẢNH ĐẠI DIỆN</label>
            <p class="text-caption text-medium-emphasis mb-2">Chọn file JPG, PNG hoặc WEBP (tối đa 5MB).</p>
            <div class="d-flex align-center gap-4">
              <v-avatar size="72" rounded="xl" class="border">
                <img v-if="mediaUrl(editForm.hinhAnh)" :src="mediaUrl(editForm.hinhAnh)" alt="" class="w-100 h-100 object-cover" />
                <span v-else class="text-caption text-medium-emphasis font-weight-bold">Chưa có</span>
              </v-avatar>
              <div class="d-flex align-center gap-2">
                <input ref="editAvatarFileRef" type="file" accept="image/*" class="d-none" @change="onPickAvatar($event, 'edit')" />
                <v-btn
                  variant="outlined"
                  color="primary"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  :loading="avatarUploading"
                  @click="editAvatarFileRef?.click()"
                >
                  <template v-slot:prepend><Upload class="w-4 h-4 mr-1" /></template>
                  Chọn ảnh
                </v-btn>
                <v-btn
                  v-if="editForm.hinhAnh"
                  variant="text"
                  color="error"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  @click="clearAvatar('edit')"
                >
                  Xóa ảnh
                </v-btn>
              </div>
            </div>
          </div>

          <!-- Mật khẩu mới -->
          <div class="border-t mt-4 pt-4">
            <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">MẬT KHẨU MỚI</label>
            <p class="text-caption text-medium-emphasis mb-2">
              Để trống nếu muốn giữ nguyên mật khẩu cũ; chỉ nhập khi muốn cấp mật khẩu mới cho khách hàng.
            </p>
            <v-text-field
              v-model="editForm.matKhauMoi"
              :type="showEditPassword ? 'text' : 'password'"
              placeholder="Nhập mật khẩu mới (để trống nếu không đổi)..."
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
            >
              <template v-slot:append-inner>
                <v-btn icon variant="text" density="compact" @click="toggleEditPassword">
                  <Eye v-if="!showEditPassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </v-btn>
              </template>
            </v-text-field>
          </div>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t d-flex justify-end gap-3">
          <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" @click="editOpen = false">
            Hủy
          </v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold px-6" :loading="saving" @click="saveEdit">
            Lưu
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ VUETIFY MODAL: THÊM KHÁCH HÀNG ═══════ -->
    <v-dialog v-model="createOpen" max-width="680px" persistent scrollable>
      <v-card rounded="2xl" class="overflow-hidden">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <h3 class="text-h6 font-weight-bold mb-0">THÊM KHÁCH HÀNG MỚI</h3>
          <v-btn icon variant="text" density="comfortable" @click="createOpen = false">
            <X class="w-4 h-4" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <!-- Loại khách -->
          <div class="mb-4">
            <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">LOẠI KHÁCH</label>
            <v-select
              v-model="createLoaiKhach"
              :items="[
                { title: 'Khách vãng lai (mặc định)', value: 'vang_lai' },
                { title: 'Khách có tên cụ thể', value: 'ten_cu_the' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
              @update:model-value="onCreateLoaiChange"
            ></v-select>
            <p class="text-caption text-medium-emphasis mt-1 mb-0">
              {{
                createLoaiKhach === 'vang_lai'
                  ? 'Họ tên đặt sẵn "Khách vãng lai" — có thể sửa nếu cần. Email bắt buộc.'
                  : 'Nhập họ tên, số điện thoại và email đầy đủ.'
              }}
            </p>
          </div>

          <v-row>
            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">HỌ TÊN <span class="text-error">*</span></label>
              <v-text-field
                v-model="createForm.hoTen"
                placeholder="Nhập họ tên"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">SỐ ĐIỆN THOẠI <span class="text-error">*</span></label>
              <v-text-field
                v-model="createForm.sdt"
                placeholder="VD: 09xxxxxxxx hoặc +84…"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="createSdtError"
                @input="createSdtError = ''"
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">EMAIL <span class="text-error">*</span></label>
              <v-text-field
                v-model="createForm.email"
                type="email"
                placeholder="vidu@email.com"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="createEmailError"
                @input="createEmailError = ''"
              ></v-text-field>
            </v-col>

            <v-col cols="12" sm="6" class="py-2">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">GIỚI TÍNH <span class="text-error">*</span></label>
              <v-select
                v-model="createForm.gioiTinh"
                :items="['Nam', 'Nữ', 'Khác']"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                hide-details
                :error-messages="createGioiTinhError"
                @update:model-value="createGioiTinhError = ''"
              ></v-select>
            </v-col>
          </v-row>

          <!-- Ảnh đại diện -->
          <div class="border-t mt-4 pt-4">
            <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">ẢNH ĐẠI DIỆN <span class="text-error">*</span></label>
            <p class="text-caption text-medium-emphasis mb-2">Bắt buộc — JPG, PNG, WEBP — tối đa 5MB.</p>
            <div class="d-flex align-center gap-4">
              <v-avatar size="72" rounded="xl" class="border">
                <img v-if="mediaUrl(createForm.hinhAnh)" :src="mediaUrl(createForm.hinhAnh)" alt="" class="w-100 h-100 object-cover" />
                <span v-else class="text-caption text-medium-emphasis font-weight-bold">Chưa chọn</span>
              </v-avatar>
              <div class="d-flex align-center gap-2">
                <input ref="createAvatarFileRef" type="file" accept="image/*" class="d-none" @change="onPickAvatar($event, 'create')" />
                <v-btn
                  variant="outlined"
                  color="primary"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  :loading="avatarUploading"
                  @click="createAvatarFileRef?.click()"
                >
                  <template v-slot:prepend><Upload class="w-4 h-4 mr-1" /></template>
                  Chọn ảnh
                </v-btn>
                <v-btn
                  v-if="createForm.hinhAnh"
                  variant="text"
                  color="error"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  @click="clearAvatar('create')"
                >
                  Xóa ảnh
                </v-btn>
              </div>
            </div>
            <p v-if="createAvatarError" class="text-caption text-error font-weight-bold mt-1">{{ createAvatarError }}</p>
          </div>

          <!-- Mật khẩu -->
          <div class="border-t mt-4 pt-4">
            <label class="text-caption font-weight-bold text-medium-emphasis mb-1 d-block">
              MẬT KHẨU (ĐỂ TRỐNG = HỆ THỐNG TẠO NGẪU NHIÊN)
            </label>
            <v-text-field
              v-model="createForm.matKhau"
              :type="showCreatePassword ? 'text' : 'password'"
              placeholder="Nhập mật khẩu..."
              variant="outlined"
              density="comfortable"
              rounded="lg"
              hide-details
            >
              <template v-slot:append-inner>
                <v-btn icon variant="text" density="compact" @click="toggleCreatePassword">
                  <Eye v-if="!showCreatePassword" class="w-4 h-4" />
                  <EyeOff v-else class="w-4 h-4" />
                </v-btn>
              </template>
            </v-text-field>
          </div>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t d-flex justify-end gap-3">
          <v-btn variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold px-5" @click="createOpen = false">
            Hủy
          </v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold px-6" :loading="saving" @click="saveCreate">
            Tạo
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ VUETIFY MODAL: XÁC NHẬN XÓA (MATCHING SALE & CHUCVU) ═══════ -->
    <v-dialog v-model="showDeleteModal" max-width="440px" persistent>
      <v-card rounded="2xl" class="pa-6 text-center">
        <div class="d-flex justify-center mb-4">
          <v-avatar color="error-lighten-4" size="64" rounded="circle">
            <Trash2 class="w-8 h-8 text-error" />
          </v-avatar>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa?</h3>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Bạn có chắc chắn muốn xóa khách hàng <strong>"{{ selectedItemToDelete?.hoTen || selectedItemToDelete?.maKh }}"</strong> không?
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold px-5"
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
            Xóa ngay
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ═══════ VUETIFY MODAL: KẾT QUẢ MẬT KHẨU TẠO / SỬA ═══════ -->
    <v-dialog v-model="passwordResultModal.show" max-width="450px">
      <v-card rounded="2xl" class="pa-6 text-center">
        <div class="d-flex justify-center mb-4">
          <v-avatar color="success-lighten-4" size="64" rounded="circle">
            <Check class="w-8 h-8 text-success" />
          </v-avatar>
        </div>
        <h3 class="text-h6 font-weight-bold mb-2">{{ passwordResultModal.title }}</h3>
        <div class="text-body-2 text-medium-emphasis mb-6" v-html="passwordResultModal.message"></div>
        <v-btn color="primary" rounded="lg" class="text-none font-weight-bold px-6" @click="passwordResultModal.show = false">
          Đã Hiểu
        </v-btn>
      </v-card>
    </v-dialog>
  </v-container>
</template>
