<script setup lang="ts">
import { ref, computed, watch, reactive, shallowRef } from 'vue';
import axios from 'axios';
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
  RefreshCw,
  Eye,
  Image as ImageIcon,
  HelpCircle,
  AlertTriangle
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

// ── NOTIFICATION SNACKBAR ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success'
});

const showSnackbar = (text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = text;
  snackbar.color = color;
  snackbar.show = true;
};

// ── VUETIFY 3 CONFIRMATION DIALOG ──
const confirmDialog = reactive({
  show: false,
  title: '',
  subtitle: '',
  description: '',
  icon: shallowRef<any>(HelpCircle),
  iconColor: 'primary',
  confirmText: 'Xác nhận',
  cancelText: 'Hủy bỏ',
  confirmColor: 'primary',
  requireInput: false,
  inputLabel: '',
  inputPlaceholder: '',
  inputValue: '',
  inputError: '',
  loading: false,
  onConfirm: null as null | (() => Promise<void> | void)
});

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
  { code: 'SHB', name: 'SHB' },
  { code: 'VIB', name: 'VIB' },
  { code: 'MSB', name: 'MSB' },
  { code: 'LPB', name: 'LPBank' },
  { code: 'OCB', name: 'OCB' },
  { code: 'CAKE', name: 'CAKE by VPBank' },
  { code: 'TIMO', name: 'Timo Digital Bank' },
  { code: 'VIETCAPITALBANK', name: 'BVBank (Bản Việt)' }
];

const formatPrice = (p?: number) => {
  return (p || 0).toLocaleString('vi-VN') + '₫';
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

const parseCleanBankCode = (bankStr?: string) => {
  if (!bankStr) return 'MB';
  const b = bankStr.toUpperCase();
  if (b.includes('MBBANK') || b.includes('MB')) return 'MB';
  if (b.includes('VIETCOMBANK') || b.includes('VCB')) return 'VCB';
  if (b.includes('TECHCOMBANK') || b.includes('TCB')) return 'TCB';
  if (b.includes('VIETINBANK') || b.includes('ICB') || b.includes('CTG')) return 'ICB';
  if (b.includes('BIDV')) return 'BIDV';
  if (b.includes('ACB')) return 'ACB';
  if (b.includes('VPBANK') || b.includes('VPB')) return 'VPB';
  if (b.includes('TPBANK') || b.includes('TPB')) return 'TPB';
  if (b.includes('SACOMBANK') || b.includes('STB')) return 'STB';
  if (b.includes('HDBANK') || b.includes('HDB')) return 'HDB';
  if (b.includes('VIB')) return 'VIB';
  if (b.includes('MSB')) return 'MSB';
  return bankStr.split(' ')[0]?.replace(/[^a-zA-Z0-9]/g, '') || 'MB';
};

const activeBankCode = computed(() => {
  const raw = returnData.value?.maNganHang || (isManualMode.value ? manualForm.value.bankCode : '');
  return parseCleanBankCode(raw);
});
const activeStk = computed(() => returnData.value?.soTaiKhoan || (isManualMode.value ? manualForm.value.bankAccountNumber : ''));
const activeHolder = computed(() => returnData.value?.tenChuTaiKhoan || (isManualMode.value ? manualForm.value.bankAccountHolder : ''));
const activeAmount = computed(() => Math.round(returnData.value?.soTienHoan || manualForm.value.amount || props.tongTien || 0));

const vietQrUrl = computed(() => {
  if (!activeBankCode.value || !activeStk.value) return '';
  const memo = encodeURIComponent(`HOAN TIEN DON ${props.maHd}`);
  const name = encodeURIComponent(activeHolder.value || '');
  return `https://img.vietqr.io/image/${activeBankCode.value}-${activeStk.value}-compact1.png?amount=${activeAmount.value}&addInfo=${memo}&accountName=${name}`;
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

const isImagePreviewOpen = ref(false);
const previewImageUrl = ref('');

const openImagePreview = (url: string) => {
  if (!url) return;
  previewImageUrl.value = url;
  isImagePreviewOpen.value = true;
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
const handleApprove = () => {
  confirmDialog.title = 'Duyệt yêu cầu hoàn hàng?';
  confirmDialog.subtitle = `Đơn hàng #${props.maHd}`;
  confirmDialog.description = 'Xác nhận duyệt yêu cầu hoàn đơn để khách hàng tiến hành gửi bưu phẩm về Salon.';
  confirmDialog.icon = shallowRef(CheckCircle2);
  confirmDialog.iconColor = 'success';
  confirmDialog.confirmText = 'Duyệt yêu cầu';
  confirmDialog.cancelText = 'Hủy';
  confirmDialog.confirmColor = 'success';
  confirmDialog.requireInput = false;
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true;
      const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/duyet-yeu-cau/${props.maHd}`, {
        dongY: true
      }, { headers: getAuthHeaders() });

      confirmDialog.show = false;
      showSnackbar(res.data?.message || 'Đã chấp thuận yêu cầu đổi trả của khách hàng.', 'success');
      fetchReturnDetails();
      emit('updated');
    } catch (err: any) {
      showSnackbar(err.response?.data?.message || 'Lỗi khi duyệt yêu cầu hoàn.', 'error');
    } finally {
      confirmDialog.loading = false;
    }
  };
  confirmDialog.show = true;
};

// THAO TÁC ADMIN 2: TỪ CHỐI YÊU CẦU HOÀN
const handleReject = () => {
  confirmDialog.title = 'Từ chối yêu cầu hoàn hàng';
  confirmDialog.subtitle = `Đơn hàng #${props.maHd}`;
  confirmDialog.description = 'Vui lòng nhập lý do từ chối chi tiết gửi tới khách hàng:';
  confirmDialog.icon = shallowRef(Ban);
  confirmDialog.iconColor = 'error';
  confirmDialog.confirmText = 'Xác nhận Từ Chối';
  confirmDialog.cancelText = 'Hủy bỏ';
  confirmDialog.confirmColor = 'error';
  confirmDialog.requireInput = true;
  confirmDialog.inputLabel = 'Lý do từ chối (bắt buộc)';
  confirmDialog.inputPlaceholder = 'Nhập lý do chi tiết từ chối...';
  confirmDialog.inputValue = '';
  confirmDialog.inputError = '';
  confirmDialog.onConfirm = async () => {
    if (!confirmDialog.inputValue.trim()) {
      confirmDialog.inputError = 'Vui lòng nhập lý do từ chối!';
      return;
    }
    try {
      confirmDialog.loading = true;
      const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/duyet-yeu-cau/${props.maHd}`, {
        dongY: false,
        lyDoTuChoi: confirmDialog.inputValue.trim()
      }, { headers: getAuthHeaders() });

      confirmDialog.show = false;
      showSnackbar(res.data?.message || 'Đã từ chối yêu cầu đổi trả.', 'info');
      fetchReturnDetails();
      emit('updated');
    } catch (err: any) {
      showSnackbar(err.response?.data?.message || 'Lỗi khi từ chối yêu cầu.', 'error');
    } finally {
      confirmDialog.loading = false;
    }
  };
  confirmDialog.show = true;
};

// THAO TÁC ADMIN 3: XÁC NHẬN ĐÃ NHẬN ĐƯỢC HÀNG & NHẬP KHO (TỰ ĐỘNG CỘNG TỒN KHO)
const handleRestock = () => {
  if (!returnData.value?.maVanDon) {
    showSnackbar('Khách hàng chưa cập nhật mã vận đơn bưu phẩm và ảnh biên lai gửi hàng.', 'warning');
    return;
  }

  confirmDialog.title = 'Xác nhận đã nhận hàng bưu phẩm?';
  confirmDialog.subtitle = `Đơn #${props.maHd} • Vận đơn: ${returnData.value.donViVanChuyen || ''} - ${returnData.value.maVanDon}`;
  confirmDialog.description = 'Bạn xác nhận Salon đã nhận được kiện hàng và kiểm tra nguyên vẹn? Hệ thống sẽ tự động nhập lại số lượng sản phẩm vào kho tồn và cho phép hoàn tiền.';
  confirmDialog.icon = shallowRef(PackageCheck);
  confirmDialog.iconColor = 'purple-darken-1';
  confirmDialog.confirmText = 'Đã nhận & Nhập kho';
  confirmDialog.cancelText = 'Chưa nhận';
  confirmDialog.confirmColor = 'primary';
  confirmDialog.requireInput = false;
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true;
      const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/nhan-hang-nhap-kho/${props.maHd}`, {}, {
        headers: getAuthHeaders()
      });

      localStorage.setItem(`hoan_hang_status_${props.maHd}`, '5');
      fetchReturnDetails();
      emit('updated');
      confirmDialog.show = false;
      showSnackbar(res.data?.message || 'Đã nhận hàng hoàn và nhập kho thành công! Bây giờ bạn có thể quét VietQR và hoàn tiền.', 'success');
    } catch (err: any) {
      showSnackbar(err.response?.data?.message || 'Lỗi khi nhập kho hàng hoàn.', 'error');
    } finally {
      confirmDialog.loading = false;
    }
  };
  confirmDialog.show = true;
};

// THAO TÁC ADMIN 4: XÁC NHẬN ĐÃ CHUYỂN TIỀN HOÀN QUA VIETQR (CHỈ KHI ĐÃ NHẬP KHO XONG - TRẠNG THÁI 5)
const handleCompleteRefund = () => {
  confirmDialog.title = 'Xác nhận đã chuyển tiền hoàn?';
  confirmDialog.subtitle = `Số tiền: ${formatPrice(activeAmount.value)} • Đơn #${props.maHd}`;
  confirmDialog.description = 'Bạn đã quét mã VietQR và chuyển tiền hoàn trả cho khách thành công?';
  confirmDialog.icon = shallowRef(QrCode);
  confirmDialog.iconColor = 'emerald-darken-1';
  confirmDialog.confirmText = 'Xác nhận Đã hoàn tiền';
  confirmDialog.cancelText = 'Chưa chuyển';
  confirmDialog.confirmColor = 'success';
  confirmDialog.requireInput = false;
  confirmDialog.onConfirm = async () => {
    try {
      confirmDialog.loading = true;
      const res = await axios.patch(`${API_BASE_URL}/api/hoan-hang/admin/xac-nhan-hoan-tien-xong/${props.maHd}`, {}, {
        headers: getAuthHeaders()
      });

      localStorage.setItem(`hoan_hang_status_${props.maHd}`, '6');
      confirmDialog.show = false;
      emit('close');
      emit('updated');
      showSnackbar(res.data?.message || 'Đơn hàng đã được chuyển sang trạng thái Đã hoàn tiền (Trạng thái 6)!', 'success');
    } catch (err: any) {
      showSnackbar(err.response?.data?.message || 'Lỗi khi xác nhận hoàn tiền.', 'error');
    } finally {
      confirmDialog.loading = false;
    }
  };
  confirmDialog.show = true;
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
                  <div class="font-weight-bold text-medium-emphasis mb-1.5 flex items-center justify-between">
                    <span>📸 Ảnh biên lai / Bill gửi:</span>
                    <span 
                      class="text-[11px] text-primary cursor-pointer hover:underline font-bold flex items-center gap-0.5"
                      @click="openImagePreview(returnData.hinhAnhBienLai.startsWith('http') || returnData.hinhAnhBienLai.startsWith('data:') ? returnData.hinhAnhBienLai : `${API_BASE_URL}${returnData.hinhAnhBienLai}`)"
                    >
                      <Eye class="w-3 h-3" /> Xem lớn
                    </span>
                  </div>
                  <div 
                    class="relative group w-36 h-24 rounded-lg overflow-hidden border bg-surface shadow-sm cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    @click="openImagePreview(returnData.hinhAnhBienLai.startsWith('http') || returnData.hinhAnhBienLai.startsWith('data:') ? returnData.hinhAnhBienLai : `${API_BASE_URL}${returnData.hinhAnhBienLai}`)"
                    title="Bấm để xem ảnh biên lai phóng to"
                  >
                    <img 
                      :src="returnData.hinhAnhBienLai.startsWith('http') || returnData.hinhAnhBienLai.startsWith('data:') ? returnData.hinhAnhBienLai : `${API_BASE_URL}${returnData.hinhAnhBienLai}`" 
                      alt="Biên lai gửi hàng" 
                      class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
                    />
                    <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[11px] font-weight-bold gap-1">
                      <Eye class="w-4 h-4 text-white" />
                      <span>Xem ảnh lớn</span>
                    </div>
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

      <!-- Footer Action Buttons -->
      <v-card-actions class="pa-4 bg-surface border-t d-flex justify-space-between flex-wrap gap-2">
        <v-btn 
          variant="outlined" 
          color="grey-darken-1" 
          rounded="lg"
          class="text-none font-weight-bold px-5" 
          @click="emit('close')"
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

  <!-- ═══════ LIGHTBOX XEM ẢNH BIÊN LAI LỚN ═══════ -->
  <v-dialog v-model="isImagePreviewOpen" max-width="850px" style="z-index: 10000002;">
    <v-card rounded="xl" class="overflow-hidden bg-slate-900 text-white shadow-2xl">
      <div class="pa-4 px-5 d-flex align-center justify-space-between border-b border-slate-800 bg-slate-950/90">
        <div class="d-flex align-center gap-2.5">
          <ImageIcon class="w-5 h-5 text-primary" />
          <div>
            <h4 class="font-weight-bold text-subtitle-1 text-white mb-0">ẢNH BIÊN LAI / BILL GỬI HÀNG</h4>
            <p class="text-caption text-slate-400 mb-0 font-mono">Đơn hàng #{{ props.maHd }}</p>
          </div>
        </div>
        <v-btn icon variant="text" size="small" color="white" @click="isImagePreviewOpen = false">
          <X class="w-5 h-5" />
        </v-btn>
      </div>

      <div class="pa-4 d-flex align-center justify-center bg-black/80 min-h-[350px] max-h-[75vh] overflow-auto select-none">
        <img
          :src="previewImageUrl"
          alt="Ảnh biên lai phóng to"
          class="max-w-full max-h-[70vh] rounded-lg object-contain shadow-2xl transition-transform"
        />
      </div>

      <div class="pa-3 px-5 border-t border-slate-800 bg-slate-950/90 d-flex justify-space-between align-center">
        <span class="text-caption text-slate-400">Kiểm tra thông tin bill bưu phẩm trước khi nhận hàng &amp; hoàn tiền</span>
        <div class="d-flex align-center gap-2">
          <v-btn
            v-if="previewImageUrl.startsWith('http')"
            variant="outlined"
            color="grey-lighten-2"
            size="small"
            rounded="lg"
            class="text-none font-weight-bold"
            :href="previewImageUrl"
            target="_blank"
          >
            Mở tab mới
          </v-btn>
          <v-btn
            variant="flat"
            color="primary"
            size="small"
            rounded="lg"
            class="text-none font-weight-bold px-5"
            @click="isImagePreviewOpen = false"
          >
            Đóng
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <!-- ═══════ HỘP THOẠI XÁC NHẬN VUETIFY 3 CHUẨN ĐẸP ═══════ -->
  <v-dialog v-model="confirmDialog.show" max-width="480px" style="z-index: 10000005;">
    <v-card rounded="2xl" class="pa-6 text-center elevation-12 bg-surface">
      <div class="d-flex justify-center mb-4">
        <v-avatar size="64" :color="confirmDialog.iconColor" variant="tonal" class="rounded-circle">
          <component :is="confirmDialog.icon" class="w-8 h-8" />
        </v-avatar>
      </div>

      <h3 class="text-h6 font-weight-black mb-2 text-slate-800 dark:text-white">
        {{ confirmDialog.title }}
      </h3>

      <div v-if="confirmDialog.subtitle" class="mb-3">
        <span class="text-caption font-weight-bold text-primary font-mono bg-primary/10 py-1 px-3 rounded-lg d-inline-block">
          {{ confirmDialog.subtitle }}
        </span>
      </div>

      <p class="text-body-2 text-medium-emphasis mb-4 px-2 leading-relaxed">
        {{ confirmDialog.description }}
      </p>

      <!-- Input lý do nếu cần -->
      <div v-if="confirmDialog.requireInput" class="mb-4 text-left">
        <v-textarea
          v-model="confirmDialog.inputValue"
          :label="confirmDialog.inputLabel"
          :placeholder="confirmDialog.inputPlaceholder"
          variant="outlined"
          density="comfortable"
          rounded="lg"
          rows="3"
          :error-messages="confirmDialog.inputError"
          @update:model-value="confirmDialog.inputError = ''"
          hide-details="auto"
          auto-grow
        ></v-textarea>
      </div>

      <div class="d-flex gap-3 justify-center pt-2">
        <v-btn
          variant="outlined"
          color="grey-darken-1"
          rounded="xl"
          height="42"
          class="text-none font-weight-bold px-6 flex-1"
          :disabled="confirmDialog.loading"
          @click="confirmDialog.show = false"
        >
          {{ confirmDialog.cancelText }}
        </v-btn>

        <v-btn
          :color="confirmDialog.confirmColor"
          variant="flat"
          rounded="xl"
          height="42"
          class="text-none font-weight-bold px-6 flex-1 text-white"
          :loading="confirmDialog.loading"
          @click="confirmDialog.onConfirm && confirmDialog.onConfirm()"
        >
          {{ confirmDialog.confirmText }}
        </v-btn>
      </div>
    </v-card>
  </v-dialog>

  <!-- ═══════ SNACKBAR THÔNG BÁO VUETIFY 3 ═══════ -->
  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    location="top right"
    :timeout="3000"
    elevation="6"
    style="z-index: 10000010;"
  >
    <div class="d-flex align-center font-weight-bold text-caption">
      <span>{{ snackbar.text }}</span>
    </div>
    <template v-slot:actions>
      <v-btn variant="text" icon density="comfortable" @click="snackbar.show = false">
        <X class="w-4 h-4" />
      </v-btn>
    </template>
  </v-snackbar>
</template>

<style>
.swal2-container {
  z-index: 10000000 !important;
}
</style>
