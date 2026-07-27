<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { Heart, Star, Calendar, Trash2, Sparkles } from 'lucide-vue-next';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useWishlistStore } from '@/stores/useWishlistStore';

const wishlistStore = useWishlistStore();

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
const router = useRouter();

// ==========================================
// STATE
// ==========================================
const loading = ref(false);
const error = ref(false);
const customer = ref<any>(null);

// ==========================================
// HELPERS
// ==========================================
const getEmployeeImageUrl = (img?: string) => {
  if (!img) return 'https://ui-avatars.com/api/?name=NV&background=e0e0e0&color=000000';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('/')) return `${API}${img}`;
  return `${API}/${img}`;
};

const getStarFillWidth = (starIndex: number, rating: number) => {
  if (rating >= starIndex) return '100%';
  if (rating > starIndex - 1) {
    return `${(rating - (starIndex - 1)) * 100}%`;
  }
  return '0%';
};

const removeFavorite = (id: string) => {
  wishlistStore.removeEmployee(id);
};

const navigateToBooking = (stylistId: string) => {
  router.push({ name: 'datdichvu', query: { stylistId } });
};

// Filter the employees list to only show favorites
const favoriteEmployeesList = computed(() => {
  return wishlistStore.favoriteEmployees;
});

onMounted(() => {
  customer.value = getCustomerInfo();
  
  // Storage listener to sync logins
  window.addEventListener('storage', () => {
    customer.value = getCustomerInfo();
  });
});
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-[75vh] bg-[#fafafa] pb-24">
    <!-- PAGE HEADER -->
    <div class="bg-white border-b border-gray-100 py-16">
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12 text-center">
        <h1 class="text-2xl lg:text-4xl font-heading uppercase tracking-[0.25em] mb-4 text-black font-light">
          Chuyên Viên Yêu Thích
        </h1>
        <p class="text-[10px] uppercase tracking-widest text-gray-400 font-heading">
          {{ favoriteEmployeesList.length }} CHUYÊN VIÊN ĐƯỢC LƯU
        </p>
      </div>
    </div>

    <!-- CONTENT -->
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">
      
      <!-- LOADING -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-24 gap-4">
        <div class="fav-spinner"></div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-heading">Đang tải danh sách...</p>
      </div>



      <!-- EMPTY STATE -->
      <div v-else-if="favoriteEmployeesList.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
        <p class="text-sm tracking-widest uppercase text-gray-400 mb-8 font-heading">Chưa có chuyên viên nào trong danh sách yêu thích.</p>
        <button @click="router.push({ name: 'employees' })" class="px-8 py-4 bg-black text-white text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors cursor-pointer font-heading">
          Khám phá đội ngũ chuyên viên
        </button>
      </div>

      <!-- GRID CARDS -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div 
          v-for="emp in favoriteEmployeesList" 
          :key="emp.id" 
          class="group bg-white border border-gray-100 flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:border-black/20"
        >
          <!-- Delete button overlay -->
          <button 
            @click.stop="removeFavorite(emp.id)"
            class="absolute top-4 right-4 z-10 w-9 h-9 bg-white/90 backdrop-blur-xs rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition-all shadow-sm border border-gray-100 cursor-pointer"
            aria-label="Xóa khỏi yêu thích"
          >
            <Trash2 :size="15" />
          </button>

          <!-- Avatar Image -->
          <div class="aspect-[3/4] overflow-hidden bg-gray-50 relative border-b border-gray-50">
            <img 
              :src="getEmployeeImageUrl(emp.image)" 
              :alt="emp.name" 
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </div>

          <!-- Body details -->
          <div class="p-6 flex flex-col flex-grow">
            <span class="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5 font-heading">{{ emp.role }}</span>
            <h3 class="font-heading text-sm text-black uppercase tracking-widest font-semibold mb-3 group-hover:text-gray-800 transition-colors">
              {{ emp.name }}
            </h3>
            
            <!-- Ratings -->
            <div class="flex items-center gap-1.5 mb-6 mt-auto">
              <div class="flex items-center gap-0.5">
                <div v-for="i in 5" :key="i" class="relative inline-block">
                  <Star :size="12" class="text-gray-200 fill-gray-100" />
                  <div 
                    class="absolute top-0 left-0 overflow-hidden"
                    :style="{ width: getStarFillWidth(i, emp.rating) }"
                  >
                    <Star :size="12" class="text-amber-400 fill-amber-400 max-w-none" />
                  </div>
                </div>
              </div>
              <span class="text-[11px] text-gray-500 font-medium font-sans">({{ emp.rating.toFixed(1) }})</span>
            </div>

            <!-- Booking CTA -->
            <div class="pt-2 border-t border-gray-100">
              <button 
                @click="navigateToBooking(emp.id)"
                class="w-full h-11 bg-black text-white text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 cursor-pointer font-medium font-heading"
              >
                <Calendar :size="12" /> Đặt lịch chuyên viên này
              </button>
            </div>
          </div>
        </div>
      </div>
      
    </div>
  </div>
</template>

<style scoped>
.fav-spinner {
  width: 32px;
  height: 32px;
  border: 1.5px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.font-heading {
  font-family: var(--font-heading, 'Inter', sans-serif);
  letter-spacing: 0.1em;
}
</style>
