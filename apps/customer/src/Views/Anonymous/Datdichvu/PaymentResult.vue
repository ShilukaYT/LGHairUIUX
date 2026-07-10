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

const lastBookingRef = ref(localStorage.getItem('last_booking_ref') || '');

const qrInvoiceValue = computed(() => {
    const maLd = lastBookingRef.value;
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
const payMode = ref('10');
const totalAmount = ref(0);
const remainingAmount = computed(() => {
    if (payMode.value === '100') return 0;
    return Math.max(0, totalAmount.value - amount.value);
});

const formatMoney = (money: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(money || 0));
};

onMounted(async () => {
    const vnpCode = route.query.vnp_ResponseCode;
    const momoCode = route.query.resultCode;

    // Gán lại số tiền từ URL
    if (route.query.vnp_Amount) amount.value = Number(route.query.vnp_Amount) / 100;
    else if (route.query.amount) amount.value = Number(route.query.amount);

    if (vnpCode === '00' || momoCode === '0') {
        const payModeVal = localStorage.getItem('current_pay_mode') || "10";
        payMode.value = payModeVal;
        totalAmount.value = Number(localStorage.getItem('total_bill_original') || 0);
        
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

        let invoiceInfo: any = null;
        try {
            const rawInvoice = localStorage.getItem('temp_invoice_info');
            if (rawInvoice) invoiceInfo = JSON.parse(rawInvoice);
        } catch {
            invoiceInfo = null;
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
            maCodes,
            invoiceInfo
        };

        try {
            // Gửi đầy đủ 2 tham số Query và Body
            const response = await axios.post(
                `${API}/api/DatDichVu/save-booking-final?paymentMode=${payModeVal}&maStylist=${stylistId}`,
                bookingRequest
            );
            console.log("Lưu DB thành công:", response.data);
            
            const returnedMaLd = response.data?.maLd || String(bookingRequest.bookingId);
            localStorage.setItem('last_booking_ref', returnedMaLd);
            lastBookingRef.value = returnedMaLd;
            
            // Xóa phần dịch vụ trong giỏ hàng sau khi lưu thành công
            const customer = getCustomerInfo();
            if (customer.maKH && customer.maKH !== 'GUEST') {
                await clearCartDB(customer.maKH, 'DICHVU');
                console.log("Dịch vụ trong giỏ hàng đã được dọn dẹp.");
            }
            isSuccess.value = true;
        } catch (err: any) {
            // Ép kiểu 'any' để TypeScript cho phép truy cập .response
            const errorMsg = err.response?.data || err.message || err;
            console.error("Lỗi lưu Database:", errorMsg);
            isSuccess.value = false;
        }
    } else {
        isSuccess.value = false;
    }
    isLoading.value = false;
});
const goToDetail = () => {
    router.push('/Xac-nhan-dich-vu');
};

const tryAgain = () => {
    router.push({ name: 'datdichvu' });
};
</script>

<template>
    <div class="result-page py-12 flex items-center justify-center min-h-[85vh]">
        <div class="container mx-auto px-4">
            <div class="flex justify-center">
                <div class="w-full max-w-lg">
                    <div v-if="isLoading" class="text-center py-10">
                        <i class="fas fa-circle-notch fa-spin fa-3x text-black mb-4"></i>
                        <p class="font-bold text-gray-500 uppercase tracking-widest text-xs">ĐANG XỬ LÝ GIAO DỊCH...</p>
                    </div>

                    <div v-else class="glass-card text-center" data-aos="zoom-in">
                        <div class="status-icon mb-5">
                            <div v-if="isSuccess" class="icon-wrapper success">
                                <i class="fas fa-check"></i>
                            </div>
                            <div v-else class="icon-wrapper failure">
                                <i class="fas fa-times"></i>
                            </div>
                        </div>

                        <h2 class="font-heading tracking-[0.2em] font-medium text-2xl lg:text-3xl mb-2 uppercase" :class="isSuccess ? 'text-black' : 'text-red-500'">
                            {{ isSuccess ? 'THANH TOÁN THÀNH CÔNG' : 'THANH TOÁN THẤT BẠI' }}
                        </h2>

                        <div v-if="isSuccess" class="qr-section my-6 p-4">
                            <p class="text-xs font-bold text-black mb-3 tracking-widest uppercase">Mã Hóa Đơn Điện Tử (QR)</p>
                            <div class="flex justify-center bg-white p-3 border border-dashed border-gray-300 max-w-[210px] mx-auto">
                                <qrcode-vue 
                                    :value="qrInvoiceValue" 
                                    :size="180" 
                                    level="H" 
                                    foreground="#111111" 
                                />
                            </div>
                            <p class="mt-3 mb-0 text-[11px] text-gray-400 font-bold uppercase tracking-wider">Quét mã để check-in nhanh tại quầy</p>
                        </div>
                        
                        <div class="accent-line mx-auto mb-6"></div>

                        <div class="transaction-details text-start p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Mã giao dịch:</span>
                                <span class="font-bold text-gray-900">{{ transactionNo || 'N/A' }}</span>
                            </div>
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Số tiền:</span>
                                <span class="font-bold text-[1.1rem]" :class="isSuccess ? 'text-black' : 'text-red-500'">{{ formatMoney(amount) }}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái:</span>
                                <span :class="isSuccess ? 'text-green-600' : 'text-red-500'" class="font-bold text-sm">
                                    {{ isSuccess ? 'Đã xác nhận' : 'Bị hủy/Lỗi' }}
                                </span>
                            </div>
                            <div v-if="isSuccess && payMode === '10' && remainingAmount > 0" class="flex justify-between items-center mt-3 pt-3 border-t border-dashed border-gray-200">
                                <span class="text-xs font-bold text-red-400 uppercase tracking-wider">Còn lại trả tại tiệm:</span>
                                <span class="font-bold text-red-600 text-[1.1rem]">{{ formatMoney(remainingAmount) }}</span>
                            </div>
                        </div>
                        <p class="text-sm text-gray-500 mb-6 leading-relaxed">
                            {{ isSuccess
                                ? 'Cảm ơn bạn đã tin tưởng LG Hair Salon. Vui lòng xem chi tiết lịch hẹn bên dưới.'
                                : 'Rất tiếc, giao dịch của bạn gặp sự cố. Vui lòng kiểm tra lại số dư tài khoản hoặc thử lại sau.'
                            }}
                        </p>

                        <div class="flex flex-col gap-3">
                            <button v-if="!isSuccess" @click="tryAgain" class="btn-try-again-outline w-full">
                                QUAY LẠI ĐẶT LỊCH
                            </button>
                            <button @click="router.push('/')" class="btn-confirm-metallic-final w-full">
                                VỀ TRANG CHỦ
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.result-page {
    --primary-color: #000000;
    --primary-hover: #1f2937;
    --primary-light: #fafafa;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #e5e7eb;

    background-color: #ffffff;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
}

/* Typography & Titles */
h2 {
    font-family: 'Montserrat', sans-serif !important;
}

.glass-card {
    background: #ffffff;
    padding: 40px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.02);
    max-width: 480px;
    margin: 0 auto;
    transition: all 0.3s ease;
}

.glass-card:hover {
    box-shadow: 0 15px 50px rgba(0, 0, 0, 0.05);
}

/* Status Icon Wrapper */
.status-icon {
    display: flex;
    justify-content: center;
}

.icon-wrapper {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
}

.icon-wrapper.success {
    background: #e2fbe9;
    color: #16a34a;
    box-shadow: 0 10px 25px rgba(22, 163, 74, 0.1);
}

.icon-wrapper.failure {
    background: #fde8e8;
    color: #ef4444;
    box-shadow: 0 10px 25px rgba(239, 68, 68, 0.1);
}

/* QR Code Section */
.qr-section {
    background: #fafafa;
    border: 1px solid var(--border-color);
    border-radius: 0px;
}

.accent-line {
    width: 60px;
    height: 1px;
    background: var(--primary-color);
    border-radius: 0px;
}

/* Transaction Details */
.transaction-details {
    background: #fafafa;
    border: 1px solid var(--border-color);
    border-left: 4px solid var(--primary-color);
    border-radius: 0px;
}

/* Buttons */
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

.btn-confirm-metallic-final:hover .btn-text-normal {
    color: var(--primary-color) !important;
}

.btn-text-normal {
    font-family: inherit !important;
    font-weight: 700 !important;
    font-size: 13px !important;
    color: #ffffff !important;
    letter-spacing: 2px !important;
    transition: color 0.3s ease;
}

.btn-try-again-outline {
    width: 100%;
    padding: 15px;
    border: 1px solid var(--primary-color);
    background: transparent;
    color: var(--primary-color);
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 700;
    font-size: 13px;
    border-radius: 0px;
    cursor: pointer;
    transition: all 0.3s ease;
}

.btn-try-again-outline:hover {
    background: var(--primary-color);
    color: #ffffff !important;
}

.secondary-home-btn {
    border-color: var(--border-color) !important;
    color: var(--text-secondary) !important;
}

.secondary-home-btn:hover {
    background: var(--primary-color) !important;
    border-color: var(--primary-color) !important;
    color: #ffffff !important;
}
</style>