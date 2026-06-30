<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';

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

// 1. TẢI DỮ LIỆU CHƯA ĐÁNH GIÁ (Pending)
const loadData = async () => {
    try {
        const user = getCustomerInfo();
        if (!user?.maKH || user.maKH === 'GUEST') return;

        const res = await axios.get(`https://localhost:7196/api/DanhGia/pending-to-rate/${user.maKH}`);

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
        const res = await axios.get(`https://localhost:7196/api/DanhGia/rated-history/${user.maKH}`);
        ratedOrders.value = res.data;

        const resStaff = await axios.get(`https://localhost:7196/api/DanhGia/staff-rated-history/${user.maKH}`);
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

        if (activeCount === 0) return alert("Vui lòng chọn số sao.");

        const res = await axios.post('https://localhost:7196/api/DanhGia/submit-multiple-reviews-with-image', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.status === 200) {
            alert('✨ Gửi đánh giá thành công!');
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
    if (!order.generalRating) return alert("Vui lòng chọn số sao.");

    try {
        isSubmitting.value = true;
        const formData = new FormData();
        formData.append('maHd', order.id);
        formData.append('generalRating', order.generalRating);
        formData.append('generalComment', order.generalComment || 'Đánh giá chung cho đơn hàng');
        if (order.generalImageFile) formData.append('hinhAnhFile', order.generalImageFile);

        const res = await axios.post('https://localhost:7196/api/DanhGia/submit-order-overall-with-image', formData);

        if (res.status === 200) {
            alert('✨ Cảm ơn bạn đã đánh giá chung đơn hàng!');
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        alert("Lỗi khi gửi đánh giá chung.");
    } finally {
        isSubmitting.value = false;
    }
};

// 5. GỬI ĐÁNH GIÁ NHÂN VIÊN
const submitStaffAction = async (order) => {
    if (isSubmitting.value) return;

    const ratedStaffs = order.staffs.filter(staff => staff.rating > 0);
    if (ratedStaffs.length === 0) return alert("Vui lòng chọn số sao cho ít nhất 1 nhân viên.");

    try {
        isSubmitting.value = true;
        const payload = ratedStaffs.map(staff => ({
            maHd: order.id,
            maNv: staff.id,
            soSao: staff.rating,
            noiDung: staff.comment || ''
        }));

        const res = await axios.post('https://localhost:7196/api/DanhGia/submit-staff-reviews', payload);

        if (res.status === 200) {
            alert('✨ Cảm ơn bạn đã đánh giá nhân viên!');
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        alert("Có lỗi xảy ra khi gửi đánh giá.");
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
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá này?")) return;

    try {
        const res = await axios.delete(`https://localhost:7196/api/DanhGia/delete-service-rating/${maHd}/${serviceId}`);
        if (res.status === 200) {
            alert("Đã xóa đánh giá!");
            // Gọi lại API, không tự chỉnh mảng bằng tay nữa
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        alert("Lỗi khi xóa.");
    }
};

const deleteFullOrder = async (maHd) => {
    if (!confirm("Xóa toàn bộ đánh giá của hóa đơn này?")) return;
    try {
        await axios.delete(`https://localhost:7196/api/DanhGia/delete-order-rating/${maHd}`);
        alert("Đã xóa toàn bộ đánh giá!");
        await loadData();
        await loadRatedData();
    } catch (error) {
        alert("Lỗi khi xóa.");
    }
};

const deleteStaffRating = async (maHd) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá nhân viên này?")) return;
    try {
        const res = await axios.delete(`https://localhost:7196/api/DanhGia/delete-staff-rating/${maHd}`);
        if (res.status === 200) {
            alert("Đã xóa đánh giá nhân viên!");
            await loadData();
            await loadRatedData();
        }
    } catch (error) {
        alert("Không thể xóa. Vui lòng kiểm tra lại.");
    }
};
</script>

<template>
    <div class="rating-page fade-in">
        <div class="page-header">
            <h1 class="page-title">Kho Đánh Giá</h1>
        </div>

        <div class="main-tabs">
            <button :class="{ active: activeSection === 'service' }" @click="activeSection = 'service'" class="tab-btn">
                Đánh giá Dịch vụ
            </button>
            <button :class="{ active: activeSection === 'staff' }" @click="activeSection = 'staff'" class="tab-btn">
                Đánh giá Nhân viên
            </button>
        </div>

        <div class="sub-tabs-container">
            <div class="sub-tabs">
                <button :class="{ active: subTab === 'pending' }" @click="changeSubTab('pending')">Chưa đánh
                    giá</button>
                <button :class="{ active: subTab === 'completed' }" @click="changeSubTab('completed')">Đã đánh
                    giá</button>
            </div>
        </div>

        <div class="toolbar-container fade-in">
            <div class="search-box">
                <i class="fa fa-search search-icon"></i>
                <input type="text" v-model="searchQuery" placeholder="Tìm mã đơn, tên dịch vụ / nhân viên..."
                    class="input-search" />
            </div>
            <div class="sort-box">
                <select v-model="sortOption" class="select-sort">
                    <option value="newest">Ngày tạo: Mới nhất trước</option>
                    <option value="oldest">Ngày tạo: Cũ nhất trước</option>
                </select>
            </div>
        </div>

        <div class="content-box">
            <div v-if="activeSection === 'service'" class="fade-in">

                <div v-if="subTab === 'pending'">
                    <div v-if="paginatedPendingOrders.length === 0" class="empty-state">
                        Không tìm thấy hóa đơn chưa đánh giá nào.
                    </div>

                    <div v-for="order in paginatedPendingOrders" :key="order.id" class="order-card">
                        <div class="order-meta">
                            <span>Mã đơn: <b>#{{ order.id }}</b></span>
                            <span>{{ new Date(order.date).toLocaleString('vi-VN', {
                                day: '2-digit', month: '2-digit',
                                year: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) }}</span>
                        </div>
                        <div class="order-body">
                            <p class="service-label"><b>Dịch vụ:</b> {{order.services.map(s => s.name).join(', ')}}</p>

                            <div class="mode-selector">
                                <button class="btn-toggle outline-gold" :class="{ active: order.viewMode === 'each' }"
                                    @click="toggleMode(order, 'each')">
                                    {{ order.viewMode === 'each' ? 'Đóng đánh giá' : 'Đánh giá từng dịch vụ' }}
                                </button>
                                <button class="btn-toggle outline-gold" :class="{ active: order.viewMode === 'all' }"
                                    @click="toggleMode(order, 'all')">
                                    {{ order.viewMode === 'all' ? 'Đóng đánh giá' : 'Đánh giá chung đơn hàng' }}
                                </button>
                            </div>

                            <div v-if="order.viewMode === 'each'" class="form-wrapper slide-in">
                                <div v-for="(s, idx) in order.services" :key="s.id" class="service-item-row">
                                    <div v-if="!s.isAlreadyRated">
                                        <div class="item-head">
                                            <span class="name">{{ idx + 1 }}. {{ s.name }}</span>
                                            <div class="stars">
                                                <span v-for="n in 5" :key="n" class="star"
                                                    :class="{ active: n <= s.rating }" @click="s.rating = n">★</span>
                                            </div>
                                        </div>
                                        <input type="text" v-model="s.comment" placeholder="Nhận xét cho dịch vụ này..."
                                            class="input-gold" />

                                        <div class="image-upload-wrapper">
                                            <label :for="'file-' + s.id" class="btn-upload-custom">
                                                <i class="fa fa-camera"></i> {{ s.imagePreview ? 'Đổi ảnh' : 'Thêm ảnh'
                                                }}
                                            </label>
                                            <input type="file" :id="'file-' + s.id"
                                                @change="handleFileChange($event, s)" accept="image/*" hidden />
                                            <div v-if="s.imagePreview" class="preview-container slide-in">
                                                <img :src="s.imagePreview" class="img-thumb" />
                                                <span class="btn-remove" @click="removeImage(s)">×</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button class="btn-submit-metallic" @click="submitAction(order)">Gửi đánh giá chi
                                    tiết</button>
                            </div>

                            <div v-if="order.viewMode === 'all'" class="form-wrapper slide-in">
                                <div class="rating-row-flex">
                                    <span>Độ hài lòng chung:</span>
                                    <div class="stars">
                                        <span v-for="n in 5" :key="n" class="star"
                                            :class="{ active: n <= order.generalRating }"
                                            @click="order.generalRating = n">★</span>
                                    </div>
                                </div>

                                <textarea v-model="order.generalComment"
                                    placeholder="Nhận xét chung cho các dịch vụ..."></textarea>

                                <div class="image-upload-wrapper">
                                    <label :for="'general-file-' + order.id" class="btn-upload-custom">
                                        <i class="fa fa-camera"></i> {{ order.generalImagePreview ? 'Đổi ảnh chung' :
                                            'Thêm ảnh chung' }}
                                    </label>
                                    <input type="file" :id="'general-file-' + order.id"
                                        @change="handleGeneralFileChange($event, order)" accept="image/*" hidden />
                                    <div v-if="order.generalImagePreview" class="preview-container">
                                        <img :src="order.generalImagePreview" class="img-thumb" />
                                        <span class="btn-remove"
                                            @click="order.generalImagePreview = null; order.generalImageFile = null">×</span>
                                    </div>
                                </div>

                                <button class="btn-submit-metallic" @click="submitOverallAction(order)">
                                    Gửi đánh giá chung (Tự động cộng dồn)
                                </button>
                            </div>
                        </div>
                    </div>
                    <div v-if="totalPendingPages > 1" class="pagination-wrapper">
                        <button class="btn-page" @click="changePage('pending', -1)"
                            :disabled="currentPendingPage === 1">❮ Trước</button>
                        <span class="page-info">Trang {{ currentPendingPage }} / {{ totalPendingPages }}</span>
                        <button class="btn-page" @click="changePage('pending', 1)"
                            :disabled="currentPendingPage === totalPendingPages">Sau ❯</button>
                    </div>
                </div>

                <div v-else class="rated-list">
                    <div v-if="paginatedRatedOrders.length === 0" class="empty-state">
                        Chưa có lịch sử đánh giá dịch vụ.
                    </div>

                    <div v-for="order in paginatedRatedOrders" :key="order.id" class="order-card rated-item fade-in">
                        <div class="order-meta-gold">
                            <span>Mã đơn: <b>#{{ order.id }}</b></span>
                            <div class="action-top">
                                <span class="mgr-10">{{ order.date }}</span>
                                <button class="btn-delete-all" @click="deleteFullOrder(order.id)">Xóa hết</button>
                            </div>
                        </div>

                        <div class="order-body">
                            <div v-for="(s, idx) in order.services" :key="idx" class="history-detail-row">
                                <div class="history-head">
                                    <span class="history-service-name">{{ s.name }}</span>
                                    <div class="flex-center">
                                        <div class="stars-mini mgr-10">
                                            <span v-for="n in 5" :key="n" class="star-small"
                                                :class="{ active: n <= s.rating }">★</span>
                                        </div>
                                        <button class="btn-delete-mini"
                                            @click="deleteSingleService(order.id, s.id)">×</button>
                                    </div>
                                </div>
                                <p class="history-comment" v-if="s.comment"><i class="fa fa-quote-left"></i> {{
                                    s.comment }}</p>
                                <div v-if="s.image" class="history-img-wrapper">
                                    <img :src="'https://localhost:7196' + s.image" class="img-history-thumb" />
                                </div>
                                <div v-if="s.reply" class="admin-reply-box slide-in">
                                    <div class="reply-header">
                                        <i class="fa fa-reply reply-icon"></i>
                                        <span class="reply-title">Phản hồi từ Minh Tâm Hair</span>
                                    </div>
                                    <p class="reply-content">{{ s.reply }}</p>
                                </div>
                                <hr v-if="idx < order.services.length - 1" class="history-divider">
                            </div>
                        </div>
                    </div>
                    <div v-if="totalRatedPages > 1" class="pagination-wrapper">
                        <button class="btn-page" @click="changePage('rated', -1)" :disabled="currentRatedPage === 1">❮
                            Trước</button>
                        <span class="page-info">Trang {{ currentRatedPage }} / {{ totalRatedPages }}</span>
                        <button class="btn-page" @click="changePage('rated', 1)"
                            :disabled="currentRatedPage === totalRatedPages">Sau ❯</button>
                    </div>
                </div>
            </div>

            <div v-if="activeSection === 'staff'" class="fade-in">

                <div v-if="subTab === 'pending'">
                    <div v-if="paginatedPendingStaffOrders.length === 0" class="empty-state">
                        Không tìm thấy hóa đơn chưa đánh giá nào.
                    </div>

                    <div v-for="order in paginatedPendingStaffOrders" :key="order.id" class="order-card">
                        <div class="order-meta">
                            <span>Nhân viên đơn <b>#{{ order.id }}</b></span>
                            <button class="btn-toggle-mini" @click="order.show = !order.show">
                                {{ order.show ? 'Thu gọn' : 'Mở đánh giá' }}
                            </button>
                        </div>
                        <div v-if="order.show" class="order-body slide-in">
                            <div v-for="staff in order.staffs" :key="staff.id" class="staff-item">
                                <div class="staff-info">
                                    <img v-if="staff.avatar" :src="'https://localhost:7196/' + staff.avatar"
                                        class="avatar-img-round" />
                                    <div v-else class="avatar-gold">👤</div>
                                    <div class="name-box">
                                        <span class="s-name">{{ staff.name }}</span> - <span class="s-role">{{
                                            staff.role }}</span>
                                    </div>
                                    <div class="stars">
                                        <span v-for="n in 5" :key="n" class="star"
                                            :class="{ active: n <= staff.rating }" @click="staff.rating = n">★</span>
                                    </div>
                                </div>
                                <textarea v-model="staff.comment" placeholder="Nhận xét thái độ phục vụ..."></textarea>
                            </div>
                            <button class="btn-submit-metallic" @click="submitStaffAction(order)">Hoàn tất đánh giá nhân
                                viên</button>
                        </div>
                    </div>
                    <div v-if="totalPendingStaffPages > 1" class="pagination-wrapper">
                        <button class="btn-page" @click="changePage('pendingStaff', -1)"
                            :disabled="currentPendingStaffPage === 1">❮ Trước</button>
                        <span class="page-info">Trang {{ currentPendingStaffPage }} / {{ totalPendingStaffPages
                        }}</span>
                        <button class="btn-page" @click="changePage('pendingStaff', 1)"
                            :disabled="currentPendingStaffPage === totalPendingStaffPages">Sau ❯</button>
                    </div>
                </div>

                <div v-else class="rated-list">
                    <div v-if="paginatedRatedStaffOrders.length === 0" class="empty-state">
                        Chưa có lịch sử đánh giá nhân viên.
                    </div>

                    <div v-for="order in paginatedRatedStaffOrders" :key="order.id"
                        class="order-card rated-item fade-in">
                        <div class="order-meta-gold">
                            <span>Mã đơn: <b>#{{ order.id }}</b></span>
                            <div class="action-top">
                                <span class="mgr-10">{{ order.date }}</span>
                                <button class="btn-delete-all" @click="deleteStaffRating(order.id)">Xóa</button>
                            </div>
                        </div>

                        <div class="order-body">
                            <div v-for="staff in order.staffs" :key="staff.id" class="staff-item">
                                <div class="staff-info">
                                    <img v-if="staff.avatar" :src="'https://localhost:7196' + staff.avatar"
                                        class="avatar-img-round" />
                                    <div v-else class="avatar-gold">👤</div>
                                    <div class="name-box">
                                        <span class="s-name">{{ staff.name }}</span> - <span class="s-role">{{
                                            staff.role }}</span>
                                    </div>
                                    <div class="stars-mini mgr-10" style="margin-left: auto;">
                                        <span v-for="n in 5" :key="n" class="star-small"
                                            :class="{ active: n <= staff.rating }">★</span>
                                    </div>
                                </div>
                                <p class="history-comment" v-if="staff.comment"><i class="fa fa-quote-left"></i> {{
                                    staff.comment }}</p>
                            </div>
                        </div>
                    </div>
                    <div v-if="totalRatedStaffPages > 1" class="pagination-wrapper">
                        <button class="btn-page" @click="changePage('ratedStaff', -1)"
                            :disabled="currentRatedStaffPage === 1">❮ Trước</button>
                        <span class="page-info">Trang {{ currentRatedStaffPage }} / {{ totalRatedStaffPages }}</span>
                        <button class="btn-page" @click="changePage('ratedStaff', 1)"
                            :disabled="currentRatedStaffPage === totalRatedStaffPages">Sau ❯</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* =========================================
   STYLE TOOLBAR (TÌM KIẾM & SẮP XẾP)
========================================= */
.toolbar-container {
    display: flex;
    gap: 15px;
    margin-bottom: 20px;
    background: #fffdfa;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #f1e4bc;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.05);
}

.search-box {
    flex: 2;
    position: relative;
}

.search-icon {
    position: absolute;
    left: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: #d4af37;
}

.input-search {
    width: 100%;
    padding: 12px 12px 12px 40px;
    border: 1px solid #eaddb6;
    border-radius: 8px;
    outline: none;
    transition: 0.3s;
    margin-top: 0;
}

.input-search:focus {
    border-color: #d4af37;
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
}

.sort-box {
    flex: 1;
}

.select-sort {
    width: 100%;
    padding: 12px;
    border: 1px solid #eaddb6;
    border-radius: 8px;
    outline: none;
    background: #fff;
    color: #333;
    cursor: pointer;
    font-weight: 500;
}

/* =========================================
   STYLE PHÂN TRANG 
========================================= */
.pagination-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 15px;
    margin-top: 25px;
    padding: 10px 0;
}

.btn-page {
    background: #fff;
    border: 1px solid #d4af37;
    color: #b8860b;
    padding: 8px 18px;
    border-radius: 20px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-page:hover:not(:disabled) {
    background: linear-gradient(135deg, #f1d592, #d4af37, #b8860b);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 4px 10px rgba(212, 175, 55, 0.3);
}

.btn-page:disabled {
    border-color: #eee;
    color: #aaa;
    cursor: not-allowed;
    background: #f9f9f9;
}

.page-info {
    font-weight: 700;
    color: #555;
    background: #fdfaf3;
    padding: 8px 15px;
    border-radius: 10px;
    border: 1px dashed #d4af37;
}

/* =========================================
   STYLE CŨ CỦA BẠN (Đã tối ưu avatar chữ dính)
========================================= */
.rating-page {
    width: 100%;
    font-family: sans-serif;
    padding: 24px;
    color: #1a1a1a;
    box-sizing: border-box;
}

.gold-metallic-text {
    background: linear-gradient(135deg, #f1d592, #d4af37, #b8860b);
    -webkit-text-fill-color: transparent;
    font-weight: 800;
}

.main-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}

.tab-btn {
    flex: 1;
    min-width: 140px;
    padding: 12px 16px;
    border: 1px solid #e5e5e5;
    background: #f9f9f9;
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    border-radius: 6px;
    color: #666;
    transition: 0.25s;
}

.tab-btn.active {
    background: #111;
    color: #fff;
    border-color: #111;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.sub-tabs-container {
    display: flex;
    justify-content: center;
    margin-bottom: 25px;
}

.sub-tabs {
    display: flex;
    background: #fdfaf3;
    padding: 4px;
    border-radius: 25px;
    border: 1px solid #f1e4bc;
}

.sub-tabs button {
    padding: 7px 22px;
    border: none;
    background: none;
    border-radius: 20px;
    font-weight: 600;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    color: #888;
    transition: 0.3s;
}

.sub-tabs button.active {
    background: #111;
    color: #fff;
}

.order-card {
    border: 1px solid #fdf5e6;
    border-radius: 16px;
    margin-bottom: 20px;
    box-shadow: 0 10px 30px rgba(184, 134, 11, 0.1);
    overflow: hidden;
    background: #fff;
}

.order-meta {
    padding: 12px 20px;
    background: #fffdf5;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #b8860b;
    border-bottom: 1px solid #f1e4bc;
}

.order-body {
    padding: 20px;
}

.mode-selector {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 10px 0;
}

.btn-toggle {
    padding: 10px;
    border-radius: 10px;
    font-weight: 700;
    cursor: pointer;
    transition: 0.3s;
    border: 1px solid #d4af37;
    background: #fff;
    color: #b8860b;
}

.btn-toggle.active {
    background: linear-gradient(135deg, #f1d592, #d4af37, #b8860b);
    color: #fff;
    border: none;
    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.4);
}

.btn-toggle-mini {
    background: none;
    border: 1px solid #d4af37;
    color: #b8860b;
    padding: 4px 12px;
    border-radius: 15px;
    cursor: pointer;
    font-size: 0.75rem;
    font-weight: 700;
}

.star {
    font-size: 1.8rem;
    color: #eee;
    cursor: pointer;
    transition: 0.2s;
}

.star.active {
    color: #d4af37;
    text-shadow: 0 0 10px rgba(212, 175, 55, 0.6);
}

input,
textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid #f1e4bc;
    border-radius: 8px;
    background: #fffdfa;
    outline: none;
    margin-top: 10px;
    font-family: inherit;
}

.btn-submit-metallic {
    width: 100%;
    padding: 16px;
    margin-top: 20px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #f1d592, #d4af37, #b8860b);
    color: #fff;
    font-weight: 800;
    cursor: pointer;
    box-shadow: 0 5px 20px rgba(212, 175, 55, 0.4);
}

.staff-item {
    padding: 15px 0;
    border-bottom: 1px dashed #f1e4bc;
}

.avatar-gold {
    width: 40px;
    height: 40px;
    background: #1a1a1a;
    color: #d4af37;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.slide-in {
    animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
    from {
        opacity: 0;
        transform: translateY(10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.image-upload-wrapper {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-top: 10px;
}

.btn-upload-custom {
    display: inline-block;
    padding: 8px 15px;
    background: #f8f9fa;
    border: 1px dashed #d4af37;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    color: #666;
}

.preview-container {
    position: relative;
    width: 70px;
    height: 70px;
    border: 1px solid #f1e4bc;
    border-radius: 4px;
    background: #fff;
    padding: 2px;
}

.img-thumb {
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: 2px;
}

.btn-remove {
    position: absolute;
    top: -8px;
    right: -8px;
    background: #ff4d4d;
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    text-align: center;
    line-height: 18px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
}

.rated-item {
    border-left: 5px solid #d4af37;
    background: #fff;
}

.empty-state {
    text-align: center;
    padding: 40px;
    color: #b8860b;
    font-style: italic;
    background: #fdfaf3;
    border-radius: 15px;
    border: 1px dashed #f1e4bc;
}

.order-meta-gold {
    background: #fdfaf3;
    padding: 10px 15px;
    border-bottom: 1px solid #f1e4bc;
    display: flex;
    justify-content: space-between;
    font-size: 0.9rem;
    color: #b8860b;
    font-weight: bold;
}

.history-detail-row {
    padding: 12px 0;
}

.history-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.history-service-name {
    font-weight: 700;
    color: #333;
}

.star-small {
    font-size: 1rem;
    color: #ddd;
}

.star-small.active {
    color: #d4af37;
}

.history-comment {
    margin: 8px 0;
    font-style: italic;
    color: #666;
    font-size: 0.95rem;
}

.img-history-thumb {
    max-width: 150px;
    border-radius: 8px;
    border: 1px solid #f1e4bc;
    margin-top: 5px;
}

.history-divider {
    border: 0;
    border-top: 1px dashed #f1e4bc;
    margin: 15px 0 5px 0;
}

.flex-center {
    display: flex;
    align-items: center;
}

.mgr-10 {
    margin-right: 10px;
}

.btn-delete-all {
    background: #ff4d4d;
    color: white;
    border: none;
    padding: 3px 10px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
}

.btn-delete-mini {
    background: #eee;
    color: #999;
    border: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    cursor: pointer;
    line-height: 18px;
    transition: 0.3s;
}

.btn-delete-mini:hover {
    background: #ff4d4d;
    color: white;
}

.history-img-wrapper {
    margin-top: 12px;
    border-radius: 8px;
    overflow: hidden;
    width: fit-content;
    border: 1px solid #f1e4bc;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.img-history-thumb {
    max-width: 180px;
    max-height: 130px;
    display: block;
    object-fit: cover;
    transition: 0.3s;
}

.img-history-thumb:hover {
    transform: scale(1.05);
}

.history-comment {
    margin: 10px 0;
    font-style: italic;
    color: #555;
    font-size: 0.92rem;
    line-height: 1.5;
    padding-left: 10px;
    border-left: 3px solid #d4af37;
}

.history-divider {
    border: 0;
    border-top: 1px dashed #f1e4bc;
    margin: 15px 0 5px 0;
}

.service-rated-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 15px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    margin-bottom: 10px;
    color: #166534;
}

.badge-status {
    font-size: 0.85rem;
    font-weight: bold;
}

.service-rated-badge .name {
    text-decoration: line-through;
    opacity: 0.6;
}

/* CSS để không dính chữ Avatar */
.staff-info {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
    gap: 10px;
}

.name-box {
    display: flex;
    flex-direction: column;
}

.s-name {
    font-weight: bold;
    font-size: 1.05rem;
    color: #333;
}

.s-role {
    font-size: 0.85rem;
    color: #888;
    margin-top: 2px;
}

.avatar-img-round {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #d4af37;
}
</style>