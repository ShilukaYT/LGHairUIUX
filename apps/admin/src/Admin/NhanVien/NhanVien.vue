<script setup>
import { ref, onMounted, onUnmounted, computed, watch, reactive } from 'vue'
import { Html5Qrcode } from 'html5-qrcode'
import ThongKeNhanVienModal from './ThongKeNhanVienModal.vue'
import { 
  Search, Plus, Edit3, Trash2, X, Award, Camera, Users, Phone, Mail, 
  MapPin, Calendar, Eye, Filter, Star, AlertTriangle, ShieldAlert, RotateCcw
} from 'lucide-vue-next'
import { logActivity } from '@/utils/activityLogger'

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196'

function toAbsUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${API}${cleanPath}`
}

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

const nhanViens = ref([])
const loading = ref(false)

const roles = ref([])
const loaiNvs = ref([])

const showModal = ref(false)
const isEditMode = ref(false)
const showThongKeModal = ref(false)
const originalStaffData = ref(null)
const formData = ref({
  maNv: '', hoTenNv: '', maRole: '', maLoaiNv: '', 
  gioiTinh: 'Nam', cccd: '', namSinh: '', sdt: '', 
  email: '', diaChi: '', ngayVaoLam: '', 
  trangThai: 1, tenDangNhap: '', matKhau: '', matKhauCu: ''
})

const selectedImageFile = ref(null)
const imagePreviewUrl = ref(null) 
const errors = ref({})

const searchQuery = ref('')
const filterTrangThai = ref('') 
const filterGioiTinh = ref('')  
const filterRole = ref('')
const filterLoaiNv = ref('')

const getRoleName = (nv) => {
  if (!nv) return '--'
  if (nv.tenChucVu) return nv.tenChucVu
  if (nv.TenChucVu) return nv.TenChucVu
  const targetRoleCode = nv.maRole || nv.MaRole
  const r = (roles.value || []).find(x => (x.maRole || x.MaRole) === targetRoleCode)
  return r ? (r.tenChucVu || r.TenChucVu || r.tenRole || targetRoleCode) : (targetRoleCode || 'Chưa phân chức vụ')
}

const getLoaiNvName = (nv) => {
  if (!nv) return '--'
  if (nv.tenLoai) return nv.tenLoai
  if (nv.TenLoai) return nv.TenLoai
  if (nv.tenLoaiNv) return nv.tenLoaiNv
  if (nv.TenLoaiNv) return nv.TenLoaiNv
  const targetLoaiCode = nv.maLoaiNv || nv.MaLoaiNv || nv.maLoaiNV
  const l = (loaiNvs.value || []).find(x => (x.maLoaiNv || x.MaLoaiNv || x.maLoaiNV) === targetLoaiCode)
  return l ? (l.tenLoai || l.TenLoai || l.tenLoaiNv || targetLoaiCode) : (targetLoaiCode || 'Chưa phân loại')
}

const showReviewModal = ref(false)
const reviewsList = ref([])
const loadingReviews = ref(false)
const selectedNvName = ref('')

const showScanner = ref(false)
const isScanning = ref(false)
const scanProgress = ref('')

// Snackbar
const snackbar = ref({
  show: false,
  text: '',
  color: 'success'
})
const showSnackbar = (text, color = 'success') => {
  snackbar.value = { show: true, text, color }
}

// Native Confirm Dialog
const confirmDialog = reactive({
  open: false,
  title: '',
  message: '',
  confirmText: 'Đồng ý',
  color: 'primary',
  loading: false,
  action: null
})

const openConfirm = (opts) => {
  confirmDialog.title = opts.title
  confirmDialog.message = opts.message
  confirmDialog.confirmText = opts.confirmText || 'Đồng ý'
  confirmDialog.color = opts.color || 'primary'
  confirmDialog.action = opts.action
  confirmDialog.loading = false
  confirmDialog.open = true
}

const executeConfirmAction = async () => {
  if (!confirmDialog.action) return
  confirmDialog.loading = true
  try {
    await confirmDialog.action()
    confirmDialog.open = false
  } finally {
    confirmDialog.loading = false
  }
}

// ── Phân trang (Pagination) ──
const currentPage = ref(1)
const perPage = ref(10)

const filteredNhanViens = computed(() => {
  return nhanViens.value.filter(nv => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchSearch = !q || 
      (nv.hoTenNv || '').toLowerCase().includes(q) ||
      (nv.maNv || '').toLowerCase().includes(q) ||
      (nv.sdt || '').toLowerCase().includes(q) ||
      (nv.cccd || '').toLowerCase().includes(q) ||
      (nv.tenDangNhap || '').toLowerCase().includes(q)

    const matchStatus = filterTrangThai.value === '' || String(nv.trangThai) === String(filterTrangThai.value)
    const matchGender = !filterGioiTinh.value || nv.gioiTinh === filterGioiTinh.value
    const matchRole = !filterRole.value || String(nv.maRole || nv.MaRole) === String(filterRole.value)
    const matchLoaiNv = !filterLoaiNv.value || String(nv.maLoaiNv || nv.MaLoaiNv || nv.maLoaiNV) === String(filterLoaiNv.value)

    return matchSearch && matchStatus && matchGender && matchRole && matchLoaiNv
  })
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredNhanViens.value.length / perPage.value))
})

const pagedNhanViens = computed(() => {
  const start = (currentPage.value - 1) * perPage.value
  return filteredNhanViens.value.slice(start, start + perPage.value)
})

watch([searchQuery, filterTrangThai, filterGioiTinh, filterRole, filterLoaiNv], () => {
  currentPage.value = 1
})

// --- API Calls ---
const fetchOptions = async () => {
  try {
    const headers = getAuthHeaders()
    const [resRoles, resLoai, resLoaiDirect] = await Promise.allSettled([
      fetch(`${API}/api/NhanVien/roles`, { headers }),
      fetch(`${API}/api/NhanVien/loainvs`, { headers }),
      fetch(`${API}/api/LoaiNhanVien`, { headers })
    ])

    if (resRoles.status === 'fulfilled' && resRoles.value.ok) {
      const data = await resRoles.value.json()
      roles.value = Array.isArray(data) ? data : (data?.data || [])
    }

    if (resLoai.status === 'fulfilled' && resLoai.value.ok) {
      const data = await resLoai.value.json()
      const list = Array.isArray(data) ? data : (data?.data || [])
      if (list.length > 0) loaiNvs.value = list
    }

    if ((!loaiNvs.value || loaiNvs.value.length === 0) && resLoaiDirect.status === 'fulfilled' && resLoaiDirect.value.ok) {
      const data = await resLoaiDirect.value.json()
      const list = Array.isArray(data) ? data : (data?.data || [])
      if (list.length > 0) loaiNvs.value = list
    }

    // Fallbacks if endpoints return empty or failed
    if (!roles.value || roles.value.length === 0) {
      roles.value = [
        { maRole: 'R01', tenChucVu: 'Quản trị viên' },
        { maRole: 'R02', tenChucVu: 'Lễ tân' },
        { maRole: 'R03', tenChucVu: 'Nhân viên kỹ thuật' }
      ]
    }

    if (!loaiNvs.value || loaiNvs.value.length === 0) {
      loaiNvs.value = [
        { maLoaiNv: 'LNV01', tenLoai: 'Stylist chính Bậc 1', luong: 15000000 },
        { maLoaiNv: 'LNV02', tenLoai: 'Thợ phụ', luong: 7000000 },
        { maLoaiNv: 'CV111', tenLoai: 'Phụ Hồ', luong: 17500000 }
      ]
    }
  } catch (err) {
    console.error('Lỗi khi tải danh mục roles/loainvs:', err)
  }
}

const fetchNhanViens = async () => {
  loading.value = true
  try {
    const res = await fetch(`${API}/api/NhanVien`, { headers: getAuthHeaders() })
    if (res.ok) {
      nhanViens.value = await res.json()
    } else {
      showSnackbar('Không thể tải danh sách nhân viên.', 'error')
    }
  } catch (err) {
    console.error('Lỗi fetch:', err)
    showSnackbar('Lỗi kết nối máy chủ khi tải nhân viên.', 'error')
  } finally {
    loading.value = false
  }
}

// Hàm tự động sinh mã NV ngẫu nhiên không trùng lặp: bắt đầu từ NV + 6 chữ số, nếu đầy tự tăng lên 7 chữ số...
const generateUniqueStaffCode = () => {
  const existingCodes = new Set(
    (nhanViens.value || []).map(n => String(n.maNv || '').trim().toUpperCase())
  )
  
  // Bắt đầu với 6 chữ số (100000 - 999999), nếu đầy thì tăng lên 7, 8 chữ số...
  for (let digits = 6; digits <= 10; digits++) {
    const min = Math.pow(10, digits - 1)
    const max = Math.pow(10, digits) - 1
    
    // Thử random trong khoảng chữ số hiện tại
    for (let attempt = 0; attempt < 50; attempt++) {
      const randomNum = Math.floor(min + Math.random() * (max - min + 1))
      const candidate = `NV${randomNum}`
      if (!existingCodes.has(candidate)) {
        return candidate
      }
    }
  }
  return `NV${Date.now().toString().slice(-6)}`
}

const openAddForm = () => {
  isEditMode.value = false
  originalStaffData.value = null
  selectedImageFile.value = null
  imagePreviewUrl.value = null
  errors.value = {}
  const defaultRole = roles.value[0]?.maRole || roles.value[0]?.MaRole || 'R01'
  const defaultLoaiNv = loaiNvs.value[0]?.maLoaiNv || loaiNvs.value[0]?.MaLoaiNv || loaiNvs.value[0]?.maLoaiNV || 'LNV01'

  formData.value = {
    maNv: generateUniqueStaffCode(), 
    hoTenNv: '', 
    maRole: defaultRole, 
    maLoaiNv: defaultLoaiNv, 
    gioiTinh: 'Nam', cccd: '', namSinh: '', sdt: '', 
    email: '', diaChi: '', ngayVaoLam: new Date().toISOString().split('T')[0], 
    trangThai: 1, tenDangNhap: '', matKhau: '', matKhauCu: ''
  }
  showModal.value = true
}

const openEditForm = (nv) => {
  isEditMode.value = true
  originalStaffData.value = JSON.parse(JSON.stringify(nv))
  selectedImageFile.value = null
  imagePreviewUrl.value = nv.hinhAnh ? toAbsUrl(nv.hinhAnh) : null
  errors.value = {}
  formData.value = {
    maNv: nv.maNv,
    hoTenNv: nv.hoTenNv,
    maRole: nv.maRole || nv.MaRole || '',
    maLoaiNv: nv.maLoaiNv || nv.MaLoaiNv || nv.maLoaiNV || '',
    gioiTinh: nv.gioiTinh || 'Nam',
    cccd: nv.cccd || '',
    namSinh: nv.namSinh || '',
    sdt: nv.sdt || '',
    email: nv.email || '',
    diaChi: nv.diaChi || '',
    ngayVaoLam: nv.ngayVaoLam ? nv.ngayVaoLam.split('T')[0] : '',
    trangThai: nv.trangThai != null ? nv.trangThai : 1,
    tenDangNhap: nv.tenDangNhap || '',
    matKhau: '',
    matKhauCu: ''
  }
  showModal.value = true
}

const closeModal = () => {
  showModal.value = false
  errors.value = {}
  selectedImageFile.value = null
  imagePreviewUrl.value = null
}

const openScannerModal = () => {
  showScanner.value = true
  scanProgress.value = ''
}

const closeScannerModal = () => {
  showScanner.value = false
  isScanning.value = false
  scanProgress.value = ''
}

const parseQrData = (decodedText) => {
  const parts = decodedText.split('|')
  if (parts.length >= 6) {
    const rawDob = parts[3] || ''
    let yearOfBirth = ''
    if (rawDob.length === 8) {
      yearOfBirth = rawDob.substring(4, 8)
    }
    return {
      soCccd: parts[0] || '',
      hoTen: parts[2] || '',
      namSinh: yearOfBirth,
      gioiTinh: parts[4] || 'Nam',
      diaChi: parts[5] || ''
    }
  }
  return null
}

const processIdCardImage = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  isScanning.value = true
  scanProgress.value = 'Đang đọc và phân tích mã QR trên CCCD...'

  try {
    const html5QrCode = new Html5Qrcode('qr-reader-temp')
    const decodedText = await html5QrCode.scanFile(file, true)
    
    scanProgress.value = 'Đã đọc thành công thông tin QR! Đang tự động điền...'
    
    setTimeout(() => {
      closeScannerModal()
      openAddForm()
      
      const data = parseQrData(decodedText)
      if (data) {
        if (data.hoTen) formData.value.hoTenNv = data.hoTen
        if (data.namSinh) formData.value.namSinh = data.namSinh
        if (data.soCccd) formData.value.cccd = data.soCccd
        if (data.diaChi) formData.value.diaChi = data.diaChi
        if (data.gioiTinh) formData.value.gioiTinh = data.gioiTinh
        showSnackbar('Đã trích xuất thông tin CCCD thành công!')
      }
    }, 600)

  } catch (err) {
    console.error(err)
    scanProgress.value = 'Không tìm thấy hoặc không đọc được mã QR trên ảnh. Vui lòng thử lại!'
  } finally {
    setTimeout(() => { isScanning.value = false }, 2000)
  }
}

const openReviewModal = async (nv) => {
  selectedNvName.value = nv.hoTenNv
  reviewsList.value = []
  showReviewModal.value = true
  loadingReviews.value = true
  try {
    const res = await fetch(`${API}/api/NhanVien/${nv.maNv}/danh-gia`, { headers: getAuthHeaders() })
    if (res.ok) reviewsList.value = await res.json()
  } catch (err) { 
    console.error(err) 
  } finally { 
    loadingReviews.value = false 
  }
}

const closeReviewModal = () => { 
  showReviewModal.value = false 
}

const handleImageUpload = (event) => {
  const file = event.target.files[0]
  if (file) {
    if (file.size > 2 * 1024 * 1024) {
      showSnackbar('Dung lượng ảnh đại diện không được vượt quá 2MB!', 'error')
      event.target.value = ''
      selectedImageFile.value = null
      return
    }
    selectedImageFile.value = file
    imagePreviewUrl.value = URL.createObjectURL(file) 
  }
}

const validateForm = () => {
  errors.value = {} 
  let isValid = true

  if (!formData.value.maNv?.trim()) { errors.value.maNv = 'Bắt buộc nhập.'; isValid = false }
  if (!formData.value.hoTenNv?.trim()) { errors.value.hoTenNv = 'Bắt buộc nhập.'; isValid = false }
  
  if (formData.value.cccd?.trim() && !/^\d{12}$/.test(formData.value.cccd)) {
    errors.value.cccd = 'CCCD phải đủ 12 chữ số.'; isValid = false
  }

  const phoneRegex = /^(0[3|5|7|8|9])+([0-9]{8})\b/
  if (!formData.value.sdt?.trim()) { 
    errors.value.sdt = 'Bắt buộc nhập SĐT.'; isValid = false 
  } else if (!phoneRegex.test(formData.value.sdt)) {
    errors.value.sdt = 'SĐT phải là 10 số, bắt đầu bằng 0.'; isValid = false 
  }

  if (formData.value.namSinh) {
    const currentYear = new Date().getFullYear()
    const birthYear = parseInt(formData.value.namSinh)
    if (birthYear < currentYear - 70 || birthYear > currentYear - 15) {
      errors.value.namSinh = `Năm sinh từ ${currentYear - 70} đến ${currentYear - 15}.`; isValid = false
    }
  }
  
  if (formData.value.tenDangNhap && /\s/.test(formData.value.tenDangNhap)) {
    errors.value.tenDangNhap = 'Không chứa khoảng trắng.'; isValid = false
  }
  if (!isEditMode.value && formData.value.tenDangNhap && !formData.value.matKhau) {
    errors.value.matKhau = 'Vui lòng cấp mật khẩu.'; isValid = false
  }
  if (isEditMode.value && formData.value.matKhau && formData.value.matKhau.trim()) {
    if (!formData.value.matKhauCu || !formData.value.matKhauCu.trim()) {
      errors.value.matKhauCu = 'Bắt buộc nhập mật khẩu cũ để xác thực.'
      isValid = false
    }
  }
  return isValid
}

const saveNhanVien = async () => {
  if (!validateForm()) return 

  const method = isEditMode.value ? 'PUT' : 'POST'
  const url = isEditMode.value ? `${API}/api/NhanVien/${formData.value.maNv}` : `${API}/api/NhanVien`

  const submitData = new FormData()
  submitData.append('MaNv', formData.value.maNv || '')
  submitData.append('MaRole', formData.value.maRole || '')
  submitData.append('MaLoaiNv', formData.value.maLoaiNv || '')
  submitData.append('HoTenNv', formData.value.hoTenNv || '')
  submitData.append('GioiTinh', formData.value.gioiTinh || '')
  submitData.append('Cccd', formData.value.cccd || '')
  if (formData.value.namSinh) submitData.append('NamSinh', formData.value.namSinh)
  submitData.append('Sdt', formData.value.sdt || '')
  submitData.append('Email', formData.value.email || '')
  submitData.append('DiaChi', formData.value.diaChi || '')
  if (formData.value.ngayVaoLam) submitData.append('NgayVaoLam', formData.value.ngayVaoLam)
  
  submitData.append('TrangThai', formData.value.trangThai)
  submitData.append('TenDangNhap', formData.value.tenDangNhap || '')
  submitData.append('MatKhau', formData.value.matKhau || '')
  submitData.append('MatKhauCu', formData.value.matKhauCu || '')
  if (selectedImageFile.value) submitData.append('HinhAnhFile', selectedImageFile.value)

  try {
    const res = await fetch(url, { method: method, body: submitData, headers: getAuthHeaders() })
    if (res.ok) {
      let detailText = `Đã ${isEditMode.value ? 'cập nhật thông tin' : 'thêm tài khoản'} nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv})`
      
      if (isEditMode.value && originalStaffData.value) {
        const orig = originalStaffData.value
        const changes = []
        
        if ((formData.value.hoTenNv || '').trim() !== (orig.hoTenNv || '').trim()) {
          changes.push(`Họ tên: "${orig.hoTenNv || 'Chưa nhập'}" ➔ "${formData.value.hoTenNv.trim()}"`)
        }
        if ((formData.value.sdt || '').trim() !== (orig.sdt || '').trim()) {
          changes.push(`Số điện thoại: "${orig.sdt || 'Chưa có'}" ➔ "${formData.value.sdt.trim()}"`)
        }
        if ((formData.value.email || '').trim() !== (orig.email || '').trim()) {
          changes.push(`Email: "${orig.email || 'Chưa có'}" ➔ "${formData.value.email.trim()}"`)
        }
        if ((formData.value.diaChi || '').trim() !== (orig.diaChi || '').trim()) {
          changes.push(`Địa chỉ: "${orig.diaChi || 'Chưa nhập'}" ➔ "${formData.value.diaChi.trim()}"`)
        }
        if ((formData.value.gioiTinh || '').trim() !== (orig.gioiTinh || '').trim()) {
          changes.push(`Giới tính: "${orig.gioiTinh || 'Nam'}" ➔ "${formData.value.gioiTinh.trim()}"`)
        }
        if ((formData.value.cccd || '').trim() !== (orig.cccd || '').trim()) {
          changes.push(`Số CCCD: "${orig.cccd || 'Chưa có'}" ➔ "${formData.value.cccd.trim()}"`)
        }
        if (String(formData.value.namSinh || '') !== String(orig.namSinh || '')) {
          changes.push(`Năm sinh: "${orig.namSinh || 'Chưa chọn'}" ➔ "${formData.value.namSinh || 'Chưa chọn'}"`)
        }
        
        const origTT = String(orig.trangThai != null ? orig.trangThai : 1)
        const newTT = String(formData.value.trangThai != null ? formData.value.trangThai : 1)
        if (origTT !== newTT) {
          const ttLabel = v => (String(v) === '1' ? 'Đang làm việc' : 'Đã nghỉ / Khóa tài khoản')
          changes.push(`Trạng thái tài khoản: "${ttLabel(origTT)}" ➔ "${ttLabel(newTT)}"`)
        }

        if (formData.value.matKhau && formData.value.matKhau.trim()) {
          changes.push(`Mật khẩu: Đã đổi mật khẩu tài khoản mới`)
        }

        if (selectedImageFile.value) {
          changes.push(`Ảnh đại diện: Đã tải lên ảnh đại diện nhân viên mới`)
        }

        if (changes.length > 0) {
          detailText = `Cập nhật thông tin nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv}):\n• ` + changes.join('\n• ')
        }
      }

      logActivity(
        isEditMode.value ? "Cập nhật nhân viên" : "Thêm nhân viên mới",
        detailText,
        "Nhân sự"
      )
      showSnackbar(isEditMode.value ? "Cập nhật nhân viên thành công!" : "Thêm nhân viên thành công!", "success")
      closeModal()
      fetchNhanViens() 
    } else { 
      logActivity(
        isEditMode.value ? "Cập nhật nhân viên" : "Thêm nhân viên mới",
        `Thất bại khi ${isEditMode.value ? 'cập nhật' : 'thêm'} nhân viên ${formData.value.hoTenNv} (Mã: ${formData.value.maNv})`,
        "Nhân sự",
        "Thất bại"
      )
      const errorMsg = await res.text()
      let textToShow = errorMsg
      try {
        const json = JSON.parse(errorMsg)
        if (json.message) textToShow = json.message
      } catch(e) {}
      showSnackbar(textToShow || 'Thao tác thất bại!', 'error')
    }
  } catch (err) {
    showSnackbar('Không thể kết nối đến máy chủ.', 'error')
  }
}

const deleteNhanVien = (id) => {
  const nv = nhanViens.value.find(n => n.maNv === id)
  const name = nv ? nv.hoTenNv : id
  
  openConfirm({
    title: 'Xác nhận xóa nhân viên?',
    message: `Bạn có chắc chắn muốn xóa hồ sơ nhân viên ${name} (Mã: ${id})? Hành động này không thể hoàn tác.`,
    confirmText: 'Xóa ngay',
    color: 'error',
    action: async () => {
      try {
        const res = await fetch(`${API}/api/NhanVien/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
        if (res.ok) {
          logActivity("Xóa nhân viên", `Đã xóa hồ sơ nhân viên ${name} (Mã: ${id})`, "Nhân sự")
          showSnackbar(`Đã xóa nhân viên ${name} thành công.`, "success")
          fetchNhanViens() 
        } else { 
          const errMsg = await res.text()
          let textToShow = errMsg
          try {
            const json = JSON.parse(errMsg)
            if (json.message) textToShow = json.message
          } catch(e) {}
          logActivity("Xóa nhân viên", `Xóa thất bại nhân viên ${name} (Mã: ${id}) - Lý do: ${errMsg}`, "Nhân sự", "Thất bại")
          showSnackbar(textToShow || 'Xóa nhân viên thất bại.', 'error')
        }
      } catch (err) {
        showSnackbar('Không thể kết nối đến máy chủ.', 'error')
      }
    }
  })
}

const formatDate = (dateString) => {
  if(!dateString) return ''
  return new Date(dateString).toLocaleDateString('vi-VN')
}

const formatVND = (value) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
}

const currentLoaiLuong = computed(() => {
  if (!formData.value.maLoaiNv) return 0
  const loai = loaiNvs.value.find(l => (l.maLoaiNv || l.MaLoaiNv || l.maLoaiNV) === formData.value.maLoaiNv)
  if (loai && (loai.luong !== undefined || loai.Luong !== undefined)) {
    return loai.luong || loai.Luong || 0
  }
  const fallbackSalaries = {
    'CV111': 17500000,
    'LNV01': 15000000,
    'LNV02': 7000000,
    'LNV03': 12000000
  }
  return fallbackSalaries[formData.value.maLoaiNv] || 0
})

onMounted(() => {
  fetchOptions()
  fetchNhanViens()
})
</script>

<template>
  <v-container fluid class="pa-6 fill-height align-start" style="min-height: 100vh;">
    <!-- Temporary hidden QR Code reader container -->
    <div id="qr-reader-temp" style="display: none;"></div>

    <!-- Snackbar -->
    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="top right" :timeout="3000">
      {{ snackbar.text }}
      <template v-slot:actions>
        <v-btn variant="text" icon density="compact" @click="snackbar.show = false">
          <X class="w-4 h-4" />
        </v-btn>
      </template>
    </v-snackbar>

    <div class="d-flex flex-column gap-6 w-100">
      <!-- ── HEADER BANNER CARD ── -->
      <v-card width="100%" elevation="2" rounded="xl" class="pa-6">
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-4">
          <div class="d-flex align-center gap-3">
            <v-avatar color="primary" variant="tonal" size="48" rounded="lg">
              <Users class="w-6 h-6 text-primary" />
            </v-avatar>
            <div>
              <h2 class="text-h5 font-weight-bold mb-1">Quản Lý Nhân Viên</h2>
              <div class="text-subtitle-2 text-medium-emphasis">
                Quản lý hồ sơ, chức vụ và tài khoản đăng nhập nội bộ
              </div>
            </div>
          </div>

          <div class="d-flex align-center gap-2 flex-wrap">
            <v-btn
              variant="outlined"
              color="grey-darken-1"
              height="40"
              rounded="lg"
              class="text-none font-weight-bold"
              :loading="loading"
              @click="async () => { await fetchNhanViens(); showSnackbar('Đã làm mới danh sách nhân viên!', 'success'); }"
            >
              <template v-slot:prepend><RotateCcw class="w-4 h-4 mr-1" /></template>
              Làm mới
            </v-btn>
            <v-btn color="warning" variant="tonal" height="40" rounded="lg" class="text-none font-weight-bold" @click="showThongKeModal = true">
              <template v-slot:prepend><Award class="w-4 h-4 mr-1" /></template>
              Bảng xếp hạng
            </v-btn>
            <v-btn color="info" variant="tonal" height="40" rounded="lg" class="text-none font-weight-bold" @click="openScannerModal">
              <template v-slot:prepend><Camera class="w-4 h-4 mr-1" /></template>
              Quét CCCD (Ảnh)
            </v-btn>
            <v-btn color="primary" variant="flat" height="40" rounded="lg" class="text-none font-weight-bold" @click="openAddForm">
              <template v-slot:prepend><Plus class="w-4 h-4 mr-1" /></template>
              Thêm thủ công
            </v-btn>
          </div>
        </div>
      </v-card>

      <!-- ── FILTERS CARD ── -->
      <v-card variant="outlined" rounded="xl" class="pa-4 bg-surface">
        <div class="d-flex flex-column flex-md-row align-md-center justify-space-between gap-3 flex-wrap">
          <div class="d-flex align-center gap-3 flex-wrap flex-grow-1">
            <v-text-field
              v-model="searchQuery"
              placeholder="Tìm theo tên, mã NV, SĐT, CCCD..."
              density="compact"
              variant="outlined"
              hide-details
              rounded="lg"
              clearable
              style="min-width: 320px; max-width: 460px;"
            >
              <template v-slot:prepend-inner>
                <Search class="w-4 h-4 text-medium-emphasis mr-1" />
              </template>
            </v-text-field>

            <v-select
              v-model="filterTrangThai"
              :items="[
                { title: 'Tất cả trạng thái', value: '' },
                { title: 'Đang làm việc', value: '1' },
                { title: 'Đã nghỉ', value: '0' }
              ]"
              item-title="title"
              item-value="value"
              label="Trạng thái"
              density="compact"
              variant="outlined"
              hide-details
              rounded="lg"
              style="width: 170px;"
            ></v-select>

            <v-select
              v-model="filterGioiTinh"
              :items="[
                { title: 'Tất cả giới tính', value: '' },
                { title: 'Nam', value: 'Nam' },
                { title: 'Nữ', value: 'Nữ' }
              ]"
              item-title="title"
              item-value="value"
              label="Giới tính"
              density="compact"
              variant="outlined"
              hide-details
              rounded="lg"
              style="width: 140px;"
            ></v-select>

            <v-select
              v-model="filterRole"
              :items="[{ title: 'Tất cả chức vụ', value: '' }, ...roles.map(r => ({ title: r.tenChucVu || r.TenChucVu, value: r.maRole || r.MaRole }))]"
              item-title="title"
              item-value="value"
              label="Chức vụ (Role)"
              density="compact"
              variant="outlined"
              hide-details
              rounded="lg"
              style="width: 170px;"
            ></v-select>

            <v-select
              v-model="filterLoaiNv"
              :items="[{ title: 'Tất cả phân loại', value: '' }, ...loaiNvs.map(l => ({ title: l.tenLoai || l.TenLoai, value: l.maLoaiNv || l.MaLoaiNv || l.maLoaiNV }))]"
              item-title="title"
              item-value="value"
              label="Phân loại NV"
              density="compact"
              variant="outlined"
              hide-details
              rounded="lg"
              style="width: 190px;"
            ></v-select>
          </div>

          <v-btn
            variant="text"
            color="primary"
            rounded="lg"
            class="text-none font-weight-bold"
            height="40"
            @click="() => { searchQuery = ''; filterTrangThai = ''; filterGioiTinh = ''; filterRole = ''; filterLoaiNv = ''; fetchNhanViens(); }"
          >
            Đặt lại lọc
          </v-btn>
        </div>
      </v-card>

      <!-- ── DATA TABLE CARD ── -->
      <v-card variant="outlined" rounded="xl" class="overflow-hidden">
        <!-- Loading Indicator -->
        <div v-if="loading" class="d-flex justify-center align-center py-16">
          <v-progress-circular indeterminate color="primary" size="48" />
        </div>

        <!-- Data Table -->
        <div v-else class="overflow-x-auto">
          <v-table hover>
            <thead>
              <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                <th class="text-left py-3 font-weight-bold text-caption" style="width: 260px;">NHÂN VIÊN</th>
                <th class="text-left py-3 font-weight-bold text-caption" style="width: 220px;">NỘI BỘ &amp; TÀI KHOẢN</th>
                <th class="text-left py-3 font-weight-bold text-caption" style="min-width: 250px;">LIÊN HỆ &amp; ĐỊNH DANH</th>
                <th class="text-center py-3 font-weight-bold text-caption" style="width: 140px;">TRẠNG THÁI</th>
                <th class="text-center py-3 font-weight-bold text-caption" style="width: 130px;">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="nv in pagedNhanViens" :key="nv.maNv" class="border-b">
                <!-- Staff info -->
                <td class="py-3">
                  <div class="d-flex align-center gap-3">
                    <v-avatar size="40" color="primary" variant="tonal" rounded="lg">
                      <v-img v-if="nv.hinhAnh" :src="toAbsUrl(nv.hinhAnh)" cover></v-img>
                      <span v-else class="font-weight-bold text-caption">{{ nv.hoTenNv?.charAt(0).toUpperCase() || '?' }}</span>
                    </v-avatar>
                    <div class="d-flex flex-column gap-1">
                      <span class="font-weight-bold text-body-2">{{ nv.hoTenNv }}</span>
                      <span class="text-caption font-mono text-medium-emphasis">Mã: {{ nv.maNv }}</span>
                      
                      <div class="d-flex align-center gap-1 flex-wrap mt-0.5">
                        <v-chip size="x-small" color="primary" variant="flat" class="font-weight-bold" title="Chức vụ (Quyền hệ thống)">
                          {{ getRoleName(nv) }}
                        </v-chip>
                        <v-chip size="x-small" color="purple" variant="tonal" class="font-weight-bold" title="Phân loại vị trí công việc">
                          {{ getLoaiNvName(nv) }}
                        </v-chip>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Internal & Account -->
                <td class="py-3">
                  <div class="font-weight-bold text-body-2 font-mono">
                    {{ nv.tenDangNhap || '-- Chưa cấp TK --' }}
                  </div>
                  <div v-if="nv.ngayVaoLam" class="text-caption text-medium-emphasis mt-1 d-flex align-center gap-1">
                    <Calendar class="w-3.5 h-3.5 text-medium-emphasis" />
                    <span>Ngày vào: {{ formatDate(nv.ngayVaoLam) }}</span>
                  </div>
                </td>

                <!-- Contact & Identity -->
                <td class="py-3">
                  <div class="font-weight-bold text-body-2 d-flex align-center gap-1">
                    <Phone class="w-3.5 h-3.5 text-primary" />
                    <span>{{ nv.sdt }}</span>
                  </div>
                  <div v-if="nv.cccd" class="text-caption text-medium-emphasis mt-0.5">
                    CCCD: <span class="font-mono font-weight-bold">{{ nv.cccd }}</span> - SN: <span class="font-weight-bold">{{ nv.namSinh }}</span>
                  </div>
                  <div v-if="nv.diaChi" class="text-caption text-medium-emphasis mt-0.5 d-flex align-center gap-1 text-truncate" style="max-width: 260px;" :title="nv.diaChi">
                    <MapPin class="w-3.5 h-3.5 text-medium-emphasis flex-shrink-0" />
                    <span class="text-truncate">{{ nv.diaChi }}</span>
                  </div>
                </td>

                <!-- Status -->
                <td class="text-center py-3">
                  <v-chip size="small" :color="nv.trangThai === 1 ? 'success' : 'error'" variant="tonal" class="font-weight-bold text-caption">
                    {{ nv.trangThai === 1 ? 'Đang làm việc' : 'Đã nghỉ' }}
                  </v-chip>
                </td>

                <!-- Actions -->
                <td class="text-center py-3">
                  <div class="d-flex align-center justify-center gap-1">
                    <v-btn icon size="small" variant="text" color="warning" @click="openReviewModal(nv)" title="Xem đánh giá">
                      <Eye class="w-4 h-4" />
                    </v-btn>
                    <v-btn icon size="small" variant="text" color="primary" @click="openEditForm(nv)" title="Sửa thông tin">
                      <Edit3 class="w-4 h-4" />
                    </v-btn>
                    <v-btn icon size="small" variant="text" color="error" @click="deleteNhanVien(nv.maNv)" title="Xóa nhân viên">
                      <Trash2 class="w-4 h-4" />
                    </v-btn>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredNhanViens.length === 0">
                <td colspan="5" class="text-center py-16 text-medium-emphasis">
                  <Users class="w-10 h-10 mx-auto mb-2 text-slate-300 opacity-50" />
                  <div class="font-weight-bold text-body-2">Không tìm thấy dữ liệu nhân viên</div>
                  <div class="text-caption">Không có nhân viên nào trùng khớp với bộ lọc tìm kiếm.</div>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>

        <!-- Pagination Controls -->
        <v-divider></v-divider>
        <div class="pa-4 d-flex align-center justify-space-between flex-wrap gap-2">
          <div class="text-caption text-medium-emphasis">
            Hiển thị <strong class="text-high-emphasis">{{ pagedNhanViens.length }}</strong> trên tổng số <strong class="text-high-emphasis">{{ filteredNhanViens.length }}</strong> nhân viên
          </div>
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="5"
            density="comfortable"
            rounded="lg"
            size="small"
          ></v-pagination>
        </div>
      </v-card>
    </div>

    <!-- ── SCANNER MODAL ── -->
    <v-dialog v-model="showScanner" max-width="500px" persistent>
      <v-card rounded="xl" class="overflow-hidden">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
          <div class="d-flex align-center gap-3">
            <v-avatar color="info" variant="tonal" size="44" rounded="lg">
              <Camera class="w-5 h-5 text-info" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">Quét Thông Tin CCCD</h3>
              <div class="text-caption text-medium-emphasis">Trích xuất tự động thông tin từ mã QR</div>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeScannerModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6 text-center">
          <p class="text-body-2 mb-4 text-medium-emphasis">
            Tải lên hình ảnh mặt trước của CCCD để hệ thống tự động trích xuất thông tin nhân viên.
          </p>
          
          <v-alert type="info" variant="tonal" rounded="lg" class="text-left text-caption mb-6">
            <strong>LƯU Ý:</strong> Ảnh chụp CCCD phải rõ nét, nằm ngang và không bị lóa sáng.
          </v-alert>

          <v-btn color="primary" height="48" block rounded="lg" class="position-relative overflow-hidden text-none font-weight-bold">
            <template v-slot:prepend><Camera class="w-5 h-5 mr-1" /></template>
            Chọn ảnh / Chụp ảnh CCCD
            <input type="file" accept="image/*" @change="processIdCardImage" class="position-absolute opacity-0 w-100 h-100" style="cursor: pointer; left: 0; top: 0;">
          </v-btn>

          <div v-if="isScanning" class="mt-6 d-flex flex-column align-center">
            <v-progress-circular indeterminate color="primary" size="32" class="mb-2" />
            <div class="text-caption font-weight-bold text-primary">{{ scanProgress }}</div>
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- ── REVIEWS MODAL ── -->
    <v-dialog v-model="showReviewModal" max-width="900px" scrollable>
      <v-card rounded="xl" class="overflow-hidden">
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
          <div class="d-flex align-center gap-3">
            <v-avatar color="warning" variant="tonal" rounded="lg" size="48">
              <Award class="w-6 h-6 text-warning" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">Đánh Giá Khách Hàng</h3>
              <div class="text-caption text-medium-emphasis">
                Nhân viên: <strong class="text-primary">{{ selectedNvName }}</strong>
              </div>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeReviewModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>

        <v-card-text class="pa-6" style="max-height: 500px;">
          <div v-if="loadingReviews" class="d-flex flex-column align-center justify-center py-12">
            <v-progress-circular indeterminate color="primary" size="40" class="mb-3" />
            <span class="text-caption font-weight-bold text-primary">Đang nạp dữ liệu đánh giá...</span>
          </div>

          <div v-else-if="reviewsList.length === 0" class="d-flex flex-column align-center justify-center py-12 text-medium-emphasis">
            <Star class="w-10 h-10 mb-2 opacity-30" />
            <div class="text-body-2 font-weight-bold">Chưa có đánh giá nào</div>
            <div class="text-caption">Nhân viên này chưa có phản hồi đánh giá nào từ khách hàng.</div>
          </div>

          <div v-else class="overflow-x-auto">
            <v-table hover class="border rounded-xl">
              <thead>
                <tr class="border-b" style="background-color: rgba(var(--v-theme-on-surface), 0.04);">
                  <th class="text-center py-3 text-caption font-weight-bold" style="width: 70px;">STT</th>
                  <th class="text-center py-3 text-caption font-weight-bold" style="width: 130px;">ĐIỂM ĐÁNH GIÁ</th>
                  <th class="text-left py-3 text-caption font-weight-bold">NỘI DUNG LỜI BÌNH</th>
                  <th class="text-center py-3 text-caption font-weight-bold" style="width: 140px;">DỊCH VỤ</th>
                  <th class="text-center py-3 text-caption font-weight-bold" style="width: 130px;">TRẠNG THÁI</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(review, index) in reviewsList" :key="index" class="border-b">
                  <td class="text-center font-weight-bold font-mono text-caption">{{ index + 1 }}</td>
                  <td class="text-center">
                    <v-chip color="warning" variant="tonal" size="small" class="font-weight-bold">
                      {{ review.diem || review.soSao || 5 }}.0
                      <Star class="w-3.5 h-3.5 fill-amber-400 text-amber-400 ml-1 inline" />
                    </v-chip>
                  </td>
                  <td>
                    <div class="text-body-2 font-italic">
                      "{{ review.noiDung || review.binhLuan || 'Khách hàng không để lại bình luận chi tiết.' }}"
                    </div>
                  </td>
                  <td class="text-center">
                    <v-chip size="x-small" variant="tonal" class="font-weight-bold">Dịch vụ Salon</v-chip>
                  </td>
                  <td class="text-center">
                    <v-chip size="x-small" color="success" variant="tonal" class="font-weight-bold text-caption">ĐÃ XÁC MINH</v-chip>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>

        <v-divider></v-divider>
        <v-card-actions class="pa-4 justify-end">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold px-5" @click="closeReviewModal">
            Đóng
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── ADD / EDIT FORM MODAL ── -->
    <v-dialog v-model="showModal" max-width="900px" scrollable persistent>
      <v-card rounded="xl" class="overflow-hidden">
        <!-- Header -->
        <v-card-title class="pa-6 border-b d-flex align-center justify-space-between bg-surface">
          <div class="d-flex align-center gap-3">
            <v-avatar color="primary" variant="tonal" rounded="lg" size="48">
              <Users class="w-6 h-6 text-primary" />
            </v-avatar>
            <div>
              <h3 class="text-h6 font-weight-bold mb-0">
                {{ isEditMode ? 'Cập Nhật Thông Tin Nhân Viên' : 'Thêm Nhân Viên Mới' }}
              </h3>
              <div class="text-caption text-medium-emphasis">
                {{ isEditMode ? 'Sửa thông tin hồ sơ, chức vụ và tài khoản nhân viên' : 'Nhập đầy đủ thông tin để cấp tài khoản nhân viên mới' }}
              </div>
            </div>
          </div>
          <v-btn icon variant="text" density="comfortable" @click="closeModal">
            <X class="w-5 h-5" />
          </v-btn>
        </v-card-title>
        
        <!-- Body -->
        <v-card-text class="pa-6" style="max-height: 65vh;">
          <v-form @submit.prevent="saveNhanVien" id="nhanVienForm">
            <v-row>
              <!-- Avatar Upload -->
              <v-col cols="12" md="4" lg="3" class="d-flex flex-column align-center gap-4">
                <v-avatar size="140" rounded="circle" class="elevation-2 border" color="primary" variant="tonal">
                  <v-img v-if="imagePreviewUrl" :src="imagePreviewUrl" cover></v-img>
                  <div v-else class="text-center pa-2">
                    <Users class="w-8 h-8 mx-auto mb-1 text-primary opacity-50" />
                    <span class="text-caption font-weight-bold text-medium-emphasis d-block">Chưa có ảnh</span>
                  </div>
                </v-avatar>
                <v-btn variant="outlined" color="primary" class="position-relative text-none font-weight-bold" rounded="lg">
                  Chọn ảnh đại diện
                  <input type="file" accept="image/*" @change="handleImageUpload" class="position-absolute opacity-0 w-100 h-100" style="cursor: pointer; left: 0; top: 0;">
                </v-btn>
              </v-col>

              <!-- Form Fields -->
              <v-col cols="12" md="8" lg="9">
                <!-- Section 1 -->
                <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Thông Tin Cá Nhân</div>
                <v-row dense>
                  <v-col cols="12" sm="8">
                    <v-text-field v-model="formData.hoTenNv" label="Họ Tên *" :error-messages="errors.hoTenNv" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-select v-model="formData.gioiTinh" :items="['Nam', 'Nữ']" label="Giới tính" variant="outlined" density="compact" rounded="lg"></v-select>
                  </v-col>
                  <v-col cols="12" sm="4">
                    <v-text-field v-model="formData.namSinh" type="number" label="Năm sinh *" :error-messages="errors.namSinh" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="8">
                    <v-text-field v-model="formData.cccd" label="Số CCCD" :error-messages="errors.cccd" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field v-model="formData.sdt" label="Số Điện Thoại *" :error-messages="errors.sdt" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field v-model="formData.email" label="Email" type="email" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12">
                    <v-text-field v-model="formData.diaChi" label="Địa chỉ thường trú" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                </v-row>

                <!-- Section 2 -->
                <v-divider class="my-4"></v-divider>
                <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Thông Tin Công Việc</div>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field 
                      v-model="formData.maNv" 
                      label="Mã NV *" 
                      :disabled="isEditMode" 
                      :error-messages="errors.maNv" 
                      variant="outlined" 
                      density="compact" 
                      rounded="lg"
                      placeholder="VD: NV123456"
                    >
                      <template v-if="!isEditMode" #append-inner>
                        <v-tooltip text="Tạo lại mã ngẫu nhiên mới" location="top">
                          <template v-slot:activator="{ props }">
                            <v-btn v-bind="props" icon size="x-small" variant="text" color="primary" @click="formData.maNv = generateUniqueStaffCode()">
                              <RotateCcw class="w-3.5 h-3.5" />
                            </v-btn>
                          </template>
                        </v-tooltip>
                      </template>
                    </v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select 
                      v-model="formData.maRole" 
                      :items="roles" 
                      :item-title="item => item.tenChucVu || item.TenChucVu || item.tenRole" 
                      :item-value="item => item.maRole || item.MaRole" 
                      label="Chức vụ (Quyền hệ thống) *" 
                      variant="outlined" 
                      density="compact" 
                      rounded="lg"
                    ></v-select>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select 
                      v-model="formData.maLoaiNv" 
                      :items="loaiNvs" 
                      :item-title="item => item.tenLoai || item.TenLoai || item.tenLoaiNv" 
                      :item-value="item => item.maLoaiNv || item.MaLoaiNv || item.maLoaiNV" 
                      label="Phân loại NV (Vị trí công việc) *" 
                      variant="outlined" 
                      density="compact" 
                      rounded="lg"
                    ></v-select>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field :model-value="formatVND(currentLoaiLuong)" label="Lương cơ bản" readonly disabled variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field v-model="formData.ngayVaoLam" type="date" label="Ngày vào làm" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select v-model="formData.trangThai" :items="[{title:'Đang làm việc', value: 1}, {title:'Đã nghỉ', value: 0}]" item-title="title" item-value="value" label="Trạng thái công việc" variant="outlined" density="compact" rounded="lg"></v-select>
                  </v-col>
                </v-row>

                <!-- Section 3 -->
                <v-divider class="my-4"></v-divider>
                <div class="text-subtitle-2 font-weight-bold text-uppercase text-primary mb-3">Tài Khoản Đăng Nhập</div>
                <v-row dense>
                  <v-col cols="12" sm="6">
                    <v-text-field v-model="formData.tenDangNhap" label="Tên đăng nhập" :error-messages="errors.tenDangNhap" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field v-model="formData.matKhau" type="password" :label="isEditMode ? 'Mật khẩu mới (Bỏ trống nếu giữ nguyên)' : 'Mật khẩu đăng nhập'" :error-messages="errors.matKhau" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                  <v-col cols="12" v-if="isEditMode">
                    <v-text-field v-model="formData.matKhauCu" type="password" label="Mật khẩu cũ (Yêu cầu khi đổi mật khẩu mới)" :error-messages="errors.matKhauCu" variant="outlined" density="compact" rounded="lg"></v-text-field>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>
        
        <!-- Footer -->
        <v-divider></v-divider>
        <v-card-actions class="pa-4 justify-end">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold px-5" @click="closeModal">Hủy bỏ</v-btn>
          <v-btn variant="flat" color="primary" rounded="lg" class="text-none font-weight-bold px-5" type="submit" form="nhanVienForm">Lưu thông tin</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ── NATIVE CONFIRM DIALOG ── -->
    <v-dialog v-model="confirmDialog.open" max-width="440px">
      <v-card rounded="xl" class="pa-6">
        <div class="d-flex align-center gap-3 mb-4">
          <v-avatar :color="confirmDialog.color" variant="tonal" size="48" rounded="lg">
            <Trash2 class="w-6 h-6" :class="`text-${confirmDialog.color}`" />
          </v-avatar>
          <div>
            <h3 class="text-h6 font-weight-bold mb-0">{{ confirmDialog.title }}</h3>
            <p class="text-caption text-medium-emphasis mb-0">Xác nhận thao tác</p>
          </div>
        </div>

        <p class="text-body-2 mb-6 text-medium-emphasis">
          {{ confirmDialog.message }}
        </p>

        <div class="d-flex justify-end gap-2">
          <v-btn variant="outlined" rounded="lg" class="text-none font-weight-bold" @click="confirmDialog.open = false">
            Hủy bỏ
          </v-btn>
          <v-btn :color="confirmDialog.color" variant="flat" rounded="lg" class="text-none font-weight-bold text-white" :loading="confirmDialog.loading" @click="executeConfirmAction">
            {{ confirmDialog.confirmText }}
          </v-btn>
        </div>
      </v-card>
    </v-dialog>

    <!-- ── LEADERBOARD MODAL ── -->
    <ThongKeNhanVienModal :isOpen="showThongKeModal" @close="showThongKeModal = false" />
  </v-container>
</template>
