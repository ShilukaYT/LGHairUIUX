<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
    Search, MessageSquare, X, Clock, Users,
    ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    Star, Image as ImageIcon, Reply, Trash2, EyeOff, Eye, CheckCircle2, BarChart3
} from 'lucide-vue-next'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'

// --- UI Components ---
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import ThongKeDichVuModal from './ThongKeDichVuModal.vue'

// URL API Backend (Đảm bảo khớp với port chạy C# của bạn)
// URL API Backend (Đã cập nhật chuẩn theo Swagger)
const API_BASE_URL = 'https://localhost:7196/api/QuanLyDanhGiaDichVu'

// --- State ---
const reviews = ref<any[]>([])
const isLoading = ref(false)
const selectedReview = ref<any>(null)

const showStats = ref(false)

// Filters
const searchQuery = ref('')
const filterDate = ref('')
const filterStar = ref('all') // all, 5, 4, 3, 2, 1
const filterStatus = ref('all') // all, replied, unreplied

// Pagination
const currentPage = ref(1)
const itemsPerPage = 8

// Reply state
const replyContent = ref('')

// --- Computed properties ---
const filteredData = computed(() => {
    return reviews.value.filter(r => {
        const q = searchQuery.value.toLowerCase()
        const matchSearch = r.tenKhach.toLowerCase().includes(q) || r.tenDichVu.toLowerCase().includes(q)
        const matchStar = filterStar.value === 'all' || r.soSao === parseInt(filterStar.value)
        const matchStatus = filterStatus.value === 'all' ||
            (filterStatus.value === 'replied' ? r.daPhanHoi : !r.daPhanHoi)
        const matchDate = !filterDate.value || r.ngayDanhGia.includes(filterDate.value)

        return matchSearch && matchStar && matchStatus && matchDate
    })
})

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    return filteredData.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1)

// --- API Calls ---

// 1. Tải danh sách đánh giá
const fetchReviews = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API_BASE_URL}/get-all`)
        reviews.value = res.data
    } catch (error) {
        toast.error("Lỗi khi tải danh sách đánh giá!")
        console.error(error)
    } finally {
        isLoading.value = false
    }
}

// Logic chọn đánh giá để xem chi tiết
const setSelectedReview = (item: any) => {
    selectedReview.value = { ...item }
    replyContent.value = item.phanHoiAdmin || ''
}

// Format ngày giờ đẹp mắt
const formatDateTime = (dateStr: string) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`
}

// --- Các chức năng xử lý (Actions) ---

// 2. Gửi phản hồi cho khách hàng
const submitReply = async () => {
    if (!replyContent.value.trim()) return toast.warning("Vui lòng nhập nội dung phản hồi!")

    try {
        await axios.post(`${API_BASE_URL}/reply`, {
            id: selectedReview.value.id,
            reply: replyContent.value
        })

        toast.success("Đã gửi phản hồi cho khách hàng!")

        // Cập nhật giao diện không cần load lại trang
        const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
        if (idx !== -1) {
            reviews.value[idx].daPhanHoi = true
            reviews.value[idx].phanHoiAdmin = replyContent.value
        }
        selectedReview.value.daPhanHoi = true
        selectedReview.value.phanHoiAdmin = replyContent.value

    } catch (error) {
        toast.error("Lỗi khi gửi phản hồi!")
    }
}

// 3. Ẩn/Hiện đánh giá
const toggleVisibility = async () => {
    const actionStr = selectedReview.value.isHidden ? 'hiển thị lại' : 'ẩn'
    const result = await Swal.fire({
        title: `Xác nhận ${actionStr}?`,
        text: `Bạn có chắc muốn ${actionStr} đánh giá này trên ứng dụng khách hàng?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4F46E5',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Đồng ý'
    })

    if (result.isConfirmed) {
        try {
            await axios.put(`${API_BASE_URL}/toggle-visibility/${selectedReview.value.id}`)
            toast.success(`Đã ${actionStr} đánh giá!`)

            selectedReview.value.isHidden = !selectedReview.value.isHidden
            const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
            if (idx !== -1) reviews.value[idx].isHidden = selectedReview.value.isHidden
        } catch (error) {
            toast.error("Thao tác thất bại!")
        }
    }
}

// 4. Xóa vĩnh viễn đánh giá
const deleteReview = async () => {
    const result = await Swal.fire({
        title: 'Xóa vĩnh viễn?',
        text: 'Dữ liệu đánh giá và hình ảnh sẽ bị xóa khỏi hệ thống. Không thể hoàn tác!',
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Xóa ngay'
    })

    if (result.isConfirmed) {
        try {
            await axios.delete(`${API_BASE_URL}/delete/${selectedReview.value.id}`)
            toast.success("Đã xóa đánh giá!")

            // Cập nhật lại list trên UI
            reviews.value = reviews.value.filter(r => r.id !== selectedReview.value.id)
            selectedReview.value = null

            // Xử lý tụt trang nếu xóa hết item ở trang cuối
            if (paginatedData.value.length === 0 && currentPage.value > 1) currentPage.value--
        } catch (error) {
            toast.error("Lỗi khi xóa đánh giá!")
        }
    }
}
// 5. Quét và xóa theo từ khóa (Hàng loạt)
const deleteByKeyword = async () => {
    // Bước 1: Hiện popup nhập từ khóa
    const { value: keyword } = await Swal.fire({
        title: 'Xóa đánh giá rác',
        input: 'text',
        inputLabel: 'Nhập từ khóa (Ví dụ: spam, qc, dở...)',
        inputPlaceholder: 'Nhập từ khóa cần quét...',
        showCancelButton: true,
        confirmButtonText: 'Quét & Xóa',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444',
        inputValidator: (value) => {
            if (!value) return 'Bạn cần nhập từ khóa để quét!'
        }
    })

    if (keyword) {
        // Bước 2: Xác nhận lại lần cuối cho an toàn
        const confirm = await Swal.fire({
            title: `CẢNH BÁO!`,
            text: `Hệ thống sẽ xóa VĨNH VIỄN tất cả đánh giá có chứa chữ "${keyword}". Bạn có chắc chắn?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Đồng ý xóa',
            cancelButtonText: 'Hủy',
            confirmButtonColor: '#ef4444'
        })

        if (confirm.isConfirmed) {
            try {
                // Gọi API truyền từ khóa lên
                const res = await axios.delete(`${API_BASE_URL}/delete-by-keyword?keyword=${encodeURIComponent(keyword)}`);
                toast.success(res.data.message);

                // Reset lại giao diện
                selectedReview.value = null;
                await fetchReviews();

            } catch (error: any) {
                if (error.response && error.response.status === 404) {
                    toast.info("Không có đánh giá nào chứa từ khóa này.");
                } else {
                    toast.error("Lỗi khi quét xóa từ khóa!");
                }
            }
        }
    }
}
// Load dữ liệu khi vào trang
onMounted(() => {
    fetchReviews()
})

// Tự động nhảy về trang 1 nếu người dùng thay đổi bộ lọc
watch([searchQuery, filterStar, filterStatus, filterDate], () => {
    currentPage.value = 1
})
</script>

<template>
    <div class="min-h-screen bg-[#F0F2F5] p-5 md:p-10 font-sans text-slate-800 text-left">
        <div class="max-w-[1500px] mx-auto grid grid-cols-12 gap-6 lg:gap-10 items-start">

            <div class="col-span-12 lg:col-span-7 flex flex-col gap-6">

                <div
                    class="bg-white p-6 md:p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-wrap justify-between items-center gap-4">
                    <div class="flex items-center gap-4">
                        <div
                            class="w-12 h-12 md:w-14 md:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-indigo-200">
                            <MessageSquare class="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <div>
                            <h1 class="text-lg md:text-xl font-bold tracking-tight leading-tight">Quản lý Đánh Giá</h1>
                            <p class="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">Customer
                                Feedback</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <Button @click="showStats = true" variant="outline" 
                            class="rounded-xl font-bold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 border-none shadow-none transition-all">
                            <BarChart3 class="w-4 h-4 md:mr-2" /> 
                            <span class="hidden md:inline">Thống kê Xếp hạng</span>
                        </Button>

                        <Button @click="deleteByKeyword" variant="destructive"
                            class="rounded-xl font-bold bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 border-none shadow-none transition-all">
                            <Trash2 class="w-4 h-4 mr-2" /> Dọn dẹp đánh giá
                        </Button>
                        <Button @click="fetchReviews" variant="outline" class="rounded-xl font-bold text-slate-600">
                            <Clock class="w-4 h-4 mr-2" /> Làm mới
                        </Button>
                    </div>
                </div>

                <div class="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col"
                    style="height: calc(100vh - 220px); min-height: 500px;">

                    <div class="p-5 border-b border-slate-50 flex flex-wrap gap-3 items-center bg-slate-50/50">
                        <div class="relative flex-1 min-w-[200px]">
                            <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                            <Input v-model="searchQuery" placeholder="Tìm khách hàng, dịch vụ..."
                                class="pl-11 h-11 rounded-xl bg-white border-none shadow-sm text-sm" />
                        </div>

                        <Select v-model="filterStar">
                            <SelectTrigger
                                class="w-[120px] h-11 rounded-xl bg-white border-none shadow-sm font-semibold">
                                <SelectValue placeholder="Số sao" />
                            </SelectTrigger>
                            <SelectContent class="rounded-xl border-none shadow-xl">
                                <SelectItem value="all">Tất cả sao</SelectItem>
                                <SelectItem value="5">5 Sao</SelectItem>
                                <SelectItem value="4">4 Sao</SelectItem>
                                <SelectItem value="3">3 Sao</SelectItem>
                                <SelectItem value="2">2 Sao</SelectItem>
                                <SelectItem value="1">1 Sao</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select v-model="filterStatus">
                            <SelectTrigger
                                class="w-[140px] h-11 rounded-xl bg-white border-none shadow-sm font-semibold">
                                <SelectValue placeholder="Trạng thái" />
                            </SelectTrigger>
                            <SelectContent class="rounded-xl border-none shadow-xl">
                                <SelectItem value="all">Mọi trạng thái</SelectItem>
                                <SelectItem value="unreplied">Chưa phản hồi</SelectItem>
                                <SelectItem value="replied">Đã phản hồi</SelectItem>
                            </SelectContent>
                        </Select>

                        <div class="flex items-center gap-2 bg-white px-3 h-11 rounded-xl shadow-sm">
                            <CalendarIcon class="w-4 h-4 text-slate-400" />
                            <input type="date" v-model="filterDate"
                                class="bg-transparent border-none font-semibold text-xs outline-none text-slate-700 cursor-pointer" />
                        </div>
                    </div>

                    <div class="flex-1 overflow-auto custom-scroll relative">
                        <div v-if="isLoading"
                            class="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
                            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow class="border-none hover:bg-transparent bg-white">
                                    <TableHead
                                        class="pl-6 w-[35%] font-black text-[10px] text-slate-300 uppercase tracking-widest">
                                        Khách hàng</TableHead>
                                    <TableHead
                                        class="w-[30%] font-black text-[10px] text-slate-300 uppercase tracking-widest">
                                        Đánh giá</TableHead>
                                    <TableHead
                                        class="w-[25%] font-black text-[10px] text-slate-300 uppercase tracking-widest text-center">
                                        Trạng thái</TableHead>
                                    <TableHead class="w-[10%]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow v-for="item in paginatedData" :key="item.id" @click="setSelectedReview(item)"
                                    class="cursor-pointer border-b border-slate-50 transition-all duration-150"
                                    :class="selectedReview?.id === item.id ? 'bg-indigo-50/50' : 'hover:bg-slate-50'">

                                    <TableCell class="pl-6 py-4">
                                        <div class="text-sm font-bold text-slate-800 flex items-center gap-2">
                                            {{ item.tenKhach }}
                                            <EyeOff v-if="item.isHidden" class="w-3.5 h-3.5 text-red-400" />
                                        </div>
                                        <div
                                            class="text-[11px] font-medium text-slate-400 mt-0.5 truncate max-w-[200px]">
                                            {{ item.tenDichVu }}</div>
                                    </TableCell>

                                    <TableCell class="py-4">
                                        <div class="flex items-center gap-0.5 mb-1">
                                            <Star v-for="n in 5" :key="n" class="w-3.5 h-3.5"
                                                :class="n <= item.soSao ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-200'" />
                                            <ImageIcon v-if="item.hinhAnh" class="w-3 h-3 text-indigo-400 ml-2" />
                                        </div>
                                        <div class="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                                            <Clock class="w-3 h-3" /> {{ formatDateTime(item.ngayDanhGia) }}
                                        </div>
                                    </TableCell>

                                    <TableCell class="py-4 text-center">
                                        <span
                                            class="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
                                            :class="item.daPhanHoi ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-50 text-amber-500'">
                                            {{ item.daPhanHoi ? 'Đã phản hồi' : 'Chưa xử lý' }}
                                        </span>
                                    </TableCell>

                                    <TableCell class="pr-6 py-4 text-right">
                                        <ChevronRight class="w-4 h-4 ml-auto text-slate-300" />
                                    </TableCell>
                                </TableRow>

                                <TableRow v-if="paginatedData.length === 0 && !isLoading"
                                    class="border-none hover:bg-transparent">
                                    <TableCell colspan="4" class="text-center py-20 text-slate-300">
                                        <MessageSquare class="w-8 h-8 mx-auto mb-3 opacity-30" />
                                        <p class="text-xs font-bold uppercase tracking-widest">Không tìm thấy đánh giá
                                            nào</p>
                                    </TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>

                    <div class="px-6 py-4 flex justify-between items-center border-t border-slate-50 bg-white">
                        <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest">Trang {{
                            currentPage }} / {{ totalPages }}</span>
                        <div class="flex gap-1">
                            <Button @click="currentPage--" :disabled="currentPage === 1" variant="ghost" size="sm"
                                class="rounded-lg w-9 h-9 p-0 hover:bg-slate-100">
                                <ChevronLeft class="w-4 h-4 text-slate-500" />
                            </Button>
                            <Button @click="currentPage++" :disabled="currentPage === totalPages" variant="ghost"
                                size="sm" class="rounded-lg w-9 h-9 p-0 hover:bg-slate-100">
                                <ChevronRight class="w-4 h-4 text-slate-500" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-span-12 lg:col-span-5 sticky top-10">

                <div v-if="selectedReview"
                    class="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-300"
                    style="height: calc(100vh - 80px); min-height: 620px;">

                    <div class="flex-shrink-0 bg-white px-7 pt-7 pb-5 border-b border-slate-100 relative">
                        <div v-if="selectedReview.isHidden"
                            class="absolute top-0 left-0 w-full bg-red-50 text-red-500 text-[10px] font-black uppercase tracking-widest text-center py-1">
                            Đánh giá này đang bị ẩn khỏi App Khách Hàng
                        </div>

                        <div class="flex justify-between items-center mb-4 mt-2">
                            <span
                                class="bg-slate-50 text-slate-400 font-bold text-[9px] uppercase tracking-widest px-3 py-1 rounded-lg">
                                MÃ ĐƠN: #{{ selectedReview.maHd }}
                            </span>
                            <button @click="selectedReview = null"
                                class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 transition-colors">
                                <X class="w-4 h-4" />
                            </button>
                        </div>

                        <div class="flex items-end justify-between gap-3">
                            <div>
                                <h2 class="text-2xl font-black text-slate-900 tracking-tight leading-tight">{{
                                    selectedReview.tenKhach }}</h2>
                                <p class="text-xs font-semibold text-slate-400 mt-1 flex items-center gap-1">
                                    <Users class="w-3.5 h-3.5" /> {{ selectedReview.sdt || 'Chưa cập nhật SĐT' }}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div class="flex-1 overflow-y-auto custom-scroll px-7 py-5 space-y-6">

                        <div class="bg-slate-50 rounded-2xl p-5 border border-slate-100 relative">
                            <div class="flex justify-between items-start mb-3">
                                <div>
                                    <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Dịch
                                        vụ đánh giá</p>
                                    <p class="text-sm font-bold text-slate-700">{{ selectedReview.tenDichVu }}</p>
                                </div>
                                <div class="flex gap-0.5 bg-white px-2 py-1 rounded-lg shadow-sm">
                                    <Star v-for="n in 5" :key="n" class="w-4 h-4"
                                        :class="n <= selectedReview.soSao ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-200'" />
                                </div>
                            </div>

                            <p
                                class="text-sm text-slate-600 leading-relaxed italic border-l-2 border-indigo-200 pl-3 my-4">
                                "{{ selectedReview.noiDung || 'Khách hàng chỉ đánh giá sao, không để lại nhận xét chi tiết.' }}"
                            </p>

                            <div v-if="selectedReview.hinhAnh" class="mt-3">
                                <p
                                    class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1 mb-2">
                                    <ImageIcon class="w-3 h-3" /> Ảnh do khách chụp
                                </p>
                                <img :src="'https://localhost:7196' + selectedReview.hinhAnh"
                                    class="max-w-[200px] h-auto object-cover rounded-xl border border-slate-200 shadow-sm hover:scale-105 transition-transform cursor-pointer"
                                    alt="Review Image" />
                            </div>
                        </div>

                        <div class="space-y-3">
                            <label
                                class="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Reply class="w-3 h-3 text-indigo-500" /> Phản hồi của Salon
                            </label>
                            <textarea v-model="replyContent" rows="4"
                                placeholder="Nhập nội dung phản hồi khách hàng (Lời cảm ơn, giải quyết khiếu nại...)"
                                class="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-medium text-slate-700 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all resize-none shadow-inner"></textarea>
                            <Button @click="submitReply"
                                class="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-md shadow-slate-200 transition-all">
                                <CheckCircle2 class="w-4 h-4 mr-2" /> Lưu phản hồi
                            </Button>
                        </div>

                        <div class="h-4"></div>
                    </div>

                    <div class="flex-shrink-0 px-7 py-5 bg-white border-t border-slate-100 flex gap-3">
                        <Button @click="toggleVisibility" variant="outline"
                            class="flex-1 h-12 rounded-xl font-bold border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">
                            <component :is="selectedReview.isHidden ? Eye : EyeOff" class="w-4 h-4 mr-2"
                                :class="selectedReview.isHidden ? 'text-emerald-500' : 'text-slate-500'" />
                            {{ selectedReview.isHidden ? 'Hiển thị lại' : 'Ẩn Đánh Giá' }}
                        </Button>
                        <Button @click="deleteReview" variant="destructive"
                            class="flex-1 h-12 rounded-xl font-bold bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-600 border-none shadow-none transition-all">
                            <Trash2 class="w-4 h-4 mr-2" /> Xóa vĩnh viễn
                        </Button>
                    </div>
                </div>

                <div v-else
                    class="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center text-slate-200 p-12 text-center"
                    style="height: calc(100vh - 80px); min-height: 620px;">
                    <MessageSquare class="w-12 h-12 mb-4 opacity-20" />
                    <h3 class="text-sm font-bold uppercase tracking-widest text-slate-300">Chọn một đánh giá</h3>
                    <p class="text-xs font-medium text-slate-400 mt-2">để xem chi tiết hình ảnh và gửi phản hồi</p>
                </div>
            </div>

        </div>
        <Toaster richColors position="bottom-center" />
        <ThongKeDichVuModal :is-open="showStats" @close="showStats = false" />
    </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800&display=swap');

.font-sans {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}

.custom-scroll::-webkit-scrollbar {
    width: 4px;
}

.custom-scroll::-webkit-scrollbar-thumb {
    background: #E2E8F0;
    border-radius: 10px;
}

.custom-scroll::-webkit-scrollbar-track {
    background: transparent;
}
</style>