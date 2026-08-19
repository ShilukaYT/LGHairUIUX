interface CacheItem {
  data: any;
  timestamp: number;
}

// 1. Kho lưu trữ Cache RAM siêu tốc trên trình duyệt
const memoryCache = new Map<string, CacheItem>();

// 2. Bảng theo dõi các Request đang chạy (Chống Spam / Trùng lặp API)
const pendingRequests = new Map<string, Promise<any>>();

// Cấu hình thời gian sống của Cache (TTL)
const DEFAULT_CACHE_TTL = 30 * 1000; // 30 giây mặc định cho các dữ liệu xem

/**
 * BỘ TĂNG ÁP HẠ TẦNG TOÀN HỆ THỐNG (NON-INVASIVE PERFORMANCE BOOSTER)
 * Tác dụng:
 * 1. Chống gửi trùng API khi nhiều component cùng gọi 1 lúc (Request Deduplication)
 * 2. Trả kết quả ngay tức thì 0ms từ RAM cho các thao tác chuyển trang (In-Memory SWR Cache)
 * 3. Tự động dọn dẹp Cache khi có thao tác Thêm / Sửa / Xóa (Auto Cache Invalidation)
 */
export function setupPerformanceBooster(axiosInstance: any) {
  if (!axiosInstance || !axiosInstance.interceptors) {
    console.warn('[TURBO BOOSTER] Axios instance không hợp lệ.');
    return;
  }

  // --- A. BỘ ĐỆM REQUEST (INTERCEPTOR GỬI ĐI) ---
  axiosInstance.interceptors.request.use((config: any) => {
    const method = config.method?.toUpperCase();

    // Bỏ qua nếu có cờ noCache
    if (config.noCache) return config;

    // Chỉ cache các yêu cầu đọc dữ liệu (GET)
    if (method === 'GET') {
      const cacheKey = getCacheKey(config);

      // 1. Nếu có sẵn trong RAM và còn hạn -> Trả về ngay lập tức không cần ra mạng (0ms)
      const cached = memoryCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
        config.adapter = () => {
          return Promise.resolve({
            data: cached.data,
            status: 200,
            statusText: 'OK (From Fast-RAM Booster)',
            headers: config.headers || {},
            config: config,
            request: {}
          });
        };
        return config;
      }

      // 2. Nếu đang có 1 request giống hệt đang bay trên mạng -> Gom chung, không gửi cái thứ 2
      if (pendingRequests.has(cacheKey)) {
        config.adapter = () => pendingRequests.get(cacheKey)!;
        return config;
      }
    } else {
      // Khi có hành động POST / PUT / DELETE / PATCH (Thêm/Sửa/Xóa) -> Tự động xóa sạch Cache liên quan
      clearRelatedCache(config.url || '');
    }

    return config;
  });

  // --- B. BỘ ĐỆM RESPONSE (INTERCEPTOR NHẬN VỀ) ---
  axiosInstance.interceptors.response.use(
    (response: any) => {
      const method = response.config?.method?.toUpperCase();
      if (method === 'GET' && !response.config?.noCache) {
        const cacheKey = getCacheKey(response.config);
        // Lưu vào RAM để lần chuyển trang sau lấy ra dùng ngay 0ms
        memoryCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now()
        });
        pendingRequests.delete(cacheKey);
      }
      return response;
    },
    (error: any) => {
      if (error.config) {
        const cacheKey = getCacheKey(error.config);
        pendingRequests.delete(cacheKey);
      }
      return Promise.reject(error);
    }
  );

  console.log('⚡ [TURBO BOOSTER] Đã kích hoạt bộ tăng tốc hạ tầng toàn hệ thống thành công!');
}

// Hàm tạo khóa định danh duy nhất cho mỗi API
function getCacheKey(config: any): string {
  const url = config.url || '';
  const params = config.params ? JSON.stringify(config.params) : '';
  return `${url}_${params}`;
}

// Hàm tự động dọn dẹp cache khi có thay đổi dữ liệu (POST/PUT/DELETE)
export function clearRelatedCache(url: string) {
  if (!url) return;
  const parts = url.split('/').filter(Boolean);
  const baseResource = parts.length > 1 ? parts[1] : parts[0] || '';
  
  for (const key of memoryCache.keys()) {
    if (baseResource && key.includes(baseResource)) {
      memoryCache.delete(key);
    }
  }
}

// Hàm xóa toàn bộ Cache thủ công khi cần
export function clearAllMemoryCache() {
  memoryCache.clear();
  pendingRequests.clear();
  console.log('⚡ [TURBO BOOSTER] Đã làm mới toàn bộ RAM Cache.');
}

// Hàm hỗ trợ Tải trước dữ liệu khi rê chuột vào Menu (Hover Prefetch)
export function prefetchApi(axiosInstance: any, url: string, params?: any) {
  if (!axiosInstance) return;
  const key = `${url}_${params ? JSON.stringify(params) : ''}`;
  if (!memoryCache.has(key) && !pendingRequests.has(key)) {
    axiosInstance.get(url, { params }).catch(() => {});
  }
}