<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { 
  Clock, 
  Tag, 
  Sparkles, 
  Gift, 
  Award, 
  HelpCircle, 
  ChevronDown, 
  Check, 
  Copy, 
  Calendar, 
  ArrowRight,
  Info,
  UserCheck
} from 'lucide-vue-next';

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const vouchers = ref<any[]>([]);
const vouchersLoading = ref(true);
const activeTab = ref<'vouchers' | 'membership'>('vouchers');
const activeFaq = ref<number | null>(null);

const fetchVouchers = async () => {
  try {
    const userStr = localStorage.getItem('user');
    let maKh = '';
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        maKh = user.maKH || user.maKh || user.id || '';
      } catch (e) {}
    }
    const res = await axios.get(`${API}/api/Voucher/available`, { params: { maKh } });
    vouchers.value = res.data || [];
  } catch (err) {
    console.error('Lỗi lấy dữ liệu voucher:', err);
  } finally {
    vouchersLoading.value = false;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return 'Không thời hạn';
  const date = new Date(dateString);
  return date.toLocaleDateString('vi-VN');
};

onMounted(() => {
  fetchVouchers();
});

const collectVoucher = async (v: any) => {
  if (v.isCollected) {
    navigator.clipboard.writeText(v.maCode);
    alert('Đã sao chép mã: ' + v.maCode);
    return;
  }

  const userStr = localStorage.getItem('user');
  if (!userStr) {
    alert('Vui lòng đăng nhập để lưu mã giảm giá.');
    return;
  }

  let maKh = '';
  try {
    const user = JSON.parse(userStr);
    maKh = user.maKH || user.maKh || user.id || '';
  } catch (e) {}

  if (!maKh) {
    alert('Vui lòng đăng nhập bằng tài khoản Khách Hàng để lưu mã. (Tài khoản Admin không thể lưu mã cá nhân)');
    return;
  }

  try {
    const res = await axios.post(`${API}/api/Voucher/collect`, { maKh, maCode: v.maCode });
    if (res.data.success || res.data.message) {
      alert('Lưu mã thành công! Bạn có thể sử dụng mã này khi thanh toán.');
      v.isCollected = true;
    }
  } catch (err: any) {
    if (err.response?.data?.message) {
      alert(err.response.data.message);
    } else {
      alert('Có lỗi xảy ra khi lưu mã.');
    }
  }
};

// Mock data for Salon Service Promotions
const salonPromos = ref([
  {
    id: 1,
    title: 'Combo Premium Hair Glow',
    subtitle: 'Tỏa sáng toàn diện',
    desc: 'Bao gồm Cắt tạo kiểu + Gội massage thảo dược + Phục hồi tóc Keratin Nano Hàn Quốc giúp tóc bóng mượt tức thì.',
    price: '399.000đ',
    originalPrice: '650.000đ',
    discount: '-38%',
    badge: 'Hot Deal',
    image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=600&q=80',
    conditions: 'Áp dụng cho mọi độ dài tóc từ Thứ 2 - Thứ 6.'
  },
  {
    id: 2,
    title: 'Happy Hour - Khung Giờ Vàng',
    subtitle: 'Ưu đãi giờ thấp điểm',
    desc: 'Giảm ngay 15% trên tổng hóa đơn cho khách hàng đặt lịch và sử dụng dịch vụ từ 9:00 - 11:30 sáng hằng ngày.',
    price: 'Giảm 15%',
    originalPrice: '',
    discount: 'Giờ Vàng',
    badge: 'Mỗi Ngày',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=600&q=80',
    conditions: 'Không áp dụng kèm các chương trình khuyến mãi khác.'
  },
  {
    id: 3,
    title: 'Color Trend - Nhuộm Đẹp Chuẩn Salon',
    subtitle: 'Xu hướng tóc mới nhất',
    desc: 'Nhuộm tóc thời trang (Goldwell/L\'Oréal) tặng kèm một buổi phủ bóng Nano khóa màu trị giá 400.000đ.',
    price: 'Từ 600.000đ',
    originalPrice: '900.000đ',
    discount: 'Tặng Quà',
    badge: 'Bán Chạy',
    image: 'https://images.unsplash.com/photo-1605497746444-ac9da58d456a?auto=format&fit=crop&w=600&q=80',
    conditions: 'Áp dụng khi đặt lịch trước qua Website hoặc Fanpage.'
  }
]);

// Mock data for Membership privileges
const memberTiers = ref([
  {
    name: 'Hạng Đồng',
    enName: '(Bronze Member)',
    colorClass: 'from-[#cd7f32] via-[#a66324] to-[#704214] border-[#cd7f32]/40',
    textGold: 'text-[#ffefe3]',
    req: 'Khách hàng mới / Tích lũy dưới 2.000.000đ',
    benefits: [
      'Tích lũy 1% giá trị hóa đơn cho mỗi lần sử dụng dịch vụ.',
      'Nhận ưu đãi bất ngờ vào các dịp đặc biệt.',
      'Nhận thông báo sớm nhất về các chương trình khuyến mãi.'
    ]
  },
  {
    name: 'Hạng Bạc',
    enName: '(Silver Member)',
    colorClass: 'from-[#9ca3af] via-[#6b7280] to-[#374151] border-[#9ca3af]/40',
    textGold: 'text-[#f3f4f6]',
    req: 'Tích lũy từ 2.000.000đ',
    benefits: [
      'Giảm trực tiếp 5% cho tất cả các dịch vụ cắt, gội, sấy.',
      'Tặng gói hấp dầu phục hồi vào tháng sinh nhật.',
      'Ưu tiên đặt lịch hẹn trước.'
    ]
  },
  {
    name: 'Hạng Vàng',
    enName: '(Gold Member)',
    colorClass: 'from-[#d4af37] via-[#b8860b] to-[#8a6300] border-[#d4af37]/40',
    textGold: 'text-[#fffdf5]',
    req: 'Tích lũy từ 5.000.000đ',
    benefits: [
      'Giảm trực tiếp 10% toàn bộ dịch vụ và sản phẩm chăm sóc tóc.',
      'Miễn phí 1 lần gội massage thảo dược mỗi tháng.',
      'Tặng voucher trị giá 300.000đ vào ngày sinh nhật.',
      'Phục vụ nước uống miễn phí từ menu đặc biệt tại Salon.'
    ]
  },
  {
    name: 'Hạng Kim Cương',
    enName: '(Diamond Member)',
    colorClass: 'from-[#020617] via-[#06b6d4] to-[#020617] border-[#06b6d4]/50 shadow-[0_0_30px_rgba(6,182,212,0.3)] ring-1 ring-cyan-300/30',
    textGold: 'text-[#cffafe]',
    req: 'Tích lũy từ 15.000.000đ',
    benefits: [
      'Giảm trực tiếp 15% toàn bộ hóa đơn dịch vụ & sản phẩm.',
      'Ưu tiên phục vụ tại phòng VIP riêng tư (nếu có yêu cầu).',
      'Miễn phí đi kèm 1 người thân gội đầu dưỡng sinh mỗi quý.',
      'Quà tặng hộp sản phẩm chăm sóc tóc cao cấp L\'Oréal trị giá 1.500.000đ dịp cuối năm.',
      'Đường dây nóng hỗ trợ đặt lịch khẩn cấp 24/7.'
    ]
  }
]);

// Mock FAQs
const faqs = ref([
  {
    q: 'Làm thế nào để thu thập và áp dụng mã giảm giá trực tuyến?',
    a: 'Bạn chỉ cần đăng nhập tài khoản khách hàng trên website, truy cập trang Khuyến Mãi và nhấn nút "Lưu mã". Khi tiến hành thanh toán dịch vụ hoặc đặt lịch, hệ thống sẽ tự động hiển thị các voucher khả dụng trong kho của bạn để áp dụng giảm giá trực tiếp.'
  },
  {
    q: 'Các chương trình ưu đãi dịch vụ tại Salon có cần lưu mã trước không?',
    a: 'Đối với mục "Ưu đãi dịch vụ", đây là các chương trình áp dụng trực tiếp tại tiệm. Bạn không cần lưu mã trực tuyến, chỉ cần đặt lịch hẹn trước qua website hoặc thông báo với nhân viên lễ tân khi đến để được áp dụng ngay.'
  },
  {
    q: 'Tôi có thể cộng dồn nhiều voucher cho một lần thanh toán không?',
    a: 'Theo quy định chung, mỗi hóa đơn thanh toán chỉ áp dụng tối đa một mã voucher giảm giá. Tuy nhiên, bạn vẫn được hưởng ưu đãi giảm giá trực tiếp từ hạng thành viên (nếu có) cộng thêm cùng với voucher.'
  },
  {
    q: 'Làm thế nào để tôi thăng hạng thành viên?',
    a: 'Hệ thống sẽ tự động tích lũy chi tiêu của bạn dựa trên số điện thoại/tài khoản sau mỗi lần sử dụng dịch vụ hoặc mua sản phẩm tại Salon. Khi đạt mức tích lũy yêu cầu (Bạc: 2Tr, Vàng: 5Tr, Kim Cương: 15Tr), tài khoản của bạn sẽ tự động thăng hạng.'
  }
]);

const toggleFaq = (index: number) => {
  if (activeFaq.value === index) {
    activeFaq.value = null;
  } else {
    activeFaq.value = index;
  }
};
</script>

<template>
  <div class="min-h-screen bg-white font-sans pb-24 text-neutral-800">

    <!-- Main Navigation Tabs -->
    <div class="sticky top-0 z-30 bg-white border-b border-neutral-200 shadow-sm">
      <div class="max-w-[1280px] mx-auto px-6">
        <div class="flex justify-center md:justify-start space-x-8 overflow-x-auto py-4 scrollbar-none">
          <button 
            @click="activeTab = 'vouchers'" 
            :class="[
              'pb-2 text-xs md:text-sm font-semibold tracking-widest uppercase border-b-2 transition-all duration-300 whitespace-nowrap flex items-center gap-2',
              activeTab === 'vouchers' ? 'border-black text-black' : 'border-transparent text-neutral-400 hover:text-neutral-800'
            ]"
          >
            <Gift class="w-4 h-4" />
            Mã Giảm Giá Online
          </button>

          <button 
            @click="activeTab = 'membership'" 
            :class="[
              'pb-2 text-xs md:text-sm font-semibold tracking-widest uppercase border-b-2 transition-all duration-300 whitespace-nowrap flex items-center gap-2',
              activeTab === 'membership' ? 'border-black text-black' : 'border-transparent text-neutral-400 hover:text-neutral-800'
            ]"
          >
            <Award class="w-4 h-4" />
            Đặc Quyền Thành Viên
          </button>

        </div>
      </div>
    </div>

    <!-- Page Content Container -->
    <div class="max-w-[1440px] mx-auto px-4 lg:px-8 py-12 md:py-16">
      

      <!-- Tab 1: Claimable Vouchers -->
      <div v-if="activeTab === 'vouchers'">
        <div class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p class="text-xs uppercase text-neutral-400 tracking-widest font-semibold mb-1">Mã ưu đãi trực tuyến</p>
            <h2 class="text-2xl md:text-3xl font-semibold tracking-wide text-neutral-900">Sưu tầm mã giảm giá</h2>
          </div>
          <p class="text-neutral-500 text-xs md:text-sm max-w-md">
            Lưu trực tiếp mã ưu đãi vào ví tài khoản của bạn để áp dụng nhanh chóng khi đặt lịch hẹn dịch vụ hoặc mua sắm sản phẩm.
          </p>
        </div>

        <div v-if="vouchersLoading" class="flex flex-col items-center justify-center py-20">
          <div class="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
          <p class="text-neutral-400 text-xs tracking-wider uppercase animate-pulse">Đang tải mã giảm giá...</p>
        </div>

        <div v-else-if="vouchers.length === 0" class="text-center py-16 bg-white border border-neutral-200 rounded-2xl shadow-sm max-w-xl mx-auto flex flex-col items-center px-8">
          <div class="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4 text-neutral-400">
            <Gift class="w-8 h-8" />
          </div>
          <p class="text-neutral-800 font-semibold mb-1">Chưa có Mã Giảm Giá trực tuyến khả dụng</p>
          <p class="text-neutral-400 text-xs leading-relaxed max-w-sm mb-6">
            Hệ thống hiện không có mã voucher trực tiếp nào. Vui lòng quay lại sau.
          </p>
        </div>

        <!-- Vouchers Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <div 
            v-for="v in vouchers" 
            :key="v.maCode" 
            class="relative flex bg-white rounded-2xl overflow-hidden border border-neutral-200 shadow-sm hover:shadow-lg transition-all duration-500 group hover:-translate-y-1"
          >
            <!-- Left discount panel -->
            <div class="bg-black text-white flex flex-col items-center justify-center px-6 py-8 min-w-[110px] relative">
              <!-- Notch top -->
              <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-neutral-100 rounded-full border border-neutral-200 z-10"></div>
              <!-- Notch bottom -->
              <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-5 h-5 bg-neutral-100 rounded-full border border-neutral-200 z-10"></div>

              <span class="text-3xl font-black tracking-tight leading-none">
                {{ v.phanTramGiam ? `${v.phanTramGiam}%` : `${(v.soTienGiam / 1000).toLocaleString()}K` }}
              </span>
              <span class="text-[9px] tracking-widest uppercase text-white/60 mt-1.5 font-medium text-center">
                {{ v.phanTramGiam ? 'giảm ngay' : 'giảm tiền' }}
              </span>
            </div>

            <!-- Dashed divider -->
            <div class="border-l border-dashed border-neutral-300 my-4"></div>

            <!-- Right info panel -->
            <div class="flex-1 p-5 flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[10px] tracking-[0.2em] font-bold uppercase text-neutral-400">LGHair Salon</span>
                  <span class="text-[9px] border border-neutral-300 text-neutral-500 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                    {{ v.phanTramGiam ? 'Giảm %' : 'Giảm Tiền' }}
                  </span>
                </div>

                <h3 class="text-sm font-bold text-neutral-900 tracking-widest uppercase mb-1">
                  {{ v.maCode }}
                </h3>
                <p class="text-neutral-400 text-xs leading-relaxed line-clamp-2">
                  {{ v.moTa || `Áp dụng cho đơn từ ${(v.giaTriToiThieu || 0).toLocaleString()}đ` }}
                </p>
              </div>

              <!-- Bottom -->
              <div class="flex items-center justify-between mt-4 pt-4 border-t border-neutral-100">
                <div class="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-wide font-medium">
                  <Clock class="w-3 h-3" />
                  <span>{{ formatDate(v.ngayKetThuc) }}</span>
                </div>

                <button 
                  @click="collectVoucher(v)" 
                  :disabled="v.isCollected" 
                  :class="[
                    'px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded transition-all duration-300 flex items-center gap-1',
                    v.isCollected 
                      ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-default' 
                      : 'bg-black text-white hover:bg-neutral-800'
                  ]"
                >
                  <span v-if="v.isCollected" class="flex items-center gap-1">
                    <Check class="w-3 h-3" /> Đã lưu
                  </span>
                  <span v-else>Lưu mã</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 2: Salon Service Promotions (Deleted) -->
      <div v-if="false" class="space-y-10">
        <div class="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p class="text-xs uppercase text-[#b08b26] tracking-widest font-semibold mb-1">Chương trình tại Salon</p>
            <h2 class="text-2xl md:text-3xl font-playfair tracking-wide text-neutral-900">Khuyến Mãi Đang Diễn Ra</h2>
          </div>
          <p class="text-neutral-500 text-xs md:text-sm max-w-md">
            Những combo dịch vụ hấp dẫn cùng các chương trình ưu đãi đặc biệt khi sử dụng dịch vụ trực tiếp tại Salon. Không cần lưu mã!
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div 
            v-for="p in salonPromos" 
            :key="p.id"
            class="bg-white rounded-2xl overflow-hidden border border-neutral-200/80 shadow-md hover:shadow-lg transition-all duration-300 flex flex-col justify-between"
          >
            <div class="relative h-56 overflow-hidden">
              <img :src="p.image" :alt="p.title" class="w-full h-full object-cover transform hover:scale-105 transition-transform duration-700" />
              <div class="absolute top-4 left-4 bg-neutral-900/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-[9px] uppercase tracking-widest font-bold border border-white/10">
                {{ p.badge }}
              </div>
              <div class="absolute bottom-4 right-4 bg-[#dfb85b] text-neutral-950 px-3 py-1 rounded-lg text-xs font-extrabold uppercase tracking-wide shadow-md">
                {{ p.discount }}
              </div>
            </div>

            <div class="p-6 flex-1 flex flex-col justify-between bg-gradient-to-b from-white to-[#faf9f6]">
              <div>
                <p class="text-[10px] text-[#bfa77a] font-bold uppercase tracking-wider mb-1">{{ p.subtitle }}</p>
                <h3 class="text-lg font-playfair font-semibold text-neutral-900 mb-3 leading-snug">{{ p.title }}</h3>
                <p class="text-neutral-600 text-xs leading-relaxed mb-6">{{ p.desc }}</p>
              </div>

              <div>
                <!-- Pricing & Info -->
                <div class="flex items-center justify-between mb-4 bg-neutral-50 p-3 rounded-xl border border-neutral-100">
                  <div>
                    <span class="text-neutral-400 text-[10px] block uppercase font-medium">Giá Ưu Đãi</span>
                    <span class="text-base font-extrabold text-[#b08b26]">{{ p.price }}</span>
                  </div>
                  <div v-if="p.originalPrice" class="text-right">
                    <span class="text-neutral-400 text-[10px] block uppercase font-medium">Giá gốc</span>
                    <span class="text-xs text-neutral-400 line-through font-semibold">{{ p.originalPrice }}</span>
                  </div>
                </div>

                <div class="flex items-start gap-1.5 text-[10px] text-neutral-500 mb-4">
                  <Info class="w-3.5 h-3.5 text-[#bfa77a] shrink-0 mt-0.5" />
                  <span>{{ p.conditions }}</span>
                </div>

                <router-link :to="{ name: 'datdichvu' }" class="w-full block text-center bg-neutral-900 hover:bg-neutral-800 text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                  Đặt Lịch Ngay
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab 3: VIP Membership privileges -->
      <div v-if="activeTab === 'membership'" class="space-y-12">
        <div class="mb-10 text-center max-w-2xl mx-auto">
          <p class="text-xs uppercase text-[#b08b26] tracking-widest font-semibold mb-1">Đặc quyền hội viên</p>
          <h2 class="text-2xl md:text-3xl font-playfair tracking-wide text-neutral-900 uppercase">Hạng Thành Viên LGHair Privilege</h2>
          <p class="text-neutral-500 text-xs md:text-sm mt-3 leading-relaxed">
            Chúng tôi luôn trân trọng sự tin dùng của quý khách. Càng sử dụng dịch vụ nhiều, đặc quyền ưu đãi của bạn càng cao với các hạng thẻ VIP.
          </p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-4 xl:gap-6">
          <div 
            v-for="t in memberTiers" 
            :key="t.name"
            class="bg-white rounded-3xl overflow-hidden border border-neutral-200/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col"
          >
            <!-- VIP Card Graphic -->
            <div class="p-4 xl:p-5">
              <div :class="['w-full h-44 rounded-2xl bg-gradient-to-br p-4 xl:p-5 text-white flex flex-col justify-between shadow-lg border relative overflow-hidden', t.colorClass]">
                <!-- Sparkle background effects inside card -->
                <div class="absolute -right-12 -top-12 w-32 h-32 bg-white/5 rounded-full pointer-events-none"></div>
                
                <div class="flex justify-between items-start z-10">
                  <div>
                    <p class="text-[9px] uppercase tracking-[0.2em] font-medium opacity-80">LGHair Membership</p>
                    <h3 class="text-sm xl:text-base font-bold uppercase tracking-wider mt-1 leading-snug">
                      {{ t.name }}<br/>
                      <span class="text-[10px] xl:text-xs opacity-90">{{ t.enName }}</span>
                    </h3>
                  </div>
                  <Award class="w-6 h-6 text-[#ecd38e]" />
                </div>

                <div class="z-10">
                  <p class="text-[9px] uppercase tracking-widest opacity-60">Yêu cầu tích lũy</p>
                  <p class="text-xs font-semibold tracking-wider">{{ t.req }}</p>
                </div>
              </div>
            </div>

            <!-- Benefits List -->
            <div class="px-5 pb-6 pt-2 flex-1 flex flex-col justify-between">
              <div>
                <p class="text-xs font-bold text-neutral-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <UserCheck class="w-4 h-4 text-[#bfa77a]" />
                  Đặc quyền được hưởng:
                </p>
                <ul class="space-y-3.5">
                  <li 
                    v-for="(b, idx) in t.benefits" 
                    :key="idx" 
                    class="flex items-start gap-2 text-xs text-neutral-600 leading-relaxed"
                  >
                    <span class="w-1.5 h-1.5 bg-[#bfa77a] rounded-full shrink-0 mt-2"></span>
                    <span>{{ b }}</span>
                  </li>
                </ul>
              </div>

              <div class="mt-8 pt-6 border-t border-neutral-100 text-center">
                <span class="text-[10px] text-neutral-400 font-semibold uppercase tracking-widest">Tích lũy tự động qua số điện thoại</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- General Accordion FAQ Section -->
      <section class="mt-24 border-t border-neutral-200 pt-16 max-w-3xl mx-auto">
        <div class="text-center mb-12">
          <HelpCircle class="w-8 h-8 text-neutral-400 mx-auto mb-3" />
          <h2 class="text-2xl font-semibold text-neutral-900 tracking-wide">Hỏi đáp khuyến mãi</h2>
          <p class="text-neutral-400 text-xs mt-2">Giải đáp nhanh các thắc mắc về điều kiện và quy trình sử dụng ưu đãi tại hệ thống</p>
        </div>

        <div class="space-y-3">
          <div 
            v-for="(faq, idx) in faqs" 
            :key="idx" 
            class="bg-white rounded-xl border border-neutral-200 overflow-hidden transition-all duration-300"
          >
            <button 
              @click="toggleFaq(idx)" 
              class="w-full px-6 py-4 text-left flex justify-between items-center gap-4 hover:bg-neutral-50/50 transition-colors"
            >
              <span class="text-xs md:text-sm font-semibold text-neutral-800 leading-snug">{{ faq.q }}</span>
              <ChevronDown 
                :class="[
                  'w-4 h-4 text-neutral-400 transition-transform duration-300 shrink-0',
                  activeFaq === idx ? 'rotate-180 text-black' : ''
                ]" 
              />
            </button>

            <!-- Slide down content container -->
            <div 
              v-show="activeFaq === idx" 
              class="px-6 pb-5 pt-1 text-xs text-neutral-500 leading-relaxed border-t border-neutral-100"
            >
              {{ faq.a }}
            </div>
          </div>
        </div>
      </section>

    </div>
  </div>
</template>

<style scoped>
* {
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif !important;
}

.result-fade-enter-active {
  animation: resultPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
@keyframes resultPop {
  0%   { opacity: 0; transform: scale(0.85) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

/* Custom styled scrollbars hide */
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
