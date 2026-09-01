<script setup lang="ts">
import { ref, computed, onMounted, watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import Swal from 'sweetalert2';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { KHO_ORIGIN, calculateShippingFee } from './shippingCalculator';
import { clearCartDB, removeFromCartDB } from '@/Views/Anonymous/CSDL/cartDB';
import { useAuthStore } from '@/stores/useAuthStore';

const router = useRouter();
const API = import.meta.env.VITE_API_URL;
const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

// ==========================================
// STATE DỮ LIỆU CƠ BẢN
// ==========================================
const getImageUrl = (path?: string) => {
    if (!path) return '/images/no-image.png';
    if (path.startsWith('http')) return path;
    const clean = path.startsWith('/') ? path : `/${path}`;
    return `${API}${clean}`;
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
// HÓA ĐƠN ĐIỆN TỬ
// Mặc định luôn xuất hóa đơn cá nhân, dùng Email + Địa chỉ đã nhập ở trên (không hỏi lại).
// Chỉ mở rộng khi khách cần hóa đơn công ty (có MST).
// ==========================================
const showInvoiceCompanyForm = ref(false);
const invoiceCompany = ref({ tenCongTy: '', mst: '' });
const mstError = ref('');

// BỘ LỖI VALIDATION TỰ ĐỘNG TOÀN FORM (GIỐNG ĐẶT DỊCH VỤ)
const errors = ref({
    customerName: '',
    phone: '',
    email: '',
    address: '',
    products: '',
    invoice: ''
});

const validateField = (field: string) => {
    switch (field) {
        case 'customerName': {
            const name = (orderData.value.customerName || '').trim();
            if (!name) {
                errors.value.customerName = 'Vui lòng nhập họ và tên người nhận.';
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
            const phone = (orderData.value.phone || '').trim();
            const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
            if (!phone) {
                errors.value.phone = 'Vui lòng nhập số điện thoại nhận hàng.';
            } else if (!phoneRegex.test(phone)) {
                errors.value.phone = 'Số điện thoại không hợp lệ (gồm 10 số, VD: 0912345678).';
            } else {
                errors.value.phone = '';
            }
            break;
        }
        case 'email': {
            const email = (orderData.value.email || '').trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email) {
                errors.value.email = 'Vui lòng nhập email nhận thông báo đơn hàng.';
            } else if (!emailRegex.test(email)) {
                errors.value.email = 'Email không hợp lệ (VD: example@gmail.com).';
            } else {
                errors.value.email = '';
            }
            break;
        }
        case 'address': {
            const addr = (orderData.value.address || '').trim();
            if (!addr) {
                errors.value.address = 'Vui lòng nhập địa chỉ giao hàng chi tiết.';
            } else if (addr.length < 6) {
                errors.value.address = 'Địa chỉ giao hàng quá ngắn (cần số nhà, tên đường, phường/xã, quận/huyện...).';
            } else {
                errors.value.address = '';
            }
            break;
        }
        case 'products': {
            if (!productItems.value || productItems.value.length === 0) {
                errors.value.products = 'Giỏ hàng của bạn đang trống! Vui lòng chọn ít nhất 1 sản phẩm.';
            } else {
                errors.value.products = '';
            }
            break;
        }
    }
};

const validateAllForm = (): boolean => {
    validateField('customerName');
    validateField('phone');
    validateField('email');
    validateField('address');
    validateField('products');

    const invoiceErr = validateInvoiceInfo();
    if (invoiceErr) {
        errors.value.invoice = invoiceErr;
    } else {
        errors.value.invoice = '';
    }

    return !Object.values(errors.value).some(err => !!err);
};

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

watch(() => productItems.value.length, () => {
    validateField('products');
});

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
let stockPollingTimer: any = null;

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
        if (existingProduct.soLuong >= bt.soLuongTon) {
            import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                    icon: 'warning',
                    title: 'Vượt quá số lượng',
                    text: `Chỉ còn ${bt.soLuongTon} sản phẩm trong kho!`,
                    confirmButtonColor: '#000'
                });
            });
            return;
        }
        existingProduct.soLuong++;
    } else {
        // Thêm mới nếu chưa có
        productItems.value.push({
            id: bt.maBienThe,
            tenSp: sp.tenSp,
            tenBienThe: bt.tenBienThe,
            tenItem: `${sp.tenSp} - ${bt.tenBienThe}`,
            gia: bt.giaBan,
            hinhAnh: bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien,
            soLuong: 1,
            soLuongTon: bt.soLuongTon
        });
    }

    // Đóng popup sau khi thêm
    searchQuery.value = '';
    showProductDropdown.value = false;
};

const removeProduct = (id: string | number) => {
    productItems.value = productItems.value.filter(p => p.id !== id);
};

const increaseQuantity = (item: any) => {
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

const decreaseQuantity = (item: any) => {
    if (item.soLuong > 1) item.soLuong--;
};

const onQuantityInput = (item: any) => {
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

const validateQuantity = (item: any) => {
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
    if (!v) return true;
    if (v.isAvailable === false) return true;
    if (v.giaTriToiThieu != null && Number(v.giaTriToiThieu) > 0 && subTotal.value < Number(v.giaTriToiThieu)) {
        return true;
    }
    if (v.minSpend != null && Number(v.minSpend) > 0 && subTotal.value < Number(v.minSpend)) {
        return true;
    }
    if (v.desc && v.desc.includes('Đơn tối thiểu')) {
        const match = v.desc.match(/Đơn tối thiểu ([\d,.]+)/i);
        if (match) {
            const minVal = parseInt(match[1].replace(/[,.]/g, ''));
            if (!isNaN(minVal) && subTotal.value < minVal) return true;
        }
    }
    return false;
};

const getDisabledReason = (v: any) => {
    if (!v) return 'Chưa đủ điều kiện';
    if (v.errorMessage) return v.errorMessage;
    if (v.giaTriToiThieu != null && Number(v.giaTriToiThieu) > 0) {
        return `Yêu cầu đơn tối thiểu ${Number(v.giaTriToiThieu).toLocaleString()}đ (hiện có: ${subTotal.value.toLocaleString()}đ)`;
    }
    if (v.minSpend != null && Number(v.minSpend) > 0) {
        return `Yêu cầu đơn tối thiểu ${Number(v.minSpend).toLocaleString()}đ (hiện có: ${subTotal.value.toLocaleString()}đ)`;
    }
    if (v.desc && v.desc.includes('Đơn tối thiểu')) {
        const match = v.desc.match(/Đơn tối thiểu ([\d,.]+)/i);
        if (match) {
            return `Yêu cầu đơn tối thiểu ${match[1]}đ (hiện có: ${subTotal.value.toLocaleString()}đ)`;
        }
    }
    return 'Chưa đạt giá trị đơn hàng tối thiểu';
};

watch([() => orderData.value.voucherIds.slice(), subTotal, shippingFee, () => productItems.value.length], () => {
    if (orderData.value.voucherIds.length > 0 && myVouchers.value.length > 0) {
        orderData.value.voucherIds = orderData.value.voucherIds.filter((id) => {
            const v = myVouchers.value.find((x: any) => x.id === id);
            return v && !isVoucherDisabled(v);
        });
    }
    refreshStackPreview();
}, { deep: true, immediate: true });

function toggleVoucher(id: string) {
    const v = myVouchers.value.find(x => x.id === id);
    if (v && isVoucherDisabled(v)) {
        const reason = getDisabledReason(v);
        Swal.fire({ 
            title: 'Chưa đủ điều kiện áp dụng', 
            text: reason, 
            icon: 'warning', 
            confirmButtonText: 'Đã hiểu', 
            confirmButtonColor: '#1e293b' 
        });
        return;
    }
    const ids = orderData.value.voucherIds;
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

const authStore = useAuthStore();
const isSessionExpired = computed({
    get: () => authStore.sessionExpiredBanner,
    set: (val: boolean) => authStore.setSessionExpiredBanner(val)
});
const isLoggedIn = ref(false);

const checkAndSyncCustomerSession = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (token || savedUser) {
        try {
            const res = await axios.get(`${API}/api/account/get-profile`, { withCredentials: true });
            if (res.data?.success && res.data?.user) {
                const u = res.data.user;
                localStorage.setItem('user', JSON.stringify(u));
                orderData.value.customerName = u.hoTen || '';
                orderData.value.email = u.email || '';
                orderData.value.phone = u.sdt || '';
                isLoggedIn.value = true;
                isSessionExpired.value = false;
            }
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('user');
                isLoggedIn.value = false;
                isSessionExpired.value = true;

                orderData.value.customerName = '';
                orderData.value.email = '';
                orderData.value.phone = '';
                orderData.value.address = '';
                orderData.value.voucherIds = [];

                window.dispatchEvent(new Event('user-updated'));
            }
        }
    } else {
        isLoggedIn.value = false;
        const customer = getCustomerInfo();
        if (customer.maKH === 'GUEST' || customer.hoTen === 'Khách vãng lai') {
            orderData.value.customerName = '';
            orderData.value.email = '';
            orderData.value.phone = '';
        } else {
            orderData.value.customerName = customer.hoTen || '';
            orderData.value.email = customer.email || '';
            orderData.value.phone = customer.sdt || '';
        }
    }
};

const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        checkAndSyncCustomerSession();
    }
};

// ==========================================
onMounted(async () => {
    // 0. Xác thực phiên và tự động nạp thông tin người dùng mới nhất
    await checkAndSyncCustomerSession();

    // Đăng ký các sự kiện phản ứng nhanh
    window.addEventListener('user-updated', checkAndSyncCustomerSession);
    window.addEventListener('storage', checkAndSyncCustomerSession);
    window.addEventListener('focus', checkAndSyncCustomerSession);
    document.addEventListener('visibilitychange', onVisibilityChange);

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
      
    // 4. Đồng bộ số lượng tồn kho tức thì và Polling 15s
    const syncStock = async () => {
        try {
            const res = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
                params: { keyword: '' }
            });
            if (res.data && res.data.success) {
                const allFreshProducts = res.data.data;
                productItems.value.forEach(p => {
                    for (const sp of allFreshProducts) {
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
            // Im lặng bỏ qua
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

// ==========================================
// XỬ LÝ THANH TOÁN
// ==========================================
const handleCheckout = async () => {
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
                    await removeFromCartDB(item.id, 'SANPHAM');
                }
            } catch(e) {
                console.error("Lỗi xóa db giỏ hàng", e);
            }
            
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
            const result = await Swal.fire({
                title: 'Sản phẩm đã hết hàng!',
                text: `${errData.message || 'Sản phẩm trong giỏ hàng hiện đã hết hàng.'}\n\nBạn có muốn quay lại trang sản phẩm để tiếp tục mua sắm không?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#000',
                cancelButtonColor: '#6b7280',
                confirmButtonText: 'Quay lại mua sắm',
                cancelButtonText: 'Hủy'
            });

            if (result.isConfirmed) {
                router.push({ name: 'shop' });
            }
            // Nếu bấm "Hủy" (hoặc đóng dialog) -> ở lại trang thanh toán hiện tại
            return;
        }

        Swal.fire({ title: 'Lỗi', text: errData?.message || "Có lỗi xảy ra khi lưu đơn hàng! Vui lòng thử lại.", icon: 'error', confirmButtonColor: '#d4af37' });
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
                                            Đăng nhập lại để tự động điền địa chỉ giao hàng, tích điểm đơn hàng và áp dụng mã giảm giá thành viên. Bạn vẫn có thể mua sắm tiếp tục với tư cách khách.
                                        </p>
                                        <div class="mt-3 flex flex-wrap items-center gap-3">
                                            <router-link :to="{ name: 'login', query: { redirect: '/thanh-toan-san-pham' } }" class="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
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
                        <div v-else-if="!isLoggedIn" class="mb-5 p-4 rounded-xl border border-gray-200/80 bg-gradient-to-r from-zinc-50 via-white to-gray-50/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-300">
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
                                        Đăng nhập để tự động điền địa chỉ giao hàng, áp dụng voucher và tích điểm thành viên khi mua hàng.
                                    </p>
                                </div>
                            </div>
                            <router-link :to="{ name: 'login', query: { redirect: '/thanh-toan-san-pham' } }" class="self-start sm:self-center flex-shrink-0 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                                Đăng Nhập
                            </router-link>
                        </div>

                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-heading section-heading-title font-bold text-black text-sm uppercase tracking-wider">
                                <i class="fas fa-shipping-fast me-2 text-black"></i> THÔNG TIN NGƯỜI NHẬN
                            </h3>
                            <div class="heading-line"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="custom-label font-bold">Họ và tên *</label>
                                <input v-model="orderData.customerName" 
                                    @input="validateField('customerName')" 
                                    @blur="validateField('customerName')"
                                    :class="{ 'input-error': errors.customerName }"
                                    type="text" class="booking-input w-full"
                                    placeholder="Tên người nhận">
                                <p v-if="errors.customerName" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.customerName }}</p>
                            </div>

                            <div>
                                <label class="custom-label font-bold">Số điện thoại *</label>
                                <input v-model="orderData.phone" 
                                    @input="validateField('phone')" 
                                    @blur="validateField('phone')"
                                    :class="{ 'input-error': errors.phone }"
                                    type="tel" class="booking-input w-full"
                                    placeholder="090x xxx xxx">
                                <p v-if="errors.phone" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.phone }}</p>
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Email nhận thông báo *</label>
                                <input v-model="orderData.email" 
                                    @input="validateField('email')" 
                                    @blur="validateField('email')"
                                    :class="{ 'input-error': errors.email }"
                                    type="email" class="booking-input w-full"
                                    placeholder="vidu@gmail.com">
                                <p v-if="errors.email" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.email }}</p>
                            </div>
                            
                            <div class="md:col-span-2">
                                <label class="custom-label font-bold text-danger">Địa chỉ giao hàng chi tiết *</label>
                                <textarea v-model="orderData.address" 
                                    @input="validateField('address')" 
                                    @blur="validateField('address')"
                                    :class="{ 'input-error': errors.address }"
                                    class="booking-input w-full pt-2" style="height: 80px;"
                                    placeholder="Nhập số nhà, tên đường, phường/xã, quận/huyện..."></textarea>
                                <p v-if="errors.address" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.address }}</p>
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
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <span class="v-code-badge">{{ v.code }}</span>
                                                <span v-if="isVoucherDisabled(v)" class="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded">
                                                    Chưa đủ điều kiện
                                                </span>
                                            </div>
                                            <span class="v-expiry-tag"><i class="far fa-calendar-alt me-1.5"></i>HSD: {{ v.expiry }}</span>
                                        </div>
                                        <div class="v-price-gold font-bold">Giảm: {{ v.discount.toLocaleString() }}đ</div>
                                        <div class="v-desc text-black mt-1" v-if="v.desc">{{ v.desc }}</div>
                                        <div v-if="isVoucherDisabled(v)" class="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1.5 bg-red-50 px-2.5 py-1.5 rounded border border-red-200">
                                            <i class="fas fa-exclamation-circle text-[12px] text-red-500 shrink-0"></i>
                                            <span>{{ getDisabledReason(v) }}</span>
                                        </div>
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

                            <p v-if="errors.products" class="error-msg-custom services-error-banner mb-3"><i class="fas fa-exclamation-triangle me-1.5"></i>{{ errors.products }}</p>

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
                                            <div class="dropdown-header font-bold py-1 px-3 bg-gray-100 text-gray-700 text-xs">{{ sp.tenSp }}</div>

                                            <div v-for="bt in sp.bienthes" :key="bt.maBienThe"
                                                class="service-dropdown-item"
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
                                                        <div class="d-flex align-items-center mt-1">
                                                            <span class="item-price-text text-black font-bold">{{ formatMoney(bt.giaBan) }}</span>
                                                            <span class="ms-2 text-neutral-500 font-medium" style="font-size: 11px;">(Kho: {{ bt.soLuongTon }})</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <span v-if="bt.soLuongTon <= 0" class="badge bg-danger p-1 text-white"
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

.booking-input.input-error {
    border-color: #f43f5e !important;
    background-color: #fff1f2 !important;
}

.booking-input.input-error:focus {
    border-color: #e11d48 !important;
    box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15) !important;
}

.error-msg-custom {
    color: #e11d48;
    font-size: 11.5px;
    font-weight: 600;
    margin-top: 4px;
    margin-bottom: 0;
    display: flex;
    align-items: center;
    line-height: 1.35;
    animation: errorFadeIn 0.2s ease-in-out;
}

.services-error-banner {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    padding: 10px 14px;
    border-radius: 4px;
    font-size: 12px;
}

@keyframes errorFadeIn {
    from { opacity: 0; transform: translateY(-3px); }
    to { opacity: 1; transform: translateY(0); }
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

.voucher-ticket-item.disabled {
    filter: grayscale(100%);
    opacity: 0.5;
    cursor: not-allowed !important;
    background: #f8f9fa;
    border: 1px dashed #d1d5db;
}
.voucher-ticket-item.disabled:hover {
    transform: none;
    border-color: #d1d5db;
    box-shadow: none;
}
.voucher-ticket-item.disabled .v-price-gold {
    color: #4b5563 !important;
}
.voucher-ticket-item.disabled .ticket-left {
    background: #6b7280 !important;
}
.voucher-ticket-item.disabled .ticket-brand-text {
    color: #e5e7eb !important;
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