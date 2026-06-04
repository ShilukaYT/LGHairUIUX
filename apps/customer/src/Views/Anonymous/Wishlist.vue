<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDataStore } from '@/stores/useDataStore';
import { Heart, X } from 'lucide-vue-next';

const router = useRouter();
const dataStore = useDataStore();

// Giả lập danh sách yêu thích bằng cách lấy 3 sản phẩm đầu tiên
const wishlistItems = ref([...dataStore.PRODUCTS.slice(0, 3)]);

const removeFromWishlist = (id: string) => {
  wishlistItems.value = wishlistItems.value.filter(item => item.id !== id);
};
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-[70vh] bg-white pb-24">
    <!-- Header -->
    <div class="bg-gray-50/50 border-b border-gray-100 py-16">
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">

          <h1 class="text-3xl lg:text-4xl font-heading uppercase tracking-[0.2em] mb-4">Danh Sách Yêu Thích</h1>
        <p class="text-[11px] uppercase tracking-widest text-gray-500">{{ wishlistItems.length }} SẢN PHẨM ĐƯỢC LƯU</p>
      </div>
    </div>

    <!-- Content -->
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">
      
      <!-- Empty State -->
      <div v-if="wishlistItems.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
        <p class="text-sm tracking-widest uppercase text-gray-400 mb-8">Chưa có sản phẩm nào trong danh sách yêu thích.</p>
        <button @click="router.push({ name: 'shop' })" class="px-10 py-4 bg-black text-white text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
          Tiếp tục mua sắm
        </button>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-16">
        <div v-for="prod in wishlistItems" :key="prod.id" class="group flex flex-col cursor-pointer relative">
          <!-- Xóa Icon -->
          <button @click.stop="removeFromWishlist(prod.id)" class="absolute top-4 right-4 z-10 w-8 h-8 bg-white border border-gray-100 rounded-full flex items-center justify-center text-gray-400 hover:text-black hover:border-black transition-all shadow-sm opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0">
            <X :size="14" :stroke-width="2" />
          </button>

          <div class="aspect-[3/4] overflow-hidden bg-gray-100 mb-6 relative border border-gray-100 group-hover:border-black transition-all duration-300" @click="router.push({ name: 'product_detail', params: { id: prod.id } })">
            <img :src="prod.img" :alt="prod.name" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
              <button class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800">Thêm vào giỏ hàng</button>
            </div>
          </div>
          
          <h3 class="font-heading text-sm tracking-widest uppercase mb-1" @click="router.push({ name: 'product_detail', params: { id: prod.id } })">{{ prod.name }}</h3>
          <p class="text-[11px] text-gray-400 uppercase tracking-widest mb-3">{{ prod.category }} &middot; {{ prod.size }}</p>
          <span class="text-sm font-light mt-auto">${{ prod.price }}</span>
        </div>
      </div>
      
    </div>
  </div>
</template>
