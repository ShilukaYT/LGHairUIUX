<script setup lang="ts">
import type { SidebarProps } from "@/components/ui/sidebar";

import {
  LayoutDashboard,
  BookOpen,
  Grid,
  Star,
  Bot,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Scissors,
  Ticket,Users,
} from "lucide-vue-next"

import NavMain from "@/components/NavMain.vue";
import NavProjects from "@/components/NavProjects.vue";
import NavSecondary from "@/components/NavSecondary.vue";
import NavUser from "@/components/NavUser.vue";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const props = withDefaults(defineProps<SidebarProps>(), {
  variant: "inset",
});

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  navMain: [
    {
      title: "Dashboard",
      url: "/admin/Dashboard",
      icon: SquareTerminal,
      isActive: true,
      items: [
        {
          title: "Điểm danh ca làm",
          url: "/admin/ca-lam-viec",
        },
        {
          title: "Lịch sử điểm danh",
          url: "/admin/lich-su-diem-danh",
        },
        {
          title: "Gửi thông báo",
          url: "/admin/gui-thong-bao",
        },
        // {
        //   title: "Khách hàng",
        //   url: "/admin/khach-hang",
        // },
        {
          title: "Nhân viên",
          url: "/admin/NhanVien",
        },
        {
          title: "Checkin",
          url: "/admin/checkin",
        },
        {
          title: "Hóa đơn",
          url: "/admin/hoa-don",
        },
        {
          title: "Đánh giá",
          url: "/admin/quanlydanhgia",
        },
      ],
    },
    {
      title: "Quản lý kiểu tóc",
      url: "/admin/StyleHairXColor",
      icon: Scissors,
    },
    //
    {
      title: "Dịch vụ/Combo",
      url: "/admin/ServicesManager",
      icon: Frame,
    },
    {
      title: "Danh mục",
      url: "/admin/Category",
      icon: Grid,
    },

  ],
  navSecondary: [
    // {
    //   title: "Support",
    //   url: "#",
    //   icon: LifeBuoy,
    // },
    // {
    //   title: "Feedback",
    //   url: "#",
    //   icon: Send,
    // },
  ],
  projects: [
    {
      name: "Sale ",
      url: "/admin/sale",
      icon: PieChart,
    },
    {
      name: "Voucher",
      url: "/admin/voucher",
      icon: Ticket,
    },
    {
      name: "Khách hàng",
      url: "/admin/khach-hang",
      icon: Users,
    },
  ],
};
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as-child>
            <a href="#">
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">Minh Tam Hair</span>
                <span class="truncate text-xs">Manager Salon</span>
              </div>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />

      <NavProjects :projects="data.projects" />

      <NavSecondary :items="data.navSecondary" class="mt-auto" />
    </SidebarContent>

    <SidebarFooter>
      <NavUser :user="data.user" />
    </SidebarFooter>
  </Sidebar>
</template>
