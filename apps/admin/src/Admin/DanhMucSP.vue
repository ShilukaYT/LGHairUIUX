<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";

import { useTheme } from "vuetify";

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

// ══ STATE ══════════════════════════════════════════════════════════
const search = ref("");
const filterStatus = ref("");
const curPage = ref(1);
const perPage = ref(10);
const sortField = ref(null);
const sortDir = ref(1);
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
}

// ══ COMPUTED ══════════════════════════════════════════════════════
const toast = reactive({ show: false, msg: "", type: "success" });
const lightbox = reactive({ open: false, src: "" });

const totalActive = computed(() => danhMucs.value.filter(d => d.trangThai === 1).length);
const totalProducts = computed(() => danhMucs.value.reduce((s, d) => s + (d.soSanPham ?? 0), 0));

const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  let arr = danhMucs.value.filter(d => {
    const mq = !q || d.tenDanhMuc.toLowerCase().includes(q) || d.maDMSP.toLowerCase().includes(q);
    const ms = filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
    return mq && ms;
  });
  if (sortField.value)
    arr = [...arr].sort((a, b) =>
      a[sortField.value] > b[sortField.value] ? sortDir.value : -sortDir.value
    );
  return arr;
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / perPage.value));
const pageData = computed(() => {
  const s = (curPage.value - 1) * perPage.value;
  return filteredData.value.slice(s, s + perPage.value);
});
const pageRange = computed(() => {
  const t = totalPages.value, c = curPage.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

// ══ HELPERS ═══════════════════════════════════════════════════════
function sortIcon(f) { return sortField.value !== f ? "↕" : sortDir.value === 1 ? "↑" : "↓"; }
function setSort(f) {
  sortField.value === f ? (sortDir.value *= -1) : ((sortField.value = f), (sortDir.value = 1));
  curPage.value = 1;
}

const CAT_COLORS = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5"];
function getCatClass(maDMSP) {
  const idx = danhMucs.value.findIndex(x => x.maDMSP === maDMSP);
  return CAT_COLORS[idx % CAT_COLORS.length] ?? "cat-1";
}

// ══ TOAST ═════════════════════════════════════════════════════════
function showToast(msg, type = "success") {
  toast.msg = msg; toast.type = type; toast.show = true;
  setTimeout(() => { toast.show = false; }, 3000);
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

// ══ INIT ══════════════════════════════════════════════════════════
onMounted(loadData);
</script>

<template>
  <div class="dm-manager" :class="{ 'dark-mode': isDarkMode }">

    <!-- ── STATS ──────────────────────────────────────────────────── -->

    <!-- ── HEADER BAR ──────────────────────────────────────────────── -->
    <div class="header-bar">
      <div class="page-title-text">Quản lý danh mục sản phẩm</div>
      <div class="header-actions">
        <button type="button" class="btn btn-primary btn-sm" @click="openAdd">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Thêm danh mục
        </button>
      </div>
    </div>

    <!-- ── TOOLBAR ────────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
        </svg>
        <input v-model="search" placeholder="Tìm tên, mã danh mục..." @input="curPage = 1" />
      </div>
      <select v-model="filterStatus" class="filter-select" @change="curPage = 1">
        <option value="">Tất cả trạng thái</option>
        <option value="1">Đang hoạt động</option>
        <option value="0">Tạm ẩn</option>
      </select>
      <span class="result-count">{{ filteredData.length }} kết quả</span>
      <select v-model.number="perPage" class="filter-select" style="width:auto;min-width:110px" @change="curPage = 1">
        <option :value="10">10 / trang</option>
        <option :value="20">20 / trang</option>
        <option :value="50">50 / trang</option>
        <option :value="9999">Tất cả</option>
      </select>
    </div>

    <!-- ── TABLE ──────────────────────────────────────────────────── -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:56px">Ảnh</th>
            <th class="sortable" @click="setSort('maDMSP')">
              Mã DM <span class="sort-icon">{{ sortIcon("maDMSP") }}</span>
            </th>
            <th class="sortable" @click="setSort('tenDanhMuc')">
              Tên danh mục <span class="sort-icon">{{ sortIcon("tenDanhMuc") }}</span>
            </th>
            <th class="sortable" @click="setSort('soSanPham')">
              Số SP <span class="sort-icon">{{ sortIcon("soSanPham") }}</span>
            </th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pageData.length === 0">
            <td colspan="6">
              <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">Không tìm thấy danh mục nào</div>
              </div>
            </td>
          </tr>

          <tr v-for="dm in pageData" :key="dm.maDMSP">
            <td>
              <div class="thumb-wrap" @click="dm.hinhAnh && (lightbox.src = dm.hinhAnh, lightbox.open = true)">
                <img v-if="dm.hinhAnh" :src="dm.hinhAnh" class="thumb-img" :alt="dm.tenDanhMuc" />
                <div v-else class="thumb-placeholder">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <path d="M21 15l-5-5L5 21"/>
                  </svg>
                </div>
              </div>
            </td>
            <td>
              <span class="code-text">{{ dm.maDMSP }}</span>
            </td>
            <td>
              <div class="sp-name">{{ dm.tenDanhMuc }}</div>
              <span class="cat-badge" :class="getCatClass(dm.maDMSP)">{{ dm.maDMSP }}</span>
            </td>
            <td>
              <span class="bt-count-badge">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="1" y="5" width="6" height="6" rx="1"/>
                  <rect x="9" y="5" width="6" height="6" rx="1"/>
                  <rect x="5" y="1" width="6" height="6" rx="1"/>
                </svg>
                {{ dm.soSanPham }} sản phẩm
              </span>
            </td>
            <td>
              <button
                type="button"
                class="status-toggle"
                :class="dm.trangThai === 1 ? 'active' : 'inactive'"
                @click="toggleStatus(dm)"
                :title="dm.trangThai === 1 ? 'Nhấn để tạm ẩn' : 'Nhấn để kích hoạt'"
              >
                <span class="status-dot"></span>
                {{ dm.trangThai === 1 ? "Đang hiện" : "Tạm ẩn" }}
              </button>
            </td>
            <td>
              <div class="action-btns">
                <button type="button" class="icon-btn view" title="Xem" @click="openView(dm)">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/>
                    <circle cx="8" cy="8" r="2"/>
                  </svg>
                </button>
                <button type="button" class="icon-btn edit" title="Sửa" @click="openEdit(dm)">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M11 2l3 3-9 9H2v-3l9-9z"/>
                  </svg>
                </button>
                <button type="button" class="icon-btn del" title="Xóa" @click="deleteDM(dm)">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── PAGINATION ─────────────────────────────────────────────── -->
    <div class="pager-wrap">
      <span>Hiển thị {{ Math.min((curPage - 1) * perPage + 1, filteredData.length) }}–{{ Math.min(curPage * perPage, filteredData.length) }} / {{ filteredData.length }}</span>
      <div class="pager-btns">
        <button class="page-btn" :disabled="curPage <= 1" @click="curPage--">‹</button>
        <button v-for="p in pageRange" :key="p" class="page-btn" :class="{ cur: p === curPage }" @click="curPage = p">{{ p }}</button>
        <button class="page-btn" :disabled="curPage >= totalPages" @click="curPage++">›</button>
      </div>
    </div>

    <!-- ══ MODAL ══════════════════════════════════════════════════════ -->
    <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
      <div class="modal modal-wide">
        <div class="modal-header">
          <h3 class="modal-title">{{ modal.title }}</h3>
          <button type="button" class="modal-close" @click="closeModal">✕</button>
        </div>

        <!-- VIEW MODE -->
        <div v-if="modal.mode === 'view'" class="modal-body">
          <div class="detail-grid">
            <div>
              <div v-if="form.hinhAnh" class="thumb-wrap-lg" @click="lightbox.src = form.hinhAnh; lightbox.open = true">
                <img :src="form.hinhAnh" class="detail-img" :alt="form.tenDanhMuc" />
              </div>
              <div v-else class="thumb-placeholder-lg">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--dvc-border-strong)" stroke-width="1.2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </div>
            </div>
            <div class="detail-info-col">
              <div class="detail-row">
                <span class="detail-label">Mã danh mục</span>
                <span class="detail-val code-text">{{ form.maDMSP }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Tên danh mục</span>
                <span class="detail-val">{{ form.tenDanhMuc }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Số sản phẩm</span>
                <span class="detail-val">{{ form.soSanPham ?? 0 }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Trạng thái</span>
                <span class="status-toggle" :class="form.trangThai === 1 ? 'active' : 'inactive'" style="cursor:default">
                  <span class="status-dot"></span>
                  {{ form.trangThai === 1 ? "Đang hiện" : "Tạm ẩn" }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- FORM MODE -->
        <div v-if="modal.mode === 'form'" class="modal-body">
          <!-- Mã danh mục (chỉ khi thêm mới) -->
          <div v-if="!editingId" class="form-group">
            <label class="form-label">Mã danh mục <span class="required-star">*</span></label>
            <input
              v-model="form.maDMSP"
              class="form-input"
              :class="{ 'input-error': errors.maDMSP, 'input-ok': touched.maDMSP && !errors.maDMSP }"
              placeholder="Ví dụ: DM001"
              maxlength="10"
              @blur="onBlur('maDMSP')"
              @input="touched.maDMSP && validateField('maDMSP')"
              autocomplete="off"
            />
            <!-- <div class="field-hint">Chỉ chữ cái A–Z và chữ số, từ 2–10 ký tự. Hệ thống sẽ tự chuyển thành chữ hoa.</div> -->
            <div v-if="errors.maDMSP" class="field-error">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5V10.5z"/></svg>
              {{ errors.maDMSP }}
            </div>
          </div>

          <!-- Tên danh mục -->
          <div class="form-group">
            <label class="form-label">
              Tên danh mục <span class="required-star">*</span>
              <span class="char-counter" :class="{ warn: tenDanhMucLength > 80, over: tenDanhMucLength > 100 }">
                {{ tenDanhMucLength }}/100
              </span>
            </label>
            <input
              v-model="form.tenDanhMuc"
              class="form-input"
              :class="{ 'input-error': errors.tenDanhMuc, 'input-ok': touched.tenDanhMuc && !errors.tenDanhMuc }"
              placeholder="Nhập tên danh mục..."
              maxlength="100"
              @blur="onBlur('tenDanhMuc')"
              @input="touched.tenDanhMuc && validateField('tenDanhMuc')"
              autocomplete="off"
            />
            <div v-if="errors.tenDanhMuc" class="field-error">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5V10.5z"/></svg>
              {{ errors.tenDanhMuc }}
            </div>
          </div>

          <!-- Trạng thái -->
          <div class="form-group">
            <label class="form-label">Trạng thái</label>
            <select v-model.number="form.trangThai" class="form-input">
              <option :value="1">Đang hiện — hiển thị cho khách hàng</option>
              <option :value="0">Tạm ẩn — không hiển thị cho khách hàng</option>
            </select>
          </div>

          <!-- Hình ảnh -->
          <div class="form-group">
            <label class="form-label">Hình ảnh đại diện <span class="field-optional">(không bắt buộc)</span></label>
            <input ref="imgInput" type="file" accept="image/*" style="display:none" @change="onImgChange" />
            <div class="upload-zone" @click="imgInput.click()">
              <div v-if="!form.hinhAnh" class="upload-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                  <polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span>Nhấn để chọn ảnh</span>
                <span class="upload-hint">PNG, JPG, WEBP – tối đa 5MB</span>
              </div>
              <div v-else class="upload-preview-single" @click.stop>
                <img :src="form.hinhAnh" class="upload-preview-img" alt="preview" />
                <button type="button" class="remove-single-img" @click.stop="removeImg" title="Xóa ảnh">✕</button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-ghost btn-sm" @click="closeModal">Hủy</button>
          <button v-if="modal.mode === 'form'" type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="saveDM">
            <svg v-if="saving" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite">
              <path d="M21 12a9 9 0 11-6.219-8.56"/>
            </svg>
            {{ saving ? "Đang lưu..." : (editingId ? "Cập nhật" : "Thêm mới") }}
          </button>
          <button v-if="modal.mode === 'view'" type="button" class="btn btn-secondary btn-sm" @click="openEdit(form)">
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>

    <!-- ── LIGHTBOX ────────────────────────────────────────────────── -->
    <div v-if="lightbox.open" class="lb-overlay" @click="lightbox.open = false">
      <img :src="lightbox.src" class="lb-img" />
      <button class="lb-close" @click="lightbox.open = false">✕</button>
    </div>

    <!-- ── TOAST ──────────────────────────────────────────────────── -->
    <div class="toast" :class="[toast.type, { show: toast.show }]">
      <span>{{ toast.type === "success" ? "✅" : "❌" }}</span>
      {{ toast.msg }}
    </div>

  </div>
</template>

<style scoped>
/* ── THEME VARIABLES (dark mode) ─────────────────────────────── */
.dm-manager.dark-mode {
  --dvc-card-bg: #23232f;
  --dvc-bg-subtle: #2a2a38;
  --dvc-bg-subtle2: #1e1e29;
  --dvc-border: #383846;
  --dvc-border-strong: #464656;
  --dvc-text: #e8e8ee;
  --dvc-text-strong: #cbcbd6;
  --dvc-text-secondary: #a3a3b2;
  --dvc-text-muted: #7c7c8c;
  --dvc-accent: #4b4b6b;
  --dvc-accent-hover: #5c5c80;
  --dvc-shadow: rgba(0, 0, 0, 0.35);
  --dvc-overlay: rgba(0, 0, 0, 0.6);
}

.dm-manager {
  /* ── THEME VARIABLES (light default) ─────────────────────────── */
  --dvc-card-bg: #fff;
  --dvc-bg-subtle: #f3f4f6;
  --dvc-bg-subtle2: #f9fafb;
  --dvc-border: #e5e7eb;
  --dvc-border-strong: #d1d5db;
  --dvc-text: #1a1a2e;
  --dvc-text-strong: #374151;
  --dvc-text-secondary: #6b7280;
  --dvc-text-muted: #9ca3af;
  --dvc-accent: #1a1a2e;
  --dvc-accent-hover: #2d2d4e;
  --dvc-shadow: rgba(0, 0, 0, 0.08);
  --dvc-overlay: rgba(0, 0, 0, 0.45);
  transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
 font-family: "Inter", sans-serif; font-size: 13px; color: var(--dvc-text-strong); }

/* ── STATS ────────────────────────────────────────────────────────── */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
.stat-card { border-radius: 12px; padding: 16px; position: relative; overflow: hidden; }
.stat-dark  { background: var(--dvc-accent); color: #fff; }
.stat-green { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.stat-blue  { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.stat-purple{ background: #faf5ff; color: #6b21a8; border: 1px solid #e9d5ff; }
.stat-icon  { font-size: 20px; margin-bottom: 6px; }
.stat-label { font-size: 11px; font-weight: 600; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 26px; font-weight: 700; line-height: 1.2; margin: 4px 0 2px; }
.stat-hint  { font-size: 11px; opacity: 0.65; }

/* ── HEADER BAR ──────────────────────────────────────────────────── */
.header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
.page-title-text { font-size: 16px; font-weight: 700; color: var(--dvc-text); }
.header-actions { display: flex; gap: 8px; }

/* ── BTN ─────────────────────────────────────────────────────────── */
.btn { border: none; border-radius: 8px; font-family: inherit; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; }
.btn-sm { padding: 7px 14px; }
.btn-primary { background: var(--dvc-accent); color: #fff; }
.btn-primary:hover { background: var(--dvc-accent-hover); }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-ghost { background: var(--dvc-bg-subtle); color: var(--dvc-text-strong); border: 1px solid var(--dvc-border); }
.btn-ghost:hover { background: var(--dvc-border); }
.btn-secondary { background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; }
.btn-secondary:hover { background: #dbeafe; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── TOOLBAR ─────────────────────────────────────────────────────── */
.toolbar { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 8px; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; padding: 7px 12px; min-width: 220px; }
.search-box input { border: none; outline: none; font-family: inherit; font-size: 13px; color: var(--dvc-text-strong); background: transparent; width: 100%; }
.filter-select { border: 1px solid var(--dvc-border); border-radius: 8px; padding: 7px 10px; font-family: inherit; font-size: 13px; color: var(--dvc-text-strong); background: var(--dvc-card-bg); outline: none; min-width: 150px; cursor: pointer; }
.result-count { font-size: 12px; color: var(--dvc-text-muted); font-weight: 500; margin-left: 4px; }

/* ── TABLE ───────────────────────────────────────────────────────── */
.table-wrap { background: var(--dvc-card-bg); border-radius: 12px; border: 1px solid var(--dvc-border); overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead tr { background: var(--dvc-bg-subtle2); border-bottom: 1px solid var(--dvc-border); }
thead th { padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: var(--dvc-text-muted); letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; }
thead th.sortable { cursor: pointer; user-select: none; }
thead th.sortable:hover { color: var(--dvc-text-strong); }
.sort-icon { color: var(--dvc-border-strong); font-size: 10px; margin-left: 3px; }
tbody tr { border-bottom: 1px solid var(--dvc-bg-subtle); transition: background 0.1s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: var(--dvc-bg-subtle2); }
tbody td { padding: 10px 12px; vertical-align: middle; }

/* ── THUMB ───────────────────────────────────────────────────────── */
.thumb-wrap { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; border: 1px solid var(--dvc-border); cursor: pointer; background: var(--dvc-bg-subtle2); }
.thumb-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.thumb-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--dvc-border-strong); }

/* ── BADGES ──────────────────────────────────────────────────────── */
.code-text { font-family: monospace; font-size: 12px; color: var(--dvc-text-secondary); background: var(--dvc-bg-subtle); padding: 2px 6px; border-radius: 4px; }
.sp-name { font-weight: 500; color: var(--dvc-text); margin-bottom: 3px; }

.cat-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
.cat-1 { background: #eff6ff; color: #1e40af; }
.cat-2 { background: #fdf4ff; color: #7e22ce; }
.cat-3 { background: #fff7ed; color: #c2410c; }
.cat-4 { background: #f0fdf4; color: #166534; }
.cat-5 { background: #fef3c7; color: #92400e; }

.bt-count-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--dvc-text-secondary); }

/* ── STATUS TOGGLE ───────────────────────────────────────────────── */
.status-toggle { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px; border: 1px solid; cursor: pointer; background: none; font-family: inherit; transition: all 0.15s; }
.status-toggle.active  { color: #166534; border-color: #86efac; background: #f0fdf4; }
.status-toggle.active:hover { background: #dcfce7; }
.status-toggle.inactive { color: var(--dvc-text-muted); border-color: var(--dvc-border); background: var(--dvc-bg-subtle2); }
.status-toggle.inactive:hover { background: var(--dvc-bg-subtle); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

/* ── ACTION BTNS ──────────────────────────────────────────────────── */
.action-btns { display: flex; gap: 4px; }
.icon-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); cursor: pointer; color: var(--dvc-text-muted); transition: all 0.12s; }
.icon-btn.view:hover { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }
.icon-btn.edit:hover { color: #d97706; border-color: #fde68a; background: #fffbeb; }
.icon-btn.del:hover  { color: #dc2626; border-color: #fecaca; background: #fef2f2; }

/* ── EMPTY ───────────────────────────────────────────────────────── */
.empty-state { text-align: center; padding: 40px; }
.empty-icon  { font-size: 36px; margin-bottom: 8px; }
.empty-text  { color: var(--dvc-text-muted); font-size: 14px; }

/* ── PAGINATION ──────────────────────────────────────────────────── */
.pager-wrap { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--dvc-bg-subtle); font-size: 12px; color: var(--dvc-text-muted); }
.pager-btns { display: flex; gap: 4px; }
.page-btn { min-width: 28px; height: 28px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); font-size: 12px; cursor: pointer; color: var(--dvc-text-secondary); transition: all 0.12s; }
.page-btn:disabled { opacity: 0.4; cursor: default; }
.page-btn:hover:not(:disabled):not(.cur) { border-color: var(--dvc-border-strong); background: var(--dvc-bg-subtle2); }
.page-btn.cur { background: var(--dvc-accent); color: #fff; border-color: var(--dvc-accent); }

/* ── MODAL ───────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { position: relative; top: auto; left: auto; margin: 0; background: var(--dvc-card-bg); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
.modal-wide { width: 520px; max-width: 95vw; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid var(--dvc-bg-subtle); }
.modal-title { font-size: 15px; font-weight: 700; color: var(--dvc-text); margin: 0; }
.modal-close { width: 28px; height: 28px; border: 1px solid var(--dvc-border); border-radius: 6px; background: var(--dvc-card-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--dvc-text-muted); }
.modal-close:hover { background: var(--dvc-bg-subtle2); color: var(--dvc-text-strong); }
.modal-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
.modal-footer { padding: 14px 22px; border-top: 1px solid var(--dvc-bg-subtle); display: flex; justify-content: flex-end; gap: 8px; }

/* ── FORM ────────────────────────────────────────────────────────── */
.form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 16px; }
.form-label { font-size: 12px; font-weight: 600; color: var(--dvc-text-strong); display: flex; align-items: center; gap: 6px; }
.required-star { color: #ef4444; font-size: 13px; line-height: 1; }
.field-optional { font-size: 11px; font-weight: 400; color: var(--dvc-text-muted); }
.form-input { background: var(--dvc-card-bg); border: 1.5px solid var(--dvc-border); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--dvc-text); font-family: inherit; outline: none; transition: border 0.15s, box-shadow 0.15s; }
.form-input:focus { border-color: var(--dvc-text-secondary); box-shadow: 0 0 0 3px rgba(107,114,128,0.08); }
.input-error { border-color: #f87171 !important; box-shadow: 0 0 0 3px rgba(248,113,113,0.1) !important; }
.input-ok   { border-color: #4ade80 !important; box-shadow: 0 0 0 3px rgba(74,222,128,0.08) !important; }
.field-error { font-size: 11.5px; color: #dc2626; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
.field-hint  { font-size: 11px; color: var(--dvc-text-muted); margin-top: 2px; line-height: 1.5; }

/* Char counter */
.char-counter { margin-left: auto; font-size: 11px; font-weight: 400; color: var(--dvc-text-muted); }
.char-counter.warn { color: #f59e0b; }
.char-counter.over { color: #ef4444; font-weight: 600; }

/* ── UPLOAD ──────────────────────────────────────────────────────── */
.upload-zone { border: 1.5px dashed var(--dvc-border-strong); border-radius: 10px; background: var(--dvc-bg-subtle2); cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 110px; transition: all 0.15s; }
.upload-zone:hover { background: var(--dvc-bg-subtle); border-color: var(--dvc-text-muted); }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--dvc-text-muted); font-size: 12px; }
.upload-hint { font-size: 11px; }
.upload-preview-single { position: relative; display: inline-block; }
.upload-preview-img { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid var(--dvc-border); display: block; }
.remove-single-img { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: var(--dvc-accent); color: #fff; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

/* ── DETAIL VIEW ─────────────────────────────────────────────────── */
.detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start; }
.detail-info-col { display: flex; flex-direction: column; gap: 12px; }
.detail-row { display: flex; align-items: center; gap: 10px; }
.detail-label { font-size: 12px; font-weight: 600; color: var(--dvc-text-muted); min-width: 120px; }
.detail-val { font-size: 13px; color: var(--dvc-text); }
.thumb-wrap-lg { width: 120px; height: 120px; border-radius: 12px; overflow: hidden; border: 1px solid var(--dvc-border); cursor: pointer; }
.detail-img { width: 100%; height: 100%; object-fit: cover; }
.thumb-placeholder-lg { width: 120px; height: 120px; border-radius: 12px; border: 1px solid var(--dvc-border); display: flex; align-items: center; justify-content: center; background: var(--dvc-bg-subtle2); }

/* ── LIGHTBOX ────────────────────────────────────────────────────── */
.lb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 9999; display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.lb-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; object-fit: contain; }
.lb-close { position: absolute; top: 16px; right: 20px; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 20px; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* ── TOAST ───────────────────────────────────────────────────────── */
.toast { position: fixed; bottom: 24px; right: 24px; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--dvc-text); display: flex; align-items: center; gap: 9px; z-index: 1000; transform: translateY(20px); opacity: 0; transition: all 0.25s; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-width: 320px; }
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: #bbf7d0; }
.toast.error   { border-color: #fecaca; }

/* ── RESPONSIVE ──────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .header-bar { flex-direction: column; align-items: flex-start; }
  .result-count { margin-left: 0; }
  .detail-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
}
</style>