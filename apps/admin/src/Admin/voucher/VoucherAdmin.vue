<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

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
})
</script>

<template>
  <div class="w-full max-w-full space-y-3">
    <div class="space-y-2">
      <div>
        <h1 class="text-xl font-semibold tracking-tight">Quản lý voucher</h1>
        <p class="text-muted-foreground text-sm">
         
        </p>
      </div>

      <!-- Thanh thao tác: gom nút giữa khối nội dung, không ép góc phải viewport -->
      <div
        class="flex flex-wrap items-center justify-center gap-2 rounded-md border border-border bg-muted/30 px-2.5 py-2 sm:justify-start"
      >
        <Button type="button" @click="openCreate">Thêm voucher</Button>
        <label class="text-muted-foreground flex items-center gap-2 text-sm">
          <span class="whitespace-nowrap">Lọc vòng đời</span>
          <select
            v-model="lifecycleFilter"
            class="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 min-w-[11rem] rounded-md border px-2 text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            @change="load"
          >
            <option value="">Tất cả</option>
            <option value="dangChay">Đang chạy</option>
            <option value="sapChay">Sắp chạy</option>
            <option value="hetHan">Đã hết hạn</option>
            <option value="hetLuot">Đã hết lượt</option>
          </select>
        </label>
        <Button type="button" variant="outline" :disabled="loading" @click="load">
          {{ loading ? 'Đang tải…' : 'Tải lại danh sách' }}
        </Button>
      </div>
    </div>

    <p v-if="toast" class="text-sm text-green-600 dark:text-green-400">{{ toast }}</p>
    <p v-if="listError" class="text-destructive text-sm">{{ listError }}</p>

    <div class="overflow-x-auto rounded-md border border-border">
      <table class="w-full min-w-[880px] table-fixed text-left text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="w-[10%] px-2 py-1.5 text-xs font-medium">Mã</th>
            <th class="w-[9%] px-2 py-1.5 text-xs font-medium">Ưu đãi</th>
            <th class="w-[28%] px-2 py-1.5 text-xs font-medium">Mô tả</th>
            <th class="w-[10%] px-2 py-1.5 text-xs font-medium">HSD</th>
            <th class="w-[10%] px-2 py-1.5 text-xs font-medium">Lượt</th>
            <th class="w-[8%] px-2 py-1.5 text-xs font-medium">KH lưu</th>
            <th class="w-[7%] px-2 py-1.5 text-xs font-medium">TT</th>
            <th class="w-[18%] px-2 py-1.5 text-center text-xs font-medium whitespace-nowrap">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="8" class="px-2 py-5 text-center text-muted-foreground text-xs">Đang tải…</td>
          </tr>
          <tr v-else-if="list.length === 0">
            <td colspan="8" class="px-2 py-5 text-center text-muted-foreground text-xs">Chưa có voucher.</td>
          </tr>
          <tr
            v-for="row in list"
            :key="row.maCode"
            class="border-t border-border hover:bg-muted/30"
          >
            <td class="px-2 py-1.5 font-mono text-[11px] leading-tight">{{ row.maCode }}</td>
            <td class="px-2 py-1.5 text-xs leading-tight">{{ discountLabel(row) }}</td>
            <td class="px-2 py-1.5 align-top break-words text-xs leading-snug text-foreground/90" :title="row.moTa ?? ''">
              {{ row.moTa || '—' }}
            </td>
            <td class="px-2 py-1.5 whitespace-nowrap text-xs">{{ formatShortDate(row.ngayKetThuc) }}</td>
            <td class="px-2 py-1.5 text-[11px] leading-tight">
              <span v-if="row.soLuong != null">{{ row.soLuongDaDung ?? 0 }}/{{ row.soLuong }}</span>
              <span v-else>∞</span>
            </td>
            <td class="px-2 py-1.5 text-xs">{{ row.soKhachDaLuu }}</td>
            <td class="px-2 py-1.5 text-xs">
              <span v-if="row.trangThai === 1" class="text-green-600">Bật</span>
              <span v-else class="text-muted-foreground">Tắt</span>
            </td>
            <td class="px-2 py-1.5">
              <div class="flex flex-wrap items-center justify-center gap-1">
                <Button variant="secondary" size="sm" class="h-7 min-w-0 px-2 text-[11px]" @click="openDetail(row)">
                  Chi tiết
                </Button>
                <Button variant="outline" size="sm" class="h-7 min-w-0 px-2 text-[11px]" @click="openEdit(row)">
                  Sửa
                </Button>
                <Button variant="destructive" size="sm" class="h-7 min-w-0 px-2 text-[11px]" @click="remove(row)">
                  Xóa
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal giữa màn hình — footer Luu/Hủy luôn thấy -->
    <Teleport to="body">
      <div
        v-if="modalOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-modal-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-black/50"
          aria-label="Đóng"
          @click="closeModal"
        />
        <div
          class="relative z-10 flex max-h-[85vh] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
          @click.stop
        >
          <div class="shrink-0 border-b border-border px-4 py-2">
            <h2 id="voucher-modal-title" class="text-base font-semibold">
              {{ isEdit ? 'Sửa voucher' : 'Thêm voucher' }}
            </h2>
            <p class="text-muted-foreground mt-0.5 text-xs leading-snug">
              Mã: chữ in hoa + số. Chỉ điền <span class="font-medium">% hoặc tiền</span> giảm.
            </p>
            <p v-if="isRestrictedEdit" class="text-amber-700 dark:text-amber-400 mt-1.5 text-xs leading-snug">
              Đã chạy và có KH lưu mã / đã dùng lượt: chỉ sửa mô tả, gia hạn hạn dùng, tăng số lượng, trạng thái.
            </p>
            <p v-if="saveError" class="text-destructive mt-1.5 text-xs">{{ saveError }}</p>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <div class="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2">
              <div class="grid gap-0.5">
                <label class="text-xs font-medium">Mã voucher *</label>
                <Input
                  v-model="form.maCode"
                  :disabled="isEdit"
                  placeholder="VD: CHAOHEXIN"
                  class="font-mono text-sm uppercase"
                  @blur="form.maCode = asTrimmedString(form.maCode).toUpperCase()"
                />
              </div>
              <div class="grid gap-0.5 md:col-span-2">
                <label class="text-xs font-medium">Mô tả</label>
                <Input v-model="form.moTa" placeholder="Hiển thị cho khách" />
              </div>

              <div class="grid grid-cols-2 gap-2 md:col-span-2 lg:grid-cols-3">
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Giảm %</label>
                  <Input
                    v-model="form.phanTramGiam"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="Để trống"
                    :disabled="isRestrictedEdit"
                  />
                </div>
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Giảm tiền (đ)</label>
                  <Input
                    v-model="form.soTienGiam"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="VD: 50000"
                    :disabled="isRestrictedEdit"
                  />
                </div>
                <div class="col-span-2 grid gap-0.5 lg:col-span-1">
                  <label class="text-xs font-medium">Đơn tối thiểu (đ)</label>
                  <Input
                    v-model="form.giaTriToiThieu"
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="Tùy chọn"
                    :disabled="isRestrictedEdit"
                  />
                </div>
              </div>

              <div class="grid gap-2 md:col-span-2 sm:grid-cols-2">
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Bắt đầu</label>
                  <Input v-model="form.ngayBatDau" type="datetime-local" :disabled="isRestrictedEdit" />
                </div>
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Kết thúc</label>
                  <Input
                    v-model="form.ngayKetThuc"
                    type="datetime-local"
                    :min="minNgayKetThucLocal || undefined"
                  />
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2 md:col-span-2">
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Số lượng phát hành *</label>
                  <Input
                    v-model="form.soLuong"
                    type="number"
                    :min="minSoLuongEdit"
                    step="1"
                    placeholder="VD: 100"
                  />
                </div>
                <div class="grid gap-0.5">
                  <label class="text-xs font-medium">Đã dùng</label>
                  <Input v-model="form.soLuongDaDung" type="number" min="0" disabled title="Hệ thống tự quản lý" />
                </div>
              </div>

              <div class="grid gap-0.5 sm:max-w-xs">
                <label class="text-xs font-medium">Trạng thái</label>
                <select
                  v-model="form.trangThai"
                  class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border px-2 py-1 text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="1">Hoạt động</option>
                  <option value="0">Ngưng</option>
                </select>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border bg-background px-4 py-2.5">
            <Button type="button" variant="outline" size="sm" @click="closeModal">Hủy</Button>
            <Button
              type="button"
              size="sm"
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
        class="fixed inset-0 z-[60] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="voucher-detail-title"
      >
        <button type="button" class="absolute inset-0 bg-black/50" aria-label="Đóng" @click="closeDetail" />
        <div
          class="relative z-10 flex max-h-[82vh] w-full max-w-4xl min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-lg"
          @click.stop
        >
          <div class="shrink-0 border-b border-border px-4 py-2">
            <h2 id="voucher-detail-title" class="text-base font-semibold">
              Chi tiết voucher
              <span v-if="detailCode" class="text-muted-foreground font-mono text-sm">{{ detailCode }}</span>
            </h2>
            <p class="text-muted-foreground mt-0.5 text-xs">Khách đã lưu mã và hóa đơn đã áp mã.</p>
            <p v-if="detailError" class="text-destructive mt-1.5 text-xs">{{ detailError }}</p>
          </div>
          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            <p v-if="detailLoading" class="text-muted-foreground text-xs">Đang tải…</p>
            <template v-else>
              <div>
                <h3 class="mb-1 text-xs font-medium">Khách đã lưu mã</h3>
                <div class="overflow-x-auto rounded-md border border-border">
                  <table class="w-full min-w-[480px] text-left text-xs">
                    <thead class="bg-muted/50">
                      <tr>
                        <th class="px-2 py-1.5 font-medium">Mã KH</th>
                        <th class="px-2 py-1.5 font-medium">Họ tên</th>
                        <th class="px-2 py-1.5 font-medium">SĐT</th>
                        <th class="px-2 py-1.5 font-medium">Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="detailKhach.length === 0">
                        <td colspan="4" class="text-muted-foreground px-2 py-4 text-center">Chưa có khách lưu mã.</td>
                      </tr>
                      <tr v-for="k in detailKhach" :key="k.maKh" class="border-t border-border">
                        <td class="px-2 py-1.5 font-mono text-[11px]">{{ k.maKh }}</td>
                        <td class="px-2 py-1.5">{{ k.hoTen || '—' }}</td>
                        <td class="px-2 py-1.5 whitespace-nowrap">{{ k.sdt || '—' }}</td>
                        <td class="px-2 py-1.5 break-all text-[11px]">{{ k.email || '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 class="mb-1 text-xs font-medium">Hóa đơn đã áp dụng mã</h3>
                <div class="overflow-x-auto rounded-md border border-border">
                  <table class="w-full min-w-[560px] text-left text-xs">
                    <thead class="bg-muted/50">
                      <tr>
                        <th class="px-2 py-1.5 font-medium">Mã HĐ</th>
                        <th class="px-2 py-1.5 font-medium">Mã KH</th>
                        <th class="px-2 py-1.5 font-medium">Ngày</th>
                        <th class="px-2 py-1.5 font-medium">Tổng tiền</th>
                        <th class="px-2 py-1.5 font-medium">Thành tiền</th>
                        <th class="px-2 py-1.5 font-medium">TT</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="detailHoaDon.length === 0">
                        <td colspan="6" class="text-muted-foreground px-2 py-4 text-center">Chưa có hóa đơn.</td>
                      </tr>
                      <tr v-for="h in detailHoaDon" :key="h.maHd" class="border-t border-border">
                        <td class="px-2 py-1.5 font-mono text-[11px]">{{ h.maHd }}</td>
                        <td class="px-2 py-1.5 font-mono text-[11px]">{{ h.maKh || '—' }}</td>
                        <td class="px-2 py-1.5 whitespace-nowrap">{{ formatShortDate(h.ngayTao) }}</td>
                        <td class="px-2 py-1.5">{{ formatMoney(h.tongTien) }}</td>
                        <td class="px-2 py-1.5">{{ formatMoney(h.thanhTien) }}</td>
                        <td class="px-2 py-1.5">{{ h.trangThai ?? '—' }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </div>
          <div class="flex shrink-0 justify-end border-t border-border px-4 py-2">
            <Button type="button" variant="outline" size="sm" @click="closeDetail">Đóng</Button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
