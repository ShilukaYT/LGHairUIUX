<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ShoppingBag } from 'lucide-vue-next';
import { useDataStore } from '@/stores/useDataStore';
import { useWishlistStore } from '@/stores/useWishlistStore';
import axios from 'axios';
import { addToCartDB } from '@/Views/Anonymous/CSDL/cartDB';

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

// ===== TYPES =====
type HeroSlide = {
  id: number;
  image: string;
  alt: string;
  subtitle: string;
  title: string;
  desc: string;
  route: string;
};

type Testimonial = {
  id: number;
  name: string;
  role: string;
  quote: string;
  rating: number;
  service: string;
};

type Pillar = {
  id: number;
  maDM: string;
  title: string;
  subtitle: string;
  desc: string;
  hinhAnh: string;
};

// ===== SETUP =====
const router = useRouter();
const dataStore = useDataStore();
const wishlistStore = useWishlistStore();

// Hero slider
const activeHeroSlide = ref<number>(0);
let heroIntervalId: number | null = null;

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    image: '/dich-vu-toc.png',
    alt: 'Dịch vụ tóc LGHair',
    subtitle: 'Premium Hair Services',
    title: 'LGHAIR SALON',
    desc: 'Trải nghiệm dịch vụ làm tóc chuyên nghiệp hàng đầu',
    route: 'datdichvu'
  },
  {
    id: 2,
    image: '/nhuom-thoi-trang.png',
    alt: 'Nhuộm thời trang',
    subtitle: 'Trendy Hair Coloring',
    title: 'LGHAIR SALON',
    desc: 'Nhuộm tóc thời trang với màu sắc độc đáo nhất',
    route: 'datdichvu'
  },
  {
    id: 3,
    image: '/goi-dau-massage.png',
    alt: 'Gội đầu massage',
    subtitle: 'Relaxing Hair Care',
    title: 'LGHAIR SALON',
    desc: 'Thư giãn tuyệt đối với dịch vụ gội đầu massage cao cấp',
    route: 'datdichvu'
  },
  {
    id: 4,
    image: '/cat-tao-kieu.png',
    alt: 'Cắt tạo kiểu',
    subtitle: 'Expert Styling',
    title: 'LGHAIR SALON',
    desc: 'Tạo kiểu tóc chuyên nghiệp từ các chuyên gia hàng đầu',
    route: 'datdichvu'
  }
];

// Flash sale countdown
const flashTimer = ref({ h: '00', m: '00', s: '00' });
let flashTimerInterval: number | null = null;
const startFlashTimer = (endDateStr: string) => {
  const endDate = new Date(endDateStr).getTime();
  if (flashTimerInterval !== null) {
    window.clearInterval(flashTimerInterval);
  }
  flashTimerInterval = window.setInterval(() => {
    const now = new Date().getTime();
    const distance = endDate - now;
    if (distance < 0) {
      window.clearInterval(flashTimerInterval!);
      flashTimer.value = { h: '00', m: '00', s: '00' };
      return;
    }
    const h = Math.floor(distance / (1000 * 60 * 60));
    const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((distance % (1000 * 60)) / 1000);
    flashTimer.value = {
      h: String(h).padStart(2, '0'),
      m: String(m).padStart(2, '0'),
      s: String(s).padStart(2, '0')
    };
  }, 1000);
};

// Toast
const toastMessage = ref<string | null>(null);
const showToast = (message: string): void => {
  toastMessage.value = message;
  setTimeout(() => {
    if (toastMessage.value === message) {
      toastMessage.value = null;
    }
  }, 3000);
};

// Format giá VND
const formatPriceToVND = (priceVal: string | number): string => {
  if (typeof priceVal === 'number') {
    if (priceVal > 5000) return priceVal.toLocaleString('vi-VN') + ' đ';
    return (priceVal * 25000).toLocaleString('vi-VN') + ' đ';
  }
  if (typeof priceVal === 'string') {
    if (priceVal.includes('120') && !priceVal.includes('000')) return '1.200.000 đ';
    if (priceVal.includes('250') && !priceVal.includes('000')) return 'Từ 2.500.000 đ';
    if (priceVal.includes('300') && !priceVal.includes('000')) return '3.000.000 đ';
    if (priceVal.includes('150') && !priceVal.includes('000')) return '1.500.000 đ';
    const cleanNum = parseFloat(priceVal.replace(/[^0-9.]/g, ''));
    if (!isNaN(cleanNum)) {
      if (cleanNum > 5000) {
        return (priceVal.toLowerCase().includes('từ') ? 'Từ ' : '') + cleanNum.toLocaleString('vi-VN') + ' đ';
      }
      return (priceVal.toLowerCase().includes('từ') ? 'Từ ' : '') + (cleanNum * 25000).toLocaleString('vi-VN') + ' đ';
    }
  }
  return String(priceVal);
};

const normalizeVietnamese = (str: string): string => str.normalize('NFC');

// Danh mục (lấy động từ API DanhMucDV)
const pillars = ref<Pillar[]>([
  {
    id: 1,
    maDM: '',
    title: 'Làm Sạch & Dưỡng Ẩm',
    subtitle: 'Cleansing & Conditioning',
    desc: '',
    hinhAnh: ''
  },
  {
    id: 2,
    maDM: '',
    title: 'Phục Hồi Chuyên Sâu',
    subtitle: 'Intensive Restoration',
    desc: '',
    hinhAnh: ''
  },
  {
    id: 3,
    maDM: '',
    title: 'Tạo Kiểu Chuyên Nghiệp',
    subtitle: 'Professional Styling',
    desc: '',
    hinhAnh: ''
  }
]);

// Map tên danh mục sang subtitle tiếng Anh
const subtitleMap: Record<string, string> = {
  'làm sạch': 'Cleansing & Conditioning',
  'dưỡng ẩm': 'Cleansing & Conditioning',
  'phục hồi': 'Intensive Restoration',
  'tạo kiểu': 'Professional Styling',
  'nhuộm': 'Hair Coloring',
  'thời trang': 'Fashion Coloring',
  'tạo màu': 'Hair Coloring',
  'uốn': 'Hair Perming',
  'cắt': 'Haircut Services',
  'gội': 'Head Spa & Massage',
  'massage': 'Head Spa & Massage',
  'chăm sóc': 'Hair Treatment',
  'kỹ thuật': 'Technical Services',
  'dịch vụ': 'Hair Services',
  'combo': 'Combo Services',
};

const getSubtitle = (tenDanhMuc: string): string => {
  const lower = (tenDanhMuc || '').toLowerCase();
  for (const [key, val] of Object.entries(subtitleMap)) {
    if (lower.includes(key)) return val;
  }
  return 'Hair Services';
};

// Fallback ảnh theo loại danh mục — dùng ảnh local trong /public
const imgFallbackMap: Record<string, string> = {
  'cắt': '/cat-tao-kieu.png',
  'tạo kiểu': '/cat-tao-kieu.png',
  'nhuộm': '/nhuom-thoi-trang.png',
  'thời trang': '/nhuom-thoi-trang.png',
  'uốn': '/nhuom-thoi-trang.png',
  'gội': '/goi-dau-massage.png',
  'massage': '/goi-dau-massage.png',
  'phục hồi': '/dich-vu-toc.png',
  'chăm sóc': '/dich-vu-toc.png',
  'combo': '/dich-vu-toc.png',
};

const getFallbackImg = (tenDanhMuc: string): string => {
  const lower = (tenDanhMuc || '').toLowerCase();
  for (const [key, url] of Object.entries(imgFallbackMap)) {
    if (lower.includes(key)) return url;
  }
  return '/goi-dau-massage.png';
};


// Testimonials
const activeTestimonial = ref<number>(0);
let testimonialIntervalId: number | null = null;
const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Nguyễn Mai Phương",
    role: "Khách hàng thường xuyên",
    quote: "Dịch vụ cực kỳ chuyên nghiệp! Nhân viên tư vấn màu tóc rất hợp với khuôn mặt mình. Chắc chắn sẽ quay lại LGHair nhiều lần nữa.",
    rating: 5,
    service: "Nhuộm Thời Trang"
  },
  {
    id: 2,
    name: "Trần Bảo Nam",
    role: "Khách hàng mới",
    quote: "Lần đầu đến trải nghiệm dịch vụ gội đầu massage tại salon, thực sự thư giãn sau những ngày làm việc căng thẳng. Không gian tuyệt vời.",
    rating: 5,
    service: "Gội Đầu Massage"
  },
  {
    id: 3,
    name: "Lê Thu Thảo",
    role: "Khách VIP",
    quote: "Chất lượng sản phẩm sử dụng ở salon rất tốt, tóc mình phục hồi rõ rệt sau liệu trình phục hồi chuyên sâu. Cảm ơn các chuyên viên của LGHair.",
    rating: 5,
    service: "Phục Hồi Chuyên Sâu"
  }
];

const currentTestimonial = computed(() => {
  return testimonials[activeTestimonial.value] || {
    id: 0, name: '', role: '', quote: '', rating: 5, service: ''
  };
});

// Products loading state
const isLoadingProducts = ref<boolean>(true);

// Flash Sale state
const activeFlashSale = ref<any>(null);
const flashSaleItems = ref<any[]>([]);

// Stylists
const stylists = ref<any[]>([]);

// ===== ACTIONS =====
const setHeroSlide = (index: number): void => {
  activeHeroSlide.value = index;
};

const nextHeroSlide = (): void => {
  activeHeroSlide.value = (activeHeroSlide.value + 1) % heroSlides.length;
};

const goToRoute = (name: string): void => {
  router.push({ name });
};

const nextTestimonial = (): void => {
  activeTestimonial.value = (activeTestimonial.value + 1) % testimonials.length;
};

const prevTestimonial = (): void => {
  activeTestimonial.value = (activeTestimonial.value - 1 + testimonials.length) % testimonials.length;
};

// ===== LIFECYCLE =====
onMounted(async () => {
  heroIntervalId = window.setInterval(nextHeroSlide, 4200);
  testimonialIntervalId = window.setInterval(nextTestimonial, 5000);

  // Fetch danh mục dịch vụ từ API
  try {
    const dmRes = await axios.get(`${API}/api/DanhMucDV/danh-sach`);
    const dmList: any[] = dmRes.data || [];
    if (dmList.length > 0) {
      pillars.value = dmList
        .filter((d: any) => (d.trangThai ?? 1) !== 0)
        .map((d: any, idx: number) => {
          const rawImg = d.hinhAnh || '';
          let imgUrl = '';
          if (rawImg) {
            if (rawImg.startsWith('http')) {
              imgUrl = rawImg;
            } else if (rawImg.startsWith('/UserUploads') || rawImg.startsWith('UserUploads')) {
              imgUrl = `${API}/${rawImg.replace(/^\//, '')}`;
            } else {
              imgUrl = `${API}/UserUploads/${rawImg.replace(/^\//, '')}`;
            }
          }
          // Nếu DB không có ảnh thì dùng fallback theo loại danh mục
          const tenDanhMuc = d.tenDanhMuc || '';
          if (!imgUrl) imgUrl = getFallbackImg(tenDanhMuc);
          return {
            id: idx + 1,
            maDM: d.maDM || d.maDm || '',
            title: d.tenDanhMuc || `Danh mục ${idx + 1}`,
            subtitle: getSubtitle(d.tenDanhMuc || ''),
            desc: '',
            hinhAnh: imgUrl
          };
        });
    }
  } catch (err) {
    console.error('Lỗi tải danh mục dịch vụ:', err);
    // Giữ nguyên fallback data tĩnh
  }

  // Fetch API Sale
  try {
    const saleRes = await axios.get(`${API}/api/Sale`);
    const sales = saleRes.data?.data || saleRes.data?.Data || [];
    const activeSale = sales.find((s: any) => s.trangThai === 1 || s.TrangThai === 1);
    if (activeSale) {
      activeFlashSale.value = activeSale;
      startFlashTimer(activeSale.ngayKetThuc || activeSale.NgayKetThuc);
      const chiTiet = activeSale.chiTietFlashSales || activeSale.ChiTietFlashSales || [];
      flashSaleItems.value = chiTiet.map((item: any) => ({
        id: item.maDV || item.MaDV || item.maCB || item.MaCB,
        name: item.tenDv || item.TenDv || item.tenCb || item.TenCb,
        price: item.gia || item.Gia,
        salePrice: item.giaSauGiam || item.GiaSauGiam,
        discount: item.phanTramGiam || item.PhanTramGiam
      }));
    }
  } catch (err) {
    console.error('Lỗi tải FlashSale:', err);
  }

  // Fetch dịch vụ thật từ API
  try {
    const res = await axios.get(`${API}/api/DanhSachDichVu`);
    const servicesData = res.data?.services || res.data?.data;
    if (servicesData && servicesData.length > 0) {
      dataStore.SERVICES = servicesData.map((s: any) => {
        const formatImgUrl = (url: string) => {
          if (!url) return '';
          if (url.startsWith('http')) return url;
          return url.startsWith('/') ? `${API}${url}` : `${API}/${url}`;
        };
        const DEFAULT_IMG = 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=1000';
        const mainImg = (s.hinhAnh?.trim()) ? formatImgUrl(s.hinhAnh) : DEFAULT_IMG;
        return {
          id: s.maDv,
          name: s.tenDv,
          desc: s.moTa || '',
          price: s.gia,
          duration: `${s.thoiGianLam || 30} PHÚT`,
          img: mainImg
        };
      });
    }
  } catch (err) {
    console.error('Lỗi tải dịch vụ:', err);
  }

  // Fetch thợ thật từ API
  try {
    const res = await axios.get(`${API}/api/NhanVien`, {
      params: { trangThai: 1 }
    });
    if (res.data && res.data.length > 0) {
      const getImgUrl = (url: string) => {
        if (!url) return '';
        if (url.startsWith('http')) return url;
        return url.startsWith('/') ? `${API}${url}` : `${API}/${url}`;
      };
      const keywords = ['thợ', 'stylist', 'kỹ thuật'];
      stylists.value = res.data
        .filter((nv: any) => {
          if (!nv.tenChucVu) return false;
          const role = nv.tenChucVu.toLowerCase();
          return keywords.some(k => role.includes(k));
        })
        .map((nv: any) => ({
          id: nv.maNv,
          name: nv.hoTenNv,
          role: nv.tenChucVu,
          img: nv.hinhAnh ? getImgUrl(nv.hinhAnh) : '',
          rating: 5
        }));
    }
  } catch (err) {
    console.error('Lỗi tải thợ:', err);
  }

  // Fetch sản phẩm thật từ API
  isLoadingProducts.value = true;
  try {
    const resProd = await axios.get(`${API}/api/SanPham/filter`, {
      params: { page: 1, pageSize: 20 }
    });
    if (resProd.data?.data?.length > 0) {
      const DEFAULT_PROD_IMG = 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800';
      const getImgUrl = (img?: string): string => {
        if (!img) return DEFAULT_PROD_IMG;
        if (img.startsWith('http')) return img;
        if (img.startsWith('/')) return `${API}${img}`;
        return `${API}/uploads/sanpham/${img}`;
      };
      dataStore.PRODUCTS = resProd.data.data.map((p: any) => {
        const rawImg = p.hinhAnhDaiDien || p.hinhAnh || p.anhDaiDien || p.imageUrl || '';
        const avgRating = typeof p.diemTrungBinh === 'number' ? p.diemTrungBinh
          : typeof p.soSao === 'number' ? p.soSao
            : typeof p.rating === 'number' ? p.rating : 5;
        const reviewCount = p.soLuongDanhGia ?? p.soLuotDanhGia ?? p.reviewCount ?? 0;
        return {
          id: String(p.maSp),
          maSp: p.maSp, // required for wishlistStore
          maBienThe: p.maBienThe ?? p.bienThes?.[0]?.maBienThe ?? null,
          name: p.tenSp,
          tenSp: p.tenSp, // required for wishlistStore
          desc: p.moTa || '',
          price: p.giaTu ?? p.gia ?? 0,
          img: getImgUrl(rawImg),
          category: p.danhMuc?.tenDanhMuc || p.tenDanhMuc || 'Boutique',
          size: p.thuongHieu?.tenThuongHieu || p.tenThuongHieu || 'LGHair',
          avgRating,
          reviewCount
        };
      });
    }
  } catch (err) {
    console.error('Lỗi tải sản phẩm:', err);
  } finally {
    isLoadingProducts.value = false;
  }
});

onUnmounted(() => {
  if (heroIntervalId !== null) {
    window.clearInterval(heroIntervalId);
    heroIntervalId = null;
  }
  if (flashTimerInterval !== null) {
    window.clearInterval(flashTimerInterval);
    flashTimerInterval = null;
  }
  if (testimonialIntervalId !== null) {
    window.clearInterval(testimonialIntervalId);
    testimonialIntervalId = null;
  }
});

// ===== THÊM VÀO GIỎ HÀNG =====
const addProductToCart = async (prod: any) => {
  try {
    let maBienThe = prod.maBienThe;
    if (!maBienThe) {
      try {
        const detailRes = await axios.get(`${API}/api/SanPham/${prod.id}`);
        const detail = detailRes.data;
        const bienThes = detail.bienThes ?? detail.bienThe ?? detail.variants ?? [];
        if (bienThes.length > 0) {
          maBienThe = bienThes[0].maBienThe ?? bienThes[0].id;
        }
      } catch {
        console.warn('Không lấy được biến thể, dùng maSp làm fallback');
      }
    }
    if (!maBienThe) maBienThe = prod.id;

    await addToCartDB({
      id: maBienThe,
      type: 'SANPHAM',
      tenItem: prod.name,
      gia: prod.price,
      hinhAnh: prod.img,
      soLuong: 1
    });

    window.dispatchEvent(new Event('cart-updated'));
    showToast('Đã thêm ' + prod.name + ' vào giỏ hàng!');
  } catch (err) {
    console.error('Lỗi thêm sản phẩm vào giỏ:', err);
    showToast('Lỗi thêm vào giỏ hàng!');
  }
};
</script>
<template>
  <div class="w-full hm-root">

    <!-- ===== TOAST ===== -->
    <transition name="toast-slide">
      <div v-if="toastMessage" class="hm-toast">
        <div class="hm-toast-dot"></div>
        <span class="hm-toast-text">{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- ===== BANNER SLIDER ===== -->
    <section class="hm-hero">
      <div class="hm-hero-slides">
        <div v-for="(slide, index) in heroSlides" :key="slide.id" class="hm-hero-slide"
          :class="index === activeHeroSlide ? 'hm-slide-active' : 'hm-slide-hidden'">
          <img :src="slide.image" :alt="slide.alt" class="hm-hero-img" />
          <div class="hm-hero-overlay"></div>
        </div>
      </div>
      <div class="hm-hero-content">
        <p class="hm-hero-subtitle">{{ heroSlides[activeHeroSlide]?.subtitle }}</p>
        <h1 class="hm-hero-title">{{ heroSlides[activeHeroSlide]?.title || 'LGHAIR SALON' }}</h1>
        <p class="hm-hero-desc">{{ heroSlides[activeHeroSlide]?.desc }}</p>
        <div class="hm-hero-cta">
          <button class="hm-btn-primary" @click="goToRoute('datdichvu')">Đặt Lịch Ngay</button>
          <button class="hm-btn-outline" @click="goToRoute('shop')">Mua Sắm Sản Phẩm</button>
        </div>
      </div>
      <div class="hm-hero-dots">
        <button v-for="(slide, index) in heroSlides" :key="slide.id" class="hm-hero-dot"
          :class="index === activeHeroSlide ? 'hm-dot-active' : ''" @click="setHeroSlide(index)"></button>
      </div>
    </section>

    <!-- ===== DANH MỤC (Lấy từ API) ===== -->
    <section class="hm-category-row">
      <div class="hm-category-inner">
        <div v-for="(p, idx) in pillars" :key="p.id" class="hm-cat-card"
          @click="p.maDM ? router.push({ name: 'services', query: { category: p.maDM } }) : goToRoute('services')">
          <!-- Ảnh danh mục: luôn có, hiện khi hover -->
          <img :src="p.hinhAnh || getFallbackImg(p.title)" :alt="p.title" class="hm-cat-hover-img"
            @error="(e: Event) => { (e.target as HTMLImageElement).src = getFallbackImg(p.title) }" />
          <div class="hm-cat-hover-overlay"></div>
          <!-- Nội dung chữ -->
          <div class="hm-cat-content">
            <div class="hm-cat-num">0{{ p.id }}</div>
            <div class="hm-cat-title">{{ p.title }}</div>
            <div class="hm-cat-sub">{{ p.subtitle }}</div>
          </div>
        </div>
        <div class="hm-cat-card hm-cat-card-img" @click="goToRoute('services')">
          <img src="/salon-service-banner.jpg" alt="Xem thêm dịch vụ LGHair" class="hm-cat-bg-img" />
          <div class="hm-cat-hover-text">Xem Thêm Dịch Vụ</div>
        </div>
      </div>
    </section>

    <!-- ===== ĐƯỜNG KẺ NGANG MỜ ===== -->
    <div class="hm-divider"></div>

    <section class="hm-flash-section" v-if="activeFlashSale">
      <div class="hm-flash-inner">
        <div class="hm-flash-top">
          <div class="hm-flash-title-wrap">
            <span class="hm-flash-f">FLASH</span>
            <span class="hm-flash-s"> SALE</span>
          </div>
          <div class="hm-flash-timer">
            <div class="hm-timer-box">{{ flashTimer.h }}</div>
            <span class="hm-timer-sep">:</span>
            <div class="hm-timer-box">{{ flashTimer.m }}</div>
            <span class="hm-timer-sep">:</span>
            <div class="hm-timer-box">{{ flashTimer.s }}</div>
          </div>
        </div>

        <div class="hm-flash-layout">
          <div class="hm-flash-left">
            <img src="/f70a4105-d5a1-41cb-b0cf-d92f6301aa36.jpg" alt="Flash sale LGHair" class="hm-flash-left-img" />
          </div>

          <div class="hm-flash-cards">
            <div v-for="(svc, idx) in flashSaleItems.slice(0, 4)" :key="svc.id" class="hm-flash-card"
              @click="router.push({ name: 'serviceDetail', params: { id: svc.id } })">
              <div class="hm-flash-card-head">
                <span class="hm-flash-badge" v-if="svc.discount">-{{ svc.discount }}%</span>
                <button class="hm-flash-heart" @click.stop>♡</button>
              </div>
              <div class="hm-flash-card-img-wrap">
                <img
                  :src="dataStore.SERVICES.find(s => s.id === svc.id)?.img || dataStore.SERVICES[idx % Math.max(1, dataStore.SERVICES.length)]?.img || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=300'"
                  :alt="svc.name" class="hm-flash-card-img" />
              </div>
              <div class="hm-flash-card-name">{{ svc.name }}</div>
              <div class="hm-flash-price-row">
                <span class="hm-price-old">{{ formatPriceToVND(svc.price) }}</span>
                <span class="hm-price-new">{{ formatPriceToVND(svc.salePrice) }}</span>
              </div>
              <div class="hm-flash-underline"></div>
              <button class="hm-flash-btn" @click.stop="router.push({ name: 'datdichvu' })">ĐẶT NGAY</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== CTA SẴN SÀNG CHIA SẺ CÂU CHUYỆN ===== -->
    <section class="hm-cta-section">
      <img src="https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=1440" alt="CTA background"
        class="hm-cta-bg" />
      <div class="hm-cta-overlay"></div>
      <div class="hm-cta-content">
        <h2 class="hm-cta-title">Sẵn Sàng Chia Sẻ Câu Chuyện</h2>
        <p class="hm-cta-desc">
          Mỗi đường kéo là một tác phẩm nghệ thuật. Đam mê và sự tỉ mỉ chính là cam kết tuyệt đối của chúng tôi dành cho
          bạn.
        </p>
        <button class="hm-cta-btn" @click="goToRoute('datdichvu')">ĐẶT LỊCH NGAY</button>
      </div>
    </section>

    <section class="hm-services-section">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 32px;">
        <div class="hm-stylist-header" data-aos="fade-up">
          <h2 class="hm-section-title" style="margin-bottom: 0; text-align: left;">Dịch Vụ Mới Của Chúng Tôi</h2>
        </div>
        <div class="hm-stylist-divider" data-aos="fade-up"></div>
      </div>

      <div class="hm-svc-row hm-svc-row-3" v-if="dataStore.SERVICES.length >= 1">
        <div class="hm-svc-big" v-if="dataStore.SERVICES[0]" data-aos="fade-right">
          <img :src="dataStore.SERVICES[0].img" :alt="dataStore.SERVICES[0].name" class="hm-svc-big-img" />
          <div class="hm-svc-big-overlay">
            <h3 class="hm-svc-big-name" style="text-transform: uppercase;">{{
              normalizeVietnamese(dataStore.SERVICES[0].name) }}</h3>
            <p class="hm-svc-big-price">{{ formatPriceToVND(dataStore.SERVICES[0].price) }}</p>
            <button class="hm-svc-big-btn"
              @click="router.push({ name: 'serviceDetail', params: { id: dataStore.SERVICES[0].id } })">Xem chi
              tiết</button>
          </div>
        </div>
        <div class="hm-svc-card" v-if="dataStore.SERVICES[1]" data-aos="fade-up" data-aos-delay="100"
          @click="router.push({ name: 'serviceDetail', params: { id: dataStore.SERVICES[1].id } })">
          <img :src="dataStore.SERVICES[1].img" :alt="dataStore.SERVICES[1].name" class="hm-svc-card-img" />
          <div class="hm-svc-card-body">
            <div>
              <span class="hm-svc-label">Dịch vụ mới</span>
              <h3 class="hm-svc-card-name" style="text-transform: uppercase;">{{
                normalizeVietnamese(dataStore.SERVICES[1].name) }}</h3>
              <p class="hm-svc-card-desc">{{ dataStore.SERVICES[1].desc }}</p>
            </div>
            <p class="hm-svc-card-price">{{ formatPriceToVND(dataStore.SERVICES[1].price) }}</p>
          </div>
        </div>
        <div class="hm-svc-card" v-if="dataStore.SERVICES[2]" data-aos="fade-up" data-aos-delay="200"
          @click="router.push({ name: 'serviceDetail', params: { id: dataStore.SERVICES[2].id } })">
          <img :src="dataStore.SERVICES[2].img" :alt="dataStore.SERVICES[2].name" class="hm-svc-card-img" />
          <div class="hm-svc-card-body">
            <div>
              <span class="hm-svc-label">Nổi bật</span>
              <h3 class="hm-svc-card-name" style="text-transform: uppercase;">{{
                normalizeVietnamese(dataStore.SERVICES[2].name) }}</h3>
              <p class="hm-svc-card-desc">{{ dataStore.SERVICES[2].desc }}</p>
            </div>
            <p class="hm-svc-card-price">{{ formatPriceToVND(dataStore.SERVICES[2].price) }}</p>
          </div>
        </div>
      </div>

      <div class="hm-svc-row hm-svc-row-2" style="margin-top: 32px;" v-if="dataStore.SERVICES.length >= 4">
        <div class="hm-svc-card hm-svc-card-large" v-if="dataStore.SERVICES[3]" data-aos="fade-up" data-aos-delay="100"
          @click="router.push({ name: 'serviceDetail', params: { id: dataStore.SERVICES[3].id } })">
          <img :src="dataStore.SERVICES[3].img" :alt="dataStore.SERVICES[3].name" class="hm-svc-card-img" />
          <div class="hm-svc-card-body">
            <span class="hm-svc-label">Khuyên dùng</span>
            <h3 class="hm-svc-card-name" style="text-transform: uppercase;">{{
              normalizeVietnamese(dataStore.SERVICES[3].name) }}</h3>
            <p class="hm-svc-card-desc">{{ dataStore.SERVICES[3].desc }}</p>
            <p class="hm-svc-card-price">{{ formatPriceToVND(dataStore.SERVICES[3].price) }}</p>
          </div>
        </div>
        <div class="hm-svc-card hm-svc-card-large" v-if="dataStore.SERVICES[4]" data-aos="fade-up" data-aos-delay="200"
          @click="router.push({ name: 'serviceDetail', params: { id: dataStore.SERVICES[4].id } })">
          <img :src="dataStore.SERVICES[4].img" :alt="dataStore.SERVICES[4].name" class="hm-svc-card-img" />
          <div class="hm-svc-card-body">
            <span class="hm-svc-label">Yêu thích</span>
            <h3 class="hm-svc-card-name" style="text-transform: uppercase;">{{
              normalizeVietnamese(dataStore.SERVICES[4].name) }}</h3>
            <p class="hm-svc-card-desc">{{ dataStore.SERVICES[4].desc }}</p>
            <p class="hm-svc-card-price">{{ formatPriceToVND(dataStore.SERVICES[4].price) }}</p>
          </div>
        </div>
      </div>

      <div class="hm-center">
        <button class="hm-view-all" @click="goToRoute('dmdv')">Xem thêm</button>
      </div>
    </section>

    <!-- ===== ĐỘI NGŨ STYLIST ===== -->
    <section class="hm-stylist-section">
      <div class="hm-stylist-header">
        <h2 class="hm-section-title">Đội Ngũ Stylist Chuyên Nghiệp</h2>
        <button class="hm-more-link" @click="goToRoute('employees')">Xem thêm ↗</button>
      </div>
      <div class="hm-stylist-divider"></div>

      <div class="hm-stylist-marquee-container">
        <div class="hm-stylist-marquee-track">
          <!-- Bản gốc -->
          <div v-for="(t, idx) in (stylists.length > 0 ? stylists : testimonials)" :key="t.id"
            class="hm-stylist-card hm-small-card">
            <div class="hm-stylist-photo-wrap">
              <img
                :src="t.img || ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=500', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=500', 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=500'][idx % 3]"
                :alt="t.name" class="hm-stylist-photo" />
            </div>
            <div class="hm-stylist-info">
              <h4 class="hm-stylist-name">{{ t.name }}</h4>
              <div class="hm-stylist-stars">
                <span v-for="s in (t.rating || 5)" :key="s" class="hm-star">★</span>
                <span v-for="e in (5 - (t.rating || 5))" :key="'e' + e" class="hm-star-empty">★</span>
              </div>
              <p class="hm-stylist-role">{{ t.role }}</p>
            </div>
          </div>
          <!-- Bản sao để lặp liên tục -->
          <div v-for="(t, idx) in (stylists.length > 0 ? stylists : testimonials)" :key="t.id + '-clone'"
            class="hm-stylist-card hm-small-card">
            <div class="hm-stylist-photo-wrap">
              <img
                :src="t.img || ['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=500', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=500', 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=500'][idx % 3]"
                :alt="t.name" class="hm-stylist-photo" />
            </div>
            <div class="hm-stylist-info">
              <h4 class="hm-stylist-name">{{ t.name }}</h4>
              <div class="hm-stylist-stars">
                <span v-for="s in (t.rating || 5)" :key="s" class="hm-star">★</span>
                <span v-for="e in (5 - (t.rating || 5))" :key="'e' + e" class="hm-star-empty">★</span>
              </div>
              <p class="hm-stylist-role">{{ t.role }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="hm-center" style="margin-top: 48px;">
        <button class="hm-view-all" @click="goToRoute('booking')">Đặt Lịch Ngay →</button>
      </div>
    </section>

    <!-- ===== BANNER SẢN PHẨM ===== -->
    <section class="hm-banner-shop">
      <div class="hm-banner-shop-inner">
        <img src="/0de1691b-ac4c-46a4-89b7-f395a7c243ef.jpg" alt="Banner Sản Phẩm" class="hm-banner-shop-img" />
        <div class="hm-banner-shop-content">
          <h2 class="hm-banner-shop-title">Chăm Sóc - Nhuộm Tóc</h2>
          <p class="hm-banner-shop-desc">
            Tóc đẹp chuẩn Salon với các sản phẩm bán<br />chạy nhất
          </p>
        </div>
      </div>
    </section>

    <section class="hm-shop-section">
      <div style="max-width: 1280px; margin: 0 auto; padding: 0 32px;">
        <div class="hm-stylist-header" data-aos="fade-up">
          <h2 class="hm-section-title" style="margin-bottom: 0; text-align: left;">Cửa Hàng Của Chúng Tôi</h2>
        </div>
        <div class="hm-stylist-divider" data-aos="fade-up"></div>
      </div>


      <div v-if="isLoadingProducts" class="hm-prod-grid">
        <div v-for="n in 8" :key="n" class="hm-prod-skeleton">
          <div class="hm-skel-img"></div>
          <div class="hm-skel-line"></div>
          <div class="hm-skel-line hm-skel-short"></div>
        </div>
      </div>

      <div v-else-if="dataStore.PRODUCTS.length > 0" class="hm-prod-grid">
        <div v-for="(prod, prodIdx) in dataStore.PRODUCTS.slice(0, 8)" :key="prod.id" class="hm-prod-card"
          @click="router.push({ name: 'product_detail', params: { id: prod.id } })">
          <div class="hm-prod-img-wrap">
            <span v-if="prodIdx < 4" class="hm-prod-badge">
              {{ prodIdx === 0 ? 'Signature' : prodIdx === 1 ? 'Bán Chạy' : prodIdx === 2 ? 'Mới Về' : 'Thuần Chay' }}
            </span>
            <button class="hm-prod-wish" @click.stop="wishlistStore.toggleProductFavorite(prod)" title="Yêu thích">
              <span v-if="wishlistStore.isProductFavorite(prod.maSp)" style="color: var(--red);">♥</span>
              <span v-else>♡</span>
            </button>
            <img :src="prod.img || 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800'"
              :alt="prod.name" class="hm-prod-img" />
          </div>
          <div class="hm-prod-info">
            <div class="hm-prod-stars">
              <span v-for="s in 5" :key="s"
                :class="s <= Math.round(prod.avgRating ?? 5) ? 'hm-star' : 'hm-star-empty'">★</span>
              <span v-if="prod.reviewCount > 0" class="hm-prod-review-count">({{ prod.reviewCount }} Đánh giá)</span>
            </div>
            <h4 class="hm-prod-name">{{ prod.name }}</h4>
            <div class="hm-prod-price-row">
              <span class="hm-prod-price">{{ formatPriceToVND(prod.price) }}</span>
              <button class="hm-prod-add" @click.stop="addProductToCart(prod)">Thêm Vào Giỏ</button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="hm-prod-empty">
        <ShoppingBag :size="40" />
        <p>Không tải được sản phẩm. Vui lòng kiểm tra kết nối máy chủ.</p>
        <button @click="goToRoute('shop')">Xem tất cả sản phẩm</button>
      </div>

      <div class="hm-center">
        <button class="hm-xem-them" @click="goToRoute('shop')">Xem Thêm</button>
      </div>
    </section>

    <!-- ===== TESTIMONIAL ===== -->
    <section class="hm-testimonial-section">
      <div class="hm-testimonial-img-wrap">
        <img src="https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800" alt="Testimonial"
          class="hm-testimonial-img" />
      </div>
      <div class="hm-testimonial-card">
        <div class="hm-test-stars">
          <span v-for="s in currentTestimonial.rating" :key="s">★</span>
        </div>
        <p class="hm-test-quote" :key="activeTestimonial">"{{ normalizeVietnamese(currentTestimonial.quote) }}"</p>
        <div class="hm-test-author-row">
          <div>
            <p class="hm-test-name">{{ currentTestimonial.name }}</p>
            <p class="hm-test-role">{{ currentTestimonial.role }}</p>
          </div>
          <span class="hm-test-tag">{{ currentTestimonial.service }}</span>
        </div>
        <div class="hm-test-nav">
          <button class="hm-test-nav-btn" @click="prevTestimonial">&#8249;</button>
          <button class="hm-test-nav-btn" @click="nextTestimonial">&#8250;</button>
        </div>
      </div>
    </section>

    <!-- ===== CLUB / NEWSLETTER ===== -->
    <section class="hm-club-section">
      <div class="hm-club-deco"></div>
      <div class="hm-club-inner">
        <p class="hm-club-label">LGHair Club</p>
        <h3 class="hm-club-title">Trở Thành Thành Viên Thượng Hạng</h3>
        <p class="hm-club-desc">Đăng ký nhận bản tin để nhận những cập nhật xu hướng tóc mới nhất, cẩm nang chăm sóc tóc
          từ chuyên gia và quyền ưu tiên mua các bộ sưu tập giới hạn.</p>
        <form @submit.prevent="showToast('Cảm ơn bạn đã gia nhập LGHair Club!')" class="hm-club-form">
          <input type="email" required placeholder="Địa chỉ Email của bạn..." class="hm-club-input" />
          <button type="submit" class="hm-club-submit">Tham Gia</button>
        </form>
      </div>
    </section>

  </div>
</template>

<style scoped>
/* ==================== GOOGLE FONTS ==================== */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Inconsolata:wght@300;400;600&family=Jost:wght@400;500&family=K2D:wght@500&display=swap');

:root {
  --red: #ef3030;
  --red2: #f64c4c;
  --gray-bg: #ededed;
  --border1: #f2f2f2;
  --border2: #dfdfdf;
  --gray-fill: #d9d9d9;
  --gray-text: #8b8a8a;
}

/* ==================== ROOT ==================== */
.hm-root {
  background: #fff;
  font-family: inherit;
  color: #000;
  min-width: 1280px;
  overflow-x: visible;
}

/* ==================== TOAST ==================== */
.hm-toast {
  position: fixed;
  top: 80px;
  right: 24px;
  z-index: 9999;
  background: #0a0a0a;
  color: #fff;
  border: 1px solid rgba(191, 167, 122, 0.4);
  padding: 14px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.hm-toast-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #bfa77a;
  animation: ping 1s infinite;
}

.hm-toast-text {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  font-weight: 300;
}

@keyframes ping {

  0%,
  100% {
    transform: scale(1);
    opacity: 1
  }

  50% {
    transform: scale(1.4);
    opacity: 0.6
  }
}

/* Toast Transition */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ==================== HERO BANNER ==================== */
.hm-hero {
  position: relative;
  width: 100%;
  height: 520px;
  background: #000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
}

.hm-hero-slides {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.hm-hero-slide {
  position: absolute;
  inset: 0;
  transition: opacity 1.2s ease-in-out;
}

.hm-slide-active {
  opacity: 1;
  z-index: 10;
}

.hm-slide-hidden {
  opacity: 0;
  z-index: 0;
}

.hm-hero-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hm-hero-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.20);
}

.hm-hero-content {
  position: relative;
  z-index: 20;
  max-width: 620px;
  padding: 0 80px;
  color: #fff;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.hm-hero-subtitle {
  font-size: 11px;
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #ccc;
  margin-bottom: 16px;
  font-weight: 600;
}

.hm-hero-title {
  font-size: 48px;
  font-weight: 700;
  text-transform: uppercase;
  line-height: 1.1;
  margin-bottom: 20px;
  letter-spacing: 0.04em;
}

.hm-hero-desc {
  font-size: 15px;
  font-weight: 300;
  color: #ccc;
  line-height: 1.7;
  margin-bottom: 32px;
  max-width: 460px;
}

.hm-hero-cta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.hm-btn-primary {
  padding: 14px 32px;
  background: #000;
  color: #fff;
  border: 1px solid #fff;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: all 0.3s;
}

.hm-btn-primary:hover {
  background: #fff;
  color: #000;
}

.hm-btn-outline {
  padding: 14px 32px;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  cursor: pointer;
  transition: all 0.3s;
}

.hm-btn-outline:hover {
  background: rgba(255, 255, 255, 0.15);
}

.hm-hero-dots {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  gap: 8px;
}

.hm-hero-dot {
  width: 32px;
  height: 2px;
  background: rgba(255, 255, 255, 0.35);
  border: none;
  cursor: pointer;
  transition: all 0.4s;
  padding: 0;
}

.hm-dot-active {
  width: 64px;
  background: #fff;
}

/* ==================== DANH MỤC ==================== */
.hm-category-row {
  width: 100%;
  background: #fff;
  border-bottom: 1px solid var(--border1);
  overflow: hidden;
}

.hm-category-inner {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  width: 100%;
}

.hm-cat-card {
  padding: 28px 20px 24px;
  border-bottom: 1px solid var(--border1);
  min-height: 195px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  cursor: pointer;
  transition: background 0.3s;
  position: relative;
  overflow: hidden;
}

.hm-cat-card:not(:last-child)::after {
  content: '';
  position: absolute;
  right: 0;
  top: 30%;
  height: 40%;
  width: 1px;
  background-color: #d1d1d1;
}

.hm-cat-card:hover {
  background: #f9f9f9;
}

/* Ảnh hiện khi hover card danh mục */
.hm-cat-hover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.06);
  transition: opacity 0.4s ease, transform 0.5s ease;
  z-index: 1;
}

.hm-cat-hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 2;
}

.hm-cat-content {
  position: relative;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: color 0.3s;
}

.hm-cat-card:hover .hm-cat-hover-img {
  opacity: 1;
  transform: scale(1);
}

.hm-cat-card:hover .hm-cat-hover-overlay {
  opacity: 1;
}

.hm-cat-card:hover .hm-cat-content .hm-cat-num,
.hm-cat-card:hover .hm-cat-content .hm-cat-title,
.hm-cat-card:hover .hm-cat-content .hm-cat-sub {
  color: #fff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.6);
}

.hm-cat-num {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 28px;
  color: var(--red);
  font-weight: 400;
  margin-bottom: 8px;
}

.hm-cat-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.hm-cat-sub {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.hm-cat-card-img {
  padding: 0;
}

.hm-cat-bg-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.hm-cat-card-img:hover .hm-cat-bg-img {
  transform: scale(1.08);
}

.hm-cat-hover-text {
  position: relative;
  z-index: 2;
  color: #fff;
  font-size: 14px;
  font-weight: 700;
  text-align: center;
  text-transform: uppercase;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
  background: rgba(0, 0, 0, 0.35);
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.hm-divider {
  width: calc(100% - 64px);
  max-width: 1280px;
  margin: 32px auto;
  height: 1px;
  background: #e0e0e0;
}

/* ==================== FLASH SALE ==================== */
.hm-flash-section {
  background: #fff;
  width: 100%;
  padding: 0 32px;
  box-sizing: border-box;
}

.hm-flash-inner {
  max-width: 1280px;
  margin: 16px auto 48px;
  border-radius: 24px;
  border: 1px solid var(--border2);
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.05);
}

.hm-flash-top {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border1);
}

.hm-flash-title-wrap {
  display: flex;
  align-items: center;
}

.hm-flash-f {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  color: #dc2626;
  font-size: 22px;
  font-style: italic;
}

.hm-flash-s {
  font-family: inherit;
  font-weight: 700;
  color: #dc2626;
  font-size: 22px;
}

.hm-flash-timer {
  display: flex;
  align-items: center;
  gap: 4px;
}

.hm-timer-box {
  width: 36px;
  height: 26px;
  border: 1.5px solid #000;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  background: #fff;
}

.hm-timer-sep {
  font-weight: 700;
  font-size: 16px;
  color: #000;
}

.hm-flash-layout {
  display: flex;
  align-items: stretch;
}

.hm-flash-left {
  width: 300px;
  flex-shrink: 0;
  overflow: hidden;
  position: relative;
}

.hm-flash-left-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: calc(100% - 16px);
  object-fit: cover;
  display: block;
  border-radius: 4px;
}

.hm-flash-vline {
  width: 1px;
  background: #000;
  flex-shrink: 0;
}

.hm-flash-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  flex: 1;
}

.hm-flash-card {
  border-left: 1px solid var(--border2);
  padding: 16px 12px;
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  transition: background 0.2s;
}

.hm-flash-card:hover {
  background: #fafafa;
}

.hm-flash-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hm-flash-badge {
  background: var(--red);
  color: #fff;
  font-size: 9px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 700;
  opacity: 0.92;
}

.hm-flash-heart {
  font-size: 18px;
  color: #ccc;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.hm-flash-heart:hover {
  color: var(--red);
}

.hm-flash-card-img-wrap {
  width: 100%;
  aspect-ratio: 1 / 1;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid var(--border2);
  border-radius: 4px;
}

.hm-flash-card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hm-flash-card-name {
  font-family: inherit;
  font-weight: 300;
  font-size: 13px;
  line-height: 1.4;
  text-align: center;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: calc(13px * 1.4 * 2);
}

.hm-flash-price-row {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
}

.hm-price-old {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 12px;
  font-weight: 300;
  text-decoration: line-through;
  color: #888;
}

.hm-price-new {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 14px;
  font-weight: 600;
  color: var(--red2);
}

.hm-flash-underline {
  height: 1px;
  background: #000;
  margin: 0 auto;
  width: 70%;
}

.hm-flash-btn {
  display: block;
  width: 100%;
  margin-top: auto;
  padding: 7px 0;
  background: #fdfdfd;
  border: 1px solid #000;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  text-align: center;
  transition: all 0.2s;
}

.hm-flash-btn:hover {
  background: #000;
  color: #fff;
}

/* ==================== CTA SECTION ==================== */
.hm-cta-section {
  position: relative;
  width: 100%;
  height: 540px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.hm-cta-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hm-cta-overlay {
  position: absolute;
  inset: 0;
  background: #5e4f4e;
  mix-blend-mode: multiply;
  opacity: 0.85;
}

.hm-cta-content {
  position: relative;
  z-index: 10;
  text-align: center;
  color: #fff;
  max-width: 680px;
  padding: 0 24px;
}

.hm-cta-title {
  font-family: inherit;
  font-size: 42px;
  font-weight: 500;
  margin-bottom: 24px;
}

.hm-cta-desc {
  font-size: 20px;
  line-height: 1.8;
  font-weight: 300;
  margin-bottom: 40px;
  color: rgba(255, 255, 255, 0.9);
}

.hm-cta-btn {
  display: inline-block;
  padding: 16px 48px;
  border: 1.5px solid #fff;
  color: #fff;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s;
  font-family: inherit;
}

.hm-cta-btn:hover {
  background: #fff;
  color: #000;
}

/* ==================== DỊCH VỤ MỚI ==================== */
.hm-services-section {
  background: #fff;
  padding: 56px 0 48px;
}

.hm-section-title {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 28px;
  text-transform: capitalize;
  text-align: center;
  margin-bottom: 40px;
  font-weight: 500;
  letter-spacing: 0px;
}

.hm-svc-row {
  display: grid;
  gap: 24px;
  max-width: 1280px;
  margin: 0 auto 32px;
  padding: 0 32px;
}

.hm-svc-row-3 {
  grid-template-columns: 2fr 1fr 1fr;
  align-items: stretch;
}

.hm-svc-row-2 {
  grid-template-columns: 1fr 1fr;
}

.hm-svc-big {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  /* Removed height and min-height so it adapts to grid naturally without forcing it */
}

.hm-svc-big-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
  display: block;
}

.hm-svc-big:hover .hm-svc-big-img {
  transform: scale(1.04);
}

.hm-svc-big-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, transparent 60%);
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 28px 24px;
  color: #fff;
}

.hm-svc-big-name {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 8px;
}

.hm-svc-big-price {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 18px;
  margin-bottom: 14px;
}

.hm-svc-big-btn {
  align-self: flex-start;
  padding: 8px 22px;
  background: transparent;
  border: 1px solid #fff;
  color: #fff;
  font-size: 12px;
  text-transform: uppercase;
  cursor: pointer;
  transition: all 0.2s;
}

.hm-svc-big-btn:hover {
  background: #fff;
  color: #000;
}

.hm-svc-card {
  border: none;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: opacity 0.3s, transform 0.3s;
  background: #fdfdfd;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04);
  height: 100%;
}

.hm-svc-card-large {
  background: transparent;
  box-shadow: none;
}

.hm-svc-card:hover {
  opacity: 0.85;
  transform: translateY(-4px);
}

.hm-svc-card-img {
  width: 100%;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  object-position: center 15%;
  display: block;
  flex-shrink: 0;
}

.hm-svc-card-large .hm-svc-card-img {
  aspect-ratio: 4 / 3;
}

.hm-svc-card-body {
  padding: 24px 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 16px;
}

.hm-svc-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--red);
  font-weight: 700;
}

.hm-svc-card-name {
  font-size: 18px;
  font-weight: 600;
}

.hm-svc-card-desc {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
  margin-bottom: 12px;
}

.hm-svc-card-price {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: var(--red);
}

.hm-center {
  text-align: center;
  margin-top: 40px;
}

.hm-view-all {
  display: inline-block;
  padding: 14px 40px;
  background: transparent;
  border: 1.5px solid #000;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.hm-view-all:hover {
  background: #000;
  color: #fff;
}

/* ==================== STYLIST ==================== */
.hm-stylist-section {
  background: #fff;
  padding: 56px 40px 48px;
  border-top: 1px solid var(--border1);
}

.hm-stylist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1280px;
  margin: 0 auto 12px;
}

.hm-more-link {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 15px;
  color: var(--red);
  background: none;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}

.hm-stylist-divider {
  height: 1px;
  background: #000;
  max-width: 1280px;
  margin: 0 auto 40px;
}

.hm-stylist-marquee-container {
  max-width: 1280px;
  margin: 0 auto;
  overflow: hidden;
  position: relative;
  mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
}

.hm-stylist-marquee-track {
  display: flex;
  gap: 32px;
  width: max-content;
  animation: hm-marquee 25s linear infinite;
}

.hm-stylist-marquee-track:hover {
  animation-play-state: paused;
}

@keyframes hm-marquee {
  0% {
    transform: translateX(0);
  }

  100% {
    transform: translateX(calc(-50% - 16px));
  }
}

.hm-stylist-card {
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: box-shadow 0.3s;
}

.hm-small-card {
  width: 280px;
  min-height: 340px;
}

.hm-stylist-card:hover {
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14);
}

.hm-stylist-photo-wrap {
  width: 100%;
  height: 220px;
  overflow: hidden;
  flex-shrink: 0;
}

.hm-stylist-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.hm-stylist-card:hover .hm-stylist-photo {
  transform: scale(1.04);
}

.hm-stylist-info {
  padding: 16px 12px;
  text-align: center;
  width: 100%;
}

.hm-stylist-label {
  font-size: 10px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.hm-stylist-name {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 18px;
  text-transform: capitalize;
  margin: 6px 0 4px;
}

.hm-stylist-stars {
  font-size: 20px;
  color: #f59e0b;
  letter-spacing: 3px;
  margin: 4px 0;
}

.hm-star {
  color: #f59e0b;
}

.hm-star-empty {
  color: #ccc;
}

.hm-stylist-role {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ==================== SHOP / SẢN PHẨM ==================== */
/* ==================== BANNER SHOP ==================== */
.hm-banner-shop {
  width: 100%;
  margin: 0 auto;
}

.hm-banner-shop-inner {
  position: relative;
  width: 100%;
  overflow: hidden;
  display: flex;
}

.hm-banner-shop-img {
  width: 100%;
  height: auto;
  object-fit: cover;
  display: block;
}

.hm-banner-shop-content {
  position: absolute;
  top: 50%;
  right: 10%;
  transform: translateY(-50%);
  max-width: 500px;
  text-align: left;
  color: #222;
}

.hm-banner-shop-title {
  font-size: 36px;
  font-weight: 400;
  margin-bottom: 16px;
  letter-spacing: 1px;
  text-transform: uppercase;
}

.hm-banner-shop-desc {
  font-size: 16px;
  font-weight: 400;
  color: #555;
  line-height: 1.6;
}

/* ==================== CỬA HÀNG ==================== */
.hm-shop-section {
  background: #fff;
  padding: 32px 32px 48px;
}

.hm-prod-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
  max-width: 1320px;
  margin: 0 auto;
}

.hm-prod-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 24px;
  border: 1px solid #f0f0f0;
  padding: 12px;
  transition: box-shadow 0.3s;
}

.hm-prod-card:hover {
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
}

.hm-prod-img-wrap {
  position: relative;
  width: 100%;
  border-radius: 16px;
  overflow: hidden;
  height: 260px;
  background: #f5f5f5;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.hm-prod-badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 5;
  background: rgba(10, 10, 10, 0.8);
  color: #bfa77a;
  font-size: 9px;
  font-weight: 700;
  padding: 4px 10px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

.hm-prod-wish {
  position: absolute;
  top: 14px;
  right: 14px;
  z-index: 5;
  background: none;
  border: none;
  font-size: 22px;
  color: #ccc;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.hm-prod-wish:hover {
  color: var(--red);
}

.hm-prod-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s;
}

.hm-prod-card:hover .hm-prod-img {
  transform: scale(1.05);
}

.hm-prod-info {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 4px;
}

.hm-prod-stars {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  margin-bottom: -2px;
}

.hm-prod-review-count {
  font-size: 11px;
  color: var(--gray-text);
  font-family: inherit;
}

.hm-prod-name {
  font-family: inherit;
  font-weight: 500;
  font-size: 16px;
  text-align: left;
  line-height: 1.4;
  color: #111;
}

.hm-prod-price-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.hm-prod-price {
  font-family: inherit;
  font-size: 20px;
  font-weight: 600;
  color: #000;
}

.hm-prod-add {
  padding: 6px 14px;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 20px;
  font-family: inherit;
  font-weight: 500;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.hm-prod-add:hover {
  background: #333;
}

.hm-prod-empty {
  text-align: center;
  padding: 64px 0;
  color: #999;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.hm-prod-empty button {
  margin-top: 12px;
  padding: 10px 24px;
  background: none;
  border-bottom: 1px solid #000;
  cursor: pointer;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Skeleton */
.hm-prod-skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hm-skel-img {
  width: 100%;
  height: 280px;
  border-radius: 30px;
  background: var(--gray-fill);
  animation: hm-shimmer 1.5s infinite linear;
}

.hm-skel-line {
  height: 14px;
  background: var(--gray-fill);
  border-radius: 4px;
  animation: hm-shimmer 1.5s infinite linear;
}

.hm-skel-short {
  width: 60%;
}

@keyframes hm-shimmer {
  0% {
    opacity: 1;
  }

  50% {
    opacity: 0.4;
  }

  100% {
    opacity: 1;
  }
}

/* ==================== SEARCH BAR SẢN PHẨM ==================== */
.hm-search-wrap {
  display: flex;
  justify-content: center;
  margin: 0 0 40px 0;
}

.hm-search-bar {
  display: flex;
  align-items: center;
  width: 100%;
  max-width: 520px;
  border-bottom: 1.5px solid #111;
  padding-bottom: 10px;
  gap: 8px;
}

.hm-search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 13px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #111;
  caret-color: #111;
}

.hm-search-input::placeholder {
  color: #999;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.hm-search-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #111;
  display: flex;
  align-items: center;
  padding: 0;
  transition: opacity 0.2s;
}

.hm-search-btn:hover {
  opacity: 0.6;
}


.hm-xem-them {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 20px 64px;
  background: #fff;
  color: #000;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 22px;
  text-transform: capitalize;
  border: 1.5px solid #000;
  border-radius: 40px;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.hm-xem-them:hover {
  background: #f5f5f5;
}

/* ==================== TESTIMONIAL ==================== */
.hm-testimonial-section {
  display: flex;
  align-items: stretch;
  min-height: 420px;
  background: #fff;
  border-top: 1px solid var(--border1);
}

.hm-testimonial-img-wrap {
  flex: 0 0 460px;
  overflow: hidden;
  border-radius: 6px;
  margin: 40px 24px 40px 40px;
}

.hm-testimonial-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hm-testimonial-card {
  flex: 1;
  background: #fafafa;
  margin: 40px 40px 40px 0;
  padding: 48px 56px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.hm-test-stars {
  font-size: 18px;
  color: #f59e0b;
  letter-spacing: 4px;
}

.hm-test-quote {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 18px;
  font-weight: 300;
  line-height: 1.6;
  color: #222;
  flex: 1;
}

.hm-test-author-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  border-top: 1px solid #ddd;
  padding-top: 20px;
}

.hm-test-name {
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-weight: 300;
  font-size: 14px;
  text-transform: capitalize;
}

.hm-test-role {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-top: 2px;
}

.hm-test-tag {
  display: inline-block;
  padding: 4px 14px;
  border: 1px solid #000;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  font-size: 12px;
  font-weight: 300;
}

.hm-test-nav {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.hm-test-nav-btn {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 1.5px solid #000;
  background: #fff;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  color: #000;
}

.hm-test-nav-btn:hover {
  background: #000;
  color: #fff;
}

/* ==================== CLUB / NEWSLETTER ==================== */
.hm-club-section {
  background: #000;
  color: #fff;
  padding: 72px 24px;
  position: relative;
  overflow: hidden;
  text-align: center;
}

.hm-club-deco {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 500px;
  height: 500px;
  border: 1px solid rgba(191, 167, 122, 0.2);
  border-radius: 50%;
  animation: pulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes pulse {

  0%,
  100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.5
  }

  50% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 0.3
  }
}

.hm-club-inner {
  position: relative;
  z-index: 10;
  max-width: 600px;
  margin: 0 auto;
}

.hm-club-label {
  font-size: 11px;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #bfa77a;
  margin-bottom: 16px;
  font-weight: 600;
}

.hm-club-title {
  font-size: 32px;
  font-weight: 700;
  text-transform: uppercase;
  margin-bottom: 20px;
  letter-spacing: 0.04em;
}

.hm-club-desc {
  font-size: 14px;
  font-weight: 300;
  color: #aaa;
  line-height: 1.7;
  margin-bottom: 40px;
}

.hm-club-form {
  display: flex;
  gap: 0;
  max-width: 440px;
  margin: 0 auto;
}

.hm-club-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  padding: 14px 20px;
  font-size: 12px;
  letter-spacing: 0.1em;
  outline: none;
  transition: border-color 0.3s;
}

.hm-club-input:focus {
  border-color: #bfa77a;
}

.hm-club-submit {
  padding: 14px 28px;
  background: #bfa77a;
  color: #000;
  border: none;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.hm-club-submit:hover {
  background: #fff;
}

/* ==================== RESPONSIVE ==================== */

/* ---- 1400px+: giữ layout tối đa không bị giãn quá rộng ---- */
@media (min-width: 1400px) {
  .hm-hero {
    height: 600px;
  }

  .hm-hero-content {
    padding: 0 120px;
    max-width: 720px;
  }
}

/* ---- Tablet lớn / Desktop thu nhỏ: 1025px – 1280px ---- */
@media (max-width: 1280px) {
  .hm-hero-content {
    padding: 0 60px;
  }

  .hm-hero-title {
    font-size: 40px;
  }

  .hm-svc-row {
    padding: 0 24px;
  }

  .hm-prod-grid {
    gap: 20px;
  }

  .hm-flash-section {
    margin: 16px 24px 48px;
  }
}

/* ---- Tablet: 769px – 1024px ---- */
@media (max-width: 1024px) {

  /* Hero */
  .hm-hero {
    height: 420px;
  }

  .hm-hero-content {
    padding: 0 48px;
  }

  .hm-hero-title {
    font-size: 36px;
  }

  .hm-hero-desc {
    font-size: 14px;
  }

  /* Danh mục */
  .hm-category-inner {
    grid-template-columns: repeat(4, 1fr);
  }

  /* Flash Sale */
  .hm-flash-left {
    display: none;
  }

  .hm-flash-vline {
    display: none;
  }

  .hm-flash-cards {
    grid-template-columns: repeat(4, 1fr);
  }

  /* Dịch vụ */
  .hm-svc-row {
    padding: 0 20px;
    gap: 16px;
  }

  .hm-svc-row-3 {
    grid-template-columns: 1fr 1fr 1fr;
  }

  /* Sản phẩm */
  .hm-prod-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
  }

  /* Testimonial */
  .hm-testimonial-img-wrap {
    flex: 0 0 280px;
  }

  /* Stylist */
  .hm-stylist-section {
    padding: 40px 24px 36px;
  }
}

/* ---- Mobile lớn / Tablet nhỏ: 577px – 768px ---- */
@media (max-width: 768px) {

  /* Hero */
  .hm-hero {
    height: 360px;
  }

  .hm-hero-content {
    padding: 32px 28px;
    max-width: 100%;
  }

  .hm-hero-title {
    font-size: 28px;
  }

  .hm-hero-desc {
    font-size: 13px;
    max-width: 100%;
  }

  .hm-hero-cta {
    gap: 10px;
  }

  .hm-btn-primary,
  .hm-btn-outline {
    padding: 12px 22px;
    font-size: 10px;
  }

  /* Danh mục */
  .hm-category-inner {
    grid-template-columns: repeat(2, 1fr);
  }

  .hm-cat-card {
    min-height: 140px;
  }

  /* Flash Sale */
  .hm-flash-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .hm-flash-section {
    margin: 16px 12px 32px;
    border-radius: 16px;
  }

  /* CTA */
  .hm-cta-section {
    height: 400px;
  }

  .hm-cta-title {
    font-size: 28px;
  }

  .hm-cta-desc {
    font-size: 15px;
  }

  /* Dịch vụ */
  .hm-svc-row {
    padding: 0 16px;
    gap: 12px;
  }

  .hm-svc-row-3 {
    grid-template-columns: 1fr;
  }

  .hm-svc-row-2 {
    grid-template-columns: 1fr;
  }

  .hm-svc-big {
    min-height: 280px;
  }

  /* Sản phẩm */
  .hm-prod-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }

  .hm-prod-img-wrap {
    height: 200px;
  }

  .hm-prod-name {
    font-size: 13px;
  }

  .hm-prod-price {
    font-size: 15px;
  }

  /* Stylist */
  .hm-stylist-section {
    padding: 32px 16px 28px;
  }

  .hm-small-card {
    width: 220px;
    min-height: 280px;
  }

  .hm-stylist-photo-wrap {
    height: 170px;
  }

  /* Testimonial */
  .hm-testimonial-section {
    flex-direction: column;
  }

  .hm-testimonial-img-wrap {
    flex: none;
    height: 220px;
    margin: 20px 16px 0;
  }

  .hm-testimonial-card {
    margin: 0 16px 20px;
    padding: 28px 20px;
  }

  .hm-test-quote {
    font-size: 15px;
  }

  /* Newsletter */
  .hm-club-section {
    padding: 48px 16px;
  }

  .hm-club-form {
    flex-direction: column;
  }

  .hm-club-title {
    font-size: 22px;
  }

  /* Xem thêm */
  .hm-xem-them {
    font-size: 16px;
    padding: 14px 40px;
  }
}

/* ---- Mobile nhỏ: ≤480px ---- */
@media (max-width: 480px) {

  /* Hero */
  .hm-hero {
    height: 300px;
  }

  .hm-hero-content {
    padding: 20px 18px;
  }

  .hm-hero-title {
    font-size: 22px;
  }

  .hm-hero-subtitle {
    font-size: 9px;
    letter-spacing: 0.25em;
  }

  .hm-hero-desc {
    display: none;
  }

  .hm-btn-primary,
  .hm-btn-outline {
    padding: 10px 16px;
    font-size: 9px;
  }

  /* Danh mục */
  .hm-category-inner {
    grid-template-columns: repeat(2, 1fr);
  }

  .hm-cat-card {
    min-height: 110px;
    padding: 16px 10px;
  }

  .hm-cat-num {
    font-size: 20px;
  }

  .hm-cat-title {
    font-size: 10px;
  }

  /* Flash Sale */
  .hm-flash-cards {
    grid-template-columns: repeat(2, 1fr);
  }

  .hm-flash-section {
    margin: 12px 8px 24px;
  }

  /* Sản phẩm */
  .hm-prod-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .hm-prod-img-wrap {
    height: 160px;
    border-radius: 12px;
  }

  .hm-prod-card {
    border-radius: 16px;
    padding: 8px;
  }

  .hm-prod-name {
    font-size: 12px;
  }

  .hm-prod-price {
    font-size: 13px;
  }

  .hm-prod-add {
    padding: 5px 10px;
    font-size: 10px;
  }

  /* Stylist */
  .hm-small-card {
    width: 180px;
    min-height: 240px;
  }

  .hm-stylist-photo-wrap {
    height: 140px;
  }

  .hm-stylist-name {
    font-size: 14px;
  }

  /* Testimonial */
  .hm-testimonial-img-wrap {
    height: 180px;
    margin: 16px 12px 0;
  }

  .hm-testimonial-card {
    margin: 0 12px 16px;
    padding: 20px 16px;
  }

  .hm-test-quote {
    font-size: 13px;
  }

  .hm-test-author-row {
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
}
</style>
