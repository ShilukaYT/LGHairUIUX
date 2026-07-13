<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'
import { logActivity } from '@/utils/activityLogger'
import {
  Plus,
  Pencil,
  Trash2,
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

async function confirmDelete(row: KhachHangRow) {
  const res = await Swal.fire({
    title: 'Xác nhận xóa?',
    text: `Bạn có chắc chắn muốn xóa khách hàng "${row.hoTen || row.maKh}" không?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Xóa ngay',
    cancelButtonText: 'Hủy'
  })

  if (!res.isConfirmed) return

  try {
    await axios.delete(`${BASE}/${encodeURIComponent(row.maKh)}`, { withCredentials: true })
    toast.success('Đã xóa khách hàng thành công.')
    logActivity("Xóa khách hàng", `Đã xóa khách hàng ${row.hoTen || row.maKh}`, "Quản lý khách hàng")
    await fetchList()
  } catch (e: unknown) {
    const msg = axios.isAxiosError(e) ? (e.response?.data as { message?: string })?.message : null
    toast.error(msg || 'Xóa thất bại.')
  }
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
  <v-container fluid class="pa-6 fill-height align-start font-sans select-none" style="min-height: 100vh;">
    <Toaster rich-colors position="top-right" />

    <v-card width="100%" elevation="2" rounded="xl" class="d-flex flex-column w-full">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Khách Hàng</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Quản lý danh sách, tìm kiếm và chỉnh sửa thông tin khách hàng thân thiết</div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <div class="relative w-full sm:w-64">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              id="kw"
              v-model="keyword"
              class="w-full h-10 pl-10 pr-8 rounded-lg border border-slate-300 text-xs font-medium outline-none focus:border-primary bg-white text-slate-800"
              placeholder="Mã KH, họ tên, SĐT, email…"
              @input="onSearchInput"
            />
          </div>

          <div class="d-flex align-center gap-2 text-caption font-weight-bold text-medium-emphasis">
            <span>TRẠNG THÁI:</span>
            <select
              v-model="trangThaiFilter"
              class="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="all">Tất cả</option>
              <option value="1">Hoạt động</option>
              <option value="0">Khóa</option>
            </select>
          </div>

          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold" @click="openCreate">
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm khách hàng
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- Table -->
      <div class="flex-1 overflow-x-auto w-full p-6 pt-2">
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <Table class="w-full text-left text-xs">
            <TableHeader class="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[11px]">
              <TableRow class="hover:bg-transparent">
                <TableHead class="py-3.5 px-4 font-bold text-center w-[120px] dark:text-slate-400">MÃ KH</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-left dark:text-slate-400">HỌ TÊN</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-center dark:text-slate-400">SỐ ĐIỆN THOẠI</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-left dark:text-slate-400">EMAIL</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-center dark:text-slate-400">HẠNG</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-center dark:text-slate-400">ĐIỂM TÍCH LŨY</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-center dark:text-slate-400">TRẠNG THÁI</TableHead>
                <TableHead class="py-3.5 px-4 font-bold text-center dark:text-slate-400">THAO TÁC</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody class="divide-y divide-slate-100 dark:divide-slate-800">
            <TableRow v-if="loading">
              <TableCell colspan="8" class="text-slate-550 dark:text-slate-400 py-14 text-center text-xs font-bold tracking-widest uppercase bg-white dark:bg-[#1e1e2d]">
                Đang tải dữ liệu khách hàng...
              </TableCell>
            </TableRow>
            <TableRow v-else-if="!list.length">
              <TableCell colspan="8" class="text-slate-450 dark:text-slate-500 py-14 text-center text-xs font-semibold bg-white dark:bg-[#1e1e2d]">
                Không có dữ liệu khách hàng.
              </TableCell>
            </TableRow>
            <TableRow 
              v-else 
              v-for="row in list" 
              :key="row.maKh"
              class="hover:bg-[#bfa77a]/5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] transition-all duration-150 group cursor-pointer"
            >
              <!-- Mã KH (Center) -->
              <TableCell class="py-5 px-4 text-center font-mono font-bold text-slate-800 dark:text-slate-200 bg-transparent">{{ row.maKh }}</TableCell>
              
              <!-- Họ tên (Left) -->
              <TableCell class="py-5 px-4 text-left font-semibold text-slate-800 dark:text-slate-200 group-hover:text-[#8c734b] bg-transparent transition-colors">{{ row.hoTen || '—' }}</TableCell>
              
              <!-- SĐT (Center) -->
              <TableCell class="py-5 px-4 text-center text-slate-700 dark:text-slate-350 bg-transparent whitespace-nowrap">{{ row.sdt || '—' }}</TableCell>
              
              <!-- Email (Left) -->
              <TableCell class="py-5 px-4 text-left text-slate-650 dark:text-slate-400 bg-transparent max-w-xs truncate sm:max-w-md">{{ row.email || '—' }}</TableCell>
              
              <!-- Hạng (Center) -->
              <TableCell class="py-5 px-4 text-center bg-transparent">
                <span 
                  v-if="row.tenRank?.toUpperCase().includes('KIM CƯƠNG') || row.maRank?.toUpperCase().includes('KIM CƯƠNG')" 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 border border-cyan-150 dark:border-cyan-900/50"
                >
                  {{ row.tenRank || row.maRank }}
                </span>
                <span 
                  v-else-if="row.tenRank?.toUpperCase().includes('VÀNG') || row.maRank?.toUpperCase().includes('VÀNG') || row.tenRank?.toUpperCase().includes('GOLD')" 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-[#bfa77a]/15 text-[#8c734b] border border-[#bfa77a]/25"
                >
                  {{ row.tenRank || row.maRank }}
                </span>
                <span 
                  v-else-if="row.tenRank?.toUpperCase().includes('BẠC') || row.maRank?.toUpperCase().includes('BẠC') || row.tenRank?.toUpperCase().includes('SILVER')" 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                >
                  {{ row.tenRank || row.maRank }}
                </span>
                <span 
                  v-else 
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-amber-55 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/55"
                >
                  {{ row.tenRank || row.maRank || 'Đồng' }}
                </span>
              </TableCell>
              
              <!-- Điểm (Center) -->
              <TableCell class="py-5 px-4 text-center font-bold font-mono text-slate-700 dark:text-slate-300 bg-transparent text-xs">{{ row.diemTichLuy ?? 0 }}</TableCell>
              
              <!-- Trạng thái (Center) -->
              <TableCell class="py-5 px-4 text-center bg-transparent">
                <span 
                  v-if="row.trangThai === 1"
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/50"
                >
                  Hoạt động
                </span>
                <span 
                  v-else
                  class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[8px] font-extrabold uppercase tracking-widest bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-150 dark:border-rose-900/50"
                >
                  Khóa
                </span>
              </TableCell>
              
              <!-- Thao tác (Center) -->
              <TableCell class="py-3.5 px-4 text-center bg-transparent" @click.stop>
                <div class="flex items-center justify-center gap-1.5">
                  <v-btn
                    color="primary" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                    @click="openEdit(row)"
                  >
                    <template v-slot:prepend><Pencil class="w-3.5 h-3.5 mr-1" /></template>
                    Sửa
                  </v-btn>
                  <v-btn
                    color="error" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold"
                    @click="confirmDelete(row)"
                  >
                    <template v-slot:prepend><Trash2 class="w-3.5 h-3.5 mr-1" /></template>
                    Xóa
                  </v-btn>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>

    <!-- Pagination -->
    <div class="text-slate-500 dark:text-slate-400 flex flex-col items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs font-semibold sm:flex-row bg-slate-50/50 dark:bg-slate-900/30">
      <span>
        Tổng số <strong class="text-slate-800 dark:text-slate-200 font-mono">{{ totalCount }}</strong> khách hàng · Trang {{ page }} / {{ totalPages }}
      </span>
      <div class="flex items-center gap-2">
        <v-btn
          variant="outlined" color="grey-darken-1" size="36" rounded="lg"
          :disabled="page <= 1 || loading"
          @click="page = Math.max(1, page - 1)"
        >
          <ChevronLeft class="w-4 h-4" />
        </v-btn>
        <v-btn
          variant="outlined" color="grey-darken-1" size="36" rounded="lg"
          :disabled="page >= totalPages || loading"
          @click="page = Math.min(totalPages, page + 1)"
        >
          <ChevronRight class="w-4 h-4" />
        </v-btn>
      </div>
    </div>
  </v-card>

    <!-- Sửa khách hàng -->
    <Teleport to="body">
      <div
        v-if="editOpen"
        class="fixed inset-0 z-[2400] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs transition-opacity"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-kh-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-transparent cursor-default"
          aria-label="Đóng"
          @click="editOpen = false"
        />
        <div
          class="relative z-10 flex max-h-[90vh] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-2xl border border-solid border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] shadow-2xl transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="shrink-0 border-b border-solid border-slate-200 dark:border-slate-800 px-8 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 id="edit-kh-title" class="text-lg font-serif text-[#8c734b] tracking-wider uppercase">Sửa thông tin khách hàng</h2>
          </div>

          <!-- Body -->
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6 space-y-5 text-xs">
            <p class="text-slate-500 dark:text-slate-400 text-xs leading-relaxed">
              Hạng thành viên được hệ thống tự cập nhật theo điểm (giống đăng nhập khách).
              <span v-if="editForm.tenRank" class="text-slate-800 dark:text-slate-200 font-bold ml-1">Hiện tại: {{ editForm.tenRank }}</span>
            </p>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
              <div class="space-y-2">
                <Label for="ef-ten" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">HỌ TÊN</Label>
                <Input id="ef-ten" v-model="editForm.hoTen" class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all" />
              </div>
              <div class="space-y-2">
                <Label for="ef-sdt" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">SỐ ĐIỆN THOẠI</Label>
                <Input
                  id="ef-sdt"
                  v-model="editForm.sdt"
                  class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all"
                  placeholder="VD: 09xxxxxxxx"
                  inputmode="tel"
                  autocomplete="tel"
                />
              </div>
              <div class="space-y-2">
                <Label for="ef-email" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">EMAIL *</Label>
                <Input
                  id="ef-email"
                  v-model="editForm.email"
                  class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all"
                  type="email"
                  autocomplete="email"
                  placeholder="vidu@email.com"
                />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">GIỚI TÍNH</Label>
                <Select
                  :model-value="editForm.gioiTinh.trim() ? editForm.gioiTinh.trim() : GIOI_TINH_NONE"
                  @update:model-value="
                    (v: unknown) => {
                      editForm.gioiTinh = v === GIOI_TINH_NONE ? '' : String(v)
                    }
                  "
                >
                  <SelectTrigger class="h-11 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:ring-0 shadow-none transition-all">
                     <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent class="!z-[3000] rounded-xl border border-solid border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] shadow-lg">
                    <SelectItem :value="GIOI_TINH_NONE">Chưa chọn</SelectItem>
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="space-y-2">
                <Label for="ef-diem" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">ĐIỂM TÍCH LŨY</Label>
                <Input id="ef-diem" v-model="editForm.diemTichLuy" class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all" type="number" min="0" />
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">TRẠNG THÁI</Label>
                <Select v-model="editForm.trangThai">
                  <SelectTrigger class="h-11 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:ring-0 shadow-none transition-all">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent class="!z-[3000] rounded-xl border border-solid border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] shadow-lg">
                    <SelectItem value="1">Hoạt động</SelectItem>
                    <SelectItem value="0">Khóa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="border-border dark:border-slate-800 space-y-3 border-t pt-4">
              <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">ẢNH ĐẠI DIỆN</Label>
              <p class="text-slate-450 dark:text-slate-500 text-[10px]">Chọn file JPG, PNG hoặc WEBP (tối đa 5MB). Không cần dán URL.</p>
              <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div class="bg-slate-50 dark:bg-slate-850 border-slate-300 dark:border-slate-700 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                  <img v-if="mediaUrl(editForm.hinhAnh)" :src="mediaUrl(editForm.hinhAnh)" alt="" class="size-full object-cover" />
                  <span v-else class="text-slate-400 dark:text-slate-500 px-2 text-center text-[10px] font-semibold uppercase">Chưa có ảnh</span>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <input ref="editAvatarFileRef" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden" @change="onPickAvatar($event, 'edit')" />
                  <Button type="button" variant="outline" class="h-11 gap-2 rounded-xl text-xs font-bold border-slate-300 dark:border-slate-700 hover:border-[#bfa77a] hover:bg-[#bfa77a]/10 hover:text-[#8c734b]" :disabled="avatarUploading" @click="editAvatarFileRef?.click()">
                    <Upload class="size-4" />
                    {{ avatarUploading ? 'Đang tải…' : 'Chọn ảnh' }}
                  </Button>
                  <Button v-if="editForm.hinhAnh" type="button" variant="ghost" class="h-11 rounded-xl text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600" :disabled="avatarUploading" @click="clearAvatar('edit')">
                    Xóa ảnh
                  </Button>
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <Label for="ef-mk" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">MẬT KHẨU ĐĂNG NHẬP</Label>
              <p class="text-slate-450 dark:text-slate-500 text-[10px] leading-relaxed">
                Hiển thị mật khẩu hiện tại. Sửa nội dung để đổi mật khẩu; xóa trắng ô rồi lưu = giữ nguyên mật khẩu cũ.
              </p>
              <div class="relative">
                <Input
                  id="ef-mk"
                  v-model="editForm.matKhauMoi"
                  class="h-11 pr-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all font-mono"
                  :type="showEditPassword ? 'text' : 'password'"
                  autocomplete="off"
                  spellcheck="false"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="text-slate-400 absolute top-0 right-0 z-20 h-11 w-11 shrink-0 rounded-xl hover:bg-transparent"
                  :aria-pressed="showEditPassword"
                  :aria-label="showEditPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                  @click.stop.prevent="toggleEditPassword"
                >
                  <Eye v-if="!showEditPassword" class="pointer-events-none size-4" />
                  <EyeOff v-else class="pointer-events-none size-4" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-solid border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-8 py-4">
            <Button type="button" variant="outline" class="h-11 px-5 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" @click="editOpen = false">
              Hủy
            </Button>
            <Button
              type="button"
              class="h-11 px-5 !bg-[#9d804e] !text-white hover:!bg-[#866a3d] border !border-[#9d804e] text-xs font-bold rounded-xl shadow-none cursor-pointer tracking-wider"
              :disabled="saving"
              @click="saveEdit"
            >
              Lưu
            </Button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Thêm khách hàng -->
    <Teleport to="body">
      <div
        v-if="createOpen"
        class="fixed inset-0 z-[2400] flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs transition-opacity"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-kh-title"
      >
        <button
          type="button"
          class="absolute inset-0 bg-transparent cursor-default"
          aria-label="Đóng"
          @click="createOpen = false"
        />
        <div
          class="relative z-10 flex max-h-[90vh] w-full max-w-3xl min-h-0 flex-col overflow-hidden rounded-2xl border border-solid border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] shadow-2xl transition-all"
          @click.stop
        >
          <!-- Header -->
          <div class="shrink-0 border-b border-solid border-slate-200 dark:border-slate-800 px-8 pt-6 pb-4 bg-slate-50/50 dark:bg-slate-800/40">
            <h2 id="create-kh-title" class="text-lg font-serif text-[#8c734b] tracking-wider uppercase">Thêm khách hàng mới</h2>
          </div>

          <!-- Body -->
          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-8 py-6 space-y-5 text-xs">
            <div class="space-y-2">
              <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">LOẠI KHÁCH</Label>
              <Select :model-value="createLoaiKhach" @update:model-value="onCreateLoaiChange">
                <SelectTrigger class="h-11 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:ring-0 shadow-none transition-all">
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent class="!z-[3000] rounded-xl border border-solid border-slate-300 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] shadow-lg">
                  <SelectItem value="vang_lai">Khách vãng lai (mặc định)</SelectItem>
                  <SelectItem value="ten_cu_the">Khách có tên cụ thể</SelectItem>
                </SelectContent>
              </Select>
              <p class="text-slate-450 dark:text-slate-500 text-[10px]">
                {{
                  createLoaiKhach === 'vang_lai'
                    ? 'Họ tên đặt sẵn "Khách vãng lai" — có thể sửa nếu cần. Email bắt buộc.'
                    : 'Nhập họ tên, số điện thoại và email đầy đủ.'
                }}
              </p>
            </div>

            <div class="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6">
              <div class="space-y-2">
                <Label for="cf-ten" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">HỌ TÊN *</Label>
                <Input id="cf-ten" v-model="createForm.hoTen" class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all" />
              </div>
              <div class="space-y-2">
                <Label for="cf-sdt" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">SỐ ĐIỆN THOẠI *</Label>
                <Input
                  id="cf-sdt"
                  v-model="createForm.sdt"
                  class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all"
                  :class="createSdtError ? 'border-destructive' : ''"
                  placeholder="VD: 09xxxxxxxx hoặc +84…"
                  inputmode="tel"
                  autocomplete="tel"
                  :aria-invalid="!!createSdtError"
                  @input="createSdtError = ''"
                />
                <p v-if="createSdtError" class="text-rose-500 text-[10px] mt-1 font-bold">{{ createSdtError }}</p>
              </div>
              <div class="space-y-2">
                <Label for="cf-email" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">EMAIL *</Label>
                <Input
                  id="cf-email"
                  v-model="createForm.email"
                  class="h-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all"
                  :class="createEmailError ? 'border-destructive' : ''"
                  type="email"
                  autocomplete="email"
                  placeholder="vidu@email.com"
                  :aria-invalid="!!createEmailError"
                  @input="createEmailError = ''"
                />
                <p v-if="createEmailError" class="text-rose-500 text-[10px] mt-1 font-bold">{{ createEmailError }}</p>
              </div>
              <div class="space-y-2">
                <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">GIỚI TÍNH *</Label>
                <Select
                  :model-value="createForm.gioiTinh.trim() ? createForm.gioiTinh.trim() : GIOI_TINH_NONE"
                  @update:model-value="onCreateGioiTinhSelect"
                >
                  <SelectTrigger
                    class="h-11 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-850/50 rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:ring-0 shadow-none transition-all"
                    :class="createGioiTinhError ? 'border-destructive' : ''"
                    :aria-invalid="!!createGioiTinhError"
                  >
                    <SelectValue placeholder="Chọn giới tính" />
                  </SelectTrigger>
                  <SelectContent class="!z-[3000] rounded-xl border border-solid border-slate-300 dark:border-slate-850 bg-white dark:bg-[#1e1e2d] shadow-lg">
                    <SelectItem :value="GIOI_TINH_NONE">Chưa chọn</SelectItem>
                    <SelectItem value="Nam">Nam</SelectItem>
                    <SelectItem value="Nữ">Nữ</SelectItem>
                    <SelectItem value="Khác">Khác</SelectItem>
                  </SelectContent>
                </Select>
                <p v-if="createGioiTinhError" class="text-rose-500 text-[10px] mt-1 font-bold">{{ createGioiTinhError }}</p>
              </div>
            </div>

            <div class="border-border dark:border-slate-800 space-y-3 border-t pt-4">
              <Label class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">ẢNH ĐẠI DIỆN *</Label>
              <p class="text-slate-450 dark:text-slate-500 text-[10px]">Bắt buộc — JPG, PNG, WEBP — tối đa 5MB.</p>
              <div
                class="flex flex-col gap-4 sm:flex-row sm:items-center"
                :class="createAvatarError ? 'border border-rose-200 p-2 bg-rose-50/20 dark:bg-rose-950/20 rounded-xl' : ''"
              >
                <div class="bg-slate-50 dark:bg-slate-850 border-slate-300 dark:border-slate-700 flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                  <img v-if="mediaUrl(createForm.hinhAnh)" :src="mediaUrl(createForm.hinhAnh)" alt="" class="size-full object-cover" />
                  <span v-else class="text-slate-400 dark:text-slate-500 px-2 text-center text-[10px] font-semibold uppercase">Chưa chọn</span>
                </div>
                <div class="flex flex-wrap gap-2">
                  <input ref="createAvatarFileRef" type="file" accept="image/jpeg,image/jpg,image/png,image/webp" class="hidden" @change="onPickAvatar($event, 'create')" />
                  <Button type="button" variant="outline" class="h-11 gap-2 rounded-xl text-xs font-bold border-slate-300 dark:border-slate-700 hover:border-[#bfa77a] hover:bg-[#bfa77a]/10 hover:text-[#8c734b]" :disabled="avatarUploading" @click="createAvatarFileRef?.click()">
                    <Upload class="size-4" />
                    {{ avatarUploading ? 'Đang tải…' : 'Chọn ảnh' }}
                  </Button>
                  <Button v-if="createForm.hinhAnh" type="button" variant="ghost" class="h-11 rounded-xl text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 hover:text-rose-600" :disabled="avatarUploading" @click="clearAvatar('create')">
                    Xóa ảnh
                  </Button>
                </div>
              </div>
              <p v-if="createAvatarError" class="text-rose-500 text-[10px] mt-1 font-bold">{{ createAvatarError }}</p>
            </div>

            <div class="space-y-2">
              <Label for="cf-mk" class="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider">MẬT KHẨU (ĐỂ TRỐNG = HỆ THỐNG TẠO NGẪU NHIÊN)</Label>
              <div class="relative">
                <Input
                  id="cf-mk"
                  v-model="createForm.matKhau"
                  class="h-11 pr-11 text-xs rounded-xl border border-solid border-slate-300 dark:border-slate-700 outline-none focus:border-[#8c734b] bg-slate-50/50 dark:bg-slate-850/50 focus:bg-white dark:focus:bg-slate-900 text-slate-800 dark:text-slate-200 shadow-none transition-all font-mono"
                  :type="showCreatePassword ? 'text' : 'password'"
                  autocomplete="off"
                  spellcheck="false"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  class="text-slate-400 absolute top-0 right-0 z-20 h-11 w-11 shrink-0 rounded-xl hover:bg-transparent"
                  :aria-pressed="showCreatePassword"
                  :aria-label="showCreatePassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                  @click.stop.prevent="toggleCreatePassword"
                >
                  <Eye v-if="!showCreatePassword" class="pointer-events-none size-4" />
                  <EyeOff v-else class="pointer-events-none size-4" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-solid border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-8 py-4">
            <Button type="button" variant="outline" class="h-11 px-5 text-xs font-bold rounded-xl border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800" @click="createOpen = false">
              Hủy
            </Button>
            <Button
              type="button"
              class="h-11 px-5 !bg-[#9d804e] !text-white hover:!bg-[#866a3d] border !border-[#9d804e] text-xs font-bold rounded-xl shadow-none cursor-pointer tracking-wider"
              :disabled="saving"
              @click="saveCreate"
            >
              Tạo
            </Button>
          </div>
        </div>
      </div>
    </Teleport>
  </v-container>
</template>
