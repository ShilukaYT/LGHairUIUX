<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'
import { logActivity } from '@/utils/activityLogger'
import {
  Bell,
  Send,
  Mail,
  MessageSquare,
  RefreshCw,
  User,
  Phone,
  AtSign,
  FileText,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  Sparkles,
  QrCode,
  Search,
  Users,
  History,
  Trash2,
  Eye,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-vue-next'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const BRIDGE_URL = 'http://127.0.0.1:3847'

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
    toast.error('Khách hàng chưa có số điện thoại')
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

const zaloBannerClass = computed(() => {
  const z = zaloTrangThai.value
  if (!z?.isPersonal) return 'border-border bg-muted/30 text-foreground'
  if (z.personalBridgeReachable !== true)
    return 'border-destructive/40 bg-destructive/10 text-foreground'
  if (z.personalLoggedIn === true && z.credentialsValidShape === true)
    return 'border-emerald-500/40 bg-emerald-500/10 text-foreground'
  return 'border-amber-500/50 bg-amber-500/10 text-foreground'
})

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
      return bVal - aVal // Có Zalo (1) lên trước Không Zalo/chưa check (0)
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

/** Chuỗi dùng cho typeahead / textValue (reka-ui). */
function khachTextValue(k: KhachHangOption) {
  return [k.maKh, k.hoTen, k.sdt, k.email].filter(Boolean).join(' ')
}

async function loadKhachHang() {
  loadingList.value = true
  try {
    const res = await axios.get<KhachHangOption[]>(`${API}/api/ThongBao/khach-hang`, {
      withCredentials: true,
    })
    khachHangList.value = Array.isArray(res.data) ? res.data : []
  } catch {
    toast.error('Không tải được danh sách khách hàng.')
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
        toast.success('🎉 Đăng nhập Zalo thành công!')
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

/* ── Zalo Phone Check Methods ── */
async function checkZaloPhone(phone: string | null | undefined, id: string) {
  if (!phone || !phone.trim()) {
    toast.error('Khách hàng chưa có số điện thoại')
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
        toast.success(`Tìm thấy Zalo: ${res.data.user.displayName}`)
      } else {
        toast.warning(res.data.error || 'SĐT chưa đăng ký Zalo hoặc chặn tìm kiếm')
      }
    } else {
      zaloPhoneChecks.value[id] = { checking: false, exists: false, error: res.data?.error || 'Lỗi rà soát' }
    }
  } catch {
    zaloPhoneChecks.value[id] = { checking: false, exists: false, error: 'Không kết nối được Bridge 3847' }
    toast.error('Không kết nối được Zalo Bridge (Cổng 3847)')
  }
}

async function checkBulkZaloPhones() {
  const toCheck = khachHangList.value.filter((k) => selectedMaKhs.value.includes(k.maKh) && k.sdt)
  if (toCheck.length === 0) {
    toast.error('Vui lòng chọn ít nhất một khách hàng có SĐT để rà soát')
    return
  }
  toast.info(`Đang kiểm tra Zalo cho ${toCheck.length} khách hàng...`)
  for (const k of toCheck) {
    await checkZaloPhone(k.sdt, k.maKh)
    await new Promise((r) => setTimeout(r, 300))
  }
  toast.success('Đã hoàn tất rà soát SĐT Zalo!')
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
    toast.error('Chọn khách hàng và ít nhất một kênh (Gmail hoặc Zalo).')
    return
  }

  sending.value = true

  // ── 1. GỬI HÀNG LOẠT (BULK SEND) ──
  if (sendMode.value === 'bulk') {
    const targetCustomers = khachHangList.value.filter((k) => selectedMaKhs.value.includes(k.maKh))
    let successCount = 0
    let failCount = 0
    const channels = [sendViaGmail.value && 'Gmail', sendViaZalo.value && 'Zalo'].filter(Boolean).join(', ')
    toast.info(`Bắt đầu gửi thông báo cho ${targetCustomers.length} khách hàng...`)

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
      toast.success(`🎉 Đã gửi thành công cho tất cả ${successCount} khách hàng!`)
      logActivity('Gửi hàng loạt', `Đã gửi thông báo thành công cho ${successCount} khách hàng qua ${channels}`, 'Thông báo')
    } else if (successCount > 0) {
      toast.warning(`Đã gửi thành công ${successCount}/${targetCustomers.length} khách hàng. Thất bại: ${failCount}.`)
      logActivity('Gửi hàng loạt', `Gửi thông báo ${successCount}/${targetCustomers.length} thành công, thất bại ${failCount} qua ${channels}`, 'Thông báo')
    } else {
      toast.error(`Gửi thất bại cho tất cả ${targetCustomers.length} khách hàng.`)
      logActivity('Gửi hàng loạt', `Thất bại khi gửi thông báo cho ${targetCustomers.length} khách hàng qua ${channels}`, 'Thông báo', 'Thất bại')
    }
    return
  }

  // ── 2. GỬI TỪNG KHÁCH HÀNG (SINGLE SEND) ──
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

    function isZaloOnlyHttpTest(r: { kenhGui: string; trangThai: number; chiTiet: string | null }) {
      return (
        r.kenhGui === 'ZALO' &&
        r.trangThai === 1 &&
        (r.chiTiet?.includes('HttpTest') || r.chiTiet?.toLowerCase().includes('httpbin'))
      )
    }

    const gmailR = results.find((r) => r.kenhGui === 'GMAIL')
    const zaloR = results.find((r) => r.kenhGui === 'ZALO')
    const zaloSimulated = zaloR && isZaloOnlyHttpTest(zaloR)

    const allOk = results.length ? results.every((r) => r.trangThai === 1) : data.success

    if (data.success && allOk && zaloSimulated && gmailR?.trangThai === 1) {
      logActivity('Gửi thông báo', `Đã gửi thông báo thành công cho khách hàng ${khachName} qua kênh ${channels}`, 'Thông báo')
      toast.success('Đã gửi Gmail thành công.')
      toast.warning('Zalo: đang chế độ thử (HttpTest)', {
        description:
          'Tin không lên app Zalo. Server: Zalo:Mode=Zns + OA token + Zns:TemplateId, hoặc Mode=Personal + chạy bridge Node (MinhTamHair-ZaloPersonalBridge) và Personal:BaseUrl.',
        duration: 12000,
      })
      addSentNotification({
        maKh: selectedKhach.value?.maKh || maKh.value,
        hoTen: khachName,
        sdt: selectedKhach.value?.sdt || undefined,
        email: selectedKhach.value?.email || undefined,
        tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
        noiDung: noiDung.value.trim() || 'Không có nội dung',
        kenhGui: channels,
        trangThai: 'success',
        chiTiet: 'GMAIL: OK — ZALO: OK (HttpTest Simulated)',
        mode: 'single'
      })
    } else if (data.success && allOk && zaloSimulated && !sendViaGmail.value) {
      logActivity('Gửi thông báo', `Đã gửi thông báo thành công cho khách hàng ${khachName} qua kênh ${channels} (Simulated)`, 'Thông báo')
      toast.warning('Zalo: chưa gửi thật (HttpTest)', {
        description:
          'Chỉ gọi URL thử (httpbin), không tin trên app. Gửi thật: Zns (OA + template) hoặc Personal (bridge zca-js + BaseUrl).',
        duration: 12000,
      })
      addSentNotification({
        maKh: selectedKhach.value?.maKh || maKh.value,
        hoTen: khachName,
        sdt: selectedKhach.value?.sdt || undefined,
        email: selectedKhach.value?.email || undefined,
        tieuDe: tieuDe.value.trim() || 'Không có tiêu đề',
        noiDung: noiDung.value.trim() || 'Không có nội dung',
        kenhGui: channels,
        trangThai: 'success',
        chiTiet: 'ZALO: OK (HttpTest Simulated)',
        mode: 'single'
      })
    } else if (data.success && allOk) {
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      logActivity('Gửi thông báo', `Đã gửi thông báo thành công cho khách hàng ${khachName} qua kênh ${channels}`, 'Thông báo')
      toast.success(data.message || 'Đã gửi thông báo.', detail ? { description: detail } : undefined)
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
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      logActivity('Gửi thông báo', `Đã gửi thông báo cho khách hàng ${khachName} qua kênh ${channels} (Một số kênh thất bại)`, 'Thông báo')
      toast.warning(data.message || 'Một số kênh thất bại.', { description: detail })
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
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      logActivity('Gửi thông báo', `Thất bại khi gửi thông báo cho khách hàng ${khachName} qua kênh ${channels} - Lỗi: ${data.message || ''}`, 'Thông báo', 'Thất bại')
      toast.error(data.message || 'Gửi thất bại.', detail ? { description: detail } : undefined)
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
      toast.error(errorMsg)
    } else if (axios.isAxiosError(e) && e.response?.status === 400) {
      const msg = (e.response.data as { message?: string })?.message
      errorMsg = msg || 'Dữ liệu không hợp lệ.'
      toast.error(errorMsg)
    } else {
      toast.error(errorMsg)
    }
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
      // Xóa dữ liệu mẫu cũ (demo) nếu toàn bộ là fake data
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
    toast.success('Đã xóa toàn bộ lịch sử tin nhắn.')
  }
}

function deleteSentItem(id: string) {
  sentNotifications.value = sentNotifications.value.filter(item => item.id !== id)
  saveSentNotificationsToStorage()
  toast.success('Đã xóa tin nhắn khỏi lịch sử.')
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
  
  toast.success('Đã sao chép nội dung tin nhắn vào biểu mẫu!', {
    description: 'Bạn có thể kiểm tra lại thông tin và bấm Gửi ngay ở trên.'
  })
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

onMounted(() => {
  loadKhachHang()
  loadZaloTrangThai()
  loadSentNotifications()
})

onUnmounted(() => {
  stopQrPolling()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-5 px-1 sm:px-0">
    <Toaster rich-colors position="top-right" />

    <!-- ── HEADER ── -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
          <div class="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Bell class="size-5" />
          </div>
          Gửi thông báo khách hàng
        </h1>
        <p class="text-muted-foreground text-sm mt-1 ml-11">Gửi tin nhắn chăm sóc khách hàng qua Gmail &amp; Zalo</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white shadow transition-all hover:opacity-90 active:scale-95 shrink-0 self-start sm:self-auto"
        style="background: linear-gradient(135deg, #10b981, #059669);"
        @click="openQrLoginModal"
      >
        <QrCode class="size-4" />
        Đăng nhập Zalo (QR)
      </button>
    </div>

    <!-- ── FORM GỬI TIN (2 CỘT) ── -->
    <form @submit.prevent="onSubmit" class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

      <!-- CỘT TRÁI (CHỌN ĐỐI TƯỢNG & XÁC NHẬN GỬI) -->
      <div class="lg:col-span-5 space-y-4">
        
        <!-- BƯỚC 1: CHỌN ĐỐI TƯỢNG -->
        <div class="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">1</span>
            <span class="font-semibold text-xs text-foreground">Đối tượng nhận tin</span>
            <div class="ml-auto flex p-0.5 bg-muted rounded-lg border border-border/60 gap-0.5">
              <button type="button" class="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all" :class="sendMode === 'single' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'" @click="sendMode = 'single'">
                <User class="size-3" /> 1 KH
              </button>
              <button type="button" class="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold transition-all" :class="sendMode === 'bulk' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'" @click="sendMode = 'bulk'">
                <Users class="size-3" /> Hàng loạt
                <span v-if="selectedMaKhs.length > 0" class="ml-0.5 bg-primary text-white text-[9px] rounded-full px-1.5 font-bold">{{ selectedMaKhs.length }}</span>
              </button>
            </div>
          </div>

          <div class="p-4">
            <!-- SINGLE MODE -->
            <div v-if="sendMode === 'single'" class="space-y-3">
              <Select v-model="maKh" :disabled="loadingList">
                <SelectTrigger id="khach" class="border-input bg-background h-10 w-full px-3 text-xs font-normal shadow-sm">
                  <SelectValue :placeholder="loadingList ? 'Đang tải...' : 'Chọn khách hàng...'" />
                </SelectTrigger>
                <SelectContent class="max-h-[min(24rem,70vh)] rounded-xl border-border/80 shadow-xl">
                  <SelectItem v-for="k in khachHangList" :key="k.maKh" :value="k.maKh" :text-value="khachTextValue(k)" class="cursor-pointer py-2 px-3 text-xs rounded-lg my-0.5">
                    <div class="flex flex-col text-left">
                      <div class="font-medium text-foreground flex items-center gap-1">
                        <span>{{ k.hoTen?.trim() || 'Khách hàng' }}</span>
                        <span class="text-[9px] px-1 py-0.2 rounded bg-muted font-mono text-muted-foreground">{{ k.maKh }}</span>
                      </div>
                      <div class="text-muted-foreground flex items-center gap-2 text-[10px] mt-0.5">
                        <span class="flex items-center gap-0.5"><Phone class="size-2.5 text-emerald-600/80" />{{ k.sdt?.trim() || 'Chưa có SĐT' }}</span>
                        <span class="flex items-center gap-0.5"><Mail class="size-2.5 text-blue-600/80" />{{ k.email?.trim() || 'Chưa có Email' }}</span>
                      </div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <transition enter-active-class="transition duration-200 ease-out" enter-from-class="opacity-0 scale-95" enter-to-class="opacity-100 scale-100">
                <div v-if="selectedKhach" class="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
                  <div class="flex items-start justify-between gap-1.5">
                    <div>
                      <div class="font-semibold text-foreground text-xs">{{ selectedKhach.hoTen?.trim() || '—' }}</div>
                      <div class="text-[10px] text-muted-foreground font-mono mt-0.5">{{ selectedKhach.maKh }}</div>
                    </div>
                    <div class="flex flex-col items-end text-[10px] text-muted-foreground gap-0.5">
                      <span v-if="selectedKhach.sdt" class="flex items-center gap-0.5 font-mono"><Phone class="size-2.5 text-emerald-600" />{{ selectedKhach.sdt }}</span>
                      <span v-if="selectedKhach.email" class="flex items-center gap-0.5"><AtSign class="size-2.5 text-blue-600" />{{ selectedKhach.email }}</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-2 pt-2 border-t border-border/40">
                    <Button v-if="selectedKhach.sdt" type="button" variant="outline" size="sm" class="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 flex items-center gap-1 shrink-0" :disabled="getCheckResult(selectedKhach?.maKh)?.checking" @click="checkKhachZalo(selectedKhach)">
                      <RefreshCw v-if="getCheckResult(selectedKhach?.maKh)?.checking" class="size-2.5 animate-spin" />
                      <Smartphone v-else class="size-2.5" />
                      Kiểm tra Zalo
                    </Button>
                    <span v-if="getCheckResult(selectedKhach?.maKh)?.checking" class="text-[10px] text-muted-foreground animate-pulse">Đang check...</span>
                    <span v-else-if="getCheckResult(selectedKhach?.maKh)?.exists" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-700 font-semibold border border-emerald-500/20 text-[10px]">
                      <img v-if="getCheckResult(selectedKhach?.maKh)?.user?.avatar" :src="getCheckResult(selectedKhach?.maKh)?.user?.avatar || undefined" class="size-3.5 rounded-full object-cover" />
                      <CheckCircle2 v-else class="size-3 text-emerald-600" />
                      {{ getCheckResult(selectedKhach?.maKh)?.user?.displayName || 'Có Zalo' }}
                    </span>
                    <span v-else-if="getCheckResult(selectedKhach?.maKh)?.exists === false" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-red-500/10 text-red-600 font-semibold border border-red-500/20 text-[10px]">
                      <AlertCircle class="size-3 text-red-600" />Không Zalo
                    </span>
                  </div>
                </div>
              </transition>
            </div>

            <!-- BULK MODE -->
            <div v-else class="space-y-3">
              <div class="flex items-center gap-1.5">
                <div class="relative flex-1">
                  <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input v-model="bulkSearchQuery" placeholder="Tìm kiếm nhanh..." class="pl-8 h-8 text-xs" />
                </div>
                <Button type="button" variant="outline" size="sm" class="h-8 px-2 text-[11px] shrink-0" @click="selectAllBulk">Tất cả</Button>
                <Button type="button" variant="outline" size="sm" class="h-8 px-2 text-[11px] shrink-0" @click="deselectAllBulk">Bỏ</Button>
              </div>

              <!-- Action button check Zalo -->
              <div class="flex items-center justify-between gap-2 text-[10px] text-muted-foreground border-b border-border/40 pb-2">
                <div class="flex items-center gap-2">
                  <span>Chọn: <strong class="text-primary">{{ selectedMaKhs.length }}</strong>/{{ khachHangList.length }}</span>
                  <label class="inline-flex items-center gap-1 cursor-pointer select-none bg-muted px-1.5 py-0.5 rounded border hover:bg-muted/80">
                    <input type="checkbox" v-model="sortByZalo" class="size-3 rounded text-primary focus:ring-primary/30 cursor-pointer" />
                    <span class="text-[9px] font-semibold text-foreground">Xếp Zalo lên đầu</span>
                  </label>
                </div>
                <Button type="button" variant="outline" size="sm" class="h-6 px-2 text-[10px] border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 flex items-center gap-1" @click="checkBulkZaloPhones">
                  <Smartphone class="size-2.5" />Rà Zalo ({{ selectedMaKhs.length }})
                </Button>
              </div>

              <!-- List scrollable -->
              <div class="max-h-60 overflow-y-auto rounded-xl border border-border/70 bg-background divide-y divide-border/40">
                <div v-if="filteredKhachHangList.length === 0" class="p-4 text-center text-xs text-muted-foreground">Không tìm thấy.</div>
                <div
                  v-for="k in filteredKhachHangList" :key="k.maKh"
                  class="flex items-center gap-2.5 px-2.5 py-2 hover:bg-muted/40 cursor-pointer select-none transition-colors"
                  :class="selectedMaKhs.includes(k.maKh) ? 'bg-primary/5' : ''"
                  @click="toggleSelectKhach(k.maKh)"
                >
                  <div class="flex size-4 shrink-0 items-center justify-center rounded border transition-colors" :class="selectedMaKhs.includes(k.maKh) ? 'bg-primary border-primary text-white' : 'border-input bg-background'">
                    <CheckCircle2 v-if="selectedMaKhs.includes(k.maKh)" class="size-3" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1 text-xs">
                      <span class="font-medium text-foreground truncate">{{ k.hoTen || 'Khách hàng' }}</span>
                      <span class="text-[8px] font-mono text-muted-foreground bg-muted px-1 rounded shrink-0">{{ k.maKh }}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span class="flex items-center gap-0.5"><Phone class="size-2 text-emerald-600" />{{ k.sdt || '—' }}</span>
                    </div>
                  </div>
                  <!-- Zalo check status -->
                  <div class="shrink-0" @click.stop>
                    <Button v-if="!getCheckResult(k.maKh)" type="button" variant="ghost" size="icon" class="size-6 text-muted-foreground hover:text-emerald-600 hover:bg-emerald-500/10 rounded-lg" :disabled="!k.sdt" @click="checkKhachZalo(k)">
                      <Smartphone class="size-3" />
                    </Button>
                    <span v-else class="flex items-center text-[10px]">
                      <RefreshCw v-if="getCheckResult(k.maKh)?.checking" class="size-3 animate-spin text-muted-foreground" />
                      <span v-else-if="getCheckResult(k.maKh)?.exists" class="px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold text-[8px]">Zalo</span>
                      <span v-else class="px-1 py-0.2 rounded bg-red-500/10 text-red-600 text-[8px]">Không</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- BƯỚC 3: KÊNH GỬI + NÚT GỬI -->
        <div class="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
          <div class="flex items-center gap-3 px-4 py-3 border-b border-border/60 bg-muted/30">
            <span class="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold">3</span>
            <span class="font-semibold text-xs text-foreground">Kênh gửi &amp; Xác nhận</span>
          </div>
          <div class="p-4 space-y-3">
            <div class="flex flex-col gap-2">
              <label class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none text-xs" :class="sendViaGmail ? 'border-blue-500 bg-blue-500/5' : 'border-border/60 hover:bg-muted/30'">
                <input v-model="sendViaGmail" type="checkbox" class="sr-only" />
                <Mail class="size-4 text-blue-500 shrink-0" />
                <div class="flex-1">
                  <div class="font-semibold text-foreground">Gửi Gmail</div>
                </div>
                <div class="size-4 rounded-full border flex items-center justify-center shrink-0" :class="sendViaGmail ? 'border-blue-500 bg-blue-500 text-white' : 'border-input'">
                  <CheckCircle2 v-if="sendViaGmail" class="size-3" />
                </div>
              </label>

              <label class="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all select-none text-xs" :class="sendViaZalo ? 'border-emerald-500 bg-emerald-500/5' : 'border-border/60 hover:bg-muted/30'">
                <input v-model="sendViaZalo" type="checkbox" class="sr-only" />
                <MessageSquare class="size-4 text-emerald-500 shrink-0" />
                <div class="flex-1">
                  <div class="font-semibold text-foreground">Gửi Zalo</div>
                </div>
                <div class="size-4 rounded-full border flex items-center justify-center shrink-0" :class="sendViaZalo ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-input'">
                  <CheckCircle2 v-if="sendViaZalo" class="size-3" />
                </div>
              </label>
            </div>

            <p v-if="!sendViaGmail && !sendViaZalo" class="text-destructive text-[11px] font-medium flex items-center gap-1">
              <AlertCircle class="size-3 shrink-0" />Chọn ít nhất một kênh.
            </p>

            <Button
              type="submit"
              :disabled="!canSubmit"
              class="w-full h-11 font-bold text-sm rounded-xl text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw v-if="sending" class="size-4 animate-spin" />
              <Send v-else class="size-4" />
              <span>{{
                sending
                  ? (sendMode === 'bulk' ? 'Đang gửi...' : 'Đang gửi...')
                  : sendMode === 'bulk'
                    ? 'Gửi cho ' + selectedMaKhs.length + ' KH'
                    : 'Gửi thông báo ngay'
              }}</span>
            </Button>
          </div>
        </div>

      </div>

      <!-- CỘT PHẢI (SOẠN NỘI DUNG) -->
      <div class="lg:col-span-7">
        
        <!-- BƯỚC 2: SOẠN NỘI DUNG TIN NHẮN -->
        <div class="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden h-full flex flex-col">
          <div class="flex items-center gap-3 px-5 py-3.5 border-b border-border/60 bg-muted/30">
            <span class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white text-xs font-bold">2</span>
            <span class="font-semibold text-sm text-foreground">Soạn nội dung thông báo</span>
          </div>
          <div class="p-5 space-y-4 flex-1 flex flex-col justify-between">
            <div class="space-y-3">
              <div>
                <label for="tieu-de" class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Tiêu đề</label>
                <Input id="tieu-de" v-model="tieuDe" class="h-10 bg-background text-xs" type="text" placeholder="Nhập tiêu đề thông báo..." autocomplete="off" />
              </div>
              <div class="flex flex-col flex-1">
                <label for="noi-dung" class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Nội dung</label>
                <textarea id="noi-dung" v-model="noiDung" rows="10" placeholder="Nhập nội dung gửi đến khách hàng..." class="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-primary/30 min-h-[220px] lg:min-h-[250px] w-full rounded-xl border p-3.5 text-xs shadow-sm transition-all focus-visible:ring-2 focus-visible:outline-none resize-none flex-1" />
              </div>
            </div>
            <div class="text-right text-[10px] text-muted-foreground pt-1 border-t border-border/20 mt-3">
              <span>{{ noiDung.length }} ký tự</span>
            </div>
          </div>
        </div>

      </div>

    </form>

    <!-- LỊCH SỬ TIN NHẮN ĐÃ GỬI -->
    <div class="rounded-2xl border border-border/80 bg-card shadow-sm overflow-hidden">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-border/60 bg-muted/20">
        <div class="flex items-center gap-3">
          <div class="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <History class="size-4" />
          </div>
          <div>
            <div class="font-bold text-sm text-foreground flex items-center gap-2">
              Lịch sử tin nhắn đã gửi
              <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold text-primary">{{ sentNotifications.length }}</span>
            </div>
            <div class="text-xs text-muted-foreground">Kết quả thực tế — thành công, thất bại và lý do chi tiết</div>
          </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="relative">
            <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input v-model="historySearch" type="text" placeholder="Tìm kiếm..." class="h-8 w-40 pl-8 pr-3 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
          </div>
          <select v-model="historyStatusFilter" class="h-8 px-2 rounded-lg border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
            <option value="all">Tất cả trạng thái</option>
            <option value="success">Thành công</option>
            <option value="partial">Một phần</option>
            <option value="error">Thất bại</option>
          </select>
          <select v-model="historyChannelFilter" class="h-8 px-2 rounded-lg border border-input bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer">
            <option value="all">Tất cả kênh</option>
            <option value="Zalo">Zalo</option>
            <option value="Gmail">Gmail</option>
          </select>
          <button v-if="sentNotifications.length > 0" type="button" class="h-8 px-3 rounded-lg border border-destructive/30 text-destructive text-xs font-medium hover:bg-destructive/10 transition-colors flex items-center gap-1.5" @click="clearSentHistory">
            <Trash2 class="size-3.5" />Xóa tất cả
          </button>
        </div>
      </div>

      <div v-if="filteredSentNotifications.length === 0" class="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div class="flex size-14 items-center justify-center rounded-2xl bg-muted/40 border border-border/60">
          <History class="size-7 text-muted-foreground/40" />
        </div>
        <div>
          <p class="text-sm font-semibold text-foreground">{{ sentNotifications.length === 0 ? 'Chưa có lịch sử gửi tin' : 'Không có kết quả phù hợp' }}</p>
          <p class="text-xs text-muted-foreground mt-1 max-w-xs">{{ sentNotifications.length === 0 ? 'Sau khi gửi, hệ thống tự ghi lại kết quả thực tế từng lần gửi vào đây.' : 'Thử thay đổi bộ lọc hoặc từ khóa.' }}</p>
        </div>
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead>
            <tr class="border-b border-border/60 bg-muted/30 text-muted-foreground text-[11px] uppercase font-bold">
              <th class="py-2.5 px-4 w-[120px]">Thời gian</th>
              <th class="py-2.5 px-4 min-w-[150px]">Khách hàng</th>
              <th class="py-2.5 px-4 w-[80px]">Kênh</th>
              <th class="py-2.5 px-4 min-w-[160px]">Nội dung</th>
              <th class="py-2.5 px-4 w-[110px]">Trạng thái</th>
              <th class="py-2.5 px-4 min-w-[180px]">Kết quả / Lý do lỗi</th>
              <th class="py-2.5 px-4 text-right w-[120px]">Thao tác</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/40">
            <tr v-for="item in filteredSentNotifications" :key="item.id" class="hover:bg-muted/20 transition-colors">
              <td class="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                <div class="flex items-center gap-1"><Clock class="size-3 shrink-0" />{{ formatTime(item.timestamp) }}</div>
              </td>
              <td class="py-2.5 px-4">
                <div class="font-semibold text-foreground flex items-center gap-1">
                  {{ item.hoTen }}
                  <span v-if="item.mode === 'bulk'" class="px-1.5 rounded bg-purple-500/10 text-purple-600 text-[10px] font-bold border border-purple-500/20">Loạt</span>
                </div>
                <div v-if="item.sdt" class="text-muted-foreground text-[11px] flex items-center gap-0.5 mt-0.5"><Phone class="size-2.5" />{{ item.sdt }}</div>
              </td>
              <td class="py-2.5 px-4 whitespace-nowrap">
                <div class="flex flex-col gap-0.5">
                  <span v-if="item.kenhGui.includes('Zalo')" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-semibold text-[10px]"><MessageSquare class="size-2.5" />Zalo</span>
                  <span v-if="item.kenhGui.includes('Gmail')" class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-700 border border-blue-500/20 font-semibold text-[10px]"><Mail class="size-2.5" />Gmail</span>
                </div>
              </td>
              <td class="py-2.5 px-4 max-w-[180px]">
                <div class="font-semibold text-foreground truncate text-[11px]" :title="item.tieuDe">{{ item.tieuDe }}</div>
                <div class="text-muted-foreground text-[11px] truncate mt-0.5" :title="item.noiDung">{{ item.noiDung }}</div>
              </td>
              <td class="py-2.5 px-4 whitespace-nowrap">
                <span v-if="item.trangThai === 'success'" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-700 font-bold text-[11px] border border-emerald-500/30"><CheckCircle class="size-3" />Thành công</span>
                <span v-else-if="item.trangThai === 'partial'" class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 text-amber-700 font-bold text-[11px] border border-amber-500/30"><AlertCircle class="size-3" />Một phần</span>
                <span v-else class="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/15 text-red-700 font-bold text-[11px] border border-red-500/30"><XCircle class="size-3" />Thất bại</span>
              </td>
              <td class="py-2.5 px-4 max-w-[200px]">
                <div class="text-[11px] truncate font-mono" :class="item.trangThai === 'error' ? 'text-red-600' : item.trangThai === 'partial' ? 'text-amber-700' : 'text-emerald-700'" :title="item.chiTiet">{{ item.chiTiet }}</div>
              </td>
              <td class="py-2.5 px-4 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1">
                  <Button type="button" variant="outline" size="sm" class="h-7 px-2 text-[11px] hover:bg-primary/10 hover:text-primary" @click="openDetailModal(item)">
                    <Eye class="size-3 mr-1" />Chi tiết
                  </Button>
                  <Button type="button" variant="outline" size="sm" class="h-7 w-7 p-0 hover:bg-emerald-500/10 hover:text-emerald-700" title="Gửi lại" @click="resendMessage(item)">
                    <RotateCcw class="size-3" />
                  </Button>
                  <button type="button" class="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-red-600 transition-colors rounded" title="Xóa" @click="deleteSentItem(item.id)">
                    <Trash2 class="size-3.5" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Chi tiết -->
    <Dialog :open="detailModalOpen" @update:open="(val) => !val && (detailModalOpen = false)">
      <DialogContent class="sm:max-w-xl rounded-2xl p-6 border border-border/80 shadow-2xl">
        <DialogHeader class="border-b border-border/40 pb-3 mb-4">
          <DialogTitle class="flex items-center gap-2 text-base font-bold text-foreground tracking-tight">
            <div class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
              <FileText class="size-4" />
            </div>
            Chi tiết tin nhắn đã gửi
          </DialogTitle>
          <DialogDescription v-if="selectedDetailItem" class="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 font-mono">
            <Clock class="size-3" /> Gửi lúc: {{ formatTime(selectedDetailItem.timestamp) }}
          </DialogDescription>
        </DialogHeader>

        <div v-if="selectedDetailItem" class="space-y-4 text-xs">
          <!-- Người nhận & Kênh gửi -->
          <div class="grid grid-cols-2 gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
            <div class="space-y-1">
              <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Khách hàng nhận</span>
              <div class="font-bold text-foreground text-sm flex items-center gap-1">
                {{ selectedDetailItem.hoTen }}
                <span v-if="selectedDetailItem.mode === 'bulk'" class="px-1.5 py-0.2 rounded bg-purple-500/10 text-purple-700 text-[9px] font-bold border border-purple-500/20">Hàng loạt</span>
              </div>
              <div class="text-muted-foreground text-[10px] space-y-0.5 mt-1">
                <div v-if="selectedDetailItem.sdt" class="flex items-center gap-1"><Phone class="size-3 text-emerald-600" /> {{ selectedDetailItem.sdt }}</div>
                <div v-if="selectedDetailItem.email" class="flex items-center gap-1"><Mail class="size-3 text-blue-600" /> {{ selectedDetailItem.email }}</div>
              </div>
            </div>
            <div class="space-y-1">
              <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Kênh & Trạng thái</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span v-if="selectedDetailItem.kenhGui.includes('Zalo')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold text-[9px]">
                  <MessageSquare class="size-2.5" /> Zalo
                </span>
                <span v-if="selectedDetailItem.kenhGui.includes('Gmail')" class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 border border-blue-500/20 font-bold text-[9px]">
                  <Mail class="size-2.5" /> Gmail
                </span>
              </div>
              <div class="pt-1.5">
                <span v-if="selectedDetailItem.trangThai === 'success'" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 font-bold text-[10px] border border-emerald-500/30">
                  <CheckCircle2 class="size-3" /> Thành công
                </span>
                <span v-else-if="selectedDetailItem.trangThai === 'partial'" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-bold text-[10px] border border-amber-500/30">
                  <AlertCircle class="size-3" /> Một phần
                </span>
                <span v-else class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-700 font-bold text-[10px] border border-red-500/30">
                  <XCircle class="size-3" /> Thất bại
                </span>
              </div>
            </div>
          </div>

          <!-- Tiêu đề -->
          <div class="space-y-1">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tiêu đề tin nhắn</span>
            <div class="p-3 rounded-lg border border-border/80 bg-background font-semibold text-foreground text-xs shadow-inner">
              {{ selectedDetailItem.tieuDe || '(Không có tiêu đề)' }}
            </div>
          </div>

          <!-- Nội dung -->
          <div class="space-y-1">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Nội dung tin nhắn</span>
            <div class="p-3 rounded-lg border border-border/80 bg-background font-mono text-xs whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed shadow-inner">
              {{ selectedDetailItem.noiDung || '(Nội dung trống)' }}
            </div>
          </div>

          <!-- Chi tiết kết quả xử lý từ hệ thống -->
          <div class="space-y-1">
            <span class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Chi tiết từ hệ thống</span>
            <div class="p-3 rounded-lg border font-mono text-[11px] leading-relaxed flex items-start gap-2 shadow-sm"
              :class="selectedDetailItem.trangThai === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700' : selectedDetailItem.trangThai === 'partial' ? 'bg-amber-500/10 border-amber-500/30 text-amber-700' : 'bg-red-500/10 border-red-500/30 text-red-700'">
              <AlertCircle class="size-4 shrink-0 mt-0.5" />
              <span>{{ selectedDetailItem.chiTiet }}</span>
            </div>
          </div>

          <!-- Hành động -->
          <div class="flex justify-end gap-2 pt-3 border-t border-border/40">
            <Button type="button" variant="outline" size="sm" class="h-9 px-4 text-xs font-semibold" @click="detailModalOpen = false">Đóng</Button>
            <Button type="button" size="sm" class="h-9 px-4 text-xs font-semibold bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90" @click="resendMessage(selectedDetailItem); detailModalOpen = false">
              <RotateCcw class="size-3.5" /> Soạn lại tin này
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Modal QR Login -->
    <Dialog :open="qrModalOpen" @update:open="(val) => !val && closeQrLoginModal()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="flex items-center gap-2 text-xl font-bold"><QrCode class="size-6 text-emerald-600" />Đăng nhập Zalo (Bridge)</DialogTitle>
          <DialogDescription>Quét mã QR bằng ứng dụng Zalo trên điện thoại để kết nối gửi tin.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col items-center justify-center p-6 space-y-4 min-h-[280px]">
          <div v-if="qrLoginState.status === 'generating'" class="flex flex-col items-center gap-3 text-muted-foreground">
            <RefreshCw class="size-8 animate-spin text-primary" /><p class="text-sm font-medium">Đang khởi tạo mã QR...</p>
          </div>
          <div v-else-if="qrLoginState.status === 'waiting_scan' && qrLoginState.qrDataUrl" class="flex flex-col items-center gap-3">
            <div class="p-3 bg-white rounded-2xl border shadow-lg"><img :src="qrLoginState.qrDataUrl" alt="QR" class="size-56 object-contain" /></div>
            <p class="text-xs text-muted-foreground text-center animate-pulse">Mở Zalo &gt; Quét QR &gt; Đồng ý đăng nhập</p>
          </div>
          <div v-else-if="qrLoginState.status === 'scanned'" class="flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 class="size-12 animate-bounce" /><p class="text-base font-semibold text-center">Đã quét! Vui lòng xác nhận trên điện thoại.</p>
          </div>
          <div v-else-if="qrLoginState.status === 'logged_in' || qrLoginState.loggedIn" class="flex flex-col items-center gap-3 text-emerald-600">
            <CheckCircle2 class="size-12" /><p class="text-lg font-bold text-center">Đăng nhập Zalo thành công!</p>
          </div>
          <div v-else-if="qrLoginState.status === 'expired'" class="flex flex-col items-center gap-3 text-amber-600">
            <AlertCircle class="size-12" /><p class="text-sm font-medium">Mã QR đã hết hạn.</p><Button size="sm" @click="startQrLogin">Tạo mã QR mới</Button>
          </div>
          <div v-else class="flex flex-col items-center gap-3 text-destructive">
            <AlertCircle class="size-12" /><p class="text-sm font-medium text-center">{{ qrLoginState.error || 'Có lỗi xảy ra khi tạo mã QR' }}</p><Button size="sm" variant="outline" @click="startQrLogin">Thử lại</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
