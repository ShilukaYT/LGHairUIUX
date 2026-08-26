<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { X, Trash2, ArrowRight } from 'lucide-vue-next';
import { useBookingBasketStore } from '@/stores/useBookingBasketStore';

const router = useRouter();
const store = useBookingBasketStore();

const API = import.meta.env.VITE_API_URL;

const getImageUrl = (url: string | undefined | null) => {
    if (!url) return '/images/no-image.png';
    if (url.startsWith('http')) return url;
    return `${API}${url.startsWith('/') ? '' : '/'}${url}`;
};

const formatMoney = (val: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

const handleProceed = () => {
    store.proceedToBooking(router);
};

const handleClose = () => {
    store.closeDrawer();
};

const handleClear = () => {
    store.clearAll();
};

const removeItem = (id: string | number) => {
    store.removeItem(id);
};

// Khóa cuộn body khi mở drawer
watch(() => store.isDrawerOpen, (isOpen) => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
});
</script>

<template>
    <Teleport to="body">
        <!-- Backdrop overlay -->
        <div
            class="fixed inset-0 z-[90] bg-black/35 backdrop-blur-[1px] transition-opacity duration-[500ms] ease-out"
            :class="store.isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
            @click="handleClose"
            aria-hidden="true"
        ></div>

        <!-- Drawer panel -->
        <aside
            class="fixed inset-y-0 left-0 z-[100] w-[390px] max-w-[92vw] bg-white flex flex-col transform transition-transform duration-[600ms] ease-luxury shadow-none"
            :class="store.isDrawerOpen ? 'translate-x-0' : '-translate-x-full'"
            role="dialog"
            aria-label="Khay dịch vụ"
        >
            <!-- Header (Cố định, 78px) -->
            <div class="flex items-center justify-between h-[78px] px-6 shrink-0 border-b border-black/10 bg-white">
                <div class="flex items-center text-[12px] font-bold tracking-[0.16em] uppercase text-[#111]">
                    <span>DỊCH VỤ ĐÃ CHỌN</span>
                </div>
                <button
                    @click="handleClose"
                    class="flex items-center justify-center p-2 border-none bg-transparent text-[#111] cursor-pointer transition-all duration-300 hover:rotate-90 hover:opacity-60"
                    aria-label="Đóng"
                >
                    <X :size="20" stroke-width="1.5" />
                </button>
            </div>

            <!-- Body (Scrollable) -->
            <div class="flex-1 overflow-y-auto overscroll-contain hide-scrollbar relative bg-white">
                <!-- Empty state -->
                <div v-if="store.isEmpty" class="absolute inset-0 flex flex-col items-center justify-center text-center px-8 transition-opacity duration-500 ease-luxury">
                    <p class="text-[13px] font-semibold tracking-[0.1em] uppercase text-[#333] mb-2">Chưa có dịch vụ</p>
                    <p class="text-[12px] leading-relaxed text-[#999] max-w-[260px]">
                        Trải nghiệm sự khác biệt với các dịch vụ chăm sóc tóc cao cấp của chúng tôi.
                    </p>
                </div>

                <!-- Items list -->
                <div v-else>
                    <transition-group name="lux-list" tag="div" class="relative">
                        <div
                            v-for="item in store.items"
                            :key="item.id"
                            class="lux-item flex items-center px-[28px] py-[24px] border-b border-black/[0.06] bg-white"
                        >
                            <!-- Thumbnail -->
                            <div class="w-[54px] h-[54px] rounded-[2px] overflow-hidden shrink-0 bg-[#f9f9f9]">
                                <img
                                    :src="getImageUrl(item.hinhAnh)"
                                    :alt="item.tenItem"
                                    class="w-full h-full object-cover transition-opacity duration-300"
                                    loading="lazy"
                                />
                            </div>
                            
                            <!-- Info -->
                            <div class="flex-1 min-w-0 pl-4 pr-2">
                                <h4 class="text-[13px] font-medium text-[#111] m-0 mb-1 leading-snug line-clamp-2">
                                    {{ item.tenItem }}
                                </h4>
                                <div class="text-[12px] text-[#888] font-light tracking-wide">
                                    {{ item.duration }} phút &middot; {{ formatMoney(item.gia) }}
                                </div>
                            </div>
                            
                            <!-- Remove btn -->
                            <button
                                @click="removeItem(item.id)"
                                class="flex items-center justify-center w-[32px] h-[32px] border border-black/10 rounded-full bg-transparent text-[#666] cursor-pointer shrink-0 transition-all duration-300 opacity-60 hover:opacity-100 hover:scale-[1.03]"
                                :aria-label="'Xóa ' + item.tenItem"
                            >
                                <X :size="14" stroke-width="1.5" />
                            </button>
                        </div>
                    </transition-group>
                </div>
            </div>

            <!-- Footer (Cố định, luôn hiện form hoặc ẩn khi rỗng tùy logic) -->
            <div class="shrink-0 border-t border-black/10 p-6 bg-white transition-opacity duration-500 ease-luxury" :class="store.isEmpty ? 'opacity-0 pointer-events-none' : 'opacity-100'">
                <!-- Info line -->
                <div class="mb-4">
                    <div class="text-[11px] text-[#888] tracking-[0.1em] uppercase font-medium mb-3">
                        {{ store.itemCount }} DỊCH VỤ &middot; {{ store.totalDuration }} PHÚT
                    </div>
                    <!-- Total line -->
                    <div class="flex items-center justify-between">
                        <span class="text-[12px] text-[#111] tracking-[0.05em] uppercase font-semibold">Tạm tính</span>
                        <span class="text-[16px] font-semibold text-[#111]">{{ formatMoney(store.totalPrice) }}</span>
                    </div>
                </div>

                <!-- Primary Action -->
                <button
                    @click="handleProceed"
                    :disabled="store.isProceeding || store.isEmpty"
                    class="group flex items-center justify-center gap-2 w-full h-[48px] bg-black text-white border-none cursor-pointer text-[11px] font-semibold tracking-[0.2em] uppercase transition-colors duration-300 hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span v-if="store.isProceeding">ĐANG XỬ LÝ...</span>
                    <template v-else>
                        <span>TIẾP TỤC ĐẶT LỊCH</span>
                        <ArrowRight :size="16" stroke-width="1.5" class="transition-transform duration-300 translate-x-0 group-hover:translate-x-1" />
                    </template>
                </button>

                <!-- Secondary Action -->
                <button
                    @click="handleClear"
                    class="flex items-center justify-center gap-1.5 w-full mt-4 border-none bg-transparent text-[#999] cursor-pointer text-[10px] font-medium tracking-[0.15em] uppercase transition-colors duration-300 hover:text-black"
                    :disabled="store.isEmpty"
                >
                    <Trash2 :size="12" stroke-width="1.5" />
                    <span>Xóa tất cả</span>
                </button>
            </div>
        </aside>
    </Teleport>
</template>

<style scoped>
/* Utilities */
.ease-luxury {
    transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
}
.hide-scrollbar::-webkit-scrollbar {
    display: none;
}

/* 
  Transition Group cho Lux List 
  Thời gian: 500ms
  Easing: cubic-bezier(0.22, 1, 0.36, 1)
*/
.lux-list-move,
.lux-list-enter-active,
.lux-list-leave-active {
    transition: all 500ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-list-enter-from {
    opacity: 0;
    transform: translateY(8px);
}

.lux-list-leave-to {
    opacity: 0;
    transform: translateX(-8px);
}

.lux-list-leave-active {
    position: absolute;
    width: 100%;
}

.lux-item:nth-child(1) { transition-delay: 0ms; }
.lux-item:nth-child(2) { transition-delay: 40ms; }
.lux-item:nth-child(3) { transition-delay: 80ms; }
.lux-item:nth-child(4) { transition-delay: 120ms; }
.lux-item:nth-child(5) { transition-delay: 160ms; }
</style>
