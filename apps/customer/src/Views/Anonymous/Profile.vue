<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { User, Package, Calendar, LogOut, Star } from 'lucide-vue-next';
import axios from 'axios';
import { useRouter } from 'vue-router';
import LichSuDanhGia from './Profile/lichsudanhgia.vue';
import LichSuDanhGiaSanPham from './Profile/lichsudanhgiasanpham.vue';

const router = useRouter();
const activeTab = ref('profile');
const reviewSubTab = ref<'service' | 'product'>('service');

const profileForm = ref({
  firstName: '',
  lastName: '',
  email: '',
  phone: ''
});

const userRank = ref('Member');

const greetingName = computed(() => {
  return profileForm.value.lastName || profileForm.value.firstName || 'Khách hàng';
});

const updateProfileFields = (hoTen?: string | null, email?: string | null, phone?: string | null, rank?: string | null) => {
  const name = (hoTen || '').trim();
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    profileForm.value.lastName = parts[parts.length - 1] || '';
    profileForm.value.firstName = parts.slice(0, parts.length - 1).join(' ');
  } else {
    profileForm.value.firstName = name;
    profileForm.value.lastName = '';
  }
  profileForm.value.email = email || '';
  profileForm.value.phone = phone || '';
  if (rank) {
    userRank.value = rank;
  }
};

const fetchProfile = async () => {
  try {
    const res = await axios.get('https://localhost:7196/api/Profile/me');
    if (res.data.success && res.data.data) {
      const data = res.data.data;
      updateProfileFields(data.hoTen, data.email, data.sdt, data.tenRank);
      
      // Sync to localStorage as well to keep local cache updated
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        user.hoTen = data.hoTen;
        user.email = data.email;
        user.sdt = data.sdt;
        user.tenRank = data.tenRank;
        if (data.hinhAnh) user.hinhAnh = data.hinhAnh;
        localStorage.setItem('user', JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      }
    }
  } catch (err) {
    console.error('Lỗi khi lấy thông tin profile từ server, sử dụng dữ liệu local:', err);
    loadLocalProfile();
  }
};

const loadLocalProfile = () => {
  const userData = localStorage.getItem('user');
  if (userData) {
    try {
      const user = JSON.parse(userData);
      updateProfileFields(user.hoTen, user.email, user.sdt, user.tenRank);
    } catch (e) {
      console.error('Lỗi phân tích user từ localStorage:', e);
    }
  }
};

onMounted(() => {
  fetchProfile();
});

const saveProfile = async () => {
  try {
    const hoTen = `${profileForm.value.firstName} ${profileForm.value.lastName}`.trim();
    if (!hoTen) {
      alert('Vui lòng nhập họ và tên.');
      return;
    }
    if (!profileForm.value.phone) {
      alert('Vui lòng nhập số điện thoại.');
      return;
    }
    
    const res = await axios.put('https://localhost:7196/api/Profile/update', {
      hoTen,
      sdt: profileForm.value.phone,
      email: profileForm.value.email,
      gioiTinh: null
    });

    if (res.data.success) {
      alert('Thông tin đã được cập nhật thành công!');
      
      // Update local storage
      const userData = localStorage.getItem('user');
      if (userData) {
        const user = JSON.parse(userData);
        user.hoTen = hoTen;
        user.email = profileForm.value.email;
        user.sdt = profileForm.value.phone;
        localStorage.setItem('user', JSON.stringify(user));
        window.dispatchEvent(new Event('storage'));
      }
      
      await fetchProfile();
    } else {
      alert(res.data.message || 'Cập nhật thất bại.');
    }
  } catch (err: any) {
    console.error(err);
    alert(err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật thông tin.');
  }
};

const handleLogout = () => {
  if (confirm('Bạn có chắc chắn muốn đăng xuất?')) {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    window.location.href = '/login';
  }
};

const handleLogoutAll = async () => {
  if (confirm('Bạn có chắc chắn muốn đăng xuất khỏi TẤT CẢ thiết bị (kể cả máy này)?')) {
    try {
      await axios.post('https://localhost:7196/api/account/logout-all', {}, {
        withCredentials: true
      });
      alert('Đã đăng xuất khỏi tất cả thiết bị.');
      localStorage.removeItem('user');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    } catch (error) {
      console.error(error);
      alert('Đăng xuất thất bại. Vui lòng thử lại.');
    }
  }
};
</script>

<template>
  <div class="w-full bg-[#fcfcfc] min-h-screen py-10 lg:py-16 animate-in fade-in duration-500">
    <div class="max-w-[1024px] mx-auto px-4 lg:px-8">

      <div class="flex flex-col lg:flex-row gap-8 lg:gap-12">

        <!-- Sidebar Navigation -->
        <aside class="w-full lg:w-64 shrink-0">
          <div class="mb-8 hidden lg:block">
            <h2 class="font-heading text-xl uppercase tracking-widest text-black mb-2">Xin chào, {{
              greetingName }}</h2>
            <div class="inline-block px-3 py-1 bg-black text-white text-[9px] uppercase tracking-widest font-medium">
              BEFOR {{ userRank }}</div>
          </div>

          <!-- Mobile Profile Header -->
          <div class="mb-6 lg:hidden flex items-center justify-between border-b border-gray-200 pb-4">
            <h2 class="font-heading text-lg uppercase tracking-widest text-black">Hồ sơ</h2>
            <div class="inline-block px-2 py-1 bg-black text-white text-[8px] uppercase tracking-widest font-medium">
              {{ userRank }}</div>
          </div>

          <nav class="flex flex-row lg:flex-col gap-2 overflow-x-auto pb-4 lg:pb-0 scrollbar-hide whitespace-nowrap">
            <button @click="activeTab = 'profile'"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'profile' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-600 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <User :size="16" :stroke-width="1.5" />
              Hồ Sơ Của Tôi
            </button>
            <button @click="activeTab = 'orders'"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'orders' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-600 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Package :size="16" :stroke-width="1.5" />
              Đơn Hàng
            </button>
            <button @click="activeTab = 'appointments'"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'appointments' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-600 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Calendar :size="16" :stroke-width="1.5" />
              Lịch Hẹn
            </button>
            <button @click="activeTab = 'reviews'"
              :class="['flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest transition-all rounded-sm', activeTab === 'reviews' ? 'bg-white border-l-2 border-black text-black shadow-sm font-semibold' : 'text-gray-600 hover:text-black hover:bg-gray-100/50 border-l-2 border-transparent']">
              <Star :size="16" :stroke-width="1.5" />
              Đánh Giá
            </button>

            <div class="w-px h-6 lg:w-full lg:h-px bg-gray-200 my-auto lg:my-3 shrink-0"></div>

            <button @click="handleLogout"
              class="flex items-center gap-3 px-4 py-3.5 text-[11px] uppercase tracking-widest text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors border-l-2 border-transparent rounded-sm">
              <LogOut :size="16" :stroke-width="1.5" />
              Đăng Xuất
            </button>
          </nav>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 min-w-0">
          <!-- Tab: Profile -->
          <div v-if="activeTab === 'profile'"
            class="bg-white p-6 lg:p-10 border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm">
            <h1
              class="font-heading text-xl lg:text-2xl uppercase tracking-[0.2em] mb-8 pb-4 border-b border-gray-200 text-black">
              Thông Tin Cá Nhân</h1>

            <form @submit.prevent="saveProfile" class="space-y-6 max-w-xl">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-[10px] uppercase tracking-widest text-gray-700 font-semibold mb-2">Họ</label>
                  <input v-model="profileForm.firstName" type="text"
                    class="w-full bg-white border border-gray-300 focus:border-black outline-none px-4 py-3 text-sm transition-all focus:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.1)] rounded-sm text-black" />
                </div>
                <div>
                  <label
                    class="block text-[10px] uppercase tracking-widest text-gray-700 font-semibold mb-2">Tên</label>
                  <input v-model="profileForm.lastName" type="text"
                    class="w-full bg-white border border-gray-300 focus:border-black outline-none px-4 py-3 text-sm transition-all focus:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.1)] rounded-sm text-black" />
                </div>
              </div>

              <div>
                <label
                  class="block text-[10px] uppercase tracking-widest text-gray-700 font-semibold mb-2">Email</label>
                <input v-model="profileForm.email" type="email"
                  class="w-full bg-white border border-gray-300 focus:border-black outline-none px-4 py-3 text-sm transition-all focus:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.1)] rounded-sm text-black" />
              </div>

              <div>
                <label class="block text-[10px] uppercase tracking-widest text-gray-700 font-semibold mb-2">Số điện
                  thoại</label>
                <input v-model="profileForm.phone" type="tel"
                  class="w-full bg-white border border-gray-300 focus:border-black outline-none px-4 py-3 text-sm transition-all focus:shadow-[0_4px_14px_-6px_rgba(0,0,0,0.1)] rounded-sm text-black" />
              </div>

              <div class="pt-6">
                <button type="submit"
                  class="bg-black text-white px-8 py-3.5 text-[11px] uppercase tracking-[0.2em] font-medium transition-all hover:bg-gray-900 hover:shadow-lg hover:-translate-y-0.5 rounded-sm">
                  Lưu thay đổi
                </button>
              </div>
            </form>

            <div class="pt-8 mt-8 border-t border-gray-100">
              <h3 class="text-sm font-semibold uppercase tracking-widest text-red-600 mb-3">Bảo mật</h3>
              <p class="text-[11px] text-gray-500 mb-5">Đăng xuất tài khoản của bạn khỏi tất cả các thiết bị (bao gồm cả
                máy này).</p>
              <button type="button" @click="handleLogoutAll"
                class="bg-white text-red-600 border border-red-200 px-6 py-3 text-[10px] uppercase tracking-[0.2em] font-medium transition-all hover:bg-red-50 hover:border-red-300 rounded-sm">
                Đăng xuất tất cả thiết bị
              </button>
            </div>
          </div>

          <!-- Tab: Orders (Empty State) -->
          <div v-else-if="activeTab === 'orders'"
            class="bg-white p-8 lg:p-12 border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-20">
            <Package class="w-12 h-12 mx-auto text-gray-200 mb-6" :stroke-width="1" />
            <h3 class="font-heading text-lg uppercase tracking-widest mb-2">Chưa Có Đơn Hàng</h3>
            <p class="text-xs tracking-widest text-gray-400 mb-8">Bạn chưa đặt mua sản phẩm nào.</p>
            <router-link :to="{ name: 'shop' }"
              class="inline-block bg-black text-white px-8 py-3 text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
              Bắt đầu mua sắm
            </router-link>
          </div>

          <!-- Tab: Appointments (Empty State) -->
          <div v-else-if="activeTab === 'appointments'"
            class="bg-white p-8 lg:p-12 border border-gray-100 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 text-center py-20">
            <Calendar class="w-12 h-12 mx-auto text-gray-200 mb-6" :stroke-width="1" />
            <h3 class="font-heading text-lg uppercase tracking-widest mb-2">Chưa Có Lịch Hẹn</h3>
            <p class="text-xs tracking-widest text-gray-400 mb-8">Bạn chưa có lịch hẹn dịch vụ nào sắp tới.</p>
            <router-link :to="{ name: 'services' }"
              class="inline-block bg-black text-white px-8 py-3 text-[10px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
              Đặt lịch ngay
            </router-link>
          </div>

          <!-- Tab: Reviews -->
          <div v-else-if="activeTab === 'reviews'"
            class="bg-white border border-gray-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 rounded-sm overflow-hidden">
            <!-- Selector Header -->
            <div class="flex gap-6 border-b border-gray-100 px-6 pt-5 pb-0 bg-gray-50/50">
              <button @click="reviewSubTab = 'service'"
                :class="['text-[10px] uppercase tracking-widest pb-3 font-semibold border-b-2 transition-all cursor-pointer', reviewSubTab === 'service' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black']">
                Dịch Vụ & Nhân Viên
              </button>
              <button @click="reviewSubTab = 'product'"
                :class="['text-[10px] uppercase tracking-widest pb-3 font-semibold border-b-2 transition-all cursor-pointer', reviewSubTab === 'product' ? 'border-black text-black' : 'border-transparent text-gray-400 hover:text-black']">
                Sản Phẩm
              </button>
            </div>
            
            <div :class="reviewSubTab === 'product' ? 'p-6' : ''">
              <LichSuDanhGia v-if="reviewSubTab === 'service'" />
              <LichSuDanhGiaSanPham v-else />
            </div>
          </div>

        </main>

      </div>

    </div>
  </div>
</template>
