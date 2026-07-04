<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, RotateCcw } from 'lucide-vue-next'

const API_BASE = 'https://localhost:7196/api/admin/vouchers'

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
/** Tham số API: dangChay | sapChay | hetHan | hetLuot; để trống = tất cả */
const lifecycleFilter = ref('')
const loading = ref(false)
const listError = ref('')
const toast = ref('')
const saveError = ref('')

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
const editingCode = ref<string | null>(null)
/** Bản gốc khi sửa — dùng cho khóa ô theo soLuongDaDung */
const originalRowForEdit = ref<AdminVoucherRow | null>(null)
const saving = ref(false)

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

/** Voucher đã đến ngày bắt đầu (hoặc không có ngày bắt đầu = coi như đã trong/không lên lịch sau). */
function isDaBatDau(isoStart: string | null): boolean {
  if (!isoStart) return true
  const t = new Date(isoStart).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() >= t
}

/**
 * Chế độ hạn chế: đã bắt đầu VÀ (đã có lượt dùng hoặc đã có KH lưu mã).
 * Chưa bắt đầu → sửa được mọi thứ dù đã có người lưu.
 */
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

/** Ngày kết thúc tối thiểu (chỉ kéo dài) khi sửa hạn chế — datetime-local */
const minNgayKetThucLocal = computed(() => {
  if (!isRestrictedEdit.value || !originalRowForEdit.value?.ngayKetThuc) return ''
  return toInputDate(originalRowForEdit.value.ngayKetThuc)
})

/** input type="number" có thể gán number vào ref — luôn ép string trước khi trim. */
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

/** datetime-local → ISO UTC; không hợp lệ → null (không gọi toISOString để tránh throw). */
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
    return
  }
  saving.value = true
  toast.value = ''
  try {
    const payload = buildPayload(!isEdit.value)
    if (isEdit.value && editingCode.value) {
      await axios.put(`${API_BASE}/${encodeURIComponent(editingCode.value)}`, payload)
      toast.value = 'Đã cập nhật voucher.'
    } else {
      await axios.post(API_BASE, payload)
      toast.value = 'Đã tạo voucher.'
    }
    closeModal()
    await load()
  } catch (e: unknown) {
    saveError.value = formatApiError(e)
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

async function remove(row: AdminVoucherRow) {
  if (!confirm(MSG_VOUCHER_VO_HIEU)) return
  toast.value = ''
  try {
    await axios.delete(`${API_BASE}/${encodeURIComponent(row.maCode)}`)
    toast.value = MSG_VOUCHER_VO_HIEU
    await load()
  } catch (e: unknown) {
    alert(formatApiError(e))
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
      'Không tải được danh sách. Kiểm tra backend tại https://localhost:7196 (HTTPS / CORS).',
    )
    list.value = []
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
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) {
    wrapper.classList.add('full-width-layout')
  }
})

onUnmounted(() => {
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) {
    wrapper.classList.remove('full-width-layout')
  }
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl" class="d-flex flex-column w-full">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Voucher</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Quản lý mã giảm giá, ưu đãi và lượt sử dụng của khách hàng</div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <div class="d-flex align-center gap-2 text-caption font-weight-bold text-medium-emphasis">
            <span>VÒNG ĐỜI:</span>
            <select
              v-model="lifecycleFilter"
              class="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              @change="load"
            >
              <option value="">Tất cả</option>
              <option value="dangChay">Đang chạy</option>
              <option value="sapChay">Sắp chạy</option>
              <option value="hetHan">Đã hết hạn</option>
              <option value="hetLuot">Đã hết lượt</option>
            </select>
          </div>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" :loading="loading" @click="load" title="Tải lại">
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold" @click="openCreate">
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm voucher
          </v-btn>
        </div>
      </div>

      <v-divider></v-divider>

      <p v-if="toast" class="px-6 pt-4 text-sm font-bold text-emerald-600">{{ toast }}</p>
      <p v-if="listError" class="px-6 pt-4 text-sm font-bold text-rose-600">{{ listError }}</p>

      <div class="overflow-x-auto w-full px-6 pb-6 pt-2 bg-slate-50/50">
        <table class="w-full min-w-[960px] text-left text-xs border-separate [border-spacing:0_8px]">
          <thead class="text-slate-550 uppercase tracking-wider text-[11px]">
            <tr>
              <th class="w-[8%] px-4 py-2 text-center font-bold">Mã</th>
              <th class="w-[8%] px-4 py-2 text-center font-bold">Ưu đãi</th>
              <th class="w-[32%] px-4 py-2 text-left font-bold">Mô tả</th>
              <th class="w-[10%] px-4 py-2 text-center font-bold">HSD</th>
              <th class="w-[10%] px-4 py-2 text-center font-bold">Lượt dùng</th>
              <th class="w-[6%] px-4 py-2 text-center font-bold">KH lưu</th>
              <th class="w-[10%] px-4 py-2 text-center font-bold">Trạng thái</th>
              <th class="w-[16%] px-4 py-2 text-center font-bold whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="8" class="px-4 py-8 text-center text-slate-450 text-xs font-medium bg-white border border-slate-200/60 rounded-xl">Đang tải dữ liệu voucher…</td>
            </tr>
            <tr v-else-if="list.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-slate-450 text-xs font-medium bg-white border border-slate-200/60 rounded-xl">Chưa có voucher nào.</td>
            </tr>
            <tr
              v-for="row in list"
              :key="row.maCode"
              class="hover:bg-slate-50/10 transition-colors group"
            >
              <td class="px-4 py-3 text-center font-mono text-xs text-slate-800 font-bold bg-white border-l border-t border-b border-slate-200/60 rounded-l-xl">{{ row.maCode }}</td>
              <td class="px-4 py-3 text-center text-xs font-bold text-primary bg-white border-t border-b border-slate-200/60">{{ discountLabel(row) }}</td>
              <td class="px-4 py-3 text-left break-words text-xs leading-relaxed text-slate-600 font-medium bg-white border-t border-b border-slate-200/60" :title="row.moTa ?? ''">
                {{ row.moTa || '—' }}
              </td>
              <td class="px-4 py-3 text-center whitespace-nowrap text-xs font-medium text-slate-600 bg-white border-t border-b border-slate-200/60">{{ formatShortDate(row.ngayKetThuc) }}</td>
              <td class="px-4 py-3 text-center font-mono text-xs text-slate-600 bg-white border-t border-b border-slate-200/60">
                <span v-if="row.soLuong != null">{{ row.soLuongDaDung ?? 0 }}/{{ row.soLuong }}</span>
                <span v-else>∞</span>
              </td>
              <td class="px-4 py-3 text-center text-xs font-bold text-slate-700 bg-white border-t border-b border-slate-200/60">{{ row.soKhachDaLuu }}</td>
              <td class="px-4 py-3 text-center text-xs bg-white border-t border-b border-slate-200/60">
                <span v-if="row.trangThai === 1" class="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">Hoạt động</span>
                <span v-else class="inline-block px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200 rounded-md">Vô hiệu</span>
              </td>
              <td class="px-4 py-3 text-center bg-white border-r border-t border-b border-slate-200/60 rounded-r-xl">
                <div class="d-flex align-center justify-center gap-4">
                  <v-btn
                    color="info" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                    @click="openDetail(row)"
                  >
                    Chi tiết
                  </v-btn>
                  <v-btn
                    color="primary" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                    @click="openEdit(row)"
                  >
                    Sửa
                  </v-btn>
                  <v-btn
                    color="error" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                    @click="remove(row)"
                  >
                    Xóa
                  </v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </v-card>

    <!-- Modal giữa màn hình — footer Luu/Hủy luôn thấy -->
    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-[2400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-modal-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-transparent cursor-default"
          aria-label="Đóng"
          @click="closeModal"
        />
        <div
          class="relative z-10 flex max-h-[90vh] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-2xl border border-solid !border-slate-300 bg-white shadow-2xl transition-all"
          @click.stop
        >
          <div class="shrink-0 border-b border-solid !border-slate-200 !px-8 !pt-6 !pb-4 bg-slate-50/50">
            <h2 id="voucher-modal-title" class="!text-lg !font-sans !font-bold text-[#8c734b] tracking-wider uppercase">
              {{ isEdit ? 'Sửa voucher' : 'Thêm voucher mới' }}
            </h2>
            <p class="text-slate-500 mt-1 text-xs leading-relaxed">
              Mã: gồm chữ in hoa và số. Chỉ điền <span class="font-bold text-slate-700">% hoặc số tiền</span> giảm giá.
            </p>
            <div v-if="isRestrictedEdit" class="mt-2 bg-amber-50 border border-solid border-amber-200 p-2.5 rounded-xl text-amber-700 text-[11px] leading-relaxed">
              <strong>Hạn chế chỉnh sửa:</strong> Voucher đã phát hành và được lưu/sử dụng. Chỉ được sửa mô tả, trạng thái, gia hạn ngày kết thúc và tăng tổng số lượng.
            </div>
            <div v-if="saveError" class="mt-2 bg-rose-50 border border-solid border-rose-200 p-2.5 rounded-xl text-rose-600 text-xs font-bold">{{ saveError }}</div>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain !px-8 !py-6 space-y-5 text-xs">
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Mã voucher *</label>
                <Input
                  v-model="form.maCode"
                  :disabled="isEdit"
                  placeholder="VD: CHAOHEXIN"
                  class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all font-mono uppercase"
                  @blur="form.maCode = asTrimmedString(form.maCode).toUpperCase()"
                />
              </div>
              <div class="space-y-1 md:col-span-2">
                <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Mô tả</label>
                <Input
                  v-model="form.moTa"
                  placeholder="Hiển thị cho khách"
                  class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                />
              </div>

              <div class="grid grid-cols-2 gap-4 md:col-span-2 lg:grid-cols-3">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Giảm %</label>
                  <Input
                    v-model="form.phanTramGiam"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Để trống"
                    :disabled="isRestrictedEdit"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Giảm tiền (đ)</label>
                  <Input
                    v-model="form.soTienGiam"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="VD: 50000"
                    :disabled="isRestrictedEdit"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
                <div class="col-span-2 space-y-1 lg:col-span-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Đơn tối thiểu (đ)</label>
                  <Input
                    v-model="form.giaTriToiThieu"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Tùy chọn"
                    :disabled="isRestrictedEdit"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
              </div>

              <div class="grid gap-4 md:col-span-2 sm:grid-cols-2">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Bắt đầu</label>
                  <Input
                    v-model="form.ngayBatDau"
                    type="datetime-local"
                    :disabled="isRestrictedEdit"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Kết thúc</label>
                  <Input
                    v-model="form.ngayKetThuc"
                    type="datetime-local"
                    :min="minNgayKetThucLocal || undefined"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-4 md:col-span-2">
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Số lượng phát hành *</label>
                  <Input
                    v-model="form.soLuong"
                    type="number"
                    :min="minSoLuongEdit"
                    step="1"
                    placeholder="VD: 100"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 outline-none focus:!border-[#8c734b] !bg-slate-50/50 focus:!bg-white text-slate-800 shadow-none transition-all"
                  />
                </div>
                <div class="space-y-1">
                  <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Đã dùng</label>
                  <Input
                    v-model="form.soLuongDaDung"
                    type="number"
                    min="0"
                    disabled
                    title="Hệ thống tự quản lý"
                    class="h-11 text-xs rounded-xl border border-solid !border-slate-300 bg-slate-100 text-slate-500 shadow-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div class="space-y-1 sm:max-w-xs">
                <label class="text-xs font-bold text-slate-500 tracking-wider uppercase">Trạng thái</label>
                <select
                  v-model="form.trangThai"
                  class="h-11 w-full text-xs font-semibold text-slate-700 !bg-slate-50/50 rounded-xl border border-solid !border-slate-300 outline-none focus:ring-0 shadow-none transition-all cursor-pointer"
                >
                  <option value="1">Hoạt động</option>
                  <option value="0">Ngưng</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-solid !border-slate-200 bg-slate-50/50 !px-8 !py-4">
            <Button type="button" variant="outline" class="h-11 px-5 text-xs font-bold rounded-xl border border-solid !border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer" @click="closeModal">Hủy</Button>
            <Button
              type="button"
              class="h-11 px-5 !bg-[#9d804e] !text-white hover:!bg-[#866a3d] border border-solid !border-[#9d804e] text-xs font-bold rounded-xl shadow-none cursor-pointer tracking-wider"
              :disabled="saving || (!isEdit && !asTrimmedString(form.maCode))"
              @click="save"
            >
              {{ saving ? 'Đang lưu…' : 'Lưu' }}
            </Button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="detailOpen"
        class="fixed inset-0 z-[2400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-detail-title"
      >
        <button type="button" class="absolute inset-0 bg-transparent cursor-default" aria-label="Đóng" @click="closeDetail" />
        <div
          class="relative z-10 flex max-h-[85vh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-2xl border border-solid !border-slate-300 bg-white shadow-2xl transition-all"
          @click.stop
        >
          <div class="shrink-0 border-b border-solid !border-slate-200 !px-8 !pt-6 !pb-4 bg-slate-50/50">
            <h2 id="voucher-detail-title" class="!text-lg !font-sans !font-bold text-[#8c734b] tracking-wider uppercase flex items-center gap-2">
              <span>Chi tiết voucher:</span>
              <span v-if="detailCode" class="font-mono text-base text-slate-800 bg-slate-200/60 px-2 py-0.5 rounded-md">{{ detailCode }}</span>
            </h2>
            <p class="text-slate-500 mt-1 text-xs">Danh sách khách hàng đã lưu mã và các hóa đơn đã áp dụng mã voucher này.</p>
            <div v-if="detailError" class="mt-2 bg-rose-50 border border-solid border-rose-200 p-2.5 rounded-xl text-rose-600 text-xs font-bold">{{ detailError }}</div>
          </div>
          <div class="min-h-0 flex-1 space-y-5 overflow-y-auto !px-8 !py-6 text-xs">
            <p v-if="detailLoading" class="text-slate-450 text-xs">Đang tải…</p>
            <template v-else>
              <div class="space-y-3">
                <h3 class="!text-sm !font-bold !font-sans text-[#8c734b] uppercase tracking-wider">Khách đã lưu mã</h3>
                <div class="overflow-x-auto rounded-xl border border-solid border-slate-200 shadow-xs bg-white">
                  <table class="w-full min-w-[540px] text-left text-xs border-collapse">
                    <thead class="bg-slate-50 border-b border-solid border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Mã KH</th>
                        <th class="px-4 py-3 text-left font-semibold border-b border-solid border-slate-200">Họ tên</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">SĐT</th>
                        <th class="px-4 py-3 text-left font-semibold border-b border-solid border-slate-200">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="detailKhach.length === 0">
                        <td colspan="4" class="text-slate-450 px-4 py-8 text-center bg-white">Chưa có khách lưu mã.</td>
                      </tr>
                      <tr v-for="k in detailKhach" :key="k.maKh" class="border-b border-solid border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-slate-800 font-semibold bg-white">{{ k.maKh }}</td>
                        <td class="px-4 py-3 text-slate-700 font-medium bg-white">{{ k.hoTen || '—' }}</td>
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-slate-600 whitespace-nowrap bg-white">{{ k.sdt || '—' }}</td>
                        <td class="px-4 py-3 text-left font-mono text-[11px] text-slate-500 break-all bg-white">{{ k.email || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div class="space-y-3">
                <h3 class="!text-sm !font-bold !font-sans text-[#8c734b] uppercase tracking-wider">Hóa đơn đã áp dụng mã</h3>
                <div class="overflow-x-auto rounded-xl border border-solid border-slate-200 shadow-xs bg-white">
                  <table class="w-full min-w-[640px] text-left text-xs border-collapse">
                    <thead class="bg-slate-50 border-b border-solid border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Mã HĐ</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Mã KH</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Ngày</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Tổng tiền</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Thành tiền</th>
                        <th class="px-4 py-3 text-center font-semibold border-b border-solid border-slate-200">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="detailHoaDon.length === 0">
                        <td colspan="6" class="text-slate-450 px-4 py-8 text-center bg-white">Chưa có hóa đơn.</td>
                      </tr>
                      <tr v-for="h in detailHoaDon" :key="h.maHd" class="border-b border-solid border-slate-100 hover:bg-slate-50/50 transition-colors">
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-slate-800 font-semibold bg-white">{{ h.maHd }}</td>
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-slate-600 bg-white">{{ h.maKh || '—' }}</td>
                        <td class="px-4 py-3 text-center text-slate-600 whitespace-nowrap bg-white">{{ formatShortDate(h.ngayTao) }}</td>
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-slate-700 bg-white">{{ formatMoney(h.tongTien) }}</td>
                        <td class="px-4 py-3 text-center font-mono text-[11px] text-[#8c734b] font-bold bg-white">{{ formatMoney(h.thanhTien) }}</td>
                        <td class="px-4 py-3 text-center text-[10px] font-bold bg-white">
                          <span v-if="h.trangThai === 1" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-solid border-emerald-200">Thành công</span>
                          <span v-else class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-solid border-slate-200">Chờ</span>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </div>
          <div class="flex shrink-0 justify-end border-t border-solid !border-slate-200 bg-slate-50/50 !px-8 !py-4">
            <Button type="button" variant="outline" class="h-11 px-6 text-xs font-bold rounded-xl border border-solid !border-slate-300 text-slate-700 hover:bg-slate-100 cursor-pointer" @click="closeDetail">Đóng</Button>
          </div>
        </div>
      </div>
    </Teleport>
  </v-container>
</template>
