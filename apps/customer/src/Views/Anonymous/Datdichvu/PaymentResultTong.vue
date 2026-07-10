<template>
    <div class="receipt-page py-12 flex items-center justify-center min-h-[90vh]">
        <div class="container mx-auto px-4">
            
            <!-- Loading State -->
            <div v-if="loading" class="text-center py-20">
                <div class="loading-spinner mb-4 animate-spin text-[var(--gold-solid)]">
                    <i class="fas fa-circle-notch fa-3x"></i>
                </div>
                <p class="font-bold text-gray-500 uppercase tracking-widest text-xs">Đang tải biên lai thanh toán...</p>
            </div>

            <!-- Error State: Not Found -->
            <div v-else-if="!receipt" class="error-card glass-card text-center max-w-md mx-auto p-8" data-aos="zoom-in">
                <div class="error-icon-wrapper mb-5">
                    <i class="fas fa-exclamation-triangle text-red-500 fa-3x animate-bounce"></i>
                </div>
                <h3 class="font-playfair text-xl font-bold text-gray-800 mb-2">KHÔNG TÌM THẤY BIÊN LAI</h3>
                <p class="text-sm text-gray-500 mb-6">Thông tin giao dịch của bạn không tồn tại hoặc đã hết hạn truy cập.</p>
                <button class="btn-try-again-outline w-full" @click="router.push('/')">QUAY LẠI TRANG CHỦ</button>
            </div>

            <!-- Receipt Detail State -->
            <div v-else class="receipt-ticket-wrapper max-w-lg mx-auto" data-aos="zoom-in">
                
                <!-- Main Ticket -->
                <div class="receipt-ticket">
                    
                    <!-- Ticket Header -->
                    <div class="ticket-header text-center pt-8 pb-6">
                        <div class="status-badge mb-4">
                            <div v-if="isSuccess" class="status-icon success-bg shadow-sm">
                                <i class="fas fa-check"></i>
                            </div>
                            <div v-else class="status-icon failure-bg shadow-sm">
                                <i class="fas fa-times"></i>
                            </div>
                        </div>
                        
                        <h2 class="font-playfair text-2xl font-black mb-1.5 tracking-wide" :class="isSuccess ? 'gold-metallic-text' : 'text-red-500'">
                            {{ isSuccess ? 'THANH TOÁN THÀNH CÔNG' : 'THANH TOÁN THẤT BẠI' }}
                        </h2>
                        
                        <p class="text-xs text-gray-500 px-6">
                            {{ isSuccess ? 'Cảm ơn bạn đã lựa chọn LG Hair. Mã đặt lịch/hóa đơn đã được gửi qua Email.' : 'Giao dịch của bạn đã bị hủy hoặc gặp lỗi hệ thống.' }}
                        </p>

                        <!-- Alert box for success Email -->
                        <div v-if="isSuccess && receipt.booking" class="email-alert mt-4 mx-6">
                            <i class="fas fa-envelope-open-text mr-2 text-[var(--gold-solid)]"></i>
                            <span>Lịch hẹn và mã QR đã được gửi về email của bạn!</span>
                        </div>
                    </div>

                    <!-- QR Code (Success case only) -->
                    <div v-if="isSuccess" class="qr-wrapper py-6 border-t border-b border-dashed border-gray-200">
                        <div class="qr-card">
                            <div class="qr-label">MÃ BIÊN LAI ĐIỆN TỬ (QR)</div>
                            <div class="qr-code-box">
                                <qrcode-vue 
                                    :value="receipt.maHd" 
                                    :size="150" 
                                    level="H" 
                                    foreground="#1f2937" 
                                />
                            </div>
                            <div class="qr-sub">Đưa mã QR này cho nhân viên để check-in tại quầy</div>
                        </div>
                    </div>

                    <!-- Ticket Middle Notches -->
                    <div class="ticket-notches">
                        <div class="notch notch-left"></div>
                        <div class="notch notch-right"></div>
                    </div>

                    <!-- Ticket Details Section -->
                    <div class="ticket-body px-8 py-6">
                        <div class="detail-section">
                            <h4 class="detail-title"><i class="fas fa-info-circle mr-2"></i>Thông tin chung</h4>
                            <div class="detail-row">
                                <span class="lbl">Mã hóa đơn:</span>
                                <span class="val font-mono font-bold text-gray-900">{{ receipt.maHd }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="lbl">Thời gian lập:</span>
                                <span class="val text-gray-800">{{ receipt.ngayTao }}</span>
                            </div>
                            <div class="detail-row">
                                <span class="lbl">Khách hàng:</span>
                                <span class="val text-gray-800">{{ receipt.khachHang }} ({{ receipt.sdt }})</span>
                            </div>
                        </div>

                        <!-- Services Detail -->
                        <div v-if="receipt.booking" class="detail-section mt-6 pt-6 border-t border-gray-100">
                            <h4 class="detail-title"><i class="fas fa-cut mr-2"></i>Dịch vụ đã đặt</h4>
                            <div class="booking-time-badge mb-4">
                                <i class="far fa-calendar-alt mr-2"></i>Lịch hẹn: {{ receipt.booking.gioBatDau }} - {{ receipt.booking.ngayHen }}
                            </div>
                            
                            <div class="item-list">
                                <div v-for="(sv, index) in receipt.booking.services" :key="index" class="item-row">
                                    <div class="item-main">
                                        <span class="item-name font-bold text-gray-900">{{ sv.name }}</span>
                                        <span class="item-sub text-gray-400">Stylist: <span class="text-gray-600 font-semibold">{{ sv.stylist }}</span></span>
                                    </div>
                                    <span class="item-price text-gray-900 font-bold">{{ formatMoney(sv.price) }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Products Detail -->
                        <div v-if="receipt.products && receipt.products.length > 0" class="detail-section mt-6 pt-6 border-t border-gray-100">
                            <h4 class="detail-title"><i class="fas fa-shopping-bag mr-2"></i>Sản phẩm mua kèm</h4>
                            
                            <div class="item-list">
                                <div v-for="(p, index) in receipt.products" :key="index" class="item-row">
                                    <div class="item-main">
                                        <span class="item-name font-bold text-gray-900">{{ p.name }}</span>
                                        <span class="item-sub text-gray-400">Số lượng: {{ p.qty }} × {{ formatMoney(p.price) }}</span>
                                    </div>
                                    <span class="item-price text-gray-900 font-bold">{{ formatMoney(p.total) }}</span>
                                </div>
                            </div>

                            <!-- Delivery Box -->
                            <div v-if="receipt.delivery" class="shipping-info-box mt-4">
                                <div class="box-header"><i class="fas fa-shipping-fast mr-2"></i>GIAO HÀNG TẬN NHÀ</div>
                                <div class="box-body">
                                    <div class="info-line"><span class="lbl-sh">Người nhận:</span><span class="val-sh font-bold">{{ receipt.delivery.nguoiNhan }}</span></div>
                                    <div class="info-line"><span class="lbl-sh">Điện thoại:</span><span class="val-sh">{{ receipt.delivery.sdt }}</span></div>
                                    <div class="info-line"><span class="lbl-sh">Địa chỉ nhận:</span><span class="val-sh text-gray-500">{{ receipt.delivery.diaChi }}</span></div>
                                    <div class="info-line fee-line pt-2 mt-2 border-t border-dashed">
                                        <span class="lbl-sh">Phí vận chuyển:</span>
                                        <span class="val-sh font-bold text-[var(--gold-solid)]">{{ formatMoney(receipt.delivery.phiShip) }}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Receive Store Box -->
                            <div v-else class="shipping-info-box receive-store mt-4">
                                <div class="box-header"><i class="fas fa-store mr-2"></i>NHẬN TRỰC TIẾP TẠI TIỆM</div>
                                <div class="box-body">
                                    <p class="mb-0 text-gray-500">Sản phẩm của bạn đã được đóng gói sẵn và lưu tại quầy. Vui lòng nhận khi đến làm dịch vụ.</p>
                                </div>
                            </div>
                        </div>

                        <!-- Payment totals section -->
                        <div class="detail-section totals-section mt-6 pt-6 border-t-2 border-dashed border-gray-200">
                            <div class="total-row-item">
                                <span class="lbl-tot">Tạm tính:</span>
                                <span class="val-tot text-gray-800">{{ formatMoney(receipt.tongTien) }}</span>
                            </div>
                            <div class="total-row-item discount-text" v-if="receipt.tongTien > receipt.thanhTien">
                                <span class="lbl-tot">Ưu đãi giảm giá:</span>
                                <span class="val-tot">-{{ formatMoney(receipt.tongTien - receipt.thanhTien) }}</span>
                            </div>
                            <div class="total-row-item grand-line pt-4 mt-3 border-t">
                                <span class="lbl-grand">TỔNG CỘNG BILL:</span>
                                <span class="val-grand gold-metallic-text font-black">{{ formatMoney(receipt.thanhTien) }}</span>
                            </div>
                            <div class="total-row-item pt-2">
                                <span class="lbl-tot text-green-700">Số tiền đã cọc/trả:</span>
                                <span class="val-tot text-green-700 font-extrabold text-lg">{{ formatMoney(receipt.tienDaTra) }}</span>
                            </div>
                            <div class="total-row-item alert-due pt-3 mt-3 px-4 py-3 rounded-lg bg-red-50 border border-red-100 flex justify-between" v-if="receipt.thanhTien - receipt.tienDaTra > 0">
                                <span class="lbl-due"><i class="fas fa-coins mr-1.5"></i>Còn lại trả tại quầy:</span>
                                <span class="val-due font-black text-red-600">{{ formatMoney(receipt.thanhTien - receipt.tienDaTra) }}</span>
                            </div>
                        </div>

                    </div>
                </div>

                <!-- Ticket Action Buttons -->
                <div class="ticket-actions mt-8 flex flex-col sm:flex-row gap-4">
                    <button v-if="receipt.booking" class="btn-view-booking flex-1" @click="router.push('/Xac-nhan-dich-vu')">
                        <i class="far fa-calendar-check mr-2"></i>XEM LỊCH HẸN
                    </button>
                    <button class="btn-confirm-metallic-final flex-1" @click="router.push('/')">
                        <i class="fas fa-home mr-2"></i>VỀ TRANG CHỦ
                    </button>
                </div>
            </div>

        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QrcodeVue from 'qrcode.vue';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const receipt = ref(null);
const loading = ref(true);
const isSuccess = ref(true);
const API = import.meta.env.VITE_API_URL;

const formatMoney = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

onMounted(async () => {
    const maHd = route.query.vnp_TxnRef || route.query.maHd || route.query.orderId;
    const vnpCode = route.query.vnp_ResponseCode;
    const momoCode = route.query.resultCode;

    if ((vnpCode && vnpCode !== '00') || (momoCode && momoCode !== '0')) {
        isSuccess.value = false;
    }

    if (maHd) {
        try {
            const res = await axios.get(`${API}/api/ThanhToanTong/get-receipt`, {
                params: { 
                    maHd: maHd, 
                    vnp_ResponseCode: vnpCode,
                    resultCode: momoCode 
                }
            });
            if (res.data.success) {
                receipt.value = res.data.data;
            }
        } catch (error) {
            console.error("Lỗi tải hóa đơn:", error);
        }
    }
    loading.value = false;
});
</script>

<style scoped>
.receipt-page {
    --gold-metallic: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
    --gold-solid: #000000;
    --gold-hover: #1f2937;
    --gold-light: #fafafa;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #e5e7eb;

    background-color: #fafafa;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
}

/* Typography & Titles */
.font-playfair, h2, h3, h4, .detail-title {
    font-family: 'Montserrat', sans-serif !important;
}

.gold-metallic-text {
    background: var(--gold-metallic);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
    font-weight: 800;
}

/* Status Icon Styles */
.status-badge {
    display: flex;
    justify-content: center;
}

.status-icon {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    transition: all 0.3s ease;
}

.success-bg {
    background: #ecfdf5;
    color: #10b981;
    border: 1px solid #d1fae5;
}

.failure-bg {
    background: #fef2f2;
    color: #ef4444;
    border: 1px solid #fee2e2;
}

/* Email alert */
.email-alert {
    background: #f0fdf4;
    border: 1px solid #dcfce7;
    color: #15803d;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    border-radius: 30px;
    display: inline-flex;
    align-items: center;
}

/* Ticket Styling */
.receipt-ticket {
    background: #ffffff;
    border: 1px solid #f0f0f0;
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.02);
    position: relative;
    overflow: visible;
}

/* Ticket Middle Notches */
.ticket-notches {
    position: relative;
    height: 20px;
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: transparent;
}

.ticket-notches::before {
    content: '';
    position: absolute;
    left: 16px;
    right: 16px;
    height: 1px;
    border-top: 2px dashed #f0f0f0;
    z-index: 1;
}

.notch {
    width: 20px;
    height: 20px;
    background: #fafafa;
    border-radius: 50%;
    position: absolute;
    z-index: 2;
    border: 1px solid #f0f0f0;
}

.notch-left {
    left: -10px;
}

.notch-right {
    right: -10px;
}

/* QR Code Section */
.qr-wrapper {
    display: flex;
    justify-content: center;
    background: #ffffff;
}

.qr-card {
    text-align: center;
    background: #fafafa;
    border: 1px solid #e5e7eb;
    padding: 20px;
    border-radius: 16px;
    max-width: 280px;
    width: 100%;
}

.qr-label {
    font-size: 10px;
    font-weight: 700;
    color: #111827;
    letter-spacing: 1.5px;
    margin-bottom: 12px;
}

.qr-code-box {
    background: #ffffff;
    padding: 12px;
    border-radius: 12px;
    display: inline-block;
    box-shadow: inset 0 2px 8px rgba(0,0,0,0.03);
    border: 1px solid #e5e7eb;
}

.qr-sub {
    font-size: 10px;
    color: #9ca3af;
    margin-top: 12px;
    font-weight: 500;
    line-height: 1.4;
}

/* Details Section */
.detail-section {
    display: flex;
    flex-direction: column;
}

.detail-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
}

.detail-title i {
    color: var(--gold-solid);
}

.detail-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 13px;
}

.detail-row .lbl {
    color: var(--text-muted);
}

.detail-row .val {
    color: var(--text-primary);
}

.booking-time-badge {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    color: #111827;
    padding: 8px 16px;
    border-radius: 30px;
    font-size: 12px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    width: fit-content;
}

/* Item Rows inside lists */
.item-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.item-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}

.item-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
}

.item-name {
    font-size: 13px;
    color: var(--text-primary);
    line-height: 1.4;
}

.item-sub {
    font-size: 11px;
    color: var(--text-muted);
}

.item-price {
    font-size: 13px;
    color: var(--text-primary);
}

/* Shipping Info Box */
.shipping-info-box {
    background: #fafafa;
    border: 1px solid #e5e7eb;
    border-left: 4px solid var(--gold-solid);
    border-radius: 8px;
    padding: 16px;
}

.shipping-info-box.receive-store {
    border-left-color: #6b7280;
    background: #fafafa;
    border-color: #f3f3f3;
}

.box-header {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 1px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
}

.box-body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
}

.info-line {
    display: flex;
    justify-content: space-between;
}

.info-line .lbl-sh {
    color: var(--text-muted);
}

.info-line .val-sh {
    color: var(--text-primary);
}

/* Totals styling */
.total-row-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-bottom: 8px;
    color: var(--text-secondary);
}

.total-row-item.discount-text {
    color: #10b981;
}

.total-row-item.grand-line {
    border-color: #e5e7eb;
}

.lbl-grand {
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.5px;
}

.val-grand {
    font-size: 1.35rem;
    font-weight: 800;
}

.alert-due {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.lbl-due {
    font-size: 12px;
    font-weight: 700;
    color: #b91c1c;
    text-transform: uppercase;
}

.val-due {
    font-size: 1.15rem;
    font-weight: 800;
}

/* Action buttons */
.btn-view-booking {
    padding: 16px;
    border: 1px solid #111827;
    background: transparent;
    color: #111827;
    font-weight: 700;
    font-size: 12px;
    border-radius: 8px;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all 0.3s ease;
}

.btn-view-booking:hover {
    background: #111827;
    color: #ffffff;
}

.btn-confirm-metallic-final {
    padding: 16px;
    border: none;
    border-radius: 8px;
    background: var(--gold-metallic);
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    font-weight: 700;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
}

.btn-confirm-metallic-final:hover {
    background: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.btn-try-again-outline {
    width: 100%;
    padding: 15px;
    border: 1px solid var(--gold-solid);
    background: transparent;
    color: var(--gold-solid);
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    font-size: 12px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-try-again-outline:hover {
    background: var(--gold-light);
    color: var(--gold-hover);
    border-color: var(--gold-hover);
}
</style>