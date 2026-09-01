import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/useAuthStore'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    } else {
      return { top: 0 };
    }
  },
  routes: [
    {
      path: '/',
      component: () => import('@/layouts/ClientLayout.vue'),
      children: [
        { path: '', name: 'home', component: () => import('@/Views/Anonymous/Home.vue') },
        { path: 'login', name: 'login', component: () => import('@/Views/Anonymous/Login.vue') },
        { path: 'shop', name: 'shop', component: () => import('@/Views/Anonymous/Shop.vue') },
        { path: 'product/:id', name: 'product_detail', component: () => import('@/Views/Anonymous/ProductDetail.vue') },
        { path: 'services', name: 'services', component: () => import('@/Views/Anonymous/Services.vue') },
        { path: 'service/:id', name: 'serviceDetail', component: () => import('@/Views/Anonymous/ServiceDetail.vue') },
        { path: 'cart', name: 'cart', component: () => import('@/Views/Anonymous/Cart.vue') },
        { path: 'don-hang', redirect: { name: 'profile', query: { tab: 'orders' } } },
        { path: 'wishlist', name: 'wishlist', component: () => import('@/Views/Anonymous/Wishlist.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/Views/Anonymous/Profile.vue'), meta: { requiresAuth: true } },
        { path: 'combo/:id', name: 'detailCombo', component: () => import('@/Views/Anonymous/ComboDetail.vue') },
        { path: 'dmdv', name: 'dmdv', component: () => import('@/Views/Anonymous/Dmdichvu.vue') },
        { path: 'product', name: 'Product', component: () => import('@/Views/Anonymous/Product.vue') },
        { path: 'product/:id', name: 'productDetail', component: () => import('@/Views/Anonymous/ProductDetail.vue') },
        { path: 'dat-dich-vu', alias: ['dat dich vu', 'dat%20dich%20vu'], name: 'datdichvu', component: () => import('@/Views/Anonymous/Datdichvu/Datdichvu.vue') },
        { path: 'payment-result', name: 'payment_result', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResult.vue') },
        { path: 'payment-result-san-pham', name: 'payment_result_san_pham', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResultSanPham.vue') },
        { path: 'payment-result-tong', name: 'payment_result_tong', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResultTong.vue') },
        { path: 'thanh-toan-san-pham', alias: ['thanh toan san pham', 'thanh%20toan%20san%20pham'], name: 'thanh_toan_san_pham', component: () => import('@/Views/Anonymous/Datdichvu/ThanhToanSanPham.vue') },
        { path: 'thanh-toan-tong', alias: ['thanh toan tong', 'thanh%20toan%20tong'], name: 'thanh_toan_tong', component: () => import('@/Views/Anonymous/Datdichvu/ThanhToanTong.vue') },
        { path: 'xac-nhan-dich-vu', name: 'xac_nhan_dich_vu', component: () => import('@/Views/Anonymous/Datdichvu/Xacnhandichvu.vue') },
        { path: 'khuyen-mai', name: 'khuyenMai', component: () => import('@/Views/Anonymous/KhuyenMai.vue') },
        { path: 'chuyen-vien', name: 'employees', component: () => import('@/Views/Anonymous/Employees.vue') },
        { path: 'chuyen-vien-yeu-thich', name: 'favorite_employees', component: () => import('@/Views/Anonymous/FavoriteEmployees.vue') },
      ]
    },
  ],
})

router.beforeEach((to, from, next) => {
  // 1. Kiểm tra cờ tài khoản bị khóa
  if (localStorage.getItem('account_locked') === 'true') {
    localStorage.removeItem('account_locked');
    try {
      const authStore = useAuthStore();
      authStore.triggerLockedAccount();
    } catch {}
    if (to.meta.requiresAuth) {
      next({ name: 'home' });
      return;
    }
  }

  const localUserStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  let isGuest = false;
  let isUserLocked = false;
  if (localUserStr) {
    try {
      const parsed = JSON.parse(localUserStr);
      if (parsed.maKH === 'GUEST') isGuest = true;
      if (parsed.trangThai === 0 || parsed.TrangThai === 0) isUserLocked = true;
    } catch {
      // ignore
    }
  }

  if (isUserLocked) {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
    sessionStorage.removeItem('token');
    try {
      const authStore = useAuthStore();
      authStore.triggerLockedAccount();
    } catch {}
    if (to.meta.requiresAuth) {
      next({ name: 'home' });
      return;
    }
  }

  const token = localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('token') ||
    sessionStorage.getItem('accessToken') ||
    sessionStorage.getItem('access_token');

  const isAuthenticated = !!token || (!!localUserStr && !isGuest);

  if (to.meta.requiresAuth && !isAuthenticated) {
    // Nếu route yêu cầu đăng nhập nhưng chưa có user -> đẩy về trang login
    next({ name: 'login', query: { redirect: to.fullPath } });
  } else if (to.name === 'login' && isAuthenticated) {
    // Nếu đã đăng nhập mà cố tình vào trang login -> đẩy về trang chủ
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router
