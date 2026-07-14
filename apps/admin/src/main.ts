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
import VueTablerIcons from 'vue-tabler-icons';
import VueApexCharts from 'vue3-apexcharts';
// google-fonts
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

const app = createApp(App)

app.use(vue3GoogleLogin, {
  clientId: '554413864784-ietlbhd76soro8rchkgrkmugsi4p40cg.apps.googleusercontent.com'
})

// 1. Luôn cho phép gửi Cookie
axios.defaults.withCredentials = true;

// 1.5. Trạm gác chặn các Request gửi đi (Gắn Token vào Header)
axios.interceptors.request.use(
  (config) => {
    const requestUrl = config.url || '';
    let token = '';

    if (requestUrl.includes('/api/admin') || requestUrl.includes('/api/nhan-vien')) {
      token = sessionStorage.getItem('adminToken') || localStorage.getItem('staffToken') || sessionStorage.getItem('staffToken') || '';
    } else {
      token = localStorage.getItem('userToken') || sessionStorage.getItem('userToken') || '';
    }

    if (token && token !== 'undefined') {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 2. Trạm gác chặn các Response trả về từ Server (ĐÃ NÂNG CẤP HỖ TRỢ ADMIN, NHÂN VIÊN VÀ KHÁCH)
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = originalRequest.url || '';

    // Bỏ qua trạm gác nếu request đang gọi là /login hoặc /refresh-token
    if (requestUrl.includes('/login') || requestUrl.includes('/refresh-token')) {
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; 

      // KIỂM TRA CHÍNH XÁC LOẠI API ĐANG GỌI
      const isAdminApi = requestUrl.includes('/api/admin');
      const isStaffApi = requestUrl.includes('/api/nhan-vien'); // Bổ sung API nhân viên

      try {
        let refreshRes;
        if (isAdminApi) {
          refreshRes = await axios.post('https://localhost:7196/api/admin/auth/refresh-token');
        } else if (isStaffApi) {
          refreshRes = await axios.post('https://localhost:7196/api/admin/auth/refresh-token'); 
        } else {
          refreshRes = await axios.post('https://localhost:7196/api/account/refresh-token');
        }

        // Cập nhật Token mới vào Storage & Header nếu API trả về Token
        if (refreshRes && refreshRes.data) {
          const data = refreshRes.data.data || refreshRes.data;
          const newAccessToken = data.accessToken || data.token;
          if (newAccessToken) {
            if (isAdminApi) {
              sessionStorage.setItem('adminToken', newAccessToken);
            } else if (isStaffApi) {
              localStorage.setItem('staffToken', newAccessToken);
              sessionStorage.setItem('staffToken', newAccessToken);
            } else {
              localStorage.setItem('userToken', newAccessToken);
              sessionStorage.setItem('userToken', newAccessToken);
            }
            originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          }
        }
        
        // Xin thành công -> tự động gọi lại API cũ
        return axios(originalRequest); 
        
      } catch (refreshError) {
        console.error("Phiên đăng nhập đã kết thúc hoặc không có quyền.");
        
        // XỬ LÝ ĐÁ VĂNG VỀ ĐÚNG TRANG LOGIN
        if (isAdminApi) {
          sessionStorage.removeItem('adminUser');
          sessionStorage.removeItem('adminToken');
          router.push('/admin/login');
        } 
        else if (isStaffApi) {
          // Xóa sạch dữ liệu liên quan đến nhân viên và đá về đúng login của nhân viên
          sessionStorage.removeItem('staffUser');
          sessionStorage.removeItem('nhanVienUser');
          sessionStorage.removeItem('adminUser'); // Đề phòng lưu nhầm
          router.push('/nhanvien/login');
        } 
        else {
          localStorage.removeItem('user');
          sessionStorage.removeItem('user');
          
          if (!originalRequest.url.includes('/api/account/get-profile')) {
            router.push('/login');
          }
        }
        
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

app.use(router)
app.use(createPinia())
app.use(PerfectScrollbarPlugin)
app.use(VueTablerIcons)
app.use(VueApexCharts)
app.use(vuetify)

app.mount('#app')