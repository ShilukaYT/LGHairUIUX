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

// Ảnh cho lưới danh mục (API danh mục trả path khác với ảnh sản phẩm)
const getCategoryImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/sanpham/${img}`;
};

// Ảnh cho lưới thương hiệu — kiểm tra lại đúng folder lưu ảnh Thuonghieu.HinhAnh nếu khác
const getBrandImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/thuonghieu/${img}`;
};

// ======================================================
// STATE
// ======================================================
const products       = ref<any[]>([]);
const danhMucList    = ref<any[]>([]);
const thuongHieuList = ref<any[]>([]);

// Lưới danh mục sản phẩm (gộp từ Shop.vue) — hiển thị ngay trên trang này
const categoryList      = ref<any[]>([]);
const categoriesLoading = ref(true);
const categoriesError   = ref(false);
const categoryGridRef   = ref<HTMLElement | null>(null);

const searchQuery        = ref("");
const selectedDanhMuc     = ref("all");
const selectedThuongHieu = ref("all");
const selectedPriceRange = ref("all");

// Sidebar danh mục bên trái (xổ xuống)
const sidebarOpen  = ref(true);       // đóng/mở toàn bộ panel danh mục
const expandedCats = ref<string[]>([]); // các danh mục cha đang xổ danh mục con ra

const toggleExpand = (maDM: string) => {
  const i = expandedCats.value.indexOf(maDM);
  if (i === -1) expandedCats.value.push(maDM);
  else expandedCats.value.splice(i, 1);
};

// ======================================================
// MENU: Danh Mục Sản Phẩm + Thương Hiệu (chỉ còn phần SẢN PHẨM ở trang này)
// ======================================================
// Đóng/mở từng nhóm trong menu.
const sidebarSection = ref<{
  sanPham: boolean;
  thuongHieu: boolean;
}>({
  sanPham: true,
  thuongHieu: false,
});
const toggleSection = (key: "sanPham" | "thuongHieu") => {
  sidebarSection.value[key] = !sidebarSection.value[key];
};

// ⚠️ Đổi lại đúng tên route (name) của trang danh sách DỊCH VỤ (Dmdichvu.vue) trong
// router/index.ts nếu tên route ở dự án của bạn khác "dmdv" — dùng để điều hướng
// sang trang dịch vụ khi khách bấm nút "Xem dịch vụ" ở trang này.
const SERVICES_ROUTE_NAME = "dmdv";
const goToServicesPage = () => {
  router.push({ name: SERVICES_ROUTE_NAME });
};

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

// Lấy danh sách danh mục để hiển thị lưới (gộp từ Shop.vue)
const fetchCategoryGrid = async () => {
  try {
    categoriesLoading.value = true;
    categoriesError.value = false;
    const res = await axios.get(`${API}/api/DanhMucSP/san-pham`);
    categoryList.value = res.data;
  } catch (err) {
    console.error("Lỗi lấy danh mục sản phẩm:", err);
    categoriesError.value = true;
  } finally {
    categoriesLoading.value = false;
  }
};

// Bấm vào 1 danh mục trong lưới → lọc luôn sản phẩm bên dưới (không cần chuyển trang nữa
// vì giờ 2 khu vực đã ở chung 1 trang)
const goToCategory = (maDM: string) => {
  selectedDanhMuc.value = maDM;

  // Nếu maDM là danh mục con thì tự động xổ danh mục cha ra cho dễ nhìn
  const parent = categoryList.value.find(
    (c: any) => Array.isArray(c.children) && c.children.some((s: any) => s.maDM === maDM)
  );
  if (parent && !expandedCats.value.includes(parent.maDM)) {
    expandedCats.value.push(parent.maDM);
  }

  scrollToProductsTop();
};

// Bấm vào 1 thẻ thương hiệu trong lưới → lọc sản phẩm bên dưới theo thương hiệu đó
const goToBrand = (maTh: string) => {
  selectedThuongHieu.value = maTh;
  scrollToProductsTop();
};

// ======================================================
// CAROUSEL THƯƠNG HIỆU — 8 thẻ/hàng, cuộn ngang trái/phải
// ======================================================
const brandTrackRef  = ref<HTMLElement | null>(null);
const canScrollLeft  = ref(false);
const canScrollRight = ref(false);

const updateBrandScrollState = () => {
  const el = brandTrackRef.value;
  if (!el) return;
  canScrollLeft.value  = el.scrollLeft > 4;
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
};

const scrollBrand = (direction: 1 | -1) => {
  const el = brandTrackRef.value;
  if (!el) return;
  el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
};

// Sau khi danh sách thương hiệu load xong thì tính lại trạng thái nút trái/phải
watch(thuongHieuList, () => {
  nextTick(updateBrandScrollState);
});

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
  return (
    categoryList.value.find(c => c.maDM === selectedDanhMuc.value)?.tenDanhMuc ||
    danhMucList.value.find(d => d.maDMSP === selectedDanhMuc.value)?.tenDanhMuc ||
    null
  );
});

const activeBrandName = computed(() => {
  if (selectedThuongHieu.value === "all") return null;
  return thuongHieuList.value.find(t => t.maTh === selectedThuongHieu.value)?.tenThuongHieu || null;
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

// Đồng bộ lại thương hiệu mỗi khi query ?thuongHieu=... đổi (vd: bấm menu tổng hợp
// từ trang Dmdichvu.vue sang đây để lọc theo thương hiệu).
watch(
  () => route.query.thuongHieu,
  (newThuongHieu) => {
    const value = (newThuongHieu as string) || "all";
    if (selectedThuongHieu.value !== value) {
      selectedThuongHieu.value = value;
    }
  }
);

onMounted(async () => {
  await fetchInit();
  await fetchCategoryGrid(); // 🔥 lấy danh mục để hiển thị lưới (gộp từ Shop.vue)
  if (route.query.danhMuc) {
    selectedDanhMuc.value = route.query.danhMuc as string;
  }
  if (route.query.thuongHieu) {
    selectedThuongHieu.value = route.query.thuongHieu as string;
  }
  await fetchFiltered();

  // 🔥 mỗi lần vào lại trang (mount) thì auto scroll lên đầu danh sách sản phẩm
  scrollToProductsTop(false);

  nextTick(updateBrandScrollState);
  window.addEventListener("resize", updateBrandScrollState);
});
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">

    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">

      <!-- HERO TITLE -->
      <div class="text-center mb-10">
        <h1 class="font-heading text-3xl md:text-4xl uppercase tracking-widest text-black">
          {{ activeCategoryName || activeBrandName || "Sản phẩm chăm sóc tóc chính hãng" }}
        </h1>
      </div>

      <!-- ======================= -->
      <!-- LƯỚI DANH MỤC (gộp từ Shop.vue) -->
      <!-- ======================= -->
      

      <!-- ======================= -->
      <!-- LƯỚI THƯƠNG HIỆU -->
      <!-- ======================= -->
      

      <!-- ======================= -->
      <!-- SIDEBAR DANH MỤC (trái, xổ xuống) + NỘI DUNG SẢN PHẨM (phải) -->
      <!-- ======================= -->
      <div class="flex flex-col lg:flex-row gap-10">

        <!-- SIDEBAR DANH MỤC -->
        <aside class="w-full lg:w-64 shrink-0">
          <div class="border border-gray-100 lg:sticky lg:top-24">

            <!-- HEADER — bấm để xổ/đóng cả panel -->
            <button
              type="button"
              class="w-full flex items-center justify-between gap-2 px-4 py-3.5 border-b border-gray-100 bg-gray-50"
              @click="sidebarOpen = !sidebarOpen"
            >
              <span class="flex items-center gap-2 text-xs uppercase tracking-widest font-semibold text-black">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                </svg>
                Danh Mục Sản Phẩm
              </span>
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                class="transition-transform duration-300"
                :class="sidebarOpen ? 'rotate-180' : ''"
              >
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            <!-- Nút chuyển sang trang DỊCH VỤ (thay cho việc gộp chung sidebar như trước) -->
            <!-- <button
              type="button"
              class="w-full flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-100 text-[11px] uppercase tracking-widest text-gray-500 hover:text-black hover:bg-gray-50 transition-colors"
              @click="goToServicesPage"
            >
              <span>Xem Dịch Vụ</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 6l6 6-6 6"/>
              </svg>
            </button> -->

            <!-- MENU: Danh Mục Sản Phẩm + Thương Hiệu -->
            <nav v-show="sidebarOpen" class="max-h-[70vh] lg:max-h-[calc(100vh-10rem)] overflow-y-auto">

              <!-- ================= NHÓM: DANH MỤC SẢN PHẨM ================= -->
              <div class="border-b border-gray-100">
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-2.5 text-[11px] uppercase tracking-widest font-semibold text-black bg-gray-50/70"
                  @click="toggleSection('sanPham')"
                >
                  <span>Danh Mục Sản Phẩm</span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    class="transition-transform duration-300"
                    :class="sidebarSection.sanPham ? 'rotate-180' : ''"
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                <div v-show="sidebarSection.sanPham" class="py-1">
                  <!-- TẤT CẢ SẢN PHẨM -->
                  <button
                    type="button"
                    class="w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest transition-colors border-l-2"
                    :class="selectedDanhMuc === 'all'
                      ? 'text-black font-semibold bg-gray-50 border-black'
                      : 'text-gray-500 hover:text-black hover:bg-gray-50 border-transparent'"
                    @click="goToCategory('all')"
                  >
                    Tất cả sản phẩm
                  </button>

                  <!-- TỪNG DANH MỤC -->
                  <div v-for="cat in categoryList" :key="cat.maDM">
                    <div
                      class="flex items-center border-l-2 transition-colors"
                      :class="selectedDanhMuc === cat.maDM ? 'text-black font-semibold bg-gray-50 border-black' : 'text-gray-500 border-transparent hover:bg-gray-50'"
                    >
                      <button
                        type="button"
                        class="flex-1 text-left px-4 py-2.5 text-xs uppercase tracking-widest transition-colors hover:text-black truncate"
                        @click="goToCategory(cat.maDM)"
                      >
                        {{ cat.tenDanhMuc }}
                      </button>

                      <!-- Nút xổ danh mục con (chỉ hiện nếu có children) -->
                      <button
                        v-if="cat.children && cat.children.length"
                        type="button"
                        class="px-3 py-2.5 text-gray-400 hover:text-black shrink-0"
                        :aria-label="`Xổ danh mục con của ${cat.tenDanhMuc}`"
                        @click.stop="toggleExpand(cat.maDM)"
                      >
                        <svg
                          width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                          class="transition-transform duration-300"
                          :class="expandedCats.includes(cat.maDM) ? 'rotate-180' : ''"
                        >
                          <path d="M6 9l6 6 6-6"/>
                        </svg>
                      </button>
                    </div>

                    <!-- DANH MỤC CON — bấm vào load sản phẩm liền -->
                    <div
                      v-if="cat.children && cat.children.length && expandedCats.includes(cat.maDM)"
                      class="bg-gray-50/60"
                    >
                      <button
                        v-for="sub in cat.children"
                        :key="sub.maDM"
                        type="button"
                        class="w-full text-left pl-9 pr-4 py-2 text-[11px] uppercase tracking-widest transition-colors truncate"
                        :class="selectedDanhMuc === sub.maDM ? 'text-black font-medium' : 'text-gray-400 hover:text-black'"
                        @click="goToCategory(sub.maDM)"
                      >
                        {{ sub.tenDanhMuc }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- ================= NHÓM: THƯƠNG HIỆU ================= -->
              <div>
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-2.5 text-[11px] uppercase tracking-widest font-semibold text-black bg-gray-50/70"
                  @click="toggleSection('thuongHieu')"
                >
                  <span>Thương Hiệu</span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                    class="transition-transform duration-300"
                    :class="sidebarSection.thuongHieu ? 'rotate-180' : ''"
                  >
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>

                <div v-show="sidebarSection.thuongHieu" class="py-1">
                  <!-- TẤT CẢ THƯƠNG HIỆU -->
                  <button
                    type="button"
                    class="w-full text-left px-4 py-2.5 text-xs uppercase tracking-widest transition-colors border-l-2"
                    :class="selectedThuongHieu === 'all'
                      ? 'text-black font-semibold bg-gray-50 border-black'
                      : 'text-gray-500 hover:text-black hover:bg-gray-50 border-transparent'"
                    @click="goToBrand('all')"
                  >
                    Tất cả thương hiệu
                  </button>

                  <button
                    v-for="th in thuongHieuList"
                    :key="th.maTh"
                    type="button"
                    class="w-full text-left px-4 py-2 text-[11px] uppercase tracking-widest transition-colors truncate flex items-center justify-between gap-2"
                    :class="selectedThuongHieu === th.maTh ? 'text-black font-medium bg-gray-50' : 'text-gray-500 hover:text-black hover:bg-gray-50'"
                    @click="goToBrand(th.maTh)"
                  >
                    <span class="truncate">{{ th.tenThuongHieu }}</span>
                    <span class="text-gray-300 normal-case shrink-0">({{ th.soLuongSP }})</span>
                  </button>
                  <p v-if="!thuongHieuList.length" class="px-4 py-2 text-[11px] text-gray-300 italic">
                    Đang tải...
                  </p>
                </div>
              </div>
            </nav>
          </div>
        </aside>

        <!-- NỘI DUNG BÊN PHẢI: filter + grid sản phẩm + phân trang -->
        <div class="flex-1 min-w-0">

      <!-- ĐANG LỌC THEO DANH MỤC / THƯƠNG HIỆU -->
      <div v-if="activeCategoryName || activeBrandName" class="flex flex-wrap items-center justify-center gap-3 mb-8 text-[11px] uppercase tracking-widest text-gray-400">
        <span v-if="activeCategoryName">Danh mục: <strong class="text-black">{{ activeCategoryName }}</strong></span>
        <span v-if="activeBrandName">Thương hiệu: <strong class="text-black">{{ activeBrandName }}</strong></span>
        <button @click="selectedDanhMuc = 'all'; selectedThuongHieu = 'all'" class="underline hover:text-black transition-colors">
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
        <!-- /NỘI DUNG BÊN PHẢI -->

      </div>
      <!-- /SIDEBAR + NỘI DUNG -->

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

/* =========================================================
   LƯỚI DANH MỤC (gộp từ Shop.vue)
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
  to { transform: rotate(360deg); }
}

.font-heading {
  font-family: var(--font-heading, "Inter", sans-serif);
  font-weight: 500;
  letter-spacing: 0.08em;
}

/* Card danh mục đang được lọc (đồng bộ với "Đang xem" ở phần sản phẩm bên dưới) */
.is-active h3 {
  text-decoration: underline;
  text-underline-offset: 4px;
}

/* =========================================================
   CAROUSEL THƯƠNG HIỆU — thẻ bé lại, 8 thẻ/hàng, cuộn ngang
   ========================================================= */
.brand-track {
  display: flex;
  flex-wrap: nowrap;
  /* Ít thẻ hơn 1 hàng → tự căn giữa. Nhiều thẻ tràn hàng → tự chuyển về canh trái để cuộn
     ("safe" tránh bị cắt mất thẻ đầu khi nội dung tràn khỏi khung nhìn) */
  justify-content: center;
  justify-content: safe center;
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  padding-bottom: 4px;

  /* Ẩn thanh cuộn */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.brand-track::-webkit-scrollbar {
  display: none;
}
.brand-track > * {
  scroll-snap-align: start;
  min-width: 0;

  /* Mobile: 3 thẻ / hàng */
  flex: 0 0 calc((100% - 2 * 1rem) / 3);
}

/* Tablet: 5 thẻ / hàng */
@media (min-width: 640px) {
  .brand-track > * {
    flex-basis: calc((100% - 4 * 1rem) / 5);
  }
}

/* Desktop: 8 thẻ / hàng */
@media (min-width: 1024px) {
  .brand-track > * {
    flex-basis: calc((100% - 7 * 1rem) / 8);
  }
}

/* Nút điều hướng trái/phải */
.brand-nav-btn {
  position: absolute;
  top: 40%;
  transform: translateY(-50%);
  z-index: 20;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  color: #111827;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: background 0.2s, border-color 0.2s;
}
.brand-nav-btn--left {
  left: -14px;
}
.brand-nav-btn--right {
  right: -14px;
}
.brand-nav-btn:hover {
  background: #111827;
  color: #fff;
  border-color: #111827;
}
</style>