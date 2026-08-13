<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useTheme } from 'vuetify'
import {
  Search, Plus, Edit3, Trash2, X, Clock, Check,
  Zap, TrendingDown, Calendar, Package, RotateCcw,
  Percent, ChevronDown, AlertCircle, Sparkles, Tag
} from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import axios from 'axios'

import { useCustomizerStore } from '@/stores/customizer'

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

// ── CONFIG ──
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_URL = API + '/api/Sale'
const API_DICH_VU = API + '/api/DanhSachDichVu'
const API_COMBO = API + '/api/Combo'

// ── STATE ──
const dataList = ref<any[]>([])
const danhSachDichVuMau = ref<any[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false)
const showFormModal = ref(false)
const showDeleteModal = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')

// ── HIGH-PRIORITY NOTIFICATION SYSTEM (SNACKBAR) ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success',
  icon: 'mdi-check-circle-outline'
})

const showNotification = (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = msg
  snackbar.color = type === 'success' ? 'success' : type === 'error' ? 'error' : type === 'warning' ? 'warning' : 'info'
  snackbar.icon = type === 'success' ? 'mdi-check-circle-outline' : type === 'error' ? 'mdi-alert-circle-outline' : type === 'warning' ? 'mdi-alert-outline' : 'mdi-information-outline'
  snackbar.show = true
}

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
    showNotification(error.response?.data?.message || 'Lỗi khi lấy dữ liệu khuyến mãi!', 'error')
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
    const listDv = rawDichVu.map((x: any) => {
      const gia = x.gia || x.Gia || 0
      const ten = x.tenDv || x.TenDv || x.tenDV || x.TenDV || x.ten || x.Ten || ''
      const ma = x.maDv || x.MaDv || x.maDV || x.MaDV || x.id || x.Id
      const loai = x.maDmNavigation?.tenDanhMuc || x.MaDmNavigation?.TenDanhMuc || 'Dịch vụ'
      return {
        loai,
        ma,
        ten,
        gia,
        title: `${ten} (${loai}) - ${formatVND(gia)}`
      }
    })

    let dataCb = resCombo.data
    let rawCombo = Array.isArray(dataCb) ? dataCb : (dataCb?.combos || dataCb?.data || [])
    const listCb = rawCombo.map((x: any) => {
      const gia = x.gia || x.Gia || 0
      const ten = x.tenCombo || x.TenCombo || x.tenCb || x.TenCb || x.tenCB || x.TenCB || ''
      const ma = x.maCb || x.MaCb || x.maCB || x.MaCB || x.id || x.Id
      return {
        loai: 'Combo',
        ma,
        ten,
        gia,
        title: `${ten} (Combo) - ${formatVND(gia)}`
      }
    })

    danhSachDichVuMau.value = [...listDv, ...listCb]
  } catch (error: any) {
    console.error("Lỗi fetch tổng:", error)
  }
}

onMounted(() => {
  fetchData()
  fetchServiceCombo()
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

const getStatusChipProps = (status: number) => {
  switch (status) {
    case 1: return { label: 'Đang diễn ra', color: 'success', icon: 'mdi-clock-outline' }
    case 0: return { label: 'Sắp diễn ra', color: 'warning', icon: 'mdi-calendar-clock' }
    case 2: return { label: 'Đã kết thúc', color: 'grey-darken-1', icon: 'mdi-close-circle-outline' }
    default: return { label: 'Không rõ', color: 'grey', icon: 'mdi-help-circle-outline' }
  }
}

// ── ACTIONS ──
const openCreateDialog = () => {
  dialogMode.value = 'create'
  currentItem.value = { maFL: '', ngayBatDau: '', ngayKetThuc: '', trangThai: 1, chiTietFlashSales: [] }
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
    ct.selectedId = matchedId
    const foundItem = danhSachDichVuMau.value.find((x: any) => x.ma === matchedId)
    ct.gia = ct.gia || foundItem?.gia || 0
    if (ct.gia > 0 && ct.phanTramGiam > 0) {
      ct.giaSauGiam = ct.gia - (ct.gia * ct.phanTramGiam / 100)
    } else {
      ct.giaSauGiam = ct.gia
    }
  })
  currentItem.value = clone
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
      showNotification('Vui lòng chọn Ngày bắt đầu và Ngày kết thúc!', 'warning')
      return
    }
    if (new Date(currentItem.value.ngayBatDau) >= new Date(currentItem.value.ngayKetThuc)) {
      showNotification('Ngày kết thúc phải lớn hơn ngày bắt đầu!', 'warning')
      return
    }
    if (!currentItem.value.chiTietFlashSales || currentItem.value.chiTietFlashSales.length === 0) {
      showNotification('Phải có ít nhất 1 dịch vụ hoặc combo để sale!', 'warning')
      return
    }
    for (const [index, x] of currentItem.value.chiTietFlashSales.entries()) {
      if (!x.maDV && !x.maCB && !x.selectedId) {
        showNotification(`Dòng số ${index + 1}: Chưa chọn Dịch vụ/Combo. Vui lòng chọn hoặc xóa dòng này!`, 'warning')
        return
      }
      if (x.phanTramGiam <= 0 || x.phanTramGiam > 100) {
        showNotification(`Dòng số ${index + 1}: Mức giảm giá phải từ 1% đến 100%!`, 'warning')
        return
      }
    }

    const payload = {
      ngayBatDau: currentItem.value.ngayBatDau,
      ngayKetThuc: currentItem.value.ngayKetThuc,
      trangThai: Number(currentItem.value.trangThai),
      chiTietFlashSales: currentItem.value.chiTietFlashSales.map((x: any) => ({
        maDV: x.maDV || (x.selectedId && danhSachDichVuMau.value.find(s => s.ma === x.selectedId)?.loai !== 'Combo' ? x.selectedId : ""),
        maCB: x.maCB || (x.selectedId && danhSachDichVuMau.value.find(s => s.ma === x.selectedId)?.loai === 'Combo' ? x.selectedId : ""),
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

    // Modal auto closes immediately after applying changes
    showFormModal.value = false
    showNotification(res.data?.message || 'Lưu chiến dịch khuyến mãi thành công!', 'success')
    fetchData()
  } catch (error: any) {
    console.error("Lỗi save:", error)
    const errorMsg = error.response?.data?.message || error.response?.data || 'Lưu thất bại!'
    logActivity(
      dialogMode.value === 'edit' ? "Cập nhật khuyến mãi" : "Thêm khuyến mãi",
      `Thất bại: ${errorMsg}`, "Khuyến mãi", "Thất bại"
    )
    showNotification(typeof errorMsg === 'string' ? errorMsg : 'Lỗi hệ thống khi lưu!', 'error')
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  try {
    isSubmitting.value = true
    const res = await axios.delete(`${API_URL}/${currentItem.value.maFL}`)
    logActivity("Xóa khuyến mãi", `Đã xóa chiến dịch khuyến mãi ${currentItem.value.maFL}`, "Khuyến mãi")
    // Modal auto closes immediately after applying changes
    showDeleteModal.value = false
    showNotification(res.data?.message || 'Đã xóa Flash Sale thành công!', 'success')
    fetchData()
  } catch (error: any) {
    console.error("Lỗi delete:", error)
    logActivity("Xóa khuyến mãi", `Thất bại khi xóa ${currentItem.value.maFL}`, "Khuyến mãi", "Thất bại")
    showNotification(error.response?.data?.message || 'Xóa thất bại!', 'error')
  } finally {
    isSubmitting.value = false
  }
}

// ── DETAIL TABLE ACTIONS ──
const themDichVuVaoList = () => {
  currentItem.value.chiTietFlashSales.push({
    selectedId: "", maDV: "", maCB: "", tenDv: "", tenCb: "", gia: 0, giaSauGiam: 0, phanTramGiam: 0
  })
}

const xoaDichVu = (index: number | string) => {
  currentItem.value.chiTietFlashSales.splice(Number(index), 1)
}

const onChonDichVu = (index: number | string, selectedId: any) => {
  const idx = Number(index)
  const itemMau = danhSachDichVuMau.value.find((x: any) => x.ma === selectedId)
  const row = currentItem.value.chiTietFlashSales[idx]
  if (itemMau && row) {
    row.selectedId = selectedId
    if (itemMau.loai === 'Combo') {
      row.maCB = itemMau.ma; row.tenCb = itemMau.ten; row.maDV = ""; row.tenDv = ""
    } else {
      row.maDV = itemMau.ma; row.tenDv = itemMau.ten; row.maCB = ""; row.tenCb = ""
    }
    row.gia = itemMau.gia
    row.giaSauGiam = itemMau.gia
    row.phanTramGiam = 0
  }
}

const tinhGiaSauGiam = (index: number | string) => {
  const row = currentItem.value.chiTietFlashSales[Number(index)]
  if (row) {
    let pt = Number(row.phanTramGiam) || 0
    if (pt > 100) pt = 100
    if (pt < 0) pt = 0
    row.phanTramGiam = pt
    if (row.gia > 0) {
      row.giaSauGiam = Math.max(0, Math.round(row.gia - (row.gia * pt / 100)))
    }
  }
}

const onPastePhanTram = (e: ClipboardEvent, index: number | string) => {
  e.preventDefault()
  const pastedText = e.clipboardData?.getData('text') || ''
  let num = parseFloat(pastedText)
  if (isNaN(num) || num < 0) num = 0
  if (num > 100) num = 100
  const row = currentItem.value.chiTietFlashSales[Number(index)]
  if (row) {
    row.phanTramGiam = num
    tinhGiaSauGiam(index)
  }
}

const tinhPhanTram = (index: number | string) => {
  const row = currentItem.value.chiTietFlashSales[Number(index)]
  if (row && row.gia > 0 && row.giaSauGiam >= 0) {
    const pt = Math.round(((row.gia - row.giaSauGiam) / row.gia) * 100)
    row.phanTramGiam = Math.max(0, Math.min(100, pt))
  }
}

const getAvailableServices = (currentIndex: number | string) => {
  const idxNum = Number(currentIndex)
  const selectedIds = currentItem.value.chiTietFlashSales
    .filter((_: any, idx: number) => idx !== idxNum)
    .map((x: any) => x.selectedId || x.maDV || x.maCB)
    .filter((id: string) => id)
  return danhSachDichVuMau.value.filter((sv: any) => !selectedIds.includes(sv.ma))
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
        <Zap v-else class="w-5 h-5 shrink-0" />
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
            <Zap class="w-6 h-6 text-rose-500 shrink-0" />
            <span>Quản Lý Flash Sale & Khuyến Mãi</span>
          </h2>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">
            Tạo và quản lý các chiến dịch giảm giá cho dịch vụ & combo trong hệ thống
          </p>
        </div>

        <div class="d-flex align-center gap-3 flex-grow-1 justify-lg-end flex-wrap">
          <v-text-field
            v-model="searchQuery"
            placeholder="Tìm kiếm mã Flash Sale..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            class="flex-grow-1"
            style="max-width: 450px; width: 100%; min-width: 240px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-slate-400 mr-1 shrink-0" />
            </template>
          </v-text-field>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            width="40"
            icon
            rounded="xl"
            :loading="isLoading"
            @click="fetchData"
            title="Tải lại"
          >
            <RotateCcw class="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </v-btn>

          <v-btn
            color="error"
            height="40"
            rounded="xl"
            elevation="2"
            class="text-none font-weight-bold px-5"
            @click="openCreateDialog"
          >
            <template v-slot:prepend>
              <Plus class="w-4 h-4 mr-1 shrink-0" />
            </template>
            Tạo Flash Sale
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ STATS CARDS ═══════ -->
    <v-row class="mb-6">
      <!-- Card 1: Tổng -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Tổng Chiến Dịch</p>
              <h3 class="text-h4 font-weight-black text-slate-800 dark:text-white">{{ statTotal }}</h3>
              <p class="text-caption text-rose-600 font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Tag class="w-3.5 h-3.5" /> <span>Tất cả Flash Sale</span>
              </p>
            </div>
            <v-avatar color="rose-lighten-4" size="52" rounded="xl">
              <Zap class="w-6 h-6 text-rose-600" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 2: Đang diễn ra -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Đang Diễn Ra</p>
              <h3 class="text-h4 font-weight-black text-slate-800 dark:text-white">{{ statActive }}</h3>
              <p class="text-caption text-emerald-600 font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Check class="w-3.5 h-3.5" /> <span>Đang hoạt động</span>
              </p>
            </div>
            <v-avatar color="emerald-lighten-4" size="52" rounded="xl">
              <Sparkles class="w-6 h-6 text-emerald-600" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 3: Sắp diễn ra -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Sắp Diễn Ra</p>
              <h3 class="text-h4 font-weight-black text-slate-800 dark:text-white">{{ statUpcoming }}</h3>
              <p class="text-caption text-amber-600 font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <Clock class="w-3.5 h-3.5" /> <span>Chờ kích hoạt</span>
              </p>
            </div>
            <v-avatar color="amber-lighten-4" size="52" rounded="xl">
              <Calendar class="w-6 h-6 text-amber-600" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>

      <!-- Card 4: Đã kết thúc -->
      <v-col cols="12" sm="6" md="3">
        <v-card elevation="2" rounded="xl" class="pa-5 relative overflow-hidden h-100">
          <div class="d-flex align-center justify-space-between">
            <div>
              <p class="text-caption font-weight-bold uppercase text-medium-emphasis mb-1">Đã Kết Thúc</p>
              <h3 class="text-h4 font-weight-black text-slate-800 dark:text-white">{{ statEnded }}</h3>
              <p class="text-caption text-grey-darken-1 font-weight-medium mt-2 d-flex align-center gap-1 mb-0">
                <X class="w-3.5 h-3.5" /> <span>Đã hoàn thành</span>
              </p>
            </div>
            <v-avatar color="grey-lighten-3" size="52" rounded="xl">
              <TrendingDown class="w-6 h-6 text-grey-darken-2" />
            </v-avatar>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ═══════ DATA TABLE CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6">
      <v-table class="rounded-xl border">
        <thead>
          <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200">Mã Sale</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200">Ngày bắt đầu</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200">Ngày kết thúc</th>
            <th class="font-weight-bold text-caption uppercase text-center py-3 text-slate-700 dark:text-slate-200">Tổng DV</th>
            <th class="font-weight-bold text-caption uppercase text-left py-3 text-slate-700 dark:text-slate-200">Trạng thái</th>
            <th class="font-weight-bold text-caption uppercase text-right py-3 text-slate-700 dark:text-slate-200">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading -->
          <tr v-if="isLoading">
            <td colspan="6" class="text-center py-8">
              <v-progress-circular indeterminate color="error" size="36" class="mb-2"></v-progress-circular>
              <div class="text-caption text-medium-emphasis">Đang tải dữ liệu...</div>
            </td>
          </tr>

          <!-- Empty -->
          <tr v-else-if="filteredData.length === 0">
            <td colspan="6" class="text-center py-10">
              <v-avatar color="grey-lighten-4" size="56" class="mb-3">
                <Zap class="w-7 h-7 text-grey" />
              </v-avatar>
              <div class="text-subtitle-2 font-weight-bold text-medium-emphasis">Không tìm thấy chiến dịch nào</div>
            </td>
          </tr>

          <!-- Data Rows -->
          <tr v-else v-for="item in filteredData" :key="item.maFL" class="hover:bg-rose-50/20 transition-colors">
            <td class="py-4">
              <v-chip color="grey-darken-3" variant="flat" size="small" class="font-weight-bold">
                {{ item.maFL }}
              </v-chip>
            </td>
            <td class="py-4">
              <div class="d-flex align-center gap-2">
                <Calendar class="w-4 h-4 text-grey shrink-0" />
                <span class="text-body-2 font-weight-medium">{{ formatDate(item.ngayBatDau) }}</span>
              </div>
            </td>
            <td class="py-4">
              <div class="d-flex align-center gap-2">
                <Calendar class="w-4 h-4 text-grey shrink-0" />
                <span class="text-body-2 font-weight-medium">{{ formatDate(item.ngayKetThuc) }}</span>
              </div>
            </td>
            <td class="py-4 text-center">
              <v-chip color="error" variant="tonal" size="small" class="font-weight-black">
                {{ item.tongDichVu || item.chiTietFlashSales?.length || 0 }}
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
                  <Clock v-else-if="item.trangThai === 0" class="w-3.5 h-3.5 mr-1" />
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

      <div class="d-flex align-center justify-space-between mt-4 px-2">
        <span class="text-caption text-medium-emphasis font-weight-semibold">
          Hiển thị {{ filteredData.length }} / {{ dataList.length }} chiến dịch
        </span>
      </div>
    </v-card>

    <!-- ═══════ MODAL: TẠO / CHỈNH SỬA FLASH SALE ═══════ -->
    <v-dialog v-model="showFormModal" max-width="950px" persistent scrollable>
      <v-card rounded="xl">
        <!-- Dialog Header -->
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar :color="dialogMode === 'create' ? 'error' : 'warning'" size="42" rounded="lg" elevation="2">
              <Plus v-if="dialogMode === 'create'" class="w-5 h-5 text-white" />
              <Edit3 v-else class="w-5 h-5 text-white" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">
                {{ dialogMode === 'create' ? 'Tạo Flash Sale mới' : 'Cập nhật Flash Sale' }}
              </h3>
              <p class="text-caption text-medium-emphasis mb-0">
                Cấu hình chiến dịch giảm giá cho dịch vụ và combo
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
            <!-- Trạng thái (Edit mode only) -->
            <div v-if="dialogMode === 'edit'" class="mb-5 pa-4 bg-slate-50 dark:bg-slate-800 rounded-xl border">
              <div class="text-caption font-weight-bold uppercase text-medium-emphasis mb-2">Trạng thái chiến dịch</div>
              <v-btn-toggle
                v-model="currentItem.trangThai"
                mandatory
                color="primary"
                rounded="lg"
                density="compact"
              >
                <v-btn :value="0" color="warning" variant="tonal">Sắp diễn ra</v-btn>
                <v-btn :value="1" color="success" variant="tonal">Đang hoạt động</v-btn>
                <v-btn :value="2" color="grey-darken-1" variant="tonal">Đã ngưng</v-btn>
              </v-btn-toggle>
            </div>

            <!-- Thời gian -->
            <v-row class="mb-2">
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="currentItem.ngayBatDau"
                  type="datetime-local"
                  label="Thời gian bắt đầu"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                >
                  <template v-slot:prepend-inner>
                    <Calendar class="w-4 h-4 text-grey mr-1" />
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="currentItem.ngayKetThuc"
                  type="datetime-local"
                  label="Thời gian kết thúc"
                  variant="outlined"
                  density="compact"
                  hide-details="auto"
                >
                  <template v-slot:prepend-inner>
                    <Calendar class="w-4 h-4 text-grey mr-1" />
                  </template>
                </v-text-field>
              </v-col>
            </v-row>

            <!-- Chi tiết dịch vụ -->
            <div class="mt-6 pt-4 border-t">
              <div class="d-flex align-center justify-space-between mb-4">
                <div>
                  <h4 class="text-subtitle-1 font-weight-bold d-flex align-center gap-2 mb-0">
                    <Package class="w-4 h-4 text-rose-500" />
                    Chi tiết dịch vụ / combo áp dụng
                  </h4>
                  <span class="text-caption text-medium-emphasis">
                    {{ currentItem.chiTietFlashSales?.length || 0 }} dịch vụ/combo đã chọn
                  </span>
                </div>
                <v-btn
                  color="error"
                  size="small"
                  rounded="lg"
                  @click="themDichVuVaoList"
                >
                  <template v-slot:prepend>
                    <Plus class="w-4 h-4 mr-1" />
                  </template>
                  Thêm dịch vụ
                </v-btn>
              </div>

              <v-table density="compact" class="border rounded-xl">
                <thead>
                  <tr class="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th class="text-caption font-weight-bold uppercase py-2 text-slate-700 dark:text-slate-200" style="width: 40%;">Dịch vụ / Combo</th>
                    <th class="text-caption font-weight-bold uppercase py-2 text-slate-700 dark:text-slate-200" style="width: 20%;">Giá gốc</th>
                    <th class="text-caption font-weight-bold uppercase py-2 text-slate-700 dark:text-slate-200" style="width: 20%;">Giá sau giảm</th>
                    <th class="text-caption font-weight-bold uppercase text-center py-2 text-slate-700 dark:text-slate-200" style="width: 12%;">% Giảm</th>
                    <th class="py-2" style="width: 8%;"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(detail, index) in currentItem.chiTietFlashSales" :key="index">
                    <!-- Service/Combo Autocomplete Selector -->
                    <td class="py-2">
                      <v-autocomplete
                        v-model="detail.selectedId"
                        :items="getAvailableServices(Number(index))"
                        item-title="title"
                        item-value="ma"
                        placeholder="Chọn dịch vụ/combo..."
                        variant="outlined"
                        density="compact"
                        hide-details
                        @update:model-value="val => onChonDichVu(Number(index), val)"
                      ></v-autocomplete>
                    </td>

                    <!-- Giá gốc -->
                    <td class="py-2">
                      <v-text-field
                        :model-value="formatVND(detail.gia)"
                        readonly
                        variant="filled"
                        density="compact"
                        hide-details
                      ></v-text-field>
                    </td>

                    <!-- Giá sau giảm -->
                    <td class="py-2">
                      <v-text-field
                        v-model.number="detail.giaSauGiam"
                        type="number"
                        variant="outlined"
                        density="compact"
                        hide-details
                        @input="tinhPhanTram(Number(index))"
                      ></v-text-field>
                    </td>

                    <!-- % Giảm -->
                    <td class="py-2">
                      <v-text-field
                        v-model.number="detail.phanTramGiam"
                        type="number"
                        suffix="%"
                        variant="outlined"
                        density="compact"
                        hide-details
                        class="text-center"
                        :max="100"
                        :min="0"
                        @input="tinhGiaSauGiam(Number(index))"
                        @paste="(e: ClipboardEvent) => onPastePhanTram(e, Number(index))"
                      ></v-text-field>
                    </td>

                    <!-- Delete row -->
                    <td class="py-2 text-center">
                      <v-btn
                        icon
                        variant="text"
                        color="error"
                        size="small"
                        @click="xoaDichVu(Number(index))"
                      >
                        <Trash2 class="w-4 h-4" />
                      </v-btn>
                    </td>
                  </tr>

                  <tr v-if="!currentItem.chiTietFlashSales || currentItem.chiTietFlashSales.length === 0">
                    <td colspan="5" class="text-center py-8">
                      <v-avatar color="grey-lighten-4" size="48" class="mb-2">
                        <Package class="w-6 h-6 text-grey" />
                      </v-avatar>
                      <div class="text-caption text-medium-emphasis">Chưa có dịch vụ/combo nào. Bấm "Thêm dịch vụ" để bắt đầu</div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
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
            :disabled="isSubmitting"
            @click="showFormModal = false"
          >
            Hủy bỏ
          </v-btn>
          <v-btn
            color="error"
            height="44"
            variant="flat"
            rounded="xl"
            elevation="4"
            class="text-none font-weight-black px-7"
            :loading="isSubmitting"
            @click="saveForm"
          >
            <template v-slot:prepend>
              <Check class="w-5 h-5 mr-1 shrink-0" />
            </template>
            Lưu chiến dịch
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ═══════ MODAL: XÁC NHẬN XÓA ═══════ -->
    <v-dialog v-model="showDeleteModal" max-width="450px" persistent>
      <v-card rounded="xl" class="pa-6 text-center">
        <v-avatar color="rose-lighten-5" size="64" class="mx-auto mb-4">
          <AlertCircle class="w-8 h-8 text-rose-500" />
        </v-avatar>
        <h3 class="text-h6 font-weight-bold mb-2">Xác nhận xóa Flash Sale?</h3>
        <p class="text-body-2 text-medium-emphasis mb-6">
          Hành động này không thể hoàn tác. Dữ liệu của
          <strong class="text-slate-900 dark:text-white">{{ currentItem.maFL }}</strong>
          và toàn bộ dịch vụ đi kèm sẽ bị xóa vĩnh viễn.
        </p>

        <div class="d-flex align-center justify-center gap-3">
          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="44"
            rounded="xl"
            class="text-none font-weight-bold px-5"
            :disabled="isSubmitting"
            @click="showDeleteModal = false"
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
            :loading="isSubmitting"
            @click="confirmDelete"
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
/* Number input styling adjustments */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
input[type="number"] {
  -moz-appearance: textfield;
}
</style>