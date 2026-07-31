<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";
import {
  Search, RotateCcw, Plus, Eye, Check, X, Trash2, Edit,
  ChevronDown, Package, AlertTriangle, DollarSign, Ban,
} from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;

function toAbsUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

// ══ TABS ═══════════════════════════════════════════════════════════
const activeTab = ref("tonkho"); // tonkho | phieunhap | nhacc | lichsu | canhbao

// ══ SNACKBAR / LIGHTBOX ════════════════════════════════════════════
const snackbar = reactive({ show: false, text: "", color: "success" });
function showToast(msg, type = "success") {
  snackbar.text = msg;
  snackbar.color = type === "error" ? "error" : "success";
  snackbar.show = true;
}
const lightbox = reactive({ open: false, src: "" });
function openLightbox(src) { if (!src) return; lightbox.src = src; lightbox.open = true; }

// ══ HELPERS CHUNG ══════════════════════════════════════════════════
const fmt = n => new Intl.NumberFormat("vi-VN").format(n || 0) + "₫";
function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("vi-VN");
}
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("vi-VN");
}
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ── Nhân viên đang đăng nhập ──
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
const currentNhanVien = getCurrentNhanVien();

/* ════════════════════════════════════════════════════════════════
   TAB 1 — TỒN KHO
   ════════════════════════════════════════════════════════════════ */
const danhMucs = ref([]);
const tonKhoList = ref([]);
const searchTon = ref("");
const filterDanhMucTon = ref(null);
const filterTrangThaiTon = ref(null);
const loadingTon = ref(false);

async function loadDanhMuc() {
  try {
    const res = await axios.get(`${API}/api/QuanLySanPham/danhmuc`);
    danhMucs.value = res.data;
  } catch { /* không bắt buộc */ }
}

async function loadTonKho() {
  loadingTon.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/tonkho`, {
      params: {
        search: searchTon.value || null,
        maDanhMuc: filterDanhMucTon.value || null,
        trangThai: filterTrangThaiTon.value === null || filterTrangThaiTon.value === "" ? null : filterTrangThaiTon.value,
      },
    });
    tonKhoList.value = res.data.map(b => ({ ...b, hinhAnh: toAbsUrl(b.hinhAnh) }));
  } catch { showToast("Lỗi tải tồn kho!", "error"); }
  finally { loadingTon.value = false; }
}
function onFilterTonChange() { loadTonKho(); }

const danhMucOptions = computed(() => [
  { title: "Tất cả danh mục", value: null },
  ...danhMucs.value.map(dm => ({ title: dm.tenDanhMuc, value: dm.maDMSP })),
]);
const trangThaiTonOptions = [
  { title: "Tất cả trạng thái", value: null },
  { title: "Đang bán", value: "1" },
  { title: "Ngừng bán", value: "0" },
];

const tonKhoHeaders = [
  { title: "Ảnh", key: "hinhAnh", align: "center", sortable: false, width: 70 },
  { title: "Sản phẩm / Biến thể", key: "tenSanPham", align: "start" },
  { title: "Danh mục", key: "danhMuc", align: "start" },
  { title: "Giá bán", key: "giaBan", align: "end" },
  { title: "Tồn kho", key: "soLuongTon", align: "center" },
  { title: "Trạng thái", key: "trangThai", align: "center", sortable: false },
];

const statsTon = computed(() => {
  const list = tonKhoList.value;
  return {
    tong: list.length,
    het: list.filter(b => b.mucTon === "het").length,
    thap: list.filter(b => b.mucTon === "thap").length,
    giaTri: list.reduce((s, b) => s + (b.soLuongTon || 0) * (b.giaBan || 0), 0),
  };
});

function stockColor(m) {
  return m === "het" ? "error" : m === "thap" ? "warning" : m === "on" ? "success" : "grey-darken-1";
}
function stockText(m) {
  return m === "het" ? "Hết hàng" : m === "thap" ? "Sắp hết" : m === "on" ? "Còn hàng" : "Chưa rõ";
}

/* ════════════════════════════════════════════════════════════════
   TAB — CẢNH BÁO SẮP HẾT HÀNG
   ════════════════════════════════════════════════════════════════ */
const canhBaoList = ref([]);
const nguongCanhBao = ref(10);
const loadingCanhBao = ref(false);

async function loadCanhBao() {
  loadingCanhBao.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/canhbaoton`, {
      params: { nguong: nguongCanhBao.value },
    });
    canhBaoList.value = (res.data.items || []).map(b => ({ ...b, hinhAnh: toAbsUrl(b.hinhAnh) }));
  } catch { showToast("Lỗi tải cảnh báo tồn kho!", "error"); }
  finally { loadingCanhBao.value = false; }
}
function onNguongCanhBaoChange() { loadCanhBao(); }

const canhBaoHeaders = [
  { title: "Ảnh", key: "hinhAnh", align: "center", sortable: false, width: 70 },
  { title: "Sản phẩm / Biến thể", key: "tenSanPham", align: "start" },
  { title: "Tồn kho", key: "soLuongTon", align: "center" },
  { title: "Giá bán", key: "giaBan", align: "end" },
  { title: "Mức độ", key: "mucTon", align: "center", sortable: false },
];

/* ════════════════════════════════════════════════════════════════
   TAB — LỊCH SỬ TỒN KHO
   ════════════════════════════════════════════════════════════════ */
const lichSuList = ref([]);
const lichSuTotal = ref(0);
const filterBienTheLS = ref("");
const filterLoaiBienDongLS = ref(null);
const tuNgayLS = ref("");
const denNgayLS = ref("");
const curPageLS = ref(1);
const perPageLS = ref(20);
const loadingLS = ref(false);

async function loadLichSu() {
  loadingLS.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/lichsutonkho`, {
      params: {
        maBienThe: filterBienTheLS.value || null,
        loaiBienDong: filterLoaiBienDongLS.value || null,
        tuNgay: tuNgayLS.value || null,
        denNgay: denNgayLS.value || null,
        page: curPageLS.value,
        pageSize: perPageLS.value,
      },
    });
    lichSuList.value = res.data.items || [];
    lichSuTotal.value = res.data.total || 0;
  } catch { showToast("Lỗi tải lịch sử tồn kho!", "error"); }
  finally { loadingLS.value = false; }
}
function onFilterLSChange() { curPageLS.value = 1; loadLichSu(); }

const totalPagesLS = computed(() => Math.max(1, Math.ceil(lichSuTotal.value / perPageLS.value)));

function loaiBienDongText(l) {
  return l === "NHAP" ? "Nhập kho" : l === "DIEU_CHINH" ? "Điều chỉnh" : l === "BAN" ? "Bán hàng" : l;
}
function loaiBienDongColor(l) {
  return l === "NHAP" ? "success" : l === "BAN" ? "error" : "warning";
}
const loaiBienDongOptions = [
  { title: "Tất cả loại biến động", value: null },
  { title: "Nhập kho", value: "NHAP" },
  { title: "Điều chỉnh", value: "DIEU_CHINH" },
  { title: "Bán hàng", value: "BAN" },
];

const lichSuHeaders = [
  { title: "Thời gian", key: "thoiGian", align: "start", sortable: false },
  { title: "Sản phẩm / Biến thể", key: "tenSanPham", align: "start", sortable: false },
  { title: "Loại biến động", key: "loaiBienDong", align: "center", sortable: false },
  { title: "Thay đổi", key: "soLuongThayDoi", align: "center", sortable: false },
  { title: "Tồn trước → sau", key: "ton", align: "center", sortable: false },
  { title: "Chứng từ", key: "maChungTu", align: "start", sortable: false },
  { title: "Ghi chú", key: "ghiChu", align: "start", sortable: false },
];

/* ════════════════════════════════════════════════════════════════
   THỐNG KÊ NHẬP KHO THEO THÁNG (nhúng trong tab Phiếu nhập)
   ════════════════════════════════════════════════════════════════ */
const thongKeNam = ref(new Date().getFullYear());
const thongKeData = ref(null);
const loadingThongKe = ref(false);
const showThongKe = ref(false);

async function loadThongKe() {
  loadingThongKe.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/thongkenhapkho`, {
      params: { nam: thongKeNam.value },
    });
    thongKeData.value = res.data;
  } catch { showToast("Lỗi tải thống kê nhập kho!", "error"); }
  finally { loadingThongKe.value = false; }
}
function toggleThongKe() {
  showThongKe.value = !showThongKe.value;
  if (showThongKe.value && !thongKeData.value) loadThongKe();
}
const maxThongKeTien = computed(() => {
  if (!thongKeData.value) return 1;
  return Math.max(1, ...thongKeData.value.theoThang.map(t => t.tongTien || 0));
});

/* ════════════════════════════════════════════════════════════════
   TAB 2 — PHIẾU NHẬP
   ════════════════════════════════════════════════════════════════ */
const phieuNhaps = ref([]);
const filterNccPN = ref(null);
const filterTrangThaiPN = ref(null);
const tuNgayPN = ref("");
const denNgayPN = ref("");
const loadingPN = ref(false);
const savingPN = ref(false);

async function loadPhieuNhap() {
  loadingPN.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/phieunhap`, {
      params: {
        maNcc: filterNccPN.value || null,
        trangThai: filterTrangThaiPN.value === null || filterTrangThaiPN.value === "" ? null : filterTrangThaiPN.value,
        tuNgay: tuNgayPN.value || null,
        denNgay: denNgayPN.value || null,
      },
    });
    phieuNhaps.value = res.data.map(p => ({
      ...p,
      chiTiet: (p.chiTiet || []).map(c => ({ ...c, hinhAnh: toAbsUrl(c.hinhAnh) })),
    }));
  } catch { showToast("Lỗi tải phiếu nhập!", "error"); }
  finally { loadingPN.value = false; }
}
function onFilterPNChange() { loadPhieuNhap(); }

const statsPN = computed(() => {
  const list = phieuNhaps.value;
  return {
    tong: list.length,
    choDuyet: list.filter(p => p.trangThai === 0).length,
    daDuyet: list.filter(p => p.trangThai === 1).length,
    tongTien: list.filter(p => p.trangThai === 1).reduce((s, p) => s + (p.tongTien || 0), 0),
  };
});

function pnStatusText(t) { return t === 1 ? "Đã duyệt" : t === 2 ? "Đã hủy" : "Chờ duyệt"; }
function pnStatusColor(t) { return t === 1 ? "success" : t === 2 ? "error" : "warning"; }

const phieuNhapHeaders = [
  { title: "", key: "data-table-expand", align: "start", sortable: false, width: 40 },
  { title: "Mã phiếu", key: "maPn", align: "start", sortable: false },
  { title: "Ngày nhập", key: "ngayNhap", align: "start", sortable: false },
  { title: "Nhà cung cấp", key: "tenNcc", align: "start", sortable: false },
  { title: "Nhân viên", key: "tenNv", align: "start", sortable: false },
  { title: "Số dòng", key: "soLuongDong", align: "center", sortable: false },
  { title: "Tổng tiền", key: "tongTien", align: "end", sortable: false },
  { title: "Trạng thái", key: "trangThai", align: "center", sortable: false },
  { title: "Thao tác", key: "actions", align: "center", sortable: false },
];

const trangThaiPNOptions = [
  { title: "Tất cả trạng thái", value: null },
  { title: "Chờ duyệt", value: "0" },
  { title: "Đã duyệt", value: "1" },
  { title: "Đã hủy", value: "2" },
];

// ── Modal Phiếu nhập ───────────────────────────────────────────────
const pnModal = reactive({ open: false, mode: "form", title: "" });
const pnErrors = reactive({ maPn: "", maNcc: "", maNv: "", ngayNhap: "", chiTiet: "" });
function clearPnErrors() { Object.keys(pnErrors).forEach(k => pnErrors[k] = ""); }

const pnForm = reactive({
  maPn: "", maNcc: null, maNv: currentNhanVien?.maNv || "", ngayNhap: todayStr(), ghiChu: "", chiTiet: [],
});
const pnDetail = ref(null); // dùng cho mode "view"

function resetPnForm() {
  Object.assign(pnForm, { maPn: "", maNcc: null, maNv: currentNhanVien?.maNv || "", ngayNhap: todayStr(), ghiChu: "", chiTiet: [] });
}

function openAddPN() {
  clearPnErrors(); resetPnForm(); pnForm.ngayNhap = todayStr(); btSearchKw.value = ""; btSuggestions.value = [];
  pnModal.mode = "form"; pnModal.title = "Tạo phiếu nhập mới"; pnModal.open = true;
}

async function openViewPN(p) {
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/phieunhap/${p.maPn}`);
    pnDetail.value = {
      ...res.data,
      chiTiet: (res.data.chiTiet || []).map(c => ({ ...c, hinhAnh: toAbsUrl(c.hinhAnh) })),
    };
    pnModal.mode = "view"; pnModal.title = `Phiếu nhập ${p.maPn}`; pnModal.open = true;
  } catch { showToast("Lỗi tải chi tiết phiếu nhập!", "error"); }
}

function closePnModal() { pnModal.open = false; }

function validatePN() {
  clearPnErrors(); let ok = true;
  if (!pnForm.maPn.trim()) { pnErrors.maPn = "Mã phiếu nhập không được để trống."; ok = false; }
  else if (!/^[A-Za-z0-9]{2,15}$/.test(pnForm.maPn.trim())) { pnErrors.maPn = "Mã chỉ gồm chữ và số, 2–15 ký tự."; ok = false; }
  if (pnForm.maNv && pnForm.maNv.trim().length > 20) { pnErrors.maNv = "Mã nhân viên không hợp lệ (tối đa 20 ký tự)."; ok = false; }
  if (pnForm.ngayNhap && pnForm.ngayNhap > todayStr()) { pnErrors.ngayNhap = "Ngày nhập không được lớn hơn ngày hiện tại."; ok = false; }
  if (!pnForm.chiTiet.length) { pnErrors.chiTiet = "Phiếu nhập phải có ít nhất một dòng chi tiết."; ok = false; }
  else if (pnForm.chiTiet.some(c => !c.soLuong || c.soLuong <= 0 || c.soLuong > 1000000)) { pnErrors.chiTiet = "Số lượng mỗi dòng phải từ 1 đến 1.000.000."; ok = false; }
  else if (pnForm.chiTiet.some(c => c.giaNhap == null || c.giaNhap < 0 || c.giaNhap > 1000000000)) { pnErrors.chiTiet = "Giá nhập phải từ 0 đến 1.000.000.000."; ok = false; }
  return ok;
}

const tongTienForm = computed(() =>
  pnForm.chiTiet.reduce((s, c) => s + (Number(c.soLuong) || 0) * (Number(c.giaNhap) || 0), 0)
);

async function savePN() {
  if (!validatePN()) { showToast("Vui lòng kiểm tra lại thông tin phiếu nhập!", "error"); return; }
  savingPN.value = true;
  try {
    const payload = {
      maPn: pnForm.maPn.trim(),
      maNcc: pnForm.maNcc || null,
      maNv: pnForm.maNv || null,
      ngayNhap: pnForm.ngayNhap || null,
      ghiChu: pnForm.ghiChu || null,
      chiTiet: pnForm.chiTiet.map(c => ({
        maBienThe: c.maBienThe, soLuong: Number(c.soLuong), giaNhap: Number(c.giaNhap),
      })),
    };
    await axios.post(`${API}/api/QuanLyKho/phieunhap`, payload);
    logActivity("Tạo phiếu nhập kho", `Đã tạo phiếu nhập kho mới ${pnForm.maPn} với ${pnForm.chiTiet.length} dòng hàng, tổng tiền ${fmt(tongTienForm.value)}`, "Quản lý kho");
    showToast("Tạo phiếu nhập thành công!");
    closePnModal(); await loadPhieuNhap();
  } catch (err) {
    logActivity("Tạo phiếu nhập kho", `Thất bại khi tạo phiếu nhập kho ${pnForm.maPn} - Lỗi: ${err.message || ''}`, "Quản lý kho", "Thất bại");
    showToast(err.response?.data?.message || "Lỗi khi tạo phiếu nhập!", "error");
  } finally { savingPN.value = false; }
}

async function duyetPN(p) {
  if (!confirm(`Duyệt phiếu nhập "${p.maPn}"? Tồn kho sẽ được cập nhật.`)) return;
  try {
    await axios.post(`${API}/api/QuanLyKho/phieunhap/${p.maPn}/duyet`);
    logActivity("Duyệt phiếu nhập kho", `Đã duyệt phiếu nhập kho ${p.maPn}, cập nhật tồn kho`, "Quản lý kho");
    showToast("Duyệt phiếu nhập thành công!");
    await loadPhieuNhap();
    if (activeTab.value === "tonkho") loadTonKho();
    if (activeTab.value === "canhbao") loadCanhBao();
    if (activeTab.value === "lichsu") loadLichSu();
  } catch (err) {
    logActivity("Duyệt phiếu nhập kho", `Thất bại khi duyệt phiếu nhập kho ${p.maPn} - Lỗi: ${err.message || ''}`, "Quản lý kho", "Thất bại");
    showToast(err.response?.data?.message || "Lỗi khi duyệt phiếu!", "error");
  }
}

async function huyPN(p) {
  if (!confirm(`Hủy phiếu nhập "${p.maPn}"?`)) return;
  try {
    await axios.post(`${API}/api/QuanLyKho/phieunhap/${p.maPn}/huy`);
    logActivity("Hủy phiếu nhập kho", `Đã hủy phiếu nhập kho ${p.maPn}`, "Quản lý kho");
    showToast("Đã hủy phiếu nhập!"); await loadPhieuNhap();
  } catch (err) {
    logActivity("Hủy phiếu nhập kho", `Thất bại khi hủy phiếu nhập kho ${p.maPn} - Lỗi: ${err.message || ''}`, "Quản lý kho", "Thất bại");
    showToast(err.response?.data?.message || "Lỗi khi hủy phiếu!", "error");
  }
}

async function deletePN(p) {
  if (!confirm(`Xóa phiếu nhập "${p.maPn}"? Hành động không thể hoàn tác.`)) return;
  try {
    await axios.delete(`${API}/api/QuanLyKho/phieunhap/${p.maPn}`);
    logActivity("Xóa phiếu nhập kho", `Đã xóa phiếu nhập kho ${p.maPn}`, "Quản lý kho");
    showToast("Đã xóa phiếu nhập!"); await loadPhieuNhap();
  } catch (err) {
    logActivity("Xóa phiếu nhập kho", `Thất bại khi xóa phiếu nhập kho ${p.maPn} - Lỗi: ${err.message || ''}`, "Quản lý kho", "Thất bại");
    showToast(err.response?.data?.message || "Lỗi khi xóa phiếu!", "error");
  }
}

// ── Tìm kiếm biến thể để thêm vào chi tiết phiếu nhập ──────────────
const btSearchKw = ref("");
const btSuggestions = ref([]);
const btSearching = ref(false);
let btSearchTimer = null;

function onBtSearchInput() {
  clearTimeout(btSearchTimer);
  btSearchTimer = setTimeout(searchBienThe, 300);
}

async function searchBienThe() {
  btSearching.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/timkiembienthe`, { params: { q: btSearchKw.value || null } });
    btSuggestions.value = res.data.map(b => ({ ...b, hinhAnh: toAbsUrl(b.hinhAnh) }));
  } catch { btSuggestions.value = []; }
  finally { btSearching.value = false; }
}

function addBTRow(bt) {
  if (pnForm.chiTiet.find(c => c.maBienThe === bt.maBienThe)) {
    showToast("Biến thể này đã có trong phiếu!", "error"); return;
  }
  pnForm.chiTiet.push({
    maBienThe: bt.maBienThe, label: bt.label, hinhAnh: bt.hinhAnh,
    soLuong: 1, giaNhap: bt.giaBan ?? 0,
  });
  btSearchKw.value = ""; btSuggestions.value = [];
}
function removeBTRow(idx) { pnForm.chiTiet.splice(idx, 1); }

/* ════════════════════════════════════════════════════════════════
   TAB 3 — NHÀ CUNG CẤP
   ════════════════════════════════════════════════════════════════ */
const nccs = ref([]);
const searchNcc = ref("");
const filterTrangThaiNcc = ref(null);
const savingNcc = ref(false);
const loadingNcc = ref(false);

async function loadNcc() {
  loadingNcc.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/nhacungcap`);
    nccs.value = res.data;
  } catch { showToast("Lỗi tải nhà cung cấp!", "error"); }
  finally { loadingNcc.value = false; }
}

const filteredNcc = computed(() => {
  const q = searchNcc.value.toLowerCase().trim();
  return nccs.value.filter(n => {
    const mq = !q || n.tenNcc?.toLowerCase().includes(q) || n.maNcc?.toLowerCase().includes(q);
    const ms = filterTrangThaiNcc.value === null || filterTrangThaiNcc.value === "" || String(n.trangThai) === filterTrangThaiNcc.value;
    return mq && ms;
  });
});

const nccHeaders = [
  { title: "Mã NCC", key: "maNcc", align: "start" },
  { title: "Tên nhà cung cấp", key: "tenNcc", align: "start" },
  { title: "SĐT", key: "soDienThoai", align: "start" },
  { title: "Địa chỉ", key: "diaChi", align: "start" },
  { title: "Email", key: "email", align: "start" },
  { title: "Số phiếu nhập", key: "soPhieuNhap", align: "center" },
  { title: "Trạng thái", key: "trangThai", align: "center" },
  { title: "Thao tác", key: "actions", align: "center", sortable: false },
];

const trangThaiNccOptions = [
  { title: "Tất cả trạng thái", value: null },
  { title: "Đang hợp tác", value: "1" },
  { title: "Ngừng hợp tác", value: "0" },
];

// ── Modal Nhà cung cấp ──────────────────────────────────────────────
const nccModal = reactive({ open: false, title: "" });
const editingNccId = ref(null);
const nccForm = reactive({ maNcc: "", tenNcc: "", soDienThoai: "", diaChi: "", email: "", trangThai: 1 });
const nccErrors = reactive({ maNcc: "", tenNcc: "", soDienThoai: "", email: "", diaChi: "" });
function clearNccErrors() { Object.keys(nccErrors).forEach(k => nccErrors[k] = ""); }

function resetNccForm() {
  Object.assign(nccForm, { maNcc: "", tenNcc: "", soDienThoai: "", diaChi: "", email: "", trangThai: 1 });
}
function openAddNcc() {
  editingNccId.value = null; clearNccErrors(); resetNccForm();
  nccModal.title = "Thêm nhà cung cấp"; nccModal.open = true;
}
function openEditNcc(n) {
  editingNccId.value = n.maNcc; clearNccErrors();
  Object.assign(nccForm, {
    maNcc: n.maNcc, tenNcc: n.tenNcc, soDienThoai: n.soDienThoai,
    diaChi: n.diaChi, email: n.email, trangThai: n.trangThai,
  });
  nccModal.title = "Chỉnh sửa nhà cung cấp"; nccModal.open = true;
}
function closeNccModal() { nccModal.open = false; }

function validateNcc() {
  clearNccErrors(); let ok = true;
  if (!editingNccId.value) {
    if (!nccForm.maNcc.trim()) { nccErrors.maNcc = "Mã NCC không được để trống."; ok = false; }
    else if (!/^[A-Za-z0-9]{2,10}$/.test(nccForm.maNcc.trim())) { nccErrors.maNcc = "Mã chỉ gồm chữ và số, 2–10 ký tự."; ok = false; }
    else if (nccs.value.find(x => x.maNcc === nccForm.maNcc.trim())) { nccErrors.maNcc = "Mã nhà cung cấp đã tồn tại."; ok = false; }
  }
  if (!nccForm.tenNcc.trim()) { nccErrors.tenNcc = "Tên nhà cung cấp không được để trống."; ok = false; }
  else if (nccForm.tenNcc.trim().length > 100) { nccErrors.tenNcc = "Tên nhà cung cấp tối đa 100 ký tự."; ok = false; }
  if (nccForm.soDienThoai && !/^0\d{9}$/.test(nccForm.soDienThoai.trim())) { nccErrors.soDienThoai = "SĐT không hợp lệ (10 số, bắt đầu bằng 0)."; ok = false; }
  if (nccForm.email) {
    if (nccForm.email.trim().length > 100) { nccErrors.email = "Email tối đa 100 ký tự."; ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nccForm.email.trim())) { nccErrors.email = "Email không hợp lệ."; ok = false; }
  }
  if (nccForm.diaChi && nccForm.diaChi.trim().length > 200) { nccErrors.diaChi = "Địa chỉ tối đa 200 ký tự."; ok = false; }
  return ok;
}

async function saveNcc() {
  if (!validateNcc()) { showToast("Vui lòng kiểm tra lại thông tin!", "error"); return; }
  savingNcc.value = true;
  try {
    const dto = {
      maNcc: nccForm.maNcc.trim(), tenNcc: nccForm.tenNcc.trim(),
      soDienThoai: nccForm.soDienThoai?.trim() || null, diaChi: nccForm.diaChi?.trim() || null,
      email: nccForm.email?.trim() || null, trangThai: nccForm.trangThai,
    };
    if (editingNccId.value) {
      await axios.put(`${API}/api/QuanLyKho/nhacungcap/${editingNccId.value}`, dto);
      logActivity("Cập nhật nhà cung cấp", `Đã cập nhật nhà cung cấp ${nccForm.tenNcc} (Mã: ${editingNccId.value})`, "Nhà cung cấp");
      showToast("Cập nhật nhà cung cấp thành công!");
    } else {
      await axios.post(`${API}/api/QuanLyKho/nhacungcap`, dto);
      logActivity("Thêm nhà cung cấp", `Đã thêm nhà cung cấp mới ${nccForm.tenNcc} (Mã: ${nccForm.maNcc})`, "Nhà cung cấp");
      showToast("Thêm nhà cung cấp thành công!");
    }
    closeNccModal(); await loadNcc();
  } catch (err) {
    logActivity(
      editingNccId.value ? "Cập nhật nhà cung cấp" : "Thêm nhà cung cấp",
      `Thất bại khi ${editingNccId.value ? 'cập nhật' : 'thêm'} nhà cung cấp ${nccForm.tenNcc} - Lỗi: ${err.message || ''}`,
      "Nhà cung cấp",
      "Thất bại"
    );
    showToast(err.response?.data?.message || "Lỗi khi lưu nhà cung cấp!", "error");
  } finally { savingNcc.value = false; }
}

async function deleteNcc(n) {
  if (!confirm(`Xóa nhà cung cấp "${n.tenNcc}"?`)) return;
  try {
    await axios.delete(`${API}/api/QuanLyKho/nhacungcap/${n.maNcc}`);
    logActivity("Xóa nhà cung cấp", `Đã xóa nhà cung cấp ${n.tenNcc} (Mã: ${n.maNcc})`, "Nhà cung cấp");
    showToast("Đã xóa nhà cung cấp!"); await loadNcc();
  } catch (err) {
    logActivity("Xóa nhà cung cấp", `Thất bại khi xóa nhà cung cấp ${n.tenNcc} (Mã: ${n.maNcc}) - Lỗi: ${err.message || ''}`, "Nhà cung cấp", "Thất bại");
    showToast(err.response?.data?.message || "Lỗi khi xóa nhà cung cấp!", "error");
  }
}

async function toggleStatusNcc(n) {
  const newStatus = n.trangThai ? 0 : 1;
  try {
    await axios.put(`${API}/api/QuanLyKho/nhacungcap/${n.maNcc}`, {
      maNcc: n.maNcc, tenNcc: n.tenNcc, soDienThoai: n.soDienThoai,
      diaChi: n.diaChi, email: n.email, trangThai: newStatus,
    });
    logActivity("Đổi trạng thái nhà cung cấp", `Đã đổi trạng thái nhà cung cấp ${n.tenNcc} sang ${newStatus ? 'Đang hoạt động' : 'Ngừng hợp tác'}`, "Nhà cung cấp");
    showToast("Đã cập nhật trạng thái!"); await loadNcc();
  } catch (err) {
    logActivity("Đổi trạng thái nhà cung cấp", `Thất bại khi đổi trạng thái nhà cung cấp ${n.tenNcc} - Lỗi: ${err.message || ''}`, "Nhà cung cấp", "Thất bại");
    showToast("Lỗi khi đổi trạng thái!", "error");
  }
}

// ══ TAB SWITCH ═════════════════════════════════════════════════════
function switchTab(tab) {
  activeTab.value = tab;
  if (tab === "tonkho" && !tonKhoList.value.length) loadTonKho();
  if (tab === "phieunhap" && !phieuNhaps.value.length) loadPhieuNhap();
  if (tab === "nhacc" && !nccs.value.length) loadNcc();
  if (tab === "canhbao") loadCanhBao();
  if (tab === "lichsu" && !lichSuList.value.length) loadLichSu();
}

// ══ INIT ═══════════════════════════════════════════════════════════
onMounted(async () => {
  await Promise.all([loadDanhMuc(), loadNcc()]);
  await loadTonKho();
});
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Kho Hàng</h2>
          <div class="text-subtitle-2 text-medium-emphasis">Theo dõi tồn kho, phiếu nhập và nhà cung cấp</div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            v-if="activeTab === 'phieunhap'"
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openAddPN"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Tạo phiếu nhập
          </v-btn>
          <v-btn
            v-if="activeTab === 'nhacc'"
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openAddNcc"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm nhà cung cấp
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <v-tabs v-model="activeTab" color="primary" class="px-4" @update:model-value="switchTab">
        <v-tab value="tonkho" class="text-none font-weight-bold">Tồn kho</v-tab>
        <v-tab value="phieunhap" class="text-none font-weight-bold">Phiếu nhập</v-tab>
        <v-tab value="canhbao" class="text-none font-weight-bold">Cảnh báo tồn</v-tab>
        <v-tab value="lichsu" class="text-none font-weight-bold">Lịch sử tồn kho</v-tab>
      </v-tabs>

      <v-divider></v-divider>

      <v-card-text class="pa-6">

        <!-- ════════════════════════════════════════════════════════
             TAB: TỒN KHO
             ════════════════════════════════════════════════════════ -->
        <template v-if="activeTab === 'tonkho'">
          <v-row class="mb-2">
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="primary" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Tổng biến thể</div>
                  <div class="text-h5 font-weight-bold">{{ statsTon.tong }}</div>
                  <div class="text-caption text-medium-emphasis">Đang theo dõi</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="error" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Hết hàng</div>
                  <div class="text-h5 font-weight-bold">{{ statsTon.het }}</div>
                  <div class="text-caption text-medium-emphasis">Cần nhập gấp</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="warning" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Sắp hết</div>
                  <div class="text-h5 font-weight-bold">{{ statsTon.thap }}</div>
                  <div class="text-caption text-medium-emphasis">Dưới 10 sản phẩm</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="success" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Giá trị tồn kho</div>
                  <div class="text-h6 font-weight-bold">{{ fmt(statsTon.giaTri) }}</div>
                  <div class="text-caption text-medium-emphasis">Theo giá bán</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <div class="d-flex align-center gap-3 mb-4 flex-wrap">
            <v-text-field
              v-model="searchTon"
              label="Tìm tên sản phẩm, biến thể..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="min-width: 240px; max-width: 320px;"
              @keyup.enter="onFilterTonChange"
              @click:clear="onFilterTonChange"
            >
              <template v-slot:prepend-inner><Search class="w-4 h-4 mr-1" /></template>
            </v-text-field>

            <v-select
              v-model="filterDanhMucTon"
              :items="danhMucOptions"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 200px; max-width: 240px;"
              @update:model-value="onFilterTonChange"
            ></v-select>

            <v-select
              v-model="filterTrangThaiTon"
              :items="trangThaiTonOptions"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 180px; max-width: 220px;"
              @update:model-value="onFilterTonChange"
            ></v-select>

            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">{{ tonKhoList.length }} kết quả</span>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadTonKho">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>

          <v-data-table
            :headers="tonKhoHeaders"
            :items="tonKhoList"
            :loading="loadingTon"
            items-per-page="10"
            hover
          >
            <template v-slot:item.hinhAnh="{ item }">
              <v-avatar
                rounded="lg"
                size="42"
                class="cursor-pointer my-2"
                color="grey-lighten-3"
                @click="openLightbox(item.hinhAnh)"
              >
                <img v-if="item.hinhAnh" :src="item.hinhAnh" :alt="item.tenBienThe" style="width:100%;height:100%;object-fit:cover;" />
                <Package v-else class="w-5 h-5 text-medium-emphasis" />
              </v-avatar>
            </template>

            <template v-slot:item.tenSanPham="{ item }">
              <div class="py-1">
                <div class="font-weight-bold">{{ item.tenSanPham || "—" }}</div>
                <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                  {{ item.tenBienThe }}
                  <v-chip size="x-small" variant="tonal" class="font-weight-medium ml-1">{{ item.maBienThe }}</v-chip>
                </div>
              </div>
            </template>

            <template v-slot:item.danhMuc="{ item }">
              <v-chip size="small" variant="tonal" color="grey-darken-1" class="font-weight-medium">{{ item.danhMuc || "—" }}</v-chip>
            </template>

            <template v-slot:item.giaBan="{ item }">
              <span class="font-weight-bold text-warning-darken-2">{{ fmt(item.giaBan) }}</span>
            </template>

            <template v-slot:item.soLuongTon="{ item }">
              <v-chip :color="stockColor(item.mucTon)" size="small" variant="flat" class="font-weight-bold">
                {{ item.soLuongTon ?? "—" }} cái
              </v-chip>
            </template>

            <template v-slot:item.trangThai="{ item }">
              <v-chip :color="item.trangThai ? 'success' : 'grey-darken-1'" size="small" variant="tonal" class="font-weight-bold">
                {{ item.trangThai ? "Đang bán" : "Ngừng bán" }}
              </v-chip>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-8 text-medium-emphasis">Không tìm thấy biến thể nào</div>
            </template>
          </v-data-table>
        </template>

        <!-- ════════════════════════════════════════════════════════
             TAB: PHIẾU NHẬP
             ════════════════════════════════════════════════════════ -->
        <template v-if="activeTab === 'phieunhap'">
          <v-card v-if="showThongKe" variant="outlined" rounded="lg" class="mb-4 pa-4">
            <div class="d-flex align-center gap-3 mb-3 flex-wrap">
              <span class="text-subtitle-2 font-weight-bold">Năm:</span>
              <v-select
                v-model="thongKeNam"
                :items="[thongKeNam, thongKeNam-1, thongKeNam-2]"
                variant="outlined"
                density="compact"
                hide-details
                rounded="lg"
                style="max-width: 120px;"
                @update:model-value="loadThongKe"
              ></v-select>
              <span v-if="thongKeData" class="text-caption text-medium-emphasis">
                Tổng {{ thongKeData.tongSoPhieuCaNam }} phiếu · {{ fmt(thongKeData.tongTienCaNam) }}
              </span>
            </div>
            <div v-if="loadingThongKe" class="text-center pa-4 text-medium-emphasis">Đang tải thống kê...</div>
            <div v-else-if="thongKeData" class="thongke-chart">
              <div v-for="t in thongKeData.theoThang" :key="t.thang" class="thongke-col">
                <div class="thongke-bar-wrap">
                  <div class="thongke-bar" :style="{ height: (t.tongTien / maxThongKeTien * 100) + '%' }" :title="fmt(t.tongTien)"></div>
                </div>
                <div class="text-caption font-weight-bold mt-1">T{{ t.thang }}</div>
                <div class="text-caption text-medium-emphasis">{{ t.soPhieuNhap }} phiếu</div>
              </div>
            </div>
          </v-card>

          <v-row class="mb-2">
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="primary" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Tổng phiếu nhập</div>
                  <div class="text-h5 font-weight-bold">{{ statsPN.tong }}</div>
                  <div class="text-caption text-medium-emphasis">Trong bộ lọc hiện tại</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="warning" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Chờ duyệt</div>
                  <div class="text-h5 font-weight-bold">{{ statsPN.choDuyet }}</div>
                  <div class="text-caption text-medium-emphasis">Cần xử lý</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="success" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Đã duyệt</div>
                  <div class="text-h5 font-weight-bold">{{ statsPN.daDuyet }}</div>
                  <div class="text-caption text-medium-emphasis">Đã cập nhật tồn kho</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="info" rounded="lg">
                <v-card-text>
                  <div class="text-caption text-uppercase font-weight-bold">Tổng tiền đã duyệt</div>
                  <div class="text-h6 font-weight-bold">{{ fmt(statsPN.tongTien) }}</div>
                  <div class="text-caption text-medium-emphasis">Tổng giá trị nhập</div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <div class="d-flex align-center gap-3 mb-4 flex-wrap">
            <v-select
              v-model="filterNccPN"
              :items="[{ title: 'Tất cả nhà cung cấp', value: null }, ...nccs.map(n => ({ title: n.tenNcc, value: n.maNcc }))]"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 200px; max-width: 240px;"
              @update:model-value="onFilterPNChange"
            ></v-select>

            <v-select
              v-model="filterTrangThaiPN"
              :items="trangThaiPNOptions"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 180px; max-width: 200px;"
              @update:model-value="onFilterPNChange"
            ></v-select>

            <v-text-field
              v-model="tuNgayPN"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="max-width: 170px;"
              @change="onFilterPNChange"
            ></v-text-field>
            <span class="text-medium-emphasis">→</span>
            <v-text-field
              v-model="denNgayPN"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="max-width: 170px;"
              @change="onFilterPNChange"
            ></v-text-field>

            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">{{ phieuNhaps.length }} kết quả</span>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadPhieuNhap">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>

          <v-data-table
            :headers="phieuNhapHeaders"
            :items="phieuNhaps"
            :loading="loadingPN"
            items-per-page="10"
            show-expand
            item-value="maPn"
            hover
          >
            <template v-slot:item.maPn="{ item }">
              <v-chip size="small" variant="tonal" class="font-weight-medium">{{ item.maPn }}</v-chip>
            </template>

            <template v-slot:item.ngayNhap="{ item }">{{ fmtDate(item.ngayNhap) }}</template>
            <template v-slot:item.tenNcc="{ item }">{{ item.tenNcc || "—" }}</template>
            <template v-slot:item.tenNv="{ item }">{{ item.tenNv || "—" }}</template>

            <template v-slot:item.soLuongDong="{ item }">
              <v-chip size="small" variant="tonal" color="info">{{ item.soLuongDong }} dòng</v-chip>
            </template>

            <template v-slot:item.tongTien="{ item }">
              <span class="font-weight-bold text-warning-darken-2">{{ fmt(item.tongTien) }}</span>
            </template>

            <template v-slot:item.trangThai="{ item }">
              <v-chip :color="pnStatusColor(item.trangThai)" size="small" variant="flat" class="font-weight-bold">
                {{ pnStatusText(item.trangThai) }}
              </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <div class="d-flex align-center justify-center gap-1">
                <v-btn icon size="small" variant="text" color="info" title="Xem chi tiết" @click="openViewPN(item)">
                  <Eye class="w-4 h-4" />
                </v-btn>
                <v-btn v-if="item.trangThai === 0" icon size="small" variant="text" color="success" title="Duyệt phiếu" @click="duyetPN(item)">
                  <Check class="w-4 h-4" />
                </v-btn>
                <v-btn v-if="item.trangThai === 0" icon size="small" variant="text" color="warning" title="Hủy phiếu" @click="huyPN(item)">
                  <X class="w-4 h-4" />
                </v-btn>
                <v-btn v-if="item.trangThai !== 1" icon size="small" variant="text" color="error" title="Xóa phiếu" @click="deletePN(item)">
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </div>
            </template>

            <template v-slot:expanded-row="{ columns, item }">
              <tr>
                <td :colspan="columns.length" class="pa-0">
                  <div class="pa-4 bg-grey-lighten-5">
                    <div class="d-flex align-center justify-space-between mb-2">
                      <div class="text-subtitle-2 font-weight-bold">
                        Chi tiết phiếu nhập
                        <v-chip size="x-small" variant="tonal" class="ml-1">{{ item.chiTiet.length }}</v-chip>
                      </div>
                    </div>
                    <div v-if="!item.chiTiet.length" class="text-center text-caption text-medium-emphasis pa-3">Chưa có dòng chi tiết.</div>
                    <v-table v-else density="compact" class="rounded-lg border">
                      <thead>
                        <tr>
                          <th style="width:44px"></th>
                          <th>Sản phẩm / Biến thể</th>
                          <th>Số lượng</th>
                          <th>Giá nhập</th>
                          <th>Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="c in item.chiTiet" :key="c.maBienThe">
                          <td>
                            <v-avatar rounded="lg" size="32" class="cursor-pointer" color="grey-lighten-3" @click="openLightbox(c.hinhAnh)">
                              <img v-if="c.hinhAnh" :src="c.hinhAnh" style="width:100%;height:100%;object-fit:cover;" />
                              <Package v-else class="w-4 h-4" />
                            </v-avatar>
                          </td>
                          <td>
                            <div class="font-weight-medium">{{ c.tenSanPham }}</div>
                            <div class="text-caption text-medium-emphasis">{{ c.tenBienThe }}</div>
                          </td>
                          <td>{{ c.soLuong }}</td>
                          <td>{{ fmt(c.giaNhap) }}</td>
                          <td class="font-weight-bold text-warning-darken-2">{{ fmt(c.thanhTien) }}</td>
                        </tr>
                      </tbody>
                    </v-table>
                  </div>
                </td>
              </tr>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-8 text-medium-emphasis">Không có phiếu nhập nào</div>
            </template>
          </v-data-table>
        </template>

        <!-- ════════════════════════════════════════════════════════
             TAB: NHÀ CUNG CẤP
             ════════════════════════════════════════════════════════ -->
        <template v-if="activeTab === 'nhacc'">
          <div class="d-flex align-center gap-3 mb-4 flex-wrap">
            <v-text-field
              v-model="searchNcc"
              label="Tìm tên, mã nhà cung cấp..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="min-width: 240px; max-width: 320px;"
            >
              <template v-slot:prepend-inner><Search class="w-4 h-4 mr-1" /></template>
            </v-text-field>

            <v-select
              v-model="filterTrangThaiNcc"
              :items="trangThaiNccOptions"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 180px; max-width: 220px;"
            ></v-select>

            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">{{ filteredNcc.length }} kết quả</span>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadNcc">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>

          <v-data-table
            :headers="nccHeaders"
            :items="filteredNcc"
            :loading="loadingNcc"
            items-per-page="10"
            hover
          >
            <template v-slot:item.maNcc="{ item }">
              <v-chip size="small" variant="tonal" class="font-weight-medium">{{ item.maNcc }}</v-chip>
            </template>

            <template v-slot:item.tenNcc="{ item }">
              <div class="font-weight-bold">{{ item.tenNcc }}</div>
            </template>

            <template v-slot:item.soDienThoai="{ item }">{{ item.soDienThoai || "—" }}</template>
            <template v-slot:item.diaChi="{ item }">
              <span class="text-medium-emphasis" style="max-width: 220px; display: inline-block;">{{ item.diaChi || "—" }}</span>
            </template>
            <template v-slot:item.email="{ item }">{{ item.email || "—" }}</template>

            <template v-slot:item.soPhieuNhap="{ item }">
              <v-chip size="small" variant="tonal" color="info">{{ item.soPhieuNhap }} phiếu</v-chip>
            </template>

            <template v-slot:item.trangThai="{ item }">
              <v-chip
                :color="item.trangThai ? 'success' : 'grey-darken-1'"
                size="small"
                variant="flat"
                class="font-weight-bold cursor-pointer"
                @click="toggleStatusNcc(item)"
              >
                {{ item.trangThai ? "Đang hợp tác" : "Ngừng hợp tác" }}
              </v-chip>
            </template>

            <template v-slot:item.actions="{ item }">
              <div class="d-flex align-center justify-center gap-1">
                <v-btn icon size="small" variant="text" color="primary" title="Sửa" @click="openEditNcc(item)">
                  <Edit class="w-4 h-4" />
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" title="Xóa" @click="deleteNcc(item)">
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </div>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-8 text-medium-emphasis">Không có nhà cung cấp nào</div>
            </template>
          </v-data-table>
        </template>

        <!-- ════════════════════════════════════════════════════════
             TAB: CẢNH BÁO SẮP HẾT HÀNG
             ════════════════════════════════════════════════════════ -->
        <template v-if="activeTab === 'canhbao'">
          <div class="d-flex align-center gap-3 mb-4 flex-wrap">
            <span class="text-subtitle-2 font-weight-bold">Ngưỡng cảnh báo (tồn dưới):</span>
            <v-text-field
              type="number"
              min="0"
              v-model.number="nguongCanhBao"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="max-width: 100px;"
              @change="onNguongCanhBaoChange"
            ></v-text-field>

            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">{{ canhBaoList.length }} biến thể cần chú ý</span>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadCanhBao">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>

          <v-data-table
            :headers="canhBaoHeaders"
            :items="canhBaoList"
            :loading="loadingCanhBao"
            items-per-page="10"
            hover
          >
            <template v-slot:item.hinhAnh="{ item }">
              <v-avatar
                rounded="lg"
                size="42"
                class="cursor-pointer my-2"
                color="grey-lighten-3"
                @click="openLightbox(item.hinhAnh)"
              >
                <img v-if="item.hinhAnh" :src="item.hinhAnh" :alt="item.tenBienThe" style="width:100%;height:100%;object-fit:cover;" />
                <Package v-else class="w-5 h-5 text-medium-emphasis" />
              </v-avatar>
            </template>

            <template v-slot:item.tenSanPham="{ item }">
              <div class="py-1">
                <div class="font-weight-bold">{{ item.tenSanPham || "—" }}</div>
                <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                  {{ item.tenBienThe }}
                  <v-chip size="x-small" variant="tonal" class="font-weight-medium ml-1">{{ item.maBienThe }}</v-chip>
                </div>
              </div>
            </template>

            <template v-slot:item.soLuongTon="{ item }">
              <v-chip :color="stockColor(item.mucTon)" size="small" variant="flat" class="font-weight-bold">
                {{ item.soLuongTon ?? 0 }} cái
              </v-chip>
            </template>

            <template v-slot:item.giaBan="{ item }">
              <span class="font-weight-bold text-warning-darken-2">{{ fmt(item.giaBan) }}</span>
            </template>

            <template v-slot:item.mucTon="{ item }">
              <v-chip :color="item.mucTon === 'het' ? 'error' : 'warning'" size="small" variant="tonal" class="font-weight-bold">
                {{ stockText(item.mucTon) }}
              </v-chip>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-8 text-medium-emphasis">Không có biến thể nào dưới ngưỡng cảnh báo</div>
            </template>
          </v-data-table>
        </template>

        <!-- ════════════════════════════════════════════════════════
             TAB: LỊCH SỬ TỒN KHO
             ════════════════════════════════════════════════════════ -->
        <template v-if="activeTab === 'lichsu'">
          <div class="d-flex align-center gap-3 mb-4 flex-wrap">
            <v-text-field
              v-model="filterBienTheLS"
              label="Mã biến thể..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="min-width: 200px; max-width: 260px;"
              @keyup.enter="onFilterLSChange"
            >
              <template v-slot:prepend-inner><Search class="w-4 h-4 mr-1" /></template>
            </v-text-field>

            <v-select
              v-model="filterLoaiBienDongLS"
              :items="loaiBienDongOptions"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="min-width: 180px; max-width: 220px;"
              @update:model-value="onFilterLSChange"
            ></v-select>

            <v-text-field
              v-model="tuNgayLS"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="max-width: 170px;"
              @change="onFilterLSChange"
            ></v-text-field>
            <span class="text-medium-emphasis">đến</span>
            <v-text-field
              v-model="denNgayLS"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="max-width: 170px;"
              @change="onFilterLSChange"
            ></v-text-field>

            <v-spacer></v-spacer>
            <span class="text-caption text-medium-emphasis">{{ lichSuTotal }} kết quả</span>

            <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="loadLichSu">
              <RotateCcw class="w-5 h-5" />
            </v-btn>
          </div>

          <v-data-table
            :headers="lichSuHeaders"
            :items="lichSuList"
            :loading="loadingLS"
            :items-per-page="perPageLS"
            hide-default-footer
            hover
          >
            <template v-slot:item.thoiGian="{ item }">{{ fmtDateTime(item.thoiGian) }}</template>

            <template v-slot:item.tenSanPham="{ item }">
              <div class="py-1">
                <div class="font-weight-bold">{{ item.tenSanPham || "—" }}</div>
                <div class="text-caption text-medium-emphasis d-flex align-center gap-1">
                  {{ item.tenBienThe }}
                  <v-chip size="x-small" variant="tonal" class="font-weight-medium ml-1">{{ item.maBienThe }}</v-chip>
                </div>
              </div>
            </template>

            <template v-slot:item.loaiBienDong="{ item }">
              <v-chip :color="loaiBienDongColor(item.loaiBienDong)" size="small" variant="tonal" class="font-weight-bold">
                {{ loaiBienDongText(item.loaiBienDong) }}
              </v-chip>
            </template>

            <template v-slot:item.soLuongThayDoi="{ item }">
              <v-chip :color="item.soLuongThayDoi >= 0 ? 'success' : 'error'" size="small" variant="flat" class="font-weight-bold">
                {{ item.soLuongThayDoi >= 0 ? "+" : "" }}{{ item.soLuongThayDoi }}
              </v-chip>
            </template>

            <template v-slot:item.ton="{ item }">{{ item.tonTruoc }} → {{ item.tonSau }}</template>

            <template v-slot:item.maChungTu="{ item }">
              <v-chip size="small" variant="tonal" class="font-weight-medium">{{ item.maChungTu || "—" }}</v-chip>
            </template>

            <template v-slot:item.ghiChu="{ item }">
              <span class="text-medium-emphasis">{{ item.ghiChu || "—" }}</span>
            </template>

            <template v-slot:no-data>
              <div class="text-center pa-8 text-medium-emphasis">Chưa có lịch sử biến động nào</div>
            </template>
          </v-data-table>

          <div v-if="lichSuTotal > 0" class="d-flex justify-center mt-4">
            <v-pagination
              v-model="curPageLS"
              :length="totalPagesLS"
              :total-visible="5"
              rounded="circle"
              density="comfortable"
              @update:model-value="loadLichSu"
            ></v-pagination>
          </div>
        </template>

      </v-card-text>
    </v-card>

    <!-- ══ MODAL PHIẾU NHẬP (THÊM / XEM) ══════════════════════════════ -->
    <v-dialog v-model="pnModal.open" max-width="800" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ pnModal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closePnModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6" style="max-height: 70vh;">

          <!-- VIEW MODE -->
          <template v-if="pnModal.mode === 'view' && pnDetail">
            <div class="d-flex flex-column gap-2 mb-4">
              <div class="d-flex align-center gap-2"><span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Mã phiếu</span><v-chip size="small" variant="tonal">{{ pnDetail.maPn }}</v-chip></div>
              <div class="d-flex align-center gap-2"><span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Ngày nhập</span><span>{{ fmtDate(pnDetail.ngayNhap) }}</span></div>
              <div class="d-flex align-center gap-2"><span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Nhà cung cấp</span><span>{{ pnDetail.tenNcc || "—" }}</span></div>
              <div class="d-flex align-center gap-2"><span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Nhân viên</span><span>{{ pnDetail.tenNv || "—" }}</span></div>
              <div class="d-flex align-center gap-2"><span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Ghi chú</span><span>{{ pnDetail.ghiChu || "—" }}</span></div>
              <div class="d-flex align-center gap-2">
                <span class="text-caption font-weight-bold text-medium-emphasis" style="min-width:110px">Trạng thái</span>
                <v-chip :color="pnStatusColor(pnDetail.trangThai)" size="small" variant="flat" class="font-weight-bold">{{ pnStatusText(pnDetail.trangThai) }}</v-chip>
              </div>
            </div>
            <v-table density="compact" class="rounded-lg border">
              <thead>
                <tr>
                  <th style="width:44px"></th>
                  <th>Sản phẩm / Biến thể</th>
                  <th>Giá bán hiện tại</th>
                  <th>SL</th>
                  <th>Giá nhập</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in pnDetail.chiTiet" :key="c.maBienThe">
                  <td>
                    <v-avatar rounded="lg" size="32" class="cursor-pointer" color="grey-lighten-3" @click="openLightbox(c.hinhAnh)">
                      <img v-if="c.hinhAnh" :src="c.hinhAnh" style="width:100%;height:100%;object-fit:cover;" />
                    </v-avatar>
                  </td>
                  <td><div class="font-weight-medium">{{ c.tenSanPham }}</div><div class="text-caption text-medium-emphasis">{{ c.tenBienThe }}</div></td>
                  <td>{{ fmt(c.giaBanHienTai) }}</td>
                  <td>{{ c.soLuong }}</td>
                  <td>{{ fmt(c.giaNhap) }}</td>
                  <td class="font-weight-bold text-warning-darken-2">{{ fmt(c.thanhTien) }}</td>
                </tr>
              </tbody>
            </v-table>
            <div class="text-right font-weight-bold mt-3">Tổng tiền: <span class="text-warning-darken-2">{{ fmt(pnDetail.tongTien) }}</span></div>
          </template>

          <!-- FORM ADD MODE -->
          <template v-else>
            <v-row>
              <v-col cols="12" sm="6">
                <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Mã phiếu nhập *</div>
                <v-text-field
                  v-model="pnForm.maPn"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="VD: PN001"
                  maxlength="15"
                  :error-messages="pnErrors.maPn"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Ngày nhập</div>
                <v-text-field
                  v-model="pnForm.ngayNhap"
                  type="date"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  hint="Tự động lấy ngày hiện tại"
                  persistent-hint
                  :error-messages="pnErrors.ngayNhap"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Nhà cung cấp</div>
                <v-select
                  v-model="pnForm.maNcc"
                  :items="[{ title: '-- Không chọn --', value: null }, ...nccs.map(n => ({ title: n.tenNcc, value: n.maNcc }))]"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                ></v-select>
              </v-col>
              <v-col cols="12" sm="6">
                <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Người nhập</div>
                <v-text-field
                  :model-value="currentNhanVien ? `${currentNhanVien.ten} (${currentNhanVien.maNv})` : 'Không xác định'"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  :error-messages="!currentNhanVien ? 'Không tìm thấy thông tin đăng nhập, vui lòng đăng nhập lại.' : ''"
                ></v-text-field>
              </v-col>
              <v-col cols="12">
                <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Ghi chú</div>
                <v-textarea
                  v-model="pnForm.ghiChu"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  rows="2"
                  placeholder="Ghi chú thêm (nếu có)"
                  maxlength="500"
                ></v-textarea>
              </v-col>
            </v-row>

            <!-- Tìm & thêm biến thể -->
            <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Thêm sản phẩm vào phiếu *</div>
            <div class="position-relative mb-2">
              <v-text-field
                v-model="btSearchKw"
                variant="outlined"
                density="comfortable"
                rounded="lg"
                placeholder="Tìm mã, tên sản phẩm / biến thể..."
                hide-details
                @input="onBtSearchInput"
                @focus="onBtSearchInput"
              >
                <template v-slot:prepend-inner><Search class="w-4 h-4 mr-1" /></template>
              </v-text-field>
              <v-card v-if="btSuggestions.length" class="position-absolute w-100 mt-1" style="z-index: 20; max-height: 260px; overflow-y: auto;" elevation="6" rounded="lg">
                <v-list density="compact">
                  <v-list-item
                    v-for="bt in btSuggestions"
                    :key="bt.maBienThe"
                    @click="addBTRow(bt)"
                  >
                    <template v-slot:prepend>
                      <v-avatar rounded="lg" size="32" color="grey-lighten-3">
                        <img v-if="bt.hinhAnh" :src="bt.hinhAnh" style="width:100%;height:100%;object-fit:cover;" />
                      </v-avatar>
                    </template>
                    <v-list-item-title>{{ bt.label }}</v-list-item-title>
                    <v-list-item-subtitle>{{ fmt(bt.giaBan) }} · Tồn: {{ bt.soLuongTon ?? 0 }}</v-list-item-subtitle>
                  </v-list-item>
                </v-list>
              </v-card>
            </div>
            <div v-if="pnErrors.chiTiet" class="text-caption text-error mb-2">{{ pnErrors.chiTiet }}</div>

            <v-table v-if="pnForm.chiTiet.length" density="compact" class="rounded-lg border mb-3">
              <thead>
                <tr>
                  <th style="width:44px"></th>
                  <th>Sản phẩm</th>
                  <th style="width:90px">SL</th>
                  <th style="width:130px">Giá nhập</th>
                  <th style="width:120px">Thành tiền</th>
                  <th style="width:36px"></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(c, idx) in pnForm.chiTiet" :key="c.maBienThe">
                  <td>
                    <v-avatar rounded="lg" size="32" color="grey-lighten-3">
                      <img v-if="c.hinhAnh" :src="c.hinhAnh" style="width:100%;height:100%;object-fit:cover;" />
                    </v-avatar>
                  </td>
                  <td class="font-weight-medium">{{ c.label }}</td>
                  <td><v-text-field type="number" min="1" max="1000000" v-model.number="c.soLuong" density="compact" variant="outlined" hide-details rounded="lg"></v-text-field></td>
                  <td><v-text-field type="number" min="0" max="1000000000" v-model.number="c.giaNhap" density="compact" variant="outlined" hide-details rounded="lg"></v-text-field></td>
                  <td class="font-weight-bold text-warning-darken-2">{{ fmt((c.soLuong || 0) * (c.giaNhap || 0)) }}</td>
                  <td>
                    <v-btn icon size="x-small" variant="text" color="error" @click="removeBTRow(idx)">
                      <X class="w-4 h-4" />
                    </v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
            <v-alert v-else type="info" variant="tonal" density="compact" class="mb-3">
              Chưa có sản phẩm nào trong phiếu, hãy tìm và chọn ở trên.
            </v-alert>

            <div class="text-right font-weight-bold">Tổng tiền: <span class="text-warning-darken-2">{{ fmt(tongTienForm) }}</span></div>
          </template>

        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <template v-if="pnModal.mode === 'view'">
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold" color="grey-darken-2" @click="closePnModal">Đóng</v-btn>
          </template>
          <template v-else>
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closePnModal">Hủy</v-btn>
            <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary" :loading="savingPN" @click="savePN">
              Tạo phiếu nhập
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ MODAL NHÀ CUNG CẤP ══════════════════════════════════════════ -->
    <v-dialog v-model="nccModal.open" max-width="600">
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ nccModal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeNccModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-row>
            <v-col cols="12" sm="6" v-if="!editingNccId">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Mã nhà cung cấp *</div>
              <v-text-field v-model="nccForm.maNcc" variant="outlined" density="comfortable" rounded="lg" placeholder="VD: NCC001" maxlength="10" :error-messages="nccErrors.maNcc"></v-text-field>
            </v-col>
            <v-col cols="12" :sm="editingNccId ? 12 : 6">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Tên nhà cung cấp *</div>
              <v-text-field v-model="nccForm.tenNcc" variant="outlined" density="comfortable" rounded="lg" placeholder="Nhập tên nhà cung cấp" maxlength="100" :error-messages="nccErrors.tenNcc"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Số điện thoại</div>
              <v-text-field v-model="nccForm.soDienThoai" variant="outlined" density="comfortable" rounded="lg" placeholder="VD: 0901234567" maxlength="10" :error-messages="nccErrors.soDienThoai"></v-text-field>
            </v-col>
            <v-col cols="12" sm="6">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Email</div>
              <v-text-field v-model="nccForm.email" variant="outlined" density="comfortable" rounded="lg" placeholder="VD: ncc@email.com" maxlength="100" :error-messages="nccErrors.email"></v-text-field>
            </v-col>
            <v-col cols="12">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Địa chỉ</div>
              <v-text-field v-model="nccForm.diaChi" variant="outlined" density="comfortable" rounded="lg" placeholder="Nhập địa chỉ" maxlength="200" :error-messages="nccErrors.diaChi"></v-text-field>
            </v-col>
            <v-col cols="12">
              <div class="mb-1 text-caption font-weight-bold text-medium-emphasis">Trạng thái</div>
              <v-select
                v-model.number="nccForm.trangThai"
                :items="[{ title: 'Đang hợp tác', value: 1 }, { title: 'Ngừng hợp tác', value: 0 }]"
                variant="outlined"
                density="comfortable"
                rounded="lg"
              ></v-select>
            </v-col>
          </v-row>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="closeNccModal">Hủy</v-btn>
          <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary" :loading="savingNcc" @click="saveNcc">
            {{ editingNccId ? "Cập nhật" : "Thêm nhà cung cấp" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ══ LIGHTBOX ══════════════════════════════════════════════════ -->
    <v-dialog v-model="lightbox.open" max-width="800">
      <v-card rounded="lg" class="pa-2">
        <v-btn icon size="small" variant="text" class="position-absolute" style="top: 8px; right: 8px; z-index: 1;" @click="lightbox.open = false">
          <X class="w-5 h-5" />
        </v-btn>
        <v-img :src="lightbox.src" max-height="80vh" contain></v-img>
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

/* ── THỐNG KÊ NHẬP KHO THEO THÁNG ──────────────────────────────── */
.thongke-chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; padding: 8px 4px 0; }
.thongke-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.thongke-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.thongke-bar { width: 60%; min-height: 2px; background: rgb(var(--v-theme-primary)); border-radius: 4px 4px 0 0; transition: height 0.3s ease; }
</style>