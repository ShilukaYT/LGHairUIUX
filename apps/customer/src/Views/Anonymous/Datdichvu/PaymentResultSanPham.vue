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
                        
                        <div class="gold-accent-line mx-auto mb-4"></div>

                        <div class="transaction-details text-start p-3 bg-light rounded-3 mb-4">
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Mã đơn hàng:</span>
                                <span class="font-bold">{{ transactionNo || 'N/A' }}</span>
                            </div>
                            <div class="d-flex justify-content-between mb-2">
                                <span class="text-muted">Số tiền:</span>
                                <span class="font-bold text-success">{{ amount.toLocaleString() }}đ</span>
                            </div>
                            <div class="d-flex justify-content-between">
                                <span class="text-muted">Trạng thái:</span>
                                <span :class="isSuccess ? 'text-success' : 'text-danger'" class="font-bold">
                                    {{ isSuccess ? 'Đã thanh toán' : 'Bị hủy/Lỗi' }}
                                </span>
                            </div>
                        </div>

                        <p class="text-muted mb-4">
                            {{ isSuccess
                                ? 'Cảm ơn bạn đã mua sắm tại Minh Tâm Hair Salon. Đơn hàng của bạn đang được chuẩn bị và sẽ sớm được giao đến bạn.'
                                : 'Rất tiếc, giao dịch của bạn gặp sự cố. Vui lòng kiểm tra lại số dư tài khoản hoặc thử lại sau.'
                            }}
                        </p>

                        <button v-if="isSuccess" @click="goHome" class="btn-confirm-metallic-final w-100">
                            <span class="btn-text-normal">VỀ TRANG CHỦ</span>
                        </button>

                        <button v-else @click="goBack" class="btn btn-outline-dark rounded-pill px-5 py-3 w-100">
                            QUAY LẠI GIỎ HÀNG
                        </button>
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
import { clearProductCartDB, removeFromCartDB } from '@/Views/Anonymous/CSDL/cartDB';

const route = useRoute();
const router = useRouter();
const isSuccess = ref(false);
const isLoading = ref(true);
const API = import.meta.env.VITE_API_URL; 

const responseCode = route.query.vnp_ResponseCode;
const transactionNo = route.query.vnp_TxnRef || route.query.orderId;
const amount = ref(0);

onMounted(async () => {
    const vnpCode = route.query.vnp_ResponseCode;
    const momoCode = route.query.resultCode;

    // Gán lại số tiền từ URL
    if (route.query.vnp_Amount) amount.value = Number(route.query.vnp_Amount) / 100;
    else if (route.query.amount) amount.value = Number(route.query.amount);

    if (vnpCode === '00' || momoCode === '0') {
        isSuccess.value = true;
        
        // Cập nhật trạng thái thanh toán trên server nếu cần
        // Ở đây giả định backend đã xử lý IPN hoặc bạn có endpoint xác nhận
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
        await clearProductCartDB(customer?.maKH || 'GUEST');
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
.glass-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 25px;
    box-shadow: 0 15px 35px rgba(0, 0, 0, 0.08);
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
</style>
