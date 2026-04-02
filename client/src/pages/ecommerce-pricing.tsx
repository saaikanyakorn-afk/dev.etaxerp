import { useState, useEffect, useRef, type ReactNode, useMemo } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import logoWhite from "@assets/Logo_Etax_W_1771262337378.png";
import ecomDashboardImg from "@assets/image_1771262787029.png";
import logoShopee from "@assets/Shopee_1771303135650.png";
import logoLazada from "@assets/images_1771303135649.jpg";
import logoTiktok from "@assets/1000_F_470566291_IcqpTwiPWjjL6wAg6qGtrPy2ZyqpwW9o_1771303135649.jpg";
import logoGrab from "@assets/19743_1771303135648.jpg";
import logoLineman from "@assets/8a0a698f585db880a1bf73b4002e0912_1771303135647.jpg";
import logoAmazon from "@assets/images_1771303135646.png";
import logoRobinhood from "@assets/robinhood-affiliate-program_Robinhood_Affiliate_Program_1771303174725.png";
import {
  ShoppingCart, CheckCircle2, ArrowRight, ChevronDown, ChevronUp,
  Menu, X, Zap, Globe, Package, BarChart3, FileText,
  RefreshCw, Truck, Tag, MessageSquare, Store, Layers,
  Box, TrendingUp, Shield, Clock, Users, Headphones,
  Repeat, MousePointerClick, Receipt, Share2, Sparkles, CircleDollarSign, Phone
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

const ECOM_PLANS = [
  {
    name: "Starter",
    price: "ฟรี",
    period: "",
    desc: "ทดลองใช้ระบบ E-Commerce Hub",
    color: "#05b187",
    popular: false,
    cta: "เริ่มใช้ฟรี",
    limits: "จำกัด 50 ออเดอร์/เดือน",
    features: [
      "เชื่อมต่อ 1 ร้านค้า",
      "ดึงออเดอร์อัตโนมัติ",
      "Dashboard ยอดขายพื้นฐาน",
      "ออกใบกำกับภาษี 50 รายการ/เดือน",
      "ผู้ใช้ 1 คน",
    ],
  },
  {
    name: "Growth",
    price: "290",
    period: "บาท/เดือน",
    desc: "สำหรับร้านค้ากำลังเติบโต",
    color: "#fb9678",
    popular: false,
    cta: "เริ่มทดลองใช้",
    limits: "สูงสุด 500 ออเดอร์/เดือน",
    features: [
      "เชื่อมต่อ 3 ร้านค้า",
      "ดึงออเดอร์อัตโนมัติ",
      "ออกใบกำกับภาษีอัตโนมัติ",
      "Sync สต็อกข้ามร้าน",
      "Dashboard & Analytics",
      "Excel Export",
      "ผู้ใช้ 2 คน",
    ],
  },
  {
    name: "Professional",
    price: "590",
    period: "บาท/เดือน",
    desc: "ร้านค้าหลายแพลตฟอร์ม ครบทุกฟีเจอร์",
    color: "#03c9d7",
    popular: true,
    cta: "เริ่มทดลองใช้",
    limits: "ไม่จำกัดออเดอร์",
    features: [
      "เชื่อมต่อ 7 แพลตฟอร์ม",
      "ดึงออเดอร์อัตโนมัติ",
      "ออกใบกำกับภาษีอัตโนมัติ",
      "Sync สต็อกข้ามร้าน",
      "Fulfillment Pick-Pack-Ship",
      "Shipping Label พิมพ์ใบปะหน้า",
      "Dashboard & Analytics ขั้นสูง",
      "LINE แจ้ง Tracking ลูกค้า",
      "Chat Inbox รวมแชทร้าน",
      "Facebook CF Order",
      "Live Selling",
      "ผู้ใช้ 5 คน",
    ],
  },
  {
    name: "Enterprise",
    price: "990",
    period: "บาท/เดือน",
    desc: "ร้านค้าขนาดใหญ่ หลายคลัง หลายแบรนด์",
    color: "#fec90f",
    popular: false,
    cta: "ติดต่อฝ่ายขาย",
    limits: "ไม่จำกัดทุกอย่าง",
    features: [
      "ทุกฟีเจอร์ Professional",
      "หลายคลังสินค้า",
      "Store Clone โคลนร้าน",
      "Open API เชื่อมเว็บไซต์",
      "Auto Order Sync",
      "Tax Invoice Reconciliation",
      "Ad Cost & ROAS Tracking",
      "Dedicated Support",
      "ผู้ใช้ไม่จำกัด",
    ],
  },
];

const PLATFORMS = [
  { name: "Shopee", color: "#EE4D2D", logo: logoShopee },
  { name: "Lazada", color: "#0F1689", logo: logoLazada },
  { name: "TikTok Shop", color: "#000000", logo: logoTiktok },
  { name: "Grab Food", color: "#00B14F", logo: logoGrab },
  { name: "LINE MAN", color: "#06C755", logo: logoLineman },
  { name: "Robinhood", color: "#7B2D8E", logo: logoRobinhood },
  { name: "Amazon", color: "#FF9900", logo: logoAmazon },
];

const FEATURE_CATEGORIES = [
  {
    title: "จัดการออเดอร์",
    icon: ShoppingCart,
    color: "#03c9d7",
    items: ["ดึงออเดอร์อัตโนมัติ", "อัปเดตสถานะ Batch", "นำเข้า Excel/CSV", "ติดตาม Tracking"],
  },
  {
    title: "สต็อก & คลังสินค้า",
    icon: Package,
    color: "#fb9678",
    items: ["Sync สต็อกข้ามแพลตฟอร์ม", "หลายคลังสินค้า", "สต็อกการ์ด", "แจ้งเตือนสินค้าใกล้หมด"],
  },
  {
    title: "Fulfillment",
    icon: Truck,
    color: "#05b187",
    items: ["Pick-Pack-Ship", "พิมพ์ Shipping Label", "LINE แจ้ง Tracking", "รองรับหลายขนส่ง"],
  },
  {
    title: "เอกสาร & ภาษี",
    icon: FileText,
    color: "#fec90f",
    items: ["ออกใบกำกับภาษีอัตโนมัติ", "Auto-TIV on Ship", "Tax Reconciliation", "Batch Print"],
  },
  {
    title: "Analytics & รายงาน",
    icon: BarChart3,
    color: "#f94d4d",
    items: ["Dashboard ยอดขายรวม", "เปรียบเทียบแพลตฟอร์ม", "กำไรต่อออเดอร์", "ROAS & Ad Cost"],
  },
  {
    title: "เครื่องมือขาย",
    icon: Zap,
    color: "#7B2D8E",
    items: ["Chat Inbox รวมแชท", "Facebook CF Order", "Live Selling", "Store Clone"],
  },
];

const COMPARISON_ROWS = [
  { feature: "จำนวนร้านค้าที่เชื่อมต่อ", starter: "1", growth: "3", pro: "7", enterprise: "ไม่จำกัด" },
  { feature: "ออเดอร์ต่อเดือน", starter: "50", growth: "500", pro: "ไม่จำกัด", enterprise: "ไม่จำกัด" },
  { feature: "ผู้ใช้งาน", starter: "1", growth: "2", pro: "5", enterprise: "ไม่จำกัด" },
  { feature: "ดึงออเดอร์อัตโนมัติ", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "ออกใบกำกับภาษี", starter: true, growth: true, pro: true, enterprise: true },
  { feature: "Sync สต็อกข้ามร้าน", starter: false, growth: true, pro: true, enterprise: true },
  { feature: "Dashboard & Analytics", starter: "พื้นฐาน", growth: true, pro: "ขั้นสูง", enterprise: "ขั้นสูง" },
  { feature: "Fulfillment Pick-Pack-Ship", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "Shipping Label", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "LINE แจ้ง Tracking", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "Chat Inbox", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "Facebook CF Order", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "Live Selling", starter: false, growth: false, pro: true, enterprise: true },
  { feature: "หลายคลังสินค้า", starter: false, growth: false, pro: false, enterprise: true },
  { feature: "Store Clone", starter: false, growth: false, pro: false, enterprise: true },
  { feature: "Open API", starter: false, growth: false, pro: false, enterprise: true },
  { feature: "Tax Reconciliation", starter: false, growth: false, pro: false, enterprise: true },
  { feature: "Ad Cost & ROAS", starter: false, growth: false, pro: false, enterprise: true },
  { feature: "Excel Export", starter: false, growth: true, pro: true, enterprise: true },
];

const FAQ_ITEMS = [
  { q: "ทดลองใช้ฟรีกี่วัน?", a: "แพ็คเกจ Starter ใช้ฟรีไม่มีกำหนด จำกัด 50 ออเดอร์/เดือน เหมาะสำหรับร้านค้าเริ่มต้น แพ็คเกจอื่นทดลองใช้ฟรี 14 วัน" },
  { q: "เชื่อมต่อร้านค้าอย่างไร?", a: "เพียงล็อกอินเข้าบัญชี Shopee, Lazada หรือ TikTok Shop ผ่านหน้า Connection ระบบจะดึงออเดอร์ให้อัตโนมัติ ไม่ต้องตั้งค่าอะไรเพิ่มเติม" },
  { q: "เปลี่ยนแพ็คเกจระหว่างใช้งานได้ไหม?", a: "ได้ สามารถอัปเกรดหรือดาวน์เกรดได้ทุกเมื่อ ค่าใช้จ่ายจะคำนวณตามสัดส่วนวันที่เหลือ" },
  { q: "ต้องใช้ร่วมกับแพ็คเกจบัญชีไหม?", a: "ไม่จำเป็น E-Commerce Hub ใช้งานแยกได้เลย แต่ถ้าต้องการบัญชีครบวงจร สามารถอัปเกรดเป็น Professional ในหน้าราคาหลักได้" },
  { q: "รองรับออเดอร์ภาษาไทยไหม?", a: "รองรับครบ ทั้งชื่อสินค้า ที่อยู่ลูกค้า ใบกำกับภาษีภาษาไทย พร้อมรองรับ ภ.ศ. (พุทธศักราช)" },
];

function FAQItem({ item, index }: { item: typeof FAQ_ITEMS[0]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl overflow-hidden transition-all ${open ? "bg-white shadow-md" : "bg-white/60 hover:bg-white"}`}>
      <button className="w-full text-left px-6 py-5 flex items-center justify-between gap-4" onClick={() => setOpen(!open)} data-testid={`ecom-faq-toggle-${index}`}>
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

const TIER_COLORS: Record<string, string> = { free: "#05b187", starter: "#fb9678", pro: "#03c9d7", enterprise: "#fec90f" };

function formatPlanPrice(price: string | number): string {
  const n = Number(price);
  if (!n || n <= 0) return "ฟรี";
  return n.toLocaleString("th-TH");
}

export default function EcommercePricing() {
  const [, navigate] = useLocation();
  const [mobileMenu, setMobileMenu] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  const { data: apiPlans } = useQuery<any[]>({
    queryKey: ["/api/public/module-plans", "ecommerce"],
    queryFn: () => fetch("/api/public/module-plans?module=ecommerce").then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const plans = useMemo(() => {
    if (!apiPlans || apiPlans.length === 0) return ECOM_PLANS;
    return apiPlans.map((p: any) => ({
      name: p.name,
      price: Number(p.monthlyPrice) <= 0 ? "ฟรี" : formatPlanPrice(p.monthlyPrice),
      period: Number(p.monthlyPrice) > 0 ? "บาท/เดือน" : "",
      desc: p.description || "",
      color: TIER_COLORS[p.tier] || "#03c9d7",
      popular: p.popular || false,
      cta: Number(p.monthlyPrice) <= 0 ? "เริ่มใช้ฟรี" : (Number(p.monthlyPrice) >= 990 ? "ติดต่อฝ่ายขาย" : "เริ่มทดลองใช้"),
      limits: p.limits || `ผู้ใช้ ${p.maxUsers} คน`,
      features: p.features || [],
    }));
  }, [apiPlans]);

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
            <button onClick={() => navigate("/register")} className="px-5 py-2.5 text-sm font-bold text-white rounded-xl bg-[#03c9d7] hover:bg-[#02b5c2] transition-all shadow-sm hover:shadow-md" data-testid="btn-ecom-register">
              ทดลองใช้ฟรี
            </button>
          </div>
          <button className="md:hidden p-2" onClick={() => setMobileMenu(!mobileMenu)}>
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
                <ShoppingCart className="w-4 h-4" />
                E-Commerce Hub
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 leading-snug sm:leading-snug lg:leading-snug mb-6">
                ศูนย์รวมจัดการ<br />
                <span className="text-[#03c9d7]">ร้านค้าออนไลน์</span><br />
                ครบจบในที่เดียว
              </h1>
              <p className="text-lg text-gray-500 mb-8 leading-relaxed">
                เชื่อมต่อ Shopee, Lazada, TikTok Shop และอีก 4 แพลตฟอร์ม ดึงออเดอร์อัตโนมัติ ออกใบกำกับภาษี จัดส่ง ติดตามสต็อก วิเคราะห์ยอดขาย ทุกอย่างในแพลตฟอร์มเดียว
              </p>

              {/* Platform badges */}
              <div className="flex flex-wrap gap-2 mb-8">
                {PLATFORMS.map((p) => (
                  <span key={p.name} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-gray-200 text-gray-700 shadow-sm">
                    <img src={p.logo} alt={p.name} className="w-5 h-5 rounded object-contain" />
                    {p.name}
                  </span>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => navigate("/register")}
                  className="px-8 py-4 text-[15px] font-bold text-white rounded-xl bg-[#03c9d7] hover:bg-[#02b5c2] shadow-lg shadow-[#03c9d7]/25 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  data-testid="btn-hero-register"
                >
                  เริ่มใช้ฟรี — ไม่ต้องผูกบัตร <ArrowRight className="w-4 h-4" />
                </button>
                <a
                  href="#compare"
                  className="px-8 py-4 text-[15px] font-bold text-[#03c9d7] rounded-xl border-2 border-[#03c9d7] hover:bg-[#03c9d7]/5 transition-all text-center"
                >
                  เปรียบเทียบแพ็คเกจ
                </a>
              </div>
            </div>
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-gray-200">
                <img src={ecomDashboardImg} alt="E-Commerce Hub Dashboard" className="w-full" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-xl shadow-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#05b187]/10 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-[#05b187]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">ยอดขายเดือนนี้</div>
                    <div className="text-sm font-bold text-gray-900">฿559,584</div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-4 -right-4 bg-white rounded-xl shadow-lg p-3 border border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#fb9678]/10 flex items-center justify-center">
                    <Store className="w-4 h-4 text-[#fb9678]" />
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400">ร้านค้าเชื่อมต่อ</div>
                    <div className="text-sm font-bold text-gray-900">7 แพลตฟอร์ม</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why E-Commerce Hub - Key Benefits */}
      <section id="highlights" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <p className="text-[#03c9d7] font-semibold text-sm tracking-wide mb-3">ทำไมต้อง E-COMMERCE HUB</p>
              <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4 tracking-tight">ปัญหาจะ <span className="text-[#03c9d7]">หมดไป</span> เมื่อใช้ระบบของเรา</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-[15px]">ไม่ต้องสลับหน้าจอไปมาระหว่างแพลตฟอร์ม ไม่ต้องคีย์ข้อมูลซ้ำ ไม่ต้องกลัวสต็อกผิดพลาด</p>
            </div>
          </AnimateOnScroll>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-14">
            {[
              { icon: Repeat, title: "ลดงานซ้ำ 80%", desc: "ดึงออเดอร์, อัปเดตสต็อก, ออกเอกสาร ทำอัตโนมัติทั้งหมด ไม่ต้องคีย์มือ", color: "#03c9d7" },
              { icon: Shield, title: "สต็อกแม่นยำ 100%", desc: "Sync สต็อกข้ามทุกร้านค้าแบบ Real-time ไม่มีขายเกินสต็อกอีกต่อไป", color: "#05b187" },
              { icon: CircleDollarSign, title: "เพิ่มกำไร", desc: "เห็นกำไรต่อออเดอร์, ค่า GP แพลตฟอร์ม, ค่าโฆษณา วิเคราะห์ต้นทุนครบ", color: "#fb9678" },
              { icon: Clock, title: "ประหยัดเวลา 5 ชม./วัน", desc: "รวมทุกอย่างในที่เดียว ไม่ต้องเปิดหลายหน้าจอ ทำงานเร็วขึ้นเท่าตัว", color: "#fec90f" },
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

      {/* Highlight 1: Auto Order Sync */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="left" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">การเชื่อมต่อร้านค้า</div>
                <div className="space-y-3">
                  {[
                    { name: "Shopee", orders: "1,250", status: "เชื่อมต่อแล้ว", logo: logoShopee, statusColor: "#05b187" },
                    { name: "Lazada", orders: "840", status: "เชื่อมต่อแล้ว", logo: logoLazada, statusColor: "#05b187" },
                    { name: "TikTok Shop", orders: "620", status: "เชื่อมต่อแล้ว", logo: logoTiktok, statusColor: "#05b187" },
                    { name: "Grab Food", orders: "380", status: "เชื่อมต่อแล้ว", logo: logoGrab, statusColor: "#05b187" },
                    { name: "LINE MAN", orders: "210", status: "รอเชื่อมต่อ", logo: logoLineman, statusColor: "#fec90f" },
                  ].map((p, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="w-10 h-10 rounded-lg overflow-hidden flex items-center justify-center bg-white shadow-sm border border-gray-100">
                        <img src={p.logo} alt={p.name} className="w-8 h-8 object-contain" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                        <div className="text-xs text-gray-400">{p.orders} ออเดอร์เดือนนี้</div>
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: p.statusColor, backgroundColor: p.statusColor + "15" }}>{p.status}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-[#03c9d7]/5 rounded-xl border border-[#03c9d7]/10 flex items-center gap-3">
                  <RefreshCw className="w-5 h-5 text-[#03c9d7]" />
                  <div>
                    <div className="text-xs font-bold text-gray-800">Sync อัตโนมัติทุก 15 นาที</div>
                    <div className="text-xs text-gray-400">อัปเดตล่าสุด: 2 นาทีที่แล้ว</div>
                  </div>
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="right" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#03c9d7]">
                Auto Sync
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                เชื่อมต่อ 7 แพลตฟอร์ม<br />
                <span className="text-[#03c9d7]">ดึงออเดอร์อัตโนมัติ</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">เพียงล็อกอินเข้าบัญชีร้านค้า ระบบจะดึงออเดอร์ใหม่ อัปเดตสถานะ และ Sync สต็อกให้อัตโนมัติทุก 15 นาที ไม่ต้องคอยเช็คเอง</p>
              <div className="space-y-4">
                {[
                  "Shopee, Lazada, TikTok Shop, Grab Food, LINE MAN, Robinhood, Amazon",
                  "Sync ออเดอร์อัตโนมัติ ไม่ต้องคีย์มือ",
                  "อัปเดตสถานะออเดอร์ Real-time",
                  "รองรับนำเข้าจาก Excel / CSV ด้วย",
                ].map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#03c9d7]/15 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#03c9d7]" />
                    </div>
                    <span className="text-gray-700 font-medium text-[15px]">{item}</span>
                  </div>
                ))}
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>

      {/* Highlight 2: Fulfillment & Shipping */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="right" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">Fulfillment — Pick Pack Ship</div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { step: "1", label: "Pick", count: "48 รายการ", color: "#fb9678", icon: MousePointerClick },
                    { step: "2", label: "Pack", count: "32 กล่อง", color: "#fec90f", icon: Box },
                    { step: "3", label: "Ship", count: "28 พัสดุ", color: "#05b187", icon: Truck },
                  ].map((s, i) => (
                    <div key={i} className="text-center p-4 rounded-xl" style={{ backgroundColor: s.color + "08" }}>
                      <div className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center" style={{ backgroundColor: s.color + "18" }}>
                        <s.icon className="w-5 h-5" style={{ color: s.color }} />
                      </div>
                      <div className="text-sm font-bold text-gray-800">{s.label}</div>
                      <div className="text-xs text-gray-400 mt-1">{s.count}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    { id: "SHP-1234", buyer: "สมชาย ว.", items: "3 ชิ้น", status: "พร้อมจัดส่ง", color: "#05b187" },
                    { id: "LZD-5678", buyer: "พรทิพย์ ร.", items: "1 ชิ้น", status: "กำลัง Pack", color: "#fec90f" },
                    { id: "TIK-9012", buyer: "วิชัย ศ.", items: "2 ชิ้น", status: "รอ Pick", color: "#fb9678" },
                  ].map((o, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
                      <div className="text-xs font-mono font-bold text-gray-500 w-20">{o.id}</div>
                      <div className="flex-1 text-sm text-gray-700">{o.buyer} ({o.items})</div>
                      <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ color: o.color, backgroundColor: o.color + "15" }}>{o.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="left" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#05b187]">
                Fulfillment
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                จัดส่งง่าย<br />
                <span className="text-[#05b187]">Pick-Pack-Ship</span> ครบวงจร
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">ระบบ Fulfillment มืออาชีพ จัดการคำสั่งซื้อตั้งแต่หยิบสินค้า แพ็คกล่อง จนถึงจัดส่ง พิมพ์ใบปะหน้าพัสดุ และแจ้ง Tracking ลูกค้าผ่าน LINE อัตโนมัติ</p>
              <div className="space-y-4">
                {[
                  "ระบบ Pick List จัดลำดับหยิบสินค้าอัตโนมัติ",
                  "พิมพ์ Shipping Label ทุกขนส่ง (Kerry, Flash, J&T, ไปรษณีย์ฯ)",
                  "LINE แจ้ง Tracking Number ลูกค้าอัตโนมัติ",
                  "Auto ออกใบกำกับภาษีเมื่อจัดส่ง",
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

      {/* Highlight 3: Analytics & Reports */}
      <section className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="left" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">Analytics Dashboard</div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: "ยอดขายรวม", value: "฿1.85M", change: "+12.5%", color: "#03c9d7" },
                    { label: "ออเดอร์", value: "3,420", change: "+8.2%", color: "#fb9678" },
                    { label: "กำไรเฉลี่ย", value: "32.5%", change: "+2.1%", color: "#05b187" },
                    { label: "ลูกค้าใหม่", value: "580", change: "+15.3%", color: "#fec90f" },
                  ].map((kpi, i) => (
                    <div key={i} className="p-4 rounded-xl bg-gray-50">
                      <div className="text-xs text-gray-400 mb-1">{kpi.label}</div>
                      <div className="text-xl font-extrabold text-gray-900">{kpi.value}</div>
                      <div className="text-xs font-bold mt-1" style={{ color: kpi.color }}>{kpi.change}</div>
                    </div>
                  ))}
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-bold text-gray-600 mb-2">ยอดขายแยกแพลตฟอร์ม</div>
                  {[
                    { name: "Shopee", pct: 45, color: "#EE4D2D" },
                    { name: "Lazada", pct: 28, color: "#0F1689" },
                    { name: "TikTok Shop", pct: 20, color: "#000000" },
                    { name: "อื่นๆ", pct: 7, color: "#999" },
                  ].map((bar, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="text-xs text-gray-500 w-20">{bar.name}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${bar.pct}%`, backgroundColor: bar.color }} />
                      </div>
                      <div className="text-xs font-bold text-gray-600 w-10 text-right">{bar.pct}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
            <AnimateOnScroll direction="right" className="flex-1">
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#fb9678]">
                Analytics
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                วิเคราะห์ยอดขาย<br />
                <span className="text-[#fb9678]">เห็นภาพรวมทุกร้าน</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">Dashboard แสดงยอดขายรวมจากทุกแพลตฟอร์ม เปรียบเทียบช่องทาง วิเคราะห์กำไรต่อออเดอร์ ติดตามค่าโฆษณาและ ROAS ตัดสินใจเรื่องธุรกิจด้วยข้อมูลจริง</p>
              <div className="space-y-4">
                {[
                  "Dashboard KPI ยอดขาย / กำไร / ออเดอร์ แบบ Real-time",
                  "เปรียบเทียบยอดขายข้ามแพลตฟอร์ม",
                  "Profit Per Order คำนวณกำไรต่อออเดอร์",
                  "Ad Cost & ROAS Tracking ติดตามค่าโฆษณา",
                  "Export รายงาน Excel ได้ทุกข้อมูล",
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

      {/* Highlight 4: Sales Tools */}
      <section className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row-reverse items-center gap-12 lg:gap-20">
            <AnimateOnScroll direction="right" className="flex-1 w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden p-6">
                <div className="text-sm font-bold text-gray-800 mb-4">เครื่องมือช่วยขาย</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: MessageSquare, title: "Chat Inbox", desc: "รวมแชทจากทุกร้านค้า ตอบลูกค้าในที่เดียว", color: "#03c9d7" },
                    { icon: Sparkles, title: "Live Selling", desc: "จัดการ Live ขายของ รับออเดอร์อัตโนมัติ", color: "#f94d4d" },
                    { icon: Receipt, title: "Facebook CF", desc: "รับ CF อัตโนมัติจาก Comment ใน Facebook", color: "#fb9678" },
                    { icon: Share2, title: "Store Clone", desc: "โคลนสินค้าข้ามร้าน ข้ามแพลตฟอร์ม", color: "#05b187" },
                    { icon: Tag, title: "Promotions", desc: "สร้างโปรโมชั่นเงื่อนไขซับซ้อนได้", color: "#fec90f" },
                    { icon: Globe, title: "Open API", desc: "เชื่อมต่อเว็บไซต์ภายนอก รับออเดอร์ API", color: "#7B2D8E" },
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
              <span className="inline-block px-3 py-1.5 rounded-full text-xs font-bold text-white mb-5 bg-[#f94d4d]">
                Sales Tools
              </span>
              <h2 className="text-3xl sm:text-[38px] font-extrabold text-gray-900 leading-tight mb-5 tracking-tight">
                เครื่องมือช่วยขาย<br />
                <span className="text-[#f94d4d]">เพิ่มยอดขายทุกช่องทาง</span>
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8 text-[15px]">ไม่ใช่แค่จัดการออเดอร์ แต่ช่วยให้ขายได้มากขึ้น ด้วยเครื่องมือ Live Selling, Chat Inbox, Facebook CF, และ Open API สำหรับเชื่อมต่อเว็บไซต์ภายนอก</p>
              <div className="space-y-4">
                {[
                  "Chat Inbox — ตอบแชทลูกค้าทุกร้านในที่เดียว",
                  "Live Selling — รับ CF สดจากไลฟ์ สร้างออเดอร์อัตโนมัติ",
                  "Facebook CF — จับคำสั่ง CF จาก Comment โพสต์/ไลฟ์",
                  "Store Clone — โคลนสินค้าข้ามร้านข้ามแพลตฟอร์ม 1 คลิก",
                ].map((item, ii) => (
                  <div key={ii} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center bg-[#f94d4d]/15 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#f94d4d]" />
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
              { value: "7+", label: "แพลตฟอร์มรองรับ" },
              { value: "50+", label: "ฟีเจอร์พร้อมใช้" },
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
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">เลือกแพ็คเกจ E-Commerce Hub</h2>
            <p className="text-gray-400 text-[15px]">เริ่มต้นฟรี ไม่ต้องผูกบัตรเครดิต อัปเกรดเมื่อพร้อม</p>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 ${plans.length <= 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"} gap-6`}>
            {plans.map((plan, i) => (
              <div
                key={i}
                className={`bg-white rounded-2xl overflow-hidden transition-all hover:shadow-2xl relative ${plan.popular ? "shadow-2xl ring-2" : "border border-gray-100 hover:-translate-y-1"}`}
                style={plan.popular ? { borderColor: plan.color, ["--tw-ring-color" as any]: plan.color } : undefined}
                data-testid={`ecom-plan-${plan.name.toLowerCase()}`}
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
                    data-testid={`btn-ecom-plan-${plan.name.toLowerCase()}`}
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
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">ฟีเจอร์ครบทุกความต้องการ</h2>
            <p className="text-gray-400 text-[15px]">เครื่องมือจัดการร้านค้าออนไลน์ที่ครบที่สุดในไทย</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURE_CATEGORIES.map((cat, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-xl hover:-translate-y-1 transition-all" data-testid={`ecom-feature-${i}`}>
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
            ))}
          </div>
        </div>
      </section>

      {/* Comparison Table */}
      <section id="compare" className="py-20 bg-[#fafbfe]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">เปรียบเทียบแพ็คเกจ</h2>
            <p className="text-gray-400 text-[15px]">เลือกแพ็คเกจที่เหมาะกับขนาดธุรกิจของคุณ</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-6 py-4 text-sm font-bold text-gray-900 w-[240px]">ฟีเจอร์</th>
                    {plans.map((p) => (
                      <th key={p.name} className="text-center px-4 py-4 min-w-[120px]">
                        <div className="text-sm font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs font-bold mt-1" style={{ color: p.color }}>
                          {p.price === "ฟรี" ? "ฟรี" : `฿${p.price}/เดือน`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, ri) => (
                    <tr key={ri} className={`border-b border-gray-50 ${ri % 2 === 0 ? "bg-gray-50/30" : ""}`}>
                      <td className="px-6 py-3.5 text-sm text-gray-700">{row.feature}</td>
                      <td className="px-4 py-3.5 text-center"><CellValue val={row.starter} /></td>
                      <td className="px-4 py-3.5 text-center"><CellValue val={row.growth} /></td>
                      <td className="px-4 py-3.5 text-center"><CellValue val={row.pro} /></td>
                      <td className="px-4 py-3.5 text-center"><CellValue val={row.enterprise} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-[40px] font-extrabold text-gray-900 mb-4">คำถามที่พบบ่อย</h2>
            <p className="text-gray-400 text-[15px]">เกี่ยวกับ E-Commerce Hub</p>
          </div>
          <div className="space-y-3">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} item={item} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#fb9678] relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"30\" height=\"30\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Ccircle cx=\"15\" cy=\"15\" r=\"1\" fill=\"white\"/%3E%3C/svg%3E')", backgroundSize: "30px 30px" }} />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">พร้อมจัดการร้านค้าออนไลน์ให้ง่ายขึ้น?</h2>
          <p className="text-white/80 text-lg mb-8">เริ่มใช้ E-Commerce Hub ฟรีวันนี้ ไม่ต้องผูกบัตรเครดิต</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate("/register")}
              className="w-full sm:w-auto px-10 py-4 text-[15px] font-bold text-[#03c9d7] bg-white rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2"
              data-testid="btn-cta-register"
            >
              สมัครใช้ฟรี <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate("/landing")}
              className="w-full sm:w-auto px-10 py-4 text-[15px] font-bold text-white rounded-xl border-2 border-white/40 hover:bg-white/10 transition-all"
            >
              ดูแพ็คเกจทั้งหมด
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 py-10">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#03c9d7] flex items-center justify-center">
                <img src={logoWhite} alt="E-Tax" className="w-5 h-5 object-contain" />
              </div>
              <span className="text-white font-bold">E-Tax Center</span>
            </div>
            <div className="flex items-center gap-6">
              <button onClick={() => navigate("/landing")} className="text-sm text-gray-400 hover:text-white transition-colors">หน้าหลัก</button>
              <a href="#plans" className="text-sm text-gray-400 hover:text-white transition-colors">แพ็คเกจ</a>
              <button onClick={() => navigate("/login")} className="text-sm text-gray-400 hover:text-white transition-colors">เข้าสู่ระบบ</button>
            </div>
            <p className="text-xs text-gray-500">© 2025 E-Tax Center. All rights reserved.</p>
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