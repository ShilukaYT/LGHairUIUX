<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";
import { useTheme } from "vuetify";
import {
  Plus, Pencil, Trash2, Eye, Search, ImageOff, X, Check, RotateCcw, Upload,
  ChevronDown, ImagePlus, Images,
} from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;

// ── DARK / LIGHT MODE (đồng bộ với ProfileDD - Cài đặt Sáng/Tối) ──
const vuetifyTheme = useTheme();
const isDarkMode = computed(() => vuetifyTheme.global.name.value === "dark");

function toAbsUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

// ══ DATA ══════════════════════════════════════════════════════════
const danhMucs = ref([]);
const isLoading = ref(false);

// ══ STATE ══════════════════════════════════════════════════════════
const search = ref("");
const filterStatus = ref("");
const saving = ref(false);

// ══ MODAL ══════════════════════════════════════════════════════════
const modal = reactive({ open: false, mode: "", title: "" });
const editingId = ref(null);
const form = reactive({
  maDMSP: "", tenDanhMuc: "", hinhAnh: "", trangThai: 1,
  _newImgFile: null,
});
const imgInput = ref(null);

// ══ VALIDATION ════════════════════════════════════════════════════
const errors  = reactive({ maDMSP: "", tenDanhMuc: "" });
const touched = reactive({ maDMSP: false, tenDanhMuc: false });

function clearErrors() {
  Object.keys(errors).forEach(k => errors[k] = "");
  Object.keys(touched).forEach(k => touched[k] = false);
}

// Validate từng field riêng lẻ — dùng cho cả blur và submit
function validateField(field) {
  if (field === "maDMSP" && !editingId.value) {
    const val = form.maDMSP.trim();
    if (!val)
      errors.maDMSP = "Mã danh mục không được để trống.";
    else if (val.length < 2 || val.length > 10)
      errors.maDMSP = "Mã phải từ 2 đến 10 ký tự.";
    else if (!/^[A-Za-z0-9]+$/.test(val))
      errors.maDMSP = "Mã chỉ được chứa chữ cái (A–Z) và chữ số (0–9), không dấu, không khoảng trắng.";
    else if (danhMucs.value.find(x => x.maDMSP.toUpperCase() === val.toUpperCase()))
      errors.maDMSP = "Mã danh mục này đã tồn tại trong hệ thống.";
    else
      errors.maDMSP = "";
  }

  if (field === "tenDanhMuc") {
    const val = form.tenDanhMuc.trim();
    if (!val)
      errors.tenDanhMuc = "Tên danh mục không được để trống.";
    else if (val.length < 2)
      errors.tenDanhMuc = "Tên phải có ít nhất 2 ký tự.";
    else if (val.length > 100)
      errors.tenDanhMuc = "Tên không được vượt quá 100 ký tự.";
    else if (/[<>{}[\]\\\/]/.test(val))
      errors.tenDanhMuc = "Tên chứa ký tự không hợp lệ (< > { } [ ] \\ /).";
    else {
      // Kiểm tra trùng tên (bỏ qua chính nó khi edit)
      const dup = danhMucs.value.find(x =>
        x.tenDanhMuc?.trim().toLowerCase() === val.toLowerCase() &&
        x.maDMSP !== editingId.value
      );
      errors.tenDanhMuc = dup ? `Tên "${val}" đã được dùng cho danh mục "${dup.maDMSP}".` : "";
    }
  }
}

function onBlur(field) {
  touched[field] = true;
  validateField(field);
}

function validate() {
  // Mark all touched để show lỗi đồng loạt
  Object.keys(touched).forEach(k => touched[k] = true);
  if (!editingId.value) validateField("maDMSP");
  validateField("tenDanhMuc");
  return !errors.maDMSP && !errors.tenDanhMuc;
}

// Char counter
const tenDanhMucLength = computed(() => form.tenDanhMuc.trim().length);

// ══ IMAGE HELPERS ═════════════════════════════════════════════════
function readFileAsPreview(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject("not_image"); return; }
    if (file.size > 5 * 1024 * 1024) { reject("too_large"); return; }
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

async function onImgChange(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    const src = await readFileAsPreview(file);
    form.hinhAnh = src;
    form._newImgFile = file;
  } catch (err) {
    showToast(err === "too_large" ? "File vượt quá 5MB!" : "File không phải ảnh!", "error");
  }
  e.target.value = "";
}

function removeImg() {
  form.hinhAnh = "";
  form._newImgFile = null;
}

// ══ LOAD DATA ═════════════════════════════════════════════════════
async function loadData() {
  isLoading.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyDanhMucSP`);
    danhMucs.value = res.data.map(d => ({
      maDMSP: d.maDMSP,
      tenDanhMuc: d.tenDanhMuc,
      hinhAnh: toAbsUrl(d.hinhAnh),
      trangThai: d.trangThai ?? 1,
      soSanPham: d.soSanPham ?? 0,
    }));
  } catch { showToast("Lỗi tải danh sách danh mục!", "error"); }
  finally { isLoading.value = false; }
}

// ══ SNACKBAR (Vuetify) ═════════════════════════════════════════════
const snackbar = ref({ show: false, text: "", color: "success" });
function showToast(msg, type = "success") {
  snackbar.value.text = msg;
  snackbar.value.color = type === "success" ? "success" : "error";
  snackbar.value.show = true;
}

// ══ LIGHTBOX ══════════════════════════════════════════════════════
const lightbox = reactive({ open: false, src: "" });
function openLightbox(src) { lightbox.src = src; lightbox.open = true; }

// ══ COMPUTED ══════════════════════════════════════════════════════
const totalActive = computed(() => danhMucs.value.filter(d => d.trangThai === 1).length);
const totalProducts = computed(() => danhMucs.value.reduce((s, d) => s + (d.soSanPham ?? 0), 0));

const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  return danhMucs.value.filter(d => {
    const mq = !q || d.tenDanhMuc.toLowerCase().includes(q) || d.maDMSP.toLowerCase().includes(q);
    const ms = filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
    return mq && ms;
  });
});

// ══ HEADERS cho v-data-table ═══════════════════════════════════════
const headers = [
  { title: "Ảnh", key: "hinhAnh", align: "center", sortable: false, width: 70 },
  { title: "Mã DM", key: "maDMSP", align: "start", sortable: true },
  { title: "Tên danh mục", key: "tenDanhMuc", align: "start", sortable: true },
  { title: "Số SP", key: "soSanPham", align: "center", sortable: true },
  { title: "Trạng thái", key: "trangThai", align: "center", sortable: true },
  { title: "Banner", key: "banner", align: "center", sortable: false, width: 90 },
  { title: "Thao tác", key: "actions", align: "center", sortable: false },
];

// ══ HELPERS ═══════════════════════════════════════════════════════
const CAT_COLORS = ["blue", "purple", "orange", "green", "amber-darken-2"];
function getCatColor(maDMSP) {
  const idx = danhMucs.value.findIndex(x => x.maDMSP === maDMSP);
  return CAT_COLORS[idx % CAT_COLORS.length] ?? "blue";
}

// ══ MODAL ACTIONS ══════════════════════════════════════════════════
function resetForm() {
  Object.assign(form, {
    maDMSP: "", tenDanhMuc: "", hinhAnh: "", trangThai: 1, _newImgFile: null,
  });
}

function openAdd() {
  editingId.value = null; clearErrors(); resetForm();
  modal.mode = "form"; modal.title = "Thêm danh mục mới"; modal.open = true;
}

function openEdit(dm) {
  editingId.value = dm.maDMSP; clearErrors();
  Object.assign(form, {
    maDMSP: dm.maDMSP, tenDanhMuc: dm.tenDanhMuc,
    hinhAnh: dm.hinhAnh, trangThai: dm.trangThai, _newImgFile: null,
  });
  modal.mode = "form"; modal.title = "Chỉnh sửa danh mục"; modal.open = true;
}

function openView(dm) {
  editingId.value = dm.maDMSP;
  Object.assign(form, { ...dm, _newImgFile: null });
  modal.mode = "view"; modal.title = "Chi tiết danh mục"; modal.open = true;
}

function closeModal() { modal.open = false; }

async function saveDM() {
  if (!validate()) {
    showToast("Vui lòng kiểm tra lại thông tin trong form.", "error");
    return;
  }
  saving.value = true;
  try {
    const fd = new FormData();
    fd.append("TenDanhMuc", form.tenDanhMuc.trim());
    fd.append("TrangThai", form.trangThai);
    if (form._newImgFile) fd.append("File", form._newImgFile);

    if (editingId.value) {
      await axios.put(`${API}/api/QuanLyDanhMucSP/${editingId.value}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      logActivity("Cập nhật danh mục sản phẩm", `Đã cập nhật danh mục sản phẩm ${form.tenDanhMuc} (Mã: ${editingId.value})`, "Sản phẩm");
      showToast("Cập nhật danh mục thành công!");
    } else {
      const maDMSPUpper = form.maDMSP.trim().toUpperCase();
      fd.append("MaDMSP", maDMSPUpper);
      await axios.post(`${API}/api/QuanLyDanhMucSP`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      logActivity("Thêm danh mục sản phẩm", `Đã thêm danh mục sản phẩm mới ${form.tenDanhMuc} (Mã: ${maDMSPUpper})`, "Sản phẩm");
      showToast("Thêm danh mục thành công!");
    }
    closeModal(); await loadData();
  } catch (e) {
    const status = e.response?.status;
    const msg    = e.response?.data?.message ?? "";

    logActivity(
      editingId.value ? "Cập nhật danh mục sản phẩm" : "Thêm danh mục sản phẩm",
      `Thất bại khi ${editingId.value ? 'cập nhật' : 'thêm'} danh mục sản phẩm ${form.tenDanhMuc} - Lỗi: ${msg || e.message || ''}`,
      "Sản phẩm",
      "Thất bại"
    );

    if (status === 409 || msg.toLowerCase().includes("mã")) {
      errors.maDMSP = msg || "Mã danh mục đã tồn tại trên server.";
      touched.maDMSP = true;
    } else if (msg.toLowerCase().includes("tên")) {
      errors.tenDanhMuc = msg;
      touched.tenDanhMuc = true;
    } else if (status === 400 && msg.toLowerCase().includes("ảnh")) {
      showToast(msg, "error");
    } else {
      showToast(msg || "Lỗi không xác định, vui lòng thử lại!", "error");
    }
  } finally { saving.value = false; }
}

async function deleteDM(dm) {
  if (!confirm(`Xóa danh mục "${dm.tenDanhMuc}"?\nLưu ý: danh mục có sản phẩm sẽ không xóa được.`)) return;
  try {
    await axios.delete(`${API}/api/QuanLyDanhMucSP/${dm.maDMSP}`);
    logActivity("Xóa danh mục sản phẩm", `Đã xóa danh mục sản phẩm ${dm.tenDanhMuc} (Mã: ${dm.maDMSP})`, "Sản phẩm");
    showToast("Đã xóa danh mục!");
    await loadData();
  } catch (e) {
    const msg = e.response?.data?.message ?? "Lỗi khi xóa danh mục!";
    logActivity("Xóa danh mục sản phẩm", `Thất bại khi xóa danh mục sản phẩm ${dm.tenDanhMuc} (Mã: ${dm.maDMSP}) - Lỗi: ${msg}`, "Sản phẩm", "Thất bại");
    showToast(msg, "error");
  }
}

async function toggleStatus(dm) {
  const newStatus = dm.trangThai === 1 ? 0 : 1;
  try {
    await axios.patch(`${API}/api/QuanLyDanhMucSP/${dm.maDMSP}/trangthai`, { trangThai: newStatus });
    logActivity(
      "Đổi trạng thái danh mục sản phẩm",
      `Đã chuyển trạng thái danh mục sản phẩm ${dm.tenDanhMuc} (Mã: ${dm.maDMSP}) sang ${newStatus === 1 ? 'Đang hiện' : 'Tạm ẩn'}`,
      "Sản phẩm"
    );
    await loadData();
    showToast("Đã cập nhật trạng thái!");
  } catch (err) {
    logActivity(
      "Đổi trạng thái danh mục sản phẩm",
      `Thất bại khi chuyển trạng thái danh mục sản phẩm ${dm.tenDanhMuc} (Mã: ${dm.maDMSP}) sang ${newStatus === 1 ? 'Đang hiện' : 'Tạm ẩn'} - Lỗi: ${err.message || ''}`,
      "Sản phẩm",
      "Thất bại"
    );
    showToast("Lỗi cập nhật trạng thái!", "error");
  }
}

// ══ BANNER DANH MỤC ═══════════════════════════════════════════════
// menu.open: mã danh mục đang mở dropdown banner (null = đóng tất cả)
const bannerMenu = reactive({ openFor: null });
const bannerCache = reactive({}); // { [maDMSP]: [{ maBanner, tieuDe, hinhAnh }] }
const bannerLoading = reactive({}); // { [maDMSP]: boolean }
const bannerUploading = reactive({}); // { [maDMSP]: boolean }
const bannerFileInputs = reactive({}); // refs cho input file ẩn theo maDMSP

async function loadBanners(maDMSP) {
  bannerLoading[maDMSP] = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyDanhMucSP/banner/danh-sach/${maDMSP}`);
    bannerCache[maDMSP] = res.data.map(b => ({
      maBanner: b.maBanner,
      tieuDe: b.tieuDe,
      hinhAnh: toAbsUrl(b.hinhAnh),
    }));
  } catch {
    showToast("Lỗi tải banner của danh mục!", "error");
    bannerCache[maDMSP] = bannerCache[maDMSP] ?? [];
  } finally {
    bannerLoading[maDMSP] = false;
  }
}

function toggleBannerMenu(dm) {
  const isOpening = bannerMenu.openFor !== dm.maDMSP;
  bannerMenu.openFor = isOpening ? dm.maDMSP : null;
  if (isOpening && !bannerCache[dm.maDMSP]) {
    loadBanners(dm.maDMSP);
  }
}

function setBannerFileInputRef(maDMSP, el) {
  if (el) bannerFileInputs[maDMSP] = el;
}

function triggerBannerUpload(maDMSP) {
  bannerFileInputs[maDMSP]?.click();
}

async function onBannerFileChange(e, maDMSP) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("File không phải ảnh!", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("File vượt quá 5MB!", "error");
    return;
  }

  bannerUploading[maDMSP] = true;
  try {
    const fd = new FormData();
    fd.append("MaDanhMucCha", maDMSP);
    fd.append("File", file);
    await axios.post(`${API}/api/QuanLyDanhMucSP/banner`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    logActivity("Thêm banner danh mục", `Đã thêm banner cho danh mục (Mã: ${maDMSP})`, "Sản phẩm");
    showToast("Thêm banner thành công!");
    await loadBanners(maDMSP);
  } catch (err) {
    const msg = err.response?.data?.message ?? "Lỗi khi thêm banner!";
    logActivity("Thêm banner danh mục", `Thất bại khi thêm banner cho danh mục (Mã: ${maDMSP}) - Lỗi: ${msg}`, "Sản phẩm", "Thất bại");
    showToast(msg, "error");
  } finally {
    bannerUploading[maDMSP] = false;
  }
}

async function replaceBannerImg(e, banner, maDMSP) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("File không phải ảnh!", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("File vượt quá 5MB!", "error");
    return;
  }

  bannerUploading[maDMSP] = true;
  try {
    const fd = new FormData();
    fd.append("File", file);
    await axios.put(`${API}/api/QuanLyDanhMucSP/banner/${banner.maBanner}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    logActivity("Cập nhật banner danh mục", `Đã cập nhật banner ${banner.maBanner}`, "Sản phẩm");
    showToast("Cập nhật banner thành công!");
    await loadBanners(maDMSP);
  } catch (err) {
    const msg = err.response?.data?.message ?? "Lỗi khi cập nhật banner!";
    logActivity("Cập nhật banner danh mục", `Thất bại khi cập nhật banner ${banner.maBanner} - Lỗi: ${msg}`, "Sản phẩm", "Thất bại");
    showToast(msg, "error");
  } finally {
    bannerUploading[maDMSP] = false;
  }
}

async function deleteBanner(banner, maDMSP) {
  if (!confirm(`Xóa banner "${banner.maBanner}"?`)) return;
  try {
    await axios.delete(`${API}/api/QuanLyDanhMucSP/banner/${banner.maBanner}`);
    logActivity("Xóa banner danh mục", `Đã xóa banner ${banner.maBanner}`, "Sản phẩm");
    showToast("Đã xóa banner!");
    await loadBanners(maDMSP);
  } catch (err) {
    const msg = err.response?.data?.message ?? "Lỗi khi xóa banner!";
    logActivity("Xóa banner danh mục", `Thất bại khi xóa banner ${banner.maBanner} - Lỗi: ${msg}`, "Sản phẩm", "Thất bại");
    showToast(msg, "error");
  }
}

// ══ INIT ══════════════════════════════════════════════════════════
onMounted(loadData);
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Danh Mục Sản Phẩm</h2>
          <div class="text-subtitle-2 text-medium-emphasis">
            {{ danhMucs.length }} danh mục · {{ totalActive }} đang hiện · {{ totalProducts }} sản phẩm
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

      <!-- ── TOOLBAR ────────────────────────────────────────────── -->
      <v-card-text class="pb-0">
        <v-row dense>
          <v-col cols="12" md="5">
            <v-text-field
              v-model="search"
              label="Tìm tên, mã danh mục..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey-darken-1 mr-2" />
              </template>
            </v-text-field>
          </v-col>
          <v-col cols="6" md="3">
            <v-select
              v-model="filterStatus"
              :items="[{ title: 'Tất cả trạng thái', value: '' }, { title: 'Đang hoạt động', value: '1' }, { title: 'Tạm ẩn', value: '0' }]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
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
        :loading="isLoading"
        items-per-page="10"
        item-value="maDMSP"
        hover
        class="mt-2"
      >
        <template v-slot:item.hinhAnh="{ item }">
          <div class="d-flex justify-center py-2">
            <v-avatar
              rounded="lg"
              size="42"
              class="cursor-pointer"
              @click="item.hinhAnh && openLightbox(item.hinhAnh)"
            >
              <v-img v-if="item.hinhAnh" :src="item.hinhAnh" cover></v-img>
              <ImageOff v-else class="w-4 h-4 text-grey" />
            </v-avatar>
          </div>
        </template>

        <template v-slot:item.maDMSP="{ item }">
          <span class="text-caption font-weight-medium code-chip">{{ item.maDMSP }}</span>
        </template>

        <template v-slot:item.tenDanhMuc="{ item }">
          <div class="font-weight-medium">{{ item.tenDanhMuc }}</div>
          <v-chip :color="getCatColor(item.maDMSP)" size="x-small" variant="tonal" class="font-weight-medium mt-1">
            {{ item.maDMSP }}
          </v-chip>
        </template>

        <template v-slot:item.soSanPham="{ item }">
          <v-chip size="small" variant="tonal" color="info" class="font-weight-medium">
            {{ item.soSanPham }} sản phẩm
          </v-chip>
        </template>

        <template v-slot:item.trangThai="{ item }">
          <v-chip
            :color="item.trangThai === 1 ? 'success' : 'grey-darken-1'"
            size="small"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            :title="item.trangThai === 1 ? 'Nhấn để tạm ẩn' : 'Nhấn để kích hoạt'"
            @click="toggleStatus(item)"
          >
            {{ item.trangThai === 1 ? "Đang hiện" : "Tạm ẩn" }}
          </v-chip>
        </template>

        <template v-slot:item.banner="{ item }">
          <div class="d-flex justify-center">
            <v-menu
              :model-value="bannerMenu.openFor === item.maDMSP"
              @update:model-value="(val) => { if (!val) bannerMenu.openFor = null; }"
              :close-on-content-click="false"
              location="bottom"
              min-width="320"
            >
              <template v-slot:activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  variant="tonal"
                  size="small"
                  rounded="lg"
                  color="deep-purple"
                  class="text-none"
                  @click="toggleBannerMenu(item)"
                >
                  <Images class="w-4 h-4 mr-1" />
                  Banner
                  <ChevronDown class="w-3 h-3 ml-1" :class="{ 'rotate-180': bannerMenu.openFor === item.maDMSP }" style="transition: transform .15s;" />
                </v-btn>
              </template>

              <v-card rounded="lg" class="pa-3" min-width="320" max-width="360">
                <div class="d-flex align-center justify-space-between mb-2">
                  <span class="text-subtitle-2 font-weight-bold">
                    Banner của "{{ item.tenDanhMuc }}"
                  </span>
                  <v-chip size="x-small" variant="tonal" color="deep-purple">
                    {{ bannerCache[item.maDMSP]?.length ?? 0 }}
                  </v-chip>
                </div>

                <div v-if="bannerLoading[item.maDMSP]" class="d-flex justify-center py-4">
                  <v-progress-circular indeterminate color="deep-purple" size="24"></v-progress-circular>
                </div>

                <div v-else>
                  <div v-if="!bannerCache[item.maDMSP]?.length" class="text-caption text-medium-emphasis text-center py-3">
                    Chưa có banner nào cho danh mục này.
                  </div>

                  <div v-else class="banner-list mb-2">
                    <div v-for="b in bannerCache[item.maDMSP]" :key="b.maBanner" class="banner-row">
                      <v-avatar rounded="lg" size="48" class="cursor-pointer" @click="openLightbox(b.hinhAnh)">
                        <v-img v-if="b.hinhAnh" :src="b.hinhAnh" cover></v-img>
                        <ImageOff v-else class="w-4 h-4 text-grey" />
                      </v-avatar>
                      <div class="banner-info">
                        <span class="text-caption font-weight-medium code-chip">{{ b.maBanner }}</span>
                        <span class="text-caption text-truncate d-block" style="max-width: 140px;">{{ b.tieuDe }}</span>
                      </div>
                      <div class="d-flex align-center gap-1">
                        <input
                          type="file" accept="image/*" style="display:none"
                          :ref="el => setBannerFileInputRef(item.maDMSP + '_' + b.maBanner, el)"
                          @change="(e) => replaceBannerImg(e, b, item.maDMSP)"
                        />
                        <v-btn
                          icon variant="text" size="x-small" color="warning" title="Đổi ảnh"
                          :loading="bannerUploading[item.maDMSP]"
                          @click="bannerFileInputs[item.maDMSP + '_' + b.maBanner]?.click()"
                        >
                          <Pencil class="w-3 h-3" />
                        </v-btn>
                        <v-btn icon variant="text" size="x-small" color="error" title="Xóa banner" @click="deleteBanner(b, item.maDMSP)">
                          <Trash2 class="w-3 h-3" />
                        </v-btn>
                      </div>
                    </div>
                  </div>
                </div>

                <v-divider class="my-2"></v-divider>

                <input
                  type="file" accept="image/*" style="display:none"
                  :ref="el => setBannerFileInputRef(item.maDMSP, el)"
                  @change="(e) => onBannerFileChange(e, item.maDMSP)"
                />
                <v-btn
                  block variant="outlined" rounded="lg" size="small"
                  color="deep-purple" class="text-none font-weight-bold"
                  :loading="bannerUploading[item.maDMSP]"
                  @click="triggerBannerUpload(item.maDMSP)"
                >
                  <ImagePlus class="w-4 h-4 mr-1" />
                  Thêm banner
                </v-btn>
              </v-card>
            </v-menu>
          </div>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <v-btn icon variant="text" size="small" color="primary" title="Xem" @click="openView(item)">
              <Eye class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="warning" title="Sửa" @click="openEdit(item)">
              <Pencil class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="error" title="Xóa" @click="deleteDM(item)">
              <Trash2 class="w-4 h-4" />
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══ MODAL DANH MỤC ══════════════════════════════════════════ -->
    <v-dialog v-model="modal.open" max-width="560" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ modal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <!-- VIEW MODE -->
          <template v-if="modal.mode === 'view'">
            <v-row>
              <v-col cols="12" sm="4" class="d-flex justify-center">
                <v-avatar
                  rounded="lg"
                  size="120"
                  class="cursor-pointer"
                  @click="form.hinhAnh && openLightbox(form.hinhAnh)"
                >
                  <v-img v-if="form.hinhAnh" :src="form.hinhAnh" cover></v-img>
                  <ImageOff v-else class="w-8 h-8 text-grey" />
                </v-avatar>
              </v-col>
              <v-col cols="12" sm="8">
                <div class="detail-row"><span class="detail-label">Mã danh mục</span><span class="text-caption code-chip">{{ form.maDMSP }}</span></div>
                <div class="detail-row"><span class="detail-label">Tên danh mục</span><span class="font-weight-medium">{{ form.tenDanhMuc }}</span></div>
                <div class="detail-row">
                  <span class="detail-label">Số sản phẩm</span>
                  <v-chip color="info" size="small" variant="tonal">{{ form.soSanPham ?? 0 }} sản phẩm</v-chip>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Trạng thái</span>
                  <v-chip :color="form.trangThai === 1 ? 'success' : 'grey-darken-1'" size="small" variant="flat" class="font-weight-bold">
                    {{ form.trangThai === 1 ? "Đang hiện" : "Tạm ẩn" }}
                  </v-chip>
                </div>
              </v-col>
            </v-row>
          </template>

          <!-- FORM MODE -->
          <v-form v-else @submit.prevent="saveDM">
            <!-- Mã danh mục (chỉ khi thêm mới) -->
            <div v-if="!editingId" class="mb-4">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã danh mục *</div>
              <v-text-field
                v-model="form.maDMSP"
                variant="outlined" density="comfortable" rounded="lg"
                placeholder="Ví dụ: DM001" maxlength="10"
                autocomplete="off"
                :error-messages="touched.maDMSP ? errors.maDMSP : ''"
                @blur="onBlur('maDMSP')"
                @update:model-value="touched.maDMSP && validateField('maDMSP')"
              ></v-text-field>
            </div>

            <!-- Tên danh mục -->
            <div class="mb-4">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2 d-flex align-center">
                <span>Tên danh mục *</span>
                <span
                  class="ml-auto text-caption"
                  :class="{ 'text-warning': tenDanhMucLength > 80 && tenDanhMucLength <= 100, 'text-error font-weight-bold': tenDanhMucLength > 100 }"
                >{{ tenDanhMucLength }}/100</span>
              </div>
              <v-text-field
                v-model="form.tenDanhMuc"
                variant="outlined" density="comfortable" rounded="lg"
                placeholder="Nhập tên danh mục..." maxlength="100"
                autocomplete="off"
                :error-messages="touched.tenDanhMuc ? errors.tenDanhMuc : ''"
                @blur="onBlur('tenDanhMuc')"
                @update:model-value="touched.tenDanhMuc && validateField('tenDanhMuc')"
              ></v-text-field>
            </div>

            <!-- Trạng thái -->
            <div class="mb-4">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Trạng thái</div>
              <v-select
                v-model="form.trangThai"
                :items="[
                  { title: 'Đang hiện — hiển thị cho khách hàng', value: 1 },
                  { title: 'Tạm ẩn — không hiển thị cho khách hàng', value: 0 },
                ]"
                variant="outlined" density="comfortable" rounded="lg"
              ></v-select>
            </div>

            <!-- Hình ảnh -->
            <div>
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">
                Hình ảnh đại diện <span class="text-caption text-medium-emphasis font-weight-regular">(không bắt buộc)</span>
              </div>
              <input ref="imgInput" type="file" accept="image/*" style="display:none" @change="onImgChange" />
              <div class="upload-zone" @click="imgInput?.click()">
                <div v-if="!form.hinhAnh" class="upload-placeholder">
                  <Upload class="w-6 h-6" />
                  <span>Nhấn để chọn ảnh</span>
                  <span class="text-caption text-medium-emphasis">PNG, JPG, WEBP – tối đa 5MB</span>
                </div>
                <div v-else class="upload-preview-single" @click.stop>
                  <v-img :src="form.hinhAnh" width="90" height="90" cover rounded="lg" class="border"></v-img>
                  <v-btn icon size="x-small" color="error" class="remove-single-img" title="Xóa ảnh" @click.stop="removeImg">
                    <X class="w-3 h-3" />
                  </v-btn>
                </div>
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closeModal">
            Hủy
          </v-btn>
          <v-btn
            v-if="modal.mode === 'form'"
            variant="flat" rounded="lg" class="text-none font-weight-bold"
            color="primary" :loading="saving" @click="saveDM"
          >
            {{ editingId ? "Cập nhật" : "Thêm mới" }}
          </v-btn>
          <v-btn
            v-if="modal.mode === 'view'"
            variant="tonal" rounded="lg" class="text-none font-weight-bold"
            color="primary" @click="openEdit(form)"
          >
            Chỉnh sửa
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ LIGHTBOX ══════════════════════════════════════════════════ -->
    <v-dialog v-model="lightbox.open" max-width="900">
      <div class="lb-overlay-content">
        <v-btn icon color="white" variant="text" class="lb-close" @click="lightbox.open = false">
          <X class="w-5 h-5" />
        </v-btn>
        <img :src="lightbox.src" class="lb-img" />
      </div>
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

/* Detail view rows */
.detail-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.detail-label { font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.7); min-width: 120px; }

/* Upload zone */
.upload-zone {
  border: 1.5px dashed #cbd5e1;
  border-radius: 10px;
  background: #f9fafb;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 110px;
  transition: all 0.15s;
}
.upload-zone:hover { background: #f1f5f9; border-color: #94a3b8; }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #9ca3af; font-size: 12px; }
.upload-preview-single { position: relative; display: inline-block; }
.remove-single-img { position: absolute; top: -8px; right: -8px; }

/* Banner dropdown */
.banner-list { max-height: 260px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.banner-row { display: flex; align-items: center; gap: 10px; padding: 4px; border-radius: 8px; }
.banner-row:hover { background: rgba(0,0,0,0.04); }
.banner-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.rotate-180 { transform: rotate(180deg); }

/* Lightbox */
.lb-overlay-content { position: relative; display: flex; align-items: center; justify-content: center; min-height: 50vh; }
.lb-img { max-width: 90vw; max-height: 80vh; border-radius: 8px; object-fit: contain; }
.lb-close { position: absolute; top: -8px; right: -8px; z-index: 2; background: rgba(0,0,0,0.4); }
</style>