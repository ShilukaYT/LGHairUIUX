<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Check, ChevronsUpDown, MoreHorizontal, Plus, Search, SlidersHorizontal, Trash2, Clock, X } from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'

// --- Import Shadcn Components ---
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Label } from '@/components/ui/label'
import { Toaster } from '@/components/ui/sonner'
import { toast } from 'vue-sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

import 'vue-sonner/style.css'
import axios from 'axios'

// ==========================================
// CẤU HÌNH API URL
// ==========================================
const baseUrrl = import.meta.env.VITE_API_URL;
const API_URL = `${baseUrrl}/api/Sale`;
const API_DICH_VU = 'https://localhost:7196/api/DanhSachDichVu';
const API_COMBO = 'https://localhost:7196/api/Combo';

const danhSachDichVuMau = ref<any[]>([]);

const fecth_Service_Combo = async () => {
  try {
    const [resDichVu, resCombo] = await Promise.all([
      axios.get(API_DICH_VU).catch((err) => {
        console.error("Lỗi gọi API Dịch Vụ:", err);
        return { data: [] };
      }),
      axios.get(API_COMBO).catch((err) => {
        console.error("Lỗi gọi API Combo:", err);
        return { data: [] };
      })
    ]);

    let dataDv = resDichVu.data;
    let rawDichVu = Array.isArray(dataDv) ? dataDv : (dataDv?.services || dataDv?.data || []);
    const listDv = rawDichVu.map((x: any) => ({
      loai: x.maDmNavigation?.tenDanhMuc || x.MaDmNavigation?.TenDanhMuc || 'Dịch vụ', 
      // Bắt mọi trường hợp tên ID từ backend
      ma: x.maDv || x.MaDv || x.maDV || x.MaDV || x.id || x.Id,
      ten: x.tenDv || x.TenDv || x.tenDV || x.TenDV || x.ten || x.Ten || '',
      gia: x.gia || x.Gia || 0
    }));

    let dataCb = resCombo.data;
    let rawCombo = Array.isArray(dataCb) ? dataCb : (dataCb?.combos || dataCb?.data || []);
    const listCb = rawCombo.map((x: any) => ({
      loai: 'Combo',
      // Bắt mọi trường hợp tên ID từ backend
      ma: x.maCb || x.MaCb || x.maCB || x.MaCB || x.id || x.Id,
      ten: x.tenCombo || x.TenCombo || x.tenCb || x.TenCb || x.tenCB || x.TenCB || '',
      gia: x.gia || x.Gia || 0
    }));

    danhSachDichVuMau.value = [...listDv, ...listCb];

  } catch(error: any){
    console.error("Lỗi fetch tổng:", error)
    toast.error('Lỗi khi lấy danh sách cấu hình!')
  }
}

// --- State ---
const dataList = ref<any[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const isSubmitting = ref(false) // State chống double-click

const isFormDialogOpen = ref(false)
const isDeleteDialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const openPopovers = ref<Record<number, boolean>>({})

const currentItem = ref<any>({
  maFL: '',
  ngayBatDau: '',
  ngayKetThuc: '',
  trangThai: 1,
  chiTietFlashSales: []
})

const trangThaiStr = computed({
  get: () => currentItem.value.trangThai?.toString() || "1",
  set: (val) => { currentItem.value.trangThai = Number(val) }
})

// --- Computed & Helpers ---
const filteredData = computed(() => {
  if (!searchQuery.value) return dataList.value
  return dataList.value.filter(item => item.maFL.toLowerCase().includes(searchQuery.value.toLowerCase()))
})

const formatDate = (dateString: string) => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

const formatDateForInput = (dateString: string) => {
  if (!dateString) return ''
  const d = new Date(dateString)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const getStatusBadge = (status: number) => {
  switch (status) {
    case 1: return { label: 'Đang diễn ra', class: 'bg-green-100 text-green-700 border-green-200', icon: Check }
    case 0: return { label: 'Sắp diễn ra', class: 'bg-orange-100 text-orange-700 border-orange-200', icon: Clock }
    case 2: return { label: 'Đã kết thúc', class: 'bg-slate-100 text-slate-700 border-slate-200', icon: X }
    default: return { label: 'KHÔNG RÕ', class: 'bg-gray-100 text-gray-700 border-gray-200', icon: null }
  }
}

// ==========================================
// AXIOS: GỌI API GIAO TIẾP VỚI BACKEND
// ==========================================

const fetchData = async () => {
  try {
    isLoading.value = true
    const res = await axios.get(API_URL)
    dataList.value = res.data.data || res.data 
  } catch (error: any) {
    console.error("Lỗi fetch:", error)
    toast.error(error.response?.data?.message || 'Lỗi khi lấy dữ liệu!')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  fetchData();
  fecth_Service_Combo();
})

// --- Actions (Mở Dialog) ---
const openCreateDialog = () => {
  dialogMode.value = 'create'
  currentItem.value = { maFL: '', ngayBatDau: '', ngayKetThuc: '', trangThai: 1, chiTietFlashSales: [] }
  openPopovers.value = {}
  isFormDialogOpen.value = true
}

const openEditDialog = (item: any) => {
  dialogMode.value = 'edit'
  const clone = JSON.parse(JSON.stringify(item))
  
  clone.ngayBatDau = formatDateForInput(clone.ngayBatDau)
  clone.ngayKetThuc = formatDateForInput(clone.ngayKetThuc)

  clone.chiTietFlashSales.forEach((ct: any) => {
    // Bắt mọi trường hợp chữ hoa/thường từ backend
    ct.maDV = ct.maDV || ct.maDv || ct.MaDv || ct.MaDV || "";
    ct.maCB = ct.maCB || ct.maCb || ct.MaCb || ct.MaCB || "";

    const matchedId = ct.maDV || ct.maCB;
    const foundItem = danhSachDichVuMau.value.find((x: any) => x.ma === matchedId);
    
    ct.gia = ct.gia || foundItem?.gia || 0;
  })

  currentItem.value = clone
  openPopovers.value = {}
  isFormDialogOpen.value = true
}

const openDeleteConfirm = (item: any) => {
  currentItem.value = JSON.parse(JSON.stringify(item))
  isDeleteDialogOpen.value = true
}

// 2. Thêm mới / Cập nhật
const saveForm = async () => {
  if (isSubmitting.value) return; // Nếu đang xử lý thì chặn click tiếp

  try {
    isSubmitting.value = true;

    if (!currentItem.value.ngayBatDau || !currentItem.value.ngayKetThuc) {
      toast.error('Vui lòng chọn Ngày bắt đầu và Ngày kết thúc!');
      return;
    }

    if (new Date(currentItem.value.ngayBatDau) >= new Date(currentItem.value.ngayKetThuc)) {
      toast.error('Ngày kết thúc phải lớn hơn ngày bắt đầu!');
      return;
    }

    if (!currentItem.value.chiTietFlashSales || currentItem.value.chiTietFlashSales.length === 0) {
      toast.error('Phải có ít nhất 1 dịch vụ hoặc combo để sale!');
      return;
    }

    // Kiểm tra từng dòng chi tiết để báo lỗi cụ thể
    for (const [index, x] of currentItem.value.chiTietFlashSales.entries()) {
      if (!x.maDV && !x.maCB) {
        toast.error(`Lỗi ở dòng số ${index + 1}: Bạn chưa chọn Dịch vụ/Combo nào. Vui lòng click chọn hoặc xóa dòng này đi!`);
        return;
      }
      if (x.phanTramGiam <= 0 || x.phanTramGiam > 100) {
        toast.error(`Lỗi ở dòng số ${index + 1}: Mức giảm giá không hợp lệ (1-100%). Vui lòng kiểm tra lại!`);
        return;
      }
    }

    const payload = {
      ngayBatDau: currentItem.value.ngayBatDau,
      ngayKetThuc: currentItem.value.ngayKetThuc,
      trangThai: Number(currentItem.value.trangThai),
      chiTietFlashSales: currentItem.value.chiTietFlashSales.map((x: any) => ({
        maDV: x.maDV || "", 
        maCB: x.maCB || "", 
        phanTramGiam: Number(x.phanTramGiam)
      }))
    }

    let res;

    if (dialogMode.value === 'edit') {
      res = await axios.put(`${API_URL}/${currentItem.value.maFL}`, payload)
      logActivity("Cập nhật khuyến mãi", `Đã cập nhật chiến dịch khuyến mãi ${currentItem.value.maFL}`, "Khuyến mãi");
    } else {
      res = await axios.post(API_URL, payload)
      // Lấy mã khuyến mãi trả về từ response hoặc từ payload
      const maFlNew = res.data?.data?.maFL || res.data?.maFL || currentItem.value.maFL || "mới";
      logActivity("Thêm khuyến mãi", `Đã tạo chiến dịch khuyến mãi mới (Mã: ${maFlNew})`, "Khuyến mãi");
    }

    toast.success(res.data?.message || 'Lưu thành công!')
    isFormDialogOpen.value = false
    fetchData() 
  } catch (error: any) {
    console.error("Lỗi save:", error)
    const errorMsg = error.response?.data?.message || error.response?.data || 'Lưu thất bại! Hãy kiểm tra lại logic chi tiết.'
    logActivity(
      dialogMode.value === 'edit' ? "Cập nhật khuyến mãi" : "Thêm khuyến mãi",
      `Thất bại khi ${dialogMode.value === 'edit' ? 'cập nhật' : 'tạo'} chiến dịch khuyến mãi - Lỗi: ${errorMsg}`,
      "Khuyến mãi",
      "Thất bại"
    );
    toast.error(typeof errorMsg === 'string' ? errorMsg : "Lỗi hệ thống khi lưu")
  } finally {
    isSubmitting.value = false; // Luôn mở khóa nút sau khi gọi API xong
  }
}

// 3. Xóa
const confirmDelete = async () => {
  try {
    const res = await axios.delete(`${API_URL}/${currentItem.value.maFL}`)
    logActivity("Xóa khuyến mãi", `Đã xóa chiến dịch khuyến mãi ${currentItem.value.maFL}`, "Khuyến mãi");
    toast.success(res.data?.message || 'Đã xóa Flash Sale!')
    isDeleteDialogOpen.value = false
    fetchData()
  } catch (error: any) {
    console.error("Lỗi delete:", error)
    logActivity("Xóa khuyến mãi", `Thất bại khi xóa chiến dịch khuyến mãi ${currentItem.value.maFL} - Lỗi: ${error.message || ''}`, "Khuyến mãi", "Thất bại");
    toast.error(error.response?.data?.message || 'Xóa thất bại!')
  }
}

// --- Actions (Thao tác trên bảng Chi tiết) ---
const themDichVuVaoList = () => {
  const newIndex = currentItem.value.chiTietFlashSales.length
  currentItem.value.chiTietFlashSales.push({
    maDV: "",
    maCB: "",
    tenDv: "",
    tenCb: "",
    gia: 0,
    giaSauGiam: 0,
    phanTramGiam: 0
  })
  openPopovers.value[newIndex] = false
}

const xoaDichVu = (index: number) => {
  currentItem.value.chiTietFlashSales.splice(index, 1)
}

const onChonDichVu = (index: number, maItemDuocChon: string) => {
  const itemMau = danhSachDichVuMau.value.find((x: any) => x.ma === maItemDuocChon)
  if (itemMau) {
    const row = currentItem.value.chiTietFlashSales[index]
    
    if (itemMau.loai === 'Combo') {
      row.maCB = itemMau.ma
      row.tenCb = itemMau.ten
      row.maDV = ""
      row.tenDv = ""
    } else {
      row.maDV = itemMau.ma
      row.tenDv = itemMau.ten
      row.maCB = ""
      row.tenCb = ""
    }
    
    row.gia = itemMau.gia
    row.giaSauGiam = itemMau.gia
    row.phanTramGiam = 0
  }
}

const tinhGiaSauGiam = (index: number) => {
  const row = currentItem.value.chiTietFlashSales[index]
  if (row.gia > 0 && row.phanTramGiam >= 0) {
    row.giaSauGiam = row.gia - (row.gia * row.phanTramGiam / 100)
  }
}

const tinhPhanTram = (index: number) => {
  const row = currentItem.value.chiTietFlashSales[index]
  if (row.gia > 0 && row.giaSauGiam >= 0) {
    row.phanTramGiam = Math.round(((row.gia - row.giaSauGiam) / row.gia) * 100)
  }
}

// Hàm lọc danh sách dịch vụ/combo chưa được chọn
const getAvailableServices = (currentIndex: number) => {
  const selectedIds = currentItem.value.chiTietFlashSales
    .filter((_: any, idx: number) => idx !== currentIndex)
    .map((x: any) => x.maDV || x.maCB)
    .filter((id: string) => id);

  return danhSachDichVuMau.value.filter((sv: any) => !selectedIds.includes(sv.ma));
}
</script>

<template>
  <div class="p-8 w-full bg-background text-foreground min-h-screen flex flex-col gap-6">
    <div>
      <h2 class="text-3xl font-bold tracking-tight"> Quản lý Sale</h2>
    </div>

    <div class="flex items-center justify-between">
      <div class="flex flex-1 items-center space-x-2">
        <div class="relative w-80">
          <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Tìm kiếm mã Flash Sale..." class="pl-9" />
        </div>
        <Button variant="outline" class="h-10 border-dashed" @click="fetchData">
          <SlidersHorizontal class="mr-2 h-4 w-4" /> Làm mới dữ liệu
        </Button>
      </div>
      <Button variant="outline" @click="openCreateDialog">
        <Plus class="mr-2 h-4 w-4" /> Tạo mới
      </Button>
    </div>

    <div class="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[120px]">Mã FL</TableHead>
            <TableHead>Ngày bắt đầu</TableHead>
            <TableHead>Ngày kết thúc</TableHead>
            <TableHead class="text-center">Tổng dịch vụ</TableHead>
            <TableHead>Trạng thái</TableHead>
            <TableHead class="text-right">Hành động</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="isLoading">
             <TableCell colspan="6" class="h-32 text-center text-muted-foreground">Đang tải dữ liệu...</TableCell>
          </TableRow>
          <TableRow v-else v-for="item in filteredData" :key="item.maFL">
            <TableCell class="font-medium">{{ item.maFL }}</TableCell>
            <TableCell>{{ formatDate(item.ngayBatDau) }}</TableCell>
            <TableCell>{{ formatDate(item.ngayKetThuc) }}</TableCell>
            <TableCell class="text-center font-semibold">{{ item.tongDichVu }}</TableCell>
            <TableCell>
              <div 
                :class="[
                  'inline-flex items-center justify-center gap-1.5 rounded-md border px-2.5 py-0.5 text-[11px] font-bold tracking-wide w-max',
                  getStatusBadge(item.trangThai).class
                ]"
              >
                {{ getStatusBadge(item.trangThai).label }}
                <component 
                  v-if="getStatusBadge(item.trangThai).icon" 
                  :is="getStatusBadge(item.trangThai).icon" 
                  class="w-3.5 h-3.5 stroke-[3]" 
                />
              </div>
            </TableCell>
            <TableCell class="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" class="h-8 w-8 p-0">
                    <span class="sr-only">Mở menu</span>
                    <MoreHorizontal class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Thao tác</DropdownMenuLabel>
                  <DropdownMenuItem @click="openEditDialog(item)">Chỉnh sửa chi tiết</DropdownMenuItem>
                  <DropdownMenuItem @click="openDeleteConfirm(item)" class="text-red-600 focus:text-red-600">Xóa chiến dịch</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
          <TableRow v-if="!isLoading && filteredData.length === 0">
            <TableCell colspan="6" class="h-32 text-center text-muted-foreground">
              Không tìm thấy dữ liệu.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isFormDialogOpen">
      <DialogContent class="sm:max-w-[950px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle class="text-xl">{{ dialogMode === 'create' ? 'Tạo Flash Sale mới' : 'Cập nhật Flash Sale' }}</DialogTitle>
          <DialogDescription>
            Điền thông tin chiến dịch và cấu hình các dịch vụ được áp dụng.
          </DialogDescription>
        </DialogHeader>

        <div class="overflow-y-auto pr-2 pb-4 space-y-6">
          <div class="grid grid-cols-2 gap-6" v-if="dialogMode === 'edit'">
            <div class="space-y-2">
              <Label>Trạng thái</Label>
              <Select v-model="trangThaiStr">
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Sắp diễn ra</SelectItem>
                  <SelectItem value="1">Đang hoạt động</SelectItem>
                  <SelectItem value="2">Đã ngưng</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-6">
            <div class="space-y-2">
              <Label for="start">Thời gian bắt đầu</Label>
              <Input id="start" type="datetime-local" v-model="currentItem.ngayBatDau" />
            </div>
            <div class="space-y-2">
              <Label for="end">Thời gian kết thúc</Label>
              <Input id="end" type="datetime-local" v-model="currentItem.ngayKetThuc" />
            </div>
          </div>

          <div class="space-y-4 border-t pt-6">
            <div class="flex items-center justify-between">
              <div>
                <Label class="text-lg font-semibold">Chi tiết dịch vụ áp dụng</Label>
                <p class="text-sm text-muted-foreground">Tổng cộng: {{ currentItem.chiTietFlashSales?.length || 0 }} dịch vụ/combo</p>
              </div>
              <Button size="sm" @click="themDichVuVaoList">
                <Plus class="mr-2 h-4 w-4" /> Thêm dịch vụ
              </Button>
            </div>
            
            <div class="rounded-md border overflow-x-auto overflow-y-visible">
              <Table class="min-w-[700px]">
                <TableHeader class="bg-muted/50">
                  <TableRow>
                    <TableHead class="w-[35%]">Tìm & Chọn Dịch vụ / Combo</TableHead>
                    <TableHead class="w-[15%]">Giá gốc</TableHead>
                    <TableHead class="w-[20%]">Giá sau giảm</TableHead>
                    <TableHead class="w-[15%] text-center">% Giảm</TableHead>
                    <TableHead class="w-[15%] text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <template v-for="(detail, index) in currentItem.chiTietFlashSales" :key="index">
                    <TableRow>
                      <TableCell>
                        <Popover v-model:open="openPopovers[Number(index)]">
                          <PopoverTrigger as-child>
                            <Button
                              variant="outline"
                              role="combobox"
                              :aria-expanded="openPopovers[Number(index)]"
                              class="w-full justify-between font-normal text-left px-3"
                            >
                              <span class="truncate">
                                {{ detail.tenCb || detail.tenDv || 'Tìm dịch vụ/combo...' }}
                              </span>
                              <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent class="w-[350px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Gõ tên dịch vụ hoặc combo..." />
                              <CommandEmpty>Không tìm thấy kết quả phù hợp.</CommandEmpty>
                              <CommandList>
                                <CommandGroup>
                                    <CommandItem
                                      v-for="sv in getAvailableServices(Number(index))"
                                      :key="sv.ma"
                                      :value="`${sv.ten} ${sv.ma}`"
                                      class="cursor-pointer transition-colors duration-200 hover:bg-red-50 hover:text-red-700 data-[selected=true]:bg-red-50 data-[selected=true]:text-red-700"
                                      @select="() => { onChonDichVu(Number(index), sv.ma); openPopovers[Number(index)] = false }"
                                    >
                                      <Check
                                        :class="['mr-2 h-4 w-4', (detail.maCB || detail.maDV) === sv.ma ? 'opacity-100 text-red-600' : 'opacity-0']"
                                      />
                                      <span class="font-medium text-slate-800">{{ sv.ten }}</span>
                                      <span class="text-muted-foreground ml-2 text-xs">({{ sv.loai }})</span>
                                    </CommandItem>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </TableCell>
                      
                      <TableCell>
                        <Input type="number" v-model="detail.gia" disabled class="h-9 bg-muted" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" v-model="detail.giaSauGiam" @input="tinhPhanTram(Number(index))" class="h-9 text-red-600 font-medium" />
                      </TableCell>
                      <TableCell>
                        <Input type="number" v-model="detail.phanTramGiam" @input="tinhGiaSauGiam(Number(index))" class="h-9 text-center" />
                      </TableCell>
                      <TableCell class="text-right">
                        <Button variant="ghost" size="icon" class="text-red-500 hover:text-red-700 hover:bg-red-50" @click="xoaDichVu(Number(index))">
                          <Trash2 class="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  </template>
                  <TableRow v-if="!currentItem.chiTietFlashSales || currentItem.chiTietFlashSales.length === 0">
                    <TableCell colspan="5" class="h-24 text-center text-muted-foreground">
                      Chưa có dịch vụ/combo nào được thêm. Bấm "Thêm dịch vụ" để bắt đầu.
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <DialogFooter class="pt-4 border-t mt-auto">
          <Button variant="outline" @click="isFormDialogOpen = false" :disabled="isSubmitting">Hủy bỏ</Button>
          <Button @click="saveForm" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="mr-2 h-4 w-4 animate-spin block border-2 border-current border-t-transparent rounded-full"></span>
            {{ isSubmitting ? 'Đang lưu...' : 'Lưu dữ liệu' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog v-model:open="isDeleteDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Xác nhận xóa Flash Sale?</AlertDialogTitle>
          <AlertDialogDescription>
            Hành động này không thể hoàn tác. Dữ liệu của <b>{{ currentItem.maFL }}</b> và toàn bộ danh sách dịch vụ đi kèm sẽ bị xóa.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Hủy</AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete" class="bg-red-600 hover:bg-red-700 text-white">Xác nhận xóa</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Toaster richColors closeButton close-button-position="top-right" position="top-right" :toastOptions="{class: 'rounded-xl shadow-lg'}"/>
  </div>
</template>