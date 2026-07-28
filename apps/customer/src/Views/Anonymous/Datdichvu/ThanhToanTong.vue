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
const favoriteStylistIds = ref<string[]>([]);

const isStylistFavorite = (stylistId: string) => {
    if (!stylistId) return false;
    const cleanId = stylistId.trim().toLowerCase();
    return favoriteStylistIds.value.some(favId => favId.trim().toLowerCase() === cleanId);
};

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
    paymentMethod: 'vnpay'
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
        diaChiXuatHD: (productData.value.receiveType === 'home' ? productData.value.address : null) || null,
        emailNhanHD: bookingData.value.email || productData.value.receiverEmail || null
    };
}

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
    const avatar = item.img ?? item.avatar ?? item.hinhAnh ?? item.anhDaiDien ?? '';
    return {
        ...item,
        id,
        name: item.name ?? item.hoTen ?? item.tenNhanVien ?? item.tenStylist ?? item.fullName ?? 'Stylist',
        phone: item.phone ?? item.sdt ?? item.soDienThoai ?? '',
        avatar,
        img: avatar,
        role: item.role ?? item.tenLoai ?? 'Stylist',
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
            hinhAnh: service.hinhAnh || service.icon || 'fas fa-check-circle'
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
        hinhAnh: bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien,
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
        const res = await axios.post(`${API}/api/ThanhToanTong/get-available-stylists`, {
            ngayHen: tempDate.value,
            gioBatDau: tempTime.value,
            tongThoiGian: estimatedTotalMinutes.value,
            maKh: customerId.value
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

        const mapped = rawList.map(normalizeStylist).filter((s: any) => s.id).map((s: any) => ({
            ...s,
            isFavorite: s.isFavorite || isStylistFavorite(s.id)
        }));

        // Sắp xếp: Ưu tiên thợ rảnh (isAvailable) -> Ưu tiên thợ yêu thích (isFavorite)
        mapped.sort((a: any, b: any) => {
            if (a.isAvailable !== b.isAvailable) {
                return a.isAvailable ? -1 : 1;
            }
            const favA = a.isFavorite ? 1 : 0;
            const favB = b.isFavorite ? 1 : 0;
            return favB - favA;
        });

        stylists.value = mapped;

        // Nếu stylist đang chọn bị bận do đổi giờ/đổi dịch vụ, reset về null
        if (bookingData.value.stylistId && !stylists.value.some(s => String(s.id) === String(bookingData.value.stylistId))) {
            bookingData.value.stylistId = null;
            alert("Stylist bạn chọn đã bận vào khung giờ này do thay đổi thời gian dịch vụ. Vui lòng chọn thợ khác!");
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

// Phương thức thanh toán hiện tại (ưu tiên dịch vụ, nếu không có thì lấy sản phẩm)
const activePaymentMethod = computed(() => {
    if (bookingData.value.selectedServices.length > 0) return bookingData.value.paymentMethod;
    return productData.value.paymentMethod;
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

    const invoiceErr = validateInvoiceInfo();
    if (invoiceErr) {
        alert(invoiceErr);
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
            productPaymentMethod: productData.value.paymentMethod,

            // Hóa đơn điện tử
            invoiceInfo: buildInvoiceInfoPayload()
        };

        // 3. GỌI API LƯU TẤT CẢ VÀO DATABASE BẰNG 1 LẦN GỌI
        const res = await axios.post(`${API}/api/ThanhToanTong/submit-checkout`, payload);

        if (res.data && res.data.success) {
            // LƯU TRỮ THÔNG TIN LỊCH HẸN VÀ SẢN PHẨM VÀO LOCALSTORAGE CHO TRANG XACNHANDICHVU
            localStorage.setItem('last_booking_ref', res.data.maHd || 'N/A');
            localStorage.setItem('current_pay_mode', bookingData.value.paymentMode);
            localStorage.setItem('total_bill_original', grandTotal.value.toString());
            localStorage.setItem('temp_services', JSON.stringify(bookingData.value.selectedServices));
            localStorage.setItem('temp_products', JSON.stringify(productItems.value));
            localStorage.setItem('temp_date', bookingData.value.bookingDate || 'Chưa chọn ngày');
            localStorage.setItem('temp_stylist_name', selectedStylist.value?.name || 'LG Stylist');
            localStorage.setItem('temp_receive_type', productData.value.receiveType);
            localStorage.setItem('temp_shipping_fee', shippingFee.value.toString());
            localStorage.setItem('temp_pay_now', payNow.value.toString());
            localStorage.setItem('temp_remain_at_store', remainAtStore.value.toString());
            if (productData.value.receiveType === 'home' && productItems.value.length > 0) {
                localStorage.setItem('temp_delivery_info', JSON.stringify({
                    hoTen: productData.value.receiverName,
                    soDienThoai: productData.value.receiverPhone,
                    diaChi: productData.value.address
                }));
            } else {
                localStorage.removeItem('temp_delivery_info');
            }

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
        const res = await axios.get(`${API}/api/ThanhToanTong/get-services`);
        if (res.data && res.data.success) {
            // Gộp cả 2 vào mảng hiển thị
            allItemsFromApi.value = [...res.data.services, ...res.data.combos];
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
    if (customerId.value !== 'GUEST') {
        // Load từ LocalStorage trước làm dự phòng
        const saved = localStorage.getItem(`favorite_employees_${customerId.value}`);
        if (saved) {
            try {
                favoriteStylistIds.value = JSON.parse(saved).map((id: string) => String(id).trim());
            } catch (e) {
                favoriteStylistIds.value = [];
            }
        }

        // Sau đó gọi API để đồng bộ từ DB (nếu có)
        try {
            const resFav = await axios.get(`${API}/api/YeuThich/employees/${customerId.value}`);
            if (resFav.data && Array.isArray(resFav.data)) {
                const apiFavs = resFav.data.map((id: string) => String(id).trim());
                favoriteStylistIds.value = Array.from(new Set([...favoriteStylistIds.value, ...apiFavs]));
            }
        } catch (error) {
            console.error("Lỗi khi load thợ yêu thích:", error);
        }
    }

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
    <div class="booking-container">
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="text-center mb-12" data-aos="fade-down">
                <h1 class="font-playfair gold-metallic-text font-black text-5xl">THANH TOÁN TỔNG HỢP</h1>
                <div class="gold-accent-line mx-auto mt-4"></div>
                <p class="text-black mt-2">Đặt lịch dịch vụ và mua sản phẩm kèm theo trong một đơn hàng</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Cột trái: Thông tin biểu mẫu -->
                <div class="lg:col-span-7 space-y-6" data-aos="fade-right">
                    <div class="glass-card left-main-card">
                        <!-- BƯỚC 1: Thông tin khách hàng -->
                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                <i class="fas fa-user-edit me-2"></i> THÔNG TIN KHÁCH HÀNG
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Họ và tên *</label>
                                <input v-model="bookingData.customerName" type="text" class="booking-input w-full" placeholder="Nguyễn Văn A">
                            </div>
                            <div>
                                <label class="custom-label font-bold">Số điện thoại *</label>
                                <input v-model="bookingData.phone" type="tel" class="booking-input w-full" placeholder="090x xxx xxx">
                            </div>
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Email nhận thông báo *</label>
                                <input v-model="bookingData.email" type="email" class="booking-input w-full" placeholder="vidu@gmail.com">
                            </div>
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Ghi chú chung</label>
                                <textarea v-model="bookingData.note" class="booking-input w-full pt-2" style="height: 80px;" placeholder="Ghi chú yêu cầu đặt lịch hoặc sản phẩm..."></textarea>
                            </div>
                        </div>

                        <!-- BƯỚC 2: Chọn Ngày, Giờ & Stylist cho Dịch vụ -->
                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                <i class="fas fa-calendar-check me-2"></i> ĐẶT LỊCH HẸN DỊCH VỤ
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        
                        <div v-if="bookingData.selectedServices.length === 0" class="soft-message mt-3">
                            <i class="fas fa-info-circle text-gray-500 mt-1"></i>
                            <div>
                                <span class="font-bold">Chưa có dịch vụ nào được chọn.</span> Hãy tìm và thêm dịch vụ ở cột Chi tiết hóa đơn trước khi chọn thời gian và stylist.
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Ngày hẹn</label>
                                <input v-model="tempDate" type="date" class="booking-input w-full" :min="minDate" @change="combineDateTime">
                            </div>
                            <div>
                                <label class="custom-label font-bold">Giờ hẹn</label>
                                <select v-model="tempTime" class="booking-input" @change="combineDateTime">
                                    <option value="">Chọn giờ</option>
                                    <option v-for="hour in availableHours" :key="hour" :value="hour">{{ hour }}</option>
                                </select>
                                <div class="summary-line" v-if="tempTime">
                                    <span class="font-bold">Giờ bắt đầu:</span>
                                    <span class="font-bold text-black">{{ tempTime }}</span>
                                </div>
                                <div class="summary-line" v-if="expectedEndTime">
                                    <span class="font-bold">Dự kiến xong lúc:</span>
                                    <span class="text-black font-bold" style="font-size: 1.1rem;">{{ expectedEndTime }}</span>
                                </div>
                                <div class="summary-line text-black" v-if="estimatedTotalMinutes > 0">
                                    <span class="font-bold">Tổng thời gian làm:</span>
                                    <span>{{ estimatedTotalMinutes }} phút</span>
                                </div>
                            </div>
                        </div>

                        <!-- Chọn Stylist -->
                        <div class="mt-8">
                            <div class="section-heading-wrapper mt-4 mb-3">
                                <h3 class="font-playfair section-heading-title font-bold text-black">
                                    <i class="fas fa-cut me-2"></i> CHỌN STYLIST
                                </h3>
                                <div class="heading-line"></div>
                            </div>
                            
                            <div v-if="loadingStylists" class="mt-4 p-3 text-center text-gray-500 font-bold bg-gray-50 border">
                                <i class="fas fa-spinner fa-spin me-2 text-black"></i> Đang tìm các thợ rảnh việc trong ca này...
                            </div>
                            
                            <div v-else class="stylist-flex mt-3">
                                <div v-for="stylist in stylists" :key="stylist.id" class="stylist-card" :class="{
                                    'active': String(bookingData.stylistId) === String(stylist.id),
                                    'is-disabled': !stylist.isAvailable
                                }" @click="stylist.isAvailable ? bookingData.stylistId = stylist.id : null"
                                    :title="!stylist.isAvailable ? stylist.unAvailableReason : ''">
                                    
                                    <div class="stylist-schedule-info" v-if="stylist.lichTrinh && stylist.lichTrinh.length > 0">
                                        <div class="schedule-header">Ca Làm : {{ stylist.caLam }}</div>
                                        <div class="schedule-group mt-2">
                                            <div class="font-bold text-green-600 text-xs mb-1" style="font-size: 11px;"><i class="fas fa-check-circle me-1"></i>Lịch trống:</div>
                                            <div v-for="(line, index) in stylist.lichTrinh.filter((l: string) => l.includes('Lịch trống'))" :key="'free-'+index" class="schedule-line text-green-700 font-medium">
                                                {{ line.replace('Lịch trống:', '').trim() }}
                                            </div>
                                        </div>
                                        <div class="schedule-group mt-2 pt-2 border-t border-gray-200 border-dashed" v-if="stylist.lichTrinh.some((l: string) => l.includes('Có hẹn'))">
                                            <div class="font-bold text-red-500 text-xs mb-1" style="font-size: 11px;"><i class="fas fa-calendar-times me-1"></i>Ca bận:</div>
                                            <div v-for="(line, index) in stylist.lichTrinh.filter((l: string) => l.includes('Có hẹn'))" :key="'busy-'+index" class="schedule-line text-red-500 opacity-80">
                                                {{ line.replace('Có hẹn:', '').trim() }}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="avatar-box">
                                        <img :src="stylist.img.startsWith('http') ? stylist.img : (API + stylist.img)"
                                            alt="Stylist" onerror="this.onerror=null; this.src='/images/no-image.png'">
                                        <div class="check-badge"><i class="fas fa-check"></i></div>
                                        <div v-if="stylist.isFavorite" class="favorite-heart-badge">
                                            <i class="fas fa-heart"></i>
                                        </div>
                                    </div>
 
                                    <div class="stylist-meta mt-auto">
                                        <span class="s-name font-bold">{{ stylist.name }}</span>
 
                                        <template v-if="stylist.isAvailable">
                                            <span class="s-role text-black">{{ stylist.role }}</span>
                                            <div class="stylist-rating-badge">
                                                <span class="rating-val">{{ stylist.rating?.toFixed(1) || '5.0' }}</span>
                                                <i class="fas fa-star rating-star-icon"></i>
                                            </div>
                                        </template>
 
                                        <template v-else>
                                            <span class="font-bold mt-1 text-center"
                                                style="color: #ef4444; font-size: 10px; line-height: 1.3;">
                                                {{ stylist.unAvailableReason }}
                                            </span>
                                        </template>
                                    </div>
                                </div>
 
                                <div v-if="stylists.length === 0"
                                    class="w-full p-4 text-center text-red-500 border border-red-200 bg-red-50">
                                    Hôm nay tiệm không có thợ nào làm việc. Bạn vui lòng chọn ngày khác nhé!
                                </div>
                            </div>
                        </div>

                        <!-- BƯỚC 3: Nhận sản phẩm (Nếu giỏ hàng có sản phẩm) -->
                        <div v-if="productItems.length > 0" class="mt-10">
                            <div class="section-heading-wrapper">
                                <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                    <i class="fas fa-shipping-fast me-2"></i> NHẬN SẢN PHẨM MUA KÈM
                                </h3>
                                <div class="heading-line"></div>
                            </div>
                            
                            <div class="receive-tabs mt-4">
                                <button type="button" :class="{ active: productData.receiveType === 'store' }" @click="productData.receiveType = 'store'">
                                    <i class="fas fa-store"></i> Nhận trực tiếp tại tiệm
                                </button>
                                <button type="button" :class="{ active: productData.receiveType === 'home' }" @click="productData.receiveType = 'home'">
                                    <i class="fas fa-house"></i> Giao hàng tận nhà
                                </button>
                            </div>
                            
                            <div v-if="productData.receiveType === 'store'" class="store-box mt-4 flex items-start gap-3">
                                <i class="fas fa-check-circle text-xl mt-1"></i>
                                <div>
                                    <h4 class="font-bold text-black mb-1">Nhận sản phẩm tại tiệm</h4>
                                    <p class="text-sm text-gray-600">Sản phẩm sẽ được chuẩn bị sẵn tại tiệm khi bạn đến làm dịch vụ. Không tính phí vận chuyển.</p>
                                </div>
                            </div>
                            
                            <div v-else class="delivery-box mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="custom-label font-bold">Họ tên người nhận *</label>
                                        <input v-model="productData.receiverName" type="text" class="booking-input w-full" placeholder="Họ tên người nhận">
                                    </div>
                                    <div>
                                        <label class="custom-label font-bold">Số điện thoại *</label>
                                        <input v-model="productData.receiverPhone" type="tel" class="booking-input w-full" placeholder="090x xxx xxx">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="custom-label font-bold">Email người nhận</label>
                                        <input v-model="productData.receiverEmail" type="email" class="booking-input w-full" placeholder="email@example.com">
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="custom-label font-bold text-danger">Địa chỉ giao hàng chi tiết *</label>
                                        <textarea v-model="productData.address" class="booking-input w-full pt-2" style="height: 80px;" placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."></textarea>
                                    </div>
                                    
                                    <!-- Google Maps/Thông tin giao hàng ước tính -->
                                    <div class="md:col-span-2" v-if="productData.address">
                                        <div class="shipping-info-card mt-2">
                                            <h6 class="font-bold text-gray-900 mb-3"><i class="fas fa-truck me-2 text-[var(--gold-solid)]"></i> THÔNG TIN GIAO HÀNG (ƯỚC TÍNH)</h6>
                                            
                                            <div class="flex mb-2 items-start">
                                                <div class="me-3 text-success"><i class="fas fa-store-alt mt-1 text-[var(--gold-solid)]"></i></div>
                                                <div>
                                                    <div class="font-bold text-xs" style="font-size: 13px;">Địa chỉ Kho hàng:</div>
                                                    <div class="text-black" style="font-size: 13px;">{{ KHO_ORIGIN }}</div>
                                                </div>
                                            </div>
                                            
                                            <div class="flex mb-2 items-start border-l-2 ms-2 ps-4 pb-2 pt-2 border-gray-400" style="margin-left: 5px !important;">
                                                <div>
                                                    <div class="inline-flex items-center px-2.5 py-1 rounded bg-neutral-800 text-white text-xs font-bold mb-1 shadow-sm">
                                                        <i class="fas fa-route me-1.5 text-[var(--gold-solid)]"></i> Quãng đường: {{ isCalculatingRoute ? 'Đang tính...' : (distanceText || 'Không xác định') }}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div class="flex items-start">
                                                <div class="me-3 text-danger"><i class="fas fa-map-marker-alt mt-1"></i></div>
                                                <div>
                                                    <div class="font-bold text-xs" style="font-size: 13px;">Giao đến:</div>
                                                    <div class="text-black" style="font-size: 13px;">{{ productData.address }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="md:col-span-2">
                                        <label class="custom-label font-bold">Ghi chú cho Shipper</label>
                                        <input v-model="productData.deliveryNote" type="text" class="booking-input w-full" placeholder="VD: Giao vào giờ hành chính, gọi trước khi đến...">
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- ƯU ĐÃI: VOUCHER -->
                        <div v-if="myVouchers.length > 0" class="mt-10">
                            <div class="section-heading-wrapper">
                                <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                    <i class="fas fa-ticket-alt me-2"></i> KHO VOUCHER CỦA BẠN
                                </h3>
                                <div class="heading-line"></div>
                            </div>

                            <div class="voucher-list-modern">
                                <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                    :class="{ active: bookingData.voucherIds.includes(v.id) }" @click="toggleVoucher(v.id)">
                                    
                                    <div class="ticket-left">
                                        <span class="ticket-brand-text">LGHAIR</span>
                                        <span class="notch top"></span>
                                        <span class="notch bottom"></span>
                                    </div>
                                    
                                    <div class="v-divider"></div>
                                    
                                    <div class="ticket-right">
                                        <div class="flex justify-between items-start mb-2">
                                            <span class="v-code-badge">{{ v.code }}</span>
                                            <span class="v-expiry-tag"><i class="far fa-calendar-alt me-1.5"></i>HSD: {{ v.expiry }}</span>
                                        </div>
                                        <div class="v-price-gold font-bold">Giảm: {{ formatMoney(v.discount || 0) }}</div>
                                        <div class="v-desc text-black mt-1">{{ v.desc }}</div>
                                    </div>
                                    
                                    <div class="v-check-icon" v-if="bookingData.voucherIds.includes(v.id)">
                                        <i class="fas fa-check-circle"></i>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cột phải: Sticky Bill Chi tiết Hóa đơn -->
                <div class="lg:col-span-5" data-aos="fade-left">
                    <div class="sticky-bill">
                        <div class="glass-card bill-card">
                            <div class="section-heading-wrapper justify-content-center text-center mb-4">
                                <h3 class="font-playfair section-heading-title font-bold gold-metallic-text">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> CHI TIẾT HÓA ĐƠN
                                </h3>
                                <div class="heading-line mx-auto" style="width: 80px;"></div>
                            </div>

                            <!-- 1. DỊCH VỤ ĐÃ CHỌN -->
                            <div class="mb-4">
                                <label class="custom-label font-bold mb-2">
                                    <i class="fas fa-cut me-1 text-gold"></i> Dịch vụ đã chọn
                                </label>
                                <div class="search-box-wrapper mb-3">
                                    <div class="input-wrap">
                                        <i class="fas fa-search search-icon"></i>
                                        <input v-model="serviceSearch" type="text" placeholder="Tìm và thêm dịch vụ..." @focus="showServiceDropdown = true" class="search-input">
                                    </div>
                                    <div v-if="showServiceDropdown" class="service-dropdown-list shadow">
                                        <div class="dropdown-header">DANH SÁCH DỊCH VỤ</div>
                                        <div class="dropdown-scroll-area">
                                            <div v-if="filteredServices.length === 0" class="p-3 text-center text-black small font-bold">
                                                Không tìm thấy dịch vụ nào.
                                            </div>
                                            <div v-for="service in filteredServices" :key="service.id" class="service-dropdown-item" @click="addService(service)">
                                                <div class="flex items-center">
                                                    <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                        <img :src="service.hinhAnh ? (String(service.hinhAnh).startsWith('http') ? service.hinhAnh : API + service.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                    </div>
                                                    <div class="item-details">
                                                        <span class="item-name-text font-bold" style="font-size: 13px;">{{ service.name }}</span>
                                                        <div class="flex items-center mt-1">
                                                            <span v-if="service.originalPrice && service.originalPrice > service.price" class="text-black me-2" style="text-decoration: line-through; font-size: 11px;">
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

                                <div class="selected-items-wrapper">
                                    <transition-group name="list-fade">
                                        <div v-for="s in bookingData.selectedServices" :key="s.id" class="item-row">
                                            <div class="flex items-center">
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="s.hinhAnh ? (String(s.hinhAnh).startsWith('http') ? s.hinhAnh : API + s.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-info">
                                                    <span class="n font-bold d-block text-truncate" style="max-width: 180px;">{{ s.name }}</span>
                                                    <div class="flex items-center mt-1">
                                                        <span v-if="s.originalPrice && s.originalPrice > s.price" class="text-black me-2" style="text-decoration: line-through; font-size: 11px;">
                                                            {{ formatMoney(s.originalPrice) }}
                                                        </span>
                                                        <span class="p gold-solid-text font-bold">{{ formatMoney(s.price) }}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <button class="del-btn" @click="removeService(s.id)"><i class="fas fa-trash-alt"></i></button>
                                        </div>
                                    </transition-group>
                                </div>
                            </div>

                            <!-- 2. SẢN PHẨM MUA KÈM -->
                            <div class="mb-4 pt-3 border-t border-gray-100">
                                <label class="custom-label font-bold mb-2">
                                    <i class="fas fa-box-open me-1 text-gold"></i> Sản phẩm mua kèm
                                </label>

                                <div class="search-box-wrapper mb-3">
                                    <div class="input-wrap">
                                        <i class="fas fa-search search-icon"></i>
                                        <input v-model="productSearch" type="text" placeholder="Tìm và thêm sản phẩm..." @focus="showProductDropdown = true" class="search-input">
                                    </div>
                                    <div v-if="showProductDropdown" class="service-dropdown-list shadow">
                                        <div class="dropdown-header">DANH SÁCH SẢN PHẨM</div>
                                        <div class="dropdown-scroll-area">
                                            <div v-if="allProductsFromApi.length === 0" class="p-3 text-center text-black small font-bold">
                                                Không tìm thấy sản phẩm nào.
                                            </div>
                                            <div v-for="sp in allProductsFromApi" :key="sp.maSp" class="mb-2">
                                                <div class="dropdown-header font-bold py-1 px-3 bg-gray-100 text-gray-700 text-xs">{{ sp.tenSp }}</div>
                                                <div v-for="bt in sp.bienthes" :key="bt.maBienThe" class="service-dropdown-item"
                                                    :class="{ 'opacity-50 pointer-events-none': bt.soLuongTon <= 0 || productItems.some(p => p.id === bt.maBienThe) }"
                                                    @click="addProduct(sp, bt)">
                                                    <div class="flex items-center">
                                                        <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                            <img :src="bt.hinhAnh ? (String(bt.hinhAnh).startsWith('http') ? bt.hinhAnh : API + bt.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                        </div>
                                                        <div class="item-details">
                                                            <span class="item-name-text font-bold" style="font-size: 13px;">{{ bt.tenBienThe }}</span>
                                                            <div class="flex items-center mt-1">
                                                                <span class="item-price-text gold-solid-text font-bold">{{ formatMoney(bt.giaBan) }}</span>
                                                                <span class="ms-2 text-black" style="font-size: 11px;">(Kho: {{ bt.soLuongTon }})</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <i v-if="productItems.some(p => p.id === bt.maBienThe)" class="fas fa-check-circle text-success" title="Đã thêm"></i>
                                                    <span v-else-if="bt.soLuongTon <= 0" class="badge bg-danger text-white px-1 py-0.5 rounded text-xs" style="font-size: 9px;">Hết</span>
                                                    <i v-else class="fas fa-plus-circle add-btn-icon"></i>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="dropdown-close-footer" @click="showProductDropdown = false">ĐÓNG</div>
                                    </div>
                                </div>

                                <div class="selected-items-wrapper">
                                    <transition-group name="list-fade">
                                        <div v-for="p in productItems" :key="p.id" class="item-row product-checkout-item">
                                            <div class="flex items-center flex-grow">
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="p.hinhAnh ? (String(p.hinhAnh).startsWith('http') ? p.hinhAnh : API + p.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-info flex-grow">
                                                    <span class="n font-bold d-block text-truncate" style="max-width: 130px;">{{ p.tenItem }}</span>
                                                    <span class="p gold-solid-text font-bold mt-1 d-block">{{ formatMoney(p.gia) }}</span>
                                                </div>
                                            </div>
                                            
                                            <div class="quantity-pill flex items-center bg-gray-100 rounded-full px-2 py-0.5 mr-2">
                                                <button type="button" @click="decreaseQuantity(p)" class="qty-btn"><i class="fas fa-minus text-xs"></i></button>
                                                <input type="number" v-model.number="p.soLuong" min="1" class="qty-input" @input="validateQuantity(p)" />
                                                <button type="button" @click="increaseQuantity(p)" class="qty-btn"><i class="fas fa-plus text-xs"></i></button>
                                            </div>
                                            
                                            <button class="del-btn" @click="removeProduct(p.id)"><i class="fas fa-trash-alt"></i></button>
                                        </div>
                                    </transition-group>
                                </div>
                            </div>

                            <!-- 3. HÌNH THỨC THANH TOÁN (MỨC ĐẶT CỌC DỊCH VỤ & PHƯƠNG THỨC THANH TOÁN) -->
                            <div class="pt-3 border-t border-gray-100">
                                <!-- Lựa chọn cọc dịch vụ -->
                                <div v-if="bookingData.selectedServices.length > 0" class="payment-block mb-3">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-wallet text-gold me-1"></i> Mức thanh toán dịch vụ</label>
                                    <div class="pay-row flex flex-col gap-2">
                                        <div class="pay-btn" :class="{ active: bookingData.paymentMode === '10' }" @click="bookingData.paymentMode = '10'">
                                            <span class="dot"></span> <b>Đặt cọc trước 10%</b>
                                        </div>
                                        <div class="pay-btn" :class="{ active: bookingData.paymentMode === '100' }" @click="bookingData.paymentMode = '100'">
                                            <span class="dot"></span> <b>Thanh toán toàn bộ 100%</b>
                                        </div>
                                    </div>
                                </div>

                                <!-- Phương thức thanh toán Dịch vụ -->
                                <div class="payment-block mb-3">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-credit-card text-gold me-1"></i> Thanh toán Dịch vụ</label>
                                    <div class="payment-method-row">
                                        <div class="method-option vnpay" :class="{ active: bookingData.paymentMethod === 'vnpay' }" @click="bookingData.paymentMethod = 'vnpay'">
                                            <div class="method-logo-wrapper">
                                                <img src="/vnpay-logo.png" alt="VNPay" class="method-logo-img">
                                            </div>
                                        </div>
                                        <div class="method-option momo" :class="{ active: bookingData.paymentMethod === 'momo' }" @click="bookingData.paymentMethod = 'momo'">
                                            <div class="method-logo-wrapper">
                                                <img src="/momo-logo.png" alt="MoMo" class="method-logo-img">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Phương thức thanh toán Sản phẩm -->
                                <div class="payment-block mb-3" v-if="productItems.length > 0">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-credit-card text-gold me-1"></i> Thanh toán Sản phẩm</label>
                                    <div class="payment-method-row">
                                        <div class="method-option vnpay" :class="{ active: productData.paymentMethod === 'vnpay' }" @click="productData.paymentMethod = 'vnpay'">
                                            <div class="method-logo-wrapper">
                                                <img src="/vnpay-logo.png" alt="VNPay" class="method-logo-img">
                                            </div>
                                        </div>
                                        <div class="method-option momo" :class="{ active: productData.paymentMethod === 'momo' }" @click="productData.paymentMethod = 'momo'">
                                            <div class="method-logo-wrapper">
                                                <img src="/momo-logo.png" alt="MoMo" class="method-logo-img">
                                            </div>
                                        </div>
                                        <div class="method-option cod" v-if="productData.receiveType !== 'store'" :class="{ active: productData.paymentMethod === 'cod' }" @click="productData.paymentMethod = 'cod'">
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
                                                <span class="method-label font-bold" style="font-size: 14px;">COD</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- HÓA ĐƠN CÔNG TY (thu gọn, mặc định đóng) -->
                            <div class="payment-block mb-3">
                                <div class="invoice-toggle-line" @click="showInvoiceCompanyForm = !showInvoiceCompanyForm">
                                    <span class="font-bold text-black" style="font-size: 14px;">
                                        <i class="fas fa-building me-2"></i> Cần hóa đơn công ty (có MST)?
                                    </span>
                                    <i class="fas fa-chevron-down invoice-toggle-arrow" :class="{ open: showInvoiceCompanyForm }"></i>
                                </div>
                                <transition name="list-fade">
                                    <div v-if="showInvoiceCompanyForm" class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
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
                            </div>

                            <!-- 4. CHI TIẾT TIỀN BẠC (BILL SUMMARY) -->
                            <div class="bill-summary">
                                <div class="summary-line" v-if="bookingData.selectedServices.length > 0">
                                    <span>Tạm tính dịch vụ:</span>
                                    <span>{{ formatMoney(serviceSubTotal) }}</span>
                                </div>
                                <div class="summary-line saving text-success" v-if="bookingData.selectedServices.length > 0 && serviceOriginalTotal > serviceSubTotal">
                                    <span>Flash Sale dịch vụ:</span>
                                    <span>-{{ formatMoney(serviceOriginalTotal - serviceSubTotal) }}</span>
                                </div>
                                <div class="summary-line" v-if="productItems.length > 0">
                                    <span>Tạm tính sản phẩm:</span>
                                    <span>{{ formatMoney(productSubTotal) }}</span>
                                </div>
                                <div class="summary-line" v-if="productItems.length > 0 && shippingFee > 0">
                                    <span>Phí giao hàng:</span>
                                    <span>{{ formatMoney(shippingFee) }}</span>
                                </div>
                                <div class="summary-line saving text-success" v-if="discountAmount > 0">
                                    <span>Voucher giảm giá:</span>
                                    <span class="font-bold">-{{ formatMoney(discountAmount) }}</span>
                                </div>
                                <div class="summary-line small text-black font-bold" v-if="bookingData.voucherIds.length">
                                    <span>Mã đã chọn:</span>
                                    <span>{{ bookingData.voucherIds.join(' → ') }}</span>
                                </div>

                                <div class="total-line-final mt-3 pt-3 border-t border-dashed">
                                    <div class="summary-line">
                                        <span class="total-lbl font-bold">TỔNG ĐƠN HÀNG:</span>
                                        <span class="total-val-standard font-bold text-black">{{ formatMoney(grandTotal) }}</span>
                                    </div>

                                    <div class="mt-2 text-xs text-gray-500" v-if="bookingData.selectedServices.length > 0 && bookingData.paymentMode === '10'">
                                        <div class="flex justify-between py-0.5">
                                            <span>+ Tiền cọc dịch vụ (10%):</span>
                                            <span>{{ formatMoney(serviceAfterVoucher * 0.1) }}</span>
                                        </div>
                                        <div class="flex justify-between py-0.5" v-if="productItems.length > 0 && productData.paymentMethod !== 'cod'">
                                            <span>+ Tiền sản phẩm & ship (100%):</span>
                                            <span>{{ formatMoney(productSubTotal + shippingFee) }}</span>
                                        </div>
                                    </div>

                                    <div class="pay-now-alert mt-3">
                                        <span>THANH TOÁN NGAY:</span>
                                        <span>{{ formatMoney(payNow) }}</span>
                                    </div>

                                    <div class="summary-line mt-2" style="color: #e53e3e; font-weight: 600;" v-if="remainAtStore > 0">
                                        <span style="color: #e53e3e;">Còn lại trả tại tiệm:</span>
                                        <span class="font-bold" style="color: #e53e3e;">{{ formatMoney(remainAtStore) }}</span>
                                    </div>
                                    <div class="summary-line" style="color: #e53e3e; font-weight: 600;" v-if="remainCOD > 0">
                                        <span style="color: #e53e3e;">Còn lại trả shipper (COD):</span>
                                        <span class="font-bold" style="color: #e53e3e;">{{ formatMoney(remainCOD) }}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Nút Xác nhận Thanh toán -->
                            <button type="button" class="btn-confirm-metallic-final mt-4" @click="handlePayment">
                                <template v-if="activePaymentMethod === 'momo'">
                                    THANH TOÁN QUA MOMO
                                </template>
                                <template v-else-if="activePaymentMethod === 'vnpay'">
                                    THANH TOÁN QUA VNPAY
                                </template>
                                <template v-else>
                                    XÁC NHẬN THANH TOÁN
                                </template>
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
    
    /* Aliases for template compatibility */
    --gold-metallic: var(--primary-metallic);
    --gold-solid: var(--primary-color);
    --gold-hover: var(--primary-hover);
    --gold-light: var(--primary-light);
    
    background-color: #ffffff;
    min-height: 100vh;
    font-family: 'Inter', sans-serif;
    color: var(--text-secondary);
    line-height: 1.6;
    position: relative;
}

.booking-container::before {
    content: '';
    position: absolute;
    top: -10%;
    left: -10%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(0, 0, 0, 0.015) 0%, rgba(255,255,255,0) 70%);
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
    background: radial-gradient(circle, rgba(0, 0, 0, 0.01) 0%, rgba(255,255,255,0) 70%);
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

.gold-accent-line {
    width: 60px;
    height: 1px;
    background: var(--gold-metallic);
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
    color: var(--gold-solid);
    font-size: 1.1rem;
}

.heading-line {
    position: absolute;
    bottom: -1px;
    left: 0;
    width: 50px;
    height: 2px;
    background: var(--gold-metallic);
}

.section-heading-wrapper.justify-content-center .heading-line {
    left: 50%;
    transform: translateX(-50%);
}

.gold-metallic-text {
    background: var(--gold-metallic);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    display: inline-block;
}

.gold-solid-text {
    color: var(--gold-solid);
    font-weight: 600;
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
    background: #fcfcfd;
    outline: none;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.booking-input:focus {
    border-color: var(--gold-solid);
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

/* Booking summary/metadata helper lines */
.summary-line {
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
    font-size: 13px;
    color: var(--text-secondary);
}

.summary-line span:first-child {
    font-weight: 500;
}

.summary-line span:last-child {
    font-weight: 600;
    color: var(--text-primary);
}

/* Stylist Selection */
.stylist-flex {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 10px 4px;
    scrollbar-width: none;
    -ms-overflow-style: none;
}

.stylist-flex::-webkit-scrollbar {
    display: none;
}

.stylist-card {
    flex: 0 0 120px;
    text-align: center;
    cursor: pointer;
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 0px;
    padding: 16px 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stylist-card:hover {
    transform: translateY(-4px);
    border-color: rgba(0, 0, 0, 0.2);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.03);
}

.stylist-card.active {
    border-color: var(--gold-solid);
    background: var(--gold-light);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.avatar-box {
    position: relative;
    width: 68px;
    height: 68px;
    margin: auto auto 10px auto;
}

.avatar-box img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid transparent;
    padding: 2px;
    transition: all 0.3s ease;
}

.stylist-card.active .avatar-box img {
    border-color: var(--gold-solid);
}

.avatar-placeholder {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #f3f4f6;
    display: flex;
    justify-content: center;
    align-items: center;
    color: var(--text-muted);
    font-size: 24px;
    border: 2px solid transparent;
}

.check-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    background: var(--gold-solid);
    color: #ffffff;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 8px;
    border: 2px solid #ffffff;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.stylist-card.active .check-badge {
    opacity: 1;
    transform: scale(1);
}

.stylist-meta {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-top: 8px;
    gap: 3px;
}

.s-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
}

.s-role {
    font-size: 10px;
    font-weight: 500;
    color: #888888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.stylist-rating-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: #f9fafb;
    border: 1px solid var(--border-color);
    padding: 2px 6px;
    border-radius: 0px;
    margin-top: 4px;
}

.stylist-card.active .stylist-rating-badge {
    background: #ffffff;
    border-color: rgba(0, 0, 0, 0.1);
}

.rating-val {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-primary);
    margin-right: 2px;
}

.rating-star-icon {
    font-size: 9px;
    color: var(--text-primary);
}

/* Shipping info card */
.shipping-info-card {
    background: var(--gold-light);
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
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 12px 16px;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.25s ease;
}

.invoice-toggle-line:hover {
    border-color: var(--gold-solid);
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
    border: 1px solid #e5e7eb;
    padding: 10px 16px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    height: 80px;
    overflow: visible;
}

/* VNPay Branding */
.method-option.vnpay {
    position: relative;
    border: 2px solid #e5e7eb;
}

.method-option.vnpay:hover {
    border-color: rgba(0, 106, 194, 0.4);
    transform: translateY(-2px);
}

.method-option.vnpay.active {
    border-color: #006ac2;
    background-color: #f4f9ff;
    box-shadow: 0 8px 25px rgba(0, 106, 194, 0.15);
    border-width: 3px;
    transform: translateY(-2px) scale(1.02);
}

/* MoMo Branding */
.method-option.momo {
    position: relative;
    border: 2px solid #e5e7eb;
}

.method-option.momo:hover {
    border-color: rgba(216, 45, 139, 0.4);
    transform: translateY(-2px);
}

.method-option.momo.active {
    border-color: #d82d8b;
    background-color: #fff5fa;
    box-shadow: 0 8px 25px rgba(216, 45, 139, 0.15);
    border-width: 3px;
    transform: translateY(-2px) scale(1.02);
}

/* COD Branding */
.method-option.cod {
    position: relative;
    border: 2px solid #e5e7eb;
}

.method-option.cod:hover {
    border-color: rgba(22, 163, 74, 0.4);
    transform: translateY(-2px);
}

.method-option.cod.active {
    border-color: #16a34a;
    background-color: #f0fdf4;
    box-shadow: 0 8px 25px rgba(22, 163, 74, 0.15);
    border-width: 3px;
    transform: translateY(-2px) scale(1.02);
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
    border-radius: 24px;
    border: 1px solid #e5e7eb;
    background: #ffffff;
    outline: none;
    font-size: 13px;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.search-input:focus {
    border-color: var(--gold-solid);
    box-shadow: 0 0 0 3px rgba(191, 167, 122, 0.15);
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
    border-radius: 12px;
    z-index: 1000;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
    border: 1px solid #f0f0f0;
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
    background: var(--gold-light);
}

.service-dropdown-item img {
    border-radius: 6px;
    object-fit: cover;
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
    color: var(--gold-solid);
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
    background: #fafafb;
    border-radius: 0px;
    margin-bottom: 8px;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
}

.item-row:hover {
    border-color: rgba(0, 0, 0, 0.1);
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
    color: var(--gold-solid);
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
    color: var(--gold-solid);
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
    border-top: 1px dashed var(--border-color);
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
    border-top: 1px dashed var(--border-color);
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
    background: #fafafa;
    padding: 12px;
    border-radius: 0px;
    border: 1px solid var(--border-color);
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: var(--text-primary);
}

.pay-line span {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.pay-line b {
    font-size: 1.35rem;
    font-weight: 800;
    color: var(--text-primary);
}

/* Premium Confirmation Button */
.btn-confirm-metallic-final {
    width: 100%;
    padding: 16px;
    border: 1px solid var(--gold-solid);
    border-radius: 0px;
    background: var(--gold-metallic);
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
    color: var(--gold-solid) !important;
    transform: translateY(-2px);
    box-shadow: none;
}

.btn-confirm-metallic-final:hover .btn-text-normal {
    color: var(--gold-solid) !important;
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

/* Additional specific styles for ThanhToanTong */
.btn-load-stylist {
    height: 36px;
    padding: 0 16px;
    border: 1px solid var(--gold-solid);
    border-radius: 0px;
    background: var(--gold-metallic);
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    box-shadow: none;
    transition: 0.22s ease;
    font-size: 12px;
}

.btn-load-stylist i {
    color: #ffffff;
    margin-right: 5px;
}

.btn-load-stylist:hover:not(:disabled) {
    background: transparent;
    color: var(--gold-solid);
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
    to { transform: rotate(360deg); }
}

.soft-message {
    padding: 16px;
    border-radius: 0px;
    background: #fafafa;
    border: 1px solid var(--border-color);
    color: var(--text-secondary);
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13px;
    line-height: 1.5;
}

.soft-message.slim {
    padding: 10px 14px;
}

.store-box {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 16px;
    border-radius: 0px;
    background: #fafafa;
    border: 1px solid var(--border-color);
    color: var(--text-primary);
}

.store-box i {
    font-size: 20px;
    color: var(--text-primary);
}

.receive-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.receive-tabs button {
    height: 48px;
    border: 1px solid #e5e7eb;
    border-radius: 0px;
    background: #ffffff;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-secondary);
    font-size: 13px;
}

.receive-tabs button.active {
    background: var(--gold-metallic);
    color: #ffffff;
    border-color: transparent;
    box-shadow: none;
}

.pay-btn {
    border: 1px solid #e5e7eb;
    padding: 12px 14px;
    border-radius: 0px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.3s ease;
    background: #ffffff;
    font-size: 13px;
    color: var(--text-secondary);
}

.pay-btn:hover {
    border-color: rgba(0, 0, 0, 0.2);
}

.pay-btn.active {
    border-color: var(--gold-solid);
    background: var(--gold-light);
    color: var(--text-primary);
    font-weight: 600;
}

.pay-btn .dot {
    width: 14px;
    height: 14px;
    border: 2px solid #d1d5db;
    border-radius: 50%;
    margin-right: 10px;
    position: relative;
    transition: all 0.3s ease;
}

.pay-btn.active .dot {
    border-color: var(--gold-solid);
}

.pay-btn.active .dot::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--gold-solid);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}

.pay-now-alert {
    background: #f0fdf4;
    padding: 12px;
    border-radius: 8px;
    border: 1px solid #bbf7d0;
    margin-top: 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.pay-now-alert span:first-child {
    font-size: 11px;
    font-weight: 700;
    color: #15803d;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.pay-now-alert span:last-child {
    font-size: 1.35rem;
    font-weight: 800;
    color: #16a34a;
}

.bill-summary {
    border-top: 1px solid #f3f4f6;
    padding-top: 16px;
    margin-top: 16px;
}

.bill-summary .summary-line {
    margin-bottom: 8px;
    font-size: 13px;
    color: var(--text-secondary);
}

.bill-summary .summary-line span:first-child {
    font-weight: 500;
}

.bill-summary .summary-line span:last-child {
    font-weight: 600;
    color: var(--text-primary);
}

.total-line-final {
    margin-top: 16px;
    border-top: 1px dashed #e5e7eb;
    padding-top: 16px;
}

.total-lbl {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.total-val-standard {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
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

/* Custom disabled state cho Stylist */
.stylist-card.is-disabled {
    opacity: 0.45;
    filter: grayscale(100%);
    cursor: not-allowed;
    background: #f9fafb;
}

/* Tắt hiệu ứng nhảy lên khi hover vào thợ bận */
.stylist-card.is-disabled:hover {
    border-color: var(--border-color);
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
}

/* Badge trái tim cho thợ yêu thích */
.favorite-heart-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    color: #ef4444;
    /* Màu đỏ nổi bật */
    background: #ffffff;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
    z-index: 2;
    transition: transform 0.3s ease;
}

/* Hiệu ứng đập nhẹ khi hover vào thợ yêu thích */
.stylist-card:hover .favorite-heart-badge {
    transform: scale(1.15);
}
.stylist-schedule-info {
    position: relative;
    background-color: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 8px;
    margin-bottom: 20px;
    width: 100%;
    text-align: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stylist-schedule-info::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 5px;
    border-style: solid;
    border-color: #ffffff transparent transparent transparent;
    z-index: 2;
}

.stylist-schedule-info::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px;
    border-style: solid;
    border-color: var(--border-color) transparent transparent transparent;
    z-index: 1;
}

.schedule-header {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 4px;
    border-bottom: 1px dashed var(--border-color);
    padding-bottom: 4px;
}

.schedule-line {
    font-size: 10px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin-top: 2px;
}
</style>