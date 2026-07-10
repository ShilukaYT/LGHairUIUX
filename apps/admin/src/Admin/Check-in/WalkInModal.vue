<script setup>
import { ref, computed, watch } from 'vue';
import axios from 'axios';
import Swal from 'sweetalert2';
import { X, Search, Trash2, UserPlus } from 'lucide-vue-next'; // Icon

const props = defineProps({
    isOpen: Boolean,
    stylists: Array
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
const allServices = ref([]);
const selectedServiceId = ref(null);

const stylistItems = computed(() => {
    return (props.stylists || []).map(s => ({
        title: s.name,
        value: s.id
    }));
});

const serviceItems = computed(() => {
    const selectedIds = new Set(form.value.services.map(s => s.Id));
    return (allServices.value || [])
        .filter(s => !selectedIds.has(s.id || s.Id))
        .map(s => ({
            title: `${s.name || s.Name} - ${(s.price || s.Price).toLocaleString()}đ`,
            value: s.id || s.Id
        }));
});

// Reset form mỗi khi mở modal
watch(() => props.isOpen, (newVal) => {
    if (newVal) {
        form.value = { tenKhach: 'Khách vãng lai', sdt: '', maStylist: '', services: [] };
        selectedServiceId.value = null;
        fetchServices();
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

const onServiceSelect = (id) => {
    if (!id) return;
    const service = allServices.value.find(s => (s.id || s.Id) === id);
    if (service) {
        addService(service);
    }
    // Reset selection to allow searching again
    selectedServiceId.value = null;
};

// Thêm dịch vụ vào giỏ
const addService = (s) => {
    form.value.services.push({ 
        Id: s.id || s.Id, 
        Ten: s.name || s.Name, 
        Gia: s.price || s.Price,
        OriginalPrice: s.originalPrice || s.OriginalPrice || s.price || s.Price
    });
};

// Tính tổng tiền
const tongTien = computed(() => {
    return form.value.services.reduce((sum, item) => sum + item.Gia, 0);
});

// Gửi dữ liệu lên API
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
        
        emit('success');
    } catch (error) {
        Swal.fire('Lỗi', error.response?.data || 'Không thể tạo đơn.', 'error');
    } finally {
        isSubmitting.value = false;
    }
};

const closeModal = () => emit('close');
</script>

<template>
    <v-dialog :model-value="isOpen" @update:model-value="val => !val && closeModal()" max-width="600px" persistent>
        <v-card class="rounded-xl">
            <!-- Header -->
            <v-card-title class="d-flex align-center justify-space-between pa-5 border-b">
                <div class="d-flex align-center gap-2 font-weight-bold text-h6 text-high-emphasis">
                    <UserPlus class="w-6 h-6 text-primary header-icon" />
                    Tiếp nhận Khách Vãng Lai
                </div>
                <v-btn icon variant="text" density="comfortable" @click="closeModal">
                    <X class="w-5 h-5 text-medium-emphasis" />
                </v-btn>
            </v-card-title>

            <!-- Content -->
            <v-card-text class="pa-6">
                <v-row>
                    <!-- Tên khách -->
                    <v-col cols="12" sm="6" class="py-1">
                        <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">Tên khách *</label>
                        <v-text-field
                            v-model="form.tenKhach"
                            variant="outlined"
                            density="comfortable"
                            placeholder="Nhập tên khách"
                            hide-details
                            class="rounded-lg"
                        />
                    </v-col>

                    <!-- Số điện thoại -->
                    <v-col cols="12" sm="6" class="py-1">
                        <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">Số điện thoại (Tùy chọn)</label>
                        <v-text-field
                            v-model="form.sdt"
                            variant="outlined"
                            density="comfortable"
                            placeholder="Trống nếu khách không cho"
                            hide-details
                            class="rounded-lg"
                        />
                    </v-col>

                    <!-- Chọn Stylist -->
                    <v-col cols="12" class="py-2">
                        <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">Chọn thợ làm *</label>
                        <v-select
                            v-model="form.maStylist"
                            :items="stylistItems"
                            placeholder="-- Chọn Stylist --"
                            variant="outlined"
                            density="comfortable"
                            hide-details
                            class="rounded-lg"
                        />
                    </v-col>

                    <!-- Tìm dịch vụ -->
                    <v-col cols="12" class="py-2">
                        <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mb-1.5 tracking-wider">Dịch vụ yêu cầu *</label>
                        <v-autocomplete
                            v-model="selectedServiceId"
                            :items="serviceItems"
                            placeholder="Tìm và chọn dịch vụ..."
                            variant="outlined"
                            density="comfortable"
                            hide-details
                            class="rounded-lg"
                            no-data-text="Không tìm thấy dịch vụ"
                            @update:model-value="onServiceSelect"
                        >
                            <template #prepend-inner>
                                <Search class="w-4 h-4 text-medium-emphasis mr-2" />
                            </template>
                        </v-autocomplete>
                    </v-col>
                </v-row>

                <!-- Giỏ dịch vụ -->
                <label class="text-[10px] font-weight-bold text-medium-emphasis uppercase d-block mt-4 mb-2 tracking-wider">Danh sách dịch vụ đã chọn ({{ form.services.length }})</label>
                <div class="selected-services-container rounded-xl pa-3 max-h-40 overflow-y-auto border">
                    <div v-if="form.services.length === 0" class="text-center text-xs font-weight-bold text-medium-emphasis py-4 uppercase">Chưa chọn dịch vụ nào</div>
                    
                    <div v-for="(s, i) in form.services" :key="i" class="selected-service-item d-flex justify-space-between align-center pa-3 rounded-lg text-sm shadow-sm mb-2">
                        <span class="font-weight-semibold item-name-text">{{ s.Ten }}</span>
                        <div class="d-flex align-center gap-3">
                            <div class="d-flex align-center gap-2">
                                <span v-if="s.OriginalPrice && s.OriginalPrice > s.Gia" class="text-slate-400 line-through text-xs font-semibold">
                                    {{ s.OriginalPrice.toLocaleString() }}đ
                                </span>
                                <span class="font-weight-bold text-body-2">{{ s.Gia.toLocaleString() }}đ</span>
                            </div>
                            <v-btn icon variant="text" color="red" density="compact" @click="form.services.splice(i, 1)">
                                <Trash2 class="w-4.5 h-4.5 text-error" />
                            </v-btn>
                        </div>
                    </div>
                </div>

                <!-- Tổng cộng -->
                <div class="d-flex align-center justify-space-between mt-5 pt-2">
                    <span class="font-weight-bold text-medium-emphasis uppercase text-caption tracking-wider">Tổng tiền dự kiến</span>
                    <span class="font-weight-black text-h6 text-high-emphasis">{{ tongTien.toLocaleString() }}đ</span>
                </div>
            </v-card-text>

            <!-- Actions -->
            <v-card-actions class="pa-5 border-t">
                <v-spacer />
                <v-btn variant="outlined" class="rounded-lg text-none px-5" @click="closeModal" :disabled="isSubmitting">
                    Hủy
                </v-btn>
                <v-btn color="primary" variant="flat" class="rounded-lg text-none px-6 primary-btn" @click="submitWalkIn" :disabled="isSubmitting">
                    {{ isSubmitting ? 'Đang tạo...' : 'Tạo Lịch Nhanh' }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<style scoped>
.selected-services-container {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
}
.v-theme--dark .selected-services-container {
    background-color: #151521;
    border-color: #2d2d3d;
}
.selected-service-item {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
}
.v-theme--dark .selected-service-item {
    background-color: #1e1e2d;
    border-color: #2d2d3d;
}
.gap-3 {
    gap: 12px;
}
.gap-2 {
    gap: 8px;
}

.item-name-text {
    color: #334155;
}
.v-theme--dark .item-name-text {
    color: #e2e8f0;
}

.primary-btn {
    background-color: #1a1a2e !important;
    color: #ffffff !important;
}
.v-theme--dark .primary-btn {
    background-color: #3b82f6 !important;
    color: #ffffff !important;
}

.header-icon {
    color: var(--v-theme-primary) !important;
}
</style>