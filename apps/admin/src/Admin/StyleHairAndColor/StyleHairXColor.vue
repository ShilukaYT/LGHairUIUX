<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Check, MoreHorizontal, Plus, Search, SlidersHorizontal, Trash2, X, Image as ImageIcon, Palette, Scissors } from 'lucide-vue-next'

// --- Import Shadcn Components ---
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'vue-sonner'

import 'vue-sonner/style.css'
import axios from 'axios'

// ==========================================
// CẤU HÌNH API URL
// ==========================================

const baseUrrl = import.meta.env.VITE_API_URL ;

const API_URL = `${baseUrrl}/api/StyleHairAndColor`

// --- States: Dữ liệu ---
const styleList = ref<any[]>([])
const colorList = ref<any[]>([])
const isLoading = ref(false)
const isSubmitting = ref(false) // Cờ chặn double submit

// --- States: Tabs & Tìm kiếm ---
const activeTab = ref('styles') // 'styles' | 'colors'
const searchStyle = ref('')
const searchColor = ref('')

// --- States: Dialog Form ---
const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')

// Biến lưu trữ item đang thao tác (Kiểu tóc hoặc Màu tóc)
const currentItem = ref<any>({})
const selectedFile = ref<File | null>(null)
const previewImage = ref<string | null>(null)

// Computed xử lý select trạng thái cho Form
const trangThaiStr = computed({
  get: () => currentItem.value.trangThai?.toString() || "1",
  set: (val) => { currentItem.value.trangThai = Number(val) }
})

// --- Computed: Lọc dữ liệu ---
const filteredStyles = computed(() => {
  if (!searchStyle.value) return styleList.value
  return styleList.value.filter(item => 
    item.tenKieuToc?.toLowerCase().includes(searchStyle.value.toLowerCase()) ||
    item.maKt?.toLowerCase().includes(searchStyle.value.toLowerCase())
  )
})

const filteredColors = computed(() => {
  if (!searchColor.value) return colorList.value
  return colorList.value.filter(item => 
    item.tenMau?.toLowerCase().includes(searchColor.value.toLowerCase()) ||
    item.maMau?.toLowerCase().includes(searchColor.value.toLowerCase())
  )
})

const getStatusBadge = (status: number) => {
  switch (status) {
    case 1: return { label: 'Hoạt động', class: 'bg-green-100 text-green-700 border-green-200', icon: Check }
    case 0: return { label: 'Tạm ngưng', class: 'bg-slate-100 text-slate-700 border-slate-200', icon: X }
    default: return { label: 'KHÔNG RÕ', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: null }
  }
}

// ==========================================
// GỌI API FETCH DỮ LIỆU
// ==========================================
const fetchStyles = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(API_URL)
    styleList.value = res.data.data || []
  } catch (error: any) {
    toast.error('Lỗi lấy danh sách Kiểu tóc!')
  } finally {
    isLoading.value = false
  }
}

const fetchColors = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(`${API_URL}/color`)
    colorList.value = res.data.data || []
  } catch (error: any) {
    toast.error('Lỗi lấy danh sách Màu tóc!')
  } finally {
    isLoading.value = false
  }
}

const refreshData = () => {
  if (activeTab.value === 'styles') fetchStyles()
  else fetchColors()
}

onMounted(() => {
  fetchStyles()
  fetchColors()
})

// ==========================================
// ACTIONS: MỞ DIALOG & XỬ LÝ ẢNH
// ==========================================
const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if(!file) {
      return toast.error('Không thể đọc file ảnh!')
    }
    selectedFile.value = file
    previewImage.value = URL.createObjectURL(file)
  }
}

const openCreateDialog = () => {
  dialogMode.value = 'create'
  selectedFile.value = null
  previewImage.value = null

  if (activeTab.value === 'styles') {
    currentItem.value = { maKt: '', tenKieuToc: '', moTa: '', hinhAnh: '', trangThai: 1 }
  } else {
    currentItem.value = { maMau: '', tenMau: '', trangThai: 1 }
  }
  isFormDialogOpen.value = true
}

const openEditDialog = (item: any) => {
  dialogMode.value = 'edit'
  currentItem.value = JSON.parse(JSON.stringify(item))
  selectedFile.value = null
  previewImage.value = activeTab.value === 'styles' ? item.hinhAnh : null
  isFormDialogOpen.value = true
}

const openDeleteConfirm = (item: any) => {
  currentItem.value = JSON.parse(JSON.stringify(item))
  isDeleteDialogOpen.value = true
}

// ==========================================
// ACTIONS: LƯU & XÓA DỮ LIỆU (CÓ CHỐNG SPAM)
// ==========================================
const saveForm = async () => {
  if (isSubmitting.value) return // Chặn double click

  try {
    isSubmitting.value = true
    const formData = new FormData()

    if (activeTab.value === 'styles') {
      if (!currentItem.value.tenKieuToc) return toast.error('Vui lòng nhập tên kiểu tóc!')
      
      formData.append('TenKieuToc', currentItem.value.tenKieuToc)
      formData.append('MoTa', currentItem.value.moTa || '')
      formData.append('TrangThai', currentItem.value.trangThai.toString())
      if (selectedFile.value) formData.append('HinhAnh', selectedFile.value)
      if (dialogMode.value === 'edit') formData.append('id', currentItem.value.maKt)

      let res;
      if (dialogMode.value === 'edit') {
        res = await axios.put(`${API_URL}/${currentItem.value.maKt}`, formData)
      } else {
        if (!selectedFile.value) return toast.error('Vui lòng chọn hình ảnh cho kiểu tóc!')
        res = await axios.post(API_URL, formData)
      }
      toast.success(res.data?.message || 'Lưu kiểu tóc thành công!')
      fetchStyles()
    } 
    
    else {
      if (!currentItem.value.tenMau) return toast.error('Vui lòng nhập tên màu!')
      if (dialogMode.value === 'create' && !currentItem.value.maMau) return toast.error('Vui lòng nhập mã màu!')

      formData.append('MaMau', currentItem.value.maMau)
      formData.append('TenMau', currentItem.value.tenMau)
      formData.append('TrangThai', currentItem.value.trangThai.toString())
      if (dialogMode.value === 'edit') formData.append('id', currentItem.value.maMau)

      let res;
      if (dialogMode.value === 'edit') {
        res = await axios.put(`${API_URL}/color/${currentItem.value.maMau}`, formData)
      } else {
        res = await axios.post(`${API_URL}/color`, formData)
      }
      toast.success(res.data?.message || 'Lưu màu tóc thành công!')
      fetchColors()
    }

    isFormDialogOpen.value = false
  } catch (error: any) {
    const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Lưu thất bại!'
    toast.error(errorMsg)
  } finally {
    isSubmitting.value = false
  }
}

const confirmDelete = async () => {
  if (isSubmitting.value) return // Chặn double click

  try {
    isSubmitting.value = true
    const formData = new FormData()
    const id = activeTab.value === 'styles' ? currentItem.value.maKt : currentItem.value.maMau
    formData.append('id', id)

    let res;
    if (activeTab.value === 'styles') {
      res = await axios.delete(`${API_URL}/${id}`, { data: formData })
      fetchStyles()
    } else {
      res = await axios.delete(`${API_URL}/color/${id}`, { data: formData })
      fetchColors()
    }

    toast.success(res.data?.message || 'Đã xóa thành công!')
    isDeleteDialogOpen.value = false
  } catch (error: any) {
    toast.error(error.response?.data?.message || 'Xóa thất bại!')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="p-8 w-full bg-background text-foreground min-h-screen flex flex-col gap-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight">Cấu hình Dịch vụ Tóc</h2>
      <p class="text-muted-foreground mt-1">Quản lý danh sách Kiểu tóc và Bảng màu cho salon.</p>
    </div>

    <Tabs v-model="activeTab" class="w-full">
      <div class="flex items-center justify-between mb-4">
        <TabsList class="grid w-[400px] grid-cols-2">
          <TabsTrigger value="styles" class="font-medium">
            <Scissors class="w-4 h-4 mr-2" /> Kiểu Tóc
          </TabsTrigger>
          <TabsTrigger value="colors" class="font-medium">
            <Palette class="w-4 h-4 mr-2" /> Màu Tóc
          </TabsTrigger>
        </TabsList>
        
        <div class="flex items-center space-x-2">
          <Button variant="outline" class="border-dashed" @click="refreshData">
            <SlidersHorizontal class="mr-2 h-4 w-4" /> Làm mới
          </Button>
          <Button @click="openCreateDialog">
            <Plus class="mr-2 h-4 w-4" /> Tạo {{ activeTab === 'styles' ? 'Kiểu Tóc' : 'Màu Mới' }}
          </Button>
        </div>
      </div>

      <!-- TAB: KIỂU TÓC -->
      <TabsContent value="styles" class="space-y-4">
        <div class="relative w-80">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchStyle" placeholder="Tìm kiếm kiểu tóc..." class="pl-9 bg-card" />
        </div>
        <div class="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[100px]">Hình ảnh</TableHead>
                <TableHead class="w-[120px]">Mã KT</TableHead>
                <TableHead>Tên Kiểu Tóc</TableHead>
                <TableHead>Mô Tả</TableHead>
                <TableHead class="w-[150px]">Trạng thái</TableHead>
                <TableHead class="text-right w-[100px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading"><TableCell colspan="6" class="h-32 text-center text-muted-foreground">Đang tải dữ liệu...</TableCell></TableRow>
              <TableRow v-else v-for="item in filteredStyles" :key="item.maKt">
                <TableCell>
                  <img v-if="item.hinhAnh" :src="item.hinhAnh" class="w-12 h-12 rounded-md object-cover border" alt="Hình ảnh" />
                  <div v-else class="w-12 h-12 bg-muted rounded-md flex items-center justify-center"><ImageIcon class="w-5 h-5 text-muted-foreground"/></div>
                </TableCell>
                <TableCell class="font-medium">{{ item.maKt }}</TableCell>
                <TableCell class="font-semibold">{{ item.tenKieuToc }}</TableCell>
                <TableCell class="truncate max-w-[200px] text-muted-foreground">{{ item.moTa || 'Không có mô tả' }}</TableCell>
                <TableCell>
                  <div :class="['inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold', getStatusBadge(item.trangThai).class]">
                    {{ getStatusBadge(item.trangThai).label }}
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" class="h-8 w-8 p-0"><MoreHorizontal class="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openEditDialog(item)">Chỉnh sửa</DropdownMenuItem>
                      <DropdownMenuItem @click="openDeleteConfirm(item)" class="text-red-600">Xóa kiểu tóc</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>

      <!-- TAB: MÀU TÓC -->
      <TabsContent value="colors" class="space-y-4">
        <div class="relative w-80">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchColor" placeholder="Tìm kiếm màu tóc..." class="pl-9 bg-card" />
        </div>
        <div class="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[150px]">Mã Màu</TableHead>
                <TableHead>Tên Màu</TableHead>
                <TableHead class="w-[150px]">Trạng thái</TableHead>
                <TableHead class="text-right w-[100px]">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="isLoading"><TableCell colspan="4" class="h-32 text-center text-muted-foreground">Đang tải dữ liệu...</TableCell></TableRow>
              <TableRow v-else v-for="item in filteredColors" :key="item.maMau">
                <TableCell class="font-medium">{{ item.maMau }}</TableCell>
                <TableCell class="font-semibold">{{ item.tenMau }}</TableCell>
                <TableCell>
                  <div :class="['inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-bold', getStatusBadge(item.trangThai).class]">
                    {{ getStatusBadge(item.trangThai).label }}
                  </div>
                </TableCell>
                <TableCell class="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" class="h-8 w-8 p-0"><MoreHorizontal class="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="openEditDialog(item)">Chỉnh sửa</DropdownMenuItem>
                      <DropdownMenuItem @click="openDeleteConfirm(item)" class="text-red-600">Xóa màu tóc</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </TabsContent>
    </Tabs>

    <!-- DIALOG THÊM / SỬA -->
    <Dialog v-model:open="isFormDialogOpen">
      <DialogContent class="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{{ dialogMode === 'create' ? 'Thêm mới' : 'Cập nhật' }} {{ activeTab === 'styles' ? 'Kiểu Tóc' : 'Màu Tóc' }}</DialogTitle>
          <DialogDescription>Điền đầy đủ thông tin bên dưới để lưu dữ liệu.</DialogDescription>
        </DialogHeader>

        <!-- Form Kiểu Tóc -->
        <div v-if="activeTab === 'styles'" class="grid gap-5 py-4">
          <div class="grid gap-2">
            <Label class="text-muted-foreground">Hình ảnh kiểu tóc <span class="text-red-500">*</span></Label>
            <div class="flex items-center gap-4">
              <img v-if="previewImage" :src="previewImage" class="w-24 h-24 object-cover rounded-md border shadow-sm" />
              <div v-else class="w-24 h-24 bg-muted border border-dashed rounded-md flex items-center justify-center">
                <ImageIcon class="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <Input type="file" accept="image/*" @change="handleFileChange" class="flex-1" />
            </div>
          </div>
          <div class="grid gap-2">
            <Label>Tên kiểu tóc <span class="text-red-500">*</span></Label>
            <Input v-model="currentItem.tenKieuToc" placeholder="VD: Undercut, Mullet..." />
          </div>
          <div class="grid gap-2">
            <Label>Mô tả chi tiết</Label>
            <Input v-model="currentItem.moTa" placeholder="Nhập mô tả..." />
          </div>
          <div v-if="dialogMode === 'edit'" class="grid gap-2">
            <Label>Trạng thái</Label>
            <Select v-model="trangThaiStr">
              <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoạt động</SelectItem>
                <SelectItem value="0">Tạm ngưng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Form Màu Tóc -->
        <div v-else class="grid gap-5 py-4">
          <div class="grid gap-2">
            <Label>Mã màu (Định danh) <span v-if="dialogMode === 'create'" class="text-red-500">*</span></Label>
            <Input v-model="currentItem.maMau" :disabled="dialogMode === 'edit'" placeholder="VD: MAU01, KHOI..." />
          </div>
          <div class="grid gap-2">
            <Label>Tên màu <span class="text-red-500">*</span></Label>
            <Input v-model="currentItem.tenMau" placeholder="VD: Xám khói, Nâu lạnh..." />
          </div>
          <div v-if="dialogMode === 'edit'" class="grid gap-2">
            <Label>Trạng thái</Label>
            <Select v-model="trangThaiStr">
              <SelectTrigger><SelectValue placeholder="Chọn trạng thái" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Hoạt động</SelectItem>
                <SelectItem value="0">Tạm ngưng</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="isFormDialogOpen = false" :disabled="isSubmitting">Hủy</Button>
          <Button @click="saveForm" :disabled="isSubmitting">
            <span v-if="isSubmitting">Đang xử lý...</span>
            <span v-else>Lưu thông tin</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- DIALOG XÓA -->
    <AlertDialog v-model:open="isDeleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa 
            <b>{{ activeTab === 'styles' ? currentItem.tenKieuToc : currentItem.tenMau }}</b> không?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isSubmitting">Hủy</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete" :disabled="isSubmitting" class="bg-red-600 hover:bg-red-700 text-white">
            <span v-if="isSubmitting">Đang xóa...</span>
            <span v-else>Xóa vĩnh viễn</span>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Toaster richColors close-button-position="top-right" position="top-right" :toastOptions="{class: 'rounded-xl shadow-lg'}"/>
  </div>
</template>