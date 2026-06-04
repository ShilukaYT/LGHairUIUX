<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { toast } from 'vue-sonner'
import {
  Plus,
  Pencil,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Upload,
  Eye,
  EyeOff,
} from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

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

const GIOI_TINH_NONE = 'none'
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

function onCreateGioiTinhSelect(v: unknown) {
  createForm.value.gioiTinh = v === GIOI_TINH_NONE ? '' : String(v)
  createGioiTinhError.value = ''
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
    toast.success('Đã tải ảnh lên.')
    if (target === 'create') createAvatarError.value = ''
  } catch {
    toast.error('Không upload được ảnh.')
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
    toast.error('Chỉ chọn file ảnh (JPG, PNG, WEBP).')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error('Ảnh tối đa 5MB.')
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
    toast.error('Không tải được danh sách khách hàng.')
    list.value = []
  } finally {
    loading.value = false
  }
}

function onCreateLoaiChange(v: unknown) {
  const val = String(v ?? '')
  if (val === 'vang_lai') {
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
    gioiTinh: '',
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
  showEditPassword.value = true
  try {
    const res = await axios.get<DetailRow>(`${BASE}/${encodeURIComponent(row.maKh)}`, {
      withCredentials: true,
    })
    const d = res.data
    const mkHienTai = d.matKhau ?? ''
    editMatKhauBanDau.value = mkHienTai
    editForm.value = {
      hoTen: d.hoTen ?? '',
      email: d.email ?? '',
      sdt: d.sdt ?? '',
      gioiTinh: d.gioiTinh ?? '',
      diemTichLuy: d.diemTichLuy != null ? String(d.diemTichLuy) : '0',
      trangThai: d.trangThai != null ? String(d.trangThai) : '1',
      hinhAnh: d.hinhAnh ?? '',
      matKhauMoi: mkHienTai,
      tenRank: d.tenRank ?? d.maRank ?? '',
    }
  } catch {
    toast.error('Không tải chi tiết khách hàng.')
    editOpen.value = false
  }
}

async function saveEdit() {
  if (!editingMaKh.value) return
  const emailChk = validateEmail(editForm.value.email)
  if (!emailChk.ok) {
    toast.error(emailChk.message)
    return
  }
  editForm.value.email = emailChk.email
  const sdtRaw = editForm.value.sdt.trim()
  if (sdtRaw) {
    const chk = validateSdtVn(sdtRaw)
    if (!chk.ok) {
      toast.error(chk.message)
      return
    }
    editForm.value.sdt = chk.sdt
  }
  saving.value = true
  try {
    const diem = parseInt(editForm.value.diemTichLuy, 10)
    const mkTrim = editForm.value.matKhauMoi.trim()
    const banDauTrim = editMatKhauBanDau.value.trim()
    const matKhauMoiPayload =
      mkTrim === '' ? null : mkTrim === banDauTrim ? null : mkTrim
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
      toast.success('Đã cập nhật khách hàng.', {
        description: `Mật khẩu mới (đăng nhập khách): ${mkMoi}`,
        duration: 25_000,
      })
    } else {
      toast.success('Đã cập nhật khách hàng.')
    }
    editOpen.value = false
    await fetchList()
  } catch (e: unknown) {
    const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null
    toast.error(msg || 'Lưu thất bại.')
  } finally {
    saving.value = false
  }
}

async function saveCreate() {
  if (!createForm.value.hoTen.trim()) {
    toast.error('Nhập họ tên.')
    return
  }
  const sdtCheck = validateSdtVn(createForm.value.sdt)
  if (!sdtCheck.ok) {
    createSdtError.value = sdtCheck.message
    toast.error(sdtCheck.message)
    return
  }
  createSdtError.value = ''
  const emailCheck = validateEmail(createForm.value.email)
  if (!emailCheck.ok) {
    createEmailError.value = emailCheck.message
    toast.error(emailCheck.message)
    return
  }
  createEmailError.value = ''
  if (!createForm.value.gioiTinh.trim()) {
    const msg = 'Vui lòng chọn giới tính.'
    createGioiTinhError.value = msg
    toast.error(msg)
    return
  }
  createGioiTinhError.value = ''
  if (!createForm.value.hinhAnh.trim()) {
    const msg = 'Vui lòng tải ảnh đại diện.'
    createAvatarError.value = msg
    toast.error(msg)
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
      toast.success('Đã tạo khách hàng mới.', {
        description: `${maKh ? `Mã KH: ${maKh}. ` : ''}Mật khẩu đăng nhập: ${mk}`,
        duration: 25_000,
      })
    } else {
      toast.success('Đã tạo khách hàng mới.')
    }
    createOpen.value = false
    page.value = 1
    await fetchList()
  } catch (e: unknown) {
    const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null
    toast.error(msg || 'Tạo thất bại.')
  } finally {
    saving.value = false
  }
}

function trangThaiLabel(t: number | null | undefined) {
  if (t === 1) return 'Hoạt động'
  if (t === 0) return 'Khóa'
  return t == null ? '—' : `Trạng thái ${t}`
}

function trangThaiVariant(t: number | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (t === 1) return 'default'
  if (t === 0) return 'destructive'
  return 'secondary'
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    page.value = 1
    fetchList()
  }, 400)
}

watch(trangThaiFilter, () => {
  page.value = 1
})

watch([page, pageSize, trangThaiFilter], () => {
  fetchList()
})

onMounted(() => {
  fetchList()
})
</script>

<template>
  <div class="w-full max-w-[1920px] space-y-8 px-2 sm:px-4 lg:px-6">
    <Toaster rich-colors position="top-right" />

    <div class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex items-center gap-4">
        <div class="bg-primary/10 flex size-14 shrink-0 items-center justify-center rounded-xl">
          <Users class="text-primary size-7" />
        </div>
        <div>
          <h1 class="text-3xl font-semibold tracking-tight">Quản lý khách hàng</h1>
          <p class="text-muted-foreground mt-1 text-base">Danh sách, tìm kiếm, thêm và chỉnh sửa thông tin khách.</p>
        </div>
      </div>
      <Button type="button" class="h-11 shrink-0 gap-2 px-5 text-base" @click="openCreate">
        <Plus class="size-5" />
        Thêm khách hàng
      </Button>
    </div>

    <div class="bg-card text-card-foreground flex flex-col gap-5 rounded-xl border p-5 shadow-sm sm:flex-row sm:items-end sm:p-7">
      <div class="min-w-0 flex-1 space-y-2">
        <Label for="kw" class="text-base">Tìm kiếm</Label>
        <div class="relative">
          <Search class="text-muted-foreground absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
          <Input
            id="kw"
            v-model="keyword"
            class="h-11 pl-11 text-base"
            placeholder="Mã KH, họ tên, SĐT, email…"
            @input="onSearchInput"
          />
        </div>
      </div>
      <div class="w-full space-y-2 sm:w-56">
        <Label class="text-base">Trạng thái</Label>
        <Select v-model="trangThaiFilter">
          <SelectTrigger class="h-11 text-base">
            <SelectValue placeholder="Tất cả" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả</SelectItem>
            <SelectItem value="1">Hoạt động</SelectItem>
            <SelectItem value="0">Khóa</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="w-full space-y-2 sm:w-44">
        <Label class="text-base">Số dòng / trang</Label>
        <Select
          :model-value="String(pageSize)"
          @update:model-value="(v: unknown) => { pageSize = Number(v); page = 1 }"
        >
          <SelectTrigger class="h-11 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm">
      <div class="overflow-x-auto">
        <Table
          class="text-base [&_th]:h-14 [&_th]:px-4 [&_th]:text-base [&_td]:px-4 [&_td]:py-3.5"
        >
          <TableHeader>
            <TableRow>
              <TableHead class="w-[120px] min-w-[7rem]">Mã KH</TableHead>
              <TableHead class="min-w-[10rem]">Họ tên</TableHead>
              <TableHead class="min-w-[8rem]">SĐT</TableHead>
              <TableHead class="min-w-[14rem]">Email</TableHead>
              <TableHead class="min-w-[7rem]">Hạng</TableHead>
              <TableHead class="min-w-[5rem] text-right">Điểm</TableHead>
              <TableHead class="min-w-[8rem]">Trạng thái</TableHead>
              <TableHead class="min-w-[7rem] text-right">Thao tác</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-if="loading">
              <TableCell colspan="8" class="text-muted-foreground py-14 text-center text-base">
                Đang tải…
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!list.length">
              <TableCell colspan="8" class="text-muted-foreground py-14 text-center text-base">
                Không có dữ liệu.
              </TableCell>
            </TableRow>
            <TableRow v-for="row in list" :key="row.maKh">
              <TableCell class="font-mono">{{ row.maKh }}</TableCell>
              <TableCell class="font-medium">{{ row.hoTen || '—' }}</TableCell>
              <TableCell class="whitespace-nowrap">{{ row.sdt || '—' }}</TableCell>
              <TableCell class="max-w-xs truncate sm:max-w-md">{{ row.email || '—' }}</TableCell>
              <TableCell>{{ row.tenRank || row.maRank || '—' }}</TableCell>
              <TableCell class="text-right text-base tabular-nums">{{ row.diemTichLuy ?? 0 }}</TableCell>
              <TableCell>
                <Badge :variant="trangThaiVariant(row.trangThai)" class="px-2.5 py-0.5 text-sm">
                  {{ trangThaiLabel(row.trangThai) }}
                </Badge>
              </TableCell>
              <TableCell class="text-right">
                <Button
                  type="button"
                  variant="outline"
                  class="h-9 gap-1.5 px-3 text-sm"
                  @click="openEdit(row)"
                >
                  <Pencil class="size-4" />
                  Sửa
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div
        class="text-muted-foreground flex flex-col items-center justify-between gap-4 border-t px-6 py-4 text-base sm:flex-row"
      >
        <span>
          Tổng <strong class="text-foreground">{{ totalCount }}</strong> khách
          · Trang {{ page }} / {{ totalPages }}
        </span>
        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            class="size-11"
            :disabled="page <= 1 || loading"
            @click="page = Math.max(1, page - 1)"
          >
            <ChevronLeft class="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            class="size-11"
            :disabled="page >= totalPages || loading"
            @click="page = Math.min(totalPages, page + 1)"
          >
            <ChevronRight class="size-5" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Sửa -->
    <Dialog v-model:open="editOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="text-xl">Sửa khách hàng</DialogTitle>
        </DialogHeader>
        <div class="space-y-5 py-2 text-base">
          <p class="text-muted-foreground text-sm leading-relaxed">
            Hạng thành viên được hệ thống tự cập nhật theo điểm (giống đăng nhập khách).
            <span v-if="editForm.tenRank" class="text-foreground font-medium">Hiện tại: {{ editForm.tenRank }}</span>
          </p>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
            <div class="space-y-2">
              <Label for="ef-ten">Họ tên</Label>
              <Input id="ef-ten" v-model="editForm.hoTen" class="h-11 text-base" />
            </div>
            <div class="space-y-2">
              <Label for="ef-sdt">Số điện thoại</Label>
              <Input
                id="ef-sdt"
                v-model="editForm.sdt"
                class="h-11 text-base"
                placeholder="VD: 09xxxxxxxx"
                inputmode="tel"
                autocomplete="tel"
              />
            </div>
            <div class="space-y-2">
              <Label for="ef-email">Email *</Label>
              <Input
                id="ef-email"
                v-model="editForm.email"
                class="h-11 text-base"
                type="email"
                autocomplete="email"
                placeholder="vidu@email.com"
              />
            </div>
            <div class="space-y-2">
              <Label>Giới tính</Label>
              <Select
                :model-value="editForm.gioiTinh.trim() ? editForm.gioiTinh.trim() : GIOI_TINH_NONE"
                @update:model-value="
                  (v: unknown) => {
                    editForm.gioiTinh = v === GIOI_TINH_NONE ? '' : String(v)
                  }
                "
              >
                <SelectTrigger class="h-11 text-base">
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="GIOI_TINH_NONE">Chưa chọn</SelectItem>
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-2">
              <Label for="ef-diem">Điểm tích lũy</Label>
              <Input id="ef-diem" v-model="editForm.diemTichLuy" class="h-11 text-base" type="number" min="0" />
            </div>
            <div class="space-y-2">
              <Label>Trạng thái</Label>
              <Select v-model="editForm.trangThai">
                <SelectTrigger class="h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Hoạt động</SelectItem>
                  <SelectItem value="0">Khóa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="border-border space-y-3 border-t pt-4">
            <Label>Ảnh đại diện</Label>
            <p class="text-muted-foreground text-xs">Chọn file JPG, PNG hoặc WEBP (tối đa 5MB). Không cần dán URL.</p>
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div
                class="bg-muted border-input flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
              >
                <img
                  v-if="mediaUrl(editForm.hinhAnh)"
                  :src="mediaUrl(editForm.hinhAnh)"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else class="text-muted-foreground px-2 text-center text-sm">Chưa có ảnh</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <input
                  ref="editAvatarFileRef"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  class="hidden"
                  @change="onPickAvatar($event, 'edit')"
                />
                <Button
                  type="button"
                  variant="outline"
                  class="h-11 gap-2"
                  :disabled="avatarUploading"
                  @click="editAvatarFileRef?.click()"
                >
                  <Upload class="size-4" />
                  {{ avatarUploading ? 'Đang tải…' : 'Chọn ảnh' }}
                </Button>
                <Button
                  v-if="editForm.hinhAnh"
                  type="button"
                  variant="ghost"
                  class="h-11"
                  :disabled="avatarUploading"
                  @click="clearAvatar('edit')"
                >
                  Xóa ảnh
                </Button>
              </div>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="ef-mk">Mật khẩu đăng nhập</Label>
            <p class="text-muted-foreground text-xs">
              Hiển thị mật khẩu hiện tại. Sửa nội dung để đổi mật khẩu; xóa trắng ô rồi lưu = giữ nguyên mật khẩu cũ.
            </p>
            <div class="relative">
              <Input
                id="ef-mk"
                v-model="editForm.matKhauMoi"
                class="h-11 pr-11 text-base"
                :type="showEditPassword ? 'text' : 'password'"
                autocomplete="off"
                spellcheck="false"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="text-muted-foreground absolute top-0 right-0 z-20 h-11 w-11 shrink-0"
                :aria-pressed="showEditPassword"
                :aria-label="showEditPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                @click.stop.prevent="toggleEditPassword"
              >
                <Eye v-if="!showEditPassword" class="pointer-events-none size-5" />
                <EyeOff v-else class="pointer-events-none size-5" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" class="h-11 px-5 text-base" @click="editOpen = false">
            Hủy
          </Button>
          <Button type="button" class="h-11 px-5 text-base" :disabled="saving" @click="saveEdit">Lưu</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Thêm -->
    <Dialog v-model:open="createOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="text-xl">Thêm khách hàng</DialogTitle>
        </DialogHeader>
        <div class="space-y-5 py-2 text-base">
          <div class="space-y-2">
            <Label>Loại khách</Label>
            <Select
              :model-value="createLoaiKhach"
              @update:model-value="onCreateLoaiChange"
            >
              <SelectTrigger class="h-11 text-base">
                <SelectValue placeholder="Chọn loại" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vang_lai">Khách vãng lai (mặc định)</SelectItem>
                <SelectItem value="ten_cu_the">Khách có tên cụ thể</SelectItem>
              </SelectContent>
            </Select>
            <p class="text-muted-foreground text-sm">
              {{
                createLoaiKhach === 'vang_lai'
                  ? 'Họ tên đặt sẵn "Khách vãng lai" — có thể sửa nếu cần. Email bắt buộc.'
                  : 'Nhập họ tên, số điện thoại và email đầy đủ.'
              }}
            </p>
          </div>

          <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
            <div class="space-y-2">
              <Label for="cf-ten">Họ tên *</Label>
              <Input id="cf-ten" v-model="createForm.hoTen" class="h-11 text-base" />
            </div>
            <div class="space-y-2">
              <Label for="cf-sdt">Số điện thoại *</Label>
              <Input
                id="cf-sdt"
                v-model="createForm.sdt"
                class="h-11 text-base"
                :class="createSdtError ? 'border-destructive' : ''"
                placeholder="VD: 09xxxxxxxx hoặc +84…"
                inputmode="tel"
                autocomplete="tel"
                :aria-invalid="!!createSdtError"
                @input="createSdtError = ''"
              />
              <p v-if="createSdtError" class="text-destructive text-sm">{{ createSdtError }}</p>
            </div>
            <div class="space-y-2">
              <Label for="cf-email">Email *</Label>
              <Input
                id="cf-email"
                v-model="createForm.email"
                class="h-11 text-base"
                :class="createEmailError ? 'border-destructive' : ''"
                type="email"
                autocomplete="email"
                placeholder="vidu@email.com"
                :aria-invalid="!!createEmailError"
                @input="createEmailError = ''"
              />
              <p v-if="createEmailError" class="text-destructive text-sm">{{ createEmailError }}</p>
            </div>
            <div class="space-y-2">
              <Label>Giới tính *</Label>
              <Select
                :model-value="createForm.gioiTinh.trim() ? createForm.gioiTinh.trim() : GIOI_TINH_NONE"
                @update:model-value="onCreateGioiTinhSelect"
              >
                <SelectTrigger
                  class="h-11 text-base"
                  :class="createGioiTinhError ? 'border-destructive' : ''"
                  :aria-invalid="!!createGioiTinhError"
                >
                  <SelectValue placeholder="Chọn giới tính" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="GIOI_TINH_NONE">Chưa chọn</SelectItem>
                  <SelectItem value="Nam">Nam</SelectItem>
                  <SelectItem value="Nữ">Nữ</SelectItem>
                  <SelectItem value="Khác">Khác</SelectItem>
                </SelectContent>
              </Select>
              <p v-if="createGioiTinhError" class="text-destructive text-sm">{{ createGioiTinhError }}</p>
            </div>
          </div>

          <div class="border-border space-y-3 border-t pt-4">
            <Label>Ảnh đại diện *</Label>
            <p class="text-muted-foreground text-xs">Bắt buộc — JPG, PNG, WEBP — tối đa 5MB.</p>
            <div
              class="flex flex-col gap-4 sm:flex-row sm:items-center"
              :class="createAvatarError ? 'rounded-xl ring-2 ring-destructive ring-offset-2' : ''"
            >
              <div
                class="bg-muted border-input flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border"
              >
                <img
                  v-if="mediaUrl(createForm.hinhAnh)"
                  :src="mediaUrl(createForm.hinhAnh)"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else class="text-muted-foreground px-2 text-center text-sm">Chưa chọn</span>
              </div>
              <div class="flex flex-wrap gap-2">
                <input
                  ref="createAvatarFileRef"
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  class="hidden"
                  @change="onPickAvatar($event, 'create')"
                />
                <Button
                  type="button"
                  variant="outline"
                  class="h-11 gap-2"
                  :disabled="avatarUploading"
                  @click="createAvatarFileRef?.click()"
                >
                  <Upload class="size-4" />
                  {{ avatarUploading ? 'Đang tải…' : 'Chọn ảnh' }}
                </Button>
                <Button
                  v-if="createForm.hinhAnh"
                  type="button"
                  variant="ghost"
                  class="h-11"
                  :disabled="avatarUploading"
                  @click="clearAvatar('create')"
                >
                  Xóa ảnh
                </Button>
              </div>
            </div>
            <p v-if="createAvatarError" class="text-destructive text-sm">{{ createAvatarError }}</p>
          </div>

          <div class="space-y-2">
            <Label for="cf-mk">Mật khẩu (để trống = hệ thống tạo ngẫu nhiên)</Label>
            <div class="relative">
              <Input
                id="cf-mk"
                v-model="createForm.matKhau"
                class="h-11 pr-11 text-base"
                :type="showCreatePassword ? 'text' : 'password'"
                autocomplete="off"
                spellcheck="false"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                class="text-muted-foreground absolute top-0 right-0 z-20 h-11 w-11 shrink-0"
                :aria-pressed="showCreatePassword"
                :aria-label="showCreatePassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                @click.stop.prevent="toggleCreatePassword"
              >
                <Eye v-if="!showCreatePassword" class="pointer-events-none size-5" />
                <EyeOff v-else class="pointer-events-none size-5" />
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button type="button" variant="outline" class="h-11 px-5 text-base" @click="createOpen = false">
            Hủy
          </Button>
          <Button type="button" class="h-11 px-5 text-base" :disabled="saving" @click="saveCreate">Tạo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
