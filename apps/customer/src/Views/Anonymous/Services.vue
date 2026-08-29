<script setup lang="ts">
// import CartSidebar from "@/Khanhhang/views/CartSidebar.vue";
import { getCartDB, addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { useWishlistStore, showToast } from "@/stores/useWishlistStore";
import { useBookingBasketStore } from "@/stores/useBookingBasketStore";
import { Heart } from "lucide-vue-next";

const route = useRoute();
const routerInstance = useRouter();
const wishlistStore = useWishlistStore();
const bookingBasketStore = useBookingBasketStore();
const cartItems = ref<any[]>([]);
const cartRef = ref<any>(null);
const userMaKH = ref<string | null>(null);

const ratingsMap = ref<Record<string, { avg: number; count: number }>>({});

const API = import.meta.env.VITE_API_URL;
const getImageUrl = (img: string) => {
  return img ? `${API}/${img}` : `${API}/assets/images/default.jpg`;
};
// AOS
declare const AOS: any;

// =======================
// STATE
// =======================
const services = ref<any[]>([]);
const categories = ref<any[]>([]);
const combos = ref<any[]>([]);

const searchQuery = ref("");
const selectedCategory = ref("all");
const selectedPriceRange = ref("all");

// =======================
// LOAD DATA BAN ĐẦU
// =======================
const fetchAll = async () => {
  const res = await axios.get(`${API}/api/DanhSachDichVu`);

  categories.value = res.data.categories;
  combos.value = res.data.combos;
};

const fetchRatings = async () => {
  try {
    const res = await axios.get(`${API}/api/DanhGia/all-average-ratings`);
    const map: Record<string, { avg: number; count: number }> = {};
    res.data.forEach((item: any) => {
      map[item.id] = { avg: item.averageRating, count: item.reviewCount };
    });
    ratingsMap.value = map;
  } catch (err) {
    console.error("Lỗi lấy đánh giá:", err);
  }
};
// =======================
// Phân trang
// =======================
const currentPage = ref(1);
const pageSize = ref(6);
const totalPages = ref(1);
const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;

  currentPage.value = page;
  fetchFiltered(); // 🔥 thiếu cái này
};
const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 5) {
    // ít trang → show hết
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, "...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...", total - 2, total - 1, total);
    } else {
      pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
  }

  return pages;
});
// =======================
// SALE
// =======================
const getDiscountPrice = (price: number, percent: number) => {
  return price - (price * percent) / 100;
};
const getRemainingTime = (endDate: string) => {
  const diff = new Date(endDate).getTime() - now.value;

  if (diff <= 0) return "Hết hạn";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return `${hours}h ${minutes}p ${seconds}s`;
};
// =======================
// FILTER (CALL API)
// =======================
// Sửa URL (bỏ dấu // thừa)
const fetchFiltered = async () => {
  try {
    console.log("🔍 Đang gọi API filter...");
    const res = await axios.get(
      API + "/api/DanhSachDichVu/filter",
      {
        params: {
          search: searchQuery.value,
          category: selectedCategory.value,
          priceRange: selectedPriceRange.value,
          page: currentPage.value,
          pageSize: pageSize.value,
        },
      },
    );

    console.log("✅ Response:", res.data); // xem data trả về
    console.log("📦 services:", res.data.data); // xem mảng services
    console.log("📄 totalPages:", res.data.totalPages);

    services.value = res.data.data;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    console.error("❌ Lỗi lấy dịch vụ:", err);
  }
};

// =======================
// WATCH FILTER
// =======================
watch([searchQuery, selectedCategory, selectedPriceRange], async () => {
  currentPage.value = 1;
  // Đồng bộ category lên URL query để Dmdichvu biết "Đang xem" card nào
  routerInstance.replace({
    query: {
      ...route.query,
      category:
        selectedCategory.value !== "all" ? selectedCategory.value : undefined,
    },
  });
  await fetchFiltered();
});

// Tên danh mục đang filter (dùng cho breadcrumb)
const activeCategoryName = computed(() => {
  if (selectedCategory.value === "all") return null;
  return (
    categories.value.find((c) => c.maDm === selectedCategory.value)
      ?.tenDanhMuc ?? null
  );
});

// Hàm cập nhật số lượng badge
const updateCartBadge = async () => {
  const customer = getCustomerInfo();
  userMaKH.value = customer.maKH;

  // Lấy dữ liệu từ IndexedDB
  const data = await getCartDB(userMaKH.value);
  cartItems.value = data || [];
};

//Giỏ Hàng
const openCart = () => {
  routerInstance.push('/cart');
};

const addToCart = async (rawItem: any) => {
  const isCombo = !!rawItem.maCb;
  let imgPath = rawItem.hinhAnh || "/assets/images/default.jpg";

  // 1. Logic tính toán giá
  const giaGoc = rawItem.gia;
  let finalPrice = giaGoc;

  // Nếu có Flash Sale thì tính giá mới, nếu không thì finalPrice = giaGoc
  if (rawItem.flashSale && rawItem.flashSale.phanTramGiam) {
    finalPrice = giaGoc - (giaGoc * rawItem.flashSale.phanTramGiam) / 100;
  }

  // 2. Đóng gói object gửi sang Sidebar
  const formattedItem = {
    id: isCombo ? rawItem.maCb : rawItem.maDv,
    tenItem: isCombo ? rawItem.tenCombo : rawItem.tenDv,
    gia: finalPrice, // Giá đã giảm (dùng để thanh toán)
    giaGoc: giaGoc, // Giá gốc (dùng để hiển thị gạch ngang)
    hinhAnh: imgPath,
    type: isCombo ? 'COMBO' : 'DICHVU',
    duration: isCombo
      ? rawItem.combo_DichVus?.reduce(
          (sum: any, cd: any) => sum + (cd.dichVu?.thoiGianLam || 30),
          0,
        ) || 60
      : rawItem.thoiGianLam || 30,
  };

  const customer = getCustomerInfo();
  await addToCartDB(formattedItem, customer.maKH);
  await updateCartBadge();
  window.dispatchEvent(new Event("cart-updated"));
  showToast("Đã thêm dịch vụ vào giỏ hàng!", "success");
};

// =====================================================================
// THÊM DỊCH VỤ VÀO KHAY ĐẶT LỊCH (Booking Basket)
// =====================================================================
const addToBasket = (rawItem: any) => {
  bookingBasketStore.addItem(rawItem);
  bookingBasketStore.openDrawer();
};
// =======================
// MOUNT
// =======================
const now = ref(Date.now());
onMounted(async () => {
  setInterval(() => {
    now.value = Date.now();
  }, 1000);

  // =======================
  // ĐỌC QUERY PARAM ?category=... TỪ Home / Dmdichvu
  // =======================
  if (route.query.category && typeof route.query.category === "string") {
    selectedCategory.value = route.query.category;
  }

  await fetchAll(); // 🔥 lấy combo + categories
  await fetchFiltered(); // 🔥 lấy services theo filter
  await updateCartBadge(); // 🔥 cập nhật số lượng badge khi vào trang dịch vụ
  await fetchRatings(); // 🔥 lấy đánh giá trung bình cho tất cả dịch vụ
});

// =======================
// WATCH ROUTE QUERY — để bắt navigate từ trang khác (Home, Dmdichvu)
// ngay cả khi component đã được cache/mount rồi
// =======================
watch(
  () => route.query.category,
  (newCat) => {
    if (newCat && typeof newCat === "string") {
      selectedCategory.value = newCat;
    } else {
      selectedCategory.value = "all";
    }
    currentPage.value = 1;
    fetchFiltered();
  }
);


// =======================
// FORMAT (OPTIONAL)
// =======================
const formatPrice = (price: number) => {
  return price.toLocaleString() + "đ";
};
</script>

<template>
  <div class="services-page-container">
    <section class="services-hero text-center" data-aos="fade-down">
      <div class="container">
        <!-- <h1 class="font-playfair main-title-premium fw-900">
          DANH MỤC DỊCH VỤ
        </h1>
        <div class="gold-divider-thick"></div> -->
        <h3 class="fw-900">
          Nâng tầm vẻ đẹp Việt với quy trình chuyên nghiệp tại Minh Tâm Hair
        </h3>
      </div>
    </section>

    <section class="container filter-section" data-aos="fade-up">
      <div class="filter-bar-custom">
        <div class="search-box-wrapper">
          <i class="fas fa-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm tên dịch vụ..."
            class="filter-control"
          />
        </div>

        <div class="filter-group-select">
          <!-- <div class="custom-select-wrapper">
            <select v-model="selectedCategory" class="filter-control select-input">
              <option value="all">Tất cả danh mục</option>
              <option v-for="c in categories" :key="c.maDm" :value="c.maDm">
                {{ c.tenDanhMuc }}
              </option>
            </select>
            <i class="fas fa-chevron-down arrow-icon"></i>
          </div> -->

          <div class="custom-select-wrapper">
            <select
              v-model="selectedPriceRange"
              class="filter-control select-input"
            >
              <option value="all">Tất cả mức giá</option>
              <option value="low">Dưới 300.000đ</option>
              <option value="mid">300k - 700k</option>
              <option value="high">Trên 700.000đ</option>
            </select>
            <i class="fas fa-chevron-down arrow-icon"></i>
          </div>
        </div>
      </div>
    </section>

    <!-- BREADCRUMB DANH MỤC ĐANG LỌC -->
    <div
      v-if="activeCategoryName"
      class="container"
      style="padding-top: 12px; padding-bottom: 0"
    >
      <div class="active-category-bar">
        <span class="active-category-label">
          <i
            class="fas fa-filter"
            style="margin-right: 6px; font-size: 10px"
          ></i>
          Đang xem: <strong>{{ activeCategoryName }}</strong>
        </span>
        <button class="clear-category-btn" @click="selectedCategory = 'all'">
          <i class="fas fa-times"></i> Xem tất cả
        </button>
      </div>
    </div>

    <section class="container py-5 services-grid-layout">
      <div v-if="services.length > 0" class="row g-4">
        <div
          v-for="s in services"
          :key="s.maDv"
          class="col-lg-4 col-md-6"
          data-aos="zoom-in"
          style="padding-bottom: 28px"
        >
          <router-link
            :to="{ name: 'serviceDetail', params: { id: s.maDv } }"
            style="
              text-decoration: none;
              color: inherit;
              display: block;
              height: 100%;
            "
          >
            <div class="service-card-item">
              <div v-if="s.flashSale" class="sale-ribbon-wrapper">
                <div class="sale-ribbon">-{{ s.flashSale.phanTramGiam }}%</div>
              </div>

              <!-- <div v-if="s.flashSale" class="sale-time-premium">
                <i class="fas fa-history"></i>
                <span>{{ getRemainingTime(s.flashSale.ngayKetThuc) }}</span>
              </div> -->
              <div class="card-content">
                <h3 class="service-title">{{ s.tenDv }}</h3>
                <div class="rating-mini-box" v-if="ratingsMap[s.maDv]">
                  <svg class="gold-star" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"/>
                  </svg>
                  <span class="r-number">{{ ratingsMap[s.maDv]?.avg }}</span>
                  <span class="r-count"
                    >({{ ratingsMap[s.maDv]?.count }} đánh giá)</span
                  >
                </div>
                <div class="rating-mini-box no-rating" v-else>
                  Chưa có đánh giá
                </div>
                <div class="service-desc-group">
                  <p class="service-desc">{{ s.moTa }}</p>
                </div>
              </div>

              <div class="image-single-container">
                <img
                  :src="getImageUrl(s.hinhAnh)"
                  alt="service"
                  class="main-image-only"
                />
              </div>

              <div class="duration-badge">
                <span>{{ s.thoiGianLam }} Phút</span>
              </div>

              <div
                class="price-button d-flex justify-content-between align-items-center"
                @click="addToCart(s)"
              >
                <div class="price-values">
                  <template v-if="s.flashSale">
                    <span class="old-price">{{ formatPrice(s.gia) }}</span>
                    <span class="new-price">
                      {{
                        formatPrice(
                          getDiscountPrice(s.gia, s.flashSale.phanTramGiam),
                        )
                      }}
                    </span>
                  </template>
                  <template v-else>
                    <span class="main-price">{{ formatPrice(s.gia) }}</span>
                  </template>
                </div>

                <div class="flex items-center gap-2">
                  <button 
                    @click.stop.prevent="wishlistStore.toggleServiceFavorite(s)" 
                    class="btn-favorite-inline flex items-center justify-content-center transition-colors"
                    :class="{ 'is-favorite': wishlistStore.isServiceFavorite(s.maDv) }"
                    :title="wishlistStore.isServiceFavorite(s.maDv) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'"
                  >
                    <Heart 
                      :size="18" 
                      :stroke-width="wishlistStore.isServiceFavorite(s.maDv) ? 0 : 2" 
                      :fill="wishlistStore.isServiceFavorite(s.maDv) ? '#ffffff' : 'none'" 
                    />
                  </button>

                  <button
                    @click.stop.prevent="addToBasket(s)"
                    class="btn-order-now"
                    :class="{ 'is-selected': bookingBasketStore.hasItem(s.maDv) }"
                  >
                    {{ bookingBasketStore.hasItem(s.maDv) ? 'ĐÃ CHỌN ✓' : 'CHỌN DỊCH VỤ' }}
                  </button>
                </div>
              </div>
            </div>
          </router-link>
        </div>
      </div>
      <div v-else class="text-center py-5 no-result-box" data-aos="fade-in">
        <img
          src="https://cdn-icons-png.flaticon.com/512/6134/6134065.png"
          width="80"
          class="mb-3 opacity-50"
        />
        <p class="text-muted">
          Rất tiếc, chúng tôi không tìm thấy dịch vụ bạn yêu cầu.
        </p>
      </div>
    </section>
    <div class="pagination-wrapper" v-if="totalPages > 1" data-aos="fade-up">
      <button
        type="button"
        class="pagination-btn prev-next"
        :disabled="currentPage === 1"
        @click="changePage(currentPage - 1)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 2L4 7L9 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <div class="page-numbers">
        <button
          v-for="(page, index) in visiblePages"
          :key="index"
          class="page-num-btn"
          :class="{ active: currentPage === page }"
          @click="typeof page === 'number' && changePage(page)"
          :disabled="page === '...'"
        >
          {{
            page === "..."
              ? "..."
              : typeof page === "number" && page < 10
                ? "0" + page
                : page
          }}
        </button>
      </div>

      <button
        type="button"
        class="pagination-btn prev-next"
        :disabled="currentPage === totalPages"
        @click="changePage(currentPage + 1)"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M5 2L10 7L5 12"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    </div>

    <section class="combo-white-section">
      <div class="container">
        <div class="text-center mb-5" data-aos="fade-up">
          <h2 class="font-playfair combo-title-premium fw-900 display-5">
            GÓI COMBO ĐẶC BIỆT
          </h2>
          <div class="gold-divider-thick"></div>
          <p class="text-muted section-subtitle">
            Tiết kiệm hơn, đẹp toàn diện hơn
          </p>
        </div>

        <div class="row g-4 gy-5 justify-content-center">
          <div
            v-for="(c, index) in combos"
            :key="index"
            class="col-lg-4 col-md-6"
            data-aos="fade-up"
            :data-aos-delay="index * 150"
            style="padding-bottom: 28px"
          >
            <router-link
              :to="{ name: 'detailCombo', params: { id: c.maCb } }"
              style="
                text-decoration: none;
                color: inherit;
                display: block;
                height: 100%;
              "
            >
              <div class="luxury-combo-card">
                <div class="hover-tag">ƯU ĐÃI</div>

                <div class="combo-image-container">
                  <img
                    :src="getImageUrl(c.hinhAnh)"
                    alt="combo-thumb"
                    class="combo-img"
                  />
                </div>

                <div class="combo-info">
                  <h4 class="font-playfair combo-name-title">
                    {{ c.tenCombo }}
                  </h4>
                  <div
                    class="rating-mini-box justify-content-center"
                    v-if="ratingsMap[c.maCb]"
                  >
                    <svg class="gold-star" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"/>
                    </svg>
                    <span class="r-number">{{ ratingsMap[c.maCb]?.avg }}</span>
                    <span class="r-count"
                      >({{ ratingsMap[c.maCb]?.count }} đánh giá)</span
                    >
                  </div>
                  <div
                    class="rating-mini-box justify-content-center no-rating"
                    v-else
                  >
                    Chưa có đánh giá
                  </div>
                  <p class="combo-description">{{ c.moTa }}</p>

                  <div class="combo-price-val gold-gradient-darker">
                    {{ formatPrice(c.gia) }}
                  </div>

                  <ul class="combo-list-items">
                    <li v-for="item in c.items" :key="item">
                      <i class="fas fa-gem gold-text-darker"></i> {{ item }}
                    </li>
                  </ul>
                </div>
                <button @click="addToBasket(c)" class="btn-booking-luxury" :class="{ 'is-selected': bookingBasketStore.hasItem(c.maCb) }">
                  {{ bookingBasketStore.hasItem(c.maCb) ? 'Đã chọn ✓' : 'Chọn gói' }}
                </button>
              </div>
            </router-link>
          </div>
        </div>
      </div>
    </section>

    <!-- <CartSidebar ref="cartRef" /> -->
  </div>
</template>

<style scoped>

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

.active-category-label strong {
  font-weight: 500;
}

.clear-category-btn {
  background: none;
  border: 1px solid var(--line);
  color: var(--ink-soft);
  font-size: 10px;
  font-family: "Jost", sans-serif;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-category-btn:hover {
  border-color: var(--ink);
  color: var(--ink);
}

/* =========================================================
   FONT — Cormorant Garamond (heading) + Jost (body)
   ========================================================= */
.pagination-btn.prev-next i {
  color: inherit !important;
  pointer-events: none;
}
.font-playfair {
  font-family: "Cormorant Garamond", serif;
}

.font-poppins {
  font-family: "Jost", sans-serif;
}

.fw-900 {
  font-weight: 600 !important;
}

/* =========================================================
   DESIGN TOKENS
   ========================================================= */
.services-page-container {
  --ink: #1a1a1a;
  --ink-soft: #4a4a4a;
  --muted: #999999;
  --muted-light: #bdbdbd;
  --line: #e7e5e2;
  --bg: #ffffff;
  --bg-soft: #fafafa;

  font-family: "Jost", sans-serif;
  background: var(--bg);
  overflow-x: hidden; /* chỉ ẩn scroll ngang, không cắt content dọc */
  width: 100%;
  margin: 0 auto;
  color: var(--ink);
}

/* =========================================================
   HERO
   ========================================================= */
.services-hero {
  padding: 100px 0 50px;
}

.main-title-premium {
  font-family: "Cormorant Garamond", serif;
  font-size: 3.4rem;
  font-weight: 600;
  letter-spacing: 6px;
  line-height: 1.2;
  margin-bottom: 5px;
  color: var(--ink);
  text-transform: uppercase;
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
  -webkit-text-fill-color: var(--ink);
  filter: none;
}

.combo-title-premium {
  font-family: "Cormorant Garamond", serif;
  font-size: 2.8rem;
  font-weight: 600;
  letter-spacing: 4px;
  color: var(--ink);
  text-transform: uppercase;
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
  -webkit-text-fill-color: var(--ink);
  filter: none;
}

.section-subtitle {
  font-family: "Jost", sans-serif;
  font-size: 0.75rem;
  font-weight: 300;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--muted);
}

.gold-divider-thick {
  width: 50px;
  height: 1px;
  background: var(--ink);
  margin: 28px auto;
  border-radius: 0;
}

/* =========================================================
   FILTER BAR
   ========================================================= */
.filter-section {
  margin-bottom: 25px;
}
/* Fix container căn giữa */
:deep(.row) {
  display: flex !important;
  flex-wrap: wrap !important;
}

:deep(.col-lg-4) {
  width: 33.333% !important;
  padding-left: 12px !important;
  padding-right: 12px !important;
}

:deep(.col-md-6) {
  width: 33.333% !important; /* ← đổi từ 50% thành 33.333% */
}
:deep(.container) {
  margin-left: auto !important;
  margin-right: auto !important;
}
.service-card-item {
  max-width: 100% !important; /* ← đổi từ 380px thành 100% */
}
:deep(.row) {
  display: flex !important;
  flex-wrap: wrap !important;
  justify-content: center !important; /* ← thêm dòng này */
  margin-left: 0 !important;
  margin-right: 0 !important;
}
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

.filter-control::placeholder {
  color: var(--muted-light);
}

.filter-control:focus {
  border-color: var(--ink);
  box-shadow: none;
}

.search-box-wrapper {
  flex: 2;
  position: relative;
  min-width: 0; /* ← đổi thành 0 */
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 18px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-light);
  z-index: 2;
  font-size: 13px;
}

.search-box-wrapper .filter-control {
  padding-left: 50px;
}

.filter-group-select {
  flex: 1.5;
  display: flex;
  gap: 12px;
  min-width: 0; /* ← đổi thành 0 */
  width: 100%;
}

.custom-select-wrapper {
  flex: 1;
  position: relative;
}

.select-input {
  appearance: none;
  cursor: pointer;
  padding-right: 38px;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 1px;
}

.arrow-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--muted-light);
  pointer-events: none;
  font-size: 11px;
}

/* =========================================================
   SERVICE GRID / CARD
   ========================================================= */
.services-grid-layout {
  padding-bottom: 10px !important;
}

.service-card-item {
  position: relative;
  overflow: hidden;
  background: var(--bg);
  border-radius: 0;
  border: 1px solid var(--line);
  padding: 18px;
  width: 100%;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-shadow: none;
  transition: all 0.4s ease;
}

.service-card-item:hover {
  transform: translateY(-6px);
  border-color: var(--ink);
  box-shadow: none;
}

/* Sale ribbon */
.sale-ribbon-wrapper {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 80px;
  overflow: hidden;
  z-index: 10;
}

.sale-ribbon {
  background: var(--ink);
  color: #fff;
  text-align: center;
  font-family: "Jost", sans-serif;
  font-weight: 600;
  font-size: 10px;
  text-transform: uppercase;
  padding: 6px 0;
  width: 112px;
  position: absolute;
  top: 19px;
  right: -26px;
  transform: rotate(45deg);
  box-shadow: none;
  letter-spacing: 1.5px;
}

/* Countdown timer (kept for future use) */
.sale-time-premium {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  background: rgba(26, 26, 26, 0.85);
  backdrop-filter: blur(4px);
  color: #fff;
  padding: 5px 12px;
  border-radius: 0;
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: none;
}

.sale-time-premium i {
  font-size: 10px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }

  100% {
    opacity: 1;
  }
}

/* Image */
.image-single-container {
  width: 100%;
  margin-bottom: 14px;
  overflow: hidden;
  border-radius: 0;
  aspect-ratio: 4 / 5;
  background: var(--bg-soft);
}

.main-image-only {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
  transition: transform 1s ease;
}

.service-card-item:hover .main-image-only {
  transform: scale(1.04);
}

/* Title / description */
.service-title {
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

.service-desc-group {
  flex-grow: 1;
}

.service-desc {
  font-family: "Jost", sans-serif;
  color: var(--muted);
  font-size: 12px;
  font-weight: 300;
  line-height: 1.6;
  min-height: 34px;
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Rating */
.rating-mini-box {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-family: "Jost", sans-serif;
  min-height: 24px; /* ← rating luôn chiếm 1 dòng */
}

.gold-star {
  color: var(--ink);
  font-size: 12px;
  margin-right: 5px;
}

.r-number {
  font-weight: 600;
  color: var(--ink);
  font-size: 13px;
}

.r-count {
  color: var(--muted);
  font-size: 11px;
  margin-left: 5px;
  font-weight: 300;
}

.no-rating {
  font-size: 11px;
  color: var(--muted-light);
  font-style: italic;
  font-weight: 300;
}

/* Duration badge */
.duration-badge {
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
  margin-top: auto;
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.service-card-item:hover .duration-badge {
  border-color: var(--ink);
  color: var(--ink);
  background-color: transparent;
}

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
}

.price-button:hover {
  background: var(--ink);
  border-color: var(--ink);
  transform: none;
  box-shadow: none;
}

.price-button:hover .main-price,
.price-button:hover .old-price,
.price-button:hover .new-price {
  color: #fff;
}

.price-values {
  display: flex;
  flex-direction: column;
  text-align: left;
}

.main-price {
  font-family: "Jost", sans-serif;
  font-weight: 500;
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  color: var(--ink);
  transition: color 0.3s ease;
}

.old-price {
  font-size: 11px;
  text-decoration: line-through;
  color: var(--muted-light);
  margin-right: 10px;
  transition: color 0.3s ease;
}

.new-price {
  font-weight: 500;
  color: var(--ink);
  font-size: 1.05rem;
  letter-spacing: 0.5px;
  transition: color 0.3s ease;
}

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

.btn-order-now:hover {
  background: var(--bg);
  color: var(--ink);
}

.price-button:hover .btn-order-now {
  background: #fff;
  color: var(--ink);
  border-color: #fff;
}

/* No result */
.no-result-box {
  background: var(--bg-soft);
  border-radius: 0;
  border: 1px solid var(--line);
  padding: 60px 0;
  margin-top: 30px;
}

.no-result-box p {
  font-family: "Jost", sans-serif;
  font-weight: 300;
  letter-spacing: 1px;
}

/* =========================================================
   PAGINATION
   ========================================================= */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
  margin-bottom: 30px;
  font-family: "Jost", sans-serif;
}

.page-numbers {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-num-btn {
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: var(--muted);
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 1px;
  width: 36px;
  height: 36px;
  border-radius: 0;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;
}

.page-num-btn.active {
  color: var(--ink);
  font-weight: 600;
  border-bottom-color: var(--ink);
}

.page-num-btn.active::after {
  content: none;
}

.page-num-btn:hover:not(.active) {
  color: var(--ink);
  background: transparent;
}

.pagination-btn.prev-next {
  background: #ffffff !important;
  border: 1px solid #e7e5e2 !important;
  color: #1a1a1a !important;
  width: 42px;
  height: 42px;
  border-radius: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.pagination-btn.prev-next:hover:not(:disabled) {
  background: #1a1a1a !important;
  border-color: #1a1a1a !important;
  color: #ffffff !important;
}

.pagination-btn.prev-next:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* =========================================================
   COMBO SECTION
   ========================================================= */
.combo-white-section {
  padding: 70px 0;
  background-color: var(--bg);
  border-top: 1px solid var(--line);
}

.luxury-combo-card {
  background: var(--bg);
  padding: 40px 30px;
  border-radius: 0;
  border: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 360px;
  margin: 0 auto;
  position: relative;
  text-align: center;
  transition: all 0.5s ease;
  box-shadow: none;
}

.luxury-combo-card:hover {
  transform: translateY(-8px);
  border-color: var(--ink);
  box-shadow: none;
  z-index: 10;
}

.combo-image-container {
  width: 100%;
  aspect-ratio: 4 / 5;
  margin-bottom: 18px;
  border-radius: 0;
  overflow: hidden;
  background: var(--bg-soft);
}

.combo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 1s ease;
}

.luxury-combo-card:hover .combo-img {
  transform: scale(1.04);
}

.combo-name-title {
  font-family: "Jost", sans-serif;
  font-size: 1rem;
  letter-spacing: 2px;
  margin-bottom: 14px;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--ink);
  min-height: 60px; /* ← cố định chiều cao tên */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-description {
  font-family: "Jost", sans-serif;
  font-size: 13px;
  font-weight: 300;
  color: var(--muted);
  margin-bottom: 16px;
  min-height: 42px; /* ← cố định 2 dòng mô tả */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-price-val {
  font-family: "Jost", sans-serif;
  font-size: 1.6rem;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: var(--ink);
  margin-bottom: 24px;
  min-height: 44px; /* ← giá luôn cùng hàng */
  display: flex;
  align-items: center;
  justify-content: center;
}

.gold-gradient-darker,
.gold-text-darker {
  background: none;
  -webkit-background-clip: unset;
  background-clip: unset;
  -webkit-text-fill-color: var(--ink);
  color: var(--ink);
  filter: none;
}

.combo-list-items {
  list-style: none;
  padding: 0;
  margin-bottom: 28px;
  text-align: left;
  max-width: 280px;
  margin-left: auto;
  margin-right: auto;
}

.combo-list-items li {
  margin-bottom: 12px;
  font-family: "Jost", sans-serif;
  font-size: 13px;
  font-weight: 300;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  line-height: 1.4;
}

.combo-list-items i {
  margin-right: 12px;
  font-size: 12px;
  flex-shrink: 0;
  color: var(--ink);
}

.btn-booking-luxury {
  margin-top: auto;
  display: block;
  border: 1px solid var(--ink);
  color: var(--ink);
  padding: 12px;
  border-radius: 0;
  font-size: 10px;
  font-weight: 500;
  font-family: "Jost", sans-serif;
  text-transform: uppercase;
  letter-spacing: 2px;
  text-decoration: none;
  transition: all 0.3s ease;
  background: transparent;
  cursor: pointer;
  width: 100%;
}

.btn-booking-luxury:hover {
  background: var(--ink);
  color: #fff;
  border-color: var(--ink);
  box-shadow: none;
}

.hover-tag {
  position: absolute;
  top: 14px;
  right: 14px;
  background: var(--ink);
  color: #fff;
  padding: 4px 12px;
  border-radius: 0;
  font-size: 9px;
  font-weight: 500;
  font-family: "Jost", sans-serif;
  text-transform: uppercase;
  letter-spacing: 2px;
  z-index: 10;
}
.combo-white-section .row {
  align-items: stretch !important;
}

.combo-white-section .col-lg-4,
.combo-white-section .col-md-6 {
  display: flex !important;
  flex-direction: column !important;
}

/* Misc legacy helpers (kept for compatibility) */
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.icon-box {
  width: 55px;
  height: 55px;
  background: var(--bg-soft);
  color: var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0;
  font-size: 24px;
  border: 1px solid var(--line);
}

.price-text {
  font-weight: 500;
  font-size: 1.25rem;
  color: var(--ink);
  font-family: "Jost", sans-serif;
}

/* =========================================================
   RESPONSIVE
   ========================================================= */
@media (max-width: 991px) {
  :deep(.col-lg-4) {
    width: 50% !important; /* tablet: 2 cột */
  }

  .main-title-premium {
    font-size: 2.6rem;
    letter-spacing: 3px;
  }
  .combo-title-premium {
    font-size: 2.2rem;
    letter-spacing: 2px;
  }
  .filter-group-select {
    width: 100%;
    flex-direction: column;
  }
  .luxury-combo-card:hover {
    transform: translateY(-4px);
  }
  .combo-name-title {
    font-size: 1.1rem;
  }
  .combo-price-val {
    font-size: 1.5rem;
  }
}

@media (max-width: 576px) {
  .select-input {
    font-size: 9px; /* ← nhỏ hơn trên mobile */
    letter-spacing: 0.5px;
    padding-right: 28px;
  }

  .filter-control {
    height: 44px; /* ← input thấp hơn tí cho gọn */
    padding: 0 12px;
    font-size: 11px;
  }

  .search-box-wrapper .filter-control {
    padding-left: 38px;
  }

  .search-icon {
    left: 12px;
    font-size: 11px;
  }
  /* Mobile: 1 cột */
  :deep(.col-lg-4),
  :deep(.col-md-6) {
    width: 100% !important;
  }

  .main-title-premium {
    font-size: 2rem;
    letter-spacing: 2px;
  }
  .combo-title-premium {
    font-size: 1.7rem;
  }
  .services-hero {
    padding: 60px 0 30px;
  }
  .service-card-item {
    padding: 16px;
  }
  .combo-white-section {
    padding: 50px 0;
  }
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
