<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'
import axios from 'axios'
import { Plus, RotateCcw, X, Check, AlertCircle, Eye, Edit3, Trash2, Tag, Calendar, UserCheck, Receipt } from 'lucide-vue-next'

// ── THEME SYNC ──
const theme = useTheme()
const customizer = useCustomizerStore()

watch(
  [() => theme.global.name.value, () => customizer.actTheme],
  ([vTheme, cTheme]) => {
    const current = vTheme || cTheme
    if (current === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  },
  { immediate: true }
)

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE = API + '/api/admin/vouchers'

export interface AdminVoucherRow {
  maCode: string
  moTa: string | null
  phanTramGiam: number | null
  soTienGiam: number | null
  giaTriToiThieu: number | null
  ngayBatDau: string | null
  ngayKetThuc: string | null
  soLuong: number | null
  soLuongDaDung: number | null
  trangThai: number | null
  soKhachDaLuu: number
}

const list = ref<AdminVoucherRow[]>([])
const lifecycleFilter = ref('')
const loading = ref(false)
const listError = ref('')
const saving = ref(false)

// High Priority Notification Toast (Snackbar)
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
  icon: 'mdi-check-circle-outline'
})

const showNotification = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = msg
  snackbar.color = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
  snackbar.show = true
}

const detailOpen = ref(false)
const detailLoading = ref(false)
const detailError = ref('')
const detailCode = ref<string | null>(null)
const detailKhach = ref<
  { maKh: string; hoTen: string | null; sdt: string | null; email: string | null }[]
>([])
const detailHoaDon = ref<
  {
    maHd: string
    maKh: string | null
    ngayTao: string | null
    tongTien: number | null
    thanhTien: number | null
    trangThai: number | null
  }[]
>([])

const modalOpen = ref(false)
const deleteModalOpen = ref(false)
const selectedRowToDelete = ref<AdminVoucherRow | null>(null)
const editingCode = ref<string | null>(null)
const originalRowForEdit = ref<AdminVoucherRow | null>(null)
const saveError = ref('')

const form = ref({
  maCode: '',
  moTa: '',
  phanTramGiam: '' as string,
  soTienGiam: '' as string,
  giaTriToiThieu: '' as string,
  ngayBatDau: '' as string,
  ngayKetThuc: '' as string,
  soLuong: '' as string,
  soLuongDaDung: '' as string,
  trangThai: '1',
})

const isEdit = computed(() => editingCode.value !== null)
const maCodePattern = /^[A-Z0-9]{1,20}$/

const lifecycleOptions = [
  { title: 'Tất cả vòng đời', value: '' },
  { title: 'Đang chạy', value: 'dangChay' },
  { title: 'Sắp chạy', value: 'sapChay' },
  { title: 'Đã hết hạn', value: 'hetHan' },
  { title: 'Đã hết lượt', value: 'hetLuot' }
]

function isDaBatDau(isoStart: string | null): boolean {
  if (!isoStart) return true
  const t = new Date(isoStart).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() >= t
}

const isRestrictedEdit = computed(() => {
  if (!isEdit.value || !originalRowForEdit.value) return false
  const row = originalRowForEdit.value
  if (!isDaBatDau(row.ngayBatDau)) return false
  const used = row.soLuongDaDung ?? 0
  const saved = row.soKhachDaLuu ?? 0
  return used > 0 || saved > 0
})

const minSoLuongEdit = computed(() => {
  if (!isRestrictedEdit.value) return 1
  return Math.max(1, originalRowForEdit.value?.soLuongDaDung ?? 0)
})

const minNgayKetThucLocal = computed(() => {
  if (!isRestrictedEdit.value || !originalRowForEdit.value?.ngayKetThuc) return ''
  return toInputDate(originalRowForEdit.value.ngayKetThuc)
})

function asTrimmedString(v: unknown): string {
  if (v == null) return ''
  return String(v).trim()
}

function toInputDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toIsoOrNull(localVal: unknown): string | null {
  const t = asTrimmedString(localVal)
  if (!t) return null
  const d = new Date(t)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function parseNum(v: unknown): number | null {
  const t = asTrimmedString(v)
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseIntOrNull(v: unknown): number | null {
  const t = asTrimmedString(v)
  if (t === '') return null
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

function onPhanTramGiamInput() {
  if (form.value.phanTramGiam !== '') {
    let val = Number(form.value.phanTramGiam)
    if (isNaN(val) || val < 0) val = 0
    if (val > 100) val = 100
    form.value.phanTramGiam = String(val)
  }
}

function onPhanTramGiamPaste(e: ClipboardEvent) {
  e.preventDefault()
  const pastedText = e.clipboardData?.getData('text') || ''
  let num = parseFloat(pastedText)
  if (isNaN(num) || num < 0) num = 0
  if (num > 100) num = 100
  form.value.phanTramGiam = String(num)
}

function formatApiError(
  e: unknown,
  fallback = 'Không lưu được. Kiểm tra backend (HTTPS / CORS) hoặc dữ liệu.',
): string {
  const err = e as {
    message?: string
    response?: { data?: unknown; status?: number }
  }
  const d = err.response?.data
  if (typeof d === 'string') {
    const s = d.trim()
    const col = s.match(/Invalid column name '([^']+)'/i)
    if (col)
      return `Lỗi từ máy chủ (cột ${col[1]}). Khởi động lại API sau khi cập nhật code, hoặc kiểm tra log backend.`
    if (s.length > 0 && s.length < 400) return s
  }
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>
    if (typeof o.message === 'string' && o.message) return o.message
    if (typeof o.title === 'string' && o.title) return o.title
    if (typeof o.detail === 'string' && o.detail) return o.detail
    const errors = o.errors as Record<string, string[] | string> | undefined
    if (errors && typeof errors === 'object') {
      for (const v of Object.values(errors)) {
        if (Array.isArray(v) && v[0]) return String(v[0])
        if (typeof v === 'string' && v) return v
      }
    }
  }
  if (err.response?.status === 500)
    return 'Máy chủ trả 500 — xem log cửa sổ chạy API (thường là lỗi truy vấn SQL / CSDL).'
  if (err.message && err.message !== 'Network Error') return err.message
  return fallback
}

function validateBeforeSave(): string | null {
  const code = asTrimmedString(form.value.maCode).toUpperCase()
  if (!isEdit.value) {
    if (!code) return 'Vui lòng nhập mã voucher.'
    if (!maCodePattern.test(code))
      return 'Mã voucher chỉ gồm chữ in hoa và số (A–Z, 0–9), không dấu cách, không ký tự đặc biệt, tối đa 20 ký tự.'
  }

  const pt = parseIntOrNull(form.value.phanTramGiam) ?? 0
  const money = parseNum(form.value.soTienGiam) ?? 0
  if (!isRestrictedEdit.value) {
    if (pt > 100) return 'Giảm theo % tối đa là 100%.'
    if (pt > 0 && money > 0) return 'Chỉ được chọn một: giảm % hoặc giảm tiền.'
    if (pt <= 0 && money <= 0) return 'Vui lòng nhập giảm theo % hoặc theo số tiền.'
  }

  const isoStart = toIsoOrNull(form.value.ngayBatDau)
  const isoEnd = toIsoOrNull(form.value.ngayKetThuc)
  if (!isoEnd) return 'Ngày kết thúc là bắt buộc.'

  const endMs = new Date(isoEnd).getTime()
  if (Number.isNaN(endMs)) return 'Ngày kết thúc không hợp lệ.'

  if (!isRestrictedEdit.value) {
    if (endMs <= Date.now()) return 'Ngày kết thúc phải lớn hơn thời điểm hiện tại.'
    if (isoStart) {
      const startMs = new Date(isoStart).getTime()
      if (Number.isNaN(startMs)) return 'Ngày bắt đầu không hợp lệ.'
      if (endMs <= startMs) return 'Ngày kết thúc phải sau ngày bắt đầu.'
    }
  } else {
    if (endMs <= Date.now()) return 'Ngày kết thúc phải ở tương lai.'
    const orig = originalRowForEdit.value?.ngayKetThuc
    if (orig) {
      const origMs = new Date(orig).getTime()
      if (!Number.isNaN(origMs) && endMs < origMs) return 'Chỉ được kéo dài ngày kết thúc, không được rút ngắn.'
    }
    if (isoStart) {
      const startMs = new Date(isoStart).getTime()
      if (!Number.isNaN(startMs) && endMs <= startMs) return 'Ngày kết thúc phải sau ngày bắt đầu.'
    }
  }

  const qty = parseIntOrNull(form.value.soLuong)
  if (qty == null || qty <= 0) return 'Tổng số lượng phát hành phải lớn hơn 0.'
  if (isRestrictedEdit.value) {
    const used = originalRowForEdit.value?.soLuongDaDung ?? 0
    if (qty < used) return `Số lượng không được nhỏ hơn số đã dùng (${used}).`
  }

  return null
}

function openCreate() {
  editingCode.value = null
  originalRowForEdit.value = null
  saveError.value = ''
  form.value = {
    maCode: '',
    moTa: '',
    phanTramGiam: '',
    soTienGiam: '',
    giaTriToiThieu: '',
    ngayBatDau: '',
    ngayKetThuc: '',
    soLuong: '',
    soLuongDaDung: '',
    trangThai: '1',
  }
  modalOpen.value = true
}

function openEdit(row: AdminVoucherRow) {
  editingCode.value = row.maCode
  originalRowForEdit.value = { ...row }
  saveError.value = ''
  form.value = {
    maCode: row.maCode,
    moTa: row.moTa ?? '',
    phanTramGiam: row.phanTramGiam != null ? String(row.phanTramGiam) : '',
    soTienGiam: row.soTienGiam != null ? String(row.soTienGiam) : '',
    giaTriToiThieu: row.giaTriToiThieu != null ? String(row.giaTriToiThieu) : '',
    ngayBatDau: toInputDate(row.ngayBatDau),
    ngayKetThuc: toInputDate(row.ngayKetThuc),
    soLuong: row.soLuong != null ? String(row.soLuong) : '',
    soLuongDaDung: row.soLuongDaDung != null ? String(row.soLuongDaDung) : '',
    trangThai: row.trangThai != null && row.trangThai !== 0 ? '1' : '0',
  }
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  saveError.value = ''
}

function buildPayload(forCreate: boolean): Record<string, unknown> {
  const ngayBatDau = toIsoOrNull(form.value.ngayBatDau)
  const ngayKetThuc = toIsoOrNull(form.value.ngayKetThuc)
  const base: Record<string, unknown> = {
    moTa: asTrimmedString(form.value.moTa) || null,
    phanTramGiam: parseIntOrNull(form.value.phanTramGiam),
    soTienGiam: parseNum(form.value.soTienGiam),
    giaTriToiThieu: parseNum(form.value.giaTriToiThieu),
    ngayBatDau,
    ngayKetThuc,
    soLuong: parseIntOrNull(form.value.soLuong),
    trangThai: parseInt(String(form.value.trangThai ?? '0'), 10) ? 1 : 0,
  }
  if (forCreate) {
    base.maCode = asTrimmedString(form.value.maCode).toUpperCase()
  }
  return base
}

async function save() {
  saveError.value = ''
  const v = validateBeforeSave()
  if (v) {
    saveError.value = v
    showNotification(v, 'warning')
    return
  }
  saving.value = true
  try {
    const payload = buildPayload(!isEdit.value)
    let msg = ''
    if (isEdit.value && editingCode.value) {
      await axios.put(`${API_BASE}/${encodeURIComponent(editingCode.value)}`, payload)
      msg = 'Đã cập nhật voucher thành công!'
    } else {
      await axios.post(API_BASE, payload)
      msg = 'Đã tạo voucher mới thành công!'
    }
    // Modal auto closes immediately after saving
    closeModal()
    showNotification(msg, 'success')
    await load()
  } catch (e: unknown) {
    const errText = formatApiError(e)
    saveError.value = errText
    showNotification(errText, 'error')
  } finally {
    saving.value = false
  }
}

async function openDetail(row: AdminVoucherRow) {
  detailCode.value = row.maCode
  detailOpen.value = true
  detailError.value = ''
  detailKhach.value = []
  detailHoaDon.value = []
  detailLoading.value = true
  try {
    const { data } = await axios.get<{
      khachDaThuThap?: typeof detailKhach.value
      hoaDonApDung?: typeof detailHoaDon.value
    }>(`${API_BASE}/${encodeURIComponent(row.maCode)}/detail`)
    detailKhach.value = Array.isArray(data?.khachDaThuThap) ? data.khachDaThuThap : []
    detailHoaDon.value = Array.isArray(data?.hoaDonApDung) ? data.hoaDonApDung : []
  } catch (e: unknown) {
    detailError.value = formatApiError(e, 'Không tải được chi tiết voucher.')
    showNotification(detailError.value, 'error')
  } finally {
    detailLoading.value = false
  }
}

function closeDetail() {
  detailOpen.value = false
  detailCode.value = null
  detailError.value = ''
}

const MSG_VOUCHER_VO_HIEU = 'Voucher đã vô hiệu hóa, không ảnh hưởng lịch sử.'

function confirmRemove(row: AdminVoucherRow) {
  selectedRowToDelete.value = row
  deleteModalOpen.value = true
}

async function executeRemove() {
  if (!selectedRowToDelete.value) return
  const row = selectedRowToDelete.value
  try {
    await axios.delete(`${API_BASE}/${encodeURIComponent(row.maCode)}`)
    // Modal auto closes immediately after confirming deletion
    deleteModalOpen.value = false
    showNotification(MSG_VOUCHER_VO_HIEU, 'success')
    await load()
  } catch (e: unknown) {
    showNotification(formatApiError(e), 'error')
  } finally {
    selectedRowToDelete.value = null
  }
}

async function load() {
  loading.value = true
  listError.value = ''
  try {
    const params =
      asTrimmedString(lifecycleFilter.value) === ''
        ? undefined
        : { lifecycle: asTrimmedString(lifecycleFilter.value) }
    const { data } = await axios.get<AdminVoucherRow[]>(API_BASE, { params })
    list.value = Array.isArray(data) ? data : []
  } catch (e: unknown) {
    listError.value = formatApiError(
      e,
      'Không tải được danh sách. Kiểm tra backend tại ' + API + ' (HTTPS / CORS).',
    )
    list.value = []
    showNotification(listError.value, 'error')
  } finally {
    loading.value = false
  }
}

function discountLabel(row: AdminVoucherRow): string {
  if (row.phanTramGiam != null && row.phanTramGiam > 0) return `${row.phanTramGiam}%`
  if (row.soTienGiam != null && row.soTienGiam > 0)
    return `${Number(row.soTienGiam).toLocaleString('vi-VN')} đ`
  return '—'
}

function formatShortDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('vi-VN')
  } catch {
    return '—'
  }
}

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `${Number(n).toLocaleString('vi-VN')} đ`
}

onMounted(async () => {
  await load()
})
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
        <Tag v-else class="w-5 h-5 shrink-0" />
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
      <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between gap-4">
        <div>
          <h2 class="text-h5 font-weight-bold text-slate-900 dark:text-white d-flex align-center gap-2 mb-1">
            <Tag class="w-6 h-6 text-primary shrink-0" />
            <span>Quản Lý Voucher & Mã Giảm Giá</span>
          </h2>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Quản lý mã giảm giá, ưu đãi và lượt sử dụng của khách hàng trong hệ thống
          </p>
        </div>

        <div class="d-flex align-center gap-3 flex-grow-1 justify-lg-end flex-wrap">
          <v-select
            v-model="lifecycleFilter"
            :items="lifecycleOptions"
            item-title="title"
            item-value="value"
            variant="outlined"
            density="compact"
            hide-details
            class="flex-grow-1"
            style="max-width: 280px; min-width: 200px;"
            @update:model-value="load"
          >
            <template v-slot:prepend-inner>
              <Tag class="w-4 h-4 text-slate-400 mr-1 shrink-0" />
            </template>
          </v-select>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            width="40"
            icon
            rounded="xl"
            :loading="loading"
            @click="load"
            title="Tải lại"
          >
            <RotateCcw class="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </v-btn>

          <v-btn
            color="primary"
            height="40"
            rounded="xl"
            elevation="2"
            class="text-none font-weight-bold px-5"
            @click="openCreate"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Thêm voucher
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6">
      <v-table class="rounded-xl border">
        <thead>
          <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 10%;">Mã</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 12%;">Ưu đãi</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200" style="width: 28%;">Mô tả</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 12%;">HSD</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 10%;">Lượt dùng</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 8%;">KH lưu</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200" style="width: 10%;">Trạng thái</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3 text-slate-700 dark:text-slate-200" style="width: 10%;">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <tr v-if="loading">
            <td colspan="8" class="text-center py-8">
              <v-progress-circular indeterminate color="primary" size="36" class="mb-2"></v-progress-circular>
              <div class="text-caption text-medium-emphasis">Đang tải dữ liệu voucher...</div>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-else-if="list.length === 0">
            <td colspan="8" class="text-center py-10">
              <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                <Tag class="w-7 h-7 text-grey" />
              </v-avatar>
              <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Chưa có voucher nào</div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr v-else v-for="row in list" :key="row.maCode" class="hover:bg-primary-lighten-5 transition-colors">
            <td class="py-4 text-center font-weight-bold font-mono">
              <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold font-mono">
                {{ row.maCode }}
              </v-chip>
            </td>
            <td class="py-4 text-center">
              <v-chip color="primary" variant="tonal" size="small" class="font-weight-bold">
                {{ discountLabel(row) }}
              </v-chip>
            </td>
            <td class="py-4 text-left">
              <span class="text-body-2 text-slate-700 dark:text-slate-200 line-clamp-2" :title="row.moTa ?? ''">
                {{ row.moTa || '—' }}
              </span>
            </td>
            <td class="py-4 text-center">
              <div class="d-flex align-center justify-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Calendar class="w-3.5 h-3.5 text-grey shrink-0" />
                <span class="text-body-2 font-weight-medium">{{ formatShortDate(row.ngayKetThuc) }}</span>
              </div>
            </td>
            <td class="py-4 text-center font-mono">
              <span v-if="row.soLuong != null" class="text-body-2 font-weight-medium">
                {{ row.soLuongDaDung ?? 0 }} / {{ row.soLuong }}
              </span>
              <span v-else class="text-body-2 font-weight-bold">∞</span>
            </td>
            <td class="py-4 text-center">
              <v-chip color="info" variant="flat" size="small" class="font-weight-bold">
                {{ row.soKhachDaLuu }}
              </v-chip>
            </td>
            <td class="py-4 text-center">
              <v-chip
                :color="row.trangThai === 1 ? 'success' : 'grey'"
                variant="flat"
                size="small"
                class="font-weight-bold"
              >
                <template v-slot:prepend>
                  <Check v-if="row.trangThai === 1" class="w-3.5 h-3.5 mr-1" />
                  <X v-else class="w-3.5 h-3.5 mr-1" />
                </template>
                {{ row.trangThai === 1 ? 'Hoạt động' : 'Vô hiệu' }}
              </v-chip>
            </td>
            <td class="py-4 text-right">
              <div class="d-flex align-center justify-end gap-1">
                <v-btn
                  icon
                  variant="text"
                  color="info"
                  size="small"
                  @click="openDetail(row)"
                  title="Chi tiết"
                >
                  <Eye class="w-4 h-4" />
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  color="warning"
                  size="small"
                  @click="openEdit(row)"
                  title="Sửa"
                >
                  <Edit3 class="w-4 h-4" />
                </v-btn>
                <v-btn
                  icon
                  variant="text"
                  color="error"
                  size="small"
                  @click="confirmRemove(row)"
                  title="Xóa"
                >
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </div>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card>

    <!-- ═══════ MODAL: THÊM / SỬA VOUCHER ═══════ -->
    <v-dialog v-model="modalOpen" max-width="750px" persistent scrollable>
      <v-card rounded="xl">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar :color="isEdit ? 'warning' : 'primary'" size="42" rounded="lg" elevation="2">
              <Plus v-if="!isEdit" class="w-5 h-5 text-white" />
              <Edit3 v-else class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">
                {{ isEdit ? 'Sửa voucher' : 'Thêm voucher mới' }}
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Cấu hình mã ưu đãi và giới hạn áp dụng
              </p>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <!-- Dialog Body -->
        <v-card-text class="pa-6">
          <v-form @submit.prevent="save">
            <v-alert v-if="isRestrictedEdit" type="warning" variant="tonal" class="mb-4 rounded-xl text-caption">
              <strong>Hạn chế chỉnh sửa:</strong> Voucher đã phát hành và được lưu/sử dụng. Chỉ được sửa mô tả, trạng thái, gia hạn ngày kết thúc và tăng tổng số lượng.
            </v-alert>

            <v-alert v-if="saveError" type="error" variant="tonal" class="mb-4 rounded-xl text-caption font-weight-bold">
              {{ saveError }}
            </v-alert>

            <v-row class="mb-2">
              <!-- Mã Code -->
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.maCode"
                  label="Mã voucher *"
                  placeholder="VD: CHAOHEXIN"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  :disabled="isEdit"
                  @blur="form.maCode = asTrimmedString(form.maCode).toUpperCase()"
                ></v-text-field>
              </v-col>

              <!-- Mô tả -->
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.moTa"
                  label="Mô tả"
                  placeholder="Hiển thị cho khách hàng"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row class="mb-2">
              <!-- Giảm % -->
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.phanTramGiam"
                  type="number"
                  label="Giảm %"
                  placeholder="0 - 100"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  suffix="%"
                  :disabled="isRestrictedEdit"
                  :max="100"
                  :min="0"
                  @input="onPhanTramGiamInput"
                  @paste="onPhanTramGiamPaste"
                ></v-text-field>
              </v-col>

              <!-- Giảm tiền -->
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.soTienGiam"
                  type="number"
                  label="Giảm số tiền"
                  placeholder="VD: 50000"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  suffix="đ"
                  :disabled="isRestrictedEdit"
                ></v-text-field>
              </v-col>

              <!-- Đơn tối thiểu -->
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.giaTriToiThieu"
                  type="number"
                  label="Đơn tối thiểu"
                  placeholder="VD: 100000"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  suffix="đ"
                  :disabled="isRestrictedEdit"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row class="mb-2">
              <!-- Bắt đầu -->
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.ngayBatDau"
                  type="datetime-local"
                  label="Thời gian bắt đầu"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  :disabled="isRestrictedEdit"
                >
                  <template v-slot:prepend-inner>
                    <Calendar class="w-4 h-4 text-grey mr-1" />
                  </template>
                </v-text-field>
              </v-col>

              <!-- Kết thúc -->
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.ngayKetThuc"
                  type="datetime-local"
                  label="Thời gian kết thúc *"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  :min="minNgayKetThucLocal || undefined"
                >
                  <template v-slot:prepend-inner>
                    <Calendar class="w-4 h-4 text-grey mr-1" />
                  </template>
                </v-text-field>
              </v-col>
            </v-row>

            <v-row class="mb-2">
              <!-- Số lượng phát hành -->
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.soLuong"
                  type="number"
                  label="Tổng số lượng *"
                  placeholder="VD: 100"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                  :min="minSoLuongEdit"
                ></v-text-field>
              </v-col>

              <!-- Đã dùng -->
              <v-col cols="12" sm="4">
                <v-text-field
                  v-model="form.soLuongDaDung"
                  type="number"
                  label="Đã sử dụng"
                  variant="filled"
                  density="compact"
                  hide-details="auto"
                  disabled
                ></v-text-field>
              </v-col>

              <!-- Trạng thái -->
              <v-col cols="12" sm="4">
                <v-select
                  v-model="form.trangThai"
                  :items="[
                    { title: 'Hoạt động', value: '1' },
                    { title: 'Ngưng / Vô hiệu', value: '0' }
                  ]"
                  item-title="title"
                  item-value="value"
                  label="Trạng thái"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                ></v-select>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <!-- Dialog Actions -->
        <v-card-actions class="pa-6 pt-4 border-t">
          <v-spacer></v-spacer>
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="44"
            rounded="xl"
            class="text-none font-weight-bold px-5"
            :disabled="saving"
            @click="closeModal"
          >
            Hủy bỏ
          </v-btn>
          <v-btn
            color="primary"
            height="44"
            variant="flat"
            rounded="xl"
            elevation="4"
            class="text-none font-weight-black px-7"
            :loading="saving"
            :disabled="!isEdit && !asTrimmedString(form.maCode)"
            @click="save"
          >
            <template v-slot:prepend>
              <Check class="w-5 h-5 mr-1 shrink-0" />
            </template>
            {{ isEdit ? 'Lưu cập nhật' : 'Tạo Voucher' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ MODAL: CHI TIẾT VOUCHER ═══════ -->
    <v-dialog v-model="detailOpen" max-width="850px" persistent scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar color="info" size="42" rounded="lg" elevation="2">
              <Eye class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0 d-flex align-center gap-2">
                <span>Chi tiết voucher:</span>
                <v-chip color="grey-darken-3" size="small" class="font-mono">{{ detailCode }}</v-chip>
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Danh sách khách hàng đã lưu mã và các hóa đơn đã áp dụng
              </p>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeDetail">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-progress-circular v-if="detailLoading" indeterminate color="info" class="my-6 mx-auto d-block"></v-progress-circular>
          <template v-else>
            <!-- Khách đã lưu mã -->
            <div class="mb-6">
              <h4 class="text-subtitle-2 font-weight-bold d-flex align-center gap-2 mb-3">
                <UserCheck class="w-4 h-4 text-info" />
                Khách hàng đã lưu mã ({{ detailKhach.length }})
              </h4>
              <v-table density="compact" class="border rounded-xl">
                <thead>
                  <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Mã KH</th>
                    <th class="font-weight-bold text-caption uppercase text-left py-2 text-slate-700 dark:text-slate-200">Họ tên</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">SĐT</th>
                    <th class="font-weight-bold text-caption uppercase text-left py-2 text-slate-700 dark:text-slate-200">Email</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="detailKhach.length === 0">
                    <td colspan="4" class="text-center py-6 text-caption text-medium-emphasis">Chưa có khách hàng nào lưu mã.</td>
                  </tr>
                  <tr v-for="k in detailKhach" :key="k.maKh">
                    <td class="text-center font-mono py-2">{{ k.maKh }}</td>
                    <td class="font-weight-medium py-2">{{ k.hoTen || '—' }}</td>
                    <td class="text-center font-mono py-2">{{ k.sdt || '—' }}</td>
                    <td class="font-mono text-caption py-2">{{ k.email || '—' }}</td>
                  </tr>
                </tbody>
              </v-table>
            </div>

            <!-- Hóa đơn áp dụng -->
            <div>
              <h4 class="text-subtitle-2 font-weight-bold d-flex align-center gap-2 mb-3">
                <Receipt class="w-4 h-4 text-primary" />
                Hóa đơn đã áp dụng mã ({{ detailHoaDon.length }})
              </h4>
              <v-table density="compact" class="border rounded-xl">
                <thead>
                  <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Mã HĐ</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Mã KH</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Ngày</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Tổng tiền</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Thành tiền</th>
                    <th class="font-weight-bold text-caption uppercase text-center py-2 text-slate-700 dark:text-slate-200">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="detailHoaDon.length === 0">
                    <td colspan="6" class="text-center py-6 text-caption text-medium-emphasis">Chưa có hóa đơn nào áp dụng mã.</td>
                  </tr>
                  <tr v-for="h in detailHoaDon" :key="h.maHd">
                    <td class="text-center font-mono font-weight-bold py-2">{{ h.maHd }}</td>
                    <td class="text-center font-mono py-2">{{ h.maKh || '—' }}</td>
                    <td class="text-center py-2">{{ formatShortDate(h.ngayTao) }}</td>
                    <td class="text-center font-mono py-2">{{ formatMoney(h.tongTien) }}</td>
                    <td class="text-center font-mono font-weight-bold text-primary py-2">{{ formatMoney(h.thanhTien) }}</td>
                    <td class="text-center py-2">
                      <v-chip :color="h.trangThai === 1 ? 'success' : 'grey'" size="x-small" class="font-weight-bold">
                        {{ h.trangThai === 1 ? 'Thành công' : 'Chờ' }}
                      </v-chip>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </template>
        </v-card-text>

        <v-card-actions class="pa-6 pt-4 border-t">
          <v-spacer></v-spacer>
          <v-btn variant="outlined" color="grey-darken-1" rounded="lg" @click="closeDetail">Đóng</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ MODAL: XÁC NHẬN XÓA ═══════ -->
    <v-dialog v-model="deleteModalOpen" max-width="450px" persistent>
      <v-card rounded="xl" class="pa-6 text-center">
        <v-avatar color="rose-lighten-5" size="64" class="mx-auto mb-4">
          <AlertCircle class="w-8 h-8 text-rose-500" />
        </v-avatar>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa Voucher?</h3>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Voucher
          <strong class="text-slate-900 dark:text-white">{{ selectedRowToDelete?.maCode }}</strong>
          sẽ bị vô hiệu hóa nhưng không ảnh hưởng đến lịch sử sử dụng trước đó.
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="44"
            rounded="xl"
            class="text-none font-weight-bold px-5"
            @click="deleteModalOpen = false"
          >
            Hủy
          </v-btn>
          <v-btn
            color="error"
            height="44"
            variant="flat"
            rounded="xl"
            elevation="4"
            class="text-none font-weight-black px-6"
            @click="executeRemove"
          >
            <template v-slot:prepend>
              <Trash2 class="w-5 h-5 mr-1 shrink-0" />
            </template>
            Xác nhận xóa
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* Number input spin button styling */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
</style>
