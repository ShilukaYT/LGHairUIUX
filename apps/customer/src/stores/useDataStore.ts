import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDataStore = defineStore('data', () => {
  const PRODUCTS = ref([
    { id: 'p1', name: 'Huyết Thanh Lụa Signature', price: 65, img: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?q=80&w=800', desc: 'Serum tạo kiểu mỏng nhẹ giúp giảm xơ rối và mang lại độ bóng như gương. Công thức từ argan và squalane.', category: 'Tạo kiểu', size: '50ml', ingredients: 'Dầu hạt Argania Spinosa, Squalane, Dimethicone, Hương liệu.' },
    { id: 'p2', name: 'Mặt Nạ Phục Hồi Tóc', price: 80, img: 'https://images.unsplash.com/photo-1608248593859-679901416e78?q=80&w=800', desc: 'Liệu trình chuyên sâu hàng tuần thẩm thấu sâu vào lõi tóc để phục hồi hư tổn và trả lại độ đàn hồi.', category: 'Phục hồi', size: '200ml', ingredients: 'Aqua, Cetearyl Alcohol, Behentrimonium Chloride, Keratin Amino Acids.' },
    { id: 'p3', name: 'Dầu Gội Cân Bằng', price: 45, img: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?q=80&w=800', desc: 'Dầu gội hàng ngày dịu nhẹ giúp làm sạch da đầu trong khi vẫn duy trì độ ẩm tối ưu cho thân tóc.', category: 'Làm sạch', size: '250ml', ingredients: 'Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Glycerin.' },
    { id: 'p4', name: 'Dầu Xả Mỏng Nhẹ', price: 48, img: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?q=80&w=800', desc: 'Gỡ rối và làm mềm mà không gây bết dính. Hoàn hảo cho chất tóc mảnh đến trung bình.', category: 'Dưỡng tóc', size: '250ml', ingredients: 'Aqua, Cetyl Alcohol, Stearyl Alcohol, Panthenol.' },
    { id: 'p5', name: 'Xịt Tạo Nếp Muối Biển', price: 38, img: 'https://images.unsplash.com/photo-1599305090598-fe179d501227?q=80&w=800', desc: 'Tạo nếp sóng biển tự nhiên với độ mờ hoàn hảo. Tăng cường với chiết xuất tảo bẹ.', category: 'Tạo kiểu', size: '150ml', ingredients: 'Aqua, Magnesium Sulfate, Macrocystis Pyrifera Extract.' },
    { id: 'p6', name: 'Xịt Tạo Kiểu Khô', price: 52, img: 'https://images.unsplash.com/photo-1617897903246-719242758050?q=80&w=800', desc: 'Tạo độ phồng và nếp ấn tượng trong khi thấm hút bã nhờn. Sản phẩm lai tạo kiểu hoàn hảo.', category: 'Tạo kiểu', size: '200ml', ingredients: 'Hydrofluorocarbon 152a, Dimethyl Ether, SD Alcohol 40-B, Zeolite.' }
  ]);

  const SERVICES = ref([
    { id: 's1', name: "Cắt Tóc Signature", desc: "Thiết kế riêng theo cấu trúc khuôn mặt và phong cách sống.", price: "$120", duration: "60 PHÚT", img: "https://images.unsplash.com/photo-1595476108010-b4d1f10d5e43?q=80&w=1000", fullDesc: "Gói cắt tóc Signature không chỉ là tỉa tóc; đó là sự tái cấu trúc lại mái tóc của bạn. Chúng tôi bắt đầu với buổi tư vấn chi tiết về hình dáng khuôn mặt, chất tóc. Kỹ thuật cắt được tinh chỉnh riêng biệt, kết thúc bằng phần sấy và tạo kiểu chuyên nghiệp.", whatToExpect: ["Tư vấn chi tiết", "Massage da đầu thư giãn", "Cắt tỉa chuẩn xác", "Sấy tạo kiểu Signature"] },
    { id: 's2', name: "Nhuộm Màu Thiết Kế", desc: "Nhuộm màu đa tầng và phủ bóng thiết kế riêng.", price: "Từ $250", duration: "120-180 PHÚT", img: "https://images.unsplash.com/photo-1615014664205-045388c422c5?q=80&w=1000", fullDesc: "Nâng tầm diện mạo với dịch vụ nhuộm màu thiết kế độc quyền. Sử dụng công thức cao cấp, ít độc hại, chuyên gia pha màu của chúng tôi sẽ tạo ra sắc độ đa tầng tôn lên hoàn hảo làn da của bạn, từ highlight liền mạch đến kỹ thuật nhuộm khối nghệ thuật.", whatToExpect: ["Phân tích lịch sử màu", "Pha màu độc quyền", "Phục hồi liên kết tóc", "Khử vàng & Phủ bóng"] },
    { id: 's3', name: "Uốn Kỹ Thuật Số", desc: "Nếp sóng mềm mại, tự nhiên và bồng bềnh bền lâu.", price: "$300", duration: "180 PHÚT", img: "https://images.unsplash.com/photo-1592856695076-3f2fd7dbfd82?q=80&w=1000", fullDesc: "Sở hữu nếp tóc sóng nhẹ tựa như thức dậy đã đẹp với công nghệ uốn kỹ thuật số tân tiến. Khác với uốn truyền thống, kỹ thuật này sử dụng thanh cuốn kiểm soát nhiệt để định hình lại cấu trúc tóc, mang đến sóng tóc mềm, lơi và tự nhiên hơn.", whatToExpect: ["Kiểm tra độ đàn hồi", "Xử lý trước hóa chất", "Uốn kiểm soát nhiệt", "Định hình nếp"] },
    { id: 's4', name: "Phục Hồi Lụa Silk", desc: "Phục hồi chuyên sâu mang lại độ bóng mượt như gương.", price: "$150", duration: "90 PHÚT", img: "https://images.unsplash.com/photo-1604263445414-9dd62d2ac089?q=80&w=1000", fullDesc: "Giải cứu mái tóc hư tổn, làm hóa chất nhiều hay khô xơ tự nhiên với liệu trình Phục hồi Lụa thượng hạng. Liệu trình đa bước này sẽ truyền dưỡng chất keratin cao cấp, protein lụa và axit amin thiết yếu, khóa chặt vào biểu bì tóc.", whatToExpect: ["Gội làm sạch sâu", "Truyền dẫn protein", "Khóa biểu bì bằng nhiệt", "Tỉa tóc hoàn thiện"] },
  ]);

  return {
    PRODUCTS,
    SERVICES
  };
});
