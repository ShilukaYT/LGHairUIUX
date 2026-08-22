<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { BarChart3, X, Star, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close'])

const isLoading = ref(false)
const rawStats = ref<any[]>([])
const activeTab = ref('good')
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

const loadData = async () => {
  isLoading.value = true
  try {
    const res = await axios.get(API + '/api/QuanLyDanhGiaSanPham/thong-ke')
    rawStats.value = res.data.map((item: any) => ({
      tenSanPham: item.tenSanPham || item.TenSanPham || 'Sản phẩm khác',
      diemTrungBinh: item.diemTrungBinh !== undefined ? item.diemTrungBinh : (item.DiemTrungBinh || 0),
      luotDanhGia: item.luotDanhGia !== undefined ? item.luotDanhGia : (item.LuotDanhGia || 0)
    }))
  } catch (error) {
    console.error("Không thể load dữ liệu thống kê sản phẩm:", error)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isOpen, (val) => { if (val) loadData() })

const goodProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 4))
const normalProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 3 && s.diemTrungBinh < 4))
const badProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh < 3))

const tabConfigs = computed(() => [
  {
    value: 'good',
    data: goodProducts.value,
    color: 'success',
    label: 'Sản phẩm tốt (4-5⭐)'
  },
  {
    value: 'normal',
    data: normalProducts.value,
    color: 'warning',
    label: 'Trung bình (3-4⭐)'
  },
  {
    value: 'bad',
    data: badProducts.value,
    color: 'error',
    label: 'Cần cải thiện (1-2⭐)'
  }
])
</script>

<template>
  <v-dialog :model-value="isOpen" @update:model-value="val => !val && emit('close')" max-width="850px" scrollable>
    <v-card rounded="xl" class="overflow-hidden">
      <!-- Header -->
      <v-card-title class="pa-6 border-b d-flex align-center justify-space-between">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <BarChart3 class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">Xếp Hạng Hiệu Năng Sản Phẩm</h3>
            <div class="text-caption text-medium-emphasis">Phân loại sản phẩm theo điểm số đánh giá trung bình</div>
          </div>
        </div>
        <v-btn icon variant="text" density="comfortable" @click="emit('close')">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>

      <!-- Tabs -->
      <div class="px-6 pt-4 bg-surface">
        <v-tabs v-model="activeTab" color="primary" align-tabs="center" grow class="border rounded-lg">
          <v-tab value="good" class="text-none font-weight-bold">
            <template v-slot:prepend>
              <TrendingUp class="w-4 h-4 text-success mr-1" />
            </template>
            Tốt (4-5⭐)
          </v-tab>
          <v-tab value="normal" class="text-none font-weight-bold">
            <template v-slot:prepend>
              <Minus class="w-4 h-4 text-warning mr-1" />
            </template>
            Trung bình (3-4⭐)
          </v-tab>
          <v-tab value="bad" class="text-none font-weight-bold">
            <template v-slot:prepend>
              <TrendingDown class="w-4 h-4 text-error mr-1" />
            </template>
            Cần cải thiện (1-2⭐)
          </v-tab>
        </v-tabs>
      </div>

      <!-- Body / Table -->
      <v-card-text class="pa-6" style="max-height: 480px;">
        <div v-if="isLoading" class="d-flex justify-center align-center py-12">
          <v-progress-circular indeterminate color="primary" size="40" />
        </div>

        <div v-else v-for="tab in tabConfigs" :key="tab.value" v-show="activeTab === tab.value">
          <v-table class="border rounded-xl" hover>
            <thead>
              <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="font-weight-bold text-caption text-center" style="width: 80px;">HẠNG</th>
                <th class="font-weight-bold text-caption text-left">TÊN SẢN PHẨM</th>
                <th class="font-weight-bold text-caption text-center" style="width: 160px;">TRUNG BÌNH</th>
                <th class="font-weight-bold text-caption text-center" style="width: 140px;">TRẠNG THÁI</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in tab.data" :key="item.tenSanPham" class="border-b">
                <td class="text-center font-weight-bold">
                  <v-chip size="small" :color="index === 0 ? 'warning' : undefined" :variant="index === 0 ? 'flat' : 'tonal'" class="font-weight-bold">
                    #{{ index + 1 }}
                  </v-chip>
                </td>
                <td>
                  <div class="font-weight-bold text-body-2">{{ item.tenSanPham }}</div>
                  <div class="text-caption text-medium-emphasis">{{ item.luotDanhGia }} lượt đánh giá</div>
                </td>
                <td class="text-center">
                  <v-chip size="small" variant="tonal" color="primary" class="font-weight-bold">
                    {{ item.diemTrungBinh }}
                    <Star class="w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-1 inline" />
                  </v-chip>
                </td>
                <td class="text-center">
                  <v-chip size="small" :color="tab.color" variant="tonal" class="text-uppercase font-weight-bold text-caption">
                    {{ tab.label }}
                  </v-chip>
                </td>
              </tr>

              <tr v-if="tab.data.length === 0">
                <td colspan="4" class="text-center py-8 text-medium-emphasis">
                  Chưa có sản phẩm nào ở mức đánh giá này.
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>

      <!-- Footer -->
      <v-divider></v-divider>
      <v-card-actions class="pa-4 justify-end">
        <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold px-5" @click="emit('close')">
          Đóng
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
