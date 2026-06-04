<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import Swal from 'sweetalert2'

const router = useRouter()
const email = ref('')
const password = ref('')
const isLoading = ref(false)
const errorMessage = ref('')
const showPassword = ref(false)

// Đổi port URL dưới đây cho khớp với Backend của bạn nếu cần
const API_URL = 'https://localhost:7196/api/admin/auth/login'

const handleLogin = async () => {
  isLoading.value = true
  errorMessage.value = ''

  try {
    // 1. Gọi API Đăng nhập
    const response = await axios.post(API_URL, {
      Username: email.value,   // Backend đang đợi biến Username
      Password: password.value // Backend đang đợi biến Password
    })

    if (response.data.success) {
      const { accessToken, user } = response.data

      // 2. Lưu Token và thông tin nhân viên vào sessionStorage
      sessionStorage.setItem('adminToken', accessToken)
      sessionStorage.setItem('adminUser', JSON.stringify(user))

      // 3. Kiểm tra Role và chuyển hướng
      if (user.maRole === 'R01') {
        // Nếu là Admin -> Chuyển vào Dashboard Quản trị
        router.push('/admin/Dashboard') 
      } else {
        // Nếu là Role khác (Ví dụ: Thợ cắt tóc, Thu ngân...) -> Chuyển vào trang Nhân viên
        router.push('/nhanvien') 
      }
    }
  } catch (error: any) {
    // Xử lý lỗi từ Backend trả về (Sai pass, tài khoản bị khóa...)
    let errorMsg = 'Không thể kết nối đến máy chủ. Vui lòng thử lại.'
    if (error.response && error.response.data) {
      errorMsg = error.response.data.message || 'Tài khoản hoặc mật khẩu không chính xác!'
    } else {
      errorMsg = 'Tài khoản hoặc mật khẩu không chính xác!'
    }
    
    // Hiển thị thông báo đăng nhập sai bằng SweetAlert2
    Swal.fire({
      icon: 'error',
      title: 'Đăng nhập thất bại',
      text: errorMsg,
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#ff7eb3'
    })
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="login-wrapper">
    <!-- Decorative background blobs -->
    <div class="blob-top"></div>
    <div class="blob-bottom-blue"></div>
    <div class="blob-bottom-yellow"></div>
    <div class="blob-bottom-cyan"></div>

    <!-- Top Navigation (simplified) -->
    <header class="login-header">
      <div class="logo">
        <img src="@/assets/images/IconApp.png" alt="Logo" class="logo-icon-img" />
        <span class="logo-text">LGHair</span>
      </div>
      <div class="nav-links">
        <router-link to="/">Về trang chủ</router-link>
      </div>
    </header>

    <!-- Centered Form -->
    <div class="login-container">
      <v-card elevation="10" class="pa-8 pa-md-12 rounded-xl bg-white" style="backdrop-filter: blur(10px); background-color: rgba(255, 255, 255, 0.85) !important;">
        <div class="login-header-text">
          <h1>Đăng nhập</h1>
          <div class="gradient-underline"></div>
          <p>Chào mừng trở lại! Đăng nhập để truy cập hệ thống quản trị.</p>
        </div>

        <v-form @submit.prevent="handleLogin" class="login-form">
          <v-text-field
            v-model="email"
            placeholder="Tên đăng nhập"
            variant="underlined"
            color="#ff7eb3"
            class="custom-input mb-4"
            required
          ></v-text-field>

          <v-text-field
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Mật khẩu"
            variant="underlined"
            color="#ff7eb3"
            class="custom-input mb-8"
            required
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            @click:append-inner="showPassword = !showPassword"
          ></v-text-field>

          <button type="submit" class="gradient-btn" :disabled="isLoading">
            <span v-if="isLoading" class="mdi mdi-loading mdi-spin mr-2"></span>
            ĐĂNG NHẬP
            <span class="mdi mdi-arrow-right ml-2 text-h6" style="margin-top:2px;"></span>
          </button>
        </v-form>
      </v-card>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.login-wrapper {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background-color: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: 'Inter', sans-serif;
}

/* Background Blobs */
.blob-top {
  position: absolute;
  top: -20%;
  right: -5%;
  width: 60%;
  height: 60%;
  background: linear-gradient(135deg, #ff7eb3 0%, #ff758c 40%, #8a2387 100%);
  border-radius: 40% 60% 30% 70% / 40% 40% 60% 60%;
  z-index: 0;
  transform: rotate(-10deg);
}

.blob-bottom-blue {
  position: absolute;
  bottom: -20%;
  right: -10%;
  width: 45vw;
  height: 45vw;
  max-width: 600px;
  max-height: 600px;
  background: linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%);
  border-radius: 50%;
  z-index: 0;
}

.blob-bottom-yellow {
  position: absolute;
  bottom: 10%;
  right: 15%;
  width: 15vw;
  height: 15vw;
  max-width: 200px;
  max-height: 200px;
  background: #ffca28;
  border-radius: 50%;
  z-index: 1;
  opacity: 0.9;
  mix-blend-mode: multiply; /* Tạo hiệu ứng giao thoa màu xanh lá khi đè lên xanh dương */
}

.blob-bottom-cyan {
  position: absolute;
  bottom: 12%;
  right: 8%;
  width: 4vw;
  height: 4vw;
  max-width: 60px;
  max-height: 60px;
  background: #00e5ff;
  border-radius: 50%;
  z-index: 1;
}

/* Header */
.login-header {
  position: relative;
  z-index: 10;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 30px 5vw;
}
.logo {
  display: flex;
  align-items: center;
  font-weight: 800;
  font-size: 24px;
  color: #2b3b5a;
  letter-spacing: -0.5px;
}
.logo-icon-img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  margin-right: 12px;
  border-radius: 8px;
}
.nav-links a {
  color: #ffffff;
  text-decoration: none;
  font-weight: 600;
  font-size: 15px;
  margin-left: 20px;
  transition: opacity 0.3s;
}
.nav-links a:hover {
  opacity: 0.8;
}

/* Responsive nav links color */
@media (max-width: 768px) {
  .nav-links a {
    color: #2b3b5a;
  }
}

/* Form Container */
.login-container {
  position: relative;
  z-index: 10;
  margin: auto;
  width: 100%;
  max-width: 480px;
  padding: 40px 20px;
  margin-top: 5vh;
}

.login-header-text {
  text-align: center;
  margin-bottom: 40px;
}
.login-header-text h1 {
  font-size: 38px;
  font-weight: 700;
  color: #4a5472;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}
.gradient-underline {
  width: 65px;
  height: 4px;
  background: linear-gradient(to right, #ffca28, #ff7eb3);
  margin: 0 auto 20px auto;
  border-radius: 4px;
}
.login-header-text p {
  color: #8c98a4;
  font-size: 15px;
  line-height: 1.6;
}
.forgot-link {
  color: #ff7eb3;
  text-decoration: none;
  font-weight: 600;
}
.forgot-link:hover {
  text-decoration: underline;
}

/* Form Inputs */
.custom-input :deep(.v-field__input) {
  font-family: 'Inter', sans-serif;
  color: #4a5472;
  font-weight: 500;
  padding-bottom: 10px;
  padding-left: 12px; /* Đẩy text vào trong 1 chút */
}
.custom-input :deep(.v-field__input::placeholder) {
  color: #b0b8c4;
  opacity: 1;
  font-weight: 400;
}
.custom-input :deep(.v-field--variant-underlined .v-field__outline::before) {
  border-bottom-color: #e5e9f2;
  border-width: 2px;
}

/* Button */
.gradient-btn {
  width: 100%;
  padding: 16px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(to right, #00d2ff, #3a7bd5);
  color: white;
  font-family: 'Inter', sans-serif;
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 10px;
  box-shadow: 0 4px 15px rgba(58, 123, 213, 0.3);
}
.gradient-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(58, 123, 213, 0.5);
}
.gradient-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}
</style>