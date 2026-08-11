<script setup lang="ts">
import { ref } from 'vue'
import { useDisplay } from 'vuetify'
import { Smartphone, X } from 'lucide-vue-next'

const display = useDisplay()
const showNotice = ref(true)
</script>

<template>
  <v-alert
    v-if="display.smAndDown.value && showNotice"
    type="warning"
    variant="tonal"
    density="comfortable"
    rounded="xl"
    class="mb-4 border border-amber-300 dark:border-amber-800 shadow-sm"
  >
    <template v-slot:prepend>
      <v-avatar color="warning" size="36" class="mr-3">
        <Smartphone class="w-5 h-5 text-white" />
      </v-avatar>
    </template>

    <div class="d-flex align-center justify-space-between w-100">
      <div>
        <div class="font-weight-bold text-subtitle-2 text-amber-900 dark:text-amber-200">
          Khuyên dùng màn hình lớn (Desktop / Tablet)
        </div>
        <div class="text-caption text-amber-800 dark:text-amber-300">
          Giao diện Quản trị được tối ưu tốt nhất trên máy tính. Một số bảng biểu và công cụ có thể bị co nhỏ trên thiết bị di động.
        </div>
      </div>
      <v-btn
        icon
        variant="text"
        size="small"
        color="warning"
        class="ml-2 shrink-0"
        @click="showNotice = false"
      >
        <X class="w-4 h-4" />
      </v-btn>
    </div>
  </v-alert>
</template>
