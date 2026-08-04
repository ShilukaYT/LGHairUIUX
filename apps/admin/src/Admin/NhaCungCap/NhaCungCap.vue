<script setup lang="ts">
import { ref, onMounted, watch, computed, onUnmounted } from 'vue'
import axios from 'axios'
import Swal from 'sweetalert2'
import { Search, Plus, Edit3, Trash2, X, Building2, Phone, Mail, MapPin, RotateCcw } from 'lucide-vue-next'
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

// Headers cho v-data-table
const headers = [
  { title: 'Mã đối tác', key: 'maNcc', align: 'start', sortable: true },
  { title: 'Tên nhà cung cấp', key: 'tenNcc', align: 'start', sortable: true },
  { title: 'Số điện thoại', key: 'soDienThoai', align: 'start', sortable: false },
  { title: 'Email', key: 'email', align: 'start', sortable: false },
  { title: 'Địa chỉ', key: 'diaChi', align: 'start', sortable: false },
  { title: 'Trạng thái', key: 'trangThai', align: 'center', sortable: true },
  { title: 'Thao tác', key: 'actions', align: 'center', sortable: false }
]

// Hàm kiểm tra Validation
const validateForm = (): boolean => {
  let isValid = true
  errors.value = { maNcc: '', tenNcc: '', soDienThoai: '', email: '', diaChi: '' }

  formNcc.value.maNcc = formNcc.value.maNcc.trim()
  formNcc.value.tenNcc = formNcc.value.tenNcc.trim()
  formNcc.value.soDienThoai = formNcc.value.soDienThoai.trim()
  formNcc.value.email = formNcc.value.email.trim()
  formNcc.value.diaChi = formNcc.value.diaChi.trim()

  // 1. Kiểm tra Mã NCC
  if (!formNcc.value.maNcc) {
    errors.value.maNcc = 'Mã nhà cung cấp không được để trống.'
    isValid = false
  } else if (formNcc.value.maNcc.length < 3) {
    errors.value.maNcc = 'Mã nhà cung cấp phải có tối thiểu 3 ký tự.'
    isValid = false
  } else if (formNcc.value.maNcc.length > 30) {
    errors.value.maNcc = 'Mã nhà cung cấp không được vượt quá 30 ký tự.'
    isValid = false
  } else {
    const maNccRegex = /^[a-zA-Z0-9_-]+$/
    if (!maNccRegex.test(formNcc.value.maNcc)) {
      errors.value.maNcc = 'Mã nhà cung cấp chỉ được chứa chữ cái không dấu, chữ số, gạch nối (-) hoặc gạch dưới (_).'
      isValid = false
    } else if (!isEditMode.value) {
      const isDuplicate = listNccAll.value.some(
        ncc => ncc.maNcc.toLowerCase() === formNcc.value.maNcc.toLowerCase()
      )
      if (isDuplicate) {
        errors.value.maNcc = 'Mã nhà cung cấp này đã tồn tại trong hệ thống.'
        isValid = false
      }
    }
  }

  // 2. Kiểm tra Tên NCC
  if (!formNcc.value.tenNcc) {
    errors.value.tenNcc = 'Tên nhà cung cấp không được để trống.'
    isValid = false
  } else if (formNcc.value.tenNcc.length < 3) {
    errors.value.tenNcc = 'Tên nhà cung cấp phải có tối thiểu 3 ký tự.'
    isValid = false
  } else if (formNcc.value.tenNcc.length > 50) {
    errors.value.tenNcc = 'Tên nhà cung cấp quá dài (Tối đa 50 ký tự).'
    isValid = false
  } else if (!/[a-zA-ZÀ-ỹ]/.test(formNcc.value.tenNcc)) {
    errors.value.tenNcc = 'Tên nhà cung cấp phải chứa ít nhất một chữ cái.'
    isValid = false
  }

  // 3. Kiểm tra Số điện thoại
  if (!formNcc.value.soDienThoai) {
    errors.value.soDienThoai = 'Số điện thoại không được để trống.'
    isValid = false
  } else {
    const phoneRegex = /^0\d{8,10}$/
    if (!phoneRegex.test(formNcc.value.soDienThoai)) {
      errors.value.soDienThoai = 'Số điện thoại không hợp lệ (Phải bắt đầu bằng số 0, gồm 9 - 11 chữ số).'
      isValid = false
    }
  }

  // 4. Kiểm tra định dạng Email
  if (!formNcc.value.email) {
    errors.value.email = 'Email không được để trống.'
    isValid = false
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formNcc.value.email)) {
      errors.value.email = 'Định dạng Email không hợp lệ (Ví dụ: abc@gmail.com).'
      isValid = false
    } else if (formNcc.value.email.length > 100) {
      errors.value.email = 'Email không được vượt quá 100 ký tự.'
      isValid = false
    }
  }

  // 5. Kiểm tra Địa chỉ
  if (!formNcc.value.diaChi) {
    errors.value.diaChi = 'Địa chỉ không được để trống.'
    isValid = false
  } else if (formNcc.value.diaChi.length < 5) {
    errors.value.diaChi = 'Địa chỉ quá ngắn (Tối thiểu 5 ký tự).'
    isValid = false
  } else if (formNcc.value.diaChi.length > 255) {
    errors.value.diaChi = 'Địa chỉ không được vượt quá 255 ký tự.'
    isValid = false
  }

  return isValid
}

watch(() => formNcc.value.maNcc, () => { errors.value.maNcc = '' })
watch(() => formNcc.value.tenNcc, () => { errors.value.tenNcc = '' })
watch(() => formNcc.value.soDienThoai, () => { errors.value.soDienThoai = '' })
watch(() => formNcc.value.email, () => { errors.value.email = '' })
watch(() => formNcc.value.diaChi, () => { errors.value.diaChi = '' })

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

// Danh sách đối tác được lọc động theo Tabs ở Client
const listNcc = computed(() => {
  if (statusFilter.value === 'all') return listNccAll.value
  const statusNum = Number(statusFilter.value)
  return listNccAll.value.filter(n => n.trangThai === statusNum)
})

// Các số liệu thống kê cho bộ lọc Tabs
const totalPartners = computed(() => listNccAll.value.length)
const activePartners = computed(() => listNccAll.value.filter(n => n.trangThai === 1).length)
const inactivePartners = computed(() => listNccAll.value.filter(n => n.trangThai === 0).length)

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

onMounted(() => {
  fetchNhaCungCaps();
  const wrapper = document.querySelector('.page-wrapper');
  if (wrapper) {
    wrapper.classList.add('full-width-layout');
  }
});

onUnmounted(() => {
  const wrapper = document.querySelector('.page-wrapper');
  if (wrapper) {
    wrapper.classList.remove('full-width-layout');
  }
});
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl">
      <v-card-title class="d-flex flex-column flex-md-row align-md-center justify-space-between pa-6">
        <div>
          <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Nhà Cung Cấp</h2>
          <div class="text-subtitle-2 text-medium-emphasis">
            {{ listNccAll.length }} nhà cung cấp · {{ activePartners }} đang hoạt động
          </div>
        </div>

        <div class="d-flex align-center gap-3 mt-4 mt-md-0 flex-wrap">
          <v-btn
            color="primary"
            variant="flat"
            rounded="lg"
            class="text-none font-weight-bold"
            @click="openAddModal"
          >
            <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
            Thêm đối tác
          </v-btn>

          <v-btn variant="outlined" color="grey-darken-1" size="40" rounded="lg" @click="fetchNhaCungCaps" title="Tải lại">
            <RotateCcw class="w-5 h-5" />
          </v-btn>
        </div>
      </v-card-title>

      <v-divider></v-divider>

      <!-- ── TOOLBAR ── -->
      <v-card-text class="pb-0">
        <v-row dense align="center">
          <v-col cols="12" md="7">
            <div class="d-inline-flex pa-1 bg-grey-lighten-4 rounded-lg border gap-1">
              <v-btn
                :color="statusFilter === 'all' ? 'primary' : undefined"
                :variant="statusFilter === 'all' ? 'flat' : 'text'"
                size="small"
                rounded="lg"
                class="text-none font-weight-bold"
                @click="statusFilter = 'all'"
              >
                Tất cả ({{ totalPartners }})
              </v-btn>
              <v-btn
                :color="statusFilter === '1' ? 'success' : undefined"
                :variant="statusFilter === '1' ? 'flat' : 'text'"
                size="small"
                rounded="lg"
                class="text-none font-weight-bold"
                @click="statusFilter = '1'"
              >
                Đang hoạt động ({{ activePartners }})
              </v-btn>
              <v-btn
                :color="statusFilter === '0' ? 'error' : undefined"
                :variant="statusFilter === '0' ? 'flat' : 'text'"
                size="small"
                rounded="lg"
                class="text-none font-weight-bold"
                @click="statusFilter = '0'"
              >
                Ngừng hợp tác ({{ inactivePartners }})
              </v-btn>
            </div>
          </v-col>

          <v-col cols="12" md="5">
            <v-text-field
              v-model="searchQuery"
              label="Tìm theo tên, SĐT hoặc mã..."
              variant="outlined"
              density="compact"
              hide-details
              clearable
              rounded="lg"
              @keyup.enter="fetchNhaCungCaps"
              @click:clear="fetchNhaCungCaps"
            >
              <template v-slot:prepend-inner>
                <Search class="w-5 h-5 text-grey-darken-1 mr-2" />
              </template>
            </v-text-field>
          </v-col>
        </v-row>
      </v-card-text>

      <v-alert v-if="errorMessage" type="error" variant="tonal" class="ma-6 mb-0" border="start">
        {{ errorMessage }}
      </v-alert>

      <!-- ── TABLE ── -->
      <v-data-table
        :items="listNcc"
        :loading="isLoading"
        items-per-page="10"
        item-value="maNcc"
        hover
        class="mt-2"
        items-per-page-text="Số mục mỗi trang:"
        page-text="{0} - {1} trên tổng số {2} đối tác"
      >
        <template v-slot:item.maNcc="{ item }">
          <span class="text-caption font-weight-bold code-chip">{{ item.maNcc }}</span>
        </template>

        <template v-slot:item.tenNcc="{ item }">
          <div class="d-flex align-center gap-2.5 py-1">
            <v-avatar size="32" color="primary" class="font-weight-bold text-white text-caption">
              {{ getInitials(item.tenNcc) }}
            </v-avatar>
            <span class="font-weight-bold">{{ item.tenNcc }}</span>
          </div>
        </template>

        <template v-slot:item.soDienThoai="{ item }">
          <span v-if="item.soDienThoai" class="d-inline-flex align-center gap-1.5 font-mono text-caption">
            <Phone class="w-3.5 h-3.5 text-primary" />
            {{ item.soDienThoai }}
          </span>
          <span v-else class="text-medium-emphasis font-italic text-caption">Chưa cập nhật</span>
        </template>

        <template v-slot:item.email="{ item }">
          <span v-if="item.email" class="d-inline-flex align-center gap-1.5 text-caption">
            <Mail class="w-3.5 h-3.5 text-primary" />
            {{ item.email }}
          </span>
          <span v-else class="text-medium-emphasis font-italic text-caption">Chưa cập nhật</span>
        </template>

        <template v-slot:item.diaChi="{ item }">
          <span v-if="item.diaChi" class="d-inline-flex align-center gap-1.5 text-caption truncate max-w-[240px]" :title="item.diaChi">
            <MapPin class="w-3.5 h-3.5 text-primary shrink-0" />
            <span class="truncate">{{ item.diaChi }}</span>
          </span>
          <span v-else class="text-medium-emphasis font-italic text-caption">Chưa cập nhật</span>
        </template>

        <template v-slot:item.trangThai="{ item }">
          <v-chip
            :color="item.trangThai === 1 ? 'success' : 'error'"
            size="small"
            variant="tonal"
            class="font-weight-bold cursor-pointer status-badge px-3"
            @click="changeNccStatus(item, item.trangThai === 1 ? 0 : 1)"
          >
            <span class="status-pulse-dot mr-1.5" :class="item.trangThai === 1 ? 'bg-success' : 'bg-error'"></span>
            {{ item.trangThai === 1 ? "Đang hoạt động" : "Ngừng hợp tác" }}
          </v-chip>
        </template>

        <template v-slot:item.actions="{ item }">
          <div class="d-flex align-center justify-center gap-1">
            <v-btn icon variant="text" size="small" color="primary" title="Chỉnh sửa thông tin đối tác" @click="openEditModal(item)">
              <Edit3 class="w-4 h-4" />
            </v-btn>
            <v-btn icon variant="text" size="small" color="error" title="Xóa nhà cung cấp" @click="deleteNcc(item.maNcc)">
              <Trash2 class="w-4 h-4" />
            </v-btn>
          </div>
        </template>
      </v-data-table>
    </v-card>

    <!-- ══ MODAL SỬA/THÊM NHÀ CUNG CẤP ══════════════════════════════ -->
    <v-dialog v-model="isModalOpen" max-width="600" scrollable>
      <v-card rounded="xl">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
          <div class="text-h6 font-weight-bold">
            {{ isEditMode ? 'Cập Nhật Thông Tin Đối Tác' : 'Thêm Nhà Cung Cấp Mới' }}
          </div>
          <v-btn icon variant="text" size="small" @click="isModalOpen = false">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveNcc">
            <v-row>
              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Mã nhà cung cấp *</div>
                <v-text-field
                  v-model="formNcc.maNcc"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  :disabled="isEditMode"
                  placeholder="VD: LOREAL_VN"
                  maxlength="30"
                  :error-messages="errors.maNcc"
                  @update:model-value="errors.maNcc = ''"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Trạng thái hợp tác</div>
                <div class="d-flex ga-1 pa-1 bg-grey-lighten-4 rounded-lg border">
                  <v-btn
                    :color="formNcc.trangThai === 1 ? 'success' : undefined"
                    :variant="formNcc.trangThai === 1 ? 'flat' : 'text'"
                    size="small"
                    rounded="lg"
                    class="flex-1 text-none font-weight-bold"
                    @click="formNcc.trangThai = 1"
                  >
                    <span class="d-inline-block rounded-circle bg-white mr-1" style="width: 6px; height: 6px;"></span>
                    Đang hoạt động
                  </v-btn>
                  <v-btn
                    :color="formNcc.trangThai === 0 ? 'error' : undefined"
                    :variant="formNcc.trangThai === 0 ? 'flat' : 'text'"
                    size="small"
                    rounded="lg"
                    class="flex-1 text-none font-weight-bold"
                    @click="formNcc.trangThai = 0"
                  >
                    <span class="d-inline-block rounded-circle bg-white mr-1" style="width: 6px; height: 6px;"></span>
                    Ngừng hợp tác
                  </v-btn>
                </div>
              </v-col>

              <v-col cols="12">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Tên nhà cung cấp *</div>
                <v-text-field
                  v-model="formNcc.tenNcc"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="Nhập tên công ty hoặc thương hiệu..."
                  maxlength="50"
                  :error-messages="errors.tenNcc"
                  @update:model-value="errors.tenNcc = ''"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Số điện thoại *</div>
                <v-text-field
                  v-model="formNcc.soDienThoai"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="Nhập số điện thoại..."
                  maxlength="11"
                  :error-messages="errors.soDienThoai"
                  @update:model-value="errors.soDienThoai = ''"
                ></v-text-field>
              </v-col>

              <v-col cols="12" sm="6">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Email đại diện *</div>
                <v-text-field
                  v-model="formNcc.email"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="partner@domain.com"
                  maxlength="100"
                  :error-messages="errors.email"
                  @update:model-value="errors.email = ''"
                ></v-text-field>
              </v-col>

              <v-col cols="12">
                <div class="mb-2 text-subtitle-2 font-weight-bold text-grey-darken-2">Địa chỉ văn phòng *</div>
                <v-text-field
                  v-model="formNcc.diaChi"
                  variant="outlined"
                  density="comfortable"
                  rounded="lg"
                  placeholder="Số nhà, tên đường, thành phố..."
                  maxlength="255"
                  :error-messages="errors.diaChi"
                  @update:model-value="errors.diaChi = ''"
                ></v-text-field>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-4 px-6 d-flex justify-end border-t">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold mr-2" color="grey-darken-2" @click="isModalOpen = false">
            Hủy
          </v-btn>
          <v-btn variant="flat" rounded="lg" class="text-none font-weight-bold" color="primary" @click="saveNcc">
            Lưu dữ liệu
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.gap-1 { gap: 4px; }
.gap-2 { gap: 8px; }
.gap-2\.5 { gap: 10px; }
.gap-3 { gap: 12px; }

.cursor-pointer { cursor: pointer; }
.code-chip {
  font-family: "Courier New", monospace;
  background: rgba(0,0,0,0.06);
  padding: 2px 7px;
  border-radius: 4px;
}

.status-badge {
  transition: all 0.2s ease-in-out;
}
.status-badge:hover {
  transform: translateY(-1px);
  filter: brightness(1.05);
}

.status-pulse-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
</style>
