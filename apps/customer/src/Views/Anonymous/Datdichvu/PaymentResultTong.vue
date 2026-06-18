<template>
    <div class="receipt-page">
        <div v-if="loading" class="text-center py-5">
            <i class="fas fa-spinner fa-spin fa-3x text-dark"></i>
            <p class="mt-3 font-bold">Đang tải biên lai...</p>
        </div>

        <div v-else-if="receipt" class="receipt-container">
            <div class="receipt-header text-center">
                <div class="success-icon"><i class="fas fa-check"></i></div>
                <h2 class="mt-3 font-bold text-success">THANH TOÁN THÀNH CÔNG</h2>
                <p class="text-muted">Cảm ơn bạn đã sử dụng dịch vụ tại Minh Tâm Hair</p>
                <div v-if="receipt.booking" class="alert alert-success mt-3" style="border-radius: 12px; font-size: 14px;">
                    <i class="fas fa-envelope-open-text me-2"></i>
                    Hệ thống đã gửi mã QR xác nhận lịch hẹn vào email của bạn. Vui lòng kiểm tra hộp thư nhé!
                </div>
                
                <div class="mt-3 d-flex flex-column align-items-center justify-content-center">
                    <img :src="`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${receipt.maHd}`" alt="Mã QR Hóa Đơn" style="max-width: 150px; border: 2px solid #111111; border-radius: 8px; padding: 5px; background: white; margin: 0 auto; display: block;">
                    <p class="mt-2 font-bold text-muted text-center" style="font-size: 13px;">Sử dụng mã QR này khi đến tiệm</p>
                </div>
            </div>

            <div class="receipt-section">
                <div class="row-info">
                    <span class="label">Mã Hóa Đơn:</span>
                    <span class="value font-bold">{{ receipt.maHd }}</span>
                </div>
                <div class="row-info">
                    <span class="label">Thời gian:</span>
                    <span class="value">{{ receipt.ngayTao }}</span>
                </div>
                <div class="row-info">
                    <span class="label">Khách hàng:</span>
                    <span class="value">{{ receipt.khachHang }} - {{ receipt.sdt }}</span>
                </div>
            </div>

            <div v-if="receipt.booking" class="receipt-section">
                <h4 class="section-title"><i class="fas fa-cut me-2"></i>Chi Tiết Dịch Vụ</h4>
                <div class="time-badge mb-3">Lịch hẹn: {{ receipt.booking.gioBatDau }} ngày {{ receipt.booking.ngayHen }}</div>
                
                <div v-for="(sv, index) in receipt.booking.services" :key="index" class="item-line">
                    <div class="item-name">
                        <b>{{ sv.name }}</b>
                        <small>Stylist: {{ sv.stylist }}</small>
                    </div>
                    <div class="item-price">{{ formatMoney(sv.price) }}</div>
                </div>
            </div>

            <div v-if="receipt.products && receipt.products.length > 0" class="receipt-section">
                <h4 class="section-title"><i class="fas fa-box-open me-2"></i>Sản Phẩm Đã Mua</h4>
                
                <div v-for="(p, index) in receipt.products" :key="index" class="item-line">
                    <div class="item-name">
                        <b>{{ p.name }}</b>
                        <small>Số lượng: {{ p.qty }} x {{ formatMoney(p.price) }}</small>
                    </div>
                    <div class="item-price">{{ formatMoney(p.total) }}</div>
                </div>

                <div v-if="receipt.delivery" class="delivery-box mt-3">
                    <b><i class="fas fa-truck me-1"></i> Giao hàng tới:</b>
                    <p class="mb-0">{{ receipt.delivery.nguoiNhan }} ({{ receipt.delivery.sdt }})</p>
                    <p class="mb-0 text-muted">{{ receipt.delivery.diaChi }}</p>
                    <p class="mb-0 mt-1">Phí vận chuyển: <b>{{ formatMoney(receipt.delivery.phiShip) }}</b></p>
                </div>
                <div class="delivery-box mt-3" v-else>
                    <b><i class="fas fa-store me-1"></i> Nhận tại tiệm</b>
                </div>
            </div>

            <div class="receipt-total">
                <div class="total-line">
                    <span>Tổng cộng:</span>
                    <span>{{ formatMoney(receipt.tongTien) }}</span>
                </div>
                <div class="total-line text-success" v-if="receipt.tongTien > receipt.thanhTien">
                    <span>Đã giảm giá:</span>
                    <span>-{{ formatMoney(receipt.tongTien - receipt.thanhTien) }}</span>
                </div>
                <div class="total-line grand-total mt-2 pt-2 border-top">
                    <span>Tổng Phải Trả:</span>
                    <span class="gold-text">{{ formatMoney(receipt.thanhTien) }}</span>
                </div>
                <div class="total-line mt-2">
                    <span>Tiền Đã Cọc / Thanh Toán:</span>
                    <span class="text-primary font-bold">{{ formatMoney(receipt.tienDaTra) }}</span>
                </div>
            </div>

            <div class="text-center mt-4">
                <button class="btn btn-outline-dark me-3" @click="router.push('/')">Về Trang Chủ</button>
            </div>
        </div>

        <div v-else class="text-center py-5">
            <h3 class="text-danger">Không tìm thấy thông tin hóa đơn</h3>
            <button class="btn btn-dark mt-3" @click="router.push('/')">Về Trang Chủ</button>
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
const API = import.meta.env.VITE_API_URL;

const formatMoney = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

onMounted(async () => {
    // VNPay sẽ trả mã hóa đơn vào param vnp_TxnRef, mã lỗi vào vnp_ResponseCode
    const maHd = route.query.vnp_TxnRef || route.query.maHd;
    const vnpCode = route.query.vnp_ResponseCode;

    if (maHd) {
        try {
            const res = await axios.get(`${API}/api/ThanhToanTong/get-receipt`, {
                params: { maHd: maHd, vnp_ResponseCode: vnpCode }
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
.receipt-page { min-height: 100vh; background: #f4f6f8; padding: 40px 15px; font-family: 'Inter', sans-serif; }
.receipt-container { max-width: 550px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 30px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); }
.success-icon { width: 60px; height: 60px; background: #28a745; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 0 auto; box-shadow: 0 5px 15px rgba(40, 167, 69, 0.3); }
.receipt-section { border-bottom: 2px dashed #eee; padding: 20px 0; }
.row-info { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
.row-info .label { color: #666; }
.section-title { font-size: 16px; font-weight: 700; color: #111111; margin-bottom: 15px; text-transform: uppercase; }
.time-badge { display: inline-block; background: #f3f4f6; color: #1f2937; padding: 5px 12px; border-radius: 20px; font-size: 13px; font-weight: 600; }
.item-line { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
.item-name b { display: block; font-size: 15px; color: #222; }
.item-name small { color: #888; font-size: 13px; }
.item-price { font-weight: 700; color: #333; }
.delivery-box { background: #fafafa; padding: 12px; border-radius: 8px; font-size: 13px; border-left: 3px solid #111111; }
.receipt-total { padding-top: 20px; }
.total-line { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 15px; }
.grand-total { font-size: 20px; font-weight: 800; }
.gold-text { color: #111111; font-weight: bold; }
</style>