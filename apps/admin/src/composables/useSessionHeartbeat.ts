import { onMounted, onUnmounted } from 'vue';
import axios from 'axios';

export function useSessionHeartbeat() {
  const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';
  let heartbeatTimer: any = null;
  let isChecking = false;

  const isUserLoggedIn = () => {
    return (
      sessionStorage.getItem('adminUser') !== null ||
      sessionStorage.getItem('staffUser') !== null ||
      localStorage.getItem('staffUser') !== null
    );
  };

  /**
   * 1. Ưu tiên Refresh Token ngầm trước để luôn đảm bảo có JWT mới nhất
   */
  const refreshSessionToken = async (): Promise<boolean> => {
    const storedRefreshToken =
      sessionStorage.getItem('adminRefreshToken') ||
      sessionStorage.getItem('staffRefreshToken') ||
      localStorage.getItem('staffRefreshToken') ||
      '';

    try {
      const res = await axios.post(
        `${API}/api/admin/auth/refresh-token`,
        { refreshToken: storedRefreshToken || undefined },
        { withCredentials: true }
      );

      const data = res.data?.data || res.data || {};
      const newAccessToken = data.accessToken || data.token;
      const newRefreshToken = data.refreshToken;

      if (newAccessToken) {
        if (sessionStorage.getItem('adminUser')) {
          sessionStorage.setItem('adminToken', newAccessToken);
          if (newRefreshToken) sessionStorage.setItem('adminRefreshToken', newRefreshToken);
        } else {
          sessionStorage.setItem('staffToken', newAccessToken);
          localStorage.setItem('staffToken', newAccessToken);
          if (newRefreshToken) {
            sessionStorage.setItem('staffRefreshToken', newRefreshToken);
            localStorage.setItem('staffRefreshToken', newRefreshToken);
          }
        }
        return true;
      }
    } catch (e) {
      console.warn('[Session Heartbeat] Thử refresh token ngầm trước:', e);
    }
    return false;
  };

  /**
   * 2. Kiểm tra phiên: Ưu tiên Refresh Token trước -> Sau đó Check đăng nhập (Ping)
   */
  const checkSession = async () => {
    if (!isUserLoggedIn() || isChecking) return;

    // Không ping/refresh nếu đang ở màn hình login
    if (window.location.pathname.includes('/login')) return;

    isChecking = true;
    try {
      // BƯỚC 1: Ưu tiên lấy Refresh Token để cấp JWT mới trước
      await refreshSessionToken();

      // BƯỚC 2: Kiểm tra trạng thái đăng nhập và quyền truy cập (Ping)
      await axios.get(`${API}/api/admin/auth/ping`);
    } catch (error) {
      console.warn('[Session Heartbeat] Kiểm tra phiên ngầm thất bại:', error);
    } finally {
      isChecking = false;
    }
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isUserLoggedIn()) {
      checkSession();
    }
  };

  const onWindowFocus = () => {
    if (isUserLoggedIn()) {
      checkSession();
    }
  };

  onMounted(() => {
    // 1. Chạy Heartbeat định kỳ mỗi 5 phút (chủ động làm mới token trước khi hết hạn 30 phút)
    heartbeatTimer = setInterval(checkSession, 5 * 60 * 1000);

    // 2. Tự động kiểm tra & làm mới ngay khi người dùng quay trở lại Tab Admin sau khi treo máy
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);
  });

  onUnmounted(() => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.removeEventListener('focus', onWindowFocus);
  });

  return {
    checkSession,
    refreshSessionToken
  };
}
