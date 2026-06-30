<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;
const route = useRoute();
const router = useRouter();

// Vị trí "neo" đầu danh sách sản phẩm — dùng để auto scroll khi đổi trang / vào lại trang
const productsListRef = ref<HTMLElement | null>(null);
const scrollToProductsTop = (smooth = true) => {
  nextTick(() => {
    productsListRef.value?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "start",
    });
  });
};

const getImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/${img}`;
};

// ======================================================
// STATE
// ======================================================
const products       = ref<any[]>([]);
const danhMucList    = ref<any[]>([]);
const thuongHieuList = ref<any[]>([]);

const searchQuery        = ref("");
const selectedDanhMuc     = ref("all");
const selectedThuongHieu = ref("all");
const selectedPriceRange = ref("all");

// ======================================================
// PAGINATION
// ======================================================
const currentPage = ref(1);
const pageSize    = ref(12);
const totalPages  = ref(1);

const changePage = async (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  await fetchFiltered();
  scrollToProductsTop(); // 🔥 auto scroll lên sản phẩm đầu tiên khi đổi trang
};

const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const total   = totalPages.value;
  const current = currentPage.value;
  if (total <= 5) {
    for (let i = 1; i <= total; i++) pages.push(i);
  } else if (current <= 3) {
    pages.push(1, 2, 3, "...", total);
  } else if (current >= total - 2) {
    pages.push(1, "...", total - 2, total - 1, total);
  } else {
    pages.push(1, "...", current - 1, current, current + 1, "...", total);
  }
  return pages;
});

// ======================================================
// FETCH
// ======================================================
const fetchInit = async () => {
  try {
    const res = await axios.get(`${API}/api/SanPham/init`);
    danhMucList.value    = res.data.danhMuc    || [];
    thuongHieuList.value = res.data.thuongHieu || [];
  } catch (err) {
    console.error("fetchInit error:", err);
  }
};

const fetchFiltered = async () => {
  try {
    const res = await axios.get(`${API}/api/SanPham/filter`, {
      params: {
        search:     searchQuery.value,
        danhMuc:    selectedDanhMuc.value,
        thuongHieu: selectedThuongHieu.value,
        priceRange: selectedPriceRange.value,
        page:       currentPage.value,
        pageSize:   pageSize.value,
      },
    });
    products.value   = res.data.data;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    console.error("fetchFiltered error:", err);
  }
};

const activeCategoryName = computed(() => {
  if (selectedDanhMuc.value === "all") return null;
  return danhMucList.value.find(d => d.maDMSP === selectedDanhMuc.value)?.tenDanhMuc || null;
});

// ======================================================
// FORMAT — hiển thị dải giá "100k – 200k" hoặc giá đơn
// ======================================================
const formatSinglePrice = (price?: number | null) =>
  price != null ? Number(price).toLocaleString("vi-VN") + "đ" : "—";

// Trả về { text, isRange }
const getPriceDisplay = (p: any) => {
  const min = p.giaTu;
  const max = p.giaDen;
  if (min == null) return { text: "Liên hệ", isRange: false };
  if (max == null || min === max) return { text: formatSinglePrice(min), isRange: false };
  return {
    text: `${formatSinglePrice(min)} – ${formatSinglePrice(max)}`,
    isRange: true,
  };
};

// ======================================================
// WATCH + MOUNT
// ======================================================
watch(
  [searchQuery, selectedDanhMuc, selectedThuongHieu, selectedPriceRange],
  () => { currentPage.value = 1; fetchFiltered(); }
);

// Đồng bộ lại danh mục mỗi khi query ?danhMuc=... đổi (vd: bấm mega menu khi đang ở trang Product).
// Vue Router không remount component nếu route name không đổi, nên onMounted không tự chạy lại —
// cần watch riêng route.query.danhMuc để cập nhật state.
watch(
  () => route.query.danhMuc,
  (newDanhMuc) => {
    const value = (newDanhMuc as string) || "all";
    if (selectedDanhMuc.value !== value) {
      selectedDanhMuc.value = value; // sẽ tự trigger fetchFiltered() qua watch ở trên
    }
  }
);

onMounted(async () => {
  await fetchInit();
  if (route.query.danhMuc) {
    selectedDanhMuc.value = route.query.danhMuc as string;
  }
  await fetchFiltered();

  // 🔥 mỗi lần vào lại trang (mount) thì auto scroll lên đầu danh sách sản phẩm
  scrollToProductsTop(false);
});
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">

    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">

      <!-- HERO TITLE -->
      <div class="text-center mb-10">
        <h1 class="font-heading text-3xl md:text-4xl uppercase tracking-widest text-black">
          {{ activeCategoryName || "Sản phẩm chăm sóc tóc chính hãng" }}
        </h1>
      </div>

      <!-- ĐANG LỌC THEO DANH MỤC -->
      <div v-if="activeCategoryName" class="flex items-center justify-center gap-3 mb-8 text-[11px] uppercase tracking-widest text-gray-400">
        <span>Đang xem: <strong class="text-black">{{ activeCategoryName }}</strong></span>
        <button @click="selectedDanhMuc = 'all'" class="underline hover:text-black transition-colors">
          Xem tất cả
        </button>
      </div>

      <!-- TOP BAR: số lượng + tìm kiếm + lọc giá -->
      <div ref="productsListRef" class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-8 pb-4 border-b border-gray-100">
        <span class="text-xs text-gray-400 uppercase tracking-widest">{{ products.length }} Sản phẩm</span>

        <div class="flex flex-wrap gap-4 items-center">
          <div class="relative">
            <svg class="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/>
              <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              class="text-xs uppercase tracking-widest bg-transparent border-b border-gray-200 focus:outline-none focus:border-black pl-5 py-1 w-44 md:w-56"
            />
          </div>

          <select v-model="selectedPriceRange" class="text-xs uppercase tracking-widest bg-transparent focus:outline-none cursor-pointer">
            <option value="all">Tất cả mức giá</option>
            <option value="low">Dưới 200.000đ</option>
            <option value="mid">200k – 500k</option>
            <option value="high">Trên 500.000đ</option>
          </select>
        </div>
      </div>

      <!-- GRID SẢN PHẨM -->
      <div v-if="Array.isArray(products) && products.length" class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-16">
        <div
          v-for="p in products"
          :key="p.maSp"
          class="group flex flex-col cursor-pointer"
          @click="router.push({ name: 'productDetail', params: { id: p.maSp } })"
        >
          <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-6 relative border border-gray-100 group-hover:border-black transition-all duration-300">

            <!-- HOT BADGE -->
            <div v-if="p.isHot" class="hot-badge">
              <i class="fas fa-fire"></i> HOT
            </div>

            <!-- RIBBON SẮP HẾT / HẾT HÀNG -->
            <span
              v-else-if="p.soLuongTon > 0 && p.soLuongTon <= 10"
              class="absolute top-3 left-3 z-10 bg-black text-white text-[10px] uppercase tracking-widest px-3 py-1.5"
            >
              Sắp hết
            </span>
            <span
              v-else-if="p.soLuongTon === 0"
              class="absolute top-3 left-3 z-10 bg-gray-400 text-white text-[10px] uppercase tracking-widest px-3 py-1.5"
            >
              Hết hàng
            </span>

            <img :src="getImageUrl(p.hinhAnhDaiDien)" :alt="p.tenSp" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />

            <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button
                class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                :disabled="p.soLuongTon === 0"
                @click.stop="router.push({ name: 'productDetail', params: { id: p.maSp } })"
              >
                {{ p.soLuongTon === 0 ? "Hết hàng" : "Xem ngay" }}
              </button>
            </div>
          </div>

          <p v-if="p.thuongHieu?.tenThuongHieu" class="text-[10px] text-gray-400 uppercase tracking-widest mb-1">
            {{ p.thuongHieu.tenThuongHieu }}
          </p>

          <h3 class="font-heading text-sm tracking-widest uppercase mb-1 line-clamp-2 min-h-[2.6em]">
            {{ p.tenSp }}
          </h3>

          <div v-if="p.soSao != null" class="flex items-center gap-1 mb-2 text-[11px] text-gray-400">
            <svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"/>
            </svg>
            <span class="text-black font-medium">{{ p.soSao }}</span>
            <span>({{ p.soLuongDanhGia }})</span>
          </div>
          <p v-else class="text-[11px] text-gray-300 italic mb-2">Chưa có đánh giá</p>

          <span class="font-semibold tracking-tight mt-auto" :class="getPriceDisplay(p).isRange ? 'text-xs' : 'text-base'">
            {{ getPriceDisplay(p).text }}
          </span>
        </div>
      </div>

      <!-- KHÔNG CÓ SẢN PHẨM -->
      <div v-else class="text-center py-24 border border-gray-100 mt-6">
        <p class="text-xs uppercase tracking-widest text-gray-400 mb-4">Không có sản phẩm nào phù hợp.</p>
        <button
          @click="selectedDanhMuc='all'; searchQuery=''; selectedThuongHieu='all'; selectedPriceRange='all'"
          class="text-[10px] uppercase tracking-widest border border-black px-6 py-2 hover:bg-black hover:text-white transition-colors"
        >
          Xoá bộ lọc
        </button>
      </div>

      <!-- PHÂN TRANG -->
      <div v-if="totalPages > 1" class="mt-24 pt-8 border-t border-gray-100 flex items-center justify-center gap-12 lg:gap-24">
        <button
          type="button"
          class="text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="currentPage === 1"
          @click="changePage(currentPage - 1)"
        >
          &larr; Trước
        </button>

        <div class="flex items-center gap-2 lg:gap-4 text-xs font-light">
          <button
            v-for="(page, index) in visiblePages"
            :key="index"
            type="button"
            class="w-8 h-8 flex items-center justify-center transition-colors"
            :class="page === currentPage
              ? 'border-b border-black text-black'
              : page === '...' ? 'text-gray-300 cursor-default' : 'text-gray-400 hover:text-black'"
            :disabled="page === '...'"
            @click="typeof page === 'number' && changePage(page)"
          >
            {{ page === "..." ? "..." : page }}
          </button>
        </div>

        <button
          type="button"
          class="text-[10px] uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
          :disabled="currentPage === totalPages"
          @click="changePage(currentPage + 1)"
        >
          Sau &rarr;
        </button>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* HOT badge — đồng bộ với Services.vue */
.hot-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  background: #d92d20;
  color: #fff;
  padding: 7px 14px;
  font-family: "Jost", sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 0;
  box-shadow: none;
  animation: none;
}
.hot-badge i {
  font-size: 10px;
}
</style>