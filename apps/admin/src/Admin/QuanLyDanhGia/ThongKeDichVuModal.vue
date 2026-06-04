<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { BarChart3, X, Star, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-vue-next'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'


const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close'])

const isLoading = ref(false)
const rawStats = ref<any[]>([])

// API THỐNG KÊ TỪ BACKEND
const API_URL = 'https://localhost:7196/api/QuanLyDanhGiaDichVu/thong-ke'

const loadData = async () => {
    isLoading.value = true
    try {
        const res = await axios.get(API_URL)
        rawStats.value = res.data
    } catch (error) {
        console.error("Không thể load dữ liệu thống kê:", error)
    } finally {
        isLoading.value = false
    }
}

watch(() => props.isOpen, (val) => { if (val) loadData() })

// Phân loại dữ liệu
const goodServices = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 4))
const normalServices = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 3 && s.diemTrungBinh < 4))
const badServices = computed(() => rawStats.value.filter(s => s.diemTrungBinh < 3))

// Cấu hình 3 Tab để giao diện tự động vẽ (Thay thế cho lỗi script thứ 2 lúc nãy)
const tabConfigs = computed(() => [
    {
        value: 'good',
        data: goodServices.value,
        config: { color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'dịch vụ Tốt' }
    },
    {
        value: 'normal',
        data: normalServices.value,
        config: { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Trung bình' }
    },
    {
        value: 'bad',
        data: badServices.value,
        config: { color: 'text-red-600', bg: 'bg-red-50', label: 'Cần cải thiện' }
    }
])
</script>

<template>
    <div v-if="isOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <div class="bg-white rounded-[2.5rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            
            <div class="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                <div class="flex items-center gap-5">
                    <div class="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                        <BarChart3 class="w-7 h-7" />
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-slate-900 tracking-tight">Xếp hạng Hiệu năng Dịch vụ</h2>
                        <p class="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Tính toán trực tiếp từ Database C#</p>
                    </div>
                </div>
                <button @click="emit('close')" class="w-12 h-12 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all border border-slate-100">
                    <X class="w-6 h-6" />
                </button>
            </div>

            <div class="flex-1 overflow-hidden flex flex-col bg-slate-50/30 p-8">
                <Tabs default-value="good" class="flex-1 flex flex-col">
                    <TabsList class="grid grid-cols-3 w-full max-w-2xl mx-auto mb-8 bg-slate-100 p-1.5 rounded-2xl h-14">
                        <TabsTrigger value="good" class="rounded-xl font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm transition-all">
                            <TrendingUp class="w-4 h-4 mr-2" /> Tốt (4-5⭐)
                        </TabsTrigger>
                        <TabsTrigger value="normal" class="rounded-xl font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-amber-600 data-[state=active]:shadow-sm transition-all">
                            <Minus class="w-4 h-4 mr-2" /> Trung bình (3-4⭐)
                        </TabsTrigger>
                        <TabsTrigger value="bad" class="rounded-xl font-bold text-sm data-[state=active]:bg-white data-[state=active]:text-red-600 data-[state=active]:shadow-sm transition-all">
                            <TrendingDown class="w-4 h-4 mr-2" /> Tệ (1-2⭐)
                        </TabsTrigger>
                    </TabsList>

                    <div class="flex-1 overflow-auto custom-scroll bg-white rounded-3xl border border-slate-100 shadow-sm relative">
                        <div v-if="isLoading" class="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center">
                            <Loader2 class="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>

                        <TabsContent v-for="tab in tabConfigs" :key="tab.value" :value="tab.value" class="m-0">
                            <Table>
                                <TableHeader>
                                    <TableRow class="bg-slate-50/50 hover:bg-slate-50 border-none">
                                        <TableHead class="w-[80px] pl-8 font-black text-[10px] text-slate-400 uppercase tracking-widest">Hạng</TableHead>
                                        <TableHead class="font-black text-[10px] text-slate-400 uppercase tracking-widest">Tên Dịch Vụ</TableHead>
                                        <TableHead class="w-[150px] text-center font-black text-[10px] text-slate-400 uppercase tracking-widest">Trung bình</TableHead>
                                        <TableHead class="w-[150px] text-right pr-8 font-black text-[10px] text-slate-400 uppercase tracking-widest">Trạng thái</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow v-for="(item, index) in tab.data" :key="item.tenDichVu" class="border-b border-slate-50 hover:bg-slate-50/80 transition-all">
                                        <TableCell class="pl-8 py-5">
                                            <span :class="['w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm', index === 0 ? 'bg-yellow-400 text-white shadow-md' : 'bg-slate-100 text-slate-400']">
                                                {{ index + 1 }}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <div class="font-bold text-slate-800 text-base">{{ item.tenDichVu }}</div>
                                            <div class="text-xs font-semibold text-slate-400 mt-0.5">{{ item.luotDanhGia }} lượt bình luận</div>
                                        </TableCell>
                                        <TableCell class="text-center">
                                            <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-100 font-black text-slate-700">
                                                {{ item.diemTrungBinh }} <Star class="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                            </div>
                                        </TableCell>
                                        <TableCell class="text-right pr-8">
                                            <span :class="['px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest', tab.config.bg, tab.config.color]">
                                                {{ tab.config.label }}
                                            </span>
                                        </TableCell>
                                    </TableRow>

                                    <TableRow v-if="tab.data.length === 0">
                                        <TableCell colspan="4" class="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-xs">
                                            Chưa có dịch vụ nào ở mức này
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TabsContent>

                    </div>
                </Tabs>
            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 4px; }
.custom-scroll::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 10px; }
</style>