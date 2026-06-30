<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
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

const customizer = useCustomizerStore();
const theme = useTheme();

const router = useRouter();
const userName = ref('Admin');
const userRole = ref('Quản trị viên');

const currentThemeSelection = ref(localStorage.getItem('theme_selection') || 'system');
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

onMounted(() => {
  // Lấy thông tin user từ localStorage
  const adminStr = sessionStorage.getItem('adminUser');
  const staffStr = sessionStorage.getItem('staffUser') || sessionStorage.getItem('nhanVienUser');
  
  if (adminStr) {
    const admin = JSON.parse(adminStr);
    userName.value = admin.hoTen || admin.tenNhanVien || admin.username || 'Admin';
    userRole.value = 'Quản trị viên';
  } else if (staffStr) {
    const staff = JSON.parse(staffStr);
    userName.value = staff.hoTen || staff.tenNhanVien || staff.username || 'Nhân viên';
    userRole.value = 'Nhân viên';
  }

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

const handleLogout = () => {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminUser');
  sessionStorage.removeItem('staffUser');
  sessionStorage.removeItem('nhanVienUser');
  
  // Chuyển hướng về trang đăng nhập
  router.push('/admin/login');
};
</script>

<template>
  <!-- ---------------------------------------------- -->
  <!-- profile DD -->
  <!-- ---------------------------------------------- -->
  <div>
    <div class="d-flex align-center pa-5">
      <v-avatar size="32" class="mr-2">
        <img src="@/assets/images/users/avatar-1.png" width="32" alt="Avatar" />
      </v-avatar>
      <div>
        <h6 class="text-h6 mb-0">{{ userName }}</h6>
        <p class="text-caption mb-0">{{ userRole }}</p>
      </div>
      <div class="ml-auto">
        <v-btn variant="text" color="primary" rounded="sm" icon size="large" @click="handleLogout">
          <LogoutOutlined :style="{ fontSize: '20px' }" />
        </v-btn>
      </div>
    </div>
    
    <v-divider></v-divider>
    
    <perfect-scrollbar style="height: auto; max-height: 350px" :options="{ wheelPropagation: false }">
      <v-list class="py-0" aria-label="profile list" aria-busy="true">
        
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
        
        <v-list-item color="primary" rounded="0" value="Edit profile">
          <template v-slot:prepend>
            <EditOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Chỉnh sửa thông tin</v-list-item-title>
        </v-list-item>

        <v-list-item color="primary" rounded="0" value="View Profile">
          <template v-slot:prepend>
            <UserOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Xem thông tin</v-list-item-title>
        </v-list-item>
        
        <v-list-item color="primary" rounded="0" value="Account settings">
          <template v-slot:prepend>
            <SettingOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1"> Cài đặt tài khoản</v-list-item-title>
        </v-list-item>

        <v-list-item @click="handleLogout" color="error" rounded="0">
          <template v-slot:prepend>
            <LogoutOutlined :style="{ fontSize: '14px' }" class="mr-4" />
          </template>
          <v-list-item-title class="text-body-1 text-error"> Đăng xuất</v-list-item-title>
        </v-list-item>
      </v-list>
    </perfect-scrollbar>
  </div>
</template>

