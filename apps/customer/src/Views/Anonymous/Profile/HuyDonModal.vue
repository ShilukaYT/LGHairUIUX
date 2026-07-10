<script setup>
import { ref, watch, onMounted } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { X, AlertTriangle, Loader2 } from 'lucide-vue-next';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

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
  bank: '',
  stk: '',
  name: ''
});

const danhSachNganHang = ref([
  "Vietcombank (VCB)",
  "Techcombank (TCB)",
  "MBBank (MB)",
  "VietinBank (CTG)",
  "BIDV",
  "Agribank",
  "Sacombank (STB)",
  "ACB",
  "VPBank",
  "TPBank",
  "VIB",
  "HDBank",
  "SHB",
  "SeABank",
  "MSB",
  "Timo",
  "Khác..."
]);

const isSubmitting = ref(false);
const errorMessage = ref('');
const API_URL = import.meta.env.VITE_API_URL || "https://localhost:7196";

// Autofill name from customer info if available
const fillCustomerName = () => {
  const customer = getCustomerInfo();
  if (customer && customer.hoTen && customer.hoTen !== 'Khách vãng lai') {
    formData.value.name = customer.hoTen.toUpperCase();
  }
};

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    formData.value = { bank: '', stk: '', name: '' };
    errorMessage.value = '';
    fillCustomerName();
  }
});

onMounted(() => {
  fillCustomerName();
});

const submitRefund = async () => {
  if (!formData.value.bank || !formData.value.stk || !formData.value.name) {
    errorMessage.value = 'Vui lòng điền đầy đủ thông tin nhận tiền!';
    return;
  }

  isSubmitting.value = true;
  errorMessage.value = '';

  try {
    const res = await axios.post(`${API_URL}/api/LichSuHoaDon/submit-refund`, {
      maLd: String(props.bookingId),
      nganHang: formData.value.bank,
      stk: String(formData.value.stk),
      chuTk: formData.value.name
    });

    emit('close');
    Swal.fire({
      icon: 'success',
      title: 'Thành công!',
      text: res.data.message || 'Gửi yêu cầu hủy lịch và hoàn tiền thành công!',
      confirmButtonColor: '#000'
    });
    
    emit('success'); 
  } catch (error) {
    console.error("Lỗi khi hủy đơn:", error);
    if (error.response?.data?.errors) {
      errorMessage.value = "Dữ liệu nhập vào chưa hợp lệ, vui lòng kiểm tra lại chữ và số.";
    } else {
      errorMessage.value = error.response?.data?.message || error.response?.data || 'Có lỗi kết nối, vui lòng thử lại.';
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
            <h3 class="font-heading text-sm uppercase tracking-widest text-black font-bold">Xác Nhận Hủy Lịch</h3>
            <span class="text-[10px] text-gray-400 font-semibold tracking-wider">ĐƠN HÀNG: #{{ bookingId }}</span>
          </div>
          <button @click="emit('close')" class="text-gray-400 hover:text-black transition-colors cursor-pointer">
            <X :size="18" />
          </button>
        </div>

        <!-- Modal Body -->
        <div class="p-6 space-y-4">
          <!-- Warning Box -->
          <div class="bg-[#fff8e1] border border-[#f1d592]/30 p-4 rounded-sm flex items-start gap-3">
            <AlertTriangle class="text-[#b8860b] shrink-0 mt-0.5" :size="16" />
            <p class="text-xs text-[#b8860b] leading-relaxed">
              Bạn đang yêu cầu hủy đơn <b>#{{ bookingId }}</b>. Vui lòng cung cấp thông tin tài khoản để hệ thống hoàn lại tiền theo chính sách (nếu có).
            </p>
          </div>

          <!-- Error Alert -->
          <div v-if="errorMessage" class="bg-red-50 border border-red-200 text-red-600 text-xs px-3 py-2.5 rounded-sm font-semibold">
            {{ errorMessage }}
          </div>

          <!-- Form inputs -->
          <div class="space-y-4">
            <!-- Bank Select -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Ngân hàng nhận tiền *</label>
              <select v-model="formData.bank" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black cursor-pointer appearance-none">
                <option value="" disabled selected>-- Vui lòng chọn ngân hàng --</option>
                <option v-for="bank in danhSachNganHang" :key="bank" :value="bank">
                  {{ bank }}
                </option>
              </select>
            </div>

            <!-- Account Number -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Số tài khoản *</label>
              <input v-model="formData.stk" type="text" placeholder="Nhập số tài khoản (Viết liền không cách)" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black" />
            </div>

            <!-- Account Holder -->
            <div class="space-y-1.5">
              <label class="block text-[10px] uppercase tracking-widest text-gray-500 font-bold">Tên chủ tài khoản *</label>
              <input v-model="formData.name" type="text" placeholder="VD: NGUYEN VAN A" class="w-full bg-white border border-gray-200 focus:border-black outline-none px-3 py-2.5 text-xs transition-all rounded-sm text-black uppercase font-semibold" />
            </div>
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="bg-gray-50/50 px-6 py-3.5 border-t border-gray-100 flex justify-end gap-2.5">
          <button @click="emit('close')" :disabled="isSubmitting" class="bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 px-5 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors cursor-pointer disabled:opacity-50">
            Thoát
          </button>
          <button @click="submitRefund" :disabled="isSubmitting" class="bg-[#dc3545] hover:bg-[#c82333] text-white px-5 py-2.5 text-[10px] uppercase tracking-widest font-semibold rounded-sm transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50">
            <Loader2 v-if="isSubmitting" :size="12" class="animate-spin" />
            {{ isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu hủy' }}
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
