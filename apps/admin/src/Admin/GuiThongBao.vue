<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

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

const maKh = ref<string | undefined>(undefined)
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

const canSubmit = computed(
  () =>
    !!maKh.value?.trim() &&
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

async function onSubmit() {
  if (!canSubmit.value) {
    toast.error('Chọn khách hàng và ít nhất một kênh (Gmail hoặc Zalo).')
    return
  }

  sending.value = true
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
      toast.success('Đã gửi Gmail thành công.')
      toast.warning('Zalo: đang chế độ thử (HttpTest)', {
        description:
          'Tin không lên app Zalo. Server: Zalo:Mode=Zns + OA token + Zns:TemplateId, hoặc Mode=Personal + chạy bridge Node (MinhTamHair-ZaloPersonalBridge) và Personal:BaseUrl.',
        duration: 12000,
      })
    } else if (data.success && allOk && zaloSimulated && !sendViaGmail.value) {
      toast.warning('Zalo: chưa gửi thật (HttpTest)', {
        description:
          'Chỉ gọi URL thử (httpbin), không tin trên app. Gửi thật: Zns (OA + template) hoặc Personal (bridge zca-js + BaseUrl).',
        duration: 12000,
      })
    } else if (data.success && allOk) {
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      toast.success(data.message || 'Đã gửi thông báo.', detail ? { description: detail } : undefined)
    } else if (data.success) {
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      toast.warning(data.message || 'Một số kênh thất bại.', { description: detail })
    } else {
      const detail = results
        .map(
          (r) =>
            `${r.kenhGui}: ${r.trangThai === 1 ? 'OK' : 'lỗi'}${r.chiTiet ? ` — ${r.chiTiet}` : ''}`,
        )
        .join('\n')
      toast.error(data.message || 'Gửi thất bại.', detail ? { description: detail } : undefined)
    }
  } catch (e: unknown) {
    if (axios.isAxiosError(e) && e.response?.status === 404) {
      toast.error('Không tìm thấy khách hàng.')
    } else if (axios.isAxiosError(e) && e.response?.status === 400) {
      const msg = (e.response.data as { message?: string })?.message
      toast.error(msg || 'Dữ liệu không hợp lệ.')
    } else {
      toast.error('Lỗi kết nối hoặc máy chủ.')
    }
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  loadKhachHang()
  loadZaloTrangThai()
})
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6 px-1 sm:px-0">
    <Toaster rich-colors position="top-right" />
    <div>
      <h1 class="text-2xl font-semibold tracking-tight">Gửi thông báo khách hàng</h1>
      <p class="text-muted-foreground mt-1 text-sm">
      
        <span class="text-foreground/90"></span>
        <span class="text-foreground/90"></span> 
      </p>
      <div
        v-if="zaloTrangThai"
        class="mt-4 flex flex-col gap-2 rounded-lg border px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between"
        :class="zaloBannerClass"
      >
        <div class="min-w-0 flex-1 space-y-1">
          <p class="font-medium">
            Zalo · chế độ <span class="font-mono">{{ zaloTrangThai.mode }}</span>
            <span v-if="zaloTrangThai.isPersonal" class="text-muted-foreground font-normal">
              (bridge cổng 3847)
            </span>
          </p>
          <p v-if="zaloTrangThai.hint" class="text-foreground/90 leading-snug">
            {{ zaloTrangThai.hint }}
          </p>
          <p
            v-if="zaloTrangThai.isPersonal && zaloTrangThai.personalBridgeReachable === true"
            class="text-muted-foreground text-xs leading-relaxed"
          >
            Thứ tự: (1) <code class="rounded bg-background/80 px-1">npm run login</code> một lần → (2)
            <code class="rounded bg-background/80 px-1">npm start</code> giữ chạy → (3) gửi từ đây. Ảnh QR:
            thư mục bridge → <code class="rounded bg-background/80 px-1">zalo-qr.png</code>.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="shrink-0 border-current/20"
          :disabled="loadingZaloTrangThai"
          @click="loadZaloTrangThai"
        >
          {{ loadingZaloTrangThai ? 'Đang kiểm tra…' : 'Kiểm tra lại' }}
        </Button>
      </div>
    </div>

    <div class="bg-card text-card-foreground rounded-xl border p-4 shadow-sm sm:p-6">
      <form class="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10 lg:items-start" @submit.prevent="onSubmit">
        <div class="space-y-2 lg:max-w-none">
          <Label for="khach" class="text-base">Khách hàng</Label>
          <Select v-model="maKh" :disabled="loadingList">
            <SelectTrigger id="khach" class="border-input bg-background h-auto min-h-10 w-full py-2 [&>span]:w-full [&>span]:min-w-0">
              <SelectValue
                :placeholder="loadingList ? 'Đang tải…' : 'Chọn khách hàng — hiển thị đủ mã, tên, SDT, email'"
              >
                <template #default>
                  <span
                    v-if="!maKh"
                    class="text-muted-foreground"
                  >
                    {{ loadingList ? 'Đang tải…' : 'Chọn khách hàng — hiển thị đủ mã, tên, SDT, email' }}
                  </span>
                  <div
                    v-else-if="selectedKhach"
                    class="flex w-full min-w-0 flex-col items-start gap-0.5 text-left"
                  >
                    <span class="text-foreground leading-snug font-medium">
                      {{ selectedKhach.hoTen?.trim() || '—' }}
                      <span class="text-muted-foreground font-normal"> · Mã: {{ selectedKhach.maKh }}</span>
                    </span>
                    <span class="text-muted-foreground w-full break-all text-xs leading-snug">
                      SDT: {{ selectedKhach.sdt?.trim() || 'Chưa có' }}
                      <span class="text-border mx-1">|</span>
                      Email: {{ selectedKhach.email?.trim() || 'Chưa có' }}
                    </span>
                  </div>
                  <span v-else class="truncate">{{ maKh }}</span>
                </template>
              </SelectValue>
            </SelectTrigger>
            <SelectContent class="max-h-[min(24rem,70vh)]">
              <SelectItem
                v-for="k in khachHangList"
                :key="k.maKh"
                :value="k.maKh"
                :text-value="khachTextValue(k)"
                class="h-auto min-h-0 cursor-pointer items-start py-2 [&>span:last-child]:w-full [&>span:last-child]:items-start"
              >
                <div class="flex w-full min-w-0 flex-col gap-1 text-left">
                  <div class="leading-snug font-medium">
                    {{ k.hoTen?.trim() || '—' }}
                    <span class="text-muted-foreground font-normal"> · {{ k.maKh }}</span>
                  </div>
                  <div class="text-muted-foreground space-y-0.5 text-xs break-all">
                    <div><span class="text-foreground/80">SDT:</span> {{ k.sdt?.trim() || 'Chưa có' }}</div>
                    <div><span class="text-foreground/80">Email:</span> {{ k.email?.trim() || 'Chưa có' }}</div>
                  </div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <div
            v-if="selectedKhach"
            class="bg-muted/40 text-foreground mt-3 rounded-lg border px-4 py-3 text-sm"
            role="status"
            aria-label="Thông tin khách hàng đã chọn"
          >
            <p class="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
              Thông tin khách đã chọn
            </p>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <dt class="text-muted-foreground text-xs">Mã KH</dt>
                <dd class="font-mono text-sm">{{ selectedKhach.maKh }}</dd>
              </div>
              <div>
                <dt class="text-muted-foreground text-xs">Họ tên</dt>
                <dd class="text-sm">{{ selectedKhach.hoTen?.trim() || '—' }}</dd>
              </div>
              <div class="col-span-2">
                <dt class="text-muted-foreground text-xs">Số điện thoại (Zalo)</dt>
                <dd class="break-all text-sm">{{ selectedKhach.sdt?.trim() || 'Chưa có' }}</dd>
              </div>
              <div class="col-span-2">
                <dt class="text-muted-foreground text-xs">Email (Gmail)</dt>
                <dd class="break-all text-sm">{{ selectedKhach.email?.trim() || 'Chưa có' }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="flex min-h-0 flex-col gap-5 lg:border-l lg:border-border lg:pl-10">
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Label for="tieu-de" class="text-foreground shrink-0 sm:w-28 sm:pt-0.5">Tiêu đề</Label>
            <Input
              id="tieu-de"
              v-model="tieuDe"
              class="min-w-0 flex-1"
              type="text"
              placeholder="Tiêu đề thông báo"
              autocomplete="off"
            />
          </div>

          <div class="flex min-h-0 flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
            <Label for="noi-dung" class="text-foreground shrink-0 sm:mt-2 sm:w-28">Nội dung</Label>
            <textarea
              id="noi-dung"
              v-model="noiDung"
              rows="8"
              placeholder="Nội dung gửi cho khách…"
              class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-[200px] w-full min-w-0 flex-1 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[280px]"
            />
          </div>

          <div class="border-border space-y-2 border-t pt-5">
            <div class="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-6">
              <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
                <span class="text-foreground text-sm font-medium">Kênh gửi</span>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input v-model="sendViaGmail" type="checkbox" class="border-input size-4 rounded border" />
                  <span>Gửi qua Gmail</span>
                </label>
                <label class="flex cursor-pointer items-center gap-2 text-sm">
                  <input v-model="sendViaZalo" type="checkbox" class="border-input size-4 rounded border" />
                  <span>Gửi qua Zalo</span>
                </label>
              </div>
              <Button type="submit" class="w-full shrink-0 sm:w-auto" :disabled="!canSubmit">
                {{ sending ? 'Đang gửi…' : 'Gửi thông báo' }}
              </Button>
            </div>
            <p v-if="!sendViaGmail && !sendViaZalo" class="text-destructive text-xs">
              Cần chọn ít nhất một kênh.
            </p>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>