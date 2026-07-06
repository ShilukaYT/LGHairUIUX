<script setup lang="ts">
import { RouterView } from 'vue-router';
import LoaderWrapper from '@/layouts/dashboard/LoaderWrapper.vue';
import NhanVienSidebarVue from '@/layouts/dashboard/vertical-sidebar/NhanVienSidebar.vue';
import VerticalHeaderVue from '@/layouts/dashboard/vertical-header/VerticalHeader.vue';
import FooterPanel from '@/layouts/dashboard/footer/FooterPanel.vue';
import { useCustomizerStore } from '@/stores/customizer';

const customizer = useCustomizerStore();
</script>

<template>
  <v-locale-provider>
    <v-app :class="[customizer.mini_sidebar ? 'mini-sidebar' : '']">
      <NhanVienSidebarVue />
      <VerticalHeaderVue />

      <v-main class="page-wrapper">
        <v-container fluid>
          <div>
            <!-- Loader start -->
            <LoaderWrapper />
            <!-- Loader end -->
            <RouterView />
          </div>
        </v-container>
        <v-container fluid class="pt-0">
          <div>
            <FooterPanel />
          </div>
        </v-container>
      </v-main>
    </v-app>
  </v-locale-provider>
</template>
