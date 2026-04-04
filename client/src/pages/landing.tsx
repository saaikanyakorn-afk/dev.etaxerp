import { useState, useEffect, useRef, type ReactNode, useMemo } from "react";
import { useForceLightMode } from "@/hooks/use-force-light";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
const logoWhite = "/logo-etax-white.png";
const ecomDashboardImg = "/assets/image_1771818597209.png";
const dashboardPreview = "/assets/image_1771312538323.png";
import { logoShopee, logoLazada, logoTiktok, logoAmazon, logoLine as logoLineShopping, logoFacebook, logoInstagram } from "@/lib/platform-logos";
const logoGrabfood = "/assets/19743_0_1773104855565.jpg";
const logoLineman = "/assets/8a0a698f585db880a1bf73b4002e0912_0_1773104855565.jpg";
const logoRobinhood = "/assets/robinhood-affiliate-program_Robinhood_Affiliate_Program_0_1773104855567.png";
const businessTabImg = "/assets/image_70790cb3_1773120428368.png";
const accountantTabImg = "/assets/image_4691dd20_1773122439161.png";
const flowStyleImg = "/assets/image_1773454390412.png";
import {
  ShoppingCart, FileText, Users, Calculator, BarChart3, Shield,
  CheckCircle2, ArrowRight, Star, ChevronDown, ChevronUp,
  Store, Menu, X, Globe, Headphones, Phone, Mail, MapPin,
  Layers, Monitor, Cloud, Lock, RefreshCw, UtensilsCrossed,
  Warehouse, Truck, Bot, TrendingUp,
  ClipboardList, Radio, Play, Award, BookOpen, Zap, Building2, GraduationCap,
  Coins, ScanBarcode, MessageSquare, FolderOpen, Palette, Fuel,
  ChevronLeft, ChevronRight, Landmark, FileCheck2, PieChart, Package
} from "lucide-react";
import DevMenu from "@/components/dev-menu";

function LandingVersionBadge() {
  const { data: ver } = useQuery<{ shortHash: string; date: string; version: string }>({
    queryKey: ["/api/version"],
    queryFn: async () => {
      const res = await fetch("/api/version");
      if (!res.ok) return { shortHash: "?", date: "", version: "" };
      return res.json();
    },
    staleTime: Infinity,
  });
  if (!ver || ver.shortHash === "?") return null;
  return (
    <span className="text-xs font-mono text-gray-400 select-none" title={`Build: ${ver.shortHash} (${ver.date?.slice(0, 10)})`} data-testid="text-landing-version">
      v{ver.version || ver.shortHash}
    </span>
  );
}

const NAV_LINKS = [
  { label: "ฟีเจอร์", href: "/features", external: true },
  { label: "แพ็คเกจ & ราคา", href: "/pricing", external: true },
  { label: "วิดีโอสาธิต", href: "#video-demo" },
  { label: "รีวิว", href: "#testimonials" },
  { label: "เกี่ยวกับเรา", href: "/about", external: true },
  { label: "FAQ", href: "#faq" },
  { label: "ติดต่อเรา", href: "/contact", external: true },
];

const FEATURES = [
  {
    icon: ShoppingCart, title: "E-Commerce Hub", color: "#fb9678",
    bg: "#e0f7fa",
    desc: "เชื่อมต่อ Shopee, Lazada, TikTok Shop, Amazon, LINE OA, Facebook, Instagram ดึงออเดอร์อัตโนมัติ Store Clone ข้ามแพลตฟอร์ม"
  },
  {
    icon: FileText, title: "ใบกำกับภาษี & เอกสาร", color: "#05b187",
    bg: "#e8f5e9",
    desc: "ใบเสนอราคา ใบสั่งขาย ใบแจ้งหนี้ ใบกำกับภาษี ใบเสร็จ ใบลดหนี้ ใบเพิ่มหนี้ e-Tax Invoice ส่งอีเมล พิมพ์ได้ 4 รูปแบบ"
  },
  {
    icon: Calculator, title: "บัญชี & ภาษีครบวงจร", color: "#03c9d7",
    bg: "#fff8e1",
    desc: "ผังบัญชี TFRS สมุดรายวัน 5 เล่ม งบการเงิน ภ.พ.30 Bank Reconciliation เครื่องมือบัญชี 10 รายการ Auto Journal Entry แก้ไขได้ก่อนอนุมัติ ภาษีหัก ณ ที่จ่าย"
  },
  {
    icon: Warehouse, title: "คลังสินค้า & WMS", color: "#fb9678",
    bg: "#fce4ec",
    desc: "หลายคลัง Bin Location Zone/Aisle/Shelf Wave/Batch Picking PDA Mobile Interface Real-time Stock Sync Cycle Count"
  },
  {
    icon: Truck, title: "Delivery Hub", color: "#03c9d7",
    bg: "#e8eaf6",
    desc: "Pick-Pack-Ship พิมพ์ใบปะหน้าพัสดุ ติดตามพัสดุ แจ้ง Tracking ผ่าน LINE สแกนบาร์โค้ด Auto-TIV on Ship"
  },
  {
    icon: Store, title: "POS ขายหน้าร้าน", color: "#fec90f",
    bg: "#fff3e0",
    desc: "ระบบแคชเชียร์ สแกนบาร์โค้ด ส่วนลด Hold/Park หลายช่องทางชำระเงิน Cash Reconciliation Auto Journal Entry"
  },
  {
    icon: UtensilsCrossed, title: "POS ร้านอาหาร", color: "#f94d4d",
    bg: "#fce4ec",
    desc: "จัดการโต๊ะ/โซน ส่งครัว KDS Modifier Groups แยกบิล เซอร์วิสชาร์จ เมนูหมวดหมู่ สั่งอาหารผ่าน QR"
  },
  {
    icon: Users, title: "HR & เงินเดือน + ESS", color: "#03c9d7",
    bg: "#fff8e1",
    desc: "ลงเวลา OT เงินเดือน สลิป ภงด.1 ภงด.1ก 50ทวิ ESS Portal ลา/ขอ OT ออนไลน์ สัญญาจ้างดิจิทัล วันหยุดประจำปี"
  },
  {
    icon: Radio, title: "Live Selling & Lucky Draw", color: "#f94d4d",
    bg: "#e0f7fa",
    desc: "จัดการ Live ขายสินค้า จับ CF อัตโนมัติ Lucky Draw AI Live Commerce Agency วิเคราะห์ Performance AIDA Framework"
  },
  {
    icon: Bot, title: "AI & Automation", color: "#05b187",
    bg: "#e8f5e9",
    desc: "AI ตรวจสลิป VAT Product Dictionary Demand Forecasting Chat Auto-Reply 5 Trigger พยากรณ์สินค้า Restock Alert"
  },
  {
    icon: MessageSquare, title: "Unified Chat & Inbox", color: "#03c9d7",
    bg: "#e8eaf6",
    desc: "รวมแชทจากทุกแพลตฟอร์ม Facebook Chat Orders จับ CF อัตโนมัติ ตรวจสลิปด้วย AI Auto-Reply Rules"
  },
  {
    icon: TrendingUp, title: "Dashboard & Analytics", color: "#fb9678",
    bg: "#fff3e0",
    desc: "วิเคราะห์ยอดขาย กำไรต่อออเดอร์ AR/AP Aging รายงาน GL Trial Balance งบกำไรขาดทุน งบดุล Cash Flow"
  },
  {
    icon: Coins, title: "E-Commerce Settlement", color: "#fec90f",
    bg: "#fffcf0",
    desc: "นำเข้ารายงาน Settlement ติดตามยอด Wallet ลงบัญชีค่าธรรมเนียมอัตโนมัติ กระทบยอดข้ามแพลตฟอร์ม"
  },
  {
    icon: ScanBarcode, title: "Barcode & Product", color: "#05b187",
    bg: "#eefbf5",
    desc: "Auto-Generate EAN-13 พิมพ์ Label สินค้าธรรมดา/ชุด/ผลิต BOM โปรโมชั่น Low Stock Alert รองรับ 12 สกุลเงิน"
  },
  {
    icon: Shield, title: "สำนักงานบัญชี", color: "#03c9d7",
    bg: "#e0f7fa",
    desc: "Multi-tenant หลายบริษัท สัญญาจ้างออนไลน์ Work Board คลังเอกสาร FTP Archive White Label Branding Activity Log"
  },
  {
    icon: FolderOpen, title: "คลังเอกสาร & Archive", color: "#fb9678",
    bg: "#f0f7ff",
    desc: "คลังเอกสารหมวดหมู่ FTP Archive สำรองอัตโนมัติ LAN Fallback สำหรับ Head Office Supplier Portal สั่งซื้อออนไลน์"
  },
  {
    icon: Fuel, title: "ปั๊มน้ำมัน (Gas Station)", color: "#05b187",
    bg: "#eefbf5",
    desc: "ตั้งค่าน้ำมัน ถัง ตู้จ่าย บันทึกยอดขายรายวันจากมิเตอร์ สต็อกน้ำมัน จุ่มถัง Oil Loss/Gain ภาษีท้องถิ่น (อบจ.) ลูกค้าเครดิต"
  },
];


const MAIN_PLANS = [
  {
    name: "Starter",
    price: "ฟรี",
    period: "",
    desc: "เริ่มต้นใช้งาน สำหรับธุรกิจขนาดเล็ก",
    color: "#05b187",
    modules: ["บัญชี & ภาษี (พื้นฐาน)", "เอกสาร 50 รายการ/เดือน", "ผู้ใช้ 1 คน", "บัญชีแยกประเภท", "รายงานพื้นฐาน"],
    cta: "เริ่มใช้ฟรี",
    popular: false,
  },
  {
    name: "E-Commerce Hub",
    price: "590",
    period: "บาท/เดือน",
    desc: "สำหรับร้านค้าออนไลน์ ดึงออเดอร์อัตโนมัติ",
    color: "#fb9678",
    modules: ["เชื่อมต่อ 7+ แพลตฟอร์ม", "ดึงออเดอร์อัตโนมัติ", "ออกใบกำกับภาษีอัตโนมัติ", "Sync สต็อกข้ามร้าน", "Live Selling & Lucky Draw", "AI ตรวจสลิป & Chat Auto-Reply", "Dashboard ยอดขาย", "ผู้ใช้ 3 คน"],
    cta: "ดูแพ็คเกจ E-Commerce",
    popular: false,
    link: "/ecommerce-pricing",
  },
  {
    name: "Food Delivery",
    price: "390",
    period: "บาท/เดือน",
    desc: "จัดการออเดอร์อาหาร Grab Food, LINE MAN, Robinhood",
    color: "#05b187",
    modules: ["เชื่อมต่อ 3 แพลตฟอร์ม", "ดึงออเดอร์อัตโนมัติ", "จัดการเมนูอาหาร", "ออกใบกำกับภาษี", "วิเคราะห์ยอดขาย", "ผู้ใช้ 1 คน"],
    cta: "ดูแพ็คเกจ Food Delivery",
    popular: false,
    link: "/food-delivery-pricing",
  },
  {
    name: "Delivery Hub",
    price: "990",
    period: "บาท/เดือน",
    desc: "ระบบจัดส่งสินค้าครบวงจร Pick-Pack-Ship",
    color: "#03c9d7",
    modules: ["Pick-Pack-Ship ไม่จำกัด", "Wave/Batch Picking", "PDA Mobile Interface", "พิมพ์ใบปะหน้าพัสดุ", "ติดตามพัสดุ Real-time", "แจ้ง Tracking ผ่าน LINE", "สแกนบาร์โค้ด", "ผู้ใช้ 2 คน"],
    cta: "ดูแพ็คเกจ Delivery",
    popular: false,
    link: "/delivery-pricing",
  },
  {
    name: "Professional",
    price: "990",
    period: "บาท/เดือน",
    desc: "บัญชี + E-Commerce Hub ครบวงจร",
    color: "#03c9d7",
    modules: ["ทุกฟีเจอร์ E-Commerce Hub", "บัญชี & ภาษีครบวงจร (TFRS)", "เอกสารไม่จำกัด", "ภ.พ.30 / รายงานภาษี", "Auto Journal Entry", "Bank Reconciliation", "AI Demand Forecasting", "LINE แจ้งเตือน", "ผู้ใช้ 5 คน"],
    cta: "เริ่มทดลองใช้",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "2,490",
    period: "บาท/เดือน",
    desc: "สำหรับสำนักงานบัญชี & องค์กรขนาดใหญ่",
    color: "#03c9d7",
    modules: ["ทุกฟีเจอร์ Professional", "Multi-tenant หลายบริษัท", "สัญญาจ้างออนไลน์", "Work Board จัดการงาน", "Supplier Portal", "คลังเอกสาร & FTP Archive", "White Label Branding", "API เชื่อมต่อภายนอก", "ผู้ใช้ไม่จำกัด", "Priority Support"],
    cta: "ติดต่อฝ่ายขาย",
    popular: false,
  },
];

const ADDON_MODULES = [
  { name: "POS ขายหน้าร้าน", price: "390", icon: Store, color: "#fec90f", desc: "ระบบแคชเชียร์ สแกนบาร์โค้ด ตัดสต็อก Hold/Park Cash Reconciliation" },
  { name: "POS ร้านอาหาร", price: "490", icon: UtensilsCrossed, color: "#03c9d7", desc: "จัดการโต๊ะ/โซน ส่งครัว KDS Modifier Groups แยกบิล เซอร์วิสชาร์จ" },
  { name: "HR & เงินเดือน", price: "490", icon: Users, color: "#03c9d7", desc: "ลงเวลา OT เงินเดือน สลิป ภงด.1 ภงด.1ก 50ทวิ ESS Portal สัญญาจ้าง" },
  { name: "WMS คลังสินค้า", price: "390", icon: Warehouse, color: "#fb9678", desc: "Bin Location Wave/Batch Picking PDA Mobile Interface Real-time Stock Sync" },
  { name: "Live Selling & AI Agency", price: "390", icon: Radio, color: "#f94d4d", desc: "จัดการ Live ขาย จับ CF Lucky Draw AI Live Commerce Agency AIDA Framework" },
  { name: "Supplier Portal", price: "190", icon: ClipboardList, color: "#05b187", desc: "ระบบจัดซื้อ ส่งใบ PO ให้ Supplier เสนอราคาออนไลน์" },
  { name: "Settlement & Wallet", price: "290", icon: Coins, color: "#fec90f", desc: "นำเข้า Settlement ติดตาม Wallet ลงบัญชีค่าธรรมเนียมอัตโนมัติ" },
  { name: "Unified Chat Inbox", price: "290", icon: MessageSquare, color: "#03c9d7", desc: "รวมแชท Facebook Chat Orders AI อ่าน CF ตรวจสลิป Auto-Reply Rules" },
  { name: "CRM & Ad Tracking", price: "290", icon: BarChart3, color: "#f94d4d", desc: "จัดการลูกค้า ROAS วิเคราะห์แคมเปญโฆษณา AR/AP Aging" },
];

const TESTIMONIALS = [
  {
    name: "คุณสมชาย วัฒนกุล",
    role: "เจ้าของร้าน Shopee",
    text: "ใช้มาเกือบปี ดึงออเดอร์จาก Shopee มาออกใบกำกับภาษีอัตโนมัติ ประหยัดเวลาไปเยอะมาก ไม่ต้องนั่งคีย์เอง",
    stars: 5,
    color: "#03c9d7",
  },
  {
    name: "คุณพรทิพย์ รัตนชัย",
    role: "สำนักงานบัญชี ABC",
    text: "จัดการลูกค้าหลายบริษัทได้ในระบบเดียว สะดวกมาก ส่งสัญญาจ้างให้เซ็นออนไลน์ได้เลย ทันสมัย",
    stars: 5,
    color: "#fb9678",
  },
  {
    name: "คุณวิชัย ศรีสุข",
    role: "เจ้าของธุรกิจ SME",
    text: "ระบบ POS ใช้งานง่าย พนักงานเรียนรู้ได้เร็ว ตัดสต็อกอัตโนมัติ ดูรายงานยอดขายได้แบบ Real-time",
    stars: 5,
    color: "#05b187",
  },
];

const FAQ_ITEMS = [
  {
    q: "E-Tax Center ใช้งานยากไหม?",
    a: "ระบบออกแบบมาให้ใช้งานง่าย มีภาษาไทยทั้งหมด รองรับ Dark Mode พร้อมคู่มือและทีมซัพพอร์ตช่วยเหลือตลอด ไม่จำเป็นต้องมีความรู้ด้านบัญชีมาก่อน",
  },
  {
    q: "รองรับแพลตฟอร์ม E-Commerce อะไรบ้าง?",
    a: "E-Commerce Hub รองรับ Shopee, Lazada, TikTok Shop, Amazon, LINE OA, Facebook และ Instagram รวม 7+ แพลตฟอร์ม พร้อมระบบ Live Selling จับ CF อัตโนมัติ AI Live Commerce Agency Store Clone ข้ามแพลตฟอร์ม ส่วน Food Delivery รองรับ Grab Food, LINE MAN, Robinhood",
  },
  {
    q: "ข้อมูลปลอดภัยไหม?",
    a: "เราใช้ระบบ Cloud ที่มีมาตรฐานความปลอดภัยระดับสากล ข้อมูลถูกเข้ารหัส SSL 256-bit สำรองข้อมูลทุกวัน แต่ละบริษัทข้อมูลแยกกันอย่างเด็ดขาด มี Activity Log ติดตามทุกการเปลี่ยนแปลง",
  },
  {
    q: "ยกเลิกได้ไหม ถ้าไม่พอใจ?",
    a: "ได้เลย สามารถยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัดระยะยาว มีช่วงทดลองใช้ฟรี 15 วัน ก่อนตัดสินใจ เลือกซื้อเฉพาะโมดูลที่ต้องการได้",
  },
  {
    q: "เหมาะกับสำนักงานบัญชีไหม?",
    a: "เหมาะอย่างยิ่ง! ระบบ Multi-tenant จัดการลูกค้าหลายบริษัท สัญญาจ้างออนไลน์ Work Board คลังเอกสาร FTP Archive สำรองเอกสารอัตโนมัติ White Label แบรนด์ของคุณเอง เครื่องมือบัญชี 10 รายการ และ ESS Portal สำหรับพนักงาน",
  },
  {
    q: "มีระบบคลังสินค้าไหม?",
    a: "มีครบ! ระบบ WMS รองรับหลายคลัง Bin Location จัดตำแหน่ง Zone/Aisle/Shelf Wave/Batch Picking PDA Mobile Interface Real-time Stock Sync ข้ามแพลตฟอร์ม Supplier Portal สั่งซื้อออนไลน์ Barcode Auto-Generation และ Label Printing",
  },
  {
    q: "AI ช่วยอะไรได้บ้าง?",
    a: "AI ตรวจสลิปโอนเงินอัตโนมัติ VAT Product Dictionary เรียนรู้จากนักบัญชี Demand Forecasting พยากรณ์สินค้า Chat Auto-Reply 5 ประเภท Trigger AI Live Commerce Agency วิเคราะห์ Performance AIDA Framework และ Restock Alert",
  },
  {
    q: "Settlement & ค่าธรรมเนียมแพลตฟอร์มจัดการอย่างไร?",
    a: "ระบบนำเข้ารายงาน Settlement จากทุกแพลตฟอร์ม ติดตามยอด Wallet ลงบัญชีค่าธรรมเนียมอัตโนมัติ กระทบยอดข้ามแพลตฟอร์ม พร้อม VAT Closing Warning แจ้งเตือนเมื่อบันทึกเอกสารในงวดภาษีที่ปิดแล้ว",
  },
  {
    q: "มี POS สำหรับร้านอาหารไหม?",
    a: "มี POS ร้านอาหารแยกต่างหาก จัดการโต๊ะ/โซน ส่งครัวผ่าน KDS Modifier Groups แยกบิล เซอร์วิสชาร์จ เมนูหมวดหมู่ สั่งอาหารผ่าน QR Code และระบบ POS ขายปลีกที่รองรับ Barcode Scanner, Hold/Park, Cash Reconciliation",
  },
  {
    q: "รองรับหลายสกุลเงินไหม?",
    a: "รองรับ 12 สกุลเงินในเอกสารขาย พร้อมระบบโปรโมชั่นตั้งกฎส่วนลดได้เอง ใบกำกับภาษีพิมพ์ได้ 4 รูปแบบ รองรับ e-Tax Invoice ส่งอีเมลอัตโนมัติ",
  },
];

function FAQItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl overflow-hidden transition-all ${open ? "bg-white shadow-md" : "bg-white/60 hover:bg-white"}`}>
      <button
        className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 transition-colors"
        onClick={() => setOpen(!open)}
        data-testid={`faq-toggle-${index}`}
      >
        <span className="font-semibold text-gray-800 text-[15px]">{item.q}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${open ? "bg-[#03c9d7] text-white" : "bg-gray-100 text-gray-500"}`}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && (
        <div className="px-6 pb-5 text-gray-500 leading-relaxed text-sm">
          {item.a}
        </div>
      )}
    </div>
  );
}

function DecorativeShape({ className, color }: { className?: string; color: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="100" fill={color} fillOpacity="0.06" />
      <circle cx="100" cy="100" r="70" fill={color} fillOpacity="0.04" />
      <circle cx="100" cy="100" r="40" fill={color} fillOpacity="0.03" />
    </svg>
  );
}

function FlexyDecor() {
  return (
    <span className="text-sm font-extrabold tracking-wide text-[#03c9d7]">E-Tax Center</span>
  );
}

const AUDIENCE_TABS = [
  {
    key: "business",
    label: "เจ้าของกิจการ",
    badge: "สิ่งที่โปรแกรมอื่นไม่มี",
    title: "ขายของ → ออกบิล → จัดส่ง → ลงบัญชี\nจบในคลิกเดียว ไม่ต้องสลับโปรแกรม",
    desc: "โปรแกรมบัญชีทั่วไปทำได้แค่ลงบัญชี แต่ E-Tax Center เชื่อมทุกอย่างเข้าด้วยกัน — ลูกค้าสั่งของบน Shopee ระบบดึงออเดอร์มาเอง ออกใบกำกับภาษีอัตโนมัติ ตัดสต็อกทุกร้านพร้อมกัน สร้างใบจัดส่ง แจ้ง Tracking ผ่าน LINE และลงบัญชีให้เสร็จ โดยคุณไม่ต้องคีย์อะไรเลย",
    color: "#03c9d7",
    bgGradient: "from-[#e0f7fa] to-[#b2ebf2]",
    features: [
      { icon: Zap, text: "ออเดอร์เข้า → ออกบิล → ตัดสต็อก → จัดส่ง → ลงบัญชี อัตโนมัติทั้งหมด" },
      { icon: ShoppingCart, text: "Sync สต็อก 7+ แพลตฟอร์มพร้อมกัน ไม่มีขายเกินสต็อก" },
      { icon: Radio, text: "Live ขายของ จับ CF + ตรวจสลิปด้วย AI ไม่ต้องจดมือ" },
      { icon: Store, text: "POS ร้านค้า + ร้านอาหาร + KDS ส่งครัว ในระบบเดียวกัน" },
      { icon: Users, text: "HR เงินเดือน สลิป ภงด. ESS Portal พนักงานลาออนไลน์" },
      { icon: FileText, text: "รองรับ e-Tax Invoice ตามมาตรฐานกรมสรรพากร" },
    ],
  },
  {
    key: "accountant",
    label: "นักบัญชี",
    badge: "ออกแบบมาเพื่อสำนักงานบัญชี",
    title: "ดูแลลูกค้า 100 บริษัท\nจากหน้าจอเดียว",
    desc: "E-Tax Center สร้างมาเพื่อสำนักงานบัญชีโดยเฉพาะ — สลับบริษัทลูกค้าได้ทันที ทุกบริษัทมีผังบัญชี TFRS แยกกัน อนุมัติเอกสารแล้วลงบัญชีอัตโนมัติ ไม่ต้องคีย์ซ้ำ พร้อมเครื่องมือจัดการบัญชี 10 รายการที่ช่วยปิดงบได้เร็วขึ้น",
    color: "#05b187",
    bgGradient: "from-[#e8f5e9] to-[#c8e6c9]",
    features: [
      { icon: Building2, text: "Multi-tenant สลับบริษัทลูกค้าได้ทันที ไม่ต้อง Login ใหม่" },
      { icon: Zap, text: "อนุมัติเอกสาร → Auto Journal Entry + ภาษีหัก ณ ที่จ่ายอัตโนมัติ" },
      { icon: ClipboardList, text: "เครื่องมือจัดการบัญชี 10 รายการ ปรับยอด ปิดงบ ย้ายข้อมูล" },
      { icon: Layers, text: "Work Board มอบหมายงานทีม + คลังเอกสาร + FTP Archive" },
      { icon: Shield, text: "สัญญาจ้างออนไลน์ เซ็นดิจิทัล ติดตามสถานะครบวงจร" },
      { icon: Calculator, text: "Tax Tools ดราฟท์งบการเงินอัตโนมัติ ลดเวลาปิดงบ" },
    ],
  },
];

function AudienceTabs() {
  const [activeTab, setActiveTab] = useState("business");
  const tab = AUDIENCE_TABS.find((t) => t.key === activeTab)!;

  useEffect(() => {
    const img1 = new Image(); img1.src = businessTabImg;
    const img2 = new Image(); img2.src = accountantTabImg;
  }, []);

  return (
    <div>
      <div className="inline-flex bg-gray-100 rounded-xl p-1.5 mb-10">
        {AUDIENCE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-8 py-3 rounded-lg text-base font-bold transition-all ${
              activeTab === t.key
                ? "bg-[#03c9d7] text-white shadow-md"
                : "text-gray-500 hover:text-gray-700"
            }`}
            data-testid={`tab-audience-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 rounded-2xl overflow-hidden shadow-xl border border-gray-100">
        <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
          <img
            src={businessTabImg}
            alt="เจ้าของกิจการ E-Tax Center"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeTab === "business" ? "opacity-100" : "opacity-0"}`}
          />
          <img
            src={accountantTabImg}
            alt="นักบัญชี E-Tax Center"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeTab === "accountant" ? "opacity-100" : "opacity-0"}`}
          />
        </div>

        <div className="bg-white p-8 lg:p-12 text-left">
          {tab.badge && (
            <span className="inline-block text-sm font-semibold mb-3 px-3 py-1 rounded-full" style={{ color: tab.color, backgroundColor: tab.color + "15" }}>
              {tab.badge}
            </span>
          )}
          <h3 className="text-2xl lg:text-[28px] font-extrabold text-gray-900 mb-4 leading-snug whitespace-pre-line">{tab.title}</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">{tab.desc}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {tab.features.map((f, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: tab.color + "15" }}>
                  <f.icon className="w-4 h-4" style={{ color: tab.color }} />
                </div>
                <span className="text-[13px] text-gray-600 leading-snug pt-1">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-4">
            <a href="#features" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:shadow-lg transition-all" style={{ backgroundColor: tab.color }}>
              อ่านเพิ่มเติม
            </a>
            <a href="/register" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border-2 hover:shadow-lg transition-all" style={{ borderColor: "#fb9678", color: "#fb9678" }}>
              ทดลองใช้ฟรี
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnimateOnScroll({ children, className = "", delay = 0, direction = "up" }: { children: ReactNode; className?: string; delay?: number; direction?: "up" | "left" | "right" | "fade" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const transforms: Record<string, string> = {
    up: "translateY(40px)",
    left: "translateX(-40px)",
    right: "translateX(40px)",
    fade: "translateY(0px)",
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0) translateX(0)" : transforms[direction],
        transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function CountUp({ target, suffix = "", duration = 2000 }: { target: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setStarted(true); obs.unobserve(el); }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) { setCount(target); clearInterval(interval); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(interval);
  }, [started, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

const CAROUSEL_SLIDES = [
  {
    category: "เปิดบิลง่าย",
    title: "ออกบิลง่าย ไว ไม่ต้องใช้ Excel",
    desc: "ฟอร์มเอกสารซื้อ-ขาย ที่รองรับทุกสกุลเงิน ใช้ได้ทั้งร้านค้าของ หรือบริษัทที่ต้องการเสนองานให้ลูกค้า มีระบบ e-Tax Invoice ให้ออกบิลไวขึ้น ลูกค้ารับบิลได้ทางอีเมล เก็บเอกสารออนไลน์ได้อย่างเป็นระบบ",
    screenshot: ecomDashboardImg,
    screenshotAlt: "ออกเอกสารขาย ตั้งแต่ต้น จนเก็บเงิน",
    videoBadge: "VDO Tutorials",
    link: "/features#documents",
  },
  {
    category: "E-Commerce Hub",
    title: "เชื่อมต่อ 7+ แพลตฟอร์ม\nจัดการออเดอร์ในที่เดียว",
    desc: "ดึงออเดอร์อัตโนมัติจาก Shopee, Lazada, TikTok Shop, Amazon, LINE ออกใบกำกับภาษี Sync สต็อกข้ามร้าน Live Selling จับ CF อัตโนมัติ Settlement & Wallet Tracking ทั้งหมดในที่เดียว",
    screenshot: dashboardPreview,
    screenshotAlt: "รวมออเดอร์จากทุกแพลตฟอร์ม",
    videoBadge: "VDO Tutorials",
    link: "/features#ecommerce",
  },
  {
    category: "จัดการสต็อก",
    title: "จัดการสต็อกง่าย ได้ทุกหน้าร้าน",
    desc: "เพื่อธุรกิจที่มีหลายหน่วยนับ หลายคลัง หลายสาขา ธุรกิจที่มีสินค้า ฝากขาย หรือแม้แต่ร้านค้าออนไลน์ที่ขายหลายแพลตฟอร์ม ก็สามารถเห็นทุกความเคลื่อนไหวได้ในที่เดียวแบบเรียลไทม์ สะดวกขั้นสุด",
    screenshot: ecomDashboardImg,
    screenshotAlt: "หน้าจัดการสต็อกสินค้า",
    videoBadge: "VDO Tutorials",
    link: "/features#warehouse",
  },
  {
    category: "กระทบยอดธนาคาร",
    title: "เห็นภาพรวมของเงินได้ในที่เดียว\nนำข้อมูลจากธนาคารเข้าสู่ระบบ\nโดยอัตโนมัติและปลอดภัย",
    desc: "นำเข้าข้อมูลจากธนาคารเพื่อกระทบยอดในโปรแกรมบัญชีออนไลน์อย่างปลอดภัย โดยจำกัดการเข้าถึงเฉพาะสิทธิ์ที่ได้รับอนุญาต เพื่อให้มองเห็นสุขภาพการเงินทั้งหน้าบ้านและหลังบ้านอย่างมั่นใจ",
    screenshot: dashboardPreview,
    screenshotAlt: "กระทบยอดธนาคาร Bank Reconciliation",
    videoBadge: "VDO Tutorials",
    link: "/features#accounting",
  },
  {
    category: "บันทึกค่าใช้จ่าย",
    title: "บิลไม่หาย เก็บง่าย แค่สแกน",
    desc: "บันทึกค่าใช้จ่ายด้วยวิธีที่ง่ายกว่า ไม่ว่าคุณจะทำงานที่ไหน แค่หยิบมือถือ สแกนบิล ระบบบัญชีจะนำข้อมูลมาบันทึกและเก็บบิลออนไลน์ให้เลย มั่นใจว่าเก็บทุกบิลครบ ตรวจสอบค่าใช้จ่ายในแต่ละโปรเจกต์ได้",
    screenshot: ecomDashboardImg,
    screenshotAlt: "บันทึกค่าใช้จ่ายด้วยการสแกน",
    videoBadge: "VDO Tutorials",
    link: "/features#ai",
  },
];

function FeatureCarousel({ navigate }: { navigate: (path: string) => void }) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startAutoPlay = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrent(prev => (prev + 1) % CAROUSEL_SLIDES.length);
    }, 6000);
  };

  useEffect(() => {
    startAutoPlay();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const goTo = (idx: number) => {
    setDirection(idx > current ? 1 : -1);
    setCurrent(idx);
    startAutoPlay();
  };

  const prev = () => {
    setDirection(-1);
    setCurrent(c => (c - 1 + CAROUSEL_SLIDES.length) % CAROUSEL_SLIDES.length);
    startAutoPlay();
  };

  const next = () => {
    setDirection(1);
    setCurrent(c => (c + 1) % CAROUSEL_SLIDES.length);
    startAutoPlay();
  };

  const slide = CAROUSEL_SLIDES[current];

  return (
    <section className="py-0 bg-[#eef7f9] relative overflow-hidden" data-testid="feature-carousel">
      <div className="max-w-[1400px] mx-auto relative">
        <button
          onClick={prev}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-[#03c9d7] hover:bg-[#03c9d7] hover:text-white transition-all hover:shadow-xl"
          data-testid="carousel-prev"
        >
          <ChevronDown className="w-5 h-5 -rotate-90" />
        </button>
        <button
          onClick={next}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white shadow-lg flex items-center justify-center text-[#03c9d7] hover:bg-[#03c9d7] hover:text-white transition-all hover:shadow-xl"
          data-testid="carousel-next"
        >
          <ChevronDown className="w-5 h-5 rotate-90" />
        </button>

        <div className="flex flex-col lg:flex-row items-stretch min-h-[420px] px-14 sm:px-20">
          <div
            key={`text-${current}`}
            className="flex-1 flex items-center py-10 lg:py-16 lg:pr-8"
            style={{
              animation: "carouselFadeIn 0.5s ease forwards",
            }}
          >
            <div className="max-w-[520px]">
              <p className="text-[#03c9d7] text-sm font-bold tracking-wide mb-3">{slide.category}</p>
              <h2 className="text-2xl sm:text-3xl lg:text-[36px] font-extrabold text-gray-900 leading-snug mb-5 tracking-tight whitespace-pre-line">
                {slide.title}
              </h2>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-7">{slide.desc}</p>
              <button
                onClick={() => navigate(slide.link)}
                className="inline-flex items-center gap-2 px-6 py-3 text-[14px] font-bold text-[#03c9d7] border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7] hover:text-white transition-all"
                data-testid={`carousel-cta-${current}`}
              >
                เรียนรู้เพิ่มเติม <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            key={`img-${current}`}
            className="flex-1 flex items-center justify-center py-8 lg:py-12 lg:pl-8 relative"
            style={{
              animation: "carouselFadeIn 0.5s ease forwards",
            }}
          >
            <div className="relative w-full max-w-[500px]">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#03c9d7] text-white text-xs font-bold rounded-lg shadow-md">
                  <Play className="w-3.5 h-3.5" fill="white" />
                  {slide.videoBadge}
                </span>
              </div>
              <div className="bg-white rounded-2xl shadow-xl border border-gray-200/60 overflow-hidden mt-6 relative">
                <img src={slide.screenshot} alt={slide.screenshotAlt} className="w-full h-auto" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-white/90 shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform">
                    <Play className="w-6 h-6 text-[#03c9d7] ml-0.5" fill="#03c9d7" />
                  </div>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-sm font-bold text-[#03c9d7]">{slide.screenshotAlt}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-center gap-2 pb-6">
          {CAROUSEL_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current ? "bg-[#03c9d7] w-7" : "bg-gray-300 hover:bg-gray-400"}`}
              data-testid={`carousel-dot-${i}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const [, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "ecommerce" | "firm">("general");
  const [isYearly, setIsYearly] = useState(false);
  const [activeServiceTab, setActiveServiceTab] = useState("accounting");
  const [articlePage, setArticlePage] = useState(0);

  useForceLightMode();

  const { data: subscriptionPlans = [] } = useQuery<any[]>({
    queryKey: ["/api/subscription-plans"],
    queryFn: () => fetch("/api/subscription-plans").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 5 * 60 * 1000,
  });
  const { data: dbAddons = [] } = useQuery<any[]>({
    queryKey: ["/api/subscription-addons"],
    queryFn: () => fetch("/api/subscription-addons").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 5 * 60 * 1000,
  });
  const scrollTo = (id: string) => {
    setMobileMenu(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "instant" as ScrollBehavior });
  };

  const { data: landingSections } = useQuery<any[]>({
    queryKey: ["/api/landing-content"],
    queryFn: () => fetch("/api/landing-content").then(r => r.json()).then(d => Array.isArray(d) ? d : []),
    staleTime: 5 * 60 * 1000,
  });

  const sectionData = useMemo(() => {
    const map: Record<string, any> = {};
    if (Array.isArray(landingSections)) {
      for (const s of landingSections) map[s.sectionType] = s;
    }
    return map;
  }, [landingSections]);

  const dbTestimonials = sectionData.testimonials?.items?.length ? sectionData.testimonials.items : TESTIMONIALS;
  const dbFaqItems = sectionData.faq?.items?.length ? sectionData.faq.items : FAQ_ITEMS;
  const dbPlatforms = sectionData.platforms?.items?.length ? sectionData.platforms.items : null;
  const dbVideoDemos = sectionData.video_demos?.items?.length ? sectionData.video_demos.items : null;
  const dbFeaturedClients = sectionData.featured_clients?.items?.length ? sectionData.featured_clients.items : null;

  return (
    <div className="min-h-screen bg-white force-light-mode" style={{ fontFamily: "'Sarabun', 'IBM Plex Sans Thai', sans-serif" }}>
      <DevMenu />
      {/* Navbar - Flexy style */}
      <nav className="fixed left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-b border-gray-100/80" style={{ top: "var(--dev-bar-h, 0px)" }}>
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[70px]">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/landing")} data-testid="nav-logo">
              <div className="h-11 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
                <img src={logoWhite} alt="E-Tax Center" className="h-6 object-contain" />
              </div>
              <LandingVersionBadge />
            </div>

            <div className="hidden md:flex items-center gap-1">
              {NAV_LINKS.map(link => (
                <button
                  key={link.href}
                  onClick={() => (link as any).external ? navigate(link.href) : scrollTo(link.href.slice(1))}
                  className="px-4 py-2 text-[14px] font-medium text-gray-600 hover:text-[#03c9d7] hover:bg-[#03c9d7]/5 rounded-lg transition-all"
                  data-testid={`nav-${link.href.replace(/[#/]/g, "")}`}
                >
                  {link.label}
                </button>
              ))}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <button
                onClick={() => navigate("/login")}
                className="px-5 py-2.5 text-[14px] font-semibold text-[#03c9d7] hover:bg-[#03c9d7]/5 rounded-lg transition-all"
                data-testid="nav-login"
              >
                เข้าสู่ระบบ
              </button>
              <button
                onClick={() => navigate("/register")}
                className="px-5 py-2.5 text-[14px] font-semibold text-white bg-[#03c9d7] rounded-lg hover:bg-[#02b5c2] transition-all shadow-md shadow-[#03c9d7]/25 hover:shadow-lg hover:shadow-[#03c9d7]/30"
                data-testid="nav-register"
              >
                ทดลองใช้ฟรี
              </button>
            </div>

            <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenu(!mobileMenu)} data-testid="nav-mobile-toggle">
              {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 pb-4 space-y-1 shadow-lg">
            {NAV_LINKS.map(link => (
              <button key={link.href} onClick={() => { setMobileMenu(false); (link as any).external ? navigate(link.href) : scrollTo(link.href.slice(1)); }} className="block w-full text-left py-3 px-3 text-[14px] font-medium text-gray-600 hover:bg-gray-50 rounded-lg" data-testid={`nav-mobile-${link.href.replace(/[#/]/g, "")}`}>
                {link.label}
              </button>
            ))}
            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button onClick={() => { setMobileMenu(false); navigate("/login"); }} className="flex-1 py-2.5 text-[14px] font-semibold text-[#03c9d7] border border-[#03c9d7] rounded-lg" data-testid="nav-mobile-login">เข้าสู่ระบบ</button>
              <button onClick={() => { setMobileMenu(false); navigate("/register"); }} className="flex-1 py-2.5 text-[14px] font-semibold text-white bg-[#03c9d7] rounded-lg" data-testid="nav-mobile-register">ทดลองใช้ฟรี</button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section - Flexy Style */}
      <section className="pt-[70px] relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "#eefafb" }} />
        <DecorativeShape className="absolute -top-20 -right-20 w-[500px] h-[500px]" color="#03c9d7" />
        <DecorativeShape className="absolute -bottom-40 -left-20 w-[600px] h-[600px]" color="#03c9d7" />
        <DecorativeShape className="absolute top-40 left-1/4 w-[300px] h-[300px]" color="#fec90f" />

        <div className="absolute top-32 left-8 hidden lg:block">
          <svg width="120" height="140" viewBox="0 0 120 140" fill="none">
            <rect x="20" y="0" width="80" height="50" rx="25" fill="#03c9d7" fillOpacity="0.12" />
            <rect x="0" y="45" width="60" height="50" rx="25" fill="#03c9d7" fillOpacity="0.12" />
            <circle cx="90" cy="110" r="30" fill="#fec90f" fillOpacity="0.12" />
          </svg>
        </div>
        <div className="absolute top-40 right-12 hidden lg:block">
          <svg width="100" height="120" viewBox="0 0 100 120" fill="none">
            <rect x="10" y="10" width="80" height="40" rx="20" fill="#03c9d7" fillOpacity="0.1" />
            <circle cx="50" cy="85" r="35" fill="#05b187" fillOpacity="0.08" />
          </svg>
        </div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-16 sm:py-20 lg:py-28">
          <div className="absolute left-4 lg:left-12 top-[50%] -translate-y-1/2 hidden xl:block z-[5] pointer-events-none">
            <div className="animate-float-up">
              <img src="/card-donut.png" alt="" className="w-[200px] rounded-2xl shadow-2xl shadow-black/10" draggable={false} />
            </div>
          </div>
          <div className="absolute right-4 lg:right-12 top-[50%] -translate-y-1/2 hidden xl:block z-[5] pointer-events-none">
            <div className="animate-float-down">
              <img src="/card-line.png" alt="" className="w-[200px] rounded-2xl shadow-2xl shadow-black/10" draggable={false} />
            </div>
          </div>
          <div className="text-center max-w-4xl mx-auto">
            <AnimateOnScroll direction="fade" delay={0.1}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-[#03c9d7]/20 shadow-sm mb-6">
                <span className="w-2 h-2 rounded-full bg-[#05b187] animate-pulse" />
                <span className="text-sm font-medium text-gray-600">ระบบที่ธุรกิจกว่า 1,200 แห่งไว้วางใจ</span>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-[60px] font-extrabold text-gray-900 leading-tight sm:leading-tight lg:leading-tight mb-6 tracking-tight">
                <span className="text-[#03c9d7]">E-Tax Center</span>
                <br />
                ระบบบริหารจัดการธุรกิจ
                <br />
                <span className="bg-clip-text text-transparent bg-[linear-gradient(135deg,#03c9d7_0%,#05b187_100%)]">ที่ทรงพลังที่สุด</span>
              </h1>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.3}>
              <p className="text-lg sm:text-xl text-gray-500 mb-8 max-w-2xl mx-auto leading-relaxed">
                ระบบบริหารจัดการธุรกิจครบวงจรที่ออกแบบมาเพื่อ SME ไทย
                <br className="hidden sm:block" />
                อีคอมเมิร์ซ · บัญชี · POS · HR · คลังสินค้า · จัดส่ง — ไม่ต้องใช้ 10 โปรแกรม
              </p>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.4}>
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mb-10 text-sm text-gray-500">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#05b187]" />ทดลองฟรี 15 วัน</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#05b187]" />ไม่ต้องใช้บัตรเครดิต</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#05b187]" />ยกเลิกได้ทุกเมื่อ</span>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.5}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/register")}
                className="w-full sm:w-auto px-8 py-4 text-[15px] font-bold text-white rounded-xl shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl hover:shadow-[#03c9d7]/35 transition-all hover:-translate-y-0.5 flex items-center justify-center gap-2 bg-[#03c9d7] hover:bg-[#02b5c2]"
                data-testid="hero-cta-register"
              >
                เริ่มต้นใช้งานฟรี <ArrowRight className="w-5 h-5" />
              </button>
              <button
                onClick={() => scrollTo("features")}
                className="w-full sm:w-auto px-8 py-4 text-[15px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-[#03c9d7]/30 hover:text-[#03c9d7] hover:shadow-md transition-all flex items-center justify-center gap-2"
                data-testid="hero-cta-features"
              >
                ดูรายละเอียด
              </button>
            </div>
            </AnimateOnScroll>
          </div>
        </div>

        {/* Wave separator */}
        <div className="relative z-10">
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full">
            <path d="M0 60L48 53.3C96 46.7 192 33.3 288 30C384 26.7 480 33.3 576 36.7C672 40 768 40 864 36.7C960 33.3 1056 26.7 1152 23.3C1248 20 1344 20 1392 20L1440 20V60H1392C1344 60 1248 60 1152 60C1056 60 960 60 864 60C768 60 672 60 576 60C480 60 384 60 288 60C192 60 96 60 48 60H0Z" fill="white"/>
          </svg>
        </div>
      </section>

      {/* Target Audience Tabs Section */}
      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-6 tracking-tight">
                โปรแกรมบัญชีสำเร็จรูปที่เข้าใจ<span className="text-[#03c9d7]">เจ้าของกิจการ</span>และ<span className="text-[#03c9d7]">นักบัญชี</span>
              </h2>
              <AudienceTabs />
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Module Showcase - Buy What You Need */}
      <section className="py-20 bg-white" id="modules">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center max-w-3xl mx-auto mb-4">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">MODULAR SYSTEM</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                เลือกซื้อเฉพาะ<span style={{ color: "#03c9d7" }}>โมดูลที่ต้องการ</span>
              </h2>
              <p className="text-gray-400 text-[15px]">ไม่ต้องจ่ายแพ็คเกจรวม เริ่มจากโมดูลเดียวก็ได้ ธุรกิจโตก็เพิ่มโมดูลได้ทันที ทุกโมดูลทำงานร่วมกันอย่างไร้รอยต่อ</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.1}>
            <div className="flex justify-center mb-12">
              <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#fec90f]/10 rounded-full">
                <Zap className="w-4 h-4 text-[#fec90f]" />
                <span className="text-sm font-bold text-[#e6a800]">ใช้แยกก็ได้ ใช้รวมก็ดี — ข้อมูลเชื่อมถึงกันอัตโนมัติ</span>
              </div>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: ShoppingCart, color: "#fb9678", bg: "#fff5f2",
                title: "อีคอมเมิร์ซ",
                subtitle: "E-Commerce Hub",
                desc: "ดึงออเดอร์อัตโนมัติจาก 7+ แพลตฟอร์ม ออกใบกำกับภาษีอัตโนมัติ Auto-TIV เมื่อจัดส่ง กระทบยอด Settlement & Wallet ครบวงจร",
                bullets: ["Shopee · Lazada · TikTok Shop · Amazon", "ออกใบกำกับภาษีอัตโนมัติเมื่อจัดส่ง", "Settlement & Wallet Tracking", "AI Live Commerce Agency"],
              },
              {
                icon: Calculator, color: "#03c9d7", bg: "#e8fafb",
                title: "บัญชี & ภาษี",
                subtitle: "Accounting TFRS",
                desc: "ผังบัญชีมาตรฐาน TFRS สมุดรายวัน 5 เล่ม Auto Journal Entry งบการเงินครบ 4 งบ รายงานภาษีพร้อมยื่น ภ.พ.30",
                bullets: ["ผังบัญชี 3 หลัก / 7 หลัก ตาม TFRS", "สมุดรายวัน 5 เล่ม + Auto Journal Entry", "งบทดลอง · กำไรขาดทุน · ฐานะการเงิน · กระแสเงินสด", "ภ.พ.30 · ภงด.1 · 50 ทวิ · AR/AP Aging"],
              },
              {
                icon: Store, color: "#fec90f", bg: "#fffbf0",
                title: "POS ขายปลีก & ร้านอาหาร",
                subtitle: "Point of Sale",
                desc: "ขายหน้าร้าน จัดการโต๊ะร้านอาหาร KDS ส่งครัว แยกบิล เซอร์วิสชาร์จ Barcode Scanner รองรับหลายจุดขาย",
                bullets: ["POS ขายปลีก + POS ร้านอาหาร", "จัดการโต๊ะ · KDS · แยกบิล · เซอร์วิสชาร์จ", "Barcode Scanner · EAN-13 Auto-Generate", "Cash Reconciliation · Hold/Park Orders"],
              },
              {
                icon: Users, color: "#05b187", bg: "#eefbf5",
                title: "HR & เงินเดือน",
                subtitle: "Human Resources",
                desc: "ลงเวลา OT คำนวณเงินเดือน สลิปเงินเดือน ภงด.1 · 50 ทวิ · ประกันสังคม ESS Portal พนักงาน ลาออนไลน์",
                bullets: ["ลงเวลา · OT · คำนวณเงินเดือนอัตโนมัติ", "สลิปเงินเดือน · ภงด.1 · 50 ทวิ · ประกันสังคม", "ESS Portal พนักงาน · ลาออนไลน์", "สัญญาจ้างออนไลน์ · เซ็นดิจิทัล"],
              },
              {
                icon: Building2, color: "#539BFF", bg: "#f0f5ff",
                title: "สำนักงานบัญชี",
                subtitle: "Accounting Firm",
                desc: "จัดการลูกค้าหลายบริษัท White Label Branding Work Board แบบ Monday.com FTP Archive คลังเอกสาร สัญญาจ้างออนไลน์",
                bullets: ["Multi-tenant จัดการลูกค้าหลายบริษัท", "White Label · เปลี่ยนโลโก้/สีธีมได้", "Work Board · FTP Archive · คลังเอกสาร", "Firm Link เชื่อมบริษัทลูกค้าง่ายๆ"],
              },
              {
                icon: Warehouse, color: "#f94d4d", bg: "#fef2f2",
                title: "คลังสินค้า & จัดส่ง",
                subtitle: "WMS & Delivery",
                desc: "Bin Location, Wave/Batch Picking, PDA Interface, Real-time Stock Sync หลายแพลตฟอร์ม Pick-Pack-Ship พิมพ์ใบปะหน้าพัสดุ",
                bullets: ["Bin Location · Zone/Aisle/Shelf/Bin", "Wave Picking · PDA Mobile Interface", "Real-time Stock Sync หลายแพลตฟอร์ม", "Pick-Pack-Ship · พิมพ์ใบปะหน้าพัสดุ · LINE แจ้ง Tracking"],
              },
            ].map((mod, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1} className="h-full">
                <div className="rounded-2xl p-7 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group h-full flex flex-col" style={{ backgroundColor: mod.bg }} data-testid={`module-card-${i}`}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all" style={{ backgroundColor: mod.color + "20" }}>
                      <mod.icon className="w-6 h-6" style={{ color: mod.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-[16px]">{mod.title}</h3>
                      <p className="text-[11px] font-medium" style={{ color: mod.color }}>{mod.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed mb-4">{mod.desc}</p>
                  <ul className="space-y-1.5 mt-auto">
                    {mod.bullets.map((b, bi) => (
                      <li key={bi} className="flex items-start gap-2 text-xs text-gray-500">
                        <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: mod.color }} />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </AnimateOnScroll>
            ))}
          </div>

          <AnimateOnScroll delay={0.6}>
            <div className="mt-10 text-center">
              <button
                onClick={() => navigate("/register")}
                className="px-8 py-3.5 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all mr-4"
                data-testid="cta-module-register"
              >
                เริ่มใช้งานฟรี
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById("pricing");
                  el?.scrollIntoView({ behavior: "smooth" });
                }}
                className="px-8 py-3.5 text-[15px] font-bold text-[#03c9d7] bg-white border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7] hover:text-white transition-all"
                data-testid="cta-module-pricing"
              >
                ดูราคาแต่ละโมดูล
              </button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* How It Works - Easy Start */}
      <section className="py-0 bg-[#eef7f9]">
        <div className="max-w-[1400px] mx-auto">
          <div className="flex flex-col lg:flex-row items-stretch">
            <AnimateOnScroll direction="left" className="flex-1 relative overflow-hidden">
              <div className="relative h-full min-h-[340px] lg:min-h-[420px] flex items-center justify-center p-8 lg:p-12">
                <div className="absolute top-4 left-6">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#03c9d7] text-white text-xs font-bold rounded-lg shadow-md">
                    <Play className="w-3.5 h-3.5" fill="white" />
                    VDO Tutorials
                  </span>
                </div>

                <div className="relative w-full max-w-[520px] mt-6">
                  <div className="relative bg-white rounded-xl shadow-2xl shadow-gray-300/40 overflow-hidden border border-gray-200/60">
                    <img src={dashboardPreview} alt="E-Tax Center Dashboard" className="w-full h-auto" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/90 shadow-xl flex items-center justify-center cursor-pointer hover:scale-110 transition-transform group">
                        <Play className="w-7 h-7 text-[#03c9d7] ml-1 group-hover:text-[#02a0ad] transition-colors" fill="#03c9d7" />
                      </div>
                    </div>
                  </div>
                  <div className="absolute -bottom-3 -right-4 w-[45%] bg-white rounded-lg shadow-xl border border-gray-200/60 overflow-hidden z-10 transform rotate-1">
                    <img src={ecomDashboardImg} alt="E-Commerce Dashboard" className="w-full h-auto" />
                  </div>
                </div>

                <div className="absolute bottom-6 left-6 text-left">
                  <p className="text-[#03c9d7] text-sm font-bold leading-snug">
                    ดูคลิปเดียว<br />ใช้ E-Tax Center<br />เป็นทั้งระบบ
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">สำหรับผู้เริ่มต้น<br />ตั้งแต่สมัครใช้งานจนถึงออกเอกสาร</p>
                </div>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll direction="right" className="flex-1 flex items-center">
              <div className="p-8 lg:p-14 lg:pl-8 max-w-[600px]">
                <h2 className="text-3xl sm:text-[38px] lg:text-[42px] font-extrabold text-gray-900 leading-snug mb-6 tracking-tight">
                  เลือกโมดูล <span className="text-[#03c9d7]">เริ่มใช้ได้ทันที</span><br />
                  ไม่รู้บัญชี <span className="text-[#03c9d7]">ก็ใช้งานได้</span>
                </h2>
                <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
                  สมัครฟรี เลือกซื้อโมดูลที่ต้องการ ใช้งานได้ทันทีทั้งในเว็บไซต์และมือถือ ระบบตั้งค่าให้อัตโนมัติ มีทีมซัพพอร์ตช่วยแนะนำการใช้งานฟรี!
                </p>
                <div className="flex flex-wrap gap-3 mb-8">
                  {[
                    { label: "ทดลอง 15 วันฟรี", color: "#05b187" },
                    { label: "ไม่ต้องผูกบัตร", color: "#03c9d7" },
                    { label: "ยกเลิกเมื่อไหร่ก็ได้", color: "#fb9678" },
                  ].map((tag, ti) => (
                    <span key={ti} className="px-3 py-1.5 rounded-full text-xs font-bold border-2" style={{ borderColor: tag.color, color: tag.color }}>{tag.label}</span>
                  ))}
                </div>
                <button
                  onClick={() => navigate("/register")}
                  className="px-8 py-3.5 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                  data-testid="cta-book-demo"
                >
                  เริ่มทดลองใช้ฟรี
                </button>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Why Modular - Flexy Style */}
      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center max-w-3xl mx-auto mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">ทำไมต้องซื้อแยกโมดูล?</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                <span style={{ color: "#03c9d7" }}>จ่ายตามที่ใช้จริง</span> — ไม่มีค่าใช้จ่ายซ่อน
              </h2>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <AnimateOnScroll direction="left" delay={0.1} className="h-full">
              <div className="bg-[#e8fafb] rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl transition-all h-full">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#03c9d7]/5 -translate-y-10 translate-x-10" />
                <div className="w-14 h-14 rounded-xl bg-[#03c9d7]/15 flex items-center justify-center mb-6">
                  <Package className="w-7 h-7 text-[#03c9d7]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">เลือกซื้อทีละโมดูล</h3>
                <p className="text-sm text-gray-500 leading-relaxed">เริ่มจากโมดูลเดียวที่ต้องการ ไม่ต้องซื้อแพ็คเกจรวมราคาแพง ธุรกิจโตเมื่อไหร่ก็เพิ่มโมดูลได้</p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll delay={0.2} className="h-full">
              <div className="bg-[#fff5f2] rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl transition-all h-full">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#fb9678]/5 -translate-y-10 translate-x-10" />
                <div className="w-14 h-14 rounded-xl bg-[#fb9678]/15 flex items-center justify-center mb-6">
                  <Layers className="w-7 h-7 text-[#fb9678]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">ข้อมูลเชื่อมถึงกัน</h3>
                <p className="text-sm text-gray-500 leading-relaxed">ซื้ออีคอมเมิร์ซ + บัญชี ระบบลงบัญชีอัตโนมัติ ซื้อ POS + บัญชี ยอดขายบันทึกบัญชีทันที ไม่ต้องคีย์ซ้ำ</p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll direction="right" delay={0.3} className="h-full">
              <div className="bg-[#eefbf5] rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl transition-all h-full">
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-[#05b187]/5 -translate-y-10 translate-x-10" />
                <div className="w-14 h-14 rounded-xl bg-[#05b187]/15 flex items-center justify-center mb-6">
                  <RefreshCw className="w-7 h-7 text-[#05b187]" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">อัปเดตฟรีตลอดชีพ</h3>
                <p className="text-sm text-gray-500 leading-relaxed">ทุกโมดูลได้รับฟีเจอร์ใหม่อัตโนมัติ ไม่ต้องจ่ายค่าอัปเดตเพิ่ม ใช้งานผ่านเว็บ ไม่ต้องติดตั้ง</p>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Feature Carousel - FlowAccount Inspired */}
      <FeatureCarousel navigate={navigate} />

      {/* Features Grid - Flexy Card Style */}
      <section id="features" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <div className="flex justify-center mb-4"><FlexyDecor /></div>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">100+ ฟีเจอร์ <span className="text-[#03c9d7]">ในทุกโมดูล</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">แต่ละโมดูลมีฟีเจอร์ครบถ้วน เลือกซื้อเฉพาะที่ต้องการ ทำงานร่วมกันอย่างไร้รอยต่อ</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1} className="h-full">
              <div className="rounded-2xl p-7 border border-gray-100/80 hover:shadow-xl hover:-translate-y-1 transition-all group cursor-pointer h-full" style={{ backgroundColor: f.bg }} data-testid={`feature-card-${i}`}>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5 transition-all group-hover:scale-110" style={{ backgroundColor: f.color + "12" }}>
                  <f.icon className="w-7 h-7" style={{ color: f.color }} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-[16px]">{f.title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Integration Logos */}
      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">SOFTWARE INTEGRATION</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">เชื่อมต่อได้ทุกแพลตฟอร์ม</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">รองรับการเชื่อมต่อกับแพลตฟอร์ม E-Commerce, Food Delivery, ธนาคาร และระบบอื่นๆ ได้อย่างไร้รอยต่อ</p>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.2}>
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
              {(dbPlatforms || [
                { name: "Shopee", color: "#EE4D2D", letter: "S" },
                { name: "Lazada", color: "#0F146D", letter: "L" },
                { name: "TikTok Shop", color: "#000000", letter: "T" },
                { name: "Amazon", color: "#FF9900", letter: "A" },
                { name: "LINE", color: "#06C755", letter: "L" },
                { name: "Facebook", color: "#1877F2", letter: "F" },
                { name: "Grab Food", color: "#00B14F", letter: "G" },
                { name: "LINE MAN", color: "#3ACE01", letter: "LM" },
                { name: "Robinhood", color: "#7B2D8E", letter: "R" },
              ]).map((p: any, i: number) => {
                const PLATFORM_LOGOS_MAP: Record<string, string> = {
                  "Shopee": logoShopee,
                  "Lazada": logoLazada,
                  "TikTok Shop": logoTiktok,
                  "Amazon": logoAmazon,
                  "Grab Food": logoGrabfood,
                  "LINE MAN": logoLineman,
                  "LINE": logoLineShopping,
                  "Robinhood": logoRobinhood,
                  "Facebook": logoFacebook,
                  "Instagram": logoInstagram,
                };
                const logo = p.logo || PLATFORM_LOGOS_MAP[p.name];
                const svg = null;
                return (
                <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-extrabold text-lg shadow-md group-hover:shadow-xl group-hover:scale-110 transition-all overflow-hidden" style={{ backgroundColor: logo ? "transparent" : p.color }}>
                    {logo ? (
                      <img src={logo} alt={p.name} className="w-full h-full object-cover" />
                    ) : svg ? (
                      svg
                    ) : (
                      p.letter
                    )}
                  </div>
                  <span className="text-xs text-gray-400 font-medium group-hover:text-gray-600 transition-colors">{p.name}</span>
                </div>
              )})}
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.4}>
            <div className="mt-12 text-center">
              <p className="text-sm text-gray-400 mb-2">รองรับการเชื่อมต่อผ่าน</p>
              <div className="flex items-center justify-center gap-6 flex-wrap">
                {[
                  { label: "RESTful API", color: "#03c9d7" },
                  { label: "OAuth 2.0", color: "#fb9678" },
                  { label: "Webhook", color: "#05b187" },
                  { label: "Excel/CSV Import", color: "#fec90f" },
                ].map((t, i) => (
                  <span key={i} className="px-4 py-2 rounded-full text-xs font-bold border-2" style={{ borderColor: t.color, color: t.color }}>{t.label}</span>
                ))}
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="video-demo" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">แนะนำการทำงาน</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">ดูวิดีโอสาธิตการใช้งาน</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">เรียนรู้การใช้งานระบบผ่านวิดีโอสาธิต ดูว่า E-Tax Center ช่วยจัดการธุรกิจของคุณได้อย่างไร</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {(dbVideoDemos || [
              { title: "E-Commerce Hub", desc: "ดึงออเดอร์อัตโนมัติจาก 7+ แพลตฟอร์ม ออกใบกำกับภาษี Stock Sync", color: "#fb9678", icon: "ShoppingCart", category: "ร้านค้าออนไลน์" },
              { title: "ระบบบัญชี TFRS", desc: "ผังบัญชีมาตรฐาน สมุดรายวัน 5 เล่ม งบการเงิน Auto Journal Entry", color: "#03c9d7", icon: "Calculator", category: "นักบัญชี" },
              { title: "AI ตรวจสลิป & สร้างเอกสาร", desc: "AI อ่านสลิป สร้างใบกำกับภาษี บันทึกบัญชีอัตโนมัติ ไม่ต้องคีย์เอง", color: "#05b187", icon: "Bot", category: "AI & Automation" },
              { title: "POS ร้านค้า & ร้านอาหาร", desc: "ขายหน้าร้าน จัดการโต๊ะ ส่งครัว KDS แยกบิล เซอร์วิสชาร์จ", color: "#fec90f", icon: "Store", category: "ร้านค้า" },
              { title: "คลังสินค้า WMS", desc: "Bin Location Wave Picking PDA Interface Real-time Stock Sync", color: "#fb9678", icon: "Warehouse", category: "โลจิสติกส์" },
              { title: "สำนักงานบัญชี", desc: "Multi-tenant หลายบริษัท สัญญาจ้างออนไลน์ Work Board FTP Archive", color: "#05b187", icon: "Building2", category: "สำนักงานบัญชี" },
              { title: "ปั๊มน้ำมัน Gas Station", desc: "ตั้งค่าน้ำมัน ถัง ตู้จ่าย ยอดขายรายวัน สต็อก Oil Loss/Gain ภาษีท้องถิ่น", color: "#05b187", icon: "Fuel", category: "ปั๊มน้ำมัน" },
            ]).map((video: any, i: number) => {
              const ICON_MAP: Record<string, any> = { ShoppingCart, Calculator, Bot, Store, Warehouse, Building2, Fuel };
              const IconComp = ICON_MAP[video.icon] || Play;
              return (
              <AnimateOnScroll key={i} delay={i * 0.1}>
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-xl transition-all group" data-testid={`video-demo-${i}`}>
                  <div className="relative aspect-video bg-gray-100 flex items-center justify-center cursor-pointer group-hover:from-gray-50 group-hover:to-white transition-all">
                    <div className="absolute top-3 left-3">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: video.color }}>{video.category}</span>
                    </div>
                    <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-all" style={{ backgroundColor: video.color }}>
                      <Play className="w-8 h-8 text-white ml-1" fill="white" />
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <IconComp className="w-5 h-5" style={{ color: video.color }} />
                      <h3 className="font-bold text-gray-900 text-[15px]">{video.title}</h3>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{video.desc}</p>
                  </div>
                </div>
              </AnimateOnScroll>
            );})}
          </div>
        </div>
      </section>

      {/* Featured Clients - Marquee */}
      <section className="py-16 bg-[#fafbfe] overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">FEATURED CLIENTS</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">ลูกค้าที่ไว้วางใจ</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">องค์กรและธุรกิจชั้นนำที่เลือกใช้ E-Tax Center ในการจัดการบัญชีและ E-Commerce</p>
            </div>
          </AnimateOnScroll>
          {(() => {
            const clients = dbFeaturedClients || [
              { name: "อี บิซ ซินดิเคท", type: "Audit Firm", color: "#fec90f" },
              { name: "อิ่มเอิบทรัพย์", type: "E-Commerce", color: "#03c9d7" },
              { name: "รวยเป็นเลิศ 168", type: "E-Commerce", color: "#05b187" },
              { name: "พีพีพี กรุ๊ป คอร์ปอเรชั่น", type: "ร้านเครื่องดื่ม", color: "#f94d4d" },
              { name: "พัทลุง โฟโต้มีเดีย", type: "E-Commerce", color: "#fb9678" },
              { name: "เอสพีเอส เบสท์ ซัพพลายส์", type: "E-Commerce", color: "#03c9d7" },
              { name: "หัวหิน เทอมินอล", type: "โรงแรม", color: "#fec90f" },
              { name: "คิมมี่ ลูบริแคนท์ส", type: "E-Commerce", color: "#05b187" },
              { name: "ทีวีที เวนเจอร์ส", type: "E-Commerce", color: "#fb9678" },
              { name: "เฌอริตา อินเตอร์เทรด", type: "E-Commerce", color: "#f94d4d" },
              { name: "เดอะ แฮพพิลิ ริช", type: "E-Commerce", color: "#03c9d7" },
              { name: "ฟู้ด กรีนเนอรี่ อินโนเวชั่น", type: "E-Commerce", color: "#05b187" },
              { name: "เพ็ทตาซีย์เวิลด์", type: "E-Commerce", color: "#fb9678" },
              { name: "ทีจีที ลอว์ แอนด์ แอคเคาน์ติ้ง", type: "Law Firm", color: "#fec90f" },
              { name: "เล็ทอิทโกโลจิสติกส์", type: "Logistics", color: "#03c9d7" },
              { name: "บอนนี่ ครีเอชั่นส์", type: "เสริมความงาม", color: "#f94d4d" },
              { name: "โคคัท โปรดักชั่น", type: "Media", color: "#fb9678" },
              { name: "กรีนเทค 2024", type: "Trading", color: "#05b187" },
              { name: "ฮันบับ", type: "F&B", color: "#f94d4d" },
              { name: "บ้านเสื้อ 1998", type: "E-Commerce", color: "#03c9d7" },
              { name: "กลาสโก เทรดดิ้ง", type: "E-Commerce", color: "#05b187" },
              { name: "ยงดีพานิช", type: "E-Commerce", color: "#fb9678" },
              { name: "เฮ้าส์ ออฟ ริช", type: "E-Commerce", color: "#fec90f" },
              { name: "ชาว เพ็ท เวิร์ล", type: "E-Commerce", color: "#03c9d7" },
            ];
            const perRow = Math.ceil(clients.length / 3);
            const row1 = clients.slice(0, perRow);
            const row2 = clients.slice(perRow, perRow * 2);
            const row3 = clients.slice(perRow * 2);
            const renderPill = (c: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3 bg-white rounded-full border border-gray-100 shadow-sm flex-shrink-0 hover:shadow-md transition-all">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: (c.color || "#03c9d7") + "15" }}>
                  <span className="text-sm font-extrabold" style={{ color: c.color || "#03c9d7" }}>{c.name.charAt(0)}</span>
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-700 whitespace-nowrap">{c.name}</div>
                  <div className="text-[10px] text-gray-400 whitespace-nowrap">{c.type}</div>
                </div>
              </div>
            );
            return (
              <div className="space-y-4">
                {[row1, row2, row3].map((row, ri) => (
                  <div key={ri} className="overflow-hidden">
                    <div className={`flex gap-4 ${ri === 1 ? "animate-marquee-right" : "animate-marquee-left"}`} style={{ width: "max-content" }}>
                      {[...row, ...row, ...row, ...row].map((c, ci) => renderPill(c, ci))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      {/* Awards & Certifications */}
      <section className="py-16 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">AWARDS & CERTIFICATIONS</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">มาตรฐานที่คุณวางใจได้</h2>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.2}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { icon: Award, title: "มาตรฐานสรรพากร", desc: "ผ่านการรับรองซอฟต์แวร์เพื่อภาษีสรรพากร รองรับ e-Tax Invoice", color: "#03c9d7", bg: "#e8fafb" },
                { icon: Shield, title: "TFRS Compliant", desc: "รองรับมาตรฐานการรายงานทางการเงินของไทย (TFRS) ครบถ้วน", color: "#fb9678", bg: "#f0f7ff" },
                { icon: Lock, title: "SSL Encryption", desc: "ข้อมูลเข้ารหัส SSL 256-bit ปลอดภัยระดับธนาคาร สำรองข้อมูลทุกวัน", color: "#05b187", bg: "#eefbf5" },
                { icon: CheckCircle2, title: "Double Entry", desc: "ระบบบัญชีคู่มาตรฐานสากล แม่นยำ โปร่งใส ตรวจสอบได้", color: "#fec90f", bg: "#fffbf0" },
              ].map((cert, i) => (
                <div key={i} className="rounded-2xl p-6 text-center hover:shadow-xl transition-all group" style={{ background: cert.bg }} data-testid={`cert-${i}`}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-all" style={{ backgroundColor: cert.color + "18" }}>
                    <cert.icon className="w-8 h-8" style={{ color: cert.color }} />
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 text-[15px]">{cert.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{cert.desc}</p>
                </div>
              ))}
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Implementation & Support */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">IMPLEMENTATION & SUPPORT</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">เริ่มต้นใช้งานง่าย มีทีมดูแลตลอด</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">ทีมงานพร้อมช่วยตั้งค่าระบบ วางแผนงาน และซัพพอร์ตตลอดการใช้งาน</p>
            </div>
          </AnimateOnScroll>

          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
              <div className="hidden md:block absolute top-12 left-[12.5%] right-[12.5%] h-0.5 bg-[#fb9678]" />
              {[
                { step: "01", title: "สมัครใช้งาน", desc: "ลงทะเบียนฟรี เลือกแพ็คเกจที่เหมาะกับธุรกิจ", color: "#03c9d7", icon: Zap },
                { step: "02", title: "ตั้งค่าระบบ", desc: "ทีมงานช่วยตั้งค่าผังบัญชี เชื่อมต่อแพลตฟอร์ม นำเข้าข้อมูล", color: "#fb9678", icon: BookOpen },
                { step: "03", title: "อบรมการใช้งาน", desc: "อบรมฟรี ทั้งออนไลน์และออนไซต์ พร้อมคู่มือภาษาไทย", color: "#fec90f", icon: GraduationCap },
                { step: "04", title: "ใช้งานจริง", desc: "เริ่มใช้งานพร้อมทีม Support คอยดูแลตลอด", color: "#05b187", icon: CheckCircle2 },
              ].map((s, i) => (
                <AnimateOnScroll key={i} delay={i * 0.35}>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 rounded-2xl flex items-center justify-center mb-5 relative z-10 shadow-lg" style={{ backgroundColor: s.color }}>
                      <s.icon className="w-10 h-10 text-white" />
                    </div>
                    <div className="text-xs font-extrabold mb-2 tracking-wider" style={{ color: s.color }}>STEP {s.step}</div>
                    <h3 className="font-bold text-gray-900 mb-2">{s.title}</h3>
                    <p className="text-xs text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </AnimateOnScroll>
              ))}
            </div>

            <AnimateOnScroll delay={1.5}>
              <div className="mt-14 bg-[#fb9678]/5 rounded-2xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#03c9d7]/15 flex items-center justify-center shrink-0">
                    <GraduationCap className="w-7 h-7 text-[#03c9d7]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-[15px]">อบรมฟรี! เรียนรู้การใช้งานระบบ</h3>
                    <p className="text-xs text-gray-400 mt-1">จัดอบรมออนไลน์ทุกสัปดาห์ สอนตั้งแต่พื้นฐานจนใช้งานได้จริง ไม่มีค่าใช้จ่าย</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate("/contact")}
                  className="px-6 py-3 text-sm font-bold text-white bg-[#03c9d7] rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all whitespace-nowrap"
                  data-testid="btn-training"
                >
                  ลงทะเบียนอบรม
                </button>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Other Services Carousel - FlowAccount Style */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-6 tracking-normal">บริการอื่นๆ จาก E-Tax Center</h2>
              <div className="flex flex-wrap justify-center gap-3">
                {[
                  { label: "แนะนำสำนักงานบัญชี", key: "accounting" },
                  { label: "ที่ปรึกษา E-Commerce", key: "ecommerce" },
                  { label: "รับจดทะเบียนบริษัท", key: "register" },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveServiceTab(tab.key)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold border transition-all ${
                      activeServiceTab === tab.key
                        ? "bg-[#03c9d7] text-white border-[#03c9d7] shadow"
                        : "bg-white text-gray-600 border-gray-200 hover:border-[#03c9d7] hover:text-[#03c9d7]"
                    }`}
                    data-testid={`btn-service-tab-${tab.key}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </AnimateOnScroll>

          {(() => {
            const services: Record<string, { title: string; desc: string; bullets: string[]; cta: string; ctaLink: string; img: string }> = {
              accounting: {
                title: "ให้ช่วยหาสำนักงานบัญชีที่ตรงใจคุณ",
                desc: "ทำธุรกิจให้สำเร็จไปกับ สำนักงานบัญชี ออนไลน์ ที่เข้าใจ E-Tax Center และธุรกิจของคุณ ให้เราช่วยแนะนำสำนักงานบัญชีที่เหมาะกับธุรกิจของคุณได้ที่นี่",
                bullets: ["สำนักงานที่ผ่านการรับรอง", "เชี่ยวชาญ E-Commerce", "ราคายุติธรรม"],
                cta: "เรียนรู้เพิ่มเติม",
                ctaLink: "/contact",
                img: "accounting",
              },
              ecommerce: {
                title: "ที่ปรึกษา E-Commerce มืออาชีพ",
                desc: "ทีมผู้เชี่ยวชาญพร้อมช่วยวางระบบ E-Commerce ตั้งแต่เปิดร้าน จัดการสต็อก ไปจนถึงวิเคราะห์กำไรขาดทุน ให้ธุรกิจออนไลน์ของคุณเติบโตอย่างยั่งยืน",
                bullets: ["วางแผนกลยุทธ์ร้านค้าออนไลน์", "เชื่อมต่อหลายแพลตฟอร์ม", "วิเคราะห์ข้อมูลการขาย"],
                cta: "เรียนรู้เพิ่มเติม",
                ctaLink: "/contact",
                img: "ecommerce",
              },
              register: {
                title: "บริการจดทะเบียนบริษัทครบวงจร",
                desc: "จดทะเบียนบริษัท ห้างหุ้นส่วน จดทะเบียนภาษีมูลค่าเพิ่ม และเอกสารราชการอื่นๆ โดยทีมงานมืออาชีพ ราคาคุ้มค่า ดำเนินการรวดเร็ว",
                bullets: ["จดทะเบียนบริษัท / หจก.", "จดทะเบียนภาษีมูลค่าเพิ่ม", "เอกสาร DBD / กรมสรรพากร"],
                cta: "เรียนรู้เพิ่มเติม",
                ctaLink: "/contact",
                img: "register",
              },
            };
            const svc = services[activeServiceTab] || services.accounting;
            return (
              <AnimateOnScroll>
                <div className="max-w-5xl mx-auto">
                  <div className="bg-[#f5f9fa] rounded-3xl overflow-hidden relative">
                    <div className="flex flex-col md:flex-row items-stretch">
                      <div className="md:w-5/12 bg-gradient-to-br from-[#e8f4f6] to-[#dceef1] p-2 flex items-center justify-center min-h-[280px]">
                        <div className="w-full h-full rounded-2xl bg-white/60 flex items-center justify-center p-8">
                          {activeServiceTab === "accounting" && (
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-2xl bg-[#03c9d7]/15 flex items-center justify-center mx-auto mb-3">
                                <Calculator className="w-10 h-10 text-[#03c9d7]" />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">Certified Partners</p>
                            </div>
                          )}
                          {activeServiceTab === "ecommerce" && (
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-2xl bg-[#fb9678]/15 flex items-center justify-center mx-auto mb-3">
                                <ShoppingCart className="w-10 h-10 text-[#fb9678]" />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">E-Commerce Experts</p>
                            </div>
                          )}
                          {activeServiceTab === "register" && (
                            <div className="text-center">
                              <div className="w-20 h-20 rounded-2xl bg-[#05b187]/15 flex items-center justify-center mx-auto mb-3">
                                <FileText className="w-10 h-10 text-[#05b187]" />
                              </div>
                              <p className="text-sm text-gray-500 font-medium">Registration Services</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="md:w-7/12 p-8 md:p-10 flex flex-col justify-center">
                        <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4 leading-snug">{svc.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed mb-5">{svc.desc}</p>
                        <ul className="space-y-2 mb-6">
                          {svc.bullets.map((b, i) => (
                            <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                              <CheckCircle2 className="w-4 h-4 text-[#05b187] flex-shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                        <a
                          href={svc.ctaLink}
                          className="inline-flex items-center gap-1 text-sm font-bold text-[#03c9d7] hover:underline"
                          data-testid="link-service-cta"
                        >
                          {svc.cta} <ChevronRight className="w-4 h-4" />
                        </a>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        const keys = ["accounting", "ecommerce", "register"];
                        const idx = keys.indexOf(activeServiceTab);
                        setActiveServiceTab(keys[(idx - 1 + keys.length) % keys.length]);
                      }}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
                      data-testid="btn-service-prev"
                    >
                      <ChevronLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <button
                      onClick={() => {
                        const keys = ["accounting", "ecommerce", "register"];
                        const idx = keys.indexOf(activeServiceTab);
                        setActiveServiceTab(keys[(idx + 1) % keys.length]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 shadow-lg flex items-center justify-center hover:bg-white transition-colors z-10"
                      data-testid="btn-service-next"
                    >
                      <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                  </div>
                </div>
              </AnimateOnScroll>
            );
          })()}
        </div>
      </section>

      {/* Highlight Features - Detailed */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">HIGHLIGHT FEATURES</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">ฟีเจอร์เด่น <span className="text-[#03c9d7]">แต่ละโมดูล</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">ทุกโมดูลเต็มไปด้วยเครื่องมือที่ออกแบบมาเพื่อธุรกิจไทยโดยเฉพาะ</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: FileCheck2, title: "e-Tax Invoice อิเล็กทรอนิกส์", desc: "ออกใบกำกับภาษีอิเล็กทรอนิกส์ตามมาตรฐานกรมสรรพากร ลงลายเซ็นดิจิทัล ส่งตรงถึงผู้รับทันที Auto-TIV ออกใบกำกับภาษีอัตโนมัติเมื่อจัดส่ง", color: "#03c9d7" },
              { icon: PieChart, title: "สร้างงบการเงินฉบับจริงได้ทันที", desc: "งบทดลอง งบกำไรขาดทุน งบแสดงฐานะการเงิน งบกระแสเงินสด เปรียบเทียบรายเดือน/รายปี พร้อมพิมพ์ส่งกรมสรรพากร ไม่ต้องทำมือ", color: "#fb9678" },
              { icon: FileText, title: "ออกเอกสารครบวงจร", desc: "ใบเสนอราคา ใบสั่งขาย ใบกำกับภาษี ใบเสร็จ ใบลดหนี้ ใบเพิ่มหนี้ ภ.พ.30 รายงานภาษีซื้อ-ภาษีขาย ภงด.1 50 ทวิ", color: "#05b187" },
              { icon: Calculator, title: "ผังบัญชีมาตรฐาน TFRS", desc: "โครงสร้างผังบัญชีแบบ TFRS ทั้ง 3 หลักและ 7 หลัก สมุดรายวัน 5 เล่ม Auto Journal Entry ภาษีหัก ณ ที่จ่ายอัตโนมัติ", color: "#f94d4d" },
              { icon: BarChart3, title: "Dashboard Real-Time", desc: "ติดตามกระแสเงินสด ลูกหนี้-เจ้าหนี้ AR/AP Aging อัตราส่วนทางการเงิน ยอดขายแต่ละแพลตฟอร์ม กำไรต่อออเดอร์", color: "#fec90f" },
              { icon: Bot, title: "AI Automation", desc: "AI ตรวจสลิป VAT Product Dictionary Demand Forecasting พยากรณ์สินค้า Chat Auto-Reply 5 ประเภท Trigger Restock Alert", color: "#03c9d7" },
              { icon: Coins, title: "Settlement & Wallet", desc: "นำเข้ารายงาน Settlement ติดตาม Wallet ลงบัญชีค่าธรรมเนียมอัตโนมัติ กระทบยอดข้ามแพลตฟอร์ม VAT Closing Warning", color: "#fb9678" },
              { icon: MessageSquare, title: "Unified Chat & Inbox", desc: "รวมแชทจากทุกแพลตฟอร์ม Facebook Chat Orders AI อ่าน CF อัตโนมัติ ตรวจสลิปด้วย Vision API Auto-Reply Rules", color: "#05b187" },
              { icon: ScanBarcode, title: "Barcode & Product Management", desc: "Auto-Generate EAN-13 พิมพ์ Label สินค้าธรรมดา/ชุด/ผลิต BOM โปรโมชั่น Low Stock Alert 12 สกุลเงิน", color: "#f94d4d" },
              { icon: Shield, title: "Multi-tenant สำนักงานบัญชี", desc: "จัดการลูกค้าหลายบริษัท White Label Branding สัญญาจ้างออนไลน์ Work Board คลังเอกสาร Activity Log", color: "#fec90f" },
              { icon: FolderOpen, title: "คลังเอกสาร & FTP Archive", desc: "คลังเอกสารหมวดหมู่ FTP Archive สำรองอัตโนมัติ LAN Fallback Supplier Portal สั่งซื้อออนไลน์ Excel Export", color: "#03c9d7" },
              { icon: Zap, title: "RESTful API & Webhook", desc: "เชื่อมต่อกับระบบอื่นๆ ได้ทุกระบบ OAuth 2.0 Webhook Excel/CSV Import LINE Notification Dark/Light Mode", color: "#fb9678" },
            ].map((f, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1}>
                <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all group" data-testid={`highlight-feature-${i}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-all" style={{ backgroundColor: f.color + "15" }}>
                      <f.icon className="w-6 h-6" style={{ color: f.color }} />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-2 text-[15px]">{f.title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Competitive Advantage - Why choose us over competitors */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">ทำไมต้องเลือกเรา</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">ทำไมต้องเลือก <span className="text-[#03c9d7]">E-Tax Center</span></h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">ซื้อแยกโมดูล ได้ระบบระดับ Enterprise — เปรียบเทียบกับโปรแกรมบัญชีทั่วไป</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
          <div className="max-w-4xl mx-auto mb-12">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-lg">
              <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
                <div className="p-4 text-sm font-bold text-gray-500 text-center">ฟีเจอร์</div>
                <div className="p-4 text-sm font-bold text-center border-x border-gray-100" style={{ color: "#03c9d7" }}>E-Tax Center</div>
                <div className="p-4 text-sm font-bold text-gray-400 text-center">โปรแกรมบัญชีทั่วไป</div>
              </div>
              {[
                { feature: "เชื่อมต่อ E-Commerce 7+ แพลตฟอร์ม", us: true, them: false },
                { feature: "AI ตรวจสลิป & Demand Forecasting", us: true, them: false },
                { feature: "ออกใบกำกับภาษี & e-Tax Invoice อัตโนมัติ", us: true, them: "บางส่วน" },
                { feature: "WMS คลังสินค้า & Wave/Batch Picking", us: true, them: false },
                { feature: "POS ขายปลีก + POS ร้านอาหาร + KDS", us: true, them: false },
                { feature: "HR & เงินเดือน + ESS Portal + สัญญาจ้าง", us: true, them: false },
                { feature: "Live Selling & Lucky Draw & AI Agency", us: true, them: false },
                { feature: "Settlement & Wallet Tracking", us: true, them: false },
                { feature: "Multi-tenant สำนักงานบัญชี + White Label", us: true, them: false },
                { feature: "Unified Chat Inbox & Auto-Reply Rules", us: true, them: false },
                { feature: "Barcode Auto-Gen & Label Printing", us: true, them: false },
                { feature: "คลังเอกสาร & FTP Archive สำรองอัตโนมัติ", us: true, them: false },
                { feature: "รองรับ 12 สกุลเงิน & โปรโมชั่น", us: true, them: "บางส่วน" },
                { feature: "Dark Mode & ปรับธีมสีได้", us: true, them: false },
              ].map((row, ri) => (
                <div key={ri} className={`grid grid-cols-3 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-50 last:border-0`}>
                  <div className="p-4 text-sm text-gray-700 font-medium">{row.feature}</div>
                  <div className="p-4 text-center border-x border-gray-50">
                    <div className="w-7 h-7 rounded-full bg-[#05b187]/15 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-4.5 h-4.5 text-[#05b187]" />
                    </div>
                  </div>
                  <div className="p-4 text-center">
                    {row.them === false ? (
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                        <X className="w-4 h-4 text-gray-300" />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 font-medium">{row.them}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { value: "80%", label: "ลดเวลาคีย์ข้อมูล", color: "#03c9d7" },
              { value: "7+", label: "แพลตฟอร์มเชื่อมต่อ", color: "#fb9678" },
              { value: "100+", label: "ฟีเจอร์ครบวงจร", color: "#05b187" },
              { value: "24/7", label: "ใช้งานได้ตลอด", color: "#03c9d7" },
            ].map((s, si) => (
              <AnimateOnScroll key={si} delay={si * 0.15}>
              <div className="text-center p-5 bg-gray-50 rounded-2xl">
                <div className="text-2xl font-extrabold mb-1" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-gray-400 font-medium">{s.label}</div>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Platform Benefits */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <div className="flex justify-center mb-4"><FlexyDecor /></div>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">แพลตฟอร์มที่คุณ<span className="text-[#03c9d7]">วางใจได้</span></h2>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Cloud, title: "Cloud-Based", desc: "ใช้งานผ่านเว็บ ไม่ต้องติดตั้ง เข้าถึงได้ทุกที่ทุกเวลา ข้อมูลปลอดภัยบน Cloud", color: "#fb9678", bg: "#f0f7ff" },
              { icon: Lock, title: "ปลอดภัยสูงสุด", desc: "ข้อมูลเข้ารหัส SSL แยก Tenant อย่างเด็ดขาด สำรองข้อมูลทุกวัน", color: "#05b187", bg: "#eefbf5" },
              { icon: RefreshCw, title: "อัปเดตตลอด", desc: "พัฒนาฟีเจอร์ใหม่ต่อเนื่อง อัปเดตอัตโนมัติ ไม่ต้องดาวน์โหลดอะไรเพิ่ม", color: "#03c9d7", bg: "#e8fafb" },
            ].map((item, i) => (
              <AnimateOnScroll key={i} delay={i * 0.15}>
              <div className="rounded-2xl p-8 relative overflow-hidden group hover:shadow-xl transition-all" style={{ background: item.bg }}>
                <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-20" style={{ backgroundColor: item.color }} />
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ backgroundColor: item.color + "18" }}>
                  <item.icon className="w-7 h-7" style={{ color: item.color }} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed relative z-10">{item.desc}</p>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section - Modular Plans */}
      <section id="pricing" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <div className="flex justify-center mb-4"><FlexyDecor /></div>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">ราคาแต่ละโมดูล — <span className="text-[#03c9d7]">จ่ายตามที่ใช้จริง</span></h2>
              <p className="text-gray-400 text-[15px]">เริ่มต้นฟรี ซื้อทีละโมดูลก็ได้ ธุรกิจโตก็เพิ่มโมดูล อัปเกรดหรือยกเลิกเมื่อไหร่ก็ได้</p>
            </div>
          </AnimateOnScroll>

          {/* Target Group Tabs */}
          <AnimateOnScroll>
            <div className="flex justify-center mb-6">
              <div className="inline-flex rounded-full bg-gray-100 p-1 gap-1" data-testid="pricing-tabs">
                {([
                  { key: "general" as const, label: "ธุรกิจทั่วไป" },
                  { key: "ecommerce" as const, label: "ร้านค้าออนไลน์" },
                  { key: "firm" as const, label: "สำนักงานบัญชี" },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${activeTab === tab.key ? "bg-[#fb9678] text-white shadow-md" : "text-gray-600 hover:text-gray-800 hover:bg-gray-200"}`}
                    data-testid={`pricing-tab-${tab.key}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </AnimateOnScroll>

          {/* Billing Toggle */}
          <AnimateOnScroll>
            <div className="flex justify-center items-center gap-3 mb-10 relative" data-testid="pricing-billing-toggle">
              <span className={`text-sm font-semibold ${!isYearly ? "text-gray-900" : "text-gray-400"}`}>รายเดือน</span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-14 h-7 rounded-full transition-colors ${isYearly ? "bg-[#fb9678]" : "bg-gray-300"}`}
                data-testid="btn-billing-toggle"
              >
                <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-transform ${isYearly ? "translate-x-7" : "translate-x-0"}`} />
              </button>
              <span className={`text-sm font-semibold ${isYearly ? "text-gray-900" : "text-gray-400"}`}>รายปี (ประหยัด)</span>
              {isYearly && (
                <div className="absolute left-[calc(50%+130px)] top-1/2 -translate-y-1/2 hidden sm:flex items-center" style={{ animation: "carouselFadeIn 0.4s ease" }}>
                  <svg width="36" height="32" viewBox="0 0 36 32" fill="none" className="mr-0.5 flex-shrink-0">
                    <path d="M4 28 C6 10, 18 4, 30 10" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    <path d="M26 6 L30 10 L25 12" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="text-[#e6a800] font-bold text-sm whitespace-nowrap relative">
                    ประหยัดกว่า 17%
                    <svg className="absolute -bottom-1.5 left-0 w-full" height="6" viewBox="0 0 100 6" preserveAspectRatio="none">
                      <path d="M2 4 Q25 1 50 3.5 Q75 5.5 98 2" stroke="#fec90f" strokeWidth="2.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </span>
                </div>
              )}
            </div>
          </AnimateOnScroll>

          {/* Dynamic Plans */}
          {(() => {
            const filteredPlans = subscriptionPlans
              .filter((p: any) => p.targetGroup === activeTab && p.active !== false)
              .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
            const midIndex = Math.floor(filteredPlans.length / 2);
            const hasAnyPopular = filteredPlans.some((p: any) => p.popular);
            const planColor = "#03c9d7";

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
                {filteredPlans.map((plan: any, i: number) => {
                  const isPopular = hasAnyPopular ? !!plan.popular : (filteredPlans.length > 1 && i === midIndex);
                  const monthlyPrice = parseFloat(plan.monthlyPrice || "0");
                  const yearlyPrice = parseFloat(plan.yearlyPrice || "0");
                  const displayPrice = isYearly && yearlyPrice > 0 ? Math.round(yearlyPrice / 12) : monthlyPrice;
                  const setupFee = parseFloat(plan.setupFee || "0");
                  const features: string[] = plan.landingFeatures || plan.features || [];

                  return (
                    <AnimateOnScroll key={plan.id} delay={i * 0.1}>
                      <div
                        className={`bg-white rounded-2xl overflow-hidden transition-all hover:shadow-2xl relative ${isPopular ? "shadow-2xl ring-2" : "border border-gray-100 hover:-translate-y-1"}`}
                        style={isPopular ? { borderColor: planColor, ["--tw-ring-color" as any]: planColor } : undefined}
                        data-testid={`pricing-card-${plan.code || plan.name.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        {isPopular && (
                          <div className="text-center py-2 text-xs font-bold text-white tracking-wide" style={{ backgroundColor: planColor }}>
                            แนะนำ — ยอดนิยม
                          </div>
                        )}
                        <div className="p-6">
                          <h3 className="text-base font-bold text-gray-900 mb-1">{plan.name}</h3>
                          <p className="text-xs text-gray-400 mb-4 min-h-[32px]">{plan.description}</p>
                          <div className="flex items-end gap-1 mb-1">
                            {displayPrice === 0 ? (
                              <span className="text-[36px] font-extrabold leading-none" style={{ color: planColor }}>ฟรี</span>
                            ) : (
                              <>
                                <span className="text-[36px] font-extrabold leading-none" style={{ color: planColor }}>
                                  ฿{displayPrice.toLocaleString()}
                                </span>
                                <span className="text-xs text-gray-400 pb-1 ml-1">/เดือน</span>
                              </>
                            )}
                          </div>
                          {isYearly && yearlyPrice > 0 && displayPrice > 0 && (
                            <p className="text-xs text-gray-400 mb-3">เฉลี่ย ฿{Math.round(yearlyPrice / 12).toLocaleString()}/เดือน</p>
                          )}
                          {!isYearly && displayPrice > 0 && <div className="mb-3" />}
                          {displayPrice === 0 && <div className="mb-3" />}
                          {setupFee > 0 && (
                            <div className="text-xs font-semibold text-[#fb9678] mb-3" data-testid={`setup-fee-${plan.code}`}>
                              ค่าติดตั้ง ฿{setupFee.toLocaleString()}
                            </div>
                          )}
                          <button
                            onClick={() => navigate(plan.landingLink || "/register")}
                            className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${isPopular ? "text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5" : "border-2 hover:shadow-md hover:-translate-y-0.5"}`}
                            style={isPopular ? { backgroundColor: planColor } : { borderColor: planColor, color: planColor }}
                            data-testid={`btn-pricing-${plan.code || plan.name.toLowerCase().replace(/\s+/g, "-")}`}
                          >
                            {plan.landingCta || (displayPrice === 0 ? "เริ่มใช้ฟรี" : "เริ่มทดลองใช้")}
                          </button>
                          <div className="mt-5 space-y-2.5">
                            {features.map((f: string, fi: number) => (
                              <div key={fi} className="flex items-start gap-2.5 text-sm text-gray-600">
                                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: planColor }} />
                                <span>{f}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </AnimateOnScroll>
                  );
                })}
                {filteredPlans.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-400 text-sm">
                    กำลังโหลดแพ็คเกจ...
                  </div>
                )}
              </div>
            );
          })()}

          {/* Add-on Modules */}
          <AnimateOnScroll>
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-2">โมดูลเสริม (Add-on)</h3>
              <p className="text-sm text-gray-400">เพิ่มความสามารถให้ระบบตามที่ต้องการ ใช้ร่วมกับแพ็คเกจใดก็ได้</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {(dbAddons.length > 0 ? dbAddons : ADDON_MODULES).map((addon: any, ai: number) => {
                const addonColor = addon.color || ["#fec90f","#03c9d7","#fb9678","#05b187","#f94d4d","#539BFF"][ai % 6];
                const price = addon.monthlyPrice ? parseFloat(addon.monthlyPrice) : (addon.price ? parseFloat(String(addon.price).replace(/,/g,"")) : 0);
                const addonName = addon.name;
                const addonDesc = addon.description || addon.desc || "";
                const IconComp = addon.icon && typeof addon.icon !== "string" ? addon.icon : null;
                return (
                  <div key={addon.id || ai} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all group" data-testid={`addon-${addon.code || ai}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: addonColor + "15" }}>
                        {IconComp ? <IconComp className="w-5 h-5" style={{ color: addonColor }} /> : <Package className="w-5 h-5" style={{ color: addonColor }} />}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{addonName}</div>
                        <div className="text-xs font-bold" style={{ color: addonColor }}>
                          {price > 0 ? `+${price.toLocaleString()} บาท/เดือน` : "ฟรี"}
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{addonDesc}</p>
                  </div>
                );
              })}
            </div>
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Testimonials - Flexy Style */}
      <section id="testimonials" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <div className="flex justify-center mb-4"><FlexyDecor /></div>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">{sectionData.testimonials?.title || "ลูกค้าพูดถึงเรา"}</h2>
              <p className="text-gray-400 text-[15px]">{sectionData.testimonials?.subtitle || "เสียงจากผู้ใช้งานจริงที่ไว้วางใจ E-Tax Center"}</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {dbTestimonials.map((t: any, i: number) => (
              <AnimateOnScroll key={i} delay={i * 0.15} className="h-full">
              <div className="bg-white rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all relative overflow-hidden group h-full flex flex-col" data-testid={`testimonial-${i}`}>
                <div className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ backgroundColor: t.color }} />
                <div className="flex gap-1 mb-5">
                  {Array.from({ length: t.stars }).map((_, si) => (
                    <Star key={si} className="w-5 h-5 fill-[#fec90f] text-[#fec90f]" />
                  ))}
                </div>
                <p className="text-gray-600 leading-relaxed mb-7 text-[15px] flex-1">"{t.text}"</p>
                <div className="flex items-center gap-4 mt-auto">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md" style={{ backgroundColor: t.color }}>
                    {t.name.charAt(3)}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-[15px]">{t.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.role}</div>
                  </div>
                </div>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Flexy Style */}
      <section className="py-20 relative overflow-hidden bg-[#fafbfe]">
        <DecorativeShape className="absolute -top-20 -left-20 w-[400px] h-[400px]" color="#03c9d7" />
        <DecorativeShape className="absolute -bottom-20 -right-20 w-[400px] h-[400px]" color="#03c9d7" />

        <AnimateOnScroll>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/50 p-10 sm:p-14 text-center border border-gray-100">
            <div className="flex justify-center mb-3 -space-x-3">
              {["#03c9d7", "#fb9678", "#fec90f"].map((c, i) => (
                <div key={i} className="w-12 h-12 rounded-full border-[3px] border-white flex items-center justify-center text-white font-bold shadow-md" style={{ backgroundColor: c, zIndex: 3 - i }}>
                  {["3", "2", "1"][i]}
                </div>
              ))}
            </div>
            <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 mb-4 mt-6 tracking-normal">พร้อมเลือกโมดูลแรกแล้วหรือยัง?</h2>
            <p className="text-gray-400 text-[15px] mb-8 max-w-lg mx-auto">เริ่มจากโมดูลเดียวก็ได้ ทดลองฟรี 15 วัน ไม่ต้องผูกบัตร ธุรกิจโตก็เพิ่มโมดูลได้ทันที</p>
            <button
              onClick={() => navigate("/register")}
              className="px-10 py-4 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl hover:shadow-[#03c9d7]/35 hover:bg-[#02b5c2] hover:-translate-y-0.5 transition-all"
              data-testid="cta-register"
            >
              เริ่มใช้งานฟรี
            </button>
          </div>
        </div>
        </AnimateOnScroll>
      </section>

      {/* Articles & Resources - FlowAccount Style */}
      <section className="py-20 bg-[#f5f9fa]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">บทความบัญชี ภาษี อ่านง่าย</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">
                เรียนรู้การทำเอกสารบัญชี และภาษีเบื้องต้น รวมลิงก์หน่วยงานราชการที่เกี่ยวข้อง เพื่อให้ผู้ประกอบการสามารถทำบัญชีได้ด้วยตนเอง
              </p>
            </div>
          </AnimateOnScroll>

          <div className="relative">
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-in-out gap-6"
                style={{ transform: `translateX(-${articlePage * 100}%)` }}
              >
                {[
                  [
                    { title: "ประกาศสภาวิชาชีพบัญชี", desc: "ติดตามมาตรฐานการรายงานทางการเงิน (TFRS) และประกาศล่าสุดจากสภาวิชาชีพบัญชี", link: "https://www.tfac.or.th", color: "#03c9d7", icon: Award },
                    { title: "กรมพัฒนาธุรกิจการค้า (DBD)", desc: "ตรวจสอบข้อมูลนิติบุคคล จดทะเบียนบริษัท ยื่นงบการเงินออนไลน์ผ่าน DBD e-Filing", link: "https://www.dbd.go.th", color: "#fb9678", icon: Building2 },
                    { title: "กรมสรรพากร (Revenue Department)", desc: "ยื่นภาษีออนไลน์ ตรวจสอบสถานะ VAT ดาวน์โหลดแบบฟอร์ม ภ.พ.30 ภงด.1 และอื่นๆ", link: "https://www.rd.go.th", color: "#05b187", icon: Landmark },
                  ],
                  [
                    { title: "สำนักงานประกันสังคม", desc: "ตรวจสอบสิทธิ์ประกันสังคม คำนวณเงินสมทบ ยื่นแบบ สปส. ออนไลน์สำหรับนายจ้าง", link: "https://www.sso.go.th", color: "#fec90f", icon: Shield },
                    { title: "e-Tax Invoice กรมสรรพากร", desc: "ระบบใบกำกับภาษีอิเล็กทรอนิกส์ มาตรฐานกรมสรรพากร ลดต้นทุนกระดาษ ส่งได้ทันที", link: "https://etax.rd.go.th", color: "#03c9d7", icon: FileText },
                    { title: "ธนาคารแห่งประเทศไทย (BOT)", desc: "อัตราแลกเปลี่ยน อัตราดอกเบี้ย สถิติการเงิน ข้อมูลสำหรับงานบัญชีและการเงิน", link: "https://www.bot.or.th", color: "#fb9678", icon: TrendingUp },
                  ],
                  [
                    { title: "กรมศุลกากร (Customs)", desc: "พิกัดอัตราศุลกากร ระบบ e-Customs สำหรับธุรกิจนำเข้า-ส่งออก คำนวณภาษีนำเข้า", link: "https://www.customs.go.th", color: "#05b187", icon: Globe },
                    { title: "สำนักงาน ก.ล.ต. (SEC)", desc: "กฎระเบียบตลาดทุน มาตรฐานการเปิดเผยข้อมูล สำหรับบริษัทจดทะเบียน", link: "https://www.sec.or.th", color: "#fec90f", icon: Shield },
                    { title: "วิธีออกใบกำกับภาษีที่ถูกต้อง", desc: "เรียนรู้ขั้นตอนการออกใบกำกับภาษี รายการที่ต้องมี ข้อผิดพลาดที่ควรหลีกเลี่ยง", link: "/user-guide", color: "#03c9d7", icon: ClipboardList },
                  ],
                ].map((group, gi) => (
                  <div key={gi} className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-shrink-0 w-full">
                    {group.map((article, ai) => (
                      <a
                        key={ai}
                        href={article.link}
                        target={article.link.startsWith("http") ? "_blank" : undefined}
                        rel={article.link.startsWith("http") ? "noopener noreferrer" : undefined}
                        className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 flex flex-col"
                        data-testid={`card-article-${gi}-${ai}`}
                      >
                        <div className="h-44 flex items-center justify-center relative" style={{ backgroundColor: article.color + "12" }}>
                          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: article.color + "25" }}>
                            <article.icon className="w-8 h-8" style={{ color: article.color }} />
                          </div>
                          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: article.color }}>
                            {article.link.startsWith("http") ? "ลิงก์ภายนอก" : "บทความ"}
                          </div>
                        </div>
                        <div className="p-5 flex-1 flex flex-col">
                          <h3 className="font-bold text-gray-900 mb-2 text-[15px] group-hover:text-[#03c9d7] transition-colors">{article.title}</h3>
                          <p className="text-xs text-gray-400 leading-relaxed flex-1">{article.desc}</p>
                          <span className="inline-flex items-center gap-1 text-sm font-bold mt-4" style={{ color: article.color }}>
                            อ่านเพิ่มเติม <ChevronRight className="w-4 h-4" />
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setArticlePage((p) => Math.max(0, p - 1))}
              className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10 ${articlePage === 0 ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={articlePage === 0}
              data-testid="btn-article-prev"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setArticlePage((p) => Math.min(2, p + 1))}
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-10 ${articlePage === 2 ? "opacity-30 cursor-not-allowed" : ""}`}
              disabled={articlePage === 2}
              data-testid="btn-article-next"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex justify-center gap-2 mt-8">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  onClick={() => setArticlePage(i)}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${articlePage === i ? "bg-[#03c9d7] w-7" : "bg-gray-300"}`}
                  data-testid={`dot-article-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ - Flexy Style */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
          <div className="text-center mb-14">
            <div className="flex justify-center mb-4"><FlexyDecor /></div>
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-normal">{sectionData.faq?.title || "คำถามที่พบบ่อย"}</h2>
            <p className="text-gray-400 text-[15px]">{sectionData.faq?.subtitle || "หาคำตอบที่คุณต้องการ"}</p>
          </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
          <div className="space-y-3">
            {dbFaqItems.map((item: any, i: number) => (
              <FAQItem key={i} item={item} index={i} />
            ))}
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Footer - Flexy Style */}
      <footer className="bg-gray-900 text-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
            <div className="md:col-span-1">
              <div className="flex items-center mb-5">
                <div className="h-11 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
                  <img src={logoWhite} alt="E-Tax Center" className="h-6 object-contain" />
                </div>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">ซื้อเฉพาะโมดูลที่ต้องการ ใช้แยกก็ได้ ใช้รวมก็ดี สำหรับธุรกิจทุกขนาด</p>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="flex items-start gap-2" data-testid="footer-phone">
                  <Phone className="w-4 h-4 mt-0.5 text-[#03c9d7] flex-shrink-0" />
                  <span>063-523-9999</span>
                </li>
                <li className="flex items-start gap-2" data-testid="footer-email">
                  <Mail className="w-4 h-4 mt-0.5 text-[#03c9d7] flex-shrink-0" />
                  <a href="mailto:info@etaxcenter.com" className="hover:text-[#03c9d7] transition-colors">info@etaxcenter.com</a>
                </li>
                <li className="flex items-start gap-2" data-testid="footer-address">
                  <MapPin className="w-4 h-4 mt-0.5 text-[#03c9d7] flex-shrink-0" />
                  <span>54 ซอยคลังมนตรี แขวงจตุจักร เขตจตุจักร กรุงเทพมหานคร 10900</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-[15px]">ผลิตภัณฑ์</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">E-Commerce Hub</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">บัญชี & ภาษี TFRS</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">WMS คลังสินค้า</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">POS ขายปลีก & ร้านอาหาร</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">HR & เงินเดือน + ESS</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">Delivery Hub</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">Settlement & Wallet</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">AI Analytics & Live Agency</li>
                <li className="hover:text-[#03c9d7] cursor-pointer transition-colors">Unified Chat Inbox</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-[15px]">บริษัท</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="/about" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-about">เกี่ยวกับเรา</Link></li>
                <li><Link href="/contact" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-contact">ติดต่อเรา</Link></li>
                <li><Link href="/privacy-policy" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-privacy">นโยบายความเป็นส่วนตัว</Link></li>
                <li><Link href="/terms-of-service" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-terms">เงื่อนไขการใช้งาน</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-5 text-[15px]">ช่วยเหลือ</h4>
              <ul className="space-y-3 text-sm text-gray-400">
                <li><Link href="/user-guide" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-guide">คู่มือการใช้งาน</Link></li>
                <li><Link href="/user-guide" className="hover:text-[#03c9d7] transition-colors" data-testid="footer-video">วิดีโอสอนใช้งาน</Link></li>
                <li><Link href="/contact" className="flex items-center gap-2 hover:text-[#03c9d7] transition-colors" data-testid="footer-support"><Headphones className="w-3.5 h-3.5" /> ติดต่อซัพพอร์ต</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-gray-500">© {new Date().getFullYear()} E-Tax Center. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <Link href="/privacy-policy" className="text-xs text-gray-500 hover:text-[#03c9d7] transition-colors" data-testid="link-privacy-policy">Privacy Policy</Link>
              <span className="text-gray-700">|</span>
              <Link href="/terms-of-service" className="text-xs text-gray-500 hover:text-[#03c9d7] transition-colors" data-testid="link-terms-of-service">Terms of Service</Link>
            </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
