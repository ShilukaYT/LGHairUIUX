<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import axios from 'axios';
import { useRouter } from 'vue-router';
import { Search, Calendar, ChevronLeft, ChevronRight, CalendarClock, XCircle } from 'lucide-vue-next';
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import ChiTietHoaDonModal from './ChiTietHoaDonModal.vue';
import HuyDonModal from './HuyDonModal.vue';
import DoiLichModal from './DoiLichModal.vue';

const router = useRouter();
const isLoading = ref(true);
const invoices = ref([]);

// Filters & Pagination states
const searchQuery = ref('');
const filterDate = ref('');
const sortBy = ref('newest');
const currentTab = ref('all');
const currentPage = ref(1);
const itemsPerPage = 5;

// Modal states
const isModalOpen = ref(false);
const selectedBookingId = ref('');
const isCancelModalOpen = ref(false);
const selectedCancelId = ref('');
const isRescheduleModalOpen = ref(false);
const selectedRescheduleId = ref('');
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

const API_URL = API + "/api/LichSuHoaDon/booking-history";

// Fetch booking history list from Backend
const fetchHistory = async () => {
  const customer = getCustomerInfo();
  const maKh = customer?.maKH;

  if (!maKh || maKh === 'GUEST') {
    isLoading.value = false;
    return;
  }

  try {
    isLoading.value = true;
    const response = await axios.get(`${API_URL}/${maKh}`);
    invoices.value = response.data || [];
  } catch (error) {
    console.error("Lỗi khi tải lịch sử:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchHistory();
});

// Formatting and mapping helpers
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN');
};

const formatPrice = (price) => {
  return price != null ? Number(price).toLocaleString('vi-VN') + 'đ' : '0đ';
};

const statusText = (status) => {
  const map = {
    pending: 'Đã cọc 10%',
    'paid-full': 'Đã trả 100%',
    completed: 'Hoàn thành',
    cancelled: 'Đã hủy'
  };
  return map[status] || 'Đang xử lý';
};

const getStatusBadgeClass = (status) => {
  const s = status?.toLowerCase() || '';
  if (s === 'pending') return 'bg-yellow-50 text-yellow-800 border-yellow-200';
  if (s === 'paid-full') return 'bg-blue-50 text-blue-800 border-blue-200';
  if (s === 'completed') return 'bg-green-50 text-green-800 border-green-200';
  if (s === 'cancelled') return 'bg-red-50 text-red-800 border-red-200';
  return 'bg-gray-50 text-gray-800 border-gray-200';
};

const getStatusDotClass = (status) => {
  const s = status?.toLowerCase() || '';
  if (s === 'pending') return 'bg-yellow-500';
  if (s === 'paid-full') return 'bg-blue-500';
  if (s === 'completed') return 'bg-green-500';
  if (s === 'cancelled') return 'bg-red-500';
  return 'bg-gray-500';
};

// Reset page to 1 on filters change
watch([searchQuery, filterDate, sortBy, currentTab], () => {
  currentPage.value = 1;
});

// Sorting and filtering
const filteredData = computed(() => {
  let data = [...invoices.value];

  // Status Tab Filter
  if (currentTab.value !== 'all') {
    data = data.filter(i => i.status === currentTab.value);
  }

  // Date Filter
  if (filterDate.value) {
    data = data.filter(i => {
      if (!i.date) return false;
      const itemDate = new Date(i.date).toISOString().split('T')[0];
      return itemDate === filterDate.value;
    });
  }

  // Text Search
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    data = data.filter(i =>
      (i.id && String(i.id).toLowerCase().includes(q)) ||
      (i.service && i.service.toLowerCase().includes(q))
    );
  }

  // Sort
  data.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return sortBy.value === 'newest' ? timeB - timeA : timeA - timeB;
  });

  return data;
});

// Pagination
const totalPages = computed(() => Math.ceil(filteredData.value.length / itemsPerPage) || 1);
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredData.value.slice(start, start + itemsPerPage);
});

// Handlers
const viewDetail = (item) => {
  selectedBookingId.value = item.id;
  isModalOpen.value = true;
};

const cancelOrder = (id) => {
  selectedCancelId.value = id;
  isCancelModalOpen.value = true;
};

const rescheduleOrder = (id) => {
  selectedRescheduleId.value = id;
  isRescheduleModalOpen.value = true;
};

const handleCancelSuccess = async () => {
  isCancelModalOpen.value = false;
  await fetchHistory();
};

const handleRescheduleSuccess = async () => {
  isRescheduleModalOpen.value = false;
  await fetchHistory();
};
</script>

<template>
  <div class="w-full text-black">
    <!-- Header Title -->
    <div class="mb-8 border-b border-gray-100 pb-4">
      <h2 class="font-heading text-xl uppercase tracking-widest text-black mb-1">Lịch Sử Hóa Đơn</h2>
      <p class="text-xs text-gray-500">Quản lý và theo dõi các lịch hẹn dịch vụ của bạn tại <span class="text-black font-semibold">LG Hair</span></p>
    </div>

    <!-- Toolbar / Filters -->
    <div class="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 mb-6">
      <!-- Search -->
      <div class="relative flex-1 max-w-md">
        <span class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search :size="14" class="text-gray-400" />
        </span>
        <input type="text" 
          placeholder="Tìm theo mã đơn hoặc dịch vụ..." 
          v-model="searchQuery" 
          class="w-full bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-9 pr-4 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm"
        />
      </div>

      <!-- Date picker and Sort -->
      <div class="flex items-center gap-3">
        <div class="relative flex items-center">
          <input type="date" 
            v-model="filterDate" 
            class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none px-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black shadow-sm"
          />
          <button 
            v-if="filterDate"
            @click="filterDate = ''"
            class="absolute right-2.5 text-gray-400 hover:text-red-500 transition-colors text-[10px] font-bold px-1 py-0.5 rounded-full hover:bg-gray-100"
            title="Xóa bộ lọc ngày"
          >
            ✕
          </button>
        </div>
        <div class="relative">
          <select v-model="sortBy" 
            class="bg-[#fcfcfc] border border-gray-200 focus:border-black focus:bg-white outline-none pl-3 pr-8 py-2.5 text-xs transition-all duration-200 rounded-sm text-black appearance-none shadow-sm cursor-pointer"
          >
            <option value="newest">Mới nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
          <span class="absolute inset-y-0 right-0 flex items-center pr-2.5 pointer-events-none">
            <svg class="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5"></path>
            </svg>
          </span>
        </div>
      </div>
    </div>

    <!-- Status Tabs -->
    <div class="flex flex-wrap gap-8 mb-8 border-b border-gray-100 pb-px">
      <button 
        v-for="tab in [
          { key: 'all', label: 'Tất cả' },
          { key: 'pending', label: 'Chờ xử lý' },
          { key: 'completed', label: 'Hoàn thành' },
          { key: 'cancelled', label: 'Đã hủy' }
        ]"
        :key="tab.key"
        @click="currentTab = tab.key"
        :class="['pb-3.5 text-[11px] uppercase tracking-widest font-semibold transition-all relative border-b-2 -mb-px', currentTab === tab.key ? 'border-black text-black font-extrabold' : 'border-transparent text-gray-400 hover:text-black']"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Loader -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-16">
      <div class="w-8 h-8 border-2 border-t-black border-gray-200 rounded-full animate-spin"></div>
      <p class="mt-4 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">Đang tải lịch sử hóa đơn...</p>
    </div>

    <!-- Table content -->
    <div v-else>
      <div class="overflow-x-auto w-full">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-gray-200 bg-gray-50/40 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              <th class="py-3.5 px-4 whitespace-nowrap">Mã đơn hàng</th>
              <th class="py-3.5 px-4 whitespace-nowrap">Ngày đặt</th>
              <th class="py-3.5 px-4 min-w-[200px]">Dịch vụ</th>
              <th class="py-3.5 px-4 whitespace-nowrap">Tổng tiền</th>
              <th class="py-3.5 px-4 whitespace-nowrap">Trạng thái</th>
              <th class="py-3.5 px-4 text-right whitespace-nowrap">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-if="paginatedData.length === 0">
              <td colspan="6" class="py-16 text-center">
                <Calendar class="w-8 h-8 mx-auto text-gray-200 mb-3" :stroke-width="1" />
                <p class="text-xs tracking-widest text-gray-400">Không tìm thấy lịch sử hóa đơn nào.</p>
              </td>
            </tr>
            
            <tr v-for="item in paginatedData" :key="item.id" class="hover:bg-gray-50/50 transition-colors cursor-pointer" @click="viewDetail(item)">
              <td class="py-4 px-4 text-xs font-bold text-black whitespace-nowrap tracking-wider">#{{ item.id }}</td>
              <td class="py-4 px-4 text-xs text-gray-500 whitespace-nowrap">{{ formatDate(item.date) }}</td>
              <td class="py-4 px-4 text-xs text-gray-900 max-w-[300px] truncate font-medium" :title="item.service">
                {{ item.service }}
              </td>
              <td class="py-4 px-4 text-xs font-bold text-black whitespace-nowrap font-mono">{{ formatPrice(item.amount) }}</td>
              <td class="py-4 px-4 text-xs whitespace-nowrap">
                <span :class="['inline-flex items-center px-3 py-1 text-[9px] uppercase tracking-widest font-bold rounded-full border', getStatusBadgeClass(item.status)]">
                  <span class="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" :class="getStatusDotClass(item.status)"></span>
                  {{ statusText(item.status) }}
                </span>
              </td>
              <td class="py-4 px-4 text-xs text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1.5">
                  <button 
                    v-if="item.status === 'pending' || item.status === 'paid-full'" 
                    @click.stop="rescheduleOrder(item.id)"
                    class="inline-flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold transition-all duration-200 rounded-sm whitespace-nowrap shrink-0"
                  >
                    <CalendarClock :size="12" /> Dời lịch
                  </button>
                  <button 
                    v-if="item.status === 'pending'" 
                    @click.stop="cancelOrder(item.id)"
                    class="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 text-[9px] uppercase tracking-wider font-bold transition-all duration-200 rounded-sm whitespace-nowrap shrink-0"
                  >
                    <XCircle :size="12" /> Hủy đơn
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
        <button 
          :disabled="currentPage === 1" 
          @click="currentPage--"
          class="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-black px-4 py-2 text-[10px] uppercase tracking-widest transition-colors rounded-sm"
        >
          Trước
        </button>
        <span class="text-xs text-gray-500 tracking-widest">Trang {{ currentPage }} / {{ totalPages }}</span>
        <button 
          :disabled="currentPage === totalPages" 
          @click="currentPage++"
          class="border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-white text-black px-4 py-2 text-[10px] uppercase tracking-widest transition-colors rounded-sm"
        >
          Sau
        </button>
      </div>
    </div>

    <!-- Modal components -->
    <ChiTietHoaDonModal 
      :isOpen="isModalOpen" 
      :bookingId="selectedBookingId" 
      @close="isModalOpen = false" 
    />
    <HuyDonModal
      :isOpen="isCancelModalOpen"
      :bookingId="selectedCancelId"
      @close="isCancelModalOpen = false"
      @success="handleCancelSuccess"
    />
    <DoiLichModal
      :isOpen="isRescheduleModalOpen"
      :bookingId="selectedRescheduleId"
      @close="isRescheduleModalOpen = false"
      @success="handleRescheduleSuccess"
    />
  </div>
</template>