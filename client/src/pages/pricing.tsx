import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useForceLightMode } from "@/hooks/use-force-light";
import PublicNavbar from "@/components/public-navbar";
import PublicFooter from "@/components/public-footer";
import {
  CheckCircle2, X, ArrowRight, Users, Building2, FileText, ShoppingCart,
  Store, UtensilsCrossed, Warehouse, Bot, Radio, MessageSquare,
  Calculator, Shield, Headphones, Zap, Image as ImageIcon
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

function ScreenshotPlaceholder({ label }: { label: string }) {
  return (
    <div className="bg-gray-100 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 py-12">
      <ImageIcon className="w-8 h-8 text-gray-300" />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}

type CellValue = boolean | string | number;

function FeatureCell({ value }: { value: CellValue }) {
  if (value === true) return <div className="w-6 h-6 rounded-full bg-[#05b187]/15 flex items-center justify-center mx-auto"><CheckCircle2 className="w-4 h-4 text-[#05b187]" /></div>;
  if (value === false) return <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center mx-auto"><X className="w-3.5 h-3.5 text-gray-300" /></div>;
  return <span className="text-xs text-gray-600 font-medium">{value}</span>;
}

const COMPARISON_CATEGORIES = [
  {
    title: "ข้อมูลทั่วไป",
    icon: Building2,
    rows: [
      { label: "ราคาต่อเดือน", values: ["ฟรี", "฿390", "฿590", "฿990", "฿1,490", "฿2,490", "฿4,990"] },
      { label: "ราคาต่อปี", values: ["ฟรี", "฿3,900", "฿5,900", "฿9,900", "฿14,900", "฿24,900", "฿49,900"] },
      { label: "ค่าติดตั้ง (Setup Fee)", values: ["ฟรี", "ฟรี", "฿1,500", "ฟรี", "฿5,000", "฿5,000", "฿10,000"] },
      { label: "จำนวนผู้ใช้", values: ["2", "3", "5", "10", "20", "20", "ไม่จำกัด"] },
      { label: "จำนวนบริษัท", values: ["1", "1", "3", "3", "20", "100", "ไม่จำกัด"] },
      { label: "เอกสาร/เดือน", values: ["50", "500", "2,000", "1,000", "2,000", "10,000", "ไม่จำกัด"] },
      { label: "สินค้าสูงสุด", values: ["100", "500", "5,000", "500", "1,000", "5,000", "ไม่จำกัด"] },
      { label: "ทดลองใช้ฟรี", values: ["15 วัน", "15 วัน", "15 วัน", "15 วัน", "15 วัน", "15 วัน", "15 วัน"] },
    ],
  },
  {
    title: "เอกสาร & ใบกำกับภาษี",
    icon: FileText,
    rows: [
      { label: "ใบเสนอราคา / ใบสั่งขาย", values: [true, true, true, true, true, true, true] },
      { label: "ใบแจ้งหนี้ / ใบกำกับภาษี / ใบเสร็จ", values: [true, true, true, true, true, true, true] },
      { label: "ใบลดหนี้ / ใบเพิ่มหนี้", values: [true, true, true, true, true, true, true] },
      { label: "ใบวางบิล / ใบสำคัญจ่าย", values: [true, true, true, true, true, true, true] },
      { label: "e-Tax Invoice", values: [false, true, true, true, true, true, true] },
      { label: "พิมพ์เอกสาร 4 รูปแบบ", values: [true, true, true, true, true, true, true] },
      { label: "รองรับ 12 สกุลเงิน", values: [false, true, true, true, true, true, true] },
      { label: "Auto-generate เลขเอกสาร Prefix", values: [true, true, true, true, true, true, true] },
    ],
  },
  {
    title: "บัญชี & ภาษี",
    icon: Calculator,
    rows: [
      { label: "ผังบัญชี TFRS (3 หลัก / 7 หลัก)", values: [true, false, false, true, true, true, true] },
      { label: "สมุดรายวัน 5 เล่ม", values: [true, false, false, true, true, true, true] },
      { label: "Auto Journal Entry", values: [false, false, false, true, true, true, true] },
      { label: "ภาษีหัก ณ ที่จ่าย อัตโนมัติ", values: [false, false, false, true, true, true, true] },
      { label: "งบทดลอง / งบกำไรขาดทุน / งบดุล", values: ["พื้นฐาน", false, false, true, true, true, true] },
      { label: "Cash Flow Statement", values: [false, false, false, true, true, true, true] },
      { label: "ภ.พ.30 VAT Summary Report", values: [false, false, false, true, true, true, true] },
      { label: "Bank Reconciliation", values: [false, false, false, true, true, true, true] },
      { label: "เครื่องมือจัดการบัญชี 10 รายการ", values: [false, false, false, true, true, true, true] },
      { label: "VAT Closing Warning", values: [false, false, false, true, true, true, true] },
    ],
  },
  {
    title: "E-Commerce Hub",
    icon: ShoppingCart,
    rows: [
      { label: "เชื่อมต่อ Shopee / Lazada / TikTok Shop", values: [false, true, true, false, false, true, true] },
      { label: "ดึงออเดอร์อัตโนมัติ", values: [false, true, true, false, false, true, true] },
      { label: "Real-time Stock Sync", values: [false, true, true, false, false, true, true] },
      { label: "Store Clone ข้ามแพลตฟอร์ม", values: [false, false, true, false, false, true, true] },
      { label: "Settlement & Wallet Tracking", values: [false, false, true, false, false, true, true] },
      { label: "Auto-TIV on Ship", values: [false, true, true, false, false, true, true] },
      { label: "Excel/CSV Import ออเดอร์", values: [false, true, true, true, true, true, true] },
      { label: "Bulk Operations จัดการหลายรายการ", values: [false, true, true, false, false, true, true] },
    ],
  },
  {
    title: "คลังสินค้า & จัดส่ง",
    icon: Warehouse,
    rows: [
      { label: "หลายคลัง", values: [false, false, true, false, false, true, true] },
      { label: "Bin Location (Zone/Aisle/Shelf)", values: [false, false, "Add-on", false, false, true, true] },
      { label: "Wave/Batch Picking", values: [false, false, "Add-on", false, false, true, true] },
      { label: "PDA Mobile Interface", values: [false, false, "Add-on", false, false, true, true] },
      { label: "Pick-Pack-Ship Delivery Hub", values: [false, false, true, false, false, true, true] },
      { label: "พิมพ์ใบปะหน้าพัสดุ", values: [false, false, true, false, false, true, true] },
      { label: "LINE Tracking แจ้งเตือน", values: [false, false, true, false, false, true, true] },
      { label: "Barcode Auto-Gen EAN-13", values: [false, true, true, true, true, true, true] },
    ],
  },
  {
    title: "POS ขายหน้าร้าน & ร้านอาหาร",
    icon: Store,
    rows: [
      { label: "POS ขายปลีก", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "สแกนบาร์โค้ด", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "หลายช่องทางชำระเงิน", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "Cash Reconciliation", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "POS ร้านอาหาร + KDS", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "จัดการโต๊ะ/โซน", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "Modifier Groups", values: [false, false, false, "Add-on", "Add-on", true, true] },
      { label: "สั่งอาหาร QR Code", values: [false, false, false, "Add-on", "Add-on", true, true] },
    ],
  },
  {
    title: "HR & เงินเดือน",
    icon: Users,
    rows: [
      { label: "ลงเวลาเข้า-ออก + OT", values: [false, false, false, "Add-on", true, true, true] },
      { label: "คำนวณเงินเดือน + สลิป", values: [false, false, false, "Add-on", true, true, true] },
      { label: "ภงด.1 / ภงด.1ก / 50ทวิ", values: [false, false, false, "Add-on", true, true, true] },
      { label: "ESS Portal พนักงาน", values: [false, false, false, "Add-on", true, true, true] },
      { label: "ขอลา / ขอ OT ออนไลน์", values: [false, false, false, "Add-on", true, true, true] },
      { label: "สัญญาจ้างดิจิทัล", values: [false, false, false, false, true, true, true] },
    ],
  },
  {
    title: "Live Selling & AI",
    icon: Radio,
    rows: [
      { label: "Live Selling + จับ CF อัตโนมัติ", values: [false, false, true, false, false, true, true] },
      { label: "Lucky Draw จับรางวัล", values: [false, false, true, false, false, true, true] },
      { label: "AI Live Commerce Agency", values: [false, false, true, false, false, true, true] },
      { label: "AI ตรวจสลิป (Vision API)", values: [false, false, true, false, true, true, true] },
      { label: "VAT Product Dictionary", values: [false, false, true, false, true, true, true] },
      { label: "Demand Forecasting", values: [false, false, true, false, true, true, true] },
      { label: "Chat Auto-Reply", values: [false, false, true, false, true, true, true] },
      { label: "Unified Chat Inbox", values: [false, false, "Add-on", false, "Add-on", true, true] },
    ],
  },
  {
    title: "สำนักงานบัญชี",
    icon: Shield,
    rows: [
      { label: "Multi-tenant หลายบริษัท", values: [false, false, false, false, true, true, true] },
      { label: "สัญญาจ้างออนไลน์", values: [false, false, false, false, true, true, true] },
      { label: "Work Board มอบหมายงาน", values: [false, false, false, false, true, true, true] },
      { label: "คลังเอกสาร (Document Repository)", values: [false, false, false, false, true, true, true] },
      { label: "FTP Archive สำรองอัตโนมัติ", values: [false, false, false, false, true, true, true] },
      { label: "White Label Branding", values: [false, false, false, false, false, "Add-on", true] },
      { label: "Activity Log", values: [true, true, true, true, true, true, true] },
      { label: "Supplier Portal", values: [false, false, false, false, true, true, true] },
    ],
  },
  {
    title: "การเชื่อมต่อ & Support",
    icon: Headphones,
    rows: [
      { label: "API เชื่อมต่อภายนอก", values: [false, false, true, false, true, true, true] },
      { label: "LINE Messaging API", values: [false, false, true, false, false, true, true] },
      { label: "Webhook", values: [false, false, true, false, true, true, true] },
      { label: "Priority Support", values: [false, false, false, false, false, false, true] },
      { label: "อบรมการใช้งาน", values: ["ออนไลน์", "ออนไลน์", "ออนไลน์", "ออนไลน์", "ออนไลน์", "ออนไลน์ + ออนไซต์", "ออนไลน์ + ออนไซต์"] },
      { label: "Dark Mode", values: [true, true, true, true, true, true, true] },
    ],
  },
];

const PLAN_HEADERS = [
  { name: "Starter", group: "ธุรกิจทั่วไป", color: "#05b187" },
  { name: "eTax Lite", group: "ร้านค้าออนไลน์", color: "#fb9678" },
  { name: "E-Commerce Hub", group: "ร้านค้าออนไลน์", color: "#fb9678" },
  { name: "Business Pro", group: "ธุรกิจทั่วไป", color: "#03c9d7" },
  { name: "Firm Starter", group: "สำนักงานบัญชี", color: "#03c9d7" },
  { name: "Firm Pro", group: "สำนักงานบัญชี", color: "#03c9d7" },
  { name: "Firm Enterprise", group: "สำนักงานบัญชี", color: "#fec90f" },
];

export default function PricingPage() {
  const [, navigate] = useLocation();
  useForceLightMode();

  return (
    <div className="min-h-screen bg-white force-light-mode" style={{ fontFamily: "'Sarabun', 'IBM Plex Sans Thai', sans-serif" }}>
      <PublicNavbar />

      <section className="pt-[70px]">
        <div className="bg-[#eefafb] py-20">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <AnimateOnScroll>
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">PRICING & PLANS</p>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-6 tracking-tight">
                แพ็คเกจ & ราคา <span className="text-[#03c9d7]">โปร่งใส</span>
              </h1>
              <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed mb-4">
                เริ่มต้นฟรี ไม่มีค่าใช้จ่ายแอบแฝง เลือกแพ็คเกจที่เหมาะกับธุรกิจของคุณ อัปเกรดหรือยกเลิกเมื่อไหร่ก็ได้
              </p>
              <p className="text-sm text-[#fb9678] font-semibold">ทุกแพ็คเกจทดลองใช้ฟรี 15 วัน ไม่ต้องใส่บัตรเครดิต</p>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">ตารางเปรียบเทียบฟีเจอร์ทั้งหมด</h2>
              <p className="text-sm text-gray-400">เลื่อนซ้าย-ขวาเพื่อดูแพ็คเกจเพิ่มเติม</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow-lg">
              <table className="w-full min-w-[1000px]" data-testid="pricing-comparison-table">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-4 text-sm font-bold text-gray-500 min-w-[220px] sticky left-0 bg-gray-50 z-10 border-r border-gray-100">ฟีเจอร์</th>
                    {PLAN_HEADERS.map((plan, i) => (
                      <th key={i} className="p-4 text-center min-w-[120px]" data-testid={`plan-header-${i}`}>
                        <div className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: plan.color }}>{plan.group}</div>
                        <div className="text-sm font-bold text-gray-900">{plan.name}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_CATEGORIES.map((cat, ci) => {
                    const Icon = cat.icon;
                    return (
                      <React.Fragment key={`cat-${ci}`}>
                        <tr className="bg-gray-50/70">
                          <td colSpan={PLAN_HEADERS.length + 1} className="p-3">
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-[#03c9d7]" />
                              <span className="text-sm font-bold text-gray-700">{cat.title}</span>
                            </div>
                          </td>
                        </tr>
                        {cat.rows.map((row, ri) => (
                          <tr key={`${ci}-${ri}`} className={`${ri % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-[#03c9d7]/5 transition-colors`}>
                            <td className="p-3 text-sm text-gray-700 font-medium sticky left-0 bg-inherit z-10 border-r border-gray-50">{row.label}</td>
                            {row.values.map((val, vi) => (
                              <td key={vi} className="p-3 text-center">
                                <FeatureCell value={val} />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-[#03c9d7]/5 border-t-2 border-[#03c9d7]/20">
                    <td className="p-4 sticky left-0 bg-[#03c9d7]/5 z-10 border-r border-[#03c9d7]/10"></td>
                    {PLAN_HEADERS.map((_, i) => (
                      <td key={i} className="p-4 text-center">
                        <button
                          onClick={() => navigate("/register")}
                          className="px-4 py-2 text-xs font-bold text-white rounded-lg transition-all hover:shadow-md bg-[#03c9d7]"
                          data-testid={`pricing-table-cta-${i}`}
                        >
                          เริ่มทดลองใช้
                        </button>
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <section className="py-16 bg-[#fafbfe]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">โมดูลเสริม (Add-on)</h2>
              <p className="text-sm text-gray-400">เพิ่มความสามารถตามที่ต้องการ ใช้ร่วมกับแพ็คเกจใดก็ได้</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { name: "White Label", price: "490", icon: Shield, color: "#fb9678", desc: "ปรับแต่งระบบเป็นแบรนด์ของคุณ โลโก้ สี โดเมน" },
              { name: "POS ขายหน้าร้าน", price: "390", icon: Store, color: "#fec90f", desc: "ระบบแคชเชียร์ สแกนบาร์โค้ด ตัดสต็อก Cash Reconciliation" },
              { name: "POS ร้านอาหาร", price: "490", icon: UtensilsCrossed, color: "#f94d4d", desc: "จัดการโต๊ะ/โซน ส่งครัว KDS Modifier Groups แยกบิล" },
              { name: "HR & เงินเดือน", price: "390", icon: Users, color: "#03c9d7", desc: "ลงเวลา OT เงินเดือน สลิป ภงด. ESS Portal สัญญาจ้าง" },
              { name: "WMS คลังสินค้า", price: "390", icon: Warehouse, color: "#fb9678", desc: "Bin Location Wave Picking PDA Interface Stock Sync" },
              { name: "Live Selling", price: "390", icon: Radio, color: "#f94d4d", desc: "จัดการ Live ขาย จับ CF Lucky Draw AI Agency" },
              { name: "AI อัจฉริยะ", price: "290", icon: Bot, color: "#05b187", desc: "AI ตรวจสลิป Demand Forecasting VAT Dictionary" },
              { name: "Unified Chat", price: "290", icon: MessageSquare, color: "#03c9d7", desc: "รวมแชท Facebook Chat Orders AI อ่าน CF ตรวจสลิป" },
              { name: "API เชื่อมต่อ", price: "190", icon: Zap, color: "#fec90f", desc: "REST API เชื่อมต่อระบบภายนอก Webhook" },
            ].map((addon, i) => {
              const Icon = addon.icon;
              return (
                <AnimateOnScroll key={i} delay={i * 0.05}>
                  <div className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all" data-testid={`addon-card-${i}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: addon.color + "15" }}>
                        <Icon className="w-5 h-5" style={{ color: addon.color }} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">{addon.name}</div>
                        <div className="text-xs font-bold" style={{ color: addon.color }}>+฿{addon.price}/เดือน</div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{addon.desc}</p>
                  </div>
                </AnimateOnScroll>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">บริการเสริม</h2>
              <p className="text-sm text-gray-400">บริการติดตั้ง อบรม และปรับแต่งระบบ</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
            <div className="overflow-x-auto rounded-2xl border border-gray-200 shadow">
              <table className="w-full" data-testid="services-table">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-4 text-sm font-bold text-gray-500">บริการ</th>
                    <th className="p-4 text-sm font-bold text-gray-500 text-center">ราคา</th>
                    <th className="p-4 text-sm font-bold text-gray-500 text-center">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { service: "ตั้งค่าระบบเริ่มต้น (Implementation)", price: "ฟรี - ฿15,000", note: "ขึ้นอยู่กับจำนวนบริษัท/ผังบัญชี" },
                    { service: "อบรมการใช้งาน Online", price: "ฟรี", note: "ทุกแพ็คเกจ" },
                    { service: "อบรมการใช้งาน Onsite", price: "฿5,000/ครั้ง", note: "Firm Pro ขึ้นไป" },
                    { service: "นำเข้าข้อมูลเดิม (Data Migration)", price: "฿3,000 - ฿10,000", note: "ขึ้นอยู่กับปริมาณข้อมูล" },
                    { service: "ปรับแต่งระบบ (Customization)", price: "฿3,000/Man-Day", note: "ทุกแพ็คเกจ" },
                    { service: "เชื่อมต่อ API ภายนอก", price: "฿5,000 - ฿30,000", note: "ขึ้นอยู่กับ Scope" },
                  ].map((row, i) => (
                    <tr key={i} className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"} border-b border-gray-50`}>
                      <td className="p-4 text-sm text-gray-700 font-medium">{row.service}</td>
                      <td className="p-4 text-sm text-center font-bold" style={{ color: "#03c9d7" }}>{row.price}</td>
                      <td className="p-4 text-xs text-gray-400 text-center">{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <section className="py-16 bg-[#fafbfe]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 mb-3">คำถามที่พบบ่อยเกี่ยวกับราคา</h2>
            </div>
          </AnimateOnScroll>

          <div className="space-y-4">
            {[
              { q: "ทดลองใช้ฟรีได้กี่วัน?", a: "ทุกแพ็คเกจทดลองใช้ฟรี 15 วัน ไม่ต้องใส่บัตรเครดิต ใช้งานได้ทุกฟีเจอร์ตามแพ็คเกจที่เลือก" },
              { q: "เปลี่ยนแพ็คเกจกลางทางได้ไหม?", a: "ได้เลย สามารถอัปเกรดหรือดาวน์เกรดแพ็คเกจได้ทุกเมื่อ ระบบจะคำนวณส่วนต่างให้อัตโนมัติ" },
              { q: "ยกเลิกได้ไหม?", a: "ยกเลิกได้ทุกเมื่อ ไม่มีสัญญาผูกมัดระยะยาว ข้อมูลของคุณจะเก็บไว้ 30 วันหลังยกเลิก" },
              { q: "ราคารายปีประหยัดกว่าเท่าไหร่?", a: "สมัครรายปีประหยัดได้ถึง 17% เมื่อเทียบกับรายเดือน ชำระครั้งเดียวสะดวกกว่า" },
              { q: "ซื้อโมดูลเสริมแยกได้ไหม?", a: "ได้เลย ซื้อเฉพาะโมดูลที่ต้องการ ใช้ร่วมกับแพ็คเกจใดก็ได้ เพิ่มหรือยกเลิกเมื่อไหร่ก็ได้" },
              { q: "รับชำระเงินอย่างไร?", a: "รองรับการชำระผ่าน PromptPay QR Code โอนผ่านธนาคาร ไม่ต้องมีบัตรเครดิต" },
            ].map((faq, i) => (
              <AnimateOnScroll key={i} delay={i * 0.05}>
                <details className="bg-white rounded-xl border border-gray-100 group" data-testid={`pricing-faq-${i}`}>
                  <summary className="px-6 py-4 cursor-pointer text-sm font-semibold text-gray-800 hover:text-[#03c9d7] transition-colors list-none flex items-center justify-between">
                    {faq.q}
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▼</span>
                  </summary>
                  <div className="px-6 pb-4 text-sm text-gray-500 leading-relaxed">{faq.a}</div>
                </details>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 bg-[#eefafb]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">พร้อมเริ่มต้นแล้วหรือยัง?</h2>
            <p className="text-gray-500 text-[15px] mb-8">ทดลองใช้ฟรี 15 วัน ไม่ต้องใส่บัตรเครดิต</p>
            <div className="flex flex-wrap justify-center gap-4">
              <button onClick={() => navigate("/register")} className="px-10 py-4 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg hover:bg-[#02b5c2] transition-all" data-testid="pricing-bottom-cta">
                เริ่มต้นใช้งานฟรี <ArrowRight className="w-5 h-5 inline ml-1" />
              </button>
              <button onClick={() => navigate("/contact")} className="px-10 py-4 text-[15px] font-semibold text-[#03c9d7] bg-white border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7]/5 transition-all">
                ติดต่อฝ่ายขาย
              </button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
