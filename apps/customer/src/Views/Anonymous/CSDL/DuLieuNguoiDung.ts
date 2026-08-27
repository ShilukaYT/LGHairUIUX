// authUtils.ts hoặc viết trực tiếp trong script setup
import Cookies from 'js-cookie';

export const getCustomerInfo = () => {
    // 1. Thử lấy từ LocalStorage (Dữ liệu do AccountController trả về khi Login)
    const savedUser = localStorage.getItem('user');

    if (savedUser) {
        const user = JSON.parse(savedUser);
        return {
            maKH: user.maKH,    // Ví dụ: KH123456
            hoTen: user.hoTen,  // Tên khách hàng
            hinhAnh: user.hinhAnh,
            tenRank: user.tenRank,
            email: user.email || '',
            sdt: user.sdt || ''
        };
    }

    // 2. Thử lấy maKH dự phòng từ Cookie (Nếu bạn có lưu riêng maKH vào Cookie)
    const maKHFromCookie = Cookies.get('maKH');
    if (maKHFromCookie) {
        return { maKH: maKHFromCookie, hoTen: 'Khách hàng', hinhAnh: null, tenRank: 'Đồng', email: '', sdt: '' };
    }

    // 3. Nếu không có gì, trả về GUEST (để dùng cho IndexedDB khách vãng lai)
    return {
        maKH: 'GUEST',
        hoTen: 'Khách vãng lai',
        hinhAnh: null,
        tenRank: null,
        email: '',
        sdt: ''
    };
};