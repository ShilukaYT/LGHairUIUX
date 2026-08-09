<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
    Search, UserCheck, X, Clock, Users,
    Plus, Trash2, ChevronLeft, ChevronRight,
    Calendar as CalendarIcon, CheckCircle2, Phone,
    Camera, Mail, Package
} from 'lucide-vue-next'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'

import QrScannerModal from './QrScannerModal.vue'
import WalkInModal from './WalkInModal.vue'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = API + '/api/CheckIn'

// --- State ---
const appointments = ref<any[]>([])
const stylists = ref<any[]>([])
const allServices = ref<any[]>([])
const isLoading = ref(false)
const selectedAppointment = ref<any>(null)
const selectedStylistId = ref<string | null>(null)

const serviceSearch = ref('')
const showServiceList = ref(false)

const searchQuery = ref('')
const filterDate = ref(new Date().toISOString().split('T')[0])
const currentPage = ref(1)
const itemsPerPage = 8
const allServicesFromApi = ref<any[]>([]);
const showScanner = ref(false)
const showWalkIn = ref(false)

const formatTime = (timeStr: string) => {
    if (!timeStr) return '00:00';
    return timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
};

const productTotal = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.sanPhams) return 0;
    return selectedAppointment.value.sanPhams.reduce((sum: number, p: any) => sum + (p.soLuong * p.gia), 0);
});

const remainingBalance = computed(() => {
    if (!selectedAppointment.value) return 0;
    const total = selectedAppointment.value.tongTien;
    const discount = selectedAppointment.value.tienGiam || 0;
    const paid = selectedAppointment.value.daThanhToan || 0;
    return Math.max(0, total - discount - paid);
});

const memberDiscountAmount = computed(() => {
    if (!selectedAppointment.value || !selectedAppointment.value.phanTramGiamVip) return 0;
    return Math.round((selectedAppointment.value.tongTien || 0) * (selectedAppointment.value.phanTramGiamVip / 100));
});

const voucherDiscountAmount = computed(() => {
    if (!selectedAppointment.value) return 0;
    const totalDiscount = Number(selectedAppointment.value.tienGiam || 0);
    return Math.max(0, totalDiscount - memberDiscountAmount.value);
});

const filteredData = computed(() => {
    return appointments.value.filter(a => {
        const q = searchQuery.value.toLowerCase().trim();
        return a.tenKhach.toLowerCase().includes(q) || a.sdt.includes(q);
    });
});

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredData.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1);

// --- Logic xử lý dịch vụ ---
const fetchServiceData = async () => {
    if (allServicesFromApi.value.length > 0) return;

    try {
        isLoading.value = true;
        const res = await axios.get(`${API_BASE_URL}/all-services-combos`);
        allServicesFromApi.value = res.data;
    } catch (error) {
        toast.error("Lỗi khi tải danh sách dịch vụ!");
    } finally {
        isLoading.value = false;
    }
};

const filteredServices = computed(() => {
    const query = serviceSearch.value.toLowerCase().trim();
    let list = allServicesFromApi.value; 

    if (query) {
    list = list.filter(s => (s.Name || s.name || '').toLowerCase().includes(query));
}

    if (selectedAppointment.value) {
        const existingIds = new Set(
            selectedAppointment.value.dichVus.map((d: any) => d.id ?? d.Id)
        );
        list = list.filter(item => !existingIds.has(item.id ?? item.Id));
    }

    return list.slice(0, 10);
});

const originalServices = ref<any[]>([])

const isServicesModified = () => {
    if (!selectedAppointment.value) return false;
    const current = selectedAppointment.value.dichVus;
    const original = originalServices.value;
    if (current.length !== original.length) return true;

    const currentIds = current.map((s: any) => String(s.id || s.Id)).sort();
    const originalIds = original.map((s: any) => String(s.id || s.Id)).sort();

    for (let i = 0; i < currentIds.length; i++) {
        if (currentIds[i] !== originalIds[i]) return true;
    }
    return false;
};

const fetchData = async () => {
    isLoading.value = true;
    try {
        const [resAppt, resData, resStylists] = await Promise.all([
            axios.get(`${API_BASE_URL}/get-appointments`, { params: { date: filterDate.value } }),
            axios.get(API + '/api/DatDichVu/data-booking'),
            axios.get(API + '/api/NhanVien', { params: { trangThai: 1 } })
        ]);
        appointments.value = resAppt.data;
        allServices.value = [...resData.data.services, ...resData.data.combos];
        stylists.value = resStylists.data.map((nv: any) => ({
            id: nv.maNv,
            name: nv.hoTenNv,
            role: nv.tenLoaiNv,
            img: nv.hinhAnh || "https://i.pravatar.cc/150"
        }));
    } catch (error) {
        toast.error("Lỗi kết nối hệ thống!");
    } finally {
        isLoading.value = false;
    }
};

const setSelectedAppointment = async (item: any) => {
    selectedAppointment.value = { ...item };

    if (item.maNv) {
        selectedStylistId.value = String(item.maNv);
    } else {
        selectedStylistId.value = null;
    }

    originalServices.value = JSON.parse(JSON.stringify(item.dichVus ?? []));
    await fetchServiceData();
};

const handleScanData = async (qrData: string) => {
    showScanner.value = false;
    try {
        isLoading.value = true;
        const res = await axios.get(`${API_BASE_URL}/get-by-qrcode/${qrData}`);

        if (res.data) {
            await setSelectedAppointment(res.data);
            toast.success("Đã tìm thấy lịch hẹn từ QR Code!");
        }
    } catch (error) {
        toast.error("Không tìm thấy mã QR này trong hệ thống!");
    } finally {
        isLoading.value = false;
    }
};

const addServiceToAppt = (service: any) => {
    if (!selectedAppointment.value) return;

    const serviceId = service.id ?? service.Id;
    const isExisted = selectedAppointment.value.dichVus.some(
        (d: any) => (d.id ?? d.Id) === serviceId
    );

    if (isExisted) {
        toast.warning("Dịch vụ này đã có trong danh sách!");
        serviceSearch.value = '';
        showServiceList.value = false;
        return;
    }

    selectedAppointment.value.dichVus.push({
        id: serviceId,
        ten: service.name ?? service.Name,
        gia: service.price ?? service.Price,
        originalPrice: service.originalPrice ?? service.OriginalPrice ?? service.price ?? service.Price
    });

    selectedAppointment.value.tongTien += (service.price ?? service.Price);

    serviceSearch.value = '';
    showServiceList.value = false;
    toast.success(`Đã thêm: ${service.name ?? service.Name}`);
};

const removeService = (index: number) => {
    if (!selectedAppointment.value) return;
    const removedItem = selectedAppointment.value.dichVus[index];
    selectedAppointment.value.tongTien -= removedItem.gia;
    selectedAppointment.value.dichVus.splice(index, 1);
};

const confirmCheckIn = async () => {
    if (!selectedAppointment.value || !selectedStylistId.value) {
        toast.error("Vui lòng chọn Stylist!");
        return;
    }

    const modified = isServicesModified();

    const confirmResult = await Swal.fire({
        title: modified ? 'Chốt dịch vụ mới & Phục vụ?' : 'Xác nhận bắt đầu phục vụ?',
        text: 'Lịch hẹn sẽ được chuyển sang trạng thái Đang phục vụ.',
        icon: 'info',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#1a1a2e'
    });

    if (!confirmResult.isConfirmed) return;

    try {
        isLoading.value = true;

        if (modified) {
            const payload = {
                maLd: String(selectedAppointment.value.maLd),
                maStylist: String(selectedStylistId.value),
                paymentMethod: "", 
                updatedServices: selectedAppointment.value.dichVus.map((s: any) => ({
                    id: String(s.id || s.Id),
                    gia: Number(s.gia || s.Gia)
                }))
            };
            console.log("Check-in payload:", payload);
            const response = await axios.post(`${API_BASE_URL}/create-payment-checkin`, payload);
            await Swal.fire('Thành công', response.data.message || 'Đã cập nhật dịch vụ và bắt đầu phục vụ!', 'success');
        } else {
            const payload = {
                maLd: String(selectedAppointment.value.maLd),
                maStylist: String(selectedStylistId.value)
            };

            const response = await axios.post(`${API_BASE_URL}/confirm-checkin`, payload);
            await Swal.fire('Thành công', response.data.message || 'Check-in thành công!', 'success');
        }

        selectedAppointment.value = null;
        await fetchData();
    } catch (error: any) {
        toast.error(error.response?.data || "Không thể hoàn tất check-in!");
    } finally {
        isLoading.value = false;
    }
};

onMounted(async () => {
    await fetchData();
});
watch(filterDate, fetchData);
</script>

<template>
    <v-container fluid class="pa-6 font-sans">
        
        <!-- Header -->
        <div class="d-flex align-center justify-space-between mb-6 flex-wrap gap-4">
            <div>
                <h1 class="text-h5 font-weight-bold text-high-emphasis">Check-in tiếp nhận</h1>
                <p class="text-body-2 text-medium-emphasis mt-1">Tiếp nhận khách hàng đặt lịch & phục vụ dịch vụ</p>
            </div>
            
            <div style="width: 200px;">
                <v-text-field
                    v-model="filterDate"
                    type="date"
                    label="Ngày hẹn"
                    variant="outlined"
                    density="comfortable"
                    hide-details
                    color="primary"
                >
                    <template #prepend-inner>
                        <CalendarIcon class="w-4 h-4 text-slate-400 mr-1" />
                    </template>
                </v-text-field>
            </div>
        </div>

        <v-row>
            <!-- CỘT TRÁI: Danh sách lịch hẹn -->
            <v-col cols="12" lg="7">
                <v-card elevation="0" border class="rounded-xl">
                    <v-card-text class="pa-5">
                        
                        <!-- Search & Toolbar -->
                        <v-row class="mb-5" align="center" dense>
                            <v-col cols="12" md="6">
                                <v-text-field
                                    v-model="searchQuery"
                                    label="Tìm tên khách hoặc số điện thoại..."
                                    variant="outlined"
                                    density="comfortable"
                                    hide-details
                                    color="primary"
                                    clearable
                                >
                                    <template #prepend-inner>
                                        <Search class="w-4 h-4 text-slate-400 mr-1" />
                                    </template>
                                </v-text-field>
                            </v-col>
                            
                            <v-col cols="12" md="6" class="d-flex justify-end gap-2 flex-wrap">
                                <v-btn
                                    color="success"
                                    variant="flat"
                                    height="44px"
                                    class="text-none font-weight-bold rounded-lg"
                                    @click="showWalkIn = true"
                                >
                                    <Plus class="w-4 h-4 mr-1.5" />
                                    Khách vãng lai
                                </v-btn>
                                <v-btn
                                    color="primary"
                                    variant="flat"
                                    height="44px"
                                    class="text-none font-weight-bold rounded-lg primary-btn"
                                    @click="showScanner = true"
                                >
                                    <Camera class="w-4 h-4 mr-1.5" />
                                    Quét QR
                                </v-btn>
                            </v-col>
                        </v-row>

                        <!-- Loading Indicator -->
                        <div v-if="isLoading" class="d-flex justify-center py-10">
                            <v-progress-circular indeterminate color="primary" />
                        </div>

                        <!-- Danh sách lịch hẹn -->
                        <v-table v-else hover class="border rounded-lg overflow-hidden">
                            <thead>
                                <tr>
                                    <th class="text-left font-weight-bold text-subtitle-2 text-medium-emphasis">Khách hàng</th>
                                    <th class="text-center font-weight-bold text-subtitle-2 text-medium-emphasis">Giờ hẹn</th>
                                    <th class="text-right font-weight-bold text-subtitle-2 text-medium-emphasis">Tổng tiền dự kiến</th>
                                    <th class="text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr
                                    v-for="item in paginatedData"
                                    :key="item.maLd"
                                    @click="setSelectedAppointment(item)"
                                    class="cursor-pointer"
                                    :class="{ 'selected-row': selectedAppointment?.maLd === item.maLd }"
                                >
                                    <td class="py-3">
                                        <div class="font-weight-bold text-body-2 d-flex align-center gap-1.5 text-high-emphasis">
                                            <span>{{ item.tenKhach }}</span>
                                            <v-chip
                                                v-if="item.sanPhams && item.sanPhams.length > 0"
                                                size="x-small"
                                                color="warning"
                                                variant="flat"
                                                class="font-weight-bold px-1.5"
                                            >
                                                Sản phẩm
                                            </v-chip>
                                        </div>
                                        <div class="text-caption text-medium-emphasis mt-0.5">
                                            {{ item.sdt }}
                                        </div>
                                    </td>
                                    <td class="text-center py-3">
                                        <v-chip size="small" color="primary" variant="tonal" class="font-weight-semibold">
                                            <Clock class="w-3.5 h-3.5 mr-1" />
                                            {{ formatTime(item.ngayHen) }}
                                        </v-chip>
                                    </td>
                                    <td class="text-right font-weight-bold text-body-2 py-3 text-high-emphasis">
                                        {{ item.tongTien.toLocaleString() }}đ
                                    </td>
                                    <td class="text-center py-3">
                                        <CheckCircle2
                                            class="w-5 h-5 mx-auto"
                                            :class="selectedAppointment?.maLd === item.maLd ? 'text-primary' : 'text-slate-200'"
                                        />
                                    </td>
                                </tr>
                                <tr v-if="paginatedData.length === 0">
                                    <td colspan="4" class="text-center py-10 text-medium-emphasis">
                                        <Users class="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <div class="text-body-2 font-weight-bold">Không có lịch hẹn chờ</div>
                                    </td>
                                </tr>
                            </tbody>
                        </v-table>

                        <!-- Phân trang -->
                        <div class="d-flex align-center justify-space-between mt-5">
                            <span class="text-caption text-medium-emphasis">
                                Trang {{ currentPage }} / {{ totalPages }}
                            </span>
                            <div class="d-flex align-center gap-1">
                                <v-btn
                                    icon
                                    variant="plain"
                                    density="comfortable"
                                    :disabled="currentPage === 1"
                                    @click="currentPage--"
                                >
                                    <ChevronLeft class="w-5 h-5" />
                                </v-btn>
                                <v-btn
                                    icon
                                    variant="plain"
                                    density="comfortable"
                                    :disabled="currentPage === totalPages"
                                    @click="currentPage++"
                                >
                                    <ChevronRight class="w-5 h-5" />
                                </v-btn>
                            </div>
                        </div>

                    </v-card-text>
                </v-card>
            </v-col>

            <!-- CỘT PHẢI: Panel chi tiết -->
            <v-col cols="12" lg="5">
                <v-card v-if="selectedAppointment" elevation="0" border class="rounded-xl d-flex flex-column" style="min-height: 500px;">
                    <v-card-item class="border-b px-5 py-4">
                        <template #prepend>
                            <v-chip size="x-small" color="primary" variant="flat" class="font-weight-bold mr-2 primary-btn">
                                #{{ selectedAppointment.maLd }}
                            </v-chip>
                        </template>
                        <v-card-title class="text-body-1 font-weight-bold text-high-emphasis">
                            Chi tiết tiếp nhận
                        </v-card-title>
                        <template #append>
                            <v-btn
                                icon
                                variant="text"
                                density="comfortable"
                                color="grey"
                                @click="selectedAppointment = null"
                            >
                                <X class="w-4 h-4" />
                            </v-btn>
                        </template>
                    </v-card-item>

                    <v-card-text class="pa-5 d-flex flex-column gap-y-4">
                        
                        <!-- Thông tin khách -->
                        <div class="client-info-card pa-4 rounded-lg">
                            <div class="text-[10px] text-medium-emphasis uppercase font-weight-bold tracking-wider">Khách hàng</div>
                            <div class="text-h6 font-weight-black mt-1 text-high-emphasis">
                                {{ selectedAppointment.tenKhach }}
                            </div>
                            <div class="d-flex flex-column mt-2 text-body-2 text-medium-emphasis gap-y-1.5">
                                <span class="d-flex align-center">
                                    <Phone class="w-4 h-4 mr-2.5 text-primary" />
                                    {{ selectedAppointment.sdt }}
                                </span>
                                <span v-if="selectedAppointment.email" class="d-flex align-center">
                                    <Mail class="w-4 h-4 mr-2.5 text-primary" />
                                    {{ selectedAppointment.email }}
                                </span>
                            </div>
                        </div>

                        <!-- Phân Stylist phục vụ -->
                        <div>
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">
                                Phân Stylist phục vụ *
                            </label>
                            <v-select
                                v-model="selectedStylistId"
                                :items="stylists"
                                item-title="name"
                                item-value="id"
                                placeholder="Chọn Stylist phục vụ..."
                                variant="outlined"
                                density="compact"
                                hide-details
                                color="primary"
                            />
                        </div>

                        <!-- Thêm dịch vụ -->
                        <div>
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">
                                Cập nhật dịch vụ
                            </label>
                            <div class="position-relative">
                                <v-text-field
                                    v-model="serviceSearch"
                                    @focus="showServiceList = true"
                                    placeholder="Tìm nhanh dịch vụ thêm..."
                                    variant="outlined"
                                    density="comfortable"
                                    hide-details
                                    color="primary"
                                >
                                    <template #prepend-inner>
                                        <Search class="w-4 h-4 text-slate-400 mr-1" />
                                    </template>
                                </v-text-field>

                                <!-- Dropdown tìm kiếm dịch vụ -->
                                <v-card
                                    v-if="showServiceList"
                                    elevation="4"
                                    border
                                    class="position-absolute w-100 mt-2 overflow-y-auto rounded-lg"
                                    style="max-height: 220px; z-index: 99;"
                                >
                                    <v-list class="pa-1">
                                        <v-list-item
                                            v-for="s in filteredServices"
                                            :key="s.id || s.Id"
                                            @click="addServiceToAppt(s)"
                                            class="rounded-lg mb-1"
                                            hover
                                        >
                                            <v-list-item-title class="font-weight-semibold text-body-2">
                                                {{ s.name || s.Name }}
                                            </v-list-item-title>
                                            <template #append>
                                                <div class="d-flex align-center gap-2">
                                                    <span
                                                        v-if="(s.originalPrice || s.OriginalPrice) > (s.price || s.Price)"
                                                        class="text-caption text-decoration-line-through text-medium-emphasis"
                                                    >
                                                        {{ (s.originalPrice || s.OriginalPrice).toLocaleString() }}đ
                                                    </span>
                                                    <span class="font-weight-bold text-body-2 text-primary">
                                                        {{ (s.price || s.Price).toLocaleString() }}đ
                                                    </span>
                                                </div>
                                            </template>
                                        </v-list-item>
                                        
                                        <v-list-item v-if="filteredServices.length === 0" class="text-center py-4">
                                            <span class="text-caption text-medium-emphasis">Không tìm thấy dịch vụ nào</span>
                                        </v-list-item>
                                        
                                        <v-divider class="my-1" />
                                        
                                        <v-list-item
                                            class="text-center py-2 text-caption font-weight-bold text-primary"
                                            hover
                                            @click="showServiceList = false; serviceSearch = ''"
                                        >
                                            ĐÓNG
                                        </v-list-item>
                                    </v-list>
                                </v-card>
                            </div>
                        </div>

                        <!-- Danh sách dịch vụ đang chọn -->
                        <div>
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-2 tracking-wider">
                                Danh sách dịch vụ yêu cầu ({{ selectedAppointment.dichVus.length }})
                            </label>
                            
                            <div class="d-flex flex-column gap-2" style="max-height: 220px; overflow-y: auto;">
                                <div
                                    v-for="(s, index) in selectedAppointment.dichVus"
                                    :key="index"
                                    class="d-flex align-center justify-space-between service-item-card pa-2 rounded-lg"
                                >
                                    <div class="d-flex align-center gap-1.5 min-w-0">
                                        <v-btn
                                            icon
                                            variant="text"
                                            color="red"
                                            density="compact"
                                            @click="removeService(Number(index))"
                                        >
                                            <Trash2 class="w-4 h-4" />
                                        </v-btn>
                                        <span class="font-weight-semibold text-body-2 text-truncate text-high-emphasis">{{ s.ten }}</span>
                                    </div>
                                    <span class="font-weight-bold text-body-2 price-text shrink-0 pr-2">
                                        {{ s.gia.toLocaleString() }}đ
                                    </span>
                                </div>
                                
                                <div
                                    v-if="selectedAppointment.dichVus.length === 0"
                                    class="text-center py-8 text-medium-emphasis text-caption font-weight-bold uppercase"
                                >
                                    Chưa chọn dịch vụ nào
                                </div>
                            </div>
                        </div>

                        <!-- Danh sách sản phẩm mua kèm (nhận tại tiệm) -->
                        <div v-if="selectedAppointment.sanPhams && selectedAppointment.sanPhams.length > 0" class="mt-2">
                            <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-2 tracking-wider">
                                Sản phẩm lấy tại tiệm ({{ selectedAppointment.sanPhams.length }})
                            </label>
                            
                            <div class="d-flex flex-column gap-2" style="max-height: 200px; overflow-y: auto;">
                                <div
                                    v-for="(p, index) in selectedAppointment.sanPhams"
                                    :key="index"
                                    class="d-flex align-center justify-space-between product-item-card pa-2 rounded-lg"
                                >
                                    <div class="d-flex align-center gap-2 min-w-0">
                                        <Package class="w-4 h-4 text-warning shrink-0" />
                                        <div class="d-flex flex-column min-w-0">
                                            <span class="font-weight-semibold text-body-2 text-truncate text-high-emphasis">{{ p.ten }}</span>
                                            <span class="text-caption text-medium-emphasis">SL: {{ p.soLuong }} x {{ p.gia.toLocaleString() }}đ</span>
                                        </div>
                                    </div>
                                    <span class="font-weight-bold text-body-2 product-price shrink-0 pr-2">
                                        {{ (p.soLuong * p.gia).toLocaleString() }}đ
                                    </span>
                                </div>
                            </div>
                        </div>

                        <v-spacer />

                        <!-- Tổng kết tính toán -->
                        <div class="border-t pt-4 mt-auto">
                            <!-- Hiển thị Voucher đã áp dụng (nếu có) -->
                            <div v-if="memberDiscountAmount > 0" class="d-flex align-center justify-space-between mb-3 px-2">
                                <span class="text-caption font-weight-bold text-error uppercase tracking-wider">Hạng thành viên ({{ selectedAppointment.phanTramGiamVip }}%)</span>
                                <span class="text-body-2 font-weight-bold text-error">-{{ memberDiscountAmount.toLocaleString() }}đ</span>
                            </div>
                            <div v-if="selectedAppointment.voucher && voucherDiscountAmount > 0" class="d-flex align-center justify-space-between mb-3 px-2">
                                <span class="text-caption font-weight-bold text-error uppercase tracking-wider">Voucher đã dùng ({{ selectedAppointment.voucher }})</span>
                                <span class="text-body-2 font-weight-bold text-error">-{{ voucherDiscountAmount.toLocaleString() }}đ</span>
                            </div>

                            <!-- Hiển thị Tiền sản phẩm (nếu có) -->
                            <div v-if="productTotal > 0" class="d-flex align-center justify-space-between mb-3 px-2">
                                <span class="text-caption font-weight-bold text-slate-500 uppercase tracking-wider">Tiền sản phẩm</span>
                                <span class="text-body-2 font-weight-bold price-text">{{ productTotal.toLocaleString() }}đ</span>
                            </div>

                            <div class="d-flex align-center justify-space-between total-bill-card pa-4 rounded-xl mb-3">
                                <div>
                                    <p class="text-[9px] font-weight-bold text-medium-emphasis uppercase tracking-wider mb-0.5">
                                        {{ productTotal > 0 ? 'TỔNG CHI PHÍ TẠM TÍNH' : 'TỔNG DỊCH VỤ DỰ KIẾN' }}
                                    </p>
                                    <div class="text-h6 font-weight-black text-high-emphasis">
                                        {{ (selectedAppointment.tongTien).toLocaleString() }}đ
                                    </div>
                                </div>
                                <div class="text-right">
                                    <p class="text-[9px] font-weight-bold text-medium-emphasis uppercase tracking-wider mb-0.5">
                                        ĐÃ THANH TOÁN (CỌC)
                                    </p>
                                    <div class="text-subtitle-1 font-weight-black text-success">
                                        {{ selectedAppointment.daThanhToan.toLocaleString() }}đ
                                    </div>
                                </div>
                            </div>

                            <!-- Tính tiền còn thiếu -->
                            <div class="d-flex align-center justify-space-between pa-4 rounded-xl"
                                 :style="remainingBalance > 0 ? 'background-color: #fff1f2; border: 1px solid #ffe4e6;' : 'background-color: #f0fdf4; border: 1px solid #dcfce7;'">
                                <div>
                                    <p class="text-[9px] font-weight-bold uppercase tracking-wider mb-0.5"
                                       :style="remainingBalance > 0 ? 'color: #e11d48;' : 'color: #16a34a;'">
                                        {{ remainingBalance > 0 ? 'SỐ TIỀN CÒN THIẾU' : 'ĐÃ THANH TOÁN ĐỦ' }}
                                    </p>
                                    <div class="text-h5 font-weight-black"
                                         :style="remainingBalance > 0 ? 'color: #e11d48;' : 'color: #16a34a;'">
                                        {{ remainingBalance.toLocaleString() }}đ
                                    </div>
                                </div>
                            </div>
                        </div>

                    </v-card-text>

                    <!-- Footer actions -->
                    <v-card-actions class="pa-5 border-t mt-3">
                        <v-btn
                            color="primary"
                            variant="flat"
                            block
                            height="50px"
                            class="text-none font-weight-bold text-subtitle-1 rounded-xl primary-btn"
                            @click="confirmCheckIn"
                        >
                            XÁC NHẬN & VÀO LÀM DỊCH VỤ
                        </v-btn>
                    </v-card-actions>
                </v-card>

                <!-- Placeholder -->
                <v-card
                    v-else
                    variant="outlined"
                    color="grey-lighten-2"
                    class="border-dashed d-flex flex-column align-center justify-center text-center pa-10 rounded-xl"
                    style="height: 100%; min-height: 500px;"
                >
                    <Users class="w-10 h-10 text-slate-300 mb-3" />
                    <h3 class="text-subtitle-2 font-weight-bold text-medium-emphasis uppercase">
                        Chọn lịch hẹn để check-in
                    </h3>
                </v-card>
            </v-col>
        </v-row>

        <!-- Modals -->
        <WalkInModal
            :isOpen="showWalkIn"
            :stylists="stylists"
            @close="showWalkIn = false"
            @success="showWalkIn = false; fetchData();"
        />
        <QrScannerModal
            v-if="showScanner"
            @close="showScanner = false"
            @scan-success="handleScanData"
        />
    </v-container>
</template>

<style scoped>
.font-sans {
    font-family: inherit;
}
.z-index-dropdown {
    z-index: 99 !important;
}

/* Selected row color matching theme */
.selected-row {
    background-color: #f1f5f9 !important;
}
.v-theme--dark .selected-row {
    background-color: #334155 !important;
}

/* Client Card styling matching theme */
.client-info-card {
    background-color: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
}
.v-theme--dark .client-info-card {
    background-color: #27272a !important;
    border: 1px solid #3f3f46 !important;
}

/* Service Item styling matching theme */
.service-item-card {
    background-color: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
}
.v-theme--dark .service-item-card {
    background-color: #27272a !important;
    border: 1px solid #3f3f46 !important;
}

/* Product Item styling matching theme */
.product-item-card {
    background-color: #fffbeb !important;
    border: 1px solid #fde68a !important;
}
.v-theme--dark .product-item-card {
    background-color: rgba(69, 26, 3, 0.2) !important;
    border: 1px solid rgba(120, 53, 15, 0.3) !important;
}
.product-price {
    color: #78350f !important;
}
.v-theme--dark .product-price {
    color: #fef08a !important;
}

/* Total Bill styling matching theme */
.total-bill-card {
    background-color: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
}
.v-theme--dark .total-bill-card {
    background-color: #27272a !important;
    border: 1px solid #3f3f46 !important;
}

/* Price text color matching theme */
.price-text {
    color: #0f172a !important;
}
.v-theme--dark .price-text {
    color: #f8fafc !important;
}

/* Scoped primary button style matching theme */
.primary-btn {
    background-color: #1a1a2e !important;
    color: #ffffff !important;
}
.v-theme--dark .primary-btn {
    background-color: #3b82f6 !important; /* Bright blue for dark mode readability */
    color: #ffffff !important;
}

/* Global SweetAlert2 button text styling for readability */
:global(.swal2-popup .swal2-confirm),
:global(.swal2-popup .swal2-cancel) {
    color: #ffffff !important;
    font-weight: 600 !important;
}
</style>