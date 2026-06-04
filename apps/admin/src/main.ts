import { createApp } from 'vue'
import router from '@/router/router.ts' 
import App from '@/App.vue'
import vue3GoogleLogin from 'vue3-google-login'
import './style.css'
import axios from 'axios';

import { createPinia } from 'pinia';
import vuetify from './plugins/vuetify';
import '@/scss/style.scss';
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar';
import VueTablerIcons from 'vue-tabler-icons';
import VueApexCharts from 'vue3-apexcharts';
// google-fonts
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';

const app = createApp(App)

app.use(vue3GoogleLogin, {
  clientId: '554413864784-ietlbhd76soro8rchkgrkmugsi4p40cg.apps.googleusercontent.com'
})

// 1. Luôn cho phép gửi Cookie
axios.defaults.withCredentials = true;

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
        if (isAdminApi) {
          await axios.post('https://localhost:7196/api/admin/auth/refresh-token');
        } else if (isStaffApi) {
          // Bạn có thể đổi đường dẫn này nếu Nhân viên có API refresh-token riêng
          // Nếu dùng chung AuthController với Admin, hãy giữ nguyên dòng dưới
          await axios.post('https://localhost:7196/api/admin/auth/refresh-token'); 
        } else {
          await axios.post('https://localhost:7196/api/account/refresh-token');
        }
        
        // Xin thành công -> tự động gọi lại API cũ
        return axios(originalRequest); 
        
      } catch (refreshError) {
        console.error("Phiên đăng nhập đã kết thúc hoặc không có quyền.");
        
        // XỬ LÝ ĐÁ VĂNG VỀ ĐÚNG TRANG LOGIN
        if (isAdminApi) {
          sessionStorage.removeItem('adminUser');
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