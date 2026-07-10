<script setup>
import { ref, watch, computed } from 'vue';
import axios from 'axios';
import { Calendar, Clock, Award, FileText, X } from 'lucide-vue-next';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false
  },
  bookingId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close']);

const detail = ref(null);
const isLoading = ref(false);
const API_URL = import.meta.env.VITE_API_URL || "https://localhost:7196";

const fetchDetail = async (id) => {
  try {
    isLoading.value = true;
    const response = await axios.get(`${API_URL}/api/LichSuHoaDon/booking-detail/${id}`);
    detail.value = response.data;
  } catch (error) {
    console.error("Lỗi lấy chi tiết:", error);
    detail.value = null;
  } finally {
    isLoading.value = false;
  }
};

watch(() => props.isOpen, async (newVal) => {
  if (newVal && props.bookingId) {
    await fetchDetail(props.bookingId);
  } else {
    detail.value = null;
  }
});

const formatPrice = (price) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const formatTime = (timeStr) => {
  if (!timeStr) return '';
  return timeStr.substring(0, 5);
};

const getStatusText = (status) => {
  if (status === 0) return 'Đã hủy';
  if (status === 1) return 'Đã cọc 10%';
  if (status === 2) return 'Đã trả 100%';
  if (status === 3) return 'Hoàn thành';
  return 'Đang xử lý';
};

const getStatusBadgeClass = (status) => {
  if (status === 0) return 'bg-red-50 text-red-800 border-red-200';
  if (status === 1) return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  if (status === 2) return 'bg-blue-50 text-blue-800 border-blue-200';
  if (status === 3) return 'bg-green-50 text-green-800 border-green-200';
  return 'bg-gray-50 text-gray-800 border-gray-200';
};

const getStatusDotClass = (status) => {
  if (status === 0) return 'bg-red-500';
  if (status === 1) return 'bg-yellow-500';
  if (status === 2) return 'bg-blue-500';
  if (status === 3) return 'bg-green-500';
  return 'bg-gray-500';
};

const stylistsList = computed(() => {
  if (!detail.value || !detail.value.items) return '';
  const names = detail.value.items
    .map(item => item.stylistName)
    .filter(name => name)
    .filter((value, index, self) => self.indexOf(value) === index);
  return names.join(', ');
});
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="emit('close')">
      <div class="bg-white w-full max-w-lg rounded-sm shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-black">
        
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-heading text-sm uppercase tracking-widest text-black font-bold">Chi Tiết Hóa Đơn</h3>
            <span class="text-[10px] text-gray-400 font-semibold tracking-wider">MÃ ĐƠN: #{{ bookingId }}</span>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-black transition-colors cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 overflow-y-auto max-h-[70vh]">
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
            <div class="w-6 h-6 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
            <p class="mt-4 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Đang tải dữ liệu...</p>
          </div>
          
          <div v-else-if="detail" class="space-y-6">
            <!-- Time and Status Card -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#fdf8e8] p-4 border border-[#f1d592]/40 rounded-sm">
              <div class="space-y-1">
                <p class="text-[9px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-1">
                  <Calendar :size="10" /> Thời gian hẹn
                </p>
                <p class="text-xs text-black font-semibold">
                  {{ formatDate(detail.ngayHen) }}
                </p>
                <p class="text-[10px] text-gray-500 font-medium flex items-center gap-1">
                  <Clock :size="10" /> {{ formatTime(detail.gioHen) }} - {{ formatTime(detail.gioKetThuc) }}
                </p>
              </div>
              
              <div class="space-y-1 border-l border-gray-200/50 pl-0 sm:pl-4 flex flex-col justify-center items-start">
                <p class="text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Trạng thái</p>
                <span :class="['inline-flex items-center px-2.5 py-1 text-[8px] uppercase tracking-widest font-bold rounded-sm border', getStatusBadgeClass(detail.trangThai)]">
                  <span class="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" :class="getStatusDotClass(detail.trangThai)"></span>
                  {{ getStatusText(detail.trangThai) }}
                </span>
              </div>

              <div v-if="stylistsList" class="space-y-1 border-t sm:border-t-0 sm:border-l border-gray-200/50 pt-3 sm:pt-0 pl-0 sm:pl-4 flex flex-col justify-center">
                <p class="text-[9px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-1">
                  <Award :size="10" /> Stylist thực hiện
                </p>
                <p class="text-xs text-black font-semibold">
                  {{ stylistsList }}
                </p>
              </div>
            </div>

            <!-- Services Section -->
            <div v-if="detail.items && detail.items.length > 0">
              <h6 class="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 flex items-center gap-1.5">
                <FileText :size="12" /> Dịch vụ đã chọn
              </h6>
              <div class="border border-gray-100 rounded-sm divide-y divide-gray-100">
                <div v-for="item in detail.items" :key="item.name" class="flex justify-between items-center p-3 text-xs">
                  <div class="flex flex-col">
                    <span class="text-black font-medium">{{ item.name }}</span>
                    <span v-if="item.stylistName" class="text-[9px] text-gray-400">Stylist: {{ item.stylistName }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span v-if="item.originalPrice > item.price" class="text-gray-400 line-through text-[11px]">
                      {{ formatPrice(item.originalPrice) }}
                    </span>
                    <span class="text-black font-bold">{{ formatPrice(item.price) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pricing Breakdown -->
            <div class="bg-gray-50/50 p-4 border border-gray-100 rounded-sm space-y-2 text-xs">
              <div class="flex justify-between">
                <span class="text-gray-500">Tổng giá gốc:</span>
                <span class="text-black font-medium">{{ formatPrice(detail.totalOriginal) }}</span>
              </div>
              
              <div v-if="detail.flashSaleDiscount > 0" class="flex justify-between text-green-600">
                <span class="font-medium">Tiết kiệm Flash Sale:</span>
                <span class="font-bold">-{{ formatPrice(detail.flashSaleDiscount) }}</span>
              </div>

              <div v-if="detail.voucherGiam && detail.voucherGiam.amount > 0" class="flex justify-between text-red-600">
                <span class="font-medium">Voucher ({{ detail.voucherGiam.code }}):</span>
                <span class="font-bold">-{{ formatPrice(detail.voucherGiam.amount) }}</span>
              </div>

              <div class="flex justify-between items-center border-t border-gray-200/60 pt-3 mt-1">
                <span class="text-xs uppercase tracking-widest text-black font-bold">Số tiền thanh toán:</span>
                <span class="text-lg font-bold text-[#b8860b]">{{ formatPrice(detail.finalAmount) }}</span>
              </div>
            </div>
          </div>

          <!-- Fallback when detail could not be fetched -->
          <div v-else class="text-center py-12 text-gray-400">
            <p class="text-xs">Không tìm thấy thông tin hóa đơn.</p>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50/50 px-6 py-3.5 border-t border-gray-100 flex justify-end">
          <button @click="emit('close')" class="bg-black hover:bg-gray-900 text-white px-6 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
