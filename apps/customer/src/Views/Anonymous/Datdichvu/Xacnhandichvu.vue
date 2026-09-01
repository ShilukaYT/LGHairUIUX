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
const stylistName = ref(localStorage.getItem('temp_stylist_name') || 'LG Stylist');
const stylistImg = ref(localStorage.getItem('temp_stylist_img') || '');

// 2. DỮ LIỆU THANH TOÁN (Cọc 10% - Nợ 90%)
const selectedServices = ref<any[]>([]);
const selectedProducts = ref<any[]>([]);
const payMode = ref(localStorage.getItem('current_pay_mode') || '10');
const totalOriginal = ref(Number(localStorage.getItem('total_bill_original') || 0));

const receiveType = ref(localStorage.getItem('temp_receive_type') || 'store');
const shippingFee = ref(Number(localStorage.getItem('temp_shipping_fee') || 0));
const tempPayNow = ref<number | null>(null);
const tempRemainAtStore = ref<number | null>(null);
const deliveryInfo = ref<any>(null);

// Logic tính toán hiển thị
const amountPaid = computed(() => {
    if (tempPayNow.value !== null) return tempPayNow.value;
    return payMode.value === '10' ? totalOriginal.value * 0.1 : totalOriginal.value;
});

const remainingAmount = computed(() => {
    if (tempRemainAtStore.value !== null) return tempRemainAtStore.value;
    return totalOriginal.value - amountPaid.value;
});

onMounted(() => {
    const savedServices = localStorage.getItem('temp_services');
    if (savedServices) {
        selectedServices.value = JSON.parse(savedServices);
    }
    const savedProducts = localStorage.getItem('temp_products');
    if (savedProducts) {
        selectedProducts.value = JSON.parse(savedProducts);
    }
    const payNowVal = localStorage.getItem('temp_pay_now');
    if (payNowVal) {
        tempPayNow.value = Number(payNowVal);
    }
    const remainVal = localStorage.getItem('temp_remain_at_store');
    if (remainVal) {
        tempRemainAtStore.value = Number(remainVal);
    }
    const rawDelivery = localStorage.getItem('temp_delivery_info');
    if (rawDelivery) {
        try {
            deliveryInfo.value = JSON.parse(rawDelivery);
        } catch (e) {
            console.error(e);
        }
    }
});

// Định dạng tiền tệ
const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

// 3. HOÀN TẤT VÀ DỌN DẸP
const confirmBooking = () => {
    // Xóa các dữ liệu tạm sau khi khách đã xem xong hóa đơn
    const itemsToRemove = [
        'temp_services',
        'temp_products',
        'temp_date',
        'temp_stylist_name',
        'last_booking_ref',
        'current_pay_mode',
        'total_bill_original',
        'temp_stylist_img',
        'temp_receive_type',
        'temp_shipping_fee',
        'temp_pay_now',
        'temp_remain_at_store',
        'temp_delivery_info'
    ];
    itemsToRemove.forEach(item => localStorage.removeItem(item));

    alert("Xác nhận thành công! Hẹn gặp lại bạn tại LGHair.");
    router.push('/');
};
</script>

<template>
    <div class="confirm-page py-5 flex items-center justify-center min-h-[85vh]">
        <div class="container mx-auto px-4">
            <!-- Header confirmation -->
            <div class="text-center mb-5" data-aos="fade-down">
                <div class="status-icon mb-4">
                    <div class="success-icon">
                        <i class="fas fa-check"></i>
                    </div>
                </div>
                <h1 class="gold-metallic-text tracking-wide font-black text-3xl mb-2">XÁC NHẬN LỊCH HẸN</h1>
                <div class="gold-accent-line mx-auto"></div>
                <p class="font-bold text-gray-500 uppercase tracking-widest text-xs mt-3">
                    MÃ ĐƠN HÀNG: <span class="text-gray-900 font-extrabold">#{{ bookingId }}</span>
                </p>
            </div>

            <div class="row g-4 justify-content-center">
                <!-- Cột trái: Chi tiết dịch vụ & sản phẩm đã đặt -->
                <div class="col-lg-7" data-aos="fade-right">
                    <div class="glass-card h-100 flex flex-col gap-4">
                        <!-- Danh sách Dịch vụ -->
                        <div v-if="selectedServices.length > 0">
                            <h3 class="card-header-title text-gray-900 mb-3">
                                <i class="fas fa-cut me-2 text-[var(--gold-solid)]"></i>Dịch vụ đã đặt
                            </h3>

                            <div class="service-confirm-list mt-2">
                                <div v-for="s in selectedServices" :key="s.id" class="confirm-item-row">
                                    <div class="item-icon-circle">
                                        <i class="fas fa-check"></i>
                                    </div>
                                    <div class="item-info">
                                        <span class="service-name text-gray-900">{{ s.name }}</span>
                                        <div class="d-flex align-items-center mt-1">
                                            <span v-if="s.originalPrice && s.originalPrice > s.price"
                                                class="text-muted text-xs me-2 line-through">
                                                {{ formatMoney(s.originalPrice) }}
                                            </span>
                                            <span class="gold-solid-text font-bold text-sm">{{ formatMoney(s.price)
                                                }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Danh sách Sản phẩm -->
                        <div v-if="selectedProducts.length > 0"
                            :class="{ 'mt-4 pt-4 border-t border-[#f3f4f6]': selectedServices.length > 0 }">
                            <h3 class="card-header-title text-gray-900 mb-3">
                                <i class="fas fa-box-open me-2 text-[var(--gold-solid)]"></i>Sản phẩm đã mua
                            </h3>

                            <div class="product-confirm-list mt-2">
                                <div v-for="p in selectedProducts" :key="p.id" class="confirm-item-row">
                                    <div class="item-icon-circle">
                                        <i class="fas fa-shopping-bag"></i>
                                    </div>
                                    <div class="item-info">
                                        <span class="service-name text-gray-900">{{ p.tenItem || p.name }}</span>
                                        <div class="d-flex align-items-center justify-content-between mt-1">
                                            <span class="text-xs text-gray-500">Số lượng: {{ p.soLuong || p.quantity ||
                                                1 }}</span>
                                            <span class="gold-solid-text font-bold text-sm">{{ formatMoney((p.gia ||
                                                p.price || 0) * (p.soLuong || p.quantity || 1)) }}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Thông tin nhận sản phẩm -->
                        <div v-if="selectedProducts.length > 0"
                            class="mt-3 p-3 bg-[#fbfbfd] rounded-xl border border-dashed border-[#e5e7eb]">
                            <div v-if="receiveType === 'home' && deliveryInfo" class="delivery-summary">
                                <h5 class="text-xs font-bold text-gray-800 uppercase mb-2">
                                    <i class="fas fa-truck me-1 text-[var(--gold-solid)]"></i> Giao hàng tận nhà
                                </h5>
                                <p class="mb-1 text-xs text-gray-700"><b>Người nhận:</b> {{ deliveryInfo.hoTen }} ({{
                                    deliveryInfo.soDienThoai }})</p>
                                <p class="mb-0 text-xs text-gray-500"><b>Địa chỉ:</b> {{ deliveryInfo.diaChi }}</p>
                            </div>
                            <div v-else class="delivery-summary">
                                <h5 class="text-xs font-bold text-gray-800 uppercase mb-2">
                                    <i class="fas fa-store me-1 text-[var(--gold-solid)]"></i> Nhận tại cửa hàng
                                </h5>
                                <p class="mb-0 text-xs text-gray-500">Sản phẩm sẽ được chuẩn bị sẵn tại tiệm khi bạn đến
                                    thực hiện dịch vụ.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cột phải: Chi tiết thanh toán -->
                <div class="col-lg-5" data-aos="fade-left">
                    <div class="glass-card sticky-sidebar">
                        <h3 class="card-header-title text-gray-900">
                            <i class="fas fa-file-invoice-dollar me-2 text-[var(--gold-solid)]"></i>Chi tiết thanh toán
                        </h3>

                        <!-- Thông tin cơ bản -->
                        <div class="info-group mb-4">
                            <div class="summary-line">
                                <span class="label">Ngày hẹn:</span>
                                <span class="value">{{ bookingDate }}</span>
                            </div>
                            <div class="summary-line">
                                <span class="label">Khách hàng:</span>
                                <span class="value">{{ customerName }}</span>
                            </div>
                        </div>

                        <!-- Thẻ Stylist (Chỉ hiển thị nếu có đặt dịch vụ) -->
                        <div v-if="selectedServices.length > 0" class="stylist-horizontal-card mb-4">
                            <div v-if="stylistImg" class="avatar-wrapper">
                                <img :src="stylistImg" onerror="this.onerror=null; this.src='/images/no-image.png'"
                                    alt="Stylist">
                                <div class="verify-badge">
                                    <i class="fas fa-check"></i>
                                </div>
                            </div>
                            <div v-else class="avatar-placeholder-circle">
                                {{ stylistName.charAt(0).toUpperCase() }}
                            </div>

                            <div class="stylist-details">
                                <span class="role-badge">Stylist Đã Chọn</span>
                                <h4 class="stylist-name text-gray-900">{{ stylistName }}</h4>
                                <div class="stylist-rating text-amber-500">
                                    <i class="fas fa-star"></i>
                                    <i class="fas fa-star"></i>
                                    <i class="fas fa-star"></i>
                                    <i class="fas fa-star"></i>
                                    <i class="fas fa-star"></i>
                                </div>
                            </div>
                        </div>

                        <!-- Chi tiết hóa đơn -->
                        <div class="bill-summary border-t pt-4">
                            <div class="summary-line">
                                <span class="label">Tổng hóa đơn gốc:</span>
                                <span class="value text-gray-900">{{ formatMoney(totalOriginal) }}</span>
                            </div>

                            <div v-if="shippingFee > 0" class="summary-line">
                                <span class="label">Phí vận chuyển:</span>
                                <span class="value text-gray-900">+ {{ formatMoney(shippingFee) }}</span>
                            </div>

                            <div class="summary-line text-green-600">
                                <span class="label">Đã thanh toán ({{ payMode === '10' ? 'Cọc 10%' : '100%' }}):</span>
                                <span class="value font-bold">- {{ formatMoney(amountPaid) }}</span>
                            </div>

                            <div class="total-line-final mt-4 border-t border-dashed pt-4">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span class="total-lbl font-bold text-gray-900">Còn lại thanh toán:</span>
                                    <span class="total-val-standard text-red-600 font-extrabold">
                                        {{ formatMoney(remainingAmount) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div v-if="payMode === '10' && remainingAmount > 0" class="pay-now-alert mt-4">
                            <i class="fas fa-info-circle text-amber-500 fa-lg me-2"></i>
                            <span class="text-xs text-gray-600 font-medium">
                                Chi phí còn lại sẽ thanh toán tại Salon sau khi hoàn thành dịch vụ.
                            </span>
                        </div>

                        <button @click="confirmBooking" class="btn-confirm-metallic-final mt-4">
                            Xác nhận về trang chủ
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.confirm-page {
    --primary-metallic: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
    --primary-color: #000000;
    --primary-hover: #1f2937;
    --primary-light: #fafafa;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #e5e7eb;

    /* Aliases for template compatibility */
    --gold-solid: var(--primary-color);
    --gold-metallic: var(--primary-metallic);
    --gold-light: var(--primary-light);

    background-color: #ffffff;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
    min-height: 100vh;
}

/* Typography & Titles */
h1,
h2,
h3,
h4,
.card-header-title {
    font-family: 'Montserrat', sans-serif !important;
}

.gold-metallic-text {
    background: var(--primary-metallic);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
    font-weight: 800;
}

.gold-solid-text {
    color: var(--primary-color);
}

.gold-accent-line {
    width: 60px;
    height: 1px;
    background: var(--primary-color);
    margin: 15px auto;
    border-radius: 0px;
}

/* Status Confirmation Circle (Success Check) */
.status-icon {
    display: flex;
    justify-content: center;
}

.success-icon {
    width: 72px;
    height: 72px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #16a34a;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    box-shadow: 0 4px 20px rgba(22, 163, 74, 0.1);
}

/* Glass Card */
.glass-card {
    background: #ffffff;
    padding: 35px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03);
    transition: all 0.3s ease;
}

.card-header-title {
    font-weight: 700;
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 16px;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
}

/* Service Item Row */
.confirm-item-row {
    display: flex;
    align-items: center;
    padding: 16px;
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 0px;
    margin-bottom: 12px;
    transition: all 0.3s ease;
}

.confirm-item-row:hover {
    border-color: rgba(0, 0, 0, 0.2);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
}

.item-icon-circle {
    width: 32px;
    height: 32px;
    background: #f4f4f5;
    color: var(--primary-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 16px;
    font-size: 13px;
    border: 1px solid var(--border-color);
}

.item-info {
    flex: 1;
}

.service-name {
    font-size: 14px;
    font-weight: 700;
}

/* Info lines & details */
.summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 13px;
}

.summary-line .label {
    color: var(--text-secondary);
    font-weight: 500;
}

.summary-line .value {
    color: var(--text-primary);
    font-weight: 700;
}

/* Stylist Card */
.stylist-horizontal-card {
    display: flex;
    align-items: center;
    background: #fafafa;
    padding: 16px 20px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    border-left: 4px solid var(--primary-color);
}

.avatar-wrapper {
    position: relative;
    width: 54px;
    height: 54px;
    margin-right: 16px;
    flex-shrink: 0;
}

.avatar-wrapper img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.verify-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    background: var(--primary-color);
    color: #ffffff;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    border: 1.5px solid #ffffff;
}

.avatar-placeholder-circle {
    width: 54px;
    height: 54px;
    background: var(--primary-light);
    color: var(--primary-color);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 20px;
    margin-right: 16px;
    flex-shrink: 0;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.stylist-details {
    display: flex;
    flex-direction: column;
    text-align: left;
}

.role-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stylist-name {
    font-size: 14px;
    font-weight: 700;
    margin: 2px 0;
}

.stylist-rating {
    display: flex;
    gap: 2px;
    font-size: 11px;
}

/* Billing summary section */
.bill-summary {
    border-top: 1px solid var(--border-color);
}

.total-line-final {
    border-top: 1px dashed var(--border-color);
}

.total-lbl {
    font-size: 13px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.total-val-standard {
    font-size: 1.35rem;
}

.pay-now-alert {
    background: #fafafa;
    padding: 12px 16px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    display: flex;
    align-items: center;
}

/* Confirm Button */
.btn-confirm-metallic-final {
    width: 100%;
    padding: 16px;
    border: 1px solid var(--primary-color);
    border-radius: 0px;
    background: var(--primary-color);
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: none;
}

.btn-confirm-metallic-final:hover {
    background: transparent;
    color: var(--primary-color) !important;
    transform: translateY(-2px);
    box-shadow: none;
}

/* 9. CẤU TRÚC TRANG */
.sticky-sidebar {
    position: sticky;
    top: 100px;
}

@media (max-width: 991px) {
    .sticky-sidebar {
        position: static;
        margin-top: 24px;
    }
}
</style>