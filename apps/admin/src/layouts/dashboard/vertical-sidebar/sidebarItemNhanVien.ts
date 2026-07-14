// icons
import {
  DashboardOutlined,
  CalendarOutlined,
  DollarOutlined
} from '@ant-design/icons-vue';

export interface menu {
  header?: string;
  title?: string;
  icon?: object;
  to?: string;
  divider?: boolean;
  chip?: string;
  chipColor?: string;
  chipVariant?: string;
  chipIcon?: string;
  children?: menu[];
  disabled?: boolean;
  type?: string;
  subCaption?: string;
}

const sidebarItemNhanVien: menu[] = [
  { header: 'Khu vực nhân viên' },
  {
    title: 'Tổng quan',
    icon: DashboardOutlined,
    to: '/nhanvien'
  },
  {
    title: 'Ca làm việc',
    icon: CalendarOutlined,
    to: '/nhanvien/ca-lam-viec'
  },
  {
    title: 'Thống kê thu nhập',
    icon: DollarOutlined,
    to: '/nhanvien/thong-ke-thu-nhap'
  },
];

export default sidebarItemNhanVien;
