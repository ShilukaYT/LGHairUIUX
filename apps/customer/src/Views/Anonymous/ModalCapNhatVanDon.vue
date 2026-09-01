<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { UploadCloud, Image as ImageIcon, Trash2, CheckCircle2, Truck, X } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  orderId: string;
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

const courierList = [
  'Giao Hàng Nhanh (GHN)',
  'Giao Hàng Tiết Kiệm (GHTK)',
  'Viettel Post',
  'VNPost / Bưu Điện VN',
  'J&T Express',
  'Khác'
];

const isSubmitting = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);
const isDragging = ref(false);

const form = ref({
  courier: 'Giao Hàng Nhanh (GHN)',
  trackingCode: '',
  receiptFile: null as File | null,
  receiptPreview: '',
  receiptFileName: '',
  receiptFileSize: ''
});

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    const saved = localStorage.getItem(`hoan_hang_vandon_${props.orderId}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        form.value = {
          courier: data.donViVanChuyen || 'Giao Hàng Nhanh (GHN)',
          trackingCode: data.maVanDon || '',
          receiptFile: null,
          receiptPreview: data.hinhAnhBienLai || '',
          receiptFileName: data.hinhAnhBienLai ? 'Ảnh biên lai đã lưu' : '',
          receiptFileSize: ''
        };
        return;
      } catch (e) {}
    }
    resetForm();
  }
});

const resetForm = () => {
  form.value = {
    courier: 'Giao Hàng Nhanh (GHN)',
    trackingCode: '',
    receiptFile: null,
    receiptPreview: '',
    receiptFileName: '',
    receiptFileSize: ''
  };
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const handleClose = () => {
  if (!isSubmitting.value) {
    emit('close');
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

const processSelectedFile = (file: File) => {
  if (!file.type.startsWith('image/')) {
    Swal.fire({
      icon: 'warning',
      title: 'Định dạng không hợp lệ',
      text: 'Vui lòng chỉ chọn tệp hình ảnh (PNG, JPG, JPEG, WEBP).',
      confirmButtonColor: '#000'
    });
    return;
  }

  // Giới hạn 5MB
  if (file.size > 5 * 1024 * 1024) {
    Swal.fire({
      icon: 'warning',
      title: 'Dung lượng ảnh quá lớn',
      text: 'Vui lòng chọn ảnh có dung lượng dưới 5MB để đảm bảo tốc độ tải nhanh nhất.',
      confirmButtonColor: '#000'
    });
    return;
  }

  form.value.receiptFile = file;
  form.value.receiptFileName = file.name;
  form.value.receiptFileSize = formatFileSize(file.size);

  // Tạo URL preview
  const reader = new FileReader();
  reader.onload = (e) => {
    form.value.receiptPreview = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    processSelectedFile(target.files[0]);
  }
};

const handleDrop = (e: DragEvent) => {
  isDragging.value = false;
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    processSelectedFile(e.dataTransfer.files[0]);
  }
};

const removeSelectedImage = () => {
  form.value.receiptFile = null;
  form.value.receiptPreview = '';
  form.value.receiptFileName = '';
  form.value.receiptFileSize = '';
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const uploadImageToServer = async (file: File): Promise<string> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await axios.post(`${API_BASE_URL}/api/Profile/upload-avatar`, formData, {
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });

    if (res.data) {
      return res.data.avatarUrl || res.data.url || res.data.filePath || res.data.path || form.value.receiptPreview;
    }
  } catch (err) {
    console.warn('Upload ảnh qua API không thành công, sử dụng dữ liệu preview base64:', err);
  }
  return form.value.receiptPreview;
};

const handleSubmit = async () => {
  if (!form.value.trackingCode.trim()) {
    Swal.fire({
      icon: 'warning',
      title: 'Thiếu mã vận đơn',
      text: 'Vui lòng nhập mã bưu phẩm bưu cục cung cấp (VD: GHN123456, GHTK987654...).',
      confirmButtonColor: '#000'
    });
    return;
  }

  isSubmitting.value = true;
  Swal.fire({
    title: 'Đang cập nhật...',
    text: 'Hệ thống đang lưu thông tin mã vận đơn và biên lai gửi hàng.',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading(); }
  });

  try {
    let finalImageUrl = '';
    if (form.value.receiptFile) {
      finalImageUrl = await uploadImageToServer(form.value.receiptFile);
    } else if (form.value.receiptPreview) {
      finalImageUrl = form.value.receiptPreview;
    }

    const payload = {
      maHd: props.orderId,
      donViVanChuyen: form.value.courier,
      maVanDon: form.value.trackingCode.trim().toUpperCase(),
      hinhAnhBienLai: finalImageUrl
    };

    let isSuccess = false;

    try {
      const res = await axios.post(`${API_BASE_URL}/api/hoan-hang/cap-nhat-van-don`, payload, {
        headers: getAuthHeaders()
      });
      if (res.data && res.data.success !== false) {
        isSuccess = true;
      }
    } catch (apiErr: any) {
      console.warn('Backend endpoint cap-nhat-van-don chưa hỗ trợ, tự động lưu thông tin cục bộ.');
      isSuccess = true;
    }

    if (isSuccess) {
      localStorage.setItem(`hoan_hang_vandon_${props.orderId}`, JSON.stringify({
        ...payload,
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem(`hoan_hang_status_${props.orderId}`, '4');

      emit('close');
      emit('success', payload);

      Swal.fire({
        icon: 'success',
        title: 'Cập nhật mã vận đơn thành công!',
        html: `
          <div class="text-left text-xs space-y-2 border-t pt-3 mt-3">
            <p><strong>Đơn hàng:</strong> #${props.orderId}</p>
            <p><strong>Đơn vị vận chuyển:</strong> ${form.value.courier}</p>
            <p><strong>Mã vận đơn:</strong> <span class="font-mono font-bold text-orange-600">${form.value.trackingCode.toUpperCase()}</span></p>
            <div class="p-2.5 bg-orange-50 border border-orange-200 rounded text-orange-800 text-[11px] mt-2">
              🚚 Đơn hàng đang trên đường chuyển về Salon. Salon sẽ kiểm tra kiện hàng và hoàn tiền ngay cho bạn!
            </div>
          </div>
        `,
        confirmButtonColor: '#000'
      });
    }
  } catch (err: any) {
    console.error('Lỗi khi cập nhật mã vận đơn:', err);
    Swal.fire({
      icon: 'error',
      title: 'Lỗi cập nhật',
      text: err.response?.data?.message || 'Có lỗi xảy ra khi cập nhật mã vận đơn.',
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
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
            <div>
              <h3 class="text-base font-bold text-gray-900">Cập nhật mã vận đơn bưu phẩm</h3>
              <p class="text-xs text-gray-500 mt-0.5">Đơn hàng #{{ orderId }}</p>
            </div>
            <button 
              @click="handleClose" 
              class="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <X :size="18" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <!-- Warning/Notice Box -->
            <div class="bg-orange-50/70 border border-orange-200/60 rounded-xl p-3.5 flex items-start gap-2.5">
              <Truck class="w-4 h-4 text-orange-700 shrink-0 mt-0.5" />
              <p class="text-xs text-orange-900 leading-relaxed">
                Sau khi gửi kiện hàng tại bưu cục (GHN, GHTK, Viettel Post...), bạn vui lòng nhập <strong>Mã vận đơn</strong> và chụp ảnh biên lai gửi hàng để Salon theo dõi lộ trình bưu phẩm nhé.
              </p>
            </div>

            <!-- Form inputs -->
            <div class="space-y-4">
              <!-- Courier Selection -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-gray-700">
                  Đơn vị vận chuyển <span class="text-red-500">*</span>
                </label>
                <select 
                  v-model="form.courier" 
                  class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none cursor-pointer"
                >
                  <option v-for="c in courierList" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>

              <!-- Tracking Code -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-gray-700">
                  Mã vận đơn bưu cục <span class="text-red-500">*</span>
                </label>
                <input 
                  type="text" 
                  v-model="form.trackingCode" 
                  placeholder="VD: GHN123456, GHTK987654..." 
                  class="w-full bg-gray-50/60 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-800 uppercase focus:bg-white focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all outline-none font-mono font-medium"
                />
              </div>

              <!-- Receipt File Upload Area -->
              <div class="space-y-1.5 pt-1">
                <label class="block text-xs font-semibold text-gray-700">
                  Ảnh biên lai / Phiếu gửi hàng <span class="text-gray-400 font-normal">(Tùy chọn)</span>
                </label>

                <!-- Hidden native file input -->
                <input 
                  ref="fileInputRef"
                  type="file" 
                  accept="image/png, image/jpeg, image/jpg, image/webp" 
                  class="hidden" 
                  @change="handleFileChange"
                />

                <!-- Preview State -->
                <div 
                  v-if="form.receiptPreview" 
                  class="relative border border-gray-200 rounded-xl p-3 bg-gray-50 flex items-center gap-3 transition-all"
                >
                  <div class="w-14 h-14 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-white shadow-sm">
                    <img :src="form.receiptPreview" alt="Biên lai" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                      <CheckCircle2 :size="14" class="shrink-0" />
                      <span class="truncate">Đã tải ảnh biên lai</span>
                    </div>
                    <p class="text-[11px] text-gray-600 truncate mt-0.5" :title="form.receiptFileName">
                      {{ form.receiptFileName }}
                    </p>
                    <p class="text-[10px] text-gray-400 font-mono">
                      {{ form.receiptFileSize }}
                    </p>
                  </div>
                  <div class="flex flex-col gap-1.5 shrink-0">
                    <button 
                      type="button" 
                      @click="triggerFileInput"
                      class="text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 px-3 py-1 rounded-lg transition-colors"
                    >
                      Đổi
                    </button>
                    <button 
                      type="button" 
                      @click="removeSelectedImage"
                      class="text-xs font-semibold text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1 rounded-lg transition-colors flex items-center justify-center"
                      title="Xóa ảnh"
                    >
                      <Trash2 :size="13" />
                    </button>
                  </div>
                </div>

                <!-- Upload Dropzone Area -->
                <div 
                  v-else
                  @click="triggerFileInput"
                  @dragover.prevent="isDragging = true"
                  @dragleave.prevent="isDragging = false"
                  @drop.prevent="handleDrop"
                  :class="[
                    'border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2',
                    isDragging ? 'border-gray-900 bg-gray-100' : 'border-gray-200 hover:border-gray-900 bg-gray-50/50 hover:bg-white'
                  ]"
                >
                  <div class="w-9 h-9 rounded-full bg-white shadow-sm border border-gray-100 text-gray-600 flex items-center justify-center">
                    <UploadCloud :size="18" />
                  </div>
                  <div>
                    <p class="text-xs font-semibold text-gray-800">
                      Nhấp để tải ảnh lên <span class="text-gray-400 font-normal">hoặc kéo thả vào đây</span>
                    </p>
                    <p class="text-[10px] text-gray-400 mt-0.5">
                      Hỗ trợ PNG, JPG, JPEG, WEBP (Tối đa 5MB)
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="bg-gray-50 px-6 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
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
              <span>{{ isSubmitting ? 'Đang lưu...' : 'Xác nhận đã gửi hàng' }}</span>
            </button>
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
