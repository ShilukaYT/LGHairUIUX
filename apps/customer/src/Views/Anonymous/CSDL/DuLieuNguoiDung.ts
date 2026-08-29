export const getCustomerInfo = () => {
    // Chỉ lấy thông tin người dùng khi CẢ 'user' VÀ 'token' đều tồn tại trong localStorage
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    
    if (savedUser && token) {
        try {
            const user = JSON.parse(savedUser);
            if (user && user.maKH) {
                return {
                    maKH: user.maKH,
                    hoTen: user.hoTen || '',
                    hinhAnh: user.hinhAnh || null,
                    tenRank: user.tenRank || null,
                    email: user.email || '',
                    sdt: user.sdt || ''
                };
            }
        } catch (e) {
            console.error("Lỗi parse user từ localStorage:", e);
        }
    }

    // Nếu không có token hợp lệ (khách vãng lai hoặc đã đăng xuất), luôn trả về GUEST
    return {
        maKH: 'GUEST',
        hoTen: 'Khách vãng lai',
        hinhAnh: null,
        tenRank: null,
        email: '',
        sdt: ''
    };
};