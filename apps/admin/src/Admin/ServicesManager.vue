<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { logActivity } from "@/utils/activityLogger";
import {
  Plus,
  Search,
  Eye,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronDown,
  ImageOff,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
} from "lucide-vue-next";

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

// ── SNACKBAR (Vuetify) ────────────────────────────────────────────
const snackbar = ref({ show: false, text: "", color: "success" });
function showToast(msg, type = "success") {
  snackbar.value.text = msg;
  snackbar.value.color = type === "success" ? "success" : "error";
  snackbar.value.show = true;
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

  if (!formObj.ctFile && !formObj.ctPreview) {
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
const isLoading = ref(false);

// ── MODAL: Tiêu đề dịch vụ ──────────────────────────────────────────
const tdModal = reactive({
  open: false,
  dvMaDv: "",
  isEdit: false,
  target: null, // reference tới object td gốc (nếu edit) để cancel khôi phục
  form: { tenTieuDe: "", moTaTieuDe: "", soThuTu: "", trangThai: 1 },
});

function openAddTieuDeModal(maDv) {
  clearTdErrors("_tdform");
  tdModal.dvMaDv = maDv;
  tdModal.isEdit = false;
  tdModal.target = null;
  tdModal.form = { tenTieuDe: "", moTaTieuDe: "", soThuTu: "", trangThai: 1 };
  tdModal.open = true;
}

function openEditTieuDeModal(td, maDv) {
  clearTdErrors("_tdform");
  tdModal.dvMaDv = maDv;
  tdModal.isEdit = true;
  tdModal.target = td;
  tdModal.form = {
    tenTieuDe: td.tenTieuDe,
    moTaTieuDe: td.moTaTieuDe,
    soThuTu: td.soThuTu,
    trangThai: td.trangThai,
  };
  tdModal.open = true;
}

function closeTdModal() {
  if (tdSaving.value) return;
  tdModal.open = false;
  clearTdErrors("_tdform");
}

async function submitTieuDeModal() {
  if (tdModal.isEdit) {
    await editTieuDe(tdModal.target.maTd, tdModal.dvMaDv, tdModal.form);
    if (!tdErrors["_tdform"]) {
      Object.assign(tdModal.target, {
        tenTieuDe: tdModal.form.tenTieuDe,
        moTaTieuDe: tdModal.form.moTaTieuDe,
        soThuTu: tdModal.form.soThuTu,
        trangThai: tdModal.form.trangThai,
      });
      tdModal.open = false;
    }
  } else {
    await saveTieuDe(tdModal.dvMaDv, tdModal.form);
    if (!tdErrors["_tdform"]) {
      tdModal.open = false;
    }
  }
}

// ── MODAL: Chi tiết tiêu đề dịch vụ ─────────────────────────────────
const ctModal = reactive({
  open: false,
  tdMaTd: "",
  tdMaDv: "",
  isEdit: false,
  target: null, // reference tới object ct gốc (nếu edit)
  form: { ctTenTieuDe: "", ctMoTaTieuDe: "", ctSoThuTu: "", ctFile: null, ctPreview: "" },
});

function openAddChiTietModal(td) {
  clearCtErrors("_ctform");
  ctModal.tdMaTd = td.maTd;
  ctModal.tdMaDv = td.maDv;
  ctModal.isEdit = false;
  ctModal.target = null;
  ctModal.form = { ctTenTieuDe: "", ctMoTaTieuDe: "", ctSoThuTu: "", ctFile: null, ctPreview: "" };
  ctModal.open = true;
}

function openEditChiTietModal(ct, tdMaTd, tdMaDv) {
  clearCtErrors("_ctform");
  ctModal.tdMaTd = tdMaTd;
  ctModal.tdMaDv = tdMaDv;
  ctModal.isEdit = true;
  ctModal.target = ct;
  ctModal.form = {
    ctTenTieuDe: ct.tenTieuDe?.trim() || "",
    ctMoTaTieuDe: ct.moTaTieuDe || "",
    ctSoThuTu: ct.soThuTu != null ? Number(ct.soThuTu) : 0,
    ctFile: null,
    ctPreview: ct.hinhAnh ? toAbsUrl(ct.hinhAnh) : "",
  };
  ctModal.open = true;
}

function closeCtModal() {
  if (tdSaving.value) return;
  ctModal.open = false;
  clearCtErrors("_ctform");
}

function onCtModalFileChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  ctModal.form.ctFile = file;
  ctModal.form.ctPreview = URL.createObjectURL(file);
}

async function submitChiTietModal() {
  if (ctModal.isEdit) {
    if (!validateChiTiet(ctModal.form)) {
      showToast("Vui lòng kiểm tra lại thông tin chi tiết!", "error");
      return;
    }
    tdSaving.value = true;
    try {
      const fd = new FormData();
      fd.append("TenTieuDe", ctModal.form.ctTenTieuDe.trim());
      fd.append("MoTaTieuDe", ctModal.form.ctMoTaTieuDe || "");
      fd.append("SoThuTu", Number(ctModal.form.ctSoThuTu) || 0);
      if (ctModal.form.ctFile) fd.append("File", ctModal.form.ctFile);

      await axios.put(`${API}/api/TieudeDichvu/chitiet/${ctModal.target.maCttd}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      showToast("Sửa chi tiết thành công!");
      await loadTieudeDichVu(ctModal.tdMaDv);
      ctModal.open = false;
    } catch (err) {
      console.error(err);
      showToast("Lỗi khi sửa chi tiết!", "error");
    } finally {
      tdSaving.value = false;
    }
  } else {
    if (!validateChiTiet(ctModal.form)) {
      showToast("Vui lòng kiểm tra lại thông tin chi tiết!", "error");
      return;
    }
    await saveChiTiet(ctModal.tdMaTd, ctModal.tdMaDv, ctModal.form);
    if (!ctErrors["_ctform"]) {
      ctModal.open = false;
    }
  }
}

async function loadDichVu() {
  isLoading.value = true;
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
      phanTramHoaHong: d.phanTramHoaHong,
      thoiGianLam: d.thoiGianLam,
      moTa: d.moTa,
      trangThai: d.trangThai,
      hinhanhs: d.hinhAnhs?.map((h) => toAbsUrl(h.duongDan)) || [],
    }));
  } catch (err) {
    console.error(err);
    showToast("Lỗi tải danh sách dịch vụ!", "error");
  } finally {
    isLoading.value = false;
  }
}

async function loadCombos() {
  isLoading.value = true;
  try {
    const res = await axios.get(`${API}/api/Combo`, {
      params: {
        keyword: search.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    const mapped = res.data.map((c) => ({
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

    // 🆕 Mã combo mới (số lớn hơn, ví dụ CB05) lên đầu, mã cũ (CB01) xuống sau
    const comboNum = (maCB) => {
      const n = parseInt(String(maCB || "").replace(/^CB/i, ""), 10);
      return isNaN(n) ? -1 : n;
    };
    mapped.sort((a, b) => comboNum(b.maCB) - comboNum(a.maCB));

    combos.value = mapped;
  } catch (err) {
    console.error(err);
    showToast("Lỗi tải danh sách combo!", "error");
  } finally {
    isLoading.value = false;
  }
}

// ── STATE ──────────────────────────────────────────────────────────
const curTab = ref("dv");
const search = ref("");
const filterCat = ref("");
const filterStatus = ref("");
const curPage = ref(1);
const editingId = ref(null);
const dvImgInput = ref(null);
const cbImgInput = ref(null);
const saving = ref(false);
const deletedImages = ref([]);

const tabs = [
  { key: "dv", label: "Dịch vụ" },
  { key: "combo", label: "Combo" },
];

const statusOptions = [
  { title: "Tất cả trạng thái", value: "" },
  { title: "Đang hoạt động", value: "1" },
  { title: "Ngừng hoạt động", value: "0" },
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
  phanTramHoaHong: "",
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
  phanTramHoaHong: "",
  thoiGianLam: "",
  moTa: "",
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

  // Mã dịch vụ được server tự sinh (DV001, DV002...) khi thêm mới, không cần validate.

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

  if (!form.maDM) {
    errors.maDM = "Vui lòng chọn danh mục.";
    ok = false;
  }

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

  if (form.phanTramHoaHong !== "" && form.phanTramHoaHong != null) {
    const pth = Number(form.phanTramHoaHong);
    if (isNaN(pth)) {
      errors.phanTramHoaHong = "% hoa hồng phải là số.";
      ok = false;
    } else if (pth < 0 || pth > 100) {
      errors.phanTramHoaHong = "% hoa hồng phải trong khoảng 0–100.";
      ok = false;
    }
  }

  if (form.moTa && form.moTa.length > 500) {
    errors.moTa = "Mô tả tối đa 500 ký tự.";
    ok = false;
  }

  return ok;
}

function validateCombo() {
  clearErrors();
  let ok = true;

  // Mã combo do server tự sinh (CB01, CB02, ...) nên không cần validate ở đây.

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

  if (!form.hinhAnh) {
    errors.hinhAnh = "Ảnh bìa combo là bắt buộc.";
    ok = false;
  }

  if (!form.dichvus.length) {
    errors.dichvus = "Vui lòng chọn ít nhất 1 dịch vụ cho combo.";
    ok = false;
  }

  if (form.moTa && form.moTa.length > 500) {
    errors.moTa = "Mô tả tối đa 500 ký tự.";
    ok = false;
  }

  return ok;
}

// ── COMPUTED ───────────────────────────────────────────────────────
const lightbox = reactive({ open: false, imgs: [], idx: 0 });
const perPage = ref(10);

const perPageOptions = [
  { title: "10 / trang", value: 10 },
  { title: "20 / trang", value: 20 },
  { title: "50 / trang", value: 50 },
  { title: "Tất cả", value: 9999 },
];

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
    return dichvus.value.filter((d) => {
      const mq =
        !q ||
        d.tenDV.toLowerCase().includes(q) ||
        d.maDV.toLowerCase().includes(q);
      const mc = !filterCat.value || d.maDM === filterCat.value;
      const ms =
        filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
      return mq && mc && ms;
    });
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
const fmtPercent = (p) =>
  p === null || p === undefined || p === "" ? "—" : Number(p) + "%";
const getDMName = (id) =>
  danhMucs.value.find((x) => x.maDM === id)?.tenDanhMuc ?? "---";
const getDV = (id) => dichvus.value.find((x) => x.maDV === id);
const getDVName = (id) => getDV(id)?.tenDV ?? id;
const dvInCombos = (id) => combos.value.filter((c) => c.dichvus.includes(id));
const discountPct = (c) =>
  c.giaGoc > 0 ? Math.round((1 - c.gia / c.giaGoc) * 100) : 0;

const catColors = ["primary", "success", "warning", "purple", "info"];
function getCatColor(maDM) {
  const idx = danhMucs.value.findIndex((x) => x.maDM === maDM);
  return catColors[idx % catColors.length] ?? "primary";
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
    const inserted =
      afterList.length > beforeCount ||
      afterList.some(
        (t) =>
          (t.tenTieuDe || "").trim() === tenTieuDe &&
          (t.moTaTieuDe || "").trim() === moTaTieuDe,
      );

    if (!inserted) {
      const apiMsg =
        res?.data?.message || res?.data?.msg || res?.data?.error || "";
      showToast(
        apiMsg ||
          "API chưa lưu tiêu đề vào cơ sở dữ liệu. Vui lòng kiểm tra backend.",
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

// ══ XÁC NHẬN XÓA (thay cho confirm() mặc định của trình duyệt) ══════
// type: "dichvu" | "combo" | "tieude" | "chitiet" — dùng chung 1 dialog
const confirmDialog = reactive({
  open: false, type: "", loading: false,
  target: null,   // đối tượng/id đang chờ xóa
  extra: null,    // tham số phụ (dvMaDv / tdMaDv để reload đúng danh sách)
});

function deleteTieuDe(maTd, dvMaDv) {
  confirmDialog.type = "tieude";
  confirmDialog.target = maTd;
  confirmDialog.extra = dvMaDv;
  confirmDialog.open = true;
}

function deleteChiTiet(maCttd, tdMaDv) {
  confirmDialog.type = "chitiet";
  confirmDialog.target = maCttd;
  confirmDialog.extra = tdMaDv;
  confirmDialog.open = true;
}

function cancelDelete() {
  confirmDialog.open = false;
  confirmDialog.target = null;
  confirmDialog.extra = null;
  confirmDialog.type = "";
}

async function confirmDelete() {
  const { type, target, extra } = confirmDialog;
  if (!target) return;
  confirmDialog.loading = true;

  try {
    if (type === "tieude") {
      await axios.delete(`${API}/api/TieudeDichvu/tieude/${target}`);
      showToast("Đã xóa tiêu đề!");
      await loadTieudeDichVu(extra);
    } else if (type === "chitiet") {
      await axios.delete(`${API}/api/TieudeDichvu/chitiet/${target}`);
      showToast("Đã xóa chi tiết!");
      await loadTieudeDichVu(extra);
    } else if (type === "dichvu") {
      const d = target;
      await axios.delete(`${API}/api/DichVu/${d.maDV}`);
      logActivity("Xóa dịch vụ", `Đã xóa dịch vụ ${d.tenDV} (Mã: ${d.maDV})`, "Dịch vụ");
      showToast(`Đã xóa dịch vụ "${d.tenDV}"`);
      await loadDichVu();
    } else if (type === "combo") {
      const c = target;
      await axios.delete(`${API}/api/Combo/${c.maCB}`);
      logActivity("Xóa combo", `Đã xóa combo ${c.tenCombo} (Mã: ${c.maCB})`, "Dịch vụ");
      showToast(`Đã xóa combo "${c.tenCombo}"`);
      await loadCombos();
    }
  } catch (err) {
    if (type === "tieude") {
      showToast("Lỗi khi xóa tiêu đề!", "error");
    } else if (type === "chitiet") {
      showToast("Lỗi khi xóa chi tiết!", "error");
    } else if (type === "dichvu") {
      const d = target;
      const msg = err.response?.data || "Lỗi khi xóa dịch vụ!";
      logActivity("Xóa dịch vụ", `Thất bại khi xóa dịch vụ ${d.tenDV} (Mã: ${d.maDV}) - Lỗi: ${err.message || ""}`, "Dịch vụ", "Thất bại");
      showToast(msg, "error");
    } else if (type === "combo") {
      const c = target;
      const msg = err.response?.data || "Lỗi khi xóa combo!";
      logActivity("Xóa combo", `Thất bại khi xóa combo ${c.tenCombo} (Mã: ${c.maCB}) - Lỗi: ${err.message || ""}`, "Dịch vụ", "Thất bại");
      showToast(msg, "error");
    }
  } finally {
    confirmDialog.loading = false;
    cancelDelete();
  }
}

// Chi tiết
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
    phanTramHoaHong: "",
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

  if (modal.mode === "formDV") {
    if (!validateDV()) return;
    saving.value = true;
    try {
      const fd = new FormData();
      // Khi sửa: gửi mã hiện có. Khi thêm mới: không gửi, server sẽ tự sinh mã (DV001, DV002...).
      if (editingId.value) {
        fd.append("MaDv", editingId.value);
      }
      fd.append("MaDm", form.maDM);
      fd.append("TenDv", form.tenDV.trim());
      fd.append("MoTa", form.moTa || "");
      fd.append("Gia", Number(form.gia));
      fd.append(
        "PhanTramHoaHong",
        form.phanTramHoaHong === "" || form.phanTramHoaHong == null
          ? ""
          : Number(form.phanTramHoaHong)
      );
      fd.append("ThoiGianLam", Number(form.thoiGianLam));
      fd.append("TrangThai", Number(form.trangThai));

      form.hinhanhs.forEach((img, i) => {
        if (img.startsWith("data:"))
          fd.append("Files", base64ToFile(img, `image_${i}.png`));
      });
      deletedImages.value.forEach((img) => fd.append("DeletedImages", img));
      if (editingId.value) {
        await axios.put(`${API}/api/DichVu/${editingId.value}`, fd);
        logActivity(
          "Cập nhật dịch vụ",
          `Đã cập nhật thông tin dịch vụ ${form.tenDV} (Mã: ${editingId.value})`,
          "Dịch vụ",
        );
        showToast("Cập nhật dịch vụ thành công!");
      } else {
        const res = await axios.post(`${API}/api/DichVu`, fd);
        const newMaDv = res.data?.maDv || "";
        logActivity(
          "Thêm dịch vụ",
          `Đã thêm dịch vụ mới ${form.tenDV} (Mã: ${newMaDv})`,
          "Dịch vụ",
        );
        showToast("Thêm dịch vụ thành công!");
      }
      deletedImages.value = [];
      await loadDichVu();
      closeModal();
    } catch (err) {
      console.error("DichVu save error:", err.response?.data);
      logActivity(
        editingId.value ? "Cập nhật dịch vụ" : "Thêm dịch vụ",
        `Thất bại khi ${editingId.value ? "cập nhật" : "thêm"} dịch vụ ${form.tenDV} - Lỗi: ${err.message || ""}`,
        "Dịch vụ",
        "Thất bại",
      );
      showToast("Lỗi khi lưu dịch vụ!", "error");
    } finally {
      saving.value = false;
    }
    return;
  }

  if (modal.mode === "formCombo") {
    if (!validateCombo()) return;
    saving.value = true;
    try {
      const fd = new FormData();
      // Khi sửa: gửi mã hiện có. Khi thêm mới: không gửi, server sẽ tự sinh mã (CB01, CB02...).
      if (editingId.value) {
        fd.append("MaCB", editingId.value);
      }
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
        logActivity(
          "Cập nhật combo",
          `Đã cập nhật thông tin combo ${form.tenCombo} (Mã: ${editingId.value})`,
          "Dịch vụ",
        );
        showToast("Cập nhật combo thành công!");
      } else {
        const res = await axios.post(`${API}/api/Combo`, fd);
        const newMaCb = res.data?.maCb || res.data?.MaCb || "";
        logActivity(
          "Thêm combo",
          `Đã thêm combo mới ${form.tenCombo} (Mã: ${newMaCb})`,
          "Dịch vụ",
        );
        showToast("Thêm combo thành công!");
      }
      await loadCombos();
      closeModal();
    } catch (err) {
      console.error("Combo save error:", err.response?.data);
      logActivity(
        editingId.value ? "Cập nhật combo" : "Thêm combo",
        `Thất bại khi ${editingId.value ? "cập nhật" : "thêm"} combo ${form.tenCombo} - Lỗi: ${err.message || ""}`,
        "Dịch vụ",
        "Thất bại",
      );
      showToast("Lỗi khi lưu combo!", "error");
    } finally {
      saving.value = false;
    }
  }
}

// ── DELETE ─────────────────────────────────────────────────────────
function delDV(d) {
  confirmDialog.type = "dichvu";
  confirmDialog.target = d;
  confirmDialog.extra = null;
  confirmDialog.open = true;
}

function delCombo(c) {
  confirmDialog.type = "combo";
  confirmDialog.target = c;
  confirmDialog.extra = null;
  confirmDialog.open = true;
}

function toggleDV(id) {
  const i = form.dichvus.indexOf(id);
  i === -1 ? form.dichvus.push(id) : form.dichvus.splice(i, 1);
  if (errors.dichvus) errors.dichvus = "";
}

// ── INIT ───────────────────────────────────────────────────────────
onMounted(async () => {
  await loadDanhMuc();
  await loadDichVu();
  await loadCombos();
});
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <!-- ── STATS ───────────────────────────────────────────────── -->
    <v-row class="mb-2">
      <v-col cols="6" md="3">
        <v-card rounded="xl" elevation="1" class="pa-4">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Tổng dịch vụ</div>
          <div class="text-h4 font-weight-bold mt-1">{{ dichvus.length }}</div>
          <div class="text-caption text-medium-emphasis mt-1">
            {{ dichvus.filter((d) => d.trangThai).length }} đang hoạt động
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card rounded="xl" elevation="1" class="pa-4">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Tổng combo</div>
          <div class="text-h4 font-weight-bold mt-1">{{ combos.length }}</div>
          <div class="text-caption text-medium-emphasis mt-1">
            {{ combos.filter((c) => c.trangThai).length }} đang hoạt động
          </div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card rounded="xl" elevation="1" class="pa-4">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Giá trung bình</div>
          <div class="text-h5 font-weight-bold mt-1">{{ fmt(avgPrice) }}</div>
          <div class="text-caption text-medium-emphasis mt-1">Dịch vụ đơn lẻ</div>
        </v-card>
      </v-col>
      <v-col cols="6" md="3">
        <v-card rounded="xl" elevation="1" class="pa-4">
          <div class="text-caption text-medium-emphasis font-weight-medium text-uppercase">Tổng tiết kiệm combo</div>
          <div class="text-h5 font-weight-bold mt-1">{{ fmt(totalSavings) }}</div>
          <div class="text-caption text-medium-emphasis mt-1">Khách hàng được giảm</div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ── MAIN CARD ───────────────────────────────────────────── -->
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div class="d-flex align-center gap-2">
          <v-btn-toggle
            v-model="curTab"
            mandatory
            rounded="lg"
            color="primary"
            density="comfortable"
            @update:model-value="switchTab"
          >
            <v-btn v-for="tab in tabs" :key="tab.key" :value="tab.key" class="text-none font-weight-bold">
              {{ tab.label }}
              <v-chip size="x-small" class="ml-2" variant="tonal">
                {{ tab.key === "dv" ? dichvus.length : combos.length }}
              </v-chip>
            </v-btn>
          </v-btn-toggle>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openModal()"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            {{ curTab === "dv" ? "Thêm dịch vụ" : "Thêm combo" }}
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- ── TOOLBAR ─────────────────────────────────────────────── -->
      <v-card-text class="pb-0">
        <div class="d-flex align-center gap-3 flex-wrap mb-2">
          <v-text-field
            v-model="search"
            label="Tìm kiếm..."
            variant="outlined"
            density="compact"
            hide-details
            clearable
            rounded="lg"
            class="flex-grow-1"
            style="min-width: 220px;"
            @keyup.enter="onFilterChange"
            @update:model-value="curPage = 1"
          >
            <template v-slot:prepend-inner>
              <Search class="w-5 h-5 text-grey-darken-1" />
            </template>
          </v-text-field>

          <v-select
            v-if="curTab === 'dv'"
            v-model="filterCat"
            :items="[{ title: 'Tất cả danh mục', value: '' }, ...danhMucs.map(dm => ({ title: dm.tenDanhMuc, value: dm.maDM }))]"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="min-width: 180px; max-width: 220px;"
            @update:model-value="onFilterChange"
          ></v-select>

          <v-select
            v-model="filterStatus"
            :items="statusOptions"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="min-width: 170px; max-width: 200px;"
            @update:model-value="onFilterChange"
          ></v-select>

          <v-select
            v-model="perPage"
            :items="perPageOptions"
            variant="outlined"
            density="compact"
            hide-details
            rounded="lg"
            style="min-width: 130px; max-width: 150px;"
            @update:model-value="curPage = 1"
          ></v-select>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="onFilterChange">
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <span class="text-caption text-medium-emphasis">{{ filteredData.length }} kết quả</span>
        </div>
      </v-card-text>

      <!-- ── TABLE: Dịch vụ ──────────────────────────────────────── -->
      <div v-if="curTab === 'dv'">
        <v-table hover>
          <thead>
            <tr>
              <th style="width: 56px">Ảnh</th>
              <th style="width: 40px"></th>
              <th>Mã DV</th>
              <th>Tên dịch vụ</th>
              <th>Danh mục</th>
              <th>Giá</th>
              <th>Thời gian</th>
              <th>Hoa hồng</th>
              <th>Trạng thái</th>
              <th class="text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="pageData.length === 0">
              <td colspan="10">
                <div class="text-center py-8 text-medium-emphasis">
                  <Search class="w-8 h-8 mx-auto mb-2" />
                  <div>Không tìm thấy dịch vụ nào</div>
                </div>
              </td>
            </tr>
            <template v-for="d in pageData" :key="d.maDV">
              <tr :class="{ 'bg-grey-lighten-4': isExpanded(d.maDV) }">
                <td>
                  <div
                    class="position-relative"
                    style="width: 40px; height: 40px; cursor: pointer;"
                    @click="d.hinhanhs?.length && openLightbox(d.hinhanhs, 0)"
                  >
                    <v-img
                      v-if="d.hinhanhs?.length"
                      :src="d.hinhanhs[0]"
                      width="40"
                      height="40"
                      rounded="lg"
                      cover
                    ></v-img>
                    <div
                      v-else
                      class="d-flex align-center justify-center bg-grey-lighten-3 rounded-lg"
                      style="width: 40px; height: 40px;"
                    >
                      <ImageOff class="w-4 h-4 text-grey" />
                    </div>
                    <v-chip
                      v-if="d.hinhanhs?.length > 1"
                      size="x-small"
                      color="black"
                      class="position-absolute"
                      style="bottom: -4px; right: -4px; font-size: 9px; height: 16px; padding: 0 4px;"
                    >+{{ d.hinhanhs.length - 1 }}</v-chip>
                  </div>
                </td>
                <td>
                  <v-btn
                    icon
                    variant="text"
                    size="small"
                    :title="isExpanded(d.maDV) ? 'Thu gọn' : 'Mở tiêu đề & chi tiết'"
                    @click="toggleExpand(d.maDV)"
                  >
                    <ChevronDown class="w-4 h-4" :style="{ transform: isExpanded(d.maDV) ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }" />
                  </v-btn>
                </td>
                <td><span class="font-mono text-caption">{{ d.maDV }}</span></td>
                <td>
                  <div class="font-weight-medium">{{ d.tenDV }}</div>
                  <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 220px;">{{ d.moTa }}</div>
                </td>
                <td>
                  <v-chip :color="getCatColor(d.maDM)" size="small" variant="tonal" class="font-weight-medium">
                    {{ getDMName(d.maDM) }}
                  </v-chip>
                </td>
                <td class="font-weight-bold">{{ fmt(d.gia) }}</td>
                <td>{{ fmtMin(d.thoiGianLam) }}</td>
                <td>{{ fmtPercent(d.phanTramHoaHong) }}</td>
                <td>
                  <v-chip
                    :color="d.trangThai ? 'success' : 'grey'"
                    size="small"
                    variant="flat"
                    class="font-weight-bold"
                  >{{ d.trangThai ? "Hoạt động" : "Ngừng" }}</v-chip>
                </td>
                <td>
                  <div class="d-flex align-center justify-center gap-1">
                    <v-btn icon variant="text" size="small" title="Xem chi tiết" @click="viewDV(d)">
                      <Eye class="w-4 h-4" />
                    </v-btn>
                    <v-btn icon variant="text" size="small" title="Chỉnh sửa" color="primary" @click="editDV(d)">
                      <Pencil class="w-4 h-4" />
                    </v-btn>
                    <v-btn icon variant="text" size="small" title="Xóa" color="error" @click="delDV(d)">
                      <Trash2 class="w-4 h-4" />
                    </v-btn>
                  </div>
                </td>
              </tr>

              <!-- Expanded row: Tiêu đề + Chi tiết -->
              <tr v-if="isExpanded(d.maDV)">
                <td colspan="10" class="pa-0 bg-grey-lighten-5">
                  <div class="pa-4">
                    <div class="d-flex align-center justify-space-between mb-3">
                      <div class="text-subtitle-2 font-weight-bold">
                        Tiêu đề dịch vụ
                        <v-chip size="x-small" class="ml-1">{{ tieudes.filter((t) => sameMaDv(t.maDv, d.maDV)).length }}</v-chip>
                      </div>
                      <v-btn size="small" color="success" variant="tonal" class="text-none font-weight-bold" @click="openAddTieuDeModal(d.maDV)">
                        <template v-slot:prepend><Plus class="w-4 h-4" /></template>
                        Thêm tiêu đề
                      </v-btn>
                    </div>

                    <div
                      v-if="!tieudes.filter((t) => sameMaDv(t.maDv, d.maDV)).length"
                      class="text-caption text-medium-emphasis text-center py-4"
                    >
                      Chưa có tiêu đề. Nhấn "Thêm tiêu đề" để bắt đầu.
                    </div>

                    <!-- Tiêu đề items -->
                    <v-card
                      v-for="td in tieudes.filter((t) => sameMaDv(t.maDv, d.maDV))"
                      :key="td.maTd"
                      class="mb-2"
                      variant="outlined"
                      rounded="lg"
                    >
                      <v-card-text class="pa-3 d-flex align-center gap-2">
                        <v-btn icon variant="text" size="x-small" @click="toggleTitleExpand(td.maTd)">
                          <ChevronDown class="w-4 h-4" :style="{ transform: isTitleExpanded(td.maTd) ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }" />
                        </v-btn>
                        <span class="font-weight-bold text-body-2">{{ td.tenTieuDe }}</span>
                        <span v-if="td.moTaTieuDe" class="text-caption text-medium-emphasis">{{ td.moTaTieuDe }}</span>
                        <v-chip size="x-small" :color="td.trangThai ? 'success' : 'grey'" variant="flat">
                          {{ td.trangThai ? "Hoạt động" : "Ngừng" }}
                        </v-chip>
                        <v-spacer></v-spacer>
                        <v-btn
                          icon
                          variant="text"
                          size="x-small"
                          title="Sửa tiêu đề"
                          @click.stop="openEditTieuDeModal(td, d.maDV)"
                        >
                          <Pencil class="w-3.5 h-3.5" />
                        </v-btn>
                        <v-btn
                          icon
                          variant="text"
                          size="x-small"
                          color="error"
                          title="Xóa tiêu đề"
                          @click.stop="deleteTieuDe(td.maTd, d.maDV)"
                        >
                          <Trash2 class="w-3.5 h-3.5" />
                        </v-btn>
                      </v-card-text>

                      <!-- Chi tiết section -->
                      <v-card-text v-if="isTitleExpanded(td.maTd)" class="pt-0 pb-3 px-3 ml-8">
                        <v-sheet rounded="lg" color="grey-lighten-5" class="pa-3">
                          <div class="d-flex align-center justify-space-between mb-3">
                            <span class="text-caption font-weight-bold text-medium-emphasis">CHI TIẾT</span>
                            <v-btn size="small" color="primary" variant="tonal" class="text-none font-weight-bold" @click="openAddChiTietModal(td)">
                              <template v-slot:prepend><Plus class="w-4 h-4" /></template>
                              Thêm chi tiết
                            </v-btn>
                          </div>

                          <div v-if="td.chiTiet && td.chiTiet.length" class="d-flex flex-wrap gap-2">
                            <v-sheet
                              v-for="ct in td.chiTiet"
                              :key="ct.maCttd"
                              rounded="lg"
                              border
                              class="pa-2 d-flex align-center gap-2"
                              style="max-width: 240px;"
                            >
                              <v-img
                                v-if="ct.hinhAnh"
                                :src="toAbsUrl(ct.hinhAnh)"
                                width="36"
                                height="36"
                                rounded="lg"
                                cover
                              ></v-img>
                              <div class="flex-grow-1 overflow-hidden">
                                <div class="text-caption font-weight-medium text-truncate">{{ ct.tenTieuDe }}</div>
                                <div v-if="ct.moTaTieuDe" class="text-caption text-medium-emphasis text-truncate">{{ ct.moTaTieuDe }}</div>
                              </div>
                              <v-btn
                                icon
                                variant="text"
                                size="x-small"
                                @click.stop="openEditChiTietModal(ct, td.maTd, td.maDv)"
                              >
                                <Pencil class="w-3.5 h-3.5" />
                              </v-btn>
                              <v-btn
                                icon
                                variant="text"
                                size="x-small"
                                color="error"
                                @click.stop="deleteChiTiet(ct.maCttd, td.maDv)"
                              >
                                <Trash2 class="w-3.5 h-3.5" />
                              </v-btn>
                            </v-sheet>
                          </div>
                          <div v-else class="text-caption text-medium-emphasis text-center py-2">
                            Chưa có chi tiết nào. Nhấn "Thêm chi tiết" để thêm.
                          </div>
                        </v-sheet>
                      </v-card-text>
                    </v-card>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </v-table>

        <div v-if="filteredData.length > 0 && perPage < 9999" class="d-flex align-center justify-space-between pa-4 flex-wrap gap-2">
          <span class="text-caption text-medium-emphasis">
            Hiển thị {{ (curPage - 1) * perPage + 1 }}–{{ Math.min(curPage * perPage, filteredData.length) }}
            / {{ filteredData.length }} mục
          </span>
          <v-pagination
            v-model="curPage"
            :length="totalPages"
            :total-visible="5"
            density="comfortable"
            rounded="lg"
          ></v-pagination>
        </div>
      </div>

      <!-- ── GRID: Combo ─────────────────────────────────────────── -->
      <div v-else class="pa-4">
        <v-row v-if="pageData.length === 0">
          <v-col cols="12" class="text-center py-8 text-medium-emphasis">
            <div>Không tìm thấy combo nào</div>
          </v-col>
        </v-row>
        <v-row v-else>
          <v-col v-for="c in pageData" :key="c.maCB" cols="12" sm="6" md="4" lg="3">
            <v-card
              rounded="xl"
              elevation="1"
              :class="{ 'opacity-60': !c.trangThai }"
              height="100%"
              class="d-flex flex-column"
            >
              <div class="position-relative">
                <v-img
                  v-if="c.hinhAnh"
                  :src="c.hinhAnh"
                  height="150"
                  cover
                  style="cursor: pointer;"
                  @click="openLightbox([c.hinhAnh], 0)"
                ></v-img>
                <div
                  v-else
                  class="d-flex align-center justify-center"
                  style="height: 150px; background: linear-gradient(135deg, #f8fafc, #f1f5f9);"
                >
                  <span style="font-size: 40px;">{{ c.icon }}</span>
                </div>
                <v-chip
                  v-if="discountPct(c) > 0"
                  color="error"
                  size="small"
                  class="position-absolute font-weight-bold"
                  style="top: 8px; right: 8px;"
                >-{{ discountPct(c) }}%</v-chip>
                <v-chip
                  v-if="!c.trangThai"
                  color="grey-darken-2"
                  size="small"
                  class="position-absolute font-weight-bold"
                  style="top: 8px; left: 8px;"
                >Ngừng HĐ</v-chip>
              </div>
              <v-card-text class="flex-grow-1">
                <div class="text-caption text-medium-emphasis font-mono">{{ c.maCB }}</div>
                <div class="text-subtitle-1 font-weight-bold">{{ c.tenCombo }}</div>
                <div class="text-caption text-medium-emphasis text-truncate">{{ c.moTa }}</div>
                <div class="d-flex flex-wrap gap-1 mt-2">
                  <v-chip v-for="id in c.dichvus" :key="id" size="x-small" variant="tonal">{{ getDVName(id) }}</v-chip>
                </div>
              </v-card-text>
              <v-divider></v-divider>
              <v-card-actions class="px-4 py-3">
                <div>
                  <div class="text-h6 font-weight-bold text-primary">{{ fmt(c.gia) }}</div>
                  <div v-if="c.giaGoc > c.gia" class="text-caption text-medium-emphasis" style="text-decoration: line-through;">{{ fmt(c.giaGoc) }}</div>
                  <div v-if="c.giaGoc > c.gia" class="text-caption text-success">Tiết kiệm {{ fmt(c.giaGoc - c.gia) }}</div>
                </div>
                <v-spacer></v-spacer>
                <v-btn icon variant="text" size="small" title="Xem" @click="viewCombo(c)"><Eye class="w-4 h-4" /></v-btn>
                <v-btn icon variant="text" size="small" color="primary" title="Sửa" @click="editCombo(c)"><Pencil class="w-4 h-4" /></v-btn>
                <v-btn icon variant="text" size="small" color="error" title="Xóa" @click="delCombo(c)"><Trash2 class="w-4 h-4" /></v-btn>
              </v-card-actions>
            </v-card>
          </v-col>
        </v-row>

        <div v-if="filteredData.length > 0 && perPage < 9999" class="d-flex align-center justify-space-between pa-4 flex-wrap gap-2">
          <span class="text-caption text-medium-emphasis">
            Hiển thị {{ (curPage - 1) * perPage + 1 }}–{{ Math.min(curPage * perPage, filteredData.length) }}
            / {{ filteredData.length }} mục
          </span>
          <v-pagination
            v-model="curPage"
            :length="totalPages"
            :total-visible="5"
            density="comfortable"
            rounded="lg"
          ></v-pagination>
        </div>
      </div>
    </v-card>

    <!-- ── LIGHTBOX ────────────────────────────────────────────── -->
    <!-- ══ DIALOG XÁC NHẬN XÓA (dùng chung: dịch vụ / combo / tiêu đề / chi tiết) ══ -->
    <v-dialog v-model="confirmDialog.open" max-width="420" persistent>
      <v-card rounded="lg">
        <v-card-item class="pa-5 pb-0">
          <div class="d-flex align-center gap-3">
            <v-avatar color="error" variant="tonal" size="42">
              <Trash2 class="w-5 h-5" />
            </v-avatar>
            <div class="text-subtitle-1 font-weight-bold">
              <template v-if="confirmDialog.type === 'combo'">Xóa combo?</template>
              <template v-else-if="confirmDialog.type === 'tieude'">Xóa tiêu đề?</template>
              <template v-else-if="confirmDialog.type === 'chitiet'">Xóa chi tiết?</template>
              <template v-else>Xóa dịch vụ?</template>
            </div>
          </div>
        </v-card-item>
        <v-card-text class="pa-5 pt-3">
          <template v-if="confirmDialog.type === 'combo'">
            Bạn có chắc muốn xóa combo
            <strong>"{{ confirmDialog.target?.tenCombo }}"</strong>?
          </template>
          <template v-else-if="confirmDialog.type === 'tieude'">
            Bạn có chắc muốn xóa tiêu đề này?
            <br />
            <span class="text-caption text-medium-emphasis">Tất cả chi tiết bên trong cũng sẽ bị xóa.</span>
          </template>
          <template v-else-if="confirmDialog.type === 'chitiet'">
            Bạn có chắc muốn xóa chi tiết này?
          </template>
          <template v-else>
            Bạn có chắc muốn xóa dịch vụ
            <strong>"{{ confirmDialog.target?.tenDV }}"</strong>?
            <br />
            <span class="text-caption text-medium-emphasis">Dịch vụ sẽ bị xóa khỏi tất cả combo liên quan.</span>
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
      <div class="position-relative d-flex align-center justify-center" style="background: rgba(0,0,0,0.9); min-height: 60vh; border-radius: 12px;">
        <v-btn icon variant="text" color="white" class="position-absolute" style="top: 12px; right: 12px; z-index: 2;" @click="lightbox.open = false">
          <X class="w-5 h-5" />
        </v-btn>
        <v-btn
          v-if="lightbox.imgs.length > 1"
          icon
          variant="text"
          color="white"
          class="position-absolute"
          style="left: 12px; z-index: 2;"
          @click="lbPrev"
        >
          <ChevronLeft class="w-6 h-6" />
        </v-btn>
        <img :src="lightbox.imgs[lightbox.idx]" style="max-width: 100%; max-height: 80vh; object-fit: contain;" />
        <v-btn
          v-if="lightbox.imgs.length > 1"
          icon
          variant="text"
          color="white"
          class="position-absolute"
          style="right: 12px; z-index: 2;"
          @click="lbNext"
        >
          <ChevronRight class="w-6 h-6" />
        </v-btn>
        <div v-if="lightbox.imgs.length > 1" class="position-absolute d-flex gap-1" style="bottom: 12px; left: 50%; transform: translateX(-50%);">
          <span
            v-for="(_, i) in lightbox.imgs"
            :key="i"
            style="width: 8px; height: 8px; border-radius: 50%; cursor: pointer;"
            :style="{ background: i === lightbox.idx ? '#fff' : 'rgba(255,255,255,0.4)' }"
            @click="lightbox.idx = i"
          ></span>
        </div>
      </div>
    </v-dialog>

    <!-- ── MODAL ───────────────────────────────────────────────── -->
    <v-dialog v-model="modal.open" :max-width="modal.mode === 'formDV' || modal.mode === 'formCombo' ? 700 : 560" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">{{ modal.title }}</div>
          <v-btn icon variant="text" size="small" @click="closeModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6" style="max-height: 70vh;">
          <!-- ── VIEW DV ── -->
          <div v-if="modal.mode === 'viewDV'">
            <div v-if="modal.data.hinhanhs?.length" class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Hình ảnh ({{ modal.data.hinhanhs.length }})</div>
              <div class="d-flex flex-wrap gap-2">
                <v-img
                  v-for="(src, i) in modal.data.hinhanhs"
                  :key="i"
                  :src="src"
                  width="72"
                  height="72"
                  rounded="lg"
                  cover
                  style="cursor: pointer;"
                  @click="openLightbox(modal.data.hinhanhs, i)"
                ></v-img>
              </div>
            </div>
            <div v-else class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Hình ảnh</div>
              <div class="text-caption text-medium-emphasis">Chưa có hình ảnh</div>
            </div>

            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Thông tin cơ bản</div>
              <v-row dense>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Mã dịch vụ</div>
                  <div class="font-weight-medium">{{ modal.data.maDV }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Danh mục</div>
                  <v-chip :color="getCatColor(modal.data.maDM)" size="small" variant="tonal">{{ getDMName(modal.data.maDM) }}</v-chip>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Giá</div>
                  <div class="font-weight-bold">{{ fmt(modal.data.gia) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Thời gian</div>
                  <div class="font-weight-medium">{{ fmtMin(modal.data.thoiGianLam) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Hoa hồng NV</div>
                  <div class="font-weight-medium">{{ fmtPercent(modal.data.phanTramHoaHong) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Trạng thái</div>
                  <v-chip :color="modal.data.trangThai ? 'success' : 'grey'" size="small" variant="flat">
                    {{ modal.data.trangThai ? "Hoạt động" : "Ngừng" }}
                  </v-chip>
                </v-col>
              </v-row>
            </div>

            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Tên &amp; mô tả</div>
              <div class="text-body-1 font-weight-bold mb-1">{{ modal.data.tenDV }}</div>
              <div class="text-body-2 text-medium-emphasis">{{ modal.data.moTa }}</div>
            </div>

            <div v-if="dvInCombos(modal.data.maDV).length">
              <div class="text-subtitle-2 font-weight-bold mb-2">Có trong {{ dvInCombos(modal.data.maDV).length }} combo</div>
              <div v-for="c in dvInCombos(modal.data.maDV)" :key="c.maCB" class="d-flex justify-space-between py-1 border-b">
                <span>{{ c.tenCombo }}</span>
                <span class="font-weight-medium">{{ fmt(c.gia) }}</span>
              </div>
            </div>
          </div>

          <!-- ── VIEW COMBO ── -->
          <div v-else-if="modal.mode === 'viewCombo'">
            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Ảnh bìa</div>
              <v-img
                v-if="modal.data.hinhAnh"
                :src="modal.data.hinhAnh"
                height="150"
                rounded="lg"
                cover
                style="cursor: pointer;"
                @click="openLightbox([modal.data.hinhAnh], 0)"
              ></v-img>
              <div
                v-else
                class="d-flex align-center justify-center rounded-lg"
                style="height: 140px; background: linear-gradient(135deg, #f8fafc, #f1f5f9);"
              >
                <span style="font-size: 40px;">{{ modal.data.icon }}</span>
              </div>
            </div>

            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Thông tin combo</div>
              <v-row dense>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Mã combo</div>
                  <div class="font-weight-medium">{{ modal.data.maCB }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Trạng thái</div>
                  <v-chip :color="modal.data.trangThai ? 'success' : 'grey'" size="small" variant="flat">
                    {{ modal.data.trangThai ? "Hoạt động" : "Ngừng" }}
                  </v-chip>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Giá combo</div>
                  <div class="font-weight-bold">{{ fmt(modal.data.gia) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Giá gốc (tổng DV)</div>
                  <div class="text-medium-emphasis" style="text-decoration: line-through;">{{ fmt(modal.data.giaGoc) }}</div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Tiết kiệm</div>
                  <div class="text-success font-weight-medium">
                    {{ fmt(modal.data.giaGoc - modal.data.gia) }} (-{{ discountPct(modal.data) }}%)
                  </div>
                </v-col>
                <v-col cols="6">
                  <div class="text-caption text-medium-emphasis">Số dịch vụ</div>
                  <div class="font-weight-medium">{{ modal.data.dichvus.length }} dịch vụ</div>
                </v-col>
              </v-row>
            </div>

            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-bold mb-2">Mô tả</div>
              <div class="text-body-2 text-medium-emphasis">{{ modal.data.moTa }}</div>
            </div>

            <div>
              <div class="text-subtitle-2 font-weight-bold mb-2">Dịch vụ bao gồm</div>
              <div v-for="id in modal.data.dichvus" :key="id">
                <div v-if="getDV(id)" class="d-flex justify-space-between align-center py-2 border-b">
                  <div>
                    <div class="text-body-2 font-weight-medium">{{ getDV(id).tenDV }}</div>
                    <div class="text-caption text-medium-emphasis">{{ fmtMin(getDV(id).thoiGianLam) }}</div>
                  </div>
                  <span class="text-medium-emphasis text-body-2">{{ fmt(getDV(id).gia) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- ── FORM DV ── -->
          <v-form v-else-if="modal.mode === 'formDV'" @submit.prevent="saveItem">
            <v-row dense>
              <!-- <v-col cols="12" sm="6" v-if="editingId">
                <v-text-field
                  v-model="form.maDV"
                  label="Mã dịch vụ"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  hint="Mã dịch vụ được hệ thống tự sinh, không thể chỉnh sửa."
                  persistent-hint
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6" v-else>
                <v-text-field
                  label="Mã dịch vụ"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  model-value="Tự động tạo (DV001, DV002...)"
                  hint="Mã dịch vụ sẽ được hệ thống tự động cấp khi lưu."
                  persistent-hint
                ></v-text-field>
              </v-col> -->
              <v-col cols="12" sm="6">
                <v-select
                  v-model="form.maDM"
                  :items="danhMucs.map(dm => ({ title: dm.tenDanhMuc, value: dm.maDM }))"
                  label="Danh mục *"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  :error-messages="errors.maDM"
                  @update:model-value="errors.maDM = ''"
                ></v-select>
              </v-col>
            </v-row>

            <v-text-field
              v-model="form.tenDV"
              label="Tên dịch vụ *"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="Nhập tên dịch vụ..."
              :error-messages="errors.tenDV"
              @update:model-value="errors.tenDV = ''"
            ></v-text-field>

            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.gia"
                  label="Giá (VNĐ) *"
                  type="number"
                  min="0"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="0"
                  :error-messages="errors.gia"
                  @update:model-value="errors.gia = ''"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.thoiGianLam"
                  label="Thời gian (phút) *"
                  type="number"
                  min="1"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="30"
                  :error-messages="errors.thoiGianLam"
                  @update:model-value="errors.thoiGianLam = ''"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-text-field
              v-model="form.phanTramHoaHong"
              label="% Hoa hồng nhân viên"
              hint="Để trống nếu không áp dụng"
              persistent-hint
              type="number"
              min="0"
              max="100"
              step="0.1"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              style="max-width: 220px;"
              placeholder="0"
              :error-messages="errors.phanTramHoaHong"
              @update:model-value="errors.phanTramHoaHong = ''"
              class="mb-2"
            ></v-text-field>

            <v-textarea
              v-model="form.moTa"
              label="Mô tả"
              hint="Tối đa 500 ký tự"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="Mô tả ngắn về dịch vụ..."
              :counter="500"
              :error-messages="errors.moTa"
              @update:model-value="errors.moTa = ''"
              class="mb-2"
            ></v-textarea>

            <!-- MULTI IMAGE -->
            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-medium mb-1">
                Hình ảnh dịch vụ
                <span class="text-caption text-medium-emphasis">— tối đa 10 ảnh, mỗi ảnh ≤ 5MB. Ảnh đầu tiên là ảnh chính.</span>
              </div>
              <div
                v-if="!form.hinhanhs.length"
                class="d-flex flex-column align-center justify-center pa-6 rounded-lg"
                style="border: 2px dashed #ccc; cursor: pointer;"
                @click="dvImgInput?.click()"
                @dragover.prevent
                @drop.prevent="onDropDV"
              >
                <input ref="dvImgInput" type="file" accept="image/*" multiple style="display: none" @change="onDVImgChange" />
                <Upload class="w-7 h-7 text-medium-emphasis mb-2" />
                <div class="text-body-2">Kéo thả hoặc <span class="text-primary font-weight-medium">chọn ảnh</span></div>
                <div class="text-caption text-medium-emphasis">PNG, JPG, WEBP</div>
              </div>
              <div v-else>
                <input ref="dvImgInput" type="file" accept="image/*" multiple style="display: none" @change="onDVImgChange" />
                <div class="d-flex flex-wrap gap-2">
                  <div v-for="(src, i) in form.hinhanhs" :key="i" class="position-relative">
                    <v-img :src="src" width="80" height="80" rounded="lg" cover style="cursor: pointer;" @click="openLightbox(form.hinhanhs, i)"></v-img>
                    <v-btn icon size="x-small" color="error" class="position-absolute" style="top: -6px; right: -6px;" @click.stop="removeDVImg(i)">
                      <X class="w-3 h-3" />
                    </v-btn>
                    <v-chip v-if="i === 0" size="x-small" color="primary" class="position-absolute" style="bottom: 2px; left: 2px; font-size: 9px;">Ảnh chính</v-chip>
                    <v-btn v-if="i > 0" icon size="x-small" variant="flat" class="position-absolute" style="top: 50%; left: -6px; transform: translateY(-50%);" title="Đặt làm trước" @click.stop="moveDVImg(i, -1)">
                      <ChevronLeft class="w-3 h-3" />
                    </v-btn>
                  </div>
                  <div
                    v-if="form.hinhanhs.length < 10"
                    class="d-flex flex-column align-center justify-center rounded-lg"
                    style="width: 80px; height: 80px; border: 2px dashed #ccc; cursor: pointer;"
                    @click="dvImgInput?.click()"
                  >
                    <Plus class="w-5 h-5 text-medium-emphasis" />
                    <span class="text-caption text-medium-emphasis">Thêm</span>
                  </div>
                </div>
              </div>
            </div>

            <v-select
              v-model.number="form.trangThai"
              :items="[{ title: 'Hoạt động', value: 1 }, { title: 'Ngừng hoạt động', value: 0 }]"
              label="Trạng thái"
              variant="outlined"
              density="comfortable"
              rounded="lg"
            ></v-select>
          </v-form>

          <!-- ── FORM COMBO ── -->
          <v-form v-else-if="modal.mode === 'formCombo'" @submit.prevent="saveItem">
            <v-row dense>
              <!-- <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="editingId ? form.maCB : 'Tự động sinh mã'"
                  label="Mã combo"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  disabled
                  hint="Mã combo được hệ thống tự động sinh (CB01, CB02, ...)"
                  persistent-hint
                ></v-text-field>
              </v-col> -->
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.tenCombo"
                  label="Tên combo *"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="Nhập tên combo..."
                  :error-messages="errors.tenCombo"
                  @update:model-value="errors.tenCombo = ''"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-row dense>
              <v-col cols="12" sm="6">
                <v-text-field
                  v-model="form.gia"
                  label="Giá combo (VNĐ) *"
                  type="number"
                  min="0"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="0"
                  :error-messages="errors.giaCombo"
                  @update:model-value="errors.giaCombo = ''"
                ></v-text-field>
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field
                  :model-value="form.dichvus.length ? fmt(form.dichvus.reduce((s, id) => s + (getDV(id)?.gia || 0), 0)) : '—'"
                  label="Giá gốc (tự tính từ tổng dịch vụ)"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  readonly
                  bg-color="grey-lighten-4"
                ></v-text-field>
              </v-col>
            </v-row>

            <v-textarea
              v-model="form.moTa"
              label="Mô tả"
              hint="Tối đa 500 ký tự"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="Mô tả combo..."
              :counter="500"
              :error-messages="errors.moTa"
              @update:model-value="errors.moTa = ''"
              class="mb-2"
            ></v-textarea>

            <!-- SINGLE IMAGE -->
            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-medium mb-1">
                Ảnh bìa combo *
                <span class="text-caption text-medium-emphasis">— 1 ảnh duy nhất, ≤ 5MB</span>
              </div>
              <input ref="cbImgInput" type="file" accept="image/*" style="display: none" @change="onCBImgChange" />
              <div
                v-if="!form.hinhAnh"
                class="d-flex flex-column align-center justify-center pa-6 rounded-lg"
                :style="{ border: errors.hinhAnh ? '2px dashed #f44336' : '2px dashed #ccc', cursor: 'pointer' }"
                @click="cbImgInput?.click()"
                @dragover.prevent
                @drop.prevent="onDropCB"
              >
                <Upload class="w-7 h-7 text-medium-emphasis mb-2" />
                <div class="text-body-2">Kéo thả hoặc <span class="text-primary font-weight-medium">chọn ảnh bìa</span></div>
                <div class="text-caption text-medium-emphasis">PNG, JPG, WEBP</div>
              </div>
              <div v-if="errors.hinhAnh" class="text-caption text-error mt-1">{{ errors.hinhAnh }}</div>
              <div v-else class="mt-2">
                <v-img :src="form.hinhAnh" width="140" height="100" rounded="lg" cover style="cursor: pointer;" @click="openLightbox([form.hinhAnh], 0)"></v-img>
                <v-btn size="small" variant="outlined" class="text-none mt-2" @click="cbImgInput?.click()">
                  <template v-slot:prepend><Pencil class="w-3.5 h-3.5" /></template>
                  Đổi ảnh
                </v-btn>
              </div>
            </div>

            <!-- CHỌN DỊCH VỤ -->
            <div class="mb-4">
              <div class="text-subtitle-2 font-weight-medium mb-1">
                Dịch vụ trong combo *
                <span class="text-caption text-medium-emphasis">— click để chọn / bỏ chọn</span>
              </div>
              <v-sheet
                rounded="lg"
                :style="{ border: errors.dichvus ? '1px solid #f44336' : '1px solid #ddd' }"
                class="pa-3 d-flex flex-wrap gap-2"
              >
                <div v-if="!dichvus.filter((x) => x.trangThai).length" class="text-caption text-medium-emphasis">
                  Không có dịch vụ đang hoạt động.
                </div>
                <v-chip
                  v-for="d in dichvus.filter((x) => x.trangThai)"
                  :key="d.maDV"
                  :color="form.dichvus.includes(d.maDV) ? 'primary' : undefined"
                  :variant="form.dichvus.includes(d.maDV) ? 'flat' : 'outlined'"
                  class="cursor-pointer"
                  @click="toggleDV(d.maDV)"
                >
                  {{ d.tenDV }} <span class="ml-1 text-caption">{{ fmt(d.gia) }}</span>
                </v-chip>
              </v-sheet>
              <div v-if="errors.dichvus" class="text-caption text-error mt-1">{{ errors.dichvus }}</div>

              <div v-if="form.dichvus.length" class="d-flex align-center gap-2 mt-2 text-body-2">
                <span>Tổng giá dịch vụ đã chọn:</span>
                <strong>{{ fmt(form.dichvus.reduce((s, id) => s + (getDV(id)?.gia || 0), 0)) }}</strong>
                <span
                  v-if="form.gia && form.dichvus.reduce((s, id) => s + (getDV(id)?.gia || 0), 0) > Number(form.gia)"
                  class="text-success"
                >
                  → Tiết kiệm {{ fmt(form.dichvus.reduce((s, id) => s + (getDV(id)?.gia || 0), 0) - Number(form.gia)) }}
                </span>
              </div>
            </div>

            <v-select
              v-model.number="form.trangThai"
              :items="[{ title: 'Hoạt động', value: 1 }, { title: 'Ngừng hoạt động', value: 0 }]"
              label="Trạng thái"
              variant="outlined"
              density="comfortable"
              rounded="lg"
            ></v-select>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <template v-if="modal.mode === 'viewDV' || modal.mode === 'viewCombo'">
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" @click="closeModal">Đóng</v-btn>
            <v-btn
              color="primary"
              variant="flat"
              rounded="lg"
              class="text-none font-weight-bold"
              @click="modal.mode === 'viewDV' ? editDV(modal.data) : editCombo(modal.data)"
            >Chỉnh sửa</v-btn>
          </template>
          <template v-else>
            <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" :disabled="saving" @click="closeModal">Hủy</v-btn>
            <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold" :loading="saving" @click="saveItem">
              Lưu lại
            </v-btn>
          </template>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── MODAL: Thêm/Sửa tiêu đề dịch vụ ─────────────────────── -->
    <v-dialog v-model="tdModal.open" max-width="560" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-4 px-6 d-flex align-center justify-space-between border-b">
          <span class="text-h6 font-weight-bold">{{ tdModal.isEdit ? "Sửa tiêu đề dịch vụ" : "Thêm tiêu đề dịch vụ" }}</span>
          <v-btn icon variant="text" size="small" :disabled="tdSaving" @click="closeTdModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="submitTieuDeModal">
            <v-text-field
              v-model="tdModal.form.tenTieuDe"
              label="Tên tiêu đề *"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="Nhập tên tiêu đề..."
              :error-messages="getTdError('_tdform', 'tenTieuDe')"
              @update:model-value="tdErrors['_tdform'] && (tdErrors['_tdform'].tenTieuDe = '')"
              class="mb-2"
              autofocus
            ></v-text-field>

            <v-textarea
              v-model="tdModal.form.moTaTieuDe"
              label="Mô tả (tuỳ chọn)"
              hint="Tối đa 500 ký tự"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rounded="lg"
              rows="2"
              placeholder="Mô tả tiêu đề..."
              :error-messages="getTdError('_tdform', 'moTaTieuDe')"
              @update:model-value="tdErrors['_tdform'] && (tdErrors['_tdform'].moTaTieuDe = '')"
              class="mb-2"
            ></v-textarea>

            <v-row dense>
              <v-col cols="6">
                <v-text-field
                  v-model="tdModal.form.soThuTu"
                  label="Số thứ tự"
                  type="number"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="0"
                  :error-messages="getTdError('_tdform', 'soThuTu')"
                  @update:model-value="tdErrors['_tdform'] && (tdErrors['_tdform'].soThuTu = '')"
                ></v-text-field>
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model.number="tdModal.form.trangThai"
                  :items="[{ title: 'Hoạt động', value: 1 }, { title: 'Ngừng hoạt động', value: 0 }]"
                  label="Trạng thái"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                ></v-select>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" :disabled="tdSaving" @click="closeTdModal">Hủy</v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold" :loading="tdSaving" @click="submitTieuDeModal">
            {{ tdModal.isEdit ? "Cập nhật" : "Lưu lại" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── MODAL: Thêm/Sửa chi tiết tiêu đề dịch vụ ────────────── -->
    <v-dialog v-model="ctModal.open" max-width="560" persistent>
      <v-card rounded="xl">
        <v-card-title class="pa-4 px-6 d-flex align-center justify-space-between border-b">
          <span class="text-h6 font-weight-bold">{{ ctModal.isEdit ? "Sửa chi tiết" : "Thêm chi tiết" }}</span>
          <v-btn icon variant="text" size="small" :disabled="tdSaving" @click="closeCtModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="submitChiTietModal">
            <v-text-field
              v-model="ctModal.form.ctTenTieuDe"
              label="Tên chi tiết *"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="Nhập tên chi tiết..."
              :error-messages="getCtError('_ctform', 'ctTenTieuDe')"
              @update:model-value="ctErrors['_ctform'] && (ctErrors['_ctform'].ctTenTieuDe = '')"
              class="mb-2"
              autofocus
            ></v-text-field>

            <v-textarea
              v-model="ctModal.form.ctMoTaTieuDe"
              label="Mô tả (tuỳ chọn)"
              hint="Tối đa 500 ký tự"
              persistent-hint
              variant="outlined"
              density="comfortable"
              rounded="lg"
              rows="2"
              placeholder="Mô tả chi tiết..."
              :error-messages="getCtError('_ctform', 'ctMoTaTieuDe')"
              @update:model-value="ctErrors['_ctform'] && (ctErrors['_ctform'].ctMoTaTieuDe = '')"
              class="mb-2"
            ></v-textarea>

            <v-text-field
              v-model.number="ctModal.form.ctSoThuTu"
              label="Số thứ tự"
              type="number"
              variant="outlined"
              density="comfortable"
              rounded="lg"
              placeholder="0"
              :error-messages="getCtError('_ctform', 'ctSoThuTu')"
              @update:model-value="ctErrors['_ctform'] && (ctErrors['_ctform'].ctSoThuTu = '')"
              class="mb-4"
            ></v-text-field>

            <!-- Ảnh chi tiết -->
            <div>
              <div class="text-subtitle-2 font-weight-medium mb-1">
                Ảnh chi tiết {{ !ctModal.isEdit ? "*" : "" }}
                <span class="text-caption text-medium-emphasis">— ≤ 5MB</span>
              </div>
              <input ref="ctImgInput" type="file" accept="image/*" style="display: none" @change="onCtModalFileChange" />
              <div
                v-if="!ctModal.form.ctPreview"
                class="d-flex flex-column align-center justify-center pa-6 rounded-lg"
                :style="{ border: getCtError('_ctform', 'ctFile') ? '2px dashed #f44336' : '2px dashed #ccc', cursor: 'pointer' }"
                @click="ctImgInput?.click()"
              >
                <Upload class="w-7 h-7 text-medium-emphasis mb-2" />
                <div class="text-body-2">Nhấn để <span class="text-primary font-weight-medium">chọn ảnh</span></div>
                <div class="text-caption text-medium-emphasis">PNG, JPG, WEBP</div>
              </div>
              <div v-if="getCtError('_ctform', 'ctFile')" class="text-caption text-error mt-1">{{ getCtError('_ctform', 'ctFile') }}</div>
              <div v-else class="mt-2">
                <v-img :src="ctModal.form.ctPreview" width="120" height="90" rounded="lg" cover></v-img>
                <v-btn size="small" variant="outlined" class="text-none mt-2" @click="ctImgInput?.click()">
                  <template v-slot:prepend><Pencil class="w-3.5 h-3.5" /></template>
                  Đổi ảnh
                </v-btn>
              </div>
            </div>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" :disabled="tdSaving" @click="closeCtModal">Hủy</v-btn>
          <v-btn color="primary" variant="flat" rounded="lg" class="text-none font-weight-bold" :loading="tdSaving" @click="submitChiTietModal">
            {{ ctModal.isEdit ? "Cập nhật" : "Lưu lại" }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── SNACKBAR ────────────────────────────────────────────── -->
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
.font-mono { font-family: monospace; }
.cursor-pointer { cursor: pointer; }
.border-primary { border-color: rgb(var(--v-theme-primary)) !important; }
</style>