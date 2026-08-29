import { defineStore } from 'pinia';
import { ref } from 'vue';
import router from '@/router/router';

export const useAdminAuthDialogStore = defineStore('adminAuthDialog', () => {
  // 1. Session Expired Dialog (Hết hạn phiên)
  const showSessionExpiredDialog = ref(false);
  const sessionExpiredMessage = ref('Phiên đăng nhập đã hết hạn hoặc bị đăng xuất từ thiết bị khác. Vui lòng đăng nhập lại.');

  function triggerSessionExpired(msg?: string) {
    if (msg) {
      sessionExpiredMessage.value = msg;
    }
    showSessionExpiredDialog.value = true;
  }

  function closeSessionExpired() {
    showSessionExpiredDialog.value = false;
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
    router.push('/admin/login');
  }

  // 2. Logout Confirm Dialog (Xác nhận đăng xuất)
  const showLogoutConfirmDialog = ref(false);
  let onLogoutConfirmedCallback: (() => void) | null = null;

  function triggerLogoutConfirm(onConfirm: () => void) {
    onLogoutConfirmedCallback = onConfirm;
    showLogoutConfirmDialog.value = true;
  }

  function confirmLogout() {
    showLogoutConfirmDialog.value = false;
    if (onLogoutConfirmedCallback) {
      onLogoutConfirmedCallback();
      onLogoutConfirmedCallback = null;
    }
  }

  function closeLogoutConfirm() {
    showLogoutConfirmDialog.value = false;
    onLogoutConfirmedCallback = null;
  }

  return {
    showSessionExpiredDialog,
    sessionExpiredMessage,
    triggerSessionExpired,
    closeSessionExpired,
    showLogoutConfirmDialog,
    triggerLogoutConfirm,
    confirmLogout,
    closeLogoutConfirm
  };
});
