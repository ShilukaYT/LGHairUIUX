<script setup>
import { ref, computed, reactive, onMounted } from "vue";
import axios from "axios";
import { useTheme } from "vuetify";

const API = import.meta.env.VITE_API_URL;

// ── DARK / LIGHT MODE (đồng bộ với ProfileDD - Cài đặt Sáng/Tối) ──
const vuetifyTheme = useTheme();
const isDarkMode = computed(() => vuetifyTheme.global.name.value === "dark");

// ══ TOAST ══════════════════════════════════════════════════════════
const toast = reactive({ show: false, msg: "", type: "success" });
function showToast(msg, type = "success") {
  toast.msg = msg; toast.type = type; toast.show = true;
  setTimeout(() => { toast.show = false; }, 3000);
}

// ══ HELPERS ════════════════════════════════════════════════════════
function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("vi-VN");
}

/* ════════════════════════════════════════════════════════════════
   ĐỐI SOÁT KHO - HÓA ĐƠN ĐIỆN TỬ
   ════════════════════════════════════════════════════════════════ */
const doiSoatList = ref([]);
const doiSoatTotal = ref(0);
const doiSoatStats = ref({ tongLuot: 0, daKhop: 0, chuaKhop: 0 });
const tuNgayDS = ref("");
const denNgayDS = ref("");
const filterTrangThaiDS = ref("");
const searchDS = ref("");
const curPageDS = ref(1);
const perPageDS = ref(20);
const loadingDS = ref(false);
let searchDebounceDS = null;

async function loadDoiSoat() {
  loadingDS.value = true;
  try {
    const res = await axios.get(`${API}/api/QuanLyKho/doisoathoadon`, {
      params: {
        tuNgay: tuNgayDS.value || null,
        denNgay: denNgayDS.value || null,
        trangThai: filterTrangThaiDS.value || null,
        search: searchDS.value.trim() || null,
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
function onSearchDSInput() {
  clearTimeout(searchDebounceDS);
  searchDebounceDS = setTimeout(() => { onFilterDSChange(); }, 350);
}

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

// ══ INIT ═══════════════════════════════════════════════════════════
onMounted(() => { loadDoiSoat(); });
</script>

<template>
  <div class="kho-manager" :class="{ 'dark-mode': isDarkMode }">

    <!-- ── HEADER ─────────────────────────────────────────────── -->
    <div class="header-bar">
      <div class="page-title-text">Đối soát hóa đơn</div>
    </div>

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
      <div class="search-box">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" /></svg>
        <input v-model="searchDS" placeholder="Tìm mã đơn, mã/tên biến thể, tên sản phẩm..." @input="onSearchDSInput" />
      </div>
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

    <!-- ══ TOAST ═══════════════════════════════════════════════════ -->
    <div class="toast" :class="[toast.type, { show: toast.show }]">
      <span>{{ toast.msg }}</span>
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

/* ── STATS ──────────────────────────────────────────────────────── */
.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 20px; }
.stat-card { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 12px; padding: 16px 18px; display: flex; flex-direction: column; gap: 3px; }
.stat-label { font-size: 11px; font-weight: 600; color: var(--dvc-text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.stat-value { font-size: 26px; font-weight: 700; color: var(--dvc-text); line-height: 1.1; }
.stat-hint { font-size: 11px; color: var(--dvc-text-muted); margin-top: 2px; }
.stat-dark { border-top: 3px solid var(--dvc-accent); }
.stat-green { border-top: 3px solid #22c55e; }
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
.form-input { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 8px; padding: 8px 12px; font-size: 13px; color: var(--dvc-text); font-family: inherit; outline: none; transition: border 0.15s; }
.form-input:focus { border-color: var(--dvc-text-secondary); box-shadow: 0 0 0 3px rgba(107,114,128,0.07); }

/* ── TABLE ──────────────────────────────────────────────────────── */
.table-wrap { background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 12px; overflow: hidden; }
table { width: 100%; border-collapse: collapse; }
thead th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; color: var(--dvc-text-muted); letter-spacing: 0.5px; border-bottom: 1px solid var(--dvc-bg-subtle); background: var(--dvc-bg-subtle2); white-space: nowrap; text-transform: uppercase; }
tbody tr { border-bottom: 1px solid var(--dvc-bg-subtle); transition: background 0.12s; }
tbody tr:last-child { border-bottom: none; }
tbody tr:hover { background: var(--dvc-bg-subtle2); }
tbody td { padding: 10px 14px; font-size: 13px; vertical-align: middle; }
.code-text { font-size: 12px; color: var(--dvc-text-secondary); font-family: "Courier New", monospace; background: var(--dvc-bg-subtle); padding: 2px 7px; border-radius: 4px; }
.sp-name { font-weight: 500; color: var(--dvc-text); }
.bt-subname { font-size: 11.5px; color: var(--dvc-text-muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; }

/* ── BADGES / STATUS ────────────────────────────────────────────── */
.stock-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
.stock-zero { background: #fef2f2; color: #dc2626; }
.status-pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
.status-pill.active { background: #f0fdf4; color: #15803d; }
.status-pill.inactive { background: var(--dvc-bg-subtle2); color: var(--dvc-text-muted); }
.status-pill.pending { background: #fffbeb; color: #b45309; }
.status-pill.cancelled { background: #fef2f2; color: #dc2626; }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex-shrink: 0; }

/* ── ACTIONS / ICON BUTTON ──────────────────────────────────────── */
.icon-btn { width: 28px; height: 28px; border-radius: 6px; border: 1px solid var(--dvc-border); background: var(--dvc-card-bg); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--dvc-text-muted); transition: all 0.12s; }
.icon-btn:hover { background: var(--dvc-bg-subtle2); color: var(--dvc-text-strong); border-color: var(--dvc-border-strong); }
.icon-btn.view:hover { color: #2563eb; border-color: #bfdbfe; background: #eff6ff; }

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

/* ── TOAST ──────────────────────────────────────────────────────── */
.toast { position: fixed; bottom: 24px; right: 24px; background: var(--dvc-card-bg); border: 1px solid var(--dvc-border); border-radius: 10px; padding: 12px 16px; font-size: 13px; color: var(--dvc-text); display: flex; align-items: center; gap: 9px; z-index: 1000; transform: translateY(20px); opacity: 0; transition: all 0.25s; pointer-events: none; box-shadow: 0 4px 16px rgba(0,0,0,0.1); max-width: 320px; }
.toast.show { transform: translateY(0); opacity: 1; }
.toast.success { border-color: #bbf7d0; }
.toast.error { border-color: #fecaca; }

/* ── RESPONSIVE ─────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
  .header-bar { flex-direction: column; align-items: flex-start; }
  .result-count { margin-left: 0; }
}
@media (max-width: 480px) {
  .stats-row { grid-template-columns: 1fr 1fr; }
}
</style>
