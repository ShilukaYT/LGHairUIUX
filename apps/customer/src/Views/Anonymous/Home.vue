<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight } from 'lucide-vue-next';
import { useDataStore } from '@/stores/useDataStore';

type HeroSlide = {
  id: number;
  image: string;
  alt: string;
  subtitle: string;
  title: string;
  desc: string;
  route: string;
};

type HeroCategoryCard = {
  id: number;
  title: string;
  cta: string;
  routeName: string;
  image: string;
  alt: string;
  backgroundClass: string;
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
    route: 'booking'
  }
];

const heroCategoryCards: HeroCategoryCard[] = [
  {
    id: 1,
    title: "Tạo kiểu nam",
    cta: 'Đặt Lịch Ngay',
    routeName: 'services',
    image:
      'https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?auto=format&fit=crop&q=80&w=900',
    alt: 'Men haircut styling',
    backgroundClass: 'bg-gradient-to-br from-[#d8eee7] to-[#c6e4dc]'
  },
  {
    id: 2,
    title: 'Cắt tóc trẻ em',
    cta: 'Đặt Lịch Ngay',
    routeName: 'services',
    image:
      'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&q=80&w=900',
    alt: 'Kids haircut service',
    backgroundClass: 'bg-gradient-to-br from-[#e5e3f5] to-[#d7d6ed]'
  },
  {
    id: 3,
    title: 'Cửa hàng',
    cta: 'Mua Sắm',
    routeName: 'shop',
    image:
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&q=80&w=900',
    alt: 'Haircare product',
    backgroundClass: 'bg-gradient-to-br from-[#c9f3ee] to-[#9ee8df]'
  },
  {
    id: 4,
    title: 'Phụ kiện',
    cta: 'Mua Sắm',
    routeName: 'shop',
    image:
      'https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=80&w=900',
    alt: 'Hair accessories',
    backgroundClass: 'bg-gradient-to-br from-[#dceaf4] to-[#c8ddea]'
  }
];

const setHeroSlide = (index: number): void => {
  activeHeroSlide.value = index;
};

const nextHeroSlide = (): void => {
  activeHeroSlide.value = (activeHeroSlide.value + 1) % heroSlides.length;
};

const goToRoute = (name: string): void => {
  router.push({ name });
};

onMounted(() => {
  heroIntervalId = window.setInterval(nextHeroSlide, 4200);
});

onUnmounted(() => {
  if (heroIntervalId !== null) {
    window.clearInterval(heroIntervalId);
    heroIntervalId = null;
  }
});
</script>

<template>
  <div class="w-full bg-white">
    <!-- Hero Section (Colorful & Dynamic) -->
    <section class="relative w-full h-[85vh] min-h-[600px] lg:min-h-[800px] overflow-hidden bg-black isolate">
      <!-- Colorful Slider Backgrounds -->
      <div
        v-for="(slide, index) in heroSlides"
        :key="slide.id"
        class="absolute inset-0 transition-all duration-[1500ms] ease-[cubic-bezier(0.25,1,0.5,1)]"
        :class="[
          index === activeHeroSlide ? 'opacity-100 z-10 scale-100' : 'opacity-0 z-0 scale-[1.05]'
        ]"
      >
        <img
          :src="slide.image"
          :alt="slide.alt"
          class="w-full h-full object-cover object-center saturate-125 contrast-110"
        />
        <!-- Vibrant but dark overlay to make text pop -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>
        <div class="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-transparent"></div>
      </div>

      <!-- Hero Content -->
      <div class="absolute inset-0 z-20 flex flex-col justify-end pb-32 px-6 lg:px-16 max-w-[1440px] mx-auto w-full pointer-events-none">
        <div class="max-w-3xl pointer-events-auto">
          <div class="overflow-hidden mb-6">
            <p class="text-[10px] md:text-[12px] tracking-[0.4em] uppercase text-white/90 font-medium animate-in slide-in-from-bottom-full duration-700">
              {{ heroSlides[activeHeroSlide]?.subtitle }}
            </p>
          </div>
          <h1 class="font-heading text-[48px] md:text-[72px] lg:text-[96px] leading-[0.9] tracking-[0.02em] uppercase font-light text-white mb-10">
            <span v-for="(word, i) in heroSlides[activeHeroSlide]?.title.split(' ')" :key="i" class="inline-block mr-4 animate-in fade-in slide-in-from-bottom-8 duration-1000" :style="`animation-delay: ${i * 100}ms`">
              {{ word }}
            </span>
          </h1>
          <div class="flex flex-col md:flex-row md:items-center gap-8 animate-in fade-in duration-1000 delay-500">
            <p class="max-w-[400px] text-[15px] md:text-[16px] font-light leading-relaxed tracking-[0.04em] text-white/80">
              {{ heroSlides[activeHeroSlide]?.desc }}
            </p>
            <button
              @click="goToRoute(heroSlides[activeHeroSlide]?.route || '')"
              class="group relative inline-flex items-center justify-center gap-4 bg-white text-black px-10 py-5 text-[11px] uppercase tracking-[0.2em] font-semibold hover:bg-black hover:text-white transition-colors duration-500"
            >
              Khám Phá
              <ArrowRight :size="16" class="transition-transform duration-500 group-hover:translate-x-2" />
            </button>
          </div>
        </div>
      </div>

      <!-- Hero Pagination/Controls -->
      <div class="absolute bottom-10 right-6 lg:right-16 z-20 flex items-center gap-4">
        <button
          v-for="(slide, index) in heroSlides"
          :key="slide.id"
          @click="setHeroSlide(index)"
          class="relative h-[2px] transition-all duration-500 overflow-hidden"
          :class="index === activeHeroSlide ? 'w-24 bg-white/30' : 'w-10 bg-white/20 hover:bg-white/50'"
          aria-label="Go to slide"
        >
          <div 
            class="absolute top-0 left-0 h-full bg-white transition-all ease-linear"
            :style="{ width: index === activeHeroSlide ? '100%' : '0%', transitionDuration: index === activeHeroSlide ? '4200ms' : '0ms' }"
          ></div>
        </button>
      </div>
    </section>

    <!-- B&W Category Grid -->
    <section class="w-full bg-white border-b border-black">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-black border-t border-black">
        <article
          v-for="card in heroCategoryCards"
          :key="card.id"
          class="group relative h-[250px] lg:h-[320px] bg-white cursor-pointer overflow-hidden flex flex-col justify-between p-8"
          @click="goToRoute(card.routeName)"
        >
          <!-- Full Image on Hover -->
          <div class="absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
             <img :src="card.image" :alt="card.alt" class="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-[1.03]" />
             <div class="absolute inset-0 bg-black/40"></div>
          </div>
          
          <div class="relative z-10 flex justify-between items-start">
            <div class="w-8 h-8 rounded-full border border-black/20 flex items-center justify-center group-hover:bg-white group-hover:border-white transition-all duration-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-black transition-colors duration-500 group-hover:rotate-45"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
            </div>
          </div>
          
          <div class="relative z-10">
            <h3 class="font-heading text-[22px] lg:text-[26px] uppercase tracking-[0.05em] text-black group-hover:text-white font-light group-hover:-translate-y-2 transition-all duration-500">
              {{ card.title }}
            </h3>
            <span class="block mt-4 text-[9px] uppercase tracking-[0.25em] font-semibold text-black/0 group-hover:text-white -translate-y-4 group-hover:translate-y-0 transition-all duration-500">
              {{ card.cta }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <!-- Featured Services - Luxury B&W -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white">
      <div class="flex flex-col md:flex-row justify-between items-end mb-16 md:mb-24 gap-8">
        <div class="max-w-xl">
          <h2 class="text-[10px] tracking-[0.4em] uppercase text-black/40 mb-6 font-semibold">Chuyên Môn Cốt Lõi</h2>
          <h3 class="text-4xl md:text-5xl lg:text-6xl font-heading uppercase tracking-[0.02em] font-light text-black leading-tight">
            Dịch vụ nổi bật
          </h3>
        </div>
        <button
          @click="router.push({ name: 'services' })"
          class="group flex items-center text-[10px] uppercase tracking-[0.2em] text-black font-bold hover:text-black/60 transition-colors"
        >
          Xem tất cả 
          <span class="ml-4 w-12 h-[1px] bg-black group-hover:w-20 transition-all duration-500"></span>
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-20">
        <div
          v-for="svc in dataStore.SERVICES.slice(0, 2)"
          :key="svc.id"
          class="group cursor-pointer block"
          @click="router.push({ name: 'service_detail', params: { id: svc.id } })"
        >
          <div class="aspect-[4/5] overflow-hidden bg-black mb-8 relative">
            <img
              :src="svc.img"
              :alt="svc.name"
              class="w-full h-full object-cover transition-transform duration-[2000ms] group-hover:scale-110 grayscale group-hover:grayscale-0 opacity-90 group-hover:opacity-100"
            />
          </div>
          <div class="flex justify-between items-start border-t border-black/20 pt-6 group-hover:border-black transition-colors duration-500">
            <div>
              <h4 class="font-heading text-xl md:text-2xl tracking-[0.05em] uppercase text-black mb-3">
                {{ svc.name }}
              </h4>
              <p class="text-[13px] text-black/60 font-light leading-relaxed max-w-sm">
                {{ svc.desc }}
              </p>
            </div>
            <span class="text-[13px] font-mono text-black">
              {{ svc.price }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- Editorial Banner - Luxury B&W -->
    <section class="relative w-full py-32 md:py-48 bg-black text-white px-6 text-center overflow-hidden">
      <!-- Subtle luxury rings -->
      <div class="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
        <div class="w-[300px] h-[300px] md:w-[600px] md:h-[600px] border border-white/20 rounded-full"></div>
        <div class="absolute w-[400px] h-[400px] md:w-[800px] md:h-[800px] border border-white/10 rounded-full"></div>
      </div>
      
      <div class="relative z-10 max-w-5xl mx-auto">
        <h2 class="text-[10px] tracking-[0.4em] uppercase text-white/50 mb-8 md:mb-12 font-semibold">Triết lý thiết kế</h2>
        <p class="text-3xl md:text-5xl lg:text-7xl font-heading uppercase tracking-[0.02em] font-light mb-12 md:mb-16 leading-[1.15]">
          Nơi kỹ thuật hoàn hảo <br/> <span class="italic font-serif text-white/70 tracking-normal text-4xl md:text-6xl lg:text-8xl lowercase">giao thoa cùng</span> <br/> tầm nhìn nghệ thuật.
        </p>

        <button
          @click="router.push({ name: 'booking' })"
          class="inline-block border border-white/30 px-12 py-5 text-[10px] uppercase tracking-[0.2em] font-semibold hover:bg-white hover:text-black transition-all duration-500"
        >
          Đặt lịch tư vấn
        </button>
      </div>
    </section>

    <!-- Featured Products - Luxury B&W -->
    <section class="w-full py-24 md:py-32 px-6 lg:px-16 max-w-[1440px] mx-auto bg-white">
      <div class="flex flex-col items-center text-center mb-16 md:mb-24">
        <h2 class="text-[10px] tracking-[0.4em] uppercase text-black/40 mb-6 font-semibold">Cửa hàng</h2>
        <h3 class="text-4xl md:text-5xl font-heading uppercase tracking-[0.02em] font-light text-black mb-8">
          Sản phẩm tinh hoa
        </h3>
        <button
          @click="router.push({ name: 'shop' })"
          class="text-[10px] uppercase tracking-[0.2em] text-black font-bold border-b border-black pb-1 hover:text-black/50 hover:border-black/50 transition-colors"
        >
          Khám phá bộ sưu tập
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
        <div
          v-for="prod in dataStore.PRODUCTS.slice(0, 4)"
          :key="prod.id"
          class="group cursor-pointer flex flex-col"
          @click="router.push({ name: 'product_detail', params: { id: prod.id } })"
        >
          <div class="aspect-[3/4] overflow-hidden bg-[#f4f4f4] mb-8 relative">
            <img
              :src="prod.img"
              :alt="prod.name"
              class="w-full h-full object-cover transition-transform duration-[1500ms] group-hover:scale-110 mix-blend-multiply grayscale group-hover:grayscale-0"
            />
            <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-[cubic-bezier(0.25,1,0.5,1)]">
              <button class="w-full bg-black text-white text-[10px] font-semibold uppercase tracking-widest py-4 hover:bg-black/80 transition-colors">Thêm vào giỏ</button>
            </div>
          </div>

          <div class="flex flex-col items-center text-center">
            <p class="text-[9px] text-black/40 font-bold uppercase tracking-[0.2em] mb-3">
              {{ prod.category }}
            </p>
            <h4 class="font-heading text-sm md:text-base tracking-[0.05em] uppercase text-black mb-3">
              {{ prod.name }}
            </h4>
            <span class="text-[13px] font-mono text-black">
              ${{ prod.price }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>