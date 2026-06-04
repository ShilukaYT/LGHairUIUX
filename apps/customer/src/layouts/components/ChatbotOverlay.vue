<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { MessageSquare, X, Send, Sparkles } from 'lucide-vue-next'

type Message = {
  id: number
  isBot: boolean
  text: string
}

const isOpen = ref(false)
const inputMessage = ref('')
const messagesContainer = ref<HTMLElement | null>(null)

const messages = ref<Message[]>([
  {
    id: 1,
    isBot: true,
    text: 'Chào bạn, LGHair có thể giúp gì cho bạn hôm nay?'
  }
])

const suggestedActions = [
  'Tư vấn sản phẩm',
  'Đặt lịch cắt tóc',
  'Gặp nhân viên hỗ trợ'
]

const createMessageId = () => Date.now() + Math.random()

const scrollToBottom = async () => {
  await nextTick()

  if (!messagesContainer.value) return

  messagesContainer.value.scrollTo({
    top: messagesContainer.value.scrollHeight,
    behavior: 'smooth'
  })
}

const getBotReply = (action: string) => {
  switch (action) {
    case 'Gặp nhân viên hỗ trợ':
      return 'Hệ thống đang kết nối bạn với chuyên viên tư vấn. Vui lòng chờ trong giây lát...'

    case 'Tư vấn sản phẩm':
      return 'Bạn đang quan tâm đến sản phẩm chăm sóc tóc, phục hồi tóc hay tạo kiểu?'

    case 'Đặt lịch cắt tóc':
      return 'Bạn muốn đặt lịch vào ngày nào và chọn dịch vụ nào tại LGHair?'

    default:
      return 'LGHair đã nhận yêu cầu. Vui lòng cung cấp thêm thông tin để chúng tôi hỗ trợ bạn tốt hơn.'
  }
}

const handleAction = async (action: string) => {
  messages.value.push({
    id: createMessageId(),
    isBot: false,
    text: action
  })

  await scrollToBottom()

  window.setTimeout(async () => {
    messages.value.push({
      id: createMessageId(),
      isBot: true,
      text: getBotReply(action)
    })

    await scrollToBottom()
  }, 600)
}

const sendMessage = async () => {
  const message = inputMessage.value.trim()

  if (!message) return

  messages.value.push({
    id: createMessageId(),
    isBot: false,
    text: message
  })

  inputMessage.value = ''
  await scrollToBottom()

  window.setTimeout(async () => {
    messages.value.push({
      id: createMessageId(),
      isBot: true,
      text: 'Cảm ơn bạn. Chuyên viên của LGHair sẽ phản hồi bạn trong thời gian sớm nhất.'
    })

    await scrollToBottom()
  }, 800)
}
</script>

<template>
  <div
    class="fixed bottom-5 right-5 z-[100] flex flex-col items-end sm:bottom-6 sm:right-6 lg:bottom-10 lg:right-12"
  >
    <!-- Chat Window -->
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
        <!-- Header -->
        <div class="flex items-center justify-between bg-black px-5 py-4 text-white">
          <div class="flex items-center gap-3">
            <div class="flex h-8 w-8 items-center justify-center rounded-full border border-white/20">
              <Sparkles :size="15" :stroke-width="1.6" />
            </div>

            <div>
              <p class="text-[11px] font-semibold uppercase tracking-[0.22em]">
                LGHair Assistant
              </p>
              <p class="mt-0.5 text-[11px] text-white/60">
                Hỗ trợ đặt lịch & tư vấn sản phẩm
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="isOpen = false"
            class="flex h-8 w-8 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Đóng khung chat"
          >
            <X :size="18" :stroke-width="1.6" />
          </button>
        </div>

        <!-- Messages Area -->
        <div
          ref="messagesContainer"
          class="flex-1 space-y-4 overflow-y-auto bg-neutral-50 p-5"
        >
          <div
            v-for="msg in messages"
            :key="msg.id"
            :class="['flex w-full', msg.isBot ? 'justify-start' : 'justify-end']"
          >
            <div
              :class="[
                'max-w-[84%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                msg.isBot
                  ? 'rounded-tl-none border border-black/10 bg-white text-neutral-800'
                  : 'rounded-tr-none bg-black text-white'
              ]"
            >
              {{ msg.text }}
            </div>
          </div>

          <!-- Suggested Actions -->
          <div
            v-if="messages[messages.length - 1]?.isBot"
            class="flex flex-wrap gap-2 pt-1"
          >
            <button
              v-for="action in suggestedActions"
              :key="action"
              type="button"
              @click="handleAction(action)"
              class="rounded-full border border-black/10 bg-white px-4 py-2 text-left text-[10px] font-medium uppercase tracking-[0.16em] text-black transition-all duration-300 hover:border-black hover:bg-black hover:text-white active:scale-[0.98]"
            >
              {{ action }}
            </button>
          </div>
        </div>

        <!-- Input Area -->
        <div class="flex items-center gap-3 border-t border-black/10 bg-white p-4">
          <input
            v-model="inputMessage"
            @keyup.enter="sendMessage"
            type="text"
            placeholder="Nhập tin nhắn..."
            class="h-11 flex-1 rounded-full border border-black/10 bg-neutral-50 px-4 text-sm text-neutral-700 outline-none transition-all placeholder:text-neutral-400 focus:border-black focus:bg-white"
          />

          <button
            type="button"
            @click="sendMessage"
            :disabled="!inputMessage.trim()"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black text-white transition-all duration-300 hover:bg-neutral-800 active:scale-95 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400"
            aria-label="Gửi tin nhắn"
          >
            <Send :size="15" :stroke-width="1.8" />
          </button>
        </div>
      </div>
    </transition>

    <!-- Floating Toggle Button -->
    <button
      type="button"
      @click="isOpen = !isOpen"
      class="flex h-14 w-14 items-center justify-center rounded-2xl bg-black text-white shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:bg-neutral-800 hover:shadow-[0_16px_45px_rgba(0,0,0,0.28)] active:scale-95 md:h-16 md:w-16"
      aria-label="Mở hoặc đóng khung chat"
    >
      <X v-if="isOpen" :size="24" :stroke-width="1.6" />
      <MessageSquare v-else :size="24" :stroke-width="1.6" />
    </button>
  </div>
</template>