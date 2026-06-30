import axios from 'axios';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";

const API = import.meta.env.VITE_API_URL || 'https://localhost:5174'; // Thay đổi nếu port API của bạn khác

// ========================================================
// 1. HÀM TRỢ GIÚP: QUẢN LÝ GUEST ID
// ========================================================
// Tự động tạo và lấy X-Guest-Id cho khách chưa đăng nhập
const getGuestId = (): string => {
    let guestId = localStorage.getItem('X-Guest-Id');
    if (!guestId) {
        // Sinh một chuỗi ngẫu nhiên đơn giản
        guestId = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('X-Guest-Id', guestId);
    }
    return guestId;
};

// ========================================================
// 2. CẤU HÌNH AXIOS CHO GIỎ HÀNG
// ========================================================
const cartAxios = axios.create({
    baseURL: `${API}/api/GioHang`,
});

// Interceptor: Tự động gắn X-Guest-Id và Token (nếu có) vào mọi Request
cartAxios.interceptors.request.use((config) => {
    config.headers['X-Guest-Id'] = getGuestId();
    
    // Nếu có token đăng nhập, gắn vào Header Authorization (Sửa lại tên key 'token' nếu dự án bạn dùng tên khác)
    const token = localStorage.getItem('token'); 
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    return config;
}, (error) => {
    return Promise.reject(error);
});

// ========================================================
// 3. CÁC HÀM XỬ LÝ CHÍNH (TƯƠNG THÍCH NGƯỢC VỚI CODE CŨ)
// ========================================================

// 🛒 Lấy giỏ hàng
export const getCartDB = async (maKH: string | null = null) => {
    try {
        const res = await cartAxios.get('/chi-tiet');
        // Map từng field backend → CartItem interface của Cart.vue
        // Backend: { id, loai, ten, gia, hinhAnh, soLuong }
        // Cart.vue cần: { id, type, tenItem, gia, hinhAnh, soLuong }
        return res.data.items.map((item: any) => ({
            ...item,
            // ✅ 'loai' → 'type' (BIENTHE → SANPHAM để Cart hiểu đúng tab)
            type: item.loai === 'BIENTHE' ? 'SANPHAM' : item.loai,
            // ✅ 'ten' → 'tenItem' (Cart.vue template dùng item.tenItem)
            tenItem: item.ten || item.tenItem || 'Không rõ tên',
            // Giữ lại field gốc để tương thích
            ten: item.ten,
        }));
    } catch (error) {
        console.error("Lỗi lấy giỏ hàng từ API:", error);
        return [];
    }
};

// ➕ Thêm vào giỏ
export const addToCartDB = async (item: any, maKH: string | null = null) => {
    try {
        const type = item.type || "DICHVU";
        
        if (type === "SANPHAM" || type === "BIENTHE") {
            await cartAxios.post('/them-bien-the', {
                maBienThe: item.id || item.maBienThe,
                soLuong: item.soLuong || 1
            });
        } else if (type === "COMBO") {
            await cartAxios.post('/them-combo', {
                maCb: item.id || item.maCb,
                soLuong: item.soLuong || 1
            });
        } else {
            await cartAxios.post('/them-dich-vu', {
                maDv: item.id || item.maDv,
                soLuong: item.soLuong || 1
            });
        }
    } catch (error) {
        console.error("Lỗi thêm item vào API:", error);
    }
};

// 🔄 Cập nhật số lượng
export const updateCartItemDB = async (item: any) => {
    try {
        // Ép kiểu lại cho Backend hiểu
        const loaiBackend = item.type === 'SANPHAM' ? 'BIENTHE' : (item.type || 'DICHVU');
        await cartAxios.put('/cap-nhat-so-luong', {
            id: item.id.toString(),
            loai: loaiBackend,
            soLuong: item.soLuong
        });
    } catch (error) {
        console.error("Lỗi cập nhật số lượng API:", error);
    }
};

// ❌ Xóa 1 Item
export const removeFromCartDB = async (id: string | number, type?: string) => {
    try {
        let loaiBackend = type === 'SANPHAM' ? 'BIENTHE' : type;

        // Xử lý thông minh: Nếu Frontend gọi hàm xóa mà quên truyền type, API sẽ tự mò tìm type trước khi xóa
        if (!loaiBackend) {
            const currentCart = await getCartDB();
            const itemToRemove = currentCart.find((x: any) => String(x.id) === String(id));
            if (itemToRemove) {
                loaiBackend = itemToRemove.type === 'SANPHAM' ? 'BIENTHE' : (itemToRemove.type || 'DICHVU');
            } else {
                return; // Không có thì bỏ qua
            }
        }

        await cartAxios.delete('/xoa-item', {
            data: { 
                id: id.toString(),
                loai: loaiBackend
            }
        });
    } catch (error) {
        console.error("Lỗi xóa item API:", error);
    }
};

// 🗑️ Xóa sạch giỏ hàng
export const clearCartDB = async (maKH: string | null = null) => {
    try {
        await cartAxios.delete('/xoa-sach');
    } catch (error) {
        console.error("Lỗi dọn dẹp giỏ hàng API:", error);
    }
};

// ========================================================
// 4. HÀM MỚI: ĐỒNG BỘ SAU KHI ĐĂNG NHẬP
// ========================================================
export const syncCartAfterLoginDB = async () => {
    try {
        await cartAxios.post('/dong-bo-khi-login');
        // Sau khi đồng bộ thành công, không cần xóa X-Guest-Id vì backend đã lo việc xóa dữ liệu tạm trong Cache.
    } catch (error) {
        console.error("Lỗi đồng bộ giỏ hàng khi Login:", error);
    }
};