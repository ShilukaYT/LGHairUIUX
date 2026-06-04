<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { CheckCircle2, Clock, CalendarDays, Briefcase, AlertCircle, PlayCircle, LogOut, X, RefreshCcw } from 'lucide-vue-next'
const API_BASE_URL = 'https://localhost:7196/api/nhan-vien/ca-lam'
axios.defaults.withCredentials = true; // Bắt buộc để gửi kèm Cookie/Token

// State lưu trữ dữ liệu thực
const todayShift = ref({
    maLich: 0,
    ngay: new Date().toLocaleDateString('vi-VN'),
    caLam: 'Đang tải...',
    trangThai: 0,
})

const last7Days = ref<any[]>([])

// 1. Hàm lấy thông tin nhân viên đang đăng nhập từ LocalStorage
const getCurrentUser = () => {
    const raw = sessionStorage.getItem("staffUser") || sessionStorage.getItem("nhanVienUser") || sessionStorage.getItem("adminUser")
    if (!raw) return null
    try {
        return JSON.parse(raw)
    } catch {
        return null
    }
}


const fetchShifts = async () => {
    const user = getCurrentUser()
    const currentMaNv = user?.maNv || user?.MaNv

    if (!currentMaNv) {
        alert("Không tìm thấy thông tin đăng nhập!")
        return
    }

    try {
        // Truyền maNv xuống Backend
        const res = await axios.get(`${API_BASE_URL}/ca-lam-va-lich-su`, {
            params: { maNv: currentMaNv }
        })

        if (res.data.success) {
            const allShifts = res.data.data
            const todayStr = new Date().toLocaleDateString('sv-SE') // Định dạng: yyyy-MM-dd

            // 1. Cập nhật bảng lịch sử 7 ngày
            last7Days.value = allShifts.map((l: any) => ({
                maLich: l.maLich,
                ngay: new Date(l.ngayLamViec).toLocaleDateString('vi-VN'),
                caLam: l.caLam,
                trangThai: l.trangThai
            }))

            // 2. Cập nhật thẻ trạng thái Hôm nay
            const tShift = allShifts.find((l: any) => l.ngayLamViec === todayStr)
            if (tShift) {
                todayShift.value = {
                    maLich: tShift.maLich,
                    ngay: new Date(tShift.ngayLamViec).toLocaleDateString('vi-VN'),
                    caLam: tShift.caLam,
                    trangThai: tShift.trangThai
                }
            } else {
                // HẾT BỊ KẸT "ĐANG TẢI...": Nếu mảng không có ca của hôm nay thì báo nghỉ
                todayShift.value = {
                    maLich: 0,
                    ngay: new Date().toLocaleDateString('vi-VN'),
                    caLam: 'Nghỉ / Không có ca',
                    trangThai: 0
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error)
    }
}
// 3. Xử lý Điểm danh
const handleCheckIn = async () => {
    if (!todayShift.value.maLich) return

    const user = getCurrentUser()
    const currentMaNv = user?.maNv || user?.MaNv

    try {
        // THÊM PARAMS maNv VÀO ĐÂY
        // Lưu ý cú pháp axios.patch(url, data, config), ở đây data là null
        const res = await axios.patch(`${API_BASE_URL}/diem-danh/${todayShift.value.maLich}`, null, {
            params: { maNv: currentMaNv }
        })

        if (res.data.success) {
            alert("Điểm danh thành công! Chúc bạn một ngày làm việc hiệu quả.")
            fetchShifts()
        }
    } catch (error: any) {
        alert(error.response?.data?.message || "Đã xảy ra lỗi khi điểm danh.")
    }
}

// 4. Xử lý Rời ca sớm
const handleCheckOut = async () => {
    if (!todayShift.value.maLich) return

    const confirmLeave = confirm("Bạn có chắc chắn muốn đánh dấu rời ca sớm không?")
    if (!confirmLeave) return

    const user = getCurrentUser()
    const currentMaNv = user?.maNv || user?.MaNv

    try {
        // THÊM PARAMS maNv VÀO ĐÂY
        const res = await axios.patch(`${API_BASE_URL}/roi-ca-som/${todayShift.value.maLich}`, null, {
            params: { maNv: currentMaNv }
        })

        if (res.data.success) {
            alert("Đã ghi nhận rời ca sớm.")
            fetchShifts()
        }
    } catch (error: any) {
        alert(error.response?.data?.message || "Đã xảy ra lỗi khi đánh dấu rời ca.")
    }
}

// Thêm biến lưu ca mới được chọn
const isRequestModalOpen = ref(false)
const requestReason = ref('')
const selectedNewShift = ref('') // ThÊM DÒNG NÀY

const openRequestModal = () => {
  requestReason.value = ''
  selectedNewShift.value = '' // Reset lại khi mở modal
  isRequestModalOpen.value = true
}

const submitRequest = async () => {
  // Validate kiểm tra xem đã chọn ca và nhập lý do chưa
  if (!selectedNewShift.value) {
    alert("Vui lòng chọn ca muốn đổi hoặc chọn Xin nghỉ.")
    return
  }
  if (!requestReason.value.trim()) {
    alert("Vui lòng nhập lý do cụ thể.")
    return
  }
  
  if (!todayShift.value.maLich) return

  const user = getCurrentUser()
  const currentMaNv = user?.maNv || user?.MaNv

  try {
    // Đóng gói cả Ca Mới và Lý Do thành 1 Object
    const payload = {
      caMoi: selectedNewShift.value,
      lyDo: requestReason.value
    }

    const res = await axios.patch(`${API_BASE_URL}/gui-yeu-cau/${todayShift.value.maLich}`, 
      payload, // Gửi Object thay vì chỉ gửi String như trước
      {
        params: { maNv: currentMaNv }
      }
    )
    
    if (res.data.success) {
      alert("Đã gửi yêu cầu thành công! Vui lòng chờ quản lý duyệt.")
      isRequestModalOpen.value = false
      fetchShifts() 
    }
  } catch (error: any) {
    alert(error.response?.data?.message || "Đã xảy ra lỗi khi gửi yêu cầu.")
  }
}

onMounted(() => {
    fetchShifts()
})
</script>

<template>
    <div class="space-y-6">
        <div>
            <h2 class="text-2xl font-bold text-slate-900">Ca làm việc của bạn</h2>
            <p class="mt-1 text-sm text-slate-500">Xem trạng thái ca làm hôm nay và lịch sử 7 ngày gần nhất.</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div class="md:col-span-1 space-y-6">
                <div class="bg-white rounded-2xl border shadow-sm p-6 overflow-hidden relative">
                    <div
                        class="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-50 rounded-full opacity-50 blur-2xl">
                    </div>

                    <div class="flex items-center gap-2 text-emerald-600 mb-6">
                        <CalendarDays class="w-5 h-5" />
                        <h3 class="font-bold">Hôm nay, {{ todayShift.ngay }}</h3>
                    </div>

                    <div class="space-y-4 relative z-10">
                        <div>
                            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Ca làm được
                                phân công</p>
                            <div class="flex items-center gap-2 font-bold text-slate-800 text-lg">
                                <Briefcase class="w-5 h-5 text-indigo-500" />
                                {{ todayShift.caLam }}
                            </div>
                        </div>

                        <div class="pt-2">
                            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Trạng thái
                                hiện tại</p>

                            <div v-if="todayShift.trangThai === 1"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-sm">
                                <AlertCircle class="w-4 h-4" /> Chờ điểm danh
                            </div>
                            <div v-else-if="todayShift.trangThai === 2"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-sm">
                                <CheckCircle2 class="w-4 h-4" /> Đang làm việc
                            </div>
                            <div v-else-if="todayShift.trangThai === 3"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold text-sm border border-slate-200">
                                <LogOut class="w-4 h-4" /> Đã rời ca
                            </div>
                            <div v-else-if="todayShift.trangThai === 4"
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
                                <Clock class="w-4 h-4" /> Xin đổi ca
                            </div>
                            <div v-else
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 text-rose-700 font-bold text-sm">
                                <X class="w-4 h-4" /> Không có ca
                            </div>
                        </div>
                    </div>

                    <div class="mt-8 pt-6 border-t border-slate-100">
                        <button v-if="todayShift.trangThai === 1" @click="handleCheckIn"
                            class="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-100 mb-3">
                            <PlayCircle class="w-5 h-5" /> Điểm danh vào ca
                        </button>

                        <button v-if="todayShift.trangThai === 1" @click="openRequestModal"
                            class="w-full h-11 bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                            <RefreshCcw class="w-5 h-5" /> Yêu cầu đổi ca / Xin nghỉ
                        </button>

                        <button v-else-if="todayShift.trangThai === 2" @click="handleCheckOut"
                            class="w-full h-11 bg-white border-2 border-amber-500 text-amber-600 hover:bg-amber-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
                            <LogOut class="w-5 h-5" /> Đánh dấu rời ca sớm
                        </button>

                        <div v-else class="text-center text-sm font-medium text-slate-400 italic">
                            Không có thao tác nào khả dụng.
                        </div>
                    </div>
                </div>
            </div>

            <div class="md:col-span-2">
                <div class="bg-white rounded-2xl border shadow-sm h-full flex flex-col overflow-hidden">
                    <div class="p-5 border-b flex items-center gap-2 bg-slate-50/50">
                        <Clock class="w-5 h-5 text-slate-400" />
                        <h3 class="font-bold text-slate-700">Lịch sử 7 ngày gần nhất</h3>
                    </div>

                    <div class="flex-1 overflow-auto custom-scrollbar">
                        <table class="w-full text-sm text-left">
                            <thead class="bg-slate-50/80 text-xs text-slate-500 uppercase font-bold sticky top-0">
                                <tr>
                                    <th class="px-6 py-4">Ngày làm việc</th>
                                    <th class="px-6 py-4">Ca được xếp</th>
                                    <th class="px-6 py-4 text-center">Tình trạng</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-if="last7Days.length === 0">
                                    <td colspan="3" class="px-6 py-8 text-center text-slate-400 italic">Chưa có dữ liệu
                                        lịch làm việc.</td>
                                </tr>
                                <tr v-for="item in last7Days" :key="item.maLich"
                                    class="border-b last:border-0 hover:bg-slate-50 transition-colors">
                                    <td class="px-6 py-4 font-semibold text-slate-700">{{ item.ngay }}</td>
                                    <td class="px-6 py-4 text-slate-600 font-medium">{{ item.caLam }}</td>
                                    <td class="px-6 py-4 text-center">
                                        <span v-if="item.trangThai === 2"
                                            class="inline-flex px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-xs font-bold border border-emerald-100">Có
                                            mặt</span>
                                        <span v-else-if="item.trangThai === 3"
                                            class="inline-flex px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-xs font-bold border border-amber-100">Rời
                                            sớm</span>
                                        <span v-else-if="item.trangThai === 1"
                                            class="inline-flex px-2 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-bold border border-slate-200">Chưa
                                            làm</span>
                                        <span v-else-if="item.trangThai === 4"
                                            class="inline-flex px-2 py-1 bg-blue-50 text-blue-600 rounded-md text-xs font-bold border border-blue-200">Xin
                                            đổi ca</span>
                                        <span v-else class="text-xs font-medium text-slate-400">-</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
    </div>
    <div v-if="isRequestModalOpen" class="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl border border-slate-100 transform transition-all">
        
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-lg font-bold text-slate-800">Xin đổi ca / Nghỉ phép</h3>
          <button @click="isRequestModalOpen = false" class="text-slate-400 hover:text-rose-500 transition-colors">
            <X class="w-5 h-5" />
          </button>
        </div>
        
        <p class="text-sm text-slate-500 mb-5 pb-4 border-b border-slate-100">
          Ca hiện tại: <span class="font-bold text-slate-700">{{ todayShift.caLam }} ({{ todayShift.ngay }})</span>
        </p>

        <div class="mb-4">
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Bạn muốn đổi sang ca nào?</label>
          <select v-model="selectedNewShift" class="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 cursor-pointer text-slate-700">
            <option value="" disabled selected>-- Chọn ca muốn làm bù --</option>
            <option value="Ca Sáng">Đổi sang Ca Sáng</option>
            <option value="Ca Chiều">Đổi sang Ca Chiều</option>
            <option value="Ca Tối">Đổi sang Ca Tối</option>
            <option value="Nghỉ nguyên ngày">Xin nghỉ hẳn (Không làm bù)</option>
          </select>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Lý do cụ thể</label>
          <textarea 
            v-model="requestReason" 
            class="w-full border border-slate-200 rounded-xl p-3 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-slate-50" 
            placeholder="Ví dụ: Em có việc gia đình đột xuất..."></textarea>
        </div>
        
        <div class="flex gap-3 mt-6">
          <button @click="isRequestModalOpen = false" class="flex-1 py-2.5 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl font-bold transition-colors">Hủy bỏ</button>
          <button @click="submitRequest" class="flex-1 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-xl font-bold transition-colors shadow-lg shadow-blue-200 flex items-center justify-center gap-2">
            <RefreshCcw class="w-4 h-4" /> Gửi yêu cầu
          </button>
        </div>
        
      </div>
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 10px;
}
</style>