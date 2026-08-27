import axios from 'axios';

export interface BankItem {
  id?: number;
  code: string;
  bin: string;
  shortName: string;
  name: string;
  displayName: string;
  logo: string;
}

/**
 * Danh sách toàn bộ 65 ngân hàng & ví điện tử tại Việt Nam theo chuẩn Napas 24/7 & VietQR
 */
export const DANH_SACH_NGAN_HANG_VN: BankItem[] = [
  {
    code: "VCB",
    bin: "970436",
    shortName: "Vietcombank",
    name: "Ngân hàng TMCP Ngoại Thương Việt Nam",
    displayName: "Vietcombank (VCB) - Ngoại Thương Việt Nam",
    logo: "https://cdn.vietqr.io/img/VCB.png"
  },
  {
    code: "MB",
    bin: "970422",
    shortName: "MBBank",
    name: "Ngân hàng TMCP Quân đội",
    displayName: "MBBank (MB) - Quân Đội",
    logo: "https://cdn.vietqr.io/img/MB.png"
  },
  {
    code: "TCB",
    bin: "970407",
    shortName: "Techcombank",
    name: "Ngân hàng TMCP Kỹ thương Việt Nam",
    displayName: "Techcombank (TCB) - Kỹ Thương Việt Nam",
    logo: "https://cdn.vietqr.io/img/TCB.png"
  },
  {
    code: "ICB",
    bin: "970415",
    shortName: "VietinBank",
    name: "Ngân hàng TMCP Công thương Việt Nam",
    displayName: "VietinBank (CTG) - Công Thương Việt Nam",
    logo: "https://cdn.vietqr.io/img/ICB.png"
  },
  {
    code: "BIDV",
    bin: "970418",
    shortName: "BIDV",
    name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam",
    displayName: "BIDV - Đầu Tư & Phát Triển Việt Nam",
    logo: "https://cdn.vietqr.io/img/BIDV.png"
  },
  {
    code: "ACB",
    bin: "970416",
    shortName: "ACB",
    name: "Ngân hàng TMCP Á Châu",
    displayName: "ACB - Á Châu",
    logo: "https://cdn.vietqr.io/img/ACB.png"
  },
  {
    code: "VPB",
    bin: "970432",
    shortName: "VPBank",
    name: "Ngân hàng TMCP Việt Nam Thịnh Vượng",
    displayName: "VPBank - Việt Nam Thịnh Vượng",
    logo: "https://cdn.vietqr.io/img/VPB.png"
  },
  {
    code: "TPB",
    bin: "970423",
    shortName: "TPBank",
    name: "Ngân hàng TMCP Tiên Phong",
    displayName: "TPBank - Tiên Phong",
    logo: "https://cdn.vietqr.io/img/TPB.png"
  },
  {
    code: "STB",
    bin: "970403",
    shortName: "Sacombank",
    name: "Ngân hàng TMCP Sài Gòn Thương Tín",
    displayName: "Sacombank (STB) - Sài Gòn Thương Tín",
    logo: "https://cdn.vietqr.io/img/STB.png"
  },
  {
    code: "HDB",
    bin: "970437",
    shortName: "HDBank",
    name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh",
    displayName: "HDBank - Phát Triển TP.HCM",
    logo: "https://cdn.vietqr.io/img/HDB.png"
  },
  {
    code: "VBA",
    bin: "970405",
    shortName: "Agribank",
    name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam",
    displayName: "Agribank (VBA) - Nông Nghiệp & PTNT",
    logo: "https://cdn.vietqr.io/img/VBA.png"
  },
  {
    code: "VIB",
    bin: "970441",
    shortName: "VIB",
    name: "Ngân hàng TMCP Quốc tế Việt Nam",
    displayName: "VIB - Quốc Tế Việt Nam",
    logo: "https://cdn.vietqr.io/img/VIB.png"
  },
  {
    code: "SHB",
    bin: "970443",
    shortName: "SHB",
    name: "Ngân hàng TMCP Sài Gòn - Hà Nội",
    displayName: "SHB - Sài Gòn - Hà Nội",
    logo: "https://cdn.vietqr.io/img/SHB.png"
  },
  {
    code: "OCB",
    bin: "970448",
    shortName: "OCB",
    name: "Ngân hàng TMCP Phương Đông",
    displayName: "OCB - Phương Đông",
    logo: "https://cdn.vietqr.io/img/OCB.png"
  },
  {
    code: "MSB",
    bin: "970426",
    shortName: "MSB",
    name: "Ngân hàng TMCP Hàng Hải Việt Nam",
    displayName: "MSB - Hàng Hải Việt Nam",
    logo: "https://cdn.vietqr.io/img/MSB.png"
  },
  {
    code: "LPB",
    bin: "970449",
    shortName: "LPBank",
    name: "Ngân hàng TMCP Lộc Phát Việt Nam",
    displayName: "LPBank (LienVietPostBank) - Lộc Phát Việt Nam",
    logo: "https://cdn.vietqr.io/img/LPB.png"
  },
  {
    code: "SEAB",
    bin: "970440",
    shortName: "SeABank",
    name: "Ngân hàng TMCP Đông Nam Á",
    displayName: "SeABank - Đông Nam Á",
    logo: "https://cdn.vietqr.io/img/SEAB.png"
  },
  {
    code: "TIMO",
    bin: "963388",
    shortName: "Timo",
    name: "Ngân hàng số Timo by Ban Viet Bank",
    displayName: "Timo Digital Bank",
    logo: "https://cdn.vietqr.io/img/TIMO.png"
  },
  {
    code: "CAKE",
    bin: "546034",
    shortName: "CAKE",
    name: "Ngân hàng số CAKE by VPBank",
    displayName: "CAKE by VPBank",
    logo: "https://cdn.vietqr.io/img/CAKE.png"
  },
  {
    code: "Ubank",
    bin: "546035",
    shortName: "Ubank",
    name: "Ngân hàng số Ubank by VPBank",
    displayName: "Ubank by VPBank",
    logo: "https://cdn.vietqr.io/img/UBANK.png"
  },
  {
    code: "Vikki",
    bin: "970406",
    shortName: "Vikki",
    name: "Ngân hàng TNHH MTV Số Vikki",
    displayName: "Vikki - Ngân hàng số Vikki",
    logo: "https://cdn.vietqr.io/img/Vikki.png"
  },
  {
    code: "EIB",
    bin: "970431",
    shortName: "Eximbank",
    name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam",
    displayName: "Eximbank - Xuất Nhập Khẩu",
    logo: "https://cdn.vietqr.io/img/EIB.png"
  },
  {
    code: "VCCB",
    bin: "970454",
    shortName: "VietCapitalBank",
    name: "Ngân hàng TMCP Bản Việt",
    displayName: "BVBank (VietCapitalBank) - Bản Việt",
    logo: "https://cdn.vietqr.io/img/VCCB.png"
  },
  {
    code: "SCB",
    bin: "970429",
    shortName: "SCB",
    name: "Ngân hàng TMCP Sài Gòn",
    displayName: "SCB - Sài Gòn",
    logo: "https://cdn.vietqr.io/img/SCB.png"
  },
  {
    code: "BAB",
    bin: "970409",
    shortName: "BacABank",
    name: "Ngân hàng TMCP Bắc Á",
    displayName: "BacABank - Bắc Á",
    logo: "https://cdn.vietqr.io/img/BAB.png"
  },
  {
    code: "NCB",
    bin: "970419",
    shortName: "NCB",
    name: "Ngân hàng TMCP Quốc Dân",
    displayName: "NCB - Quốc Dân",
    logo: "https://cdn.vietqr.io/img/NCB.png"
  },
  {
    code: "PVCB",
    bin: "970412",
    shortName: "PVcomBank",
    name: "Ngân hàng TMCP Đại Chúng Việt Nam",
    displayName: "PVcomBank - Đại Chúng Việt Nam",
    logo: "https://cdn.vietqr.io/img/PVCB.png"
  },
  {
    code: "PVDB",
    bin: "971133",
    shortName: "PVcomBank Pay",
    name: "Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số",
    displayName: "PVcomBank Pay (Ngân hàng số)",
    logo: "https://cdn.vietqr.io/img/PVCB.png"
  },
  {
    code: "SHBVN",
    bin: "970424",
    shortName: "ShinhanBank",
    name: "Ngân hàng TNHH MTV Shinhan Việt Nam",
    displayName: "Shinhan Bank - Shinhan Việt Nam",
    logo: "https://cdn.vietqr.io/img/SHBVN.png"
  },
  {
    code: "ABB",
    bin: "970425",
    shortName: "ABBANK",
    name: "Ngân hàng TMCP An Bình",
    displayName: "ABBANK - An Bình",
    logo: "https://cdn.vietqr.io/img/ABB.png"
  },
  {
    code: "VAB",
    bin: "970427",
    shortName: "VietABank",
    name: "Ngân hàng TMCP Việt Á",
    displayName: "VietABank - Việt Á",
    logo: "https://cdn.vietqr.io/img/VAB.png"
  },
  {
    code: "NAB",
    bin: "970428",
    shortName: "NamABank",
    name: "Ngân hàng TMCP Nam Á",
    displayName: "Nam A Bank - Nam Á",
    logo: "https://cdn.vietqr.io/img/NAB.png"
  },
  {
    code: "PGB",
    bin: "970430",
    shortName: "PGBank",
    name: "Ngân hàng TMCP Thịnh vượng và Phát triển",
    displayName: "PGBank - Thịnh Vượng & Phát Triển",
    logo: "https://cdn.vietqr.io/img/PGB.png"
  },
  {
    code: "VIETBANK",
    bin: "970433",
    shortName: "VietBank",
    name: "Ngân hàng TMCP Việt Nam Thương Tín",
    displayName: "VietBank - Việt Nam Thương Tín",
    logo: "https://cdn.vietqr.io/img/VIETBANK.png"
  },
  {
    code: "BVB",
    bin: "970438",
    shortName: "BaoVietBank",
    name: "Ngân hàng TMCP Bảo Việt",
    displayName: "BaoViet Bank - Bảo Việt",
    logo: "https://cdn.vietqr.io/img/BVB.png"
  },
  {
    code: "SGICB",
    bin: "970400",
    shortName: "SaigonBank",
    name: "Ngân hàng TMCP Sài Gòn Công Thương",
    displayName: "SaigonBank - Sài Gòn Công Thương",
    logo: "https://cdn.vietqr.io/img/SGICB.png"
  },
  {
    code: "COOPBANK",
    bin: "970446",
    shortName: "COOPBANK",
    name: "Ngân hàng Hợp tác xã Việt Nam",
    displayName: "Co-opBank - Hợp Tác Xã Việt Nam",
    logo: "https://cdn.vietqr.io/img/COOPBANK.png"
  },
  {
    code: "KLB",
    bin: "970452",
    shortName: "KienLongBank",
    name: "Ngân hàng TMCP Kiên Long",
    displayName: "KienlongBank - Kiên Long",
    logo: "https://cdn.vietqr.io/img/KLB.png"
  },
  {
    code: "KBank",
    bin: "668888",
    shortName: "KBank",
    name: "Ngân hàng Đại chúng TNHH Kasikornbank",
    displayName: "KBank - Kasikornbank",
    logo: "https://cdn.vietqr.io/img/KBANK.png"
  },
  {
    code: "WVN",
    bin: "970457",
    shortName: "Woori",
    name: "Ngân hàng TNHH MTV Woori Việt Nam",
    displayName: "Woori Bank - Woori Việt Nam",
    logo: "https://cdn.vietqr.io/img/WVN.png"
  },
  {
    code: "VRB",
    bin: "970421",
    shortName: "VRB",
    name: "Ngân hàng Liên doanh Việt - Nga",
    displayName: "VRB - Liên Doanh Việt - Nga",
    logo: "https://cdn.vietqr.io/img/VRB.png"
  },
  {
    code: "HSBC",
    bin: "458761",
    shortName: "HSBC",
    name: "Ngân hàng TNHH MTV HSBC (Việt Nam)",
    displayName: "HSBC Việt Nam",
    logo: "https://cdn.vietqr.io/img/HSBC.png"
  },
  {
    code: "HLBVN",
    bin: "970442",
    shortName: "HongLeong",
    name: "Ngân hàng TNHH MTV Hong Leong Việt Nam",
    displayName: "Hong Leong Bank Việt Nam",
    logo: "https://cdn.vietqr.io/img/HLBVN.png"
  },
  {
    code: "SCVN",
    bin: "970410",
    shortName: "StandardChartered",
    name: "Ngân hàng TNHH MTV Standard Chartered Bank Việt Nam",
    displayName: "Standard Chartered Việt Nam",
    logo: "https://cdn.vietqr.io/img/SCVN.png"
  },
  {
    code: "PBVN",
    bin: "970439",
    shortName: "PublicBank",
    name: "Ngân hàng TNHH MTV Public Việt Nam",
    displayName: "Public Bank Việt Nam",
    logo: "https://cdn.vietqr.io/img/PBVN.png"
  },
  {
    code: "IVB",
    bin: "970434",
    shortName: "IndovinaBank",
    name: "Ngân hàng TNHH Indovina",
    displayName: "Indovina Bank (IVB)",
    logo: "https://cdn.vietqr.io/img/IVB.png"
  },
  {
    code: "CIMB",
    bin: "422589",
    shortName: "CIMB",
    name: "Ngân hàng TNHH MTV CIMB Việt Nam",
    displayName: "CIMB Bank Việt Nam",
    logo: "https://cdn.vietqr.io/img/CIMB.png"
  },
  {
    code: "UOB",
    bin: "970458",
    shortName: "UnitedOverseas",
    name: "Ngân hàng United Overseas - Chi nhánh TP. Hồ Chí Minh",
    displayName: "UOB Việt Nam",
    logo: "https://cdn.vietqr.io/img/UOB.png"
  },
  {
    code: "CITIBANK",
    bin: "533948",
    shortName: "Citibank",
    name: "Ngân hàng Citibank, N.A. - Chi nhánh Hà Nội",
    displayName: "Citibank Việt Nam",
    logo: "https://cdn.vietqr.io/img/CITIBANK.png"
  },
  {
    code: "DBS",
    bin: "796500",
    shortName: "DBSBank",
    name: "DBS Bank Ltd - Chi nhánh Thành phố Hồ Chí Minh",
    displayName: "DBS Bank Việt Nam",
    logo: "https://cdn.vietqr.io/img/DBS.png"
  },
  {
    code: "KBHN",
    bin: "970462",
    shortName: "KookminHN",
    name: "Ngân hàng Kookmin - Chi nhánh Hà Nội",
    displayName: "Kookmin Bank Hà Nội",
    logo: "https://cdn.vietqr.io/img/KBHN.png"
  },
  {
    code: "KBHCM",
    bin: "970463",
    shortName: "KookminHCM",
    name: "Ngân hàng Kookmin - Chi nhánh Thành phố Hồ Chí Minh",
    displayName: "Kookmin Bank TP.HCM",
    logo: "https://cdn.vietqr.io/img/KBHCM.png"
  },
  {
    code: "KEBHANAHN",
    bin: "970467",
    shortName: "KEBHANAHN",
    name: "Ngân hàng KEB Hana – Chi nhánh Hà Nội",
    displayName: "KEB Hana Bank Hà Nội",
    logo: "https://cdn.vietqr.io/img/KEBHANAHN.png"
  },
  {
    code: "KEBHANAHCM",
    bin: "970466",
    shortName: "KEBHanaHCM",
    name: "Ngân hàng KEB Hana – Chi nhánh Thành phố Hồ Chí Minh",
    displayName: "KEB Hana Bank TP.HCM",
    logo: "https://cdn.vietqr.io/img/KEBHANAHCM.png"
  },
  {
    code: "IBK - HN",
    bin: "970455",
    shortName: "IBKHN",
    name: "Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh Hà Nội",
    displayName: "IBK Bank Hà Nội",
    logo: "https://cdn.vietqr.io/img/IBK.png"
  },
  {
    code: "IBK - HCM",
    bin: "970456",
    shortName: "IBKHCM",
    name: "Ngân hàng Công nghiệp Hàn Quốc - Chi nhánh TP. Hồ Chí Minh",
    displayName: "IBK Bank TP.HCM",
    logo: "https://cdn.vietqr.io/img/IBK.png"
  },
  {
    code: "NHB HN",
    bin: "801011",
    shortName: "Nonghyup",
    name: "Ngân hàng Nonghyup - Chi nhánh Hà Nội",
    displayName: "Nonghyup Bank Hà Nội",
    logo: "https://cdn.vietqr.io/img/NHB.png"
  },
  {
    code: "CBB",
    bin: "970444",
    shortName: "CBBank",
    name: "Ngân hàng Thương mại TNHH MTV Xây dựng Việt Nam",
    displayName: "CB - Xây Dựng (CBBank)",
    logo: "https://cdn.vietqr.io/img/CBB.png"
  },
  {
    code: "GPB",
    bin: "970408",
    shortName: "GPBank",
    name: "Ngân hàng Thương mại TNHH MTV Dầu Khí Toàn Cầu",
    displayName: "GPBank - Dầu Khí Toàn Cầu",
    logo: "https://cdn.vietqr.io/img/GPB.png"
  },
  {
    code: "MBV",
    bin: "970414",
    shortName: "MBV",
    name: "Ngân hàng TNHH MTV Việt Nam Hiện Đại",
    displayName: "MBV - Việt Nam Hiện Đại (OceanBank)",
    logo: "https://cdn.vietqr.io/img/MBV.png"
  },
  {
    code: "VBSP",
    bin: "999888",
    shortName: "VBSP",
    name: "Ngân hàng Chính sách Xã hội",
    displayName: "VBSP - Chính Sách Xã Hội",
    logo: "https://cdn.vietqr.io/img/VBSP.png"
  },
  {
    code: "MAFC",
    bin: "977777",
    shortName: "MAFC",
    name: "Công ty Tài chính TNHH MTV Mirae Asset (Việt Nam)",
    displayName: "Mirae Asset Finance (MAFC)",
    logo: "https://cdn.vietqr.io/img/MAFC.png"
  },
  {
    code: "momo",
    bin: "971025",
    shortName: "MoMo",
    name: "CTCP Dịch Vụ Di Động Trực Tuyến",
    displayName: "Ví điện tử MoMo",
    logo: "https://cdn.vietqr.io/img/momo.png"
  },
  {
    code: "VTLMONEY",
    bin: "971005",
    shortName: "ViettelMoney",
    name: "Tổng Công ty Dịch vụ số Viettel",
    displayName: "Viettel Money (ViettelPay)",
    logo: "https://cdn.vietqr.io/img/VTLMONEY.png"
  },
  {
    code: "VNPTMONEY",
    bin: "971011",
    shortName: "VNPTMoney",
    name: "VNPT Money",
    displayName: "VNPT Money",
    logo: "https://cdn.vietqr.io/img/VNPTMONEY.png"
  }
];

export const DANH_SACH_TEN_NGAN_HANG: string[] = DANH_SACH_NGAN_HANG_VN.map(b => b.displayName);

let cachedLiveBanks: BankItem[] = [];

/**
 * Lấy danh sách ngân hàng tự động cập nhật từ API VietQR chính thức (kèm cache)
 */
export const fetchDanhSachNganHangLive = async (): Promise<BankItem[]> => {
  if (cachedLiveBanks.length > 0) {
    return cachedLiveBanks;
  }

  try {
    const res = await fetch('https://api.vietqr.io/v2/banks', {
      method: 'GET',
      credentials: 'omit',
      headers: {
        'Accept': 'application/json'
      }
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.code === '00' && Array.isArray(data.data)) {
        cachedLiveBanks = data.data.map((b: any) => ({
          id: b.id,
          code: b.code,
          bin: b.bin,
          shortName: b.shortName,
          name: b.name,
          displayName: `${b.shortName} (${b.code}) - ${b.name}`,
          logo: b.logo
        }));
        return cachedLiveBanks;
      }
    }
  } catch (err) {
    console.warn('Không kết nối được VietQR live API, sử dụng danh sách offline mặc định:', err);
  }

  return DANH_SACH_NGAN_HANG_VN;
};
