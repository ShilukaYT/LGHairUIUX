<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';
import { Star, Trash2, Camera, X, Search, ChevronLeft, ChevronRight, MessageSquare, ShoppingBag } from 'lucide-vue-next';

// ------------------------------------------
// API CONFIGURATION & IMAGE HELPER
// ------------------------------------------
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';
const productImagesMap = ref<Record<string, string>>({});

const getImageUrl = (path?: string) => {
    if (!path) return `${API_BASE_URL}/assets/images/default.jpg`;
    if (path.startsWith("http")) return path;
    if (path.startsWith("/")) return `${API_BASE_URL}${path}`;
    return `${API_BASE_URL}/${path}`;
};

const getProductImage = (name: string) => {
    if (!name) return getImageUrl();
    const cleanStr = name.trim().toLowerCase();

    for (const [key, value] of Object.entries(productImagesMap.value)) {
        if (cleanStr.includes(key) || key.includes(cleanStr)) {
            return getImageUrl(value);
        }
    }
    return getImageUrl();
};

const loadProductCache = async () => {
    try {
        const res = await axios.get(`${API_BASE_URL}/api/SanPham/filter`, {
            params: {
                search: "",
                danhMuc: "all",
                thuongHieu: "all",
                priceRange: "all",
                page: 1,
                pageSize: 100
            }
        });
        if (res.data && res.data.data) {
            const cache: Record<string, string> = {};
            res.data.data.forEach((prod: any) => {
                if (prod.tenSp && prod.hinhAnhDaiDien) {
                    cache[prod.tenSp.toLowerCase()] = prod.hinhAnhDaiDien;
                }
            });
            productImagesMap.value = cache;
        }
    } catch (err) {
        console.error("Lỗi khi tải cache ảnh sản phẩm:", err);
    }
};

// ------------------------------------------
// STATE VARIABLES
// ------------------------------------------
const pendingOrders = ref<any[]>([]);
const ratedOrders = ref<any[]>([]);
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
        const tA = getTime(a.date);
        const tB = getTime(b.date);
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

// Handle file change
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

// ------------------------------------------
// API INTEGRATION FLOWS
// ------------------------------------------
const loadData = async () => {
    try {
        const user = getCustomerInfo();
        if (!user?.maKH || user.maKH === 'GUEST') return;

        // Ensure product cache is loaded first
        if (Object.keys(productImagesMap.value).length === 0) {
            await loadProductCache();
        }

        // 1. Tải đơn hàng/sản phẩm chưa đánh giá
        const resPending = await axios.get(`${API_BASE_URL}/api/DanhGia/pending-products-to-rate/${user.maKH}`);
        pendingOrders.value = resPending.data.map((order: any) => ({
            id: order.maHd,
            date: order.ngayTao,
            viewMode: '',
            products: order.products.map((p: any) => ({
                id: p.maBienThe || p.MaBienThe,
                name: p.tenSp || p.TenSp,
                image: getImageUrl(p.hinhAnh || p.HinhAnh),
                rating: 0,
                comment: '',
                imagePreview: null,
                imageFile: null
            }))
        }));

        // 2. Tải lịch sử đánh giá sản phẩm
        const resRated = await axios.get(`${API_BASE_URL}/api/DanhGia/product-rated-history/${user.maKH}`);
        ratedOrders.value = resRated.data.map((order: any) => ({
            id: order.id,
            date: order.date,
            products: order.products.map((p: any) => ({
                id: p.id,
                name: p.name,
                image: getImageUrl(p.hinhAnh),
                rating: p.rating,
                comment: p.comment,
                imageReview: p.image ? `${API_BASE_URL}${p.image}` : null,
                reply: p.reply,
                dateStr: p.Ngay
            }))
        }));
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error);
    }
};

onMounted(loadData);

watch(subTab, async (newTab) => {
    await loadData();
});

// Submit review
const submitAction = async (order: any) => {
    const ratedProducts = order.products.filter((p: any) => p.rating > 0);
    if (ratedProducts.length === 0) {
        alert("Vui lòng chọn số sao cho ít nhất một sản phẩm.");
        return;
    }

    try {
        isSubmitting.value = true;

        const formData = new FormData();
        formData.append('maHd', order.id);

        let activeCount = 0;
        order.products.forEach((p: any) => {
            if (p.rating > 0) {
                const prefix = `reviews[${activeCount}]`;
                formData.append(`${prefix}.MaBienThe`, p.id);
                formData.append(`${prefix}.SoSao`, String(p.rating));
                formData.append(`${prefix}.NoiDung`, p.comment || '');
                if (p.imageFile) {
                    formData.append(`${prefix}.HinhAnhFile`, p.imageFile);
                }
                activeCount++;
            }
        });

        const res = await axios.post(`${API_BASE_URL}/api/DanhGia/submit-product-reviews`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.status === 200) {
            alert('✨ Gửi đánh giá sản phẩm thành công!');
            await loadData();
        }
    } catch (error) {
        console.error("Lỗi khi gửi đánh giá:", error);
        alert("Có lỗi xảy ra khi gửi đánh giá.");
    } finally {
        isSubmitting.value = false;
    }
};

// Delete single product review
const deleteSingleProductReview = async (orderId: string, productId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đánh giá của sản phẩm này?")) return;

    try {
        const res = await axios.delete(`${API_BASE_URL}/api/DanhGia/delete-product-rating/${orderId}/${productId}`);
        if (res.status === 200) {
            alert("Đã xóa đánh giá sản phẩm thành công!");
            await loadData();
        }
    } catch (error) {
        console.error("Lỗi khi xóa đánh giá:", error);
        alert("Không thể xóa đánh giá.");
    }
};

// Delete full order product review
const deleteFullOrderProductReview = async (orderId: string) => {
    if (!confirm("Xóa toàn bộ đánh giá sản phẩm của đơn hàng này?")) return;

    try {
        const res = await axios.delete(`${API_BASE_URL}/api/DanhGia/delete-order-product-rating/${orderId}`);
        if (res.status === 200) {
            alert("Đã xóa toàn bộ đánh giá sản phẩm!");
            await loadData();
        }
    } catch (error) {
        console.error("Lỗi khi xóa đánh giá đơn hàng:", error);
        alert("Không thể xóa đánh giá đơn hàng.");
    }
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
                <button @click="subTab = 'pending'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', subTab === 'pending' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']">
                    Chưa đánh giá
                </button>
                <button @click="subTab = 'completed'"
                    :class="['text-[11px] uppercase tracking-widest pb-3 font-medium border-b-2 transition-all cursor-pointer', subTab === 'completed' ? 'border-black text-black font-semibold' : 'border-transparent text-gray-400 hover:text-black']">
                    Đã đánh giá
                </button>
            </div>
        </div>

        <!-- Search & Filter Bar -->
        <div class="flex flex-col sm:flex-row gap-4 mb-6">
            <div class="flex-1 relative">
                <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" v-model="searchQuery" placeholder="Tìm mã đơn hàng, tên sản phẩm..."
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none pl-10 pr-4 py-2.5 text-xs transition-all rounded-none text-black" />
            </div>
            <div class="w-full sm:w-56">
                <select v-model="sortOption"
                    class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-2.5 text-xs transition-all rounded-none text-black cursor-pointer font-medium">
                    <option value="newest">Ngày tạo: Mới nhất</option>
                    <option value="oldest">Ngày tạo: Cũ nhất</option>
                </select>
            </div>
        </div>

        <!-- Content Area -->
        <div class="space-y-6">
            <!-- PENDING TAB -->
            <div v-if="subTab === 'pending'" class="space-y-6">
                <div v-if="paginatedPendingOrders.length === 0"
                    class="text-center py-16 border border-dashed border-gray-200 rounded-none">
                    <ShoppingBag :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                    <p class="text-xs text-gray-400 uppercase tracking-widest">Không có hóa đơn sản phẩm nào chờ đánh
                        giá.</p>
                </div>

                <div v-for="order in paginatedPendingOrders" :key="order.id"
                    class="border border-gray-200 rounded-none bg-white p-6 shadow-sm">
                    <!-- Order Info Header -->
                    <div
                        class="flex flex-col sm:flex-row justify-between sm:items-center border-b border-gray-100 pb-4 mb-5 gap-2">
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
                        <div v-for="p in order.products" :key="p.id"
                            class="flex flex-col md:flex-row gap-6 border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                            <!-- Product thumbnail -->
                            <div
                                class="w-16 h-16 shrink-0 bg-gray-50 border border-gray-100 rounded-none overflow-hidden">
                                <img :src="p.image" :alt="p.name" class="w-full h-full object-cover" />
                            </div>

                            <!-- Review form for this product -->
                            <div class="flex-1 space-y-4">
                                <div>
                                    <h5
                                        class="text-xs font-semibold uppercase tracking-wider text-black leading-tight whitespace-normal break-words max-w-full">
                                        {{ p.name }}
                                    </h5>
                                </div>

                                <!-- Star rating -->
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] uppercase tracking-widest text-gray-400">Đánh giá
                                        sao:</span>
                                    <div class="flex gap-1">
                                        <button v-for="n in 5" :key="n" @click="p.rating = n" type="button"
                                            class="transition-transform active:scale-95 cursor-pointer">
                                            <Star :size="18" :fill="n <= p.rating ? '#f59e0b' : 'none'"
                                                :stroke="n <= p.rating ? '#f59e0b' : '#d1d5db'" :stroke-width="1.5" />
                                        </button>
                                    </div>
                                </div>

                                <!-- Input comment -->
                                <div>
                                    <textarea v-model="p.comment" placeholder="Để lại nhận xét về sản phẩm..." rows="2"
                                        class="w-full bg-white border border-gray-200 focus:border-black outline-none px-4 py-3 text-xs transition-all rounded-none text-black"></textarea>
                                </div>

                                <!-- Image attachment -->
                                <div class="flex items-center gap-4 flex-wrap">
                                    <label :for="'prod-file-' + order.id + '-' + p.id"
                                        class="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 hover:border-black rounded-none cursor-pointer transition-all text-[10px] uppercase tracking-widest text-gray-600 hover:text-black">
                                        <Camera :size="14" />
                                        {{ p.imagePreview ? 'Thay ảnh' : 'Thêm ảnh' }}
                                    </label>
                                    <input type="file" :id="'prod-file-' + order.id + '-' + p.id"
                                        @change="handleFileChange($event, p)" accept="image/*" class="hidden" />

                                    <!-- Image Preview Thumbnail -->
                                    <div v-if="p.imagePreview"
                                        class="relative w-12 h-12 border border-gray-200 rounded-none overflow-hidden group">
                                        <img :src="p.imagePreview" class="w-full h-full object-cover" />
                                        <button @click="removeImage(p)" type="button"
                                            class="absolute inset-0 bg-black/50 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X :size="12" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Submit action -->
                    <div class="mt-6 pt-5 border-t border-gray-100 flex justify-end">
                        <button @click="submitAction(order)" :disabled="isSubmitting"
                            class="bg-black text-white px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold transition-all hover:bg-gray-900 active:scale-[0.98] disabled:opacity-40 rounded-none cursor-pointer">
                            {{ isSubmitting ? 'Đang gửi...' : 'Gửi đánh giá' }}
                        </button>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalPendingPages > 1" class="flex justify-center items-center gap-4 pt-4">
                    <button @click="changePage('pending', -1)" :disabled="currentPendingPage === 1"
                        class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer">
                        <ChevronLeft :size="14" />
                    </button>
                    <span class="text-xs font-semibold tracking-wider text-gray-600">
                        {{ currentPendingPage }} / {{ totalPendingPages }}
                    </span>
                    <button @click="changePage('pending', 1)" :disabled="currentPendingPage === totalPendingPages"
                        class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer">
                        <ChevronRight :size="14" />
                    </button>
                </div>
            </div>

            <!-- COMPLETED TAB -->
            <div v-else class="space-y-6">
                <div v-if="paginatedRatedOrders.length === 0"
                    class="text-center py-16 border border-dashed border-gray-200 rounded-none">
                    <ShoppingBag :size="24" class="mx-auto text-gray-300 mb-3" :stroke-width="1.5" />
                    <p class="text-xs text-gray-400 uppercase tracking-widest">Bạn chưa có lịch sử đánh giá sản phẩm
                        nào.</p>
                </div>

                <div v-for="order in paginatedRatedOrders" :key="order.id"
                    class="border border-gray-200 rounded-none bg-white p-6 shadow-sm animate-in fade-in duration-300">
                    <!-- Rated Order Header -->
                    <div class="flex justify-between items-center border-b border-gray-100 pb-4 mb-5">
                        <div>
                            <span class="text-[10px] uppercase tracking-widest text-gray-400">Đơn hàng</span>
                            <h4 class="text-sm font-semibold tracking-wider text-black">#{{ order.id }}</h4>
                        </div>
                        <div class="flex items-center gap-4">
                            <span class="text-[10px] text-gray-400 uppercase tracking-widest">{{ order.date }}</span>
                            <button @click="deleteFullOrderProductReview(order.id)"
                                class="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                title="Xóa toàn bộ đánh giá của đơn này">
                                <Trash2 :size="14" />
                            </button>
                        </div>
                    </div>

                    <!-- Products list rated details -->
                    <div class="space-y-6">
                        <div v-for="(p, idx) in order.products" :key="idx"
                            class="flex flex-col md:flex-row gap-6 border-b border-gray-50 pb-6 last:border-0 last:pb-0">
                            <!-- Product thumbnail -->
                            <div
                                class="w-16 h-16 shrink-0 bg-gray-50 border border-gray-100 rounded-none overflow-hidden">
                                <img :src="p.image" :alt="p.name" class="w-full h-full object-cover" />
                            </div>

                            <!-- Review detail -->
                            <div class="flex-1 space-y-3">
                                <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-1">
                                    <h5
                                        class="text-xs font-semibold uppercase tracking-wider text-black leading-tight max-w-lg">
                                        {{ p.name }}</h5>

                                    <div class="flex items-center gap-3">
                                        <!-- Star rating visual -->
                                        <div class="flex gap-0.5">
                                            <Star v-for="n in 5" :key="n" :size="12"
                                                :fill="n <= p.rating ? '#f59e0b' : 'none'"
                                                :stroke="n <= p.rating ? '#f59e0b' : '#d1d5db'" :stroke-width="1.5" />
                                        </div>

                                        <!-- Delete single review -->
                                        <button @click="deleteSingleProductReview(order.id, p.id)"
                                            class="text-gray-300 hover:text-red-500 transition-colors cursor-pointer"
                                            title="Xóa đánh giá này">
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
                                    <div @click="openLightbox(p.imageReview)"
                                        class="relative w-20 h-20 border border-gray-100 rounded-none overflow-hidden cursor-zoom-in hover:brightness-90 transition-all group">
                                        <img :src="p.imageReview" class="w-full h-full object-cover" />
                                    </div>
                                </div>

                                <!-- Shop Reply block -->
                                <div v-if="p.reply"
                                    class="bg-gray-50 border-l border-gray-300 p-4 rounded-none mt-3 space-y-1">
                                    <div
                                        class="flex items-center gap-2 text-[10px] uppercase tracking-widest text-black font-semibold">
                                        <MessageSquare :size="12" />
                                        <span>Phản hồi từ Minh Tâm Hair</span>
                                    </div>
                                    <p class="text-xs text-gray-500 font-light leading-relaxed whitespace-pre-line">{{
                                        p.reply }}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pagination -->
                <div v-if="totalRatedPages > 1" class="flex justify-center items-center gap-4 pt-4">
                    <button @click="changePage('rated', -1)" :disabled="currentRatedPage === 1"
                        class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer">
                        <ChevronLeft :size="14" />
                    </button>
                    <span class="text-xs font-semibold tracking-wider text-gray-600">
                        {{ currentRatedPage }} / {{ totalRatedPages }}
                    </span>
                    <button @click="changePage('rated', 1)" :disabled="currentRatedPage === totalRatedPages"
                        class="p-2 border border-gray-200 hover:border-black rounded-none disabled:opacity-30 disabled:hover:border-gray-200 transition-all cursor-pointer">
                        <ChevronRight :size="14" />
                    </button>
                </div>
            </div>
        </div>

        <!-- LIGHTBOX OVERLAY -->
        <Teleport to="body">
            <div v-if="lightboxOpen"
                class="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center animate-in fade-in duration-200"
                @click="lightboxOpen = false">
                <button
                    class="absolute top-5 right-6 w-10 h-10 rounded-full bg-white/10 border border-white/30 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
                    @click.stop="lightboxOpen = false">
                    <X :size="16" />
                </button>
                <div class="max-w-[90vw] max-h-[90vh] flex items-center justify-center" @click.stop>
                    <img :src="lightboxImg" alt="Xem ảnh lớn" class="max-w-full max-h-[90vh] object-contain" />
                </div>
            </div>
        </Teleport>
    </div>
</template>
