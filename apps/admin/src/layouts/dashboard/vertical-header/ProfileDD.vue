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

const tab = ref(null);
const router = useRouter();
const userName = ref('Admin');
const userRole = ref('Quản trị viên');

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
});

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
    <v-tabs v-model="tab" color="primary" grow>
      <v-tab value="111"> <UserOutlined class="v-icon--start" /> Profile </v-tab>
      <v-tab value="222"> <SettingOutlined class="v-icon--start" /> Setting </v-tab>
    </v-tabs>
    <perfect-scrollbar style="height: calc(100vh - 300px); max-height: 240px">
      <v-window v-model="tab">
        <v-window-item value="111">
          <v-list class="py-0" aria-label="profile list" aria-busy="true">
            <v-list-item color="primary" rounded="0" value="Edit profile">
              <template v-slot:prepend>
                <EditOutlined :style="{ fontSize: '14px' }" class="mr-4" />
              </template>

              <v-list-item-title class="text-h6"> Edit Profile</v-list-item-title>
            </v-list-item>

            <v-list-item color="primary" rounded="0" value="View Profile">
              <template v-slot:prepend>
                <UserOutlined :style="{ fontSize: '14px' }" class="mr-4" />
              </template>

              <v-list-item-title class="text-h6"> View Profile</v-list-item-title>
            </v-list-item>

            <v-list-item @click="handleLogout" color="secondary" rounded="0">
              <template v-slot:prepend>
                <LogoutOutlined :style="{ fontSize: '14px' }" class="mr-4" />
              </template>

              <v-list-item-title class="text-h6"> Đăng xuất</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-window-item>
        <v-window-item value="222">
          <v-list class="py-0" aria-label="profile list" aria-busy="true">
            <v-list-item color="primary" rounded="0" value="Account">
              <template v-slot:prepend>
                <UserOutlined :style="{ fontSize: '14px' }" class="mr-4" />
              </template>

              <v-list-item-title class="text-h6"> Account settings</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-window-item>
      </v-window>
    </perfect-scrollbar>
  </div>
</template>
