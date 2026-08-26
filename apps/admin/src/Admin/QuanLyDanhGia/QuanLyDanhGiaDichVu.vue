<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue'
import {
  Search, MessageSquare, X, Clock, Users, Phone, Scissors,
  Star, Image as ImageIcon, Reply, Trash2, EyeOff, Eye, CheckCircle2, BarChart3,
  RotateCcw, AlertTriangle
} from 'lucide-vue-next'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import ThongKeDichVuModal from './ThongKeDichVuModal.vue'

// URL API Backend
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = API + '/api/QuanLyDanhGiaDichVu'

// --- State ---
const reviews = ref<any[]>([])
const isLoading = ref(false)
const selectedReview = ref<any>(null)
const showStats = ref(false)
const detailOpen = ref(false)
const isImageBroken = ref(false)

// Filters
const searchQuery = ref('')
const filterDate = ref('')
const filterStar = ref('all') // all, 5, 4, 3, 2, 1
const filterStatus = ref('all') // all, replied, unreplied

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10

// Reply state
const replyContent = ref('')

// Snackbar notification
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})
const showSnackbar = (text: string, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

// Native Vuetify Confirm Dialog State
const confirmDialog = reactive({
  open: false,
  title: '',
  subtitle: '',
  message: '',
  confirmText: 'Đồng ý',
  color: 'primary',
  icon: AlertTriangle as any,
  loading: false,
  action: null as (() => Promise<void>) | null
})

const openConfirm = (opts: {
  title: string
  subtitle?: string
  message: string
  confirmText?: string
  color?: string
  icon?: any
  action: () => Promise<void>
}) => {
  confirmDialog.title = opts.title
  confirmDialog.subtitle = opts.subtitle || 'Xác nhận hành động'
  confirmDialog.message = opts.message
  confirmDialog.confirmText = opts.confirmText || 'Đồng ý'
  confirmDialog.color = opts.color || 'primary'
  confirmDialog.icon = opts.icon || AlertTriangle
  confirmDialog.action = opts.action
  confirmDialog.loading = false
  confirmDialog.open = true
}

const executeConfirmAction = async () => {
  if (!confirmDialog.action) return
  confirmDialog.loading = true
  try {
    await confirmDialog.action()
    confirmDialog.open = false
  } finally {
    confirmDialog.loading = false
  }
}

// --- Computed properties ---
const filteredData = computed(() => {
  return reviews.value.filter(r => {
    const q = searchQuery.value.toLowerCase()
    const matchSearch = !q || (r.tenKhach || '').toLowerCase().includes(q) || (r.tenDichVu || '').toLowerCase().includes(q) || String(r.maHd || '').toLowerCase().includes(q)
    const matchStar = filterStar.value === 'all' || r.soSao === parseInt(filterStar.value)
    const matchStatus = filterStatus.value === 'all' ||
      (filterStatus.value === 'replied' ? r.daPhanHoi : !r.daPhanHoi)
    const matchDate = !filterDate.value || (r.ngayDanhGia && r.ngayDanhGia.includes(filterDate.value))

    return matchSearch && matchStar && matchStatus && matchDate
  })
})

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return filteredData.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1)

// Lấy chữ cái viết tắt của tên khách để làm Avatar
const getInitials = (name: string) => {
  if (!name) return 'KH'
  const parts = name.trim().split(' ')
  if (parts.length === 1) {
    const first = parts[0]
    return first ? first.substring(0, 2).toUpperCase() : 'KH'
  }
  const firstChar = parts[parts.length - 2]?.substring(0, 1) || ''
  const secondChar = parts[parts.length - 1]?.substring(0, 1) || ''
  return (firstChar + secondChar).toUpperCase() || 'KH'
}

// Kiểm tra ảnh hợp lệ
const hasImage = computed(() => {
  if (!selectedReview.value?.hinhAnh) return false
  const imgStr = selectedReview.value.hinhAnh.trim().toLowerCase()
  if (imgStr === '' || imgStr === 'null' || imgStr.endsWith('/null') || imgStr.endsWith('/')) return false
  return !isImageBroken.value
})

// --- API Calls ---
const fetchReviews = async () => {
  isLoading.value = true
  try {
    const res = await axios.get(`${API_BASE_URL}/get-all`)
    reviews.value = res.data
  } catch (error) {
    showSnackbar("Lỗi khi tải danh sách đánh giá dịch vụ!", "error")
    console.error(error)
  } finally {
    isLoading.value = false
  }
}

// Logic chọn đánh giá để xem chi tiết
const openDetail = (item: any) => {
  selectedReview.value = { ...item }
  replyContent.value = item.phanHoiAdmin || ''
  isImageBroken.value = false
  detailOpen.value = true
}

// Format ngày giờ
const formatDateTime = (dateStr: string) => {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

// 2. Gửi phản hồi cho khách hàng
const submitReply = async () => {
  if (!replyContent.value.trim()) return showSnackbar("Vui lòng nhập nội dung phản hồi!", "warning")

  try {
    await axios.post(`${API_BASE_URL}/reply`, {
      id: selectedReview.value.id,
      reply: replyContent.value
    })

    logActivity("Phản hồi đánh giá dịch vụ", `Đã phản hồi đánh giá của khách hàng ${selectedReview.value.tenKhach} cho dịch vụ ${selectedReview.value.tenDichVu}`, "Đánh giá")
    showSnackbar("Đã gửi phản hồi cho khách hàng!", "success")

    const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
    if (idx !== -1) {
      reviews.value[idx].daPhanHoi = true
      reviews.value[idx].phanHoiAdmin = replyContent.value
    }
    selectedReview.value.daPhanHoi = true
    selectedReview.value.phanHoiAdmin = replyContent.value
    detailOpen.value = false
  } catch (error: any) {
    logActivity("Phản hồi đánh giá dịch vụ", `Thất bại khi phản hồi đánh giá của ${selectedReview.value?.tenKhach || ''} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại")
    showSnackbar("Lỗi khi gửi phản hồi!", "error")
  }
}

// 3. Ẩn/Hiện đánh giá bằng Vuetify Confirm Modal
const toggleVisibility = () => {
  const actionStr = selectedReview.value.isHidden ? 'hiển thị lại' : 'ẩn'
  openConfirm({
    title: `Xác nhận ${actionStr}?`,
    subtitle: 'Thay đổi trạng thái hiển thị',
    message: `Bạn có chắc chắn muốn ${actionStr} đánh giá dịch vụ này trên ứng dụng khách hàng?`,
    confirmText: selectedReview.value.isHidden ? 'Hiển thị' : 'Ẩn ngay',
    color: selectedReview.value.isHidden ? 'success' : 'warning',
    icon: selectedReview.value.isHidden ? Eye : EyeOff,
    action: async () => {
      try {
        await axios.put(`${API_BASE_URL}/toggle-visibility/${selectedReview.value.id}`)
        logActivity("Đổi trạng thái hiển thị đánh giá dịch vụ", `Đã ${actionStr} đánh giá của khách hàng ${selectedReview.value.tenKhach}`, "Đánh giá")
        showSnackbar(`Đã ${actionStr} đánh giá dịch vụ!`, "success")

        selectedReview.value.isHidden = !selectedReview.value.isHidden
        const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
        if (idx !== -1) reviews.value[idx].isHidden = selectedReview.value.isHidden
      } catch (error: any) {
        logActivity("Đổi trạng thái hiển thị đánh giá dịch vụ", `Thất bại khi ${actionStr} đánh giá của ${selectedReview.value.tenKhach} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại")
        showSnackbar("Thao tác thất bại!", "error")
      }
    }
  })
}

// 4. Xóa vĩnh viễn đánh giá bằng Vuetify Confirm Modal
const deleteReview = () => {
  const reviewKhachName = selectedReview.value.tenKhach
  openConfirm({
    title: 'Xóa vĩnh viễn đánh giá?',
    subtitle: 'Hành động không thể hoàn tác',
    message: 'Dữ liệu đánh giá và hình ảnh sẽ bị xóa khỏi hệ thống. Bạn có chắc chắn muốn xóa?',
    confirmText: 'Xóa ngay',
    color: 'error',
    icon: Trash2,
    action: async () => {
      try {
        await axios.delete(`${API_BASE_URL}/delete/${selectedReview.value.id}`)
        logActivity("Xóa đánh giá dịch vụ", `Đã xóa vĩnh viễn đánh giá của khách hàng ${reviewKhachName}`, "Đánh giá")
        showSnackbar("Đã xóa đánh giá!", "success")

        reviews.value = reviews.value.filter(r => r.id !== selectedReview.value.id)
        selectedReview.value = null
        detailOpen.value = false

        if (paginatedData.value.length === 0 && currentPage.value > 1) currentPage.value--
      } catch (error: any) {
        logActivity("Xóa đánh giá dịch vụ", `Thất bại khi xóa vĩnh viễn đánh giá của ${reviewKhachName} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại")
        showSnackbar("Lỗi khi xóa đánh giá!", "error")
      }
    }
  })
}

onMounted(() => {
  fetchReviews()
})

watch([searchQuery, filterStar, filterStatus, filterDate], () => {
  currentPage.value = 1
})
</script>

<template>
  <div class="d-flex flex-column gap-4 w-100">
    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" :timeout="3000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- Sub Toolbar -->
    <v-card variant="outlined" rounded="xl" class="pa-4 bg-surface">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
        <!-- Filters -->
        <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
          <v-text-field
            v-model="searchQuery"
            placeholder="Tìm mã đơn, khách hàng, dịch vụ..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            style="min-width: 260px; max-width: 320px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis mr-1" />
            </template>
          </v-text-field>

          <v-select
            v-model="filterStar"
            :items="[
              { title: 'Tất cả sao', value: 'all' },
              { title: '5 Sao', value: '5' },
              { title: '4 Sao', value: '4' },
              { title: '3 Sao', value: '3' },
              { title: '2 Sao', value: '2' },
              { title: '1 Sao', value: '1' }
            ]"
            item-title="title"
            item-value="value"
            label="Số sao"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="width: 140px;"
          ></v-select>

          <v-select
            v-model="filterStatus"
            :items="[
              { title: 'Tất cả trạng thái', value: 'all' },
              { title: 'Chưa phản hồi', value: 'unreplied' },
              { title: 'Đã phản hồi', value: 'replied' }
            ]"
            item-title="title"
            item-value="value"
            label="Trạng thái"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="width: 170px;"
          ></v-select>

          <v-text-field
            v-model="filterDate"
            type="date"
            label="Ngày đánh giá"
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            style="width: 160px;"
          ></v-text-field>
        </div>

        <!-- Action Buttons -->
        <div class="d-flex align-center gap-2">
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            height="40"
            @click="showStats = true"
          >
            <template v-slot:prepend><BarChart3 class="w-4 h-4 mr-1" /></template>
            Thống kê hiệu năng
          </v-btn>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            rounded="lg"
            class="text-none font-weight-bold"
            height="40"
            :loading="isLoading"
            @click="fetchReviews"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- Table Card -->
    <v-card variant="outlined" rounded="xl" class="overflow-hidden">
      <div v-if="isLoading" class="d-flex justify-center align-center py-16">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <div v-else class="overflow-x-auto">
        <v-table hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption text-center py-3" style="width: 100px;">MÃ ĐƠN</th>
              <th class="font-weight-bold text-caption text-left py-3" style="width: 220px;">KHÁCH HÀNG</th>
              <th class="font-weight-bold text-caption text-left py-3" style="min-width: 250px;">DỊCH VỤ &amp; NHẬN XÉT</th>
              <th class="font-weight-bold text-caption text-center py-3" style="width: 150px;">SỐ SAO</th>
              <th class="font-weight-bold text-caption text-center py-3" style="width: 160px;">NGÀY ĐÁNH GIÁ</th>
              <th class="font-weight-bold text-caption text-center py-3" style="width: 140px;">TRẠNG THÁI</th>
              <th class="font-weight-bold text-caption text-center py-3" style="width: 110px;">THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in paginatedData"
              :key="item.id"
              class="border-b cursor-pointer"
              @click="openDetail(item)"
            >
              <!-- Mã đơn -->
              <td class="text-center font-weight-bold font-mono">#{{ item.maHd }}</td>

              <!-- Khách hàng -->
              <td>
                <div class="d-flex align-center gap-3">
                  <v-avatar color="primary" variant="tonal" size="36" rounded="lg" class="font-weight-bold text-caption">
                    {{ getInitials(item.tenKhach) }}
                  </v-avatar>
                  <div>
                    <div class="font-weight-bold text-body-2 d-flex align-center gap-1">
                      {{ item.tenKhach }}
                      <EyeOff v-if="item.isHidden" class="w-3.5 h-3.5 text-error inline" title="Đánh giá đang bị ẩn" />
                    </div>
                    <div class="text-caption text-medium-emphasis">{{ item.sdt || 'Chưa có SĐT' }}</div>
                  </div>
                </div>
              </td>

              <!-- Dịch vụ & Nhận xét -->
              <td>
                <div class="font-weight-bold text-body-2 text-truncate" style="max-width: 280px;">{{ item.tenDichVu }}</div>
                <div class="text-caption text-medium-emphasis text-truncate font-italic mt-0.5" style="max-width: 280px;">
                  "{{ item.noiDung || 'Khách hàng chỉ chấm sao' }}"
                </div>
              </td>

              <!-- Số sao -->
              <td class="text-center">
                <div class="d-inline-flex align-center gap-0.5">
                  <Star
                    v-for="n in 5"
                    :key="n"
                    class="w-3.5 h-3.5"
                    :class="n <= item.soSao ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300'"
                  />
                  <ImageIcon v-if="item.hinhAnh && !item.hinhAnh.toLowerCase().includes('null')" class="w-3.5 h-3.5 text-primary ml-1" />
                </div>
              </td>

              <!-- Ngày đánh giá -->
              <td class="text-center text-caption text-medium-emphasis">
                {{ formatDateTime(item.ngayDanhGia) }}
              </td>

              <!-- Trạng thái -->
              <td class="text-center">
                <v-chip
                  size="small"
                  :color="item.daPhanHoi ? 'success' : 'warning'"
                  variant="tonal"
                  class="font-weight-bold text-caption text-uppercase"
                >
                  {{ item.daPhanHoi ? 'Đã phản hồi' : 'Chưa xử lý' }}
                </v-chip>
              </td>

              <!-- Thao tác -->
              <td class="text-center" @click.stop>
                <v-btn
                  variant="outlined"
                  color="primary"
                  size="small"
                  rounded="lg"
                  class="text-none font-weight-bold"
                  @click="openDetail(item)"
                >
                  Chi tiết
                </v-btn>
              </td>
            </tr>

            <tr v-if="paginatedData.length === 0">
              <td colspan="7" class="text-center py-16 text-medium-emphasis">
                <MessageSquare class="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-50" />
                <div class="font-weight-bold text-body-2">Không tìm thấy đánh giá dịch vụ nào</div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Pagination -->
      <v-divider></v-divider>
      <div class="pa-4 d-flex align-center justify-space-between flex-wrap gap-2">
        <div class="text-caption text-medium-emphasis">
          Tổng số <strong class="text-high-emphasis">{{ filteredData.length }}</strong> đánh giá
        </div>
        <v-pagination
          v-model="currentPage"
          :length="totalPages"
          :total-visible="5"
          density="comfortable"
          rounded="lg"
          size="small"
        ></v-pagination>
      </div>
    </v-card>

    <!-- Detail Dialog -->
    <v-dialog v-model="detailOpen" max-width="680px" scrollable>
      <v-card v-if="selectedReview" rounded="xl" class="overflow-hidden">
        <!-- Header -->
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
          <div class="d-flex align-center gap-3">
            <v-avatar color="primary" variant="tonal" size="44" rounded="lg">
              <MessageSquare class="w-5 h-5 text-primary" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">Chi Tiết Đánh Giá Dịch Vụ</h3>
              <div class="text-caption font-mono text-medium-emphasis">MÃ ĐƠN: #{{ selectedReview.maHd }}</div>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="detailOpen = false">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <!-- Body -->
        <v-card-text class="pa-6 d-flex flex-column gap-4">
          <v-alert v-if="selectedReview.isHidden" type="warning" variant="tonal" density="compact" rounded="lg">
            Đánh giá này hiện đang bị ẩn khỏi ứng dụng khách hàng.
          </v-alert>

          <!-- Customer Info -->
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                :model-value="selectedReview.tenKhach"
                label="Khách hàng"
                variant="outlined"
                density="compact"
                readonly
                rounded="lg"
                hide-details
              >
                <template v-slot:prepend-inner><Users class="w-4 h-4 text-medium-emphasis mr-1" /></template>
              </v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <v-text-field
                :model-value="selectedReview.sdt || 'Chưa cập nhật'"
                label="Số điện thoại"
                variant="outlined"
                density="compact"
                readonly
                rounded="lg"
                hide-details
              >
                <template v-slot:prepend-inner><Phone class="w-4 h-4 text-medium-emphasis mr-1" /></template>
              </v-text-field>
            </v-col>
          </v-row>

          <!-- Service & Rating -->
          <v-row dense>
            <v-col cols="12" sm="6">
              <v-text-field
                :model-value="selectedReview.tenDichVu"
                label="Dịch vụ đánh giá"
                variant="outlined"
                density="compact"
                readonly
                rounded="lg"
                hide-details
              >
                <template v-slot:prepend-inner><Scissors class="w-4 h-4 text-primary mr-1" /></template>
              </v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="border rounded-lg pa-2 px-3 d-flex align-center justify-space-between" style="height: 40px;">
                <div class="d-flex gap-0.5">
                  <Star
                    v-for="n in 5"
                    :key="n"
                    class="w-4 h-4"
                    :class="n <= selectedReview.soSao ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-300'"
                  />
                </div>
                <span class="text-caption font-weight-bold text-medium-emphasis">({{ selectedReview.soSao }} / 5 Sao)</span>
              </div>
            </v-col>
          </v-row>

          <!-- Review Content -->
          <div>
            <div class="text-subtitle-2 font-weight-bold mb-1">Nhận xét của khách hàng</div>
            <v-textarea
              :model-value="selectedReview.noiDung || 'Khách hàng chỉ chấm sao không để lại lời bình.'"
              variant="outlined"
              density="compact"
              readonly
              rounded="lg"
              rows="3"
              hide-details
              class="font-italic"
            ></v-textarea>
            <div class="text-caption text-medium-emphasis text-end mt-1">
              Ngày gửi: {{ formatDateTime(selectedReview.ngayDanhGia) }}
            </div>
          </div>

          <!-- Attached Image -->
          <div v-if="hasImage">
            <div class="text-subtitle-2 font-weight-bold mb-1 d-flex align-center gap-1">
              <ImageIcon class="w-4 h-4 text-medium-emphasis" /> Hình ảnh đính kèm
            </div>
            <div class="border rounded-lg pa-2 d-inline-block">
              <img
                :src="API + selectedReview.hinhAnh"
                @error="isImageBroken = true"
                class="rounded-lg"
                style="max-width: 220px; max-height: 180px; object-fit: contain;"
                alt="Review Image"
              />
            </div>
          </div>

          <!-- Admin Reply -->
          <div>
            <div class="text-subtitle-2 font-weight-bold mb-1 d-flex align-center gap-1">
              <Reply class="w-4 h-4 text-primary" /> Phản hồi từ Salon
            </div>
            <v-textarea
              v-model="replyContent"
              placeholder="Nhập nội dung phản hồi chăm sóc khách hàng..."
              variant="outlined"
              density="compact"
              rounded="lg"
              rows="3"
              hide-details
            ></v-textarea>
          </div>
        </v-card-text>

        <!-- Footer Actions -->
        <v-divider></v-divider>
        <v-card-actions class="pa-4 d-flex justify-space-between flex-wrap gap-2">
          <div class="d-flex gap-2">
            <v-btn
              variant="outlined"
              color="grey-darken-1"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="toggleVisibility"
            >
              <template v-slot:prepend>
                <component :is="selectedReview.isHidden ? Eye : EyeOff" class="w-4 h-4 mr-1" />
              </template>
              {{ selectedReview.isHidden ? 'Hiển thị lại' : 'Ẩn đánh giá' }}
            </v-btn>

            <v-btn
              color="error"
              variant="tonal"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="deleteReview"
            >
              <template v-slot:prepend><Trash2 class="w-4 h-4 mr-1" /></template>
              Xóa
            </v-btn>
          </div>

          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="submitReply"
          >
            <template v-slot:prepend><CheckCircle2 class="w-4 h-4 mr-1" /></template>
            Lưu phản hồi
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Native Vuetify Confirm Dialog -->
    <v-dialog v-model="confirmDialog.open" max-width="440px">
      <v-card rounded="xl" class="pa-6">
        <div class="d-flex align-center gap-3 mb-4">
          <v-avatar :color="confirmDialog.color" variant="tonal" size="48" rounded="lg">
            <component :is="confirmDialog.icon" class="w-6 h-6" :class="`text-${confirmDialog.color}`" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">{{ confirmDialog.title }}</h3>
            <p class="text-caption text-medium-emphasis mb-0">{{ confirmDialog.subtitle }}</p>
          </div>
        </div>

        <p class="text-body-2 mb-6 text-medium-emphasis">
          {{ confirmDialog.message }}
        </p>

        <div class="d-flex justify-end gap-2">
          <v-btn
            variant="outlined"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="confirmDialog.open = false"
          >
            Hủy bỏ
          </v-btn>
          <v-btn
            :color="confirmDialog.color"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold text-white"
            :loading="confirmDialog.loading"
            @click="executeConfirmAction"
          >
            {{ confirmDialog.confirmText }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- Stats Modal -->
    <ThongKeDichVuModal :is-open="showStats" @close="showStats = false" />
  </div>
</template>
