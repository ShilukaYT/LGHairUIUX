<script setup>
import { ref, computed, reactive, onMounted, onUnmounted, watch } from "vue";
import { useTheme } from "vuetify";
import axios from "axios";
import Swal from "sweetalert2";
import { logActivity } from "@/utils/activityLogger";
import {
  Search,
  Plus,
  Edit3,
  Trash2,
  X,
  Award,
  Users,
  DollarSign,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Layers,
  Filter,
  RefreshCw,
  RotateCcw
} from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL || "https://localhost:7196";

// ── THEME SYNC: Đồng bộ Vuetify dark/light → Tailwind dark class ──
const theme = useTheme();
watch(
  () => theme.global.name.value,
  (val) => {
    if (val === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },
  { immediate: true }
);

// ── DATA ──────────────────────────────────────────────────────────
const chucVus = ref([]);
const loading = ref(false);
const saving = ref(false);

async function loadData() {
  loading.value = true;
  try {
    const res = await axios.get(`${API}/api/LoaiNhanVien`, {
      params: {
        keyword: search.value || null,
        trangThai: filterStatus.value === "" ? null : filterStatus.value,
      },
    });
    chucVus.value = res.data;
  } catch (error) {
    console.error("Lỗi tải danh sách chức vụ:", error);
    Swal.fire({
      icon: "error",
      title: "Lỗi tải dữ liệu",
      text: error.response?.data?.message || "Không thể tải danh sách chức vụ từ hệ thống.",
      confirmButtonColor: "#9d804e",
      background: document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff",
      color: document.documentElement.classList.contains("dark") ? "#f8fafc" : "#1e293b",
    });
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

const modal = reactive({ open: false, mode: "create", title: "Thêm Chức Vụ Mới" });
const form = reactive({
  maLoaiNv: "",
  tenLoai: "",
  luong: 0,
  moTa: "",
  duocDatLich: false,
  trangThai: 1,
});
const errors = reactive({ tenLoai: "", luong: "" });

// ── COMPUTED ───────────────────────────────────────────────────────
const filteredData = computed(() => {
  const q = search.value.toLowerCase().trim();
  return chucVus.value.filter((d) => {
    const matchQ =
      !q ||
      (d.tenLoai && d.tenLoai.toLowerCase().includes(q)) ||
      (d.maLoaiNv && d.maLoaiNv.toLowerCase().includes(q));
    const matchS =
      filterStatus.value === "" || String(d.trangThai) === filterStatus.value;
    return matchQ && matchS;
  });
});

const totalPages = computed(() =>
  Math.ceil(filteredData.value.length / PER_PAGE) || 1
);

const pageData = computed(() => {
  const s = (curPage.value - 1) * PER_PAGE;
  return filteredData.value.slice(s, s + PER_PAGE);
});

const visiblePages = computed(() => {
  const pages = [];
  const total = totalPages.value;
  const current = curPage.value;
  let start = Math.max(1, current - 2);
  let end = Math.min(total, current + 2);

  if (end - start + 1 < 5) {
    if (start === 1) end = Math.min(total, start + 4);
    else if (end === total) start = Math.max(1, end - 4);
  }

  for (let i = start; i <= end; i++) {
    if (i >= 1 && i <= total) pages.push(i);
  }
  return pages;
});

const statTotal = computed(() => chucVus.value.length);
const statActive = computed(() => chucVus.value.filter((d) => d.trangThai === 1).length);
const statInactive = computed(() => chucVus.value.filter((d) => d.trangThai === 0).length);
const statTotalStaff = computed(() => chucVus.value.reduce((acc, curr) => acc + (curr.soNhanVien || 0), 0));

watch([search, filterStatus], () => {
  curPage.value = 1;
});

// ── FORMATTER ──────────────────────────────────────────────────────
const formatVND = (val) => {
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(val || 0);
};

// ── FORM VALIDATION & ACTIONS ──────────────────────────────────────
function openCreateModal() {
  editingId.value = null;
  modal.mode = "create";
  modal.title = "Thêm Chức Vụ Mới";
  Object.assign(form, {
    maLoaiNv: "",
    tenLoai: "",
    luong: 5000000,
    moTa: "",
    duocDatLich: false,
    trangThai: 1,
  });
  errors.tenLoai = "";
  errors.luong = "";
  modal.open = true;
}

function openEditModal(item) {
  editingId.value = item.maLoaiNv;
  modal.mode = "edit";
  modal.title = `Cập Nhật Chức Vụ: ${item.tenLoai}`;
  Object.assign(form, {
    maLoaiNv: item.maLoaiNv,
    tenLoai: item.tenLoai,
    luong: item.luong || 0,
    moTa: item.moTa || "",
    duocDatLich: item.duocDatLich || false,
    trangThai: item.trangThai ?? 1,
  });
  errors.tenLoai = "";
  errors.luong = "";
  modal.open = true;
}

function closeModal() {
  modal.open = false;
}

function validateForm() {
  let valid = true;
  errors.tenLoai = "";
  errors.luong = "";

  if (!form.tenLoai || !form.tenLoai.trim()) {
    errors.tenLoai = "Vui lòng nhập tên chức vụ";
    valid = false;
  }
  if (form.luong === null || form.luong === undefined || form.luong < 0) {
    errors.luong = "Lương cơ bản không hợp lệ (phải >= 0)";
    valid = false;
  }
  return valid;
}

async function saveChucVu() {
  if (!validateForm()) return;
  saving.value = true;

  try {
    if (modal.mode === "create") {
      const res = await axios.post(`${API}/api/LoaiNhanVien`, form);
      Swal.fire({
        icon: "success",
        title: "Thành công!",
        text: res.data.message || "Đã thêm chức vụ mới.",
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff",
        color: document.documentElement.classList.contains("dark") ? "#f8fafc" : "#1e293b",
      });
      logActivity("Thêm chức vụ", `Đã thêm chức vụ mới: ${form.tenLoai} - Lương: ${formatVND(form.luong)}`, "Nhân sự");
    } else {
      const res = await axios.put(`${API}/api/LoaiNhanVien/${editingId.value}`, form);
      Swal.fire({
        icon: "success",
        title: "Cập nhật thành công!",
        text: res.data.message || "Đã lưu thay đổi chức vụ.",
        timer: 2000,
        showConfirmButton: false,
        background: document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff",
        color: document.documentElement.classList.contains("dark") ? "#f8fafc" : "#1e293b",
      });
      logActivity("Cập nhật chức vụ", `Đã cập nhật chức vụ: ${form.tenLoai} - Lương: ${formatVND(form.luong)}`, "Nhân sự");
    }
    await loadData();
    closeModal();
  } catch (error) {
    const msg = error.response?.data?.message || "Đã có lỗi xảy ra khi lưu!";
    Swal.fire({
      icon: "error",
      title: "Thất bại",
      text: msg,
      confirmButtonColor: "#9d804e",
      background: document.documentElement.classList.contains("dark") ? "#1e293b" : "#ffffff",
      color: document.documentElement.classList.contains("dark") ? "#f8fafc" : "#1e293b",
    });
    logActivity(
      modal.mode === "create" ? "Thêm chức vụ" : "Cập nhật chức vụ",
      `Thất bại khi ${modal.mode === "create" ? "thêm" : "cập nhật"} chức vụ ${form.tenLoai}: ${msg}`,
      "Nhân sự",
      "Thất bại"
    );
  } finally {
    saving.value = false;
  }
}

async function deleteChucVu(item) {
  const isDark = document.documentElement.classList.contains("dark");
  const result = await Swal.fire({
    title: "Xác nhận xóa?",
    html: `Bạn có chắc chắn muốn xóa chức vụ <b>"${item.tenLoai}"</b>?<br><small class="text-rose-500">Lưu ý: Không thể xóa nếu đang có nhân viên giữ chức vụ này.</small>`,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ef4444",
    cancelButtonColor: "#64748b",
    confirmButtonText: "Xóa ngay",
    cancelButtonText: "Hủy bỏ",
    background: isDark ? "#1e293b" : "#ffffff",
    color: isDark ? "#f8fafc" : "#1e293b",
  });

  if (result.isConfirmed) {
    try {
      const res = await axios.delete(`${API}/api/LoaiNhanVien/${item.maLoaiNv}`);
      Swal.fire({
        icon: "success",
        title: "Đã xóa!",
        text: res.data.message || "Chức vụ đã được xóa thành công.",
        timer: 2000,
        showConfirmButton: false,
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f8fafc" : "#1e293b",
      });
      logActivity("Xóa chức vụ", `Đã xóa chức vụ: ${item.tenLoai} (Mã: ${item.maLoaiNv})`, "Nhân sự");
      await loadData();
    } catch (error) {
      const msg = error.response?.data?.message || "Không thể xóa chức vụ này!";
      Swal.fire({
        icon: "error",
        title: "Không thể xóa",
        text: msg,
        confirmButtonColor: "#9d804e",
        background: isDark ? "#1e293b" : "#ffffff",
        color: isDark ? "#f8fafc" : "#1e293b",
      });
      logActivity("Xóa chức vụ", `Thất bại khi xóa chức vụ ${item.tenLoai}: ${msg}`, "Nhân sự", "Thất bại");
    }
  }
}

onMounted(async () => {
  await loadData();
  const wrapper = document.querySelector(".page-wrapper");
  if (wrapper) {
    wrapper.classList.add("full-width-layout");
  }
});

onUnmounted(() => {
  const wrapper = document.querySelector(".page-wrapper");
  if (wrapper) {
    wrapper.classList.remove("full-width-layout");
  }
});
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start font-sans select-none" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl" class="d-flex flex-column w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors">
      <!-- ── HEADER ── -->
      <div class="d-flex flex-column flex-lg-row align-lg-center justify-space-between pa-6 px-6 py-5 border-b border-slate-100 dark:border-slate-800 gap-4">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1 text-slate-900 dark:text-white flex items-center gap-2">
            <Briefcase class="w-6 h-6 text-sky-600 dark:text-sky-500 shrink-0" />
            <span>Quản Lý Chức Vụ & Lương Cơ Bản</span>
          </h2>
          <div class="text-subtitle-2 text-medium-emphasis dark:text-slate-400">
            Thiết lập chức vụ, định mức lương cơ bản và phân quyền cho nhân sự trong hệ thống salon
          </div>
        </div>

        <div class="d-flex align-center gap-3 flex-wrap">
          <div class="relative w-full sm:w-72 md:w-80">
            <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
            <input
              v-model="search"
              type="text"
              placeholder="Tìm kiếm chức vụ..."
              class="w-full h-11 pl-10 pr-4 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white outline-none focus:border-sky-500 dark:focus:border-sky-400 shadow-sm transition-all"
            />
          </div>

          <div class="d-flex align-center gap-2 text-caption font-weight-bold text-medium-emphasis dark:text-slate-400">
            <span class="whitespace-nowrap">TRẠNG THÁI:</span>
            <select
              v-model="filterStatus"
              class="h-11 px-3 rounded-xl border-2 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-white outline-none cursor-pointer shadow-sm transition-all"
            >
              <option value="" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Tất cả</option>
              <option value="1" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Hoạt động</option>
              <option value="0" class="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Khóa</option>
            </select>
          </div>

          <v-btn variant="outlined" color="grey-darken-1" size="44" rounded="xl" :loading="loading" @click="loadData" title="Tải lại">
            <RotateCcw class="w-5 h-5" />
          </v-btn>

          <v-btn color="primary" variant="flat" rounded="xl" height="44" class="text-none font-weight-bold whitespace-nowrap px-5" @click="openCreateModal">
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1 shrink-0" /></template>
            Thêm chức vụ
          </v-btn>
        </div>
      </div>

      <!-- ── STATS CARDS ── -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pa-6 px-6 py-5 pb-2">
        <!-- Card 1 -->
        <div class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-sky-50 dark:bg-sky-900/20 rounded-full group-hover:scale-110 transition-transform"></div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Tổng Chức Vụ</p>
            <h3 class="text-3xl font-extrabold text-slate-800 dark:text-white">{{ statTotal }}</h3>
            <p class="text-xs text-sky-600 dark:text-sky-400 font-medium mt-2 flex items-center gap-1">
              <Layers class="w-3.5 h-3.5 shrink-0" /> <span>Danh mục chức vụ</span>
            </p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-400 flex items-center justify-center relative z-10 shrink-0">
            <Briefcase class="w-6 h-6" />
          </div>
        </div>

        <!-- Card 2 -->
        <div class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-emerald-50 dark:bg-emerald-900/20 rounded-full group-hover:scale-110 transition-transform"></div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Đang Hoạt Động</p>
            <h3 class="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">{{ statActive }}</h3>
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2 flex items-center gap-1">
              <CheckCircle2 class="w-3.5 h-3.5 shrink-0" /> <span>Khả dụng xếp ca</span>
            </p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center relative z-10 shrink-0">
            <ShieldCheck class="w-6 h-6" />
          </div>
        </div>

        <!-- Card 3 -->
        <div class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-rose-50 dark:bg-rose-900/20 rounded-full group-hover:scale-110 transition-transform"></div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Khóa / Tạm Dừng</p>
            <h3 class="text-3xl font-extrabold text-rose-600 dark:text-rose-400">{{ statInactive }}</h3>
            <p class="text-xs text-rose-500 dark:text-rose-400 font-medium mt-2 flex items-center gap-1">
              <AlertCircle class="w-3.5 h-3.5 shrink-0" /> <span>Ngừng phân công</span>
            </p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center relative z-10 shrink-0">
            <X class="w-6 h-6" />
          </div>
        </div>

        <!-- Card 4 -->
        <div class="bg-white dark:bg-slate-800/80 pa-5 px-6 py-5 rounded-2xl border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center justify-between relative overflow-hidden group hover:shadow-md transition-all">
          <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-blue-50 dark:bg-blue-900/20 rounded-full group-hover:scale-110 transition-transform"></div>
          <div class="relative z-10 pl-1">
            <p class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-400 mb-1">Tổng Nhân Sự</p>
            <h3 class="text-3xl font-extrabold text-blue-600 dark:text-blue-400">{{ statTotalStaff }}</h3>
            <p class="text-xs text-blue-600 dark:text-blue-400 font-medium mt-2 flex items-center gap-1">
              <Users class="w-3.5 h-3.5 shrink-0" /> <span>Đang làm tại salon</span>
            </p>
          </div>
          <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center relative z-10 shrink-0">
            <Award class="w-6 h-6" />
          </div>
        </div>
      </div>

      <!-- ── DATA TABLE ── -->
      <div class="flex-1 overflow-x-auto w-full pa-6 px-6 py-4">
        <div class="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th class="py-4 px-6 pa-4">Mã Chức Vụ</th>
                <th class="py-4 px-6 pa-4">Tên Chức Vụ</th>
                <th class="py-4 px-6 pa-4">Lương Cơ Bản</th>
                <th class="py-4 px-6 pa-4 text-center">Phân Loại</th>
                <th class="py-4 px-6 pa-4 text-center">Nhân Sự</th>
                <th class="py-4 px-6 pa-4 text-center">Trạng Thái</th>
                <th class="py-4 px-6 pa-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
              <tr v-if="loading">
                <td colspan="7" class="py-12 pa-8 text-center text-slate-400 dark:text-slate-500">
                  <div class="flex flex-col items-center justify-center gap-2">
                    <RefreshCw class="w-6 h-6 animate-spin text-sky-600 dark:text-sky-500" />
                    <span>Đang tải danh sách chức vụ...</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="pageData.length === 0">
                <td colspan="7" class="py-12 pa-8 text-center text-slate-400 dark:text-slate-500">
                  Không tìm thấy chức vụ nào phù hợp.
                </td>
              </tr>
              <tr
                v-else
                v-for="item in pageData"
                :key="item.maLoaiNv"
                class="hover:bg-sky-50/30 dark:hover:bg-slate-800/50 transition-colors group"
              >
                <td class="py-4 px-6 pa-4 font-mono text-xs whitespace-nowrap">
                  <span class="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md font-semibold text-slate-700 dark:text-slate-300">
                    {{ item.maLoaiNv }}
                  </span>
                </td>
                <td class="py-4 px-6 pa-4">
                  <div class="font-bold text-slate-900 dark:text-white text-base">{{ item.tenLoai }}</div>
                  <div v-if="item.moTa" class="text-xs text-slate-400 dark:text-slate-400 font-normal mt-0.5 line-clamp-1">
                    {{ item.moTa }}
                  </div>
                </td>
                <td class="py-4 px-6 pa-4 whitespace-nowrap">
                  <div class="font-bold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-900/30 inline-flex items-center px-3 py-1 rounded-lg border border-sky-200/50 dark:border-sky-700/50">
                    {{ formatVND(item.luong) }}
                  </div>
                </td>
                <td class="py-4 px-6 pa-4 text-center whitespace-nowrap">
                  <span
                    v-if="item.duocDatLich"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50"
                  >
                    <Award class="w-3.5 h-3.5 shrink-0" /> <span>Thợ dịch vụ (Được đặt lịch)</span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    Nhân viên nội bộ
                  </span>
                </td>
                <td class="py-4 px-6 pa-4 text-center">
                  <span class="inline-flex items-center justify-center min-w-[32px] px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs border border-blue-200 dark:border-blue-700/50">
                    {{ item.soNhanVien || 0 }}
                  </span>
                </td>
                <td class="py-4 px-6 pa-4 text-center whitespace-nowrap">
                  <span
                    v-if="item.trangThai === 1"
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/50"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span> <span>Hoạt động</span>
                  </span>
                  <span
                    v-else
                    class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-700/50"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span> <span>Khóa</span>
                  </span>
                </td>
                <td class="py-4 px-6 pa-4 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-2">
                    <button
                      @click="openEditModal(item)"
                      class="p-2 text-slate-400 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      title="Chỉnh sửa chức vụ"
                    >
                      <Edit3 class="w-4 h-4" />
                    </button>
                    <button
                      @click="deleteChucVu(item)"
                      class="p-2 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
                      title="Xóa chức vụ"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- ── PAGINATION ── -->
        <div
          v-if="totalPages > 1"
          class="flex items-center justify-between px-6 py-4 pa-4 mt-4 border border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30"
        >
          <span class="text-xs text-slate-500 dark:text-slate-400">
            Hiển thị trang <b class="text-slate-800 dark:text-white">{{ curPage }}</b> / <b>{{ totalPages }}</b>
            ({{ filteredData.length }} chức vụ)
          </span>
          <div class="flex items-center gap-1">
            <button
              @click="curPage > 1 && curPage--"
              :disabled="curPage === 1"
              class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Trước
            </button>
            <button
              v-for="p in visiblePages"
              :key="p"
              @click="curPage = p"
              :class="[
                'w-8 h-8 rounded-lg text-xs font-semibold transition-all flex items-center justify-center',
                curPage === p
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              ]"
            >
              {{ p }}
            </button>
            <button
              @click="curPage < totalPages && curPage++"
              :disabled="curPage === totalPages"
              class="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </v-card>

  </v-container>

  <!-- ── MODAL ADD / EDIT (Teleport ra body để tránh stacking context của v-card) ── -->
  <Teleport to="body">
    <div
      v-if="modal.open"
      class="fixed inset-0 flex items-center justify-center bg-slate-900/70 dark:bg-slate-950/85 backdrop-blur-sm p-4 animate-fadeIn"
      style="z-index: 9999;"
      @click.self="closeModal"
    >
      <div class="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-100 transition-colors">
        <!-- Modal Header -->
        <div class="px-6 py-5 pa-6 bg-gradient-to-r from-sky-600 to-sky-700 text-white flex items-center justify-between">
          <h3 class="text-lg font-bold flex items-center gap-2">
            <Briefcase class="w-5 h-5 shrink-0" />
            <span>{{ modal.title }}</span>
          </h3>
          <button
            @click="closeModal"
            class="p-1 rounded-lg hover:bg-white/10 transition-colors text-white"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 pa-6 space-y-5">
          <!-- Mã chức vụ -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Mã Chức Vụ <span class="text-xs font-normal text-slate-400 dark:text-slate-400">(Tùy chọn)</span>
            </label>
            <input
              v-model="form.maLoaiNv"
              :disabled="modal.mode === 'edit'"
              type="text"
              class="w-full h-12 px-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-mono font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 shadow-sm disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-slate-800/50 uppercase transition-all"
            />
            <p v-if="modal.mode === 'create'" class="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
              💡 Để trống nếu muốn hệ thống tự động tạo mã (VD: LNV01, LNV02...)
            </p>
            <p v-if="modal.mode === 'edit'" class="text-xs text-slate-400 dark:text-slate-500 mt-1.5 font-medium">
              * Mã chức vụ là định danh duy nhất không thể thay đổi sau khi tạo.
            </p>
          </div>

          <!-- Tên chức vụ -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Tên Chức Vụ <span class="text-rose-500">*</span>
            </label>
            <input
              v-model="form.tenLoai"
              type="text"
              :class="errors.tenLoai ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-300 dark:border-slate-600 focus:border-sky-500 dark:focus:border-sky-400'"
              class="w-full h-12 px-4 bg-white dark:bg-slate-800 border-2 rounded-xl text-base font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 shadow-sm transition-all"
            />
            <p v-if="errors.tenLoai" class="text-xs text-rose-500 mt-1.5 font-bold">{{ errors.tenLoai }}</p>
          </div>

          <!-- Lương cơ bản -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Lương Cơ Bản (VNĐ) <span class="text-rose-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model.number="form.luong"
                type="number"
                min="0"
                step="500000"
                :class="errors.luong ? 'border-rose-500 dark:border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-300 dark:border-slate-600 focus:border-sky-500 dark:focus:border-sky-400'"
                class="w-full h-12 pl-4 pr-16 bg-white dark:bg-slate-800 border-2 rounded-xl text-lg font-extrabold text-sky-600 dark:text-sky-400 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 shadow-sm transition-all"
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-extrabold text-slate-400 dark:text-slate-400">VNĐ</span>
            </div>
            <p v-if="errors.luong" class="text-xs text-rose-500 mt-1.5 font-bold">{{ errors.luong }}</p>
            <p class="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1.5 flex items-center gap-1">
              <DollarSign class="w-4 h-4 shrink-0" /> <span>Hiển thị: {{ formatVND(form.luong) }}</span>
            </p>
          </div>

          <!-- Mô tả -->
          <div>
            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
              Mô Tả Công Việc
            </label>
            <textarea
              v-model="form.moTa"
              rows="3"
              class="w-full p-4 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-base font-medium text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 shadow-sm transition-all resize-none"
            ></textarea>
          </div>

          <!-- Phân loại thợ & Trạng thái -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <!-- Được đặt lịch -->
            <div class="p-4 pa-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-slate-300 dark:border-slate-600 flex items-center justify-between shadow-sm">
              <div>
                <span class="block text-sm font-bold text-slate-800 dark:text-white">Được Đặt Lịch</span>
                <span class="text-xs text-slate-500 dark:text-slate-400">Dành cho thợ làm tóc</span>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" v-model="form.duocDatLich" class="sr-only peer" />
                <div class="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>

            <!-- Trạng thái -->
            <div class="p-4 pa-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-slate-300 dark:border-slate-600 shadow-sm">
              <span class="block text-sm font-bold text-slate-800 dark:text-white mb-2">Trạng Thái</span>
              <select
                v-model="form.trangThai"
                class="w-full h-10 px-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-500 dark:focus:border-sky-400 shadow-sm transition-all"
              >
                <option :value="1">🟢 Hoạt động</option>
                <option :value="0">🔴 Khóa / Tạm dừng</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="px-6 py-4 pa-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            @click="closeModal"
            type="button"
            class="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy Bỏ
          </button>
          <button
            @click="saveChucVu"
            :disabled="saving"
            type="button"
            class="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white font-bold text-sm rounded-xl shadow-md shadow-sky-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <RefreshCw v-if="saving" class="w-4 h-4 animate-spin shrink-0" />
            <span>{{ saving ? "Đang lưu..." : "Lưu Chức Vụ" }}</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.15s ease-out forwards;
}
</style>
