<template>
  <RouterView />
  <!-- Hộp thoại xác thực & phiên làm việc Vuetify 3 toàn cục -->
  <AdminAuthDialogs />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { RouterView } from 'vue-router'
import { useCustomizerStore } from '@/stores/customizer';
import { useTheme } from 'vuetify';
import AdminAuthDialogs from '@/components/AdminAuthDialogs.vue';
import { useSessionHeartbeat } from '@/composables/useSessionHeartbeat';

const customizer = useCustomizerStore();
const theme = useTheme();

// Kích hoạt tiến trình theo dõi phiên làm việc ngầm (Heartbeat & Tab Switch)
useSessionHeartbeat();

function applyThemeMode(themeName: string) {
  const isDark = themeName === 'dark';
  theme.global.name.value = themeName;
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.body.classList.add('dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.documentElement.removeAttribute('data-theme');
  }
}

watch(
  () => customizer.actTheme,
  (val) => {
    if (val) {
      applyThemeMode(val);
    }
  },
  { immediate: true }
);

onMounted(() => {
  const currentThemeSelection = localStorage.getItem('theme_selection') || 'system';
  
  if (!localStorage.getItem('theme_selection')) {
    localStorage.setItem('theme_selection', 'system');
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let initialTheme = currentThemeSelection;
  
  if (currentThemeSelection === 'system') {
    initialTheme = mediaQuery.matches ? 'dark' : 'light';
  }
  
  customizer.SET_THEME(initialTheme);
  applyThemeMode(initialTheme);

  // Listen for system changes if system theme is selected
  mediaQuery.addEventListener('change', (e) => {
    if (localStorage.getItem('theme_selection') === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      customizer.SET_THEME(newTheme);
      applyThemeMode(newTheme);
    }
  });
});
</script>

<style>

</style>