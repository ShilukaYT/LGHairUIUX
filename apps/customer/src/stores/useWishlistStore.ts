import { ref } from 'vue';
import { defineStore } from 'pinia';
import Swal from 'sweetalert2';
import { getCustomerInfo } from '@/Views/Anonymous/CSDL/DuLieuNguoiDung';

const showToast = (title: string, icon: 'success' | 'info' | 'error' | 'warning' = 'success') => {
  Swal.fire({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
    icon: icon,
    title: title,
    background: '#ffffff',
    color: '#000000',
    iconColor: icon === 'success' ? '#10B981' : (icon === 'error' ? '#EF4444' : undefined),
    customClass: {
      popup: 'premium-toast shadow-lg border border-gray-100 rounded-none'
    }
  });
};

export const useWishlistStore = defineStore('wishlist', () => {
  const favoriteProducts = ref<any[]>([]);
  const favoriteServices = ref<any[]>([]);
  const favoriteEmployees = ref<any[]>([]);

  // Sync employees to legacy favorites so Employees.vue and Header badge remain synced
  const syncEmployeesToLegacyFavorites = () => {
    try {
      const customer = getCustomerInfo();
      const key = `favorite_employees_${customer?.maKH || 'GUEST'}`;
      const ids = favoriteEmployees.value.map(e => e.id || e.maNv);
      localStorage.setItem(key, JSON.stringify(ids));

      favoriteEmployees.value.forEach(emp => {
        const id = emp.id || emp.maNv;
        localStorage.setItem(`employee_details_${id}`, JSON.stringify(emp));
      });

      // Dispatch custom event to notify Header.vue
      window.dispatchEvent(new CustomEvent('favorite-employees-updated'));
    } catch (e) {
      console.error('Failed to sync employees to legacy favorites:', e);
    }
  };

  const mergeProducts = (listA: any[], listB: any[]) => {
    const merged = [...listA];
    for (const item of listB) {
      if (item && item.maSp !== undefined) {
        const exists = merged.some((x) => x.maSp === item.maSp);
        if (!exists) merged.push(item);
      }
    }
    return merged;
  };

  const mergeServices = (listA: any[], listB: any[]) => {
    const merged = [...listA];
    for (const item of listB) {
      if (item && item.maDv !== undefined) {
        const exists = merged.some((x) => x.maDv === item.maDv);
        if (!exists) merged.push(item);
      }
    }
    return merged;
  };

  const mergeEmployees = (listA: any[], listB: any[]) => {
    const merged = [...listA];
    for (const item of listB) {
      if (item) {
        const id = item.id || item.maNv;
        if (id !== undefined) {
          const exists = merged.some((x) => x.id === id || x.maNv === id);
          if (!exists) merged.push(item);
        }
      }
    }
    return merged;
  };

  // Load wishlist from localStorage
  const loadWishlist = () => {
    try {
      const customer = getCustomerInfo();
      const maKH = customer?.maKH || 'GUEST';

      const prodKey = `wishlist_products_${maKH}`;
      const svcKey = `wishlist_services_${maKH}`;
      const empKey = `wishlist_employees_${maKH}`;

      // 1. PRODUCTS
      let prods = localStorage.getItem(prodKey);
      if (!prods) {
        // Migration from old global key
        const globalProds = localStorage.getItem('wishlist_products');
        if (globalProds) {
          localStorage.setItem(prodKey, globalProds);
          prods = globalProds;
          localStorage.removeItem('wishlist_products');
        }
      }

      if (prods) {
        favoriteProducts.value = JSON.parse(prods);
      } else {
        favoriteProducts.value = [];
      }

      // Merge from guest products if logged in
      if (maKH !== 'GUEST') {
        const guestProdsStr = localStorage.getItem('wishlist_products_GUEST');
        if (guestProdsStr) {
          try {
            const guestProds = JSON.parse(guestProdsStr);
            if (Array.isArray(guestProds) && guestProds.length > 0) {
              favoriteProducts.value = mergeProducts(favoriteProducts.value, guestProds);
              localStorage.setItem(prodKey, JSON.stringify(favoriteProducts.value));
            }
          } catch (e) {
            console.error('Failed to merge guest products:', e);
          }
          localStorage.removeItem('wishlist_products_GUEST');
        }
      }

      // 2. SERVICES
      let svcs = localStorage.getItem(svcKey);
      if (!svcs) {
        // Migration from old global key
        const globalSvcs = localStorage.getItem('wishlist_services');
        if (globalSvcs) {
          localStorage.setItem(svcKey, globalSvcs);
          svcs = globalSvcs;
          localStorage.removeItem('wishlist_services');
        }
      }

      if (svcs) {
        favoriteServices.value = JSON.parse(svcs);
      } else {
        favoriteServices.value = [];
      }

      // Merge from guest services if logged in
      if (maKH !== 'GUEST') {
        const guestSvcsStr = localStorage.getItem('wishlist_services_GUEST');
        if (guestSvcsStr) {
          try {
            const guestSvcs = JSON.parse(guestSvcsStr);
            if (Array.isArray(guestSvcs) && guestSvcs.length > 0) {
              favoriteServices.value = mergeServices(favoriteServices.value, guestSvcs);
              localStorage.setItem(svcKey, JSON.stringify(favoriteServices.value));
            }
          } catch (e) {
            console.error('Failed to merge guest services:', e);
          }
          localStorage.removeItem('wishlist_services_GUEST');
        }
      }

      // 3. EMPLOYEES
      let emps = localStorage.getItem(empKey);
      if (!emps) {
        // Migration from old global key
        const globalEmps = localStorage.getItem('wishlist_employees');
        if (globalEmps) {
          localStorage.setItem(empKey, globalEmps);
          emps = globalEmps;
          localStorage.removeItem('wishlist_employees');
        } else {
          // Fallback: try loading from legacy keys
          const key = `favorite_employees_${maKH}`;
          const savedIds = localStorage.getItem(key);
          if (savedIds) {
            const ids = JSON.parse(savedIds);
            const loadedEmps = [];
            for (const id of ids) {
              const details = localStorage.getItem(`employee_details_${id}`);
              if (details) {
                loadedEmps.push(JSON.parse(details));
              } else {
                loadedEmps.push({ id, name: 'Chuyên viên', image: '', role: 'Stylist', rating: 5.0 });
              }
            }
            localStorage.setItem(empKey, JSON.stringify(loadedEmps));
            emps = JSON.stringify(loadedEmps);
          }
        }
      }

      if (emps) {
        favoriteEmployees.value = JSON.parse(emps);
      } else {
        favoriteEmployees.value = [];
      }

      // Merge from guest employees if logged in
      if (maKH !== 'GUEST') {
        const guestEmpsStr = localStorage.getItem('wishlist_employees_GUEST');
        if (guestEmpsStr) {
          try {
            const guestEmps = JSON.parse(guestEmpsStr);
            if (Array.isArray(guestEmps) && guestEmps.length > 0) {
              favoriteEmployees.value = mergeEmployees(favoriteEmployees.value, guestEmps);
              localStorage.setItem(empKey, JSON.stringify(favoriteEmployees.value));
              syncEmployeesToLegacyFavorites();
            }
          } catch (e) {
            console.error('Failed to merge guest employees:', e);
          }
          localStorage.removeItem('wishlist_employees_GUEST');
        }
      }
    } catch (e) {
      console.error('Failed to load wishlist from localStorage:', e);
    }
  };

  // Save wishlist to localStorage
  const saveWishlist = () => {
    try {
      const customer = getCustomerInfo();
      const maKH = customer?.maKH || 'GUEST';
      localStorage.setItem(`wishlist_products_${maKH}`, JSON.stringify(favoriteProducts.value));
      localStorage.setItem(`wishlist_services_${maKH}`, JSON.stringify(favoriteServices.value));
      localStorage.setItem(`wishlist_employees_${maKH}`, JSON.stringify(favoriteEmployees.value));
    } catch (e) {
      console.error('Failed to save wishlist to localStorage:', e);
    }
  };

  const checkAuth = () => {
    const customer = getCustomerInfo();
    if (!customer || customer.maKH === 'GUEST') {
      Swal.fire({
        title: 'Yêu cầu đăng nhập',
        text: 'Vui lòng đăng nhập để sử dụng tính năng này',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Đăng nhập',
        cancelButtonText: 'Đóng',
        customClass: {
          popup: 'premium-swal rounded-none',
          confirmButton: 'bg-black text-white px-6 py-3 rounded-none uppercase text-xs tracking-wider',
          cancelButton: 'bg-gray-200 text-black px-6 py-3 rounded-none uppercase text-xs tracking-wider'
        }
      }).then((result) => {
        if (result.isConfirmed) {
          window.location.href = '/login';
        }
      });
      return false;
    }
    return true;
  };

  // Products
  const isProductFavorite = (maSp: string | number) => {
    return favoriteProducts.value.some((p) => p.maSp === maSp);
  };

  const toggleProductFavorite = (product: any) => {
    if (!checkAuth()) return;
    if (!product) return;
    const maSp = product.maSp;
    const name = product.tenSp || product.name || 'Sản phẩm';
    const index = favoriteProducts.value.findIndex((p) => p.maSp === maSp);
    if (index >= 0) {
      favoriteProducts.value.splice(index, 1);
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    } else {
      favoriteProducts.value.push(product);
      showToast(`Đã thêm "${name}" vào danh sách yêu thích`, 'success');
    }
    saveWishlist();
  };

  const removeProduct = (maSp: string | number) => {
    const index = favoriteProducts.value.findIndex((p) => p.maSp === maSp);
    if (index >= 0) {
      const name = favoriteProducts.value[index].tenSp || favoriteProducts.value[index].name || 'Sản phẩm';
      favoriteProducts.value.splice(index, 1);
      saveWishlist();
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    }
  };

  // Services
  const isServiceFavorite = (maDv: string | number) => {
    return favoriteServices.value.some((s) => s.maDv === maDv);
  };

  const toggleServiceFavorite = (service: any) => {
    if (!checkAuth()) return;
    if (!service) return;
    const maDv = service.maDv;
    const name = service.tenDv || service.name || 'Dịch vụ';
    const index = favoriteServices.value.findIndex((s) => s.maDv === maDv);
    if (index >= 0) {
      favoriteServices.value.splice(index, 1);
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    } else {
      favoriteServices.value.push(service);
      showToast(`Đã thêm "${name}" vào danh sách yêu thích`, 'success');
    }
    saveWishlist();
  };

  const removeService = (maDv: string | number) => {
    const index = favoriteServices.value.findIndex((s) => s.maDv === maDv);
    if (index >= 0) {
      const name = favoriteServices.value[index].tenDv || favoriteServices.value[index].name || 'Dịch vụ';
      favoriteServices.value.splice(index, 1);
      saveWishlist();
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    }
  };

  // Employees (Barbers/Stylists)
  const isEmployeeFavorite = (id: string | number) => {
    return favoriteEmployees.value.some((e) => e.id === id || e.maNv === id);
  };

  const toggleEmployeeFavorite = (employee: any) => {
    if (!checkAuth()) return;
    if (!employee) return;
    const id = employee.id || employee.maNv;
    const name = employee.name || employee.hoTenNv || 'Chuyên viên';
    const index = favoriteEmployees.value.findIndex((e) => e.id === id || e.maNv === id);
    if (index >= 0) {
      favoriteEmployees.value.splice(index, 1);
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    } else {
      const normalized = {
        id: employee.id || employee.maNv,
        name: employee.name || employee.hoTenNv || 'Chuyên viên',
        image: employee.image || employee.hinhAnh || '',
        role: employee.role || 'Stylist',
        rating: employee.rating || 5.0
      };
      favoriteEmployees.value.push(normalized);
      showToast(`Đã thêm "${name}" vào danh sách yêu thích`, 'success');
    }
    saveWishlist();
    syncEmployeesToLegacyFavorites();
  };

  const removeEmployee = (id: string | number) => {
    const index = favoriteEmployees.value.findIndex((e) => e.id === id || e.maNv === id);
    if (index >= 0) {
      const name = favoriteEmployees.value[index].name || 'Chuyên viên';
      favoriteEmployees.value.splice(index, 1);
      saveWishlist();
      syncEmployeesToLegacyFavorites();
      showToast(`Đã xóa "${name}" khỏi danh sách yêu thích`, 'error');
    }
  };

  // Auto load when store is initialized
  loadWishlist();

  // Listen to storage/user changes to automatically reload wishlist
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'user' || e.key === null) {
        loadWishlist();
      }
    });
    window.addEventListener('user-updated', loadWishlist);
  }

  return {
    favoriteProducts,
    favoriteServices,
    favoriteEmployees,
    loadWishlist,
    isProductFavorite,
    toggleProductFavorite,
    removeProduct,
    isServiceFavorite,
    toggleServiceFavorite,
    removeService,
    isEmployeeFavorite,
    toggleEmployeeFavorite,
    removeEmployee,
  };
});
