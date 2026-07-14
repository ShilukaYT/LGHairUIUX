<script setup lang="ts">
import { ref } from 'vue'
import QuanLyDanhGiaDichVu from './QuanLyDanhGiaDichVu.vue'
import QuanLyDanhGiaSanPham from './QuanLyDanhGiaSanPham.vue'

const activeMainTab = ref<'service' | 'product'>('service')
</script>

<template>
    <v-container fluid class="pa-6 fill-height align-start font-sans select-none animate-in fade-in duration-500" style="min-height: 100vh;">
        <!-- Container card styled with premium rounded-2xl corners -->
        <v-card width="100%" elevation="2" rounded="2xl" class="d-flex flex-column w-full bg-white pa-6 border border-slate-100 shadow-sm">
            
            <!-- Global Tab Header for Admin using standard System Primary Color (Blue) -->
            <div class="d-flex flex-column flex-md-row align-md-center justify-space-between mb-2 gap-4">
                <div>
                    <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Đánh Giá</h2>
                    <div class="text-subtitle-2 text-medium-emphasis">Phản hồi khách hàng & quản lý chất lượng dịch vụ, nhân viên, sản phẩm</div>
                </div>

                <!-- Standard Native Vuetify Tabs Component with subtle borders -->
                <div class="self-start md:self-auto">
                    <v-tabs v-model="activeMainTab" color="primary" align-tabs="start" class="border-b border-slate-100 font-semibold">
                        <v-tab value="service" class="text-none font-weight-bold text-xs uppercase tracking-wider">
                            Đánh giá Dịch vụ & Thợ
                        </v-tab>
                        <v-tab value="product" class="text-none font-weight-bold text-xs uppercase tracking-wider">
                            Đánh giá Sản phẩm
                        </v-tab>
                    </v-tabs>
                </div>
            </div>

            <v-divider class="mb-6"></v-divider>

            <!-- Conditionally render the child management views -->
            <div class="w-full">
                <QuanLyDanhGiaDichVu v-if="activeMainTab === 'service'" />
                <QuanLyDanhGiaSanPham v-else />
            </div>

        </v-card>
    </v-container>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,800&display=swap');

.font-sans {
    font-family: 'Plus Jakarta Sans', sans-serif !important;
}
</style>