<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();

const breadcrumbs = computed(() => {
  if (route.name === 'home') return [];

  type Breadcrumb = { label: string; to: any };
  const crumbs: Breadcrumb[] = [{ label: 'Trang chủ', to: { name: 'home' } }];

  switch (route.name) {
    case 'shop':
      crumbs.push({ label: 'Sản phẩm', to: { name: 'shop' } });
      break;
    case 'product_detail':
      crumbs.push({ label: 'Sản phẩm', to: { name: 'shop' } });
      crumbs.push({ label: 'Chi tiết sản phẩm', to: { name: route.name, params: route.params } });
      break;
    case 'services':
      crumbs.push({ label: 'Dịch vụ', to: { name: 'services' } });
      break;
    case 'service_detail':
      crumbs.push({ label: 'Dịch vụ', to: { name: 'services' } });
      crumbs.push({ label: 'Chi tiết dịch vụ', to: { name: route.name, params: route.params } });
      break;
    case 'booking':
      crumbs.push({ label: 'Đặt lịch', to: { name: 'booking' } });
      break;
    case 'cart':
      crumbs.push({ label: 'Giỏ hàng', to: { name: 'cart' } });
      break;
    case 'wishlist':
      crumbs.push({ label: 'Yêu thích', to: { name: 'wishlist' } });
      break;
    case 'profile':
      crumbs.push({ label: 'Hồ sơ cá nhân', to: { name: 'profile' } });
      break;
    case 'login':
      crumbs.push({ label: 'Tài khoản', to: { name: 'login' } });
      break;
    default:
      if (route.name) {
         crumbs.push({ label: String(route.name).toUpperCase(), to: { name: route.name } });
      }
      break;
  }

  return crumbs;
});
</script>

<template>
  <div v-if="breadcrumbs.length > 0" class="w-full bg-[#fcfcfc] border-b border-gray-100">
    <div class="max-w-[1440px] mx-auto px-6 lg:px-12 py-4">
      <nav class="flex items-center space-x-2 text-[10px] uppercase tracking-widest text-gray-400">
        <template v-for="(crumb, index) in breadcrumbs" :key="index">
          <router-link 
            :to="crumb.to"
            :class="[
              'transition-colors',
              index === breadcrumbs.length - 1 ? 'text-black font-semibold pointer-events-none' : 'hover:text-black'
            ]"
          >
            {{ crumb.label }}
          </router-link>
          <span v-if="index < breadcrumbs.length - 1" class="text-gray-300">/</span>
        </template>
      </nav>
    </div>
  </div>
</template>
