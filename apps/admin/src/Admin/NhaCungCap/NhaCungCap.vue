<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Search, Plus, Edit3, Trash2, X, Building2, Phone, Mail, MapPin } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_BASE_URL = `${API}/api/admin/nha-cung-cap`

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
                    confirmButtonColor: '#2563eb'
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
                    confirmButtonColor: '#2563eb'
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
            confirmButtonColor: '#2563eb'
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
            confirmButtonColor: '#2563eb'
        });
        await fetchNhaCungCaps();
    } catch (e: any) {
        logActivity("Xóa nhà cung cấp", `Thất bại khi xóa nhà cung cấp ${tenNcc} (Mã: ${maNcc}) - Lỗi: ${e.response?.data?.message || e.message || ''}`, "Nhà cung cấp", "Thất bại");
        Swal.fire({
            title: 'Lỗi',
            text: e.response?.data?.message || "Không thể thực hiện thao tác xóa.",
            icon: 'error',
            confirmButtonColor: '#2563eb'
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
            confirmButtonColor: '#2563eb'
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
        'from-blue-500 to-indigo-600',
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
    <div class="hoadon-container">
        <!-- Header -->
        <div class="hd-header">
            <div class="hd-header-left">
                <div class="hd-header-icon">
                    <Building2 class="w-6 h-6" />
                </div>
                <div>
                    <h2 class="hd-header-title">Quản Lý Nhà Cung Cấp</h2>
                    <p class="hd-header-subtitle">Kiểm soát thông tin và trạng thái hợp tác của các đối tác cung ứng Salon</p>
                </div>
            </div>
            <button @click="openAddModal" class="hd-btn-export">
                <Plus class="w-4 h-4" /> Thêm Đối Tác
            </button>
        </div>

        <!-- Filters Grid -->
        <div class="hd-filters-grid" style="grid-template-columns: 1fr;">
            <div class="hd-filter-item">
                <label class="hd-filter-label">Tìm kiếm đối tác</label>
                <div class="hd-search-wrapper">
                    <Search class="hd-search-icon" />
                    <input v-model="searchQuery" @keyup.enter="fetchNhaCungCaps" placeholder="Nhập tên, số điện thoại hoặc mã đối tác..." class="hd-input hd-search-input">
                </div>
            </div>
        </div>

        <!-- Tabs -->
        <div class="hd-tabs">
            <button @click="statusFilter = 'all'" :class="{ active: statusFilter === 'all' }" class="hd-tab-button">
                Tất cả đối tác ({{ totalPartners }})
            </button>
            <button @click="statusFilter = '1'" :class="{ active: statusFilter === '1' }" class="hd-tab-button">
                Đang hoạt động ({{ activePartners }})
            </button>
            <button @click="statusFilter = '0'" :class="{ active: statusFilter === '0' }" class="hd-tab-button">
                Ngừng hợp tác ({{ inactivePartners }})
            </button>
        </div>

        <!-- Table Section -->
        <div class="hd-table-wrapper">
            <div v-if="isLoading" style="text-align: center; padding: 48px; font-weight: 500; color: #2563eb;">Đang nạp danh sách đối tác hệ thống...</div>
            <div v-else-if="errorMessage" style="padding: 24px; text-align: center; color: #e11d48; background-color: #fff1f2; border-top: 1px solid #ffe4e6; border-bottom: 1px solid #ffe4e6; font-weight: 600; font-size: 14px;">
                {{ errorMessage }}
            </div>
            <table v-else class="hd-table">
                <thead>
                    <tr>
                        <th style="width: 12%;">Mã Đối Tác</th>
                        <th style="width: 25%;">Tên Nhà Cung Cấp</th>
                        <th style="width: 15%;">Số Điện Thoại</th>
                        <th style="width: 18%;">Email</th>
                        <th style="width: 15%;">Địa Chỉ</th>
                        <th style="width: 18%; text-align: center;">Trạng Thái</th>
                        <th style="width: 10%; text-align: center;">Thao Tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="ncc in listNcc" :key="ncc.maNcc">
                        <td style="font-weight: 700; color: #2563eb;">{{ ncc.maNcc }}</td>
                        <td style="font-weight: 500;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div :class="`avatar-circle bg-gradient-to-tr ${getAvatarGradient(ncc.tenNcc)}`" style="width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 750; color: #fff; font-size: 11.5px; flex-shrink: 0;">
                                    {{ getInitials(ncc.tenNcc) }}
                                </div>
                                <span>{{ ncc.tenNcc }}</span>
                            </div>
                        </td>
                        <td style="font-weight: 500;">
                            <span v-if="ncc.soDienThoai" style="display: inline-flex; align-items: center; gap: 6px;">
                                <Phone class="w-3.5 h-3.5 text-slate-400" />
                                {{ ncc.soDienThoai }}
                            </span>
                            <span v-else style="color: #94a3b8; font-style: italic; font-size: 13px;">Chưa cập nhật</span>
                        </td>
                        <td style="color: #475569;">
                            <span v-if="ncc.email" style="display: inline-flex; align-items: center; gap: 6px;">
                                <Mail class="w-3.5 h-3.5 text-slate-400" />
                                {{ ncc.email }}
                            </span>
                            <span v-else style="color: #94a3b8; font-style: italic; font-size: 13px;">Chưa cập nhật</span>
                        </td>
                        <td style="color: #475569; max-w: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span v-if="ncc.diaChi" style="display: inline-flex; align-items: center; gap: 6px;" :title="ncc.diaChi">
                                <MapPin class="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                {{ ncc.diaChi }}
                            </span>
                            <span v-else style="color: #94a3b8; font-style: italic; font-size: 13px;">Chưa cập nhật</span>
                        </td>
                        <td>
                            <div class="hd-status-wrapper">
                                <select :value="ncc.trangThai" @change="changeNccStatus(ncc, Number(($event.target as HTMLSelectElement).value))" class="hd-status-select" :class="ncc.trangThai === 1 ? 'status-completed' : 'status-canceled'">
                                    <option :value="1" class="text-slate-700 bg-white">Đang hoạt động</option>
                                    <option :value="0" class="text-slate-700 bg-white">Ngừng hợp tác</option>
                                </select>
                                <div class="hd-dropdown-arrow">
                                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                                <button @click="openEditModal(ncc)" class="hd-btn-action" style="color: #2563eb;" title="Sửa">
                                    <Edit3 class="w-4 h-4" />
                                </button>
                                <button @click="deleteNcc(ncc.maNcc)" class="hd-btn-action" style="color: #ef4444;" title="Xóa">
                                    <Trash2 class="w-4 h-4" />
                                </button>
                            </div>
                        </td>
                    </tr>
                    <tr v-if="listNcc.length === 0">
                        <td colspan="7" style="padding: 40px; text-align: center; color: #94a3b8; background-color: #f8fafc; border-style: dashed;">Không có dữ liệu đối tác nào trong mục này.</td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Detail/Edit Modal -->
    <Teleport to="body">
        <div v-if="isModalOpen" class="hd-modal-overlay">
            <div class="hd-modal-container" style="max-width: 520px; width: 100%;">
                <div class="hd-modal-header">
                    <h3 class="hd-modal-title">
                        {{ isEditMode ? 'Cập Nhật Thông Tin Đối Tác' : 'Thêm Nhà Cung Cấp Mới' }}
                    </h3>
                    <button @click="isModalOpen = false" class="hd-btn-close">
                        <X class="w-5 h-5" />
                    </button>
                </div>
                <div class="hd-modal-body">
                    <div class="modal-form-content">
                        <!-- Mã Nhà Cung Cấp -->
                        <div class="hd-filter-item">
                            <label class="hd-filter-label">Mã Nhà Cung Cấp <span style="color: #ef4444;">*</span></label>
                            <input type="text" v-model="formNcc.maNcc" :disabled="isEditMode" placeholder="Ví dụ: LOREAL_VN" class="hd-input" :style="errors.maNcc ? 'border-color: #ef4444;' : ''">
                            <p v-if="errors.maNcc" class="error-text">{{ errors.maNcc }}</p>
                        </div>
                        
                        <!-- Tên Nhà Cung Cấp -->
                        <div class="hd-filter-item">
                            <label class="hd-filter-label">Tên Nhà Cung Cấp <span style="color: #ef4444;">*</span></label>
                            <input type="text" v-model="formNcc.tenNcc" placeholder="Nhập tên công ty hoặc thương hiệu..." class="hd-input" :style="errors.tenNcc ? 'border-color: #ef4444;' : ''">
                            <p v-if="errors.tenNcc" class="error-text">{{ errors.tenNcc }}</p>
                        </div>

                        <!-- Số điện thoại & Email -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                            <div class="hd-filter-item">
                                <label class="hd-filter-label">Số Điện Thoại</label>
                                <input type="text" v-model="formNcc.soDienThoai" placeholder="Nhập số điện thoại..." class="hd-input" :style="errors.soDienThoai ? 'border-color: #ef4444;' : ''">
                                <p v-if="errors.soDienThoai" class="error-text">{{ errors.soDienThoai }}</p>
                            </div>
                            <div class="hd-filter-item">
                                <label class="hd-filter-label">Email Đại Diện</label>
                                <input type="text" v-model="formNcc.email" placeholder="partner@domain.com" class="hd-input" :style="errors.email ? 'border-color: #ef4444;' : ''">
                                <p v-if="errors.email" class="error-text">{{ errors.email }}</p>
                            </div>
                        </div>

                        <!-- Địa chỉ -->
                        <div class="hd-filter-item">
                            <label class="hd-filter-label">Địa Chỉ Văn Phòng</label>
                            <input type="text" v-model="formNcc.diaChi" placeholder="Số nhà, tên đường, thành phố..." class="hd-input" :style="errors.diaChi ? 'border-color: #ef4444;' : ''">
                            <p v-if="errors.diaChi" class="error-text">{{ errors.diaChi }}</p>
                        </div>

                        <!-- Trạng thái -->
                        <div class="hd-filter-item">
                            <label class="hd-filter-label">Trạng Thế Hợp Tác</label>
                            <div class="hd-status-wrapper" style="max-width: 100%;">
                                <select v-model="formNcc.trangThai" class="hd-status-select" :class="formNcc.trangThai === 1 ? 'status-completed' : 'status-canceled'">
                                    <option :value="1" class="text-slate-700 bg-white">Đang hoạt động</option>
                                    <option :value="0" class="text-slate-700 bg-white">Ngừng hợp tác</option>
                                </select>
                                <div class="hd-dropdown-arrow">
                                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                                </div>
                            </div>
                        </div>

                        <!-- Action Buttons -->
                        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 16px;">
                            <button @click="isModalOpen = false" class="hd-btn-close-modal">Hủy</button>
                            <button @click="saveNcc" class="hd-btn-export" style="box-shadow: none;">Lưu Dữ Liệu</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
/* ── Container ── */
.hoadon-container {
    padding: 24px;
    background-color: #f8fafc;
    min-height: 100vh;
    border-radius: 16px;
    font-family: 'Inter', -apple-system, sans-serif;
    color: #1e293b;
    display: flex;
    flex-direction: column;
    gap: 24px;
    box-sizing: border-box;
}

/* ── Header ── */
.hd-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
    flex-wrap: wrap;
    gap: 16px;
}
.hd-header-left {
    display: flex;
    align-items: center;
    gap: 16px;
}
.hd-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    background-color: #2563eb;
    color: #ffffff !important;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
    flex-shrink: 0;
}
.hd-header-icon :deep(svg) {
    width: 24px;
    height: 24px;
}
.hd-header-title {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.2;
}
.hd-header-subtitle {
    font-size: 14px;
    color: #64748b;
    margin: 4px 0 0 0;
}

/* ── Export/Add Button ── */
.hd-btn-export {
    display: flex;
    align-items: center;
    gap: 8px;
    background-color: #2563eb !important;
    color: #ffffff !important;
    border: none;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.15);
}
.hd-btn-export:hover {
    background-color: #1d4ed8 !important;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.25);
}
.hd-btn-export:active {
    transform: translateY(0);
}

/* ── Filters Grid ── */
.hd-filters-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    background-color: #ffffff;
    padding: 20px;
    border-radius: 14px;
    border: 1px solid #edf2f7;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
}
@media (max-width: 768px) {
    .hd-filters-grid {
        grid-template-columns: 1fr;
    }
}
.hd-filter-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.hd-filter-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.05em;
}
.hd-input {
    width: 100%;
    height: 44px;
    padding: 0 16px;
    border-radius: 10px;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    font-size: 14px;
    color: #1e293b;
    outline: none;
    transition: all 0.2s ease;
    box-sizing: border-box;
}
.hd-input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

/* ── Search Input ── */
.hd-search-wrapper {
    position: relative;
    width: 100%;
}
.hd-search-icon {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    width: 18px;
    height: 18px;
    pointer-events: none;
}
.hd-search-input {
    padding-left: 40px !important;
}

/* ── Tabs ── */
.hd-tabs {
    display: flex;
    border-bottom: 2px solid #e2e8f0;
    gap: 8px;
    margin-top: 8px;
}
.hd-tab-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    font-size: 14px;
    font-weight: 700;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
    border-radius: 8px 8px 0 0;
}
.hd-tab-button:hover {
    color: #1e293b;
    background-color: #f1f5f9;
}
.hd-tab-button.active {
    color: #2563eb;
    border-bottom-color: #2563eb;
    background-color: rgba(37, 99, 235, 0.04);
}

/* ── Table Wrapper ── */
.hd-table-wrapper {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow-x: auto;
    width: 100%;
}

/* ── Table ── */
.hd-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
    text-align: left;
    min-width: 800px;
}
.hd-table th {
    padding: 14px 16px;
    background-color: #f8fafc;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e2e8f0;
}
.hd-table td {
    padding: 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    vertical-align: middle;
}
.hd-table tbody tr:hover {
    background-color: rgba(37, 99, 235, 0.01);
}
.hd-table tbody tr:last-child td {
    border-bottom: none;
}

/* ── Status Dropdown ── */
.hd-status-wrapper {
    display: inline-flex;
    position: relative;
    min-width: 150px;
    width: 100%;
    max-width: 180px;
}
.hd-status-select {
    width: 100%;
    font-size: 12px;
    font-weight: 700;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 8px 32px 8px 12px;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    outline: none;
    transition: all 0.2s ease;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}
.hd-status-select:focus {
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}
.hd-dropdown-arrow {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    width: 16px;
    height: 16px;
    color: currentColor;
    opacity: 0.8;
}

/* ── Status Colors ── */
.status-canceled {
    background-color: #fef2f2 !important;
    color: #ef4444 !important;
    border-color: #fecaca !important;
}
.status-completed {
    background-color: #f0fdf4 !important;
    color: #16a34a !important;
    border-color: #bbf7d0 !important;
}

/* ── Action Button ── */
.hd-btn-action {
    background: none;
    border: none;
    color: #64748b;
    padding: 8px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.hd-btn-action:hover {
    color: #2563eb;
    background-color: rgba(37, 99, 235, 0.05);
}

/* ── Modal Overlay ── */
.hd-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background-color: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
}
.hd-modal-container {
    background-color: #ffffff;
    border-radius: 16px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 680px;
    overflow: hidden;
    animation: hdModalShow 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
@keyframes hdModalShow {
    from { transform: scale(0.95); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
}
.hd-modal-header {
    padding: 16px 24px;
    background-color: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.hd-modal-title {
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
}
.hd-btn-close {
    background: none;
    border: none;
    color: #94a3b8;
    padding: 6px;
    border-radius: 9999px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}
.hd-btn-close:hover {
    color: #475569;
    background-color: #e2e8f0;
}
.hd-modal-body {
    padding: 24px;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-form-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.error-text {
    color: #ef4444;
    font-size: 12px;
    margin: 4px 0 0 0;
    font-weight: 500;
}

.hd-btn-close-modal {
    padding: 10px 20px;
    background-color: #f1f5f9;
    color: #475569;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
}
.hd-btn-close-modal:hover {
    background-color: #e2e8f0;
    color: #1e293b;
}

/* Avatar styling */
.avatar-circle {
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}
</style>
