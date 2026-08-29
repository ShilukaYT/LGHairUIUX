<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { CheckCircle, AlertCircle, X } from 'lucide-vue-next';
import axios from 'axios';
import { syncCartAfterLoginDB } from '@/Views/Anonymous/CSDL/cartDB';
import { useAuthStore } from '@/stores/useAuthStore';

const route = useRoute();
const authStore = useAuthStore();


const isLogin = ref(true);
const isForgotPassword = ref(false);
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const googleBtnWidth = ref(280);
const formWidthRef = ref<HTMLElement | null>(null);

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'


const updateGoogleBtnWidth = () => {
  const windowWidth = window.innerWidth;
  if (formWidthRef.value && formWidthRef.value.clientWidth > 0) {
    const padding = windowWidth < 640 ? 32 : 64;
    const availableWidth = formWidthRef.value.clientWidth - padding;
    googleBtnWidth.value = windowWidth < 640
      ? Math.max(200, Math.min(availableWidth, 250))
      : Math.max(200, Math.min(availableWidth, 360));
  } else {
    googleBtnWidth.value = windowWidth < 640 ? 240 : 340;
  }
};

onUnmounted(() => {
  window.removeEventListener('resize', updateGoogleBtnWidth);
});
const registerForm = reactive({
  hoTen: '',
  sdt: '',
  email: '',
  matKhau: '',
  xacNhanMatKhau: '',
  terms: false
});

const showOtpModal = ref(false);
const otpInput = ref('');

const modal = reactive({
  show: false,
  title: '',
  message: '',
  type: 'error' as 'error' | 'success'
});


const forgotForm = reactive({
  email: '',
  otp: '',
  newPassword: '',
  confirmNewPassword: '',
  step: 1,
  isGoogleVerified: false
});

const showStatus = (title: string, message: string, type: 'error' | 'success' = 'error') => {
  modal.title = title;
  modal.message = message;
  modal.type = type;
  modal.show = true;
};

const resetAllForms = () => {
  // Reset Login
  username.value = '';
  password.value = '';

  // Reset Register
  registerForm.hoTen = '';
  registerForm.sdt = '';
  registerForm.email = '';
  registerForm.matKhau = '';
  registerForm.xacNhanMatKhau = '';
  registerForm.terms = false;

  // Reset Forgot Password
  forgotForm.email = '';
  forgotForm.otp = '';
  forgotForm.newPassword = '';
  forgotForm.confirmNewPassword = '';
  forgotForm.step = 1;
  forgotForm.isGoogleVerified = false;

  otpInput.value = '';
};

import { watch } from 'vue';

watch([isLogin, isForgotPassword], () => {
  resetAllForms();
});

const closeModal = () => {
  modal.show = false;
};

// Lắng nghe phím Enter / Escape để đóng popup thông báo
const handleKeydown = (e: KeyboardEvent) => {
  if (modal.show && (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ')) {
    e.preventDefault();
    e.stopPropagation();
    closeModal();
  }
};

const handleLogin = async () => {
  // Nếu modal lỗi/thông báo đang mở, ấn Enter chỉ đóng modal
  if (modal.show) {
    closeModal();
    return;
  }

  if (!username.value || !password.value) {
    showStatus("Thông báo", "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.", "error");
    return;
  }
  isLoading.value = true;

  try {
    const response = await axios.post(API + '/api/account/login', {
      username: username.value,
      password: password.value,
      rememberMe: true
    });

    if (response.data.success) {
      // ✅ Lưu thông tin user và JWT token
      localStorage.setItem('user', JSON.stringify(response.data.user));
      const token = response.data.token ?? response.data.accessToken ?? response.data.user?.token ?? '';
      localStorage.setItem('token', token);
      localStorage.setItem('accessToken', token);
      const rfToken = response.data.refreshToken ?? response.data.user?.refreshToken ?? '';
      if (rfToken) {
        localStorage.setItem('refreshToken', rfToken);
      }
      authStore.setSessionExpiredBanner(false);

      showStatus("Thành công", "Đăng nhập hệ thống thành công!", "success");

      // ✅ Đồng bộ giỏ hàng Guest → User trước khi chuyển trang
      try {
        await syncCartAfterLoginDB();
      } catch (syncErr) {
        console.warn("Đồng bộ giỏ hàng thất bại (không nghiêm trọng):", syncErr);
      }

      setTimeout(() => {
        const redirectPath = (route.query.redirect as string) || '/';
        window.location.href = redirectPath;
      }, 1000);
    }
  } catch (err: any) {
    const serverMessage = err.response?.data?.message || "Thông tin tài khoản không chính xác.";
    if (serverMessage.toLowerCase().includes("khóa") || serverMessage.toLowerCase().includes("bị khoá")) {
      // Dùng store toàn cục để hiện modal khóa tài khoản (App.vue)
      authStore.triggerLockedAccount();
    } else {
      showStatus("Đăng nhập thất bại", serverMessage, "error");
    }
  } finally {
    isLoading.value = false;
  }
};

const submitRegistration = async (otpCode: string) => {
  isLoading.value = true;
  try {
    const response = await axios.post(API + '/api/account/register', {
      hoTen: registerForm.hoTen,
      sdt: registerForm.sdt,
      email: registerForm.email,
      matKhau: registerForm.matKhau,
      otp: otpCode
    });

    if (response.data.success) {
      showOtpModal.value = false;
      const regToken = response.data.accessToken ?? response.data.token ?? response.data.user?.token ?? '';
      localStorage.setItem('accessToken', regToken);
      localStorage.setItem('token', regToken);
      const regRfToken = response.data.refreshToken ?? response.data.user?.refreshToken ?? '';
      if (regRfToken) {
        localStorage.setItem('refreshToken', regRfToken);
      }
      localStorage.setItem('user', JSON.stringify(response.data.user));
      authStore.setSessionExpiredBanner(false);
      showStatus("Chào mừng gia nhập!", "Bạn đã đăng ký thành công. Hệ thống đang tự động đăng nhập...", "success");
      setTimeout(() => {
        const redirectPath = (route.query.redirect as string) || '/';
        window.location.href = redirectPath;
      }, 2000);
    }
  } catch (error: any) {
    showStatus("Đăng ký thất bại", error.response?.data?.message || 'Lỗi đăng ký tài khoản.', "error");
  } finally {
    isLoading.value = false;
  }
};

const handleRegister = async () => {
  // 1. Logic Validate
  const nameRegex = /^[\p{L}\s]+$/u;
  const phoneRegex = /^(03|05|07|08|09)\d{8}$/;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

  if (!registerForm.hoTen || !registerForm.sdt || !registerForm.matKhau || !registerForm.xacNhanMatKhau) {
    showStatus("Thông báo", "Vui lòng nhập đầy đủ các thông tin bắt buộc (*).", "error");
    return;
  }
  if (!nameRegex.test(registerForm.hoTen)) {
    showStatus("Lỗi", "Họ tên không được chứa số hoặc ký tự đặc biệt.", "error");
    return;
  }
  if (!phoneRegex.test(registerForm.sdt)) {
    showStatus("Lỗi", "Số điện thoại không hợp lệ (phải bắt đầu bằng 03, 05, 07, 08, 09 và gồm 10 chữ số).", "error");
    return;
  }
  if (registerForm.email) {
    if (registerForm.email.length > 100) {
      showStatus("Lỗi", "Email không được vượt quá 100 ký tự.", "error");
      return;
    }
    if (!emailRegex.test(registerForm.email)) {
      showStatus("Lỗi", "Định dạng Email không hợp lệ.", "error");
      return;
    }
  }
  if (!passwordRegex.test(registerForm.matKhau)) {
    showStatus("Lỗi", "Mật khẩu phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số.", "error");
    return;
  }
  if (registerForm.matKhau !== registerForm.xacNhanMatKhau) {
    showStatus("Lỗi", "Mật khẩu xác nhận không trùng khớp.", "error");
    return;
  }
  if (!registerForm.terms) {
    showStatus("Thông báo", "Bạn cần đồng ý với điều khoản dịch vụ để tiếp tục.", "error");
    return;
  }

  // 2. Nếu có Email thì gửi mã OTP và mở Modal, nếu không thì đăng ký luôn
  if (registerForm.email) {
    isLoading.value = true;
    try {
      const response = await axios.post(API + '/api/account/send-register-otp', `"${registerForm.email}"`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.data.success) {
        otpInput.value = '';
        showOtpModal.value = true;
      }
    } catch (error: any) {
      showStatus("Lỗi", error.response?.data?.message || "Email đã tồn tại hoặc lỗi gửi mã.", "error");
    } finally {
      isLoading.value = false;
    }
  } else {
    await submitRegistration('');
  }
};

const handleGoogleLogin = async (response: any) => {
  try {
    const res = await axios.post(API + '/api/account/google-login', {
      credential: response.credential
    });

    if (res.data.success) {
      const user = res.data.user || res.data;
      const ggToken = res.data.token ?? res.data.accessToken ?? user?.token ?? '';
      const ggRfToken = res.data.refreshToken ?? user?.refreshToken ?? '';
      localStorage.setItem('user', JSON.stringify(user));
      if (ggToken) {
        localStorage.setItem('token', ggToken);
        localStorage.setItem('accessToken', ggToken);
      }
      if (ggRfToken) {
        localStorage.setItem('refreshToken', ggRfToken);
      }
      authStore.setSessionExpiredBanner(false);
      const redirectPath = (route.query.redirect as string) || '/';
      window.location.href = redirectPath;
    }
  } catch (error) {
    console.error("Lỗi Google Login", error);
  }
};

onMounted(() => {
  updateGoogleBtnWidth();
  window.addEventListener('resize', updateGoogleBtnWidth);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateGoogleBtnWidth);
  window.removeEventListener('keydown', handleKeydown);
});

const handleSendOTP = async () => {
  if (!forgotForm.email) {
    showStatus("Thông báo", "Vui lòng nhập Email để nhận mã xác nhận.", "error");
    return;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(forgotForm.email)) {
    showStatus("Lỗi", "Định dạng Email không hợp lệ.", "error");
    return;
  }

  isLoading.value = true;
  try {
    const response = await axios.post(API + '/api/account/send-otp', `"${forgotForm.email}"`, {
      headers: { 'Content-Type': 'application/json' }
    });
    if (response.data.success) {
      forgotForm.step = 2;
      showStatus("Thành công", "Mã xác nhận đã được gửi vào Email của bạn.", "success");
    }
  } catch (error: any) {
    showStatus("Lỗi", error.response?.data?.message || "Email không tồn tại hoặc lỗi hệ thống.", "error");
  } finally {
    isLoading.value = false;
  }
};

const handleResetPassword = async () => {
  if ((!forgotForm.isGoogleVerified && !forgotForm.otp) || !forgotForm.newPassword || !forgotForm.confirmNewPassword) {
    showStatus("Thông báo", "Vui lòng nhập đầy đủ thông tin yêu cầu.", "error");
    return;
  }

  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;
  if (!passwordRegex.test(forgotForm.newPassword)) {
    showStatus("Lỗi", "Mật khẩu mới phải có ít nhất 6 ký tự, bao gồm cả chữ cái và số.", "error");
    return;
  }
  if (forgotForm.newPassword !== forgotForm.confirmNewPassword) {
    showStatus("Lỗi", "Mật khẩu xác nhận không trùng khớp.", "error");
    return;
  }

  isLoading.value = true;
  try {
    const response = await axios.post(API + '/api/account/reset-password', {
      email: forgotForm.email,
      otp: forgotForm.isGoogleVerified ? "" : forgotForm.otp,
      newPassword: forgotForm.newPassword
    });
    if (response.data.success) {
      showStatus("Thành công", "Đổi mật khẩu thành công! Vui lòng đăng nhập lại.", "success");
      isForgotPassword.value = false;
      forgotForm.step = 1;
      forgotForm.isGoogleVerified = false;
    }
  } catch (error: any) {
    showStatus("Lỗi", error.response?.data?.message || "Mã OTP không đúng hoặc đã hết hạn.", "error");
  } finally {
    isLoading.value = false;
  }
};

const handleGoogleVerify = async (response: any) => {
  isLoading.value = true;
  try {
    const res = await axios.post(API + '/api/account/forgot-password-google', {
      credential: response.credential
    });
    if (res.data.success) {
      forgotForm.email = res.data.email;
      forgotForm.isGoogleVerified = true;
      forgotForm.otp = '';
      forgotForm.step = 2; // Nhảy qua bước nhập mật khẩu mới
      showStatus("Xác minh thành công", "Vui lòng nhập mật khẩu mới.", "success");
    }
  } catch (err: any) {
    showStatus("Lỗi", err.response?.data?.message || "Xác thực Google thất bại.", "error");
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div
    class="w-full animate-in fade-in duration-500 min-h-screen bg-[#f8f8f8] py-16 sm:py-24 px-4 sm:px-6 flex items-center justify-center">
    <div ref="formWidthRef" class="w-full max-w-[500px] bg-white border border-gray-200 p-6 sm:p-8 md:p-16">
      <div class="text-center mb-12">
        <h1 class="text-2xl md:text-3xl font-heading uppercase tracking-[0.2em] font-light mb-4">
          <template v-if="isForgotPassword">Khôi Phục Mật Khẩu</template>
          <template v-else>{{ isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản' }}</template>
        </h1>
        <p class="text-gray-500 font-light text-sm">
          <template v-if="isForgotPassword">Nhập email để nhận mã xác nhận (OTP).</template>
          <template v-else>{{ isLogin ? 'Quản lý lịch hẹn và lịch sử mua hàng của bạn.' : 'Đăng ký để đặt lịch hẹn và mua sắm dễ dàng hơn.' }}</template>
        </p>
      </div>

      <!-- Form Quên Mật Khẩu -->
      <form v-if="isForgotPassword" class="space-y-6" @submit.prevent>
        <div v-if="forgotForm.step === 1" class="flex flex-col space-y-4">
          <div class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Xác minh nhanh bằng Mạng xã
              hội</label>
            <div class="flex flex-col space-y-3">
              <div class="flex justify-center h-[40px]">
                <GoogleLogin :key="googleBtnWidth" :callback="handleGoogleVerify"
                  :button-config="{ width: googleBtnWidth, shape: 'rectangular' }" />
              </div>
            </div>

            <div class="relative flex items-center py-4 mt-2">
              <div class="flex-grow border-t border-gray-200"></div>
              <span class="flex-shrink-0 mx-4 text-gray-400 text-[10px] tracking-widest uppercase">Hoặc dùng
                Email</span>
              <div class="flex-grow border-t border-gray-200"></div>
            </div>

            <label class="text-[10px] uppercase tracking-widest text-gray-500">Email của bạn</label>
            <input type="email" v-model="forgotForm.email"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập email đã đăng ký..." />
          </div>
          <button type="button" @click="handleSendOTP" :disabled="isLoading"
            class="w-full bg-black text-white px-10 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors disabled:opacity-50">
            <span v-if="isLoading">ĐANG GỬI...</span>
            <span v-else>GỬI MÃ XÁC NHẬN</span>
          </button>
        </div>

        <div v-else class="flex flex-col space-y-4">
          <div v-if="!forgotForm.isGoogleVerified" class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500">Mã xác nhận (OTP)</label>
            <input type="text" v-model="forgotForm.otp"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập mã 6 số từ email..." />
          </div>
          <div v-else class="bg-gray-50 border border-gray-200 p-4 text-center rounded-sm">
            <p class="text-[11px] uppercase tracking-widest text-gray-500">Đã xác minh Mạng Xã Hội</p>
            <p class="text-sm text-black mt-2 font-medium">{{ forgotForm.email }}</p>
          </div>

          <div class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500">Mật khẩu mới</label>
            <input type="password" v-model="forgotForm.newPassword"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập mật khẩu mới..." />
          </div>

          <div class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500">Xác nhận mật khẩu</label>
            <input type="password" v-model="forgotForm.confirmNewPassword"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập lại mật khẩu..." />
          </div>
          <button type="button" @click="handleResetPassword" :disabled="isLoading"
            class="w-full bg-black text-white px-10 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors disabled:opacity-50">
            <span v-if="isLoading">ĐANG XỬ LÝ...</span>
            <span v-else>ĐẶT LẠI MẬT KHẨU</span>
          </button>
        </div>

        <div class="text-center mt-4">
          <button type="button" @click="isForgotPassword = false"
            class="text-[10px] text-gray-400 hover:text-black transition-colors uppercase tracking-widest">
            Quay lại Đăng nhập
          </button>
        </div>
      </form>

      <form v-else class="space-y-6" @submit.prevent="isLogin ? handleLogin() : handleRegister()">

        <!-- Form Đăng Ký -->
        <template v-if="!isLogin">
          <div class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500">Họ và Tên *</label>
            <input type="text" v-model.trim="registerForm.hoTen"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập họ và tên của bạn..." />
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Số điện thoại *</label>
              <input type="text" v-model="registerForm.sdt" maxlength="10"
                @input="registerForm.sdt = registerForm.sdt.replace(/\D/g, '').slice(0, 10)"
                class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
                placeholder="Nhập số điện thoại..." />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Email (Tuỳ chọn)</label>
              <input type="email" v-model="registerForm.email"
                class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
                placeholder="Nhập email..." />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Mật khẩu *</label>
              <input type="password" v-model="registerForm.matKhau"
                class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
                placeholder="Nhập mật khẩu..." />
            </div>
            <div class="flex flex-col space-y-2">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Xác nhận mật khẩu *</label>
              <input type="password" v-model="registerForm.xacNhanMatKhau"
                class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
                placeholder="Nhập lại mật khẩu..." />
            </div>
          </div>

          <div class="flex items-center space-x-3 pt-2">
            <input type="checkbox" id="terms" v-model="registerForm.terms"
              class="w-4 h-4 text-black bg-white border-gray-300 rounded focus:ring-black accent-black cursor-pointer" />
            <label for="terms" class="text-[11px] text-gray-500 cursor-pointer">Tôi đồng ý với các điều khoản dịch
              vụ</label>
          </div>
        </template>

        <!-- Form Đăng Nhập -->
        <template v-else>
          <div class="flex flex-col space-y-2">
            <label class="text-[10px] uppercase tracking-widest text-gray-500">Email hoặc Số điện thoại</label>
            <input type="text" v-model="username"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập Email hoặc SĐT..." />
          </div>

          <div class="flex flex-col space-y-2">
            <div class="flex justify-between items-center">
              <label class="text-[10px] uppercase tracking-widest text-gray-500">Mật Khẩu</label>
              <!-- tab bỏ qua nút này -->
              <button type="button" @click="isForgotPassword = true"
                class="text-[10px] text-gray-400 hover:text-black transition-colors" tabindex="-1">Quên mật khẩu?</button> 
            </div>
            <input type="password" v-model="password"
              class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
              placeholder="Nhập mật khẩu..." />
          </div>
        </template>

        <div class="pt-6">
          <button type="submit" :disabled="isLoading"
            class="w-full bg-black text-white px-10 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors disabled:opacity-50">
            <span v-if="isLoading">ĐANG XỬ LÝ...</span>
            <span v-else>{{ isLogin ? 'Đăng Nhập' : 'Tạo Tài Khoản' }}</span>
          </button>
        </div>

        <div v-if="isLogin" class="mt-6">
          <div class="relative flex items-center mb-6">
            <div class="flex-grow border-t border-gray-200"></div>
            <span class="flex-shrink-0 mx-4 text-[10px] text-gray-400 uppercase tracking-widest">Hoặc đăng nhập bằng</span>
            <div class="flex-grow border-t border-gray-200"></div>
          </div>
          <div class="flex flex-col space-y-4">
            <div class="w-full flex justify-center h-[40px] overflow-hidden">
              <GoogleLogin :key="googleBtnWidth" :callback="handleGoogleLogin"
                :button-config="{ width: googleBtnWidth, shape: 'rectangular' }" />
            </div>
          </div>
        </div>
      </form>

      <div v-if="!isForgotPassword" class="mt-8 text-center border-t border-gray-100 pt-8">
        <button @click="isLogin = !isLogin"
          class="text-xs text-gray-500 hover:text-black transition-colors uppercase tracking-widest">
          {{ isLogin ? 'Chưa có tài khoản? Đăng Ký' : 'Đã có tài khoản? Đăng Nhập' }}
        </button>
      </div>
    </div>

    <!-- Modal Status -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="modal.show"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          @click.self="closeModal">
          <div class="bg-white w-full max-w-[420px] p-10 border border-gray-200 shadow-2xl relative text-center">
            <button @click="closeModal" class="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors">
              <X :size="20" :stroke-width="1.5" />
            </button>

            <div class="flex justify-center mb-6">
              <CheckCircle v-if="modal.type === 'success'" :size="48" class="text-green-600" :stroke-width="1.5" />
              <AlertCircle v-else :size="48" class="text-[#852121]" :stroke-width="1.5" />
            </div>

            <h3 class="text-xl font-heading uppercase tracking-[0.15em] font-medium text-black mb-3">{{ modal.title }}
            </h3>
            <p class="text-sm font-light text-gray-500 mb-8 leading-relaxed">{{ modal.message }}</p>

            <button @click="closeModal"
              class="w-full bg-black text-white px-8 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors">
              Đóng
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Modal Nhập OTP khi Đăng ký -->
    <Teleport to="body">
      <Transition enter-active-class="transition duration-300 ease-out" enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100" leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100 scale-100" leave-to-class="opacity-0 scale-95">
        <div v-if="showOtpModal"
          class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          @click.self="showOtpModal = false">
          <div class="bg-white w-full max-w-[420px] p-10 border border-gray-200 shadow-2xl relative text-center">
            <button @click="showOtpModal = false"
              class="absolute top-4 right-4 text-gray-400 hover:text-black transition-colors">
              <X :size="20" :stroke-width="1.5" />
            </button>

            <div class="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-6">
              <AlertCircle :size="24" class="text-blue-500" :stroke-width="1.5" />
            </div>

            <h3 class="text-xl font-heading font-light mb-2">Xác minh Email</h3>
            <p class="text-gray-500 text-sm mb-6 font-light">Mã xác nhận đã được gửi đến email <strong>{{
                registerForm.email
                }}</strong>. Vui lòng nhập mã để hoàn tất đăng ký.</p>

            <form @submit.prevent="submitRegistration(otpInput)" class="flex flex-col space-y-4 text-left">
              <div class="flex flex-col space-y-2">
                <label class="text-[10px] uppercase tracking-widest text-gray-500">Mã xác nhận (OTP)</label>
                <input type="text" v-model="otpInput"
                  class="w-full h-12 px-4 bg-transparent border border-gray-200 rounded-none focus:outline-none focus:border-black transition-colors text-sm font-light"
                  placeholder="Nhập mã 6 số..." />
              </div>
              <button type="submit" :disabled="isLoading || !otpInput"
                class="w-full bg-black text-white px-10 py-4 text-[11px] uppercase tracking-[0.2em] hover:bg-gray-800 transition-colors disabled:opacity-50 mt-2">
                {{ isLoading ? 'ĐANG XỬ LÝ...' : 'XÁC NHẬN ĐĂNG KÝ' }}
              </button>
            </form>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>