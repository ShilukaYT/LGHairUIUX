<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import axios from 'axios'
import { Search, FileDown, Eye, X, Printer, ShoppingBag, Scissors } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/hoa-don`

// Quản lý độc lập dữ liệu của 2 tab phân hệ
const hoaDonSanPham = ref<any[]>([])
const hoaDonDichVu = ref<any[]>([])

const isLoading = ref(false)
const searchQuery = ref('')
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
            // Lấy thêm thông tin từ Dashboard để bổ sung danh sách chi tiết (chứa số lượng) cho hóa đơn sản phẩm
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

            // Lấy toàn bộ danh sách hóa đơn trả về từ server
            const allData = [
                ...(res.data.hoaDonSanPham || []),
                ...(res.data.hoaDonDichVu || [])
            ]
            
            // Bổ sung chi tiết sản phẩm cho từng hóa đơn
            allData.forEach((h: any) => {
                const ma = String(h.maHd || '').toUpperCase();
                if (dashboardSpMap.has(ma)) {
                    h.chiTiet = dashboardSpMap.get(ma);
                }
            });
            
            // SỬA LỖI HIỂN THỊ NHẦM: Phân loại chính xác bằng mã tiền tố ngay tại Frontend
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

// Bảng màu trạng thái cao cấp phối chuẩn tone xanh nước biển hiện đại
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

// Hàm thay đổi trạng thái hóa đơn truyền dữ liệu tương thích an toàn với Backend
const changeInvoiceStatus = async (maHd: string, newStatus: number) => {
    // Kiểm tra xem hóa đơn hiện tại có đang ở trạng thái 'Đã giao hàng' / 'Hoàn thành' (trangThai === 3) không
    const allData = [...hoaDonSanPham.value, ...hoaDonDichVu.value];
    const currentHd = allData.find(h => h.maHd === maHd) || (selectedHd.value && selectedHd.value.maHd === maHd ? selectedHd.value : null);
    if (currentHd && currentHd.trangThai === 3) {
        alert("Đơn hàng đã hoàn thành hoặc đã giao hàng. Không thể thay đổi trạng thái khác.");
        return;
    }

    try {
        // Hỗ trợ linh hoạt cả cấu hình nhận Object hoặc nhận số nguyên nguyên bản của Backend
        const payload = { trangThai: newStatus };
        
        const res = await axios.patch(`${API_BASE_URL}/doi-trang-thai/${maHd}`, payload, { headers: getAuthHeaders() })
            .catch(async () => {
                // Phương án dự phòng nếu Backend nhận kiểu số nguyên int nguyên bản thay vì Object DTO
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
    
    const targetList = activeTab.value === 'dichVu' ? hoaDonDichVu.value : hoaDonSanPham.value;
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

// ── Phân trang (Pagination) ──
const currentPage = ref(1)
const perPage = ref(10) // 10 hóa đơn trên mỗi trang

// Reset trang về 1 khi đổi tab, thay đổi bộ lọc ngày hoặc từ khóa tìm kiếm
watch([activeTab, searchQuery, () => filter.value.tuNgay, () => filter.value.denNgay], () => {
    currentPage.value = 1
})

const pagedInvoices = computed(() => {
    const list = activeTab.value === 'dichVu' ? hoaDonDichVu.value : hoaDonSanPham.value
    const start = (currentPage.value - 1) * perPage.value
    return list.slice(start, start + perPage.value)
})

const totalPages = computed(() => {
    const list = activeTab.value === 'dichVu' ? hoaDonDichVu.value : hoaDonSanPham.value
    return Math.ceil(list.length / perPage.value)
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
        pages.push(i)
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
    <div class="hoadon-container">
        <!-- Header -->
        <div class="hd-header">
            <div class="hd-header-left">
                <div class="hd-header-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /></svg>
                </div>
                <div>
                    <h2 class="hd-header-title">Quản Lý Hóa Đơn</h2>
                    <p class="hd-header-subtitle">Tách biệt danh mục Hóa đơn dịch vụ Salon và Hóa đơn mua Sản phẩm lẻ</p>
                </div>
            </div>
            <button @click="exportExcel" class="hd-btn-export">
                <FileDown class="w-4 h-4" /> Xuất Excel
            </button>
        </div>

        <!-- Filters Grid -->
        <div class="hd-filters-grid">
            <div class="hd-filter-item">
                <label class="hd-filter-label">Từ ngày</label>
                <input type="date" v-model="filter.tuNgay" class="hd-input">
            </div>
            <div class="hd-filter-item">
                <label class="hd-filter-label">Đến ngày</label>
                <input type="date" v-model="filter.denNgay" class="hd-input">
            </div>
            <div class="hd-filter-item">
                <label class="hd-filter-label">Tìm kiếm</label>
                <div class="hd-search-wrapper">
                    <Search class="hd-search-icon" />
                    <input v-model="searchQuery" @keyup.enter="fetchHoaDons" placeholder="Mã HD hoặc tên khách..." class="hd-input hd-search-input">
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="hd-tabs">
            <button @click="activeTab = 'dichVu'" :class="{ active: activeTab === 'dichVu' }" class="hd-tab-button">
                <Scissors class="w-4 h-4" /> Hóa đơn Dịch vụ Salon ({{ hoaDonDichVu.length }})
            </button>
            <button @click="activeTab = 'sanPham'" :class="{ active: activeTab === 'sanPham' }" class="hd-tab-button">
                <ShoppingBag class="w-4 h-4" /> Hóa đơn Mua Sản phẩm ({{ hoaDonSanPham.length }})
            </button>
        </div>

        <!-- Table Section -->
        <div class="hd-table-wrapper">
            <div v-if="isLoading" style="text-align: center; padding: 48px; font-weight: 500; color: #2563eb;">Đang đồng bộ nạp danh sách hóa đơn hệ thống...</div>
            <div v-else-if="errorMessage" style="padding: 24px; text-align: center; color: #e11d48; background-color: #fff1f2; border-top: 1px solid #ffe4e6; border-bottom: 1px solid #ffe4e6; font-weight: 600; font-size: 14px;">
                {{ errorMessage }}
            </div>
            <table v-else class="hd-table">
                <thead>
                    <tr>
                        <th class="col-ma-hd">Mã HD</th>
                        <th class="col-khach-hang">Khách hàng</th>
                        <th class="col-ngay-tao">Ngày tạo</th>
                        <th v-if="activeTab === 'sanPham'" class="col-so-luong" style="width: 12%; text-align: center;">Số lượng</th>
                        <th class="col-thanh-tien">Thành tiền</th>
                        <th class="col-trang-thai">Trạng thái đơn hàng</th>
                        <th class="col-thao-tac">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="hd in pagedInvoices" :key="hd.maHd">
                        <td class="col-ma-hd" style="font-weight: 700; color: #2563eb;">{{ hd.maHd }}</td>
                        <td class="col-khach-hang" style="font-weight: 500;">{{ hd.tenKhachHang }}</td>
                        <td class="col-ngay-tao" style="color: #64748b;">{{ new Date(hd.ngayTao).toLocaleDateString('vi-VN') }}</td>
                        <td v-if="activeTab === 'sanPham'" class="col-so-luong text-center" style="width: 12%; text-align: center;">
                            <span class="inline-flex items-center justify-center px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs font-semibold">
                                {{ hd.soLuong || hd.SoLuong || hd.chiTiet?.reduce((sum: number, ct: any) => sum + (ct.soLuong || ct.SoLuong || 0), 0) || 0 }} sp
                            </span>
                        </td>
                        <td class="col-thanh-tien" style="font-weight: 700; color: #0f172a;">{{ hd.thanhTien?.toLocaleString() }}₫</td>
                        <td class="col-trang-thai">
                            <div class="hd-status-wrapper">
                                <select :value="hd.trangThai" :disabled="hd.trangThai === 3" @change="changeInvoiceStatus(hd.maHd, Number(($event.target as HTMLSelectElement).value))" class="hd-status-select" :class="statusLabel(hd.trangThai, hd.maHd).class">
                                    <option value="1" class="text-slate-700 bg-white">{{ hd.maHd.startsWith('SP') ? 'Chờ xử lý' : 'Đã cọc 10%' }}</option>
                                    <option value="2" class="text-slate-700 bg-white">{{ hd.maHd.startsWith('SP') ? 'Đang giao' : 'Đã thanh toán' }}</option>
                                    <option value="3" class="text-slate-700 bg-white">{{ hd.maHd.startsWith('SP') ? 'Đã giao hàng' : 'Hoàn thành' }}</option>
                                    <option value="0" class="text-slate-700 bg-white">Đã Hủy</option>
                                </select>
                                <div class="hd-dropdown-arrow">
                                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </td>
                        <td class="col-thao-tac">
                            <button @click="viewDetail(hd.maHd)" class="hd-btn-action">
                                <Eye class="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                    <tr v-if="pagedInvoices.length === 0">
                        <td colspan="6" style="padding: 40px; text-align: center; color: #94a3b8; background-color: #f8fafc; border-style: dashed;">Không có dữ liệu hóa đơn nào trong danh mục phân hệ này.</td>
                    </tr>
                </tbody>
            </table>
            <!-- Pagination Controls -->
            <div v-if="totalPages > 1" class="hd-pagination print:hidden">
                <button @click="changePage(currentPage - 1)" :disabled="currentPage === 1" class="hd-page-btn">
                    Trước
                </button>
                <div class="hd-page-numbers">
                    <button v-for="p in visiblePages" :key="p" @click="changePage(p)" :class="{ active: currentPage === p }" class="hd-page-number-btn">
                        {{ p }}
                    </button>
                </div>
                <button @click="changePage(currentPage + 1)" :disabled="currentPage === totalPages" class="hd-page-btn">
                    Sau
                </button>
            </div>
        </div>
    </div>

    <!-- Detail Modal -->
    <Teleport to="body">
        <div v-if="isModalOpen" class="hd-modal-overlay">
            <div class="hd-modal-container">
            <div class="hd-modal-header print:hidden">
                <h3 class="hd-modal-title">Hóa đơn chi tiết: #{{ selectedHd.maHd }}</h3>
                <div class="hd-modal-header-actions">
                    <button @click="printInvoice" class="hd-btn-print">
                        <Printer class="w-4 h-4" /> In Hóa Đơn
                    </button>
                    <button @click="isModalOpen = false" class="hd-btn-close">
                        <X class="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div class="hd-modal-body">
                <div id="invoice-print" class="hd-invoice-print">
                    <div class="hd-invoice-print-header">
                        <h1>Minh Tâm Hair Salon</h1>
                        <p>Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
                        <p style="font-weight: 700;">Hotline: 0123.456.789</p>
                    </div>

                    <div class="hd-invoice-info-grid">
                        <div class="hd-invoice-info-left">
                            <p><span class="hd-invoice-info-label">Mã HĐ:</span> <span class="hd-invoice-info-value">#{{ selectedHd.maHd }}</span></p>
                            <p><span class="hd-invoice-info-label">Ngày tạo:</span> <span class="hd-invoice-info-value" style="color: #334155;">{{ new Date(selectedHd.ngayTao).toLocaleString('vi-VN') }}</span></p>
                        </div>
                        <div class="hd-invoice-info-right">
                            <p><span class="hd-invoice-info-label">Khách hàng:</span> <span class="hd-invoice-info-value">{{ selectedHd.tenKh }}</span></p>
                            <p><span class="hd-invoice-info-label">Tổng thu ngân:</span> <span class="hd-invoice-info-value" style="color: #334155;">{{ selectedHd.tenThuNgan }}</span></p>
                        </div>
                    </div>

                    <table class="hd-invoice-table">
                        <thead>
                            <tr>
                                <th style="text-align: left;">Tên Sản phẩm / Dịch vụ</th>
                                <th style="text-align: center; width: 80px;">Số lượng</th>
                                <th style="text-align: left;">Người thực hiện / Ghi chú</th>
                                <th style="text-align: right;">Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(item, index) in (selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? (selectedHd.chiTiet || selectedHd.chiTietDichVu || []) : (selectedHd.chiTietDichVu || []))" :key="index">
                                <td style="font-weight: 500;">{{ item.ten || item.Ten || item.tenHangMuc || item.tenSP || item.tenSp }}</td>
                                <td style="text-align: center; font-weight: 600;">{{ item.soLuong || item.SoLuong || item.soluong || 1 }}</td>
                                <td><span class="hd-invoice-badge">{{ selectedHd.maHd?.toUpperCase().startsWith('SP') || selectedHd.maHd?.toUpperCase().startsWith('HDSP') ? 'Sản phẩm' : (item.thoThucHien || 'Hệ thống') }}</span></td>
                                <td style="text-align: right; font-weight: 700; color: #0f172a;">{{ (item.gia || item.Gia || item.giaBan || 0).toLocaleString() }}₫</td>
                            </tr>
                        </tbody>
                    </table>

                    <div class="print:hidden hd-invoice-quick-update">
                        <span class="hd-invoice-quick-update-label">Cập nhật trạng thái nhanh:</span>
                        <div class="hd-status-wrapper">
                            <select :value="selectedHd.trangThai" :disabled="selectedHd.trangThai === 3" @change="changeInvoiceStatus(selectedHd.maHd, Number(($event.target as HTMLSelectElement).value))" class="hd-status-select" :class="statusLabel(selectedHd.trangThai, selectedHd.maHd).class">
                                <option value="1" class="bg-white text-slate-700">{{ selectedHd.maHd.startsWith('SP') ? 'Chờ xử lý' : 'Đã cọc 10%' }}</option>
                                <option value="2" class="bg-white text-slate-700">{{ selectedHd.maHd.startsWith('SP') ? 'Đang giao' : 'Đã thanh toán' }}</option>
                                <option value="3" class="bg-white text-slate-700">{{ selectedHd.maHd.startsWith('SP') ? 'Đã giao hàng' : 'Hoàn thành' }}</option>
                                <option value="0" class="bg-white text-slate-700">Đã Hủy</option>
                            </select>
                            <div class="hd-dropdown-arrow">
                                <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>
                    </div>

                    <div class="hd-invoice-total">
                        <p class="hd-invoice-total-sub">Tạm tính gốc: <strong>{{ selectedHd.tongTien?.toLocaleString() }}₫</strong></p>
                        <p v-if="selectedHd.giamGiaVip" class="hd-invoice-total-vip">Giảm giá VIP: -{{ selectedHd.giamGiaVip }}%</p>
                        <p class="hd-invoice-total-main">Tổng doanh thu nhận về: {{ selectedHd.thanhTien?.toLocaleString() }}₫</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
    </Teleport>
</template>

<style scoped>
/* ── Container ── */
.hoadon-container {
    padding: 24px;
    background-color: #f8fafc;
    min-height: 100vh;
    border-radius: 16px;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
}

/* ── Header ── */
.hd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
    flex-wrap: wrap;
    gap: 16px;
}
.hd-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}
.hd-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background-color: #2563eb;
    color: #ffffff !important;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
    flex-shrink: 0;
}
.hd-header-icon svg {
    width: 24px;
    height: 24px;
    stroke: currentColor;
}
.hd-header-title {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
}
.hd-header-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0 0;
}

/* ── Export Button ── */
.hd-btn-export {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
.hd-btn-export:hover {
    background-color: #1d4ed8 !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
}
.hd-btn-export:active {
    transform: translateY(0);
}

/* ── Filters Grid ── */
.hd-filters-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    background-color: #ffffff;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid #edf2f7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
@media (max-width: 768px) {
    .hd-filters-grid {
        grid-template-columns: 1fr;
    }
}
.hd-filter-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.hd-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.hd-input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    font-size: 14px;
    color: #1e293b;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
}
.hd-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

/* ── Search Input ── */
.hd-search-wrapper {
    position: relative;
    width: 100%;
}
.hd-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    width: 18px;
    height: 18px;
    pointer-events: none;
}
.hd-search-input {
    padding-left: 40px !important;
}

/* ── Tabs ── */
.hd-tabs {
    display: flex;
    border-bottom: 2px solid #e2e8f0;
    gap: 8px;
    margin-top: 8px;
}
.hd-tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 14px;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px 8px 0 0;
}
.hd-tab-button:hover {
    color: #1e293b;
    background-color: #f1f5f9;
}
.hd-tab-button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
    background-color: rgba(37, 99, 235, 0.04);
}

/* ── Table Wrapper ── */
.hd-table-wrapper {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow-x: auto;
    width: 100%;
}

/* ── Table ── */
.hd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
    min-width: 800px;
}
.hd-table th {
    padding: 14px 16px;
    background-color: #f8fafc;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
}
.hd-table td {
    padding: 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
}
.hd-table tbody tr:hover {
    background-color: rgba(37, 99, 235, 0.01);
}
.hd-table tbody tr:last-child td {
    border-bottom: none;
}

/* ── Explicit widths for perfect table alignment ── */
.col-ma-hd { width: 15%; }
.col-khach-hang { width: 22%; }
.col-ngay-tao { width: 15%; }
.col-so-luong { width: 12%; text-align: center; }
.col-thanh-tien { width: 15%; }
.col-trang-thai { width: 23%; text-align: center; }
.col-thao-tac { width: 10%; text-align: center; }

/* ── Status Dropdown ── */
.hd-status-wrapper {
    display: inline-flex;
    position: relative;
    min-width: 150px;
    width: 100%;
    max-width: 180px;
}
.hd-status-select {
    width: 100%;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 8px 32px 8px 12px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.hd-status-select:focus {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.hd-status-select:disabled {
    cursor: not-allowed;
    opacity: 0.65;
}
.hd-dropdown-arrow {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    width: 16px;
    height: 16px;
    color: currentColor;
    opacity: 0.8;
}

/* ── Status Colors ── */
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

/* ── Action Button ── */
.hd-btn-action {
    background: none;
    border: none;
    color: #64748b;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.hd-btn-action:hover {
    color: #2563eb;
    background-color: rgba(37, 99, 235, 0.05);
}

/* ── Modal & Print ── */
.hd-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}
.hd-modal-container {
    background-color: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 680px;
    overflow: hidden;
    animation: hdModalShow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes hdModalShow {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.hd-modal-header {
    padding: 16px 24px;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.hd-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}
.hd-modal-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}
.hd-btn-print {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: none;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    transition: all 0.2s ease;
}
.hd-btn-print:hover {
    background-color: #1d4ed8 !important;
}
.hd-btn-close {
    background: none;
    border: none;
    color: #94a3b8;
    padding: 6px;
    border-radius: 9999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}
.hd-btn-close:hover {
    color: #475569;
    background-color: #e2e8f0;
}

.hd-modal-body {
    padding: 24px;
    max-height: 80vh;
    overflow-y: auto;
}

.hd-invoice-print {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    color: #1e293b;
}
.hd-invoice-print-header {
    text-align: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
}
.hd-invoice-print-header h1 {
    font-size: 22px;
    font-weight: 800;
    text-transform: uppercase;
    color: #2563eb;
    margin: 0 0 4px 0;
    letter-spacing: 0.05em;
}
.hd-invoice-print-header p {
    font-size: 13px;
    color: #64748b;
    margin: 2px 0;
}
.hd-invoice-info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    background-color: #f8fafc;
    padding: 16px;
    border-radius: 10px;
    border: 1px solid #edf2f7;
    font-size: 13px;
}
.hd-invoice-info-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.hd-invoice-info-right {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: right;
}
.hd-invoice-info-label {
    color: #94a3b8;
    text-transform: uppercase;
    font-size: 11px;
    font-weight: 600;
    margin-right: 4px;
}
.hd-invoice-info-value {
    color: #334155;
    font-weight: 700;
}
.hd-invoice-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
}
.hd-invoice-table th {
    padding: 10px 14px;
    background-color: #f8fafc;
    color: #475569;
    font-weight: 700;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
}
.hd-invoice-table td {
    padding: 12px 14px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
}
.hd-invoice-table tbody tr:last-child td {
    border-bottom: none;
}
.hd-invoice-badge {
    padding: 2px 8px;
    border-radius: 4px;
    background-color: #f1f5f9;
    color: #475569;
    font-size: 10px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
}
.hd-invoice-quick-update {
    border-top: 1px dashed #cbd5e1;
    padding-top: 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
.hd-invoice-quick-update-label {
    font-size: 12px;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.hd-invoice-total {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
}
.hd-invoice-total-sub {
    font-size: 13px;
    color: #64748b;
}
.hd-invoice-total-vip {
    font-size: 13px;
    color: #ef4444;
    font-weight: 600;
}
.hd-invoice-total-main {
    font-size: 18px;
    font-weight: 800;
    color: #2563eb;
}

/* ── Pagination ── */
.hd-pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background-color: #ffffff;
    border-top: 1px solid #f1f5f9;
    border-radius: 0 0 14px 14px;
}
.hd-page-btn {
    padding: 8px 16px;
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
}
.hd-page-btn:hover:not(:disabled) {
    background-color: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
}
.hd-page-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}
.hd-page-numbers {
    display: flex;
    gap: 6px;
    align-items: center;
}
.hd-page-number-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all 0.2s ease;
}
.hd-page-number-btn:hover:not(.active) {
    background-color: #f8fafc;
    border-color: #cbd5e1;
    color: #1e293b;
}
.hd-page-number-btn.active {
    background-color: #2563eb !important;
    color: #ffffff !important;
    border-color: #2563eb !important;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.15);
}

</style>

<style>
@media print {
    #app {
        display: none !important;
    }
    body {
        background-color: #ffffff !important;
        margin: 0 !important;
        padding: 0 !important;
    }
    .hd-modal-overlay {
        position: static !important;
        background: none !important;
        backdrop-filter: none !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        height: auto !important;
        display: block !important;
    }
    .hd-modal-container {
        box-shadow: none !important;
        border: none !important;
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #ffffff !important;
    }
    .hd-invoice-print {
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
    }
    .hd-modal-overlay,
    .hd-modal-overlay *,
    .hd-modal-container,
    .hd-modal-container * {
        visibility: visible !important;
    }
    .print\:hidden,
    .hd-modal-header,
    .hd-invoice-quick-update {
        display: none !important;
    }
}
</style>