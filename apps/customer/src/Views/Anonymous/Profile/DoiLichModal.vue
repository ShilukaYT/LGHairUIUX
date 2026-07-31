<script setup>
import { ref, watch } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { X, CalendarClock, Loader2 } from 'lucide-vue-next';

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

const emit = defineEmits(['close', 'success']);

const formData = ref({
  date: '',
  time: ''
});

const isSubmitting = ref(false);
const errorMessage = ref('');
const API_URL = import.meta.env.VITE_API_URL || "https://localhost:7196";

const timeSlots = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30", "20:00"
];

// Reset form when modal opens
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    formData.value = { date: '', time: '' };
    errorMessage.value = '';
  }
});

const getMinDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const submitReschedule = async () => {
  if (!formData.value.date || !formData.value.time) {
    errorMessage.value = 'Vui lòng chọn ngày và giờ hẹn mới!';
    return;
  }

  // Basic client-side check if new date/time is in the future
  const newDateTimeStr = `${formData.value.date}T${formData.value.time}`;
  const newDateTime = new Date(newDateTimeStr);
  if (newDateTime <= new Date()) {
    errorMessage.value = 'Thời gian hẹn mới phải lớn hơn thời gian hiện tại!';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    let timeFormatted = formData.value.time;
    if (timeFormatted.split(':').length === 2) {
      timeFormatted += ':00'; // Append seconds for TimeSpan parsing in C#
    }

    const payload = {
      maLd: String(props.bookingId),
      ngayHenMoi: formData.value.date,
      gioBatDauMoi: timeFormatted
    };

    const res = await axios.put(`${API_URL}/api/LichSuHoaDon/reschedule-booking`, payload);

    emit('close');
    Swal.fire({
      icon: 'success',
      title: 'Thành công!',
      text: res.data.message || 'Thay đổi lịch hẹn thành công!',
      confirmButtonColor: '#000'
    });
    
    emit('success'); 
  } catch (error) {
    console.error("Lỗi khi dời lịch:", error);
    if (error.response?.data?.message) {
      errorMessage.value = error.response.data.message;
    } else {
      errorMessage.value = 'Có lỗi kết nối, vui lòng thử lại.';
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" @click.self="emit('close')">
      <div class="bg-white w-full max-w-md rounded-sm shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-black">
        
        <!-- Modal Header -->
        <div class="flex justify-between items-center px-6 py-4 border-b border-gray-100">
          <div>
            <h3 class="font-heading text-sm uppercase tracking-widest text-black font-bold">Dời Lịch Hẹn</h3>
            <span class="text-[10px] text-gray-400 font-semibold tracking-wider">ĐƠN HÀNG: #{{ bookingId }}</span>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-black transition-colors cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 space-y-4">
          <!-- Info Box -->
          <div class="bg-blue-50 border border-blue-200 p-4 rounded-sm flex items-start gap-3">
            <CalendarClock class="text-blue-500 shrink-0 mt-0.5" :size="16" />
            <p class="text-xs text-blue-700 leading-relaxed">
              Bạn đang yêu cầu dời lịch hẹn cho đơn <b>#{{ bookingId }}</b>. Vui lòng chọn ngày và giờ hẹn mới.
            </p>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-sm font-semibold">
            {{ errorMessage }}
          </div>

          <!-- Form inputs -->
          <div class="space-y-4">
            <!-- Date Select -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Ngày hẹn mới *</label>
              <input v-model="formData.date" type="date" :min="getMinDate()" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black cursor-pointer" />
            </div>

            <!-- Time Select -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Giờ bắt đầu mới *</label>
              <div class="relative">
                <select v-model="formData.time" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black cursor-pointer appearance-none">
                  <option value="" disabled selected>-- Chọn giờ bắt đầu --</option>
                  <option v-for="time in timeSlots" :key="time" :value="time">
                    {{ time }}
                  </option>
                </select>
                <div class="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-400">
                  <CalendarClock :size="14" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50/50 px-6 py-3.5 border-t border-gray-100 flex justify-end gap-2.5">
          <button @click="emit('close')" :disabled="isSubmitting" class="bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 px-5 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50">
            Hủy
          </button>
          <button @click="submitReschedule" :disabled="isSubmitting" class="bg-black hover:bg-gray-900 text-white px-5 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50">
            <Loader2 v-if="isSubmitting" :size="12" class="animate-spin" />
            {{ isSubmitting ? 'Đang xử lý...' : 'Xác nhận dời lịch' }}
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
