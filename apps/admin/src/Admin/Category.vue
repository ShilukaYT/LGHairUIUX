<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

// ── UTILS ─────────────────────────────────────────────────────────

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
const curPage = ref(1);
const PER_PAGE = 10;
const editingId = ref(null);

const modal = reactive({ open: false, mode: "", title: "" });
const form = reactive({
  maDM: "",
  tenDanhMuc: "",
  trangThai: 1,
});
const errors = reactive({ maDM: "", tenDanhMuc: "" });
const toast = reactive({ show: false, msg: "", type: "success", icon: "✅" });
const confirmModal = reactive({ open: false, item: null });

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

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / PER_PAGE),
);
const pageData = computed(() => {
  const s = (curPage.value - 1) * PER_PAGE;
  return filteredData.value.slice(s, s + PER_PAGE);
});
const pageRange = computed(() => {
  const t = totalPages.value,
    c = curPage.value;
  const lo = Math.max(1, c - 2),
    hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
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
  curPage.value = 1;
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
      showToast("Cập nhật danh mục thành công!");
    } else {
      await axios.post(`${API}/api/DanhMuc`, fd);
      showToast("Thêm danh mục thành công!");
    }
    await loadData();
    closeModal();
  } catch (err) {
    const msg = err.response?.data?.message || "Lỗi khi lưu!";
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
    showToast(`Đã xóa danh mục "${d.tenDanhMuc}"`);
    await loadData();
  } catch (err) {
    const msg = err.response?.data?.message || "Lỗi khi xóa!";
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
    d.trangThai = newStatus;
    showToast(newStatus ? "Đã kích hoạt danh mục." : "Đã ngừng danh mục.");
  } catch {
    showToast("Lỗi cập nhật trạng thái!", "error");
  }
}

// ── TOAST ──────────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg, type = "success") {
  Object.assign(toast, {
    msg,
    type,
    icon: type === "success" ? "✅" : "❌",
    show: true,
  });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.show = false;
  }, 3000);
}

onMounted(loadData);
</script>

<template>
  <div class="dm-root">
    <!-- ── STATS ───────────────────────────────────────────────── -->
    <div class="stats-row">
      <div class="stat-card stat-gold">
        <div class="stat-icon"></div>
        <div class="stat-label">Tổng danh mục</div>
        <div class="stat-value">{{ danhMucs.length }}</div>
        <div class="stat-hint">{{ statActive }} đang hoạt động</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon"></div>
        <div class="stat-label">Đang hoạt động</div>
        <div class="stat-value">{{ statActive }}</div>
        <div class="stat-hint">Hiển thị với khách</div>
      </div>
      <div class="stat-card stat-red">
        <div class="stat-icon"></div>
        <div class="stat-label">Ngừng hoạt động</div>
        <div class="stat-value">{{ statInactive }}</div>
        <div class="stat-hint">Đã ẩn khỏi danh sách</div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon"></div>
        <div class="stat-label">Tổng dịch vụ</div>
        <div class="stat-value">{{ statTotalDV }}</div>
        <div class="stat-hint">Trong tất cả danh mục</div>
      </div>
    </div>

    <!-- ── HEADER BAR ──────────────────────────────────────────── -->
    <div class="header-bar">
      <!-- Toolbar bên trái -->
      <div class="toolbar">
        <div class="search-box">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="7" cy="7" r="5" />
            <path d="M11 11l3 3" />
          </svg>
          <input
            v-model="search"
            placeholder="Tìm kiếm danh mục..."
            @keyup.enter="onFilterChange"
            @input="curPage = 1"
          />
        </div>
        <select
          v-model="filterStatus"
          class="filter-select"
          @change="onFilterChange"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="1">Đang hoạt động</option>
          <option value="0">Ngừng hoạt động</option>
        </select>
        <span class="result-count">{{ filteredData.length }} kết quả</span>
      </div>
      <!-- Nút thêm -->
      <button class="btn btn-primary" @click="openAdd">
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path d="M8 2v12M2 8h12" />
        </svg>
        Thêm danh mục
      </button>
    </div>

    <!-- ── LOADING ─────────────────────────────────────────────── -->
    <div v-if="loading" class="loading-row">
      <span class="spinner-lg"></span>
      <span>Đang tải...</span>
    </div>

    <!-- ── CARD GRID ───────────────────────────────────────────── -->
    <template v-else>
      <div v-if="pageData.length === 0" class="empty-state">
        <div class="empty-icon">🗂️</div>
        <div class="empty-text">Không tìm thấy danh mục nào</div>
        <div class="empty-sub">Thử thay đổi bộ lọc hoặc thêm danh mục mới</div>
      </div>

      <div v-else class="table-wrap">
        <table class="dm-table">
          <thead>
            <tr>
              <th style="width:44px">#</th>
              <th>Mã DM</th>
              <th>Tên danh mục</th>
              <th style="width:110px; text-align:center">Số dịch vụ</th>
              <th style="width:120px; text-align:center">Ngày tạo</th>
              <th style="width:130px; text-align:center">Trạng thái</th>
              <th style="width:110px; text-align:center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(d, idx) in pageData"
              :key="d.maDM"
              :class="{ 'row-inactive': !d.trangThai }"
            >
              <td class="td-no">{{ (curPage - 1) * PER_PAGE + idx + 1 }}</td>
              <td><span class="code-badge">{{ d.maDM }}</span></td>
              <td class="td-name">{{ d.tenDanhMuc }}</td>
              <td style="text-align:center">
                <span class="dv-count">{{ d.soDichVu }}</span>
              </td>
              <td style="text-align:center; color:#6b7280; font-size:13px">{{ fmtDate(d.ngayTao) }}</td>
              <td style="text-align:center">
                <button
                  class="toggle-btn"
                  :class="d.trangThai ? 'toggle-active' : 'toggle-inactive'"
                  @click="toggleStatus(d)"
                  :title="d.trangThai ? 'Nhấn để ngừng' : 'Nhấn để kích hoạt'"
                >
                  <span class="toggle-dot"></span>
                  {{ d.trangThai ? "Hoạt động" : "Ngừng" }}
                </button>
              </td>
              <td>
                <div class="actions" style="justify-content:center">
                  <button class="icon-btn view" title="Xem chi tiết" @click="openView(d)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="8" cy="8" r="3" /><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                    </svg>
                  </button>
                  <button class="icon-btn edit" title="Chỉnh sửa" @click="openEdit(d)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                    </svg>
                  </button>
                  <button class="icon-btn del" title="Xóa" @click="askDelete(d)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pager -->
      <div v-if="totalPages > 1" class="pager-wrap">
        <span
          >Hiển thị {{ (curPage - 1) * PER_PAGE + 1 }}–{{
            Math.min(curPage * PER_PAGE, filteredData.length)
          }}
          / {{ filteredData.length }} mục</span
        >
        <div class="pager-btns">
          <button class="page-btn" :disabled="curPage <= 1" @click="curPage--">
            ‹
          </button>
          <button
            v-for="p in pageRange"
            :key="p"
            class="page-btn"
            :class="{ cur: p === curPage }"
            @click="curPage = p"
          >
            {{ p }}
          </button>
          <button
            class="page-btn"
            :disabled="curPage >= totalPages"
            @click="curPage++"
          >
            ›
          </button>
        </div>
      </div>
    </template>

    <!-- ── MAIN MODAL (form + view) ───────────────────────────── -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <div class="modal-head">
            <div class="modal-title">{{ modal.title }}</div>
            <button class="modal-close" @click="closeModal">✕</button>
          </div>

          <!-- VIEW -->
          <div v-if="modal.mode === 'view'" class="modal-body">
            <div class="detail-grid">
              <div class="detail-item">
                <div class="detail-label">Mã danh mục</div>
                <div class="detail-val">
                  <span class="code-badge">{{ form.maDM }}</span>
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Trạng thái</div>
                <div class="detail-val">
                  <span
                    class="status-pill"
                    :class="form.trangThai ? 'active' : 'inactive'"
                    ><span class="sdot"></span
                    >{{ form.trangThai ? "Hoạt động" : "Ngừng" }}</span
                  >
                </div>
              </div>
              <div class="detail-item" style="grid-column: 1/-1">
                <div class="detail-label">Tên danh mục</div>
                <div
                  class="detail-val"
                  style="font-size: 16px; font-weight: 700; color: #1a1a2e"
                >
                  {{ form.tenDanhMuc }}
                </div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Số dịch vụ</div>
                <div class="detail-val">{{ form.soDichVu ?? 0 }} dịch vụ</div>
              </div>
              <div class="detail-item">
                <div class="detail-label">Ngày tạo</div>
                <div class="detail-val">{{ fmtDate(form.ngayTao) }}</div>
              </div>
            </div>
          </div>

          <!-- FORM -->
          <div v-else class="modal-body">
            <!-- Mã + Tên -->
            <div class="form-row-2">
              <div>
                <label class="form-label"
                  >Mã danh mục <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.maDM }"
                  v-model="form.maDM"
                  :readonly="!!editingId"
                  placeholder="VD: DM001"
                  maxlength="10"
                  @input="errors.maDM = ''"
                />
                <p v-if="errors.maDM" class="field-error">{{ errors.maDM }}</p>
              </div>
              <div>
                <label class="form-label"
                  >Tên danh mục <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.tenDanhMuc }"
                  v-model="form.tenDanhMuc"
                  placeholder="VD: Cắt tóc"
                  maxlength="100"
                  @input="errors.tenDanhMuc = ''"
                />
                <p v-if="errors.tenDanhMuc" class="field-error">
                  {{ errors.tenDanhMuc }}
                </p>
              </div>
            </div>

            <!-- Trạng thái -->
            <div class="form-row">
              <label class="form-label">Trạng thái</label>
              <div class="radio-group">
                <label
                  class="radio-item"
                  :class="{ 'radio-active': form.trangThai === 1 }"
                >
                  <input type="radio" :value="1" v-model="form.trangThai" />
                  <span class="radio-icon active-dot"></span>
                  Hoạt động
                </label>
                <label
                  class="radio-item"
                  :class="{ 'radio-active': form.trangThai === 0 }"
                >
                  <input type="radio" :value="0" v-model="form.trangThai" />
                  <span class="radio-icon inactive-dot"></span>
                  Ngừng hoạt động
                </label>
              </div>
            </div>
          </div>

          <div class="modal-foot">
            <template v-if="modal.mode === 'view'">
              <button class="btn btn-ghost btn-sm" @click="closeModal">
                Đóng
              </button>
              <button
                class="btn btn-primary btn-sm"
                @click="
                  openEdit({
                    maDM: form.maDM,
                    tenDanhMuc: form.tenDanhMuc,
                    trangThai: form.trangThai,
                    ngayTao: form.ngayTao,
                    soDichVu: form.soDichVu,
                  })
                "
              >
                Chỉnh sửa
              </button>
            </template>
            <template v-else>
              <button
                class="btn btn-ghost btn-sm"
                :disabled="saving"
                @click="closeModal"
              >
                Hủy
              </button>
              <button
                class="btn btn-primary btn-sm"
                :disabled="saving"
                @click="saveItem"
              >
                <span v-if="saving" class="spinner"></span>
                <span v-else></span>
                {{ saving ? "Đang lưu..." : "Lưu lại" }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── CONFIRM DELETE ──────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="confirmModal.open"
        class="modal-overlay"
        @click.self="confirmModal.open = false"
      >
        <div class="modal modal-sm">
          <div class="modal-head">
            <div class="modal-title">Xác nhận xóa</div>
            <button class="modal-close" @click="confirmModal.open = false">
              ✕
            </button>
          </div>
          <div class="modal-body">
            <p style="font-size: 14px; color: #374151; line-height: 1.7">
              Bạn có chắc muốn xóa danh mục
              <strong style="color: #1a1a2e">{{
                confirmModal.item?.tenDanhMuc
              }}</strong
              >?
            </p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 6px">
              ⚠️ Danh mục có dịch vụ liên kết sẽ không thể xóa.
            </p>
          </div>
          <div class="modal-foot">
            <button
              class="btn btn-ghost btn-sm"
              @click="confirmModal.open = false"
            >
              Hủy
            </button>
            <button class="btn btn-danger btn-sm" @click="confirmDelete">
              Xóa
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── TOAST ───────────────────────────────────────────────── -->
    <Teleport to="body">
      <div class="toast" :class="[toast.show ? 'show' : '', toast.type]">
        <span>{{ toast.icon }}</span
        ><span>{{ toast.msg }}</span>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── RESET ─────────────────────────────────────────────────────── */
.dm-root {
  font-family:
    "Inter",
    -apple-system,
    "Segoe UI",
    sans-serif;
  color: #1a1a2e;
  background: transparent;
}

/* ── STATS ─────────────────────────────────────────────────────── */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 22px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  position: relative;
  overflow: hidden;
}
.stat-card::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 12px 12px 0 0;
}
.stat-gold::before {
  background: #d97706;
}
.stat-green::before {
  background: #059669;
}
.stat-red::before {
  background: #dc2626;
}
.stat-blue::before {
  background: #2563eb;
}
.stat-icon {
  font-size: 20px;
  margin-bottom: 8px;
}
.stat-label {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.stat-value {
  font-size: 22px;
  font-weight: 700;
}
.stat-gold .stat-value {
  color: #d97706;
}
.stat-green .stat-value {
  color: #059669;
}
.stat-red .stat-value {
  color: #dc2626;
}
.stat-blue .stat-value {
  color: #2563eb;
}
.stat-hint {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 4px;
}

/* ── HEADER ─────────────────────────────────────────────────────── */
.header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  flex: 1;
}
.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px 12px;
  min-width: 200px;
  flex: 1;
  max-width: 320px;
  transition: border 0.15s;
}
.search-box:focus-within {
  border-color: #6b7280;
}
.search-box input {
  background: transparent;
  border: none;
  outline: none;
  color: #1a1a2e;
  font-size: 13px;
  font-family: inherit;
  width: 100%;
}
.search-box input::placeholder {
  color: #9ca3af;
}
.filter-select {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 7px 10px;
  color: #374151;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  outline: none;
}
.result-count {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

/* ── BUTTONS ────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn-primary {
  background: #1a1a2e;
  color: #fff;
}
.btn-primary:hover:not(:disabled) {
  background: #2d2d4e;
  transform: translateY(-1px);
}
.btn-ghost {
  background: transparent;
  color: #6b7280;
  border: 1px solid #e5e7eb;
}
.btn-ghost:hover:not(:disabled) {
  color: #1a1a2e;
  border-color: #d1d5db;
  background: #f9fafb;
}
.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.btn-danger:hover {
  background: #fee2e2;
}
.btn-del-img {
  color: #dc2626;
  border: 1px solid #fecaca;
  background: transparent;
}
.btn-del-img:hover {
  background: #fef2f2;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── LOADING ────────────────────────────────────────────────────── */
.loading-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 60px;
  color: #9ca3af;
  font-size: 14px;
}
.spinner-lg {
  width: 24px;
  height: 24px;
  border: 2.5px solid #e5e7eb;
  border-top-color: #6b7280;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* ── TABLE ──────────────────────────────────────────────────────── */
.table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}
.dm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dm-table thead tr {
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
}
.dm-table th {
  padding: 11px 14px;
  font-weight: 600;
  font-size: 12px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  text-align: left;
  white-space: nowrap;
}
.dm-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f3f4f6;
  color: #1a1a2e;
  vertical-align: middle;
}
.dm-table tbody tr:last-child td {
  border-bottom: none;
}
.dm-table tbody tr:hover {
  background: #fafafa;
}
.dm-table tbody tr.row-inactive {
  opacity: 0.6;
}
.td-no {
  color: #9ca3af;
  font-size: 12px;
  font-weight: 500;
}
.td-name {
  font-weight: 500;
  color: #111827;
}
.dv-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  color: #2563eb;
  border-radius: 20px;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 600;
  min-width: 28px;
}
.toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  font-family: inherit;
  transition: all 0.15s;
}
.toggle-active {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.toggle-active:hover {
  background: #dcfce7;
}
.toggle-inactive {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.toggle-inactive:hover {
  background: #fee2e2;
}
.toggle-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}
.actions {
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  transition: all 0.15s;
}
.icon-btn.view:hover {
  background: #fffbeb;
  color: #d97706;
  border-color: #fcd34d;
}
.icon-btn.edit:hover {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}
.icon-btn.del:hover {
  background: #fef2f2;
  color: #dc2626;
  border-color: #fecaca;
}

/* ── EMPTY ──────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #9ca3af;
}
.empty-icon {
  font-size: 42px;
  margin-bottom: 12px;
  opacity: 0.4;
}
.empty-text {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 4px;
}
.empty-sub {
  font-size: 12px;
}

/* ── PAGER ──────────────────────────────────────────────────────── */
.pager-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 4px;
  font-size: 12px;
  color: #9ca3af;
  margin-top: 6px;
}
.pager-btns {
  display: flex;
  gap: 4px;
}
.page-btn {
  min-width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  padding: 0 6px;
  transition: all 0.15s;
}
.page-btn.cur {
  background: #1a1a2e;
  color: #fff;
  border-color: #1a1a2e;
  font-weight: 700;
}
.page-btn:hover:not(.cur):not(:disabled) {
  background: #f3f4f6;
  color: #1a1a2e;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* ── MODAL ──────────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 9000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  width: 500px;
  max-width: 95vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.modal-sm {
  width: 400px;
}
.modal-head {
  padding: 18px 22px;
  border-bottom: 1px solid #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}
.modal-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a2e;
}
.modal-close {
  width: 30px;
  height: 30px;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
  background: transparent;
  cursor: pointer;
  color: #9ca3af;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.modal-close:hover {
  color: #1a1a2e;
  background: #f3f4f6;
}
.modal-body {
  padding: 20px 22px;
  overflow-y: auto;
  flex: 1;
}
.modal-body::-webkit-scrollbar {
  width: 4px;
}
.modal-body::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}
.modal-foot {
  padding: 14px 22px;
  border-top: 1px solid #f3f4f6;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* ── FORM ───────────────────────────────────────────────────────── */
.form-row {
  margin-bottom: 16px;
}
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}
.form-label {
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
  margin-bottom: 6px;
  display: block;
}
.label-hint {
  font-weight: 400;
  color: #9ca3af;
  font-size: 11px;
}
.req {
  color: #dc2626;
}
.form-input {
  width: 100%;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 9px 12px;
  color: #1a1a2e;
  font-size: 13px;
  font-family: inherit;
  outline: none;
  transition: all 0.15s;
  box-sizing: border-box;
}
.form-input:focus {
  border-color: #6b7280;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
}
.form-input[readonly] {
  opacity: 0.6;
  cursor: default;
}
.input-error {
  border-color: #dc2626 !important;
}
.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1) !important;
}
.field-error {
  font-size: 11px;
  color: #dc2626;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}
.field-error::before {
  content: "⚠";
  font-size: 10px;
}

/* Radio group */
.radio-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.radio-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #6b7280;
  transition: all 0.15s;
  user-select: none;
}
.radio-item input[type="radio"] {
  display: none;
}
.radio-item:hover {
  border-color: #9ca3af;
}
.radio-item.radio-active {
  border-color: #1a1a2e;
  background: #f8fafc;
  color: #1a1a2e;
  font-weight: 500;
}
.radio-icon {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.active-dot {
  background: #059669;
}
.inactive-dot {
  background: #dc2626;
}

/* ── VIEW MODAL ─────────────────────────────────────────────────── */
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.detail-item {
  background: #f9fafb;
  border-radius: 8px;
  padding: 10px 12px;
}
.detail-label {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}
.detail-val {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
}
.code-badge {
  font-family: "Courier New", monospace;
  font-size: 12px;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 5px;
  color: #374151;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}
.status-pill.active {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.status-pill.inactive {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.sdot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* ── TOAST ──────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 13px;
  color: #1a1a2e;
  display: flex;
  align-items: center;
  gap: 9px;
  z-index: 1000;
  transform: translateY(20px);
  opacity: 0;
  transition: all 0.25s;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  max-width: 320px;
}
.toast.show {
  transform: translateY(0);
  opacity: 1;
}
.toast.success {
  border-color: #bbf7d0;
}
.toast.error {
  border-color: #fecaca;
}

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .table-wrap {
    overflow-x: auto;
  }
  .dm-table {
    min-width: 560px;
  }
  .form-row-2 {
    grid-template-columns: 1fr;
  }
  .detail-grid {
    grid-template-columns: 1fr;
  }
  .header-bar {
    flex-direction: column;
    align-items: flex-start;
  }
  .toolbar {
    width: 100%;
  }
}
@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>