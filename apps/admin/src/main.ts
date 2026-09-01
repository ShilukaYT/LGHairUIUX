import { createApp } from 'vue'
import router from '@/router/router.ts' 
import App from '@/App.vue'
import vue3GoogleLogin from 'vue3-google-login'
import './style.css'
import axios from 'axios';

import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
import '@/scss/style.scss';
import './style.css'
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar';
// google-fonts
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
// Dòng 22:
import { setupPerformanceBooster } from '../../../packages/shared/src';


const app = createApp(App)

app.use(vue3GoogleLogin, {
  clientId: '554413864784-ietlbhd76soro8rchkgrkmugsi4p40cg.apps.googleusercontent.com'
})

// 1. Luôn cho phép gửi Cookie
axios.defaults.withCredentials = true;
setupPerformanceBooster(axios); // 👈 Thêm dòng này để kích hoạt
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

// 1.5. Trạm gác chặn các Request gửi đi (Gắn Token vào Header)
axios.interceptors.request.use(
  (config) => {
    const requestUrl = config.url || '';
    let token = '';
    const urlLower = requestUrl.toLowerCase();
    if (urlLower.includes('/api/admin') || urlLower.includes('/api/nhan-vien') || urlLower.includes('/api/nhanvien')) {
      token = sessionStorage.getItem('adminToken') || localStorage.getItem('staffToken') || sessionStorage.getItem('staffToken') || '';
    } else {
      token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || '';
    }

    if (token && token !== 'undefined') {
      config.headers.set('Authorization', `Bearer ${token}`);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- Cơ chế xếp hàng đợi (Queue) khi đang Refresh Token để tránh Race Condition ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// 2. Trạm gác chặn các Response trả về từ Server (ĐÃ NÂNG CẤP HỖ TRỢ ADMIN, NHÂN VIÊN VÀ KHÁCH)
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isLocked = error.response?.data?.isLocked === true;
    const serverMessage = error.response?.data?.message || '';
    const hasLockKeyword = typeof serverMessage === 'string' && (serverMessage.toLowerCase().includes('khóa') || serverMessage.toLowerCase().includes('bị khoá'));

    if (isLocked || hasLockKeyword) {
      try {
        const { useAdminAuthDialogStore } = await import('@/stores/adminAuthDialog');
        const authDialogStore = useAdminAuthDialogStore();
        authDialogStore.triggerLockedAccount(serverMessage || 'Tài khoản của bạn đã bị khóa bởi quản trị viên. Vui lòng liên hệ quản trị viên để được hỗ trợ.');
      } catch {
        router.push('/admin/login');
      }
      return Promise.reject(error);
    }

    if (!originalRequest) {
      return Promise.reject(error);
    }

    const requestUrl = (originalRequest.url || '').toLowerCase();

    // Bỏ qua trạm gác nếu request đang gọi là /login hoặc /refresh-token
    if (requestUrl.includes('/login') || requestUrl.includes('/refresh-token')) {
      return Promise.reject(error);
    }

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

      // KIỂM TRA CHÍNH XÁC LOẠI API ĐANG GỌI
      const isAdminApi = requestUrl.includes('/api/admin');
      const isStaffApi = requestUrl.includes('/api/nhan-vien') || requestUrl.includes('/api/nhanvien');

      const storedRefreshToken =
        sessionStorage.getItem('adminRefreshToken') ||
        sessionStorage.getItem('staffRefreshToken') ||
        localStorage.getItem('staffRefreshToken') ||
        sessionStorage.getItem('userRefreshToken') ||
        localStorage.getItem('refreshToken') ||
        '';

      return new Promise((resolve, reject) => {
        let refreshUrl = `${API}/api/admin/auth/refresh-token`;
        if (!isAdminApi && !isStaffApi) {
          refreshUrl = `${API}/api/account/refresh-token`;
        }

        axios
          .post(
            refreshUrl,
            { refreshToken: storedRefreshToken || undefined },
            { withCredentials: true }
          )
          .then((res) => {
            const data = res.data?.data || res.data || {};
            const newAccessToken = data.accessToken || data.token;
            const newRefreshToken = data.refreshToken;

            if (newAccessToken) {
              if (isAdminApi) {
                sessionStorage.setItem('adminToken', newAccessToken);
                if (newRefreshToken) sessionStorage.setItem('adminRefreshToken', newRefreshToken);
              } else if (isStaffApi) {
                sessionStorage.setItem('staffToken', newAccessToken);
                localStorage.setItem('staffToken', newAccessToken);
                if (newRefreshToken) {
                  sessionStorage.setItem('staffRefreshToken', newRefreshToken);
                  localStorage.setItem('staffRefreshToken', newRefreshToken);
                }
              } else {
                localStorage.setItem('userToken', newAccessToken);
                sessionStorage.setItem('userToken', newAccessToken);
                if (newRefreshToken) {
                  localStorage.setItem('refreshToken', newRefreshToken);
                }
              }

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
          .catch(async (refreshError) => {
            processQueue(refreshError, null);
            console.error("Phiên đăng nhập đã kết thúc hoặc không có quyền:", refreshError);

            sessionStorage.removeItem('adminUser');
            sessionStorage.removeItem('adminToken');
            sessionStorage.removeItem('adminRefreshToken');
            sessionStorage.removeItem('staffUser');
            sessionStorage.removeItem('staffToken');
            sessionStorage.removeItem('staffRefreshToken');
            sessionStorage.removeItem('nhanVienUser');
            localStorage.removeItem('staffToken');
            localStorage.removeItem('staffRefreshToken');
            localStorage.removeItem('staffUser');
            localStorage.removeItem('nhanVienUser');

            const isRefreshLocked = refreshError.response?.data?.isLocked === true;
            const refreshMsg = refreshError.response?.data?.message || '';
            if (isRefreshLocked || (typeof refreshMsg === 'string' && (refreshMsg.toLowerCase().includes('khóa') || refreshMsg.toLowerCase().includes('bị khoá')))) {
              try {
                const { useAdminAuthDialogStore } = await import('@/stores/adminAuthDialog');
                const authDialogStore = useAdminAuthDialogStore();
                authDialogStore.triggerLockedAccount(refreshMsg || 'Tài khoản của bạn đã bị khóa bởi quản trị viên.');
              } catch {
                router.push('/admin/login');
              }
              return reject(refreshError);
            }

            try {
              const { useAdminAuthDialogStore } = await import('@/stores/adminAuthDialog');
              const authDialogStore = useAdminAuthDialogStore();
              authDialogStore.triggerSessionExpired('Phiên làm việc của bạn đã hết hạn. Vui lòng đăng nhập lại.');
            } catch (dialogErr) {
              if (isAdminApi) {
                router.push('/admin/login');
              } else if (isStaffApi) {
                router.push('/nhanvien/login');
              } else {
                router.push('/login');
              }
            }

            reject(refreshError);
          })
          .finally(() => {
            isRefreshing = false;
          });
      });
    }

    return Promise.reject(error);
  }
);

app.use(router)
app.use(createPinia())
app.use(PerfectScrollbarPlugin)
app.use(vuetify)

app.mount('#app')