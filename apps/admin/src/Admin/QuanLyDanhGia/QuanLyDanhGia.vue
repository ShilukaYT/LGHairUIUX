<script setup lang="ts">
import { ref } from 'vue'
import { Star, Scissors, Package } from 'lucide-vue-next'
import QuanLyDanhGiaDichVu from './QuanLyDanhGiaDichVu.vue'
import QuanLyDanhGiaSanPham from './QuanLyDanhGiaSanPham.vue'

const activeMainTab = ref<'service' | 'product'>('service')
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <v-card width="100%" elevation="2" rounded="xl" class="pa-6">
      <!-- Global Tab Header for Admin -->
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between mb-2 gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <Star class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Đánh Giá</h2>
            <div class="text-subtitle-2 text-medium-emphasis">
              Phản hồi khách hàng &amp; quản lý chất lượng dịch vụ, nhân viên, sản phẩm
            </div>
          </div>
        </div>

        <div>
          <v-tabs v-model="activeMainTab" color="primary" class="admin-review-tabs">
            <v-tab value="service" class="text-none font-weight-bold">
              <template v-slot:prepend>
                <Scissors class="w-4 h-4 mr-1.5" />
              </template>
              Đánh giá Dịch vụ &amp; Thợ
            </v-tab>
            <v-tab value="product" class="text-none font-weight-bold">
              <template v-slot:prepend>
                <Package class="w-4 h-4 mr-1.5" />
              </template>
              Đánh giá Sản phẩm
            </v-tab>
          </v-tabs>
        </div>
      </div>

      <v-divider class="mb-6"></v-divider>

      <!-- Child Views -->
      <div class="w-100">
        <QuanLyDanhGiaDichVu v-if="activeMainTab === 'service'" />
        <QuanLyDanhGiaSanPham v-else />
      </div>
    </v-card>
  </v-container>
</template>

<style scoped>
:deep(.v-tab__slider) {
  height: 3px !important;
  border-radius: 3px 3px 0 0;
}
</style>