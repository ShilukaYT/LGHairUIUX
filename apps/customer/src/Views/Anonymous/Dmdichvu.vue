<script setup lang="ts">
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
const userMaKH = ref<string | null>(null);

const ratingsMap = ref<Record<string, { avg: number; count: number }>>({});

const API = import.meta.env.VITE_API_URL;
const getImageUrl = (img: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("http")) return img; // URL Cloudinary — giữ nguyên
  return `${API}/${img}`;
};
// Ảnh cho lưới danh mục (API danh mục trả path khác với ảnh dịch vụ/combo)
const getCategoryImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("http")) return img; // URL Cloudinary — giữ nguyên
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/danhmuc/${img}`;
};
// AOS
declare const AOS: any;

// 🔥 Gọi lại AOS sau mỗi lần danh sách dịch vụ/combo được Vue re-render do
// filter/đổi trang (v-for thay phần tử mới bên trong <section data-aos="...">).
// Nếu không gọi lại, AOS không biết các phần tử MỚI này để hoàn tất animation
// → chúng bị kẹt ở trạng thái CSS ban đầu (mờ/nhỏ hơn bình thường) thay vì hiển
// thị đúng kích thước/độ mờ như lúc mới vào trang.
const refreshAos = () => {
  nextTick(() => {
    if (typeof AOS !== "undefined" && AOS) {
      if (typeof AOS.refreshHard === "function") {
        AOS.refreshHard();
      } else if (typeof AOS.refresh === "function") {
        AOS.refresh();
      }
    }
  });
};

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

// ⚠️ Đổi lại đúng tên route (name) của trang danh sách SẢN PHẨM (Shop.vue) trong
// router/index.ts nếu tên route ở dự án của bạn khác "product" — dùng để điều hướng
// sang trang sản phẩm khi khách bấm nút "Xem sản phẩm" ở trang này.
const PRODUCTS_ROUTE_NAME = "product";
const goToProductsPage = () => {
  routerInstance.push({ name: PRODUCTS_ROUTE_NAME });
};

// Đồng bộ bộ lọc dịch vụ hiện tại lên URL (dùng replace để không phá lịch sử back/forward).
// Có "page" ở đây để reload/mở lại đúng trang đang xem thay vì luôn nhảy về trang 1
// (trước đây chỉ đồng bộ category, nên currentPage bị reset về mặc định mỗi lần mount).
const syncRouteQuery = () => {
  routerInstance.replace({
    query: {
      category: selectedCategory.value !== "all" ? selectedCategory.value : undefined,
      page: currentPage.value !== 1 ? String(currentPage.value) : undefined,
    },
  });
};

// =======================
// GHI NHỚ TRANG/DANH MỤC ĐANG XEM QUA CÁC LẦN ĐIỀU HƯỚNG (sessionStorage)
// =======================
// syncRouteQuery() chỉ giúp giữ đúng trang khi URL còn "?page=..." (reload, back/forward
// của trình duyệt). Nhưng khi bấm menu/nút "Xem sản phẩm" rồi bấm lại menu "Dịch Vụ" (điều
// hướng bằng router-link/router.push tới route dịch vụ KHÔNG kèm query), URL bị mất hết
// query cũ nên currentPage/selectedCategory lại về mặc định (trang 1, "all"). Lưu thêm 1
// bản vào sessionStorage để khôi phục cho đúng trường hợp này — không phụ thuộc URL.
const DMDV_STATE_KEY = "dmdv:lastState";
const saveStateToSession = () => {
  try {
    sessionStorage.setItem(
      DMDV_STATE_KEY,
      JSON.stringify({
        category: selectedCategory.value,
        page: currentPage.value,
      }),
    );
    console.log("[Dmdichvu debug] đã lưu:", { category: selectedCategory.value, page: currentPage.value }); // 🔎 TẠM THỜI — xoá sau khi debug xong
  } catch (e) {
    console.log("[Dmdichvu debug] lỗi lưu sessionStorage:", e); // 🔎 TẠM THỜI
    // sessionStorage có thể bị chặn (chế độ ẩn danh/quyền trình duyệt) — bỏ qua, không
    // ảnh hưởng chức năng chính, chỉ mất khả năng ghi nhớ trang.
  }
};

// =======================
// COMBO — hiển thị tối đa 9 combo/lượt, có nút "Xem thêm" (load more, giống Shop.vue)
// thay vì phân trang số trang: mỗi lần bấm sẽ tải thêm 9 combo tiếp theo và nối
// vào danh sách hiện có (không thay thế).
// Khai báo trước fetchAll() vì fetchAll() cần đọc comboPage/comboPageSize.
// =======================
const comboPage = ref(1);
const comboPageSize = ref(9);
const comboTotalPages = ref(1);
const comboLoadingMore = ref(false);
const comboListRef = ref<HTMLElement | null>(null);

// =======================
// BỘ LỌC DỊCH VỤ (panel nổi, xổ ra bên phải — nút "Bộ Lọc" luôn hiện
// cố định ở góc dưới màn hình, xuyên suốt toàn trang dịch vụ).
// Dùng chung searchQuery/selectedPriceRange với fetchFiltered() ở dưới,
// panel này chỉ là UI để nhập — logic gọi API đã có sẵn trong watch
// [searchQuery, selectedCategory, selectedPriceRange].
// =======================
const comboFilterOpen = ref(false);
const comboFilterActive = computed(
  () =>
    searchQuery.value.trim() !== "" ||
    selectedCategory.value !== "all" ||
    selectedPriceRange.value !== "all",
);

// =======================
// LOAD DATA BAN ĐẦU
// =======================
const fetchAll = async () => {
  const res = await axios.get(`${API}/api/DanhSachDichVu`, {
    params: {
      // servicePage cố định 1 ở đây vì dịch vụ trang chủ dùng /filter riêng (fetchFiltered);
      // GetAll chỉ dùng để lấy categories + combo phân trang.
      comboPage: comboPage.value,
      comboPageSize: comboPageSize.value,
    },
  });

  categories.value = res.data.categories;
  combos.value = res.data.combos;
  comboTotalPages.value = res.data.combosTotalPages;
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
// vì giờ 2 khu vực đã ở chung 1 trang). Bấm lại đúng danh mục đang chọn → huỷ lọc,
// quay về trạng thái "tất cả".
const goToCategory = (maDM: string) => {
  selectedCategory.value = selectedCategory.value === maDM ? "all" : maDM;
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
  syncRouteQuery(); // 🔥 ghi lại "page" lên URL để reload/mở lại đúng trang đang xem
  saveStateToSession(); // 🔥 để khôi phục đúng trang khi quay lại từ trang khác qua menu
  await fetchFiltered(); // 🔥 thiếu cái này
  scrollToServicesTop(); // 🔥 auto scroll lên dịch vụ đầu tiên khi đổi trang
  // 🔥 KHÔNG gọi refreshAos() ở đây: thẻ dịch vụ (v-for services) không có data-aos,
  // nên AOS.refreshHard() ở đây không giúp gì cho danh sách dịch vụ cả — nó chỉ tính
  // lại offset của MỌI phần tử data-aos trên trang (kể cả .category-grid-section,
  // .services-hero ở phía trên), khiến các khối đó bị reset về trạng thái opacity:0
  // ban đầu và không tự hiện lại → "biến mất" khỏi giao diện. Đây chính là nguyên
  // nhân UI bị nát sau khi đổi trang/lọc dịch vụ.
};

// Combo không còn tìm kiếm/lọc — "Xem thêm" chỉ cần gọi lại API với comboPage kế
// tiếp rồi NỐI kết quả mới vào combos hiện có (khác fetchAll() ban đầu là ghi đè).
const loadMoreCombos = async () => {
  if (comboLoadingMore.value) return;
  if (comboPage.value >= comboTotalPages.value) return;

  comboLoadingMore.value = true;
  try {
    const nextPage = comboPage.value + 1;
    const res = await axios.get(`${API}/api/DanhSachDichVu`, {
      params: {
        comboPage: nextPage,
        comboPageSize: comboPageSize.value,
      },
    });
    combos.value.push(...(res.data.combos || []));
    comboPage.value = nextPage;
    comboTotalPages.value = res.data.combosTotalPages;
    refreshAos();
  } catch (err) {
    console.error("loadMoreCombos error:", err);
  } finally {
    comboLoadingMore.value = false;
  }
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
// 🔥 Chống race condition: mỗi lần gọi fetchFiltered() sẽ có 1 "vé số" (requestId)
// riêng. Nếu người dùng gõ/lọc liên tục, nhiều request bay đi cùng lúc và có thể
// trả về KHÔNG đúng thứ tự đã gửi (request cũ trả về sau request mới). Trước đây
// cứ response nào về sau là ghi đè `services.value`, kể cả khi nó là dữ liệu của
// 1 lần filter đã cũ → danh sách dịch vụ hiển thị sai (lẫn dữ liệu cũ/mới), khiến
// layout xen kẽ trái/phải (idx % 2) không khớp với đúng dữ liệu → thẻ dịch vụ bị "nát".
// Cách sửa: chỉ áp dụng kết quả của request MỚI NHẤT, bỏ qua mọi response đến trễ.
let fetchFilteredRequestId = 0;
const fetchFiltered = async () => {
  const requestId = ++fetchFilteredRequestId;
  try {
    const res = await axios.get(`${API}/api/DanhSachDichVu/filter`, {
      params: {
        search: searchQuery.value,
        category: selectedCategory.value,
        priceRange: selectedPriceRange.value,
        page: currentPage.value,
        pageSize: pageSize.value,
      },
    });

    // Nếu trong lúc chờ API đã có 1 lần gọi fetchFiltered() khác mới hơn được kích
    // hoạt (do người dùng tiếp tục gõ/đổi filter) thì bỏ qua kết quả của lần gọi này.
    if (requestId !== fetchFilteredRequestId) return;

    services.value = res.data.data;
    totalPages.value = res.data.totalPages;
  } catch (err) {
    if (requestId !== fetchFilteredRequestId) return;
    console.error("❌ Lỗi lấy dịch vụ:", err);
  }
};

// =======================
// WATCH FILTER
// =======================
// 🔥 Debounce 350ms: trước đây watch bắn API ngay mỗi khi searchQuery đổi (tức mỗi
// ký tự gõ), tạo ra rất nhiều request dồn dập. Kết hợp với requestId guard ở trên,
// việc debounce giúp giảm hẳn số request bay đi cùng lúc → giao diện đỡ giật/nát
// khi gõ nhanh, đồng thời đỡ tải cho server. selectedCategory/selectedPriceRange
// là lựa chọn rời rạc (bấm 1 lần) nên debounce ngắn không ảnh hưởng cảm giác dùng.
// 🔥 Bật lên trong lúc onMounted đang khôi phục category/page từ URL — watcher
// [searchQuery, selectedCategory, selectedPriceRange] bên dưới sẽ bỏ qua lần kích
// hoạt này (không reset currentPage về 1), vì gán selectedCategory.value từ URL
// cũng kích hoạt watcher y hệt như người dùng tự bấm chọn category.
let isRestoringFromUrl = false;

let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch([searchQuery, selectedCategory, selectedPriceRange], () => {
  if (isRestoringFromUrl) return;
  if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(async () => {
    currentPage.value = 1;
    syncRouteQuery();
    saveStateToSession(); // 🔥 để khôi phục đúng category khi quay lại từ trang khác qua menu
    await fetchFiltered();
    // 🔥 KHÔNG gọi refreshAos() ở đây (xem giải thích chi tiết trong changePage()
    // phía trên) — đây là nguyên nhân khiến .category-grid-section và nút "Bộ Lọc"
    // biến mất khỏi giao diện mỗi khi gõ tìm kiếm/lọc dịch vụ.
  }, 350);
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
  // ĐỌC QUERY PARAM TỪ URL: ?category=...&page=...
  // Nếu URL không có gì (vd: vừa bấm menu "Dịch Vụ" từ trang khác, router.push không
  // kèm query) thì khôi phục từ sessionStorage — đây là trạng thái lọc/trang gần nhất
  // người dùng đang xem trước khi rời trang.
  // =======================
  isRestoringFromUrl = true;

  const hasCategoryInUrl = typeof route.query.category === "string";
  const hasPageInUrl = typeof route.query.page === "string";

  if (hasCategoryInUrl) {
    selectedCategory.value = route.query.category as string;
  }
  // 🔥 Đọc lại "page" từ URL để reload đúng trang đang xem thay vì luôn nhảy về
  // trang 1. fetchFiltered() bên dưới đã đọc currentPage.value nên chỉ cần set
  // trước khi Promise.all chạy.
  if (hasPageInUrl) {
    const parsedPage = parseInt(route.query.page as string, 10);
    if (!isNaN(parsedPage) && parsedPage > 0) {
      currentPage.value = parsedPage;
    }
  }

  // URL không mang theo gì → thử khôi phục từ lần xem gần nhất trong sessionStorage
  // (trường hợp quay lại trang này bằng menu/router.push thay vì URL có sẵn query).
  if (!hasCategoryInUrl && !hasPageInUrl) {
    try {
      const saved = sessionStorage.getItem(DMDV_STATE_KEY);
      console.log("[Dmdichvu debug] sessionStorage raw:", saved); // 🔎 TẠM THỜI — xoá sau khi debug xong
      if (saved) {
        const parsed = JSON.parse(saved) as { category?: string; page?: number };
        if (parsed.category) selectedCategory.value = parsed.category;
        if (parsed.page && parsed.page > 0) currentPage.value = parsed.page;
        console.log("[Dmdichvu debug] khôi phục:", { category: selectedCategory.value, page: currentPage.value }); // 🔎 TẠM THỜI
        syncRouteQuery(); // đưa state khôi phục được lên URL để reload sau đó vẫn đúng
      }
    } catch (e) {
      console.log("[Dmdichvu debug] lỗi khôi phục sessionStorage:", e); // 🔎 TẠM THỜI
      // JSON hỏng hoặc sessionStorage bị chặn — bỏ qua, dùng giá trị mặc định.
    }
  }

  // nextTick để watcher (nếu có kích hoạt bất đồng bộ) chắc chắn đã chạy xong dưới
  // cờ isRestoringFromUrl trước khi tắt cờ lại.
  await nextTick();
  isRestoringFromUrl = false;

  // 🔥 5 lệnh gọi API này độc lập với nhau (không cái nào cần dữ liệu của cái kia),
  // trước đây await tuần tự nên tổng thời gian chờ = cộng dồn round-trip của cả 5 API.
  // Chạy song song bằng Promise.all giúp tổng thời gian chờ ≈ thời gian của API chậm
  // nhất thay vì tổng của cả 5 → cải thiện rõ rệt thời gian load cảm nhận của trang.
  await Promise.all([
    fetchAll(), // lấy combo + categories
    fetchCategoryGrid(), // lấy danh mục dịch vụ để hiển thị lưới
    fetchFiltered(),
    updateCartBadge(), // cập nhật số lượng badge khi vào trang
    fetchRatings(), // lấy đánh giá trung bình cho tất cả dịch vụ
  ]);

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
  refreshAos();
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
    <!-- ======================= -->
    <!-- LƯỚI DANH MỤC DỊCH VỤ -->
    <!-- ======================= -->
    <section class="category-grid-section" data-aos="fade-up" data-aos-once="true">
      <div class="category-grid-container">
        <!-- <div class="section-kicker"> -->
          <!-- <span class="section-kicker-line"></span>
          <span class="section-kicker-text">Menu</span>
          <span class="section-kicker-line"></span>
        </div> -->
        <!-- <h2 class="category-grid-heading">Tất cả Dịch Vụ</h2> -->

        <div v-if="categoriesLoading" class="category-grid-loading">
          <div class="dm-spinner"></div>
        </div>

        <div v-else-if="categoriesError" class="category-grid-error">
          Không thể tải danh mục dịch vụ.
        </div>

        <div v-else class="category-grid" ref="categoryGridRef">
          <div
            v-for="(cat, i) in categoryList"
            :key="cat.maDM"
            class="category-grid-item"
            :class="{ 'is-active': selectedCategory === cat.maDM }"
            @click="goToCategory(cat.maDM)"
          >
            <!-- <span class="category-grid-tag">{{ String(i + 1).padStart(2, '0') }}</span> -->
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

    <!-- <section class="services-hero text-center" data-aos="fade-down" data-aos-once="true">
      <div class="container">
        <div class="hero-rule-row">
          <span class="hero-rule"></span>
          <span class="hero-dot"></span>
          <span class="hero-rule"></span>
        </div>
        <h3 class="fw-900 services-hero-heading">
          Các dịch vụ Mới của LGHair
        </h3>
      </div>
    </section> -->

    <!-- ======================= -->
    <!-- MENU DANH MỤC ĐƯỢC MỞ/ĐÓNG (giống Shop.vue) -->
    <!-- ======================= -->
    <section class="w-full mb-10">
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12">
        <div class="flex flex-col lg:flex-row gap-8">
          <div class="flex-1 min-w-0">
            <div class="flex flex-col gap-6">
              <!-- <div class="ticket-toolbar"> -->
                <!-- <div></div> -->
                <!-- Nút chuyển sang trang SẢN PHẨM -->
                <!-- <button
                  type="button"
                  class="ticket-link-btn"
                  @click="goToProductsPage"
                >
                  Xem Sản Phẩm
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 6l6 6-6 6"/>
                  </svg>
                </button> -->
              <!-- </div> -->

              <!-- <div class="ticket-count-row">
                <span class="dv-filter-font ticket-count">
                  {{ services.length }} Dịch vụ
                </span>
              </div> -->

              <section ref="servicesListRef" class="services-editorial-section">
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
                      <h2 class="font-playfair editorial-title">
                        {{ s.tenDv }}
                      </h2>

                      <p class="editorial-desc">{{ s.moTa }}</p>

                      <div class="editorial-price-row">
                        <template v-if="s.flashSale">
                          <span class="editorial-price-old">{{ formatPrice(s.gia) }}</span>
                          <span class="editorial-price-new">
                            Chỉ từ {{ formatPrice(getDiscountPrice(s.gia, s.flashSale.phanTramGiam)) }}
                          </span>
                        </template>
                        <template v-else>
                          <span class="editorial-price-main">{{ formatPrice(s.gia) }}</span>
                        </template>
                      </div>

                      <div class="editorial-actions">
                        <a href="#" class="combo-grid-link" @click.prevent="addToCart(s)">
                          Đặt lịch hẹn
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-center py-5 no-result-box">
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

              <div v-if="totalPages > 1" class="pagination-minimal">
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

    <!-- ======================= -->
    <!-- COMBO -->
    <!-- ======================= -->
    <section class="combo-editorial-section">
      <div class="text-center mb-5" data-aos="fade-up">
        <h3 class="editorial-title-heading">GÓI COMBO ĐẶC BIỆT</h3>
        <div class="heading-gold-line"></div>
      </div>

      <div class="combo-grid-list" ref="comboListRef">
        <div
          v-for="(c, idx) in combos"
          :key="c.maCb || idx"
          class="combo-grid-card"
          data-aos="fade-up"
        >
          <div
            class="combo-grid-image-wrap"
            @click="
              routerInstance.push({
                name: 'detailCombo',
                params: { id: c.maCb },
              })
            "
          >
            <div v-if="c.flashSale" class="sale-ribbon-wrapper">
              <div class="sale-ribbon">
                <span class="sale-ribbon-text">-{{ c.flashSale.phanTramGiam }}%</span>
              </div>
            </div>
            <img
              :src="getImageUrl(c.hinhAnh)"
              :alt="c.tenCombo"
              class="combo-grid-img"
            />
          </div>

          <div class="combo-grid-body">
            <h3
              class="combo-grid-title"
              @click="
                routerInstance.push({
                  name: 'detailCombo',
                  params: { id: c.maCb },
                })
              "
            >
              {{ c.tenCombo }}
            </h3>
            <p class="combo-grid-desc">{{ c.moTa }}</p>

            <div class="combo-grid-price-row">
              <template v-if="c.flashSale">
                <span class="combo-grid-price-old">{{ formatPrice(c.gia) }}</span>
                <span class="combo-grid-price-new">
                  Chỉ từ {{ formatPrice(getDiscountPrice(c.gia, c.flashSale.phanTramGiam)) }}
                </span>
              </template>
              <template v-else>
                <span class="combo-grid-price-main">{{ formatPrice(c.gia) }}</span>
              </template>
            </div>

            <a href="#" class="combo-grid-link" @click.prevent="addToCart(c)">
              Đặt lịch hẹn
            </a>
          </div>
        </div>
      </div>

      <!-- NÚT XEM THÊM COMBO -->
      <div v-if="comboPage < comboTotalPages" class="feed-block-more">
        <button
          type="button"
          class="feed-more-btn"
          :disabled="comboLoadingMore"
          @click="loadMoreCombos"
        >
          {{ comboLoadingMore ? "Đang tải..." : "Xem thêm" }}
        </button>
      </div>
    </section>

    <!-- ======================= -->
    <!-- BỘ LỌC — nút nổi cố định + panel trượt từ phải -->
    <!-- ======================= -->
    <Teleport to="body">
      <button
        type="button"
        class="combo-filter-fab"
        :class="{ 'has-active-filter': comboFilterActive }"
        @click="comboFilterOpen = true"
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
        <span v-if="comboFilterActive" class="combo-filter-fab-dot"></span>
      </button>
    </Teleport>

    <Teleport to="body">
      <transition name="combo-filter-fade">
        <div
          v-if="comboFilterOpen"
          class="combo-filter-overlay"
          @click.self="comboFilterOpen = false"
        >
          <transition name="combo-filter-slide">
            <aside v-if="comboFilterOpen" class="combo-filter-panel">
              <div class="combo-filter-panel-header">
                <h3 class="dv-filter-font">Tìm Kiếm &amp; Lọc Dịch Vụ</h3>
                <button
                  type="button"
                  class="combo-filter-close"
                  @click="comboFilterOpen = false"
                  aria-label="Đóng bộ lọc"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="6" y1="18" x2="18" y2="6" />
                  </svg>
                </button>
              </div>

              <div class="combo-filter-panel-body">
                <label class="dv-filter-font combo-filter-label">Tên dịch vụ</label>
                <div class="relative combo-filter-search-wrap">
                  <svg
                    class="combo-filter-search-icon"
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
                    class="dv-filter-font combo-filter-search-input"
                  />
                </div>

                <label class="dv-filter-font combo-filter-label">Danh mục</label>
                <select v-model="selectedCategory" class="dv-filter-font combo-filter-select">
                  <option value="all">Tất cả danh mục</option>
                  <option
                    v-for="cat in categoryList"
                    :key="cat.maDM"
                    :value="cat.maDM"
                  >
                    {{ cat.tenDanhMuc }}
                  </option>
                </select>

                <label class="dv-filter-font combo-filter-label">Mức giá</label>
                <select v-model="selectedPriceRange" class="dv-filter-font combo-filter-select">
                  <option value="all">Tất cả mức giá</option>
                  <option value="low">Dưới 300.000đ</option>
                  <option value="mid">300k – 700k</option>
                  <option value="high">Trên 700.000đ</option>
                </select>

                <button
                  v-if="comboFilterActive"
                  type="button"
                  class="dv-filter-font combo-filter-reset"
                  @click="
                    searchQuery = '';
                    selectedCategory = 'all';
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
@import url("https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@300;400;500;600&display=swap");

/* =========================================================
   DESIGN TOKENS — bảng màu lấy cảm hứng từ "vé cắt tóc"
   (ticket giấy, mực đen, đỏ tiệm cắt tóc, đồng thau)
   ========================================================= */
.services-page-container {
  --ink: #1c1815;
  --ink-soft: #55504a;
  --muted: #8d8577;
  --muted-light: #b9b2a3;
  --paper: #efece4;
  --paper-deep: #e3ddcd;
  --line: #c9c0ac;
  --red: #8c2f22;
  --red-soft: #a8493a;
  --bg: #ffffff;
  --danger: #8c2f22;

  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  background: var(--bg);
  overflow-x: clip;
  width: 100%;
  margin: 0 auto;
  color: var(--ink);
}

.font-playfair,
.font-poppins {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.fw-900 {
  font-weight: 600 !important;
}

.dv-filter-font {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

/* =========================================================
   EYEBROW / KICKER — hairline + chữ nhỏ, dùng lại cho các
   section heading để tạo nhịp lặp xuyên suốt trang
   ========================================================= */
.section-kicker {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-bottom: 14px;
}

.section-kicker-line {
  width: 34px;
  height: 1px;
  background: var(--line);
}

.section-kicker-text {
  font-size: 11px;
  letter-spacing: 0.35em;
  text-transform: uppercase;
  color: var(--red);
  font-weight: 500;
}

.hero-rule-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 18px;
}

.hero-rule {
  width: 60px;
  height: 1px;
  background: var(--line);
}

.hero-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--red);
}

/* =========================================================
   LƯỚI DANH MỤC DỊCH VỤ
   ========================================================= */
.category-grid-section {
  padding: 90px 24px 20px;
}

.category-grid-container {
  max-width: 1320px;
  margin: 0 auto;
  text-align: center;
}

.category-grid-heading {
  font-family: "Fraunces", Georgia, serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(2rem, 4vw, 2.9rem);
  letter-spacing: 0.01em;
  color: var(--ink);
  margin: 0 0 56px;
}

.category-grid-loading,
.category-grid-error {
  padding: 40px 0;
  display: flex;
  justify-content: center;
  color: var(--muted);
}

.category-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 28px;
}

.category-grid-item {
  position: relative;
  width: 175px;
  cursor: pointer;
  text-align: left;
}

.category-grid-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 2;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--paper);
  color: var(--ink);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(28, 24, 21, 0.25);
  transition: background 0.25s ease, color 0.25s ease;
}

.category-grid-item:hover .category-grid-tag,
.category-grid-item.is-active .category-grid-tag {
  background: var(--red);
  color: #fff;
}

.category-grid-image-wrap {
  width: 175px;
  height: 175px;
  background: var(--paper-deep);
  overflow: hidden;
  border: 1px solid var(--line);
}

.category-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  filter: grayscale(0.15);
  transition: transform 0.5s ease, filter 0.5s ease;
}

.category-grid-item:hover .category-grid-img {
  transform: scale(1.05);
  filter: grayscale(0);
}

.category-grid-name {
  margin: 14px 0 0;
  text-align: left;
  font-size: 0.8rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ink);
}

.is-active .category-grid-name {
  color: var(--red);
}

.font-heading {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

@media (max-width: 576px) {
  .category-grid {
    gap: 16px;
    justify-content: space-between;
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
    font-size: 1.7rem;
  }
}

/* =========================================================
   HERO
   ========================================================= */
.services-hero {
  padding: 70px 0 40px;
}

.services-hero-heading {
  font-family: "Fraunces", Georgia, serif;
  font-style: italic;
  font-weight: 500;
  font-size: clamp(1.5rem, 3vw, 2.1rem);
  max-width: 900px;
  line-height: 1.35;
  margin: 0 auto;
}

.section-subtitle {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.72rem;
  font-weight: 400;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--muted);
}

/* =========================================================
   TOOLBAR / COUNT
   ========================================================= */
.ticket-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--line);
}

.ticket-link-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.2s ease;
}

.ticket-link-btn:hover {
  color: var(--red);
}

.ticket-count-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--line);
}

.ticket-count {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}

/* =========================================================
   DANH SÁCH DỊCH VỤ — "VÉ CẮT TÓC" (signature element)
   ========================================================= */
.services-editorial-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 40px 0;
}

.editorial-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
  background: #fff;
  border: none;
  min-height: 320px;
}

.editorial-row.reverse {
  grid-template-columns: 1fr 1fr;
}

.editorial-row.reverse .editorial-image-wrap {
  order: 2;
}

.editorial-row.reverse .editorial-content {
  order: 1;
}

.editorial-image-wrap {
  position: relative;
  overflow: hidden;
  cursor: pointer;
  min-height: 260px;
}

.editorial-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.editorial-image-wrap:hover .editorial-img {
  transform: scale(1.04);
}

.hot-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 10;
  background: #d92d20;
  color: #fff;
  padding: 7px 14px;
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
  position: absolute;
  top: 16px;
  right: -30px;
  width: 120px;
  transform: rotate(45deg);
  background: #d92d20;
  color: #fff;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  padding: 5px 0;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* --- Nội dung dịch vụ: đơn giản, giống bản gốc --- */
.editorial-content {
  padding: 40px 44px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.editorial-title {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: 1.4rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink);
  margin: 0 0 10px;
  line-height: 1.3;
}

.editorial-desc {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 22px;
  max-width: 420px;
}

.editorial-price-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}

.editorial-price-main,
.editorial-price-new {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: 1rem;
  color: var(--ink);
}

.editorial-price-old {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--ink);
  text-decoration: line-through;
  text-decoration-color: var(--red);
}

.editorial-price-new {
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--ink);
}

.editorial-actions {
  display: flex;
}

.combo-grid-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--ink);
  text-decoration: none;
  padding-bottom: 3px;
  border-bottom: 1px solid var(--ink);
  transition: color 0.2s ease, border-color 0.2s ease, gap 0.2s ease;
  width: fit-content;
}

.combo-grid-link:hover {
  color: var(--ink);
  border-color: var(--ink);
  gap: 12px;
}

.link-arrow {
  font-size: 13px;
}

.no-result-box {
  padding: 60px 0;
}

@media (max-width: 900px) {
  .editorial-row,
  .editorial-row.reverse {
    grid-template-columns: 1fr;
  }
  .editorial-row.reverse .editorial-image-wrap,
  .editorial-row.reverse .editorial-content {
    order: initial;
  }
  .editorial-content {
    padding: 32px 28px;
  }
}

/* =========================================================
   PHÂN TRANG
   ========================================================= */
.pagination-minimal {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  margin: 48px 0 20px;
  padding-top: 32px;
  flex-wrap: wrap;
}

/* Thanh kẻ phía trên kéo dài hết chiều ngang khối cha (không chỉ bằng
   độ rộng của nhóm nút phân trang, vì justify-content: center làm
   .pagination-minimal co lại theo nội dung) */
.pagination-minimal::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--ink);
}

.pagination-nav {
  background: none !important;
  border: none;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--ink) !important;
  cursor: pointer;
  padding: 8px 4px;
  opacity: 1;
  transition: opacity 0.2s ease;
}

.pagination-nav:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.pagination-nav:hover:not(:disabled) {
  opacity: 0.6;
}

.pagination-numbers {
  display: flex;
  gap: 18px;
}

.pagination-page {
  width: auto;
  height: auto;
  min-width: 24px;
  border: none;
  border-bottom: 1px solid transparent;
  background: none !important;
  color: var(--ink) !important;
  font-size: 14px;
  font-weight: 400;
  padding: 4px 2px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-page:hover:not(:disabled):not(.active) {
  opacity: 0.6;
}

.pagination-page.active {
  background: none !important;
  color: var(--ink) !important;
  font-weight: 600;
  border-bottom: 2px solid var(--ink);
}

.pagination-page.ellipsis {
  border: none;
  background: none !important;
  color: var(--ink) !important;
  cursor: default;
}

/* =========================================================
   COMBO — nền sáng, đơn giản
   ========================================================= */
.combo-editorial-section {
  padding: 0 24px;
  margin-top: 100px;
  margin-bottom: 100px;
}

.editorial-title-heading {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 1.8rem;
  text-transform: uppercase;
  letter-spacing: 3px;
  font-weight: 400;
  color: var(--ink);
  line-height: 1.3;
  margin-bottom: 16px;
}

.heading-gold-line {
  width: 40px;
  height: 1px;
  background: var(--ink);
  border-radius: 0;
  margin: 0 auto;
}

/* Nút "Xem thêm" combo — tải thêm 9 combo/lượt, đồng bộ style với feed-more-btn bên Shop.vue */
.feed-block-more {
  display: flex;
  justify-content: center;
  margin-top: 2.5rem;
}

.feed-more-btn {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ink);
  background: none;
  border: 1px solid var(--ink);
  padding: 12px 32px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.feed-more-btn:hover:not(:disabled) {
  background: var(--ink);
  color: #fff;
}
.feed-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.combo-grid-list {
  max-width: 1320px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 32px;
}

.combo-grid-card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.combo-grid-image-wrap {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  cursor: pointer;
  background: var(--paper-deep);
}

.combo-grid-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s ease;
}

.combo-grid-card:hover .combo-grid-img {
  transform: scale(1.05);
}

.combo-grid-body {
  padding: 22px 0 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.combo-grid-title {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-size: 0.85rem;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--ink);
  cursor: pointer;
  margin: 0 0 10px;
  line-height: 1.5;
}

.combo-grid-title:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.combo-grid-desc {
  flex: 1 0 auto;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.6;
  margin-bottom: 18px;
}

.combo-grid-price-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.combo-grid-price-main,
.combo-grid-price-new {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  font-weight: 400;
  font-size: 1rem;
  color: var(--ink);
}

.combo-grid-price-new {
  font-weight: 600;
  font-size: 1.05rem;
  color: var(--ink);
}

.combo-grid-price-old {
  font-size: 0.85rem;
  font-weight: 400;
  color: var(--ink);
  text-decoration: line-through;
  text-decoration-color: var(--red);
}

@media (max-width: 900px) {
  .combo-grid-list {
    grid-template-columns: 1fr;
    gap: 48px;
  }
}

/* =========================================================
   LƯỚI DANH MỤC (loading spinner)
   ========================================================= */
.dm-spinner {
  width: 32px;
  height: 32px;
  border: 1.5px solid var(--line);
  border-top-color: var(--red);
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* =========================================================
   BỘ LỌC — nút nổi cố định + panel trượt từ phải
   ========================================================= */
.combo-filter-fab {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #000;
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
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

.combo-filter-fab:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.3);
}

.combo-filter-fab-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #e53935;
}

.combo-filter-fab.has-active-filter {
  background: #e53935;
}

.combo-filter-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100;
  display: flex;
  justify-content: flex-end;
}

.combo-filter-panel {
  width: 100%;
  max-width: 360px;
  height: 100%;
  background: #fff;
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.combo-filter-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.combo-filter-panel-header h3 {
  font-size: 1rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #111;
  margin: 0;
}

.combo-filter-close {
  background: none;
  border: none;
  cursor: pointer;
  color: #111;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.combo-filter-panel-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.combo-filter-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #999;
  margin: 12px 0 4px;
}

.combo-filter-label:first-child {
  margin-top: 0;
}

.combo-filter-search-wrap {
  position: relative;
}

.combo-filter-search-icon {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: #999;
}

.combo-filter-search-input {
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid #e5e5e5;
  padding: 8px 4px 8px 22px;
  outline: none;
  color: #111;
}

.combo-filter-search-input:focus {
  border-bottom-color: #111;
}

.combo-filter-select {
  width: 100%;
  font-size: 0.85rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid #e5e5e5;
  padding: 8px 4px;
  outline: none;
  cursor: pointer;
  color: #111;
}

.combo-filter-select:focus {
  border-bottom-color: #111;
}

.combo-filter-reset {
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
.combo-filter-fade-enter-active,
.combo-filter-fade-leave-active {
  transition: opacity 0.25s ease;
}
.combo-filter-fade-enter-from,
.combo-filter-fade-leave-to {
  opacity: 0;
}

.combo-filter-slide-enter-active,
.combo-filter-slide-leave-active {
  transition: transform 0.3s ease;
}
.combo-filter-slide-enter-from,
.combo-filter-slide-leave-to {
  transform: translateX(100%);
}

@media (max-width: 480px) {
  .combo-filter-panel {
    max-width: 100%;
  }
  .combo-filter-fab {
    bottom: 18px;
    padding: 10px 18px;
    font-size: 0.75rem;
  }
}
</style>