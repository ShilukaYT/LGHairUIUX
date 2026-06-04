<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { X, Search, Plus, Trash2, UserPlus } from 'lucide-vue-next'; // Icon

const props = defineProps({
    isOpen: Boolean,
    stylists: Array // Nhận danh sách thợ từ component cha truyền vào
});

const emit = defineEmits(['close', 'success']);

// Dữ liệu form gửi lên API
const form = ref({
    tenKhach: 'Khách vãng lai',
    sdt: '',
    maStylist: '',
    services: []
});

const isSubmitting = ref(false);
const serviceSearch = ref('');
const allServices = ref([]);
const showDropdown = ref(false);

// Reset form mỗi khi mở modal
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        form.value = { tenKhach: 'Khách vãng lai', sdt: '', maStylist: '', services: [] };
        serviceSearch.value = '';
        fetchServices(); // Tải danh sách dịch vụ mỗi khi mở
    }
});

// Lấy danh sách dịch vụ từ API
const fetchServices = async () => {
    try {
        const res = await axios.get('https://localhost:7196/api/CheckIn/all-services-combos');
        allServices.value = res.data;
    } catch (error) {
        console.error("Lỗi tải dịch vụ:", error);
    }
};

// Lọc dịch vụ theo ô tìm kiếm (Fix lỗi chữ hoa/chữ thường)
const filteredServices = computed(() => {
    const q = serviceSearch.value.toLowerCase().trim();
    
    // Quét tìm kiếm (hỗ trợ cả Name và name)
    let list = allServices.value.filter(s => {
        const tenDichVu = s.name || s.Name || '';
        return tenDichVu.toLowerCase().includes(q);
    });
    
    // Bỏ qua những dịch vụ đã được chọn vào giỏ
    const selectedIds = new Set(form.value.services.map(s => s.Id));
    return list.filter(item => !selectedIds.has(item.id || item.Id)).slice(0, 5); 
});

// Thêm dịch vụ vào giỏ
const addService = (s) => {
    form.value.services.push({ 
        Id: s.id || s.Id, 
        Ten: s.name || s.Name, 
        Gia: s.price || s.Price,
        // HỨNG DỮ LIỆU GIÁ GỐC
        OriginalPrice: s.originalPrice || s.OriginalPrice || s.price || s.Price
    });
    serviceSearch.value = '';
    showDropdown.value = false;
};

// Tính tổng tiền
const tongTien = computed(() => {
    return form.value.services.reduce((sum, item) => sum + item.Gia, 0);
});

// Gửi dữ liệu lên API C#
const submitWalkIn = async () => {
    if (form.value.services.length === 0) {
        Swal.fire('Thiếu thông tin', 'Vui lòng chọn ít nhất 1 dịch vụ!', 'warning');
        return;
    }
    if (!form.value.maStylist) {
        Swal.fire('Thiếu thông tin', 'Vui lòng chọn Stylist phục vụ!', 'warning');
        return;
    }

    isSubmitting.value = true;
    try {
        const url = "https://localhost:7196/api/CheckIn/create-walkin";
        const res = await axios.post(url, form.value);

        Swal.fire({
            title: 'Thành công!',
            text: res.data.message,
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
        });
        
        emit('success'); // Báo cho Checkin.vue biết để tải lại bảng
    } catch (error) {
        Swal.fire('Lỗi', error.response?.data || 'Không thể tạo đơn.', 'error');
    } finally {
        isSubmitting.value = false;
    }
};

const closeModal = () => emit('close');
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" @click.self="closeModal">
        <div class="bg-white w-full max-w-lg rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div class="p-6 border-b flex justify-between items-center bg-slate-50">
                <h3 class="font-bold flex items-center gap-2 text-lg">
                    <UserPlus class="w-6 h-6 text-indigo-600"/> Tiếp nhận Khách Vãng Lai
                </h3>
                <button @click="closeModal" class="p-2 bg-white rounded-full hover:bg-slate-200 transition">
                    <X class="w-5 h-5 text-slate-400"/>
                </button>
            </div>
            
            <div class="p-6 space-y-5">
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-slate-500 uppercase">Tên khách</label>
                        <input v-model="form.tenKhach" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                    </div>
                    <div class="space-y-1">
                        <label class="text-xs font-bold text-slate-500 uppercase">Số điện thoại (Tuỳ chọn)</label>
                        <input v-model="form.sdt" placeholder="Trống nếu khách không cho" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                    </div>
                </div>

                <div class="space-y-1">
                    <label class="text-xs font-bold text-slate-500 uppercase">Chọn thợ làm *</label>
                    <select v-model="form.maStylist" class="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-indigo-500 outline-none cursor-pointer">
                        <option value="" disabled>-- Chọn Stylist --</option>
                        <option v-for="s in stylists" :key="s.id" :value="s.id">{{ s.name }}</option>
                    </select>
                </div>

                <div class="space-y-1 relative">
                    <label class="text-xs font-bold text-slate-500 uppercase">Dịch vụ yêu cầu *</label>
                    <div class="relative">
                        <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
                        <input v-model="serviceSearch" @focus="showDropdown = true" placeholder="Tìm dịch vụ..." class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 p-3 text-sm font-bold focus:border-indigo-500 outline-none" />
                    </div>
                    
                    <div v-if="showDropdown && filteredServices.length > 0" class="absolute top-full w-full bg-white border border-slate-100 rounded-xl shadow-xl z-10 mt-1 max-h-48 overflow-y-auto">
                        <div v-for="s in filteredServices" :key="s.id || s.Id" @click="addService(s)" class="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition">
                            <span class="font-bold text-sm text-slate-700">{{ s.name || s.Name }}</span>
                            
                            <div class="flex items-center gap-2">
                                <span v-if="(s.originalPrice || s.OriginalPrice) > (s.price || s.Price)" 
                                      class="text-slate-400 line-through text-xs font-semibold">
                                    {{ (s.originalPrice || s.OriginalPrice).toLocaleString() }}đ
                                </span>
                                <span class="text-indigo-600 font-black text-sm">
                                    {{ (s.price || s.Price).toLocaleString() }}đ
                                </span>
                            </div>

                        </div>
                        <div @click="showDropdown = false" class="p-2 text-center text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer border-t">ĐÓNG</div>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2 border border-slate-100">
                    <div v-if="form.services.length === 0" class="text-center text-xs font-bold text-slate-400 py-3 uppercase">Chưa chọn dịch vụ nào</div>
                    
                    <div v-for="(s, i) in form.services" :key="i" class="flex justify-between items-center bg-white p-2.5 rounded-lg text-sm shadow-sm border border-slate-100">
                        <span class="font-bold text-slate-700">{{ s.Ten }}</span>
                        
                        <div class="flex items-center gap-3">
                            <div class="flex items-center gap-2">
                                <span v-if="s.OriginalPrice && s.OriginalPrice > s.Gia" 
                                      class="text-slate-400 line-through text-xs font-semibold">
                                    {{ s.OriginalPrice.toLocaleString() }}đ
                                </span>
                                <span class="font-black">{{ s.Gia.toLocaleString() }}đ</span>
                            </div>

                            <button @click="form.services.splice(i, 1)" class="text-rose-400 hover:text-rose-600 bg-rose-50 p-1.5 rounded-md">
                                <Trash2 class="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-between items-center pt-2">
                    <span class="font-bold text-slate-500 uppercase text-xs">Tổng tiền dự kiến</span>
                    <span class="font-black text-xl text-slate-900">{{ tongTien.toLocaleString() }}đ</span>
                </div>
            </div>

            <div class="p-6 bg-slate-50 border-t flex gap-3">
                <button @click="closeModal" class="flex-1 bg-white border border-slate-200 text-slate-600 p-3.5 rounded-xl font-bold text-sm hover:bg-slate-100 transition" :disabled="isSubmitting">
                    Hủy
                </button>
                <button @click="submitWalkIn" class="flex-[2] bg-indigo-600 text-white p-3.5 rounded-xl font-black text-sm uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition disabled:opacity-70 flex justify-center items-center" :disabled="isSubmitting">
                    {{ isSubmitting ? 'Đang tạo...' : 'Tạo Lịch Nhanh' }}
                </button>
            </div>
        </div>
    </div>
</template>