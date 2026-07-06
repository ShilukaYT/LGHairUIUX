<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useWishlistStore } from "@/stores/useWishlistStore";
import { Heart } from "lucide-vue-next";

const wishlistStore = useWishlistStore();

const API   = import.meta.env.VITE_API_URL;
const route = useRoute();
const router = useRouter();

// ======================================================
// STATE
// ======================================================
const product           = ref<any>(null);
const allGalleryImages  = ref<string[]>([]); // ảnh từ bảng HinhAnhSP
const suggestedProducts = ref<any[]>([]);
const loading           = ref(true);
const error             = ref(false);

const selectedBienThe   = ref<any>(null); // null = chưa chọn biến thể nào

// Slide ảnh của biến thể đang chọn
// Danh sách: [hinhAnhDaiDien, ...hinhAnhs từ HINHANH_BT]
const btImageList  = ref<string[]>([]);
const slideIndex   = ref(0);

// Tab nội dung (Chi tiết / Thành phần) — theo ProductDetail
const activeTab = ref<"details" | "ingredients">("details");

// Lightbox cho gallery
const lightboxOpen      = ref(false);
const lightboxImg       = ref("");

// ======================================================
// COMPUTED
// ======================================================

// Ảnh chính hiển thị ở khung to:
//  - Nếu đang chọn BT → lướt trong btImageList theo slideIndex
//  - Nếu chưa chọn → ảnh đại diện SP
const mainDisplayImage = computed(() => {
  if (selectedBienThe.value && btImageList.value.length > 0)
    return btImageList.value[slideIndex.value];
  return product.value?.hinhAnhDaiDien || "";
});

// Giá hiển thị:
//  - Nếu đang chọn biến thể → giá biến thể đó
//  - Nếu chưa chọn & chỉ 1 biến thể → giá biến thể đó (đã auto-select)
//  - Nếu chưa chọn & nhiều biến thể khác giá → dải giá "min – max"
const priceDisplay = computed(() => {
  if (selectedBienThe.value) {
    return { text: formatSinglePrice(selectedBienThe.value.giaBan), isRange: false };
  }
  const min = product.value?.giaTu;
  const max = product.value?.giaDen;
  if (min == null) return { text: "Liên hệ", isRange: false };
  if (max == null || min === max) return { text: formatSinglePrice(min), isRange: false };
  return { text: `${formatSinglePrice(min)} – ${formatSinglePrice(max)}`, isRange: true };
});

// Tồn kho: của biến thể đang chọn, hoặc tổng nếu chưa chọn
const currentStock = computed(() => {
  if (selectedBienThe.value) return selectedBienThe.value.soLuongTon ?? 0;
  return product.value?.bienThes?.reduce((s: number, bt: any) => s + (bt.soLuongTon ?? 0), 0) ?? 0;
});

// Trạng thái nút action
const canOrder = computed(() => currentStock.value > 0 && selectedBienThe.value != null);

// ======================================================
// METHODS
// ======================================================
const fetchProduct = async (id: string) => {
  try {
    loading.value = true;
    error.value   = false;
    product.value          = null;
    allGalleryImages.value = [];
    suggestedProducts.value = [];
    selectedBienThe.value  = null;
    btImageList.value      = [];
    slideIndex.value       = 0;

    const res  = await axios.get(`${API}/api/SanPham/${id}`);
    const data = res.data;
    product.value = data;

    // Gallery ảnh từ bảng HinhAnhSP
    allGalleryImages.value = data.hinhAnhs?.map((h: any) => h.duongDan).filter(Boolean) || [];

    // Nếu chỉ có đúng 1 biến thể → tự chọn luôn
    if (data.bienThes?.length === 1) {
      selectBienThe(data.bienThes[0]);
    }
    // Nhiều biến thể → không tự chọn, để người dùng chọn

    suggestedProducts.value = data.suggestedProducts || [];
  } catch {
    error.value = true;
  } finally {
    loading.value = false;
  }
};

const getImageUrl = (path?: string) => {
  if (!path) return `${API}/assets/images/default.jpg`;
  if (path.startsWith("/")) return `${API}${path}`;
  return `${API}/${path}`;
};

const formatSinglePrice = (price?: number | null) =>
  price != null ? Number(price).toLocaleString("vi-VN") + "đ" : "—";

const selectBienThe = (bt: any) => {
  if (bt.soLuongTon === 0) return;
  // Toggle: click lại biến thể đang chọn → bỏ chọn (chỉ áp dụng nếu có > 1 biến thể)
  if (selectedBienThe.value?.maBienThe === bt.maBienThe && product.value?.bienThes?.length > 1) {
    selectedBienThe.value = null;
    btImageList.value = [];
    slideIndex.value  = 0;
    return;
  }
  selectedBienThe.value = bt;
  // Xây danh sách ảnh slide: ảnh đại diện trước, rồi gallery BT
  const imgs: string[] = [];
  if (bt.hinhAnhDaiDien) imgs.push(bt.hinhAnhDaiDien);
  for (const h of bt.hinhAnhs ?? []) {
    if (h.duongDan && !imgs.includes(h.duongDan)) imgs.push(h.duongDan);
  }
  btImageList.value = imgs;
  slideIndex.value  = 0;
};

const slidePrev = () => {
  if (btImageList.value.length <= 1) return;
  slideIndex.value = (slideIndex.value - 1 + btImageList.value.length) % btImageList.value.length;
};
const slideNext = () => {
  if (btImageList.value.length <= 1) return;
  slideIndex.value = (slideIndex.value + 1) % btImageList.value.length;
};

const openLightbox = (img: string) => { lightboxImg.value = img; lightboxOpen.value = true; };
const closeLightbox = () => { lightboxOpen.value = false; };

const addToCart = async (isBuyNow = false) => {
  if (!selectedBienThe.value || !canOrder.value) return;
  
  const customer = getCustomerInfo();
  
  const formattedItem = {
    id: selectedBienThe.value.maBienThe,
    maSanPham: product.value.maSp,
    tenItem: `${product.value.tenSp} - ${selectedBienThe.value.tenBienThe}`,
    gia: selectedBienThe.value.giaBan,
    giaGoc: selectedBienThe.value.giaBan,
    hinhAnh: selectedBienThe.value.hinhAnhDaiDien || product.value.hinhAnhDaiDien || "/assets/images/default.jpg",
    type: 'SANPHAM',
    soLuong: 1
  };

  await addToCartDB(formattedItem, customer.maKH);
  window.dispatchEvent(new Event("cart-updated"));
  
  if (isBuyNow) {
    router.push('/cart');
  } else {
    alert("Đã thêm sản phẩm vào giỏ hàng thành công!");
  }
};

watch(
  () => route.params.id,
  (newId) => { if (newId) fetchProduct(newId as string); },
  { immediate: true }
);
</script>

<template>
  <div class="w-full min-h-screen pb-24">

    <!-- LOADING -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
      <div class="pd-spinner"></div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Đang tải sản phẩm...</p>
    </div>

    <!-- LỖI -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-32 gap-4 border border-gray-100 max-w-[1440px] mx-auto px-6">
      <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Không tìm thấy sản phẩm hoặc đã xảy ra lỗi.</p>
      <router-link to="/product" class="border border-black px-6 py-3 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white transition-colors">
        Quay lại danh sách
      </router-link>
    </div>

    <template v-else-if="product">
      <div class="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pt-8 px-6 lg:px-12 max-w-[1440px] mx-auto">

        <!-- BREADCRUMB -->
        <nav aria-label="breadcrumb" class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-gray-400 mb-8">
          <router-link to="/product" class="hover:text-black transition-colors">Sản phẩm</router-link>
          <template v-if="product.danhMuc">
            <span>/</span>
            <router-link :to="{ name: 'Product', query: { danhMuc: product.danhMuc.maDMSP } }" class="hover:text-black transition-colors">
              {{ product.danhMuc.tenDanhMuc }}
            </router-link>
          </template>
          <span>/</span>
          <span class="text-black">{{ product.tenSp }}</span>
        </nav>

        <!-- PHẦN CHÍNH: ẢNH TRÁI + THÔNG TIN PHẢI -->
        <div class="flex flex-col lg:flex-row gap-12 lg:gap-24">

          <!-- CỘT TRÁI: ẢNH -->
          <div class="w-full lg:w-1/2">
            <div class="aspect-[4/4] bg-gray-100 w-full overflow-hidden border border-gray-200 relative">
              <img :src="getImageUrl(mainDisplayImage)" :alt="product.tenSp" class="w-full h-full object-cover" />

              <div v-if="currentStock === 0 && selectedBienThe" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                <span class="text-white text-sm uppercase tracking-widest border border-white/60 px-6 py-2">Hết hàng</span>
              </div>

              <!-- Nút lướt trái/phải -->
              <template v-if="selectedBienThe && btImageList.length > 1">
                <button class="pd-slide-btn left-3" @click.stop="slidePrev" title="Ảnh trước">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button class="pd-slide-btn right-3" @click.stop="slideNext" title="Ảnh tiếp">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 2L10 7L5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <div class="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  <span
                    v-for="(_, i) in btImageList"
                    :key="i"
                    class="w-1.5 h-1.5 rounded-full cursor-pointer transition-all"
                    :class="i === slideIndex ? 'bg-black scale-125' : 'bg-white/70'"
                    @click.stop="slideIndex = i"
                  ></span>
                </div>
                <div class="absolute top-3 right-3 bg-black/60 text-white text-[10px] tracking-widest px-2.5 py-1 z-10">
                  {{ slideIndex + 1 }} / {{ btImageList.length }}
                </div>
              </template>
            </div>

            <!-- Thumbnails nhỏ bên dưới -->
            <div v-if="selectedBienThe && btImageList.length > 1" class="flex gap-2 mt-3 overflow-x-auto pb-1">
              <div
                v-for="(img, i) in btImageList"
                :key="i"
                class="flex-shrink-0 w-16 h-16 border cursor-pointer transition-colors"
                :class="i === slideIndex ? 'border-black' : 'border-gray-200 hover:border-gray-400'"
                @click="slideIndex = i"
              >
                <img :src="getImageUrl(img)" :alt="`Ảnh ${i + 1}`" class="w-full h-full object-cover" />
              </div>
            </div>
          </div>

          <!-- CỘT PHẢI: THÔNG TIN SẢN PHẨM -->
          <div class="w-full lg:w-1/2 flex flex-col lg:py-10">

            <!-- Thương hiệu / Danh mục -->
            <p class="text-[11px] text-gray-500 uppercase tracking-widest mb-4">
              {{ product.thuongHieu?.tenThuongHieu || product.danhMuc?.tenDanhMuc || "Minh Tâm Hair" }}
            </p>

            <!-- Tên -->
            <h1 class="text-3xl lg:text-4xl font-heading uppercase tracking-widest mb-4">{{ product.tenSp }}</h1>

            <!-- Rating -->
            <div class="flex items-center gap-2 mb-4" v-if="product.soSao != null">
              <div class="flex gap-0.5">
                <i v-for="s in 5" :key="s" class="fas fa-star text-xs"
                  :class="s <= Math.round(product.soSao) ? 'text-black' : 'text-gray-200'"></i>
              </div>
              <span class="text-sm font-medium">{{ product.soSao }}</span>
              <span class="text-xs text-gray-400">({{ product.soLuongDanhGia }} đánh giá)</span>
            </div>
            <p class="text-xs text-gray-400 italic mb-4" v-else>Chưa có đánh giá</p>

            <!-- GIÁ -->
            <span class="text-xl font-light mb-8" :class="{ 'text-lg': priceDisplay.isRange }">
              {{ priceDisplay.text }}
            </span>

            <!-- CHỌN BIẾN THỂ -->
            <div class="mb-8" v-if="product.bienThes?.length > 0">
              <div class="flex items-center gap-2 text-xs uppercase tracking-widest text-gray-500 mb-3">
                <span>Lựa chọn</span>
                <span class="text-black font-medium" v-if="selectedBienThe">— {{ selectedBienThe.tenBienThe }}</span>
                <span class="text-gray-400 italic" v-else-if="product.bienThes?.length > 1">— Vui lòng chọn —</span>
              </div>

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div
                  v-for="bt in product.bienThes"
                  :key="bt.maBienThe"
                  class="relative border px-3 py-2 cursor-pointer transition-colors text-left"
                  :class="[
                    selectedBienThe?.maBienThe === bt.maBienThe ? 'border-black' : 'border-gray-200 hover:border-gray-400',
                    bt.soLuongTon === 0 ? 'opacity-40 cursor-not-allowed' : ''
                  ]"
                  @click="selectBienThe(bt)"
                >
                  <div class="text-xs font-medium uppercase tracking-wide truncate mb-0.5">{{ bt.tenBienThe }}</div>
                  <div class="text-xs text-gray-600 mb-0.5">{{ formatSinglePrice(bt.giaBan) }}</div>
                  <div class="text-[10px] uppercase tracking-wide" :class="bt.soLuongTon > 0 ? 'text-gray-400' : 'text-gray-300'">
                    {{ bt.soLuongTon > 0 ? `Còn ${bt.soLuongTon}` : 'Hết' }}
                  </div>
                  <div v-if="selectedBienThe?.maBienThe === bt.maBienThe" class="absolute top-1.5 right-1.5 w-4 h-4 bg-black text-white flex items-center justify-center text-[8px]">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                  </div>
                </div>
              </div>

              <p class="text-[11px] text-gray-400 mt-3" v-if="!selectedBienThe && product.bienThes?.length > 1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Vui lòng chọn một loại sản phẩm để thêm vào giỏ
              </p>
            </div>

            <!-- Tồn kho -->
            <div class="inline-flex items-center self-start border px-4 py-1.5 text-xs uppercase tracking-widest mb-8"
              :class="currentStock === 0 ? 'border-gray-200 text-gray-300' : currentStock <= 10 ? 'border-gray-400 text-gray-600' : 'border-black text-black'">
              <span v-if="!selectedBienThe && product.bienThes?.length > 1">
                Tổng {{ currentStock }} sản phẩm còn hàng
              </span>
              <span v-else-if="currentStock > 10">Còn hàng ({{ currentStock }} sản phẩm)</span>
              <span v-else-if="currentStock > 0">Sắp hết — Chỉ còn {{ currentStock }} sản phẩm</span>
              <span v-else>Tạm thời hết hàng</span>
            </div>

            <!-- Mô tả ngắn -->
            <p class="text-gray-600 font-light leading-relaxed mb-8" v-if="product.moTa">{{ product.moTa }}</p>

            <!-- Nút hành động -->
            <div class="flex items-center gap-3 flex-wrap mb-8 pb-8 border-b border-gray-100">
              <button
                @click="addToCart(false)"
                class="flex-1 border border-black bg-white text-black py-4 text-xs font-medium uppercase tracking-[0.2em]
                       transition-all duration-300 ease-out
                       hover:bg-black hover:text-white hover:tracking-[0.24em]
                       active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                :disabled="!canOrder"
              >
                Thêm vào giỏ hàng
              </button>
              <button
                @click="addToCart(true)"
                class="flex-1 bg-black text-white py-4 text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors
                       disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-black"
                :disabled="!canOrder"
              >
                Mua ngay
              </button>
              <button
                @click="wishlistStore.toggleProductFavorite(product)"
                class="w-14 h-14 flex items-center justify-center rounded-full transition-all duration-300 shadow-md hover:scale-105"
                :class="wishlistStore.isProductFavorite(product.maSp) 
                  ? 'bg-red-500 border border-red-500 text-white hover:bg-red-600' 
                  : 'bg-red-50 border border-red-200 text-red-500 hover:bg-red-100'"
                :title="wishlistStore.isProductFavorite(product.maSp) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'"
              >
                <Heart 
                  :size="22" 
                  :stroke-width="wishlistStore.isProductFavorite(product.maSp) ? 0 : 2" 
                  :fill="wishlistStore.isProductFavorite(product.maSp) ? '#ffffff' : 'none'" 
                  :class="{'animate-bounce': wishlistStore.isProductFavorite(product.maSp)}" 
                />
              </button>
            </div>

            <!-- TABS: Chi tiết / Thành phần -->
            <template v-if="product.thanhPhan || product.huongDanSuDung">
              <div class="flex border-b border-gray-200 mb-6">
                <button
                  class="pb-4 px-4 text-xs uppercase tracking-widest transition-colors"
                  :class="activeTab === 'details' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'"
                  @click="activeTab = 'details'"
                >Chi Tiết</button>
                <button
                  v-if="product.thanhPhan"
                  class="pb-4 px-4 text-xs uppercase tracking-widest transition-colors"
                  :class="activeTab === 'ingredients' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black'"
                  @click="activeTab = 'ingredients'"
                >Thành Phần</button>
              </div>
              <div class="text-sm text-gray-500 font-light leading-relaxed min-h-[100px] whitespace-pre-line">
                <p v-if="activeTab === 'details'">{{ product.huongDanSuDung || product.moTa }}</p>
                <p v-else>{{ product.thanhPhan }}</p>
              </div>
            </template>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════
             GALLERY ẢNH SẢN PHẨM
        ══════════════════════════════════════════════════ -->
        <template v-if="allGalleryImages.length > 0">
          <div class="w-10 h-px bg-gray-200 my-16 mx-auto"></div>

          <section class="mb-16">
            <div class="flex flex-col items-center text-center mb-10">
              <span class="text-xs text-gray-400 uppercase tracking-widest mb-3">Xem thêm</span>
              <h3 class="font-heading text-2xl tracking-widest uppercase mb-4">Hình Ảnh Sản Phẩm</h3>
              <div class="w-10 h-px bg-black"></div>
            </div>

            <div class="flex flex-wrap justify-center gap-3">
              <div
                v-for="(img, idx) in allGalleryImages"
                :key="idx"
                class="relative aspect-square overflow-hidden bg-gray-100 cursor-pointer group gallery-grid-item"
                @click="openLightbox(img)"
                :title="`Xem ảnh ${idx + 1}`"
              >
                <img :src="getImageUrl(img)" :alt="`Ảnh sản phẩm ${idx + 1}`" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 transition-opacity text-lg"></i>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ══════════════════════════════════════════════════
             SẢN PHẨM GỢI Ý
        ══════════════════════════════════════════════════ -->
        <template v-if="suggestedProducts.length > 0">
          <div class="w-10 h-px bg-gray-200 my-16 mx-auto"></div>

          <section class="mb-16">
            <div class="flex flex-col items-center text-center mb-10">
              <span class="text-xs text-gray-400 uppercase tracking-widest mb-3">Có thể bạn thích</span>
              <h3 class="font-heading text-2xl tracking-widest uppercase mb-4">Sản Phẩm Gợi Ý</h3>
              <div class="w-10 h-px bg-black"></div>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-12">
              <router-link
                v-for="sp in suggestedProducts"
                :key="sp.maSp"
                :to="{ name: 'productDetail', params: { id: sp.maSp } }"
                class="group flex flex-col"
              >
                <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-4 relative border border-gray-100 group-hover:border-black transition-all duration-300">
                  <img :src="getImageUrl(sp.hinhAnhDaiDien)" :alt="sp.tenSp" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div v-if="!sp.giaTu" class="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] uppercase tracking-widest px-2.5 py-1">Hết hàng</div>
                </div>
                <p class="text-[10px] text-gray-400 uppercase tracking-widest mb-1" v-if="sp.thuongHieu">{{ sp.thuongHieu.tenThuongHieu }}</p>
                <h4 class="font-heading text-sm tracking-widest uppercase mb-1 truncate">{{ sp.tenSp }}</h4>
                <p class="text-xs text-gray-400 font-light leading-relaxed mb-2 line-clamp-2">{{ sp.moTa }}</p>
                <span class="text-sm font-light">
                  <template v-if="sp.giaTu && sp.giaDen && sp.giaTu !== sp.giaDen">
                    {{ formatSinglePrice(sp.giaTu) }} – {{ formatSinglePrice(sp.giaDen) }}
                  </template>
                  <template v-else>{{ formatSinglePrice(sp.giaTu) }}</template>
                </span>
              </router-link>
            </div>
          </section>
        </template>

      </div>
    </template>

    <!-- ══════════════════════════════════════════════════
         LIGHTBOX OVERLAY
    ══════════════════════════════════════════════════ -->
    <Teleport to="body">
      <div v-if="lightboxOpen" class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-in fade-in duration-200" @click="closeLightbox">
        <button class="absolute top-5 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/30 text-white flex items-center justify-center hover:bg-white/20 transition-colors" @click.stop="closeLightbox">
          <i class="fas fa-times"></i>
        </button>
        <div class="max-w-[90vw] max-h-[90vh] flex items-center justify-center" @click.stop>
          <img :src="getImageUrl(lightboxImg)" alt="Xem ảnh lớn" class="max-w-full max-h-[90vh] object-contain" />
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.pd-spinner {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 50%;
  animation: pd-spin 0.75s linear infinite;
}
@keyframes pd-spin {
  to { transform: rotate(360deg); }
}

.pd-slide-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid #e5e7eb;
  color: #111827;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
}
.pd-slide-btn:hover {
  background: #111827;
  color: #fff;
  border-color: #111827;
}

.font-heading {
  font-family: var(--font-heading, 'Inter', sans-serif);
  font-weight: 500;
}

/* Gallery: flex-wrap + justify-center để ảnh luôn căn giữa dù chỉ có 1-2 ảnh,
   width tính theo % để mô phỏng số cột responsive (giống grid-cols cũ) */
.gallery-grid-item {
  flex: 0 0 auto;
  width: calc(50% - 6px); /* mobile: 2 cột */
}
@media (min-width: 640px) {
  .gallery-grid-item { width: calc(33.333% - 8px); } /* sm: 3 cột */
}
@media (min-width: 1024px) {
  .gallery-grid-item { width: calc(20% - 9.6px); } /* lg: 5 cột */
}
</style>