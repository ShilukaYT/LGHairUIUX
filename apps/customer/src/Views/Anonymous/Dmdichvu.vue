<script setup lang="ts">
// import CartSidebar from "@/Khanhhang/views/CartSidebar.vue";
// import { getCartDB } from "./CSDL/cartDB";
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { getCartDB, addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { showToast } from "@/stores/useWishlistStore";

const route = useRoute();
const routerInstance = useRouter();

// Vị trí "neo" đầu danh sách dịch vụ — dùng để auto scroll khi đổi trang / vào lại trang
const servicesListRef = ref<HTMLElement | null>(null);
const scrollToServicesTop = (smooth = true) => {
  nextTick(() => {
    servicesListRef.value?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
      block: "start",
    });
  });
};
const cartItems = ref<any[]>([]);
const cartRef = ref<any>(null);
const userMaKH = ref<string | null>(null);

const ratingsMap = ref<Record<string, { avg: number; count: number }>>({});

const API = import.meta.env.VITE_API_URL;
const getImageUrl = (img: string) => {
  return img ? `${API}/${img}` : `${API}/assets/images/default.jpg`;
};
// Ảnh cho lưới danh mục (API danh mục trả path khác với ảnh dịch vụ/combo)
const getCategoryImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/danhmuc/${img}`;
};
// AOS
declare const AOS: any;

// =======================
// STATE
// =======================
const services = ref<any[]>([]);
const categories = ref<any[]>([]);
const combos = ref<any[]>([]);

// Lưới danh mục dịch vụ (gộp từ Dmdichvu.vue) — hiển thị ngay trên trang này
const categoryList = ref<any[]>([]);
const categoriesLoading = ref(true);
const categoriesError = ref(false);
const categoryGridRef = ref<HTMLElement | null>(null);

const searchQuery = ref("");
const selectedCategory = ref("all");
const selectedPriceRange = ref("all");

// Sidebar danh mục dịch vụ kiểu Shop.vue
const sidebarOpen = ref(true);
const expandedCats = ref<string[]>([]);

const toggleExpand = (maDM: string) => {
  const index = expandedCats.value.indexOf(maDM);
  if (index === -1) expandedCats.value.push(maDM);
  else expandedCats.value.splice(index, 1);
};
// Hover vào 1 danh mục có danh mục con → tự xổ ra (cho desktop, không cần bấm)
const openExpand = (maDM: string) => {
  if (!expandedCats.value.includes(maDM)) expandedCats.value.push(maDM);
};
// Rời chuột ra khỏi danh mục đó → tự đóng lại
const closeExpand = (maDM: string) => {
  const index = expandedCats.value.indexOf(maDM);
  if (index !== -1) expandedCats.value.splice(index, 1);
};

// ⚠️ Đổi lại đúng tên route (name) của trang danh sách SẢN PHẨM (Shop.vue) trong
// router/index.ts nếu tên route ở dự án của bạn khác "product" — dùng để điều hướng
// sang trang sản phẩm khi khách bấm nút "Xem sản phẩm" ở trang này.
const PRODUCTS_ROUTE_NAME = "product";
const goToProductsPage = () => {
  routerInstance.push({ name: PRODUCTS_ROUTE_NAME });
};

// Đồng bộ bộ lọc dịch vụ hiện tại lên URL (dùng replace để không phá lịch sử back/forward)
const syncRouteQuery = () => {
  routerInstance.replace({
    query: {
      category: selectedCategory.value !== "all" ? selectedCategory.value : undefined,
    },
  });
};

// =======================
// LOAD DATA BAN ĐẦU
// =======================
const fetchAll = async () => {
  const res = await axios.get(`${API}/api/DanhSachDichVu`);

  categories.value = res.data.categories;
  combos.value = res.data.combos;
};

// Lấy danh sách danh mục để hiển thị lưới (gộp từ Dmdichvu.vue)
const fetchCategoryGrid = async () => {
  try {
    categoriesLoading.value = true;
    categoriesError.value = false;
    const res = await axios.get(`${API}/api/DanhMucDV/danh-sach`);
    categoryList.value = res.data;
  } catch (err) {
    console.error("Lỗi lấy danh mục dịch vụ:", err);
    categoriesError.value = true;
  } finally {
    categoriesLoading.value = false;
  }
};

// Bấm vào 1 danh mục trong lưới → lọc luôn dịch vụ bên dưới (không cần chuyển trang nữa
// vì giờ 2 khu vực đã ở chung 1 trang)
const goToCategory = (maDM: string) => {
  selectedCategory.value = maDM;
  scrollToServicesTop();
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
const changePage = async (page: number) => {
  if (page < 1 || page > totalPages.value) return;

  currentPage.value = page;
  await fetchFiltered(); // 🔥 thiếu cái này
  scrollToServicesTop(); // 🔥 auto scroll lên dịch vụ đầu tiên khi đổi trang
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
    const res = await axios.get(`${API}/api/DanhSachDichVu/filter`, {
      params: {
        search: searchQuery.value,
        category: selectedCategory.value,
        priceRange: selectedPriceRange.value,
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });

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
  syncRouteQuery();
  await fetchFiltered();
});

// Tên danh mục dịch vụ đang filter (dùng cho breadcrumb)
const activeCategoryName = computed(() => {
  if (selectedCategory.value === "all") return null;
  return (
    categoryList.value.find((c) => c.maDM === selectedCategory.value)
      ?.tenDanhMuc ??
    categories.value.find((c) => c.maDm === selectedCategory.value)
      ?.tenDanhMuc ??
    null
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
  routerInstance.push("/cart");
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
    id: isCombo ? rawItem.maCb || rawItem.id : rawItem.maDv || rawItem.id,
    tenItem: isCombo ? rawItem.tenCombo : rawItem.tenDv,
    gia: finalPrice, // Giá đã giảm (dùng để thanh toán)
    giaGoc: giaGoc, // Giá gốc (dùng để hiển thị gạch ngang)
    hinhAnh: imgPath,
    type: isCombo ? "COMBO" : "DICHVU",
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
// =======================
// MOUNT
// =======================
const now = ref(Date.now());
onMounted(async () => {
  setInterval(() => {
    now.value = Date.now();
  }, 1000);

  // =======================
  // ĐỌC QUERY PARAM TỪ URL: ?category=...
  // =======================
  if (route.query.category && typeof route.query.category === "string") {
    selectedCategory.value = route.query.category;
  }

  await fetchAll(); // 🔥 lấy combo + categories
  await fetchCategoryGrid(); // 🔥 lấy danh mục dịch vụ để hiển thị lưới
  await fetchFiltered();

  await updateCartBadge(); // 🔥 cập nhật số lượng badge khi vào trang
  await fetchRatings(); // 🔥 lấy đánh giá trung bình cho tất cả dịch vụ

  // 🔥 mỗi lần vào lại trang (mount) thì auto scroll lên đầu danh sách dịch vụ
  scrollToServicesTop(false);

  // =======================
  // 🔥 QUÉT LẠI AOS SAU KHI ĐIỀU HƯỚNG SPA
  // =======================
  // Bug: nếu vào trang Sản Phẩm (Shop.vue, không có data-aos) rồi quay lại trang này,
  // Vue Router huỷ + tạo lại toàn bộ DOM (kể cả sidebar/menu tổng hợp bọc trong
  // data-aos="fade-up"). AOS.init() thường chỉ chạy 1 lần lúc app khởi động nên không
  // biết tới các phần tử data-aos MỚI này → chúng bị kẹt ở opacity:0 (như "bay màu").
  // → Phải chủ động gọi lại AOS để nó quét + đánh dấu lại DOM mỗi lần trang này mount.
  nextTick(() => {
    if (typeof AOS !== "undefined" && AOS) {
      if (typeof AOS.refreshHard === "function") {
        AOS.refreshHard();
      } else if (typeof AOS.refresh === "function") {
        AOS.refresh();
      }
    }
  });
});

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

    <!-- ======================= -->
    <!-- MENU DANH MỤC ĐƯỢC MỞ/ĐÓNG (giống Shop.vue) -->
    <!-- ======================= -->
    <section
      class="w-full animate-in fade-in duration-500 mb-10"
    >
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div class="flex flex-col lg:flex-row gap-8">
          <aside class="w-full lg:w-64 shrink-0">
            <div class="border border-gray-100 lg:sticky lg:top-24">
              <button
                type="button"
                class="w-full flex items-center justify-between gap-2 px-4 py-3.5 border-b border-gray-100 bg-gray-50"
                @click="sidebarOpen = !sidebarOpen"
              >
                <span
                  class="dv-filter-font flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-black"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                  Danh Mục Dịch Vụ
                </span>
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  class="transition-transform duration-300"
                  :class="sidebarOpen ? 'rotate-180' : ''"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              <nav
                v-show="sidebarOpen"
                class="max-h-[70vh] lg:max-h-[calc(100vh-10rem)] overflow-y-auto"
              >
                <div class="py-1">
                  <button
                    type="button"
                    class="dv-filter-font w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest transition-colors border-l-2"
                    :class="
                      selectedCategory === 'all'
                        ? 'text-black font-semibold bg-gray-50 border-black'
                        : 'text-gray-500 hover:text-black hover:bg-gray-50 border-transparent'
                    "
                    @click="goToCategory('all')"
                  >
                    Tất cả dịch vụ
                  </button>

                  <div
                    v-for="cat in categoryList"
                    :key="cat.maDM"
                    @mouseenter="cat.children?.length && openExpand(cat.maDM)"
                    @mouseleave="cat.children?.length && closeExpand(cat.maDM)"
                  >
                    <div
                      class="flex items-center border-l-2 transition-colors"
                      :class="
                        selectedCategory === cat.maDM
                          ? 'text-black font-semibold bg-gray-50 border-black'
                          : 'text-gray-500 border-transparent hover:bg-gray-50'
                      "
                    >
                      <button
                        type="button"
                        class="dv-filter-font flex-1 text-left px-4 py-2.5 text-xs uppercase tracking-widest transition-colors hover:text-black truncate"
                        @click="goToCategory(cat.maDM)"
                      >
                        {{ cat.tenDanhMuc }}
                      </button>

                      <button
                        v-if="cat.children && cat.children.length"
                        type="button"
                        class="px-3 py-2.5 text-gray-400 hover:text-black shrink-0"
                        :aria-label="`Xổ danh mục con của ${cat.tenDanhMuc}`"
                        @click.stop="toggleExpand(cat.maDM)"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="2.5"
                          class="transition-transform duration-300"
                          :class="
                            expandedCats.includes(cat.maDM)
                              ? 'rotate-180'
                              : ''
                          "
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </button>
                    </div>

                    <div
                      v-if="
                        cat.children &&
                        cat.children.length &&
                        expandedCats.includes(cat.maDM)
                      "
                      class="bg-gray-50/60"
                    >
                      <button
                        v-for="sub in cat.children"
                        :key="sub.maDM"
                        type="button"
                        class="dv-filter-font w-full text-left pl-9 pr-4 py-2 text-[11px] uppercase tracking-widest transition-colors truncate"
                        :class="
                          selectedCategory === sub.maDM
                            ? 'text-black font-medium'
                            : 'text-gray-400 hover:text-black'
                        "
                        @click="goToCategory(sub.maDM)"
                      >
                        {{ sub.tenDanhMuc }}
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
            </div>
          </aside>

          <div class="flex-1 min-w-0">
            <div class="flex flex-col gap-6">
              <div
                class="flex items-center justify-between pb-4 border-b border-gray-100"
              >
                <div>
                  <p
                    class="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2"
                  >
                    Danh sách dịch vụ
                  </p>
                  <h2
                    class="font-heading text-xl lg:text-2xl tracking-widest uppercase"
                  >
                    Dịch vụ nổi bật
                  </h2>
                </div>
                <!-- Nút chuyển sang trang SẢN PHẨM (thay cho việc gộp chung nội dung như trước) -->
                <button
                  type="button"
                  class="text-[11px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors flex items-center gap-2 shrink-0"
                  @click="goToProductsPage"
                >
                  Xem Sản Phẩm
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 6l6 6-6 6"/>
                  </svg>
                </button>
              </div>

              <div
                class="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-2 pb-4 border-b border-gray-100"
              >
                <span class="dv-filter-font text-xs text-gray-400 uppercase tracking-widest">
                  {{ services.length }} Dịch vụ
                </span>

                <div class="flex flex-wrap gap-4 items-center">
                  <div class="relative">
                    <svg
                      class="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
                      <path d="M20 20L16.65 16.65" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                    <input
                      v-model="searchQuery"
                      type="text"
                      placeholder="Tìm kiếm tên dịch vụ..."
                      class="dv-filter-font text-xs uppercase tracking-widest bg-transparent border-b border-gray-200 focus:outline-none focus:border-black pl-5 py-1 w-44 md:w-56"
                    />
                  </div>

                  <select
                    v-model="selectedPriceRange"
                    class="dv-filter-font text-xs uppercase tracking-widest bg-transparent focus:outline-none cursor-pointer"
                  >
                    <option value="all">Tất cả mức giá</option>
                    <option value="low">Dưới 300.000đ</option>
                    <option value="mid">300k – 700k</option>
                    <option value="high">Trên 700.000đ</option>
                  </select>
                </div>
              </div>

              <!-- <div
                v-if="activeCategoryName"
                class="container active-category-bar"
              >
                <span class="active-category-label">
                  Đang xem: <strong>{{ activeCategoryName }}</strong>
                </span>
                <button
                  class="clear-category-btn"
                  @click="selectedCategory = 'all'"
                >
                  Xem tất cả
                </button>
              </div> -->

              <section
                ref="servicesListRef"
                class="services-editorial-section"
                data-aos="fade-up"
              >
                <div v-if="services.length > 0" class="services-editorial-list">
                  <div
                    v-for="(s, idx) in services"
                    :key="s.maDv"
                    :class="['editorial-row', idx % 2 !== 0 ? 'reverse' : '']"
                  >
                    <div
                      class="editorial-image-wrap"
                      @click="
                        routerInstance.push({
                          name: 'serviceDetail',
                          params: { id: s.maDv },
                        })
                      "
                    >
                      <!-- HOT BADGE -->
                      <div v-if="s.isHot" class="hot-badge">
                        <i class="fas fa-fire"></i> HOT
                      </div>
                      <!-- SALE BADGE -->
                      <div v-if="s.flashSale" class="sale-ribbon-wrapper">
                        <div class="sale-ribbon">
                          -{{ s.flashSale.phanTramGiam }}%
                        </div>
                      </div>
                      <img
                        :src="getImageUrl(s.hinhAnh)"
                        :alt="s.tenDv"
                        class="editorial-img"
                      />
                    </div>

                    <div class="editorial-content">
                      <span class="editorial-duration">
                        <i class="fas fa-clock"></i> {{ s.thoiGianLam }} Phút
                      </span>
                      <h2 class="font-playfair editorial-title">
                        {{ s.tenDv }}
                      </h2>

                      <div class="editorial-price-row">
                        <template v-if="s.flashSale">
                          <span class="editorial-price-old">{{
                            formatPrice(s.gia)
                          }}</span>
                          <span class="editorial-price-new">
                            {{
                              formatPrice(
                                getDiscountPrice(
                                  s.gia,
                                  s.flashSale.phanTramGiam,
                                ),
                              )
                            }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="editorial-price-main">{{
                            formatPrice(s.gia)
                          }}</span>
                        </template>
                      </div>

                      <div class="rating-mini-box" v-if="ratingsMap[s.maDv]">
                        <svg
                          class="gold-star"
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path
                            d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"
                          />
                        </svg>
                        <span class="r-number">{{
                          ratingsMap[s.maDv]?.avg
                        }}</span>
                        <span class="r-count"
                          >({{ ratingsMap[s.maDv]?.count }} đánh giá)</span
                        >
                      </div>
                      <div class="rating-mini-box no-rating" v-else>
                        Chưa có đánh giá
                      </div>

                      <p class="editorial-desc">{{ s.moTa }}</p>

                      <div class="editorial-actions">
                        <button
                          class="btn-outline-editorial"
                          @click="
                            routerInstance.push({
                              name: 'serviceDetail',
                              params: { id: s.maDv },
                            })
                          "
                        >
                          Xem Chi Tiết
                        </button>
                        <button
                          class="btn-solid-editorial"
                          @click="addToCart(s)"
                        >
                          Đặt Lịch Ngay
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  v-else
                  class="text-center py-5 no-result-box"
                  data-aos="fade-in"
                >
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

              <div
                v-if="totalPages > 1"
                class="pagination-minimal"
                data-aos="fade-up"
              >
                <button
                  type="button"
                  class="pagination-nav"
                  :disabled="currentPage === 1"
                  @click="changePage(currentPage - 1)"
                >
                  &larr; Trước
                </button>

                <div class="pagination-numbers">
                  <button
                    v-for="(page, index) in visiblePages"
                    :key="index"
                    type="button"
                    class="pagination-page"
                    :class="
                      page === currentPage
                        ? 'active'
                        : page === '...'
                          ? 'ellipsis'
                          : ''
                    "
                    :disabled="page === '...'"
                    @click="typeof page === 'number' && changePage(page)"
                  >
                    {{ page === "..." ? "..." : page }}
                  </button>
                </div>

                <button
                  type="button"
                  class="pagination-nav"
                  :disabled="currentPage === totalPages"
                  @click="changePage(currentPage + 1)"
                >
                  Sau &rarr;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section
      class="services-editorial-section combo-editorial-section"
      style="margin-top: 100px; margin-bottom: 100px"
    >
      <div class="text-center mb-5" data-aos="fade-up">
        <h2 class="font-playfair combo-title-premium fw-900 display-5">
          GÓI COMBO ĐẶC BIỆT
        </h2>
        <div class="gold-divider-thick"></div>
        <p class="text-muted section-subtitle">
          Tiết kiệm hơn, đẹp toàn diện hơn
        </p>
      </div>

      <div class="services-editorial-list">
        <div
          v-for="(c, idx) in combos"
          :key="c.maCb || idx"
          :class="[
            'editorial-row',
            (services.length + idx) % 2 !== 0 ? 'reverse' : '',
          ]"
          data-aos="fade-up"
        >
          <div
            class="editorial-image-wrap"
            @click="
              routerInstance.push({
                name: 'detailCombo',
                params: { id: c.maCb },
              })
            "
          >
            <div class="hot-badge combo-tag">ƯU ĐÃI</div>
            <img
              :src="getImageUrl(c.hinhAnh)"
              :alt="c.tenCombo"
              class="editorial-img"
            />
          </div>

          <div class="editorial-content">
            <h2 class="font-playfair editorial-title">{{ c.tenCombo }}</h2>

            <div class="editorial-price-row">
              <span class="editorial-price-main">{{ formatPrice(c.gia) }}</span>
            </div>

            <div class="rating-mini-box" v-if="ratingsMap[c.maCb]">
              <svg
                class="gold-star"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"
                />
              </svg>
              <span class="r-number">{{ ratingsMap[c.maCb]?.avg }}</span>
              <span class="r-count"
                >({{ ratingsMap[c.maCb]?.count }} đánh giá)</span
              >
            </div>
            <div class="rating-mini-box no-rating" v-else>Chưa có đánh giá</div>

            <p class="editorial-desc">{{ c.moTa }}</p>

            <ul class="combo-list-items editorial-combo-list">
              <li v-for="item in c.items" :key="item">
                <i class="fas fa-gem"></i> {{ item }}
              </li>
            </ul>

            <div class="editorial-actions">
              <button
                class="btn-outline-editorial"
                @click="
                  routerInstance.push({
                    name: 'detailCombo',
                    params: { id: c.maCb },
                  })
                "
              >
                Xem Chi Tiết
              </button>
              <button class="btn-solid-editorial" @click="addToCart(c)">
                Đặt Lịch Ngay
              </button>
            </div>
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
  justify-content: center;
  gap: 12px;
  margin-bottom: 32px;
  font-family: "Jost", sans-serif;
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted, #9ca3af);
}

.active-category-label strong {
  font-weight: 500;
  color: var(--ink);
}

.clear-category-btn {
  background: none;
  border: none;
  color: inherit;
  font-size: 11px;
  font-family: "Jost", sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  text-decoration: underline;
  padding: 0;
  cursor: pointer;
  transition: color 0.2s ease;
}

.clear-category-btn:hover {
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
  --danger: #d92d20;

  font-family: "Jost", sans-serif;
  background: var(--bg);
  overflow-x: clip; /* chỉ ẩn scroll ngang, không cắt content dọc — dùng clip thay vì hidden
                        vì hidden sẽ vô tình biến div này thành 1 "hộp cuộn" khiến
                        sidebar bên trong dùng position: sticky KHÔNG dính lại được
                        khi cuộn trang (sticky context bị đổi từ viewport sang div này) */
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

/* HOT badge — chuẩn theo style dịch vụ: góc trái-trên, vuông góc, màu đỏ --danger,
   không bo tròn, không nhấp nháy/đổ bóng — áp dụng đồng nhất cho cả dịch vụ & sản phẩm */
.hot-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  background: var(--danger);
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

@keyframes hot-pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.85;
    transform: scale(1.05);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
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
  position: relative; /* ← cho phép badge absolute bên trong */
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

/* =========================================================
   EDITORIAL SERVICES LAYOUT (ảnh - chữ xen kẽ)
   ========================================================= */
.services-editorial-section {
  max-width: 1440px;
  margin: 0 auto;
  padding: 60px 24px 0;
}

.services-editorial-list {
  display: flex;
  flex-direction: column;
  gap: 96px;
}

.editorial-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 48px;
}

@media (min-width: 768px) {
  .editorial-row {
    flex-direction: row;
    gap: 80px;
  }
  .editorial-row.reverse {
    flex-direction: row-reverse;
  }
}

.editorial-image-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 5;
  background: var(--bg-soft);
  overflow: hidden;
  cursor: pointer;
}

@media (min-width: 768px) {
  .editorial-image-wrap,
  .editorial-content {
    width: 50%;
  }
}

.editorial-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 1s ease;
}

.editorial-image-wrap:hover .editorial-img {
  transform: scale(1.05);
}

.editorial-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.editorial-duration {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--ink);
  background: var(--bg-soft);
  border: 1px solid var(--line);
  padding: 7px 14px;
  margin-bottom: 18px;
  width: fit-content;
}

.editorial-duration i {
  font-size: 11px;
  color: var(--danger);
}

.editorial-title {
  font-size: 1.8rem;
  text-transform: uppercase;
  letter-spacing: 3px;
  font-weight: 600;
  color: var(--ink);
  margin-bottom: 16px;
}

@media (min-width: 1024px) {
  .editorial-title {
    font-size: 2.2rem;
  }
}

.editorial-price-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 16px;
}

.editorial-price-old {
  font-size: 1rem;
  color: var(--muted-light);
  text-decoration: line-through;
  font-family: "Jost", sans-serif;
}

.editorial-price-new {
  font-size: 1.3rem;
  font-weight: 500;
  color: var(--danger);
  font-family: "Jost", sans-serif;
}

.editorial-price-main {
  font-size: 1.3rem;
  font-weight: 400;
  color: var(--ink);
  font-family: "Jost", sans-serif;
}

/* Đồng bộ font khu vực bộ lọc dịch vụ (Danh mục, đếm số dịch vụ, ô tìm kiếm, lọc mức giá)
   theo đúng font "Jost" dùng xuyên suốt trang, thay vì font mặc định của trình duyệt/Tailwind. */
.dv-filter-font,
.dv-filter-font::placeholder {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

.editorial-desc {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 0.95rem;
  color: var(--muted);
  font-weight: 300;
  line-height: 1.7;
  letter-spacing: 0.2px;
  margin: 16px 0 40px;
  max-width: 480px;
}

.editorial-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.btn-outline-editorial {
  border: 1px solid var(--ink);
  color: var(--ink);
  padding: 16px 32px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  background: transparent;
  cursor: pointer;
  font-family: "Jost", sans-serif;
  transition: all 0.3s ease;
}

.btn-outline-editorial:hover {
  background: var(--ink);
  color: #fff;
}

.btn-solid-editorial {
  background: var(--ink);
  color: #fff;
  border: 1px solid var(--ink);
  padding: 16px 32px;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  cursor: pointer;
  font-family: "Jost", sans-serif;
  transition: all 0.3s ease;
}

.btn-solid-editorial:hover {
  background: var(--ink-soft);
  border-color: var(--ink-soft);
}

/* Pagination — đồng bộ với Product.vue */
.pagination-minimal {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  max-width: 1440px;
  margin: 96px auto 0;
  padding: 32px 24px 0;
  border-top: 1px solid var(--line);
  flex-wrap: wrap;
}

@media (max-width: 1023px) {
  .pagination-minimal {
    gap: 24px;
  }
}

.pagination-nav {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--muted);
  background: none;
  border: none;
  cursor: pointer;
  font-family: "Jost", sans-serif;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination-nav:hover:not(:disabled) {
  color: var(--ink);
}

.pagination-nav:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.pagination-numbers {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: "Jost", sans-serif;
  font-size: 12px;
  font-weight: 300;
}

@media (min-width: 1024px) {
  .pagination-numbers {
    gap: 16px;
  }
}

.pagination-page {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-family: "Jost", sans-serif;
  font-size: 12px;
  font-weight: 300;
  transition: color 0.2s ease;
}

.pagination-page:hover:not(:disabled):not(.active):not(.ellipsis) {
  color: var(--ink);
}

.pagination-page.active {
  border-bottom: 1px solid var(--ink);
  color: var(--ink);
}

.pagination-page.ellipsis {
  color: var(--muted-light);
  cursor: default;
}

/* Tag "ƯU ĐÃI" cho combo — màu đen để phân biệt với badge đỏ (HOT/giảm giá) */
.editorial-image-wrap .hot-badge.combo-tag {
  background: var(--ink);
}

/* List tính năng combo trong layout editorial — căn trái, theo chiều rộng nội dung */
.editorial-combo-list {
  max-width: 480px;
  margin: 0 0 32px;
}

/* Badge trong ảnh editorial (dịch vụ/combo) — sale-ribbon vẫn cần position riêng */
.editorial-image-wrap .sale-ribbon-wrapper {
  position: absolute;
  z-index: 5;
}

.editorial-image-wrap .hot-badge {
  z-index: 5;
}

.editorial-image-wrap .sale-ribbon-wrapper {
  top: 14px;
  right: 14px;
  left: auto;
  width: auto;
  height: auto;
  overflow: visible;
}

.editorial-image-wrap .sale-ribbon {
  position: static;
  top: auto;
  right: auto;
  transform: none;
  width: auto;
  background: var(--danger);
  padding: 7px 14px;
  font-size: 10px;
  letter-spacing: 2px;
}

/* =========================================================
   FLOATING CART
   ========================================================= */
.floating-cart-btn {
  position: fixed;
  bottom: 160px;
  right: 20px;
  width: 56px;
  height: 56px;
  background: var(--ink);
  border-radius: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
  box-shadow: none;
  z-index: 9999999;
  transition: 0.3s;
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

/* =========================================================
   LƯỚI DANH MỤC (gộp từ Dmdichvu.vue)
   ========================================================= */
.dm-spinner {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.font-heading {
  font-family: var(--font-heading, "Inter", sans-serif);
  font-weight: 500;
  letter-spacing: 0.08em;
}

/* Card danh mục đang được lọc (đồng bộ với "Đang xem" ở phần dịch vụ bên dưới) */
.is-active h3 {
  text-decoration: underline;
  text-underline-offset: 4px;
}
</style>