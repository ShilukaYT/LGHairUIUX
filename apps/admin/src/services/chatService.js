// src/services/chatService.js
import axios from 'axios'

// Base URL của Backend C# (khớp với cổng server đang chạy)
const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

const API_BASE = API + '/api/chat'

/**
 * Tạo phòng chat mới (Khách hàng gọi khi bắt đầu chat lần đầu)
 * @param {string} customerName
 * @param {string} customerEmail
 * @returns {Promise<{roomId: string}>}
 */
export const createChatRoom = async (customerName, customerEmail = '') => {
  const { data } = await axios.post(`${API_BASE}/room`, {
    customerName,
    customerEmail
  }, { withCredentials: true })
  return data
}

/**
 * Gửi tin nhắn vào phòng chat — cả Khách hàng lẫn Nhân viên đều gọi hàm này
 * @param {string} roomId
 * @param {'Customer'|'Staff'} senderRole
 * @param {string} senderName
 * @param {string} content
 */
export const sendMessage = async (roomId, senderRole, senderName, content) => {
  const { data } = await axios.post(`${API_BASE}/send`, {
    roomId,
    senderRole,
    senderName,
    content
  }, { withCredentials: true })
  return data
}

/**
 * Nhân viên đóng hoặc mở lại phòng chat
 * @param {string} roomId
 * @param {'Active'|'Closed'} status
 */
export const toggleRoomStatus = async (roomId, status) => {
  const { data } = await axios.post(`${API_BASE}/toggle-status/${roomId}`, {
    status
  }, { withCredentials: true })
  return data
}
