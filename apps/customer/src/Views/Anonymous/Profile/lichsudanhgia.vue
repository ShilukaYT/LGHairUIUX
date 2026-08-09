<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';
import Swal from 'sweetalert2';
import { Star, Camera, X, Trash2, Search, ChevronLeft, ChevronRight, MessageSquare, ClipboardList, Calendar } from 'lucide-vue-next';

const pendingOrders = ref([]);
const pendingStaffOrders = ref([]);
const activeSection = ref('service');
const subTab = ref('pending');
const ratedOrders = ref([]);
const ratedStaffOrders = ref([]);
const isSubmitting = ref(false);

// ==========================================
// 🌟 TÌM KIẾM, SẮP XẾP & PHÂN TRANG
// ==========================================
const searchQuery = ref('');
const sortOption = ref('newest'); // 'newest' hoặc 'oldest'
const itemsPerPage = 5;

const currentPendingPage = ref(1);
const currentRatedPage = ref(1);
const currentPendingStaffPage = ref(1);
const currentRatedStaffPage = ref(1);

// Reset trang về 1 khi người dùng gõ tìm kiếm, đổi sắp xếp hoặc chuyển tab
watch([searchQuery, sortOption, activeSection, subTab], () => {
    currentPendingPage.value = 1;
    currentRatedPage.value = 1;
    currentPendingStaffPage.value = 1;
    currentRatedStaffPage.value = 1;
});

const getTime = (dateStr) => new Date(dateStr).getTime() || 0;

// ----- PIPELINE 1: DỊCH VỤ - CHƯA ĐÁNH GIÁ -----
const processedPendingOrders = computed(() => {
    let result = pendingOrders.value;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => o.id.toLowerCase().includes(q) || o.services.some(s => s.name.toLowerCase().includes(q)));
    }
    return result.sort((a, b) => sortOption.value === 'newest' ? getTime(b.date) - getTime(a.date) : getTime(a.date) - getTime(b.date));
});
const totalPendingPages = computed(() => Math.ceil(processedPendingOrders.value.length / itemsPerPage));
const paginatedPendingOrders = computed(() => processedPendingOrders.value.slice((currentPendingPage.value - 1) * itemsPerPage, currentPendingPage.value * itemsPerPage));

// ----- PIPELINE 2: DỊCH VỤ - ĐÃ ĐÁNH GIÁ -----
const processedRatedOrders = computed(() => {
    let result = ratedOrders.value;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => o.id.toLowerCase().includes(q) || o.services.some(s => s.name.toLowerCase().includes(q)));
    }
    return result.sort((a, b) => sortOption.value === 'newest' ? getTime(b.date) - getTime(a.date) : getTime(a.date) - getTime(b.date));
});
const totalRatedPages = computed(() => Math.ceil(processedRatedOrders.value.length / itemsPerPage));
const paginatedRatedOrders = computed(() => processedRatedOrders.value.slice((currentRatedPage.value - 1) * itemsPerPage, currentRatedPage.value * itemsPerPage));

// ----- PIPELINE 3: NHÂN VIÊN - CHƯA ĐÁNH GIÁ -----
const processedPendingStaffOrders = computed(() => {
    let result = pendingStaffOrders.value;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => o.id.toLowerCase().includes(q) || o.staffs.some(s => s.name.toLowerCase().includes(q)));
    }
    return result.sort((a, b) => sortOption.value === 'newest' ? getTime(b.date) - getTime(a.date) : getTime(a.date) - getTime(b.date));
});
const totalPendingStaffPages = computed(() => Math.ceil(processedPendingStaffOrders.value.length / itemsPerPage));
const paginatedPendingStaffOrders = computed(() => processedPendingStaffOrders.value.slice((currentPendingStaffPage.value - 1) * itemsPerPage, currentPendingStaffPage.value * itemsPerPage));

// ----- PIPELINE 4: NHÂN VIÊN - ĐÃ ĐÁNH GIÁ -----
const processedRatedStaffOrders = computed(() => {
    let result = ratedStaffOrders.value;
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => o.id.toLowerCase().includes(q) || o.staffs.some(s => s.name.toLowerCase().includes(q)));
    }
    return result.sort((a, b) => sortOption.value === 'newest' ? getTime(b.date) - getTime(a.date) : getTime(a.date) - getTime(b.date));
});
const totalRatedStaffPages = computed(() => Math.ceil(processedRatedStaffOrders.value.length / itemsPerPage));
const paginatedRatedStaffOrders = computed(() => processedRatedStaffOrders.value.slice((currentRatedStaffPage.value - 1) * itemsPerPage, currentRatedStaffPage.value * itemsPerPage));

// --- HÀM CHUYỂN TRANG ---
const changePage = (listType, step) => {
    if (listType === 'pending') {
        const n = currentPendingPage.value + step; if (n > 0 && n <= totalPendingPages.value) currentPendingPage.value = n;
    } else if (listType === 'rated') {
        const n = currentRatedPage.value + step; if (n > 0 && n <= totalRatedPages.value) currentRatedPage.value = n;
    } else if (listType === 'pendingStaff') {
        const n = currentPendingStaffPage.value + step; if (n > 0 && n <= totalPendingStaffPages.value) currentPendingStaffPage.value = n;
    } else if (listType === 'ratedStaff') {
        const n = currentRatedStaffPage.value + step; if (n > 0 && n <= totalRatedStaffPages.value) currentRatedStaffPage.value = n;
    }
};

// ==========================================
// LOGIC API VÀ CHỨC NĂNG CŨ (Giữ nguyên)
// ==========================================
// ==========================================
// LOGIC API (ĐÃ SỬA LỖI XUNG ĐỘT ĐỒNG BỘ)
// ==========================================
const toggleMode = (order, mode) => {
    if (order.viewMode === mode) {
        order.viewMode = '';
    } else {
        order.viewMode = mode;
    }
};

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'


// 1. TẢI DỮ LIỆU CHƯA ĐÁNH GIÁ (Pending)
const loadData = async () => {
    try {
        const user = getCustomerInfo();
        if (!user?.maKH || user.maKH === 'GUEST') return;

        const res = await axios.get(API + `/api/DanhGia/pending-to-rate/${user.maKH}`);

        // Lọc Tab Dịch vụ: CHỈ LẤY CÁC DỊCH VỤ THỰC SỰ CHƯA ĐÁNH GIÁ
        const ordersForService = res.data
            .filter(order => order.services.some(s => !s.isAlreadyRated))
            .map(order => {
                // Sửa lỗi "Chuyển qua bên chưa đánh giá": 
                // Lọc bỏ luôn các dịch vụ đã đánh giá khỏi danh sách hiển thị
                const unratedServices = order.services.filter(s => !s.isAlreadyRated);
                const oldOrder = pendingOrders.value.find(o => o.id === order.id);

                return {
                    ...order,
                    viewMode: oldOrder ? oldOrder.viewMode : '',
                    services: unratedServices // Chỉ hiển thị dịch vụ cần đánh giá
                };
            });
        pendingOrders.value = ordersForService;

        // Lọc Tab Nhân viên
        const ordersForStaff = res.data
            .filter(order => order.staffs && order.staffs.length > 0)
            .map(order => {
                const oldOrder = pendingStaffOrders.value.find(o => o.id === order.id);
                return {
                    ...order,
                    show: oldOrder ? oldOrder.show : false
                };
            });
        pendingStaffOrders.value = ordersForStaff;

    } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
    }
};

// 2. TẢI DỮ LIỆU ĐÃ ĐÁNH GIÁ (Rated)
const loadRatedData = async () => {
    try {
        const user = getCustomerInfo();
        if (!user?.maKH || user.maKH === 'GUEST') return;

        // Bỏ logic Push/Filter thủ công gây rác dữ liệu. Gán thẳng từ Backend!
        const res = await axios.get(API + `/api/DanhGia/rated-history/${user.maKH}`);
        ratedOrders.value = res.data;

        const resStaff = await axios.get(API + `/api/DanhGia/staff-rated-history/${user.maKH}`);
        ratedStaffOrders.value = resStaff.data;
    } catch (error) {
        console.error("Lỗi tải lịch sử đánh giá:", error);
    }
};

const changeSubTab = async (tab) => {
    subTab.value = tab;
    if (tab === 'completed') {
        await loadRatedData();
    } else {
        await loadData();
    }
};

onMounted(loadData);

// 3. GỬI ĐÁNH GIÁ DỊCH VỤ CHI TIẾT
const submitAction = async (order) => {
    if (isSubmitting.value) return;

    try {
        isSubmitting.value = true;
        const formData = new FormData();
        formData.append('maHd', order.id);

        let activeCount = 0;
        order.services.forEach((s) => {
            if (!s.isAlreadyRated && s.rating > 0) {
                const prefix = `reviews[${activeCount}]`;
                formData.append(`${prefix}.MaDv`, s.id.startsWith('DV') ? s.id : '');
                formData.append(`${prefix}.MaCb`, s.id.startsWith('CB') ? s.id : '');
                formData.append(`${prefix}.SoSao`, s.rating);
                formData.append(`${prefix}.NoiDung`, s.comment || '');
                if (s.imageFile) formData.append(`${prefix}.HinhAnhFile`, s.imageFile);
                activeCount++;
            }
        });

        if (activeCount === 0) {
            Swal.fire({
                title: 'Opps!',
                text: 'Vui lòng chọn số sao.',
                icon: 'warning',
                confirmButtonText: 'Đã hiểu',
                confirmButtonColor: '#000'
            });
            return;
        }

        const res = await axios.post(API + `/api/DanhGia/submit-multiple-reviews-with-image`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.status === 200) {
            Swal.fire({
                title: 'Thành công!',
                text: 'Gửi đánh giá dịch vụ thành công!',
                icon: 'success',
                confirmButtonText: 'Tuyệt vời',
                confirmButtonColor: '#000'
            });
            // Reload lại toàn bộ từ Server để đồng bộ hóa 100%
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        console.error("Lỗi:", error);
    } finally {
        isSubmitting.value = false;
    }
};

// 4. GỬI ĐÁNH GIÁ CHUNG
const submitOverallAction = async (order) => {
    if (isSubmitting.value) return;
    if (!order.generalRating) {
        Swal.fire({
            title: 'Opps!',
            text: 'Vui lòng chọn số sao để đánh giá.',
            icon: 'warning',
            confirmButtonText: 'Đã hiểu',
            confirmButtonColor: '#000'
        });
        return;
    }

    try {
        isSubmitting.value = true;
        const formData = new FormData();
        formData.append('maHd', order.id);
        formData.append('generalRating', order.generalRating);
        formData.append('generalComment', order.generalComment || 'Đánh giá chung cho đơn hàng');
        if (order.generalImageFile) formData.append('hinhAnhFile', order.generalImageFile);

        const res = await axios.post(  API + '/api/DanhGia/submit-order-overall-with-image', formData);

        if (res.status === 200) {
            Swal.fire({
                title: 'Thành công!',
                text: 'Cảm ơn bạn đã đánh giá chung đơn hàng!',
                icon: 'success',
                confirmButtonText: 'Tuyệt vời',
                confirmButtonColor: '#000'
            });
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        Swal.fire({
            title: 'Lỗi',
            text: 'Có lỗi xảy ra khi gửi đánh giá chung.',
            icon: 'error',
            confirmButtonText: 'Đóng',
            confirmButtonColor: '#000'
        });
    } finally {
        isSubmitting.value = false;
    }
};

// 5. GỬI ĐÁNH GIÁ NHÂN VIÊN
const submitStaffAction = async (order) => {
    if (isSubmitting.value) return;

    const ratedStaffs = order.staffs.filter(staff => staff.rating > 0);
    if (ratedStaffs.length === 0) {
        Swal.fire({
            title: 'Opps!',
            text: 'Vui lòng chọn số sao cho ít nhất 1 nhân viên.',
            icon: 'warning',
            confirmButtonText: 'Đã hiểu',
            confirmButtonColor: '#000'
        });
        return;
    }

    try {
        isSubmitting.value = true;
        const payload = ratedStaffs.map(staff => ({
            maHd: order.id,
            maNv: staff.id,
            soSao: staff.rating,
            noiDung: staff.comment || ''
        }));

        const res = await axios.post(API + '/api/DanhGia/submit-staff-reviews', payload);

        if (res.status === 200) {
            Swal.fire({
                title: 'Thành công!',
                text: 'Cảm ơn bạn đã đánh giá nhân viên!',
                icon: 'success',
                confirmButtonText: 'Tuyệt vời',
                confirmButtonColor: '#000'
            });
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        Swal.fire({
            title: 'Lỗi',
            text: 'Có lỗi xảy ra khi gửi đánh giá.',
            icon: 'error',
            confirmButtonText: 'Đóng',
            confirmButtonColor: '#000'
        });
    } finally {
        isSubmitting.value = false;
    }
};

// XỬ LÝ ẢNH
const handleGeneralFileChange = (event, order) => {
    const file = event.target.files[0];
    if (file) {
        order.generalImageFile = file;
        order.generalImagePreview = URL.createObjectURL(file);
    }
};

const handleFileChange = (event, service) => {
    const file = event.target.files[0];
    if (file) {
        service.imageFile = file;
        service.imagePreview = URL.createObjectURL(file);
    }
};

const removeImage = (service) => {
    service.imageFile = null;
    service.imagePreview = null;
};

// 6. XÓA ĐÁNH GIÁ LẺ
const deleteSingleService = async (maHd, serviceId) => {
    const result = await Swal.fire({
        title: 'Xóa đánh giá?',
        text: "Bạn có chắc chắn muốn xóa đánh giá này?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#000',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await axios.delete(API + `/api/DanhGia/delete-service-rating/${maHd}/${serviceId}`);
        if (res.status === 200) {
            Swal.fire({
                title: 'Đã xóa!',
                text: 'Đã xóa đánh giá thành công.',
                icon: 'success',
                confirmButtonText: 'Tuyệt vời',
                confirmButtonColor: '#000'
            });
            // Gọi lại API, không tự chỉnh mảng bằng tay nữa
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        Swal.fire('Lỗi', 'Có lỗi xảy ra khi xóa.', 'error');
    }
};

const deleteFullOrder = async (maHd) => {
    const result = await Swal.fire({
        title: 'Xóa toàn bộ?',
        text: "Xóa toàn bộ đánh giá của hóa đơn này?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#000',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        await axios.delete(API + `/api/DanhGia/delete-order-rating/${maHd}`);
        Swal.fire({
            title: 'Đã xóa!',
            text: 'Đã xóa toàn bộ đánh giá!',
            icon: 'success',
            confirmButtonText: 'Tuyệt vời',
            confirmButtonColor: '#000'
        });
        await loadData();
        await loadRatedData();
    } catch (error) {
        Swal.fire('Lỗi', 'Có lỗi xảy ra khi xóa.', 'error');
    }
};

const deleteStaffRating = async (maHd) => {
    const result = await Swal.fire({
        title: 'Xóa đánh giá?',
        text: "Bạn có chắc chắn muốn xóa đánh giá nhân viên này?",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#000',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    });

    if (!result.isConfirmed) return;

    try {
        const res = await axios.delete(API + `/api/DanhGia/delete-staff-rating/${maHd}`);
        if (res.status === 200) {
            Swal.fire({
                title: 'Đã xóa!',
                text: 'Đã xóa đánh giá nhân viên!',
                icon: 'success',
                confirmButtonText: 'Tuyệt vời',
                confirmButtonColor: '#000'
            });
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        Swal.fire('Lỗi', 'Không thể xóa. Vui lòng kiểm tra lại.', 'error');
    }
};
</script>

<template>
    <div class="animate-in fade-in duration-500">
        <!-- Main Section Selector (Service / Staff) -->
        <div class="flex justify-center border-b border-gray-100 mb-6 pb-px">
            <div class="flex gap-8">
                <button 
                    @click="activeSection = 'service'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', activeSection === 'service' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']"
                >
                    Đánh giá Dịch vụ
                </button>
                <button 
                    @click="activeSection = 'staff'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', activeSection === 'staff' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']"
                >
                    Đánh giá Nhân viên
                </button>
            </div>
        </div>

        <!-- Sub Tabs (Chưa đánh giá / Đã đánh giá) -->
        <div class="flex justify-center mb-6">
            <div class="flex border border-gray-200 p-0.5 bg-gray-50/50">
                <button 
                    @click="changeSubTab('pending')"
                    :class="['text-[9px] uppercase tracking-widest px-6 py-2 transition-all font-semibold', subTab === 'pending' ? 'bg-black text-white' : 'text-gray-500 hover:text-black']"
                >
                    Chưa đánh giá
                </button>
                <button 
                    @click="changeSubTab('completed')"
                    :class="['text-[9px] uppercase tracking-widest px-6 py-2 transition-all font-semibold', subTab === 'completed' ? 'bg-black text-white' : 'text-gray-500 hover:text-black']"
                >
                    Đã đánh giá
                </button>
            </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="flex flex-col sm:flex-row gap-4 mb-6">
            <div class="flex-1 relative">
                <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="Tìm mã đơn, tên dịch vụ / nhân viên..."
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none pl-10 pr-4 py-2.5 text-xs transition-all rounded-none text-black" 
                />
            </div>
            <div class="w-full sm:w-56">
                <select 
                    v-model="sortOption" 
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-2.5 text-xs transition-all rounded-none text-black cursor-pointer font-medium"
                >
                    <option value="newest">Ngày tạo: Mới nhất</option>
                    <option value="oldest">Ngày tạo: Cũ nhất</option>
                </select>
            </div>
        </div>

        <!-- Content Area -->
        <div class="space-y-6">
            <div v-if="activeSection === 'service'" class="space-y-6">
                <!-- PENDING SERVICE -->
                <div v-if="subTab === 'pending'" class="space-y-6">
                    <div v-if="paginatedPendingOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-none bg-white">
                        <ClipboardList :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                        <p class="text-xs text-gray-400 uppercase tracking-widest">Không tìm thấy hóa đơn chưa đánh giá nào.</p>
                    </div>

                    <div v-for="order in paginatedPendingOrders" :key="order.id" class="border border-gray-200 rounded-none bg-white p-6 shadow-sm">
                        <!-- Order Header -->
                        <div class="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-100 pb-4 mb-5 gap-2">
                            <div>
                                <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng dịch vụ</span>
                                <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                            </div>
                            <div class="text-right flex items-center gap-1.5 text-gray-500 justify-start sm:justify-end">
                                <Calendar :size="12" />
                                <span class="text-[10px] uppercase tracking-widest font-semibold">
                                    {{ new Date(order.date).toLocaleString('vi-VN', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    }) }}
                                </span>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <p class="text-xs text-gray-600">
                                <span class="font-bold text-black uppercase tracking-wider text-[10px] mr-1.5">Dịch vụ đã đặt:</span>
                                {{ order.services.map(s => s.name).join(', ') }}
                            </p>

                            <!-- Choose Rating Mode -->
                            <div class="grid grid-cols-2 gap-4 my-4">
                                <button 
                                    @click="toggleMode(order, 'each')"
                                    :class="['border px-4 py-2.5 text-[9px] font-bold tracking-widest uppercase transition-all cursor-pointer rounded-none', order.viewMode === 'each' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-black text-gray-600 hover:text-black']"
                                >
                                    {{ order.viewMode === 'each' ? 'Đóng đánh giá chi tiết' : 'Đánh giá từng dịch vụ' }}
                                </button>
                                <button 
                                    @click="toggleMode(order, 'all')"
                                    :class="['border px-4 py-2.5 text-[9px] font-bold tracking-widest uppercase transition-all cursor-pointer rounded-none', order.viewMode === 'all' ? 'border-black bg-black text-white' : 'border-gray-200 hover:border-black text-gray-600 hover:text-black']"
                                >
                                    {{ order.viewMode === 'all' ? 'Đóng đánh giá chung' : 'Đánh giá chung đơn' }}
                                </button>
                            </div>

                            <!-- Rating each service -->
                            <div v-if="order.viewMode === 'each'" class="border border-gray-100 p-6 bg-white shadow-sm rounded-sm space-y-6 animate-in fade-in duration-200">
                                <div v-for="(s, idx) in order.services" :key="s.id" class="border-b border-gray-100 pb-5 last:border-0 last:pb-0">
                                    <div v-if="!s.isAlreadyRated" class="space-y-4">
                                        <div class="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                                            <span class="text-xs font-bold uppercase tracking-wider text-black leading-tight">{{ idx + 1 }}. {{ s.name }}</span>
                                            
                                            <!-- Stars selection -->
                                            <div class="flex items-center gap-1">
                                                <button 
                                                    v-for="n in 5" 
                                                    :key="n"
                                                    @click="s.rating = n"
                                                    type="button"
                                                    class="transition-transform active:scale-95 cursor-pointer"
                                                >
                                                    <Star 
                                                        :size="18" 
                                                        :fill="n <= s.rating ? '#f59e0b' : 'none'"
                                                        :stroke="n <= s.rating ? '#f59e0b' : '#d1d5db'"
                                                        :stroke-width="1.5"
                                                    />
                                                </button>
                                            </div>
                                        </div>

                                        <input 
                                            type="text" 
                                            v-model="s.comment" 
                                            placeholder="Nhận xét cho dịch vụ này..."
                                            class="w-full bg-gray-50 border border-gray-200 focus:border-black focus:bg-white outline-none px-4 py-2.5 text-xs transition-all rounded-sm text-black" 
                                        />

                                        <!-- Image upload -->
                                        <div class="flex items-center gap-4 flex-wrap pt-1">
                                            <label :for="'file-' + s.id" class="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 hover:border-black hover:bg-white rounded-sm cursor-pointer transition-all text-[9px] uppercase tracking-widest font-semibold text-gray-700 hover:text-black">
                                                <Camera :size="14" />
                                                {{ s.imagePreview ? 'Thay ảnh' : 'Thêm ảnh minh họa' }}
                                            </label>
                                            <input type="file" :id="'file-' + s.id" @change="handleFileChange($event, s)" accept="image/*" class="hidden" />
                                            
                                            <!-- Image Preview -->
                                            <div v-if="s.imagePreview" class="relative w-14 h-14 border border-gray-200 rounded-sm overflow-hidden group">
                                                <img :src="s.imagePreview" class="w-full h-full object-cover" />
                                                <button 
                                                    @click="removeImage(s)"
                                                    type="button"
                                                    class="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X :size="14" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    @click="submitAction(order)"
                                    :disabled="isSubmitting"
                                    class="w-full bg-black text-white py-3.5 text-[10px] uppercase tracking-widest font-bold transition-all hover:bg-gray-800 active:scale-[0.99] disabled:opacity-40 rounded-sm cursor-pointer shadow-sm"
                                >
                                    {{ isSubmitting ? 'Đang gửi đánh giá...' : 'Gửi đánh giá chi tiết' }}
                                </button>
                            </div>

                            <!-- Rating overall -->
                            <div v-if="order.viewMode === 'all'" class="border border-gray-100 p-6 bg-white shadow-sm rounded-sm space-y-5 animate-in fade-in duration-200">
                                <div class="flex items-center gap-4">
                                    <span class="text-xs font-bold uppercase tracking-wider text-black">Hài lòng chung:</span>
                                    <div class="flex gap-1">
                                        <button 
                                            v-for="n in 5" 
                                            :key="n"
                                            @click="order.generalRating = n"
                                            type="button"
                                            class="transition-transform active:scale-95 cursor-pointer"
                                        >
                                            <Star 
                                                :size="20" 
                                                :fill="n <= order.generalRating ? '#f59e0b' : 'none'"
                                                :stroke="n <= order.generalRating ? '#f59e0b' : '#d1d5db'"
                                                :stroke-width="1.5"
                                            />
                                        </button>
                                    </div>
                                </div>

                                <textarea 
                                    v-model="order.generalComment" 
                                    placeholder="Nhận xét chung cho cả đơn hàng dịch vụ..."
                                    rows="3"
                                    class="w-full bg-gray-50 border border-gray-200 focus:border-black focus:bg-white outline-none px-4 py-3 text-xs transition-all rounded-sm text-black resize-none"
                                ></textarea>

                                <div class="flex items-center gap-4 flex-wrap pt-1">
                                    <label :for="'general-file-' + order.id" class="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 hover:border-black hover:bg-white rounded-sm cursor-pointer transition-all text-[10px] uppercase tracking-widest font-semibold text-gray-700 hover:text-black">
                                        <Camera :size="14" />
                                        {{ order.generalImagePreview ? 'Thay ảnh' : 'Thêm ảnh minh họa' }}
                                    </label>
                                    <input type="file" :id="'general-file-' + order.id" @change="handleGeneralFileChange($event, order)" accept="image/*" class="hidden" />
                                    
                                    <div v-if="order.generalImagePreview" class="relative w-14 h-14 border border-gray-200 rounded-sm overflow-hidden group">
                                        <img :src="order.generalImagePreview" class="w-full h-full object-cover" />
                                        <button 
                                            @click="order.generalImagePreview = null; order.generalImageFile = null"
                                            type="button"
                                            class="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X :size="14" />
                                        </button>
                                    </div>
                                </div>

                                <button 
                                    @click="submitOverallAction(order)"
                                    :disabled="isSubmitting"
                                    class="w-full bg-black text-white py-3.5 text-[10px] uppercase tracking-widest font-bold transition-all hover:bg-gray-800 active:scale-[0.99] disabled:opacity-40 rounded-sm cursor-pointer shadow-sm"
                                >
                                    {{ isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá chung' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Pagination -->
                    <div v-if="totalPendingPages > 1" class="flex justify-center items-center gap-4 pt-4">
                        <button 
                            @click="changePage('pending', -1)" 
                            :disabled="currentPendingPage === 1"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronLeft :size="14" />
                        </button>
                        <span class="text-xs font-semibold tracking-wider text-gray-600">
                            {{ currentPendingPage }} / {{ totalPendingPages }}
                        </span>
                        <button 
                            @click="changePage('pending', 1)" 
                            :disabled="currentPendingPage === totalPendingPages"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronRight :size="14" />
                        </button>
                    </div>
                </div>

                <!-- COMPLETED SERVICE -->
                <div v-else class="space-y-6">
                    <div v-if="paginatedRatedOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-none bg-white">
                        <ClipboardList :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                        <p class="text-xs text-gray-400 uppercase tracking-widest">Chưa có lịch sử đánh giá dịch vụ.</p>
                    </div>

                    <div v-for="order in paginatedRatedOrders" :key="order.id" class="border border-gray-200 border-l-4 border-l-black rounded-none bg-white p-6 shadow-sm animate-in fade-in duration-300">
                        <div class="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                            <div>
                                <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng dịch vụ</span>
                                <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{{ order.date }}</span>
                                <button 
                                    @click="deleteFullOrder(order.id)"
                                    class="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Xóa toàn bộ đánh giá của đơn này"
                                >
                                    <Trash2 :size="14" />
                                </button>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div v-for="(s, idx) in order.services" :key="idx" class="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                                <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                                    <h5 class="text-xs font-semibold uppercase tracking-wider text-black leading-tight max-w-lg">{{ s.name }}</h5>
                                    
                                    <div class="flex items-center gap-3">
                                        <!-- Rating score -->
                                        <div class="flex gap-0.5">
                                            <Star 
                                                v-for="n in 5" 
                                                :key="n"
                                                :size="12"
                                                :fill="n <= s.rating ? '#f59e0b' : 'none'"
                                                :stroke="n <= s.rating ? '#f59e0b' : '#d1d5db'"
                                                :stroke-width="1.5"
                                            />
                                        </div>
                                        <button 
                                            @click="deleteSingleService(order.id, s.id)"
                                            class="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                                            title="Xóa đánh giá này"
                                        >
                                            <X :size="12" />
                                        </button>
                                    </div>
                                </div>

                                <p v-if="s.comment" class="text-xs text-gray-600 font-light italic mt-2 whitespace-pre-line leading-relaxed">
                                    "{{ s.comment }}"
                                </p>

                                <div v-if="s.image" class="mt-3">
                                    <div class="relative w-24 h-16 border border-gray-100 rounded-none overflow-hidden hover:brightness-95 transition-all">
                                        <img :src="API + s.image" class="w-full h-full object-cover" />
                                    </div>
                                </div>

                                <!-- Shop Reply -->
                                <div v-if="s.reply" class="bg-gray-50 border-l-2 border-l-black p-4 rounded-none mt-3 space-y-1">
                                    <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest text-black font-bold">
                                        <MessageSquare :size="12" />
                                        <span>Phản hồi từ Minh Tâm Hair</span>
                                    </div>
                                    <p class="text-xs text-gray-500 font-light leading-relaxed">{{ s.reply }}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Pagination -->
                    <div v-if="totalRatedPages > 1" class="flex justify-center items-center gap-4 pt-4">
                        <button 
                            @click="changePage('rated', -1)" 
                            :disabled="currentRatedPage === 1"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronLeft :size="14" />
                        </button>
                        <span class="text-xs font-semibold tracking-wider text-gray-600">
                            {{ currentRatedPage }} / {{ totalRatedPages }}
                        </span>
                        <button 
                            @click="changePage('rated', 1)" 
                            :disabled="currentRatedPage === totalRatedPages"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronRight :size="14" />
                        </button>
                    </div>
                </div>
            </div>

            <div v-if="activeSection === 'staff'" class="space-y-6">
                <!-- PENDING STAFF -->
                <div v-if="subTab === 'pending'" class="space-y-6">
                    <div v-if="paginatedPendingStaffOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-none bg-white">
                        <ClipboardList :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                        <p class="text-xs text-gray-400 uppercase tracking-widest">Không tìm thấy hóa đơn chưa đánh giá nào.</p>
                    </div>

                    <div v-for="order in paginatedPendingStaffOrders" :key="order.id" class="border border-gray-200 rounded-none bg-white p-6 shadow-sm">
                        <div class="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                            <div>
                                <span class="text-[10px] uppercase tracking-widest text-gray-400">Nhân viên phục vụ đơn</span>
                                <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                            </div>
                            <button 
                                @click="order.show = !order.show"
                                class="border border-black px-4 py-1.5 text-[9px] font-bold tracking-widest uppercase transition-all hover:bg-black hover:text-white rounded-none cursor-pointer"
                            >
                                {{ order.show ? 'Thu gọn' : 'Đánh giá ngay' }}
                            </button>
                        </div>

                        <div v-if="order.show" class="space-y-6 animate-in fade-in duration-200">
                            <div v-for="staff in order.staffs" :key="staff.id" class="border border-gray-50 p-4 bg-gray-50/20 space-y-4">
                                <div class="flex items-center gap-3">
                                    <img v-if="staff.avatar" :src="API + staff.avatar" class="w-10 h-10 object-cover border border-gray-200 rounded-none" />
                                    <div v-else class="w-10 h-10 bg-gray-900 flex items-center justify-center text-white text-xs font-semibold rounded-none">👤</div>
                                    
                                    <div class="flex-1 min-w-0">
                                        <h5 class="text-xs font-semibold text-black uppercase tracking-wider truncate">{{ staff.name }}</h5>
                                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{{ staff.role }}</p>
                                    </div>

                                    <!-- Star rating -->
                                    <div class="flex gap-0.5">
                                        <button 
                                            v-for="n in 5" 
                                            :key="n"
                                            @click="staff.rating = n"
                                            type="button"
                                            class="transition-transform active:scale-95 cursor-pointer"
                                        >
                                            <Star 
                                                :size="16" 
                                                :fill="n <= staff.rating ? '#f59e0b' : 'none'"
                                                :stroke="n <= staff.rating ? '#f59e0b' : '#d1d5db'"
                                                :stroke-width="1.5"
                                            />
                                        </button>
                                    </div>
                                </div>

                                <textarea 
                                    v-model="staff.comment" 
                                    placeholder="Nhận xét về thái độ phục vụ và kỹ năng của nhân viên..."
                                    rows="2"
                                    class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-2.5 text-xs transition-all rounded-none text-black"
                                ></textarea>
                            </div>

                            <button 
                                @click="submitStaffAction(order)"
                                :disabled="isSubmitting"
                                class="w-full bg-black text-white py-3 text-[10px] uppercase tracking-widest font-semibold transition-all hover:bg-gray-900 active:scale-[0.99] disabled:opacity-40 rounded-none cursor-pointer"
                            >
                                {{ isSubmitting ? 'Đang gửi...' : 'Hoàn tất đánh giá nhân viên' }}
                            </button>
                        </div>
                    </div>

                    <!-- Pagination -->
                    <div v-if="totalPendingStaffPages > 1" class="flex justify-center items-center gap-4 pt-4">
                        <button 
                            @click="changePage('pendingStaff', -1)" 
                            :disabled="currentPendingStaffPage === 1"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronLeft :size="14" />
                        </button>
                        <span class="text-xs font-semibold tracking-wider text-gray-600">
                            {{ currentPendingStaffPage }} / {{ totalPendingStaffPages }}
                        </span>
                        <button 
                            @click="changePage('pendingStaff', 1)" 
                            :disabled="currentPendingStaffPage === totalPendingStaffPages"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronRight :size="14" />
                        </button>
                    </div>
                </div>

                <!-- COMPLETED STAFF -->
                <div v-else class="space-y-6">
                    <div v-if="paginatedRatedStaffOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-none bg-white">
                        <ClipboardList :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                        <p class="text-xs text-gray-400 uppercase tracking-widest">Chưa có lịch sử đánh giá nhân viên.</p>
                    </div>

                    <div v-for="order in paginatedRatedStaffOrders" :key="order.id" class="border border-gray-200 border-l-4 border-l-black rounded-none bg-white p-6 shadow-sm animate-in fade-in duration-300">
                        <div class="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                            <div>
                                <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng dịch vụ</span>
                                <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                            </div>
                            <div class="flex items-center gap-4">
                                <span class="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">{{ order.date }}</span>
                                <button 
                                    @click="deleteStaffRating(order.id)"
                                    class="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                    title="Xóa đánh giá nhân viên của đơn này"
                                >
                                    <Trash2 :size="14" />
                                </button>
                            </div>
                        </div>

                        <div class="space-y-6">
                            <div v-for="staff in order.staffs" :key="staff.id" class="border-b border-gray-50 pb-5 last:border-0 last:pb-0">
                                <div class="flex justify-between items-start gap-4">
                                    <div class="flex items-center gap-3">
                                        <img v-if="staff.avatar" :src="API + staff.avatar" class="w-10 h-10 object-cover border border-gray-100 rounded-none" />
                                        <div v-else class="w-10 h-10 bg-gray-900 flex items-center justify-center text-white text-xs font-semibold rounded-none">👤</div>
                                        <div>
                                            <h5 class="text-xs font-semibold text-black uppercase tracking-wider">{{ staff.name }}</h5>
                                            <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">{{ staff.role }}</p>
                                        </div>
                                    </div>

                                    <!-- Rating Score -->
                                    <div class="flex gap-0.5">
                                        <Star 
                                            v-for="n in 5" 
                                            :key="n"
                                            :size="12"
                                            :fill="n <= staff.rating ? '#f59e0b' : 'none'"
                                            :stroke="n <= staff.rating ? '#f59e0b' : '#d1d5db'"
                                            :stroke-width="1.5"
                                        />
                                    </div>
                                </div>

                                <p v-if="staff.comment" class="text-xs text-gray-600 font-light italic mt-3 leading-relaxed whitespace-pre-line">
                                    "{{ staff.comment }}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Pagination -->
                    <div v-if="totalRatedStaffPages > 1" class="flex justify-center items-center gap-4 pt-4">
                        <button 
                            @click="changePage('ratedStaff', -1)" 
                            :disabled="currentRatedStaffPage === 1"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronLeft :size="14" />
                        </button>
                        <span class="text-xs font-semibold tracking-wider text-gray-600">
                            {{ currentRatedStaffPage }} / {{ totalRatedStaffPages }}
                        </span>
                        <button 
                            @click="changePage('ratedStaff', 1)" 
                            :disabled="currentRatedStaffPage === totalRatedStaffPages"
                            class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer bg-white"
                        >
                            <ChevronRight :size="14" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Scoped variable settings for transition/fonts */
div {
    font-family: 'Inter', sans-serif;
}
</style>