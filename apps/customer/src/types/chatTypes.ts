/** Conversation state machine */
export enum ConversationState {
  AI = 'AI',
  SHOW_NAME_PROMPT = 'SHOW_NAME_PROMPT',
  HANDOFF_CONNECTING = 'HANDOFF_CONNECTING',
  HANDOFF_REQUESTED = 'HANDOFF_REQUESTED',
  STAFF_CONNECTED = 'STAFF_CONNECTED',
}

/** Message sender roles */
export enum SenderRole {
  Customer = 'Customer',
  Staff = 'Staff',
  Bot = 'Bot',       // AI chatbot responses (local only)
  System = 'System', // System messages
}

/** Chat room status */
export enum RoomStatus {
  Active = 'Active',
  Closed = 'Closed',
}

// ── API Request/Response DTOs ──────

/** POST /api/Chatbot — Request */
export interface ChatbotRequest {
  message: string
}

/** POST /api/Chatbot — Response */
export interface ChatbotResponse {
  reply: string
}

/** POST /api/chat/room — Request */
export interface CreateRoomRequest {
  customerName: string
  customerEmail?: string
}

/** POST /api/chat/room — Response */
export interface CreateRoomResponse {
  roomId: string
  message: string
}

/** POST /api/chat/send — Request */
export interface SendMessageRequest {
  roomId: string
  senderRole: 'Customer' | 'Staff'
  senderName?: string
  content: string
}

/** POST /api/chat/send — Response */
export interface SendMessageResponse {
  message: string
}

/** POST /api/chat/toggle-status/{roomId} — Request */
export interface ToggleStatusRequest {
  status: RoomStatus
}

// ── Firebase/Internal Models ───────────

export interface FirestoreTimestamp {
  toDate: () => Date
  toMillis: () => number
  seconds: number
  nanoseconds: number
}

/** Tin nhắn trong conversation */
export interface ChatMessage {
  id: string
  senderRole: SenderRole
  senderName: string
  content: string
  timestamp: Date | FirestoreTimestamp
  isRead?: boolean
  isLocal?: boolean
}

/** ChatRoom document trong Firestore */
export interface ChatRoomDocument {
  customerName: string
  customerEmail: string
  lastMessage: string
  status: RoomStatus
  unreadCount: number
  createdAt: FirestoreTimestamp
  updatedAt: FirestoreTimestamp
  isCustomerTyping?: boolean
}

// ── Customer Info ────────────────────────────────────

export interface CustomerInfo {
  name: string
  email: string
}
