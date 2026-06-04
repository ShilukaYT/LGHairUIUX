<script setup>
import { ref, onMounted, computed } from 'vue';
// Import thư viện biểu đồ
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'

// Đăng ký các thành phần của biểu đồ
ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

// State quản lý bộ lọc
const today = new Date();
const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
// Hàm format ngày chuẩn theo giờ địa phương (YYYY-MM-DD) để tránh lỗi lùi ngày
const formatDateForInput = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startDate = ref(formatDateForInput(firstDay)); 
const endDate = ref(formatDateForInput(today));
const searchMaHd = ref('');

const stats = ref({
  doanhThuThangNay: 0,
  soHoaDonThangNay: 0,
  soVoucherDaDung: 0,
  topNhanVien: [],
  hoaDonGanDay: [],
  bieuDo: [] // Chứa data biểu đồ
});

const loading = ref(true);
const error = ref(null);

// Hàm gọi API kèm theo Query Params (Bộ lọc)
const fetchAdminData = async () => {
  try {
    loading.value = true;
    error.value = null;

    // Tạo chuỗi tham số ?startDate=...&endDate=...&searchMaHd=...
    const queryParams = new URLSearchParams({
      startDate: startDate.value,
      endDate: endDate.value,
      searchMaHd: searchMaHd.value
    }).toString();

    // SỬA LẠI CỔNG 7123 CHO KHỚP VỚI API CỦA BẠN NẾU KHÁC
    const response = await fetch(`https://localhost:7196/api/ThongKe/admin-dashboard?${queryParams}`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Không thể tải dữ liệu thống kê');

    stats.value = await response.json(); 
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
};

// Cấu hình Dữ liệu đưa vào biểu đồ
const chartData = computed(() => {
  return {
    labels: stats.value.bieuDo?.map(item => item.ngay) || [],
    datasets: [{
      label: 'Doanh thu (VNĐ)',
      backgroundColor: '#000000', // Màu cột đen giống theme Shadcn
      borderRadius: 4, // Bo góc cột
      data: stats.value.bieuDo?.map(item => item.doanhThu) || []
    }]
  }
});

// Cấu hình Options biểu đồ
const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false } // Ẩn nút chú thích để giao diện sạch hơn
  },
  scales: {
    y: { beginAtZero: true }
  }
};

const formatCurrency = (value) => {
  if (value == null) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('vi-VN');
};

onMounted(() => {
  fetchAdminData();
});
</script>

<template>
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      <p class="text-gray-500 text-sm mt-1">Báo cáo hiệu suất Salon</p>
    </div>

    <div class="bg-white p-4 rounded-lg border border-gray-200 flex flex-wrap gap-4 items-end">
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Từ ngày</label>
        <input type="date" v-model="startDate" class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black">
      </div>
      <div>
        <label class="block text-xs font-medium text-gray-700 mb-1">Đến ngày</label>
        <input type="date" v-model="endDate" class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black">
      </div>
      <div class="flex-1 min-w-[200px]">
        <label class="block text-xs font-medium text-gray-700 mb-1">Tìm mã hóa đơn</label>
        <input type="text" v-model="searchMaHd" @keyup.enter="fetchAdminData" placeholder="Nhập mã HĐ rồi ấn Enter..." class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-black">
      </div>
      <button @click="fetchAdminData" class="px-5 py-2 bg-black text-white text-sm font-medium rounded-md hover:bg-gray-800 transition shadow-sm h-[38px]">
        Lọc Dữ Liệu
      </button>
    </div>

    <div v-if="loading" class="text-center py-10 font-medium text-gray-500">Đang tải dữ liệu...</div>
    <div v-else-if="error" class="text-red-500 font-medium py-10">{{ error }}</div>

    <div v-else class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="bg-white p-5 rounded-lg border border-gray-200">
          <p class="text-sm font-medium text-gray-500">Doanh thu giai đoạn</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{{ formatCurrency(stats.doanhThuThangNay) }}</p>
        </div>
        <div class="bg-white p-5 rounded-lg border border-gray-200">
          <p class="text-sm font-medium text-gray-500">Số hóa đơn</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.soHoaDonThangNay }}</p>
        </div>
        <div class="bg-white p-5 rounded-lg border border-gray-200">
          <p class="text-sm font-medium text-gray-500">Voucher đã dùng</p>
          <p class="text-3xl font-bold text-gray-900 mt-2">{{ stats.soVoucherDaDung }}</p>
        </div>
      </div>

      <div class="bg-white p-5 rounded-lg border border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Biểu đồ doanh thu theo ngày</h2>
        <div class="h-72 w-full">
          <Bar v-if="stats.bieuDo && stats.bieuDo.length > 0" :data="chartData" :options="chartOptions" />
          <div v-else class="h-full flex items-center justify-center text-gray-400 text-sm">
            Không có dữ liệu doanh thu trong khoảng thời gian này.
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-lg border border-gray-200 col-span-1">
          <div class="px-5 py-4 border-b border-gray-200 font-semibold text-gray-900">Top Nhân Viên</div>
          <div class="p-5">
            <ul class="space-y-5">
              <li v-for="(nv, index) in stats.topNhanVien" :key="index" class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <div class="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-600 text-sm">
                    {{ index + 1 }}
                  </div>
                  <div>
                    <p class="font-medium text-gray-900 text-sm">{{ nv.tenNhanVien }}</p>
                    <p class="text-xs text-gray-500">{{ nv.soHoaDonPhuTrach }} hóa đơn</p>
                  </div>
                </div>
                <div class="font-semibold text-sm text-gray-900">{{ formatCurrency(nv.doanhThuMangLai) }}</div>
              </li>
              <li v-if="stats.topNhanVien.length === 0" class="text-gray-500 text-sm">Chưa có dữ liệu.</li>
            </ul>
          </div>
        </div>

        <div class="bg-white rounded-lg border border-gray-200 col-span-2">
          <div class="px-5 py-4 border-b border-gray-200 font-semibold text-gray-900">Giao dịch tìm thấy</div>
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 text-gray-500">
                <tr>
                  <th class="px-5 py-3 font-medium">Mã HĐ</th>
                  <th class="px-5 py-3 font-medium">Khách hàng</th>
                  <th class="px-5 py-3 font-medium">Ngày</th>
                  <th class="px-5 py-3 font-medium text-right">Tổng tiền</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr v-for="hd in stats.hoaDonGanDay" :key="hd.maHd" class="hover:bg-gray-50/50 transition">
                  <td class="px-5 py-3 font-medium text-gray-900">{{ hd.maHd }}</td>
                  <td class="px-5 py-3 text-gray-600">{{ hd.khachHang }}</td>
                  <td class="px-5 py-3 text-gray-600">{{ formatDate(hd.ngayTao) }}</td>
                  <td class="px-5 py-3 font-semibold text-gray-900 text-right">{{ formatCurrency(hd.tongTien) }}</td>
                </tr>
                <tr v-if="stats.hoaDonGanDay.length === 0">
                  <td colspan="4" class="px-5 py-8 text-center text-gray-500">Không tìm thấy hóa đơn nào khớp với bộ lọc.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>