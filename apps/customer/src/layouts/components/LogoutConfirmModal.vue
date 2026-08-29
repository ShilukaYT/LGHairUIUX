<script setup lang="ts">
import { LogOut, X } from 'lucide-vue-next';
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
        v-if="authStore.showLogoutConfirmModal"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="authStore.closeLogoutConfirmModal"
      >
        <div class="bg-white w-full max-w-[440px] p-10 border border-gray-200 shadow-2xl relative text-center">
          <button
            @click="authStore.closeLogoutConfirmModal"
            class="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors"
          >
            <X :size="20" :stroke-width="1.5" />
          </button>

          <!-- Icon Đăng xuất -->
          <div class="flex justify-center mb-6">
            <div class="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center border border-red-100">
              <LogOut :size="32" class="text-[#852121]" :stroke-width="1.5" />
            </div>
          </div>

          <h3 class="text-xl font-heading uppercase tracking-[0.15em] font-medium text-black mb-3">
            {{ authStore.logoutModalTitle }}
          </h3>
          
          <p class="text-sm font-light text-gray-500 mb-8 leading-relaxed">
            {{ authStore.logoutModalMessage }}
          </p>

          <div class="grid grid-cols-2 gap-4">
            <button
              type="button"
              @click="authStore.closeLogoutConfirmModal"
              class="w-full bg-transparent border border-gray-200 text-gray-700 px-6 py-4 text-[11px] uppercase tracking-[0.15em] hover:bg-gray-50 hover:text-black transition-colors font-medium cursor-pointer"
            >
              Hủy bỏ
            </button>

            <button
              type="button"
              @click="authStore.confirmLogoutAction"
              class="w-full bg-[#852121] text-white px-6 py-4 text-[11px] uppercase tracking-[0.15em] hover:bg-[#6b1a1a] transition-colors font-medium cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
