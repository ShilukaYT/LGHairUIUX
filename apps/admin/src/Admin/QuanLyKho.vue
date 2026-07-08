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

// ══ TABS ═══════════════════════════════════════════════════════════
const activeTab = ref("tonkho"); // tonkho | phieunhap | nhacc | lichsu | canhbao

// ══ TOAST / LIGHTBOX ═══════════════════════════════════════════════
const toast = reactive({ show: false, msg: "", type: "success" });
function showToast(msg, type = "success") {
  toast.msg = msg; toast.type = type; toast.show = true;
  setTimeout(() => { toast.show = false; }, 3000);
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
function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

// ── Nhân viên đang đăng nhập (đọc từ sessionStorage, do trang đăng nhập lưu) ──
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
const filterDanhMucTon = ref("");
const filterTrangThaiTon = ref("");
const curPageTon = ref(1);
const perPageTon = ref(10);
const sortFieldTon = ref(null);
const sortDirTon = ref(1);
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
        trangThai: filterTrangThaiTon.value === "" ? null : filterTrangThaiTon.value,
      },
    });
    tonKhoList.value = res.data.map(b => ({ ...b, hinhAnh: toAbsUrl(b.hinhAnh) }));
  } catch { showToast("Lỗi tải tồn kho!", "error"); }
  finally { loadingTon.value = false; }
}

function onFilterTonChange() { curPageTon.value = 1; loadTonKho(); }

function sortIconTon(f) { return sortFieldTon.value !== f ? "↕" : sortDirTon.value === 1 ? "↑" : "↓"; }
function setSortTon(f) {
  sortFieldTon.value === f ? (sortDirTon.value *= -1) : ((sortFieldTon.value = f), (sortDirTon.value = 1));
  curPageTon.value = 1;
}

const sortedTon = computed(() => {
  let arr = [...tonKhoList.value];
  if (sortFieldTon.value) {
    arr.sort((a, b) => {
      const av = a[sortFieldTon.value] ?? 0, bv = b[sortFieldTon.value] ?? 0;
      return av > bv ? sortDirTon.value : av < bv ? -sortDirTon.value : 0;
    });
  }
  return arr;
});
const totalPagesTon = computed(() => Math.max(1, Math.ceil(sortedTon.value.length / perPageTon.value)));
const pageDataTon = computed(() => {
  const s = (curPageTon.value - 1) * perPageTon.value;
  return sortedTon.value.slice(s, s + perPageTon.value);
});
const pageRangeTon = computed(() => {
  const t = totalPagesTon.value, c = curPageTon.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

const statsTon = computed(() => {
  const list = tonKhoList.value;
  return {
    tong: list.length,
    het: list.filter(b => b.mucTon === "het").length,
    thap: list.filter(b => b.mucTon === "thap").length,
    giaTri: list.reduce((s, b) => s + (b.soLuongTon || 0) * (b.giaBan || 0), 0),
  };
});

function stockClass(m) {
  return m === "het" ? "stock-zero" : m === "thap" ? "stock-low" : m === "on" ? "stock-ok" : "stock-unknown";
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

/* ════════════════════════════════════════════════════════════════
   TAB — LỊCH SỬ TỒN KHO
   ════════════════════════════════════════════════════════════════ */
const lichSuList = ref([]);
const lichSuTotal = ref(0);
const filterBienTheLS = ref("");
const filterLoaiBienDongLS = ref("");
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
const pageRangeLS = computed(() => {
  const t = totalPagesLS.value, c = curPageLS.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});
function gotoPageLS(p) { curPageLS.value = p; loadLichSu(); }

function loaiBienDongText(l) {
  return l === "NHAP" ? "Nhập kho" : l === "DIEU_CHINH" ? "Điều chỉnh" : l === "BAN" ? "Bán hàng" : l;
}
function loaiBienDongClass(l) {
  return l === "NHAP" ? "active" : l === "BAN" ? "cancelled" : "pending";
}
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("vi-VN");
}

/* ════════════════════════════════════════════════════════════════
   TAB — ĐỐI SOÁT KHO - HÓA ĐƠN ĐIỆN TỬ
   ════════════════════════════════════════════════════════════════ */
const doiSoatList = ref([]);
const doiSoatTotal = ref(0);
const doiSoatStats = ref({ tongLuot: 0, daKhop: 0, chuaKhop: 0 });
const tuNgayDS = ref("");
const denNgayDS = ref("");
const filterTrangThaiDS = ref("");
const curPageDS = ref(1);
const perPageDS = ref(20);
const loadingDS = ref(false);

async function loadDoiSoat() {
  loadingDS.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/doisoathoadon`, {
      params: {
        tuNgay: tuNgayDS.value || null,
        denNgay: denNgayDS.value || null,
        trangThai: filterTrangThaiDS.value || null,
        page: curPageDS.value,
        pageSize: perPageDS.value,
      },
    });
    doiSoatList.value = res.data.items || [];
    doiSoatTotal.value = res.data.total || 0;
    doiSoatStats.value = res.data.stats || { tongLuot: 0, daKhop: 0, chuaKhop: 0 };
  } catch { showToast("Lỗi tải dữ liệu đối soát!", "error"); }
  finally { loadingDS.value = false; }
}
function onFilterDSChange() { curPageDS.value = 1; loadDoiSoat(); }

const totalPagesDS = computed(() => Math.max(1, Math.ceil(doiSoatTotal.value / perPageDS.value)));
const pageRangeDS = computed(() => {
  const t = totalPagesDS.value, c = curPageDS.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});
function gotoPageDS(p) { curPageDS.value = p; loadDoiSoat(); }

const tyLeKhopDS = computed(() => {
  const t = doiSoatStats.value.tongLuot;
  return t > 0 ? Math.round((doiSoatStats.value.daKhop / t) * 100) : 100;
});

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
const filterNccPN = ref("");
const filterTrangThaiPN = ref("");
const tuNgayPN = ref("");
const denNgayPN = ref("");
const expandedPhieu = ref({});
const curPagePN = ref(1);
const perPagePN = ref(10);
const loadingPN = ref(false);
const savingPN = ref(false);

async function loadPhieuNhap() {
  loadingPN.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/phieunhap`, {
      params: {
        maNcc: filterNccPN.value || null,
        trangThai: filterTrangThaiPN.value === "" ? null : filterTrangThaiPN.value,
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
function onFilterPNChange() { curPagePN.value = 1; loadPhieuNhap(); }

function isExpandedPN(id) { return !!expandedPhieu.value[id]; }
function toggleExpandPN(id) {
  expandedPhieu.value[id] ? delete expandedPhieu.value[id] : (expandedPhieu.value[id] = true);
}

const totalPagesPN = computed(() => Math.max(1, Math.ceil(phieuNhaps.value.length / perPagePN.value)));
const pageDataPN = computed(() => {
  const s = (curPagePN.value - 1) * perPagePN.value;
  return phieuNhaps.value.slice(s, s + perPagePN.value);
});
const pageRangePN = computed(() => {
  const t = totalPagesPN.value, c = curPagePN.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

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
function pnStatusClass(t) { return t === 1 ? "active" : t === 2 ? "cancelled" : "pending"; }

// ── Modal Phiếu nhập ───────────────────────────────────────────────
const pnModal = reactive({ open: false, mode: "form", title: "" });
const pnErrors = reactive({ maPn: "", maNcc: "", maNv: "", ngayNhap: "", chiTiet: "" });
function clearPnErrors() { Object.keys(pnErrors).forEach(k => pnErrors[k] = ""); }

const pnForm = reactive({
  maPn: "", maNcc: "", maNv: currentNhanVien?.maNv || "", ngayNhap: todayStr(), ghiChu: "", chiTiet: [],
});
const pnDetail = ref(null); // dùng cho mode "view"

function resetPnForm() {
  Object.assign(pnForm, { maPn: "", maNcc: "", maNv: currentNhanVien?.maNv || "", ngayNhap: todayStr(), ghiChu: "", chiTiet: [] });
}

function openAddPN() {
  clearPnErrors(); resetPnForm(); btSearchKw.value = ""; btSuggestions.value = [];
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
const filterTrangThaiNcc = ref("");
const curPageNcc = ref(1);
const perPageNcc = ref(10);
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
    const ms = filterTrangThaiNcc.value === "" || String(n.trangThai) === filterTrangThaiNcc.value;
    return mq && ms;
  });
});
const totalPagesNcc = computed(() => Math.max(1, Math.ceil(filteredNcc.value.length / perPageNcc.value)));
const pageDataNcc = computed(() => {
  const s = (curPageNcc.value - 1) * perPageNcc.value;
  return filteredNcc.value.slice(s, s + perPageNcc.value);
});
const pageRangeNcc = computed(() => {
  const t = totalPagesNcc.value, c = curPageNcc.value;
  const lo = Math.max(1, c - 2), hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

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
  if (tab === "doisoat") loadDoiSoat();
}

// ══ INIT ═══════════════════════════════════════════════════════════
onMounted(async () => {
  await Promise.all([loadDanhMuc(), loadNcc()]);
  await loadTonKho();
});
</script>

<template>
  <div class="kho-manager" :class="{ 'dark-mode': isDarkMode }">

    <!-- ── HEADER ─────────────────────────────────────────────── -->
    <div class="header-bar">
      <div class="page-title-text">Quản lý kho hàng</div>
      <div class="header-actions">
        <button v-if="activeTab === 'phieunhap'" type="button" class="btn btn-primary btn-sm" @click="openAddPN">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v12M2 8h12" /></svg>
          Tạo phiếu nhập
        </button>
        <button v-if="activeTab === 'nhacc'" type="button" class="btn btn-primary btn-sm" @click="openAddNcc">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 2v12M2 8h12" /></svg>
          Thêm nhà cung cấp
        </button>
      </div>
    </div>

    <!-- ── TAB BAR ────────────────────────────────────────────── -->
    <div class="tab-bar">
      <button class="tab-btn" :class="{ active: activeTab === 'tonkho' }" @click="switchTab('tonkho')">Tồn kho</button>
      <button class="tab-btn" :class="{ active: activeTab === 'phieunhap' }" @click="switchTab('phieunhap')">Phiếu nhập</button>
      <!-- <button class="tab-btn" :class="{ active: activeTab === 'nhacc' }" @click="switchTab('nhacc')">Nhà cung cấp</button> -->
      <button class="tab-btn" :class="{ active: activeTab === 'canhbao' }" @click="switchTab('canhbao')">Cảnh báo tồn</button>
      <button class="tab-btn" :class="{ active: activeTab === 'lichsu' }" @click="switchTab('lichsu')">Lịch sử tồn kho</button>
      <button class="tab-btn" :class="{ active: activeTab === 'doisoat' }" @click="switchTab('doisoat')">Đối soát hóa đơn</button>
    </div>

    <!-- ════════════════════════════════════════════════════════
         TAB: TỒN KHO
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'tonkho'">
      <div class="stats-row">
        <div class="stat-card stat-dark">
          <!-- <div class="stat-icon">📦</div> -->
          <div class="stat-label">Tổng biến thể</div>
          <div class="stat-value">{{ statsTon.tong }}</div>
          <div class="stat-hint">Đang theo dõi</div>
        </div>
        <div class="stat-card stat-red">
          <!-- <div class="stat-icon">🚫</div> -->
          <div class="stat-label">Hết hàng</div>
          <div class="stat-value">{{ statsTon.het }}</div>
          <div class="stat-hint">Cần nhập gấp</div>
        </div>
        <div class="stat-card stat-orange">
          <!-- <div class="stat-icon">⚠️</div> -->
          <div class="stat-label">Sắp hết</div>
          <div class="stat-value">{{ statsTon.thap }}</div>
          <div class="stat-hint">Dưới 10 sản phẩm</div>
        </div>
        <div class="stat-card stat-green">
          <!-- <div class="stat-icon">💰</div> -->
          <div class="stat-label">Giá trị tồn kho</div>
          <div class="stat-value" style="font-size:20px">{{ fmt(statsTon.giaTri) }}</div>
          <div class="stat-hint">Theo giá bán</div>
        </div>
      </div>

      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
          <input v-model="searchTon" placeholder="Tìm tên sản phẩm, biến thể..." @keyup.enter="onFilterTonChange" />
        </div>
        <select v-model="filterDanhMucTon" class="filter-select" @change="onFilterTonChange">
          <option value="">Tất cả danh mục</option>
          <option v-for="dm in danhMucs" :key="dm.maDMSP" :value="dm.maDMSP">{{ dm.tenDanhMuc }}</option>
        </select>
        <select v-model="filterTrangThaiTon" class="filter-select" @change="onFilterTonChange">
          <option value="">Tất cả trạng thái</option>
          <option value="1">Đang bán</option>
          <option value="0">Ngừng bán</option>
        </select>
        <span class="result-count">{{ sortedTon.length }} kết quả</span>
        <select v-model.number="perPageTon" class="filter-select" style="width:auto;min-width:110px" @change="curPageTon = 1">
          <option :value="10">10 / trang</option>
          <option :value="20">20 / trang</option>
          <option :value="50">50 / trang</option>
          <option :value="9999">Tất cả</option>
        </select>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingTon }" title="Tải lại dữ liệu" @click="loadTonKho">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:56px">Ảnh</th>
              <th class="sortable" @click="setSortTon('tenSanPham')">Sản phẩm / Biến thể <span class="sort-icon">{{ sortIconTon("tenSanPham") }}</span></th>
              <th>Danh mục</th>
              <th class="sortable" @click="setSortTon('giaBan')">Giá bán <span class="sort-icon">{{ sortIconTon("giaBan") }}</span></th>
              <th class="sortable" @click="setSortTon('soLuongTon')">Tồn kho <span class="sort-icon">{{ sortIconTon("soLuongTon") }}</span></th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingTon && pageDataTon.length === 0">
              <td colspan="6"><div class="empty-state"><div class="empty-icon">🔍</div><div class="empty-text">Không tìm thấy biến thể nào</div></div></td>
            </tr>
            <tr v-for="b in pageDataTon" :key="b.maBienThe">
              <td>
                <div class="thumb-wrap" @click="openLightbox(b.hinhAnh)">
                  <img v-if="b.hinhAnh" :src="b.hinhAnh" class="thumb-img" :alt="b.tenBienThe" />
                  <div v-else class="thumb-placeholder">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                </div>
              </td>
              <td>
                <div class="sp-name">{{ b.tenSanPham || "—" }}</div>
                <div class="bt-subname">{{ b.tenBienThe }} <span class="code-text">{{ b.maBienThe }}</span></div>
              </td>
              <td><span class="brand-badge">{{ b.danhMuc || "—" }}</span></td>
              <td><span class="price-cell">{{ fmt(b.giaBan) }}</span></td>
              <td>
                <span class="stock-badge" :class="stockClass(b.mucTon)">{{ b.soLuongTon ?? "—" }} cái</span>
              </td>
              <td>
                <span class="status-pill" :class="b.trangThai ? 'active' : 'inactive'">
                  <span class="status-dot"></span>{{ b.trangThai ? "Đang bán" : "Ngừng bán" }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="sortedTon.length > 0 && perPageTon < 9999" class="pager-wrap">
          <span>Hiển thị {{ (curPageTon - 1) * perPageTon + 1 }}–{{ Math.min(curPageTon * perPageTon, sortedTon.length) }} / {{ sortedTon.length }} mục</span>
          <div class="pager-btns">
            <button class="page-btn" :disabled="curPageTon <= 1" @click="curPageTon--">‹</button>
            <button v-for="p in pageRangeTon" :key="p" class="page-btn" :class="{ cur: p === curPageTon }" @click="curPageTon = p">{{ p }}</button>
            <button class="page-btn" :disabled="curPageTon >= totalPagesTon" @click="curPageTon++">›</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════
         TAB: PHIẾU NHẬP
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'phieunhap'">
      <!-- <div class="toolbar" style="margin-bottom:10px">
        <button type="button" class="btn btn-ghost btn-sm" @click="toggleThongKe">
          {{ showThongKe ? "Ẩn thống kê theo tháng" : "Xem thống kê nhập kho theo tháng" }}
        </button>
      </div> -->

      <div v-if="showThongKe" class="table-wrap" style="padding:16px;margin-bottom:16px">
        <div class="toolbar" style="margin-bottom:12px">
          <label class="form-label" style="margin:0">Năm:</label>
          <select v-model.number="thongKeNam" class="filter-select" style="width:auto" @change="loadThongKe">
            <option v-for="y in [thongKeNam, thongKeNam-1, thongKeNam-2]" :key="y" :value="y">{{ y }}</option>
          </select>
          <span v-if="thongKeData" class="result-count">
            Tổng {{ thongKeData.tongSoPhieuCaNam }} phiếu · {{ fmt(thongKeData.tongTienCaNam) }}
          </span>
        </div>
        <div v-if="loadingThongKe" class="empty-state"><div class="empty-text">Đang tải thống kê...</div></div>
        <div v-else-if="thongKeData" class="thongke-chart">
          <div v-for="t in thongKeData.theoThang" :key="t.thang" class="thongke-col">
            <div class="thongke-bar-wrap">
              <div class="thongke-bar" :style="{ height: (t.tongTien / maxThongKeTien * 100) + '%' }" :title="fmt(t.tongTien)"></div>
            </div>
            <div class="thongke-label">T{{ t.thang }}</div>
            <div class="thongke-sub">{{ t.soPhieuNhap }} phiếu</div>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-card stat-dark">
          <!-- <div class="stat-icon">📥</div> -->
          <div class="stat-label">Tổng phiếu nhập</div>
          <div class="stat-value">{{ statsPN.tong }}</div>
          <div class="stat-hint">Trong bộ lọc hiện tại</div>
        </div>
        <div class="stat-card stat-orange">
          <!-- <div class="stat-icon">⏳</div> -->
          <div class="stat-label">Chờ duyệt</div>
          <div class="stat-value">{{ statsPN.choDuyet }}</div>
          <div class="stat-hint">Cần xử lý</div>
        </div>
        <div class="stat-card stat-green">
          <!-- <div class="stat-icon">✅</div> -->
          <div class="stat-label">Đã duyệt</div>
          <div class="stat-value">{{ statsPN.daDuyet }}</div>
          <div class="stat-hint">Đã cập nhật tồn kho</div>
        </div>
        <div class="stat-card stat-blue">
          <!-- <div class="stat-icon">💵</div> -->
          <div class="stat-label">Tổng tiền đã duyệt</div>
          <div class="stat-value" style="font-size:20px">{{ fmt(statsPN.tongTien) }}</div>
          <div class="stat-hint">Tổng giá trị nhập</div>
        </div>
      </div>

      <div class="toolbar">
        <select v-model="filterNccPN" class="filter-select" @change="onFilterPNChange">
          <option value="">Tất cả nhà cung cấp</option>
          <option v-for="n in nccs" :key="n.maNcc" :value="n.maNcc">{{ n.tenNcc }}</option>
        </select>
        <select v-model="filterTrangThaiPN" class="filter-select" @change="onFilterPNChange">
          <option value="">Tất cả trạng thái</option>
          <option value="0">Chờ duyệt</option>
          <option value="1">Đã duyệt</option>
          <option value="2">Đã hủy</option>
        </select>
        <input type="date" v-model="tuNgayPN" class="filter-select" @change="onFilterPNChange" />
        <span class="date-sep">→</span>
        <input type="date" v-model="denNgayPN" class="filter-select" @change="onFilterPNChange" />
        <span class="result-count">{{ phieuNhaps.length }} kết quả</span>
        <select v-model.number="perPagePN" class="filter-select" style="width:auto;min-width:110px" @change="curPagePN = 1">
          <option :value="10">10 / trang</option>
          <option :value="20">20 / trang</option>
          <option :value="9999">Tất cả</option>
        </select>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingPN }" title="Tải lại dữ liệu" @click="loadPhieuNhap">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã phiếu</th>
              <th>Ngày nhập</th>
              <th>Nhà cung cấp</th>
              <th>Nhân viên</th>
              <th>Số dòng</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingPN && pageDataPN.length === 0">
              <td colspan="8"><div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">Không có phiếu nhập nào</div></div></td>
            </tr>
            <template v-for="p in pageDataPN" :key="p.maPn">
              <tr class="sp-main-row" :class="{ 'row-expanded': isExpandedPN(p.maPn) }">
                <td>
                  <button type="button" class="expand-btn" @click="toggleExpandPN(p.maPn)">
                    <svg class="expand-icon" :class="{ open: isExpandedPN(p.maPn) }" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>
                  </button>
                  <span class="code-text">{{ p.maPn }}</span>
                </td>
                <td>{{ fmtDate(p.ngayNhap) }}</td>
                <td>{{ p.tenNcc || "—" }}</td>
                <td>{{ p.tenNv || "—" }}</td>
                <td><span class="bt-count-badge">{{ p.soLuongDong }} dòng</span></td>
                <td><span class="price-cell">{{ fmt(p.tongTien) }}</span></td>
                <td>
                  <span class="status-pill" :class="pnStatusClass(p.trangThai)">
                    <span class="status-dot"></span>{{ pnStatusText(p.trangThai) }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button class="icon-btn view" title="Xem chi tiết" @click="openViewPN(p)">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/></svg>
                    </button>
                    <button v-if="p.trangThai === 0" class="icon-btn approve" title="Duyệt phiếu" @click="duyetPN(p)">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8l3.5 3.5L13 5"/></svg>
                    </button>
                    <button v-if="p.trangThai === 0" class="icon-btn cancel" title="Hủy phiếu" @click="huyPN(p)">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="8" cy="8" r="6.5"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/></svg>
                    </button>
                    <button v-if="p.trangThai !== 1" class="icon-btn del" title="Xóa phiếu" @click="deletePN(p)">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="isExpandedPN(p.maPn)" class="sp-detail-row">
                <td colspan="8">
                  <div class="nested-panel">
                    <div class="nested-header">
                      <h4 class="nested-title">Chi tiết phiếu nhập <span class="nested-count">{{ p.chiTiet.length }}</span></h4>
                    </div>
                    <div v-if="!p.chiTiet.length" class="nested-empty">Chưa có dòng chi tiết.</div>
                    <div v-else class="bt-table-wrap">
                      <table class="bt-table">
                        <thead><tr><th style="width:44px"></th><th>Sản phẩm / Biến thể</th><th>Số lượng</th><th>Giá nhập</th><th>Thành tiền</th></tr></thead>
                        <tbody>
                          <tr v-for="c in p.chiTiet" :key="c.maBienThe">
                            <td>
                              <div class="thumb-wrap" style="width:32px;height:32px" @click="openLightbox(c.hinhAnh)">
                                <img v-if="c.hinhAnh" :src="c.hinhAnh" class="thumb-img" style="width:32px;height:32px" />
                                <div v-else class="thumb-placeholder" style="width:32px;height:32px">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                                </div>
                              </div>
                            </td>
                            <td><div class="bt-name">{{ c.tenSanPham }}</div><div class="bt-subname">{{ c.tenBienThe }}</div></td>
                            <td>{{ c.soLuong }}</td>
                            <td>{{ fmt(c.giaNhap) }}</td>
                            <td class="price-cell">{{ fmt(c.thanhTien) }}</td>
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
        <div v-if="phieuNhaps.length > 0 && perPagePN < 9999" class="pager-wrap">
          <span>Hiển thị {{ (curPagePN - 1) * perPagePN + 1 }}–{{ Math.min(curPagePN * perPagePN, phieuNhaps.length) }} / {{ phieuNhaps.length }} mục</span>
          <div class="pager-btns">
            <button class="page-btn" :disabled="curPagePN <= 1" @click="curPagePN--">‹</button>
            <button v-for="p in pageRangePN" :key="p" class="page-btn" :class="{ cur: p === curPagePN }" @click="curPagePN = p">{{ p }}</button>
            <button class="page-btn" :disabled="curPagePN >= totalPagesPN" @click="curPagePN++">›</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════
         TAB: NHÀ CUNG CẤP
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'nhacc'">
      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
          <input v-model="searchNcc" placeholder="Tìm tên, mã nhà cung cấp..." @input="curPageNcc = 1" />
        </div>
        <select v-model="filterTrangThaiNcc" class="filter-select" @change="curPageNcc = 1">
          <option value="">Tất cả trạng thái</option>
          <option value="1">Đang hợp tác</option>
          <option value="0">Ngừng hợp tác</option>
        </select>
        <span class="result-count">{{ filteredNcc.length }} kết quả</span>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingNcc }" title="Tải lại dữ liệu" @click="loadNcc">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mã NCC</th><th>Tên nhà cung cấp</th><th>SĐT</th><th>Địa chỉ</th><th>Email</th><th>Số phiếu nhập</th><th>Trạng thái</th><th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingNcc && pageDataNcc.length === 0">
              <td colspan="8"><div class="empty-state"><div class="empty-icon">🏭</div><div class="empty-text">Không có nhà cung cấp nào</div></div></td>
            </tr>
            <tr v-for="n in pageDataNcc" :key="n.maNcc">
              <td><span class="code-text">{{ n.maNcc }}</span></td>
              <td><div class="sp-name">{{ n.tenNcc }}</div></td>
              <td>{{ n.soDienThoai || "—" }}</td>
              <td class="addr-cell">{{ n.diaChi || "—" }}</td>
              <td>{{ n.email || "—" }}</td>
              <td><span class="bt-count-badge">{{ n.soPhieuNhap }} phiếu</span></td>
              <td>
                <span class="status-pill clickable" :class="n.trangThai ? 'active' : 'inactive'" @click="toggleStatusNcc(n)">
                  <span class="status-dot"></span>{{ n.trangThai ? "Đang hợp tác" : "Ngừng hợp tác" }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <button class="icon-btn edit" title="Sửa" @click="openEditNcc(n)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3L5 14H2v-3L11 2z"/></svg>
                  </button>
                  <button class="icon-btn del" title="Xóa" @click="deleteNcc(n)">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="filteredNcc.length > 0 && perPageNcc < 9999" class="pager-wrap">
          <span>Hiển thị {{ (curPageNcc - 1) * perPageNcc + 1 }}–{{ Math.min(curPageNcc * perPageNcc, filteredNcc.length) }} / {{ filteredNcc.length }} mục</span>
          <div class="pager-btns">
            <button class="page-btn" :disabled="curPageNcc <= 1" @click="curPageNcc--">‹</button>
            <button v-for="p in pageRangeNcc" :key="p" class="page-btn" :class="{ cur: p === curPageNcc }" @click="curPageNcc = p">{{ p }}</button>
            <button class="page-btn" :disabled="curPageNcc >= totalPagesNcc" @click="curPageNcc++">›</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════
         TAB: CẢNH BÁO SẮP HẾT HÀNG
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'canhbao'">
      <div class="toolbar">
        <label class="form-label" style="margin:0">Ngưỡng cảnh báo (tồn dưới):</label>
        <input type="number" min="0" v-model.number="nguongCanhBao" class="form-input form-input-sm" style="width:90px" @change="onNguongCanhBaoChange" />
        <span class="result-count">{{ canhBaoList.length }} biến thể cần chú ý</span>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingCanhBao }" title="Tải lại dữ liệu" @click="loadCanhBao">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:56px">Ảnh</th>
              <th>Sản phẩm / Biến thể</th>
              <th>Tồn kho</th>
              <th>Giá bán</th>
              <th>Mức độ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingCanhBao && canhBaoList.length === 0">
              <td colspan="5"><div class="empty-state"><div class="empty-icon">✅</div><div class="empty-text">Không có biến thể nào dưới ngưỡng cảnh báo</div></div></td>
            </tr>
            <tr v-for="b in canhBaoList" :key="b.maBienThe">
              <td>
                <div class="thumb-wrap" @click="openLightbox(b.hinhAnh)">
                  <img v-if="b.hinhAnh" :src="b.hinhAnh" class="thumb-img" :alt="b.tenBienThe" />
                  <div v-else class="thumb-placeholder">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  </div>
                </div>
              </td>
              <td>
                <div class="sp-name">{{ b.tenSanPham || "—" }}</div>
                <div class="bt-subname">{{ b.tenBienThe }} <span class="code-text">{{ b.maBienThe }}</span></div>
              </td>
              <td><span class="stock-badge" :class="stockClass(b.mucTon)">{{ b.soLuongTon ?? 0 }} cái</span></td>
              <td><span class="price-cell">{{ fmt(b.giaBan) }}</span></td>
              <td>
                <span class="status-pill" :class="b.mucTon === 'het' ? 'inactive' : 'pending'">
                  <span class="status-dot"></span>{{ stockText(b.mucTon) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════
         TAB: LỊCH SỬ TỒN KHO
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'lichsu'">
      <div class="toolbar">
        <div class="search-box">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
          <input v-model="filterBienTheLS" placeholder="Mã biến thể..." @keyup.enter="onFilterLSChange" />
        </div>
        <select v-model="filterLoaiBienDongLS" class="filter-select" @change="onFilterLSChange">
          <option value="">Tất cả loại biến động</option>
          <option value="NHAP">Nhập kho</option>
          <!-- <option value="HUY_NHAP">Hủy nhập</option> -->
          <option value="DIEU_CHINH">Điều chỉnh</option>
          <option value="BAN">Bán hàng</option>
        </select>
        <input type="date" v-model="tuNgayLS" class="form-input" style="width:auto" @change="onFilterLSChange" />
        <span style="color:var(--dvc-text-muted)">đến</span>
        <input type="date" v-model="denNgayLS" class="form-input" style="width:auto" @change="onFilterLSChange" />
        <span class="result-count">{{ lichSuTotal }} kết quả</span>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingLS }" title="Tải lại dữ liệu" @click="loadLichSu">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Sản phẩm / Biến thể</th>
              <th>Loại biến động</th>
              <th>Thay đổi</th>
              <th>Tồn trước → sau</th>
              <th>Chứng từ</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingLS && lichSuList.length === 0">
              <td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">Chưa có lịch sử biến động nào</div></div></td>
            </tr>
            <tr v-for="l in lichSuList" :key="l.maLich">
              <td>{{ fmtDateTime(l.thoiGian) }}</td>
              <td>
                <div class="sp-name">{{ l.tenSanPham || "—" }}</div>
                <div class="bt-subname">{{ l.tenBienThe }} <span class="code-text">{{ l.maBienThe }}</span></div>
              </td>
              <td>
                <span class="status-pill" :class="loaiBienDongClass(l.loaiBienDong)">
                  <span class="status-dot"></span>{{ loaiBienDongText(l.loaiBienDong) }}
                </span>
              </td>
              <td>
                <span :class="l.soLuongThayDoi >= 0 ? 'stock-ok' : 'stock-zero'" class="stock-badge">
                  {{ l.soLuongThayDoi >= 0 ? "+" : "" }}{{ l.soLuongThayDoi }}
                </span>
              </td>
              <td>{{ l.tonTruoc }} → {{ l.tonSau }}</td>
              <td><span class="code-text">{{ l.maChungTu || "—" }}</span></td>
              <td class="addr-cell">{{ l.ghiChu || "—" }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="lichSuTotal > 0" class="pager-wrap">
          <span>Hiển thị {{ (curPageLS - 1) * perPageLS + 1 }}–{{ Math.min(curPageLS * perPageLS, lichSuTotal) }} / {{ lichSuTotal }} mục</span>
          <div class="pager-btns">
            <button class="page-btn" :disabled="curPageLS <= 1" @click="gotoPageLS(curPageLS - 1)">‹</button>
            <button v-for="p in pageRangeLS" :key="p" class="page-btn" :class="{ cur: p === curPageLS }" @click="gotoPageLS(p)">{{ p }}</button>
            <button class="page-btn" :disabled="curPageLS >= totalPagesLS" @click="gotoPageLS(curPageLS + 1)">›</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ════════════════════════════════════════════════════════
         TAB: ĐỐI SOÁT KHO - HÓA ĐƠN ĐIỆN TỬ
         ════════════════════════════════════════════════════════ -->
    <template v-if="activeTab === 'doisoat'">
      <div class="stats-row">
        <div class="stat-card stat-dark">
          <div class="stat-label">Tổng lượt bán</div>
          <div class="stat-value">{{ doiSoatStats.tongLuot }}</div>
          <div class="stat-hint">Trong khoảng thời gian lọc</div>
        </div>
        <div class="stat-card stat-green">
          <div class="stat-label">Đã có hóa đơn</div>
          <div class="stat-value">{{ doiSoatStats.daKhop }}</div>
          <div class="stat-hint">Xuất hóa đơn thành công</div>
        </div>
        <div class="stat-card stat-red">
          <div class="stat-label">Chưa khớp hóa đơn</div>
          <div class="stat-value">{{ doiSoatStats.chuaKhop }}</div>
          <div class="stat-hint">Chưa xuất / lỗi / đang chờ</div>
        </div>
        <div class="stat-card stat-orange">
          <div class="stat-label">Tỷ lệ khớp</div>
          <div class="stat-value">{{ tyLeKhopDS }}%</div>
          <div class="stat-hint">Kho ↔ Hóa đơn điện tử</div>
        </div>
      </div>

      <div class="toolbar">
        <input type="date" v-model="tuNgayDS" class="form-input" style="width:auto" @change="onFilterDSChange" />
        <span style="color:var(--dvc-text-muted)">đến</span>
        <input type="date" v-model="denNgayDS" class="form-input" style="width:auto" @change="onFilterDSChange" />
        <select v-model="filterTrangThaiDS" class="filter-select" @change="onFilterDSChange">
          <option value="">Tất cả trạng thái</option>
          <option value="khop">Đã có hóa đơn</option>
          <option value="thieu">Chưa khớp hóa đơn</option>
        </select>
        <span class="result-count">{{ doiSoatTotal }} kết quả</span>
        <button type="button" class="btn-refresh" :class="{ spinning: loadingDS }" title="Tải lại dữ liệu" @click="loadDoiSoat">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.6h-3.6"/></svg>
        </button>
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Sản phẩm / Biến thể</th>
              <th>SL bán</th>
              <th>Mã đơn hàng</th>
              <th>Trạng thái hóa đơn</th>
              <th>Số hóa đơn</th>
              <th>Hóa đơn PDF</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!loadingDS && doiSoatList.length === 0">
              <td colspan="7"><div class="empty-state"><div class="empty-icon">🧾</div><div class="empty-text">Không có dữ liệu đối soát</div></div></td>
            </tr>
            <tr v-for="d in doiSoatList" :key="d.maLich">
              <td>{{ fmtDateTime(d.thoiGian) }}</td>
              <td>
                <div class="sp-name">{{ d.tenSanPham || "—" }}</div>
                <div class="bt-subname">{{ d.tenBienThe }} <span class="code-text">{{ d.maBienThe }}</span></div>
              </td>
              <td>
                <span class="stock-badge stock-zero">{{ d.soLuongThayDoi }}</span>
              </td>
              <td><span class="code-text">{{ d.maDonHang || "—" }}</span></td>
              <td>
                <span v-if="d.trangThaiHoaDon === 1" class="status-pill active"><span class="status-dot"></span>Đã xuất</span>
                <span v-else-if="d.trangThaiHoaDon === 2" class="status-pill cancelled" :title="d.ghiChuLoi"><span class="status-dot"></span>Lỗi</span>
                <span v-else-if="d.coHoaDon" class="status-pill pending"><span class="status-dot"></span>Đang chờ</span>
                <span v-else class="status-pill inactive"><span class="status-dot"></span>Không xuất HĐ</span>
              </td>
              <td>{{ d.soHoaDon || "—" }}</td>
              <td>
                <a v-if="d.linkPdf" :href="d.linkPdf" target="_blank" class="icon-btn view" title="Xem PDF">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 8s2.5-5 6-5 6 5 6 5-2.5 5-6 5-6-5-6-5Z"/><circle cx="8" cy="8" r="2"/></svg>
                </a>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="doiSoatTotal > 0" class="pager-wrap">
          <span>Hiển thị {{ (curPageDS - 1) * perPageDS + 1 }}–{{ Math.min(curPageDS * perPageDS, doiSoatTotal) }} / {{ doiSoatTotal }} mục</span>
          <div class="pager-btns">
            <button class="page-btn" :disabled="curPageDS <= 1" @click="gotoPageDS(curPageDS - 1)">‹</button>
            <button v-for="p in pageRangeDS" :key="p" class="page-btn" :class="{ cur: p === curPageDS }" @click="gotoPageDS(p)">{{ p }}</button>
            <button class="page-btn" :disabled="curPageDS >= totalPagesDS" @click="gotoPageDS(curPageDS + 1)">›</button>
          </div>
        </div>
      </div>
    </template>

    <!-- ══ MODAL PHIẾU NHẬP (THÊM / XEM) ══════════════════════════════ -->
    <Teleport to="body">
      <div v-if="pnModal.open" class="modal-overlay" :class="{ 'dark-mode': isDarkMode }" @click.self="closePnModal">
        <div class="modal modal-wide">
          <div class="modal-header">
            <h3 class="modal-title">{{ pnModal.title }}</h3>
            <button class="modal-close" @click="closePnModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l12 12M14 2L2 14"/></svg>
            </button>
          </div>
          <div class="modal-body">

            <!-- VIEW MODE -->
            <template v-if="pnModal.mode === 'view' && pnDetail">
              <div class="detail-info-col" style="margin-bottom:14px">
                <div class="detail-row"><span class="detail-label">Mã phiếu</span><span class="code-text">{{ pnDetail.maPn }}</span></div>
                <div class="detail-row"><span class="detail-label">Ngày nhập</span><span class="detail-val">{{ fmtDate(pnDetail.ngayNhap) }}</span></div>
                <div class="detail-row"><span class="detail-label">Nhà cung cấp</span><span class="detail-val">{{ pnDetail.tenNcc || "—" }}</span></div>
                <div class="detail-row"><span class="detail-label">Nhân viên</span><span class="detail-val">{{ pnDetail.tenNv || "—" }}</span></div>
                <div class="detail-row"><span class="detail-label">Ghi chú</span><span class="detail-val">{{ pnDetail.ghiChu || "—" }}</span></div>
                <div class="detail-row"><span class="detail-label">Trạng thái</span>
                  <span class="status-pill" :class="pnStatusClass(pnDetail.trangThai)"><span class="status-dot"></span>{{ pnStatusText(pnDetail.trangThai) }}</span>
                </div>
              </div>
              <div class="bt-table-wrap">
                <table class="bt-table">
                  <thead><tr><th style="width:44px"></th><th>Sản phẩm / Biến thể</th><th>Giá bán hiện tại</th><th>SL</th><th>Giá nhập</th><th>Thành tiền</th></tr></thead>
                  <tbody>
                    <tr v-for="c in pnDetail.chiTiet" :key="c.maBienThe">
                      <td>
                        <div class="thumb-wrap" style="width:32px;height:32px" @click="openLightbox(c.hinhAnh)">
                          <img v-if="c.hinhAnh" :src="c.hinhAnh" class="thumb-img" style="width:32px;height:32px" />
                        </div>
                      </td>
                      <td><div class="bt-name">{{ c.tenSanPham }}</div><div class="bt-subname">{{ c.tenBienThe }}</div></td>
                      <td>{{ fmt(c.giaBanHienTai) }}</td>
                      <td>{{ c.soLuong }}</td>
                      <td>{{ fmt(c.giaNhap) }}</td>
                      <td class="price-cell">{{ fmt(c.thanhTien) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div class="total-line">Tổng tiền: <span class="price-cell">{{ fmt(pnDetail.tongTien) }}</span></div>
            </template>

            <!-- FORM ADD MODE -->
            <template v-else>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Mã phiếu nhập *</label>
                  <input v-model="pnForm.maPn" class="form-input" :class="{ 'input-error': pnErrors.maPn }" placeholder="VD: PN001" maxlength="15" />
                  <p v-if="pnErrors.maPn" class="field-error">{{ pnErrors.maPn }}</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Ngày nhập</label>
                  <input type="date" v-model="pnForm.ngayNhap" class="form-input" :class="{ 'input-error': pnErrors.ngayNhap }" :max="todayStr()" />
                  <p v-if="pnErrors.ngayNhap" class="field-error">{{ pnErrors.ngayNhap }}</p>
                </div>
              </div>
              <div class="form-row-2">
                <div class="form-group">
                  <label class="form-label">Nhà cung cấp</label>
                  <select v-model="pnForm.maNcc" class="form-input">
                    <option value="">-- Không chọn --</option>
                    <option v-for="n in nccs" :key="n.maNcc" :value="n.maNcc">{{ n.tenNcc }}</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Người nhập</label>
                  <input
                    :value="currentNhanVien ? `${currentNhanVien.ten} (${currentNhanVien.maNv})` : 'Không xác định'"
                    class="form-input"
                    readonly
                    disabled
                  />
                  <p v-if="!currentNhanVien" class="field-error">Không tìm thấy thông tin đăng nhập, vui lòng đăng nhập lại.</p>
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Ghi chú</label>
                <textarea v-model="pnForm.ghiChu" class="form-input" rows="2" placeholder="Ghi chú thêm (nếu có)" maxlength="500"></textarea>
              </div>

              <!-- Tìm & thêm biến thể -->
              <div class="form-group">
                <label class="form-label">Thêm sản phẩm vào phiếu *</label>
                <div class="bt-search-wrap">
                  <div class="search-box" style="max-width:none">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
                    <input v-model="btSearchKw" placeholder="Tìm mã, tên sản phẩm / biến thể..." @input="onBtSearchInput" @focus="onBtSearchInput" />
                  </div>
                  <div v-if="btSuggestions.length" class="bt-suggest-list">
                    <div v-for="bt in btSuggestions" :key="bt.maBienThe" class="bt-suggest-item" @click="addBTRow(bt)">
                      <img v-if="bt.hinhAnh" :src="bt.hinhAnh" class="bt-suggest-thumb" />
                      <div class="bt-suggest-thumb placeholder" v-else></div>
                      <div class="bt-suggest-info">
                        <div class="bt-suggest-name">{{ bt.label }}</div>
                        <div class="bt-suggest-meta">{{ fmt(bt.giaBan) }} · Tồn: {{ bt.soLuongTon ?? 0 }}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <p v-if="pnErrors.chiTiet" class="field-error">{{ pnErrors.chiTiet }}</p>
              </div>

              <div v-if="pnForm.chiTiet.length" class="bt-table-wrap" style="margin-top:6px">
                <table class="bt-table">
                  <thead><tr><th style="width:44px"></th><th>Sản phẩm</th><th style="width:90px">SL</th><th style="width:130px">Giá nhập</th><th style="width:120px">Thành tiền</th><th style="width:36px"></th></tr></thead>
                  <tbody>
                    <tr v-for="(c, idx) in pnForm.chiTiet" :key="c.maBienThe">
                      <td>
                        <div class="thumb-wrap" style="width:32px;height:32px">
                          <img v-if="c.hinhAnh" :src="c.hinhAnh" class="thumb-img" style="width:32px;height:32px" />
                        </div>
                      </td>
                      <td class="bt-name">{{ c.label }}</td>
                      <td><input type="number" min="1" max="1000000" v-model.number="c.soLuong" class="form-input form-input-sm" /></td>
                      <td><input type="number" min="0" max="1000000000" v-model.number="c.giaNhap" class="form-input form-input-sm" /></td>
                      <td class="price-cell">{{ fmt((c.soLuong || 0) * (c.giaNhap || 0)) }}</td>
                      <td><button type="button" class="icon-btn del icon-btn-xs" @click="removeBTRow(idx)">✕</button></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="nested-empty" style="border:1px dashed #e5e7eb;border-radius:8px;margin-top:6px">Chưa có sản phẩm nào trong phiếu, hãy tìm và chọn ở trên.</div>

              <div class="total-line">Tổng tiền: <span class="price-cell">{{ fmt(tongTienForm) }}</span></div>
            </template>

          </div>
          <div class="modal-footer">
            <template v-if="pnModal.mode === 'view'">
              <button type="button" class="btn btn-ghost" @click="closePnModal">Đóng</button>
            </template>
            <template v-else>
              <button type="button" class="btn btn-ghost" @click="closePnModal">Hủy</button>
              <button type="button" class="btn btn-primary" :disabled="savingPN" @click="savePN">
                <span v-if="savingPN" class="spinner"></span>
                {{ savingPN ? "Đang lưu..." : "Tạo phiếu nhập" }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ MODAL NHÀ CUNG CẤP ══════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="nccModal.open" class="modal-overlay" :class="{ 'dark-mode': isDarkMode }" @click.self="closeNccModal">
        <div class="modal">
          <div class="modal-header">
            <h3 class="modal-title">{{ nccModal.title }}</h3>
            <button class="modal-close" @click="closeNccModal">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 2l12 12M14 2L2 14"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-row-2">
              <div class="form-group" v-if="!editingNccId">
                <label class="form-label">Mã nhà cung cấp *</label>
                <input v-model="nccForm.maNcc" class="form-input" :class="{ 'input-error': nccErrors.maNcc }" placeholder="VD: NCC001" maxlength="10" />
                <p v-if="nccErrors.maNcc" class="field-error">{{ nccErrors.maNcc }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Tên nhà cung cấp *</label>
                <input v-model="nccForm.tenNcc" class="form-input" :class="{ 'input-error': nccErrors.tenNcc }" placeholder="Nhập tên nhà cung cấp" maxlength="100" />
                <p v-if="nccErrors.tenNcc" class="field-error">{{ nccErrors.tenNcc }}</p>
              </div>
            </div>
            <div class="form-row-2">
              <div class="form-group">
                <label class="form-label">Số điện thoại</label>
                <input v-model="nccForm.soDienThoai" class="form-input" :class="{ 'input-error': nccErrors.soDienThoai }" placeholder="VD: 0901234567" maxlength="10" />
                <p v-if="nccErrors.soDienThoai" class="field-error">{{ nccErrors.soDienThoai }}</p>
              </div>
              <div class="form-group">
                <label class="form-label">Email</label>
                <input v-model="nccForm.email" class="form-input" :class="{ 'input-error': nccErrors.email }" placeholder="VD: ncc@email.com" maxlength="100" />
                <p v-if="nccErrors.email" class="field-error">{{ nccErrors.email }}</p>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Địa chỉ</label>
              <input v-model="nccForm.diaChi" class="form-input" :class="{ 'input-error': nccErrors.diaChi }" placeholder="Nhập địa chỉ" maxlength="200" />
              <p v-if="nccErrors.diaChi" class="field-error">{{ nccErrors.diaChi }}</p>
            </div>
            <div class="form-group">
              <label class="form-label">Trạng thái</label>
              <select v-model.number="nccForm.trangThai" class="form-input">
                <option :value="1">Đang hợp tác</option>
                <option :value="0">Ngừng hợp tác</option>
              </select>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" @click="closeNccModal">Hủy</button>
            <button type="button" class="btn btn-primary" :disabled="savingNcc" @click="saveNcc">
              <span v-if="savingNcc" class="spinner"></span>
              {{ savingNcc ? "Đang lưu..." : editingNccId ? "Cập nhật" : "Thêm nhà cung cấp" }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ══ LIGHTBOX ══════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="lightbox.open" class="lb-overlay" @click.self="lightbox.open = false">
        <button class="lb-close" @click="lightbox.open = false">✕</button>
        <img :src="lightbox.src" class="lb-img" />
      </div>
    </Teleport>

    <!-- ══ TOAST ═════════════════════════════════════════════════════ -->
    <div class="toast" :class="[{ show: toast.show }, toast.type]">
      <span>{{ toast.type === "success" ? "✅" : "❌" }}</span>{{ toast.msg }}
    </div>
  </div>
</template>

<style scoped>
/* ── THEME VARIABLES (dark mode) ─────────────────────────────── */
.kho-manager.dark-mode {
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

/* ── ROOT ───────────────────────────────────────────────────────── */
.kho-manager {
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
 font-family: "Jost", "Inter", sans-serif; color: var(--dvc-text); }

/* ── HEADER ─────────────────────────────────────────────────────── */
.header-bar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px; }
.page-title-text { font-size: 17px; font-weight: 700; color: var(--dvc-text); letter-spacing: 0.2px; }
.header-actions { display: flex; gap: 8px; }

/* ── TABS ───────────────────────────────────────────────────────── */
.tab-bar { display: flex; gap: 4px; margin-bottom: 18px; border-bottom: 1px solid var(--dvc-border); }
.tab-btn { background: none; border: none; padding: 9px 16px; font-size: 13px; font-weight: 500; color: var(--dvc-text-muted); cursor: pointer; font-family: inherit; border-bottom: 2px solid transparent; transition: all 0.15s; }
.tab-btn:hover { color: var(--dvc-text-strong); }
.tab-btn.active { color: var(--dvc-text); border-bottom-color: var(--dvc-accent); font-weight: 600; }

/* ── BUTTONS ────────────────────────────────────────────────────── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 15px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; border: none; font-family: inherit; transition: all 0.15s; white-space: nowrap; }
.btn:disabled { opacity: 0.55; cursor: not-allowed; }
.btn-primary { background: var(--dvc-accent); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--dvc-accent-hover); transform: translateY(-1px); }
.btn-ghost { background: transparent; color: var(--dvc-text-secondary); border: 1px solid var(--dvc-border); }
.btn-ghost:hover:not(:disabled) { color: var(--dvc-text); border-color: var(--dvc-border-strong); background: var(--dvc-bg-subtle2); }
.btn-sm { padding: 6px 12px; font-size: 12px; }
.spinner { width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite; flex-shrink: 0; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── STATS ──────────────────────────────────────────────────────── */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 3px; }
.stat-icon { font-size: 20px; margin-bottom: 4px; }
.stat-label { font-size: 11px; font-weight: 600; color: var(--dvc-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--dvc-text); line-height: 1.1; }
.stat-hint { font-size: 11px; color: var(--dvc-text-muted); margin-top: 2px; }
.stat-dark { border-top: 3px solid var(--dvc-accent); }
.stat-green { border-top: 3px solid #22c55e; }
.stat-blue { border-top: 3px solid #3b82f6; }
.stat-orange { border-top: 3px solid #f59e0b; }
.stat-red { border-top: 3px solid #ef4444; }

/* ── TOOLBAR ────────────────────────────────────────────────────── */
.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.search-box { display: flex; align-items: center; gap: 8px; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; padding: 7px 12px; min-width: 200px; flex: 1; max-width: 300px; transition: border 0.15s; }
.search-box:focus-within { border-color: var(--dvc-text-secondary); }
.search-box input { background: transparent; border: none; outline: none; color: var(--dvc-text); font-size: 13px; font-family: inherit; width: 100%; }
.search-box input::placeholder { color: var(--dvc-text-muted); }
.filter-select { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; padding: 7px 10px; color: var(--dvc-text-strong); font-size: 13px; font-family: inherit; cursor: pointer; outline: none; }
.result-count { font-size: 12px; color: var(--dvc-text-muted); margin-left: auto; }
.date-sep { color: var(--dvc-text-muted); font-size: 12px; }

/* ── TABLE ──────────────────────────────────────────────────────── */
.table-wrap { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 12px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--dvc-text-muted); letter-spacing: 0.5px; border-bottom: 1px solid var(--dvc-bg-subtle); background: var(--dvc-bg-subtle2); white-space: nowrap; text-transform: uppercase; }
.sortable { cursor: pointer; user-select: none; }
.sortable:hover { color: var(--dvc-text-strong); }
.sort-icon { font-size: 10px; }
tbody tr { border-bottom: 1px solid var(--dvc-bg-subtle); transition: background 0.12s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: var(--dvc-bg-subtle2); }
tbody td { padding: 10px 14px; font-size: 13px; vertical-align: middle; }
.code-text { font-size: 12px; color: var(--dvc-text-secondary); font-family: "Courier New", monospace; background: var(--dvc-bg-subtle); padding: 2px 7px; border-radius: 4px; }
.sp-name { font-weight: 500; color: var(--dvc-text); }
.bt-subname { font-size: 11.5px; color: var(--dvc-text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; }
.price-cell { font-weight: 600; color: #d97706; }
.addr-cell { color: var(--dvc-text-secondary); max-width: 220px; }

/* ── THUMBNAIL ──────────────────────────────────────────────────── */
.thumb-wrap { position: relative; width: 42px; height: 42px; cursor: pointer; flex-shrink: 0; }
.thumb-img { width: 42px; height: 42px; object-fit: cover; border-radius: 8px; border: 1px solid var(--dvc-border); display: block; transition: opacity 0.15s; }
.thumb-img:hover { opacity: 0.82; }
.thumb-placeholder { width: 42px; height: 42px; border-radius: 8px; border: 1.5px dashed var(--dvc-border-strong); background: var(--dvc-bg-subtle2); display: flex; align-items: center; justify-content: center; color: var(--dvc-border-strong); }

/* ── BADGES ─────────────────────────────────────────────────────── */
.brand-badge { display: inline-flex; align-items: center; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; background: var(--dvc-bg-subtle); color: var(--dvc-text-strong); }
.bt-count-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 20px; font-size: 11px; font-weight: 500; background: #f0f9ff; color: #0369a1; }
.stock-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
.stock-ok { background: #f0fdf4; color: #15803d; }
.stock-low { background: #fffbeb; color: #b45309; }
.stock-zero { background: #fef2f2; color: #dc2626; }
.stock-unknown { background: var(--dvc-bg-subtle2); color: var(--dvc-text-muted); }

/* ── STATUS ─────────────────────────────────────────────────────── */
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.status-pill.active { background: #f0fdf4; color: #15803d; }
.status-pill.inactive { background: var(--dvc-bg-subtle2); color: var(--dvc-text-muted); }
.status-pill.pending { background: #fffbeb; color: #b45309; }
.status-pill.cancelled { background: #fef2f2; color: #dc2626; }
.status-pill.clickable { cursor: pointer; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

/* ── ACTIONS ────────────────────────────────────────────────────── */
.actions { display: flex; gap: 4px; align-items: center; }
.icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--dvc-text-muted); transition: all 0.12s; }
.icon-btn:hover { background: var(--dvc-bg-subtle2); color: var(--dvc-text-strong); border-color: var(--dvc-border-strong); }
.icon-btn.view:hover { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }
.icon-btn.edit:hover { color: #d97706; border-color: #fde68a; background: #fffbeb; }
.icon-btn.del:hover { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
.icon-btn.approve:hover { color: #16a34a; border-color: #bbf7d0; background: #f0fdf4; }
.icon-btn.cancel:hover { color: #ea580c; border-color: #fed7aa; background: #fff7ed; }
.icon-btn-xs { width: 24px; height: 24px; }

/* ── EMPTY ──────────────────────────────────────────────────────── */
.empty-state { text-align: center; padding: 40px; }
.empty-icon { font-size: 36px; margin-bottom: 8px; }
.empty-text { color: var(--dvc-text-muted); font-size: 14px; }

/* ── REFRESH BUTTON ─────────────────────────────────────────────── */
.btn-refresh { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--dvc-text-secondary); transition: all 0.15s; flex-shrink: 0; }
.btn-refresh:hover { background: var(--dvc-bg-subtle2); color: var(--dvc-text); border-color: var(--dvc-border-strong); }
.btn-refresh.spinning { color: var(--dvc-text); pointer-events: none; }
.btn-refresh.spinning svg { animation: refresh-spin 0.7s linear infinite; }
@keyframes refresh-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

/* ── PAGINATION ─────────────────────────────────────────────────── */
.pager-wrap { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid var(--dvc-bg-subtle); font-size: 12px; color: var(--dvc-text-muted); }
.pager-btns { display: flex; gap: 4px; }
.page-btn { min-width: 28px; height: 28px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); font-size: 12px; cursor: pointer; color: var(--dvc-text-secondary); transition: all 0.12s; }
.page-btn:disabled { opacity: 0.4; cursor: default; }
.page-btn:hover:not(:disabled):not(.cur) { border-color: var(--dvc-border-strong); background: var(--dvc-bg-subtle2); }
.page-btn.cur { background: var(--dvc-accent); color: #fff; border-color: var(--dvc-accent); }

/* ── EXPAND / NESTED ────────────────────────────────────────────── */
.expand-btn { background: none; border: none; cursor: pointer; color: var(--dvc-text-muted); padding: 2px 4px; margin-right: 6px; display: inline-flex; align-items: center; transition: color 0.15s; vertical-align: middle; }
.expand-btn:hover { color: var(--dvc-text); }
.expand-icon { transition: transform 0.2s; }
.expand-icon.open { transform: rotate(180deg); }
.sp-main-row.row-expanded { background: var(--dvc-bg-subtle); }
.sp-detail-row { background: var(--dvc-bg-subtle2); }
.sp-detail-row td { padding: 0 !important; }
.nested-panel { padding: 14px 18px; border-top: 1px solid var(--dvc-border); background: var(--dvc-bg-subtle2); }
.nested-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.nested-title { font-size: 13px; font-weight: 600; color: var(--dvc-text-strong); margin: 0; }
.nested-count { background: var(--dvc-border); font-size: 11px; padding: 1px 8px; border-radius: 10px; margin-left: 6px; font-weight: 500; }
.nested-empty { font-size: 12px; color: var(--dvc-text-muted); text-align: center; padding: 16px; }

/* ── BT TABLE ───────────────────────────────────────────────────── */
.bt-table-wrap { overflow: hidden; border: 1px solid var(--dvc-border); border-radius: 8px; }
.bt-table { width: 100%; border-collapse: collapse; }
.bt-table thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 600; color: var(--dvc-text-muted); letter-spacing: 0.4px; border-bottom: 1px solid var(--dvc-bg-subtle); background: var(--dvc-bg-subtle2); text-transform: uppercase; }
.bt-table tbody tr { border-bottom: 1px solid var(--dvc-bg-subtle); transition: background 0.1s; }
.bt-table tbody tr:last-child { border-bottom: none; }
.bt-table tbody tr:hover { background: var(--dvc-bg-subtle2); }
.bt-table tbody td { padding: 8px 12px; font-size: 12px; vertical-align: middle; }
.bt-name { font-weight: 500; color: var(--dvc-text-strong); }

/* ── TOTAL LINE ─────────────────────────────────────────────────── */
.total-line { text-align: right; font-size: 13.5px; font-weight: 600; color: var(--dvc-text-strong); margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--dvc-bg-subtle); }

/* ── MODAL ──────────────────────────────────────────────────────── */
.modal-overlay {
  /* Teleport đưa modal ra ngoài .kho-manager nên không thừa hưởng được biến màu từ đó -> khai báo lại tại đây */
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
  font-family: "Jost", "Inter", sans-serif;
  position: fixed; inset: 0; background: rgba(0,0,0,0.45); z-index: 9000; display: flex; align-items: center; justify-content: center; padding: 20px;
}
.modal-overlay.dark-mode {
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
.modal { position: relative; top: auto; left: auto; margin: 0; background: var(--dvc-card-bg); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.2); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; width: 460px; max-width: 95vw; }
.modal-wide { width: 660px; max-width: 95vw; }
.modal-header { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px 14px; border-bottom: 1px solid var(--dvc-bg-subtle); }
.modal-title { font-size: 15px; font-weight: 700; color: var(--dvc-text); margin: 0; }
.modal-close { width: 28px; height: 28px; border: 1px solid var(--dvc-border); border-radius: 6px; background: var(--dvc-card-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--dvc-text-muted); }
.modal-close:hover { background: var(--dvc-bg-subtle2); color: var(--dvc-text-strong); }
.modal-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
.modal-footer { padding: 14px 22px; border-top: 1px solid var(--dvc-bg-subtle); display: flex; justify-content: flex-end; gap: 8px; }

/* ── FORM ───────────────────────────────────────────────────────── */
.form-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
.form-group { display: flex; flex-direction: column; gap: 5px; margin-bottom: 14px; }
.form-label { font-size: 12px; font-weight: 600; color: var(--dvc-text-strong); }
.form-input { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--dvc-text); font-family: inherit; outline: none; transition: border 0.15s; }
.form-input:focus { border-color: var(--dvc-text-secondary); box-shadow: 0 0 0 3px rgba(107,114,128,0.07); }
.form-input-sm { padding: 5px 8px; font-size: 12px; width: 100%; }
.input-error { border-color: #f87171 !important; }
.field-error { font-size: 11px; color: #dc2626; margin: 2px 0 0; }
textarea.form-input { resize: vertical; font-family: inherit; }

/* ── BIẾN THỂ SEARCH/SUGGEST ────────────────────────────────────── */
.bt-search-wrap { position: relative; }
.bt-suggest-list { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); max-height: 240px; overflow-y: auto; z-index: 20; }
.bt-suggest-item { display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; transition: background 0.1s; }
.bt-suggest-item:hover { background: var(--dvc-bg-subtle2); }
.bt-suggest-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 6px; border: 1px solid var(--dvc-border); flex-shrink: 0; }
.bt-suggest-thumb.placeholder { background: var(--dvc-bg-subtle); }
.bt-suggest-info { flex: 1; min-width: 0; }
.bt-suggest-name { font-size: 12.5px; color: var(--dvc-text); font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bt-suggest-meta { font-size: 11px; color: var(--dvc-text-muted); margin-top: 1px; }

/* ── DETAIL VIEW ────────────────────────────────────────────────── */
.detail-info-col { display: flex; flex-direction: column; gap: 10px; }
.detail-row { display: flex; align-items: center; gap: 10px; }
.detail-label { font-size: 12px; font-weight: 600; color: var(--dvc-text-muted); min-width: 110px; }
.detail-val { font-size: 13px; color: var(--dvc-text); }

/* ── LIGHTBOX ───────────────────────────────────────────────────── */
.lb-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.lb-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; object-fit: contain; }
.lb-close { position: absolute; top: 16px; right: 20px; background: rgba(255,255,255,0.15); color: #fff; border: none; font-size: 20px; cursor: pointer; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

/* ── TOAST ──────────────────────────────────────────────────────── */
.toast { position: fixed; bottom: 24px; right: 24px; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--dvc-text); display: flex; align-items: center; gap: 9px; z-index: 1000; transform: translateY(20px); opacity: 0; transition: all 0.25s; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-width: 320px; }
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: #bbf7d0; }
.toast.error { border-color: #fecaca; }

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .form-row-2 { grid-template-columns: 1fr; }
  .header-bar { flex-direction: column; align-items: flex-start; }
  .result-count { margin-left: 0; }
  .modal-wide { width: 95vw; }
}
@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
}

/* ── THỐNG KÊ NHẬP KHO THEO THÁNG ──────────────────────────────── */
.thongke-chart { display: flex; align-items: flex-end; gap: 8px; height: 200px; padding: 8px 4px 0; }
.thongke-col { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
.thongke-bar-wrap { flex: 1; width: 100%; display: flex; align-items: flex-end; justify-content: center; }
.thongke-bar { width: 60%; min-height: 2px; background: var(--dvc-accent); border-radius: 4px 4px 0 0; transition: height 0.3s ease; }
.thongke-label { font-size: 11px; color: var(--dvc-text-secondary); margin-top: 6px; font-weight: 600; }
.thongke-sub { font-size: 10px; color: var(--dvc-text-muted); }
</style>