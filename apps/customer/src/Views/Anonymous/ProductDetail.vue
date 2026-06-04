<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ChevronRight, Minus, Plus } from 'lucide-vue-next';
import { useDataStore } from '@/stores/useDataStore';

const router = useRouter();
const route = useRoute();
const dataStore = useDataStore();

const qty = ref(1);
const activeTab = ref('details');

const currentProduct = computed(() => {
  return dataStore.PRODUCTS.find(p => p.id === route.params.id) || dataStore.PRODUCTS[0];
});
</script>

<template>
  <div v-if="currentProduct" class="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-screen pt-8 pb-24 px-6 lg:px-12 max-w-[1440px] mx-auto">
    <button @click="router.push({ name: 'shop' })" class="flex items-center text-[10px] uppercase tracking-widest text-gray-400 hover:text-black mb-8 transition-colors">
      <ChevronRight :size="14" class="rotate-180 mr-1" /> Trở Về Cửa Hàng
    </button>
    <div class="flex flex-col lg:flex-row gap-12 lg:gap-24">
      <div class="w-full lg:w-1/2">
        <div class="aspect-[4/4] bg-gray-100 w-full overflow-hidden border border-gray-200">
          <img :src="currentProduct.img" :alt="currentProduct.name" class="w-full h-full object-cover" />
        </div>
      </div>
      <div class="w-full lg:w-1/2 flex flex-col lg:py-10">
        <p class="text-[11px] text-gray-500 uppercase tracking-widest mb-4">{{ currentProduct.category }}</p>
        <h1 class="text-3xl lg:text-4xl font-heading uppercase tracking-widest mb-4">{{ currentProduct.name }}</h1>
        <span class="text-xl font-light mb-8">${{ currentProduct.price }}</span>
        <p class="text-gray-600 font-light leading-relaxed mb-8">{{ currentProduct.desc }}</p>
        
        <div class="flex items-center gap-6 mb-8 pb-8 border-b border-gray-100">
          <div class="flex items-center border border-gray-300 w-32">
            <button @click="qty = Math.max(1, qty - 1)" class="p-4 hover:bg-gray-50"><Minus :size="14" /></button>
            <span class="flex-1 text-center text-sm">{{ qty }}</span>
            <button @click="qty = qty + 1" class="p-4 hover:bg-gray-50"><Plus :size="14" /></button>
          </div>
          <button
  class="flex-1 border border-black bg-white text-black py-4 text-xs font-medium uppercase tracking-[0.2em]
         transition-all duration-300 ease-out
         hover:bg-black hover:text-white hover:tracking-[0.24em]
         active:scale-[0.98]"
>
  Thêm vào giỏ hàng
</button>
          <button class="flex-1 bg-black text-white py-4 text-xs uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
            Mua ngay
          </button>
        </div>

        <div class="flex border-b border-gray-200 mb-6">
          <button 
            :class="['pb-4 px-4 text-xs uppercase tracking-widest transition-colors', activeTab === 'details' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black']"
            @click="activeTab = 'details'"
          >Chi Tiết</button>
          <button 
            :class="['pb-4 px-4 text-xs uppercase tracking-widest transition-colors', activeTab === 'ingredients' ? 'border-b-2 border-black text-black' : 'text-gray-400 hover:text-black']"
            @click="activeTab = 'ingredients'"
          >Thành Phần</button>
        </div>
        <div class="text-sm text-gray-500 font-light leading-relaxed min-h-[100px]">
          <p v-if="activeTab === 'details'">Dung tích: {{ currentProduct.size }}<br/><br/>Lấy một lượng vừa đủ ra tay, thoa đều lên tóc ẩm hoặc khô, tập trung vào thân và ngọn tóc. Tạo kiểu như bình thường.</p>
          <p v-else>{{ currentProduct.ingredients }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
