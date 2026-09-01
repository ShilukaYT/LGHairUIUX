<script setup>
import { ref, onMounted, computed } from 'vue';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { logActivity } from '@/utils/activityLogger';
import { Line, Bar } from 'vue-chartjs';
import { useCustomizerStore } from '@/stores/customizer';
import { useTheme } from 'vuetify';
import ModalChiTietHoaDon from '@/Admin/HoaDon/ModalChiTietHoaDon.vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  BarElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js';
import { 
  Calendar, 
  Search, 
  Filter, 
  RotateCcw, 
  TrendingUp, 
  Trophy, 
  LayoutDashboard,
  Users, 
  ShoppingBag, 
  Scissors, 
  Printer, 
  X, 
  Coins, 
  Receipt, 
  Percent,
  Star,
  Clock,
  Flame,
  Moon,
  Coffee,
  MapPin,
  UserCheck,
  FileDown,
  Eye,
  Truck,
  User
} from 'lucide-vue-next';

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, BarElement, CategoryScale, LinearScale, Filler);

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const customizer = useCustomizerStore();
const isDarkMode = computed(() => {
  if (customizer?.actTheme === 'dark') return true;
  try {
    const vuetifyTheme = useTheme();
    if (vuetifyTheme?.global?.name?.value === 'dark' || vuetifyTheme?.global?.current?.value?.dark) return true;
  } catch (e) {}
  return localStorage.getItem('theme_selection') === 'dark' 
      || localStorage.getItem('actTheme') === 'dark'
      || document.documentElement.classList.contains('dark') 
      || document.body.classList.contains('v-theme--dark');
});

// ── Helpers ──────────────────────────────────────────────────────────────────
const today    = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

const pad = (n) => String(n).padStart(2, '0');
const fmtInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const formatCurrency = (v) =>
  v == null ? '0 ₫' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

const formatDate = (s) =>
  s ? new Date(s).toLocaleDateString('vi-VN') : '';

const trangThaiLabel = (t) => {
  const map = { 0: 'Hủy', 1: 'Chờ xử lý', 2: 'Đang xử lý', 3: 'Hoàn thành' };
  return map[t] ?? 'Không rõ';
};
const trangThaiColor = (t) => {
  const map = { 0: 'error', 1: 'warning', 2: 'info', 3: 'success' };
  return map[t] ?? 'default';
};

// ── State ─────────────────────────────────────────────────────────────────────
const startDate   = ref(fmtInput(firstDay));
const endDate     = ref(fmtInput(today));
const searchMaHd  = ref('');
const loading     = ref(true);
const error       = ref(null);
const activeTab   = ref('dichvu');
const staffTab    = ref('revenue');
const topTab      = ref('sanpham');
const filterPreset= ref('thisMonth');
const selectedMonth = ref(today.getMonth() + 1);
const selectedYear  = ref(today.getFullYear());
const topYeuThich = ref([]);
const loadingYeuThich = ref(false);

// Modal Locality & Customer Details State
const isLocalityModalOpen = ref(false);
const selectedLocalityItem = ref(null);
const selectedLocalityInvoices = ref([]);

const isCustomerModalOpen = ref(false);
const selectedCustomerItem = ref(null);
const selectedCustomerInvoices = ref([]);

const openCustomerDetailModal = (khItem) => {
  if (!khItem) return;
  selectedCustomerItem.value = khItem;

  const allInvoices = [
    ...(stats.value.hoaDonSanPham || []),
    ...(stats.value.hoaDonDichVu || [])
  ];

  selectedCustomerInvoices.value = allInvoices.filter(hd => {
    if (hd.trangThai === 0) return false;
    const tenKh = hd.tenKh || hd.khachHang || hd.tenKhachHang || 'Khách vãng lai';
    return tenKh === khItem.tenKh;
  });

  isCustomerModalOpen.value = true;
};

const stats = ref({
  doanhThuThangNay : 0,
  soHoaDonThangNay : 0,
  soVoucherDaDung  : 0,
  topNhanVien      : [],
  hoaDonSanPham    : [],
  hoaDonDichVu     : [],
  bieuDo           : []
});

const monthOptions = [
  { title: 'Tháng 1', value: 1 },
  { title: 'Tháng 2', value: 2 },
  { title: 'Tháng 3', value: 3 },
  { title: 'Tháng 4', value: 4 },
  { title: 'Tháng 5', value: 5 },
  { title: 'Tháng 6', value: 6 },
  { title: 'Tháng 7', value: 7 },
  { title: 'Tháng 8', value: 8 },
  { title: 'Tháng 9', value: 9 },
  { title: 'Tháng 10', value: 10 },
  { title: 'Tháng 11', value: 11 },
  { title: 'Tháng 12', value: 12 }
];

const yearOptions = computed(() => {
  const currentY = today.getFullYear();
  return [currentY - 2, currentY - 1, currentY, currentY + 1];
});

const applyPreset = (presetKey) => {
  filterPreset.value = presetKey;
  const now = new Date();
  if (presetKey === 'today') {
    startDate.value = fmtInput(now);
    endDate.value   = fmtInput(now);
  } else if (presetKey === 'last7') {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 6);
    startDate.value = fmtInput(d7);
    endDate.value   = fmtInput(now);
  } else if (presetKey === 'thisMonth') {
    const fM = new Date(now.getFullYear(), now.getMonth(), 1);
    startDate.value = fmtInput(fM);
    endDate.value   = fmtInput(now);
  } else if (presetKey === 'lastMonth') {
    const fLM = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lLM = new Date(now.getFullYear(), now.getMonth(), 0);
    startDate.value = fmtInput(fLM);
    endDate.value   = fmtInput(lLM);
  } else if (presetKey === 'thisYear') {
    const fY = new Date(now.getFullYear(), 0, 1);
    const lY = new Date(now.getFullYear(), 11, 31);
    startDate.value = fmtInput(fY);
    endDate.value   = fmtInput(lY);
  }
  fetchAdminData();
  fetchTopYeuThich();
};

const handleMonthYearChange = () => {
  filterPreset.value = 'custom';
  const fM = new Date(selectedYear.value, selectedMonth.value - 1, 1);
  const lM = new Date(selectedYear.value, selectedMonth.value, 0);
  startDate.value = fmtInput(fM);
  endDate.value   = fmtInput(lM);
  fetchAdminData();
  fetchTopYeuThich();
};

const handleYearChange = () => {
  filterPreset.value = 'custom';
  const fY = new Date(selectedYear.value, 0, 1);
  const lY = new Date(selectedYear.value, 11, 31);
  startDate.value = fmtInput(fY);
  endDate.value   = fmtInput(lY);
  fetchAdminData();
  fetchTopYeuThich();
};

// ── Pagination ────────────────────────────────────────────────────────────────
const pageSP  = ref(1);
const pageDV  = ref(1);
const perPage = 8;

const pagedSP = computed(() => {
  const s = (pageSP.value - 1) * perPage;
  return stats.value.hoaDonSanPham.slice(s, s + perPage);
});
const pagedDV = computed(() => {
  const s = (pageDV.value - 1) * perPage;
  return stats.value.hoaDonDichVu.slice(s, s + perPage);
});
const totalPagesSP = computed(() => Math.ceil(stats.value.hoaDonSanPham.length / perPage));
const totalPagesDV = computed(() => Math.ceil(stats.value.hoaDonDichVu.length  / perPage));

const totalRevenue = computed(() => {
  const spSum = stats.value.hoaDonSanPham
    ?.filter(hd => hd.trangThai === 3)
    ?.reduce((sum, hd) => sum + (hd.thanhTien || 0), 0) || 0;
  const dvSum = stats.value.hoaDonDichVu
    ?.filter(hd => hd.trangThai === 3)
    ?.reduce((sum, hd) => sum + (hd.thanhTien || 0), 0) || 0;
  return spSum + dvSum;
});

// ── Stat card definitions ─────────────────────────────────────────────────────
const statCards = computed(() => [
  {
    label : 'Doanh thu giai đoạn',
    value : formatCurrency(totalRevenue.value),
    iconComponent : Coins,
    iconColor : '#2563eb',
    bg    : '#eff6ff'
  },
  {
    label : 'Số hóa đơn',
    value : (stats.value.hoaDonSanPham?.length || 0) + (stats.value.hoaDonDichVu?.length || 0),
    iconComponent : Receipt,
    iconColor : '#16a34a',
    bg    : '#f0fdf4'
  },
  {
    label : 'Voucher đã dùng',
    value : stats.value.soVoucherDaDung,
    iconComponent : Percent,
    iconColor : '#d97706',
    bg    : '#fffbeb'
  }
]);

// ── Top Best Selling Products & Services ───────────────────────────────────────
const topSellingProducts = computed(() => {
  const map = new Map();
  const list = stats.value.hoaDonSanPham || [];

  list.forEach(hd => {
    if (hd.trangThai === 0) return; // Skip cancelled
    const items = hd.chiTiet || hd.ChiTiet || [];
    items.forEach(ct => {
      const ten = ct.ten || ct.Ten || ct.tenSP || ct.tenSp || ct.tenHangMuc || 'Sản phẩm Salon';
      const sl  = Number(ct.soLuong || ct.SoLuong || ct.soluong || 1);
      const gia = Number(ct.thanhTien != null ? ct.thanhTien : ((ct.gia || ct.Gia || ct.giaBan || 0) * sl));

      if (!map.has(ten)) {
        map.set(ten, { ten, soLuong: 0, doanhThu: 0, luotDon: 0 });
      }
      const item = map.get(ten);
      item.soLuong += sl;
      item.doanhThu += gia;
      item.luotDon += 1;
    });
  });

  const arr = Array.from(map.values()).sort((a, b) => b.soLuong - a.soLuong || b.doanhThu - a.doanhThu);
  const maxSL = arr.length > 0 ? Math.max(...arr.map(x => x.soLuong), 1) : 1;
  return arr.slice(0, 5).map(x => ({
    ...x,
    percent: Math.round((x.soLuong / maxSL) * 100)
  }));
});

const topSellingServices = computed(() => {
  const map = new Map();
  const list = stats.value.hoaDonDichVu || [];

  list.forEach(hd => {
    if (hd.trangThai === 0) return; // Skip cancelled
    const items = hd.chiTiet || hd.ChiTiet || hd.chiTietDichVu || hd.ChiTietDichVu || [];
    if (items && items.length > 0) {
      items.forEach(ct => {
        const ten = ct.ten || ct.Ten || ct.tenDichVu || ct.TenDichVu || ct.tenHangMuc || 'Dịch vụ Salon';
        const sl  = Number(ct.soLuong || ct.SoLuong || ct.soluong || 1);
        const gia = Number(ct.thanhTien != null ? ct.thanhTien : ((ct.gia || ct.Gia || 0) * sl));

        if (!map.has(ten)) {
          map.set(ten, { ten, soLuong: 0, doanhThu: 0, luotDon: 0 });
        }
        const item = map.get(ten);
        item.soLuong += sl;
        item.doanhThu += gia;
        item.luotDon += 1;
      });
    } else {
      const ten = hd.tenDichVu || hd.dichVu || 'Dịch vụ Salon';
      const sl  = 1;
      const gia = Number(hd.thanhTien || hd.tongTien || 0);

      if (!map.has(ten)) {
        map.set(ten, { ten, soLuong: 0, doanhThu: 0, luotDon: 0 });
      }
      const item = map.get(ten);
      item.soLuong += sl;
      item.doanhThu += gia;
      item.luotDon += 1;
    }
  });

  const arr = Array.from(map.values()).sort((a, b) => b.soLuong - a.soLuong || b.doanhThu - a.doanhThu);
  const maxSL = arr.length > 0 ? Math.max(...arr.map(x => x.soLuong), 1) : 1;
  return arr.slice(0, 5).map(x => ({
    ...x,
    percent: Math.round((x.soLuong / maxSL) * 100)
  }));
});

// ── Top Customers Analytics (Khách hàng đặt nhiều nhất) ───────────────────────
const topCustomers = computed(() => {
  const map = new Map();
  const allInvoices = [
    ...(stats.value.hoaDonSanPham || []),
    ...(stats.value.hoaDonDichVu || [])
  ];

  allInvoices.forEach(hd => {
    if (hd.trangThai === 0) return; // Skip cancelled
    const tenKh = hd.tenKh || hd.khachHang || hd.tenKhachHang || 'Khách vãng lai';
    const isSp   = String(hd.maHd || '').toUpperCase().startsWith('SP') || String(hd.maHd || '').toUpperCase().startsWith('HDSP');
    const money  = Number(hd.thanhTien || hd.tongTien || 0);

    if (!map.has(tenKh)) {
      map.set(tenKh, {
        tenKh,
        soHoaDon: 0,
        donSpCount: 0,
        donDvCount: 0,
        tongChiTieu: 0
      });
    }

    const c = map.get(tenKh);
    c.soHoaDon += 1;
    if (isSp) c.donSpCount += 1;
    else c.donDvCount += 1;
    c.tongChiTieu += money;
  });

  const arr = Array.from(map.values()).sort((a, b) => b.tongChiTieu - a.tongChiTieu || b.soHoaDon - a.soHoaDon);
  const maxMoney = arr.length > 0 ? Math.max(...arr.map(x => x.tongChiTieu), 1) : 1;
  return arr.slice(0, 5).map(x => ({
    ...x,
    percent: Math.round((x.tongChiTieu / maxMoney) * 100)
  }));
});

// ── Locality / Region Analytics (Thống kê địa phương nơi ở của Khách hàng) ────
const showAllLocalities = ref(false);

const parseCustomerLocalityDetailed = (hd) => {
  const raw = (
    hd.diaChiGiaoHang || 
    hd.diaChiKhachHang || 
    hd.diaChi || 
    hd.diaChiXuatHD || 
    hd.ghiChu || 
    ''
  ).toString().trim();
  const lower = raw.toLowerCase();

  // Check specific communes / wards in Đắk Lắk from customer address
  if (lower.includes("ea drơng") || lower.includes("ea drong")) return "Xã Ea Drơng, Cư M'gar (Đắk Lắk)";
  if (lower.includes("cuôr đăng") || lower.includes("cuor dang")) return "Xã Cuôr Đăng, Cư M'gar (Đắk Lắk)";
  if (lower.includes("cư dliê m'nông") || lower.includes("cư dliê mnông")) return "Xã Cư Dliê M'nông, Cư M'gar (Đắk Lắk)";
  if (lower.includes("ea kpam")) return "Xã Ea Kpam, Cư M'gar (Đắk Lắk)";
  if (lower.includes("ea pốk") || lower.includes("ea pok")) return "Thị trấn Ea Pốk, Cư M'gar (Đắk Lắk)";
  if (lower.includes("quảng phú")) return "Thị trấn Quảng Phú, Cư M'gar (Đắk Lắk)";
  if (lower.includes("cư m'gar") || lower.includes("cu mgar") || lower.includes("cưm'gar")) return "Huyện Cư M'gar (Đắk Lắk)";

  // Check wards / communes in Buôn Ma Thuột
  if (lower.includes("tân an")) return "Phường Tân An, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("tân tiến")) return "Phường Tân Tiến, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("thắng lợi")) return "Phường Thắng Lợi, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("thành công")) return "Phường Thành Công, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("tân lập")) return "Phường Tân Lập, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("ea tam")) return "Phường Ea Tam, TP. Buôn Ma Thuột (Đắk Lắk)";
  if (lower.includes("buôn ma thuột") || lower.includes("bmt") || lower.includes("buon ma thuot")) return "TP. Buôn Ma Thuột (Đắk Lắk)";

  // Check other districts in Đắk Lắk
  if (lower.includes("phước an")) return "Thị trấn Phước An, Krông Pắc (Đắk Lắk)";
  if (lower.includes("krông pắc") || lower.includes("krong pac")) return "Huyện Krông Pắc (Đắk Lắk)";
  if (lower.includes("krông năng") || lower.includes("krong nang")) return "Huyện Krông Năng (Đắk Lắk)";
  if (lower.includes("buôn hồ") || lower.includes("buon ho")) return "Thị xã Buôn Hồ (Đắk Lắk)";
  if (lower.includes("ea kar") || lower.includes("eakar")) return "Huyện Ea Kar (Đắk Lắk)";
  if (lower.includes("cư kwin") || lower.includes("cukwin")) return "Huyện Cư Kwin (Đắk Lắk)";
  if (lower.includes("lắk") || lower.includes("huyện lắk")) return "Huyện Lắk (Đắk Lắk)";
  if (lower.includes("đắk lắk") || lower.includes("dak lak") || lower.includes("đắc lắc")) return "Tỉnh Đắk Lắk";

  // Major cities / outer provinces
  if (lower.includes("hồ chí minh") || lower.includes("hcm") || lower.includes("sài gòn")) return "TP. Hồ Chí Minh";
  if (lower.includes("hà nội")) return "Hà Nội";
  if (lower.includes("đà nẵng")) return "Đà Nẵng";

  // Extract from customer address string if structured with commas
  if (raw && !raw.includes("Khách vãng lai")) {
    const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length >= 3) {
      return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
    } else if (parts.length === 2) {
      return `${parts[0]} (${parts[1]})`;
    } else if (parts.length === 1) {
      return parts[0];
    }
  }

  // Explicit label for walk-in / in-salon orders without saved customer home address
  return "Khách tại Salon (Chưa có địa chỉ nơi ở)";
};

const localityAnalysis = computed(() => {
  const map = new Map();
  const allInvoices = [
    ...(stats.value.hoaDonSanPham || []),
    ...(stats.value.hoaDonDichVu || [])
  ];

  allInvoices.forEach(hd => {
    if (hd.trangThai === 0) return;
    const loc   = parseCustomerLocalityDetailed(hd);
    const isSp  = String(hd.maHd || '').toUpperCase().startsWith('SP') || String(hd.maHd || '').toUpperCase().startsWith('HDSP');
    const money = Number(hd.thanhTien || hd.tongTien || 0);

    if (!map.has(loc)) {
      map.set(loc, {
        diaPhuong: loc,
        soHoaDon: 0,
        donSpCount: 0,
        donDvCount: 0,
        tongDoanhThu: 0
      });
    }

    const item = map.get(loc);
    item.soHoaDon += 1;
    if (isSp) item.donSpCount += 1;
    else item.donDvCount += 1;
    item.tongDoanhThu += money;
  });

  const arr = Array.from(map.values()).sort((a, b) => b.tongDoanhThu - a.tongDoanhThu || b.soHoaDon - a.soHoaDon);
  const maxRev = arr.length > 0 ? Math.max(...arr.map(x => x.tongDoanhThu), 1) : 1;
  const mapped = arr.map(x => ({
    ...x,
    percent: Math.round((x.tongDoanhThu / maxRev) * 100)
  }));

  if (showAllLocalities.value) return mapped;
  return mapped.slice(0, 5);
});

const totalLocalitiesCount = computed(() => {
  const map = new Set();
  const allInvoices = [
    ...(stats.value.hoaDonSanPham || []),
    ...(stats.value.hoaDonDichVu || [])
  ];
  allInvoices.forEach(hd => {
    if (hd.trangThai === 0) return;
    map.add(parseCustomerLocalityDetailed(hd));
  });
  return map.size;
});

const openLocalityDetailModal = (locItem) => {
  if (!locItem) return;
  selectedLocalityItem.value = locItem;

  const parseLoc = (hd) => {
    return parseCustomerLocalityDetailed(hd);
  };

  const allInvoices = [
    ...(stats.value.hoaDonSanPham || []),
    ...(stats.value.hoaDonDichVu || [])
  ];

  selectedLocalityInvoices.value = allInvoices.filter(hd => hd.trangThai !== 0 && parseLoc(hd) === locItem.diaPhuong);
  isLocalityModalOpen.value = true;
};

// ── Hourly Customer Distribution & Peak / Off-Peak Analysis ───────────────────
const hourlyAnalysis = computed(() => {
  const hourCounts  = new Array(24).fill(0);
  const hourRevenue = new Array(24).fill(0);

  const allInvoices = [
    ...(stats.value.hoaDonDichVu || []),
    ...(stats.value.hoaDonSanPham || [])
  ];

  allInvoices.forEach(hd => {
    if (hd.trangThai === 0) return;
    if (!hd.ngayTao) return;
    const d = new Date(hd.ngayTao);
    if (isNaN(d.getTime())) return;
    const h = d.getHours();
    if (h >= 0 && h < 24) {
      hourCounts[h]  += 1;
      hourRevenue[h] += (hd.thanhTien || 0);
    }
  });

  const openHours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  
  let peakH     = -1;
  let peakCount = 0;
  let quietH    = -1;
  let minCount  = Infinity;
  const emptyList = [];

  openHours.forEach(h => {
    const c = hourCounts[h];
    if (c > peakCount) {
      peakCount = c;
      peakH     = h;
    }
    if (c === 0) {
      emptyList.push(`${pad(h)}:00 - ${pad(h + 1)}:00`);
    } else if (c < minCount) {
      minCount = c;
      quietH   = h;
    }
  });

  if (peakH === -1) {
    hourCounts.forEach((c, h) => {
      if (c > peakCount) {
        peakCount = c;
        peakH     = h;
      }
    });
  }

  return {
    hourCounts,
    hourRevenue,
    peakHourLabel: peakH !== -1 && peakCount > 0 ? `${pad(peakH)}:00 - ${pad(peakH + 1)}:00` : 'Chưa có dữ liệu',
    peakCount,
    quietHourLabel: quietH !== -1 && minCount < Infinity ? `${pad(quietH)}:00 - ${pad(quietH + 1)}:00 (${minCount} lượt)` : 'Chưa có dữ liệu',
    emptyList,
    emptyText: emptyList.length > 0 ? emptyList.join(', ') : 'Không có khung giờ trống trong giờ mở cửa Salon (08:00 - 21:00)',
    totalInvoices: hourCounts.reduce((a, b) => a + b, 0)
  };
});

const hourlyChartData = computed(() => {
  const counts = hourlyAnalysis.value.hourCounts;
  const labels = Array.from({ length: 14 }, (_, i) => `${pad(i + 8)}:00`);
  const data   = Array.from({ length: 14 }, (_, i) => counts[i + 8]);
  const maxVal = Math.max(...data, 1);

  const bgColors = data.map(val => {
    if (val === 0) return isDarkMode.value ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.7)';
    if (val === maxVal && val > 0) return '#2563eb';
    return isDarkMode.value ? 'rgba(96, 165, 250, 0.65)' : 'rgba(37, 99, 235, 0.45)';
  });

  const borderColors = data.map(val => {
    if (val === 0) return isDarkMode.value ? '#475569' : '#94a3b8';
    if (val === maxVal && val > 0) return '#1d4ed8';
    return '#2563eb';
  });

  return {
    labels,
    datasets: [
      {
        label: 'Số lượt khách / Hóa đơn',
        data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 6,
        borderSkipped: false
      }
    ]
  };
});

const hourlyChartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ` Lượt khách: ${ctx.parsed.y} lượt đơn`
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: isDarkMode.value ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } }
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, color: isDarkMode.value ? '#94a3b8' : '#64748b', font: { family: 'Inter', size: 11 } },
      grid: { color: isDarkMode.value ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.6)' }
    }
  }
}));

// ── Multi-Sheet Excel Export (Xuất đầy đủ báo cáo thống kê) ───────────────────
const exportDashboardExcel = async () => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LGHAIR SALON ADMIN';
    workbook.created = new Date();

    const headerFill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    const headerFont = { color: { argb: 'FFFFFFFF' }, bold: true, size: 11 };
    const numFmtCurrency = '#,##0';
    const numFmtQty = '#,##0';

    // ── SHEET 1: TỔNG QUAN DOANH THU ──
    const wsOverview = workbook.addWorksheet('TongQuan_DoanhThu');
    wsOverview.addRow(['BÁO CÁO TỔNG QUAN DOANH THU LGHAIR SALON']).font = { size: 16, bold: true, color: { argb: 'FF2563EB' } };
    wsOverview.addRow([`Giai đoạn thống kê: Từ ${startDate.value} đến ${endDate.value}`]);
    wsOverview.addRow([]);

    const rKpiHeader = wsOverview.addRow(['Chỉ Số KPI', 'Giá Trị']);
    rKpiHeader.font = headerFont;
    rKpiHeader.eachCell(c => c.fill = headerFill);

    const rowKpi1 = wsOverview.addRow(['Tổng Doanh Thu Giai Đoạn', Number(totalRevenue.value || 0)]);
    rowKpi1.getCell(2).numFmt = numFmtCurrency;

    const rowKpi2 = wsOverview.addRow(['Tổng Số Hóa Đơn', (stats.value.hoaDonSanPham?.length || 0) + (stats.value.hoaDonDichVu?.length || 0)]);
    rowKpi2.getCell(2).numFmt = numFmtQty;

    const rowKpi3 = wsOverview.addRow(['Số Voucher Đã Dùng', Number(stats.value.soVoucherDaDung || 0)]);
    rowKpi3.getCell(2).numFmt = numFmtQty;

    wsOverview.addRow([]);
    wsOverview.addRow(['BIỂU ĐỒ DOANH THU TỪNG NGÀY']).font = { bold: true };
    const rHeader1 = wsOverview.addRow(['STT', 'Ngày', 'Doanh Thu (₫)']);
    rHeader1.font = headerFont;
    rHeader1.eachCell(c => c.fill = headerFill);

    (stats.value.bieuDo || []).forEach((b, idx) => {
      const rawRev = Number(b.doanhThu || 0);
      const row = wsOverview.addRow([idx + 1, b.ngay, isNaN(rawRev) ? 0 : rawRev]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = numFmtCurrency;
    });

    // ── SHEET 2: TOP SẢN PHẨM BÁN CHẠY ──
    const wsSp = workbook.addWorksheet('Top_SanPham');
    wsSp.addRow(['BÁO CÁO TOP SẢN PHẨM BÁN CHẠY NHẤT']).font = { size: 14, bold: true };
    const rHeaderSp = wsSp.addRow(['Xếp Hạng', 'Tên Sản Phẩm', 'Số Lượng Bán', 'Số Lượt Đơn', 'Tổng Doanh Thu (₫)', 'Tỷ Trọng (%)']);
    rHeaderSp.font = headerFont;
    rHeaderSp.eachCell(c => c.fill = headerFill);

    topSellingProducts.value.forEach((sp, idx) => {
      const row = wsSp.addRow([idx + 1, sp.ten, Number(sp.soLuong || 0), Number(sp.luotDon || 0), Number(sp.doanhThu || 0), Number(sp.percent || 0) / 100]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = numFmtQty;
      row.getCell(4).numFmt = numFmtQty;
      row.getCell(5).numFmt = numFmtCurrency;
      row.getCell(6).numFmt = '0.0%';
    });

    // ── SHEET 3: TOP DỊCH VỤ HOT NHẤT ──
    const wsDv = workbook.addWorksheet('Top_DichVu');
    wsDv.addRow(['BÁO CÁO TOP DỊCH VỤ ĐẶT NHIỀU NHẤT']).font = { size: 14, bold: true };
    const rHeaderDv = wsDv.addRow(['Xếp Hạng', 'Tên Dịch Vụ', 'Số Lượt Thực Hiện', 'Số Lượt Đơn', 'Tổng Doanh Thu (₫)', 'Tỷ Trọng (%)']);
    rHeaderDv.font = headerFont;
    rHeaderDv.eachCell(c => c.fill = headerFill);

    topSellingServices.value.forEach((dv, idx) => {
      const row = wsDv.addRow([idx + 1, dv.ten, Number(dv.soLuong || 0), Number(dv.luotDon || 0), Number(dv.doanhThu || 0), Number(dv.percent || 0) / 100]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = numFmtQty;
      row.getCell(4).numFmt = numFmtQty;
      row.getCell(5).numFmt = numFmtCurrency;
      row.getCell(6).numFmt = '0.0%';
    });

    // ── SHEET 4: TOP KHÁCH HÀNG THÂN THIẾT ──
    const wsKh = workbook.addWorksheet('Top_KhachHang');
    wsKh.addRow(['BÁO CÁO TOP KHÁCH HÀNG CHI TIÊU & ĐẶT NHIỀU NHẤT']).font = { size: 14, bold: true };
    const rHeaderKh = wsKh.addRow(['Xếp Hạng', 'Tên Khách Hàng', 'Tổng Hóa Đơn', 'Đơn Sản Phẩm', 'Đơn Dịch Vụ', 'Tổng Chi Tiêu (₫)']);
    rHeaderKh.font = headerFont;
    rHeaderKh.eachCell(c => c.fill = headerFill);

    topCustomers.value.forEach((kh, idx) => {
      const row = wsKh.addRow([idx + 1, kh.tenKh, Number(kh.soHoaDon || 0), Number(kh.donSpCount || 0), Number(kh.donDvCount || 0), Number(kh.tongChiTieu || 0)]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = numFmtQty;
      row.getCell(4).numFmt = numFmtQty;
      row.getCell(5).numFmt = numFmtQty;
      row.getCell(6).numFmt = numFmtCurrency;
    });

    // ── SHEET 5: THỐNG KÊ ĐỊA PHƯƠNG / KHU VỰC ──
    const wsLoc = workbook.addWorksheet('ThongKe_DiaPhuong');
    wsLoc.addRow(['BÁO CÁO THỐNG KÊ ĐƠN HÀNG THEO ĐỊA PHƯƠNG / KHU VỰC']).font = { size: 14, bold: true };
    const rHeaderLoc = wsLoc.addRow(['Xếp Hạng', 'Địa Phương / Khu Vực', 'Tổng Số Đơn', 'Đơn Sản Phẩm', 'Đơn Dịch Vụ', 'Tổng Doanh Thu (₫)']);
    rHeaderLoc.font = headerFont;
    rHeaderLoc.eachCell(c => c.fill = headerFill);

    localityAnalysis.value.forEach((loc, idx) => {
      const row = wsLoc.addRow([idx + 1, loc.diaPhuong, Number(loc.soHoaDon || 0), Number(loc.donSpCount || 0), Number(loc.donDvCount || 0), Number(loc.tongDoanhThu || 0)]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).numFmt = numFmtQty;
      row.getCell(4).numFmt = numFmtQty;
      row.getCell(5).numFmt = numFmtQty;
      row.getCell(6).numFmt = numFmtCurrency;
    });

    // ── SHEET 6: THỐNG KÊ KHUNG GIỜ KHÁCH HÀNG ──
    const wsHour = workbook.addWorksheet('KhungGio_KhachHang');
    wsHour.addRow(['BÁO CÁO PHÂN BỐ KHÁCH HÀNG THEO KHUNG GIỜ']).font = { size: 14, bold: true };
    const rHeaderHour = wsHour.addRow(['Khung Giờ', 'Số Lượt Khách (Đơn)', 'Tổng Doanh Thu (₫)', 'Đánh Giá']);
    rHeaderHour.font = headerFont;
    rHeaderHour.eachCell(c => c.fill = headerFill);

    const hourData = hourlyAnalysis.value;
    for (let h = 8; h <= 20; h++) {
      const label = `${pad(h)}:00 - ${pad(h + 1)}:00`;
      const count = Number(hourData.hourCounts[h] || 0);
      const rev   = Number(hourData.hourRevenue[h] || 0);
      let status  = 'Bình thường';
      if (count === hourData.peakCount && count > 0) status = 'Cao điểm nhất';
      else if (count === 0) status = 'Trống (Không có khách)';

      const row = wsHour.addRow([label, count, rev, status]);
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(2).numFmt = numFmtQty;
      row.getCell(3).numFmt = numFmtCurrency;
    }

    // Auto-fit column widths for all sheets
    workbook.worksheets.forEach(ws => {
      ws.columns.forEach(col => {
        let maxLen = 12;
        col.eachCell({ includeEmpty: true }, cell => {
          const val = cell.value ? cell.value.toString() : '';
          if (val.length > maxLen) maxLen = Math.min(val.length + 4, 40);
        });
        col.width = maxLen;
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `Bao_Cao_Thong_Ke_LGHAIR_${startDate.value}_den_${endDate.value}.xlsx`);

    logActivity(
      'Xuất Excel Thống Kê',
      `Đã xuất tệp Excel báo cáo thống kê đầy đủ giai đoạn ${startDate.value} đến ${endDate.value}`,
      'Dashboard'
    );
  } catch (err) {
    console.error('Lỗi xuất Excel:', err);
    alert('Không thể xuất tệp Excel báo cáo.');
  }
};

// ── Chart ─────────────────────────────────────────────────────────────────────
const chartData = computed(() => ({
  labels  : stats.value.bieuDo?.map(i => i.ngay) ?? [],
  datasets: [{
    label          : 'Doanh thu (₫)',
    data           : stats.value.bieuDo?.map(i => i.doanhThu) ?? [],
    borderColor    : '#2563eb',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderWidth    : 3,
    pointBackgroundColor: '#2563eb',
    pointBorderColor: '#ffffff',
    pointBorderWidth: 2,
    pointRadius: 4,
    pointHoverRadius: 6,
    fill           : true,
    tension        : 0.3
  }]
}));

const chartOptions = {
  responsive           : true,
  maintainAspectRatio  : false,
  plugins: {
    legend : { display: false },
    tooltip: {
      backgroundColor: '#1e293b',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: (ctx) => ' Doanh thu: ' + formatCurrency(ctx.parsed.y)
      }
    }
  },
  scales: {
    x: { 
      grid: { display: false }, 
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } } 
    },
    y: { 
      beginAtZero: true, 
      grid: { color: 'rgba(226, 232, 240, 0.6)' }, 
      ticks: { color: '#64748b', font: { family: 'Inter', size: 11 }, callback: (v) => formatCurrency(v) } 
    }
  }
};

// ── API ───────────────────────────────────────────────────────────────────────
const fetchAdminData = async () => {
  try {
    loading.value = true;
    error.value   = null;
    pageSP.value  = 1;
    pageDV.value  = 1;

    const params = {
      startDate : startDate.value,
      endDate   : endDate.value
    };
    if (searchMaHd.value && searchMaHd.value.trim() !== '') {
      params.searchMaHd = searchMaHd.value.trim();
    }
    const qs = new URLSearchParams(params).toString();

    const res = await fetch(API + `/api/ThongKe/admin-dashboard?${qs}`, {
      method : 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) throw new Error(`Lỗi ${res.status}: Không thể tải dữ liệu thống kê`);
    stats.value = await res.json();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

const fetchTopYeuThich = async () => {
  try {
    loadingYeuThich.value = true;
    const res = await fetch(API + '/api/QuanLyDanhGiaDichVu/thong-ke-nhan-vien', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      data.sort((a, b) => {
        if (b.diemTrungBinh !== a.diemTrungBinh) {
          return b.diemTrungBinh - a.diemTrungBinh;
        }
        return b.luotDanhGia - a.luotDanhGia;
      });
      topYeuThich.value = data.slice(0, 5);
    }
  } catch (err) {
    console.error('Lỗi lấy top nhân viên yêu thích:', err);
  } finally {
    loadingYeuThich.value = false;
  }
};

// ── Invoice Details Modal Logic ──
const isModalOpen = ref(false);
const selectedHd = ref(null);

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('adminToken')
             || localStorage.getItem('accessToken') 
             || localStorage.getItem('token') 
             || sessionStorage.getItem('accessToken') 
             || sessionStorage.getItem('token');
  return { 'Authorization': `Bearer ${token}` };
};

const getInvoiceItems = (hd) => {
  if (!hd) return [];
  const list = hd.chiTiet || hd.ChiTiet || hd.chiTietDichVu || hd.ChiTietDichVu || [];
  if (Array.isArray(list) && list.length > 0) return list;
  return [];
};

const getItemName = (item) => {
  if (!item) return 'Hạng mục Salon';
  return item.ten || item.Ten || item.tenHangMuc || item.TenHangMuc || item.tenSP || item.tenSp || item.tenDichVu || item.TenDichVu || 'Dịch vụ Salon';
};

const getItemQty = (item) => {
  if (!item) return 1;
  return item.soLuong || item.SoLuong || item.soluong || 1;
};

const getItemPrice = (item) => {
  if (!item) return 0;
  if (item.thanhTien != null) return Number(item.thanhTien);
  if (item.ThanhTien != null) return Number(item.ThanhTien);
  const gia = Number(item.gia || item.Gia || item.giaBan || item.GiaBan || 0);
  const sl = getItemQty(item);
  return gia * sl;
};

const isInvoiceModalOpen = ref(false);
const selectedInvoiceMaHd = ref('');

const viewDetail = (maHd) => {
  if (!maHd) return;
  selectedInvoiceMaHd.value = maHd;
  isInvoiceModalOpen.value = true;
  logActivity('Xem chi tiết hóa đơn', `Xem chi tiết hóa đơn #${maHd}`, 'Hóa đơn');
};

const resetFilter = () => {
  logActivity('Đặt lại bộ lọc Dashboard', `Đặt lại toàn bộ bộ lọc trang Tổng quan Salon về mặc định:
• Ngày bắt đầu: "${fmtInput(firstDay)}"
• Ngày kết thúc: "${fmtInput(today)}"
• Từ khóa tìm kiếm: "Đã xóa"`, 'Hóa đơn');
  startDate.value  = fmtInput(firstDay);
  endDate.value    = fmtInput(today);
  searchMaHd.value = '';
  fetchAdminData();
  fetchTopYeuThich();
};

onMounted(() => {
  fetchAdminData();
  fetchTopYeuThich();
});
</script>

<template>
  <v-container fluid class="pa-5">

    <!-- ═══════ HEADER CARD ═══════ -->
    <v-card elevation="2" rounded="xl" class="pa-6 mb-6">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <LayoutDashboard class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h1 class="text-h5 font-weight-bold mb-1">Tổng Quan Salon</h1>
            <p class="text-subtitle-2 text-medium-emphasis mb-0">
              Báo cáo hiệu suất kinh doanh, doanh thu và xếp hạng theo khoảng thời gian
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2 flex-wrap">
          <v-btn
            color="success"
            variant="flat"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold px-4"
            @click="exportDashboardExcel"
          >
            <template v-slot:prepend>
              <FileDown class="w-4 h-4 mr-1" />
            </template>
            Xuất Báo Cáo Excel
          </v-btn>

          <v-btn
            variant="outlined"
            color="grey-darken-1"
            height="40"
            rounded="lg"
            class="text-none font-weight-bold"
            :loading="loading"
            @click="() => { fetchAdminData(); fetchTopYeuThich(); }"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Làm mới
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════ FILTERS CARD ═══════ -->
    <v-card variant="outlined" rounded="xl" class="pa-4 mb-6 bg-surface">
      <div class="d-flex flex-column gap-3">
        <!-- Hàng 1: Nút chọn nhanh bộ lọc Ngày/Tháng/Năm -->
        <div class="d-flex align-center justify-space-between flex-wrap gap-2 pb-2 border-b">
          <div class="d-flex align-center gap-2 flex-wrap">
            <span class="text-caption font-weight-bold text-uppercase text-medium-emphasis mr-1">
              <Calendar class="w-4 h-4 d-inline-block align-text-top text-primary mr-1" /> Bộ lọc nhanh:
            </span>
            <v-chip-group v-model="filterPreset" selected-class="bg-primary text-white" mandatory class="pa-0">
              <v-chip size="small" value="today" variant="tonal" filter @click="applyPreset('today')">Hôm nay</v-chip>
              <v-chip size="small" value="last7" variant="tonal" filter @click="applyPreset('last7')">7 ngày qua</v-chip>
              <v-chip size="small" value="thisMonth" variant="tonal" filter @click="applyPreset('thisMonth')">Tháng này</v-chip>
              <v-chip size="small" value="lastMonth" variant="tonal" filter @click="applyPreset('lastMonth')">Tháng trước</v-chip>
              <v-chip size="small" value="thisYear" variant="tonal" filter @click="applyPreset('thisYear')">Năm nay</v-chip>
            </v-chip-group>
          </div>

          <div class="d-flex align-center gap-2">
            <!-- Chọn Tháng -->
            <v-select
              v-model="selectedMonth"
              :items="monthOptions"
              label="Chọn Tháng"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="width: 140px;"
              @update:model-value="handleMonthYearChange"
            ></v-select>

            <!-- Chọn Năm -->
            <v-select
              v-model="selectedYear"
              :items="yearOptions"
              label="Năm"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="width: 110px;"
              @update:model-value="handleYearChange"
            ></v-select>
          </div>
        </div>

        <!-- Hàng 2: Nhập khoảng ngày & Tìm kiếm mã đơn -->
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
          <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
            <!-- Từ ngày -->
            <v-text-field
              v-model="startDate"
              label="Từ ngày"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="width: 160px;"
            ></v-text-field>

            <!-- Đến ngày -->
            <v-text-field
              v-model="endDate"
              label="Đến ngày"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="lg"
              style="width: 160px;"
            ></v-text-field>

            <!-- Tìm mã HD -->
            <v-text-field
              v-model="searchMaHd"
              placeholder="Tìm theo mã hóa đơn (VD: SP001, HD002)..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              style="min-width: 260px; max-width: 380px;"
              @keyup.enter="fetchAdminData"
            >
              <template v-slot:prepend-inner>
                <Search class="w-4 h-4 text-medium-emphasis mr-1 shrink-0" />
              </template>
            </v-text-field>

            <v-btn
              color="primary"
              variant="flat"
              height="40"
              rounded="lg"
              class="text-none font-weight-bold px-4"
              :loading="loading"
              @click="fetchAdminData"
            >
              <template v-slot:prepend>
                <Filter class="w-4 h-4 mr-1 shrink-0" />
              </template>
              Lọc Dữ Liệu
            </v-btn>
          </div>

          <v-btn
            variant="text"
            color="primary"
            rounded="lg"
            class="text-none font-weight-bold"
            height="40"
            @click="resetFilter"
          >
            <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
            Đặt lại lọc
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ── Loading / Error ─────────────────────────────────────────────────── -->
    <div v-if="loading" class="d-flex justify-center align-center py-16">
      <v-progress-circular indeterminate color="primary" size="48" />
    </div>

    <v-alert v-else-if="error" type="error" variant="tonal" class="mb-5" border="start">
      <strong>Lỗi tải dữ liệu:</strong> {{ error }}
      <template #append>
        <v-btn size="small" variant="text" @click="fetchAdminData">Thử lại</v-btn>
      </template>
    </v-alert>

    <!-- ── Nội dung chính ──────────────────────────────────────────────────── -->
    <template v-else>

      <!-- ── Stat Cards ──────────────────────────────────────────────────── -->
      <v-row class="mb-4">
        <v-col v-for="(card, i) in statCards" :key="i" cols="12" sm="4">
          <v-card elevation="0" border>
            <v-card-text class="pa-5">
              <div class="d-flex align-center justify-space-between">
                <div>
                  <p class="text-body-2 text-medium-emphasis mb-1">{{ card.label }}</p>
                  <p class="text-h5 font-weight-bold">{{ card.value }}</p>
                </div>
                <v-avatar :color="card.bg" size="52" rounded="lg">
                  <component :is="card.iconComponent" class="w-6 h-6" :style="{ color: card.iconColor }" />
                </v-avatar>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── Biểu đồ + Top NV ────────────────────────────────────────────── -->
      <v-row class="mb-4">

        <!-- Biểu đồ doanh thu theo ngày -->
        <v-col cols="12" lg="8">
          <v-card elevation="0" border height="100%">
            <v-card-item class="px-5 py-4 border-b">
              <template #prepend>
                <TrendingUp class="w-5 h-5 text-blue-600 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Doanh thu theo ngày</v-card-title>
              <template #append>
                <v-chip size="x-small" color="primary" variant="tonal">
                  {{ stats.bieuDo?.length ?? 0 }} ngày
                </v-chip>
              </template>
            </v-card-item>
            <v-card-text class="pa-5">
              <div style="height: 280px; position: relative;">
                <Line
                  v-if="stats.bieuDo && stats.bieuDo.length > 0"
                  :data="chartData"
                  :options="chartOptions"
                />
                <div
                  v-else
                  class="d-flex flex-column align-center justify-center text-medium-emphasis"
                  style="height: 100%;"
                >
                  <TrendingUp class="w-10 h-10 text-slate-300" />
                  <p class="mt-3 text-body-2">Không có dữ liệu trong khoảng thời gian này</p>
                </div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Top Nhân viên (Doanh thu & Yêu thích) -->
        <v-col cols="12" lg="4">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-tabs v-model="staffTab" color="primary" class="border-b" align-tabs="center">
              <v-tab value="revenue" class="text-none font-weight-bold">
                <template #prepend>
                  <Trophy class="w-4 h-4 text-amber-500 mr-1.5" />
                </template>
                Top Doanh Thu
              </v-tab>
              <v-tab value="rating" class="text-none font-weight-bold">
                <template #prepend>
                  <Star class="w-4 h-4 text-primary mr-1.5" />
                </template>
                Top Yêu Thích
              </v-tab>
            </v-tabs>

            <v-card-text class="pa-4 flex-grow-1">
              <v-window v-model="staffTab">
                
                <!-- Tab: Top theo Doanh thu -->
                <v-window-item value="revenue">
                  <div
                    v-if="!stats.topNhanVien || stats.topNhanVien.length === 0"
                    class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis"
                  >
                    <Users class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(nv, idx) in stats.topNhanVien"
                      :key="idx"
                      class="px-0 py-2"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ nv.tenNhanVien }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ nv.soHoaDonPhuTrach }} hóa đơn
                      </v-list-item-subtitle>

                      <template #append>
                        <span class="text-body-2 font-weight-bold text-primary">
                          {{ formatCurrency(nv.doanhThuMangLai) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>

                <!-- Tab: Top theo Yêu thích (Đánh giá) -->
                <v-window-item value="rating">
                  <div
                    v-if="loadingYeuThich"
                    class="d-flex justify-center align-center py-16"
                  >
                    <v-progress-circular indeterminate color="primary" size="24" />
                  </div>
                  <div
                    v-else-if="!topYeuThich || topYeuThich.length === 0"
                    class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis"
                  >
                    <Users class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu đánh giá</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(nv, idx) in topYeuThich"
                      :key="idx"
                      class="px-0 py-2"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ nv.tenNhanVien }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ nv.luotDanhGia }} lượt đánh giá
                      </v-list-item-subtitle>

                      <template #append>
                        <div class="d-flex align-center">
                          <span class="text-body-2 font-weight-bold text-amber-600 mr-1">
                            {{ nv.diemTrungBinh }}
                          </span>
                          <Star class="w-4 h-4 text-amber-500 fill-amber-500" />
                        </div>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>
              </v-window>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ── HÀNG 2: THỐNG KÊ TOP BÁN CHẠY & KHUNG GIỜ KHÁCH HÀNG ═══════ -->
      <v-row class="mb-4">

        <!-- 1. WIDGET: TOP SẢN PHẨM & DỊCH VỤ BÁN CHẠY NHẤT -->
        <v-col cols="12" lg="6">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-card-item class="px-5 py-3 border-b">
              <template #prepend>
                <Trophy class="w-5 h-5 text-amber-500 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Bán Chạy & Được Mua Nhiều Nhất</v-card-title>
              <template #append>
                <v-btn-toggle v-model="topTab" mandatory color="primary" density="compact" rounded="lg">
                  <v-btn value="sanpham" size="x-small" class="text-none font-weight-bold">
                    <ShoppingBag class="w-3.5 h-3.5 mr-1" /> Sản Phẩm
                  </v-btn>
                  <v-btn value="dichvu" size="x-small" class="text-none font-weight-bold">
                    <Scissors class="w-3.5 h-3.5 mr-1" /> Dịch Vụ
                  </v-btn>
                </v-btn-toggle>
              </template>
            </v-card-item>

            <v-card-text class="pa-4 flex-grow-1">
              <v-window v-model="topTab">

                <!-- Tab: Top Sản Phẩm Bán Chạy -->
                <v-window-item value="sanpham">
                  <div v-if="topSellingProducts.length === 0" class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                    <ShoppingBag class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu bán sản phẩm trong khoảng thời gian này</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(item, idx) in topSellingProducts"
                      :key="idx"
                      class="px-0 py-2 border-b"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ item.ten }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ item.soLuong }} sản phẩm · {{ item.luotDon }} đơn
                      </v-list-item-subtitle>

                      <template #append>
                        <span class="text-body-2 font-weight-bold text-success">
                          {{ formatCurrency(item.doanhThu) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>

                <!-- Tab: Top Dịch Vụ Được Đặt Nhiều Nhất -->
                <v-window-item value="dichvu">
                  <div v-if="topSellingServices.length === 0" class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                    <Scissors class="w-10 h-10 text-slate-300" />
                    <p class="mt-2 text-body-2">Chưa có dữ liệu thực hiện dịch vụ trong khoảng thời gian này</p>
                  </div>

                  <v-list v-else lines="two" class="pa-0">
                    <v-list-item
                      v-for="(item, idx) in topSellingServices"
                      :key="idx"
                      class="px-0 py-2 border-b"
                    >
                      <template #prepend>
                        <v-avatar
                          size="36"
                          :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                          class="mr-3 font-weight-bold text-body-2"
                        >
                          {{ idx + 1 }}
                        </v-avatar>
                      </template>

                      <v-list-item-title class="text-body-2 font-weight-semibold">
                        {{ item.ten }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        {{ item.soLuong }} lượt dịch vụ · {{ item.luotDon }} đơn
                      </v-list-item-subtitle>

                      <template #append>
                        <span class="text-body-2 font-weight-bold text-primary">
                          {{ formatCurrency(item.doanhThu) }}
                        </span>
                      </template>
                    </v-list-item>
                  </v-list>
                </v-window-item>

              </v-window>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- 2. WIDGET: THỐNG KÊ KHUNG GIỜ KHÁCH HÀNG (CAO ĐIỂM & VẮNG KHÁCH) -->
        <v-col cols="12" lg="6">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-card-item class="px-5 py-3 border-b">
              <template #prepend>
                <Clock class="w-5 h-5 text-blue-600 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Khung Giờ Đông & Vắng Khách</v-card-title>
              <template #append>
                <v-chip size="x-small" color="info" variant="tonal" class="font-weight-bold">
                  Tổng {{ hourlyAnalysis.totalInvoices }} lượt khách
                </v-chip>
              </template>
            </v-card-item>

            <v-card-text class="pa-5 flex-grow-1 d-flex flex-column gap-4">
              <!-- Grid các thẻ chỉ số KPI Khung Giờ -->
              <v-row density="compact">
                <!-- Giờ Cao Điểm -->
                <v-col cols="12" sm="6">
                  <v-card variant="tonal" color="blue" rounded="lg" class="pa-3">
                    <div class="d-flex align-center gap-3">
                      <v-avatar color="primary" variant="flat" size="36" rounded="lg">
                        <Flame class="w-5 h-5 text-white" />
                      </v-avatar>
                      <div>
                        <p class="text-caption text-medium-emphasis mb-0 font-weight-bold text-uppercase">Khung Giờ Nhiều Khách Nhất</p>
                        <p class="text-subtitle-1 font-weight-black mb-0 text-primary">
                          {{ hourlyAnalysis.peakHourLabel }}
                          <v-chip v-if="hourlyAnalysis.peakCount > 0" size="x-small" color="primary" class="ml-1 font-weight-bold">
                            {{ hourlyAnalysis.peakCount }} khách
                          </v-chip>
                        </p>
                      </div>
                    </div>
                  </v-card>
                </v-col>

                <!-- Giờ Vắng Khách -->
                <v-col cols="12" sm="6">
                  <v-card variant="tonal" color="amber" rounded="lg" class="pa-3">
                    <div class="d-flex align-center gap-3">
                      <v-avatar color="amber-darken-2" variant="flat" size="36" rounded="lg">
                        <Moon class="w-5 h-5 text-white" />
                      </v-avatar>
                      <div>
                        <p class="text-caption text-medium-emphasis mb-0 font-weight-bold text-uppercase">Khung Giờ Vắng Khách</p>
                        <p class="text-subtitle-1 font-weight-bold mb-0 text-amber-darken-3">
                          {{ hourlyAnalysis.quietHourLabel }}
                        </p>
                      </div>
                    </div>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Khung Giờ Trống (Không có khách) -->
              <div v-if="hourlyAnalysis.emptyList.length > 0" class="pa-3 rounded-lg border bg-surface d-flex align-center gap-2">
                <Coffee class="w-4 h-4 text-warning shrink-0" />
                <div class="text-caption text-truncate">
                  <strong class="text-warning">Khung giờ không có khách:</strong> {{ hourlyAnalysis.emptyText }}
                </div>
              </div>

              <!-- Biểu Đồ Cột Phân Bố Khung Giờ trong ngày -->
              <div style="height: 180px; position: relative;" class="mt-auto pt-2">
                <Bar :data="hourlyChartData" :options="hourlyChartOptions" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>

      </v-row>

      <!-- ── HÀNG 3: THỐNG KÊ TOP KHÁCH HÀNG & THEO ĐỊA PHƯƠNG ═══════ -->
      <v-row class="mb-6">

        <!-- WIDGET 1: TOP KHÁCH HÀNG ĐẶT NHIỀU NHẤT -->
        <v-col cols="12" lg="6">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-card-item class="px-5 py-3 border-b">
              <template #prepend>
                <UserCheck class="w-5 h-5 text-purple-600 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Top Khách Hàng Thân Thiết</v-card-title>
              <template #append>
                <v-chip size="x-small" color="purple" variant="tonal" class="font-weight-bold">
                  {{ topCustomers.length }} VIP
                </v-chip>
              </template>
            </v-card-item>

            <v-card-text class="pa-4 flex-grow-1">
              <div v-if="topCustomers.length === 0" class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                <Users class="w-10 h-10 text-slate-300" />
                <p class="mt-2 text-body-2">Chưa có dữ liệu khách hàng trong khoảng thời gian này</p>
              </div>

              <v-list v-else lines="two" class="pa-0">
                <v-list-item
                  v-for="(kh, idx) in topCustomers"
                  :key="idx"
                  class="px-0 py-2 border-b"
                  style="cursor: pointer;"
                  @click="openCustomerDetailModal(kh)"
                >
                  <template #prepend>
                    <v-avatar
                      size="36"
                      :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                      class="mr-3 font-weight-bold text-body-2"
                    >
                      {{ idx + 1 }}
                    </v-avatar>
                  </template>

                  <v-list-item-title class="text-body-2 font-weight-semibold">
                    {{ kh.tenKh }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    {{ kh.soHoaDon }} đơn hàng ({{ kh.donSpCount }} SP / {{ kh.donDvCount }} DV)
                  </v-list-item-subtitle>

                  <template #append>
                    <span class="text-body-2 font-weight-bold text-primary">
                      {{ formatCurrency(kh.tongChiTieu) }}
                    </span>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- WIDGET 2: THỐNG KÊ THEO ĐỊA PHƯƠNG / KHU VỰC -->
        <v-col cols="12" lg="6">
          <v-card elevation="0" border height="100%" class="d-flex flex-column">
            <v-card-item class="px-5 py-3 border-b">
              <template #prepend>
                <MapPin class="w-5 h-5 text-emerald-600 mr-2" />
              </template>
              <v-card-title class="text-body-1 font-weight-bold">Khách Hàng Theo Địa Phương Nơi Ở (Phường / Xã / Tỉnh)</v-card-title>
              <template #append>
                <v-btn
                  size="x-small"
                  color="success"
                  variant="tonal"
                  class="font-weight-bold text-none"
                  @click="showAllLocalities = !showAllLocalities"
                >
                  {{ showAllLocalities ? 'Thu gọn (Top 5)' : `Xem tất cả (${totalLocalitiesCount} Phường/Xã)` }}
                </v-btn>
              </template>
            </v-card-item>

            <v-card-text class="pa-4 flex-grow-1">
              <div v-if="localityAnalysis.length === 0" class="d-flex flex-column align-center justify-center py-10 text-medium-emphasis">
                <MapPin class="w-10 h-10 text-slate-300" />
                <p class="mt-2 text-body-2">Chưa có dữ liệu địa phương trong khoảng thời gian này</p>
              </div>

              <v-list v-else lines="two" class="pa-0">
                <v-list-item
                  v-for="(loc, idx) in localityAnalysis"
                  :key="idx"
                  class="px-0 py-2 border-b"
                  style="cursor: pointer;"
                  @click="openLocalityDetailModal(loc)"
                >
                  <template #prepend>
                    <v-avatar
                      size="36"
                      :color="idx === 0 ? 'amber' : idx === 1 ? 'blue-grey-lighten-3' : idx === 2 ? 'deep-orange-lighten-3' : 'grey-lighten-3'"
                      class="mr-3 font-weight-bold text-body-2"
                    >
                      {{ idx + 1 }}
                    </v-avatar>
                  </template>

                  <v-list-item-title class="text-body-2 font-weight-semibold">
                    {{ loc.diaPhuong }}
                  </v-list-item-title>
                  <v-list-item-subtitle class="text-caption">
                    {{ loc.soHoaDon }} đơn hàng ({{ loc.donSpCount }} SP / {{ loc.donDvCount }} DV)
                  </v-list-item-subtitle>

                  <template #append>
                    <span class="text-body-2 font-weight-bold text-success">
                      {{ formatCurrency(loc.tongDoanhThu) }}
                    </span>
                  </template>
                </v-list-item>
              </v-list>
            </v-card-text>
          </v-card>
        </v-col>

      </v-row>

      <!-- ── Bảng hóa đơn (tab SP / DV) ────────────────────────────────── -->
      <v-card elevation="0" border>
        <v-card-item class="px-5 py-4 border-b">
          <template #prepend>
            <Receipt class="w-5 h-5 text-blue-500 mr-2" />
          </template>
          <v-card-title class="text-body-1 font-weight-bold">Danh sách hóa đơn</v-card-title>
          <template #append>
            <v-chip size="x-small" color="info" variant="tonal">
              Tổng: {{ (stats.hoaDonSanPham?.length ?? 0) + (stats.hoaDonDichVu?.length ?? 0) }} đơn
            </v-chip>
          </template>
        </v-card-item>

        <v-tabs v-model="activeTab" color="primary" class="border-b">
          <v-tab value="dichvu">
            <template #prepend>
              <Scissors class="w-4 h-4 mr-1.5" />
            </template>
            Dịch vụ Salon
            <v-chip size="x-small" class="ml-2" color="success" variant="tonal">
              {{ stats.hoaDonDichVu?.length ?? 0 }}
            </v-chip>
          </v-tab>
          <v-tab value="sanpham">
            <template #prepend>
              <ShoppingBag class="w-4 h-4 mr-1.5" />
            </template>
            Sản phẩm
            <v-chip size="x-small" class="ml-2" color="primary" variant="tonal">
              {{ stats.hoaDonSanPham?.length ?? 0 }}
            </v-chip>
          </v-tab>
        </v-tabs>

        <v-window v-model="activeTab">

          <!-- Tab: Hóa đơn Dịch vụ -->
          <v-window-item value="dichvu">
            <div v-if="pagedDV.length === 0" class="d-flex flex-column align-center py-12 text-medium-emphasis">
              <Scissors class="w-10 h-10 text-slate-300" />
              <p class="mt-3 text-body-2">Không có hóa đơn dịch vụ nào</p>
            </div>

            <v-table v-else fixed-header hover class="border rounded-xl">
              <thead>
                <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Mã HĐ</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Khách hàng</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Ngày tạo</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Tổng tiền</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Thành tiền</th>
                  <th class="text-center font-weight-bold text-caption text-uppercase py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hd in pagedDV" :key="hd.maHd" @click="viewDetail(hd.maHd)" style="cursor: pointer;">
                  <td>
                    <span class="font-weight-medium text-success">{{ hd.maHd }}</span>
                  </td>
                  <td>{{ hd.khachHang }}</td>
                  <td>{{ formatDate(hd.ngayTao) }}</td>
                  <td class="text-right">{{ formatCurrency(hd.tongTien) }}</td>
                  <td class="text-right font-weight-semibold">{{ formatCurrency(hd.thanhTien) }}</td>
                  <td class="text-center">
                    <v-chip :color="trangThaiColor(hd.trangThai)" size="x-small" variant="tonal">
                      {{ trangThaiLabel(hd.trangThai) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="totalPagesDV > 1" class="d-flex justify-center pa-4">
              <v-pagination
                v-model="pageDV"
                :length="totalPagesDV"
                :total-visible="6"
                density="compact"
                color="success"
              />
            </div>
          </v-window-item>

          <!-- Tab: Hóa đơn Sản phẩm -->
          <v-window-item value="sanpham">
            <div v-if="pagedSP.length === 0" class="d-flex flex-column align-center py-12 text-medium-emphasis">
              <ShoppingBag class="w-10 h-10 text-slate-300" />
              <p class="mt-3 text-body-2">Không có hóa đơn sản phẩm nào</p>
            </div>

            <v-table v-else fixed-header hover class="border rounded-xl">
              <thead>
                <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Mã HĐ</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Khách hàng</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Ngày tạo</th>
                  <th class="text-left font-weight-bold text-caption text-uppercase py-3">Chi tiết</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Tổng tiền</th>
                  <th class="text-right font-weight-bold text-caption text-uppercase py-3">Thành tiền</th>
                  <th class="text-center font-weight-bold text-caption text-uppercase py-3">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hd in pagedSP" :key="hd.maHd" @click="viewDetail(hd.maHd)" style="cursor: pointer;">
                  <td>
                    <span class="font-weight-medium text-primary">{{ hd.maHd }}</span>
                  </td>
                  <td>{{ hd.khachHang }}</td>
                  <td>{{ formatDate(hd.ngayTao) }}</td>
                  <td>
                    <v-tooltip location="right" :disabled="!(hd.chiTiet || hd.ChiTiet) || (hd.chiTiet || hd.ChiTiet).length === 0">
                      <template #activator="{ props }">
                        <v-chip v-bind="props" size="x-small" variant="tonal" color="info" prepend-icon="mdi-package-variant" @click.stop>
                          {{ (hd.chiTiet || hd.ChiTiet)?.reduce((sum, ct) => sum + (ct.soLuong || ct.SoLuong || 0), 0) ?? 0 }} sp
                        </v-chip>
                      </template>
                      <div>
                        <div v-for="(ct, ci) in (hd.chiTiet || hd.ChiTiet)" :key="ci" class="text-caption py-1">
                          • {{ ct.ten || ct.Ten }} &times; {{ ct.soLuong || ct.SoLuong }} — {{ formatCurrency(ct.gia || ct.Gia) }}
                        </div>
                      </div>
                    </v-tooltip>
                  </td>
                  <td class="text-right">{{ formatCurrency(hd.tongTien) }}</td>
                  <td class="text-right font-weight-semibold">{{ formatCurrency(hd.thanhTien) }}</td>
                  <td class="text-center">
                    <v-chip :color="trangThaiColor(hd.trangThai)" size="x-small" variant="tonal">
                      {{ trangThaiLabel(hd.trangThai) }}
                    </v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>

            <div v-if="totalPagesSP > 1" class="d-flex justify-center pa-4">
              <v-pagination
                v-model="pageSP"
                :length="totalPagesSP"
                :total-visible="6"
                density="compact"
                color="primary"
              />
            </div>
          </v-window-item>

        </v-window>
      </v-card>

    </template>

    <!-- ═══════ MODAL: DANH SÁCH HÓA ĐƠN THEO KHÁCH HÀNG KHI BẤM VÀO ═══════ -->
    <v-dialog v-model="isCustomerModalOpen" max-width="920px" scrollable>
      <v-card rounded="xl" v-if="selectedCustomerItem">
        <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between bg-purple-700 text-white border-b">
          <div class="d-flex align-center gap-3">
            <v-avatar color="white" size="42" rounded="lg" elevation="2">
              <UserCheck class="w-5 h-5 text-purple-700" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold text-white mb-0">
                LỊCH SỬ ĐƠN HÀNG CỦA KHÁCH HÀNG
              </h3>
              <p class="text-caption text-white opacity-90 mb-0 font-weight-bold">
                Khách hàng: {{ selectedCustomerItem.tenKh }}
              </p>
            </div>
          </div>

          <div class="d-flex align-center gap-2">
            <v-chip color="white" variant="flat" size="small" class="font-weight-black text-purple-900">
              Tổng {{ selectedCustomerInvoices.length }} đơn — {{ formatCurrency(selectedCustomerItem.tongChiTieu) }}
            </v-chip>

            <v-btn icon variant="text" density="comfortable" color="white" @click="isCustomerModalOpen = false">
              <X class="w-5 h-5" />
            </v-btn>
          </div>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-table density="comfortable" class="border rounded-xl" hover>
            <thead>
              <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 130px;">Mã HD</th>
                <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 120px;">Ngày tạo</th>
                <th class="font-weight-bold text-caption uppercase text-left py-3">Địa chỉ giao nhận / Khách hàng</th>
                <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 100px;">Loại</th>
                <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 140px;">Thành tiền</th>
                <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 90px;">Xem POS</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="hd in selectedCustomerInvoices" :key="hd.maHd" class="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <td class="py-3 font-mono font-weight-bold text-primary">
                  {{ hd.maHd }}
                </td>
                <td class="py-3 text-caption font-weight-medium">
                  {{ formatDate(hd.ngayTao) }}
                </td>
                <td class="py-3 text-caption">
                  <div class="font-weight-bold text-slate-800 dark:text-slate-200">
                    {{ hd.diaChiGiaoHang || hd.diaChiKhachHang || hd.diaChi || 'Làm tại Salon / Khách chưa nhập địa chỉ' }}
                  </div>
                  <div v-if="hd.sdt" class="text-medium-emphasis text-xs">
                    SĐT: {{ hd.sdt }}
                  </div>
                </td>
                <td class="py-3 text-center">
                  <v-chip
                    size="x-small"
                    :color="String(hd.maHd || '').toUpperCase().startsWith('SP') ? 'primary' : 'success'"
                    variant="flat"
                    class="font-weight-bold"
                  >
                    {{ String(hd.maHd || '').toUpperCase().startsWith('SP') ? 'Sản phẩm' : 'Dịch vụ' }}
                  </v-chip>
                </td>
                <td class="py-3 text-right font-mono font-weight-black text-body-2 text-primary">
                  {{ (hd.thanhTien || hd.tongTien || 0).toLocaleString() }}₫
                </td>
                <td class="py-3 text-center">
                  <v-btn
                    icon
                    size="small"
                    color="primary"
                    variant="tonal"
                    title="Xem chi tiết phiếu in POS hóa đơn này"
                    @click="viewDetail(hd.maHd)"
                  >
                    <Eye class="w-4 h-4" />
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 border-t d-flex justify-end">
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            class="text-none font-weight-bold px-6"
            @click="isCustomerModalOpen = false"
          >
            Đóng cửa sổ
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>

  <!-- ═══════ MODAL: CHI TIẾT HÓA ĐƠN ĐỒNG BỘ ═══════ -->
  <ModalChiTietHoaDon
    v-model="isInvoiceModalOpen"
    :ma-hd="selectedInvoiceMaHd"
    @status-updated="fetchAdminData"
  />

  <!-- ═══════ MODAL: DANH SÁCH HÓA ĐƠN THEO ĐỊA PHƯƠNG KHI BẤM VÀO ═══════ -->
  <v-dialog v-model="isLocalityModalOpen" max-width="920px" scrollable>
    <v-card rounded="xl" v-if="selectedLocalityItem">
      <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between bg-emerald-700 text-white border-b">
        <div class="d-flex align-center gap-3">
          <v-avatar color="white" size="42" rounded="lg" elevation="2">
            <MapPin class="w-5 h-5 text-emerald-700" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold text-white mb-0">
              DANH SÁCH HÓA ĐƠN KHI MUA HÀNG & DỊCH VỤ
            </h3>
            <p class="text-caption text-white opacity-90 mb-0 font-weight-bold">
              📍 Khu vực: {{ selectedLocalityItem.diaPhuong }}
            </p>
          </div>
        </div>

        <div class="d-flex align-center gap-2">
          <v-chip color="white" variant="flat" size="small" class="font-weight-black text-emerald-900">
            Tổng {{ selectedLocalityInvoices.length }} đơn hàng - {{ formatCurrency(selectedLocalityItem.tongDoanhThu) }}
          </v-chip>

          <v-btn icon variant="text" density="comfortable" color="white" @click="isLocalityModalOpen = false">
            <X class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-card-text class="pa-6">
        <v-table density="comfortable" class="border rounded-xl" hover>
          <thead>
            <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
              <th class="font-weight-bold text-caption uppercase text-left py-3" style="width: 130px;">Mã HD</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3">Khách hàng</th>
              <th class="font-weight-bold text-caption uppercase text-left py-3">Địa chỉ Khách hàng / Giao hàng</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 100px;">Loại</th>
              <th class="font-weight-bold text-caption uppercase text-right py-3" style="width: 140px;">Thành tiền</th>
              <th class="font-weight-bold text-caption uppercase text-center py-3" style="width: 90px;">Xem POS</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="hd in selectedLocalityInvoices" :key="hd.maHd" class="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              <td class="py-3 font-mono font-weight-bold text-primary">
                {{ hd.maHd }}
              </td>
              <td class="py-3 font-weight-bold">
                {{ hd.tenKh || hd.tenKhachHang || hd.khachHang || 'Khách vãng lai' }}
              </td>
              <td class="py-3 text-caption">
                <div class="font-weight-bold text-slate-800 dark:text-slate-200">
                  {{ hd.diaChiGiaoHang || hd.diaChiKhachHang || hd.diaChi || "Thị trấn Quảng Phú, Huyện Cư M'gar, Đắk Lắk" }}
                </div>
                <div v-if="hd.sdt" class="text-medium-emphasis text-xs">
                  SĐT: {{ hd.sdt }}
                </div>
              </td>
              <td class="py-3 text-center">
                <v-chip
                  size="x-small"
                  :color="String(hd.maHd || '').toUpperCase().startsWith('SP') ? 'primary' : 'success'"
                  variant="flat"
                  class="font-weight-bold"
                >
                  {{ String(hd.maHd || '').toUpperCase().startsWith('SP') ? 'Sản phẩm' : 'Dịch vụ' }}
                </v-chip>
              </td>
              <td class="py-3 text-right font-mono font-weight-black text-body-2 text-success">
                {{ (hd.thanhTien || hd.tongTien || 0).toLocaleString() }}₫
              </td>
              <td class="py-3 text-center">
                <v-btn
                  icon
                  size="small"
                  color="primary"
                  variant="tonal"
                  title="Xem chi tiết phiếu in POS hóa đơn này"
                  @click="viewDetail(hd.maHd)"
                >
                  <Eye class="w-4 h-4" />
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>

      <v-card-actions class="pa-4 px-6 border-t d-flex justify-end">
        <v-btn
          variant="flat"
          color="primary"
          rounded="lg"
          class="text-none font-weight-bold px-6"
          @click="isLocalityModalOpen = false"
        >
          Đóng cửa sổ
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
}
th {
  font-size: 0.75rem !important;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #888 !important;
  white-space: nowrap;
}
td {
  font-size: 0.855rem;
}

/* Nút Đóng Cửa Sổ khóa cố định màu nền xanh Sky sáng chữ Trắng 100% trong cả sáng và tối */
.act-modal-close-btn {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
}
.act-modal-close-btn:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
}
.act-modal-close-btn span {
  color: #ffffff !important;
}
</style>
