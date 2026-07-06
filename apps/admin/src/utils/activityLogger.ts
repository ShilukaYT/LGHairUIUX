export interface ActivityLog {
  id: string;
  timestamp: string;
  username: string;
  role: string;
  action: string;
  details: string;
  module: string;
  status: string;
}

export const logActivity = (action: string, details: string, module: string, status: string = 'Thành công') => {
  try {
    const userRaw = sessionStorage.getItem("adminUser") || sessionStorage.getItem("staffUser") || sessionStorage.getItem("nhanVienUser");
    const user = userRaw ? JSON.parse(userRaw) : null;
    
    // Fallback user if not logged in or in test environment
    const username = user?.hoTen || user?.tenNhanVien || user?.name || user?.username || "Đinh Hoàng Phúc";
    const role = user?.chucVu || user?.tenRole || user?.role || "Quản trị viên";
    
    const logs: ActivityLog[] = JSON.parse(localStorage.getItem("lghair_activities") || "[]");
    
    const newLog: ActivityLog = {
      id: Math.random().toString(36).substring(2, 9) + Date.now(),
      timestamp: new Date().toISOString(),
      username,
      role,
      action,
      details,
      module,
      status
    };
    
    logs.unshift(newLog);
    // Keep only the last 1000 logs
    localStorage.setItem("lghair_activities", JSON.stringify(logs.slice(0, 1000)));
  } catch (e) {
    console.error("Lỗi khi ghi nhật ký hoạt động:", e);
  }
};
