<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useDataStore } from '@/stores/useDataStore';

const router = useRouter();
const route = useRoute();
const dataStore = useDataStore();

const selectedService = ref(route.params.serviceId || '');

const submitBooking = () => {
  alert("Yêu cầu đặt lịch đã được gửi thành công.");
  router.push({ name: 'home' });
};
</script>

<template>
  <div class="w-full animate-in fade-in duration-500 min-h-screen bg-[#f8f8f8] py-24 px-6">
    <div class="max-w-[700px] mx-auto bg-white border border-gray-200 p-8 md:p-16">
      <div class="text-center mb-12">
        <h1 class="text-2xl md:text-3xl font-heading uppercase tracking-[0.2em] font-light mb-4">Đặt Lịch</h1>
        <p class="text-gray-500 font-light text-sm">Xác nhận lịch hẹn của bạn. Yêu cầu đặt cọc 500.000đ cho các dịch vụ hóa chất.</p>
      </div>
      
      <form class="space-y-8" @submit.prevent="submitBooking">
        <div class="space-y-4">
          <h3 class="text-[10px] uppercase tracking-[0.2em] font-medium border-b border-gray-100 pb-2">1. Chi Tiết Dịch Vụ</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Chọn Dịch Vụ</label>
              <select v-model="selectedService" class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light">
                <option value="" disabled>Chọn một dịch vụ</option>
                <option v-for="s in dataStore.SERVICES" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Chọn Chuyên Viên</label>
              <select class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light">
                <option value="" disabled selected>Bất kỳ chuyên viên nào</option>
                <option value="emma">Emma W. (Master Stylist)</option>
                <option value="sarah">Sarah T. (Chuyên gia màu)</option>
                <option value="michael">Michael R. (Giám đốc)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="space-y-4 pt-4">
          <h3 class="text-[10px] uppercase tracking-[0.2em] font-medium border-b border-gray-100 pb-2">2. Ngày & Giờ</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Ngày Ưu Tiên</label>
              <input type="date" class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light uppercase" />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Giờ Ưu Tiên</label>
              <select class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light">
                <option value="" disabled selected>Chọn giờ</option>
                <option value="morning">Sáng (9:00 - 12:00)</option>
                <option value="afternoon">Chiều (12:00 - 16:00)</option>
                <option value="evening">Tối (16:00 - 20:00)</option>
              </select>
            </div>
          </div>
        </div>

        <div class="space-y-4 pt-4">
          <h3 class="text-[10px] uppercase tracking-[0.2em] font-medium border-b border-gray-100 pb-2">3. Thông Tin Của Bạn</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Tên</label>
              <input type="text" required class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light" />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Họ</label>
              <input type="text" required class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light" />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Email</label>
              <input type="email" required class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light" />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Số Điện Thoại</label>
              <input type="tel" required class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light" />
            </div>
          </div>
        </div>

        <div class="flex flex-col space-y-2 pt-2">
          <label class="text-[10px] uppercase tracking-widest text-gray-500">Ghi Chú Thêm</label>
          <textarea 
            rows="3" 
            placeholder="Lịch sử hóa chất tóc, mong muốn, hoặc các lưu ý khác..."
            class="w-full p-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light resize-none"
          ></textarea>
        </div>

        <div class="pt-8">
          <button type="submit" class="w-full bg-black text-white px-10 py-5 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
            Gửi Yêu Cầu Đặt Lịch
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
