<script setup lang="ts">
import { reactive, watch } from 'vue'

// Props/emit cho phép component cha (trang Checkout) nhận dữ liệu này
// và gộp vào field `invoiceInfo` khi gửi request submit-product-order
export interface InvoiceInfoDto {
  xuatHoaDon: boolean
  laDoanhNghiep: boolean
  tenCongTy: string | null
  mst: string | null
  diaChiXuatHD: string | null
  emailNhanHD: string | null
}

const props = defineProps<{
  defaultAddress?: string
  defaultEmail?: string
}>()

const emit = defineEmits<{
  (e: 'update', value: InvoiceInfoDto): void
}>()

const form = reactive<InvoiceInfoDto>({
  xuatHoaDon: false,
  laDoanhNghiep: false,
  tenCongTy: '',
  mst: '',
  diaChiXuatHD: props.defaultAddress ?? '',
  emailNhanHD: props.defaultEmail ?? '',
})

const mstError = reactive({ show: false, message: '' })

function validateMst(): boolean {
  if (!form.laDoanhNghiep) {
    mstError.show = false
    return true
  }
  const mst = (form.mst ?? '').trim()
  // MST Việt Nam: 10 số, hoặc 13 số (10 số gốc + "-" + 3 số chi nhánh)
  const isValid = /^\d{10}$/.test(mst) || /^\d{10}-\d{3}$/.test(mst)
  mstError.show = !isValid
  mstError.message = isValid ? '' : 'Mã số thuế không hợp lệ (10 số, hoặc 10 số-3 số chi nhánh)'
  return isValid
}

// Phát dữ liệu ra component cha mỗi khi thay đổi, để cha tự validate lần cuối lúc submit
watch(
  form,
  () => {
    emit('update', { ...form })
  },
  { deep: true, immediate: true }
)

defineExpose({ validateMst })
</script>

<template>
  <div class="border border-gray-200 rounded-xl p-4 md:p-5 bg-white">
    <label class="flex items-center gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        v-model="form.xuatHoaDon"
        class="w-5 h-5 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
      />
      <span class="text-sm md:text-base font-medium text-gray-900">
        Xuất hóa đơn điện tử cho đơn hàng này
      </span>
    </label>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="form.xuatHoaDon" class="mt-4 pt-4 border-t border-gray-100 space-y-4">
        <!-- Loại khách -->
        <div class="flex gap-2">
          <button
            type="button"
            @click="form.laDoanhNghiep = false"
            :class="[
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
              !form.laDoanhNghiep
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
            ]"
          >
            Cá nhân
          </button>
          <button
            type="button"
            @click="form.laDoanhNghiep = true"
            :class="[
              'flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
              form.laDoanhNghiep
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400',
            ]"
          >
            Doanh nghiệp (có MST)
          </button>
        </div>

        <!-- Tên công ty + MST — chỉ hiện khi chọn Doanh nghiệp -->
        <template v-if="form.laDoanhNghiep">
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Tên công ty</label>
            <input
              type="text"
              v-model="form.tenCongTy"
              placeholder="Công ty TNHH ABC"
              class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-500 mb-1">Mã số thuế</label>
            <input
              type="text"
              v-model="form.mst"
              @blur="validateMst"
              placeholder="0301234567"
              class="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10"
              :class="mstError.show ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-gray-400'"
            />
            <p v-if="mstError.show" class="text-xs text-red-500 mt-1">{{ mstError.message }}</p>
          </div>
        </template>

        <!-- Địa chỉ + email nhận hóa đơn -->
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Địa chỉ xuất hóa đơn</label>
          <input
            type="text"
            v-model="form.diaChiXuatHD"
            placeholder="Số nhà, đường, phường/xã, tỉnh/thành"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-500 mb-1">Email nhận hóa đơn</label>
          <input
            type="email"
            v-model="form.emailNhanHD"
            placeholder="email@example.com"
            class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
          />
        </div>

        <p class="text-xs text-gray-400">
          Hóa đơn điện tử sẽ được gửi tới email trên trong vòng vài phút sau khi đặt hàng thành công.
        </p>
      </div>
    </Transition>
  </div>
</template>
