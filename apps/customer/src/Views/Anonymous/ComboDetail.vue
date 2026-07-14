<script>
import axios from "axios";
const API = import.meta.env.VITE_API_URL;
// import ReviewList from "./ReviewList.vue";
import { getCartDB, addToCartDB } from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

export default {
  name: "ComboDetail",
  components: {
    // ReviewList,
  },
  data() {
    return {
      combo: {},
      dichVuTrongCombo: [],
      relatedCombos: [],
      suggestedServices: [],
      countdown: "",
      timer: null,
      cartItems: [],
      userMaKH: null,
    };
  },

  watch: {
    "$route.params.id": {
      immediate: true,
      handler(newId) {
        this.fetchCombo(newId);
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

    async fetchCombo(id) {
      try {
        this.combo = {};
        this.dichVuTrongCombo = [];
        this.relatedCombos = [];
        this.suggestedServices = [];
        this.countdown = "";

        if (this.timer) clearInterval(this.timer);

        const res = await axios.get(`${API}/api/combos/${id}`);
        const data = res.data;

        this.combo = {
          maCb: data.maCb,
          tenCombo: data.tenCombo,
          moTa: data.moTa,
          hinhAnh: data.hinhAnh,
          gia: data.gia,
          giaGoc: data.originalPrice || data.giaGoc || data.gia,
          phanTramGiam: data.phanTramGiam,
          ngayKetThuc: data.ngayKetThuc,
          tongThoiGian: data.tongThoiGian,
          soLuongDichVu: data.soLuongDichVu,
          diemTrungBinh: data.diemTrungBinh,
          soLuongDanhGia: data.soLuongDanhGia,
        };

        this.dichVuTrongCombo = data.dichVuTrongCombo ?? [];
        this.relatedCombos = data.relatedCombos ?? [];
        this.suggestedServices = data.suggestedServices ?? [];

        if (this.combo.ngayKetThuc) {
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
        const end = new Date(this.combo.ngayKetThuc);
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

    renderStars(score) {
      if (!score) return "";
      const full = Math.floor(score);
      const half = score % 1 >= 0.5;
      let stars = "★".repeat(full);
      if (half) stars += "½";
      return stars;
    },
    // SỬA TRONG METHODS CỦA Chitietcombo.vue
    // TRONG FILE Chitietcombo.vue
    async addToCart(comboArg) {
      const isComboArg = comboArg && (comboArg.id || comboArg.maCb) && comboArg.tenCombo;
      const targetCombo = isComboArg ? comboArg : this.combo;

      let totalDuration = 60;
      if (!isComboArg) {
        if (this.dichVuTrongCombo && this.dichVuTrongCombo.length > 0) {
          totalDuration = this.dichVuTrongCombo.reduce(
            (sum, dv) => sum + (dv.thoiGianLam || 30),
            0,
          );
        } else {
          totalDuration = this.combo.tongThoiGian || 60; 
        }
      }

      const item = {
        id: targetCombo.maCb || targetCombo.id,
        tenItem: targetCombo.tenCombo,
        gia: targetCombo.gia,
        giaGoc: targetCombo.giaGoc || targetCombo.originalPrice || targetCombo.gia,
        hinhAnh: targetCombo.hinhAnh || "/assets/images/combo-default.jpg",
        duration: isComboArg ? (targetCombo.thoiGianLam || 60) : totalDuration,
        type: 'COMBO'
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
           PHẦN 1: COMBO HEADER
      =================================================== -->
      <div class="svc-header mb-4" data-aos="fade-down">
        <nav aria-label="breadcrumb" class="mb-2">
          <ol class="breadcrumb mb-0">
            <li class="breadcrumb-item">
              <router-link to="/combos">Combo</router-link>
            </li>
            <li class="breadcrumb-item active">{{ combo.tenCombo }}</li>
          </ol>
        </nav>

        <h1 class="font-playfair service-title-lg">{{ combo.tenCombo }}</h1>
        <div class="title-underline mb-3"></div>

        <!-- Flash sale countdown -->
        <!-- <div v-if="combo.ngayKetThuc && countdown" class="flash-sale-banner mb-3">
          <i class="fas fa-bolt me-2"></i>
          <span class="flash-label">FLASH SALE</span>
          <span class="flash-countdown ms-2">{{ countdown }}</span>
        </div> -->

        <!-- Giá -->
        <div class="price-container-luxury mb-3">
          <span class="new-price-lg">{{ formatPrice(combo.gia) }}</span>

          <span
            v-if="combo.giaGoc && combo.giaGoc > combo.gia"
            class="old-price-inline"
          >
            {{ formatPrice(combo.giaGoc) }}
          </span>

          <span v-if="combo.phanTramGiam" class="discount-tag-premium">
            -{{ combo.phanTramGiam }}%
          </span>
        </div>

        <!-- Meta: thời gian + số dịch vụ + đánh giá -->
        <div
          class="service-meta mb-3 d-flex flex-wrap gap-2 align-items-center"
        >
          <span class="duration-badge-detail">
            <i class="far fa-clock"></i> {{ combo.tongThoiGian }} Phút
          </span>
          <span class="duration-badge-detail">
            <i class="fas fa-layer-group"></i> {{ combo.soLuongDichVu }} dịch vụ
          </span>
          <span v-if="combo.diemTrungBinh" class="rating-badge">
            <i class="fas fa-star"></i>
            {{ combo.diemTrungBinh }}
            <span class="text-muted ms-1"
              >({{ combo.soLuongDanhGia }} đánh giá)</span
            >
          </span>
        </div>

        <!-- Mô tả -->
        <p v-if="combo.moTa" class="combo-mota-header">{{ combo.moTa }}</p>
      </div>

      <!-- ===================================================
           PHẦN 2: ẢNH COMBO (banner lớn)
      =================================================== -->
      <div
        class="combo-banner-wrap mb-5"
        v-if="combo.hinhAnh"
        data-aos="fade-up"
      >
        <div class="combo-banner-img-wrap">
          <img
            :src="getImageUrl(combo.hinhAnh)"
            :alt="combo.tenCombo"
            class="combo-banner-img"
          />
          <!-- <div v-if="combo.phanTramGiam" class="combo-banner-badge">
            TIẾT KIỆM {{ combo.phanTramGiam }}%
          </div> -->
        </div>
      </div>

      <hr class="gold-line mb-5" />

      <!-- ===================================================
           PHẦN 3: DỊCH VỤ TRONG COMBO
      =================================================== -->
      <section
        class="service-tieude-section mb-5"
        v-if="dichVuTrongCombo.length > 0"
        data-aos="fade-up"
      >
        <div class="tieude-header-info text-center mb-4">
          <p class="section-eyebrow">Bao gồm</p>
          <h3 class="font-playfair service-tieude-title">
            DỊCH VỤ TRONG COMBO
          </h3>
          <!-- <div class="heading-gold-line mx-auto"></div> -->
        </div>

        <div class="dichvu-combo-grid">
          <router-link
            v-for="dv in dichVuTrongCombo"
            :key="dv.maDv"
            :to="{ name: 'serviceDetail', params: { id: dv.maDv } }"
            class="dichvu-combo-item"
            style="text-decoration: none; color: inherit"
          >
            <div class="kieu-img-wrap" v-if="dv.hinhAnh">
              <img
                :src="getImageUrl(dv.hinhAnh)"
                :alt="dv.tenDv"
                class="kieu-img"
              />
            </div>

            <div class="dichvu-combo-placeholder" v-else>
              <i class="fas fa-scissors"></i>
            </div>

            <span class="kieu-label">{{ dv.tenDv }}</span>

            <div class="dichvu-combo-meta">
              <span v-if="dv.thoiGianLam" class="dichvu-time">
                <i class="far fa-clock"></i> {{ dv.thoiGianLam }} phút
              </span>

              <span v-if="dv.gia" class="dichvu-price-tag">
                {{ formatPrice(dv.gia) }}
              </span>
            </div>

            <small v-if="dv.moTa" class="text-muted dichvu-mota">
              {{ dv.moTa }}
            </small>
          </router-link>
        </div>

        <!-- Tổng kết tiết kiệm -->
        <div class="saving-summary text-center mt-5" v-if="combo.phanTramGiam">
          <div class="saving-box">
            <span class="saving-label">Tổng giá lẻ</span>
            <span class="saving-giaGoc">{{ formatPrice(combo.giaGoc) }}</span>
            <span class="saving-arrow"><i class="fas fa-arrow-right"></i></span>
            <span class="saving-label">Giá combo</span>
            <span class="saving-giaCombo">{{ formatPrice(combo.gia) }}</span>
            <span class="saving-chip">
              Tiết kiệm {{ formatPrice(combo.giaGoc - combo.gia) }}
            </span>
          </div>
        </div>
      </section>

      <hr class="gold-line my-5" />

      <!-- NÚT THÊM VÀO GIỎ -->
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
           PHẦN 4: COMBO LIÊN QUAN
      =================================================== -->
      <section class="related-combos mb-5" v-if="relatedCombos.length > 0">
        <div
          class="section-heading-wrapper text-center mb-5"
          style="margin-top: 50px"
        >
          <p class="section-eyebrow">Có thể bạn thích</p>
          <h3 class="font-playfair section-heading-main">COMBO LIÊN QUAN</h3>
          <div class="heading-gold-line"></div>
        </div>
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
                      @click.prevent="addToCart(c)"
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

      <!-- ===================================================
           PHẦN 5: DỊCH VỤ GỢI Ý
      =================================================== -->
      <section class="suggested-services" v-if="suggestedServices.length > 0">
        <hr class="gold-line my-5"/>
        <div class="section-heading-wrapper text-center mb-5">
          <p class="section-eyebrow">Khám phá thêm</p>
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
                  >
                    CHI TIẾT
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===================================================
           ĐÁNH GIÁ
      =================================================== -->
      <!-- <ReviewList v-if="$route.params.id" :serviceId="$route.params.id" /> -->
    </div>


  </div>
</template>

<style scoped>
/* =========================================================
   FONT — Cormorant Garamond (heading) + Jost (body)
   ========================================================= */

/* =========================================================
   FIX LAYOUT — COMBO LIÊN QUAN & DỊCH VỤ GỢI Ý
   ========================================================= */
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
  white-space: nowrap;
  font-size: 0.78rem;
  font-weight: 300;
  color: var(--ink-soft);
}

.related-combos .row {
  display: flex !important;
  flex-wrap: wrap !important;
  row-gap: 24px !important;
}

:deep(.related-combos .row.g-4),
.related-combos .row {
  --bs-gutter-x: 1.5rem;
  --bs-gutter-y: 1.5rem;
  gap: 0;
}

:deep(.suggested-services .row.g-4),
.suggested-services .row {
  --bs-gutter-x: 1.5rem;
  --bs-gutter-y: 1.5rem;
}

.combo-footer {
  margin-top: auto;
  padding-top: 10px !important;
  border-top: 1px solid var(--line);
}

.related-combos .row > [class*="col-"] {
  flex: 0 0 auto;
}

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
:deep(.container) {
  margin-left: auto !important;
  margin-right: auto !important;
}
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
   HEADER
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

.combo-mota-header {
  font-family: "Jost", sans-serif;
  font-size: 0.88rem;
  font-weight: 300;
  color: var(--muted);
  line-height: 1.6;
  max-width: 680px;
  letter-spacing: 0.3px;
}

/* =========================================================
   FLASH SALE BANNER
   ========================================================= */
.flash-sale-banner {
  display: inline-flex;
  align-items: center;
  background: var(--ink);
  color: #fff;
  padding: 8px 20px;
  border-radius: 0;
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  letter-spacing: 2px;
}

.flash-label {
  letter-spacing: 2px;
}

.flash-countdown {
  font-family: "Jost", monospace;
  color: #fff;
  font-size: 0.82rem;
}

/* =========================================================
   GIÁ & GIẢM
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
  font-size: 1.0rem;
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
   META BADGES
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

.rating-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
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

.rating-badge .fa-star {
  color: var(--ink);
}

/* =========================================================
   ẢNH BANNER COMBO
   ========================================================= */
.combo-banner-wrap {
  max-width: 430px;
  margin: 0 auto;
}

.combo-banner-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: none;
}

.combo-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.combo-banner-img-wrap:hover .combo-banner-img {
  transform: scale(1.05);
}

.combo-banner-badge {
  position: absolute;
  bottom: 12px;
  left: 12px;
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 2px;
  text-transform: uppercase;
  padding: 6px 16px;
  border-radius: 0;
}

/* =========================================================
   DỊCH VỤ TRONG COMBO GRID
   ========================================================= */
.dichvu-combo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.dichvu-combo-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 170px;
  flex-shrink: 0;
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 0;
  padding: 12px 10px 14px;
  box-shadow: none;
  transition: transform 0.25s ease, border-color 0.25s ease;
}

.dichvu-combo-item:hover {
  transform: translateY(-4px);
  border-color: var(--ink);
  box-shadow: none;
}

.kieu-img-wrap {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid var(--line);
  box-shadow: none;
  transition: transform 0.3s ease, border-color 0.3s ease;
  margin-bottom: 10px;
}

.dichvu-combo-item:hover .kieu-img-wrap {
  transform: translateY(-3px);
  border-color: var(--ink);
}

.kieu-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.6s ease;
}

.dichvu-combo-item:hover .kieu-img {
  transform: scale(1.04);
}

.dichvu-combo-placeholder {
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 0;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--muted);
  margin-bottom: 10px;
}

.kieu-label {
  margin-top: 8px;
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

.dichvu-combo-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
}

.dichvu-time {
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1.5px;
}

.dichvu-price-tag {
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 300;
  color: var(--muted-light);
  text-decoration: line-through;
}

.dichvu-mota {
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 300;
  color: var(--muted);
  text-align: center;
  line-height: 1.5;
  margin-top: 6px;
  letter-spacing: 0.2px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* =========================================================
   SAVING SUMMARY
   ========================================================= */
.saving-summary {
  display: flex;
  justify-content: center;
}

.saving-box {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  background: var(--bg-soft);
  border: 1px solid var(--line);
  border-radius: 0;
  padding: 16px 32px;
  box-shadow: none;
}

.saving-label {
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-weight: 400;
}

.saving-giaGoc {
  font-family: "Jost", sans-serif;
  font-size: 1.0rem;
  color: var(--muted-light);
  text-decoration: line-through;
  font-weight: 300;
}

.saving-arrow {
  color: var(--ink);
}

.saving-giaCombo {
  font-family: "Jost", sans-serif;
  font-size: 1.2rem;
  font-weight: 500;
  color: var(--ink);
  letter-spacing: 0.5px;
}

.saving-chip {
  background: var(--ink);
  color: #fff;
  font-family: "Jost", sans-serif;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  padding: 4px 14px;
  border-radius: 0;
}

/* =========================================================
   NÚT ĐẶT LỊCH
   ========================================================= */
.btn-booking-premium {
  display: inline-block;
  background: var(--ink);
  color: #fff;
  padding: 14px 46px;
  border-radius: 0;
  border: none;
  font-family: "Jost", sans-serif;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 11px;
  text-decoration: none;
  box-shadow: none;
  transition: all 0.3s ease;
  cursor: pointer;
}

.btn-booking-premium:hover {
  transform: translateY(-3px);
  background: var(--ink-soft);
  color: #fff;
}

/* =========================================================
   COMBO LIÊN QUAN CARDS
   ========================================================= */
.luxury-combo-card {
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 0;
  transition: all 0.3s ease;
  overflow: hidden;
}

.luxury-combo-card:hover {
  border-color: var(--ink);
  box-shadow: none;
  transform: translateY(-5px);
}

.combo-img-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 4 / 3;
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
  padding: 16px !important;
}

.combo-name {
  font-family: "Jost", sans-serif;
  font-weight: 600;
  font-size: 0.82rem;
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
  margin-bottom: 8px;
  letter-spacing: 0.3px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.combo-items-list {
  list-style: none;
  padding: 0;
  margin: 0;
  max-height: 52px;
  overflow: hidden;
}

.combo-items-list li {
  margin-bottom: 4px;
  font-family: "Jost", sans-serif;
  font-size: 0.78rem;
  font-weight: 300;
  color: var(--ink-soft);
  display: flex;
  align-items: center;
  letter-spacing: 0.3px;
}

.combo-items-list i {
  color: var(--ink);
  margin-right: 10px;
  font-size: 0.75rem;
}

.combo-footer {
  margin-top: auto;
  padding-top: 10px !important;
  border-top: 1px solid var(--line);
}

.combo-info {
  flex-grow: 1;
  overflow: hidden;
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
  padding: 8px;
  font-family: "Jost", sans-serif;
  font-size: 0.72rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 1px;
  border-radius: 0;
  transition: all 0.25s ease;
  white-space: normal;
  word-break: break-word;
  cursor: pointer;
  width: 100%;
  text-align: center;
  line-height: 1.3;
  text-decoration: none;
  display: block;
}

.btn-outline-gold-fixed:hover {
  background: var(--ink);
  color: #fff;
}

/* =========================================================
   SUGGESTED SERVICE CARDS
   ========================================================= */
.service-card-item {
  background: var(--bg);
  border-radius: 0;
  overflow: hidden;
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
  overflow: hidden;
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
  font-size: 1.0rem;
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
   GOLD DIVIDER → hairline
   ========================================================= */
.gold-line {
  border: 0;
  height: 1px;
  background: var(--line);
  opacity: 1;
}



/* =========================================================
   TIÊU ĐỀ SECTION
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

.service-tieude-section {
  /* wrapper section */
}

/* =========================================================
   NÚT ĐẶT LỊCH CHÍNH
   ========================================================= */
.action-buttons-container {
  width: 100%;
  display: flex;
  justify-content: center;
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

/* Nút thứ cấp */
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

/* Nút chính */
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
  .service-title-lg {
    font-size: 1.9rem;
    letter-spacing: 2px;
  }

  .new-price-lg {
    font-size: 1.35rem;
  }

  .dichvu-combo-item {
    width: calc(50% - 8px);
  }

  .saving-box {
    padding: 14px 18px;
  }

  .service-tieude-title {
    font-size: 1.5rem;
    letter-spacing: 2px;
  }
}

@media (max-width: 480px) {
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
@media (max-width: 768px) {
  /* Thêm padding lề cho container trên mobile */
  .service-detail-page .container {
    padding-left: 16px !important;
    padding-right: 16px !important;
  }

  .service-title-lg {
    font-size: 1.9rem;
    letter-spacing: 2px;
  }

  .new-price-lg {
    font-size: 1.35rem;
  }

  .dichvu-combo-item {
    width: calc(50% - 8px);
  }

  .saving-box {
    padding: 14px 18px;
  }

  .service-tieude-title {
    font-size: 1.5rem;
    letter-spacing: 2px;
  }
}
</style>