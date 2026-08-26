<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-[100] flex items-center justify-center transition-opacity" style="background-color: rgba(0, 0, 0, 0.5);">
      <div class="bg-white max-w-md w-full mx-4 rounded-none shadow-xl overflow-hidden animate-in fade-in zoom-in duration-300">
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-[#fcfcfc]">
        <h3 class="font-heading text-sm uppercase tracking-widest font-medium">Tùy chọn thanh toán</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-black transition-colors">
          <X :size="20" />
        </button>
      </div>
      
      <div class="p-6">
        <p class="text-xs font-light text-gray-500 mb-6 leading-relaxed">
          Giỏ hàng của bạn bao gồm cả <span class="font-medium text-black">Dịch vụ</span> và <span class="font-medium text-black">Sản phẩm</span>. 
          Vui lòng chọn cách thức bạn muốn tiếp tục:
        </p>

        <div class="space-y-3">
          <!-- Đặt lịch & Mua sản phẩm -->
          <button 
            @click="confirmOption('DAT_LICH_VA_MUA_SAN_PHAM', null)"
            class="w-full text-left p-4 border border-gray-200 hover:border-black transition-colors group flex items-start gap-4"
          >
            <div class="mt-1">
              <CheckCircle2 :size="18" class="text-gray-300 group-hover:text-black transition-colors" />
            </div>
            <div>
              <h4 class="text-xs font-medium uppercase tracking-widest">Thanh toán cả hai</h4>
              <p class="text-[11px] text-gray-500 mt-1 font-light">Thanh toán chung cho cả lịch hẹn và sản phẩm</p>
            </div>
          </button>

          <div class="border-t border-gray-100 my-4"></div>

          <!-- Chỉ đặt lịch -->
          <button 
            @click="confirmOption('CHI_DAT_LICH', null)"
            class="w-full text-left p-4 border border-gray-200 hover:border-black transition-colors group flex items-start gap-4"
          >
            <div class="mt-1">
              <Calendar :size="18" class="text-gray-300 group-hover:text-black transition-colors" />
            </div>
            <div>
              <h4 class="text-xs font-medium uppercase tracking-widest">Chỉ thanh toán dịch vụ</h4>
              <p class="text-[11px] text-gray-500 mt-1 font-light">Thanh toán riêng cho lịch hẹn, bỏ qua sản phẩm</p>
            </div>
          </button>

          <!-- Chỉ mua sản phẩm -->
          <button 
            v-if="!hideProductOnly"
            @click="confirmOption('CHI_MUA_SAN_PHAM', null)"
            class="w-full text-left p-4 border border-gray-200 hover:border-black transition-colors group flex items-start gap-4"
          >
            <div class="mt-1">
              <ShoppingBag :size="18" class="text-gray-300 group-hover:text-black transition-colors" />
            </div>
            <div>
              <h4 class="text-xs font-medium uppercase tracking-widest">Chỉ thanh toán sản phẩm</h4>
              <p class="text-[11px] text-gray-500 mt-1 font-light">Thanh toán riêng cho sản phẩm, bỏ qua dịch vụ</p>
            </div>
          </button>
        </div>
      </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { X, CheckCircle2, Calendar, ShoppingBag } from 'lucide-vue-next';

defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  hideProductOnly: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'confirm']);

const confirmOption = (loaiCheckout: string, nhanSanPham: string | null) => {
  emit('confirm', { loaiCheckout, nhanSanPham });
};
</script>

<style scoped>
.font-heading {
  font-family: 'Inter', sans-serif;
}
</style>
