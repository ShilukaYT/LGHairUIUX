<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
// icons
import {
  LogoutOutlined,
  UserOutlined,
  SettingOutlined,
  QuestionCircleOutlined,
  LockOutlined,
  CommentOutlined,
  UnorderedListOutlined,
  EditOutlined,
  ProfileOutlined,
  WalletOutlined
} from '@ant-design/icons-vue';

import { useCustomizerStore } from '../../../stores/customizer';
import { useTheme } from 'vuetify';
import { useAdminAuthDialogStore } from '@/stores/adminAuthDialog';
import axios from 'axios';

const authDialogStore = useAdminAuthDialogStore();
const customizer = useCustomizerStore();
const theme = useTheme();

const tab = ref(null);
const router = useRouter();
const route = useRoute();
const userName = ref('Admin');
const userRole = ref('Quản trị viên');
const userAvatar = ref('');

const currentThemeSelection = ref(localStorage.getItem('theme_selection') || 'system');
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

const loadUserFromStorage = () => {
  const adminStr = sessionStorage.getItem('adminUser');
  const staffStr = sessionStorage.getItem('staffUser') || sessionStorage.getItem('nhanVienUser');

  let user: any = null;
  if (adminStr) {
    user = JSON.parse(adminStr);
    userName.value = user.hoTen || user.tenNhanVien || user.username || 'Admin';
    userRole.value = 'Quản trị viên';
  } else if (staffStr) {
    user = JSON.parse(staffStr);
    userName.value = user.hoTen || user.tenNhanVien || user.username || 'Nhân viên';
    userRole.value = 'Nhân viên';
  }

  if (user) {
    const rawAvatar = user.hinhAnh || user.avatar || '';
    if (rawAvatar) {
      userAvatar.value = rawAvatar.startsWith('/')
        ? API + rawAvatar
        : rawAvatar;
    } else {
      userAvatar.value = '';
    }
  }
};

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'


const avatarSrc = computed(() => {
  return userAvatar.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.value)}&background=random&color=fff&size=100`;
});

const handleThemeSelection = (selection: 'light' | 'dark' | 'system', save = true) => {
  if (save) {
    currentThemeSelection.value = selection;
    localStorage.setItem('theme_selection', selection);
  }
  let newTheme = selection;
  if (selection === 'system') {
    newTheme = mediaQuery.matches ? 'dark' : 'light';
  }
  customizer.SET_THEME(newTheme);
  theme.global.name.value = newTheme;
};

onMounted(() => {
  loadUserFromStorage();
  window.addEventListener('update-staff-sidebar', loadUserFromStorage);

  // Initialize theme based on saved selection
  handleThemeSelection(currentThemeSelection.value as 'light' | 'dark' | 'system', false);

  mediaQuery.addEventListener('change', (e) => {
    if (currentThemeSelection.value === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      customizer.SET_THEME(newTheme);
      theme.global.name.value = newTheme;
    }
  });
});

onUnmounted(() => {
  window.removeEventListener('update-staff-sidebar', loadUserFromStorage);
});

const handleLogout = async () => {
  try {
    const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
    const storedRefreshToken =
      sessionStorage.getItem('adminRefreshToken') ||
      sessionStorage.getItem('staffRefreshToken') ||
      localStorage.getItem('staffRefreshToken') ||
      '';
    await axios.post(
      `${API}/api/admin/auth/logout`,
      { refreshToken: storedRefreshToken || undefined },
      { withCredentials: true }
    );
  } catch (e) {
    console.warn('Lỗi gọi API đăng xuất admin:', e);
  } finally {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminRefreshToken');
    sessionStorage.removeItem('adminUser');
    sessionStorage.removeItem('staffUser');
    sessionStorage.removeItem('staffToken');
    sessionStorage.removeItem('staffRefreshToken');
    sessionStorage.removeItem('nhanVienUser');
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffRefreshToken');
    localStorage.removeItem('staffUser');
    localStorage.removeItem('nhanVienUser');
    
    // Chuyển hướng về trang đăng nhập
    router.push('/admin/login');
  }
};

const onLogoutClick = () => {
  emit('close');
  authDialogStore.triggerLogoutConfirm(handleLogout);
};

const emit = defineEmits(['close']);

const profileUrl = computed(() => {
  const isNhanVienContext = route.path.toLowerCase().startsWith('/nhanvien');
  return isNhanVienContext ? '/nhanvien/profile' : '/admin/profile';
});

const navigateToProfile = () => {
  emit('close');
  router.push(profileUrl.value);
};
</script>

<template>
  <!-- ---------------------------------------------- -->
  <!-- profile DD -->
  <!-- ---------------------------------------------- -->
  <div>
    <div class="d-flex align-center pa-5">
      <v-avatar size="40" class="mr-2">
        <img :src="avatarSrc" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" alt="Avatar" />
      </v-avatar>
      <div>
        <h6 class="text-h6 mb-0">{{ userName }}</h6>
        <p class="text-caption mb-0">{{ userRole }}</p>
      </div>
      <div class="ml-auto">
        <v-btn variant="text" color="primary" rounded="sm" icon size="large" @click="onLogoutClick">
          <LogoutOutlined :style="{ fontSize: '20px' }" />
        </v-btn>
      </div>
    </div>
    
    <v-divider></v-divider>
    
    <perfect-scrollbar style="height: auto; max-height: 350px" :options="{ wheelPropagation: false }">
      <v-list class="py-0" aria-label="profile list">
        
        <v-list-subheader class="text-uppercase text-caption font-weight-bold px-5 mt-2">Giao diện</v-list-subheader>
        <v-list-item class="px-5 mb-2">
          <v-btn-toggle
            v-model="currentThemeSelection"
            color="primary"
            class="w-100 rounded"
            mandatory
            @update:modelValue="(val: any) => handleThemeSelection(val)"
            variant="outlined"
            divided
            style="height: 36px;"
          >
            <v-btn value="light" class="flex-grow-1 text-caption">Sáng</v-btn>
            <v-btn value="dark" class="flex-grow-1 text-caption">Tối</v-btn>
            <v-btn value="system" class="flex-grow-1 text-caption">Hệ thống</v-btn>
          </v-btn-toggle>
        </v-list-item>

        <v-divider></v-divider>

        <v-list-subheader class="text-uppercase text-caption font-weight-bold px-5 mt-2">Tài khoản</v-list-subheader>
        
        <v-list-item @click="navigateToProfile" :active="false" rounded="0">
          <template v-slot:prepend>
            <EditOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Chỉnh sửa thông tin</v-list-item-title>
        </v-list-item>

        <v-list-item @click="navigateToProfile" :active="false" rounded="0">
          <template v-slot:prepend>
            <UserOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Xem thông tin</v-list-item-title>
        </v-list-item>
        
        <v-list-item @click="navigateToProfile" :active="false" rounded="0">
          <template v-slot:prepend>
            <SettingOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Cài đặt tài khoản</v-list-item-title>
        </v-list-item>

        <v-list-item @click="onLogoutClick" color="error" rounded="0">
          <template v-slot:prepend>
            <LogoutOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1 text-error"> Đăng xuất</v-list-item-title>
        </v-list-item>
      </v-list>
    </perfect-scrollbar>
  </div>
</template>
