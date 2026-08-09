<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useWishlistStore } from "@/stores/useWishlistStore";
import { Heart } from "lucide-vue-next";
import ProductReviews from "./ProductReviews.vue";

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

// Accordion nội dung (kiểu LV: "Thành phần chính" / "Thành phần" / "Hướng dẫn sử dụng")
const openPanel = ref<"details" | "ingredients" | null>("details");

// Lightbox cho gallery
const lightboxOpen      = ref(false);
const lightboxImg       = ref("");

// ======================================================
// COMPUTED
// ======================================================

// Danh sách ảnh dùng cho dải thumbnail dọc bên trái (kiểu LV):
//  - Nếu đang chọn biến thể có ảnh riêng → dùng btImageList
//  - Ngược lại → ảnh đại diện SP + gallery chung
const railImages = computed(() => {
  if (selectedBienThe.value && btImageList.value.length > 0) return btImageList.value;
  const imgs: string[] = [];
  if (product.value?.hinhAnhDaiDien) imgs.push(product.value.hinhAnhDaiDien);
  for (const img of allGalleryImages.value) {
    if (!imgs.includes(img)) imgs.push(img);
  }
  return imgs;
});

// Ảnh chính hiển thị ở khung to: luôn lấy theo slideIndex trong railImages
// (railImages tự chuyển nguồn giữa ảnh biến thể / ảnh sản phẩm tuỳ theo có đang chọn BT hay không)
const mainDisplayImage = computed(() => {
  return railImages.value[slideIndex.value] || product.value?.hinhAnhDaiDien || "";
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
  price != null ? Number(price).toLocaleString("vi-VN") + " ₫" : "—";

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
  const len = railImages.value.length;
  if (len <= 1) return;
  slideIndex.value = (slideIndex.value - 1 + len) % len;
};
const slideNext = () => {
  const len = railImages.value.length;
  if (len <= 1) return;
  slideIndex.value = (slideIndex.value + 1) % len;
};

const togglePanel = (panel: "details" | "ingredients") => {
  openPanel.value = openPanel.value === panel ? null : panel;
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
  <div class="w-full min-h-screen pb-24 bg-white">

    <!-- LOADING -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
      <div class="pd-spinner"></div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-400">Đang tải sản phẩm...</p>
    </div>

    <!-- LỖI -->
    <div v-else-if="error" class="flex flex-col items-center justify-center py-32 gap-4 max-w-[1440px] mx-auto px-6">
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-400">Không tìm thấy sản phẩm hoặc đã xảy ra lỗi.</p>
      <router-link to="/product" class="border border-black px-8 py-3 text-[11px] uppercase tracking-[0.15em] hover:bg-black hover:text-white transition-colors duration-300">
        Quay lại danh sách
      </router-link>
    </div>

    <template v-else-if="product">
      <div class="w-full pt-6 lg:pt-10 px-4 sm:px-6 lg:px-10 max-w-[1440px] mx-auto">

        <!-- BREADCRUMB -->
        <!-- / -->

        <!-- PHẦN CHÍNH: THUMB RAIL + ẢNH LỚN + THÔNG TIN -->
        <div class="flex flex-col lg:flex-row gap-0 lg:gap-12 xl:gap-20">

          <!-- CỘT ẢNH: dải thumbnail dọc (trái, desktop) + ảnh chính -->
          <div class="w-full lg:w-1/2 flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
            <!-- Ảnh chính -->
            <div class="flex-1 relative bg-[#f6f6f6] aspect-square overflow-hidden group">
              <img
                :src="getImageUrl(mainDisplayImage)"
                :alt="product.tenSp"
                class="w-full h-full object-cover cursor-zoom-in"
                @click="openLightbox(mainDisplayImage)"
              />

              <div v-if="currentStock === 0 && selectedBienThe" class="absolute inset-0 bg-white/70 flex items-center justify-center">
                <span class="text-black text-xs uppercase tracking-[0.15em] border border-black px-6 py-2 bg-white">Hết hàng</span>
              </div>

              <!-- Nút lướt trái/phải -->
              <template v-if="railImages.length > 1">
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
                <div class="absolute bottom-3 right-3 bg-white/90 text-black text-[10px] tracking-[0.1em] px-2.5 py-1 z-10">
                  {{ slideIndex + 1 }} / {{ railImages.length }}
                </div>
              </template>

              <!-- Nút phóng to -->
              <button
                class="absolute bottom-3 left-3 w-9 h-9 bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white"
                @click.stop="openLightbox(mainDisplayImage)"
                title="Phóng to"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- CỘT PHẢI: THÔNG TIN SẢN PHẨM -->
          <div class="w-full lg:w-1/2 flex flex-col pt-8 lg:pt-2 lg:py-10">

            <!-- Mã SP -->
            <p class="text-[11px] text-neutral-400 tracking-[0.05em] mb-2">{{ product.maSp }}</p>

            <!-- Thương hiệu / Danh mục -->
            <p class="text-[11px] text-neutral-500 uppercase tracking-[0.1em] mb-3" v-if="product.thuongHieu || product.danhMuc">
              {{ product.thuongHieu?.tenThuongHieu || product.danhMuc?.tenDanhMuc }}
            </p>

            <!-- Tên -->
            <h1 class="font-heading text-[26px] sm:text-[30px] leading-[1.25] tracking-[0.01em] mb-4 text-black">
              {{ product.tenSp }}
            </h1>

            <!-- GIÁ -->
            <p class="text-[15px] font-normal mb-6 text-black">
              {{ priceDisplay.text }}
            </p>

            <!-- Rating -->
            <div class="flex items-center gap-2 mb-6 pb-6 border-b border-neutral-200" v-if="product.soSao != null">
              <div class="flex gap-0.5">
                <i v-for="s in 5" :key="s" class="fas fa-star text-[11px]"
                  :class="s <= Math.round(product.soSao) ? 'text-black' : 'text-neutral-200'"></i>
              </div>
              <span class="text-[13px] text-neutral-600">{{ product.soSao }}</span>
              <span class="text-[12px] text-neutral-400">({{ product.soLuongDanhGia }} đánh giá)</span>
            </div>

            <!-- Mô tả ngắn -->
            <p class="text-[13.5px] text-neutral-600 font-light leading-relaxed mb-8" v-if="product.moTa">
              {{ product.moTa }}
            </p>

            <!-- CHỌN BIẾN THỂ (kiểu LV: "Kích cỡ") -->
            <div class="mb-6" v-if="product.bienThes?.length > 0">
              <div class="flex items-baseline justify-between text-[12px] uppercase tracking-[0.08em] text-neutral-700 mb-3">
                <span>Kích cỡ</span>
                <span class="normal-case tracking-normal text-black font-medium" v-if="selectedBienThe">{{ selectedBienThe.tenBienThe }}</span>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="bt in product.bienThes"
                  :key="bt.maBienThe"
                  type="button"
                  class="relative border px-4 py-3 text-left transition-colors duration-150"
                  :class="[
                    selectedBienThe?.maBienThe === bt.maBienThe ? 'border-black' : 'border-neutral-300 hover:border-black',
                    bt.soLuongTon === 0 ? 'opacity-40 cursor-not-allowed hover:border-neutral-300' : ''
                  ]"
                  @click="selectBienThe(bt)"
                >
                  <div class="text-[12.5px] tracking-wide truncate">{{ bt.tenBienThe }}</div>
                  <div class="text-[11px] text-neutral-500 mt-0.5">
                    {{ bt.soLuongTon > 0 ? formatSinglePrice(bt.giaBan) : 'Hết hàng' }}
                  </div>
                </button>
              </div>

              <p class="text-[11px] text-neutral-400 mt-3 flex items-center gap-1.5" v-if="!selectedBienThe && product.bienThes?.length > 1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="16" x2="12" y2="12"/>
                  <line x1="12" y1="8" x2="12.01" y2="8"/>
                </svg>
                Vui lòng chọn một kích cỡ để thêm vào giỏ
              </p>
            </div>

            <!-- Tồn kho -->
            <p class="text-[11.5px] mb-8 tracking-[0.02em]"
              :class="currentStock === 0 ? 'text-neutral-400' : currentStock <= 10 ? 'text-neutral-700' : 'text-neutral-500'">
              <span v-if="!selectedBienThe && product.bienThes?.length > 1">Tổng {{ currentStock }} sản phẩm còn hàng</span>
              <span v-else-if="currentStock > 10">Còn hàng</span>
              <span v-else-if="currentStock > 0">Sắp hết — chỉ còn {{ currentStock }} sản phẩm</span>
              <span v-else>Tạm thời hết hàng</span>
            </p>

            <!-- Nút hành động (kiểu LV: nút đen full-width bo góc 0) -->
            <div class="flex flex-col gap-3 mb-2">
              <button
                @click="addToCart(false)"
                class="w-full bg-black text-white py-[15px] text-[12px] font-normal uppercase tracking-[0.15em]
                       transition-colors duration-200 hover:bg-neutral-800
                       disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-black"
                :disabled="!canOrder"
              >
                Thêm vào giỏ hàng
              </button>
              <div class="flex gap-3">
                <button
                  @click="addToCart(true)"
                  class="flex-1 border border-black text-black py-[14px] text-[12px] font-normal uppercase tracking-[0.15em]
                         transition-colors duration-200 hover:bg-black hover:text-white
                         disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-black"
                  :disabled="!canOrder"
                >
                  Mua ngay
                </button>
                <button
                  @click="wishlistStore.toggleProductFavorite(product)"
                  class="w-[52px] h-[52px] flex-shrink-0 flex items-center justify-center border transition-colors duration-200"
                  :class="wishlistStore.isProductFavorite(product.maSp)
                    ? 'border-black bg-black text-white'
                    : 'border-black text-black hover:bg-black hover:text-white'"
                  :title="wishlistStore.isProductFavorite(product.maSp) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'"
                >
                  <Heart
                    :size="18"
                    :stroke-width="1.5"
                    :fill="wishlistStore.isProductFavorite(product.maSp) ? 'currentColor' : 'none'"
                  />
                </button>
              </div>
            </div>

            <!-- ACCORDION: Chi tiết / Thành phần (kiểu LV) -->
            <div class="mt-8 border-t border-neutral-200" v-if="product.moTa || product.huongDanSuDung || product.thanhPhan">

              <div class="border-b border-neutral-200">
                <button
                  class="w-full flex items-center justify-between py-4 text-left"
                  @click="togglePanel('details')"
                >
                  <span class="text-[12.5px] uppercase tracking-[0.08em] text-black">Chi Tiết Sản Phẩm</span>
                  <span class="text-lg leading-none font-light">{{ openPanel === 'details' ? '−' : '+' }}</span>
                </button>
                <div v-show="openPanel === 'details'" class="pb-5 text-[13px] text-neutral-600 font-light leading-relaxed whitespace-pre-line">
                  {{ product.huongDanSuDung || product.moTa }}
                </div>
              </div>

              <div class="border-b border-neutral-200" v-if="product.thanhPhan">
                <button
                  class="w-full flex items-center justify-between py-4 text-left"
                  @click="togglePanel('ingredients')"
                >
                  <span class="text-[12.5px] uppercase tracking-[0.08em] text-black">Thành Phần</span>
                  <span class="text-lg leading-none font-light">{{ openPanel === 'ingredients' ? '−' : '+' }}</span>
                </button>
                <div v-show="openPanel === 'ingredients'" class="pb-5 text-[13px] text-neutral-600 font-light leading-relaxed whitespace-pre-line">
                  {{ product.thanhPhan }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════════════════════
             GALLERY ẢNH SẢN PHẨM
        ══════════════════════════════════════════════════ -->
        <template v-if="allGalleryImages.length > 0">
          <div class="w-full h-px bg-neutral-200 my-16 lg:my-24"></div>

          <section class="mb-16 lg:mb-24">
            <h3 class="font-heading text-xl sm:text-2xl tracking-[0.02em] text-center mb-10 lg:mb-12 text-black">
              Hình Ảnh Sản Phẩm
            </h3>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              <div
                v-for="(img, idx) in allGalleryImages"
                :key="idx"
                class="relative aspect-square overflow-hidden bg-[#f6f6f6] cursor-pointer group"
                @click="openLightbox(img)"
                :title="`Xem ảnh ${idx + 1}`"
              >
                <img :src="getImageUrl(img)" :alt="`Ảnh sản phẩm ${idx + 1}`" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-white opacity-0 group-hover:opacity-100 transition-opacity">
                    <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
              </div>
            </div>
          </section>
        </template>

        <!-- ══════════════════════════════════════════════════
             ĐÁNH GIÁ SẢN PHẨM
        ══════════════════════════════════════════════════ -->
        <div class="w-full h-px bg-neutral-200 mb-16 lg:mb-24"></div>
        <ProductReviews :ma-sp="product.maSp" />

        <!-- ══════════════════════════════════════════════════
             SẢN PHẨM GỢI Ý (kiểu LV: "You may also be interested in")
        ══════════════════════════════════════════════════ -->
        <template v-if="suggestedProducts.length > 0">
          <div class="w-full h-px bg-neutral-200 my-16 lg:my-24"></div>

          <section class="mb-16 lg:mb-20">
            <h3 class="font-heading text-xl sm:text-2xl tracking-[0.02em] text-center mb-10 lg:mb-12 text-black">
              Có Thể Bạn Cũng Thích
            </h3>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-10 lg:gap-y-12">
              <router-link
                v-for="sp in suggestedProducts"
                :key="sp.maSp"
                :to="{ name: 'productDetail', params: { id: sp.maSp } }"
                class="group flex flex-col"
              >
                <div class="aspect-square overflow-hidden bg-[#f6f6f6] mb-4 relative">
                  <img :src="getImageUrl(sp.hinhAnhDaiDien)" :alt="sp.tenSp" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
                  <div v-if="!sp.giaTu" class="absolute bottom-2 left-2 bg-white text-black text-[10px] uppercase tracking-[0.1em] px-2.5 py-1 border border-black">Hết hàng</div>
                </div>
                <p class="text-[11px] text-neutral-500 uppercase tracking-[0.08em] mb-1" v-if="sp.thuongHieu">{{ sp.thuongHieu.tenThuongHieu }}</p>
                <h4 class="font-heading text-[13.5px] leading-snug mb-1.5 text-black">{{ sp.tenSp }}</h4>
                <span class="text-[13px] text-neutral-700">
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
      <div v-if="lightboxOpen" class="fixed inset-0 z-[9999] bg-white flex items-center justify-center animate-in fade-in duration-200" @click="closeLightbox">
        <button class="absolute top-6 right-6 sm:top-8 sm:right-10 w-10 h-10 flex items-center justify-center text-black hover:opacity-60 transition-opacity" @click.stop="closeLightbox">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <div class="max-w-[92vw] max-h-[88vh] flex items-center justify-center" @click.stop>
          <img :src="getImageUrl(lightboxImg)" alt="Xem ảnh lớn" class="max-w-full max-h-[88vh] object-contain" />
        </div>
      </div>
    </Teleport>

  </div>
</template>

<style scoped>
.pd-spinner {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e5e5;
  border-top-color: #111111;
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
  width: 34px;
  height: 34px;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  color: #111111;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  z-index: 10;
  opacity: 0;
}
.group:hover .pd-slide-btn {
  opacity: 1;
}
.pd-slide-btn:hover {
  background: #111111;
  color: #fff;
}

/* Louis Vuitton dùng serif thanh mảnh cho heading — thay bằng font-heading
   sẵn có trong theme; nếu theme có khai báo font serif riêng, override tại đây. */
.font-heading {
  font-family: var(--font-heading, 'Playfair Display', Georgia, serif);
  font-weight: 400;
}

/* Scrollbar mảnh cho dải thumbnail dọc */
.pd-scroll::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}
.pd-scroll::-webkit-scrollbar-thumb {
  background: #d4d4d4;
}
.pd-scroll::-webkit-scrollbar-track {
  background: transparent;
}
</style>