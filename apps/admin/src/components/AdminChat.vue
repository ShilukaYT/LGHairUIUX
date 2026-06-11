<template>
  <div class="flex h-screen bg-slate-100 font-sans overflow-hidden">

    <!-- ══════════════════════════════════════════
         CỘT TRÁI: DANH SÁCH PHÒNG CHAT
    ══════════════════════════════════════════ -->
    <aside class="w-80 min-w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col shadow-sm">

      <!-- Header cột trái -->
      <div class="px-5 py-4 border-b border-slate-200 bg-white shadow-sm">
        <div class="flex items-center gap-3 mb-1">
          <div class="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2"
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"/>
            </svg>
          </div>
          <div>
            <h1 class="text-slate-800 font-bold text-sm tracking-wide">Hỗ Trợ Khách Hàng</h1>
            <p class="text-slate-400 text-[11px] font-medium uppercase tracking-wider">Live Chat 1:1</p>
          </div>
        </div>
        <!-- Badge tổng phòng Active -->
        <div class="flex items-center gap-2 mt-4 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
          <span class="text-xs font-medium text-slate-500">Đang hoạt động:</span>
          <span class="bg-blue-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
            {{ activeRooms.length }}
          </span>
        </div>
      </div>

      <!-- Danh sách phòng chat (scroll) -->
      <div class="flex-1 overflow-y-auto custom-scroll bg-slate-50/50 p-3 space-y-2.5">
        <div v-if="loadingRooms" class="flex items-center justify-center py-12">
          <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>

        <div v-else-if="activeRooms.length === 0" class="text-center py-12 px-4">
          <div class="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm">
            <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </div>
          <p class="text-slate-400 text-sm font-medium">Chưa có cuộc trò chuyện nào</p>
        </div>

        <!-- Room item -->
        <div
          v-for="room in activeRooms"
          :key="room.id"
          @click="selectRoom(room)"
          :class="[
            'flex items-center gap-3 px-4 py-3.5 cursor-pointer rounded-xl transition-all duration-150 border',
            selectedRoom?.id === room.id
              ? 'bg-white border-slate-200 border-l-4 border-l-blue-600 shadow-sm'
              : 'bg-white/60 hover:bg-white border-slate-100 hover:border-slate-200 border-l-4 border-l-transparent'
          ]"
        >
          <!-- Avatar -->
          <div class="relative flex-shrink-0">
            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border border-blue-200">
              {{ room.customerName?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <!-- Dot trạng thái -->
            <span
              :class="[
                'absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white',
                room.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
              ]"
            ></span>
          </div>

          <!-- Thông tin room -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-slate-800 text-sm font-semibold truncate">{{ room.customerName }}</span>
              <span class="text-slate-400 text-[10px] font-medium flex-shrink-0 ml-1">
                {{ formatTime(room.updatedAt) }}
              </span>
            </div>
            <p class="text-slate-500 text-xs truncate font-medium">
              {{ room.lastMessage || 'Bắt đầu cuộc trò chuyện...' }}
            </p>
          </div>
        </div>
      </div>
    </aside>

    <!-- ══════════════════════════════════════════
         CỘT PHẢI: KHUNG CHAT CHI TIẾT
    ══════════════════════════════════════════ -->
    <main class="flex-1 flex flex-col bg-slate-100 min-w-0">

      <!-- Trạng thái chưa chọn phòng -->
      <div v-if="!selectedRoom" class="flex-1 flex flex-col items-center justify-center bg-slate-100">
        <div class="w-20 h-20 bg-white border border-slate-200/60 rounded-2xl flex items-center justify-center mb-4 shadow-md">
          <svg class="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"/>
          </svg>
        </div>
        <h2 class="text-slate-700 text-base font-bold tracking-wide">Chọn một cuộc trò chuyện</h2>
        <p class="text-slate-400 text-sm mt-1">để bắt đầu hỗ trợ khách hàng</p>
      </div>

      <!-- Khung chat khi đã chọn phòng -->
      <template v-else>

        <!-- Header chat -->
        <div class="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0 shadow-sm z-10">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold border border-blue-200">
              {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
            </div>
            <div>
              <h2 class="text-slate-800 font-bold text-sm">{{ selectedRoom.customerName }}</h2>
              <div class="flex items-center gap-1.5 mt-0.5">
                <span :class="['w-2 h-2 rounded-full', selectedRoom.status === 'Active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400']"></span>
                <span :class="['text-xs font-semibold', selectedRoom.status === 'Active' ? 'text-emerald-600' : 'text-slate-500']">
                  {{ selectedRoom.status === 'Active' ? 'Đang hoạt động' : 'Đã đóng' }}
                </span>
              </div>
            </div>
          </div>

          <!-- Nút đóng/mở phòng -->
          <button
            @click="handleToggleStatus"
            :disabled="togglingStatus"
            :class="[
              'px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-sm border',
              selectedRoom.status === 'Active'
                ? 'bg-red-50 text-red-600 hover:bg-red-100 border-red-200 hover:border-red-300'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'
            ]"
          >
            <span v-if="togglingStatus" class="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin"></span>
            {{ selectedRoom.status === 'Active' ? 'Đóng phòng' : 'Mở lại' }}
          </button>
        </div>

        <!-- Vùng hiển thị tin nhắn -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50 custom-scroll shadow-inner">
          <div v-if="loadingMessages" class="flex items-center justify-center py-8">
            <div class="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="messages.length === 0" class="text-center py-12">
            <p class="text-slate-400 text-sm font-medium">Chưa có tin nhắn nào trong cuộc hội thoại này</p>
          </div>

          <!-- Từng tin nhắn -->
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['flex items-start gap-3', msg.senderRole === 'Staff' ? 'justify-end' : 'justify-start']"
          >
            <!-- Avatar khách hàng (bên trái) -->
            <div v-if="msg.senderRole === 'Customer'"
              class="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 shadow-sm flex items-center justify-center text-xs text-blue-700 font-bold flex-shrink-0 mt-0.5">
              {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
            </div>

            <!-- Bubble tin nhắn -->
            <div :class="['max-w-[65%] flex flex-col', msg.senderRole === 'Staff' ? 'items-end' : 'items-start']">
              <div :class="[
                'px-4 py-2 rounded-2xl text-[13px] leading-relaxed shadow-sm',
                msg.senderRole === 'Staff'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'
              ]">
                {{ msg.content }}
              </div>

              <!-- Timestamp hiển thị giờ gửi -->
              <p class="text-[9px] font-medium mt-1 px-1 text-slate-400">
                {{ formatTimestamp(msg.timestamp) }}
              </p>
            </div>

            <!-- Avatar nhân viên (bên phải) -->
            <div v-if="msg.senderRole === 'Staff'"
              class="w-8 h-8 rounded-full bg-blue-600 shadow-sm flex items-center justify-center text-[10px] text-white font-bold flex-shrink-0 mt-0.5">
              NV
            </div>
          </div>
        </div>

        <!-- Ô nhập tin nhắn -->
        <div class="px-6 py-2.5 border-t border-slate-200 bg-white flex-shrink-0 shadow-sm z-10">
          <div v-if="selectedRoom.status === 'Closed'" class="text-center py-1.5">
            <p class="text-slate-400 text-xs font-medium">Phòng chat đã đóng. Hãy mở lại để tiếp tục nhắn tin.</p>
          </div>
          <div v-else class="flex items-center gap-3">
            <input
              v-model="newMessage"
              @keydown.enter="handleSend"
              type="text"
              placeholder="Nhập tin nhắn..."
              class="h-10 flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
            />
            <button
              @click="handleSend"
              :disabled="!newMessage.trim() || sending"
              class="w-10 h-10 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 shadow-md shadow-blue-500/10"
            >
              <span v-if="sending" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <svg v-else class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
              </svg>
            </button>
          </div>
        </div>

      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/firebase.js'
import { sendMessage, toggleRoomStatus } from '@/services/chatService.js'

// ── State ──────────────────────────────────────────────
const allRooms        = ref([])
const messages        = ref([])
const selectedRoom    = ref(null)
const newMessage      = ref('')
const loadingRooms    = ref(true)
const loadingMessages = ref(false)
const sending         = ref(false)
const togglingStatus  = ref(false)
const messagesContainer = ref(null)

// Danh sách nhân viên đang online lấy từ sessionStorage
const staffUser = JSON.parse(sessionStorage.getItem('adminUser') || sessionStorage.getItem('staffUser') || '{}')
const staffName = staffUser?.hoTen || staffUser?.tenNhanVien || 'Nhân viên'

// ── Computed ───────────────────────────────────────────
// Chỉ hiển thị phòng Active ở cột trái, sắp xếp mới nhất lên trên
const activeRooms = computed(() =>
  allRooms.value
    .filter(r => r.status === 'Active')
    .sort((a, b) => {
      const ta = a.updatedAt?.seconds ?? 0
      const tb = b.updatedAt?.seconds ?? 0
      return tb - ta
    })
)

// ── Lắng nghe Collection ChatRooms (Real-time) ─────────
let unsubscribeRooms = null

const listenToRooms = () => {
  const q = query(
    collection(db, 'ChatRooms'),
    where('status', '==', 'Active')
  )

  unsubscribeRooms = onSnapshot(q, (snapshot) => {
    allRooms.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    loadingRooms.value = false
  }, (error) => {
    console.error('[Chat] Lỗi lắng nghe phòng chat:', error)
    loadingRooms.value = false
  })
}

// ── Lắng nghe Sub-collection Messages (Real-time) ─────
let unsubscribeMessages = null

const listenToMessages = (roomId) => {
  // Hủy listener cũ nếu có
  if (unsubscribeMessages) {
    unsubscribeMessages()
    unsubscribeMessages = null
  }

  loadingMessages.value = true
  messages.value = []

  const q = query(
    collection(db, 'ChatRooms', roomId, 'Messages'),
    orderBy('timestamp', 'asc')
  )

  unsubscribeMessages = onSnapshot(q, (snapshot) => {
    messages.value = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))
    loadingMessages.value = false
    scrollToBottom()
  }, (error) => {
    console.error('[Chat] Lỗi lắng nghe tin nhắn:', error)
    loadingMessages.value = false
  })
}

// ── Actions ────────────────────────────────────────────
const selectRoom = (room) => {
  selectedRoom.value = room
  listenToMessages(room.id)
}

const handleSend = async () => {
  const content = newMessage.value.trim()
  if (!content || sending.value || !selectedRoom.value) return

  sending.value = true
  const msgContent = content
  newMessage.value = '' // Clear ngay để UX mượt

  try {
    await sendMessage(selectedRoom.value.id, 'Staff', staffName, msgContent)
  } catch (err) {
    console.error('[Chat] Lỗi gửi tin:', err)
    newMessage.value = msgContent // Restore nếu lỗi
  } finally {
    sending.value = false
  }
}

const handleToggleStatus = async () => {
  if (!selectedRoom.value || togglingStatus.value) return

  togglingStatus.value = true
  const newStatus = selectedRoom.value.status === 'Active' ? 'Closed' : 'Active'

  try {
    await toggleRoomStatus(selectedRoom.value.id, newStatus)
    // Firestore onSnapshot sẽ tự cập nhật selectedRoom
    if (newStatus === 'Closed') {
      selectedRoom.value = null // Reset về màn hình chờ
    }
  } catch (err) {
    console.error('[Chat] Lỗi đổi trạng thái:', err)
  } finally {
    togglingStatus.value = false
  }
}

// ── Helpers ────────────────────────────────────────────
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatTime = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diff = now - date

  if (diff < 60000) return 'Vừa xong'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} phút`
  if (diff < 86400000) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const formatTimestamp = (timestamp) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

// Khi selectedRoom thay đổi từ bên ngoài (Firestore cập nhật), đồng bộ lại
watch(allRooms, (rooms) => {
  if (selectedRoom.value) {
    const updated = rooms.find(r => r.id === selectedRoom.value.id)
    if (updated) selectedRoom.value = updated
  }
}, { deep: true })

// Tự động scroll khi có tin mới
watch(messages, () => { scrollToBottom() })

// ── Lifecycle ──────────────────────────────────────────
listenToRooms()

onUnmounted(() => {
  if (unsubscribeRooms) unsubscribeRooms()
  if (unsubscribeMessages) unsubscribeMessages()
})
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 4px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 99px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
