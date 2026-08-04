<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import axios from 'axios'
import { Search, FileDown, Eye, X, Printer, ShoppingBag, Scissors, FileText, ChevronLeft, ChevronRight, RotateCcw, Filter } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'
import { useTheme } from 'vuetify'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/hoa-don`

// ── Theme State Detection (Light / Dark Mode Sync) ──
let isDarkMode = computed(() => false)
try {
  const vuetifyTheme = useTheme()
  isDarkMode = computed(() => vuetifyTheme.global.name.value === 'dark')
} catch (e) {
  isDarkMode = computed(() => {
    return localStorage.getItem('theme_selection') === 'dark'
  })
}

// Watch theme change and update body background to prevent white bottom area
watch(isDarkMode, (dark) => {
  if (dark) {
    document.body.style.backgroundColor = '#141416'
  } else {
    document.body.style.backgroundColor = ''
  }
}, { immediate: true })

onUnmounted(() => {
  document.body.style.backgroundColor = ''
})

// Quản lý độc lập dữ liệu của 2 tab phân hệ
const hoaDonSanPham = ref<any[]>([])
const hoaDonDichVu = ref<any[]>([])

const isLoading = ref(false)
const searchQuery = ref('')
const selectedStatusFilter = ref<string>('') // Bộ lọc trạng thái ngoài trang
const activeTab = ref<'dichVu' | 'sanPham'>('dichVu') // Mặc định mở tab dịch vụ trước
const errorMessage = ref('') 

const getFirstDayOfMonthString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Định dạng bộ lọc ngày chuẩn quốc tế YYYY-MM-DD giúp Backend bắt chính xác ngày
const filter = ref({
    tuNgay: getFirstDayOfMonthString(),
    denNgay: getLocalDateString()
})

// Hàm lấy mã Token từ mọi phân vùng bộ nhớ để đính kèm vào Header chống lỗi 403
const getAuthHeaders = () => {
    const token = sessionStorage.getItem('adminToken')
               || localStorage.getItem('accessToken') 
               || localStorage.getItem('token') 
               || sessionStorage.getItem('accessToken') 
               || sessionStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
}

const fetchHoaDons = async () => {
    isLoading.value = true
    errorMessage.value = ''
    try {
        const params = {
            tuNgay: filter.value.tuNgay,
            denNgay: filter.value.denNgay,
            search: searchQuery.value
        }
        const res = await axios.get(`${API_BASE_URL}/danh-sach`, { 
            params,
            headers: getAuthHeaders()
        })
        
        if (res.data.success) {
            let dashboardSpMap = new Map();
            try {
                const dbRes = await axios.get(`${API}/api/ThongKe/admin-dashboard`, {
                    params: {
                        startDate: filter.value.tuNgay,
                        endDate: filter.value.denNgay,
                        searchMaHd: searchQuery.value
                    },
                    headers: getAuthHeaders()
                });
                if (dbRes.data && dbRes.data.hoaDonSanPham) {
                    dbRes.data.hoaDonSanPham.forEach((hd: any) => {
                        const ma = String(hd.maHd || hd.MaHd || '').toUpperCase();
                        dashboardSpMap.set(ma, hd.chiTiet || hd.ChiTiet);
                    });
                }
            } catch (err) {
                console.error("Lỗi khi tải thông tin chi tiết từ dashboard:", err);
            }

            const allData = [
                ...(res.data.hoaDonSanPham || []),
                ...(res.data.hoaDonDichVu || [])
            ]
            
            allData.forEach((h: any) => {
                const ma = String(h.maHd || '').toUpperCase();
                if (dashboardSpMap.has(ma)) {
                    h.chiTiet = dashboardSpMap.get(ma);
                }
            });
            
            hoaDonSanPham.value = allData.filter((h: any) => {
                const ma = String(h.maHd || '').toUpperCase();
                return ma.startsWith('SP') || ma.startsWith('HDSP');
            })
            
            hoaDonDichVu.value = allData.filter((h: any) => {
                const ma = String(h.maHd || '').toUpperCase();
                return !ma.startsWith('SP') && !ma.startsWith('HDSP');
            })
        }
    } catch (e: any) { 
        console.error(e);
        errorMessage.value = e.response?.status === 403 
            ? "Lỗi 403: Tài khoản hiện tại không có quyền truy cập module này hoặc Token hết hạn."
            : (e.response?.data?.message || "Không thể kết nối đến máy chủ hệ thống.");
    } finally { 
        isLoading.value = false 
    }
}

// Bảng màu trạng thái tương thích chuẩn cả Sáng và Tối
const statusLabel = (status: number, maHd: string = "") => {
    const laDonSp = maHd.startsWith("SP") || maHd.startsWith("HDSP");
    const map: any = {
        0: { text: 'Đã Hủy', class: 'status-canceled' },
        1: { text: laDonSp ? 'Chờ xử lý' : 'Đã cọc 10%', class: 'status-pending' },
        2: { text: laDonSp ? 'Đang giao' : 'Đã thanh toán', class: 'status-processing' },
        3: { text: laDonSp ? 'Đã giao hàng' : 'Hoàn thành', class: 'status-completed' }
    }
    return map[status] || { text: 'N/A', class: 'status-pending' }
}

const changeInvoiceStatus = async (maHd: string, newStatus: number) => {
    const allData = [...hoaDonSanPham.value, ...hoaDonDichVu.value];
    const currentHd = allData.find(h => h.maHd === maHd) || (selectedHd.value && selectedHd.value.maHd === maHd ? selectedHd.value : null);
    if (currentHd && (currentHd.trangThai === 3 || currentHd.trangThai === 0)) {
        alert("Đơn hàng đã hoàn thành hoặc đã hủy. Không thể thay đổi trạng thái.");
        return;
    }

    try {
        const payload = { trangThai: newStatus };
        
        const res = await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, payload, { headers: getAuthHeaders() })
            .catch(async () => {
                return await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, newStatus, {
                    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' }
                });
            });

        if (res.data.success) {
            logActivity(
                "Đổi trạng thái hóa đơn",
                `Đã chuyển trạng thái hóa đơn ${maHd} sang "${statusLabel(newStatus, maHd).text}"`,
                "Hóa đơn"
            );
            await fetchHoaDons(); 
            if (selectedHd.value && selectedHd.value.maHd === maHd) {
                selectedHd.value.trangThai = newStatus;
            }
        }
    } catch (e: any) {
        logActivity(
            "Đổi trạng thái hóa đơn",
            `Thất bại khi chuyển trạng thái hóa đơn ${maHd} sang "${statusLabel(newStatus, maHd).text}" - Lỗi: ${e.message || ''}`,
            "Hóa đơn",
            "Thất bại"
        );
        alert("Lỗi khi cập nhật trạng thái đơn hàng. Vui lòng kiểm tra lại quyền hạn tài khoản.");
    }
}

const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('HoaDon')
    worksheet.addRow(['Mã HD', 'Khách hàng', 'Ngày tạo', 'Thành tiền', 'Trạng thái']).font = { bold: true }
    
    const targetList = filteredInvoices.value;
    targetList.forEach(h => {
        worksheet.addRow([h.maHd, h.tenKhachHang, h.ngayTao, h.thanhTien, statusLabel(h.trangThai, h.maHd).text])
    })
    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Bao_Cao_Hoa_Don_${activeTab.value}.xlsx`)

    logActivity(
        "Xuất Excel hóa đơn",
        `Đã xuất tệp Excel danh sách hóa đơn phân hệ ${activeTab.value === 'dichVu' ? 'Dịch vụ' : 'Sản phẩm'} (${targetList.length} hóa đơn)`,
        "Hóa đơn"
    );
}

const isModalOpen = ref(false)
const selectedHd = ref<any>(null)

const viewDetail = async (maHd: string) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/chi-tiet/${maHd}`, { headers: getAuthHeaders() })
        if (res.data.success) {
            const detail = res.data.data;
            const match = [...hoaDonSanPham.value, ...hoaDonDichVu.value].find(h => String(h.maHd || '').toUpperCase() === String(maHd).toUpperCase());
            if (match && match.chiTiet) {
                detail.chiTiet = match.chiTiet;
            }
            selectedHd.value = detail;
            isModalOpen.value = true
        }
    } catch (e) { alert("Không thể tải chi tiết hóa đơn") }
}

const printInvoice = () => { 
    if (selectedHd.value) {
        logActivity(
            "In hóa đơn",
            `Đã in chi tiết hóa đơn ${selectedHd.value.maHd} cho khách hàng ${selectedHd.value.tenKh || ''}`,
            "Hóa đơn"
        );
    }
    window.print() 
}

onMounted(fetchHoaDons)
watch([() => filter.value.tuNgay, () => filter.value.denNgay], fetchHoaDons)

// Computed danh sách hóa đơn sau khi áp dụng thêm bộ lọc trạng thái đơn hàng
const filteredInvoices = computed(() => {
    const list = activeTab.value === 'dichVu' ? hoaDonDichVu.value : hoaDonSanPham.value
    return list.filter(h => {
        if (selectedStatusFilter.value !== '') {
            if (String(h.trangThai) !== selectedStatusFilter.value) return false
        }
        return true
    })
})

// ── Phân trang (Pagination) ──
const currentPage = ref(1)
const perPage = ref(10)

watch([activeTab, searchQuery, selectedStatusFilter, () => filter.value.tuNgay, () => filter.value.denNgay], () => {
    currentPage.value = 1
})

const pagedInvoices = computed(() => {
    const start = (currentPage.value - 1) * perPage.value
    return filteredInvoices.value.slice(start, start + perPage.value)
})

const totalPages = computed(() => {
    return Math.max(1, Math.ceil(filteredInvoices.value.length / perPage.value))
})

const visiblePages = computed(() => {
    const pages: number[] = []
    const total = totalPages.value
    const current = currentPage.value
    
    let start = Math.max(1, current - 2)
    let end = Math.min(total, current + 2)
    
    if (end - start + 1 < 5) {
        if (start === 1) {
            end = Math.min(total, start + 4)
        } else if (end === total) {
            start = Math.max(1, end - 4)
        }
    }
    
    for (let i = start; i <= end; i++) {
        if (i >= 1 && i <= total) pages.push(i)
    }
    return pages
})

const changePage = (p: number) => {
    if (p >= 1 && p <= totalPages.value) {
        currentPage.value = p
    }
}
</script>

<template>
    <div 
        class="hoadon-container min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans antialiased relative transition-colors duration-300 print:hidden"
        :class="isDarkMode ? 'bg-[#141416] text-slate-100' : 'bg-slate-50 text-slate-800'"
    >
        <!-- Header -->
        <div 
            class="hd-header flex flex-col lg:flex-row lg:items-center justify-between gap-6 rounded-xl border p-6 mb-6 shadow-xs transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div class="flex items-center gap-5">
                <div class="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/25 flex-shrink-0">
                    <FileText class="w-7 h-7 md:w-8 md:h-8" />
                </div>
                <div>
                    <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                        Quản Lý Hóa Đơn
                    </h2>
                    <p class="text-xs md:text-sm mt-1 font-medium" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                        Tách biệt danh mục Hóa đơn dịch vụ Salon và Hóa đơn mua Sản phẩm lẻ
                    </p>
                </div>
            </div>

            <button 
                @click="exportExcel" 
                class="hd-btn-export h-11 px-5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs flex items-center gap-2"
            >
                <FileDown class="w-4 h-4" />
                <span>Xuất Excel</span>
            </button>
        </div>

        <!-- Filters Grid -->
        <div 
            class="hd-filters-grid rounded-xl border p-6 mb-6 shadow-xs transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                
                <!-- Col 1: Từ ngày -->
                <div class="flex flex-col gap-2">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Từ ngày</label>
                    <input 
                        type="date" 
                        v-model="filter.tuNgay" 
                        class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input [color-scheme:dark]' : 'light-mode-input'"
                    >
                </div>

                <!-- Col 2: Đến ngày -->
                <div class="flex flex-col gap-2">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Đến ngày</label>
                    <input 
                        type="date" 
                        v-model="filter.denNgay" 
                        class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input [color-scheme:dark]' : 'light-mode-input'"
                    >
                </div>

                <!-- Col 3: Bộ Lọc Trạng Thái Đơn Hàng -->
                <div class="flex flex-col gap-2">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Trạng thái đơn hàng</label>
                    <div class="relative flex items-center">
                        <select 
                            v-model="selectedStatusFilter" 
                            class="hd-select hd-input w-full text-xs md:text-sm font-medium outline-none appearance-none cursor-pointer transition-all box-border"
                            :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                        >
                            <option value="" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Tất cả trạng thái</option>
                            <option value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Chờ xử lý / Đã cọc 10%</option>
                            <option value="2" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Đang giao / Đã thanh toán</option>
                            <option value="3" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Đã giao hàng / Hoàn thành</option>
                            <option value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'text-slate-800'">Đã Hủy</option>
                        </select>
                        <span class="pointer-events-none absolute right-4 text-xs text-sky-500 font-bold z-10">▼</span>
                    </div>
                </div>

                <!-- Col 4: Tìm kiếm -->
                <div class="flex flex-col gap-2">
                    <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Tìm kiếm hóa đơn</label>
                    <div class="relative flex items-center">
                        <Search class="absolute left-4 w-4 h-4 pointer-events-none z-10 text-slate-400" />
                        <input 
                            v-model="searchQuery" 
                            @keyup.enter="fetchHoaDons" 
                            placeholder="Mã HD hoặc tên khách..." 
                            class="hd-input hd-search-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                            :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                        >
                    </div>
                </div>

            </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b mb-6 gap-2" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
            <button 
                @click="activeTab = 'dichVu'" 
                class="flex items-center gap-2.5 px-6 py-3.5 text-xs md:text-sm font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-[1px]"
                :class="activeTab === 'dichVu' 
                    ? (isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-500' : 'bg-sky-50 text-sky-700 border-sky-600') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-[#222233] border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent')"
            >
                <Scissors class="w-4 h-4" />
                <span>Hóa đơn Dịch vụ Salon ({{ hoaDonDichVu.length }})</span>
            </button>
            <button 
                @click="activeTab = 'sanPham'" 
                class="flex items-center gap-2.5 px-6 py-3.5 text-xs md:text-sm font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-[1px]"
                :class="activeTab === 'sanPham' 
                    ? (isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-500' : 'bg-sky-50 text-sky-700 border-sky-600') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-[#222233] border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent')"
            >
                <ShoppingBag class="w-4 h-4" />
                <span>Hóa đơn Mua Sản phẩm ({{ hoaDonSanPham.length }})</span>
            </button>
        </div>

        <!-- Table Section -->
        <div 
            class="hd-table-wrapper flex-1 w-full rounded-xl border shadow-xs relative overflow-hidden flex flex-col z-10 min-h-[400px] transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div v-if="isLoading" class="p-12 text-center text-xs font-extrabold text-sky-600 tracking-wider uppercase">
                <div class="w-8 h-8 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-3"></div>
                Đang đồng bộ nạp danh sách hóa đơn hệ thống...
            </div>
            
            <div v-else-if="errorMessage" class="p-6 text-center text-xs font-bold text-rose-500 bg-rose-950/40 border-b border-rose-800">
                {{ errorMessage }}
            </div>
            
            <div v-else class="flex-grow overflow-x-auto custom-scrollbar">
                <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[900px]">
                    <thead>
                        <tr :class="isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-900 text-white'">
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 whitespace-nowrap">Mã HD</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider">Khách hàng</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 whitespace-nowrap">Ngày tạo</th>
                            <th v-if="activeTab === 'sanPham'" class="py-4 px-6 font-extrabold uppercase tracking-wider w-32 text-center whitespace-nowrap">Số lượng</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 whitespace-nowrap">Thành tiền</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-56 text-center whitespace-nowrap">Trạng thái đơn hàng</th>
                            <th class="py-4 px-4 font-extrabold uppercase tracking-wider w-24 text-center whitespace-nowrap">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'">
                        <tr 
                            v-for="hd in pagedInvoices" 
                            :key="hd.maHd"
                            class="transition-colors duration-150"
                            :class="isDarkMode ? 'hover:bg-slate-800/60 text-slate-200' : 'hover:bg-sky-50/60 text-slate-700'"
                        >
                            <td class="py-4 px-6 font-extrabold font-mono text-xs text-sky-500 whitespace-nowrap">
                                {{ hd.maHd }}
                            </td>
                            
                            <td class="py-4 px-6 font-bold" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                                {{ hd.tenKhachHang }}
                            </td>
                            
                            <td class="py-4 px-6 font-medium text-xs font-mono whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                                {{ new Date(hd.ngayTao).toLocaleDateString('vi-VN') }}
                            </td>
                            
                            <td v-if="activeTab === 'sanPham'" class="py-4 px-6 text-center whitespace-nowrap">
                                <span class="inline-flex items-center justify-center px-2.5 py-0.5 rounded text-xs font-extrabold border" :class="isDarkMode ? 'bg-sky-950/80 text-sky-300 border-sky-800' : 'bg-sky-50 text-sky-700 border-sky-200'">
                                    {{ hd.soLuong || hd.SoLuong || hd.chiTiet?.reduce((sum: number, ct: any) => sum + (ct.soLuong || ct.SoLuong || 0), 0) || 0 }} sp
                                </span>
                            </td>
                            
                            <td class="py-4 px-6 font-black font-mono text-sm whitespace-nowrap" :class="isDarkMode ? 'text-sky-400' : 'text-slate-900'">
                                {{ hd.thanhTien?.toLocaleString() }}₫
                            </td>
                            
                            <td class="py-4 px-6 text-center whitespace-nowrap">
                                <div class="relative flex items-center justify-center">
                                    <select 
                                        :value="hd.trangThai" 
                                        :disabled="hd.trangThai === 3 || hd.trangThai === 0" 
                                        @change="changeInvoiceStatus(hd.maHd, Number(($event.target as HTMLSelectElement).value))" 
                                        class="hd-status-select text-xs font-extrabold rounded-lg px-3 py-1.5 outline-none cursor-pointer transition-all box-border border"
                                        :class="[
                                            statusLabel(hd.trangThai, hd.maHd).class,
                                            isDarkMode ? 'dark-status-dropdown' : 'light-status-dropdown'
                                        ]"
                                    >
                                        <option value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ hd.maHd.startsWith('SP') ? 'Chờ xử lý' : 'Đã cọc 10%' }}</option>
                                        <option value="2" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ hd.maHd.startsWith('SP') ? 'Đang giao' : 'Đã thanh toán' }}</option>
                                        <option value="3" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ hd.maHd.startsWith('SP') ? 'Đã giao hàng' : 'Hoàn thành' }}</option>
                                        <option value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đã Hủy</option>
                                    </select>
                                </div>
                            </td>
                            
                            <td class="py-4 px-4 text-center whitespace-nowrap">
                                <button 
                                    @click="viewDetail(hd.maHd)" 
                                    title="Xem chi tiết hóa đơn"
                                    class="w-8 h-8 rounded-lg border flex items-center justify-center mx-auto transition-all cursor-pointer shadow-2xs"
                                    :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-sky-500 text-sky-400' : 'bg-white border-slate-200 hover:border-sky-400 text-sky-600 hover:bg-sky-50'"
                                >
                                    <Eye class="w-4 h-4" />
                                </button>
                            </td>
                        </tr>

                        <!-- Empty State -->
                        <tr v-if="pagedInvoices.length === 0">
                            <td :colspan="activeTab === 'sanPham' ? 7 : 6" class="p-12 text-center text-slate-500">
                                <div class="flex flex-col items-center gap-2 max-w-sm mx-auto">
                                    <FileText class="w-8 h-8 text-slate-400 stroke-[1.5px]" />
                                    <span class="font-extrabold text-sm" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Không tìm thấy dữ liệu hóa đơn</span>
                                    <span class="text-xs" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Không có hóa đơn nào trùng khớp với từ khóa tìm kiếm hoặc bộ lọc trạng thái.</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- Pagination Controls -->
            <div 
                v-if="totalPages > 1" 
                class="flex-shrink-0 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t print:hidden"
                :class="isDarkMode ? 'bg-[#252536] border-slate-700/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'"
            >
                <div class="text-xs font-bold">
                    Hiển thị trang <span class="text-sky-600">{{ currentPage }}</span> / {{ totalPages }} (Tổng {{ filteredInvoices.length }} đơn)
                </div>

                <div class="flex items-center gap-2">
                    <button 
                        @click="changePage(currentPage - 1)" 
                        :disabled="currentPage === 1" 
                        class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        :class="isDarkMode ? '!bg-[#2b2b36] !border-slate-700 !text-slate-200 hover:!border-slate-600' : '!bg-white !border-slate-300 !text-slate-700 hover:!border-slate-400'"
                    >
                        <ChevronLeft class="w-3.5 h-3.5" />
                        <span class="hidden sm:inline">Trước</span>
                    </button>

                    <div class="flex items-center gap-1">
                        <button 
                            v-for="p in visiblePages" 
                            :key="p" 
                            @click="changePage(p)" 
                            class="w-8 h-8 text-xs font-bold rounded-lg transition-all shadow-2xs flex items-center justify-center cursor-pointer border"
                            :class="currentPage === p ? '!bg-sky-600 !text-white font-extrabold shadow-sm !border-sky-600' : (isDarkMode ? '!bg-[#2b2b36] !text-slate-200 !border-slate-700 hover:!border-slate-600' : '!bg-white !text-slate-700 !border-slate-300 hover:!border-slate-400')"
                        >
                            {{ p }}
                        </button>
                    </div>

                    <button 
                        @click="changePage(currentPage + 1)" 
                        :disabled="currentPage === totalPages" 
                        class="h-8 px-3 text-xs font-bold rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-2xs flex items-center gap-1 cursor-pointer"
                        :class="isDarkMode ? '!bg-[#2b2b36] !border-slate-700 !text-slate-200 hover:!border-slate-600' : '!bg-white !border-slate-300 !text-slate-700 hover:!border-slate-400'"
                    >
                        <span class="hidden sm:inline">Sau</span>
                        <ChevronRight class="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Detail Modal & Thermal Receipt Print Template -->
    <Teleport to="body">
        <div 
            v-if="isModalOpen && selectedHd" 
            class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 lg:p-8 bg-slate-950/80 backdrop-blur-md transition-all print:p-0 print:bg-white print:static print:inset-auto"
            @click="isModalOpen = false"
        >
            <div 
                class="act-modal-container relative w-full max-w-4xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300 print:shadow-none print:border-none print:max-w-full print:w-full print:bg-white"
                :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
                @click.stop
            >
                <!-- Modal Header (Lề cách rộng 44px / px-10 md:px-14) -->
                <div class="px-8 md:px-12 py-5 border-b flex items-center justify-between relative overflow-hidden bg-gradient-to-r from-sky-600 via-blue-700 to-indigo-800 text-white print:hidden">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white shadow-md flex-shrink-0">
                            <FileText class="w-5 h-5" />
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base md:text-lg text-white tracking-wide">
                                HÓA ĐƠN CHI TIẾT
                            </h3>
                            <p class="text-xs text-sky-100 font-mono opacity-90">
                                Mã hóa đơn: #{{ selectedHd.maHd }}
                            </p>
                        </div>
                    </div>

                    <div class="flex items-center gap-3">
                        <button 
                            @click="printInvoice" 
                            class="h-9 px-4 text-xs font-extrabold bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                            <Printer class="w-4 h-4" /> In Hóa Đơn (Máy in POS)
                        </button>
                        <button 
                            @click="isModalOpen = false" 
                            class="w-9 h-9 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                        >
                            <X class="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <!-- Modal Body (Hóa đơn nằm căn giữa trang, cách xa viền 2 bên cực kỳ cân đối) -->
                <div class="p-6 md:p-10 flex flex-col items-center justify-center max-h-[80vh] overflow-y-auto custom-scrollbar print:max-h-none print:p-0 print:overflow-visible">
                    
                    <div id="invoice-print" class="w-full max-w-3xl mx-auto px-4 md:px-8 py-2 flex flex-col gap-6 print:max-w-full print:px-0 print:py-0 print:gap-2.5">
                        
                        <!-- Header Tiêu Đề Salon -->
                        <div class="text-center border-b pb-4 print:border-b print:border-black print:pb-1.5">
                            <h1 class="text-2xl print:text-base font-black uppercase tracking-wider text-sky-500 print:text-black mb-1">MINH TÂM HAIR SALON</h1>
                            <p class="text-xs font-medium print:text-[10px] print:text-black" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
                            <p class="text-xs font-extrabold text-sky-600 print:text-[10px] print:text-black mt-0.5">Hotline: 0123.456.789</p>
                        </div>

                        <!-- Tiêu đề Phiếu thanh toán khi in máy in thực tế -->
                        <div class="hidden print:block text-center font-extrabold text-xs uppercase tracking-wider border-b border-dashed border-black pb-1.5">
                            PHIẾU THANH TOÁN HÓA ĐƠN
                        </div>

                        <!-- Invoice Info Cards Grid (Hiển thị 4 cột cân đối, chữ hàng trên & dưới thẳng hàng dọc 100%) -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border print:hidden" :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'">
                            
                            <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">MÃ HÓA ĐƠN</span>
                                <span class="text-xs md:text-sm font-extrabold font-mono text-sky-500 whitespace-nowrap">#{{ selectedHd.maHd }}</span>
                            </div>

                            <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">NGÀY TẠO</span>
                                <span class="text-xs font-bold font-mono whitespace-nowrap" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span>
                            </div>

                            <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">KHÁCH HÀNG</span>
                                <span class="text-xs md:text-sm font-black truncate w-full" :class="isDarkMode ? 'text-white' : 'text-slate-900'">{{ selectedHd.tenKh || 'Khách vãng lai' }}</span>
                            </div>

                            <div class="flex flex-col gap-1.5 text-left items-start overflow-hidden px-2">
                                <span class="text-[11px] font-extrabold uppercase tracking-wider opacity-75 whitespace-nowrap" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">THU NGÂN</span>
                                <span class="text-xs font-bold truncate w-full" :class="isDarkMode ? 'text-slate-200' : 'text-slate-800'">{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span>
                            </div>

                        </div>

                        <!-- Khung thông tin hóa đơn DÀNH RIÊNG CHO MÁY IN POS -->
                        <div class="hidden print:flex flex-col gap-1 text-[11px] border-b border-dashed border-black pb-2 font-mono">
                            <div class="flex justify-between"><span>Mã hóa đơn:</span> <strong>#{{ selectedHd.maHd }}</strong></div>
                            <div class="flex justify-between"><span>Ngày tạo:</span> <span>{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></div>
                            <div class="flex justify-between"><span>Khách hàng:</span> <strong>{{ selectedHd.tenKh || 'Khách vãng lai' }}</strong></div>
                            <div class="flex justify-between"><span>Thu ngân:</span> <span>{{ selectedHd.tenThuNgan || 'Hệ thống' }}</span></div>
                        </div>

                        <!-- Invoice Items Table -->
                        <div class="overflow-x-auto rounded-xl border print:border-none print:rounded-none print:overflow-visible print:w-full" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
                            <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[550px] print:min-w-0 print:w-full print:text-[10px] print:table-fixed">
                                <thead>
                                    <tr :class="[isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-100 text-slate-700 border-b border-slate-200', 'print:bg-transparent print:text-black print:border-t print:border-b print:border-dashed print:border-black']">
                                        <th class="py-3.5 px-6 font-extrabold uppercase print:py-1 print:px-0 print:w-[50%] print:text-left">Tên Sản phẩm / Dịch vụ</th>
                                        <th class="py-3.5 px-6 font-extrabold uppercase text-center w-20 print:w-[15%] print:py-1 print:px-0 print:text-center">SL</th>
                                        <th class="py-3.5 px-6 font-extrabold uppercase print:py-1 print:px-0 print:hidden">Ghi chú</th>
                                        <th class="py-3.5 px-6 font-extrabold uppercase text-right print:w-[35%] print:py-1 print:px-0 print:text-right">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y print:divide-y-0" :class="isDarkMode ? 'divide-slate-800' : 'divide-slate-100'">
                                    <tr 
                                        v-for="(item, index) in (selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? (selectedHd.chiTiet || selectedHd.chiTietDichVu || []) : (selectedHd.chiTietDichVu || []))" 
                                        :key="index"
                                        :class="[isDarkMode ? 'text-slate-200' : 'text-slate-800', 'print:text-black']"
                                    >
                                        <td class="py-4 px-6 font-bold print:py-1 print:px-0 print:font-normal print:w-[50%] print:break-words text-left" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                                            {{ item.ten || item.Ten || item.tenHangMuc || item.tenSP || item.tenSp || 'Dịch vụ Salon' }}
                                        </td>
                                        <td class="py-4 px-6 text-center font-bold font-mono print:py-1 print:px-0 print:font-normal print:w-[15%] print:text-center">
                                            {{ item.soLuong || item.SoLuong || item.soluong || 1 }}
                                        </td>
                                        <td class="py-4 px-6 print:hidden">
                                            <span class="inline-block px-2.5 py-0.5 rounded text-[10px] font-bold border" :class="isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'">
                                                {{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}
                                            </span>
                                        </td>
                                        <td class="py-4 px-6 text-right font-black font-mono print:py-1 print:px-0 print:font-bold print:w-[35%] print:text-right" :class="isDarkMode ? 'text-sky-400' : 'text-slate-900'">
                                            {{ (item.thanhTien || item.ThanhTien || (item.gia || item.Gia || item.giaBan || 0) * (item.soLuong || item.SoLuong || 1)).toLocaleString() }}₫
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Quick Update Status Row inside Modal (Ẩn khi bấm In) -->
                        <div class="print:hidden border-t border-dashed pt-5 px-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-300'">
                            <span class="text-xs font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">CẬP NHẬT TRẠNG THÁI NHANH:</span>
                            <div class="relative flex items-center">
                                <select 
                                    :value="selectedHd.trangThai" 
                                    :disabled="selectedHd.trangThai === 3 || selectedHd.trangThai === 0" 
                                    @change="changeInvoiceStatus(selectedHd.maHd, Number(($event.target as HTMLSelectElement).value))" 
                                    class="hd-status-select text-xs font-extrabold rounded-lg px-4 py-2 outline-none cursor-pointer transition-all box-border border"
                                    :class="[
                                        statusLabel(selectedHd.trangThai, selectedHd.maHd).class,
                                        isDarkMode ? 'dark-status-dropdown' : 'light-status-dropdown'
                                    ]"
                                >
                                    <option value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ selectedHd.maHd.startsWith('SP') ? 'Chờ xử lý' : 'Đã cọc 10%' }}</option>
                                    <option value="2" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ selectedHd.maHd.startsWith('SP') ? 'Đang giao' : 'Đã thanh toán' }}</option>
                                    <option value="3" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">{{ selectedHd.maHd.startsWith('SP') ? 'Đã giao hàng' : 'Hoàn thành' }}</option>
                                    <option value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đã Hủy</option>
                                </select>
                            </div>
                        </div>

                        <!-- Total Revenue Footer -->
                        <div class="flex flex-col items-end gap-2 pt-5 px-2 border-t print:pt-2 print:border-t print:border-dashed print:border-black print:items-stretch" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
                            <div class="flex items-center justify-between w-full text-xs print:text-[11px]" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                                <span>Tạm tính gốc:</span>
                                <strong :class="isDarkMode ? 'text-slate-200' : 'text-slate-700'" class="print:text-black">{{ selectedHd.tongTien?.toLocaleString() }}₫</strong>
                            </div>
                            <div v-if="selectedHd.giamGiaVip" class="flex items-center justify-between w-full text-xs font-bold text-rose-500 print:text-[11px] print:text-black">
                                <span>Giảm giá VIP:</span>
                                <span>-{{ selectedHd.giamGiaVip }}%</span>
                            </div>
                            <div class="flex items-center justify-between w-full text-base md:text-lg font-bold print:text-xs print:pt-1 print:border-t print:border-black">
                                <span :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'" class="print:text-black font-extrabold">TỔNG THANH TOÁN:</span>
                                <span class="font-black text-sky-500 font-mono text-lg md:text-xl print:text-black print:text-sm print:font-extrabold">{{ selectedHd.thanhTien?.toLocaleString() }}₫</span>
                            </div>
                        </div>

                        <!-- Lời cảm ơn dành riêng cho trang in hóa đơn máy in nhiệt POS K80 -->
                        <div class="hidden print:flex flex-col items-center justify-center text-center mt-3 pt-3 border-t border-dashed border-black gap-1">
                            <p class="text-[11px] font-bold">Cảm ơn Quý khách & Hẹn gặp lại!</p>
                            <p class="text-[9px]">Hotline CSKH: 0123.456.789 - Website: lghair.vn</p>
                        </div>

                    </div>
                </div>

                <!-- Modal Footer (BỎ HOÀN TOÀN ICON NẰM TRƯỚC CHỮ ĐÓNG CỬA SỔ) -->
                <div 
                    class="px-8 md:px-12 py-4 border-t flex items-center justify-center print:hidden transition-colors"
                    :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
                >
                    <button 
                        @click="isModalOpen = false" 
                        class="act-modal-close-btn h-11 px-10 text-xs font-extrabold rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center"
                    >
                        <span>Đóng cửa sổ</span>
                    </button>
                </div>

            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* Enforce dark background on parent containers */
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Light Mode Input Styling */
.light-mode-input {
  background-color: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03) !important;
}
.light-mode-input:focus {
  background-color: #ffffff !important;
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
}

/* Dark Mode Input Styling */
.dark-mode-input {
  background-color: #2b2b36 !important;
  border: 1px solid #475569 !important;
  color: #ffffff !important;
}
.dark-mode-input:focus {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
}

/* Input Dimensions */
.hd-input {
  height: 44px !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

.hd-select {
  padding-left: 1rem !important;
  padding-right: 2.5rem !important;
}

.hd-search-input {
  padding-left: 2.75rem !important;
}

/* Export Button Styling */
.hd-btn-export {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
  font-weight: 700 !important;
}
.hd-btn-export:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
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

/* Status Badge Classes */
.status-canceled {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
  border-color: #fecaca !important;
}
.status-pending {
  background-color: #fffbeb !important;
  color: #d97706 !important;
  border-color: #fef3c7 !important;
}
.status-processing {
  background-color: #eff6ff !important;
  color: #2563eb !important;
  border-color: #dbeafe !important;
}
.status-completed {
  background-color: #f0fdf4 !important;
  color: #16a34a !important;
  border-color: #bbf7d0 !important;
}

/* Dark Status Badge overrides for dark mode */
.dark-status-dropdown.status-canceled {
  background-color: #450a0a !important;
  color: #fca5a5 !important;
  border-color: #991b1b !important;
}
.dark-status-dropdown.status-pending {
  background-color: #451a03 !important;
  color: #fcd34d !important;
  border-color: #92400e !important;
}
.dark-status-dropdown.status-processing {
  background-color: #172554 !important;
  color: #93c5fd !important;
  border-color: #1e40af !important;
}
.dark-status-dropdown.status-completed {
  background-color: #052e16 !important;
  color: #86efac !important;
  border-color: #166534 !important;
}

/* Custom styled scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #0284c7;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #0369a1;
}
</style>

<style>
/* Style dành riêng cho máy in hóa đơn nhiệt POS K80 / Máy in thực tế */
@media print {
    @page {
        size: 80mm auto;
        margin: 0;
    }
    
    html, body {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        font-family: Arial, Helvetica, sans-serif !important;
    }
    
    #app, .hoadon-container, .v-application, .v-overlay-container, .v-layout {
        display: none !important;
    }

    .print\:hidden {
        display: none !important;
    }

    .act-modal-container {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
        color: #000000 !important;
        border-radius: 0 !important;
    }

    /* Reset toàn bộ nền đen/xám của Dark Mode thành màu trắng tinh khi in giấy nhiệt */
    #invoice-print,
    #invoice-print * {
        background-color: transparent !important;
        background: transparent !important;
        color: #000000 !important;
        border-color: #000000 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        text-shadow: none !important;
    }

    #invoice-print {
        width: 76mm !important;
        max-width: 76mm !important;
        margin: 0 auto !important;
        padding: 3mm 2mm !important;
        box-sizing: border-box !important;
    }

    /* Force table to fit within 76mm print width - no scrollbar, no overflow, all columns visible */
    #invoice-print table {
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
        font-size: 10px !important;
    }

    #invoice-print th,
    #invoice-print td {
        white-space: normal !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
        padding: 2px 1px !important;
        font-size: 10px !important;
    }

    #invoice-print div[class*="overflow"] {
        overflow: visible !important;
        width: 100% !important;
        max-width: 100% !important;
        min-width: 0 !important;
    }
}
</style>