
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

// Cấu hình axios gửi và nhận cookie mặc định cho mọi request
axios.defaults.withCredentials = true

setupPerformanceBooster(axios);
// Interceptor bắt mọi lỗi trả về từ API, nếu phát hiện tài khoản bị khóa thì hiện modal hỗ trợ toàn cục
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    const serverMessage = error.response?.data?.message || '';
    if (typeof serverMessage === 'string' && (serverMessage.toLowerCase().includes('khóa') || serverMessage.toLowerCase().includes('bị khoá'))) {
      const authStore = useAuthStore();
      authStore.triggerLockedAccount();
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
