<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { Heart, Search, Star, Calendar, Sparkles } from 'lucide-vue-next';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
const router = useRouter();

// ==========================================
// STATE
// ==========================================
const employees = ref<any[]>([]);
const favorites = ref<string[]>([]);
const searchQuery = ref('');
const selectedRole = ref('all');
const loading = ref(true);
const error = ref(false);
const customer = ref<any>(null);

// ==========================================
// HELPER METHODS
// ==========================================
const getEmployeeImageUrl = (img?: string) => {
  if (!img) return 'https://ui-avatars.com/api/?name=NV&background=e0e0e0&color=000000';
  if (img.startsWith('http://') || img.startsWith('https://')) return img;
  if (img.startsWith('/')) return `${API}${img}`;
  return `${API}/${img}`;
};

const getCustomerKey = () => {
  const maKH = customer.value?.maKH || 'GUEST';
  return `favorite_employees_${maKH}`;
};

const getStarFillWidth = (starIndex: number, rating: number) => {
  if (rating >= starIndex) return '100%';
  if (rating > starIndex - 1) {
    return `${(rating - (starIndex - 1)) * 100}%`;
  }
  return '0%';
};

const loadFavorites = () => {
  const saved = localStorage.getItem(getCustomerKey());
  if (saved) {
    try {
      favorites.value = JSON.parse(saved);
    } catch (e) {
      favorites.value = [];
    }
  } else {
    favorites.value = [];
  }
};

const toggleFavorite = (employee: any) => {
  const user = localStorage.getItem('user');
  if (!user) {
    alert("Vui lòng đăng nhập để thêm chuyên viên vào danh sách yêu thích!");
    router.push({ name: 'login' });
    return;
  }
  const index = favorites.value.indexOf(employee.id);
  let updatedFavorites = [...favorites.value];
  
  if (index >= 0) {
    updatedFavorites.splice(index, 1);
  } else {
    updatedFavorites.push(employee.id);
    
    // Save details to quick reference for header dropdown
    localStorage.setItem(`employee_details_${employee.id}`, JSON.stringify({
      id: employee.id,
      name: employee.name,
      image: employee.image,
      role: employee.role,
      rating: employee.rating
    }));
  }
  
  favorites.value = updatedFavorites;
  localStorage.setItem(getCustomerKey(), JSON.stringify(updatedFavorites));
  
  // Dispatch custom event to notify Header.vue
  window.dispatchEvent(new CustomEvent('favorite-employees-updated'));
};

const isFavorite = (id: string) => {
  return favorites.value.includes(id);
};

const navigateToBooking = (stylistId: string) => {
  router.push({ name: 'datdichvu', query: { stylistId } });
};

// ==========================================
// API FETCH
// ==========================================
const fetchEmployees = async () => {
  try {
    loading.value = true;
    error.value = false;
    const res = await axios.get(`${API}/api/YeuThich/employees`);
    if (res.data) {
      // Map API fields if different
      employees.value = res.data.map((nv: any) => ({
        id: nv.id || nv.maNv,
        name: nv.name || nv.hoTenNv || 'Nhân viên',
        image: nv.image || nv.hinhAnh || '',
        role: nv.role || 'Stylist',
        rating: nv.rating || 5.0,
        category: nv.category || 'Nhân viên'
      }));
    }
  } catch (err) {
    console.error('Lỗi khi fetch danh sách nhân viên:', err);
    error.value = true;
  } finally {
    loading.value = false;
  }
};

// ==========================================
// FILTERED RESULTS
// ==========================================
const filteredEmployees = computed(() => {
  return employees.value.filter(emp => {
    const matchesSearch = emp.name.toLowerCase().includes(searchQuery.value.toLowerCase()) || 
                          emp.role.toLowerCase().includes(searchQuery.value.toLowerCase());
    
    const matchesRole = selectedRole.value === 'all' || 
                        emp.role.toLowerCase().includes(selectedRole.value.toLowerCase());
                        
    return matchesSearch && matchesRole;
  });
});

const uniqueRoles = computed(() => {
  const roles = new Set<string>();
  employees.value.forEach(emp => {
    if (emp.role) {
      roles.add(emp.role);
    }
  });
  return Array.from(roles);
});

// ==========================================
// PAGINATION LOGIC
// ==========================================
const currentPage = ref(1);
const pageSize = ref(8); // 8 stylists per page (2 rows of 4)

const totalPages = computed(() => {
  return Math.ceil(filteredEmployees.value.length / pageSize.value);
});

const paginatedEmployees = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredEmployees.value.slice(start, end);
});

const changePage = (page: number) => {
  if (page < 1 || page > totalPages.value) return;
  currentPage.value = page;
  window.scrollTo({ top: 200, behavior: 'smooth' });
};

const visiblePages = computed(() => {
  const pages: (number | string)[] = [];
  const total = totalPages.value;
  const current = currentPage.value;

  if (total <= 5) {
    for (let i = 1; i <= total; i++) {
      pages.push(i);
    }
  } else {
    if (current <= 3) {
      pages.push(1, 2, 3, "...", total);
    } else if (current >= total - 2) {
      pages.push(1, "...", total - 2, total - 1, total);
    } else {
      pages.push(1, "...", current - 1, current, current + 1, "...", total);
    }
  }
  return pages;
});

// Reset to first page when search or role filters change
watch([searchQuery, selectedRole], () => {
  currentPage.value = 1;
});

onMounted(() => {
  customer.value = getCustomerInfo();
  loadFavorites();
  fetchEmployees();
  
  // Listen for login/logout changes to reload favorites
  window.addEventListener('storage', () => {
    customer.value = getCustomerInfo();
    loadFavorites();
  });
});
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen bg-[#fafafa] pb-24">
    <!-- HERO HEADER -->
    <div class="bg-white border-b border-gray-100 py-16 lg:py-20 relative overflow-hidden">
      <div class="absolute inset-0 bg-radial-gradient from-gray-50/50 to-transparent opacity-60"></div>
      <div class="max-w-[1440px] mx-auto px-6 lg:px-12 text-center relative z-10">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-black text-white text-[9px] uppercase tracking-[0.2em] font-medium mb-4 rounded-full">
          <Sparkles :size="10" /> Đội ngũ chuyên nghiệp
        </span>
        <h1 class="text-3xl lg:text-5xl font-heading uppercase tracking-[0.25em] mb-4 text-black font-light">
          Chuyên Viên Tạo Mẫu
        </h1>
        <p class="max-w-2xl mx-auto text-xs lg:text-sm text-gray-500 font-light leading-relaxed tracking-wider">
          Gặp gỡ những nghệ nhân tóc xuất sắc nhất tại LGHair. Đội ngũ chuyên gia giàu kinh nghiệm của chúng tôi luôn sẵn sàng lắng nghe và kiến tạo phong cách riêng biệt hoàn hảo nhất cho bạn.
        </p>
      </div>
    </div>

    <!-- MAIN DIRECTORY CONTROLS -->
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 pt-12">
      <div class="bg-white border border-gray-100 p-4 md:p-6 flex flex-col md:flex-row gap-4 justify-between items-center mb-12 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.02)]">
        <!-- Search Input -->
        <div class="relative w-full md:w-96 flex items-center">
          <Search class="absolute left-4 text-gray-400" :size="16" />
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="Tìm kiếm chuyên viên..." 
            class="w-full h-11 pl-11 pr-4 bg-gray-50 border-0 focus:bg-white focus:ring-1 focus:ring-black outline-none text-xs uppercase tracking-widest placeholder:text-gray-400 transition-all font-light font-heading"
          />
        </div>

        <!-- Filter Dropdown & Counters -->
        <div class="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          <div class="flex items-center gap-2">
            <span class="text-[10px] uppercase tracking-widest text-gray-400 whitespace-nowrap font-heading">Bộ lọc:</span>
            <select 
              v-model="selectedRole" 
              class="h-11 px-4 bg-gray-50 border-0 outline-none text-xs uppercase tracking-widest font-light focus:ring-1 focus:ring-black focus:bg-white transition-all cursor-pointer min-w-[160px] font-heading"
            >
              <option value="all">Tất cả vai trò</option>
              <option v-for="role in uniqueRoles" :key="role" :value="role">{{ role }}</option>
            </select>
          </div>
          
          <span class="text-[10px] uppercase tracking-widest text-gray-400 bg-gray-50 px-4 py-3 whitespace-nowrap font-heading">
            Hiển thị {{ filteredEmployees.length }} thành viên
          </span>
        </div>
      </div>

      <!-- LOADING STATE -->
      <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-4">
        <div class="employee-spinner"></div>
        <p class="text-[11px] uppercase tracking-[0.2em] text-gray-400 font-heading">Đang tải danh sách chuyên viên...</p>
      </div>

      <!-- ERROR STATE -->
      <div v-else-if="error" class="flex flex-col items-center justify-center py-32 text-center bg-white border border-gray-100 rounded-sm">
        <p class="text-sm tracking-widest uppercase text-gray-400 mb-6 font-heading">Lỗi kết nối. Không thể tải danh sách chuyên viên.</p>
        <button @click="fetchEmployees" class="px-8 py-3.5 bg-black text-white text-[11px] uppercase tracking-widest hover:bg-gray-800 transition-colors cursor-pointer font-heading">
          Thử lại
        </button>
      </div>

      <!-- GRID CARDS -->
      <div v-else>
        <div v-if="filteredEmployees.length > 0">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8 mb-12">
            <div 
              v-for="emp in paginatedEmployees" 
              :key="emp.id" 
              class="group bg-white border border-gray-100/80 flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.05)] hover:border-black/20"
            >
              <!-- Favorite button -->
              <button 
                @click.stop="toggleFavorite(emp)"
                class="absolute top-4 right-4 z-10 w-9 h-9 bg-white/80 backdrop-blur-xs rounded-full flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-white transition-all shadow-sm border border-gray-100 cursor-pointer"
                :aria-label="isFavorite(emp.id) ? 'Xóa khỏi yêu thích' : 'Thêm vào yêu thích'"
              >
                <Heart 
                  :size="16" 
                  :class="{'fill-red-500 text-red-500 scale-110': isFavorite(emp.id)}" 
                  class="transition-transform duration-300"
                />
              </button>

              <!-- Employee Avatar -->
              <div class="aspect-[3/4] overflow-hidden bg-gray-50 relative border-b border-gray-50">
                <img 
                  :src="getEmployeeImageUrl(emp.image)" 
                  :alt="emp.name" 
                  class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  loading="lazy"
                />
                <div class="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>

              <!-- Card Info Body -->
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

                <!-- CTA Buttons -->
                <div class="grid grid-cols-1 gap-2 pt-2 border-t border-gray-100">
                  <button 
                    @click="navigateToBooking(emp.id)"
                    class="w-full h-11 bg-black text-white text-[10px] uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 cursor-pointer font-medium font-heading"
                  >
                    <Calendar :size="12" /> Đặt lịch ngay
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- PAGINATION CONTROLS -->
          <div class="pagination-wrapper" v-if="totalPages > 1">
            <button
              type="button"
              class="pagination-btn prev-next"
              :disabled="currentPage === 1"
              @click="changePage(currentPage - 1)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>

            <div class="page-numbers">
              <button
                v-for="(page, idx) in visiblePages"
                :key="idx"
                class="page-num-btn"
                :class="{ active: currentPage === page }"
                @click="typeof page === 'number' && changePage(page)"
                :disabled="page === '...'"
              >
                {{ page === "..." ? "..." : typeof page === "number" && page < 10 ? "0" + page : page }}
              </button>
            </div>

            <button
              type="button"
              class="pagination-btn prev-next"
              :disabled="currentPage === totalPages"
              @click="changePage(currentPage + 1)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="transform: rotate(180deg);">
                <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <!-- EMPTY STATE -->
        <div v-else class="flex flex-col items-center justify-center py-32 text-center bg-white border border-gray-100 rounded-sm">
          <p class="text-sm tracking-widest uppercase text-gray-400 mb-8 font-heading">Không tìm thấy chuyên viên phù hợp.</p>
          <button @click="searchQuery = ''; selectedRole = 'all'" class="px-8 py-3.5 bg-black text-white text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors cursor-pointer font-heading">
            Đặt lại bộ lọc
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.employee-spinner {
  width: 36px;
  height: 36px;
  border: 1.5px solid #f3f4f6;
  border-top-color: #000000;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.font-heading {
  font-family: var(--font-heading, 'Inter', sans-serif);
  letter-spacing: 0.1em;
}

/* PAGINATION STYLES */
.pagination-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-top: 40px;
  margin-bottom: 20px;
  font-family: var(--font-heading, 'Inter', sans-serif);
}

.page-numbers {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-num-btn {
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  color: #9ca3af;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 1px;
  width: 36px;
  height: 36px;
  border-radius: 0;
  transition: all 0.3s ease;
  position: relative;
  cursor: pointer;
}

.page-num-btn.active {
  color: #000000;
  font-weight: 600;
  border-bottom-color: #000000;
}

.page-num-btn:hover:not(.active) {
  color: #000000;
  background: transparent;
}

.pagination-btn.prev-next {
  background: #ffffff !important;
  border: 1px solid #e7e5e2 !important;
  color: #1a1a1a !important;
  width: 42px;
  height: 42px;
  border-radius: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  transition: all 0.3s ease;
  cursor: pointer;
}

.pagination-btn.prev-next:hover:not(:disabled) {
  background: #1a1a1a !important;
  border-color: #1a1a1a !important;
  color: #ffffff !important;
}

.pagination-btn.prev-next:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
</style>
