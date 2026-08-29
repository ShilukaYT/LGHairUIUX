<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import Swal from 'sweetalert2';
import axios from 'axios';

// --- CẤU HÌNH SWEETALERT2 TOAST ---
const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

// --- INTERFACES ---
interface KieuToc { 
  ma_kt: string; 
  ten_kieu_toc: string; 
  hinh_anh: string | null; 
  mo_ta: string | null; 
}
interface BangMau { 
  ma_mau: string; 
  ten_mau: string; 
}

// --- STATE ---
const showModalTryOn = ref(false);
const showApiSettings = ref(false);
const isLoading = ref(false);
const apiKey = ref(localStorage.getItem('hairAiApiKey') || '');
const tempApiKey = ref('');
const fileInputRef = ref<HTMLInputElement | null>(null);

// LƯU Ý QUAN TRỌNG: Thêm biến này để giữ FILE gốc gửi cho C# [FromForm]
const userImageFile = ref<File | null>(null); 
const userImage = ref<string | null>(null); // Chỉ dùng để hiển thị Preview

const selectedStyle = ref<KieuToc | null>(null);
const selectedColor = ref<BangMau | null>(null);
const tryOnResult = ref<string | null>(null);
const hairstyles = ref<KieuToc[]>([]);
const colors = ref<BangMau[]>([]);

// Cấu hình URL API Backend
const API_BASE = import.meta.env.VITE_API_URL ;
const API_HAIR_STYLES = `${API_BASE}/api/StyleHairAndColor`;
const API_HAIR_COLORS = `${API_BASE}/api/StyleHairAndColor/color`;
const API_HAIR_TRYON_PROCESS = `${API_BASE}/api/Tryon/process`; // Chữ T viết hoa theo C# Controller

// --- GỌI API MASTER DATA ---
const fetchHair = async () => {
  try {
    const response = await axios.get(API_HAIR_STYLES);
    const result = response.data; 
    
    if (result.status === 200) {
      hairstyles.value = result.data
        .filter((item: any) => item.trangThai === 1 || item.trang_thai === 1)
        .map((item: any) => ({
          ma_kt: item.maKt || item.ma_kt,
          ten_kieu_toc: item.tenKieuToc || item.ten_kieu_toc,
          hinh_anh: item.hinhAnh || item.hinh_anh,
          mo_ta: item.moTa || item.mo_ta
        }));
    }
  } catch (error) {
    Toast.fire({ icon: 'error', title: 'Không thể tải danh sách kiểu tóc từ server.' });
  }
};

const fetchColors = async () => {
  try {
    const response = await axios.get(API_HAIR_COLORS);
    const result = response.data; 
    
    if (result.status === 200) {
      colors.value = result.data
        .filter((item: any) => item.trangThai === 1 || item.trang_thai === 1)
        .map((item: any) => ({
          ma_mau: item.maMau || item.ma_mau,
          ten_mau: item.tenMau || item.ten_mau
        }));
    }
  } catch (error) {
    Toast.fire({ icon: 'error', title: 'Không thể tải bảng màu từ server.' });
  }
};

onMounted(() => {
  fetchHair();
  fetchColors();
});

watch(showApiSettings, (val) => {
  if (val) tempApiKey.value = apiKey.value;
});

// Thêm watch này để tự động reset kết quả cũ khi chọn lại kiểu hoặc màu tóc khác
watch([selectedStyle, selectedColor], () => {
  if (tryOnResult.value) {
    tryOnResult.value = null; // Reset để hiện lại giao diện nút "Thử Kiểu Khác" nếu cần
  }
});

// --- METHODS TƯƠNG TÁC GIAO DIỆN ---
const triggerFileInput = () => fileInputRef.value?.click();

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    Toast.fire({ icon: 'error', title: 'Vui lòng chọn file hình ảnh hợp lệ.' });
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    Toast.fire({ icon: 'error', title: 'Kích thước file không được vượt quá 5MB.' });
    return;
  }

  // LƯU FILE GỐC ĐỂ TÝ GỬI API
  userImageFile.value = file;

  const reader = new FileReader();
  reader.onload = (e) => { 
    userImage.value = e.target?.result as string; 
    tryOnResult.value = null; 
  };
  reader.readAsDataURL(file);
};

const toggleColor = (color: BangMau) => {
  selectedColor.value = selectedColor.value?.ma_mau === color.ma_mau ? null : color;
};


const closeModal = () => {
  showModalTryOn.value = false;

};

// --- METHODS API SETTINGS ---
const showApiKeyHelp = () => {
  Swal.fire({
    title: 'Cách lấy LightX API Key',
    html: `<div style="text-align: left; padding: 1em;">
              <ol>
                <li>Đăng ký hoặc đăng nhập vào tài khoản LightX tại <a href="https://www.lightxeditor.com/" target="_blank">trang chủ LightX</a>.</li>
                <li>Điều hướng đến phần API hoặc cài đặt tài khoản của bạn.</li>
                <li>Tạo một API Key mới hoặc sao chép một API Key hiện có.</li>
                <li>Dán API Key của bạn vào đây.</li>
              </ol>
            </div>`,
    icon: 'info', 
    confirmButtonText: 'Đã hiểu', 
    confirmButtonColor: '#C79B48'
  });
};

const saveApiSettings = () => {
  apiKey.value = tempApiKey.value;
  localStorage.setItem('hairAiApiKey', tempApiKey.value);
  showApiSettings.value = false;
  Toast.fire({ icon: 'success', title: 'Đã lưu API Key thành công' });
};

// --- METHODS THỰC THI AI VỚI BACKEND ---
const performTryOn = async () => {
  if (!apiKey.value) {
    Swal.fire({
      icon: 'warning', 
      title: 'Thiếu API Key', 
      text: 'Vui lòng cài đặt API Key để sử dụng AI.',
      showCancelButton: true, 
      confirmButtonText: 'Cài đặt ngay', 
      cancelButtonText: 'Để sau', 
      confirmButtonColor: '#C79B48'
    }).then((result) => { if (result.isConfirmed) showApiSettings.value = true; });
    return;
  }

  if (!userImageFile.value || !selectedStyle.value) {
    Toast.fire({ icon: 'error', title: 'Vui lòng tải ảnh khuôn mặt và chọn kiểu tóc!' });
    return;
  }

  isLoading.value = true; 
  tryOnResult.value = null;

  try {
    // SỬ DỤNG FORMDATA
    const formData = new FormData();
    formData.append('ApiKey', apiKey.value);
    formData.append('UserImage', userImageFile.value); // Ném thẳng cái File vào đây!
    formData.append('MaKT', selectedStyle.value.ma_kt);
    
    if (selectedColor.value) {
      formData.append('MaMau', selectedColor.value.ma_mau);
    }

    const response = await axios.post(API_HAIR_TRYON_PROCESS, formData, {
      headers: {
        'Content-Type': 'multipart/form-data' // Báo cho Backend biết đang gửi Form chứa File
      }
    });

    if (response.data && response.data.success) {
      tryOnResult.value = response.data.finalImageUrl;
      
      // Khoe luôn cái Prompt mà AI Gemini nghĩ ra trong Console để bạn dễ debug
      console.log("🔥 Gemini Prompt đã dùng:", response.data.aiPromptUsed);
      
      Toast.fire({ icon: 'success', title: 'Phân tích và ghép tóc thành công!' });
    } else {
      throw new Error(response.data.message || 'Hệ thống AI không phản hồi kết quả hợp lệ.');
    }
  } catch (error: any) {
    console.error('Lỗi khi gọi API thử tóc:', error);
    const errorMsg = error.response?.data?.message || error.message || 'Lỗi kết nối đến máy chủ AI.';
    Toast.fire({ icon: 'error', title: `Thử tóc thất bại: ${errorMsg}` });
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div>
    <button class="btn-open-tryon" @click="showModalTryOn = !showModalTryOn" title="Thử tóc với AI">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" width="24" height="24">
        <path d="M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z"/>
      </svg>
    </button>

    <transition name="modal-fade">
      <div v-if="showModalTryOn" class="modal-overlay">
        <div class="tryon-modal">
          
          <div class="modal-header">
            <div class="header-title">
              <h2> Thử Tóc Ảo AI</h2>
              <p>Khám phá kiểu tóc hoàn hảo dành riêng cho bạn</p>
            </div>
            <div class="header-actions">
              <button class="btn-icon-header" @click="showApiSettings = true" title="Cài đặt API Key">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
              </button>
              <button class="btn-icon-header close" @click="closeModal" title="Đóng">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div class="modal-body">
            
            <div v-if="isLoading" class="loading-overlay">
              <div class="spinner-large"></div>
              <span class="loading-text">AI đang phân tích và ghép tóc...</span>
              <span class="loading-subtext">Quá trình này có thể mất vài giây</span>
            </div>

            <div class="tryon-container">
              
              <div class="tryon-sidebar">
                
                <div class="selection-section">
                  <h5>1. Khuôn mặt của bạn</h5>
                  <div class="upload-area" @click="triggerFileInput">
                    <img v-if="userImage" :src="userImage" alt="Khuôn mặt của bạn" class="user-preview-img full-image" />
                    <div v-else class="upload-placeholder">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="36" height="36">
                        <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
                        <path d="M12 12v9" />
                        <path d="m16 16-4-4-4 4" />
                      </svg>
                      <span>Tải ảnh khuôn mặt</span>
                      <small>Cam kết không lưu trữ ảnh (Quyền riêng tư)</small>
                    </div>
                  </div>
                  <input 
                    ref="fileInputRef" 
                    type="file" 
                    accept="image/jpeg, image/png" 
                    class="hidden-input" 
                    @change="handleFileUpload" 
                  />
                </div>

                <div class="selection-section">
                  <h5>2. Chọn màu nhuộm (Tùy chọn)</h5>
                  <div class="color-list">
                    <button 
                      v-for="color in colors" 
                      :key="color.ma_mau"
                      @click="toggleColor(color)"
                      :class="['color-btn', selectedColor?.ma_mau === color.ma_mau ? 'selected' : '']"
                      :title="color.ten_mau"
                    >
                      <span class="color-circle" :style="{ backgroundColor: color.ma_mau.startsWith('#') ? color.ma_mau : '#555' }"></span>
                      <span class="color-name">{{ color.ten_mau }}</span>
                    </button>
                  </div>
                </div>

                <div class="selection-section flex-1">
                  <h5>3. Chọn kiểu tóc</h5>
                  <div class="style-list">
                    <div 
                      v-for="style in hairstyles" 
                      :key="style.ma_kt"
                      @click="selectedStyle = style"
                      :class="['item-card style-card', selectedStyle?.ma_kt === style.ma_kt ? 'selected' : '']"
                    >
                      <img v-if="style.hinh_anh" :src="style.hinh_anh" :alt="style.ten_kieu_toc" class="item-thumbnail" />
                      <div v-else class="placeholder-thumbnail">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28">
                          <circle cx="6" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <line x1="20" x2="8.12" y1="4" y2="15.88" />
                          <line x1="14.47" x2="20" y1="14.48" y2="20" />
                          <line x1="8.12" x2="12" y1="8.12" y2="12" />
                        </svg>
                      </div>
                      <span class="style-name">{{ style.ten_kieu_toc }}</span>
                      
                      <span v-if="style.mo_ta" class="style-desc">{{ style.mo_ta }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div class="tryon-main-content">
                
                <div v-if="tryOnResult" class="result-display-area">
                  <div class="image-wrapper">
                    <img :src="tryOnResult" alt="Kết quả thử tóc" class="result-image full-image" />
                  </div>
                </div>
                
                <div v-else class="placeholder-main">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="70" height="70">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 0 0-16 0" />
                  </svg>
                  <span>Kết quả thử tóc AI sẽ xuất hiện tại đây</span>
                </div>

                <div class="main-content-footer">
                  <button 
                    class="btn-tryon-action" 
                    @click="performTryOn"
                    :disabled="!userImage || !selectedStyle || isLoading"
                  >
                    <svg v-if="isLoading" class="icon-spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" fill="currentColor" width="18" height="18">
                      <path d="M234.7 42.7L197 56.8c-3 1.1-5 4-5 7.2s2 6.1 5 7.2l37.7 14.1L248.8 123c1.1 3 4 5 7.2 5s6.1-2 7.2-5l14.1-37.7L315 71.2c3-1.1 5-4 5-7.2s-2-6.1-5-7.2L277.3 42.7 263.2 5c-1.1-3-4-5-7.2-5s-6.1 2-7.2 5L234.7 42.7zM46.1 395.4c-18.7 18.7-18.7 49.1 0 67.9l34.6 34.6c18.7 18.7 49.1 18.7 67.9 0L529.9 116.5c18.7-18.7 18.7-49.1 0-67.9L495.3 14.1c-18.7-18.7-49.1-18.7-67.9 0L46.1 395.4zM484.6 82.6l-105 105-23.3-23.3 105-105 23.3 23.3zM7.5 117.2C3 118.9 0 123.2 0 128s3 9.1 7.5 10.8L64 160l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L128 160l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L128 96 106.8 39.5C105.1 35 100.8 32 96 32s-9.1 3-10.8 7.5L64 96 7.5 117.2zm352 256c-4.5 1.7-7.5 6-7.5 10.8s3 9.1 7.5 10.8L416 416l21.2 56.5c1.7 4.5 6 7.5 10.8 7.5s9.1-3 10.8-7.5L480 416l56.5-21.2c4.5-1.7 7.5-6 7.5-10.8s-3-9.1-7.5-10.8L480 352l-21.2-56.5c-1.7-4.5-6-7.5-10.8-7.5s-9.1 3-10.8 7.5L416 352l-56.5 21.2z"/>
                    </svg>
                    {{ tryOnResult ? 'Thử Kiểu Khác' : 'Ghép thử' }}
                  </button>
                </div>

              </div>

            </div>
          </div>
        </div>

        <transition name="modal-fade">
          <div v-if="showApiSettings" class="api-settings-overlay">
            <div class="api-settings-modal">
              <h3>Cài đặt Hair AI API Key</h3>
              <p class="api-desc">Vui lòng nhập API Key của LightX để sử dụng tính năng này.</p>
              
              <div class="form-group">
                <label for="aiApiKey">
                  Secret API Key
                  <svg class="help-icon" @click="showApiKeyHelp" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                    <title>Hướng dẫn</title>
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </label>
                <input
                  type="password"
                  id="aiApiKey"
                  v-model="tempApiKey"
                  class="form-control"
                  placeholder="Nhập API Key ở đây"
                />
              </div>

              <div class="api-settings-actions">
                <button class="btn-cancel" @click="showApiSettings = false">Hủy</button>
                <button class="btn-save" @click="saveApiSettings">Lưu Cài Đặt</button>
              </div>
            </div>
          </div>
        </transition>

      </div>
    </transition>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');

* { font-family: 'Montserrat', sans-serif; box-sizing: border-box; }

.icon-spin { animation: spin 1s linear infinite; }

:root {
  --color-gold: #C79B48;
  --color-gold-hover: #A67B27;
  --color-black: #1A1A1A;
  --color-bg-light: #F9FAFB;
  --color-border: #E5E7EB;
}

/* Thêm thuộc tính flex-1 thiếu sót */
.flex-1 { flex: 1; }

/* SỬA LẠI THÀNH NÚT TRÒN NHỎ GỌN */
.btn-open-tryon {
  /* Mobile mặc định: chatbot bottom-5 right-5 (20px,20px), nút chatbot 56px -> tâm right = 20+28=48 */
  position: fixed;
  bottom: 88px; 
  right: 20px;  
  z-index: 90; 
  width: 56px;  /* Chiều rộng cố định */
  height: 56px; /* Chiều cao cố định */
  background: linear-gradient(135deg, var(--color-gold), #e8c37c); 
  color: var(--color-gold) ; 
  border: 1px solid rgb(218, 211, 19); 
  border-radius: 50%; /* Ép thành hình tròn xoe */
  font-size: 22px; /* Phóng to icon lên chút cho cân đối */
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(12, 8, 0, 0.4); 
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center; /* Căn giữa icon */
  animation: pulse-gold 2s infinite; 
  background-color: #fffdfd;
}

/* sm: từ 640px - chatbot: bottom-6 right-6 (24px,24px), nút vẫn 56px (md:h-16 chỉ áp từ 768px) -> tâm right = 24+28=52 */
@media (min-width: 640px) {
  .btn-open-tryon {
    bottom: 92px;
    right: 24px;
  }
}

/* md: từ 768px - chatbot đổi nút thành 64px (md:h-16 md:w-16), right vẫn 24px -> tâm right = 24+32=56 */
@media (min-width: 768px) {
  .btn-open-tryon {
    bottom: 96px;
    right: 28px;
  }
}

/* lg: từ 1024px - chatbot: bottom-10 right-12 (40px,48px), nút 64px -> tâm right = 48+32=80 -> tryon right = 80-28=52 */
@media (min-width: 1024px) {
  .btn-open-tryon {
    bottom: 116px;
    right: 52px;
  }
}

.btn-open-tryon:hover { 
  background: var(--color-gold-hover); 
  transform: translateY(-3px) scale(1.1); /* Hover thì nảy lên và to ra xíu */
  box-shadow: 0 6px 20px rgba(199, 155, 72, 0.6);
  animation: none; 
}
/* KEYFRAME CHO HIỆU ỨNG TỎA SÁNG */
@keyframes pulse-gold {
  0% { box-shadow: 0 0 0 0 rgba(199, 155, 72, 0.6); }
  70% { box-shadow: 0 0 0 15px rgba(199, 155, 72, 0); }
  100% { box-shadow: 0 0 0 0 rgba(199, 155, 72, 0); }
}

.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.75); z-index: 9999;
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  padding: 20px;
}

.tryon-modal {
  background: #FFFFFF; border-radius: 16px;
  width: 100%; max-width: 1200px; 
  height: 90vh; max-height: 850px;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 10px 50px rgba(0, 0, 0, 0.3);
}

.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.3s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: translateY(20px); }

.modal-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 20px 24px; border-bottom: 1px solid var(--color-border);
  background: #fff; z-index: 2;
}
.header-title h2 { margin: 0; font-size: 22px; font-weight: 700; color: var(--color-gold); }
.header-title p { margin: 4px 0 0; font-size: 14px; color: #666; }
.header-actions { display: flex; gap: 12px; }
.btn-icon-header { background: none; border: none; font-size: 22px; color: #666; cursor: pointer; transition: 0.2s; }
.btn-icon-header:hover { color: var(--color-gold); }
.btn-icon-header.close:hover { color: #dc3545; }

.modal-body { flex: 1; position: relative; overflow: hidden; }

.tryon-container { display: flex; height: 100%; flex-direction: row; }

/* --- SIDEBAR --- */
.tryon-sidebar {
  width: 380px; min-width: 380px; background: #FFFFFF; border-right: 1px solid var(--color-border);
  display: flex; flex-direction: column; padding: 20px; gap: 24px; overflow-y: auto;
}
.selection-section { display: flex; flex-direction: column; }
.selection-section h5 { margin: 0 0 12px 0; font-size: 15px; font-weight: 600; color: var(--color-black); }

.upload-area {
  border: 2px dashed #CCC; border-radius: 12px; height: 220px; 
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; background: var(--color-bg-light); transition: 0.2s;
  overflow: hidden; text-align: center; position: relative;
}
.upload-area:hover { border-color: var(--color-gold); background: #FFF; }

.full-image {
  width: 100%; height: 100%; object-fit: contain; background-color: #F0F0F0; 
}

.upload-placeholder svg { color: var(--color-gold); margin-bottom: 8px; }
.upload-placeholder span { display: block; font-weight: 600; font-size: 15px; color: #333; }
.upload-placeholder small { font-size: 12px; color: #28a745; margin-top: 4px; display: block; }
.hidden-input { display: none; }

.color-list { display: flex; flex-wrap: wrap; gap: 12px; }
.color-btn {
  background: none; border: none; padding: 4px; cursor: pointer;
  display: flex; flex-direction: column; align-items: center; gap: 4px; border-radius: 8px;
}
.color-circle { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #FFF; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: 0.2s; }
.color-btn.selected .color-circle { transform: scale(1.2); border-color: var(--color-gold); }
.color-name { font-size: 12px; color: #666; font-weight: 500;}
.color-btn.selected .color-name { font-weight: 700; color: var(--color-gold); }

.style-list { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* CSS CARD KIỂU TÓC */
.item-card {
  border: 1px solid var(--color-border); border-radius: 10px; padding: 8px;
  cursor: pointer; text-align: center; transition: 0.2s; background: #FFF;
  display: flex; flex-direction: column; align-items: center;
}
.item-card:hover { border-color: var(--color-gold); box-shadow: 0 4px 8px rgba(199, 155, 72, 0.1); }
.item-card.selected { border-color: var(--color-gold); background: #FFFDF8; border-width: 2px; }
.item-thumbnail { width: 100%; height: 100px; object-fit: cover; border-radius: 6px; margin-bottom: 8px; }
.placeholder-thumbnail { width: 100%; height: 100px; background: #EEE; border-radius: 6px; margin-bottom: 8px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 28px; }

/* CSS TIÊU ĐỀ & MÔ TẢ KIỂU TÓC */
.style-name { font-size: 13px; font-weight: 600; color: #333; margin-bottom: 4px; width: 100%; }
.style-desc { 
  font-size: 11px; 
  color: #777; 
  display: -webkit-box; 
  -webkit-line-clamp: 2; 
  -webkit-box-orient: vertical; 
  overflow: hidden; 
  line-height: 1.4;
  width: 100%;
}

/* --- MAIN CONTENT --- */
.tryon-main-content {
  flex: 1; background: var(--color-bg-light); padding: 24px;
  display: flex; flex-direction: column; position: relative; overflow-y: auto;
}

.placeholder-main { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #999; min-height: 300px;}
.placeholder-main svg { opacity: 0.3; margin-bottom: 16px; }
.placeholder-main span { font-size: 18px; font-weight: 500; text-align: center;}

.result-display-area {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 20px;
  width: 100%; justify-content: flex-start;
}
.image-wrapper { 
  position: relative; width: 100%; max-width: 550px; 
  flex: 1; min-height: 300px; 
  border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); overflow: hidden; 
  background-color: #EFEFEF;
}

.main-content-footer {
  margin-top: auto; display: flex; justify-content: flex-end; padding-top: 20px; border-top: 1px solid var(--color-border);
}

.btn-tryon-action {
  background: var(--color-black); color: #FFF; border: none; border-radius: 8px;
  padding: 16px 32px; font-weight: 600; font-size: 16px; cursor: pointer; transition: 0.2s;
  display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); width: fit-content;
}
.btn-tryon-action:hover:not(:disabled) { background: var(--color-gold); transform: translateY(-2px); color: black;}
.btn-tryon-action:disabled { opacity: 0.5; cursor: not-allowed; }

/* --- TRẠNG THÁI LOADING --- */
.loading-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(255, 255, 255, 0.85); z-index: 10;
  display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(3px);
}
.spinner-large {
  width: 60px; height: 60px; border: 4px solid #F3F3F3; border-top: 4px solid var(--color-gold);
  border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;
}
.loading-text { font-size: 18px; font-weight: 600; color: var(--color-black); margin-bottom: 6px; }
.loading-subtext { font-size: 14px; color: #666; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

/* --- CÀI ĐẶT API KEY --- */
.api-settings-overlay {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6); z-index: 20;
  display: flex; align-items: center; justify-content: center;
}
.api-settings-modal {
  background: #FFF; padding: 24px; border-radius: 12px; width: 90%; max-width: 450px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
}
.api-settings-modal h3 { margin: 0 0 8px 0; font-size: 20px; color: var(--color-gold); }
.api-desc { font-size: 14px; color: #666; margin-bottom: 20px; }
.form-group label { display: block; font-size: 14px; font-weight: 600; margin-bottom: 8px; color: #333; }
.help-icon { color: #17a2b8; cursor: pointer; margin-left: 6px; font-size: 16px; }
.form-control {
  width: 100%; padding: 12px; border: 1px solid #CCC; border-radius: 8px;
  font-size: 15px; margin-bottom: 24px; outline: none; transition: 0.2s;
}
.form-control:focus { border-color: var(--color-gold); box-shadow: 0 0 0 2px rgba(199, 155, 72, 0.2); }
.api-settings-actions { display: flex; justify-content: flex-end; gap: 12px; }
.btn-cancel { background: #EAEAEA; color: #333; border: none; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; }
.btn-save { background: var(--color-gold); color: #000000; border: 2px solid rgb(193, 193, 193); padding: 12px 20px; border-radius: 8px; cursor: pointer; font-weight: 600; transition: 0.2s; }
.btn-save:hover { background: var(--color-gold-hover); }

@media (max-width: 992px) {
  .tryon-modal { height: 95vh; }
  .tryon-container { flex-direction: column; overflow-y: auto; }
  .tryon-sidebar { width: 100%; min-width: 100%; border-right: none; border-bottom: 1px solid var(--color-border); height: auto; overflow-y: visible; }
  .tryon-main-content { padding: 20px; height: auto; min-height: 500px; }
  .image-wrapper { max-width: 100%; min-height: 350px; }
  .main-content-footer { justify-content: center; margin-top: 30px; }
  .btn-tryon-action { width: 100%; justify-content: center; }
}
</style>