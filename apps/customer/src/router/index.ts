import { createRouter, createWebHistory } from 'vue-router'

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
        { path: 'don-hang', name: 'lich_su_mua_hang', component: () => import('@/Views/Anonymous/LichSuMuaHang.vue'), meta: { requiresAuth: true } },
        { path: 'wishlist', name: 'wishlist', component: () => import('@/Views/Anonymous/Wishlist.vue') },
        { path: 'profile', name: 'profile', component: () => import('@/Views/Anonymous/Profile.vue'), meta: { requiresAuth: true } },
        { path: '/combo/:id', name: 'detailCombo', component: () => import('@/Views/Anonymous/ComboDetail.vue') },
        { path: 'dmdv', name: 'dmdv', component: () => import('@/Views/Anonymous/Dmdichvu.vue') },
        { path: 'product', name: 'Product', component: () => import('@/Views/Anonymous/Product.vue') },
        { path: 'product/:id', name: 'productDetail', component: () => import('@/Views/Anonymous/ProductDetail.vue') },
        { path: 'dat-dich-vu', name: 'datdichvu', component: () => import('@/Views/Anonymous/Datdichvu/Datdichvu.vue') },
        { path: 'payment-result', name: 'payment_result', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResult.vue') },
        { path: 'payment-result-san-pham', name: 'payment_result_san_pham', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResultSanPham.vue') },
        { path: 'payment-result-tong', name: 'payment_result_tong', component: () => import('@/Views/Anonymous/Datdichvu/PaymentResultTong.vue') },
        { path: 'thanh-toan-san-pham', name: 'thanh_toan_san_pham', component: () => import('@/Views/Anonymous/Datdichvu/ThanhToanSanPham.vue') },
        { path: 'thanh-toan-tong', name: 'thanh_toan_tong', component: () => import('@/Views/Anonymous/Datdichvu/ThanhToanTong.vue') },
        { path: 'xac-nhan-dich-vu', name: 'xac_nhan_dich_vu', component: () => import('@/Views/Anonymous/Datdichvu/Xacnhandichvu.vue') },
        { path: 'khuyen-mai', name: 'khuyenMai', component: () => import('@/Views/Anonymous/KhuyenMai.vue') },
        { path: 'chuyen-vien', name: 'employees', component: () => import('@/Views/Anonymous/Employees.vue') },
        { path: 'chuyen-vien-yeu-thich', name: 'favorite_employees', component: () => import('@/Views/Anonymous/FavoriteEmployees.vue') },
      ]
    },
    // Future admin layout setup
    // {
    //   path: '/admin',
    //   component: () => import('@/Views/Admin/Index.vue'),
    //   children: [ ... ]
    // }
    // }
  ],
})

router.beforeEach((to, from, next) => {
  const isAuthenticated = !!localStorage.getItem('user');
  
  if (to.meta.requiresAuth && !isAuthenticated) {
    // Nếu route yêu cầu đăng nhập nhưng chưa có user -> đẩy về trang login
    next({ name: 'login' });
  } else if (to.name === 'login' && isAuthenticated) {
    // Nếu đã đăng nhập mà cố tình vào trang login -> đẩy về trang chủ
    next({ name: 'home' });
  } else {
    next();
  }
});

export default router
