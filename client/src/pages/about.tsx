import { useLocation } from "wouter";
import { ArrowLeft, Shield, Users, Globe, Target, Award, Zap } from "lucide-react";

export default function About() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 force-light-mode">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => setLocation("/landing")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#fb9678] transition-colors"
            data-testid="btn-back-landing"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm">กลับหน้าหลัก</span>
          </button>
          <h1 className="text-xl font-bold text-gray-800">เกี่ยวกับเรา</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          <div className="text-center border-b pb-8">
            <h2 className="text-3xl font-bold text-gray-800" data-testid="text-about-title">E-Tax Center</h2>
            <p className="text-lg text-[#fb9678] mt-2 font-medium">แพลตฟอร์มบัญชีดิจิทัลครบวงจรสำหรับธุรกิจไทย</p>
            <p className="text-gray-500 mt-1">All-in-One Digital Accounting Platform for Thai Businesses</p>
          </div>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Target className="w-5 h-5 text-[#fb9678]" />
              วิสัยทัศน์ของเรา
            </h3>
            <p className="text-gray-700 leading-relaxed text-base">
              E-Tax Center ก่อตั้งขึ้นเพื่อแก้ปัญหาของสำนักงานบัญชีและธุรกิจ E-Commerce ในประเทศไทย
              ที่ต้องใช้หลายระบบแยกกันในการจัดการบัญชี ภาษี ออเดอร์ คลังสินค้า และเงินเดือน
              เราเชื่อว่าระบบเดียวที่ครบครันจะช่วยให้ธุรกิจทำงานได้เร็วขึ้น ถูกต้องมากขึ้น และลดต้นทุนได้
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Globe, color: "#fb9678", title: "E-Commerce Hub", desc: "เชื่อมต่อ Shopee, Lazada, TikTok Shop, Amazon ดึงออเดอร์อัตโนมัติ ออกใบกำกับภาษี และติดตามจัดส่งในที่เดียว" },
              { icon: Shield, color: "#05b187", title: "บัญชี & ภาษี TFRS", desc: "ผังบัญชีตามมาตรฐาน TFRS สมุดรายวัน 5 เล่ม งบการเงิน ภ.พ.30 ภงด.1 50 ทวิ ครบจบ" },
              { icon: Users, color: "#03c9d7", title: "Multi-Tenant", desc: "รองรับหลายบริษัทในระบบเดียว สำนักงานบัญชีจัดการลูกค้าหลายรายได้สะดวก" },
            ].map((item, i) => (
              <div key={i} className="border rounded-xl p-5 hover:shadow-md transition-shadow">
                <item.icon className="w-8 h-8 mb-3" style={{ color: item.color }} />
                <h4 className="font-semibold text-gray-800 mb-2">{item.title}</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Award className="w-5 h-5 text-[#fb9678]" />
              ทำไมต้อง E-Tax Center?
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { title: "ครบจบในที่เดียว", desc: "บัญชี + E-Commerce + คลังสินค้า + HR + POS ไม่ต้องใช้หลายระบบ" },
                { title: "ออกแบบสำหรับไทย", desc: "รองรับ พ.ศ., ภาษาไทย, มาตรฐาน TFRS, กฎหมายภาษีไทย, ประกันสังคม" },
                { title: "รองรับธุรกิจขนาดใหญ่", desc: "รองรับ 400+ บริษัท, 2 ล้านออเดอร์/เดือน ด้วยสถาปัตยกรรมที่แข็งแกร่ง" },
                { title: "ปลอดภัยสูง", desc: "เข้ารหัสรหัสผ่าน, OAuth 2.0, HTTPS/TLS 1.2+, RBAC, Audit Log ทุกรายการ" },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-4">
                  <h5 className="font-semibold text-gray-800 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#fec90f]" />
                    {item.title}
                  </h5>
                  <p className="text-sm text-gray-600 mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#fb9678]" />
              แพลตฟอร์มที่เชื่อมต่อ
            </h3>
            <div className="flex flex-wrap gap-3">
              {[
                { name: "Shopee", bg: "#FFF0EB", text: "#EE4D2D" },
                { name: "Lazada", bg: "#ECEDF8", text: "#0F146D" },
                { name: "TikTok Shop", bg: "#F0F0F0", text: "#000000" },
                { name: "Amazon", bg: "#FFF5E0", text: "#FF9900" },
                { name: "Grab Food", bg: "#E6F7ED", text: "#00B14F" },
                { name: "LINE MAN", bg: "#E8FAE6", text: "#3ACE01" },
                { name: "Robinhood", bg: "#F3E8F7", text: "#7B2D8E" },
                { name: "LINE OA", bg: "#E5F8EC", text: "#06C755" },
                { name: "Facebook", bg: "#E8F0FE", text: "#1877F2" },
                { name: "Instagram", bg: "#FCE8F3", text: "#E1306C" },
              ].map((p) => (
                <span key={p.name} className="px-4 py-2 rounded-full text-sm font-medium" style={{ backgroundColor: p.bg, color: p.text }}>{p.name}</span>
              ))}
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-gray-800 text-gray-400 text-center py-6 mt-8 text-sm">
        &copy; 2026 E-Tax Center. All rights reserved.
      </footer>
    </div>
  );
}
