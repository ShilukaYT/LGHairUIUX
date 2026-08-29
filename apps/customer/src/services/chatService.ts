import axios from 'axios'
import type {
  ChatbotRequest, ChatbotResponse,
  CreateRoomRequest, CreateRoomResponse,
  SendMessageRequest, SendMessageResponse,
} from '@/types/chatTypes'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_CHAT = `${API}/api/chat`
const API_CHATBOT = `${API}/api/Chatbot`

/**
 * Gọi AI Chatbot (Ollama qua backend)
 * POST /api/Chatbot
 */
export async function getChatbotReply(message: string): Promise<string> {
  const payload: ChatbotRequest = { message }
  const response = await fetch(API_CHATBOT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Chatbot API error: ${response.status}`)
  }
  const data: ChatbotResponse = await response.json()
  return data.reply
}

/**
 * Tạo chat room mới
 * POST /api/chat/room
 */
export async function createRoom(request: CreateRoomRequest): Promise<CreateRoomResponse> {
  const { data } = await axios.post<CreateRoomResponse>(`${API_CHAT}/room`, request, {
    withCredentials: true,
  })
  return data
}

/**
 * Gửi tin nhắn vào room
 * POST /api/chat/send
 */
export async function sendMessageToRoom(request: SendMessageRequest): Promise<SendMessageResponse> {
  const { data } = await axios.post<SendMessageResponse>(`${API_CHAT}/send`, request, {
    withCredentials: true,
  })
  return data
}

/**
 * Đóng hoặc mở lại phòng chat
 * POST /api/chat/toggle-status/{roomId}
 */
export async function toggleRoomStatus(roomId: string, status: 'Closed' | 'Active'): Promise<void> {
  await axios.post(`${API_CHAT}/toggle-status/${roomId}`, { status }, {
    withCredentials: true,
  })
}
