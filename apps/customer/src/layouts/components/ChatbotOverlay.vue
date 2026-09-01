<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { MessageSquare, X, Send } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { collection, query, orderBy, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/firebase'
import DOMPurify from 'dompurify'
import { useAuthStore } from '@/stores/useAuthStore'
import { useChatStore } from '@/stores/useChatStore'
import { useBookingBasketStore } from '@/stores/useBookingBasketStore'
import { useChatConversation } from '@/composables/useChatConversation'
import { getChatbotReply, createRoom, sendMessageToRoom, toggleRoomStatus } from '@/services/chatService'
import { ConversationState, SenderRole, RoomStatus, type FirestoreTimestamp } from '@/types/chatTypes'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const router = useRouter()
const authStore = useAuthStore()
const chatStore = useChatStore()
const basketStore = useBookingBasketStore()

const {
  conversationState,
  messages,
  roomId,
  customerInfo,
  isChatOpen,
  isSending,
  isAiThinking,
  errorState,
  isInAiMode,
  isShowingNamePrompt,
  isHandoffConnecting,
  isHandoffRequested,
  isStaffConnected,
  hasHandedOff,
  headerStatusText,
  headerStatusColor,
  addLocalMessage,
  addSystemMessage,
  _conversationState
} = useChatConversation()

const inputMessage = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const messagesContainer = ref<HTMLElement | null>(null)
const tempCustomerName = ref('')
const validationError = ref('')

let unsubscribeFirebase: (() => void) | null = null
let unsubscribeRoom: (() => void) | null = null
let handoffPromise: Promise<void> | null = null

// Sync visibility with chatStore
watch(isChatOpen, (val) => { chatStore.isChatOpen = val })
watch(conversationState, (val) => { chatStore.conversationState = val })

// ── Helpers ──────────────────────────────────────────

const getLoggedInUser = () => {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const user = JSON.parse(raw)
    if (user?.hoTen || user?.name) return user
  } catch (err) { }
  return null
}

const updateCustomerInfo = () => {
  const user = getLoggedInUser()
  if (user) {
    customerInfo.value = { name: user.hoTen || user.name, email: user.email || '' }
  } else {
    const customName = localStorage.getItem('lghair_chat_customer_name')
    customerInfo.value = { name: customName || 'Khách', email: '' }
  }
}

const formatTime = (ts: Date | FirestoreTimestamp | any): string => {
  if (!ts) return ''
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

const formatMessage = (text: string): string => {
  if (!text) return ''
  let html = text
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    let cleanUrl = url.trim()
    if (!cleanUrl.startsWith('http') && !cleanUrl.startsWith('data:image')) {
      cleanUrl = cleanUrl.startsWith('/') ? `${API}${cleanUrl}` : `${API}/${cleanUrl}`
    }
    return `<img src="${cleanUrl}" alt="${alt.trim()}" class="mt-[10px] mb-[5px] max-w-full rounded-[2px] block" />`
  })
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\n/g, '<br />')

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['strong', 'br', 'img'],
    ALLOWED_ATTR: ['src', 'alt', 'class'],
  })
}

const scrollToBottom = async () => {
  await nextTick()
  if (messagesContainer.value) {
    // Only auto-scroll if user is relatively near the bottom, 
    // or if we are just sending/receiving new message. For simplicity, force scroll.
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

watch(() => messages.value, () => {
  scrollToBottom()
}, { deep: true })

// ── Firebase Realtime ────────────────────────────────

const listenToMessages = (rid: string) => {
  if (unsubscribeFirebase) unsubscribeFirebase()
  if (unsubscribeRoom) unsubscribeRoom()

  const q = query(collection(db, 'ChatRooms', rid, 'Messages'), orderBy('timestamp', 'asc'))

  unsubscribeFirebase = onSnapshot(q, (snap) => {
    const firebaseMsgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))
    const localMsgs = messages.value.filter(m => m.isLocal)

    const combined = [...localMsgs, ...firebaseMsgs].sort((a, b) => {
      const tA = (typeof a.timestamp?.toMillis === 'function') ? a.timestamp.toMillis() : new Date(a.timestamp || 0).getTime()
      const tB = (typeof b.timestamp?.toMillis === 'function') ? b.timestamp.toMillis() : new Date(b.timestamp || 0).getTime()
      return tA - tB
    })

    // Switch to STAFF_CONNECTED if staff replies
    const staffMsgs = firebaseMsgs.filter((m: any) => m.senderRole === SenderRole.Staff)
    if (staffMsgs.length > 0 && conversationState.value === ConversationState.HANDOFF_REQUESTED) {
      _conversationState.value = ConversationState.STAFF_CONNECTED
      localStorage.setItem('lghair_chat_conversation_state', ConversationState.STAFF_CONNECTED)
      addSystemMessage('Nhân viên đã tham gia cuộc trò chuyện')
    }

    messages.value = combined
    scrollToBottom()
  })

  // Listen to room document for 'Closed' status
  unsubscribeRoom = onSnapshot(doc(db, 'ChatRooms', rid), (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data()
      if (data.status === RoomStatus.Closed && hasHandedOff.value) {
        closeRoomLocal(false)
      }
    }
  })
}

// ── Actions ──────────────────────────────────────────

const executeHandoffAPI = async () => {
  errorState.value = { type: null, message: '' }
  _conversationState.value = ConversationState.HANDOFF_CONNECTING

  try {
    if (!roomId.value) {
      const res = await createRoom({
        customerName: customerInfo.value.name,
        customerEmail: customerInfo.value.email
      })
      roomId.value = res.roomId
      localStorage.setItem('lghair_chat_room_id', res.roomId)
      listenToMessages(res.roomId)
    }

    _conversationState.value = ConversationState.HANDOFF_REQUESTED
    localStorage.setItem('lghair_chat_conversation_state', ConversationState.HANDOFF_REQUESTED)
    addSystemMessage('Đã chuyển yêu cầu đến nhân viên hỗ trợ')
  } catch (err: any) {
    errorState.value = {
      type: 'HANDOFF_CREATE_ERROR',
      message: 'Không thể kết nối. Vui lòng thử lại.',
      retryAction: executeHandoffAPI
    }
    _conversationState.value = ConversationState.AI
  } finally {
    scrollToBottom()
  }
}

const requestHandoff = async () => {
  if (handoffPromise) return handoffPromise

  const user = getLoggedInUser()
  const customName = localStorage.getItem('lghair_chat_customer_name')

  if (!user && !customName) {
    _conversationState.value = ConversationState.SHOW_NAME_PROMPT
    return
  }

  updateCustomerInfo()

  handoffPromise = executeHandoffAPI()
  try {
    await handoffPromise
  } finally {
    handoffPromise = null
  }
}

const cancelNamePrompt = () => {
  _conversationState.value = ConversationState.AI
}

const submitNameAndStartChat = async () => {
  const enteredName = tempCustomerName.value.trim()
  if (!enteredName) return
  localStorage.setItem('lghair_chat_customer_name', enteredName)
  updateCustomerInfo()
  await requestHandoff()
}

const closeRoomLocal = (byCustomer: boolean) => {
  if (unsubscribeFirebase) unsubscribeFirebase()
  if (unsubscribeRoom) unsubscribeRoom()

  roomId.value = null
  localStorage.removeItem('lghair_chat_room_id')
  localStorage.removeItem('lghair_chat_conversation_state')
  _conversationState.value = ConversationState.AI

  if (byCustomer) {
    addSystemMessage('Bạn đã kết thúc phiên hỗ trợ')
  } else {
    addSystemMessage('Nhân viên đã kết thúc phiên hỗ trợ')
  }
}

const endSupport = async () => {
  if (!roomId.value || !hasHandedOff.value) return
  try {
    await toggleRoomStatus(roomId.value, RoomStatus.Closed)
  } catch (err) {
    console.error('Lỗi khi kết thúc phòng chat', err)
  }
  closeRoomLocal(true)
}

const containsProfanity = (text: string): boolean => {
  const badSubstrings = ['đm', 'dkm', 'đkm', 'đéo', 'cặc', 'lồn', 'địt', 'chịch', 'óc chó', 'chó đẻ', 'mẹ mày', 'bố mày', 'con đĩ', 'thằng chó', 'đĩ chó', 'đồ ngu', 'khốn nạn', 'mất dạy', 'vãi lồn', 'vãi cặc', 'vcl', 'vkl', 'clm', 'súc vật', 'đầu khấc', 'bú cu', 'đút đít', 'cak', 'cax', 'đjt', 'djt', 'mgu']
  const cleanText = text.toLowerCase().replace(/\s+/g, '')
  for (const word of badSubstrings) {
    if (cleanText.includes(word.replace(/\s+/g, ''))) return true
  }
  const badWords = ['ngu', 'nguu', 'nguuu', 'nguuuu', 'chó', 'choa', 'đĩ', 'cac', 'cl', 'cút']
  const words = text.toLowerCase().split(/[\s,.\-!?_]+/)
  for (const w of words) {
    if (badWords.includes(w)) return true
  }
  return false
}

const isHandoffIntent = (text: string): boolean => {
  const clean = text.toLowerCase().trim()
  const patterns = [
    /chat.*nhân viên/,
    /gặp.*nhân viên/,
    /nhân viên.*hỗ trợ/,
    /cần.*nhân viên/,
    /gặp.*admin/,
    /hỗ trợ.*trực tiếp/,
    /nói chuyện.*người thật/,
    /tư vấn.*viên/
  ]
  return patterns.some(p => p.test(clean))
}

const sendMessage = async () => {
  const content = inputMessage.value.trim()
  if (!content || isSending.value) return

  if (containsProfanity(content)) {
    validationError.value = 'Tin nhắn chứa ngôn từ không phù hợp.'
    setTimeout(() => { validationError.value = '' }, 4000)
    return
  }

  errorState.value = { type: null, message: '' }
  isSending.value = true
  inputMessage.value = ''
  if (textareaRef.value) textareaRef.value.style.height = 'auto'

  const sendContextState = conversationState.value
  const sendContextRoomId = roomId.value

  try {
    if (sendContextState === ConversationState.AI) {
      addLocalMessage(SenderRole.Customer, content, 'Bạn')

      if (isHandoffIntent(content)) {
        await requestHandoff()
        return
      }

      isAiThinking.value = true

      try {
        const reply = await getChatbotReply(content)
        // If state changed to Handoff while waiting, do not append AI message to avoid confusion
        if (conversationState.value === ConversationState.AI) {
          addLocalMessage(SenderRole.Bot, reply, 'AI Assistant')
        }
      } catch (err: any) {
        errorState.value = {
          type: 'AI_ERROR',
          message: 'Hệ thống AI đang bảo trì.',
        }
      } finally {
        isAiThinking.value = false
      }

    } else if (hasHandedOff.value) {
      if (!sendContextRoomId) return

      await sendMessageToRoom({
        roomId: sendContextRoomId,
        senderRole: SenderRole.Customer,
        senderName: customerInfo.value.name,
        content
      })
      updateTypingStatus(false)
    }
  } catch (err: any) {
    inputMessage.value = content
    errorState.value = {
      type: 'SEND_MESSAGE_ERROR',
      message: 'Không thể gửi tin nhắn. Vui lòng thử lại.',
      retryAction: sendMessage
    }
  } finally {
    isSending.value = false
    scrollToBottom()
  }
}

// ── Typing Status ────────────────────────────────────

let typingTimeout: any = null
const updateTypingStatus = async (isTyping: boolean) => {
  if (!roomId.value || !hasHandedOff.value) return
  try {
    await updateDoc(doc(db, 'ChatRooms', roomId.value), { isCustomerTyping: isTyping })
  } catch (err) { }
}

watch(inputMessage, (newVal) => {
  if (!roomId.value || !hasHandedOff.value) return
  updateTypingStatus(newVal.trim().length > 0)
  if (typingTimeout) clearTimeout(typingTimeout)
  if (newVal.trim().length > 0) {
    typingTimeout = setTimeout(() => { updateTypingStatus(false) }, 3000)
  }
})

// ── External Navigation ──────────────────────────────

// const viewServices = () => router.push({ name: 'services' })
// const checkBooking = () => router.push({ name: 'datdichvu' })

// ── Initialization ───────────────────────────────────

const restoreConversation = async () => {
  updateCustomerInfo()
  const savedRoomId = localStorage.getItem('lghair_chat_room_id')
  const savedState = localStorage.getItem('lghair_chat_conversation_state') as ConversationState

  if (savedRoomId) {
    try {
      const roomSnap = await getDoc(doc(db, 'ChatRooms', savedRoomId))
      if (roomSnap.exists()) {
        roomId.value = savedRoomId
        _conversationState.value = savedState && savedState !== ConversationState.AI && savedState !== ConversationState.SHOW_NAME_PROMPT
          ? savedState : ConversationState.HANDOFF_REQUESTED
        listenToMessages(savedRoomId)

        if (roomSnap.data().customerName !== customerInfo.value.name) {
          await updateDoc(doc(db, 'ChatRooms', savedRoomId), {
            customerName: customerInfo.value.name,
            customerEmail: customerInfo.value.email
          })
        }
      } else {
        localStorage.removeItem('lghair_chat_room_id')
        localStorage.removeItem('lghair_chat_conversation_state')
        _conversationState.value = ConversationState.AI
      }
    } catch (err) { }
  } else {
    _conversationState.value = ConversationState.AI
    if (messages.value.length === 0) {
      addLocalMessage(SenderRole.Bot, 'Chào bạn, LGHair có thể giúp gì cho bạn hôm nay?', 'AI Assistant')
    }
  }
}

watch(() => authStore.openChatWithStaffSignal, async (newVal) => {
  if (newVal) {
    isChatOpen.value = true
    authStore.openChatWithStaffSignal = false
    await requestHandoff()
  }
})

onMounted(async () => {
  await restoreConversation()
})

onUnmounted(() => {
  if (unsubscribeFirebase) unsubscribeFirebase()
  if (unsubscribeRoom) unsubscribeRoom()
  if (typingTimeout) clearTimeout(typingTimeout)
  if (roomId.value && hasHandedOff.value) updateTypingStatus(false)
})

// UI Helpers
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

const adjustTextareaHeight = (e: Event) => {
  const el = e.target as HTMLTextAreaElement
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
</script>

<template>
  <div
    :class="['fixed right-5 z-[100] flex flex-col items-end transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]', basketStore.itemCount > 0 ? 'bottom-[96px] md:bottom-[80px]' : 'bottom-5']">

    <transition name="drawer">
      <div v-show="isChatOpen"
        class="fixed inset-0 md:absolute md:inset-auto md:bottom-20 md:right-0 z-[100] flex flex-col bg-white overflow-hidden w-full chat-panel-mobile md:w-[400px] md:h-[680px] md:max-h-[calc(100vh-100px)] md:rounded-[2px] md:border md:border-black/[0.08] md:shadow-[0_20px_60px_rgba(0,0,0,0.12)]">
        <!-- 1. Header Area (flex: none) -->
        <div
          class="flex items-center justify-between px-6 py-5 border-b border-black/[0.08] flex-shrink-0 bg-white z-10">
          <div class="flex flex-col gap-1.5">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-black">TRỢ GIÚP</p>
            <div class="flex items-center gap-1.5">
              <span :class="['w-1.5 h-1.5 rounded-full transition-colors duration-300', headerStatusColor]"></span>
              <p class="text-[9px] uppercase tracking-[0.14em] text-black/60 font-semibold transition-all duration-300">
                {{ headerStatusText }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-4">
            <button v-if="hasHandedOff" @click="endSupport"
              class="text-[9px] text-red-500 font-semibold uppercase tracking-wider hover:opacity-70 transition-opacity">
              Kết thúc
            </button>
            <button @click="isChatOpen = false"
              class="w-9 h-9 flex items-center justify-center hover:opacity-50 transition-opacity active:scale-95">
              <X :size="20" :stroke-width="1.2" class="text-black" />
            </button>
          </div>
        </div>

        <!-- 2. MessageViewport Area (flex: 1, min-height: 0, scrollable) -->
        <div class="flex-1 min-h-0 relative bg-white">
          <div ref="messagesContainer"
            class="absolute inset-0 overflow-y-auto overscroll-contain scrollbar-thin px-6 py-6 flex flex-col">
            <div class="flex-1"></div> <!-- Spacer to push messages down if few -->

            <transition-group name="message-list" tag="div" class="space-y-[20px] flex flex-col justify-end">
              <div v-for="msg in messages" :key="msg.id">

                <div v-if="msg.senderRole === 'System'" class="flex justify-center my-6">
                  <div class="flex items-center gap-3 opacity-60">
                    <div class="h-px w-6 bg-black/[0.15]"></div>
                    <p class="text-[9px] uppercase tracking-[0.16em] font-semibold text-black text-center">{{
                      msg.content }}</p>
                    <div class="h-px w-6 bg-black/[0.15]"></div>
                  </div>
                </div>

                <div v-else :class="['flex flex-col', msg.senderRole === 'Customer' ? 'items-end' : 'items-start']">
                  <p class="text-[9px] uppercase tracking-[0.14em] font-semibold text-black/40 mb-1.5 px-1">
                    {{ msg.senderRole === 'Customer' ? 'BẠN' : (msg.senderRole === 'Bot' ? 'AI ASSISTANT' :
                      ((msg.senderName || 'CUSTOMER CARE') + ' · HỖ TRỢ')) }}
                    <span class="ml-1.5 opacity-60 font-medium tracking-normal">{{ formatTime(msg.timestamp) }}</span>
                  </p>
                  <div :class="[
                    'px-4 py-3 text-[13px] leading-[1.6] max-w-[85%] md:max-w-[78%] rounded-[2px]',
                    msg.senderRole === 'Customer' ? 'bg-black text-white' : 'bg-neutral-50 text-[#111]'
                  ]" v-html="formatMessage(msg.content)">
                  </div>
                </div>

              </div>
            </transition-group>

            <!-- Loading States -->
            <transition name="fade">
              <div v-if="isAiThinking" class="flex flex-col items-start mt-[20px]">
                <p class="text-[9px] uppercase tracking-[0.14em] font-semibold text-black/40 mb-1.5 px-1">LGHair AI </p>
                <div class="px-4 py-3 rounded-[2px] bg-neutral-50 flex items-center justify-center min-h-[44px]">
                  <p class="text-black/40 text-[10px] uppercase font-semibold tracking-[0.1em] animate-pulse"
                    style="animation-duration: 1.5s;">
                    AI đang trả lời...
                  </p>
                </div>
              </div>

              <div v-else-if="isHandoffConnecting || isHandoffRequested" class="flex justify-center my-6">
                <div class="flex items-center gap-3 opacity-60">
                  <div class="h-px w-6 bg-black/[0.15]"></div>
                  <p class="text-[9px] uppercase tracking-[0.16em] font-semibold text-amber-600 animate-pulse">
                    {{ isHandoffConnecting ? 'ĐANG KẾT NỐI VỚI NHÂN VIÊN...' : 'ĐANG CHỜ NHÂN VIÊN PHẢN HỒI...' }}
                  </p>
                  <div class="h-px w-6 bg-black/[0.15]"></div>
                </div>
              </div>
            </transition>

            <!-- Handoff Quick Action in AI mode (Inline CTA) -->

          </div>

          <!-- Name Prompt Card - Contained WITHIN Viewport using absolute inset -->
          <transition name="fade">
            <div v-if="isShowingNamePrompt" class="absolute inset-4 z-20 flex flex-col justify-end">
              <div
                class="w-full p-5 bg-white border border-black/[0.08] shadow-[0_20px_60px_rgba(0,0,0,0.15)] rounded-[2px] space-y-4">
                <p class="text-[11px] font-semibold text-black uppercase tracking-[0.1em]">Cho chúng tôi biết tên của
                  bạn</p>
                <div class="flex gap-2">
                  <input v-model="tempCustomerName" type="text" placeholder="Nhập họ và tên..."
                    class="h-10 flex-1 rounded-[2px] border border-black/[0.12] bg-neutral-50 px-3 text-[13px] outline-none focus:border-black transition"
                    @keydown.enter="submitNameAndStartChat" />
                  <button @click="submitNameAndStartChat" :disabled="!tempCustomerName.trim()"
                    class="px-5 h-10 bg-black text-white rounded-[2px] text-[11px] font-semibold uppercase tracking-wider transition hover:opacity-80 disabled:opacity-40">
                    Tiếp tục
                  </button>
                </div>
                <div class="text-right mt-2">
                  <button @click="cancelNamePrompt"
                    class="text-[10px] text-black/40 hover:text-black uppercase tracking-wider font-semibold transition">
                    Hủy bỏ
                  </button>
                </div>
              </div>
            </div>
          </transition>
        </div>

        <!-- 3. ContextActions Area (flex: none) -->
        <div class="shrink-0 border-t border-black/[0.08] bg-white z-10 flex flex-col">
          <!-- Error State -->
          <transition name="fade">
            <div v-if="errorState.type"
              class="px-6 py-2 bg-red-50 flex flex-col items-center gap-2 border-b border-red-100">
              <p class="text-red-500 text-[10px] uppercase font-semibold tracking-wider text-center py-2">
                {{ errorState.message }}
              </p>
              <div class="flex gap-4">
                <button v-if="errorState.retryAction" @click="errorState.retryAction"
                  class="text-[10px] font-semibold uppercase underline underline-offset-2">
                  Thử lại
                </button>
                <button v-if="errorState.type === 'AI_ERROR'" @click="requestHandoff"
                  class="text-[10px] font-semibold uppercase underline underline-offset-2 text-black">
                  Chat với nhân viên hỗ trợ
                </button>
              </div>
            </div>
          </transition>

          <!-- Quick Suggestions (Hình 2 style) -->
          <div v-if="isInAiMode" class="px-6 py-3 flex flex-wrap gap-4">
            <!-- <button @click="viewServices" class="text-[10px] uppercase tracking-[0.08em] font-semibold text-black/50 hover:text-black transition-colors hover:underline underline-offset-4">
              XEM DỊCH VỤ
            </button>
            <button @click="checkBooking" class="text-[10px] uppercase tracking-[0.08em] font-semibold text-black/50 hover:text-black transition-colors hover:underline underline-offset-4">
              KIỂM TRA LỊCH HẸN
            </button> -->
            <button @click="requestHandoff"
              class="text-[10px] uppercase tracking-[0.08em] font-semibold text-black/50 hover:text-black transition-colors hover:underline underline-offset-4">
              CHAT VỚI NHÂN VIÊN HỖ TRỢ
            </button>
          </div>
        </div>

        <!-- 4. Composer Area (flex: none) -->
        <div class="shrink-0 bg-white border-t border-black/[0.08] p-4 px-5 z-10 flex flex-col gap-2 chat-composer">
          <transition name="fade">
            <p v-if="validationError"
              class="absolute -top-12 left-4 right-4 text-red-500 text-[10px] text-center bg-white shadow-sm py-2 px-3 border border-red-100 font-semibold uppercase tracking-wide rounded-[2px]">
              {{ validationError }}
            </p>
          </transition>

          <div class="flex items-end gap-2">
            <textarea ref="textareaRef" v-model="inputMessage" @keydown="handleKeydown" @input="adjustTextareaHeight"
              placeholder="Đặt câu hỏi về dịch vụ, lịch hẹn hoặc đơn hàng..."
              :disabled="isSending || isShowingNamePrompt || isHandoffConnecting" rows="1"
              class="w-full bg-transparent text-[13px] leading-[1.5] text-[#111] placeholder:text-black/30 outline-none resize-none py-2 max-h-[120px] custom-scroll"></textarea>
            <button @click="sendMessage"
              :disabled="!inputMessage.trim() || isSending || isShowingNamePrompt || isHandoffConnecting"
              class="flex h-10 w-10 shrink-0 items-center justify-center text-black transition-all duration-300 hover:opacity-50 active:scale-95 disabled:opacity-20 mb-0.5">
              <Send :size="18" :stroke-width="1.2" />
            </button>
          </div>
        </div>

      </div>
    </transition>

    <!-- Chat Toggle Button -->
    <button @click="isChatOpen = !isChatOpen"
      class="relative flex h-[54px] w-[54px] items-center justify-center rounded-full bg-black text-white shadow-[0_12px_24px_rgba(0,0,0,0.15)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-px hover:scale-[1.03] active:scale-[0.98] mt-4"
      aria-label="Toggle Chat">
      <span v-if="hasHandedOff && !isChatOpen"
        class="absolute top-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-[1.5px] border-black"></span>
      <MessageSquare v-if="!isChatOpen" :size="20" :stroke-width="1.2" />
      <X v-else :size="20" :stroke-width="1.2" />
    </button>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: all 550ms cubic-bezier(0.22, 1, 0.36, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateY(24px) translateX(8px) scale(0.98);
  pointer-events: none;
}

.message-list-enter-active {
  transition: all 300ms cubic-bezier(0.22, 1, 0.36, 1);
}

.message-list-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.message-list-leave-active {
  position: absolute;
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 200ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.custom-scroll::-webkit-scrollbar {
  width: 4px;
}

.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.1);
  border-radius: 4px;
}

/* Mobile specific styling: safe-area and 100dvh */
@media (max-width: 767px) {
  .chat-panel-mobile {
    height: 100dvh;
    padding-bottom: 0;
    /* Handled by composer padding */
  }

  .chat-composer {
    /* Only apply safe area to composer area */
    padding-bottom: calc(16px + env(safe-area-inset-bottom));
  }
}
</style>