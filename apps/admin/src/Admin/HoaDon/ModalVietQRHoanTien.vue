<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
  QrCode, 
  Copy, 
  Check, 
  Truck, 
  PackageCheck, 
  Ban, 
  CheckCircle2, 
  ExternalLink, 
  Clock, 
  AlertCircle,
  CreditCard,
  Building2,
  UserCheck,
  X,
  PlusCircle,
  RefreshCw
} from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  maHd: string;
  tongTien?: number;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'updated'): void;
}>();

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const getAuthHeaders = () => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken') || sessionStorage.getItem('access_token') || sessionStorage.getItem('accessToken');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

const popularBanks = [
  { code: 'MB', name: 'MBBank (Ngân Hàng Quân Đội)' },
  { code: 'VCB', name: 'Vietcombank' },
  { code: 'TCB', name: 'Techcombank' },
  { code: 'ICB', name: 'VietinBank' },
  { code: 'BIDV', name: 'BIDV' },
  { code: 'ACB', name: 'ACB (Á Châu)' },
  { code: 'VPB', name: 'VPBank' },
  { code: 'TPB', name: 'TPBank' },
  { code: 'STB', name: 'Sacombank' },
  { code: 'HDB', name: 'HDBank' },
  { code: 'VIB', name: 'VIB' },
  { code: 'MSB', name: 'MSB' }
];

const formatPrice = (p?: number) => {
  return p != null ? p.toLocaleString('vi-VN') + '₫' : '0₫';
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '---';
  return new Date(dateStr).toLocaleString('vi-VN');
};

const isLoading = ref(false);
const returnData = ref<any>(null);
const isCopiedStk = ref(false);
const isManualMode = ref(false);

const manualForm = ref({
  bankCode: 'MB',
  bankAccountNumber: '',
  bankAccountHolder: '',
  amount: props.tongTien || 0
});

const activeBankCode = computed(() => returnData.value?.maNganHang || (isManualMode.value ? manualForm.value.bankCode : ''));
const activeStk = computed(() => returnData.value?.soTaiKhoan || (isManualMode.value ? manualForm.value.bankAccountNumber : ''));
const activeHolder = computed(() => returnData.value?.tenChuTaiKhoan || (isManualMode.value ? manualForm.value.bankAccountHolder : ''));
const activeAmount = computed(() => Math.round(returnData.value?.soTienHoan || manualForm.value.amount || props.tongTien || 0));

const vietQrUrl = computed(() => {
  if (!activeBankCode.value || !activeStk.value) return '';
  const memo = encodeURIComponent(`HOAN TIEN DON ${props.maHd}`);
  const name = encodeURIComponent(activeHolder.value || '');
  return `https://img.vietqr.io/image/${activeBankCode.value}-${activeStk.value}-compact2.png?amount=${activeAmount.value}&addInfo=${memo}&accountName=${name}`;
});

const getTrackingLink = (courier?: string, code?: string) => {
  if (!code) return '#';
  const c = (courier || '').toLowerCase();
  if (c.includes('ghn') || c.includes('nhanh')) {
    return `https://donhang.ghn.vn/?order_code=${code}`;
  }
  if (c.includes('ghtk') || c.includes('tiết kiệm')) {
    return `https://i.ghtk.vn/${code}`;
  }
  if (c.includes('viettel')) {
    return `https://viettelpost.vn/tra-cuu-hanh-trinh-don/?bill=${code}`;
  }
  if (c.includes('vnpost') || c.includes('bưu điện')) {
    return `http://www.vnpost.vn/vi-vn/dinh-vi/buu-pham?key=${code}`;
  }
  return `https://www.google.com/search?q=tra+cuu+van+don+${code}`;
};

const copyToClipboard = (text: string) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  isCopiedStk.value = true;
  setTimeout(() => {
    isCopiedStk.value = false;
  }, 2000);
};

const fetchReturnDetails = async () => {
  if (!props.maHd) return;
  isLoading.value = true;
  isManualMode.value = false;
  manualForm.value.amount = props.tongTien || 0;

  try {
    const res = await axios.get(`${API_BASE_URL}/api/hoan-hang/chi-tiet/${props.maHd}`, {
      headers: getAuthHeaders()
    });
    if (res.data && res.data.hasData) {
      returnData.value = res.data.data;

      // Đồng bộ fallback từ localStorage nếu vừa cập nhật bưu kiện
      if (!returnData.value.maVanDon) {
        const localVandon = localStorage.getItem(`hoan_hang_vandon_${props.maHd}`);
        if (localVandon) {
          try {
            const parsed = JSON.parse(localVandon);
            if (parsed.maVanDon) {
              returnData.value.maVanDon = parsed.maVanDon;
              returnData.value.donViVanChuyen = parsed.donViVanChuyen || returnData.value.donViVanChuyen;
              returnData.value.hinhAnhBienLai = parsed.hinhAnhBienLai || returnData.value.hinhAnhBienLai;
              if (returnData.value.trangThai < 3) {
                returnData.value.trangThai = 3;
              }
            }
          } catch (e) {}
        }
      }
      if (returnData.value.trangThai === 5) {
        localStorage.setItem(`hoan_hang_status_${props.maHd}`, '6');
      } else if (returnData.value.trangThai === 4) {
        localStorage.setItem(`hoan_hang_status_${props.maHd}`, '5');
      }
    } else {
      returnData.value = null;
    }
  } catch (err) {
    console.error('Lỗi khi tải chi tiết hoàn hàng:', err);
    returnData.value = null;
  } finally {
    isLoading.value = false;
  }
};

watch(() => props.isOpen, (val) => {
  if (val) {
    fetchReturnDetails();
  } else {
    returnData.value = null;
    isManualMode.value = false;
  }
});

// THAO TÁC ADMIN 1: DUYỆT YÊU CẦU HOÀN
const handleApprove = async () => {
  const result = await Swal.fire({
    title: 'Duyệt yêu cầu hoàn hàng?',
    text: `Xác nhận duyệt yêu cầu hoàn đơn #${props.maHd} để khách gửi hàng về Salon.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Duyệt yêu cầu',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#334155'
  });
  if (!result.isConfirmed) return;

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/duyet-yeu-cau/${props.maHd}`, {
      dongY: true
    }, { headers: getAuthHeaders() });

    Swal.fire({
      icon: 'success',
      title: 'Đã duyệt yêu cầu!',
      text: res.data?.message || 'Đã chấp thuận yêu cầu đổi trả của khách hàng.',
      confirmButtonColor: '#334155'
    });
    fetchReturnDetails();
    emit('updated');
  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Lỗi', text: err.response?.data?.message || 'Lỗi khi duyệt yêu cầu hoàn.', confirmButtonColor: '#334155' });
  }
};

// THAO TÁC ADMIN 2: TỪ CHỐI YÊU CẦU HOÀN
const handleReject = async () => {
  const { value: reason } = await Swal.fire({
    title: 'Từ chối yêu cầu hoàn hàng',
    input: 'textarea',
    inputLabel: 'Lý do từ chối (bắt buộc):',
    inputPlaceholder: 'Nhập lý do chi tiết từ chối...',
    showCancelButton: true,
    confirmButtonText: 'Xác nhận Từ Chối',
    cancelButtonText: 'Hủy bỏ',
    confirmButtonColor: '#dc2626',
    inputValidator: (value) => {
      if (!value || !value.trim()) {
        return 'Vui lòng nhập lý do từ chối!';
      }
    }
  });

  if (!reason) return;

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/duyet-yeu-cau/${props.maHd}`, {
      dongY: false,
      lyDoTuChoi: reason
    }, { headers: getAuthHeaders() });

    Swal.fire({
      icon: 'info',
      title: 'Đã từ chối hoàn hàng',
      text: res.data?.message || 'Đã từ chối yêu cầu đổi trả.',
      confirmButtonColor: '#334155'
    });
    fetchReturnDetails();
    emit('updated');
  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Lỗi', text: err.response?.data?.message || 'Lỗi khi từ chối yêu cầu.', confirmButtonColor: '#334155' });
  }
};

// THAO TÁC ADMIN 3: XÁC NHẬN ĐÃ NHẬN ĐƯỢC HÀNG & NHẬP KHO (TỰ ĐỘNG CỘNG TỒN KHO)
const handleRestock = async () => {
  if (!returnData.value?.maVanDon) {
    Swal.fire({
      icon: 'warning',
      title: 'Chưa có mã vận đơn!',
      text: 'Khách hàng chưa cập nhật mã vận đơn bưu phẩm và ảnh biên lai gửi hàng. Không thể nhận hàng để tránh trường hợp khai khống!',
      confirmButtonColor: '#334155'
    });
    return;
  }

  const result = await Swal.fire({
    title: 'Xác nhận đã nhận hàng bưu phẩm?',
    html: `Bạn đã nhận được kiện hàng <b>#${props.maHd}</b> (Vận đơn: <b>${returnData.value.donViVanChuyen || ''} - ${returnData.value.maVanDon}</b>) và kiểm tra nguyên vẹn?<br/><br/><small class="text-gray-500">Hệ thống sẽ tự động nhập lại số lượng sản phẩm vào kho tồn và cho phép hoàn tiền.</small>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Đã nhận & Nhập kho',
    cancelButtonText: 'Chưa nhận',
    confirmButtonColor: '#334155'
  });
  if (!result.isConfirmed) return;

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/nhan-hang-nhap-kho/${props.maHd}`, {}, {
      headers: getAuthHeaders()
    });

    Swal.fire({
      icon: 'success',
      title: 'Đã nhập kho thành công!',
      text: res.data?.message || 'Đã nhận hàng hoàn và hoàn trả số lượng vào kho. Bây giờ bạn có thể quét VietQR và hoàn tiền.',
      confirmButtonColor: '#334155'
    });
    localStorage.setItem(`hoan_hang_status_${props.maHd}`, '5');
    fetchReturnDetails();
    emit('updated');
  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Lỗi', text: err.response?.data?.message || 'Lỗi khi nhập kho hàng hoàn.', confirmButtonColor: '#334155' });
  }
};

// THAO TÁC ADMIN 4: XÁC NHẬN ĐÃ CHUYỂN TIỀN HOÀN QUA VIETQR (CHỈ KHI ĐÃ NHẬP KHO XONG - TRẠNG THÁI 5)
const handleCompleteRefund = async () => {
  const result = await Swal.fire({
    title: 'Xác nhận đã chuyển tiền hoàn?',
    html: `Bạn đã quét mã VietQR và <b>chuyển tiền hoàn ${formatPrice(activeAmount.value)}</b> cho khách thành công?`,
    icon: 'success',
    showCancelButton: true,
    confirmButtonText: 'Xác nhận Đã hoàn tiền',
    cancelButtonText: 'Chưa chuyển',
    confirmButtonColor: '#059669'
  });
  if (!result.isConfirmed) return;

  try {
    const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/xac-nhan-hoan-tien-xong/${props.maHd}`, {}, {
      headers: getAuthHeaders()
    });

    localStorage.setItem(`hoan_hang_status_${props.maHd}`, '6');
    emit('close');
    emit('updated');

    Swal.fire({
      icon: 'success',
      title: 'Hoàn tất hoàn tiền 100%!',
      text: res.data?.message || 'Đơn hàng đã được chuyển sang trạng thái Đã hoàn tiền (Trạng thái 6)!',
      confirmButtonColor: '#0f172a'
    });
  } catch (err: any) {
    Swal.fire({ icon: 'error', title: 'Lỗi', text: err.response?.data?.message || 'Lỗi khi xác nhận hoàn tiền.' });
  }
};
</script>

<template>
  <v-dialog :model-value="isOpen" max-width="850px" persistent scrollable @update:model-value="emit('close')">
    <v-card rounded="xl">
      
      <!-- Dialog Header (Chuẩn theme bg-primary của Admin HoaDon.vue) -->
      <v-card-title class="pa-6 pb-4 d-flex align-center justify-space-between bg-primary text-white border-b">
        <div class="d-flex align-center gap-3">
          <v-avatar color="white" size="42" rounded="lg" elevation="2">
            <QrCode class="w-5 h-5 text-primary" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0 text-white">
              XỬ LÝ HOÀN HÀNG & VIETQR
            </h3>
            <p class="text-caption text-white opacity-80 mb-0 font-mono">
              Mã đơn hàng: #{{ maHd }} • Số tiền: {{ formatPrice(activeAmount) }}
            </p>
          </div>
        </div>

        <v-btn icon variant="text" density="comfortable" color="white" @click="emit('close'); emit('updated');">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>

      <!-- Dialog Body -->
      <v-card-text class="pa-6">
        <!-- Loading State -->
        <div v-if="isLoading" class="text-center py-12">
          <v-progress-circular indeterminate color="primary" size="48"></v-progress-circular>
          <div class="text-caption text-medium-emphasis mt-3 font-weight-bold">Đang tải thông tin hoàn hàng...</div>
        </div>

        <!-- Khi chưa có yêu cầu từ khách và chưa mở chế độ tạo mã thủ công -->
        <div v-else-if="!returnData && !isManualMode" class="text-center py-8">
          <v-avatar color="grey-lighten-4" size="56" class="mb-3">
            <AlertCircle class="w-7 h-7 text-medium-emphasis" />
          </v-avatar>
          <div class="text-subtitle-1 font-weight-bold mb-1">Chưa có yêu cầu hoàn tiền cho đơn hàng này</div>
          <div class="text-caption text-medium-emphasis mb-5">
            Khách hàng chưa gửi yêu cầu hoàn tiền trên website cho đơn hàng #{{ maHd }}.
          </div>
          
          <v-btn 
            color="primary" 
            variant="flat" 
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="isManualMode = true"
          >
            <PlusCircle class="w-4 h-4 mr-1.5" />
            Nhập STK tạo mã VietQR hoàn tiền ngay
          </v-btn>
        </div>

        <!-- Giao diện hiển thị VietQR & Thông tin bưu phẩm -->
        <div v-else class="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          <!-- Cột Trái: Mã VietQR Động + Hướng dẫn quét -->
          <div class="md:col-span-5 flex flex-col items-center justify-center p-4 bg-surface rounded-xl border">
            <div class="text-center mb-3">
              <v-chip color="primary" size="small" variant="tonal" class="font-weight-bold text-uppercase">
                VietQR Chuyển Khoản 24/7
              </v-chip>
            </div>

            <!-- Khung ảnh QR VietQR -->
            <div class="relative bg-white p-3 rounded-xl shadow-sm border w-full max-w-[240px] aspect-square flex items-center justify-center overflow-hidden">
              <img 
                v-if="vietQrUrl" 
                :src="vietQrUrl" 
                alt="VietQR Hoàn Tiền" 
                class="w-full h-full object-contain"
              />
              <div v-else class="text-center text-caption text-medium-emphasis p-4">
                Vui lòng điền đủ Ngân hàng và Số tài khoản để tạo mã QR
              </div>
            </div>

            <div class="text-center mt-3 w-full">
              <div class="text-caption font-weight-bold">Mở App Ngân hàng bất kỳ để quét</div>
              <div class="text-caption text-medium-emphasis mt-0.5">
                Nội dung chuyển: <strong class="font-mono text-primary">HOAN TIEN DON {{ maHd }}</strong>
              </div>
            </div>
          </div>

          <!-- Cột Phải: Chi tiết tài khoản ngân hàng & Tiến trình -->
          <div class="md:col-span-7 space-y-4">
            
            <!-- TRƯỜNG HỢP 1: Có dữ liệu yêu cầu hoàn hàng từ khách -->
            <template v-if="returnData">
              <!-- Trạng thái tiến trình -->
              <v-card variant="outlined" rounded="lg" class="pa-3.5 bg-surface border">
                <div class="text-caption font-weight-bold text-medium-emphasis text-uppercase mb-2">
                  Tiến Trình Đổi Trả
                </div>
                <div class="d-flex align-center gap-2">
                  <v-chip 
                    :color="
                      returnData.trangThai === 1 ? 'warning' :
                      returnData.trangThai === 2 ? 'info' :
                      returnData.trangThai === 3 ? 'orange' :
                      returnData.trangThai === 4 ? 'purple' :
                      returnData.trangThai === 5 ? 'success' : 'error'
                    "
                    variant="flat"
                    size="small"
                    class="font-weight-bold"
                  >
                    {{ 
                      returnData.trangThai === 1 ? 'Chờ Salon Duyệt' :
                      returnData.trangThai === 2 ? 'Đã Duyệt - Chờ Gửi Hàng' :
                      returnData.trangThai === 3 ? 'Khách Đã Gửi Bưu Phẩm' :
                      returnData.trangThai === 4 ? 'Đã Nhận Hàng & Nhập Kho' :
                      returnData.trangThai === 5 ? 'Đã Hoàn Tiền Thành Công' : 'Đã Từ Chối'
                    }}
                  </v-chip>
                  <span class="text-caption text-medium-emphasis font-mono">
                    {{ formatDate(returnData.ngayYeuCau) }}
                  </span>
                </div>
              </v-card>

              <!-- Thẻ thông tin tài khoản ngân hàng -->
              <v-card variant="outlined" rounded="lg" class="pa-4 bg-surface border space-y-2.5">
                <div class="flex items-center justify-between">
                  <div class="text-subtitle-2 font-weight-bold d-flex align-center gap-1.5 text-primary">
                    <Building2 class="w-4 h-4" />
                    {{ returnData.tenNganHang || returnData.maNganHang }}
                  </div>
                  <v-chip size="x-small" color="primary" variant="tonal" class="font-mono font-weight-bold">
                    {{ returnData.maNganHang }}
                  </v-chip>
                </div>

                <!-- Số tài khoản + Copy button -->
                <div class="flex items-center justify-between bg-surface p-2.5 rounded-lg border">
                  <div>
                    <div class="text-[10px] text-medium-emphasis font-weight-bold text-uppercase">SỐ TÀI KHOẢN</div>
                    <div class="text-h6 font-weight-black font-mono">{{ returnData.soTaiKhoan }}</div>
                  </div>
                  <v-btn 
                    size="small" 
                    variant="tonal" 
                    color="primary" 
                    rounded="lg"
                    class="text-none font-weight-bold"
                    @click="copyToClipboard(returnData.soTaiKhoan)"
                  >
                    <Check v-if="isCopiedStk" class="w-3.5 h-3.5 mr-1" />
                    <Copy v-else class="w-3.5 h-3.5 mr-1" />
                    {{ isCopiedStk ? 'Đã copy' : 'Sao chép' }}
                  </v-btn>
                </div>

                <!-- Tên chủ tài khoản -->
                <div class="flex items-center justify-between text-caption">
                  <span class="text-medium-emphasis">Chủ tài khoản:</span>
                  <span class="font-weight-bold text-uppercase font-mono">{{ returnData.tenChuTaiKhoan }}</span>
                </div>

                <!-- Số tiền hoàn -->
                <div class="flex items-center justify-between text-caption border-t pt-2">
                  <span class="text-medium-emphasis">Số tiền hoàn lại:</span>
                  <span class="text-subtitle-1 font-weight-black text-error font-mono">{{ formatPrice(returnData.soTienHoan || tongTien) }}</span>
                </div>
              </v-card>

              <!-- Lý do khách hàng & Mã vận đơn bưu cục -->
              <v-card variant="outlined" rounded="lg" class="pa-3.5 bg-surface border space-y-2 text-caption">
                <div>
                  <span class="font-weight-bold text-medium-emphasis">Lý do hoàn trả: </span>
                  <span class="font-weight-medium">{{ returnData.lyDoHoan }}</span>
                  <p v-if="returnData.ghiChuKhach" class="text-medium-emphasis italic mt-0.5 mb-0">{{ returnData.ghiChuKhach }}</p>
                </div>

                <div v-if="returnData.maVanDon" class="border-t pt-2 flex items-center justify-between">
                  <div>
                    <span class="font-weight-bold text-medium-emphasis">Bưu kiện: </span>
                    <span class="font-weight-bold text-primary font-mono">{{ returnData.donViVanChuyen }} - #{{ returnData.maVanDon }}</span>
                  </div>
                  <a 
                    :href="getTrackingLink(returnData.donViVanChuyen, returnData.maVanDon)" 
                    target="_blank" 
                    class="text-primary hover:underline font-weight-bold text-caption flex items-center gap-1"
                  >
                    Tra cứu bưu phẩm <ExternalLink class="w-3.5 h-3.5" />
                  </a>
                </div>

                <!-- Cảnh báo nếu khách chưa cung cấp mã vận đơn -->
                <div v-else-if="returnData.trangThai === 2" class="border-t pt-2 text-warning font-weight-bold flex items-center gap-1.5">
                  <AlertCircle class="w-4 h-4" />
                  <span>Chưa có mã vận đơn (Đang chờ khách mang bưu phẩm ra bưu cục gửi)</span>
                </div>

                <!-- Ảnh biên lai gửi hàng nếu có -->
                <div v-if="returnData.hinhAnhBienLai" class="border-t pt-2">
                  <div class="font-weight-bold text-medium-emphasis mb-1.5 flex items-center gap-1">
                    <span>📸 Ảnh biên lai / Bill gửi:</span>
                  </div>
                  <div class="relative group w-32 h-24 rounded-lg overflow-hidden border bg-surface shadow-sm">
                    <a :href="returnData.hinhAnhBienLai.startsWith('http') || returnData.hinhAnhBienLai.startsWith('data:') ? returnData.hinhAnhBienLai : `${API_BASE_URL}${returnData.hinhAnhBienLai}`" target="_blank">
                      <img 
                        :src="returnData.hinhAnhBienLai.startsWith('http') || returnData.hinhAnhBienLai.startsWith('data:') ? returnData.hinhAnhBienLai : `${API_BASE_URL}${returnData.hinhAnhBienLai}`" 
                        alt="Biên lai gửi hàng" 
                        class="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                      />
                      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-weight-bold text-uppercase">
                        Xem ảnh lớn
                      </div>
                    </a>
                  </div>
                </div>
              </v-card>
            </template>

            <!-- TRƯỜNG HỢP 2: Chế độ Admin tạo mã VietQR thủ công -->
            <template v-else>
              <v-card variant="outlined" rounded="lg" class="pa-4 bg-surface border space-y-3">
                <div class="text-caption font-weight-bold text-uppercase flex items-center justify-between">
                  <span>🛠️ Nhập Thông Tin Nhận Tiền Của Khách</span>
                  <v-btn size="x-small" variant="text" color="error" class="text-none" @click="isManualMode = false">
                    Hủy nhập
                  </v-btn>
                </div>

                <div class="space-y-1">
                  <label class="block text-caption font-weight-bold text-medium-emphasis">Ngân hàng nhận tiền:</label>
                  <select 
                    v-model="manualForm.bankCode" 
                    class="w-full bg-surface border rounded px-2.5 py-1.5 text-caption font-medium focus:border-primary outline-none"
                  >
                    <option v-for="b in popularBanks" :key="b.code" :value="b.code">{{ b.name }}</option>
                  </select>
                </div>

                <div class="space-y-1">
                  <label class="block text-caption font-weight-bold text-medium-emphasis">Số tài khoản ngân hàng:</label>
                  <input 
                    type="text" 
                    v-model="manualForm.bankAccountNumber" 
                    placeholder="Nhập STK ngân hàng của khách..." 
                    class="w-full bg-surface border rounded px-2.5 py-1.5 text-caption font-mono font-weight-bold focus:border-primary outline-none"
                  />
                </div>

                <div class="space-y-1">
                  <label class="block text-caption font-weight-bold text-medium-emphasis">Tên chủ tài khoản (Viết hoa không dấu):</label>
                  <input 
                    type="text" 
                    v-model="manualForm.bankAccountHolder" 
                    placeholder="VD: NGUYEN VAN A" 
                    class="w-full bg-surface border rounded px-2.5 py-1.5 text-caption text-uppercase font-weight-bold focus:border-primary outline-none"
                  />
                </div>

                <div class="space-y-1">
                  <label class="block text-caption font-weight-bold text-medium-emphasis">Số tiền hoàn (VNĐ):</label>
                  <input 
                    type="number" 
                    v-model.number="manualForm.amount" 
                    class="w-full bg-surface border rounded px-2.5 py-1.5 text-caption font-mono font-weight-bold text-error focus:border-primary outline-none"
                  />
                </div>
              </v-card>
            </template>

          </div>
        </div>
      </v-card-text>

      <!-- Footer Action Buttons (TUÂN THỦ TUYỆT ĐỐI THEO TRÌNH TỰ BẢO VỆ CHỐNG KHAI KHỐNG) -->
      <v-card-actions class="pa-4 bg-surface border-t d-flex justify-space-between flex-wrap gap-2">
        <v-btn 
          variant="outlined" 
          color="grey-darken-1" 
          rounded="lg"
          class="text-none font-weight-bold px-5" 
          @click="emit('close'); emit('updated');"
        >
          Đóng cửa sổ
        </v-btn>

        <div class="d-flex align-center gap-2 flex-wrap">
          <!-- Khi có returnData -->
          <template v-if="returnData">
            <!-- BƯỚC 1: Khi trạng thái = 1 (Chờ duyệt): Có nút Duyệt & Từ chối -->
            <template v-if="returnData.trangThai === 1">
              <v-btn 
                color="error" 
                variant="outlined" 
                rounded="lg"
                class="text-none font-weight-bold px-4" 
                @click="handleReject"
              >
                <Ban class="w-4 h-4 mr-1.5" />
                Từ chối hoàn
              </v-btn>
              <v-btn 
                rounded="lg"
                class="text-none font-weight-bold shadow-md px-5 text-white" 
                style="background-color: #334155 !important; color: #ffffff !important;"
                @click="handleApprove"
              >
                <CheckCircle2 class="w-4 h-4 mr-1.5 text-white" />
                Duyệt yêu cầu
              </v-btn>
            </template>

            <!-- BƯỚC 2: Khi đã duyệt (Trạng thái = 2) & Khách CHƯA gửi mã vận đơn -->
            <template v-else-if="returnData.trangThai === 2 && !returnData.maVanDon">
              <v-chip color="warning" variant="tonal" class="font-weight-bold text-caption">
                ⏳ Chờ khách cập nhật mã vận đơn bưu phẩm
              </v-chip>
            </template>

            <!-- BƯỚC 3: Khi khách ĐÃ CÓ MÃ VẬN ĐƠN (Trạng thái = 3 hoặc 2 kèm mã vận đơn): BẮT BUỘC bấm Nhận hàng & Nhập kho trước -->
            <template v-else-if="(returnData.trangThai === 3 || returnData.trangThai === 2) && returnData.maVanDon">
              <v-btn 
                rounded="lg"
                class="text-none font-weight-bold shadow-md px-5 text-white" 
                style="background-color: #334155 !important; color: #ffffff !important;"
                @click="handleRestock"
              >
                <PackageCheck class="w-4 h-4 mr-1.5 text-white" />
                Nhận hàng & Nhập kho
              </v-btn>
            </template>

            <!-- BƯỚC 4: CHỈ KHI ĐÃ NHẬN HÀNG NHẬP KHO THỰC TẾ (Trạng thái = 4) MỚI MỞ NÚT HOÀN TIỀN -->
            <template v-else-if="returnData.trangThai === 4">
              <v-btn 
                rounded="lg"
                class="text-none font-weight-bold shadow-md px-5 text-white" 
                style="background-color: #059669 !important; color: #ffffff !important;"
                @click="handleCompleteRefund"
              >
                <Check class="w-4 h-4 mr-1.5 text-white" />
                Đã chuyển tiền qua VietQR
              </v-btn>
            </template>

            <!-- BƯỚC 5: ĐÃ HOÀN TẤT 100% (Trạng thái = 5) -->
            <template v-else-if="returnData.trangThai === 5">
              <v-chip color="success" variant="flat" size="default" class="font-weight-bold text-white" style="background-color: #059669 !important; color: #ffffff !important;">
                <CheckCircle2 class="w-4 h-4 mr-1.5 text-white" />
                Đã hoàn tất hoàn tiền 100%
              </v-chip>
            </template>
          </template>

          <!-- Khi ở chế độ tạo mã thủ công -->
          <template v-else-if="isManualMode && activeStk">
            <v-btn 
              rounded="lg"
              class="text-none font-weight-bold shadow-md px-5 text-white" 
              style="background-color: #059669 !important; color: #ffffff !important;"
              @click="handleCompleteRefund"
            >
              <Check class="w-4 h-4 mr-1.5 text-white" />
              Đã chuyển tiền qua VietQR
            </v-btn>
          </template>
        </div>
      </v-card-actions>

    </v-card>
  </v-dialog>
</template>

<style>
.swal2-container {
  z-index: 10000000 !important;
}
</style>
