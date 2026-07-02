<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";

const API = import.meta.env.VITE_API_URL;

function base64ToFile(base64, filename) {
  const arr = base64.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

function toAbsUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API}${path}`;
}

// ══ TIÊU ĐỀ VALIDATION ════════════════════════════════════════════
const tdErrors = reactive({});
function clearTdErrors(id) {
  delete tdErrors[id];
}
function setTdError(id, field, msg) {
  if (!tdErrors[id]) tdErrors[id] = {};
  tdErrors[id][field] = msg;
}
function getTdError(id, field) {
  return tdErrors[id]?.[field] || "";
}

function validateTieuDe(formObj) {
  clearTdErrors("_tdform");
  let ok = true;
  const id = "_tdform";

  if (!formObj.tenTieuDe?.trim()) {
    setTdError(id, "tenTieuDe", "Tên tiêu đề không được để trống.");
    ok = false;
  } else if (formObj.tenTieuDe.trim().length < 2) {
    setTdError(id, "tenTieuDe", "Tên tiêu đề tối thiểu 2 ký tự.");
    ok = false;
  } else if (formObj.tenTieuDe.trim().length > 200) {
    setTdError(id, "tenTieuDe", "Tên tiêu đề tối đa 200 ký tự.");
    ok = false;
  }

  if (formObj.moTaTieuDe && formObj.moTaTieuDe.trim().length > 500) {
    setTdError(id, "moTaTieuDe", "Mô tả tiêu đề tối đa 500 ký tự.");
    ok = false;
  }

  const stt = Number(formObj.soThuTu);
  if (formObj.soThuTu !== "" && formObj.soThuTu != null) {
    if (isNaN(stt) || stt < 0) {
      setTdError(id, "soThuTu", "STT phải là số không âm.");
      ok = false;
    } else if (stt > 9999) {
      setTdError(id, "soThuTu", "STT tối đa 9999.");
      ok = false;
    }
  }

  return ok;
}

// ══ CHI TIẾT VALIDATION ═══════════════════════════════════════════
const ctErrors = reactive({});
function clearCtErrors(id) {
  delete ctErrors[id];
}
function setCtError(id, field, msg) {
  if (!ctErrors[id]) ctErrors[id] = {};
  ctErrors[id][field] = msg;
}
function getCtError(id, field) {
  return ctErrors[id]?.[field] || "";
}

function validateChiTiet(formObj) {
  clearCtErrors("_ctform");
  let ok = true;
  const id = "_ctform";

  if (!formObj.ctTenTieuDe?.trim()) {
    setCtError(id, "ctTenTieuDe", "Tên chi tiết không được để trống.");
    ok = false;
  } else if (formObj.ctTenTieuDe.trim().length < 2) {
    setCtError(id, "ctTenTieuDe", "Tên chi tiết tối thiểu 2 ký tự.");
    ok = false;
  } else if (formObj.ctTenTieuDe.trim().length > 200) {
    setCtError(id, "ctTenTieuDe", "Tên chi tiết tối đa 200 ký tự.");
    ok = false;
  }

  if (formObj.ctMoTaTieuDe && formObj.ctMoTaTieuDe.trim().length > 500) {
    setCtError(id, "ctMoTaTieuDe", "Mô tả chi tiết tối đa 500 ký tự.");
    ok = false;
  }

  if (!formObj.ctFile) {
    setCtError(id, "ctFile", "Ảnh chi tiết là bắt buộc.");
    ok = false;
  }

  const stt = Number(formObj.ctSoThuTu);
  if (formObj.ctSoThuTu !== "" && formObj.ctSoThuTu != null) {
    if (isNaN(stt) || stt < 0) {
      setCtError(id, "ctSoThuTu", "STT phải là số không âm.");
      ok = false;
    } else if (stt > 9999) {
      setCtError(id, "ctSoThuTu", "STT tối đa 9999.");
      ok = false;
    }
  }

  return ok;
}

// ── DANH MỤC ──────────────────────────────────────────────────────
const danhMucs = ref([]);
async function loadDanhMuc() {
  const res = await axios.get(`${API}/api/DichVu/danhmuc`);
  danhMucs.value = res.data.map((d) => ({
    maDM: d.maDm,
    tenDanhMuc: d.tenDanhMuc,
  }));
}

// ── DATA ──────────────────────────────────────────────────────────
const dichvus = ref([]);
const combos = ref([]);
const tieudes = ref([]); // tiêu đề dịch vụ theo MaDv
const expandedServices = ref({}); // MaDv -> boolean
const expandedTitles = ref({}); // maTD -> boolean mở chi tiết
const tdSaving = ref(false);
const ctImgInput = ref(null);

async function loadDichVu() {
  try {
    const res = await axios.get(`${API}/api/DichVu`, {
      params: {
        keyword: search.value || null,
        maDm: filterCat.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    dichvus.value = res.data.map((d) => ({
      maDV: d.maDv,
      tenDV: d.tenDv,
      maDM: d.maDm,
      gia: d.gia,
      thoiGianLam: d.thoiGianLam,
      moTa: d.moTa,
      trangThai: d.trangThai,
      hinhanhs: d.hinhAnhs?.map((h) => toAbsUrl(h.duongDan)) || [],
    }));
  } catch (err) {
    console.error(err);
    showToast("Lỗi tải danh sách dịch vụ!", "error");
  }
}

async function loadCombos() {
  try {
    const res = await axios.get(`${API}/api/Combo`, {
      params: {
        keyword: search.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    combos.value = res.data.map((c) => ({
      maCB: c.maCB,
      tenCombo: c.tenCombo,
      gia: c.gia,
      giaGoc: c.giaGoc,
      moTa: c.moTa,
      trangThai: c.trangThai,
      hinhAnh: toAbsUrl(c.hinhAnh),
      dichvus: c.dichvus || [],
      icon: "🎁",
      mauNen: "135deg,#f8fafc,#f1f5f9",
    }));
  } catch (err) {
    console.error(err);
    showToast("Lỗi tải danh sách combo!", "error");
  }
}

// ── STATE ──────────────────────────────────────────────────────────
const curTab = ref("dv");
const search = ref("");
const filterCat = ref("");
const filterStatus = ref("");
const curPage = ref(1);
const sortField = ref(null);
const sortDir = ref(1);
const editingId = ref(null);
const dvImgInput = ref(null);
const cbImgInput = ref(null);
const saving = ref(false);
const deletedImages = ref([]);

const tabs = [
  { key: "dv", label: "Dịch vụ", icon: "✂️" },
  { key: "combo", label: "Combo", icon: "🎁" },
];

const modal = reactive({ open: false, mode: "", title: "", data: null });
const form = reactive({
  maDV: "",
  maCB: "",
  tenDV: "",
  tenCombo: "",
  maDM: "",
  gia: "",
  giaGoc: "",
  thoiGianLam: "",
  moTa: "",
  trangThai: 1,
  hinhanhs: [],
  hinhAnh: "",
  dichvus: [],
});

// ── VALIDATION ────────────────────────────────────────────────────
const errors = reactive({
  maDV: "",
  tenDV: "",
  maDM: "",
  gia: "",
  thoiGianLam: "",
  moTa: "",
  maCB: "",
  tenCombo: "",
  giaCombo: "",
  giaGoc: "",
  dichvus: "",
  hinhAnh: "",
});

function clearErrors() {
  Object.keys(errors).forEach((k) => (errors[k] = ""));
}

function validateDV() {
  clearErrors();
  let ok = true;

  // maDV
  if (!editingId.value) {
    if (!form.maDV.trim()) {
      errors.maDV = "Mã dịch vụ không được để trống.";
      ok = false;
    } else if (!/^[A-Za-z0-9]{2,10}$/.test(form.maDV.trim())) {
      errors.maDV = "Mã dịch vụ chỉ gồm chữ và số, 2–10 ký tự.";
      ok = false;
    } else if (dichvus.value.find((x) => x.maDV === form.maDV.trim())) {
      errors.maDV = "Mã dịch vụ này đã tồn tại.";
      ok = false;
    }
  }

  // tenDV
  if (!form.tenDV.trim()) {
    errors.tenDV = "Tên dịch vụ không được để trống.";
    ok = false;
  } else if (form.tenDV.trim().length < 2) {
    errors.tenDV = "Tên dịch vụ tối thiểu 2 ký tự.";
    ok = false;
  } else if (form.tenDV.trim().length > 100) {
    errors.tenDV = "Tên dịch vụ tối đa 100 ký tự.";
    ok = false;
  }

  // maDM
  if (!form.maDM) {
    errors.maDM = "Vui lòng chọn danh mục.";
    ok = false;
  }

  // gia
  const gia = Number(form.gia);
  if (form.gia === "" || isNaN(gia)) {
    errors.gia = "Giá không được để trống.";
    ok = false;
  } else if (gia <= 0) {
    errors.gia = "Giá phải lớn hơn 0.";
    ok = false;
  } else if (gia > 100_000_000) {
    errors.gia = "Giá tối đa 100.000.000₫.";
    ok = false;
  }

  // thoiGianLam
  const tgl = Number(form.thoiGianLam);
  if (form.thoiGianLam === "" || isNaN(tgl)) {
    errors.thoiGianLam = "Thời gian không được để trống.";
    ok = false;
  } else if (!Number.isInteger(tgl) || tgl < 1) {
    errors.thoiGianLam = "Thời gian phải là số nguyên ≥ 1 phút.";
    ok = false;
  } else if (tgl > 480) {
    errors.thoiGianLam = "Thời gian tối đa 480 phút (8 giờ).";
    ok = false;
  }

  // moTa
  if (form.moTa && form.moTa.length > 500) {
    errors.moTa = "Mô tả tối đa 500 ký tự.";
    ok = false;
  }

  return ok;
}

function validateCombo() {
  clearErrors();
  let ok = true;

  // maCB
  if (!editingId.value) {
    if (!form.maCB.trim()) {
      errors.maCB = "Mã combo không được để trống.";
      ok = false;
    } else if (!/^[A-Za-z0-9]{2,10}$/.test(form.maCB.trim())) {
      errors.maCB = "Mã combo chỉ gồm chữ và số, 2–10 ký tự.";
      ok = false;
    } else if (combos.value.find((x) => x.maCB === form.maCB.trim())) {
      errors.maCB = "Mã combo này đã tồn tại.";
      ok = false;
    }
  }

  // tenCombo
  if (!form.tenCombo.trim()) {
    errors.tenCombo = "Tên combo không được để trống.";
    ok = false;
  } else if (form.tenCombo.trim().length < 2) {
    errors.tenCombo = "Tên combo tối thiểu 2 ký tự.";
    ok = false;
  } else if (form.tenCombo.trim().length > 100) {
    errors.tenCombo = "Tên combo tối đa 100 ký tự.";
    ok = false;
  }

  // gia
  const gia = Number(form.gia);
  if (form.gia === "" || isNaN(gia)) {
    errors.giaCombo = "Giá combo không được để trống.";
    ok = false;
  } else if (gia <= 0) {
    errors.giaCombo = "Giá combo phải lớn hơn 0.";
    ok = false;
  } else if (gia > 100_000_000) {
    errors.giaCombo = "Giá combo tối đa 100.000.000₫.";
    ok = false;
  }

  // giaGoc tự tính từ tổng dịch vụ — không cần validate

  // hinhAnh bắt buộc
  if (!form.hinhAnh) {
    errors.hinhAnh = "Ảnh bìa combo là bắt buộc.";
    ok = false;
  }

  // dichvus
  if (!form.dichvus.length) {
    errors.dichvus = "Vui lòng chọn ít nhất 1 dịch vụ cho combo.";
    ok = false;
  }

  // moTa
  if (form.moTa && form.moTa.length > 500) {
    errors.moTa = "Mô tả tối đa 500 ký tự.";
    ok = false;
  }

  return ok;
}

// ── COMPUTED ───────────────────────────────────────────────────────
const toast = reactive({ show: false, msg: "", type: "success", icon: "✅" });
const lightbox = reactive({ open: false, imgs: [], idx: 0 });
const perPage = ref(10);

const avgPrice = computed(() => {
  if (!dichvus.value.length) return 0;
  return Math.round(
    dichvus.value.reduce((a, b) => a + b.gia, 0) / dichvus.value.length,
  );
});
const totalSavings = computed(() =>
  combos.value
    .filter((c) => c.trangThai)
    .reduce((a, c) => a + (c.giaGoc - c.gia), 0),
);

const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (curTab.value === "dv") {
    let arr = dichvus.value.filter((d) => {
      const mq =
        !q ||
        d.tenDV.toLowerCase().includes(q) ||
        d.maDV.toLowerCase().includes(q);
      const mc = !filterCat.value || d.maDM === filterCat.value;
      const ms =
        filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
      return mq && mc && ms;
    });
    if (sortField.value)
      arr = [...arr].sort((a, b) =>
        a[sortField.value] > b[sortField.value]
          ? sortDir.value
          : -sortDir.value,
      );
    return arr;
  }
  return combos.value.filter((c) => {
    const mq =
      !q ||
      c.tenCombo.toLowerCase().includes(q) ||
      c.maCB.toLowerCase().includes(q);
    const ms =
      filterStatus.value === "" || String(c.trangThai) === filterStatus.value;
    return mq && ms;
  });
});

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / perPage.value),
);
const pageData = computed(() => {
  const s = (curPage.value - 1) * perPage.value;
  return filteredData.value.slice(s, s + perPage.value);
});
const pageRange = computed(() => {
  const t = totalPages.value,
    c = curPage.value;
  const lo = Math.max(1, c - 2),
    hi = Math.min(t, lo + 4);
  return Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
});

// ── HELPERS ────────────────────────────────────────────────────────
const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n) + "₫";
const fmtMin = (m) =>
  m >= 60 ? Math.floor(m / 60) + "g" + (m % 60 ? (m % 60) + "p" : "") : m + "p";
const getDMName = (id) =>
  danhMucs.value.find((x) => x.maDM === id)?.tenDanhMuc ?? "---";
const getDV = (id) => dichvus.value.find((x) => x.maDV === id);
const getDVName = (id) => getDV(id)?.tenDV ?? id;
const dvInCombos = (id) => combos.value.filter((c) => c.dichvus.includes(id));
const discountPct = (c) =>
  c.giaGoc > 0 ? Math.round((1 - c.gia / c.giaGoc) * 100) : 0;

// Dynamic cat class by index in danhMucs list
function getCatClass(maDM) {
  const classes = ["cat-1", "cat-2", "cat-3", "cat-4", "cat-5"];
  const idx = danhMucs.value.findIndex((x) => x.maDM === maDM);
  return classes[idx % classes.length] ?? "cat-1";
}

function sortIcon(f) {
  return sortField.value !== f ? "↕" : sortDir.value === 1 ? "↑" : "↓";
}
function setSort(f) {
  sortField.value === f
    ? (sortDir.value *= -1)
    : ((sortField.value = f), (sortDir.value = 1));
  curPage.value = 1;
}

// ── LIGHTBOX ───────────────────────────────────────────────────────
function openLightbox(imgs, idx) {
  lightbox.imgs = imgs;
  lightbox.idx = idx;
  lightbox.open = true;
}
function lbPrev() {
  lightbox.idx =
    (lightbox.idx - 1 + lightbox.imgs.length) % lightbox.imgs.length;
}
function lbNext() {
  lightbox.idx = (lightbox.idx + 1) % lightbox.imgs.length;
}

// ── IMAGE HANDLING ─────────────────────────────────────────────────
function readFiles(files, cb) {
  Array.from(files).forEach((file) => {
    if (!file.type.startsWith("image/")) {
      showToast(`${file.name} không phải ảnh.`, "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast(`${file.name} vượt quá 5MB.`, "error");
      return;
    }
    const r = new FileReader();
    r.onload = (e) => cb(e.target.result);
    r.readAsDataURL(file);
  });
}
function onDVImgChange(e) {
  readFiles(e.target.files, (src) => {
    if (form.hinhanhs.length >= 10) {
      showToast("Tối đa 10 ảnh.", "error");
      return;
    }
    form.hinhanhs.push(src);
  });
  e.target.value = "";
}
function onDropDV(e) {
  readFiles(e.dataTransfer.files, (src) => {
    if (form.hinhanhs.length < 10) form.hinhanhs.push(src);
  });
}
function removeDVImg(i) {
  const img = form.hinhanhs[i];
  if (img.startsWith("http")) deletedImages.value.push(img);
  form.hinhanhs.splice(i, 1);
}
function moveDVImg(i, dir) {
  const a = form.hinhanhs,
    ni = i + dir;
  if (ni < 0 || ni >= a.length) return;
  [a[i], a[ni]] = [a[ni], a[i]];
}
function onCBImgChange(e) {
  readFiles(e.target.files, (src) => {
    form.hinhAnh = src;
  });
  e.target.value = "";
}
function onDropCB(e) {
  readFiles(e.dataTransfer.files, (src) => {
    form.hinhAnh = src;
  });
}

// ── TAB ────────────────────────────────────────────────────────────
function switchTab(tab) {
  curTab.value = tab;
  curPage.value = 1;
  search.value = "";
  filterCat.value = "";
  filterStatus.value = "";
  sortField.value = null;
}

// ── FILTER ─────────────────────────────────────────────────────────
function onFilterChange() {
  curPage.value = 1;
  if (curTab.value === "dv") loadDichVu();
  else loadCombos();
}

// ═══════════════════════════════════════════════════════
// TIÊU ĐỀ + CHI TIẾT CRUD
// ═══════════════════════════════════════════════════════

function isExpanded(maDv) {
  return !!expandedServices.value[maDv];
}

function toggleExpand(maDv) {
  if (expandedServices.value[maDv]) {
    delete expandedServices.value[maDv];
  } else {
    expandedServices.value[maDv] = true;
    loadTieudeDichVu(maDv);
  }
}

function isTitleExpanded(maTd) {
  return !!expandedTitles.value[maTd];
}

function toggleTitleExpand(maTd) {
  expandedTitles.value[maTd] = !expandedTitles.value[maTd];
}

function normalizeMaDv(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function sameMaDv(a, b) {
  return normalizeMaDv(a) === normalizeMaDv(b);
}

function startNewTieuDe(maDv) {
  if (tieudes.value.find((t) => sameMaDv(t._newFor, maDv))) return;
  tieudes.value.push({
    maTD: "",
    maDv,
    tenTieuDe: "",
    moTaTieuDe: "",
    soThuTu: "",
    trangThai: 1,
    chiTiet: [],
    _newFor: maDv,
    _editing: true,
    editForm: null,
  });
  clearTdErrors("_tdform");
}

function cancelTieuDeEdit(td) {
  clearTdErrors("_tdform");
  if (td.maTd) {
    td.tenTieuDe = td._snapshot?.tenTieuDe ?? td.tenTieuDe;
    td.moTaTieuDe = td._snapshot?.moTaTieuDe ?? td.moTaTieuDe;
    td.soThuTu = td._snapshot?.soThuTu ?? td.soThuTu;
    td.trangThai = td._snapshot?.trangThai ?? td.trangThai;
    td._editing = false;
    return;
  }
  const idx = tieudes.value.indexOf(td);
  if (idx >= 0) tieudes.value.splice(idx, 1);
}

async function loadTieudeDichVu(maDv) {
  try {
    const res = await axios.get(`${API}/api/TieudeDichvu/bydv/${maDv}`);
    tieudes.value = res.data.map((t) => ({
      ...t,
      chiTiet: t.chiTiet.map((ct) => ({
        ...ct,
        hinhAnh: toAbsUrl(ct.hinhAnh),
      })),
    }));
  } catch (err) {
    console.error("Lỗi tải tiêu đề dịch vụ:", err);
    showToast("Lỗi tải tiêu đề dịch vụ!", "error");
  }
}

// Tiêu đề
async function saveTieuDe(dvMaDv, formObj) {
  if (tdSaving.value) return;
  if (!validateTieuDe(formObj)) {
    showToast("Vui lòng kiểm tra lại thông tin tiêu đề!", "error");
    return;
  }
  tdSaving.value = true;
  try {
    const tenTieuDe = formObj.tenTieuDe.trim();
    const moTaTieuDe = formObj.moTaTieuDe?.trim() || "";
    const beforeCount = tieudes.value.filter(
      (t) => sameMaDv(t.maDv, dvMaDv) && !t._newFor,
    ).length;

    const res = await axios.post(`${API}/api/TieudeDichvu/tieude`, {
      // Gửi cả camelCase và PascalCase để tương thích nhiều kiểu backend binding.
      maDv: dvMaDv,
      tenTieuDe,
      moTaTieuDe,
      soThuTu: Number(formObj.soThuTu) || 0,
      trangThai: Number(formObj.trangThai) ?? 1,
      MaDv: dvMaDv,
      TenTieuDe: tenTieuDe,
      MoTaTieuDe: moTaTieuDe,
      SoThuTu: Number(formObj.soThuTu) || 0,
      TrangThai: Number(formObj.trangThai) ?? 1,
    });

    await loadTieudeDichVu(dvMaDv);

    const afterList = tieudes.value.filter(
      (t) => sameMaDv(t.maDv, dvMaDv) && !t._newFor,
    );
    const inserted = afterList.length > beforeCount ||
      afterList.some(
        (t) =>
          (t.tenTieuDe || "").trim() === tenTieuDe &&
          (t.moTaTieuDe || "").trim() === moTaTieuDe,
      );

    if (!inserted) {
      const apiMsg =
        res?.data?.message || res?.data?.msg || res?.data?.error || "";
      showToast(
        apiMsg || "API chưa lưu tiêu đề vào cơ sở dữ liệu. Vui lòng kiểm tra backend.",
        "error",
      );
      return;
    }

    showToast("Thêm tiêu đề thành công!");
    formObj.tenTieuDe = "";
    formObj.moTaTieuDe = "";
    formObj.soThuTu = "";
    formObj.trangThai = 1;
  } catch (err) {
    console.error("Lỗi:", err);
    showToast("Lỗi khi thêm tiêu đề!", "error");
  } finally {
    tdSaving.value = false;
  }
}

async function editTieuDe(maTd, dvMaDv, formObj) {
  if (!validateTieuDe(formObj)) {
    showToast("Vui lòng kiểm tra lại thông tin tiêu đề!", "error");
    return;
  }
  tdSaving.value = true;
  try {
    await axios.put(`${API}/api/TieudeDichvu/tieude/${maTd}`, {
      TenTieuDe: formObj.tenTieuDe?.trim(),
      MoTaTieuDe: formObj.moTaTieuDe?.trim(),
      SoThuTu: Number(formObj.soThuTu),
      TrangThai: Number(formObj.trangThai),
    });
    showToast("Sửa tiêu đề thành công!");
    formObj.editing = null;
    await loadTieudeDichVu(dvMaDv);
  } catch (err) {
    showToast("Lỗi khi sửa tiêu đề!", "error");
  } finally {
    tdSaving.value = false;
  }
}

async function deleteTieuDe(maTd, dvMaDv) {
  if (!confirm("Xóa tiêu đề này (kèm tất cả chi tiết)?")) return;
  try {
    await axios.delete(`${API}/api/TieudeDichvu/tieude/${maTd}`);
    showToast("Đã xóa tiêu đề!");
    await loadTieudeDichVu(dvMaDv);
  } catch (err) {
    showToast("Lỗi khi xóa tiêu đề!", "error");
  }
}

// Chi tiết
function readChiTietImage(file, cb) {
  if (!file.type.startsWith("image/")) {
    showToast("Không phải file ảnh!", "error");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast("Ảnh vượt quá 5MB!", "error");
    return;
  }
  const r = new FileReader();
  r.onload = (e) => cb(e.target.result);
  r.readAsDataURL(file);
}

async function saveChiTiet(tdMaTd, tdMaDv, formObj) {
  if (tdSaving.value) return;
  if (!validateChiTiet(formObj)) {
    showToast("Vui lòng kiểm tra lại thông tin chi tiết!", "error");
    return;
  }
  tdSaving.value = true;
  try {
    const fd = new FormData();
    fd.append("MaTd", tdMaTd);
    fd.append("MaDv", tdMaDv);
    fd.append("TenTieuDe", formObj.ctTenTieuDe.trim());
    fd.append("MoTaTieuDe", formObj.ctMoTaTieuDe || "");
    fd.append("SoThuTu", Number(formObj.ctSoThuTu) || 0);
    if (formObj.ctFile) {
      fd.append("File", formObj.ctFile);
    }

    await axios.post(`${API}/api/TieudeDichvu/chitiet`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    showToast("Thêm chi tiết thành công!");
    formObj.ctTenTieuDe = "";
    formObj.ctMoTaTieuDe = "";
    formObj.ctSoThuTu = "";
    formObj.ctImg = null;
    formObj.ctFile = null;
    await loadTieudeDichVu(tdMaDv);
  } catch (err) {
    console.error("Lỗi:", err);
    showToast("Lỗi khi thêm chi tiết!", "error");
  } finally {
    tdSaving.value = false;
  }
}
async function addChiTiet(td) {
  const fd = {
    ctTenTieuDe: td._ctTen,
    ctMoTaTieuDe: td._ctDesc,
    ctSoThuTu: td._ctStt,
    ctFile: td._pendingCtFile
  };

  await saveChiTiet(td.maTd, td.maDv, fd);

  // reset form sau khi thêm thành công
  td._ctTen = "";
  td._ctDesc = "";
  td._ctStt = null;
  td._pendingCtFile = null;
}
async function editChiTiet(maCttd, tdMaTd, tdMaDv, ctItem) {
  const formObj = {
  ctTenTieuDe: ctItem.tenTieuDe?.trim() || "",
  ctMoTaTieuDe: ctItem.moTaTieuDe || "",
  ctSoThuTu: ctItem.soThuTu != null ? Number(ctItem.soThuTu) : 0,
  ctFile: ctItem._newFile || ctItem.hinhAnh || null // nếu validate cần
};

if (!validateChiTiet(formObj)) {
  showToast("Vui lòng kiểm tra lại thông tin chi tiết!", "error");
  return;
}

  tdSaving.value = true;
  try {
    const fd = new FormData();
    fd.append("TenTieuDe", formObj.ctTenTieuDe);
    fd.append("MoTaTieuDe", formObj.ctMoTaTieuDe);
    fd.append("SoThuTu", formObj.ctSoThuTu);
    if (ctItem._newFile) fd.append("File", ctItem._newFile);

    await axios.put(`${API}/api/TieudeDichvu/chitiet/${maCttd}`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    showToast("Sửa chi tiết thành công!");
    ctItem._editing = false;
    ctItem._newFile = null;

    await loadTieudeDichVu(tdMaDv);
  } catch (err) {
    console.error(err);
    showToast("Lỗi khi sửa chi tiết!", "error");
  } finally {
    tdSaving.value = false;
  }
}

async function deleteChiTiet(maCttd, tdMaDv) {
  if (!confirm("Xóa chi tiết này?")) return;
  try {
    await axios.delete(`${API}/api/TieudeDichvu/chitiet/${maCttd}`);
    showToast("Đã xóa chi tiết!");
    await loadTieudeDichVu(tdMaDv);
  } catch (err) {
    showToast("Lỗi khi xóa chi tiết!", "error");
  }
}

// ── MODAL ──────────────────────────────────────────────────────────
function openModal() {
  editingId.value = null;
  clearErrors();
  deletedImages.value = [];
  Object.assign(form, {
    maDV: "",
    maCB: "",
    tenDV: "",
    tenCombo: "",
    maDM: danhMucs.value[0]?.maDM ?? "",
    gia: "",
    giaGoc: "",
    thoiGianLam: "",
    moTa: "",
    trangThai: 1,
    hinhanhs: [],
    hinhAnh: "",
    dichvus: [],
  });
  modal.mode = curTab.value === "dv" ? "formDV" : "formCombo";
  modal.title = curTab.value === "dv" ? "Thêm dịch vụ mới" : "Thêm combo mới";
  modal.open = true;
}

function viewDV(d) {
  modal.data = d;
  modal.mode = "viewDV";
  modal.title = "Chi tiết dịch vụ";
  modal.open = true;
}
function viewCombo(c) {
  modal.data = c;
  modal.mode = "viewCombo";
  modal.title = "Chi tiết combo";
  modal.open = true;
}

function editDV(d) {
  editingId.value = d.maDV;
  clearErrors();
  deletedImages.value = [];
  Object.assign(form, { ...d, hinhanhs: [...(d.hinhanhs || [])] });
  modal.mode = "formDV";
  modal.title = "Chỉnh sửa dịch vụ";
  modal.open = true;
}

function editCombo(c) {
  editingId.value = c.maCB;
  clearErrors();
  deletedImages.value = [];
  Object.assign(form, { ...c, maCB: c.maCB, dichvus: [...c.dichvus] });
  modal.mode = "formCombo";
  modal.title = "Chỉnh sửa combo";
  modal.open = true;
}

function closeModal() {
  modal.open = false;
  editingId.value = null;
  clearErrors();
}

// ── SAVE ───────────────────────────────────────────────────────────
async function saveItem() {
  if (saving.value) return;

  // ── Dịch vụ ──
  if (modal.mode === "formDV") {
    if (!validateDV()) return;
    saving.value = true;
    try {
      const fd = new FormData();
      fd.append("MaDv", editingId.value || form.maDV.trim());
      fd.append("MaDm", form.maDM);
      fd.append("TenDv", form.tenDV.trim());
      fd.append("MoTa", form.moTa || "");
      fd.append("Gia", Number(form.gia));
      fd.append("ThoiGianLam", Number(form.thoiGianLam));
      fd.append("TrangThai", Number(form.trangThai));

      form.hinhanhs.forEach((img, i) => {
        if (img.startsWith("data:"))
          fd.append("Files", base64ToFile(img, `image_${i}.png`));
      });
      deletedImages.value.forEach((img) => fd.append("DeletedImages", img));
      if (editingId.value) {
        await axios.put(`${API}/api/DichVu/${editingId.value}`, fd);
        logActivity("Cập nhật dịch vụ", `Đã cập nhật thông tin dịch vụ ${form.tenDV} (Mã: ${editingId.value})`, "Dịch vụ");
        showToast("Cập nhật dịch vụ thành công!");
      } else {
        await axios.post(`${API}/api/DichVu`, fd);
        logActivity("Thêm dịch vụ", `Đã thêm dịch vụ mới ${form.tenDV} (Mã: ${form.maDV})`, "Dịch vụ");
        showToast("Thêm dịch vụ thành công!");
      }
      deletedImages.value = [];
      await loadDichVu();
      closeModal();
    } catch (err) {
      console.error("DichVu save error:", err.response?.data);
      logActivity(
        editingId.value ? "Cập nhật dịch vụ" : "Thêm dịch vụ",
        `Thất bại khi ${editingId.value ? 'cập nhật' : 'thêm'} dịch vụ ${form.tenDV} - Lỗi: ${err.message || ''}`,
        "Dịch vụ",
        "Thất bại"
      );
      showToast("Lỗi khi lưu dịch vụ!", "error");
    } finally {
      saving.value = false;
    }
    return;
  }

  // ── Combo ──
  if (modal.mode === "formCombo") {
    if (!validateCombo()) return;
    saving.value = true;
    try {
      const fd = new FormData();
      fd.append("MaCB", editingId.value || form.maCB.trim());
      fd.append("TenCombo", form.tenCombo.trim());
      fd.append("Gia", Number(form.gia));
      fd.append("MoTa", form.moTa || "");
      fd.append("TrangThai", Number(form.trangThai));
      form.dichvus.forEach((id) => fd.append("DichVus", id));

      if (form.hinhAnh && form.hinhAnh.startsWith("data:")) {
        fd.append("File", base64ToFile(form.hinhAnh, "combo_cover.png"));
      } else if (form.hinhAnh && form.hinhAnh.startsWith("http")) {
        fd.append("HinhAnhCu", form.hinhAnh);
      }

      if (editingId.value) {
        await axios.put(`${API}/api/Combo/${editingId.value}`, fd);
        logActivity("Cập nhật combo", `Đã cập nhật thông tin combo ${form.tenCombo} (Mã: ${editingId.value})`, "Dịch vụ");
        showToast("Cập nhật combo thành công!");
      } else {
        await axios.post(`${API}/api/Combo`, fd);
        logActivity("Thêm combo", `Đã thêm combo mới ${form.tenCombo} (Mã: ${form.maCB})`, "Dịch vụ");
        showToast("Thêm combo thành công!");
      }
      await loadCombos();
      closeModal();
    } catch (err) {
      console.error("Combo save error:", err.response?.data);
      logActivity(
        editingId.value ? "Cập nhật combo" : "Thêm combo",
        `Thất bại khi ${editingId.value ? 'cập nhật' : 'thêm'} combo ${form.tenCombo} - Lỗi: ${err.message || ''}`,
        "Dịch vụ",
        "Thất bại"
      );
      showToast("Lỗi khi lưu combo!", "error");
    } finally {
      saving.value = false;
    }
  }
}

// ── DELETE ─────────────────────────────────────────────────────────
async function delDV(d) {
  if (
    !confirm(
      `Xóa dịch vụ "${d.tenDV}"?\nDịch vụ sẽ bị xóa khỏi tất cả combo liên quan.`,
    )
  )
    return;
  try {
    await axios.delete(`${API}/api/DichVu/${d.maDV}`);
    logActivity("Xóa dịch vụ", `Đã xóa dịch vụ ${d.tenDV} (Mã: ${d.maDV})`, "Dịch vụ");
    showToast(`Đã xóa dịch vụ "${d.tenDV}"`);
    await loadDichVu();
  } catch (err) {
    const msg = err.response?.data || "Lỗi khi xóa dịch vụ!";
    logActivity("Xóa dịch vụ", `Thất bại khi xóa dịch vụ ${d.tenDV} (Mã: ${d.maDV}) - Lỗi: ${err.message || ''}`, "Dịch vụ", "Thất bại");
    showToast(msg, "error");
  }
}

async function delCombo(c) {
  if (!confirm(`Xóa combo "${c.tenCombo}"?`)) return;
  try {
    await axios.delete(`${API}/api/Combo/${c.maCB}`);
    logActivity("Xóa combo", `Đã xóa combo ${c.tenCombo} (Mã: ${c.maCB})`, "Dịch vụ");
    showToast(`Đã xóa combo "${c.tenCombo}"`);
    await loadCombos();
  } catch (err) {
    const msg = err.response?.data || "Lỗi khi xóa dịch vụ!";
    logActivity("Xóa combo", `Thất bại khi xóa combo ${c.tenCombo} (Mã: ${c.maCB}) - Lỗi: ${err.message || ''}`, "Dịch vụ", "Thất bại");
    showToast(msg, "error");
  }
}

function toggleDV(id) {
  const i = form.dichvus.indexOf(id);
  i === -1 ? form.dichvus.push(id) : form.dichvus.splice(i, 1);
  if (errors.dichvus) errors.dichvus = "";
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

// ── EXPORT ─────────────────────────────────────────────────────────
// function exportCSV() {
//   const data = filteredData.value;
//   let csv =
//     curTab.value === "dv"
//       ? "Mã DV,Tên,Danh mục,Giá,Thời gian,Số ảnh,Trạng thái\n"
//       : "Mã CB,Tên,Giá,Giá gốc,Có ảnh,Dịch vụ,Trạng thái\n";
//   data.forEach((d) => {
//     if (curTab.value === "dv")
//       csv += `${d.maDV},"${d.tenDV}","${getDMName(d.maDM)}",${d.gia},${d.thoiGianLam},${d.hinhanhs?.length || 0},${d.trangThai ? "Hoạt động" : "Ngừng"}\n`;
//     else
//       csv += `${d.maCB},"${d.tenCombo}",${d.gia},${d.giaGoc},${d.hinhAnh ? "Có" : "Không"},"${d.dichvus.join("; ")}",${d.trangThai ? "Hoạt động" : "Ngừng"}\n`;
//   });
//   const a = document.createElement("a");
//   a.href = URL.createObjectURL(
//     new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }),
//   );
//   a.download = `${curTab.value === "dv" ? "dichvu" : "combo"}_${new Date().toISOString().slice(0, 10)}.csv`;
//   a.click();
//   showToast("Xuất CSV thành công!");
// }

// ── INIT ───────────────────────────────────────────────────────────
onMounted(async () => {
  await loadDanhMuc();
  await loadDichVu();
  await loadCombos();
});
</script>

<template>
  <div class="dvc-root">
    <!-- ── STATS ───────────────────────────────────────────────── -->
    <div class="stats-row">
      <div class="stat-card stat-gold">
        <div class="stat-icon"></div>
        <div class="stat-label">Tổng dịch vụ</div>
        <div class="stat-value">{{ dichvus.length }}</div>
        <div class="stat-hint">
          {{ dichvus.filter((d) => d.trangThai).length }} đang hoạt động
        </div>
      </div>
      <div class="stat-card stat-green">
        <div class="stat-icon"></div>
        <div class="stat-label">Tổng combo</div>
        <div class="stat-value">{{ combos.length }}</div>
        <div class="stat-hint">
          {{ combos.filter((c) => c.trangThai).length }} đang hoạt động
        </div>
      </div>
      <div class="stat-card stat-blue">
        <div class="stat-icon"></div>
        <div class="stat-label">Giá trung bình</div>
        <div class="stat-value">{{ fmt(avgPrice) }}</div>
        <div class="stat-hint">Dịch vụ đơn lẻ</div>
      </div>
      <div class="stat-card stat-purple">
        <div class="stat-icon"></div>
        <div class="stat-label">Tổng tiết kiệm combo</div>
        <div class="stat-value">{{ fmt(totalSavings) }}</div>
        <div class="stat-hint">Khách hàng được giảm</div>
      </div>
    </div>

    <!-- ── HEADER BAR ──────────────────────────────────────────── -->
    <div class="header-bar">
      <div class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="tab"
          :class="{ active: curTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          <!-- {{ tab.icon }} -->{{ tab.label }}
          <span class="tab-count">{{
            tab.key === "dv" ? dichvus.length : combos.length
          }}</span>
        </button>
      </div>
      <div class="header-actions">
        <!-- <button class="btn btn-ghost btn-sm" @click="exportCSV">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M8 1v9M5 7l3 3 3-3M2 11v2a1 1 0 001 1h10a1 1 0 001-1v-2" />
          </svg>
          Xuất CSV
        </button> -->
        <button type="button" class="btn btn-primary btn-sm" @click="openModal()">
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M8 2v12M2 8h12" />
          </svg>
          {{ curTab === "dv" ? "Thêm dịch vụ" : "Thêm combo" }}
        </button>
      </div>
    </div>

    <!-- ── TOOLBAR ─────────────────────────────────────────────── -->
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
          placeholder="Tìm kiếm..."
          @keyup.enter="onFilterChange"
          @input="curPage = 1"
        />
      </div>
      <select
        v-if="curTab === 'dv'"
        v-model="filterCat"
        class="filter-select"
        @change="onFilterChange"
      >
        <option value="">Tất cả danh mục</option>
        <option v-for="dm in danhMucs" :key="dm.maDM" :value="dm.maDM">
          {{ dm.tenDanhMuc }}
        </option>
      </select>
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
      <select v-model.number="perPage" class="filter-select" style="width:auto;min-width:110px" @change="curPage = 1">
        <option :value="10">10 / trang</option>
        <option :value="20">20 / trang</option>
        <option :value="50">50 / trang</option>
        <option :value="9999">Tất cả</option>
      </select>
    </div>

    <!-- ── TABLE: Dịch vụ ──────────────────────────────────────── -->
    <template v-if="curTab === 'dv'">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 56px">Ảnh</th>
              <th>Mã DV</th>
              <th class="sortable" @click="setSort('tenDV')">
                Tên dịch vụ
                <span class="sort-icon">{{ sortIcon("tenDV") }}</span>
              </th>
              <th>Danh mục</th>
              <th class="sortable" @click="setSort('gia')">
                Giá <span class="sort-icon">{{ sortIcon("gia") }}</span>
              </th>
              <th>Thời gian</th>
              <th>Trạng thái</th>
              <th>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pageData.length === 0">
              <td colspan="8">
                <div class="empty-state">
                  <div class="empty-icon">🔍</div>
                  <div class="empty-text">Không tìm thấy dịch vụ nào</div>
                </div>
              </td>
            </tr>
            <template v-for="d in pageData" :key="d.maDV">
              <tr
                class="dv-main-row"
                :class="{ 'row-expanded': isExpanded(d.maDV) }"
              >
                <td>
                  <div
                    class="thumb-wrap"
                    @click="d.hinhanhs?.length && openLightbox(d.hinhanhs, 0)"
                  >
                    <img
                      v-if="d.hinhanhs?.length"
                      :src="d.hinhanhs[0]"
                      class="thumb-img"
                      :alt="d.tenDV"
                    />
                    <div v-else class="thumb-placeholder">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    </div>
                    <span v-if="d.hinhanhs?.length > 1" class="thumb-count"
                      >+{{ d.hinhanhs.length - 1 }}</span
                    >
                  </div>
                </td>
                <td>
                  <button
                    type="button"
                    class="expand-btn"
                    @click="toggleExpand(d.maDV)"
                    :title="isExpanded(d.maDV) ? 'Thu gọn' : 'Mở tiêu đề & chi tiết'"
                  >
                    <svg
                      class="expand-icon"
                      :class="{ open: isExpanded(d.maDV) }"
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M4 6l4 4 4-4" />
                    </svg>
                  </button>
                  <span class="code-text">{{ d.maDV }}</span>
                </td>
                <td>
                  <div class="dv-name">{{ d.tenDV }}</div>
                  <div class="dv-sub">{{ d.moTa }}</div>
                </td>
                <td>
                  <span class="cat-badge" :class="getCatClass(d.maDM)">{{
                    getDMName(d.maDM)
                  }}</span>
                </td>
                <td class="price-cell">{{ fmt(d.gia) }}</td>
                <td class="time-cell">⏱ {{ fmtMin(d.thoiGianLam) }}</td>
                <td>
                  <span
                    class="status-pill"
                    :class="d.trangThai ? 'active' : 'inactive'"
                  >
                    <span class="status-dot"></span
                    >{{ d.trangThai ? "Hoạt động" : "Ngừng" }}
                  </span>
                </td>
                <td>
                  <div class="actions">
                    <button
                      class="icon-btn view"
                      title="Xem chi tiết"
                      @click="viewDV(d)"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <circle cx="8" cy="8" r="3" />
                        <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                      </svg>
                    </button>
                    <button
                      class="icon-btn edit"
                      title="Chỉnh sửa"
                      @click="editDV(d)"
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                      </svg>
                    </button>
                    <button class="icon-btn del" title="Xóa" @click="delDV(d)">
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path
                          d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"
                        />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Expanded row: Tiêu đề + Chi tiết -->
              <tr v-if="isExpanded(d.maDV)" class="dv-detail-row">
                <td colspan="8">
                  <div class="nested-panel">
                    <div class="nested-header">
                      <h4 class="nested-title">
                        Tiêu đề dịch vụ
                        <span class="nested-count">{{
                          tieudes.filter((t) => sameMaDv(t.maDv, d.maDV)).length
                        }}</span>
                      </h4>
                      <button
                        type="button"
                        class="btn btn-sm btn-nested-add"
                        @click="startNewTieuDe(d.maDV)"
                      >
                        + Thêm tiêu đề
                      </button>
                    </div>

                    <div class="nested-body">
                      <div
                        v-if="
                          !tieudes.filter(
                            (t) => sameMaDv(t.maDv, d.maDV) && !t._newFor,
                          ).length &&
                          !tieudes.find((t) => sameMaDv(t._newFor, d.maDV))
                        "
                        class="nested-empty"
                      >
                        Chưa có tiêu đề. Nhấn "Thêm tiêu đề" để bắt đầu.
                      </div>

                      <!-- Tiêu đề items -->
                      <div
                        v-for="td in tieudes"
                        :key="td.maTd || td._newFor + td.tenTieuDe"
                        v-show="
                          sameMaDv(td.maDv, d.maDV) && (!td._newFor || td._editing)
                        "
                        class="td-item"
                        :class="{ 'td-new': td._newFor }"
                      >
                        <!-- New/Edit tiêu đề form -->
                        <div v-if="td._editing" class="td-form">
                          <div class="td-form-row">
                            <div class="td-form-field">
                              <input
                                v-model="td.tenTieuDe"
                                class="td-input"
                                :class="{ 'input-error': getTdError('_tdform', 'tenTieuDe') }"
                                placeholder="Tên tiêu đề"
                              />
                              <p v-if="getTdError('_tdform', 'tenTieuDe')" class="td-field-error">{{ getTdError('_tdform', 'tenTieuDe') }}</p>
                            </div>
                            <div class="td-form-field">
                              <input
                                v-model="td.moTaTieuDe"
                                class="td-input"
                                :class="{ 'input-error': getTdError('_tdform', 'moTaTieuDe') }"
                                placeholder="Mô tả (optional)"
                                style="flex: 1.5"
                              />
                              <p v-if="getTdError('_tdform', 'moTaTieuDe')" class="td-field-error">{{ getTdError('_tdform', 'moTaTieuDe') }}</p>
                            </div>
                            <div class="td-form-field">
                              <input
                                v-model="td.soThuTu"
                                class="td-input td-sm"
                                :class="{ 'input-error': getTdError('_tdform', 'soThuTu') }"
                                type="number"
                                placeholder="STT"
                                style="width: 60px"
                              />
                              <p v-if="getTdError('_tdform', 'soThuTu')" class="td-field-error">{{ getTdError('_tdform', 'soThuTu') }}</p>
                            </div>
                            <select
                              v-model.number="td.trangThai"
                              class="td-input td-sm"
                              style="width: 90px"
                            >
                              <option :value="1">Hoạt động</option>
                              <option :value="0">Ngừng</option>
                            </select>
                            <button
                              type="button"
                              class="td-btn td-btn-save"
                              :disabled="tdSaving"
                              @click="
                                td.maTd
                                  ? editTieuDe(td.maTd, d.maDV, td)
                                  : saveTieuDe(d.maDV, td)
                              "
                            >
                              {{ tdSaving ? "..." : td.maTd ? "Cập nhật" : "Lưu" }}
                            </button>
                            <button
                              type="button"
                              class="td-btn td-btn-cancel"
                              @click="cancelTieuDeEdit(td)"
                            >
                              Hủy
                            </button>
                          </div>
                        </div>

                        <!-- Display tiêu đề (not editing) -->
                        <div v-else class="td-display">
                          <div class="td-header">
                            <button
                              type="button"
                              class="td-toggle"
                              @click="toggleTitleExpand(td.maTd)"
                            >
                              <svg
                                class="expand-icon"
                                :class="{ open: isTitleExpanded(td.maTd) }"
                                width="14"
                                height="14"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                              >
                                <path d="M4 6l4 4 4-4" />
                              </svg>
                            </button>
                            <span class="td-name">{{ td.tenTieuDe }}</span>
                            <span v-if="td.moTaTieuDe" class="td-desc">{{
                              td.moTaTieuDe
                            }}</span>
                            <span
                              class="status-pill"
                              :class="td.trangThai ? 'active' : 'inactive'"
                              style="font-size: 10px; padding: 2px 6px"
                            >
                              {{ td.trangThai ? "Hoạt động" : "Ngừng" }}
                            </span>
                            <div class="actions" style="margin-left: auto">
                              <button
                                type="button"
                                class="icon-btn edit icon-btn-xs"
                                title="Sửa tiêu đề"
                                @click.stop="
                                  td._snapshot = { tenTieuDe: td.tenTieuDe, moTaTieuDe: td.moTaTieuDe, soThuTu: td.soThuTu, trangThai: td.trangThai };
                                  td._editing = true;
                                "
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="1.5"
                                >
                                  <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                class="icon-btn del icon-btn-xs"
                                title="Xóa tiêu đề"
                                @click.stop="deleteTieuDe(td.maTd, d.maDV)"
                              >
                                <svg
                                  width="12"
                                  height="12"
                                  viewBox="0 0 16 16"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="1.5"
                                >
                                  <path
                                    d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"
                                  />
                                </svg>
                              </button>
                            </div>
                          </div>

                          <!-- Chi tiết section -->
                          <div v-if="isTitleExpanded(td.maTd)" class="ct-section">
                            <div class="ct-form" style="margin-bottom: 8px">
                              <input
                                v-model="td._ctTen"
                                class="td-input"
                                placeholder="Thêm chi tiết mới..."
                                style="flex: 1"
                                @keyup.enter="addChiTiet(td)"
                              />

                              <input
                                v-model="td._ctDesc"
                                class="td-input"
                                placeholder="Mô tả"
                                style="flex: 1"
                              />

                              <input
                                v-model.number="td._ctStt"
                                class="td-input td-sm"
                                type="number"
                                placeholder="STT"
                                style="width: 60px"
                              />

                              <label class="td-btn td-img-upload">
                                Ảnh
                                <input
                                  type="file"
                                  accept="image/*"
                                  style="display: none"
                                  @change="(e) => (td._pendingCtFile = e.target.files[0])"
                                />
                              </label>

                              <button type="button" class="td-btn td-btn-save" @click="addChiTiet(td)">
                                + Thêm CT
                              </button>
                            </div>

                            <div v-if="td.chiTiet && td.chiTiet.length" class="ct-list">
                              <div v-for="ct in td.chiTiet" :key="ct.maCttd" class="ct-item">
                                
                                <!-- Editing -->
                                <div
                                  v-if="ct._editing"
                                  class="ct-display"
                                  style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap"
                                >
                                  <input v-model="ct.tenTieuDe" class="td-input" :class="{ 'input-error': getCtError('_ctform', 'ctTenTieuDe') }" style="flex: 1" />
                                  <input v-model="ct.moTaTieuDe" class="td-input" :class="{ 'input-error': getCtError('_ctform', 'ctMoTaTieuDe') }" style="flex: 1" />
                                  <input
                                    v-model.number="ct.soThuTu"
                                    class="td-input td-sm"
                                    type="number"
                                    style="width: 60px"
                                  />

                                  <label class="td-btn td-img-upload">
                                    Đổi ảnh
                                    <input
                                      type="file"
                                      accept="image/*"
                                      style="display: none"
                                      @change="(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;

                                        ct._newFile = file;
                                        ct._imgPreview = URL.createObjectURL(file);
                                      }"
                                    />
                                  </label>

                                  <button
                                    type="button"
                                    class="td-btn td-btn-save"
                                    @click="editChiTiet(ct.maCttd, td.maTd, td.maDv, ct)"
                                  >
                                    Cập nhật
                                  </button>

                                  <button
                                    type="button"
                                    class="td-btn td-btn-cancel"
                                    @click="ct._editing = false; ct._newFile = null; ct._imgPreview = null; if (ct._snapshot) { ct.tenTieuDe = ct._snapshot.tenTieuDe; ct.moTaTieuDe = ct._snapshot.moTaTieuDe; ct.soThuTu = ct._snapshot.soThuTu; }"
                                  >
                                    Hủy
                                  </button>
                                </div>

                                <!-- Display -->
                                <div v-else class="ct-display">
                                  <div v-if="ct.hinhAnh" class="ct-img-wrap">
                                    <img
                                      :src="ct._imgPreview || toAbsUrl(ct.hinhAnh)"
                                      class="ct-img"
                                    />
                                  </div>

                                  <div class="ct-info">
                                    <span class="ct-name">{{ ct.tenTieuDe }}</span>
                                    <span v-if="ct.moTaTieuDe" class="ct-desc">
                                      {{ ct.moTaTieuDe }}
                                    </span>
                                  </div>

                                  <div class="actions" style="flex-shrink:0">
                                    <button
                                      class="icon-btn edit icon-btn-xs"
                                      @click.stop="
                                        ct._snapshot = { tenTieuDe: ct.tenTieuDe, moTaTieuDe: ct.moTaTieuDe, soThuTu: ct.soThuTu };
                                        ct._editing = true;
                                        ct._imgPreview = ct.hinhAnh ? toAbsUrl(ct.hinhAnh) : '';
                                      "
                                    >
                                      ✏️
                                    </button>

                                    <button
                                      class="icon-btn del icon-btn-xs"
                                      @click.stop="deleteChiTiet(ct.maCttd, td.maDv)"
                                    >
                                      🗑️
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div v-else class="ct-empty">
                              Chưa có chi tiết. Nhập thông tin phía trên để thêm.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
        <div v-if="filteredData.length > 0 && perPage < 9999" class="pager-wrap">
          <span
            >Hiển thị {{ (curPage - 1) * perPage + 1 }}–{{
              Math.min(curPage * perPage, filteredData.length)
            }}
            / {{ filteredData.length }} mục</span
          >
          <div class="pager-btns">
            <button
              class="page-btn"
              :disabled="curPage <= 1"
              @click="curPage--"
            >
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
      </div>
    </template>

    <!-- ── GRID: Combo ─────────────────────────────────────────── -->
    <template v-else>
      <div class="combo-grid">
        <div
          v-if="pageData.length === 0"
          class="empty-state"
          style="grid-column: 1/-1"
        >
          <div class="empty-icon">📦</div>
          <div class="empty-text">Không tìm thấy combo nào</div>
        </div>
        <div
          v-for="c in pageData"
          :key="c.maCB"
          class="combo-card"
          :class="{ 'inactive-card': !c.trangThai }"
        >
          <div class="combo-img">
            <img
              v-if="c.hinhAnh"
              :src="c.hinhAnh"
              class="combo-cover-img"
              :alt="c.tenCombo"
              @click="openLightbox([c.hinhAnh], 0)"
            />
            <div
              v-else
              class="combo-cover-placeholder"
              :style="{ background: `linear-gradient(${c.mauNen})` }"
            >
              <span class="combo-img-emoji">{{ c.icon }}</span>
            </div>
            <span class="combo-discount" v-if="discountPct(c) > 0"
              >-{{ discountPct(c) }}%</span
            >
            <span v-if="!c.trangThai" class="combo-status-badge">Ngừng HĐ</span>
          </div>
          <div class="combo-body">
            <div class="combo-code">{{ c.maCB }}</div>
            <div class="combo-name">{{ c.tenCombo }}</div>
            <div class="combo-desc">{{ c.moTa }}</div>
            <div class="combo-tags">
              <span v-for="id in c.dichvus" :key="id" class="combo-tag">{{
                getDVName(id)
              }}</span>
            </div>
          </div>
          <div class="combo-footer">
            <div>
              <div class="combo-price">{{ fmt(c.gia) }}</div>
              <div class="combo-price-orig" v-if="c.giaGoc > c.gia">
                {{ fmt(c.giaGoc) }}
              </div>
              <div class="combo-savings" v-if="c.giaGoc > c.gia">
                Tiết kiệm {{ fmt(c.giaGoc - c.gia) }}
              </div>
            </div>
            <div class="actions">
              <button class="icon-btn view" title="Xem" @click="viewCombo(c)">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <circle cx="8" cy="8" r="3" />
                  <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
                </svg>
              </button>
              <button class="icon-btn edit" title="Sửa" @click="editCombo(c)">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                </svg>
              </button>
              <button class="icon-btn del" title="Xóa" @click="delCombo(c)">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.5"
                >
                  <path
                    d="M2 4h12M6 4V2h4v2M5 4v9a1 1 0 001 1h4a1 1 0 001-1V4"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="filteredData.length > 0 && perPage < 9999"
        class="pager-wrap"
        style="
          margin-top: 14px;
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        "
      >
        <span
          >Hiển thị {{ (curPage - 1) * perPage + 1 }}–{{
            Math.min(curPage * perPage, filteredData.length)
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

    <!-- ── LIGHTBOX ────────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="lightbox.open"
        class="lightbox-overlay"
        @click.self="lightbox.open = false"
      >
        <button class="lb-close" @click="lightbox.open = false">✕</button>
        <button
          v-if="lightbox.imgs.length > 1"
          class="lb-arrow lb-prev"
          @click="lbPrev"
        >
          ‹
        </button>
        <img :src="lightbox.imgs[lightbox.idx]" class="lb-img" />
        <button
          v-if="lightbox.imgs.length > 1"
          class="lb-arrow lb-next"
          @click="lbNext"
        >
          ›
        </button>
        <div v-if="lightbox.imgs.length > 1" class="lb-dots">
          <span
            v-for="(_, i) in lightbox.imgs"
            :key="i"
            class="lb-dot"
            :class="{ active: i === lightbox.idx }"
            @click="lightbox.idx = i"
          ></span>
        </div>
      </div>
    </Teleport>

    <!-- ── MODAL ───────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div
          class="modal"
          :class="{
            'modal-wide': modal.mode === 'formDV' || modal.mode === 'formCombo',
          }"
        >
          <div class="modal-head">
            <div class="modal-title">{{ modal.title }}</div>
            <button class="modal-close" @click="closeModal">✕</button>
          </div>

          <!-- ── VIEW DV ── -->
          <div v-if="modal.mode === 'viewDV'" class="modal-body">
            <div v-if="modal.data.hinhanhs?.length" class="detail-section">
              <div class="detail-title">
                Hình ảnh ({{ modal.data.hinhanhs.length }})
              </div>
              <div class="img-gallery">
                <div
                  v-for="(src, i) in modal.data.hinhanhs"
                  :key="i"
                  class="gallery-thumb"
                  @click="openLightbox(modal.data.hinhanhs, i)"
                >
                  <img :src="src" :alt="`Ảnh ${i + 1}`" />
                  <div class="gallery-overlay">🔍</div>
                </div>
              </div>
            </div>
            <div v-else class="detail-section">
              <div class="detail-title">Hình ảnh</div>
              <div class="no-img-notice">Chưa có hình ảnh</div>
            </div>
            <div class="detail-section">
              <div class="detail-title">Thông tin cơ bản</div>
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-label">Mã dịch vụ</div>
                  <div class="detail-val">{{ modal.data.maDV }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Danh mục</div>
                  <div class="detail-val">
                    <span
                      class="cat-badge"
                      :class="getCatClass(modal.data.maDM)"
                      >{{ getDMName(modal.data.maDM) }}</span
                    >
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Giá</div>
                  <div class="detail-val price-cell">
                    {{ fmt(modal.data.gia) }}
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Thời gian</div>
                  <div class="detail-val">
                    ⏱ {{ fmtMin(modal.data.thoiGianLam) }}
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Trạng thái</div>
                  <div class="detail-val">
                    <span
                      class="status-pill"
                      :class="modal.data.trangThai ? 'active' : 'inactive'"
                      ><span class="status-dot"></span
                      >{{ modal.data.trangThai ? "Hoạt động" : "Ngừng" }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-section">
              <div class="detail-title">Tên &amp; mô tả</div>
              <div
                style="
                  font-size: 15px;
                  font-weight: 600;
                  color: #1a1a2e;
                  margin-bottom: 6px;
                "
              >
                {{ modal.data.tenDV }}
              </div>
              <div style="font-size: 13px; color: #6b7280; line-height: 1.7">
                {{ modal.data.moTa }}
              </div>
            </div>
            <div
              v-if="dvInCombos(modal.data.maDV).length"
              class="detail-section"
            >
              <div class="detail-title">
                Có trong {{ dvInCombos(modal.data.maDV).length }} combo
              </div>
              <div
                v-for="c in dvInCombos(modal.data.maDV)"
                :key="c.maCB"
                class="dv-list-item"
              >
                <span>{{ c.tenCombo }}</span
                ><span class="price-cell">{{ fmt(c.gia) }}</span>
              </div>
            </div>
          </div>

          <!-- ── VIEW COMBO ── -->
          <div v-else-if="modal.mode === 'viewCombo'" class="modal-body">
            <div class="detail-section">
              <div class="detail-title">Ảnh bìa</div>
              <div
                v-if="modal.data.hinhAnh"
                class="combo-view-img-wrap"
                @click="openLightbox([modal.data.hinhAnh], 0)"
              >
                <img
                  :src="modal.data.hinhAnh"
                  class="combo-view-img"
                  :alt="modal.data.tenCombo"
                />
                <div class="gallery-overlay">🔍</div>
              </div>
              <div
                v-else
                class="combo-cover-placeholder"
                style="height: 140px; border-radius: 10px"
                :style="{ background: `linear-gradient(${modal.data.mauNen})` }"
              >
                <span style="font-size: 40px">{{ modal.data.icon }}</span>
              </div>
            </div>
            <div class="detail-section">
              <div class="detail-title">Thông tin combo</div>
              <div class="detail-grid">
                <div class="detail-item">
                  <div class="detail-label">Mã combo</div>
                  <div class="detail-val">{{ modal.data.maCB }}</div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Trạng thái</div>
                  <div class="detail-val">
                    <span
                      class="status-pill"
                      :class="modal.data.trangThai ? 'active' : 'inactive'"
                      ><span class="status-dot"></span
                      >{{ modal.data.trangThai ? "Hoạt động" : "Ngừng" }}</span
                    >
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Giá combo</div>
                  <div class="detail-val price-cell">
                    {{ fmt(modal.data.gia) }}
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Giá gốc (tổng DV)</div>
                  <div
                    class="detail-val"
                    style="text-decoration: line-through; color: #9ca3af"
                  >
                    {{ fmt(modal.data.giaGoc) }}
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Tiết kiệm</div>
                  <div class="detail-val" style="color: #059669">
                    {{ fmt(modal.data.giaGoc - modal.data.gia) }} (-{{
                      discountPct(modal.data)
                    }}%)
                  </div>
                </div>
                <div class="detail-item">
                  <div class="detail-label">Số dịch vụ</div>
                  <div class="detail-val">
                    {{ modal.data.dichvus.length }} dịch vụ
                  </div>
                </div>
              </div>
            </div>
            <div class="detail-section">
              <div class="detail-title">Mô tả</div>
              <div style="font-size: 13px; color: #6b7280; line-height: 1.7">
                {{ modal.data.moTa }}
              </div>
            </div>
            <div class="detail-section">
              <div class="detail-title">Dịch vụ bao gồm</div>
              <div v-for="id in modal.data.dichvus" :key="id">
                <div v-if="getDV(id)" class="dv-list-item">
                  <div>
                    <div style="font-size: 13px; font-weight: 500">
                      {{ getDV(id).tenDV }}
                    </div>
                    <div style="font-size: 11px; color: #9ca3af">
                      ⏱ {{ fmtMin(getDV(id).thoiGianLam) }}
                    </div>
                  </div>
                  <span style="color: #9ca3af; font-size: 13px">{{
                    fmt(getDV(id).gia)
                  }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── FORM DV ── -->
          <div v-else-if="modal.mode === 'formDV'" class="modal-body">
            <div class="form-row-2">
              <div>
                <label class="form-label"
                  >Mã dịch vụ <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.maDV }"
                  v-model="form.maDV"
                  :readonly="!!editingId"
                  placeholder="VD: DV015"
                  @input="errors.maDV = ''"
                />
                <p v-if="errors.maDV" class="field-error">{{ errors.maDV }}</p>
              </div>
              <div>
                <label class="form-label"
                  >Danh mục <span class="req">*</span></label
                >
                <select
                  class="form-select"
                  :class="{ 'input-error': errors.maDM }"
                  v-model="form.maDM"
                  @change="errors.maDM = ''"
                >
                  <option value="" disabled>-- Chọn danh mục --</option>
                  <option
                    v-for="dm in danhMucs"
                    :key="dm.maDM"
                    :value="dm.maDM"
                  >
                    {{ dm.tenDanhMuc }}
                  </option>
                </select>
                <p v-if="errors.maDM" class="field-error">{{ errors.maDM }}</p>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label"
                >Tên dịch vụ <span class="req">*</span></label
              >
              <input
                class="form-input"
                :class="{ 'input-error': errors.tenDV }"
                v-model="form.tenDV"
                placeholder="Nhập tên dịch vụ..."
                @input="errors.tenDV = ''"
              />
              <p v-if="errors.tenDV" class="field-error">{{ errors.tenDV }}</p>
            </div>
            <div class="form-row-2">
              <div>
                <label class="form-label"
                  >Giá (VNĐ) <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.gia }"
                  v-model="form.gia"
                  type="number"
                  min="0"
                  placeholder="0"
                  @input="errors.gia = ''"
                />
                <p v-if="errors.gia" class="field-error">{{ errors.gia }}</p>
              </div>
              <div>
                <label class="form-label"
                  >Thời gian (phút) <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.thoiGianLam }"
                  v-model="form.thoiGianLam"
                  type="number"
                  min="1"
                  placeholder="30"
                  @input="errors.thoiGianLam = ''"
                />
                <p v-if="errors.thoiGianLam" class="field-error">
                  {{ errors.thoiGianLam }}
                </p>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label"
                >Mô tả <span class="label-hint">— tối đa 500 ký tự</span></label
              >
              <textarea
                class="form-textarea"
                :class="{ 'input-error': errors.moTa }"
                v-model="form.moTa"
                placeholder="Mô tả ngắn về dịch vụ..."
                @input="errors.moTa = ''"
              ></textarea>
              <div
                class="char-count"
                :class="{ 'char-warn': (form.moTa?.length ?? 0) > 450 }"
              >
                {{ form.moTa?.length ?? 0 }} / 500
              </div>
              <p v-if="errors.moTa" class="field-error">{{ errors.moTa }}</p>
            </div>

            <!-- MULTI IMAGE -->
            <div class="form-row">
              <label class="form-label">
                Hình ảnh dịch vụ
                <span class="label-hint"
                  >— tối đa 10 ảnh, mỗi ảnh ≤ 5MB. Ảnh đầu tiên là ảnh
                  chính.</span
                >
              </label>
              <div
                v-if="!form.hinhanhs.length"
                class="img-upload-zone"
                @click="dvImgInput?.click()"
                @dragover.prevent
                @drop.prevent="onDropDV"
              >
                <input
                  ref="dvImgInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none"
                  @change="onDVImgChange"
                />
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  stroke-width="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <div class="upload-hint">
                  Kéo thả hoặc <span class="upload-link">chọn ảnh</span>
                </div>
                <div style="font-size: 11px; color: #d1d5db">
                  PNG, JPG, WEBP
                </div>
              </div>
              <div v-else>
                <input
                  ref="dvImgInput"
                  type="file"
                  accept="image/*"
                  multiple
                  style="display: none"
                  @change="onDVImgChange"
                />
                <div class="img-preview-grid">
                  <div
                    v-for="(src, i) in form.hinhanhs"
                    :key="i"
                    class="preview-item"
                  >
                    <img
                      :src="src"
                      class="preview-img"
                      @click="openLightbox(form.hinhanhs, i)"
                    />
                    <button class="preview-del" @click.stop="removeDVImg(i)">
                      ✕
                    </button>
                    <span v-if="i === 0" class="preview-main-badge"
                      >Ảnh chính</span
                    >
                    <button
                      v-if="i > 0"
                      class="preview-move-btn"
                      @click.stop="moveDVImg(i, -1)"
                      title="Đặt làm trước"
                    >
                      ‹
                    </button>
                  </div>
                  <div
                    v-if="form.hinhanhs.length < 10"
                    class="preview-add"
                    @click="dvImgInput?.click()"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path d="M8 2v12M2 8h12" />
                    </svg>
                    <span style="font-size: 10px; margin-top: 3px">Thêm</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Trạng thái</label>
              <select class="form-select" v-model.number="form.trangThai">
                <option :value="1">✅ Hoạt động</option>
                <option :value="0">❌ Ngừng hoạt động</option>
              </select>
            </div>
          </div>

          <!-- ── FORM COMBO ── -->
          <div v-else-if="modal.mode === 'formCombo'" class="modal-body">
            <div class="form-row-2">
              <div>
                <label class="form-label"
                  >Mã combo <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.maCB }"
                  v-model="form.maCB"
                  :readonly="!!editingId"
                  placeholder="VD: CB008"
                  @input="errors.maCB = ''"
                />
                <p v-if="errors.maCB" class="field-error">{{ errors.maCB }}</p>
              </div>
              <div>
                <label class="form-label"
                  >Tên combo <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.tenCombo }"
                  v-model="form.tenCombo"
                  placeholder="Nhập tên combo..."
                  @input="errors.tenCombo = ''"
                />
                <p v-if="errors.tenCombo" class="field-error">
                  {{ errors.tenCombo }}
                </p>
              </div>
            </div>
            <div class="form-row-2">
              <div>
                <label class="form-label"
                  >Giá combo (VNĐ) <span class="req">*</span></label
                >
                <input
                  class="form-input"
                  :class="{ 'input-error': errors.giaCombo }"
                  v-model="form.gia"
                  type="number"
                  min="0"
                  placeholder="0"
                  @input="errors.giaCombo = ''"
                />
                <p v-if="errors.giaCombo" class="field-error">
                  {{ errors.giaCombo }}
                </p>
              </div>
              <div>
                <label class="form-label">Giá gốc <span class="label-hint">— tự tính từ tổng dịch vụ</span></label>
                <div class="form-input" style="background:#f9fafb; color:#6b7280; cursor:default;">
                  {{ form.dichvus.length ? fmt(form.dichvus.reduce((s, id) => s + (getDV(id)?.gia || 0), 0)) : '—' }}
                </div>
              </div>
            </div>
            <div class="form-row">
              <label class="form-label"
                >Mô tả <span class="label-hint">— tối đa 500 ký tự</span></label
              >
              <textarea
                class="form-textarea"
                :class="{ 'input-error': errors.moTa }"
                v-model="form.moTa"
                placeholder="Mô tả combo..."
                @input="errors.moTa = ''"
              ></textarea>
              <div
                class="char-count"
                :class="{ 'char-warn': (form.moTa?.length ?? 0) > 450 }"
              >
                {{ form.moTa?.length ?? 0 }} / 500
              </div>
              <p v-if="errors.moTa" class="field-error">{{ errors.moTa }}</p>
            </div>

            <!-- SINGLE IMAGE -->
            <div class="form-row">
              <label class="form-label">
                Ảnh bìa combo <span class="req">*</span>
                <span class="label-hint">— 1 ảnh duy nhất, ≤ 5MB</span>
              </label>
              <input
                ref="cbImgInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="onCBImgChange"
              />
              <div
                v-if="!form.hinhAnh"
                class="img-upload-zone"
                :class="{ 'upload-zone-error': errors.hinhAnh }"
                @click="cbImgInput?.click()"
                @dragover.prevent
                @drop.prevent="onDropCB"
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9ca3af"
                  stroke-width="1.5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
                <div class="upload-hint">
                  Kéo thả hoặc <span class="upload-link">chọn ảnh bìa</span>
                </div>
                <div style="font-size: 11px; color: #d1d5db">
                  PNG, JPG, WEBP
                </div>
              </div>
              <p v-if="errors.hinhAnh" class="field-error">{{ errors.hinhAnh }}</p>
              <div v-else class="cb-img-preview">
                <img
                  :src="form.hinhAnh"
                  class="cb-preview-img"
                  @click="openLightbox([form.hinhAnh], 0)"
                />
                <div class="cb-preview-actions">
                  <button
                    class="btn btn-ghost btn-sm"
                    @click="cbImgInput?.click()"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                    >
                      <path d="M11 2l3 3L5 14H2v-3L11 2z" />
                    </svg>
                    Đổi ảnh
                  </button>
                </div>
              </div>
            </div>

            <!-- CHỌN DỊCH VỤ -->
            <div class="form-row">
              <label class="form-label">
                Dịch vụ trong combo <span class="req">*</span>
                <span class="label-hint">— click để chọn / bỏ chọn</span>
              </label>
              <div
                class="dv-picker"
                :class="{ 'picker-error': errors.dichvus }"
              >
                <div
                  v-if="!dichvus.filter((x) => x.trangThai).length"
                  style="font-size: 12px; color: #9ca3af; padding: 4px"
                >
                  Không có dịch vụ đang hoạt động.
                </div>
                <span
                  v-for="d in dichvus.filter((x) => x.trangThai)"
                  :key="d.maDV"
                  class="dv-chip"
                  :class="form.dichvus.includes(d.maDV) ? 'sel' : 'unsel'"
                  @click="toggleDV(d.maDV)"
                >
                  {{ d.tenDV }} <span class="chip-price">{{ fmt(d.gia) }}</span>
                </span>
              </div>
              <p v-if="errors.dichvus" class="field-error">
                {{ errors.dichvus }}
              </p>

              <!-- Hiển thị tổng giá gốc tự tính -->
              <div v-if="form.dichvus.length" class="combo-price-preview">
                <span>Tổng giá dịch vụ đã chọn:</span>
                <strong>{{
                  fmt(
                    form.dichvus.reduce(
                      (s, id) => s + (getDV(id)?.gia || 0),
                      0,
                    ),
                  )
                }}</strong>
                <span
                  v-if="
                    form.gia &&
                    form.dichvus.reduce(
                      (s, id) => s + (getDV(id)?.gia || 0),
                      0,
                    ) > Number(form.gia)
                  "
                  style="color: #059669"
                >
                  → Tiết kiệm
                  {{
                    fmt(
                      form.dichvus.reduce(
                        (s, id) => s + (getDV(id)?.gia || 0),
                        0,
                      ) - Number(form.gia),
                    )
                  }}
                </span>
              </div>
            </div>

            <div class="form-row">
              <label class="form-label">Trạng thái</label>
              <select class="form-select" v-model.number="form.trangThai">
                <option :value="1">✅ Hoạt động</option>
                <option :value="0">❌ Ngừng hoạt động</option>
              </select>
            </div>
          </div>

          <div class="modal-foot">
            <template
              v-if="modal.mode === 'viewDV' || modal.mode === 'viewCombo'"
            >
              <button class="btn btn-ghost btn-sm" @click="closeModal">
                Đóng
              </button>
              <button
                class="btn btn-primary btn-sm"
                @click="
                  modal.mode === 'viewDV'
                    ? editDV(modal.data)
                    : editCombo(modal.data)
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
.dvc-root {
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
.stat-blue::before {
  background: #2563eb;
}
.stat-purple::before {
  background: #7c3aed;
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
.stat-blue .stat-value {
  color: #2563eb;
}
.stat-purple .stat-value {
  color: #7c3aed;
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
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}
.tabs {
  display: flex;
  gap: 4px;
  background: #f3f4f6;
  padding: 4px;
  border-radius: 10px;
}
.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  color: #6b7280;
  border: none;
  background: transparent;
  transition: all 0.15s;
}
.tab.active {
  background: #fff;
  color: #1a1a2e;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.tab-count {
  background: #e5e7eb;
  color: #6b7280;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 10px;
}
.tab.active .tab-count {
  background: #f3f4f6;
  color: #374151;
}
.header-actions {
  display: flex;
  gap: 8px;
}

/* ── BUTTONS ────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 15px;
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
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
.btn-del-img {
  color: #dc2626;
  border: 1px solid #fecaca;
  background: transparent;
}
.btn-del-img:hover {
  background: #fef2f2;
}

/* ── SPINNER ────────────────────────────────────────────────────── */
.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  flex-shrink: 0;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── TOOLBAR ────────────────────────────────────────────────────── */
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
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
  max-width: 300px;
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
  margin-left: auto;
}

/* ── TABLE ──────────────────────────────────────────────────────── */
.table-wrap {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  overflow: hidden;
}
table {
  width: 100%;
  border-collapse: collapse;
}
thead th {
  padding: 11px 14px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
  white-space: nowrap;
  text-transform: uppercase;
}
.sortable {
  cursor: pointer;
  user-select: none;
}
.sortable:hover {
  color: #374151;
}
.sort-icon {
  font-size: 10px;
}
tbody tr {
  border-bottom: 1px solid #f3f4f6;
  transition: background 0.12s;
}
tbody tr:last-child {
  border-bottom: none;
}
tbody tr:hover {
  background: #fafafa;
}
tbody td {
  padding: 10px 14px;
  font-size: 13px;
  vertical-align: middle;
}
.code-text {
  font-size: 12px;
  color: #6b7280;
  font-family: "Courier New", monospace;
  background: #f3f4f6;
  padding: 2px 7px;
  border-radius: 4px;
}
.dv-name {
  font-weight: 500;
  color: #1a1a2e;
}
.dv-sub {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
  max-width: 220px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.price-cell {
  font-weight: 600;
  color: #d97706;
}
.time-cell {
  font-size: 12px;
  color: #9ca3af;
  white-space: nowrap;
}

/* ── THUMBNAIL ──────────────────────────────────────────────────── */
.thumb-wrap {
  position: relative;
  width: 42px;
  height: 42px;
  cursor: pointer;
  flex-shrink: 0;
}
.thumb-img {
  width: 42px;
  height: 42px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  display: block;
  transition: opacity 0.15s;
}
.thumb-img:hover {
  opacity: 0.82;
}
.thumb-placeholder {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  border: 1.5px dashed #d1d5db;
  background: #f9fafb;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d1d5db;
}
.thumb-count {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: #1a1a2e;
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 8px;
  line-height: 1.5;
}

/* ── BADGES ─────────────────────────────────────────────────────── */
.cat-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 500;
}
.cat-1 {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}
.cat-2 {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
}
.cat-3 {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
}
.cat-4 {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.cat-5 {
  background: #fdf2f8;
  color: #9d174d;
  border: 1px solid #fbcfe8;
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
.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
  flex-shrink: 0;
}

/* ── ACTIONS ────────────────────────────────────────────────────── */
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

/* ── PAGER ──────────────────────────────────────────────────────── */
.pager-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 18px;
  border-top: 1px solid #f3f4f6;
  font-size: 12px;
  color: #9ca3af;
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

/* ── COMBO CARD ─────────────────────────────────────────────────── */
.combo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(285px, 1fr));
  gap: 14px;
}
.combo-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 13px;
  overflow: hidden;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
}
.combo-card:hover {
  border-color: #6b7280;
  transform: translateY(-3px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.combo-card.inactive-card {
  opacity: 0.65;
}
.combo-img {
  height: 150px;
  position: relative;
  overflow: hidden;
}
.combo-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  cursor: pointer;
  transition: transform 0.25s;
}
.combo-card:hover .combo-cover-img {
  transform: scale(1.03);
}
.combo-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.combo-img-emoji {
  font-size: 40px;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.1));
}
.combo-discount {
  position: absolute;
  top: 10px;
  left: 10px;
  background: #d97706;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 20px;
}
.combo-status-badge {
  position: absolute;
  top: 10px;
  right: 10px;
  background: #dc2626;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 20px;
}
.combo-body {
  padding: 13px;
  flex: 1;
}
.combo-code {
  font-size: 11px;
  color: #9ca3af;
  font-family: "Courier New", monospace;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-bottom: 5px;
}
.combo-name {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 4px;
  color: #1a1a2e;
  line-height: 1.3;
}
.combo-desc {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 9px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.combo-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.combo-tag {
  font-size: 11px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 2px 8px;
  border-radius: 20px;
  color: #6b7280;
  white-space: nowrap;
}
.combo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 13px;
  border-top: 1px solid #f3f4f6;
  background: #fafafa;
}
.combo-price {
  font-size: 17px;
  font-weight: 700;
  color: #d97706;
}
.combo-price-orig {
  font-size: 11px;
  color: #9ca3af;
  text-decoration: line-through;
  margin-top: 1px;
}
.combo-savings {
  font-size: 11px;
  color: #059669;
  margin-top: 1px;
}

/* ── EMPTY ──────────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 48px 20px;
  color: #9ca3af;
}
.empty-icon {
  font-size: 38px;
  margin-bottom: 10px;
  opacity: 0.45;
}
.empty-text {
  font-size: 14px;
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
  width: 540px;
  max-width: 95vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}
.modal-wide {
  width: 650px;
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
.form-input,
.form-select,
.form-textarea {
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
}
.form-input:focus,
.form-select:focus,
.form-textarea:focus {
  border-color: #6b7280;
  background: #fff;
  box-shadow: 0 0 0 3px rgba(107, 114, 128, 0.1);
}
.form-input[readonly] {
  opacity: 0.6;
  cursor: default;
}
.form-textarea {
  resize: vertical;
  min-height: 80px;
  line-height: 1.6;
}
/* Error states */
.input-error {
  border-color: #dc2626 !important;
  background: #fff !important;
}
.input-error:focus {
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1) !important;
}
/* Nested inline error for tiêu đề + chi tiết */
.td-field-error {
  color: #dc2626;
  font-size: 11px;
  margin: 2px 0 0 0;
  padding: 0;
}
.td-form-field {
  display: flex;
  flex-direction: column;
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
/* Char count */
.char-count {
  font-size: 11px;
  color: #9ca3af;
  text-align: right;
  margin-top: 3px;
}
.char-warn {
  color: #d97706;
}

/* ── IMAGE UPLOAD ───────────────────────────────────────────────── */
.img-upload-zone {
  border: 2px dashed #d1d5db;
  border-radius: 10px;
  padding: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  background: #fafafa;
  transition: all 0.15s;
}
.img-upload-zone:hover {
  border-color: #6b7280;
  background: #f3f4f6;
}
.upload-hint {
  font-size: 13px;
  color: #9ca3af;
}
.upload-link {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}
.img-preview-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 2px;
}
.preview-item {
  position: relative;
  width: 76px;
  height: 76px;
  flex-shrink: 0;
}
.preview-img {
  width: 76px;
  height: 76px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  display: block;
  cursor: pointer;
  transition: opacity 0.15s;
}
.preview-img:hover {
  opacity: 0.82;
}
.preview-del {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #dc2626;
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-main-badge {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  color: #fff;
  background: rgba(26, 26, 46, 0.72);
  border-radius: 0 0 7px 7px;
  padding: 2px 0;
}
.preview-move-btn {
  position: absolute;
  bottom: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(26, 26, 46, 0.65);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-add {
  width: 76px;
  height: 76px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #9ca3af;
  flex-shrink: 0;
  transition: all 0.15s;
  font-size: 11px;
  gap: 3px;
}
.preview-add:hover {
  border-color: #6b7280;
  color: #374151;
  background: #f3f4f6;
}
.cb-img-preview {
  display: flex;
  align-items: center;
  gap: 14px;
}
.cb-preview-img {
  width: 110px;
  height: 76px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  cursor: pointer;
  flex-shrink: 0;
}
.cb-preview-img:hover {
  opacity: 0.85;
}
.cb-preview-actions {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* ── DV PICKER ──────────────────────────────────────────────────── */
.dv-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 10px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  min-height: 56px;
  max-height: 140px;
  overflow-y: auto;
  transition: border 0.15s;
}
.dv-picker::-webkit-scrollbar {
  width: 4px;
}
.dv-picker::-webkit-scrollbar-thumb {
  background: #e5e7eb;
  border-radius: 4px;
}
.picker-error {
  border-color: #dc2626 !important;
}
.dv-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}
.dv-chip.sel {
  background: #1a1a2e;
  border: 1px solid #1a1a2e;
  color: #fff;
  font-weight: 500;
}
.dv-chip.unsel {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #6b7280;
}
.dv-chip.unsel:hover {
  border-color: #6b7280;
  color: #1a1a2e;
}
.chip-price {
  opacity: 0.65;
  font-size: 10px;
}
.combo-price-preview {
  font-size: 12px;
  color: #6b7280;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0fdf4;
  border-radius: 7px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.combo-price-preview strong {
  color: #059669;
}

/* ── DETAIL ─────────────────────────────────────────────────────── */
.detail-section {
  margin-bottom: 18px;
}
.detail-title {
  font-size: 11px;
  color: #9ca3af;
  font-weight: 600;
  letter-spacing: 0.7px;
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid #f3f4f6;
}
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.detail-item {
  background: #f9fafb;
  border-radius: 7px;
  padding: 10px 12px;
}
.detail-label {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 3px;
}
.detail-val {
  font-size: 13px;
  font-weight: 500;
  color: #1a1a2e;
}
.dv-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f9fafb;
  border-radius: 7px;
  margin-bottom: 6px;
}
.dv-list-item:last-child {
  margin-bottom: 0;
}
.no-img-notice {
  font-size: 13px;
  color: #9ca3af;
  background: #f9fafb;
  border-radius: 7px;
  padding: 12px 16px;
  text-align: center;
}

/* ── GALLERY ────────────────────────────────────────────────────── */
.img-gallery {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.gallery-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 9px;
  overflow: hidden;
  cursor: pointer;
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
}
.gallery-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gallery-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  opacity: 0;
  transition: opacity 0.15s;
}
.gallery-thumb:hover .gallery-overlay,
.combo-view-img-wrap:hover .gallery-overlay {
  opacity: 1;
}
.combo-view-img-wrap {
  position: relative;
  cursor: pointer;
  display: block;
  width: 100%;
  border-radius: 10px;
  overflow: hidden;
}
.combo-view-img {
  width: 100%;
  height: 170px;
  object-fit: cover;
  display: block;
}

/* ── LIGHTBOX ───────────────────────────────────────────────────── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.93);
  z-index: 900;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-img {
  max-width: 88vw;
  max-height: 82vh;
  object-fit: contain;
  border-radius: 6px;
  user-select: none;
}
.lb-close {
  position: fixed;
  top: 18px;
  right: 22px;
  background: rgba(255, 255, 255, 0.13);
  border: none;
  color: #fff;
  font-size: 20px;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.lb-close:hover {
  background: rgba(255, 255, 255, 0.26);
}
.lb-arrow {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255, 255, 255, 0.13);
  border: none;
  color: #fff;
  font-size: 28px;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  line-height: 1;
}
.lb-arrow:hover {
  background: rgba(255, 255, 255, 0.28);
}
.lb-prev {
  left: 18px;
}
.lb-next {
  right: 18px;
}
.lb-dots {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 6px;
}
.lb-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background 0.15s;
}
.lb-dot.active {
  background: #fff;
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
.upload-zone-error {
  border-color: #f87171 !important;
  background: #fff5f5 !important;
}

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .combo-grid {
    grid-template-columns: 1fr;
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
  .result-count {
    margin-left: 0;
  }
  .modal-wide {
    width: 95vw;
  }
}
@media (max-width: 480px) {
  .stats-row {
    grid-template-columns: 1fr 1fr;
  }
}

/* ── NESTED CRUD: TIÊU ĐỀ + CHI TIẾT ─────────────────────────── */
.dv-main-row.row-expanded {
  background: #f8fafc;
}
.expand-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 2px 4px;
  margin-right: 6px;
  display: inline-flex;
  align-items: center;
  transition: color 0.15s;
  vertical-align: middle;
}
.expand-btn:hover {
  color: #1a1a2e;
}
.expand-icon {
  transition: transform 0.2s;
}
.expand-icon.open {
  transform: rotate(180deg);
}
.dv-detail-row {
  background: #fafbfc;
}
.dv-detail-row td {
  padding: 0 !important;
}
.nested-panel {
  padding: 14px 18px;
  border-top: 1px solid #e5e7eb;
  background: #fafbfc;
}
.nested-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.nested-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0;
}
.nested-count {
  background: #e5e7eb;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  margin-left: 6px;
  font-weight: 500;
}
.btn-nested-add {
  background: #f0fdf4;
  color: #166534;
  border: 1px solid #bbf7d0;
}
.btn-nested-add:hover {
  background: #dcfce7;
}
.nested-empty {
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
  padding: 16px;
}

/* Tiêu đề */
.td-item {
  margin-bottom: 8px;
}
.td-new {
  background: #fff;
  border: 1px dashed #2563eb;
  border-radius: 8px;
  padding: 8px 10px;
}
.td-form {
  padding: 6px 0;
}
.td-form-row {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.td-input {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  color: #1a1a2e;
  font-family: inherit;
  outline: none;
  transition: border 0.15s;
}
.td-input:focus {
  border-color: #6b7280;
  box-shadow: 0 0 0 2px rgba(107,114,128,0.08);
}
.td-input.td-sm {
  font-size: 11px;
  padding: 5px 8px;
}
.td-display {
  padding: 2px 0;
}
.td-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #fff;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
}
.td-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  padding: 2px;
  display: flex;
  align-items: center;
}
.td-toggle:hover {
  color: #374151;
}
.td-name {
  font-size: 13px;
  font-weight: 600;
  color: #1a1a2e;
}
.td-desc {
  font-size: 11px;
  color: #9ca3af;
  margin-left: 4px;
}

/* Nút tiêu đề / chi tiết */
.td-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-family: inherit;
  transition: all 0.12s;
  white-space: nowrap;
}
.td-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.td-btn-save {
  background: #1a1a2e;
  color: #fff;
  border-color: #1a1a2e;
}
.td-btn-save:hover:not(:disabled) {
  background: #2d2d4e;
}
.td-btn-cancel {
  background: transparent;
  color: #9ca3af;
}
.td-btn-cancel:hover {
  background: #f3f4f6;
}
.td-img-upload {
  cursor: pointer;
  background: #f9fafb;
  border: 1px dashed #d1d5db;
}
.td-img-upload:hover {
  background: #f3f4f6;
  border-color: #9ca3af;
}

/* Chi tiết section */
.ct-section {
  margin-top: 6px;
  margin-left: 20px;
  padding: 8px 10px;
  background: #f9fafb;
  border-radius: 7px;
  border: 1px solid #e5e7eb;
}
.ct-form {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.ct-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.ct-item {
  flex: 0 0 auto;
}
/* ct-display = một chip ngang gọn */
.ct-display {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 5px 8px 5px 6px;
  min-width: 0;
  max-width: 240px;
}
.ct-img-wrap {
  flex-shrink: 0;
}
.ct-img {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 5px;
  border: 1px solid #e5e7eb;
  display: block;
}
.ct-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.ct-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}
.ct-desc {
  font-size: 11px;
  color: #9ca3af;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ct-empty {
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
  padding: 10px;
}

.icon-btn-xs {
  width: 24px;
  height: 24px;
}
</style>