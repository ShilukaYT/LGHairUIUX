<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, ShoppingBag, ChevronLeft, ChevronRight, Eye } from 'lucide-vue-next';
import { useDataStore } from '@/stores/useDataStore';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

type HeroSlide = {
  id: number;
  image: string;
  alt: string;
  subtitle: string;
  title: string;
  desc: string;
  route: string;
};

type LookbookItem = {
  id: number;
  image: string;
  title: string;
  desc: string;
  recommendation: string;
  heightClass: string;
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
  title: string;
  subtitle: string;
  desc: string;
};

type Ingredient = {
  id: number;
  name: string;
  scientificName: string;
  desc: string;
  origin: string;
  benefits: string[];
  productName: string;
  productId: string;
  image: string;
};

const router = useRouter();
const dataStore = useDataStore();

const activeHeroSlide = ref<number>(0);
let heroIntervalId: number | null = null;

const heroSlides: HeroSlide[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=1400',
    alt: 'Luxury female hair campaign',
    subtitle: 'Salon Cao Cấp',
    title: 'Chăm sóc tóc nữ',
    desc: 'Khám phá dịch vụ salon và sản phẩm chăm sóc tóc dành riêng cho mái tóc hiện đại.',
    route: 'services'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=80&w=1400',
    alt: 'Glossy salon hair banner',
    subtitle: 'Sản Phẩm Thượng Hạng',
    title: 'Nâng Tầm Phong Cách',
    desc: 'Trải nghiệm bộ sưu tập sản phẩm chăm sóc tóc cao cấp được tinh tuyển bởi chuyên gia.',
    route: 'shop'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=1400',
    alt: 'Premium hair styling banner',
    subtitle: 'Trải Nghiệm Đẳng Cấp',
    title: 'Đặt lịch chăm sóc',
    desc: 'Tận hưởng không gian làm đẹp sang trọng và dịch vụ chăm sóc tóc đẳng cấp.',
    route: 'datdichvu'
  }
];

const hoveredServiceImg = ref<string | null>(null);

const serviceCollages = {
  s1: {
    main: 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=1000',
    detail1: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=600',
    detail2: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=600'
  },
  s2: {
    main: 'https://images.unsplash.com/photo-1615014664205-045388c422c5?q=80&w=1000',
    detail1: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=600',
    detail2: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=600'
  },
  s3: {
    main: 'https://images.unsplash.com/photo-1592856695076-3f2fd7dbfd82?q=80&w=1000',
    detail1: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=600',
    detail2: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=600'
  },
  s4: {
    main: 'https://images.unsplash.com/photo-1604263445414-9dd62d2ac089?q=80&w=1000',
    detail1: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=600',
    detail2: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=600'
  }
};

const activeCollage = computed(() => {
  const activeSvc = dataStore.SERVICES.find(s => s.img === hoveredServiceImg.value) || dataStore.SERVICES[0];
  if (activeSvc) {
    const realImgs = (activeSvc as any).imgs || [];
    const mainImg = realImgs[0] || activeSvc.img;
    
    // Lấy ảnh thứ 2 từ DB. Nếu dịch vụ chỉ có 1 ảnh, lấy ảnh đầu tiên của dịch vụ tiếp theo trong DB làm ảnh nhỏ để không bị trùng và không dùng ảnh mẫu.
    let detail1Img = realImgs[1];
    if (!detail1Img && dataStore.SERVICES.length > 1) {
      const activeIdx = dataStore.SERVICES.indexOf(activeSvc);
      const nextIdx = (activeIdx + 1) % dataStore.SERVICES.length;
      detail1Img = dataStore.SERVICES[nextIdx]?.img || mainImg;
    } else if (!detail1Img) {
      detail1Img = mainImg;
    }

    return {
      main: mainImg,
      detail1: detail1Img
    };
  }
  return serviceCollages.s1;
});

const productCarouselRef = ref<HTMLElement | null>(null);

const scrollCarousel = (direction: 'left' | 'right'): void => {
  if (productCarouselRef.value) {
    const scrollAmount = 350;
    productCarouselRef.value.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  }
};

const toastMessage = ref<string | null>(null);
const showToast = (message: string): void => {
  toastMessage.value = message;
  setTimeout(() => {
    if (toastMessage.value === message) {
      toastMessage.value = null;
    }
  }, 3000);
};

const formatPriceToVND = (priceVal: string | number): string => {
  if (typeof priceVal === 'number') {
    if (priceVal > 5000) {
      return priceVal.toLocaleString('vi-VN') + ' đ';
    }
    const vnd = priceVal * 25000;
    return vnd.toLocaleString('vi-VN') + ' đ';
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
      const vnd = cleanNum * 25000;
      return (priceVal.toLowerCase().includes('từ') ? 'Từ ' : '') + vnd.toLocaleString('vi-VN') + ' đ';
    }
  }
  return String(priceVal);
};

const normalizeVietnamese = (str: string): string => {
  return str.normalize('NFC');
};

const lookbookItems: LookbookItem[] = [
  {
    id: 1,
    image: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?q=80&w=800',
    title: 'Sóng lơi quyến rũ',
    desc: 'Kiểu tóc uốn lơi tự nhiên, bồng bềnh chuẩn Salon.',
    recommendation: 'Sử dụng Máy uốn hơi nước & Huyết Thanh Lụa Signature',
    heightClass: 'h-[400px]'
  },
  {
    id: 2,
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=800',
    title: 'Cắt tỉa Layer cá tính',
    desc: 'Đường cắt layer sắc sảo tạo độ phồng tự nhiên cho mái tóc.',
    recommendation: 'Sử dụng Lược tròn & Xịt Tạo Kiểu Khô',
    heightClass: 'h-[480px]'
  },
  {
    id: 3,
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=800',
    title: 'Màu nhuộm Bạch Kim Balayage',
    desc: 'Màu nhuộm đa tầng chuyển sắc mượt mà không hư tổn.',
    recommendation: 'Sử dụng Mặt Nạ Phục Hồi Tóc & Dầu Gội Cân Bằng',
    heightClass: 'h-[440px]'
  },
  {
    id: 4,
    image: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?q=80&w=800',
    title: 'Tạo kiểu Undercut lịch lãm',
    desc: 'Đường nét nam tính, giữ nếp suốt cả ngày.',
    recommendation: 'Sử dụng Gôm xịt định hình & Xịt Tạo Nếp Muối Biển',
    heightClass: 'h-[420px]'
  },
  {
    id: 5,
    image: 'https://images.unsplash.com/photo-1492106087820-71f1a00d2b11?q=80&w=800',
    title: 'Phục hồi bóng mượt Silk',
    desc: 'Mái tóc thẳng mượt như nhung, óng ả dưới mọi góc nhìn.',
    recommendation: 'Sử dụng Dầu hấp Silk & Dầu Xả Mỏng Nhẹ',
    heightClass: 'h-[460px]'
  },
  {
    id: 6,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=800',
    title: 'Uốn xoăn sóng nước',
    desc: 'Sóng tóc xoăn nhẹ nhàng tự nhiên giúp tôn lên đường nét nữ tính.',
    recommendation: 'Sử dụng Xịt Tạo Nếp Muối Biển & Huyết Thanh Lụa',
    heightClass: 'h-[400px]'
  }
];

const selectedIngredientIndex = ref<number>(0);

const ingredients: Ingredient[] = [
  {
    id: 1,
    name: 'Tinh Dầu Argan & Squalane',
    scientificName: 'Argania Spinosa & Squalane',
    desc: 'Được ép lạnh từ hạt cây Argan cổ thụ vùng Maroc kết hợp với squalane mía lên men tự nhiên. Sự kết hợp này mang lại khả năng tái tạo lớp màng lipid tóc vượt trội và làm óng thân tóc tức thì.',
    origin: 'Nhập khẩu hữu cơ từ Thung lũng Souss, Maroc',
    benefits: ['Nuôi dưỡng biểu bì tóc sâu', 'Chống xơ rối tóc lên đến 48 giờ', 'Tạo độ sáng bóng gương tự nhiên'],
    productName: 'Huyết Thanh Lụa Signature',
    productId: 'p1',
    image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800'
  },
  {
    id: 2,
    name: 'Keratin & Protein Lụa Thủy Phân',
    scientificName: 'Hydrolyzed Keratin & Silk Protein',
    desc: 'Chuỗi axit amin siêu nhỏ thu hoạch từ tơ tằm thiên nhiên Nhật Bản, có cấu trúc tương thích sinh học 98% với chất sừng tự nhiên của sợi tóc người để nhanh chóng phục hồi hư tổn cốt lõi.',
    origin: 'Sản xuất tại phòng thí nghiệm Kyoto, Nhật Bản',
    benefits: ['Lấp đầy các vết nứt gãy trên thân tóc', 'Tăng độ đàn hồi cho sợi tóc thêm 35%', 'Ngăn ngừa chẻ ngọn và đứt rụng'],
    productName: 'Mặt Nạ Phục Hồi Tóc',
    productId: 'p2',
    image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=800'
  },
  {
    id: 3,
    name: 'Tinh Thể Muối Biển & Tảo Bẹ',
    scientificName: 'Sea Kelp & Marine Minerals',
    desc: 'Khoáng chất biển sâu kết hợp chiết xuất tảo bẹ khổng lồ giúp giữ nếp sóng lơi và tạo độ phồng chân tóc hoàn hảo mà không làm mất đi độ ẩm tự nhiên của tóc.',
    origin: 'Khai thác bền vững tại vùng biển Brittany, Pháp',
    benefits: ['Tạo độ phồng chân tóc tự nhiên', 'Kháng khuẩn nhẹ cho da đầu sạch thoáng', 'Giữ nếp sóng lơi bồng bềnh lâu dài'],
    productName: 'Xịt Tạo Nếp Muối Biển',
    productId: 'p5',
    image: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=800'
  },
  {
    id: 4,
    name: 'Trà Xanh & Cỏ Đuôi Ngựa',
    scientificName: 'Camellia Sinensis & Equisetum Arvense',
    desc: 'Hợp chất EGCG dồi dào từ trà xanh hữu cơ hòa quyện cùng hàm lượng silica thực vật tự nhiên từ cây cỏ đuôi ngựa giúp thanh lọc nang tóc và kích thích mọc tóc dày dặn.',
    origin: 'Thu hoạch từ các trang trại hữu cơ Jeju, Hàn Quốc',
    benefits: ['Cân bằng lượng dầu thừa da đầu', 'Kích thích lưu thông máu thúc đẩy mọc tóc', 'Thanh lọc nang tóc khỏi hóa chất tích tụ'],
    productName: 'Dầu Gội Cân Bằng',
    productId: 'p3',
    image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=800'
  }
];

const currentIngredient = computed(() => {
  return ingredients[selectedIngredientIndex.value] || {
    id: 0,
    name: '',
    scientificName: '',
    desc: '',
    origin: '',
    benefits: [],
    productName: '',
    productId: '',
    image: ''
  };
});

const activeTestimonial = ref<number>(0);

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Lê Khánh Linh',
    role: 'Fashion Model',
    quote: 'Dịch vụ cắt tóc Signature ở đây thực sự nâng tầm khuôn mặt. Kỹ thuật tỉ mỉ, sấy tạo kiểu giữ nếp lâu và không gian vô cùng thư giãn, sang trọng.',
    rating: 5,
    service: 'Cắt Tóc Signature'
  },
  {
    id: 2,
    name: 'Trần Minh Hằng',
    role: 'Content Creator',
    quote: 'Tôi đã uốn kỹ thuật số và nhuộm Balayage tại Minh Tâm. Tóc lên màu chuẩn xác, sóng lơi mềm mại mà không hề bị khô xơ nhờ dùng kèm Huyết Thanh Lụa.',
    rating: 5,
    service: 'Nhuộm Màu & Uốn Sóng Lơi'
  },
  {
    id: 3,
    name: 'Nguyễn Thế Anh',
    role: 'Creative Director',
    quote: 'Rất ấn tượng với khu apothecary sản phẩm. Dầu gội cân bằng và mặt nạ phục hồi tóc dùng rất thích, thiết kế chai lọ tối giản rất hợp gu.',
    rating: 5,
    service: 'Chăm Sóc Tóc Nam & Boutique'
  }
];

const currentTestimonial = computed(() => {
  return testimonials[activeTestimonial.value] || {
    id: 0,
    name: '',
    role: '',
    quote: '',
    rating: 5,
    service: ''
  };
});

const pillars: Pillar[] = [
  {
    id: 1,
    title: 'Làm Sạch & Dưỡng Ẩm',
    subtitle: 'Cleansing & Conditioning',
    desc: 'Dầu gội và dầu xả chứa dưỡng chất tự nhiên giúp cân bằng bã nhờn, nuôi dưỡng nang tóc khỏe mạnh và duy trì độ ẩm mềm mượt.'
  },
  {
    id: 2,
    title: 'Phục Hồi Chuyên Sâu',
    subtitle: 'Intensive Restoration',
    desc: 'Mặt nạ phục hồi chuyên sâu tái cấu trúc sợi tóc hư tổn do uốn nhuộm hóa chất, trả lại độ đàn hồi tự nhiên từ sâu bên trong.'
  },
  {
    id: 3,
    title: 'Tạo Kiểu Chuyên Nghiệp',
    subtitle: 'Professional Styling',
    desc: 'Các dòng huyết thanh lụa, xịt tạo phồng muối biển giúp giữ nếp sóng lơi bồng bềnh, bảo vệ tóc trước nhiệt độ của máy sấy.'
  }
];

// Bespoke Apothecary Elixir Blending Lab State
type ElixirFormula = {
  concernName: string;
  desc: string;
  ingredients: Array<{ name: string; percentage: number; color: string }>;
  productName: string;
  productId: string;
  productImg: string;
  serviceName: string;
  serviceId: string;
};

const activeConcern = ref<'dry' | 'damaged' | 'flat' | 'oily'>('dry');

const apothecaryFormulas: Record<'dry' | 'damaged' | 'flat' | 'oily', ElixirFormula> = {
  dry: {
    concernName: 'Khô xơ & Mất nước',
    desc: 'Mái tóc thiếu ẩm, xơ rối dưới thời tiết và nhiệt độ cao. Tỷ lệ vàng này tập trung phục hồi lớp màng Lipid bảo vệ biểu bì tóc, cung cấp độ ẩm sâu tức thì.',
    ingredients: [
      { name: 'Tinh Dầu Argan hữu cơ', percentage: 60, color: 'bg-amber-500' },
      { name: 'Protein Lụa Thủy Phân', percentage: 30, color: 'bg-yellow-200' },
      { name: 'Tinh chất Hoa Hồng Thượng Hạng', percentage: 10, color: 'bg-rose-400' }
    ],
    productName: 'Huyết Thanh Lụa Signature',
    productId: 'p1',
    productImg: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800',
    serviceName: 'Nhuộm Màu Thiết Kế',
    serviceId: 's2'
  },
  damaged: {
    concernName: 'Hư tổn & Gãy rụng',
    desc: 'Cấu trúc keratin bị phá vỡ do hóa chất hoặc nhiệt. Công thức đậm đặc tái liên kết các sợi peptide đứt gãy, củng cố độ đàn hồi của lõi tóc từ sâu bên trong.',
    ingredients: [
      { name: 'Keratin sinh học tinh khiết', percentage: 50, color: 'bg-yellow-600' },
      { name: 'Axit Amin từ kén Tơ Tằm', percentage: 35, color: 'bg-orange-200' },
      { name: 'Chiết xuất Dầu Hạt Chùm Ngây', percentage: 15, color: 'bg-emerald-600' }
    ],
    productName: 'Mặt Nạ Phục Hồi Tóc',
    productId: 'p2',
    productImg: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?q=80&w=800',
    serviceName: 'Phục Hồi Lụa Silk',
    serviceId: 's4'
  },
  flat: {
    concernName: 'Mỏng xẹp & Thiếu sức sống',
    desc: 'Chất tóc mảnh, thiếu độ phồng chân tóc. Tỷ lệ khoáng chất biển sâu giúp định hình form sóng lơi tự nhiên mà không gây nặng tóc hay bết dính.',
    ingredients: [
      { name: 'Tinh thể Muối Biển Brittany', percentage: 45, color: 'bg-sky-400' },
      { name: 'Chiết xuất Tảo Bẹ khổng lồ', percentage: 40, color: 'bg-teal-600' },
      { name: 'Collagen thực vật mỏng nhẹ', percentage: 15, color: 'bg-emerald-200' }
    ],
    productName: 'Xịt Tạo Nếp Muối Biển',
    productId: 'p5',
    productImg: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=800',
    serviceName: 'Uốn Kỹ Thuật Số',
    serviceId: 's3'
  },
  oily: {
    concernName: 'Dầu thừa & Nang tóc yếu',
    desc: 'Da đầu tiết nhiều bã nhờn gây bít tắc nang tóc. Hợp chất thảo dược kháng khuẩn, thanh lọc bã nhờn da đầu và hỗ trợ mọc tóc dày dặn.',
    ingredients: [
      { name: 'EGCG Trà Xanh hữu cơ', percentage: 50, color: 'bg-emerald-500' },
      { name: 'Silica cỏ Đuôi Ngựa Jeju', percentage: 30, color: 'bg-green-700' },
      { name: 'Bột lá Bạc Hà làm mát', percentage: 20, color: 'bg-cyan-400' }
    ],
    productName: 'Dầu Gội Cân Bằng',
    productId: 'p3',
    productImg: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=800',
    serviceName: 'Chăm Sóc Tóc Nam',
    serviceId: 's1'
  }
};

const currentFormula = computed(() => {
  return apothecaryFormulas[activeConcern.value];
});

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

onMounted(async () => {
  heroIntervalId = window.setInterval(nextHeroSlide, 4200);

  // Fetch real services from API
  try {
    const res = await axios.get(`${API}/api/DanhSachDichVu/filter`, {
      params: {
        page: 1,
        pageSize: 4
      }
    });
    if (res.data && res.data.data && res.data.data.length > 0) {
      dataStore.SERVICES = res.data.data.map((s: any) => {
        const formatImgUrl = (url: string) => {
          if (!url) return '';
          if (url.startsWith('http')) return url;
          return url.startsWith('/') ? `${API}${url}` : `${API}/${url}`;
        };
        const mainImg = s.hinhAnh ? formatImgUrl(s.hinhAnh) : 'https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=1000';
        const rawImgs = s.hinhAnhs || [];
        const mappedImgs = rawImgs.map((img: string) => formatImgUrl(img));
        return {
          id: s.maDv,
          name: s.tenDv,
          desc: s.moTa || '',
          price: s.gia,
          duration: `${s.thoiGianLam || 30} PHÚT`,
          img: mainImg,
          imgs: mappedImgs.length > 0 ? mappedImgs : [mainImg]
        };
      });
    }
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu dịch vụ thật:", err);
  }

  // Fetch real products from API
  try {
    const resProd = await axios.get(`${API}/api/SanPham/filter`, {
      params: {
        page: 1,
        pageSize: 10
      }
    });
    if (resProd.data && resProd.data.data && resProd.data.data.length > 0) {
      // Hàm ghép URL ảnh sản phẩm — đồng bộ với Shop.vue getImageUrl()
      const getProductImageUrl = (img?: string): string => {
        if (!img) return 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800';
        if (img.startsWith('http')) return img;
        if (img.startsWith('/')) return `${API}${img}`;
        return `${API}/uploads/sanpham/${img}`;
      };

      dataStore.PRODUCTS = resProd.data.data.map((p: any) => {
        // Thử nhiều tên field ảnh mà backend có thể trả về
        const rawImg = p.hinhAnhDaiDien || p.hinhAnh || p.anhDaiDien || p.imageUrl || '';
        const prodImg = getProductImageUrl(rawImg);

        return {
          id: String(p.maSp), // Ép kiểu string để tránh lỗi TypeScript so sánh với number
          name: p.tenSp,
          desc: p.moTa || '',
          price: p.giaTu ?? p.gia ?? 0,
          img: prodImg,
          category: p.danhMuc?.tenDanhMuc || 'Boutique',
          size: p.thuongHieu?.tenThuongHieu || 'Minh Tâm'
        };
      });
    }
  } catch (err) {
    console.error("Lỗi khi tải dữ liệu sản phẩm thật:", err);
  }
});

onUnmounted(() => {
  if (heroIntervalId !== null) {
    window.clearInterval(heroIntervalId);
    heroIntervalId = null;
  }
});
</script>

<template>
  <div class="w-full bg-white text-black font-sans antialiased selection:bg-black selection:text-white">

    <!-- Floating Minimalist Toast -->
    <transition name="toast-slide">
      <div
        v-if="toastMessage"
        class="fixed bottom-8 right-8 z-50 bg-neutral-950 text-white border border-[#bfa77a]/40 px-6 py-4 flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-md"
      >
        <div class="w-1.5 h-1.5 rounded-full bg-[#bfa77a] animate-ping"></div>
        <span class="text-xs uppercase tracking-[0.2em] font-light">{{ toastMessage }}</span>
      </div>
    </transition>

    <!-- Full-screen Hero Section -->
    <section class="relative w-full h-[450px] sm:h-[500px] lg:h-[580px] bg-black text-white overflow-hidden flex items-center">
      
      <!-- Visual Background Slider -->
      <div class="absolute inset-0 w-full h-full z-0">
        <div
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          class="absolute inset-0 transition-all duration-[1200ms] ease-in-out"
          :class="[
            index === activeHeroSlide ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-105 z-0'
          ]"
        >
          <img
            :src="slide.image"
            :alt="slide.alt"
            class="w-full h-full object-cover saturate-110 contrast-105"
          />
          <!-- Moderate Overlay for balanced brightness and contrast -->
          <div class="absolute inset-0 bg-black/40"></div>
        </div>
      </div>

      <!-- Vertical Scroll Indicator -->
      <div class="absolute bottom-10 left-8 lg:left-12 flex items-center gap-4 text-neutral-400 z-20 pointer-events-none hidden md:flex">
        <span class="text-[8px] uppercase tracking-[0.3em] font-semibold [writing-mode:vertical-lr] select-none">Cuộn để khám phá</span>
        <div class="h-12 w-[1px] bg-neutral-800 relative overflow-hidden">
          <div class="absolute top-0 left-0 w-full h-1/2 bg-[#bfa77a] animate-bounce"></div>
        </div>
      </div>

      <!-- Left-aligned Content Overlay -->
      <div class="relative z-20 max-w-2xl px-8 md:px-16 lg:px-24 py-12 md:py-16 w-full">
        <div class="animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <div class="overflow-hidden mb-4">
            <p class="text-xs md:text-sm font-serif italic text-[#f9e5b5] tracking-wider">
              "Nơi kỹ nghệ kéo vàng giao thoa cùng cảm hứng thời trang đương đại."
            </p>
          </div>

          <p class="text-[11px] tracking-[0.4em] uppercase text-neutral-300 mb-6 font-semibold">
            {{ heroSlides[activeHeroSlide]?.subtitle }}
          </p>
          
          <h1 class="text-4xl md:text-5xl lg:text-6xl font-sans font-bold tracking-wide uppercase text-white mb-8 leading-tight">
            LG HAIR SALON
          </h1>

          <p class="text-sm md:text-base font-light leading-relaxed tracking-wide text-neutral-300 mb-12 max-w-lg">
            {{ heroSlides[activeHeroSlide]?.desc }}
          </p>

          <!-- Parallel Dual CTA -->
          <div class="flex flex-row flex-wrap gap-4">
            <button
              @click="goToRoute('datdichvu')"
              class="group inline-flex items-center justify-center gap-3 bg-[#bfa77a] text-black px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 hover:bg-white hover:text-black cursor-pointer shadow-md"
            >
              Đặt Lịch Cắt Tóc
              <ArrowRight :size="14" class="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
            <button
              @click="goToRoute('shop')"
              class="group inline-flex items-center justify-center gap-3 bg-transparent text-[#bfa77a] border border-[#bfa77a] px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 hover:bg-[#bfa77a] hover:text-black cursor-pointer"
            >
              Mua Sắm Sản Phẩm
              <ArrowRight :size="14" class="transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>

      <!-- Pagination Controls -->
      <div class="absolute bottom-10 right-8 lg:right-12 z-25 flex items-center gap-3">
        <button
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          @click="setHeroSlide(index)"
          class="relative h-[2px] transition-all duration-500 overflow-hidden"
          :class="index === activeHeroSlide ? 'w-16 bg-white' : 'w-8 bg-white/30 hover:bg-white/60'"
          aria-label="Go to slide"
        >
          <div 
            class="absolute top-0 left-0 h-full bg-[#bfa77a] transition-all ease-linear"
            :style="{ width: index === activeHeroSlide ? '100%' : '0%', transitionDuration: index === activeHeroSlide ? '4200ms' : '0ms' }"
          ></div>
        </button>
      </div>
    </section>

    <!-- Categories Section -->
    <section class="w-full bg-white border-b border-neutral-200">
      <div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-neutral-200">
        <div
          v-for="p in pillars"
          :key="p.id"
          @click="goToRoute('shop')"
          class="p-8 lg:p-16 flex flex-col justify-between group hover:bg-neutral-50 transition-colors duration-500 min-h-[300px] cursor-pointer"
        >
          <div>
            <span class="font-serif text-[#bfa77a] text-3xl lg:text-4xl block mb-6 font-light">0{{ p.id }}</span>
            <div class="font-heading text-lg tracking-normal uppercase text-neutral-900 mb-2 font-medium group-hover:text-[#bfa77a] transition-colors duration-300">
              {{ p.title }}
            </div>
            <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-6 font-semibold">{{ p.subtitle }}</p>
          </div>
          <p class="text-sm text-neutral-500 font-light leading-relaxed">{{ p.desc }}</p>
        </div>
      </div>
    </section>

    <!-- The Salon Experience -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white">
      <!-- Section Header -->
      <div class="flex flex-col md:flex-row justify-between items-end mb-16 md:mb-24 gap-8">
        <div class="max-w-xl">
          <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-4 font-semibold">Bản sắc độc bản</p>
          <h3 class="text-3xl md:text-4xl lg:text-5xl font-sans font-semibold tracking-wide text-black uppercase">
            Trải nghiệm Salon
          </h3>
        </div>
        <button
          @click="goToRoute('services')"
          class="group flex items-center text-[10px] uppercase tracking-[0.2em] text-black font-bold hover:text-[#bfa77a] transition-colors cursor-pointer"
        >
          Xem tất cả dịch vụ 
          <span class="ml-4 w-12 h-[1px] bg-black group-hover:w-20 group-hover:bg-[#bfa77a] transition-all duration-500"></span>
        </button>
      </div>

      <!-- Interactive Row List & Collage Image Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <!-- Interactive Row List (Left Column) -->
        <div class="lg:col-span-7 divide-y divide-neutral-200">
          <div
            v-for="(svc, index) in dataStore.SERVICES"
            :key="svc.id"
            class="group py-8 flex items-baseline justify-between cursor-pointer transition-all duration-300 hover:translate-x-2"
            @mouseenter="hoveredServiceImg = svc.img"
            @mouseleave="hoveredServiceImg = null"
            @click="router.push({ name: 'service_detail', params: { id: svc.id } })"
          >
            <div class="flex items-start gap-5">
              <span class="font-serif text-[#bfa77a] text-xs pt-1.5 font-medium select-none">0{{ index + 1 }}</span>
              <div class="flex flex-col pr-4">
                <div class="font-serif text-2xl md:text-3xl text-neutral-900 group-hover:text-[#bfa77a] transition-colors duration-300 normal-case tracking-normal font-light">
                  {{ normalizeVietnamese(svc.name) }}
                </div>
                <p class="text-xs text-neutral-400 font-light mt-2 max-w-md leading-relaxed">
                  {{ svc.desc }}
                </p>
              </div>
            </div>
            <!-- Dot leader line -->
            <div class="flex-grow border-b border-dashed border-neutral-300 mx-4 self-center group-hover:border-[#bfa77a]/60 transition-colors duration-300"></div>
            <div class="font-mono text-lg md:text-xl text-neutral-900 group-hover:text-[#bfa77a] group-hover:scale-105 transition-all duration-300 whitespace-nowrap">
              {{ formatPriceToVND(svc.price) }}
            </div>
          </div>
        </div>

        <!-- Preview Column (Right Column - Premium Collage Layout) -->
        <div class="lg:col-span-5 relative py-12 px-6 self-center">
          <!-- Interactive Collage of Overlapping Images -->
          <div class="relative w-full aspect-[4/5]">
            <!-- Background Frame Decoration -->
            <div class="absolute -inset-2 border border-[#bfa77a]/20 pointer-events-none z-0 translate-x-2 translate-y-2 transition-transform duration-700"></div>

            <!-- Big Image (Main) -->
            <div class="w-full h-full overflow-hidden bg-neutral-50 relative border border-neutral-100 z-10 shadow-2xl rounded-xl">
              <img
                :key="activeCollage.main"
                :src="activeCollage.main"
                class="w-full h-full object-cover transition-all duration-700 ease-out scale-100 animate-in fade-in duration-700"
                alt="Salon service main"
              />
              <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div class="absolute bottom-8 right-8 text-white z-20 text-right">
                <p class="text-[10px] tracking-[0.3em] uppercase text-[#bfa77a] mb-2 font-semibold">LG HAIR SALON</p>
                <p class="font-serif text-xl italic font-light">Kiệt tác sáng tạo riêng bạn</p>
              </div>
            </div>

            <!-- Small Image (Detail 1) - bottom-left corner overlapping -->
            <div class="absolute -bottom-8 -left-8 w-1/2 aspect-square z-20 border-2 border-white shadow-xl rotate-[-4deg] overflow-hidden rounded-lg hover:rotate-0 hover:scale-105 transition-all duration-500">
              <img
                :key="activeCollage.detail1"
                :src="activeCollage.detail1"
                class="w-full h-full object-cover animate-in fade-in duration-700"
                alt="Salon service detail"
              />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- The Retail Shop (Boutique Products) -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-neutral-50/30 border-t border-neutral-200">
      <!-- Section Header -->
      <div class="flex flex-col md:flex-row justify-between items-end mb-16 md:mb-24 gap-8">
        <div class="max-w-xl">
          <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-4 font-semibold">Mỹ phẩm cao cấp</p>
          <h3 class="text-3xl md:text-4xl lg:text-5xl font-sans font-semibold tracking-wide text-black uppercase">
            Sản phẩm Boutique
          </h3>
        </div>
        <div class="flex items-center gap-4">
          <button
            @click="goToRoute('shop')"
            class="text-[10px] uppercase tracking-[0.2em] text-black font-bold border-b border-black pb-1 hover:text-[#bfa77a] hover:border-[#bfa77a] transition-colors cursor-pointer"
          >
            Khám phá bộ sưu tập
          </button>
          
          <!-- Carousel controls -->
          <div class="flex gap-2 ml-4">
            <button
              @click="scrollCarousel('left')"
              class="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white hover:border-black transition-all duration-300 cursor-pointer"
              aria-label="Previous products"
            >
              <ChevronLeft :size="16" />
            </button>
            <button
              @click="scrollCarousel('right')"
              class="w-10 h-10 rounded-full border border-neutral-300 flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white hover:border-black transition-all duration-300 cursor-pointer"
              aria-label="Next products"
            >
              <ChevronRight :size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Horizontal scroll Carousel -->
      <div
        ref="productCarouselRef"
        class="flex overflow-x-auto gap-8 scroll-smooth scrollbar-hide py-4 px-1 snap-x snap-mandatory"
      >
        <div
          v-for="prod in dataStore.PRODUCTS"
          :key="prod.id"
          class="flex-shrink-0 w-[280px] sm:w-[320px] snap-start group cursor-pointer flex flex-col outline-none focus:outline-none"
          @click="router.push({ name: 'product_detail', params: { id: prod.id } })"
        >
          <!-- Minimalist product image background container matching Shop page layout -->
          <div class="aspect-[4/5] w-full bg-white overflow-hidden mb-4 relative">
            <!-- Premium product ribbon/tag -->
            <span 
              v-if="prod.id === 'p1' || prod.id === 'p2' || prod.id === 'p3' || prod.id === 'p4' || prod.id === '1' || prod.id === '2' || prod.id === '3' || prod.id === '4'"
              class="absolute top-4 left-4 z-20 bg-neutral-950/80 backdrop-blur-sm text-[#bfa77a] text-[8px] font-semibold uppercase tracking-widest px-3 py-1.5 border border-[#bfa77a]/30"
            >
              {{ (prod.id === 'p1' || prod.id === '1') ? 'Signature' : (prod.id === 'p2' || prod.id === '2') ? 'Bán Chạy' : (prod.id === 'p3' || prod.id === '3') ? 'Mới Về' : 'Thuần Chay' }}
            </span>

            <img
              :src="prod.img"
              :alt="prod.name"
              class="w-full h-full object-cover object-center block transition-all duration-700 ease-out group-hover:scale-105 saturate-110"
            />
            
            <!-- Luxury Floating Actions Overlay -->
            <div class="absolute inset-0 bg-neutral-900/15 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center gap-4 z-25">
              <button 
                @click.stop="showToast('Đã thêm ' + prod.name + ' vào giỏ hàng!');"
                class="w-12 h-12 rounded-full bg-white text-black hover:bg-[#bfa77a] hover:text-black flex items-center justify-center shadow-lg transition-all duration-300 scale-90 group-hover:scale-100 cursor-pointer"
                title="Thêm vào giỏ"
              >
                <ShoppingBag :size="16" />
              </button>
              <button 
                @click.stop="router.push({ name: 'product_detail', params: { id: prod.id } })"
                class="w-12 h-12 rounded-full bg-white text-black hover:bg-black hover:text-white flex items-center justify-center shadow-lg transition-all duration-300 scale-90 group-hover:scale-100 cursor-pointer"
                title="Xem chi tiết"
              >
                <Eye :size="16" />
              </button>
            </div>
          </div>

          <!-- Product description -->
          <div class="flex justify-between items-start">
            <div class="flex flex-col pr-4">
              <p class="text-[9px] text-[#bfa77a] font-bold uppercase tracking-[0.15em] mb-1">
                {{ prod.category }} &middot; {{ prod.size }}
              </p>
              <h4 class="font-heading text-sm tracking-wider uppercase text-neutral-900 group-hover:text-[#bfa77a] transition-colors duration-300">
                {{ prod.name }}
              </h4>
              <!-- Star rating details -->
              <div class="flex gap-0.5 text-[#bfa77a] text-[10px] mt-1 mb-1">
                <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
              </div>
              <span class="text-sm font-mono text-[#bfa77a] font-medium mt-1">
                {{ formatPriceToVND(prod.price) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Botanical Ingredients Apothecary Section (Interactive Tab Details) -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white border-t border-neutral-200">
      <div class="flex flex-col items-center text-center mb-16 md:mb-24">
        <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-4 font-semibold">Dược liệu bản địa</p>
        <h3 class="text-3xl md:text-4xl font-sans font-semibold tracking-wide text-black uppercase">
          Thành phần Tinh Túy
        </h3>
        <p class="max-w-xl text-sm font-light text-neutral-500 leading-relaxed mt-6">
          Bí quyết tạo nên sự óng ả chuẩn salon nằm ở nguồn nguyên liệu thuần chay chọn lọc, mang lại sự nuôi dưỡng tự nhiên và an toàn tuyệt đối.
        </p>
      </div>

      <!-- Interactive Tabs Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
        <!-- Ingredient Tabs (Left Column) -->
        <div class="lg:col-span-5 flex flex-col gap-4 justify-center">
          <button
            v-for="(ing, idx) in ingredients"
            :key="ing.id"
            @click="selectedIngredientIndex = idx"
            class="w-full text-left p-6 border transition-all duration-500 flex items-center gap-6 cursor-pointer"
            :class="[
              selectedIngredientIndex === idx
                ? 'bg-neutral-950 border-neutral-950 text-white shadow-xl translate-x-2'
                : 'bg-white border-neutral-200 text-neutral-800 hover:border-neutral-900 hover:translate-x-1'
            ]"
          >
            <span class="font-serif text-xs" :class="selectedIngredientIndex === idx ? 'text-[#bfa77a]' : 'text-neutral-400'">0{{ ing.id }}</span>
            <div class="flex flex-col">
              <span class="font-heading text-sm uppercase tracking-wider font-semibold">{{ ing.name }}</span>
              <span class="text-[9px] font-mono mt-1 opacity-60" :class="selectedIngredientIndex === idx ? 'text-[#bfa77a]' : 'text-neutral-500'">{{ ing.scientificName }}</span>
            </div>
          </button>
        </div>

        <!-- Selected Ingredient Detail Dashboard (Right Column) -->
        <div class="lg:col-span-7 bg-neutral-50 border border-neutral-100 p-8 lg:p-12 flex flex-col justify-between relative overflow-hidden">
          <div class="animate-in fade-in duration-500" :key="selectedIngredientIndex">
            <span class="text-[9px] uppercase tracking-widest text-[#bfa77a] font-bold block mb-2">Thông tin dược liệu</span>
            <h4 class="font-serif text-3xl font-light text-neutral-900 mb-6 border-b border-neutral-200 pb-4">
              {{ currentIngredient.name }}
            </h4>
            <p class="text-sm text-neutral-600 font-light leading-relaxed mb-6">
              {{ currentIngredient.desc }}
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <span class="text-[8px] uppercase tracking-widest text-neutral-400 font-bold block mb-1">Nguồn gốc</span>
                <span class="text-xs text-neutral-800 font-light">{{ currentIngredient.origin }}</span>
              </div>
              <div>
                <span class="text-[8px] uppercase tracking-widest text-neutral-400 font-bold block mb-2">Lợi ích nổi bật</span>
                <ul class="text-xs text-neutral-800 font-light list-disc pl-4 space-y-1">
                  <li v-for="benefit in currentIngredient.benefits" :key="benefit">{{ benefit }}</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Product Association Banner -->
          <div 
            class="mt-8 p-6 bg-white border border-neutral-200 flex items-center justify-between group cursor-pointer hover:border-[#bfa77a]/60 transition-colors"
            @click="router.push({ name: 'product_detail', params: { id: currentIngredient.productId } })"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-16 bg-neutral-50 flex items-center justify-center p-2 border border-neutral-100 flex-shrink-0">
                <img :src="currentIngredient.image" class="w-full h-full object-contain mix-blend-multiply" />
              </div>
              <div class="flex flex-col">
                <span class="text-[8px] uppercase tracking-widest text-neutral-400">Có trong sản phẩm</span>
                <span class="font-heading text-xs uppercase tracking-wider text-neutral-900 font-bold group-hover:text-[#bfa77a] transition-colors">
                  {{ currentIngredient.productName }}
                </span>
              </div>
            </div>
            <div class="w-8 h-8 rounded-full border border-neutral-200 flex items-center justify-center group-hover:bg-black group-hover:text-white transition-all duration-300">
              <ArrowRight :size="12" />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Lookbook & Synergy -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white border-t border-neutral-200">
      <!-- Section Header -->
      <div class="flex flex-col items-center text-center mb-16 md:mb-24">
        <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-4 font-semibold">Cảm hứng sáng tạo</p>
        <h3 class="text-3xl md:text-4xl font-sans font-semibold tracking-wide text-black uppercase">
          Lookbook & Phối hợp
        </h3>
        <p class="max-w-xl text-sm font-light text-neutral-500 leading-relaxed mt-6">
          Khám phá các tác phẩm tạo mẫu tóc nghệ thuật từ salon của chúng tôi, đi kèm các sản phẩm gợi ý để bạn có thể tự chăm sóc và duy trì mái tóc hoàn hảo tại nhà.
        </p>
      </div>

      <!-- Masonry Grid Layout -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div
          v-for="item in lookbookItems"
          :key="item.id"
          class="group relative overflow-hidden bg-neutral-950 flex flex-col justify-end p-8 text-white transition-all duration-500"
          :class="[item.heightClass]"
        >
          <!-- Background Image -->
          <img
            :src="item.image"
            :alt="item.title"
            class="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-[2000ms] group-hover:scale-105"
          />
          <div class="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent"></div>

          <!-- Content Overlay -->
          <div class="relative z-10 flex flex-col justify-end">
            <p class="text-[9px] tracking-[0.3em] uppercase text-[#bfa77a] mb-2 font-semibold">LOOKBOOK COLLECTION</p>
            <h4 class="font-heading text-xl md:text-2xl uppercase font-light tracking-wide mb-3">
              {{ item.title }}
            </h4>
            <p class="text-xs text-neutral-300 font-light leading-relaxed mb-4">
              {{ item.desc }}
            </p>
            <!-- Recommended Product synergy block -->
            <div class="border-t border-white/20 pt-4 flex flex-col gap-1">
              <span class="text-[8px] uppercase tracking-widest text-[#bfa77a]/80 font-bold">Sản phẩm khuyên dùng</span>
              <span class="text-[11px] text-white/95 font-light">{{ item.recommendation }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Bespoke Apothecary Elixir Customizer (Wow-Factor Interactive Lab) -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 bg-neutral-950 text-white relative overflow-hidden border-t border-neutral-900">
      <!-- Decorative background elements -->
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(191,167,122,0.08)_0%,transparent_60%)] pointer-events-none"></div>
      <div class="absolute top-1/2 left-1/4 w-[500px] h-[500px] bg-[#bfa77a]/3 rounded-full blur-[120px] pointer-events-none -translate-y-1/2"></div>

      <div class="max-w-[1200px] mx-auto relative z-10">
        <!-- Section Header -->
        <div class="text-center mb-20 max-w-2xl mx-auto">
          <p class="text-[10px] tracking-[0.2em] uppercase text-[#bfa77a] mb-4 font-semibold">Cá nhân hóa liệu trình</p>
          <h3 class="text-3xl md:text-4xl text-white font-sans font-semibold tracking-wide uppercase">
            Nghi thức Apothecary Elixir
          </h3>
          <p class="text-sm text-neutral-400 font-light leading-relaxed mt-6">
            Lựa chọn tình trạng tóc của bạn để chuyên gia Apothecary đề xuất tỷ lệ pha trộn thành phần tinh túy cùng sản phẩm đặc trị phù hợp.
          </p>
        </div>

        <!-- Dashboard Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-stretch">
          <!-- Left: Selection Tabs (4 cols) -->
          <div class="lg:col-span-4 flex flex-col justify-center gap-4">
            <h4 class="text-xs uppercase tracking-[0.25em] text-neutral-500 font-bold mb-2">Tình trạng tóc của bạn</h4>
            
            <button
              v-for="(formula, key) in apothecaryFormulas"
              :key="key"
              @click="activeConcern = key"
              class="w-full text-left p-6 border transition-all duration-500 flex items-center justify-between cursor-pointer group"
              :class="[
                activeConcern === key
                  ? 'bg-white border-white text-black shadow-2xl translate-x-2'
                  : 'bg-neutral-900/40 border-neutral-800 text-neutral-300 hover:border-[#bfa77a]/60 hover:text-white'
              ]"
            >
              <div class="flex items-center gap-4">
                <span 
                  class="w-2.5 h-2.5 rounded-full transition-all duration-500"
                  :class="[
                    activeConcern === key 
                      ? 'bg-[#bfa77a] scale-125' 
                      : 'bg-neutral-700 group-hover:bg-[#bfa77a]/60'
                  ]"
                ></span>
                <span class="font-serif text-lg font-light leading-normal">{{ normalizeVietnamese(formula.concernName) }}</span>
              </div>
              <ChevronRight :size="16" :class="activeConcern === key ? 'text-black' : 'text-neutral-600 group-hover:text-[#bfa77a]'" />
            </button>
          </div>

          <!-- Right: Visual Lab (8 cols) -->
          <div class="lg:col-span-8 bg-neutral-900/40 border border-neutral-800/80 p-8 md:p-12 shadow-2xl backdrop-blur-sm relative overflow-hidden flex flex-col justify-between">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              
              <!-- CSS Beaker Visual (5 cols) -->
              <div class="md:col-span-5 flex flex-col items-center justify-center py-6">
                <!-- Outer bottle wrapper -->
                <div class="relative w-40 h-64 border-[3px] border-neutral-700 rounded-b-[40px] rounded-t-[16px] overflow-hidden flex flex-col justify-end bg-neutral-950/80 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_0_20px_rgba(255,255,255,0.05)]">
                  <!-- Bottle Neck -->
                  <div class="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-8 border-b-[3px] border-neutral-700 z-10 bg-neutral-950"></div>
                  
                  <!-- Measurement markings -->
                  <div class="absolute left-3 top-12 bottom-8 w-2 flex flex-col justify-between text-[7px] font-mono text-neutral-600 select-none z-10">
                    <span>- 100ml</span>
                    <span>- 75ml</span>
                    <span>- 50ml</span>
                    <span>- 25ml</span>
                  </div>

                  <!-- Liquid layers filled based on active formulas -->
                  <div class="w-full h-full flex flex-col justify-end relative">
                    <!-- Dynamic bubbling effect particles -->
                    <div class="absolute inset-0 overflow-hidden pointer-events-none z-20">
                      <div class="bubble bubble-1"></div>
                      <div class="bubble bubble-2"></div>
                      <div class="bubble bubble-3"></div>
                    </div>

                    <!-- Liquid Part 3 -->
                    <div 
                      class="w-full transition-all duration-1000 ease-out relative"
                      :style="{ 
                        height: (currentFormula.ingredients[2]?.percentage || 0) + '%',
                        backgroundColor: currentFormula.ingredients[2]?.color === 'bg-rose-400' ? '#f43f5e' : currentFormula.ingredients[2]?.color === 'bg-emerald-600' ? '#059669' : currentFormula.ingredients[2]?.color === 'bg-emerald-200' ? '#a7f3d0' : '#22d3ee'
                      }"
                    >
                      <div class="absolute top-0 left-0 right-0 h-1 bg-white/20 animate-pulse"></div>
                    </div>
                    <!-- Liquid Part 2 -->
                    <div 
                      class="w-full transition-all duration-1000 ease-out relative"
                      :style="{ 
                        height: (currentFormula.ingredients[1]?.percentage || 0) + '%',
                        backgroundColor: currentFormula.ingredients[1]?.color === 'bg-yellow-200' ? '#fef08a' : currentFormula.ingredients[1]?.color === 'bg-orange-200' ? '#fed7aa' : currentFormula.ingredients[1]?.color === 'bg-teal-600' ? '#0d9488' : '#15803d'
                      }"
                    >
                      <div class="absolute top-0 left-0 right-0 h-1 bg-white/20 animate-pulse"></div>
                    </div>
                    <!-- Liquid Part 1 -->
                    <div 
                      class="w-full transition-all duration-1000 ease-out relative"
                      :style="{ 
                        height: (currentFormula.ingredients[0]?.percentage || 0) + '%',
                        backgroundColor: currentFormula.ingredients[0]?.color === 'bg-amber-500' ? '#f59e0b' : currentFormula.ingredients[0]?.color === 'bg-yellow-600' ? '#ca8a04' : currentFormula.ingredients[0]?.color === 'bg-sky-400' ? '#38bdf8' : '#10b981'
                      }"
                    >
                      <div class="absolute top-0 left-0 right-0 h-1.5 bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                </div>

                <!-- Formula ratio summary text -->
                <p class="text-[9px] font-mono uppercase tracking-[0.2em] text-[#bfa77a] mt-6 text-center">
                  Bespoke Formula: {{ activeConcern.toUpperCase() }}
                </p>
              </div>

              <!-- Composition & Product Info (7 cols) -->
              <div class="md:col-span-7 flex flex-col justify-between h-full">
                <!-- Description -->
                <div class="animate-in fade-in duration-700" :key="activeConcern">
                  <span class="text-[8px] uppercase tracking-widest text-neutral-500 font-bold block mb-2">Liệu pháp chẩn đoán</span>
                  <h4 class="font-serif text-2xl text-white mb-4 leading-snug">{{ normalizeVietnamese(currentFormula.concernName) }}</h4>
                  <p class="text-xs text-neutral-400 font-light leading-relaxed mb-6">{{ normalizeVietnamese(currentFormula.desc) }}</p>

                  <!-- Ingredients Breakdown -->
                  <div class="space-y-3 mb-6">
                    <div 
                      v-for="(ing, idx) in currentFormula.ingredients" 
                      :key="idx" 
                      class="flex items-center justify-between border-b border-neutral-800/80 pb-2"
                    >
                      <div class="flex items-center gap-2">
                        <span class="w-1.5 h-1.5 rounded-full" :class="[ing.color]"></span>
                        <span class="text-xs font-light text-neutral-300">{{ normalizeVietnamese(ing.name) }}</span>
                      </div>
                      <span class="font-mono text-xs text-[#bfa77a] font-medium">{{ ing.percentage }}%</span>
                    </div>
                  </div>
                </div>

                <!-- Product Box -->
                <div 
                  class="p-4 bg-neutral-950 border border-neutral-800 flex items-center justify-between group cursor-pointer hover:border-[#bfa77a]/60 transition-colors animate-in fade-in duration-700"
                  :key="'prod-' + activeConcern"
                  @click="router.push({ name: 'product_detail', params: { id: currentFormula.productId } })"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-14 bg-neutral-900 flex items-center justify-center p-2 border border-neutral-800 flex-shrink-0">
                      <img :src="currentFormula.productImg" class="w-full h-full object-contain mix-blend-screen" />
                    </div>
                    <div class="flex flex-col">
                      <span class="text-[8px] uppercase tracking-widest text-[#bfa77a]">Sản phẩm khuyên dùng</span>
                      <span class="font-heading text-xs uppercase tracking-wider text-white font-bold group-hover:text-[#bfa77a] transition-colors mt-0.5">
                        {{ normalizeVietnamese(currentFormula.productName) }}
                      </span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button 
                      @click.stop="showToast('Đã thêm ' + currentFormula.productName + ' vào giỏ hàng!');"
                      class="w-8 h-8 rounded-full bg-white text-black hover:bg-[#bfa77a] hover:text-black flex items-center justify-center shadow-md transition-all duration-300 scale-90 hover:scale-100 cursor-pointer"
                      title="Thêm vào giỏ"
                    >
                      <ShoppingBag :size="12" />
                    </button>
                    <div class="w-8 h-8 rounded-full border border-neutral-800 flex items-center justify-center group-hover:bg-[#bfa77a] group-hover:text-black group-hover:border-[#bfa77a] transition-all duration-300">
                      <ArrowRight :size="12" />
                    </div>
                  </div>
                </div>

                <!-- Double CTA buttons for Service + Apothecary Shop -->
                <div class="flex gap-4 mt-6">
                  <button
                    @click="router.push({ name: 'service_detail', params: { id: currentFormula.serviceId } })"
                    class="flex-1 py-3 bg-[#bfa77a] text-black text-[9px] uppercase tracking-widest font-semibold hover:bg-white transition-all duration-300 text-center cursor-pointer"
                  >
                    Đặt Lịch Liệu Trình
                  </button>
                  <button
                    @click="router.push({ name: 'product_detail', params: { id: currentFormula.productId } })"
                    class="flex-1 py-3 bg-transparent border border-neutral-700 text-white text-[9px] uppercase tracking-widest font-semibold hover:border-[#bfa77a] hover:text-[#bfa77a] transition-all duration-300 text-center cursor-pointer"
                  >
                    Chi tiết sản phẩm
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>
    </section>

    <!-- Testimonials Section -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white border-t border-neutral-200">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
        <!-- Left: Branding & Overview -->
        <div class="lg:col-span-4 flex flex-col">
          <p class="text-[10px] tracking-[0.2em] uppercase text-neutral-400 mb-4 font-semibold">Đánh giá từ khách hàng</p>
          <h3 class="text-3xl md:text-4xl font-sans font-semibold tracking-wide text-black uppercase mb-8">
            Trải nghiệm Thượng Hạng
          </h3>
          <div class="flex items-baseline gap-2">
            <span class="text-5xl font-serif text-[#bfa77a] font-light">4.9</span>
            <span class="text-neutral-400 text-sm font-light">/ 5.0 điểm tuyệt đối</span>
          </div>
          <!-- Star ratings -->
          <div class="flex gap-1 mt-3 text-[#bfa77a]">
            <span>★</span><span>★</span><span>★</span><span>★</span><span>★</span>
          </div>
        </div>

        <!-- Right: Testimonials Slider -->
        <div class="lg:col-span-8 bg-neutral-50 border border-neutral-100 p-8 md:p-16 relative overflow-hidden group">
          <!-- Quote background decoration -->
          <div class="absolute -top-10 -right-10 text-neutral-200/50 text-[180px] font-serif select-none pointer-events-none">“</div>
          
          <div class="relative z-10">
            <!-- Ratings -->
            <div class="flex gap-1 text-[#bfa77a] mb-6 text-sm">
              <span v-for="star in currentTestimonial.rating" :key="star">★</span>
            </div>
            
            <!-- Review Quote -->
            <p :key="activeTestimonial" class="font-serif text-lg md:text-2xl italic text-neutral-800 leading-relaxed font-light mb-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
              "{{ normalizeVietnamese(currentTestimonial.quote) }}"
            </p>
            
            <!-- Reviewer Info -->
            <div class="flex justify-between items-end border-t border-neutral-200/60 pt-6">
              <div>
                <h5 class="font-heading text-sm uppercase tracking-widest text-neutral-900 font-medium">
                  {{ currentTestimonial.name }}
                </h5>
                <p class="text-[10px] uppercase tracking-wider text-neutral-400 mt-1">
                  {{ currentTestimonial.role }}
                </p>
              </div>
              <div class="text-right">
                <span class="text-[9px] uppercase tracking-widest text-[#bfa77a] font-bold bg-[#bfa77a]/10 px-3 py-1 border border-[#bfa77a]/20">
                  {{ currentTestimonial.service }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Testimonial navigation controls -->
          <div class="flex gap-2 mt-8 justify-end z-10 relative">
            <button
              @click="prevTestimonial"
              class="w-8 h-8 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white hover:border-black transition-all duration-300 cursor-pointer"
              aria-label="Previous review"
            >
              <ChevronLeft :size="14" />
            </button>
            <button
              @click="nextTestimonial"
              class="w-8 h-8 rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 hover:bg-black hover:text-white hover:border-black transition-all duration-300 cursor-pointer"
              aria-label="Next review"
            >
              <ChevronRight :size="14" />
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Boutique Club (Newsletter) Section -->
    <section class="w-full py-24 bg-black text-white relative overflow-hidden border-t border-neutral-900">
      <div class="absolute inset-0 opacity-10 flex items-center justify-center pointer-events-none">
        <div class="w-[600px] h-[600px] border border-[#bfa77a] rounded-full animate-pulse"></div>
      </div>
      
      <div class="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <p class="text-[10px] tracking-[0.2em] uppercase text-[#bfa77a] mb-4 font-semibold">Minh Tâm Club</p>
        <h3 class="text-2xl md:text-4xl text-white font-sans font-semibold tracking-wide uppercase mb-8">
          Trở thành Thành Viên Thượng Hạng
        </h3>
        <p class="max-w-xl mx-auto text-sm font-light text-neutral-400 leading-relaxed mb-12">
          Đăng ký nhận bản tin để nhận những cập nhật xu hướng tóc mới nhất, cẩm nang chăm sóc tóc từ chuyên gia và quyền ưu tiên mua các bộ sưu tập giới hạn tại Apothecary.
        </p>
        
        <form @submit.prevent="showToast('Cảm ơn bạn đã gia nhập Minh Tâm Club!')" class="max-w-md mx-auto flex flex-col sm:flex-row gap-4">
          <input
            type="email"
            required
            placeholder="Địa chỉ Email của bạn..."
            class="flex-grow bg-neutral-900/60 border border-neutral-800 focus:border-[#bfa77a] px-6 py-4 text-xs tracking-widest text-white outline-none transition-colors duration-300"
          />
          <button
            type="submit"
            class="bg-[#bfa77a] text-black hover:bg-white px-8 py-4 text-[10px] font-semibold uppercase tracking-[0.2em] transition-all duration-300 cursor-pointer"
          >
            Tham Gia
          </button>
        </form>
      </div>
    </section>

  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;  /* IE and Edge */
  scrollbar-width: none;  /* Firefox */
}

/* Override all serif and heading styles to standard clean system sans-serif */
.font-serif,
.font-heading {
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
}

/* Toast Transition Animation */
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

/* Bubbling animation inside elixir beaker */
.bubble {
  position: absolute;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 50%;
  animation: float-up 4s infinite ease-in;
}
.bubble-1 {
  width: 6px;
  height: 6px;
  left: 25%;
  animation-duration: 3.5s;
  animation-delay: 0.5s;
}
.bubble-2 {
  width: 8px;
  height: 8px;
  left: 50%;
  animation-duration: 4.5s;
  animation-delay: 1.5s;
}
.bubble-3 {
  width: 4px;
  height: 4px;
  left: 70%;
  animation-duration: 3.8s;
  animation-delay: 0s;
}

@keyframes float-up {
  0% {
    transform: translateY(0) scale(1);
    opacity: 0;
  }
  10% {
    opacity: 0.6;
  }
  90% {
    opacity: 0.6;
  }
  100% {
    transform: translateY(-200px) scale(0.6);
    opacity: 0;
  }
}
</style>