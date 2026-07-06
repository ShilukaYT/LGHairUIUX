import { ref } from 'vue';
import { defineStore } from 'pinia';
import Swal from 'sweetalert2';

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

  // Load wishlist from localStorage
  const loadWishlist = () => {
    try {
      const prods = localStorage.getItem('wishlist_products');
      if (prods) {
        favoriteProducts.value = JSON.parse(prods);
      }
      const svcs = localStorage.getItem('wishlist_services');
      if (svcs) {
        favoriteServices.value = JSON.parse(svcs);
      }
    } catch (e) {
      console.error('Failed to load wishlist from localStorage:', e);
    }
  };

  // Save wishlist to localStorage
  const saveWishlist = () => {
    try {
      localStorage.setItem('wishlist_products', JSON.stringify(favoriteProducts.value));
      localStorage.setItem('wishlist_services', JSON.stringify(favoriteServices.value));
    } catch (e) {
      console.error('Failed to save wishlist to localStorage:', e);
    }
  };

  // Products
  const isProductFavorite = (maSp: string | number) => {
    return favoriteProducts.value.some((p) => p.maSp === maSp);
  };

  const toggleProductFavorite = (product: any) => {
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

  // Auto load when store is initialized
  loadWishlist();

  return {
    favoriteProducts,
    favoriteServices,
    loadWishlist,
    isProductFavorite,
    toggleProductFavorite,
    removeProduct,
    isServiceFavorite,
    toggleServiceFavorite,
    removeService,
  };
});
