<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { KHO_ORIGIN, calculateShippingFee } from './shippingCalculator';
import { clearProductCartDB, removeFromCartDB } from '@/Views/Anonymous/CSDL/cartDB';

const router = useRouter();
const API = import.meta.env.VITE_API_URL;
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// ==========================================
// STATE DỮ LIỆU CƠ BẢN
// ==========================================
const getImageUrl = (path: string) => {
    if (!path) return '/images/no-image.png';
    if (path.startsWith('http')) return path;
    return `${API}${path}`;
};

const customer = getCustomerInfo();
const orderData = ref({
    customerName: customer.hoTen !== 'Khách vãng lai' ? customer.hoTen : '',
    phone: customer.sdt || '',
    email: customer.email || '', // Bổ sung Email cho khớp model ThongtinGiaohang
    address: '',
    note: '',
    paymentMethod: 'cod', // cod, vnpay, momo
    voucherIds: [] as string[]
});

const productItems = ref<any[]>([]);
const allProductsFromApi = ref<any[]>([]);

// ==========================================
// LOGIC BẢN ĐỒ ĐỘNG 
// ==========================================
const distanceText = ref<string>('');
const shippingFee = ref<number>(0);
const isCalculatingRoute = ref(false);

const defaultLocation = "Buôn Ma Thuột, Đắk Lắk, Việt Nam";
// ==========================================
// LOGIC TÌM KIẾM VÀ THÊM SẢN PHẨM NHANH
// ==========================================
const searchQuery = ref('');
const showProductDropdown = ref(false);
const searchResults = ref<any[]>([]);
let searchTimeout: any = null;

const loadProductsWithVariants = async (keyword: string = '') => {
    try {
        const res = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
            params: { keyword: keyword }
        });
        if (res.data && res.data.success) {
            searchResults.value = res.data.data;
        }
    } catch (error) {
        console.error("Lỗi lấy danh sách sản phẩm:", error);
    }
};

// Theo dõi khi người dùng gõ từ khóa (chờ 0.5s để chống lag)
watch(searchQuery, (newVal) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        loadProductsWithVariants(newVal);
    }, 500);
});

// Hàm thêm Biến thể vào giỏ hàng
const addProduct = (sp: any, bt: any) => {
    // Nếu hết hàng thì không làm gì cả
    if (bt.soLuongTon <= 0) return;

    const existingProduct = productItems.value.find(p => p.id === bt.maBienThe);

    if (existingProduct) {
        // Cộng dồn số lượng nếu đã có trong giỏ
        existingProduct.soLuong++;
    } else {
        // Thêm mới nếu chưa có
        productItems.value.push({
            id: bt.maBienThe,
            tenItem: `${sp.tenSp} - ${bt.tenBienThe}`,
            gia: bt.giaBan,
            hinhAnh: bt.hinhAnh,
            soLuong: 1
        });
    }

    // Đóng popup sau khi thêm
    searchQuery.value = '';
    showProductDropdown.value = false;
};

const removeProduct = (id: string | number) => {
    productItems.value = productItems.value.filter(p => p.id !== id);
};

const increaseQuantity = (item: any) => item.soLuong++;
const decreaseQuantity = (item: any) => {
    if (item.soLuong > 1) item.soLuong--;
};
const validateQuantity = (item: any) => {
    if (typeof item.soLuong !== 'number' || isNaN(item.soLuong) || item.soLuong < 1) {
        item.soLuong = 1;
    }
};
const filteredProducts = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    let list = allProductsFromApi.value;
    if (query) {
        list = list.filter(p => p.tenSp.toLowerCase().includes(query) || p.tenBienThe?.toLowerCase().includes(query));
    }
    // Remove filtering out selected items so they can be added again
    return list;
});


// ==========================================
// LOGIC VOUCHER 
// ==========================================
const myVouchers = ref<any[]>([]);
const stackPreview = ref({ totalDiscount: 0, finalAmount: 0 });



const calculateRouteAndFee = () => {
    if (!orderData.value.address) return;

    isCalculatingRoute.value = true;
    
    // Giả lập tính toán quãng đường thay cho Google Maps API
    setTimeout(() => {
        const destLower = orderData.value.address.toLowerCase();
        let distanceInKm = 0;

        if (destLower.includes("buôn ma thuột") || destLower.includes("bmt")) {
            distanceInKm = Math.floor(Math.random() * 10) + 2; // Khoảng 2 - 12 km
        } else if (destLower.includes("đắk lắk") || destLower.includes("dak lak")) {
            distanceInKm = Math.floor(Math.random() * 40) + 20; // Khoảng 20 - 60 km
        } else {
            distanceInKm = Math.floor(Math.random() * 200) + 100; // Ngoại tỉnh (100 - 300 km)
        }

        distanceText.value = `~${distanceInKm} km`;
        shippingFee.value = calculateShippingFee(distanceInKm, orderData.value.address);
        isCalculatingRoute.value = false;
    }, 600);
};

let addressTimeout: any = null;
watch(() => orderData.value.address, (newAddress) => {
    clearTimeout(addressTimeout);
    if (!newAddress) {
        shippingFee.value = 0;
        distanceText.value = '';
        return;
    }
    addressTimeout = setTimeout(() => {
        calculateRouteAndFee();
    }, 1000);
});


const subTotal = computed(() => productItems.value.reduce((sum, item) => sum + (item.gia * (item.soLuong || 1)), 0));

const loadVouchers = async () => {
    if (!customer.maKH || customer.maKH === 'GUEST') return;
    try {
        const productIds = productItems.value.map(p => p.id).join(',');
        const res = await axios.get(`${API}/api/DatDichVu/get-my-vouchers/${customer.maKH}`, {
            params: { subTotal: subTotal.value, serviceIds: productIds }
        });
        myVouchers.value = res.data;
        orderData.value.voucherIds = orderData.value.voucherIds.filter(id => myVouchers.value.some(v => v.id === id));
    } catch (error) {
        console.error("Lỗi load voucher:", error);
    }
};

const refreshStackPreview = async () => {
    if (!customer.maKH || customer.maKH === 'GUEST' || orderData.value.voucherIds.length === 0) {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value + shippingFee.value };
        return;
    }
    try {
        const codes = orderData.value.voucherIds.join(',');
        const res = await axios.get(`${API}/api/DatDichVu/preview-voucher-stack`, {
            params: {
                maKH: customer.maKH,
                codes,
                subTotal: subTotal.value,
                serviceIds: productItems.value.map(p => p.id).join(',')
            }
        });
        stackPreview.value = {
            totalDiscount: Number(res.data.totalDiscount) || 0,
            finalAmount: (Number(res.data.finalAmount) || subTotal.value) + shippingFee.value
        };
    } catch {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value + shippingFee.value };
    }
};

watch([() => orderData.value.voucherIds.slice(), subTotal, shippingFee, () => productItems.value.length], () => {
    refreshStackPreview();
}, { deep: true, immediate: true });

function toggleVoucher(id: string) {
    const ids = orderData.value.voucherIds;
    const i = ids.indexOf(id);
    if (i >= 0) { ids.splice(i, 1); return; }
    if (ids.length >= 2) {
        alert('Chỉ chọn tối đa 2 voucher. Bỏ chọn một mã trước khi thêm mã khác.');
        return;
    }
    ids.push(id);
}

const discountAmount = computed(() => stackPreview.value.totalDiscount);
const finalTotal = computed(() => stackPreview.value.finalAmount);

const payNow = computed(() => {
    if (orderData.value.paymentMethod === 'cod') {
        return 0;
    }
    return finalTotal.value;
});

const remainCOD = computed(() => {
    if (orderData.value.paymentMethod === 'cod') {
        return finalTotal.value;
    }
    return 0;
});

// ==========================================
// KHỞI TẠO DỮ LIỆU
// ==========================================
// ==========================================
// KHỞI TẠO DỮ LIỆU
// ==========================================
onMounted(async () => {
    // 1. Nhận hàng từ Giỏ hàng Sidebar
    const checkoutRaw = localStorage.getItem("checkoutData");
    if (checkoutRaw) {
        try {
            const checkoutData = JSON.parse(checkoutRaw);
            if (checkoutData.sanPhamItems && checkoutData.sanPhamItems.length > 0) {
                productItems.value = checkoutData.sanPhamItems;
            }
        } catch (error) {
            console.error("Lỗi khi parse dữ liệu giỏ hàng:", error);
        }
    }
    
    // 2. Load vouchers
    await loadVouchers();

    // 3. Load danh sách sản phẩm mặc định ban đầu
    await loadProductsWithVariants('');
    
});

// ==========================================
// XỬ LÝ THANH TOÁN
// ==========================================
// ==========================================
// XỬ LÝ ĐẶT HÀNG & THANH TOÁN
// ==========================================
const handleCheckout = async () => {
    // 1. Validate dữ liệu cơ bản
    if (!orderData.value.customerName || !orderData.value.phone || !orderData.value.address) {
        alert("Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ giao hàng chi tiết!");
        return;
    }

    if (productItems.value.length === 0) {
        alert("Giỏ hàng của bạn đang trống! Vui lòng chọn sản phẩm.");
        return;
    }

    try {
        // 2. Chuẩn bị dữ liệu gửi lên Backend
        const payload = {
            maKh: customer?.maKH || "GUEST",
            hoTen: orderData.value.customerName,
            phone: orderData.value.phone,
            email: orderData.value.email,
            address: orderData.value.address,
            note: orderData.value.note,
            paymentMethod: orderData.value.paymentMethod, // 'cod', 'vnpay', 'momo'
            shippingFee: shippingFee.value,
            voucherIds: orderData.value.voucherIds,
            products: productItems.value.map(item => ({
                maBienThe: item.id, 
                giaBan: item.gia,
                soLuong: item.soLuong
            }))
        };

        // 3. Gọi API tạo đơn hàng
        const res = await axios.post(`${API}/api/ThanhToanSanPham/submit-product-order`, payload);

        if (res.data && res.data.success) {
            
            // ==================================================
            // 1. XÓA SẠCH GIỎ HÀNG NGAY KHI LƯU DB THÀNH CÔNG
            // ==================================================
            localStorage.removeItem("checkoutData"); // Xóa dữ liệu tạm trang thanh toán
            localStorage.removeItem("cart");         // Xóa giỏ hàng gốc (Tùy theo key bạn đặt)
            localStorage.removeItem("cartSP");       // (Nếu bạn dùng tên key này)
            
            // Xóa từng món cụ thể vừa đặt để không dính lỗi maKH (GUEST vs User)
            try {
                for (const item of productItems.value) {
                    await removeFromCartDB(item.id);
                }
            } catch(e) {
                console.error("Lỗi xóa db giỏ hàng", e);
            }
            
            await clearProductCartDB(customer?.maKH || 'GUEST'); // Backup xóa thêm theo luồng cũ
            
            productItems.value = [];                 // Làm rỗng mảng hiển thị hiện tại

            // ==================================================
            // 2. XỬ LÝ CHUYỂN HƯỚNG
            // ==================================================
            if (res.data.isOnlinePayment && res.data.url) {
                // Đã xóa giỏ hàng xong -> Bay sang trang nhập thẻ của VNPay/MoMo
                window.location.href = res.data.url;
            } else {
                // COD -> Hiện thông báo -> Về trang chủ
                alert(`Đặt hàng thành công! Sản phẩm sẽ được giao đến địa chỉ: ${orderData.value.address}`);
                router.push('/');
            }
        }
    } catch (error: any) {
        console.error("Lỗi đặt hàng:", error);
        alert(error.response?.data?.message || "Có lỗi xảy ra khi lưu đơn hàng! Vui lòng thử lại.");
    }
};

const formatMoney = (money: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(money || 0);
</script>

<template>
    <div class="booking-container">
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="text-center mb-12" data-aos="fade-down">
                <h1 class="font-playfair gold-metallic-text font-black text-5xl">GIAO HÀNG TẬN NƠI</h1>
                <div class="gold-accent-line mx-auto mt-4"></div>
                <p class="text-black mt-2">Điền thông tin địa chỉ để chúng tôi giao sản phẩm đến tay bạn</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-7 space-y-6" data-aos="fade-right">
                    <div class="glass-card left-main-card">
                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                <i class="fas fa-shipping-fast me-2"></i> THÔNG TIN NGƯỜI NHẬN
                            </h3>
                            <div class="heading-line"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Họ và tên *</label>
                                <input v-model="orderData.customerName" type="text" class="booking-input w-full"
                                    placeholder="Tên người nhận">
                            </div>

                            <div>
                                <label class="custom-label font-bold">Số điện thoại *</label>
                                <input v-model="orderData.phone" type="tel" class="booking-input w-full"
                                    placeholder="090x xxx xxx">
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Email nhận thông báo</label>
                                <input v-model="orderData.email" type="email" class="booking-input w-full"
                                    placeholder="vidu@gmail.com">
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold text-danger">Địa chỉ giao hàng chi tiết *</label>
                                <textarea v-model="orderData.address" class="booking-input w-full pt-2" style="height: 80px;"
                                    placeholder="Nhập số nhà, tên đường... Bản đồ sẽ tự động cập nhật."></textarea>
                            </div>
                            
                            <div class="md:col-span-2" v-if="orderData.address">
                                <div class="shipping-info-card mt-2 p-3 shadow-sm rounded border border-gray-200 bg-gray-50">
                                    <h6 class="font-bold text-gray-900 mb-3"><i class="fas fa-truck me-2"></i> THÔNG TIN GIAO HÀNG (ƯỚC TÍNH)</h6>
                                    
                                    <div class="flex mb-2 items-start">
                                        <div class="me-3 text-success"><i class="fas fa-store-alt mt-1"></i></div>
                                        <div>
                                            <div class="font-bold" style="font-size: 13px;">Địa chỉ Kho hàng:</div>
                                            <div class="text-black" style="font-size: 13px;">{{ KHO_ORIGIN }}</div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex mb-2 items-start border-l-2 ms-2 ps-4 pb-2 pt-2 border-gray-400" style="margin-left: 5px !important;">
                                        <div>
                                            <div class="badge bg-dark text-white mb-1">
                                                <i class="fas fa-route me-1"></i> Quãng đường: {{ isCalculatingRoute ? 'Đang tính...' : (distanceText || 'Không xác định') }}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-start">
                                        <div class="me-3 text-danger"><i class="fas fa-map-marker-alt mt-1"></i></div>
                                        <div>
                                            <div class="font-bold" style="font-size: 13px;">Giao đến:</div>
                                            <div class="text-black" style="font-size: 13px;">{{ orderData.address }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Ghi chú cho shipper</label>
                                <input v-model="orderData.note" type="text" class="booking-input w-full"
                                    placeholder="VD: Giao giờ hành chính...">
                            </div>
                        </div>

                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                <i class="fas fa-wallet me-2"></i> PHƯƠNG THỨC THANH TOÁN
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="payment-method-row mt-3">
                            <div class="method-option" :class="{ active: orderData.paymentMethod === 'cod' }"
                                @click="orderData.paymentMethod = 'cod'">
                                <span class="radio-dot"></span>
                                <span class="method-label font-bold">Thanh toán khi nhận hàng (COD)</span>
                            </div>
                            <div class="method-option" :class="{ active: orderData.paymentMethod === 'vnpay' }"
                                @click="orderData.paymentMethod = 'vnpay'">
                                <span class="radio-dot"></span>
                                <span class="method-label font-bold">VNPay</span>
                            </div>
                            <div class="method-option" :class="{ active: orderData.paymentMethod === 'momo' }"
                                @click="orderData.paymentMethod = 'momo'">
                                <span class="radio-dot"></span>
                                <span class="method-label font-bold">MoMo</span>
                            </div>
                        </div>

                        <div class="section-heading-wrapper mt-5">
                            <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                <i class="fas fa-ticket-alt me-2"></i> KHO VOUCHER CỦA BẠN
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <p class="text-black small mb-3 font-bold">Chọn tối đa 2 mã — thứ tự chọn = thứ tự áp dụng.</p>
                        <div class="voucher-list-modern">
                            <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                :class="{ active: orderData.voucherIds.includes(v.id) }" @click="toggleVoucher(v.id)">
                                <div class="ticket-left">
                                    <i class="fas fa-gift"></i>
                                    <span class="notch top"></span><span class="notch bottom"></span>
                                </div>
                                <div class="v-divider"></div>
                                <div class="ticket-right">
                                    <div class="d-flex justify-content-between align-items-start mb-1">
                                        <span class="v-code font-bold">{{ v.code }}</span>
                                        <span class="v-tag-gold font-bold">HSD: {{ v.expiry }}</span>
                                    </div>
                                    <div class="v-desc text-black mb-2">{{ v.desc }}</div>
                                    <div class="v-price-gold font-bold">Giảm: {{ v.discount.toLocaleString() }}đ</div>
                                </div>
                                <div class="v-check-icon" v-if="orderData.voucherIds.includes(v.id)">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-5" data-aos="fade-left">
                    <div class="sticky-bill">
                        <div class="glass-card bill-card">
                            <div class="section-heading-wrapper justify-content-center text-center mb-4">
                                <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> CHI TIẾT ĐƠN HÀNG
                                </h3>
                                <div class="heading-line mx-auto" style="width: 80px;"></div>
                            </div>

                            <div class="search-box-wrapper mb-4">
                                <div class="input-wrap">
                                    <i class="fas fa-search search-icon"></i>
                                    <input v-model="searchQuery" type="text" placeholder="Tìm và thêm sản phẩm..."
                                        @focus="showProductDropdown = true" class="search-input">
                                </div>
                                <div v-if="showProductDropdown" class="service-dropdown-list shadow">
                                    <div class="dropdown-header">DANH SÁCH SẢN PHẨM</div>
                                    <div class="dropdown-scroll-area">
                                        <div v-if="searchResults.length === 0" class="p-3 text-center text-black small font-bold">
                                            Không tìm thấy sản phẩm nào.
                                        </div>

                                        <div v-for="sp in searchResults" :key="sp.maSp" class="mb-2">
                                            <div class="dropdown-header"
                                                style="background-color: #f1f1f1; color: #333;">{{ sp.tenSp }}</div>

                                            <div v-for="bt in sp.bienthes" :key="bt.maBienThe"
                                                class="service-dropdown-item"
                                                :class="{ 'opacity-50': bt.soLuongTon <= 0 }"
                                                @click="addProduct(sp, bt)">

                                                <div class="flex items-center">
                                                    <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                         <img :src="getImageUrl(bt.hinhAnh)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                     </div>
                                                    <div class="item-details">
                                                        <span class="item-name-text font-bold"
                                                            style="font-size: 13px;">{{ bt.tenBienThe }}</span>
                                                        <div class="d-flex align-items-center mt-1">
                                                            <span class="item-price-text gold-solid-text font-bold">{{ formatMoney(bt.giaBan) }}</span>
                                                            <span class="ms-2 text-black" style="font-size: 11px;">(Kho: {{ bt.soLuongTon }})</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <span v-if="bt.soLuongTon <= 0" class="badge bg-danger p-1"
                                                    style="font-size: 10px;">Hết</span>
                                                <i v-else class="fas fa-plus-circle add-btn-icon"></i>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="dropdown-close-footer" @click="showProductDropdown = false">ĐÓNG</div>
                                </div>
                            </div>

                            <div class="selected-items-wrapper mb-4 border-bottom pb-3">
                                <transition-group name="list-fade">
                                    <div v-for="p in productItems" :key="p.id" class="item-row product-checkout-item">
                                        <div class="flex items-center flex-grow-1">
                                            <div class="w-12 h-12 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                <img :src="getImageUrl(p.hinhAnh)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                            </div>
                                            <div class="item-info flex-grow-1">
                                                <span class="n font-bold d-block text-truncate" style="max-width: 170px;">{{ p.tenItem }}</span>
                                                <div class="p gold-solid-text font-bold mt-1">{{ formatMoney(p.gia) }}</div>
                                            </div>
                                        </div>

                                        <div class="quantity-pill ms-auto me-3">
                                            <button @click="decreaseQuantity(p)" class="qty-btn"><i class="fas fa-minus"></i></button>
                                            <input type="number" v-model.number="p.soLuong" min="1" class="qty-input" @input="validateQuantity(p)" />
                                            <button @click="increaseQuantity(p)" class="qty-btn"><i class="fas fa-plus"></i></button>
                                        </div>

                                        <button class="del-btn" @click="removeProduct(p.id)"><i class="fas fa-trash"></i></button>
                                    </div>
                                </transition-group>
                            </div>

                            <div class="total-box">
                                <div class="total-line">
                                    <span>Tạm tính</span>
                                    <b>{{ formatMoney(subTotal) }}</b>
                                </div>
                                <div class="total-line" v-if="shippingFee > 0">
                                    <span>Phí giao hàng</span>
                                    <b>{{ formatMoney(shippingFee) }}</b>
                                </div>
                                <div class="total-line saving" v-if="discountAmount > 0">
                                    <span>Giảm voucher</span>
                                    <b>-{{ formatMoney(discountAmount) }}</b>
                                </div>

                                <div class="grand-line">
                                    <span>Tổng cộng (đã gồm VAT)</span>
                                    <b>{{ formatMoney(finalTotal) }}</b>
                                </div>

                                <div class="pay-line">
                                    <span>Thanh toán ngay</span>
                                    <b>{{ formatMoney(payNow) }}</b>
                                </div>

                                <div class="total-line text-danger" v-if="remainCOD > 0" style="color: #d63031 !important;">
                                    <span>Còn lại khi nhận hàng (COD)</span>
                                    <b>{{ formatMoney(remainCOD) }}</b>
                                </div>
                            </div>

                            <button class="btn-confirm-metallic-final mt-4" @click="handleCheckout">
                                <span class="btn-text-normal">THANH TOÁN NGAY</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.booking-container {
    --gold-metallic: #000;
    --gold-solid: #000;
}

.booking-container {
    background: #ffffff;
    min-height: 100vh;
    font-family: 'Poppins', sans-serif;
    color: #333;
    line-height: 1.8;
}

.font-playfair {
    font-family: 'Montserrat', sans-serif !important;
}

/* Đảm bảo tiêu đề các mục dùng font hiện đại giống nút bấm */
.card-header-title {
    font-family: 'Poppins', sans-serif !important;
    /* Đổi từ Playfair sang Poppins */
    font-weight: 800 !important;
    /* Độ dày cực đậm giống nút xác nhận */
    font-size: 1.2rem;
    text-transform: uppercase;
    /* In hoa toàn bộ cho chuyên nghiệp */
    letter-spacing: 0.5px;
    border-bottom: 1px solid #f8f8f8;
    padding-bottom: 15px;
    margin-bottom: 25px;
    display: flex;
    align-items: center;
}

/* Tăng kích thước icon một chút cho cân đối */
.card-header-title i {
    font-size: 1.1rem;
    /* Nếu muốn icon cũng có màu vàng ánh kim thì dùng dòng dưới, không thì giữ nguyên gold-text */
    background: var(--gold-metallic);
    -webkit-text-fill-color: transparent;
}

.font-bold {
    font-weight: 700 !important;
}

/* Font bình thường in đậm cho Tổng tiền và Nút */
.total-val-standard {
    font-family: Helvetica, sans-serif !important;
    /* Xóa hoặc đổi thành Poppins */
    font-weight: 700 !important;
}

.btn-text-normal {
    font-family: 'Poppins', sans-serif !important;
    font-weight: 800 !important;
    /* Dùng độ đậm cực cao như ảnh mẫu */
    font-size: 18px !important;
    text-transform: uppercase !important;
    letter-spacing: 0.5px !important;
    line-height: 1.2 !important;
    display: inline-block !important;
    color: #ffffff !important;
    -webkit-font-smoothing: antialiased;
}

/* Đồng bộ font cho phần số tiền để tránh bị méo số */
.total-val-standard {
    font-family: Helvetica, sans-serif !important;
    font-weight: 700 !important;
}

/* Các thành phần cũ giữ nguyên */
.gold-metallic-text {
    color: #000;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    display: inline-block;
}

.gold-solid-text {
    color: #000;
    font-weight: 600;
}

.gold-accent-line {
    width: 60px;
    height: 1px;
    background: #000;
    margin: 15px auto;
}

.item-details {
    display: flex;
    flex-direction: column;
    /* Đảm bảo tên ở trên, giá ở dưới */
    gap: 4px;
    /* Đây là khoảng cách giữa tên và giá, bạn có thể chỉnh 2px hoặc 6px tùy ý */
}

.glass-card {
    background: #fff;
    padding: 40px;
    border-radius: 2px;
    border: 1px solid #eaeaea;
    box-shadow: none;
}

.card-header-title {
    font-size: 1.1rem;
    border-bottom: 1px solid #f8f8f8;
    padding-bottom: 15px;
    margin-bottom: 25px;
}

.stylist-meta {
    display: flex;
    flex-direction: column;
    /* Xếp theo chiều dọc */
    align-items: center;
    /* Canh giữa chữ */
    margin-top: 10px;
    /* Khoảng cách với ảnh đại diện */
    gap: 2px;
    /* Khoảng cách nhỏ giữa tên và role */
}

.s-name {
    font-size: 14px;
    color: #111;
    display: block;
    /* Luôn chiếm một hàng riêng */
    line-height: 1.2;
}

.s-role {
    font-size: 11px;
    color: #888;
    /* Màu xám nhẹ cho chức danh */
    display: block;
    /* Luôn chiếm một hàng riêng */
    text-transform: uppercase;
    /* In hoa cho chuyên nghiệp */
}

.item-info {
    display: flex;
    flex-direction: column;
    /* Xếp theo hàng dọc */
    gap: 4px;
    /* Khoảng cách giữa tên và giá (tùy chỉnh theo ý bạn) */
    align-items: flex-start;
    /* Canh lề trái cho cả 2 dòng */
}

/* Đảm bảo tên dịch vụ không bị dính vào giá */
.item-info .n {
    line-height: 1.2;
    margin-bottom: 2px;
}

/* Giá tiền hiển thị rõ ràng */
.item-info .p {
    font-size: 13px;
    /* Có thể chỉnh nhỏ hơn tên 1 chút cho đẹp */
    line-height: 1;
}

.booking-input {
    width: 100%;
    height: 50px;
    padding: 0 18px;
    border-radius: 2px;
    border: 1px solid #eee;
    background: #fdfdfd;
    outline: none;
    font-size: 14px;
}

.booking-input:focus {
    border-color: #000;
}

.stylist-flex {
    display: flex;
    gap: 20px;
    overflow-x: auto;
    padding: 10px 0;
    scrollbar-width: none;
}

.stylist-card {
    flex: 0 0 120px;
    text-align: center;
    cursor: pointer;
    transition: 0.4s;
}

.avatar-box {
    position: relative;
    width: 80px;
    height: 80px;
    margin: 0 auto 10px;
}

.avatar-box img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid transparent;
    padding: 3px;
}

.check-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    background: #000;
    color: #fff;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    border: 2px solid #fff;
    opacity: 0;
    transform: scale(0.5);
    transition: 0.3s;
}

.stylist-card.active img {
    border-color: #000;
}

.stylist-card.active .check-badge {
    opacity: 1;
    transform: scale(1);
}

/* Thanh toán & Voucher */
.payment-method-row {
    display: flex;
    gap: 20px;
}

.method-option {
    flex: 1;
    border: 1px solid #eee;
    padding: 15px;
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: 0.3s;
}

.radio-dot {
    flex-shrink: 0;
    min-width: 20px;
    min-height: 20px;
    width: 20px;
    height: 20px;
    border: 2px solid #ddd;
    border-radius: 50%;
    margin-right: 12px;
    position: relative;
    display: block;
}

.method-option.active {
    border-color: #000;
    background: #fafafa;
}

.method-option.active .radio-dot {
    border-color: #000;
}

.method-option.active .radio-dot::after {
    content: '';
    position: absolute;
    width: 10px;
    height: 10px;
    background: #000;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

/* Ép mỗi Voucher chiếm 1 hàng duy nhất */
.voucher-list-modern {
    display: flex;
    flex-direction: column;
    gap: 15px;
    width: 100%;
}

.voucher-ticket-item {
    display: flex;
    width: 100%;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 2px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: 0.3s ease;
}

.voucher-ticket-item.active {
    border-color: #000;
    background: #fafafa;
}

/* Phần nội dung bên phải */
.ticket-right {
    padding: 15px;
    flex: 1;
    display: flex;
    flex-direction: column;
}

/* 1. Màu cho Ngày hết hạn (Vàng nhẹ tinh tế) */
.v-tag-gold {
    font-size: 11px;
    color: #111111;
    background: #f3f4f6;
    padding: 3px 8px;
    border-radius: 6px;
}

/* 2. Màu cho Giá tiền (Gold Metallic nổi bật nhất) */
.v-price-gold {
    font-size: 17px;
    background: linear-gradient(135deg, #4b5563 0%, #111111 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
}

.v-code {
    font-size: 15px;
    color: #111;
}

.v-divider {
    width: 1px;
    border-left: 2px dashed #eee;
    height: 70%;
    align-self: center;
    margin: 0 5px;
}

.ticket-left {
    background: var(--gold-metallic);
    width: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    position: relative;
    flex-shrink: 0;
}

.v-check-icon {
    position: absolute;
    top: 10px;
    right: 10px;
    color: var(--gold-solid);
    font-size: 18px;
}


/* Style cho Icon thanh toán có màu */
.method-icon-img {
    width: 25px;
    height: 25px;
    object-fit: contain;
    margin-right: 10px;
}

/* Căn chỉnh lại ô chọn thanh toán */
.payment-method-row {
    display: flex;
    gap: 15px;
}

.method-option {
    flex: 1;
    border: 1px solid #eee;
    padding: 12px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    cursor: pointer;
    background: #fff;
}

.method-option.active {
    border-color: #111;
    background: #f9fafb;
}

/* Nút ĐÓNG danh sách dịch vụ tách biệt */
.dropdown-close-footer {
    text-align: left;
    padding: 15px 20px;
    font-size: 15px;
    color: #666;
    cursor: pointer;
    border-top: 1px solid #eee;
    background: #fff;
    font-family: 'Poppins', sans-serif;
}

.ticket-left {
    background: var(--gold-metallic);
    width: 45px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    position: relative;
}

.notch {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    left: -6px;
}

.notch.top {
    top: -6px;
}

.notch.bottom {
    bottom: -6px;
}

.ticket-right {
    padding: 12px;
    flex: 1;
}

.search-box-wrapper {
    position: relative;
}

.search-input {
    width: 100%;
    height: 50px;
    padding-left: 50px;
    border-radius: 50px;
    border: 1px solid #eee;
    background: #fdfdfd;
    outline: none;
    font-size: 14px;
}

.search-icon {
    position: absolute;
    left: 18px;
    top: 50%;
    transform: translateY(-50%);
    color: #ccc;
    z-index: 5;
}

.service-dropdown-list {
    position: absolute;
    top: 110%;
    left: 0;
    width: 100%;
    background: #fff;
    border-radius: 15px;
    z-index: 1000;
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
    border: 1px solid #f0f0f0;
    overflow: hidden;
}

.dropdown-header {
    padding: 10px 20px;
    background: #fdfdfd;
    font-size: 11px;
    font-weight: 700;
    color: #999;
    text-transform: uppercase;
    border-bottom: 1px solid #f5f5f5;
}

.dropdown-scroll-area {
    max-height: 280px;
    overflow-y: auto;
}

.service-dropdown-item {
    padding: 12px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid #f9f9f9;
}

.service-dropdown-item:hover {
    background: #f9fafb;
}

.item-icon-circle {
    width: 32px;
    height: 32px;
    background: #f3f4f6;
    color: var(--gold-solid);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 12px;
    font-size: 13px;
}

.dropdown-close-footer {
    text-align: left;
    padding: 15px 20px;
    font-size: 16px;
    color: #666;
    cursor: pointer;
    border-top: 1px solid #f5f5f5;
    background: #fff;
}

.item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px 20px;
    background: #fcfcfc;
    border-radius: 12px;
    margin-bottom: 10px;
    border: 1px solid #f5f5f5;
}

.del-btn {
    border: none;
    background: transparent;
    color: #ff5e5e;
    cursor: pointer;
}

.total-box {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.total-line,
.grand-line,
.pay-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 10px 0;
    font-weight: 700;
}

.total-line span,
.total-line.muted {
    color: #777;
}

.total-line.saving {
    color: #16a34a;
}

.total-line.text-danger span,
.total-line.text-danger b {
    color: #d63031 !important;
}

.grand-line {
    margin-top: 18px;
    padding-top: 16px;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    font-size: 18px;
}

.grand-line b {
    color: #1f2937;
    font-size: 23px;
}

.pay-line {
    padding: 14px;
    border-radius: 18px;
    background: rgba(22, 163, 74, 0.1);
    color: #15803d;
}

.pay-now-alert {
    background: #f6ffed;
    padding: 10px 15px;
    border-radius: 10px;
    border: 1px solid #b7eb8f;
}

.btn-confirm-metallic-final {
    width: 100%;
    padding: 18px;
    border: none;
    border-radius: 2px;
    background: #000;
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: 0.4s;
    font-family: 'Montserrat', Arial, sans-serif !important;
    font-weight: 800 !important;
    font-size: 18px !important;
}

.btn-confirm-metallic-final .btn-text-normal {
    color: #ffffff !important;
    font-family: Arial, Helvetica, sans-serif !important;
}

.btn-confirm-metallic-final::before {
    display: none;
}

.pay-btn {
    flex: 1;
    border: 1px solid #eee;
    padding: 12px;
    border-radius: 2px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: 0.3s;
    font-size: 13px;
}

.pay-btn .dot {
    width: 14px;
    height: 14px;
    border: 2px solid #ddd;
    border-radius: 50%;
    margin-right: 10px;
    position: relative;
}

.pay-btn.active {
    border-color: #000;
    background: #fafafa;
}

.pay-btn.active .dot {
    border-color: #000;
}

.pay-btn.active .dot::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: #000;
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.list-fade-enter-active,
.list-fade-leave-active {
    transition: all 0.4s ease;
}

.list-fade-enter-from {
    opacity: 0;
    transform: translateX(30px);
}

.list-fade-leave-to {
    opacity: 0;
    transform: scale(0.5);
}

.sticky-bill {
    position: sticky;
    top: 120px;
}

@media (max-width: 991px) {
    .sticky-bill {
        position: static;
        margin-top: 30px;
    }

    .voucher-list-modern,
    .payment-method-row {
        grid-template-columns: 1fr;
    }
}

.booking-input {
    width: 100%;
    height: 50px;
    /* Cố định chiều cao để tất cả các ô bằng chằn chặn */
    padding: 0 18px;
    border-radius: 12px;
    border: 1px solid #eee;
    background: #fafafa;
    outline: none;
    font-size: 14px;
    display: flex;
    align-items: center;
    appearance: none;
    /* Xóa style mặc định của trình duyệt cho select */
}

/* Thêm icon mũi tên cho ô select cho đẹp */
select.booking-input {
    background-image: url("data:image/svg+xml,...");
    /* Nếu muốn thêm icon dropdown */
    background-repeat: no-repeat;
    background-position: right 15px center;
    background-size: 12px;
}
/* Custom Section Styles for Layout Balance */
.section-card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: 1px solid rgba(0, 0, 0, 0.05);
}
.section-card:hover {
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
}
.section-heading-wrapper {
    position: relative;
    margin-bottom: 1.5rem;
    padding-bottom: 0.5rem;
    display: flex;
    flex-direction: column;
}
.section-heading-wrapper.justify-content-center {
    align-items: center;
}
.section-heading-title {
    font-size: 1.4rem;
    letter-spacing: 1px;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
}
.heading-line {
    width: 60px;
    height: 1px;
    background: #000;
}
.qty-input {
    width: 32px;
    border: none;
    background: transparent;
    text-align: center;
    font-size: 13px;
    font-weight: bold;
    color: #111;
    outline: none;
}
.qty-input::-webkit-outer-spin-button,
.qty-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
</style>