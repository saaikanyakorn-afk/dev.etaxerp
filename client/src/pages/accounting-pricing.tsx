import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import logoWhite from "@assets/Logo_Etax_W_1771262337378.png";
import dashboardPreview from "@assets/image_1771312538323.png";
import {
  CheckCircle2, ArrowRight, ChevronDown, ChevronUp,
  Menu, X, Zap, Globe, FileText, BarChart3,
  RefreshCw, Shield, Clock, Users, Headphones,
  Calculator, BookOpen, Receipt, TrendingUp, Landmark,
  Brain, ScanLine, CreditCard, PieChart, Scale,
  Banknote, ClipboardCheck, Sparkles, Building2, FileBadge, Phone
} from "lucide-react";

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
  const transforms: Record<string, string> = { up: "translateY(40px)", left: "translateX(-40px)", right: "translateX(40px)", fade: "translateY(0px)" };
  return (
    <div ref={ref} className={className} style={{ opacity: visible ? 1 : 0, transform: visible ? "translate(0,0)" : transforms[direction], transition: `opacity 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}s` }}>
      {children}
    </div>
  );
}

function ScrollToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed left-4 bottom-4 z-50 w-11 h-11 flex items-center justify-center bg-[#03c9d7] text-white rounded-full shadow-lg hover:scale-110 hover:shadow-xl transition-all opacity-90 hover:opacity-100"
      data-testid="btn-scroll-to-top"
    >
      <ChevronUp className="w-5 h-5" />
    </button>
  );
}

const ACCOUNTING_PLANS = [
  {
    name: "Starter",
    price: "ฟรี",
    period: "",
    desc: "ทดลองใช้ระบบบัญชีเบื้องต้น",
    color: "#05b187",
    popular: false,
    cta: "เริ่มใช้ฟรี",
    limits: "จำกัด 100 รายการ/เดือน",
    features: [
      "บันทึกบัญชี รับ-จ่าย",
      "ผังบัญชีมาตรฐาน",
      "ใบกำกับภาษี 50 ใบ/เดือน",
      "รายงานงบทดลอง",
      "ผู้ใช้ 1 คน",
    ],
  },
  {
    name: "Standard",
    price: "490",
    period: "บาท/เดือน",
    desc: "สำหรับธุรกิจขนาดเล็ก",
    color: "#fb9678",
    popular: false,
    cta: "เริ่มทดลองใช้",
    limits: "สูงสุด 500 รายการ/เดือน",
    features: [
      "เอกสารซื้อ-ขายครบวงจร",
      "e-Tax Invoice & e-Receipt",
      "Auto Journal Entry",
      "รายงานภาษี ภ.พ.30",
      "รายงานงบการเงิน",
      "Excel Export",
      "ผู้ใช้ 3 คน",
    ],
  },
  {
    name: "Professional",
    price: "790",
    period: "บาท/เดือน",
    desc: "ระบบบัญชีครบทุกฟีเจอร์",
    color: "#03c9d7",
    popular: true,
    cta: "เริ่มทดลองใช้",
    limits: "ไม่จำกัดรายการ",
    features: [
      "ทุกฟีเจอร์ Standard",
      "AI ตรวจสลิปโอนเงิน",
      "Bank Reconciliation",
      "AR/AP Aging Report",
      "หนังสือรับรองหัก ณ ที่จ่าย",
      "รายงานภาษีซื้อ-ขาย",
      "ผังบัญชีปรับแต่งได้",
      "สินทรัพย์ถาวร & ค่าเสื่อม",
      "ผู้ใช้ 5 คน",
    ],
  },
  {
    name: "Enterprise",
    price: "1,290",
    period: "บาท/เดือน",
    desc: "สำนักงานบัญชี & ธุรกิจขนาดใหญ่",
    color: "#fec90f",
    popular: false,
    cta: "ติดต่อฝ่ายขาย",
    limits: "ไม่จำกัดทุกอย่าง",
    features: [
      "ทุกฟีเจอร์ Professional",
      "Multi-Tenant สำนักงานบัญชี",
      "จัดการลูกค้าสำนักงาน",
      "สัญญาจ้างออนไลน์",
      "สูตรบัญชีตามประเภทธุรกิจ",
      "Activity Log ตรวจสอบย้อนหลัง",
      "Dedicated Support",
      "ผู้ใช้ไม่จำกัด",
    ],
  },
];

const FEATURE_CATEGORIES = [
  {
    title: "เอกสารซื้อ-ขาย",
    icon: FileText,
    color: "#03c9d7",
    items: ["ใบเสนอราคา (QO)", "ใบแจ้งหนี้ (IV)", "ใบกำกับภาษี (TIV)", "ใบเสร็จรับเงิน (RE)", "ใบสั่งซื้อ (PO)", "บันทึกค่าใช้จ่าย"],
  },
  {
    title: "บันทึกบัญชี",
    icon: BookOpen,
    color: "#fb9678",
    items: ["สมุดรายวันทั่วไป", "Auto Journal Entry", "สมุดบัญชี 5 เล่ม", "ผังบัญชีปรับแต่งได้", "สูตรบัญชีอัตโนมัติ"],
  },
  {
    title: "รายงานภาษี",
    icon: Landmark,
    color: "#05b187",
    items: ["รายงานภาษีขาย", "รายงานภาษีซื้อ", "ภ.พ.30 สรุป VAT", "หนังสือรับรองหัก ณ ที่จ่าย", "ใบแนบภาษี"],
  },
  {
    title: "รายงานการเงิน",
    icon: PieChart,
    color: "#fec90f",
    items: ["งบทดลอง", "งบกำไรขาดทุน", "งบดุล", "บัญชีแยกประเภท", "AR/AP Aging Report"],
  },
  {
    title: "AI & ระบบอัจฉริยะ",
    icon: Brain,
    color: "#f94d4d",
    items: ["AI ตรวจสลิปโอนเงิน", "จับคู่ธุรกรรมอัตโนมัติ", "Bank Reconciliation", "นำเข้าเอกสาร PDF", "สแกนบาร์โค้ด"],
  },
  {
    title: "สำนักงานบัญชี",
    icon: Building2,
    color: "#7B2D8E",
    items: ["Multi-Tenant จัดการลูกค้า", "สัญญาจ้างออนไลน์", "Company Switcher", "สิทธิ์ผู้ใช้งานระดับโมดูล", "Activity Log"],
  },
];

const COMPARISON_ROWS = [
  { feature: "รายการบัญชีต่อเดือน", starter: "100", standard: "500", pro: "ไม่จำกัด", enterprise: "ไม่จำกัด" },
  { feature: "ผู้ใช้งาน", starter: "1", standard: "3", pro: "5", enterprise: "ไม่จำกัด" },
  { feature: "เอกสารซื้อ-ขาย", starter: true, standard: true, pro: true, enterprise: true },
  { feature: "e-Tax Invoice", starter: "50 ใบ/เดือน", standard: true, pro: true, enterprise: true },
  { feature: "ผังบัญชีมาตรฐาน", starter: true, standard: true, pro: true, enterprise: true },
  { feature: "ผังบัญชีปรับแต่ง", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "Auto Journal Entry", starter: false, standard: true, pro: true, enterprise: true },
  { feature: "รายงานงบทดลอง", starter: true, standard: true, pro: true, enterprise: true },
  { feature: "งบกำไรขาดทุน / งบดุล", starter: false, standard: true, pro: true, enterprise: true },
  { feature: "รายงานภาษี ภ.พ.30", starter: false, standard: true, pro: true, enterprise: true },
  { feature: "รายงานภาษีซื้อ-ขาย", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "หนังสือรับรองหัก ณ ที่จ่าย", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "AI ตรวจสลิปโอนเงิน", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "Bank Reconciliation", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "AR/AP Aging Report", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "สินทรัพย์ถาวร & ค่าเสื่อม", starter: false, standard: false, pro: true, enterprise: true },
  { feature: "Multi-Tenant สำนักงาน", starter: false, standard: false, pro: false, enterprise: true },
  { feature: "สัญญาจ้างออนไลน์", starter: false, standard: false, pro: false, enterprise: true },
  { feature: "Activity Log", starter: false, standard: false, pro: false, enterprise: true },
  { feature: "Excel Export", starter: false, standard: true, pro: true, enterprise: true },
];

const FAQ_ITEMS = [
  { q: "ทดลองใช้ฟรีกี่วัน?", a: "แพ็คเกจ Starter ใช้ฟรีไม่มีกำหนด จำกัด 100 รายการ/เดือน เหมาะสำหรับธุรกิจเริ่มต้น แพ็คเกจอื่นทดลองใช้ฟรี 14 วัน" },
  { q: "รองรับมาตรฐานบัญชีไทยไหม?", a: "รองรับครบ ทั้งผังบัญชีมาตรฐาน สมุดบัญชี 5 เล่ม ใบกำกับภาษีตามรูปแบบกรมสรรพากร รายงาน ภ.พ.30 และเอกสารภาษีทุกรูปแบบ" },
  { q: "ใช้ร่วมกับ E-Commerce Hub ได้ไหม?", a: "ได้ สามารถเพิ่ม E-Commerce Hub เป็น Add-on ได้ทุกแพ็คเกจ ระบบจะเชื่อมต่อข้อมูลอัตโนมัติ เช่น ออเดอร์จะสร้างใบกำกับภาษีและบันทึกบัญชีให้ทันที" },
  { q: "เปลี่ยนแพ็คเกจระหว่างใช้งานได้ไหม?", a: "ได้ สามารถอัปเกรดหรือดาวน์เกรดได้ทุกเมื่อ ค่าใช้จ่ายจะคำนวณตามสัดส่วนวันที่เหลือ" },
  { q: "เหมาะกับสำนักงานบัญชีไหม?", a: "แพ็คเกจ Enterprise ออกแบบมาสำหรับสำนักงานบัญชีโดยเฉพาะ รองรับ Multi-Tenant จัดการลูกค้าหลายบริษัท สลับบริษัทได้ง่าย พร้อมสัญญาจ้างออนไลน์" },
];

function FAQItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl overflow-hidden transition-all ${open ? "bg-white shadow-md" : "bg-white/60 hover:bg-white"}`}>
      <button className="w-full text-left px-6 py-5 flex items-center justify-between gap-4" onClick={() => setOpen(!open)} data-testid={`acc-faq-toggle-${index}`}>
        <span className="font-semibold text-gray-800 text-[15px]">{item.q}</span>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${open ? "bg-[#03c9d7] text-white" : "bg-gray-100 text-gray-500"}`}>
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      {open && <div className="px-6 pb-5 text-gray-500 leading-relaxed text-sm">{item.a}</div>}
    </div>
  );
}

function CellValue({ val }: { val: boolean | string }) {
  if (val === true) return <CheckCircle2 className="w-5 h-5 text-[#05b187] mx-auto" />;
  if (val === false) return <span className="text-gray-300">—</span>;
  return <span className="text-sm text-gray-700 font-medium">{val}</span>;
}

export default function AccountingPricing() {
  const [, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white font-[Sarabun] force-light-mode">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/landing")}>
            <div className="h-11 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
              <img src={logoWhite} alt="E-Tax Center" className="h-6 object-contain" />
            </div>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#highlights" className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">จุดเด่น</a>
            <a href="#plans" className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">แพ็คเกจ</a>
            <a href="#features" className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">ฟีเจอร์</a>
            <a href="#compare" className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">เปรียบเทียบ</a>
            <a href="#faq" className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">FAQ</a>
            <button onClick={() => navigate("/landing")} className="text-sm text-gray-600 hover:text-[#03c9d7] transition-colors">แพ็คเกจทั้งหมด</button>
            <button onClick={() => navigate("/register")} className="px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-[#03c9d7] hover:bg-[#02b5c2] transition-all shadow-sm hover:shadow-md" data-testid="btn-acc-register">
              ทดลองใช้ฟรี
            </button>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)} data-testid="btn-acc-mobile-menu">
            {mobileMenu ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {mobileMenu && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-3">
            <a href="#highlights" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenu(false)}>จุดเด่น</a>
            <a href="#plans" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenu(false)}>แพ็คเกจ</a>
            <a href="#features" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenu(false)}>ฟีเจอร์</a>
            <a href="#compare" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenu(false)}>เปรียบเทียบ</a>
            <a href="#faq" className="block text-sm text-gray-600 py-2" onClick={() => setMobileMenu(false)}>FAQ</a>
            <button onClick={() => navigate("/landing")} className="block text-sm text-gray-600 py-2 w-full text-left">แพ็คเกจทั้งหมด</button>
            <button onClick={() => navigate("/register")} className="w-full py-3 text-sm font-bold text-white rounded-xl bg-[#03c9d7]">ทดลองใช้ฟรี</button>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#f0fcfd] py-16 sm:py-24">
        <div className="absolute top-10 right-10 w-72 h-72 bg-[#03c9d7]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-60 h-60 bg-[#fb9678]/5 rounded-full blur-3xl" />
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#03c9d7]/10 text-[#03c9d7] px-4 py-2 rounded-full text-sm font-bold mb-6">
                <Calculator className="w-4 h-4" />
                โปรแกรมบัญชีออนไลน์
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-snug sm:leading-snug lg:leading-snug mb-6">
                ระบบบัญชี<br />
                <span className="text-[#03c9d7]">อัจฉริยะ</span> ครบจบ<br />
                ในแพลตฟอร์มเดียว
              </h1>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                โปรแกรมบัญชีออนไลน์ที่รองรับ e-Tax Invoice บันทึกบัญชีอัตโนมัติ AI ช่วยตรวจสลิปโอนเงิน พร้อมรายงานภาษีครบทุกแบบ ออกแบบมาสำหรับธุรกิจไทยและสำนักงานบัญชี
              </p>

              <div className="flex flex-wrap gap-2 mb-8">
                {["e-Tax Invoice", "Auto Journal", "AI Slip Check", "ภ.พ.30", "Bank Recon"].map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 shadow-sm">
                    <CheckCircle2 className="w-3 h-3 text-[#03c9d7]" />
                    {tag}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate("/register")}
                  className="px-8 py-4 text-[15px] font-bold text-white rounded-xl bg-[#03c9d7] hover:bg-[#02b5c2] shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  data-testid="btn-hero-acc-register"
                >
                  เริ่มใช้ฟรี — ไม่ต้องผูกบัตร <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#compare"
                  className="px-8 py-4 text-[15px] font-bold text-[#03c9d7] rounded-xl border-2 border-[#03c9d7] hover:bg-[#03c9d7]/5 transition-all text-center"
                  data-testid="link-acc-compare"
                >
                  เปรียบเทียบแพ็คเกจ
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
                <img src={dashboardPreview} alt="แดชบอร์ดระบบบัญชี E-Tax Center" className="w-full h-auto object-cover" />
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#fb9678]/10 flex items-center justify-center">
                    <FileBadge className="w-4 h-4 text-[#fb9678]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">ใบกำกับภาษีเดือนนี้</div>
                    <div className="text-sm font-bold text-gray-900">128 ใบ</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Benefits */}
      <section id="highlights" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">ทำไมต้องโปรแกรมบัญชี E-TAX CENTER</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-tight">บัญชีจะ <span className="text-[#03c9d7]">ง่ายขึ้น</span> เมื่อใช้ระบบของเรา</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">ไม่ต้องคีย์ข้อมูลซ้ำ ไม่ต้องกลัวบันทึกผิด ไม่ต้องจำว่าต้องส่งรายงานอะไรบ้าง</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Sparkles, title: "Auto Journal Entry", desc: "อนุมัติเอกสารปุ๊บ ระบบบันทึกบัญชีให้อัตโนมัติ ไม่ต้องคีย์เอง ลดข้อผิดพลาด", color: "#03c9d7" },
              { icon: Brain, title: "AI ตรวจสลิป", desc: "ส่งรูปสลิปโอนเงิน AI อ่านข้อมูลจับคู่ธุรกรรมให้ทันที ประหยัดเวลาตรวจสอบ", color: "#fb9678" },
              { icon: Receipt, title: "e-Tax Invoice", desc: "ออกใบกำกับภาษีอิเล็กทรอนิกส์ตามรูปแบบกรมสรรพากร พิมพ์ แชร์ ส่งลิงก์ได้", color: "#05b187" },
              { icon: Scale, title: "Bank Reconciliation", desc: "นำเข้า Statement จากธนาคาร กระทบยอดกับบัญชีอัตโนมัติ เห็นรายการคงค้าง", color: "#fec90f" },
            ].map((item, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1}>
                <div className="bg-gray-50 rounded-2xl p-7 border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all text-center group">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 transition-transform group-hover:scale-110" style={{ backgroundColor: item.color + "12" }}>
                    <item.icon className="w-8 h-8" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Highlight 1: Auto Journal Entry */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="left" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">Auto Journal Entry</div>
                <div className="space-y-3">
                  {[
                    { doc: "TIV-2568-0042", type: "ใบกำกับภาษี", debit: "ลูกหนี้การค้า", credit: "รายได้จากการขาย", amount: "฿15,420.00", color: "#fb9678" },
                    { doc: "EXP-2568-0018", type: "บันทึกค่าใช้จ่าย", debit: "ค่าขนส่ง", credit: "เงินสด", amount: "฿2,800.00", color: "#fec90f" },
                    { doc: "RE-2568-0035", type: "ใบเสร็จรับเงิน", debit: "เงินฝากธนาคาร", credit: "ลูกหนี้การค้า", amount: "฿8,900.00", color: "#05b187" },
                  ].map((entry, i) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ color: entry.color, backgroundColor: entry.color + "15" }}>{entry.doc}</span>
                          <span className="text-xs text-gray-400">{entry.type}</span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">{entry.amount}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="text-[#f94d4d] font-medium">Dr. {entry.debit}</span>
                        <ArrowRight className="w-3 h-3 text-gray-300" />
                        <span className="text-[#05b187] font-medium">Cr. {entry.credit}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 bg-[#05b187]/5 rounded-xl p-4 border border-[#05b187]/10">
                    <Sparkles className="w-5 h-5 text-[#05b187]" />
                    <div>
                      <div className="text-xs font-bold text-gray-800">บันทึกอัตโนมัติ 3 รายการ</div>
                      <div className="text-xs text-gray-400">จากเอกสารที่อนุมัติวันนี้</div>
                    </div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="right" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#05b187]">
                Auto Journal
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                อนุมัติเอกสารปุ๊บ<br />
                <span className="text-[#05b187]">บันทึกบัญชีอัตโนมัติ</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">ไม่ต้องนั่งคีย์ Dr. Cr. เอง ระบบจะบันทึกบัญชีจากเอกสารที่อนุมัติอัตโนมัติ ตามสูตรบัญชีที่กำหนดไว้ตามประเภทธุรกิจ รองรับภาษีหัก ณ ที่จ่ายและไม่สร้างรายการซ้ำ</p>
              <div className="space-y-4">
                {[
                  "บันทึกบัญชีอัตโนมัติจากใบกำกับภาษี, ใบเสร็จ, ค่าใช้จ่าย",
                  "สมุดบัญชี 5 เล่ม (ทั่วไป, รับ, จ่าย, ซื้อ, ขาย)",
                  "สูตรบัญชีตามประเภทธุรกิจ ปรับแต่งได้",
                  "รองรับ WHT หัก ณ ที่จ่ายอัตโนมัติ",
                ].map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#05b187]/15 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#05b187]" />
                    </div>
                    <span className="text-gray-700 font-medium text-[15px]">{item}</span>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Highlight 2: Tax Documents */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="right" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">เอกสารภาษี & รายงาน</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: FileText, title: "ใบกำกับภาษี", desc: "e-Tax Invoice ตามรูปแบบ สรรพากร", color: "#03c9d7" },
                    { icon: Landmark, title: "ภ.พ.30", desc: "สรุป VAT ยื่นกรมสรรพากร ทุกเดือน", color: "#fb9678" },
                    { icon: ClipboardCheck, title: "หัก ณ ที่จ่าย", desc: "หนังสือรับรอง 50 ทวิ ใบแนบภาษี", color: "#05b187" },
                    { icon: PieChart, title: "งบการเงิน", desc: "งบทดลอง กำไรขาดทุน งบดุล ครบ", color: "#fec90f" },
                    { icon: BarChart3, title: "AR/AP Aging", desc: "ติดตามลูกหนี้ เจ้าหนี้ คงค้าง", color: "#f94d4d" },
                    { icon: Scale, title: "Bank Recon", desc: "กระทบยอดบัญชีกับ Statement", color: "#7B2D8E" },
                  ].map((tool, i) => (
                    <div key={i} className="p-4 rounded-xl border border-gray-100 hover:shadow-md transition-all">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: tool.color + "15" }}>
                        <tool.icon className="w-5 h-5" style={{ color: tool.color }} />
                      </div>
                      <div className="text-sm font-bold text-gray-800">{tool.title}</div>
                      <div className="text-xs text-gray-400 mt-1 leading-relaxed">{tool.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="left" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#fb9678]">
                Tax & Reports
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                รายงานภาษีครบ<br />
                <span className="text-[#fb9678]">ยื่นได้ทันที</span> ไม่ต้องทำเอง
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">ระบบสร้างรายงานภาษีให้อัตโนมัติจากข้อมูลเอกสาร ไม่ต้องสรุปเอง ครบทั้ง ภ.พ.30 รายงานภาษีซื้อ-ขาย หนังสือรับรองหัก ณ ที่จ่าย และงบการเงินทุกรูปแบบ</p>
              <div className="space-y-4">
                {[
                  "e-Tax Invoice & e-Receipt ตามมาตรฐานกรมสรรพากร",
                  "ภ.พ.30 สรุป VAT รายเดือน พร้อมยื่น",
                  "รายงานภาษีซื้อ / ภาษีขาย",
                  "50 ทวิ หนังสือรับรองหัก ณ ที่จ่ายรายปี",
                  "งบทดลอง งบกำไรขาดทุน งบดุล",
                ].map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#fb9678]/15 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#fb9678]" />
                    </div>
                    <span className="text-gray-700 font-medium text-[15px]">{item}</span>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Highlight 3: Accounting Firm */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="left" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">สำนักงานบัญชี — Multi-Tenant</div>
                <div className="space-y-3">
                  {[
                    { name: "บริษัท ABC จำกัด", type: "บริการ", docs: "128 เอกสาร", color: "#03c9d7" },
                    { name: "ห้างหุ้นส่วน XYZ", type: "การค้า", docs: "95 เอกสาร", color: "#fb9678" },
                    { name: "ร้าน สมชาย เทรดดิ้ง", type: "ค้าปลีก", docs: "67 เอกสาร", color: "#05b187" },
                    { name: "บริษัท ดิจิทัล แอพ จำกัด", type: "เทคโนโลยี", docs: "43 เอกสาร", color: "#fec90f" },
                  ].map((client, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: client.color }}>
                        {client.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">{client.name}</div>
                        <div className="text-xs text-gray-400">ประเภท: {client.type}</div>
                      </div>
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{client.docs}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-[#7B2D8E]/5 rounded-xl border border-[#7B2D8E]/10 flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-[#7B2D8E]" />
                  <div>
                    <div className="text-xs font-bold text-gray-800">Company Switcher</div>
                    <div className="text-xs text-gray-400">สลับบริษัทได้ง่าย ข้อมูลแยกอิสระ</div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="right" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#7B2D8E]">
                สำนักงานบัญชี
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                จัดการลูกค้า<br />
                <span className="text-[#7B2D8E]">หลายบริษัท</span> ในระบบเดียว
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">ระบบ Multi-Tenant ออกแบบสำหรับสำนักงานบัญชี จัดการลูกค้าหลายบริษัทได้ในบัญชีเดียว สลับบริษัทง่าย ข้อมูลแยกอิสระ พร้อมสัญญาจ้างออนไลน์และ Activity Log</p>
              <div className="space-y-4">
                {[
                  "Multi-Tenant จัดการลูกค้าหลายบริษัท",
                  "Company Switcher สลับบริษัทได้ในคลิกเดียว",
                  "สัญญาจ้างออนไลน์ ลงนามผ่านเว็บ",
                  "Activity Log ตรวจสอบย้อนหลังทุกการเปลี่ยนแปลง",
                  "สิทธิ์ผู้ใช้งานระดับโมดูล ละเอียดถึง Sub-module",
                ].map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#7B2D8E]/15 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#7B2D8E]" />
                    </div>
                    <span className="text-gray-700 font-medium text-[15px]">{item}</span>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Stats Banner */}
      <section className="py-14 bg-[#fb9678]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { value: "50+", label: "ฟีเจอร์บัญชี" },
              { value: "100%", label: "รองรับมาตรฐานไทย" },
              { value: "80%", label: "ลดเวลาทำงาน" },
              { value: "24/7", label: "ใช้งานได้ตลอด" },
            ].map((stat, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1}>
                <div className="text-center">
                  <div className="text-3xl sm:text-4xl font-extrabold text-white mb-1">{stat.value}</div>
                  <div className="text-sm text-white/80 font-medium">{stat.label}</div>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Plans */}
      <section id="plans" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">เลือกแพ็คเกจโปรแกรมบัญชี</h2>
              <p className="text-gray-400 text-[15px]">เริ่มต้นฟรี ไม่ต้องผูกบัตรเครดิต อัปเกรดเมื่อพร้อม</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {ACCOUNTING_PLANS.map((plan, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1}>
              <div
                className={`bg-white rounded-2xl overflow-hidden transition-all hover:shadow-2xl relative ${plan.popular ? "shadow-2xl ring-2" : "border border-gray-100 hover:-translate-y-1"}`}
                style={plan.popular ? { borderColor: plan.color, ["--tw-ring-color" as any]: plan.color } : undefined}
                data-testid={`acc-plan-${plan.name.toLowerCase()}`}
              >
                {plan.popular && (
                  <div className="text-center py-2 text-xs font-bold text-white tracking-wide" style={{ backgroundColor: plan.color }}>
                    แนะนำ — ยอดนิยม
                  </div>
                )}
                <div className="p-6">
                  <h3 className="text-base font-bold text-gray-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-400 mb-4 min-h-[32px]">{plan.desc}</p>
                  <div className="flex items-end gap-1 mb-2">
                    {plan.price === "ฟรี" ? (
                      <span className="text-[36px] font-extrabold leading-none" style={{ color: plan.color }}>ฟรี</span>
                    ) : (
                      <>
                        <span className="text-[36px] font-extrabold leading-none" style={{ color: plan.color }}>{plan.price}</span>
                        <span className="text-xs text-gray-400 pb-1 ml-1">{plan.period}</span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-5">{plan.limits}</p>
                  <button
                    onClick={() => navigate("/register")}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${plan.popular ? "text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5" : "border-2 hover:shadow-md hover:-translate-y-0.5"}`}
                    style={plan.popular ? { backgroundColor: plan.color } : { borderColor: plan.color, color: plan.color }}
                    data-testid={`btn-acc-plan-${plan.name.toLowerCase()}`}
                  >
                    {plan.cta}
                  </button>
                  <div className="mt-5 space-y-2.5">
                    {plan.features.map((f, fi) => (
                      <div key={fi} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.color }} />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">ฟีเจอร์บัญชีครบทุกความต้องการ</h2>
              <p className="text-gray-400 text-[15px]">ระบบบัญชีที่ครบที่สุดสำหรับธุรกิจไทย</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CATEGORIES.map((cat, i) => (
              <AnimateOnScroll key={i} delay={i * 0.1}>
              <div className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all" data-testid={`acc-feature-${i}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: cat.color + "15" }}>
                    <cat.icon className="w-6 h-6" style={{ color: cat.color }} />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">{cat.title}</h3>
                </div>
                <div className="space-y-2.5">
                  {cat.items.map((item, ii) => (
                    <div key={ii} className="flex items-center gap-2.5 text-sm text-gray-600">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: cat.color }} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="compare" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">เปรียบเทียบแพ็คเกจ</h2>
              <p className="text-gray-400 text-[15px]">เลือกแพ็คเกจที่เหมาะกับขนาดธุรกิจของคุณ</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left p-4 text-sm font-bold text-gray-500 w-1/3">ฟีเจอร์</th>
                    <th className="p-4 text-sm font-bold text-center" style={{ color: "#05b187" }}>Starter</th>
                    <th className="p-4 text-sm font-bold text-center" style={{ color: "#fb9678" }}>Standard</th>
                    <th className="p-4 text-sm font-bold text-center border-x-2" style={{ color: "#03c9d7", borderColor: "#03c9d7" }}>Professional</th>
                    <th className="p-4 text-sm font-bold text-center" style={{ color: "#fec90f" }}>Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-gray-50/50" : ""}`}>
                      <td className="p-4 text-sm text-gray-700 font-medium">{row.feature}</td>
                      <td className="p-4 text-center"><CellValue val={row.starter} /></td>
                      <td className="p-4 text-center"><CellValue val={row.standard} /></td>
                      <td className="p-4 text-center border-x-2" style={{ borderColor: "#03c9d7" }}><CellValue val={row.pro} /></td>
                      <td className="p-4 text-center"><CellValue val={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
          <div className="bg-[#f0fcfd] rounded-3xl shadow-xl p-10 sm:p-14 text-center border border-gray-100">
            <div className="w-16 h-16 rounded-2xl bg-[#03c9d7]/15 flex items-center justify-center mx-auto mb-6">
              <Calculator className="w-8 h-8 text-[#03c9d7]" />
            </div>
            <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 mb-4 tracking-tight">พร้อมเปลี่ยนระบบบัญชีแล้วหรือยัง?</h2>
            <p className="text-gray-400 text-[15px] mb-8 max-w-lg mx-auto">ประหยัดเวลา ลดข้อผิดพลาด เริ่มต้นฟรีวันนี้</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate("/register")}
                className="px-10 py-4 text-[15px] font-bold text-white bg-[#03c9d7] rounded-xl shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl hover:shadow-[#03c9d7]/35 hover:bg-[#02b5c2] hover:-translate-y-0.5 transition-all"
                data-testid="cta-acc-register"
              >
                สมัครใช้งานฟรี
              </button>
              <button
                onClick={() => navigate("/landing")}
                className="px-10 py-4 text-[15px] font-bold text-[#03c9d7] border-2 border-[#03c9d7] rounded-xl hover:bg-[#03c9d7]/5 transition-all"
                data-testid="btn-acc-all-packages"
              >
                ดูแพ็คเกจทั้งหมด
              </button>
            </div>
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-[#fafbfe]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">คำถามที่พบบ่อย</h2>
              <p className="text-gray-400 text-[15px]">หาคำตอบเกี่ยวกับโปรแกรมบัญชี</p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} item={item} index={i} />
            ))}
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="h-10 px-4 rounded-xl bg-[#03c9d7] flex items-center justify-center">
                <img src={logoWhite} alt="E-Tax Center" className="h-5 object-contain" />
              </div>
              <span className="font-bold text-white">E-Tax Center</span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate("/landing")} className="text-sm text-gray-400 hover:text-white transition-colors" data-testid="link-acc-footer-home">หน้าหลัก</button>
              <button onClick={() => navigate("/ecommerce-pricing")} className="text-sm text-gray-400 hover:text-white transition-colors" data-testid="link-acc-footer-ecom">E-Commerce Hub</button>
              <button onClick={() => navigate("/register")} className="text-sm text-gray-400 hover:text-white transition-colors" data-testid="link-acc-footer-register">สมัครใช้งาน</button>
            </div>
            <p className="text-sm text-gray-500">© 2568 E-Tax Center. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Scroll to Top Button */}
      <ScrollToTop />

      {/* Floating Contact Icons — stacked above live chat */}
      <div className="fixed right-4 bottom-20 z-50 flex flex-col gap-2" data-testid="floating-contact-icons">
        <a href="https://www.facebook.com/etaxcenter" target="_blank" rel="noopener noreferrer" className="w-11 h-11 flex items-center justify-center bg-[#1877F2] text-white rounded-full shadow-lg hover:scale-110 hover:shadow-xl transition-all" data-testid="contact-facebook">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a href="https://line.me/ti/p/@etaxcenter" target="_blank" rel="noopener noreferrer" className="w-11 h-11 flex items-center justify-center bg-[#06C755] text-white rounded-full shadow-lg hover:scale-110 hover:shadow-xl transition-all" data-testid="contact-line">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
        </a>
        <a href="tel:+6621234567" className="w-11 h-11 flex items-center justify-center bg-[#fb9678] text-white rounded-full shadow-lg hover:scale-110 hover:shadow-xl transition-all" data-testid="contact-phone">
          <Phone className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
}