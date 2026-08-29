<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
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
  if (img.startsWith("http")) return img; // URL Cloudinary (hoặc URL tuyệt đối khác) — giữ nguyên
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/${img}`;
};

// ======================= CAROUSEL ẢNH TRÊN CARD SẢN PHẨM =======================
// Gộp ảnh đại diện + gallery (p.hinhAnhs, tối đa 5 ảnh phụ trả từ /filter) thành 1
// mảng để lướt trái/phải ngay trên thẻ sản phẩm, không cần vào trang chi tiết.
const getProductImages = (p: any): string[] => {
  const imgs: string[] = [];
  if (p?.hinhAnhDaiDien) imgs.push(p.hinhAnhDaiDien);
  if (Array.isArray(p?.hinhAnhs)) {
    for (const h of p.hinhAnhs) {
      if (h && h !== p.hinhAnhDaiDien) imgs.push(h);
    }
  }
  return imgs.length ? imgs : [""];
};

// Index ảnh đang hiển thị của từng card, theo mã sản phẩm
const activeImageIndex = ref<Record<string, number>>({});

const getActiveIndex = (maSp: string) => activeImageIndex.value[maSp] ?? 0;

const setActiveIndex = (maSp: string, index: number, total: number) => {
  const safe = ((index % total) + total) % total;
  activeImageIndex.value[maSp] = safe;
};

const nextImage = (p: any) => {
  const imgs = getProductImages(p);
  if (imgs.length <= 1) return;
  setActiveIndex(p.maSp, getActiveIndex(p.maSp) + 1, imgs.length);
};

const prevImage = (p: any) => {
  const imgs = getProductImages(p);
  if (imgs.length <= 1) return;
  setActiveIndex(p.maSp, getActiveIndex(p.maSp) - 1, imgs.length);
};

// Vuốt cảm ứng (mobile) — theo dõi điểm chạm bắt đầu, so sánh khi kết thúc
const touchStartX = ref(0);
const onTouchStart = (e: TouchEvent) => {
  touchStartX.value = e.touches[0]?.clientX ?? 0;
};
const onTouchEnd = (e: TouchEvent, p: any) => {
  const deltaX = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.value;
  const SWIPE_THRESHOLD = 40;
  if (deltaX > SWIPE_THRESHOLD) prevImage(p);
  else if (deltaX < -SWIPE_THRESHOLD) nextImage(p);
};
// ==============================================================================

// Ảnh cho lưới danh mục (API danh mục trả path khác với ảnh sản phẩm)
const getCategoryImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("http")) return img; // URL Cloudinary — giữ nguyên
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/sanpham/${img}`;
};

// Ảnh cho lưới thương hiệu — kiểm tra lại đúng folder lưu ảnh Thuonghieu.HinhAnh nếu khác
const getBrandImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("http")) return img; // URL Cloudinary — giữ nguyên
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

// 🔥 Loading tổng cho lần tải đầu tiên: gộp danh mục + feed lại thành 1 spinner duy
// nhất (thay vì mỗi khối tự hiện/tắt spinner riêng gây cảm giác load 2 lần liên tiếp).
// Vẫn còn true nếu 1 trong 2 khối chưa xong.

const searchQuery        = ref("");
const selectedDanhMuc     = ref("all");
const selectedThuongHieu = ref("all");
const selectedPriceRange = ref("all");

// Bộ lọc sản phẩm — panel nổi, xổ ra bên phải (thay cho thanh filter luôn hiện cũ)
const productFilterOpen = ref(false);
const productFilterActive = computed(
  () =>
    searchQuery.value.trim() !== "" ||
    selectedDanhMuc.value !== "all" ||
    selectedThuongHieu.value !== "all" ||
    selectedPriceRange.value !== "all",
);

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

// Hủy request /filter đang bay dở khi có request mới hơn — tránh trường hợp response
// của request CŨ (search trước) về SAU response của request MỚI (search sau) và ghi
// đè kết quả đúng bằng kết quả sai (race condition khi gõ nhanh).
let filterAbortController: AbortController | null = null;

const fetchFiltered = async () => {
  filterAbortController?.abort();
  filterAbortController = new AbortController();
  const { signal } = filterAbortController;

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
      signal,
    });
    products.value   = res.data.data;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    if (axios.isCancel(err) || (err as any)?.code === "ERR_CANCELED") return; // bị hủy do search mới hơn — bỏ qua, không phải lỗi thật
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
// FEED "BANNER DANH MỤC + SẢN PHẨM" — khối riêng phía trên khu vực Filter/Grid cũ.
// Mỗi danh mục: banner (nếu có) -> 4 hàng sản phẩm (pageSize=16) -> nút "Xem thêm".
// Sản phẩm của từng danh mục chỉ tải khi khối đó lọt vào viewport (lazy theo danh mục).
// ======================================================
interface FeedBanner { maBanner: string; tieuDe?: string; hinhAnh?: string; }
interface FeedCategory {
  maDanhMuc: string;
  tenDanhMuc: string;
  banners: FeedBanner[];
  // Mã các danh mục đang "ở ké" chung khối này (gồm chính maDanhMuc). Backend tự gộp các
  // danh mục không có banner vào danh mục-banner gần nhất để tránh 1 khối trơ trọi không
  // banner đứng lẻ loi giữa trang — xem GetDanhMucFeed ở SanPhamController.
  maDanhMucGop?: string[];
}
interface FeedCategoryState {
  category: FeedCategory;
  products: any[];
  page: number;
  totalPages: number;
  loading: boolean;
  loaded: boolean; // đã tải lần đầu chưa (để show skeleton đúng lúc)
}

const feedCategories = ref<FeedCategoryState[]>([]);
const feedLoading    = ref(true);
const feedError      = ref(false);
const FEED_PAGE_SIZE = 16; // ~4 hàng x 4 cột desktop

// 🔥 true khi CẢ danh mục lẫn feed đều đang tải lần đầu — dùng để hiện đúng 1 spinner
// chung, tránh 2 spinner của 2 khối hiện tách rời nhìn giật cục.
const initialLoading = computed(() => categoriesLoading.value || feedLoading.value);

const fetchFeedCategories = async () => {
  try {
    feedLoading.value = true;
    feedError.value = false;
    const res = await axios.get(`${API}/api/SanPham/danh-muc-feed`);
    const list: FeedCategory[] = res.data?.data || [];
    feedCategories.value = list.map(cat => ({
      category: cat,
      products: [],
      page: 0,
      totalPages: 1,
      loading: false,
      loaded: false,
    }));
  } catch (err) {
    console.error("fetchFeedCategories error:", err);
    feedError.value = true;
  } finally {
    feedLoading.value = false;
  }
};

// Tải thêm 1 trang sản phẩm cho 1 danh mục trong feed (lần đầu hoặc "Xem thêm")
const loadMoreFeedProducts = async (state: FeedCategoryState) => {
  if (state.loading) return;
  if (state.loaded && state.page >= state.totalPages) return;

  state.loading = true;
  try {
    const nextPage = state.page + 1;
    // 🔥 Nếu danh mục này đang "gánh" thêm sản phẩm của (các) danh mục không-banner ở ké
    // (maDanhMucGop), gửi luôn cả nhóm mã đó để BE trả về sản phẩm gộp chung khối.
    const maDanhMucParam = state.category.maDanhMucGop?.length
      ? state.category.maDanhMucGop.join(",")
      : state.category.maDanhMuc;
    const res = await axios.get(`${API}/api/SanPham/san-pham-theo-danh-muc`, {
      params: {
        maDanhMuc: maDanhMucParam,
        page: nextPage,
        pageSize: FEED_PAGE_SIZE,
      },
    });
    state.products.push(...(res.data?.data || []));
    state.page = nextPage;
    state.totalPages = res.data?.totalPages ?? 1;
  } catch (err) {
    console.error("loadMoreFeedProducts error:", state.category.maDanhMuc, err);
  } finally {
    state.loading = false;
    state.loaded = true;
  }
};

// IntersectionObserver: mỗi khối danh mục trong feed chỉ tải sản phẩm khi cuộn tới gần
const feedBlockRefs = ref<Record<string, HTMLElement | null>>({});
let feedObserver: IntersectionObserver | null = null;

const setFeedBlockRef = (maDanhMuc: string, el: Element | null) => {
  feedBlockRefs.value[maDanhMuc] = el as HTMLElement | null;
  if (el && feedObserver) feedObserver.observe(el);
};

const initFeedObserver = () => {
  if (typeof IntersectionObserver === "undefined") {
    // Môi trường không hỗ trợ (SSR/test) → tải hết luôn cho an toàn
    feedCategories.value.forEach(state => loadMoreFeedProducts(state));
    return;
  }
  feedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const maDanhMuc = Object.keys(feedBlockRefs.value).find(
          key => feedBlockRefs.value[key] === entry.target
        );
        const state = feedCategories.value.find(s => s.category.maDanhMuc === maDanhMuc);
        if (state && !state.loaded) {
          loadMoreFeedProducts(state);
        }
        // Đã bắt đầu tải rồi thì không cần theo dõi khối này nữa
        feedObserver?.unobserve(entry.target);
      }
    },
    { rootMargin: "200px 0px" } // bắt đầu tải trước khi khối thực sự lọt vào khung nhìn ~200px
  );

  nextTick(() => {
    Object.values(feedBlockRefs.value).forEach(el => {
      if (el) feedObserver?.observe(el);
    });
  });
};

const getFeedBannerImageUrl = (img?: string) => {
  if (!img) return "";
  if (img.startsWith("http")) return img;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/${img}`;
};

// ==============================================================================
// CAROUSEL BANNER THEO DANH MỤC — khi 1 danh mục có nhiều banner, hiển thị trượt
// (tự động chuyển sau vài giây, người dùng bấm mũi tên trái/phải hoặc vuốt chạm),
// thay vì xếp chồng dọc từng ảnh. Index hiện tại lưu theo mã danh mục.
// ==============================================================================
const activeBannerIndex = ref<Record<string, number>>({});
const BANNER_AUTOPLAY_MS = 4000;
const bannerAutoplayTimers: Record<string, ReturnType<typeof setInterval>> = {};

const getActiveBannerIndex = (maDanhMuc: string) => activeBannerIndex.value[maDanhMuc] ?? 0;

const setActiveBannerIndex = (maDanhMuc: string, index: number, total: number) => {
  const safe = ((index % total) + total) % total;
  activeBannerIndex.value[maDanhMuc] = safe;
};

const nextBanner = (maDanhMuc: string, total: number) => {
  if (total <= 1) return;
  setActiveBannerIndex(maDanhMuc, getActiveBannerIndex(maDanhMuc) + 1, total);
};

const prevBanner = (maDanhMuc: string, total: number) => {
  if (total <= 1) return;
  setActiveBannerIndex(maDanhMuc, getActiveBannerIndex(maDanhMuc) - 1, total);
};

// Bắt đầu auto-slide cho 1 danh mục có nhiều banner. Gọi lại (vd sau khi người dùng
// bấm thủ công) sẽ reset timer để không "giật" chuyển tiếp ngay sau thao tác tay.
const startBannerAutoplay = (maDanhMuc: string, total: number) => {
  stopBannerAutoplay(maDanhMuc);
  if (total <= 1) return;
  bannerAutoplayTimers[maDanhMuc] = setInterval(() => {
    nextBanner(maDanhMuc, total);
  }, BANNER_AUTOPLAY_MS);
};

const stopBannerAutoplay = (maDanhMuc: string) => {
  if (bannerAutoplayTimers[maDanhMuc]) {
    clearInterval(bannerAutoplayTimers[maDanhMuc]);
    delete bannerAutoplayTimers[maDanhMuc];
  }
};

const stopAllBannerAutoplay = () => {
  Object.keys(bannerAutoplayTimers).forEach(stopBannerAutoplay);
};

// Người dùng thao tác tay (bấm mũi tên / dot / vuốt) -> chuyển banner + reset auto-slide
const goToBanner = (maDanhMuc: string, index: number, total: number) => {
  setActiveBannerIndex(maDanhMuc, index, total);
  startBannerAutoplay(maDanhMuc, total);
};
const nextBannerManual = (maDanhMuc: string, total: number) => {
  nextBanner(maDanhMuc, total);
  startBannerAutoplay(maDanhMuc, total);
};
const prevBannerManual = (maDanhMuc: string, total: number) => {
  prevBanner(maDanhMuc, total);
  startBannerAutoplay(maDanhMuc, total);
};

// Vuốt chạm (mobile) cho banner
const bannerTouchStartX = ref(0);
const onBannerTouchStart = (e: TouchEvent) => {
  bannerTouchStartX.value = e.touches[0]?.clientX ?? 0;
};
const onBannerTouchEnd = (e: TouchEvent, maDanhMuc: string, total: number) => {
  const deltaX = (e.changedTouches[0]?.clientX ?? 0) - bannerTouchStartX.value;
  const SWIPE_THRESHOLD = 40;
  if (deltaX > SWIPE_THRESHOLD) prevBannerManual(maDanhMuc, total);
  else if (deltaX < -SWIPE_THRESHOLD) nextBannerManual(maDanhMuc, total);
};
// ==============================================================================

// Banner "giữ chỗ" hiển thị ở đầu khu vực kết quả lọc, tránh trông trống trải khi
// feed banner theo danh mục bị ẩn đi lúc đang lọc. Luôn lấy banner đầu tiên của
// danh mục đầu tiên trong feed — cố định, không phụ thuộc đang lọc theo gì.
const firstFeedBanner = computed<FeedBanner | null>(() => {
  for (const state of feedCategories.value) {
    if (state.category.banners.length && state.category.banners[0]) return state.category.banners[0];
  }
  return null;
});


// Danh mục / thương hiệu / khoảng giá là bấm chọn (không phải gõ) → lọc ngay lập tức.
watch(
  [selectedDanhMuc, selectedThuongHieu, selectedPriceRange],
  () => { currentPage.value = 1; fetchFiltered(); }
);

// Ô tìm kiếm là gõ phím → debounce 300ms, chỉ gọi API sau khi người dùng ngừng gõ,
// tránh bắn 1 request/ký tự (gây giật khi gõ nhanh và tốn ngân sách Redis cache vì
// mỗi chuỗi tìm kiếm dở dang cũng tạo 1 cacheKey riêng ở BE).
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const SEARCH_DEBOUNCE_MS = 300;

watch(searchQuery, () => {
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentPage.value = 1;
    fetchFiltered();
  }, SEARCH_DEBOUNCE_MS);
});

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

watch(
  () => route.query.tenDanhMuc,
  (newTenDanhMuc) => {
    if (newTenDanhMuc) {
      const tenDM = (newTenDanhMuc as string).toLowerCase();
      const found = categoryList.value.find(c => c.tenDanhMuc?.toLowerCase().includes(tenDM)) ||
                    danhMucList.value.find(d => d.tenDanhMuc?.toLowerCase().includes(tenDM));
      if (found && selectedDanhMuc.value !== (found.maDM || found.maDMSP)) {
        selectedDanhMuc.value = found.maDM || found.maDMSP;
      }
    }
  },
  { immediate: true }
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
  if (route.query.danhMuc) {
    selectedDanhMuc.value = route.query.danhMuc as string;
  }
  if (route.query.thuongHieu) {
    selectedThuongHieu.value = route.query.thuongHieu as string;
  }

  // 🔥 Gộp các lệnh tải ban đầu chạy SONG SONG (thay vì nối tiếp từng cái) để chỉ có
  // 1 khoảng chờ loading duy nhất thay vì 2 spinner (danh mục + feed) hiện tách rời
  // trông giật cục. initialLoading bao trùm cả 2 khối, chỉ tắt khi tất cả xong.
  const tasks: Promise<any>[] = [
    fetchInit(),
    fetchCategoryGrid(), // 🔥 lấy danh mục để hiển thị lưới (gộp từ Shop.vue)
    fetchFeedCategories(), // 🔥 Feed banner + sản phẩm theo từng danh mục
  ];
  if (productFilterActive.value) {
    // Khu vực grid+filter giờ ẩn mặc định (chỉ hiện khi có filter active) — chỉ cần
    // gọi fetchFiltered() ngay lúc mount nếu người dùng vào thẳng bằng URL đã có sẵn
    // query (?danhMuc=... / ?thuongHieu=...). Nếu chưa lọc gì, watch ở trên sẽ tự gọi
    // fetchFiltered() khi người dùng thao tác lọc sau này.
    tasks.push(fetchFiltered());
  }
  await Promise.all(tasks);
  initFeedObserver();

  // 🔥 Bắt đầu auto-slide cho các danh mục có từ 2 banner trở lên
  feedCategories.value.forEach(state => {
    if (state.category.banners.length > 1) {
      startBannerAutoplay(state.category.maDanhMuc, state.category.banners.length);
    }
  });

  // 🔥 mỗi lần vào lại trang (mount) thì auto scroll lên đầu danh sách sản phẩm
  scrollToProductsTop(false);

  nextTick(updateBrandScrollState);
  window.addEventListener("resize", updateBrandScrollState);
});

onUnmounted(() => {
  feedObserver?.disconnect();
  stopAllBannerAutoplay();
  window.removeEventListener("resize", updateBrandScrollState);
  if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
  filterAbortController?.abort();
});
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">

    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">

      <!-- HERO TITLE -->
      

      <!-- ======================= -->
      <!-- LOADING TỔNG cho lần tải đầu (danh mục + feed) — chỉ 1 spinner duy nhất
           thay vì mỗi khối tự hiện spinner riêng, tránh cảm giác "load 2 lần". -->
      <!-- ======================= -->
      <div v-if="initialLoading" class="category-grid-loading">
        <div class="dm-spinner"></div>
      </div>

      <template v-else>
        <!-- ======================= -->
        <!-- LƯỚI DANH MỤC (đồng bộ với Dmdichvu.vue) -->
        <!-- ======================= -->
        <section class="category-grid-section" data-aos="fade-up">
          <div class="category-grid-container">
            <h2 class="category-grid-heading">Tất cả Sản Phẩm</h2>

            <div v-if="categoriesError" class="category-grid-error">
              Không thể tải danh mục sản phẩm.
            </div>

            <div v-else class="category-grid" ref="categoryGridRef">
              <div
                v-for="cat in categoryList"
                :key="cat.maDM"
                class="category-grid-item"
                :class="{ 'is-active': selectedDanhMuc === cat.maDM }"
                @click="goToCategory(cat.maDM)"
              >
                <div class="category-grid-image-wrap">
                  <img
                    :src="getCategoryImageUrl(cat.hinhAnh)"
                    :alt="cat.tenDanhMuc"
                    class="category-grid-img"
                  />
                </div>
                <h3 class="category-grid-name font-heading">
                  {{ cat.tenDanhMuc }}
                </h3>
              </div>
            </div>
          </div>
        </section>

        <!-- ======================= -->
        <!-- FEED: BANNER DANH MỤC + SẢN PHẨM (Banner A -> SP A -> Banner B -> SP B -> ...) -->
        <!-- Chỉ hiện khi người dùng CHƯA lọc gì. Khi có lọc (search / chọn danh mục /
             thương hiệu / khoảng giá), feed này ẩn HẲN, nhường chỗ hoàn toàn cho khu
             vực kết quả lọc bên dưới — không hiện đồng thời cả hai. -->
        <!-- ======================= -->
        <section v-if="!productFilterActive" class="feed-section" data-aos="fade-up">
          <div v-if="feedError" class="category-grid-error">
            Không thể tải nội dung danh mục.
          </div>

          <div v-else>
          <div
            v-for="state in feedCategories"
            :key="state.category.maDanhMuc"
            :ref="(el) => setFeedBlockRef(state.category.maDanhMuc, el as Element | null)"
            class="feed-block"
          >
            <!-- BANNER CỦA DANH MỤC (nếu có) — carousel trượt khi có từ 2 banner trở lên -->
            <div
              v-if="state.category.banners.length"
              class="feed-banner-carousel"
              @touchstart="onBannerTouchStart"
              @touchend="onBannerTouchEnd($event, state.category.maDanhMuc, state.category.banners.length)"
              @mouseenter="stopBannerAutoplay(state.category.maDanhMuc)"
              @mouseleave="startBannerAutoplay(state.category.maDanhMuc, state.category.banners.length)"
            >
              <div
                class="feed-banner-track"
                :style="{ transform: `translateX(-${getActiveBannerIndex(state.category.maDanhMuc) * 100}%)` }"
              >
                <img
                  v-for="b in state.category.banners"
                  :key="b.maBanner"
                  :src="getFeedBannerImageUrl(b.hinhAnh)"
                  :alt="b.tieuDe || state.category.tenDanhMuc"
                  class="feed-banner-img"
                />
              </div>

              <template v-if="state.category.banners.length > 1">
                <button
                  type="button"
                  class="feed-banner-nav feed-banner-nav--prev"
                  aria-label="Banner trước"
                  @click.stop="prevBannerManual(state.category.maDanhMuc, state.category.banners.length)"
                >
                  <i class="fas fa-chevron-left"></i>
                </button>
                <button
                  type="button"
                  class="feed-banner-nav feed-banner-nav--next"
                  aria-label="Banner sau"
                  @click.stop="nextBannerManual(state.category.maDanhMuc, state.category.banners.length)"
                >
                  <i class="fas fa-chevron-right"></i>
                </button>
                <div class="feed-banner-dots" @click.stop>
                  <span
                    v-for="(b, idx) in state.category.banners"
                    :key="b.maBanner"
                    class="feed-banner-dot"
                    :class="{ 'is-active': getActiveBannerIndex(state.category.maDanhMuc) === idx }"
                    @click="goToBanner(state.category.maDanhMuc, idx, state.category.banners.length)"
                  ></span>
                </div>
              </template>
            </div>

            <!-- TIÊU ĐỀ DANH MỤC -->
            <!-- <div class="feed-block-header">
              <h2 class="feed-block-title font-heading">{{ state.category.tenDanhMuc }}</h2>
              <button
                type="button"
                class="feed-block-viewall"
                @click="goToCategory(state.category.maDanhMuc)"
              >
                Xem tất cả &rarr;
              </button>
            </div> -->

            <!-- SKELETON khi đang tải lần đầu -->
            <div v-if="state.loading && !state.loaded" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div v-for="n in 4" :key="n" class="feed-skeleton-card"></div>
            </div>

            <!-- KHÔNG CÓ SẢN PHẨM -->
            <!-- <div v-else-if="state.loaded && !state.products.length" class="feed-empty">
              Danh mục này chưa có sản phẩm.
            </div> -->

            <!-- GRID SẢN PHẨM CỦA DANH MỤC (2 hàng x 4 cột desktop) -->
            <!-- Dùng flex + flex-wrap + justify-center thay vì CSS grid: khi danh mục có
                 ít sản phẩm hơn số cột (vd chỉ 1-2 sp), CSS grid sẽ dồn card về bên trái
                 và để trống khoảng lớn bên phải — trông lệch. flex-wrap + justify-center
                 tự động căn giữa các card còn lại trên hàng cuối, kể cả khi cả danh mục
                 chỉ có 1 sản phẩm duy nhất. -->
            <div v-else class="product-flex-row">
              <div
                v-for="p in state.products"
                :key="p.maSp"
                class="product-flex-card group flex flex-col cursor-pointer"
                @click="router.push({ name: 'productDetail', params: { id: p.maSp } })"
              >
                <div
                  class="aspect-[3/4] overflow-hidden bg-gray-100 mb-4 relative border border-gray-100 group-hover:border-black transition-all duration-300"
                  @touchstart="onTouchStart"
                  @touchend="onTouchEnd($event, p)"
                >
                  <div v-if="p.isHot" class="hot-badge">
                    <i class="fas fa-fire"></i> HOT
                  </div>
                  <span
                    v-else-if="p.soLuongTon > 0 && p.soLuongTon <= 10"
                    class="absolute top-3 left-3 z-10 bg-black text-white text-[10px] uppercase tracking-widest px-3 py-1.5"
                  >
                    Sắp hết
                  </span>

                  <img
                    :src="getImageUrl(getProductImages(p)[getActiveIndex(p.maSp)])"
                    :alt="p.tenSp"
                    class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />

                  <template v-if="getProductImages(p).length > 1">
                    <button
                      type="button"
                      class="product-carousel-nav product-carousel-nav--prev"
                      aria-label="Ảnh trước"
                      @click.stop="prevImage(p)"
                    >
                      <i class="fas fa-chevron-left"></i>
                    </button>
                    <button
                      type="button"
                      class="product-carousel-nav product-carousel-nav--next"
                      aria-label="Ảnh sau"
                      @click.stop="nextImage(p)"
                    >
                      <i class="fas fa-chevron-right"></i>
                    </button>
                    <div class="product-carousel-dots" @click.stop>
                      <span
                        v-for="(img, idx) in getProductImages(p)"
                        :key="idx"
                        class="product-carousel-dot"
                        :class="{ 'is-active': getActiveIndex(p.maSp) === idx }"
                        @click="setActiveIndex(p.maSp, idx, getProductImages(p).length)"
                      ></span>
                    </div>
                  </template>
                </div>

                <h3 class="product-card-name mb-1 line-clamp-2">{{ p.tenSp }}</h3>
                <p v-if="p.thuongHieu?.tenThuongHieu" class="product-card-brand text-black uppercase tracking-widest mb-1">
                  {{ p.thuongHieu.tenThuongHieu }}
                </p>
                <span class="product-card-price text-gray-400 font-semibold tracking-tight">
                  {{ getPriceDisplay(p).text }}
                </span>
              </div>
            </div>

            <!-- NÚT XEM THÊM -->
            <div v-if="state.loaded && state.page < state.totalPages" class="feed-block-more">
              <button
                type="button"
                class="feed-more-btn"
                :disabled="state.loading"
                @click="loadMoreFeedProducts(state)"
              >
                {{ state.loading ? "Đang tải..." : "Xem thêm" }}
              </button>
            </div>
          </div>
        </div>
        </section>
      </template>

      <!-- ======================= -->
      <!-- LƯỚI THƯƠNG HIỆU -->
      <!-- ======================= -->
      

      <!-- ======================= -->
      <!-- SIDEBAR DANH MỤC (trái, xổ xuống) + NỘI DUNG SẢN PHẨM (phải) -->
      <!-- Chỉ hiện khu vực này khi người dùng thực sự tìm kiếm/lọc (search, chọn danh
           mục/thương hiệu/khoảng giá, hoặc bấm "Xem tất cả" ở feed banner phía trên).
           Mặc định (chưa lọc gì) chỉ hiện feed banner theo danh mục ở trên, tránh lặp
           sản phẩm với feed. -->
      <!-- ======================= -->
      <div v-if="productFilterActive">

        <!-- BANNER GIỮ CHỖ: hiện banner của danh mục đầu tiên trong feed khi đang lọc,
             tránh khu vực kết quả trông trống trải vì feed banner bị ẩn lúc này. -->
        <div v-if="firstFeedBanner" class="filter-result-banner-wrap">
          <img
            :src="getFeedBannerImageUrl(firstFeedBanner.hinhAnh)"
            :alt="firstFeedBanner.tieuDe || 'Banner'"
            class="filter-result-banner-img"
          />
        </div>

        <div class="flex flex-col lg:flex-row gap-10">

        <!-- SIDEBAR DANH MỤC -->


        <!-- NỘI DUNG BÊN PHẢI: filter + grid sản phẩm + phân trang -->
        <div class="flex-1 min-w-0">

      <!-- ĐANG LỌC THEO DANH MỤC / THƯƠNG HIỆU -->
      <!-- <div v-if="activeCategoryName || activeBrandName" class="dv-filter-font flex flex-wrap items-center justify-center gap-3 mb-8 text-[11px] uppercase tracking-widest text-gray-400">
        <span v-if="activeCategoryName">Danh mục: <strong class="text-black">{{ activeCategoryName }}</strong></span>
        <span v-if="activeBrandName">Thương hiệu: <strong class="text-black">{{ activeBrandName }}</strong></span>
        <button @click="selectedDanhMuc = 'all'; selectedThuongHieu = 'all'" class="underline hover:text-black transition-colors">
          Xem tất cả
        </button>
      </div> -->

      <!-- TOP BAR: neo vị trí đầu grid để auto-scroll khi đổi trang -->
      <div ref="productsListRef" class="pb-4 border-b border-gray-100 mb-8"></div>

      <!-- GRID SẢN PHẨM -->
      <!-- Dùng flex-wrap + justify-center (xem giải thích ở block feed phía trên) để
           kết quả lọc ra ít sản phẩm cũng tự căn giữa thay vì dồn về bên trái. -->
      <div v-if="Array.isArray(products) && products.length" class="product-flex-row">
        <div
          v-for="p in products"
          :key="p.maSp"
          class="product-flex-card group flex flex-col cursor-pointer mb-4"
          @click="router.push({ name: 'productDetail', params: { id: p.maSp } })"
        >
          <div
            class="aspect-[3/4] overflow-hidden bg-gray-100 mb-4 relative border border-gray-100 group-hover:border-black transition-all duration-300"
            @touchstart="onTouchStart"
            @touchend="onTouchEnd($event, p)"
          >

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
            <!-- <span
              v-else-if="p.soLuongTon === 0"
              class="absolute top-3 left-3 z-10 bg-gray-400 text-white text-[10px] uppercase tracking-widest px-3 py-1.5"
            >
              Hết hàng
            </span> -->

            <img
              :src="getImageUrl(getProductImages(p)[getActiveIndex(p.maSp)])"
              :alt="p.tenSp"
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <!-- NÚT LƯỚT TRÁI / PHẢI (chỉ hiện khi có nhiều hơn 1 ảnh) -->
            <template v-if="getProductImages(p).length > 1">
              <button
                type="button"
                class="product-carousel-nav product-carousel-nav--prev"
                aria-label="Ảnh trước"
                @click.stop="prevImage(p)"
              >
                <i class="fas fa-chevron-left"></i>
              </button>
              <button
                type="button"
                class="product-carousel-nav product-carousel-nav--next"
                aria-label="Ảnh sau"
                @click.stop="nextImage(p)"
              >
                <i class="fas fa-chevron-right"></i>
              </button>

              <!-- CHẤM CHỈ BÁO -->
              <div class="product-carousel-dots" @click.stop>
                <span
                  v-for="(img, idx) in getProductImages(p)"
                  :key="idx"
                  class="product-carousel-dot"
                  :class="{ 'is-active': getActiveIndex(p.maSp) === idx }"
                  @click="setActiveIndex(p.maSp, idx, getProductImages(p).length)"
                ></span>
              </div>
            </template>

            <!-- <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button
                class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed"
                :disabled="p.soLuongTon === 0"
                @click.stop="router.push({ name: 'productDetail', params: { id: p.maSp } })"
              >
                {{ p.soLuongTon === 0 ? "Hết hàng" : "Xem ngay" }}
              </button>
            </div> -->
          </div>

          <h3 class="product-card-name mb-1 line-clamp-2">
            {{ p.tenSp }}
          </h3>

          <p v-if="p.thuongHieu?.tenThuongHieu" class="product-card-brand text-black uppercase tracking-widest mb-1">
            {{ p.thuongHieu.tenThuongHieu }}
          </p>

          <!-- <div v-if="p.soSao != null" class="flex items-center gap-1 mb-2 text-[11px] text-gray-400">
            <svg class="w-3 h-3 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.7 7-6.3-3.9-6.3 3.9 1.7-7L2 9.2l7.1-.6L12 2z"/>
            </svg>
            <span class="text-black font-medium">{{ p.soSao }}</span>
            <span>({{ p.soLuongDanhGia }})</span>
          </div> -->
          <!-- <p v-else class="text-[11px] text-gray-300 italic mb-2">Chưa có đánh giá</p> -->

          <span class="product-card-price text-gray-400 font-semibold tracking-tight">
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
      <!-- /KHỐI productFilterActive (banner giữ chỗ + sidebar/nội dung) -->

    </div>

    <!-- ======================= -->
    <!-- BỘ LỌC SẢN PHẨM — nút nổi cố định + panel trượt từ phải -->
    <!-- ======================= -->
    <button
      type="button"
      class="product-filter-fab"
      :class="{ 'has-active-filter': productFilterActive }"
      @click="productFilterOpen = true"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="4" y1="6" x2="20" y2="6" />
        <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
        <line x1="4" y1="18" x2="20" y2="18" />
        <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
      </svg>
      Bộ Lọc
      <span v-if="productFilterActive" class="product-filter-fab-dot"></span>
    </button>

    <Teleport to="body">
      <transition name="product-filter-fade">
        <div
          v-if="productFilterOpen"
          class="product-filter-overlay"
          @click.self="productFilterOpen = false"
        >
          <transition name="product-filter-slide">
            <aside v-if="productFilterOpen" class="product-filter-panel">
              <div class="product-filter-panel-header">
                <h3 class="dv-filter-font">Tìm Kiếm &amp; Lọc Sản Phẩm</h3>
                <button
                  type="button"
                  class="product-filter-close"
                  @click="productFilterOpen = false"
                  aria-label="Đóng bộ lọc"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </svg>
                </button>
              </div>

              <div class="product-filter-panel-body">
                <label class="dv-filter-font product-filter-label">Tên sản phẩm</label>
                <div class="relative product-filter-search-wrap">
                  <svg
                    class="product-filter-search-icon"
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
                    placeholder="Tìm kiếm sản phẩm..."
                    class="dv-filter-font product-filter-search-input"
                  />
                </div>

                <label class="dv-filter-font product-filter-label">Danh mục</label>
                <select
                  v-model="selectedDanhMuc"
                  class="dv-filter-font product-filter-select"
                >
                  <option value="all">Tất cả danh mục</option>
                  <option
                    v-for="dm in danhMucList"
                    :key="dm.maDMSP"
                    :value="dm.maDMSP"
                  >
                    {{ dm.tenDanhMuc }}
                  </option>
                </select>

                <label class="dv-filter-font product-filter-label">Thương hiệu</label>
                <select
                  v-model="selectedThuongHieu"
                  class="dv-filter-font product-filter-select"
                >
                  <option value="all">Tất cả thương hiệu</option>
                  <option
                    v-for="th in thuongHieuList"
                    :key="th.maTh"
                    :value="th.maTh"
                  >
                    {{ th.tenThuongHieu }}
                  </option>
                </select>

                <label class="dv-filter-font product-filter-label">Mức giá</label>
                <select
                  v-model="selectedPriceRange"
                  class="dv-filter-font product-filter-select"
                >
                  <option value="all">Tất cả mức giá</option>
                  <option value="low">Dưới 200.000đ</option>
                  <option value="mid">200k – 500k</option>
                  <option value="high">Trên 500.000đ</option>
                </select>

                <button
                  v-if="productFilterActive"
                  type="button"
                  class="dv-filter-font product-filter-reset"
                  @click="
                    searchQuery = '';
                    selectedDanhMuc = 'all';
                    selectedThuongHieu = 'all';
                    selectedPriceRange = 'all';
                  "
                >
                  Xoá bộ lọc
                </button>
              </div>
            </aside>
          </transition>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* =========================================================
   LƯỚI SẢN PHẨM TỰ CĂN GIỮA (dùng chung: feed theo danh mục + grid filter cũ)
   ---------------------------------------------------------
   CSS grid không tự căn giữa item khi số sản phẩm ít hơn số cột — card sẽ dồn về
   bên trái, để trống khoảng lớn bên phải. flex-wrap + justify-center giải quyết
   đúng vấn đề này: đủ sản phẩm thì tự xuống hàng như grid, thiếu sản phẩm (kể cả
   chỉ 1 sản phẩm) thì tự căn giữa hàng đó.
   ========================================================= */
.product-flex-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  column-gap: 1.5rem; /* tương đương gap-x-6 */
  row-gap: 2rem;       /* tương đương gap-y-8 */
}

.product-flex-card {
  /* Mobile: 2 thẻ / hàng */
  flex: 0 0 calc((100% - 1.5rem) / 2);
  max-width: calc((100% - 1.5rem) / 2);
}

@media (min-width: 768px) {
  .product-flex-card {
    /* Tablet: 3 thẻ / hàng */
    flex-basis: calc((100% - 2 * 1.5rem) / 3);
    max-width: calc((100% - 2 * 1.5rem) / 3);
  }
}

@media (min-width: 1024px) {
  .product-flex-card {
    /* Desktop: 4 thẻ / hàng */
    flex-basis: calc((100% - 3 * 1.5rem) / 4);
    max-width: calc((100% - 3 * 1.5rem) / 4);
  }
}

/* =========================================================
   FEED: BANNER DANH MỤC + SẢN PHẨM
   ========================================================= */
.feed-section {
  margin-bottom: 3rem;
}

.feed-block {
  margin-bottom: 4rem;
}
.feed-block:last-child {
  margin-bottom: 0;
}

/* Carousel banner theo danh mục: track trượt ngang bằng transform, ảnh nào cũng
   full-width/height auto theo khung, chỉ 1 ảnh hiện tại được thấy (overflow hidden). */
.feed-banner-carousel {
  position: relative;
  overflow: hidden;
  border-radius: 4px;
  margin-bottom: 1.5rem;
}

.feed-banner-track {
  display: flex;
  transition: transform 0.5s ease;
}

.feed-banner-img {
  width: 100%;
  height: auto;
  flex: 0 0 100%;
  display: block;
  object-fit: cover;
}

.feed-banner-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  color: #111;
  border: none;
  border-radius: 50%;
  font-size: 14px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.feed-banner-carousel:hover .feed-banner-nav {
  opacity: 1;
}

.feed-banner-nav:hover {
  background: #fff;
}

.feed-banner-nav--prev {
  left: 16px;
}

.feed-banner-nav--next {
  right: 16px;
}

.feed-banner-dots {
  position: absolute;
  bottom: 14px;
  left: 0;
  width: 100%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.feed-banner-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.feed-banner-dot.is-active {
  background: #fff;
  border-color: rgba(0, 0, 0, 0.4);
  transform: scale(1.2);
}

/* Mobile: luôn hiện nút mũi tên (không có hover), vuốt chạm vẫn là cách chính */
@media (hover: none) {
  .feed-banner-nav {
    opacity: 1;
  }
}

/* Banner giữ chỗ ở đầu khu vực kết quả lọc (khi productFilterActive) */
.filter-result-banner-wrap {
  margin-bottom: 2rem;
}

.filter-result-banner-img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  border-radius: 4px;
}

.feed-block-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.75rem;
}

.feed-block-title {
  font-size: 1.25rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #111;
  margin: 0;
}

.feed-block-viewall {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #999;
  background: none;
  border: none;
  cursor: pointer;
  transition: color 0.2s;
  white-space: nowrap;
}
.feed-block-viewall:hover {
  color: #111;
}

.feed-empty {
  text-align: center;
  padding: 3rem 0;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #bbb;
}

.feed-skeleton-card {
  aspect-ratio: 3 / 4;
  background: linear-gradient(90deg, #f3f3f3 25%, #eaeaea 37%, #f3f3f3 63%);
  background-size: 400% 100%;
  animation: feed-skeleton-shimmer 1.4s ease infinite;
  border-radius: 2px;
}
@keyframes feed-skeleton-shimmer {
  0%   { background-position: 100% 50%; }
  100% { background-position: 0 50%; }
}

.feed-block-more {
  display: flex;
  justify-content: center;
  margin-top: 2rem;
}

.feed-more-btn {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #111;
  background: none;
  border: 1px solid #111;
  padding: 12px 32px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.feed-more-btn:hover:not(:disabled) {
  background: #111;
  color: #fff;
}
.feed-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Đồng bộ font khu vực bộ lọc sản phẩm (Danh mục, Thương hiệu, đếm số lượng, tìm kiếm, lọc mức giá)
   theo font hệ thống (giống Home.vue/Dmdichvu.vue) - an toàn dấu tiếng Việt, không cần tải font ngoài. */
.dv-filter-font,
.dv-filter-font::placeholder {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

/* HOT badge — đồng bộ với Services.vue */
.hot-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  background: #d92d20;
  color: #fff;
  padding: 7px 14px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
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
   CAROUSEL ẢNH TRÊN CARD SẢN PHẨM (lướt trái/phải)
   ========================================================= */
.product-carousel-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.85);
  color: #111;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s ease, background 0.2s ease;
}

.group:hover .product-carousel-nav {
  opacity: 1;
}

.product-carousel-nav:hover {
  background: #fff;
}

.product-carousel-nav--prev {
  left: 10px;
}

.product-carousel-nav--next {
  right: 10px;
}

.product-carousel-dots {
  position: absolute;
  bottom: 12px;
  left: 0;
  width: 100%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.product-carousel-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.product-carousel-dot.is-active {
  background: #111;
  transform: scale(1.2);
}

/* Trên mobile luôn hiện nút mũi tên (không có hover) để vẫn thao tác được,
   nhưng vuốt ngón tay vẫn là cách chính để chuyển ảnh trên thiết bị cảm ứng. */
@media (hover: none) {
  .product-carousel-nav {
    opacity: 0;
  }
}

/* =========================================================
   LƯỚI DANH MỤC (đồng bộ với Dmdichvu.vue)
   ========================================================= */
.category-grid-section {
  padding: 0 0 40px;
}

.category-grid-container {
  max-width: 100%;
}

.category-grid-heading {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.4rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  margin-bottom: 24px;
  text-transform: none !important;
}

.category-grid-loading,
.category-grid-error {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #9ca3af;
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  /* Căn giữa để khi danh mục ít (không đủ lấp đầy hàng) chúng nằm giữa thay vì
     dồn hết bên trái và bỏ trống bên phải. Với hàng đã đầy, center không đổi gì
     so với flex-start vì không còn khoảng trống để phân bổ. */
  justify-content: center;
}

.category-grid-item {
  cursor: pointer;
  width: 175px;
}

.category-grid-image-wrap {
  width: 175px;
  height: 175px;
  background: #dcdcdc;
  overflow: hidden;
}

.category-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s ease;
}

.category-grid-item:hover .category-grid-img {
  transform: scale(1.05);
}

.category-grid-name {
  margin: 14px 0 0;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #111827;
}

/* =========================================================
   THẺ SẢN PHẨM — Tên / Thương hiệu / Giá
   Font duy nhất: "Helvetica Neue", Helvetica, Arial, sans-serif
   px -> rem quy đổi theo gốc 16px = 1rem
   ========================================================= */
.product-card-name {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1rem;        /* 16px */
  font-weight: 400 !important;
  line-height: 2rem;      /* 32px */
  text-transform: none;
  min-height: 4rem;       /* giữ chỗ cho đủ 2 dòng dù tên ngắn hay dài */
}

.product-card-brand {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.875rem;    /* 14px */
  font-weight: 400 !important;
  line-height: 1.1875rem; /* 19px */
}

.product-card-price {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.875rem;    /* 14px */
  font-weight: 340;
  line-height: 1.9375rem; /* 31px */
}

@media (max-width: 1023px) {
  .category-grid {
    gap: 20px;
  }
}

@media (max-width: 576px) {
  .category-grid {
    gap: 16px;
    justify-content: center;
  }
  .category-grid-item {
    width: calc(50% - 8px);
  }
  .category-grid-image-wrap {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }
  .category-grid-heading {
    font-size: 1.4rem;
  }
}

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
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
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

/* =========================================================
   BỘ LỌC SẢN PHẨM — nút nổi cố định + panel trượt từ phải
   ========================================================= */
.product-filter-fab {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #111;
  color: #fff;
  border: none;
  border-radius: 999px;
  padding: 12px 22px;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.product-filter-fab:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
}

.product-filter-fab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e53935;
}

.product-filter-fab.has-active-filter {
  background: #e53935;
}

.product-filter-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.product-filter-panel {
  width: 100%;
  max-width: 360px;
  height: 100%;
  background: #fff;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.product-filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.product-filter-panel-header h3 {
  font-size: 1rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #111;
  margin: 0;
}

.product-filter-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #111;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-filter-panel-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-filter-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #999;
  margin: 12px 0 4px;
}

.product-filter-label:first-child {
  margin-top: 0;
}

.product-filter-search-wrap {
  position: relative;
}

.product-filter-search-icon {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #999;
}

.product-filter-search-input {
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid #e5e5e5;
  padding: 8px 4px 8px 22px;
  outline: none;
}

.product-filter-search-input:focus {
  border-bottom-color: #111;
}

.product-filter-select {
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid #e5e5e5;
  padding: 8px 4px;
  outline: none;
  cursor: pointer;
}

.product-filter-select:focus {
  border-bottom-color: #111;
}

.product-filter-reset {
  margin-top: 20px;
  align-self: flex-start;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #e53935;
  background: none;
  border: none;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
  padding: 0;
}

/* Transitions */
.product-filter-fade-enter-active,
.product-filter-fade-leave-active {
  transition: opacity 0.25s ease;
}
.product-filter-fade-enter-from,
.product-filter-fade-leave-to {
  opacity: 0;
}

.product-filter-slide-enter-active,
.product-filter-slide-leave-active {
  transition: transform 0.3s ease;
}
.product-filter-slide-enter-from,
.product-filter-slide-leave-to {
  transform: translateX(100%);
}

@media (max-width: 480px) {
  .product-filter-panel {
    max-width: 100%;
  }
  .product-filter-fab {
    bottom: 18px;
    padding: 10px 18px;
    font-size: 0.75rem;
  }
}
</style>