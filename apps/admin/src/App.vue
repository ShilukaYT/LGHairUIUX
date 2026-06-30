<template>
  <RouterView />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { RouterView } from 'vue-router'
import { useCustomizerStore } from '@/stores/customizer';
import { useTheme } from 'vuetify';

const customizer = useCustomizerStore();
const theme = useTheme();

onMounted(() => {
  const currentThemeSelection = localStorage.getItem('theme_selection') || 'system';
  
  // Set default if not exists
  if (!localStorage.getItem('theme_selection')) {
    localStorage.setItem('theme_selection', 'system');
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  let initialTheme = currentThemeSelection;
  
  if (currentThemeSelection === 'system') {
    initialTheme = mediaQuery.matches ? 'dark' : 'light';
  }
  
  customizer.SET_THEME(initialTheme);
  theme.global.name.value = initialTheme;

  // Listen for system changes if system theme is selected
  mediaQuery.addEventListener('change', (e) => {
    if (localStorage.getItem('theme_selection') === 'system') {
      const newTheme = e.matches ? 'dark' : 'light';
      customizer.SET_THEME(newTheme);
      theme.global.name.value = newTheme;
    }
  });
});
</script>

<style>

</style>