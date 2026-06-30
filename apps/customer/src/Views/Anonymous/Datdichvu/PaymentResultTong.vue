<template>
    <div class="receipt-page py-5 flex items-center justify-center min-h-[85vh]">
        <div class="container mx-auto px-4">
            <div v-if="loading" class="text-center py-10">
                <i class="fas fa-spinner fa-spin fa-3x text-[var(--gold-solid)] mb-4"></i>
                <p class="font-bold text-gray-500 uppercase tracking-widest">Đang tải biên lai...</p>
            </div>

            <div v-else-if="receipt" class="receipt-container glass-card" data-aos="zoom-in">
                <div class="receipt-header text-center">
                    <div class="status-icon mb-4">
                        <div v-if="isSuccess" class="success-icon">
                            <i class="fas fa-check"></i>
                        </div>
                        <div v-else class="failure-icon">
                            <i class="fas fa-times"></i>
                        </div>
                    </div>
                    <h2 class="mt-3 font-playfair font-black text-3xl mb-2 tracking-wide" :class="isSuccess ? 'gold-metallic-text' : 'text-red-500'">
                        {{ isSuccess ? 'THANH TOÁN THÀNH CÔNG' : 'THANH TOÁN THẤT BẠI' }}
                    </h2>
                    <p class="text-sm text-gray-500">
                        {{ isSuccess ? 'Cảm ơn bạn đã sử dụng dịch vụ tại LG Hair' : 'Giao dịch của bạn đã bị hủy hoặc gặp sự cố.' }}
                    </p>
                    <div v-if="isSuccess && receipt.booking" class="alert alert-success mt-4 mb-4">
                        <i class="fas fa-envelope-open-text me-2"></i>
                        Hệ thống đã gửi mã QR xác nhận lịch hẹn vào email của bạn. Vui lòng kiểm tra hộp thư nhé!
                    </div>
                    
                    <div v-if="isSuccess" class="qr-section my-6 p-4">
                        <p class="text-xs font-bold text-amber-900/60 mb-3 tracking-widest uppercase">Mã Hóa Đơn Điện Tử (QR)</p>
                        <div class="flex justify-center bg-white p-3 rounded-xl border border-dashed border-[#bfa77a]/30 shadow-inner max-w-[210px] mx-auto">
                            <img :src="`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${receipt.maHd}`" alt="Mã QR Hóa Đơn" style="max-width: 150px; border-radius: 8px; display: block; margin: 0 auto;">
                        </div>
                        <p class="mt-3 mb-0 text-[11px] text-gray-400 font-bold uppercase tracking-wider">Sử dụng mã QR này khi đến tiệm</p>
                    </div>
                </div>

                <div class="receipt-section">
                    <div class="row-info">
                        <span class="label">Mã Hóa Đơn:</span>
                        <span class="value font-bold text-gray-900">{{ receipt.maHd }}</span>
                    </div>
                    <div class="row-info">
                        <span class="label">Thời gian:</span>
                        <span class="value text-gray-800">{{ receipt.ngayTao }}</span>
                    </div>
                    <div class="row-info">
                        <span class="label">Khách hàng:</span>
                        <span class="value text-gray-800">{{ receipt.khachHang }} - {{ receipt.sdt }}</span>
                    </div>
                </div>

                <div v-if="receipt.booking" class="receipt-section">
                    <h4 class="section-title"><i class="fas fa-cut me-2 text-[var(--gold-solid)]"></i>Chi Tiết Dịch Vụ</h4>
                    <div class="time-badge mb-3">Lịch hẹn: {{ receipt.booking.gioBatDau }} ngày {{ receipt.booking.ngayHen }}</div>
                    
                    <div v-for="(sv, index) in receipt.booking.services" :key="index" class="item-line">
                        <div class="item-name">
                            <b class="text-gray-900">{{ sv.name }}</b>
                            <small class="text-gray-400">Stylist: {{ sv.stylist }}</small>
                        </div>
                        <div class="item-price gold-solid-text">{{ formatMoney(sv.price) }}</div>
                    </div>
                </div>

                <div v-if="receipt.products && receipt.products.length > 0" class="receipt-section">
                    <h4 class="section-title"><i class="fas fa-box-open me-2 text-[var(--gold-solid)]"></i>Sản Phẩm Đã Mua</h4>
                    
                    <div v-for="(p, index) in receipt.products" :key="index" class="item-line">
                        <div class="item-name">
                            <b class="text-gray-900">{{ p.name }}</b>
                            <small class="text-gray-400">Số lượng: {{ p.qty }} x {{ formatMoney(p.price) }}</small>
                        </div>
                        <div class="item-price gold-solid-text">{{ formatMoney(p.total) }}</div>
                    </div>

                    <div v-if="receipt.delivery" class="delivery-box mt-3">
                        <b class="text-gray-800"><i class="fas fa-truck me-1 text-[var(--gold-solid)]"></i> Giao hàng tới:</b>
                        <p class="mb-0 text-gray-700 mt-1 font-bold">{{ receipt.delivery.nguoiNhan }} ({{ receipt.delivery.sdt }})</p>
                        <p class="mb-0 text-muted">{{ receipt.delivery.diaChi }}</p>
                        <p class="mb-0 mt-2 pt-2 border-t border-[#bfa77a]/15">Phí vận chuyển: <b class="gold-solid-text">{{ formatMoney(receipt.delivery.phiShip) }}</b></p>
                    </div>
                    <div class="delivery-box mt-3" v-else>
                        <b class="text-gray-800"><i class="fas fa-store me-1 text-[var(--gold-solid)]"></i> Nhận tại tiệm</b>
                        <p class="mb-0 text-gray-800 mt-1">Sản phẩm sẽ được chuẩn bị sẵn tại tiệm khi bạn đến làm dịch vụ.</p>
                    </div>
                </div>

                <div class="receipt-total">
                    <div class="total-line">
                        <span>Tạm tính:</span>
                        <span class="font-bold text-gray-900">{{ formatMoney(receipt.tongTien) }}</span>
                    </div>
                    <div class="total-line text-green-600" v-if="receipt.tongTien > receipt.thanhTien">
                        <span>Đã giảm giá:</span>
                        <span class="font-bold">-{{ formatMoney(receipt.tongTien - receipt.thanhTien) }}</span>
                    </div>
                    <div class="total-line grand-total mt-3 pt-3 border-t">
                        <span>Tổng Phải Trả:</span>
                        <span class="gold-text">{{ formatMoney(receipt.thanhTien) }}</span>
                    </div>
                    <div class="total-line mt-2">
                        <span>Tiền Đã Cọc / Thanh Toán:</span>
                        <span class="text-green-600 font-bold" style="font-size: 1.15rem;">{{ formatMoney(receipt.tienDaTra) }}</span>
                    </div>
                    <div class="total-line mt-2" v-if="receipt.thanhTien - receipt.tienDaTra > 0" style="color: #e53e3e; font-weight: 600;">
                        <span style="color: #e53e3e;">Còn lại trả tại tiệm:</span>
                        <span style="color: #e53e3e; font-weight: 700; font-size: 1.1rem;">{{ formatMoney(receipt.thanhTien - receipt.tienDaTra) }}</span>
                    </div>
                </div>

                <div class="text-center mt-6">
                    <button class="btn-confirm-metallic-final w-full" @click="router.push('/')">
                        VỀ TRANG CHỦ
                    </button>
                </div>
            </div>

            <div v-else class="glass-card text-center py-10">
                <i class="fas fa-exclamation-circle text-red-500 fa-3x mb-4"></i>
                <h3 class="font-playfair text-xl font-bold text-gray-800 mb-4">Không tìm thấy thông tin hóa đơn</h3>
                <button class="btn-try-again-outline w-full" @click="router.push('/')">Về Trang Chủ</button>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
    --gold-metallic: linear-gradient(135deg, #a88b58 0%, #bfa77a 50%, #d8c39e 100%);
    --gold-solid: #bfa77a;
    --gold-hover: #a88b58;
    --gold-light: #fbfaf7;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #f3f4f6;

    background-color: #fbfbfd;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
    min-height: 100vh;
}

/* Typography & Titles */
.font-playfair, h2, h3, h4, .section-title {
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

.gold-solid-text {
    color: var(--gold-solid);
}

.receipt-container {
    max-width: 550px;
    margin: 0 auto;
}

.glass-card {
    background: #ffffff;
    padding: 40px;
    border-radius: 20px;
    border: 1px solid rgba(229, 231, 235, 0.7);
    box-shadow: 0 10px 40px rgba(191, 167, 122, 0.04);
    transition: all 0.3s ease;
}

.glass-card:hover {
    box-shadow: 0 15px 50px rgba(191, 167, 122, 0.08);
}

.success-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    background: #e2fbe9;
    color: #16a34a;
    box-shadow: 0 10px 25px rgba(22, 163, 74, 0.15);
    margin: 0 auto;
}

.failure-icon {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    background: #fde8e8;
    color: #ef4444;
    box-shadow: 0 10px 25px rgba(239, 68, 68, 0.15);
    margin: 0 auto;
}

.status-icon {
    display: flex;
    justify-content: center;
}

.alert-success {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #15803d;
    border-radius: 12px;
    padding: 12px;
    font-size: 13px;
    line-height: 1.5;
}

/* QR Code Section */
.qr-section {
    background: #fdfaf3;
    border: 1px solid rgba(191, 167, 122, 0.15);
    border-radius: 16px;
}

.receipt-section {
    border-bottom: 2px dashed #eee;
    padding: 20px 0;
}

.row-info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
}

.row-info .label {
    color: var(--text-muted);
    font-weight: 500;
}

.row-info .value {
    color: var(--text-primary);
}

.section-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.time-badge {
    display: inline-block;
    background: #fdfaf3;
    color: var(--gold-solid);
    border: 1px solid rgba(191, 167, 122, 0.15);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.3px;
}

.item-line {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
}

.item-name b {
    display: block;
    font-size: 14px;
    color: var(--text-primary);
}

.item-name small {
    display: block;
    color: var(--text-muted);
    font-size: 12px;
    margin-top: 2px;
}

.item-price {
    font-weight: 700;
    font-size: 14px;
}

.delivery-box {
    background: #fdfaf3;
    border: 1px solid rgba(191, 167, 122, 0.15);
    padding: 16px;
    border-radius: 12px;
    font-size: 13px;
    border-left: 4px solid var(--gold-solid);
}

.receipt-total {
    padding-top: 20px;
}

.total-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
    color: var(--text-secondary);
}

.total-line span {
    font-weight: 500;
}

.grand-total {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    border-color: var(--border-color);
}

.gold-text {
    background: var(--gold-metallic);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    font-weight: 800;
}

/* Buttons */
.btn-confirm-metallic-final {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 8px;
    background: var(--gold-metallic);
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 14px rgba(191, 167, 122, 0.3);
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
    font-size: 13px;
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