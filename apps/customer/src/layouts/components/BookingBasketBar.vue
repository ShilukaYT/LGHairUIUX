<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Scissors, ArrowRight, ChevronUp, Clock, Loader2 } from 'lucide-vue-next';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';

const router = useRouter();
const store = useBookingBasketStore();

const formatMoney = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

const handleProceed = () => {
    store.proceedToBooking(router);
};

const handleOpenDrawer = () => {
    store.openDrawer();
};
</script>

<template>
    <Teleport to="body">
        <transition name="basket-bar">
            <div
                v-if="!store.isEmpty"
                class="fixed bottom-0 left-0 right-0 z-[55] bg-[#111] border-t border-neutral-800"
                role="status"
                aria-live="polite"
                :aria-label="`Khay dịch vụ: ${store.itemCount} dịch vụ, tổng ${formatMoney(store.totalPrice)}`"
            >
                <div class="flex items-center justify-between max-w-[1440px] mx-auto px-4 sm:px-6 h-[52px] sm:h-14 gap-3 sm:gap-4">
                    <!-- Left: Info & Click to open Drawer -->
                    <button
                        class="flex items-center gap-2 sm:gap-2.5 bg-transparent border-none text-white hover:text-neutral-300 cursor-pointer py-1.5 font-sans transition-colors duration-200"
                        @click="handleOpenDrawer"
                        aria-label="Xem chi tiết khay dịch vụ"
                        style="font-family: 'Inter', 'Jost', sans-serif;"
                    >
                        <Scissors :size="15" :stroke-width="1.8" class="text-neutral-400 shrink-0" />

                        <!-- Số lượng dịch vụ -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-[11px] sm:text-xs font-semibold tracking-wider text-white whitespace-nowrap">
                                {{ store.itemCount }} DỊCH VỤ
                            </span>
                            <span class="text-neutral-500 text-[10px]">&bull;</span>
                            
                            <!-- Thời lượng -->
                            <span class="hidden sm:inline text-[11px] font-normal text-neutral-400 whitespace-nowrap">
                                {{ store.totalDuration }} phút
                            </span>
                            <span class="hidden sm:inline text-neutral-500 text-[10px]">&bull;</span>
                        </div>

                        <!-- Tổng tiền -->
                        <div class="flex items-center gap-1">
                            <span class="text-xs sm:text-sm font-bold text-white tracking-tight whitespace-nowrap">
                                {{ formatMoney(store.totalPrice) }}
                            </span>
                            
                            <!-- Nút mũi tên mở Drawer -->
                            <ChevronUp :size="13" :stroke-width="2" class="text-neutral-400 ml-0.5 shrink-0" />
                        </div>
                    </button>

                    <!-- Right: Nút CTA ĐẶT LỊCH chỉn chu, mượt mà -->
                    <button
                        class="group/btn relative overflow-hidden flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 bg-white text-black border-none rounded-lg cursor-pointer text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase whitespace-nowrap transition-all duration-300 hover:bg-neutral-100 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 shrink-0"
                        @click="handleProceed"
                        :disabled="store.isProceeding"
                        style="font-family: 'Inter', 'Jost', sans-serif;"
                    >
                        <!-- Shimmer light sweep -->
                        <span class="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full duration-700 bg-gradient-to-r from-transparent via-black/10 to-transparent transition-transform ease-in-out pointer-events-none"></span>

                        <template v-if="store.isProceeding">
                            <Loader2 :size="14" class="animate-spin text-black" />
                            <span>ĐANG XỬ LÝ...</span>
                        </template>
                        <template v-else>
                            <span>ĐẶT LỊCH</span>
                            <ArrowRight :size="14" :stroke-width="2.2" class="transition-transform duration-200 group-hover/btn:translate-x-1" />
                        </template>
                    </button>
                </div>
            </div>
        </transition>
    </Teleport>
</template>

<style scoped>
/* ─── Entrance Animation ─────────────────────────────── */
.basket-bar-enter-active {
    transition: transform 250ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease;
}
.basket-bar-leave-active {
    transition: transform 200ms cubic-bezier(0.55, 0, 1, 0.45), opacity 150ms ease;
}
.basket-bar-enter-from,
.basket-bar-leave-to {
    transform: translateY(100%);
    opacity: 0;
}

/* ─── Reduced Motion ──────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
    .basket-bar-enter-active,
    .basket-bar-leave-active {
        transition: opacity 150ms ease;
    }
    .basket-bar-enter-from,
    .basket-bar-leave-to {
        transform: none;
    }
}
</style>
