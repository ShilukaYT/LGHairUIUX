<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useDataStore } from '@/stores/useDataStore';

const router = useRouter();
const dataStore = useDataStore();
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">
    
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-20">
      <div class="flex flex-col gap-24">
        <div v-for="(svc, idx) in dataStore.SERVICES" :key="svc.id" :class="['flex flex-col gap-12 lg:gap-24 items-center', idx % 2 !== 0 ? 'md:flex-row-reverse' : 'md:flex-row']">
          <div class="w-full md:w-1/2 aspect-[4/5] bg-gray-100 overflow-hidden group cursor-pointer" @click="router.push({ name: 'service_detail', params: { id: svc.id } })">
            <img :src="svc.img" :alt="svc.name" class="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" />
          </div>
          <div class="w-full md:w-1/2 flex flex-col justify-center">
            <span class="text-[10px] uppercase tracking-widest text-gray-400 mb-4">{{ svc.duration }}</span>
            <h2 class="text-2xl lg:text-3xl font-heading uppercase tracking-widest mb-4">{{ svc.name }}</h2>
            <p class="text-lg font-light mb-6">{{ svc.price }}</p>
            <p class="text-gray-500 font-light leading-relaxed mb-10 max-w-md">{{ svc.desc }}</p>
            <div class="flex gap-4">
              <button @click="router.push({ name: 'service_detail', params: { id: svc.id } })" class="border border-black px-8 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-black hover:text-white transition-colors">
                Xem Chi Tiết
              </button>
              <button @click="router.push({ name: 'booking', params: { serviceId: svc.id } })" class="bg-black text-white px-8 py-4 text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
                Đặt Lịch Ngay
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination Sample -->
      <div class="mt-24 pt-8 border-t border-gray-100 flex items-center justify-center gap-12 lg:gap-24">
        <button class="text-[10px] uppercase tracking-[0.2em] text-gray-400 hover:text-black transition-colors flex items-center gap-2">
          &larr; Trước
        </button>
        <div class="flex items-center gap-2 lg:gap-4 text-xs font-light">
          <button class="w-8 h-8 flex items-center justify-center border-b border-black text-black">1</button>
          <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors">2</button>
          <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors">3</button>
          <span class="text-gray-300 tracking-widest px-2">...</span>
          <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors">5</button>
        </div>
        <button class="text-[10px] uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors flex items-center gap-2">
          Sau &rarr;
        </button>
      </div>
    </div>
  </div>
</template>
