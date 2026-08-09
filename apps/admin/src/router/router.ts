import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  // --- NHÓM TRANG ADMIN (Giao diện Phoenix) ---
  {
    path: '/admin',
    component: () => import('@/layouts/dashboard/DashboardLayout.vue'),
    children: [
      { path: '', redirect: '/admin/dashboard' },
      { path: 'servicesManager', name: 'ServicesManager', component: () => import('@/Admin/ServicesManager.vue') },
      { path: 'category', name: 'Category', component: () => import('@/Admin/Category.vue') },
      { path: 'sale', name: 'sale', component: () => import('@/Admin/Sale/sale.vue') },
      { path: 'checkin', name: 'checkin', component: () => import('@/Admin/Check-in/Checkin.vue') },
      { path: 'checkout', name: 'checkout', component: () => import('@/Admin/Check-out/Checkout.vue') },
      { path: 'voucher', name: 'VoucherAdmin', component: () => import('@/Admin/voucher/VoucherAdmin.vue') },
      { path: 'quan-ly-ca-lam', name: 'QuanLyCaLamAdmin', component: () => import('@/Admin/QuanLyCaLam/QuanLyCaLam.vue') },
      { path: 'diem-danh', name: 'DiemDanhAdmin', component: () => import('@/Admin/QuanLyCaLam/DiemDanh.vue') },
      { path: 'lich-su-diem-danh', name: 'LichSuDiemDanh', component: () => import('@/Admin/QuanLyCaLam/LichSuDiemDanh.vue') },
      { path: 'hoa-don', name: 'HoaDonAdmin', component: () => import('@/Admin/HoaDon/HoaDon.vue') },
      { path: 'khach-hang', name: 'KhachHangAdmin', component: () => import('@/Admin/KhachHangAdmin.vue') },
      { path: 'quanlydanhgia', name: 'QuanLyDanhGia', component: () => import('@/Admin/QuanLyDanhGia/QuanLyDanhGia.vue') },
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/Admin/Dashboard/Dashboard.vue') },
      { path: 'NhanVien', name: 'NhanVien', component: () => import('@/Admin/NhanVien/NhanVien.vue') },
      { path: 'StyleHairXColor', name: 'StyleHairXColor', component: () => import('@/Admin/StyleHairAndColor/StyleHairXColor.vue') },
      { path: 'nhan-vien', name: 'QuanLyNhanVienAdmin', component: () => import('@/Admin/NhanVien/NhanVien.vue') },
      { path: 'chuc-vu', name: 'QuanLyChucVuAdmin', component: () => import('@/Admin/NhanVien/QuanLyChucVu.vue') },
      { path: 'bang-luong', name: 'BangLuongAdmin', component: () => import('@/Admin/QuanLyLuong/BangLuong.vue') },
      { path: 'Gui-Thong-Bao', name: 'GuiThongBao', component: () => import('@/Admin/GuiThongBao.vue') },
      { path: 'chat', name: 'AdminChat', component: () => import('@/components/AdminChat.vue') },
      { path: 'productManager', name: 'ProductManager', component: () => import('@/Admin/Productmanager.vue') },
      { path: 'categoriesProduct', name: 'CategoriesProduct', component: () => import('@/Admin/DanhMucSP.vue') },
      { path: 'quanLyKho', name: 'QuanLyKho', component: () => import('@/Admin/QuanLyKho.vue') },
      { path: 'hoaDonDienTu', name: 'HoaDonDienTu', component: () => import('@/Admin/InvoiceInfoForm.vue') },
      { path: 'profile', name: 'AdminProfile', component: () => import('@/Admin/Profile/StaffProfile.vue') },
      { path: 'nha-cung-cap', name: 'NhaCungCapAdmin', component: () => import('@/Admin/NhaCungCap/NhaCungCap.vue') },
      { path: 'quan-ly-hoat-dong', name: 'QuanLyHoatDong', component: () => import('@/Admin/QuanLyHoatDong.vue') },
      { path: 'doiSoatDV', name: 'DoiSoatDV', component: () => import('@/Admin/QuanLyDoiSoatDichVu.vue') },
      { path: 'doiSoatSP', name: 'DoiSoatSP', component: () => import('@/Admin/DoiSoatHoaDon.vue') },
    ],
    meta: { requiresAdminAuth: true }
  },
  {
    path: '/admin/login',
    component: () => import('@/Admin/Account/login.vue'),
    name: 'login-admin',
    meta: { requiresGuestAdmin: true }
  },
  
  // --- NHÓM TRANG NHÂN VIÊN ---
  {
    path: '/nhanvien',
    component: () => import('@/NhanVien/layout/LayoutNhanVien.vue'),
    children: [
      { path: '', redirect: '/nhanvien/ca-lam-viec' },
      { path: 'ca-lam-viec', name: 'NhanVienCaLamViec', component: () => import('@/NhanVien/CaLamViec/CaLamViec.vue') },
      { path: 'lich-su-diem-danh', name: 'NhanVienLichSuDiemDanh', component: () => import('@/Admin/QuanLyCaLam/LichSuDiemDanh.vue') },
      { path: 'profile', name: 'NhanVienProfile', component: () => import('@/Admin/Profile/StaffProfile.vue') },
      { path: 'thong-ke-thu-nhap', name: 'NhanVienThongKeThuNhap', component: () => import('@/NhanVien/ThongKe/ThongKeThuNhap.vue') },
    ],
    meta: { requiresStaffAuth: true }
  },
  {
    path: '/nhanvien/login',
    component: () => import('@/Admin/Account/login.vue'),
    name: 'login-nhan-vien',
    meta: { requiresGuestStaff: true }
  },

  // Redirect root to admin login or dashboard
  {
    path: '/',
    redirect: '/admin'
  }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition;
    return { left: 0, top: 0 };
  }
})

router.beforeEach((to, from, next) => {
  const isAdminLoggedIn = sessionStorage.getItem('adminUser') !== null;
  const isStaffLoggedIn = 
    localStorage.getItem('staffUser') !== null || sessionStorage.getItem('staffUser') !== null || 
    localStorage.getItem('nhanVienUser') !== null || sessionStorage.getItem('nhanVienUser') !== null ||
    sessionStorage.getItem('adminUser') !== null;

  // 1. Kiểm tra quyền Admin
  if (to.matched.some(record => record.meta.requiresAdminAuth)) {
    if (!isAdminLoggedIn) next({ name: 'login-admin' });
    else next();
    return;
  }

  if (to.matched.some(record => record.meta.requiresGuestAdmin)) {
    if (isAdminLoggedIn) next({ path: '/admin' });
    else next();
    return;
  }

  // 2. Kiểm tra quyền nhân viên
  if (to.matched.some(record => record.meta.requiresStaffAuth)) {
    if (!isStaffLoggedIn) next({ name: 'login-nhan-vien' });
    else next();
    return;
  }

  if (to.matched.some(record => record.meta.requiresGuestStaff)) {
    if (isStaffLoggedIn) next({ path: '/nhanvien/ca-lam-viec' });
    else next();
    return;
  }

  next();
});

export default router