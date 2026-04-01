import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
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
          <h1 className="text-xl font-bold text-gray-800">Terms of Service / ข้อกำหนดการใช้งาน</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8 space-y-8">
          <div className="text-center border-b pb-6">
            <h2 className="text-2xl font-bold text-gray-800" data-testid="text-tos-title">ข้อกำหนดการใช้งาน</h2>
            <p className="text-gray-500 mt-1">Terms of Service</p>
            <p className="text-sm text-gray-400 mt-2">ปรับปรุงล่าสุด: กุมภาพันธ์ 2569 / Last updated: February 2026</p>
          </div>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">1. คำนิยาม / Definitions</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li><strong>"แพลตฟอร์ม"</strong> หมายถึง E-Tax Center ซึ่งเป็นระบบบัญชีดิจิทัลแบบ Multi-Tenant / <em className="text-gray-500">"Platform" means E-Tax Center, a multi-tenant digital accounting system</em></li>
              <li><strong>"ผู้ใช้งาน"</strong> หมายถึง บุคคลหรือนิติบุคคลที่ลงทะเบียนใช้งานแพลตฟอร์ม / <em className="text-gray-500">"User" means individuals or entities registered on the Platform</em></li>
              <li><strong>"บริการ"</strong> หมายถึง ฟีเจอร์ทั้งหมดที่แพลตฟอร์มให้บริการ / <em className="text-gray-500">"Services" means all features provided by the Platform</em></li>
              <li><strong>"Tenant"</strong> หมายถึง สำนักงานบัญชีหรือองค์กรที่สมัครใช้งานแพลตฟอร์ม / <em className="text-gray-500">"Tenant" means an accounting firm or organization subscribed to the Platform</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">2. ขอบเขตบริการ / Scope of Services</h3>
            <p className="text-gray-700 leading-relaxed">แพลตฟอร์มให้บริการดังต่อไปนี้:</p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>ระบบบัญชีครบวงจร: ผังบัญชี, สมุดรายวัน, งบการเงิน / <em className="text-gray-500">Full accounting: chart of accounts, journals, financial statements</em></li>
              <li>เชื่อมต่อแพลตฟอร์ม E-Commerce: Shopee, Lazada, TikTok Shop, Amazon / <em className="text-gray-500">E-commerce integration: Shopee, Lazada, TikTok Shop, Amazon</em></li>
              <li>จัดการออเดอร์, คลังสินค้า, จัดส่ง / <em className="text-gray-500">Order management, warehouse, delivery</em></li>
              <li>ออกเอกสารทางการเงินและภาษี / <em className="text-gray-500">Financial and tax document generation</em></li>
              <li>ระบบ HR: เงินเดือน, เวลาทำงาน, ภาษี / <em className="text-gray-500">HR: payroll, attendance, tax calculation</em></li>
              <li>ระบบ POS สำหรับร้านค้าปลีกและร้านอาหาร / <em className="text-gray-500">POS for retail and restaurant</em></li>
              <li>Open API สำหรับเชื่อมต่อระบบภายนอก / <em className="text-gray-500">Open API for external system integration</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">3. การลงทะเบียนและบัญชีผู้ใช้ / Registration & Account</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>ผู้ใช้ต้องให้ข้อมูลที่ถูกต้องและเป็นปัจจุบัน / <em className="text-gray-500">Users must provide accurate and up-to-date information</em></li>
              <li>ผู้ใช้รับผิดชอบในการรักษาความลับของรหัสผ่าน / <em className="text-gray-500">Users are responsible for maintaining password confidentiality</em></li>
              <li>ห้ามแบ่งปันบัญชีผู้ใช้กับบุคคลอื่น / <em className="text-gray-500">Account sharing with others is prohibited</em></li>
              <li>Tenant admin มีหน้าที่จัดการสิทธิ์ผู้ใช้ในองค์กร / <em className="text-gray-500">Tenant admin is responsible for managing user permissions</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">4. การเชื่อมต่อแพลตฟอร์มภายนอก / Third-Party Integration</h3>
            <p className="text-gray-700 leading-relaxed">
              การเชื่อมต่อกับแพลตฟอร์ม E-Commerce ดำเนินการผ่านระบบ OAuth 2.0 อย่างปลอดภัย
              ผู้ใช้ยินยอมว่า:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>การเชื่อมต่อเป็นความสมัครใจของผู้ใช้ / <em className="text-gray-500">Connection is voluntary</em></li>
              <li>แพลตฟอร์มจะเข้าถึงเฉพาะข้อมูลที่จำเป็น (ออเดอร์, สินค้า, การเงิน) / <em className="text-gray-500">Platform accesses only necessary data (orders, products, finance)</em></li>
              <li>App Secret และ API credentials จะถูกเก็บอย่างปลอดภัย ไม่เปิดเผยผ่าน API / <em className="text-gray-500">App secrets and API credentials are stored securely, never exposed via API</em></li>
              <li>Token จะถูก refresh อัตโนมัติเพื่อรักษาการเชื่อมต่อ / <em className="text-gray-500">Tokens are automatically refreshed to maintain connection</em></li>
              <li>ผู้ใช้สามารถยกเลิกการเชื่อมต่อได้ตลอดเวลา / <em className="text-gray-500">Users may disconnect at any time</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">5. API Key และความปลอดภัย / API Keys & Security</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>API Key ที่ออกให้ใช้ได้เฉพาะตาม scope ที่กำหนด / <em className="text-gray-500">API keys are valid only within their defined scope</em></li>
              <li>ผู้ใช้ต้องรักษาความลับของ API Key / <em className="text-gray-500">Users must keep API keys confidential</em></li>
              <li>แพลตฟอร์มมีสิทธิ์ระงับ API Key ที่ใช้ผิดวัตถุประสงค์ / <em className="text-gray-500">Platform may revoke misused API keys</em></li>
              <li>ข้อมูลทั้งหมดส่งผ่าน HTTPS/TLS 1.2+ เท่านั้น / <em className="text-gray-500">All data transmitted via HTTPS/TLS 1.2+ only</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">6. ข้อมูลทางการเงินและภาษี / Financial & Tax Data</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>แพลตฟอร์มเป็นเครื่องมือช่วยจัดการบัญชี ไม่ได้ให้คำปรึกษาทางภาษีหรือกฎหมาย / <em className="text-gray-500">Platform is an accounting tool, not a tax or legal advisor</em></li>
              <li>ผู้ใช้รับผิดชอบความถูกต้องของข้อมูลทางการเงินที่บันทึก / <em className="text-gray-500">Users are responsible for the accuracy of recorded financial data</em></li>
              <li>เอกสารภาษีที่ออกจากระบบต้องได้รับการตรวจสอบจากผู้ใช้ / <em className="text-gray-500">Tax documents generated must be verified by users</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">7. สิทธิในทรัพย์สินทางปัญญา / Intellectual Property</h3>
            <p className="text-gray-700 leading-relaxed">
              ซอฟต์แวร์ ส่วนประกอบ การออกแบบ และเนื้อหาทั้งหมดของแพลตฟอร์มเป็นทรัพย์สินของ E-Tax Center
              ผู้ใช้ไม่มีสิทธิ์ทำซ้ำ ดัดแปลง หรือเผยแพร่โดยไม่ได้รับอนุญาต
            </p>
            <p className="text-gray-600 text-sm italic">
              All software, components, designs, and content are property of E-Tax Center.
              Users may not reproduce, modify, or distribute without authorization.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">8. ข้อจำกัดความรับผิด / Limitation of Liability</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>แพลตฟอร์มให้บริการ "ตามสภาพที่เป็น" (as-is) / <em className="text-gray-500">Platform is provided "as-is"</em></li>
              <li>เราไม่รับผิดชอบต่อความเสียหายจากการหยุดให้บริการชั่วคราวเพื่อบำรุงรักษา / <em className="text-gray-500">Not liable for temporary service interruptions for maintenance</em></li>
              <li>เราไม่รับผิดชอบต่อปัญหาที่เกิดจากแพลตฟอร์มภายนอก (Shopee, Lazada, etc.) / <em className="text-gray-500">Not liable for issues from external platforms</em></li>
              <li>ความรับผิดสูงสุดจำกัดไม่เกินค่าบริการที่ผู้ใช้ชำระใน 12 เดือนก่อนหน้า / <em className="text-gray-500">Maximum liability limited to fees paid in the preceding 12 months</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">9. การยกเลิกบริการ / Termination</h3>
            <ul className="list-disc pl-6 space-y-2 text-gray-700">
              <li>ผู้ใช้สามารถยกเลิกบริการได้ตลอดเวลา / <em className="text-gray-500">Users may terminate service at any time</em></li>
              <li>เมื่อยกเลิก ผู้ใช้สามารถขอ export ข้อมูลได้ภายใน 30 วัน / <em className="text-gray-500">Upon termination, data export available within 30 days</em></li>
              <li>แพลตฟอร์มมีสิทธิ์ระงับบัญชีที่ละเมิดข้อกำหนด / <em className="text-gray-500">Platform may suspend accounts violating terms</em></li>
            </ul>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">10. กฎหมายที่ใช้บังคับ / Governing Law</h3>
            <p className="text-gray-700 leading-relaxed">
              ข้อกำหนดนี้อยู่ภายใต้กฎหมายแห่งราชอาณาจักรไทย ข้อพิพาทใดๆ จะอยู่ในเขตอำนาจศาลไทย
            </p>
            <p className="text-gray-600 text-sm italic">
              These terms are governed by the laws of the Kingdom of Thailand.
              Any disputes shall be under the jurisdiction of Thai courts.
            </p>
          </section>

          <section className="space-y-3">
            <h3 className="text-lg font-semibold text-[#fb9678]">11. การติดต่อ / Contact</h3>
            <div className="bg-gray-50 rounded-lg p-4 text-gray-700">
              <p><strong>E-Tax Center</strong></p>
              <p>อีเมล: support@etaxcenter.com</p>
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
