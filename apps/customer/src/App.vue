<script setup lang="ts">
import LockedAccountModal from '@/layouts/components/LockedAccountModal.vue';
import SessionExpiredModal from '@/layouts/components/SessionExpiredModal.vue';
import LogoutConfirmModal from '@/layouts/components/LogoutConfirmModal.vue';
</script>

<template>
  <RouterView />
  <!-- Các Modal xác thực & phiên toàn cục - hoạt động trên mọi trang -->
  <LockedAccountModal />
  <SessionExpiredModal />
  <LogoutConfirmModal />
</template>

<style scoped>

</style>
