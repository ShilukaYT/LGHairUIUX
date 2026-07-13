import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  // Hiển thị modal tài khoản bị khóa từ bất kỳ trang nào
  const showLockedModal = ref(false);
  // Signal kích hoạt mở khung chat với nhân viên hỗ trợ
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

  return { 
    showLockedModal, 
    openChatWithStaffSignal, 
    triggerLockedAccount, 
    closeLockedModal, 
    triggerOpenChatWithStaff 
  };
});
