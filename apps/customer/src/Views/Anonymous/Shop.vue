<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useDataStore } from '@/stores/useDataStore';

const router = useRouter();
const dataStore = useDataStore();
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">
    
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">
      <div class="flex justify-between items-center mb-8 pb-4 border-b border-gray-100">
        <span class="text-xs text-gray-400 uppercase tracking-widest">{{ dataStore.PRODUCTS.length }} Sản phẩm</span>
        <select class="text-xs uppercase tracking-widest bg-transparent focus:outline-none cursor-pointer">
          <option>Nổi bật</option>
          <option>Giá: Thấp đến Cao</option>
          <option>Giá: Cao xuống Thấp</option>
        </select>
      </div>
      <div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-16">
        <div v-for="prod in dataStore.PRODUCTS" :key="prod.id" class="group flex flex-col cursor-pointer" @click="router.push({ name: 'product_detail', params: { id: prod.id } })">
          <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-6 relative border border-gray-100 group-hover:border-black transition-all duration-300">
            <img :src="prod.img" :alt="prod.name" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800">Thêm vào giỏ hàng</button>
            </div>
            
          </div>
          <h3 class="font-heading text-sm tracking-widest uppercase mb-1">{{ prod.name }}</h3>
          <p class="text-[11px] text-gray-400 uppercase tracking-widest mb-3">{{ prod.category }} &middot; {{ prod.size }}</p>
          <span class="text-sm font-light mt-auto">${{ prod.price }}</span>
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
          <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors">8</button>
        </div>
        <button class="text-[10px] uppercase tracking-[0.2em] text-black hover:text-gray-500 transition-colors flex items-center gap-2">
          Sau &rarr;
        </button>
      </div>
    </div>
  </div>
</template>
