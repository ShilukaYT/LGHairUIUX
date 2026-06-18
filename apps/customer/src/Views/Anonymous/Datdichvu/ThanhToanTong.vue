<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { getCartDB, removeFromCartDB, addToCartDB } from '@/Views/Anonymous/CSDL/cartDB';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';
import { KHO_ORIGIN, calculateShippingFee } from './shippingCalculator';

const API = import.meta.env.VITE_API_URL;
const router = useRouter();

type ServiceItem = {
    id: any;
    name: string;
    price: number;
    originalPrice: number;
    icon: string;
    duration: number;
    hinhAnh?: string;
};

type ProductItem = {
    id: any;
    tenItem: string;
    gia: number;
    hinhAnh?: string;
    soLuong: number;
};

const customer = getCustomerInfo();
const customerId = ref(customer.maKH || 'GUEST');

const allItemsFromApi = ref<any[]>([]);
const allProductsFromApi = ref<any[]>([]);
const stylists = ref<any[]>([]);
const loadingStylists = ref(false);
const stylistMessage = ref('');
const myVouchers = ref<any[]>([]);

const tempDate = ref('');
const tempTime = ref('');

const bookingData = ref({
    customerName: customer.hoTen !== 'Khách vãng lai' ? customer.hoTen : '',
    phone: customer.sdt || '',
    email: customer.email || '',
    bookingDate: '',
    stylistId: null as string | null,
    selectedServices: [] as ServiceItem[],
    voucherIds: [] as string[],
    paymentMode: '10',
    paymentMethod: 'vnpay',
    note: ''
});

const productData = ref({
    receiveType: 'store' as 'store' | 'home',
    receiverName: customer.hoTen !== 'Khách vãng lai' ? customer.hoTen : '',
    receiverPhone: customer.sdt || '',
    receiverEmail: customer.email || '',
    address: '',
    deliveryNote: '',
    paymentMethod: 'cod'
});

const productItems = ref<ProductItem[]>([]);

const serviceSearch = ref('');
const productSearch = ref('');
const showServiceDropdown = ref(false);
const showProductDropdown = ref(false);

const minDate = new Date().toISOString().split('T')[0];

const availableHours = computed(() => {
    const hours: string[] = [];
    for (let i = 8; i <= 20; i++) {
        hours.push(i < 10 ? `0${i}:00` : `${i}:00`);
        hours.push(i < 10 ? `0${i}:30` : `${i}:30`);
    }
    return hours;
});

const estimatedTotalMinutes = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + Number(s.duration || 30), 0);
});

const expectedEndTime = computed(() => {
    if (!tempTime.value || estimatedTotalMinutes.value === 0) return '';
    const [h = 0, m = 0] = tempTime.value.split(':').map(Number);
    const total = h * 60 + m + estimatedTotalMinutes.value;
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${hh < 10 ? '0' + hh : hh}:${mm < 10 ? '0' + mm : mm}`;
});

const combineDateTime = () => {
    if (tempDate.value && tempTime.value) {
        bookingData.value.bookingDate = `${tempDate.value}T${tempTime.value}`;
    }
};

const normalizeStylist = (item: any) => {
    const id = String(item.id ?? item.maNV ?? item.maNhanVien ?? item.maStylist ?? item.userId ?? '');
    return {
        ...item,
        id,
        name: item.name ?? item.hoTen ?? item.tenNhanVien ?? item.tenStylist ?? item.fullName ?? 'Stylist',
        phone: item.phone ?? item.sdt ?? item.soDienThoai ?? '',
        avatar: item.avatar ?? item.hinhAnh ?? item.anhDaiDien ?? '',
        rating: item.rating ?? item.danhGia ?? null
    };
};

const canSearchStylist = computed(() => {
    return bookingData.value.selectedServices.length > 0 && !!tempDate.value && !!tempTime.value;
});

const selectedStylist = computed(() => {
    return stylists.value.find(s => String(s.id) === String(bookingData.value.stylistId));
});

const serviceSubTotal = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);
});

const serviceOriginalTotal = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + Number(s.originalPrice || s.price || 0), 0);
});

const productSubTotal = computed(() => {
    return productItems.value.reduce((sum, p) => sum + Number(p.gia || 0) * Number(p.soLuong || 1), 0);
});

const needDeliveryAddress = computed(() => {
    return productItems.value.length > 0 && productData.value.receiveType === 'home';
});

const distanceText = ref<string>('');
const shippingFee = ref<number>(0);
const isCalculatingRoute = ref(false);

const calculateRouteAndFee = () => {
    if (!productData.value.address || productData.value.receiveType !== 'home') {
        shippingFee.value = 0;
        distanceText.value = '';
        return;
    }

    isCalculatingRoute.value = true;
    
    setTimeout(() => {
        const destLower = productData.value.address.toLowerCase();
        let distanceInKm = 0;

        if (destLower.includes("buôn ma thuột") || destLower.includes("bmt")) {
            distanceInKm = Math.floor(Math.random() * 10) + 2; 
        } else if (destLower.includes("đắk lắk") || destLower.includes("dak lak")) {
            distanceInKm = Math.floor(Math.random() * 40) + 20; 
        } else {
            distanceInKm = Math.floor(Math.random() * 200) + 100; 
        }

        distanceText.value = `~${distanceInKm} km`;
        shippingFee.value = calculateShippingFee(distanceInKm, productData.value.address);
        isCalculatingRoute.value = false;
    }, 600);
};

let addressTimeout: any = null;
watch(() => productData.value.address, (newAddress) => {
    clearTimeout(addressTimeout);
    if (!newAddress || productData.value.receiveType !== 'home') {
        shippingFee.value = 0;
        distanceText.value = '';
        return;
    }
    addressTimeout = setTimeout(() => {
        calculateRouteAndFee();
    }, 1000);
});

const stackPreview = ref({ totalDiscount: 0, finalAmount: 0 });
const discountAmount = computed(() => Number(stackPreview.value.totalDiscount || 0));
const serviceAfterVoucher = computed(() => Math.max(0, serviceSubTotal.value - discountAmount.value));
const grandTotal = computed(() => Math.max(0, stackPreview.value.finalAmount) + shippingFee.value);

const payNow = computed(() => {
    let servicePayment = serviceAfterVoucher.value;
    if (bookingData.value.paymentMode === '10') {
        servicePayment = serviceAfterVoucher.value * 0.1;
    }
    
    const remainingDiscount = Math.max(0, discountAmount.value - serviceSubTotal.value);
    const productAfterVoucher = Math.max(0, productSubTotal.value - remainingDiscount);
    
    let productPayment = productAfterVoucher + shippingFee.value;
    if (productData.value.paymentMethod === 'cod' || productData.value.receiveType === 'store') {
        productPayment = 0;
    }
    
    return servicePayment + productPayment;
});

const remainAtStore = computed(() => {
    let total = 0;

    // Dịch vụ: còn lại 90% khi cọc 10%
    if (bookingData.value.selectedServices.length > 0 && bookingData.value.paymentMode === '10') {
        total += serviceAfterVoucher.value * 0.9;
    }

    // Sản phẩm: nhận tại tiệm → trả tại tiệm
    if (productItems.value.length > 0 && productData.value.receiveType === 'store') {
        const remainingDiscount = Math.max(0, discountAmount.value - serviceSubTotal.value);
        const productAfterVoucher = Math.max(0, productSubTotal.value - remainingDiscount);
        total += productAfterVoucher;
    }

    return total;
});

const remainCOD = computed(() => {
    if (productItems.value.length === 0 || productData.value.paymentMethod !== 'cod') return 0;
    const remainingDiscount = Math.max(0, discountAmount.value - serviceSubTotal.value);
    const productAfterVoucher = Math.max(0, productSubTotal.value - remainingDiscount);
    return productAfterVoucher + shippingFee.value;
});

const filteredServices = computed(() => {
    const query = serviceSearch.value.toLowerCase().trim();
    let list = allItemsFromApi.value;
    if (query) {
        list = list.filter(s => String(s.name || '').toLowerCase().includes(query));
    }
    return list.filter(item => !bookingData.value.selectedServices.find(s => s.id === item.id));
});

let productSearchTimeout: any = null;
watch(productSearch, (newVal) => {
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        loadProducts(newVal);
    }, 500);
});

const formatMoney = (money: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(money || 0));
};

const addService = async (service: any) => {
    if (bookingData.value.selectedServices.find(s => s.id === service.id)) return;

    bookingData.value.selectedServices.push({
        id: service.id,
        name: service.name,
        price: Number(service.price || 0),
        originalPrice: Number(service.originalPrice || service.price || 0),
        icon: service.icon || 'fas fa-check-circle',
        duration: Number(service.duration || 30),
        hinhAnh: service.hinhAnh
    });

    try {
        await addToCartDB({
            id: service.id,
            tenItem: service.name,
            gia: Number(service.price || 0),
            giaGoc: Number(service.originalPrice || service.price || 0),
            type: 'DICHVU',
            duration: Number(service.duration || 30),
            hinhAnh: service.icon || 'fas fa-check-circle'
        }, customerId.value || 'GUEST');
    } catch (error) {
        console.error('Lỗi lưu dịch vụ vào giỏ:', error);
    }

    serviceSearch.value = '';
    showServiceDropdown.value = false;
    await loadVouchers();
};

const removeService = async (id: any) => {
    bookingData.value.selectedServices = bookingData.value.selectedServices.filter(s => s.id !== id);
    try {
        await removeFromCartDB(id);
    } catch (error) {
        console.error('Lỗi xóa dịch vụ:', error);
    }
    await loadVouchers();
};

const addProduct = (sp: any, bt: any) => {
    if (bt.soLuongTon <= 0 || productItems.value.some(p => p.id === bt.maBienThe)) return;

    productItems.value.push({
        id: bt.maBienThe,
        tenItem: `${sp.tenSp} - ${bt.tenBienThe}`,
        gia: Number(bt.giaBan || 0),
        hinhAnh: bt.hinhAnh,
        soLuong: 1
    });

    productSearch.value = '';
    showProductDropdown.value = false;
};

const removeProduct = (id: any) => {
    productItems.value = productItems.value.filter(p => p.id !== id);
};

const increaseQuantity = (item: ProductItem) => {
    item.soLuong++;
};

const decreaseQuantity = (item: ProductItem) => {
    if (item.soLuong > 1) item.soLuong--;
};

const validateQuantity = (item: ProductItem) => {
    if (typeof item.soLuong !== 'number' || isNaN(item.soLuong) || item.soLuong < 1) {
        item.soLuong = 1;
    }
};

// ==========================================
// TÍNH TỔNG TIỀN VÀ GOM ID (DỊCH VỤ + SẢN PHẨM)
// ==========================================
const combinedSubTotal = computed(() => serviceSubTotal.value + productSubTotal.value);

const combinedItemIds = computed(() => {
    const sIds = bookingData.value.selectedServices.map(s => s.id);
    const pIds = productItems.value.map(p => p.id);
    return [...sIds, ...pIds].join(',');
});

const loadVouchers = async () => {
    if (!customerId.value || customerId.value === 'GUEST') return;
    try {
        // Đổi về Controller ThanhToanTong
        const res = await axios.get(`${API}/api/ThanhToanTong/get-my-vouchers/${customerId.value}`, {
            params: {
                subTotal: combinedSubTotal.value, 
                ngayGioHen: bookingData.value.bookingDate || undefined,
                itemIds: combinedItemIds.value || undefined // Đổi serviceIds thành itemIds
            }
        });
        myVouchers.value = res.data || [];
        bookingData.value.voucherIds = bookingData.value.voucherIds.filter(id =>
            myVouchers.value.some(v => v.id === id)
        );
    } catch (error) {
        console.error('Lỗi load voucher:', error);
    }
};

const refreshStackPreview = async () => {
    if (!customerId.value || customerId.value === 'GUEST' || bookingData.value.voucherIds.length === 0) {
        stackPreview.value = { totalDiscount: 0, finalAmount: combinedSubTotal.value };
        return;
    }
    try {
        const codes = bookingData.value.voucherIds.join(',');
        // Đổi về Controller ThanhToanTong
        const res = await axios.get(`${API}/api/ThanhToanTong/preview-voucher-stack`, {
            params: {
                maKH: customerId.value,
                codes,
                subTotal: combinedSubTotal.value,
                ngayGioHen: bookingData.value.bookingDate || undefined,
                itemIds: combinedItemIds.value || undefined // Đổi serviceIds thành itemIds
            }
        });
        stackPreview.value = {
            totalDiscount: Number(res.data.totalDiscount) || 0,
            finalAmount: Number(res.data.finalAmount) || combinedSubTotal.value
        };
    } catch {
        stackPreview.value = { totalDiscount: 0, finalAmount: combinedSubTotal.value };
    }
};

function toggleVoucher(id: string) {
    const ids = bookingData.value.voucherIds;
    const i = ids.indexOf(id);
    if (i >= 0) {
        ids.splice(i, 1);
        return;
    }
    if (ids.length >= 2) {
        alert('Chỉ chọn tối đa 2 voucher.');
        return;
    }
    ids.push(id);
}

const loadAvailableStylists = async () => {
    combineDateTime();

    if (!canSearchStylist.value) {
        stylists.value = [];
        bookingData.value.stylistId = null;
        stylistMessage.value = 'Chọn đủ dịch vụ, ngày và giờ để hệ thống hiển thị stylist phù hợp.';
        return;
    }

    loadingStylists.value = true;
    stylistMessage.value = '';

    try {
        const res = await axios.post(`${API}/api/DatDichVu/get-available-stylists`, {
            ngayHen: tempDate.value,
            gioBatDau: tempTime.value,
            tongThoiGian: estimatedTotalMinutes.value,
            serviceIds: bookingData.value.selectedServices.map(s => s.id)
        });

        const rawList = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : Array.isArray(res.data?.stylists)
                    ? res.data.stylists
                    : Array.isArray(res.data?.nhanViens)
                        ? res.data.nhanViens
                        : [];

        stylists.value = rawList.map(normalizeStylist).filter((s: any) => s.id);

        if (bookingData.value.stylistId && !stylists.value.some(s => String(s.id) === String(bookingData.value.stylistId))) {
            bookingData.value.stylistId = null;
        }

        if (stylists.value.length === 1 && !bookingData.value.stylistId) {
            bookingData.value.stylistId = stylists.value[0].id;
        }

        if (stylists.value.length === 0) {
            stylistMessage.value = 'Không tìm thấy stylist trống trong khung giờ này. Hãy đổi ngày hoặc giờ khác.';
        }
    } catch (error) {
        console.error('Lỗi tải stylist:', error);
        stylists.value = [];
        bookingData.value.stylistId = null;
        stylistMessage.value = 'Không tải được danh sách stylist. Kiểm tra API get-available-stylists.';
    } finally {
        loadingStylists.value = false;
    }
};

watch(
    () => [
        bookingData.value.voucherIds.slice(),
        serviceSubTotal.value,
        bookingData.value.bookingDate,
        bookingData.value.selectedServices.map(s => s.id).join(',')
    ],
    () => void refreshStackPreview(),
    { deep: true, immediate: true }
);

watch(
    () => [
        tempDate.value,
        tempTime.value,
        bookingData.value.selectedServices.map(s => s.id).join(','),
        estimatedTotalMinutes.value
    ],
    () => loadAvailableStylists(),
    { deep: true }
);

watch(() => productData.value.receiveType, (newVal) => {
    if (newVal === 'store') {
        productData.value.address = '';
        productData.value.deliveryNote = '';
        shippingFee.value = 0;
        distanceText.value = '';
        if (productData.value.paymentMethod === 'cod') {
            productData.value.paymentMethod = bookingData.value.paymentMethod || 'vnpay';
        }
    } else if (newVal === 'home' && productData.value.address) {
        calculateRouteAndFee();
    }
});

// Synchronize payment methods (forcing VNPay/MoMo alignment, no mixing)
watch(() => bookingData.value.paymentMethod, (newVal) => {
    if (productData.value.paymentMethod !== 'cod') {
        productData.value.paymentMethod = newVal;
    }
});

watch(() => productData.value.paymentMethod, (newVal) => {
    if (newVal !== 'cod' && bookingData.value.paymentMethod !== newVal) {
        bookingData.value.paymentMethod = newVal;
    }
    if (newVal === 'cod' && productData.value.receiveType === 'store') {
        productData.value.paymentMethod = bookingData.value.paymentMethod || 'vnpay';
    }
});

// ==========================================
// HÀM THANH TOÁN TỔNG (GỌI 1 API DUY NHẤT)
// ==========================================
const handlePayment = async () => {
    // 1. KIỂM TRA ĐIỀU KIỆN (Validations)
    if (!bookingData.value.customerName || !bookingData.value.phone) {
        alert('Vui lòng nhập đầy đủ thông tin khách hàng (Họ tên, Số điện thoại).');
        return;
    }

    if (bookingData.value.selectedServices.length > 0) {
        if (!bookingData.value.bookingDate) {
            alert('Vui lòng chọn ngày và giờ đặt lịch.');
            return;
        }
    }

    if (productItems.value.length > 0 && productData.value.receiveType === 'home') {
        if (!productData.value.receiverName || !productData.value.receiverPhone || !productData.value.address) {
            alert('Vui lòng nhập đầy đủ thông tin giao hàng (Tên, SĐT, Địa chỉ).');
            return;
        }
    }

    if (bookingData.value.selectedServices.length === 0 && productItems.value.length === 0) {
        alert('Giỏ hàng trống! Vui lòng chọn ít nhất 1 dịch vụ hoặc 1 sản phẩm.');
        return;
    }

    try {
        const checkoutType = bookingData.value.selectedServices.length > 0 && productItems.value.length > 0
                ? 'DAT_LICH_VA_MUA_SAN_PHAM'
                : bookingData.value.selectedServices.length > 0 ? 'CHI_DAT_LICH' : 'CHI_MUA_SAN_PHAM';

        // 2. GOM DỮ LIỆU THÀNH 1 GÓI DUY NHẤT CHUẨN DTO CỦA C#
        const payload = {
            checkoutType: checkoutType,
            maKh: customerId.value || 'GUEST',
            customerName: bookingData.value.customerName,
            phone: bookingData.value.phone,
            email: bookingData.value.email || '',
            note: bookingData.value.note || '',
            
            // Thông tin Dịch vụ
            bookingDate: bookingData.value.bookingDate || null,
            stylistId: bookingData.value.stylistId || '',
            services: bookingData.value.selectedServices.map(s => ({ 
                id: s.id, 
                price: s.price,
                duration: Number(s.duration || 30) // Bắt buộc gửi số phút để Backend cộng giờ
            })),
            
            // Thông tin Sản phẩm
            products: productItems.value.map(p => ({ 
                id: p.id, 
                gia: p.gia, 
                soLuong: p.soLuong 
            })),
            receiveType: productData.value.receiveType,
            deliveryInfo: (productData.value.receiveType === 'home' && productItems.value.length > 0) ? {
                hoTen: productData.value.receiverName,
                soDienThoai: productData.value.receiverPhone,
                email: productData.value.receiverEmail || '',
                diaChi: productData.value.address
            } : null,

            // Tiền bạc & Voucher
            voucherIds: bookingData.value.voucherIds || [],
            shippingFee: shippingFee.value || 0,
            grandTotal: grandTotal.value, 
            paidAmount: payNow.value, // Số tiền cần quẹt thẻ/momo ngay lúc này

            // Cấu hình phương thức thanh toán
            paymentMode: bookingData.value.paymentMode, 
            servicePaymentMethod: bookingData.value.paymentMethod,
            productPaymentMethod: productData.value.paymentMethod
        };

        // 3. GỌI API LƯU TẤT CẢ VÀO DATABASE BẰNG 1 LẦN GỌI
        const res = await axios.post(`${API}/api/ThanhToanTong/submit-checkout`, payload);

        if (res.data && res.data.success) {
            // ===============================================
            // DỌN SẠCH RÁC TRONG GIỎ HÀNG (ĐÃ FIX LỖI CARTDB)
            // ===============================================
            localStorage.removeItem('checkoutData');
            localStorage.removeItem('cart'); 
            localStorage.removeItem('cartSP'); 

            // Quét và xóa sạch từng món trong cơ sở dữ liệu giỏ hàng (cartDB)
            try {
                for (const s of bookingData.value.selectedServices) {
                    await removeFromCartDB(s.id);
                }
                for (const p of productItems.value) {
                    await removeFromCartDB(p.id);
                }
            } catch (err) {
                console.error('Lỗi khi xóa cartDB:', err);
            }

            productItems.value = [];
            bookingData.value.selectedServices = [];
            // ===============================================

            // KIỂM TRA CHUYỂN HƯỚNG
            if (res.data.isOnlinePayment && res.data.url) {
                window.location.href = res.data.url;
            } else {
                router.push({ path: '/payment-result-tong', query: { maHd: res.data.maHd } });
            }
        }
    } catch (error: any) {
        console.error('Lỗi thanh toán:', error);
        alert(error.response?.data?.message || 'Có lỗi xảy ra khi tạo giao dịch. Vui lòng thử lại!');
    }
};
// ==========================================
// HÀM TẢI DỮ LIỆU BÊN VUE (MỚI)
// ==========================================
const loadServices = async () => {
    try {
        const resBooking = await axios.get(`${API}/api/ThanhToanTong/get-services`);
        if (resBooking.data && resBooking.data.success) {
            allItemsFromApi.value = resBooking.data.services;
        }
    } catch (error) {
        console.error('Lỗi tải danh sách dịch vụ:', error);
        allItemsFromApi.value = []; 
    }
};

const loadProducts = async (keyword = '') => {
    try {
        const resProducts = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
            params: { keyword: keyword }
        });
        if (resProducts.data && resProducts.data.success) {
            allProductsFromApi.value = resProducts.data.data;
        }
    } catch (error) {
        console.error('Lỗi tải danh sách sản phẩm:', error);
        allProductsFromApi.value = [];
    }
};

onMounted(async () => {
    await loadServices();
    await loadProducts();

    const checkoutRaw = localStorage.getItem('checkoutData');
    if (checkoutRaw) {
        const checkoutData = JSON.parse(checkoutRaw);

        bookingData.value.selectedServices = (checkoutData.dichVuItems || []).map((item: any) => ({
            id: item.id,
            name: item.tenItem || item.name,
            price: Number(item.gia || item.price || 0),
            originalPrice: Number(item.giaGoc || item.originalPrice || item.gia || item.price || 0),
            icon: item.icon || 'fas fa-check-circle',
            hinhAnh: item.hinhAnh || '',
            duration: Number(item.duration || 30)
        }));

        productItems.value = (checkoutData.sanPhamItems || []).map((item: any) => ({
            id: item.id,
            tenItem: item.tenItem || item.name,
            gia: Number(item.gia || item.price || 0),
            hinhAnh: item.hinhAnh || item.imageUrl,
            soLuong: Number(item.soLuong || item.quantity || 1)
        }));

        if (checkoutData.nhanSanPham === 'GIAO_TAN_NHA') productData.value.receiveType = 'home';
        if (checkoutData.thongTinGiaoHang) {
            productData.value.receiverName = checkoutData.thongTinGiaoHang.hoTen || productData.value.receiverName;
            productData.value.receiverPhone = checkoutData.thongTinGiaoHang.soDienThoai || productData.value.receiverPhone;
            productData.value.address = checkoutData.thongTinGiaoHang.diaChi || '';
            productData.value.deliveryNote = checkoutData.thongTinGiaoHang.ghiChu || '';
        }
    } else {
        const cartData = await getCartDB(customerId.value || 'GUEST');
        if (cartData && cartData.length > 0) {
            bookingData.value.selectedServices = cartData
                .filter((item: any) => item.type !== 'SANPHAM' && !String(item.id).startsWith('SANPHAM_'))
                .map((item: any) => ({
                    id: item.id,
                    name: item.tenItem,
                    price: Number(item.gia || 0),
                    originalPrice: Number(item.giaGoc || item.gia || 0),
                    icon: item.icon || 'fas fa-check-circle',
                    duration: Number(item.duration || 30),
                    hinhAnh: item.hinhAnh
                }));
        }
    }

    await loadVouchers();
    await loadAvailableStylists();
});
</script>


<template>
    <div class="booking-page">
        <div class="page-shell">
            <div class="page-hero">
                <span class="eyebrow">LG HAIR CHECKOUT</span>
                <h1>Thanh toán dịch vụ & sản phẩm</h1>
                <p>Đặt lịch salon, mua sản phẩm kèm theo và thanh toán chung trong một giao diện.</p>
            </div>

            <div class="checkout-layout">
                <section class="left-panel">
                    <div class="card-block">
                        <div class="block-heading">
                            <span class="heading-icon"><i class="fas fa-user"></i></span>
                            <div>
                                <span class="step-label">BƯỚC 1</span>
                                <h2>Thông tin khách hàng</h2>
                                <p>Thông tin dùng để xác nhận lịch hẹn và thanh toán.</p>
                            </div>
                        </div>

                        <div class="form-grid">
                            <div class="form-group">
                                <label>Họ và tên *</label>
                                <input type="text" autocomplete="name" v-model="bookingData.customerName" class="field"
                                    placeholder="Nhập họ và tên" />
                            </div>

                            <div class="form-group">
                                <label>Số điện thoại *</label>
                                <input type="tel" autocomplete="tel" v-model="bookingData.phone" class="field"
                                    placeholder="090x xxx xxx" />
                            </div>

                            <div class="form-group full">
                                <label>Email nhận thông báo *</label>
                                <input type="email" autocomplete="email" v-model="bookingData.email" class="field"
                                    placeholder="ví dụ: vidu@gmail.com" />
                            </div>

                            <div class="form-group full">
                                <label>Ghi chú chung</label>
                                <textarea v-model="bookingData.note" class="field textarea"
                                    placeholder="Ví dụ: cần tư vấn kiểu tóc, sản phẩm phù hợp..."></textarea>
                            </div>
                        </div>
                    </div>

                    <div class="card-block">
                        <div class="block-heading">
                            <span class="heading-icon"><i class="fas fa-calendar-check"></i></span>
                            <div>
                                <span class="step-label">BƯỚC 2</span>
                                <h2>Đặt lịch dịch vụ</h2>
                                <p>Chọn ngày, giờ và stylist cho các dịch vụ đã chọn.</p>
                            </div>
                        </div>

                        <div v-if="bookingData.selectedServices.length === 0" class="soft-message">
                            <i class="fas fa-info-circle"></i>
                            Chưa có dịch vụ. Hãy thêm dịch vụ ở khung bên phải trước khi chọn stylist.
                        </div>

                        <div class="date-time-grid">
                            <div class="form-group">
                                <label>Ngày hẹn</label>
                                <input v-model="tempDate" :min="minDate" type="date" class="field"
                                    @change="combineDateTime" />
                            </div>

                            <div class="form-group">
                                <label>Giờ hẹn</label>
                                <select v-model="tempTime" class="field" @change="combineDateTime">
                                    <option value="">Chọn giờ</option>
                                    <option v-for="hour in availableHours" :key="hour" :value="hour">{{ hour }}</option>
                                </select>
                            </div>
                        </div>

                        <div v-if="expectedEndTime" class="time-preview">
                            <i class="fas fa-clock"></i>
                            <span>Dự kiến hoàn thành lúc <b>{{ expectedEndTime }}</b> · Tổng thời gian {{
                                estimatedTotalMinutes }} phút</span>
                        </div>

                        <div class="stylist-section">
                            <div class="flex items-center justify-between mt-4 mb-3">
                                <h3 class="font-playfair card-header-title font-bold m-0" style="border: 0; padding: 0;">CHỌN STYLIST</h3>
                                <button type="button" class="btn-load-stylist"
                                    :disabled="!canSearchStylist || loadingStylists" @click="loadAvailableStylists">
                                    <i class="fas fa-rotate" :class="{ spin: loadingStylists }"></i>
                                    {{ loadingStylists ? 'Đang tìm...' : 'Tải danh sách thợ' }}
                                </button>
                            </div>

                            <div v-if="loadingStylists" class="soft-message slim">
                                <i class="fas fa-spinner spin"></i>
                                Đang kiểm tra lịch trống của stylist...
                            </div>

                            <div v-else-if="stylists.length" class="stylist-flex">
                                <div v-for="stylist in stylists" :key="stylist.id" class="stylist-card-modern"
                                    :class="{ active: String(bookingData.stylistId) === String(stylist.id) }"
                                    @click="bookingData.stylistId = stylist.id">
                                    <div class="avatar-box">
                                        <img v-if="stylist.avatar" :src="stylist.avatar" onerror="this.onerror=null; this.src='/images/no-image.png'" alt="Stylist">
                                        <div v-else class="avatar-placeholder"><i class="fas fa-user-tie"></i></div>
                                        <div class="check-badge"><i class="fas fa-check"></i></div>
                                    </div>
                                    <div class="stylist-meta">
                                        <span class="s-name font-bold">{{ stylist.name }}</span>
                                        <span class="s-role text-muted">{{ stylist.phone || 'Còn lịch trống' }}</span>

                                        <div class="mt-1 flex items-center justify-center"
                                            style="background: #f3f4f6; padding: 2px 8px; border-radius: 20px; border: 1px solid #e5e7eb;">
                                            <span class="font-bold me-1" style="font-size: 12px; color: #111111;">{{
                                                stylist.rating?.toFixed(1) || '5.0' }}</span>
                                            <i class="fas fa-star" style="font-size: 10px; color: #4b5563;"></i>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div v-else class="soft-message slim">
                                <i class="fas fa-circle-info"></i>
                                {{ stylistMessage || 'Chọn đủ dịch vụ, ngày và giờ để hệ thống hiển thị stylist phù hợp.' }}
                            </div>
                        </div>
                    </div>
                    
                    <div class="card-block" v-if="productItems.length > 0">
                        <div class="block-heading">
                            <span class="heading-icon"><i class="fas fa-truck"></i></span>
                            <div>
                                <span class="step-label">BƯỚC 3</span>
                                <h2>Nhận sản phẩm</h2>
                                <p>Khách có thể nhận tại tiệm hoặc giao tận nhà.</p>
                            </div>
                        </div>

                        <div class="receive-tabs">
                            <button type="button" :class="{ active: productData.receiveType === 'store' }"
                                @click="productData.receiveType = 'store'">
                                <i class="fas fa-store"></i>
                                Nhận tại tiệm
                            </button>

                            <button type="button" :class="{ active: productData.receiveType === 'home' }"
                                @click="productData.receiveType = 'home'">
                                <i class="fas fa-house"></i>
                                Giao tận nhà
                            </button>
                        </div>

                        <div v-if="productData.receiveType === 'store'" class="store-box">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <h3>Nhận sản phẩm tại tiệm</h3>
                                <p>Không cần nhập địa chỉ, không hiện Google Map. Tiền sản phẩm vẫn được cộng vào hóa
                                    đơn tổng.</p>
                            </div>
                        </div>

                        <div v-else class="delivery-box">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Người nhận *</label>
                                    <input type="text" autocomplete="name" v-model="productData.receiverName"
                                        class="field" placeholder="Nhập tên người nhận" />
                                </div>

                                <div class="form-group">
                                    <label>SĐT người nhận *</label>
                                    <input type="tel" autocomplete="tel" v-model="productData.receiverPhone"
                                        class="field" placeholder="090x xxx xxx" />
                                </div>

                                <div class="form-group full">
                                    <label>Địa chỉ giao hàng *</label>
                                    <textarea v-model="productData.address" class="field textarea"
                                        placeholder="Nhập số nhà, tên đường... Bản đồ sẽ tự động cập nhật."></textarea>
                                </div>

                                <div class="form-group full">
                                    <label>Ghi chú giao hàng</label>
                                    <input type="text" v-model="productData.deliveryNote" class="field"
                                        placeholder="VD: Giao giờ hành chính..." />
                                </div>
                            </div>

                            <div class="col-12" v-if="productData.address">
                                <div class="shipping-info-card mt-2 p-3 shadow-sm rounded border border-gray-200 bg-gray-50">
                                    <h6 class="font-bold text-gray-900 mb-3"><i class="fas fa-truck me-2"></i> THÔNG TIN GIAO HÀNG (ƯỚC TÍNH)</h6>
                                    
                                    <div class="flex mb-2 items-start">
                                        <div class="me-3 text-success"><i class="fas fa-store-alt mt-1"></i></div>
                                        <div>
                                            <div class="font-bold" style="font-size: 13px;">Địa chỉ Kho hàng:</div>
                                            <div class="text-muted" style="font-size: 13px;">{{ KHO_ORIGIN }}</div>
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
                                            <div class="text-muted" style="font-size: 13px;">{{ productData.address }}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!-- KHO VOUCHER MỚI BÊN CỘT TRÁI -->
                    <div class="card-block mb-4" v-if="myVouchers.length > 0">
                        <div class="block-heading">
                            <span class="heading-icon"><i class="fas fa-ticket-alt"></i></span>
                            <div>
                                <span class="step-label">ƯU ĐÃI</span>
                                <h2>Kho Voucher Của Bạn</h2>
                                <p>Chọn tối đa 2 mã — áp dụng cho cả dịch vụ & sản phẩm.</p>
                            </div>
                        </div>

                        <div class="voucher-list-modern">
                            <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                :class="{ active: bookingData.voucherIds.includes(v.id) }" @click="toggleVoucher(v.id)">
                                <div class="ticket-left">
                                    <i class="fas fa-gift"></i>
                                    <span class="notch top"></span><span class="notch bottom"></span>
                                </div>
                                <div class="v-divider"></div>
                                <div class="ticket-right">
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="v-code font-bold">{{ v.code }}</span>
                                        <span class="v-tag-gold font-bold">HSD: {{ v.expiry }}</span>
                                    </div>
                                    <div class="v-desc text-muted mb-2">{{ v.desc }}</div>
                                    <div class="v-price-gold font-bold">Giảm: {{ formatMoney(v.discount || 0) }}</div>
                                </div>
                                <div class="v-check-icon" v-if="bookingData.voucherIds.includes(v.id)">
                                    <i class="fas fa-check-circle"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <aside class="right-panel">
                    <div class="right-stack">
                        <div class="summary-card">
                            <div class="summary-head">
                                <div>
                                    <span class="step-label">PHẦN 1</span>
                                    <h2>Dịch vụ đã chọn</h2>
                                </div>
                                <span class="count-badge">{{ bookingData.selectedServices.length }}</span>
                            </div>

                            <div class="search-box-wrapper mb-4">
                                <div class="input-wrap">
                                    <i class="fas fa-search search-icon"></i>
                                    <input v-model="serviceSearch" type="text" placeholder="Tìm và thêm dịch vụ..."
                                        @focus="showServiceDropdown = true" class="search-input">
                                </div>
                                <div v-if="showServiceDropdown" class="service-dropdown-list shadow">
                                    <div class="dropdown-header">DANH SÁCH DỊCH VỤ</div>
                                    <div class="dropdown-scroll-area">
                                        <div v-if="filteredServices.length === 0" class="p-3 text-center text-muted" style="font-size: 13px;">
                                            Không tìm thấy dịch vụ phù hợp.
                                        </div>
                                        <div v-for="service in filteredServices" :key="service.id"
                                            class="service-dropdown-item" @click="addService(service)">
                                            <div class="flex items-center">
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="service.hinhAnh ? (String(service.hinhAnh).startsWith('http') ? service.hinhAnh : API + service.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-details">
                                                    <span class="item-name-text font-bold">{{ service.name }} </span>
                                                    <div class="flex items-center mt-1">
                                                        <span
                                                            v-if="service.originalPrice && service.originalPrice > service.price"
                                                            class="text-muted me-2"
                                                            style="text-decoration: line-through; font-size: 12px;">
                                                            {{ formatMoney(service.originalPrice) }}
                                                        </span>
                                                        <span class="item-price-text gold-solid-text font-bold">
                                                            {{ formatMoney(service.price) }}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <i class="fas fa-plus-circle add-btn-icon"></i>
                                        </div>
                                    </div>
                                    <div class="dropdown-close-footer" @click="showServiceDropdown = false">ĐÓNG</div>
                                </div>
                            </div>

                            <div class="selected-items-wrapper mb-4 border-bottom pb-3">
                                <transition-group name="list-fade">
                                    <div v-for="s in bookingData.selectedServices" :key="s.id" class="item-row">
                                        <div class="flex items-center">
                                            <div class="w-12 h-12 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                <img :src="s.hinhAnh ? (String(s.hinhAnh).startsWith('http') ? s.hinhAnh : API + s.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                            </div>
                                            <div class="item-info">
                                                <span class="n font-bold">{{ s.name }}</span>
                                                <div class="flex items-center">
                                                    <span v-if="s.originalPrice && s.originalPrice > s.price"
                                                        class="text-muted me-2"
                                                        style="text-decoration: line-through; font-size: 12px;">
                                                        {{ formatMoney(s.originalPrice) }}
                                                    </span>
                                                    <span class="p gold-solid-text font-bold">{{ formatMoney(s.price) }}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button class="del-btn" @click="removeService(s.id)"><i
                                                class="fas fa-trash"></i></button>
                                    </div>
                                </transition-group>
                            </div>
                        </div>

                        <div class="summary-card">
                            <div class="summary-head">
                                <div>
                                    <span class="step-label">PHẦN 2</span>
                                    <h2>Sản phẩm mua kèm</h2>
                                </div>
                                <span class="count-badge">{{ productItems.length }}</span>
                            </div>

                            <div class="search-box-wrapper mb-4">
                                <div class="input-wrap">
                                    <i class="fas fa-search search-icon"></i>
                                    <input v-model="productSearch" type="text" placeholder="Tìm và thêm sản phẩm..."
                                        @focus="showProductDropdown = true" class="search-input">
                                </div>
                                <div v-if="showProductDropdown" class="service-dropdown-list shadow">
                                    <div class="dropdown-header">DANH SÁCH SẢN PHẨM</div>
                                    <div class="dropdown-scroll-area">
                                        <div v-if="allProductsFromApi.length === 0" class="p-3 text-center text-muted small">
                                            Không tìm thấy sản phẩm nào.
                                        </div>

                                        <div v-for="sp in allProductsFromApi" :key="sp.maSp" class="mb-2">
                                            <div class="dropdown-header"
                                                style="background-color: #f1f1f1; color: #333;">{{ sp.tenSp }}</div>

                                            <div v-for="bt in sp.bienthes" :key="bt.maBienThe"
                                                class="service-dropdown-item"
                                                :class="{ 'opacity-50': bt.soLuongTon <= 0 || productItems.some(p => p.id === bt.maBienThe) }"
                                                @click="addProduct(sp, bt)">

                                                <div class="flex items-center">
                                                    <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                         <img :src="bt.hinhAnh ? (String(bt.hinhAnh).startsWith('http') ? bt.hinhAnh : API + bt.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                     </div>
                                                    <div class="item-details">
                                                        <span class="item-name-text font-bold"
                                                            style="font-size: 13px;">{{ bt.tenBienThe }}</span>
                                                        <div class="flex items-center mt-1">
                                                            <span class="item-price-text gold-solid-text font-bold">{{
                                                                formatMoney(bt.giaBan) }}</span>
                                                            <span class="ms-2 text-muted" style="font-size: 11px;">(Kho:
                                                                {{ bt.soLuongTon }})</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <i v-if="productItems.some(p => p.id === bt.maBienThe)"
                                                    class="fas fa-check-circle text-success" title="Đã thêm"></i>
                                                <span v-else-if="bt.soLuongTon <= 0" class="badge bg-danger p-1"
                                                    style="font-size: 10px;">Hết</span>
                                                <i v-else class="fas fa-plus-circle add-btn-icon"></i>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="dropdown-close-footer" @click="showProductDropdown = false">ĐÓNG</div>
                                </div>
                            </div>

                            <div class="selected-items-wrapper mb-4 border-bottom pb-3">
                                <div v-for="p in productItems" :key="p.id" class="item-row product-checkout-item">
                                    <div class="flex items-center flex-grow-1">
                                        <div class="w-12 h-12 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                            <img :src="p.hinhAnh ? (String(p.hinhAnh).startsWith('http') ? p.hinhAnh : API + p.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                        </div>
                                        <div class="item-info flex-grow-1">
                                            <span class="n font-bold d-block text-truncate" style="max-width: 170px;">{{
                                                p.tenItem }}</span>
                                            <div class="p gold-solid-text font-bold mt-1">{{ formatMoney(p.gia) }}</div>
                                        </div>
                                    </div>

                                    <div class="quantity-pill ms-auto me-3">
                                        <button type="button" @click="decreaseQuantity(p)" class="qty-btn"><i
                                                class="fas fa-minus"></i></button>
                                        <input type="number" v-model.number="p.soLuong" min="1" class="qty-input" @input="validateQuantity(p)" />
                                        <button type="button" @click="increaseQuantity(p)" class="qty-btn"><i
                                                class="fas fa-plus"></i></button>
                                    </div>

                                    <button class="del-btn" @click="removeProduct(p.id)"><i
                                            class="fas fa-trash"></i></button>
                                </div>
                            </div>
                        </div>

                        <div class="summary-card payment-card">
                            <div class="summary-head">
                                <div>
                                    <span class="step-label">PHẦN 3</span>
                                    <h2>Thanh toán tổng</h2>
                                </div>
                            </div>

                            <div v-if="bookingData.selectedServices.length > 0" class="payment-block">
                                <label>Chọn mức thanh toán dịch vụ</label>
                                <div class="two-choice">
                                    <button type="button" :class="{ active: bookingData.paymentMode === '10' }"
                                        @click="bookingData.paymentMode = '10'">
                                        <span></span>
                                        Cọc 10%
                                    </button>
                                    <button type="button" :class="{ active: bookingData.paymentMode === '100' }"
                                        @click="bookingData.paymentMode = '100'">
                                        <span></span>
                                        Thanh toán 100%
                                    </button>
                                </div>
                            </div>

                            <div class="payment-block">
                                <label>Thanh toán Dịch vụ</label>
                                <div class="two-choice">
                                    <button type="button" :class="{ active: bookingData.paymentMethod === 'vnpay' }"
                                        @click="bookingData.paymentMethod = 'vnpay'">VNPay</button>
                                    <button type="button" :class="{ active: bookingData.paymentMethod === 'momo' }"
                                        @click="bookingData.paymentMethod = 'momo'">MoMo</button>
                                </div>
                            </div>

                            <div class="payment-block mt-3" v-if="productItems.length > 0">
                                <label>Thanh toán Sản phẩm</label>
                                <div :class="productData.receiveType === 'store' ? 'two-choice' : 'three-choice'">
                                    <button type="button" :class="{ active: productData.paymentMethod === 'vnpay' }"
                                        @click="productData.paymentMethod = 'vnpay'">VNPay</button>
                                    <button type="button" :class="{ active: productData.paymentMethod === 'momo' }"
                                        @click="productData.paymentMethod = 'momo'">MoMo</button>
                                    <button type="button" v-if="productData.receiveType !== 'store'" :class="{ active: productData.paymentMethod === 'cod' }"
                                        @click="productData.paymentMethod = 'cod'">COD</button>
                                </div>
                            </div>
                            <div class="total-box">
                                <div class="total-line">
                                    <span>Tổng dịch vụ</span>
                                    <b>{{ formatMoney(serviceSubTotal) }}</b>
                                </div>

                                <div class="total-line saving" v-if="serviceOriginalTotal > serviceSubTotal">
                                    <span>Giảm Flash Sale</span>
                                    <b>-{{ formatMoney(serviceOriginalTotal - serviceSubTotal) }}</b>
                                </div>

                                <div class="total-line saving" v-if="discountAmount > 0">
                                    <span>Giảm voucher</span>
                                    <b>-{{ formatMoney(discountAmount) }}</b>
                                </div>

                                <div class="total-line">
                                    <span>Tổng sản phẩm</span>
                                    <b>{{ formatMoney(productSubTotal) }}</b>
                                </div>

                                <div class="total-line" v-if="shippingFee > 0">
                                    <span>Phí giao hàng</span>
                                    <b>{{ formatMoney(shippingFee) }}</b>
                                </div>

                                <div class="total-line muted"
                                     v-if="productItems.length > 0 && productData.receiveType === 'store'">
                                     <span>Nhận tại tiệm</span>
                                     <b>0đ</b>
                                 </div>

                                 <div class="grand-line">
                                     <span>Tổng hóa đơn</span>
                                     <b>{{ formatMoney(grandTotal) }}</b>
                                 </div>

                                 <div class="total-line" v-if="bookingData.paymentMode === '10' && serviceAfterVoucher > 0" style="color: #111111;">
                                     <span>Cọc dịch vụ (10%)</span>
                                     <b>{{ formatMoney(serviceAfterVoucher * 0.1) }}</b>
                                 </div>
                                 <div class="total-line" v-if="bookingData.paymentMode === '10' && (productSubTotal + shippingFee) > 0 && productData.paymentMethod !== 'cod'" style="color: #111111;">
                                     <span>Tiền sản phẩm & giao hàng (100%)</span>
                                     <b>{{ formatMoney(productSubTotal + shippingFee) }}</b>
                                 </div>

                                 <div class="pay-line">
                                     <span>Thanh toán ngay</span>
                                     <b>{{ formatMoney(payNow) }}</b>
                                 </div>

                                 <div class="total-line text-danger" v-if="remainAtStore > 0" style="color: #d63031 !important;">
                                     <span>Còn lại tại tiệm</span>
                                     <b>{{ formatMoney(remainAtStore) }}</b>
                                 </div>

                                 <div class="total-line text-danger" v-if="remainCOD > 0" style="color: #d63031 !important;">
                                     <span>Còn lại khi nhận hàng (COD)</span>
                                     <b>{{ formatMoney(remainCOD) }}</b>
                                 </div>
                            </div>

                            <button type="button" class="confirm-btn" @click="handlePayment">
                                <i class="fas fa-lock"></i>
                                THANH TOÁN NGAY
                            </button>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    </div>
</template>



<style scoped>
.booking-page {
    min-height: 100vh;
    background: #f9fafb;
    color: #171717;
    font-family: 'Inter', 'Poppins', system-ui, -apple-system, sans-serif;
}

.booking-page *:not(i) {
    font-family: inherit;
}

.page-shell {
    width: min(1280px, calc(100% - 32px));
    margin: 0 auto;
    padding: 48px 0 70px;
}

.page-hero {
    text-align: center;
    margin-bottom: 34px;
}

.eyebrow,
.step-label {
    color: #1f2937;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 1.4px;
    text-transform: uppercase;
}

.eyebrow {
    display: inline-flex;
    padding: 8px 16px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(0, 0, 0, 0.1);
}

.page-hero h1 {
    margin: 16px 0 8px;
    font-size: clamp(34px, 5vw, 58px);
    font-weight: 700;
    letter-spacing: -1.4px;
    background: linear-gradient(135deg, #111, #333, #555);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
}

.page-hero p {
    margin: 0;
    color: #000;
    font-weight: 600;
}

.checkout-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(440px, 0.95fr);
    gap: 28px;
    align-items: start;
}

.left-panel,
.right-panel,
.right-stack {
    min-width: 0;
}

.right-stack {
    position: sticky;
    top: 22px;
    display: flex;
    flex-direction: column;
    gap: 18px;
}

.card-block,
.summary-card {
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.055);
    border-radius: 28px;
    box-shadow: 0 22px 55px rgba(0, 0, 0, 0.075);
    overflow: visible;
}

.card-block {
    padding: 26px;
    margin-bottom: 22px;
}

.summary-card {
    padding: 24px;
}

.block-heading,
.summary-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
}

.block-heading {
    justify-content: flex-start;
}

.heading-icon {
    width: 52px;
    height: 52px;
    border-radius: 17px;
    background: linear-gradient(135deg, #111, #2a2a2a);
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18);
}

.block-heading h2,
.summary-head h2 {
    margin: 3px 0 3px;
    font-size: 23px;
    font-weight: 700;
    letter-spacing: -0.35px;
}

.block-heading p {
    margin: 0;
    color: #000;
    font-size: 13px;
    font-weight: 600;
}

.count-badge {
    min-width: 40px;
    height: 40px;
    padding: 0 13px;
    border-radius: 999px;
    background: #111;
    color: #fff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
}

.form-grid,
.date-time-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}

.form-group.full {
    grid-column: 1 / -1;
}

.form-group label,
.payment-block label,
.voucher-area label {
    display: block;
    margin-bottom: 8px;
    color: #333;
    font-size: 13px;
    font-weight: 700;
}

.field {
    width: 100%;
    height: 50px;
    border: 1px solid rgba(0, 0, 0, 0.085);
    border-radius: 16px;
    background: #fff;
    padding: 0 16px;
    outline: none;
    font-weight: 700;
    transition: 0.22s ease;
}

.field.textarea {
    height: 94px;
    padding-top: 14px;
    resize: vertical;
}

.field:focus,
.search-field:focus-within {
    border-color: rgba(191, 155, 48, 0.58);
    box-shadow: 0 0 0 4px rgba(191, 155, 48, 0.12);
}

.soft-message,
.time-preview,
.store-box {
    margin: 16px 0;
    padding: 16px;
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.035);
    border: 1px solid rgba(0, 0, 0, 0.08);
    color: #374151;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    font-weight: 500;
}

.soft-message.slim {
    margin-bottom: 0;
}

.time-preview b {
    color: #111;
}

.mini-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 18px;
    margin-bottom: 12px;
    font-weight: 700;
    color: #242424;
}

.mini-title i {
    color: #1f2937;
}

.stylist-action-row {
    display: flex;
    justify-content: flex-end;
    margin: -4px 0 12px;
}

.btn-load-stylist {
    height: 42px;
    padding: 0 16px;
    border: 0;
    border-radius: 999px;
    background: linear-gradient(135deg, #111, #292929);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.16);
    transition: 0.22s ease;
}

.btn-load-stylist i {
    color: #ffffff;
    margin-right: 7px;
}

.btn-load-stylist:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.24);
}

.btn-load-stylist:disabled {
    opacity: 0.55;
    cursor: not-allowed;
    box-shadow: none;
}

.spin {
    animation: spin 0.85s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.stylist-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.stylist-card {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 74px;
    padding: 14px;
    border: 1px solid rgba(0, 0, 0, 0.07);
    border-radius: 18px;
    background: #fff;
    cursor: pointer;
    text-align: left;
    transition: 0.22s ease;
}

.stylist-card:hover,
.stylist-card.active {
    transform: translateY(-2px);
    border-color: #111111;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.09);
}

.stylist-avatar {
    width: 44px;
    height: 44px;
    border-radius: 15px;
    background: #111;
    color: #ffffff;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    overflow: hidden;
}

.stylist-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.stylist-info {
    min-width: 0;
    flex: 1;
}

.stylist-info b,
.stylist-info small {
    display: block;
}

.stylist-info b {
    font-weight: 700;
}

.stylist-info small {
    margin-top: 3px;
    color: #000;
    font-weight: 500;
}

.checked {
    color: #ffffff;
    opacity: 0;
}

.stylist-card.active .checked {
    opacity: 1;
}

.receive-tabs,
.two-choice,
.three-choice {
    display: grid;
    gap: 12px;
}

.receive-tabs,
.two-choice {
    grid-template-columns: 1fr 1fr;
}

.three-choice {
    grid-template-columns: repeat(3, 1fr);
}

.receive-tabs button,
.two-choice button,
.three-choice button {
    height: 50px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    border-radius: 16px;
    background: #fff;
    font-weight: 700;
    cursor: pointer;
    transition: 0.22s ease;
}

.receive-tabs button i {
    margin-right: 8px;
    color: #1f2937;
}

.receive-tabs button.active,
.two-choice button.active,
.three-choice button.active {
    background: linear-gradient(135deg, #111, #292929);
    color: #fff;
    border-color: #111;
    box-shadow: 0 13px 28px rgba(0, 0, 0, 0.2);
}

.two-choice button span {
    width: 8px;
    height: 8px;
    display: inline-block;
    border-radius: 50%;
    background: #111111;
    margin-right: 8px;
}

.store-box i {
    color: #16a34a;
    font-size: 22px;
    margin-top: 2px;
}

.store-box h3 {
    margin: 0 0 5px;
    font-size: 16px;
    font-weight: 700;
}

.store-box p {
    margin: 0;
    color: #000;
}

.delivery-box {
    margin-top: 18px;
}

.map-box {
    margin-top: 16px;
    border-radius: 22px;
    border: 1px solid rgba(0, 0, 0, 0.08);
    overflow: hidden;
    position: relative;
    background: #f7f7f7;
}

.map-label {
    position: absolute;
    top: 12px;
    left: 12px;
    z-index: 2;
    background: rgba(255, 255, 255, 0.94);
    padding: 8px 13px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    box-shadow: 0 8px 18px rgba(0, 0, 0, 0.12);
}

.map-label i {
    color: #1f2937;
    margin-right: 5px;
}

.add-box {
    margin-bottom: 16px;
}

.search-field {
    height: 52px;
    border: 1px solid rgba(0, 0, 0, 0.085);
    border-radius: 17px;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
    transition: 0.22s ease;
}

.search-field i {
    color: #1f2937;
}

.search-field input {
    flex: 1;
    min-width: 0;
    border: 0;
    outline: none;
    font-weight: 600;
    background: transparent;
}

.inline-result {
    margin-top: 12px;
    border-radius: 18px;
    border: 1px solid rgba(0, 0, 0, 0.075);
    background: #fff;
    overflow: hidden;
    box-shadow: 0 14px 30px rgba(0, 0, 0, 0.08);
}

.result-head {
    min-height: 46px;
    padding: 0 14px;
    background: #111;
    color: #ffffff;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.result-head b {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.result-head button {
    border: 0;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-radius: 999px;
    padding: 6px 12px;
    cursor: pointer;
    font-weight: 600;
}

.result-scroll {
    max-height: 250px;
    overflow-y: auto;
}

.result-row {
    width: 100%;
    min-height: 66px;
    border: 0;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 14px;
    text-align: left;
    cursor: pointer;
    transition: 0.18s ease;
}

.result-row:hover {
    background: #f3f4f6;
}

.result-icon,
.row-icon {
    width: 43px;
    height: 43px;
    border-radius: 14px;
    background: rgba(0, 0, 0, 0.05);
    color: #1f2937;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
}

.result-info,
.row-info {
    min-width: 0;
    flex: 1;
}

.result-info b,
.result-info small,
.row-info b,
.row-info small {
    display: block;
}

.result-info b,
.row-info b {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.result-info small,
.row-info small {
    margin-top: 4px;
    color: #4b5563;
    font-weight: 700;
}

.plus {
    color: #1f2937;
    font-size: 18px;
}

.empty-result,
.empty-box {
    text-align: center;
    padding: 18px;
    color: #777;
    font-weight: 600;
}

.empty-box {
    border-radius: 18px;
    background: rgba(0, 0, 0, 0.035);
}

.bill-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.bill-row {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 70px;
    padding: 12px;
    border-radius: 18px;
    background: rgba(250, 250, 250, 0.94);
    border: 1px solid rgba(0, 0, 0, 0.055);
}

.product-thumb {
    width: 47px;
    height: 47px;
    border-radius: 14px;
    object-fit: cover;
    background: #eee;
    flex: 0 0 auto;
}

.qty-control {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px;
    border-radius: 999px;
    background: #f2f2f2;
    flex: 0 0 auto;
}

.qty-control button {
    width: 27px;
    height: 27px;
    border-radius: 50%;
    border: 0;
    background: #fff;
    cursor: pointer;
    color: #222;
}

.qty-control b {
    min-width: 18px;
    text-align: center;
}

.remove-btn {
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    background: #fff1f1;
    color: #d63031;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: 0.22s ease;
    flex: 0 0 auto;
}

.remove-btn:hover {
    background: #d63031;
    color: #fff;
    transform: translateY(-2px);
}

.payment-block,
.voucher-area {
    margin-top: 16px;
}

.voucher-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 140px;
    overflow-y: auto;
}

.voucher-chip {
    border: 1px dashed rgba(191, 155, 48, 0.45);
    background: #f9fafb;
    border-radius: 14px;
    padding: 11px 13px;
    display: flex;
    justify-content: space-between;
    cursor: pointer;
    font-weight: 700;
}

.voucher-chip.active {
    background: #111;
    color: #fff;
    border-color: #111;
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

.confirm-btn {
    width: 100%;
    height: 56px;
    margin-top: 18px;
    border: 0;
    border-radius: 18px;
    background: #000;
    color: #ffffff !important;
    font-family: Arial, Helvetica, sans-serif !important;
    font-weight: 800 !important;
    font-size: 18px !important;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: pointer;
    box-shadow: 0 16px 34px rgba(0, 0, 0, 0.25);
    transition: 0.22s ease;
}

.confirm-btn i {
    color: #ffffff;
    margin-right: 9px;
}

.confirm-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 22px 45px rgba(0, 0, 0, 0.34);
}

@media (max-width: 1100px) {
    .checkout-layout {
        grid-template-columns: 1fr;
    }

    .right-stack {
        position: static;
    }
}

@media (max-width: 640px) {
    .page-shell {
        width: min(100% - 20px, 1280px);
        padding-top: 26px;
    }

    .form-grid,
    .date-time-grid,
    .receive-tabs,
    .two-choice,
    .three-choice,
    .stylist-grid {
        grid-template-columns: 1fr;
    }

    .card-block,
    .summary-card {
        border-radius: 22px;
        padding: 18px;
    }

    .block-heading,
    .summary-head {
        align-items: flex-start;
    }

    .product-row {
        flex-wrap: wrap;
    }

    .qty-control {
        margin-left: 57px;
    }
}
/* TÌM KIẾM DỊCH VỤ / SẢN PHẨM DROPDOWN */
.search-box-wrapper { position: relative; }
.search-input { width: 100%; height: 50px; padding-left: 50px; border-radius: 50px; border: 1px solid #eee; background: #fdfdfd; outline: none; font-size: 14px; }
.search-icon { position: absolute; left: 18px; top: 50%; transform: translateY(-50%); color: #ccc; z-index: 5; }
.service-dropdown-list { position: absolute; top: 110%; left: 0; width: 100%; background: #fff; border-radius: 15px; z-index: 1000; box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15); border: 1px solid #f0f0f0; overflow: hidden; }
.dropdown-header { padding: 10px 20px; background: #fdfdfd; font-size: 11px; font-weight: 700; color: #999; border-bottom: 1px solid #f5f5f5; }
.dropdown-scroll-area { max-height: 280px; overflow-y: auto; }
.service-dropdown-item { padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border-bottom: 1px solid #f9f9f9; }
.service-dropdown-item:hover { background: #f9fafb; }
.item-icon-circle { width: 40px; height: 40px; background: #f9f9f9; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-right: 15px; color: #ffffff; font-size: 18px; flex-shrink: 0; }
.item-details { flex-grow: 1; }
.item-name-text { font-size: 14px; color: #333; display: block; }
.add-btn-icon { font-size: 20px; color: #ffffff; transition: 0.2s; }
.service-dropdown-item:hover .add-btn-icon { transform: scale(1.1); }
.dropdown-close-footer { padding: 15px 20px; font-size: 15px; color: #666; cursor: pointer; border-top: 1px solid #eee; text-align: center; font-weight: bold; }

/* SẢN PHẨM / DỊCH VỤ TRONG GIỎ */
.item-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #fafafa; border-radius: 15px; margin-bottom: 12px; border: 1px solid #f0f0f0; transition: 0.3s ease; }
.item-row:hover { background: #fff; border-color: #ffffff; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.03); }
.del-btn { border: none; background: transparent; color: #ff5e5e; font-size: 18px; cursor: pointer; transition: 0.2s; }
.del-btn:hover { color: #d63031; transform: scale(1.1); }
.item-info .n { font-size: 15px; color: #111; }
.item-info .p { font-size: 14px; }
.quantity-pill { display: flex; align-items: center; background: #fff; border: 1px solid #eee; border-radius: 50px; padding: 4px 8px; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.02); }
.qty-btn { border: none; background: transparent; color: #555; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 50%; transition: 0.2s; }
.qty-btn:hover { background: #f0f0f0; color: #111; }
.qty-num { font-size: 13px; font-weight: bold; min-width: 25px; text-align: center; color: #111; }

/* STYLIST STYLES */
.stylist-flex { display: flex; gap: 20px; overflow-x: auto; padding: 10px 0; scrollbar-width: none; }
.stylist-card-modern { flex: 0 0 120px; text-align: center; cursor: pointer; transition: 0.4s; }
.stylist-card-modern:hover { border-color: #ffffff; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05); transform: translateY(-2px); }
.stylist-card-modern.active { border-color: #ffffff; background: #f9fafb; }
.avatar-box { position: relative; width: 80px; height: 80px; margin: 0 auto 10px; }
.avatar-box img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
.avatar-placeholder { width: 100%; height: 100%; border-radius: 50%; background: #f0f0f0; display: flex; justify-content: center; align-items: center; color: #999; font-size: 20px; border: 2px solid #fff; box-shadow: 0 3px 10px rgba(0,0,0,0.1); }
.check-badge { position: absolute; bottom: 0; right: -5px; background: #2ecc71; color: #fff; width: 20px; height: 20px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 10px; border: 2px solid #fff; opacity: 0; transform: scale(0); transition: 0.3s; }
.stylist-card-modern.active .check-badge { opacity: 1; transform: scale(1); }
.stylist-meta { flex-grow: 1; }
.s-name { display: block; font-size: 15px; color: #111; margin-bottom: 2px; }
.s-role { font-size: 12px; }

/* Tiện ích */
.font-bold { font-weight: 700 !important; }
.gold-solid-text { color: #111111 !important; }
/* ==========================================
   STYLE CHO VOUCHER MỚI
========================================== */
.voucher-list-modern {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.voucher-ticket-item {
    display: flex;
    background: #fff;
    border: 1px solid #eee;
    border-radius: 12px;
    overflow: hidden;
    cursor: pointer;
    transition: 0.3s;
    position: relative;
    box-shadow: 0 4px 10px rgba(0,0,0,0.02);
}

.voucher-ticket-item:hover {
    border-color: #ffffff;
    transform: translateY(-2px);
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.05);
}

.voucher-ticket-item.active {
    border-color: #ffffff;
    background: #f9fafb;
}

.ticket-left {
    background: linear-gradient(135deg, #4b5563 0%, #111111 100%);
    width: 50px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    position: relative;
    flex-shrink: 0;
    font-size: 18px;
}

.notch {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #fff;
    border-radius: 50%;
    left: -6px;
}

.notch.top { top: -6px; }
.notch.bottom { bottom: -6px; }

.v-divider {
    width: 1px;
    border-left: 2px dashed #eee;
    height: 70%;
    align-self: center;
    margin: 0 5px;
}

.ticket-right {
    padding: 15px;
    flex: 1;
}

.v-tag-gold {
    font-size: 11px;
    color: #111111;
    background: #f3f4f6;
    padding: 3px 8px;
    border-radius: 6px;
}

.v-price-gold {
    font-size: 17px;
    background: linear-gradient(135deg, #4b5563 0%, #111111 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
}

.v-check-icon {
    position: absolute;
    top: 15px;
    right: 15px;
    color: #ffffff;
    font-size: 20px;
}

.v-code { font-size: 16px; }
.v-desc { font-size: 13px; }
/* ==========================================
   FIX LỖI VOUCHER
========================================== */
.card-block {
    margin-bottom: 30px !important;
}

.voucher-list-modern {
    margin-top: 20px !important;
}

.voucher-ticket-item {
    transition: 0.25s;
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
