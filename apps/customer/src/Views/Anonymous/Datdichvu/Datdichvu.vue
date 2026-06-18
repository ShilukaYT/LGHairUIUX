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
    localStorage.setItem('temp_stylist_id', bookingData.value.stylistId || '');
    try {
        const mode = bookingData.value.paymentMode; // "10" hoặc "100"

        // LƯU CÁC THÔNG SỐ QUAN TRỌNG ĐỂ TÍNH TOÁN Ở TRANG SAU
        localStorage.setItem('current_pay_mode', mode);
        localStorage.setItem('total_bill_original', totalBill.value.toString()); // Lưu 500k
        localStorage.setItem('temp_services', JSON.stringify(bookingData.value.selectedServices));
        localStorage.setItem('temp_date', bookingData.value.bookingDate);
        localStorage.setItem('temp_stylist_name', selectedStylist.value?.name || 'Minh Tâm Stylist');
        localStorage.setItem('temp_email', bookingData.value.email);
        localStorage.setItem('temp_phone', bookingData.value.phone);
        localStorage.setItem('temp_name', bookingData.value.customerName);
        localStorage.setItem('temp_voucher', bookingData.value.voucherIds[0] || '');

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

                                    <div class="mt-1 flex items-center justify-center"
                                        style="background: #f3f4f6; padding: 2px 8px; border-radius: 20px; border: 1px solid #e5e7eb;">
                                        <span class="font-bold me-1" style="font-size: 12px; color: #000;">{{
                                            stylist.rating?.toFixed(1) || '5.0' }}</span>
                                        <i class="fas fa-star" style="font-size: 10px; color: #4b5563;"></i>
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
                            <div class="method-option" :class="{ active: bookingData.paymentMethod === 'vnpay' }"
                                @click="bookingData.paymentMethod = 'vnpay'">
                                <span class="radio-dot"></span>
                                <span class="method-label font-bold">Vnpay</span>
                            </div>
                            <div class="method-option" :class="{ active: bookingData.paymentMethod === 'momo' }"
                                @click="bookingData.paymentMethod = 'momo'">
                                <span class="radio-dot"></span>
                                <span class="method-label font-bold">MoMo</span>
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

                            <div class="bill-summary border-top pt-4 mt-3">
                                <div v-if="selectedStylist" class="summary-line">
                                    <span class="font-bold">Nhân Viên STYLIST:</span>
                                    <span class="text-black font-bold">{{ selectedStylist.name }}</span>
                                </div>

                                <div class="summary-line" v-if="totalOriginalPrice > subTotal">
                                    <span class="font-bold">Tổng giá gốc:</span>
                                    <span class="text-black" style="text-decoration: line-through;">
                                        {{ totalOriginalPrice.toLocaleString() }}đ
                                    </span>
                                </div>

                                <div class="summary-line text-success" v-if="totalOriginalPrice > subTotal">
                                    <span class="font-bold">Tiết kiệm được (Flash Sale):</span>
                                    <span class="font-bold">-{{ (totalOriginalPrice - subTotal).toLocaleString()
                                    }}đ</span>
                                </div>

                                <div class="summary-line" v-if="totalOriginalPrice === subTotal">
                                    <span class="font-bold">Tạm tính:</span>
                                    <span class="font-bold">{{ subTotal.toLocaleString() }}đ</span>
                                </div>

                                <div v-if="bookingData.voucherIds.length" class="summary-line discount-red">
                                    <span class="font-bold">Giảm giá Voucher:</span>
                                    <span class="font-bold">-{{ discountAmount.toLocaleString() }}đ</span>
                                </div>
                                <div v-if="bookingData.voucherIds.length" class="summary-line small text-black font-bold">
                                    <span>Mã áp dụng: {{ bookingData.voucherIds.join(' → ') }}</span>
                                </div>

                                <div class="total-line-final mt-4">
                                    <div class="flex justify-between items-center">
                                        <span class="total-lbl font-bold">TỔNG TIỀN:</span>
                                        <span class="total-val-standard font-bold text-black">{{
                                            totalBill.toLocaleString() }}đ</span>
                                    </div>
                                    <div class="pay-now-alert flex justify-between items-center mt-3">
                                        <span class="font-bold small">THANH TOÁN NGAY:</span>
                                        <span class="font-bold text-success" style="font-size: 1.4rem;">{{
                                            payNow.toLocaleString() }}đ</span>
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
    /* Nếu muốn icon cũng có màu vàng ánh kim thì dùng dòng dưới, không thì giữ nguyên text-black */
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
    font-family: Arial, Helvetica, sans-serif !important;
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
    width: 18px;
    height: 18px;
    border: 1px solid rgba(191, 155, 48, 0.26);
    border-radius: 50%;
    margin-right: 12px;
    position: relative;
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
.v-tag-black {
    font-size: 11px;
    color: #000;
    /* Màu vàng sẫm để dễ đọc trên nền trắng */
    background: #f3f4f6;
    padding: 2px 8px;
    border-radius: 4px;
}

/* 2. Màu cho Giá tiền (Gold Metallic nổi bật nhất) */
.v-price-black {
    font-size: 16px;
    /* Hiệu ứng màu vàng ánh kim giống dự án của bạn */
    background: #000;
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

.summary-line {
    display: flex;
    justify-content: space-between;
    margin-bottom: 10px;
    font-size: 14px;
}

.discount-red {
    color: #d93025 !important;
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
    font-family: Arial, Helvetica, sans-serif !important;
    font-weight: 800 !important;
    font-size: 18px !important;
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
    border: 1px solid rgba(212, 175, 55, 0.15);
}
.section-card:hover {
    box-shadow: 0 10px 30px rgba(212, 175, 55, 0.15);
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
</style>