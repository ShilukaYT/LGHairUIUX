import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  // 1. Modal tài khoản bị khóa
  const showLockedModal = ref(false);
  const openChatWithStaffSignal = ref(false);

  function triggerLockedAccount() {
    showLockedModal.value = true;
  }

  function closeLockedModal() {
    showLockedModal.value = false;
  }

  function triggerOpenChatWithStaff() {
    showLockedModal.value = false;
    openChatWithStaffSignal.value = true;
  }

  // 2. Modal hết hạn phiên đăng nhập (Style chuẩn Login.vue)
  const showSessionExpiredModal = ref(false);
  const sessionExpiredMessage = ref('Phiên đăng nhập của bạn đã hết hạn hoặc bạn đã đăng xuất từ thiết bị khác. Vui lòng đăng nhập lại.');

  function triggerSessionExpired(message?: string) {
    if (message) {
      sessionExpiredMessage.value = message;
    }
    showSessionExpiredModal.value = true;
  }

  function closeSessionExpiredModal() {
    showSessionExpiredModal.value = false;
  }

  function goToLogin(redirectPath?: string) {
    showSessionExpiredModal.value = false;
    const current = redirectPath || (window.location.pathname + window.location.search);
    if (current && current !== '/login') {
      window.location.href = `/login?redirect=${encodeURIComponent(current)}`;
    } else {
      window.location.href = '/login';
    }
  }

  // 3. Modal xác nhận đăng xuất (Style chuẩn Login.vue)
  const showLogoutConfirmModal = ref(false);
  const logoutModalTitle = ref('Xác Nhận Đăng Xuất');
  const logoutModalMessage = ref('Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?');
  let onLogoutConfirmedCallback: (() => void) | null = null;

  function triggerLogoutConfirm(onConfirm: () => void, title?: string, message?: string) {
    onLogoutConfirmedCallback = onConfirm;
    logoutModalTitle.value = title || 'Xác Nhận Đăng Xuất';
    logoutModalMessage.value = message || 'Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?';
    showLogoutConfirmModal.value = true;
  }

  function confirmLogoutAction() {
    showLogoutConfirmModal.value = false;
    if (onLogoutConfirmedCallback) {
      onLogoutConfirmedCallback();
      onLogoutConfirmedCallback = null;
    }
  }

  function closeLogoutConfirmModal() {
    showLogoutConfirmModal.value = false;
    onLogoutConfirmedCallback = null;
  }

  // 4. Banner thông báo hết hạn phiên trên các trang Đặt lịch / Giỏ hàng / Thanh toán
  const sessionExpiredBanner = ref(sessionStorage.getItem('session_expired_banner') === 'true');

  function setSessionExpiredBanner(status: boolean) {
    sessionExpiredBanner.value = status;
    if (status) {
      sessionStorage.setItem('session_expired_banner', 'true');
    } else {
      sessionStorage.removeItem('session_expired_banner');
    }
  }

  return { 
    showLockedModal, 
    openChatWithStaffSignal, 
    triggerLockedAccount, 
    closeLockedModal, 
    triggerOpenChatWithStaff,
    // Session Expired
    showSessionExpiredModal,
    sessionExpiredMessage,
    triggerSessionExpired,
    closeSessionExpiredModal,
    goToLogin,
    // Session Expired Banner for Booking & Cart
    sessionExpiredBanner,
    setSessionExpiredBanner,
    // Logout Confirm
    showLogoutConfirmModal,
    logoutModalTitle,
    logoutModalMessage,
    triggerLogoutConfirm,
    confirmLogoutAction,
    closeLogoutConfirmModal
  };
});
