<script setup lang="ts">
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { logActivity } from '@/utils/activityLogger';

interface StaffInfo {
  maNv: string;
  hoTenNv: string;
  email: string;
  sdt: string;
  diaChi: string;
  cccd: string;
  gioiTinh: string;
  namSinh: number;
  ngayVaoLam: string;
  hinhAnh: string;
  tenDangNhap: string;
  tenLoaiNv?: string;
}

const staffData = ref<StaffInfo | null>(null);
const isLoading = ref(true);
const isSaving = ref(false);

const oldPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const showOldPassword = ref(false);
const showPassword = ref(false);
const showConfirmPassword = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const selectedFile = ref<File | null>(null);
const localPreviewUrl = ref('');

const getStoredUser = () => {
  // Login lưu vào sessionStorage nên đọc từ sessionStorage
  const raw = sessionStorage.getItem("adminUser") || sessionStorage.getItem("staffUser") || sessionStorage.getItem("nhanVienUser");
  return raw ? JSON.parse(raw) : null;
};

const fetchProfile = async () => {
  const user = getStoredUser();
  const maNv = user?.maNv || user?.maNV || user?.id;
  if (!maNv) {
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    const res = await axios.get(`${API}/api/NhanVien/profile/${maNv}`);
    staffData.value = res.data;

    // ĐỒNG BỘ SESSIONSTORAGE
    if (staffData.value) {
      const rawUserKey = sessionStorage.getItem("adminUser") ? "adminUser" : 
                         sessionStorage.getItem("staffUser") ? "staffUser" : "nhanVienUser";
      const currentStored = getStoredUser() || {};

      currentStored.hoTen = staffData.value.hoTenNv;
      currentStored.tenNhanVien = staffData.value.hoTenNv;
      currentStored.name = staffData.value.hoTenNv;
      currentStored.chucVu = staffData.value.tenLoaiNv;
      currentStored.tenRole = staffData.value.tenLoaiNv;
      currentStored.role = staffData.value.tenLoaiNv;
      currentStored.hinhAnh = staffData.value.hinhAnh;
      currentStored.avatar = staffData.value.hinhAnh;

      sessionStorage.setItem(rawUserKey, JSON.stringify(currentStored));
      window.dispatchEvent(new Event("update-staff-sidebar"));
    }
  } catch (error: any) {
    console.error("Lỗi tải hồ sơ:", error);
  } finally {
    isLoading.value = false;
  }
};

const triggerFileSelect = () => {
  fileInput.value?.click();
};

const onFileSelected = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    selectedFile.value = file;
    localPreviewUrl.value = URL.createObjectURL(file);
  }
};

const handleUpdateProfile = async () => {
  if (!staffData.value) return;

  if (newPassword.value.trim() !== '') {
    if (oldPassword.value.trim() === '') {
      Swal.fire('Lỗi', 'Vui lòng nhập mật khẩu cũ để xác thực thay đổi.', 'error');
      return;
    }
    if (confirmPassword.value.trim() === '') {
      Swal.fire('Lỗi', 'Vui lòng xác nhận mật khẩu mới.', 'error');
      return;
    }
    if (newPassword.value.trim() !== confirmPassword.value.trim()) {
      Swal.fire('Lỗi', 'Xác nhận mật khẩu mới không trùng khớp.', 'error');
      return;
    }
  }

  try {
    isSaving.value = true;

    const formData = new FormData();
    formData.append('maNv', staffData.value.maNv);
    formData.append('hoTenNv', staffData.value.hoTenNv);
    formData.append('sdt', staffData.value.sdt);
    formData.append('diaChi', staffData.value.diaChi);
    formData.append('gioiTinh', staffData.value.gioiTinh);
    formData.append('tenDangNhap', staffData.value.tenDangNhap);

    if (newPassword.value.trim() !== '') {
      formData.append('matKhauMoi', newPassword.value.trim());
      formData.append('matKhauCu', oldPassword.value.trim());
    }
    if (selectedFile.value) {
      formData.append('hinhAnhFile', selectedFile.value);
    }

    await axios.put(`${API}/api/NhanVien/update-profile`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    logActivity(
      "Sửa hồ sơ tài khoản",
      `Đã cập nhật thông tin cá nhân tài khoản ${staffData.value.hoTenNv} (Mã: ${staffData.value.maNv})`,
      "Tài khoản"
    );

    Swal.fire({
      icon: 'success',
      title: 'Thành công!',
      text: 'Thông tin hồ sơ đã được cập nhật thành công.',
      timer: 2000,
      showConfirmButton: false
    });

    oldPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
    selectedFile.value = null;
    localPreviewUrl.value = '';
    await fetchProfile();
  } catch (error: any) {
    logActivity(
      "Sửa hồ sơ tài khoản",
      `Thất bại khi cập nhật thông tin tài khoản ${staffData.value?.hoTenNv || ''} - Lỗi: ${error.response?.data?.message || error.message || ''}`,
      "Tài khoản",
      "Thất bại"
    );
    Swal.fire('Lỗi', error.response?.data?.message || 'Không thể cập nhật tài khoản.', 'error');
  } finally {
    isSaving.value = false;
  }
};

const displayAvatar = computed(() => {
  if (localPreviewUrl.value) return localPreviewUrl.value;
  if (staffData.value?.hinhAnh) {
    return staffData.value.hinhAnh.startsWith('/')
      ? `${API}${staffData.value.hinhAnh}`
      : staffData.value.hinhAnh;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(staffData.value?.hoTenNv || 'NV')}&background=6366f1&color=fff&size=128`;
});

onMounted(fetchProfile);
</script>

<template>
  <!-- Loading State -->
  <div v-if="isLoading" class="d-flex flex-column align-center justify-center" style="min-height: 400px; gap: 12px;">
    <v-progress-circular indeterminate color="primary" size="48" />
    <p class="text-body-2 text-medium-emphasis">Đang tải thông tin hồ sơ...</p>
  </div>

  <!-- No Data -->
  <v-alert v-else-if="!staffData" type="warning" variant="tonal" class="ma-4">
    Không tìm thấy thông tin tài khoản nhân viên hợp lệ.
  </v-alert>

  <!-- Main Content -->
  <div v-else>
    <input type="file" ref="fileInput" class="d-none" accept="image/*" @change="onFileSelected" />

    <!-- Header Card: Avatar + Tên -->
    <v-card class="mb-5 profile-header-card" elevation="0" border>
      <v-card-text class="pa-6">
        <div class="d-flex align-center ga-5 flex-wrap">
          <!-- Avatar -->
          <div class="avatar-wrapper">
            <v-avatar size="96" class="profile-avatar">
              <v-img :src="displayAvatar" cover />
            </v-avatar>
            <v-btn
              icon
              size="x-small"
              color="white"
              class="avatar-edit-btn"
              elevation="3"
              @click="triggerFileSelect"
            >
              <v-icon size="14" color="grey-darken-2">mdi-camera</v-icon>
            </v-btn>
          </div>

          <!-- Info -->
          <div class="flex-grow-1">
            <div class="d-flex align-center ga-2 flex-wrap mb-1">
              <span class="text-h5 font-weight-bold">{{ staffData.hoTenNv }}</span>
              <v-chip size="small" color="success" variant="tonal" prepend-icon="mdi-check-circle">
                Hoạt động
              </v-chip>
            </div>
            <p class="text-body-2 text-medium-emphasis mb-3">
              {{ staffData.tenLoaiNv || 'Nhân viên' }} &bull; #{{ staffData.maNv }}
            </p>
            <div class="d-flex flex-wrap ga-4">
              <span class="d-flex align-center ga-1 text-body-2 text-medium-emphasis">
                <v-icon size="16" color="grey">mdi-email-outline</v-icon>
                {{ staffData.email }}
              </span>
              <span class="d-flex align-center ga-1 text-body-2 text-medium-emphasis">
                <v-icon size="16" color="grey">mdi-phone-outline</v-icon>
                {{ staffData.sdt }}
              </span>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <!-- Body: 2 Columns -->
    <v-row>
      <!-- LEFT: Thông tin cá nhân -->
      <v-col cols="12" lg="8">
        <v-card elevation="0" border>
          <v-card-item class="px-5 py-4 border-b">
            <template #prepend>
              <v-icon color="primary" size="18">mdi-account-outline</v-icon>
            </template>
            <v-card-title class="text-body-1 font-weight-bold">Thông tin cá nhân</v-card-title>
          </v-card-item>

          <v-card-text class="pa-5">
            <v-row>
              <!-- Họ và tên -->
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffData.hoTenNv"
                  label="Họ và tên"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-account-outline"
                  color="primary"
                />
              </v-col>

              <!-- Số điện thoại -->
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffData.sdt"
                  label="Số điện thoại"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-phone-outline"
                  color="primary"
                />
              </v-col>

              <!-- Địa chỉ -->
              <v-col cols="12">
                <v-text-field
                  v-model="staffData.diaChi"
                  label="Địa chỉ thường trú"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-map-marker-outline"
                  color="primary"
                />
              </v-col>

              <!-- CCCD -->
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="staffData.cccd"
                  label="Số CCCD"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-card-account-details-outline"
                  readonly
                  bg-color="grey-lighten-4"
                  hint="Không thể thay đổi"
                  persistent-hint
                />
              </v-col>

              <!-- Giới tính -->
              <v-col cols="12" md="6">
                <v-select
                  v-model="staffData.gioiTinh"
                  label="Giới tính"
                  :items="['Nam', 'Nữ', 'Khác']"
                  variant="outlined"
                  density="comfortable"
                  prepend-inner-icon="mdi-gender-male-female"
                  color="primary"
                />
              </v-col>
            </v-row>
          </v-card-text>

          <!-- NÚT LƯU THAY ĐỔI -->
          <v-divider />
          <v-card-actions class="pa-4 justify-end">
            <v-btn
              color="primary"
              variant="elevated"
              :loading="isSaving"
              :disabled="isSaving"
              class="text-none text-no-wrap"
              min-width="220"
              @click="handleUpdateProfile"
            >Lưu thay đổi hồ sơ</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <!-- RIGHT: Tài khoản & Mật khẩu -->
      <v-col cols="12" lg="4">

        <!-- Tài khoản & Công việc -->
        <v-card elevation="0" border class="mb-4">
          <v-card-item class="px-5 py-4 border-b">
            <template #prepend>
              <v-icon color="warning" size="18">mdi-briefcase-outline</v-icon>
            </template>
            <v-card-title class="text-body-1 font-weight-bold">Tài khoản &amp; Công việc</v-card-title>
          </v-card-item>

          <v-card-text class="pa-5">
            <v-text-field
              v-model="staffData.tenDangNhap"
              label="Tên đăng nhập"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-at"
              color="primary"
              class="mb-3"
            />

            <v-list density="compact" class="pa-0">
              <v-list-item class="px-0">
                <template #prepend>
                  <v-icon size="16" color="grey" class="mr-2">mdi-shield-account-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2 text-medium-emphasis">Chức vụ</v-list-item-title>
                <template #append>
                  <span class="text-body-2 font-weight-semibold">{{ staffData.tenLoaiNv }}</span>
                </template>
              </v-list-item>

              <v-divider class="my-2" />

              <v-list-item class="px-0">
                <template #prepend>
                  <v-icon size="16" color="grey" class="mr-2">mdi-calendar-check-outline</v-icon>
                </template>
                <v-list-item-title class="text-body-2 text-medium-emphasis">Ngày vào làm</v-list-item-title>
                <template #append>
                  <span class="text-body-2 font-weight-semibold">{{ staffData.ngayVaoLam }}</span>
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
        </v-card>

        <!-- Thay đổi mật khẩu -->
        <v-card elevation="0" border>
          <v-card-item class="px-5 py-4 border-b">
            <template #prepend>
              <v-icon color="error" size="18">mdi-lock-outline</v-icon>
            </template>
            <v-card-title class="text-body-1 font-weight-bold">Thay đổi mật khẩu</v-card-title>
          </v-card-item>

          <v-card-text class="pa-5">
            <v-text-field
              v-model="oldPassword"
              :type="showOldPassword ? 'text' : 'password'"
              label="Mật khẩu cũ"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-open-outline"
              :append-inner-icon="showOldPassword ? 'mdi-eye-off' : 'mdi-eye'"
              color="error"
              placeholder="Nhập mật khẩu cũ"
              @click:append-inner="showOldPassword = !showOldPassword"
              class="mb-3"
            />

            <v-text-field
              v-model="newPassword"
              :type="showPassword ? 'text' : 'password'"
              label="Mật khẩu mới"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-outline"
              :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
              color="error"
              placeholder="Để trống nếu không muốn đổi"
              @click:append-inner="showPassword = !showPassword"
              class="mb-3"
            />

            <v-text-field
              v-model="confirmPassword"
              :type="showConfirmPassword ? 'text' : 'password'"
              label="Xác nhận mật khẩu mới"
              variant="outlined"
              density="comfortable"
              prepend-inner-icon="mdi-lock-check-outline"
              :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
              color="error"
              placeholder="Nhập lại mật khẩu mới"
              @click:append-inner="showConfirmPassword = !showConfirmPassword"
            />
            <p class="text-caption text-medium-emphasis mt-2">
              Để thay đổi mật khẩu, vui lòng điền đầy đủ cả 3 thông tin trên. Nếu để trống mật khẩu mới, mật khẩu hiện tại sẽ được giữ nguyên.
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>


<style scoped>
.profile-header-card {
  border-radius: 12px !important;
}

.avatar-wrapper {
  position: relative;
  display: inline-block;
}

.profile-avatar {
  border: 3px solid #e0e0e0;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
}

.avatar-edit-btn {
  position: absolute;
  bottom: -4px;
  right: -4px;
  border: 2px solid #e0e0e0 !important;
}

.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
}
</style>