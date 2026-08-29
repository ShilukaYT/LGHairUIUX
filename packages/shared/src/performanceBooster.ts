interface CacheItem {
  data: any;
  status?: number;
  statusText?: string;
  headers?: any;
  timestamp: number;
}

// 1. Kho lưu trữ Cache RAM siêu tốc trên trình duyệt cho Axios
const memoryCache = new Map<string, CacheItem>();

// Cấu hình thời gian sống của Cache (TTL)
const DEFAULT_CACHE_TTL = 30 * 1000; // 30 giây mặc định cho các dữ liệu xem

/**
 * BỘ TĂNG ÁP HẠ TẦNG TOÀN HỆ THỐNG CHO AXIOS (NON-INVASIVE PERFORMANCE BOOSTER)
 * Tác dụng:
 * 1. Trả kết quả tức thì (0ms) từ RAM cho các thao tác chuyển trang và xem dữ liệu
 * 2. Tự động dọn dẹp Cache chính xác theo Controller/Resource khi có Thêm / Sửa / Xóa
 * 3. Tuyệt đối không can thiệp vào fetch nội bộ của Vite / Trình duyệt để tránh lỗi trắng trang
 */
export function setupPerformanceBooster(axiosInstance: any): void {
  if (!axiosInstance || !axiosInstance.interceptors) {
    console.warn('[TURBO BOOSTER] Axios instance không hợp lệ.');
    return;
  }

  // --- A. BỘ ĐỆM REQUEST AXIOS (INTERCEPTOR GỬI ĐI) ---
  axiosInstance.interceptors.request.use(
    (config: any) => {
      try {
        const method: string = config.method ? String(config.method).toUpperCase() : 'GET';
        const url: string = config.url ? String(config.url) : '';

        // Bỏ qua nếu có cờ noCache hoặc không phải GET
        if (config.noCache || method !== 'GET') {
          if (method !== 'GET' && url) {
            clearRelatedCache(url);
          }
          return config;
        }

        // Chỉ cache các request API thực sự
        if (!url.includes('/api/')) {
          return config;
        }

        const cacheKey = getCacheKey(config);

        // 1. Nếu có sẵn trong RAM và còn hạn -> Trả về ngay lập tức (0ms)
        const cached = memoryCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < DEFAULT_CACHE_TTL) {
          config.adapter = () => {
            return Promise.resolve({
              data: cached.data,
              status: cached.status ?? 200,
              statusText: cached.statusText ?? 'OK (From Fast-RAM Booster)',
              headers: config.headers ?? {},
              config: config,
              request: {}
            });
          };
          return config;
        }
      } catch (err) {
        console.warn('[TURBO BOOSTER] Lỗi xử lý request cache:', err);
      }

      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // --- B. BỘ ĐỆM RESPONSE AXIOS (INTERCEPTOR NHẬN VỀ) ---
  axiosInstance.interceptors.response.use(
    (response: any) => {
      try {
        const method: string = response.config?.method ? String(response.config.method).toUpperCase() : 'GET';
        const url: string = response.config?.url ? String(response.config.url) : '';

        if (method === 'GET' && !response.config?.noCache && response.status === 200 && url.includes('/api/')) {
          const cacheKey = getCacheKey(response.config);
          memoryCache.set(cacheKey, {
            data: response.data,
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.warn('[TURBO BOOSTER] Lỗi lưu response cache:', err);
      }
      return response;
    },
    (error: any) => {
      return Promise.reject(error);
    }
  );

  console.log('⚡ [TURBO BOOSTER] Đã kích hoạt bộ tăng tốc RAM Cache cho Axios thành công!');
}

// Hàm tạo khóa định danh duy nhất cho mỗi API
function getCacheKey(config: any): string {
  const url: string = config.url ? String(config.url) : '';
  const params: string = config.params ? JSON.stringify(config.params) : '';
  return `${url}_${params}`;
}

// Trích xuất tên tài nguyên từ URL một cách chuẩn xác (Type-Safe 100%)
function extractResourceName(rawUrl: string): string {
  if (!rawUrl) return '';
  try {
    let cleanPath = rawUrl;
    if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
      cleanPath = new URL(rawUrl).pathname;
    } else {
      cleanPath = rawUrl.split('?')[0] || '';
    }

    const segments: string[] = cleanPath.split('/').filter(Boolean);
    if (segments.length === 0) return '';

    const first = segments[0] || '';
    const second = segments[1] || '';

    if (first.toLowerCase() === 'api' && second) {
      return second.toLowerCase().replace(/[-_]/g, '');
    }
    return first.toLowerCase().replace(/[-_]/g, '');
  } catch {
    return '';
  }
}

// Hàm tự động dọn dẹp cache cục bộ chính xác khi có thay đổi dữ liệu (POST/PUT/DELETE)
export function clearRelatedCache(url: string): void {
  if (!url) return;
  const targetResource = extractResourceName(url);
  if (!targetResource) return;

  for (const key of memoryCache.keys()) {
    const cachedResource = extractResourceName(key);
    if (cachedResource && (cachedResource === targetResource || key.toLowerCase().includes(targetResource))) {
      memoryCache.delete(key);
    }
  }
}

// Hàm xóa toàn bộ Cache thủ công khi cần
export function clearAllMemoryCache(): void {
  memoryCache.clear();
  console.log('⚡ [TURBO BOOSTER] Đã làm mới toàn bộ RAM Cache.');
}