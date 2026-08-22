<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import axios from 'axios'
import { Trophy, X, Star, TrendingUp, TrendingDown, Minus, Users, Award } from 'lucide-vue-next'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits(['close'])

const isLoading = ref(false)
const rawStats = ref<any[]>([])
const allStaffList = ref<any[]>([])
const activeTab = ref<'all' | 'good' | 'normal' | 'bad'>('all')

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'
const API_STATS = API + '/api/QuanLyDanhGiaDichVu/thong-ke-nhan-vien'
const API_STAFF = API + '/api/NhanVien'

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('adminToken')
             || localStorage.getItem('staffToken')
             || sessionStorage.getItem('staffToken')
             || localStorage.getItem('accessToken') 
             || localStorage.getItem('token') 
             || sessionStorage.getItem('accessToken') 
             || sessionStorage.getItem('token')
             || ''
  return token ? { 'Authorization': `Bearer ${token}` } : {}
}

const loadData = async () => {
  isLoading.value = true
  try {
    const [resStats, resStaff] = await Promise.allSettled([
      axios.get(API_STATS, { headers: getAuthHeaders() }),
      axios.get(API_STAFF, { headers: getAuthHeaders() })
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
          hinhAnh: st.hinhAnh || st.HinhAnh || '',
          chucVu: st.tenChucVu || st.TenChucVu || 'Nhân viên',
          trangThai: st.trangThai !== undefined ? st.trangThai : 1
        })
      }
    })

    statsData.forEach((item: any) => {
      const name = item.tenNhanVien || item.TenNhanVien || item.tenTho || ''
      if (name) {
        const key = name.trim().toLowerCase()
        const existing = mergedMap.get(key)
        const score = item.diemTrungBinh !== undefined ? item.diemTrungBinh : (item.DiemTrungBinh || 0)
        const count = item.luotDanhGia !== undefined ? item.luotDanhGia : (item.LuotDanhGia || 0)

        if (existing) {
          existing.diemTrungBinh = score
          existing.luotDanhGia = count
        } else {
          mergedMap.set(key, {
            maNv: item.maNv || item.MaNv || '',
            tenNhanVien: name,
            diemTrungBinh: score,
            luotDanhGia: count,
            hinhAnh: '',
            chucVu: 'Thợ làm tóc',
            trangThai: 1
          })
        }
      }
    })

    rawStats.value = Array.from(mergedMap.values()).sort((a, b) => {
      if (b.diemTrungBinh !== a.diemTrungBinh) {
        return b.diemTrungBinh - a.diemTrungBinh
      }
      return b.luotDanhGia - a.luotDanhGia
    })

  } catch (error) {
    console.error("Không thể load bảng xếp hạng nhân viên:", error)
  } finally {
    isLoading.value = false
  }
}

watch(() => props.isOpen, (val) => {
  if (val) loadData()
})

const allStaffs = computed(() => rawStats.value)
const goodStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 4.0))
const normalStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh >= 3.0 && s.diemTrungBinh < 4.0))
const badStaffs = computed(() => rawStats.value.filter(s => s.diemTrungBinh > 0 && s.diemTrungBinh < 3.0))

const displayedList = computed(() => {
  if (activeTab.value === 'good') return goodStaffs.value
  if (activeTab.value === 'normal') return normalStaffs.value
  if (activeTab.value === 'bad') return badStaffs.value
  return allStaffs.value
})

const getInitials = (name: string) => {
  if (!name) return 'NV'
  const words = name.trim().split(/\s+/)
  if (words.length >= 2 && words[0] && words[1]) {
    return ((words[0][0] || '') + (words[1][0] || '')).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function toAbsUrl(path: string) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API}${cleanPath}`
}
</script>

<template>
  <v-dialog :model-value="isOpen" @update:model-value="val => !val && emit('close')" max-width="950px" scrollable>
    <v-card rounded="xl" class="overflow-hidden">
      <!-- Header -->
      <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
        <div class="d-flex align-center gap-3">
          <v-avatar color="warning" variant="tonal" size="48" rounded="lg">
            <Trophy class="w-6 h-6 text-warning" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">Bảng Xếp Hạng Toàn Bộ Nhân Viên</h3>
            <div class="text-caption text-medium-emphasis">
              Hiển thị đầy đủ danh sách nhân viên hệ thống kèm điểm số và hạng thành tích
            </div>
          </div>
        </div>
        <v-btn icon variant="text" density="comfortable" @click="emit('close')">
          <X class="w-5 h-5" />
        </v-btn>
      </v-card-title>

      <!-- Tabs -->
      <div class="px-6 pt-4 bg-surface">
        <v-tabs v-model="activeTab" color="primary" align-tabs="start" class="border rounded-lg">
          <v-tab value="all" class="text-none font-weight-bold">
            <template v-slot:prepend><Users class="w-4 h-4 mr-1" /></template>
            Tất cả ({{ allStaffs.length }})
          </v-tab>
          <v-tab value="good" class="text-none font-weight-bold">
            <template v-slot:prepend><TrendingUp class="w-4 h-4 text-success mr-1" /></template>
            Xuất sắc (4-5 ⭐)
            <v-chip size="x-small" color="success" variant="tonal" class="ml-1.5 font-weight-bold">
              {{ goodStaffs.length }}
            </v-chip>
          </v-tab>
          <v-tab value="normal" class="text-none font-weight-bold">
            <template v-slot:prepend><Minus class="w-4 h-4 text-warning mr-1" /></template>
            Đạt yêu cầu (3-4 ⭐)
            <v-chip size="x-small" color="warning" variant="tonal" class="ml-1.5 font-weight-bold">
              {{ normalStaffs.length }}
            </v-chip>
          </v-tab>
          <v-tab value="bad" class="text-none font-weight-bold">
            <template v-slot:prepend><TrendingDown class="w-4 h-4 text-error mr-1" /></template>
            Cần cải thiện (&lt;3 ⭐)
            <v-chip size="x-small" color="error" variant="tonal" class="ml-1.5 font-weight-bold">
              {{ badStaffs.length }}
            </v-chip>
          </v-tab>
        </v-tabs>
      </div>

      <!-- Body / Table -->
      <v-card-text class="pa-6" style="max-height: 520px;">
        <div v-if="isLoading" class="d-flex justify-center align-center py-16">
          <v-progress-circular indeterminate color="primary" size="48" />
        </div>

        <div v-else class="overflow-x-auto">
          <v-table hover class="border rounded-xl">
            <thead>
              <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="font-weight-bold text-caption text-center py-3" style="width: 80px;">HẠNG</th>
                <th class="font-weight-bold text-caption text-left py-3" style="width: 280px;">NHÂN VIÊN</th>
                <th class="font-weight-bold text-caption text-center py-3" style="width: 160px;">ĐIỂM TRUNG BÌNH</th>
                <th class="font-weight-bold text-caption text-center py-3" style="width: 140px;">LƯỢT ĐÁNH GIÁ</th>
                <th class="font-weight-bold text-caption text-center py-3" style="width: 150px;">DANH HIỆU</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(staff, index) in displayedList" :key="staff.maNv || staff.tenNhanVien" class="border-b">
                <!-- Rank -->
                <td class="text-center font-weight-bold">
                  <v-avatar
                    size="32"
                    :color="index === 0 ? 'warning' : (index === 1 ? 'blue-grey' : (index === 2 ? 'amber-darken-3' : undefined))"
                    :variant="index < 3 ? 'flat' : 'tonal'"
                    class="font-weight-bold text-caption"
                  >
                    {{ index + 1 }}
                  </v-avatar>
                </td>

                <!-- Staff info -->
                <td>
                  <div class="d-flex align-center gap-3">
                    <v-avatar size="36" color="primary" variant="tonal">
                      <v-img v-if="staff.hinhAnh" :src="toAbsUrl(staff.hinhAnh)" cover></v-img>
                      <span v-else class="font-weight-bold text-caption">{{ getInitials(staff.tenNhanVien) }}</span>
                    </v-avatar>
                    <div>
                      <div class="font-weight-bold text-body-2">{{ staff.tenNhanVien }}</div>
                      <div class="text-caption text-medium-emphasis">{{ staff.chucVu }}</div>
                    </div>
                  </div>
                </td>

                <!-- Average score -->
                <td class="text-center">
                  <v-chip size="small" :color="staff.diemTrungBinh >= 4 ? 'success' : (staff.diemTrungBinh >= 3 ? 'warning' : 'default')" variant="tonal" class="font-weight-bold">
                    {{ staff.diemTrungBinh ? staff.diemTrungBinh.toFixed(1) : 'Chưa có' }}
                    <Star v-if="staff.diemTrungBinh > 0" class="w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-1 inline" />
                  </v-chip>
                </td>

                <!-- Count -->
                <td class="text-center font-mono font-weight-bold text-caption">
                  {{ staff.luotDanhGia }} lượt
                </td>

                <!-- Badge -->
                <td class="text-center">
                  <v-chip
                    size="small"
                    :color="staff.diemTrungBinh >= 4.5 ? 'warning' : (staff.diemTrungBinh >= 4.0 ? 'success' : (staff.diemTrungBinh >= 3.0 ? 'info' : 'default'))"
                    variant="tonal"
                    class="font-weight-bold text-caption text-uppercase"
                  >
                    {{ staff.diemTrungBinh >= 4.5 ? 'Top Stylist ⭐' : (staff.diemTrungBinh >= 4.0 ? 'Xuất sắc' : (staff.diemTrungBinh >= 3.0 ? 'Đạt yêu cầu' : 'Tiêu chuẩn')) }}
                  </v-chip>
                </td>
              </tr>

              <tr v-if="displayedList.length === 0">
                <td colspan="5" class="text-center py-12 text-medium-emphasis">
                  Chưa có nhân viên nào trong danh mục này.
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>

      <!-- Footer -->
      <v-divider></v-divider>
      <v-card-actions class="pa-4 justify-end">
        <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold px-5" @click="emit('close')">
          Đóng
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>