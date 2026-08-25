<script setup lang="ts">
import { useRouter } from 'vue-router';
import { Scissors, ArrowRight, ChevronUp } from 'lucide-vue-next';
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
                class="fixed bottom-0 left-0 right-0 z-[55] bg-[#111] border-t border-white/10"
                role="status"
                aria-live="polite"
                :aria-label="`Khay dịch vụ: ${store.itemCount} dịch vụ, tổng ${formatMoney(store.totalPrice)}`"
            >
                <div class="flex items-center justify-between max-w-[1440px] mx-auto px-4 sm:px-6 h-[52px] sm:h-14 gap-3 sm:gap-4">
                    <!-- Left: Info (click to open drawer) -->
                    <button
                        class="flex items-center gap-2 bg-transparent border-none text-white/85 hover:text-white cursor-pointer py-2 font-sans transition-colors duration-200"
                        @click="handleOpenDrawer"
                        aria-label="Xem chi tiết khay dịch vụ"
                        style="font-family: 'Inter', 'Jost', sans-serif;"
                    >
                        <Scissors :size="15" :stroke-width="1.5" class="text-white/50 shrink-0" />
                        <span class="text-[11px] sm:text-xs font-semibold tracking-wider whitespace-nowrap">{{ store.itemCount }} dịch vụ</span>
                        <span class="text-white/25 text-[10px]">&middot;</span>
                        <span class="hidden sm:inline text-[11px] font-normal text-white/50 whitespace-nowrap">{{ store.totalDuration }} phút</span>
                        <span class="hidden sm:inline text-white/25 text-[10px]">&middot;</span>
                        <span class="text-xs sm:text-[13px] font-bold text-white tracking-tight whitespace-nowrap">{{ formatMoney(store.totalPrice) }}</span>
                        <ChevronUp :size="14" :stroke-width="1.5" class="text-white/40 shrink-0" />
                    </button>

                    <!-- Right: CTA -->
                    <button
                        class="group flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-white text-[#111] border-none cursor-pointer text-[10px] sm:text-[11px] font-bold tracking-[0.15em] uppercase whitespace-nowrap transition-all duration-200 hover:bg-[#e5e5e5] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shrink-0"
                        @click="handleProceed"
                        :disabled="store.isProceeding"
                        style="font-family: 'Inter', 'Jost', sans-serif;"
                    >
                        <span v-if="store.isProceeding">ĐANG XỬ LÝ...</span>
                        <template v-else>
                            <span>ĐẶT LỊCH</span>
                            <ArrowRight :size="14" :stroke-width="2" class="transition-transform duration-200 group-hover:translate-x-1" />
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
    transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease;
}
.basket-bar-leave-active {
    transition: transform 250ms cubic-bezier(0.55, 0, 1, 0.45), opacity 180ms ease;
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
