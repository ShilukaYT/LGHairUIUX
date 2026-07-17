<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";
import { useTheme } from "vuetify";
import { Plus, Pencil, Trash2, Eye, Search, Check, X, RotateCcw } from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;

// ── DARK / LIGHT MODE (đồng bộ với ProfileDD - Cài đặt Sáng/Tối) ──
const vuetifyTheme = useTheme();
const isDarkMode = computed(() => vuetifyTheme.global.name.value === "dark");

// ── DATA ──────────────────────────────────────────────────────────
const danhMucs = ref([]);
const loading = ref(false);
const saving = ref(false);

async function loadData() {
  loading.value = true;
  try {
    const res = await axios.get(`${API}/api/DanhMuc`, {
      params: {
        keyword: search.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    danhMucs.value = res.data.map((d) => ({
      maDM: d.maDM,
      tenDanhMuc: d.tenDanhMuc,
      ngayTao: d.ngayTao,
      trangThai: d.trangThai,
      soDichVu: d.soDichVu ?? 0,
    }));
  } catch {
    showToast("Lỗi tải danh mục!", "error");
  } finally {
    loading.value = false;
  }
}

// ── STATE ──────────────────────────────────────────────────────────
const search = ref("");
const filterStatus = ref("");
const editingId = ref(null);

const modal = reactive({ open: false, mode: "", title: "" });
const form = reactive({
  maDM: "",
  tenDanhMuc: "",
  trangThai: 1,
});
const errors = reactive({ maDM: "", tenDanhMuc: "" });
const confirmModal = reactive({ open: false, item: null });

// ── HEADERS cho v-data-table ═══════════════════════════════════════
const headers = [
  { title: "Mã DM", key: "maDM", align: "start", sortable: true },
  { title: "Tên danh mục", key: "tenDanhMuc", align: "start", sortable: true },
  { title: "Số dịch vụ", key: "soDichVu", align: "center", sortable: true },
  { title: "Ngày tạo", key: "ngayTao", align: "center", sortable: true },
  { title: "Trạng thái", key: "trangThai", align: "center", sortable: true },
  { title: "Thao tác", key: "actions", align: "center", sortable: false },
];

// ── COMPUTED ───────────────────────────────────────────────────────
const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  return danhMucs.value.filter((d) => {
    const mq =
      !q ||
      d.tenDanhMuc.toLowerCase().includes(q) ||
      d.maDM.toLowerCase().includes(q);
    const ms =
      filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
    return mq && ms;
  });
});

const statActive = computed(
  () => danhMucs.value.filter((d) => d.trangThai).length,
);
const statInactive = computed(
  () => danhMucs.value.filter((d) => !d.trangThai).length,
);
const statTotalDV = computed(() =>
  danhMucs.value.reduce((a, b) => a + b.soDichVu, 0),
);

function fmtDate(val) {
  if (!val) return "---";
  const d = new Date(val);
  return isNaN(d) ? val : d.toLocaleDateString("vi-VN");
}

// ── FILTER ─────────────────────────────────────────────────────────
function onFilterChange() {
  loadData();
}

// ── VALIDATE ───────────────────────────────────────────────────────
function clearErrors() {
  errors.maDM = "";
  errors.tenDanhMuc = "";
}

function validate() {
  clearErrors();
  let ok = true;
  if (!editingId.value) {
    if (!form.maDM.trim()) {
      errors.maDM = "Mã danh mục không được để trống.";
      ok = false;
    } else if (!/^[A-Za-z0-9]{2,10}$/.test(form.maDM.trim())) {
      errors.maDM = "Mã chỉ gồm chữ và số, 2–10 ký tự.";
      ok = false;
    } else if (
      danhMucs.value.find(
        (x) => x.maDM.toLowerCase() === form.maDM.trim().toLowerCase(),
      )
    ) {
      errors.maDM = "Mã danh mục đã tồn tại.";
      ok = false;
    }
  }
  if (!form.tenDanhMuc.trim()) {
    errors.tenDanhMuc = "Tên danh mục không được để trống.";
    ok = false;
  } else if (form.tenDanhMuc.trim().length < 2) {
    errors.tenDanhMuc = "Tên tối thiểu 2 ký tự.";
    ok = false;
  } else if (form.tenDanhMuc.trim().length > 100) {
    errors.tenDanhMuc = "Tên tối đa 100 ký tự.";
    ok = false;
  }
  return ok;
}

// ── MODAL ──────────────────────────────────────────────────────────
function openAdd() {
  editingId.value = null;
  clearErrors();
  Object.assign(form, {
    maDM: "",
    tenDanhMuc: "",
    trangThai: 1,
  });
  modal.mode = "form";
  modal.title = "Thêm danh mục mới";
  modal.open = true;
}

function openEdit(d) {
  editingId.value = d.maDM;
  clearErrors();
  Object.assign(form, {
    maDM: d.maDM,
    tenDanhMuc: d.tenDanhMuc,
    trangThai: d.trangThai,
  });
  modal.mode = "form";
  modal.title = "Chỉnh sửa danh mục";
  modal.open = true;
}

function openView(d) {
  Object.assign(form, { ...d });
  modal.mode = "view";
  modal.title = "Chi tiết danh mục";
  modal.open = true;
}

function closeModal() {
  modal.open = false;
  editingId.value = null;
}

// ── SAVE ───────────────────────────────────────────────────────────
async function saveItem() {
  if (!validate() || saving.value) return;
  saving.value = true;
  try {
    const fd = new FormData();
    if (!editingId.value) fd.append("MaDM", form.maDM.trim().toUpperCase());
    fd.append("TenDanhMuc", form.tenDanhMuc.trim());
    fd.append("TrangThai", String(form.trangThai));

    if (editingId.value) {
      await axios.put(`${API}/api/DanhMuc/${editingId.value}`, fd);
      logActivity("Cập nhật danh mục", `Đã cập nhật thông tin danh mục dịch vụ ${form.tenDanhMuc} (Mã: ${editingId.value})`, "Dịch vụ");
      showToast("Cập nhật danh mục thành công!");
    } else {
      await axios.post(`${API}/api/DanhMuc`, fd);
      logActivity("Thêm danh mục", `Đã thêm danh mục dịch vụ mới ${form.tenDanhMuc} (Mã: ${form.maDM.trim().toUpperCase()})`, "Dịch vụ");
      showToast("Thêm danh mục thành công!");
    }
    await loadData();
    closeModal();
  } catch (err) {
    const msg = err.response?.data?.message || "Lỗi khi lưu!";
    logActivity(
      editingId.value ? "Cập nhật danh mục" : "Thêm danh mục",
      `Thất bại khi ${editingId.value ? 'cập nhật' : 'thêm'} danh mục dịch vụ ${form.tenDanhMuc} - Lỗi: ${msg}`,
      "Dịch vụ",
      "Thất bại"
    );
    showToast(msg, "error");
  } finally {
    saving.value = false;
  }
}

// ── DELETE ─────────────────────────────────────────────────────────
function askDelete(d) {
  confirmModal.item = d;
  confirmModal.open = true;
}

async function confirmDelete() {
  const d = confirmModal.item;
  confirmModal.open = false;
  try {
    await axios.delete(`${API}/api/DanhMuc/${d.maDM}`);
    logActivity("Xóa danh mục", `Đã xóa danh mục dịch vụ ${d.tenDanhMuc} (Mã: ${d.maDM})`, "Dịch vụ");
    showToast(`Đã xóa danh mục "${d.tenDanhMuc}"`);
    await loadData();
  } catch (err) {
    const msg = err.response?.data?.message || "Lỗi khi xóa!";
    logActivity("Xóa danh mục", `Thất bại khi xóa danh mục dịch vụ ${d.tenDanhMuc} (Mã: ${d.maDM}) - Lỗi: ${msg}`, "Dịch vụ", "Thất bại");
    showToast(msg, "error");
  }
}

// ── TOGGLE TRẠNG THÁI nhanh ────────────────────────────────────────
async function toggleStatus(d) {
  const newStatus = d.trangThai ? 0 : 1;
  try {
    await axios.patch(`${API}/api/DanhMuc/${d.maDM}/trangthai`, {
      trangThai: newStatus,
    });
    logActivity(
      "Đổi trạng thái danh mục",
      `Đã chuyển trạng thái danh mục dịch vụ ${d.tenDanhMuc} (Mã: ${d.maDM}) sang ${newStatus ? 'Hoạt động' : 'Ngừng hoạt động'}`,
      "Dịch vụ"
    );
    d.trangThai = newStatus;
    showToast(newStatus ? "Đã kích hoạt danh mục." : "Đã ngừng danh mục.");
  } catch (err) {
    logActivity(
      "Đổi trạng thái danh mục",
      `Thất bại khi chuyển trạng thái danh mục dịch vụ ${d.tenDanhMuc} (Mã: ${d.maDM}) sang ${newStatus ? 'Hoạt động' : 'Ngừng hoạt động'} - Lỗi: ${err.message || ''}`,
      "Dịch vụ",
      "Thất bại"
    );
    showToast("Lỗi cập nhật trạng thái!", "error");
  }
}

// ── SNACKBAR (Vuetify) ═══════════════════════════════════════════════
const snackbar = ref({ show: false, text: "", color: "success" });
function showToast(msg, type = "success") {
  snackbar.value.text = msg;
  snackbar.value.color = type === "success" ? "success" : "error";
  snackbar.value.show = true;
}

onMounted(loadData);
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Danh Mục Dịch Vụ</h2>
          <div class="text-subtitle-2 text-medium-emphasis">
            {{ danhMucs.length }} danh mục · {{ statActive }} hoạt động · {{ statTotalDV }} dịch vụ
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openAdd"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm danh mục
          </v-btn>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadData">
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- ── STATS ──────────────────────────────────────────────── -->
      <v-card-text class="pb-0">
        <v-row dense>
          <v-col cols="6" md="3">
            <div class="stat-mini stat-gold">
              <div class="text-caption font-weight-medium text-uppercase">Tổng danh mục</div>
              <div class="text-h5 font-weight-bold">{{ danhMucs.length }}</div>
              <div class="text-caption text-medium-emphasis">{{ statActive }} đang hoạt động</div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-mini stat-green">
              <div class="text-caption font-weight-medium text-uppercase">Đang hoạt động</div>
              <div class="text-h5 font-weight-bold">{{ statActive }}</div>
              <div class="text-caption text-medium-emphasis">Hiển thị với khách</div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-mini stat-red">
              <div class="text-caption font-weight-medium text-uppercase">Ngừng hoạt động</div>
              <div class="text-h5 font-weight-bold">{{ statInactive }}</div>
              <div class="text-caption text-medium-emphasis">Đã ẩn khỏi danh sách</div>
            </div>
          </v-col>
          <v-col cols="6" md="3">
            <div class="stat-mini stat-blue">
              <div class="text-caption font-weight-medium text-uppercase">Tổng dịch vụ</div>
              <div class="text-h5 font-weight-bold">{{ statTotalDV }}</div>
              <div class="text-caption text-medium-emphasis">Trong tất cả danh mục</div>
            </div>
          </v-col>
        </v-row>
      </v-card-text>

      <!-- ── TOOLBAR ────────────────────────────────────────────── -->
      <v-card-text class="pb-0">
        <v-row dense>
          <v-col cols="12" md="5">
            <v-text-field
              v-model="search"
              label="Tìm kiếm danh mục..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              @keyup.enter="onFilterChange"
              @click:clear="onFilterChange"
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey-darken-1 mr-2" />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="6" md="3">
            <v-select
              v-model="filterStatus"
              :items="[{ title: 'Tất cả trạng thái', value: '' }, { title: 'Đang hoạt động', value: '1' }, { title: 'Ngừng hoạt động', value: '0' }]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              @update:model-value="onFilterChange"
            ></v-select>
          </v-col>
          <v-col cols="6" md="4" class="d-flex align-center">
            <span class="text-caption text-medium-emphasis">{{ filteredData.length }} kết quả</span>
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table
        :headers="headers"
        :items="filteredData"
        :loading="loading"
        items-per-page="10"
        item-value="maDM"
        hover
        class="mt-2"
      >
        <template v-slot:item.maDM="{ item }">
          <span class="text-caption font-weight-medium code-chip">{{ item.maDM }}</span>
        </template>

        <template v-slot:item.tenDanhMuc="{ item }">
          <div class="font-weight-medium">{{ item.tenDanhMuc }}</div>
        </template>

        <template v-slot:item.soDichVu="{ item }">
          <v-chip size="small" variant="tonal" color="info" class="font-weight-medium">
            {{ item.soDichVu }} dịch vụ
          </v-chip>
        </template>

        <template v-slot:item.ngayTao="{ item }">
          <span class="text-caption text-medium-emphasis">{{ fmtDate(item.ngayTao) }}</span>
        </template>

        <template v-slot:item.trangThai="{ item }">
          <v-chip
            :color="item.trangThai ? 'success' : 'error'"
            size="small"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            :title="item.trangThai ? 'Nhấn để ngừng' : 'Nhấn để kích hoạt'"
            @click="toggleStatus(item)"
          >
            {{ item.trangThai ? "Hoạt động" : "Ngừng" }}
          </v-chip>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <v-btn icon variant="text" size="small" color="primary" title="Xem chi tiết" @click="openView(item)">
              <Eye class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="warning" title="Chỉnh sửa" @click="openEdit(item)">
              <Pencil class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="error" title="Xóa" @click="askDelete(item)">
              <Trash2 class="w-4 h-4" />
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══ MODAL DANH MỤC (form + view) ══════════════════════════════ -->
    <v-dialog v-model="modal.open" max-width="560" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ modal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <!-- VIEW -->
          <template v-if="modal.mode === 'view'">
            <v-row>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="detail-label">Mã danh mục</div>
                  <span class="text-caption code-chip">{{ form.maDM }}</span>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="detail-label">Trạng thái</div>
                  <v-chip :color="form.trangThai ? 'success' : 'error'" size="small" variant="flat" class="font-weight-bold">
                    {{ form.trangThai ? "Hoạt động" : "Ngừng" }}
                  </v-chip>
                </div>
              </v-col>
              <v-col cols="12">
                <div class="detail-item">
                  <div class="detail-label">Tên danh mục</div>
                  <div class="text-h6 font-weight-bold">{{ form.tenDanhMuc }}</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="detail-label">Số dịch vụ</div>
                  <div class="font-weight-medium">{{ form.soDichVu ?? 0 }} dịch vụ</div>
                </div>
              </v-col>
              <v-col cols="6">
                <div class="detail-item">
                  <div class="detail-label">Ngày tạo</div>
                  <div class="font-weight-medium">{{ fmtDate(form.ngayTao) }}</div>
                </div>
              </v-col>
            </v-row>
          </template>

          <!-- FORM -->
          <v-form v-else @submit.prevent="saveItem">
            <v-row>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã danh mục *</div>
                <v-text-field
                  v-model="form.maDM"
                  variant="outlined" density="comfortable" rounded="lg"
                  :readonly="!!editingId"
                  placeholder="VD: DM001" maxlength="10"
                  :error-messages="errors.maDM"
                  @update:model-value="errors.maDM = ''"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Tên danh mục *</div>
                <v-text-field
                  v-model="form.tenDanhMuc"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: Cắt tóc" maxlength="100"
                  :error-messages="errors.tenDanhMuc"
                  @update:model-value="errors.tenDanhMuc = ''"
                ></v-text-field>
              </v-col>

              <v-col cols="12">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Trạng thái</div>
                <v-chip-group v-model="form.trangThai" mandatory selected-class="bg-primary text-white">
                  <v-chip :value="1" filter>Hoạt động</v-chip>
                  <v-chip :value="0" filter>Ngừng hoạt động</v-chip>
                </v-chip-group>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <template v-if="modal.mode === 'view'">
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closeModal">
              Đóng
            </v-btn>
            <v-btn
              variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary"
              @click="openEdit({ maDM: form.maDM, tenDanhMuc: form.tenDanhMuc, trangThai: form.trangThai, ngayTao: form.ngayTao, soDichVu: form.soDichVu })"
            >
              Chỉnh sửa
            </v-btn>
          </template>
          <template v-else>
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" :disabled="saving" @click="closeModal">
              Hủy
            </v-btn>
            <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary" :loading="saving" @click="saveItem">
              Lưu lại
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ CONFIRM DELETE ══════════════════════════════════════════ -->
    <v-dialog v-model="confirmModal.open" max-width="420">
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">Xác nhận xóa</div>
          <v-btn icon variant="text" size="small" @click="confirmModal.open = false">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>
        <v-card-text class="pa-6">
          <p class="text-body-2">
            Bạn có chắc muốn xóa danh mục
            <strong>{{ confirmModal.item?.tenDanhMuc }}</strong>?
          </p>
          <p class="text-caption text-medium-emphasis mt-2">
            ⚠️ Danh mục có dịch vụ liên kết sẽ không thể xóa.
          </p>
        </v-card-text>
        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="confirmModal.open = false">
            Hủy
          </v-btn>
          <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="error" @click="confirmDelete">
            Xóa
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ SNACKBAR ══════════════════════════════════════════════════ -->
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

.cursor-pointer { cursor: pointer; }
.code-chip {
  font-family: "Courier New", monospace;
  background: rgba(0,0,0,0.06);
  padding: 2px 7px;
  border-radius: 4px;
}

/* Mini stat cards */
.stat-mini { border-radius: 10px; padding: 12px 14px; }
.stat-gold  { background: #fffbeb; color: #92400e; }
.stat-green { background: #f0fdf4; color: #166534; }
.stat-red   { background: #fef2f2; color: #b91c1c; }
.stat-blue  { background: #eff6ff; color: #1e40af; }

/* Detail view */
.detail-item { background: rgba(0,0,0,0.03); border-radius: 8px; padding: 10px 12px; }
.detail-label { font-size: 11px; color: rgba(255,255,255,0.65); margin-bottom: 4px; }
</style>