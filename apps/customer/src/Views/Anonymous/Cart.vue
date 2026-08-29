<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24 bg-gray-50">
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-12 lg:pt-20">
      
      <!-- HEADER -->
      <div class="mb-10 text-center">
        <h1 class="font-heading text-3xl md:text-4xl font-bold uppercase tracking-widest text-gray-900 mb-2">Giỏ Hàng</h1>
        <div class="w-16 h-1 bg-black mx-auto mb-4"></div>
        <p class="text-gray-600 text-sm md:text-base">Bạn đang có <span class="font-bold text-black">{{ cartItems.length }}</span> sản phẩm</p>
      </div>

      <div class="flex flex-col xl:flex-row gap-10 xl:gap-16">
        
        <!-- Cart Items List -->
        <div class="flex-1 flex flex-col bg-white p-6 md:p-10 shadow-sm rounded-xl border border-gray-100">

          <!-- BANNER HẾT HẠN PHIÊN ĐĂNG NHẬP -->
          <div v-if="isSessionExpired" class="mb-6 p-4 rounded-xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-amber-50/60 shadow-sm transition-all duration-300">
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
                              Đăng nhập lại để tự động đồng bộ giỏ hàng với tài khoản của bạn, giữ nguyên các sản phẩm đã lưu và tích điểm thành viên.
                          </p>
                          <div class="mt-3 flex flex-wrap items-center gap-3">
                              <router-link :to="{ name: 'login', query: { redirect: '/cart' } }" class="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                                  <i class="fas fa-sign-in-alt text-[9px]"></i> Đăng Nhập Lại
                              </router-link>
                              <button type="button" @click="isSessionExpired = false" class="text-xs text-amber-900/80 hover:text-black font-medium underline underline-offset-4 transition-colors">
                                  Tiếp tục với giỏ hàng khách
                              </button>
                          </div>
                      </div>
                  </div>
                  <button type="button" @click="isSessionExpired = false" class="text-amber-400 hover:text-amber-800 text-sm p-1 transition-colors" title="Đóng thông báo">
                      <i class="fas fa-times"></i>
                  </button>
              </div>
          </div>

          <!-- GỢI Ý ĐĂNG NHẬP ĐỒNG BỘ GIỎ HÀNG CHO KHÁCH -->
          <div v-else-if="!isLoggedIn" class="mb-6 p-4 rounded-xl border border-gray-200/80 bg-gradient-to-r from-zinc-50 via-white to-gray-50/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-all duration-300">
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
                          Đăng nhập để đồng bộ và lưu trữ giỏ hàng vĩnh viễn trên tài khoản của bạn, tích điểm thưởng khi thanh toán.
                      </p>
                  </div>
              </div>
              <router-link :to="{ name: 'login', query: { redirect: '/cart' } }" class="self-start sm:self-center flex-shrink-0 px-4 py-2 bg-black text-white text-[10px] uppercase tracking-[0.15em] font-medium hover:bg-gray-800 transition-all rounded shadow-sm">
                  Đăng Nhập
              </router-link>
          </div>

          <div v-if="cartItems.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
             <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <i class="fas fa-shopping-bag text-4xl text-gray-400"></i>
             </div>
             <p class="text-gray-900 font-bold uppercase tracking-widest text-lg mb-2">Giỏ hàng đang trống</p>
             <p class="text-gray-500 mb-8">Hãy chọn thêm sản phẩm nhé!</p>
             <button @click="router.push({ name: 'shop' })" class="bg-black text-white px-8 py-3 font-semibold uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors rounded">
               Tiếp tục mua sắm
             </button>
          </div>

          <template v-else>
            <!-- Table Header (hidden on mobile) -->
            <div class="hidden md:grid grid-cols-[3fr_1fr_1fr_auto] gap-6 border-b border-gray-200 pb-4 mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span>Sản phẩm</span>
              <span class="text-center">Số lượng</span>
              <span class="text-right">Giá</span>
              <span class="w-10"></span>
            </div>

            <!-- Items -->
            <div class="flex flex-col gap-6">
              <div v-for="item in cartItems" :key="item.id"
                class="flex flex-col md:grid gap-6 items-center border border-gray-100 md:border-none md:border-b p-4 md:p-0 md:py-6 rounded-lg md:rounded-none bg-white hover:bg-gray-50 transition-colors group md:grid-cols-[3fr_1fr_1fr_auto]"
              >
                <!-- Info -->
                <div class="flex items-center gap-6 w-full">
                  <div class="w-24 h-24 md:w-28 md:h-28 bg-gray-100 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-gray-200">
                    <img :src="getImageUrl(item.hinhAnh)" :alt="item.tenItem" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex flex-col flex-1">
                    <h3 class="font-heading text-base md:text-lg font-bold text-gray-900 mb-1 cursor-pointer hover:text-gray-600 transition-colors line-clamp-2">{{ item.tenItem }}</h3>
                    
                    <div class="md:hidden flex items-center gap-2 mt-2">
                        <span v-if="item.giaGoc && item.giaGoc > item.gia" class="text-xs text-gray-400 line-through">
                            {{ formatMoney(item.giaGoc) }}
                        </span>
                        <p class="text-lg font-bold text-black">{{ formatMoney(item.gia) }}</p>
                    </div>
                    <!-- Chỉ hiển thị Còn lại (Tồn kho) cho Sản phẩm -->
                    <div v-if="item.soLuongTon !== undefined" class="mt-1">
                        <span class="text-[11px] font-bold uppercase tracking-widest px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            Còn lại: {{ item.soLuongTon }}
                        </span>
                    </div>
                  </div>
                </div>

                <!-- Cột giữa (Desktop): Số lượng (+/-) cho Sản phẩm -->
                <div class="hidden md:flex justify-center w-full">
                  <div class="flex items-center border-2 border-gray-200 rounded-md bg-white">
                    <button @click="decreaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus :size="16" /></button>
                    <input 
                      type="number" 
                      v-model.number="item.soLuong" 
                      @change="onQuantityChange(item)"
                      @blur="onQuantityBlur(item)"
                      class="w-10 text-center font-bold text-sm outline-none bg-transparent hide-arrows" 
                      min="1"
                    />
                    <button @click="increaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus :size="16" /></button>
                  </div>
                </div>

                <!-- Số lượng (mobile) -->
                <div class="md:hidden w-full flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                  <span class="text-xs font-bold uppercase tracking-widest text-gray-500">Số lượng</span>
                  <div class="flex items-center border-2 border-gray-200 rounded-md bg-white">
                    <button @click="decreaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus :size="16" /></button>
                    <input 
                      type="number" 
                      v-model.number="item.soLuong" 
                      @change="onQuantityChange(item)"
                      @blur="onQuantityBlur(item)"
                      class="w-10 text-center font-bold text-sm outline-none bg-transparent hide-arrows" 
                      min="1"
                    />
                    <button @click="increaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus :size="16" /></button>
                  </div>
                </div>

                <!-- Giá (desktop) -->
                <div class="hidden md:flex flex-col items-end justify-center text-right w-full">
                  <span v-if="item.giaGoc && item.giaGoc > item.gia" class="text-xs text-gray-400 line-through mb-1">
                    {{ formatMoney((item.giaGoc || 0) * (item.soLuong || 1)) }}
                  </span>
                  <span class="text-lg font-bold text-black">
                    {{ formatMoney((item.gia || 0) * (item.soLuong || 1)) }}
                  </span>
                </div>

                <!-- Xóa (desktop) -->
                <div class="hidden md:flex justify-end w-10">
                  <button @click="removeItem(item)" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 transition-all shadow-sm bg-white border border-gray-200 hover:border-red-500">
                    <X :size="18" :stroke-width="2" />
                  </button>
                </div>
                
                <!-- Xóa (mobile) -->
                <button @click="removeItem(item)" class="md:hidden w-full bg-red-50 text-red-600 font-bold text-xs uppercase tracking-widest text-center py-3 rounded-md mt-2 hover:bg-red-500 hover:text-white transition-colors">
                  <i class="fas fa-trash-alt me-2"></i> Xóa khỏi giỏ
                </button>
              </div>
            </div>
            
            <div class="mt-10 flex flex-col sm:flex-row justify-between items-center gap-4 border-t-2 border-gray-100 pt-6">
              <button @click="router.push({ name: 'shop' })" class="text-sm font-bold uppercase tracking-wider text-gray-600 hover:text-black transition-colors flex items-center gap-2">
                 <i class="fas fa-arrow-left"></i> Tiếp tục mua sắm
              </button>
              <button @click="clearCart" class="text-sm font-bold uppercase tracking-wider text-red-500 hover:text-white hover:bg-red-600 border border-red-500 hover:border-red-600 transition-colors px-6 py-2 rounded-md flex items-center gap-2">
                 <i class="fas fa-trash"></i> Xóa tất cả
              </button>
            </div>
          </template>
        </div>

        <!-- Order Summary -->
        <div class="w-full xl:w-[450px] flex-shrink-0">
          <div class="bg-white border-2 border-gray-900 rounded-xl p-8 md:p-10 shadow-lg sticky top-24">
            <h2 class="font-heading text-2xl font-bold uppercase tracking-widest mb-6 border-b-2 border-gray-100 pb-4 text-black">Tổng Đơn Hàng</h2>
            
            <div class="flex flex-col gap-5 text-base mb-8">
              <!-- Mục sản phẩm -->
              <div v-if="totalProduct > 0" class="flex justify-between items-center">
                <span class="text-gray-600 font-medium">Tổng sản phẩm</span>
                <span class="font-bold text-gray-900">{{ formatMoney(totalProduct) }}</span>
              </div>
              <div v-if="totalSavings > 0" class="flex justify-between items-center">
                <span class="text-green-600 font-medium">Tiết kiệm được (Flash Sale)</span>
                <span class="font-bold text-green-600">-{{ formatMoney(totalSavings) }}</span>
              </div>
              <div class="flex justify-between items-center pt-6 border-t-2 border-gray-100 mt-2">
                <span class="font-bold text-black uppercase tracking-widest text-lg">Tổng cộng</span>
                <span class="font-black text-black text-2xl md:text-3xl">{{ formatMoney(totalAmount) }}</span>
              </div>
            </div>

            <button :disabled="cartItems.length === 0" @click="handleCheckoutBtnClick" class="w-full bg-black text-white px-8 py-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-md hover:shadow-lg">
              <span class="mr-3">Mua sản phẩm</span> 
              <ArrowRight :size="18" class="group-hover:translate-x-2 transition-transform" />
            </button>

            <div class="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p class="text-xs text-gray-500 text-center font-medium uppercase tracking-widest leading-relaxed">
                <i class="fas fa-shield-alt text-gray-400 text-lg mb-2 block"></i>
                Thanh toán an toàn & Bảo mật.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { X, Minus, Plus, ArrowRight, Clock } from 'lucide-vue-next';
import axios from 'axios';
import {
    getProductCartDB,
    removeFromCartDB,
    clearCartDB,
    addToCartDB,
    updateCartItemDB
} from "@/Views/Anonymous/CSDL/cartDB";
import { useRouter } from "vue-router";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useAuthStore } from "@/stores/useAuthStore";

const router = useRouter();

interface CartItem {
    id: string | number;
    maKH: string;
    type?: "SANPHAM" | "BIENTHE";
    tenItem: string;
    gia: number;
    giaGoc?: number;
    phanTramGiam?: number;
    hinhAnh?: string;
    soLuong?: number;
    soLuongTon?: number;
}

const cartItems = ref<CartItem[]>([]);
const isOpen = ref(false);
const activeTab = ref<"service" | "product">("service");
const authStore = useAuthStore();
const isSessionExpired = computed({
    get: () => authStore.sessionExpiredBanner,
    set: (val: boolean) => authStore.setSessionExpiredBanner(val)
});
const isLoggedIn = ref(false);
const defaultImage = "/images/no-image.png";
let stockPollingTimer: any = null;

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const getImageUrl = (url: string | undefined | null) => {
    if (!url) return defaultImage;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/images/') && !url.includes('upload')) return url;
    return `${API}${url.startsWith('/') ? '' : '/'}${url}`;
};

const loadCart = async () => {
    const maKH = getCustomerInfo().maKH;
    // Chỉ lấy sản phẩm
    cartItems.value = await getProductCartDB(maKH);
};

const checkAndSyncCustomerSession = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (token || savedUser) {
        try {
            const res = await axios.get(`${API}/api/account/get-profile`, { withCredentials: true });
            if (res.data?.success && res.data?.user) {
                isLoggedIn.value = true;
                isSessionExpired.value = false;
            }
        } catch (err: any) {
            console.warn('Lỗi xác thực phiên tại giỏ hàng:', err);
            if (err.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                localStorage.removeItem('access_token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('refresh_token');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                isLoggedIn.value = false;
                isSessionExpired.value = true;

                window.dispatchEvent(new Event('user-updated'));
            }
        }
    } else {
        isLoggedIn.value = false;
    }
    await loadCart();
};

const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        checkAndSyncCustomerSession();
    }
};

onMounted(async () => {
    // Tự động mở giỏ hàng khi người dùng truy cập vào trang /cart
    isOpen.value = true;

    // Kiểm tra trạng thái phiên làm việc và nạp giỏ hàng
    await checkAndSyncCustomerSession();

    // Đăng ký các sự kiện phản ứng nhanh
    window.addEventListener('user-updated', checkAndSyncCustomerSession);
    window.addEventListener('storage', checkAndSyncCustomerSession);
    window.addEventListener('focus', checkAndSyncCustomerSession);
    document.addEventListener('visibilitychange', onVisibilityChange);
    
    // Polling 15 giây để tự động cập nhật số lượng tồn kho
    stockPollingTimer = setInterval(async () => {
        try {
            const maKH = getCustomerInfo().maKH;
            const data = await getProductCartDB(maKH);
            if (data && Array.isArray(data)) {
                data.forEach((serverItem: any) => {
                    const localItem = cartItems.value.find(i => i.id === serverItem.id);
                    if (localItem && serverItem.soLuongTon !== undefined) {
                        localItem.soLuongTon = serverItem.soLuongTon;
                        if (localItem.soLuong && localItem.soLuongTon !== undefined && localItem.soLuong > localItem.soLuongTon) {
                            localItem.soLuong = localItem.soLuongTon;
                        }
                    }
                });
            }
        } catch (error) {
            // Im lặng bỏ qua lỗi polling
        }
    }, 15000);
});

onUnmounted(() => {
    if (stockPollingTimer) clearInterval(stockPollingTimer);
    window.removeEventListener('user-updated', checkAndSyncCustomerSession);
    window.removeEventListener('storage', checkAndSyncCustomerSession);
    window.removeEventListener('focus', checkAndSyncCustomerSession);
    document.removeEventListener('visibilitychange', onVisibilityChange);
});

const totalProduct = computed(() => {
    return cartItems.value.reduce((sum, item) => {
        return sum + Number(item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
});

const totalAmount = computed(() => totalProduct.value);

const totalOriginalProduct = computed(() => {
    return cartItems.value.reduce((sum, item) => {
        return sum + Number(item.giaGoc || item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
});

const totalSavings = computed(() => Math.max(0, totalOriginalProduct.value - totalAmount.value));

const formatMoney = (money: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(money || 0);
};

const removeItem = async (item: CartItem) => {
    const backendLoai = item.type || 'SANPHAM';
    await removeFromCartDB(item.id, backendLoai);
    await loadCart();
};

const increaseQuantity = async (item: CartItem) => {
    if (item.soLuongTon !== undefined) {
        if (Number(item.soLuong || 1) >= item.soLuongTon) {
            import('sweetalert2').then((Swal) => {
                Swal.default.fire({
                    icon: 'warning',
                    title: 'Vượt quá số lượng',
                    text: `Sản phẩm này chỉ còn ${item.soLuongTon} sản phẩm trong kho!`,
                    confirmButtonColor: '#000'
                });
            });
            return;
        }
    }

    item.soLuong = Number(item.soLuong || 1) + 1;
    try {
        await updateCartItemDB(item as any);
    } catch (error) {
        await loadCart();
    } 
};

const decreaseQuantity = async (item: CartItem) => {
    const currentQuantity = Number(item.soLuong || 1);
    if (currentQuantity <= 1) {
        await removeItem(item);
        return;
    }
    item.soLuong = currentQuantity - 1;
    try {
        await updateCartItemDB(item as any);
    } catch (error) {
        await loadCart();
    }
};

const onQuantityChange = async (item: CartItem) => {
    let newQty = Number(item.soLuong);
    if (isNaN(newQty) || newQty < 1) {
        newQty = 1;
    }
    
    if (item.soLuongTon !== undefined && newQty > item.soLuongTon) {
        newQty = item.soLuongTon;
        import('sweetalert2').then((Swal) => {
            Swal.default.fire({
                icon: 'warning',
                title: 'Vượt quá số lượng',
                text: `Chỉ còn ${item.soLuongTon} trong kho!`,
                confirmButtonColor: '#000'
            });
        });
    }

    item.soLuong = newQty;
    try {
        await updateCartItemDB(item as any);
    } catch (error) {
        await loadCart();
    }
};

const onQuantityBlur = (item: CartItem) => {
    if (!item.soLuong || item.soLuong < 1) {
        item.soLuong = 1;
        onQuantityChange(item);
    }
};

const clearCart = async () => {
    const maKH = getCustomerInfo().maKH;
    // Cần làm hàm clear chỉ sản phẩm, nhưng hiện tại backend clear hết.
    // Tạm thời nếu gọi hàm này, nó sẽ xoá cả dịch vụ trong DB, nhưng không sao vì dịch vụ không còn nằm trong DB đối với luồng mới nữa (chỉ local storage).
    await clearCartDB(maKH);
    await loadCart();
};

const handleCheckoutBtnClick = () => {
    const dPs = JSON.parse(JSON.stringify(cartItems.value));
    const maKH = getCustomerInfo().maKH;

    const payload = {
        maKH: maKH || "GUEST",
        loaiCheckout: 'CHI_MUA_SAN_PHAM',
        dichVuItems: [],
        sanPhamItems: dPs,
        nhanSanPham: null,
        tongDichVu: 0,
        tongSanPham: totalProduct.value,
        tongTien: totalProduct.value
    };

    localStorage.setItem("checkoutData", JSON.stringify(payload));
    router.push("/thanh-toan-san-pham");
};
</script>

<style scoped>
.font-heading {
  font-family: 'Inter', sans-serif; 
}
.hide-arrows::-webkit-inner-spin-button, 
.hide-arrows::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
.hide-arrows {
    -moz-appearance: textfield;
}
</style>