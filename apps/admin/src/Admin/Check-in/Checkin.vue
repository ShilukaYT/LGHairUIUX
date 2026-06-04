<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
    Search, UserCheck, X, Clock, Users,
    Plus, Trash2, ChevronLeft, ChevronRight,
    Calendar as CalendarIcon, CheckCircle2, Phone,
    CreditCard, Wallet, BadgeInfo, Camera
} from 'lucide-vue-next'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'

// --- UI Components ---
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Toaster } from '@/components/ui/sonner'
import type { S } from 'vue-router/dist/router-CWoNjPRp.mjs'
import QrScannerModal from './QrScannerModal.vue'
import WalkInModal from './WalkInModal.vue'

const API_BASE_URL = 'https://localhost:7196/api/CheckIn'

// --- State ---
const appointments = ref<any[]>([])
const stylists = ref<any[]>([])
const allServices = ref<any[]>([])
const isLoading = ref(false)
const selectedAppointment = ref<any>(null)
const selectedStylistId = ref<string | null>(null)

const serviceSearch = ref('')
const showServiceList = ref(false)
const paymentMethod = ref('momo')

const searchQuery = ref('')
const filterDate = ref(new Date().toISOString().split('T')[0])
const currentPage = ref(1)
const itemsPerPage = 8
const allServicesFromApi = ref<any[]>([]);// --- Computed properties ---
const showScanner = ref(false)
const showWalkIn = ref(false)

// --- Logic xử lý thời gian ---
// --- Logic xử lý thời gian ---
const formatTime = (timeStr: string) => {
    if (!timeStr) return '00:00';
    // Lấy phần giờ sau chữ T (ví dụ: "08:30 - 09:30")
    return timeStr.includes('T') ? timeStr.split('T')[1] : timeStr;
};

const filteredData = computed(() => {
    return appointments.value.filter(a => {
        const q = searchQuery.value.toLowerCase();
        return a.tenKhach.toLowerCase().includes(q) || a.sdt.includes(q);
    });
});

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredData.value.slice(start, start + itemsPerPage);
});

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1);

// --- Logic xử lý dịch vụ: Load danh sách dịch vụ từ API mới ---
const fetchServiceData = async () => {
    // KIỂM TRA: Nếu đã có dữ liệu rồi thì thoát hàm, không load lại nữa
    if (allServicesFromApi.value.length > 0) {
        console.log("Dữ liệu dịch vụ đã tồn tại, không load lại.");
        return;
    }

    try {
        isLoading.value = true;
        // Gọi API mới tạo ở bước 1
        const res = await axios.get(`${API_BASE_URL}/all-services-combos`);
        allServicesFromApi.value = res.data;
        console.log("Đã load danh mục dịch vụ mới.");
    } catch (error) {
        toast.error("Lỗi khi tải danh sách dịch vụ!");
    } finally {
        isLoading.value = false;
    }
};

// --- Logic xử lý dịch vụ: Lọc danh sách dịch vụ theo từ khóa và loại bỏ dịch vụ đã có trong lịch hẹn ---
const filteredServices = computed(() => {
    const query = serviceSearch.value.toLowerCase().trim();
    let list = allServicesFromApi.value; // Chứa { Id, Name, Price }

    if (query) {
        list = list.filter(s => s.Name.toLowerCase().includes(query));
    }

    // LỌC BỎ: Nếu món nào đã có trong đơn thì ẩn khỏi danh sách tìm kiếm
    if (selectedAppointment.value) {
        const existingIds = new Set(
            selectedAppointment.value.dichVus.map((d: any) => d.id ?? d.Id)
        );
        list = list.filter(item => !existingIds.has(item.id ?? item.Id));
    }

    return list.slice(0, 10);
});

const fetchData = async () => {
    isLoading.value = true;
    try {
        const [resAppt, resData, resStylists] = await Promise.all([
            axios.get(`${API_BASE_URL}/get-appointments`, { params: { date: filterDate.value } }),
            axios.get('https://localhost:7196/api/DatDichVu/data-booking'),
            axios.get('https://localhost:7196/api/DatDichVu/get-stylists')
        ]);
        appointments.value = resAppt.data;
        allServices.value = [...resData.data.services, ...resData.data.combos];
        stylists.value = resStylists.data;
    } catch (error) {
        toast.error("Lỗi kết nối hệ thống!");
    } finally {
        isLoading.value = false;
    }
};


// Logic khi chọn 1 lịch hẹn: Load chi tiết dịch vụ của lịch đó (nếu có) và lưu vào selectedAppointment
// Thay thế đoạn code này:
const setSelectedAppointment = async (item: any) => {
    selectedAppointment.value = { ...item, dichVus: item.dichVus ?? [], tongTien: item.tongTien ?? 0, daThanhToan: item.daThanhToan ?? 0 };

    // ÉP KIỂU VỀ STRING Ở ĐÂY:
    if (item.maNv) {
        selectedStylistId.value = String(item.maNv);
    } else {
        selectedStylistId.value = null;
    }

    await fetchServiceData();
};
// 3. Hàm xử lý khi camera quét được mã QR
const handleScanData = async (qrData: string) => {
    // Tự động đóng cửa sổ quét
    showScanner.value = false;

    try {
        isLoading.value = true;
        // Gọi API Backend lấy dữ liệu lịch đặt từ mã QR
        const res = await axios.get(`${API_BASE_URL}/get-by-qrcode/${qrData}`);

        // Nếu tìm thấy, tự động bắn thông tin sang màn hình bên phải luôn!
        if (res.data) {
            await setSelectedAppointment(res.data);
            toast.success("Đã tìm thấy lịch hẹn từ QR Code!");
        }
    } catch (error) {
        toast.error("Không tìm thấy mã QR này trong hệ thống!");
        console.error(error);
    } finally {
        isLoading.value = false;
    }
};
const addServiceToAppt = (service: any) => {
    if (!selectedAppointment.value) return;

    // 1. Kiểm tra trùng lặp
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

    // 2. Thêm vào danh sách
    selectedAppointment.value.dichVus.push({
        id: serviceId,
        ten: service.name ?? service.Name,
        gia: service.price ?? service.Price,
        originalPrice: service.originalPrice ?? service.OriginalPrice ?? service.price ?? service.Price
    });

    // 3. Cập nhật tổng tiền
    selectedAppointment.value.tongTien += (service.price ?? service.Price);

    // 4. ĐÓNG BẢNG VÀ XÓA CHỮ (Cho trường hợp thêm thành công)
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

    // 1. Tính toán số tiền thực tế khách cần trả thêm
    const conThieu = selectedAppointment.value.tongTien - selectedAppointment.value.daThanhToan;

    // 2. Hiện thông báo xác nhận
    // Thay thế đoạn confirmResult cũ bằng đoạn này:
    const btnText = paymentMethod.value === 'tienmat' ? 'Xác nhận đã thu đủ tiền' : 'Tạo mã thanh toán';
    const titleText = paymentMethod.value === 'tienmat' ? 'Xác nhận thu tiền mặt?' : 'Xác nhận thu tiền?';

    const confirmResult = await Swal.fire({
        title: titleText,
        html: `Khách hàng cần thanh toán thêm: <b class="text-rose-600">${conThieu.toLocaleString()}đ</b> qua <b>${paymentMethod.value.toUpperCase()}</b>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: btnText,
        cancelButtonText: 'Hủy',
        confirmButtonColor: paymentMethod.value === 'tienmat' ? '#10B981' : '#4F46E5' // Xanh lá nếu là tiền mặt
    });

    if (!confirmResult.isConfirmed) return;

    try {
        isLoading.value = true;

        const payload = {
            maLd: String(selectedAppointment.value.maLd),
            maStylist: String(selectedStylistId.value),
            paymentMethod: String(paymentMethod.value),
            amountToPay: Number(conThieu),
            updatedServices: selectedAppointment.value.dichVus.map((s: any) => ({
                Id: String(s.id || s.Id),
                Gia: Number(s.gia || s.Gia)
            }))
        };

        // 3. Gửi yêu cầu lên API để lấy link thanh toán
        const response = await axios.post(`${API_BASE_URL}/confirm-final-payment`, payload);

        // 4. LOAD RA VN PAY HOẶC MOMO NẾU CÓ LINK (NHƯ CŨ)
        if (response.data && response.data.payUrl) {
            window.location.href = response.data.payUrl;
        } else {
            // Nếu không còn nợ (đã trả đủ) thì chỉ cần báo thành công
            await Swal.fire('Thành công', 'Lịch hẹn đã được hoàn tất!', 'success');
            selectedAppointment.value = null;
            await fetchData();
        }
    } catch (error: any) {
        console.error("Lỗi:", error.response?.data || error);
        toast.error("Không thể tạo link thanh toán!");
    } finally {
        isLoading.value = false;
    }
};

// Sửa hàm onMounted trong file Checkin.vue
onMounted(async () => {
    await fetchData(); // Tải danh sách lúc vào trang

    // Kiểm tra query string trên URL
    const params = new URLSearchParams(window.location.search);
    const vnpCode = params.get('vnp_ResponseCode');
    const momoCode = params.get('resultCode');

    // Nếu thanh toán thành công (VNPay: '00', MoMo: '0')
    if (vnpCode === '00' || momoCode === '0') {
        await Swal.fire({
            title: 'Thanh toán thành công!',
            text: 'Lịch hẹn đã được hoàn tất và lưu vào hệ thống.',
            icon: 'success',
            confirmButtonColor: '#4F46E5'
        });

        // Xóa rác trên URL để không bị hiện lại popup khi F5
        window.history.replaceState({}, document.title, window.location.pathname);

        // Cập nhật lại danh sách: Lúc này khách đó sẽ biến mất vì status = 3
        await fetchData();
    }
});
watch(filterDate, fetchData);
</script>

<template>
    <div class="min-h-screen bg-[#F0F2F5] p-5 md:p-10 font-sans text-slate-800 text-left">
        <div class="max-w-[1500px] mx-auto grid grid-cols-12 gap-6 lg:gap-10 items-start">

            <!-- ===== CỘT TRÁI: Danh sách lịch hẹn ===== -->
            <div class="col-span-12 lg:col-span-7 flex flex-col gap-6">

                <!-- Header -->
                <div
                    class="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div
                            class="w-12 h-12 md:w-14 md:h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white flex-shrink-0">
                            <UserCheck class="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h1 class="text-lg md:text-xl font-bold tracking-tight leading-tight">Check-in</h1>
                            <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Salon
                                Management</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <CalendarIcon class="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <input type="date" v-model="filterDate"
                            class="bg-transparent border-none font-bold text-xs outline-none text-slate-700 cursor-pointer" />
                    </div>
                </div>

                <!-- Bảng lịch hẹn -->
                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                    style="height: calc(100vh - 220px); min-height: 500px; max-height: 780px;">

                    <div class="p-6 pb-3 border-b border-slate-50 flex gap-3 items-center">

                        <div class="relative flex-1">
                            <Search
                                class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                            <Input v-model="searchQuery" placeholder="Tìm tên khách hoặc số điện thoại..."
                                class="pl-11 h-12 w-full rounded-xl bg-slate-50 border-none font-medium shadow-inner text-sm" />
                        </div>
                        <Button @click="showWalkIn = true"
                            class="h-12 px-4 md:px-5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-none shadow-sm transition-all flex items-center gap-2 mr-2">
                            <UserPlus class="w-5 h-5" />
                            <span class="hidden sm:inline font-bold">Khách vãng lai</span>
                        </Button>
                        <Button @click="showScanner = true"
                            class="h-12 px-4 md:px-5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white border-none shadow-sm transition-all flex items-center gap-2">
                            <Camera class="w-5 h-5" />
                            <span class="hidden sm:inline font-bold">Quét QR</span>
                        </Button>

                    </div>
                    <!-- Table -->
                    <div class="flex-1 overflow-auto custom-scroll">
                        <Table>
                            <TableHeader>
                                <TableRow class="border-none hover:bg-transparent">
                                    <TableHead
                                        class="pl-6 w-[45%] font-black text-[10px] text-slate-300 uppercase tracking-widest whitespace-nowrap">
                                        Khách hàng
                                    </TableHead>
                                    <TableHead
                                        class="text-center w-[20%] font-black text-[10px] text-slate-300 uppercase tracking-widest whitespace-nowrap">
                                        Giờ hẹn
                                    </TableHead>
                                    <TableHead
                                        class="text-right w-[25%] font-black text-[10px] text-slate-300 uppercase tracking-widest whitespace-nowrap">
                                        Tổng tiền
                                    </TableHead>
                                    <TableHead class="text-right pr-6 w-[10%]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="item in paginatedData" :key="item.maLd"
                                    @click="setSelectedAppointment(item)"
                                    class="cursor-pointer border-none transition-all duration-150" :class="selectedAppointment?.maLd === item.maLd
                                        ? 'bg-slate-900 text-white shadow-md'
                                        : 'hover:bg-slate-50 text-slate-800'">
                                    <TableCell class="pl-6 py-4 rounded-l-xl">
                                        <div class="text-sm font-bold leading-tight">{{ item.tenKhach }}</div>
                                        <div class="text-[11px] font-medium mt-0.5"
                                            :class="selectedAppointment?.maLd === item.maLd ? 'text-slate-400' : 'text-slate-400'">
                                            {{ item.sdt }}
                                        </div>
                                    </TableCell>
                                    <TableCell class="text-center py-4">
                                        <span
                                            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black"
                                            :class="selectedAppointment?.maLd === item.maLd
                                                ? 'bg-white/10 text-white'
                                                : 'bg-slate-100 text-slate-500'">
                                            <Clock class="w-3 h-3" />
                                            {{ formatTime(item.ngayHen) }}
                                        </span>
                                    </TableCell>
                                    <TableCell class="text-right py-4 font-black text-sm"
                                        :class="selectedAppointment?.maLd === item.maLd ? 'text-white' : 'text-slate-900'">
                                        {{ item.tongTien.toLocaleString() }}đ
                                    </TableCell>
                                    <TableCell class="text-right pr-6 py-4 rounded-r-xl">
                                        <CheckCircle2 class="w-5 h-5 ml-auto"
                                            :class="selectedAppointment?.maLd === item.maLd ? 'text-indigo-400' : 'text-slate-200'" />
                                    </TableCell>
                                </TableRow>

                                <!-- Empty state -->
                                <TableRow v-if="paginatedData.length === 0" class="border-none hover:bg-transparent">
                                    <TableCell colspan="4" class="text-center py-16 text-slate-300">
                                        <Users class="w-8 h-8 mx-auto mb-2 opacity-30" />
                                        <p class="text-xs font-bold uppercase tracking-widest">Không có lịch hẹn</p>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <!-- Pagination -->
                    <div class="px-6 py-4 flex justify-between items-center border-t border-slate-50">
                        <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                            Trang {{ currentPage }} / {{ totalPages }}
                        </span>
                        <div class="flex gap-1">
                            <Button @click="currentPage--" :disabled="currentPage === 1" variant="ghost" size="sm"
                                class="rounded-lg font-bold w-9 h-9 p-0">
                                <ChevronLeft class="w-4 h-4" />
                            </Button>
                            <Button @click="currentPage++" :disabled="currentPage === totalPages" variant="ghost"
                                size="sm" class="rounded-lg font-bold w-9 h-9 p-0">
                                <ChevronRight class="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- ===== CỘT PHẢI: Chi tiết & Check-in ===== -->
            <div class="col-span-12 lg:col-span-5 sticky top-10">

                <!-- Panel chi tiết -->
                <div v-if="selectedAppointment"
                    class="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300"
                    style="height: calc(100vh - 80px); min-height: 620px; max-height: 860px;">
                    <!-- ── HEADER: Thông tin khách — CỐ ĐỊNH, không scroll ── -->
                    <div class="flex-shrink-0 bg-white px-7 pt-7 pb-5 border-b border-slate-100">
                        <div class="flex justify-between items-center mb-4">
                            <span
                                class="bg-indigo-50 text-indigo-400 font-bold text-[9px] uppercase tracking-widest px-3 py-1 rounded-lg">
                                #{{ selectedAppointment.maLd }}
                            </span>
                            <button @click="selectedAppointment = null"
                                class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
                                <X class="w-4 h-4" />
                            </button>
                        </div>

                        <!-- Tên + SĐT -->
                        <div class="flex items-end justify-between gap-3">
                            <div class="min-w-0">
                                <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Khách
                                    hàng</p>
                                <h2 class="text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                                    {{ selectedAppointment.tenKhach }}
                                </h2>
                            </div>
                            <div
                                class="flex items-center gap-1.5 text-indigo-400 text-xs font-semibold bg-indigo-50 px-3 py-2 rounded-xl flex-shrink-0">
                                <Phone class="w-3 h-3" />
                                <span>{{ selectedAppointment.sdt }}</span>
                            </div>
                            <div class="mt-4 flex items-center gap-2">
                                <span
                                    class="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2">
                                    <Clock class="w-4 h-4 text-indigo-500" />
                                    Làm từ: {{ formatTime(selectedAppointment.ngayHen) }}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- ── BODY: Form + Tổng tiền — CÓ THỂ SCROLL ── -->
                    <div class="flex-1 overflow-y-auto custom-scroll px-7 py-5 space-y-6">

                        <!-- Thêm dịch vụ -->
                        <div class="space-y-2">
                            <label
                                class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Plus class="w-3 h-3 text-indigo-500" /> Bán thêm dịch vụ
                            </label>
                            <div class="relative">
                                <Search
                                    class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                                <Input v-model="serviceSearch" @focus="showServiceList = true"
                                    placeholder="Tìm nhanh dịch vụ..."
                                    class="h-11 pl-11 rounded-xl bg-slate-50 border-none font-bold shadow-inner text-sm" />
                                <div v-if="showServiceList"
                                    class="absolute top-full left-0 w-full mt-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto p-2">
                                    <div v-for="s in filteredServices" :key="s.id || s.Id" @click="addServiceToAppt(s)"
                                        class="flex justify-between items-center px-4 py-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                                        <div class="font-semibold text-slate-700 text-sm">{{ s.name || s.Name }}</div>

                                        <div class="flex items-center gap-2">
                                            <span v-if="(s.originalPrice || s.OriginalPrice) > (s.price || s.Price)"
                                                class="text-slate-400 line-through text-xs">
                                                {{ (s.originalPrice || s.OriginalPrice).toLocaleString() }}đ
                                            </span>
                                            <div class="font-black text-indigo-600 text-sm">
                                                {{ (s.price || s.Price).toLocaleString() }}đ
                                            </div>
                                        </div>
                                    </div>
                                    <div @click.stop="showServiceList = false; serviceSearch = ''"
                                        class="text-center py-2 text-[10px] font-black text-slate-300 uppercase cursor-pointer hover:text-slate-400 border-t border-slate-50 mt-1">
                                        ĐÓNG
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Danh sách dịch vụ -->
                        <div class="space-y-2">
                            <label
                                class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
                                <span>Dịch vụ thực hiện</span>
                                <span class="text-indigo-500 font-black">{{ selectedAppointment.dichVus.length }}</span>
                            </label>
                            <div class="space-y-1.5">
                                <div v-for="(s, index) in selectedAppointment.dichVus" :key="index"
                                    class="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-xl">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <button @click="removeService(Number(index))"
                                            class="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0">
                                            <Trash2 class="w-3.5 h-3.5" />
                                        </button>
                                        <span class="font-semibold text-slate-700 text-sm truncate">{{ s.ten }}</span>
                                    </div>

                                    <div class="flex items-center gap-2 flex-shrink-0 ml-3">
                                        <span v-if="s.originalPrice && s.originalPrice > s.gia"
                                            class="text-slate-400 line-through text-xs">
                                            {{ s.originalPrice.toLocaleString() }}đ
                                        </span>
                                        <span class="font-black text-slate-900 text-sm">
                                            {{ s.gia.toLocaleString() }}đ
                                        </span>
                                    </div>
                                </div>
                                <div v-if="selectedAppointment.dichVus.length === 0"
                                    class="text-center py-5 text-slate-300 text-xs font-bold uppercase tracking-widest">
                                    Chưa có dịch vụ
                                </div>
                            </div>
                        </div>

                        <!-- Chọn stylist -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Phân Stylist phục vụ
                            </label>
                            <Select v-model="selectedStylistId">
                                <SelectTrigger
                                    class="h-11 rounded-xl bg-slate-50 border-none font-bold shadow-inner px-4 text-sm">
                                    <SelectValue placeholder="Chọn thợ làm" />
                                </SelectTrigger>
                                <SelectContent class="rounded-xl border-none shadow-2xl">
                                    <SelectItem v-for="s in stylists" :key="s.id" :value="String(s.id)"
                                        class="font-semibold py-2.5 text-sm">
                                        {{ s.name }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <!-- Phương thức thanh toán -->
                        <div class="space-y-2">
                            <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Thanh toán khoản phát sinh qua
                            </label>
                            <div class="grid grid-cols-3 gap-2">
                                <div @click="paymentMethod = 'tienmat'" :class="paymentMethod === 'tienmat'
                                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-100'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'"
                                    class="h-11 rounded-xl flex items-center justify-center font-black text-[10px] uppercase cursor-pointer transition-all tracking-widest select-none">
                                    TIỀN MẶT
                                </div>

                                <div @click="paymentMethod = 'momo'" :class="paymentMethod === 'momo'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'"
                                    class="h-11 rounded-xl flex items-center justify-center font-black text-[10px] uppercase cursor-pointer transition-all tracking-widest select-none">
                                    MOMO
                                </div>

                                <div @click="paymentMethod = 'vnpay'" :class="paymentMethod === 'vnpay'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
                                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'"
                                    class="h-11 rounded-xl flex items-center justify-center font-black text-[10px] uppercase cursor-pointer transition-all tracking-widest select-none">
                                    VNPAY
                                </div>
                            </div>
                        </div>

                        <!-- ── Tổng tiền (nằm trong scroll, kéo xuống thấy) ── -->
                        <div class="border-t border-slate-100 pt-5 space-y-3">
                            <div class="flex flex-col gap-1.5">
                                <div class="flex justify-between items-center text-xs font-semibold text-slate-400">
                                    <span class="uppercase tracking-widest">TỔNG HÓA ĐƠN HIỆN TẠI</span>
                                    <span class="font-black text-slate-600">{{
                                        selectedAppointment.tongTien.toLocaleString() }}đ</span>
                                </div>
                                <div class="flex justify-between items-center text-xs font-semibold text-emerald-500">
                                    <span class="uppercase tracking-widest">TIỀN KHÁCH ĐÃ TRẢ (CỌC)</span>
                                    <span class="font-black">−{{ selectedAppointment.daThanhToan.toLocaleString()
                                        }}đ</span>
                                </div>
                            </div>

                            <div class="flex justify-between items-center rounded-2xl px-5 py-4"
                                :class="selectedAppointment.tongTien - selectedAppointment.daThanhToan > 0 ? 'bg-rose-50 border border-rose-100' : 'bg-emerald-50 border border-emerald-100'">
                                <div>
                                    <p class="text-[9px] font-black uppercase tracking-[0.15em] mb-0.5"
                                        :class="selectedAppointment.tongTien - selectedAppointment.daThanhToan > 0 ? 'text-rose-400' : 'text-emerald-400'">
                                        {{ selectedAppointment.tongTien - selectedAppointment.daThanhToan > 0 ? 'CÒN THIẾU CẦN THU' : 'ĐÃ THANH TOÁN ĐỦ' }}
                                    </p>
                                    <div class="text-2xl font-black tracking-tight"
                                        :class="selectedAppointment.tongTien - selectedAppointment.daThanhToan > 0 ? 'text-rose-600' : 'text-emerald-600'">
                                        {{ (selectedAppointment.tongTien -
                                            selectedAppointment.daThanhToan).toLocaleString() }}đ
                                    </div>
                                </div>
                                <div class="w-2 h-8 rounded-full"
                                    :class="selectedAppointment.tongTien - selectedAppointment.daThanhToan > 0 ? 'bg-rose-500' : 'bg-emerald-500'">
                                </div>
                            </div>
                        </div>

                        <!-- Padding bottom để nút không che content cuối -->
                        <div class="h-2"></div>
                    </div>

                    <!-- ── FOOTER: Chỉ nút xác nhận — CỐ ĐỊNH dưới cùng ── -->
                    <div class="flex-shrink-0 px-7 pt-3 pb-6 bg-white border-t border-slate-100">
                        <Button @click="confirmCheckIn"
                            class="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]">
                            Bắt đầu phục vụ
                        </Button>
                    </div>
                </div>

                <!-- Placeholder khi chưa chọn -->
                <div v-else
                    class="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-200 p-12 text-center"
                    style="height: calc(100vh - 80px); min-height: 620px; max-height: 860px;">
                    <Users class="w-10 h-10 mb-3 opacity-20" />
                    <h3 class="text-xs font-bold uppercase tracking-widest">Chọn lịch hẹn để bắt đầu</h3>
                </div>
            </div>
        </div>
        <WalkInModal :isOpen="showWalkIn" :stylists="stylists" @close="showWalkIn = false"
            @success="showWalkIn = false; fetchData();" />
        <QrScannerModal v-if="showScanner" @close="showScanner = false" @scan-success="handleScanData" />
        <Toaster richColors position="bottom-center" />
    </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800&display=swap');

.font-sans {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}

::-webkit-scrollbar {
    width: 4px;
}

::-webkit-scrollbar-thumb {
    background: #E2E8F0;
    border-radius: 10px;
}

::-webkit-scrollbar-track {
    background: transparent;
}
</style>