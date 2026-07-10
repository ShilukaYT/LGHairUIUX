<script setup lang="ts">
import component from '../../Views/Anonymous/tryon/component.vue';

const currentYear = new Date().getFullYear();
</script>

<template>
  <component />
  <footer class="w-full bg-[#111] text-white py-20 px-6 lg:px-12 mt-auto">
    <div class="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
      
      <div class="lg:col-span-2 flex flex-col">
        <span class="font-heading text-2xl tracking-[0.25em] font-medium text-white mb-6">LGHair</span>
        <p class="text-sm text-gray-400 font-light max-w-sm leading-relaxed">
          Tiệm salon và apothecary cao cấp chuyên về nhuộm màu thiết kế, cắt tóc kỹ thuật số và tạo kiểu nghệ thuật.
        </p>
      </div>

      <div class="flex flex-col space-y-4">
        <h4 class="text-[10px] uppercase tracking-[0.2em] font-medium text-white mb-2">Khám Phá</h4>
        <router-link :to="{ name: 'services' }" class="text-sm text-gray-400 font-light hover:text-white transition-colors text-left w-fit">Dịch Vụ</router-link>
        <router-link :to="{ name: 'shop' }" class="text-sm text-gray-400 font-light hover:text-white transition-colors text-left w-fit">Sản Phẩm</router-link>
        <router-link :to="{ name: 'booking' }" class="text-sm text-gray-400 font-light hover:text-white transition-colors text-left w-fit">Đặt Lịch Hẹn</router-link>
        <router-link :to="{ name: 'login' }" class="text-sm text-gray-400 font-light hover:text-white transition-colors text-left w-fit">Đăng Nhập</router-link>
      </div>

      <div class="flex flex-col space-y-4">
        <h4 class="text-[10px] uppercase tracking-[0.2em] font-medium text-white mb-2">Ghé Thăm</h4>
        <p class="text-sm text-gray-400 font-light leading-relaxed">
          123 Đại lộ Thời trang<br />
          Quận 1, TP. Hồ Chí Minh
        </p>
        <div class="pt-2 text-sm text-gray-400 font-light">
          <span class="block mb-1">T2-T6: 9:00 - 20:00</span>
          <span class="block mb-1">T7: 10:00 - 18:00</span>
          <span class="block">CN: Nghỉ</span>
        </div>
      </div>

      <div class="flex flex-col space-y-4">
        <h4 class="text-[10px] uppercase tracking-[0.2em] font-medium text-white mb-2">Liên Hệ</h4>
        <a href="#" class="text-sm text-gray-400 font-light hover:text-white transition-colors">+84 (555) 123-4567</a>
        <a href="#" class="text-sm text-gray-400 font-light hover:text-white transition-colors">hello@beforhair.com</a>
        <div class="pt-4 flex gap-4">
          <a href="#" class="text-sm text-gray-400 font-light hover:text-white transition-colors">Instagram</a>
          <a href="#" class="text-sm text-gray-400 font-light hover:text-white transition-colors">TikTok</a>
        </div>
      </div>

    </div>
    <div class="max-w-[1440px] mx-auto mt-20 pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center text-[10px] uppercase tracking-widest text-gray-500 font-light">
      <p class="text-white">Bản quyền © 2026 Tất cả quyền được bảo lưu | Được thực hiện bởi <a href="" class="text-blue-500 ">LUAGA Team</a></p>
      <div class="flex space-x-6 mt-4 md:mt-0">
        <a href="#" class="hover:text-white transition-colors">Chính sách bảo mật</a>
        <a href="#" class="hover:text-white transition-colors">Điều khoản dịch vụ</a>
      </div>
    </div>
  </footer>
</template>