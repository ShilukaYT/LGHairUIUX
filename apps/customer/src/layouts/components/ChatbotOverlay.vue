<script setup lang="ts">
import { ref, nextTick, onUnmounted, watch, onMounted } from 'vue'
import { MessageSquare, X, Send, HeadphonesIcon, Loader2, Calendar } from 'lucide-vue-next'
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import { useRouter, useRoute } from 'vue-router'
import axios from 'axios'
import { useAuthStore } from '@/stores/useAuthStore'

// ── Config ──────────────────────────────────────────────
const API_BASE = 'https://localhost:7196/api/chat' // API cho live chat nhân viên
const API_AI_BOT = 'https://localhost:7196/api/Chatbot' // API cho AI bot
const GEMINI_API_KEY: string = 'AIzaSyDBxuIvcyEWKXnmj0UXtgHNqGK5q3LuJv0' // Cấu hình API Key Gemini của bạn tại đây để tự động phản hồi
const router = useRouter()
const route = useRoute()

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
const showNamePrompt = ref(false)
const tempCustomerName = ref('')
const validationError = ref('')



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
    const raw = localStorage.getItem('user') || sessionStorage.getItem('accessToken') || ''
    const user = raw ? JSON.parse(raw) : null
    if (user?.hoTen || user?.name) {
      return {
        name: user.hoTen || user.name,
        email: user.email || ''
      }
    }
  } catch (err) {
    console.error(err)
  }

  // Khách vãng lai: Sử dụng tên tùy chỉnh đã nhập nếu có
  const customName = localStorage.getItem('lghair_chat_custom_name')
  if (customName) {
    return { name: customName, email: '' }
  }

  // Mặc định là 'Khách' (sẽ bị yêu cầu nhập tên khi bấm Bắt đầu chat với nhân viên)
  return { name: 'Khách', email: '' }
}

const getStorageKey = () => {
  try {
    const raw = localStorage.getItem('user') || sessionStorage.getItem('accessToken') || ''
    const user = raw ? JSON.parse(raw) : null
    if (user?.email) {
      return `lghair_chat_room_id_${user.email}`
    }
  } catch (err) {
    console.error(err)
  }
  const customName = localStorage.getItem('lghair_chat_custom_name')
  if (customName) {
    return `lghair_chat_room_id_anon_${customName}`
  }
  return 'lghair_chat_room_id_guest'
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

  // 1. Kiểm tra xem đã có roomId lưu ở localStorage chưa
  const key = getStorageKey()
  const savedRoomId = localStorage.getItem(key)
  if (savedRoomId) {
    try {
      const roomSnap = await getDoc(doc(db, 'ChatRooms', savedRoomId))
      if (roomSnap.exists()) {
        const roomData = roomSnap.data()
        roomId.value = savedRoomId
        isConnected.value = true
        listenToMessages(savedRoomId)

        // Đồng bộ lại tên mới nếu khách đã đăng nhập (trước đó là tên ẩn danh hoặc ngược lại)
        if (roomData.customerName !== name) {
          await updateDoc(doc(db, 'ChatRooms', savedRoomId), {
            customerName: name,
            customerEmail: email
          })
        }
        isConnecting.value = false
        return
      }
    } catch (err) {
      console.warn('[LiveChat] Lỗi khôi phục phòng chat cũ:', err)
    }
  }

  // 2. Tạo phòng chat mới nếu chưa có hoặc phòng cũ đã bị xóa
  try {
    const res = await axios.post(`${API_BASE}/room`, {
      customerName: name,
      customerEmail: email
    })
    roomId.value = res.data.roomId
    localStorage.setItem(key, res.data.roomId)
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

const handleStartChatClick = async () => {
  await startChat()
}

// Lắng nghe signal từ store để tự động mở và kết nối trực tiếp với nhân viên
const authStore = useAuthStore()
watch(() => authStore.openChatWithStaffSignal, async (newVal) => {
  if (newVal) {
    isOpen.value = true
    authStore.openChatWithStaffSignal = false
    await nextTick()
    if (!isConnected.value) {
      await startChat()
    }
  }
})

const submitNameAndStartChat = async () => {
  const enteredName = tempCustomerName.value.trim()
  if (!enteredName) return

  localStorage.setItem('lghair_chat_custom_name', enteredName)
  showNamePrompt.value = false
  await startChat()
}

const switchToAI = async () => {
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  
  if (roomId.value) {
    try {
      await updateDoc(doc(db, 'ChatRooms', roomId.value), {
        isCustomerTyping: false
      })
    } catch (e) {}
  }

  isConnected.value = false
  roomId.value = null
}

const containsProfanity = (text: string): boolean => {
  // 1. Kiểm tra các cụm từ viết liền/bậy bạ rõ ràng (substring match)
  const badSubstrings = [
    'đm', 'dkm', 'đkm', 'đéo', 'cặc', 'lồn', 'địt', 'chịch', 'óc chó', 'chó đẻ', 
    'mẹ mày', 'bố mày', 'con đĩ', 'thằng chó', 'đĩ chó', 'đồ ngu', 'khốn nạn', 
    'mất dạy', 'vãi lồn', 'vãi cặc', 'vcl', 'vkl', 'clm', 'súc vật', 
    'đầu khấc', 'bú cu', 'đút đít', 'cak', 'cax', 'đjt', 'djt', 'mgu'
  ]
  const cleanText = text.toLowerCase().replace(/\s+/g, '')
  for (const word of badSubstrings) {
    const cleanWord = word.replace(/\s+/g, '')
    if (cleanText.includes(cleanWord)) {
      return true
    }
  }

  // 2. Kiểm tra khớp nguyên từ đơn để tránh nhận nhầm (ví dụ 'ngu' trong 'nguồn')
  const badWords = [
    'ngu', 'nguu', 'nguuu', 'nguuuu', 'chó', 'choa', 'đĩ', 'cac', 'cl', 'cút'
  ]
  const words = text.toLowerCase().split(/[\s,.\-!?_]+/)
  for (const w of words) {
    if (badWords.includes(w)) {
      return true
    }
  }

  return false
}

// Xử lý gửi tin nhắn (Tách biệt logic AI và Live Agent)
const sendMsg = async () => {
  const content = inputMessage.value.trim()
  if (!content || sending.value) return

  // Chặn ngôn từ khiếm nhã tục tĩu
  if (containsProfanity(content)) {
    validationError.value = 'Tin nhắn chứa ngôn từ không phù hợp. Vui lòng nhắn tin lịch sự!'
    setTimeout(() => {
      validationError.value = ''
    }, 4000)
    return
  }

  if (typingTimeout) {
    clearTimeout(typingTimeout)
    typingTimeout = null
  }
  if (roomId.value && isConnected.value) {
    updateTypingStatus(false)
  }

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

    // Kích hoạt bộ hẹn giờ 5 giây cho Gemini trả lời tự động ngay lập tức
    if (geminiTimeout) clearTimeout(geminiTimeout)
    geminiTimeout = window.setTimeout(async () => {
      const currentLastMsg = messages.value[messages.value.length - 1]
      if (currentLastMsg && currentLastMsg.senderRole === 'Customer') {
        await respondWithGemini(currentLastMsg.content)
      }
    }, 5000)
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

// ── Lifecycle & Gemini Auto Reply ────────────────────────
let geminiTimeout: any = null

const respondWithGemini = async (userContent: string) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.warn('[Gemini] Chưa cấu hình API Key trong ChatbotOverlay.vue')
    return
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${GEMINI_API_KEY}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Bạn là trợ lý AI hỗ trợ khách hàng của salon tóc LG Hair. Hiện tại nhân viên tư vấn đang bận và chưa thể trả lời khách hàng ngay lập tức. Hãy thay mặt nhân viên phản hồi khách hàng một cách cực kỳ ngắn gọn, lịch sự, thân thiện bằng tiếng Việt dựa trên tin nhắn sau: "${userContent}". Lưu ý: Không tự ý hẹn lịch hay chốt đơn dịch vụ mà hãy nhắc họ chờ nhân viên một chút.` }]
        }]
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google API error: ${response.status} - ${errText}`)
    }

    const data = await response.json()
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
    
    if (reply && roomId.value) {
      // Gửi câu trả lời của Gemini vào phòng chat 1vs1 của nhân viên qua axios
      await axios.post(`${API_BASE}/send`, {
        roomId: roomId.value,
        senderRole: 'Staff',
        senderName: 'Trợ lý AI (Tự động)',
        content: reply
      })
    }
  } catch (error: any) {
    console.error('[Gemini] Lỗi gọi API Gemini:', error)
    if (roomId.value) {
      await axios.post(`${API_BASE}/send`, {
        roomId: roomId.value,
        senderRole: 'Staff',
        senderName: 'Hệ thống (Lỗi AI)',
        content: `⚠️ Lỗi gọi Gemini API: ${error.message}`
      })
    }
  }
}

watch(messages, (newMessages) => {
  scrollToBottom()

  if (!isConnected.value || !roomId.value) return

  // Hủy bộ đếm Gemini nếu phát hiện có tin nhắn mới từ Staff (admin đã trả lời)
  if (newMessages.length > 0) {
    const lastMsg = newMessages[newMessages.length - 1]
    if (lastMsg.senderRole === 'Staff') {
      if (geminiTimeout) {
        clearTimeout(geminiTimeout)
        geminiTimeout = null
      }
    }
  }
})

let typingTimeout: any = null

const updateTypingStatus = async (isTyping: boolean) => {
  if (!roomId.value) return
  try {
    await updateDoc(doc(db, 'ChatRooms', roomId.value), {
      isCustomerTyping: isTyping
    })
  } catch (err) {
    // ignore
  }
}

watch(inputMessage, (newVal) => {
  if (!roomId.value || !isConnected.value) return
  updateTypingStatus(newVal.trim().length > 0)

  if (typingTimeout) clearTimeout(typingTimeout)
  if (newVal.trim().length > 0) {
    typingTimeout = setTimeout(() => {
      updateTypingStatus(false)
    }, 3000)
  }
})

const initRoom = async () => {
  // Hủy listener cũ trước
  if (unsubscribe) {
    unsubscribe()
    unsubscribe = null
  }
  roomId.value = null
  isConnected.value = false

  const key = getStorageKey()
  const savedRoomId = localStorage.getItem(key)
  if (savedRoomId) {
    try {
      const roomSnap = await getDoc(doc(db, 'ChatRooms', savedRoomId))
      if (roomSnap.exists()) {
        const roomData = roomSnap.data()
        roomId.value = savedRoomId
        isConnected.value = true
        listenToMessages(savedRoomId)

        // Đồng bộ lại tên mới nếu khách đã đăng nhập (trước đó là tên ẩn danh hoặc ngược lại)
        const { name, email } = getCustomerInfo()
        if (roomData.customerName !== name) {
          await updateDoc(doc(db, 'ChatRooms', savedRoomId), {
            customerName: name,
            customerEmail: email
          })
        }
      } else {
        localStorage.removeItem(key)
      }
    } catch (err) {
      console.warn('[LiveChat] Lỗi khôi phục phòng chat cũ:', err)
    }
  }
}

watch(() => route.path, () => {
  initRoom()
})

onMounted(async () => {
  await initRoom()
})

onUnmounted(() => {
  if (unsubscribe) unsubscribe()
  if (geminiTimeout) clearTimeout(geminiTimeout)
  if (typingTimeout) clearTimeout(typingTimeout)
  if (roomId.value && isConnected.value) {
    updateTypingStatus(false)
  }
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

            <div v-if="!showNamePrompt" class="flex flex-wrap gap-2 mt-3 pl-1">
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
                @click="handleStartChatClick"
                :disabled="isConnecting || sending"
                class="inline-flex items-center gap-1.5 px-4 py-2 border border-neutral-200 bg-white hover:border-black rounded-full text-neutral-800 text-[10px] font-bold tracking-wider transition active:scale-95 shadow-sm uppercase disabled:opacity-60"
              >
                <span>Gặp nhân viên hỗ trợ</span>
                <Loader2 v-if="isConnecting" :size="11" class="animate-spin text-neutral-500" />
              </button>
            </div>

            <div v-else class="mt-4 p-4 border border-black/10 bg-white rounded-2xl shadow-sm space-y-3 mx-1">
              <p class="text-xs font-semibold text-neutral-700">Vui lòng nhập tên của bạn để bắt đầu trò chuyện với nhân viên hỗ trợ:</p>
              <div class="flex gap-2">
                <input
                  v-model="tempCustomerName"
                  type="text"
                  placeholder="Nhập họ và tên..."
                  class="h-9 flex-1 rounded-xl border border-black/10 bg-neutral-50 px-3 text-xs outline-none focus:border-black transition"
                  @keydown.enter="submitNameAndStartChat"
                />
                <button
                  @click="submitNameAndStartChat"
                  :disabled="!tempCustomerName.trim() || isConnecting"
                  class="px-4 py-2 bg-black text-white rounded-xl text-xs font-bold transition active:scale-95 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400"
                >
                  Bắt đầu
                </button>
              </div>
              <div class="text-right">
                <button
                  @click="showNamePrompt = false"
                  class="text-[10px] text-neutral-400 hover:text-black transition"
                >
                  Hủy bỏ
                </button>
              </div>
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
            <div class="flex flex-col items-center gap-1.5 mb-3">
              <span class="text-[10px] text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
                Bạn đã được kết nối với nhân viên hỗ trợ
              </span>
              <button
                @click="switchToAI"
                class="px-2.5 py-1 border border-neutral-200 bg-white hover:border-black rounded-full text-neutral-600 hover:text-black text-[9px] font-bold tracking-wider transition active:scale-95 shadow-sm uppercase cursor-pointer"
              >
                Trở lại Chatbot AI
              </button>
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

        <div class="flex flex-col border-t border-black/10 bg-white flex-shrink-0 z-10">
          <p v-if="validationError" class="text-red-500 text-[10px] text-center bg-red-50 py-1.5 px-3 border-b border-red-100 font-semibold select-none">
            ⚠️ {{ validationError }}
          </p>
          <div class="flex items-center gap-2 px-4 py-2.5">
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