import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useForceLightMode } from "@/hooks/use-force-light";
import PublicNavbar from "@/components/public-navbar";
import PublicFooter from "@/components/public-footer";
import {
  ShoppingCart, FileText, Calculator, Warehouse, Truck, Store, UtensilsCrossed,
  Users, Radio, Bot, MessageSquare, TrendingUp, Coins, ScanBarcode, Shield,
  FolderOpen, ArrowRight, CheckCircle2, Zap, Image as ImageIcon
} from "lucide-react";

function AnimateOnScroll({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(30px)", transition: `opacity 0.6s ease ${delay}s, transform 0.6s ease ${delay}s` }}>
      {children}
    </div>
  );
}

function ScreenshotPlaceholder({ label, color = "#03c9d7", aspectRatio = "16/9" }: { label: string; color?: string; aspectRatio?: string }) {
  return (
    <div
      className="bg-gray-100 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-3 hover:border-gray-300 transition-colors"
      style={{ aspectRatio }}
      data-testid={`screenshot-${label.replace(/\s+/g, "-").toLowerCase()}`}
    >
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
        <ImageIcon className="w-8 h-8" style={{ color }} />
      </div>
      <span className="text-sm font-medium text-gray-400">{label}</span>
      <span className="text-xs text-gray-300">รอใส่รูปภาพ</span>
    </div>
  );
}

const FEATURE_SECTIONS = [
  {
    id: "ecommerce",
    badge: "E-Commerce Hub",
    title: "เชื่อมต่อ 7+ แพลตฟอร์ม\nจัดการทุกออเดอร์ในที่เดียว",
    desc: "ดึงออเดอร์จาก Shopee, Lazada, TikTok Shop, Amazon, LINE OA, Facebook, Instagram อัตโนมัติ ออกใบกำกับภาษี Sync สต็อกข้ามร้าน Store Clone ข้ามแพลตฟอร์ม",
    color: "#fb9678",
    icon: ShoppingCart,
    features: [
      "ดึงออเดอร์อัตโนมัติ Real-time",
      "Sync สต็อกข้ามทุกแพลตฟอร์ม",
      "Store Clone ข้ามร้านข้ามแพลตฟอร์ม",
      "ออกใบกำกับภาษีอัตโนมัติ (Auto-TIV on Ship)",
      "Settlement & Wallet Tracking",
      "Dashboard วิเคราะห์ยอดขายข้ามแพลตฟอร์ม",
      "Bulk Operations จัดการออเดอร์หลายรายการ",
      "Returns & Refunds Management",
    ],
    screenshots: ["หน้ารวมออเดอร์ E-Commerce", "Dashboard ยอดขาย"],
  },
  {
    id: "accounting",
    badge: "บัญชี & ภาษีครบวงจร",
    title: "ผังบัญชี TFRS มาตรฐาน\nสมุดรายวัน 5 เล่ม งบการเงินครบ",
    desc: "ระบบบัญชีคู่ครบถ้วนตามมาตรฐาน TFRS ผังบัญชี 3 หลัก/7 หลัก Auto Journal Entry บันทึกบัญชีอัตโนมัติ เครื่องมือบัญชี 10 รายการ",
    color: "#03c9d7",
    icon: Calculator,
    features: [
      "ผังบัญชี TFRS 3 หลัก (คุม) / 7 หลัก (ย่อย)",
      "สมุดรายวัน 5 เล่ม (ทั่วไป/รับ/จ่าย/ขาย/ซื้อ)",
      "Auto Journal Entry + ภาษีหัก ณ ที่จ่าย",
      "งบทดลอง งบกำไรขาดทุน งบดุล Cash Flow",
      "ภ.พ.30 VAT Summary Report",
      "Bank Reconciliation กระทบยอดธนาคาร",
      "เครื่องมือจัดการบัญชี 10 รายการ",
      "VAT Closing Warning ป้องกันลงผิดงวด",
    ],
    screenshots: ["หน้าสมุดรายวัน", "งบการเงิน"],
  },
  {
    id: "documents",
    badge: "เอกสาร & ใบกำกับภาษี",
    title: "ออกเอกสารครบทุกประเภท\ne-Tax Invoice พร้อมส่ง",
    desc: "ใบเสนอราคา ใบสั่งขาย ใบแจ้งหนี้ ใบกำกับภาษี ใบเสร็จ ใบลดหนี้ ใบเพิ่มหนี้ ใบวางบิล ใบสำคัญจ่าย รองรับ 4 รูปแบบพิมพ์ 12 สกุลเงิน",
    color: "#05b187",
    icon: FileText,
    features: [
      "ใบเสนอราคา / ใบสั่งขาย / ใบแจ้งหนี้",
      "ใบกำกับภาษี / ใบเสร็จรับเงิน",
      "ใบลดหนี้ / ใบเพิ่มหนี้ / ใบวางบิล",
      "e-Tax Invoice ตามมาตรฐานสรรพากร",
      "พิมพ์ได้ 4 รูปแบบ + ส่งอีเมล",
      "รองรับ 12 สกุลเงิน + อัตราแลกเปลี่ยน",
      "Live Preview เอกสารภาษาไทย",
      "Auto-generate เลขที่เอกสาร Prefix ตั้งได้",
    ],
    screenshots: ["ตัวอย่างใบกำกับภาษี", "หน้ารายการเอกสาร"],
  },
  {
    id: "warehouse",
    badge: "WMS คลังสินค้า",
    title: "คลังสินค้าอัจฉริยะ\nBin Location + Wave Picking + PDA",
    desc: "ระบบคลังสินค้าครบวงจร หลายคลัง Bin Location จัดตำแหน่งสินค้า Zone/Aisle/Shelf Wave/Batch Picking PDA Mobile Interface Real-time Stock Sync",
    color: "#fb9678",
    icon: Warehouse,
    features: [
      "หลายคลัง + Bin Location (Zone/Aisle/Shelf)",
      "Wave/Batch Picking จัดหยิบสินค้า",
      "PDA Mobile Interface มือถือสแกน",
      "Real-time Stock Sync ข้ามแพลตฟอร์ม",
      "Cycle Count นับสต็อก",
      "Stock Transfer ย้ายสินค้าข้ามคลัง",
      "Low Stock Alert แจ้งเตือนสต็อกต่ำ",
      "Barcode Auto-Generate EAN-13 + Label Print",
    ],
    screenshots: ["แผนผังคลังสินค้า", "หน้า PDA Picking"],
  },
  {
    id: "delivery",
    badge: "Delivery Hub",
    title: "Pick-Pack-Ship ครบวงจร\nพิมพ์ใบปะหน้าพัสดุ + LINE แจ้ง Tracking",
    desc: "ระบบจัดส่งสินค้าครบวงจร สแกนบาร์โค้ด พิมพ์ใบปะหน้าพัสดุ ติดตามสถานะ แจ้ง Tracking ผ่าน LINE อัตโนมัติ",
    color: "#03c9d7",
    icon: Truck,
    features: [
      "Pick-Pack-Ship ขั้นตอนจัดส่งครบ",
      "พิมพ์ใบปะหน้าพัสดุ (Parcel Label)",
      "ติดตามสถานะพัสดุ Real-time",
      "แจ้ง Tracking ผ่าน LINE อัตโนมัติ",
      "สแกนบาร์โค้ดจัดส่ง",
      "Auto-TIV on Ship ออกใบกำกับภาษีเมื่อจัดส่ง",
      "Fulfillment Batch จัดส่งเป็นชุด",
      "Packing Camera บันทึกการแพ็ค",
    ],
    screenshots: ["หน้าจัดส่งสินค้า", "LINE Tracking Notification"],
  },
  {
    id: "pos",
    badge: "POS ขายหน้าร้าน",
    title: "ระบบแคชเชียร์ครบ\nสแกนบาร์โค้ด + ตัดสต็อกอัตโนมัติ",
    desc: "POS ขายปลีกใช้งานง่าย สแกนบาร์โค้ด หลายช่องทางชำระเงิน ส่วนลด Hold/Park Cash Reconciliation Auto Journal Entry",
    color: "#fec90f",
    icon: Store,
    features: [
      "หน้าจอ POS ใช้ง่าย สัมผัสหน้าจอ",
      "สแกนบาร์โค้ด + ค้นหาสินค้าเร็ว",
      "หลายช่องทางชำระเงิน (เงินสด/QR/บัตร)",
      "ส่วนลดรายรายการ + รวมบิล",
      "Hold/Park พักบิลรอชำระ",
      "Cash Reconciliation ปิดยอดเงินสด",
      "Auto Journal Entry ลงบัญชีอัตโนมัติ",
      "Customer Search ค้นหาลูกค้า",
    ],
    screenshots: ["หน้าจอ POS", "รายงานยอดขาย POS"],
  },
  {
    id: "restaurant",
    badge: "POS ร้านอาหาร",
    title: "จัดการโต๊ะ ส่งครัว KDS\nแยกบิล + เซอร์วิสชาร์จ",
    desc: "ระบบ POS ร้านอาหารครบวงจร จัดโต๊ะ/โซน ส่งออเดอร์เข้าครัว KDS Modifier Groups แยกบิล เซอร์วิสชาร์จ สั่งอาหารผ่าน QR Code",
    color: "#f94d4d",
    icon: UtensilsCrossed,
    features: [
      "จัดการโต๊ะ/โซน + แผนผังร้าน",
      "ส่งออเดอร์เข้าครัว KDS อัตโนมัติ",
      "Modifier Groups (ระดับความเผ็ด, เพิ่มท็อปปิ้ง)",
      "แยกบิล Split Bill + รวมบิล",
      "เซอร์วิสชาร์จ + VAT",
      "เมนูหมวดหมู่ + รูปภาพ",
      "สั่งอาหารผ่าน QR Code",
      "รายงานยอดขายรายเมนู",
    ],
    screenshots: ["หน้าจอ POS ร้านอาหาร", "แผนผังโต๊ะ"],
  },
  {
    id: "hr",
    badge: "HR & เงินเดือน + ESS",
    title: "จัดการพนักงาน เงินเดือน\nสลิป ภงด. ESS Portal",
    desc: "ระบบ HR ครบวงจร ลงเวลา OT เงินเดือน สลิป ภงด.1 ภงด.1ก 50ทวิ ESS Portal พนักงานลา/ขอ OT ออนไลน์ สัญญาจ้างดิจิทัล",
    color: "#03c9d7",
    icon: Users,
    features: [
      "ลงเวลาเข้า-ออก + GPS",
      "คำนวณ OT อัตโนมัติ (1x, 1.5x, 2x, 3x)",
      "คำนวณเงินเดือน + สลิปเงินเดือน",
      "ภงด.1 / ภงด.1ก / 50ทวิ",
      "ESS Portal พนักงานดูข้อมูลตัวเอง",
      "ขอลา / ขอ OT ออนไลน์",
      "สัญญาจ้างดิจิทัล + เซ็นออนไลน์",
      "ตารางวันหยุดประจำปี",
    ],
    screenshots: ["หน้า HR Dashboard", "สลิปเงินเดือน"],
  },
  {
    id: "live-selling",
    badge: "Live Selling & AI Agency",
    title: "จัดการ Live ขายสินค้า\nจับ CF อัตโนมัติ + Lucky Draw",
    desc: "ระบบจัดการ Live ขายสินค้าครบวงจร จับ CF อัตโนมัติ Lucky Draw จับรางวัล AI Live Commerce Agency วิเคราะห์ Performance AIDA Framework",
    color: "#f94d4d",
    icon: Radio,
    features: [
      "จัดการ Live Session + สินค้าประจำ Live",
      "จับ CF อัตโนมัติจากคอมเมนต์",
      "Lucky Draw จับรางวัลสุ่ม",
      "AI Live Commerce Agency (AIDA Framework)",
      "วิเคราะห์ Performance แต่ละ Live",
      "AI Product Sequencing จัดลำดับสินค้า",
      "Ad Budget Optimization",
      "Post-Live Report สรุปผลหลัง Live",
    ],
    screenshots: ["หน้าจัดการ Live", "Lucky Draw"],
  },
  {
    id: "ai",
    badge: "AI & Automation",
    title: "AI อัจฉริยะช่วยทำงาน\nลดเวลาซ้ำๆ 80%",
    desc: "AI ตรวจสลิปโอนเงิน VAT Product Dictionary เรียนรู้จากนักบัญชี Demand Forecasting พยากรณ์สินค้า Chat Auto-Reply 5 ประเภท Trigger",
    color: "#05b187",
    icon: Bot,
    features: [
      "AI ตรวจสลิปโอนเงิน (Vision API)",
      "VAT Product Dictionary เรียนรู้จากนักบัญชี",
      "Demand Forecasting พยากรณ์ยอดขาย",
      "Chat Auto-Reply 5 ประเภท Trigger",
      "AI Restock Alert แจ้งเตือนสั่งซื้อ",
      "AI Live Agency วิเคราะห์ Performance",
      "Auto Journal Entry สูตรบัญชีอัตโนมัติ",
      "VAT Closing Warning ป้องกันลงผิดงวด",
    ],
    screenshots: ["AI ตรวจสลิป", "Demand Forecasting"],
  },
  {
    id: "chat",
    badge: "Unified Chat & Inbox",
    title: "รวมแชทจากทุกแพลตฟอร์ม\nChat Order + ตรวจสลิป AI",
    desc: "รวมแชทจาก Facebook, LINE, Instagram ไว้ที่เดียว จับ CF สั่งของอัตโนมัติ ตรวจสลิปด้วย AI Chat Auto-Reply Rules",
    color: "#03c9d7",
    icon: MessageSquare,
    features: [
      "รวมแชทจากทุกแพลตฟอร์ม",
      "Facebook Chat Orders จับ CF อัตโนมัติ",
      "AI ตรวจสลิป ยืนยันชำระเงิน",
      "Chat Auto-Reply 5 ประเภท Trigger",
      "Review Auto-Reply ตอบรีวิว",
      "ค้นหา Thread / ติด Tag",
      "แจ้งเตือนข้อความใหม่",
      "ประวัติสนทนาครบถ้วน",
    ],
    screenshots: ["Unified Chat Inbox", "Chat Order"],
  },
  {
    id: "firm",
    badge: "สำนักงานบัญชี",
    title: "จัดการลูกค้า 100+ บริษัท\nMulti-tenant + White Label",
    desc: "ระบบออกแบบมาเพื่อสำนักงานบัญชีโดยเฉพาะ Multi-tenant หลายบริษัท สัญญาจ้างออนไลน์ Work Board คลังเอกสาร FTP Archive White Label Branding",
    color: "#fb9678",
    icon: Shield,
    features: [
      "Multi-tenant สลับบริษัทลูกค้าทันที",
      "สัญญาจ้างออนไลน์ เซ็นดิจิทัล",
      "Work Board มอบหมายงานทีม",
      "คลังเอกสาร (Document Repository)",
      "FTP Archive สำรองเอกสารอัตโนมัติ",
      "White Label ปรับแบรนด์ของคุณเอง",
      "Activity Log ตรวจสอบทุกการเปลี่ยนแปลง",
      "Supplier Portal สั่งซื้อออนไลน์",
    ],
    screenshots: ["หน้าจัดการลูกค้า", "Work Board"],
  },
  {
    id: "analytics",
    badge: "Dashboard & Analytics",
    title: "วิเคราะห์ข้อมูลเชิงลึก\nรายงานครบทุกมิติ",
    desc: "Dashboard ยอดขาย กำไรต่อออเดอร์ AR/AP Aging GL Trial Balance งบกำไรขาดทุน งบดุล Cash Flow เปรียบเทียบข้ามปี",
    color: "#03c9d7",
    icon: TrendingUp,
    features: [
      "Dashboard ภาพรวมธุรกิจ Real-time",
      "วิเคราะห์ยอดขายข้ามแพลตฟอร์ม",
      "กำไรต่อออเดอร์ (Profit Per Order)",
      "AR/AP Aging Report อายุลูกหนี้/เจ้าหนี้",
      "General Ledger (GL) บัญชีแยกประเภท",
      "Trial Balance งบทดลอง",
      "งบกำไรขาดทุน เปรียบเทียบข้ามปี",
      "งบดุล & Cash Flow Statement",
    ],
    screenshots: ["Dashboard", "งบกำไรขาดทุน"],
  },
];

export default function FeaturesPage() {
  const [, navigate] = useLocation();
  useForceLightMode();

  return (
    <div className="min-h-screen bg-white force-light-mode" style={{ fontFamily: "'Sarabun', 'IBM Plex Sans Thai', sans-serif" }}>
      <PublicNavbar />

      <section className="pt-[70px]">
        <div className="bg-[#eefafb] py-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <AnimateOnScroll>
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">ALL FEATURES</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                100+ ฟีเจอร์ <span className="text-[#03c9d7]">ครบวงจร</span>
              </h1>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-8">
                ทุกเครื่องมือที่ธุรกิจต้องการ รวมอยู่ในแพลตฟอร์มเดียว — E-Commerce, บัญชี, HR, POS, คลังสินค้า, AI และอีกมากมาย
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button onClick={() => navigate("/register")} className="px-8 py-3.5 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg hover:bg-[#02b5c2] transition-all" data-testid="features-hero-cta">
                  ทดลองใช้ฟรี 15 วัน <ArrowRight className="w-5 h-5 inline ml-1" />
                </button>
                <button onClick={() => navigate("/pricing")} className="px-8 py-3.5 text-[15px] font-semibold text-[#03c9d7] bg-white border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7]/5 transition-all" data-testid="features-hero-pricing">
                  ดูแพ็คเกจ & ราคา
                </button>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <section className="py-12 bg-white border-b border-gray-100 sticky top-[70px] z-40 backdrop-blur-lg bg-white/95">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-2">
            {FEATURE_SECTIONS.map(s => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="px-3 py-1.5 text-xs font-semibold rounded-full border border-gray-200 text-gray-500 hover:text-white hover:border-transparent transition-all"
                style={{ ["--hover-bg" as any]: s.color }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = s.color; (e.target as HTMLElement).style.color = "white"; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = ""; (e.target as HTMLElement).style.color = ""; }}
                data-testid={`feature-nav-${s.id}`}
              >
                {s.badge}
              </a>
            ))}
          </div>
        </div>
      </section>

      {FEATURE_SECTIONS.map((section, idx) => {
        const isReversed = idx % 2 === 1;
        const Icon = section.icon;
        return (
          <section
            key={section.id}
            id={section.id}
            className={`py-20 ${idx % 2 === 0 ? "bg-white" : "bg-[#fafbfe]"}`}
          >
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
              <div className={`flex flex-col ${isReversed ? "lg:flex-row-reverse" : "lg:flex-row"} items-start gap-12 lg:gap-20`}>
                <AnimateOnScroll className="flex-1 w-full space-y-4">
                  <ScreenshotPlaceholder label={section.screenshots[0]} color={section.color} />
                  {section.screenshots[1] && (
                    <ScreenshotPlaceholder label={section.screenshots[1]} color={section.color} aspectRatio="16/7" />
                  )}
                </AnimateOnScroll>

                <AnimateOnScroll delay={0.15} className="flex-1">
                  <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5" style={{ backgroundColor: section.color }}>
                    <Icon className="w-3.5 h-3.5" />
                    {section.badge}
                  </span>
                  <h2 className="text-3xl sm:text-[36px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight whitespace-pre-line">
                    {section.title}
                  </h2>
                  <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">{section.desc}</p>

                  <div className="space-y-3">
                    {section.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0" style={{ backgroundColor: section.color + "15" }}>
                          <CheckCircle2 className="w-3.5 h-3.5" style={{ color: section.color }} />
                        </div>
                        <span className="text-sm text-gray-700">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 flex gap-3">
                    <button onClick={() => navigate("/register")} className="px-6 py-3 text-sm font-bold text-white rounded-xl shadow-md hover:shadow-lg transition-all" style={{ backgroundColor: section.color }} data-testid={`feature-cta-${section.id}`}>
                      เริ่มใช้งาน
                    </button>
                    <button onClick={() => navigate("/pricing")} className="px-6 py-3 text-sm font-bold rounded-xl border-2 hover:shadow-md transition-all" style={{ borderColor: section.color, color: section.color }} data-testid={`feature-pricing-${section.id}`}>
                      ดูราคา
                    </button>
                  </div>
                </AnimateOnScroll>
              </div>
            </div>
          </section>
        );
      })}

      <section className="py-20 bg-[#eefafb]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
            <p className="text-gray-500 text-[15px] mb-8">ทดลองใช้ฟรี 15 วัน ไม่ต้องใส่บัตรเครดิต ยกเลิกเมื่อไหร่ก็ได้</p>
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => navigate("/register")} className="px-10 py-4 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg hover:bg-[#02b5c2] transition-all" data-testid="features-bottom-cta">
                เริ่มต้นใช้งานฟรี <ArrowRight className="w-5 h-5 inline ml-1" />
              </button>
              <button onClick={() => navigate("/pricing")} className="px-10 py-4 text-[15px] font-semibold text-[#03c9d7] bg-white border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7]/5 transition-all">
                เปรียบเทียบแพ็คเกจ
              </button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
