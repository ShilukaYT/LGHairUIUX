<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch } from 'vue'
import { MessageSquare, X, Send, HeadphonesIcon, Loader2, Calendar } from 'lucide-vue-next'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useRouter } from 'vue-router'
import axios from 'axios'

// ── Config ──────────────────────────────────────────────
const API_BASE = 'https://localhost:7196/api/chat' // API cho live chat nhân viên
const API_AI_BOT = 'https://localhost:7196/api/Chatbot' // API cho AI bot
const router = useRouter()

// ── State ───────────────────────────────────────────────
const isOpen        = ref(false)
const isConnecting  = ref(false)  // đang tạo phòng chat live
const isConnected   = ref(false)  // false = Chat với AI | true = Chat với Nhân viên
const connectError  = ref('')     
const sending       = ref(false)
const inputMessage  = ref('')
const roomId        = ref<string | null>(null)
const messages      = ref<any[]>([]) // Tin nhắn Firebase
const messagesContainer = ref<HTMLElement | null>(null)

const botMessages = ref<any[]>([
  {
    id: 'welcome',
    senderRole: 'Bot',
    content: 'Chào bạn, LGHair có thể giúp gì cho bạn hôm nay?',
    timestamp: new Date()
  }
])

const getCustomerInfo = () => {
  try {
    const raw = localStorage.getItem('userInfo') || sessionStorage.getItem('accessToken') || ''
    const user = raw ? JSON.parse(raw) : null
    return {
      name: user?.hoTen || user?.name || 'Khách',
      email: user?.email || ''
    }
  } catch {
    return { name: 'Khách', email: '' }
  }
}

// ── Xử lý Markdown & Hình ảnh cho AI ────────────────────
const formatMessage = (text: string): string => {
  if (!text) return '';
  let formattedText = text;

  // Xử lý hình ảnh Markdown ![alt](url)
  formattedText = formattedText.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g, 
    (match, alt, url) => {
      let cleanUrl = url.trim();
      if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:image')) {
        const backendBaseUrl = 'https://localhost:7196';
        cleanUrl = cleanUrl.startsWith('/') ? `${backendBaseUrl}${cleanUrl}` : `${backendBaseUrl}/${cleanUrl}`;
      }
      return `<img src="${cleanUrl}" alt="${alt.trim()}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; margin-bottom: 5px; display: block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" onerror="this.onerror=null; this.src='https://placehold.co/300x200/eeeeee/999999?text=Lỗi+Hiển+Thị+Ảnh';" />`;
    }
  );

  // In đậm
  formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Xuống dòng
  formattedText = formattedText.replace(/\n/g, '<br />');

  return formattedText;
};

// ── Firestore real-time listener ────────────────────────
let unsubscribe: (() => void) | null = null

const listenToMessages = (rid: string) => {
  if (unsubscribe) unsubscribe()

  const q = query(
    collection(db, 'ChatRooms', rid, 'Messages'),
    orderBy('timestamp', 'asc')
  )

  unsubscribe = onSnapshot(q, (snap) => {
    messages.value = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    scrollToBottom()
  })
}

// ── Actions ─────────────────────────────────────────────

const goToBooking = () => {
  isOpen.value = false
  router.push({ name: 'booking' })
}

// Gửi câu hỏi gợi ý cho AI xử lý luôn
const consultProduct = async () => {
  if (isConnecting.value || sending.value) return
  inputMessage.value = 'Tôi cần tư vấn chọn sản phẩm'
  await sendMsg()
}

// Khách bấm "Bắt đầu chat" — tạo phòng kết nối nhân viên
const startChat = async () => {
  if (isConnecting.value) return
  isConnecting.value = true
  connectError.value = ''

  const { name, email } = getCustomerInfo()

  try {
    const res = await axios.post(`${API_BASE}/room`, {
      customerName: name,
      customerEmail: email
    })
    roomId.value = res.data.roomId
    isConnected.value = true
    listenToMessages(roomId.value!)
  } catch (err: any) {
    console.error('[LiveChat] Lỗi tạo phòng:', err)
    if (err.response?.data?.error) {
      connectError.value = `Lỗi: ${err.response.data.error}`
    } else if (err.response?.data?.message) {
      connectError.value = `Lỗi: ${err.response.data.message}`
    } else if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error')) {
      connectError.value = 'Không thể kết nối server. Vui lòng thử lại sau.'
    } else {
      connectError.value = 'Đã có lỗi xảy ra. Vui lòng thử lại.'
    }
  } finally {
    isConnecting.value = false
  }
}

// Xử lý gửi tin nhắn (Tách biệt logic AI và Live Agent)
const sendMsg = async () => {
  const content = inputMessage.value.trim()
  if (!content || sending.value) return

  sending.value = true
  inputMessage.value = ''

  // NẾU CHƯA KẾT NỐI NHÂN VIÊN -> GỌI API AI CHATBOT
  if (!isConnected.value) {
    botMessages.value.push({
      id: Date.now().toString(),
      senderRole: 'Customer',
      content: content,
      timestamp: new Date()
    })
    scrollToBottom()

    try {
      const response = await fetch(API_AI_BOT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: content }) 
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      botMessages.value.push({
        id: Date.now().toString(),
        senderRole: 'Bot',
        content: data.reply,
        timestamp: new Date()
      });
    } catch (error) {
      console.error("Lỗi khi gọi API Chatbot:", error);
      botMessages.value.push({
        id: Date.now().toString(),
        senderRole: 'Bot',
        content: "Xin lỗi, AI đang bảo trì. Quý khách vui lòng chọn 'Gặp nhân viên hỗ trợ' nhé!",
        timestamp: new Date()
      });
    } finally {
      sending.value = false
      scrollToBottom()
    }
    return
  }

  // NẾU ĐÃ KẾT NỐI NHÂN VIÊN -> GỌI API FIREBASE
  try {
    const { name } = getCustomerInfo()
    await axios.post(`${API_BASE}/send`, {
      roomId: roomId.value,
      senderRole: 'Customer',
      senderName: name,
      content
    })
  } catch (err: any) {
    console.error('[LiveChat] Lỗi gửi tin:', err)
    inputMessage.value = content // restore nếu lỗi
  } finally {
    sending.value = false
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMsg()
  }
}

// ── Helpers ─────────────────────────────────────────────
const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

const formatTime = (ts: any) => {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// ── Lifecycle ───────────────────────────────────────────
watch(messages, scrollToBottom)

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
})
</script>

<template>
  <div class="fixed bottom-5 right-5 z-[100] flex flex-col items-end sm:bottom-6 sm:right-6 lg:bottom-10 lg:right-12">

    <transition
      enter-active-class="transition duration-300 ease-out"
      enter-from-class="translate-y-4 scale-95 opacity-0"
      enter-to-class="translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-y-4 scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="mb-5 flex h-[520px] max-h-[75vh] w-[calc(100vw-40px)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl"
      >
        <div class="flex items-center justify-between bg-black px-5 py-4 text-white flex-shrink-0">
          <div class="flex items-center gap-3">
            <div class="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/20">
              <HeadphonesIcon :size="16" :stroke-width="1.6" />
            </div>
            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.18em]">Hỗ Trợ Trực Tiếp</p>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span :class="['w-1.5 h-1.5 rounded-full', isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500']"></span>
                <p class="text-[10px] text-white/60">
                  {{ isConnected ? 'Đang kết nối với nhân viên' : 'Nhân viên sẵn sàng hỗ trợ' }}
                </p>
              </div>
            </div>
          </div>
          <button
            @click="isOpen = false"
            class="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <X :size="18" :stroke-width="1.6" />
          </button>
        </div>

        <div ref="messagesContainer" class="flex-1 overflow-y-auto bg-neutral-50 p-4 space-y-3 custom-scroll">
          
          <template v-if="!isConnected">
            <div
              v-for="msg in botMessages"
              :key="msg.id"
              :class="['flex items-end gap-2', msg.senderRole === 'Customer' ? 'justify-end' : 'justify-start']"
            >
              <div
                v-if="msg.senderRole !== 'Customer'"
                class="w-6 h-6 rounded-full bg-black flex items-center justify-center flex-shrink-0 mb-1"
              >
                <HeadphonesIcon :size="12" class="text-white" />
              </div>
              <div class="max-w-[78%]">
                <div :class="[
                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                  msg.senderRole === 'Customer'
                    ? 'bg-black text-white rounded-tr-sm'
                    : 'bg-white border border-black/10 text-neutral-800 rounded-tl-sm'
                ]"
                v-html="formatMessage(msg.content)">
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-2 mt-3 pl-1">
              <button
                @click="consultProduct"
                :disabled="isConnecting || sending"
                class="px-4 py-2 border border-neutral-200 bg-white hover:border-black rounded-full text-neutral-800 text-[10px] font-bold tracking-wider transition active:scale-95 shadow-sm uppercase disabled:opacity-60"
              >
                Tư vấn sản phẩm
              </button>

              <button
                @click="goToBooking"
                :disabled="isConnecting || sending"
                class="px-4 py-2 border border-neutral-200 bg-white hover:border-black rounded-full text-neutral-800 text-[10px] font-bold tracking-wider transition active:scale-95 shadow-sm uppercase disabled:opacity-60"
              >
                Đặt lịch cắt tóc
              </button>

              <button
                @click="startChat"
                :disabled="isConnecting || sending"
                class="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 bg-white hover:border-black rounded-full text-neutral-800 text-[10px] font-bold tracking-wider transition active:scale-95 shadow-sm uppercase disabled:opacity-60"
              >
                <span>Gặp nhân viên hỗ trợ</span>
                <Loader2 v-if="isConnecting" :size="11" class="animate-spin text-neutral-500" />
              </button>
            </div>

            <div v-if="isConnecting" class="text-center py-2">
              <span class="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full animate-pulse">
                Đang kết nối với nhân viên...
              </span>
            </div>
            
            <p v-if="connectError" class="text-red-500 text-xs text-center mt-2 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
              ⚠️ {{ connectError }}
            </p>
          </template>

          <template v-else>
            <div class="flex justify-center">
              <span class="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
                Bạn đã được kết nối với nhân viên hỗ trợ
              </span>
            </div>

            <div
              v-for="msg in messages"
              :key="msg.id"
              :class="['flex items-end gap-2', msg.senderRole === 'Customer' ? 'justify-end' : 'justify-start']"
            >
              <div
                v-if="msg.senderRole !== 'Customer'"
                class="w-6 h-6 rounded-full bg-black flex items-center justify-center flex-shrink-0 mb-1"
              >
                <HeadphonesIcon :size="12" class="text-white" />
              </div>

              <div class="max-w-[78%]">
                <p :class="['text-[10px] mb-1 px-1', msg.senderRole === 'Customer' ? 'text-right text-neutral-400' : 'text-neutral-500']">
                  {{ msg.senderRole === 'Customer' ? 'Bạn' : (msg.senderName || 'Nhân viên') }}
                </p>
                <div :class="[
                  'px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm',
                  msg.senderRole === 'Customer'
                    ? 'bg-black text-white rounded-tr-sm'
                    : 'bg-white border border-black/10 text-neutral-800 rounded-tl-sm'
                ]"
                v-html="formatMessage(msg.content)">
                </div>
                <p :class="['text-[10px] mt-0.5 px-1 text-neutral-400', msg.senderRole === 'Customer' ? 'text-right' : '']">
                  {{ formatTime(msg.timestamp) }}
                </p>
              </div>
            </div>

            <div v-if="messages.length > 0 && messages[messages.length-1]?.senderRole === 'Customer'" class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <HeadphonesIcon :size="12" class="text-white" />
              </div>
              <div class="bg-white border border-black/10 rounded-2xl rounded-tl-sm px-4 py-2.5 flex gap-1 items-center">
                <span class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay:0ms"></span>
                <span class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay:150ms"></span>
                <span class="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style="animation-delay:300ms"></span>
              </div>
            </div>
          </template>

        </div>

        <div class="flex items-center gap-2 border-t border-black/10 bg-white px-4 py-2.5 flex-shrink-0">
          <input
            v-model="inputMessage"
            @keydown="handleKeydown"
            type="text"
            placeholder="Nhập tin nhắn..."
            :disabled="sending"
            class="h-10 flex-1 rounded-full border border-black/10 bg-neutral-50 px-4 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-black focus:bg-white disabled:opacity-50"
          />
          <button
            @click="sendMsg"
            :disabled="!inputMessage.trim() || sending"
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-white transition duration-300 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
          >
            <Loader2 v-if="sending" :size="15" class="animate-spin" />
            <Send v-else :size="15" :stroke-width="1.8" />
          </button>
        </div>

      </div>
    </transition>

    <button
      @click="isOpen = !isOpen"
      class="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:bg-neutral-800 hover:shadow-[0_16px_45px_rgba(0,0,0,0.28)] active:scale-95 md:h-16 md:w-16"
      aria-label="Chat với nhân viên hỗ trợ"
    >
      <span
        v-if="isConnected && !isOpen"
        class="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-white animate-pulse"
      ></span>
      <X v-if="isOpen" :size="24" :stroke-width="1.6" />
      <HeadphonesIcon v-else :size="24" :stroke-width="1.6" />
    </button>
  </div>
</template>