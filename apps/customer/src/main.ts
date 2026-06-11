import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './styles/index.css'
import vue3GoogleLogin from 'vue3-google-login'
import axios from 'axios'

// Cấu hình axios gửi và nhận cookie mặc định cho mọi request
axios.defaults.withCredentials = true

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vue3GoogleLogin, {
  clientId: '554413864784-ietlbhd76soro8rchkgrkmugsi4p40cg.apps.googleusercontent.com'
})

app.mount('#app')
