<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
    Search, MessageSquare, X, Clock, Users, Phone, Scissors,
    ChevronLeft, ChevronRight, Calendar as CalendarIcon,
    Star, Image as ImageIcon, Reply, Trash2, EyeOff, Eye, CheckCircle2, BarChart3
} from 'lucide-vue-next'
import axios from 'axios'
import { toast } from 'vue-sonner'
import Swal from 'sweetalert2'
import { logActivity } from '@/utils/activityLogger'

// --- UI Components ---
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import ThongKeDichVuModal from './ThongKeDichVuModal.vue'

// URL API Backend
const API_BASE_URL = 'https://localhost:7196/api/QuanLyDanhGiaDichVu'

// --- State ---
const reviews = ref<any[]>([])
const isLoading = ref(false)
const selectedReview = ref<any>(null)
const showStats = ref(false)
const detailOpen = ref(false)
const isImageBroken = ref(false)

// Filters
const searchQuery = ref('')
const filterDate = ref('')
const filterStar = ref('all') // all, 5, 4, 3, 2, 1
const filterStatus = ref('all') // all, replied, unreplied

// Pagination
const currentPage = ref(1)
const itemsPerPage = 10

// Reply state
const replyContent = ref('')

// --- Computed properties ---
const filteredData = computed(() => {
    return reviews.value.filter(r => {
        const q = searchQuery.value.toLowerCase()
        const matchSearch = (r.tenKhach || '').toLowerCase().includes(q) || (r.tenDichVu || '').toLowerCase().includes(q)
        const matchStar = filterStar.value === 'all' || r.soSao === parseInt(filterStar.value)
        const matchStatus = filterStatus.value === 'all' ||
            (filterStatus.value === 'replied' ? r.daPhanHoi : !r.daPhanHoi)
        const matchDate = !filterDate.value || (r.ngayDanhGia && r.ngayDanhGia.includes(filterDate.value))

        return matchSearch && matchStar && matchStatus && matchDate
    })
})

const paginatedData = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    return filteredData.value.slice(start, start + itemsPerPage)
})

const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1)

// Lấy chữ cái viết tắt của tên khách để làm Avatar
const getInitials = (name: string) => {
    if (!name) return 'KH'
    const parts = name.trim().split(' ')
    if (parts.length === 1) {
        const first = parts[0]
        return first ? first.substring(0, 2).toUpperCase() : 'KH'
    }
    const firstChar = parts[parts.length - 2]?.substring(0, 1) || ''
    const secondChar = parts[parts.length - 1]?.substring(0, 1) || ''
    return (firstChar + secondChar).toUpperCase() || 'KH'
}

// Kiểm tra ảnh hợp lệ
const hasImage = computed(() => {
    if (!selectedReview.value?.hinhAnh) return false
    const imgStr = selectedReview.value.hinhAnh.trim().toLowerCase()
    if (imgStr === '' || imgStr === 'null' || imgStr.endsWith('/null') || imgStr.endsWith('/')) return false
    return !isImageBroken.value
})

// --- API Calls ---

// 1. Tải danh sách đánh giá
const fetchReviews = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API_BASE_URL}/get-all`)
        reviews.value = res.data
    } catch (error) {
        toast.error("Lỗi khi tải danh sách đánh giá dịch vụ!")
        console.error(error)
    } finally {
        isLoading.value = false
    }
}

// Logic chọn đánh giá để xem chi tiết
const openDetail = (item: any) => {
    selectedReview.value = { ...item }
    replyContent.value = item.phanHoiAdmin || ''
    isImageBroken.value = false
    detailOpen.value = true
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

        logActivity("Phản hồi đánh giá dịch vụ", `Đã phản hồi đánh giá của khách hàng ${selectedReview.value.tenKhach} cho dịch vụ ${selectedReview.value.tenDichVu}`, "Đánh giá");
        toast.success("Đã gửi phản hồi cho khách hàng!")

        // Ghi nhận trực tiếp trên UI
        const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
        if (idx !== -1) {
            reviews.value[idx].daPhanHoi = true
            reviews.value[idx].phanHoiAdmin = replyContent.value
        }
        selectedReview.value.daPhanHoi = true
        selectedReview.value.phanHoiAdmin = replyContent.value
        detailOpen.value = false

    } catch (error: any) {
        logActivity("Phản hồi đánh giá dịch vụ", `Thất bại khi phản hồi đánh giá của ${selectedReview.value?.tenKhach || ''} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại");
        toast.error("Lỗi khi gửi phản hồi!")
    }
}

// 3. Ẩn/Hiện đánh giá
const toggleVisibility = async () => {
    const actionStr = selectedReview.value.isHidden ? 'hiển thị lại' : 'ẩn'
    const result = await Swal.fire({
        title: `Xác nhận ${actionStr}?`,
        text: `Bạn có chắc muốn ${actionStr} đánh giá dịch vụ này trên ứng dụng khách hàng?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#1677ff',
        cancelButtonColor: '#cbd5e1',
        confirmButtonText: 'Đồng ý'
    })

    if (result.isConfirmed) {
        try {
            await axios.put(`${API_BASE_URL}/toggle-visibility/${selectedReview.value.id}`)
            logActivity("Đổi trạng thái hiển thị đánh giá dịch vụ", `Đã ${actionStr} đánh giá của khách hàng ${selectedReview.value.tenKhach}`, "Đánh giá");
            toast.success(`Đã ${actionStr} đánh giá dịch vụ!`)

            selectedReview.value.isHidden = !selectedReview.value.isHidden
            const idx = reviews.value.findIndex(r => r.id === selectedReview.value.id)
            if (idx !== -1) reviews.value[idx].isHidden = selectedReview.value.isHidden
        } catch (error: any) {
            logActivity("Đổi trạng thái hiển thị đánh giá dịch vụ", `Thất bại khi ${actionStr} đánh giá của ${selectedReview.value.tenKhach} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại");
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
        const reviewKhachName = selectedReview.value.tenKhach;
        try {
            await axios.delete(`${API_BASE_URL}/delete/${selectedReview.value.id}`)
            logActivity("Xóa đánh giá dịch vụ", `Đã xóa vĩnh viễn đánh giá của khách hàng ${reviewKhachName}`, "Đánh giá");
            toast.success("Đã xóa đánh giá!")

            // Cập nhật lại list trên UI
            reviews.value = reviews.value.filter(r => r.id !== selectedReview.value.id)
            selectedReview.value = null
            detailOpen.value = false

            // Xử lý tụt trang nếu xóa hết item ở trang cuối
            if (paginatedData.value.length === 0 && currentPage.value > 1) currentPage.value--
        } catch (error: any) {
            logActivity("Xóa đánh giá dịch vụ", `Thất bại khi xóa vĩnh viễn đánh giá của ${reviewKhachName} - Lỗi: ${error.message || ''}`, "Đánh giá", "Thất bại");
            toast.error("Lỗi khi xóa đánh giá!")
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
    <div class="flex flex-col gap-6 w-full">
        <!-- Sub Toolbar -->
        <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between gap-3 flex-wrap bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-2xs">
            <!-- Filter Actions on Left -->
            <div class="d-flex align-center gap-3 flex-wrap flex-1">
                <div class="relative w-full sm:w-64">
                    <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input v-model="searchQuery" placeholder="Tìm khách hàng, dịch vụ..."
                        class="w-full h-10 pl-10 pr-4 rounded-lg border border-slate-300 text-xs font-semibold outline-none focus:border-primary bg-white text-slate-800 shadow-2xs" />
                </div>

                <div class="d-flex align-center gap-2 text-caption font-weight-bold text-medium-emphasis">
                    <span class="text-xs text-slate-500">SAO:</span>
                    <select v-model="filterStar" class="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400 transition-colors">
                        <option value="all">Tất cả sao</option>
                        <option value="5">5 Sao</option>
                        <option value="4">4 Sao</option>
                        <option value="3">3 Sao</option>
                        <option value="2">2 Sao</option>
                        <option value="1">1 Sao</option>
                    </select>
                </div>

                <div class="d-flex align-center gap-2 text-caption font-weight-bold text-medium-emphasis">
                    <span class="text-xs text-slate-500">TRẠNG THÁI:</span>
                    <select v-model="filterStatus" class="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 outline-none cursor-pointer hover:border-slate-400 transition-colors">
                        <option value="all">Tất cả</option>
                        <option value="unreplied">Chưa phản hồi</option>
                        <option value="replied">Đã phản hồi</option>
                    </select>
                </div>

                <div class="d-flex align-center gap-2 bg-white px-3 h-10 rounded-lg border border-slate-300 shadow-2xs">
                    <CalendarIcon class="w-4 h-4 text-slate-400" />
                    <input type="date" v-model="filterDate"
                        class="bg-transparent border-none font-semibold text-[11px] outline-none text-slate-700 cursor-pointer" />
                </div>
            </div>

            <!-- Action buttons on Right -->
            <div class="d-flex align-center gap-2.5">
                <v-btn @click="showStats = true" variant="flat" color="primary" rounded="lg" class="text-none font-weight-bold h-10 text-xs text-white shadow-sm">
                    <template v-slot:prepend><BarChart3 class="w-4 h-4 mr-1" /></template>
                    Thống kê hiệu năng
                </v-btn>
                <v-btn @click="fetchReviews" variant="outlined" color="grey-darken-1" rounded="lg" class="text-none font-weight-bold h-10 text-xs bg-white hover:bg-slate-50">
                    <template v-slot:prepend><Clock class="w-4 h-4 mr-1" /></template>
                    Làm mới
                </v-btn>
            </div>
        </div>

        <!-- Full-Width Table Layout -->
        <div class="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm w-full">
            <div class="overflow-x-auto relative w-full">
                <div v-if="isLoading" class="absolute inset-0 bg-white/80 backdrop-blur-xs z-10 flex items-center justify-center">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>

                <Table class="w-full text-xs text-left">
                    <TableHeader class="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px]">
                        <TableRow class="hover:bg-transparent">
                            <TableHead class="pl-6 w-[110px] py-3.5 font-bold text-center">MÃ ĐƠN</TableHead>
                            <TableHead class="w-[220px] py-3.5 font-bold">Khách hàng</TableHead>
                            <TableHead class="w-[280px] py-3.5 font-bold">Dịch vụ & Nhận xét</TableHead>
                            <TableHead class="w-[160px] py-3.5 font-bold text-center">Số sao</TableHead>
                            <TableHead class="w-[160px] py-3.5 font-bold text-center">Ngày đánh giá</TableHead>
                            <TableHead class="w-[140px] py-3.5 font-bold text-center">Trạng thái</TableHead>
                            <TableHead class="w-[100px] py-3.5 font-bold text-center">Thao tác</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody class="divide-y divide-slate-100">
                        <TableRow v-for="item in paginatedData" :key="item.id" @click="openDetail(item)"
                            class="cursor-pointer hover:bg-slate-50/50 border-b border-slate-100 transition-all duration-150 group"
                        >
                            <!-- Mã HD -->
                            <TableCell class="py-4 text-center font-mono font-bold text-slate-800">#{{ item.maHd }}</TableCell>

                            <!-- Khách hàng -->
                            <TableCell class="py-4">
                                <div class="flex items-center gap-3">
                                    <div class="w-8 h-8 bg-primary/10 text-primary font-bold flex items-center justify-center text-xs rounded-md">
                                        {{ getInitials(item.tenKhach) }}
                                    </div>
                                    <div>
                                        <div class="text-xs font-bold text-slate-800 flex items-center gap-1.5 group-hover:text-primary transition-colors">
                                            {{ item.tenKhach }}
                                            <EyeOff v-if="item.isHidden" class="w-3.5 h-3.5 text-red-500" title="Đánh giá đang bị ẩn" />
                                        </div>
                                        <div class="text-[10px] text-slate-400 font-semibold mt-0.5">{{ item.sdt || 'Chưa có SĐT' }}</div>
                                    </div>
                                </div>
                            </TableCell>

                            <!-- Dịch vụ & Nhận xét -->
                            <TableCell class="py-4">
                                <div class="font-bold text-slate-700 max-w-[260px] truncate" :title="item.tenDichVu">{{ item.tenDichVu }}</div>
                                <div class="text-[11px] text-slate-400 italic mt-1 truncate max-w-[260px] font-medium" :title="item.noiDung">
                                    "{{ item.noiDung || 'Khách hàng chỉ chấm sao' }}"
                                </div>
                            </TableCell>

                            <!-- Số sao -->
                            <TableCell class="py-4 text-center">
                                <div class="flex items-center justify-center gap-0.5">
                                    <Star v-for="n in 5" :key="n" class="w-3.5 h-3.5"
                                        :class="n <= item.soSao ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-200'" />
                                    <ImageIcon v-if="item.hinhAnh && !item.hinhAnh.toLowerCase().includes('null')" class="w-3.5 h-3.5 text-primary ml-1.5" />
                                </div>
                            </TableCell>

                            <!-- Ngày đánh giá -->
                            <TableCell class="py-4 text-center text-slate-655 font-medium">
                                {{ formatDateTime(item.ngayDanhGia) }}
                            </TableCell>

                            <!-- Trạng thái -->
                            <TableCell class="py-4 text-center">
                                <span class="px-2.5 py-1 rounded-md text-[9px] font-extrabold uppercase tracking-widest border border-solid"
                                    :class="item.daPhanHoi ? 'bg-emerald-50 text-emerald-700 border-emerald-250' : 'bg-amber-50 text-amber-700 border-amber-250'">
                                    {{ item.daPhanHoi ? 'Đã phản hồi' : 'Chưa xử lý' }}
                                </span>
                            </TableCell>

                            <!-- Thao tác -->
                            <TableCell class="py-4 text-center" @click.stop>
                                <v-btn @click="openDetail(item)" variant="outlined" color="primary" size="small" rounded="md" class="text-none font-weight-bold h-8 text-[11px] px-3">
                                    Chi tiết
                                </v-btn>
                            </TableCell>
                        </TableRow>

                        <TableRow v-if="paginatedData.length === 0 && !isLoading" class="border-none hover:bg-transparent">
                            <TableCell colspan="7" class="text-center py-20 text-slate-350 bg-white">
                                <MessageSquare class="w-8 h-8 mx-auto mb-3 opacity-30 text-primary" />
                                <p class="text-xs font-bold uppercase tracking-widest">Không tìm thấy đánh giá dịch vụ nào</p>
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            </div>

            <!-- Pagination -->
            <div class="px-6 py-4 flex justify-between items-center border-t border-slate-250 bg-white">
                <span class="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                    Tổng số <strong class="text-slate-700 font-mono">{{ filteredData.length }}</strong> đánh giá · Trang {{ currentPage }} / {{ totalPages }}
                </span>
                <div class="flex gap-1.5">
                    <v-btn
                        variant="outlined" color="grey-darken-1" size="36" rounded="md"
                        :disabled="currentPage <= 1 || isLoading"
                        @click="currentPage = Math.max(1, currentPage - 1)"
                        class="min-w-0"
                    >
                        <ChevronLeft class="w-4 h-4" />
                    </v-btn>
                    <v-btn
                        variant="outlined" color="grey-darken-1" size="36" rounded="md"
                        :disabled="currentPage >= totalPages || isLoading"
                        @click="currentPage = Math.min(totalPages, currentPage + 1)"
                        class="min-w-0"
                    >
                        <ChevronRight class="w-4 h-4" />
                    </v-btn>
                </div>
            </div>
        </div>

        <!-- Detail Modal Dialog (Standard rounded-lg, 100% Symmetrical, Native Inputs, No Clipping) -->
        <Teleport to="body">
            <div v-if="detailOpen"
                class="fixed inset-0 z-[2400] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                role="dialog" aria-modal="true"
            >
                <button type="button" class="absolute inset-0 bg-transparent cursor-default border-none outline-none" @click="detailOpen = false" />
                
                <div class="relative z-10 flex max-h-[90vh] w-full max-w-2xl min-h-0 flex-col overflow-hidden rounded-xl border border-solid border-slate-300 bg-white shadow-2xl transition-all animate-in zoom-in-95 duration-200"
                    @click.stop
                >
                    <!-- Header -->
                    <div class="shrink-0 border-b border-solid border-slate-205 !px-8 !pt-6 !pb-4 bg-slate-50 flex justify-between items-center">
                        <div>
                            <h2 class="text-lg font-bold text-slate-800 tracking-wide uppercase">Chi Tiết Đánh Giá Dịch Vụ</h2>
                            <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5 font-mono">MÃ ĐƠN HÀNG: #{{ selectedReview.maHd }}</div>
                        </div>
                        <button @click="detailOpen = false" class="w-8 h-8 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-solid border-slate-200 cursor-pointer transition-all duration-200 shadow-2xs">
                            <X class="w-4 h-4" />
                        </button>
                    </div>

                    <!-- Body (Flexbox container with explicit gap-6 to prevent layout collapse/overlapping) -->
                    <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain !px-8 !py-6 flex flex-col gap-6 text-xs text-left bg-slate-100">
                        <div v-if="selectedReview.isHidden" class="bg-red-50 text-red-655 text-[10px] font-bold uppercase tracking-widest text-center py-2.5 rounded-lg border border-solid border-red-200 shadow-sm">
                            Đánh giá này đang bị ẩn khỏi ứng dụng khách hàng
                        </div>

                        <!-- Row 1: Tên khách hàng & Số điện thoại (Native inputs to prevent overlapping and clipping) -->
                        <div class="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
                            <div class="flex flex-col gap-2">
                                <Label class="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase ml-1">Tên khách hàng</Label>
                                <div class="relative group">
                                    <Users class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    <input v-model="selectedReview.tenKhach" readonly
                                        class="w-full h-11 pl-10 pr-4 text-xs border border-solid border-slate-300 bg-white text-slate-800 font-bold outline-none cursor-default shadow-sm hover:border-slate-400 transition-all duration-200 !rounded-lg" />
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <Label class="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase ml-1">Số điện thoại</Label>
                                <div class="relative group">
                                    <Phone class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    <input v-model="selectedReview.sdt" readonly
                                        class="w-full h-11 pl-10 pr-4 text-xs border border-solid border-slate-300 bg-white text-slate-800 font-bold outline-none cursor-default shadow-sm hover:border-slate-400 transition-all duration-200 !rounded-lg" />
                                </div>
                            </div>
                        </div>

                        <!-- Row 2: Dịch vụ đánh giá & Xếp hạng sao -->
                        <div class="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-6">
                            <div class="flex flex-col gap-2">
                                <Label class="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase ml-1">Dịch vụ đánh giá</Label>
                                <div class="relative group">
                                    <Scissors class="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                    <input v-model="selectedReview.tenDichVu" readonly
                                        class="w-full h-11 pl-10 pr-4 text-xs border border-solid border-slate-300 bg-white text-primary font-extrabold outline-none cursor-default shadow-sm hover:border-slate-400 transition-all duration-200 !rounded-lg" />
                                </div>
                            </div>
                            <div class="flex flex-col gap-2">
                                <Label class="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase ml-1">Xếp hạng (Sao)</Label>
                                <div class="h-11 flex items-center px-4 !rounded-lg border border-solid border-slate-300 bg-white shadow-sm transition-all duration-200">
                                    <div class="flex gap-0.5">
                                        <Star v-for="n in 5" :key="n" class="w-4 h-4"
                                            :class="n <= selectedReview.soSao ? 'fill-yellow-400 text-yellow-400' : 'fill-slate-100 text-slate-200'" />
                                    </div>
                                    <span class="ml-2.5 text-[10px] font-extrabold text-slate-500">({{ selectedReview.soSao }} / 5 Sao)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Row 3: Nhận xét từ khách hàng (Immersive text area with clean straight blue left-border) -->
                        <div class="flex flex-col gap-2">
                            <Label class="text-[10px] font-extrabold text-slate-500 tracking-wider uppercase ml-1">Nhận xét từ khách hàng</Label>
                            <div class="relative group">
                                <MessageSquare class="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400 group-hover:text-primary transition-colors" />
                                <textarea v-model="selectedReview.noiDung" readonly 
                                    class="w-full min-h-[90px] pl-10 pr-4 py-3 text-xs bg-white border border-solid border-slate-300 border-l-4 border-l-primary hover:border-slate-350 text-slate-700 outline-none resize-none shadow-sm cursor-default font-medium leading-relaxed italic transition-all duration-200 !rounded-lg"></textarea>
                            </div>
                            <div class="text-[10px] text-slate-400 text-end font-semibold mr-1">
                                Ngày gửi: {{ formatDateTime(selectedReview.ngayDanhGia) }}
                            </div>
                        </div>

                        <!-- Row 4: Hình ảnh đính kèm -->
                        <div v-if="hasImage" class="flex flex-col gap-2 animate-in slide-in-from-bottom-2 duration-200">
                            <Label class="text-[10px] font-extrabold text-slate-550 tracking-wider flex items-center gap-1.5 ml-1">
                                <ImageIcon class="w-3.5 h-3.5 text-slate-450" /> Hình ảnh đính kèm
                            </Label>
                            <div class="border border-solid border-slate-300 p-2.5 bg-white !rounded-lg shadow-sm inline-block hover:shadow-md transition-shadow duration-200">
                                <img :src="'https://localhost:7196' + selectedReview.hinhAnh"
                                    @error="isImageBroken = true"
                                    class="max-w-[220px] h-auto object-contain cursor-zoom-in rounded-md hover:opacity-95 transition-opacity"
                                    alt="Review Image" />
                            </div>
                        </div>

                        <!-- Row 5: Phản hồi của Salon (Standard rounded-lg textarea) -->
                        <div class="flex flex-col gap-2">
                            <Label class="text-[10px] font-extrabold text-slate-550 tracking-wider flex items-center gap-1.5 uppercase ml-1">
                                <Reply class="w-4 h-4 text-primary" /> Phản hồi từ Salon
                            </Label>
                            <textarea v-model="replyContent" rows="4" placeholder="Nhập phản hồi chăm sóc khách hàng..." 
                                class="w-full border border-solid border-slate-300 !rounded-lg p-4 text-xs font-semibold text-slate-800 bg-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all duration-200 resize-none shadow-sm"></textarea>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="shrink-0 border-t border-solid border-slate-205 !px-8 !py-4 bg-slate-50 flex justify-end gap-3 items-center">
                        <v-btn variant="outlined" color="grey-darken-1" rounded="md" class="text-none font-weight-bold text-slate-700 bg-white hover:bg-slate-50" @click="toggleVisibility">
                            <template v-slot:prepend>
                                <component :is="selectedReview.isHidden ? Eye : EyeOff" class="w-4 h-4 mr-1"
                                    :class="selectedReview.isHidden ? 'text-emerald-500' : 'text-slate-555'" />
                            </template>
                            {{ selectedReview.isHidden ? 'Hiển thị lại' : 'Ẩn Đánh Gia' }}
                        </v-btn>
                        <v-btn variant="flat" color="error" rounded="md" class="text-none font-weight-bold shadow-sm" @click="deleteReview">
                            <template v-slot:prepend><Trash2 class="w-4 h-4 mr-1" /></template>
                            Xóa vĩnh viễn
                        </v-btn>
                        <v-btn color="primary" variant="flat" rounded="md" class="text-none font-weight-bold text-white shadow-sm" @click="submitReply">
                            <template v-slot:prepend><CheckCircle2 class="w-4 h-4 mr-1" /></template>
                            Lưu phản hồi
                        </v-btn>
                    </div>
                </div>
            </div>
        </Teleport>

        <ThongKeDichVuModal :is-open="showStats" @close="showStats = false" />
    </div>
</template>

<style scoped>
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
