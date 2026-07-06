import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// Cấu hình Firebase cho Project thứ hai (dành riêng cho Admin Notifications)
// Bạn cần thay thế các giá trị bên dưới bằng cấu hình thật từ Firebase Console của bạn.
const adminFirebaseConfig = {
  apiKey: "AIzaSyB6FrbFxXAW6H8cbvQi3dK38EGQgRlqme4",
  authDomain: "lghairadmin.firebaseapp.com",
  projectId: "lghairadmin",
  storageBucket: "lghairadmin.firebasestorage.app",
  messagingSenderId: "708757696598",
  appId: "1:708757696598:web:be3e3a24ace65bcbd88bf7",
  measurementId: "G-YTS951593E"
};


// Khởi tạo app thứ hai với tên 'adminApp' để không bị xung đột với app mặc định (Chat)
const adminApp = initializeApp(adminFirebaseConfig, 'adminApp')
const adminDb = getFirestore(adminApp)

export { adminDb }
