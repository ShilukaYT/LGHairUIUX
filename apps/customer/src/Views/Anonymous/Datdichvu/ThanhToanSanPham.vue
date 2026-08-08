<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { KHO_ORIGIN, calculateShippingFee } from './shippingCalculator';
import { clearCartDB, removeFromCartDB } from '@/Views/Anonymous/CSDL/cartDB';

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

// ==========================================
// HÓA ĐƠN ĐIỆN TỬ
// Mặc định luôn xuất hóa đơn cá nhân, dùng Email + Địa chỉ đã nhập ở trên (không hỏi lại).
// Chỉ mở rộng khi khách cần hóa đơn công ty (có MST).
// ==========================================
const showInvoiceCompanyForm = ref(false);
const invoiceCompany = ref({ tenCongTy: '', mst: '' });
const mstError = ref('');

const validateMst = (): boolean => {
    if (!showInvoiceCompanyForm.value) {
        mstError.value = '';
        return true;
    }
    const mst = (invoiceCompany.value.mst || '').trim();
    const isValid = /^\d{10}$/.test(mst) || /^\d{10}-\d{3}$/.test(mst);
    mstError.value = isValid ? '' : 'Mã số thuế không hợp lệ (10 số, hoặc 10 số-3 số chi nhánh)';
    return isValid;
};

const validateInvoiceInfo = (): string | null => {
    if (!showInvoiceCompanyForm.value) return null;
    if (!validateMst()) return mstError.value;
    const tenCty = (invoiceCompany.value.tenCongTy || '').trim();
    if (tenCty.length < 3) return 'Vui lòng nhập đúng tên công ty (tối thiểu 3 ký tự)';
    return null;
};

function buildInvoiceInfoPayload() {
    return {
        laDoanhNghiep: showInvoiceCompanyForm.value,
        tenCongTy: showInvoiceCompanyForm.value ? invoiceCompany.value.tenCongTy : null,
        mst: showInvoiceCompanyForm.value ? invoiceCompany.value.mst : null,
        diaChiXuatHD: orderData.value.address || null,
        emailNhanHD: orderData.value.email || null
    };
}

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
            hinhAnh: bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien,
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
const stackPreview = ref({ totalDiscount: 0, finalAmount: 0, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 });



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
        const res = await axios.get(`${API}/api/ThanhToanSanPham/get-my-vouchers/${customer.maKH}`, {
            params: { subTotal: subTotal.value, productIds: productIds }
        });
        myVouchers.value = res.data;
        orderData.value.voucherIds = orderData.value.voucherIds.filter(id => {
            const v = myVouchers.value.find((x: any) => x.id === id);
            return v && !isVoucherDisabled(v);
        });
    } catch (error) {
        console.error("Lỗi load voucher:", error);
    }
};

const refreshStackPreview = async () => {
    if (!customer.maKH || customer.maKH === 'GUEST') {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value + shippingFee.value, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 };
        return;
    }
    try {
        const codes = orderData.value.voucherIds.join(',');
        const res = await axios.get(`${API}/api/ThanhToanSanPham/preview-voucher-stack`, {
            params: {
                maKH: customer.maKH,
                codes,
                subTotal: subTotal.value,
                productIds: productItems.value.map(p => p.id).join(',')
            }
        });
        stackPreview.value = {
            totalDiscount: Number(res.data.totalDiscount) || 0,
            finalAmount: (Number(res.data.finalAmount) || subTotal.value) + shippingFee.value,
            memberDiscount: Number(res.data.memberDiscount) || 0,
            voucherAmount: Number(res.data.voucherAmount) || 0,
            memberRankPercent: Number(res.data.memberRankPercent) || 0
        };
    } catch (e: any) {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value + shippingFee.value, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 };
        const msg = e.response?.data?.message || 'Voucher không đủ điều kiện áp dụng!';
        Swal.fire({ title: 'Opps!', text: msg, icon: 'warning', confirmButtonText: 'Đã hiểu', confirmButtonColor: '#d4af37' });
        if (orderData.value.voucherIds.length > 0) {
            orderData.value.voucherIds.pop();
        }
    }
};

const isVoucherDisabled = (v: any) => {
    if (v.isAvailable === false) return true;
    if (v.desc && v.desc.includes('Đơn tối thiểu')) {
        const match = v.desc.match(/Đơn tối thiểu ([\d,]+)đ/);
        if (match) {
            const minVal = parseInt(match[1].replace(/,/g, ''));
            if (subTotal.value < minVal) return true;
        }
    }
    return false;
};

watch([() => orderData.value.voucherIds.slice(), subTotal, shippingFee, () => productItems.value.length], () => {
    refreshStackPreview();
}, { deep: true, immediate: true });

function toggleVoucher(id: string) {
    const ids = orderData.value.voucherIds;
    const v = myVouchers.value.find(x => x.id === id);
    if (v && isVoucherDisabled(v)) {
        Swal.fire({ title: 'Không hợp lệ', text: 'Không thể áp dụng voucher: ' + (v.errorMessage || 'Chưa đủ điều kiện.'), icon: 'warning', confirmButtonText: 'Đã hiểu', confirmButtonColor: '#d4af37' });
        return;
    }
    const i = ids.indexOf(id);
    if (i >= 0) { ids.splice(i, 1); return; }
    if (ids.length >= 2) {
        Swal.fire({ title: 'Giới hạn voucher', text: 'Chỉ chọn tối đa 2 voucher.', icon: 'info', confirmButtonText: 'Đã hiểu', confirmButtonColor: '#d4af37' });
        return;
    }
    ids.push(id);
}

const discountAmount = computed(() => stackPreview.value.totalDiscount);
const memberDiscount = computed(() => stackPreview.value.memberDiscount);
const voucherAmount = computed(() => stackPreview.value.voucherAmount);
const memberRankPercent = computed(() => stackPreview.value.memberRankPercent);
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
        Swal.fire({ title: 'Thiếu thông tin', text: 'Vui lòng điền đầy đủ Họ tên, Số điện thoại và Địa chỉ giao hàng chi tiết!', icon: 'warning', confirmButtonColor: '#d4af37' });
        return;
    }

    if (productItems.value.length === 0) {
        Swal.fire({ title: 'Giỏ hàng trống', text: 'Giỏ hàng của bạn đang trống! Vui lòng chọn sản phẩm.', icon: 'warning', confirmButtonColor: '#d4af37' });
        return;
    }

    const invoiceErr = validateInvoiceInfo();
    if (invoiceErr) {
        Swal.fire({ title: 'Lỗi hoá đơn', text: invoiceErr, icon: 'warning', confirmButtonColor: '#d4af37' });
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
            })),
            invoiceInfo: buildInvoiceInfoPayload()
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
            
            await clearCartDB(customer?.maKH || 'GUEST'); // Backup xóa thêm theo luồng cũ
            
            productItems.value = [];                 // Làm rỗng mảng hiển thị hiện tại

            // ==================================================
            // 2. XỬ LÝ CHUYỂN HƯỚNG
            // ==================================================
            if (res.data.isOnlinePayment && res.data.url) {
                // Đã xóa giỏ hàng xong -> Bay sang trang nhập thẻ của VNPay/MoMo
                window.location.href = res.data.url;
            } else {
                // COD -> Chuyển sang trang kết quả thanh toán sản phẩm
                const orderId = res.data.orderId || res.data.maHd || res.data.data?.orderId || res.data.data?.maHd || '';
                router.push({
                    path: '/payment-result-san-pham',
                    query: {
                        orderId: orderId,
                        amount: finalTotal.value,
                        cod: 'true'
                    }
                });
            }
        }
    } catch (error: any) {
        console.error("Error creating order:", error);
        Swal.fire({ title: 'Lỗi', text: error.response?.data?.message || "Có lỗi xảy ra khi lưu đơn hàng! Vui lòng thử lại.", icon: 'error', confirmButtonColor: '#d4af37' });
    } finally {
    }
};

const formatMoney = (money: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(money || 0);
</script>

<template>
    <div class="booking-container">
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="text-center mb-12" data-aos="fade-down">
                <h1 class="font-heading tracking-[0.2em] font-medium text-black text-3xl lg:text-4xl uppercase">GIAO HÀNG TẬN NƠI</h1>
                <p class="text-gray-400 mt-2 text-xs uppercase tracking-widest">Điền thông tin địa chỉ để chúng tôi giao sản phẩm đến tay bạn</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-7 space-y-6" data-aos="fade-right">
                    <div class="glass-card left-main-card">
                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                <i class="fas fa-shipping-fast me-2 text-black"></i> THÔNG TIN NGƯỜI NHẬN
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
                                            <div class="inline-flex items-center px-2.5 py-1 bg-black text-white text-xs font-bold mb-1 shadow-sm">
                                                <i class="fas fa-route me-1.5"></i> Quãng đường: {{ isCalculatingRoute ? 'Đang tính...' : (distanceText || 'Không xác định') }}
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
                            <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                <i class="fas fa-wallet me-2 text-black"></i> PHƯƠNG THỨC THANH TOÁN
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="payment-method-row mt-3">
                            <div class="method-option cod" :class="{ active: orderData.paymentMethod === 'cod' }"
                                @click="orderData.paymentMethod = 'cod'">
                                <div class="method-logo-wrapper">
                                    <div class="cod-icon-wrapper">
                                        <svg class="cod-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M14 18H6C4.89543 18 4 17.1046 4 16V6C4 4.89543 4.89543 4 6 4H14V18Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                                            <path d="M14 8H20L22 11V16C22 17.1046 21.1046 18 20 18H18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                                            <circle cx="7.5" cy="18.5" r="2.5" stroke="currentColor" stroke-width="2"/>
                                            <circle cx="17.5" cy="18.5" r="2.5" stroke="currentColor" stroke-width="2"/>
                                            <path d="M14 4V18" stroke="currentColor" stroke-width="2"/>
                                        </svg>
                                    </div>
                                    <span class="method-label font-bold">COD</span>
                                </div>
                            </div>
                            <div class="method-option vnpay" :class="{ active: orderData.paymentMethod === 'vnpay' }"
                                @click="orderData.paymentMethod = 'vnpay'">
                                <div class="method-logo-wrapper">
                                    <img src="/vnpay-logo.png" alt="VNPay" class="method-logo-img">
                                </div>
                            </div>
                            <div class="method-option momo" :class="{ active: orderData.paymentMethod === 'momo' }"
                                @click="orderData.paymentMethod = 'momo'">
                                <div class="method-logo-wrapper">
                                    <img src="/momo-logo.png" alt="MoMo" class="method-logo-img">
                                </div>
                            </div>
                        </div>

                        <!-- HÓA ĐƠN CÔNG TY (thu gọn, mặc định đóng) -->
                        <div class="invoice-toggle-line mt-4" @click="showInvoiceCompanyForm = !showInvoiceCompanyForm">
                            <span class="font-bold text-black" style="font-size: 14px;">
                                <i class="fas fa-building me-2"></i> Cần hóa đơn công ty (có MST)?
                            </span>
                            <i class="fas fa-chevron-down invoice-toggle-arrow" :class="{ open: showInvoiceCompanyForm }"></i>
                        </div>
                        <transition name="list-fade">
                            <div v-if="showInvoiceCompanyForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div>
                                    <label class="custom-label font-bold">Tên công ty *</label>
                                    <input v-model="invoiceCompany.tenCongTy" type="text" class="booking-input w-full"
                                        placeholder="Công ty TNHH ABC">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Mã số thuế *</label>
                                    <input v-model="invoiceCompany.mst" type="text" class="booking-input w-full"
                                        @blur="validateMst" placeholder="0301234567">
                                    <p v-if="mstError" class="text-danger small mt-1 mb-0 font-bold">{{ mstError }}</p>
                                </div>
                            </div>
                        </transition>

                        <!-- KHO VOUCHER -->
                        <div class="mt-8">
                            <div class="section-heading-wrapper">
                                <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                    <i class="fas fa-ticket-alt me-2"></i> KHO VOUCHER CỦA BẠN
                                </h3>
                                <div class="heading-line"></div>
                            </div>
                            <div v-if="myVouchers.length > 0" class="voucher-list-modern">
                                <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                    :class="{ active: orderData.voucherIds.includes(v.id), disabled: isVoucherDisabled(v) }" @click="toggleVoucher(v.id)">
                                    <div class="ticket-left">
                                        <span class="ticket-brand-text">LGHAIR</span>
                                        <span class="notch top"></span><span class="notch bottom"></span>
                                    </div>
                                    <div class="v-divider"></div>
                                    <div class="ticket-right">
                                        <div class="d-flex justify-content-between align-items-start mb-2">
                                            <span class="v-code-badge">{{ v.code }}</span>
                                            <span class="v-expiry-tag"><i class="far fa-calendar-alt me-1.5"></i>HSD: {{ v.expiry }}</span>
                                        </div>
                                        <div class="v-price-gold font-bold">Giảm: {{ v.discount.toLocaleString() }}đ</div>
                                        <div class="v-desc text-black mt-1">{{ v.desc }}</div>
                                    </div>
                                    <div class="v-check-icon" v-if="orderData.voucherIds.includes(v.id)">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                </div>
                            </div>
                            <div v-else class="text-gray-500 italic mt-3 text-sm font-bold">
                                Không có voucher nào khả dụng cho đơn hàng của bạn lúc này.
                            </div>
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-5" data-aos="fade-left">
                    <div class="sticky-bill">
                        <div class="glass-card bill-card">
                            <div class="section-heading-wrapper justify-content-center text-center mb-4">
                                <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                    <i class="fas fa-file-invoice-dollar me-2 text-black"></i> CHI TIẾT ĐƠN HÀNG
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
                                                            <span class="item-price-text text-black font-bold">{{ formatMoney(bt.giaBan) }}</span>
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
                                                <div class="p text-black font-bold mt-1">{{ formatMoney(p.gia) }}</div>
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
                                <div class="total-line saving" v-if="memberDiscount > 0">
                                    <span>Giảm giá thành viên ({{ memberRankPercent }}%)</span>
                                    <b>-{{ formatMoney(memberDiscount) }}</b>
                                </div>
                                <div class="total-line saving" v-if="voucherAmount > 0">
                                    <span>Giảm voucher</span>
                                    <b>-{{ formatMoney(voucherAmount) }}</b>
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
    --primary-metallic: linear-gradient(135deg, #1a1a1a 0%, #000000 100%);
    --primary-color: #000000;
    --primary-hover: #1f2937;
    --primary-light: #fafafa;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #e5e7eb;
    
    background-color: #ffffff;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
    line-height: 1.6;
    position: relative;
}

/* Background glows for a premium aesthetic */
.booking-container::before {
    content: '';
    position: absolute;
    top: -10%;
    left: -10%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(0, 0, 0, 0.015) 0%, rgba(255, 255, 255, 0) 70%);
    pointer-events: none;
    z-index: 0;
}

.booking-container::after {
    content: '';
    position: absolute;
    bottom: -10%;
    right: -10%;
    width: 800px;
    height: 800px;
    background: radial-gradient(circle, rgba(0, 0, 0, 0.01) 0%, rgba(255, 255, 255, 0) 70%);
    pointer-events: none;
    z-index: 0;
}

.max-w-6xl {
    position: relative;
    z-index: 10;
}

/* Typography & Titles */
.font-playfair, h1, h2, h3, h4, h5, h6, .section-heading-title {
    font-family: 'Montserrat', sans-serif !important;
}

input, select, textarea, button, .booking-input {
    font-family: 'Inter', sans-serif !important;
}

.font-bold {
    font-weight: 600 !important;
}

h1 {
    letter-spacing: 2px;
    font-weight: 800;
    color: var(--text-primary);
}

.accent-line {
    width: 60px;
    height: 1px;
    background: var(--primary-color);
    margin: 15px auto;
    border-radius: 0px;
}

/* Section headings */
.section-heading-wrapper {
    position: relative;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-color);
}

.section-heading-wrapper.justify-content-center {
    align-items: center;
}

.section-heading-title {
    font-size: 1.15rem;
    font-weight: 700;
    letter-spacing: 0.5px;
    color: var(--text-primary);
    text-transform: uppercase;
    display: flex;
    align-items: center;
}

.section-heading-title i {
    color: var(--primary-color);
    font-size: 1.1rem;
}

.heading-line {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 50px;
    height: 2px;
    background: var(--primary-color);
}

.section-heading-wrapper.justify-content-center .heading-line {
    left: 50%;
    transform: translateX(-50%);
}

/* Main Cards - Premium Glassmorphism style */
.glass-card {
    background: #ffffff;
    padding: 32px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.01);
    transition: all 0.3s ease;
}

.left-main-card:hover, .bill-card:hover {
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.03);
}

/* Forms & Inputs */
.custom-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 6px;
    display: block;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.booking-input {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    background: #ffffff;
    outline: none;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.booking-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
    background: #ffffff;
}

select.booking-input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23111827' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 14px;
    padding-right: 40px;
}

textarea.booking-input {
    height: auto;
    padding: 12px 16px;
    border-radius: 0px;
}

/* Shipping info card */
.shipping-info-card {
    background: #fafafa;
    border: 1px solid var(--border-color);
    border-radius: 0px;
    padding: 16px;
    margin-top: 12px;
}

.shipping-info-card h6 {
    font-family: 'Montserrat', sans-serif !important;
    font-weight: 700;
    color: var(--text-primary);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Payment Methods */
.payment-method-row {
    display: flex;
    gap: 16px;
}

.invoice-toggle-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border: 1px solid var(--border-color);
    padding: 12px 16px;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.25s ease;
}

.invoice-toggle-line:hover {
    border-color: #bfa77a;
}

.invoice-toggle-arrow {
    font-size: 12px;
    color: #9ca3af;
    transition: transform 0.25s ease;
}

.invoice-toggle-arrow.open {
    transform: rotate(180deg);
}

.method-option {
    flex: 1;
    border: 1px solid var(--border-color);
    padding: 10px 16px;
    border-radius: 0px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 80px;
    overflow: hidden;
}

/* VNPay Branding */
.method-option.vnpay {
    position: relative;
    border: 1px solid var(--border-color);
}

.method-option.vnpay:hover {
    border-color: rgba(0, 106, 194, 0.4);
    transform: translateY(-2px);
}

.method-option.vnpay.active {
    border-color: #006ac2;
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(0, 106, 194, 0.08);
    border-width: 2px;
    transform: scale(1.02);
}

/* MoMo Branding */
.method-option.momo {
    position: relative;
    border: 1px solid var(--border-color);
}

.method-option.momo:hover {
    border-color: rgba(216, 45, 139, 0.4);
    transform: translateY(-2px);
}

.method-option.momo.active {
    border-color: #d82d8b;
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(216, 45, 139, 0.08);
    border-width: 2px;
    transform: scale(1.02);
}

/* COD Branding */
.method-option.cod {
    position: relative;
    border: 1px solid var(--border-color);
}

.method-option.cod:hover {
    border-color: rgba(22, 163, 74, 0.4);
    transform: translateY(-2px);
}

.method-option.cod.active {
    border-color: #16a34a;
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(22, 163, 74, 0.08);
    border-width: 2px;
    transform: scale(1.02);
}

.cod-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 42px;
    height: 42px;
    background: #e2fbe9;
    border-radius: 50%;
    margin-right: 12px;
    transition: all 0.3s ease;
    box-shadow: 0 2px 6px rgba(22, 163, 74, 0.08);
}

.method-option.cod.active .cod-icon-wrapper {
    background: #16a34a;
    box-shadow: 0 4px 10px rgba(22, 163, 74, 0.2);
}

.cod-svg-icon {
    width: 22px;
    height: 22px;
    color: #16a34a;
    transition: all 0.3s ease;
}

.method-option.cod.active .cod-svg-icon {
    color: #ffffff;
}

.method-option.cod.active .method-label {
    color: #16a34a;
    transition: all 0.3s ease;
}

.method-logo-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    gap: 8px;
}

.method-logo-img {
    height: 48px;
    max-width: 85%;
    object-fit: contain;
    border-radius: 8px;
    transition: all 0.3s ease;
}

.method-option.active .method-logo-img {
    transform: scale(1.08);
}

.method-label {
    font-family: 'Montserrat', sans-serif !important;
    font-weight: 700;
    font-size: 1.2rem;
    color: var(--text-primary);
}



/* Voucher ticket system */
.voucher-list-modern {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
}

.voucher-ticket-item {
    display: flex;
    width: 100%;
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 0px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
    min-height: 100px;
}

.voucher-ticket-item:hover {
    border-color: #000000;
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.04);
}

.voucher-ticket-item.active {
    border: 2px solid #000000;
    background: #fafafa;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

.ticket-left {
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    width: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    flex-shrink: 0;
}

.ticket-brand-text {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 3px;
    color: #dfb85b;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    transform: rotate(180deg);
}

.notch {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #ffffff;
    border-radius: 50%;
    right: -6px;
    z-index: 10;
}

.notch.top {
    top: -6px;
}

.notch.bottom {
    bottom: -6px;
}

.v-divider {
    width: 1px;
    border-left: 1px dashed var(--border-color);
    height: 100%;
}

.ticket-right {
    padding: 16px 20px;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #ffffff;
}

.voucher-ticket-item.active .ticket-right {
    background: #fafafa;
}

.v-code-badge {
    font-size: 10px;
    font-weight: 700;
    color: #111827;
    background: #f3f4f6;
    padding: 3px 8px;
    letter-spacing: 1px;
    border: 1px solid var(--border-color);
    display: inline-block;
}

.v-expiry-tag {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted);
    display: flex;
    align-items: center;
}

.v-desc {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-top: 4px;
}

.v-price-gold {
    font-size: 16px;
    font-weight: 800;
    color: #111827;
    margin-top: 4px;
}

.v-check-icon {
    position: absolute;
    top: 14px;
    right: 14px;
    color: #111827;
    font-size: 18px;
}

/* Service Search Box Dropdown in Invoice card */
.search-box-wrapper {
    position: relative;
}

.input-wrap {
    position: relative;
    width: 100%;
}

.search-input {
    width: 100%;
    height: 46px;
    padding-left: 44px;
    padding-right: 16px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    background: #ffffff;
    outline: none;
    font-size: 13px;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.search-input:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.05);
}

.search-icon {
    position: absolute;
    left: 18px;
    top: 50%;
    transform: translateY(-50%);
    color: #9ca3af;
    font-size: 14px;
    pointer-events: none;
    z-index: 5;
}

.service-dropdown-list {
    position: absolute;
    top: 108%;
    left: 0;
    width: 100%;
    background: #ffffff;
    border-radius: 0px;
    z-index: 1000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.06);
    border: 1px solid var(--border-color);
    overflow: hidden;
}

.dropdown-header {
    padding: 10px 16px;
    background: #f9fafb;
    font-size: 10px;
    font-weight: 700;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid #f3f4f6;
}

.dropdown-scroll-area {
    max-height: 250px;
    overflow-y: auto;
}

.service-dropdown-item {
    padding: 10px 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    border-bottom: 1px solid #fcfcfc;
    transition: all 0.2s ease;
}

.service-dropdown-item:hover {
    background: var(--primary-light);
}

.item-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.item-details .item-name-text {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
}

.item-price-text {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
}

.add-btn-icon {
    color: var(--primary-color);
    font-size: 18px;
    transition: transform 0.2s ease;
}

.service-dropdown-item:hover .add-btn-icon {
    transform: scale(1.1);
}

.dropdown-close-footer {
    text-align: center;
    padding: 12px;
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    cursor: pointer;
    border-top: 1px solid #f3f4f6;
    background: #f9fafb;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
}

.dropdown-close-footer:hover {
    background: #e5e7eb;
    color: var(--text-primary);
}

/* Selected service item row in bill card */
.selected-items-wrapper {
    max-height: 220px;
    overflow-y: auto;
    padding-right: 4px;
}

.selected-items-wrapper::-webkit-scrollbar {
    width: 4px;
}

.selected-items-wrapper::-webkit-scrollbar-thumb {
    background-color: #e5e7eb;
    border-radius: 2px;
}

.item-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    background: #ffffff;
    border-radius: 0px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
}

.item-row:hover {
    border-color: rgba(0, 0, 0, 0.2);
    background: #ffffff;
}

.item-row img {
    border-radius: 0px;
    object-fit: cover;
}

.item-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    align-items: flex-start;
}

.item-info .n {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
}

.item-info .p {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
}

.del-btn {
    border: none;
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
    font-size: 13px;
    padding: 6px;
    transition: all 0.2s ease;
}

.del-btn:hover {
    color: #ef4444;
    transform: scale(1.1);
}

.quantity-pill {
    display: flex;
    align-items: center;
    border: 1px solid var(--border-color);
    border-radius: 0px;
    padding: 2px 8px;
    background: #ffffff;
    height: 32px;
}

.qty-btn {
    border: none;
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    transition: all 0.2s;
}

.qty-btn:hover {
    color: var(--primary-color);
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

/* Invoice / Bill details */
.total-box {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px dashed #e5e7eb;
}

.total-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary);
}

.total-line span {
    font-weight: 500;
}

.total-line b {
    font-weight: 600;
    color: var(--text-primary);
}

.total-line.saving {
    color: #16a34a;
}
.total-line.saving b {
    color: #16a34a;
}

.total-line.text-danger {
    color: #ef4444 !important;
}
.total-line.text-danger b,
.total-line.text-danger span {
    color: #ef4444 !important;
}

.grand-line {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 16px;
    border-top: 1px dashed #e5e7eb;
    padding-top: 16px;
}

.grand-line span {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.grand-line b {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
}

.pay-line {
    background: #f0fdf4;
    padding: 12px;
    border-radius: 0px;
    border: 1px solid #bbf7d0;
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #15803d;
}

.pay-line span {
    font-size: 11px;
    font-weight: 700;
    color: #15803d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.pay-line b {
    font-size: 1.35rem;
    font-weight: 800;
    color: #16a34a;
}

/* Premium Confirmation Button */
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

/* Animations */
.list-fade-enter-active,
.list-fade-leave-active {
    transition: all 0.3s ease;
}

.list-fade-enter-from {
    opacity: 0;
    transform: translateX(20px);
}

.list-fade-leave-to {
    opacity: 0;
    transform: scale(0.9);
}

.sticky-bill {
    position: sticky;
    top: 100px;
}

/* Responsive Media Queries */
@media (max-width: 991px) {
    .sticky-bill {
        position: static;
        margin-top: 24px;
    }
    
    .glass-card {
        padding: 24px;
    }
}
</style>