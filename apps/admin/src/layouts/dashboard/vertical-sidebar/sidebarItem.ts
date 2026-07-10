// icons
import {
  DashboardOutlined,
  AppstoreOutlined,
  TagOutlined,
  PercentageOutlined,
  CalendarOutlined,
  FileTextOutlined,
  UserOutlined,
  StarOutlined,
  TeamOutlined,
  ScissorOutlined,
  NotificationOutlined,
  DollarOutlined,
  ShopOutlined,
  MessageOutlined,
  HistoryOutlined,
  ShoppingOutlined,
  UnorderedListOutlined,
  InboxOutlined,
  CheckSquareOutlined
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

const sidebarItem: menu[] = [
  { header: 'Quản lý chung' },
  {
    title: 'Dashboard',
    icon: DashboardOutlined,
    to: '/admin/dashboard'
  },
  {
    title: 'Check-in',
    icon: CheckSquareOutlined,
    to: '/admin/checkin'
  },
  {
    title: 'Check-out',
    icon: DollarOutlined,
    to: '/admin/checkout'
  },
  {
    title: 'Hóa đơn',
    icon: FileTextOutlined,
    to: '/admin/hoa-don'
  },
  {
    title: 'Khách hàng',
    icon: UserOutlined,
    to: '/admin/khach-hang'
  },
  {
    title: 'Quản lý hoạt động',
    icon: HistoryOutlined,
    to: '/admin/quan-ly-hoat-dong'
  },
  { header: 'Dịch vụ' },
  {
    title: 'Quản lý Dịch vụ',
    icon: AppstoreOutlined,
    to: '/admin/servicesManager'
  },
  {
    title: 'Danh mục',
    icon: TagOutlined,
    to: '/admin/category'
  },
  {
    title: 'Style & Màu tóc',
    icon: ScissorOutlined,
    to: '/admin/StyleHairXColor'
  },
  { header: 'Sản phẩm' },
  {
    title: 'Quản lý sản phẩm',
    icon: ShoppingOutlined,
    to: '/admin/productManager'
  },
  {
    title: 'Danh mục sản phẩm',
    icon: UnorderedListOutlined,
    to: '/admin/categoriesProduct'
  },
  {
    title: 'Nhà cung cấp',
    icon: ShopOutlined,
    to: '/admin/nha-cung-cap'
  },
  {
    title: 'Quản lý kho',
    icon: InboxOutlined,
    to: '/admin/quanLyKho'
  },
  { header: 'Khuyến mãi' },
  {
    title: 'Khuyến mãi (Sale)',
    icon: PercentageOutlined,
    to: '/admin/sale'
  },
  {
    title: 'Voucher',
    icon: TagOutlined,
    to: '/admin/voucher'
  },
  { header: 'Nhân sự' },
  {
    title: 'Nhân viên',
    icon: TeamOutlined,
    to: '/admin/nhan-vien'
  },
  {
    title: 'Ca làm việc',
    icon: CalendarOutlined,
    to: '/admin/quan-ly-ca-lam'
  },
  {
    title: 'Điểm danh',
    icon: FileTextOutlined,
    to: '/admin/diem-danh'
  },
  {
    title: 'Lịch sử điểm danh',
    icon: FileTextOutlined,
    to: '/admin/lich-su-diem-danh'
  },
  {
    title: 'Bảng lương',
    icon: DollarOutlined,
    to: '/admin/bang-luong'
  },
  { header: 'Khác' },
  {
    title: 'Hỗ trợ khách hàng',
    icon: MessageOutlined,
    to: '/admin/chat'
  },
  {
    title: 'Đánh giá',
    icon: StarOutlined,
    to: '/admin/quanlydanhgia'
  },
  {
    title: 'Gửi Thông Báo',
    icon: NotificationOutlined,
    to: '/admin/Gui-Thong-Bao'
  }
];

export default sidebarItem;
