<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Search, Plus, Edit3, Trash2, X, Building2, Phone, Mail, MapPin } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'
import { useTheme } from 'vuetify'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/nha-cung-cap`

// ── Theme State Detection (Light / Dark Mode Sync) ──
let isDarkMode = computed(() => false)
try {
  const vuetifyTheme = useTheme()
  isDarkMode = computed(() => vuetifyTheme.global.name.value === 'dark')
} catch (e) {
  isDarkMode = computed(() => {
    return localStorage.getItem('theme_selection') === 'dark'
  })
}

// Watch theme change and update body background to prevent white bottom area
watch(isDarkMode, (dark) => {
  if (dark) {
    document.body.style.backgroundColor = '#141416'
  } else {
    document.body.style.backgroundColor = ''
  }
}, { immediate: true })

onUnmounted(() => {
  document.body.style.backgroundColor = ''
})

const listNccAll = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')
const statusFilter = ref<string>('all')
const errorMessage = ref('')

// Quản lý trạng thái Modal
const isModalOpen = ref(false)
const isEditMode = ref(false)

const formNcc = ref({
    maNcc: '',
    tenNcc: '',
    soDienThoai: '',
    diaChi: '',
    email: '',
    trangThai: 1
})

// Đối tượng chứa thông báo lỗi Validation
const errors = ref({
    maNcc: '',
    tenNcc: '',
    soDienThoai: '',
    email: '',
    diaChi: ''
})

// Hàm kiểm tra Validation
const validateForm = (): boolean => {
    let isValid = true
    errors.value = { maNcc: '', tenNcc: '', soDienThoai: '', email: '', diaChi: '' }

    // 1. Kiểm tra Mã NCC
    if (!formNcc.value.maNcc.trim()) {
        errors.value.maNcc = 'Mã nhà cung cấp không được để trống.'
        isValid = false
    } else if (formNcc.value.maNcc.trim().length > 30) {
        errors.value.maNcc = 'Mã nhà cung cấp không được vượt quá 30 ký tự.'
        isValid = false
    }

    // 2. Kiểm tra Tên NCC
    if (!formNcc.value.tenNcc.trim()) {
        errors.value.tenNcc = 'Tên nhà cung cấp không được để trống.'
        isValid = false
    } else if (formNcc.value.tenNcc.trim().length > 150) {
        errors.value.tenNcc = 'Tên nhà cung cấp quá dài (Tối đa 150 ký tự).'
        isValid = false
    }

    // 3. Kiểm tra Số điện thoại
    if (formNcc.value.soDienThoai.trim()) {
        const phoneRegex = /^\d{9,11}$/
        if (!phoneRegex.test(formNcc.value.soDienThoai.trim())) {
            errors.value.soDienThoai = 'Số điện thoại không hợp lệ (Phải là số từ 9 - 11 chữ số).'
            isValid = false
        }
    }

    // 4. Kiểm tra định dạng Email
    if (formNcc.value.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(formNcc.value.email.trim())) {
            errors.value.email = 'Định dạng Email không hợp lệ (Ví dụ: abc@gmail.com).'
            isValid = false
        } else if (formNcc.value.email.trim().length > 100) {
            errors.value.email = 'Email không được vượt quá 100 ký tự.'
            isValid = false
        }
    }

    // 5. Kiểm tra Địa chỉ
    if (formNcc.value.diaChi.trim() && formNcc.value.diaChi.trim().length > 255) {
        errors.value.diaChi = 'Địa chỉ không được vượt quá 255 ký tự.'
        isValid = false
    }

    return isValid
}

watch(() => formNcc.value.maNcc, () => { errors.value.maNcc = '' })
watch(() => formNcc.value.tenNcc, () => { errors.value.tenNcc = '' })
watch(() => formNcc.value.soDienThoai, () => { errors.value.soDienThoai = '' })
watch(() => formNcc.value.email, () => { errors.value.email = '' })

const getAuthHeaders = () => {
    const token = sessionStorage.getItem('adminToken')
               || localStorage.getItem('accessToken') 
               || localStorage.getItem('token') 
               || sessionStorage.getItem('accessToken') 
               || sessionStorage.getItem('token');
    return { 'Authorization': `Bearer ${token}` };
}

const fetchNhaCungCaps = async () => {
    isLoading.value = true
    errorMessage.value = ''
    try {
        const params: any = { search: searchQuery.value }
        const res = await axios.get(`${API_BASE_URL}/danh-sach`, {
            params,
            headers: getAuthHeaders()
        })
        if (res.data.success) {
            listNccAll.value = res.data.data || []
        }
    } catch (e: any) {
        console.error(e);
        errorMessage.value = e.response?.status === 403 
            ? "Lỗi 403: Tài khoản hiện tại không có quyền truy cập hoặc Token hết hạn."
            : e.response?.status === 404 
            ? "Lỗi 404: Không tìm thấy API nhà cung cấp. Hãy kiểm tra route trên backend."
            : (e.response?.data?.message || e.message || "Không thể kết nối đến máy chủ hệ thống.");
    } finally {
        isLoading.value = false
    }
}

const openAddModal = () => {
    isEditMode.value = false
    errors.value = { maNcc: '', tenNcc: '', soDienThoai: '', email: '', diaChi: '' }
    formNcc.value = { maNcc: '', tenNcc: '', soDienThoai: '', diaChi: '', email: '', trangThai: 1 }
    isModalOpen.value = true
}

const openEditModal = (ncc: any) => {
    isEditMode.value = true
    errors.value = { maNcc: '', tenNcc: '', soDienThoai: '', email: '', diaChi: '' }
    formNcc.value = { ...ncc }
    isModalOpen.value = true
}

const saveNcc = async () => {
    if (!validateForm()) return;

    try {
        if (isEditMode.value) {
            const res = await axios.put(`${API_BASE_URL}/cap-nhat/${formNcc.value.maNcc}`, formNcc.value, { headers: getAuthHeaders() });
            if (res.data.success) {
                logActivity("Cập nhật nhà cung cấp", `Đã cập nhật nhà cung cấp ${formNcc.value.tenNcc} (Mã: ${formNcc.value.maNcc})`, "Nhà cung cấp");
                isModalOpen.value = false;
                Swal.fire({
                    title: 'Thành công',
                    text: 'Cập nhật thông tin đối tác thành công!',
                    icon: 'success',
                    confirmButtonColor: '#0284c7'
                });
            }
        } else {
            const res = await axios.post(`${API_BASE_URL}/them-moi`, formNcc.value, { headers: getAuthHeaders() });
            if (res.data.success) {
                logActivity("Thêm nhà cung cấp", `Đã thêm nhà cung cấp mới ${formNcc.value.tenNcc} (Mã: ${formNcc.value.maNcc})`, "Nhà cung cấp");
                isModalOpen.value = false;
                Swal.fire({
                    title: 'Thành công',
                    text: 'Thêm nhà cung cấp mới thành công!',
                    icon: 'success',
                    confirmButtonColor: '#0284c7'
                });
            }
        }
        await fetchNhaCungCaps();
    } catch (e: any) {
        logActivity(
            isEditMode.value ? "Cập nhật nhà cung cấp" : "Thêm nhà cung cấp",
            `Thất bại khi ${isEditMode.value ? 'cập nhật' : 'thêm'} nhà cung cấp ${formNcc.value.tenNcc} - Lỗi: ${e.response?.data?.message || e.message || ''}`,
            "Nhà cung cấp",
            "Thất bại"
        );
        Swal.fire({
            title: 'Lỗi',
            text: e.response?.data?.message || "Xảy ra lỗi hệ thống khi lưu dữ liệu.",
            icon: 'error',
            confirmButtonColor: '#0284c7'
        });
    }
}

const deleteNcc = async (maNcc: string) => {
    const targetNcc = listNccAll.value.find(n => n.maNcc === maNcc);
    const tenNcc = targetNcc ? targetNcc.tenNcc : maNcc;
    const result = await Swal.fire({
        title: 'Xác nhận',
        text: 'Bạn có chắc chắn muốn ngừng hợp tác với đối tác này?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Đồng ý',
        cancelButtonText: 'Hủy',
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b'
    });
    if (!result.isConfirmed) return;

    try {
        const res = await axios.delete(`${API_BASE_URL}/xoa/${maNcc}`, { headers: getAuthHeaders() });
        logActivity("Xóa nhà cung cấp", `Đã xóa nhà cung cấp ${tenNcc} (Mã: ${maNcc})`, "Nhà cung cấp");
        Swal.fire({
            title: 'Thành công',
            text: res.data.message || 'Thao tác xóa thành công.',
            icon: 'success',
            confirmButtonColor: '#0284c7'
        });
        await fetchNhaCungCaps();
    } catch (e: any) {
        logActivity("Xóa nhà cung cấp", `Thất bại khi xóa nhà cung cấp ${tenNcc} (Mã: ${maNcc}) - Lỗi: ${e.response?.data?.message || e.message || ''}`, "Nhà cung cấp", "Thất bại");
        Swal.fire({
            title: 'Lỗi',
            text: e.response?.data?.message || "Không thể thực hiện thao tác xóa.",
            icon: 'error',
            confirmButtonColor: '#0284c7'
        });
    }
}

// Thay đổi trạng thái nhanh trực tiếp trên bảng
const changeNccStatus = async (ncc: any, newStatus: number) => {
    try {
        const payload = { ...ncc, trangThai: newStatus };
        const res = await axios.put(`${API_BASE_URL}/cap-nhat/${ncc.maNcc}`, payload, { headers: getAuthHeaders() });
        if (res.data.success) {
            logActivity(
                "Đổi trạng thái nhà cung cấp",
                `Đã chuyển trạng thái nhà cung cấp ${ncc.tenNcc} (Mã: ${ncc.maNcc}) sang ${newStatus === 1 ? 'Đang hoạt động' : 'Ngừng hợp tác'}`,
                "Nhà cung cấp"
            );
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: 'success',
                title: 'Cập nhật trạng thái thành công',
                showConfirmButton: false,
                timer: 1500,
                timerProgressBar: true
            });
            await fetchNhaCungCaps();
        }
    } catch (e: any) {
        logActivity(
            "Đổi trạng thái nhà cung cấp",
            `Thất bại khi chuyển trạng thái nhà cung cấp ${ncc.tenNcc} (Mã: ${ncc.maNcc}) sang ${newStatus === 1 ? 'Đang hoạt động' : 'Ngừng hợp tác'} - Lỗi: ${e.message || ''}`,
            "Nhà cung cấp",
            "Thất bại"
        );
        Swal.fire({
            title: 'Lỗi',
            text: 'Không thể cập nhật trạng thái đối tác.',
            icon: 'error',
            confirmButtonColor: '#0284c7'
        });
    }
}

// Các danh sách đối tác được lọc động theo Tabs ở Client
const listNcc = computed(() => {
    if (statusFilter.value === 'all') return listNccAll.value
    const statusNum = Number(statusFilter.value)
    return listNccAll.value.filter(n => n.trangThai === statusNum)
})

// Tính toán các số liệu thống kê cho bộ lọc Tabs
const totalPartners = computed(() => listNccAll.value.length)
const activePartners = computed(() => listNccAll.value.filter(n => n.trangThai === 1).length)
const inactivePartners = computed(() => listNccAll.value.filter(n => n.trangThai === 0).length)

// Tạo gradient màu sắc cho avatar dựa theo chữ cái đầu
const getAvatarGradient = (name: string) => {
    if (!name) return 'from-slate-400 to-slate-500'
    const charCode = name.charCodeAt(0) + (name.charCodeAt(1) || 0)
    const gradients = [
        'from-sky-500 to-blue-600',
        'from-emerald-500 to-teal-600',
        'from-violet-500 to-purple-600',
        'from-rose-500 to-pink-600',
        'from-amber-500 to-orange-600',
        'from-cyan-500 to-blue-600',
        'from-fuchsia-500 to-pink-600',
    ]
    return gradients[charCode % gradients.length]
}

// Lấy chữ cái viết tắt của nhà cung cấp
const getInitials = (name: string) => {
    if (!name) return 'NCC'
    const words = name.trim().split(/\s+/)
    if (words.length >= 2 && words[0] && words[1]) {
        const first = words[0][0] || ''
        const second = words[1][0] || ''
        return (first + second).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}

onMounted(fetchNhaCungCaps)
</script>

<template>
    <div 
        class="ncc-container min-h-screen w-full flex flex-col p-4 md:p-6 lg:p-8 font-sans antialiased relative transition-colors duration-300"
        :class="isDarkMode ? 'bg-[#141416] text-slate-100' : 'bg-slate-50 text-slate-800'"
    >
        <!-- Header -->
        <div 
            class="hd-header flex flex-col sm:flex-row sm:items-center justify-between gap-6 rounded-xl border p-6 mb-6 shadow-xs transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div class="flex items-center gap-5">
                <div class="w-14 h-14 md:w-16 md:h-16 rounded-xl bg-gradient-to-br from-sky-500 via-sky-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-sky-500/25 flex-shrink-0">
                    <Building2 class="w-7 h-7 md:w-8 md:h-8" />
                </div>
                <div>
                    <h2 class="text-2xl md:text-3xl font-extrabold tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                        Quản Lý Nhà Cung Cấp
                    </h2>
                    <p class="text-xs md:text-sm mt-1 font-medium" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                        Kiểm soát thông tin và trạng thái hợp tác của các đối tác cung ứng Salon
                    </p>
                </div>
            </div>

            <button 
                @click="openAddModal" 
                class="hd-btn-export h-11 px-5 text-xs font-bold rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
            >
                <Plus class="w-4 h-4" />
                <span>Thêm Đối Tác</span>
            </button>
        </div>

        <!-- Filters Grid -->
        <div 
            class="hd-filters-grid rounded-xl border p-6 mb-6 shadow-xs transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div class="flex flex-col gap-2">
                <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Tìm kiếm đối tác</label>
                <div class="relative flex items-center">
                    <Search class="absolute left-4 w-4 h-4 pointer-events-none z-10 text-slate-400" />
                    <input 
                        v-model="searchQuery" 
                        @keyup.enter="fetchNhaCungCaps" 
                        placeholder="Nhập tên, số điện thoại hoặc mã đối tác..." 
                        class="hd-input hd-search-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                        :class="isDarkMode ? 'dark-mode-input' : 'light-mode-input'"
                    >
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b mb-6 gap-2" :class="isDarkMode ? 'border-slate-700/80' : 'border-slate-200'">
            <button 
                @click="statusFilter = 'all'" 
                class="flex items-center gap-2 px-6 py-3.5 text-xs md:text-sm font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-[1px]"
                :class="statusFilter === 'all' 
                    ? (isDarkMode ? 'bg-sky-950/60 text-sky-300 border-sky-500' : 'bg-sky-50 text-sky-700 border-sky-600') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-[#222233] border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent')"
            >
                Tất cả đối tác ({{ totalPartners }})
            </button>
            <button 
                @click="statusFilter = '1'" 
                class="flex items-center gap-2 px-6 py-3.5 text-xs md:text-sm font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-[1px]"
                :class="statusFilter === '1' 
                    ? (isDarkMode ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500' : 'bg-emerald-50 text-emerald-700 border-emerald-600') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-[#222233] border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent')"
            >
                Đang hoạt động ({{ activePartners }})
            </button>
            <button 
                @click="statusFilter = '0'" 
                class="flex items-center gap-2 px-6 py-3.5 text-xs md:text-sm font-extrabold rounded-t-xl transition-all cursor-pointer border-b-2 -mb-[1px]"
                :class="statusFilter === '0' 
                    ? (isDarkMode ? 'bg-rose-950/60 text-rose-300 border-rose-500' : 'bg-rose-50 text-rose-700 border-rose-600') 
                    : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-[#222233] border-transparent' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-transparent')"
            >
                Ngừng hợp tác ({{ inactivePartners }})
            </button>
        </div>

        <!-- Table Section -->
        <div 
            class="hd-table-wrapper flex-1 w-full rounded-xl border shadow-xs relative overflow-hidden flex flex-col z-10 min-h-[400px] transition-colors duration-300"
            :class="isDarkMode ? 'bg-[#1e1e2d] border-slate-700/80' : 'bg-white border-slate-200/90'"
        >
            <div v-if="isLoading" class="p-12 text-center text-xs font-extrabold text-sky-600 tracking-wider uppercase">
                <div class="w-8 h-8 border-3 border-slate-200 border-t-sky-600 rounded-full animate-spin mx-auto mb-3"></div>
                Đang nạp danh sách đối tác hệ thống...
            </div>
            
            <div v-else-if="errorMessage" class="p-6 text-center text-xs font-bold text-rose-500 bg-rose-950/40 border-b border-rose-800">
                {{ errorMessage }}
            </div>
            
            <div v-else class="flex-grow overflow-x-auto custom-scrollbar">
                <table class="w-full text-left text-xs md:text-sm border-collapse min-w-[1000px]">
                    <thead>
                        <tr :class="isDarkMode ? 'bg-[#252536] text-slate-200 border-b border-slate-700/80' : 'bg-slate-900 text-white'">
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-36 whitespace-nowrap">Mã Đối Tác</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider min-w-[280px] whitespace-nowrap">Tên Nhà Cung Cấp</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 whitespace-nowrap">Số Điện Thoại</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-52 whitespace-nowrap">Email</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-60 whitespace-nowrap">Địa Chỉ</th>
                            <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 text-center whitespace-nowrap">Trạng Thái</th>
                            <th class="py-4 px-4 font-extrabold uppercase tracking-wider w-28 text-center whitespace-nowrap">Thao Tác</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-100'">
                        <tr 
                            v-for="ncc in listNcc" 
                            :key="ncc.maNcc"
                            class="transition-colors duration-150"
                            :class="isDarkMode ? 'hover:bg-slate-800/60 text-slate-200' : 'hover:bg-sky-50/60 text-slate-700'"
                        >
                            <td class="py-4 px-6 font-extrabold font-mono text-xs text-sky-500 whitespace-nowrap">
                                {{ ncc.maNcc }}
                            </td>
                            
                            <td class="py-4 px-6 font-bold min-w-[280px]" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                                <div class="flex items-center gap-3">
                                    <div :class="`avatar-circle bg-gradient-to-tr ${getAvatarGradient(ncc.tenNcc)}`" class="w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-xs flex-shrink-0 shadow-xs">
                                        {{ getInitials(ncc.tenNcc) }}
                                    </div>
                                    <span class="leading-snug">{{ ncc.tenNcc }}</span>
                                </div>
                            </td>
                            
                            <td class="py-4 px-6 font-medium text-xs font-mono whitespace-nowrap">
                                <span v-if="ncc.soDienThoai" class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                                    <Phone class="w-3.5 h-3.5 text-sky-500" />
                                    {{ ncc.soDienThoai }}
                                </span>
                                <span v-else class="italic opacity-50" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">Chưa cập nhật</span>
                            </td>
                            
                            <td class="py-4 px-6 text-xs whitespace-nowrap">
                                <span v-if="ncc.email" class="inline-flex items-center gap-1.5" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                                    <Mail class="w-3.5 h-3.5 text-sky-500" />
                                    {{ ncc.email }}
                                </span>
                                <span v-else class="italic opacity-50" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">Chưa cập nhật</span>
                            </td>
                            
                            <td class="py-4 px-6 text-xs max-w-[240px] truncate">
                                <span v-if="ncc.diaChi" class="inline-flex items-center gap-1.5 truncate" :title="ncc.diaChi" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">
                                    <MapPin class="w-3.5 h-3.5 text-sky-500 shrink-0" />
                                    <span class="truncate">{{ ncc.diaChi }}</span>
                                </span>
                                <span v-else class="italic opacity-50" :class="isDarkMode ? 'text-slate-500' : 'text-slate-400'">Chưa cập nhật</span>
                            </td>
                            
                            <td class="py-4 px-6 text-center whitespace-nowrap">
                                <div class="relative flex items-center justify-center">
                                    <select 
                                        :value="ncc.trangThai" 
                                        @change="changeNccStatus(ncc, Number(($event.target as HTMLSelectElement).value))" 
                                        class="hd-status-select text-xs font-extrabold rounded-lg px-3 py-1.5 outline-none cursor-pointer transition-all box-border border"
                                        :class="[
                                            ncc.trangThai === 1 ? (isDarkMode ? 'dark-status-completed' : 'light-status-completed') : (isDarkMode ? 'dark-status-canceled' : 'light-status-canceled'),
                                            isDarkMode ? 'dark-status-dropdown' : 'light-status-dropdown'
                                        ]"
                                    >
                                        <option :value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đang hoạt động</option>
                                        <option :value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Ngừng hợp tác</option>
                                    </select>
                                </div>
                            </td>
                            
                            <td class="py-4 px-4 text-center whitespace-nowrap">
                                <div class="flex items-center justify-center gap-2">
                                    <button 
                                        @click="openEditModal(ncc)" 
                                        title="Chỉnh sửa thông tin đối tác"
                                        class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                        :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-sky-500 text-sky-400' : 'bg-white border-slate-200 hover:border-sky-400 text-sky-600 hover:bg-sky-50'"
                                    >
                                        <Edit3 class="w-4 h-4" />
                                    </button>
                                    <button 
                                        @click="deleteNcc(ncc.maNcc)" 
                                        title="Xóa nhà cung cấp"
                                        class="w-8 h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                        :class="isDarkMode ? 'bg-[#2b2b36] border-slate-700 hover:border-rose-500 text-rose-400' : 'bg-white border-slate-200 hover:border-rose-400 text-rose-600 hover:bg-rose-50'"
                                    >
                                        <Trash2 class="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>

                        <!-- Empty State -->
                        <tr v-if="listNcc.length === 0">
                            <td colspan="7" class="p-12 text-center text-slate-500">
                                <div class="flex flex-col items-center gap-2 max-w-sm mx-auto">
                                    <Building2 class="w-8 h-8 text-slate-400 stroke-[1.5px]" />
                                    <span class="font-extrabold text-sm" :class="isDarkMode ? 'text-slate-300' : 'text-slate-700'">Không có dữ liệu đối tác nào</span>
                                    <span class="text-xs" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">Không tìm thấy nhà cung cấp nào trùng khớp với bộ lọc tìm kiếm.</span>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Detail/Edit Modal (Thiết kế lại rộng rãi max-w-2xl, lề lùi px-8 md:px-10 thông thoáng) -->
    <Teleport to="body">
        <div 
            v-if="isModalOpen" 
            class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all"
            @click="isModalOpen = false"
        >
            <div 
                class="act-modal-container relative w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
                :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-200 text-slate-800'"
                @click.stop
            >
                <!-- Modal Header (Lề lùi px-8 md:px-10) -->
                <div 
                    class="px-8 md:px-10 py-5 border-b flex items-center justify-between relative overflow-hidden transition-colors"
                    :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
                >
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-500 flex items-center justify-center font-bold flex-shrink-0">
                            <Building2 class="w-5 h-5" />
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base md:text-lg tracking-wide" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                                {{ isEditMode ? 'Cập Nhật Thông Tin Đối Tác' : 'Thêm Nhà Cung Cấp Mới' }}
                            </h3>
                            <p class="text-xs mt-0.5" :class="isDarkMode ? 'text-slate-400' : 'text-slate-500'">
                                {{ isEditMode ? 'Điền các trường thông tin bên dưới để sửa hồ sơ đối tác' : 'Tạo mới hồ sơ nhà cung cấp dịch vụ sản phẩm Salon' }}
                            </p>
                        </div>
                    </div>
                    <button 
                        @click="isModalOpen = false" 
                        class="w-9 h-9 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        :class="isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200'"
                    >
                        <X class="w-5 h-5" />
                    </button>
                </div>

                <!-- Modal Body (Bố cục rộng rãi 2 cột cân đối, cách xa viền 2 bên px-8 md:px-10) -->
                <div class="p-8 md:px-10 md:py-8 flex flex-col gap-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
                    
                    <!-- Hàng 1: Mã NCC & Trạng Thái Hợp Tác -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                                Mã Nhà Cung Cấp <span class="text-rose-500">*</span>
                            </label>
                            <input 
                                type="text" 
                                v-model="formNcc.maNcc" 
                                :disabled="isEditMode" 
                                placeholder="Ví dụ: LOREAL_VN" 
                                class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border disabled:opacity-60 disabled:cursor-not-allowed"
                                :class="[
                                    isDarkMode ? 'dark-mode-input' : 'light-mode-input',
                                    errors.maNcc ? 'border-rose-500!' : ''
                                ]"
                            >
                            <p v-if="errors.maNcc" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.maNcc }}</p>
                        </div>

                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Trạng Thái Hợp Tác</label>
                            <div class="relative flex items-center">
                                <select 
                                    v-model="formNcc.trangThai" 
                                    class="hd-status-select text-xs md:text-sm font-extrabold rounded-lg px-4 py-2.5 outline-none cursor-pointer transition-all box-border border w-full"
                                    :class="[
                                        formNcc.trangThai === 1 ? (isDarkMode ? 'dark-status-completed' : 'light-status-completed') : (isDarkMode ? 'dark-status-canceled' : 'light-status-canceled'),
                                        isDarkMode ? 'dark-status-dropdown' : 'light-status-dropdown'
                                    ]"
                                >
                                    <option :value="1" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Đang hoạt động</option>
                                    <option :value="0" :class="isDarkMode ? 'bg-[#2b2b36] text-white' : 'bg-white text-slate-800'">Ngừng hợp tác</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Hàng 2: Tên Nhà Cung Cấp -->
                    <div class="flex flex-col gap-2">
                        <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                            Tên Nhà Cung Cấp <span class="text-rose-500">*</span>
                        </label>
                        <input 
                            type="text" 
                            v-model="formNcc.tenNcc" 
                            placeholder="Nhập tên công ty hoặc thương hiệu..." 
                            class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                            :class="[
                                isDarkMode ? 'dark-mode-input' : 'light-mode-input',
                                errors.tenNcc ? 'border-rose-500!' : ''
                            ]"
                        >
                        <p v-if="errors.tenNcc" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.tenNcc }}</p>
                    </div>

                    <!-- Hàng 3: Số điện thoại & Email -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Số Điện Thoại</label>
                            <input 
                                type="text" 
                                v-model="formNcc.soDienThoai" 
                                placeholder="Nhập số điện thoại..." 
                                class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                                :class="[
                                    isDarkMode ? 'dark-mode-input' : 'light-mode-input',
                                    errors.soDienThoai ? 'border-rose-500!' : ''
                                ]"
                            >
                            <p v-if="errors.soDienThoai" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.soDienThoai }}</p>
                        </div>

                        <div class="flex flex-col gap-2">
                            <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Email Đại Diện</label>
                            <input 
                                type="text" 
                                v-model="formNcc.email" 
                                placeholder="partner@domain.com" 
                                class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                                :class="[
                                    isDarkMode ? 'dark-mode-input' : 'light-mode-input',
                                    errors.email ? 'border-rose-500!' : ''
                                ]"
                            >
                            <p v-if="errors.email" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.email }}</p>
                        </div>
                    </div>

                    <!-- Hàng 4: Địa chỉ -->
                    <div class="flex flex-col gap-2">
                        <label class="text-[11px] font-extrabold uppercase tracking-wide" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">Địa Chỉ Văn Phòng</label>
                        <input 
                            type="text" 
                            v-model="formNcc.diaChi" 
                            placeholder="Số nhà, tên đường, thành phố..." 
                            class="hd-input w-full text-xs md:text-sm font-medium outline-none transition-all box-border"
                            :class="[
                                isDarkMode ? 'dark-mode-input' : 'light-mode-input',
                                errors.diaChi ? 'border-rose-500!' : ''
                            ]"
                        >
                        <p v-if="errors.diaChi" class="text-xs font-semibold text-rose-500 mt-0.5">{{ errors.diaChi }}</p>
                    </div>

                </div>

                <!-- Modal Footer (Nút lưu & hủy lề rộng px-8 md:px-10) -->
                <div 
                    class="px-8 md:px-10 py-5 border-t flex items-center justify-end gap-3 transition-colors"
                    :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-50 border-slate-200'"
                >
                    <button 
                        @click="isModalOpen = false" 
                        class="h-11 px-8 text-xs font-extrabold rounded-lg transition-all cursor-pointer border"
                        :class="isDarkMode ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="saveNcc" 
                        class="hd-btn-export h-11 px-8 text-xs font-extrabold rounded-lg transition-all cursor-pointer shadow-md"
                    >
                        Lưu Dữ Liệu
                    </button>
                </div>

            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* Enforce dark background on parent containers */
:global(body.v-theme--dark), 
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Light Mode Input Styling */
.light-mode-input {
  background-color: #f8fafc !important;
  border: 1px solid #cbd5e1 !important;
  color: #0f172a !important;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.03) !important;
}
.light-mode-input:focus {
  background-color: #ffffff !important;
  border-color: #0284c7 !important;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
}

/* Dark Mode Input Styling */
.dark-mode-input {
  background-color: #2b2b36 !important;
  border: 1px solid #475569 !important;
  color: #ffffff !important;
}
.dark-mode-input:focus {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2) !important;
}

/* Input Dimensions */
.hd-input {
  height: 44px !important;
  border-radius: 8px !important;
  box-sizing: border-box !important;
  padding-left: 1rem !important;
  padding-right: 1rem !important;
}

.hd-search-input {
  padding-left: 2.75rem !important;
}

/* Export / Add Button Styling */
.hd-btn-export {
  background-color: #0284c7 !important;
  color: #ffffff !important;
  border: 1px solid #0284c7 !important;
  font-weight: 700 !important;
}
.hd-btn-export:hover {
  background-color: #0369a1 !important;
  border-color: #0369a1 !important;
}

/* Status Badge Classes - Light Mode */
.light-status-completed {
  background-color: #f0fdf4 !important;
  color: #16a34a !important;
  border-color: #bbf7d0 !important;
}
.light-status-canceled {
  background-color: #fef2f2 !important;
  color: #ef4444 !important;
  border-color: #fecaca !important;
}

/* Status Badge Classes - Dark Mode */
.dark-status-completed {
  background-color: #052e16 !important;
  color: #86efac !important;
  border-color: #166534 !important;
}
.dark-status-canceled {
  background-color: #450a0a !important;
  color: #fca5a5 !important;
  border-color: #991b1b !important;
}

/* Custom styled scrollbars */
.custom-scrollbar::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #0284c7;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #0369a1;
}
</style>
