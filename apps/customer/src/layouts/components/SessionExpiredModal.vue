<script setup lang="ts">
import { AlertCircle, X } from 'lucide-vue-next';
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
        v-if="authStore.showSessionExpiredModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      >
        <div class="bg-white w-full max-w-[420px] p-10 border border-gray-200 shadow-2xl relative text-center">
          <button
            @click="authStore.closeSessionExpiredModal"
            class="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
          >
            <X :size="20" :stroke-width="1.5" />
          </button>

          <!-- Icon cảnh báo -->
          <div class="flex justify-center mb-6">
            <div class="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center border border-amber-100">
              <AlertCircle :size="36" class="text-amber-600" :stroke-width="1.5" />
            </div>
          </div>

          <h3 class="text-xl font-heading uppercase tracking-[0.15em] font-medium text-black mb-3">
            Hết Hạn Phiên Làm Việc
          </h3>
          
          <p class="text-sm font-light text-gray-500 mb-8 leading-relaxed">
            {{ authStore.sessionExpiredMessage }}
          </p>

          <div class="space-y-3">
            <button
              @click="authStore.goToLogin()"
              class="w-full bg-black text-white px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors font-medium cursor-pointer shadow-sm"
            >
              Đăng Nhập Lại
            </button>
            <button
              @click="authStore.closeSessionExpiredModal"
              class="w-full bg-gray-100 text-gray-700 px-8 py-3 text-[11px] uppercase tracking-[0.15em] hover:bg-gray-200 transition-colors font-medium cursor-pointer"
            >
              Tiếp Tục Với Tư Cách Khách
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
