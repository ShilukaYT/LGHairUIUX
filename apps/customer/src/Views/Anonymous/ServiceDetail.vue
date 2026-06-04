<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ChevronRight } from 'lucide-vue-next';
import { useDataStore } from '@/stores/useDataStore';

const router = useRouter();
const route = useRoute();
const dataStore = useDataStore();

const currentService = computed(() => {
  return dataStore.SERVICES.find(s => s.id === route.params.id) || dataStore.SERVICES[0];
});
</script>

<template>
  <div v-if="currentService" class="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen">
    <div class="w-full h-[50vh] relative bg-black flex items-center justify-center">
      <img :src="currentService.img" :alt="currentService.name" class="absolute inset-0 w-full h-full object-cover opacity-60" />
      <div class="relative z-10 text-center px-6">
        <h1 class="text-4xl md:text-5xl font-heading text-white uppercase tracking-[0.2em] mb-4">{{ currentService.name }}</h1>
        <p class="text-gray-300 font-light tracking-widest uppercase text-xs">{{ currentService.duration }} &middot; {{ currentService.price }}</p>
      </div>
    </div>
    
    <div class="max-w-[800px] mx-auto px-6 py-24">
      <button @click="router.push({ name: 'services' })" class="flex items-center text-[10px] uppercase tracking-widest text-gray-400 hover:text-black mb-12 transition-colors">
        <ChevronRight :size="14" class="rotate-180 mr-1" /> Trở Lại Dịch Vụ
      </button>
      
      <h3 class="text-sm font-heading uppercase tracking-[0.2em] mb-6">Trải Nghiệm</h3>
      <p class="text-gray-600 font-light leading-relaxed mb-16 text-lg">{{ currentService.fullDesc }}</p>
      
      <h3 class="text-sm font-heading uppercase tracking-[0.2em] mb-8">Chi Tiết Quy Trình</h3>
      <ul class="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-12 mb-16 border-t border-b border-gray-100 py-12">
        <li v-for="(item, i) in currentService.whatToExpect" :key="i" class="flex items-center text-gray-500 font-light text-sm">
          <span class="w-6 h-6 border border-gray-300 rounded-full flex items-center justify-center text-[10px] mr-4">{{ i + 1 }}</span>
          {{ item }}
        </li>
      </ul>
      
      <div class="text-center">
        <button @click="router.push({ name: 'booking', params: { serviceId: currentService.id } })" class="bg-black text-white px-12 py-5 text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors w-full md:w-auto">
          Đặt Lịch Ngay
        </button>
      </div>
    </div>
  </div>
</template>
