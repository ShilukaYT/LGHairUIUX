<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { 
  Home, 
  CalendarCheck, 
  CalendarClock,
  Clock, 
  LogOut, 
  ChevronsUpDown,
  Scissors
} from "lucide-vue-next";

// Import các component UI chuẩn của hệ thống (giống Admin)
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import NavMain from "@/components/NavMain.vue";

type StaffUser = {
  hoTen?: string;
  tenNhanVien?: string;
  name?: string;
  chucVu?: string;
  role?: string;
  tenRole?: string;
  hinhAnh?: string;
  avatar?: string;
};

const router = useRouter();

// Cấu trúc Menu truyền vào NavMain (Tương tự cấu trúc data.navMain của Admin)
const navItems = [
  {
    title: "Tổng quan",
    url: "/nhanvien",
    icon: Home,
  },
  {
    title: "Ca làm việc", // Đổi tên
    url: "/nhanvien/ca-lam-viec", // Đổi URL
    icon: CalendarClock, // Đổi Icon
  },
  // {
  //   title: "Lịch sử điểm danh",
  //   url: "/nhanvien/lich-su-diem-danh",
  //   icon: Clock,
  // },
];

const readStoredUser = () => {
  const raw =
    sessionStorage.getItem("staffUser") ||
    sessionStorage.getItem("nhanVienUser") ||
    sessionStorage.getItem("adminUser");

  if (!raw) return {};

  try {
    return JSON.parse(raw) as StaffUser;
  } catch {
    return {};
  }
};

const staffInfo = computed(() => {
  const user = readStoredUser();
  return {
    fullName: user.hoTen || user.tenNhanVien || user.name || "Nhân viên",
    role: user.chucVu || user.tenRole || user.role || "Nhân viên",
    avatar: user.hinhAnh || user.avatar || "",
  };
});

const displayAvatar = computed(() => {
  if (staffInfo.value.avatar) {
    if (staffInfo.value.avatar.startsWith("/")) {
      return `https://localhost:7196${staffInfo.value.avatar}`;
    }
    return staffInfo.value.avatar;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(staffInfo.value.fullName)}&background=0f172a&color=fff`;
});

const handleLogout = () => {
  sessionStorage.removeItem("staffUser");
  sessionStorage.removeItem("nhanVienUser");
  sessionStorage.removeItem("adminUser");
  router.push("/nhanvien/login");
};
</script>

<template>
  <SidebarProvider>
    <Sidebar variant="inset">
      
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as-child>
              <RouterLink to="/nhanvien">
                <div class="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                  <Scissors class="size-4" />
                </div>
                <div class="grid flex-1 text-left text-sm leading-tight">
                  <span class="truncate font-bold text-slate-900">Minh Tâm Hair</span>
                  <span class="truncate text-xs font-medium text-slate-500">Khu vực nhân viên</span>
                </div>
              </RouterLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain :items="navItems" />
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground border border-transparent hover:border-slate-200 transition-all">
                  
                  <Avatar class="h-8 w-8 rounded-lg">
                    <AvatarImage :src="displayAvatar" :alt="staffInfo.fullName" />
                    <AvatarFallback class="rounded-lg">NV</AvatarFallback>
                  </Avatar>
                  
                  <div class="grid flex-1 text-left text-sm leading-tight">
                    <span class="truncate font-semibold">{{ staffInfo.fullName }}</span>
                    <span class="truncate text-xs text-slate-500">{{ staffInfo.role }}</span>
                  </div>
                  
                  <ChevronsUpDown class="ml-auto size-4 text-slate-400" />
                  
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              
              <DropdownMenuContent class="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg shadow-xl" side="bottom" align="end" :side-offset="4">
                <DropdownMenuLabel class="p-0 font-normal">
                  <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <Avatar class="h-8 w-8 rounded-lg">
                      <AvatarImage :src="displayAvatar" :alt="staffInfo.fullName" />
                      <AvatarFallback class="rounded-lg">NV</AvatarFallback>
                    </Avatar>
                    <div class="grid flex-1 text-left text-sm leading-tight">
                      <span class="truncate font-bold text-slate-900">{{ staffInfo.fullName }}</span>
                      <span class="truncate text-xs text-slate-500">{{ staffInfo.role }}</span>
                    </div>
                  </div>
                </DropdownMenuLabel>
                
                <DropdownMenuSeparator />

                <DropdownMenuItem @click="handleLogout" class="cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 font-medium transition-colors">
                  <LogOut class="mr-2 h-4 w-4" />
                  <span>Đăng xuất</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>

    <div class="flex flex-1 flex-col h-screen overflow-hidden bg-slate-50/50">
      
      <header class="flex h-14 items-center gap-4 border-b border-slate-200 bg-white/90 backdrop-blur px-4 lg:h-[60px] lg:px-6 shadow-sm">
        <SidebarTrigger class="-ml-1 text-slate-500 hover:text-slate-900" />
        <div class="w-full flex-1">
          <h1 class="text-sm font-semibold text-slate-800">Workspace</h1>
        </div>
      </header>

      <main class="flex-1 overflow-auto p-4 md:p-6 custom-scrollbar">
        <div class="mx-auto max-w-6xl">
          <RouterView />
        </div>
      </main>
      
    </div>
  </SidebarProvider>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar { height: 8px; width: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
</style>