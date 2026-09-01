<script setup lang="ts">
import { ref, computed, watch, nextTick, onUnmounted, reactive } from 'vue'
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
// @ts-ignore
import { db } from '@/firebase.js'
// @ts-ignore
import { sendMessage, toggleRoomStatus } from '@/services/chatService.js'
import { logActivity } from '@/utils/activityLogger'
import { useTheme } from 'vuetify'
import { useCustomizerStore } from '@/stores/customizer'
import {
  MessageSquare, Search, Trash2, Send, X, Clock,
  Smile, DollarSign, Calendar, Heart, Power, MessageCircle
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

// ── HIGH PRIORITY NOTIFICATION SNACKBAR ──
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

// ── STATE ──
const allRooms = ref<any[]>([])
const messages = ref<any[]>([])
const selectedRoom = ref<any>(null)
const newMessage = ref('')
const loadingRooms = ref(true)
const loadingMessages = ref(false)
const sending = ref(false)
const togglingStatus = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)
const searchQuery = ref('')

const isManageMode = ref(false)
const selectedRoomIds = ref<string[]>([])
const isDeleteConfirmOpen = ref(false)

// ── MANAGE MODE ACTIONS ──
const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  selectedRoomIds.value = []
}

const handleRoomCheckboxToggle = (roomId: string) => {
  const index = selectedRoomIds.value.indexOf(roomId)
  if (index > -1) {
    selectedRoomIds.value.splice(index, 1)
  } else {
    selectedRoomIds.value.push(roomId)
  }
}

const isAllSelected = computed(() => {
  const rooms = filteredRooms.value
  if (rooms.length === 0) return false
  return rooms.every((r) => selectedRoomIds.value.includes(r.id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedRoomIds.value = []
  } else {
    selectedRoomIds.value = filteredRooms.value.map((r) => r.id)
  }
}

const confirmDeleteSelectedRooms = () => {
  if (selectedRoomIds.value.length === 0) return
  isDeleteConfirmOpen.value = true
}

const executeDeleteSelectedRooms = async () => {
  isDeleteConfirmOpen.value = false
  const idsToDelete = [...selectedRoomIds.value]
  selectedRoomIds.value = []

  try {
    for (const id of idsToDelete) {
      if (selectedRoom.value?.id === id) {
        selectedRoom.value = null
      }
      await deleteDoc(doc(db, 'ChatRooms', id))
    }
    logActivity('Xóa phòng chat', `Đã xóa ${idsToDelete.length} cuộc hội thoại chat hỗ trợ khách hàng`, 'Hỗ trợ khách hàng')
    showNotification(`Đã xóa ${idsToDelete.length} cuộc hội thoại thành công.`, 'success')
    isManageMode.value = false
  } catch (err: any) {
    logActivity('Xóa phòng chat', `Thất bại khi xóa các cuộc trò chuyện - Lỗi: ${err.message || ''}`, 'Hỗ trợ khách hàng', 'Thất bại')
    console.error('Lỗi khi xóa các cuộc trò chuyện:', err)
    showNotification('Đã xảy ra lỗi khi xóa cuộc trò chuyện.', 'error')
  }
}

// Staff Info
const staffUser = JSON.parse(sessionStorage.getItem('adminUser') || sessionStorage.getItem('staffUser') || '{}')
const staffName = staffUser?.hoTen || staffUser?.tenNhanVien || 'Nhân viên'

// ── COMPUTED ──
const activeRooms = computed(() =>
  allRooms.value
    .filter((r) => r.status === 'Active')
    .sort((a, b) => {
      const ta = a.updatedAt?.seconds ?? 0
      const tb = b.updatedAt?.seconds ?? 0
      return tb - ta
    })
)

const filteredRooms = computed(() => {
  const rooms = activeRooms.value
  if (!searchQuery.value.trim()) return rooms
  const q = searchQuery.value.toLowerCase().trim()
  return rooms.filter(
    (r) => r.customerName?.toLowerCase().includes(q) || r.lastMessage?.toLowerCase().includes(q)
  )
})

// ── FIRESTORE LISTENERS ──
let unsubscribeRooms: any = null

const listenToRooms = () => {
  const q = query(collection(db, 'ChatRooms'), where('status', '==', 'Active'))

  unsubscribeRooms = onSnapshot(
    q,
    (snapshot) => {
      allRooms.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      loadingRooms.value = false
    },
    (error) => {
      console.error('[Chat] Lỗi lắng nghe phòng chat:', error)
      loadingRooms.value = false
    }
  )
}

let unsubscribeMessages: any = null

const listenToMessages = (roomId: string) => {
  if (unsubscribeMessages) {
    unsubscribeMessages()
    unsubscribeMessages = null
  }

  loadingMessages.value = true
  messages.value = []

  const q = query(collection(db, 'ChatRooms', roomId, 'Messages'), orderBy('timestamp', 'asc'))

  unsubscribeMessages = onSnapshot(
    q,
    (snapshot) => {
      messages.value = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))
      loadingMessages.value = false
      scrollToBottom()
    },
    (error) => {
      console.error('[Chat] Lỗi lắng nghe tin nhắn:', error)
      loadingMessages.value = false
    }
  )
}

// ── ACTIONS ──
const selectRoom = (room: any) => {
  selectedRoom.value = room
  listenToMessages(room.id)
}

const handleSend = async () => {
  const content = newMessage.value.trim()
  if (!content || sending.value || !selectedRoom.value) return

  sending.value = true
  const msgContent = content
  newMessage.value = ''

  try {
    await sendMessage(selectedRoom.value.id, 'Staff', staffName, msgContent)
    logActivity('Gửi tin nhắn hỗ trợ', `Đã gửi tin nhắn hỗ trợ cho khách hàng ${selectedRoom.value.customerName}`, 'Hỗ trợ khách hàng')
  } catch (err: any) {
    logActivity('Gửi tin nhắn hỗ trợ', `Thất bại khi gửi tin nhắn cho khách hàng ${selectedRoom.value.customerName} - Lỗi: ${err.message || ''}`, 'Hỗ trợ khách hàng', 'Thất bại')
    console.error('[Chat] Lỗi gửi tin:', err)
    newMessage.value = msgContent
    showNotification('Không thể gửi tin nhắn. Vui lòng thử lại.', 'error')
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
    const actionLabel = newStatus === 'Closed' ? 'Đóng' : 'Mở lại'
    logActivity('Thay đổi trạng thái phòng chat', `Đã ${actionLabel} phòng chat của khách hàng ${selectedRoom.value.customerName}`, 'Hỗ trợ khách hàng')
    showNotification(`Đã ${actionLabel.toLowerCase()} cuộc trò chuyện thành công.`, 'success')
    if (newStatus === 'Closed') {
      selectedRoom.value = null
    }
  } catch (err: any) {
    logActivity('Thay đổi trạng thái phòng chat', `Thất bại khi thay đổi trạng thái phòng chat của ${selectedRoom.value.customerName} - Lỗi: ${err.message || ''}`, 'Hỗ trợ khách hàng', 'Thất bại')
    console.error('[Chat] Lỗi đổi trạng thái:', err)
    showNotification('Không thể thay đổi trạng thái phòng chat.', 'error')
  } finally {
    togglingStatus.value = false
  }
}

// ── HELPERS ──
const scrollToBottom = () => {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

const formatTime = (timestamp: any) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 60000) return 'Vừa xong'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}p`
  if (diff < 86400000) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
}

const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return ''
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
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

// ── QUICK REPLY SUGGESTIONS ──
const defaultSuggestions = [
  { text: 'Dạ LGHair xin chào anh/chị, em có thể giúp gì cho mình ạ?', type: 'greet' },
  { text: 'Dạ bên em mở cửa từ 8:00 đến 21:00 hàng ngày ạ.', type: 'hours' },
  { text: 'Dạ anh/chị muốn đặt lịch cắt tóc hay làm dịch vụ gì ạ?', type: 'book' }
]

const currentSuggestions = computed(() => {
  if (!messages.value || messages.value.length === 0) {
    return defaultSuggestions
  }

  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg.senderRole !== 'Customer') {
    return defaultSuggestions
  }

  const content = lastMsg.content?.toLowerCase() || ''

  if (content.includes('chào') || content.includes('hello') || content.includes('hi')) {
    return [
      { text: 'Dạ LGHair xin chào anh/chị, em có thể giúp gì cho mình ạ?', type: 'greet' },
      { text: 'Dạ em chào anh/chị! Không biết mình đang cần tư vấn dịch vụ gì ạ?', type: 'greet' },
      { text: 'Dạ chào anh/chị, chúc anh/chị một ngày tốt lành ạ!', type: 'greet' }
    ]
  }

  if (content.includes('giá') || content.includes('nhiêu') || content.includes('tiền') || content.includes('cost')) {
    return [
      { text: 'Dạ cắt tóc nam bên em là 100k, cắt tóc nữ là 150k đã bao gồm gội sấy ạ.', type: 'price' },
      { text: 'Dạ combo Uốn/Duỗi/Nhuộm bên em đang giảm giá chỉ từ 350k ạ.', type: 'price' },
      { text: 'Dạ anh/chị muốn làm combo cắt gội hay dịch vụ hóa chất uốn nhuộm ạ?', type: 'price' }
    ]
  }

  if (content.includes('giờ') || content.includes('mở') || content.includes('đóng') || content.includes('time')) {
    return [
      { text: 'Dạ salon bên em mở cửa từ 8:00 đến 21:00 tất cả các ngày trong tuần ạ.', type: 'hours' },
      { text: 'Dạ tầm tối bên em nhận lượt khách cuối cùng trước 20:00 ạ.', type: 'hours' },
      { text: 'Dạ anh/chị tính ghé tầm mấy giờ để em sắp xếp stylist đón tiếp mình ạ?', type: 'hours' }
    ]
  }

  if (content.includes('đặt') || content.includes('lịch') || content.includes('hẹn') || content.includes('book')) {
    return [
      { text: 'Dạ anh/chị muốn book lịch cắt tóc vào mấy giờ hôm nay ạ?', type: 'book' },
      { text: 'Dạ anh/chị có thể cho em xin SĐT và Tên để em đặt lịch giữ chỗ nhé.', type: 'book' },
      { text: 'Dạ anh/chị có chọn trước stylist nào bên em làm tóc cho mình chưa ạ?', type: 'book' }
    ]
  }

  if (content.includes('cảm ơn') || content.includes('thanks') || content.includes('thank')) {
    return [
      { text: 'Dạ không có gì ạ, rất hân hạnh được phục vụ anh/chị!', type: 'thanks' },
      { text: 'Dạ chúc anh/chị một ngày vui vẻ và hẹn gặp lại anh/chị tại salon ạ!', type: 'thanks' },
      { text: 'Dạ em cám ơn anh/chị ạ!', type: 'thanks' }
    ]
  }

  return defaultSuggestions
})

const applySuggestion = (text: string) => {
  newMessage.value = text
}

watch(
  allRooms,
  (rooms) => {
    if (selectedRoom.value) {
      const updated = rooms.find((r) => r.id === selectedRoom.value.id)
      if (updated) selectedRoom.value = updated
    }
  },
  { deep: true }
)

watch(messages, () => {
  scrollToBottom()
})

listenToRooms()

onUnmounted(() => {
  if (unsubscribeRooms) unsubscribeRooms()
  if (unsubscribeMessages) unsubscribeMessages()
})
</script>

<template>
  <v-container fluid class="pa-4 pa-md-6">
    <!-- HIGH PRIORITY SNACKBAR -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" :timeout="3500" elevation="6"
      style="z-index: 99999;">
      <div class="d-flex align-center font-weight-bold">
        <span>{{ snackbar.text }}</span>
      </div>
      <template v-slot:actions>
        <v-btn variant="text" icon density="comfortable" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <!-- DELETE CONFIRM DIALOG -->
    <v-dialog v-model="isDeleteConfirmOpen" max-width="440px">
      <v-card rounded="xl" class="pa-6">
        <div class="d-flex align-center gap-3 mb-4">
          <v-avatar color="error-lighten-5" size="48" rounded="lg">
            <Trash2 class="w-6 h-6 text-error" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">Xác Nhận Xóa</h3>
            <p class="text-caption text-medium-emphasis mb-0">Hành động này không thể hoàn tác</p>
          </div>
        </div>

        <p class="text-body-2 mb-6">
          Bạn có chắc chắn muốn xóa <strong>{{ selectedRoomIds.length }}</strong> cuộc hội thoại đã chọn?
        </p>

        <div class="d-flex justify-end gap-2">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold"
            @click="isDeleteConfirmOpen = false">
            Hủy bỏ
          </v-btn>
          <v-btn color="error" variant="flat" rounded="lg" class="text-none font-weight-bold"
            @click="executeDeleteSelectedRooms">
            Xóa Ngay
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ═══════ 100% VUETIFY 3 MAIN CHAT CARD ═══════ -->
    <v-card elevation="3" rounded="2xl" class="border overflow-hidden"
      style="height: calc(100vh - 150px); min-height: 560px;">
      <v-row no-gutters class="fill-height">

        <!-- ══════════════════════════════════════════
             CỘT TRÁI: DANH SÁCH PHÒNG CHAT (VUETIFY)
        ══════════════════════════════════════════ -->
        <v-col cols="12" md="4" lg="3" class="border-r fill-height d-flex flex-column bg-surface">

          <!-- Header Cột Trái -->
          <div class="pa-4 border-b shrink-0">
            <div class="d-flex align-center justify-space-between mb-4">
              <div class="d-flex align-center gap-3">
                <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
                  <MessageSquare class="w-6 h-6 text-primary" />
                </v-avatar>
                <div>
                  <h2 class="text-subtitle-1 font-weight-bold mb-1" style="line-height: 1.3;">Hỗ Trợ Khách Hàng</h2>
                  <div class="text-caption text-primary font-weight-bold uppercase tracking-wider"
                    style="font-size: 11px; line-height: 1.2;">Live Chat 1:1</div>
                </div>
              </div>

              <v-btn size="small" :color="isManageMode ? 'grey' : 'error'" variant="tonal" rounded="lg"
                class="text-none font-weight-bold" @click="toggleManageMode">
                {{ isManageMode ? 'Hủy' : 'Quản lý' }}
              </v-btn>
            </div>

            <!-- Tìm kiếm khách hàng -->
            <div class="mb-3">
              <v-text-field v-model="searchQuery" placeholder="Tìm kiếm khách hàng..." variant="outlined"
                density="compact" hide-details rounded="xl" clearable>
                <template v-slot:prepend-inner>
                  <Search class="w-4 h-4 text-medium-emphasis" />
                </template>
              </v-text-field>
            </div>

            <!-- Count Badge -->
            <v-sheet rounded="lg" border
              class="d-flex align-center justify-space-between px-3 py-2 text-caption font-weight-bold text-medium-emphasis mt-3">
              <span>Khách hàng đang đợi:</span>
              <v-chip color="primary" size="x-small" variant="flat" class="font-weight-black">
                {{ activeRooms.length }}
              </v-chip>
            </v-sheet>
          </div>

          <!-- Room List -->
          <div class="flex-grow-1 overflow-y-auto pa-2 space-y-1">
            <!-- Manage Mode Toolbar -->
            <v-sheet v-if="isManageMode" rounded="lg" border
              class="d-flex align-center justify-space-between pa-2 mb-2">
              <v-checkbox :model-value="isAllSelected" label="Chọn tất cả" density="compact" hide-details
                color="primary" class="font-weight-bold" @update:model-value="toggleSelectAll"></v-checkbox>

              <v-btn color="error" size="small" variant="flat" rounded="lg" class="text-none font-weight-bold"
                :disabled="selectedRoomIds.length === 0" @click="confirmDeleteSelectedRooms">
                <template v-slot:prepend>
                  <Trash2 class="w-3.5 h-3.5 mr-1" />
                </template>
                Xóa ({{ selectedRoomIds.length }})
              </v-btn>
            </v-sheet>

            <!-- Loading -->
            <div v-if="loadingRooms" class="text-center py-10">
              <v-progress-circular indeterminate color="primary" size="32"></v-progress-circular>
            </div>

            <!-- Empty Rooms -->
            <div v-else-if="filteredRooms.length === 0" class="text-center py-12 px-4">
              <v-avatar color="grey-lighten-4" size="48" class="mb-3">
                <MessageCircle class="w-6 h-6 text-medium-emphasis" />
              </v-avatar>
              <div class="text-caption font-weight-bold text-medium-emphasis">Chưa có cuộc trò chuyện nào</div>
            </div>

            <!-- Room Cards -->
            <template v-else>
              <v-card v-for="room in filteredRooms" :key="room.id" variant="flat" rounded="xl"
                class="pa-3 cursor-pointer transition-all mb-2 relative room-card" :class="[
                  isDark ? 'room-card-dark' : 'room-card-light',
                  selectedRoom?.id === room.id ? (isDark ? 'room-card-active-dark' : 'room-card-active-light') : ''
                ]" @click="isManageMode ? handleRoomCheckboxToggle(room.id) : selectRoom(room)">
                <div class="d-flex align-center gap-3">
                  <v-checkbox v-if="isManageMode" :value="room.id" v-model="selectedRoomIds" density="compact"
                    hide-details color="primary" @click.stop></v-checkbox>

                  <div class="position-relative shrink-0">
                    <v-avatar :color="getAvatarColor(room.customerName)" size="42" rounded="lg"
                      class="font-weight-bold text-white shadow-xs">
                      {{ room.customerName?.charAt(0)?.toUpperCase() || '?' }}
                    </v-avatar>
                    <span v-if="room.status === 'Active'"
                      class="position-absolute bottom-0 right-0 w-3 h-3 rounded-circle bg-success border-2 border-white"></span>
                  </div>

                  <div class="flex-grow-1 min-w-0">
                    <div class="d-flex align-center justify-space-between mb-1">
                      <span class="text-subtitle-2 font-weight-bold text-truncate room-card-title">
                        {{ room.customerName }}
                      </span>
                      <div class="d-flex align-center gap-1">
                        <v-chip v-if="selectedRoom?.id === room.id" color="warning" size="x-small" variant="flat"
                          class="font-weight-black px-1.5" style="height: 16px; font-size: 9px;">
                          Đang chọn
                        </v-chip>
                        <span class="text-caption font-mono ml-1 room-card-sub" style="font-size: 10px;">{{
                          formatTime(room.updatedAt) }}</span>
                      </div>
                    </div>

                    <p v-if="room.isCustomerTyping"
                      class="text-caption text-success font-weight-bold mb-0 text-truncate animate-pulse">
                      Đang nhập...
                    </p>
                    <p v-else class="text-caption mb-0 text-truncate room-card-sub">
                      {{ room.lastMessage || 'Bắt đầu cuộc trò chuyện...' }}
                    </p>
                  </div>
                </div>
              </v-card>
            </template>
          </div>
        </v-col>

        <!-- ══════════════════════════════════════════
             CỘT PHẢI: KHUNG CHAT CHI TIẾT (VUETIFY)
        ══════════════════════════════════════════ -->
        <v-col cols="12" md="8" lg="9" class="fill-height d-flex flex-column bg-grey-lighten-5 dark:bg-grey-darken-4">

          <!-- Empty State -->
          <div v-if="!selectedRoom" class="flex-grow-1 d-flex flex-column align-center justify-center pa-8 text-center">
            <v-avatar color="primary-lighten-5" size="72" class="mb-4">
              <MessageSquare class="w-10 h-10 text-primary" />
            </v-avatar>
            <h2 class="text-h6 font-weight-bold mb-1">Chọn một cuộc trò chuyện</h2>
            <p class="text-body-2 text-medium-emphasis mb-0" style="max-width: 360px;">
              Chọn khách hàng từ danh sách bên trái để bắt đầu hỗ trợ tư vấn trực tuyến.
            </p>
          </div>

          <!-- Active Chat Window -->
          <template v-else>
            <!-- Chat Header Toolbar -->
            <v-toolbar color="surface" border="bottom" class="px-4">
              <div class="d-flex align-center gap-3">
                <v-avatar :color="getAvatarColor(selectedRoom.customerName)" size="42" rounded="lg"
                  class="font-weight-bold text-white shadow-xs">
                  {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
                </v-avatar>
                <div>
                  <div class="text-subtitle-1 font-weight-bold d-flex align-center gap-2">
                    <span>{{ selectedRoom.customerName }}</span>
                    <v-chip v-if="selectedRoom.isCustomerTyping" color="success" size="x-small" variant="flat"
                      class="font-weight-bold">
                      đang soạn tin...
                    </v-chip>
                  </div>
                  <div class="d-flex align-center gap-1">
                    <span
                      :class="['w-2 h-2 rounded-circle me-1', selectedRoom.status === 'Active' ? 'bg-success' : 'bg-grey']"></span>
                    <span class="text-caption font-weight-bold"
                      :class="selectedRoom.status === 'Active' ? 'text-success' : 'text-medium-emphasis'">
                      {{ selectedRoom.status === 'Active' ? 'Đang hoạt động' : 'Đã đóng' }}
                    </span>
                  </div>
                </div>
              </div>

              <v-spacer></v-spacer>

              <v-btn :color="selectedRoom.status === 'Active' ? 'error' : 'success'" variant="tonal" size="small"
                rounded="lg" class="text-none font-weight-bold" :loading="togglingStatus" @click="handleToggleStatus">
                <template v-slot:prepend>
                  <Power class="w-4 h-4 mr-1" />
                </template>
                {{ selectedRoom.status === 'Active' ? 'Đóng phòng' : 'Mở lại' }}
              </v-btn>
            </v-toolbar>

            <!-- Messages Scroll Area -->
            <div ref="messagesContainer" class="flex-grow-1 overflow-y-auto pa-6 space-y-4">
              <div v-if="loadingMessages" class="text-center py-12">
                <v-progress-circular indeterminate color="primary" size="36"></v-progress-circular>
              </div>

              <div v-else-if="messages.length === 0" class="text-center py-16">
                <v-avatar color="grey-lighten-4" size="48" class="mb-2">
                  <MessageSquare class="w-6 h-6 text-medium-emphasis" />
                </v-avatar>
                <div class="text-caption text-medium-emphasis font-weight-bold">Chưa có tin nhắn nào trong cuộc hội
                  thoại này
                </div>
              </div>

              <!-- Chat Bubbles -->
              <template v-else>
                <div v-for="msg in messages" :key="msg.id" class="d-flex align-start gap-3 mb-4"
                  :class="msg.senderRole === 'Staff' ? 'justify-end' : 'justify-start'">
                  <!-- Customer Avatar (Left) -->
                  <v-avatar v-if="msg.senderRole === 'Customer'" :color="getAvatarColor(selectedRoom.customerName)"
                    size="36" rounded="lg" class="font-weight-bold text-white me-2 mt-1 shadow-xs">
                    {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
                  </v-avatar>

                  <!-- Message Bubble -->
                  <div class="d-flex flex-column" :class="msg.senderRole === 'Staff' ? 'align-end' : 'align-start'"
                    style="max-width: 72%;">
                    <v-sheet elevation="1" rounded="xl" class="pa-3 text-body-2 font-weight-medium border"
                      :color="msg.senderRole === 'Staff' ? 'primary' : 'surface'"
                      :class="msg.senderRole === 'Staff' ? 'text-white' : 'text-high-emphasis'">
                      {{ msg.content }}
                    </v-sheet>
                    <span class="text-caption text-medium-emphasis font-mono mt-1 px-1" style="font-size: 11px;">
                      {{ formatTimestamp(msg.timestamp) }}
                    </span>
                  </div>

                  <!-- Staff Avatar (Right) -->
                  <v-avatar v-if="msg.senderRole === 'Staff'" color="primary-darken-1" size="36" rounded="lg"
                    class="font-weight-bold text-white ms-2 mt-1 shadow-xs">
                    NV
                  </v-avatar>
                </div>
              </template>
            </div>

            <!-- Footer: Quick Reply & Input Toolbar -->
            <v-sheet color="surface" border="top" class="pa-4">
              <div v-if="selectedRoom.status === 'Closed'" class="text-center py-2">
                <span class="text-caption font-weight-bold text-medium-emphasis">
                  Phòng chat đã đóng. Hãy mở lại để tiếp tục nhắn tin.
                </span>
              </div>

              <div v-else class="space-y-3">
                <!-- Quick Response Chips Group -->
                <div class="d-flex align-center gap-2 overflow-x-auto pb-2">
                  <span class="text-caption font-weight-bold text-medium-emphasis uppercase me-1 shrink-0">Gợi ý trả
                    lời:</span>
                  <v-chip v-for="(suggestion, idx) in currentSuggestions" :key="idx" color="primary" variant="tonal"
                    size="small" class="font-weight-bold cursor-pointer me-1 shrink-0"
                    @click="applySuggestion(suggestion.text)">
                    <template v-slot:prepend>
                      <Smile v-if="suggestion.type === 'greet'" class="w-3.5 h-3.5 mr-1" />
                      <DollarSign v-else-if="suggestion.type === 'price'" class="w-3.5 h-3.5 mr-1" />
                      <Clock v-else-if="suggestion.type === 'hours'" class="w-3.5 h-3.5 mr-1" />
                      <Calendar v-else-if="suggestion.type === 'book'" class="w-3.5 h-3.5 mr-1" />
                      <Heart v-else-if="suggestion.type === 'thanks'" class="w-3.5 h-3.5 mr-1" />
                      <MessageSquare v-else class="w-3.5 h-3.5 mr-1" />
                    </template>
                    {{ suggestion.text }}
                  </v-chip>
                </div>

                <!-- Input Text Field & Send Button -->
                <div class="d-flex align-center gap-3">
                  <v-text-field v-model="newMessage" placeholder="Nhập tin nhắn..." variant="outlined" density="compact"
                    hide-details rounded="xl" @keydown.enter="handleSend"></v-text-field>

                  <v-btn color="primary" icon elevation="3" size="large" :disabled="!newMessage.trim() || sending"
                    :loading="sending" @click="handleSend">
                    <Send class="w-5 h-5" />
                  </v-btn>
                </div>
              </div>
            </v-sheet>

          </template>
        </v-col>
      </v-row>
    </v-card>
  </v-container>
</template>

<style scoped>
:global(body.v-theme--dark),
:global(.v-theme--dark .v-main),
:global(.v-theme--dark .v-application) {
  background-color: #141416 !important;
}

/* Base Transition */
.room-card {
  transition: all 0.2s ease-in-out;
}

/* ── LIGHT MODE ROOM CARDS ── */
.room-card-light {
  background-color: #ffffff !important;
  border: 1px solid #e2e8f0 !important;
}

.room-card-light .room-card-title {
  color: #0f172a !important;
}

.room-card-light .room-card-sub {
  color: #64748b !important;
}

.room-card-active-light {
  background-color: #fff8e6 !important;
  border: 1.5px solid #d97706 !important;
  border-left: 6px solid #d97706 !important;
  box-shadow: 0 4px 14px rgba(217, 119, 6, 0.18) !important;
}

.room-card-active-light .room-card-title {
  color: #b45309 !important;
}

.room-card-active-light .room-card-sub {
  color: #475569 !important;
}

/* ── DARK MODE ROOM CARDS ── */
.room-card-dark {
  background-color: #1e1e24 !important;
  border: 1px solid #334155 !important;
}

.room-card-dark .room-card-title {
  color: #f8fafc !important;
}

.room-card-dark .room-card-sub {
  color: #94a3b8 !important;
}

.room-card-active-dark {
  background-color: #2b2214 !important;
  border: 2px solid #f59e0b !important;
  border-left: 6px solid #f59e0b !important;
  box-shadow: 0 4px 16px rgba(245, 158, 11, 0.25) !important;
}

.room-card-active-dark .room-card-title {
  color: #fbbf24 !important;
}

.room-card-active-dark .room-card-sub {
  color: #e2e8f0 !important;
}
</style>
