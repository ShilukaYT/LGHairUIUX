<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { X, Trash2, ArrowRight, Loader2, Sparkles, Scissors } from 'lucide-vue-next';
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
            class="fixed inset-0 z-[90] bg-black/40 backdrop-blur-[2px] transition-opacity duration-[500ms] ease-out"
            :class="store.isDrawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'"
            @click="handleClose"
            aria-hidden="true"
        ></div>

        <!-- Drawer panel -->
        <aside
            class="fixed inset-y-0 left-0 z-[100] w-[400px] max-w-[92vw] bg-white flex flex-col transform transition-transform duration-[500ms] ease-luxury shadow-2xl"
            :class="store.isDrawerOpen ? 'translate-x-0' : '-translate-x-full'"
            role="dialog"
            aria-label="Khay dịch vụ"
        >
            <!-- Header (Cố định, 70px) -->
            <div class="flex items-center justify-between h-[70px] px-6 shrink-0 border-b border-neutral-100 bg-white">
                <div class="flex items-center gap-2.5">
                    <!-- Icon cây kéo nhẹ nhàng viền bo tròn tinh tế -->
                    <div class="w-7 h-7 rounded-full border border-neutral-200 bg-neutral-50 flex items-center justify-center text-neutral-800 shrink-0">
                        <Scissors :size="14" :stroke-width="1.8" />
                    </div>
                    
                    <div class="flex items-center gap-2">
                        <h3 class="text-sm font-bold text-neutral-900 m-0 tracking-tight">
                            Dịch vụ đã chọn
                        </h3>
                        <!-- Badge số lượng tròn nhỏ gọn -->
                        <span class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-neutral-100 border border-neutral-200/80 text-neutral-800 text-[11px] font-bold">
                            {{ store.itemCount }}
                        </span>
                    </div>
                </div>

                <!-- Nút Đóng bo tròn hiện đại có hiệu ứng xoay mượt -->
                <button
                    @click="handleClose"
                    class="w-8 h-8 rounded-full flex items-center justify-center bg-neutral-100 hover:bg-neutral-900 text-neutral-500 hover:text-white border-none cursor-pointer transition-all duration-300 hover:rotate-90 active:scale-90"
                    aria-label="Đóng khay dịch vụ"
                    title="Đóng"
                >
                    <X :size="15" :stroke-width="2" />
                </button>
            </div>

            <!-- Body (Scrollable) -->
            <div class="flex-1 overflow-y-auto overscroll-contain hide-scrollbar relative bg-neutral-50/50">
                <!-- Empty state -->
                <div v-if="store.isEmpty" class="absolute inset-0 flex flex-col items-center justify-center text-center px-8 transition-opacity duration-500 ease-luxury">
                    <div class="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3 border border-neutral-200">
                        <Sparkles :size="24" :stroke-width="1.5" />
                    </div>
                    <p class="text-[13px] font-bold tracking-[0.1em] uppercase text-[#333] mb-1.5">Khay dịch vụ trống</p>
                    <p class="text-[12px] leading-relaxed text-[#888] max-w-[260px]">
                        Hãy chọn các dịch vụ tạo mẫu và chăm sóc tóc cao cấp để tiến hành đặt lịch.
                    </p>
                </div>

                <!-- Items list -->
                <div v-else class="p-3 space-y-2.5">
                    <transition-group name="lux-list" tag="div" class="space-y-2.5">
                        <div
                            v-for="item in store.items"
                            :key="item.id"
                            class="lux-item group relative flex items-center p-3.5 bg-white rounded-xl border border-black/[0.06] hover:border-black/15 shadow-sm hover:shadow transition-all duration-300"
                        >
                            <!-- Thumbnail -->
                            <div class="w-[58px] h-[58px] rounded-lg overflow-hidden shrink-0 bg-neutral-100 border border-black/5">
                                <img
                                    :src="getImageUrl(item.hinhAnh)"
                                    :alt="item.tenItem"
                                    class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                    loading="lazy"
                                />
                            </div>
                            
                            <!-- Info -->
                            <div class="flex-1 min-w-0 pl-3.5 pr-2">
                                <h4 class="text-[13px] font-semibold text-[#111] m-0 mb-1 leading-snug line-clamp-2">
                                    {{ item.tenItem }}
                                </h4>
                                <div class="flex items-center gap-2 text-[12px] text-neutral-500 font-medium">
                                    <span class="text-neutral-400">{{ item.duration }} phút</span>
                                    <span class="text-neutral-300">&bull;</span>
                                    <span class="text-neutral-900 font-bold">{{ formatMoney(item.gia) }}</span>
                                </div>
                            </div>
                            
                            <!-- Nút Xóa Từng Item (Bo lại & chuyển toàn bộ đỏ khi rê chuột) -->
                            <button
                                @click="removeItem(item.id)"
                                class="group/del flex items-center justify-center w-7 h-7 rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-400 hover:bg-red-500 hover:text-white hover:border-red-500 cursor-pointer shrink-0 transition-all duration-200 hover:scale-105 active:scale-95 shadow-none hover:shadow-sm"
                                :aria-label="'Xóa ' + item.tenItem"
                                title="Xóa dịch vụ này"
                            >
                                <Trash2 :size="13" :stroke-width="1.8" class="transition-transform duration-200 group-hover/del:scale-110 group-hover/del:-rotate-6" />
                            </button>
                        </div>
                    </transition-group>
                </div>
            </div>

            <!-- Footer (Cố định) -->
            <div class="shrink-0 border-t border-black/[0.08] p-5 bg-white transition-opacity duration-500 ease-luxury shadow-[0_-4px_20px_rgba(0,0,0,0.03)]" :class="store.isEmpty ? 'opacity-0 pointer-events-none' : 'opacity-100'">
                <!-- Info line -->
                <div class="mb-4 bg-neutral-50 p-3 rounded-xl border border-neutral-200/60">
                    <div class="flex items-center justify-between text-[11px] text-neutral-500 tracking-[0.08em] uppercase font-semibold mb-1.5">
                        <span>Thời lượng dự kiến</span>
                        <span class="text-neutral-800 font-bold">{{ store.totalDuration }} phút</span>
                    </div>
                    <!-- Total line -->
                    <div class="flex items-center justify-between pt-1.5 border-t border-neutral-200/50">
                        <span class="text-[12px] text-[#111] tracking-[0.05em] uppercase font-bold">Tổng thanh toán</span>
                        <span class="text-[17px] font-black text-[#111]">{{ formatMoney(store.totalPrice) }}</span>
                    </div>
                </div>

                <!-- Primary Action: Nút TIẾP TỤC ĐẶT LỊCH (Hiệu ứng Shimmer & Micro-animation) -->
                <button
                    @click="handleProceed"
                    :disabled="store.isProceeding || store.isEmpty"
                    class="group/btn relative overflow-hidden flex items-center justify-center gap-2.5 w-full h-[50px] bg-black text-white rounded-xl border border-black cursor-pointer text-[11px] font-bold tracking-[0.18em] uppercase transition-all duration-300 hover:bg-neutral-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                >
                    <!-- Hiệu ứng quét sáng lướt qua khi hover -->
                    <span class="absolute inset-0 -translate-x-full group-hover/btn:translate-x-full duration-1000 bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform ease-in-out pointer-events-none"></span>

                    <template v-if="store.isProceeding">
                        <Loader2 :size="16" class="animate-spin text-white" />
                        <span>ĐANG XỬ LÝ...</span>
                    </template>
                    <template v-else>
                        <span>TIẾP TỤC ĐẶT LỊCH</span>
                        <ArrowRight :size="15" :stroke-width="2.2" class="transition-transform duration-300 group-hover/btn:translate-x-1.5" />
                    </template>
                </button>

                <!-- Secondary Action: Nút XÓA TẤT CẢ (Bo góc, chuyển toàn bộ đỏ khi rê chuột) -->
                <button
                    @click="handleClear"
                    class="group/clear flex items-center justify-center gap-1.5 w-full mt-2.5 py-2.5 rounded-lg border border-neutral-200/80 bg-neutral-50 text-neutral-500 hover:bg-red-500 hover:text-white hover:border-red-500 hover:shadow-sm cursor-pointer text-[10px] font-semibold tracking-[0.14em] uppercase transition-all duration-200 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
                    :disabled="store.isEmpty"
                >
                    <Trash2 :size="13" :stroke-width="1.8" class="transition-transform duration-200 group-hover/clear:scale-110 group-hover/clear:-rotate-6" />
                    <span>Xóa tất cả dịch vụ</span>
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
*/
.lux-list-move,
.lux-list-enter-active,
.lux-list-leave-active {
    transition: all 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

.lux-list-enter-from {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
}

.lux-list-leave-to {
    opacity: 0;
    transform: translateX(-20px) scale(0.92);
}

.lux-list-leave-active {
    position: absolute;
    width: 100%;
}
</style>
