<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import axios from "axios";

const API = import.meta.env.VITE_API_URL;
const router = useRouter();
const route = useRoute();

// Danh mục đang active (nếu user quay lại từ trang dịch vụ)
const activeCategory = computed(() => route.query.from as string | undefined);

// =======================
// STATE
// =======================
const categories = ref<any[]>([]);
const loading = ref(true);
const error = ref(false);

// =======================
// API
// =======================
const fetchCategories = async () => {
  try {
    loading.value = true;
    error.value = false;
    const res = await axios.get(`${API}/api/DanhMucDV/danh-sach`);
    categories.value = res.data;
  } catch (err) {
    console.error("Lỗi lấy danh mục dịch vụ:", err);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

const getImageUrl = (img?: string) => {
  if (!img) return `${API}/assets/images/default.jpg`;
  if (img.startsWith("/")) return `${API}${img}`;
  return `${API}/uploads/danhmuc/${img}`;
};

// =======================
// NAVIGATE → trang dịch vụ với filter danh mục
// =======================
const goToServices = (maDM: string) => {
  router.push({ name: "services", query: { category: maDM } });
};

onMounted(fetchCategories);
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen pb-24">
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-16">

      <!-- HEADER ROW -->
      <div class="flex justify-between items-end mb-12 pb-4 border-b border-gray-100">
        <div>
          <p class="text-[10px] uppercase tracking-[0.3em] text-gray-400 mb-2">Minh Tâm Hair</p>
          <h1 class="font-heading text-2xl lg:text-3xl tracking-widest uppercase">
            Danh Mục Dịch Vụ
          </h1>
        </div>
        <!-- <span v-if="!loading && !error" class="text-xs text-gray-400 uppercase tracking-widest">
          {{ categories.length }} Danh mục
        </span> -->
      </div>

      <!-- LOADING -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
        <div class="dm-spinner"></div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Đang tải danh mục...</p>
      </div>

      <!-- LỖI -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-32 gap-4 border border-gray-100">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-gray-300">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Không thể tải dữ liệu. Vui lòng thử lại.</p>
      </div>

      <!-- GRID DANH MỤC -->
      <div v-else>
        <div v-if="categories.length > 0" class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-16">
          <div
            v-for="cat in categories"
            :key="cat.maDM"
            class="group flex flex-col cursor-pointer"
            :class="{ 'is-active': activeCategory === cat.maDM }"
            @click="goToServices(cat.maDM)"
            :aria-label="`Xem dịch vụ danh mục ${cat.tenDanhMuc}`"
          >
            <!-- ẢNH -->
            <div
              class="aspect-[3/4] overflow-hidden bg-gray-50 mb-6 relative border group-hover:border-black transition-all duration-300"
              :class="activeCategory === cat.maDM ? 'border-black' : 'border-gray-100'"
            >
              <img
                :src="getImageUrl(cat.hinhAnh)"
                :alt="cat.tenDanhMuc"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <!-- CTA hover -->
              <div class="absolute bottom-0 left-0 w-full p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <button class="w-full bg-black text-white text-[10px] uppercase tracking-widest py-3 hover:bg-gray-800">
                  Xem dịch vụ
                </button>
              </div>
              <!-- Badge trạng thái (ẩn nếu trangThai = 0) -->
              <span
                v-if="cat.trangThai === 0"
                class="absolute top-3 left-3 bg-gray-800 text-white text-[9px] uppercase tracking-widest px-2 py-1"
              >
                Tạm ngưng
              </span>
              <!-- Badge đang xem -->
              <span
                v-if="activeCategory === cat.maDM"
                class="absolute top-3 right-3 bg-black text-white text-[9px] uppercase tracking-widest px-2 py-1"
              >
                Đang xem
              </span>
            </div>

            <!-- THÔNG TIN -->
            <h3 class="font-heading text-sm tracking-widest uppercase mb-1">{{ cat.tenDanhMuc }}</h3>
            <p class="text-[11px] text-gray-400 uppercase tracking-widest mb-2">
              {{ cat.soDichVu != null ? cat.soDichVu + ' dịch vụ' : '—' }}
            </p>
            <span v-if="cat.ngayTao" class="text-[10px] text-gray-300 uppercase tracking-widest mt-auto">
              {{ new Date(cat.ngayTao).toLocaleDateString('vi-VN') }}
            </span>
          </div>
        </div>

        <!-- Không có danh mục -->
        <div v-else class="flex flex-col items-center justify-center py-32 gap-4 border border-gray-100">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" class="text-gray-300">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          </svg>
          <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400">Chưa có danh mục dịch vụ nào.</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
.dm-spinner {
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

/* Font heading — dùng cùng font-heading với Shop.vue */
.font-heading {
  font-family: var(--font-heading, 'Inter', sans-serif);
  font-weight: 500;
  letter-spacing: 0.08em;
}

/* Card đang active (danh mục đang được xem bên Services) */
.is-active h3 {
  text-decoration: underline;
  text-underline-offset: 4px;
}
</style>