<script setup lang="ts">
import LockedAccountModal from '@/layouts/components/LockedAccountModal.vue';
</script>

<template>
  <RouterView />
  <!-- Modal khóa tài khoản toàn cục - hoạt động trên mọi trang -->
  <LockedAccountModal />
</template>

<style scoped>

</style>
