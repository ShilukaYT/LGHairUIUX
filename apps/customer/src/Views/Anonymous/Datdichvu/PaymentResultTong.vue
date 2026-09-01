<template>
    <div class="w-full bg-[#f8f9fa] py-6 md:py-8 text-neutral-800 font-sans">
        <div class="max-w-6xl w-full mx-auto px-4 sm:px-6">

            <!-- Loading State -->
            <div v-if="loading"
                class="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-neutral-200/80 shadow-2xs text-center">
                <div class="w-10 h-10 border-2 border-neutral-200 border-t-black rounded-full animate-spin mb-4"></div>
                <p class="font-heading text-xs uppercase tracking-widest text-neutral-500 font-medium">Đang tải biên lai
                    thanh toán...</p>
            </div>

            <!-- Error State: Not Found -->
            <div v-else-if="!receipt"
                class="max-w-md mx-auto bg-white rounded-2xl border border-neutral-200/80 shadow-2xs text-center p-8">
                <div
                    class="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4 text-amber-600">
                    <AlertTriangle :size="28" />
                </div>
                <h2 class="font-heading text-xl font-bold text-neutral-900 mb-2">KHÔNG TÌM THẤY BIÊN LAI</h2>
                <p class="text-xs text-neutral-500 mb-6 leading-relaxed">Thông tin giao dịch của bạn không tồn tại hoặc
                    đã hết hạn truy cập.</p>
                <button
                    class="w-full py-3 bg-black hover:bg-neutral-800 text-white rounded-lg text-xs uppercase tracking-wider font-semibold transition-all cursor-pointer"
                    @click="router.push('/')">
                    Quay Lại Trang Chủ
                </button>
            </div>

            <!-- 2-COLUMN WIDE HORIZONTAL MASTER LAYOUT (CÂN ĐỐI - ĐẦY ĐẶN - RÕ NÉT) -->
            <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch" data-aos="fade-up">

                <!-- ========================================================================= -->
                <!-- CỘT TRÁI (5/12 Cột): TRẠNG THÁI + QR CHECK-IN + THÔNG TIN TIỀN BẠC + NÚT -->
                <!-- ========================================================================= -->
                <div class="lg:col-span-5 flex flex-col justify-between space-y-5">

                    <!-- Card 1: Trạng thái & Mã QR Check-in -->
                    <div
                        class="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-6 sm:p-7 relative overflow-hidden">

                        <!-- Top status header -->
                        <div class="flex items-center gap-3.5 pb-4 border-b border-neutral-100">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center transition-all shrink-0 shadow-2xs"
                                :class="isSuccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'">
                                <Check v-if="isSuccess" :size="24" :stroke-width="2.5" />
                                <X v-else :size="24" :stroke-width="2.5" />
                            </div>
                            <div class="min-w-0 flex-1">
                                <h1 class="text-lg sm:text-xl font-heading font-extrabold uppercase tracking-wider leading-tight m-0"
                                    :class="isSuccess ? 'text-neutral-900' : 'text-rose-600'">
                                    {{ isSuccess ? 'Thanh Toán Thành Công' : 'Thanh Toán Thất Bại' }}
                                </h1>
                                <div class="flex items-center gap-2 mt-1">
                                    <span
                                        class="text-xs font-mono font-bold text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">#{{
                                        receipt.maHd }}</span>
                                    <span class="text-xs text-neutral-400">• {{ receipt.ngayTao }}</span>
                                </div>
                            </div>
                        </div>

                        <!-- QR Code Box (To rõ, đầy đặn) -->
                        <div v-if="isSuccess"
                            class="mt-4 p-4 bg-neutral-50/90 rounded-xl border border-neutral-200/80 flex items-center gap-4 text-left">
                            <div class="shrink-0 p-2 bg-white rounded-xl border border-neutral-200 shadow-2xs">
                                <qrcode-vue :value="receipt.maHd" :size="105" level="H" foreground="#171717"
                                    class="mx-auto" />
                            </div>
                            <div class="flex-1 min-w-0 space-y-1.5">
                                <div class="text-xs font-heading uppercase tracking-wider font-bold text-neutral-900">
                                    Mã QR Check-in Quầy
                                </div>
                                <p class="text-xs text-neutral-600 leading-snug m-0">
                                    Đưa mã này cho nhân viên lễ tân khi đến salon để nhận diện lịch hẹn ngay
                                </p>
                                <div v-if="receipt.booking"
                                    class="pt-0.5 flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                                    <Mail :size="13" class="text-emerald-600 shrink-0" />
                                    <span>Đã gửi thông báo về email</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Card 2: Thông tin biên lai & Chi tiết tiền -->
                    <div
                        class="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-6 sm:p-7 space-y-4 flex-1 flex flex-col justify-between">

                        <div class="space-y-4">
                            <!-- Tiêu đề & Ngày tạo -->
                            <div
                                class="text-xs sm:text-sm font-heading uppercase tracking-wider font-bold text-neutral-900 pb-2.5 border-b border-neutral-100 flex items-center justify-between">
                                <span>Chi Tiết Thanh Toán</span>
                                <span class="text-xs font-normal text-neutral-400">{{ receipt.ngayTao }}</span>
                            </div>

                            <!-- Khách hàng -->
                            <div class="text-xs sm:text-sm flex items-center justify-between">
                                <span class="text-neutral-500">Khách hàng:</span>
                                <span class="text-neutral-900 font-bold text-sm">{{ receipt.khachHang }} <span
                                        v-if="receipt.sdt" class="font-medium text-neutral-500 text-xs">({{ receipt.sdt
                                        }})</span></span>
                            </div>

                            <!-- Bảng kê tiền -->
                            <div class="space-y-2 text-xs sm:text-sm pt-3 border-t border-dashed border-neutral-200">
                                <div class="flex items-center justify-between text-neutral-600">
                                    <span>Tạm tính dịch vụ & SP:</span>
                                    <span class="font-semibold text-neutral-900">{{ formatMoney(receipt.tongTien)
                                        }}</span>
                                </div>

                                <div v-if="receipt.tongTien > receipt.thanhTien"
                                    class="flex items-center justify-between text-emerald-600">
                                    <span>Ưu đãi & Voucher giảm:</span>
                                    <span class="font-bold">-{{ formatMoney(receipt.tongTien - receipt.thanhTien)
                                        }}</span>
                                </div>

                                <div class="pt-2 border-t border-neutral-100 flex items-baseline justify-between">
                                    <span class="text-xs font-bold text-neutral-900 uppercase tracking-wide">Tổng Hóa
                                        Đơn:</span>
                                    <span class="text-base sm:text-lg font-black text-neutral-950">{{
                                        formatMoney(receipt.thanhTien) }}</span>
                                </div>

                                <!-- Phương thức thanh toán -->
                                <div class="flex items-center justify-between text-neutral-600 text-xs sm:text-sm">
                                    <span>Phương thức:</span>
                                    <span class="font-bold text-neutral-800 uppercase">
                                        {{ receipt.phuongThucThanhToan || (receipt.tienDaTra > 0 ? 'Chuyển Khoản Online'
                                        : 'Thanh Toán Tại Quầy / COD') }}
                                    </span>
                                </div>

                                <div class="flex items-center justify-between text-emerald-700">
                                    <span class="font-semibold">Số tiền đã cọc/trả:</span>
                                    <span class="text-sm sm:text-base font-extrabold">{{ formatMoney(receipt.tienDaTra)
                                        }}</span>
                                </div>

                                <!-- Cảnh báo tiền còn lại -->
                                <div v-if="receipt.thanhTien - receipt.tienDaTra > 0"
                                    class="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-amber-900 text-xs sm:text-sm">
                                    <span class="font-bold flex items-center gap-1.5">
                                        <Coins :size="15" class="text-amber-600 shrink-0" />
                                        Còn lại trả tại tiệm:
                                    </span>
                                    <span class="text-sm sm:text-base font-black text-amber-950">
                                        {{ formatMoney(receipt.thanhTien - receipt.tienDaTra) }}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Cụm nút hành động -->
                        <div class="pt-4 border-t border-neutral-100 flex gap-3">
                            <button v-if="receipt.booking"
                                class="flex-1 py-3 px-3 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-900 text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 shadow-2xs cursor-pointer"
                                @click="router.push('/Xac-nhan-dich-vu')">
                                <Calendar :size="14" /> Xem Lịch Hẹn
                            </button>
                            <button
                                class="flex-1 py-3 px-3 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs uppercase tracking-wider font-bold transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                                @click="router.push('/')">
                                <Home :size="14" /> Về Trang Chủ
                            </button>
                        </div>

                    </div>

                </div>

                <!-- ========================================================================= -->
                <!-- CỘT PHẢI (7/12 Cột): PHÂN KHU DỊCH VỤ & PHÂN KHU SẢN PHẨM -->
                <!-- ========================================================================= -->
                <div class="lg:col-span-7 space-y-5 flex flex-col">

                    <!-- PHÂN KHU 1: DỊCH VỤ & COMBO LÀM TÓC -->
                    <div v-if="receipt.booking"
                        class="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-6 sm:p-7 space-y-4">

                        <!-- Header Dịch vụ -->
                        <div class="pb-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                                <Scissors :size="16" class="text-neutral-800" />
                                <h3
                                    class="font-heading text-sm sm:text-base font-bold uppercase tracking-wider text-neutral-900 m-0">
                                    Dịch Vụ & Combo Đã Đặt
                                </h3>
                            </div>

                            <div
                                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-900 text-xs font-bold border border-neutral-200/80">
                                <Clock :size="12" class="text-neutral-600" />
                                <span>{{ receipt.booking.gioBatDau }} - {{ receipt.booking.ngayHen }}</span>
                            </div>
                        </div>

                        <!-- Danh sách dịch vụ (To rõ, có icon badge) -->
                        <div class="divide-y divide-neutral-100">
                            <div v-for="(sv, index) in receipt.booking.services" :key="index"
                                class="py-3 flex items-center justify-between gap-4">
                                <div class="flex items-center gap-3 flex-1 min-w-0">
                                    <div
                                        class="w-8 h-8 rounded-lg bg-neutral-100 border border-neutral-200/70 flex items-center justify-center text-neutral-700 shrink-0">
                                        <Scissors :size="14" />
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div
                                            class="text-sm sm:text-base font-bold text-neutral-900 leading-snug truncate">
                                            {{ sv.name }}
                                        </div>
                                        <div class="text-xs text-neutral-500 mt-0.5 flex items-center gap-1.5"
                                            v-if="sv.stylist">
                                            <span class="text-neutral-400">Stylist phục vụ:</span>
                                            <span class="font-semibold text-neutral-800">{{ sv.stylist }}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="text-sm sm:text-base font-black text-neutral-950 shrink-0">
                                    {{ formatMoney(sv.price) }}
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- PHÂN KHU 2: SẢN PHẨM MUA KÈM (NẾU CÓ) -->
                    <div v-if="receipt.products && receipt.products.length > 0"
                        class="bg-white rounded-2xl border border-neutral-200/90 shadow-2xs p-6 sm:p-7 space-y-4 flex-1 flex flex-col justify-between">

                        <div class="space-y-4">
                            <!-- Header Sản phẩm -->
                            <div class="pb-3 border-b border-neutral-200 flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <ShoppingBag :size="16" class="text-neutral-800" />
                                    <h3
                                        class="font-heading text-sm sm:text-base font-bold uppercase tracking-wider text-neutral-900 m-0">
                                        Sản Phẩm Chăm Sóc Tóc
                                    </h3>
                                </div>
                                <span class="text-xs font-semibold text-neutral-500">({{ receipt.products.length }} sản
                                    phẩm)</span>
                            </div>

                            <!-- Danh sách sản phẩm -->
                            <div class="divide-y divide-neutral-100 max-h-[260px] overflow-y-auto pr-1">
                                <div v-for="(p, index) in receipt.products" :key="index"
                                    class="py-3 flex items-center justify-between gap-4">
                                    <div class="flex items-center gap-3.5 flex-1 min-w-0">
                                        <div
                                            class="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200/70 flex items-center justify-center text-neutral-700 shrink-0 overflow-hidden">
                                            <img v-if="p.img" :src="p.img" alt="" class="w-full h-full object-cover"
                                                onerror="this.style.display='none'">
                                            <ShoppingBag v-else :size="16" />
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div
                                                class="text-sm sm:text-base font-bold text-neutral-900 leading-snug truncate">
                                                {{ p.name }}
                                            </div>
                                            <div class="flex items-center gap-2 mt-1">
                                                <span v-if="p.variant"
                                                    class="text-[11px] px-2 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium">
                                                    {{ p.variant }}
                                                </span>
                                                <span class="text-xs text-neutral-500">
                                                    Số lượng: <b class="text-neutral-900">{{ p.qty }}</b> × {{
                                                    formatMoney(p.price) }}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="text-sm sm:text-base font-black text-neutral-950 shrink-0">
                                        {{ formatMoney(p.total) }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Hộp thông tin nhận hàng (To rõ, sang trọng) -->
                        <div v-if="receipt.delivery" class="mt-4 space-y-3">
                            <!-- 1. TỪ ĐÂU (KHO GỬI HÀNG) -->
                            <div
                                class="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50/80 flex items-start gap-3">
                                <div
                                    class="w-8 h-8 rounded-lg bg-white border border-neutral-200 flex items-center justify-center text-neutral-800 shrink-0 mt-0.5 shadow-2xs">
                                    <Store :size="16" />
                                </div>
                                <div class="flex-1 min-w-0 text-xs">
                                    <div
                                        class="text-[10px] font-heading uppercase tracking-wider font-bold text-neutral-400">
                                        Gửi từ (Kho Salon)
                                    </div>
                                    <div class="font-bold text-neutral-900 text-xs sm:text-sm mt-0.5">
                                        {{ receipt.warehouse?.name || 'Tổng Kho Salon LGHair' }}
                                    </div>
                                    <div class="text-neutral-600 text-xs mt-0.5 leading-relaxed">
                                        <MapPin :size="12" class="inline mr-1 text-neutral-400" />
                                        {{ receipt.warehouse?.address || '123 Nguyễn Tất Thành, Phường Buôn Ma Thuột, Tỉnh Đăk Lăk' }}
                                    </div>
                                </div>
                            </div>

                            <!-- Mũi tên lộ trình kết nối -->
                            <div class="flex items-center gap-2 pl-4 text-xs font-semibold text-neutral-400">
                                <ArrowDown :size="14" class="text-neutral-600" />
                                <span>Đang chuẩn bị đóng gói & bàn giao cho đơn vị vận chuyển</span>
                            </div>

                            <!-- 2. ĐẾN ĐÂU (ĐỊA CHỈ KHÁCH HÀNG) -->
                            <div
                                class="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-3">
                                <div
                                    class="w-8 h-8 rounded-lg bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0 mt-0.5 shadow-2xs">
                                    <MapPin :size="16" />
                                </div>
                                <div class="flex-1 min-w-0 text-xs">
                                    <div
                                        class="text-[10px] font-heading uppercase tracking-wider font-bold text-emerald-700">
                                        Giao đến (Người nhận)
                                    </div>
                                    <div class="font-bold text-neutral-900 text-xs sm:text-sm mt-0.5">
                                        {{ receipt.delivery.nguoiNhan }} <span
                                            class="font-normal text-neutral-500 text-xs">({{ receipt.delivery.sdt
                                            }})</span>
                                    </div>
                                    <div class="text-neutral-700 text-xs mt-0.5 leading-relaxed font-medium">
                                        {{ receipt.delivery.diaChi }}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div v-else
                            class="p-4 rounded-xl border border-neutral-200/90 bg-neutral-50/80 flex items-start gap-3 text-xs sm:text-sm mt-3">
                            <Store :size="18" class="text-neutral-800 shrink-0 mt-0.5" />
                            <div>
                                <div
                                    class="text-xs font-heading uppercase tracking-wider font-bold text-neutral-900 mb-1">
                                    Hình Thức Nhận Trực Tiếp Tại Tiệm
                                </div>
                                <p class="text-xs text-neutral-600 m-0 leading-relaxed">
                                    Sản phẩm của bạn đã được chuẩn bị và lưu tại quầy lễ tân. Bạn sẽ nhận trực tiếp khi
                                    đến salon làm dịch vụ.
                                </p>
                            </div>
                        </div>

                    </div>

                </div>

            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import QrcodeVue from 'qrcode.vue';
import axios from 'axios';
import {
    Check,
    X,
    Mail,
    Coins,
    Calendar,
    Home,
    Clock,
    Scissors,
    ShoppingBag,
    Truck,
    Store,
    MapPin,
    ArrowDown,
    AlertTriangle
} from 'lucide-vue-next';
import { removeFromCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';

const route = useRoute();
const router = useRouter();
const receipt = ref<any>(null);
const loading = ref(true);
const isSuccess = ref(true);
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const formatMoney = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
};

onMounted(async () => {
    const maHd = route.query.vnp_TxnRef || route.query.maHd || route.query.orderId;
    const vnpCode = route.query.vnp_ResponseCode ? String(route.query.vnp_ResponseCode) : undefined;
    const momoCode = route.query.resultCode ? String(route.query.resultCode) : undefined;

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
            if (res.data && res.data.success) {
                receipt.value = res.data.data;
                // Nếu URL từ VNPay/MoMo có số tiền thực trả -> ưu tiên cập nhật số tiền thực trả chính xác
                if (route.query.vnp_Amount) {
                    const actualPaid = Number(route.query.vnp_Amount) / 100;
                    if (actualPaid > 0) receipt.value.tienDaTra = actualPaid;
                } else if (route.query.amount) {
                    const actualPaid = Number(route.query.amount);
                    if (actualPaid > 0) receipt.value.tienDaTra = actualPaid;
                }
            }
        } catch (error) {
            console.error("Lỗi tải hóa đơn:", error);
        }
    }

    // Nếu thanh toán thành công, xóa sạch những món đã mua khỏi giỏ hàng
    if (isSuccess.value) {
        const checkoutRaw = localStorage.getItem("checkoutData");
        if (checkoutRaw) {
            try {
                const checkoutData = JSON.parse(checkoutRaw);
                if (checkoutData.dichVuItems) {
                    for (const s of checkoutData.dichVuItems) {
                        await removeFromCartDB(s.id, s.type || 'DICHVU').catch(() => { });
                    }
                }
                if (checkoutData.sanPhamItems) {
                    for (const p of checkoutData.sanPhamItems) {
                        await removeFromCartDB(p.id, 'SANPHAM').catch(() => { });
                    }
                }
            } catch (e) {
                console.error("Lỗi xóa db sau thanh toán:", e);
            }
            localStorage.removeItem("checkoutData");
            localStorage.removeItem("cartSP");
        }
        useBookingBasketStore().clearAll();
        window.dispatchEvent(new Event('cart-updated'));
        window.dispatchEvent(new Event('booking-basket-updated'));
    }

    loading.value = false;
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800;900&display=swap');

.font-heading,
h1,
h2,
h3 {
    font-family: 'Montserrat', sans-serif !important;
}
</style>