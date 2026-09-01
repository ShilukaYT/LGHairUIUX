<script setup>
import { ref, watch, computed } from 'vue';
import axios from 'axios';
import { Calendar, Clock, Award, FileText, X, Scissors, CheckCircle2 } from 'lucide-vue-next';

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

const normalizeStatus = (status) => {
  if (status === null || status === undefined) return 'cancelled';
  const str = String(status).toLowerCase().trim();
  if (str === '0' || str === '-1' || str === 'cancelled' || str === 'da huy' || str === 'dahuy' || str === 'da_huy') return 'cancelled';
  if (str === '1' || str === 'pending' || str === 'coc' || str === 'da coc 10%' || str === 'dacoc') return 'pending';
  if (str === '2' || str === 'paid-full' || str === 'paid' || str === 'da thanh toan' || str === 'dathanhtoan' || str === 'da tra 100%') return 'paid-full';
  if (str === '3' || str === 'completed' || str === 'hoan thanh' || str === 'hoanthanh') return 'completed';
  if (str === '4' || str === 'tam huy' || str === 'tamhuy' || str === 'tam_huy') return 'temp-cancelled';
  if (str === '5' || str === 'waiting' || str === 'cho hoan tien' || str === 'chohoantien' || str === 'refunding') return 'waiting';
  if (str === '6' || str === 'refunded' || str === 'da hoan tien' || str === 'dahoantien') return 'refunded';
  if (str === '9' || str === 'rescheduled' || str === 'doi lich' || str === 'doilich' || str === 'da doi lich') return 'rescheduled';
  return str;
};

const getStatusText = (status) => {
  const norm = normalizeStatus(status);
  const map = {
    cancelled: 'Đã hủy',
    pending: 'Đã cọc 10%',
    'paid-full': 'Đã trả 100%',
    completed: 'Hoàn thành',
    'temp-cancelled': 'Tạm hủy (Trễ hẹn)',
    waiting: 'Chờ hoàn tiền',
    refunded: 'Đã hoàn tiền',
    rescheduled: 'Đã dời lịch'
  };
  return map[norm] || 'Đang xử lý';
};

const getStatusBadgeClass = (status) => {
  const norm = normalizeStatus(status);
  if (norm === 'pending') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (norm === 'paid-full') return 'bg-blue-50 text-blue-800 border-blue-200';
  if (norm === 'completed') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  if (norm === 'temp-cancelled') return 'bg-rose-50 text-rose-800 border-rose-200 font-bold';
  if (norm === 'waiting') return 'bg-orange-50 text-orange-800 border-orange-200 font-semibold';
  if (norm === 'refunded') return 'bg-teal-50 text-teal-800 border-teal-200 font-semibold';
  if (norm === 'rescheduled') return 'bg-indigo-50 text-indigo-800 border-indigo-200 font-semibold';
  if (norm === 'cancelled') return 'bg-rose-50 text-rose-800 border-rose-200';
  return 'bg-gray-50 text-gray-800 border-gray-200';
};

const getStatusDotClass = (status) => {
  const norm = normalizeStatus(status);
  if (norm === 'pending') return 'bg-amber-500';
  if (norm === 'paid-full') return 'bg-blue-600';
  if (norm === 'completed') return 'bg-emerald-600';
  if (norm === 'temp-cancelled') return 'bg-rose-600 animate-pulse';
  if (norm === 'waiting') return 'bg-orange-500 animate-pulse';
  if (norm === 'refunded') return 'bg-teal-600';
  if (norm === 'rescheduled') return 'bg-indigo-600';
  if (norm === 'cancelled') return 'bg-rose-500';
  return 'bg-gray-500';
};

const normStatus = computed(() => normalizeStatus(detail.value?.trangThai));

const depositAmount = computed(() => {
  if (!detail.value) return 0;
  if (detail.value.depositAmount != null) return detail.value.depositAmount;
  if (detail.value.daThanhToan != null) return detail.value.daThanhToan;
  if (detail.value.tienCoc != null) return detail.value.tienCoc;
  return Math.round((detail.value.finalAmount || 0) * 0.1);
});

const remainingAmount = computed(() => {
  if (!detail.value) return 0;
  if (detail.value.remainingAmount != null) return detail.value.remainingAmount;
  if (detail.value.chuaThanhToan != null) return detail.value.chuaThanhToan;
  if (detail.value.tienConLai != null) return detail.value.tienConLai;
  return (detail.value.finalAmount || 0) - depositAmount.value;
});

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
    <div v-if="isOpen" class="invoice-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs" @click.self="emit('close')">
      <div class="bg-white w-full max-w-[460px] rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-black">
        
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-5 py-3.5 border-b border-gray-100 bg-white">
          <div>
            <h3 class="text-sm uppercase tracking-wide text-gray-900 font-bold flex items-center gap-1.5">
              <FileText :size="16" class="text-gray-900" /> Chi Tiết Hóa Đơn
            </h3>
            <span class="text-[10.5px] text-gray-400 font-mono font-medium tracking-wide">
              MÃ ĐƠN: <strong class="text-gray-800 font-bold">#{{ bookingId }}</strong>
            </span>
          </div>
          <button @click="emit('close')" class="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black flex items-center justify-center transition-all cursor-pointer">
            <X :size="14" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-4 overflow-y-auto max-h-[65vh] space-y-3">
          <div v-if="isLoading" class="flex flex-col items-center justify-center py-10">
            <div class="w-6 h-6 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
            <p class="mt-2 text-[10px] uppercase tracking-widest text-gray-400 font-bold">Đang tải dữ liệu...</p>
          </div>
          
          <div v-else-if="detail" class="space-y-3">
            <!-- Time, Status & Stylist Card -->
            <div class="grid grid-cols-3 gap-2 bg-gray-50/80 p-2.5 px-3 border border-gray-200/80 rounded-lg">
              <!-- Thời gian hẹn -->
              <div class="space-y-0.5">
                <p class="text-[9px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
                  <Calendar :size="10" class="text-gray-600" /> THỜI GIAN
                </p>
                <p class="text-xs text-black font-bold leading-tight">
                  {{ formatDate(detail.ngayHen) }}
                </p>
                <p class="text-[10px] text-gray-500 font-medium flex items-center gap-0.5">
                  <Clock :size="9" class="text-gray-400" /> {{ formatTime(detail.gioHen) }} - {{ formatTime(detail.gioKetThuc) }}
                </p>
              </div>
              
              <!-- Trạng thái -->
              <div class="space-y-0.5 border-l border-gray-200/80 pl-2.5 flex flex-col justify-center">
                <p class="text-[9px] uppercase tracking-wider text-gray-500 font-bold mb-0.5">TRẠNG THÁI</p>
                <span :class="['inline-flex items-center px-1.5 py-0.5 text-[8px] uppercase tracking-wider font-bold rounded border shadow-xs w-fit leading-none', getStatusBadgeClass(detail.trangThai)]">
                  <span class="w-1 h-1 rounded-full mr-1 shrink-0" :class="getStatusDotClass(detail.trangThai)"></span>
                  {{ getStatusText(detail.trangThai) }}
                </span>
              </div>

              <!-- Stylist -->
              <div v-if="stylistsList" class="space-y-0.5 border-l border-gray-200/80 pl-2.5 flex flex-col justify-center">
                <p class="text-[9px] uppercase tracking-wider text-gray-500 font-bold flex items-center gap-1">
                  <Scissors :size="10" class="text-gray-600" /> STYLIST
                </p>
                <p class="text-xs text-black font-bold truncate leading-tight" :title="stylistsList">
                  {{ stylistsList }}
                </p>
              </div>
            </div>

            <!-- Services Section -->
            <div v-if="detail.items && detail.items.length > 0">
              <h6 class="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-1.5 flex items-center gap-1">
                <FileText :size="11" class="text-gray-700" /> Dịch vụ đã chọn
              </h6>
              <div class="border border-gray-200 rounded-lg divide-y divide-gray-100 overflow-hidden bg-white shadow-xs">
                <div v-for="item in detail.items" :key="item.name" class="flex justify-between items-center py-2 px-3 text-xs hover:bg-gray-50/50 transition-colors">
                  <div class="flex flex-col">
                    <span class="text-gray-900 font-bold text-xs">{{ item.name }}</span>
                    <span v-if="item.stylistName" class="text-[9.5px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <Scissors :size="8.5" /> Stylist: <strong class="text-gray-700 font-semibold">{{ item.stylistName }}</strong>
                    </span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span v-if="item.originalPrice > item.price" class="text-gray-400 line-through text-[10px]">
                      {{ formatPrice(item.originalPrice) }}
                    </span>
                    <span class="text-black font-bold text-xs">{{ formatPrice(item.price) }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Pricing Breakdown -->
            <div class="bg-gray-50/80 p-3 border border-gray-200 rounded-lg space-y-1.5 text-xs">
              <div class="flex justify-between items-center text-[11px]">
                <span class="text-gray-500 font-medium">Tổng giá gốc:</span>
                <span class="text-black font-bold">{{ formatPrice(detail.totalOriginal) }}</span>
              </div>
              
              <div v-if="detail.flashSaleDiscount > 0" class="flex justify-between items-center text-emerald-700 bg-emerald-50/80 px-2 py-0.5 rounded text-[11px]">
                <span class="font-medium">Tiết kiệm Flash Sale:</span>
                <span class="font-bold">-{{ formatPrice(detail.flashSaleDiscount) }}</span>
              </div>

              <div v-if="detail.memberDiscount > 0" class="flex justify-between items-center text-blue-700 bg-blue-50/80 px-2 py-0.5 rounded text-[11px]">
                <span class="font-medium">Giảm giá thành viên:</span>
                <span class="font-bold">-{{ formatPrice(detail.memberDiscount) }}</span>
              </div>

              <div v-if="detail.voucherGiam && detail.voucherGiam.amount > 0" class="flex justify-between items-center text-rose-700 bg-rose-50/80 px-2 py-0.5 rounded text-[11px]">
                <span class="font-medium">Voucher ({{ detail.voucherGiam.code }}):</span>
                <span class="font-bold">-{{ formatPrice(detail.voucherGiam.amount) }}</span>
              </div>

              <!-- Tổng tiền thanh toán & Phân bổ theo trạng thái -->
              <div class="border-t border-gray-200 pt-2 mt-1 space-y-1.5">
                <!-- TH 1: ĐÃ CỌC 10% (Đã thanh toán xanh lá, Tiền còn lại đỏ) -->
                <template v-if="normStatus === 'pending'">
                  <div class="flex justify-between items-center text-[11px]">
                    <span class="text-gray-600 font-bold uppercase tracking-wide">Tổng tiền dịch vụ:</span>
                    <span class="text-xs font-bold text-gray-900">{{ formatPrice(detail.finalAmount) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded text-xs">
                    <span class="font-bold">✓ Đã đặt cọc (10%):</span>
                    <span class="font-bold text-emerald-700 text-xs">+{{ formatPrice(depositAmount) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-red-700 bg-red-50 px-2.5 py-1 rounded text-xs">
                    <span class="font-bold">⚠ Còn lại thanh toán tại salon (90%):</span>
                    <span class="font-bold text-red-700 text-xs">{{ formatPrice(remainingAmount) }}</span>
                  </div>
                </template>

                <!-- TH 2: ĐÃ TRẢ 100% HOẶC HOÀN THÀNH (Xanh lá) -->
                <template v-else-if="normStatus === 'paid-full' || normStatus === 'completed'">
                  <div class="flex justify-between items-center">
                    <span class="text-[11px] uppercase tracking-wide text-gray-900 font-bold">SỐ TIỀN THANH TOÁN:</span>
                    <span class="text-base font-bold text-emerald-600">{{ formatPrice(detail.finalAmount) }}</span>
                  </div>
                </template>

                <!-- TH 3: ĐÃ HOÀN TIỀN HOẶC CHỜ HOÀN TIỀN -->
                <template v-else-if="normStatus === 'refunded' || normStatus === 'waiting'">
                  <div class="flex justify-between items-center text-[11px] text-gray-500">
                    <span>Tổng tiền dịch vụ:</span>
                    <span class="font-semibold">{{ formatPrice(detail.finalAmount) }}</span>
                  </div>
                  <div class="flex justify-between items-center text-xs text-amber-800 bg-amber-50 px-2 py-1 rounded">
                    <span class="font-bold">Số tiền cọc thực tế (10%):</span>
                    <span class="font-bold">{{ formatPrice(detail.soTienHoan || detail.tienDaTra || detail.depositAmount || depositAmount) }}</span>
                  </div>
                  <div class="flex justify-between items-center border-t border-gray-100 pt-1.5 mt-1">
                    <span class="text-[11px] uppercase tracking-wide text-gray-900 font-bold">{{ normStatus === 'refunded' ? 'ĐÃ HOÀN TIỀN CỌC:' : 'TIỀN HOÀN TRẢ (10% CỌC):' }}</span>
                    <span class="text-base font-bold text-teal-600">{{ formatPrice(detail.soTienHoan || detail.tienDaTra || detail.depositAmount || depositAmount) }}</span>
                  </div>
                </template>

                <!-- TH 4: CHƯA THANH TOÁN / ĐÃ HỦY (Đỏ) -->
                <template v-else>
                  <div class="flex justify-between items-center">
                    <span class="text-[11px] uppercase tracking-wide text-gray-900 font-bold">SỐ TIỀN THANH TOÁN:</span>
                    <span class="text-base font-bold text-red-600">{{ formatPrice(detail.finalAmount) }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Fallback when detail could not be fetched -->
          <div v-else class="text-center py-8 text-gray-400">
            <p class="text-xs font-medium">Không tìm thấy thông tin hóa đơn.</p>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50/80 px-4.5 py-2.5 border-t border-gray-100 flex justify-end">
          <button @click="emit('close')" class="bg-black hover:bg-neutral-800 text-white px-5 py-1.5 text-[11px] uppercase tracking-wide font-bold rounded-md shadow-xs transition-all cursor-pointer">
            Đóng
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.invoice-modal,
.invoice-modal * {
  font-family: 'Inter', 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
