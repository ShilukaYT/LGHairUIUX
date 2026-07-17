<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useTheme } from 'vuetify'
import {
  Search, Plus, Edit3, Trash2, X, Clock, Check,
  Zap, TrendingDown, Calendar, Package, RotateCcw,
  Percent, ChevronDown, AlertCircle, Sparkles, Tag
} from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import Swal from 'sweetalert2'
import axios from 'axios'

// ── THEME SYNC ──
const theme = useTheme()
watch(
  () => theme.global.name.value,
  (val) => {
    if (val === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  },
  { immediate: true }
)

// ── CONFIG ──
const baseUrl = import.meta.env.VITE_API_URL
const API_URL = `${baseUrl}/api/Sale`
const API_DICH_VU = 'https://localhost:7196/api/DanhSachDichVu'
const API_COMBO = 'https://localhost:7196/api/Combo'

// ── STATE ──
const dataList = ref<any[]>([])
const danhSachDichVuMau = ref<any[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const searchService = ref<Record<number, string>>({})
const showServiceDropdown = ref<Record<number, boolean>>({})

const currentItem = ref<any>({
  maFL: '',
  ngayBatDau: '',
  ngayKetThuc: '',
  trangThai: 1,
  chiTietFlashSales: []
})

// ── FETCH DATA ──
const fetchData = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(API_URL)
    dataList.value = res.data.data || res.data
  } catch (error: any) {
    console.error("Lỗi fetch:", error)
    Swal.fire({ icon: 'error', title: 'Lỗi', text: error.response?.data?.message || 'Lỗi khi lấy dữ liệu!', timer: 2500 })
  } finally {
    isLoading.value = false
  }
}

const fetchServiceCombo = async () => {
  try {
    const [resDichVu, resCombo] = await Promise.all([
      axios.get(API_DICH_VU).catch(() => ({ data: [] })),
      axios.get(API_COMBO).catch(() => ({ data: [] }))
    ])

    let dataDv = resDichVu.data
    let rawDichVu = Array.isArray(dataDv) ? dataDv : (dataDv?.services || dataDv?.data || [])
    const listDv = rawDichVu.map((x: any) => ({
      loai: x.maDmNavigation?.tenDanhMuc || x.MaDmNavigation?.TenDanhMuc || 'Dịch vụ',
      ma: x.maDv || x.MaDv || x.maDV || x.MaDV || x.id || x.Id,
      ten: x.tenDv || x.TenDv || x.tenDV || x.TenDV || x.ten || x.Ten || '',
      gia: x.gia || x.Gia || 0
    }))

    let dataCb = resCombo.data
    let rawCombo = Array.isArray(dataCb) ? dataCb : (dataCb?.combos || dataCb?.data || [])
    const listCb = rawCombo.map((x: any) => ({
      loai: 'Combo',
      ma: x.maCb || x.MaCb || x.maCB || x.MaCB || x.id || x.Id,
      ten: x.tenCombo || x.TenCombo || x.tenCb || x.TenCb || x.tenCB || x.TenCB || '',
      gia: x.gia || x.Gia || 0
    }))

    danhSachDichVuMau.value = [...listDv, ...listCb]
  } catch (error: any) {
    console.error("Lỗi fetch tổng:", error)
  }
}

onMounted(() => {
  fetchData()
  fetchServiceCombo()
  // full width layout
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) wrapper.classList.add('full-width-layout')
})

onUnmounted(() => {
  const wrapper = document.querySelector('.page-wrapper')
  if (wrapper) wrapper.classList.remove('full-width-layout')
})

// ── COMPUTED ──
const filteredData = computed(() => {
  if (!searchQuery.value) return dataList.value
  const q = searchQuery.value.toLowerCase()
  return dataList.value.filter((item: any) => item.maFL?.toLowerCase().includes(q))
})

const statTotal = computed(() => dataList.value.length)
const statActive = computed(() => dataList.value.filter((x: any) => x.trangThai === 1).length)
const statUpcoming = computed(() => dataList.value.filter((x: any) => x.trangThai === 0).length)
const statEnded = computed(() => dataList.value.filter((x: any) => x.trangThai === 2).length)

// ── HELPERS ──
const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

const formatDateForInput = (dateString: string) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const formatVND = (n: number) => {
  if (!n && n !== 0) return '—'
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)
}

const getStatusInfo = (status: number) => {
  switch (status) {
    case 1: return { label: 'Đang diễn ra', bg: 'bg-emerald-50 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-700/50', dot: 'bg-emerald-500' }
    case 0: return { label: 'Sắp diễn ra', bg: 'bg-amber-50 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-700/50', dot: 'bg-amber-500' }
    case 2: return { label: 'Đã kết thúc', bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-500 dark:text-slate-400', border: 'border-slate-200 dark:border-slate-600', dot: 'bg-slate-400' }
    default: return { label: 'Không rõ', bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200', dot: 'bg-slate-400' }
  }
}

// ── ACTIONS ──
const openCreateDialog = () => {
  dialogMode.value = 'create'
  currentItem.value = { maFL: '', ngayBatDau: '', ngayKetThuc: '', trangThai: 1, chiTietFlashSales: [] }
  searchService.value = {}
  showServiceDropdown.value = {}
  showFormModal.value = true
}

const openEditDialog = (item: any) => {
  dialogMode.value = 'edit'
  const clone = JSON.parse(JSON.stringify(item))
  clone.ngayBatDau = formatDateForInput(clone.ngayBatDau)
  clone.ngayKetThuc = formatDateForInput(clone.ngayKetThuc)
  clone.chiTietFlashSales.forEach((ct: any) => {
    ct.maDV = ct.maDV || ct.maDv || ct.MaDv || ct.MaDV || ""
    ct.maCB = ct.maCB || ct.maCb || ct.MaCb || ct.MaCB || ""
    const matchedId = ct.maDV || ct.maCB
    const foundItem = danhSachDichVuMau.value.find((x: any) => x.ma === matchedId)
    ct.gia = ct.gia || foundItem?.gia || 0
  })
  currentItem.value = clone
  searchService.value = {}
  showServiceDropdown.value = {}
  showFormModal.value = true
}

const openDeleteConfirm = (item: any) => {
  currentItem.value = JSON.parse(JSON.stringify(item))
  showDeleteModal.value = true
}

const saveForm = async () => {
  if (isSubmitting.value) return
  try {
    isSubmitting.value = true
    if (!currentItem.value.ngayBatDau || !currentItem.value.ngayKetThuc) {
      Swal.fire({ icon: 'warning', title: 'Thiếu thông tin', text: 'Vui lòng chọn Ngày bắt đầu và Ngày kết thúc!', timer: 2500 })
      return
    }
    if (new Date(currentItem.value.ngayBatDau) >= new Date(currentItem.value.ngayKetThuc)) {
      Swal.fire({ icon: 'warning', title: 'Lỗi ngày', text: 'Ngày kết thúc phải lớn hơn ngày bắt đầu!', timer: 2500 })
      return
    }
    if (!currentItem.value.chiTietFlashSales || currentItem.value.chiTietFlashSales.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Thiếu dịch vụ', text: 'Phải có ít nhất 1 dịch vụ hoặc combo để sale!', timer: 2500 })
      return
    }
    for (const [index, x] of currentItem.value.chiTietFlashSales.entries()) {
      if (!x.maDV && !x.maCB) {
        Swal.fire({ icon: 'warning', title: 'Lỗi dịch vụ', text: `Dòng số ${index + 1}: Chưa chọn Dịch vụ/Combo. Vui lòng chọn hoặc xóa dòng này!`, timer: 3000 })
        return
      }
      if (x.phanTramGiam <= 0 || x.phanTramGiam > 100) {
        Swal.fire({ icon: 'warning', title: 'Mức giảm không hợp lệ', text: `Dòng số ${index + 1}: Mức giảm giá phải từ 1% đến 100%!`, timer: 3000 })
        return
      }
    }

    const payload = {
      ngayBatDau: currentItem.value.ngayBatDau,
      ngayKetThuc: currentItem.value.ngayKetThuc,
      trangThai: Number(currentItem.value.trangThai),
      chiTietFlashSales: currentItem.value.chiTietFlashSales.map((x: any) => ({
        maDV: x.maDV || "",
        maCB: x.maCB || "",
        phanTramGiam: Number(x.phanTramGiam)
      }))
    }

    let res
    if (dialogMode.value === 'edit') {
      res = await axios.put(`${API_URL}/${currentItem.value.maFL}`, payload)
      logActivity("Cập nhật khuyến mãi", `Đã cập nhật chiến dịch khuyến mãi ${currentItem.value.maFL}`, "Khuyến mãi")
    } else {
      res = await axios.post(API_URL, payload)
      const maFlNew = res.data?.data?.maFL || res.data?.maFL || currentItem.value.maFL || "mới"
      logActivity("Thêm khuyến mãi", `Đã tạo chiến dịch khuyến mãi mới (Mã: ${maFlNew})`, "Khuyến mãi")
    }

    Swal.fire({ icon: 'success', title: 'Thành công', text: res.data?.message || 'Lưu thành công!', timer: 2000, showConfirmButton: false })
    showFormModal.value = false
    fetchData()
  } catch (error: any) {
    console.error("Lỗi save:", error)
    const errorMsg = error.response?.data?.message || error.response?.data || 'Lưu thất bại!'
    logActivity(
      dialogMode.value === 'edit' ? "Cập nhật khuyến mãi" : "Thêm khuyến mãi",
      `Thất bại: ${errorMsg}`, "Khuyến mãi", "Thất bại"
    )
    Swal.fire({ icon: 'error', title: 'Thất bại', text: typeof errorMsg === 'string' ? errorMsg : 'Lỗi hệ thống', timer: 3000 })
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  try {
    const res = await axios.delete(`${API_URL}/${currentItem.value.maFL}`)
    logActivity("Xóa khuyến mãi", `Đã xóa chiến dịch khuyến mãi ${currentItem.value.maFL}`, "Khuyến mãi")
    Swal.fire({ icon: 'success', title: 'Đã xóa', text: res.data?.message || 'Đã xóa Flash Sale!', timer: 2000, showConfirmButton: false })
    showDeleteModal.value = false
    fetchData()
  } catch (error: any) {
    console.error("Lỗi delete:", error)
    logActivity("Xóa khuyến mãi", `Thất bại khi xóa ${currentItem.value.maFL}`, "Khuyến mãi", "Thất bại")
    Swal.fire({ icon: 'error', title: 'Thất bại', text: error.response?.data?.message || 'Xóa thất bại!', timer: 3000 })
  }
}

// ── DETAIL TABLE ACTIONS ──
const themDichVuVaoList = () => {
  currentItem.value.chiTietFlashSales.push({
    maDV: "", maCB: "", tenDv: "", tenCb: "", gia: 0, giaSauGiam: 0, phanTramGiam: 0
  })
}

const xoaDichVu = (index: number) => {
  currentItem.value.chiTietFlashSales.splice(index, 1)
  delete searchService.value[index]
  delete showServiceDropdown.value[index]
}

const onChonDichVu = (index: number, maItemDuocChon: string) => {
  const itemMau = danhSachDichVuMau.value.find((x: any) => x.ma === maItemDuocChon)
  if (itemMau) {
    const row = currentItem.value.chiTietFlashSales[index]
    if (itemMau.loai === 'Combo') {
      row.maCB = itemMau.ma; row.tenCb = itemMau.ten; row.maDV = ""; row.tenDv = ""
    } else {
      row.maDV = itemMau.ma; row.tenDv = itemMau.ten; row.maCB = ""; row.tenCb = ""
    }
    row.gia = itemMau.gia
    row.giaSauGiam = itemMau.gia
    row.phanTramGiam = 0
  }
  showServiceDropdown.value[index] = false
  searchService.value[index] = ''
}

const tinhGiaSauGiam = (index: number) => {
  const row = currentItem.value.chiTietFlashSales[index]
  if (row.gia > 0 && row.phanTramGiam >= 0) {
    row.giaSauGiam = row.gia - (row.gia * row.phanTramGiam / 100)
  }
}

const tinhPhanTram = (index: number) => {
  const row = currentItem.value.chiTietFlashSales[index]
  if (row.gia > 0 && row.giaSauGiam >= 0) {
    row.phanTramGiam = Math.round(((row.gia - row.giaSauGiam) / row.gia) * 100)
  }
}

const getAvailableServices = (currentIndex: number) => {
  const selectedIds = currentItem.value.chiTietFlashSales
    .filter((_: any, idx: number) => idx !== currentIndex)
    .map((x: any) => x.maDV || x.maCB)
    .filter((id: string) => id)
  const available = danhSachDichVuMau.value.filter((sv: any) => !selectedIds.includes(sv.ma))
  const q = (searchService.value[currentIndex] || '').toLowerCase()
  if (!q) return available
  return available.filter((sv: any) => sv.ten.toLowerCase().includes(q) || sv.loai.toLowerCase().includes(q))
}

const getSelectedName = (detail: any) => {
  return detail.tenCb || detail.tenDv || ''
}

// Close dropdowns on click outside
const handleClickOutside = () => {
  Object.keys(showServiceDropdown.value).forEach(k => {
    showServiceDropdown.value[Number(k)] = false
  })
}
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start font-sans select-none" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl"
      class="d-flex flex-column w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors">

      <!-- ═══════ HEADER ═══════ -->
      <div
        class="d-flex flex-column flex-lg-row align-lg-center justify-space-between pa-6 px-6 py-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1 text-slate-900 dark:text-white flex items-center gap-2">
            <Zap class="w-6 h-6 text-rose-500 dark:text-rose-400 shrink-0" />
            <span>Quản Lý Flash Sale & Khuyến Mãi</span>
          </h2>
          <div class="text-subtitle-2 text-medium-emphasis dark:text-slate-400">
            Tạo và quản lý các chiến dịch giảm giá cho dịch vụ & combo trong hệ thống
          </div>
        </div>

        <div class="d-flex align-center gap-3 flex-wrap">
          <div class="relative w-full sm:w-72 md:w-80">
            <Search
              class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input v-model="searchQuery" type="text" placeholder="Tìm kiếm mã Flash Sale..."
              class="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-400 shadow-sm transition-all" />
          </div>

          <v-btn variant="outlined" color="grey-darken-1" size="44" rounded="xl" :loading="isLoading"
            @click="fetchData" title="Tải lại">
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <v-btn color="error" variant="flat" rounded="xl" height="44"
            class="text-none font-weight-bold whitespace-nowrap px-5" @click="openCreateDialog">
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Tạo Flash Sale
          </v-btn>
        </div>
      </div>

      <!-- ═══════ STATS CARDS ═══════ -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pa-6 px-6 py-5 pb-2">
        <!-- Card 1: Tổng -->
        <div
          class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div
            class="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-50 dark:bg-rose-900/20 rounded-full group-hover:scale-110 transition-transform">
          </div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Tổng
              Chiến Dịch</p>
            <h3 class="text-3xl font-extrabold text-slate-800 dark:text-white">{{ statTotal }}</h3>
            <p class="text-xs text-rose-600 dark:text-rose-400 font-medium mt-2 flex items-center gap-1">
              <Tag class="w-3.5 h-3.5 shrink-0" /> <span>Tất cả Flash Sale</span>
            </p>
          </div>
          <div
            class="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30">
            <Zap class="w-6 h-6 text-white" />
          </div>
        </div>

        <!-- Card 2: Đang diễn ra -->
        <div
          class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div
            class="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full group-hover:scale-110 transition-transform">
          </div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Đang Diễn
              Ra</p>
            <h3 class="text-3xl font-extrabold text-slate-800 dark:text-white">{{ statActive }}</h3>
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <Check class="w-3.5 h-3.5 shrink-0" /> <span>Đang hoạt động</span>
            </p>
          </div>
          <div
            class="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30">
            <Sparkles class="w-6 h-6 text-white" />
          </div>
        </div>

        <!-- Card 3: Sắp diễn ra -->
        <div
          class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div
            class="absolute -right-6 -bottom-6 w-24 h-24 bg-amber-50 dark:bg-amber-900/20 rounded-full group-hover:scale-110 transition-transform">
          </div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Sắp Diễn
              Ra</p>
            <h3 class="text-3xl font-extrabold text-slate-800 dark:text-white">{{ statUpcoming }}</h3>
            <p class="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2 flex items-center gap-1">
              <Clock class="w-3.5 h-3.5 shrink-0" /> <span>Chờ kích hoạt</span>
            </p>
          </div>
          <div
            class="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
            <Calendar class="w-6 h-6 text-white" />
          </div>
        </div>

        <!-- Card 4: Đã kết thúc -->
        <div
          class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div
            class="absolute -right-6 -bottom-6 w-24 h-24 bg-slate-100 dark:bg-slate-700/30 rounded-full group-hover:scale-110 transition-transform">
          </div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Đã Kết
              Thúc</p>
            <h3 class="text-3xl font-extrabold text-slate-800 dark:text-white">{{ statEnded }}</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-medium mt-2 flex items-center gap-1">
              <X class="w-3.5 h-3.5 shrink-0" /> <span>Đã hoàn thành</span>
            </p>
          </div>
          <div
            class="relative z-10 w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30">
            <TrendingDown class="w-6 h-6 text-white" />
          </div>
        </div>
      </div>

      <!-- ═══════ DATA TABLE ═══════ -->
      <div class="pa-6 px-6 py-4">
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <th class="py-4 px-6 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mã Sale</th>
                <th class="py-4 px-6 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày bắt đầu</th>
                <th class="py-4 px-6 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ngày kết thúc</th>
                <th class="py-4 px-6 text-center text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tổng DV</th>
                <th class="py-4 px-6 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Trạng thái</th>
                <th class="py-4 px-6 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              <!-- Loading -->
              <tr v-if="isLoading">
                <td colspan="6" class="py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div class="w-8 h-8 border-3 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                    <span class="text-sm text-slate-400 dark:text-slate-500">Đang tải dữ liệu...</span>
                  </div>
                </td>
              </tr>

              <!-- Empty -->
              <tr v-else-if="filteredData.length === 0">
                <td colspan="6" class="py-16 text-center">
                  <div class="flex flex-col items-center gap-3">
                    <div
                      class="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                      <Zap class="w-7 h-7 text-slate-300 dark:text-slate-600" />
                    </div>
                    <span class="text-sm text-slate-400 dark:text-slate-500 font-medium">Không tìm thấy chiến dịch
                      nào</span>
                  </div>
                </td>
              </tr>

              <!-- Data rows -->
              <tr v-else v-for="item in filteredData" :key="item.maFL"
                class="border-b border-slate-100 dark:border-slate-800 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-colors group">
                <td class="py-4 px-6">
                  <span
                    class="font-bold text-slate-800 dark:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg text-xs tracking-wide">
                    {{ item.maFL }}
                  </span>
                </td>
                <td class="py-4 px-6">
                  <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span class="text-sm font-medium">{{ formatDate(item.ngayBatDau) }}</span>
                  </div>
                </td>
                <td class="py-4 px-6">
                  <div class="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Calendar class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span class="text-sm font-medium">{{ formatDate(item.ngayKetThuc) }}</span>
                  </div>
                </td>
                <td class="py-4 px-6 text-center">
                  <span
                    class="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 font-extrabold text-sm border border-rose-100 dark:border-rose-800/50">
                    {{ item.tongDichVu || item.chiTietFlashSales?.length || 0 }}
                  </span>
                </td>
                <td class="py-4 px-6">
                  <span :class="[
                    'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border',
                    getStatusInfo(item.trangThai).bg,
                    getStatusInfo(item.trangThai).text,
                    getStatusInfo(item.trangThai).border
                  ]">
                    <span :class="['w-2 h-2 rounded-full', getStatusInfo(item.trangThai).dot]"></span>
                    {{ getStatusInfo(item.trangThai).label }}
                  </span>
                </td>
                <td class="py-4 px-6 text-right">
                  <div class="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button @click="openEditDialog(item)"
                      class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-600 dark:hover:text-amber-400 transition-all cursor-pointer"
                      title="Chỉnh sửa">
                      <Edit3 class="w-4 h-4" />
                    </button>
                    <button @click="openDeleteConfirm(item)"
                      class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                      title="Xóa">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Table footer -->
        <div class="flex items-center justify-between mt-4 px-2">
          <p class="text-xs font-semibold text-slate-400 dark:text-slate-500">
            Hiển thị {{ filteredData.length }} / {{ dataList.length }} chiến dịch
          </p>
        </div>
      </div>
    </v-card>

    <!-- ═══════════════════════════════════════════════════════
         MODAL: TẠO / CHỈNH SỬA FLASH SALE
    ═══════════════════════════════════════════════════════ -->
    <teleport to="body">
      <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
        enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showFormModal" class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          @click.self="showFormModal = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div @click.stop
            class="relative w-full max-w-[1000px] max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">

            <!-- Modal Header -->
            <div class="px-8 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                  :class="dialogMode === 'create' ? 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-200/50 dark:shadow-rose-900/30' : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200/50 dark:shadow-amber-900/30'">
                  <Plus v-if="dialogMode === 'create'" class="w-5 h-5 text-white" />
                  <Edit3 v-else class="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 class="text-lg font-bold text-slate-900 dark:text-white">
                    {{ dialogMode === 'create' ? 'Tạo Flash Sale mới' : 'Cập nhật Flash Sale' }}
                  </h3>
                  <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    Cấu hình chiến dịch giảm giá cho dịch vụ và combo
                  </p>
                </div>
              </div>
              <button @click="showFormModal = false"
                class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-white transition-all cursor-pointer">
                <X class="w-5 h-5" />
              </button>
            </div>

            <!-- Modal Body (scrollable) -->
            <div class="flex-1 overflow-y-auto px-8 py-6 space-y-6 custom-scroll">

              <!-- Trạng thái (only edit) -->
              <div v-if="dialogMode === 'edit'"
                class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-5 border border-slate-100 dark:border-slate-700/60">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 block">Trạng
                  thái chiến dịch</label>
                <div class="flex gap-3 flex-wrap">
                  <button v-for="s in [{ v: 0, l: 'Sắp diễn ra', c: 'amber' }, { v: 1, l: 'Đang hoạt động', c: 'emerald' }, { v: 2, l: 'Đã ngưng', c: 'slate' }]"
                    :key="s.v" @click="currentItem.trangThai = s.v" :class="[
                      'px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all cursor-pointer',
                      currentItem.trangThai === s.v
                        ? s.c === 'amber' ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-600'
                          : s.c === 'emerald' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-600'
                            : 'bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                        : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    ]">
                    {{ s.l }}
                  </button>
                </div>
              </div>

              <!-- Thời gian -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                    <Calendar class="w-3.5 h-3.5 inline mr-1" />Thời gian bắt đầu
                  </label>
                  <input type="datetime-local" v-model="currentItem.ngayBatDau"
                    class="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-400 transition-all" />
                </div>
                <div>
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 block">
                    <Calendar class="w-3.5 h-3.5 inline mr-1" />Thời gian kết thúc
                  </label>
                  <input type="datetime-local" v-model="currentItem.ngayKetThuc"
                    class="w-full h-12 px-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-400 transition-all" />
                </div>
              </div>

              <!-- Chi tiết dịch vụ -->
              <div class="border-t border-slate-100 dark:border-slate-800 pt-6">
                <div class="flex items-center justify-between mb-4">
                  <div>
                    <h4 class="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                      <Package class="w-4 h-4 text-rose-500" />
                      Chi tiết dịch vụ / combo áp dụng
                    </h4>
                    <p class="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                      {{ currentItem.chiTietFlashSales?.length || 0 }} dịch vụ/combo đã thêm
                    </p>
                  </div>
                  <button @click="themDichVuVaoList"
                    class="inline-flex items-center gap-1.5 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-md shadow-rose-200/50 dark:shadow-rose-900/30 cursor-pointer">
                    <Plus class="w-3.5 h-3.5" /> Thêm dịch vụ
                  </button>
                </div>

                <div class="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <table class="w-full text-sm">
                    <thead>
                      <tr class="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                        <th class="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[35%]">Dịch vụ / Combo</th>
                        <th class="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[18%]">Giá gốc</th>
                        <th class="py-3 px-4 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[18%]">Giá sau giảm</th>
                        <th class="py-3 px-4 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[14%]">% Giảm</th>
                        <th class="py-3 px-4 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 w-[15%]"></th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(detail, index) in currentItem.chiTietFlashSales" :key="index"
                        class="border-b border-slate-100 dark:border-slate-800 last:border-b-0 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <!-- Service/Combo Selector -->
                        <td class="py-3 px-4">
                          <div class="relative">
                            <button @click.stop="showServiceDropdown[Number(index)] = !showServiceDropdown[Number(index)]"
                              class="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-left flex items-center justify-between cursor-pointer hover:border-rose-400 dark:hover:border-rose-500 transition-all"
                              :class="getSelectedName(detail) ? 'text-slate-800 dark:text-white font-medium' : 'text-slate-400 dark:text-slate-500'">
                              <span class="truncate">{{ getSelectedName(detail) || 'Chọn dịch vụ/combo...' }}</span>
                              <ChevronDown class="w-4 h-4 shrink-0 text-slate-400" />
                            </button>
                            <!-- Dropdown -->
                            <div v-if="showServiceDropdown[Number(index)]"
                              class="absolute top-full left-0 mt-1 w-full max-h-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden flex flex-col">
                              <div class="p-2 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                                <input v-model="searchService[Number(index)]" type="text" placeholder="Tìm dịch vụ..."
                                  class="w-full h-9 px-3 rounded-lg bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white border-none outline-none placeholder:text-slate-400"
                                  @click.stop />
                              </div>
                              <div class="overflow-y-auto flex-1 custom-scroll">
                                <div v-if="getAvailableServices(Number(index)).length === 0"
                                  class="py-6 text-center text-xs text-slate-400">Không tìm thấy kết quả</div>
                                <button v-for="sv in getAvailableServices(Number(index))" :key="sv.ma"
                                  @click.stop="onChonDichVu(Number(index), sv.ma)"
                                  class="w-full px-3 py-2.5 text-left text-sm flex items-center justify-between hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors cursor-pointer"
                                  :class="(detail.maDV || detail.maCB) === sv.ma ? 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'">
                                  <span class="truncate font-medium">{{ sv.ten }}</span>
                                  <span
                                    class="text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0"
                                    :class="sv.loai === 'Combo' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400'">
                                    {{ sv.loai }}
                                  </span>
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>
                        <!-- Giá gốc -->
                        <td class="py-3 px-4">
                          <input type="number" v-model="detail.gia" disabled
                            class="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-sm text-slate-500 dark:text-slate-400 outline-none font-medium" />
                        </td>
                        <!-- Giá sau giảm -->
                        <td class="py-3 px-4">
                          <input type="number" v-model="detail.giaSauGiam"
                            @input="tinhPhanTram(Number(index))"
                            class="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-rose-600 dark:text-rose-400 font-bold outline-none focus:border-rose-500 dark:focus:border-rose-400 transition-all" />
                        </td>
                        <!-- % Giảm -->
                        <td class="py-3 px-4">
                          <div class="relative">
                            <input type="number" v-model="detail.phanTramGiam"
                              @input="tinhGiaSauGiam(Number(index))"
                              class="w-full h-10 px-3 pr-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-center font-bold text-slate-800 dark:text-white outline-none focus:border-rose-500 dark:focus:border-rose-400 transition-all" />
                            <Percent
                              class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                          </div>
                        </td>
                        <!-- Delete -->
                        <td class="py-3 px-4 text-right">
                          <button @click="xoaDichVu(Number(index))"
                            class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all cursor-pointer mx-auto">
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </td>
                      </tr>

                      <!-- Empty -->
                      <tr v-if="!currentItem.chiTietFlashSales || currentItem.chiTietFlashSales.length === 0">
                        <td colspan="5" class="py-12 text-center">
                          <div class="flex flex-col items-center gap-2">
                            <Package class="w-8 h-8 text-slate-300 dark:text-slate-600" />
                            <p class="text-sm text-slate-400 dark:text-slate-500 font-medium">Chưa có dịch vụ/combo nào</p>
                            <p class="text-xs text-slate-400 dark:text-slate-600">Bấm "Thêm dịch vụ" để bắt đầu</p>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <!-- Modal Footer -->
            <div
              class="px-8 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 flex-shrink-0 bg-slate-50/50 dark:bg-slate-800/30">
              <button @click="showFormModal = false" :disabled="isSubmitting"
                class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer disabled:opacity-50">
                Hủy bỏ
              </button>
              <button @click="saveForm" :disabled="isSubmitting"
                class="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2">
                <span v-if="isSubmitting"
                  class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                {{ isSubmitting ? 'Đang lưu...' : 'Lưu chiến dịch' }}
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

    <!-- ═══════════════════════════════════════════════════════
         MODAL: XÁC NHẬN XÓA
    ═══════════════════════════════════════════════════════ -->
    <teleport to="body">
      <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0"
        enter-to-class="opacity-100" leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100" leave-to-class="opacity-0">
        <div v-if="showDeleteModal" class="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          @click.self="showDeleteModal = false">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
          <div @click.stop
            class="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 p-8 text-center">
            <div
              class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center">
              <AlertCircle class="w-8 h-8 text-rose-500" />
            </div>
            <h3 class="text-lg font-bold text-slate-900 dark:text-white mb-2">Xác nhận xóa Flash Sale?</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400 mb-6">
              Hành động này không thể hoàn tác. Dữ liệu của
              <b class="text-slate-800 dark:text-white">{{ currentItem.maFL }}</b>
              và toàn bộ dịch vụ đi kèm sẽ bị xóa vĩnh viễn.
            </p>
            <div class="flex items-center justify-center gap-3">
              <button @click="showDeleteModal = false"
                class="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer">
                Hủy
              </button>
              <button @click="confirmDelete"
                class="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200/50 dark:shadow-rose-900/30 transition-all active:scale-95 cursor-pointer">
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      </transition>
    </teleport>

  </v-container>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 99px;
}

.dark .custom-scroll::-webkit-scrollbar-thumb {
  background: #475569;
}

.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* Remove spinner arrows on number inputs */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

input[type="number"] {
  -moz-appearance: textfield;
}
</style>