<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
    Search, UserCheck, X, Clock, Users,
    Plus, Trash2, ChevronLeft, ChevronRight,
    Calendar as CalendarIcon, CheckCircle2, Phone,
    Camera, Mail, Package, Minus, ShoppingCart, RefreshCw, CreditCard, Info
} from 'lucide-vue-next'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'

import QrScannerModal from './QrScannerModal.vue'

// Sử dụng đúng API của CheckOutController
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
const API_BASE_URL = `${API}/api/CheckOut`;

// --- State ---
const appointments = ref<any[]>([])
const stylists = ref<any[]>([])
const isLoading = ref(false)
const selectedAppointment = ref<any>(null)
const selectedStylistId = ref<string | null>(null)
const selectedConsultantId = ref<string | null>(null)

// MẶC ĐỊNH LUÔN CHỌN TIỀN MẶT
const selectedPaymentMethod = ref<string>('tienmat') 

const searchQuery = ref('')
const filterDate = ref(new Date().toISOString().split('T')[0])
const currentPage = ref(1)
const itemsPerPage = 8
const showScanner = ref(false)

// Dịch vụ
const allServicesFromApi = ref<any[]>([])
const serviceSearch = ref('')
const showServiceList = ref(false)

// Sản phẩm
const productSearch = ref('')
const showProductList = ref(false)

// Dữ liệu gốc để đối chiếu thay đổi
const originalServices = ref<any[]>([])
const originalProducts = ref<any[]>([])
const allProductsFromApi = ref<any[]>([])
const originalStylistId = ref<string | null>(null)

// Tính toán trực tiếp danh sách gợi ý khi gõ chữ (Phân nhóm theo sản phẩm chính giống ThanhToanTong.vue)
const productSuggestions = computed(() => {
    const query = productSearch.value.toLowerCase().trim();
    let list = allProductsFromApi.value || [];
    
    // Lọc theo từ khóa
    if (query) {
        list = list.filter(p => p.tenSanPham && p.tenSanPham.toLowerCase().includes(query));
    }
    
    // Giới hạn 25 kết quả để menu không quá dài trước khi phân nhóm
    const limitedList = list.slice(0, 25);
    
    // Phân nhóm các biến thể theo tên sản phẩm chính
    const groups: { [key: string]: any[] } = {};
    limitedList.forEach(p => {
        const parts = (p.tenSanPham || 'Sản phẩm không tên').split(' - ');
        const parentName = parts[0].trim();
        const variantName = parts.slice(1).join(' - ').trim() || 'Mặc định';
        
        if (!groups[parentName]) {
            groups[parentName] = [];
        }
        groups[parentName].push({
            id: p.id || p.maBienThe || p.Id,
            name: variantName,
            fullName: p.tenSanPham || 'Sản phẩm không tên',
            price: Number(p.gia || 0),
            image: p.hinhAnh,
            soLuongTon: p.soLuongTon || 0,
            phanTramHoaHong: p.phanTramHoaHong || 0
        });
    });
    
    return groups;
});


const formatTime = (timeStr: string) => {
    if (!timeStr) return '00:00';
    return timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
};

// --- LOGIC TÍNH TOÁN (ĐÃ FIX LỖI NaN) ---
const serviceTotal = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.dichVus) return 0;
    return selectedAppointment.value.dichVus.reduce((sum: number, s: any) => sum + Number(s.gia || 0), 0);
});

const productTotal = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.sanPhams) return 0;
    return selectedAppointment.value.sanPhams.reduce((sum: number, p: any) => sum + (Number(p.gia || 0) * Number(p.soLuong || 1)), 0);
});

// Tự động tính tổng = Dịch vụ + Sản phẩm
const currentTotal = computed(() => {
    return serviceTotal.value + productTotal.value;
});

// Số tiền còn phải trả
const amountToPay = computed(() => {
    if (!selectedAppointment.value) return 0;
    const total = currentTotal.value; 
    const discount = Number(selectedAppointment.value.tienGiam || 0);
    const prePaid = Number(selectedAppointment.value.daThanhToan || 0);
    return Math.max(0, total - discount - prePaid);
});

const memberDiscountAmount = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.phanTramGiamVip) return 0;
    return Math.round(selectedAppointment.value.tongTien * (selectedAppointment.value.phanTramGiamVip / 100));
});

const voucherDiscountAmount = computed(() => {
    if (!selectedAppointment.value) return 0;
    const totalDiscount = Number(selectedAppointment.value.tienGiam || 0);
    return Math.max(0, totalDiscount - memberDiscountAmount.value);
});

const serviceCommissionAmount = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.dichVus) return 0;
    return selectedAppointment.value.dichVus.reduce((sum: number, s: any) => {
        const phanTram = Number(s.phanTramHoaHong || 0);
        const gia = Number(s.gia || s.Price || 0);
        return sum + Math.round(gia * phanTram / 100);
    }, 0);
});

const productCommissionAmount = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.sanPhams) return 0;
    return selectedAppointment.value.sanPhams.reduce((sum: number, p: any) => {
        const phanTram = Number(p.phanTramHoaHong || 0);
        const gia = Number(p.gia || 0);
        const soLuong = Number(p.soLuong || 1);
        return sum + Math.round(gia * soLuong * phanTram / 100);
    }, 0);
});

const commissionNotice = computed(() => {
    if (!selectedStylistId.value) return '';
    const stylist = stylists.value.find(s => s.id === selectedStylistId.value);
    const stylistName = stylist ? stylist.name : 'Stylist';
    
    const svcAmount = serviceCommissionAmount.value.toLocaleString() + 'đ';
    const prodAmount = productCommissionAmount.value.toLocaleString() + 'đ';
    const totalAmount = (serviceCommissionAmount.value + productCommissionAmount.value).toLocaleString() + 'đ';
    
    if (selectedConsultantId.value) {
        const consultant = stylists.value.find(s => s.id === selectedConsultantId.value);
        const consultantName = consultant ? consultant.name : 'Nhân viên';
        return `Hoa hồng: ${stylistName} nhận ${svcAmount} (Dịch vụ) - ${consultantName} nhận ${prodAmount} (Sản phẩm)`;
    }
    return `Hoa hồng: ${stylistName} nhận ${totalAmount} (Dịch vụ & Sản phẩm)`;
});

// --- Lọc dữ liệu ---
const filteredData = computed(() => {
    return appointments.value.filter(a => {
        const q = searchQuery.value.toLowerCase().trim();
        return a.tenKhach.toLowerCase().includes(q) || a.sdt.includes(q) || a.maLd.toLowerCase().includes(q);
    });
});

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredData.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1);

// --- Tải dữ liệu ---
const fetchData = async () => {
    isLoading.value = true;
    try {
        const [resList, resStylists, resServices, resProducts] = await Promise.all([
            axios.get(`${API_BASE_URL}/get-checkout-list`, { params: { date: filterDate.value } }),
            axios.get(`${API}/api/NhanVien`, { params: { trangThai: 1 } }),
            axios.get(`${API}/api/CheckIn/all-services-combos`),
            // THÊM API TẢI SẢN PHẨM VÀO ĐÂY
            axios.get(`${API_BASE_URL}/get-all-products`) 
        ]);
        appointments.value = resList.data;
        stylists.value = resStylists.data.map((nv: any) => ({
            id: nv.maNv,
            name: nv.hoTenNv,
            role: nv.tenLoaiNv,
            img: nv.hinhAnh || "https://i.pravatar.cc/150"
        }));
        allServicesFromApi.value = resServices.data;
        allProductsFromApi.value = resProducts.data; // Lưu lại danh sách sản phẩm
    } catch (error) {
        toast.error("Lỗi tải dữ liệu hệ thống!");
    } finally {
        isLoading.value = false;
    }
};

// (Đã chuyển sang dùng computed productSuggestions ở trên để tìm kiếm local)

// --- Chọn hóa đơn ---
const setSelectedAppointment = async (appt: any) => {
    isLoading.value = true;
    try {
        const res = await axios.get(`${API_BASE_URL}/get-checkout-detail/${appt.maLd}`);
        if (res.data) {
            selectedAppointment.value = res.data;
            selectedStylistId.value = res.data.maNv ? String(res.data.maNv) : null;
            originalStylistId.value = res.data.maNv ? String(res.data.maNv) : null;
            selectedConsultantId.value = null;
            originalServices.value = JSON.parse(JSON.stringify(res.data.dichVus ?? []));
            originalProducts.value = JSON.parse(JSON.stringify(res.data.sanPhams ?? []));
        }
    } catch (error: any) {
        toast.error(error.response?.data || "Không tìm thấy chi tiết hóa đơn!");
    } finally {
        isLoading.value = false;
    }
};

const handleScanData = async (qrData: string) => {
    showScanner.value = false;
    isLoading.value = true;
    try {
        const res = await axios.get(`${API_BASE_URL}/get-checkout-detail/${qrData}`);
        if (res.data) {
            selectedAppointment.value = res.data;
            selectedStylistId.value = res.data.maNv ? String(res.data.maNv) : null;
            originalStylistId.value = res.data.maNv ? String(res.data.maNv) : null;
            selectedConsultantId.value = null;
            originalServices.value = JSON.parse(JSON.stringify(res.data.dichVus ?? []));
            originalProducts.value = JSON.parse(JSON.stringify(res.data.sanPhams ?? []));
            toast.success("Đã tìm thấy hóa đơn từ QR Code!");
        }
    } catch (error) {
        toast.error("Không tìm thấy mã lượt phục vụ này!");
    } finally {
        isLoading.value = false;
    }
};

// --- Dịch vụ UI logic ---
const filteredServices = computed(() => {
    const query = serviceSearch.value.toLowerCase().trim();
    let list = allServicesFromApi.value;
    if (query) {
        list = list.filter(s => {
            const name = (s.name || s.Name || '').toLowerCase();
            return name.includes(query);
        });
    }
    if (selectedAppointment.value && selectedAppointment.value.dichVus) {
        const existingIds = new Set(selectedAppointment.value.dichVus.map((d: any) => d.id));
        list = list.filter(s => !existingIds.has(s.id || s.Id));
    }
    return list.slice(0, 10);
});

const addService = (service: any) => {
    if (!selectedAppointment.value) return;
    selectedAppointment.value.dichVus.push({
        id: service.id || service.Id,
        ten: service.name || service.Name,
        gia: Number(service.price || service.Price || 0)
    });
    serviceSearch.value = '';
    showServiceList.value = false;
    toast.success(`Đã thêm dịch vụ: ${service.name || service.Name}`);
};

const removeService = (index: number) => {
    if (!selectedAppointment.value) return;
    selectedAppointment.value.dichVus.splice(index, 1);
};


// --- Sản phẩm UI logic ---
const getMaxInventory = (id: string) => {
    const prod = allProductsFromApi.value.find(p => p.id === id || p.maBienThe === id);
    return prod ? (prod.soLuongTon || 0) : 999;
};

const addProduct = (prod: any) => {
    if (!selectedAppointment.value) return;
    if (!selectedAppointment.value.sanPhams) selectedAppointment.value.sanPhams = [];
    
    const productName = prod.fullName || prod.name;
    const existing = selectedAppointment.value.sanPhams.find((p: any) => p.id === prod.id);
    
    if (existing) {
        if (existing.soLuong >= prod.soLuongTon) {
            toast.warning(`Sản phẩm này chỉ còn ${prod.soLuongTon} trong kho!`);
            return;
        }
        existing.soLuong += 1;
        toast.success(`Đã tăng số lượng: ${productName}`);
    } else {
        if (prod.soLuongTon < 1) {
            toast.warning('Sản phẩm này đã hết hàng!');
            return;
        }
        selectedAppointment.value.sanPhams.push({
            id: prod.id,
            ten: productName,
            gia: Number(prod.price || 0),
            soLuong: 1,
            phanTramHoaHong: prod.phanTramHoaHong || 0
        });
        toast.success(`Đã thêm sản phẩm: ${productName}`);
    }
    productSearch.value = '';
    showProductList.value = false;
};

const updateProductQty = (index: number, delta: number) => {
    if (!selectedAppointment.value) return;
    const p = selectedAppointment.value.sanPhams[index];
    
    if (delta > 0) {
        const maxTon = getMaxInventory(p.id);
        if (p.soLuong >= maxTon) {
            toast.warning(`Chỉ có thể mua tối đa ${maxTon} sản phẩm này!`);
            return;
        }
    }

    p.soLuong += delta;
    if (p.soLuong <= 0) {
        selectedAppointment.value.sanPhams.splice(index, 1);
        toast.info("Đã xóa sản phẩm khỏi giỏ.");
    }
};

const removeProduct = (index: number) => {
    if (!selectedAppointment.value) return;
    selectedAppointment.value.sanPhams.splice(index, 1);
};

// --- Kiểm tra thay đổi ---
const isOrderModified = computed(() => {
    if (!selectedAppointment.value) return false;
    if (selectedStylistId.value !== originalStylistId.value) return true;
    const sCurrent = selectedAppointment.value.dichVus || [];
    const sOrig = originalServices.value || [];
    const pCurrent = selectedAppointment.value.sanPhams || [];
    const pOrig = originalProducts.value || [];

    if (sCurrent.length !== sOrig.length || pCurrent.length !== pOrig.length) return true;

    const currentSIds = sCurrent.map((s: any) => `${s.id}-${s.gia}`).sort();
    const origSIds = sOrig.map((s: any) => `${s.id}-${s.gia}`).sort();
    for (let i = 0; i < currentSIds.length; i++) {
        if (currentSIds[i] !== origSIds[i]) return true;
    }

    const currentPIds = pCurrent.map((p: any) => `${p.id}-${p.gia}-${p.soLuong}`).sort();
    const origPIds = pOrig.map((p: any) => `${p.id}-${p.gia}-${p.soLuong}`).sort();
    for (let i = 0; i < currentPIds.length; i++) {
        if (currentPIds[i] !== origPIds[i]) return true;
    }

    return false;
});

// --- API Gọi Update ---
const updateOrder = async () => {
    if (!selectedAppointment.value || !selectedStylistId.value) {
        toast.error("Vui lòng chọn Stylist phục vụ!");
        return;
    }

    try {
        isLoading.value = true;
        const payload = {
            maLd: selectedAppointment.value.maLd,
            maStylist: selectedStylistId.value,
            services: (selectedAppointment.value.dichVus || []).map((s: any) => ({ 
                id: s.id || s.Id, 
                gia: Number(s.gia || s.Price || 0) 
            })),
            products: (selectedAppointment.value.sanPhams || []).map((p: any) => ({ 
                id: p.id || p.maBienThe, 
                gia: Number(p.gia || p.price || p.GiaBan || 0), 
                soLuong: Number(p.soLuong || 1) 
            }))
        };
        console.log("Payload sending to update-order:", payload);

        const res = await axios.post(`${API_BASE_URL}/update-order`, payload);
        toast.success(res.data.message || "Cập nhật đơn hàng thành công!");

        await setSelectedAppointment(selectedAppointment.value);
        await fetchData();
    } catch (error: any) {
        toast.error(error.response?.data?.message || "Lỗi cập nhật!");
    } finally {
        isLoading.value = false;
    }
};

// --- API Gọi Thanh toán ---
const confirmPayment = async () => {
    if (!selectedAppointment.value) return;

    if (isOrderModified.value) {
        toast.warning("Vui lòng bấm 'CẬP NHẬT ĐƠN' để chốt tổng chi phí trước khi thanh toán!");
        return;
    }

    if (!selectedStylistId.value) {
        toast.error("Vui lòng chọn Stylist phục vụ!");
        return;
    }

    const payAmount = amountToPay.value;
    const methodText = selectedPaymentMethod.value === 'tienmat' ? 'Tiền mặt' : selectedPaymentMethod.value === 'vnpay' ? 'VNPay' : 'MoMo';

    const confirmResult = await Swal.fire({
        title: 'Xác nhận thanh toán?',
        html: `Thu số tiền <b class="text-error" style="font-size: 1.2rem;">${payAmount.toLocaleString()}đ</b> qua <b>${methodText}</b>?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đã thu tiền & Hoàn thành',
        cancelButtonText: 'Đóng',
        confirmButtonColor: '#16a34a'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        isLoading.value = true;
        const payload = {
            maLd: selectedAppointment.value.maLd,
            maStylist: selectedStylistId.value,
            paymentMethod: selectedPaymentMethod.value,
            amountToPay: payAmount
        };

        const res = await axios.post(`${API_BASE_URL}/confirm-payment`, payload);

        if (res.data.payUrl) {
            window.location.href = res.data.payUrl;
        } else {
            await Swal.fire('Thành công', res.data.message || 'Thanh toán thành công và hóa đơn đã hoàn tất!', 'success');
            selectedAppointment.value = null;
            await fetchData();
        }
    } catch (error: any) {
        toast.error(error.response?.data?.message || error.response?.data || "Lỗi xử lý thanh toán!");
    } finally {
        isLoading.value = false;
    }
};

onMounted(async () => {
    await fetchData();

    // Kiểm tra kết quả thanh toán online (VNPay/MoMo) từ các tham số trên URL
    const params = new URLSearchParams(window.location.search);
    const vnpCode = params.get('vnp_ResponseCode');
    const momoCode = params.get('resultCode');

    if (vnpCode !== null || momoCode !== null) {
        const isSuccess = vnpCode === '00' || momoCode === '0';
        const message = isSuccess 
            ? 'Thanh toán trực tuyến thành công và hóa đơn đã hoàn tất!' 
            : 'Thanh toán trực tuyến thất bại hoặc giao dịch đã bị hủy.';

        await Swal.fire({
            title: isSuccess ? 'Thanh toán thành công' : 'Thanh toán thất bại',
            text: message,
            icon: isSuccess ? 'success' : 'error',
            confirmButtonText: 'Đồng ý',
            confirmButtonColor: '#1a1a2e'
        });

        // Xóa tham số truy vấn khỏi URL để tránh hiển thị lại thông báo khi F5/reload trang
        window.history.replaceState({}, document.title, window.location.pathname);
    }
});
watch(filterDate, fetchData);
</script>

<template>
    <v-container fluid class="pa-6 font-sans">
        
        <!-- Header -->
        <div class="d-flex align-center justify-space-between mb-6 flex-wrap gap-4">
            <div>
                <h1 class="text-h5 font-weight-bold page-title">Check-out thanh toán</h1>
                <p class="text-body-2 text-medium-emphasis mt-1">Tính tiền, xuất hóa đơn và hoàn thành dịch vụ</p>
            </div>
            
            <div class="d-flex gap-4">
                <v-text-field
                    v-model="filterDate"
                    type="date"
                    label="Lọc theo ngày"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                    color="primary"
                    style="width: 200px;"
                >
                    <template #prepend-inner>
                        <CalendarIcon class="w-4 h-4 text-slate-400 mr-1" />
                    </template>
                </v-text-field>
                <v-btn color="primary" variant="outlined" height="48px" class="rounded-lg" @click="fetchData" :loading="isLoading">
                    <RefreshCw class="w-4 h-4 mr-1.5" /> Làm mới
                </v-btn>
            </div>
        </div>

        <v-row>
            <!-- CỘT TRÁI: Khách đang phục vụ -->
            <v-col cols="12" lg="6">
                <v-card elevation="0" border class="rounded-xl h-100">
                    <v-card-text class="pa-5">
                        
                        <!-- Search & QR -->
                        <v-row class="mb-5" align="center" dense>
                            <v-col cols="12" sm="8">
                                <v-text-field v-model="searchQuery" label="Tìm tên khách, SĐT hoặc Mã..." variant="outlined" density="comfortable" hide-details clearable>
                                    <template #prepend-inner><Search class="w-4 h-4 text-slate-400 mr-1" /></template>
                                </v-text-field>
                            </v-col>
                            <v-col cols="12" sm="4">
                                <v-btn color="primary" variant="flat" height="48px" block class="rounded-lg font-weight-bold primary-btn" @click="showScanner = true">
                                    <Camera class="w-4 h-4 mr-1.5" /> Quét QR Bill
                                </v-btn>
                            </v-col>
                        </v-row>

                        <div v-if="isLoading && appointments.length === 0" class="d-flex justify-center py-10">
                            <v-progress-circular indeterminate color="primary" />
                        </div>

                        <!-- Danh sách -->
                        <v-table v-else hover class="border rounded-lg">
                            <thead>
                                <tr>
                                    <th class="font-weight-bold">Khách hàng / Mã đơn</th>
                                    <th class="font-weight-bold text-center">Giờ làm</th>
                                    <th class="font-weight-bold text-right">Tổng bill</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="item in paginatedData" :key="item.maLd" @click="setSelectedAppointment(item)"
                                    class="cursor-pointer" :class="{ 'selected-row': selectedAppointment?.maLd === item.maLd }">
                                    <td class="py-3">
                                        <div class="font-weight-bold text-body-2 customer-name-text">{{ item.tenKhach }}</div>
                                        <div class="text-caption text-medium-emphasis mt-0.5">{{ item.sdt }} • <span class="text-primary font-weight-bold">#{{ item.maLd }}</span></div>
                                    </td>
                                    <td class="text-center py-3">
                                        <v-chip size="small" color="primary" variant="tonal"><Clock class="w-3.5 h-3.5 mr-1" /> {{ formatTime(item.ngayHen) }}</v-chip>
                                    </td>
                                    <td class="text-right font-weight-bold py-3 text-error">
                                        {{ Math.max(0, item.tongTien - item.tienGiam - item.daThanhToan).toLocaleString() }}đ
                                    </td>
                                </tr>
                                <tr v-if="paginatedData.length === 0">
                                    <td colspan="3" class="text-center py-10 text-medium-emphasis">
                                        <Users class="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <div class="text-body-2 font-weight-bold">Trống</div>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>

                        <!-- Phân trang -->
                        <div class="d-flex align-center justify-space-between mt-5">
                            <span class="text-caption text-medium-emphasis">Trang {{ currentPage }} / {{ totalPages }}</span>
                            <div>
                                <v-btn icon variant="plain" :disabled="currentPage === 1" @click="currentPage--"><ChevronLeft class="w-5 h-5" /></v-btn>
                                <v-btn icon variant="plain" :disabled="currentPage === totalPages" @click="currentPage++"><ChevronRight class="w-5 h-5" /></v-btn>
                            </div>
                        </div>

                    </v-card-text>
                </v-card>
            </v-col>

            <!-- CỘT PHẢI: Panel chi tiết tính tiền -->
            <v-col cols="12" lg="6">
                <v-card v-if="selectedAppointment" elevation="0" border class="rounded-xl d-flex flex-column h-100">
                    <!-- Title -->
                    <v-card-item class="border-b px-5 py-4">
                        <template #prepend><v-chip size="x-small" color="primary" variant="flat" class="mr-2 primary-btn">#{{ selectedAppointment.maLd }}</v-chip></template>
                        <v-card-title class="text-body-1 font-weight-bold">Phiếu thanh toán</v-card-title>
                        <template #append><v-btn icon variant="text" color="grey" @click="selectedAppointment = null"><X class="w-4 h-4" /></v-btn></template>
                    </v-card-item>

                    <v-card-text class="pa-5 d-flex flex-column gap-y-4" style="overflow-y: auto;">
                        <!-- Khách hàng -->
                        <div class="client-info-card pa-4 rounded-lg border">
                            <div class="text-[10px] text-medium-emphasis uppercase font-weight-bold">Khách hàng</div>
                            <div class="text-h6 font-weight-black mt-1 client-name-title">{{ selectedAppointment.tenKhach }}</div>
                            <div class="d-flex mt-1 text-body-2 text-medium-emphasis gap-4">
                                <span><Phone class="w-3.5 h-3.5 mr-1 inline" /> {{ selectedAppointment.sdt }}</span>
                            </div>
                        </div>

                        <!-- Stylist & Consultant -->
                        <div class="d-flex gap-2">
                            <div class="flex-1">
                                <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5">NV hưởng HH Dịch vụ</label>
                                <v-select v-model="selectedStylistId" :items="stylists" item-title="name" item-value="id" variant="outlined" density="compact" hide-details color="primary" />
                            </div>
                            <div class="flex-1">
                                <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5">NV hưởng HH Sản phẩm</label>
                                <v-select v-model="selectedConsultantId" :items="stylists" item-title="name" item-value="id" variant="outlined" density="compact" hide-details color="secondary" clearable placeholder="Không có (NV Dịch vụ hưởng hết)" />
                            </div>
                        </div>
                        <div v-if="commissionNotice" class="mt-2 pa-2 rounded text-caption font-weight-medium border d-flex align-center" style="background-color: #eef2ff; color: #4338ca; border-color: #e0e7ff;">
                            <Info class="w-4 h-4 mr-1 flex-shrink-0" />
                            <span style="line-height: 1.2;">{{ commissionNotice }}</span>
                        </div>

                        <v-divider class="my-2" />

                        <!-- DỊCH VỤ SỬ DỤNG -->
                        <div>
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase mb-2 d-flex justify-space-between">
                                <span>Dịch vụ sử dụng ({{ selectedAppointment.dichVus?.length || 0 }})</span>
                            </label>

                            <v-menu :close-on-content-click="false" v-model="showServiceList" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-text-field v-bind="props" v-model="serviceSearch" placeholder="Thêm dịch vụ phát sinh..." variant="outlined" density="compact" hide-details class="mb-3">
                                        <template #prepend-inner><Search class="w-4 h-4 text-slate-400 mr-1" /></template>
                                    </v-text-field>
                                </template>
                                <v-list max-height="250" class="border rounded-lg mt-1">
                                    <v-list-item v-for="s in filteredServices" :key="s.id" @click="addService(s)" hover>
                                        <v-list-item-title class="font-weight-bold text-body-2">{{ s.name || s.Name }}</v-list-item-title>
                                        <template #append><span class="text-primary font-weight-bold">{{ (s.price || s.Price).toLocaleString() }}đ</span></template>
                                    </v-list-item>
                                    <v-list-item v-if="filteredServices.length === 0" class="text-caption text-center">Không tìm thấy</v-list-item>
                                </v-list>
                            </v-menu>

                            <div class="d-flex flex-column gap-2">
                                <div v-for="(s, index) in selectedAppointment.dichVus" :key="index" class="d-flex justify-space-between service-item-card pa-2 rounded-lg border">
                                    <div class="d-flex align-center gap-2">
                                        <v-btn icon variant="text" color="red" density="compact" @click="removeService(Number(index))"><Trash2 class="w-4 h-4" /></v-btn>
                                        <span class="font-weight-semibold text-body-2">{{ s.ten }}</span>
                                    </div>
                                    <span class="font-weight-bold text-body-2 mt-1">{{ s.gia.toLocaleString() }}đ</span>
                                </div>
                            </div>
                        </div>

                        <!-- SẢN PHẨM MUA KÈM -->
                        <div class="mt-2">
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase mb-2 d-flex justify-space-between">
                                <span>Sản phẩm mua kèm ({{ selectedAppointment.sanPhams?.length || 0 }})</span>
                            </label>

                            <v-menu :close-on-content-click="false" v-model="showProductList" location="bottom">
                                <template v-slot:activator="{ props }">
                                    <v-text-field v-bind="props" v-model="productSearch" placeholder="Tìm sản phẩm mua thêm..." variant="outlined" density="compact" hide-details class="mb-3">
                                        <template #prepend-inner><Search class="w-4 h-4 text-slate-400 mr-1" /></template>
                                    </v-text-field>
                                </template>
                                <v-list max-height="300" class="border rounded-lg mt-1" style="overflow-y: auto;">
                                    <template v-for="(bienthes, groupName) in productSuggestions" :key="groupName">
                                        <!-- Tiêu đề nhóm sản phẩm chính -->
                                        <div class="px-4 py-2 font-weight-black text-[11px] uppercase tracking-wider product-group-header">
                                            {{ groupName }}
                                        </div>
                                        <!-- Các biến thể của sản phẩm đó -->
                                        <v-list-item v-for="p in bienthes" :key="p.id" @click="addProduct(p)" hover class="pl-6">
                                            <v-list-item-title class="text-body-2 font-weight-bold product-variant-title">
                                                {{ p.name }}
                                                <span class="text-caption text-medium-emphasis ml-1" style="font-size: 10px;">(Kho: {{ p.soLuongTon }})</span>
                                            </v-list-item-title>
                                            <template #append>
                                                <span class="text-primary font-weight-bold">{{ p.price.toLocaleString() }}đ</span>
                                            </template>
                                        </v-list-item>
                                    </template>
                                    <v-list-item v-if="Object.keys(productSuggestions).length === 0" class="text-caption text-center">Không tìm thấy sản phẩm</v-list-item>
                                </v-list>
                            </v-menu>

                            <div class="d-flex flex-column gap-2">
                                <div v-for="(p, index) in selectedAppointment.sanPhams" :key="index" class="d-flex justify-space-between product-item-card pa-2 rounded-lg border">
                                    <div class="d-flex align-center gap-2">
                                        <v-btn icon variant="text" color="red" density="compact" @click="removeProduct(Number(index))"><Trash2 class="w-4 h-4" /></v-btn>
                                        <div class="d-flex flex-column">
                                            <span class="font-weight-semibold text-body-2">{{ p.ten }}</span>
                                            <span class="text-caption text-medium-emphasis">{{ Number(p.gia).toLocaleString() }}đ</span>
                                        </div>
                                    </div>
                                    <div class="d-flex align-center gap-2">
                                        <div class="d-flex align-center border rounded qty-counter-bg">
                                            <v-btn icon variant="text" size="24" @click="updateProductQty(Number(index), -1)"><Minus class="w-3 h-3" /></v-btn>
                                            <span class="px-2 text-body-2 font-weight-bold">{{ p.soLuong }}</span>
                                            <v-btn icon variant="text" size="24" @click="updateProductQty(Number(index), 1)"><Plus class="w-3 h-3" /></v-btn>
                                        </div>
                                        <span class="font-weight-bold text-body-2 product-subtotal w-20 text-right">{{ (p.gia * p.soLuong).toLocaleString() }}đ</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- CẢNH BÁO CẬP NHẬT -->
                        <div v-if="isOrderModified" class="modify-warning-card text-error pa-3 rounded-lg border d-flex align-center justify-space-between mt-2">
                            <span class="text-caption font-weight-bold">⚠️ Giỏ hàng thay đổi! Vui lòng cập nhật.</span>
                            <v-btn color="error" size="small" variant="flat" class="font-weight-bold rounded-lg" @click="updateOrder" :loading="isLoading">
                                Cập nhật đơn
                            </v-btn>
                        </div>

                        <v-spacer class="mt-4" />

                        <!-- ================= TỔNG KẾT TÍNH TOÁN ================= -->
                        <div class="border-t pt-4">
                            <!-- Hiển thị phân rã giá -->
                            <div class="d-flex align-center justify-space-between text-body-2 mb-1">
                                <span class="text-medium-emphasis font-weight-bold">Tiền dịch vụ:</span>
                                <span class="font-weight-bold summary-price-text">{{ serviceTotal.toLocaleString() }}đ</span>
                            </div>
                            <div class="d-flex align-center justify-space-between text-body-2 mb-1">
                                <span class="text-medium-emphasis font-weight-bold">Tiền sản phẩm:</span>
                                <span class="font-weight-bold summary-price-text">{{ productTotal.toLocaleString() }}đ</span>
                            </div>
                            <div v-if="memberDiscountAmount > 0" class="d-flex align-center justify-space-between text-body-2 text-error mb-1">
                                <span class="font-weight-bold">Hạng thành viên ({{ selectedAppointment.phanTramGiamVip }}%):</span>
                                <span class="font-weight-bold summary-price-text">-{{ memberDiscountAmount.toLocaleString() }}đ</span>
                            </div>
                            <div v-if="selectedAppointment.voucher && voucherDiscountAmount > 0" class="d-flex align-center justify-space-between text-body-2 text-error mb-1">
                                <span class="font-weight-bold">Voucher ({{ selectedAppointment.voucher }}):</span>
                                <span class="font-weight-bold summary-price-text">-{{ voucherDiscountAmount.toLocaleString() }}đ</span>
                            </div>
                            <div v-if="selectedAppointment.daThanhToan > 0" class="d-flex align-center justify-space-between text-body-2 text-success mb-3">
                                <span class="font-weight-bold">Đã thanh toán (Cọc):</span>
                                <span class="font-weight-bold">-{{ selectedAppointment.daThanhToan.toLocaleString() }}đ</span>
                            </div>

                            <!-- BOX TỔNG KẾT MÀU MÈ -->
                            <div class="d-flex align-center justify-space-between pa-4 rounded-xl border mb-4"
                                 :class="amountToPay > 0 ? 'bill-due-card' : 'bill-paid-card'">
                                <div>
                                    <p class="text-[10px] font-weight-black uppercase tracking-widest mb-0.5"
                                       :class="amountToPay > 0 ? 'text-error' : 'text-success'">
                                        {{ amountToPay > 0 ? 'SỐ TIỀN CÒN PHẢI THU' : 'ĐÃ THANH TOÁN ĐỦ' }}
                                    </p>
                                    <div class="text-h4 font-weight-black" :class="amountToPay > 0 ? 'text-error' : 'text-success'">
                                        {{ amountToPay.toLocaleString() }}đ
                                    </div>
                                </div>
                            </div>

                            <!-- CHỌN PHƯƠNG THỨC THANH TOÁN (LUÔN HIỂN THỊ CHUẨN) -->
                            <div class="mt-2" v-if="amountToPay >= 0">
                                <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-2 tracking-wider">
                                    CHỌN PHƯƠNG THỨC THANH TOÁN
                                </label>
                                <div class="payment-method-row">
                                    <div class="method-option tienmat" :class="{ active: selectedPaymentMethod === 'tienmat' }" @click="selectedPaymentMethod = 'tienmat'">
                                        <div class="d-flex align-center justify-center">
                                            <svg class="w-5 h-5 text-green-600 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="width: 20px; height: 20px;">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                            </svg>
                                            <span class="text-caption font-weight-bold text-green-700 uppercase tracking-wider">Tiền mặt</span>
                                        </div>
                                    </div>
                                    <div class="method-option vnpay" :class="{ active: selectedPaymentMethod === 'vnpay' }" @click="selectedPaymentMethod = 'vnpay'">
                                        <img src="/vnpay-logo.png" alt="VNPay" class="method-logo-img">
                                    </div>
                                    <div class="method-option momo" :class="{ active: selectedPaymentMethod === 'momo' }" @click="selectedPaymentMethod = 'momo'">
                                        <img src="/momo-logo.png" alt="MoMo" class="method-logo-img">
                                    </div>
                                </div>
                            </div>
                        </div>

                    </v-card-text>

                    <!-- Footer actions -->
                    <v-card-actions class="pa-5 border-t">
                        <v-btn
                            color="success"
                            variant="flat"
                            block
                            height="54px"
                            class="text-none font-weight-bold text-subtitle-1 rounded-xl"
                            @click="confirmPayment"
                            :disabled="isOrderModified"
                        >
                            <CreditCard class="w-5 h-5 mr-1.5" />
                            XÁC NHẬN THU TIỀN & HOÀN THÀNH
                        </v-btn>
                    </v-card-actions>
                </v-card>

                <!-- Placeholder -->
                <v-card v-else variant="outlined" color="grey-lighten-2" class="border-dashed d-flex flex-column align-center justify-center text-center pa-10 rounded-xl h-100">
                    <ShoppingCart class="w-10 h-10 text-slate-300 mb-3" />
                    <h3 class="text-subtitle-2 font-weight-bold text-medium-emphasis uppercase">Chọn lượt phục vụ để Checkout</h3>
                </v-card>
            </v-col>
        </v-row>
        
        <QrScannerModal v-if="showScanner" @close="showScanner = false" @scan-success="handleScanData" />
    </v-container>
</template>

<style scoped>
.font-sans { font-family: inherit; }
.text-error { color: #e11d48 !important; }
.text-success { color: #16a34a !important; }

/* Custom Theme-Aware styles for Checkout */
.page-title {
    color: #1a1a2e;
}
.v-theme--dark .page-title {
    color: #f8fafc;
}

.customer-name-text {
    color: #1a1a2e;
}
.v-theme--dark .customer-name-text {
    color: #f8fafc;
}

.client-name-title {
    color: #1a1a2e;
}
.v-theme--dark .client-name-title {
    color: #f8fafc;
}

.selected-row {
    background-color: #f1f5f9 !important;
}
.v-theme--dark .selected-row {
    background-color: #334155 !important;
}
.v-theme--dark .selected-row .customer-name-text {
    color: #f8fafc !important;
}

.client-info-card {
    background-color: #f8fafc;
    border-color: #e2e8f0 !important;
}
.v-theme--dark .client-info-card {
    background-color: #151521;
    border-color: #2d2d3d !important;
}

.service-item-card {
    background-color: #f8fafc;
    border-color: #e2e8f0 !important;
}
.v-theme--dark .service-item-card {
    background-color: #1e1e2d;
    border-color: #2d2d3d !important;
}

.product-item-card {
    background-color: rgba(254, 243, 199, 0.5);
    border-color: #fde68a !important;
}
.v-theme--dark .product-item-card {
    background-color: rgba(69, 53, 27, 0.3);
    border-color: #45351b !important;
}

.qty-counter-bg {
    background-color: #ffffff;
}
.v-theme--dark .qty-counter-bg {
    background-color: #151521;
}

.product-subtotal {
    color: #78350f;
}
.v-theme--dark .product-subtotal {
    color: #fbbf24;
}

.modify-warning-card {
    background-color: #fef2f2;
    border-color: #fecaca !important;
}
.v-theme--dark .modify-warning-card {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: #7f1d1d !important;
}

.summary-price-text {
    color: #0f172a;
}
.v-theme--dark .summary-price-text {
    color: #f1f5f9;
}

.bill-due-card {
    background-color: #fff1f2;
    border-color: #ffe4e6 !important;
}
.v-theme--dark .bill-due-card {
    background-color: #3f1b21;
    border-color: #6b212f !important;
}

.bill-paid-card {
    background-color: #f0fdf4;
    border-color: #dcfce7 !important;
}
.v-theme--dark .bill-paid-card {
    background-color: #142c1b;
    border-color: #1b5c30 !important;
}

.primary-btn {
    background-color: #1a1a2e !important;
    color: #ffffff !important;
}
.v-theme--dark .primary-btn {
    background-color: #3b82f6 !important;
    color: #ffffff !important;
}

/* Payment Methods styling matching ThanhToanTong */
.payment-method-row {
    display: flex;
    gap: 12px;
}
 
.method-option {
    flex: 1;
    border: 2px solid #e2e8f0;
    padding: 8px 12px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 60px;
    text-align: center;
}
 
.method-option:hover {
    transform: translateY(-2px);
}

.v-theme--dark .method-option {
    border-color: #2d2d3d;
    background: #151521;
}
.v-theme--dark .method-option:hover {
    border-color: #4b5563;
}
 
/* Tiền mặt Branding */
.method-option.tienmat:hover {
    border-color: rgba(22, 163, 74, 0.4);
}
.method-option.tienmat.active {
    border-color: #16a34a;
    background-color: #f0fdf4;
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.1);
    border-width: 2.5px;
    transform: translateY(-2px) scale(1.02);
}
.v-theme--dark .method-option.tienmat:hover {
    border-color: rgba(22, 163, 74, 0.6);
}
.v-theme--dark .method-option.tienmat.active {
    border-color: #22c55e;
    background-color: rgba(22, 163, 74, 0.15);
    box-shadow: 0 4px 12px rgba(22, 163, 74, 0.2);
}
.v-theme--dark .method-option.tienmat .text-green-700 {
    color: #4ade80 !important;
}
.v-theme--dark .method-option.tienmat svg {
    color: #4ade80 !important;
}
 
/* VNPay Branding */
.method-option.vnpay:hover {
    border-color: rgba(0, 106, 194, 0.4);
}
.method-option.vnpay.active {
    border-color: #006ac2;
    background-color: #f4f9ff;
    box-shadow: 0 4px 12px rgba(0, 106, 194, 0.1);
    border-width: 2.5px;
    transform: translateY(-2px) scale(1.02);
}
.v-theme--dark .method-option.vnpay:hover {
    border-color: rgba(59, 130, 246, 0.6);
}
.v-theme--dark .method-option.vnpay.active {
    border-color: #3b82f6;
    background-color: rgba(59, 130, 246, 0.15);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}
 
/* MoMo Branding */
.method-option.momo:hover {
    border-color: rgba(216, 45, 139, 0.4);
}
.method-option.momo.active {
    border-color: #d82d8b;
    background-color: #fff5fa;
    box-shadow: 0 4px 12px rgba(216, 45, 139, 0.1);
    border-width: 2.5px;
    transform: translateY(-2px) scale(1.02);
}

.method-logo-img {
    max-height: 24px;
    object-fit: contain;
}

/* Product Selection Suggestion Dropdown Theme Adaptability */
.product-group-header {
    background-color: #f1f5f9;
    color: #475569;
}
.v-theme--dark .product-group-header {
    background-color: #27272a;
    color: #a1a1aa;
}

.product-variant-title {
    color: #1e293b;
}
.v-theme--dark .product-variant-title {
    color: #f1f5f9;
}
</style>  