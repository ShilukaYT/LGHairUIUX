<template>
  <div class="flex h-[calc(100vh-150px)] min-h-[450px] w-full rounded-2xl border border-solid border-slate-200 bg-white shadow-sm overflow-hidden text-xs">

    <!-- ══════════════════════════════════════════
         CỘT TRÁI: DANH SÁCH PHÒNG CHAT
    ══════════════════════════════════════════ -->
    <div class="w-80 min-w-[320px] bg-slate-50/70 border-r border-solid border-slate-200 flex flex-col shadow-xs h-full overflow-hidden">

      <!-- Header cột trái & Thanh tìm kiếm -->
      <div class="px-5 py-4 border-b border-solid border-slate-200/80 bg-white space-y-3.5 flex-shrink-0">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-[#9d804e]/10 text-[#8c734b] flex items-center justify-center shadow-xs">
              <svg class="w-5 h-5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z"/>
              </svg>
            </div>
            <div>
              <h1 class="text-slate-800 font-bold text-sm tracking-wide">Hỗ Trợ Khách Hàng</h1>
              <p class="text-slate-400 text-[10px] font-medium uppercase tracking-wider">Live Chat 1:1</p>
            </div>
          </div>
          <button
            @click="toggleManageMode"
            :class="[
              'px-2.5 py-1 rounded-lg text-[10px] font-bold border border-solid cursor-pointer transition-all duration-200',
              isManageMode
                ? 'bg-slate-200 text-slate-700 border-slate-300'
                : 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
            ]"
          >
            {{ isManageMode ? 'Hủy' : 'Quản lý' }}
          </button>
        </div>

        <!-- Tìm kiếm phòng -->
        <div class="relative">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Tìm kiếm khách hàng..."
            class="w-full h-10 pl-9 pr-4 rounded-xl border border-solid border-slate-200 bg-slate-50 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#8c734b] focus:bg-white focus:ring-2 focus:ring-[#8c734b]/10"
          />
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <!-- Badge tổng phòng Active -->
        <div class="flex items-center justify-between text-xs font-semibold text-slate-500 bg-slate-50/50 px-3 py-2 rounded-xl border border-solid border-slate-100">
          <span>Khách hàng đang đợi:</span>
          <span class="bg-[#8c734b] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
            {{ activeRooms.length }}
          </span>
        </div>
      </div>

      <!-- Danh sách phòng chat (scroll) -->
      <div class="flex-1 overflow-y-auto custom-scroll p-3 space-y-2">
        <!-- Thanh công cụ quản lý khi bật chế độ xóa -->
        <div v-if="isManageMode" class="flex items-center justify-between text-xs px-3 py-2 bg-slate-100 rounded-xl border border-solid border-slate-200 mb-2">
          <label class="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
            <input
              type="checkbox"
              :checked="isAllSelected"
              @change="toggleSelectAll"
              class="w-3.5 h-3.5 rounded border-slate-300 text-[#8c734b] focus:ring-[#8c734b] cursor-pointer"
            />
            Chọn tất cả
          </label>
          
          <button
            @click="deleteSelectedRooms"
            :disabled="selectedRoomIds.length === 0"
            :style="{
              backgroundColor: selectedRoomIds.length > 0 ? '#dc2626' : '#cbd5e1',
              color: 'white',
              cursor: selectedRoomIds.length > 0 ? 'pointer' : 'not-allowed',
              opacity: selectedRoomIds.length > 0 ? '1' : '0.5'
            }"
            class="px-3 py-1.5 rounded-lg text-[10px] font-bold border-none flex items-center gap-1 transition-all duration-200"
          >
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span class="text-white">Xóa ({{ selectedRoomIds.length }})</span>
          </button>
        </div>

        <div v-if="loadingRooms" class="flex items-center justify-center py-12">
          <div class="w-6 h-6 border-2 border-solid border-[#8c734b] border-t-transparent rounded-full animate-spin"></div>
        </div>

        <div v-else-if="filteredRooms.length === 0" class="text-center py-12 px-4">
          <div class="w-12 h-12 bg-white border border-solid border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
            <svg class="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
            </svg>
          </div>
          <p class="text-slate-400 text-xs font-medium">Chưa có cuộc trò chuyện nào</p>
        </div>

        <!-- Room item -->
        <div
          v-for="room in filteredRooms"
          :key="room.id"
          @click="isManageMode ? handleRoomCheckboxToggle(room.id) : selectRoom(room)"
          :class="[
            'group flex items-center gap-3 px-4 py-3.5 cursor-pointer rounded-xl transition-all duration-200 border border-solid relative select-none',
            selectedRoom?.id === room.id
              ? 'bg-[#8c734b]/10 border-[#8c734b]/20 shadow-xs'
              : 'bg-white hover:bg-slate-50 border-slate-100 hover:border-slate-200',
            isManageMode ? 'pl-12' : ''
          ]"
        >
          <!-- Checkbox chọn phòng khi ở chế độ Quản lý -->
          <div v-if="isManageMode" class="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <input
              type="checkbox"
              :value="room.id"
              v-model="selectedRoomIds"
              @click.stop
              class="w-4 h-4 rounded border-slate-300 text-[#8c734b] focus:ring-[#8c734b] cursor-pointer"
            />
          </div>

          <!-- Avatar -->
          <div class="relative flex-shrink-0">
            <div :class="['w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-xs', getAvatarBg(room.customerName)]">
              {{ room.customerName?.charAt(0)?.toUpperCase() || '?' }}
            </div>
            <!-- Dot trạng thái -->
            <span
              v-if="room.status === 'Active'"
              class="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-solid border-white bg-emerald-500 animate-pulse"
            ></span>
          </div>

          <!-- Thông tin room -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-slate-800 text-xs font-bold truncate group-hover:text-[#8c734b] transition-colors duration-150">{{ room.customerName }}</span>
              <span class="text-slate-400 text-[9px] font-semibold flex-shrink-0 ml-1">
                {{ formatTime(room.updatedAt) }}
              </span>
            </div>
            <p v-if="room.isCustomerTyping" class="text-emerald-600 text-[11px] truncate font-semibold animate-pulse">
              Đang nhập...
            </p>
            <p v-else class="text-slate-500 text-[11px] truncate font-medium">
              {{ room.lastMessage || 'Bắt đầu cuộc trò chuyện...' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- ══════════════════════════════════════════
         CỘT PHẢI: KHUNG CHAT CHI TIẾT
    ══════════════════════════════════════════ -->
    <div class="flex-1 flex flex-col bg-slate-50/30 min-w-0 h-full min-h-0 overflow-hidden">

      <!-- Trạng thái chưa chọn phòng -->
      <div v-if="!selectedRoom" class="flex-1 flex flex-col items-center justify-center bg-slate-50/40 p-6 text-center">
        <div class="w-16 h-16 bg-white border border-solid border-slate-200/80 rounded-2xl flex items-center justify-center mb-4 shadow-sm text-[#8c734b]">
          <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </div>
        <h2 class="text-slate-800 text-sm font-bold tracking-wide">Chọn một cuộc trò chuyện</h2>
        <p class="text-slate-400 text-xs mt-1">Chọn khách hàng từ danh sách bên trái để bắt đầu hỗ trợ tư vấn</p>
      </div>

      <!-- Khung chat khi đã chọn phòng -->
      <template v-else>

        <!-- Header chat -->
        <div class="px-6 py-4 border-b border-solid border-slate-200 bg-white flex items-center justify-between flex-shrink-0 shadow-xs z-10">
          <div class="flex items-center gap-3">
            <div :class="['w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-xs', getAvatarBg(selectedRoom.customerName)]">
              {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
            </div>
            <div>
              <h2 class="text-slate-800 font-bold text-sm flex items-center gap-2">
                <span>{{ selectedRoom.customerName }}</span>
                <span v-if="selectedRoom.isCustomerTyping" class="text-emerald-600 text-[10px] font-semibold animate-pulse bg-emerald-50 px-2 py-0.5 rounded-full border border-solid border-emerald-200">
                  đang soạn tin...
                </span>
              </h2>
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
              'px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center gap-2 shadow-xs border border-solid cursor-pointer',
              selectedRoom.status === 'Active'
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 hover:border-rose-300'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200 hover:border-emerald-300'
            ]"
          >
            <span v-if="togglingStatus" class="w-3.5 h-3.5 border border-solid border-current border-t-transparent rounded-full animate-spin"></span>
            {{ selectedRoom.status === 'Active' ? 'Đóng phòng' : 'Mở lại' }}
          </button>
        </div>

        <!-- Vùng hiển thị tin nhắn -->
        <div ref="messagesContainer" class="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-slate-50/50 custom-scroll shadow-inner">
          <div v-if="loadingMessages" class="flex items-center justify-center py-8">
            <div class="w-6 h-6 border-2 border-solid border-[#8c734b] border-t-transparent rounded-full animate-spin"></div>
          </div>

          <div v-else-if="messages.length === 0" class="text-center py-12">
            <p class="text-slate-400 text-xs font-medium">Chưa có tin nhắn nào trong cuộc hội thoại này</p>
          </div>

          <!-- Từng tin nhắn -->
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['flex items-start gap-3', msg.senderRole === 'Staff' ? 'justify-end' : 'justify-start']"
          >
            <!-- Avatar khách hàng (bên trái) -->
            <div v-if="msg.senderRole === 'Customer'"
              :class="['w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5', getAvatarBg(selectedRoom.customerName)]">
              {{ selectedRoom.customerName?.charAt(0)?.toUpperCase() }}
            </div>

            <!-- Bubble tin nhắn -->
            <div :class="['max-w-[65%] flex flex-col', msg.senderRole === 'Staff' ? 'items-end' : 'items-start']">
              <div :class="[
                'px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs border border-solid',
                msg.senderRole === 'Staff'
                  ? 'bg-[#9d804e] border-[#9d804e] text-white rounded-tr-xs'
                  : 'bg-white border-slate-200 text-slate-800 rounded-tl-xs'
              ]">
                {{ msg.content }}
              </div>

              <!-- Timestamp hiển thị giờ gửi -->
              <p class="text-[9px] font-semibold mt-1 px-1 text-slate-400">
                {{ formatTimestamp(msg.timestamp) }}
              </p>
            </div>

            <!-- Avatar nhân viên (bên phải) -->
            <div v-if="msg.senderRole === 'Staff'"
              class="w-8 h-8 rounded-xl bg-[#8c734b] text-white shadow-xs flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
              NV
            </div>
          </div>
        </div>

        <!-- Ô nhập tin nhắn -->
        <div class="px-6 py-4 border-t border-solid border-slate-200 bg-white flex-shrink-0 shadow-xs z-10">
          <div v-if="selectedRoom.status === 'Closed'" class="text-center py-1.5">
            <p class="text-slate-400 text-xs font-semibold">Phòng chat đã đóng. Hãy mở lại để tiếp tục nhắn tin.</p>
          </div>
          <div v-else class="space-y-3">
            <!-- Vùng gợi ý trả lời nhanh -->
            <div class="flex flex-nowrap gap-2 items-center overflow-x-auto custom-scroll py-1 select-none">
              <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider mr-1 shrink-0">Gợi ý trả lời:</span>
              <button
                v-for="(suggestion, idx) in currentSuggestions"
                :key="idx"
                @click="applySuggestion(suggestion.text)"
                style="background-color: #faf8f5 !important; color: #8c734b !important; border: 1px solid #e6d7b8 !important; cursor: pointer !important; padding: 6px 12px !important; border-radius: 9999px !important; line-height: 1.2 !important; box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important; display: inline-flex !important; align-items: center !important; gap: 6px !important;"
                class="text-[10px] font-semibold hover:bg-[#8c734b]/5 hover:border-[#8c734b] transition-all duration-150"
              >
                <!-- Icon tương ứng -->
                <span style="display: flex; align-items: center;">
                  <svg v-if="suggestion.type === 'greet'" class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <svg v-else-if="suggestion.type === 'price'" class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"/>
                  </svg>
                  <svg v-else-if="suggestion.type === 'hours'" class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>
                  <svg v-else-if="suggestion.type === 'book'" class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                  </svg>
                  <svg v-else-if="suggestion.type === 'thanks'" class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                  </svg>
                  <svg v-else class="w-3.5 h-3.5 text-[#8c734b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #8c734b !important;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 01-2 2h0a2 2 0 01-2-2v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                  </svg>
                </span>
                <span>{{ suggestion.text }}</span>
              </button>
            </div>

            <!-- Khung nhập -->
            <div class="flex items-center gap-3">
              <input
                v-model="newMessage"
                @keydown.enter="handleSend"
                type="text"
                placeholder="Nhập tin nhắn..."
                class="h-11 flex-1 rounded-xl border border-solid border-slate-200 bg-slate-50 px-4 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#8c734b] focus:bg-white focus:ring-2 focus:ring-[#8c734b]/10"
              />
              <button
                @click="handleSend"
                :disabled="!newMessage.trim() || sending"
                style="background-color: #9d804e !important; color: white !important; border: none !important; cursor: pointer !important; display: flex !important; align-items: center !important; justify-content: center !important;"
                class="w-11 h-11 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl flex items-center justify-center transition-all duration-200 flex-shrink-0 shadow-md shadow-[#9d804e]/20"
              >
                <span v-if="sending" class="w-4 h-4 border-2 border-solid border-white border-t-transparent rounded-full animate-spin"></span>
                <svg v-else class="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: white !important;">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { collection, query, where, orderBy, onSnapshot, doc, deleteDoc } from 'firebase/firestore'
import { db } from '@/firebase.js'
import { sendMessage, toggleRoomStatus } from '@/services/chatService.js'
import { logActivity } from '@/utils/activityLogger'

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
const searchQuery     = ref('')

const isManageMode     = ref(false)
const selectedRoomIds  = ref([])



// ── Actions for Manage Mode ────────────────────────────
const toggleManageMode = () => {
  isManageMode.value = !isManageMode.value
  selectedRoomIds.value = []
}

const handleRoomCheckboxToggle = (roomId) => {
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
  return rooms.every(r => selectedRoomIds.value.includes(r.id))
})

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedRoomIds.value = []
  } else {
    selectedRoomIds.value = filteredRooms.value.map(r => r.id)
  }
}

const deleteSelectedRooms = async () => {
  if (selectedRoomIds.value.length === 0) return
  if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedRoomIds.value.length} cuộc hội thoại đã chọn?`)) return

  const idsToDelete = [...selectedRoomIds.value]
  selectedRoomIds.value = []

  try {
    for (const id of idsToDelete) {
      if (selectedRoom.value?.id === id) {
        selectedRoom.value = null
      }
      await deleteDoc(doc(db, 'ChatRooms', id))
    }
    logActivity("Xóa phòng chat", `Đã xóa ${idsToDelete.length} cuộc hội thoại chat hỗ trợ khách hàng`, "Hỗ trợ khách hàng");
    isManageMode.value = false
  } catch (err) {
    logActivity("Xóa phòng chat", `Thất bại khi xóa các cuộc trò chuyện - Lỗi: ${err.message || ''}`, "Hỗ trợ khách hàng", "Thất bại");
    console.error('Lỗi khi xóa các cuộc trò chuyện:', err)
    alert('Đã xảy ra lỗi khi xóa cuộc trò chuyện.')
  }
}

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

// Tìm kiếm phòng theo tên khách hàng hoặc tin nhắn gần nhất
const filteredRooms = computed(() => {
  const rooms = activeRooms.value
  if (!searchQuery.value.trim()) return rooms
  const q = searchQuery.value.toLowerCase().trim()
  return rooms.filter(r =>
    r.customerName?.toLowerCase().includes(q) ||
    r.lastMessage?.toLowerCase().includes(q)
  )
})

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
    logActivity("Gửi tin nhắn hỗ trợ", `Đã gửi tin nhắn hỗ trợ cho khách hàng ${selectedRoom.value.customerName}`, "Hỗ trợ khách hàng");
  } catch (err) {
    logActivity("Gửi tin nhắn hỗ trợ", `Thất bại khi gửi tin nhắn cho khách hàng ${selectedRoom.value.customerName} - Lỗi: ${err.message || ''}`, "Hỗ trợ khách hàng", "Thất bại");
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
    const actionLabel = newStatus === 'Closed' ? 'Đóng' : 'Mở lại';
    logActivity("Thay đổi trạng thái phòng chat", `Đã ${actionLabel} phòng chat của khách hàng ${selectedRoom.value.customerName}`, "Hỗ trợ khách hàng");
    // Firestore onSnapshot sẽ tự cập nhật selectedRoom
    if (newStatus === 'Closed') {
      selectedRoom.value = null // Reset về màn hình chờ
    }
  } catch (err) {
    logActivity("Thay đổi trạng thái phòng chat", `Thất bại khi thay đổi trạng thái phòng chat của ${selectedRoom.value.customerName} sang ${newStatus} - Lỗi: ${err.message || ''}`, "Hỗ trợ khách hàng", "Thất bại");
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

// Hàm lấy class nền avatar ngẫu nhiên dựa trên tên khách
function getAvatarBg(name) {
  if (!name) return 'bg-[#8c734b]/10 text-[#8c734b]'
  const colors = [
    'bg-[#9d804e]/10 text-[#8c734b] border border-solid border-[#9d804e]/20',
    'bg-[#8c734b]/10 text-[#8c734b] border border-solid border-[#8c734b]/20',
    'bg-blue-50 text-blue-600 border border-solid border-blue-100',
    'bg-indigo-50 text-indigo-600 border border-solid border-indigo-100',
    'bg-purple-50 text-purple-600 border border-solid border-purple-100',
    'bg-rose-50 text-rose-600 border border-solid border-rose-100',
  ]
  let sum = 0
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i)
  }
  return colors[sum % colors.length]
}

// ── Gợi ý trả lời tư vấn ──────────────────────────────
const defaultSuggestions = [
  { text: 'Dạ LG Hair xin chào anh/chị, em có thể giúp gì cho mình ạ?', type: 'greet' },
  { text: 'Dạ bên em mở cửa từ 8:00 đến 21:00 hàng ngày ạ.', type: 'hours' },
  { text: 'Dạ anh/chị muốn đặt lịch cắt tóc hay làm dịch vụ gì ạ?', type: 'book' }
]

const currentSuggestions = computed(() => {
  if (!messages.value || messages.value.length === 0) {
    return defaultSuggestions
  }

  // Lấy tin nhắn cuối cùng
  const lastMsg = messages.value[messages.value.length - 1]
  if (lastMsg.senderRole !== 'Customer') {
    return defaultSuggestions
  }

  const content = lastMsg.content?.toLowerCase() || ''

  if (content.includes('chào') || content.includes('hello') || content.includes('hi')) {
    return [
      { text: 'Dạ LG Hair xin chào anh/chị, em có thể giúp gì cho mình ạ?', type: 'greet' },
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

const applySuggestion = (text) => {
  newMessage.value = text
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
  width: 8px;
  height: 8px;
}
.custom-scroll::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 99px;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 99px;
  border: 1px solid #f1f5f9;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
