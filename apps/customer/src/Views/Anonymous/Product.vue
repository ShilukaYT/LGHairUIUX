<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { useWishlistStore } from "@/stores/useWishlistStore";
import { Heart } from "lucide-vue-next";

const API = import.meta.env.VITE_API_URL;
const route = useRoute();
const router = useRouter();
const wishlistStore = useWishlistStore();

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
const pageSize    = ref(9);
const totalPages  = ref(1);

const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  fetchFiltered();
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
});
</script>

<template>
  <div class="products-page-container">

    <!-- HERO -->
    <section class="products-hero text-center">
      <div class="container">
        <!-- <div v-if="activeCategoryName" class="category-breadcrumb-bar mb-3">
          <router-link to="/productCategories" class="breadcrumb-link">
            <i class="fas fa-th-large me-1"></i>Danh mục
          </router-link>
          <i class="fas fa-chevron-right mx-2 breadcrumb-sep"></i>
          <span class="breadcrumb-current">{{ activeCategoryName }}</span>
        </div> -->
        <h3 class="fw-900" style="font-size: 2rem">
          {{ activeCategoryName || "Sản phẩm chăm sóc tóc chính hãng tại Minh Tâm Hair" }}
        </h3>
      </div>
    </section>

    <!-- BỘ LỌC -->
    <section class="container filter-section">
      <div class="filter-bar-custom">
        <div class="search-box-wrapper">
          <i class="fas fa-search search-icon"></i>
          <input v-model="searchQuery" type="text" placeholder="Tìm kiếm sản phẩm..." class="filter-control" />
        </div>
        <!-- <div class="custom-select-wrapper">
          <select v-model="selectedDanhMuc" class="filter-control select-input">
            <option value="all">Tất cả danh mục</option>
            <option v-for="dm in danhMucList" :key="dm.maDMSP" :value="dm.maDMSP">{{ dm.tenDanhMuc }}</option>
          </select>
          <i class="fas fa-chevron-down arrow-icon"></i>
        </div>
        <div class="custom-select-wrapper">
          <select v-model="selectedThuongHieu" class="filter-control select-input">
            <option value="all">Tất cả thương hiệu</option>
            <option v-for="th in thuongHieuList" :key="th.maTh" :value="th.maTh">{{ th.tenThuongHieu }}</option>
          </select>
          <i class="fas fa-chevron-down arrow-icon"></i>
        </div> -->
        <div class="filter-group-select">
          <div class="custom-select-wrapper">
            <select v-model="selectedPriceRange" class="filter-control select-input">
              <option value="all">Tất cả mức giá</option>
              <option value="low">Dưới 200.000đ</option>
              <option value="mid">200k – 500k</option>
              <option value="high">Trên 500.000đ</option>
            </select>
            <i class="fas fa-chevron-down arrow-icon"></i>
          </div>
        </div>
      </div>
    </section>

    <!-- BREADCRUMB DANH MỤC ĐANG LỌC -->
    <div v-if="activeCategoryName" class="container" style="padding-top: 12px; padding-bottom: 0;">
      <div class="active-category-bar">
        <span class="active-category-label">
          <i class="fas fa-filter" style="margin-right:6px; font-size:10px;"></i>
          Đang xem: <strong>{{ activeCategoryName }}</strong>
        </span>
        <button class="clear-category-btn" @click="selectedDanhMuc = 'all'">
          <i class="fas fa-times"></i> Xem tất cả
        </button>
      </div>
    </div>

    <!-- DANH SÁCH SẢN PHẨM -->
    <section class="container py-5 products-grid-layout">
      <div v-if="Array.isArray(products) && products.length" class="row g-4">
        <div v-for="p in products" :key="p.maSp" class="col-lg-4 col-md-6" style="padding-bottom:28px">
          <router-link
            :to="{ name: 'productDetail', params: { id: p.maSp } }"
            style="text-decoration:none;color:inherit;display:block;height:100%"
          >
            <div class="product-card-item">

              <!-- Ribbon -->
              <div v-if="p.soLuongTon > 0 && p.soLuongTon <= 10" class="ribbon-wrapper">
                <div class="ribbon ribbon-low">Sắp hết</div>
              </div>
              <div v-if="p.soLuongTon === 0" class="ribbon-wrapper">
                <div class="ribbon ribbon-out">Hết hàng</div>
              </div>

              <!-- Nội dung -->
              <div class="card-content">
                <div class="product-brand" v-if="p.thuongHieu?.tenThuongHieu">{{ p.thuongHieu.tenThuongHieu }}</div>
                <h3 class="product-title">{{ p.tenSp }}</h3>

                <div class="rating-mini-box">
                  <template v-if="p.soSao != null">
                    <svg class="gold-star" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"/>
                    </svg>
                    <span class="r-number">{{ p.soSao }}</span>
                    <span class="r-count">({{ p.soLuongDanhGia }} đánh giá)</span>
                  </template>
                  <span v-else class="no-rating">Chưa có đánh giá</span>
                </div>

                <!-- <div class="d-flex flex-wrap gap-1 mb-1">
                  <span v-if="p.danhMuc" class="product-category-tag">
                    <i class="fas fa-tag"></i>{{ p.danhMuc.tenDanhMuc }}
                  </span>
                  <span v-if="p.soBienThe > 1" class="bien-the-tag">
                    <i class="fas fa-layer-group"></i>{{ p.soBienThe }} lựa chọn
                  </span>
                </div> -->

                <div class="service-desc-group">
                  <p class="product-desc">{{ p.moTa }}</p>
                </div>
              </div>

              <!-- Ảnh -->
              <div class="product-image-container">
                <img :src="getImageUrl(p.hinhAnhDaiDien)" :alt="p.tenSp" class="product-main-img" />
              </div>

              <!-- Tình trạng kho -->
              <div class="stock-badge"
                :class="{ 'stock-low': p.soLuongTon > 0 && p.soLuongTon <= 10, 'stock-out': p.soLuongTon === 0 }">
                <span v-if="p.soLuongTon > 10">Còn hàng ({{ p.soLuongTon }})</span>
                <span v-else-if="p.soLuongTon > 0">Còn {{ p.soLuongTon }} sản phẩm</span>
                <span v-else>Hết hàng</span>
              </div>

              <!-- GIÁ + NÚT — hiển thị dải giá -->
              <div class="price-button d-flex justify-content-between align-items-center">
                <div class="price-values">
                  <span class="main-price" :class="{ 'price-range': getPriceDisplay(p).isRange }">
                    {{ getPriceDisplay(p).text }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <button 
                    @click.stop.prevent="wishlistStore.toggleProductFavorite(p)" 
                    class="btn-favorite-inline flex items-center justify-content-center transition-colors"
                    :class="{ 'is-favorite': wishlistStore.isProductFavorite(p.maSp) }"
                    :title="wishlistStore.isProductFavorite(p.maSp) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'"
                  >
                    <Heart 
                      :size="18" 
                      :stroke-width="wishlistStore.isProductFavorite(p.maSp) ? 0 : 2" 
                      :fill="wishlistStore.isProductFavorite(p.maSp) ? '#ffffff' : 'none'" 
                    />
                  </button>

                  <button class="btn-order-now" :class="{ 'btn-disabled': p.soLuongTon === 0 }">
                    {{ p.soLuongTon === 0 ? "Hết hàng" : "Xem ngay" }}
                  </button>
                </div>
              </div>

            </div>
          </router-link>
        </div>
      </div>

      <!-- Không có sản phẩm -->
      <div v-else class="text-center py-5 no-result-box">
        <img src="https://cdn-icons-png.flaticon.com/512/6134/6134065.png" width="80" class="mb-3 opacity-50" />
        <p class="text-muted mb-3">Không có sản phẩm nào phù hợp.</p>
        <button class="btn-clear-filter"
          @click="selectedDanhMuc='all'; searchQuery=''; selectedThuongHieu='all'; selectedPriceRange='all'">
          Xoá bộ lọc
        </button>
      </div>
    </section>

    <!-- PHÂN TRANG -->
    <div class="pagination-wrapper" v-if="totalPages > 1">
      <button type="button" class="pagination-btn prev-next" :disabled="currentPage === 1" @click="changePage(currentPage - 1)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="page-numbers">
        <button v-for="(page, index) in visiblePages" :key="index"
          class="page-num-btn" :class="{ active: currentPage === page }"
          @click="typeof page === 'number' && changePage(page)"
          :disabled="page === '...'">
          {{ page === "..." ? "..." : typeof page === "number" && page < 10 ? "0" + page : page }}
        </button>
      </div>
      <button type="button" class="pagination-btn prev-next" :disabled="currentPage === totalPages" @click="changePage(currentPage + 1)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M5 2L10 7L5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

  </div>
</template>

<style scoped>

/* =========================================================
   FONT — Cormorant Garamond (heading) + Jost (body)
   ========================================================= */

.font-playfair { font-family: "Cormorant Garamond", serif; }
.font-poppins  { font-family: "Jost", sans-serif; }
.fw-900        { font-weight: 600 !important; }

/* =========================================================
   DESIGN TOKENS
   ========================================================= */
.products-page-container {
  --ink: #1a1a1a;
  --ink-soft: #4a4a4a;
  --muted: #999999;
  --muted-light: #bdbdbd;
  --line: #e7e5e2;
  --bg: #ffffff;
  --bg-soft: #fafafa;

  font-family: "Jost", sans-serif;
  background: var(--bg);
  overflow-x: hidden;
  width: 100%;
  margin: 0 auto;
  color: var(--ink);
}

/* =========================================================
   HERO
   ========================================================= */
.products-hero { padding: 100px 0 50px; }

.main-title-premium {
  font-family: "Cormorant Garamond", serif;
  font-size: 3.4rem;
  font-weight: 600;
  letter-spacing: 6px;
  line-height: 1.2;
  margin-bottom: 5px;
  color: var(--ink);
  text-transform: uppercase;
}

.gold-divider-thick {
  width: 50px;
  height: 1px;
  background: var(--ink);
  margin: 28px auto;
  border-radius: 0;
}

.section-subtitle {
  font-family: "Jost", sans-serif;
  font-size: 0.75rem;
  font-weight: 300;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
}

/* Breadcrumb bar */
.category-breadcrumb-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--muted);
  font-family: "Jost", sans-serif;
}
.breadcrumb-link { color: var(--ink); text-decoration: none; font-weight: 500; transition: opacity .2s; }
.breadcrumb-link:hover { opacity: .6; }
.breadcrumb-sep { font-size: 9px; color: var(--muted-light); }
.breadcrumb-current { color: var(--ink); font-weight: 500; }

.btn-clear-filter {
  display: inline-flex; align-items: center; gap: 6px; padding: 8px 22px;
  border-radius: 0; border: 1px solid var(--ink); background: transparent; color: var(--ink);
  font-size: 11px; font-family: "Jost", sans-serif; text-transform: uppercase; letter-spacing: 1.5px;
  font-weight: 500; cursor: pointer; transition: all 0.3s ease;
}
.btn-clear-filter:hover { background: var(--ink); color: #fff; }

/* =========================================================
   ACTIVE CATEGORY BREADCRUMB BAR
   ========================================================= */
.active-category-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border: 1px solid var(--line);
  background: var(--bg-soft);
  font-family: "Jost", sans-serif;
  font-size: 12px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink);
}
.active-category-label strong { font-weight: 500; }
.clear-category-btn {
  background: none; border: 1px solid var(--line); color: var(--ink-soft);
  font-size: 10px; font-family: "Jost", sans-serif; text-transform: uppercase;
  letter-spacing: 1.5px; padding: 4px 12px; cursor: pointer; transition: all 0.2s;
}
.clear-category-btn:hover { border-color: var(--ink); color: var(--ink); }

/* =========================================================
   FILTER BAR
   ========================================================= */
.filter-section { margin-bottom: 25px; }

.filter-bar-custom {
  background: var(--bg);
  padding: 12px;
  border-radius: 0;
  border: 1px solid var(--line);
  box-shadow: none;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  overflow: hidden;
}

.filter-control {
  width: 100%;
  height: 50px;
  border: 1px solid var(--line);
  border-radius: 0;
  padding: 0 18px;
  font-size: 13px;
  font-family: "Jost", sans-serif;
  letter-spacing: 0.5px;
  outline: none;
  background: var(--bg);
  transition: 0.3s ease-in-out;
  color: var(--ink);
  font-weight: 300;
}
.filter-control::placeholder { color: var(--muted-light); }
.filter-control:focus { border-color: var(--ink); box-shadow: none; }

.search-box-wrapper { flex: 2; position: relative; min-width: 0; width: 100%; }
.search-icon {
  position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
  color: var(--muted-light); z-index: 2; font-size: 13px;
}
.search-box-wrapper .filter-control { padding-left: 50px; }

.filter-group-select { flex: 1.5; display: flex; gap: 12px; min-width: 0; width: 100%; }
.custom-select-wrapper { flex: 1; position: relative; }
.select-input {
  appearance: none; cursor: pointer; padding-right: 38px;
  text-transform: uppercase; font-size: 11px; letter-spacing: 1px;
}
.arrow-icon {
  position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
  color: var(--muted-light); pointer-events: none; font-size: 11px;
}

/* =========================================================
   GRID FIX — đảm bảo 3 cột trên desktop dù Bootstrap CSS
   không có sẵn hoặc bị override
   ========================================================= */
:deep(.row) {
  display: flex !important;
  flex-wrap: wrap !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
:deep(.col-lg-4) {
  width: 33.333% !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
}
:deep(.col-md-6) {
  width: 33.333% !important;
}
:deep(.container) {
  margin-left: auto !important;
  margin-right: auto !important;
}

/* =========================================================
   PRODUCT GRID / CARD
   ========================================================= */
.products-grid-layout { padding-bottom: 10px !important; }

.product-card-item {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  border-radius: 0;
  border: 1px solid var(--line);
  padding: 18px;
  width: 100%;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: none;
  transition: all 0.4s ease;
}
.product-card-item:hover { transform: translateY(-6px); border-color: var(--ink); box-shadow: none; }

/* Ribbon */
.ribbon-wrapper { position: absolute; top: 0; right: 0; width: 80px; height: 80px; overflow: hidden; z-index: 10; }
.ribbon {
  text-align: center; font-family: "Jost", sans-serif; font-weight: 600; font-size: 10px;
  text-transform: uppercase; padding: 6px 0; width: 112px; position: absolute; top: 19px; right: -26px;
  transform: rotate(45deg); box-shadow: none; letter-spacing: 1.5px;
}
.ribbon-low { background: var(--ink); color: #fff; }
.ribbon-out { background: var(--muted); color: #fff; }

/* Image */
.product-image-container {
  width: 100%;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 0;
  aspect-ratio: 4 / 5;
  background: var(--bg-soft);
  order: 2;
}
.product-main-img { width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; transition: transform 1s ease; }
.product-card-item:hover .product-main-img { transform: scale(1.04); }

.card-content { flex: 0 0 auto; order: 1; }

.product-brand {
  font-family: "Jost", sans-serif; font-size: 11px; font-weight: 500;
  text-transform: uppercase; letter-spacing: 1.5px; color: var(--muted); margin-bottom: 4px;
}

.product-title {
  font-family: "Jost", sans-serif;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--ink);
  min-height: 40px;
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.product-category-tag, .bien-the-tag {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 10px; font-family: "Jost", sans-serif; text-transform: uppercase; letter-spacing: 1px;
  color: var(--muted); border: 1px solid var(--line); padding: 3px 10px; border-radius: 0; margin-bottom: 8px;
}
.product-category-tag i, .bien-the-tag i { font-size: 9px; color: var(--ink-soft); }

.service-desc-group { flex-grow: 1; }
.product-desc {
  font-family: "Jost", sans-serif; color: var(--muted); font-size: 12px; font-weight: 300;
  line-height: 1.6; min-height: 34px; margin: 0 0 10px;
  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}

/* Rating */
.rating-mini-box { display: flex; align-items: center; margin-bottom: 8px; font-family: "Jost", sans-serif; min-height: 24px; }
.gold-star { color: var(--ink); margin-right: 5px; display: inline-block; vertical-align: -1px; flex-shrink: 0; }
.r-number { font-weight: 600; color: var(--ink); font-size: 13px; }
.r-count { color: var(--muted); font-size: 11px; margin-left: 5px; font-weight: 300; }
.no-rating { font-size: 11px; color: var(--muted-light); font-style: italic; font-weight: 300; }

/* Stock badge */
.stock-badge {
  width: auto;
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--line);
  color: var(--muted);
  padding: 4px 14px;
  border-radius: 0;
  font-size: 10px;
  font-family: "Jost", sans-serif;
  font-weight: 400;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  background-color: transparent;
  margin-top: 12px;
  margin-bottom: 12px;
  order: 3;
  transition: all 0.3s ease;
}
.product-card-item:hover .stock-badge:not(.stock-low):not(.stock-out) { border-color: var(--ink); color: var(--ink); }
.stock-badge.stock-low { color: var(--ink-soft); border-color: var(--ink-soft); }
.stock-badge.stock-out { color: var(--muted-light); border-color: var(--line); }

/* Price / order button */
.price-button {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg);
  color: var(--ink);
  border: 1px solid var(--ink);
  text-align: center;
  padding: 12px 15px;
  border-radius: 0;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  order: 4;
  margin-top: auto;
}
.price-button:hover { background: var(--ink); border-color: var(--ink); transform: none; box-shadow: none; }
.price-button:hover .main-price { color: #fff; }

.price-values { display: flex; flex-direction: column; text-align: left; }
.main-price {
  font-family: "Jost", sans-serif; font-weight: 500; font-size: 1.05rem;
  letter-spacing: 0.5px; color: var(--ink); transition: color 0.3s ease;
}
.main-price.price-range { font-size: 0.9rem; }

.btn-order-now {
  background: var(--ink);
  color: #fff;
  border: 1px solid var(--ink);
  padding: 8px 16px;
  border-radius: 0;
  font-size: 10px;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 2px;
  transition: all 0.3s ease;
  white-space: nowrap;
}
.btn-order-now:hover:not(.btn-disabled) { background: var(--bg); color: var(--ink); }
.price-button:hover .btn-order-now { background: #fff; color: var(--ink); border-color: #fff; }
.btn-disabled { background: var(--muted-light); border-color: var(--muted-light); cursor: not-allowed; }

/* No result */
.no-result-box { background: var(--bg-soft); border-radius: 0; border: 1px solid var(--line); padding: 60px 0; margin-top: 30px; }
.no-result-box p { font-family: "Jost", sans-serif; font-weight: 300; letter-spacing: 1px; }

/* =========================================================
   PAGINATION
   ========================================================= */
.pagination-wrapper {
  display: flex; justify-content: center; align-items: center; gap: 16px;
  margin-top: 16px; margin-bottom: 50px; font-family: "Jost", sans-serif;
}
.page-numbers { display: flex; gap: 8px; align-items: center; }
.page-num-btn {
  background: transparent; border: none; border-bottom: 1px solid transparent;
  color: var(--muted); font-size: 13px; font-weight: 400; letter-spacing: 1px;
  width: 36px; height: 36px; border-radius: 0; transition: all 0.3s ease; position: relative; cursor: pointer;
}
.page-num-btn.active { color: var(--ink); font-weight: 600; border-bottom-color: var(--ink); }
.page-num-btn:hover:not(.active) { color: var(--ink); background: transparent; }

.pagination-btn.prev-next {
  background: #ffffff !important; border: 1px solid #e7e5e2 !important; color: #1a1a1a !important;
  width: 42px; height: 42px; border-radius: 0; display: flex; justify-content: center; align-items: center;
  font-size: 12px; transition: all 0.3s ease; cursor: pointer;
}
.pagination-btn.prev-next:hover:not(:disabled) { background: #1a1a1a !important; border-color: #1a1a1a !important; color: #ffffff !important; }
.pagination-btn.prev-next:disabled { opacity: 0.3; cursor: not-allowed; }

/* =========================================================
   RESPONSIVE
   ========================================================= */
@media (max-width: 991px) {
  .main-title-premium { font-size: 2.6rem; letter-spacing: 3px; }
  .filter-group-select { width: 100%; flex-direction: column; }
  .product-card-item:hover { transform: translateY(-4px); }
  :deep(.col-lg-4) { width: 50% !important; } /* tablet: 2 cột */
}
@media (max-width: 576px) {
  .select-input { font-size: 9px; letter-spacing: 0.5px; padding-right: 28px; }
  .filter-control { height: 44px; padding: 0 12px; font-size: 11px; }
  .search-box-wrapper .filter-control { padding-left: 38px; }
  .search-icon { left: 12px; font-size: 11px; }
  .main-title-premium { font-size: 2rem; letter-spacing: 2px; }
  .products-hero { padding: 60px 0 30px; }
  .product-card-item { padding: 16px; }
  :deep(.col-lg-4),
  :deep(.col-md-6) { width: 100% !important; } /* mobile: 1 cột */
}

.btn-favorite-inline {
  background: #fef2f2;
  border: 1px solid #fca5a5;
  border-radius: 50%;
  width: 38px;
  height: 38px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(239, 68, 68, 0.1);
}

.btn-favorite-inline :deep(svg) {
  stroke: #ef4444;
  color: #ef4444;
  transition: all 0.3s ease;
}

.btn-favorite-inline:hover {
  background: #fee2e2;
  border-color: #ef4444;
  transform: scale(1.1);
}

.btn-favorite-inline:hover :deep(svg) {
  stroke: #ef4444 !important;
  fill: #ef4444 !important;
}

.btn-favorite-inline.is-favorite {
  background: #ef4444;
  border-color: #ef4444;
}

.btn-favorite-inline.is-favorite :deep(svg) {
  stroke: #ffffff;
  fill: #ffffff !important;
  color: #ffffff;
}

.btn-favorite-inline.is-favorite:hover {
  background: #dc2626;
  border-color: #dc2626;
}

.btn-favorite-inline.is-favorite:hover :deep(svg) {
  stroke: #ffffff !important;
  fill: #ffffff !important;
}

.price-button:hover .btn-favorite-inline:not(.is-favorite) {
  background: #fef2f2;
  border-color: #fca5a5;
}

.price-button:hover .btn-favorite-inline:not(.is-favorite) :deep(svg) {
  stroke: #ef4444;
}

.price-button:hover .btn-favorite-inline.is-favorite {
  background: #ef4444;
  border-color: #ef4444;
}

.price-button:hover .btn-favorite-inline.is-favorite :deep(svg) {
  stroke: #ffffff;
}
</style>