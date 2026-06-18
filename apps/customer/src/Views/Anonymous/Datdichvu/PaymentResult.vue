<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { clearCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import QrcodeVue from 'qrcode.vue';
import axios from 'axios';

const route = useRoute();
const router = useRouter();
const isSuccess = ref(false);
const isLoading = ref(true);
const API = import.meta.env.VITE_API_URL; 

const qrInvoiceValue = computed(() => {
    const maLd = localStorage.getItem('last_booking_ref');
    if (!isSuccess.value || !maLd) return '';
    
    let cleanId = maLd.trim();
    // THỰC HIỆN CẮT 10 KÝ TỰ CUỐI GIỐNG BACKEND
    if (cleanId.length > 10) {
        cleanId = cleanId.substring(cleanId.length - 10);
    }
    
    return cleanId; 
});
const responseCode = route.query.vnp_ResponseCode;
const transactionNo = route.query.vnp_TransactionNo;
const amount = ref(0);

onMounted(async () => {
    const vnpCode = route.query.vnp_ResponseCode;
    const momoCode = route.query.resultCode;

    // Gán lại số tiền từ URL
    if (route.query.vnp_Amount) amount.value = Number(route.query.vnp_Amount) / 100;
    else if (route.query.amount) amount.value = Number(route.query.amount);

    if (vnpCode === '00' || momoCode === '0') {
        isSuccess.value = true;

        const payMode = localStorage.getItem('current_pay_mode') || "10";
        const stylistId = localStorage.getItem('temp_stylist_id'); // Đảm bảo Datdichvu.vue có lưu cái này

        const rawDate = localStorage.getItem('temp_date');
        let maCodes: string[] = [];
        try {
            const raw = localStorage.getItem('temp_vouchers');
            if (raw) {
                const parsed = JSON.parse(raw);
                maCodes = Array.isArray(parsed) ? parsed.filter((x: unknown) => typeof x === 'string') : [];
            }
        } catch {
            maCodes = [];
        }
        if (maCodes.length === 0) {
            const one = localStorage.getItem('temp_voucher');
            if (one) maCodes = [one];
        }

        const bookingRequest = {
            bookingId: String(route.query.vnp_TxnRef || route.query.orderId),
            maKh: getCustomerInfo().maKH || 'GUEST',
            
            // BỔ SUNG 3 DÒNG CỰC KỲ QUAN TRỌNG NÀY ĐỂ BACKEND NHẬN ĐƯỢC DATA
            hoTen: localStorage.getItem('temp_name') || '',
            phone: localStorage.getItem('temp_phone') || '',
            email: localStorage.getItem('temp_email') || '',

            ngayHen: rawDate ? new Date(rawDate).toISOString() : new Date().toISOString(),
            totalAmount: Number(localStorage.getItem('total_bill_original') || 0),
            services: JSON.parse(localStorage.getItem('temp_services') || '[]'),
            maCode: maCodes[0] || '',
            maCodes
        };

        try {
            // Gửi đầy đủ 2 tham số Query và Body
            const response = await axios.post(
                `${API}/api/DatDichVu/save-booking-final?paymentMode=${payMode}&maStylist=${stylistId}`,
                bookingRequest
            );
            console.log("Lưu DB thành công:", response.data);
            localStorage.setItem('last_booking_ref', String(bookingRequest.bookingId));
                // Xóa giỏ hàng sau khi lưu thành công
            const customer = getCustomerInfo();
            if (customer.maKH && customer.maKH !== 'GUEST') {
                await clearCartDB(customer.maKH);
                console.log("Giỏ hàng đã được dọn dẹp sạch sẽ.");
            }
        } catch (err: any) {
            // Ép kiểu 'any' để TypeScript cho phép truy cập .response
            const errorMsg = err.response?.data || err.message || err;
            console.error("Lỗi lưu Database:", errorMsg);
        }
    }
    isLoading.value = false;
});
const goToDetail = () => {
    router.push('/Xac-nhan-dich-vu');
};

const tryAgain = () => {
    router.push('/Dat-lich');
};
</script>
<template>
    <div class="result-page py-5 d-flex align-items-center" style="min-height: 80vh;">
        <div class="container">
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div v-if="isLoading" class="text-center">
                        <div class="spinner-border text-dark" role="status"></div>
                        <p class="mt-3 font-bold text-dark">ĐANG XỬ LÝ GIAO DỊCH...</p>
                    </div>

                    <div v-else class="glass-card text-center p-5" data-aos="zoom-in">
                        <div class="status-icon mb-4">
                            <i v-if="isSuccess" class="fas fa-check-circle text-success display-1"></i>
                            <i v-else class="fas fa-times-circle text-danger display-1"></i>
                        </div>

                        <h2 class="font-playfair fw-900 mb-2" :class="isSuccess ? 'gold-metallic-text' : 'text-danger'">
                            {{ isSuccess ? 'THANH TOÁN THÀNH CÔNG' : 'THANH TOÁN THẤT BẠI' }}
                        </h2>
                        <div v-if="isSuccess" class="qr-section my-4 p-3 border rounded-4 bg-white shadow-sm">
                            <p class="small font-bold text-muted mb-2 text-uppercase">Mã Hóa Đơn Điện Tử (QR)</p>
                            <div class="d-flex justify-content-center">
                                <qrcode-vue 
                                    :value="qrInvoiceValue" 
                                    :size="180" 
                                    level="H" 
                                    foreground="#111111" 
                                />
                            </div>
                            <p class="mt-2 mb-0 x-small text-muted">Quét mã để check-in nhanh tại quầy</p>
                        </div>
                        <div class="gold-accent-line mx-auto mb-4"></div>

                        <div class="transaction-details text-start p-3 bg-light rounded-3 mb-4">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Mã giao dịch:</span>
                                <span class="font-bold">{{ transactionNo || 'N/A' }}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Số tiền:</span>
                                <span class="font-bold text-success">{{ amount.toLocaleString() }}đ</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">Trạng thái:</span>
                                <span :class="isSuccess ? 'text-success' : 'text-danger'" class="font-bold">
                                    {{ isSuccess ? 'Đã xác nhận' : 'Bị hủy/Lỗi' }}
                                </span>
                            </div>
                        </div>

                        <p class="text-muted mb-4">
                            {{ isSuccess
                                ? 'Cảm ơn bạn đã tin tưởng Minh Tâm Hair Salon. Vui lòng xem chi tiết lịch hẹn bên dưới.'
                                : 'Rất tiếc, giao dịch của bạn gặp sự cố. Vui lòng kiểm tra lại số dư tài khoản hoặc thử lạisau.'
                            }}
                        </p>

                        <button v-if="isSuccess" @click="goToDetail" class="btn-confirm-metallic-final w-100">
                            <span class="btn-text-normal">XEM CHI TIẾT LỊCH HẸN</span>
                        </button>

                        <button v-else @click="tryAgain" class="btn btn-outline-dark rounded-pill px-5 py-3 w-100">
                            QUAY LẠI ĐẶT LỊCH
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.glass-card {
    background: #fff;
    border-radius: 25px;
    box-shadow: 0 15px 35px rgba(0,0,0,0.08);
    border: 1px solid rgba(0, 0, 0, 0.08);
}

.gold-accent-line {
    width: 60px;
    height: 3px;
    background: #111111;
}

.transaction-details {
    border-left: 4px solid #111111;
}

.gold-metallic-text {
    color: #111111;
    font-weight: 900;
    display: inline-block;
}

.btn-confirm-metallic-final {
    background: #000000;
    color: #fff;
    border: none;
    padding: 15px 30px;
    border-radius: 50px;
    font-weight: bold;
    letter-spacing: 1px;
    transition: all 0.3s ease;
}

.btn-confirm-metallic-final:hover {
    transform: translateY(-2px);
    background: #222222;
}

.border-gold { border: 2px solid #111111; }
.x-small { font-size: 0.7rem; }
</style>