<script setup lang="ts">
import { getCartDB, removeFromCartDB, addToCartDB, clearCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';

declare const AOS: any;

const API = import.meta.env.VITE_API_URL;
const allItemsFromApi = ref<any[]>([]);
const stylists = ref<any[]>([]); 
const isSearchingStylist = ref(false);
const myVouchers = ref<any[]>([]); // Đổi thành ref trống
const customer = getCustomerInfo();
const customerId = ref(customer.maKH || 'GUEST');
const tempDate = ref(new Date().toLocaleDateString('en-CA'));
const tempTime = ref('');

// Cờ chặn spam click khi đang xử lý
const isSubmitting = ref(false);

const favoriteStylistIds = ref<string[]>([]);

const isStylistFavorite = (stylistId: string) => {
    if (!stylistId) return false;
    const cleanId = stylistId.trim().toLowerCase();
    return favoriteStylistIds.value.some(favId => favId.trim().toLowerCase() === cleanId);
};

const estimatedTotalMinutes = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
});

const bookingData = ref({
    customerName: customer.maKH !== 'GUEST' && customer.hoTen !== 'Khách vãng lai' ? customer.hoTen : '',
    phone: customer.sdt || '',
    email: customer.email || '',
    bookingDate: '',
    stylistId: null as string | null,
    selectedServices: [] as Array<{ id: any, name: string, price: number, originalPrice: number, icon: string, duration: number, hinhAnh?: string }>,
    voucherIds: [] as string[],
    paymentMode: '10',
    paymentMethod: 'vnpay',
    note: ''
});

const showInvoiceCompanyForm = ref(false);
const invoiceCompany = ref({ tenCongTy: '', mst: '' });
const mstError = ref('');

// BỘ LỖI VALIDATION ĐỒNG BỘ TOÀN FORM
const errors = ref({
    customerName: '',
    phone: '',
    email: '',
    bookingDate: '',
    tempTime: '',
    services: '',
    stylist: '',
    invoice: ''
});

const validateField = (field: string) => {
    switch (field) {
        case 'customerName': {
            const name = (bookingData.value.customerName || '').trim();
            if (!name) {
                errors.value.customerName = 'Vui lòng nhập họ và tên của bạn.';
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
                errors.value.phone = 'Vui lòng nhập số điện thoại liên hệ.';
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
                errors.value.email = 'Vui lòng nhập email nhận mã QR đặt lịch.';
            } else if (!emailRegex.test(email)) {
                errors.value.email = 'Email không hợp lệ (VD: example@gmail.com).';
            } else {
                errors.value.email = '';
            }
            break;
        }
        case 'bookingDate': {
            if (!tempDate.value) {
                errors.value.bookingDate = 'Vui lòng chọn ngày hẹn.';
            } else {
                const todayStr = new Date().toLocaleDateString('en-CA');
                if (tempDate.value < todayStr) {
                    errors.value.bookingDate = 'Ngày hẹn không được ở quá khứ.';
                } else {
                    errors.value.bookingDate = '';
                }
            }
            break;
        }
        case 'tempTime': {
            if (!tempTime.value) {
                errors.value.tempTime = 'Vui lòng chọn khung giờ hẹn.';
            } else {
                const todayStr = new Date().toLocaleDateString('en-CA');
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
            break;
        }
        case 'services': {
            if (!bookingData.value.selectedServices || bookingData.value.selectedServices.length === 0) {
                errors.value.services = 'Vui lòng chọn ít nhất 1 dịch vụ để tiếp tục.';
            } else {
                errors.value.services = '';
            }
            break;
        }
        case 'stylist': {
            if (!bookingData.value.stylistId) {
                errors.value.stylist = 'Vui lòng chọn 1 Stylist phục vụ.';
            } else {
                errors.value.stylist = '';
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
    validateField('services');
    validateField('stylist');

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
        xuatHoaDon: showInvoiceCompanyForm.value,
        laDoanhNghiep: showInvoiceCompanyForm.value,
        tenCongTy: showInvoiceCompanyForm.value ? invoiceCompany.value.tenCongTy : null,
        mst: showInvoiceCompanyForm.value ? invoiceCompany.value.mst : null,
        diaChiXuatHD: null, 
        emailNhanHD: bookingData.value.email || null
    };
}

const loadVouchers = async () => {
    if (!customerId.value || customerId.value === 'GUEST') return;
    try {
        const serviceIds = bookingData.value.selectedServices.map((s) => s.id).join(',');
        const res = await axios.get(`${API}/api/DatDichVu/get-my-vouchers/${customerId.value}`, {
            params: {
                subTotal: subTotal.value,
                ngayGioHen: bookingData.value.bookingDate || undefined,
                serviceIds: serviceIds || undefined
            }
        });
        myVouchers.value = res.data;

        bookingData.value.voucherIds = bookingData.value.voucherIds.filter((id) => {
            const v = myVouchers.value.find((x: any) => x.id === id);
            return v && !isVoucherDisabled(v);
        });
    } catch (error) {
        console.error("Lỗi load voucher:", error);
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
        console.error("Lỗi khi load thợ yêu thích từ DB:", error);
    }
};

const checkAndSyncCustomerSession = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (token || savedUser) {
        try {
            // Xác thực phiên và lấy thông tin tài khoản mới nhất
            const res = await axios.get(`${API}/api/account/get-profile`, { withCredentials: true });
            if (res.data?.success && res.data?.user) {
                const u = res.data.user;
                localStorage.setItem('user', JSON.stringify(u));
                customerId.value = u.maKH || 'GUEST';
                bookingData.value.customerName = u.hoTen || '';
                bookingData.value.email = u.email || '';
                bookingData.value.phone = u.sdt || '';
                isSessionExpired.value = false;
                await loadFavoriteEmployees(customerId.value);
            }
        } catch (err: any) {
            console.warn('Lỗi xác thực phiên tại trang đặt lịch:', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                customerId.value = 'GUEST';
                isSessionExpired.value = true;

                // Xóa sạch nội dung textbox khi phiên hết hạn
                bookingData.value.customerName = '';
                bookingData.value.email = '';
                bookingData.value.phone = '';
                bookingData.value.voucherIds = [];
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
            isSessionExpired.value = false;
            await loadFavoriteEmployees(customerId.value);
        } else {
            // Khách vãng lai / đã đăng xuất -> luôn làm sạch dữ liệu trong textbox
            customerId.value = 'GUEST';
            bookingData.value.customerName = '';
            bookingData.value.email = '';
            bookingData.value.phone = '';
            bookingData.value.voucherIds = [];
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
    // 1. Tự động kiểm tra phiên và điền thông tin khách hàng
    await checkAndSyncCustomerSession();

    // 2. Lắng nghe các sự kiện đăng xuất / thay đổi phiên từ tab khác hoặc khi quay lại trang
    window.addEventListener('user-updated', checkAndSyncCustomerSession);
    window.addEventListener('storage', checkAndSyncCustomerSession);
    window.addEventListener('focus', checkAndSyncCustomerSession);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // 3. Fetch Dịch vụ, Combo & Stylist theo ca làm việc
    try {
        const resBooking = await axios.get(`${API}/api/DatDichVu/data-booking`);
        allItemsFromApi.value = [...(resBooking.data?.services || []), ...(resBooking.data?.combos || [])];
        
        if (!tempDate.value) {
            tempDate.value = new Date().toLocaleDateString('en-CA');
            combineDateTime();
        }
        await loadAvailableStylists();

        // Khôi phục thợ đã chọn từ query param nếu có
        const queryStylistId = new URLSearchParams(window.location.search).get('stylistId');
        if (queryStylistId && stylists.value.some(s => s.id === queryStylistId)) {
            bookingData.value.stylistId = queryStylistId;
        }
    } catch (error) {
        console.error("Lỗi khi load dữ liệu:", error);
    }

    // Khôi phục Dịch vụ từ CheckoutData / Pinia / IndexedDB
    const checkoutRaw = localStorage.getItem("checkoutData");

    if (checkoutRaw) {
        try {
            const checkoutData = JSON.parse(checkoutRaw);
            bookingData.value.selectedServices = (checkoutData.dichVuItems || []).map((item: any) => ({
                id: item.id,
                name: item.tenItem,
                price: Number(item.gia || 0),
                originalPrice: Number(item.giaGoc || item.gia || 0),
                icon: 'fas fa-check-circle',
                duration: Number(item.duration || 30),
                hinhAnh: item.hinhAnh
            }));
        } catch (e) {
            console.error(e);
        }
        localStorage.removeItem("checkoutData");
    } else {
        const bookingStore = useBookingBasketStore();
        if (bookingStore.items && bookingStore.items.length > 0) {
            bookingData.value.selectedServices = bookingStore.items.map((item: any) => ({
                id: item.id,
                name: item.tenItem,
                price: Number(item.gia || 0),
                originalPrice: Number(item.giaGoc || item.gia || 0),
                icon: 'fas fa-check-circle',
                duration: Number(item.duration || 30),
                hinhAnh: item.hinhAnh
            }));
        } else {
            const cartData = await getCartDB(customerId.value);

            if (cartData && cartData.length > 0) {
                bookingData.value.selectedServices = cartData
                    .filter((item: any) => item.type !== "SANPHAM" && !String(item.id).startsWith("SANPHAM_"))
                    .map((item: any) => ({
                        id: item.id,
                        name: item.tenItem,
                        price: Number(item.gia || 0),
                        originalPrice: Number(item.giaGoc || item.gia || 0),
                        icon: 'fas fa-check-circle',
                        duration: Number(item.duration || 30),
                        hinhAnh: item.hinhAnh
                    }));
            } else {
                bookingData.value.selectedServices = [];
            }
        }
    }

    await loadVouchers();
});

const searchQuery = ref('');
const showServiceDropdown = ref(false);

const filteredServices = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();
    let list = allItemsFromApi.value;
    if (query) {
        list = list.filter(s => s.name.toLowerCase().includes(query));
    }
    return list.filter(item => !bookingData.value.selectedServices.find(selected => selected.id === item.id));
});

const addService = async (service: any) => {
    if (bookingData.value.selectedServices.find(s => s.id === service.id)) {
        showServiceDropdown.value = false;
        return;
    }

    const itemToAdd = {
        id: service.id,
        name: service.name,
        price: service.price,
        originalPrice: service.originalPrice || service.price,
        icon: service.icon || 'fas fa-check-circle',
        duration: service.duration || 30,
        hinhAnh: service.hinhAnh
    };

    bookingData.value.selectedServices.push(itemToAdd);

    try {
        const itemType = service.type || (service.isCombo || String(service.id).startsWith('CB') ? 'COMBO' : 'DICHVU');
        await addToCartDB(
            {
                id: service.id,
                tenItem: service.name,
                gia: service.price,
                type: itemType,
                duration: service.duration || 30,
                hinhAnh: service.hinhAnh || service.icon 
            },
            customerId.value || 'GUEST'
        );
    } catch (error) {
        console.error("Lỗi khi lưu vào giỏ hàng:", error);
    }

    const bookingStore = useBookingBasketStore();
    bookingStore.addItem({
        id: service.id,
        tenItem: service.name,
        gia: service.price,
        giaGoc: service.originalPrice || service.price,
        duration: service.duration || 30,
        hinhAnh: service.hinhAnh || service.icon,
        type: 'DICHVU'
    });

    await loadVouchers();
    searchQuery.value = '';
    showServiceDropdown.value = false;
};

const removeService = async (id: number | string) => {
    bookingData.value.selectedServices = bookingData.value.selectedServices.filter(s => s.id !== id);
    const bookingStore = useBookingBasketStore();
    bookingStore.removeItem(id);
    await removeFromCartDB(id);
    await loadVouchers();
};

const selectedStylist = computed(() => stylists.value.find(s => s.id === bookingData.value.stylistId));
const subTotal = computed(() => bookingData.value.selectedServices.reduce((sum, s) => sum + s.price, 0));

const totalOriginalPrice = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + (s.originalPrice || s.price), 0);
});

const stackPreview = ref({ totalDiscount: 0, memberDiscount: 0, memberRankPercent: 0, finalAmount: 0 });

const refreshStackPreview = async () => {
    if (!customerId.value || customerId.value === 'GUEST') {
        stackPreview.value = { totalDiscount: 0, memberDiscount: 0, memberRankPercent: 0, finalAmount: subTotal.value };
        return;
    }
    try {
        const codes = bookingData.value.voucherIds.join(',');
        const res = await axios.get(`${API}/api/DatDichVu/preview-voucher-stack`, {
            params: {
                maKH: customerId.value,
                codes,
                subTotal: subTotal.value,
                ngayGioHen: bookingData.value.bookingDate || undefined,
                serviceIds: bookingData.value.selectedServices.map((s) => s.id).join(',') || undefined
            }
        });
        stackPreview.value = {
            totalDiscount: Number(res.data.totalDiscount) || 0,
            memberDiscount: Number(res.data.memberDiscount) || 0,
            memberRankPercent: Number(res.data.memberRankPercent) || 0,
            finalAmount: Number(res.data.finalAmount) ?? Math.max(0, subTotal.value)
        };
    } catch (e: any) {
        console.error("Lỗi preview voucher:", e);
        stackPreview.value = { totalDiscount: 0, memberDiscount: 0, memberRankPercent: 0, finalAmount: subTotal.value };
        const msg = e.response?.data?.message || 'Voucher không đủ điều kiện áp dụng!';
        Swal.fire({ title: 'Opps!', text: msg, icon: 'warning', confirmButtonText: 'Đã hiểu', confirmButtonColor: '#d4af37' });
        if (bookingData.value.voucherIds.length > 0) {
            bookingData.value.voucherIds.pop();
        }
    }
};

const discountAmount = computed(() => stackPreview.value.totalDiscount);
const memberDiscountAmount = computed(() => stackPreview.value.memberDiscount);
const memberRankPercent = computed(() => stackPreview.value.memberRankPercent);
const totalBill = computed(() => Math.max(0, stackPreview.value.finalAmount));
const payNow = computed(() => bookingData.value.paymentMode === '10' ? subTotal.value * 0.1 : totalBill.value);

function toggleVoucher(id: string) {
    const v = myVouchers.value.find((x: any) => x.id === id);
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
    const ids = bookingData.value.voucherIds;
    const i = ids.indexOf(id);
    if (i >= 0) {
        ids.splice(i, 1);
        return;
    }
    if (ids.length >= 1) {
        ids.splice(0, ids.length, id);
        return;
    }
    ids.push(id);
}

// -------------------------------------------------------------------------
// HÀM HANDLE BOOKING: CHẶN SPAM CLICK + DỌN GIỎ HÀNG + CHUYỂN CỔNG THANH TOÁN
// -------------------------------------------------------------------------
const handleBooking = async () => {
    if (isSubmitting.value) return;

    combineDateTime();

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

    isSubmitting.value = true;

    try {
        const generatedBookingId = "LD" + Date.now().toString().slice(-10);

        const bookingPayload = {
            bookingId: generatedBookingId,
            maKh: customerId.value || 'GUEST',
            ngayHen: bookingData.value.bookingDate, 
            totalAmount: totalBill.value,
            services: bookingData.value.selectedServices.map(s => ({
                id: String(s.id),
                price: s.price
            })),
            email: bookingData.value.email,
            phone: bookingData.value.phone,
            hoTen: bookingData.value.customerName,
            maCode: bookingData.value.voucherIds[0] || '',
            maCodes: bookingData.value.voucherIds,
            invoiceInfo: buildInvoiceInfoPayload()
        };

        const paymentMode = bookingData.value.paymentMode; 
        const paymentMethod = bookingData.value.paymentMethod; 
        const stylistId = bookingData.value.stylistId || '';

        const response = await axios.post(
            `${API}/api/DatDichVu/save-booking-final?paymentMode=${paymentMode}&maStylist=${stylistId}&paymentMethod=${paymentMethod}`,
            bookingPayload
        );

        // Xóa dịch vụ đã đặt trong giỏ hàng sau khi đặt thành công
        for (const s of bookingData.value.selectedServices) {
            await removeFromCartDB(s.id, 'DICHVU').catch(() => {});
        }
        useBookingBasketStore().clearAll();

        if (response.data?.url) {
            window.location.href = response.data.url;
        } else {
            const shortBookingId = response.data?.maLd || generatedBookingId;
            Swal.fire({ 
                title: 'Thành công', 
                text: 'Đặt lịch dịch vụ thành công!', 
                icon: 'success', 
                confirmButtonColor: '#1e293b' 
            }).then(() => {
                window.location.href = `/payment-result?maLd=${shortBookingId}`;
            });
        }
    } catch (error: any) {
        console.error("Lỗi đặt lịch:", error);
        const errorMsg = error.response?.data?.message || error.response?.data || 'Có lỗi xảy ra trong quá trình đặt lịch. Vui lòng thử lại!';
        Swal.fire({ title: 'Không thể đặt lịch', text: errorMsg, icon: 'error', confirmButtonColor: '#1e293b' });
    } finally {
        isSubmitting.value = false;
    }
};

const minDate = new Date().toLocaleDateString('en-CA');

const availableHours = computed(() => {
    const hours = [];
    for (let i = 8; i <= 20; i++) {
        const hourLabel = i < 10 ? `0${i}:00` : `${i}:00`;
        hours.push(hourLabel);
        hours.push(i < 10 ? `0${i}:30` : `${i}:30`);
    }
    return hours;
});

const isTimeSlotPast = (timeStr: string) => {
    if (!timeStr) return false;
    const todayStr = new Date().toLocaleDateString('en-CA');
    if (tempDate.value === todayStr) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const [h = 0, m = 0] = timeStr.split(':').map(Number);
        const selectedMinutes = h * 60 + m;
        return selectedMinutes <= currentMinutes + 10;
    }
    return false;
};

const combineDateTime = () => {
    validateField('bookingDate');
    if (tempTime.value && isTimeSlotPast(tempTime.value)) {
        tempTime.value = '';
    }
    validateField('tempTime');
    if (tempDate.value && tempTime.value) {
        bookingData.value.bookingDate = `${tempDate.value}T${tempTime.value}`;
    } else {
        bookingData.value.bookingDate = '';
    }
};

watch(
    () => bookingData.value.selectedServices.length,
    () => {
        validateField('services');
    }
);

watch(
    () => bookingData.value.stylistId,
    () => {
        validateField('stylist');
    }
);

const expectedEndTime = computed(() => {
    if (!tempTime.value || estimatedTotalMinutes.value === 0) return '';
    const [hours = 0, minutes = 0] = tempTime.value.split(':').map(Number);
    const totalMins = hours * 60 + minutes + estimatedTotalMinutes.value;
    const endHours = Math.floor(totalMins / 60);
    const endMins = totalMins % 60;
    const hh = endHours < 10 ? `0${endHours}` : endHours;
    const mm = endMins < 10 ? `0${endMins}` : endMins;
    return `${hh}:${mm}`;
});

const loadAvailableStylists = async () => {
    if (!tempDate.value) {
        return;
    }

    // Backend yêu cầu GioBatDau hợp lệ dạng TimeOnly (HH:mm). Nếu chưa chọn giờ, dùng '08:00' làm mốc query ca làm trong ngày
    const checkTime = tempTime.value || '08:00';
    const checkDuration = Math.max(30, estimatedTotalMinutes.value || 30);

    isSearchingStylist.value = true;
    try {
        const res = await axios.post(`${API}/api/DatDichVu/get-available-stylists`, {
            ngayHen: tempDate.value,
            gioBatDau: checkTime,
            tongThoiGian: checkDuration,
            maKh: customerId.value || 'GUEST',
            phone: bookingData.value.phone || ''
        });

        const rawList = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.data)
                ? res.data.data
                : Array.isArray(res.data?.stylists)
                    ? res.data.stylists
                    : [];

        const mappedStylists = rawList.map((s: any) => {
            const isOff = s.lichTrinh && Array.isArray(s.lichTrinh) && s.lichTrinh.some((l: string) => l.includes('Không có ca làm') || l.includes('Nghỉ làm'));
            return {
                ...s,
                isFavorite: s.isFavorite || isStylistFavorite(s.id),
                isAvailable: isOff ? false : (tempTime.value ? Boolean(s.isAvailable) : true)
            };
        });

        mappedStylists.sort((a: any, b: any) => {
            if (a.isAvailable !== b.isAvailable) {
                return a.isAvailable ? -1 : 1;
            }
            const favA = a.isFavorite ? 1 : 0;
            const favB = b.isFavorite ? 1 : 0;
            return favB - favA;
        });

        stylists.value = mappedStylists;

        // Nếu thợ đã chọn trước đó không còn rảnh trong giờ mới -> reset stylistId và báo cho khách
        if (tempTime.value && bookingData.value.stylistId) {
            const currentSelected = stylists.value.find(s => s.id === bookingData.value.stylistId);
            if (currentSelected && !currentSelected.isAvailable) {
                bookingData.value.stylistId = null;
                Swal.fire({
                    title: 'Stylist không khả dụng',
                    text: `Stylist ${currentSelected.name} không có ca làm việc hoặc đã bận vào khung giờ ${tempTime.value}. Vui lòng chọn Stylist khác hoặc chọn lại giờ hẹn!`,
                    icon: 'info',
                    confirmButtonText: 'Đã hiểu',
                    confirmButtonColor: '#1e293b'
                });
            }
        }
    } catch (e) {
        console.error("Lỗi tải danh sách thợ:", e);
        stylists.value = [];
    } finally {
        isSearchingStylist.value = false;
    }
};

const getFreeSlots = (stylist: any): string[] => {
    const lichTrinh = stylist?.lichTrinh;
    if (!lichTrinh || !Array.isArray(lichTrinh)) {
        if (stylist?.caLam) return [stylist.caLam];
        return [];
    }
    
    // Khi CHƯA chọn giờ: hiển thị ca làm việc hoặc lịch trống
    if (!tempTime.value) {
        const free = lichTrinh
            .filter((l: string) => l.includes('Lịch trống:'))
            .map((l: string) => l.replace('Lịch trống:', '').trim());
        if (free.length > 0) return free;

        // Nếu backend trả về "Trái ca (Làm 13:00 - 20:00)" vì query giờ khác -> trích xuất giờ ca làm
        const traica = lichTrinh.find((l: string) => l.includes('Trái ca') || l.includes('Ngoài ca') || l.includes('Làm'));
        if (traica) {
            const match = traica.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/);
            if (match) return [match[0]];
        }
        
        // Nếu có caLam -> trích xuất giờ làm việc
        if (stylist.caLam) {
            const match = stylist.caLam.match(/\d{1,2}h\s*-\s*\d{1,2}h/);
            if (match) return [match[0]];
            return [stylist.caLam];
        }
        return [];
    }

    // Khi ĐÃ chọn giờ:
    return lichTrinh
        .filter((l: string) => l.includes('Lịch trống:'))
        .map((l: string) => l.replace('Lịch trống:', '').trim());
};

const getBusySlots = (stylist: any): string[] => {
    const lichTrinh = stylist?.lichTrinh;
    if (!lichTrinh || !Array.isArray(lichTrinh)) return [];
    
    // 1. Các khung giờ khách ĐÃ ĐẶT HẸN ("Có hẹn: ...") luôn hiển thị để khách biết khung giờ thợ bận
    const booked = lichTrinh
        .filter((l: string) => l.includes('Có hẹn:'))
        .map((l: string) => l.replace('Có hẹn:', '').trim());

    // 2. Khi ĐÃ chọn giờ hẹn: nếu giờ đó ngoài ca làm ("Trái ca" / "Ngoài ca") -> hiển thị thêm lý do ngoài ca
    if (tempTime.value) {
        const outOfShift = lichTrinh
            .filter((l: string) => l.includes('Trái ca') || l.includes('Ngoài ca'))
            .map((l: string) => l.replace('Trái ca', 'Ngoài ca:').replace('Ngoài ca', 'Ngoài ca:').trim());
        return [...booked, ...outOfShift];
    }

    // Khi CHƯA chọn giờ -> hiển thị các ca bận thực tế do khách đã đặt hẹn trước
    return booked;
};

const selectStylist = (stylist: any) => {
    // 1. Chưa chọn giờ hẹn -> Nhắc khách chọn giờ trước
    if (!tempTime.value) {
        errors.value.tempTime = 'Vui lòng chọn khung giờ hẹn trước khi chọn Stylist.';
        Swal.fire({
            title: 'Vui lòng chọn giờ hẹn',
            text: 'Bạn vui lòng chọn khung Giờ hẹn bên trên trước để hệ thống kiểm tra độ rảnh và xác nhận Stylist phục vụ nhé!',
            icon: 'info',
            confirmButtonText: 'Chọn giờ hẹn ngay',
            confirmButtonColor: '#1e293b'
        }).then(() => {
            const timeSelect = document.getElementById('booking-time-select');
            if (timeSelect) {
                timeSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
                timeSelect.focus();
            }
        });
        return;
    }

    // 2. Đã chọn giờ nhưng thợ này bị bận trong giờ đó -> cảnh báo
    if (!stylist.isAvailable) {
        Swal.fire({
            title: 'Stylist đang bận',
            text: `Stylist ${stylist.name} đang có khách hẹn hoặc ngoài ca làm việc trong khung giờ ${tempTime.value}. Vui lòng chọn giờ hẹn khác hoặc chọn Stylist đang có lịch trống!`,
            icon: 'warning',
            confirmButtonText: 'Đã hiểu',
            confirmButtonColor: '#1e293b'
        });
        return;
    }

    bookingData.value.stylistId = stylist.id;
    validateField('stylist');
};

watch(
    [() => tempDate.value, () => tempTime.value, () => bookingData.value.selectedServices.length],
    () => {
        loadAvailableStylists();
    },
    { deep: true }
);

watch(
    [
        () => customerId.value,
        () => bookingData.value.voucherIds.slice(),
        () => subTotal.value,
        () => bookingData.value.bookingDate,
        () => bookingData.value.selectedServices.length
    ],
    () => {
        // Chủ động loại bỏ voucher nếu tổng tiền hiện tại không còn đủ điều kiện áp dụng
        if (bookingData.value.voucherIds.length > 0 && myVouchers.value.length > 0) {
            bookingData.value.voucherIds = bookingData.value.voucherIds.filter((id) => {
                const v = myVouchers.value.find((x: any) => x.id === id);
                return v && !isVoucherDisabled(v);
            });
        }
        refreshStackPreview();
    },
    { deep: true, immediate: true }
);
onUnmounted(() => {
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
                <h1 class="font-playfair text-black font-black text-5xl">ĐẶT LỊCH HẸN</h1>
                <div class="accent-line mx-auto mt-4"></div>
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
                                            Đăng nhập lại để tự động điền thông tin, tiếp tục tích điểm và hưởng trọn ưu đãi thành viên. Hoặc bạn vẫn có thể tiếp tục đặt lịch với tư cách khách bên dưới.
                                        </p>
                                        <div class="mt-3 flex flex-wrap items-center gap-3">
                                            <router-link :to="{ name: 'login', query: { redirect: '/dat-dich-vu' } }" class="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
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
                                        Đăng nhập để tự động điền thông tin, lưu thợ quen và tích điểm thành viên khi hoàn tất.
                                    </p>
                                </div>
                            </div>
                            <router-link :to="{ name: 'login', query: { redirect: '/dat-dich-vu' } }" class="self-start sm:self-center flex-shrink-0 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                                Đăng Nhập
                            </router-link>
                        </div>

                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-user-edit me-2"></i> THÔNG TIN KHÁCH HÀNG
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
                                    type="text" class="booking-input w-full"
                                    placeholder="Nguyễn Văn A">
                                <p v-if="errors.customerName" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.customerName }}</p>
                            </div>

                            <div>
                                <label class="custom-label font-bold">Số điện thoại *</label>
                                <input v-model="bookingData.phone" 
                                    @input="validateField('phone')" 
                                    @blur="validateField('phone')"
                                    :class="{ 'input-error': errors.phone }"
                                    type="tel" class="booking-input w-full"
                                    placeholder="090x xxx xxx">
                                <p v-if="errors.phone" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.phone }}</p>
                            </div>
                            <div>
                                <label class="custom-label font-bold">Email nhận mã QR *</label>
                                <input v-model="bookingData.email" 
                                    @input="validateField('email')" 
                                    @blur="validateField('email')"
                                    :class="{ 'input-error': errors.email }"
                                    type="email" class="booking-input w-full"
                                    placeholder="vidu@gmail.com">
                                <p v-if="errors.email" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.email }}</p>
                            </div>
                            <div>
                                <label class="custom-label font-bold">Ngày hẹn *</label>
                                <input v-model="tempDate" 
                                    @change="combineDateTime"
                                    :class="{ 'input-error': errors.bookingDate }"
                                    type="date" class="booking-input w-full" :min="minDate">
                                <p v-if="errors.bookingDate" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.bookingDate }}</p>
                            </div>

                            <div>
                                <label class="custom-label font-bold">Giờ hẹn *</label>
                                <select id="booking-time-select" v-model="tempTime" 
                                    @change="combineDateTime"
                                    :class="{ 'input-error': errors.tempTime }"
                                    class="booking-input">
                                    <option value="" disabled>Chọn giờ</option>
                                    <option v-for="h in availableHours" :key="h" :value="h" :disabled="isTimeSlotPast(h)" :class="{ 'text-gray-400 bg-gray-50': isTimeSlotPast(h) }">
                                        {{ h }}{{ isTimeSlotPast(h) ? ' (Đã qua)' : '' }}
                                    </option>
                                </select>
                                <p v-if="errors.tempTime" class="error-msg-custom"><i class="fas fa-exclamation-circle me-1"></i>{{ errors.tempTime }}</p>
                                <div class="summary-line" v-if="tempTime">
                                    <span class="font-bold">Giờ bắt đầu làm:</span>
                                    <span class="font-bold">{{ tempTime }}</span>
                                </div>
                                <div class="summary-line" v-if="expectedEndTime">
                                    <span class="font-bold">Dự kiến xong lúc:</span>
                                    <span class="text-black font-bold" style="font-size: 1.1rem;">{{
                                        expectedEndTime }}</span>
                                </div>
                                <div class="summary-line text-black" v-if="estimatedTotalMinutes > 0">
                                    <span class="font-bold">Tổng thời gian:</span>
                                    <span>{{ estimatedTotalMinutes }} phút</span>
                                </div>
                            </div>

                            <div class="md:col-span-2">
                                <label class="custom-label font-bold">Ghi chú</label>
                                <input v-model="bookingData.note" type="text" class="booking-input w-full"
                                    placeholder="Ghi chú yêu cầu...">
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

                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-cut me-2"></i> CHỌN STYLIST
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <p v-if="errors.stylist" class="error-msg-custom stylist-error-banner mb-3"><i class="fas fa-exclamation-triangle me-1.5"></i>{{ errors.stylist }}</p>

                        <!-- Gợi ý chọn giờ -->
                        <div v-if="!tempTime" class="mb-3 p-3 bg-amber-50/80 border border-amber-200/80 rounded-sm text-xs text-amber-900 flex items-center gap-2">
                            <i class="fas fa-info-circle text-amber-600 text-sm flex-shrink-0"></i>
                            <span>Vui lòng chọn <strong>Giờ hẹn</strong> bên trên để hệ thống kiểm tra ca làm và độ rảnh của từng Stylist.</span>
                        </div>

                        <div v-if="isSearchingStylist"
                            class="mt-4 p-4 text-center text-gray-500 font-bold bg-gray-50 border rounded-sm">
                            <i class="fas fa-spinner fa-spin me-2 text-black"></i> Đang tải lịch làm việc và kiểm tra ca thợ...
                        </div>

                        <div v-else class="stylist-flex mt-3">
                            <div v-for="stylist in stylists" :key="stylist.id" 
                                class="stylist-card" 
                                :class="{
                                    'active': bookingData.stylistId === stylist.id,
                                    'is-busy': tempTime && !stylist.isAvailable,
                                    'is-available': tempTime && stylist.isAvailable
                                }" 
                                @click="selectStylist(stylist)">
                                
                                <div class="stylist-schedule-info" v-if="stylist.caLam || (stylist.lichTrinh && stylist.lichTrinh.length > 0)">
                                    <div class="schedule-header flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-gray-100">
                                        <span class="truncate font-bold text-[10px] text-gray-800" :title="stylist.caLam">
                                            <i class="far fa-clock text-[9px] text-gray-400 me-0.5"></i>{{ stylist.caLam || 'Có ca làm' }}
                                        </span>
                                        <span :class="(!tempTime || stylist.isAvailable) ? 'text-green-700 bg-green-100 border-green-300' : 'text-red-600 bg-red-100 border-red-300'" 
                                            class="px-1.5 py-0.5 rounded border text-[8px] font-extrabold uppercase shrink-0">
                                            {{ tempTime ? (stylist.isAvailable ? 'Rảnh' : 'Bận') : 'Sẵn sàng' }}
                                        </span>
                                    </div>

                                    <!-- Phân tách rõ ràng: Khung giờ Rảnh vs Khung giờ Bận -->
                                    <div class="schedule-sections flex flex-col gap-1 text-left">
                                        <!-- 1. KHUNG GIỜ RẢNH (XANH LÁ) -->
                                        <div v-if="getFreeSlots(stylist).length > 0" class="schedule-box free-box">
                                            <div class="box-title text-green-700 font-bold text-[9px] flex items-center gap-1">
                                                <i class="fas fa-check-circle text-[8px] text-green-600"></i>
                                                <span>{{ tempTime ? 'Giờ rảnh:' : 'Lịch trống:' }}</span>
                                            </div>
                                            <div class="box-content flex flex-col gap-0.5 mt-0.5">
                                                <span v-for="(slot, sIdx) in getFreeSlots(stylist)" :key="'free-'+sIdx" class="slot-text text-green-800 text-[9px] font-medium leading-tight truncate" :title="slot">
                                                    {{ slot }}
                                                </span>
                                            </div>
                                        </div>

                                        <!-- 2. KHUNG GIỜ BẬN / CÓ HẸN (ĐỎ) -->
                                        <div v-if="getBusySlots(stylist).length > 0" class="schedule-box busy-box">
                                            <div class="box-title text-red-600 font-bold text-[9px] flex items-center gap-1">
                                                <i class="fas fa-calendar-times text-[8px] text-red-500"></i>
                                                <span>{{ tempTime ? 'Giờ bận:' : 'Đã có hẹn:' }}</span>
                                            </div>
                                            <div class="box-content flex flex-col gap-0.5 mt-0.5">
                                                <span v-for="(slot, sIdx) in getBusySlots(stylist)" :key="'busy-'+sIdx" class="slot-text text-red-700 text-[9px] font-medium leading-tight truncate" :title="slot">
                                                    {{ slot }}
                                                </span>
                                            </div>
                                        </div>

                                        <!-- 3. NGHỈ CA HÔM NAY -->
                                        <div v-if="stylist.lichTrinh && stylist.lichTrinh.some((l: string) => l.includes('Không có ca làm'))" class="schedule-box off-box">
                                            <span class="text-gray-500 text-[9px] italic block text-center">Nghỉ ca hôm nay</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="avatar-box">
                                    <img :src="stylist.img ? (stylist.img.startsWith('http') ? stylist.img : (API + stylist.img)) : '/images/no-image.png'"
                                        alt="Stylist" onerror="this.onerror=null; this.src='/images/no-image.png'">
                                    <div class="check-badge"><i class="fas fa-check"></i></div>
                                    <div v-if="stylist.isFavorite" class="favorite-heart-badge">
                                        <i class="fas fa-heart"></i>
                                    </div>
                                    <div v-if="tempTime && !stylist.isAvailable" class="busy-badge-corner" title="Đang bận hoặc ngoài ca làm">
                                        <i class="fas fa-ban"></i>
                                    </div>
                                </div>
    
                                <div class="stylist-meta mt-auto">
                                    <span class="s-name font-bold">{{ stylist.name }}</span>
    
                                    <span class="s-role text-black">{{ stylist.role || 'Stylist' }}</span>
                                    <div class="stylist-rating-badge" v-if="stylist.rating">
                                        <span class="rating-val">{{ stylist.rating?.toFixed(1) || '5.0' }}</span>
                                        <i class="fas fa-star rating-star-icon"></i>
                                    </div>
                                </div>
                            </div>

                            <div v-if="stylists.length === 0"
                                class="w-full p-6 text-center text-gray-500 border border-gray-200 bg-gray-50 rounded-sm">
                                <i class="far fa-calendar-times text-2xl text-gray-400 mb-2 block"></i>
                                Ngày này tiệm chưa có danh sách Stylist làm việc. Bạn vui lòng chọn ngày khác nhé!
                            </div>
                        </div>
                        <div class="section-heading-wrapper mt-5">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-credit-card me-2"></i> PHƯƠNG THỨC THANH TOÁN
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="payment-method-row mt-3">
                            <div class="method-option vnpay" :class="{ active: bookingData.paymentMethod === 'vnpay' }"
                                @click="bookingData.paymentMethod = 'vnpay'">
                                <div class="method-logo-wrapper">
                                    <img src="/vnpay-logo.png" alt="VNPay" class="method-logo-img">
                                </div>
                            </div>
                            <div class="method-option momo" :class="{ active: bookingData.paymentMethod === 'momo' }"
                                @click="bookingData.paymentMethod = 'momo'">
                                <div class="method-logo-wrapper">
                                    <img src="/momo-logo.png" alt="MoMo" class="method-logo-img">
                                </div>
                            </div>
                        </div>

                        <div class="section-heading-wrapper mt-5">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-ticket-alt me-2"></i> KHO VOUCHER CỦA BẠN
                            </h3>
                            <div class="heading-line"></div>
                        </div>

                        <div v-if="myVouchers.length > 0" class="voucher-list-modern">
                            <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                :class="{ active: bookingData.voucherIds.includes(v.id), disabled: isVoucherDisabled(v) }" 
                                @click="toggleVoucher(v.id)">

                                <div class="ticket-left" :class="{ 'opacity-50': isVoucherDisabled(v) }">
                                    <span class="ticket-brand-text">LGHAIR</span>
                                    <span class="notch top"></span>
                                    <span class="notch bottom"></span>
                                </div>

                                <div class="v-divider"></div>

                                <div class="ticket-right">
                                    <div class="flex justify-between items-start mb-2">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="v-code-badge">{{ v.code }}</span>
                                            <span v-if="isVoucherDisabled(v)" class="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded">
                                                Chưa đủ điều kiện
                                            </span>
                                        </div>
                                        <span class="v-expiry-tag"><i class="far fa-calendar-alt me-1.5"></i>HSD: {{
                                            v.expiry }}</span>
                                    </div>
                                    <div class="v-price-gold font-bold">Giảm: {{ v.discount.toLocaleString() }}đ</div>
                                    <div class="v-desc text-black mt-1" v-if="v.desc">{{ v.desc }}</div>
                                    <div v-if="isVoucherDisabled(v)" class="text-xs text-red-600 font-semibold mt-2 flex items-center gap-1.5 bg-red-50 px-2.5 py-1.5 rounded border border-red-200">
                                        <i class="fas fa-exclamation-circle text-[12px] text-red-500 shrink-0"></i>
                                        <span>{{ getDisabledReason(v) }}</span>
                                    </div>
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

                <div class="lg:col-span-5" data-aos="fade-left">
                    <div class="sticky-bill">
                        <div class="glass-card bill-card">
                            <div class="section-heading-wrapper justify-content-center text-center mb-4">
                                <h3 class="font-playfair section-heading-title font-bold text-black">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> CHI TIẾT HÓA ĐƠN
                                </h3>
                                <div class="heading-line mx-auto" style="width: 80px;"></div>
                            </div>

                            <p v-if="errors.services" class="error-msg-custom services-error-banner mb-3"><i class="fas fa-exclamation-triangle me-1.5"></i>{{ errors.services }}</p>

                            <div class="search-box-wrapper mb-4">
                                <div class="input-wrap">
                                    <i class="fas fa-search search-icon"></i>
                                    <input v-model="searchQuery" type="text" placeholder="Tìm và thêm dịch vụ..."
                                        @focus="showServiceDropdown = true" class="search-input">
                                </div>
                                <div v-if="showServiceDropdown" class="service-dropdown-list shadow">
                                    <div class="dropdown-header">DANH SÁCH DỊCH VỤ</div>
                                    <div class="dropdown-scroll-area">
                                        <div v-for="service in filteredServices" :key="service.id"
                                            class="service-dropdown-item" @click="addService(service)">
                                            <div class="flex items-center">
                                                <div
                                                    class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                    <img :src="service.hinhAnh ? (String(service.hinhAnh).startsWith('http') ? service.hinhAnh : API + service.hinhAnh) : '/images/no-image.png'"
                                                        class="w-full h-full object-cover"
                                                        onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                                </div>
                                                <div class="item-details">
                                                    <span class="item-name-text font-bold">{{ service.name }} </span>
                                                    <div class="flex items-center mt-1">
                                                        <span
                                                            v-if="service.originalPrice && service.originalPrice > service.price"
                                                            class="text-black me-2"
                                                            style="text-decoration: line-through; font-size: 12px;">
                                                            {{ service.originalPrice.toLocaleString() }}đ
                                                        </span>
                                                        <span class="item-price-text text-black font-bold">
                                                            {{ service.price.toLocaleString() }}đ
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

                            <div class="selected-items-wrapper mb-4">
                                <transition-group name="list-fade">
                                    <div v-for="s in bookingData.selectedServices" :key="s.id" class="item-row">
                                        <div class="flex items-center">
                                            <div
                                                class="w-12 h-12 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                <img :src="s.hinhAnh ? (String(s.hinhAnh).startsWith('http') ? s.hinhAnh : API + s.hinhAnh) : '/images/no-image.png'"
                                                    class="w-full h-full object-cover"
                                                    onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                            </div>
                                            <div class="item-info">
                                                <span class="n font-bold">{{ s.name }}</span>
                                                <div class="flex items-center">
                                                    <span v-if="s.originalPrice && s.originalPrice > s.price"
                                                        class="text-black me-2"
                                                        style="text-decoration: line-through; font-size: 12px;">
                                                        {{ s.originalPrice.toLocaleString() }}đ
                                                    </span>
                                                    <span class="p text-black font-bold">{{ s.price.toLocaleString()
                                                        }}đ</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button class="del-btn" @click="removeService(s.id)"><i
                                                class="fas fa-trash-alt"></i></button>
                                    </div>
                                </transition-group>
                            </div>

                            <div class="payment-mode-select mt-4 pt-3 border-top">
                                <label class="font-bold mb-3 d-block"><i class="fas fa-wallet text-black me-2"></i> CHỌN
                                    MỨC THANH TOÁN</label>
                                <div class="pay-row flex flex-col gap-3">
                                    <div class="pay-btn" :class="{ active: bookingData.paymentMode === '10' }"
                                        @click="bookingData.paymentMode = '10'">
                                        <span class="dot"></span> <b>Đặt cọc 10%</b>
                                    </div>
                                    <div class="pay-btn" :class="{ active: bookingData.paymentMode === '100' }"
                                        @click="bookingData.paymentMode = '100'">
                                        <span class="dot"></span> <b>Thanh toán 100%</b>
                                    </div>
                                </div>
                            </div>

                            <div class="bill-summary">
                                <div class="summary-line" v-if="totalOriginalPrice > subTotal">
                                    <span>Tổng giá gốc:</span>
                                    <span style="text-decoration: line-through;">{{ totalOriginalPrice.toLocaleString()
                                        }}đ</span>
                                </div>

                                <div class="summary-line saving text-success" v-if="totalOriginalPrice > subTotal">
                                    <span>Flash Sale dịch vụ:</span>
                                    <span>-{{ (totalOriginalPrice - subTotal).toLocaleString() }}đ</span>
                                </div>

                                <div class="summary-line" v-if="totalOriginalPrice === subTotal">
                                    <span>Tạm tính:</span>
                                    <span>{{ subTotal.toLocaleString() }}đ</span>
                                </div>

                                <div v-if="memberDiscountAmount > 0" class="summary-line saving text-success">
                                    <span>Giảm giá thành viên ({{ memberRankPercent }}%):</span>
                                    <span class="font-bold">-{{ memberDiscountAmount.toLocaleString() }}đ</span>
                                </div>

                                <div v-if="bookingData.voucherIds.length" class="summary-line saving text-success">
                                    <span>Voucher giảm giá:</span>
                                    <span class="font-bold">-{{ discountAmount.toLocaleString() }}đ</span>
                                </div>
                                <div v-if="bookingData.voucherIds.length"
                                    class="summary-line small text-black font-bold">
                                    <span>Mã đã chọn:</span>
                                    <span>{{ bookingData.voucherIds.join(' → ') }}</span>
                                </div>

                                <div v-if="selectedStylist" class="summary-line">
                                    <span class="font-bold">Nhân Viên STYLIST:</span>
                                    <span class="text-black font-bold">{{ selectedStylist.name }}</span>
                                </div>

                                <div class="total-line-final mt-3 pt-3 border-t border-dashed">
                                    <div class="summary-line">
                                        <span class="total-lbl font-bold">TỔNG ĐƠN HÀNG:</span>
                                        <span class="total-val-standard font-bold text-black">{{
                                            totalBill.toLocaleString() }}đ</span>
                                    </div>

                                    <div class="mt-2 text-xs text-gray-500" v-if="bookingData.paymentMode === '10'">
                                        <div class="flex justify-between py-0.5">
                                            <span>+ Tiền cọc dịch vụ (10%):</span>
                                            <span>{{ (subTotal * 0.1).toLocaleString() }}đ</span>
                                        </div>
                                    </div>

                                    <div class="pay-now-alert mt-3">
                                        <span>THANH TOÁN NGAY:</span>
                                        <span>{{ payNow.toLocaleString() }}đ</span>
                                    </div>

                                    <div class="summary-line mt-2" style="color: #e53e3e; font-weight: 600;"
                                        v-if="bookingData.paymentMode === '10' && totalBill > payNow">
                                        <span style="color: #e53e3e;">Còn lại trả tại tiệm:</span>
                                        <span class="font-bold" style="color: #e53e3e;">{{ (totalBill -
                                            payNow).toLocaleString() }}đ</span>
                                    </div>
                                </div>
                            </div>

                            <button class="btn-confirm-metallic-final mt-4" @click="handleBooking" 
                                    :disabled="isSubmitting" 
                                    :class="{ 'opacity-50 cursor-not-allowed': isSubmitting }">
                                <span v-if="!isSubmitting" class="btn-text-normal">THANH TOÁN NGAY</span>
                                <span v-else class="btn-text-normal"><i class="fas fa-spinner fa-spin me-2"></i> ĐANG XỬ LÝ...</span>
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
.font-playfair,
h1,
h2,
h3,
h4,
h5,
h6,
.section-heading-title {
    font-family: 'Montserrat', sans-serif !important;
}

input,
select,
textarea,
button,
.booking-input {
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

.left-main-card:hover,
.bill-card:hover {
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

.stylist-error-banner,
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

.stylist-flex {
    display: flex;
    gap: 16px;
    overflow-x: auto;
    padding: 10px 4px 15px 4px; 
    -webkit-overflow-scrolling: touch;
}

.stylist-flex::-webkit-scrollbar {
    height: 6px;
}

.stylist-flex::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
}

.stylist-flex::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
}

.stylist-flex::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
}

.stylist-card {
    flex: 0 0 160px;
    text-align: center;
    cursor: pointer;
    background: #ffffff;
    border: 1px solid var(--border-color);
    border-radius: 10px;
    padding: 12px 8px 14px 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
    display: flex;
    flex-direction: column;
    align-items: center;
}

.stylist-schedule-info {
    position: relative; 
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 8px;
    margin-bottom: 16px; 
    width: 100%;
    text-align: left;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.03);
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
    border-color: #e2e8f0 transparent transparent transparent;
    z-index: 1;
}

.schedule-header {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-primary);
}

.schedule-box {
    padding: 4px 6px;
    border-radius: 4px;
    border: 1px solid transparent;
}

.schedule-box.free-box {
    background: #f0fdf4;
    border-color: #bbf7d0;
}

.schedule-box.busy-box {
    background: #fef2f2;
    border-color: #fecaca;
}

.schedule-box.off-box {
    background: #f8fafc;
    border-color: #e2e8f0;
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

.stylist-card.is-busy {
    opacity: 0.55;
    background: #f8fafc;
    filter: grayscale(35%);
    border-color: #e2e8f0;
    cursor: not-allowed;
}

.stylist-card.is-busy:hover {
    transform: none;
    border-color: #cbd5e1;
    box-shadow: none;
}

.stylist-card.is-available {
    border-color: #bbf7d0;
}

.stylist-card.is-available:hover {
    border-color: #22c55e;
    box-shadow: 0 6px 16px rgba(34, 197, 94, 0.12);
}

.busy-badge-corner {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #ef4444;
    color: #ffffff;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    border: 2px solid #ffffff;
    box-shadow: 0 2px 4px rgba(239, 68, 68, 0.4);
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
    border-radius: 8px;
    padding: 12px 16px;
    cursor: pointer;
    background: #ffffff;
    transition: all 0.25s ease;
}

.invoice-toggle-line:hover {
    border-color: var(--primary-color);
}

.invoice-toggle-arrow {
    font-size: 12px;
    color: var(--text-muted);
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

.method-logo-wrapper {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
}

.method-logo-img {
    height: 56px;
    max-width: 90%;
    object-fit: contain;
    border-radius: 8px;
    transition: transform 0.3s ease;
}

.method-option.active .method-logo-img {
    transform: scale(1.05);
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
    border-bottom: 1px solid var(--border-color);
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

.service-dropdown-item img {
    border-radius: 0px;
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
    border-top: 1px solid var(--border-color);
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
    background-color: var(--border-color);
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

/* Payment deposit selectors */
.payment-mode-select {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color);
}

.payment-mode-select label {
    font-size: 12px;
    font-weight: 700;
    color: var(--text-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
}

.payment-mode-select label i {
    color: var(--primary-color);
}

.pay-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pay-btn {
    border: 1px solid var(--border-color);
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

/* Bill Summary area */
.bill-summary {
    border-top: 1px solid var(--border-color);
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

.discount-red {
    color: #ef4444 !important;
}

.discount-red span:last-child {
    color: #ef4444 !important;
}

.total-line-final {
    margin-top: 16px;
    border-top: 1px dashed var(--border-color);
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

.pay-now-alert {
    background: #f0fdf4;
    padding: 12px;
    border-radius: 0px;
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

.btn-confirm-metallic-final:hover:not(:disabled) {
    background: transparent;
    color: var(--primary-color) !important;
    transform: translateY(-2px);
    box-shadow: none;
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

/* Custom disabled state cho Stylist */
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

/* Badge trái tim cho thợ yêu thích */
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
    transition: transform 0.3s ease;
}

.stylist-card:hover .favorite-heart-badge {
    transform: scale(1.15);
}
</style>