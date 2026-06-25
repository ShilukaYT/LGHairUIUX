<script>
import axios from "axios";
const API = import.meta.env.VITE_API_URL;
// import ReviewList from "./ReviewList.vue";
import { getCartDB, addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

export default {
  name: "ServiceDetail",
  components: {
    // ReviewList,
  },
  data() {
    return {
      activeImage: "",
      service: {},
      kieuTocs: [],
      relatedCombos: [],
      suggestedServices: [],
      countdown: "",
      timer: null,
      tieudeDichvus: [],
      cartItems: [],
      userMaKH: null,
    };
  },

  watch: {
    "$route.params.id": {
      immediate: true,
      handler(newId) {
        this.fetchService(newId);
      },
    },
  },

  async mounted() {
    await this.updateCartBadge();
  },

  beforeUnmount() {
    if (this.timer) clearInterval(this.timer);
  },

  methods: {
    async updateCartBadge() {
      const customer = getCustomerInfo();
      this.userMaKH = customer.maKH;
      const data = await getCartDB(this.userMaKH);
      this.cartItems = data || [];
    },

    openCart() {
      this.$router.push('/cart');
    },

    async fetchService(id) {
      try {
        this.service = {};
        this.activeImage = "";
        this.countdown = "";
        this.kieuTocs = [];
        this.tieudeDichvus = [];

        if (this.timer) clearInterval(this.timer);

        const res = await axios.get(`${API}/api/services/${id}`);
        const data = res.data;

        this.service = {
          maDv: data.maDv || data.id || data.maCb || id,
          tenDv: data.tenDv,
          gia: data.gia,
          giaGoc: data.originalPrice || data.giaGoc || data.gia,
          phanTramGiam: data.phanTramGiam,
          ngayKetThuc: data.ngayKetThuc,
          thoiGianLam: data.thoiGianLam,
          moTaChiTiet: data.moTa,
          images: data.images,
          activeImage: data.images?.[0],
        };

        this.kieuTocs = data.kieuTocs ?? [];
        this.tieudeDichvus = data.tieudeDichvus ?? [];
        this.relatedCombos = data.relatedCombos;
        this.suggestedServices = data.suggestedServices;

        if (this.service.images?.length > 0) {
          this.activeImage = this.service.images[0];
        }

        if (this.service.ngayKetThuc) {
          this.startCountdown();
        }
      } catch (err) {
        console.error(err);
      }
    },

    getImageUrl(path) {
      if (!path) return "";
      return `${API}/${path}`;
    },

    formatPrice(price) {
      return price?.toLocaleString("vi-VN") + "đ";
    },

    startCountdown() {
      this.timer = setInterval(() => {
        const end = new Date(this.service.ngayKetThuc);
        const now = new Date();
        const diff = end - now;

        if (diff <= 0) {
          this.countdown = "Đã kết thúc";
          clearInterval(this.timer);
          return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);

        this.countdown = `${d}d ${h}h ${m}m ${s}s`;
      }, 1000);
    },

    getCountdown(endTime) {
      if (!endTime) return "";
      const end = new Date(endTime);
      const now = new Date();
      const diff = end - now;
      if (diff <= 0) return "Hết hạn";
      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const m = Math.floor((diff / (1000 * 60)) % 60);
      const s = Math.floor((diff / 1000) % 60);
      return `${d}d ${h}h ${m}m ${s}s`;
    },
    // TRONG FILE ChiTietDichVu.vue

    async addToCart(comboArg) {
      // Xác định xem tham số truyền vào là combo (từ "Combo liên quan") hay là dịch vụ hiện tại
      const isComboArg = comboArg && (comboArg.id || comboArg.maCb) && comboArg.tenCombo;
      const targetService = isComboArg ? comboArg : this.service;

      const imgPath = isComboArg 
        ? (targetService.hinhAnh || targetService.images?.[0] || "") 
        : (this.activeImage ? this.activeImage : this.service.images && this.service.images.length > 0 ? this.service.images[0] : "");

      const item = {
        id: targetService.maDv || targetService.id || targetService.maCb,
        tenItem: targetService.tenDv || targetService.tenCombo,
        gia: targetService.gia,
        giaGoc: targetService.giaGoc || targetService.originalPrice || targetService.gia,
        hinhAnh: imgPath,
        type: isComboArg ? 'COMBO' : 'DICHVU',
        duration: targetService.thoiGianLam || 30,
      };

      await addToCartDB(item, this.userMaKH);
      await this.updateCartBadge();
      window.dispatchEvent(new Event("cart-updated"));
      alert(`Đã thêm "${item.tenItem}" vào giỏ hàng thành công!`);
    },

    async bookNow() {
      await this.addToCart();
      this.$router.push('/cart');
    },
  },
};
</script>

<template>
  <div class="service-detail-page">
    <div class="container py-5">
      <!-- ===================================================
           PHẦN 1: MAIN INFO (từ ChiTietDichVuOld)
      =================================================== -->
      <div class="svc-header mb-4" data-aos="fade-down">
        <nav aria-label="breadcrumb" class="mb-2">
          <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item">
              <router-link to="/services">Dịch vụ</router-link>
            </li>
            <li class="breadcrumb-item active">{{ service.tenDv }}</li>
          </ol>
        </nav>
        <h1 class="font-playfair service-title-lg">{{ service.tenDv }}</h1>
        <div class="title-underline mb-3"></div>

        <div class="price-container-luxury mb-3">
          <span class="new-price-lg">{{ formatPrice(service.gia) }}</span>

          <span v-if="service.giaGoc > service.gia" class="old-price-inline">
            {{ formatPrice(service.giaGoc) }}
          </span>

          <span v-if="service.phanTramGiam" class="discount-tag-premium">
            -{{ service.phanTramGiam }}%
          </span>
        </div>

        <div class="service-meta mb-3">
          <span class="duration-badge-detail">
            <i class="far fa-clock"></i> {{ service.thoiGianLam }} Phút
          </span>
        </div>
      </div>

      <!-- ===================================================
           GALLERY ẢNH (từ ChiTietDichVuOld — flex-wrap)
      =================================================== -->
      <div
        class="svc-gallery mb-5"
        v-if="service.images?.length > 0"
        data-aos="fade-up"
      >
        <div
          v-for="(img, idx) in service.images"
          :key="idx"
          class="svc-gallery-item"
        >
          <div class="svc-gallery-img-wrap">
            <img
              :src="getImageUrl(img)"
              :alt="`Ảnh ${idx + 1}`"
              class="svc-gallery-img"
            />
            <!-- <span v-if="service.phanTramGiam" class="svc-discount-badge">
              -{{ service.phanTramGiam }}%
            </span> -->
          </div>
        </div>
      </div>

      <!-- Mô tả dưới gallery (từ ChiTietDichVuOld) -->
      <p v-if="service.moTaChiTiet" class="svc-mota-below">
        {{ service.moTaChiTiet }}
      </p>

      <hr class="gold-line mb-5" />

      <!-- ===================================================
           PHẦN 2: TIÊU ĐỀ DỊCH VỤ (từ ChiTietDichVuOld)
      =================================================== -->
      <section
        class="service-tieude-section mb-5"
        v-if="tieudeDichvus.length > 0"
      >
        <div v-for="td in tieudeDichvus" :key="td.maTd" class="mb-5">
          <div class="tieude-header-info text-center mb-4">
            <h3 class="font-playfair service-tieude-title">
              {{ td.tenTieuDe }}
            </h3>
            <p class="service-tieude-desc" v-if="td.moTaTieuDe">
              {{ td.moTaTieuDe }}
            </p>
            <!-- <div class="heading-gold-line mx-auto"></div> -->
          </div>
          <div class="kieu-grid" v-if="td.chiTiet?.length">
            <div
              v-for="ct in td.chiTiet"
              :key="ct.maCttd"
              class="kieu-grid-item gap-5"
            >
              <div class="kieu-img-wrap">
                <img
                  :src="getImageUrl(ct.hinhAnh)"
                  :alt="ct.tenTieuDe"
                  class="kieu-img"
                />
              </div>
              <span class="kieu-label">{{ ct.tenTieuDe }}</span>
              <small class="text-muted">{{ ct.moTaTieuDe }}</small>
            </div>
          </div>
          <hr class="gold-line mb-5" />
        </div>
      </section>

      <!-- <hr class="gold-line my-5" v-if="tieudeDichvus.length > 0" /> -->

      <!-- ===================================================
           PHẦN 2B: KIỂU TÓC GRID (từ ChiTietDichVuOld)
      =================================================== -->

      <!-- Nút thêm vào giỏ dịch vụ chính (thay thế Đặt lịch ngay từ ChiTietDichVuOld) -->
      <div
        class="d-flex gap-3 mt-5 action-buttons-container justify-content-center mx-auto"
      >
        <button class="btn-add-cart" @click="addToCart">
          <i class="fas fa-calendar-check me-2"></i>Đặt lịch
        </button>
        <button class="btn-book-now" @click="bookNow">
          <i class="fas fa-calendar-check me-2"></i>ĐẶT LỊCH NGAY
        </button>
      </div>

      <!-- ===================================================
           PHẦN 3: COMBO LIÊN QUAN (giữ nguyên từ ChiTietDichVu)
      =================================================== -->
      <section class="related-combos mb-5" v-if="relatedCombos.length > 0">
        <hr class="gold-line mt-5" />
        <h3 class="font-playfair text-center mb-5" style="margin-top: 50px">
          COMBO LIÊN QUAN
        </h3>
        <div class="row g-4 justify-content-center">
          <div
            v-for="c in relatedCombos"
            :key="c.id"
            class="col-12 col-sm-6 col-md-4"
          >
            <router-link
              :to="{ name: 'detailCombo', params: { id: c.id } }"
              style="
                text-decoration: none;
                color: inherit;
                display: block;
                height: 100%;
              "
            >
              <div class="luxury-combo-card d-flex flex-column m-3">
                <!-- Ảnh combo -->
                <div class="combo-img-wrap" v-if="c.hinhAnh">
                  <img
                    :src="getImageUrl(c.hinhAnh)"
                    :alt="c.tenCombo"
                    class="combo-img"
                  />
                  <div v-if="c.phanTramGiam" class="combo-discount-ribbon">
                    <span>-{{ c.phanTramGiam }}%</span>
                  </div>
                </div>
                <div class="combo-body p-4 d-flex flex-column flex-grow-1">
                  <div class="combo-info flex-grow-1">
                    <h4 class="combo-name">{{ c.tenCombo }}</h4>
                    <p class="combo-save-text">{{ c.moTa }}</p>
                    <ul class="combo-items-list">
                      <li v-for="item in c.items" :key="item">
                        <i class="fas fa-check-circle"></i>
                        <span>{{ item }}</span>
                        <!-- ← thêm span -->
                      </li>
                    </ul>
                  </div>
                  <div class="combo-footer mt-auto pt-3">
                    <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                      <span class="combo-price mb-0">{{
                        formatPrice(c.gia)
                      }}</span>
                      <span v-if="c.giaGoc" class="combo-price-old">{{
                        formatPrice(c.giaGoc)
                      }}</span>
                      <span
                        v-if="c.phanTramGiam"
                        class="combo-discount-badge-gold"
                        >-{{ c.phanTramGiam }}%</span
                      >
                    </div>
                    <button
                      @click="addToCart(c)"
                      class="btn-outline-gold-fixed w-100"
                    >
                      Đặt ngay
                    </button>
                  </div>
                </div>
              </div>
            </router-link>
          </div>
        </div>
      </section>

      <hr class="gold-line my-5" />

      <!-- ===================================================
           PHẦN 4: DỊCH VỤ GỢI Ý (từ ChiTietDichVuOld)
      =================================================== -->
      <section class="suggested-services">
        <div class="section-heading-wrapper text-center mb-5">
          <p class="section-eyebrow">Có thể bạn thích</p>
          <h3 class="font-playfair section-heading-main">DỊCH VỤ GỢI Ý</h3>
          <div class="heading-gold-line"></div>
        </div>
        <div class="row g-4">
          <div
            v-for="s in suggestedServices"
            :key="s.id"
            class="col-md-6 col-lg-4"
          >
            <div class="service-card-item d-flex flex-column m-3">
              <div class="card-image">
                <img
                  :src="getImageUrl(s.hinhAnh)"
                  :alt="s.tenDv"
                  class="img-main-card"
                />
                <div v-if="s.phanTramGiam" class="discount-ribbon">
                  <span>-{{ s.phanTramGiam }}%</span>
                </div>
                <div class="duration-tag-overlay">{{ s.thoiGianLam }} Phút</div>
              </div>
              <div
                class="card-body p-4 text-center d-flex flex-column flex-grow-1"
              >
                <h4 class="service-name-sm">{{ s.tenDv }}</h4>
                <p class="service-desc-sm text-muted flex-grow-1">
                  {{ s.moTa }}
                </p>
                <div class="mt-auto">
                  <div class="price-box-sm mb-3">
                    <span v-if="s.phanTramGiam" class="old-price-sm">{{
                      formatPrice(s.giaGoc)
                    }}</span>
                    <span class="new-price-sm">{{ formatPrice(s.gia) }}</span>
                  </div>
                  <router-link
                    :to="{ name: 'serviceDetail', params: { id: s.id } }"
                    class="btn-view-more-gold"
                    >CHI TIẾT</router-link
                  >
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================
           ĐÁNH GIÁ TỪ KHÁCH HÀNG (giữ nguyên từ ChiTietDichVu)
      =================================================== -->
      <!-- <ReviewList v-if="$route.params.id" :serviceId="$route.params.id" /> -->
    </div>


  </div>
</template>

<style scoped>
/* =========================================================
   FONT — Cormorant Garamond (heading) + Jost (body)
   ========================================================= */
@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Jost:wght@200;300;400;500;600&display=swap");
/* Fix Bootstrap row bên trong scoped component */
.combo-items-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  overflow: hidden;
}

.combo-items-list li span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap; /* ← text bị cắt với dấu ... thay vì xuống dòng */
  font-size: 0.78rem;
  font-weight: 300;
  color: var(--ink-soft);
}
.related-combos .row {
  display: flex !important;
  flex-wrap: wrap !important;
  row-gap: 24px !important;
}
/* Gap cho combo liên quan */
:deep(.related-combos .row.g-4),
.related-combos .row {
  --bs-gutter-x: 1.5rem;
  --bs-gutter-y: 1.5rem;
  gap: 0; /* để Bootstrap g-4 tự xử */
}

/* Gap cho dịch vụ gợi ý */
:deep(.suggested-services .row.g-4),
.suggested-services .row {
  --bs-gutter-x: 1.5rem;
  --bs-gutter-y: 1.5rem;
}
.combo-footer {
  margin-top: auto;
  padding-top: 10px !important; /* ← giảm pt-3 */
  border-top: 1px solid var(--line);
}

.related-combos .row > [class*="col-"] {
  flex: 0 0 auto;
}

/* Đảm bảo 3 cột đúng trên desktop */
.related-combos .row > .col-md-4 {
  width: 33.3333% !important;
  max-width: 33.3333% !important;
}

@media (max-width: 767px) {
  .related-combos .row > .col-sm-6 {
    width: 50% !important;
    max-width: 50% !important;
  }
}

@media (max-width: 575px) {
  .related-combos .row > .col-12 {
    width: 100% !important;
    max-width: 100% !important;
  }
}
.suggested-services .row {
  display: flex !important;
  flex-wrap: wrap !important;
  row-gap: 24px !important;
}

.suggested-services .row > .col-lg-4 {
  width: 33.3333% !important;
  max-width: 33.3333% !important;
}

@media (max-width: 991px) {
  .suggested-services .row > .col-md-6 {
    width: 50% !important;
    max-width: 50% !important;
  }
}

@media (max-width: 575px) {
  .suggested-services .row > [class*="col-"] {
    width: 100% !important;
    max-width: 100% !important;
  }
}
/* =========================================================
   DESIGN TOKENS
   ========================================================= */
.service-detail-page {
  --ink: #1a1a1a;
  --ink-soft: #4a4a4a;
  --muted: #999999;
  --muted-light: #bdbdbd;
  --line: #e7e5e2;
  --bg: #ffffff;
  --bg-soft: #fafafa;

  font-family: "Jost", sans-serif;
  background: var(--bg);
  color: var(--ink);
}

/* =========================================================
   FONT HELPERS
   ========================================================= */
.font-playfair {
  font-family: "Cormorant Garamond", serif;
}

/* =========================================================
   SECTION HEADING CHUNG
   ========================================================= */
.section-heading-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.section-eyebrow {
  font-family: "Jost", sans-serif;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 4px;
  color: var(--muted);
  font-weight: 400;
  margin-bottom: 8px;
}

.section-heading-main {
  font-family: "Cormorant Garamond", serif;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--ink);
  margin-bottom: 16px;
}

.heading-gold-line {
  width: 40px;
  height: 1px;
  background: var(--ink);
  border-radius: 0;
  margin: 0 auto;
}

/* =========================================================
   SVC HEADER (breadcrumb + title + price)
   ========================================================= */
.svc-header {
  max-width: 900px;
}

/* Breadcrumb */
.breadcrumb-item a {
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.2s ease;
}

.breadcrumb-item a:hover {
  color: var(--ink);
}

.breadcrumb-item.active {
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--ink);
  font-weight: 400;
}

.breadcrumb-divider {
  color: var(--muted-light);
}

/* Title */
.service-title-lg {
  font-family: "Cormorant Garamond", serif;
  font-size: 2.6rem;
  font-weight: 600;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: var(--ink);
  line-height: 1.2;
  margin-bottom: 8px;
}

.title-underline {
  width: 40px;
  height: 1px;
  background: var(--ink);
  border-radius: 0;
  margin-top: 10px;
  margin-bottom: 0;
}

/* =========================================================
   PRICE & FLASH SALE
   ========================================================= */
.price-container-luxury {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
}

.new-price-lg {
  font-family: "Jost", sans-serif;
  font-size: 1.7rem;
  font-weight: 500;
  color: var(--ink);
  letter-spacing: 0.5px;
}

.old-price-inline {
  font-family: "Jost", sans-serif;
  font-size: 1rem;
  color: var(--muted-light);
  text-decoration: line-through !important;
  font-weight: 300;
  display: inline-block;
  margin-left: 4px;
}

.discount-tag-premium {
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 4px 12px;
  border-radius: 0;
}

/* =========================================================
   DURATION BADGE
   ========================================================= */
.duration-badge-detail {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  border: 1px solid var(--line);
  color: var(--muted);
  border-radius: 0;
  font-family: "Jost", sans-serif;
  font-weight: 400;
  font-size: 0.72rem;
  letter-spacing: 2px;
  text-transform: uppercase;
}
/* Fix container căn giữa */
:deep(.container) {
  margin-left: auto !important;
  margin-right: auto !important;
}

/* =========================================================
   GALLERY ẢNH DỊCH VỤ
   ========================================================= */
.svc-gallery {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
}

.svc-gallery-item {
  width: 200px;
  border-radius: 0;
  overflow: hidden;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  box-shadow: none;
  flex-shrink: 0;
  transition:
    border-color 0.25s ease,
    transform 0.25s ease;
}

.svc-gallery-item:hover {
  transform: translateY(-4px);
  border-color: var(--ink);
  box-shadow: none;
}

.svc-gallery-img-wrap {
  position: relative;
  width: 100%;
  height: 210px;
  overflow: hidden;
}

.svc-gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.svc-gallery-item:hover .svc-gallery-img {
  transform: scale(1.05);
}

.svc-discount-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 3px 10px;
  border-radius: 0;
  z-index: 2;
}

/* Description below gallery */
.svc-mota-below {
  font-family: "Jost", sans-serif;
  text-align: center;
  font-size: 0.88rem;
  font-weight: 300;
  color: var(--muted);
  margin-top: 14px;
  margin-bottom: 28px;
  letter-spacing: 0.3px;
  line-height: 1.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* =========================================================
   GOLD DIVIDER → hairline
   ========================================================= */
.gold-line {
  border: 0;
  height: 1px;
  background: var(--line);
  opacity: 1;
}

/* =========================================================
   TIÊU ĐỀ DỊCH VỤ + KIỂU TÓC GRID
   ========================================================= */
.tieude-header-info {
  max-width: 650px;
  margin: 0 auto;
}

.service-tieude-title {
  font-family: "Cormorant Garamond", serif;
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 3px;
  text-transform: uppercase;
  color: var(--ink);
  line-height: 1.3;
  margin-bottom: 10px;
  text-align: center;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.service-tieude-desc {
  font-family: "Jost", sans-serif;
  font-size: 0.88rem;
  font-weight: 300;
  color: var(--muted);
  margin-bottom: 14px;
  line-height: 1.6;
  letter-spacing: 0.3px;
}

.kieu-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.kieu-grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 170px;
  flex-shrink: 0;
}

.kieu-img-wrap {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: none;
  transition:
    transform 0.3s ease,
    border-color 0.3s ease;
}

.kieu-grid-item:hover .kieu-img-wrap {
  transform: translateY(-4px);
  border-color: var(--ink);
  box-shadow: none;
}

.kieu-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.kieu-grid-item:hover .kieu-img {
  transform: scale(1.04);
}

.kieu-label {
  margin-top: 10px;
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--ink);
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;
}

/* =========================================================
   NÚT ĐẶT LỊCH
   ========================================================= */
.action-buttons-container {
  width: 100%;
  display: flex;
  justify-content: center; /* ← đã có rồi, giữ nguyên */
  align-items: center;
  gap: 16px;
  margin-top: 2rem;
}

.btn-add-cart,
.btn-book-now {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  min-width: 180px;
  padding: 0 28px;
  border-radius: 0;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 2.5px;
  transition: all 0.3s ease;
  border: 1px solid transparent;
  cursor: pointer;
}

/* Nút Đặt lịch (thứ cấp) */
.btn-add-cart {
  background-color: var(--bg);
  color: var(--ink);
  border-color: var(--line);
}

.btn-add-cart:hover {
  background-color: var(--bg-soft);
  border-color: var(--ink);
  transform: translateY(-2px);
}

/* Nút Đặt lịch ngay (chính) */
.btn-book-now {
  background-color: var(--ink);
  color: #fff;
  border-color: var(--ink);
  box-shadow: none;
}

.btn-book-now:hover {
  background-color: var(--ink-soft);
  border-color: var(--ink-soft);
  box-shadow: none;
  transform: translateY(-2px);
}

/* Legacy (kept for compatibility) */
.btn-booking-premium {
  display: inline-block;
  background: var(--ink);
  color: #fff;
  padding: 14px 46px;
  border-radius: 0;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 11px;
  text-decoration: none;
  box-shadow: none;
  transition: all 0.3s ease;
}

.btn-booking-premium:hover {
  transform: translateY(-3px);
  background: var(--ink-soft);
  color: #fff;
}

/* =========================================================
   COMBO LIÊN QUAN
   ========================================================= */
.luxury-combo-card {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 0;
  transition: all 0.3s ease;
  overflow: visible; /* ← đổi từ hidden sang visible */
}

.luxury-combo-card:hover {
  border-color: var(--ink);
  box-shadow: none;
  transform: translateY(-5px);
}

.combo-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3; /* ← thay height: 300px */
  overflow: hidden;
  background: var(--bg-soft);
}

.combo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.5s ease;
}

.luxury-combo-card:hover .combo-img {
  transform: scale(1.05);
}

/* Sale ribbon → flat black */
.combo-discount-ribbon {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 80px;
  overflow: hidden;
  z-index: 2;
}

.combo-discount-ribbon span {
  position: absolute;
  display: block;
  width: 112px;
  padding: 6px 0;
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  font-size: 0.6rem;
  letter-spacing: 1.5px;
  text-align: center;
  text-transform: uppercase;
  top: 19px;
  right: -26px;
  transform: rotate(45deg);
  box-shadow: none;
}

.combo-body {
  min-height: 0;
  padding: 16px !important; /* ← giảm padding, override Bootstrap p-4 */
}

.combo-name {
  font-family: "Jost", sans-serif;
  font-weight: 600;
  font-size: 0.82rem; /* ← nhỏ lại chút */
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--ink);
  margin-bottom: 6px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-save-text {
  font-family: "Jost", sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  color: var(--muted);
  margin-bottom: 8px; /* ← giảm từ 14px */
  letter-spacing: 0.3px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1; /* ← giới hạn 1 dòng */
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.combo-items-list li {
  margin-bottom: 4px; /* ← giảm từ 8px */
  font-family: "Jost", sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  letter-spacing: 0.3px;
}
.combo-info {
  flex-grow: 1;
  overflow: hidden;
}

/* Giới hạn tối đa 2 items hiển thị */
.combo-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 52px; /* ← ~2 dòng */
  overflow: hidden;
}

.combo-items-list i {
  color: var(--ink);
  margin-right: 10px;
  font-size: 0.75rem;
}

.combo-price {
  font-family: "Jost", sans-serif;
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--ink);
  letter-spacing: 0.5px;
}

.combo-price-old {
  font-family: "Jost", sans-serif;
  font-size: 0.82rem;
  font-weight: 300;
  color: var(--muted-light);
  text-decoration: line-through;
}

.combo-discount-badge-gold {
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 1px;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 0;
  white-space: nowrap;
}

.btn-outline-gold-fixed {
  background: transparent;
  border: 1px solid var(--ink);
  color: var(--ink);
  padding: 8px 8px; /* ← giảm padding ngang */
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px; /* ← giảm letter-spacing từ 2px */
  border-radius: 0;
  transition: all 0.25s ease;
  white-space: normal; /* ← đổi từ nowrap sang normal */
  word-break: break-word; /* ← thêm dòng này */
  cursor: pointer;
  width: 100%;
  text-align: center;
  line-height: 1.3; /* ← thêm dòng này cho dễ đọc khi xuống dòng */
}

.btn-outline-gold-fixed:hover {
  background: var(--ink);
  color: #fff;
}

/* =========================================================
   DỊCH VỤ GỢI Ý
   ========================================================= */
.service-card-item {
  background: var(--bg);
  border-radius: 0;
  overflow: hidden; /* ← giữ nguyên hidden */
  transition: all 0.3s ease;
  border: 1px solid var(--line);
  box-shadow: none;
}

.service-card-item:hover {
  transform: translateY(-6px);
  border-color: var(--ink);
  box-shadow: none;
}

.card-image {
  position: relative;
  aspect-ratio: 3 / 2;
  overflow: hidden; /* ← chỉ ảnh mới hidden */
  background: var(--bg-soft);
  flex-shrink: 0;
}

.img-main-card {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s ease;
}

.service-card-item:hover .img-main-card {
  transform: scale(1.05);
}

/* Discount ribbon */
.discount-ribbon {
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 80px;
  overflow: hidden;
  z-index: 2;
}

.discount-ribbon span {
  position: absolute;
  display: block;
  width: 112px;
  padding: 6px 0;
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  font-size: 0.6rem;
  letter-spacing: 1.5px;
  text-align: center;
  text-transform: uppercase;
  top: 19px;
  right: -26px;
  transform: rotate(45deg);
  box-shadow: none;
}

.duration-tag-overlay {
  position: absolute;
  bottom: 10px;
  left: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 4px 12px;
  border-radius: 0;
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--ink);
  border: 1px solid var(--ink);
}

.service-name-sm {
  font-family: "Jost", sans-serif;
  font-weight: 600;
  font-size: 0.88rem;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--ink);
  margin-bottom: 10px;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.service-desc-sm {
  font-family: "Jost", sans-serif;
  font-size: 0.82rem;
  font-weight: 300;
  color: var(--muted);
  line-height: 1.55;
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.6rem;
  letter-spacing: 0.2px;
}

.price-box-sm {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 10px;
}

.old-price-sm {
  font-family: "Jost", sans-serif;
  font-size: 0.82rem;
  font-weight: 300;
  color: var(--muted-light);
  text-decoration: line-through;
}

.new-price-sm {
  font-family: "Jost", sans-serif;
  font-size: 1rem;
  font-weight: 500;
  color: var(--ink);
  letter-spacing: 0.5px;
}

.btn-view-more-gold {
  display: inline-block;
  width: 100%;
  border: 1px solid var(--ink);
  color: var(--ink);
  padding: 10px;
  border-radius: 0;
  text-decoration: none;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  font-size: 0.72rem;
  letter-spacing: 2px;
  text-transform: uppercase;
  transition: all 0.3s ease;
  text-align: center;
}

.btn-view-more-gold:hover {
  background: var(--ink);
  color: #fff;
}



/* =========================================================
   RESPONSIVE
   ========================================================= */
/* =========================================================
   RESPONSIVE
   ========================================================= */
@media (max-width: 900px) and (min-width: 576px) {
  .btn-outline-gold-fixed {
    font-size: 0.65rem;
    letter-spacing: 0.5px;
    padding: 7px 4px;
  }
  .combo-name {
    font-size: 0.75rem;
    letter-spacing: 1px;
  }
  .combo-price {
    font-size: 0.95rem;
  }
}

@media (max-width: 768px) {
  .service-detail-page .container {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }
  .service-title-lg {
    font-size: 1.9rem;
    letter-spacing: 2px;
  }
  .svc-gallery-item {
    width: calc(50% - 6px);
  }
  .svc-gallery-img-wrap {
    height: 160px;
  }
  .new-price-lg {
    font-size: 1.35rem;
  }
  .service-tieude-title {
    font-size: 1.5rem;
    letter-spacing: 2px;
  }
  .kieu-grid {
    gap: 10px;
  }
  .kieu-grid-item {
    width: calc(50% - 5px);
  }
  .kieu-label {
    font-size: 0.68rem;
    letter-spacing: 1px;
  }
  .related-combos .row > .col-sm-6,
  .suggested-services .row > [class*="col-"] {
    width: 50% !important;
    max-width: 50% !important;
    padding-left: 8px !important;
    padding-right: 8px !important;
  }
}

@media (max-width: 480px) {
  .service-detail-page .container {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
  .related-combos .row > [class*="col-"],
  .suggested-services .row > [class*="col-"] {
    width: 50% !important;
    max-width: 50% !important;
    padding-left: 6px !important;
    padding-right: 6px !important;
  }
  .action-buttons-container {
    gap: 10px !important;
  }
  .btn-add-cart,
  .btn-book-now {
    min-width: unset;
    flex: 1;
    font-size: 10px;
    padding: 0 10px;
  }
  .combo-name,
  .service-name-sm {
    font-size: 0.7rem !important;
    letter-spacing: 0.5px !important;
  }

  .combo-price,
  .new-price-sm {
    font-size: 0.9rem !important;
  }

  .combo-body {
    padding: 10px !important;
  }
}
@media (max-width: 768px) {
  .service-detail-page .container {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }
  .service-title-lg {
    font-size: 1.9rem;
    letter-spacing: 2px;
  }
  .svc-gallery-item {
    width: calc(50% - 6px);
  }
  .svc-gallery-img-wrap {
    height: 160px;
  }
  .new-price-lg {
    font-size: 1.35rem;
  }
  .service-tieude-title {
    font-size: 1.5rem;
    letter-spacing: 2px;
  }
  .kieu-grid {
    gap: 10px;
  }
  .kieu-grid-item {
    width: calc(50% - 5px);
  }
  .kieu-label {
    font-size: 0.68rem;
    letter-spacing: 1px;
  }

  /* Đổi sang 1 cột để card đủ rộng, không bị bể chữ */
  .related-combos .row > [class*="col-"],
  .suggested-services .row > [class*="col-"] {
    width: 100% !important;
    max-width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
}

@media (max-width: 480px) {
  .service-detail-page .container {
    padding-left: 12px !important;
    padding-right: 12px !important;
  }
  .related-combos .row > [class*="col-"],
  .suggested-services .row > [class*="col-"] {
    width: 100% !important;
    max-width: 100% !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
  }
  .action-buttons-container {
    gap: 10px !important;
  }
  .btn-add-cart,
  .btn-book-now {
    min-width: unset;
    flex: 1;
    font-size: 10px;
    padding: 0 10px;
  }
}
</style>
