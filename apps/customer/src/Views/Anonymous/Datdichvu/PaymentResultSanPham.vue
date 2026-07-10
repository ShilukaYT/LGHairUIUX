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

                        <div class="accent-line mx-auto mb-6"></div>

                        <div class="transaction-details text-start p-4 mb-6">
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Mã đơn hàng:</span>
                                <span class="font-bold text-gray-900">{{ transactionNo || 'N/A' }}</span>
                            </div>
                            <div class="flex justify-between items-center mb-3">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Số tiền:</span>
                                <span class="font-bold text-[1.1rem]" :class="isSuccess ? 'text-black' : 'text-red-500'">{{ formatMoney(amount) }}</span>
                            </div>
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold text-gray-400 uppercase tracking-wider">Trạng thái:</span>
                                <span :class="isSuccess ? 'text-green-600' : 'text-red-500'" class="font-bold text-sm">
                                    {{ isSuccess ? 'Đã thanh toán' : 'Bị hủy/Lỗi' }}
                                </span>
                            </div>
                        </div>

                        <p class="text-sm text-gray-500 mb-6 leading-relaxed">
                            {{ isSuccess
                                ? 'Cảm ơn bạn đã mua sắm tại LG Hair Salon. Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được giao đến bạn.'
                                : 'Rất tiếc, giao dịch của bạn gặp sự cố. Vui lòng kiểm tra lại số dư tài khoản hoặc thử lại sau.'
                            }}
                        </p>

                        <div class="flex flex-col gap-3">
                            <template v-if="isSuccess">
                                <button @click="goBack" class="btn-confirm-metallic-final w-full">
                                    <span class="btn-text-normal">TIẾP TỤC MUA SẮM</span>
                                </button>
                                <button @click="goHome" class="btn-try-again-outline w-full secondary-home-btn">
                                    VỀ TRANG CHỦ
                                </button>
                            </template>
                            <template v-else>
                                <button @click="goBack" class="btn-try-again-outline w-full">
                                    QUAY LẠI CỬA HÀNG
                                </button>
                                <button @click="goHome" class="btn-try-again-outline w-full secondary-home-btn">
                                    VỀ TRANG CHỦ
                                </button>
                            </template>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { clearCartDB, removeFromCartDB } from '@/Views/Anonymous/CSDL/cartDB';

const route = useRoute();
const router = useRouter();
const isSuccess = ref(false);
const isLoading = ref(true);
const API = import.meta.env.VITE_API_URL; 

const responseCode = route.query.vnp_ResponseCode;
const transactionNo = route.query.vnp_TxnRef || route.query.orderId;
const amount = ref(0);

const formatMoney = (money: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(money || 0));
};

onMounted(async () => {
    const vnpCode = route.query.vnp_ResponseCode;
    const momoCode = route.query.resultCode;
    const cod = route.query.cod;

    // Gán lại số tiền từ URL
    if (route.query.vnp_Amount) amount.value = Number(route.query.vnp_Amount) / 100;
    else if (route.query.amount) amount.value = Number(route.query.amount);

    if (vnpCode === '00' || momoCode === '0' || cod === 'true') {
        isSuccess.value = true;
        
        // Cập nhật trạng thái thanh toán trên server nếu là giao dịch online
        if (cod !== 'true') {
            try {
                await axios.get(`${API}/api/ThanhToanSanPham/confirm-payment`, {
                    params: {
                        orderId: transactionNo,
                        vnp_ResponseCode: vnpCode,
                        resultCode: momoCode
                    }
                });
            } catch (error) {
                console.error("Lỗi xác nhận thanh toán:", error);
            }
        }
    }
    
    // Xóa giỏ hàng local khi thanh toán online (nếu trước đó chưa xóa)
    if (isSuccess.value) {
        try {
            const checkoutRaw = localStorage.getItem("checkoutData");
            if (checkoutRaw) {
                const checkoutData = JSON.parse(checkoutRaw);
                if (checkoutData.sanPhamItems) {
                    for (const item of checkoutData.sanPhamItems) {
                        await removeFromCartDB(item.id);
                    }
                }
            }
        } catch(e) {
            console.error("Lỗi xóa db", e);
        }

        localStorage.removeItem("checkoutData");
        localStorage.removeItem("cartSP");
        const customer = getCustomerInfo();
        await clearCartDB(customer?.maKH || 'GUEST', 'BIENTHE');
    }
    
    isLoading.value = false;
});

const goHome = () => {
    router.push('/');
};

const goBack = () => {
    router.push('/product');
};
</script>

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
