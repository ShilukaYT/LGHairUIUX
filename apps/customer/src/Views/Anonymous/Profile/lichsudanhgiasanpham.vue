<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Star, Trash2, Camera, X, Search, ChevronLeft, ChevronRight, MessageSquare, ShoppingBag } from 'lucide-vue-next';

// ------------------------------------------
// LOCAL MOCK DATA (No API Integration)
// ------------------------------------------
const pendingOrders = ref<any[]>([
    {
        id: 'HD8891',
        date: '2026-06-18T10:30:00',
        viewMode: '',
        products: [
            {
                id: 'SP001',
                name: 'Dầu gội phục hồi hư tổn Olaplex No.4 Bond Maintenance',
                image: 'https://images.unsplash.com/photo-1535585209827-a15fcdbc4c2d?auto=format&fit=crop&q=80&w=200',
                rating: 0,
                comment: '',
                imagePreview: null,
                imageFile: null
            },
            {
                id: 'SP002',
                name: 'Dầu xả phục hồi tóc khô xơ Olaplex No.5 Bond Maintenance',
                image: 'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?auto=format&fit=crop&q=80&w=200',
                rating: 0,
                comment: '',
                imagePreview: null,
                imageFile: null
            }
        ]
    },
    {
        id: 'HD8892',
        date: '2026-06-17T15:45:00',
        viewMode: '',
        products: [
            {
                id: 'SP003',
                name: 'Tinh dầu dưỡng tóc sâu Moroccanoil Treatment Original',
                image: 'https://images.unsplash.com/photo-1526947425960-945c6e72858f?auto=format&fit=crop&q=80&w=200',
                rating: 0,
                comment: '',
                imagePreview: null,
                imageFile: null
            }
        ]
    },
    {
        id: 'HD8895',
        date: '2026-06-15T09:15:00',
        viewMode: '',
        products: [
            {
                id: 'SP005',
                name: 'Mặt nạ phục hồi tóc Kerastase Resistance Masque Force Architecte',
                image: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?auto=format&fit=crop&q=80&w=200',
                rating: 0,
                comment: '',
                imagePreview: null,
                imageFile: null
            }
        ]
    }
]);

const ratedOrders = ref<any[]>([
    {
        id: 'HD8720',
        date: '2026-06-10',
        products: [
            {
                id: 'SP004',
                name: 'Xịt dưỡng bảo vệ và giữ màu tóc nhuộm Kevin Murphy Everlasting Colour',
                image: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?auto=format&fit=crop&q=80&w=200',
                rating: 5,
                comment: 'Sản phẩm xịt dưỡng rất thơm, tóc sau khi nhuộm giữ màu lâu và không bị khô xơ. Chai thiết kế tối giản rất đẹp mắt.',
                imageReview: 'https://images.unsplash.com/photo-1519735008037-615236229357?auto=format&fit=crop&q=80&w=400',
                reply: 'Cảm ơn quý khách đã tin tưởng và chọn lựa mua sắm tại Minh Tâm Hair. Chúc bạn luôn tự tin với mái tóc rạng rỡ của mình!',
                dateStr: '10/06/2026 18:22'
            }
        ]
    },
    {
        id: 'HD8651',
        date: '2026-06-05',
        products: [
            {
                id: 'SP006',
                name: 'Sáp vuốt tóc nam tạo kiểu giữ nếp Claymation Hanz de Fuko',
                image: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&q=80&w=200',
                rating: 4,
                comment: 'Sáp giữ nếp tốt, không bị bóng nhờn, tuy nhiên hơi khó gội sạch hoàn toàn ở lần gội đầu tiên. Nói chung là đáng tiền mua.',
                imageReview: null,
                reply: 'Dạ Minh Tâm Hair rất ghi nhận góp ý của anh ạ. Với các dòng clay giữ nếp cao, anh có thể xả tóc bằng dầu xả trước khi gội để dễ trôi sáp hơn nhé!',
                dateStr: '05/06/2026 14:05'
            }
        ]
    }
]);

const subTab = ref<'pending' | 'completed'>('pending');
const isSubmitting = ref(false);

// Search & Sort State
const searchQuery = ref('');
const sortOption = ref<'newest' | 'oldest'>('newest');
const itemsPerPage = 5;

const currentPendingPage = ref(1);
const currentRatedPage = ref(1);

// Lightbox for image preview
const lightboxOpen = ref(false);
const lightboxImg = ref('');

// Reset pages on search/sort/tab change
watch([searchQuery, sortOption, subTab], () => {
    currentPendingPage.value = 1;
    currentRatedPage.value = 1;
});

const getTime = (dateStr: string) => {
    return new Date(dateStr).getTime() || 0;
};

// ----- Pending Products Filter Pipeline -----
const processedPendingOrders = computed(() => {
    let result = [...pendingOrders.value];
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => 
            o.id.toLowerCase().includes(q) || 
            o.products.some((p: any) => p.name.toLowerCase().includes(q))
        );
    }
    return result.sort((a, b) => 
        sortOption.value === 'newest' ? getTime(b.date) - getTime(a.date) : getTime(a.date) - getTime(b.date)
    );
});

const totalPendingPages = computed(() => Math.ceil(processedPendingOrders.value.length / itemsPerPage));
const paginatedPendingOrders = computed(() => 
    processedPendingOrders.value.slice((currentPendingPage.value - 1) * itemsPerPage, currentPendingPage.value * itemsPerPage)
);

// ----- Rated Products Filter Pipeline -----
const processedRatedOrders = computed(() => {
    let result = [...ratedOrders.value];
    if (searchQuery.value) {
        const q = searchQuery.value.toLowerCase();
        result = result.filter(o => 
            o.id.toLowerCase().includes(q) || 
            o.products.some((p: any) => p.name.toLowerCase().includes(q))
        );
    }
    return result.sort((a, b) => {
        const tA = a.date.includes('-') ? new Date(a.date).getTime() : 0;
        const tB = b.date.includes('-') ? new Date(b.date).getTime() : 0;
        return sortOption.value === 'newest' ? tB - tA : tA - tB;
    });
});

const totalRatedPages = computed(() => Math.ceil(processedRatedOrders.value.length / itemsPerPage));
const paginatedRatedOrders = computed(() => 
    processedRatedOrders.value.slice((currentRatedPage.value - 1) * itemsPerPage, currentRatedPage.value * itemsPerPage)
);

const changePage = (listType: 'pending' | 'rated', step: number) => {
    if (listType === 'pending') {
        const n = currentPendingPage.value + step;
        if (n > 0 && n <= totalPendingPages.value) currentPendingPage.value = n;
    } else {
        const n = currentRatedPage.value + step;
        if (n > 0 && n <= totalRatedPages.value) currentRatedPage.value = n;
    }
};

// Handle file change (mock image preview)
const handleFileChange = (event: any, product: any) => {
    const file = event.target.files[0];
    if (file) {
        product.imageFile = file;
        product.imagePreview = URL.createObjectURL(file);
    }
};

const removeImage = (product: any) => {
    product.imageFile = null;
    product.imagePreview = null;
};

// Submit Review locally (move to history)
const submitAction = (order: any) => {
    const ratedProducts = order.products.filter((p: any) => p.rating > 0);
    if (ratedProducts.length === 0) {
        alert("Vui lòng chọn số sao cho ít nhất một sản phẩm.");
        return;
    }

    isSubmitting.value = true;
    
    // Simulate submission delay
    setTimeout(() => {
        // Create new history entry
        const now = new Date();
        const dateStr = now.toLocaleString('vi-VN', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });

        const newRatedOrder = {
            id: order.id,
            date: now.toISOString().split('T')[0],
            products: ratedProducts.map((p: any) => ({
                id: p.id,
                name: p.name,
                image: p.image,
                rating: p.rating,
                comment: p.comment,
                imageReview: p.imagePreview, // keep the uploaded blob url for local visual
                reply: null, // no reply yet
                dateStr: dateStr
            }))
        };

        // Add to history
        ratedOrders.value.unshift(newRatedOrder);

        // Remove from pending
        pendingOrders.value = pendingOrders.value.filter(o => o.id !== order.id);

        isSubmitting.value = false;
        alert('✨ Gửi đánh giá sản phẩm thành công (Giao diện Demo)!');
    }, 800);
};

// Delete Review locally
const deleteSingleProductReview = (orderId: string, productId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá của sản phẩm này?")) return;

    ratedOrders.value = ratedOrders.value.map(order => {
        if (order.id === orderId) {
            return {
                ...order,
                products: order.products.filter((p: any) => p.id !== productId)
            };
        }
        return order;
    }).filter(order => order.products.length > 0);

    alert("Đã xóa đánh giá sản phẩm thành công!");
};

const deleteFullOrderProductReview = (orderId: string) => {
    if (!confirm("Xóa toàn bộ đánh giá sản phẩm của đơn hàng này?")) return;
    ratedOrders.value = ratedOrders.value.filter(order => order.id !== orderId);
    alert("Đã xóa toàn bộ đánh giá sản phẩm!");
};

const openLightbox = (img: string) => {
    lightboxImg.value = img;
    lightboxOpen.value = true;
};
</script>

<template>
    <div class="animate-in fade-in duration-500">
        <!-- Sub Tabs -->
        <div class="flex justify-center border-b border-gray-100 mb-6 pb-px">
            <div class="flex gap-8">
                <button 
                    @click="subTab = 'pending'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', subTab === 'pending' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']"
                >
                    Chưa đánh giá
                </button>
                <button 
                    @click="subTab = 'completed'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', subTab === 'completed' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']"
                >
                    Đã đánh giá
                </button>
            </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="flex flex-col sm:flex-row gap-4 mb-6">
            <div class="flex-1 relative">
                <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input 
                    type="text" 
                    v-model="searchQuery" 
                    placeholder="Tìm mã đơn hàng, tên sản phẩm..."
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none pl-10 pr-4 py-2.5 text-xs transition-all rounded-sm text-black" 
                />
            </div>
            <div class="w-full sm:w-56">
                <select 
                    v-model="sortOption" 
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-2.5 text-xs transition-all rounded-sm text-black cursor-pointer font-medium"
                >
                    <option value="newest">Ngày tạo: Mới nhất</option>
                    <option value="oldest">Ngày tạo: Cũ nhất</option>
                </select>
            </div>
        </div>

        <!-- Content Area -->
        <div class="space-y-6">
            <!-- PENDING TAB -->
            <div v-if="subTab === 'pending'" class="space-y-6">
                <div v-if="paginatedPendingOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-sm">
                    <ShoppingBag :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                    <p class="text-xs text-gray-400 uppercase tracking-widest">Không có hóa đơn sản phẩm nào chờ đánh giá.</p>
                </div>

                <div v-for="order in paginatedPendingOrders" :key="order.id" class="border border-gray-200 rounded-sm bg-white p-6 shadow-sm">
                    <!-- Order Info Header -->
                    <div class="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-100 pb-4 mb-5 gap-2">
                        <div>
                            <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng</span>
                            <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] text-gray-500 uppercase tracking-widest">
                                {{ new Date(order.date).toLocaleString('vi-VN', {
                                    day: '2-digit', month: '2-digit', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                }) }}
                            </span>
                        </div>
                    </div>

                    <!-- Products list to review -->
                    <div class="space-y-6">
                        <div v-for="p in order.products" :key="p.id" class="flex flex-col md:flex-row gap-6 border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                            <!-- Product thumbnail -->
                            <div class="w-16 h-16 shrink-0 bg-gray-50 border border-gray-100 rounded-sm overflow-hidden">
                                <img :src="p.image" :alt="p.name" class="w-full h-full object-cover" />
                            </div>

                            <!-- Review form for this product -->
                            <div class="flex-1 space-y-4">
                                <div>
                                    <h5 class="text-xs font-semibold uppercase tracking-wider text-black leading-tight">{{ p.name }}</h5>
                                </div>

                                <!-- Star rating -->
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] uppercase tracking-widest text-gray-400">Đánh giá sao:</span>
                                    <div class="flex gap-1">
                                        <button 
                                            v-for="n in 5" 
                                            :key="n"
                                            @click="p.rating = n"
                                            type="button"
                                            class="transition-transform active:scale-95 cursor-pointer"
                                        >
                                            <Star 
                                                :size="18" 
                                                :fill="n <= p.rating ? '#000000' : 'none'"
                                                :stroke="n <= p.rating ? '#000000' : '#d1d5db'"
                                                :stroke-width="1.5"
                                            />
                                        </button>
                                    </div>
                                </div>

                                <!-- Input comment -->
                                <div>
                                    <textarea 
                                        v-model="p.comment" 
                                        placeholder="Để lại nhận xét về sản phẩm..."
                                        rows="2"
                                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-sm text-black"
                                    ></textarea>
                                </div>

                                <!-- Image attachment -->
                                <div class="flex items-center gap-4 flex-wrap">
                                    <label :for="'prod-file-' + order.id + '-' + p.id" class="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-black rounded-sm cursor-pointer transition-all text-[10px] uppercase tracking-widest text-gray-600 hover:text-black">
                                        <Camera :size="14" />
                                        {{ p.imagePreview ? 'Thay ảnh' : 'Thêm ảnh' }}
                                    </label>
                                    <input 
                                        type="file" 
                                        :id="'prod-file-' + order.id + '-' + p.id" 
                                        @change="handleFileChange($event, p)" 
                                        accept="image/*" 
                                        class="hidden" 
                                    />
                                    
                                    <!-- Image Preview Thumbnail -->
                                    <div v-if="p.imagePreview" class="relative w-12 h-12 border border-gray-200 rounded-sm overflow-hidden group">
                                        <img :src="p.imagePreview" class="w-full h-full object-cover" />
                                        <button 
                                            @click="removeImage(p)"
                                            type="button"
                                            class="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X :size="12" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Submit action -->
                    <div class="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                        <button 
                            @click="submitAction(order)"
                            :disabled="isSubmitting"
                            class="bg-black text-white px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold transition-all hover:bg-gray-900 active:scale-[0.98] disabled:opacity-40 rounded-sm cursor-pointer"
                        >
                            {{ isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá' }}
                        </button>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPendingPages > 1" class="flex justify-center items-center gap-4 pt-4">
                    <button 
                        @click="changePage('pending', -1)" 
                        :disabled="currentPendingPage === 1"
                        class="p-2 border border-gray-200 hover:border-black rounded-sm disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer"
                    >
                        <ChevronLeft :size="14" />
                    </button>
                    <span class="text-xs font-semibold tracking-wider text-gray-600">
                        {{ currentPendingPage }} / {{ totalPendingPages }}
                    </span>
                    <button 
                        @click="changePage('pending', 1)" 
                        :disabled="currentPendingPage === totalPendingPages"
                        class="p-2 border border-gray-200 hover:border-black rounded-sm disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer"
                    >
                        <ChevronRight :size="14" />
                    </button>
                </div>
            </div>

            <!-- COMPLETED TAB -->
            <div v-else class="space-y-6">
                <div v-if="paginatedRatedOrders.length === 0" class="text-center py-16 border border-dashed border-gray-200 rounded-sm">
                    <ShoppingBag :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                    <p class="text-xs text-gray-400 uppercase tracking-widest">Bạn chưa có lịch sử đánh giá sản phẩm nào.</p>
                </div>

                <div v-for="order in paginatedRatedOrders" :key="order.id" class="border border-gray-200 rounded-sm bg-white p-6 shadow-sm animate-in fade-in duration-300">
                    <!-- Rated Order Header -->
                    <div class="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                        <div>
                            <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng</span>
                            <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-[10px] text-gray-400 uppercase tracking-widest">{{ order.date }}</span>
                            <button 
                                @click="deleteFullOrderProductReview(order.id)"
                                class="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Xóa toàn bộ đánh giá của đơn này"
                            >
                                <Trash2 :size="14" />
                            </button>
                        </div>
                    </div>

                    <!-- Products list rated details -->
                    <div class="space-y-6">
                        <div v-for="(p, idx) in order.products" :key="idx" class="flex flex-col md:flex-row gap-6 border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                            <!-- Product thumbnail -->
                            <div class="w-16 h-16 shrink-0 bg-gray-50 border border-gray-100 rounded-sm overflow-hidden">
                                <img :src="p.image" :alt="p.name" class="w-full h-full object-cover" />
                            </div>

                            <!-- Review detail -->
                            <div class="flex-1 space-y-3">
                                <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                                    <h5 class="text-xs font-semibold uppercase tracking-wider text-black leading-tight max-w-lg">{{ p.name }}</h5>
                                    
                                    <div class="flex items-center gap-3">
                                        <!-- Star rating visual -->
                                        <div class="flex gap-0.5">
                                            <Star 
                                                v-for="n in 5" 
                                                :key="n"
                                                :size="12"
                                                :fill="n <= p.rating ? '#000000' : 'none'"
                                                :stroke="n <= p.rating ? '#000000' : '#d1d5db'"
                                                :stroke-width="1.5"
                                            />
                                        </div>
                                        
                                        <!-- Delete single review -->
                                        <button 
                                            @click="deleteSingleProductReview(order.id, p.id)"
                                            class="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                                            title="Xóa đánh giá này"
                                        >
                                            <X :size="12" />
                                        </button>
                                    </div>
                                </div>

                                <!-- Rating date -->
                                <p class="text-[9px] text-gray-400 uppercase tracking-widest">{{ p.dateStr }}</p>

                                <!-- Comment message -->
                                <p class="text-xs text-gray-600 font-light italic leading-relaxed whitespace-pre-line">
                                    "{{ p.comment || 'Khách hàng không để lại bình luận.' }}"
                                </p>

                                <!-- Attached image -->
                                <div v-if="p.imageReview" class="pt-1">
                                    <div 
                                        @click="openLightbox(p.imageReview)"
                                        class="relative w-20 h-20 border border-gray-100 rounded-sm overflow-hidden cursor-zoom-in hover:brightness-90 transition-all group"
                                    >
                                        <img :src="p.imageReview" class="w-full h-full object-cover" />
                                    </div>
                                </div>

                                <!-- Shop Reply block -->
                                <div v-if="p.reply" class="bg-gray-50 border-l border-gray-300 p-4 rounded-sm mt-3 space-y-1">
                                    <div class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-black font-semibold">
                                        <MessageSquare :size="12" />
                                        <span>Phản hồi từ Minh Tâm Hair</span>
                                    </div>
                                    <p class="text-xs text-gray-500 font-light leading-relaxed whitespace-pre-line">{{ p.reply }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalRatedPages > 1" class="flex justify-center items-center gap-4 pt-4">
                    <button 
                        @click="changePage('rated', -1)" 
                        :disabled="currentRatedPage === 1"
                        class="p-2 border border-gray-200 hover:border-black rounded-sm disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer"
                    >
                        <ChevronLeft :size="14" />
                    </button>
                    <span class="text-xs font-semibold tracking-wider text-gray-600">
                        {{ currentRatedPage }} / {{ totalRatedPages }}
                    </span>
                    <button 
                        @click="changePage('rated', 1)" 
                        :disabled="currentRatedPage === totalRatedPages"
                        class="p-2 border border-gray-200 hover:border-black rounded-sm disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer"
                    >
                        <ChevronRight :size="14" />
                    </button>
                </div>
            </div>
        </div>

        <!-- LIGHTBOX OVERLAY -->
        <Teleport to="body">
            <div v-if="lightboxOpen" class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-in fade-in duration-200" @click="lightboxOpen = false">
                <button class="absolute top-5 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/30 text-white flex items-center justify-center hover:bg-white/20 transition-colors" @click.stop="lightboxOpen = false">
                    <X :size="16" />
                </button>
                <div class="max-w-[90vw] max-h-[90vh] flex items-center justify-center" @click.stop>
                    <img :src="lightboxImg" alt="Xem ảnh lớn" class="max-w-full max-h-[90vh] object-contain" />
                </div>
            </div>
        </Teleport>
    </div>
</template>
