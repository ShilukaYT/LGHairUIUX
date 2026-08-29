// ===== CỐ ĐỊNH LAYOUT: CHỐNG ZOOM TRÌNH DUYỆT =====
// Khi người dùng zoom trình duyệt (Ctrl+/-), script sẽ tự động
// counteract lại để trang luôn hiển thị ở kích cỡ gốc 100%
const _INITIAL_DPR = window.devicePixelRatio || 1;

function _applyCounterZoom() {
  const currentDPR = window.devicePixelRatio || 1;
  const relativeZoom = currentDPR / _INITIAL_DPR;
  // Nếu user zoom out 50% → relativeZoom=0.5 → ta scale body lên 2x để bù lại
  // Kết quả: 0.5 (browser) × 2 (body) = 1 → trông như 100%
  (document.body as HTMLElement).style.zoom = String(1 / relativeZoom);
}

_applyCounterZoom();
// 'resize' event cũng bắn ra khi thay đổi zoom mức trình duyệt
window.addEventListener('resize', _applyCounterZoom);
// ===== END ZOOM FIX =====
if (window.location.hostname === '127.0.0.1' || window.location.port === '3000') {
  let newUrl = window.location.href;
  if (window.location.hostname === '127.0.0.1') {
    newUrl = newUrl.replace('127.0.0.1', 'localhost');
  }
  if (window.location.port === '3000') {
    newUrl = newUrl.replace('http:', 'https:').replace(':3000', ':5173');
  }
  window.location.replace(newUrl);
}

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/index.css'
import vue3GoogleLogin from 'vue3-google-login'
import axios from 'axios'
import { setupPerformanceBooster } from '../../../packages/shared/src';
import { useAuthStore } from './stores/useAuthStore'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

// 1. Cấu hình axios gửi và nhận cookie mặc định cho mọi request
axios.defaults.withCredentials = true;

setupPerformanceBooster(axios);

// 2. Request Interceptor: Tự động gắn Bearer Token nếu đã đăng nhập
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('accessToken') || 
                  localStorage.getItem('access_token') || 
                  sessionStorage.getItem('token') || '';

    if (token && token !== 'undefined') {
      if (config.headers.set) {
        config.headers.set('Authorization', `Bearer ${token}`);
      } else {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 3. Queue & Lock Mechanism để xử lý các request đồng thời khi token hết hạn
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else if (token) {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

// 4. Response Interceptor: Tự động Refresh Token ngầm khi nhận 401 Unauthorized
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Kiểm tra thông báo tài khoản bị khóa toàn cục
    const serverMessage = error.response?.data?.message || '';
    if (typeof serverMessage === 'string' && (serverMessage.toLowerCase().includes('khóa') || serverMessage.toLowerCase().includes('bị khoá'))) {
      const authStore = useAuthStore();
      authStore.triggerLockedAccount();
    }

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = (originalRequest.url || '').toLowerCase();

    // Bỏ qua nếu lỗi xảy ra ở các endpoint auth công khai hoặc endpoint refresh-token
    if (
      requestUrl.includes('/login') ||
      requestUrl.includes('/register') ||
      requestUrl.includes('/refresh-token') ||
      requestUrl.includes('/google-login') ||
      requestUrl.includes('/send-otp') ||
      requestUrl.includes('/send-register-otp')
    ) {
      return Promise.reject(error);
    }

    // Nếu gặp lỗi 401 Unauthorized và chưa thử retry
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Đã có 1 request đang refresh -> xếp hàng đợi request này
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers.set) {
              originalRequest.headers.set('Authorization', `Bearer ${token}`);
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${token}`;
            }
            return axios(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const storedRefreshToken = localStorage.getItem('refreshToken') || 
                                 localStorage.getItem('refresh_token') || '';

      return new Promise((resolve, reject) => {
        axios
          .post(
            `${API}/api/account/refresh-token`,
            { refreshToken: storedRefreshToken || undefined },
            { withCredentials: true }
          )
          .then((res) => {
            const data = res.data?.data || res.data || {};
            const newAccessToken = data.token || data.accessToken || '';
            const newRefreshToken = data.refreshToken || '';

            if (newAccessToken) {
              localStorage.setItem('token', newAccessToken);
              localStorage.setItem('accessToken', newAccessToken);
              sessionStorage.setItem('token', newAccessToken);
            }
            if (newRefreshToken) {
              localStorage.setItem('refreshToken', newRefreshToken);
            }

            if (newAccessToken) {
              if (originalRequest.headers.set) {
                originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
              } else {
                originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
              }
              processQueue(null, newAccessToken);
              resolve(axios(originalRequest));
            } else {
              processQueue(new Error('Không nhận được Token mới'), null);
              reject(error);
            }
          })
          .catch((refreshErr) => {
            processQueue(refreshErr, null);

            // Refresh Token hết hạn hoặc bị hủy -> Xóa session
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('access_token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('refresh_token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('token');

            window.dispatchEvent(new Event('user-updated'));
            
            try {
              // Chỉ hiển thị Modal popup nếu đang ở các trang bắt buộc đăng nhập (Profile, Đơn hàng)
              // Các trang đặt lịch, sản phẩm, dịch vụ, giỏ hàng... chỉ hiển thị note nhẹ nhàng trên giao diện
              const currentPath = window.location.pathname.toLowerCase();
              const isProtectedRoute = currentPath.includes('/profile') || currentPath.includes('/don-hang');
              if (isProtectedRoute) {
                const authStore = useAuthStore();
                authStore.triggerSessionExpired('Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.');
              }
            } catch (storeErr) {
              console.warn('Lỗi mở modal hết hạn phiên:', storeErr);
            }
            
            reject(refreshErr);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vue3GoogleLogin, {
  clientId: '554413864784-ietlbhd76soro8rchkgrkmugsi4p40cg.apps.googleusercontent.com'
})

app.mount('#app')
