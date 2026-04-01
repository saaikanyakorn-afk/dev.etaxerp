import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, ArrowRight, ChevronUp,
  Menu, X, UtensilsCrossed, ShoppingCart, Store, Link2,
  BarChart3, Clock, Users, Headphones,
  Shield, Zap, Bell, ClipboardList, Settings
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
      className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110"
      style={{ background: "#05b187" }}
      data-testid="button-scroll-top"
    >
      <ChevronUp className="h-5 w-5 text-white" />
    </button>
  );
}

const FEATURES = [
  { icon: ShoppingCart, title: "รับออเดอร์อัตโนมัติ", desc: "ดึงออเดอร์จาก Grab Food, LINE MAN, Robinhood อัตโนมัติ" },
  { icon: UtensilsCrossed, title: "จัดการเมนู", desc: "จัดการเมนูอาหารและเชื่อมโยงกับแพลตฟอร์ม" },
  { icon: Store, title: "หลายร้าน", desc: "รองรับหลายร้านค้าในแต่ละแพลตฟอร์ม" },
  { icon: Link2, title: "เชื่อมต่อ 3 แพลตฟอร์ม", desc: "Grab Food, LINE MAN, Robinhood พร้อมเพิ่มเติม" },
  { icon: BarChart3, title: "วิเคราะห์ยอดขาย", desc: "Dashboard ยอดขายรายวัน เมนูขายดี สัดส่วนแพลตฟอร์ม" },
  { icon: ClipboardList, title: "ประวัติออเดอร์", desc: "ดูประวัติออเดอร์ทั้งหมด ส่งออก Excel ได้" },
  { icon: Bell, title: "แจ้งเตือนออเดอร์", desc: "รับการแจ้งเตือนเมื่อมีออเดอร์ใหม่หรือยกเลิก" },
  { icon: Settings, title: "ออกเอกสารภาษีอัตโนมัติ", desc: "สร้างใบกำกับภาษีอัตโนมัติเมื่อออเดอร์เสร็จสิ้น" },
];

const PLANS = [
  {
    name: "Starter",
    price: "390",
    period: "บาท/เดือน",
    desc: "สำหรับร้านอาหาร 1 ร้าน เริ่มต้นใช้งาน",
    features: ["เชื่อมต่อ 1 แพลตฟอร์ม", "ออเดอร์ 500 รายการ/เดือน", "จัดการเมนู", "ประวัติออเดอร์", "ผู้ใช้ 1 คน"],
    color: "#05b187",
    popular: false,
  },
  {
    name: "Professional",
    price: "790",
    period: "บาท/เดือน",
    desc: "สำหรับร้านอาหารหลายสาขา",
    features: ["เชื่อมต่อ 3 แพลตฟอร์ม", "ออเดอร์ไม่จำกัด", "จัดการเมนู", "วิเคราะห์ยอดขาย", "แจ้งเตือนออเดอร์", "ออกเอกสารภาษีอัตโนมัติ", "ผู้ใช้ 3 คน"],
    color: "#05b187",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "1,490",
    period: "บาท/เดือน",
    desc: "สำหรับเชนร้านอาหาร แฟรนไชส์",
    features: ["เชื่อมต่อทุกแพลตฟอร์ม", "ออเดอร์ไม่จำกัด", "หลายร้าน/สาขา", "API เชื่อมต่อ POS", "วิเคราะห์เปรียบเทียบสาขา", "ออกเอกสารภาษีอัตโนมัติ", "ผู้ใช้ไม่จำกัด", "ซัพพอร์ตเฉพาะ"],
    color: "#05b187",
    popular: false,
  },
];

const FAQS = [
  { q: "รองรับแพลตฟอร์มอะไรบ้าง?", a: "ปัจจุบันรองรับ Grab Food, LINE MAN และ Robinhood โดยจะเพิ่มแพลตฟอร์มใหม่ในอนาคต" },
  { q: "ออเดอร์ดึงเข้าระบบเร็วแค่ไหน?", a: "ระบบซิงค์ออเดอร์อัตโนมัติทุก 5 นาที หรือกดดึงด้วยตนเองได้ทันที" },
  { q: "สามารถออกใบกำกับภาษีได้ไหม?", a: "ได้ ระบบสามารถสร้างใบกำกับภาษีอัตโนมัติจากออเดอร์อาหาร รองรับทั้ง TIV และ IV" },
  { q: "ใช้ร่วมกับโมดูล eCommerce ได้ไหม?", a: "ได้ ทั้ง Food Delivery และ eCommerce Hub ทำงานร่วมกันได้ ข้อมูลออเดอร์และเอกสารภาษีอยู่ในระบบเดียวกัน" },
];

export default function FoodDeliveryPricing() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-white font-sans force-light-mode">
      <ScrollToTop />

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center shadow-md" style={{ background: "#05b187" }}>
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold" style={{ color: "#05b187" }}>Food Delivery</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">ฟีเจอร์</a>
            <a href="#pricing" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">แพ็คเกจ</a>
            <a href="#faq" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
            <button onClick={() => navigate("/login")} className="px-5 py-2 rounded-full text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all" style={{ background: "#05b187" }}>
              เข้าสู่ระบบ
            </button>
          </div>
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} data-testid="btn-mobile-menu">
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-white px-4 py-3 space-y-2 shadow-lg">
            <a href="#features" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>ฟีเจอร์</a>
            <a href="#pricing" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>แพ็คเกจ</a>
            <a href="#faq" className="block py-2 text-sm text-gray-600" onClick={() => setMobileMenuOpen(false)}>FAQ</a>
            <button onClick={() => navigate("/login")} className="w-full py-2 rounded-full text-sm font-semibold text-white" style={{ background: "#05b187" }}>
              เข้าสู่ระบบ
            </button>
          </div>
        )}
      </header>

      <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "#05b187" }}>
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <AnimateOnScroll>
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur rounded-full px-4 py-1.5 mb-6">
              <UtensilsCrossed className="h-4 w-4 text-white" />
              <span className="text-sm font-medium text-white">Food Delivery Module</span>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.1}>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
              ศูนย์รวมจัดการ<br className="hidden sm:block" />ออเดอร์อาหาร
            </h1>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.2}>
            <p className="text-lg text-white/90 max-w-2xl mx-auto mb-8">
              เชื่อมต่อ Grab Food, LINE MAN, Robinhood ดึงออเดอร์อัตโนมัติ ออกใบกำกับภาษี วิเคราะห์ยอดขาย ในที่เดียว
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.3}>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate("/register")}
                className="px-8 py-3.5 rounded-full text-base font-bold shadow-xl hover:shadow-2xl transition-all bg-white hover:bg-gray-50"
                style={{ color: "#05b187" }}
              >
                เริ่มใช้งาน Food Delivery <ArrowRight className="h-5 w-5 inline ml-2" />
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-8 py-3.5 rounded-full text-base font-bold border-2 border-white/60 text-white hover:bg-white/10 transition-all"
              >
                กลับหน้าหลัก
              </button>
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.4}>
            <div className="flex flex-wrap justify-center gap-6 mt-10 text-white/80 text-sm">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Grab Food</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />LINE MAN</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Robinhood</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />ออกใบกำกับภาษีอัตโนมัติ</span>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <section id="features" className="py-20 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">ฟีเจอร์ครบครัน</h2>
              <p className="text-gray-500 max-w-lg mx-auto">เครื่องมือจัดการออเดอร์อาหารครบวงจร</p>
            </div>
          </AnimateOnScroll>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <AnimateOnScroll key={f.title} delay={i * 0.08}>
                <div className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition-all group border border-gray-100">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: "#e8f8f2" }}>
                    <f.icon className="h-6 w-6" style={{ color: "#05b187" }} />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">รองรับ 3 แพลตฟอร์มหลัก</h2>
            </div>
          </AnimateOnScroll>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { name: "Grab Food", icon: "🏍️", color: "#00B14F", desc: "เชื่อมต่อ Partner API ดึงออเดอร์อัตโนมัติ" },
              { name: "LINE MAN", icon: "🟢", color: "#06C755", desc: "เชื่อมต่อ Merchant API รับออเดอร์แบบ Real-time" },
              { name: "Robinhood", icon: "🟣", color: "#6B21A8", desc: "เชื่อมต่อ Merchant Portal จัดการร้านค้า" },
            ].map((p, i) => (
              <AnimateOnScroll key={p.name} delay={i * 0.1}>
                <div className="bg-gray-50 rounded-2xl p-8 text-center hover:shadow-lg transition-all border border-gray-100">
                  <span className="text-5xl mb-4 block">{p.icon}</span>
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{p.name}</h3>
                  <p className="text-sm text-gray-500">{p.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 bg-gray-50/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">เลือกแพ็คเกจที่เหมาะกับคุณ</h2>
              <p className="text-gray-500 max-w-lg mx-auto">เริ่มต้นจัดการออเดอร์อาหารอย่างมืออาชีพ</p>
            </div>
          </AnimateOnScroll>
          <div className="grid sm:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => (
              <AnimateOnScroll key={plan.name} delay={i * 0.1}>
                <div className={`relative bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all border ${plan.popular ? "border-[#05b187] ring-2 ring-[#05b187]/20" : "border-gray-100"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: "#05b187" }}>
                      แนะนำ
                    </div>
                  )}
                  <h3 className="font-bold text-lg text-gray-800 mb-1">{plan.name}</h3>
                  <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-3xl font-extrabold" style={{ color: "#05b187" }}>฿{plan.price}</span>
                    <span className="text-sm text-gray-400">/{plan.period}</span>
                  </div>
                  <div className="space-y-2.5 mb-6">
                    {plan.features.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle2 className="h-4 w-4 shrink-0" style={{ color: "#05b187" }} />
                        {f}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate("/register")}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${plan.popular ? "text-white shadow-md hover:shadow-lg" : "border-2 hover:shadow-md"}`}
                    style={plan.popular ? { background: "#05b187" } : { borderColor: "#05b187", color: "#05b187" }}
                  >
                    เริ่มใช้งาน
                  </button>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll>
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">คำถามที่พบบ่อย</h2>
            </div>
          </AnimateOnScroll>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <AnimateOnScroll key={i} delay={i * 0.05}>
                <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                  <button className="w-full text-left px-5 py-4 flex items-center justify-between" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span className="font-medium text-gray-800 text-sm">{faq.q}</span>
                    <ChevronUp className={`h-4 w-4 text-gray-400 transition-transform ${openFaq === i ? "" : "rotate-180"}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">{faq.a}</div>
                  )}
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16" style={{ background: "#05b187" }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">พร้อมจัดการออเดอร์อาหารแบบมืออาชีพ?</h2>
          <p className="text-white/80 mb-8 max-w-lg mx-auto">เริ่มต้นใช้งาน Food Delivery วันนี้ เชื่อมต่อ Grab Food, LINE MAN, Robinhood ในไม่กี่นาที</p>
          <button
            onClick={() => navigate("/register")}
            className="px-10 py-4 rounded-full text-lg font-bold bg-white shadow-xl hover:shadow-2xl transition-all"
            style={{ color: "#05b187" }}
          >
            เริ่มใช้งานฟรี <ArrowRight className="h-5 w-5 inline ml-2" />
          </button>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center text-sm">
          <p>E-Tax Center — Food Delivery Module</p>
        </div>
      </footer>
    </div>
  );
}
