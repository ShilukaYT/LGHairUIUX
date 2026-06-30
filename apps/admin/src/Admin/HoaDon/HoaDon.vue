<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { Search, FileDown, Eye, Filter, X, Printer } from 'lucide-vue-next'
import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

const API_BASE_URL = 'https://localhost:7196/api/admin/hoa-don'
const hoaDons = ref<any[]>([])
const isLoading = ref(false)
const searchQuery = ref('')

const filter = ref({
    tuNgay: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString('sv-SE'),
    denNgay: new Date().toLocaleDateString('sv-SE')
})

const fetchHoaDons = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(`${API_BASE_URL}/danh-sach`, { params: filter.value, withCredentials: true })
        if (res.data.success) hoaDons.value = res.data.data
    } catch (e) { console.error(e) }
    finally { isLoading.value = false }
}

const statusLabel = (status: number) => {
    const map: any = {
        0: { text: 'Đã Hủy', class: 'bg-rose-100 text-white-700' },
        1: { text: 'Đã cọc 10%', class: 'bg-amber-100 text-white-700' },
        2: { text: 'Đã thanh toán', class: 'bg-blue-100 text-white-700' },
        3: { text: 'Hoàn thành', class: 'bg-emerald-100 text-white-700' }
    }
    return map[status] || { text: 'N/A', class: 'bg-slate-100' }
}

const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('HoaDon')

    worksheet.addRow(['Mã HD', 'Khách hàng', 'Ngày tạo', 'Thành tiền', 'Trạng thái']).font = { bold: true }

    hoaDons.value.forEach(h => {
        worksheet.addRow([h.maHd, h.tenKhachHang, h.ngayTao, h.thanhTien, statusLabel(h.trangThai).text])
    })

    const buffer = await workbook.xlsx.writeBuffer()
    saveAs(new Blob([buffer]), `Bao_Cao_Hoa_Don.xlsx`)
}

const isModalOpen = ref(false)
const selectedHd = ref<any>(null)

const viewDetail = async (maHd: string) => {
    try {
        const res = await axios.get(`${API_BASE_URL}/chi-tiet/${maHd}`)
        if (res.data.success) {
            selectedHd.value = res.data.data
            isModalOpen.value = true
        }
    } catch (e) { alert("Không thể tải chi tiết hóa đơn") }
}

const printInvoice = () => {
    window.print() // Sẽ in vùng được định định nghĩa trong CSS @media print
}

onMounted(fetchHoaDons)
</script>

<template>
    <div class="p-6 space-y-6 bg-slate-50 min-h-screen">
        <div class="flex justify-between items-center">
            <h2 class="text-2xl font-bold text-slate-900 text-emerald-600">Quản Lý Hóa Đơn</h2>
            <button @click="exportExcel"
                class="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all">
                <FileDown class="w-4 h-4" /> Xuất Excel
            </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-5 rounded-2xl border shadow-sm">
            <input type="date" v-model="filter.tuNgay" @change="fetchHoaDons"
                class="h-11 px-4 rounded-xl border border-slate-200 text-sm">
            <input type="date" v-model="filter.denNgay" @change="fetchHoaDons"
                class="h-11 px-4 rounded-xl border border-slate-200 text-sm">
            <div class="relative">
                <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input v-model="searchQuery" placeholder="Mã HD hoặc tên khách..."
                    class="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm">
            </div>
        </div>

        <div class="bg-white rounded-2xl border shadow-xl overflow-hidden">
            <table class="w-full text-sm text-left">
                <thead class="bg-slate-50 border-b">
                    <tr>
                        <th class="p-4 font-bold text-slate-700">Mã HD</th>
                        <th class="p-4 font-bold text-slate-700">Khách hàng</th>
                        <th class="p-4 font-bold text-slate-700">Ngày tạo</th>
                        <th class="p-4 font-bold text-slate-700">Thành tiền</th>
                        <th class="p-4 font-bold text-slate-700 text-center">Trạng thái</th>
                        <th class="p-4 font-bold text-slate-700 text-center">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="hd in hoaDons" :key="hd.maHd"
                        class="border-b last:border-b-0 hover:bg-slate-50 transition-all">
                        <td class="p-4 font-bold text-slate-900">{{ hd.maHd }}</td>
                        <td class="p-4">{{ hd.tenKhachHang }}</td>
                        <td class="p-4 text-slate-500">{{ new Date(hd.ngayTao).toLocaleDateString() }}</td>
                        <td class="p-4 font-bold text-emerald-600">{{ hd.thanhTien?.toLocaleString() }}đ</td>
                        <td class="p-4 text-center">
                            <span :class="statusLabel(hd.trangThai).class"
                                class="px-3 py-1 rounded-full text-[10px] font-bold uppercase">
                                {{ statusLabel(hd.trangThai).text }}
                            </span>
                        </td>
                        <td class="p-4 text-center">
                            <button @click="viewDetail(hd.maHd)"
                                class="p-2 text-slate-400 hover:text-slate-900 transition-all">
                                <Eye class="w-5 h-5" />
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>

    <div v-if="isModalOpen"
        class="fixed inset-0 z-[120] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">

            <div class="p-6 border-b flex justify-between items-center bg-slate-50 print:hidden">
                <h3 class="font-bold text-xl">Chi Tiết Hóa Đơn</h3>
                <div class="flex gap-2">
                    <button @click="printInvoice"
                        class="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                        <Printer class="w-4 h-4" /> In Hóa Đơn
                    </button>
                    <button @click="isModalOpen = false" class="p-2 hover:bg-slate-200 rounded-full transition-all">
                        <X class="w-6 h-6" />
                    </button>
                </div>
            </div>

            <div id="invoice-print" class="p-8 space-y-6 text-slate-800">
                <div class="text-center border-b pb-6">
                    <h1 class="text-2xl font-black uppercase text-emerald-600">Minh Tâm Hair Salon</h1>
                    <p class="text-sm">Địa chỉ: 123 Đường ABC, Quận X, TP. HCM</p>
                    <p class="text-sm font-bold">Hotline: 0123.456.789</p>
                </div>

                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <p><strong>Mã HĐ:</strong> {{ selectedHd.maHd }}</p>
                        <p><strong>Ngày:</strong> {{ new Date(selectedHd.ngayTao).toLocaleString() }}</p>
                    </div>
                    <div class="text-right">
                        <p><strong>Khách hàng:</strong> {{ selectedHd.tenKh || 'Khách vãng lai' }}</p>
                        <p><strong>Nhân viên:</strong> {{ selectedHd.tenThuNgan }}</p>
                    </div>
                </div>

                <table class="w-full text-sm border-t border-b mt-4">
                    <thead class="bg-slate-50">
                        <tr class="text-left text-slate-500 uppercase text-[10px] font-black">
                            <th class="py-3 px-2">Dịch vụ / Combo</th>
                            <th class="py-3 px-2">Thợ thực hiện</th>
                            <th class="py-3 px-2 text-right">Đơn giá</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(item, index) in selectedHd.chiTietDichVu" :key="index"
                            class="border-t border-slate-100">
                            <td class="py-3 px-2 font-medium text-slate-900">
                                {{ item.tenHangMuc }}
                            </td>
                            <td class="py-3 px-2">
                                <span
                                    class="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border">
                                    {{ item.thoThucHien }}
                                </span>
                            </td>
                            <td class="py-3 px-2 text-right font-bold">
                                {{ item.gia?.toLocaleString() }}đ
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div class="space-y-2 text-right pt-4">
                    <p class="text-sm">Tạm tính: <strong>{{ selectedHd.tongTien?.toLocaleString() }}đ</strong></p>
                    <p v-if="selectedHd.giamGiaVip" class="text-sm text-rose-500">Giảm giá VIP: -{{
                        selectedHd.giamGiaVip }}%</p>
                    <p class="text-xl font-black text-emerald-600">Tổng thanh toán: {{
                        selectedHd.thanhTien?.toLocaleString() }}đ</p>
                </div>

                <div class="text-center italic text-xs pt-10 border-t">
                    <p>Cảm ơn quý khách đã tin tưởng Minh Tâm Hair!</p>
                    <p>Hẹn gặp lại quý khách lần tới.</p>
                </div>
            </div>
        </div>
    </div>
</template>
<style lang="css" scoped>
@media print {

    /* Ẩn tất cả mọi thứ */
    body * {
        visibility: hidden;
    }

    /* Chỉ hiện vùng hóa đơn và căn giữa trang */
    #invoice-print,
    #invoice-print * {
        visibility: visible;
    }

    #invoice-print {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 0;
        margin: 0;
    }

    /* Ẩn các nút bấm trong modal khi in */
    .print\:hidden {
        display: none !important;
    }
}
</style>