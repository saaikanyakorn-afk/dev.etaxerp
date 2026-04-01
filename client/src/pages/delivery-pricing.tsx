import { useState, useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "wouter";
import {
  CheckCircle2, ArrowRight, ChevronUp,
  Menu, X, Truck, Package, Tag, MessageSquare,
  MapPin, ScanLine, Clock, Users, Headphones,
  Shield, Zap, BarChart3, Bell, ClipboardList
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
      style={{ background: "#03c9d7" }}
      data-testid="button-scroll-top"
    >
      <ChevronUp className="h-5 w-5 text-white" />
    </button>
  );
}

const FEATURES = [
  { icon: Package, title: "Pick-Pack-Ship", desc: "ระบบจัดการคำสั่งซื้อตั้งแต่หยิบสินค้า แพ็คกล่อง จนถึงจัดส่ง", color: "#03c9d7" },
  { icon: Tag, title: "พิมพ์ใบปะหน้าพัสดุ", desc: "พิมพ์ใบปะหน้าพัสดุทุกขนส่ง Kerry, Flash, J&T, ไปรษณีย์ไทย", color: "#05b187" },
  { icon: MapPin, title: "ติดตามพัสดุ", desc: "ติดตามสถานะพัสดุแบบ Real-time เชื่อมต่อทุกขนส่ง", color: "#fb9678" },
  { icon: MessageSquare, title: "แจ้ง Tracking ผ่าน LINE", desc: "ส่งเลข tracking ให้ลูกค้าผ่าน LINE Push Message อัตโนมัติ", color: "#05b187" },
  { icon: ScanLine, title: "สแกนพัสดุ", desc: "สแกนบาร์โค้ดเพื่ออัพเดทสถานะจัดส่งได้ทันที", color: "#fb9678" },
  { icon: BarChart3, title: "รายงานการจัดส่ง", desc: "สรุปยอดจัดส่ง สถิติขนส่ง และรายงานประสิทธิภาพ", color: "#fec90f" },
  { icon: Bell, title: "แจ้งเตือนอัตโนมัติ", desc: "แจ้งเตือนเมื่อมีออเดอร์ใหม่ พัสดุตีกลับ หรือสรุปยอดประจำวัน", color: "#f94d4d" },
  { icon: ClipboardList, title: "รายการจัดส่งครบถ้วน", desc: "ดูรายการจัดส่งทั้งหมด กรองตามสถานะ แพลตฟอร์ม และขนส่ง", color: "#03c9d7" },
];

const PRICING_PLANS = [
  {
    name: "Starter",
    price: "990",
    period: "/เดือน",
    color: "#03c9d7",
    popular: false,
    features: [
      "Pick-Pack-Ship ไม่จำกัด",
      "พิมพ์ใบปะหน้าพัสดุ",
      "ติดตามพัสดุ",
      "รองรับขนส่ง 3 บริษัท",
      "ผู้ใช้ 2 คน",
    ],
    notIncluded: [
      "แจ้ง Tracking ผ่าน LINE",
      "สแกนพัสดุ",
      "รายงานการจัดส่ง",
    ],
  },
  {
    name: "Growth",
    price: "1,990",
    period: "/เดือน",
    color: "#05b187",
    popular: true,
    features: [
      "Pick-Pack-Ship ไม่จำกัด",
      "พิมพ์ใบปะหน้าพัสดุ",
      "ติดตามพัสดุ",
      "รองรับขนส่งทุกบริษัท",
      "แจ้ง Tracking ผ่าน LINE",
      "สแกนพัสดุ",
      "ผู้ใช้ 5 คน",
    ],
    notIncluded: [
      "รายงานการจัดส่งขั้นสูง",
    ],
  },
  {
    name: "Pro",
    price: "3,990",
    period: "/เดือน",
    color: "#fb9678",
    popular: false,
    features: [
      "ทุกฟีเจอร์ใน Growth",
      "รายงานการจัดส่งขั้นสูง",
      "แจ้งเตือนอัตโนมัติครบ",
      "API เชื่อมต่อระบบภายนอก",
      "ผู้ใช้ 15 คน",
      "รองรับหลายคลังสินค้า",
      "Priority Support",
    ],
    notIncluded: [],
  },
];

const CARRIERS = [
  { name: "Kerry Express", color: "#FF6B00" },
  { name: "Flash Express", color: "#FFD700" },
  { name: "J&T Express", color: "#D62828" },
  { name: "Thailand Post", color: "#E30613" },
  { name: "Ninja Van", color: "#C83232" },
  { name: "DHL", color: "#FFCC00" },
  { name: "Best Express", color: "#FF4444" },
  { name: "SCG Express", color: "#003B71" },
];

export default function DeliveryPricing() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans antialiased force-light-mode">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <div className="h-9 w-9 rounded-xl flex items-center justify-center" style={{ background: "#03c9d7" }}>
              <Truck className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ color: "#03c9d7" }}>Delivery Hub</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">ฟีเจอร์</a>
            <a href="#carriers" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">ขนส่งที่รองรับ</a>
            <a href="#pricing" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">ราคา</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button onClick={() => navigate("/login")} className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
              เข้าสู่ระบบ
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105"
              style={{ background: "#03c9d7" }}
              data-testid="button-register-hero"
            >
              ทดลองใช้ฟรี
            </button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 p-4 space-y-3">
            <a href="#features" className="block py-2 text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>ฟีเจอร์</a>
            <a href="#carriers" className="block py-2 text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>ขนส่งที่รองรับ</a>
            <a href="#pricing" className="block py-2 text-sm font-medium text-gray-600" onClick={() => setMobileMenuOpen(false)}>ราคา</a>
            <button onClick={() => navigate("/login")} className="w-full py-2.5 text-sm font-medium text-gray-700 border rounded-lg">เข้าสู่ระบบ</button>
            <button onClick={() => navigate("/register")} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: "#03c9d7" }}>ทดลองใช้ฟรี</button>
          </div>
        )}
      </header>

      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "#e6fafb" }} />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <AnimateOnScroll>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-6" style={{ background: "#03c9d715", color: "#03c9d7" }}>
              <Truck className="h-4 w-4" />
              Delivery Hub by E-Tax Center
            </div>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 leading-tight mb-6">
              จัดส่งสินค้า<br />
              <span style={{ color: "#03c9d7" }}>มืออาชีพ</span>
            </h1>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.2}>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
              ระบบ Fulfillment ครบวงจร ตั้งแต่หยิบสินค้า แพ็คกล่อง จัดส่ง พิมพ์ใบปะหน้า
              แจ้ง Tracking ลูกค้าผ่าน LINE อัตโนมัติ
            </p>
          </AnimateOnScroll>
          <AnimateOnScroll delay={0.3}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => navigate("/register")}
                className="px-8 py-3.5 rounded-xl text-base font-semibold text-white shadow-xl transition-all hover:shadow-2xl hover:scale-105"
                style={{ background: "#03c9d7" }}
                data-testid="button-hero-cta"
              >
                เริ่มต้นใช้งานฟรี
                <ArrowRight className="inline h-5 w-5 ml-2" />
              </button>
              <button
                onClick={() => navigate("/ecommerce-pricing")}
                className="px-8 py-3.5 rounded-xl text-base font-semibold border-2 transition-all hover:shadow-md"
                style={{ borderColor: "#03c9d7", color: "#03c9d7" }}
              >
                ดู eCommerce Hub
              </button>
            </div>
          </AnimateOnScroll>
        </div>
      </section>

      <section id="features" className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">ฟีเจอร์ครบจบในที่เดียว</h2>
              <p className="text-gray-500 max-w-xl mx-auto">ระบบจัดส่งสินค้าที่ออกแบบมาเพื่อธุรกิจ eCommerce โดยเฉพาะ</p>
            </div>
          </AnimateOnScroll>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <AnimateOnScroll key={f.title} delay={i * 0.08}>
                <div className="p-6 rounded-2xl border border-gray-100 hover:shadow-lg transition-all hover:-translate-y-1 bg-white group">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110" style={{ background: `${f.color}15` }}>
                    <f.icon className="h-6 w-6" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bold text-gray-800 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section id="carriers" className="py-20 px-4" style={{ background: "#f8fffe" }}>
        <div className="max-w-4xl mx-auto text-center">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">รองรับทุกขนส่งชั้นนำ</h2>
            <p className="text-gray-500 mb-12">เชื่อมต่อขนส่งยอดนิยมในประเทศไทย พิมพ์ใบปะหน้าและติดตามพัสดุได้ทันที</p>
          </AnimateOnScroll>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {CARRIERS.map((c, i) => (
              <AnimateOnScroll key={c.name} delay={i * 0.06}>
                <div className="p-5 rounded-2xl border border-gray-100 bg-white hover:shadow-md transition-all flex flex-col items-center gap-3">
                  <div className="h-14 w-14 rounded-full flex items-center justify-center" style={{ background: `${c.color}20` }}>
                    <Truck className="h-7 w-7" style={{ color: c.color }} />
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{c.name}</span>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <AnimateOnScroll>
            <div className="text-center mb-14">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">แพ็คเกจที่เหมาะกับคุณ</h2>
              <p className="text-gray-500">เลือกแพ็คเกจที่ตรงกับความต้องการของธุรกิจ</p>
            </div>
          </AnimateOnScroll>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PRICING_PLANS.map((plan, i) => (
              <AnimateOnScroll key={plan.name} delay={i * 0.1}>
                <div className={`relative rounded-2xl border-2 p-6 ${plan.popular ? "shadow-xl scale-105" : "shadow-sm hover:shadow-lg"} bg-white transition-all`}
                  style={{ borderColor: plan.popular ? plan.color : "#e5e7eb" }}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white" style={{ background: plan.color }}>
                      ยอดนิยม
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2" style={{ color: plan.color }}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-6">
                    <span className="text-4xl font-extrabold text-gray-900">฿{plan.price}</span>
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  </div>
                  <div className="space-y-3 mb-6">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: plan.color }} />
                        <span className="text-sm text-gray-700">{f}</span>
                      </div>
                    ))}
                    {plan.notIncluded.map(f => (
                      <div key={f} className="flex items-start gap-2.5 opacity-40">
                        <X className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                        <span className="text-sm text-gray-400 line-through">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => navigate("/register")}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:shadow-md"
                    style={plan.popular
                      ? { background: plan.color, color: "#fff" }
                      : { border: `2px solid ${plan.color}`, color: plan.color, background: "transparent" }
                    }
                    data-testid={`button-pricing-${plan.name.toLowerCase()}`}
                  >
                    เริ่มต้นใช้งาน
                  </button>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 text-center" style={{ background: "#03c9d7" }}>
        <div className="max-w-3xl mx-auto">
          <AnimateOnScroll>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">พร้อมจัดส่งสินค้าอย่างมืออาชีพ?</h2>
            <p className="text-white/80 text-lg mb-8">เริ่มต้นใช้งาน Delivery Hub วันนี้ ทดลองใช้ฟรีไม่มีค่าใช้จ่าย</p>
            <button
              onClick={() => navigate("/register")}
              className="px-10 py-4 rounded-xl text-base font-bold bg-white shadow-xl hover:shadow-2xl transition-all hover:scale-105"
              style={{ color: "#03c9d7" }}
              data-testid="button-cta-bottom"
            >
              ทดลองใช้ฟรี 14 วัน
              <ArrowRight className="inline h-5 w-5 ml-2" />
            </button>
          </AnimateOnScroll>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Truck className="h-5 w-5 text-[#03c9d7]" />
              <span className="text-white font-bold">Delivery Hub</span>
            </div>
            <p className="text-sm leading-relaxed">ระบบจัดส่งสินค้าครบวงจร โดย E-Tax Center</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">โมดูลอื่นๆ</h4>
            <ul className="space-y-2 text-sm">
              <li><button onClick={() => navigate("/ecommerce-pricing")} className="hover:text-white transition-colors">eCommerce Hub</button></li>
              <li><button onClick={() => navigate("/accounting-pricing")} className="hover:text-white transition-colors">ระบบบัญชี</button></li>
              <li><button onClick={() => navigate("/")} className="hover:text-white transition-colors">หน้าหลัก</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">ติดต่อเรา</h4>
            <ul className="space-y-2 text-sm">
              <li>LINE: @etaxcenter</li>
              <li>Email: info@etaxcenter.com</li>
              <li>Tel: 02-xxx-xxxx</li>
            </ul>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-6 border-t border-gray-800 text-center text-xs">
          &copy; {new Date().getFullYear()} E-Tax Center. All rights reserved.
        </div>
      </footer>

      <ScrollToTop />
    </div>
  );
}
