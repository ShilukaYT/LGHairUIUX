<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import axios from "axios";
import { Star, MessageSquare, ChevronLeft, ChevronRight, X, Image as ImageIcon, Sparkles, Filter } from "lucide-vue-next";

const props = defineProps<{
  maSp: string;
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL || "https://localhost:7196";

// STATE
const reviews = ref<any[]>([]);
const loading = ref(true);
const error = ref(false);

const selectedRatingFilter = ref<number | "all">("all");
const selectedSort = ref<"newest" | "highest" | "lowest">("newest");
const currentPage = ref(1);
const itemsPerPage = 5;

// Lightbox state
const lightboxOpen = ref(false);
const lightboxImg = ref("");

// IMAGE HELPER
const getImageUrl = (path?: string) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
  return `${API_BASE_URL}/${path}`;
};

// Fetch reviews from API
const fetchReviews = async () => {
  if (!props.maSp) return;
  try {
    loading.value = true;
    error.value = false;
    const res = await axios.get(`${API_BASE_URL}/api/DanhGia/product-reviews/${props.maSp}`);
    reviews.value = res.data || [];
  } catch (err) {
    console.error("Lỗi khi tải đánh giá sản phẩm:", err);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

// Hook & Watcher
onMounted(fetchReviews);
watch(() => props.maSp, fetchReviews);

// STATS COMPUTED
const totalReviews = computed(() => reviews.value.length);

const averageRating = computed(() => {
  if (reviews.value.length === 0) return 0;
  const sum = reviews.value.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.value.length) * 10) / 10;
});

const ratingDistribution = computed(() => {
  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.value.forEach((r) => {
    const star = Math.round(r.rating);
    if (star >= 1 && star <= 5) {
      dist[star as keyof typeof dist]++;
    }
  });
  return dist;
});

const ratingPercentages = computed(() => {
  const total = totalReviews.value || 1;
  return {
    5: Math.round((ratingDistribution.value[5] / total) * 100),
    4: Math.round((ratingDistribution.value[4] / total) * 100),
    3: Math.round((ratingDistribution.value[3] / total) * 100),
    2: Math.round((ratingDistribution.value[2] / total) * 100),
    1: Math.round((ratingDistribution.value[1] / total) * 100),
  };
});

// FILTER & SORT PIPELINE
const filteredReviews = computed(() => {
  let list = [...reviews.value];

  // Filter by star rating
  if (selectedRatingFilter.value !== "all") {
    list = list.filter((r) => Math.round(r.rating) === selectedRatingFilter.value);
  }

  // Sort
  list.sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();

    if (selectedSort.value === "newest") {
      return dateB - dateA;
    } else if (selectedSort.value === "highest") {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return dateB - dateA; // fallback
    } else {
      if (a.rating !== b.rating) return a.rating - b.rating;
      return dateB - dateA; // fallback
    }
  });

  return list;
});

// PAGINATION
const totalPages = computed(() => Math.ceil(filteredReviews.value.length / itemsPerPage));
const paginatedReviews = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredReviews.value.slice(start, start + itemsPerPage);
});

// Reset page when filters change
watch([selectedRatingFilter, selectedSort], () => {
  currentPage.value = 1;
});

const changePage = (step: number) => {
  const next = currentPage.value + step;
  if (next > 0 && next <= totalPages.value) {
    currentPage.value = next;
  }
};

const openLightbox = (imgUrl: string) => {
  lightboxImg.value = imgUrl;
  lightboxOpen.value = true;
};

// Date Format Helper
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Name initials for avatar placeholder
const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.trim().split(" ");
  const first = parts[0]?.charAt(0) || "";
  if (parts.length === 1) return first.toUpperCase();
  const last = parts[parts.length - 1]?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
};
</script>

<template>
  <div class="w-full mt-24 border-t border-neutral-100 pt-20">
    <!-- TIÊU ĐỀ PHẦN -->
    <div class="flex flex-col items-center text-center mb-16">
      <div class="flex items-center gap-2 mb-3">
        <Sparkles :size="14" class="text-amber-500 animate-pulse" />
        <span class="text-xs text-neutral-400 uppercase tracking-[0.25em] font-medium">Ý KIẾN KHÁCH HÀNG</span>
      </div>
      <h3 class="font-heading text-3xl tracking-[0.15em] uppercase font-light text-neutral-900 mb-4">
        Đánh giá & Nhận xét
      </h3>
      <div class="w-12 h-[1px] bg-neutral-900"></div>
    </div>

    <!-- LOADING & ERROR STATES -->
    <div v-if="loading" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="reviews-spinner"></div>
      <p class="text-[10px] uppercase tracking-[0.25em] text-neutral-400">Đang đồng bộ đánh giá...</p>
    </div>

    <div v-else-if="error" class="text-center py-16 border border-dashed border-red-100 bg-red-50/20 max-w-xl mx-auto">
      <p class="text-xs text-red-500 uppercase tracking-widest">Không thể kết nối đến máy chủ để tải đánh giá.</p>
    </div>

    <!-- MAIN CONTENT -->
    <div v-else class="max-w-[1440px] mx-auto px-4 md:px-6">
      <div v-if="reviews.length === 0" class="text-center py-24 border border-dashed border-neutral-200 bg-neutral-50/30 rounded-lg max-w-2xl mx-auto">
        <MessageSquare :size="32" class="mx-auto text-neutral-300 mb-4" :stroke-width="1.2" />
        <h4 class="text-sm font-medium uppercase tracking-widest text-neutral-800 mb-1">Chưa có đánh giá</h4>
        <p class="text-xs text-neutral-400 font-light">Hãy là người mua đầu tiên sở hữu và đánh giá sản phẩm này!</p>
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
        <!-- CỘT TRÁI: PANEL THỐNG KÊ SAO (4 COLS) -->
        <div class="lg:col-span-4 flex flex-col gap-8 bg-neutral-50/80 p-8 border border-neutral-200/60 rounded-none relative overflow-hidden backdrop-blur-sm self-start">
          <div class="absolute top-0 left-0 w-full h-[3px] bg-neutral-900"></div>
          
          <div>
            <span class="text-[10px] uppercase tracking-[0.25em] text-neutral-400 font-semibold block mb-2">Đánh giá chung</span>
            <div class="flex items-baseline gap-2">
              <span class="text-6xl font-light font-heading text-neutral-900">{{ averageRating }}</span>
              <span class="text-lg text-neutral-400">/ 5</span>
            </div>
            
            <!-- Stars dynamic render -->
            <div class="flex items-center gap-2 mt-4">
              <div class="flex gap-0.5">
                <Star
                  v-for="s in 5"
                  :key="s"
                  :size="16"
                  :fill="s <= Math.round(averageRating) ? '#f59e0b' : 'none'"
                  :stroke="s <= Math.round(averageRating) ? '#f59e0b' : '#d1d5db'"
                  :stroke-width="1.5"
                />
              </div>
              <span class="text-xs text-neutral-500 font-medium ml-1">({{ totalReviews }} lượt đánh giá)</span>
            </div>
          </div>

          <div class="w-full h-[1px] bg-neutral-200/80"></div>

          <!-- Rating Breakdown Progress Bars -->
          <div class="flex flex-col gap-4">
            <div v-for="star in [5, 4, 3, 2, 1]" :key="star" class="flex items-center text-xs gap-3">
              <span class="w-3 text-right font-medium text-neutral-700">{{ star }}</span>
              <Star :size="12" fill="#f59e0b" stroke="#f59e0b" />
              <div class="flex-1 h-2 bg-neutral-200 overflow-hidden rounded-none relative">
                <div
                  class="h-full bg-neutral-900 transition-all duration-700 ease-out"
                  :style="{ width: `${ratingPercentages[star as keyof typeof ratingPercentages]}%` }"
                ></div>
              </div>
              <span class="w-10 text-right text-neutral-400 font-light">
                {{ ratingPercentages[star as keyof typeof ratingPercentages] }}%
              </span>
            </div>
          </div>
        </div>

        <!-- CỘT PHẢI: BỘ LỌC + DANH SÁCH BÌNH LUẬN (8 COLS) -->
        <div class="lg:col-span-8 flex flex-col gap-8">
          <!-- BỘ LỌC & SẮP XẾP -->
          <div class="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-200 pb-6 gap-4">
            <!-- Filter Star Badges -->
            <div class="flex flex-wrap gap-2 items-center">
              <div class="flex items-center gap-1.5 text-[10px] text-neutral-400 uppercase tracking-widest font-semibold mr-2">
                <Filter :size="10" />
                <span>Lọc theo:</span>
              </div>
              
              <button
                @click="selectedRatingFilter = 'all'"
                :class="[
                  'px-4 py-2 text-[10px] uppercase tracking-wider font-semibold border transition-all duration-300 rounded-none cursor-pointer',
                  selectedRatingFilter === 'all'
                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                    : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900',
                ]"
              >
                Tất cả ({{ totalReviews }})
              </button>
              
              <button
                v-for="star in [5, 4, 3, 2, 1]"
                :key="star"
                @click="selectedRatingFilter = star"
                :class="[
                  'px-3.5 py-2 text-[10px] uppercase tracking-wider font-semibold border transition-all duration-300 rounded-none flex items-center gap-1.5 cursor-pointer',
                  selectedRatingFilter === star
                    ? 'bg-neutral-900 border-neutral-900 text-white shadow-sm'
                    : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-900 hover:text-neutral-900',
                ]"
              >
                <span>{{ star }}</span>
                <Star :size="10" :fill="selectedRatingFilter === star ? '#ffffff' : '#f59e0b'" :stroke="selectedRatingFilter === star ? '#ffffff' : '#f59e0b'" />
                <span class="text-[9px] opacity-70">({{ ratingDistribution[star as keyof typeof ratingDistribution] }})</span>
              </button>
            </div>

            <!-- Sort Option Dropdown -->
            <div class="flex items-center justify-between md:justify-end gap-2 border-t md:border-t-0 pt-4 md:pt-0 border-neutral-100">
              <span class="text-[10px] uppercase tracking-widest text-neutral-400 font-semibold">Sắp xếp:</span>
              <select
                v-model="selectedSort"
                class="bg-white border border-neutral-200 outline-none px-4 py-2 text-[10px] uppercase tracking-widest text-neutral-800 cursor-pointer hover:border-neutral-900 transition-all rounded-none font-medium focus:border-neutral-900"
              >
                <option value="newest">Mới nhất</option>
                <option value="highest">Điểm cao nhất</option>
                <option value="lowest">Điểm thấp nhất</option>
              </select>
            </div>
          </div>

          <!-- REVIEWS LIST -->
          <div v-if="filteredReviews.length === 0" class="text-center py-20 bg-neutral-50/40 border border-neutral-200/50 rounded-none">
            <p class="text-xs text-neutral-400 uppercase tracking-widest font-light">Không có đánh giá nào phù hợp với bộ lọc đã chọn.</p>
          </div>

          <div v-else class="space-y-6">
            <div
              v-for="(r, idx) in paginatedReviews"
              :key="r.id || idx"
              class="group border border-neutral-200 hover:border-neutral-800 p-6 md:p-8 transition-all duration-300 bg-white relative animate-in fade-in slide-in-from-bottom-2"
            >
              <div class="flex flex-col sm:flex-row gap-5 items-start">
                <!-- Customer Avatar / Initials -->
                <div class="shrink-0 flex items-center gap-3 sm:flex-col sm:items-center">
                  <div
                    v-if="r.customerAvatar"
                    class="w-12 h-12 md:w-14 md:h-14 border border-neutral-200 rounded-none overflow-hidden bg-neutral-50 shadow-sm"
                  >
                    <img :src="getImageUrl(r.customerAvatar)" :alt="r.customerName" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                  
                  <!-- Stylish Initial Avatar -->
                  <div
                    v-else
                    class="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-tr from-neutral-800 to-neutral-950 text-white flex items-center justify-center text-xs font-semibold uppercase tracking-widest font-heading shadow-sm"
                  >
                    {{ getInitials(r.customerName) }}
                  </div>
                </div>

                <!-- Review Content Area -->
                <div class="flex-1 space-y-3 w-full">
                  <!-- Header: Name + Star rating -->
                  <div class="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h4 class="text-xs font-semibold uppercase tracking-wider text-neutral-900 group-hover:text-black transition-colors">
                        {{ r.customerName || "Khách hàng" }}
                      </h4>
                      <p class="text-[9px] text-neutral-400 uppercase tracking-widest font-light mt-0.5">
                        {{ formatDate(r.date) }}
                      </p>
                    </div>

                    <div class="flex items-center gap-1 bg-neutral-50 px-2.5 py-1 border border-neutral-100 rounded-none">
                      <div class="flex gap-0.5">
                        <Star
                          v-for="s in 5"
                          :key="s"
                          :size="11"
                          :fill="s <= r.rating ? '#f59e0b' : 'none'"
                          :stroke="s <= r.rating ? '#f59e0b' : '#d1d5db'"
                          :stroke-width="1.5"
                        />
                      </div>
                      <span class="text-[10px] font-semibold text-neutral-700 ml-1 mt-px">{{ r.rating }}.0</span>
                    </div>
                  </div>

                  <!-- Comment Text -->
                  <p class="text-xs text-neutral-600 font-light leading-relaxed whitespace-pre-line pr-2">
                    {{ r.comment }}
                  </p>

                  <!-- Attached Image (if exists) -->
                  <div v-if="r.image" class="pt-2">
                    <div
                      @click="openLightbox(getImageUrl(r.image))"
                      class="relative w-24 h-24 border border-neutral-200 rounded-none overflow-hidden cursor-zoom-in group-image bg-neutral-50 hover:border-neutral-950 transition-all shadow-sm"
                    >
                      <img :src="getImageUrl(r.image)" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <!-- Zoom Overlay icon -->
                      <div class="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <ImageIcon :size="16" class="text-white" />
                      </div>
                    </div>
                  </div>

                  <!-- Owner Response (if exists) -->
                  <div v-if="r.reply" class="bg-neutral-50 border-l-2 border-neutral-900 p-5 mt-4 space-y-2 animate-in fade-in duration-300">
                    <div class="flex items-center gap-2 text-[9px] uppercase tracking-widest text-neutral-900 font-bold">
                      <MessageSquare :size="12" class="text-neutral-800" />
                      <span>Phản hồi từ Minh Tâm Hair</span>
                    </div>
                    <p class="text-xs text-neutral-500 font-light leading-relaxed whitespace-pre-line">
                      {{ r.reply }}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGINATION -->
          <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 pt-6 border-t border-neutral-100 mt-6">
            <button
              @click="changePage(-1)"
              :disabled="currentPage === 1"
              class="p-2.5 border border-neutral-200 hover:border-neutral-950 text-neutral-600 hover:text-neutral-950 disabled:opacity-30 disabled:hover:border-neutral-200 disabled:hover:text-neutral-400 transition-all cursor-pointer rounded-none"
              title="Trang trước"
            >
              <ChevronLeft :size="14" />
            </button>
            <span class="text-xs font-semibold tracking-widest text-neutral-600 font-heading">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              @click="changePage(1)"
              :disabled="currentPage === totalPages"
              class="p-2.5 border border-neutral-200 hover:border-neutral-950 text-neutral-600 hover:text-neutral-950 disabled:opacity-30 disabled:hover:border-neutral-200 disabled:hover:text-neutral-400 transition-all cursor-pointer rounded-none"
              title="Trang sau"
            >
              <ChevronRight :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- LIGHTBOX OVERLAY -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center animate-in fade-in duration-300 cursor-zoom-out"
        @click="lightboxOpen = false"
      >
        <button
          class="absolute top-6 right-6 w-12 h-12 rounded-full bg-white/5 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all cursor-pointer"
          @click.stop="lightboxOpen = false"
        >
          <X :size="20" />
        </button>
        <div class="max-w-[90vw] max-h-[90vh] flex items-center justify-center shadow-2xl relative" @click.stop>
          <img :src="lightboxImg" alt="Xem ảnh lớn" class="max-w-full max-h-[90vh] object-contain border border-neutral-800" />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.reviews-spinner {
  width: 28px;
  height: 28px;
  border: 1.5px solid #e5e7eb;
  border-top-color: #111827;
  border-radius: 50%;
  animation: reviews-spin 0.75s linear infinite;
}
@keyframes reviews-spin {
  to {
    transform: rotate(360deg);
  }
}
.font-heading {
  font-family: var(--font-heading, "Inter", sans-serif);
  font-weight: 500;
}
.group-image:hover img {
  transform: scale(1.05);
}
</style>
