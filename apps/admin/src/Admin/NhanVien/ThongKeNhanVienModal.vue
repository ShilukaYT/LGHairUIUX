<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { Award, X, Star, Loader2, TrendingUp, TrendingDown, Minus, Trophy, UserCheck, Users } from 'lucide-vue-next'
import { useTheme } from 'vuetify'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close'])

const isLoading = ref(false)
const rawStats = ref<any[]>([])
const allStaffList = ref<any[]>([])
const activeTab = ref<'all' | 'good' | 'normal' | 'bad'>('all')

import { useCustomizerStore } from '@/stores/customizer'

const customizer = useCustomizerStore()

// ── Theme State Detection (Light / Dark Mode Sync) ──
const isDarkMode = computed(() => {
  if (customizer?.actTheme === 'dark') return true
  try {
    const vuetifyTheme = useTheme()
    if (vuetifyTheme?.global?.name?.value === 'dark' || vuetifyTheme?.global?.current?.value?.dark) {
      return true
    }
  } catch (e) {}
  return localStorage.getItem('theme_selection') === 'dark' 
      || localStorage.getItem('actTheme') === 'dark'
      || document.documentElement.classList.contains('dark') 
      || document.body.classList.contains('v-theme--dark')
})

const API_STATS = 'https://localhost:7196/api/QuanLyDanhGiaDichVu/thong-ke-nhan-vien'
const API_STAFF = 'https://localhost:7196/api/NhanVien'

const loadData = async () => {
    isLoading.value = true
    try {
        const [resStats, resStaff] = await Promise.allSettled([
            axios.get(API_STATS),
            axios.get(API_STAFF)
        ])

        const statsData = resStats.status === 'fulfilled' ? (resStats.value.data || []) : []
        const staffData = resStaff.status === 'fulfilled' ? (resStaff.value.data || []) : []

        allStaffList.value = staffData

        const mergedMap = new Map<string, any>()

        staffData.forEach((st: any) => {
            const name = st.hoTenNv || st.HoTenNv || st.tenNv || ''
            if (name) {
                mergedMap.set(name.trim().toLowerCase(), {
                    maNv: st.maNv || st.MaNv || '',
                    tenNhanVien: name,
                    diemTrungBinh: 0,
                    luotDanhGia: 0,
                    tenChucVu: st.tenChucVu || st.TenChucVu || 'Nhân viên Salon'
                })
            }
        })

        statsData.forEach((st: any) => {
            const name = st.tenNhanVien || st.tenNv || st.HoTenNv || ''
            const key = name.trim().toLowerCase()
            if (mergedMap.has(key)) {
                const existing = mergedMap.get(key)
                existing.diemTrungBinh = Number(st.diemTrungBinh || 0)
                existing.luotDanhGia = Number(st.luotDanhGia || 0)
            } else if (name) {
                mergedMap.set(key, {
                    maNv: st.maNv || '',
                    tenNhanVien: name,
                    diemTrungBinh: Number(st.diemTrungBinh || 0),
                    luotDanhGia: Number(st.luotDanhGia || 0),
                    tenChucVu: 'Nhân viên Salon'
                })
            }
        })

        const fullList = Array.from(mergedMap.values())
        fullList.sort((a, b) => {
            if (b.diemTrungBinh !== a.diemTrungBinh) {
                return b.diemTrungBinh - a.diemTrungBinh
            }
            return b.luotDanhGia - a.luotDanhGia
        })

        rawStats.value = fullList
    } catch (error) {
        console.error("Lỗi khi tải bảng xếp hạng:", error)
    } finally {
        isLoading.value = false
    }
}

watch(() => props.isOpen, (val) => { 
    if (val) {
        activeTab.value = 'all'
        loadData() 
    }
})

const allStaffs = computed(() => rawStats.value)
const goodStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 4))
const normalStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 3 && s.diemTrungBinh < 4))
const badStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh < 3))

const currentTabStaffs = computed(() => {
    if (activeTab.value === 'all') return allStaffs.value
    if (activeTab.value === 'good') return goodStaffs.value
    if (activeTab.value === 'normal') return normalStaffs.value
    return badStaffs.value
})

const getRankBadgeInfo = (score: number, reviewsCount: number) => {
    if (reviewsCount === 0 || score === 0) {
        return {
            label: 'CHƯA ĐÁNH GIÁ',
            badgeClass: isDarkMode.value 
                ? 'bg-slate-800 text-slate-300 border-slate-700' 
                : 'bg-slate-100 text-slate-700 border-slate-300 font-bold'
        }
    }
    if (score >= 4) {
        return {
            label: 'XUẤT SẮC',
            badgeClass: isDarkMode.value 
                ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80 font-black' 
                : 'bg-emerald-100 text-emerald-800 border-emerald-400 font-black'
        }
    }
    if (score >= 3) {
        return {
            label: 'ĐẠT YÊU CẦU',
            badgeClass: isDarkMode.value 
                ? 'bg-amber-950/90 text-amber-300 border-amber-700/80 font-black' 
                : 'bg-amber-100 text-amber-800 border-amber-400 font-black'
        }
    }
    return {
        label: 'CẦN CẢI THIỆN',
        badgeClass: isDarkMode.value 
            ? 'bg-rose-950/90 text-rose-300 border-rose-700/80 font-black' 
            : 'bg-rose-100 text-rose-800 border-rose-400 font-black'
    }
}

const getInitials = (name: string) => {
    if (!name) return 'NV'
    const words = name.trim().split(/\s+/)
    if (words.length >= 2 && words[0] && words[1]) {
        return (words[0][0] + words[1][0]).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
}
</script>

<template>
    <div 
        v-if="isOpen" 
        class="fixed inset-0 z-[2500] flex items-center justify-center p-4 md:p-6 bg-slate-950/80 backdrop-blur-md transition-all"
        @click="emit('close')"
    >
        <div 
            class="relative w-full max-w-5xl rounded-xl border shadow-2xl overflow-hidden flex flex-col transition-all duration-300"
            :class="isDarkMode ? 'bg-[#1b1b28] border-slate-700/80 text-slate-100' : 'bg-white border-slate-300 text-slate-900'"
            @click.stop
        >
            <!-- Modal Header -->
            <div 
                class="px-8 py-6 border-b flex items-center justify-between relative overflow-hidden transition-colors"
                :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-100 border-slate-300'"
            >
                <div class="flex items-center gap-5">
                    <div class="w-13 h-13 rounded-xl bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold flex-shrink-0 shadow-xs">
                        <Trophy class="w-7 h-7" />
                    </div>
                    <div>
                        <h2 class="text-xl md:text-2xl font-black tracking-tight" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                            Bảng Xếp Hạng Toàn Bộ Nhân Viên
                        </h2>
                        <p class="text-xs md:text-sm mt-1 font-semibold" :class="isDarkMode ? 'text-slate-300' : 'text-slate-600'">
                            Hiển thị đầy đủ danh sách nhân viên hệ thống kèm điểm số và hạng thành tích
                        </p>
                    </div>
                </div>

                <button 
                    @click="emit('close')" 
                    class="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer border"
                    :class="isDarkMode ? 'text-slate-400 hover:text-white bg-slate-800/80 border-slate-700 hover:bg-slate-700' : 'text-slate-700 hover:text-slate-900 bg-white border-slate-300 hover:bg-slate-200'"
                >
                    <X class="w-5 h-5" />
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-8 flex flex-col gap-6 max-h-[82vh] overflow-y-auto custom-scroll">
                
                <!-- Filter Tabs ép màu chuẩn 100% rõ chữ cả Sáng và Tối -->
                <div 
                    class="grid grid-cols-2 lg:grid-cols-4 p-1.5 rounded-xl border gap-2 transition-colors"
                    :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-slate-200/80 border-slate-300'"
                >
                    <!-- Tab Tất cả -->
                    <button 
                        @click="activeTab = 'all'" 
                        class="h-12 rounded-lg text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border"
                        :style="activeTab === 'all' 
                            ? 'background-color: #0284c7 !important; color: #ffffff !important; border-color: #0284c7 !important;' 
                            : (isDarkMode ? 'background-color: transparent !important; color: #cbd5e1 !important; border-color: transparent !important;' : 'background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important;')"
                    >
                        <Users class="w-4 h-4" />
                        <span>Tất Cả ({{ allStaffs.length }})</span>
                    </button>

                    <!-- Tab Xuất sắc -->
                    <button 
                        @click="activeTab = 'good'" 
                        class="h-12 rounded-lg text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border"
                        :style="activeTab === 'good' 
                            ? 'background-color: #059669 !important; color: #ffffff !important; border-color: #059669 !important;' 
                            : (isDarkMode ? 'background-color: transparent !important; color: #cbd5e1 !important; border-color: transparent !important;' : 'background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important;')"
                    >
                        <TrendingUp class="w-4 h-4" />
                        <span>Xuất Sắc (4-5 ⭐)</span>
                        <span class="px-2 py-0.5 rounded-md text-xs font-mono font-black" :style="activeTab === 'good' ? 'background-color: #047857; color: #ffffff;' : 'background-color: #d1fae5; color: #065f46;'">
                            {{ goodStaffs.length }}
                        </span>
                    </button>

                    <!-- Tab Đạt yêu cầu -->
                    <button 
                        @click="activeTab = 'normal'" 
                        class="h-12 rounded-lg text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border"
                        :style="activeTab === 'normal' 
                            ? 'background-color: #f59e0b !important; color: #0f172a !important; border-color: #f59e0b !important;' 
                            : (isDarkMode ? 'background-color: transparent !important; color: #cbd5e1 !important; border-color: transparent !important;' : 'background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important;')"
                    >
                        <Minus class="w-4 h-4" />
                        <span>Đạt Yêu Cầu (3-4 ⭐)</span>
                        <span class="px-2 py-0.5 rounded-md text-xs font-mono font-black" :style="activeTab === 'normal' ? 'background-color: #d97706; color: #ffffff;' : 'background-color: #fef3c7; color: #92400e;'">
                            {{ normalStaffs.length }}
                        </span>
                    </button>

                    <!-- Tab Cần cải thiện -->
                    <button 
                        @click="activeTab = 'bad'" 
                        class="h-12 rounded-lg text-xs md:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer border"
                        :style="activeTab === 'bad' 
                            ? 'background-color: #e11d48 !important; color: #ffffff !important; border-color: #e11d48 !important;' 
                            : (isDarkMode ? 'background-color: transparent !important; color: #cbd5e1 !important; border-color: transparent !important;' : 'background-color: #ffffff !important; color: #0f172a !important; border-color: #cbd5e1 !important;')"
                    >
                        <TrendingDown class="w-4 h-4" />
                        <span>Cần Cải Thiện (&lt;3 ⭐)</span>
                        <span class="px-2 py-0.5 rounded-md text-xs font-mono font-black" :style="activeTab === 'bad' ? 'background-color: #be123c; color: #ffffff;' : 'background-color: #ffe4e6; color: #9f1239;'">
                            {{ badStaffs.length }}
                        </span>
                    </button>
                </div>

                <!-- Modern Data Table -->
                <div 
                    class="rounded-xl border shadow-xs overflow-hidden transition-colors"
                    :class="isDarkMode ? 'bg-[#242436] border-slate-700/80' : 'bg-white border-slate-300'"
                >
                    <div v-if="isLoading" class="p-16 text-center text-xs font-extrabold text-sky-500 flex flex-col items-center justify-center gap-3">
                        <Loader2 class="w-8 h-8 animate-spin text-sky-500" />
                        <span>Đang đồng bộ danh sách toàn bộ nhân viên...</span>
                    </div>

                    <table v-else class="w-full text-left text-xs md:text-sm border-collapse min-w-[700px]">
                        <thead>
                            <tr :class="isDarkMode ? 'bg-[#1e1e2d] text-slate-100 border-b border-slate-700' : 'bg-slate-900 text-white'">
                                <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-28 text-center whitespace-nowrap">HẠNG</th>
                                <th class="py-4 px-6 font-extrabold uppercase tracking-wider whitespace-nowrap">NHÂN VIÊN</th>
                                <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 text-center whitespace-nowrap">ĐÁNH GIÁ TRUNG BÌNH</th>
                                <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-40 text-center whitespace-nowrap">LƯỢT ĐÁNH GIÁ</th>
                                <th class="py-4 px-6 font-extrabold uppercase tracking-wider w-44 text-center whitespace-nowrap">HẠNG THÀNH TÍCH</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y" :class="isDarkMode ? 'divide-slate-800/80' : 'divide-slate-200'">
                            <tr 
                                v-for="(item, index) in currentTabStaffs" 
                                :key="item.tenNhanVien"
                                class="transition-colors duration-150"
                                :class="isDarkMode ? 'hover:bg-slate-800/60 text-slate-100' : 'hover:bg-sky-50/60 text-slate-900'"
                            >
                                <!-- Hạng -->
                                <td class="py-4 px-6 text-center whitespace-nowrap">
                                    <span 
                                        v-if="index === 0 && item.luotDanhGia > 0" 
                                        class="inline-flex items-center justify-center px-3 py-1 rounded-md font-black text-xs bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-sm border border-amber-300"
                                    >
                                        🥇 HẠNG 1
                                    </span>
                                    <span 
                                        v-else-if="index === 1 && item.luotDanhGia > 0" 
                                        class="inline-flex items-center justify-center px-3 py-1 rounded-md font-black text-xs bg-slate-300 text-slate-900 shadow-2xs border border-slate-200"
                                    >
                                        🥈 HẠNG 2
                                    </span>
                                    <span 
                                        v-else-if="index === 2 && item.luotDanhGia > 0" 
                                        class="inline-flex items-center justify-center px-3 py-1 rounded-md font-black text-xs bg-amber-700 text-white shadow-2xs border border-amber-600"
                                    >
                                        🥉 HẠNG 3
                                    </span>
                                    <span 
                                        v-else 
                                        class="inline-flex items-center justify-center px-3 py-1 rounded-md font-extrabold text-xs"
                                        :class="isDarkMode ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-300'"
                                    >
                                        HẠNG {{ index + 1 }}
                                    </span>
                                </td>

                                <!-- Tên nhân viên -->
                                <td class="py-4 px-6">
                                    <div class="flex items-center gap-3">
                                        <div 
                                            class="w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs text-white bg-gradient-to-tr from-sky-500 to-blue-600 flex-shrink-0 shadow-2xs border"
                                            :class="isDarkMode ? 'border-slate-700' : 'border-slate-300'"
                                        >
                                            {{ getInitials(item.tenNhanVien) }}
                                        </div>
                                        <div>
                                            <div class="font-extrabold text-base" :class="isDarkMode ? 'text-white' : 'text-slate-900'">
                                                {{ item.tenNhanVien }}
                                            </div>
                                            <div class="text-xs font-semibold opacity-80 mt-0.5" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                                                Mã NV: <span class="font-mono font-bold text-sky-600">{{ item.maNv || 'N/A' }}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>

                                <!-- Điểm trung bình -->
                                <td class="py-4 px-6 text-center whitespace-nowrap">
                                    <div 
                                        v-if="item.luotDanhGia > 0"
                                        class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg border font-black text-sm"
                                        :class="isDarkMode ? 'bg-slate-800/90 border-slate-700 text-amber-300' : 'bg-amber-100 border-amber-300 text-amber-900'"
                                    >
                                        <span>{{ item.diemTrungBinh }}</span>
                                        <Star class="w-4 h-4 fill-amber-500 text-amber-500" />
                                    </div>
                                    <span v-else class="text-xs italic font-semibold text-slate-400">
                                        0.0 ⭐ (Chưa có)
                                    </span>
                                </td>

                                <!-- Lượt đánh giá -->
                                <td class="py-4 px-6 text-center whitespace-nowrap">
                                    <span class="font-extrabold text-sm" :class="isDarkMode ? 'text-slate-200' : 'text-slate-900'">
                                        {{ item.luotDanhGia }} <span class="text-xs font-semibold text-slate-500">lượt</span>
                                    </span>
                                </td>

                                <!-- Hạng thành tích -->
                                <td class="py-4 px-6 text-center whitespace-nowrap">
                                    <span 
                                        class="inline-block px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border"
                                        :class="getRankBadgeInfo(item.diemTrungBinh, item.luotDanhGia).badgeClass"
                                    >
                                        {{ getRankBadgeInfo(item.diemTrungBinh, item.luotDanhGia).label }}
                                    </span>
                                </td>
                            </tr>

                            <!-- Empty State -->
                            <tr v-if="currentTabStaffs.length === 0">
                                <td colspan="5" class="p-16 text-center text-xs font-bold italic" :class="isDarkMode ? 'text-slate-400' : 'text-slate-600'">
                                    <div class="flex flex-col items-center gap-2">
                                        <UserCheck class="w-7 h-7 text-slate-400" />
                                        <span>Chưa có nhân viên nào thuộc danh mục xếp hạng này</span>
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    </div>
</template>

<style scoped>
.custom-scroll::-webkit-scrollbar { width: 6px; }
.custom-scroll::-webkit-scrollbar-track { background: transparent; }
.custom-scroll::-webkit-scrollbar-thumb { background: #0284c7; border-radius: 4px; }
.custom-scroll::-webkit-scrollbar-thumb:hover { background: #0369a1; }
</style>