<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { Heart, X, Clock, ShoppingBag } from 'lucide-vue-next';

const router = useRouter();
const wishlistStore = useWishlistStore();
const activeTab = ref<'products' | 'services'>('products');

onMounted(() => {
  wishlistStore.loadWishlist();
});

const API = import.meta.env.VITE_API_URL;

const getImageUrl = (path?: string) => {
  if (!path) return `${API}/assets/images/default.jpg`;
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API}${path}`;
  return `${API}/${path}`;
};

const formatPrice = (price?: number | null) => {
  return price != null ? Number(price).toLocaleString("vi-VN") + "đ" : "—";
};

// Add service to cart directly from Wishlist
const bookService = async (service: any) => {
  try {
    const finalPrice = service.gia || service.price;
    const formattedItem = {
      id: service.maDv || service.id,
      tenItem: service.tenDv || service.name,
      gia: finalPrice,
      giaGoc: service.giaGoc || service.gia || service.price,
      hinhAnh: service.hinhAnh || service.img || "/assets/images/default.jpg",
      type: 'DICHVU',
      duration: service.thoiGianLam || service.duration || 30
    };

    const customer = getCustomerInfo();
    await addToCartDB(formattedItem, customer.maKH);
    window.dispatchEvent(new Event("cart-updated"));
    alert(`Đã thêm dịch vụ "${formattedItem.tenItem}" vào giỏ hàng thành công!`);
  } catch (err) {
    console.error("Lỗi thêm dịch vụ vào giỏ hàng:", err);
    alert("Có lỗi xảy ra, vui lòng thử lại sau!");
  }
};

// Add product to cart directly from Wishlist
const addProductToCart = async (prod: any, isBuyNow = false) => {
  try {
    // Fetch product details to check variants
    const res = await axios.get(`${API}/api/SanPham/${prod.maSp}`);
    const fullProduct = res.data;

    if (!fullProduct) {
      alert("Không tìm thấy thông tin sản phẩm!");
      return;
    }

    const variants = fullProduct.bienThes || [];
    
    // Check total stock
    const totalStock = variants.reduce((s: number, bt: any) => s + (bt.soLuongTon ?? 0), 0);
    if (totalStock <= 0) {
      alert("Sản phẩm này đã hết hàng!");
      return;
    }

    // If multiple variants exist, redirect to details page for selection
    if (variants.length > 1) {
      alert("Sản phẩm này có nhiều lựa chọn, vui lòng chọn loại sản phẩm bạn muốn!");
      router.push({ name: 'productDetail', params: { id: prod.maSp } });
      return;
    }

    const selectedVariant = variants[0];
    if (!selectedVariant) {
      alert("Sản phẩm này không có sẵn biến thể!");
      return;
    }

    if (selectedVariant.soLuongTon <= 0) {
      alert("Loại sản phẩm này đã hết hàng!");
      return;
    }

    const formattedItem = {
      id: selectedVariant.maBienThe,
      maSanPham: fullProduct.maSp,
      tenItem: `${fullProduct.tenSp} - ${selectedVariant.tenBienThe}`,
      gia: selectedVariant.giaBan,
      giaGoc: selectedVariant.giaBan,
      hinhAnh: selectedVariant.hinhAnhDaiDien || fullProduct.hinhAnhDaiDien || "/assets/images/default.jpg",
      type: 'SANPHAM',
      soLuong: 1
    };

    const customer = getCustomerInfo();
    await addToCartDB(formattedItem, customer.maKH);
    window.dispatchEvent(new Event("cart-updated"));

    if (isBuyNow) {
      router.push('/cart');
    } else {
      alert(`Đã thêm sản phẩm "${formattedItem.tenItem}" vào giỏ hàng thành công!`);
    }
  } catch (err) {
    console.error("Lỗi thêm sản phẩm vào giỏ hàng:", err);
    alert("Có lỗi xảy ra, vui lòng thử lại sau!");
  }
};
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-[75vh] bg-white pb-24">
    <!-- Header -->
    <div class="bg-gray-50/50 border-b border-gray-100 py-16">
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
        <h1 class="text-3xl lg:text-4xl font-heading uppercase tracking-[0.2em] mb-4">Danh Sách Yêu Thích</h1>
        <p class="text-[11px] uppercase tracking-widest text-gray-500">
          {{ wishlistStore.favoriteProducts.length }} Sản phẩm &middot; {{ wishlistStore.favoriteServices.length }} Dịch vụ được lưu
        </p>
      </div>
    </div>

    <!-- Tabs Navigation -->
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 mt-10">
      <div class="flex justify-center border-b border-gray-200">
        <button 
          @click="activeTab = 'products'"
          :class="[
            'pb-4 px-8 text-xs uppercase tracking-[0.2em] font-medium transition-all relative border-b-2',
            activeTab === 'products' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black'
          ]"
        >
          Sản phẩm yêu thích ({{ wishlistStore.favoriteProducts.length }})
        </button>
        <button 
          @click="activeTab = 'services'"
          :class="[
            'pb-4 px-8 text-xs uppercase tracking-[0.2em] font-medium transition-all relative border-b-2',
            activeTab === 'services' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black'
          ]"
        >
          Dịch vụ yêu thích ({{ wishlistStore.favoriteServices.length }})
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-12">
      
      <!-- ========================================== -->
      <!-- TAB 1: PRODUCT WISHLIST                    -->
      <!-- ========================================== -->
      <div v-if="activeTab === 'products'">
        <!-- Empty State -->
        <div v-if="wishlistStore.favoriteProducts.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
          <Heart :size="48" class="text-gray-200 mb-6" :stroke-width="1" />
          <p class="text-sm tracking-widest uppercase text-gray-400 mb-8">Chưa có sản phẩm nào trong danh sách yêu thích.</p>
          <button @click="router.push({ name: 'Product' })" class="px-10 py-4 bg-black text-white text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
            Tiếp tục mua sắm
          </button>
        </div>

        <!-- Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-12">
          <div 
            v-for="prod in wishlistStore.favoriteProducts" 
            :key="prod.maSp" 
            class="group flex flex-col cursor-pointer relative bg-white border border-gray-100 hover:border-black transition-all duration-300 p-4"
            @click="router.push({ name: 'productDetail', params: { id: prod.maSp } })"
          >
            <!-- Xóa Icon -->
            <button 
              @click.stop="wishlistStore.removeProduct(prod.maSp)" 
              class="absolute top-6 right-6 z-10 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
              title="Xóa khỏi yêu thích"
            >
              <X :size="14" :stroke-width="2" />
            </button>

            <!-- Image -->
            <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-6 relative border border-gray-100">
              <img :src="getImageUrl(prod.hinhAnhDaiDien || prod.img)" :alt="prod.tenSp" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <button class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800 transition-colors">
                  Xem chi tiết
                </button>
              </div>
            </div>
            
            <!-- Info -->
            <span class="text-[11px] text-gray-400 uppercase tracking-widest mb-1">
              {{ prod.thuongHieu?.tenThuongHieu || prod.category || 'Mỹ phẩm tóc' }}
            </span>
            <h3 class="font-heading text-sm tracking-widest uppercase mb-2 line-clamp-1 font-medium">{{ prod.tenSp || prod.name }}</h3>
            
            <p class="text-xs text-gray-400 font-light line-clamp-2 mb-4 leading-relaxed">
              {{ prod.moTa || prod.desc }}
            </p>
            
            <div class="mt-auto pt-3 border-t border-gray-50 flex justify-between items-center">
              <span class="text-sm font-medium">
                <template v-if="prod.giaTu && prod.giaDen && prod.giaTu !== prod.giaDen">
                  {{ formatPrice(prod.giaTu) }} – {{ formatPrice(prod.giaDen) }}
                </template>
                <template v-else-if="prod.giaTu">{{ formatPrice(prod.giaTu) }}</template>
                <template v-else>{{ formatPrice(prod.price) }}</template>
              </span>
              
              <span v-if="prod.soLuongTon === 0" class="text-[10px] uppercase tracking-widest text-red-500 font-medium">Hết hàng</span>
              <span v-else class="text-[10px] uppercase tracking-widest text-emerald-600 font-medium">Còn hàng</span>
            </div>

            <!-- Action Buttons -->
            <div class="mt-4 pt-3 border-t border-gray-100 flex gap-2 w-full">
              <button 
                @click.stop.prevent="addProductToCart(prod, false)"
                class="flex-1 border border-black bg-white text-black py-2.5 text-[10px] font-medium uppercase tracking-wider hover:bg-black hover:text-white transition-all duration-200 text-center"
              >
                Thêm giỏ hàng
              </button>
              <button 
                @click.stop.prevent="addProductToCart(prod, true)"
                class="flex-1 bg-black text-white py-2.5 text-[10px] font-medium uppercase tracking-wider hover:bg-gray-800 transition-all duration-200 text-center"
              >
                Mua ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- TAB 2: SERVICE WISHLIST                    -->
      <!-- ========================================== -->
      <div v-else-if="activeTab === 'services'">
        <!-- Empty State -->
        <div v-if="wishlistStore.favoriteServices.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
          <Heart :size="48" class="text-gray-200 mb-6" :stroke-width="1" />
          <p class="text-sm tracking-widest uppercase text-gray-400 mb-8">Chưa có dịch vụ nào trong danh sách yêu thích.</p>
          <button @click="router.push({ name: 'services' })" class="px-10 py-4 bg-black text-white text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
            Khám phá dịch vụ
          </button>
        </div>

        <!-- Grid -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          <div 
            v-for="svc in wishlistStore.favoriteServices" 
            :key="svc.maDv" 
            class="group flex flex-col cursor-pointer relative bg-white border border-gray-100 hover:border-black transition-all duration-300 p-5"
            @click="router.push({ name: 'serviceDetail', params: { id: svc.maDv } })"
          >
            <!-- Xóa Icon -->
            <button 
              @click.stop="wishlistStore.removeService(svc.maDv)" 
              class="absolute top-6 right-6 z-10 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 transition-all shadow-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0"
              title="Xóa khỏi yêu thích"
            >
              <X :size="14" :stroke-width="2" />
            </button>

            <!-- Image -->
            <div class="aspect-[16/10] overflow-hidden bg-gray-100 mb-6 relative border border-gray-100">
              <img :src="getImageUrl(svc.hinhAnh || svc.img)" :alt="svc.tenDv" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              
              <div class="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 text-[10px] uppercase tracking-widest flex items-center gap-1.5 text-black font-medium border border-gray-100">
                <Clock :size="12" />
                <span>{{ svc.thoiGianLam || svc.duration }} Phút</span>
              </div>
            </div>
            
            <!-- Info -->
            <h3 class="font-heading text-base tracking-widest uppercase mb-3 font-medium">{{ svc.tenDv || svc.name }}</h3>
            
            <p class="text-xs text-gray-400 font-light line-clamp-3 mb-6 leading-relaxed flex-grow">
              {{ svc.moTa || svc.desc }}
            </p>
            
            <!-- Bottom Actions -->
            <div class="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center gap-4">
              <div class="flex flex-col">
                <span class="text-[9px] uppercase tracking-widest text-gray-400 mb-0.5">Giá dịch vụ</span>
                <span class="text-base font-semibold text-black">
                  {{ formatPrice(svc.gia || svc.price) }}
                </span>
              </div>
              
              <button 
                @click.stop.prevent="bookService(svc)"
                class="px-5 py-2.5 bg-black text-white text-[10px] uppercase tracking-wider hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <ShoppingBag :size="12" />
                Đặt lịch
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.font-heading {
  font-family: var(--font-heading, 'Inter', sans-serif);
}
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
