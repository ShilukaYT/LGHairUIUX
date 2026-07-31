<script setup lang="ts">
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { CalendarDays, Briefcase, PlayCircle, LogOut, RefreshCcw, Clock, Sun, XCircle, AlertCircle, CheckCircle } from 'lucide-vue-next'
import { Html5Qrcode } from 'html5-qrcode'
const API_BASE_URL = 'https://localhost:7196/api/nhan-vien/ca-lam'
axios.defaults.withCredentials = true; // Bắt buộc để gửi kèm Cookie/Token

const formatDateDDMMYYYY = (dateInput?: any) => {
    if (!dateInput) {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}/${month}/${year}`;
    }
    if (typeof dateInput === 'string' && dateInput.includes('-')) {
        const parts = dateInput.substring(0, 10).split('-');
        if (parts.length === 3 && parts[0].length === 4) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
    }
    if (typeof dateInput === 'string' && dateInput.includes('/')) {
        const parts = dateInput.split('/');
        if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            return `${day}/${month}/${parts[2]}`;
        }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return formatDateDDMMYYYY();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

// State lưu trữ dữ liệu thực
const todayShift = ref({
    maLich: 0,
    ngay: formatDateDDMMYYYY(),
    caLam: 'Đang tải...',
    trangThai: 0,
})

const last7Days = ref<any[]>([])
const next7Days = ref<any[]>([])

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
        showSnackbar("Không tìm thấy thông tin đăng nhập!", "error")
        return
    }

    try {
        // Truyền maNv xuống Backend
        const res = await axios.get(`${API_BASE_URL}/ca-lam-va-lich-su`, {
            params: { maNv: currentMaNv }
        })

        if (res.data.success) {
            const allShifts = res.data.data
            
            const today = new Date();
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            // 1. Cập nhật bảng lịch sử 7 ngày gần nhất (xếp từ ngày mới nhất trở về trước)
            const pastAndToday = allShifts
                .filter((l: any) => l.ngayLamViec && l.ngayLamViec.substring(0, 10) <= todayStr)
                .sort((a: any, b: any) => (b.ngayLamViec > a.ngayLamViec ? 1 : -1))
                .slice(0, 7);
            
            last7Days.value = pastAndToday.map((l: any) => ({
                maLich: l.maLich,
                ngay: formatDateDDMMYYYY(l.ngayLamViec),
                caLam: l.caLam,
                trangThai: l.trangThai
            }))

            const future = allShifts
                .filter((l: any) => l.ngayLamViec && l.ngayLamViec.substring(0, 10) > todayStr)
                .sort((a: any, b: any) => (a.ngayLamViec > b.ngayLamViec ? 1 : -1))
                .slice(0, 7);

            next7Days.value = future.map((l: any) => ({
                maLich: l.maLich,
                ngay: formatDateDDMMYYYY(l.ngayLamViec),
                caLam: l.caLam,
                trangThai: l.trangThai
            }))

            // 2. Cập nhật thẻ trạng thái Hôm nay
            const tShift = allShifts.find((l: any) => l.ngayLamViec && l.ngayLamViec.substring(0, 10) === todayStr)
            if (tShift) {
                todayShift.value = {
                    maLich: tShift.maLich,
                    ngay: formatDateDDMMYYYY(tShift.ngayLamViec),
                    caLam: tShift.caLam,
                    trangThai: tShift.trangThai
                }
            } else {
                // HẾT BỊ KẸT "ĐANG TẢI...": Nếu mảng không có ca của hôm nay thì báo nghỉ
                todayShift.value = {
                    maLich: 0,
                    ngay: formatDateDDMMYYYY(),
                    caLam: 'Nghỉ / Không có ca',
                    trangThai: 0
                }
            }
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu:", error)
    }
}
// 3. Xử lý Điểm danh bằng QR Code
const isScannerOpen = ref(false)
const isScanning = ref(false)
let html5QrCode: Html5Qrcode | null = null

const startScanner = async () => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch(e) {}
    html5QrCode = null
  }

  isScannerOpen.value = true
  isScanning.value = true

  setTimeout(async () => {
    try {
      const element = document.getElementById("qr-reader")
      if (!element) {
        throw new Error("Khung hiển thị camera chưa sẵn sàng.")
      }

      html5QrCode = new Html5Qrcode("qr-reader")
      
      try {
        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          onScanFailure
        )
      } catch (camErr) {
        console.warn("Chuyển sang camera mặc định...", camErr)
        await html5QrCode.start(
          { facingMode: "user" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          onScanSuccess,
          onScanFailure
        )
      }
    } catch (err) {
      console.error("Lỗi khi mở camera: ", err)
      showSnackbar("Không thể mở camera. Vui lòng cấp quyền truy cập camera.", "error")
      isScannerOpen.value = false
      isScanning.value = false
    }
  }, 350)
}

const onScanSuccess = async (decodedText: string, decodedResult: any) => {
  if (html5QrCode) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch(e) {}
  }
  isScannerOpen.value = false
  isScanning.value = false
  
  submitCheckInQR(decodedText)
}

const onScanFailure = (error: any) => {
  // Bỏ qua lỗi scan liên tục
}

const closeScanner = async () => {
  if (html5QrCode && isScanning.value) {
    try {
      await html5QrCode.stop()
      html5QrCode.clear()
    } catch (e) {}
  }
  isScannerOpen.value = false
  isScanning.value = false
}

const submitCheckInQR = async (qrCode: string) => {
  if (!todayShift.value.maLich) return

  const user = getCurrentUser()
  const currentMaNv = user?.maNv || user?.MaNv

  try {
      const res = await axios.patch(`${API_BASE_URL}/diem-danh-qr/${todayShift.value.maLich}`, JSON.stringify(qrCode), {
          headers: {
            'Content-Type': 'application/json'
          },
          params: { maNv: currentMaNv }
      })

      if (res.data.success) {
          showSnackbar("Điểm danh thành công! Chúc bạn một ngày làm việc hiệu quả.", "success")
          fetchShifts()
      }
  } catch (error: any) {
      showSnackbar(error.response?.data?.message || "Đã xảy ra lỗi khi điểm danh.", "error")
  }
}

const handleCheckIn = () => {
  // Mở modal quét mã thay vì gọi API trực tiếp
  startScanner()
}

// 4. Xử lý Rời ca sớm
const isCheckoutModalOpen = ref(false)

const openCheckoutModal = () => {
  if (!todayShift.value.maLich) return
  isCheckoutModalOpen.value = true
}

const submitCheckOut = async () => {
    isCheckoutModalOpen.value = false
    
    const user = getCurrentUser()
    const currentMaNv = user?.maNv || user?.MaNv

    try {
        // THÊM PARAMS maNv VÀO ĐÂY
        const res = await axios.patch(`${API_BASE_URL}/roi-ca-som/${todayShift.value.maLich}`, null, {
            params: { maNv: currentMaNv }
        })

        if (res.data.success) {
            showSnackbar("Đã ghi nhận rời ca sớm.", "success")
            fetchShifts()
        }
    } catch (error: any) {
        showSnackbar(error.response?.data?.message || "Đã xảy ra lỗi khi đánh dấu rời ca.", "error")
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
    showSnackbar("Vui lòng chọn ca muốn đổi hoặc chọn Xin nghỉ.", "error")
    return
  }
  if (!requestReason.value.trim()) {
    showSnackbar("Vui lòng nhập lý do cụ thể.", "error")
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
      showSnackbar("Đã gửi yêu cầu thành công! Vui lòng chờ quản lý duyệt.", "success")
      isRequestModalOpen.value = false
      fetchShifts() 
    }
  } catch (error: any) {
    showSnackbar(error.response?.data?.message || "Đã xảy ra lỗi khi gửi yêu cầu.", "error")
  }
}

const isCheckInTimeValid = () => {
  const caLam = todayShift.value.caLam || '';
  const currentHour = new Date().getHours();
  
  if (caLam.includes('Ca sáng')) {
    // Sáng: Cho phép từ 6h đến trước 17h
    return currentHour >= 6 && currentHour < 17;
  } else if (caLam.includes('Ca chiều')) {
    // Chiều: Cho phép từ 11h đến trước 18h
    return currentHour >= 11 && currentHour < 18;
  } else if (caLam.includes('Ca tối')) {
    // Tối: Cho phép từ 12h đến trước 23h
    return currentHour >= 12 && currentHour < 23;
  }
  return true;
}

onMounted(() => {
    fetchShifts()
})

// --- SNACKBAR LOGIC ---
const isSnackbarOpen = ref(false)
const snackbarMessage = ref('')
const snackbarColor = ref('success')

const showSnackbar = (msg: string, color = 'success') => {
  snackbarMessage.value = msg
  snackbarColor.value = color
  isSnackbarOpen.value = true
}
</script>

<template>
  <v-container fluid>
    <div class="mb-6">
      <h2 class="text-h5 font-weight-bold">Ca làm việc của bạn</h2>
      <p class="text-body-2 text-medium-emphasis mt-1">Xem trạng thái ca làm hôm nay và lịch sử 7 ngày gần nhất.</p>
    </div>

    <v-row>
      <!-- Cột Trái: Hôm nay -->
      <v-col cols="12" md="4">
        <v-card elevation="2" rounded="xl" class="h-100 position-relative overflow-hidden">
          <div class="position-absolute" style="top: -20px; right: -20px; width: 100px; height: 100px; background-color: rgba(16, 185, 129, 0.1); border-radius: 50%; filter: blur(30px);"></div>
          
          <v-card-text class="pa-6 position-relative" style="z-index: 1;">
            <div class="d-flex align-center text-success mb-6">
              <CalendarDays class="mr-2" :size="20" />
              <h3 class="text-subtitle-1 font-weight-bold mb-0">Hôm nay, {{ todayShift.ngay }}</h3>
            </div>

            <div class="mb-4">
              <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold mb-1">Ca làm được phân công</div>
              <div class="d-flex align-center text-h6 font-weight-bold">
                <Briefcase class="text-indigo mr-2" :size="20" />
                {{ todayShift.caLam }}
              </div>
            </div>

            <div class="mb-6">
              <div class="text-caption text-uppercase text-medium-emphasis font-weight-bold mb-2">Trạng thái hiện tại</div>
              
              <v-chip v-if="todayShift.caLam === 'Nghỉ lễ'" color="error" variant="flat" class="font-weight-bold text-white">
                <template v-slot:prepend><Sun class="mr-1" :size="16" /></template>
                Nghỉ lễ
              </v-chip>
              <v-chip v-else-if="todayShift.caLam === 'Chưa xếp'" color="error" variant="tonal" class="font-weight-bold">
                <template v-slot:prepend><XCircle class="mr-1" :size="16" /></template>
                Không có ca
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 1" color="warning" variant="tonal" class="font-weight-bold">
                <template v-slot:prepend><AlertCircle class="mr-1" :size="16" /></template>
                Chờ điểm danh
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 2" color="success" variant="tonal" class="font-weight-bold">
                <template v-slot:prepend><CheckCircle class="mr-1" :size="16" /></template>
                Đang làm việc
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 3" color="blue-grey" variant="outlined" class="font-weight-bold">
                <template v-slot:prepend><LogOut class="mr-1" :size="16" /></template>
                Đã rời ca
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 4" color="info" variant="tonal" class="font-weight-bold">
                <template v-slot:prepend><Clock class="mr-1" :size="16" /></template>
                Xin đổi ca
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 5" color="error" variant="flat" class="font-weight-bold text-white">
                <template v-slot:prepend><XCircle class="mr-1" :size="16" /></template>
                Vắng mặt
              </v-chip>
              <v-chip v-else-if="todayShift.trangThai === 6" color="warning" variant="flat" class="font-weight-bold text-white">
                <template v-slot:prepend><AlertCircle class="mr-1" :size="16" /></template>
                Điểm danh muộn
              </v-chip>
              <v-chip v-else color="error" variant="tonal" class="font-weight-bold">
                <template v-slot:prepend><XCircle class="mr-1" :size="16" /></template>
                Không có ca
              </v-chip>
            </div>

            <v-divider class="my-4"></v-divider>

            <v-btn v-if="todayShift.trangThai === 1 && todayShift.caLam !== 'Chưa xếp' && todayShift.caLam !== 'Nghỉ lễ' && isCheckInTimeValid()" @click="handleCheckIn" color="success" block size="large" rounded="lg" class="mb-3 font-weight-bold text-none" elevation="2">
              <template v-slot:prepend><PlayCircle :size="20"/></template>
              Điểm danh vào ca
            </v-btn>

            <v-btn v-else-if="todayShift.trangThai === 1 && todayShift.caLam !== 'Chưa xếp' && todayShift.caLam !== 'Nghỉ lễ' && !isCheckInTimeValid()" disabled color="grey" block size="large" rounded="lg" class="mb-3 font-weight-bold text-none" elevation="2">
              <template v-slot:prepend><Clock :size="20"/></template>
              Chưa đến hoặc đã quá giờ điểm danh
            </v-btn>

            <v-btn v-if="(todayShift.trangThai === 1 && todayShift.caLam !== 'Nghỉ lễ') || todayShift.caLam === 'Chưa xếp'" @click="openRequestModal" color="info" variant="outlined" block size="large" rounded="lg" class="font-weight-bold text-none border-opacity-100 py-3" style="height: auto; white-space: normal; line-height: 1.4;">
              <template v-slot:prepend><RefreshCcw :size="20" class="mr-1" /></template>
              <span class="text-center">Gửi yêu cầu <br/><small>(Xếp ca / Đổi ca / Xin nghỉ)</small></span>
            </v-btn>

            <v-btn v-else-if="todayShift.trangThai === 2 || todayShift.trangThai === 6" @click="openCheckoutModal" color="warning" variant="outlined" block size="large" rounded="lg" class="font-weight-bold text-none border-opacity-100">
              <template v-slot:prepend><LogOut :size="20"/></template>
              Đánh dấu rời ca sớm
            </v-btn>

            <div v-else class="text-center text-caption text-medium-emphasis font-italic mt-2">
              Không có thao tác nào khả dụng.
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Cột Phải: Lịch sử -->
      <v-col cols="12" md="8">
        <v-card elevation="2" rounded="xl" class="h-100 d-flex flex-column">
          <v-card-title class="pa-5 d-flex align-center border-b bg-surface-light rounded-t-xl">
            <Clock class="mr-2 text-medium-emphasis" :size="20" />
            <span class="text-subtitle-1 font-weight-bold">Lịch sử 7 ngày gần nhất</span>
          </v-card-title>
          
          <v-table class="flex-grow-1">
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase text-caption text-medium-emphasis">Ngày làm việc</th>
                <th class="text-left font-weight-bold text-uppercase text-caption text-medium-emphasis">Ca được xếp</th>
                <th class="text-center font-weight-bold text-uppercase text-caption text-medium-emphasis">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="last7Days.length === 0">
                <td colspan="3" class="text-center text-medium-emphasis font-italic py-6">Chưa có dữ liệu lịch làm việc.</td>
              </tr>
              <tr v-for="item in last7Days" :key="item.maLich" class="hover-row">
                <td class="font-weight-bold">{{ item.ngay }}</td>
                <td class="font-weight-medium text-medium-emphasis">{{ item.caLam }}</td>
                <td class="text-center">
                  <v-chip v-if="item.caLam === 'Nghỉ lễ'" color="error" size="small" class="font-weight-bold text-white" variant="flat">Nghỉ lễ</v-chip>
                  <v-chip v-else-if="item.caLam === 'Chưa xếp'" color="error" size="small" class="font-weight-bold" variant="tonal">Không xếp ca</v-chip>
                  <v-chip v-else-if="item.trangThai === 2" color="success" size="small" class="font-weight-bold" variant="tonal">Có mặt</v-chip>
                  <v-chip v-else-if="item.trangThai === 3" color="warning" size="small" class="font-weight-bold" variant="tonal">Rời sớm</v-chip>
                  <v-chip v-else-if="item.trangThai === 1" color="blue-grey" size="small" class="font-weight-bold" variant="tonal">Chưa làm</v-chip>
                  <v-chip v-else-if="item.trangThai === 4" color="info" size="small" class="font-weight-bold" variant="tonal">Xin đổi ca</v-chip>
                  <v-chip v-else-if="item.trangThai === 5" color="error" size="small" class="font-weight-bold text-white" variant="flat">Vắng mặt</v-chip>
                  <v-chip v-else-if="item.trangThai === 6" color="warning" size="small" class="font-weight-bold text-white" variant="flat">Muộn</v-chip>
                  <span v-else class="text-medium-emphasis font-weight-bold">-</span>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- HÀNG MỚI: Ca làm sắp tới -->
    <v-row class="mt-4">
      <v-col cols="12">
        <v-card elevation="2" rounded="xl" class="d-flex flex-column">
          <v-card-title class="pa-5 d-flex align-center border-b bg-surface-light rounded-t-xl">
            <CalendarDays class="mr-2 text-medium-emphasis" :size="20" />
            <span class="text-subtitle-1 font-weight-bold">Ca làm sắp tới (7 ngày kế tiếp)</span>
          </v-card-title>
          
          <v-table>
            <thead>
              <tr>
                <th class="text-left font-weight-bold text-uppercase text-caption text-medium-emphasis">Ngày làm việc</th>
                <th class="text-left font-weight-bold text-uppercase text-caption text-medium-emphasis">Ca được xếp</th>
                <th class="text-center font-weight-bold text-uppercase text-caption text-medium-emphasis">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="next7Days.length === 0">
                <td colspan="3" class="text-center text-medium-emphasis font-italic py-6">Chưa có lịch làm việc sắp tới.</td>
              </tr>
              <tr v-for="item in next7Days" :key="item.maLich" class="hover-row">
                <td class="font-weight-bold">{{ item.ngay }}</td>
                <td class="font-weight-medium text-medium-emphasis">{{ item.caLam }}</td>
                <td class="text-center">
                  <v-chip v-if="item.caLam === 'Nghỉ lễ'" color="error" size="small" class="font-weight-bold text-white" variant="flat">Nghỉ lễ</v-chip>
                  <v-chip v-else-if="item.caLam === 'Chưa xếp'" color="error" size="small" class="font-weight-bold" variant="tonal">Không xếp ca</v-chip>
                  <v-chip v-else color="info" size="small" class="font-weight-bold" variant="tonal">Chờ đến ngày</v-chip>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Dialog Xin nghỉ/đổi ca -->
    <v-dialog v-model="isRequestModalOpen" max-width="500" persistent>
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between pt-4 px-6">
          <span class="text-h6 font-weight-bold">Xin đổi ca / Nghỉ phép</span>
          <v-btn icon="mdi-close" variant="text" size="small" @click="isRequestModalOpen = false"></v-btn>
        </v-card-title>
        
        <v-card-text class="px-6 pb-2">
          <p class="text-body-2 text-medium-emphasis mb-4 pb-4 border-b">
            Ca hiện tại: <span class="font-weight-bold text-high-emphasis">{{ todayShift.caLam }} ({{ todayShift.ngay }})</span>
          </p>

          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2">Bạn muốn đổi sang ca nào?</div>
          <v-select
            v-model="selectedNewShift"
            :items="[
              {title: 'Đổi sang Ca sáng (7h-17h)', value: 'Ca sáng (7h-17h)'},
              {title: 'Đổi sang Ca tối (13h-20h)', value: 'Ca tối (13h-20h)'},
              {title: 'Đổi sang Ca sáng (Part-time)', value: 'Ca sáng (Part-time)'},
              {title: 'Đổi sang Ca chiều (Part-time)', value: 'Ca chiều (Part-time)'},
              {title: 'Đổi sang Ca tối (Part-time)', value: 'Ca tối (Part-time)'},
              {title: 'Xin nghỉ hẳn (Không làm bù)', value: 'Nghỉ nguyên ngày'}
            ]"
            item-title="title"
            item-value="value"
            placeholder="-- Chọn ca muốn làm bù --"
            variant="outlined"
            density="comfortable"
            class="mb-4"
          ></v-select>

          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis mb-2">Lý do cụ thể</div>
          <v-textarea
            v-model="requestReason"
            placeholder="Ví dụ: Em có việc gia đình đột xuất..."
            variant="outlined"
            rows="3"
            auto-grow
            density="comfortable"
          ></v-textarea>
        </v-card-text>
        
        <v-card-actions class="px-6 pb-6 pt-0 d-flex gap-3">
          <v-btn @click="isRequestModalOpen = false" variant="tonal" color="blue-grey" class="flex-grow-1 font-weight-bold text-none" rounded="lg">Hủy bỏ</v-btn>
          <v-btn @click="submitRequest" color="primary" variant="flat" class="flex-grow-1 font-weight-bold text-none" rounded="lg">Gửi yêu cầu</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Quét mã QR -->
    <v-dialog v-model="isScannerOpen" max-width="400" persistent transition="dialog-bottom-transition">
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center justify-space-between pt-4 px-6 border-b">
          <span class="text-h6 font-weight-bold">Quét mã QR Điểm Danh</span>
        </v-card-title>
        <v-card-text class="pa-4 d-flex flex-column align-center">
          <div id="qr-reader" style="width: 100%; border-radius: 8px; overflow: hidden;"></div>
          <p class="text-caption mt-4 text-center text-medium-emphasis">Vui lòng quét mã QR trên màn hình của Quản lý để điểm danh.</p>
        </v-card-text>
        <v-card-actions class="px-6 pb-4 d-flex justify-center border-t">
          <v-btn @click="closeScanner" color="error" variant="flat" class="font-weight-bold text-none px-6" rounded="lg">Hủy</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Dialog Xác nhận Rời ca -->
    <v-dialog v-model="isCheckoutModalOpen" max-width="400">
      <v-card rounded="xl">
        <v-card-title class="d-flex align-center pt-4 px-6">
          <AlertCircle class="mr-2 text-warning" :size="24" />
          <span class="text-h6 font-weight-bold">Xác nhận rời ca</span>
        </v-card-title>
        <v-card-text class="px-6 py-4 text-body-1 text-medium-emphasis">
          Bạn có chắc chắn muốn đánh dấu rời ca sớm không?
        </v-card-text>
        <v-card-actions class="px-6 pb-4 pt-0 d-flex gap-3 justify-end">
          <v-btn @click="isCheckoutModalOpen = false" variant="outlined" color="grey-darken-1" class="font-weight-bold text-none" rounded="lg">Hủy</v-btn>
          <v-btn @click="submitCheckOut" color="warning" variant="flat" class="font-weight-bold text-none" rounded="lg">Xác nhận</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Snackbar Thông báo -->
    <v-snackbar
      v-model="isSnackbarOpen"
      :color="snackbarColor"
      timeout="3000"
      location="top right"
      elevation="24"
    >
      <div class="d-flex align-center">
        <v-icon left class="mr-2">{{ snackbarColor === 'success' ? 'mdi-check-circle' : 'mdi-alert-circle' }}</v-icon>
        <span class="font-weight-medium">{{ snackbarMessage }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" @click="isSnackbarOpen = false">Đóng</v-btn>
      </template>
    </v-snackbar>
  </v-container>
</template>

<style scoped>
.hover-row:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
