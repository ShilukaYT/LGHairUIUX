<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;

function getCurrentNhanVien() {
  try {
    const adminStr = sessionStorage.getItem("adminUser");
    const staffStr = sessionStorage.getItem("staffUser") || sessionStorage.getItem("nhanVienUser");
    const raw = adminStr || staffStr;
    if (!raw) return null;
    const u = JSON.parse(raw);
    const maNv = u.maNv || u.maNV || u.MaNv || null;
    const ten = u.hoTen || u.tenNhanVien || u.username || maNv || "Nhân viên";
    return maNv ? { maNv, ten } : null;
  } catch { return null; }
}

function toAbsUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

// ══ DATA ══════════════════════════════════════════════════════════
const sanPhams = ref([]);
const bienThes = ref([]);
const danhMucSPs = ref([]);
const thuongHieus = ref([]);
const expandedProducts = ref({});

// Gallery state
const spGallery = reactive({}); // maSP -> [{ maHa, duongDan }]
const btGallery = reactive({}); // maBienThe -> [{ maHa, duongDan }]

// ══ STATE ══════════════════════════════════════════════════════════
const search = ref("");
const filterCat = ref("");
const filterBrand = ref("");
const filterStatus = ref("");
const curPage = ref(1);
const perPage = ref(10);
const sortField = ref(null);
const sortDir = ref(1);
const saving = ref(false);
const btSaving = ref(false);

// SP modal
const spModal = reactive({ open: false, mode: "", title: "" });
const editingSpId = ref(null);
const spForm = reactive({
  maSP: "", tenSP: "", maDanhMuc: "", maTH: "", hinhAnhDaiDien: "", trangThai: 1,
  _newAvatarFile: null,
  _newGalleryFiles: [],    // [{ file, preview }]
  _deleteGalleryIds: [],   // maHa cần xóa
});
const spImgInput = ref(null);
const spGalleryInput = ref(null);

// BT modal
const btModal = reactive({ open: false, mode: "", title: "" });
const editingBtId = ref(null);
const currentBtSP = ref(null); // maSP đang thêm/sửa BT
const btForm = reactive({
  maBienThe: "", maSanPham: "", tenBienThe: "", giaBan: "", soLuong: 0,
  phanTramHoaHong: "", hinhAnhDaiDien: "", trangThai: 1, ghiChu: "",
  _newAvatarFile: null,
  _newGalleryFiles: [],
  _deleteGalleryIds: [],
  _originalSoLuong: 0,
});
const btImgInput = ref(null);
const btGalleryInput = ref(null);

// ══ VALIDATION ═════════════════════════════════════════════════════
const spErrors = reactive({ maSP: "", tenSP: "", maDanhMuc: "" });
const btErrors = reactive({ maBienThe: "", tenBienThe: "", giaBan: "", soLuong: "", phanTramHoaHong: "", ghiChu: "" });

function clearSpErrors() { Object.keys(spErrors).forEach(k => spErrors[k] = ""); }
function clearBtErrors() { Object.keys(btErrors).forEach(k => btErrors[k] = ""); }

function validateSP() {
  clearSpErrors(); let ok = true;
  if (!editingSpId.value) {
    if (!spForm.maSP.trim()) { spErrors.maSP = "Mã sản phẩm không được để trống."; ok = false; }
    else if (!/^[A-Za-z0-9]{2,10}$/.test(spForm.maSP.trim())) { spErrors.maSP = "Mã SP chỉ gồm chữ và số, 2–10 ký tự."; ok = false; }
    else if (sanPhams.value.find(x => x.maSP === spForm.maSP.trim())) { spErrors.maSP = "Mã sản phẩm đã tồn tại."; ok = false; }
  }
  if (!spForm.tenSP.trim()) { spErrors.tenSP = "Tên sản phẩm không được để trống."; ok = false; }
  else if (spForm.tenSP.trim().length < 2) { spErrors.tenSP = "Tên tối thiểu 2 ký tự."; ok = false; }
  else if (spForm.tenSP.trim().length > 150) { spErrors.tenSP = "Tên tối đa 150 ký tự."; ok = false; }
  if (!spForm.maDanhMuc) { spErrors.maDanhMuc = "Vui lòng chọn danh mục."; ok = false; }
  return ok;
}

function validateBT() {
  clearBtErrors(); let ok = true;
  if (!editingBtId.value) {
    if (!btForm.maBienThe.trim()) { btErrors.maBienThe = "Mã biến thể không được để trống."; ok = false; }
    else if (!/^[A-Za-z0-9]{2,10}$/.test(btForm.maBienThe.trim())) { btErrors.maBienThe = "Mã chỉ gồm chữ và số, 2–10 ký tự."; ok = false; }
  }
  if (!btForm.tenBienThe.trim()) { btErrors.tenBienThe = "Tên biến thể không được để trống."; ok = false; }
  const gia = Number(btForm.giaBan);
  if (btForm.giaBan === "" || isNaN(gia)) { btErrors.giaBan = "Giá bán không được để trống."; ok = false; }
  else if (gia <= 0) { btErrors.giaBan = "Giá phải lớn hơn 0."; ok = false; }
  else if (gia > 100_000_000) { btErrors.giaBan = "Giá tối đa 100.000.000₫."; ok = false; }
  const sl = Number(btForm.soLuong);
  if (isNaN(sl) || sl < 0) { btErrors.soLuong = "Số lượng phải ≥ 0."; ok = false; }
  if (editingBtId.value && !isNaN(sl) && sl !== Number(btForm._originalSoLuong)) {
    if (!btForm.ghiChu || !btForm.ghiChu.trim()) {
      btErrors.ghiChu = "Vui lòng nhập lý do điều chỉnh số lượng.";
      ok = false;
    }
  }
  if (btForm.phanTramHoaHong !== "" && btForm.phanTramHoaHong != null) {
    const h = Number(btForm.phanTramHoaHong);
    if (isNaN(h) || h < 0 || h > 100) { btErrors.phanTramHoaHong = "Hoa hồng 0–100%."; ok = false; }
  }
  return ok;
}

// ══ IMAGE HELPERS ══════════════════════════════════════════════════
function readFileAsPreview(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) { reject("not_image"); return; }
    if (file.size > 5 * 1024 * 1024) { reject("too_large"); return; }
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.readAsDataURL(file);
  });
}

async function onSPAvatarChange(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    const src = await readFileAsPreview(file);
    spForm.hinhAnhDaiDien = src;
    spForm._newAvatarFile = file;
  } catch (err) {
    showToast(err === "too_large" ? "File vượt quá 5MB!" : "File không phải ảnh!", "error");
  }
  e.target.value = "";
}

async function onSPGalleryChange(e) {
  for (const file of Array.from(e.target.files)) {
    try {
      const src = await readFileAsPreview(file);
      spForm._newGalleryFiles.push({ file, preview: src });
    } catch (err) {
      showToast(err === "too_large" ? `${file.name} vượt quá 5MB!` : `${file.name} không phải ảnh!`, "error");
    }
  }
  e.target.value = "";
}

function removeSPNewGallery(idx) { spForm._newGalleryFiles.splice(idx, 1); }
function markDeleteSPGallery(maHa) {
  spGallery[editingSpId.value] = spGallery[editingSpId.value].filter(h => h.maHa !== maHa);
  spForm._deleteGalleryIds.push(maHa);
}

async function onBTAvatarChange(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    const src = await readFileAsPreview(file);
    btForm.hinhAnhDaiDien = src;
    btForm._newAvatarFile = file;
  } catch (err) {
    showToast(err === "too_large" ? "File vượt quá 5MB!" : "File không phải ảnh!", "error");
  }
  e.target.value = "";
}

async function onBTGalleryChange(e) {
  for (const file of Array.from(e.target.files)) {
    try {
      const src = await readFileAsPreview(file);
      btForm._newGalleryFiles.push({ file, preview: src });
    } catch (err) {
      showToast(err === "too_large" ? `${file.name} vượt quá 5MB!` : `${file.name} không phải ảnh!`, "error");
    }
  }
  e.target.value = "";
}

function removeBTNewGallery(idx) { btForm._newGalleryFiles.splice(idx, 1); }
function markDeleteBTGallery(maHa) {
  btGallery[editingBtId.value] = btGallery[editingBtId.value].filter(h => h.maHa !== maHa);
  btForm._deleteGalleryIds.push(maHa);
}

// ══ LOAD DATA ══════════════════════════════════════════════════════
async function loadDanhMuc() {
  const res = await axios.get(`${API}/api/QuanLySanPham/danhmuc`);
  danhMucSPs.value = res.data;
}
async function loadThuongHieu() {
  const res = await axios.get(`${API}/api/QuanLySanPham/thuonghieu`);
  thuongHieus.value = res.data;
}

async function loadSanPham() {
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham`, {
      params: {
        keyword: search.value || null,
        maDanhMuc: filterCat.value || null,
        maTH: filterBrand.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    sanPhams.value = res.data.map(sp => ({
      maSP: sp.maSp, tenSP: sp.tenSp, maDanhMuc: sp.maDanhMuc,
      maTH: sp.maTh, hinhAnhDaiDien: toAbsUrl(sp.hinhAnhDaiDien),
      trangThai: sp.trangThai, soLuongBienThe: sp.soLuongBienThe ?? 0,
    }));
  } catch { showToast("Lỗi tải danh sách sản phẩm!", "error"); }
}

async function loadBienThe(maSP) {
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham/${maSP}/bienthe`);
    bienThes.value = [
      ...bienThes.value.filter(bt => bt.maSanPham !== maSP),
      ...res.data.map(bt => ({
        maBienThe: bt.maBienThe, maSanPham: bt.maSanPham,
        tenBienThe: bt.tenBienThe, giaBan: bt.giaBan,
        soLuong: bt.soLuong ?? 0, phanTramHoaHong: bt.phanTramHoaHong,
        hinhAnhDaiDien: toAbsUrl(bt.hinhAnhDaiDien), trangThai: bt.trangThai ?? 1,
      })),
    ];
  } catch { showToast("Lỗi tải biến thể!", "error"); }
}

async function loadGallerySP(maSP) {
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham/${maSP}/gallery`);
    spGallery[maSP] = res.data.map(h => ({ maHa: h.maHa, duongDan: toAbsUrl(h.duongDan) }));
  } catch { spGallery[maSP] = []; }
}

async function loadGalleryBT(maBienThe) {
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham/bienthe/${maBienThe}/gallery`);
    btGallery[maBienThe] = res.data.map(h => ({ maHa: h.maHa, duongDan: toAbsUrl(h.duongDan) }));
  } catch { btGallery[maBienThe] = []; }
}

// ══ COMPUTED ═══════════════════════════════════════════════════════
const toast = reactive({ show: false, msg: "", type: "success" });
const lightbox = reactive({ open: false, imgs: [], idx: 0 });

const totalActive = computed(() => sanPhams.value.filter(s => s.trangThai).length);
const totalBT = computed(() => bienThes.value.length);

const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  let arr = sanPhams.value.filter(sp => {
    const mq = !q || sp.tenSP.toLowerCase().includes(q) || sp.maSP.toLowerCase().includes(q);
    const mc = !filterCat.value || sp.maDanhMuc === filterCat.value;
    const mb = !filterBrand.value || sp.maTH === filterBrand.value;
    const ms = filterStatus.value === "" || String(sp.trangThai) === filterStatus.value;
    return mq && mc && mb && ms;
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

// ══ HELPERS ════════════════════════════════════════════════════════
const fmt = n => new Intl.NumberFormat("vi-VN").format(n) + "₫";
const getDMName = id => danhMucSPs.value.find(x => x.maDMSP === id)?.tenDanhMuc ?? "---";
const getTHName = id => thuongHieus.value.find(x => x.maTh === id)?.tenThuongHieu ?? "---";
function sortIcon(f) { return sortField.value !== f ? "↕" : sortDir.value === 1 ? "↑" : "↓"; }
function setSort(f) {
  sortField.value === f ? (sortDir.value *= -1) : ((sortField.value = f), (sortDir.value = 1));
  curPage.value = 1;
}
function getBTOfSP(maSP) { return bienThes.value.filter(bt => bt.maSanPham === maSP); }
function isExpanded(maSP) { return !!expandedProducts.value[maSP]; }
function toggleExpand(maSP) {
  if (expandedProducts.value[maSP]) { delete expandedProducts.value[maSP]; }
  else { expandedProducts.value[maSP] = true; loadBienThe(maSP); }
}
function getCatClass(maDanhMuc) {
  const classes = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5"];
  const idx = danhMucSPs.value.findIndex(x => x.maDMSP === maDanhMuc);
  return classes[idx % classes.length] ?? "cat-1";
}

// ══ TOAST ══════════════════════════════════════════════════════════
function showToast(msg, type = "success") {
  toast.msg = msg; toast.type = type; toast.show = true;
  setTimeout(() => { toast.show = false; }, 3000);
}

// ══ LIGHTBOX ═══════════════════════════════════════════════════════
function openLightbox(imgs, idx) { lightbox.imgs = imgs; lightbox.idx = idx; lightbox.open = true; }
function lbPrev() { lightbox.idx = (lightbox.idx - 1 + lightbox.imgs.length) % lightbox.imgs.length; }
function lbNext() { lightbox.idx = (lightbox.idx + 1) % lightbox.imgs.length; }

// ══ FILTER ═════════════════════════════════════════════════════════
function onFilterChange() { curPage.value = 1; loadSanPham(); }

// ══ SP MODAL ══════════════════════════════════════════════════════
function resetSpForm() {
  Object.assign(spForm, {
    maSP: "", tenSP: "", maDanhMuc: danhMucSPs.value[0]?.maDMSP ?? "",
    maTH: "", hinhAnhDaiDien: "", trangThai: 1,
    _newAvatarFile: null, _newGalleryFiles: [], _deleteGalleryIds: [],
  });
}

function openAddSP() {
  editingSpId.value = null; clearSpErrors(); resetSpForm();
  spModal.mode = "form"; spModal.title = "Thêm sản phẩm mới"; spModal.open = true;
}

async function openEditSP(sp) {
  editingSpId.value = sp.maSP; clearSpErrors();
  Object.assign(spForm, {
    maSP: sp.maSP, tenSP: sp.tenSP, maDanhMuc: sp.maDanhMuc, maTH: sp.maTH,
    hinhAnhDaiDien: sp.hinhAnhDaiDien, trangThai: sp.trangThai,
    _newAvatarFile: null, _newGalleryFiles: [], _deleteGalleryIds: [],
  });
  await loadGallerySP(sp.maSP);
  spModal.mode = "form"; spModal.title = "Chỉnh sửa sản phẩm"; spModal.open = true;
}

function openViewSP(sp) {
  spModal.mode = "view"; spModal.title = "Chi tiết sản phẩm"; spModal.open = true;
  Object.assign(spForm, sp);
  if (editingSpId.value !== sp.maSP) loadGallerySP(sp.maSP);
  editingSpId.value = sp.maSP;
}

function closeSpModal() { spModal.open = false; }

async function saveBT() {
  if (!validateBT()) { showToast("Kiểm tra lại thông tin biến thể!", "error"); return; }
  btSaving.value = true;
  try {
    const fd = new FormData();
    fd.append("MaSanPham", btForm.maSanPham);
    fd.append("TenBienThe", btForm.tenBienThe.trim());
    fd.append("GiaBan", btForm.giaBan);
    fd.append("SoLuong", btForm.soLuong ?? 0);
    fd.append("PhanTramHoaHong", btForm.phanTramHoaHong || 0);
    fd.append("TrangThai", btForm.trangThai);

    // ghi nhận nhân viên thực hiện thao tác, dùng để log lịch sử tồn kho khi backend phát hiện SoLuong thay đổi
    const nv = getCurrentNhanVien();
    if (nv?.maNv) fd.append("MaNv", nv.maNv);
    if (btForm.ghiChu && btForm.ghiChu.trim()) fd.append("GhiChu", btForm.ghiChu.trim());

    if (btForm._newAvatarFile) {
      fd.append("File", btForm._newAvatarFile);
    }
    for (const g of btForm._newGalleryFiles)
      fd.append("GalleryFiles", g.file);

    if (editingBtId.value) {
      for (const id of btForm._deleteGalleryIds) {
        await axios.delete(`${API}/api/QuanLySanPham/bienthe/gallery/${id}`);
      }
      await axios.put(`${API}/api/QuanLySanPham/bienthe/${editingBtId.value}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Cập nhật biến thể thành công!");
    } else {
      fd.append("MaBienThe", btForm.maBienThe.trim());
      await axios.post(`${API}/api/QuanLySanPham/bienthe`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Thêm biến thể thành công!");
    }
    closeBtModal(); await loadBienThe(btForm.maSanPham); await loadSanPham();
  } catch { showToast("Lỗi khi lưu biến thể!", "error"); }
  finally { btSaving.value = false; }
}

async function delSP(sp) {
  if (!confirm(`Xóa sản phẩm "${sp.tenSP}"?`)) return;
  try {
    await axios.delete(`${API}/api/QuanLySanPham/${sp.maSP}`);
    showToast("Đã xóa sản phẩm!"); await loadSanPham();
  } catch (err) {
  showToast(
    err.response?.data?.message || "Lỗi khi xóa sản phẩm!",
    "error"
  );
}
}

async function toggleStatusSP(sp) {
  try {
    await axios.patch(`${API}/api/QuanLySanPham/${sp.maSP}/trangthai`, { trangThai: sp.trangThai ? 0 : 1 });
    showToast("Đã cập nhật trạng thái!"); await loadSanPham();
  } catch { showToast("Lỗi khi đổi trạng thái!", "error"); }
}

// ══ BT MODAL ══════════════════════════════════════════════════════
function resetBtForm() {
  Object.assign(btForm, {
    maBienThe: "", maSanPham: "", tenBienThe: "", giaBan: "", soLuong: 0,
    phanTramHoaHong: "", hinhAnhDaiDien: "", trangThai: 1, ghiChu: "",
    _newAvatarFile: null, _newGalleryFiles: [], _deleteGalleryIds: [], _originalSoLuong: 0,
  });
}

function openAddBT(maSP) {
  editingBtId.value = null; currentBtSP.value = maSP; clearBtErrors(); resetBtForm();
  btForm.maSanPham = maSP;
  btModal.mode = "form"; btModal.title = "Thêm biến thể mới"; btModal.open = true;
}

async function openEditBT(bt) {
  editingBtId.value = bt.maBienThe; currentBtSP.value = bt.maSanPham; clearBtErrors();
  Object.assign(btForm, {
    maBienThe: bt.maBienThe, maSanPham: bt.maSanPham, tenBienThe: bt.tenBienThe,
    giaBan: bt.giaBan, soLuong: bt.soLuong, phanTramHoaHong: bt.phanTramHoaHong ?? "",
    hinhAnhDaiDien: bt.hinhAnhDaiDien, trangThai: bt.trangThai, ghiChu: "",
    _newAvatarFile: null, _newGalleryFiles: [], _deleteGalleryIds: [], _originalSoLuong: bt.soLuong ?? 0,
  });
  await loadGalleryBT(bt.maBienThe);
  btModal.mode = "form"; btModal.title = "Chỉnh sửa biến thể"; btModal.open = true;
}

function closeBtModal() { btModal.open = false; }

async function deleteBT(bt) {
  if (!confirm(`Xóa biến thể "${bt.tenBienThe}"?`)) return;
  try {
    await axios.delete(`${API}/api/QuanLySanPham/bienthe/${bt.maBienThe}`);
    showToast("Đã xóa biến thể!"); await loadBienThe(bt.maSanPham);
  } catch (err) {
  showToast(
    err.response?.data?.message || "Lỗi khi xóa biến thể!",
    "error"
  );
}
}

// ══ INIT ═══════════════════════════════════════════════════════════
onMounted(async () => {
  await Promise.all([loadDanhMuc(), loadThuongHieu()]);
  await loadSanPham();
});
</script>

<template>
  <div class="sp-manager">

    <!-- ── STATS ──────────────────────────────────────────────── -->
    <!-- <div class="stats-row">
      <div class="stat-card stat-dark">
        <div class="stat-icon">📦</div>
        <div class="stat-label">Tổng sản phẩm</div>
        <div class="stat-value">{{ sanPhams.length }}</div>
        <div class="stat-hint">{{ totalActive }} đang hoạt động</div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon">🏷️</div>
        <div class="stat-label">Danh mục</div>
        <div class="stat-value">{{ danhMucSPs.length }}</div>
        <div class="stat-hint">Đang sử dụng</div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon">🔖</div>
        <div class="stat-label">Thương hiệu</div>
        <div class="stat-value">{{ thuongHieus.length }}</div>
        <div class="stat-hint">Đã đăng ký</div>
      </div>
      <div class="stat-card stat-purple">
        <div class="stat-icon">🎛️</div>
        <div class="stat-label">Biến thể đã tải</div>
        <div class="stat-value">{{ totalBT }}</div>
        <div class="stat-hint">Trong phiên này</div>
      </div>
    </div> -->

    <!-- ── HEADER BAR ─────────────────────────────────────────── -->
    <div class="header-bar">
      <div class="page-title-text">Quản lý sản phẩm</div>
      <div class="header-actions">
        <button type="button" class="btn btn-primary btn-sm" @click="openAddSP">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v12M2 8h12" />
          </svg>
          Thêm sản phẩm
        </button>
      </div>
    </div>

    <!-- ── TOOLBAR ────────────────────────────────────────────── -->
    <div class="toolbar">
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
        </svg>
        <input v-model="search" placeholder="Tìm tên, mã sản phẩm..." @keyup.enter="onFilterChange" @input="curPage = 1" />
      </div>
      <select v-model="filterCat" class="filter-select" @change="onFilterChange">
        <option value="">Tất cả danh mục</option>
        <option v-for="dm in danhMucSPs" :key="dm.maDMSP" :value="dm.maDMSP">{{ dm.tenDanhMuc }}</option>
      </select>
      <select v-model="filterBrand" class="filter-select" @change="onFilterChange">
        <option value="">Tất cả thương hiệu</option>
        <option v-for="th in thuongHieus" :key="th.maTh" :value="th.maTh">{{ th.tenThuongHieu }}</option>
      </select>
      <select v-model="filterStatus" class="filter-select" @change="onFilterChange">
        <option value="">Tất cả trạng thái</option>
        <option value="1">Đang bán</option>
        <option value="0">Ngừng bán</option>
      </select>
      <span class="result-count">{{ filteredData.length }} kết quả</span>
      <select v-model.number="perPage" class="filter-select" style="width:auto;min-width:110px" @change="curPage = 1">
        <option :value="10">10 / trang</option>
        <option :value="20">20 / trang</option>
        <option :value="50">50 / trang</option>
        <option :value="9999">Tất cả</option>
      </select>
    </div>

    <!-- ── TABLE ──────────────────────────────────────────────── -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:56px">Ảnh</th>
            <th>Mã SP</th>
            <th class="sortable" @click="setSort('tenSP')">
              Tên sản phẩm <span class="sort-icon">{{ sortIcon("tenSP") }}</span>
            </th>
            <th>Danh mục</th>
            <th>Thương hiệu</th>
            <th class="sortable" @click="setSort('soLuongBienThe')">
              Biến thể <span class="sort-icon">{{ sortIcon("soLuongBienThe") }}</span>
            </th>
            <th>Trạng thái</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="pageData.length === 0">
            <td colspan="8">
              <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-text">Không tìm thấy sản phẩm nào</div>
              </div>
            </td>
          </tr>

          <template v-for="sp in pageData" :key="sp.maSP">
            <!-- Main row -->
            <tr class="sp-main-row" :class="{ 'row-expanded': isExpanded(sp.maSP) }">
              <td>
                <div class="thumb-wrap" @click="sp.hinhAnhDaiDien && openLightbox([sp.hinhAnhDaiDien], 0)">
                  <img v-if="sp.hinhAnhDaiDien" :src="sp.hinhAnhDaiDien" class="thumb-img" :alt="sp.tenSP" />
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
                <button type="button" class="expand-btn" @click="toggleExpand(sp.maSP)">
                  <svg class="expand-icon" :class="{ open: isExpanded(sp.maSP) }" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M4 6l4 4 4-4"/>
                  </svg>
                </button>
                <span class="code-text">{{ sp.maSP }}</span>
              </td>
              <td><div class="sp-name">{{ sp.tenSP }}</div></td>
              <td>
                <span class="cat-badge" :class="getCatClass(sp.maDanhMuc)">{{ getDMName(sp.maDanhMuc) }}</span>
              </td>
              <td>
                <span v-if="sp.maTH" class="brand-badge">{{ getTHName(sp.maTH) }}</span>
                <span v-else class="no-brand">—</span>
              </td>
              <td>
                <span class="bt-count-badge">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                    <rect x="1" y="5" width="6" height="6" rx="1"/>
                    <rect x="9" y="5" width="6" height="6" rx="1"/>
                    <rect x="5" y="2" width="6" height="3" rx="1"/>
                  </svg>
                  {{ sp.soLuongBienThe }} biến thể
                </span>
              </td>
              <td>
                <span class="status-pill" :class="sp.trangThai ? 'active' : 'inactive'">
                  <span class="status-dot"></span>{{ sp.trangThai ? "Đang bán" : "Ngừng bán" }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <button class="icon-btn view" title="Xem" @click="openViewSP(sp)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
                    </svg>
                  </button>
                  <button class="icon-btn edit" title="Sửa" @click="openEditSP(sp)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M11 2l3 3L5 14H2v-3L11 2z"/>
                    </svg>
                  </button>
                  <button class="icon-btn del" title="Xóa" @click="delSP(sp)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>

            <!-- Expanded: Biến thể -->
            <tr v-if="isExpanded(sp.maSP)" class="sp-detail-row">
              <td colspan="8">
                <div class="nested-panel">
                  <div class="nested-header">
                    <h4 class="nested-title">
                      Biến thể sản phẩm
                      <span class="nested-count">{{ getBTOfSP(sp.maSP).length }}</span>
                    </h4>
                    <button type="button" class="btn btn-sm btn-nested-add" @click="openAddBT(sp.maSP)">
                      + Thêm biến thể
                    </button>
                  </div>

                  <div v-if="getBTOfSP(sp.maSP).length === 0" class="nested-empty">
                    Chưa có biến thể. Nhấn "+ Thêm biến thể" để bắt đầu.
                  </div>

                  <div v-else class="bt-table-wrap">
                    <table class="bt-table">
                      <thead>
                        <tr>
                          <th style="width:44px">Ảnh</th>
                          <th>Mã BT</th>
                          <th>Tên biến thể</th>
                          <th>Giá bán</th>
                          <th>Tồn kho</th>
                          <th>Hoa hồng</th>
                          <th>Trạng thái</th>
                          <th>Thao tác</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="bt in getBTOfSP(sp.maSP)" :key="bt.maBienThe" class="bt-display-row">
                          <td>
                            <div class="thumb-wrap" style="width:36px;height:36px"
                              @click="bt.hinhAnhDaiDien && openLightbox([bt.hinhAnhDaiDien], 0)">
                              <img v-if="bt.hinhAnhDaiDien" :src="bt.hinhAnhDaiDien" class="bt-thumb" />
                              <div v-else class="thumb-placeholder" style="width:36px;height:36px;border-radius:6px">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                                  <circle cx="8.5" cy="8.5" r="1.5"/>
                                  <path d="M21 15l-5-5L5 21"/>
                                </svg>
                              </div>
                            </div>
                          </td>
                          <td><span class="code-text">{{ bt.maBienThe }}</span></td>
                          <td><span class="bt-name">{{ bt.tenBienThe }}</span></td>
                          <td class="price-cell">{{ fmt(bt.giaBan) }}</td>
                          <td>
                            <span class="stock-badge" :class="bt.soLuong > 0 ? 'stock-ok' : 'stock-zero'">
                              {{ bt.soLuong }}
                            </span>
                          </td>
                          <td class="pct-cell">{{ bt.phanTramHoaHong != null ? bt.phanTramHoaHong + '%' : '—' }}</td>
                          <td>
                            <span class="status-pill" :class="bt.trangThai ? 'active' : 'inactive'" style="font-size:11px;padding:2px 8px">
                              <span class="status-dot"></span>{{ bt.trangThai ? "Còn hàng" : "Hết hàng" }}
                            </span>
                          </td>
                          <td>
                            <div class="actions">
                              <button class="icon-btn edit icon-btn-xs" title="Sửa biến thể" @click="openEditBT(bt)">
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                                  <path d="M11 2l3 3L5 14H2v-3L11 2z"/>
                                </svg>
                              </button>
                              <button class="icon-btn del icon-btn-xs" title="Xóa biến thể" @click="deleteBT(bt)">
                                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                                  <path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/>
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Pagination -->
      <div v-if="filteredData.length > 0 && perPage < 9999" class="pager-wrap">
        <span>Hiển thị {{ (curPage - 1) * perPage + 1 }}–{{ Math.min(curPage * perPage, filteredData.length) }} / {{ filteredData.length }} mục</span>
        <div class="pager-btns">
          <button class="page-btn" :disabled="curPage <= 1" @click="curPage--">‹</button>
          <button v-for="p in pageRange" :key="p" class="page-btn" :class="{ cur: p === curPage }" @click="curPage = p">{{ p }}</button>
          <button class="page-btn" :disabled="curPage >= totalPages" @click="curPage++">›</button>
        </div>
      </div>
    </div>

    <!-- ══ MODAL SẢN PHẨM ══════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="spModal.open" class="modal-overlay" @click.self="closeSpModal">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3 class="modal-title">{{ spModal.title }}</h3>
            <button class="modal-close" @click="closeSpModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 2l12 12M14 2L2 14"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- View mode -->
            <template v-if="spModal.mode === 'view'">
              <div class="detail-grid">
                <div>
                  <div class="thumb-wrap" style="width:120px;height:120px;cursor:pointer"
                    @click="spForm.hinhAnhDaiDien && openLightbox([spForm.hinhAnhDaiDien], 0)">
                    <img v-if="spForm.hinhAnhDaiDien" :src="spForm.hinhAnhDaiDien" style="width:120px;height:120px;object-fit:cover;border-radius:10px;border:1px solid #e5e7eb" />
                    <div v-else class="thumb-placeholder" style="width:120px;height:120px;border-radius:10px">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <path d="M21 15l-5-5L5 21"/>
                      </svg>
                    </div>
                  </div>
                </div>
                <div class="detail-info-col">
                  <div class="detail-row"><span class="detail-label">Mã SP</span><span class="code-text">{{ spForm.maSP }}</span></div>
                  <div class="detail-row"><span class="detail-label">Tên sản phẩm</span><span class="detail-val">{{ spForm.tenSP }}</span></div>
                  <div class="detail-row"><span class="detail-label">Danh mục</span>
                    <span class="cat-badge" :class="getCatClass(spForm.maDanhMuc)">{{ getDMName(spForm.maDanhMuc) }}</span>
                  </div>
                  <div class="detail-row"><span class="detail-label">Thương hiệu</span><span class="detail-val">{{ getTHName(spForm.maTH) }}</span></div>
                  <div class="detail-row"><span class="detail-label">Biến thể</span>
                    <span class="bt-count-badge">{{ spForm.soLuongBienThe ?? 0 }} biến thể</span>
                  </div>
                  <div class="detail-row"><span class="detail-label">Trạng thái</span>
                    <span class="status-pill" :class="spForm.trangThai ? 'active' : 'inactive'">
                      <span class="status-dot"></span>{{ spForm.trangThai ? "Đang bán" : "Ngừng bán" }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Gallery xem -->
              <div v-if="spGallery[spForm.maSP]?.length" class="gallery-section">
                <div class="gallery-label">Ảnh gallery ({{ spGallery[spForm.maSP].length }})</div>
                <div class="gallery-grid">
                  <div v-for="(h, i) in spGallery[spForm.maSP]" :key="h.maHa" class="gallery-thumb-wrap"
                    @click="openLightbox(spGallery[spForm.maSP].map(x => x.duongDan), i)">
                    <img :src="h.duongDan" class="gallery-thumb" />
                  </div>
                </div>
              </div>
            </template>

            <!-- Form add/edit -->
            <template v-else>
              <div class="form-row-2">
                <div class="form-group" v-if="!editingSpId">
                  <label class="form-label">Mã sản phẩm *</label>
                  <input v-model="spForm.maSP" class="form-input" :class="{ 'input-error': spErrors.maSP }" placeholder="VD: SP001" maxlength="10" />
                  <p v-if="spErrors.maSP" class="field-error">{{ spErrors.maSP }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Tên sản phẩm *</label>
                  <input v-model="spForm.tenSP" class="form-input" :class="{ 'input-error': spErrors.tenSP }" placeholder="Nhập tên sản phẩm" />
                  <p v-if="spErrors.tenSP" class="field-error">{{ spErrors.tenSP }}</p>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Danh mục *</label>
                  <select v-model="spForm.maDanhMuc" class="form-input" :class="{ 'input-error': spErrors.maDanhMuc }">
                    <option value="">-- Chọn danh mục --</option>
                    <option v-for="dm in danhMucSPs" :key="dm.maDMSP" :value="dm.maDMSP">{{ dm.tenDanhMuc }}</option>
                  </select>
                  <p v-if="spErrors.maDanhMuc" class="field-error">{{ spErrors.maDanhMuc }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Thương hiệu</label>
                  <select v-model="spForm.maTH" class="form-input">
                    <option value="">-- Không có --</option>
                    <option v-for="th in thuongHieus" :key="th.maTh" :value="th.maTh">{{ th.tenThuongHieu }}</option>
                  </select>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Trạng thái</label>
                  <select v-model.number="spForm.trangThai" class="form-input">
                    <option :value="1">Đang bán</option>
                    <option :value="0">Ngừng bán</option>
                  </select>
                </div>
              </div>

              <!-- Ảnh đại diện -->
              <div class="form-group">
                <label class="form-label">Ảnh đại diện</label>
                <div class="upload-zone"
                  @dragover.prevent
                  @drop.prevent="async (e) => { const f = e.dataTransfer.files[0]; if (f) { try { spForm.hinhAnhDaiDien = await readFileAsPreview(f); spForm._newAvatarFile = f; } catch {} } }"
                  @click="spImgInput?.click()">
                  <div v-if="!spForm.hinhAnhDaiDien" class="upload-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                    </svg>
                    <span>Kéo thả hoặc nhấn để chọn ảnh</span>
                    <span class="upload-hint">PNG, JPG tối đa 5MB</span>
                  </div>
                  <div v-else class="upload-preview-single">
                    <img :src="spForm.hinhAnhDaiDien" class="upload-preview-img" />
                    <button type="button" class="remove-single-img" @click.stop="spForm.hinhAnhDaiDien = ''; spForm._newAvatarFile = null">✕</button>
                  </div>
                </div>
                <input ref="spImgInput" type="file" accept="image/*" style="display:none" @change="onSPAvatarChange" />
              </div>

              <!-- Gallery ảnh sản phẩm -->
              <div class="form-group">
                <label class="form-label">Gallery ảnh sản phẩm</label>

                <!-- Ảnh gallery đã có (khi edit) -->
                <div v-if="editingSpId && spGallery[editingSpId]?.length" class="gallery-edit-grid">
                  <div v-for="h in spGallery[editingSpId]" :key="h.maHa" class="gallery-edit-item">
                    <img :src="h.duongDan" class="gallery-edit-thumb" @click="openLightbox([h.duongDan], 0)" />
                    <button type="button" class="gallery-delete-btn" @click="markDeleteSPGallery(h.maHa)" title="Xóa ảnh">✕</button>
                  </div>
                </div>

                <!-- Ảnh gallery mới -->
                <div v-if="spForm._newGalleryFiles.length" class="gallery-edit-grid" style="margin-top:8px">
                  <div v-for="(g, idx) in spForm._newGalleryFiles" :key="idx" class="gallery-edit-item gallery-new-item">
                    <img :src="g.preview" class="gallery-edit-thumb" />
                    <button type="button" class="gallery-delete-btn" @click="removeSPNewGallery(idx)">✕</button>
                    <span class="gallery-new-badge">Mới</span>
                  </div>
                </div>

                <button type="button" class="gallery-add-btn" @click="spGalleryInput?.click()">
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M8 2v12M2 8h12" />
                  </svg>
                  Thêm ảnh phụ
                </button>
                <input ref="spGalleryInput" type="file" accept="image/*" multiple style="display:none" @change="onSPGalleryChange" />
                <p class="upload-hint" style="margin-top:4px">Tối đa 10 ảnh, mỗi ảnh ≤ 5MB</p>
              </div>
            </template>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeSpModal">
              {{ spModal.mode === 'view' ? 'Đóng' : 'Hủy' }}
            </button>
            <button v-if="spModal.mode !== 'view'" type="button" class="btn btn-primary" :disabled="saving" @click="saveSP">
              <span v-if="saving" class="spinner"></span>
              {{ saving ? "Đang lưu..." : editingSpId ? "Cập nhật" : "Thêm mới" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ MODAL BIẾN THỂ ══════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="btModal.open" class="modal-overlay" @click.self="closeBtModal">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3 class="modal-title">{{ btModal.title }}</h3>
            <button class="modal-close" @click="closeBtModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M2 2l12 12M14 2L2 14"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <!-- Mã biến thể (chỉ khi thêm mới) -->
            <div class="form-row-2">
              <div v-if="!editingBtId" class="form-group">
                <label class="form-label">Mã biến thể *</label>
                <input v-model="btForm.maBienThe" class="form-input" :class="{ 'input-error': btErrors.maBienThe }" placeholder="VD: BT001" maxlength="10" />
                <p v-if="btErrors.maBienThe" class="field-error">{{ btErrors.maBienThe }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Tên biến thể *</label>
                <input v-model="btForm.tenBienThe" class="form-input" :class="{ 'input-error': btErrors.tenBienThe }" placeholder="VD: Màu đỏ - Size L" />
                <p v-if="btErrors.tenBienThe" class="field-error">{{ btErrors.tenBienThe }}</p>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Giá bán (₫) *</label>
                <input v-model="btForm.giaBan" type="number" min="0" class="form-input" :class="{ 'input-error': btErrors.giaBan }" placeholder="0" />
                <p v-if="btErrors.giaBan" class="field-error">{{ btErrors.giaBan }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Số lượng tồn</label>
                <input v-model.number="btForm.soLuong" type="number" min="0" class="form-input" :class="{ 'input-error': btErrors.soLuong }" placeholder="0" />
                <p v-if="btErrors.soLuong" class="field-error">{{ btErrors.soLuong }}</p>
              </div>
            </div>
            <div v-if="editingBtId && Number(btForm.soLuong) !== Number(btForm._originalSoLuong)" class="form-row-2">
              <div class="form-group" style="flex: 1 1 100%;">
                <label class="form-label">Lý do điều chỉnh số lượng *</label>
                <input v-model="btForm.ghiChu" class="form-input" :class="{ 'input-error': btErrors.ghiChu }" placeholder="VD: Kiểm kê phát hiện thiếu, hàng lỗi, nhập tay điều chỉnh..." maxlength="255" />
                <p v-if="btErrors.ghiChu" class="field-error">{{ btErrors.ghiChu }}</p>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Hoa hồng (%)</label>
                <input v-model="btForm.phanTramHoaHong" type="number" min="0" max="100" step="0.1" class="form-input" :class="{ 'input-error': btErrors.phanTramHoaHong }" placeholder="0" />
                <p v-if="btErrors.phanTramHoaHong" class="field-error">{{ btErrors.phanTramHoaHong }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Trạng thái</label>
                <select v-model.number="btForm.trangThai" class="form-input">
                  <option :value="1">Còn hàng</option>
                  <option :value="0">Hết hàng</option>
                </select>
              </div>
            </div>

            <!-- Ảnh đại diện biến thể -->
            <div class="form-group">
              <label class="form-label">Ảnh đại diện biến thể</label>
              <div class="upload-zone"
                @dragover.prevent
                @drop.prevent="async (e) => { const f = e.dataTransfer.files[0]; if (f) { try { btForm.hinhAnhDaiDien = await readFileAsPreview(f); btForm._newAvatarFile = f; } catch {} } }"
                @click="btImgInput?.click()">
                <div v-if="!btForm.hinhAnhDaiDien" class="upload-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <span>Kéo thả hoặc nhấn để chọn ảnh</span>
                  <span class="upload-hint">PNG, JPG tối đa 5MB</span>
                </div>
                <div v-else class="upload-preview-single">
                  <img :src="btForm.hinhAnhDaiDien" class="upload-preview-img" />
                  <button type="button" class="remove-single-img" @click.stop="btForm.hinhAnhDaiDien = ''; btForm._newAvatarFile = null">✕</button>
                </div>
              </div>
              <input ref="btImgInput" type="file" accept="image/*" style="display:none" @change="onBTAvatarChange" />
            </div>

            <!-- Gallery ảnh biến thể -->
            <div class="form-group">
              <label class="form-label">Gallery ảnh biến thể</label>

              <!-- Ảnh gallery đã có (khi edit) -->
              <div v-if="editingBtId && btGallery[editingBtId]?.length" class="gallery-edit-grid">
                <div v-for="h in btGallery[editingBtId]" :key="h.maHa" class="gallery-edit-item">
                  <img :src="h.duongDan" class="gallery-edit-thumb" @click="openLightbox([h.duongDan], 0)" />
                  <button type="button" class="gallery-delete-btn" @click="markDeleteBTGallery(h.maHa)">✕</button>
                </div>
              </div>

              <!-- Ảnh gallery mới -->
              <div v-if="btForm._newGalleryFiles.length" class="gallery-edit-grid" style="margin-top:8px">
                <div v-for="(g, idx) in btForm._newGalleryFiles" :key="idx" class="gallery-edit-item gallery-new-item">
                  <img :src="g.preview" class="gallery-edit-thumb" />
                  <button type="button" class="gallery-delete-btn" @click="removeBTNewGallery(idx)">✕</button>
                  <span class="gallery-new-badge">Mới</span>
                </div>
              </div>

              <button type="button" class="gallery-add-btn" @click="btGalleryInput?.click()">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M8 2v12M2 8h12" />
                </svg>
                Thêm ảnh phụ
              </button>
              <input ref="btGalleryInput" type="file" accept="image/*" multiple style="display:none" @change="onBTGalleryChange" />
              <p class="upload-hint" style="margin-top:4px">Tối đa 10 ảnh, mỗi ảnh ≤ 5MB</p>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeBtModal">Hủy</button>
            <button type="button" class="btn btn-primary" :disabled="btSaving" @click="saveBT">
              <span v-if="btSaving" class="spinner"></span>
              {{ btSaving ? "Đang lưu..." : editingBtId ? "Cập nhật" : "Thêm biến thể" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ LIGHTBOX ══════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="lightbox.open" class="lb-overlay" @click.self="lightbox.open = false">
        <button class="lb-close" @click="lightbox.open = false">✕</button>
        <button v-if="lightbox.imgs.length > 1" class="lb-nav lb-prev" @click="lbPrev">‹</button>
        <img :src="lightbox.imgs[lightbox.idx]" class="lb-img" />
        <button v-if="lightbox.imgs.length > 1" class="lb-nav lb-next" @click="lbNext">›</button>
        <div v-if="lightbox.imgs.length > 1" class="lb-dots">
          <span v-for="(_, i) in lightbox.imgs" :key="i" class="lb-dot" :class="{ active: i === lightbox.idx }" @click="lightbox.idx = i"></span>
        </div>
      </div>
    </Teleport>

    <!-- ══ TOAST ═════════════════════════════════════════════════════ -->
    <div class="toast" :class="[{ show: toast.show }, toast.type]">
      <span>{{ toast.type === "success" ? "✅" : "❌" }}</span>
      {{ toast.msg }}
    </div>
  </div>
</template>

<style scoped>
/* ── ROOT ───────────────────────────────────────────────────────── */
.sp-manager {
  padding: 24px;
  font-family: "Jost", "Inter", sans-serif;
  color: #1a1a2e;
  background: #f8f9fb;
  min-height: 100vh;
}

/* ── STATS ──────────────────────────────────────────────────────── */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 3px; }
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-label { font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 26px; font-weight: 700; color: #1a1a2e; line-height: 1.1; }
.stat-hint { font-size: 11px; color: #9ca3af; margin-top: 2px; }
.stat-dark { border-top: 3px solid #1a1a2e; }
.stat-green { border-top: 3px solid #22c55e; }
.stat-blue { border-top: 3px solid #3b82f6; }
.stat-purple { border-top: 3px solid #8b5cf6; }

/* ── HEADER ─────────────────────────────────────────────────────── */
.header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.page-title-text { font-size: 17px; font-weight: 700; color: #1a1a2e; letter-spacing: 0.2px; }
.header-actions { display: flex; gap: 8px; }

/* ── BUTTONS ────────────────────────────────────────────────────── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: #1a1a2e; color: #fff; }
.btn-primary:hover:not(:disabled) { background: #2d2d4e; transform: translateY(-1px); }
.btn-ghost { background: transparent; color: #6b7280; border: 1px solid #e5e7eb; }
.btn-ghost:hover:not(:disabled) { color: #1a1a2e; border-color: #d1d5db; background: #f9fafb; }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── TOOLBAR ────────────────────────────────────────────────────── */
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 8px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 12px; min-width: 200px; flex: 1; max-width: 300px; transition: border 0.15s; }
.search-box:focus-within { border-color: #6b7280; }
.search-box input { background: transparent; border: none; outline: none; color: #1a1a2e; font-size: 13px; font-family: inherit; width: 100%; }
.search-box input::placeholder { color: #9ca3af; }
.filter-select { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 7px 10px; color: #374151; font-size: 13px; font-family: inherit; cursor: pointer; outline: none; }
.result-count { font-size: 12px; color: #9ca3af; margin-left: auto; }

/* ── TABLE ──────────────────────────────────────────────────────── */
.table-wrap { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: #9ca3af; letter-spacing: 0.5px; border-bottom: 1px solid #f3f4f6; background: #fafafa; white-space: nowrap; text-transform: uppercase; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: #374151; }
.sort-icon { font-size: 10px; }
tbody tr { border-bottom: 1px solid #f3f4f6; transition: background 0.12s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: #fafafa; }
tbody td { padding: 10px 14px; font-size: 13px; vertical-align: middle; }
.code-text { font-size: 12px; color: #6b7280; font-family: "Courier New", monospace; background: #f3f4f6; padding: 2px 7px; border-radius: 4px; }
.sp-name { font-weight: 500; color: #1a1a2e; }
.price-cell { font-weight: 600; color: #d97706; }
.pct-cell { font-size: 12px; color: #6b7280; }

/* ── THUMBNAIL ──────────────────────────────────────────────────── */
.thumb-wrap { position: relative; width: 42px; height: 42px; cursor: pointer; flex-shrink: 0; }
.thumb-img { width: 42px; height: 42px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; display: block; transition: opacity 0.15s; }
.thumb-img:hover { opacity: 0.82; }
.thumb-placeholder { width: 42px; height: 42px; border-radius: 8px; border: 1.5px dashed #d1d5db; background: #f9fafb; display: flex; align-items: center; justify-content: center; color: #d1d5db; }

/* ── BADGES ─────────────────────────────────────────────────────── */
.cat-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; }
.cat-1 { background: #eff6ff; color: #1d4ed8; }
.cat-2 { background: #fdf4ff; color: #7e22ce; }
.cat-3 { background: #fff7ed; color: #c2410c; }
.cat-4 { background: #f0fdf4; color: #15803d; }
.cat-5 { background: #fef9c3; color: #854d0e; }
.brand-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; background: #f3f4f6; color: #374151; }
.no-brand { color: #d1d5db; font-size: 13px; }
.bt-count-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; background: #f0f9ff; color: #0369a1; }
.stock-badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.stock-ok { background: #f0fdf4; color: #15803d; }
.stock-zero { background: #fef2f2; color: #dc2626; }

/* ── STATUS ─────────────────────────────────────────────────────── */
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.status-pill.active { background: #f0fdf4; color: #15803d; }
.status-pill.inactive { background: #f9fafb; color: #9ca3af; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

/* ── ACTIONS ────────────────────────────────────────────────────── */
.actions { display: flex; gap: 4px; align-items: center; }
.icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9ca3af; transition: all 0.12s; }
.icon-btn:hover { background: #f9fafb; color: #374151; border-color: #d1d5db; }
.icon-btn.view:hover { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }
.icon-btn.edit:hover { color: #d97706; border-color: #fde68a; background: #fffbeb; }
.icon-btn.del:hover { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
.icon-btn-xs { width: 24px; height: 24px; }

/* ── EMPTY ──────────────────────────────────────────────────────── */
.empty-state { text-align: center; padding: 40px; }
.empty-icon { font-size: 36px; margin-bottom: 8px; }
.empty-text { color: #9ca3af; font-size: 14px; }

/* ── PAGINATION ─────────────────────────────────────────────────── */
.pager-wrap { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af; }
.pager-btns { display: flex; gap: 4px; }
.page-btn { min-width: 28px; height: 28px; padding: 0 6px; border-radius: 6px; border: 1px solid #e5e7eb; background: #fff; font-size: 12px; cursor: pointer; color: #6b7280; transition: all 0.12s; }
.page-btn:disabled { opacity: 0.4; cursor: default; }
.page-btn:hover:not(:disabled):not(.cur) { border-color: #d1d5db; background: #f9fafb; }
.page-btn.cur { background: #1a1a2e; color: #fff; border-color: #1a1a2e; }

/* ── EXPAND ─────────────────────────────────────────────────────── */
.expand-btn { background: none; border: none; cursor: pointer; color: #9ca3af; padding: 2px 4px; margin-right: 6px; display: inline-flex; align-items: center; transition: color 0.15s; vertical-align: middle; }
.expand-btn:hover { color: #1a1a2e; }
.expand-icon { transition: transform 0.2s; }
.expand-icon.open { transform: rotate(180deg); }

/* ── NESTED PANEL ───────────────────────────────────────────────── */
.sp-main-row.row-expanded { background: #f8fafc; }
.sp-detail-row { background: #fafbfc; }
.sp-detail-row td { padding: 0 !important; }
.nested-panel { padding: 14px 18px; border-top: 1px solid #e5e7eb; background: #fafbfc; }
.nested-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.nested-title { font-size: 13px; font-weight: 600; color: #374151; margin: 0; }
.nested-count { background: #e5e7eb; font-size: 11px; padding: 1px 8px; border-radius: 10px; margin-left: 6px; font-weight: 500; }
.btn-nested-add { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
.btn-nested-add:hover { background: #dcfce7; }
.nested-empty { font-size: 12px; color: #9ca3af; text-align: center; padding: 16px; }

/* ── BT TABLE ───────────────────────────────────────────────────── */
.bt-table-wrap { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 8px; }
.bt-table { width: 100%; border-collapse: collapse; }
.bt-table thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600; color: #9ca3af; letter-spacing: 0.4px; border-bottom: 1px solid #f3f4f6; background: #f9fafb; text-transform: uppercase; }
.bt-table tbody tr { border-bottom: 1px solid #f3f4f6; transition: background 0.1s; }
.bt-table tbody tr:last-child { border-bottom: none; }
.bt-table tbody tr:hover { background: #fafafa; }
.bt-table tbody td { padding: 8px 12px; font-size: 12px; vertical-align: middle; }
.bt-name { font-weight: 500; color: #374151; }
.bt-thumb { width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid #e5e7eb; display: block; }

/* ── MODAL ──────────────────────────────────────────────────────── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 20px; }
.modal { background: #fff; border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
.modal-wide { width: 580px; max-width: 95vw; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid #f3f4f6; }
.modal-title { font-size: 15px; font-weight: 700; color: #1a1a2e; margin: 0; }
.modal-close { width: 28px; height: 28px; border: 1px solid #e5e7eb; border-radius: 6px; background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9ca3af; }
.modal-close:hover { background: #f9fafb; color: #374151; }
.modal-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
.modal-footer { padding: 14px 22px; border-top: 1px solid #f3f4f6; display: flex; justify-content: flex-end; gap: 8px; }

/* ── FORM ───────────────────────────────────────────────────────── */
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.form-label { font-size: 12px; font-weight: 600; color: #374151; }
.form-input { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 12px; font-size: 13px; color: #1a1a2e; font-family: inherit; outline: none; transition: border 0.15s; }
.form-input:focus { border-color: #6b7280; box-shadow: 0 0 0 3px rgba(107,114,128,0.07); }
.input-error { border-color: #f87171 !important; }
.field-error { font-size: 11px; color: #dc2626; margin: 2px 0 0; }

/* ── UPLOAD ZONE ────────────────────────────────────────────────── */
.upload-zone { border: 1.5px dashed #d1d5db; border-radius: 10px; background: #f9fafb; cursor: pointer; display: flex; align-items: center; justify-content: center; min-height: 110px; transition: all 0.15s; }
.upload-zone:hover { background: #f3f4f6; border-color: #9ca3af; }
.upload-placeholder { display: flex; flex-direction: column; align-items: center; gap: 6px; color: #9ca3af; font-size: 12px; }
.upload-hint { font-size: 11px; color: #9ca3af; }
.upload-preview-single { position: relative; display: inline-block; }
.upload-preview-img { width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; display: block; }
.remove-single-img { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: #1a1a2e; color: #fff; border: none; font-size: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

/* ── GALLERY ────────────────────────────────────────────────────── */
.gallery-section { margin-top: 16px; }
.gallery-label { font-size: 12px; font-weight: 600; color: #374151; margin-bottom: 8px; }
.gallery-grid { display: flex; gap: 8px; flex-wrap: wrap; }
.gallery-thumb-wrap { width: 70px; height: 70px; border-radius: 8px; overflow: hidden; cursor: pointer; border: 1px solid #e5e7eb; }
.gallery-thumb { width: 70px; height: 70px; object-fit: cover; transition: opacity 0.15s; }
.gallery-thumb:hover { opacity: 0.8; }

.gallery-edit-grid { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.gallery-edit-item { position: relative; width: 72px; height: 72px; border-radius: 8px; overflow: visible; }
.gallery-edit-thumb { width: 72px; height: 72px; object-fit: cover; border-radius: 8px; border: 1px solid #e5e7eb; cursor: pointer; display: block; }
.gallery-edit-thumb:hover { opacity: 0.8; }
.gallery-delete-btn { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: #dc2626; color: #fff; border: none; font-size: 9px; cursor: pointer; display: flex; align-items: center; justify-content: center; line-height: 1; z-index: 1; }
.gallery-delete-btn:hover { background: #b91c1c; }
.gallery-new-item { border: 2px dashed #3b82f6; border-radius: 8px; }
.gallery-new-badge { position: absolute; bottom: 2px; left: 2px; background: #2563eb; color: #fff; font-size: 9px; padding: 1px 5px; border-radius: 4px; font-weight: 600; }
.gallery-add-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border: 1.5px dashed #d1d5db; border-radius: 8px; background: #f9fafb; color: #6b7280; font-size: 12px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
.gallery-add-btn:hover { border-color: #9ca3af; background: #f3f4f6; color: #374151; }

/* ── DETAIL VIEW ────────────────────────────────────────────────── */
.detail-grid { display: grid; grid-template-columns: auto 1fr; gap: 20px; align-items: start; }
.detail-info-col { display: flex; flex-direction: column; gap: 10px; }
.detail-row { display: flex; align-items: center; gap: 10px; }
.detail-label { font-size: 12px; font-weight: 600; color: #9ca3af; min-width: 120px; }
.detail-val { font-size: 13px; color: #1a1a2e; }

/* ── LIGHTBOX ───────────────────────────────────────────────────── */
.lb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.lb-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; object-fit: contain; }
.lb-close { position: absolute; top: 16px; right: 20px; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 20px; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.lb-nav { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 28px; cursor: pointer; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.lb-prev { left: 20px; }
.lb-next { right: 20px; }
.lb-dots { position: absolute; bottom: 20px; display: flex; gap: 6px; }
.lb-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; transition: background 0.15s; }
.lb-dot.active { background: #fff; }

/* ── TOAST ──────────────────────────────────────────────────────── */
.toast { position: fixed; bottom: 24px; right: 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #1a1a2e; display: flex; align-items: center; gap: 9px; z-index: 1000; transform: translateY(20px); opacity: 0; transition: all 0.25s; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-width: 320px; }
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: #bbf7d0; }
.toast.error { border-color: #fecaca; }

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .form-row-2 { grid-template-columns: 1fr; }
  .detail-grid { grid-template-columns: 1fr; }
  .header-bar { flex-direction: column; align-items: flex-start; }
  .result-count { margin-left: 0; }
  .modal-wide { width: 95vw; }
}
@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
}
</style>