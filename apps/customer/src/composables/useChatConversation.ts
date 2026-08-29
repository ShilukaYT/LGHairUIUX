import { ref, computed, readonly } from 'vue'
import { ConversationState, SenderRole, type ChatMessage, type CustomerInfo } from '@/types/chatTypes'

// ── Single source of truth ───────────────────────────

/** Conversation state: AI → SHOW_NAME_PROMPT → HANDOFF_CONNECTING → HANDOFF_REQUESTED → STAFF_CONNECTED */
const conversationState = ref<ConversationState>(ConversationState.AI)

/** All messages in the single conversation */
const messages = ref<ChatMessage[]>([])

/** Room ID — chỉ có giá trị khi đã handoff */  
const roomId = ref<string | null>(null)

/** Customer info */
const customerInfo = ref<CustomerInfo>({ name: 'Khách', email: '' })

/** Visibility of chat panel */
const isChatOpen = ref(false)

// ── Loading states ────────────────────

const isSending = ref(false)
const isAiThinking = ref(false)

// ── Error states ──────────────────────

const errorState = ref<{
  type: 'HANDOFF_CREATE_ERROR' | 'SEND_MESSAGE_ERROR' | 'AI_ERROR' | null
  message: string
  retryAction?: () => Promise<void>
}>({ type: null, message: '' })

// ── Computed ─────────────────────

const isInAiMode = computed(() => conversationState.value === ConversationState.AI)
const isShowingNamePrompt = computed(() => conversationState.value === ConversationState.SHOW_NAME_PROMPT)
const isHandoffConnecting = computed(() => conversationState.value === ConversationState.HANDOFF_CONNECTING)
const isHandoffRequested = computed(() => conversationState.value === ConversationState.HANDOFF_REQUESTED)
const isStaffConnected = computed(() => conversationState.value === ConversationState.STAFF_CONNECTED)

const hasHandedOff = computed(() => 
  conversationState.value === ConversationState.HANDOFF_REQUESTED || 
  conversationState.value === ConversationState.STAFF_CONNECTED
)

/** Header status text */
const headerStatusText = computed(() => {
  switch (conversationState.value) {
    case ConversationState.AI: 
    case ConversationState.SHOW_NAME_PROMPT:
      return 'AI ASSISTANT'
    case ConversationState.HANDOFF_CONNECTING:
    case ConversationState.HANDOFF_REQUESTED: 
      return 'ĐANG KẾT NỐI NHÂN VIÊN'
    case ConversationState.STAFF_CONNECTED: 
      return 'CUSTOMER CARE'
  }
})

/** Header status dot color */
const headerStatusColor = computed(() => {
  switch (conversationState.value) {
    case ConversationState.AI: 
    case ConversationState.SHOW_NAME_PROMPT:
      return 'bg-black'
    case ConversationState.HANDOFF_CONNECTING:
    case ConversationState.HANDOFF_REQUESTED: 
      return 'bg-amber-500 animate-pulse'
    case ConversationState.STAFF_CONNECTED: 
      return 'bg-emerald-500'
  }
})

// ── Message helpers ──────────────────────────────────

function addLocalMessage(role: SenderRole, content: string, name = '') {
  messages.value.push({
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    senderRole: role,
    senderName: name,
    content,
    timestamp: new Date(),
    isLocal: true,
  })
}

function addSystemMessage(content: string) {
  addLocalMessage(SenderRole.System, content, 'System')
}

// ── Export ────────────────────────────────────────────

export function useChatConversation() {
  return {
    // State
    conversationState: readonly(conversationState),
    messages,
    roomId,
    customerInfo,
    isChatOpen,
    // Loading
    isSending,
    isAiThinking,
    // Error
    errorState,
    // Computed
    isInAiMode,
    isShowingNamePrompt,
    isHandoffConnecting,
    isHandoffRequested,
    isStaffConnected,
    hasHandedOff,
    headerStatusText,
    headerStatusColor,
    // Methods
    addLocalMessage,
    addSystemMessage,
    // Raw refs for internal mutation by the overlay controller
    _conversationState: conversationState,
  }
}
