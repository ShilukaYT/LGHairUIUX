<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Sparkles,
} from "lucide-vue-next"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const props = defineProps<{
  user: {
    name: string
    email: string
    avatar: string
  }
}>()

const { isMobile } = useSidebar()
const router = useRouter()

// Biến lưu thông tin Admin
const adminUser = ref({
  hoTen: 'Đang tải...',
  chucVu: 'Admin',
  hinhAnh: ''
})

// 1. LẤY THÔNG TIN TỪ LOCALSTORAGE KHI COMPONENT MOUNT
onMounted(() => {
  const storedData = sessionStorage.getItem('adminUser')
  if (storedData) {
    try {
      const parsedData = JSON.parse(storedData)
      adminUser.value = {
        hoTen: parsedData.hoTen || parsedData.hoTenNv || 'Quản trị viên',
        chucVu: parsedData.chucVu || parsedData.loaiNhanVien || 'Admin',
        hinhAnh: parsedData.hinhAnh || ''
      }
    } catch (error) {
      console.error("Lỗi parse dữ liệu admin:", error)
    }
  }
  if (adminUser.value.chucVu != "Quản trị viên" )
  {
    alert("Bạn không có quyền truy cập vào trang này!");
    handleLogout()
  }
})

// Xử lý link ảnh Avatar
const displayAvatar = computed(() => {
  if (adminUser.value.hinhAnh) {
    if (adminUser.value.hinhAnh.startsWith('/')) {
      return `https://localhost:7196${adminUser.value.hinhAnh}`
    }
    return adminUser.value.hinhAnh
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(adminUser.value.hoTen)}&background=0f172a&color=fff`
})

// 2. HÀM ĐĂNG XUẤT
const handleLogout = async () => {
  try {
    // Gọi API xóa Cookie ở Backend 
    // (Đảm bảo đường dẫn này đúng với Controller của bạn là /api/admin/auth/logout)
    await axios.post('https://localhost:7196/api/admin/auth/logout', {}, { withCredentials: true })
  } catch (error) {
    console.error("Lỗi khi đăng xuất server:", error)
  } finally {
    // Xóa sạch dữ liệu Admin ở Frontend
    sessionStorage.removeItem('adminUser')
    
    // Chuyển hướng về trang đăng nhập Admin
    router.push({ name: 'login-admin' })
  }
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarImage :src="displayAvatar" :alt="adminUser.hoTen" />
              <AvatarFallback class="rounded-lg">AD</AvatarFallback>
            </Avatar>
            
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">{{ adminUser.hoTen }}</span>
              <span class="truncate text-xs">{{ adminUser.chucVu }}</span>
            </div>
            
            <ChevronsUpDown class="ml-auto size-4" />
            
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side="bottom" align="end" :side-offset="4">
          
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarImage :src="displayAvatar" :alt="adminUser.hoTen" />
                <AvatarFallback class="rounded-lg">AD</AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-semibold">{{ adminUser.hoTen }}</span>
                <span class="truncate text-xs">{{ adminUser.chucVu }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />

          <DropdownMenuItem @click="handleLogout" class="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50">
            <LogOut class="mr-2 h-4 w-4" />
            <span>Đăng xuất</span>
          </DropdownMenuItem>
          
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>