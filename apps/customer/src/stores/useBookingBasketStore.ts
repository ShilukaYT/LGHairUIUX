import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useRouter } from 'vue-router';
import { showToast } from '@/stores/useWishlistStore';
import { getProductCartDB } from '@/Views/Anonymous/CSDL/cartDB';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';

// =====================================================================
// BOOKING BASKET STORE
// Quản lý "Khay Dịch Vụ" — hoàn toàn tách biệt khỏi Giỏ Hàng (Cart).
// Dữ liệu chỉ sống ở client-side (Pinia + localStorage).
// Khi bấm "Tiếp tục đặt lịch", store đẩy dữ liệu vào localStorage
// theo đúng format mà Datdichvu.vue đang đọc, rồi chuyển trang.
// =====================================================================

const STORAGE_KEY = 'booking_basket_items';
const MAX_ITEMS = 5;

export interface BookingItem {
    id: string | number;
    tenItem: string;
    gia: number;
    giaGoc?: number;
    duration: number;
    hinhAnh?: string;
    type: 'DICHVU' | 'COMBO';
}

/**
 * Đọc danh sách dịch vụ đã lưu từ localStorage.
 * Trả về mảng rỗng nếu chưa có hoặc dữ liệu bị lỗi.
 */
function loadFromStorage(): BookingItem[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Ghi danh sách dịch vụ xuống localStorage.
 */
function saveToStorage(items: BookingItem[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const useBookingBasketStore = defineStore('bookingBasket', () => {
    // ─── State ───────────────────────────────────────────────
    const items = ref<BookingItem[]>(loadFromStorage());
    const isDrawerOpen = ref(false);
    const showCheckoutOptionModal = ref(false);
    const isProceeding = ref(false);

    // ─── Getters ─────────────────────────────────────────────
    const itemCount = computed(() => items.value.length);

    const totalPrice = computed(() =>
        items.value.reduce((sum, item) => sum + Number(item.gia || 0), 0)
    );

    const totalOriginalPrice = computed(() =>
        items.value.reduce((sum, item) => sum + Number(item.giaGoc || item.gia || 0), 0)
    );

    const totalDuration = computed(() =>
        items.value.reduce((sum, item) => sum + Number(item.duration || 30), 0)
    );

    const isEmpty = computed(() => items.value.length === 0);

    function hasItem(id: string | number): boolean {
        return items.value.some(item => String(item.id) === String(id));
    }

    // ─── Actions ─────────────────────────────────────────────

    function addItem(rawItem: any) {
        // Chặn trùng lặp
        const itemId = rawItem.id || rawItem.maDv || rawItem.maCb;
        if (hasItem(itemId)) {
            showToast('Dịch vụ này đã có trong khay đặt lịch', 'info');
            return;
        }

        // Giới hạn số lượng
        if (items.value.length >= MAX_ITEMS) {
            showToast(`Tối đa ${MAX_ITEMS} dịch vụ trong một lần đặt lịch`, 'warning');
            return;
        }

        const isCombo = !!(rawItem.maCb || rawItem.type === 'COMBO');

        // Tính giá final (nếu có Flash Sale)
        const giaGoc = Number(rawItem.gia || rawItem.price || 0);
        let finalPrice = giaGoc;
        if (rawItem.flashSale && rawItem.flashSale.phanTramGiam) {
            finalPrice = giaGoc - (giaGoc * rawItem.flashSale.phanTramGiam) / 100;
        }

        const newItem: BookingItem = {
            id: itemId,
            tenItem: isCombo
                ? (rawItem.tenCombo || rawItem.tenItem || rawItem.name || 'Combo')
                : (rawItem.tenDv || rawItem.tenItem || rawItem.name || 'Dịch vụ'),
            gia: finalPrice,
            giaGoc: giaGoc,
            duration: isCombo
                ? (rawItem.combo_DichVus?.reduce(
                    (sum: number, cd: any) => sum + (cd.dichVu?.thoiGianLam || 30), 0
                  ) || rawItem.duration || rawItem.thoiGianLam || 60)
                : (rawItem.thoiGianLam || rawItem.duration || 30),
            hinhAnh: rawItem.hinhAnh || rawItem.image || '',
            type: isCombo ? 'COMBO' : 'DICHVU',
        };

        items.value.push(newItem);
        showToast('Đã thêm vào khay đặt lịch', 'success');
    }

    function removeItem(id: string | number) {
        items.value = items.value.filter(item => String(item.id) !== String(id));
    }

    function clearAll() {
        items.value = [];
    }

    // ─── Drawer Controls ─────────────────────────────────────
    function openDrawer() {
        isDrawerOpen.value = true;
    }

    function closeDrawer() {
        isDrawerOpen.value = false;
    }

    function toggleDrawer() {
        isDrawerOpen.value = !isDrawerOpen.value;
    }

    async function proceedToBooking(router: ReturnType<typeof useRouter>) {
        if (isEmpty.value) {
            showToast('Vui lòng chọn ít nhất 1 dịch vụ', 'warning');
            return;
        }

        isProceeding.value = true;
        try {
            const maKH = getCustomerInfo().maKH;
            let productsInCart = [];
            
            try {
                productsInCart = await getProductCartDB(maKH);
            } catch (error) {
                console.error("Lỗi khi lấy giỏ hàng sản phẩm:", error);
            }
            
            const hasProducts = productsInCart && productsInCart.length > 0;

            if (hasProducts) {
                showCheckoutOptionModal.value = true;
            } else {
                await processCheckoutOption('CHI_DAT_LICH', router);
            }
        } finally {
            isProceeding.value = false;
        }
    }

    async function processCheckoutOption(loaiCheckout: string, router: ReturnType<typeof useRouter>) {
        isProceeding.value = true;
        try {
            const maKH = getCustomerInfo().maKH;
            let productsInCart: any[] = [];
            
            if (loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') {
                try {
                    productsInCart = await getProductCartDB(maKH);
                } catch (error) {
                    console.error("Lỗi khi lấy giỏ hàng sản phẩm:", error);
                }
            }

            const payload = {
                maKH: maKH || "GUEST",
                loaiCheckout: loaiCheckout,
                dichVuItems: items.value.map(item => ({
                    id: item.id,
                    tenItem: item.tenItem,
                    gia: item.gia,
                    giaGoc: item.giaGoc || item.gia,
                    hinhAnh: item.hinhAnh,
                    duration: item.duration,
                })),
                sanPhamItems: productsInCart,
                tongDichVu: totalPrice.value,
                tongSanPham: productsInCart.reduce((sum: number, p: any) => sum + (Number(p.gia || 0) * Number(p.soLuong || 1)), 0)
            };

            localStorage.setItem('checkoutData', JSON.stringify(payload));
            
            showCheckoutOptionModal.value = false;
            closeDrawer();
            
            if (loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') {
                router.push('/thanh-toan-tong');
            } else {
                router.push('/dat-dich-vu');
            }
        } finally {
            isProceeding.value = false;
        }
    }

    // ─── Auto-persist to localStorage ────────────────────────
    watch(items, (newItems) => {
        saveToStorage(newItems);
        // Dispatch event để Header badge có thể cập nhật
        window.dispatchEvent(new Event('booking-basket-updated'));
    }, { deep: true });

    return {
        // State
        items,
        isDrawerOpen,
        showCheckoutOptionModal,
        isProceeding,

        // Getters
        itemCount,
        totalPrice,
        totalOriginalPrice,
        totalDuration,
        isEmpty,
        hasItem,

        // Actions
        addItem,
        removeItem,
        clearAll,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        proceedToBooking,
        processCheckoutOption,
    };
});
