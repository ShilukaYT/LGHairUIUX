<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { AlertTriangle, X } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  order: any;
  defaultAccountHolder?: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'success', data: any): void;
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || sessionStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const formatPrice = (price?: number | null) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

import { DANH_SACH_NGAN_HANG_VN, fetchDanhSachNganHangLive, type BankItem } from '@/Views/Anonymous/CSDL/danhSachNganHang';

const popularBanks = ref<BankItem[]>(DANH_SACH_NGAN_HANG_VN);

onMounted(async () => {
  popularBanks.value = await fetchDanhSachNganHangLive();
});

const reasonsList = [
  'Hàng bị hư hỏng / bể vỡ khi vận chuyển',
  'Giao sai mẫu mã / dung tích sản phẩm',
  'Sản phẩm cận date / có dấu hiệu đã mở nắp',
  'Dùng thử bị kích ứng da đầu',
  'Khách đổi ý không còn nhu cầu',
  'Lý do khác'
];

const isSubmitting = ref(false);

const form = ref({
  reason: 'Hàng bị hư hỏng / bể vỡ khi vận chuyển',
  customReason: '',
  bankCode: 'MB',
  bankName: 'MBBank - Ngân hàng Quân Đội',
  bankAccountNumber: '',
  bankAccountHolder: ''
});

// Watch khi props.isOpen thay đổi để reset/điền sẵn thông tin
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    form.value = {
      reason: 'Hàng bị hư hỏng / bể vỡ khi vận chuyển',
      customReason: '',
      bankCode: 'MB',
      bankName: 'MBBank - Ngân hàng Quân Đội',
      bankAccountNumber: '',
      bankAccountHolder: (props.defaultAccountHolder || '').trim().toUpperCase()
    };
  }
});

const onBankChange = () => {
  const bank = popularBanks.value.find(b => b.code === form.value.bankCode);
  if (bank) {
    form.value.bankName = bank.displayName || bank.name;
  }
};

const handleClose = () => {
  if (!isSubmitting.value) {
    emit('close');
  }
};

const handleSubmit = async () => {
  if (!form.value.bankAccountNumber.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu số tài khoản',
      text: 'Vui lòng nhập số tài khoản ngân hàng để Salon hoàn tiền.',
      confirmButtonColor: '#000'
    });
    return;
  }

  if (!form.value.bankAccountHolder.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu tên chủ tài khoản',
      text: 'Vui lòng nhập tên chủ tài khoản (viết hoa không dấu).',
      confirmButtonColor: '#000'
    });
    return;
  }

  const finalReason = form.value.reason === 'Lý do khác' ? form.value.customReason.trim() : form.value.reason;
  if (!finalReason) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu lý do hoàn trả',
      text: 'Vui lòng nhập chi tiết lý do yêu cầu hoàn trả.',
      confirmButtonColor: '#000'
    });
    return;
  }

  isSubmitting.value = true;
  Swal.fire({
    title: 'Đang gửi yêu cầu...',
    text: 'Hệ thống đang tiếp nhận thông tin hoàn tiền VietQR.',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    const payload = {
      maHd: props.order?.id,
      lyDoHoan: finalReason,
      ghiChuKhach: form.value.customReason || '',
      maNganHang: form.value.bankCode,
      tenNganHang: form.value.bankName,
      soTaiKhoan: form.value.bankAccountNumber.trim(),
      tenChuTaiKhoan: form.value.bankAccountHolder.trim().toUpperCase()
    };

    const res = await axios.post(`${API_BASE_URL}/api/hoan-hang/yeu-cau`, payload, {
      headers: getAuthHeaders()
    });

    if (res.data && res.data.success !== false) {
      emit('close');
      emit('success', res.data);

      Swal.fire({
        icon: 'success',
        title: 'Gửi yêu cầu hoàn hàng thành công!',
        html: `
          <div class="text-left text-xs space-y-2 border-t pt-3 mt-3">
            <p><strong>Mã đơn hàng:</strong> #${props.order?.id}</p>
            <p><strong>Số tiền hoàn:</strong> <span class="text-red-600 font-bold">${formatPrice(props.order?.amount)}</span></p>
            <p><strong>Tài khoản nhận tiền:</strong> ${form.value.bankName} - ${form.value.bankAccountNumber} (${form.value.bankAccountHolder.toUpperCase()})</p>
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px] mt-2">
              📌 Salon sẽ phản hồi trong vòng 24h. Sau khi Salon duyệt, bạn vui lòng mang kiện hàng ra bưu điện gửi và bấm nút <strong>[Mã vận đơn]</strong> để cập nhật nhé!
            </div>
          </div>
        `,
        confirmButtonColor: '#000'
      });
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Thất bại',
        text: res.data?.message || 'Có lỗi xảy ra khi gửi yêu cầu hoàn hàng.',
        confirmButtonColor: '#000'
      });
    }
  } catch (err: any) {
    console.error('Lỗi khi gửi yêu cầu hoàn tiền:', err);
    Swal.fire({
      icon: 'error',
      title: 'Lỗi gửi yêu cầu',
      text: err.response?.data?.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.',
      confirmButtonColor: '#000'
    });
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div 
        v-if="isOpen" 
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm overflow-y-auto"
        @click.self="handleClose"
      >
        <div class="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[88vh] my-auto overflow-hidden text-neutral-900">
          
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div>
              <h3 class="text-base font-bold text-gray-900">Yêu cầu trả hàng & hoàn tiền</h3>
              <p class="text-xs text-gray-500 mt-0.5">Đơn hàng #{{ order?.id }}</p>
            </div>
            <button 
              @click="handleClose" 
              class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Body Form -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            
            <!-- Policy Box -->
            <div class="bg-amber-50/70 border border-amber-200/60 rounded-xl p-3.5 flex items-start gap-2.5">
              <AlertTriangle class="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p class="text-xs text-amber-900 leading-relaxed">
                Hỗ trợ đổi trả trong vòng <strong>3 ngày (72h)</strong> kể từ khi nhận hàng. Sau khi yêu cầu được duyệt, bạn vui lòng gửi kiện hàng về Salon để nhận lại: <strong class="text-red-600 font-semibold">{{ formatPrice(order?.amount) }}</strong>.
              </p>
            </div>

            <!-- Reason -->
            <div class="space-y-1.5">
              <label class="block text-xs font-semibold text-gray-700">
                Lý do yêu cầu trả hàng <span class="text-red-500">*</span>
              </label>
              <select 
                v-model="form.reason" 
                class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none cursor-pointer"
              >
                <option v-for="r in reasonsList" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>

            <!-- Custom Reason -->
            <div v-if="form.reason === 'Lý do khác'" class="space-y-1.5 animate-in fade-in duration-150">
              <label class="block text-xs font-semibold text-gray-700">
                Mô tả chi tiết <span class="text-red-500">*</span>
              </label>
              <textarea 
                v-model="form.customReason" 
                placeholder="Nhập chi tiết tình trạng sản phẩm bạn nhận được..." 
                rows="2" 
                class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none resize-none"
              ></textarea>
            </div>

            <!-- Bank Info Section -->
            <div class="pt-3 border-t border-gray-100 space-y-3">
              <div>
                <h4 class="text-xs font-bold text-gray-900">Thông tin tài khoản nhận tiền</h4>
                <p class="text-[11px] text-gray-500 mt-0.5">
                  Salon sẽ quét mã VietQR chuyển khoản hoàn tiền trực tiếp vào tài khoản này.
                </p>
              </div>

              <!-- Bank Selection -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-gray-700">
                  Ngân hàng thụ hưởng <span class="text-red-500">*</span>
                </label>
                <select 
                  v-model="form.bankCode" 
                  @change="onBankChange"
                  class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none cursor-pointer"
                >
                  <option v-for="b in popularBanks" :key="b.code" :value="b.code">
                    {{ b.displayName || b.name }}
                  </option>
                </select>
              </div>

              <!-- Account Number -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-gray-700">
                  Số tài khoản ngân hàng <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  v-model="form.bankAccountNumber" 
                  placeholder="Nhập số tài khoản ngân hàng..." 
                  class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none font-mono"
                />
              </div>

              <!-- Account Holder -->
              <div class="space-y-1.5">
                <label class="block text-xs font-medium text-gray-700">
                  Tên chủ tài khoản (Không dấu) <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  v-model="form.bankAccountHolder" 
                  placeholder="VD: NGUYEN VAN A" 
                  class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 uppercase focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none font-medium"
                />
              </div>
            </div>

          </div>

          <!-- Footer -->
          <div class="bg-gray-50 px-6 py-4 border-t border-gray-100 flex items-center justify-between shrink-0">
            <div class="text-xs">
              <span class="text-gray-500">Hoàn lại:</span>
              <span class="text-red-600 font-bold text-sm ml-1.5">{{ formatPrice(order?.amount) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button 
                @click="handleClose" 
                :disabled="isSubmitting"
                class="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-200/60 rounded-xl transition-colors disabled:opacity-50"
              >
                Hủy
              </button>
              <button 
                @click="handleSubmit" 
                :disabled="isSubmitting"
                class="bg-gray-900 hover:bg-black text-white px-5 py-2 text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                <span v-if="isSubmitting" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                <span>{{ isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu' }}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}
</style>
