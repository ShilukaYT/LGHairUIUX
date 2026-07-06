<script setup lang="ts">
import { getCartDB, removeFromCartDB, addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios';

declare const AOS: any;

const API = import.meta.env.VITE_API_URL;
const allItemsFromApi = ref<any[]>([]);
const stylists = ref<any[]>([]); // Đổi thành ref trống
const myVouchers = ref<any[]>([]); // Đổi thành ref trống
const customerId = ref('');
const tempDate = ref('');
const tempTime = ref('');
// Thay dòng const estimatedTotalMinutes = ref(0); bằng:
const estimatedTotalMinutes = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + (s.duration || 30), 0);
});


// Sửa lại dòng 12 đến 22 cho chuẩn TypeScript
const bookingData = ref({
    customerName: '',
    phone: '',
    email: '',
    bookingDate: '',
    stylistId: null as string | null,
    selectedServices: [] as Array<{ id: any, name: string, price: number, originalPrice: number, icon: string, duration: number, hinhAnh?: string }>,
    /** Tối đa 2 mã, thứ tự = thứ tự áp dụng (mã trước trừ trước) */
    voucherIds: [] as string[],
    paymentMode: '10',
    paymentMethod: 'vnpay',
    note: ''
});

// ==========================================
// STATE HÓA ĐƠN ĐIỆN TỬ
// Theo luật, mọi lịch hẹn đều PHẢI xuất hóa đơn điện tử — không có tùy chọn tắt.
// Khách chỉ chọn: xuất theo cá nhân (mặc định) hay theo doanh nghiệp (có MST).
// ==========================================
const invoiceInfo = ref({
    laDoanhNghiep: false,
    tenCongTy: '',
    mst: '',
    diaChiXuatHD: '',
    emailNhanHD: ''
});
const mstError = ref('');

const validateMst = (): boolean => {
    if (!invoiceInfo.value.laDoanhNghiep) {
        mstError.value = '';
        return true;
    }
    const mst = (invoiceInfo.value.mst || '').trim();
    const isValid = /^\d{10}$/.test(mst) || /^\d{10}-\d{3}$/.test(mst);
    mstError.value = isValid ? '' : 'Mã số thuế không hợp lệ (10 số, hoặc 10 số-3 số chi nhánh)';
    return isValid;
};

const validateInvoiceInfo = (): string | null => {
    if (!validateMst()) return mstError.value;

    if (invoiceInfo.value.laDoanhNghiep) {
        const tenCty = (invoiceInfo.value.tenCongTy || '').trim();
        if (tenCty.length < 3) return 'Vui lòng nhập đúng tên công ty (tối thiểu 3 ký tự)';
    } else {
        const ten = (bookingData.value.customerName || '').trim();
        if (ten.length < 3 || !/[a-zA-ZÀ-ỹ]/.test(ten)) return 'Vui lòng nhập đúng họ tên khách hàng';
    }

    const email = (invoiceInfo.value.emailNhanHD || bookingData.value.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Vui lòng nhập đúng định dạng email nhận hóa đơn';

    return null;
};

// Hàm load Voucher dựa trên tổng tiền hiện tại
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

        // Bỏ các mã không còn trong danh sách hợp lệ
        bookingData.value.voucherIds = bookingData.value.voucherIds.filter((id) =>
            myVouchers.value.some((v) => v.id === id)
        );
    } catch (error) {
        console.error("Lỗi load voucher:", error);
    }
};


onMounted(async () => {
    // 1. Tự động điền thông tin khách hàng
    const customer = getCustomerInfo();
    customerId.value = customer.maKH;
    if (customer.maKH !== 'GUEST') {
        bookingData.value.customerName = customer.hoTen;
        bookingData.value.email = customer.email;
        bookingData.value.phone = customer.sdt;
    }

    // 2. Fetch Dịch vụ, Combo & Stylist
    try {
        // Gọi song song cả 2 API cho nhanh
        const [resBooking, resStylists] = await Promise.all([
            axios.get(`${API}/api/DatDichVu/data-booking`),
            axios.get(`${API}/api/DatDichVu/get-stylists`)
        ]);

        allItemsFromApi.value = [...resBooking.data.services, ...resBooking.data.combos];
        stylists.value = resStylists.data; // QUAN TRỌNG: Phải có dòng này dữ liệu mới hiện
    } catch (error) {
        console.error("Lỗi khi load dữ liệu:", error);
    }
    // 3. Load giỏ hàng từ IndexedDB (đã chọn từ Services.vue)
    // 3. Nhận dữ liệu đã đóng gói từ giỏ hàng
    const checkoutRaw = localStorage.getItem("checkoutData");

    if (checkoutRaw) {
        const checkoutData = JSON.parse(checkoutRaw);

        console.log("Dữ liệu nhận từ giỏ hàng:", checkoutData);

        // Chỉ lấy DỊCH VỤ đưa vào form đặt lịch
        bookingData.value.selectedServices = (checkoutData.dichVuItems || []).map((item: any) => ({
            id: item.id,
            name: item.tenItem,
            price: Number(item.gia || 0),
            originalPrice: Number(item.giaGoc || item.gia || 0),
            icon: 'fas fa-check-circle',
            duration: Number(item.duration || 30),
            hinhAnh: item.hinhAnh
        }));

        // Nếu cần dùng sản phẩm / giao hàng sau này thì lấy như này
        const sanPhamItems = checkoutData.sanPhamItems || [];
        const thongTinGiaoHang = checkoutData.thongTinGiaoHang;
        const nhanSanPham = checkoutData.nhanSanPham;
        const loaiCheckout = checkoutData.loaiCheckout;

        console.log("Sản phẩm:", sanPhamItems);
        console.log("Thông tin giao hàng:", thongTinGiaoHang);
        console.log("Kiểu nhận sản phẩm:", nhanSanPham);
        console.log("Loại checkout:", loaiCheckout);
    } else {
        // Nếu không có dữ liệu từ giỏ hàng thì fallback lấy từ IndexedDB
        const cartData = await getCartDB(customer.maKH);

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
        }
    }
    await loadVouchers();
});

const searchQuery = ref('');
const showServiceDropdown = ref(false);

// --- LOGIC TÌM KIẾM ---
const filteredServices = computed(() => {
    const query = searchQuery.value.toLowerCase().trim();

    // Lấy toàn bộ dữ liệu từ API đã lưu vào allItemsFromApi
    let list = allItemsFromApi.value;

    // Nếu có nhập từ khóa thì mới lọc theo tên
    if (query) {
        list = list.filter(s =>
            s.name.toLowerCase().includes(query)
        );
    }

    // Luôn lọc bỏ những dịch vụ đã có trong giỏ hàng (selectedServices)
    return list.filter(item =>
        !bookingData.value.selectedServices.find(selected => selected.id === item.id)
    );
});



const addService = async (service: any) => {
    // 1. Kiểm tra nếu đã có trong danh sách thì không thêm nữa
    if (bookingData.value.selectedServices.find(s => s.id === service.id)) {
        showServiceDropdown.value = false;
        return;
    }

    // 2. Thêm vào giao diện (Reactive array)
    bookingData.value.selectedServices.push({
        id: service.id,
        name: service.name,
        price: service.price,
        // THÊM DÒNG NÀY:
        originalPrice: service.originalPrice || service.price,
        icon: service.icon || 'fas fa-check-circle',
        duration: service.duration || 30,
        hinhAnh: service.hinhAnh
    });
    // 3. LƯU VÀO INDEXEDDB (QUAN TRỌNG)
    try {
        await addToCartDB(
            {
                id: service.id,
                tenItem: service.name,
                gia: service.price,
                hinhAnh: service.icon // Thêm hinhAnh để tránh lỗi thiếu thuộc tính trong CartItem
            },
            customerId.value || 'GUEST' // Truyền maKH làm tham số thứ hai ở đây
        );

        console.log("Đã lưu dịch vụ mới vào IndexedDB");
    } catch (error) {
        console.error("Lỗi khi lưu vào IndexedDB:", error);
    }
    // 4. Tải lại voucher vì tổng tiền đã thay đổi
    await loadVouchers();
    // 5. Reset ô tìm kiếm
    searchQuery.value = '';
    showServiceDropdown.value = false;
};

const removeService = async (id: number | string) => {
    // Xóa trên giao diện
    bookingData.value.selectedServices = bookingData.value.selectedServices.filter(s => s.id !== id);

    // Xóa trong IndexedDB (Giỏ hàng gốc)
    await removeFromCartDB(id);

    // Tải lại voucher vì tổng tiền đã thay đổi
    await loadVouchers();
};

// Các computed property giữ nguyên logic cũ nhưng dùng .value cho stylists
const selectedStylist = computed(() => stylists.value.find(s => s.id === bookingData.value.stylistId));
const subTotal = computed(() => bookingData.value.selectedServices.reduce((sum, s) => sum + s.price, 0));

const totalOriginalPrice = computed(() => {
    return bookingData.value.selectedServices.reduce((sum, s) => sum + (s.originalPrice || s.price), 0);
});

/** Tổng giảm & tổng sau giảm (API xếp chồng tối đa 2 mã) */
const stackPreview = ref({ totalDiscount: 0, finalAmount: 0 });

const refreshStackPreview = async () => {
    if (!customerId.value || customerId.value === 'GUEST' || bookingData.value.voucherIds.length === 0) {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value };
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
            finalAmount: Number(res.data.finalAmount) ?? Math.max(0, subTotal.value)
        };
    } catch {
        stackPreview.value = { totalDiscount: 0, finalAmount: subTotal.value };
    }
};

watch(
    () => [
        bookingData.value.voucherIds.slice(),
        subTotal.value,
        bookingData.value.bookingDate,
        bookingData.value.selectedServices.map((s) => s.id).join(',')
    ],
    () => {
        void refreshStackPreview();
    },
    { deep: true, immediate: true }
);

const discountAmount = computed(() => stackPreview.value.totalDiscount);
const totalBill = computed(() => Math.max(0, stackPreview.value.finalAmount));
const payNow = computed(() => bookingData.value.paymentMode === '10' ? totalBill.value * 0.1 : totalBill.value);

function toggleVoucher(id: string) {
    const ids = bookingData.value.voucherIds;
    const i = ids.indexOf(id);
    if (i >= 0) {
        ids.splice(i, 1);
        return;
    }
    if (ids.length >= 2) {
        alert('Chỉ chọn tối đa 2 voucher. Bỏ chọn một mã trước khi thêm mã khác.');
        return;
    }
    ids.push(id);
}

// Tìm hàm handleBooking và thay thế nội dung:
const handleBooking = async () => {
    if (!bookingData.value.customerName || !bookingData.value.phone || !bookingData.value.email || !bookingData.value.bookingDate) {
        alert("Vui lòng điền đầy đủ thông tin (Bao gồm cả Email để nhận mã QR)!");
        return;
    }

    const invoiceErr = validateInvoiceInfo();
    if (invoiceErr) {
        alert(invoiceErr);
        return;
    }

    localStorage.setItem('temp_stylist_id', bookingData.value.stylistId || '');
    try {
        const mode = bookingData.value.paymentMode; // "10" hoặc "100"

        // LƯU CÁC THÔNG SỐ QUAN TRỌNG ĐỂ TÍNH TOÁN Ở TRANG SAU
        localStorage.setItem('current_pay_mode', mode);
        localStorage.setItem('total_bill_original', totalBill.value.toString()); // Lưu 500k
        localStorage.setItem('temp_services', JSON.stringify(bookingData.value.selectedServices));
        localStorage.setItem('temp_date', bookingData.value.bookingDate);
        localStorage.setItem('temp_stylist_name', selectedStylist.value?.name || 'LG Stylist');
        localStorage.setItem('temp_email', bookingData.value.email);
        localStorage.setItem('temp_phone', bookingData.value.phone);
        localStorage.setItem('temp_name', bookingData.value.customerName);
        localStorage.setItem('temp_voucher', bookingData.value.voucherIds[0] || '');
        // Lưu thông tin hóa đơn để trang PaymentResult.vue gửi kèm khi lưu booking
        localStorage.setItem('temp_invoice_info', JSON.stringify({
            laDoanhNghiep: invoiceInfo.value.laDoanhNghiep,
            tenCongTy: invoiceInfo.value.laDoanhNghiep ? invoiceInfo.value.tenCongTy : null,
            mst: invoiceInfo.value.laDoanhNghiep ? invoiceInfo.value.mst : null,
            diaChiXuatHD: invoiceInfo.value.diaChiXuatHD,
            emailNhanHD: invoiceInfo.value.emailNhanHD || bookingData.value.email
        }));

        const paymentData = {
            amount: payNow.value, // 50k hoặc 500k
            orderDescription: bookingData.value.paymentMethod === 'vnpay' ? "vnpay" : "momo"
        };

        const response = await axios.post(`${API}/api/DatDichVu/create-payment`, paymentData);
        if (response.data?.url) {
            window.location.href = response.data.url;
        }
    } catch (error) {
        console.error("Lỗi thanh toán:", error);
    }
};
// 1. Chỉ cho chọn từ ngày hiện tại trở đi
const minDate = new Date().toISOString().split('T')[0];


// 2. Tạo danh sách giờ từ 08:00 đến 20:30 (Khớp với ca Sáng, Chiều, Tối)
const availableHours = computed(() => {
    const hours = [];
    for (let i = 8; i <= 20; i++) {
        const hourLabel = i < 10 ? `0${i}:00` : `${i}:00`;
        hours.push(hourLabel);
        // Thêm khung giờ rưỡi (Ví dụ: 08:30, 09:30)
        hours.push(i < 10 ? `0${i}:30` : `${i}:30`);
    }
    return hours;
});

// 3. Gộp ngày và giờ lại để lưu vào bookingData.bookingDate
const combineDateTime = () => {
    if (tempDate.value && tempTime.value) {
        // Kết quả sẽ có dạng: 2024-03-20T07:00
        bookingData.value.bookingDate = `${tempDate.value}T${tempTime.value}`;
    }
};

// 4. Tính toán giờ làm xong dự kiến
// 4. Tính toán giờ làm xong dự kiến
const expectedEndTime = computed(() => {
    if (!tempTime.value || estimatedTotalMinutes.value === 0) return '';

    // Tách giờ và phút khách chọn (Đã thêm = 0 để fix lỗi TypeScript)
    const [hours = 0, minutes = 0] = tempTime.value.split(':').map(Number);

    // Cộng dồn với tổng số phút làm dịch vụ
    const totalMins = hours * 60 + minutes + estimatedTotalMinutes.value;

    // Đổi ngược lại ra Giờ:Phút
    const endHours = Math.floor(totalMins / 60);
    const endMins = totalMins % 60;

    // Format cho đẹp (Thêm số 0 ở trước nếu < 10)
    const hh = endHours < 10 ? `0${endHours}` : endHours;
    const mm = endMins < 10 ? `0${endMins}` : endMins;

    return `${hh}:${mm}`;
});


// 2. HÀM TÌM THỢ (Dùng chuẩn biến bookingData.value.selectedServices của bạn)
const loadAvailableStylists = async () => {
    // Check nếu chưa chọn ngày, giờ hoặc giỏ hàng rỗng thì ngắt
    if (!tempDate.value || !tempTime.value || bookingData.value.selectedServices.length === 0) {
        stylists.value = [];
        return;
    }

    // Tính tổng số phút

    try {
        const res = await axios.post(`${API}/api/DatDichVu/get-available-stylists`, {
            ngayHen: tempDate.value,
            gioBatDau: tempTime.value,
            tongThoiGian: estimatedTotalMinutes.value
        });

        stylists.value = res.data;

        // Cảnh báo nếu thợ đang chọn không còn rảnh
        if (bookingData.value.stylistId && !stylists.value.some(s => s.id === bookingData.value.stylistId)) {
            bookingData.value.stylistId = null;
            console.warn("Stylist bạn chọn đã bận khung giờ này.");
        }
    } catch (e) {
        console.error("Lỗi tải danh sách thợ:", e);
    }
};

// 3. THEO DÕI SỰ THAY ĐỔI ĐỂ TỰ CHẠY
watch(
    [() => tempDate.value, () => tempTime.value, () => bookingData.value.selectedServices.length],
    () => {
        loadAvailableStylists();
    },
    { deep: true }
);

</script>

<template>
    <div class="booking-container">
        <div class="max-w-6xl mx-auto px-4 py-12">
            <div class="text-center mb-12" data-aos="fade-down">
                <h1 class="font-playfair text-black font-black text-5xl">ĐẶT LỊCH HẸN</h1>
                <div class="gold-accent-line mx-auto mt-4"></div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div class="lg:col-span-7 space-y-6" data-aos="fade-right">
                    <div class="glass-card left-main-card">
                        <div class="section-heading-wrapper mt-2">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-user-edit me-2"></i> THÔNG TIN KHÁCH HÀNG
                            </h3>
                            <div class="heading-line"></div>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="custom-label font-bold">Họ và tên *</label>
                                    <input v-model="bookingData.customerName" type="text" class="booking-input w-full"
                                        placeholder="Nguyễn Văn A">
                                </div>

                                <div>
                                    <label class="custom-label font-bold">Số điện thoại *</label>
                                    <input v-model="bookingData.phone" type="tel" class="booking-input w-full"
                                        placeholder="090x xxx xxx">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Email nhận mã QR *</label>
                                    <input v-model="bookingData.email" type="email" class="booking-input w-full"
                                        placeholder="vidu@gmail.com">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Ngày hẹn *</label>
                                    <input v-model="tempDate" type="date" class="booking-input w-full" :min="minDate"
                                        @change="combineDateTime">
                                </div>

                                <div>
                                    <label class="custom-label font-bold">Giờ hẹn *</label>
                                    <select v-model="tempTime" class="booking-input" @change="combineDateTime">
                                        <option value="" disabled>Chọn giờ</option>
                                        <option v-for="h in availableHours" :key="h" :value="h">{{ h }}</option>
                                    </select>
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

                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-file-invoice me-2"></i> HÓA ĐƠN ĐIỆN TỬ
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <p class="text-black small mb-3" style="opacity: 0.6;">
                            Theo quy định, mọi lịch hẹn đều được xuất hóa đơn điện tử. Vui lòng chọn loại hóa đơn phù hợp.
                        </p>
                        <div class="mt-3">
                            <div class="invoice-type-row mb-4">
                                <div class="invoice-type-option" :class="{ active: !invoiceInfo.laDoanhNghiep }"
                                    @click="invoiceInfo.laDoanhNghiep = false">
                                    <i class="fas fa-user me-2"></i> Cá nhân
                                </div>
                                <div class="invoice-type-option" :class="{ active: invoiceInfo.laDoanhNghiep }"
                                    @click="invoiceInfo.laDoanhNghiep = true">
                                    <i class="fas fa-building me-2"></i> Doanh nghiệp (có MST)
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4" v-if="invoiceInfo.laDoanhNghiep">
                                <div>
                                    <label class="custom-label font-bold">Tên công ty *</label>
                                    <input v-model="invoiceInfo.tenCongTy" type="text" class="booking-input w-full"
                                        placeholder="Công ty TNHH ABC">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Mã số thuế *</label>
                                    <input v-model="invoiceInfo.mst" type="text" class="booking-input w-full"
                                        @blur="validateMst" placeholder="0301234567">
                                    <p v-if="mstError" class="text-danger small mt-1 mb-0 font-bold">{{ mstError }}</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="custom-label font-bold">Địa chỉ xuất hóa đơn</label>
                                    <input v-model="invoiceInfo.diaChiXuatHD" type="text" class="booking-input w-full"
                                        placeholder="Số nhà, đường, phường/xã, tỉnh/thành">
                                </div>
                                <div>
                                    <label class="custom-label font-bold">Email nhận hóa đơn</label>
                                    <input v-model="invoiceInfo.emailNhanHD" type="email" class="booking-input w-full"
                                        placeholder="email@example.com">
                                </div>
                            </div>
                        </div>

                        <div class="section-heading-wrapper mt-10">
                            <h3 class="font-playfair section-heading-title font-bold text-black">
                                <i class="fas fa-cut me-2"></i> CHỌN STYLIST
                            </h3>
                            <div class="heading-line"></div>
                        </div>
                        <div class="stylist-flex mt-3">
                            <div v-for="stylist in stylists" :key="stylist.id" class="stylist-card"
                                :class="{ active: bookingData.stylistId === stylist.id }"
                                @click="bookingData.stylistId = stylist.id">
                                <div class="avatar-box">
                                    <img :src="stylist.img.startsWith('http') ? stylist.img : (API + stylist.img)"
                                        alt="Stylist">
                                    <div class="check-badge"><i class="fas fa-check"></i></div>
                                </div>
                                <div class="stylist-meta">
                                    <span class="s-name font-bold">{{ stylist.name }}</span>
                                    <span class="s-role text-black">{{ stylist.role }}</span>

                                    <div class="stylist-rating-badge">
                                        <span class="rating-val">{{ stylist.rating?.toFixed(1) || '5.0' }}</span>
                                        <i class="fas fa-star rating-star-icon"></i>
                                    </div>
                                </div>
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
                        <p class="text-black small mb-3 font-bold">Chọn tối đa 2 mã — thứ tự chọn = thứ tự áp dụng (mã đầu trừ
                            trước).</p>
                        <div class="voucher-list-modern">
                            <div v-for="v in myVouchers" :key="v.id" class="voucher-ticket-item"
                                :class="{ active: bookingData.voucherIds.includes(v.id) }" @click="toggleVoucher(v.id)">

                                <div class="ticket-left">
                                    <i class="fas fa-gift"></i>
                                    <span class="notch top"></span>
                                    <span class="notch bottom"></span>
                                </div>

                                <div class="v-divider"></div>

                                <div class="ticket-right">
                                    <div class="flex justify-between items-start mb-1">
                                        <span class="v-code font-bold">{{ v.code }}</span>
                                        <span class="v-tag-black font-bold">HSD: {{ v.expiry }}</span>
                                    </div>

                                    <div class="v-desc text-black mb-2">{{ v.desc }}</div>

                                    <div class="v-price-black font-bold">Giảm: {{ v.discount.toLocaleString() }}đ</div>
                                </div>

                                <div class="v-check-icon" v-if="bookingData.voucherIds.includes(v.id)">
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
                                <h3 class="font-playfair section-heading-title font-bold text-black">
                                    <i class="fas fa-file-invoice-dollar me-2"></i> CHI TIẾT HÓA ĐƠN
                                </h3>
                                <div class="heading-line mx-auto" style="width: 80px;"></div>
                            </div>

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
                                                <div class="w-10 h-10 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                     <img :src="service.hinhAnh ? (String(service.hinhAnh).startsWith('http') ? service.hinhAnh : API + service.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
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
                                             <div class="w-12 h-12 bg-gray-100 flex-shrink-0 overflow-hidden rounded-md border border-gray-200 mr-3">
                                                 <img :src="s.hinhAnh ? (String(s.hinhAnh).startsWith('http') ? s.hinhAnh : API + s.hinhAnh) : '/images/no-image.png'" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/images/no-image.png'" />
                                             </div>
                                             <div class="item-info">
                                                 <span class="n font-bold">{{ s.name }}</span>
                                                 <div class="flex items-center">
                                                     <span v-if="s.originalPrice && s.originalPrice > s.price"
                                                         class="text-black me-2"
                                                         style="text-decoration: line-through; font-size: 12px;">
                                                         {{ s.originalPrice.toLocaleString() }}đ
                                                     </span>
                                                     <span class="p text-black font-bold">{{ s.price.toLocaleString() }}đ</span>
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
                                    <span style="text-decoration: line-through;">{{ totalOriginalPrice.toLocaleString() }}đ</span>
                                </div>

                                <div class="summary-line saving text-success" v-if="totalOriginalPrice > subTotal">
                                    <span>Flash Sale dịch vụ:</span>
                                    <span>-{{ (totalOriginalPrice - subTotal).toLocaleString() }}đ</span>
                                </div>

                                <div class="summary-line" v-if="totalOriginalPrice === subTotal">
                                    <span>Tạm tính:</span>
                                    <span>{{ subTotal.toLocaleString() }}đ</span>
                                </div>

                                <div v-if="bookingData.voucherIds.length" class="summary-line saving text-success">
                                    <span>Voucher giảm giá:</span>
                                    <span class="font-bold">-{{ discountAmount.toLocaleString() }}đ</span>
                                </div>
                                <div v-if="bookingData.voucherIds.length" class="summary-line small text-black font-bold">
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
                                        <span class="total-val-standard font-bold text-black">{{ totalBill.toLocaleString() }}đ</span>
                                    </div>

                                    <div class="mt-2 text-xs text-gray-500" v-if="bookingData.paymentMode === '10'">
                                        <div class="flex justify-between py-0.5">
                                            <span>+ Tiền cọc dịch vụ (10%):</span>
                                            <span>{{ (totalBill * 0.1).toLocaleString() }}đ</span>
                                        </div>
                                    </div>

                                    <div class="pay-now-alert mt-3">
                                        <span>THANH TOÁN NGAY:</span>
                                        <span>{{ payNow.toLocaleString() }}đ</span>
                                    </div>

                                    <div class="summary-line mt-2" style="color: #e53e3e; font-weight: 600;" v-if="bookingData.paymentMode === '10' && totalBill > payNow">
                                        <span style="color: #e53e3e;">Còn lại trả tại tiệm:</span>
                                        <span class="font-bold" style="color: #e53e3e;">{{ (totalBill - payNow).toLocaleString() }}đ</span>
                                    </div>
                                </div>
                            </div>

                            <button class="btn-confirm-metallic-final mt-4" @click="handleBooking">
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
    --gold-metallic: linear-gradient(135deg, #a88b58 0%, #bfa77a 50%, #d8c39e 100%);
    --gold-solid: #bfa77a;
    --gold-hover: #a88b58;
    --gold-light: #fbfaf7;
    --text-primary: #111827;
    --text-secondary: #4b5563;
    --text-muted: #9ca3af;
    --border-color: #f3f4f6;
    
    background-color: #fbfbfd;
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
    background: radial-gradient(circle, rgba(191, 167, 122, 0.04) 0%, rgba(255,255,255,0) 70%);
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
    background: radial-gradient(circle, rgba(191, 167, 122, 0.03) 0%, rgba(255,255,255,0) 70%);
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
    height: 3px;
    background: var(--gold-metallic);
    margin: 15px auto;
    border-radius: 2px;
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

/* Main Cards - Premium Glassmorphism style */
.glass-card {
    background: #ffffff;
    padding: 32px;
    border-radius: 16px;
    border: 1px solid rgba(229, 231, 235, 0.7);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.015);
    transition: all 0.3s ease;
}

.left-main-card:hover, .bill-card:hover {
    box-shadow: 0 10px 40px rgba(191, 167, 122, 0.04);
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
    border-radius: 8px;
    border: 1px solid #e5e7eb;
    background: #fcfcfd;
    outline: none;
    font-size: 14px;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.booking-input:focus {
    border-color: var(--gold-solid);
    box-shadow: 0 0 0 3px rgba(191, 167, 122, 0.12);
    background: #ffffff;
}

select.booking-input {
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23bfa77a' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5'/%3E%3C/svg%3E");
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

/* Stylist Selection Carousel */
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
    border: 1px solid #f3f4f6;
    border-radius: 12px;
    padding: 16px 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.01);
}

.stylist-card:hover {
    transform: translateY(-4px);
    border-color: rgba(191, 167, 122, 0.3);
    box-shadow: 0 6px 16px rgba(191, 167, 122, 0.06);
}

.stylist-card.active {
    border-color: var(--gold-solid);
    background: var(--gold-light);
    box-shadow: 0 6px 20px rgba(191, 167, 122, 0.15);
}

.avatar-box {
    position: relative;
    width: 68px;
    height: 68px;
    margin: 0 auto 10px;
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
    border: 1px solid #f3f4f6;
    padding: 2px 6px;
    border-radius: 12px;
    margin-top: 4px;
}

.stylist-card.active .stylist-rating-badge {
    background: #ffffff;
    border-color: rgba(191, 167, 122, 0.2);
}

.rating-val {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-primary);
    margin-right: 2px;
}

.rating-star-icon {
    font-size: 9px;
    color: #f59e0b;
}

/* Payment Methods */
/* Payment Methods */
.payment-method-row {
    display: flex;
    gap: 16px;
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
    overflow: hidden;
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
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(0, 106, 194, 0.12);
    border-width: 3px;
    transform: scale(1.02);
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
    background-color: #ffffff;
    box-shadow: 0 8px 20px rgba(216, 45, 139, 0.12);
    border-width: 3px;
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

/* Invoice / Hóa đơn điện tử */
.invoice-type-row {
    display: flex;
    gap: 12px;
}

.invoice-type-option {
    flex: 1;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 10px 14px;
    text-align: center;
    font-weight: 700;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.25s ease;
    background: #ffffff;
}

.invoice-type-option:hover {
    border-color: var(--gold-solid);
}

.invoice-type-option.active {
    border-color: var(--gold-solid);
    background: var(--gold-light);
    color: var(--text-primary);
    box-shadow: 0 4px 14px rgba(191, 167, 122, 0.15);
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
    border: 1px dashed #d1d5db;
    border-radius: 12px;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: all 0.3s ease;
}

.voucher-ticket-item:hover {
    border-color: var(--gold-solid);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.voucher-ticket-item.active {
    border: 1px solid var(--gold-solid);
    background: var(--gold-light);
    box-shadow: 0 6px 16px rgba(191, 167, 122, 0.12);
}

.ticket-left {
    background: var(--gold-metallic);
    width: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #ffffff;
    position: relative;
    flex-shrink: 0;
}

.ticket-left i {
    font-size: 16px;
}

.notch {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #fbfbfd; /* Match container background to make punch out effect */
    border-radius: 50%;
    left: -6px;
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
    border-left: 2px dashed #e5e7eb;
    height: 60%;
    align-self: center;
    margin: 0 4px;
}

.ticket-right {
    padding: 14px 16px;
    flex: 1;
    display: flex;
    flex-direction: column;
}

.v-code {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: 0.5px;
}

.v-tag-black {
    font-size: 9px;
    font-weight: 600;
    color: var(--gold-solid);
    background: #fdfaf3;
    padding: 2px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border: 1px solid rgba(191, 167, 122, 0.15);
}

.v-desc {
    font-size: 11px;
    color: var(--text-secondary);
    margin-top: 4px;
    line-height: 1.4;
}

.v-price-black {
    font-size: 13px;
    font-weight: 700;
    color: var(--gold-solid);
    margin-top: 6px;
}

.v-check-icon {
    position: absolute;
    top: 14px;
    right: 14px;
    color: var(--gold-solid);
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
    border-radius: 10px;
    margin-bottom: 8px;
    border: 1px solid #f3f4f6;
    transition: all 0.3s ease;
}

.item-row:hover {
    border-color: rgba(191, 167, 122, 0.2);
    background: #ffffff;
}

.item-row img {
    border-radius: 6px;
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

/* Payment deposit selectors */
.payment-mode-select {
    margin-top: 20px;
    padding-top: 16px;
    border-top: 1px solid #f3f4f6;
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
    color: var(--gold-solid);
}

.pay-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pay-btn {
    border: 1px solid #e5e7eb;
    padding: 12px 14px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 0.3s ease;
    background: #ffffff;
    font-size: 13px;
    color: var(--text-secondary);
}

.pay-btn:hover {
    border-color: rgba(191, 167, 122, 0.4);
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

/* Bill Summary area */
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

.discount-red {
    color: #ef4444 !important;
}

.discount-red span:last-child {
    color: #ef4444 !important;
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

/* Premium Confirmation Button */
.btn-confirm-metallic-final {
    width: 100%;
    padding: 16px;
    border: none;
    border-radius: 8px;
    background: var(--gold-metallic);
    color: #ffffff !important;
    text-transform: uppercase;
    letter-spacing: 1px;
    font-weight: 700;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 4px 14px rgba(191, 167, 122, 0.3);
}

.btn-confirm-metallic-final:hover {
    background: var(--text-primary);
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.btn-text-normal {
    font-family: inherit !important;
    font-weight: 700 !important;
    font-size: 14px !important;
    color: #ffffff !important;
    letter-spacing: 1px !important;
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