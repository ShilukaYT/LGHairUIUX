<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useDataStore } from '@/stores/useDataStore';
import { X, Minus, Plus, ArrowRight } from 'lucide-vue-next';

const router = useRouter();
const dataStore = useDataStore();

// Mock cart items based on products
const cartItems = computed(() => {
  const items = [];
  if (dataStore.PRODUCTS[0]) items.push({ ...dataStore.PRODUCTS[0], quantity: 1 });
  if (dataStore.PRODUCTS[1]) items.push({ ...dataStore.PRODUCTS[1], quantity: 2 });
  return items;
});

const subtotal = computed(() => {
  return cartItems.value.reduce((total, item) => total + (item.price * item.quantity), 0);
});

const shipping = 10;
const total = computed(() => subtotal.value + shipping);
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">

    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16 lg:pt-24">
      <div class="flex flex-col lg:flex-row gap-16 lg:gap-24">
        
        <!-- Cart Items List -->
        <div class="flex-1 flex flex-col">
          <!-- Table Header (hidden on mobile) -->
          <div class="hidden md:grid grid-cols-[3fr_1fr_1fr_auto] gap-6 border-b border-gray-200 pb-4 mb-8 text-[10px] uppercase tracking-[0.2em] text-gray-400 font-medium">
            <span>Sản phẩm</span>
            <span class="text-center">Số lượng</span>
            <span class="text-right">Giá</span>
            <span class="w-8"></span>
          </div>

          <!-- Items -->
          <div class="flex flex-col gap-8 md:gap-0">
            <div v-for="item in cartItems" :key="item.id" class="flex flex-col md:grid md:grid-cols-[3fr_1fr_1fr_auto] gap-6 items-center md:border-b md:border-gray-100 md:py-8 group">
              <!-- Product Info -->
              <div class="flex items-center gap-6 w-full">
                <div class="w-24 h-32 md:w-28 md:h-36 bg-gray-50 flex-shrink-0 cursor-pointer overflow-hidden border border-gray-100" @click="router.push({ name: 'product_detail', params: { id: item.id } })">
                  <img :src="item.img" :alt="item.name" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                </div>
                <div class="flex flex-col">
                  <h3 class="font-heading text-sm uppercase tracking-widest mb-1 cursor-pointer hover:text-gray-500 transition-colors" @click="router.push({ name: 'product_detail', params: { id: item.id } })">{{ item.name }}</h3>
                  <p class="text-[10px] uppercase tracking-widest text-gray-400 mb-2">{{ item.category }} &middot; {{ item.size }}</p>
                  <p class="md:hidden text-sm font-light mt-2">${{ item.price }}</p>
                </div>
              </div>

              <!-- Quantity Mobile Header -->
              <div class="md:hidden w-full flex justify-between items-center border-t border-gray-100 pt-4 mt-2">
                <span class="text-[10px] uppercase tracking-[0.2em] text-gray-400">Số lượng</span>
                <!-- Mobile Qty Selector -->
                <div class="flex items-center border border-gray-200 w-24">
                  <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors"><Minus :size="12" /></button>
                  <span class="flex-1 text-center text-xs">{{ item.quantity }}</span>
                  <button class="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-black transition-colors"><Plus :size="12" /></button>
                </div>
              </div>

              <!-- Desktop Qty Selector -->
              <div class="hidden md:flex justify-center w-full">
                <div class="flex items-center border border-gray-200 w-28">
                  <button class="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-colors"><Minus :size="12" /></button>
                  <span class="flex-1 text-center text-xs">{{ item.quantity }}</span>
                  <button class="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-black transition-colors"><Plus :size="12" /></button>
                </div>
              </div>

              <!-- Price (Desktop) -->
              <div class="hidden md:block text-right w-full">
                <span class="text-sm font-light">${{ item.price * item.quantity }}</span>
              </div>

              <!-- Remove -->
              <div class="hidden md:flex justify-end w-8">
                <button class="text-gray-400 hover:text-black transition-colors p-2 -mr-2">
                  <X :size="16" :stroke-width="1.5" />
                </button>
              </div>
              
              <!-- Mobile Remove -->
              <button class="md:hidden w-full text-[10px] uppercase tracking-widest text-gray-400 hover:text-black text-left pt-2 pb-6 border-b border-gray-100">Xóa sản phẩm</button>
            </div>
          </div>
          
          <div class="mt-8 flex justify-between items-center">
            <button @click="router.push({ name: 'shop' })" class="text-[10px] uppercase tracking-[0.2em] text-gray-500 hover:text-black transition-colors flex items-center gap-2">
               Tiếp tục mua sắm
            </button>
          </div>
        </div>

        <!-- Order Summary -->
        <div class="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0">
          <div class="bg-[#fcfcfc] border border-gray-100 p-8 md:p-10">
            <h2 class="font-heading text-lg uppercase tracking-widest mb-8 border-b border-gray-200 pb-4">Tóm tắt đơn hàng</h2>
            
            <div class="flex flex-col gap-4 text-sm font-light mb-8">
              <div class="flex justify-between">
                <span class="text-gray-500">Tạm tính</span>
                <span>${{ subtotal }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500">Phí giao hàng</span>
                <span>${{ shipping }}</span>
              </div>
              <div class="flex justify-between pt-4 border-t border-gray-100 mt-2">
                <span class="font-medium text-black">Tổng cộng</span>
                <span class="font-medium text-black text-lg">${{ total }}</span>
              </div>
            </div>

            <button class="w-full bg-black text-white px-8 py-5 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors flex items-center justify-center group">
              Thanh toán <ArrowRight :size="14" class="ml-2 group-hover:translate-x-1 transition-transform" />
            </button>

            <p class="text-[10px] text-gray-400 text-center mt-6 uppercase tracking-widest leading-relaxed">
              Thuế và phí vận chuyển sẽ được tính tại bước thanh toán.
            </p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
