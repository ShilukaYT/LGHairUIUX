<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { getCartDB, removeFromCartDB, addToCartDB, clearCartDB } from '@/Views/Anonymous/CSDL/cartDB';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';
import { KHO_ORIGIN, calculateShippingFee } from './shippingCalculator';
import { useAuthStore } from '@/stores/useAuthStore';

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
    tenSp?: string;
    tenBienThe?: string;
    tenItem: string;
    gia: number;
    hinhAnh?: string;
    soLuong: number;
    soLuongTon?: number;
};

const getImageUrl = (path?: string) => {
    if (!path) return '/images/no-image.png';
    if (path.startsWith('http')) return path;
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${API}${clean}`;
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

// Cờ chặn spam click & loading xoay vòng
const isSubmitting = ref(false);

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
    paymentMode: '10', // '10' hoặc '100'
    paymentMethod: 'vnpay', // 'vnpay' hoặc 'momo'
    note: ''
});

const productData = ref({
    receiveType: 'store' as 'store' | 'home',
    receiverName: customer.hoTen !== 'Khách vãng lai' ? customer.hoTen : '',
    receiverPhone: customer.sdt || '',
    receiverEmail: customer.email || '',
    address: '',
    deliveryNote: '',
    paymentMethod: 'vnpay' // 'vnpay', 'momo', 'cod'
});

// ==========================================
// HÓA ĐƠN ĐIỆN TỬ DOANH NGHIỆP
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
let productSearchTimeout: any = null;
let stockPollingTimer: any = null;

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
    validateField('bookingDate');
    validateField('tempTime');
    if (tempDate.value && tempTime.value) {
        bookingData.value.bookingDate = `${tempDate.value}T${tempTime.value}`;
    } else {
        bookingData.value.bookingDate = '';
    }
};

// ==========================================
// BỘ LỖI VALIDATION TỰ ĐỘNG TOÀN DIỆN (DỊCH VỤ + SẢN PHẨM)
// ==========================================
const errors = ref({
    customerName: '',
    phone: '',
    email: '',
    bookingDate: '',
    tempTime: '',
    stylist: '',
    receiverName: '',
    receiverPhone: '',
    receiverEmail: '',
    address: '',
    cart: '',
    invoice: ''
});

const validateField = (field: string) => {
    switch (field) {
        case 'customerName': {
            const name = (bookingData.value.customerName || '').trim();
            if (!name) {
                errors.value.customerName = 'Vui lòng nhập họ và tên khách hàng.';
            } else if (name.length < 2) {
                errors.value.customerName = 'Họ và tên phải có tối thiểu 2 ký tự.';
            } else if (/[0-9]/.test(name)) {
                errors.value.customerName = 'Họ và tên không được chứa chữ số.';
            } else {
                errors.value.customerName = '';
            }
            break;
        }
        case 'phone': {
            const phone = (bookingData.value.phone || '').trim();
            const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
            if (!phone) {
                errors.value.phone = 'Vui lòng nhập số điện thoại.';
            } else if (!phoneRegex.test(phone)) {
                errors.value.phone = 'Số điện thoại không hợp lệ (gồm 10 số, VD: 0912345678).';
            } else {
                errors.value.phone = '';
            }
            break;
        }
        case 'email': {
            const email = (bookingData.value.email || '').trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                errors.value.email = 'Vui lòng nhập email nhận thông báo.';
            } else if (!emailRegex.test(email)) {
                errors.value.email = 'Email không hợp lệ (VD: example@gmail.com).';
            } else {
                errors.value.email = '';
            }
            break;
        }
        case 'bookingDate': {
            if (bookingData.value.selectedServices.length > 0) {
                if (!tempDate.value) {
                    errors.value.bookingDate = 'Vui lòng chọn ngày hẹn dịch vụ.';
                } else {
                    const todayStr = new Date().toISOString().split('T')[0] || '';
                    if (tempDate.value < todayStr) {
                        errors.value.bookingDate = 'Ngày hẹn không được ở quá khứ.';
                    } else {
                        errors.value.bookingDate = '';
                    }
                }
            } else {
                errors.value.bookingDate = '';
            }
            break;
        }
        case 'tempTime': {
            if (bookingData.value.selectedServices.length > 0) {
                if (!tempTime.value) {
                    errors.value.tempTime = 'Vui lòng chọn khung giờ hẹn.';
                } else {
                    const todayStr = new Date().toISOString().split('T')[0] || '';
                    if (tempDate.value === todayStr) {
                        const now = new Date();
                        const currentMinutes = now.getHours() * 60 + now.getMinutes();
                        const [h = 0, m = 0] = tempTime.value.split(':').map(Number);
                        const selectedMinutes = h * 60 + m;
                        if (selectedMinutes <= currentMinutes + 10) {
                            errors.value.tempTime = 'Khung giờ này đã qua hoặc quá sát giờ hiện tại.';
                            break;
                        }
                    }
                    errors.value.tempTime = '';
                }
            } else {
                errors.value.tempTime = '';
            }
            break;
        }
        case 'stylist': {
            if (bookingData.value.selectedServices.length > 0) {
                if (!bookingData.value.stylistId) {
                    errors.value.stylist = 'Vui lòng chọn Stylist phục vụ.';
                } else {
                    const found = stylists.value.find(s => String(s.id) === String(bookingData.value.stylistId));
                    if (found && !found.isAvailable) {
                        errors.value.stylist = 'Stylist này hiện không khả dụng trong khung giờ đã chọn.';
                    } else {
                        errors.value.stylist = '';
                    }
                }
            } else {
                errors.value.stylist = '';
            }
            break;
        }
        case 'receiverName': {
            if (productItems.value.length > 0 && productData.value.receiveType === 'home') {
                const name = (productData.value.receiverName || '').trim();
                if (!name) {
                    errors.value.receiverName = 'Vui lòng nhập họ tên người nhận hàng.';
                } else if (name.length < 2) {
                    errors.value.receiverName = 'Họ và tên người nhận phải có tối thiểu 2 ký tự.';
                } else if (/[0-9]/.test(name)) {
                    errors.value.receiverName = 'Họ và tên không được chứa chữ số.';
                } else {
                    errors.value.receiverName = '';
                }
            } else {
                errors.value.receiverName = '';
            }
            break;
        }
        case 'receiverPhone': {
            if (productItems.value.length > 0 && productData.value.receiveType === 'home') {
                const phone = (productData.value.receiverPhone || '').trim();
                const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
                if (!phone) {
                    errors.value.receiverPhone = 'Vui lòng nhập số điện thoại người nhận.';
                } else if (!phoneRegex.test(phone)) {
                    errors.value.receiverPhone = 'Số điện thoại người nhận không hợp lệ (gồm 10 số, VD: 0912345678).';
                } else {
                    errors.value.receiverPhone = '';
                }
            } else {
                errors.value.receiverPhone = '';
            }
            break;
        }
        case 'receiverEmail': {
            if (productItems.value.length > 0 && productData.value.receiveType === 'home') {
                const email = (productData.value.receiverEmail || '').trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!email) {
                    errors.value.receiverEmail = 'Vui lòng nhập email người nhận hàng.';
                } else if (!emailRegex.test(email)) {
                    errors.value.receiverEmail = 'Email người nhận không hợp lệ (VD: example@gmail.com).';
                } else {
                    errors.value.receiverEmail = '';
                }
            } else {
                errors.value.receiverEmail = '';
            }
            break;
        }
        case 'address': {
            if (productItems.value.length > 0 && productData.value.receiveType === 'home') {
                const addr = (productData.value.address || '').trim();
                if (!addr) {
                    errors.value.address = 'Vui lòng nhập địa chỉ giao hàng chi tiết.';
                } else if (addr.length < 6) {
                    errors.value.address = 'Địa chỉ giao hàng quá ngắn (cần số nhà, tên đường, phường/xã, quận/huyện...).';
                } else {
                    errors.value.address = '';
                }
            } else {
                errors.value.address = '';
            }
            break;
        }
        case 'cart': {
            if (bookingData.value.selectedServices.length === 0 && productItems.value.length === 0) {
                errors.value.cart = 'Giỏ hàng đang trống! Vui lòng chọn ít nhất 1 dịch vụ hoặc 1 sản phẩm.';
            } else {
                errors.value.cart = '';
            }
            break;
        }
    }
};

const validateAllForm = (): boolean => {
    validateField('customerName');
    validateField('phone');
    validateField('email');
    validateField('bookingDate');
    validateField('tempTime');
    validateField('stylist');
    validateField('receiverName');
    validateField('receiverPhone');
    validateField('receiverEmail');
    validateField('address');
    validateField('cart');

    const invoiceErr = validateInvoiceInfo();
    if (invoiceErr) {
        errors.value.invoice = invoiceErr;
    } else {
        errors.value.invoice = '';
    }

    return !Object.values(errors.value).some(err => !!err);
};

watch(() => bookingData.value.selectedServices.length, () => {
    validateField('bookingDate');
    validateField('tempTime');
    validateField('stylist');
    validateField('cart');
});

watch(() => productItems.value.length, () => {
    validateField('receiverName');
    validateField('receiverPhone');
    validateField('receiverEmail');
    validateField('address');
    validateField('cart');
});

watch(() => bookingData.value.stylistId, () => {
    validateField('stylist');
});

watch(() => productData.value.receiveType, () => {
    validateField('receiverName');
    validateField('receiverPhone');
    validateField('receiverEmail');
    validateField('address');
});

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

// ==========================================
// TÍNH TỔNG TIỀN VÀ GOM ID (DỊCH VỤ + SẢN PHẨM)
// ==========================================
const combinedSubTotal = computed(() => serviceSubTotal.value + productSubTotal.value);

const combinedItemIds = computed(() => {
    const sIds = bookingData.value.selectedServices.map(s => s.id);
    const pIds = productItems.value.map(p => p.id);
    return [...sIds, ...pIds].join(',');
});

const stackPreview = ref({ totalDiscount: 0, finalAmount: 0, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 });
const discountAmount = computed(() => Number(stackPreview.value.totalDiscount || 0));
const memberDiscount = computed(() => Number(stackPreview.value.memberDiscount || 0));
const voucherAmount = computed(() => Number(stackPreview.value.voucherAmount || 0));
const memberRankPercent = computed(() => Number(stackPreview.value.memberRankPercent || 0));
const grandTotal = computed(() => Math.max(0, stackPreview.value.finalAmount) + shippingFee.value);

const payNow = computed(() => {
    let servicePayment = 0;
    if (bookingData.value.selectedServices.length > 0) {
        if (bookingData.value.paymentMode === '10') {
            servicePayment = serviceSubTotal.value * 0.1;
        } else {
            servicePayment = Math.max(0, serviceSubTotal.value - discountAmount.value);
        }
    }

    let productPayment = 0;
    if (productItems.value.length > 0) {
        const remainingDiscount = Math.max(0, discountAmount.value - serviceSubTotal.value);
        const productAfterDiscount = Math.max(0, productSubTotal.value - remainingDiscount);
        if (productData.value.paymentMethod !== 'cod' && productData.value.receiveType === 'home') {
            productPayment = productAfterDiscount + shippingFee.value;
        } else if (productData.value.receiveType === 'store') {
            productPayment = 0;
        } else {
            productPayment = 0;
        }
    }

    return servicePayment + productPayment;
});

const remainAtStore = computed(() => {
    let total = 0;

    if (bookingData.value.selectedServices.length > 0 && bookingData.value.paymentMode === '10') {
        const serviceAfterVoucher = Math.max(0, serviceSubTotal.value - discountAmount.value);
        total += Math.max(0, serviceAfterVoucher - (serviceSubTotal.value * 0.1));
    }

    if (productItems.value.length > 0 && productData.value.receiveType === 'store') {
        const remainingDiscount = Math.max(0, discountAmount.value - serviceSubTotal.value);
        total += Math.max(0, productSubTotal.value - remainingDiscount);
    }

    return total;
});

const remainCOD = computed(() => {
    if (productItems.value.length === 0 || productData.value.paymentMethod !== 'cod' || productData.value.receiveType !== 'home') return 0;
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

const formatMoney = (money: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(money || 0));
};

// ==========================================
// VOUCHER LOGIC
// ==========================================
const isVoucherDisabled = (v: any) => {
    if (v.isAvailable === false) return true;
    if (v.desc && v.desc.includes('Đơn tối thiểu')) {
        const match = v.desc.match(/Đơn tối thiểu ([\d,]+)đ/);
        if (match) {
            const minVal = parseInt(match[1].replace(/,/g, ''));
            if (combinedSubTotal.value < minVal) return true;
        }
    }
    return false;
};

const loadVouchers = async () => {
    if (!customerId.value || customerId.value === 'GUEST') return;
    try {
        const res = await axios.get(`${API}/api/ThanhToanTong/get-my-vouchers/${customerId.value}`, {
            params: {
                subTotal: combinedSubTotal.value, 
                ngayGioHen: bookingData.value.bookingDate || undefined,
                itemIds: combinedItemIds.value || undefined
            }
        });
        myVouchers.value = res.data || [];
        bookingData.value.voucherIds = bookingData.value.voucherIds.filter(id => {
            const v = myVouchers.value.find(x => x.id === id);
            return v && !isVoucherDisabled(v);
        });
    } catch (error) {
        console.error('Lỗi load voucher:', error);
    }
};

const refreshStackPreview = async () => {
    if (!customerId.value || customerId.value === 'GUEST') {
        stackPreview.value = { totalDiscount: 0, finalAmount: combinedSubTotal.value, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 };
        return;
    }
    try {
        const codes = bookingData.value.voucherIds.join(',');
        const res = await axios.get(`${API}/api/ThanhToanTong/preview-voucher-stack`, {
            params: {
                maKH: customerId.value,
                codes,
                subTotal: combinedSubTotal.value,
                ngayGioHen: bookingData.value.bookingDate || undefined,
                itemIds: combinedItemIds.value || undefined
            }
        });
        stackPreview.value = {
            totalDiscount: Number(res.data.totalDiscount) || 0,
            finalAmount: Number(res.data.finalAmount) || combinedSubTotal.value,
            memberDiscount: Number(res.data.memberDiscount) || 0,
            voucherAmount: Number(res.data.voucherAmount) || 0,
            memberRankPercent: Number(res.data.memberRankPercent) || 0
        };
    } catch (e: any) {
        stackPreview.value = { totalDiscount: 0, finalAmount: combinedSubTotal.value, memberDiscount: 0, voucherAmount: 0, memberRankPercent: 0 };
        const msg = e.response?.data?.message || 'Voucher không đủ điều kiện áp dụng!';
        Swal.fire({ title: 'Opps!', text: msg, icon: 'warning', confirmButtonText: 'Đã hiểu', confirmButtonColor: '#000' });
        if (bookingData.value.voucherIds.length > 0) {
            bookingData.value.voucherIds.pop();
        }
    }
};

function toggleVoucher(id: string) {
    const ids = bookingData.value.voucherIds;
    const v = myVouchers.value.find(x => x.id === id);
    if (v && isVoucherDisabled(v)) {
        Swal.fire({ 
            title: 'Không hợp lệ', 
            text: 'Không thể áp dụng voucher: ' + (v.errorMessage || 'Chưa đủ điều kiện.'), 
            icon: 'warning', 
            confirmButtonText: 'Đã hiểu', 
            confirmButtonColor: '#000' 
        });
        return;
    }
    const i = ids.indexOf(id);
    if (i >= 0) {
        ids.splice(i, 1);
        return;
    }
    if (ids.length >= 2) {
        Swal.fire({ 
            title: 'Giới hạn voucher', 
            text: 'Chỉ chọn tối đa 2 voucher cho đơn hàng.', 
            icon: 'info', 
            confirmButtonText: 'Đã hiểu', 
            confirmButtonColor: '#000' 
        });
        return;
    }
    ids.push(id);
}

// ==========================================
// THÊM / XÓA / SỬA DỊCH VỤ & SẢN PHẨM
// ==========================================
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
    const bookingStore = useBookingBasketStore();
    bookingStore.removeItem(id);
    try {
        await removeFromCartDB(id, 'DICHVU');
    } catch (error) {
        console.error('Lỗi xóa dịch vụ:', error);
    }
    await loadVouchers();
};

const addProduct = (sp: any, bt: any) => {
    if (bt.soLuongTon <= 0) return;

    const existingProduct = productItems.value.find(p => p.id === bt.maBienThe);

    if (existingProduct) {
        if (existingProduct.soLuong >= bt.soLuongTon) {
            Swal.fire({
                icon: 'warning',
                title: 'Vượt quá số lượng',
                text: `Chỉ còn ${bt.soLuongTon} sản phẩm trong kho!`,
                confirmButtonColor: '#000'
            });
            return;
        }
        existingProduct.soLuong++;
    } else {
        productItems.value.push({
            id: bt.maBienThe,
            tenSp: sp.tenSp,
            tenBienThe: bt.tenBienThe,
            tenItem: `${sp.tenSp} - ${bt.tenBienThe}`,
            gia: Number(bt.giaBan || 0),
            hinhAnh: bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien,
            soLuong: 1,
            soLuongTon: bt.soLuongTon
        });
    }

    try {
        addToCartDB({
            id: bt.maBienThe,
            tenItem: `${sp.tenSp} - ${bt.tenBienThe}`,
            gia: Number(bt.giaBan || 0),
            type: 'SANPHAM',
            soLuong: 1,
            hinhAnh: bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien
        }, customerId.value || 'GUEST');
    } catch (e) {
        console.error("Lỗi thêm cart db:", e);
    }

    productSearch.value = '';
    showProductDropdown.value = false;
};

const removeProduct = (id: any) => {
    productItems.value = productItems.value.filter(p => p.id !== id);
    removeFromCartDB(id, 'SANPHAM').catch(e => console.error(e));
};

const increaseQuantity = (item: ProductItem) => {
    if (item.soLuongTon !== undefined && item.soLuong >= item.soLuongTon) {
        Swal.fire({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            icon: 'warning',
            title: `Chỉ còn ${item.soLuongTon} sản phẩm trong kho!`
        });
        return;
    }
    item.soLuong++;
};

const decreaseQuantity = (item: ProductItem) => {
    if (item.soLuong > 1) item.soLuong--;
};

const onQuantityInput = (item: ProductItem) => {
    if (item.soLuongTon !== undefined && Number(item.soLuong) > item.soLuongTon) {
        item.soLuong = item.soLuongTon;
        Swal.fire({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            icon: 'warning',
            title: `Số lượng vượt quá tồn kho (tối đa ${item.soLuongTon} sp)!`
        });
    }
};

const validateQuantity = (item: ProductItem) => {
    let newQty = Number(item.soLuong);
    if (isNaN(newQty) || newQty < 1) {
        newQty = 1;
    }

    if (item.soLuongTon !== undefined && newQty > item.soLuongTon) {
        newQty = item.soLuongTon;
        Swal.fire({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2500,
            icon: 'warning',
            title: `Số lượng vượt quá tồn kho (tối đa ${item.soLuongTon} sp)!`
        });
    }

    item.soLuong = newQty;
};

// ==========================================
// TẢI STYLISTS KHẢ DỤNG
// ==========================================
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
            maKh: customerId.value,
            phone: bookingData.value.phone
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

        mapped.sort((a: any, b: any) => {
            if (a.isAvailable !== b.isAvailable) {
                return a.isAvailable ? -1 : 1;
            }
            const favA = a.isFavorite ? 1 : 0;
            const favB = b.isFavorite ? 1 : 0;
            return favB - favA;
        });

        stylists.value = mapped;

        if (bookingData.value.stylistId && !stylists.value.some(s => String(s.id) === String(bookingData.value.stylistId) && s.isAvailable)) {
            bookingData.value.stylistId = null;
            Swal.fire({
                title: 'Stylist bận',
                text: 'Stylist bạn chọn đã bận vào khung giờ này do thay đổi thời gian dịch vụ. Vui lòng chọn thợ khác!',
                icon: 'info',
                confirmButtonColor: '#000'
            });
        }

        if (stylists.value.length === 0) {
            stylistMessage.value = 'Không tìm thấy stylist trống trong khung giờ này. Hãy đổi ngày hoặc giờ khác.';
        }
    } catch (error) {
        console.error('Lỗi tải stylist:', error);
        stylists.value = [];
        bookingData.value.stylistId = null;
        stylistMessage.value = 'Không tải được danh sách stylist. Vui lòng thử lại sau.';
    } finally {
        loadingStylists.value = false;
    }
};

// ==========================================
// TẢI DỮ LIỆU TỪ SERVER & POLLING
// ==========================================
const loadServices = async () => {
    try {
        const res = await axios.get(`${API}/api/ThanhToanTong/get-services`);
        if (res.data && res.data.success) {
            allItemsFromApi.value = [...res.data.services, ...res.data.combos];
        }
    } catch (error) {
        console.error('Lỗi tải danh sách dịch vụ:', error);
        allItemsFromApi.value = []; 
    }
};

const loadProductsWithVariants = async (keyword = '') => {
    try {
        const res = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
            params: { keyword: keyword }
        });
        if (res.data && res.data.success) {
            allProductsFromApi.value = res.data.data;
        }
    } catch (error) {
        console.error('Lỗi tải danh sách sản phẩm:', error);
        allProductsFromApi.value = [];
    }
};

watch(productSearch, (newVal) => {
    clearTimeout(productSearchTimeout);
    productSearchTimeout = setTimeout(() => {
        loadProductsWithVariants(newVal);
    }, 500);
});

watch(
    () => [
        bookingData.value.voucherIds.slice(),
        combinedSubTotal.value,
        customerId.value,
        bookingData.value.bookingDate,
        bookingData.value.selectedServices.map(s => s.id).join(','),
        productItems.value.length
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
// XỬ LÝ THANH TOÁN (XỬ LÝ HẾT HÀNG ĐA BƯỚC KHÔNG HỦY 1 LÚC)
// ==========================================
const handlePayment = async () => {
    if (isSubmitting.value) return;

    // 1. Validate toàn bộ form tự động
    if (!validateAllForm()) {
        const activeErrors = Object.values(errors.value).filter(err => !!err);
        let errorHtml = '<div style="text-align: left; font-size: 14px; line-height: 1.6; margin-top: 8px;">';
        if (activeErrors.length === 1) {
            errorHtml += `<p style="text-align: center; margin: 0;">${activeErrors[0]}</p>`;
        } else {
            errorHtml += '<p style="margin-bottom: 8px; font-weight: 600;">Vui lòng kiểm tra và hoàn thiện các thông tin sau:</p><ul style="padding-left: 20px; list-style-type: disc; margin: 0;">';
            activeErrors.forEach(err => {
                errorHtml += `<li style="color: #ef4444; margin-bottom: 4px;">${err}</li>`;
            });
            errorHtml += '</ul>';
        }
        errorHtml += '</div>';

        Swal.fire({
            title: 'Thông tin chưa hợp lệ',
            html: errorHtml,
            icon: 'warning',
            confirmButtonText: 'Đã hiểu',
            confirmButtonColor: '#1e293b'
        });
        return;
    }

    // BACKUP LOCALSTORAGE ĐỂ CHỐNG MẤT DATA KHI BACK TỪ VNPAY
    localStorage.setItem('temp_name', bookingData.value.customerName);
    localStorage.setItem('temp_phone', bookingData.value.phone);
    localStorage.setItem('temp_email', bookingData.value.email);
    localStorage.setItem('temp_note', bookingData.value.note);
    localStorage.setItem('temp_stylist_id', bookingData.value.stylistId || '');
    localStorage.setItem('temp_date', bookingData.value.bookingDate || '');
    localStorage.setItem('temp_receive_type', productData.value.receiveType);
    if (productData.value.receiveType === 'home') {
        localStorage.setItem('temp_receiver_name', productData.value.receiverName);
        localStorage.setItem('temp_receiver_phone', productData.value.receiverPhone);
        localStorage.setItem('temp_address', productData.value.address);
    }

    isSubmitting.value = true;

    try {
        const checkoutType = bookingData.value.selectedServices.length > 0 && productItems.value.length > 0
                ? 'DAT_LICH_VA_MUA_SAN_PHAM'
                : bookingData.value.selectedServices.length > 0 ? 'CHI_DAT_LICH' : 'CHI_MUA_SAN_PHAM';

        const payload = {
            checkoutType: checkoutType,
            maKh: customerId.value || 'GUEST',
            customerName: bookingData.value.customerName,
            phone: bookingData.value.phone,
            email: bookingData.value.email || '',
            note: bookingData.value.note || '',
            
            bookingDate: bookingData.value.bookingDate || null,
            stylistId: bookingData.value.stylistId || '',
            services: bookingData.value.selectedServices.map(s => ({ 
                id: s.id, 
                price: s.price,
                duration: Number(s.duration || 30)
            })),
            
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

            voucherIds: bookingData.value.voucherIds || [],
            shippingFee: shippingFee.value || 0,
            grandTotal: grandTotal.value, 
            paidAmount: payNow.value,

            paymentMode: bookingData.value.paymentMode, 
            servicePaymentMethod: bookingData.value.paymentMethod,
            productPaymentMethod: productData.value.paymentMethod,

            invoiceInfo: buildInvoiceInfoPayload()
        };

        const res = await axios.post(`${API}/api/ThanhToanTong/submit-checkout`, payload);

        if (res.data && res.data.success) {
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

            localStorage.removeItem('checkoutData');
            localStorage.removeItem('cart'); 
            localStorage.removeItem('cartSP'); 

            try {
                for (const s of bookingData.value.selectedServices) {
                    await removeFromCartDB(s.id, 'DICHVU');
                }
                for (const p of productItems.value) {
                    await removeFromCartDB(p.id, 'SANPHAM');
                }
                await clearCartDB(customerId.value || 'GUEST');
            } catch (err) {
                console.error('Lỗi khi xóa cartDB:', err);
            }

            productItems.value = [];
            bookingData.value.selectedServices = [];
            useBookingBasketStore().clearAll();

            if (res.data.isOnlinePayment && res.data.url) {
                window.location.href = res.data.url;
            } else {
                router.push({ path: '/payment-result-tong', query: { maHd: res.data.maHd } });
            }
        }
    } catch (error: any) {
        console.error('Lỗi thanh toán:', error);
        const errData = error.response?.data;

        const isOutOfStock = errData && (
            errData.errorCode === 'PRODUCT_OUT_OF_STOCK' ||
            (typeof errData.message === 'string' && (
                errData.message.toLowerCase().includes('tồn kho') ||
                errData.message.toLowerCase().includes('hết hàng') ||
                errData.message.toLowerCase().includes('không đủ số lượng') ||
                errData.message.toLowerCase().includes('vượt quá số lượng')
            ))
        );

        if (isOutOfStock) {
            let outOfStockId = errData.outOfStockProductId;
            if (!outOfStockId && productItems.value.length > 0) {
                const matched = productItems.value.find(p => errData.message && typeof errData.message === 'string' && errData.message.includes(p.tenItem));
                outOfStockId = matched ? matched.id : productItems.value[0]?.id;
            }

            const result = await Swal.fire({
                title: 'Hết hàng đột xuất!',
                text: `${errData.message || 'Một sản phẩm trong đơn đã hết hàng.'}\n\nBạn có muốn BỎ sản phẩm này ra khỏi đơn để tiếp tục thực hiện đơn hàng không?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#000',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Bỏ sản phẩm & Tiếp tục',
                cancelButtonText: 'Không bỏ sản phẩm'
            });

            if (result.isConfirmed) {
                if (outOfStockId) {
                    productItems.value = productItems.value.filter(p => p.id !== outOfStockId);
                    removeFromCartDB(outOfStockId, 'SANPHAM').catch(e => console.error(e));
                }

                if (productItems.value.length === 0) {
                    if (bookingData.value.selectedServices.length > 0) {
                        const serviceChoice = await Swal.fire({
                            title: 'Sản phẩm đã hết!',
                            text: 'Tất cả sản phẩm trong đơn đã hết hàng. Bạn có muốn tiếp tục ĐẶT LỊCH HẸN DỊCH VỤ không?',
                            icon: 'question',
                            showCancelButton: true,
                            confirmButtonColor: '#000',
                            cancelButtonColor: '#6b7280',
                            confirmButtonText: 'Tiếp tục đặt lịch dịch vụ',
                            cancelButtonText: 'Hủy toàn bộ đơn'
                        });

                        if (serviceChoice.isConfirmed) {
                            setTimeout(() => {
                                handlePayment();
                            }, 600);
                        } else {
                            const doubleConfirm = await Swal.fire({
                                title: 'Xác nhận hủy đặt lịch?',
                                text: 'Bạn có chắc chắn muốn hủy luôn lịch hẹn dịch vụ và rời khỏi trang thanh toán không?',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonColor: '#d33',
                                cancelButtonColor: '#000',
                                confirmButtonText: 'Đúng, hủy toàn bộ',
                                cancelButtonText: 'Không, giữ lại lịch dịch vụ'
                            });

                            if (doubleConfirm.isConfirmed) {
                                for (const s of bookingData.value.selectedServices) {
                                    await removeFromCartDB(s.id, 'DICHVU').catch(() => {});
                                }
                                bookingData.value.selectedServices = [];
                                await clearCartDB(customerId.value || 'GUEST');
                                Swal.fire({
                                    title: 'Đã hủy',
                                    text: 'Đã hủy toàn bộ đơn hàng và lịch hẹn dịch vụ.',
                                    icon: 'info',
                                    confirmButtonColor: '#000'
                                });
                                router.push('/cart');
                            } else {
                                Swal.fire({
                                    title: 'Đã giữ lại lịch hẹn',
                                    text: 'Lịch hẹn dịch vụ của bạn vẫn được giữ nguyên. Bạn có thể thanh toán dịch vụ bất kỳ lúc nào.',
                                    icon: 'success',
                                    confirmButtonColor: '#000'
                                });
                            }
                        }
                    } else {
                        Swal.fire({
                            title: 'Giỏ hàng trống',
                            text: 'Tất cả sản phẩm trong giỏ hàng đều đã hết hàng!',
                            icon: 'info',
                            confirmButtonColor: '#000'
                        });
                        router.push('/cart');
                    }
                } else {
                    setTimeout(() => {
                        handlePayment();
                    }, 600);
                }
            } else {
                if (bookingData.value.selectedServices.length > 0) {
                    const cancelChoice = await Swal.fire({
                        title: 'Giữ lịch hẹn hay hủy toàn bộ?',
                        text: 'Sản phẩm này hiện đang hết hàng. Bạn có muốn giữ lại lịch hẹn dịch vụ để tiếp tục đặt lịch không?',
                        icon: 'question',
                        showCancelButton: true,
                        showDenyButton: true,
                        confirmButtonText: 'Chỉ đặt lịch dịch vụ',
                        denyButtonText: 'Hủy toàn bộ đơn',
                        cancelButtonText: 'Đóng (Giữ nguyên)',
                        confirmButtonColor: '#000',
                        denyButtonColor: '#d33'
                    });

                    if (cancelChoice.isConfirmed) {
                        productItems.value = [];
                        await clearCartDB(customerId.value || 'GUEST', 'SANPHAM');
                        setTimeout(() => {
                            handlePayment();
                        }, 600);
                    } else if (cancelChoice.isDenied) {
                        const doubleConfirm = await Swal.fire({
                            title: 'Xác nhận hủy tất cả?',
                            text: 'Bạn có chắc chắn muốn hủy toàn bộ đơn hàng (bao gồm cả lịch hẹn dịch vụ) không?',
                            icon: 'warning',
                            showCancelButton: true,
                            confirmButtonColor: '#d33',
                            cancelButtonColor: '#000',
                            confirmButtonText: 'Đúng, hủy tất cả',
                            cancelButtonText: 'Không, giữ lại'
                        });

                        if (doubleConfirm.isConfirmed) {
                            for (const s of bookingData.value.selectedServices) {
                                await removeFromCartDB(s.id, 'DICHVU').catch(() => {});
                            }
                            bookingData.value.selectedServices = [];
                            productItems.value = [];
                            await clearCartDB(customerId.value || 'GUEST');
                            Swal.fire({
                                title: 'Đã hủy',
                                text: 'Giao dịch thanh toán đã bị hủy.',
                                icon: 'info',
                                confirmButtonColor: '#000'
                            });
                            router.push('/cart');
                        }
                    }
                } else {
                    Swal.fire({
                        title: 'Đã hủy',
                        text: 'Giao dịch thanh toán đã bị hủy.',
                        icon: 'info',
                        confirmButtonColor: '#000'
                    });
                }
            }
            return;
        }

        Swal.fire({
            title: 'Lỗi thanh toán',
            text: errData?.message || 'Có lỗi xảy ra khi tạo giao dịch. Vui lòng thử lại!',
            icon: 'error',
            confirmButtonColor: '#000'
        });
    } finally {
        isSubmitting.value = false;
    }
};

const authStore = useAuthStore();
const isSessionExpired = computed({
    get: () => authStore.sessionExpiredBanner,
    set: (val: boolean) => authStore.setSessionExpiredBanner(val)
});

const loadFavoriteEmployees = async (cId: string) => {
    if (!cId || cId === 'GUEST') {
        favoriteStylistIds.value = [];
        return;
    }
    const saved = localStorage.getItem(`favorite_employees_${cId}`);
    if (saved) {
        try {
            favoriteStylistIds.value = JSON.parse(saved).map((id: string) => String(id).trim());
        } catch (e) {
            favoriteStylistIds.value = [];
        }
    }
    try {
        const resFav = await axios.get(`${API}/api/YeuThich/employees/${cId}`);
        if (resFav.data && Array.isArray(resFav.data)) {
            const apiFavs = resFav.data.map((id: string) => String(id).trim());
            favoriteStylistIds.value = Array.from(new Set([...favoriteStylistIds.value, ...apiFavs]));
        }
    } catch (error) {
        console.error("Lỗi khi load thợ yêu thích:", error);
    }
};

const checkAndSyncCustomerSession = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (token || savedUser) {
        try {
            const res = await axios.get(`${API}/api/account/get-profile`, { withCredentials: true });
            if (res.data?.success && res.data?.user) {
                const u = res.data.user;
                localStorage.setItem('user', JSON.stringify(u));
                customerId.value = u.maKH || 'GUEST';
                bookingData.value.customerName = u.hoTen || '';
                bookingData.value.email = u.email || '';
                bookingData.value.phone = u.sdt || '';
                productData.value.receiverName = u.hoTen || '';
                productData.value.receiverEmail = u.email || '';
                productData.value.receiverPhone = u.sdt || '';
                isSessionExpired.value = false;
                await loadFavoriteEmployees(customerId.value);
            }
        } catch (err: any) {
            console.warn('Lỗi xác thực phiên tại trang thanh toán tổng:', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('refresh_token');
                customerId.value = 'GUEST';
                isSessionExpired.value = true;

                // Xóa sạch nội dung textbox khi phiên hết hạn
                bookingData.value.customerName = '';
                bookingData.value.email = '';
                bookingData.value.phone = '';
                bookingData.value.voucherIds = [];
                productData.value.receiverName = '';
                productData.value.receiverEmail = '';
                productData.value.receiverPhone = '';
                productData.value.address = '';
                favoriteStylistIds.value = [];

                window.dispatchEvent(new Event('user-updated'));
            }
        }
    } else {
        const customer = getCustomerInfo();
        customerId.value = customer.maKH;
        if (customer.maKH !== 'GUEST') {
            bookingData.value.customerName = customer.hoTen || '';
            bookingData.value.email = customer.email || '';
            bookingData.value.phone = customer.sdt || '';
            productData.value.receiverName = customer.hoTen || '';
            productData.value.receiverEmail = customer.email || '';
            productData.value.receiverPhone = customer.sdt || '';
            isSessionExpired.value = false;
            await loadFavoriteEmployees(customerId.value);
        } else {
            customerId.value = 'GUEST';
            bookingData.value.customerName = '';
            bookingData.value.email = '';
            bookingData.value.phone = '';
            bookingData.value.voucherIds = [];
            productData.value.receiverName = '';
            productData.value.receiverEmail = '';
            productData.value.receiverPhone = '';
            favoriteStylistIds.value = [];
        }
    }
};

const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        checkAndSyncCustomerSession();
    }
};

onMounted(async () => {
    // 0. Xác thực phiên và tự động nạp thông tin người dùng mới nhất
    await checkAndSyncCustomerSession();

    // Đăng ký các sự kiện phản ứng nhanh
    window.addEventListener('user-updated', checkAndSyncCustomerSession);
    window.addEventListener('storage', checkAndSyncCustomerSession);
    window.addEventListener('focus', checkAndSyncCustomerSession);
    document.addEventListener('visibilitychange', onVisibilityChange);

    await loadServices();
    await loadProductsWithVariants('');

    // 2. KHÔI PHỤC GIỎ HÀNG (TỪ CHECKOUT MỚI HOẶC TỪ BACKUP BACK TRÌNH DUYỆT)
    const checkoutRaw = localStorage.getItem('checkoutData');

    if (checkoutRaw) {
        try {
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
                soLuong: Number(item.soLuong || item.quantity || 1),
                soLuongTon: item.soLuongTon
            }));

            if (checkoutData.nhanSanPham === 'GIAO_TAN_NHA') productData.value.receiveType = 'home';
            if (checkoutData.thongTinGiaoHang) {
                productData.value.receiverName = checkoutData.thongTinGiaoHang.hoTen || productData.value.receiverName;
                productData.value.receiverPhone = checkoutData.thongTinGiaoHang.soDienThoai || productData.value.receiverPhone;
                productData.value.address = checkoutData.thongTinGiaoHang.diaChi || '';
                productData.value.deliveryNote = checkoutData.thongTinGiaoHang.ghiChu || '';
            }
        } catch (e) {
            console.error("Lỗi parse checkoutData:", e);
        }
    } else {
        let cartData: any = null;
        
        const bookingStore = useBookingBasketStore();
        if (bookingStore.items && bookingStore.items.length > 0) {
            bookingData.value.selectedServices = bookingStore.items.map((item: any) => ({
                id: item.id,
                name: item.tenItem,
                price: Number(item.gia || 0),
                originalPrice: Number(item.giaGoc || item.gia || 0),
                icon: item.icon || 'fas fa-check-circle',
                duration: Number(item.duration || 30),
                hinhAnh: item.hinhAnh
            }));
        } else {
            if (!cartData) cartData = await getCartDB(customerId.value || 'GUEST');
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

        if (!cartData) cartData = await getCartDB(customerId.value || 'GUEST');
        if (cartData && cartData.length > 0) {
            productItems.value = cartData
                .filter((item: any) => item.type === 'SANPHAM' || String(item.id).startsWith('SANPHAM_'))
                .map((item: any) => ({
                    id: item.id,
                    tenItem: item.tenItem,
                    gia: Number(item.gia || 0),
                    hinhAnh: item.hinhAnh,
                    soLuong: Number(item.soLuong || 1),
                    soLuongTon: item.soLuongTon
                }));
        }
    }

    await loadVouchers();
    await loadAvailableStylists();

    const syncStock = async () => {
        try {
            const res = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
                params: { keyword: '' }
            });
            if (res.data && res.data.success) {
                const allFresh = res.data.data;
                productItems.value.forEach(p => {
                    for (const sp of allFresh) {
                        const bt = sp.bienthes?.find((b: any) => b.maBienThe === p.id);
                        if (bt) {
                            p.soLuongTon = bt.soLuongTon;
                            if (sp.tenSp && (!p.tenItem || !p.tenItem.includes(sp.tenSp))) {
                                p.tenItem = `${sp.tenSp} - ${bt.tenBienThe || p.tenItem}`;
                            }
                            if (!p.hinhAnh || p.hinhAnh.includes('no-image')) {
                                p.hinhAnh = bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien;
                            }
                            if (p.soLuongTon !== undefined && p.soLuong > p.soLuongTon) {
                                p.soLuong = p.soLuongTon;
                            }
                            break;
                        }
                    }
                });
            }
        } catch (e) {
            // Im lặng bỏ qua lỗi polling ngầm
        }
    };

    await syncStock();
    stockPollingTimer = setInterval(syncStock, 15000);
});

onUnmounted(() => {
    if (stockPollingTimer) clearInterval(stockPollingTimer);
    window.removeEventListener('user-updated', checkAndSyncCustomerSession);
    window.removeEventListener('storage', checkAndSyncCustomerSession);
    window.removeEventListener('focus', checkAndSyncCustomerSession);
    document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<template>
    <div class="booking-container">
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="text-center mb-12" data-aos="fade-down">
                <h1 class="font-heading tracking-[0.2em] font-medium text-black text-3xl lg:text-4xl uppercase">THANH TOÁN TỔNG HỢP</h1>
                <p class="text-gray-400 mt-2 text-xs uppercase tracking-widest">Đặt lịch hẹn dịch vụ và mua sắm sản phẩm cao cấp cùng lúc</p>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Cột trái: Thông tin biểu mẫu -->
                <div class="lg:col-span-7 space-y-6" data-aos="fade-right">
                    <div class="glass-card left-main-card">
                        <!-- BANNER HẾT HẠN PHIÊN ĐĂNG NHẬP -->
                        <div v-if="isSessionExpired" class="mb-5 p-4 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/60 shadow-sm transition-all duration-300">
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-start gap-3.5">
                                    <div class="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 text-amber-700 mt-0.5">
                                        <i class="fas fa-exclamation-circle text-base"></i>
                                    </div>
                                    <div>
                                        <div class="text-[11px] uppercase tracking-wider font-bold text-amber-950 flex items-center gap-2">
                                            Phiên đăng nhập đã hết hạn
                                            <span class="px-2 py-0.5 text-[9px] font-semibold bg-amber-200/80 text-amber-900 rounded-full">Cần đăng nhập lại</span>
                                        </div>
                                        <p class="text-xs text-amber-800/90 font-normal mt-1 leading-relaxed">
                                            Đăng nhập lại để tự động điền thông tin, tiếp tục tích điểm và nhận ưu đãi thành viên. Hoặc bạn có thể tự điền thông tin bên dưới để tiếp tục với tư cách khách.
                                        </p>
                                        <div class="mt-3 flex flex-wrap items-center gap-3">
                                            <router-link :to="{ name: 'login', query: { redirect: '/thanh-toan-tong' } }" class="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                                                <i class="fas fa-sign-in-alt text-[9px]"></i> Đăng Nhập Lại
                                            </router-link>
                                            <button type="button" @click="isSessionExpired = false" class="text-xs text-amber-900/80 hover:text-black font-medium underline underline-offset-4 transition-colors">
                                                Tiếp tục với tư cách khách
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <button type="button" @click="isSessionExpired = false" class="text-amber-400 hover:text-amber-800 text-sm p-1 transition-colors" title="Đóng thông báo">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>

                        <!-- GỢI Ý ĐĂNG NHẬP TÍCH ĐIỂM CHO KHÁCH -->
                        <div v-else-if="customerId === 'GUEST' || !customerId" class="mb-5 p-4 rounded-xl border border-gray-200/80 bg-gradient-to-r from-zinc-50 via-white to-gray-50/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-300">
                            <div class="flex items-center gap-3.5">
                                <div class="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0 text-black">
                                    <i class="fas fa-crown text-amber-500 text-sm"></i>
                                </div>
                                <div>
                                    <div class="text-[11px] uppercase tracking-wider font-bold text-gray-900 flex items-center gap-2">
                                        Ưu đãi thành viên LGHair
                                        <span class="px-2 py-0.5 text-[9px] font-semibold bg-amber-100 text-amber-800 rounded-full">Tích điểm</span>
                                    </div>
                                    <p class="text-xs text-gray-500 font-light mt-0.5 leading-normal">
                                        Đăng nhập để tự động điền thông tin, áp dụng voucher và tích điểm thành viên.
                                    </p>
                                </div>
                            </div>
                            <router-link :to="{ name: 'login', query: { redirect: '/thanh-toan-tong' } }" class="self-start sm:self-center flex-shrink-0 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                                Đăng Nhập
                            </router-link>
                        </div>
                        
                        <!-- BƯỚC 1: Thông tin khách hàng -->
                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                <i class="fas fa-user-edit me-2 text-black"></i> THÔNG TIN KHÁCH HÀNG
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Họ và tên *</label>
                                <input v-model="bookingData.customerName" 
                                    @input="validateField('customerName')" 
                                    @blur="validateField('customerName')"
                                    :class="{ 'input-error': errors.customerName }"
                                    type="text" class="booking-input w-full" placeholder="Tên khách hàng">
                                <p v-if="errors.customerName" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.customerName }}</p>
                            </div>
                            <div>
                                <label class="custom-label font-bold">Số điện thoại *</label>
                                <input v-model="bookingData.phone" 
                                    @input="validateField('phone')" 
                                    @blur="validateField('phone')"
                                    :class="{ 'input-error': errors.phone }"
                                    type="tel" class="booking-input w-full" placeholder="090x xxx xxx">
                                <p v-if="errors.phone" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.phone }}</p>
                            </div>
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Email nhận thông báo *</label>
                                <input v-model="bookingData.email" 
                                    @input="validateField('email')" 
                                    @blur="validateField('email')"
                                    :class="{ 'input-error': errors.email }"
                                    type="email" class="booking-input w-full" placeholder="vidu@gmail.com">
                                <p v-if="errors.email" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.email }}</p>
                            </div>
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Ghi chú chung</label>
                                <textarea v-model="bookingData.note" class="booking-input w-full pt-2" style="height: 80px;" placeholder="Ghi chú yêu cầu đặt lịch hoặc giao hàng..."></textarea>
                            </div>
                        </div>

                        <!-- BƯỚC 2: Chọn Ngày, Giờ & Stylist cho Dịch vụ -->
                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                <i class="fas fa-calendar-check me-2 text-black"></i> ĐẶT LỊCH HẸN DỊCH VỤ
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        
                        <div v-if="bookingData.selectedServices.length === 0" class="soft-message mt-3">
                            <i class="fas fa-info-circle text-gray-500 mt-1"></i>
                            <div>
                                <span class="font-bold">Chưa có dịch vụ nào được chọn.</span> Bạn có thể tìm và thêm dịch vụ ở cột bên phải nếu có nhu cầu làm tóc.
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Ngày hẹn</label>
                                <input v-model="tempDate" 
                                    @change="combineDateTime"
                                    :class="{ 'input-error': errors.bookingDate }"
                                    type="date" class="booking-input w-full" :min="minDate">
                                <p v-if="errors.bookingDate" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.bookingDate }}</p>
                            </div>
                            <div>
                                <label class="custom-label font-bold">Giờ hẹn</label>
                                <select v-model="tempTime" 
                                    @change="combineDateTime"
                                    :class="{ 'input-error': errors.tempTime }"
                                    class="booking-input">
                                    <option value="">Chọn giờ hẹn</option>
                                    <option v-for="hour in availableHours" :key="hour" :value="hour">{{ hour }}</option>
                                </select>
                                <p v-if="errors.tempTime" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.tempTime }}</p>
                                <div class="summary-line" v-if="tempTime">
                                    <span class="font-bold">Giờ bắt đầu:</span>
                                    <span class="font-bold text-black">{{ tempTime }}</span>
                                </div>
                                <div class="summary-line" v-if="expectedEndTime">
                                    <span class="font-bold">Dự kiến xong lúc:</span>
                                    <span class="text-black font-bold" style="font-size: 1.05rem;">{{ expectedEndTime }}</span>
                                </div>
                                <div class="summary-line text-black" v-if="estimatedTotalMinutes > 0">
                                    <span class="font-bold">Tổng thời gian làm:</span>
                                    <span>{{ estimatedTotalMinutes }} phút</span>
                                </div>
                            </div>
                        </div>

                        <!-- Chọn Stylist -->
                        <div class="mt-8" v-if="bookingData.selectedServices.length > 0">
                            <div class="section-heading-wrapper mt-4 mb-3">
                                <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                    <i class="fas fa-cut me-2 text-black"></i> CHỌN STYLIST
                                </h3>
                                <div class="heading-line"></div>
                            </div>
                            <p v-if="errors.stylist" class="error-msg-custom stylist-error-banner mb-3"><i class="fas fa-exclamation-triangle me-1.5"></i>{{ errors.stylist }}</p>
                            
                            <div v-if="loadingStylists" class="mt-4 p-3 text-center text-gray-500 font-bold bg-gray-50 border border-gray-200">
                                <i class="fas fa-spinner fa-spin me-2 text-black"></i> Đang tìm stylist phù hợp...
                            </div>
                            
                            <div v-else class="stylist-flex mt-3">
                                <div v-for="stylist in stylists" :key="stylist.id" class="stylist-card" :class="{
                                    'active': String(bookingData.stylistId) === String(stylist.id),
                                    'is-disabled': !stylist.isAvailable
                                }" @click="stylist.isAvailable ? (bookingData.stylistId = stylist.id, validateField('stylist')) : null"
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
                                        <img :src="getImageUrl(stylist.img)" alt="Stylist" onerror="this.onerror=null; this.src='/images/no-image.png'">
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
                                            <span class="font-bold mt-1 text-center text-red-500 text-xs">
                                                {{ stylist.unAvailableReason }}
                                            </span>
                                        </template>
                                    </div>
                                </div>

                                <div v-if="stylists.length === 0" class="w-full p-4 text-center text-red-500 border border-red-200 bg-red-50">
                                    {{ stylistMessage || 'Không có stylist khả dụng. Vui lòng chọn ngày hoặc giờ khác!' }}
                                </div>
                            </div>
                        </div>

                        <!-- BƯỚC 3: Nhận sản phẩm (Nếu giỏ hàng có sản phẩm) -->
                        <div v-if="productItems.length > 0" class="mt-10">
                            <div class="section-heading-wrapper">
                                <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                    <i class="fas fa-shipping-fast me-2 text-black"></i> HÌNH THỨC NHẬN SẢN PHẨM
                                </h3>
                                <div class="heading-line"></div>
                            </div>
                            
                            <div class="receive-tabs mt-4">
                                <button type="button" :class="{ active: productData.receiveType === 'store' }" @click="productData.receiveType = 'store'">
                                    <i class="fas fa-store"></i> Nhận trực tiếp tại tiệm
                                </button>
                                <button type="button" :class="{ active: productData.receiveType === 'home' }" @click="productData.receiveType = 'home'">
                                    <i class="fas fa-house"></i> Giao hàng tận nơi
                                </button>
                            </div>
                            
                            <div v-if="productData.receiveType === 'store'" class="store-box mt-4 flex items-start gap-3">
                                <i class="fas fa-check-circle text-xl mt-1 text-black"></i>
                                <div>
                                    <h4 class="font-bold text-black mb-1">Nhận sản phẩm tại tiệm khi đến làm dịch vụ</h4>
                                    <p class="text-sm text-gray-600">Sản phẩm sẽ được chuẩn bị sẵn tại tiệm khi bạn đến làm dịch vụ. Không tính phí vận chuyển.</p>
                                </div>
                            </div>
                            
                            <div v-else class="delivery-box mt-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="custom-label font-bold">Họ tên người nhận *</label>
                                        <input v-model="productData.receiverName" 
                                            @input="validateField('receiverName')" 
                                            @blur="validateField('receiverName')"
                                            :class="{ 'input-error': errors.receiverName }"
                                            type="text" class="booking-input w-full" placeholder="Họ tên người nhận">
                                        <p v-if="errors.receiverName" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.receiverName }}</p>
                                    </div>
                                    <div>
                                        <label class="custom-label font-bold">Số điện thoại *</label>
                                        <input v-model="productData.receiverPhone" 
                                            @input="validateField('receiverPhone')" 
                                            @blur="validateField('receiverPhone')"
                                            :class="{ 'input-error': errors.receiverPhone }"
                                            type="tel" class="booking-input w-full" placeholder="090x xxx xxx">
                                        <p v-if="errors.receiverPhone" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.receiverPhone }}</p>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="custom-label font-bold">Email người nhận *</label>
                                        <input v-model="productData.receiverEmail" 
                                            @input="validateField('receiverEmail')" 
                                            @blur="validateField('receiverEmail')"
                                            :class="{ 'input-error': errors.receiverEmail }"
                                            type="email" class="booking-input w-full" placeholder="email@example.com">
                                        <p v-if="errors.receiverEmail" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.receiverEmail }}</p>
                                    </div>
                                    <div class="md:col-span-2">
                                        <label class="custom-label font-bold text-danger">Địa chỉ giao hàng chi tiết *</label>
                                        <textarea v-model="productData.address" 
                                            @input="validateField('address')" 
                                            @blur="validateField('address')"
                                            :class="{ 'input-error': errors.address }"
                                            class="booking-input w-full pt-2" style="height: 80px;" placeholder="Nhập số nhà, tên đường... Bản đồ sẽ tự động ước tính phí ship."></textarea>
                                        <p v-if="errors.address" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.address }}</p>
                                    </div>
                                    
                                    <div class="md:col-span-2" v-if="productData.address">
                                        <div class="shipping-info-card mt-2 p-3 shadow-sm rounded border border-gray-200 bg-gray-50">
                                            <h6 class="font-bold text-gray-900 mb-3"><i class="fas fa-truck me-2"></i> THÔNG TIN GIAO HÀNG (ƯỚC TÍNH)</h6>
                                            
                                            <div class="flex mb-2 items-start">
                                                <div class="me-3 text-success"><i class="fas fa-store-alt mt-1"></i></div>
                                                <div>
                                                    <div class="font-bold text-xs" style="font-size: 13px;">Địa chỉ Kho hàng:</div>
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

                        <!-- HÓA ĐƠN DOANH NGHIỆP -->
                        <div class="invoice-toggle-line mt-6" @click="showInvoiceCompanyForm = !showInvoiceCompanyForm">
                            <span class="font-bold text-black" style="font-size: 14px;">
                                <i class="fas fa-building me-2"></i> Cần hóa đơn công ty (có MST)?
                            </span>
                            <i class="fas fa-chevron-down invoice-toggle-arrow" :class="{ open: showInvoiceCompanyForm }"></i>
                        </div>
                        <transition name="list-fade">
                            <div v-if="showInvoiceCompanyForm" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div>
                                    <label class="custom-label font-bold">Tên công ty *</label>
                                    <input v-model="invoiceCompany.tenCongTy" type="text" class="booking-input w-full" placeholder="Công ty TNHH ABC">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Mã số thuế *</label>
                                    <input v-model="invoiceCompany.mst" type="text" class="booking-input w-full" @blur="validateMst" placeholder="0301234567">
                                    <p v-if="mstError" class="text-danger small mt-1 mb-0 font-bold">{{ mstError }}</p>
                                </div>
                            </div>
                        </transition>

                        <!-- KHO VOUCHER -->
                        <div class="mt-8">
                            <div class="section-heading-wrapper">
                                <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                    <i class="fas fa-ticket-alt me-2 text-black"></i> KHO VOUCHER CỦA BẠN
                                </h3>
                                <div class="heading-line"></div>
                            </div>

                            <div v-if="myVouchers.length > 0" class="voucher-list-modern">
                                <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                    :class="{ active: bookingData.voucherIds.includes(v.id), disabled: isVoucherDisabled(v) }" @click="toggleVoucher(v.id)">
                                    
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
                            <div v-else class="text-gray-500 italic mt-3 text-sm font-bold">
                                Không có voucher nào khả dụng cho đơn hàng của bạn lúc này.
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cột phải: Sticky Bill Chi tiết Hóa đơn -->
                <div class="lg:col-span-5" data-aos="fade-left">
                    <div class="sticky-bill">
                        <div class="glass-card bill-card">
                            <div class="section-heading-wrapper justify-content-center text-center mb-4">
                                <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                    <i class="fas fa-file-invoice-dollar me-2 text-black"></i> CHI TIẾT ĐƠN HÀNG
                                </h3>
                                <div class="heading-line mx-auto" style="width: 80px;"></div>
                            </div>

                            <p v-if="errors.cart" class="error-msg-custom services-error-banner mb-3"><i class="fas fa-exclamation-triangle me-1.5"></i>{{ errors.cart }}</p>

                            <!-- 1. DỊCH VỤ ĐÃ CHỌN -->
                            <div class="mb-4">
                                <label class="custom-label font-bold mb-2">
                                    <i class="fas fa-cut me-1 text-black"></i> Dịch vụ đã chọn
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
                                                        <img :src="getImageUrl(service.hinhAnh)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                    </div>
                                                    <div class="item-details">
                                                        <span class="item-name-text font-bold" style="font-size: 13px;">{{ service.name }}</span>
                                                        <div class="flex items-center mt-1">
                                                            <span v-if="service.originalPrice && service.originalPrice > service.price" class="text-gray-400 me-2" style="text-decoration: line-through; font-size: 11px;">
                                                                {{ formatMoney(service.originalPrice) }}
                                                            </span>
                                                            <span class="item-price-text text-black font-bold">
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

                                <div class="selected-items-wrapper" v-if="bookingData.selectedServices.length > 0">
                                    <transition-group name="list-fade">
                                        <div v-for="s in bookingData.selectedServices" :key="s.id" class="item-row">
                                            <div class="flex items-center flex-grow">
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="getImageUrl(s.hinhAnh)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-info flex-grow">
                                                    <span class="n font-bold d-block text-truncate" style="max-width: 180px;">{{ s.name }}</span>
                                                    <div class="flex items-center mt-1">
                                                        <span v-if="s.originalPrice && s.originalPrice > s.price" class="text-gray-400 me-2" style="text-decoration: line-through; font-size: 11px;">
                                                            {{ formatMoney(s.originalPrice) }}
                                                        </span>
                                                        <span class="p text-black font-bold">{{ formatMoney(s.price) }}</span>
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
                                    <i class="fas fa-box-open me-1 text-black"></i> Sản phẩm mua kèm
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
                                                    :class="{ 'opacity-50': bt.soLuongTon <= 0 }"
                                                    @click="addProduct(sp, bt)">
                                                    <div class="flex items-center flex-grow min-w-0">
                                                        <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                            <img :src="getImageUrl(bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                        </div>
                                                        <div class="item-details flex-grow min-w-0 pr-2">
                                                            <!-- Dòng 1: Tên sản phẩm 1 dòng -->
                                                            <div class="item-name-text font-bold text-neutral-900 truncate leading-tight" style="font-size: 13px;">
                                                                {{ sp.tenSp }}
                                                            </div>
                                                            <!-- Dòng 2: Tên biến thể / phân loại -->
                                                            <div class="text-xs text-neutral-500 font-medium mt-0.5 truncate" style="font-size: 12px;">
                                                                <span class="text-neutral-400">Phân loại:</span> {{ bt.tenBienThe }}
                                                            </div>
                                                            <!-- Dòng 3: Giá thành 1 dòng riêng -->
                                                            <div class="flex items-center mt-1">
                                                                <span class="item-price-text text-black font-bold">{{ formatMoney(bt.giaBan) }}</span>
                                                                <span class="ms-2 text-neutral-500 font-medium" style="font-size: 11px;">(Kho: {{ bt.soLuongTon }})</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span v-if="bt.soLuongTon <= 0" class="badge bg-danger p-1 text-white" style="font-size: 10px;">Hết</span>
                                                    <i v-else class="fas fa-plus-circle add-btn-icon"></i>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="dropdown-close-footer" @click="showProductDropdown = false">ĐÓNG</div>
                                    </div>
                                </div>

                                <div class="selected-items-wrapper" v-if="productItems.length > 0">
                                    <transition-group name="list-fade">
                                        <div v-for="p in productItems" :key="p.id" class="item-row product-checkout-item">
                                            <!-- 1. Ảnh sản phẩm + Tên + Đơn giá + Kho -->
                                            <div class="flex items-center flex-grow min-w-0 pr-2">
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="getImageUrl(p.hinhAnh)" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-info flex-grow min-w-0 pr-2">
                                                    <!-- Dòng 1: Tên sản phẩm 1 dòng duy nhất -->
                                                    <div class="n font-bold text-neutral-900 leading-tight truncate" style="font-size: 12px; max-width: 140px;">
                                                        {{ p.tenSp || (p.tenItem && p.tenItem.includes(' - ') ? p.tenItem.split(' - ')[0] : p.tenItem) }}
                                                    </div>
                                                    <!-- Dòng 2: Tên biến thể / phân loại -->
                                                    <div class="text-xs text-neutral-500 font-medium mt-0.5 truncate" style="font-size: 11px; max-width: 140px;" v-if="p.tenBienThe || (p.tenItem && p.tenItem.includes(' - '))">
                                                        <span class="text-neutral-400">Phân loại:</span> {{ p.tenBienThe || p.tenItem.split(' - ').slice(1).join(' - ') }}
                                                    </div>
                                                    <!-- Dòng 3: Giá thành 1 dòng riêng -->
                                                    <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                                                        <span class="p text-black font-bold">{{ formatMoney(p.gia) }}</span>
                                                        <span v-if="p.soLuongTon !== undefined" class="text-[11px] text-gray-500 font-medium">
                                                            (Kho: <b :class="p.soLuongTon <= 5 ? 'text-red-600' : 'text-gray-700'">{{ p.soLuongTon }}</b>)
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <!-- 2. Bộ tăng giảm số lượng có thể nhập trực tiếp -->
                                            <div class="quantity-pill ms-auto me-2 flex-shrink-0">
                                                <button type="button" @click="decreaseQuantity(p)" class="qty-btn" :disabled="p.soLuong <= 1"><i class="fas fa-minus"></i></button>
                                                <input 
                                                    type="number" 
                                                    v-model.number="p.soLuong" 
                                                    min="1" 
                                                    :max="p.soLuongTon"
                                                    class="qty-input" 
                                                    @input="onQuantityInput(p)"
                                                    @change="validateQuantity(p)" 
                                                    @blur="validateQuantity(p)" 
                                                />
                                                <button type="button" @click="increaseQuantity(p)" class="qty-btn" :disabled="p.soLuongTon !== undefined && p.soLuong >= p.soLuongTon"><i class="fas fa-plus"></i></button>
                                            </div>
                                            
                                            <!-- 3. Nút xóa thùng rác bên phải -->
                                            <button class="del-btn flex-shrink-0" @click="removeProduct(p.id)" title="Xóa"><i class="fas fa-trash-alt"></i></button>
                                        </div>
                                    </transition-group>
                                </div>
                            </div>

                            <!-- 3. HÌNH THỨC THANH TOÁN (MỨC ĐẶT CỌC & PHƯƠNG THỨC THANH TOÁN) -->
                            <div class="pt-3 border-t border-gray-100">
                                <!-- Cọc dịch vụ -->
                                <div v-if="bookingData.selectedServices.length > 0" class="payment-block mb-4">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-wallet text-black me-1"></i> Mức thanh toán dịch vụ</label>
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
                                <div class="payment-block mb-4" v-if="bookingData.selectedServices.length > 0">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-credit-card text-black me-1"></i> Phương thức thanh toán Dịch vụ</label>
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
                                <div class="payment-block mb-4" v-if="productItems.length > 0 && productData.receiveType === 'home'">
                                    <label class="custom-label font-bold mb-2"><i class="fas fa-shipping-fast text-black me-1"></i> Phương thức thanh toán Sản phẩm</label>
                                    <div class="payment-method-row">
                                        <div class="method-option cod" :class="{ active: productData.paymentMethod === 'cod' }" @click="productData.paymentMethod = 'cod'">
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
                                    </div>
                                </div>
                            </div>

                            <!-- 4. CHI TIẾT TIỀN BẠC (TOTAL BOX) -->
                            <div class="total-box">
                                <div class="total-line" v-if="bookingData.selectedServices.length > 0">
                                    <span>Tạm tính dịch vụ</span>
                                    <b>{{ formatMoney(serviceSubTotal) }}</b>
                                </div>
                                <div class="total-line saving" v-if="bookingData.selectedServices.length > 0 && serviceOriginalTotal > serviceSubTotal">
                                    <span>Ưu đãi Flash Sale dịch vụ</span>
                                    <b>-{{ formatMoney(serviceOriginalTotal - serviceSubTotal) }}</b>
                                </div>
                                <div class="total-line" v-if="productItems.length > 0">
                                    <span>Tạm tính sản phẩm</span>
                                    <b>{{ formatMoney(productSubTotal) }}</b>
                                </div>
                                <div class="total-line" v-if="productItems.length > 0 && shippingFee > 0">
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
                                    <span>Tổng đơn hàng (đã gồm VAT)</span>
                                    <b>{{ formatMoney(grandTotal) }}</b>
                                </div>

                                <div class="pay-line">
                                    <span>Thanh toán ngay</span>
                                    <b>{{ formatMoney(payNow) }}</b>
                                </div>

                                <div class="total-line text-danger mt-2" v-if="remainAtStore > 0">
                                    <span>Còn lại thanh toán tại tiệm:</span>
                                    <b>{{ formatMoney(remainAtStore) }}</b>
                                </div>
                                <div class="total-line text-danger" v-if="remainCOD > 0">
                                    <span>Còn lại trả shipper (COD):</span>
                                    <b>{{ formatMoney(remainCOD) }}</b>
                                </div>
                            </div>

                            <!-- Nút Xác nhận Thanh toán CÓ HIỆU ỨNG LOADING (SỬ DỤNG SVG XOAY VÒNG BẤT TỬ) -->
                            <button type="button" class="btn-confirm-metallic-final mt-4" @click="handlePayment" 
                                    :disabled="isSubmitting || (bookingData.selectedServices.length > 0 && bookingData.stylistId !== null && (!selectedStylist || !selectedStylist.isAvailable))" 
                                    :class="{ 'opacity-50 pointer-events-none cursor-not-allowed': isSubmitting || (bookingData.selectedServices.length > 0 && bookingData.stylistId !== null && (!selectedStylist || !selectedStylist.isAvailable)) }">
                                <span v-if="!isSubmitting" class="btn-text-normal">THANH TOÁN NGAY</span>
                                <span v-else class="btn-text-normal flex items-center justify-center">
                                    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    ĐANG XỬ LÝ...
                                </span>
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

.font-heading, h1, h2, h3, h4, h5, h6, .section-heading-title {
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
    border-color: var(--primary-color);
    background: var(--primary-light);
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
    border-color: var(--primary-color);
}

.check-badge {
    position: absolute;
    bottom: -2px;
    right: -2px;
    background: var(--primary-color);
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

.favorite-heart-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    color: #ef4444;
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

.stylist-card.is-disabled {
    opacity: 0.45;
    filter: grayscale(100%);
    cursor: not-allowed;
    background: #f9fafb;
}

.stylist-card.is-disabled:hover {
    border-color: var(--border-color);
    transform: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
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

.voucher-ticket-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

/* Service / Product Search Box Dropdown */
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
    background: #fafafa;
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

/* Selected Items in Bill Card */
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
    color: var(--primary-color);
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

/* Pay button and tabs */
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
    border-color: var(--primary-color);
    background: var(--primary-light);
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
    border-color: var(--primary-color);
}

.pay-btn.active .dot::after {
    content: '';
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--primary-color);
    border-radius: 50%;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
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
    background: var(--primary-metallic);
    color: #ffffff;
    border-color: transparent;
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

/* Total / Summary Box */
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

.btn-confirm-metallic-final {
    width: 100%;
    padding: 16px;
    border: 1px solid var(--primary-color);
    border-radius: 0px;
    background: var(--primary-metallic);
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 2px;
    font-weight: 700;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-confirm-metallic-final:hover:not(:disabled) {
    background: transparent;
    color: var(--primary-color) !important;
    transform: translateY(-2px);
}

.btn-confirm-metallic-final:hover:not(:disabled) .btn-text-normal {
    color: var(--primary-color) !important;
}

.btn-confirm-metallic-final:disabled {
    cursor: not-allowed;
    opacity: 0.7;
}

.btn-text-normal {
    font-family: inherit !important;
    font-weight: 700 !important;
    font-size: 13px !important;
    color: #ffffff !important;
    letter-spacing: 2px !important;
    transition: color 0.3s ease;
}

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

/* Spinner Animation CSS để xoay mượt mà nếu thiếu class Tailwind animate-spin */
@keyframes custom-spin {
    to { transform: rotate(360deg); }
}
.animate-spin {
    animation: custom-spin 1s linear infinite;
}

@media (max-width: 991px) {
    .sticky-bill {
        position: static;
        margin-top: 24px;
    }
    
    .glass-card {
        padding: 24px;
    }
}

/* ==========================================
   STYLE VALIDATION BẮT LỖI TỰ ĐỘNG
   ========================================== */
.booking-input.input-error {
    border-color: #ef4444 !important;
    background-color: #fef2f2 !important;
    box-shadow: 0 0 0 1px #ef4444 !important;
}

.error-msg-custom {
    color: #ef4444 !important;
    font-size: 12px !important;
    font-weight: 600 !important;
    margin-top: 4px !important;
    margin-bottom: 0 !important;
    display: flex;
    align-items: center;
}

.services-error-banner,
.stylist-error-banner {
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    color: #b91c1c !important;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
}
</style>