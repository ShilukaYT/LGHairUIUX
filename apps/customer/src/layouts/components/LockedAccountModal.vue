<script setup lang="ts">
import { X } from 'lucide-vue-next';
import { useAuthStore } from '@/stores/useAuthStore';

const authStore = useAuthStore();
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="authStore.showLockedModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="authStore.closeLockedModal"
      >
        <div class="bg-white w-full max-w-[460px] border border-gray-200 shadow-2xl relative overflow-hidden">
          <!-- Header đỏ -->
          <div class="bg-[#852121] px-8 py-6 text-white text-center relative">
            <button
              @click="authStore.closeLockedModal"
              class="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
            >
              <X :size="20" :stroke-width="1.5" />
            </button>

            <!-- Icon khóa -->
            <div class="flex justify-center mb-3">
              <div class="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center border-2 border-white/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-7 h-7">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              </div>
            </div>

            <h3 class="text-lg font-heading uppercase tracking-[0.15em] font-medium">Tài khoản bị khóa</h3>
            <p class="text-white/70 text-[11px] mt-1 tracking-wide">Tài khoản của bạn đã bị hạn chế truy cập</p>
          </div>

          <!-- Body -->
          <div class="px-8 py-6 text-center">
            <p class="text-sm text-gray-600 font-light leading-relaxed mb-6">
              Tài khoản của bạn hiện <strong class="text-[#852121] font-medium">đã bị khóa</strong> bởi quản trị viên.
              Bạn không thể thực hiện các thao tác trên hệ thống.<br />
              <span class="text-gray-400 text-xs mt-1 block">Vui lòng liên hệ nhân viên hỗ trợ để được giải quyết.</span>
            </p>

            <!-- Divider -->
            <div class="border-t border-gray-100 mb-6"></div>

            <!-- Kênh hỗ trợ -->
            <p class="text-[10px] uppercase tracking-widest text-gray-400 mb-4">Kênh hỗ trợ</p>
            <div class="flex flex-col gap-3">
              <!-- Hotline -->
              <a
                href="tel:0123456789"
                class="flex items-center gap-3 px-5 py-3.5 border border-gray-200 hover:border-black hover:bg-black hover:text-white group transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 6.75Z" />
                </svg>
                <div class="text-left">
                  <span class="block text-[9px] uppercase tracking-widest opacity-60 group-hover:opacity-80">Gọi hotline</span>
                  <span class="block text-sm font-medium tracking-wide">0123 456 789</span>
                </div>
              </a>

              <!-- Chat nhân viên -->
              <button
                type="button"
                @click="authStore.triggerOpenChatWithStaff()"
                class="flex items-center gap-3 px-5 py-3.5 bg-black text-white hover:bg-gray-800 group transition-all duration-200 w-full text-left cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 shrink-0">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
                </svg>
                <div class="text-left">
                  <span class="block text-[9px] uppercase tracking-widest opacity-70">Nhắn tin trực tiếp</span>
                  <span class="block text-sm font-medium tracking-wide">Chat với nhân viên</span>
                </div>
              </button>
            </div>

            <button
              @click="authStore.closeLockedModal"
              class="mt-5 w-full py-3 text-[10px] uppercase tracking-widest text-gray-400 hover:text-black border border-transparent hover:border-gray-200 transition-all"
            >
              Đóng thông báo
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
