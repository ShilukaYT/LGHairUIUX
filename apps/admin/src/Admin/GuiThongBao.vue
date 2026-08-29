<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, reactive } from 'vue'
import axios from 'axios'
import { logActivity } from '@/utils/activityLogger'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'
import {
  Bell, Send, Mail, MessageSquare, RefreshCw, User, Phone, AtSign,
  FileText, CheckCircle2, AlertCircle, Smartphone, Sparkles, QrCode,
  Search, Users, History, Trash2, Eye, RotateCcw, CheckCircle,
  XCircle, Clock, CalendarDays, ChevronRight, Filter, UserCheck, X
} from 'lucide-vue-next'

// ── THEME SYNC ──
const theme = useTheme()
const customizer = useCustomizerStore()

const isDark = computed(() => {
  const vTheme = theme.global.name.value
  const cTheme = customizer.actTheme
  return vTheme === 'dark' || cTheme === 'dark' || document.documentElement.classList.contains('dark')
})

watch(
  [() => theme.global.name.value, () => customizer.actTheme],
  ([vTheme, cTheme]) => {
    const current = vTheme || cTheme
    if (current === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  },
  { immediate: true }
)

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const BRIDGE_URL = 'http://127.0.0.1:3847'

// ── HIGH PRIORITY SNACKBAR ──
const snackbar = reactive({
  show: false,
  text: '',
  color: 'success'
})

const showNotification = (text: string, color: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  snackbar.text = text
  snackbar.color = color
  snackbar.show = true
}

export interface KhachHangOption {
  maKh: string
  hoTen: string | null
  sdt: string | null
  email: string | null
}

interface SendResponse {
  success: boolean
  message: string | null
  results: { kenhGui: string; trangThai: number; chiTiet: string | null }[]
}

const khachHangList = ref<KhachHangOption[]>([])
const loadingList = ref(false)
const sending = ref(false)

const sendMode = ref<'single' | 'bulk'>('single')
const maKh = ref<string | undefined>(undefined)
const selectedMaKhs = ref<string[]>([])
const bulkSearchQuery = ref('')
const sortByZalo = ref(false)
const activeBottomTab = ref<'datlich' | 'lichsu'>('datlich')

// ── Danh sách khách hàng đặt lịch ──
interface KhachHangDatLich {
  maLd: string
  maKh: string
  hoTen: string | null
  sdt: string | null
  email: string | null
  ngayHen: string | null
  gioBatDau: string | null
  gioKetThuc: string | null
  trangThai: number | null
  tongTienDuKien: number | null
}

const datLichList = ref<KhachHangDatLich[]>([])
const loadingDatLich = ref(false)
const datLichNgayFilter = ref(new Date().toISOString().slice(0, 10))
const datLichTrangThaiFilter = ref<string>('all')
const datLichSearch = ref('')

const filteredDatLichList = computed(() => {
  let list = datLichList.value
  if (datLichTrangThaiFilter.value !== 'all') {
    const ts = parseInt(datLichTrangThaiFilter.value)
    list = list.filter(d => d.trangThai === ts)
  }
  const q = datLichSearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(d =>
      (d.hoTen && d.hoTen.toLowerCase().includes(q)) ||
      (d.sdt && d.sdt.toLowerCase().includes(q)) ||
      (d.maKh && d.maKh.toLowerCase().includes(q))
    )
  }
  return list
})

async function loadKhachHangDatLich() {
  loadingDatLich.value = true
  try {
    const params: Record<string, string> = {}
    if (datLichNgayFilter.value) params.ngay = datLichNgayFilter.value
    if (datLichTrangThaiFilter.value !== 'all') params.trangThai = datLichTrangThaiFilter.value
    const res = await axios.get<KhachHangDatLich[]>(`${API}/api/ThongBao/khach-hang-dat-lich`, {
      params,
      withCredentials: true,
    })
    datLichList.value = Array.isArray(res.data) ? res.data : []
  } catch {
    showNotification('Không tải được danh sách lịch đặt.', 'error')
    datLichList.value = []
  } finally {
    loadingDatLich.value = false
  }
}

function getTrangThaiDatLich(ts: number | null) {
  switch (ts) {
    case 0: return { label: 'Chờ xác nhận', color: 'warning' }
    case 1: return { label: 'Xác nhận', color: 'info' }
    case 2: return { label: 'Hoàn thành', color: 'success' }
    case 3: return { label: 'Đã hủy', color: 'error' }
    default: return { label: 'Không rõ', color: 'grey' }
  }
}

function formatNgayVN(ngay: string | null) {
  if (!ngay) return '—'
  try {
    const d = new Date(ngay + 'T00:00:00')
    return d.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return ngay }
}

function selectDatLichKhach(item: KhachHangDatLich) {
  sendMode.value = 'single'
  maKh.value = item.maKh
  const ngayStr = item.ngayHen ? formatNgayVN(item.ngayHen) : ''
  const gioStr = item.gioBatDau ? ` lúc ${item.gioBatDau}` : ''
  tieuDe.value = `Nhắc lịch hẹn tại LG Hair Salon`
  noiDung.value = `Kính chào ${item.hoTen || 'Quý khách'},\n\nChúng tôi xin nhắc lịch hẹn của bạn tại LG Hair Salon:\n📅 Ngày: ${ngayStr}${gioStr}\n\nVui lòng có mặt đúng giờ. Nếu cần thay đổi hoặc hủy lịch, xin liên hệ hotline chúng tôi sớm.\n\nTrân trọng,\nLG Hair Salon 💇`
  showNotification(`Đã chọn ${item.hoTen || item.maKh} — kiểm tra nội dung rồi gửi!`, 'success')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const tieuDe = ref('')
const noiDung = ref('')
const sendViaGmail = ref(false)
const sendViaZalo = ref(false)

interface ZaloTrangThai {
  mode: string
  isPersonal: boolean
  personalBridgeReachable: boolean | null
  personalLoggedIn: boolean | null
  credentialsFileExists: boolean | null
  credentialsValidShape: boolean | null
  warmingUp: boolean | null
  personalLastError: string | null
  hint: string | null
}

const zaloTrangThai = ref<ZaloTrangThai | null>(null)
const loadingZaloTrangThai = ref(false)

/* ── QR Login State ── */
const qrModalOpen = ref(false)
const qrLoginState = ref<{
  status: string
  qrDataUrl: string | null
  error: string | null
  loggedIn: boolean
}>({
  status: 'idle',
  qrDataUrl: null,
  error: null,
  loggedIn: false,
})
const qrPollingTimer = ref<number | null>(null)

/* ── Zalo Phone Check State ── */
interface ZaloPhoneCheck {
  checking: boolean
  exists?: boolean
  user?: {
    uid: string
    displayName: string
    avatar: string | null
    zaloName: string | null
  }
  error?: string
}
const zaloPhoneChecks = ref<Record<string, ZaloPhoneCheck>>({})

function getCheckResult(id?: string | null): ZaloPhoneCheck | undefined {
  if (!id) return undefined
  return zaloPhoneChecks.value[id]
}

function checkKhachZalo(k?: KhachHangOption | null) {
  if (k?.sdt && k?.maKh) {
    checkZaloPhone(k.sdt, k.maKh)
  } else {
    showNotification('Khách hàng chưa có số điện thoại', 'error')
  }
}

async function loadZaloTrangThai() {
  loadingZaloTrangThai.value = true
  try {
    const res = await axios.get<ZaloTrangThai>(`${API}/api/ThongBao/zalo-trang-thai`, {
      withCredentials: true,
    })
    zaloTrangThai.value = res.data
  } catch {
    zaloTrangThai.value = null
  } finally {
    loadingZaloTrangThai.value = false
  }
}

function getAvatarColor(name?: string): string {
  if (!name) return 'primary'
  const colors = ['primary', 'secondary', 'info', 'success', 'warning', 'indigo', 'purple']
  let sum = 0
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i)
  }
  return colors[sum % colors.length] || 'primary'
}

const selectedKhach = computed(() => {
  const id = maKh.value?.trim()
  if (!id) return null
  return khachHangList.value.find((k) => k.maKh === id) ?? null
})

const filteredKhachHangList = computed(() => {
  const q = bulkSearchQuery.value.trim().toLowerCase()
  let list = [...khachHangList.value]
  if (q) {
    list = list.filter((k) =>
      k.maKh.toLowerCase().includes(q) ||
      (k.hoTen && k.hoTen.toLowerCase().includes(q)) ||
      (k.sdt && k.sdt.toLowerCase().includes(q)) ||
      (k.email && k.email.toLowerCase().includes(q))
    )
  }

  if (sortByZalo.value) {
    list.sort((a, b) => {
      const aCheck = zaloPhoneChecks.value[a.maKh]
      const bCheck = zaloPhoneChecks.value[b.maKh]
      const aVal = aCheck && aCheck.exists === true ? 1 : 0
      const bVal = bCheck && bCheck.exists === true ? 1 : 0
      return bVal - aVal
    })
  }
  return list
})

const canSubmit = computed(
  () =>
    ((sendMode.value === 'single' && !!maKh.value?.trim()) ||
      (sendMode.value === 'bulk' && selectedMaKhs.value.length > 0)) &&
    (sendViaGmail.value || sendViaZalo.value) &&
    !sending.value,
)

async function loadKhachHang() {
  loadingList.value = true
  try {
    const res = await axios.get<KhachHangOption[]>(`${API}/api/ThongBao/khach-hang`, {
      withCredentials: true,
    })
    khachHangList.value = Array.isArray(res.data) ? res.data : []
  } catch {
    showNotification('Không tải được danh sách khách hàng.', 'error')
    khachHangList.value = []
  } finally {
    loadingList.value = false
  }
}

/* ── QR Login Methods ── */
async function openQrLoginModal() {
  qrModalOpen.value = true
  await startQrLogin()
  startQrPolling()
}

function closeQrLoginModal() {
  qrModalOpen.value = false
  stopQrPolling()
}

async function startQrLogin() {
  qrLoginState.value = { status: 'generating', qrDataUrl: null, error: null, loggedIn: false }
  try {
    await axios.post(`${BRIDGE_URL}/api/start-login`)
    await checkQrStatus()
  } catch (e: any) {
    qrLoginState.value.status = 'error'
    qrLoginState.value.error = e.message || 'Không thể kết nối Zalo Bridge (Cổng 3847)'
  }
}

async function checkQrStatus() {
  try {
    const res = await axios.get(`${BRIDGE_URL}/api/login-status`)
    if (res.data?.ok) {
      qrLoginState.value = {
        status: res.data.status || 'idle',
        qrDataUrl: res.data.qrDataUrl || null,
        error: res.data.error || null,
        loggedIn: !!res.data.loggedIn,
      }
      if (qrLoginState.value.loggedIn || qrLoginState.value.status === 'logged_in') {
        stopQrPolling()
        showNotification('🎉 Đăng nhập Zalo thành công!', 'success')
        await loadZaloTrangThai()
        setTimeout(() => {
          qrModalOpen.value = false
        }, 1500)
      }
    }
  } catch {
    // Silently ignore polling errors
  }
}

function startQrPolling() {
  stopQrPolling()
  qrPollingTimer.value = window.setInterval(checkQrStatus, 2000)
}

function stopQrPolling() {
  if (qrPollingTimer.value !== null) {
    clearInterval(qrPollingTimer.value)
    qrPollingTimer.value = null
  }
}

/* ── Zalo Logout Method ── */
async function logoutZalo() {
  try {
    await axios.post(`${BRIDGE_URL}/api/logout`)
    showNotification('Đã đăng xuất Zalo thành công!', 'success')
    await loadZaloTrangThai()
  } catch (e: any) {
    showNotification(e.response?.data?.error || e.message || 'Lỗi khi đăng xuất Zalo', 'error')
  }
}

/* ── Zalo Phone Check Methods ── */
async function checkZaloPhone(phone: string | null | undefined, id: string) {
  if (!phone || !phone.trim()) {
    showNotification('Khách hàng chưa có số điện thoại', 'error')
    return
  }
  zaloPhoneChecks.value[id] = { checking: true }
  try {
    const res = await axios.post(`${BRIDGE_URL}/api/check-phone`, { phone: phone.trim() })
    if (res.data?.ok) {
      zaloPhoneChecks.value[id] = {
        checking: false,
        exists: res.data.exists,
        user: res.data.user,
        error: res.data.error,
      }
      if (res.data.exists && res.data.user) {
        showNotification(`Tìm thấy Zalo: ${res.data.user.displayName}`, 'success')
      } else {
        showNotification(res.data.error || 'SĐT chưa đăng ký Zalo hoặc chặn tìm kiếm', 'warning')
      }
    } else {
      zaloPhoneChecks.value[id] = { checking: false, exists: false, error: res.data?.error || 'Lỗi rà soát' }
    }
  } catch {
    zaloPhoneChecks.value[id] = { checking: false, exists: false, error: 'Không kết nối được Bridge 3847' }
    showNotification('Không kết nối được Zalo Bridge (Cổng 3847)', 'error')
  }
}

/* ── Bulk Zalo Check Methods ── */
const isBulkCheckingZalo = ref(false)
const bulkCheckProgress = ref({ current: 0, total: 0, found: 0 })

async function checkBulkZalo() {
  // Ưu tiên rà soát danh sách đã chọn, nếu chưa chọn thì rà toàn bộ danh sách đang hiển thị
  const candidateList = selectedMaKhs.value.length > 0
    ? filteredKhachHangList.value.filter(k => selectedMaKhs.value.includes(k.maKh) && k.sdt && k.sdt.trim())
    : filteredKhachHangList.value.filter(k => k.sdt && k.sdt.trim())

  if (!candidateList.length) {
    showNotification('Không có khách hàng nào có số điện thoại hợp lệ để rà Zalo!', 'warning')
    return
  }

  isBulkCheckingZalo.value = true
  bulkCheckProgress.value = { current: 0, total: candidateList.length, found: 0 }

  let foundCount = 0
  for (let i = 0; i < candidateList.length; i++) {
    const k = candidateList[i]
    if (!k || !k.maKh || !k.sdt) continue
    bulkCheckProgress.value.current = i + 1

    // Nếu đã có kết quả kiểm tra trước đó thì giữ nguyên
    if (zaloPhoneChecks.value[k.maKh]?.exists !== undefined) {
      if (zaloPhoneChecks.value[k.maKh]?.exists) foundCount++
      continue
    }

    zaloPhoneChecks.value[k.maKh] = { checking: true }
    try {
      const res = await axios.post(`${BRIDGE_URL}/api/check-phone`, { phone: k.sdt.trim() })
      if (res.data?.ok) {
        zaloPhoneChecks.value[k.maKh] = {
          checking: false,
          exists: res.data.exists,
          user: res.data.user,
          error: res.data.error,
        }
        if (res.data.exists && res.data.user) {
          foundCount++
        }
      } else {
        zaloPhoneChecks.value[k.maKh] = { checking: false, exists: false, error: res.data?.error || 'Lỗi rà soát' }
      }
    } catch {
      zaloPhoneChecks.value[k.maKh] = { checking: false, exists: false, error: 'Không kết nối được Bridge 3847' }
    }
  }

  bulkCheckProgress.value.found = foundCount
  isBulkCheckingZalo.value = false
  showNotification(`Đã hoàn tất rà Zalo: Tìm thấy ${foundCount}/${candidateList.length} tài khoản Zalo khả dụng!`, 'success')
}

function selectOnlyZaloUsers() {
  const zaloUsers = filteredKhachHangList.value.filter(k => zaloPhoneChecks.value[k.maKh]?.exists === true)
  if (!zaloUsers.length) {
    showNotification('Chưa tìm thấy khách hàng nào có tài khoản Zalo. Hãy bấm "Rà Zalo đồng loạt" trước!', 'warning')
    return
  }
  selectedMaKhs.value = zaloUsers.map(k => k.maKh)
  showNotification(`Đã chọn ${zaloUsers.length} khách hàng có tài khoản Zalo!`, 'success')
}

/* ── Bulk Selection Methods ── */
function selectAllBulk() {
  selectedMaKhs.value = filteredKhachHangList.value.map((k) => k.maKh)
}

function deselectAllBulk() {
  selectedMaKhs.value = []
}

function toggleSelectKhach(id: string) {
  const idx = selectedMaKhs.value.indexOf(id)
  if (idx > -1) selectedMaKhs.value.splice(idx, 1)
  else selectedMaKhs.value.push(id)
}

/* ── Submit Handler ── */
async function onSubmit() {
  if (!canSubmit.value) {
    showNotification('Chọn khách hàng và ít nhất một kênh (Gmail hoặc Zalo).', 'error')
    return
  }

  sending.value = true

  // ── 1. GỬI HÀNG LOẠT ──
  if (sendMode.value === 'bulk') {
    const targetCustomers = khachHangList.value.filter((k) => selectedMaKhs.value.includes(k.maKh))
    let successCount = 0
    let failCount = 0
    const channels = [sendViaGmail.value && 'Gmail', sendViaZalo.value && 'Zalo'].filter(Boolean).join(', ')
    showNotification(`Bắt đầu gửi thông báo cho ${targetCustomers.length} khách hàng...`, 'info')

    for (const k of targetCustomers) {
      try {
        const res = await axios.post<SendResponse>(
          `${API}/api/ThongBao/Send`,
          {
            maKh: k.maKh,
            tieuDe: tieuDe.value.trim() || null,
            noiDung: noiDung.value.trim() || null,
            sendViaGmail: sendViaGmail.value,
            sendViaZalo: sendViaZalo.value,
          },
          { withCredentials: true },
        )

        const data = res.data
        const results = data.results ?? []
        const detailStr = results.length
          ? results.map(r => `${r.kenhGui}: ${r.trangThai === 1 ? '✓ Thành công' : '✗ Thất bại'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`).join(' | ')
          : (data.message || (data.success ? 'Đã gửi thành công' : 'Gửi thất bại'))

        const allOk = results.length ? results.every(r => r.trangThai === 1) : data.success
        const someOk = results.length ? results.some(r => r.trangThai === 1) : false

        if (data.success && allOk) {
          successCount++
          addSentNotification({
            maKh: k.maKh,
            hoTen: k.hoTen || k.maKh,
            sdt: k.sdt || undefined,
            email: k.email || undefined,
            tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
            noiDung: noiDung.value.trim() || 'Không có nội dung',
            kenhGui: channels,
            trangThai: 'success',
            chiTiet: detailStr,
            mode: 'bulk'
          })
        } else if (data.success && someOk) {
          successCount++
          addSentNotification({
            maKh: k.maKh,
            hoTen: k.hoTen || k.maKh,
            sdt: k.sdt || undefined,
            email: k.email || undefined,
            tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
            noiDung: noiDung.value.trim() || 'Không có nội dung',
            kenhGui: channels,
            trangThai: 'partial',
            chiTiet: detailStr,
            mode: 'bulk'
          })
        } else {
          failCount++
          addSentNotification({
            maKh: k.maKh,
            hoTen: k.hoTen || k.maKh,
            sdt: k.sdt || undefined,
            email: k.email || undefined,
            tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
            noiDung: noiDung.value.trim() || 'Không có nội dung',
            kenhGui: channels,
            trangThai: 'error',
            chiTiet: detailStr || data.message || 'Gửi thất bại',
            mode: 'bulk'
          })
        }
      } catch (e: unknown) {
        failCount++
        let errMsg = 'Lỗi kết nối hoặc máy chủ'
        if (axios.isAxiosError(e) && e.response?.data) {
          errMsg = (e.response.data as { message?: string })?.message || errMsg
        }
        addSentNotification({
          maKh: k.maKh,
          hoTen: k.hoTen || k.maKh,
          sdt: k.sdt || undefined,
          email: k.email || undefined,
          tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
          noiDung: noiDung.value.trim() || 'Không có nội dung',
          kenhGui: channels,
          trangThai: 'error',
          chiTiet: errMsg,
          mode: 'bulk'
        })
      }
      await new Promise((r) => setTimeout(r, 350))
    }

    sending.value = false

    if (successCount > 0 && failCount === 0) {
      showNotification(`🎉 Đã gửi thành công cho tất cả ${successCount} khách hàng!`, 'success')
      logActivity('Gửi hàng loạt', `Đã gửi thông báo thành công cho ${successCount} khách hàng qua ${channels}`, 'Thông báo')
    } else if (successCount > 0) {
      showNotification(`Đã gửi thành công ${successCount}/${targetCustomers.length} khách hàng. Thất bại: ${failCount}.`, 'warning')
      logActivity('Gửi hàng loạt', `Gửi thông báo ${successCount}/${targetCustomers.length} thành công, thất bại ${failCount} qua ${channels}`, 'Thông báo')
    } else {
      showNotification(`Gửi thất bại cho tất cả ${targetCustomers.length} khách hàng.`, 'error')
      logActivity('Gửi hàng loạt', `Thất bại khi gửi thông báo cho ${targetCustomers.length} khách hàng qua ${channels}`, 'Thông báo', 'Thất bại')
    }
    return
  }

  // ── 2. GỬI TỪNG KHÁCH HÀNG ──
  const khachName = selectedKhach.value?.hoTen || maKh.value || ''
  const channels = [sendViaGmail.value && 'Gmail', sendViaZalo.value && 'Zalo'].filter(Boolean).join(', ')

  try {
    const res = await axios.post<SendResponse>(
      `${API}/api/ThongBao/Send`,
      {
        maKh: maKh.value!.trim(),
        tieuDe: tieuDe.value.trim() || null,
        noiDung: noiDung.value.trim() || null,
        sendViaGmail: sendViaGmail.value,
        sendViaZalo: sendViaZalo.value,
      },
      { withCredentials: true },
    )

    const data = res.data
    const results = data.results ?? []

    const allOk = results.length ? results.every((r) => r.trangThai === 1) : data.success

    if (data.success && allOk) {
      const detail = results.map(r => `${r.kenhGui}: OK${r.chiTiet ? ` — ${r.chiTiet}` : ''}`).join('\n')
      logActivity('Gửi thông báo', `Đã gửi thông báo thành công cho khách hàng ${khachName} qua kênh ${channels}`, 'Thông báo')
      showNotification(data.message || 'Đã gửi thông báo thành công.', 'success')
      addSentNotification({
        maKh: selectedKhach.value?.maKh || maKh.value,
        hoTen: khachName,
        sdt: selectedKhach.value?.sdt || undefined,
        email: selectedKhach.value?.email || undefined,
        tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
        noiDung: noiDung.value.trim() || 'Không có nội dung',
        kenhGui: channels,
        trangThai: 'success',
        chiTiet: detail || 'Đã gửi thành công',
        mode: 'single'
      })
    } else if (data.success) {
      const detail = results.map(r => `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`).join('\n')
      logActivity('Gửi thông báo', `Đã gửi thông báo cho khách hàng ${khachName} qua kênh ${channels} (Một số kênh thất bại)`, 'Thông báo')
      showNotification(data.message || 'Một số kênh gửi thất bại.', 'warning')
      addSentNotification({
        maKh: selectedKhach.value?.maKh || maKh.value,
        hoTen: khachName,
        sdt: selectedKhach.value?.sdt || undefined,
        email: selectedKhach.value?.email || undefined,
        tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
        noiDung: noiDung.value.trim() || 'Không có nội dung',
        kenhGui: channels,
        trangThai: 'partial',
        chiTiet: detail || 'Một số kênh thất bại',
        mode: 'single'
      })
    } else {
      const detail = results.map(r => `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`).join('\n')
      logActivity('Gửi thông báo', `Thất bại khi gửi thông báo cho khách hàng ${khachName} qua kênh ${channels} - Lỗi: ${data.message || ''}`, 'Thông báo', 'Thất bại')
      showNotification(data.message || 'Gửi thất bại.', 'error')
      addSentNotification({
        maKh: selectedKhach.value?.maKh || maKh.value,
        hoTen: khachName,
        sdt: selectedKhach.value?.sdt || undefined,
        email: selectedKhach.value?.email || undefined,
        tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
        noiDung: noiDung.value.trim() || 'Không có nội dung',
        kenhGui: channels,
        trangThai: 'error',
        chiTiet: detail || data.message || 'Gửi thất bại',
        mode: 'single'
      })
    }
  } catch (e: unknown) {
    let errorMsg = 'Lỗi kết nối hoặc máy chủ.'
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      errorMsg = 'Không tìm thấy khách hàng.'
    } else if (axios.isAxiosError(e) && e.response?.status === 400) {
      const msg = (e.response.data as { message?: string })?.message
      errorMsg = msg || 'Dữ liệu không hợp lệ.'
    }
    showNotification(errorMsg, 'error')
    logActivity('Gửi thông báo', `Thất bại khi gửi thông báo cho khách hàng ${khachName} qua kênh ${channels} - Lỗi: ${errorMsg}`, 'Thông báo', 'Thất bại')
    addSentNotification({
      maKh: selectedKhach.value?.maKh || maKh.value,
      hoTen: khachName,
      sdt: selectedKhach.value?.sdt || undefined,
      email: selectedKhach.value?.email || undefined,
      tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
      noiDung: noiDung.value.trim() || 'Không có nội dung',
      kenhGui: channels,
      trangThai: 'error',
      chiTiet: errorMsg,
      mode: 'single'
    })
  } finally {
    sending.value = false
  }
}

/* ── Sent Notifications History Logic ── */
export interface SentNotificationItem {
  id: string
  timestamp: string
  maKh?: string
  hoTen: string
  sdt?: string
  email?: string
  tieuDe: string
  noiDung: string
  kenhGui: string
  trangThai: 'success' | 'error' | 'partial'
  chiTiet: string
  mode: 'single' | 'bulk'
}

const sentNotifications = ref<SentNotificationItem[]>([])
const historySearch = ref('')
const historyChannelFilter = ref<'all' | 'Zalo' | 'Gmail'>('all')
const historyStatusFilter = ref<'all' | 'success' | 'error' | 'partial'>('all')
const selectedDetailItem = ref<SentNotificationItem | null>(null)
const detailModalOpen = ref(false)

function loadSentNotifications() {
  try {
    const stored = localStorage.getItem('lghair_sent_notifications')
    if (stored) {
      const parsed: SentNotificationItem[] = JSON.parse(stored)
      const hasRealData = parsed.some(item => !item.id.startsWith('demo-'))
      if (hasRealData) {
        sentNotifications.value = parsed
      } else {
        sentNotifications.value = []
        localStorage.removeItem('lghair_sent_notifications')
      }
    } else {
      sentNotifications.value = []
    }
  } catch {
    sentNotifications.value = []
  }
}

function saveSentNotificationsToStorage() {
  try {
    localStorage.setItem('lghair_sent_notifications', JSON.stringify(sentNotifications.value.slice(0, 500)))
  } catch (e) {
    console.error('Lỗi lưu lịch sử thông báo:', e)
  }
}

function addSentNotification(item: Omit<SentNotificationItem, 'id' | 'timestamp'>) {
  const newItem: SentNotificationItem = {
    ...item,
    id: Math.random().toString(36).substring(2, 9) + Date.now(),
    timestamp: new Date().toISOString()
  }
  sentNotifications.value.unshift(newItem)
  saveSentNotificationsToStorage()
}

function clearSentHistory() {
  if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử gửi thông báo?')) {
    sentNotifications.value = []
    localStorage.removeItem('lghair_sent_notifications')
    showNotification('Đã xóa toàn bộ lịch sử tin nhắn.', 'success')
  }
}

function deleteSentItem(id: string) {
  sentNotifications.value = sentNotifications.value.filter(item => item.id !== id)
  saveSentNotificationsToStorage()
  showNotification('Đã xóa tin nhắn khỏi lịch sử.', 'success')
}

function openDetailModal(item: SentNotificationItem) {
  selectedDetailItem.value = item
  detailModalOpen.value = true
}

function resendMessage(item: SentNotificationItem) {
  tieuDe.value = item.tieuDe
  noiDung.value = item.noiDung
  sendViaGmail.value = item.kenhGui.includes('Gmail')
  sendViaZalo.value = item.kenhGui.includes('Zalo')
  
  if (item.mode === 'single' && item.maKh) {
    sendMode.value = 'single'
    maKh.value = item.maKh
  } else if (item.mode === 'single' && !item.maKh) {
    const found = khachHangList.value.find(k => k.hoTen === item.hoTen || k.sdt === item.sdt)
    if (found) {
      sendMode.value = 'single'
      maKh.value = found.maKh
    }
  }
  
  showNotification('Đã sao chép nội dung tin nhắn vào biểu mẫu!', 'success')
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const filteredSentNotifications = computed(() => {
  let list = sentNotifications.value
  if (historyStatusFilter.value !== 'all') {
    list = list.filter(item => item.trangThai === historyStatusFilter.value)
  }
  if (historyChannelFilter.value !== 'all') {
    list = list.filter(item => item.kenhGui.includes(historyChannelFilter.value))
  }
  const q = historySearch.value.trim().toLowerCase()
  if (q) {
    list = list.filter(item =>
      item.hoTen.toLowerCase().includes(q) ||
      (item.sdt && item.sdt.toLowerCase().includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      item.tieuDe.toLowerCase().includes(q) ||
      item.noiDung.toLowerCase().includes(q) ||
      item.chiTiet.toLowerCase().includes(q)
    )
  }
  return list
})

function formatTime(isoStr: string) {
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch {
    return isoStr
  }
}

// ── QUICK TEMPLATES ──
const fillTemplate = (type: 'nhac_lich' | 'chuc_mung' | 'khuyen_mai') => {
  if (type === 'nhac_lich') {
    tieuDe.value = 'Nhắc lịch hẹn dịch vụ tóc tại LG Hair Salon'
    noiDung.value = `Kính chào Quý khách,\n\nLG Hair Salon xin nhắc lịch hẹn làm đẹp của bạn hôm nay. Vui lòng ghé salon đúng giờ để được phục vụ chu đáo nhất.\n\nHotline hỗ trợ: 0900.123.456\nTrân trọng!`
  } else if (type === 'chuc_mung') {
    tieuDe.value = '🎉 Chúc mừng sinh nhật Quý khách từ LG Hair Salon'
    noiDung.value = `Thân gửi Quý khách,\n\nLG Hair Salon xin gửi lời chúc mừng sinh nhật tốt đẹp nhất đến bạn! Tặng bạn Voucher giảm 30% cho tất cả dịch vụ uốn/nhuộm trong tháng này.\n\nChúc bạn luôn rạng rỡ và tự tin!`
  } else if (type === 'khuyen_mai') {
    tieuDe.value = '🔥 Siêu Ưu Đãi Combo Uốn/Nhuộm Cao Cấp tại LG Hair'
    noiDung.value = `Kính chào Quý khách,\n\nLG Hair Salon đang áp dụng chương trình ưu đãi đặc biệt: Combo Cắt + Uốn + Nhuộm cao cấp giảm giá chỉ từ 499k. Đặt lịch ngay hôm nay để nhận quà tặng hấp dẫn!`
  }
}

onMounted(() => {
  loadKhachHang()
  loadZaloTrangThai()
  loadSentNotifications()
  loadKhachHangDatLich()
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<template>
  <v-container fluid class="pa-4 pa-md-6">
    <!-- HIGH PRIORITY SNACKBAR -->
    <v-snackbar
      v-model="snackbar.show"
      :color="snackbar.color"
      location="top right"
      :timeout="3500"
      elevation="6"
      style="z-index: 99999;"
    >
      <div class="d-flex align-center font-weight-bold">
        <span>{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="comfortable" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- ── HEADER BANNER CARD ── -->
    <v-card elevation="2" rounded="2xl" class="pa-6 border mb-6">
      <div class="d-flex flex-column flex-sm-row align-start align-sm-center justify-space-between gap-4">
        <div class="d-flex align-center gap-3">
          <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
            <Bell class="w-6 h-6 text-primary" />
          </v-avatar>
          <div>
            <h1 class="text-h5 font-weight-bold mb-1">Gửi Thông Báo Khách Hàng</h1>
            <p class="text-subtitle-2 text-medium-emphasis mb-0">Gửi tin nhắn chăm sóc khách hàng tự động qua Email &amp; Zalo Chat</p>
          </div>
        </div>

        <div class="d-flex gap-2">
          <v-btn
            color="success"
            variant="flat"
            size="large"
            rounded="xl"
            class="text-none font-weight-bold shadow-xs px-6"
            @click="openQrLoginModal"
            v-if="!zaloTrangThai?.personalLoggedIn"
          >
            <template v-slot:prepend>
              <QrCode class="w-5 h-5 mr-2" />
            </template>
            Đăng Nhập Zalo (QR)
          </v-btn>

          <v-btn
            color="error"
            variant="flat"
            size="large"
            rounded="xl"
            class="text-none font-weight-bold shadow-xs px-6"
            @click="logoutZalo"
            v-if="zaloTrangThai?.personalLoggedIn"
          >
            <template v-slot:prepend>
              <XCircle class="w-5 h-5 mr-2" />
            </template>
            Đăng Xuất Zalo
          </v-btn>
        </div>
      </div>
    </v-card>

    <!-- ── ZALO TRẠNG THÁI ALERT BANNER ── -->
    <v-card v-if="zaloTrangThai" border rounded="2xl" class="pa-5 mb-6">
      <div class="d-flex flex-column flex-md-row align-start align-md-center justify-space-between gap-4">
        <div class="d-flex align-center gap-4">
          <v-avatar
            :color="zaloTrangThai.personalLoggedIn ? 'success' : 'warning'"
            size="44"
            rounded="xl"
          >
            <Smartphone class="w-6 h-6 text-white" />
          </v-avatar>
          <div>
            <div class="d-flex align-center gap-3 mb-1">
              <span class="text-subtitle-1 font-weight-bold">Zalo Chat Personal Bridge (Cổng 3847):</span>
              <v-chip
                :color="zaloTrangThai.personalLoggedIn ? 'success' : 'warning'"
                size="small"
                variant="flat"
                class="font-weight-black"
              >
                {{ zaloTrangThai.personalLoggedIn ? 'Đã Kết Nối' : 'Chưa Đăng Nhập' }}
              </v-chip>
            </div>
            <p class="text-caption text-medium-emphasis mb-0" style="font-size: 12px;">
              {{ zaloTrangThai.hint || 'Sẵn sàng gửi tin nhắn trực tiếp qua tài khoản Zalo cá nhân của Salon' }}
            </p>
          </div>
        </div>

        <v-btn
          size="small"
          variant="tonal"
          color="primary"
          rounded="lg"
          class="text-none font-weight-bold px-4"
          :loading="loadingZaloTrangThai"
          @click="loadZaloTrangThai"
        >
          <template v-slot:prepend>
            <RefreshCw class="w-4 h-4 mr-1" />
          </template>
          Làm Mới Trạng Thái
        </v-btn>
      </div>
    </v-card>

    <!-- ── MAIN FORM (2 CỘT VUETIFY VỚI GUTTER THOÁNG CÂN BẰNG) ── -->
    <v-row class="align-stretch mb-8">

      <!-- CỘT TRÁI: CHỌN ĐỐI TƯỢNG (VUETIFY COL 5) -->
      <v-col cols="12" lg="5">
        <v-card rounded="2xl" border elevation="2" class="fill-height d-flex flex-column pa-6 pa-md-7">
          <div class="d-flex align-center gap-3 border-b pb-4 mb-6">
            <v-avatar color="primary-lighten-5" size="36" rounded="lg">
              <Users class="w-5 h-5 text-primary" />
            </v-avatar>
            <h2 class="text-subtitle-1 font-weight-bold mb-0">Bước 1: Chọn Đối Tượng Nhận Tin</h2>
          </div>

          <!-- Mode Toggle Buttons -->
          <v-btn-toggle
            v-model="sendMode"
            mandatory
            color="primary"
            rounded="xl"
            density="comfortable"
            class="w-100 border mb-6"
          >
            <v-btn value="single" class="flex-grow-1 text-none font-weight-bold py-2">
              <User class="w-4 h-4 mr-2" />
              Gửi 1 Khách Hàng
            </v-btn>
            <v-btn value="bulk" class="flex-grow-1 text-none font-weight-bold py-2">
              <Users class="w-4 h-4 mr-2" />
              Gửi Hàng Loạt ({{ selectedMaKhs.length }})
            </v-btn>
          </v-btn-toggle>

          <!-- ── SINGLE MODE SELECTOR ── -->
          <div v-if="sendMode === 'single'" class="mb-6 space-y-6">
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-2 d-block">Chọn Khách Hàng Nhận Tin:</label>
              <v-autocomplete
                v-model="maKh"
                :items="khachHangList"
                item-title="hoTen"
                item-value="maKh"
                placeholder="-- Chọn hoặc tìm kiếm khách hàng --"
                variant="outlined"
                density="comfortable"
                rounded="xl"
                hide-details
                clearable
              >
                <template v-slot:item="{ props, item }">
                  <v-list-item v-bind="props" :title="item.raw.hoTen || item.raw.maKh" :subtitle="item.raw.sdt || item.raw.email || ''"></v-list-item>
                </template>
              </v-autocomplete>
            </div>

            <!-- Customer Details Card Box -->
            <v-card v-if="selectedKhach" rounded="2xl" border class="pa-5 bg-surface space-y-4 shadow-xs">
              <div class="d-flex align-center justify-space-between mb-2">
                <div class="d-flex align-center gap-3">
                  <v-avatar :color="getAvatarColor(selectedKhach.hoTen || selectedKhach.maKh)" size="46" rounded="xl" class="text-white font-weight-bold shadow-xs">
                    {{ selectedKhach.hoTen?.charAt(0)?.toUpperCase() || 'K' }}
                  </v-avatar>
                  <div>
                    <div class="text-subtitle-1 font-weight-bold leading-tight">{{ selectedKhach.hoTen || 'Khách hàng' }}</div>
                    <div class="text-caption text-medium-emphasis font-mono mt-1" style="font-size: 11px;">Mã: {{ selectedKhach.maKh }}</div>
                  </div>
                </div>

                <v-btn
                  size="small"
                  color="success"
                  variant="tonal"
                  rounded="lg"
                  class="text-none font-weight-bold px-3"
                  @click="checkKhachZalo(selectedKhach)"
                >
                  Rà Zalo
                </v-btn>
              </div>

              <v-divider class="my-4"></v-divider>

              <div class="text-body-2 space-y-3 text-medium-emphasis my-3">
                <div class="d-flex align-center gap-2">
                  <Phone class="w-4 h-4 text-primary me-1" />
                  <span>SĐT: <strong class="text-high-emphasis ms-1">{{ selectedKhach.sdt || 'Chưa có SĐT' }}</strong></span>
                </div>
                <div class="d-flex align-center gap-2">
                  <Mail class="w-4 h-4 text-primary me-1" />
                  <span>Email: <strong class="text-high-emphasis ms-1">{{ selectedKhach.email || 'Chưa có Email' }}</strong></span>
                </div>
              </div>

              <!-- Zalo Check Badge -->
              <div v-if="getCheckResult(selectedKhach.maKh)" class="pt-3 border-t">
                <v-chip
                  v-if="getCheckResult(selectedKhach.maKh)?.exists"
                  color="success"
                  size="small"
                  variant="flat"
                  class="font-weight-bold py-1 px-3"
                >
                  ✓ Đã có Zalo: {{ getCheckResult(selectedKhach.maKh)?.user?.displayName }}
                </v-chip>
                <v-chip
                  v-else-if="!getCheckResult(selectedKhach.maKh)?.checking"
                  color="warning"
                  size="small"
                  variant="tonal"
                  class="font-weight-bold py-1 px-3"
                >
                  ✗ Chưa có / Chặn Zalo
                </v-chip>
              </div>
            </v-card>
          </div>

          <!-- ── BULK MODE SELECTOR ── -->
          <div v-else class="mb-6 flex-grow-1 d-flex flex-column">
            <!-- Search Input Wrapper -->
            <div class="mb-4">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-1.5 d-block">Tìm Kiếm Khách Hàng:</label>
              <v-text-field
                v-model="bulkSearchQuery"
                placeholder="Tìm theo tên, SĐT, email..."
                variant="outlined"
                density="comfortable"
                hide-details
                rounded="xl"
              >
                <template v-slot:prepend-inner>
                  <Search class="w-4 h-4 text-medium-emphasis me-2" />
                </template>
              </v-text-field>
            </div>

            <!-- Zalo Bulk Action Card -->
            <v-card variant="flat" border rounded="xl" class="pa-4 mb-4" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
              <!-- Top Row: Zalo Actions & Sort Switch -->
              <div class="d-flex align-center justify-space-between flex-wrap gap-3 pb-3 border-b">
                <div class="d-flex align-center gap-2.5 flex-wrap">
                  <v-btn
                    size="small"
                    color="success"
                    variant="flat"
                    rounded="lg"
                    height="36"
                    class="text-none font-weight-bold px-3"
                    :loading="isBulkCheckingZalo"
                    @click="checkBulkZalo"
                  >
                    <template v-slot:prepend>
                      <Smartphone class="w-4 h-4 mr-1" />
                    </template>
                    {{
                      isBulkCheckingZalo
                        ? `Đang rà (${bulkCheckProgress.current}/${bulkCheckProgress.total})...`
                        : 'Rà Zalo Đồng Loạt'
                    }}
                  </v-btn>

                  <v-btn
                    size="small"
                    color="success"
                    variant="tonal"
                    rounded="lg"
                    height="36"
                    class="text-none font-weight-bold px-3"
                    @click="selectOnlyZaloUsers"
                    title="Chỉ chọn những khách hàng đã rà thấy Zalo"
                  >
                    <template v-slot:prepend>
                      <CheckCircle2 class="w-4 h-4 mr-1" />
                    </template>
                    Chỉ chọn có Zalo
                  </v-btn>
                </div>

                <div class="d-flex align-center gap-2">
                  <v-switch
                    v-model="sortByZalo"
                    color="success"
                    density="compact"
                    hide-details
                    inset
                    class="ma-0 pa-0"
                  >
                    <template v-slot:label>
                      <span class="text-caption font-weight-semibold text-medium-emphasis ps-1">Ưu tiên có Zalo</span>
                    </template>
                  </v-switch>
                </div>
              </div>

              <!-- Bottom Row: Selection Controls -->
              <div class="d-flex align-center justify-space-between pt-3 px-0.5">
                <div class="d-flex align-center gap-2">
                  <v-btn size="small" variant="text" color="primary" rounded="md" class="text-none font-weight-bold px-2.5" @click="selectAllBulk">
                    Chọn tất cả
                  </v-btn>
                  <span class="text-caption text-medium-emphasis opacity-60">|</span>
                  <v-btn size="small" variant="text" color="grey-darken-1" rounded="md" class="text-none font-weight-bold px-2.5" @click="deselectAllBulk">
                    Bỏ chọn
                  </v-btn>
                </div>
                <v-chip color="primary" size="small" variant="flat" class="font-weight-black px-3">
                  Đã chọn {{ selectedMaKhs.length }}/{{ filteredKhachHangList.length }}
                </v-chip>
              </div>
            </v-card>

            <!-- Scrollable Cards List with Spaced Out Item Cards -->
            <v-sheet
              border
              rounded="2xl"
              class="flex-grow-1 overflow-y-auto pa-3 d-flex flex-column"
              style="max-height: 300px; min-height: 200px; gap: 10px; background-color: rgba(var(--v-theme-on-surface), 0.02);"
            >
              <v-card
                v-for="k in filteredKhachHangList"
                :key="k.maKh"
                variant="flat"
                rounded="xl"
                class="pa-3 cursor-pointer border relative transition-all"
                :class="[
                  selectedMaKhs.includes(k.maKh)
                    ? 'border-primary'
                    : ''
                ]"
                :style="
                  selectedMaKhs.includes(k.maKh)
                    ? 'background-color: rgba(var(--v-theme-on-surface), 0.08);'
                    : 'background-color: rgba(var(--v-theme-on-surface), 0.03);'
                "
                @click="toggleSelectKhach(k.maKh)"
              >
                <div class="d-flex align-center justify-space-between gap-2">
                  <div class="d-flex align-center gap-3 min-w-0">
                    <v-checkbox
                      :model-value="selectedMaKhs.includes(k.maKh)"
                      density="compact"
                      hide-details
                      color="primary"
                      class="me-1 shrink-0"
                      @click.stop="toggleSelectKhach(k.maKh)"
                    ></v-checkbox>
                    <v-avatar size="32" color="primary" variant="tonal" class="text-caption font-weight-bold shrink-0">
                      {{ (k.hoTen?.charAt(0) || k.maKh?.charAt(0) || 'K').toUpperCase() }}
                    </v-avatar>
                    <div class="min-w-0">
                      <div class="text-subtitle-2 font-weight-bold leading-tight truncate">{{ k.hoTen || k.maKh }}</div>
                      <div class="text-caption text-medium-emphasis font-mono" style="font-size: 11px;">{{ k.sdt || 'Chưa có SĐT' }}</div>
                    </div>
                  </div>

                  <!-- Zalo Check Badge per Item -->
                  <div class="shrink-0 d-flex align-center gap-1">
                    <v-chip
                      v-if="getCheckResult(k.maKh)?.exists"
                      color="success"
                      size="x-small"
                      variant="flat"
                      class="font-weight-bold"
                    >
                      ✓ Zalo: {{ getCheckResult(k.maKh)?.user?.displayName || 'Khả dụng' }}
                    </v-chip>
                    <v-chip
                      v-else-if="getCheckResult(k.maKh)?.checking"
                      color="primary"
                      size="x-small"
                      variant="tonal"
                    >
                      <v-progress-circular indeterminate size="10" width="2" class="mr-1"></v-progress-circular>
                      Đang rà...
                    </v-chip>
                    <v-chip
                      v-else-if="getCheckResult(k.maKh) && !getCheckResult(k.maKh)?.exists"
                      color="grey"
                      size="x-small"
                      variant="tonal"
                    >
                      Không có Zalo
                    </v-chip>
                    <v-btn
                      v-else-if="k.sdt"
                      size="x-small"
                      variant="tonal"
                      color="success"
                      rounded="md"
                      class="text-none font-weight-bold px-2"
                      @click.stop="checkKhachZalo(k)"
                    >
                      Rà Zalo
                    </v-btn>
                  </div>
                </div>
              </v-card>
            </v-sheet>
          </div>

          <!-- KÊNH GỬI & NÚT GỬI -->
          <v-card variant="flat" border rounded="xl" class="pa-4 mb-6" style="background-color: rgba(var(--v-theme-on-surface), 0.03);">
            <div class="text-subtitle-2 font-weight-bold mb-3">Kênh Thông Báo Nổi Bật:</div>
            
            <div class="d-flex flex-column gap-2">
              <v-switch
                v-model="sendViaGmail"
                color="primary"
                hide-details
                density="comfortable"
              >
                <template v-slot:label>
                  <div class="d-flex align-center gap-2 font-weight-bold text-body-2">
                    <Mail class="w-4 h-4 text-primary" />
                    <span>Gửi qua Email / Gmail</span>
                  </div>
                </template>
              </v-switch>

              <v-switch
                v-model="sendViaZalo"
                color="success"
                hide-details
                density="comfortable"
              >
                <template v-slot:label>
                  <div class="d-flex align-center gap-2 font-weight-bold text-body-2">
                    <Smartphone class="w-4 h-4 text-success" />
                    <span>Gửi qua Zalo Chat (Cá nhân/OA)</span>
                  </div>
                </template>
              </v-switch>
            </div>
          </v-card>

          <v-btn
            color="primary"
            size="x-large"
            rounded="xl"
            block
            elevation="3"
            class="text-none font-weight-bold text-subtitle-1 mt-auto"
            :disabled="!canSubmit"
            :loading="sending"
            @click="onSubmit"
          >
            <template v-slot:prepend>
              <Send class="w-5 h-5 mr-2" />
            </template>
            {{ sending ? 'Đang Gửi...' : 'Gửi Thông Báo Ngay' }}
          </v-btn>
        </v-card>
      </v-col>

      <!-- CỘT PHẢI: NỘI DUNG THÔNG BÁO (VUETIFY COL 7) -->
      <v-col cols="12" lg="7">
        <v-card rounded="2xl" border elevation="2" class="fill-height d-flex flex-column pa-6 pa-md-7">
          <div class="d-flex align-center gap-3 border-b pb-4 mb-6">
            <v-avatar color="primary-lighten-5" size="36" rounded="lg">
              <FileText class="w-5 h-5 text-primary" />
            </v-avatar>
            <h2 class="text-subtitle-1 font-weight-bold mb-0">Bước 2: Soạn Nội Dung Tin Nhắn</h2>
          </div>

          <!-- Quick Templates Chips -->
          <div class="mb-6 space-y-2">
            <span class="text-caption font-weight-bold text-medium-emphasis uppercase d-block mb-1">Mẫu Tin Nhắn Gợi Ý:</span>
            <div class="d-flex align-center gap-2 flex-wrap">
              <v-chip color="primary" variant="tonal" size="small" class="font-weight-bold cursor-pointer py-1" @click="fillTemplate('nhac_lich')">
                📅 Nhắc Lịch Hẹn
              </v-chip>
              <v-chip color="success" variant="tonal" size="small" class="font-weight-bold cursor-pointer py-1" @click="fillTemplate('chuc_mung')">
                🎉 Sinh Nhật KH
              </v-chip>
              <v-chip color="warning" variant="tonal" size="small" class="font-weight-bold cursor-pointer py-1" @click="fillTemplate('khuyen_mai')">
                🔥 Khuyến Mãi Hot
              </v-chip>
            </div>
          </div>

          <!-- Form Text Fields -->
          <div class="space-y-6 flex-grow-1 d-flex flex-column">
            <div>
              <label class="text-caption font-weight-bold text-medium-emphasis mb-2 d-block">Tiêu Đề Thông Báo:</label>
              <v-text-field
                v-model="tieuDe"
                placeholder="Nhập tiêu đề thông báo..."
                variant="outlined"
                density="comfortable"
                rounded="xl"
                hide-details
              ></v-text-field>
            </div>

            <div class="flex-grow-1 d-flex flex-column">
              <label class="text-caption font-weight-bold text-medium-emphasis mb-2 d-block">Nội Dung Chi Tiết Tin Nhắn:</label>
              <v-textarea
                v-model="noiDung"
                placeholder="Nhập nội dung chi tiết gửi cho khách hàng..."
                variant="outlined"
                rounded="2xl"
                rows="8"
                hide-details
                class="flex-grow-1"
              ></v-textarea>
            </div>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- ── BOTTOM TABS SECTION: (1) LỊCH ĐẶT HẸN & (2) LỊCH SỬ TIN NHẮN ── -->
    <v-card rounded="2xl" border elevation="2" class="pa-6 pa-md-7 mt-8">
      <div class="d-flex align-center justify-space-between border-b pb-4 mb-6">
        <v-btn-toggle v-model="activeBottomTab" mandatory color="primary" rounded="xl" density="comfortable">
          <v-btn value="datlich" class="text-none font-weight-bold px-4 py-2">
            <CalendarDays class="w-4 h-4 mr-2" />
            Lịch Đặt Hẹn Khách ({{ filteredDatLichList.length }})
          </v-btn>
          <v-btn value="lichsu" class="text-none font-weight-bold px-4 py-2">
            <History class="w-4 h-4 mr-2" />
            Lịch Sử Gửi Thông Báo ({{ filteredSentNotifications.length }})
          </v-btn>
        </v-btn-toggle>

        <v-btn v-if="activeBottomTab === 'lichsu'" color="error" variant="tonal" size="small" rounded="lg" class="text-none font-weight-bold px-4" @click="clearSentHistory">
          Xóa Lịch Sử
        </v-btn>
      </div>

      <!-- TAB 1: LỊCH ĐẶT HẸN KHÁCH HÀNG -->
      <div v-if="activeBottomTab === 'datlich'" class="space-y-6">
        <!-- Controls -->
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-4 mb-4">
          <div class="d-flex align-center gap-3 w-100 sm:w-auto">
            <v-text-field
              v-model="datLichNgayFilter"
              type="date"
              variant="outlined"
              density="compact"
              hide-details
              rounded="xl"
              style="min-width: 170px;"
              @change="loadKhachHangDatLich"
            ></v-text-field>

            <v-select
              v-model="datLichTrangThaiFilter"
              :items="[
                { title: 'Tất cả trạng thái', value: 'all' },
                { title: 'Chờ xác nhận', value: '0' },
                { title: 'Đã xác nhận', value: '1' },
                { title: 'Hoàn thành', value: '2' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              rounded="xl"
              style="min-width: 180px;"
            ></v-select>
          </div>

          <v-text-field
            v-model="datLichSearch"
            placeholder="Tìm tên, SĐT..."
            variant="outlined"
            density="compact"
            hide-details
            rounded="xl"
            style="min-width: 220px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis" />
            </template>
          </v-text-field>
        </div>

        <!-- Table -->
        <v-table class="bg-transparent" border rounded="xl">
          <thead :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
            <tr>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Khách Hàng</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">SĐT</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Ngày Hẹn</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Trạng Thái</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4 text-end">Hành Động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loadingDatLich">
              <td colspan="5" class="text-center py-8">
                <v-progress-circular indeterminate color="primary" size="32"></v-progress-circular>
              </td>
            </tr>
            <tr v-else-if="filteredDatLichList.length === 0">
              <td colspan="5" class="text-center py-8 text-caption font-weight-bold text-medium-emphasis">
                Không tìm thấy lịch hẹn phù hợp
              </td>
            </tr>
            <tr v-for="item in filteredDatLichList" :key="item.maLd">
              <td class="font-weight-bold px-4 py-3">{{ item.hoTen || item.maKh }}</td>
              <td class="font-mono text-caption px-4 py-3">{{ item.sdt || '—' }}</td>
              <td class="text-caption font-weight-medium px-4 py-3">
                {{ formatNgayVN(item.ngayHen) }} {{ item.gioBatDau ? `(${item.gioBatDau})` : '' }}
              </td>
              <td class="px-4 py-3">
                <v-chip :color="getTrangThaiDatLich(item.trangThai).color" size="x-small" variant="flat" class="font-weight-black">
                  {{ getTrangThaiDatLich(item.trangThai).label }}
                </v-chip>
              </td>
              <td class="text-end px-4 py-3">
                <v-btn color="primary" size="small" variant="tonal" rounded="lg" class="text-none font-weight-bold px-4" @click="selectDatLichKhach(item)">
                  Chọn Gửi Tin
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- TAB 2: LỊCH SỬ GỬI THÔNG BÁO -->
      <div v-else class="space-y-6">
        <!-- Controls -->
        <div class="d-flex flex-column flex-sm-row align-center justify-space-between gap-4 mb-4">
          <div class="d-flex align-center gap-3 w-100 sm:w-auto">
            <v-select
              v-model="historyStatusFilter"
              :items="[
                { title: 'Tất cả kết quả', value: 'all' },
                { title: 'Thành công', value: 'success' },
                { title: 'Một số thất bại', value: 'partial' },
                { title: 'Thất bại', value: 'error' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              rounded="xl"
              style="min-width: 180px;"
            ></v-select>

            <v-select
              v-model="historyChannelFilter"
              :items="[
                { title: 'Tất cả kênh', value: 'all' },
                { title: 'Kênh Zalo', value: 'Zalo' },
                { title: 'Kênh Gmail', value: 'Gmail' }
              ]"
              item-title="title"
              item-value="value"
              variant="outlined"
              density="compact"
              hide-details
              rounded="xl"
              style="min-width: 180px;"
            ></v-select>
          </div>

          <v-text-field
            v-model="historySearch"
            placeholder="Tìm người nhận, nội dung..."
            variant="outlined"
            density="compact"
            hide-details
            rounded="xl"
            style="min-width: 220px;"
          >
            <template v-slot:prepend-inner>
              <Search class="w-4 h-4 text-medium-emphasis" />
            </template>
          </v-text-field>
        </div>

        <!-- History Table -->
        <v-table class="bg-transparent" border rounded="xl">
          <thead :class="isDark ? 'bg-grey-darken-3' : 'bg-grey-lighten-4'">
            <tr>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Thời Gian</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Người Nhận</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Kênh Gửi</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Tiêu Đề</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4">Trạng Thái</th>
              <th class="font-weight-bold text-subtitle-2 py-3 px-4 text-end">Thao Tác</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredSentNotifications.length === 0">
              <td colspan="6" class="text-center py-8 text-caption font-weight-bold text-medium-emphasis">
                Chưa có lịch sử gửi thông báo nào
              </td>
            </tr>
            <tr v-for="item in filteredSentNotifications" :key="item.id">
              <td class="text-caption font-mono px-4 py-3">{{ formatTime(item.timestamp) }}</td>
              <td class="font-weight-bold px-4 py-3">{{ item.hoTen }}</td>
              <td class="px-4 py-3">
                <v-chip color="info" size="x-small" variant="tonal" class="font-weight-bold me-1">
                  {{ item.kenhGui }}
                </v-chip>
              </td>
              <td class="text-caption font-weight-medium max-w-xs text-truncate px-4 py-3">{{ item.tieuDe }}</td>
              <td class="px-4 py-3">
                <v-chip
                  :color="item.trangThai === 'success' ? 'success' : (item.trangThai === 'partial' ? 'warning' : 'error')"
                  size="x-small"
                  variant="flat"
                  class="font-weight-black"
                >
                  {{ item.trangThai === 'success' ? 'Thành công' : (item.trangThai === 'partial' ? 'Từng phần' : 'Thất bại') }}
                </v-chip>
              </td>
              <td class="text-end px-4 py-3">
                <v-btn icon size="small" variant="text" color="primary" @click="openDetailModal(item)">
                  <Eye class="w-4 h-4" />
                </v-btn>
                <v-btn icon size="small" variant="text" color="success" @click="resendMessage(item)">
                  <RotateCcw class="w-4 h-4" />
                </v-btn>
                <v-btn icon size="small" variant="text" color="error" @click="deleteSentItem(item.id)">
                  <Trash2 class="w-4 h-4" />
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>

    <!-- ── ZALO QR LOGIN MODAL (VUETIFY DIALOG) ── -->
    <v-dialog v-model="qrModalOpen" max-width="450px" @click:outside="closeQrLoginModal">
      <v-card rounded="2xl" class="pa-6 text-center space-y-4">
        <div class="d-flex align-center justify-space-between border-b pb-3">
          <div class="d-flex align-center gap-2">
            <QrCode class="w-5 h-5 text-success" />
            <h3 class="text-subtitle-1 font-weight-bold mb-0">Đăng Nhập Zalo Chat (QR)</h3>
          </div>
          <v-btn variant="text" icon density="comfortable" @click="closeQrLoginModal">
            <X class="w-4 h-4" />
          </v-btn>
        </div>

        <div v-if="qrLoginState.status === 'generating'" class="py-10">
          <v-progress-circular indeterminate color="success" size="40" class="mb-3"></v-progress-circular>
          <div class="text-caption font-weight-bold text-medium-emphasis">Đang khởi tạo mã QR từ Zalo Bridge...</div>
        </div>

        <div v-else-if="qrLoginState.qrDataUrl" class="py-4 space-y-3">
          <v-sheet border rounded="xl" class="pa-3 d-inline-block">
            <img :src="qrLoginState.qrDataUrl" alt="Zalo QR Code" class="w-56 h-56 rounded-lg" />
          </v-sheet>
          <p class="text-caption text-medium-emphasis">Dùng ứng dụng Zalo trên điện thoại để quét mã QR</p>
        </div>

        <div v-else-if="qrLoginState.error" class="py-6 text-error font-weight-bold text-caption">
          {{ qrLoginState.error }}
        </div>
      </v-card>
    </v-dialog>

    <!-- ── DETAIL MODAL (VUETIFY DIALOG) ── -->
    <v-dialog v-model="detailModalOpen" max-width="560px">
      <v-card v-if="selectedDetailItem" rounded="2xl" class="pa-6 space-y-4">
        <div class="d-flex align-center justify-space-between border-b pb-3">
          <h3 class="text-subtitle-1 font-weight-bold mb-0">Chi Tiết Thông Báo</h3>
          <v-btn variant="text" icon density="comfortable" @click="detailModalOpen = false">
            <X class="w-4 h-4" />
          </v-btn>
        </div>

        <div class="space-y-3 text-body-2">
          <div><strong>Người nhận:</strong> {{ selectedDetailItem.hoTen }}</div>
          <div><strong>Kênh gửi:</strong> {{ selectedDetailItem.kenhGui }}</div>
          <div><strong>Tiêu đề:</strong> {{ selectedDetailItem.tieuDe }}</div>
          <div><strong>Nội dung:</strong></div>
          <v-sheet rounded="lg" border class="pa-3 bg-surface text-caption font-mono">
            {{ selectedDetailItem.noiDung }}
          </v-sheet>
          <div><strong>Chi tiết phản hồi:</strong> {{ selectedDetailItem.chiTiet }}</div>
        </div>

        <div class="d-flex justify-end border-t pt-4">
          <v-btn variant="flat" color="primary" rounded="lg" class="text-none font-weight-bold" @click="detailModalOpen = false">
            Đóng
          </v-btn>
        </div>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* Enforce uniform, elegant 20px rounded corners across ALL Vuetify cards */
:deep(.v-card),
:deep(.v-sheet.v-card),
.v-card {
  border-radius: 20px !important;
}

:deep(.v-card.rounded-xl),
:deep(.v-sheet.rounded-xl) {
  border-radius: 16px !important;
}

:deep(.v-card.rounded-lg) {
  border-radius: 12px !important;
}
</style>
