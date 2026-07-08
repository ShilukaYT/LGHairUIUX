<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useCustomizerStore } from '../../../stores/customizer';
// icons
import { MenuFoldOutlined, SearchOutlined } from '@ant-design/icons-vue';

// dropdown imports
import NotificationDD from './NotificationDD.vue';
import Searchbar from './SearchBarPanel.vue';
import ProfileDD from './ProfileDD.vue';
import { useTheme } from 'vuetify';
import { SunIcon, MoonIcon } from 'vue-tabler-icons';

const customizer = useCustomizerStore();
const theme = useTheme();

const userName = ref('User');
const isAdmin = ref(false);
const currentUserMaNv = ref('');
const userAvatar = ref('');

const loadUserFromStorage = () => {
  const adminStr = sessionStorage.getItem('adminUser');
  const staffStr = sessionStorage.getItem('staffUser') || sessionStorage.getItem('nhanVienUser');

  let user: any = null;
  if (adminStr) {
    user = JSON.parse(adminStr);
    userName.value = user.hoTen || user.tenNhanVien || user.username || 'Admin';
    isAdmin.value = true;
    currentUserMaNv.value = user.maNv || user.id || '';
  } else if (staffStr) {
    user = JSON.parse(staffStr);
    userName.value = user.hoTen || user.tenNhanVien || user.username || 'Nhân viên';
    currentUserMaNv.value = user.maNv || user.id || '';
  }

  if (user) {
    const rawAvatar = user.hinhAnh || user.avatar || '';
    if (rawAvatar) {
      userAvatar.value = rawAvatar.startsWith('/')
        ? `https://localhost:7196${rawAvatar}`
        : rawAvatar;
    } else {
      userAvatar.value = '';
    }
  }
};

const avatarSrc = computed(() => {
  return userAvatar.value || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName.value)}&background=random&color=fff&size=100`;
});

onMounted(() => {
  loadUserFromStorage();
  window.addEventListener('update-staff-sidebar', loadUserFromStorage);
});

onUnmounted(() => {
  window.removeEventListener('update-staff-sidebar', loadUserFromStorage);
});

function toggleTheme() {
  const newTheme = customizer.actTheme === 'dark' ? 'light' : 'dark';
  customizer.SET_THEME(newTheme);
  theme.global.name.value = newTheme;
}
</script>

<template>
  <v-app-bar elevation="0" height="60">
    <v-btn
      class="hidden-md-and-down text-secondary mr-3"
      color="darkText"
      icon
      rounded="sm"
      variant="text"
      @click.stop="customizer.SET_MINI_SIDEBAR(!customizer.mini_sidebar)"
      size="small"
    >
      <MenuFoldOutlined :style="{ fontSize: '16px' }" />
    </v-btn>
    <v-btn
      class="hidden-lg-and-up text-secondary ms-3"
      color="darkText"
      icon
      rounded="sm"
      variant="text"
      @click.stop="customizer.SET_SIDEBAR_DRAWER"
      size="small"
    >
      <MenuFoldOutlined :style="{ fontSize: '16px' }" />
    </v-btn>

    <!-- search mobile -->
    <v-menu :close-on-content-click="false" class="hidden-lg-and-up" offset="10, 0">
      <template v-slot:activator="{ props }">
        <v-btn
          class="hidden-lg-and-up text-secondary ml-1"
          color="lightsecondary"
          icon
          rounded="sm"
          variant="flat"
          size="small"
          v-bind="props"
        >
          <SearchOutlined :style="{ fontSize: '17px' }" />
        </v-btn>
      </template>
      <v-sheet class="search-sheet v-col-12 pa-0" width="320">
        <v-text-field persistent-placeholder placeholder="Search here.." color="primary" variant="solo" hide-details>
          <template v-slot:prepend-inner>
            <SearchOutlined :style="{ fontSize: '17px' }" />
          </template>
        </v-text-field>
      </v-sheet>
    </v-menu>

    <!-- ---------------------------------------------- -->
    <!-- Search part -->
    <!-- ---------------------------------------------- -->
    <v-sheet class="d-none d-lg-block" width="250">
      <Searchbar />
    </v-sheet>

    <!---/Search part -->

    <v-spacer />
    <!-- ---------------------------------------------- -->
    <!---right part -->
    <!-- ---------------------------------------------- -->

    <!-- ---------------------------------------------- -->
    <!-- Theme Toggle -->
    <!-- ---------------------------------------------- -->
    <!-- <v-btn
      icon
      class="text-secondary hidden-sm-and-down d-flex"
      color="darkText"
      rounded="sm"
      variant="text"
      @click="toggleTheme"
    >
      <component :is="customizer.actTheme === 'dark' ? SunIcon : MoonIcon" size="20" />
    </v-btn> -->

    <!-- ---------------------------------------------- -->
    <!-- Notification -->
    <!-- ---------------------------------------------- -->
    <NotificationDD :isAdmin="isAdmin" :currentUserMaNv="currentUserMaNv" />

    <!-- ---------------------------------------------- -->
    <!-- User Profile -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="false" offset="8, 0">
      <template v-slot:activator="{ props }">
        <v-btn class="profileBtn" variant="text" rounded="sm" v-bind="props">
          <div class="d-flex align-center">
            <v-avatar size="36" class="mr-sm-2 mr-0">
              <img :src="avatarSrc" style="width: 100%; height: 100%; object-fit: cover; object-position: center;" alt="Avatar" />
            </v-avatar>
            <h6 class="text-subtitle-1 mb-0 d-sm-block d-none">{{ userName }}</h6>
          </div>
        </v-btn>
      </template>
      <v-sheet rounded="md" width="290">
        <ProfileDD />
      </v-sheet>
    </v-menu>
  </v-app-bar>
</template>
