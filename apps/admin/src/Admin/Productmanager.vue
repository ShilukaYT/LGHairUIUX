<script setup>
import { ref, computed, reactive, onMounted, watch } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";
import { useTheme } from "vuetify";
import {
  Plus, Pencil, Trash2, Eye, Search, ImageOff, ChevronDown,
  Check, X, RotateCcw,
} from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;

// ── DARK / LIGHT MODE (đồng bộ với ProfileDD - Cài đặt Sáng/Tối) ──
const vuetifyTheme = useTheme();
const isDarkMode = computed(() => vuetifyTheme.global.name.value === "dark");

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
const expandedRows = ref([]);
const isLoading = ref(false);

// Phân trang server-side: đổi trang -> chỉ gọi API cho đúng trang đó
const page = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);
const totalPages = ref(1);

// Gallery state
const spGallery = reactive({}); // maSP -> [{ maHa, duongDan }]
const btGallery = reactive({}); // maBienThe -> [{ maHa, duongDan }]

// ══ STATE ══════════════════════════════════════════════════════════
const search = ref("");
const filterCat = ref("");
const filterBrand = ref("");
const filterStatus = ref("");
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
  isLoading.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham`, {
      params: {
        keyword: search.value || null,
        maDanhMuc: filterCat.value || null,
        maTH: filterBrand.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
        page: page.value,
        pageSize: itemsPerPage.value,
      },
    });
    const rows = res.data.data ?? [];
    sanPhams.value = rows.map(sp => ({
      maSP: sp.maSp, tenSP: sp.tenSp, maDanhMuc: sp.maDanhMuc,
      maTH: sp.maTh, hinhAnhDaiDien: toAbsUrl(sp.hinhAnhDaiDien),
      trangThai: sp.trangThai, soLuongBienThe: sp.soLuongBienThe ?? 0,
    }));
    totalItems.value = res.data.total ?? rows.length;
    totalPages.value = res.data.totalPages ?? 1;
  } catch { showToast("Lỗi tải danh sách sản phẩm!", "error"); }
  finally { isLoading.value = false; }
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

// ══ SNACKBAR (Vuetify) ═════════════════════════════════════════════
const snackbar = ref({ show: false, text: "", color: "success" });
function showToast(msg, type = "success") {
  snackbar.value.text = msg;
  snackbar.value.color = type === "success" ? "success" : "error";
  snackbar.value.show = true;
}

// ══ LIGHTBOX ═══════════════════════════════════════════════════════
const lightbox = reactive({ open: false, imgs: [], idx: 0 });
function openLightbox(imgs, idx) { lightbox.imgs = imgs; lightbox.idx = idx; lightbox.open = true; }
function lbPrev() { lightbox.idx = (lightbox.idx - 1 + lightbox.imgs.length) % lightbox.imgs.length; }
function lbNext() { lightbox.idx = (lightbox.idx + 1) % lightbox.imgs.length; }

// ══ COMPUTED ═══════════════════════════════════════════════════════
const totalActive = computed(() => sanPhams.value.filter(s => s.trangThai).length);
const totalBT = computed(() => bienThes.value.length);

// Dữ liệu đã được BE lọc + phân trang sẵn (đúng trang đang xem), FE chỉ hiển thị nguyên trạng
const filteredData = computed(() => sanPhams.value);

// ══ HEADERS cho v-data-table ═══════════════════════════════════════
const headers = [
  { title: "Ảnh", key: "hinhAnhDaiDien", align: "center", sortable: false, width: 70 },
  { title: "Mã SP", key: "maSP", align: "start", sortable: true },
  { title: "Tên sản phẩm", key: "tenSP", align: "start", sortable: true },
  { title: "Danh mục", key: "maDanhMuc", align: "start", sortable: false },
  { title: "Thương hiệu", key: "maTH", align: "start", sortable: false },
  { title: "Biến thể", key: "soLuongBienThe", align: "center", sortable: true },
  { title: "Trạng thái", key: "trangThai", align: "center", sortable: true },
  { title: "Thao tác", key: "actions", align: "center", sortable: false },
];

// ══ HELPERS ════════════════════════════════════════════════════════
const fmt = n => new Intl.NumberFormat("vi-VN").format(n) + "₫";
const getDMName = id => danhMucSPs.value.find(x => x.maDMSP === id)?.tenDanhMuc ?? "---";
const getTHName = id => thuongHieus.value.find(x => x.maTh === id)?.tenThuongHieu ?? "---";
function getBTOfSP(maSP) { return bienThes.value.filter(bt => bt.maSanPham === maSP); }
function isExpanded(maSP) { return expandedRows.value.includes(maSP); }
function onToggleExpand(maSP) {
  if (isExpanded(maSP) && !expandedProducts.value[maSP]) {
    expandedProducts.value[maSP] = true;
    loadBienThe(maSP);
  }
}
const catColors = ["blue", "purple", "orange", "green", "amber-darken-2"];
function getCatColor(maDanhMuc) {
  const idx = danhMucSPs.value.findIndex(x => x.maDMSP === maDanhMuc);
  return catColors[idx % catColors.length] ?? "blue";
}

function onFilterChange() { page.value = 1; loadSanPham(); }

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

async function saveSP() {
  if (!validateSP()) { showToast("Kiểm tra lại thông tin sản phẩm!", "error"); return; }
  saving.value = true;
  try {
    const fd = new FormData();
    fd.append("MaDanhMuc", spForm.maDanhMuc);
    fd.append("TenSp", spForm.tenSP.trim());
    fd.append("MaTh", spForm.maTH || "");
    fd.append("TrangThai", spForm.trangThai);

    if (spForm._newAvatarFile) {
      fd.append("File", spForm._newAvatarFile);
    }
    for (const g of spForm._newGalleryFiles)
      fd.append("GalleryFiles", g.file);

    if (editingSpId.value) {
      for (const id of spForm._deleteGalleryIds) {
        await axios.delete(`${API}/api/QuanLySanPham/gallery/${id}`);
      }
      await axios.put(`${API}/api/QuanLySanPham/${editingSpId.value}`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      logActivity("Cập nhật sản phẩm", `Đã cập nhật sản phẩm ${spForm.tenSP} (Mã: ${editingSpId.value})`, "Sản phẩm");
      showToast("Cập nhật sản phẩm thành công!");
    } else {
      fd.append("MaSp", spForm.maSP.trim());
      await axios.post(`${API}/api/QuanLySanPham`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      logActivity("Thêm sản phẩm", `Đã thêm sản phẩm mới ${spForm.tenSP} (Mã: ${spForm.maSP})`, "Sản phẩm");
      showToast("Thêm sản phẩm thành công!");
    }
    closeSpModal(); await loadSanPham();
  } catch (err) {
    logActivity(
      editingSpId.value ? "Cập nhật sản phẩm" : "Thêm sản phẩm",
      `Thất bại khi ${editingSpId.value ? 'cập nhật' : 'thêm'} sản phẩm ${spForm.tenSP} - Lỗi: ${err.message || ''}`,
      "Sản phẩm",
      "Thất bại"
    );
    showToast("Lỗi khi lưu sản phẩm!", "error");
  } finally {
    saving.value = false;
  }
}

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
      logActivity("Cập nhật biến thể", `Đã cập nhật biến thể ${btForm.tenBienThe} (Mã: ${editingBtId.value})`, "Sản phẩm");
      showToast("Cập nhật biến thể thành công!");
    } else {
      fd.append("MaBienThe", btForm.maBienThe.trim());
      await axios.post(`${API}/api/QuanLySanPham/bienthe`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      logActivity("Thêm biến thể", `Đã thêm biến thể mới ${btForm.tenBienThe} (Mã: ${btForm.maBienThe})`, "Sản phẩm");
      showToast("Thêm biến thể thành công!");
    }
    closeBtModal(); await loadBienThe(btForm.maSanPham); await loadSanPham();
  } catch (err) {
    logActivity(
      editingBtId.value ? "Cập nhật biến thể" : "Thêm biến thể",
      `Thất bại khi ${editingBtId.value ? 'cập nhật' : 'thêm'} biến thể ${btForm.tenBienThe} - Lỗi: ${err.message || ''}`,
      "Sản phẩm",
      "Thất bại"
    );
    showToast("Lỗi khi lưu biến thể!", "error");
  } finally {
    btSaving.value = false;
  }
}

// ══ XÁC NHẬN XÓA (thay cho confirm() mặc định của trình duyệt) ══════
// type: "sanpham" | "bienthe" — dùng chung 1 dialog cho cả 2 loại xóa
const confirmDialog = reactive({
  open: false, type: "", loading: false,
  target: null, // sp hoặc bt đang chờ xóa
});

function delSP(sp) {
  confirmDialog.type = "sanpham";
  confirmDialog.target = sp;
  confirmDialog.open = true;
}

function deleteBT(bt) {
  confirmDialog.type = "bienthe";
  confirmDialog.target = bt;
  confirmDialog.open = true;
}

function cancelDelete() {
  confirmDialog.open = false;
  confirmDialog.target = null;
  confirmDialog.type = "";
}

async function confirmDelete() {
  if (confirmDialog.type === "sanpham") {
    const sp = confirmDialog.target;
    if (!sp) return;
    confirmDialog.loading = true;
    try {
      await axios.delete(`${API}/api/QuanLySanPham/${sp.maSP}`);
      logActivity("Xóa sản phẩm", `Đã xóa sản phẩm ${sp.tenSP} (Mã: ${sp.maSP})`, "Sản phẩm");
      showToast("Đã xóa sản phẩm!"); await loadSanPham();
    } catch (err) {
      logActivity("Xóa sản phẩm", `Thất bại khi xóa sản phẩm ${sp.tenSP} (Mã: ${sp.maSP}) - Lỗi: ${err.message || ''}`, "Sản phẩm", "Thất bại");
      showToast(
        err.response?.data?.message || "Lỗi khi xóa sản phẩm!",
        "error"
      );
    } finally {
      confirmDialog.loading = false;
      cancelDelete();
    }
  } else if (confirmDialog.type === "bienthe") {
    const bt = confirmDialog.target;
    if (!bt) return;
    confirmDialog.loading = true;
    try {
      await axios.delete(`${API}/api/QuanLySanPham/bienthe/${bt.maBienThe}`);
      logActivity("Xóa biến thể", `Đã xóa biến thể ${bt.tenBienThe} (Mã: ${bt.maBienThe})`, "Sản phẩm");
      showToast("Đã xóa biến thể!"); await loadBienThe(bt.maSanPham);
    } catch (err) {
      logActivity("Xóa biến thể", `Thất bại khi xóa biến thể ${bt.tenBienThe} (Mã: ${bt.maBienThe}) - Lỗi: ${err.message || ''}`, "Sản phẩm", "Thất bại");
      showToast(
        err.response?.data?.message || "Lỗi khi xóa biến thể!",
        "error"
      );
    } finally {
      confirmDialog.loading = false;
      cancelDelete();
    }
  }
}

async function toggleStatusSP(sp) {
  const newStatus = sp.trangThai ? 0 : 1;
  try {
    await axios.patch(`${API}/api/QuanLySanPham/${sp.maSP}/trangthai`, { trangThai: newStatus });
    logActivity("Đổi trạng thái sản phẩm", `Đã đổi trạng thái sản phẩm ${sp.tenSP} sang ${newStatus ? 'Đang bán' : 'Ngừng bán'}`, "Sản phẩm");
    showToast("Đã cập nhật trạng thái!"); await loadSanPham();
  } catch (err) {
    logActivity("Đổi trạng thái sản phẩm", `Thất bại khi đổi trạng thái sản phẩm ${sp.tenSP} - Lỗi: ${err.message || ''}`, "Sản phẩm", "Thất bại");
    showToast("Lỗi khi đổi trạng thái!", "error");
  }
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

// Tự load biến thể khi mở rộng dòng
watch(expandedRows, (rows) => {
  for (const maSP of rows) onToggleExpand(maSP);
});

// ══ INIT ═══════════════════════════════════════════════════════════
// Lưu ý: KHÔNG gọi loadSanPham() ở đây — v-data-table-server tự bắn
// @update:options khi mount, và sẽ tự gọi loadSanPham() đúng 1 lần.
async function loadAll() {
  await Promise.all([loadDanhMuc(), loadThuongHieu()]);
}

onMounted(async () => {
  await loadAll();
});
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Sản Phẩm</h2>
          <div class="text-subtitle-2 text-medium-emphasis">
            {{ sanPhams.length }} sản phẩm · {{ totalActive }} đang bán
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openAddSP"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm sản phẩm
          </v-btn>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadAll">
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- ── TOOLBAR ────────────────────────────────────────────── -->
      <v-card-text class="pb-0">
        <v-row dense>
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              label="Tìm tên, mã sản phẩm..."
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
          <v-col cols="6" md="2">
            <v-select
              v-model="filterCat"
              :items="[{ title: 'Tất cả danh mục', value: '' }, ...danhMucSPs.map(dm => ({ title: dm.tenDanhMuc, value: dm.maDMSP }))]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              @update:model-value="onFilterChange"
            ></v-select>
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="filterBrand"
              :items="[{ title: 'Tất cả thương hiệu', value: '' }, ...thuongHieus.map(th => ({ title: th.tenThuongHieu, value: th.maTh }))]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              @update:model-value="onFilterChange"
            ></v-select>
          </v-col>
          <v-col cols="6" md="2">
            <v-select
              v-model="filterStatus"
              :items="[{ title: 'Tất cả trạng thái', value: '' }, { title: 'Đang bán', value: '1' }, { title: 'Ngừng bán', value: '0' }]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              @update:model-value="onFilterChange"
            ></v-select>
          </v-col>
          <v-col cols="6" md="2" class="d-flex align-center">
            <span class="text-caption text-medium-emphasis">{{ totalItems }} kết quả</span>
          </v-col>
        </v-row>
      </v-card-text>

      <v-data-table-server
        :headers="headers"
        :items="filteredData"
        :items-length="totalItems"
        :loading="isLoading"
        v-model:page="page"
        v-model:items-per-page="itemsPerPage"
        :items-per-page-options="[10, 20, 50]"
        item-value="maSP"
        show-expand
        v-model:expanded="expandedRows"
        hover
        class="mt-2"
        @update:options="loadSanPham"
      >
        <template v-slot:item.hinhAnhDaiDien="{ item }">
          <div class="d-flex justify-center py-2">
            <v-avatar
              rounded="lg"
              size="42"
              class="cursor-pointer"
              @click="item.hinhAnhDaiDien && openLightbox([item.hinhAnhDaiDien], 0)"
            >
              <v-img v-if="item.hinhAnhDaiDien" :src="item.hinhAnhDaiDien" cover></v-img>
              <ImageOff v-else class="w-4 h-4 text-grey" />
            </v-avatar>
          </div>
        </template>

        <template v-slot:item.maSP="{ item }">
          <span class="text-caption font-weight-medium code-chip">{{ item.maSP }}</span>
        </template>

        <template v-slot:item.tenSP="{ item }">
          <div class="font-weight-medium">{{ item.tenSP }}</div>
        </template>

        <template v-slot:item.maDanhMuc="{ item }">
          <v-chip :color="getCatColor(item.maDanhMuc)" size="small" variant="tonal" class="font-weight-medium">
            {{ getDMName(item.maDanhMuc) }}
          </v-chip>
        </template>

        <template v-slot:item.maTH="{ item }">
          <v-chip v-if="item.maTH" size="small" variant="tonal" color="grey-darken-2" class="font-weight-medium">
            {{ getTHName(item.maTH) }}
          </v-chip>
          <span v-else class="text-medium-emphasis">—</span>
        </template>

        <template v-slot:item.soLuongBienThe="{ item }">
          <v-chip size="small" variant="tonal" color="info" class="font-weight-medium">
            {{ item.soLuongBienThe }} biến thể
          </v-chip>
        </template>

        <template v-slot:item.trangThai="{ item }">
          <v-chip
            :color="item.trangThai ? 'success' : 'grey-darken-1'"
            size="small"
            variant="flat"
            class="font-weight-bold cursor-pointer"
            @click="toggleStatusSP(item)"
          >
            {{ item.trangThai ? "Đang bán" : "Ngừng bán" }}
          </v-chip>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <v-btn icon variant="text" size="small" color="primary" title="Xem" @click="openViewSP(item)">
              <Eye class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="warning" title="Sửa" @click="openEditSP(item)">
              <Pencil class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="error" title="Xóa" @click="delSP(item)">
              <Trash2 class="w-4 h-4" />
            </v-btn>
          </div>
        </template>

        <template v-slot:expanded-row="{ columns, item }">
          <tr>
            <td :colspan="columns.length" class="pa-0">
              <div class="nested-panel pa-4" :class="{ 'nested-panel-dark': isDarkMode }">
                <div class="d-flex align-center justify-space-between mb-3">
                  <div class="text-subtitle-2 font-weight-bold">
                    Biến thể sản phẩm
                    <v-chip size="x-small" class="ml-1">{{ getBTOfSP(item.maSP).length }}</v-chip>
                  </div>
                  <v-btn
                    color="success"
                    variant="tonal"
                    size="small"
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="openAddBT(item.maSP)"
                  >
                    <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
                    Thêm biến thể
                  </v-btn>
                </div>

                <div v-if="getBTOfSP(item.maSP).length === 0" class="text-center text-medium-emphasis py-6 text-caption">
                  Chưa có biến thể. Nhấn "Thêm biến thể" để bắt đầu.
                </div>

                <v-table v-else density="compact" class="bt-table-inner">
                  <thead>
                    <tr>
                      <th style="width:50px">Ảnh</th>
                      <th>Mã BT</th>
                      <th>Tên biến thể</th>
                      <th>Giá bán</th>
                      <th>Tồn kho</th>
                      <th>Hoa hồng</th>
                      <th>Trạng thái</th>
                      <th class="text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="bt in getBTOfSP(item.maSP)" :key="bt.maBienThe">
                      <td>
                        <v-avatar
                          rounded="lg"
                          size="36"
                          class="cursor-pointer my-1"
                          @click="bt.hinhAnhDaiDien && openLightbox([bt.hinhAnhDaiDien], 0)"
                        >
                          <v-img v-if="bt.hinhAnhDaiDien" :src="bt.hinhAnhDaiDien" cover></v-img>
                          <ImageOff v-else class="w-3 h-3 text-grey" />
                        </v-avatar>
                      </td>
                      <td><span class="text-caption code-chip">{{ bt.maBienThe }}</span></td>
                      <td><span class="font-weight-medium">{{ bt.tenBienThe }}</span></td>
                      <td class="font-weight-bold text-warning-darken-2">{{ fmt(bt.giaBan) }}</td>
                      <td>
                        <v-chip :color="bt.soLuong > 0 ? 'success' : 'error'" size="x-small" variant="tonal" class="font-weight-bold">
                          {{ bt.soLuong }}
                        </v-chip>
                      </td>
                      <td class="text-caption">{{ bt.phanTramHoaHong != null ? bt.phanTramHoaHong + '%' : '—' }}</td>
                      <td>
                        <v-chip :color="bt.trangThai ? 'success' : 'grey-darken-1'" size="x-small" variant="flat" class="font-weight-bold">
                          {{ bt.trangThai ? "Còn hàng" : "Ngừng hoạt động" }}
                        </v-chip>
                      </td>
                      <td class="text-center">
                        <v-btn icon variant="text" size="x-small" color="warning" title="Sửa biến thể" @click="openEditBT(bt)">
                          <Pencil class="w-3.5 h-3.5" />
                        </v-btn>
                        <v-btn icon variant="text" size="x-small" color="error" title="Xóa biến thể" @click="deleteBT(bt)">
                          <Trash2 class="w-3.5 h-3.5" />
                        </v-btn>
                      </td>
                    </tr>
                  </tbody>
                </v-table>
              </div>
            </td>
          </tr>
        </template>
      </v-data-table-server>
    </v-card>

    <!-- ══ MODAL SẢN PHẨM ══════════════════════════════════════════ -->
    <v-dialog v-model="spModal.open" max-width="640" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ spModal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeSpModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <!-- View mode -->
          <template v-if="spModal.mode === 'view'">
            <v-row>
              <v-col cols="12" sm="4" class="d-flex justify-center">
                <v-avatar
                  rounded="lg"
                  size="120"
                  class="cursor-pointer"
                  @click="spForm.hinhAnhDaiDien && openLightbox([spForm.hinhAnhDaiDien], 0)"
                >
                  <v-img v-if="spForm.hinhAnhDaiDien" :src="spForm.hinhAnhDaiDien" cover></v-img>
                  <ImageOff v-else class="w-8 h-8 text-grey" />
                </v-avatar>
              </v-col>
              <v-col cols="12" sm="8">
                <div class="detail-row"><span class="detail-label">Mã SP</span><span class="text-caption code-chip">{{ spForm.maSP }}</span></div>
                <div class="detail-row"><span class="detail-label">Tên sản phẩm</span><span class="font-weight-medium">{{ spForm.tenSP }}</span></div>
                <div class="detail-row">
                  <span class="detail-label">Danh mục</span>
                  <v-chip :color="getCatColor(spForm.maDanhMuc)" size="small" variant="tonal">{{ getDMName(spForm.maDanhMuc) }}</v-chip>
                </div>
                <div class="detail-row"><span class="detail-label">Thương hiệu</span><span>{{ getTHName(spForm.maTH) }}</span></div>
                <div class="detail-row">
                  <span class="detail-label">Biến thể</span>
                  <v-chip color="info" size="small" variant="tonal">{{ spForm.soLuongBienThe ?? 0 }} biến thể</v-chip>
                </div>
                <div class="detail-row">
                  <span class="detail-label">Trạng thái</span>
                  <v-chip :color="spForm.trangThai ? 'success' : 'grey-darken-1'" size="small" variant="flat" class="font-weight-bold">
                    {{ spForm.trangThai ? "Đang bán" : "Ngừng bán" }}
                  </v-chip>
                </div>
              </v-col>
            </v-row>

            <!-- Gallery xem -->
            <div v-if="spGallery[spForm.maSP]?.length" class="mt-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Ảnh gallery ({{ spGallery[spForm.maSP].length }})</div>
              <div class="d-flex flex-wrap gap-2">
                <v-avatar
                  v-for="(h, i) in spGallery[spForm.maSP]" :key="h.maHa"
                  rounded="lg" size="70" class="cursor-pointer"
                  @click="openLightbox(spGallery[spForm.maSP].map(x => x.duongDan), i)"
                >
                  <v-img :src="h.duongDan" cover></v-img>
                </v-avatar>
              </div>
            </div>
          </template>

          <!-- Form add/edit -->
          <v-form v-else @submit.prevent="saveSP">
            <v-row>
              <v-col cols="12" sm="6" v-if="!editingSpId">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã sản phẩm *</div>
                <v-text-field
                  v-model="spForm.maSP"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: SP001" maxlength="10"
                  :error-messages="spErrors.maSP"
                ></v-text-field>
              </v-col>
              <v-col cols="12" :sm="editingSpId ? 12 : 6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Tên sản phẩm *</div>
                <v-text-field
                  v-model="spForm.tenSP"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="Nhập tên sản phẩm"
                  :error-messages="spErrors.tenSP"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Danh mục *</div>
                <v-select
                  v-model="spForm.maDanhMuc"
                  :items="danhMucSPs.map(dm => ({ title: dm.tenDanhMuc, value: dm.maDMSP }))"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="-- Chọn danh mục --"
                  :error-messages="spErrors.maDanhMuc"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Thương hiệu</div>
                <v-select
                  v-model="spForm.maTH"
                  :items="[{ title: '-- Không có --', value: '' }, ...thuongHieus.map(th => ({ title: th.tenThuongHieu, value: th.maTh }))]"
                  variant="outlined" density="comfortable" rounded="lg"
                ></v-select>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Trạng thái</div>
                <v-select
                  v-model="spForm.trangThai"
                  :items="[{ title: 'Đang bán', value: 1 }, { title: 'Ngừng bán', value: 0 }]"
                  variant="outlined" density="comfortable" rounded="lg"
                ></v-select>
              </v-col>
            </v-row>

            <!-- Ảnh đại diện -->
            <div class="mt-2">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Ảnh đại diện</div>
              <div
                class="upload-zone"
                @dragover.prevent
                @drop.prevent="async (e) => { const f = e.dataTransfer.files[0]; if (f) { try { spForm.hinhAnhDaiDien = await readFileAsPreview(f); spForm._newAvatarFile = f; } catch {} } }"
                @click="spImgInput?.click()"
              >
                <div v-if="!spForm.hinhAnhDaiDien" class="upload-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <span>Kéo thả hoặc nhấn để chọn ảnh</span>
                  <span class="text-caption text-medium-emphasis">PNG, JPG tối đa 5MB</span>
                </div>
                <div v-else class="upload-preview-single">
                  <v-img :src="spForm.hinhAnhDaiDien" width="90" height="90" cover rounded="lg" class="border"></v-img>
                  <v-btn icon size="x-small" color="error" class="remove-single-img" @click.stop="spForm.hinhAnhDaiDien = ''; spForm._newAvatarFile = null">
                    <X class="w-3 h-3" />
                  </v-btn>
                </div>
              </div>
              <input ref="spImgInput" type="file" accept="image/*" style="display:none" @change="onSPAvatarChange" />
            </div>

            <!-- Gallery ảnh sản phẩm -->
            <div class="mt-4">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Gallery ảnh sản phẩm</div>

              <div v-if="editingSpId && spGallery[editingSpId]?.length" class="d-flex flex-wrap gap-2 mb-2">
                <div v-for="h in spGallery[editingSpId]" :key="h.maHa" class="gallery-edit-item">
                  <v-img :src="h.duongDan" width="72" height="72" cover rounded="lg" class="border cursor-pointer" @click="openLightbox([h.duongDan], 0)"></v-img>
                  <v-btn icon size="x-small" color="error" class="gallery-delete-btn" title="Xóa ảnh" @click="markDeleteSPGallery(h.maHa)">
                    <X class="w-3 h-3" />
                  </v-btn>
                </div>
              </div>

              <div v-if="spForm._newGalleryFiles.length" class="d-flex flex-wrap gap-2 mb-2">
                <div v-for="(g, idx) in spForm._newGalleryFiles" :key="idx" class="gallery-edit-item gallery-new-item">
                  <v-img :src="g.preview" width="72" height="72" cover rounded="lg" class="border"></v-img>
                  <v-btn icon size="x-small" color="error" class="gallery-delete-btn" @click="removeSPNewGallery(idx)">
                    <X class="w-3 h-3" />
                  </v-btn>
                  <v-chip size="x-small" color="primary" class="gallery-new-badge">Mới</v-chip>
                </div>
              </div>

              <v-btn variant="outlined" rounded="lg" size="small" class="text-none" @click="spGalleryInput?.click()">
                <template v-slot:prepend><Plus class="w-4 h-4" /></template>
                Thêm ảnh phụ
              </v-btn>
              <input ref="spGalleryInput" type="file" accept="image/*" multiple style="display:none" @change="onSPGalleryChange" />
              <div class="text-caption text-medium-emphasis mt-1">Tối đa 10 ảnh, mỗi ảnh ≤ 5MB</div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closeSpModal">
            {{ spModal.mode === 'view' ? 'Đóng' : 'Hủy' }}
          </v-btn>
          <v-btn
            v-if="spModal.mode !== 'view'"
            variant="flat" rounded="lg" class="text-none font-weight-bold"
            color="primary" :loading="saving" @click="saveSP"
          >
            {{ editingSpId ? "Cập nhật" : "Thêm mới" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ MODAL BIẾN THỂ ══════════════════════════════════════════ -->
    <v-dialog v-model="btModal.open" max-width="640" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ btModal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeBtModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveBT">
            <v-row>
              <v-col cols="12" sm="6" v-if="!editingBtId">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã biến thể *</div>
                <v-text-field
                  v-model="btForm.maBienThe"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: BT001" maxlength="10"
                  :error-messages="btErrors.maBienThe"
                ></v-text-field>
              </v-col>
              <v-col cols="12" :sm="editingBtId ? 12 : 6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Tên biến thể *</div>
                <v-text-field
                  v-model="btForm.tenBienThe"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: Màu đỏ - Size L"
                  :error-messages="btErrors.tenBienThe"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Giá bán (₫) *</div>
                <v-text-field
                  v-model="btForm.giaBan" type="number" min="0"
                  variant="outlined" density="comfortable" rounded="lg" placeholder="0"
                  :error-messages="btErrors.giaBan"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Số lượng tồn</div>
                <v-text-field
                  v-model.number="btForm.soLuong" type="number" min="0"
                  variant="outlined" density="comfortable" rounded="lg" placeholder="0"
                  :error-messages="btErrors.soLuong"
                ></v-text-field>
              </v-col>

              <v-col cols="12" v-if="editingBtId && Number(btForm.soLuong) !== Number(btForm._originalSoLuong)">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Lý do điều chỉnh số lượng *</div>
                <v-text-field
                  v-model="btForm.ghiChu"
                  variant="outlined" density="comfortable" rounded="lg"
                  placeholder="VD: Kiểm kê phát hiện thiếu, hàng lỗi, nhập tay điều chỉnh..." maxlength="255"
                  :error-messages="btErrors.ghiChu"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Hoa hồng (%)</div>
                <v-text-field
                  v-model="btForm.phanTramHoaHong" type="number" min="0" max="100" step="0.1"
                  variant="outlined" density="comfortable" rounded="lg" placeholder="0"
                  :error-messages="btErrors.phanTramHoaHong"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Trạng thái</div>
                <v-select
                  v-model="btForm.trangThai"
                  :items="[{ title: 'Còn hàng', value: 1 }, { title: 'Ngừng hoạt động', value: 0 }]"
                  variant="outlined" density="comfortable" rounded="lg"
                ></v-select>
              </v-col>
            </v-row>

            <!-- Ảnh đại diện biến thể -->
            <div class="mt-2">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Ảnh đại diện biến thể</div>
              <div
                class="upload-zone"
                @dragover.prevent
                @drop.prevent="async (e) => { const f = e.dataTransfer.files[0]; if (f) { try { btForm.hinhAnhDaiDien = await readFileAsPreview(f); btForm._newAvatarFile = f; } catch {} } }"
                @click="btImgInput?.click()"
              >
                <div v-if="!btForm.hinhAnhDaiDien" class="upload-placeholder">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                  </svg>
                  <span>Kéo thả hoặc nhấn để chọn ảnh</span>
                  <span class="text-caption text-medium-emphasis">PNG, JPG tối đa 5MB</span>
                </div>
                <div v-else class="upload-preview-single">
                  <v-img :src="btForm.hinhAnhDaiDien" width="90" height="90" cover rounded="lg" class="border"></v-img>
                  <v-btn icon size="x-small" color="error" class="remove-single-img" @click.stop="btForm.hinhAnhDaiDien = ''; btForm._newAvatarFile = null">
                    <X class="w-3 h-3" />
                  </v-btn>
                </div>
              </div>
              <input ref="btImgInput" type="file" accept="image/*" style="display:none" @change="onBTAvatarChange" />
            </div>

            <!-- Gallery ảnh biến thể -->
            <div class="mt-4">
              <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Gallery ảnh biến thể</div>

              <div v-if="editingBtId && btGallery[editingBtId]?.length" class="d-flex flex-wrap gap-2 mb-2">
                <div v-for="h in btGallery[editingBtId]" :key="h.maHa" class="gallery-edit-item">
                  <v-img :src="h.duongDan" width="72" height="72" cover rounded="lg" class="border cursor-pointer" @click="openLightbox([h.duongDan], 0)"></v-img>
                  <v-btn icon size="x-small" color="error" class="gallery-delete-btn" @click="markDeleteBTGallery(h.maHa)">
                    <X class="w-3 h-3" />
                  </v-btn>
                </div>
              </div>

              <div v-if="btForm._newGalleryFiles.length" class="d-flex flex-wrap gap-2 mb-2">
                <div v-for="(g, idx) in btForm._newGalleryFiles" :key="idx" class="gallery-edit-item gallery-new-item">
                  <v-img :src="g.preview" width="72" height="72" cover rounded="lg" class="border"></v-img>
                  <v-btn icon size="x-small" color="error" class="gallery-delete-btn" @click="removeBTNewGallery(idx)">
                    <X class="w-3 h-3" />
                  </v-btn>
                  <v-chip size="x-small" color="primary" class="gallery-new-badge">Mới</v-chip>
                </div>
              </div>

              <v-btn variant="outlined" rounded="lg" size="small" class="text-none" @click="btGalleryInput?.click()">
                <template v-slot:prepend><Plus class="w-4 h-4" /></template>
                Thêm ảnh phụ
              </v-btn>
              <input ref="btGalleryInput" type="file" accept="image/*" multiple style="display:none" @change="onBTGalleryChange" />
              <div class="text-caption text-medium-emphasis mt-1">Tối đa 10 ảnh, mỗi ảnh ≤ 5MB</div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closeBtModal">Hủy</v-btn>
          <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary" :loading="btSaving" @click="saveBT">
            {{ editingBtId ? "Cập nhật" : "Thêm biến thể" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ LIGHTBOX ══════════════════════════════════════════════════ -->
    <!-- ══ DIALOG XÁC NHẬN XÓA (dùng chung cho sản phẩm & biến thể) ══════════ -->
    <v-dialog v-model="confirmDialog.open" max-width="420" persistent>
      <v-card rounded="lg">
        <v-card-item class="pa-5 pb-0">
          <div class="d-flex align-center gap-3">
            <v-avatar color="error" variant="tonal" size="42">
              <Trash2 class="w-5 h-5" />
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold">
              {{ confirmDialog.type === "bienthe" ? "Xóa biến thể?" : "Xóa sản phẩm?" }}
            </div>
          </div>
        </v-card-item>
        <v-card-text class="pa-5 pt-3">
          <template v-if="confirmDialog.type === 'bienthe'">
            Bạn có chắc muốn xóa biến thể
            <strong>"{{ confirmDialog.target?.tenBienThe }}"</strong>?
          </template>
          <template v-else>
            Bạn có chắc muốn xóa sản phẩm
            <strong>"{{ confirmDialog.target?.tenSP }}"</strong>?
          </template>
        </v-card-text>
        <v-card-actions class="pa-4 px-5 d-flex justify-end border-t">
          <v-btn
            variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2"
            color="grey-darken-2" :disabled="confirmDialog.loading"
            @click="cancelDelete"
          >
            Hủy
          </v-btn>
          <v-btn
            variant="flat" rounded="lg" class="text-none font-weight-bold"
            color="error" :loading="confirmDialog.loading"
            @click="confirmDelete"
          >
            Xóa
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="lightbox.open" max-width="900">
      <div class="lb-overlay-content">
        <v-btn icon color="white" variant="text" class="lb-close" @click="lightbox.open = false">
          <X class="w-5 h-5" />
        </v-btn>
        <v-btn v-if="lightbox.imgs.length > 1" icon color="white" variant="text" class="lb-nav lb-prev" @click="lbPrev">‹</v-btn>
        <img :src="lightbox.imgs[lightbox.idx]" class="lb-img" />
        <v-btn v-if="lightbox.imgs.length > 1" icon color="white" variant="text" class="lb-nav lb-next" @click="lbNext">›</v-btn>
        <div v-if="lightbox.imgs.length > 1" class="lb-dots">
          <span
            v-for="(_, i) in lightbox.imgs" :key="i"
            class="lb-dot" :class="{ active: i === lightbox.idx }"
            @click="lightbox.idx = i"
          ></span>
        </div>
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
.rotate-180 { transform: rotate(180deg); }

/* Nested variant panel */
.nested-panel { background: #f9fafb; border-top: 1px solid #e5e7eb; }
.nested-panel-dark { background: #1e1e29; border-top: 1px solid #383846; }
.bt-table-inner { background: transparent; }

/* Detail view rows */
.detail-row { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.detail-label { font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.7); min-width: 110px; }

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

/* Gallery */
.gallery-edit-item { position: relative; width: 72px; height: 72px; }
.gallery-delete-btn { position: absolute; top: -8px; right: -8px; }
.gallery-new-item { outline: 2px dashed #3b82f6; border-radius: 8px; }
.gallery-new-badge { position: absolute; bottom: 2px; left: 2px; }

/* Lightbox */
.lb-overlay-content { position: relative; display: flex; align-items: center; justify-content: center; min-height: 60vh; }
.lb-img { max-width: 90vw; max-height: 80vh; border-radius: 8px; object-fit: contain; }
.lb-close { position: absolute; top: -8px; right: -8px; z-index: 2; background: rgba(0,0,0,0.4); }
.lb-nav { position: absolute; top: 50%; transform: translateY(-50%); font-size: 28px; background: rgba(0,0,0,0.4); }
.lb-prev { left: 8px; }
.lb-next { right: 8px; }
.lb-dots { position: absolute; bottom: 8px; display: flex; gap: 6px; left: 50%; transform: translateX(-50%); }
.lb-dot { width: 7px; height: 7px; border-radius: 50%; background: rgba(255,255,255,0.4); cursor: pointer; transition: background 0.15s; }
.lb-dot.active { background: #fff; }
</style>