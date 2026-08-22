<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { Search, RotateCcw, FileText } from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;

// ══ SNACKBAR (Vuetify) ══════════════════════════════════════════════
const snackbar = ref({ show: false, text: "", color: "success" });
const showSnackbar = (text: string, color: string = "success") => {
  snackbar.value.text = text;
  snackbar.value.color = color;
  snackbar.value.show = true;
};

// ══ HELPERS ═════════════════════════════════════════════════════════
function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("vi-VN");
}

/* ════════════════════════════════════════════════════════════════
   ĐỐI SOÁT KHO - HÓA ĐƠN SẢN PHẨM
   ════════════════════════════════════════════════════════════════ */
const doiSoatList = ref<any[]>([]);
const doiSoatTotal = ref(0);
const doiSoatStats = ref({ tongLuot: 0, daKhop: 0, chuaKhop: 0 });
const tuNgayDS = ref("");
const denNgayDS = ref("");
const filterTrangThaiDS = ref<string | null>(null);
const searchDS = ref("");
const curPageDS = ref(1);
const perPageDS = ref(20);
const loadingDS = ref(false);
let searchDebounceDS: ReturnType<typeof setTimeout> | null = null;

const trangThaiOptions = [
  { title: "Tất cả trạng thái", value: null },
  { title: "Đã có hóa đơn", value: "khop" },
  { title: "Chưa khớp hóa đơn", value: "thieu" },
];

const headers = [
  { title: "Thời gian", key: "thoiGian", align: "start" as const, sortable: true },
  { title: "Sản phẩm / Biến thể", key: "tenSanPham", align: "start" as const, sortable: true },
  { title: "SL bán", key: "soLuongThayDoi", align: "center" as const, sortable: true },
  { title: "Mã đơn hàng", key: "maDonHang", align: "center" as const, sortable: false },
  { title: "Trạng thái hóa đơn", key: "trangThaiHoaDon", align: "center" as const, sortable: true },
  { title: "Số hóa đơn", key: "soHoaDon", align: "center" as const, sortable: false },
  { title: "Hóa đơn PDF", key: "linkPdf", align: "center" as const, sortable: false },
] as const;

async function loadDoiSoat() {
  loadingDS.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/doisoathoadon`, {
      params: {
        tuNgay: tuNgayDS.value || null,
        denNgay: denNgayDS.value || null,
        trangThai: filterTrangThaiDS.value || null,
        search: searchDS.value.trim() || null,
        page: curPageDS.value,
        pageSize: perPageDS.value,
      },
    });
    doiSoatList.value = res.data.items || [];
    doiSoatTotal.value = res.data.total || 0;
    doiSoatStats.value = res.data.stats || { tongLuot: 0, daKhop: 0, chuaKhop: 0 };
  } catch {
    showSnackbar("Lỗi tải dữ liệu đối soát!", "error");
  } finally {
    loadingDS.value = false;
  }
}

function onFilterDSChange() {
  curPageDS.value = 1;
  loadDoiSoat();
}

function onSearchDSInput() {
  if (searchDebounceDS) clearTimeout(searchDebounceDS);
  searchDebounceDS = setTimeout(() => onFilterDSChange(), 350);
}

const tyLeKhopDS = computed(() => {
  const t = doiSoatStats.value.tongLuot;
  return t > 0 ? Math.round((doiSoatStats.value.daKhop / t) * 100) : 100;
});

// ══ INIT ════════════════════════════════════════════════════════════
onMounted(() => loadDoiSoat());
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">

      <!-- ── HEADER ─────────────────────────────────────────────── -->
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <FileText class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1">Đối Soát Hóa Đơn Sản Phẩm</h2>
            <div class="text-subtitle-2 text-medium-emphasis">
              Kiểm tra khớp giữa kho và hóa đơn điện tử
            </div>
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <!-- Tìm kiếm -->
          <v-text-field
            v-model="searchDS"
            label="Tìm mã đơn, biến thể, tên sản phẩm..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            class="flex-grow-1"
            style="min-width: 280px;"
            @update:model-value="onSearchDSInput"
          >
            <template v-slot:prepend-inner>
              <Search class="w-5 h-5 text-grey-darken-1 mr-2" />
            </template>
          </v-text-field>

          <!-- Nút làm mới -->
          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" :loading="loadingDS" @click="loadDoiSoat">
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <!-- ── STATS CARDS ─────────────────────────────────────────── -->
      <v-row class="px-6 pb-4" no-gutters>
        <v-col cols="12" sm="6" md="3" class="pa-2">
          <v-card rounded="lg" elevation="0" border class="pa-4" style="border-top: 3px solid #5c6bc0 !important;">
            <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-1">Tổng lượt bán</div>
            <div class="text-h5 font-weight-bold">{{ doiSoatStats.tongLuot }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Trong khoảng thời gian lọc</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3" class="pa-2">
          <v-card rounded="lg" elevation="0" border class="pa-4" style="border-top: 3px solid #22c55e !important;">
            <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-1">Đã có hóa đơn</div>
            <div class="text-h5 font-weight-bold text-success">{{ doiSoatStats.daKhop }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Xuất hóa đơn thành công</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3" class="pa-2">
          <v-card rounded="lg" elevation="0" border class="pa-4" style="border-top: 3px solid #ef4444 !important;">
            <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-1">Chưa khớp hóa đơn</div>
            <div class="text-h5 font-weight-bold text-error">{{ doiSoatStats.chuaKhop }}</div>
            <div class="text-caption text-medium-emphasis mt-1">Chưa xuất / lỗi / đang chờ</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="6" md="3" class="pa-2">
          <v-card rounded="lg" elevation="0" border class="pa-4" style="border-top: 3px solid #f59e0b !important;">
            <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-1">Tỷ lệ khớp</div>
            <div class="text-h5 font-weight-bold text-warning">{{ tyLeKhopDS }}%</div>
            <div class="text-caption text-medium-emphasis mt-1">Kho ↔ Hóa đơn điện tử</div>
          </v-card>
        </v-col>
      </v-row>

      <v-divider></v-divider>

      <!-- ── FILTER BAR ──────────────────────────────────────────── -->
      <div class="d-flex align-center flex-wrap gap-3 px-6 py-4">
        <v-text-field
          v-model="tuNgayDS"
          type="date"
          label="Từ ngày"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          style="max-width: 180px;"
          @update:model-value="onFilterDSChange"
        ></v-text-field>

        <v-text-field
          v-model="denNgayDS"
          type="date"
          label="Đến ngày"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          style="max-width: 180px;"
          @update:model-value="onFilterDSChange"
        ></v-text-field>

        <v-select
          v-model="filterTrangThaiDS"
          :items="trangThaiOptions"
          item-title="title"
          item-value="value"
          label="Trạng thái"
          variant="outlined"
          density="compact"
          hide-details
          rounded="lg"
          style="max-width: 220px;"
          @update:model-value="onFilterDSChange"
        ></v-select>

        <v-spacer></v-spacer>

        <span class="text-caption text-medium-emphasis font-weight-medium">
          {{ doiSoatTotal }} kết quả
        </span>
      </div>

      <v-divider></v-divider>

      <!-- ── DATA TABLE ──────────────────────────────────────────── -->
      <v-data-table
        :headers="headers"
        :items="doiSoatList"
        :loading="loadingDS"
        :items-per-page="perPageDS"
        hover
        no-data-text="Không có dữ liệu đối soát"
      >
        <!-- Cột: Thời gian -->
        <template v-slot:item.thoiGian="{ item }">
          <div class="font-weight-medium text-no-wrap">{{ fmtDateTime(item.thoiGian) }}</div>
        </template>

        <!-- Cột: Sản phẩm / Biến thể -->
        <template v-slot:item.tenSanPham="{ item }">
          <div class="py-2">
            <div class="font-weight-bold">{{ item.tenSanPham || "—" }}</div>
            <div class="d-flex align-center gap-2 mt-1">
              <span class="text-caption text-medium-emphasis">{{ item.tenBienThe }}</span>
              <v-chip v-if="item.maBienThe" size="x-small" variant="tonal" color="primary" class="font-weight-bold">
                {{ item.maBienThe }}
              </v-chip>
            </div>
          </div>
        </template>

        <!-- Cột: Số lượng -->
        <template v-slot:item.soLuongThayDoi="{ item }">
          <v-chip color="error" size="small" variant="flat" class="font-weight-bold">
            {{ item.soLuongThayDoi }}
          </v-chip>
        </template>

        <!-- Cột: Mã đơn hàng -->
        <template v-slot:item.maDonHang="{ item }">
          <v-chip v-if="item.maDonHang" size="small" variant="tonal" color="grey-darken-1" class="font-weight-bold font-mono">
            {{ item.maDonHang }}
          </v-chip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- Cột: Trạng thái hóa đơn -->
        <template v-slot:item.trangThaiHoaDon="{ item }">
          <v-chip
            v-if="item.trangThaiHoaDon === 1"
            color="success" size="small" variant="flat" class="font-weight-bold"
          >Đã xuất</v-chip>
          <v-chip
            v-else-if="item.trangThaiHoaDon === 2"
            color="error" size="small" variant="flat" class="font-weight-bold"
            :title="item.ghiChuLoi"
          >Lỗi</v-chip>
          <v-chip
            v-else-if="item.coHoaDon"
            color="warning" size="small" variant="flat" class="font-weight-bold"
          >Đang chờ</v-chip>
          <v-chip
            v-else
            color="grey-darken-2" size="small" variant="tonal" class="font-weight-bold"
          >Không xuất HĐ</v-chip>
        </template>

        <!-- Cột: Số hóa đơn -->
        <template v-slot:item.soHoaDon="{ item }">
          <span v-if="item.soHoaDon" class="font-weight-medium">{{ item.soHoaDon }}</span>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- Cột: PDF -->
        <template v-slot:item.linkPdf="{ item }">
          <v-btn
            v-if="item.linkPdf"
            :href="item.linkPdf"
            target="_blank"
            color="primary"
            variant="tonal"
            size="small"
            rounded="lg"
            class="text-none font-weight-bold"
          >
            <template v-slot:prepend>
              <FileText class="w-4 h-4 mr-1" />
            </template>
            Xem PDF
          </v-btn>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <!-- Empty state -->
        <template v-slot:no-data>
          <div class="d-flex flex-column align-center justify-center py-12">
            <span style="font-size: 40px;">🧾</span>
            <div class="text-h6 font-weight-bold mt-3">Không có dữ liệu đối soát</div>
            <div class="text-caption text-medium-emphasis mt-1">Thử thay đổi bộ lọc hoặc khoảng thời gian</div>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══ SNACKBAR ═══════════════════════════════════════════════ -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" timeout="3000" rounded="lg">
      <div class="font-weight-bold">{{ snackbar.text }}</div>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.gap-3 { gap: 12px; }
.gap-2 { gap: 8px; }
.font-mono { font-family: "Courier New", monospace; }
</style>
