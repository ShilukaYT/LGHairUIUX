<template>
    <div class="modal-overlay" @click.self="closeModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Quét Mã QR</h3>
                <button @click="closeModal" class="btn-close">×</button>
            </div>

            <div id="reader" class="qr-reader"></div>

            <p class="hint-text">Đưa mã QR vào giữa khung hình để quét</p>
        </div>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { Html5Qrcode } from 'html5-qrcode';
import Swal from 'sweetalert2';

const emit = defineEmits(['scan-success', 'close']);
const html5QrcodeScanner = ref(null);
const isProcessing = ref(false);

// 1. Hàm dừng camera (Sửa thành async để đợi tắt hẳn)
const stopScanner = async () => {
    if (html5QrcodeScanner.value && html5QrcodeScanner.value.isScanning) {
        try {
            await html5QrcodeScanner.value.stop();
            html5QrcodeScanner.value.clear(); // Dọn dẹp vùng chứa 'reader'
            html5QrcodeScanner.value = null;
        } catch (err) {
            console.error("Lỗi khi dừng camera:", err);
        }
    }
};

// File: QrScannerModal.vue

const startScanner = async () => {
    html5QrcodeScanner.value = new Html5Qrcode("reader");
    try {
        await html5QrcodeScanner.value.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            async (decodedText) => {
                if (isProcessing.value) return;
                isProcessing.value = true;

                // 1. DỪNG CAMERA & ĐÓNG CỬA SỔ NGAY LẬP TỨC
                await stopScanner(); // Tắt luồng camera
                emit('close');       // Báo cho Checkin.vue đóng hẳn Modal

                // 2. HIỆN THÔNG BÁO XỊN (Lúc này modal đã biến mất, thông báo hiện giữa màn hình chính)
                Swal.fire({
                    title: 'THÀNH CÔNG!',
                    html: `Đã nhận diện mã: <b style="color: #4F46E5;">#${decodedText}</b><br><small>Đang đồng bộ dữ liệu...</small>`,
                    icon: 'success',
                    timer: 1500, // Chỉ cần 1.5 giây là đủ đẹp
                    showConfirmButton: false,
                    timerProgressBar: true,
                    allowOutsideClick: false
                });

                // 3. GỬI DỮ LIỆU VỀ TRANG CHA ĐỂ LOAD API LUÔN
                // Không cần chờ đợi Swal đóng mới emit, cho load ngầm luôn cho nhanh
                emit('scan-success', decodedText);
                
                isProcessing.value = false;
            }
        );
    } catch (err) {
        console.error("Lỗi camera:", err);
        isProcessing.value = false;
    }
};
const closeModal = async () => {
    await stopScanner();
    emit('close'); 
};

onMounted(() => {
    startScanner();
});

onUnmounted(async () => {
    await stopScanner();
});
</script>

<style scoped>
/* CSS cho cửa sổ nổi (Popup/Modal) */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    /* Nền đen mờ */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    /* Luôn nằm trên cùng */
}

.modal-content {
    background: #fff;
    padding: 20px;
    border-radius: 16px;
    width: 90%;
    max-width: 400px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    border: 1px solid #e2e8f0;
    transition: background-color 0.3s, border-color 0.3s;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
}

.btn-close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #888;
}

.qr-reader {
    width: 100%;
    border-radius: 8px;
    overflow: hidden;
}

.hint-text {
    text-align: center;
    margin-top: 15px;
    color: #666;
    font-size: 14px;
}

/* Dark mode overrides using Vuetify's theme class */
.v-theme--dark .modal-content {
    background: #1e1e2d !important;
    border-color: #2d2d3d !important;
    color: #ffffff !important;
}

.v-theme--dark .modal-header h3 {
    color: #ffffff !important;
}

.v-theme--dark .btn-close {
    color: #a0aec0 !important;
}

.v-theme--dark .hint-text {
    color: #a0aec0 !important;
}
</style>