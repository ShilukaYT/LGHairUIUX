<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24 bg-gray-50">
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-12 lg:pt-20">
      
      <!-- HEADER -->
      <div class="mb-10 text-center">
        <h1 class="font-heading text-3xl md:text-4xl font-bold uppercase tracking-widest text-gray-900 mb-2">Giỏ hàng của bạn</h1>
        <div class="w-16 h-1 bg-black mx-auto mb-4"></div>
        <p class="text-gray-600 text-sm md:text-base">Bạn đang có <span class="font-bold text-black">{{ cartItems.length }}</span> dịch vụ/sản phẩm</p>
      </div>

      <div class="flex flex-col xl:flex-row gap-10 xl:gap-16">
        
        <!-- Cart Items List -->
        <div class="flex-1 flex flex-col bg-white p-6 md:p-10 shadow-sm rounded-xl border border-gray-100">

          <div v-if="cartItems.length === 0" class="flex flex-col items-center justify-center py-20 text-center">
             <div class="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <i class="fas fa-shopping-bag text-4xl text-gray-400"></i>
             </div>
             <p class="text-gray-900 font-bold uppercase tracking-widest text-lg mb-2">Giỏ hàng đang trống</p>
             <p class="text-gray-500 mb-8">Hãy chọn thêm dịch vụ và sản phẩm nhé!</p>
             <button @click="router.push({ name: 'shop' })" class="bg-black text-white px-8 py-3 font-semibold uppercase tracking-widest text-sm hover:bg-gray-800 transition-colors rounded">
               Tiếp tục mua sắm
             </button>
          </div>

          <template v-else>
            <!-- Tabs -->
            <div class="flex gap-4 md:gap-8 border-b-2 border-gray-100 mb-8 overflow-x-auto hide-scrollbar">
              <button 
                @click="activeTab = 'service'"
                class="pb-4 text-sm md:text-base font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap px-2"
                :class="activeTab === 'service' ? 'text-black' : 'text-gray-400 hover:text-gray-700'"
              >
                Dịch vụ ({{ serviceItems.length }})
                <span v-if="activeTab === 'service'" class="absolute bottom-[-2px] left-0 w-full h-[3px] bg-black"></span>
              </button>
              <button 
                @click="activeTab = 'product'"
                class="pb-4 text-sm md:text-base font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap px-2"
                :class="activeTab === 'product' ? 'text-black' : 'text-gray-400 hover:text-gray-700'"
              >
                Sản phẩm ({{ productItems.length }})
                <span v-if="activeTab === 'product'" class="absolute bottom-[-2px] left-0 w-full h-[3px] bg-black"></span>
              </button>
            </div>

            <!-- Table Header (hidden on mobile) -->
            <div class="hidden md:grid grid-cols-[3fr_1fr_1fr_auto] gap-6 border-b border-gray-200 pb-4 mb-6 text-xs font-bold uppercase tracking-widest text-gray-500">
              <span>Sản phẩm / Dịch vụ</span>
              <span class="text-center">Số lượng</span>
              <span class="text-right">Giá</span>
              <span class="w-10"></span>
            </div>

            <!-- Items -->
            <div class="flex flex-col gap-6">
              <div v-if="(activeTab === 'service' ? serviceItems : productItems).length === 0" class="py-16 text-center text-gray-500 font-medium text-base bg-gray-50 rounded-lg">
                 Chưa có {{ activeTab === 'service' ? 'dịch vụ' : 'sản phẩm' }} nào trong mục này.
              </div>
              <div v-for="item in (activeTab === 'service' ? serviceItems : productItems)" :key="item.id" class="flex flex-col md:grid md:grid-cols-[3fr_1fr_1fr_auto] gap-6 items-center border border-gray-100 md:border-none md:border-b p-4 md:p-0 md:py-6 rounded-lg md:rounded-none bg-white hover:bg-gray-50 transition-colors group">
                <!-- Product Info -->
                <div class="flex items-center gap-6 w-full">
                  <div class="w-24 h-24 md:w-28 md:h-28 bg-gray-100 flex-shrink-0 cursor-pointer overflow-hidden rounded-md border border-gray-200">
                    <img :src="getImageUrl(item.hinhAnh)" :alt="item.tenItem" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex flex-col flex-1">
                    <h3 class="font-heading text-base md:text-lg font-bold text-gray-900 mb-1 cursor-pointer hover:text-gray-600 transition-colors line-clamp-2">{{ item.tenItem }}</h3>
                    <p class="text-xs uppercase tracking-widest text-gray-500 font-medium mb-2">
                        <span v-if="item.type === 'SANPHAM'">Sản phẩm</span>
                        <span v-else>Dịch vụ &middot; {{ item.duration || 30 }} phút</span>
                    </p>
                    <p class="md:hidden text-lg font-bold text-black mt-2">{{ formatMoney(item.gia) }}</p>
                  </div>
                </div>

                <!-- Quantity Mobile Header -->
                <div class="md:hidden w-full flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                  <span class="text-xs font-bold uppercase tracking-widest text-gray-500">Số lượng</span>
                  <!-- Mobile Qty Selector -->
                  <div class="flex items-center border-2 border-gray-200 rounded-md bg-white">
                    <button @click="decreaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus :size="16" /></button>
                    <span class="w-10 text-center font-bold text-sm">{{ item.soLuong || 1 }}</span>
                    <button @click="increaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus :size="16" /></button>
                  </div>
                </div>

                <!-- Desktop Qty Selector -->
                <div class="hidden md:flex justify-center w-full">
                  <div class="flex items-center border-2 border-gray-200 rounded-md bg-white">
                    <button @click="decreaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Minus :size="16" /></button>
                    <span class="w-10 text-center font-bold text-sm">{{ item.soLuong || 1 }}</span>
                    <button @click="increaseQuantity(item)" class="w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"><Plus :size="16" /></button>
                  </div>
                </div>

                <!-- Price (Desktop) -->
                <div class="hidden md:block text-right w-full">
                  <span class="text-lg font-bold text-black">{{ formatMoney((item.gia || 0) * (item.soLuong || 1)) }}</span>
                </div>

                <!-- Remove -->
                <div class="hidden md:flex justify-end w-10">
                  <button @click="removeItem(item.id)" class="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 transition-all shadow-sm bg-white border border-gray-200 hover:border-red-500">
                    <X :size="18" :stroke-width="2" />
                  </button>
                </div>
                
                <!-- Mobile Remove -->
                <button @click="removeItem(item.id)" class="md:hidden w-full bg-red-50 text-red-600 font-bold text-xs uppercase tracking-widest text-center py-3 rounded-md mt-2 hover:bg-red-500 hover:text-white transition-colors">
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
              <div v-if="totalService > 0" class="flex justify-between items-center">
                <span class="text-gray-600 font-medium">Tổng dịch vụ</span>
                <span class="font-bold">{{ formatMoney(totalService) }}</span>
              </div>
              <div v-if="totalProduct > 0" class="flex justify-between items-center">
                <span class="text-gray-600 font-medium">Tổng sản phẩm</span>
                <span class="font-bold">{{ formatMoney(totalProduct) }}</span>
              </div>
              <div class="flex justify-between items-center pt-6 border-t-2 border-gray-100 mt-2">
                <span class="font-bold text-black uppercase tracking-widest text-lg">Tổng cộng</span>
                <span class="font-black text-black text-2xl md:text-3xl">{{ formatMoney(totalAmount) }}</span>
              </div>
            </div>

            <button :disabled="cartItems.length === 0" @click="handleCheckoutBtnClick" class="w-full bg-black text-white px-8 py-6 text-sm font-bold uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed rounded-md shadow-md hover:shadow-lg">
              <span class="mr-3">{{ checkoutButtonText }}</span> 
              <ArrowRight :size="18" class="group-hover:translate-x-2 transition-transform" />
            </button>

            <div class="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <p class="text-xs text-gray-500 text-center font-medium uppercase tracking-widest leading-relaxed">
                <i class="fas fa-shield-alt text-gray-400 text-lg mb-2 block"></i>
                Thanh toán an toàn & Bảo mật.<br/>Thông tin đặt lịch sẽ được xác nhận ở bước tiếp theo.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Modal chọn thanh toán -->
    <CheckoutOptionModal 
        :is-open="isModalOpen" 
        @close="isModalOpen = false"
        @confirm="processCheckout"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { X, Minus, Plus, ArrowRight } from 'lucide-vue-next';
import {
    getCartDB,
    removeFromCartDB,
    clearCartDB,
    addToCartDB,
    updateCartItemDB
} from "@/Views/Anonymous/CSDL/cartDB";
import { useRouter } from "vue-router";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

import CheckoutOptionModal from "./CheckoutOptionModal.vue";

const router = useRouter();


interface CartItem {
    id: string | number;
    rawId?: string | number;
    maKH: string;
    type?: "DICHVU" | "COMBO" | "SANPHAM";
    tenItem: string;
    gia: number;
    giaGoc?: number;
    phanTramGiam?: number;
    hinhAnh?: string;
    createdAt: number;
    duration?: number;
    soLuong?: number;
}

const emit = defineEmits(["close", "checkout"]);

const cartItems = ref<CartItem[]>([]);
const isOpen = ref(false);
const activeTab = ref<"service" | "product">("service");

const defaultImage = "/images/no-image.png";
const isModalOpen = ref(false);

const API = import.meta.env.VITE_API_URL || 'http://localhost:1337'; // Or whatever default

const getImageUrl = (url: string | undefined | null) => {
    if (!url) return defaultImage;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/images/') && !url.includes('upload')) return url; // Tạm giữ ảnh cục bộ public/images
    return `${API}${url.startsWith('/') ? '' : '/'}${url}`;
};
const loadCart = async () => {
    const maKH = getCustomerInfo().maKH;
    cartItems.value = await getCartDB(maKH);
};

onMounted(() => {
    // Tự động mở giỏ hàng khi người dùng truy cập vào trang /cart
    isOpen.value = true;
    loadCart();
});

const isProduct = (item: CartItem) => {
    return item.type === "SANPHAM" || String(item.id).startsWith("SANPHAM_");
};

const isService = (item: CartItem) => {
    return !isProduct(item);
};

const serviceItems = computed(() => {
    return cartItems.value.filter(isService);
});

const productItems = computed(() => {
    return cartItems.value.filter(isProduct);
});

const hasService = computed(() => serviceItems.value.length > 0);
const hasProduct = computed(() => productItems.value.length > 0);



const totalService = computed(() => {
    return serviceItems.value.reduce((sum, item) => {
        return sum + Number(item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
});

const totalProduct = computed(() => {
    return productItems.value.reduce((sum, item) => {
        return sum + Number(item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
});

const totalAmount = computed(() => {
    return totalService.value + totalProduct.value;
});

const checkoutButtonText = computed(() => {
    if (hasService.value && hasProduct.value) return "Đặt lịch & mua sản phẩm";
    if (hasService.value) return "Đặt lịch";
    return "Mua sản phẩm";
});

const formatMoney = (money: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(money || 0);
};

const removeItem = async (id: string | number) => {
    await removeFromCartDB(id);
    await loadCart();
};

const increaseQuantity = async (item: CartItem) => {
    item.soLuong = Number(item.soLuong || 1) + 1;
    await updateCartItemDB(item as any);
    await loadCart();
};

const decreaseQuantity = async (item: CartItem) => {
    const currentQuantity = Number(item.soLuong || 1);

    if (currentQuantity <= 1) {
        await removeItem(item.id);
        return;
    }

    item.soLuong = currentQuantity - 1;
    await updateCartItemDB(item as any);
    await loadCart();
};

const clearCart = async () => {
    const maKH = getCustomerInfo().maKH;
    await clearCartDB(maKH);
    await loadCart();
};



// Bấm nút thanh toán ở Sidebar
const handleCheckoutBtnClick = () => {
    // NẾU CÓ CẢ HAI -> Mở Cửa sổ trạm kiểm soát
    if (hasService.value && hasProduct.value) {
        isModalOpen.value = true;
    } 
    // NẾU CHỈ CÓ 1 TRONG 2 -> Đi thẳng tới trang thanh toán
    else {
        processCheckout({
            loaiCheckout: hasService.value ? 'CHI_DAT_LICH' : 'CHI_MUA_SAN_PHAM',
            nhanSanPham: null
        });
    }
};

// Hàm xử lý gói dữ liệu đẩy đi thanh toán
// Hàm xử lý gói dữ liệu đẩy đi thanh toán
const processCheckout = (options: { loaiCheckout: string, nhanSanPham: string | null }) => {
    const { loaiCheckout, nhanSanPham } = options;
    
    // LỌC ĐỒ THÔNG MINH: Bóc tách Proxy của Vue để mảng thuần khiết và không bị lỗi
    const dVs = (loaiCheckout === 'CHI_DAT_LICH' || loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') 
        ? JSON.parse(JSON.stringify(serviceItems.value)) : [];
    const sPs = (loaiCheckout === 'CHI_MUA_SAN_PHAM' || loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') 
        ? JSON.parse(JSON.stringify(productItems.value)) : [];
    
    // Tính lại tiền
    const tDv = (loaiCheckout === 'CHI_DAT_LICH' || loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') ? totalService.value : 0;
    const tSp = (loaiCheckout === 'CHI_MUA_SAN_PHAM' || loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') ? totalProduct.value : 0;
    const maKH = getCustomerInfo().maKH;

    const payload = {
        maKH: maKH || "GUEST",
        loaiCheckout: loaiCheckout,
        dichVuItems: dVs,
        sanPhamItems: sPs,
        nhanSanPham: nhanSanPham,
        tongDichVu: tDv,
        tongSanPham: tSp,
        tongTien: tDv + tSp
    };

    // Đẩy xuống LocalStorage
    localStorage.setItem("checkoutData", JSON.stringify(payload));
    console.log("📦 Dữ liệu chuẩn bị mang qua thanh toán:", payload); // F12 xem có dữ liệu chưa

    isModalOpen.value = false; // Đóng cửa sổ
    // Xóa dòng closeCart() vì nó gọi router.back() gây lỗi đá về trang chủ
    
    // Điều hướng trang
    if (loaiCheckout === 'CHI_DAT_LICH') {
        router.push("/dat-dich-vu"); 
    } else if (loaiCheckout === 'CHI_MUA_SAN_PHAM') {
        router.push("/thanh-toan-san-pham");
    } else if (loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') {
        router.push("/thanh-toan-tong");
    } else {
        router.push("/dat-dich-vu");
    }
}; 

const openCart = async () => {
    isOpen.value = true;
    await loadCart();
};

const closeCart = () => {
    isOpen.value = false;
    // Nếu đang ở trang /cart thì khi đóng giỏ hàng sẽ quay lại trang trước đó
    if (router.currentRoute.value.name === 'cart') {
        router.back();
    }
};
const addServiceToCart = async (item: any) => {
    // Chuẩn hóa dữ liệu: Map các trường tiếng Anh (API) sang tiếng Việt (IndexedDB)
    const serviceItem = {
        id: item.id || item.maDv || item.maCb,
        tenItem: item.tenItem || item.name || item.tenDv || item.tenCombo,
        gia: item.gia || item.price || item.giaBan,
        giaGoc: item.originalPrice || item.giaGoc || item.gia || item.price,
        hinhAnh: item.hinhAnh || item.icon || item.image || item.hinhAnhDaiDien,
        duration: item.duration || item.thoiGianLam || 30,
        type: item.type || (String(item.id || item.maCb).startsWith('CB') ? "COMBO" : "DICHVU"),
        soLuong: 1
    };
    
    const maKH = getCustomerInfo().maKH;
    await addToCartDB(serviceItem, maKH);
    await loadCart();
    activeTab.value = "service";
    isOpen.value = true;
};

const addProductToCart = async (item: any) => {
    // Chuẩn hóa dữ liệu cho Sản phẩm
    const productItem = {
        id: item.maBienThe || item.id,
        tenItem: item.tenBienThe ? `${item.tenSp} - ${item.tenBienThe}` : (item.tenItem || item.name || item.tenSp),
        gia: item.giaBan || item.gia || item.price,
        giaGoc: item.giaGoc || item.giaBan || item.gia || item.price,
        hinhAnh: item.hinhAnhDaiDien || item.hinhAnh || item.image,
        type: "SANPHAM",
        soLuong: item.soLuong || 1,
        maSanPham: item.maSanPham || null
    };

    const maKH = getCustomerInfo().maKH;
    await addToCartDB(productItem, maKH);
    await loadCart();
    activeTab.value = "product";
    isOpen.value = true;
};
defineExpose({
    openCart,
    closeCart,

    // Hàm cũ Services.vue đang gọi
    addToCart: addServiceToCart,

    // Hàm rõ nghĩa hơn
    addServiceToCart,
    addProductToCart
});
</script>

<style scoped>
/* Optional minimal styles. Most are handled by Tailwind classes */
.font-heading {
  font-family: 'Inter', sans-serif; /* or your designated heading font */
}
</style>