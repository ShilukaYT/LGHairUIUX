import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useChatStore = defineStore('chat', () => {
  // true khi cửa sổ chat đang mở
  const isChatOpen = ref(false)

  return { isChatOpen }
})
