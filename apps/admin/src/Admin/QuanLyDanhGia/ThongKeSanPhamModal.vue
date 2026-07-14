<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { BarChart3, X, Star, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close'])

const isLoading = ref(false)
const rawStats = ref<any[]>([])
const activeTab = ref('good')

const loadData = async () => {
    isLoading.value = true
    try {
        const res = await axios.get('https://localhost:7196/api/QuanLyDanhGiaSanPham/thong-ke')
        
        // Hỗ trợ cả PascalCase từ Backend C# và camelCase để tránh lỗi cấu hình Serializer JSON
        rawStats.value = res.data.map((item: any) => ({
            tenSanPham: item.tenSanPham || item.TenSanPham || 'Sản phẩm khác',
            diemTrungBinh: item.diemTrungBinh !== undefined ? item.diemTrungBinh : (item.DiemTrungBinh || 0),
            luotDanhGia: item.luotDanhGia !== undefined ? item.luotDanhGia : (item.LuotDanhGia || 0)
        }))
    } catch (error) {
        console.error("Không thể load dữ liệu thống kê sản phẩm:", error)
    } finally {
        isLoading.value = false
    }
}

watch(() => props.isOpen, (val) => { if (val) loadData() })

// Phân loại dữ liệu
const goodProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 4))
const normalProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 3 && s.diemTrungBinh < 4))
const badProducts = computed(() => rawStats.value.filter(s => s.diemTrungBinh < 3))

// Cấu hình 3 Tab để giao diện tự động vẽ
const tabConfigs = computed(() => [
    {
        value: 'good',
        data: goodProducts.value,
        config: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Sản phẩm tốt' }
    },
    {
        value: 'normal',
        data: normalProducts.value,
        config: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Trung bình' }
    },
    {
        value: 'bad',
        data: badProducts.value,
        config: { color: 'text-red-600', bg: 'bg-red-50', label: 'Cần cải thiện' }
    }
])
</script>

<template>
    <Teleport to="body">
        <div v-if="isOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4" style="z-index: 999999 !important;">
            <div class="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                
                <div class="border-b border-slate-100 flex justify-between items-center bg-white" style="padding: 2rem !important;">
                    <div class="flex items-center gap-5">
                        <div class="w-14 h-14 bg-[#1677ff] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#1677ff]/15">
                            <BarChart3 class="w-7 h-7" />
                        </div>
                        <div>
                            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Xếp hạng Hiệu năng Sản phẩm</h2>
                        </div>
                    </div>
                    <button @click="emit('close')" class="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-100">
                        <X class="w-6 h-6" />
                    </button>
                </div>

                <div class="flex-1 overflow-hidden flex flex-col bg-slate-50/30" style="padding: 2rem !important;">
                    <div class="flex-1 flex flex-col">
                        <!-- Tab switcher buttons -->
                        <div class="grid grid-cols-3 w-full max-w-2xl mx-auto mb-8 bg-slate-100 p-1.5 rounded-2xl h-14 items-center">
                            <button 
                                v-for="tab in tabConfigs" 
                                :key="tab.value"
                                @click="activeTab = tab.value"
                                :class="['rounded-xl font-bold text-sm h-11 flex items-center justify-center transition-all cursor-pointer border-none outline-none', 
                                    activeTab === tab.value 
                                        ? 'bg-white shadow-sm ' + (tab.value === 'good' ? 'text-emerald-600' : tab.value === 'normal' ? 'text-amber-600' : 'text-red-600') 
                                        : 'text-slate-500 hover:text-slate-800'
                                ]"
                            >
                                <TrendingUp v-if="tab.value === 'good'" class="w-4 h-4 mr-2" />
                                <Minus v-else-if="tab.value === 'normal'" class="w-4 h-4 mr-2" />
                                <TrendingDown v-else class="w-4 h-4 mr-2" />
                                {{ tab.value === 'good' ? 'Tốt (4-5⭐)' : tab.value === 'normal' ? 'Trung bình (3-4⭐)' : 'Tệ (1-2⭐)' }}
                            </button>
                        </div>

                        <div class="flex-1 overflow-auto custom-scroll bg-white rounded-3xl border border-slate-100 shadow-sm relative">
                            <div v-if="isLoading" class="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                                <Loader2 class="w-8 h-8 text-[#1677ff] animate-spin" />
                            </div>

                            <div v-for="tab in tabConfigs" :key="tab.value" v-show="activeTab === tab.value" style="padding: 1.5rem !important;">
                                <Table class="w-full text-xs">
                                    <TableHeader>
                                        <TableRow class="bg-slate-55 border-none bg-slate-50/50 hover:bg-slate-50">
                                            <TableHead class="w-[80px] font-black text-[10px] text-slate-400 uppercase tracking-widest">Hạng</TableHead>
                                            <TableHead class="font-black text-[10px] text-slate-400 uppercase tracking-widest">Tên Sản Phẩm</TableHead>
                                            <TableHead class="w-[150px] text-center font-black text-[10px] text-slate-400 uppercase tracking-widest">Trung bình</TableHead>
                                            <TableHead class="w-[150px] text-right pr-4 font-black text-[10px] text-slate-400 uppercase tracking-widest">Trạng thái</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        <TableRow v-for="(item, index) in tab.data" :key="item.tenSanPham" class="border-b border-slate-50 hover:bg-slate-50/80 transition-all">
                                            <TableCell class="py-5">
                                                <span :class="['w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm', index === 0 ? 'bg-yellow-400 text-white shadow-md' : 'bg-slate-100 text-slate-400']">
                                                    {{ index + 1 }}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <div class="font-bold text-slate-800 text-base">{{ item.tenSanPham }}</div>
                                                <div class="text-xs font-semibold text-slate-400 mt-0.5">{{ item.luotDanhGia }} lượt bình luận</div>
                                            </TableCell>
                                            <TableCell class="text-center">
                                                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 font-black text-slate-700">
                                                    {{ item.diemTrungBinh }} <Star class="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                                </div>
                                            </TableCell>
                                            <TableCell class="text-right pr-4">
                                                <span :class="['px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest', tab.config.bg, tab.config.color]">
                                                    {{ tab.config.label }}
                                                </span>
                                            </TableCell>
                                        </TableRow>

                                        <TableRow v-if="tab.data.length === 0">
                                            <TableCell colspan="4" class="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-xs bg-white">
                                                Chưa có sản phẩm nào ở mức này
                                            </TableCell>
                                        </TableRow>
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
</style>
