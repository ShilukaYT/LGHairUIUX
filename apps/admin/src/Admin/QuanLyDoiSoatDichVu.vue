<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { Search, RotateCcw, Eye, Receipt, CheckCircle2, XCircle, Clock, Ban, Check, X } from 'lucide-vue-next'

// --- CẤU HÌNH API ---
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

// --- STATE QUẢN LÝ DỮ LIỆU ---
const doiSoatList = ref<any[]>([])
const doiSoatTotal = ref(0)
const doiSoatStats = ref({ tongLuot: 0, daKhop: 0, chuaKhop: 0 })
const loadingDS = ref(false)

// Vuetify Snackbar State
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})
const showSnackbar = (text: string, color: string = 'success') => {
  snackbar.value.text = text
  snackbar.value.color = color
  snackbar.value.show = true
}

// --- LOGIC LỌC / TÌM KIẾM ---
const tuNgayDS = ref('')
const denNgayDS = ref('')
const filterTrangThaiDS = ref('')
const searchDS = ref('')
const curPageDS = ref(1)
const perPageDS = ref(20)
let searchDebounce: ReturnType<typeof setTimeout> | null = null

// --- HELPERS ---
const fmt = (n?: number) => new Intl.NumberFormat('vi-VN').format(n || 0) + '₫'
const fmtDateTime = (d?: string) => {
  if (!d) return '—'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleString('vi-VN')
}

// --- FETCH DỮ LIỆU (server-side paging) ---
const loadDoiSoat = async () => {
  loadingDS.value = true
  try {
    const res = await axios.get(`${API}/api/QuanLyDoiSoatDichVu/doisoathoadon`, {
      params: {
        tuNgay: tuNgayDS.value || null,
        denNgay: denNgayDS.value || null,
        trangThai: filterTrangThaiDS.value || null,
        search: searchDS.value.trim() || null,
        page: curPageDS.value,
        pageSize: perPageDS.value,
      },
    })
    doiSoatList.value = res.data.items || []
    doiSoatTotal.value = res.data.total || 0
    doiSoatStats.value = res.data.stats || { tongLuot: 0, daKhop: 0, chuaKhop: 0 }
  } catch {
    showSnackbar('Lỗi tải dữ liệu đối soát!', 'error')
  } finally {
    loadingDS.value = false
  }
}

const onFilterDSChange = () => {
  curPageDS.value = 1
  loadDoiSoat()
}

const onSearchDSInput = () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => { onFilterDSChange() }, 350)
}

// Vuetify v-data-table-server phát sự kiện update:options ngay khi mount,
// nên không cần gọi loadDoiSoat() riêng trong onMounted để tránh gọi API 2 lần.
const handleTableUpdate = (options: { page: number; itemsPerPage: number }) => {
  curPageDS.value = options.page
  perPageDS.value = options.itemsPerPage
  loadDoiSoat()
}

const tyLeKhopDS = computed(() => {
  const t = doiSoatStats.value.tongLuot
  return t > 0 ? Math.round((doiSoatStats.value.daKhop / t) * 100) : 100
})

const trangThaiOptions = [
  { title: 'Tất cả trạng thái', value: '' },
  { title: 'Đã có hóa đơn', value: 'khop' },
  { title: 'Chưa khớp hóa đơn', value: 'thieu' },
]

const headers = [
  { title: 'Thời gian', key: 'ngayTao', align: 'start', sortable: false },
  { title: 'Mã hóa đơn', key: 'maHd', align: 'start', sortable: false },
  { title: 'Khách hàng', key: 'khachhang', align: 'start', sortable: false },
  { title: 'Nhân viên', key: 'tenNv', align: 'start', sortable: false },
  { title: 'Dịch vụ', key: 'dichvu', align: 'start', sortable: false },
  { title: 'Tổng tiền', key: 'tongTien', align: 'end', sortable: false },
  { title: 'Trạng thái hóa đơn', key: 'trangThai', align: 'center', sortable: false },
  { title: 'Số hóa đơn', key: 'soHoaDonDichVu', align: 'center', sortable: false },
  { title: 'Hóa đơn PDF', key: 'pdf', align: 'center', sortable: false },
] as const
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <div class="w-100">
      <!-- Thẻ thống kê -->
      <v-row class="mb-2">
        <v-col cols="6" md="3">
          <v-card rounded="xl" elevation="2" class="pa-4" style="border-top: 3px solid #1a1a2e;">
            <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Tổng hóa đơn</div>
            <div class="text-h5 font-weight-bold mt-1">{{ doiSoatStats.tongLuot }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Trong khoảng thời gian lọc</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="xl" elevation="2" class="pa-4" style="border-top: 3px solid #22c55e;">
            <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Đã có hóa đơn điện tử</div>
            <div class="text-h5 font-weight-bold mt-1 text-success">{{ doiSoatStats.daKhop }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Xuất hóa đơn thành công</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="xl" elevation="2" class="pa-4" style="border-top: 3px solid #ef4444;">
            <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Chưa khớp hóa đơn</div>
            <div class="text-h5 font-weight-bold mt-1 text-error">{{ doiSoatStats.chuaKhop }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Chưa xuất / lỗi / đang chờ</div>
          </v-card>
        </v-col>
        <v-col cols="6" md="3">
          <v-card rounded="xl" elevation="2" class="pa-4" style="border-top: 3px solid #f59e0b;">
            <div class="text-caption text-uppercase font-weight-bold text-medium-emphasis">Tỷ lệ khớp</div>
            <div class="text-h5 font-weight-bold mt-1 text-warning">{{ tyLeKhopDS }}%</div>
            <div class="text-caption text-medium-emphasis mt-1">Dịch vụ ↔ Hóa đơn điện tử</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- Bảng đối soát -->
      <v-card width="100%" elevation="2" rounded="xl">
        <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
          <div class="d-flex align-center gap-3">
            <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
              <Receipt class="w-6 h-6 text-primary" />
            </v-avatar>
            <div>
              <h2 class="text-h5 font-weight-bold mb-1">Đối Soát Hóa Đơn Dịch Vụ</h2>
              <div class="text-subtitle-2 text-medium-emphasis">{{ doiSoatTotal }} kết quả</div>
            </div>
          </div>

          <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
            <v-text-field
              v-model="searchDS"
              label="Tìm mã hóa đơn, tên khách, dịch vụ..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              class="flex-grow-1"
              style="min-width: 260px;"
              @input="onSearchDSInput"
              @click:clear="onFilterDSChange"
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey-darken-1 mr-2" />
              </template>
            </v-text-field>

            <v-text-field
              v-model="tuNgayDS"
              type="date"
              label="Từ ngày"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 160px;"
              @change="onFilterDSChange"
            ></v-text-field>

            <v-text-field
              v-model="denNgayDS"
              type="date"
              label="Đến ngày"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 160px;"
              @change="onFilterDSChange"
            ></v-text-field>

            <v-select
              v-model="filterTrangThaiDS"
              :items="trangThaiOptions"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 190px;"
              @update:model-value="onFilterDSChange"
            ></v-select>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" :loading="loadingDS" @click="loadDoiSoat">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>
        </v-card-title>

        <v-divider></v-divider>

        <v-data-table-server
          :headers="headers"
          :items="doiSoatList"
          :items-length="doiSoatTotal"
          :loading="loadingDS"
          :items-per-page="perPageDS"
          items-per-page-text="Số dòng / trang"
          @update:options="handleTableUpdate"
          hover
        >
          <template v-slot:item.ngayTao="{ item }">
            <div class="font-weight-medium">{{ fmtDateTime(item.ngayTao) }}</div>
          </template>

          <template v-slot:item.maHd="{ item }">
            <v-chip size="small" variant="tonal" color="grey-darken-2" class="font-family-monospace">
              {{ item.maHd }}
            </v-chip>
          </template>

          <template v-slot:item.khachhang="{ item }">
            <div class="py-2">
              <div class="font-weight-bold">{{ item.tenKh || 'Khách vãng lai' }}</div>
              <div class="text-caption text-medium-emphasis">{{ item.sdtKh || '—' }}</div>
            </div>
          </template>

          <template v-slot:item.tenNv="{ item }">
            <div class="font-weight-medium">{{ item.tenNv || '—' }}</div>
          </template>

          <template v-slot:item.dichvu="{ item }">
            <div class="text-caption text-medium-emphasis" style="max-width: 260px;">
              {{ (item.danhSachDichVu && item.danhSachDichVu.length) ? item.danhSachDichVu.join(', ') : '—' }}
            </div>
          </template>

          <template v-slot:item.tongTien="{ item }">
            <div class="font-weight-bold text-right">{{ fmt(item.tongTien) }}</div>
          </template>

          <template v-slot:item.trangThai="{ item }">
            <v-chip
              v-if="item.trangThaiHddtDichVu === 1"
              color="success" size="small" variant="flat" class="font-weight-bold"
            >
              <template v-slot:prepend><CheckCircle2 class="w-4 h-4 mr-1" /></template>
              Đã xuất
            </v-chip>
            <v-chip
              v-else-if="item.trangThaiHddtDichVu === 2"
              color="error" size="small" variant="flat" class="font-weight-bold"
              :title="item.ghiChuLoiDichVu"
            >
              <template v-slot:prepend><XCircle class="w-4 h-4 mr-1" /></template>
              Lỗi
            </v-chip>
            <v-chip
              v-else-if="item.trangThaiHddtDichVu === 3 || item.trangThaiHddtDichVu === 0"
              color="warning" size="small" variant="flat" class="font-weight-bold"
            >
              <template v-slot:prepend><Clock class="w-4 h-4 mr-1" /></template>
              Đang chờ
            </v-chip>
            <v-chip
              v-else
              color="grey-darken-2" size="small" variant="tonal" class="font-weight-bold"
            >
              <template v-slot:prepend><Ban class="w-4 h-4 mr-1" /></template>
              Không xuất HĐ
            </v-chip>
          </template>

          <template v-slot:item.soHoaDonDichVu="{ item }">
            <div class="text-center">{{ item.soHoaDonDichVu || '—' }}</div>
          </template>

          <template v-slot:item.pdf="{ item }">
            <div class="d-flex justify-center">
              <v-btn
                v-if="item.linkPdfDichVu"
                :href="item.linkPdfDichVu"
                target="_blank"
                icon
                size="small"
                variant="tonal"
                color="primary"
                title="Xem PDF"
              >
                <Eye class="w-4 h-4" />
              </v-btn>
              <span v-else class="text-medium-emphasis">—</span>
            </div>
          </template>

          <template v-slot:no-data>
            <div class="text-center pa-8">
              <Receipt class="w-10 h-10 text-medium-emphasis mb-2" />
              <div class="text-medium-emphasis">Không có dữ liệu đối soát</div>
            </div>
          </template>
        </v-data-table-server>
      </v-card>
    </div>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" timeout="3000" rounded="lg">
      <div class="font-weight-bold d-flex align-center">
        <Check v-if="snackbar.color === 'success'" class="w-5 h-5 mr-2" />
        <X v-else class="w-5 h-5 mr-2" />
        {{ snackbar.text }}
      </div>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.font-family-monospace { font-family: "Courier New", monospace; }
</style>