// Định nghĩa cấu trúc chuẩn nhất cho Giỏ hàng
interface CartItem {
    id: string | number;
    maKH: string;
    type: "DICHVU" | "COMBO" | "SANPHAM";
    tenItem: string;
    gia: number;
    giaGoc: number;
    phanTramGiam: number;
    hinhAnh: string;
    createdAt: number;
    duration: number;
    soLuong: number;
}

const DB_NAME = 'MinhTamHair_DB';
const STORE_NAME = 'cart_items';
// QUAN TRỌNG: Ép version lên 99 để trình duyệt đập đi xây lại bảng dữ liệu sạch sẽ
const DB_VERSION = 99;

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            // Xóa sạch bảng cũ bị lỗi (nếu có) để làm lại từ đầu
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = (e) => {
            console.error("Lỗi khởi tạo IndexedDB:", e);
            reject(request.error);
        };
    });
};

// Hàm thêm giỏ hàng vạn năng: Tự động "dịch" mọi field từ API sang DB
export const addToCartDB = async (item: any, maKH: string | null) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // 1. Tự động tìm ID từ đủ mọi loại định dạng
    const resolvedId = String(item.id || item.maDv || item.maCb || item.maCB || item.maBienThe || `ITEM_${Date.now()}`);

    // 2. Tự động phân loại (Dịch vụ, Combo hay Sản phẩm)
    let resolvedType = item.type || "DICHVU";
    if (item.maBienThe || resolvedId.startsWith("SANPHAM")) resolvedType = "SANPHAM";
    else if (resolvedId.startsWith("CB")) resolvedType = "COMBO";

    // 3. Gom dữ liệu chuẩn xác
    const data: CartItem = {
        id: resolvedId,
        maKH: maKH || 'GUEST',
        type: resolvedType as any,
        tenItem: item.tenItem || item.name || item.tenDv || item.tenCombo || item.tenSp || "Dịch vụ Minh Tâm",
        gia: Number(item.gia || item.price || item.giaBan || 0),
        giaGoc: Number(item.giaGoc || item.originalPrice || item.gia || item.price || 0),
        phanTramGiam: Number(item.phanTramGiam || 0),
        hinhAnh: item.hinhAnh || item.icon || item.image || item.hinhAnhDaiDien || "/images/no-image.png",
        createdAt: item.createdAt || Date.now(),
        duration: Number(item.duration || item.thoiGianLam || 30),
        soLuong: Number(item.soLuong || 1)
    };

    return new Promise((resolve, reject) => {
        const getRequest = store.get(resolvedId);

        getRequest.onsuccess = () => {
            const existingItem = getRequest.result;

            if (existingItem) {
                // Nếu đã có trong giỏ, cộng dồn số lượng
                existingItem.soLuong += data.soLuong;
                existingItem.gia = data.gia; // Cập nhật lại giá nếu có thay đổi
                
                const updateRequest = store.put(existingItem);
                updateRequest.onsuccess = () => resolve(true);
                updateRequest.onerror = () => reject(updateRequest.error);
            } else {
                // Chưa có thì thêm mới
                const putRequest = store.put(data);
                putRequest.onsuccess = () => resolve(true);
                putRequest.onerror = () => reject(putRequest.error);
            }
        };

        getRequest.onerror = () => reject(getRequest.error);
    });
};

// Hàm lấy giỏ hàng (Chỉ lấy đồ chưa quá 3 ngày)
export const getCartDB = async (maKH: string | null): Promise<CartItem[]> => {
    const db = await initDB();
    return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const now = Date.now();
            const expireTime = 3 * 24 * 60 * 60 * 1000;
            const currentMaKH = maKH || 'GUEST';

            const allItems = request.result as CartItem[];
            const validItems = allItems.filter(item => {
                return item.maKH === currentMaKH && (now - item.createdAt < expireTime);
            });
            resolve(validItems);
        };
    });
};

export const updateCartItemDB = async (item: CartItem) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    return new Promise((resolve, reject) => {
        try {
            const cleanItem = JSON.parse(JSON.stringify(item));
            const putRequest = store.put(cleanItem);
            putRequest.onsuccess = () => resolve(true);
            putRequest.onerror = () => reject(putRequest.error);
        } catch (err) {
            reject(err);
        }
    });
};

export const removeFromCartDB = async (id: string | number) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve) => tx.oncomplete = () => resolve(true));
};

export const clearCartDB = async (maKH: string | null) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const currentMaKH = maKH || 'GUEST';
        const allItems = request.result as CartItem[];
        allItems.forEach(item => {
            if (item.maKH === currentMaKH) store.delete(item.id);
        });
    };
    return new Promise((resolve) => tx.oncomplete = () => resolve(true));
};

export const clearProductCartDB = async (maKH: string | null) => {
    const db = await initDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
        const currentMaKH = maKH || 'GUEST';
        const allItems = request.result as CartItem[];
        allItems.forEach(item => {
            if (item.maKH === currentMaKH && item.type === 'SANPHAM') {
                store.delete(item.id);
            }
        });
    };
    return new Promise((resolve) => tx.oncomplete = () => resolve(true));
};

export const mergeGuestCart = async (loggedInMaKh: string) => {
    const guestCart = await getCartDB('GUEST');
    if (guestCart && guestCart.length > 0) {
        for (const item of guestCart) {
            await addToCartDB(item, loggedInMaKh);
        }
        await clearCartDB('GUEST');
    }
};