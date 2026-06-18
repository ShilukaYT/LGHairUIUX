<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

const router = useRouter();

// 1. LẤY THÔNG TIN TỪ LOCALSTORAGE
const bookingId = ref(localStorage.getItem('last_booking_ref') || 'N/A');
const customer = getCustomerInfo();
const customerName = ref(customer.hoTen || 'Khách hàng');
const bookingDate = ref(localStorage.getItem('temp_date') || 'Chưa chọn ngày');
const stylistName = ref(localStorage.getItem('temp_stylist_name') || 'Minh Tâm Stylist');

// 2. DỮ LIỆU THANH TOÁN (Cọc 10% - Nợ 90%)
const selectedServices = ref<any[]>([]);
const payMode = ref(localStorage.getItem('current_pay_mode') || '10');
const totalOriginal = ref(Number(localStorage.getItem('total_bill_original') || 0));

// Logic tính toán hiển thị
const amountPaid = computed(() => payMode.value === '10' ? totalOriginal.value * 0.1 : totalOriginal.value);
const remainingAmount = computed(() => totalOriginal.value - amountPaid.value);

onMounted(() => {
    const saved = localStorage.getItem('temp_services');
    if (saved) {
        selectedServices.value = JSON.parse(saved);
    }
});

// 3. HOÀN TẤT VÀ DỌN DẸP
const confirmBooking = () => {
    // Xóa các dữ liệu tạm sau khi khách đã xem xong hóa đơn
    const itemsToRemove = ['temp_services', 'temp_date', 'temp_stylist_name', 'last_booking_ref', 'current_pay_mode', 'total_bill_original'];
    itemsToRemove.forEach(item => localStorage.removeItem(item));

    alert("Xác nhận thành công! Hẹn gặp lại bạn tại Minh Tâm Hair.");
    router.push('/');
};
</script>

<template>
    <div class="booking-container py-5">
        <div class="container">
            <div class="text-center mb-5">
                <h1 class="gold-metallic-text fw-900 display-4">XÁC NHẬN LỊCH HẸN</h1>
                <div class="gold-accent-line mx-auto"></div>
                <p class="font-bold text-muted mt-3">
                    MÃ ĐƠN HÀNG: <span class="gold-solid-text">#{{ bookingId }}</span>
                </p>
            </div>

            <div class="row g-4 justify-content-center">
                <div class="col-lg-7">
                    <div class="glass-card p-4 h-100">
                        <h3 class="card-header-title gold-metallic-text">
                            <i class="fas fa-cut me-2"></i>DỊCH VỤ ĐÃ ĐẶT
                        </h3>
                        <div class="service-confirm-list">
                            <div v-for="s in selectedServices" :key="s.id" class="confirm-item-row">
                                <div class="item-icon-circle"><i class="fas fa-check"></i></div>
                                <div class="item-info">
                                    <span class="service-name">{{ s.name }}</span>
                                    <div class="d-flex align-items-center mt-1">
                                        <span v-if="s.originalPrice && s.originalPrice > s.price"
                                            class="text-muted me-2"
                                            style="text-decoration: line-through; font-size: 13px;">
                                            {{ s.originalPrice.toLocaleString() }}đ
                                        </span>
                                        <span class="gold-solid-text font-bold">{{ s.price.toLocaleString() }}đ</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="col-lg-5">
                    <div class="glass-card p-4 sticky-sidebar">
                        <h3 class="card-header-title gold-metallic-text">
                            <i class="fas fa-file-invoice-dollar me-2"></i>CHI TIẾT THANH TOÁN
                        </h3>

                        <div class="info-group mb-4">
                            <div class="summary-line">
                                <span class="text-muted">Ngày hẹn:</span>
                                <span class="font-bold">{{ bookingDate }}</span>
                            </div>
                            <div class="summary-line">
                                <span class="text-muted">Stylist:</span>
                                <span class="font-bold">{{ stylistName }}</span>
                            </div>
                        </div>

                        <div class="bill-summary border-top pt-4">
                            <div class="summary-line">
                                <span class="text-muted">Tổng hóa đơn gốc:</span>
                                <span class="font-bold">{{ totalOriginal.toLocaleString() }}đ</span>
                            </div>

                            <div class="summary-line text-success">
                                <span>Đã thanh toán ({{ payMode === '10' ? 'Cọc 10%' : '100%' }}):</span>
                                <span class="font-bold">- {{ amountPaid.toLocaleString() }}đ</span>
                            </div>

                            <div class="total-line-final mt-4 border-top pt-3">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="total-lbl font-bold">CÒN LẠI TẠI TIỆM:</span>
                                    <span class="total-val-standard text-danger">
                                        {{ remainingAmount.toLocaleString() }}đ
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div v-if="payMode === '10'" class="pay-now-alert mt-4">
                            <i class="fas fa-info-circle me-2 text-warning"></i>
                            <small class="font-bold text-dark">
                                Bạn còn <b>90% chi phí</b> cần trả sau khi làm xong tại Salon.
                            </small>
                        </div>

                        <button @click="confirmBooking" class="btn-confirm-metallic-final mt-4">
                            <span class="btn-text-normal">XÁC NHẬN VỀ TRANG CHỦ</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
/* Giao diện ánh kim và thẻ trắng */
.booking-container {
    background: #fff;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
}

.gold-metallic-text {
    background: #000000;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 800;
}

.glass-card {
    background: #fff;
    border-radius: 24px;
    padding: 30px;
    border: 1px solid #eee;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}

.confirm-item-row {
    display: flex;
    align-items: center;
    padding: 15px;
    background: #fafafa;
    border-radius: 15px;
    margin-bottom: 10px;
}

.total-val-standard {
    font-size: 1.8rem;
    font-weight: 900;
}

.summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
}

.btn-confirm-metallic-final {
    width: 100%;
    padding: 18px;
    border: none;
    border-radius: 50px;
    background: #000000;
    font-weight: 800;
    cursor: pointer;
}

.pay-now-alert {
    background: #f9fafb;
    padding: 15px;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
}

.gold-accent-line {
    width: 50px;
    height: 3px;
    background: #111111;
    margin: 10px auto;
}
</style>

<style scoped>
.glass-card {
    background: #ffffff;
    border-radius: 25px;
    border: 1px solid #f1f1f1;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.05);
}

.border-gold {
    border-color: #111111 !important;
}

.icon-circle-small {
    width: 30px;
    height: 30px;
    background: #f6ffed;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gold-accent-line {
    width: 60px;
    height: 4px;
    background: linear-gradient(to right, #111111, #374151);
    border-radius: 10px;
}

.btn-confirm-metallic-final {
    background: #000000;
    border: none;
    border-radius: 50px;
    transition: 0.4s ease;
    cursor: pointer;
}

.btn-confirm-metallic-final:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 25px rgba(184, 134, 11, 0.3);
}

.btn-text-normal {
    font-weight: 800;
    color: #fff;
    font-size: 1rem;
}
</style>

<style scoped>
/* 1. NHÚNG FONT INTER - CHUẨN HIỂN THỊ TIẾNG VIỆT HIỆN ĐẠI */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

.booking-container {
    background: #ffffff;
    min-height: 100vh;
    /* Áp dụng Inter cho toàn bộ trang để đồng bộ với ảnh mẫu */
    font-family: 'Inter', sans-serif !important;
    color: #333;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    line-height: 1.5;
}

/* 2. ĐỒNG BỘ CÁC CLASS FONT CŨ SANG INTER */
.font-playfair,
.font-poppins,
.card-header-title,
.btn-text-normal {
    font-family: 'Inter', sans-serif !important;
}

/* 3. HIỆU ỨNG CHỮ VÀNG ÁNH KIM (GOLD METALLIC) */
.gold-metallic-text {
    background: #000000;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
    font-weight: 800 !important;
    line-height: 1.2;
}

.gold-solid-text {
    color: #374151;
}

.gold-accent-line {
    width: 60px;
    height: 3px;
    background: #000000;
    margin: 15px auto;
    border-radius: 2px;
}

/* 4. GLASS-CARD (KHUNG CHỨA NỘI DUNG) */
.glass-card {
    background: #ffffff;
    padding: 35px;
    border-radius: 24px;
    border: 1px solid #f2f2f2;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.04);
}

.card-header-title {
    font-weight: 800 !important;
    font-size: 1.1rem;
    text-transform: uppercase;
    letter-spacing: -0.02em;
    border-bottom: 1px solid #f8f8f8;
    padding-bottom: 15px;
    margin-bottom: 25px;
    display: flex;
    align-items: center;
}

/* 5. CHI TIẾT DỊCH VỤ (SERVICE ITEMS) */
.confirm-item-row,
.service-item-glass {
    display: flex;
    align-items: center;
    padding: 18px;
    background: #fafafa;
    border-radius: 18px;
    margin-bottom: 12px;
    border: 1px solid #eee;
    transition: 0.3s ease;
}

.confirm-item-row:hover {
    background: #ffffff;
    border-color: #111111;
    transform: translateX(5px);
}

.item-icon-circle,
.icon-box {
    width: 45px;
    height: 45px;
    background: #f3f4f6;
    color: #374151;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 15px;
    font-size: 1.2rem;
}

.item-info,
.info-box {
    flex: 1;
    text-align: left;
}

.service-name,
.n {
    font-size: 16px;
    font-weight: 700 !important;
    /* Đậm giống ảnh mẫu bạn gửi */
    color: #111;
    display: block;
}

/* 6. THÔNG TIN STYLIST */
.stylist-confirmed-box,
/* --- PHẦN FIX KHOẢNG CÁCH STYLIST --- */

.stylist-horizontal-card {
    display: flex;
    align-items: center;
    background: #f9fafb;
    padding: 25px;
    /* Tăng padding tổng thể để các thành phần bên trong không chạm viền */
    border-radius: 20px;
    border: 1px solid #e5e7eb;
}

.avatar-wrapper {
    position: relative;
    width: 90px;
    height: 90px;
    flex-shrink: 0;
    /* Đảm bảo ảnh không bị bóp méo khi màn hình nhỏ */
}

/* Đây là lớp quan trọng nhất để đẩy chữ ra xa ảnh */
.stylist-details {
    margin-left: 15px !important;
    /* Tạo khoảng cách 25px giữa ảnh và chữ */
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 5px;
    /* Tạo khoảng cách nhỏ giữa Tên, Role và Stars */
}

.stylist-details h4 {
    font-size: 1.4rem;
    margin: 0;
    /* Xóa margin mặc định của thẻ h4 để kiểm soát bằng gap */
    line-height: 1.2;
    font-weight: 800 !important;
}

.role-badge {
    display: inline-block;
    width: fit-content;
    background: #f3f4f6;
    color: #374151;
    padding: 3px 12px;
    border-radius: 50px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.stylist-rating {
    display: flex;
    align-items: center;
    margin-top: 5px;
}

/* Fix khoảng cách cho icon sao */
.stylist-rating i {
    margin-right: 3px;
    font-size: 0.9rem;
}

.avatar-box img,
.avatar-wrapper img {
    width: 85px;
    height: 85px;
    border-radius: 50%;
    border: 3px solid #111111;
    padding: 3px;
    object-fit: cover;
}

.check-badge,
.verify-badge {
    position: absolute;
    bottom: 5px;
    right: 5px;
    background: #111111;
    color: #fff;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border: 2px solid #fff;
}

/* 7. HÓA ĐƠN & TÓM TẮT (BILLING) */
.summary-line,
.info-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 14px;
}

/* Màu đỏ Voucher đúng như ảnh mẫu bạn gửi */
.discount-red {
    color: #f44336 !important;
    font-weight: 800 !important;
}

.total-val-standard,
.total-amount {
    font-size: 1.8rem;
    font-weight: 900 !important;
    letter-spacing: -0.03em;
}

.pay-now-alert,
.pay-alert {
    background: #f6ffed;
    padding: 15px;
    border-radius: 15px;
    border: 1px solid #b7eb8f;
}

.text-success {
    color: #389e0d !important;
    font-weight: 800 !important;
}

/* 8. NÚT BẤM (BUTTONS) */
.btn-confirm-metallic-final,
.btn-main-gold {
    width: 100%;
    padding: 18px;
    border: none;
    border-radius: 50px;
    background: #000000;
    cursor: pointer;
    box-shadow: 0 6px 20px rgba(184, 134, 11, 0.2);
    transition: 0.3s;
}

.btn-confirm-metallic-final:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(184, 134, 11, 0.4);
}

.btn-text-normal, .btn-text {
    font-weight: 900 !important;
    font-size: 18px;
    text-transform: uppercase;
    color: #fff;
}

.btn-back-outline {
    width: 100%;
    padding: 14px;
    background: transparent;
    border: 1px solid #ddd;
    border-radius: 50px;
    color: #888;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
}

/* 9. CẤU TRÚC TRANG */
.sticky-bill,
.sticky-sidebar {
    position: sticky;
    top: 100px;
}

@media (max-width: 991px) {
    .sticky-bill {
        position: static;
        margin-top: 30px;
    }
}
</style>