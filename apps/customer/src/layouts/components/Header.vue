<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Search, User, ShoppingBag, Menu, X, Heart, Scissors } from 'lucide-vue-next';
import axios from 'axios';
import { getProductCartDB } from '@/Views/Anonymous/CSDL/cartDB';
import { useWishlistStore } from '@/stores/useWishlistStore';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';
import { useDataStore } from '@/stores/useDataStore';
const API = import.meta.env.VITE_API_URL;
const route = useRoute();
const router = useRouter();
const scrolled = ref(false);
const mobileMenuOpen = ref(false);
const currentUser = ref<any>(null);
let checkSessionInterval: ReturnType<typeof setInterval>;

const cartCount = ref(0);
const wishlistStore = useWishlistStore();
const bookingBasketStore = useBookingBasketStore();
const wishlistCount = computed(() => (wishlistStore.favoriteProducts?.length || 0) + (wishlistStore.favoriteServices?.length || 0) + (wishlistStore.favoriteEmployees?.length || 0));



const updateCartCount = async () => {
  const user = localStorage.getItem('user');
  let maKH = 'GUEST';
  if (user) {
    try {
      maKH = JSON.parse(user).maKH || 'GUEST';
    } catch (e) {
      maKH = 'GUEST';
    }
  }
  // Chỉ đếm sản phẩm vật lý (SANPHAM/BIENTHE), không đếm dịch vụ/combo
  const productItems = await getProductCartDB(maKH);
  cartCount.value = productItems.length;
};

watch(currentUser, () => {
  updateCartCount();
});

const checkUser = () => {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      currentUser.value = JSON.parse(userData);
    } catch (e) {
      currentUser.value = null;
    }
  } else {
    currentUser.value = null;
  }
};

const handleLogout = () => {
  localStorage.removeItem('user');
  currentUser.value = null;
  window.dispatchEvent(new Event('user-updated'));
  router.push({ name: 'login' });
};



const getHeaderAvatarUrl = (user: any) => {
  if (!user) return '';
  const imgPath = user.hinhAnh || user.picture || user.avatar;
  if (!imgPath) return '';
  if (imgPath.startsWith('http')) return imgPath;
  const baseUrl = API || 'https://localhost:7196';
  const cleanPath = imgPath.startsWith('/') ? imgPath : '/' + imgPath;
  return `${baseUrl}${cleanPath}`;
};

// ======================================================
// DANH MỤC SẢN PHẨM — load từ backend cho mega menu
// ======================================================
const productCategories = ref<any[]>([]);

const fetchProductCategories = async () => {
  try {
    const res = await axios.get(`${API}/api/DanhMucSP/san-pham`);
    productCategories.value = res.data || [];
  } catch (err) {
    console.error('Lỗi lấy danh mục sản phẩm cho menu:', err);
  }
};

// Chia danh mục thành các cột (tối đa 3 danh mục/cột) để mega menu không quá dài 1 cột
const productCategoryColumns = computed(() => {
  const perColumn = 3;
  const cols: any[][] = [];
  for (let i = 0; i < productCategories.value.length; i += perColumn) {
    cols.push(productCategories.value.slice(i, i + perColumn));
  }
  return cols;
});

// Điều hướng sang trang Product kèm filter danh mục
const goToProductCategory = (maDM: string) => {
  router.push({ name: 'Product', query: { danhMuc: maDM } });
  mobileMenuOpen.value = false;
};

// Single source of truth cho navigation (Web và Mobile dùng chung 100%)
const navLinks: any[] = [
  { name: 'home', label: 'Trang chủ' },
  { name: 'dmdv', label: 'Dịch vụ', match: 'dmdv' },
  { 
    name: 'shop', 
    label: 'Sản phẩm', 
    match: 'product',
    mega: true,
    isProductMenu: true // đánh dấu để template biết render danh mục động từ API
  },
  { 
    name: 'employees', 
    label: 'Chuyên viên',
    dropdown: true,
    match: 'chuyen-vien',
    children: [
      { label: 'Đội ngũ chuyên viên', name: 'employees' },
      { label: 'Chuyên viên yêu thích', name: 'favorite_employees' }
    ]
  },
  { name: 'khuyenMai', label: 'Khuyến Mãi' },
  { name: 'datdichvu', label: 'Đặt lịch', match: 'dat-dich-vu' }
];

const handleScroll = () => {
  scrolled.value = window.scrollY >= 50;
};

watch(mobileMenuOpen, (isOpen) => {
  if (isOpen) {
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = '';
  }
});

onMounted(() => {
  window.addEventListener('scroll', handleScroll);
  checkUser();
  window.addEventListener('storage', checkUser);
  window.addEventListener('user-updated', checkUser);
  fetchProductCategories();

  window.addEventListener('cart-updated', updateCartCount);
  updateCartCount();

  // Tự động kiểm tra phiên đăng nhập mỗi 5 phút
  checkSessionInterval = setInterval(async () => {
    if (!currentUser.value) return; // Chỉ kiểm tra khi có user đăng nhập
    try {
      await axios.get(API + '/api/account/verify-session', {
        withCredentials: true // Quan trọng để gửi kèm cookie HttpOnly
      });
    } catch (error: any) {
      if (error.response && error.response.status === 401) {
        clearInterval(checkSessionInterval);
        alert('Phiên đăng nhập đã hết hạn hoặc bạn đã bị đăng xuất từ thiết bị khác. Vui lòng đăng nhập lại!');
        handleLogout();
      }
    }
  }, 60000); // 60,000 ms = 1 phút
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  window.removeEventListener('storage', checkUser);
  window.removeEventListener('user-updated', checkUser);
  window.removeEventListener('cart-updated', updateCartCount);
  document.body.style.overflow = '';
  if (checkSessionInterval) {
    clearInterval(checkSessionInterval);
  }
});
// ===== TÌM KIẾM SẢN PHẨM INLINE =====
const dataStore = useDataStore();
const searchQuery = ref('');
const showDropdown = ref(false);

// Lọc sản phẩm theo tên khi gõ
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q || q.length < 1) return [];
  return dataStore.PRODUCTS
    .filter((p: any) => (p.name || '').toLowerCase().includes(q))
    .slice(0, 8); // tối đa 8 kết quả
});

const selectProduct = (prod: any) => {
  router.push({ name: 'product_detail', params: { id: prod.id } });
  searchQuery.value = '';
  showDropdown.value = false;
  mobileMenuOpen.value = false;
};

const onSearchFocus = () => { showDropdown.value = true; };
const onSearchBlur = () => { setTimeout(() => { showDropdown.value = false; }, 200); };
</script>

<template>
  <div class="w-full sticky top-0 z-[60]">
    
    <!-- ============================================== -->
    <!-- 1. MOBILE MENU OVERLAY (Full Screen)           -->
    <!-- ============================================== -->
    <div :class="['min-[768px]:hidden fixed inset-0 bg-white z-[70] flex flex-col transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]', mobileMenuOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-8 pointer-events-none']">
      <!-- Top: Logo & Close -->
      <div class="h-[72px] flex items-center justify-between px-6 border-b border-gray-100">
        <span class="font-heading text-xl tracking-[0.25em] font-medium text-black">LGHair</span>
        <button @click="mobileMenuOpen = false" class="text-black p-2 -mr-2">
          <X :size="24" :stroke-width="1.5" />
        </button>
      </div>

      <!-- Search Area -->
      <div class="px-6 pt-10 pb-6">
        <div class="flex items-center relative w-full">
          <input 
            v-model="searchQuery"
            type="text" 
            placeholder="TÌM KIẾM" 
            @keyup.enter="handleSearch"
            class="w-full bg-transparent border-0 border-b border-gray-200 focus:border-black focus:ring-0 outline-none px-0 py-2 pr-8 text-[12px] uppercase tracking-[0.15em] text-black placeholder:text-gray-400 transition-colors"
          />
          <button @click="handleSearch" class="absolute right-0 text-black hover:text-gray-500 transition-colors" aria-label="Search">
            <Search :size="20" :stroke-width="1.5" />
          </button>
        </div>
      </div>

      <!-- Vertical Menu -->
      <nav class="flex flex-col px-6 py-6 gap-8 overflow-y-auto">
        <template v-for="link in navLinks" :key="link.label">

          <!-- Menu Sản phẩm: load danh mục thật từ API, expand luôn ở mobile -->
          <div v-if="link.isProductMenu" class="flex flex-col gap-4">
            <router-link
              :to="{ name: link.name || 'home' }"
              @click="mobileMenuOpen = false"
              class="text-xl font-heading uppercase tracking-[0.2em] text-left text-black"
            >
              {{ link.label }}
            </router-link>
            <div class="flex flex-col gap-3 pl-4 border-l border-gray-200">
              <button
                v-for="cat in productCategories"
                :key="cat.maDM"
                @click="goToProductCategory(cat.maDM)"
                class="text-left text-xs uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
              >
                {{ cat.tenDanhMuc }}
              </button>
            </div>
          </div>

          <div v-else-if="link.children" class="flex flex-col gap-4">
            <router-link
              :to="{ name: link.name || 'home' }"
              @click="mobileMenuOpen = false"
              class="text-xl font-heading uppercase tracking-[0.2em] text-left text-black"
            >
              {{ link.label }}
            </router-link>
            <div class="flex flex-col gap-3 pl-4 border-l border-gray-200">
              <router-link
                v-for="sub in link.children"
                :key="sub.label"
                :to="{ name: sub.name }"
                @click="mobileMenuOpen = false"
                class="text-left text-xs uppercase tracking-widest text-gray-500 hover:text-black transition-colors"
              >
                {{ sub.label }}
              </router-link>
            </div>
          </div>

          <router-link 
            v-else
            :to="{ name: link.name || 'home' }" 
            @click="mobileMenuOpen = false" 
            class="text-xl font-heading uppercase tracking-[0.2em] text-left text-black"
          >
            {{ link.label }}
          </router-link>
        </template>
      </nav>
    </div>

    <!-- ============================================== -->
    <!-- 2. DESKTOP HEADER (>= 768px)                   -->
    <!-- ============================================== -->
    <header :class="['hidden min-[768px]:block w-full transition-all duration-300', scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50 py-0' : 'bg-white border-b border-gray-100 py-2']">
      <div class="h-[64px] flex items-center justify-between px-6 lg:px-12 max-w-[1440px] mx-auto w-full">
        <!-- Desktop Logo -->
        <div class="flex-1 flex justify-start cursor-pointer">
          <router-link :to="{ name: 'home' }" class="font-heading text-xl lg:text-2xl tracking-[0.25em] font-medium text-black">
            LGHair
          </router-link>
        </div>

        <!-- Desktop Horizontal Nav -->
        <nav class="flex-5 flex justify-center items-center gap-6 lg:gap-8 whitespace-nowrap">
          <div 
            v-for="link in navLinks" 
            :key="link.label"
            class="relative group"
          >
            <router-link 
              :to="{ name: link.name || 'home' }" 
              :class="[
                'text-[11px] lg:text-[12px] uppercase tracking-[0.2em] font-medium transition-colors py-6 inline-flex items-center gap-1', 
                (link.match && route.path.includes(link.match)) || route.name === link.name ? 'text-black' : 'text-gray-400 hover:text-black'
              ]"
            >
              {{ link.label }}
              <svg v-if="link.children || link.isProductMenu" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="transition-transform duration-300 group-hover:rotate-180 opacity-60"><path d="m6 9 6 6 6-6"/></svg>
            </router-link>

            <!-- Dropdown / Mega Menu Container -->
            <div v-if="link.children || link.isProductMenu" 
                 class="absolute top-full left-1/2 -translate-x-1/2 pt-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0"
            >
              <!-- Mega Menu DANH MỤC SẢN PHẨM (động từ API) -->
              <div v-if="link.isProductMenu" class="bg-white border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] p-8 flex gap-12 w-max rounded-sm max-w-[600px]">
                <template v-if="productCategories.length > 0">
                  <div v-for="(col, colIdx) in productCategoryColumns" :key="colIdx">
                    <ul class="space-y-4">
                      <li v-for="cat in col" :key="cat.maDM">
                        <button
                          @click="goToProductCategory(cat.maDM)"
                          class="text-[11px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors block text-left whitespace-nowrap"
                        >
                          {{ cat.tenDanhMuc }}
                        </button>
                      </li>
                    </ul>
                  </div>
                </template>
                <p v-else class="text-[11px] uppercase tracking-widest text-gray-400">Đang tải danh mục...</p>
              </div>

              <!-- Mega Menu cũ (giữ lại nếu sau này có dùng dạng category > children) -->
              <div v-else-if="link.mega" class="bg-white border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] p-8 flex gap-12 w-max rounded-sm">
                <div v-for="category in link.children" :key="category.label">
                  <h4 class="text-[10px] text-black uppercase tracking-[0.2em] font-semibold mb-5">{{ category.label }}</h4>
                  <ul class="space-y-4">
                    <li v-for="sub in category.children" :key="sub.label">
                      <router-link :to="{ name: sub.name }" class="text-[11px] uppercase tracking-widest text-gray-500 hover:text-black transition-colors block">
                        {{ sub.label }}
                      </router-link>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Simple Dropdown for Brands -->
              <div v-else class="bg-white border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] py-4 min-w-[200px] rounded-sm">
                <ul class="space-y-1">
                  <li v-for="brand in link.children" :key="brand.label">
                    <router-link :to="{ name: brand.name }" class="block px-8 py-3 text-[11px] uppercase tracking-widest text-gray-500 hover:text-black hover:bg-gray-50 transition-colors text-center">
                      {{ brand.label }}
                    </router-link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </nav>

        <!-- Desktop Icons -->
        <div class="flex-1 flex justify-end items-center space-x-5 lg:space-x-6">
          <!-- Desktop Search with Dropdown -->
          <div class="flex items-center relative" @focusout="onSearchBlur">
            <input 
              v-model="searchQuery"
              type="text" 
              placeholder="TÌM KIẾM SẢN PHẨM..." 
              @focus="onSearchFocus"
              autocomplete="off"
              class="w-32 lg:w-64 bg-transparent border-b border-gray-300 focus:border-black outline-none px-0 py-2 pr-6 text-[10px] lg:text-[10px] uppercase tracking-[0.15em] text-black placeholder:text-gray-500 transition-all duration-300"
            />
            <Search :size="16" :stroke-width="1.5" class="absolute right-0 text-black opacity-50" />

            <!-- Dropdown kết quả -->
            <transition
              enter-active-class="transition duration-150 ease-out"
              enter-from-class="opacity-0 translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-100 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-1"
            >
              <div
                v-if="showDropdown && searchQuery.trim().length > 0"
                class="absolute top-full right-0 mt-2 w-72 bg-white border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.12)] rounded-sm z-[200] overflow-hidden"
              >
                <template v-if="searchResults.length > 0">
                  <button
                    v-for="prod in searchResults"
                    :key="prod.id"
                    @mousedown.prevent="selectProduct(prod)"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-50 last:border-0"
                  >
                    <img
                      :src="prod.img || 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=100'"
                      :alt="prod.name"
                      class="w-10 h-10 object-cover rounded-sm flex-shrink-0"
                    />
                    <div class="flex-1 min-w-0">
                      <p class="text-[11px] uppercase tracking-widest text-black truncate">{{ prod.name }}</p>
                      <p class="text-[10px] text-gray-400 mt-0.5">{{ prod.price ? Number(prod.price).toLocaleString('vi-VN') + ' đ' : '' }}</p>
                    </div>
                  </button>
                </template>
                <div v-else class="px-4 py-5 text-center">
                  <p class="text-[11px] uppercase tracking-widest text-gray-400">Không tìm thấy sản phẩm</p>
                </div>
              </div>
            </transition>
          </div>

          <router-link :to="{ name: 'wishlist' }" class="text-black hover:text-gray-500 transition-colors relative" aria-label="Wishlist">
            <Heart :size="20" :stroke-width="1.5" />
            <span class="absolute -top-1 -right-1 w-3 h-3 text-white text-[8px] flex items-center justify-center rounded-full" :class="wishlistCount > 0 ? 'bg-red-500' : 'bg-black'">{{ wishlistCount }}</span>
          </router-link>

          <div class="relative group">
            <button class="text-black hover:text-gray-500 transition-colors py-4 flex items-center justify-center" aria-label="Account">
              <template v-if="currentUser">
                <div class="w-6 h-6 rounded-full overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center bg-gray-50">
                  <img 
                    :src="getHeaderAvatarUrl(currentUser) || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.hoTen || currentUser.name || currentUser.username || 'U') + '&background=random')" 
                    alt="Avatar" 
                    class="w-full h-full object-cover"
                  />
                </div>
              </template>
              <template v-else>
                <User :size="22" :stroke-width="1.5" />
              </template>
            </button>
            <!-- User Dropdown -->
            <div class="absolute top-full right-0 pt-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-50">
              <div class="bg-white border border-gray-100 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] py-4 min-w-[200px] rounded-sm text-left">

                <template v-if="currentUser">
                  <div class="px-6 py-2 mb-2 border-b border-gray-100">
                    <p class="text-xs font-medium text-black">{{ currentUser.hoTen || currentUser.name || currentUser.username || 'Người dùng' }}</p>
                    <p v-if="currentUser.email" class="text-[10px] text-gray-500 truncate mt-1">{{ currentUser.email }}</p>
                  </div>

                  <router-link :to="{ name: 'profile' }" class="block px-6 py-2.5 text-[11px] uppercase tracking-widest text-gray-600 hover:text-black hover:bg-gray-50 transition-colors">
                    Hồ Sơ Của Tôi
                  </router-link>
                  <router-link :to="{ name: 'favorite_employees' }" class="block px-6 py-2.5 text-[11px] uppercase tracking-widest text-gray-600 hover:text-black hover:bg-gray-50 transition-colors">
                    Chuyên Viên Yêu Thích
                  </router-link>
                  <router-link :to="{ name: 'profile' }" class="block px-6 py-2.5 text-[11px] uppercase tracking-widest text-gray-600 hover:text-black hover:bg-gray-50 transition-colors">
                    Đơn Hàng
                  </router-link>
                  <div class="h-px bg-gray-100 my-2"></div>
                  <button @click="handleLogout" class="w-full text-left block px-6 py-2.5 text-[11px] uppercase tracking-widest text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors">
                    Đăng Xuất
                  </button>
                </template>

                <template v-else>
                  <router-link :to="{ name: 'login' }" class="block px-6 py-2.5 text-[11px] uppercase tracking-widest text-gray-600 hover:text-black hover:bg-gray-50 transition-colors">
                    Đăng Nhập
                  </router-link>
                </template>
              </div>
            </div>
          </div>

          <router-link :to="{ name: 'cart' }" class="text-black hover:text-gray-500 transition-colors relative" aria-label="Cart">
            <ShoppingBag :size="22" :stroke-width="1.5" />
            <span class="absolute -top-1 -right-1 w-3 h-3 text-white text-[8px] flex items-center justify-center rounded-full" :class="cartCount > 0 ? 'bg-red-500' : 'bg-black'">{{ cartCount }}</span>
          </router-link>
        </div>
      </div>
    </header>

    <!-- ============================================== -->
    <!-- 3. MOBILE HEADER (< 768px)                     -->
    <!-- ============================================== -->
    <header :class="['min-[768px]:hidden w-full transition-all duration-300', scrolled ? 'bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-200/50' : 'bg-white border-b border-gray-100']">
      <div class="h-[72px] flex items-center justify-between px-6 w-full">
        <!-- Mobile Logo -->
        <router-link :to="{ name: 'home' }" class="font-heading text-xl tracking-[0.25em] font-medium text-black">
          LGHair
        </router-link>

        <!-- Mobile Icons -->
        <div class="flex items-center space-x-5">
          <router-link :to="{ name: 'wishlist' }" class="text-black hover:text-gray-500 transition-colors relative" aria-label="Wishlist">
            <Heart :size="20" :stroke-width="1.5" />
            <span class="absolute -top-1 -right-1 w-3 h-3 text-white text-[8px] flex items-center justify-center rounded-full" :class="wishlistCount > 0 ? 'bg-red-500' : 'bg-black'">{{ wishlistCount }}</span>
          </router-link>
          <button @click="bookingBasketStore.openDrawer()" class="text-black hover:text-gray-500 transition-colors relative" aria-label="Khay dịch vụ">
            <Scissors :size="18" :stroke-width="1.5" />
            <span v-if="bookingBasketStore.itemCount > 0" class="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[8px] flex items-center justify-center rounded-full">{{ bookingBasketStore.itemCount }}</span>
          </button>
          <router-link :to="{ name: currentUser ? 'profile' : 'login' }" class="text-black hover:text-gray-500 transition-colors flex items-center justify-center" aria-label="Account">
            <template v-if="currentUser">
              <div class="w-5 h-5 rounded-full overflow-hidden border border-gray-200 shrink-0 flex items-center justify-center bg-gray-50">
                <img 
                  :src="getHeaderAvatarUrl(currentUser) || ('https://ui-avatars.com/api/?name=' + encodeURIComponent(currentUser.hoTen || currentUser.name || currentUser.username || 'U') + '&background=random')" 
                  alt="Avatar" 
                  class="w-full h-full object-cover"
                />
              </div>
            </template>
            <template v-else>
              <User :size="20" :stroke-width="1.5" />
            </template>
          </router-link>
          <router-link :to="{ name: 'cart' }" class="text-black hover:text-gray-500 transition-colors relative" aria-label="Cart">
            <ShoppingBag :size="20" :stroke-width="1.5" />
            <span class="absolute -top-1 -right-1 w-3 h-3 text-white text-[8px] flex items-center justify-center rounded-full" :class="cartCount > 0 ? 'bg-red-500' : 'bg-black'">{{ cartCount }}</span>
          </router-link>
          <button 
            @click="mobileMenuOpen = true"
            class="text-black hover:text-gray-500 transition-colors -mr-2 p-2"
            aria-label="Open Menu"
          >
            <Menu :size="24" :stroke-width="1.5" />
          </button>
        </div>
      </div>
    </header>

  </div>
</template>